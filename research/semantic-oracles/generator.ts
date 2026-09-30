/**
 * Seeded random XML generator.
 *
 * Documents are built as a small model first and then serialized. The serializer
 * records the exact offsets of every tag it writes, so tests get a ground truth
 * that does not depend on the language service being tested (the same idea
 * Csmith uses for compilers: the generator knows the right answer).
 */

export type XNode = XElement | XText | XComment | XCData;

export interface XElement {
  kind: "element";
  name: string;
  attrs: [string, string][];
  children: XNode[];
  selfClosing: boolean;
}

export interface XText {
  kind: "text";
  value: string;
}

export interface XComment {
  kind: "comment";
  value: string;
}

export interface XCData {
  kind: "cdata";
  value: string;
}

export interface XModel {
  prolog: XNode[];
  root: XElement;
}

export interface SerializeOptions {
  eol: "\n" | "\r\n";
  pretty: boolean;
  indent: string;
}

/** Offsets of one serialized element. End offsets are exclusive. */
export interface ElementSpan {
  element: XElement;
  /** Index path from the root, e.g. [0, 2] is the third child of the first child. */
  path: number[];
  openStart: number;
  nameStart: number;
  nameEnd: number;
  /** Undefined for self-closing elements. */
  closeStart?: number;
  closeNameStart?: number;
  closeNameEnd?: number;
  end: number;
}

export interface Serialized {
  text: string;
  spans: ElementSpan[];
}

// Mulberry32: tiny, fast, reproducible.
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (max: number) => Math.floor(next() * max),
    chance: (p: number) => next() < p,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
  };
}

export type Rng = ReturnType<typeof createRng>;

// A small name pool on purpose: collisions (same name nested, one name a prefix
// of another, namespace prefixes) are where tag-matching logic tends to break.
// HTML void element names are avoided so the HTML service can be used as a
// differential reference.
const NAMES = ["a", "ab", "item", "items", "b", "ns:x", "ns:xy", "entry"] as const;
const ATTR_NAMES = ["key", "ref", "ns:t", "value"] as const;
// Only legal attribute values: "<" and "&" are not allowed unescaped in XML attributes.
const ATTR_VALUES = ["1", "x > y", "a/b", "it's", "&lt;/a&gt;", "", "  spaced  "] as const;
const TEXTS = ["hello", "1 &lt; 2", "  padded  ", "multi\nline text", "é漢😀"] as const;
const COMMENTS = [" note ", " multi\n   line\n comment ", " <b>not a tag</b> "] as const;
const CDATAS = ["raw <x> & stuff", "\n    keep   this\n      indentation\n  ", "a]]b"] as const;

export function generateModel(rng: Rng): XModel {
  const prolog: XNode[] = [];
  if (rng.chance(0.3)) prolog.push({ kind: "comment", value: rng.pick(COMMENTS) });
  return { prolog, root: generateElement(rng, 0) };
}

function generateElement(rng: Rng, depth: number): XElement {
  const attrs: [string, string][] = [];
  const attrCount = rng.int(3);
  const used = new Set<string>();
  for (let i = 0; i < attrCount; i++) {
    const name = rng.pick(ATTR_NAMES);
    if (used.has(name)) continue;
    used.add(name);
    attrs.push([name, rng.pick(ATTR_VALUES)]);
  }

  const selfClosing = depth > 0 && rng.chance(0.2);
  const children: XNode[] = [];
  if (!selfClosing && depth < 4) {
    const count = rng.int(4);
    for (let i = 0; i < count; i++) {
      const roll = rng.next();
      if (roll < 0.6) children.push(generateElement(rng, depth + 1));
      else if (roll < 0.75) children.push({ kind: "text", value: rng.pick(TEXTS) });
      else if (roll < 0.9) children.push({ kind: "comment", value: rng.pick(COMMENTS) });
      else children.push({ kind: "cdata", value: rng.pick(CDATAS).replace("]]b", "]b") });
    }
  }

  return { kind: "element", name: rng.pick(NAMES), attrs, children, selfClosing };
}

export function randomSerializeOptions(rng: Rng): SerializeOptions {
  return {
    eol: rng.chance(0.25) ? "\r\n" : "\n",
    pretty: rng.chance(0.7),
    indent: rng.pick(["  ", "    ", "\t"]),
  };
}

export function serialize(model: XModel, options: SerializeOptions): Serialized {
  let out = "";
  const spans: ElementSpan[] = [];
  const nl = (level: number) => (options.pretty ? options.eol + options.indent.repeat(level) : "");
  const fix = (s: string) => s.replace(/\r?\n/g, options.eol);

  const writeNode = (node: XNode, level: number, path: number[]) => {
    switch (node.kind) {
      case "text":
        out += fix(node.value);
        return;
      case "comment":
        out += `<!--${fix(node.value)}-->`;
        return;
      case "cdata":
        out += `<![CDATA[${fix(node.value)}]]>`;
        return;
      case "element":
        writeElement(node, level, path);
    }
  };

  const writeElement = (el: XElement, level: number, path: number[]) => {
    const span: Partial<ElementSpan> = { element: el, path };
    span.openStart = out.length;
    out += "<";
    span.nameStart = out.length;
    out += el.name;
    span.nameEnd = out.length;
    for (const [k, v] of el.attrs) {
      const quote = v.includes('"') ? "'" : '"';
      out += ` ${k}=${quote}${v}${quote}`;
    }
    if (el.selfClosing) {
      out += "/>";
      span.end = out.length;
      spans.push(span as ElementSpan);
      return;
    }
    out += ">";
    const hasElementChild = el.children.some((c) => c.kind !== "text");
    el.children.forEach((child, i) => {
      if (hasElementChild) out += nl(level + 1);
      writeNode(child, level + 1, [...path, i]);
    });
    if (hasElementChild) out += nl(level);
    span.closeStart = out.length;
    out += "</";
    span.closeNameStart = out.length;
    out += el.name;
    span.closeNameEnd = out.length;
    out += ">";
    span.end = out.length;
    spans.push(span as ElementSpan);
  };

  for (const node of model.prolog) {
    writeNode(node, 0, []);
    out += options.eol;
  }
  writeElement(model.root, 0, []);
  out += options.eol;

  spans.sort((x, y) => x.openStart - y.openStart);
  return { text: out, spans };
}

/** Deep copy so shrinking and mutation never touch the original model. */
export function cloneModel(model: XModel): XModel {
  return structuredClone(model);
}

/** Returns the element at an index path (as recorded in ElementSpan.path). */
export function elementAt(model: XModel, path: number[]): XElement {
  let el = model.root;
  for (const i of path) el = el.children[i] as XElement;
  return el;
}

/**
 * Semantic test oracles for the XML language service.
 *
 * Three families, as proposed in the research plan:
 *  - ground truth   (GT-*):   compare with offsets recorded by the generator
 *  - metamorphic    (MR-*):   relations between several calls to the same service
 *  - differential   (DIFF-*): compare with an independent implementation
 *                             (vscode-html-languageservice stands in for LemMinX here)
 *
 * None of them looks for crashes only; each one detects a server that answers
 * without failing but answers wrongly.
 */
import { getLanguageService as getXmlService } from "../../src/index.js";
import type { Position } from "../../src/index.js";
import { getLanguageService as getHtmlService, TextDocument } from "vscode-html-languageservice";
import {
  cloneModel,
  elementAt,
  serialize,
  type ElementSpan,
  type SerializeOptions,
  type XModel,
} from "./generator.js";

export interface Violation {
  oracle: string;
  message: string;
  detail?: unknown;
}

export interface Oracle {
  id: string;
  family: "ground-truth" | "metamorphic" | "differential";
  description: string;
  check(model: XModel, options: SerializeOptions): Violation[];
}

const xml = getXmlService();
const html = getHtmlService();
const URI = "file:///test.xml";

// ── Helpers that deliberately do not reuse the service's own utilities ───────

/** LSP line/character for an offset. Lines end at \n, \r\n or \r as in the spec. */
export function toPosition(text: string, offset: number): Position {
  let line = 0;
  let lineStart = 0;
  for (let i = 0; i < offset; i++) {
    const ch = text[i];
    if (ch === "\r" && text[i + 1] === "\n") continue;
    if (ch === "\n" || ch === "\r") {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, character: offset - lineStart };
}

const samePos = (a: Position | undefined, b: Position | undefined) =>
  !!a && !!b && a.line === b.line && a.character === b.character;

const fmt = (p: Position | undefined) => (p ? `${p.line}:${p.character}` : "null");

interface Edit {
  startOffset: number;
  endOffset: number;
  newText: string;
}

export function applyEdits(text: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => b.startOffset - a.startOffset);
  let out = text;
  for (const e of sorted) out = out.slice(0, e.startOffset) + e.newText + out.slice(e.endOffset);
  return out;
}

function formatText(text: string): string {
  const doc = xml.parseXMLDocument(URI, text);
  return applyEdits(text, xml.format(doc));
}

/**
 * A tiny independent tokenizer producing the information that formatting must
 * keep: element names, attributes, character data and CDATA (exactly).
 * Whitespace in text and comments is normalized because a formatter may reflow it.
 */
export function infoset(text: string): string[] {
  const events: string[] = [];
  const re =
    /<!--([\s\S]*?)-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) != null) {
    if (m[1] != null) events.push(`comment(${m[1].replace(/\s+/g, " ").trim()})`);
    else if (m[2] != null) events.push(`cdata(${JSON.stringify(m[2].replace(/\r\n/g, "\n"))})`);
    else if (m[3] != null) events.push(`end(${m[3]})`);
    else if (m[4] != null) {
      const attrs = [...m[5].matchAll(/([^\s=]+)\s*=\s*("[^"]*"|'[^']*')/g)]
        .map((a) => `${a[1]}=${a[2].slice(1, -1)}`)
        .sort();
      events.push(`start(${m[4]} ${attrs.join(" ")})`);
      if (m[6]) events.push(`end(${m[4]})`);
    } else if (m[7] != null) {
      const t = m[7].replace(/\s+/g, " ").trim();
      if (t) events.push(`text(${t})`);
    }
  }
  return events;
}

function guard(oracle: string, fn: () => Violation[]): Violation[] {
  try {
    return fn();
  } catch (err) {
    return [{ oracle, message: `service threw: ${(err as Error).message}` }];
  }
}

const closable = (spans: ElementSpan[]) => spans.filter((s) => s.closeStart != null);

// ── Ground truth ─────────────────────────────────────────────────────────────

const gtDefinition: Oracle = {
  id: "GT-DEF-OPEN-TO-CLOSE",
  family: "ground-truth",
  description: "Go-to-definition on an opening tag must land on that element's own closing tag.",
  check(model, options) {
    return guard(this.id, () => {
      const { text, spans } = serialize(model, options);
      const doc = xml.parseXMLDocument(URI, text);
      const out: Violation[] = [];
      for (const s of closable(spans)) {
        const at = toPosition(text, s.nameStart);
        const got = xml.doDefinition(doc, at)?.range.start;
        const want = toPosition(text, s.closeStart!);
        if (!samePos(got, want)) {
          out.push({
            oracle: this.id,
            message: `<${s.element.name}> at ${fmt(at)}: expected ${fmt(want)}, got ${fmt(got)}`,
          });
        }
      }
      return out;
    });
  },
};

const gtReferences: Oracle = {
  id: "GT-REF-COUNT",
  family: "ground-truth",
  description: "Find-references on a tag must return exactly the elements with that name.",
  check(model, options) {
    return guard(this.id, () => {
      const { text, spans } = serialize(model, options);
      const doc = xml.parseXMLDocument(URI, text);
      const out: Violation[] = [];
      for (const s of spans) {
        const want = spans.filter((o) => o.element.name === s.element.name).length;
        const got = xml.findReferences(doc, toPosition(text, s.nameStart)).length;
        if (got !== want) {
          out.push({ oracle: this.id, message: `<${s.element.name}>: expected ${want} references, got ${got}` });
        }
      }
      return out;
    });
  },
};

const gtRename: Oracle = {
  id: "GT-RENAME-EXACT",
  family: "ground-truth",
  description: "Renaming a tag must change exactly that element's opening and closing names.",
  check(model, options) {
    return guard(this.id, () => {
      const { text, spans } = serialize(model, options);
      const doc = xml.parseXMLDocument(URI, text);
      const out: Violation[] = [];
      for (const s of spans) {
        const edits = xml.doRename(doc, toPosition(text, s.nameStart), "renamed");
        const got = edits ? applyEdits(text, edits) : text;
        const expected = cloneModel(model);
        elementAt(expected, s.path).name = "renamed";
        const want = serialize(expected, options).text;
        if (got !== want) {
          out.push({ oracle: this.id, message: `rename <${s.element.name}> at ${fmt(toPosition(text, s.nameStart))}`, detail: { got, want } });
        }
      }
      return out;
    });
  },
};

// ── Metamorphic ──────────────────────────────────────────────────────────────

const mrDefinitionRoundTrip: Oracle = {
  id: "MR-DEF-ROUNDTRIP",
  family: "metamorphic",
  description: "def(def(p)) must return to the tag p started on (open -> close -> open).",
  check(model, options) {
    return guard(this.id, () => {
      const { text, spans } = serialize(model, options);
      const doc = xml.parseXMLDocument(URI, text);
      const out: Violation[] = [];
      for (const s of closable(spans)) {
        const first = xml.doDefinition(doc, toPosition(text, s.nameStart));
        if (!first) continue;
        // Step two characters in to sit on the tag name, past "</".
        const back = { line: first.range.start.line, character: first.range.start.character + 2 };
        const second = xml.doDefinition(doc, back);
        const want = toPosition(text, s.openStart);
        if (!samePos(second?.range.start, want)) {
          out.push({
            oracle: this.id,
            message: `<${s.element.name}>: open ${fmt(want)} -> ${fmt(first.range.start)} -> ${fmt(second?.range.start)}`,
          });
        }
      }
      return out;
    });
  },
};

const mrReferenceConsistency: Oracle = {
  id: "MR-REF-CONSISTENT",
  family: "metamorphic",
  description: "Find-references from any occurrence of the same name must return the same set.",
  check(model, options) {
    return guard(this.id, () => {
      const { text, spans } = serialize(model, options);
      const doc = xml.parseXMLDocument(URI, text);
      const byName = new Map<string, string>();
      const out: Violation[] = [];
      for (const s of spans) {
        const refs = xml
          .findReferences(doc, toPosition(text, s.nameStart))
          .map((r) => `${fmt(r.range.start)}-${fmt(r.range.end)}`)
          .sort()
          .join(",");
        const seen = byName.get(s.element.name);
        if (seen == null) byName.set(s.element.name, refs);
        else if (seen !== refs) out.push({ oracle: this.id, message: `<${s.element.name}>: reference sets differ`, detail: { seen, refs } });
      }
      return out;
    });
  },
};

const mrRenameInverse: Oracle = {
  id: "MR-RENAME-INVERSE",
  family: "metamorphic",
  description: "rename(a -> b) followed by rename(b -> a) must restore the original document.",
  check(model, options) {
    return guard(this.id, () => {
      const { text, spans } = serialize(model, options);
      const out: Violation[] = [];
      for (const s of spans) {
        const at = toPosition(text, s.nameStart);
        const e1 = xml.doRename(xml.parseXMLDocument(URI, text), at, "tmpname");
        if (!e1) continue;
        const t1 = applyEdits(text, e1);
        const e2 = xml.doRename(xml.parseXMLDocument(URI, t1), at, s.element.name);
        const t2 = e2 ? applyEdits(t1, e2) : t1;
        if (t2 !== text) out.push({ oracle: this.id, message: `<${s.element.name}> at ${fmt(at)} not restored`, detail: { before: text, after: t2 } });
      }
      return out;
    });
  },
};

const mrFormatIdempotent: Oracle = {
  id: "MR-FMT-IDEMPOTENT",
  family: "metamorphic",
  description: "format(format(x)) must equal format(x).",
  check(model, options) {
    return guard(this.id, () => {
      const once = formatText(serialize(model, options).text);
      const twice = formatText(once);
      return once === twice ? [] : [{ oracle: this.id, message: "second format changed the text", detail: { once, twice } }];
    });
  },
};

const mrFormatPreserves: Oracle = {
  id: "MR-FMT-PRESERVES-CONTENT",
  family: "metamorphic",
  description: "Formatting may change layout only: names, attributes, text and CDATA must survive.",
  check(model, options) {
    return guard(this.id, () => {
      const text = serialize(model, options).text;
      const before = infoset(text);
      const after = infoset(formatText(text));
      const i = before.findIndex((ev, k) => ev !== after[k]);
      if (i === -1 && before.length === after.length) return [];
      const k = i === -1 ? before.length : i;
      return [{ oracle: this.id, message: `content differs at event ${k}: ${before[k]} vs ${after[k]}` }];
    });
  },
};

/** Everything position-based the service reports, as one comparable object. */
function positionalView(text: string, spans: ElementSpan[]) {
  const doc = xml.parseXMLDocument(URI, text);
  const strip = (s: any): any => ({ name: s.name, range: s.range, children: s.children.map(strip) });
  return {
    folding: xml.getFoldingRanges(doc),
    symbols: xml.findDocumentSymbols(doc).map(strip),
    definitions: spans.map((s) => xml.doDefinition(doc, toPosition(text, s.nameStart))?.range ?? null),
    references: spans.map((s) => xml.findReferences(doc, toPosition(text, s.nameStart)).map((r) => r.range)),
  };
}

const mrLineEndings: Oracle = {
  id: "MR-EOL-INVARIANT",
  family: "metamorphic",
  description: "LF and CRLF versions of a document must give identical line/character results.",
  check(model, options) {
    return guard(this.id, () => {
      const lf = serialize(model, { ...options, eol: "\n" });
      const crlf = serialize(model, { ...options, eol: "\r\n" });
      const a = JSON.stringify(positionalView(lf.text, lf.spans));
      const b = JSON.stringify(positionalView(crlf.text, crlf.spans));
      return a === b ? [] : [{ oracle: this.id, message: "results differ between LF and CRLF", detail: { lf: a, crlf: b } }];
    });
  },
};

const SHIFT = 3;

const mrLineShift: Oracle = {
  id: "MR-LINE-SHIFT",
  family: "metamorphic",
  description: `Prepending ${SHIFT} blank lines must shift every result down by exactly ${SHIFT} lines.`,
  check(model, options) {
    return guard(this.id, () => {
      const base = serialize(model, options);
      const pad = options.eol.repeat(SHIFT);
      const shiftedSpans = base.spans.map((s) => ({ ...s, nameStart: s.nameStart + pad.length }));
      const expected = JSON.stringify(positionalView(base.text, base.spans), (k, v) =>
        (k === "line" || k === "startLine" || k === "endLine") && typeof v === "number" ? v + SHIFT : v,
      );
      const actual = JSON.stringify(positionalView(pad + base.text, shiftedSpans));
      return expected === actual ? [] : [{ oracle: this.id, message: "results did not shift uniformly", detail: { expected, actual } }];
    });
  },
};

// ── Differential ─────────────────────────────────────────────────────────────

const diffMatchingTag: Oracle = {
  id: "DIFF-MATCHING-TAG",
  family: "differential",
  description: "Go-to-definition target must agree with the HTML service's findMatchingTagPosition.",
  check(model, options) {
    return guard(this.id, () => {
      const { text, spans } = serialize(model, options);
      if (text.includes("<![CDATA[")) return []; // HTML has no CDATA; skip to avoid false alarms
      const xdoc = xml.parseXMLDocument(URI, text);
      const tdoc = TextDocument.create(URI, "html", 1, text);
      const hdoc = html.parseHTMLDocument(tdoc);
      const out: Violation[] = [];
      for (const s of closable(spans)) {
        const at = toPosition(text, s.nameStart);
        const ref = html.findMatchingTagPosition(tdoc, at, hdoc) ?? undefined;
        const got = xml.doDefinition(xdoc, at)?.range.start;
        const ours = got && { line: got.line, character: got.character + 2 }; // skip "</"
        if (ref && !samePos(ours, ref)) {
          out.push({ oracle: this.id, message: `<${s.element.name}> at ${fmt(at)}: html ${fmt(ref)}, xml ${fmt(ours)}` });
        }
      }
      return out;
    });
  },
};

const diffFolding: Oracle = {
  id: "DIFF-FOLDING",
  family: "differential",
  description: "Folding start lines must agree with the HTML service (regions spanning 3+ lines, and comments).",
  check(model, options) {
    return guard(this.id, () => {
      const { text } = serialize(model, options);
      if (text.includes("<![CDATA[")) return [];
      const ours = xml
        .getFoldingRanges(xml.parseXMLDocument(URI, text))
        .filter((r) => r.endLine - r.startLine >= 2 || r.kind === "comment")
        .map((r) => `${r.kind === "comment" ? "comment" : "region"}@${r.startLine}`);
      // The HTML service ends a region on the line before its closing tag.
      const theirs = html
        .getFoldingRanges(TextDocument.create(URI, "html", 1, text), {})
        .filter((r) => r.kind === "comment" || r.endLine - r.startLine >= 1)
        .map((r) => `${r.kind === "comment" ? "comment" : "region"}@${r.startLine}`);
      const a = [...new Set(ours)].sort().join(" ");
      const b = [...new Set(theirs)].sort().join(" ");
      return a === b ? [] : [{ oracle: this.id, message: `xml [${a}] vs html [${b}]` }];
    });
  },
};

export const ORACLES: Oracle[] = [
  gtDefinition,
  gtReferences,
  gtRename,
  mrDefinitionRoundTrip,
  mrReferenceConsistency,
  mrRenameInverse,
  mrFormatIdempotent,
  mrFormatPreserves,
  mrLineEndings,
  mrLineShift,
  diffMatchingTag,
  diffFolding,
];

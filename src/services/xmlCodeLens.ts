import { XMLDocument, XMLNode } from "../parser/xmlNode.js";
import { Range, offsetsToRange } from "../utils/rangeUtils.js";

/** An inline annotation rendered above a named XML element showing its usage count. */
export interface CodeLens {
  /** The range of the element's opening tag — where the lens is rendered. */
  range: Range;
  /** Human-readable label, e.g. "3 references" or "0 references". */
  title: string;
  /** The tag name of the defining element, e.g. "sequence". */
  elementName: string;
  /** The value of its name attribute, e.g. "mySeq". */
  nameValue: string;
}

/**
 * Finds the value of the first attribute matching any of the given names on a node.
 * Returns undefined when none of the attributes exist on the node.
 */
function getAttrValue(node: XMLNode, ...attrNames: string[]): string | undefined {
  for (const name of attrNames) {
    const attr = node.attributes.find((a) => a.name === name);
    if (attr?.value !== undefined) return attr.value;
  }
  return undefined;
}

/**
 * Returns Code Lens annotations for every named element in the document.
 *
 * A "named element" is any element that carries a `name` attribute — these act
 * as definitions (like function declarations) that other elements can reference.
 * For each one, we count how many other nodes in the document reference that
 * name through common reference attributes: `key`, `ref`, `target`, `href`,
 * `type`, or `base`.
 *
 * Example — given this XML:
 *
 *   <sequence name="addHeader">...</sequence>
 *   <sequence key="addHeader" />
 *   <sequence key="addHeader" />
 *
 * The lens above `<sequence name="addHeader">` will read "2 references".
 */
export function getCodeLens(document: XMLDocument): CodeLens[] {
  // ── Pass 1: collect all reference attribute values in the document ───────
  // We count how many nodes carry a reference-style attribute pointing to each name.
  const refCounts = new Map<string, number>();

  document.traverse((node) => {
    if (node.type !== "element") return;
    const refValue = getAttrValue(node, "key", "ref", "target", "href", "type", "base");
    if (refValue) {
      refCounts.set(refValue, (refCounts.get(refValue) ?? 0) + 1);
    }
  });

  // ── Pass 2: emit a CodeLens for every element that has a name attribute ──
  const lenses: CodeLens[] = [];

  document.traverse((node) => {
    if (node.type !== "element" || !node.name) return;

    const nameValue = getAttrValue(node, "name");
    if (!nameValue) return;

    const count = refCounts.get(nameValue) ?? 0;
    const title = count === 1 ? "1 reference" : `${count} references`;

    // Anchor the lens to the opening tag line only (from '<' to end of tag name).
    const tagEnd = node.startOffset + node.name.length + 1;
    lenses.push({
      range: offsetsToRange(document.text, node.startOffset, tagEnd),
      title,
      elementName: node.name,
      nameValue,
    });
  });

  return lenses;
}

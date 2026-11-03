import { XMLDocument, XMLNode } from "../parser/xmlNode.js";

/**
 * Returns the offset of the `</name` that closes `node`, or -1 when the element is
 * self-closing or has no matching end tag. The search runs backward from the node's
 * end, so nested elements with the same name and names sharing a prefix
 * (e.g. `<a>` and `<ab>`) are not confused.
 */
export function findCloseTagStart(text: string, node: XMLNode): number {
  if (!node.name || node.isSelfClosing) return -1;
  const pattern = `</${node.name}`;
  const idx = text.lastIndexOf(pattern, node.endOffset - pattern.length);
  if (idx <= node.startOffset) return -1;
  const next = text[idx + pattern.length];
  return next === ">" || (next !== undefined && /\s/.test(next)) ? idx : -1;
}

/** Returns the default namespace (`xmlns`) declared on the document's root element. */
export function getRootNamespace(document: XMLDocument): string | undefined {
  const root = document.children.find((n) => n.type === "element");
  return root?.attributes.find((a) => a.name === "xmlns")?.value;
}

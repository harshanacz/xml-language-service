import { XMLDocument } from "../parser/xmlNode.js";
import { Position, positionToOffset } from "../utils/positionUtils.js";
import { Range, offsetsToRange } from "../utils/rangeUtils.js";
import type { XsdCompletionProvider } from "../schema/xsdCompletionProvider.js";

/** The result returned from a hover request: markdown content and the range it applies to. */
export interface HoverResult {
  contents: string;
  range: Range;
}

/**
 * Returns hover information for the XML node at the given document position.
 * Uses schema data to provide richer documentation when available, otherwise
 * falls back to structural information from the document tree.
 * Inside a comment it returns the comment text. Returns null when the position is
 * not inside an element or a comment.
 */
export function doHover(
  document: XMLDocument,
  position: Position,
  schemaProvider?: XsdCompletionProvider | null
): HoverResult | null {
  const offset = positionToOffset(document.text, position);
  const node = document.findNodeAt(offset);

  if (node?.type === "comment") {
    return {
      contents: `### Comment\n${node.name ?? ""}`,
      range: offsetsToRange(document.text, node.startOffset, node.endOffset),
    };
  }

  if (!node || node.type !== "element") return null;

  if (schemaProvider?.hasData() && node.name) {
    const info = schemaProvider.getElement(node.name);
    if (info) {
      const sections: string[] = [`### \`<${node.name}>\``];

      if (info.description) sections.push(info.description);

      if (info.attributes.length > 0) {
        const attrLines = info.attributes
          .map((a) =>
            `- \`${a.name}\`${a.type ? ` — *${a.type}*` : ""}${a.required ? " *(required)*" : ""}`
          )
          .join("\n");
        sections.push(`**Attributes:**\n${attrLines}`);
      }

      if (info.children.length > 0) {
        sections.push(`**Children:** ${info.children.join(", ")}`);
      }

      return {
        contents: sections.join("\n\n"),
        range: offsetsToRange(document.text, node.startOffset, node.endOffset),
      };
    }
  }

  // Fallback: structural info from the document tree
  const sections: string[] = [`### \`<${node.name}>\``];
  if (node.attributes.length > 0) {
    const attrLines = node.attributes
      .map((attr) => `- \`${attr.name}="${attr.value ?? ""}"\``)
      .join("\n");
    sections.push(`**Attributes:**\n${attrLines}`);
  }
  sections.push(`**Children:** ${node.children.length}`);
  return {
    contents: sections.join("\n\n"),
    range: offsetsToRange(document.text, node.startOffset, node.endOffset),
  };
}

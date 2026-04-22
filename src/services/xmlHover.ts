import { XMLDocument } from "../parser/xmlNode.js";
import { Position, positionToOffset } from "../utils/positionUtils.js";
import { Range, offsetsToRange } from "../utils/rangeUtils.js";

/** The result returned from a hover request: markdown content and the range it applies to. */
export interface HoverResult {
  contents: string;
  range: Range;
}

/**
 * Returns hover information for the XML node at the given document position,
 * or null if no meaningful hover applies (e.g. plain text or the document root).
 */
export function doHover(document: XMLDocument, position: Position): HoverResult | null {
  const offset = positionToOffset(document.text, position);
  const node = document.findNodeAt(offset);

  if (!node || node.type === "root") return null;

  if (node.type === "element") {
    const lines: string[] = [`### <${node.name}>`];
    if (node.attributes.length > 0) {
      lines.push(`**Attributes:** ${node.attributes.length}`);
      for (const attr of node.attributes) {
        lines.push(`- \`${attr.name}="${attr.value ?? ""}"\``);
      }
    }
    lines.push(`**Children:** ${node.children.length}`);
    return {
      contents: lines.join("\n"),
      range: offsetsToRange(document.text, node.startOffset, node.endOffset),
    };
  }

  if (node.type === "comment") {
    return {
      contents: `### Comment\n${node.name ?? ""}`,
      range: offsetsToRange(document.text, node.startOffset, node.endOffset),
    };
  }

  return null;
}

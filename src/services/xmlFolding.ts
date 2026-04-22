import { XMLDocument, XMLNode } from "../parser/xmlNode.js";
import { offsetToPosition } from "../utils/positionUtils.js";

/** Represents a collapsible region in the editor, mirroring the LSP FoldingRange structure. */
export interface FoldingRange {
  startLine: number;
  endLine: number;
  kind: "region";
}

/**
 * Returns a flat list of FoldingRange objects for every multi-line, non-self-closing element
 * in the XML document tree.
 */
export function getFoldingRanges(document: XMLDocument): FoldingRange[] {
  const result: FoldingRange[] = [];
  collectRanges(document.children, document.text, result);
  return result;
}

function collectRanges(nodes: XMLNode[], text: string, result: FoldingRange[]): void {
  for (const node of nodes) {
    if (node.type !== "element" || node.isSelfClosing) continue;
    const startLine = offsetToPosition(text, node.startOffset).line;
    const endLine = offsetToPosition(text, node.endOffset).line;
    if (startLine < endLine) {
      result.push({ startLine, endLine, kind: "region" });
    }
    collectRanges(node.children, text, result);
  }
}

import { XMLDocument, XMLNode } from "../parser/xmlNode.js";
import { offsetToPosition } from "../utils/positionUtils.js";

/** Represents a collapsible region in the editor, mirroring the LSP FoldingRange structure. */
export interface FoldingRange {
  startLine: number;
  endLine: number;
  kind: "region" | "comment";
}

/**
 * Returns a flat list of FoldingRange objects for every multi-line, non-self-closing element
 * and multi-line comment in the XML document tree.
 */
export function getFoldingRanges(document: XMLDocument): FoldingRange[] {
  const result: FoldingRange[] = [];
  collectRanges(document.children, document.text, result);
  collectCommentRanges(document.text, result);
  return result;
}

// Comments are not part of the element tree, so they are located in the raw text.
function collectCommentRanges(text: string, result: FoldingRange[]): void {
  for (const m of text.matchAll(/<!--[\s\S]*?-->/g)) {
    const startLine = offsetToPosition(text, m.index!).line;
    const endLine = offsetToPosition(text, m.index! + m[0].length).line;
    if (startLine < endLine) {
      result.push({ startLine, endLine, kind: "comment" });
    }
  }
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

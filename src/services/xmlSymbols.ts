import { XMLDocument, XMLNode } from "../parser/xmlNode.js";
import { Range, offsetsToRange } from "../utils/rangeUtils.js";

/** Represents a named symbol (element) in the XML document, mirroring the LSP DocumentSymbol structure. */
export interface DocumentSymbol {
  name: string;
  kind: "element";
  range: Range;
  selectionRange: Range;
  children: DocumentSymbol[];
}

/**
 * Walks the XML document tree and returns a hierarchical list of DocumentSymbol objects,
 * one per element node, preserving parent-child nesting.
 */
export function findDocumentSymbols(document: XMLDocument): DocumentSymbol[] {
  return buildSymbols(document.children, document.text);
}

function buildSymbols(nodes: XMLNode[], text: string): DocumentSymbol[] {
  const symbols: DocumentSymbol[] = [];
  for (const node of nodes) {
    if (node.type !== "element" || !node.name) continue;
    symbols.push({
      name: node.name,
      kind: "element",
      range: offsetsToRange(text, node.startOffset, node.endOffset),
      // selectionRange covers '<' + the tag name
      selectionRange: offsetsToRange(
        text,
        node.startOffset,
        node.startOffset + node.name.length + 1
      ),
      children: buildSymbols(node.children, text),
    });
  }
  return symbols;
}

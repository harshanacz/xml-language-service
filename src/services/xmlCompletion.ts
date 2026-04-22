import { XMLDocument } from "../parser/xmlNode.js";
import { Position, positionToOffset } from "../utils/positionUtils.js";

/** A single completion suggestion returned to the editor. */
export interface CompletionItem {
  label: string;
  kind: "element" | "attribute" | "value" | "closeTag";
  insertText: string;
  detail?: string;
}

/** A list of completion suggestions for a given cursor position. */
export interface CompletionList {
  items: CompletionItem[];
  isIncomplete: boolean;
}

/**
 * Returns completion suggestions for the given cursor position by detecting whether
 * the cursor is after '<', '</', or inside an attribute list, and collecting
 * candidates from the existing document tree.
 */
export function doComplete(document: XMLDocument, position: Position): CompletionList {
  const offset = positionToOffset(document.text, position);
  const textBefore = document.text.substring(0, offset);

  // Context 3 must be checked before context 1 because '</' also starts with '<'
  if (/<\/$/.test(textBefore)) {
    const node = document.findNodeAt(offset);
    if (node && node.type === "element" && node.name) {
      return {
        items: [
          {
            label: node.name,
            kind: "closeTag",
            insertText: `${node.name}>`,
          },
        ],
        isIncomplete: false,
      };
    }
    return { items: [], isIncomplete: false };
  }

  // Context 1: cursor is right after '<' or '<' + partial tag name
  if (/<\w*$/.test(textBefore)) {
    const names = new Set<string>();
    document.traverse((n) => {
      if (n.type === "element" && n.name) names.add(n.name);
    });
    return {
      items: Array.from(names).map((name) => ({
        label: name,
        kind: "element" as const,
        insertText: `${name}>$0</${name}>`,
      })),
      isIncomplete: false,
    };
  }

  // Context 2: cursor is in an attribute position (after tag name + whitespace)
  if (/\w+\s+\w*$/.test(textBefore)) {
    const attrs = ["xml:lang", "xml:space", "xmlns"];
    return {
      items: attrs.map((attr) => ({
        label: attr,
        kind: "attribute" as const,
        insertText: `${attr}="$0"`,
      })),
      isIncomplete: false,
    };
  }

  return { items: [], isIncomplete: false };
}

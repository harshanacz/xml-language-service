import { XMLDocument } from "../parser/xmlNode.js";
import { Position, positionToOffset } from "../utils/positionUtils.js";
import { TextEdit } from "./xmlFormatter.js";
import { findCloseTagStart } from "../utils/tagUtils.js";

/**
 * Returns TextEdits that rename both the opening and closing tags of the element at the
 * given position, or null if the position is not on a named element or the new name is invalid.
 */
export function doRename(
  document: XMLDocument,
  position: Position,
  newName: string
): TextEdit[] | null {
  if (!newName || /[\s<>]/.test(newName)) return null;

  const offset = positionToOffset(document.text, position);
  const node = document.findNodeAt(offset);

  if (!node || node.type !== "element" || !node.name) return null;

  const edits: TextEdit[] = [];

  // Opening tag: skip the leading '<'
  const openNameStart = node.startOffset + 1;
  const openNameEnd = openNameStart + node.name.length;
  edits.push({ startOffset: openNameStart, endOffset: openNameEnd, newText: newName });

  const closeIdx = findCloseTagStart(document.text, node);
  if (closeIdx !== -1) {
    const closeNameStart = closeIdx + 2; // skip '</'
    edits.push({ startOffset: closeNameStart, endOffset: closeNameStart + node.name.length, newText: newName });
  }

  return edits;
}

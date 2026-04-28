import { XMLDocument } from "../parser/xmlNode.js";
import { Position, positionToOffset } from "../utils/positionUtils.js";
import { Range, offsetsToRange } from "../utils/rangeUtils.js";

const IDENTIFYING_ATTRIBUTES = ["name", "id", "key", "ref"];

/** A location in the document that references an element with a given tag name. */
export interface ReferenceResult {
  uri: string;
  range: Range;
}

/**
 * Returns all locations in the document where an element with the same tag name as the
 * element under the cursor appears, including the cursor's own element.
 * Returns an empty array when the cursor is not on a named element node.
 */
export function findReferences(
  document: XMLDocument,
  position: Position
): ReferenceResult[] {
  const offset = positionToOffset(document.text, position);
  const node = document.findNodeAt(offset);

  if (!node || node.type !== "element" || !node.name) return [];

  const targetName = node.name;
  const targetIdentifier = node.attributes.find(
    (attr) => attr.value != null && IDENTIFYING_ATTRIBUTES.includes(attr.name)
  );
  const results: ReferenceResult[] = [];

  document.traverse((n) => {
    if (n.type !== "element" || n.name !== targetName) return;

    if (targetIdentifier) {
      const match = n.attributes.find(
        (attr) =>
          attr.name === targetIdentifier.name &&
          attr.value === targetIdentifier.value
      );
      if (!match) return;
    }

    results.push({
      uri: document.uri,
      range: offsetsToRange(document.text, n.startOffset, n.endOffset),
    });
  });

  return results;
}

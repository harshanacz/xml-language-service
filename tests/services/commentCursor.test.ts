import { describe, it, expect } from "vitest";
import { parseXMLDocument } from "../../src/parser/xmlParser.js";
import { doComplete } from "../../src/services/xmlCompletion.js";
import { doRename } from "../../src/services/xmlRename.js";
import { doDefinition } from "../../src/services/xmlDefinition.js";
import { findReferences } from "../../src/services/xmlReferences.js";
import { offsetToPosition } from "../../src/utils/positionUtils.js";

const uri = "file:///test.xml";

// Cursor markers: "|" marks the cursor position and is removed from the text.
function withCursor(marked: string) {
  const offset = marked.indexOf("|");
  const text = marked.replace("|", "");
  return { text, position: offsetToPosition(text, offset), doc: parseXMLDocument(uri, text) };
}

describe("cursor inside a comment: rename, definition, references", () => {
  it("rename returns null when the cursor is inside a comment", () => {
    const { doc, position } = withCursor("<root><!-- ro|ot note --><child/></root>");
    expect(doRename(doc, position, "renamed")).toBeNull();
  });

  it("definition returns null when the cursor is inside a comment", () => {
    const { doc, position } = withCursor("<root><!-- ro|ot note --></root>");
    expect(doDefinition(doc, position)).toBeNull();
  });

  it("references returns an empty list when the cursor is inside a comment", () => {
    const { doc, position } = withCursor("<root><!-- ro|ot note --><root/></root>");
    expect(findReferences(doc, position)).toEqual([]);
  });

  it("rename still works on the element right after a comment", () => {
    const { doc, position } = withCursor("<root><!-- note --><ch|ild/></root>");
    expect(doRename(doc, position, "item")).toHaveLength(1);
  });

  it("definition still works on the open tag of an element containing a comment", () => {
    const { doc, position } = withCursor("<ro|ot><!-- note --></root>");
    expect(doDefinition(doc, position)).not.toBeNull();
  });
});

describe("cursor inside a comment: completion", () => {
  it("offers nothing for '</' typed inside a comment", () => {
    const { doc, position } = withCursor("<root><!-- see </| --></root>");
    expect(doComplete(doc, position).items).toEqual([]);
  });

  // Known gap (also present before PR #82): '<' inside a comment still suggests elements.
  // Remove `.fails` once xmlCompletion returns early for comment nodes.
  it.fails("offers no element suggestions for '<' typed inside a comment", () => {
    const { doc, position } = withCursor("<root><child/><!-- a <| --></root>");
    expect(doComplete(doc, position).items).toEqual([]);
  });

  it("still suggests the close tag after '</' outside a comment", () => {
    const { doc, position } = withCursor("<root><!-- note --></|root>");
    // cursor is after '</' so the enclosing element name is suggested
    const items = doComplete(doc, position).items;
    expect(items.map((i) => i.label)).toContain("root");
  });

  it("still suggests elements after '<' next to a comment", () => {
    const { doc, position } = withCursor("<root><child/><!-- note --><|</root>");
    expect(doComplete(doc, position).items.length).toBeGreaterThan(0);
  });
});

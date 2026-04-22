import { describe, it, expect } from "vitest";
import { parseXMLDocument } from "../../src/parser/xmlParser.js";
import { findReferences } from "../../src/services/xmlReferences.js";

const xml = "<root><item/><item/><item/></root>";
const uri = "file:///test.xml";

describe("findReferences", () => {
  const doc = parseXMLDocument(uri, xml);

  it("findReferences on 'item' returns 3 results", () => {
    // offset 7 is inside the first <item/>  (starts at 6)
    const results = findReferences(doc, { line: 0, character: 7 });
    expect(results).toHaveLength(3);
  });

  it("all results have the correct uri", () => {
    const results = findReferences(doc, { line: 0, character: 7 });
    for (const r of results) {
      expect(r.uri).toBe(uri);
    }
  });

  it("all results have valid ranges with start before end", () => {
    const results = findReferences(doc, { line: 0, character: 7 });
    for (const r of results) {
      const { start, end } = r.range;
      const startsBefore =
        start.line < end.line ||
        (start.line === end.line && start.character <= end.character);
      expect(startsBefore).toBe(true);
    }
  });

  it("findReferences on 'root' returns 1 result", () => {
    // offset 1 is inside <root>
    const results = findReferences(doc, { line: 0, character: 1 });
    expect(results).toHaveLength(1);
  });

  it("findReferences on an empty document returns []", () => {
    const emptyDoc = parseXMLDocument(uri, "");
    const results = findReferences(emptyDoc, { line: 0, character: 0 });
    expect(results).toHaveLength(0);
  });
});

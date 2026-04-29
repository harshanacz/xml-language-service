import { describe, it, expect } from "vitest";
import { parseXMLDocument } from "../../src/parser/xmlParser.js";
import { doDefinition } from "../../src/services/xmlDefinition.js";

const uri = "file:///test.xml";

describe("doDefinition", () => {
  it("jumps from an outer opening tag to its matching outer closing tag", () => {
    const xml = `<section>
    <section>
        Some text
    </section>
</section>`;
    const doc = parseXMLDocument(uri, xml);
    const result = doDefinition(doc, { line: 0, character: 1 });

    expect(result).not.toBeNull();
    expect(result?.uri).toBe(uri);
    expect(result?.range.start).toEqual({ line: 4, character: 0 });
  });

  it("jumps from an inner opening tag to its matching inner closing tag", () => {
    const xml = `<section>
    <section>
        Some text
    </section>
</section>`;
    const doc = parseXMLDocument(uri, xml);
    const result = doDefinition(doc, { line: 1, character: 5 });

    expect(result).not.toBeNull();
    expect(result?.range.start).toEqual({ line: 3, character: 4 });
  });

  it("jumps from a closing tag back to the matching opening tag", () => {
    const xml = `<section>
    <section>
        Some text
    </section>
</section>`;
    const doc = parseXMLDocument(uri, xml);
    const result = doDefinition(doc, { line: 4, character: 2 });

    expect(result).not.toBeNull();
    expect(result?.range.start).toEqual({ line: 0, character: 0 });
  });

  it("returns null for self-closing elements", () => {
    const doc = parseXMLDocument(uri, "<root><item/></root>");
    expect(doDefinition(doc, { line: 0, character: 7 })).toBeNull();
  });
});

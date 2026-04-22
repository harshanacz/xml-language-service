import { describe, it, expect } from "vitest";
import { parseXMLDocument } from "../../src/parser/xmlParser.js";
import { doComplete } from "../../src/services/xmlCompletion.js";

// line 0: <root><child/></root>
// offset 7 = textBefore '<root><' → context 1 (after '<')
// offset 16 = textBefore '<root><child/></' → context 3 (after '</')
const xml = "<root><child/></root>";
const uri = "file:///test.xml";

describe("doComplete", () => {
  const doc = parseXMLDocument(uri, xml);

  it("always returns a CompletionList (never null or undefined)", () => {
    const result = doComplete(doc, { line: 0, character: 0 });
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
  });

  it("CompletionList has an items array and an isIncomplete boolean", () => {
    const result = doComplete(doc, { line: 0, character: 0 });
    expect(Array.isArray(result.items)).toBe(true);
    expect(typeof result.isIncomplete).toBe("boolean");
  });

  it("context after '<' returns items with kind 'element'", () => {
    // offset 7: textBefore = '<root><' → context 1
    const result = doComplete(doc, { line: 0, character: 7 });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((i) => i.kind === "element")).toBe(true);
  });

  it("element completions include names from the document tree", () => {
    const result = doComplete(doc, { line: 0, character: 7 });
    const labels = result.items.map((i) => i.label);
    expect(labels).toContain("root");
    expect(labels).toContain("child");
  });

  it("context after '</' returns a closeTag kind item", () => {
    // offset 16: textBefore = '<root><child/></' → context 3
    const result = doComplete(doc, { line: 0, character: 16 });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.some((i) => i.kind === "closeTag")).toBe(true);
  });

  it("all items have a label and an insertText", () => {
    const result = doComplete(doc, { line: 0, character: 7 });
    for (const item of result.items) {
      expect(typeof item.label).toBe("string");
      expect(item.label.length).toBeGreaterThan(0);
      expect(typeof item.insertText).toBe("string");
    }
  });

  it("isIncomplete is false for all contexts", () => {
    expect(doComplete(doc, { line: 0, character: 7 }).isIncomplete).toBe(false);
    expect(doComplete(doc, { line: 0, character: 16 }).isIncomplete).toBe(false);
    expect(doComplete(doc, { line: 0, character: 0 }).isIncomplete).toBe(false);
  });
});

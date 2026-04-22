import { describe, it, expect } from "vitest";
import { parseXMLDocument } from "../../src/parser/xmlParser.js";
import { doHover } from "../../src/services/xmlHover.js";

// line 0: <root>
// line 1:   <child name="test" value="hello"/>
// line 2: </root>
const xml = `<root>\n  <child name="test" value="hello"/>\n</root>`;

describe("doHover", () => {
  const doc = parseXMLDocument("file:///test.xml", xml);

  it("hovering inside the root tag returns a non-null HoverResult", () => {
    // offset 1 is inside '<root>' — the 'r' character
    const result = doHover(doc, { line: 0, character: 1 });
    expect(result).not.toBeNull();
  });

  it("root hover contents contains the element name 'root'", () => {
    const result = doHover(doc, { line: 0, character: 1 });
    expect(result?.contents).toContain("root");
  });

  it("hovering inside the child tag returns a non-null HoverResult", () => {
    // line 1, character 3 is inside '<child ...'
    const result = doHover(doc, { line: 1, character: 3 });
    expect(result).not.toBeNull();
  });

  it("child hover contents contains the element name 'child'", () => {
    const result = doHover(doc, { line: 1, character: 3 });
    expect(result?.contents).toContain("child");
  });

  it("child hover contents includes attribute information", () => {
    const result = doHover(doc, { line: 1, character: 3 });
    expect(result?.contents).toContain("Attributes");
    expect(result?.contents).toContain("name");
  });

  it("hover result has a range with defined start and end", () => {
    const result = doHover(doc, { line: 1, character: 3 });
    expect(result?.range.start).toBeDefined();
    expect(result?.range.end).toBeDefined();
  });

  it("hovering at line 0 character 0 returns null or a valid result without throwing", () => {
    expect(() => doHover(doc, { line: 0, character: 0 })).not.toThrow();
  });
});

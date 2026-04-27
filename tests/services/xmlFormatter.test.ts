import { describe, it, expect } from "vitest";
import { parseXMLDocument } from "../../src/parser/xmlParser.js";
import { format } from "../../src/services/xmlFormatter.js";

describe("format", () => {
  it("returns [] for an empty document", () => {
    const doc = parseXMLDocument("file:///test.xml", "");
    expect(format(doc)).toEqual([]);
  });

  it("returns a single TextEdit for any non-empty document", () => {
    const doc = parseXMLDocument("file:///test.xml", "<root><child/></root>");
    const edits = format(doc);
    expect(edits).toHaveLength(1);
  });

  it("TextEdit startOffset is 0 and endOffset equals document text length", () => {
    const text = "<root>\n<child/>\n</root>";
    const doc = parseXMLDocument("file:///test.xml", text);
    const [edit] = format(doc);
    expect(edit.startOffset).toBe(0);
    expect(edit.endOffset).toBe(text.length);
  });

  it("unindented XML becomes properly indented", () => {
    const unindented = "<root>\n<child>\ntext\n</child>\n</root>";
    const doc = parseXMLDocument("file:///test.xml", unindented);
    const [edit] = format(doc, { tabSize: 2, insertSpaces: true });
    expect(edit.newText).toBe("<root>\n  <child>\n    text\n  </child>\n</root>");
  });

  it("self-closing tags do not increase the indent level", () => {
    const xml = "<root>\n<br/>\n<child>\n</child>\n</root>";
    const doc = parseXMLDocument("file:///test.xml", xml);
    const [edit] = format(doc, { tabSize: 2, insertSpaces: true });
    const lines = edit.newText.split("\n");
    const brLine = lines.find((l) => l.includes("<br/>"));
    const childLine = lines.find((l) => l.trimStart().startsWith("<child>"));
    // Both <br/> and <child> should be at the same indent level (one level in)
    expect(brLine).toBe("  <br/>");
    expect(childLine).toBe("  <child>");
  });

  it("applying the TextEdit newText produces valid indented XML", () => {
    const unindented = "<root>\n<child>\ntext\n</child>\n</root>";
    const doc = parseXMLDocument("file:///test.xml", unindented);
    const [edit] = format(doc);
    expect(edit.newText).toBe("<root>\n  <child>\n    text\n  </child>\n</root>");
  });

  it("tab indentation is used when insertSpaces is false", () => {
    const xml = "<root>\n<child/>\n</root>";
    const doc = parseXMLDocument("file:///test.xml", xml);
    const [edit] = format(doc, { tabSize: 4, insertSpaces: false });
    expect(edit.newText).toContain("\t<child/>");
  });

  it("formats one-liner nested tags using AST depth", () => {
    const xml = "<person><name><first>John</first></name></person>";
    const doc = parseXMLDocument("file:///test.xml", xml);
    const [edit] = format(doc, { tabSize: 2, insertSpaces: true });

    expect(edit.newText).toBe(
      "<person>\n  <name>\n    <first>\n      John\n    </first>\n  </name>\n</person>",
    );
  });

  it("keeps attributes attached to their parent tag when source attributes were multi-line", () => {
    const xml = '<endpoint\n  name="myEndpoint"\n  timeout="3000"\n><child/></endpoint>';
    const doc = parseXMLDocument("file:///test.xml", xml);
    const [edit] = format(doc, { tabSize: 2, insertSpaces: true });

    expect(edit.newText).toBe('<endpoint name="myEndpoint" timeout="3000">\n  <child/>\n</endpoint>');
  });

  it("formats mixed content without breaking nested elements", () => {
    const xml = "<p>start<b>bold</b>end</p>";
    const doc = parseXMLDocument("file:///test.xml", xml);
    const [edit] = format(doc, { tabSize: 2, insertSpaces: true });

    expect(edit.newText).toBe("<p>\n  start\n  <b>\n    bold\n  </b>\n  end\n</p>");
  });
});

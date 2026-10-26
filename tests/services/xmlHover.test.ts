import { describe, it, expect } from "vitest";
import { parseXMLDocument } from "../../src/parser/xmlParser.js";
import { doHover } from "../../src/services/xmlHover.js";
import { XsdCompletionProvider } from "../../src/schema/xsdCompletionProvider.js";
import { offsetToPosition } from "../../src/utils/positionUtils.js";

// ─── Structural hover (no schema) ────────────────────────────────────────────
// line 0: <root>
// line 1:   <child name="test" value="hello"/>
// line 2: </root>
const xml = `<root>\n  <child name="test" value="hello"/>\n</root>`;

describe("doHover — structural (no schema)", () => {
  const doc = parseXMLDocument("file:///test.xml", xml);

  it("hovering inside the root tag returns a non-null HoverResult", () => {
    const result = doHover(doc, { line: 0, character: 1 });
    expect(result).not.toBeNull();
  });

  it("root hover contents contains the element name 'root'", () => {
    const result = doHover(doc, { line: 0, character: 1 });
    expect(result?.contents).toContain("root");
  });

  it("hovering inside the child tag returns a non-null HoverResult", () => {
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

  it("range start is before or equal to range end", () => {
    const result = doHover(doc, { line: 1, character: 3 });
    expect(result).not.toBeNull();
    const { start, end } = result!.range;
    const valid =
      start.line < end.line ||
      (start.line === end.line && start.character <= end.character);
    expect(valid).toBe(true);
  });

  it("hovering an empty document returns null without throwing", () => {
    const emptyDoc = parseXMLDocument("file:///test.xml", "");
    expect(() => doHover(emptyDoc, { line: 0, character: 0 })).not.toThrow();
    expect(doHover(emptyDoc, { line: 0, character: 0 })).toBeNull();
  });
});

// ─── XSD-enriched hover ───────────────────────────────────────────────────────

const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="root">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="child"/>
        <xs:element name="item"/>
      </xs:sequence>
      <xs:attribute name="id"    type="xs:string" use="required"/>
      <xs:attribute name="class" type="xs:string"/>
    </xs:complexType>
  </xs:element>
  <xs:element name="child">
    <xs:complexType>
      <xs:attribute name="name" type="xs:string"/>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

describe("doHover — XSD-enriched hover", () => {
  const xmlDoc = `<root id="x">\n  <child name="test"/>\n</root>`;
  const doc = parseXMLDocument("file:///test.xml", xmlDoc);
  const provider = new XsdCompletionProvider(xsd);

  it("hovering root with schema provider returns non-null result", () => {
    const result = doHover(doc, { line: 0, character: 1 }, provider);
    expect(result).not.toBeNull();
  });

  it("XSD hover for root contains element name in markdown", () => {
    const result = doHover(doc, { line: 0, character: 1 }, provider);
    expect(result?.contents).toContain("root");
  });

  it("XSD hover for root includes 'Attributes' section", () => {
    const result = doHover(doc, { line: 0, character: 1 }, provider);
    expect(result?.contents).toContain("Attributes");
  });

  it("XSD hover for root lists the 'id' attribute", () => {
    const result = doHover(doc, { line: 0, character: 1 }, provider);
    expect(result?.contents).toContain("id");
  });

  it("XSD hover for root includes 'Children' section", () => {
    const result = doHover(doc, { line: 0, character: 1 }, provider);
    expect(result?.contents).toContain("Children");
  });

  it("XSD hover for child returns non-null result", () => {
    const result = doHover(doc, { line: 1, character: 3 }, provider);
    expect(result).not.toBeNull();
  });

  it("XSD hover for child includes 'name' attribute", () => {
    const result = doHover(doc, { line: 1, character: 3 }, provider);
    expect(result?.contents).toContain("name");
  });

  it("XSD hover result has a valid range shape", () => {
    const result = doHover(doc, { line: 0, character: 1 }, provider);
    expect(result?.range.start).toBeDefined();
    expect(result?.range.end).toBeDefined();
    expect(typeof result?.range.start.line).toBe("number");
    expect(typeof result?.range.start.character).toBe("number");
  });
});

// ─── Comment hover ────────────────────────────────────────────────────────────

describe("doHover — comment node", () => {
  it.each([
    "<!-- build config -->",
    "<!-- build config -->\n<root/>",
    "<root/>\n<!-- build config -->",
    "<root><!-- build config --></root>",
    "<root><child/><!-- build config --></root>",
    "<root><!-- build config --><child/></root>",
    "<root><child><!-- build config --></child></root>",
    "<root>\n<!-- build\nconfig -->\n</root>",
  ])("returns comment information and its exact range in %s", (text) => {
    const doc = parseXMLDocument("file:///test.xml", text);
    const start = text.indexOf("<!--");
    const end = text.indexOf("-->", start) + 3;
    const body = text.slice(start + 4, end - 3);

    for (const offset of [start, start + 4, end - 1]) {
      expect(doHover(doc, offsetToPosition(text, offset))).toEqual({
        contents: `### Comment\n${body}`,
        range: { start: offsetToPosition(text, start), end: offsetToPosition(text, end) },
      });
    }
  });

  it("does not return surrounding schema documentation inside a comment", () => {
    const text = "<root><!-- build config --></root>";
    const doc = parseXMLDocument("file:///test.xml", text);
    const provider = new XsdCompletionProvider(xsd);

    expect(doHover(doc, offsetToPosition(text, text.indexOf("build")), provider)?.contents)
      .toBe("### Comment\n build config ");
  });

  it("keeps hovering the adjacent element after a comment's exclusive end", () => {
    const text = "<root><!-- build config --><child/></root>";
    const doc = parseXMLDocument("file:///test.xml", text);

    expect(doHover(doc, offsetToPosition(text, text.indexOf("<child")))?.contents)
      .toContain("### `<child>`");
    expect(doHover(doc, offsetToPosition(text, text.indexOf("</root>") + 2))?.contents)
      .toContain("### `<root>`");
  });

  it("does not treat comment-like text inside CDATA or a processing instruction as a comment", () => {
    const text = "<root><![CDATA[<!-- data -->]]><?task <!-- instruction -->?></root>";
    const doc = parseXMLDocument("file:///test.xml", text);

    for (const word of ["data", "instruction"]) {
      expect(doHover(doc, offsetToPosition(text, text.indexOf(word)))?.contents)
        .not.toContain("### Comment");
    }
  });

  it("keeps the structural child-element count unchanged", () => {
    const doc = parseXMLDocument("file:///test.xml", "<root><!-- note --><child/></root>");
    expect(doHover(doc, { line: 0, character: 1 })?.contents).toContain("**Children:** 1");
  });
});

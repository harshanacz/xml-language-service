import { describe, it, expect } from "vitest";
import { parseXMLDocument } from "../../src/parser/xmlParser.js";

const errorsOf = (xml: string) => parseXMLDocument("file:///t.xml", xml).syntaxErrors;

describe("mismatched end tags", () => {
  it("reports an end tag that does not match its start tag", () => {
    const errors = errorsOf("<root><a></b></root>");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("expected end of tag 'a' but found 'b'");
    expect(errors[0]).toMatchObject({ line: 0, character: 11, endLine: 0, endCharacter: 12 });
  });

  it("reports the mismatch on the correct line", () => {
    const errors = errorsOf("<root>\n  <a>\n  </b>\n</root>");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ line: 2, character: 4 });
  });

  it("is case sensitive", () => {
    expect(errorsOf("<a></A>")).toHaveLength(1);
  });

  it("reports a mismatch on the root element", () => {
    expect(errorsOf("<root></roots>")[0].message).toContain("'root' but found 'roots'");
  });

  it("accepts correctly nested and self-closing elements", () => {
    expect(errorsOf('<root><a x="1"><b/></a><c></c></root>')).toEqual([]);
  });

  it("accepts namespaced names", () => {
    expect(errorsOf('<p:root xmlns:p="u"><p:a/></p:root>')).toEqual([]);
  });
});

describe("entity references", () => {
  it("reports an undefined entity in text content", () => {
    const errors = errorsOf("<root>&foo;</root>");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("entity 'foo' not found");
    expect(errors[0]).toMatchObject({ line: 0, character: 6, endCharacter: 11 });
  });

  it("reports an undefined entity in an attribute value", () => {
    const errors = errorsOf('<root a="x&bar;y"/>');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("entity 'bar' not found");
    expect(errors[0]).toMatchObject({ character: 10, endCharacter: 15 });
  });

  it("accepts predefined entities and character references", () => {
    expect(errorsOf('<root a="&lt;&amp;">&gt;&quot;&apos;&#65;&#x41;</root>')).toEqual([]);
  });

  it("accepts entities declared in the DOCTYPE", () => {
    const xml = '<!DOCTYPE root [<!ENTITY foo "x">]>\n<root>&foo;</root>';
    expect(errorsOf(xml).filter((e) => e.message.includes("entity"))).toEqual([]);
  });
});

describe("well-formedness edge cases", () => {
  it("does not flag entity-like text inside CDATA", () => {
    expect(errorsOf("<root><![CDATA[&foo; </wrong>]]></root>")).toEqual([]);
  });

  it("does not flag entity-like text inside comments", () => {
    expect(errorsOf("<root><!-- &foo; </wrong> --></root>")).toEqual([]);
  });

  it("reports every mismatch in a document", () => {
    const errors = errorsOf("<root><a></x><b></y></root>");
    expect(errors.filter((e) => e.message.startsWith("expected end of tag"))).toHaveLength(2);
  });

  it("reports mismatches in deeply nested elements", () => {
    const errors = errorsOf("<a><b><c><d></e></c></b></a>");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("expected end of tag 'd' but found 'e'");
  });

  it("reports entities on the right line in multi-line documents", () => {
    const errors = errorsOf("<root>\n  <a>ok</a>\n  <b>&nope;</b>\n</root>");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ line: 2, character: 5 });
  });

  it("treats entity declarations with single quotes and parameter entities correctly", () => {
    const xml = "<!DOCTYPE root [<!ENTITY a 'x'><!ENTITY % p 'y'>]>\n<root>&a;&p;</root>";
    const entityErrors = errorsOf(xml).filter((e) => e.message.startsWith("entity"));
    expect(entityErrors.map((e) => e.message)).toEqual(["entity 'p' not found"]);
  });

  it("accepts mixed content with correct nesting", () => {
    expect(errorsOf("<p>text <b>bold <i>it</i></b> more</p>")).toEqual([]);
  });

  it("does not report anything for an empty element pair", () => {
    expect(errorsOf("<root></root>")).toEqual([]);
  });

  it("accepts attributes whose values contain angle-bracket-like text", () => {
    expect(errorsOf(`<root a="1 &lt; 2" b='x'/>`)).toEqual([]);
  });
});

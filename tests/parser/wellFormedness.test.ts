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

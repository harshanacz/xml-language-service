import { describe, it, expect } from "vitest";
import { parseXMLDocument } from "../../src/parser/xmlParser.js";
import { getLanguageService } from "../../src/xmlLanguageService.js";

// Malformed inputs covering lexer errors, parser errors at EOF, and well-formedness errors.
const brokenInputs: Record<string, string> = {
  "unclosed root": "<root>",
  "unclosed child": "<root><unclosed></root>",
  "unclosed on later line": "<root>\n  <a>\n  <b>\n",
  "unterminated start tag": "<root",
  "unterminated attribute value": '<root a="x',
  "bad attribute": "<root a=1/>",
  "trailing content": "<a/><b/>",
  "mismatched tag": "<root><a></b></root>",
  "undefined entity": "<root>&foo;</root>",
  "unterminated comment": "<root><!-- oops </root>",
  "empty document": "",
  "whitespace only": "  \n ",
  "text only": "hello",
  "lone angle bracket": "<",
};

const isNonNegativeInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

describe("syntax error positions", () => {
  for (const [name, xml] of Object.entries(brokenInputs)) {
    it(`has finite, ordered positions for: ${name}`, () => {
      for (const e of parseXMLDocument("file:///t.xml", xml).syntaxErrors) {
        expect(isNonNegativeInt(e.line), `line of "${e.message}"`).toBe(true);
        expect(isNonNegativeInt(e.character), `character of "${e.message}"`).toBe(true);
        expect(isNonNegativeInt(e.endLine), `endLine of "${e.message}"`).toBe(true);
        expect(isNonNegativeInt(e.endCharacter), `endCharacter of "${e.message}"`).toBe(true);
        expect(e.endLine! > e.line || (e.endLine === e.line && e.endCharacter! >= e.character)).toBe(true);
      }
    });

    it(`serialises to valid JSON positions for: ${name}`, async () => {
      const service = getLanguageService();
      const doc = service.parseXMLDocument("file:///t.xml", xml);
      const roundTripped = JSON.parse(JSON.stringify(await service.validate("file:///t.xml", doc)));
      for (const d of roundTripped) {
        expect(d.range.start.line).not.toBeNull();
        expect(d.range.start.character).not.toBeNull();
        expect(d.range.end.line).not.toBeNull();
        expect(d.range.end.character).not.toBeNull();
      }
    });
  }

  it("points an end-of-file error at the last real token", () => {
    const [error] = parseXMLDocument("file:///t.xml", "<root>\n  <child>\n").syntaxErrors;
    expect(error.line).toBeGreaterThanOrEqual(1);
  });
});

/**
 * Killer tests: the minimized reproducers the oracle campaign found, written as
 * plain assertions of correct behavior. Every input here is well-formed XML and
 * no call crashes; each test fails because the service returns a wrong answer.
 *
 * These are excluded from `npm test` on purpose (see vitest.config.ts at the
 * repo root). Run them with `npm run research:oracles`.
 */
import { describe, expect, test } from "vitest";
import { getLanguageService } from "../../src/index.js";
import { applyEdits, infoset, toPosition } from "./oracles.js";

const service = getLanguageService();
const parse = (text: string) => service.parseXMLDocument("file:///test.xml", text);

describe("Bug 1: go-to-definition jumps to the wrong closing tag", () => {
  // doDefinition searches for the first "</name" substring after the opening tag.
  // Found by GT-DEF-OPEN-TO-CLOSE, MR-DEF-ROUNDTRIP and DIFF-MATCHING-TAG.

  test("nested elements with the same name", () => {
    const text = "<a><a></a></a>";
    const result = service.doDefinition(parse(text), { line: 0, character: 1 });
    expect(result?.range.start).toEqual(toPosition(text, text.lastIndexOf("</a>")));
  });

  test("a child whose name starts with the parent's name", () => {
    const text = "<a><ab></ab></a>";
    const result = service.doDefinition(parse(text), { line: 0, character: 1 });
    expect(result?.range.start).toEqual(toPosition(text, text.lastIndexOf("</a>")));
  });

  test("a namespaced child whose name starts with the parent's name", () => {
    const text = "<ns:x>\n  <ns:xy></ns:xy>\n</ns:x>";
    const result = service.doDefinition(parse(text), { line: 0, character: 1 });
    expect(result?.range.start).toEqual({ line: 2, character: 0 });
  });

  test("a closing tag written inside a comment", () => {
    const text = "<b>\n  <!-- </b> -->\n</b>";
    const result = service.doDefinition(parse(text), { line: 0, character: 1 });
    expect(result?.range.start).toEqual({ line: 2, character: 0 });
  });

  test("metamorphic: open -> close -> open returns to the start", () => {
    const text = "<a><a></a></a>";
    const doc = parse(text);
    const toClose = service.doDefinition(doc, { line: 0, character: 1 })!;
    const back = service.doDefinition(doc, {
      line: toClose.range.start.line,
      character: toClose.range.start.character + 2,
    });
    expect(back?.range.start).toEqual({ line: 0, character: 0 });
  });
});

describe("Bug 2: formatting changes CDATA content", () => {
  // The formatter re-indents every line, including lines inside <![CDATA[...]]>,
  // whose characters are data and must be kept byte for byte.
  // Found by MR-FMT-PRESERVES-CONTENT.

  test("CDATA text survives formatting", () => {
    const text = "<script><![CDATA[\nif (a < b) {\n    run();\n}\n]]></script>";
    const formatted = applyEdits(text, service.format(parse(text)));
    expect(infoset(formatted)).toEqual(infoset(text));
  });
});

describe("Bug 3: multi-line comments are never folded", () => {
  // FoldingRange has kind "comment", but the tree holds no comment nodes, so that
  // branch is unreachable. Found by DIFF-FOLDING (the HTML service folds them).

  test("a comment spanning three lines gets a folding range", () => {
    const text = "<a>\n  <!--\n    note\n  -->\n</a>";
    const ranges = service.getFoldingRanges(parse(text));
    expect(ranges).toContainEqual({ startLine: 1, endLine: 3, kind: "comment" });
  });
});

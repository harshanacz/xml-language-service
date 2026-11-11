import { describe, it, expect } from "vitest";
import { getLanguageService, SchemaProvider } from "../src/index.js";
import { parseXMLDocument } from "../src/parser/xmlParser.js";

const ls = getLanguageService();

describe("regressions", () => {
  it("marks unclosed elements as not self-closing", () => {
    const doc = parseXMLDocument("u", "<a><b>");
    expect(doc.children[0].isSelfClosing).toBe(false);
    expect(doc.children[0].children[0].isSelfClosing).toBe(false);
    expect(parseXMLDocument("u", "<a/>").children[0].isSelfClosing).toBe(true);
  });

  it("definition jumps to the matching close tag of nested same-name elements", () => {
    const doc = parseXMLDocument("u", "<a><a>x</a></a>");
    const result = ls.doDefinition(doc, { line: 0, character: 1 });
    expect(result?.range.start).toEqual({ line: 0, character: 11 });
    expect(result?.range.end).toEqual({ line: 0, character: 15 });
  });

  it("definition does not confuse a close tag with a longer name", () => {
    const doc = parseXMLDocument("u", "<a><ab></ab>");
    expect(ls.doDefinition(doc, { line: 0, character: 1 })).toBeNull();
  });

  it("rename does not touch a child close tag that shares a prefix", () => {
    const doc = parseXMLDocument("u", "<a><ab></ab>");
    const edits = ls.doRename(doc, { line: 0, character: 1 }, "z");
    expect(edits).toEqual([{ startOffset: 1, endOffset: 2, newText: "z" }]);
  });

  it("formatter keeps the trailing newline and CRLF line endings", () => {
    expect(ls.format(parseXMLDocument("u", "<a></a>\n"))[0].newText).toBe("<a></a>\n");
    expect(ls.format(parseXMLDocument("u", "<a>\r\n<b/>\r\n</a>\r\n"))[0].newText).toBe("<a>\r\n  <b/>\r\n</a>\r\n");
  });

  it("uses the root xmlns to find a schema when the file name does not match", () => {
    const doc = parseXMLDocument("u", '<project xmlns="http://maven.apache.org/POM/4.0.0"><</project>');
    const items = ls.doComplete(doc, { line: 0, character: 53 }, "custom.xml").items.map((i) => i.label);
    expect(items).toContain("modelVersion");
  });

  it("completes element names containing hyphens", () => {
    const doc = parseXMLDocument("u", "<a><call-te");
    const items = ls.doComplete(doc, { line: 0, character: 11 }).items.map((i) => i.label);
    expect(items).toContain("call-te");
  });

  it("offers attribute completion for tags containing hyphens", () => {
    const doc = parseXMLDocument("u", "<call-template ");
    const items = ls.doComplete(doc, { line: 0, character: 15 }).items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.kind === "attribute")).toBe(true);
  });

  it("folds multi-line comments", () => {
    const doc = parseXMLDocument("u", "<a>\n<!-- x\n y -->\n</a>");
    expect(ls.getFoldingRanges(doc)).toContainEqual({ startLine: 1, endLine: 2, kind: "comment" });
  });

  it("caches the completion provider for associated schemas", () => {
    const provider = new SchemaProvider();
    const first = provider.resolveSchemaForDocument("pom.xml");
    expect(first).not.toBeNull();
    expect(provider.resolveSchemaForDocument("pom.xml")).toBe(first);
  });

  it("invalidateAutoSchemas drops cached completion providers", async () => {
    const provider = new SchemaProvider();
    const first = provider.resolveSchemaForDocument("pom.xml");
    await provider.invalidateAutoSchemas();
    expect(provider.resolveSchemaForDocument("pom.xml")).not.toBe(first);
  });

  it("invalidateAutoSchemas releases completion providers keyed by xsdPath", async () => {
    const provider = new SchemaProvider();
    const xsdText = '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="old"/></xs:schema>';
    await provider.registerSchema({ uri: "auto:///p/x.xml", xsdPath: "/p/x.xsd", xsdText });
    await provider.invalidateAutoSchemas();
    expect(provider.hasSchema("auto:///p/x.xml")).toBe(false);
    const newXsd = xsdText.replace("old", "new");
    await provider.registerSchema({ uri: "auto:///p/x.xml", xsdPath: "/p/x.xsd", xsdText: newXsd });
    expect(provider.resolveSchemaForDocument("x.xml", undefined, "/p/x.xml")?.getAllElements()).toEqual(["new"]);
  });
});

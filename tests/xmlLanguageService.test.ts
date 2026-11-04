import { afterEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getLanguageService } from "../src/xmlLanguageService.js";

const XSD = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="root"><xs:complexType><xs:sequence>
    <xs:element name="child" type="xs:integer" minOccurs="0"/>
  </xs:sequence></xs:complexType></xs:element>
</xs:schema>`;

const services: ReturnType<typeof getLanguageService>[] = [];
const tempDirs: string[] = [];

function create() {
  const service = getLanguageService();
  services.push(service);
  return service;
}

function tempXsd(text = XSD): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xml-ls-api-"));
  tempDirs.push(dir);
  const file = path.join(dir, "s.xsd");
  fs.writeFileSync(file, text);
  return file;
}

afterEach(async () => {
  await Promise.all(services.splice(0).map((s) => s.dispose()));
  for (const d of tempDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe("validate without a registered schema", () => {
  it("returns an empty list for well-formed XML", async () => {
    const s = create();
    expect(await s.validate("file:///a.xml", s.parseXMLDocument("file:///a.xml", "<root/>"))).toEqual([]);
  });

  it("returns syntax diagnostics with source 'syntax' and a valid range", async () => {
    const s = create();
    const result = await s.validate("file:///a.xml", s.parseXMLDocument("file:///a.xml", "<root><a></b></root>"));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ source: "syntax", severity: "error" });
    expect(result[0].range.start).toEqual({ line: 0, character: 11 });
  });
});

describe("schema registration", () => {
  it("validates against a registered schema and reports xsd errors", async () => {
    const s = create();
    await s.registerSchema({ uri: "auto://a", xsdText: XSD });
    expect(s.hasSchema("auto://a")).toBe(true);
    const ok = await s.validate("auto://a", s.parseXMLDocument("file:///a.xml", "<root><child>1</child></root>"));
    const bad = await s.validate("auto://a", s.parseXMLDocument("file:///a.xml", "<root><child>x</child></root>"));
    expect(ok).toEqual([]);
    expect(bad.some((d) => d.source === "xsd")).toBe(true);
  });

  it("still reports mismatched tags when a schema is registered", async () => {
    const s = create();
    await s.registerSchema({ uri: "auto://a", xsdText: XSD });
    const result = await s.validate("auto://a", s.parseXMLDocument("file:///a.xml", "<root><child></oops></root>"));
    expect(result.some((d) => d.source === "syntax")).toBe(true);
  });

  it("reports hasSchema false for unknown URIs", () => {
    expect(create().hasSchema("auto://nothing")).toBe(false);
  });

  it("invalidateAutoSchemas drops auto:// schemas but keeps others", async () => {
    const s = create();
    await s.registerSchema({ uri: "auto://a", xsdText: XSD });
    await s.registerSchema({ uri: "file:///manual.xml", xsdText: XSD });
    await s.invalidateAutoSchemas();
    expect(s.hasSchema("auto://a")).toBe(false);
    expect(s.hasSchema("file:///manual.xml")).toBe(true);
  });

  it("can re-register an auto schema after invalidation", async () => {
    const s = create();
    await s.registerSchema({ uri: "auto://a", xsdText: XSD });
    await s.invalidateAutoSchemas();
    await s.registerSchema({ uri: "auto://a", xsdText: XSD });
    const result = await s.validate("auto://a", s.parseXMLDocument("file:///a.xml", "<root><child>x</child></root>"));
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("schema resolution", () => {
  it("resolves built-in schemas by file name", () => {
    expect(create().resolveSchemaForDocument("pom.xml")?.source).toBe("builtin");
  });

  it("returns null for unknown files", () => {
    expect(create().resolveSchemaForDocument("unknown-thing.xml")).toBeNull();
  });

  it("prefers a user association over the built-in catalog", () => {
    const s = create();
    const xsdPath = tempXsd();
    s.addUserAssociation({ pattern: "web.xml", xsdPath, isBuiltIn: false });
    const resolved = s.resolveSchemaForDocument("web.xml");
    expect(resolved?.source).toBe("custom");
    expect(resolved?.xsdPath).toBe(xsdPath);
  });

  it("clearUserAssociations restores built-in resolution", () => {
    const s = create();
    s.addUserAssociation({ pattern: "web.xml", xsdPath: tempXsd(), isBuiltIn: false });
    s.clearUserAssociations();
    expect(s.resolveSchemaForDocument("web.xml")?.source).toBe("builtin");
  });

  it("always uses the built-in Maven schema for pom.xml, even with a user association", () => {
    const s = create();
    s.addUserAssociation({ pattern: "**/*.xml", xsdPath: tempXsd(), isBuiltIn: false });
    expect(s.resolveSchemaForDocument("pom.xml")?.source).toBe("builtin");
  });

  it("matches user glob patterns against the full document path", () => {
    const s = create();
    s.addUserAssociation({ pattern: "**/configs/*.xml", xsdPath: tempXsd(), isBuiltIn: false });
    expect(s.resolveSchemaForDocument("a.xml", undefined, "/proj/configs/a.xml")?.source).toBe("custom");
    expect(s.resolveSchemaForDocument("a.xml", undefined, "/proj/other/a.xml")).toBeNull();
  });

  it("ignores user associations whose schema file is missing", () => {
    const s = create();
    s.addUserAssociation({ pattern: "x.xml", xsdPath: "/definitely/not/here.xsd", isBuiltIn: false });
    expect(s.resolveSchemaForDocument("x.xml")).toBeNull();
  });

  it("async resolution returns local matches without a systemId", async () => {
    expect((await create().resolveSchemaForDocumentAsync("pom.xml"))?.source).toBe("builtin");
  });
});

describe("editor features through the public API", () => {
  const xml = '<root>\n  <child id="1">text</child>\n</root>';

  it("provides symbols, folding and formatting for the same document", () => {
    const s = create();
    const doc = s.parseXMLDocument("file:///a.xml", xml);
    expect(s.findDocumentSymbols(doc)[0].name).toBe("root");
    expect(s.getFoldingRanges(doc)).toHaveLength(1);
    expect(s.format(doc, { tabSize: 4, insertSpaces: true }).length).toBeGreaterThan(0);
  });

  it("renames both the start and end tag", () => {
    const s = create();
    const edits = s.doRename(s.parseXMLDocument("file:///a.xml", xml), { line: 1, character: 4 }, "item");
    expect(edits).toHaveLength(2);
    expect(edits!.every((e) => e.newText === "item")).toBe(true);
  });

  it("returns null for rename and hover outside any element", () => {
    const s = create();
    const doc = s.parseXMLDocument("file:///a.xml", "<root/>\n\n");
    expect(s.doRename(doc, { line: 2, character: 0 }, "x")).toBeNull();
  });

  it("does not throw on empty or garbage documents", () => {
    const s = create();
    for (const text of ["", "<", "<<<>>>", "&&&", "\u0000"]) {
      const doc = s.parseXMLDocument("file:///a.xml", text);
      expect(() => {
        s.doComplete(doc, { line: 0, character: 0 });
        s.doHover(doc, { line: 0, character: 0 });
        s.findDocumentSymbols(doc);
        s.getFoldingRanges(doc);
        s.format(doc);
        s.findReferences(doc, { line: 0, character: 0 });
        s.doDefinition(doc, { line: 0, character: 0 });
      }).not.toThrow();
    }
  });
});

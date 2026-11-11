import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemorySchemaHost } from "../../src/schema/memorySchemaHost.js";
import { SchemaAssociator } from "../../src/schema/schemaAssociator.js";
import { getLanguageService } from "../../src/index.js";

const xsdFor = (element: string) =>
  `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="${element}" type="xs:string"/></xs:schema>`;

const CATALOG = JSON.stringify({
  version: "1",
  schemas: [
    { id: "note", domain: "test", pattern: "note.xml", namespaces: ["urn:note"], path: "misc/note.xsd" },
    { id: "maven", domain: "build", pattern: "pom.xml", path: "build/maven-4.0.0.xsd" },
  ],
});

function bundledFiles(): Record<string, string> {
  return {
    "/schemas/catalog.json": CATALOG,
    "/schemas/misc/note.xsd": xsdFor("note"),
    "/schemas/build/maven-4.0.0.xsd": xsdFor("project"),
  };
}

describe("createMemorySchemaHost", () => {
  it("defaults to /schemas and /cache and starts empty", () => {
    const host = createMemorySchemaHost();
    expect(host.schemasRoot).toBe("/schemas");
    expect(host.cacheDir).toBe("/cache");
    expect(host.exists("/schemas/catalog.json")).toBe(false);
  });

  it("uses the schemasRoot, cacheDir and files it is given", () => {
    const host = createMemorySchemaHost({ schemasRoot: "/s", cacheDir: "/c", files: { "/s/a.xsd": "A" } });
    expect(host.schemasRoot).toBe("/s");
    expect(host.cacheDir).toBe("/c");
    expect(host.readFile("/s/a.xsd")).toBe("A");
  });

  it("does not share state with the files object or with other hosts", () => {
    const files = { "/a.xsd": "A" };
    const one = createMemorySchemaHost({ files });
    const two = createMemorySchemaHost({ files });
    one.writeFile("/b.xsd", "B");
    expect(files).toEqual({ "/a.xsd": "A" });
    expect(two.exists("/b.xsd")).toBe(false);
  });

  it("writes, overwrites, reads and deletes files", () => {
    const host = createMemorySchemaHost();
    host.writeFile("/x/y/a.xsd", "one");
    host.writeFile("/x/y/a.xsd", "two");
    expect(host.exists("/x/y/a.xsd")).toBe(true);
    expect(host.readFile("/x/y/a.xsd")).toBe("two");
    expect(host.deleteFile("/x/y/a.xsd")).toBe(true);
    expect(host.deleteFile("/x/y/a.xsd")).toBe(false);
    expect(host.exists("/x/y/a.xsd")).toBe(false);
  });

  it("keeps an empty file apart from a missing one", () => {
    const host = createMemorySchemaHost({ files: { "/empty.xsd": "" } });
    expect(host.exists("/empty.xsd")).toBe(true);
    expect(host.readFile("/empty.xsd")).toBe("");
  });

  it("throws, naming the path, when reading a file that does not exist", () => {
    expect(() => createMemorySchemaHost().readFile("/missing.xsd")).toThrow("/missing.xsd");
  });

  it.each([
    [["/schemas", "catalog.json"], "/schemas/catalog.json"],
    [["/schemas/", "/build/", "maven.xsd"], "/schemas/build/maven.xsd"],
    [["/schemas", "build/maven-4.0.0.xsd"], "/schemas/build/maven-4.0.0.xsd"],
    [["schemas", "a.xsd"], "schemas/a.xsd"],
    [["/", "a.xsd"], "/a.xsd"],
    [["", "a", "", "b.xsd"], "a/b.xsd"],
    [["https://host/schemas/", "a.xsd"], "https://host/schemas/a.xsd"],
    [["vscode-vfs://github/owner/repo", "schemas", "a.xsd"], "vscode-vfs://github/owner/repo/schemas/a.xsd"],
    [["a.xsd"], "a.xsd"],
  ])("joins %j into %s", (segments, expected) => {
    expect(createMemorySchemaHost().join(...segments)).toBe(expected);
  });
});

describe("SchemaAssociator on a memory host", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("finds catalog schemas by file name and by namespace", () => {
    const assoc = new SchemaAssociator(createMemorySchemaHost({ files: bundledFiles() }));
    expect(assoc.findSchema("note.xml")).toEqual({ xsdText: xsdFor("note"), xsdPath: "/schemas/misc/note.xsd", source: "builtin" });
    expect(assoc.findSchema("other.xml", "urn:note")?.xsdPath).toBe("/schemas/misc/note.xsd");
    expect(assoc.findSchema("other.xml")).toBeNull();
  });

  it("has no built-in schemas when the host holds no catalog", () => {
    const assoc = new SchemaAssociator(createMemorySchemaHost());
    expect(assoc.findSchema("note.xml")).toBeNull();
    expect(assoc.findSchema("pom.xml")).toBeNull();
  });

  it("does not warn about the Maven schema when the host does not hold it", () => {
    const assoc = new SchemaAssociator(createMemorySchemaHost());
    expect(assoc.findSchema("pom.xml")).toBeNull();
    expect(assoc.findSchema("pom.xml", undefined, "/ws/module/pom.xml")).toBeNull();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("ignores a catalog that is not valid JSON", () => {
    const assoc = new SchemaAssociator(createMemorySchemaHost({ files: { "/schemas/catalog.json": "{not json" } }));
    expect(assoc.findSchema("note.xml")).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it("reads the XSD of a user association from the host", () => {
    const host = createMemorySchemaHost({ files: bundledFiles() });
    host.writeFile("/workspace/schemas/app.xsd", xsdFor("app"));
    const assoc = new SchemaAssociator(host);
    assoc.addUserAssociation({ pattern: "**/*.app.xml", xsdPath: "/workspace/schemas/app.xsd", isBuiltIn: false });
    expect(assoc.findSchema("main.app.xml", undefined, "/workspace/main.app.xml")).toEqual({
      xsdText: xsdFor("app"),
      xsdPath: "/workspace/schemas/app.xsd",
      source: "custom",
    });
  });

  it("picks up a file written after the association was added, and its later edits", () => {
    const host = createMemorySchemaHost();
    const assoc = new SchemaAssociator(host);
    assoc.addUserAssociation({ pattern: "app.xml", xsdPath: "/ws/app.xsd", isBuiltIn: false });
    expect(assoc.findSchema("app.xml")).toBeNull();

    host.writeFile("/ws/app.xsd", xsdFor("one"));
    expect(assoc.findSchema("app.xml")?.xsdText).toBe(xsdFor("one"));
    host.writeFile("/ws/app.xsd", xsdFor("two"));
    expect(assoc.findSchema("app.xml")?.xsdText).toBe(xsdFor("two"));
    host.deleteFile("/ws/app.xsd");
    expect(assoc.findSchema("app.xml")).toBeNull();
  });

  it("keeps the pom.xml rules: the bundled Maven schema unless an association names pom.xml", () => {
    const host = createMemorySchemaHost({ files: { ...bundledFiles(), "/ws/broad.xsd": xsdFor("broad"), "/ws/pom.xsd": xsdFor("mine") } });
    const assoc = new SchemaAssociator(host);
    assoc.addUserAssociation({ pattern: "**/*.xml", xsdPath: "/ws/broad.xsd", isBuiltIn: false });
    expect(assoc.findSchema("pom.xml")).toEqual({ xsdText: xsdFor("project"), xsdPath: "/schemas/build/maven-4.0.0.xsd", source: "builtin" });

    assoc.addUserAssociation({ pattern: "pom.xml", xsdPath: "/ws/pom.xsd", isBuiltIn: false });
    expect(assoc.findSchema("pom.xml")?.xsdPath).toBe("/ws/pom.xsd");
  });

  it("keeps a downloaded schema in memory and serves the next lookup from there", async () => {
    const url = "https://schemas.example.test/thing.xsd";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => xsdFor("thing") });
    vi.stubGlobal("fetch", fetchMock);
    const host = createMemorySchemaHost();
    const assoc = new SchemaAssociator(host);

    const downloaded = await assoc.findSchemaAsync("thing.xml", undefined, undefined, url);
    expect(downloaded?.source).toBe("network");
    expect(downloaded?.xsdPath.startsWith("/cache/")).toBe(true);
    expect(host.readFile(downloaded!.xsdPath)).toBe(xsdFor("thing"));

    const cached = await assoc.findSchemaAsync("thing.xml", undefined, undefined, url);
    expect(cached).toEqual({ xsdText: xsdFor("thing"), xsdPath: downloaded!.xsdPath, source: "cache" });
    expect(assoc.findSchema("thing.xml", undefined, undefined, url)?.source).toBe("cache");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when the download fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("blocked by CORS")));
    const assoc = new SchemaAssociator(createMemorySchemaHost());
    expect(await assoc.findSchemaAsync("thing.xml", undefined, undefined, "https://schemas.example.test/thing.xsd")).toBeNull();
  });
});

describe("getLanguageService on a memory host", () => {
  it("offers schema completions and hover from an in-memory catalog schema", () => {
    const xsd = `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="note">
    <xs:annotation><xs:documentation>A short note.</xs:documentation></xs:annotation>
    <xs:complexType><xs:sequence><xs:element name="body" type="xs:string"/></xs:sequence></xs:complexType>
  </xs:element>
</xs:schema>`;
    const host = createMemorySchemaHost({ files: { "/schemas/catalog.json": CATALOG, "/schemas/misc/note.xsd": xsd } });
    const service = getLanguageService({ schemaHost: host });

    const text = "<note>\n  <\n</note>";
    const doc = service.parseXMLDocument("memory:///note.xml", text);
    expect(service.doComplete(doc, { line: 1, character: 3 }, "note.xml").items.map((i) => i.label)).toContain("body");
    expect(service.doHover(doc, { line: 0, character: 2 }, "note.xml")?.contents).toContain("A short note.");
  });

  it("validates against an in-memory schema", async () => {
    const host = createMemorySchemaHost({ files: bundledFiles() });
    const service = getLanguageService({ schemaHost: host });
    const resolved = service.resolveSchemaForDocument("note.xml")!;
    await service.registerSchema({ uri: "auto:///note.xml", xsdText: resolved.xsdText, xsdPath: resolved.xsdPath });

    const bad = service.parseXMLDocument("memory:///note.xml", "<note><oops/></note>");
    const good = service.parseXMLDocument("memory:///note.xml", "<note>hello</note>");
    expect((await service.validate("auto:///note.xml", bad)).length).toBeGreaterThan(0);
    expect(await service.validate("auto:///note.xml", good)).toEqual([]);
    await service.dispose();
  });
});

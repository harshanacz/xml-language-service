import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createNodeSchemaHost, resolveSchemasRoot } from "../../src/schema/nodeSchemaHost.js";
import { getLanguageService } from "../../src/index.js";
import type { SchemaHost } from "../../src/schema/schemaHost.js";

describe("createNodeSchemaHost", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "xml-node-host-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("defaults to the bundled schemas and a cache under the working directory", () => {
    const host = createNodeSchemaHost();
    expect(host.schemasRoot).toBe(resolveSchemasRoot());
    expect(host.exists(host.join(host.schemasRoot, "catalog.json"))).toBe(true);
    expect(host.cacheDir).toBe(path.join(process.cwd(), ".cache", "xml-schemas"));
  });

  it("uses the schemasRoot and cacheDir it is given", () => {
    const host = createNodeSchemaHost({ schemasRoot: path.join(dir, "schemas"), cacheDir: path.join(dir, "cache") });
    expect(host.schemasRoot).toBe(path.join(dir, "schemas"));
    expect(host.cacheDir).toBe(path.join(dir, "cache"));
  });

  it("joins segments with the platform separator", () => {
    expect(createNodeSchemaHost().join("a", "b", "c.xsd")).toBe(path.join("a", "b", "c.xsd"));
  });

  it("writes a file, creating missing parent folders, and reads it back", () => {
    const host = createNodeSchemaHost();
    const file = path.join(dir, "deep", "er", "a.xsd");
    expect(host.exists(file)).toBe(false);
    host.writeFile(file, "<xs:schema/>");
    expect(host.exists(file)).toBe(true);
    expect(host.readFile(file)).toBe("<xs:schema/>");
    expect(fs.readFileSync(file, "utf-8")).toBe("<xs:schema/>");
  });

  it("throws when reading a file that does not exist", () => {
    expect(() => createNodeSchemaHost().readFile(path.join(dir, "missing.xsd"))).toThrow();
  });
});

describe("getLanguageService schemaHost option", () => {
  it("reads the catalog and schemas through the given host", () => {
    const xsd = '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="note"/></xs:schema>';
    const files: Record<string, string> = {
      "root/catalog.json": JSON.stringify({ version: "1", schemas: [{ id: "note", domain: "test", pattern: "note.xml", path: "note.xsd" }] }),
      "root/note.xsd": xsd,
    };
    const reads: string[] = [];
    const host: SchemaHost = {
      schemasRoot: "root",
      cacheDir: "cache",
      join: (...segments) => segments.join("/"),
      exists: (filePath) => filePath in files,
      readFile(filePath) {
        reads.push(filePath);
        if (!(filePath in files)) throw new Error(`no such file: ${filePath}`);
        return files[filePath];
      },
      writeFile(filePath, text) {
        files[filePath] = text;
      },
    };

    const service = getLanguageService({ schemaHost: host });
    expect(service.resolveSchemaForDocument("note.xml")).toEqual({ xsdText: xsd, xsdPath: "root/note.xsd", source: "builtin" });
    expect(service.resolveSchemaForDocument("other.xml")).toBeNull();
    expect(reads).toEqual(["root/catalog.json", "root/note.xsd"]);
  });

  it("still reads the bundled schemas from disk by default", () => {
    expect(getLanguageService().resolveSchemaForDocument("pom.xml")?.source).toBe("builtin");
  });
});

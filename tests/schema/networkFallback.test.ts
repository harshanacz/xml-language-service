import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SchemaAssociator } from "../../src/schema/schemaAssociator.js";

const URL_XSD = "http://schemas.example.test/thing/thing.xsd";
const XSD = `<?xml version="1.0"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="thing" type="xs:string"/></xs:schema>`;

function respond(body: string, ok = true) {
  return { ok, text: async () => body } as Response;
}

describe("SchemaAssociator remote fallback", () => {
  let cacheDir: string;
  let assoc: SchemaAssociator;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "xml-schema-cache-"));
    assoc = new SchemaAssociator();
    (assoc as any).runtimeCacheDir = cacheDir;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it("downloads a remote schema, caches it on disk and reports source 'network'", async () => {
    fetchMock.mockResolvedValue(respond(XSD));
    const result = await assoc.findSchemaAsync("thing.xml", undefined, undefined, URL_XSD);
    expect(result?.source).toBe("network");
    expect(result?.xsdText).toBe(XSD);
    expect(fetchMock).toHaveBeenCalledWith(URL_XSD);
    expect(fs.readFileSync(result!.xsdPath, "utf-8")).toBe(XSD);
    expect(result!.xsdPath.startsWith(cacheDir)).toBe(true);
  });

  it("serves the second lookup from the cache without fetching again", async () => {
    fetchMock.mockResolvedValue(respond(XSD));
    await assoc.findSchemaAsync("thing.xml", undefined, undefined, URL_XSD);
    const again = await assoc.findSchemaAsync("thing.xml", undefined, undefined, URL_XSD);
    expect(again?.source).toBe("cache");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null on an HTTP error and writes nothing", async () => {
    fetchMock.mockResolvedValue(respond("Not found", false));
    expect(await assoc.findSchemaAsync("thing.xml", undefined, undefined, URL_XSD)).toBeNull();
    expect(fs.readdirSync(cacheDir)).toEqual([]);
  });

  it("returns null when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await assoc.findSchemaAsync("thing.xml", undefined, undefined, URL_XSD)).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it("never fetches non-http systemIds", async () => {
    for (const id of ["file:///etc/passwd", "ftp://host/x.xsd", "books.xsd", "javascript:alert(1)"]) {
      expect(await assoc.findSchemaAsync("thing.xml", undefined, undefined, id)).toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never fetches when a local schema already matches", async () => {
    const result = await assoc.findSchemaAsync("pom.xml", undefined, undefined, URL_XSD);
    expect(result?.source).toBe("builtin");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fetch when no systemId is given", async () => {
    expect(await assoc.findSchemaAsync("thing.xml")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stores URLs with path separators and query strings as a single safe cache file", async () => {
    fetchMock.mockResolvedValue(respond(XSD));
    const result = await assoc.findSchemaAsync("t.xml", undefined, undefined, "https://x.test/a/../../b.xsd?x=1&y=../..");
    expect(path.dirname(result!.xsdPath)).toBe(cacheDir);
    expect(path.basename(result!.xsdPath)).toMatch(/^[A-Za-z0-9_]+\.xsd$/);
  });

  it("treats an unwritable cache as a non-fatal failure", async () => {
    fetchMock.mockResolvedValue(respond(XSD));
    const blocker = path.join(cacheDir, "blocker");
    fs.writeFileSync(blocker, "x");
    (assoc as any).runtimeCacheDir = path.join(blocker, "sub");
    expect(await assoc.findSchemaAsync("thing.xml", undefined, undefined, URL_XSD)).toBeNull();
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { build, type Plugin } from "esbuild";
import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";

const root = path.resolve(__dirname, "..");

// xerces-wasm loads its WebAssembly file itself, which is the embedding bundle's
// concern. Here it is replaced with a stand-in that reports one schema error for
// every document containing <oops/>, so the service code around it can run.
const stubXerces: Plugin = {
  name: "stub-xerces-wasm",
  setup(b) {
    b.onResolve({ filter: /^xerces-wasm$/ }, () => ({ path: "xerces-wasm", namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents: `export async function validate(xml, xsd, ns) {
        globalThis.__xercesCalls.push({ xsd, ns });
        const bad = xml.includes("<oops/>");
        return { valid: !bad, parseErrors: [], schemaErrors: bad ? [{ line: 1, column: 14, message: "no declaration for element 'oops'", severity: "error" }] : [] };
      }`,
    }));
  },
};

async function bundleForBrowser(entry: string, plugins: Plugin[] = [stubXerces]) {
  return build({
    entryPoints: [path.join(root, entry)],
    bundle: true,
    platform: "browser",
    format: "iife",
    globalName: "xmlLanguageService",
    write: false,
    logLevel: "silent",
    plugins,
  });
}

/** Runs the bundle in a fresh global scope that has no process, Buffer, require or module. */
function runInBrowserLikeScope(code: string, extraGlobals: Record<string, unknown> = {}): any {
  const sandbox: Record<string, unknown> = { console, __xercesCalls: [], ...extraGlobals };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox;
}

const NOTE_XSD = `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="urn:note">
  <xs:element name="note">
    <xs:annotation><xs:documentation>A short note.</xs:documentation></xs:annotation>
    <xs:complexType><xs:sequence><xs:element name="body" type="xs:string"/></xs:sequence></xs:complexType>
  </xs:element>
</xs:schema>`;
const CATALOG = JSON.stringify({ version: "1", schemas: [{ id: "note", domain: "test", pattern: "note.xml", path: "misc/note.xsd" }] });

describe("browser entry", () => {
  let code: string;
  let scope: any;
  let api: any;

  beforeAll(async () => {
    const result = await bundleForBrowser("src/browser.ts");
    code = result.outputFiles[0].text;
    scope = runInBrowserLikeScope(code);
    api = scope.xmlLanguageService;
  }, 60_000);

  it("bundles for the browser without any Node built-in", () => {
    expect(code.length).toBeGreaterThan(0);
    expect(code).not.toMatch(/\brequire\(["'](node:)?(fs|path|url|os|child_process)(\/promises)?["']\)/);
  });

  it("the Node entry does not bundle for the browser, so the check above means something", async () => {
    await expect(bundleForBrowser("src/index.ts")).rejects.toThrow(/Could not resolve "(fs|path|url)"/);
  });

  it("loads in a scope without process, Buffer or require", () => {
    expect(scope.process).toBeUndefined();
    expect(scope.Buffer).toBeUndefined();
    expect(scope.require).toBeUndefined();
    expect(typeof api.getLanguageService).toBe("function");
    expect(typeof api.createMemorySchemaHost).toBe("function");
    expect(api.createNodeSchemaHost).toBeUndefined();
  });

  it("exports the same names as the Node entry, apart from the Node host", async () => {
    const nodeEntry = await import("../src/index.js");
    // Type-only exports have no value at run time; compare the ones that do.
    const nodeNames = Object.entries(nodeEntry)
      .filter(([name, value]) => value !== undefined && name !== "createNodeSchemaHost")
      .map(([name]) => name)
      .sort();
    expect(Object.keys(api).sort()).toEqual(nodeNames);
  });

  it("runs the editor features", () => {
    const service = api.getLanguageService();
    const text = "<library>\n  <book id=\"1\"><title>T</title></book>\n  <\n</library>";
    const doc = service.parseXMLDocument("memory:///library.xml", text);

    expect(service.doHover(doc, { line: 1, character: 4 }).contents).toContain("`<book>`");
    expect(JSON.parse(JSON.stringify(service.doComplete(doc, { line: 2, character: 3 }).items.map((i: any) => i.label)))).toContain("book");
    expect(service.findDocumentSymbols(doc)[0].name).toBe("library");
    expect(service.getFoldingRanges(doc).length).toBeGreaterThan(0);
    expect(service.doRename(doc, { line: 1, character: 4 }, "item").length).toBe(2);
    expect(service.findReferences(doc, { line: 1, character: 4 }).length).toBe(1);
    expect(service.doDefinition(doc, { line: 1, character: 4 })).not.toBeNull();
    expect(service.format(service.parseXMLDocument("memory:///a.xml", "<a><b/></a>"))[0].newText).toContain("\n");
  });

  it("reports syntax errors without a schema", async () => {
    const service = api.getLanguageService();
    const doc = service.parseXMLDocument("memory:///bad.xml", "<a><b></a>");
    const diagnostics = await service.validate("memory:///bad.xml", doc);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0].source).toBe("syntax");
  });

  it("has no built-in schemas until the host is given a catalog", () => {
    expect(api.getLanguageService().resolveSchemaForDocument("pom.xml")).toBeNull();
    expect(api.getLanguageService().resolveSchemaForDocument("note.xml")).toBeNull();
  });

  it("resolves catalog schemas and user associations from a memory host", () => {
    const host = api.createMemorySchemaHost({ files: { "/schemas/catalog.json": CATALOG, "/schemas/misc/note.xsd": NOTE_XSD } });
    host.writeFile("/workspace/app.xsd", NOTE_XSD.replace('name="note"', 'name="app"'));
    const service = api.getLanguageService({ schemaHost: host });
    service.addUserAssociation({ pattern: "**/*.app.xml", xsdPath: "/workspace/app.xsd", isBuiltIn: false });

    const builtin = service.resolveSchemaForDocument("note.xml");
    expect(builtin.source).toBe("builtin");
    expect(builtin.xsdPath).toBe("/schemas/misc/note.xsd");
    const custom = service.resolveSchemaForDocument("main.app.xml", undefined, "/workspace/main.app.xml");
    expect(custom.source).toBe("custom");
    expect(custom.xsdText).toContain('name="app"');
  });

  it("offers schema completions and hover from a memory host", () => {
    const host = api.createMemorySchemaHost({ files: { "/schemas/catalog.json": CATALOG, "/schemas/misc/note.xsd": NOTE_XSD } });
    const service = api.getLanguageService({ schemaHost: host });
    const doc = service.parseXMLDocument("memory:///note.xml", "<note>\n  <\n</note>");
    expect(JSON.parse(JSON.stringify(service.doComplete(doc, { line: 1, character: 3 }, "note.xml").items.map((i: any) => i.label)))).toEqual(["body"]);
    expect(service.doHover(doc, { line: 0, character: 2 }, "note.xml").contents).toContain("A short note.");
  });

  it("validates through the validator without a global Buffer", async () => {
    const service = api.getLanguageService();
    await service.registerSchema({ uri: "auto:///note.xml", xsdText: NOTE_XSD, xsdPath: "/schemas/misc/note.xsd" });
    await service.registerSchema({ uri: "auto:///bundle.xml", xsdText: NOTE_XSD, imports: { "types.xsd": "<xs:schema/>" } });

    const good = service.parseXMLDocument("memory:///note.xml", "<note><body>hi</body></note>");
    const bad = service.parseXMLDocument("memory:///note.xml", "<note><body/><oops/></note>");
    expect(JSON.parse(JSON.stringify(await service.validate("auto:///note.xml", good)))).toEqual([]);
    const diagnostics = JSON.parse(JSON.stringify(await service.validate("auto:///note.xml", bad)));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ source: "xsd", severity: "error", message: "no declaration for element 'oops'" });
    expect(await service.validate("auto:///bundle.xml", bad)).toHaveLength(1);

    const calls = scope.__xercesCalls;
    expect(calls.every((call: any) => call.ns === "urn:note")).toBe(true);
    expect(calls.at(-1).xsd.imports["types.xsd"]).toBe("<xs:schema/>");
  });

  it("downloads a remote schema with fetch and keeps it in the memory host", async () => {
    const fetched: string[] = [];
    const withFetch = runInBrowserLikeScope(code, {
      fetch: async (url: string) => {
        fetched.push(url);
        return { ok: true, text: async () => NOTE_XSD };
      },
    });
    const host = withFetch.xmlLanguageService.createMemorySchemaHost();
    const service = withFetch.xmlLanguageService.getLanguageService({ schemaHost: host });
    const url = "https://schemas.example.test/note.xsd";

    const first = await service.resolveSchemaForDocumentAsync("x.xml", undefined, undefined, url);
    expect(first.source).toBe("network");
    expect(host.readFile(first.xsdPath)).toBe(NOTE_XSD);
    expect((await service.resolveSchemaForDocumentAsync("x.xml", undefined, undefined, url)).source).toBe("cache");
    expect(fetched).toEqual([url]);
  });
});

describe("package.json exports", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));

  it("points browser bundlers at the browser entry and everything else at the Node entry", () => {
    expect(pkg.exports["."].browser).toBe("./dist/browser.js");
    expect(pkg.exports["."].import).toBe("./dist/index.js");
    expect(pkg.exports["./browser"].import).toBe("./dist/browser.js");
    // Conditions are matched in order: "browser" must come before the general "import".
    const conditions = Object.keys(pkg.exports["."]);
    expect(conditions.indexOf("browser")).toBeLessThan(conditions.indexOf("import"));
    expect(conditions[0]).toBe("types");
  });
});

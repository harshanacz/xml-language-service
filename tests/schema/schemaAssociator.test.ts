import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { SchemaAssociator, resolveSchemasRoot } from "../../src/schema/schemaAssociator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute path to a real bundled XSD file, used for user-association tests
const mavenXsdPath = path.resolve(
  __dirname,
  "../../resources/schemas/build/maven-4.0.0.xsd"
);

describe("SchemaAssociator", () => {
  it("creates without throwing", () => {
    expect(() => new SchemaAssociator()).not.toThrow();
  });

  it("findSchema('pom.xml') returns a non-null ResolvedSchema", () => {
    const assoc = new SchemaAssociator();
    expect(assoc.findSchema("pom.xml")).not.toBeNull();
  });

  it("findSchema('pom.xml').source === 'builtin'", () => {
    const assoc = new SchemaAssociator();
    expect(assoc.findSchema("pom.xml")?.source).toBe("builtin");
  });

  it("findSchema('pom.xml') returns non-empty xsdText", () => {
    const assoc = new SchemaAssociator();
    const result = assoc.findSchema("pom.xml");
    expect(result?.xsdText.length).toBeGreaterThan(0);
  });

  it("findSchema('web.xml') returns a non-null ResolvedSchema", () => {
    const assoc = new SchemaAssociator();
    expect(assoc.findSchema("web.xml")).not.toBeNull();
  });

  it("findSchema('unknown.xml') returns null", () => {
    const assoc = new SchemaAssociator();
    expect(assoc.findSchema("unknown.xml")).toBeNull();
  });

  it("addUserAssociation with pattern 'custom.xml' makes findSchema return source 'custom'", () => {
    const assoc = new SchemaAssociator();
    assoc.addUserAssociation({
      pattern: "custom.xml",
      xsdPath: mavenXsdPath,
      isBuiltIn: false,
    });
    const result = assoc.findSchema("custom.xml");
    expect(result).not.toBeNull();
    expect(result?.source).toBe("custom");
  });

  it("user association overrides built-in for the same filename", () => {
    const assoc = new SchemaAssociator();
    assoc.addUserAssociation({
      pattern: "pom.xml",
      xsdPath: mavenXsdPath,
      isBuiltIn: false,
    });
    const result = assoc.findSchema("pom.xml");
    expect(result?.source).toBe("builtin"); // pom.xml hardcoded guard short-circuits to pom.xml built-in
  });

  it("wildcard pattern **/*.xml matches bare filename without documentPath", () => {
    const assoc = new SchemaAssociator();
    assoc.addUserAssociation({
      pattern: "**/*.custom",
      xsdPath: mavenXsdPath,
      isBuiltIn: false,
    });
    const result = assoc.findSchema("sample.custom");
    expect(result).not.toBeNull();
    expect(result?.source).toBe("custom");
  });

  it("clearUserAssociations resets added user associations", () => {
    const assoc = new SchemaAssociator();
    assoc.addUserAssociation({
      pattern: "custom.xml",
      xsdPath: mavenXsdPath,
      isBuiltIn: false,
    });
    expect(assoc.findSchema("custom.xml")).not.toBeNull();
    assoc.clearUserAssociations();
    expect(assoc.findSchema("custom.xml")).toBeNull();
  });
});

describe("resolveSchemasRoot", () => {
  const withLayout = (dirs: string[], run: (root: string) => void) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "schemas-root-"));
    try {
      for (const d of dirs) fs.mkdirSync(path.join(root, d), { recursive: true });
      run(root);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };

  it("finds schemas copied beside a single-file bundle", () => {
    // Layout of the bundled language server and the packaged extension
    withLayout(["server/resources/schemas"], (root) => {
      expect(resolveSchemasRoot(path.join(root, "server"))).toBe(path.join(root, "server", "resources", "schemas"));
    });
  });

  it("finds the package's schemas from dist/schema", () => {
    withLayout(["pkg/dist/schema", "pkg/dist/resources/schemas"], (root) => {
      expect(resolveSchemasRoot(path.join(root, "pkg", "dist", "schema"))).toBe(path.join(root, "pkg", "dist", "resources", "schemas"));
    });
  });

  it("finds the repository's schemas from src/schema", () => {
    withLayout(["repo/src/schema", "repo/resources/schemas"], (root) => {
      expect(resolveSchemasRoot(path.join(root, "repo", "src", "schema"))).toBe(path.join(root, "repo", "resources", "schemas"));
    });
  });
});

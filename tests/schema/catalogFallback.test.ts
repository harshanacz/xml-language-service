import { describe, it, expect } from "vitest";
import { SchemaAssociator } from "../../src/schema/schemaAssociator.js";

describe("SchemaAssociator Catalog and Fallback Resolution", () => {
  const assoc = new SchemaAssociator();

  it("resolves maven pom.xml from catalog", () => {
    const result = assoc.findSchema("pom.xml");
    expect(result).not.toBeNull();
    expect(result?.source).toBe("builtin");
    expect(result?.xsdText).toContain("xs:schema");
  });

  it("resolves web.xml from catalog", () => {
    const result = assoc.findSchema("web.xml");
    expect(result).not.toBeNull();
    expect(result?.source).toBe("builtin");
  });

  it("resolves persistence.xml by pattern from catalog", () => {
    const result = assoc.findSchema("persistence.xml");
    expect(result).not.toBeNull();
    expect(result?.source).toBe("builtin");
  });

  it("resolves Spring XML by pattern from catalog", () => {
    const result = assoc.findSchema("spring-beans.xml");
    expect(result).not.toBeNull();
    expect(result?.source).toBe("builtin");
  });

  it("resolves by namespace from catalog", () => {
    const result = assoc.findSchema("custom-filename.xml", "http://maven.apache.org/POM/4.0.0");
    expect(result).not.toBeNull();
    expect(result?.source).toBe("builtin");
  });

  it("returns null for unknown file and namespace", () => {
    const result = assoc.findSchema("random.xml", "http://example.com/unknown");
    expect(result).toBeNull();
  });
});

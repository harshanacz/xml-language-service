import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export interface SchemaAssociation {
  pattern: string;     // glob-like: 'pom.xml' or '**/*.xml'
  namespace?: string;  // xmlns namespace URI
  systemId?: string;   // schemaLocation / systemId URL
  xsdPath: string;     // absolute path to XSD file
  isBuiltIn: boolean;  // true for bundled schemas
}

export interface CatalogSchemaEntry {
  id: string;
  domain: string;
  pattern?: string;
  namespaces?: string[];
  systemIds?: string[];
  path: string;
}

export interface CatalogConfig {
  version: string;
  schemas: CatalogSchemaEntry[];
}

export interface ResolvedSchema {
  xsdText: string;
  xsdPath: string;
  source: "builtin" | "custom" | "cache" | "network";
}

// Bundled schemas live in <package>/resources/schemas. This module sits at
// dist/schema/ after a build and at src/schema/ when run from source (tests).
// When it is bundled into a single file (the language server, the VS Code
// extension), `dir` is the bundle's folder and the schemas are copied beside it.
export function resolveSchemasRoot(dir = path.dirname(fileURLToPath(import.meta.url))): string {
  const candidates = [
    path.join(dir, "resources", "schemas"),
    path.join(dir, "..", "resources", "schemas"),
    path.join(dir, "..", "..", "resources", "schemas"),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

const SCHEMAS_ROOT = resolveSchemasRoot();

export class SchemaAssociator {
  private userAssociations: SchemaAssociation[];
  private catalog: CatalogConfig | null = null;
  private runtimeCacheDir: string;

  constructor() {
    this.userAssociations = [];
    this.runtimeCacheDir = path.join(process.cwd(), ".cache", "xml-schemas");
    this.loadCatalog();
  }

  private loadCatalog(): void {
    const catalogPath = path.join(SCHEMAS_ROOT, "catalog.json");
    if (fs.existsSync(catalogPath)) {
      try {
        const raw = fs.readFileSync(catalogPath, "utf-8");
        this.catalog = JSON.parse(raw);
      } catch (err) {
        console.warn(`Failed to parse catalog.json at "${catalogPath}": ${(err as Error).message}`);
      }
    }
  }

  /**
   * Registers a custom schema association.
   * Custom associations take priority over built-in catalog schemas when patterns overlap.
   */
  addUserAssociation(association: SchemaAssociation): void {
    this.userAssociations.push(association);
  }

  /** Clears all user-registered associations. */
  clearUserAssociations(): void {
    this.userAssociations = [];
  }

  /**
   * Finds and reads the XSD schema for the given file name, optional xmlns namespace, and optional systemId.
   * Priority:
   * 1. User associations (pattern match)
   * 2. Catalog associations (pattern / namespace / systemId match from resources/schemas/catalog.json)
   * 3. Runtime cache of downloaded schemas (<cwd>/.cache/xml-schemas/)
   */
  findSchema(fileName: string, xmlns?: string, documentPath?: string, systemId?: string): ResolvedSchema | null {
    // 0. pom.xml always uses the bundled Maven schema so that broad user
    //    associations (e.g. "**/*.xml") cannot shadow it.
    if (fileName === "pom.xml" || fileName.endsWith("/pom.xml") || fileName.endsWith("\\pom.xml")) {
      const mavenPomPath = path.join(SCHEMAS_ROOT, "build", "maven-4.0.0.xsd");
      const xsdText = this.readXsdFile(mavenPomPath);
      if (xsdText) return { xsdText, xsdPath: mavenPomPath, source: "builtin" };
    }

    // 1. User associations checked FIRST (pattern match)
    for (const assoc of this.userAssociations) {
      if (this.matchesPattern(fileName, assoc.pattern, documentPath)) {
        const xsdText = this.readXsdFile(assoc.xsdPath);
        if (xsdText === null) return null;
        return { xsdText, xsdPath: assoc.xsdPath, source: "custom" };
      }
    }

    // 2. Bundled Catalog checked SECOND (pattern / namespace / systemId)
    if (this.catalog) {
      for (const entry of this.catalog.schemas) {
        const matchesPattern = entry.pattern ? this.matchesPattern(fileName, entry.pattern, documentPath) : false;
        const matchesNs = xmlns !== undefined && entry.namespaces ? entry.namespaces.includes(xmlns) : false;
        const matchesSysId = systemId !== undefined && entry.systemIds ? entry.systemIds.includes(systemId) : false;

        if (matchesPattern || matchesNs || matchesSysId) {
          const fullPath = path.join(SCHEMAS_ROOT, entry.path);
          const xsdText = this.readXsdFile(fullPath);
          if (xsdText) return { xsdText, xsdPath: fullPath, source: "builtin" };
        }
      }
    }

    // 3. Runtime cache of previously downloaded schemas
    if (systemId && (systemId.startsWith("http://") || systemId.startsWith("https://"))) {
      const cachedPath = this.getCachePathForUrl(systemId);
      if (fs.existsSync(cachedPath)) {
        const xsdText = this.readXsdFile(cachedPath);
        if (xsdText) return { xsdText, xsdPath: cachedPath, source: "cache" };
      }
    }

    return null;
  }

  /**
   * Async fallback for remote schemas when not found locally.
   * Downloads remote XSD URL, saves it to local runtime cache, and returns ResolvedSchema.
   */
  async findSchemaAsync(fileName: string, xmlns?: string, documentPath?: string, systemId?: string): Promise<ResolvedSchema | null> {
    const local = this.findSchema(fileName, xmlns, documentPath, systemId);
    if (local) return local;

    if (systemId && (systemId.startsWith("http://") || systemId.startsWith("https://"))) {
      try {
        const response = await fetch(systemId);
        if (response.ok) {
          const xsdText = await response.text();
          const cachedPath = this.getCachePathForUrl(systemId);
          fs.mkdirSync(path.dirname(cachedPath), { recursive: true });
          fs.writeFileSync(cachedPath, xsdText, "utf-8");
          return { xsdText, xsdPath: cachedPath, source: "network" };
        }
      } catch (err) {
        console.warn(`Network fallback fetch failed for systemId "${systemId}": ${(err as Error).message}`);
      }
    }

    return null;
  }

  private getCachePathForUrl(url: string): string {
    const sanitized = url.replace(/[^a-zA-Z0-9]/g, "_");
    return path.join(this.runtimeCacheDir, `${sanitized}.xsd`);
  }

  private matchesPattern(fileName: string, pattern: string, documentPath?: string): boolean {
    if (fileName === pattern) return true;
    if (documentPath && this.globMatches(pattern, documentPath)) return true;
    if (this.globMatches(pattern, fileName)) return true;
    const stripped = pattern.replace(/^\*\*\//, "").replace(/^\*/, "");
    return !stripped.includes("/") && fileName.endsWith(stripped);
  }

  private globMatches(glob: string, filePath: string): boolean {
    let re = "";
    let i = 0;
    while (i < glob.length) {
      const ch = glob[i];
      if (ch === "*" && glob[i + 1] === "*") {
        re += ".*";
        i += 2;
        if (glob[i] === "/") i++;
      } else if (ch === "*") {
        re += "[^/]*";
        i++;
      } else if (ch === "?") {
        re += "[^/]";
        i++;
      } else {
        re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
        i++;
      }
    }
    return new RegExp(`(^|/)${re}$`).test(filePath);
  }

  private readXsdFile(xsdPath: string): string | null {
    try {
      return fs.readFileSync(xsdPath, "utf-8");
    } catch (err) {
      console.warn(`Schema file not found at "${xsdPath}": ${(err as Error).message}`);
      return null;
    }
  }
}

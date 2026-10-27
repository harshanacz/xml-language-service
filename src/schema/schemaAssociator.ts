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

function resolveSchemasRoot(): string {
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const distSchemas = path.join(dir, "resources", "schemas");
    if (fs.existsSync(distSchemas)) return distSchemas;
    const parentDistSchemas = path.join(dir, "..", "resources", "schemas");
    if (fs.existsSync(parentDistSchemas)) return parentDistSchemas;
    const rootSchemas = path.join(process.cwd(), "resources", "schemas");
    if (fs.existsSync(rootSchemas)) return rootSchemas;
    return path.join(dir, "resources", "default");
  } catch {
    return path.join(process.cwd(), "resources", "schemas");
  }
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
   * 3. Local Runtime Cache (~/.cache/xml-schemas/)
   */
  findSchema(fileName: string, xmlns?: string, documentPath?: string, systemId?: string): ResolvedSchema | null {
    // 0. Hardcoded guard for pom.xml to prevent custom wildcard associations from incorrectly matching Maven files
    if (fileName === "pom.xml" || fileName.endsWith("/pom.xml") || fileName.endsWith("\\pom.xml")) {
      const mavenPomPath = path.join(SCHEMAS_ROOT, "build", "maven-4.0.0.xsd");
      const fallbackMavenPath = path.join(SCHEMAS_ROOT, "maven-4.0.0.xsd");
      const targetPath = fs.existsSync(mavenPomPath) ? mavenPomPath : fallbackMavenPath;
      const xsdText = this.readXsdFile(targetPath);
      if (xsdText) return { xsdText, xsdPath: targetPath, source: "builtin" };
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

    // Fallback for web.xml if catalog wasn't present
    if (fileName === "web.xml" || fileName.endsWith("/web.xml") || fileName.endsWith("\\web.xml")) {
      const webXmlPath = path.join(SCHEMAS_ROOT, "javaee", "web-app_3_1.xsd");
      const fallbackWebPath = path.join(SCHEMAS_ROOT, "web-app_3_1.xsd");
      const targetPath = fs.existsSync(webXmlPath) ? webXmlPath : fallbackWebPath;
      const xsdText = this.readXsdFile(targetPath);
      if (xsdText) return { xsdText, xsdPath: targetPath, source: "builtin" };
    }

    // 3. Check Runtime Cache (~/.cache/xml-schemas/)
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

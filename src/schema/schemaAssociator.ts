import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export interface SchemaAssociation {
  pattern: string;     // glob-like: 'pom.xml' or '**/*.xml'
  namespace?: string;  // xmlns namespace URI
  xsdPath: string;     // absolute path to XSD file
  isBuiltIn: boolean;  // true for bundled schemas
}

export interface ResolvedSchema {
  xsdText: string;
  xsdPath: string;
  source: "builtin" | "custom";
}

function resolveSchemaRoot(): string {
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const bundled = path.join(dir, "resources", "schemas");
    if (fs.existsSync(bundled)) return bundled;
    const oldDefault = path.join(dir, "resources", "default");
    if (fs.existsSync(oldDefault)) return oldDefault;
    return path.join(dir, "..", "resources", "default");
  } catch {
    return path.join(process.cwd(), "src", "schema", "resources", "default");
  }
}

const SCHEMAS_ROOT = resolveSchemaRoot();

export class SchemaAssociator {
  private builtInAssociations: SchemaAssociation[];
  private userAssociations: SchemaAssociation[];

  constructor() {
    this.builtInAssociations = [
      {
        pattern: "**/pom.xml",
        namespace: "http://maven.apache.org/POM/4.0.0",
        xsdPath: path.join(SCHEMAS_ROOT, "maven-4.0.0.xsd"),
        isBuiltIn: true,
      },
      {
        pattern: "web.xml",
        namespace: "http://xmlns.jcp.org/xml/ns/javaee",
        xsdPath: path.join(SCHEMAS_ROOT, "web-app_3_1.xsd"),
        isBuiltIn: true,
      },
    ];
    this.userAssociations = [];
  }

  /**
   * Registers a custom schema association.
   * Custom associations take priority over built-in schemas when patterns overlap.
   */
  addUserAssociation(association: SchemaAssociation): void {
    this.userAssociations.push(association);
  }

  /** Clears all user-registered associations. */
  clearUserAssociations(): void {
    this.userAssociations = [];
  }

  /**
   * Finds and reads the XSD schema for the given file name and optional xmlns namespace.
   * Priority: user associations (pattern match) > built-in associations (namespace/pattern match).
   * Returns null if no matching schema is found.
   */
  findSchema(fileName: string, xmlns?: string, documentPath?: string): ResolvedSchema | null {
    // 0. Hardcoded guard for pom.xml to prevent custom wildcard associations from incorrectly matching Maven files
    if (fileName === "pom.xml" || fileName.endsWith("/pom.xml") || fileName.endsWith("\\pom.xml")) {
      const pomAssoc = this.builtInAssociations.find((a) => a.namespace === "http://maven.apache.org/POM/4.0.0");
      if (pomAssoc) {
        const xsdText = this.readXsdFile(pomAssoc.xsdPath);
        if (xsdText) return { xsdText, xsdPath: pomAssoc.xsdPath, source: "builtin" };
      }
    }

    // 1. user associations checked FIRST (pattern match)
    for (const assoc of this.userAssociations) {
      if (this.matchesPattern(fileName, assoc.pattern, documentPath)) {
        const xsdText = this.readXsdFile(assoc.xsdPath);
        if (xsdText === null) return null;
        return { xsdText, xsdPath: assoc.xsdPath, source: "custom" };
      }
    }

    // 2. built-ins checked by namespace or pattern
    for (const assoc of this.builtInAssociations) {
      if (
        this.matchesPattern(fileName, assoc.pattern, documentPath) ||
        (xmlns !== undefined && assoc.namespace === xmlns)
      ) {
        const xsdText = this.readXsdFile(assoc.xsdPath);
        if (xsdText === null) return null;
        return { xsdText, xsdPath: assoc.xsdPath, source: "builtin" };
      }
    }

    return null;
  }

  private matchesPattern(fileName: string, pattern: string, documentPath?: string): boolean {
    if (fileName === pattern) return true;
    if (documentPath && this.globMatches(pattern, documentPath)) return true;
    // Fallback for simple **/*.ext or *.ext patterns — match by filename suffix alone.
    const stripped = pattern.replace(/^\*\*\//, "").replace(/^\*/, "");
    return !stripped.includes("/") && fileName.endsWith(stripped);
  }

  // Converts a glob pattern to a RegExp and tests it against filePath.
  // Supports * (single-segment wildcard) and ** (multi-segment wildcard).
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

  /** Reads and returns the content of an XSD file, or null if not found. */
  private readXsdFile(xsdPath: string): string | null {
    try {
      return fs.readFileSync(xsdPath, "utf-8");
    } catch (err) {
      console.warn(`Schema file not found at "${xsdPath}": ${(err as Error).message}`);
      return null;
    }
  }
}

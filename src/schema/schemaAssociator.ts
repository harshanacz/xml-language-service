import fs from "fs";
import { fileURLToPath } from "url";

export interface SchemaAssociation {
  pattern: string;     // glob-like: 'pom.xml' or '**/*.xml'
  namespace?: string;  // xmlns namespace URI
  xsdPath: string;     // absolute path to XSD file
  isBuiltIn: boolean;  // true for bundled schemas
}

export interface ResolvedSchema {
  xsdText: string;
  source: "builtin" | "custom";
}

export class SchemaAssociator {
  private builtInAssociations: SchemaAssociation[];
  private userAssociations: SchemaAssociation[];

  constructor() {
    this.builtInAssociations = [
      {
        pattern: "pom.xml",
        namespace: "http://maven.apache.org/POM/4.0.0",
        xsdPath: fileURLToPath(new URL("../resources/default/maven-4.0.0.xsd", import.meta.url)),
        isBuiltIn: true,
      },
      {
        pattern: "web.xml",
        namespace: "http://xmlns.jcp.org/xml/ns/javaee",
        xsdPath: fileURLToPath(new URL("../resources/default/web-app_3_1.xsd", import.meta.url)),
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

  /**
   * Finds and reads the XSD schema for the given file name and optional xmlns namespace.
   * User associations are checked first and short-circuit built-in lookup on match.
   * Returns null if no matching schema is found.
   */
  findSchema(fileName: string, xmlns?: string, documentPath?: string): ResolvedSchema | null {
    for (const assoc of this.userAssociations) {
      if (this.matchesPattern(fileName, assoc.pattern)) {
        const xsdText = this.readXsdFile(assoc.xsdPath);
        if (xsdText === null) return null;
        return { xsdText, source: "custom" };
      }
    }

    for (const assoc of this.builtInAssociations) {
      if (
        this.matchesPattern(fileName, assoc.pattern) ||
        (xmlns !== undefined && assoc.namespace === xmlns)
      ) {
        const xsdText = this.readXsdFile(assoc.xsdPath);
        if (xsdText === null) return null;
        return { xsdText, source: "builtin" };
      }
    }

    return null;
  }

  /**
   * Returns true if fileName matches the given glob-like pattern.
   * Supports exact match ('pom.xml') and suffix match ('**\/*.xml').
   */
  private matchesPattern(fileName: string, pattern: string): boolean {
    if (fileName === pattern) return true;
    const stripped = pattern.replace(/^\*\*\//, "");
    return fileName.endsWith(stripped);
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

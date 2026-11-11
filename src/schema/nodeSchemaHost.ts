import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { SchemaHost } from "./schemaHost.js";

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

export interface NodeSchemaHostOptions {
  /** Folder that holds `catalog.json` and the bundled schemas. Defaults to the schemas shipped with the package. */
  schemasRoot?: string;
  /** Folder where downloaded schemas are kept. Defaults to `<cwd>/.cache/xml-schemas`. */
  cacheDir?: string;
}

/** A schema host backed by the local disk. */
export function createNodeSchemaHost(options: NodeSchemaHostOptions = {}): SchemaHost {
  return {
    schemasRoot: options.schemasRoot ?? SCHEMAS_ROOT,
    cacheDir: options.cacheDir ?? path.join(process.cwd(), ".cache", "xml-schemas"),
    join: (...segments) => path.join(...segments),
    exists: (filePath) => fs.existsSync(filePath),
    readFile: (filePath) => fs.readFileSync(filePath, "utf-8"),
    writeFile(filePath, text) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, text, "utf-8");
    },
  };
}

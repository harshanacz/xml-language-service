import type { SchemaHost } from "./schemaHost.js";

export interface MemorySchemaHostOptions {
  /** Folder that holds `catalog.json` and the bundled schemas. Defaults to `/schemas`. */
  schemasRoot?: string;
  /** Folder where downloaded schemas are kept. Defaults to `/cache`. */
  cacheDir?: string;
  /** Files to start with, keyed by path. */
  files?: Record<string, string>;
}

/** A schema host that keeps its files in memory. */
export interface MemorySchemaHost extends SchemaHost {
  /** Removes a file. Returns false when there was none at the path. */
  deleteFile(filePath: string): boolean;
}

// Joins with "/" and leaves the inside of each segment alone, so a root such as
// "https://host/schemas" or "vscode-vfs://github/owner/repo" keeps its "//".
function joinSegments(segments: string[]): string {
  const parts = segments.filter((segment) => segment !== "");
  return parts
    .map((segment, i) => {
      let part = segment;
      if (i > 0) part = part.replace(/^\/+/, "");
      if (i < parts.length - 1) part = part.replace(/\/+$/, "");
      return part;
    })
    .filter((part, i) => part !== "" || i === 0)
    .join("/");
}

/**
 * A schema host for places without a disk, such as a browser or a web worker.
 * Nothing is read from anywhere else: put the catalog, the bundled schemas and the
 * XSD files of user associations in `files`, or add them later with `writeFile`.
 * Downloaded schemas are kept in memory under `cacheDir`.
 */
export function createMemorySchemaHost(options: MemorySchemaHostOptions = {}): MemorySchemaHost {
  const files = new Map<string, string>(Object.entries(options.files ?? {}));
  return {
    schemasRoot: options.schemasRoot ?? "/schemas",
    cacheDir: options.cacheDir ?? "/cache",
    join: (...segments) => joinSegments(segments),
    exists: (filePath) => files.has(filePath),
    readFile(filePath) {
      const text = files.get(filePath);
      if (text === undefined) throw new Error(`no such file in the memory schema host: '${filePath}'`);
      return text;
    },
    writeFile(filePath, text) {
      files.set(filePath, text);
    },
    deleteFile: (filePath) => files.delete(filePath),
  };
}

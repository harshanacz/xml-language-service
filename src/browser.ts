// Entry point for browsers and web workers. It has the API of the Node entry
// (index.ts) without the disk: schemas come from an in-memory host that the
// embedding code fills in, and nothing here imports a Node built-in.

import { createLanguageService, LanguageService, LanguageServiceOptions } from "./xmlLanguageService.js";
import { SchemaProvider as HostedSchemaProvider } from "./schema/schemaProvider.js";
import { createMemorySchemaHost } from "./schema/memorySchemaHost.js";
import type { SchemaHost } from "./schema/schemaHost.js";

/**
 * Creates a language service. Pass a `schemaHost` that holds the catalog and the
 * schemas; without one the service starts with an empty in-memory host, so it has
 * no built-in schemas.
 */
export function getLanguageService(options: LanguageServiceOptions = {}): LanguageService {
  return createLanguageService(options.schemaHost ?? createMemorySchemaHost());
}

/** Registry of compiled XSD validators. Uses an empty in-memory host unless given one. */
export class SchemaProvider extends HostedSchemaProvider {
  constructor(host: SchemaHost = createMemorySchemaHost()) {
    super(host);
  }
}

export * from "./common.js";

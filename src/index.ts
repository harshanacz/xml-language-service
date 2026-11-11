import { createLanguageService, LanguageService, LanguageServiceOptions } from "./xmlLanguageService.js";
import { SchemaProvider as HostedSchemaProvider } from "./schema/schemaProvider.js";
import { createNodeSchemaHost } from "./schema/nodeSchemaHost.js";
import type { SchemaHost } from "./schema/schemaHost.js";

/**
 * Creates a language service. Schemas are read from the local disk unless
 * `options.schemaHost` supplies another kind of file access.
 */
export function getLanguageService(options: LanguageServiceOptions = {}): LanguageService {
  return createLanguageService(options.schemaHost ?? createNodeSchemaHost());
}

/** Registry of compiled XSD validators. Reads schemas from the local disk unless given another host. */
export class SchemaProvider extends HostedSchemaProvider {
  constructor(host: SchemaHost = createNodeSchemaHost()) {
    super(host);
  }
}

export { createNodeSchemaHost, NodeSchemaHostOptions } from "./schema/nodeSchemaHost.js";

export * from "./common.js";

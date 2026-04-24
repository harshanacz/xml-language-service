import { XsdValidatorService, Diagnostic } from "./xsdValidator.js";
import { XMLDocument } from "../parser/xmlNode.js";
import { XsdCompletionProvider } from "./xsdCompletionProvider.js";
import { SchemaAssociator, SchemaAssociation, ResolvedSchema } from "./schemaAssociator.js";

export { SchemaAssociation, ResolvedSchema };

/** Identifies a schema to register, pairing a URI key with the raw XSD source. */
export interface SchemaInfo {
  uri: string;
  xsdText: string;
}

/** Registry that manages compiled XSD validators and routes validation requests to them. */
export class SchemaProvider {
  private schemas = new Map<string, XsdValidatorService>();
  private completionProviders: Map<string, XsdCompletionProvider>;
  private associator: SchemaAssociator;

  constructor() {
    this.completionProviders = new Map();
    this.associator = new SchemaAssociator();
  }

  /**
   * Compiles the given XSD and registers it under the provided URI.
   * If a validator for that URI already exists it is disposed before being replaced.
   * Also builds and caches a completion provider for the same XSD.
   */
  async registerSchema(info: SchemaInfo): Promise<void> {
    const existing = this.schemas.get(info.uri);
    if (existing) {
      existing.dispose();
    }
    const validator = await XsdValidatorService.create(info.xsdText);
    this.schemas.set(info.uri, validator);

    this.completionProviders.set(info.uri, new XsdCompletionProvider(info.xsdText));
  }

  /** Registers a custom file-to-schema mapping that takes priority over built-in associations. */
  addUserAssociation(association: SchemaAssociation): void {
    this.associator.addUserAssociation(association);
  }

  /** Returns the raw ResolvedSchema (with xsdText) for the given file name and optional namespace, or null if none matches. */
  findSchemaForDocument(fileName: string, xmlns?: string): ResolvedSchema | null {
    return this.associator.findSchema(fileName, xmlns);
  }

  /**
   * Resolves and returns the XsdCompletionProvider for the given file name and optional namespace.
   * Automatically loads and caches the provider on first access via the built-in associations.
   * Returns null if no matching schema is found.
   */
  resolveSchemaForDocument(fileName: string, xmlns?: string): XsdCompletionProvider | null {
    const cacheKey = `${fileName}|${xmlns ?? ""}`;
    const cached = this.completionProviders.get(cacheKey);
    if (cached) return cached;

    const resolved = this.associator.findSchema(fileName, xmlns);
    if (!resolved) return null;

    const provider = new XsdCompletionProvider(resolved.xsdText);
    this.completionProviders.set(cacheKey, provider);
    return provider;
  }

  /**
   * Validates the document against the schema registered under schemaUri.
   * Returns a warning diagnostic when no matching schema is found.
   */
  async validate(schemaUri: string, document: XMLDocument): Promise<Diagnostic[]> {
    const validator = this.schemas.get(schemaUri);
    if (!validator) {
      return [
        {
          message: "No schema registered for: " + schemaUri,
          severity: "warning",
          source: "xsd",
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        },
      ];
    }
    return validator.validate(document.text);
  }

  /** Returns true when a compiled validator for the given URI exists in the registry. */
  hasSchema(uri: string): boolean {
    return this.schemas.has(uri);
  }

  /** Disposes all registered validators and clears the registry. */
  dispose(): void {
    for (const validator of this.schemas.values()) {
      validator.dispose();
    }
    this.schemas.clear();
    this.completionProviders.clear();
  }
}

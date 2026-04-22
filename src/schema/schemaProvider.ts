import { XsdValidatorService, Diagnostic } from "./xsdValidator.js";
import { XMLDocument } from "../parser/xmlNode.js";

/** Identifies a schema to register, pairing a URI key with the raw XSD source. */
export interface SchemaInfo {
  uri: string;
  xsdText: string;
}

/** Registry that manages compiled XSD validators and routes validation requests to them. */
export class SchemaProvider {
  private schemas = new Map<string, XsdValidatorService>();

  /**
   * Compiles the given XSD and registers it under the provided URI.
   * If a validator for that URI already exists it is disposed before being replaced.
   */
  async registerSchema(info: SchemaInfo): Promise<void> {
    const existing = this.schemas.get(info.uri);
    if (existing) {
      existing.dispose();
    }
    const validator = await XsdValidatorService.create(info.xsdText);
    this.schemas.set(info.uri, validator);
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
  }
}

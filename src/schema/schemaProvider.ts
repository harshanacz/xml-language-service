import { XsdValidatorService, Diagnostic, XsdInput, SchemaBundle } from "./xsdValidator.js";
import { XMLDocument } from "../parser/xmlNode.js";
import { XsdCompletionProvider } from "./xsdCompletionProvider.js";
import { SchemaAssociator, SchemaAssociation, ResolvedSchema } from "./schemaAssociator.js";

// Resolves a relative schemaLocation against a current file's path (both relative to
// the entry schema's directory).  Handles ../ and ./ segments via standard URI resolution.
function resolveRelativePath(basePath: string, location: string): string {
  const parts = basePath.split("/");
  parts.pop(); // drop filename, keep directory segments
  for (const seg of location.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

// Inlines xs:include / xs:redefine references into a single flat XSD string.
// `currentPath` is the path of `text` relative to the entry schema's directory.
// Uses `visited` to break cycles.
function inlineIncludes(
  text: string,
  imports: Record<string, string>,
  currentPath: string = "",
  visited: Set<string> = new Set(),
): string {
  return text.replace(
    /<xs:(?:include|redefine)\s+schemaLocation\s*=\s*"([^"]+)"\s*(?:\/>|>[\s\S]*?<\/xs:(?:include|redefine)>)/g,
    (_match, location: string) => {
      const resolved = resolveRelativePath(currentPath || "entry.xsd", location);
      const content = imports[resolved];
      if (!content || visited.has(resolved)) return "";
      visited.add(resolved);
      const expanded = inlineIncludes(content, imports, resolved, visited);
      const body = expanded.match(/<xs:schema\b[^>]*>([\s\S]*)<\/xs:schema>/);
      return body ? body[1] : "";
    },
  );
}

export { SchemaAssociation, ResolvedSchema };

/**
 * Identifies a schema to register.
 * `xsdText` is the root XSD content.
 * `imports` optionally maps relative filenames (matching xs:include / xs:import
 * schemaLocation values) to their XSD content, enabling multi-file schemas.
 */
export interface SchemaInfo {
  uri: string;
  xsdText: string;
  imports?: Record<string, string>;
}

export { SchemaBundle };

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
    if (existing) existing.dispose();

    const xsd: XsdInput = info.imports
      ? { entry: info.xsdText, imports: info.imports }
      : info.xsdText;
    const validator = await XsdValidatorService.create(xsd);
    this.schemas.set(info.uri, validator);

    // Build the completion provider from the fully inlined XSD so that types
    // defined in xs:include'd schemas are available for hover and completions.
    const completionXsd = info.imports
      ? inlineIncludes(info.xsdText, info.imports)
      : info.xsdText;
    const provider = new XsdCompletionProvider(completionXsd);
    console.error(`[schemaProvider] Built provider for ${info.uri}: ${provider.getAllElements().length} elements, payloadFactory=${provider.getElement("payloadFactory") !== undefined}, inlinedXsdLen=${completionXsd.length}`);
    this.completionProviders.set(info.uri, provider);
  }

  /** Registers a custom file-to-schema mapping that takes priority over built-in associations. */
  addUserAssociation(association: SchemaAssociation): void {
    this.associator.addUserAssociation(association);
  }

  /** Returns the raw ResolvedSchema (with xsdText) for the given file name and optional namespace, or null if none matches. */
  findSchemaForDocument(fileName: string, xmlns?: string, documentPath?: string): ResolvedSchema | null {
    return this.associator.findSchema(fileName, xmlns, documentPath);
  }

  /**
   * Resolves and returns the XsdCompletionProvider for the given file name and optional namespace.
   * Automatically loads and caches the provider on first access via the built-in associations.
   * Returns null if no matching schema is found.
   */
  resolveSchemaForDocument(fileName: string, xmlns?: string, documentPath?: string): XsdCompletionProvider | null {
    // Prefer the completion provider that was built during registerSchema (which has
    // all xs:include content inlined).  diagnosticsHandler registers under auto://<path>.
    if (documentPath) {
      const registered = this.completionProviders.get(`auto://${documentPath}`);
      if (registered) return registered;
    }

    const cacheKey = `${documentPath ?? fileName}|${xmlns ?? ""}`;
    const cached = this.completionProviders.get(cacheKey);
    if (cached) return cached;

    const resolved = this.associator.findSchema(fileName, xmlns, documentPath);
    if (!resolved) return null;

    // Build a provider from the raw XSD text (no xs:include inlining). This is a
    // partial provider used only when the auto:// provider is not ready yet. It is
    // intentionally NOT cached so that once validateAndSend registers the full
    // auto:// provider it is used immediately on the next request.
    return new XsdCompletionProvider(resolved.xsdText);
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
    // Xerces runs syntax parsing + XSD validation in one pass, so both
    // syntax errors and schema errors are returned even on malformed XML.
    return validator.validate(document.text);
  }

  /** Returns true when a compiled validator for the given URI exists in the registry. */
  hasSchema(uri: string): boolean {
    return this.schemas.has(uri);
  }

  /** Removes all auto:// schemas so they are re-registered fresh on next validation. */
  invalidateAutoSchemas(): void {
    for (const [key, validator] of this.schemas) {
      if (key.startsWith("auto://")) {
        validator.dispose();
        this.schemas.delete(key);
      }
    }
    for (const key of this.completionProviders.keys()) {
      if (key.startsWith("auto://")) {
        this.completionProviders.delete(key);
      }
    }
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

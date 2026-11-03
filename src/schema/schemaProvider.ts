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
 * `xsdPath` is an optional stable key for the XSD file itself (e.g. its absolute
 * path on disk).  When provided, multiple documents that share the same XSD path
 * will reuse a single compiled XsdValidatorService instead of creating one copy
 * per open document.  Defaults to `uri` when omitted.
 */
export interface SchemaInfo {
  uri: string;
  xsdText: string;
  xsdPath?: string;
  imports?: Record<string, string>;
}

export { SchemaBundle };

/** Registry that manages compiled XSD validators and routes validation requests to them. */
export class SchemaProvider {
  // xsdKey (xsdPath ?? uri) → in-flight compilation Promise to prevent startup race conditions
  private validators = new Map<string, Promise<XsdValidatorService>>();
  // documentUri → xsdKey — many documents can share the same validator
  private documentToSchema = new Map<string, string>();
  // xsdKey → completion provider built from an explicitly registered schema
  private completionProviders = new Map<string, XsdCompletionProvider>();
  // resolved xsdPath → completion provider built from an associated schema file
  private resolvedProviders = new Map<string, XsdCompletionProvider>();
  private associator = new SchemaAssociator();

  /**
   * Compiles the given XSD (if not already compiled for the same xsdPath) and
   * maps the document URI to that validator.  Multiple documents sharing the
   * same xsdPath reuse a single XsdValidatorService instance.
   * Also builds and caches a completion provider for the document URI.
   */
  async registerSchema(info: SchemaInfo): Promise<void> {
    const xsdKey = info.xsdPath ?? info.uri;
    const prevKey = this.documentToSchema.get(info.uri);
    this.documentToSchema.set(info.uri, xsdKey);

    // If this document previously pointed to a different XSD key, release that
    // validator when no other document still references it.
    if (prevKey && prevKey !== xsdKey && !this.isKeyReferenced(prevKey)) {
      this.releaseKey(prevKey).catch(() => {});
    }

    // Compile the validator only once per unique XSD key, caching the in-flight Promise synchronously.
    if (!this.validators.has(xsdKey)) {
      const xsd: XsdInput = info.imports
        ? { entry: info.xsdText, imports: info.imports }
        : info.xsdText;
      const pending = XsdValidatorService.create(xsd).catch((err) => {
        this.validators.delete(xsdKey);
        throw err;
      });
      this.validators.set(xsdKey, pending);
    }

    await this.validators.get(xsdKey);
    await this.buildAndCacheCompletionProvider(info);
  }

  /** Builds and caches an XSD completion provider for the given SchemaInfo. */
  async buildAndCacheCompletionProvider(info: SchemaInfo): Promise<void> {
    const xsdKey = info.xsdPath ?? info.uri;
    this.documentToSchema.set(info.uri, xsdKey);

    if (!this.completionProviders.has(xsdKey)) {
      const completionXsd = info.imports
        ? inlineIncludes(info.xsdText, info.imports)
        : info.xsdText;
      const provider = new XsdCompletionProvider(completionXsd);
      this.completionProviders.set(xsdKey, provider);
    }
  }

  private isKeyReferenced(xsdKey: string): boolean {
    for (const k of this.documentToSchema.values()) {
      if (k === xsdKey) return true;
    }
    return false;
  }

  /** Drops the validator and completion provider stored under xsdKey. */
  private async releaseKey(xsdKey: string): Promise<void> {
    const promise = this.validators.get(xsdKey);
    this.validators.delete(xsdKey);
    this.completionProviders.delete(xsdKey);
    if (promise) {
      try {
        (await promise).dispose();
      } catch {
        // compilation failed; nothing to dispose
      }
    }
  }

  /** Registers a custom file-to-schema mapping that takes priority over built-in associations. */
  addUserAssociation(association: SchemaAssociation): void {
    this.associator.addUserAssociation(association);
  }

  /** Clears all user-registered associations. */
  clearUserAssociations(): void {
    this.associator.clearUserAssociations();
  }

  /** Returns the raw ResolvedSchema (with xsdText) for the given file name and optional namespace, or null if none matches. */
  findSchemaForDocument(fileName: string, xmlns?: string, documentPath?: string): ResolvedSchema | null {
    return this.associator.findSchema(fileName, xmlns, documentPath);
  }

  /** Async variant that supports network fallback for remote HTTP/HTTPS systemIds. */
  async findSchemaForDocumentAsync(fileName: string, xmlns?: string, documentPath?: string, systemId?: string): Promise<ResolvedSchema | null> {
    return this.associator.findSchemaAsync(fileName, xmlns, documentPath, systemId);
  }

  /**
   * Resolves and returns the XsdCompletionProvider for the given file name and optional namespace.
   * A provider registered for `auto://<documentPath>` wins; otherwise the schema is
   * looked up through the associations and its provider is cached by XSD path.
   * Returns null if no matching schema is found.
   */
  resolveSchemaForDocument(fileName: string, xmlns?: string, documentPath?: string): XsdCompletionProvider | null {
    if (documentPath) {
      const autoUri = `auto://${documentPath}`;
      const xsdKey = this.documentToSchema.get(autoUri);
      if (xsdKey) {
        const registered = this.completionProviders.get(xsdKey);
        if (registered) return registered;
      }
    }

    const resolved = this.associator.findSchema(fileName, xmlns, documentPath);
    if (!resolved) return null;

    let provider = this.resolvedProviders.get(resolved.xsdPath);
    if (!provider) {
      provider = new XsdCompletionProvider(resolved.xsdText);
      this.resolvedProviders.set(resolved.xsdPath, provider);
    }
    return provider;
  }

  /**
   * Validates the document against the schema registered under schemaUri.
   * Without a registered validator, returns the parser's syntax errors instead.
   */
  async validate(schemaUri: string, document: XMLDocument): Promise<Diagnostic[]> {
    const xsdKey = this.documentToSchema.get(schemaUri);
    const validatorPromise = xsdKey ? this.validators.get(xsdKey) : undefined;
    if (!validatorPromise) {
      // No schema registered — fall back to the parser's own syntax errors
      return document.syntaxErrors.map((e) => ({
        message: e.message,
        severity: "error" as const,
        source: "syntax" as const,
        range: {
          start: { line: e.line, character: e.character },
          end: {
            line: e.endLine ?? e.line,
            character: e.endCharacter ?? (e.character + 1),
          },
        },
      }));
    }
    const validator = await validatorPromise;
    return validator.validate(document.text);
  }

  /** Returns true when a schema (validator or completion provider) is registered for the document URI. */
  hasSchema(uri: string): boolean {
    return this.documentToSchema.has(uri);
  }

  /**
   * Removes all auto:// schema registrations and every cached completion provider
   * built from associated schema files, so schemas are re-read from disk on next use.
   */
  async invalidateAutoSchemas(): Promise<void> {
    const keysToCheck = new Set<string>();
    for (const [docUri, xsdKey] of this.documentToSchema) {
      if (docUri.startsWith("auto://")) {
        keysToCheck.add(xsdKey);
        this.documentToSchema.delete(docUri);
      }
    }
    for (const xsdKey of keysToCheck) {
      if (!this.isKeyReferenced(xsdKey)) await this.releaseKey(xsdKey);
    }
    this.resolvedProviders.clear();
  }

  /** Disposes all registered validators and clears the registry. */
  async dispose(): Promise<void> {
    for (const validatorPromise of this.validators.values()) {
      try {
        const v = await validatorPromise;
        v.dispose();
      } catch {}
    }
    this.validators.clear();
    this.documentToSchema.clear();
    this.completionProviders.clear();
    this.resolvedProviders.clear();
  }
}

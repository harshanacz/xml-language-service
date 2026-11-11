import { parseXMLDocument } from "./parser/xmlParser.js";
import { printAST, printCST, printTreeAST, PrintOptions } from "./utils/xmlPrinter.js";
import { XMLDocument } from "./parser/xmlNode.js";
import { Position } from "./utils/positionUtils.js";
import { doComplete, CompletionList } from "./services/xmlCompletion.js";
import { doHover, HoverResult } from "./services/xmlHover.js";
import { findDocumentSymbols, DocumentSymbol } from "./services/xmlSymbols.js";
import { getFoldingRanges, FoldingRange } from "./services/xmlFolding.js";
import { format, TextEdit, FormatterOptions } from "./services/xmlFormatter.js";
import { doRename } from "./services/xmlRename.js";
import { doDefinition, DefinitionResult } from "./services/xmlDefinition.js";
import { findReferences, ReferenceResult } from "./services/xmlReferences.js";
import { SchemaProvider, SchemaInfo, SchemaAssociation, ResolvedSchema } from "./schema/schemaProvider.js";
import { Diagnostic } from "./schema/xsdValidator.js";
import { getRootNamespace } from "./utils/tagUtils.js";
import type { SchemaHost } from "./schema/schemaHost.js";

export interface LanguageServiceOptions {
  /** File access for schemas. Defaults to the local disk. */
  schemaHost?: SchemaHost;
}

/** Creates a language service that finds and reads schemas through `schemaHost`. */
export function createLanguageService(schemaHost: SchemaHost) {
  const schemaProvider = new SchemaProvider(schemaHost);

  return {
    // ── XML core ─────────────────────────────────────────────────────────────

    parseXMLDocument(uri: string, text: string): XMLDocument {
      return parseXMLDocument(uri, text);
    },

    doComplete(document: XMLDocument, position: Position, fileName?: string, documentPath?: string): CompletionList {
      const provider = schemaProvider.resolveSchemaForDocument(fileName ?? "", getRootNamespace(document), documentPath);
      return doComplete(document, position, provider);
    },

    doHover(document: XMLDocument, position: Position, fileName?: string, documentPath?: string): HoverResult | null {
      const provider = schemaProvider.resolveSchemaForDocument(fileName ?? "", getRootNamespace(document), documentPath);
      return doHover(document, position, provider);
    },

    findDocumentSymbols(document: XMLDocument): DocumentSymbol[] {
      return findDocumentSymbols(document);
    },

    getFoldingRanges(document: XMLDocument): FoldingRange[] {
      return getFoldingRanges(document);
    },

    format(document: XMLDocument, options?: FormatterOptions): TextEdit[] {
      return format(document, options);
    },

    doRename(document: XMLDocument, position: Position, newName: string): TextEdit[] | null {
      return doRename(document, position, newName);
    },

    doDefinition(document: XMLDocument, position: Position): DefinitionResult | null {
      return doDefinition(document, position);
    },

    findReferences(document: XMLDocument, position: Position): ReferenceResult[] {
      return findReferences(document, position);
    },

    // ── Debug / Inspection ───────────────────────────────────────────────────

    printAST(document: XMLDocument, options?: PrintOptions): string {
      return printAST(document, options);
    },

    printCST(document: XMLDocument, options?: PrintOptions): string {
      return printCST(document, options);
    },

    printTreeAST(document: XMLDocument): string {
      return printTreeAST(document);
    },

    // ── XSD schema validation ────────────────────────────────────────────────

    async registerSchema(info: SchemaInfo): Promise<void> {
      return schemaProvider.registerSchema(info);
    },

    async validate(schemaUri: string, document: XMLDocument): Promise<Diagnostic[]> {
      return schemaProvider.validate(schemaUri, document);
    },

    hasSchema(uri: string): boolean {
      return schemaProvider.hasSchema(uri);
    },

    /** Returns the raw schema (xsdText + source) matched to the given file name and xmlns, or null if none found. */
    resolveSchemaForDocument(fileName: string, xmlns?: string, documentPath?: string): ResolvedSchema | null {
      return schemaProvider.findSchemaForDocument(fileName, xmlns, documentPath);
    },

    /** Async variant supporting remote HTTP/HTTPS systemId fetching when not found locally. */
    async resolveSchemaForDocumentAsync(fileName: string, xmlns?: string, documentPath?: string, systemId?: string): Promise<ResolvedSchema | null> {
      return schemaProvider.findSchemaForDocumentAsync(fileName, xmlns, documentPath, systemId);
    },

    /** Registers a custom file-to-schema mapping, taking priority over built-in associations. */
    addUserAssociation(association: SchemaAssociation): void {
      schemaProvider.addUserAssociation(association);
    },

    /** Removes all user-registered associations so a fresh set can be applied. */
    clearUserAssociations(): void {
      schemaProvider.clearUserAssociations();
    },

    async buildAndCacheCompletionProvider(info: SchemaInfo): Promise<void> {
      return schemaProvider.buildAndCacheCompletionProvider(info);
    },

    /** Clears all auto-registered schemas so they are re-loaded from disk on next validation. */
    async invalidateAutoSchemas(): Promise<void> {
      return schemaProvider.invalidateAutoSchemas();
    },

    async dispose(): Promise<void> {
      return schemaProvider.dispose();
    },
  };
}

export type LanguageService = ReturnType<typeof createLanguageService>;

import { parseXMLDocument } from "./parser/xmlParser.js";
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
import { SchemaProvider, SchemaInfo } from "./schema/schemaProvider.js";
import { Diagnostic } from "./schema/xsdValidator.js";

export function getLanguageService() {
  const schemaProvider = new SchemaProvider();

  return {
    // ── Phase 01 — XML Core ──────────────────────────────────────────────────

    parseXMLDocument(uri: string, text: string): XMLDocument {
      return parseXMLDocument(uri, text);
    },

    doComplete(document: XMLDocument, position: Position): CompletionList {
      return doComplete(document, position);
    },

    doHover(document: XMLDocument, position: Position): HoverResult | null {
      return doHover(document, position);
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

    // ── Phase 02 — XSD Schema Validation ────────────────────────────────────

    async registerSchema(info: SchemaInfo): Promise<void> {
      return schemaProvider.registerSchema(info);
    },

    async validate(schemaUri: string, document: XMLDocument): Promise<Diagnostic[]> {
      return schemaProvider.validate(schemaUri, document);
    },

    hasSchema(uri: string): boolean {
      return schemaProvider.hasSchema(uri);
    },

    dispose(): void {
      schemaProvider.dispose();
    },
  };
}

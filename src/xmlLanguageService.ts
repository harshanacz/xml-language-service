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

export function getLanguageService() {
  return {
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
  };
}

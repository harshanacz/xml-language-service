import { parseXMLDocument } from "./parser/xmlParser.js";
import { XMLDocument } from "./parser/xmlNode.js";

export function getLanguageService() {
  return {
    parseXMLDocument(uri: string, text: string): XMLDocument {
      return parseXMLDocument(uri, text);
    },

    // TODO: doComplete(document: XMLDocument, position: Position): CompletionList
    // TODO: doHover(document: XMLDocument, position: Position): Hover | null
    // TODO: findDocumentSymbols(document: XMLDocument): SymbolInformation[]
    // TODO: getFoldingRanges(document: XMLDocument): FoldingRange[]
    // TODO: format(document: XMLDocument, options: FormattingOptions): TextEdit[]
    // TODO: doRename(document: XMLDocument, position: Position, newName: string): WorkspaceEdit | null
  };
}

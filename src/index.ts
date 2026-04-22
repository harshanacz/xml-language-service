export { getLanguageService } from "./xmlLanguageService.js";

// Core AST types
export { XMLDocument, XMLNode, XMLAttribute } from "./parser/xmlNode.js";

// Utility types
export { Position } from "./utils/positionUtils.js";
export { Range } from "./utils/rangeUtils.js";

// Service types
export { CompletionList, CompletionItem } from "./services/xmlCompletion.js";
export { HoverResult } from "./services/xmlHover.js";
export { DocumentSymbol } from "./services/xmlSymbols.js";
export { FoldingRange } from "./services/xmlFolding.js";
export { TextEdit, FormatterOptions } from "./services/xmlFormatter.js";
export { DefinitionResult } from "./services/xmlDefinition.js";
export { ReferenceResult } from "./services/xmlReferences.js";

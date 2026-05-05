export { getLanguageService } from "./xmlLanguageService.js";

// Core AST types
export { XMLDocument, XMLNode, XMLAttribute } from "./parser/xmlNode.js";

// Utility types
export { Position } from "./utils/positionUtils.js";
export { Range } from "./utils/rangeUtils.js";

// Phase 01 service types
export { CompletionList, CompletionItem } from "./services/xmlCompletion.js";
export { HoverResult } from "./services/xmlHover.js";
export { DocumentSymbol } from "./services/xmlSymbols.js";
export { FoldingRange } from "./services/xmlFolding.js";
export { TextEdit, FormatterOptions } from "./services/xmlFormatter.js";
export { DefinitionResult } from "./services/xmlDefinition.js";
export { ReferenceResult } from "./services/xmlReferences.js";

// Debug / inspection utilities
export { printAST, printCST, printTreeAST, PrintOptions, PrintFormat } from "./utils/xmlPrinter.js";

// Phase 02 schema validation types
export { Diagnostic, SchemaBundle, XsdInput, XmlInput, XsdValidatorService } from "./schema/xsdValidator.js";
export { SchemaProvider, SchemaInfo, ResolvedSchema, SchemaAssociation } from "./schema/schemaProvider.js";

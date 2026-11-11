import { createLanguageService, LanguageService, LanguageServiceOptions } from "./xmlLanguageService.js";
import { SchemaProvider as HostedSchemaProvider } from "./schema/schemaProvider.js";
import { createNodeSchemaHost } from "./schema/nodeSchemaHost.js";
import type { SchemaHost } from "./schema/schemaHost.js";

/**
 * Creates a language service. Schemas are read from the local disk unless
 * `options.schemaHost` supplies another kind of file access.
 */
export function getLanguageService(options: LanguageServiceOptions = {}): LanguageService {
  return createLanguageService(options.schemaHost ?? createNodeSchemaHost());
}

export { LanguageService, LanguageServiceOptions };

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

// Debug / inspection utilities
export { printAST, printCST, printTreeAST, PrintOptions, PrintFormat } from "./utils/xmlPrinter.js";

// Schema validation types
export { Diagnostic, SchemaBundle, XsdInput, XmlInput, XsdValidatorService } from "./schema/xsdValidator.js";
export { SchemaInfo, ResolvedSchema, SchemaAssociation } from "./schema/schemaProvider.js";

/** Registry of compiled XSD validators. Reads schemas from the local disk unless given another host. */
export class SchemaProvider extends HostedSchemaProvider {
  constructor(host: SchemaHost = createNodeSchemaHost()) {
    super(host);
  }
}

// Schema file access
export { SchemaHost } from "./schema/schemaHost.js";
export { createNodeSchemaHost, NodeSchemaHostOptions } from "./schema/nodeSchemaHost.js";

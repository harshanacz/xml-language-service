import { parse } from "@xml-tools/parser";
import { XMLDocumentImpl } from "./xmlDocument.js";
import { XMLDocument } from "./xmlNode.js";

/**
 * Parses an XML string into an XMLDocument tree using @xml-tools/parser as the underlying CST parser.
 */
export function parseXMLDocument(uri: string, text: string): XMLDocument {
  const { cst } = parse(text);
  return new XMLDocumentImpl(uri, text, cst);
}

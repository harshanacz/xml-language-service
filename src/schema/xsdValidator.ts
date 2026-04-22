import { XmlDocument, XsdValidator, XmlValidateError } from "libxml2-wasm";
import { Position } from "../utils/positionUtils.js";
import { Range } from "../utils/rangeUtils.js";

/** A validation diagnostic produced by XSD schema validation. */
export interface Diagnostic {
  range: Range;
  message: string;
  severity: "error" | "warning" | "info";
  source: "xsd";
}

/** Wraps a compiled XSD schema and validates XML documents against it. */
export class XsdValidatorService {
  private xsdText: string;
  private _xsdDoc: XmlDocument | null = null;
  private _validator: XsdValidator | null = null;

  private constructor(xsdText: string) {
    this.xsdText = xsdText;
  }

  /**
   * Parses the XSD and compiles the validator. Use this instead of the constructor
   * to allow async error propagation during XSD parsing.
   */
  static async create(xsdText: string): Promise<XsdValidatorService> {
    const service = new XsdValidatorService(xsdText);
    service._xsdDoc = XmlDocument.fromString(xsdText);
    service._validator = XsdValidator.fromDoc(service._xsdDoc);
    return service;
  }

  /**
   * Validates the given XML text against the compiled XSD schema.
   * Returns an empty array when the document is valid.
   * Never throws — all errors are captured as Diagnostic objects.
   */
  async validate(xmlText: string): Promise<Diagnostic[]> {
    let xmlDoc: XmlDocument | null = null;
    try {
      xmlDoc = XmlDocument.fromString(xmlText);
      this._validator!.validate(xmlDoc);
      return [];
    } catch (err) {
      if (err instanceof XmlValidateError) {
        return err.details.map((d) => ({
          message: d.message.trim(),
          severity: "error" as const,
          source: "xsd" as const,
          range: lineToRange(d.line),
        }));
      }
      const msg = err instanceof Error ? err.message : String(err);
      return [
        {
          message: "Validation failed: " + msg,
          severity: "error" as const,
          source: "xsd" as const,
          range: lineToRange(0),
        },
      ];
    } finally {
      xmlDoc?.dispose();
    }
  }

  /** Releases the compiled XSD document and validator from WASM memory. */
  dispose(): void {
    this._validator?.dispose();
    this._xsdDoc?.dispose();
    this._validator = null;
    this._xsdDoc = null;
  }
}

// libxml2 reports 1-based line numbers; convert to 0-based LSP positions.
function lineToRange(line: number): Range {
  const lineIndex = line > 0 ? line - 1 : 0;
  const pos: Position = { line: lineIndex, character: 0 };
  return { start: pos, end: pos };
}

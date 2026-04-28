import { Range } from "../utils/rangeUtils.js";
import { Position } from "../utils/positionUtils.js";

/** A validation diagnostic used throughout the language service. */
export interface Diagnostic {
  range: Range;
  message: string;
  severity: "error" | "warning" | "info";
  source: "xsd" | "syntax";
}

interface XercesDiagnostic {
  message: string;
  line: number;
  column: number;
  severity: "warning" | "error" | "fatal";
}

interface ValidationResult {
  valid: boolean;
  parseErrors: XercesDiagnostic[];
  schemaErrors: XercesDiagnostic[];
}

let _mod: any = null;
async function getModule(): Promise<any> {
  if (!_mod) {
    // @ts-ignore — xerces_validator.js is the Emscripten-generated WASM glue; place it in src/wasm/
    const { default: XercesModule } = await import("../wasm/xerces_validator.js");
    _mod = await XercesModule();
  }
  return _mod;
}

function toRange(line: number, column: number): Range {
  const l = line > 0 ? line - 1 : 0;
  const c = column > 0 ? column - 1 : 0;
  const pos: Position = { line: l, character: c };
  return { start: pos, end: pos };
}

/** Wraps the Xerces WASM validator — handles both syntax and XSD validation in one pass. */
export class XsdValidatorService {
  private xsdText: string;

  private constructor(xsdText: string) {
    this.xsdText = xsdText;
  }

  static async create(xsdText: string): Promise<XsdValidatorService> {
    await getModule();
    return new XsdValidatorService(xsdText);
  }

  /**
   * Validates xmlText against the compiled XSD schema.
   * Xerces runs syntax parsing and schema validation in a single pass, so both
   * syntax errors and schema errors are returned together even on malformed XML.
   */
  async validate(xmlText: string): Promise<Diagnostic[]> {
    const mod = await getModule();
    const result: ValidationResult = await mod.validate(xmlText, this.xsdText);
    const diagnostics: Diagnostic[] = [];

    for (const d of result.parseErrors) {
      diagnostics.push({
        message: d.message,
        severity: "error",
        source: "syntax",
        range: toRange(d.line, d.column),
      });
    }

    for (const d of result.schemaErrors) {
      diagnostics.push({
        message: d.message,
        severity: d.severity === "warning" ? "warning" : "error",
        source: "xsd",
        range: toRange(d.line, d.column),
      });
    }

    return diagnostics;
  }

  dispose(): void {
    // WASM module is shared — nothing to release per instance
  }
}

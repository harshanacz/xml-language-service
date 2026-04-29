// @ts-ignore — xerces_validator.js is Emscripten-generated CJS; the local
// package.json in xerces-wasm/ marks it CommonJS so Node ESM can import it.
import XercesModule from "../xerces-wasm/xerces_validator.js";
import { Range } from "../utils/rangeUtils.js";
import { Position } from "../utils/positionUtils.js";

// ── Public types ──────────────────────────────────────────────────────────────

/** A validation diagnostic used throughout the language service. */
export interface Diagnostic {
  range: Range;
  message: string;
  severity: "error" | "warning" | "info";
  source: "xsd" | "syntax";
}

export type XmlInput = string | Buffer | Blob;

/**
 * A bundle of schemas for xs:import / xs:include support.
 * `entry` is the root XSD content.
 * `imports` maps relative filenames (matching schemaLocation values) to their XSD content.
 */
export interface SchemaBundle {
  entry: XmlInput;
  imports?: Record<string, XmlInput>;
}

export type XsdInput = XmlInput | SchemaBundle;

// ── Internal Xerces types ─────────────────────────────────────────────────────

interface XercesDiagnostic {
  message: string;
  line: number;
  column: number;
  severity: "warning" | "error" | "fatal";
}

interface XercesResult {
  valid: boolean;
  parseErrors: XercesDiagnostic[];
  schemaErrors: XercesDiagnostic[];
}

// ── WASM module loader ────────────────────────────────────────────────────────

let _module: any = null;
async function getModule(): Promise<any> {
  if (!_module) _module = await XercesModule();
  return _module;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function toText(input: XmlInput): Promise<string> {
  if (typeof input === "string") return input;
  if (Buffer.isBuffer(input)) return input.toString("utf8");
  if (typeof Blob !== "undefined" && input instanceof Blob) return input.text();
  throw new TypeError("Unsupported input type");
}

// Replace a matched region with spaces, preserving newlines so that
// Xerces error line numbers map correctly back to the original source.
function blankPreservingLines(match: string): string {
  return match.replace(/[^\n]/g, " ");
}

// The Xerces WASM bridge uses setExternalNoNamespaceSchemaLocation, which only
// works for schemas with no targetNamespace. For namespaced schemas we strip
// the targetNamespace from the XSD and the default xmlns from the XML so both
// sides are in no-namespace mode. All structural validation still runs.
// Replacements use blankPreservingLines so multi-line attributes don't shift
// line numbers, keeping Xerces error positions accurate in the original source.
function toNoNamespace(xsdText: string, xmlText: string): { xsd: string; xml: string } {
  const nsMatch = xsdText.match(/\btargetNamespace="([^"]*)"/);
  if (!nsMatch) return { xsd: xsdText, xml: xmlText };

  const targetNs = nsMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const xsd = xsdText
    .replace(/\s+targetNamespace="[^"]*"/, blankPreservingLines)
    .replace(new RegExp(`\\s+xmlns="${targetNs}"`, "g"), blankPreservingLines);

  const xml = xmlText
    .replace(new RegExp(`\\s+xmlns="${targetNs}"`, "g"), blankPreservingLines)
    .replace(/\s+xsi:schemaLocation="[^"]*"/g, blankPreservingLines);

  return { xsd, xml };
}

function isSchemaBundle(xsd: XsdInput): xsd is SchemaBundle {
  return typeof xsd === "object" && !Buffer.isBuffer(xsd) && "entry" in xsd;
}

// Xerces reports the column at the closing '>' of the problematic tag.
// Walk backward on that line to find '<' so the full tag name is highlighted.
function toRange(line: number, column: number, xmlLines: string[]): Range {
  const l = line > 0 ? line - 1 : 0;
  const c = column > 0 ? column - 1 : 0;

  const lineText = xmlLines[l] ?? "";
  const tagStart = lineText.lastIndexOf("<", c);
  if (tagStart !== -1) {
    return {
      start: { line: l, character: tagStart },
      end: { line: l, character: c + 1 },
    };
  }

  const pos: Position = { line: l, character: c };
  return { start: pos, end: pos };
}

function mapResults(result: XercesResult, xmlText: string): Diagnostic[] {
  const xmlLines = xmlText.split("\n");
  const diagnostics: Diagnostic[] = [];
  for (const d of result.parseErrors) {
    diagnostics.push({
      message: d.message,
      severity: "error",
      source: "syntax",
      range: toRange(d.line, d.column, xmlLines),
    });
  }
  for (const d of result.schemaErrors) {
    diagnostics.push({
      message: d.message,
      severity: d.severity === "warning" ? "warning" : "error",
      source: "xsd",
      range: toRange(d.line, d.column, xmlLines),
    });
  }
  return diagnostics;
}

// ── XsdValidatorService ───────────────────────────────────────────────────────

/**
 * Wraps the Xerces WASM validator.
 * Accepts a plain XSD string or a SchemaBundle for xs:include / xs:import support.
 * Xerces runs syntax parsing + schema validation in a single SAX pass, so both
 * syntax errors and schema errors are returned together even on malformed XML.
 */
export class XsdValidatorService {
  private xsd: XsdInput;

  private constructor(xsd: XsdInput) {
    this.xsd = xsd;
  }

  static async create(xsd: XsdInput): Promise<XsdValidatorService> {
    await getModule();
    return new XsdValidatorService(xsd);
  }

  async validate(xmlText: string): Promise<Diagnostic[]> {
    const mod = await getModule();
    let result: XercesResult;

    if (isSchemaBundle(this.xsd)) {
      const entryText = await toText(this.xsd.entry);
      const imports: Record<string, string> = {};
      if (this.xsd.imports) {
        await Promise.all(
          Object.entries(this.xsd.imports).map(async ([key, val]) => {
            imports[key] = await toText(val);
          })
        );
      }
      const { xsd, xml } = toNoNamespace(entryText, xmlText);
      result = await mod.validate(xml, { entry: xsd, imports });
    } else {
      const xsdText = await toText(this.xsd);
      const { xsd, xml } = toNoNamespace(xsdText, xmlText);
      result = await mod.validate(xml, xsd);
    }

    return mapResults(result, xmlText);
  }

  dispose(): void {
    // WASM module is shared — nothing to release per instance
  }
}

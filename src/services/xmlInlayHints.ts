import { XMLDocument, XMLNode } from "../parser/xmlNode.js";
import { Position, offsetToPosition } from "../utils/positionUtils.js";
import { Range, containsPosition } from "../utils/rangeUtils.js";

/** A single inlay hint annotation to be rendered inline in the editor. */
export interface InlayHint {
  /** Where to insert the hint label in the document. */
  position: Position;
  /** The text to display, e.g. ": boolean" or "*". */
  label: string;
  /**
   * "type"      → shown after an attribute value to indicate its XSD type.
   * "parameter" → shown before a required attribute name as a marker.
   */
  kind: "type" | "parameter";
  /** Add a space between the hint and the token to its left. */
  paddingLeft: boolean;
}

// XSD primitive types where showing the hint adds no value (too obvious).
const SKIP_TYPES = new Set(["xs:string", "string", "xs:token", "token"]);

function collectElements(root: XMLNode): XMLNode[] {
  const result: XMLNode[] = [];
  function walk(node: XMLNode) {
    if (node.type === "element") result.push(node);
    for (const child of node.children) walk(child);
  }
  walk(root);
  return result;
}

/**
 * Returns inlay hints for the XML document.
 *
 * Two kinds are produced when a schema provider is present:
 *   - Type hints  — `: <xsd-type>` after each attribute value whose type is
 *     not xs:string (string hints are noise — they add nothing for the reader).
 *   - Required hints — `*` before each attribute that the schema marks as required.
 *
 * When no schema provider is available, an empty array is returned because
 * the plain XML tree carries no type information to annotate.
 *
 * Pass a `range` to limit hints to the visible viewport (common in LSP clients
 * that call textDocument/inlayHint with a viewport range).
 */
export function getInlayHints(
  document: XMLDocument,
  schemaProvider?: any,
  range?: Range
): InlayHint[] {
  if (!schemaProvider?.hasData()) return [];

  const hints: InlayHint[] = [];
  const elements = collectElements(document);

  for (const element of elements) {
    if (!element.name || element.attributes.length === 0) continue;

    const elementInfo = schemaProvider.getElement(element.name);
    if (!elementInfo) continue;

    for (const attr of element.attributes) {
      const schemaAttr = elementInfo.attributes.find((a: any) => a.name === attr.name);
      if (!schemaAttr) continue;

      // ── Required hint ────────────────────────────────────────────────────────
      // Place a "*" just before the attribute name so the reader can immediately
      // see which attributes the schema mandates.
      if (schemaAttr.required && attr.nameStart !== undefined) {
        const position = offsetToPosition(document.text, attr.nameStart);
        const hint: InlayHint = { position, label: "*", kind: "parameter", paddingLeft: false };
        if (!range || containsPosition(range, position)) hints.push(hint);
      }

      // ── Type hint ────────────────────────────────────────────────────────────
      // Place ": <type>" right after the closing quote of the attribute value.
      // Skip xs:string — it is the default and adds visual noise.
      if (
        schemaAttr.type &&
        !SKIP_TYPES.has(schemaAttr.type) &&
        attr.valueEnd !== undefined
      ) {
        // valueEnd points at the character after the closing quote.
        const position = offsetToPosition(document.text, attr.valueEnd);
        const label = `: ${schemaAttr.type}`;
        const hint: InlayHint = { position, label, kind: "type", paddingLeft: false };
        if (!range || containsPosition(range, position)) hints.push(hint);
      }
    }
  }

  return hints;
}

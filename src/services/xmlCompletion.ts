import { XMLDocument } from "../parser/xmlNode.js";
import { Position, positionToOffset } from "../utils/positionUtils.js";

/** A single completion suggestion returned to the editor. */
export interface CompletionItem {
  label: string;
  kind: "element" | "attribute" | "value" | "closeTag";
  insertText: string;
  detail?: string;
}

/** A list of completion suggestions for a given cursor position. */
export interface CompletionList {
  items: CompletionItem[];
  isIncomplete: boolean;
}

/**
 * Returns completion suggestions for the given cursor position by detecting whether
 * the cursor is after '<', '</', or inside an attribute list. Uses schema data when
 * available, falling back to document-tree scanning.
 */
export function doComplete(
  document: XMLDocument,
  position: Position,
  schemaProvider?: any
): CompletionList {
  const offset = positionToOffset(document.text, position);
  const textBefore = document.text.substring(0, offset);

  // Context 3: cursor is right after '</'
  if (/<\/$/.test(textBefore)) {
    const node = document.findNodeAt(offset);
    if (node && node.type === "element" && node.name) {
      return {
        items: [{ label: node.name, kind: "closeTag", insertText: `${node.name}>` }],
        isIncomplete: false,
      };
    }
    return { items: [], isIncomplete: false };
  }

  // Context 1: cursor is right after '<' or '<' + partial tag name
  if (/<\w*$/.test(textBefore)) {
    if (schemaProvider?.hasData()) {
      const node = document.findNodeAt(offset);
      // Determine the enclosing element: if findNodeAt returns an element whose
      // parent is also an element, the parent is the context; otherwise the node itself is.
      const parentName: string | undefined =
        node.parent?.type === "element"
          ? node.parent.name
          : node.type === "element"
          ? node.name
          : undefined;

      let names: string[] = parentName ? schemaProvider.getChildren(parentName) : [];
      if (names.length === 0) names = schemaProvider.getAllElements();

      return {
        items: names.map((name: string) => ({
          label: name,
          kind: "element" as const,
          insertText: `${name}>$0</${name}>`,
        })),
        isIncomplete: false,
      };
    }

    // Fallback: scan document tree for known element names
    const names = new Set<string>();
    document.traverse((n) => {
      if (n.type === "element" && n.name) names.add(n.name);
    });
    return {
      items: Array.from(names).map((name) => ({
        label: name,
        kind: "element" as const,
        insertText: `${name}>$0</${name}>`,
      })),
      isIncomplete: false,
    };
  }

  // Context 2: cursor is in an attribute position (after tag name + whitespace)
  if (/\w+\s+\w*$/.test(textBefore)) {
    if (schemaProvider?.hasData()) {
      const node = document.findNodeAt(offset);
      const nodeName: string | undefined =
        node.type === "element" ? node.name : node.parent?.name;

      const schemaAttrs: any[] = nodeName ? schemaProvider.getAttributes(nodeName) : [];
      const schemaAttrNames = new Set<string>(schemaAttrs.map((a: any) => a.name));

      // Collect attributes seen on this element name in the document tree
      const docAttrs = new Set<string>();
      if (nodeName) {
        document.traverse((n) => {
          if (n.type === "element" && n.name === nodeName) {
            for (const a of n.attributes) docAttrs.add(a.name);
          }
        });
      }
      const extraDocAttrs = Array.from(docAttrs).filter((a) => !schemaAttrNames.has(a));

      return {
        items: [
          ...schemaAttrs.map((attr: any) => ({
            label: attr.name,
            kind: "attribute" as const,
            insertText: `${attr.name}="$0"`,
            ...(attr.type ? { detail: attr.type } : {}),
          })),
          ...extraDocAttrs.map((attr) => ({
            label: attr,
            kind: "attribute" as const,
            insertText: `${attr}="$0"`,
          })),
        ],
        isIncomplete: false,
      };
    }

    // Fallback: static common XML attributes
    const attrs = ["xml:lang", "xml:space", "xmlns"];
    return {
      items: attrs.map((attr) => ({
        label: attr,
        kind: "attribute" as const,
        insertText: `${attr}="$0"`,
      })),
      isIncomplete: false,
    };
  }

  return { items: [], isIncomplete: false };
}

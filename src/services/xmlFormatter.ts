import { XMLDocument } from "../parser/xmlNode.js";

/** Options controlling how the formatter re-indents the document. */
export interface FormatterOptions {
  tabSize: number;
  insertSpaces: boolean;
  maxLineLength?: number;
}

/** Represents a replacement of a text range within a document. */
export interface TextEdit {
  startOffset: number;
  endOffset: number;
  newText: string;
}

/**
 * Re-indents the entire XML document by traversing the XML AST and returns
 * a single TextEdit that replaces the full document text with the formatted version.
 * Returns an empty array for empty documents. Does not modify the AST.
 */
export function format(document: XMLDocument, options?: FormatterOptions): TextEdit[] {
  if (!document.text) return [];

  const tabSize = options?.tabSize ?? 2;
  const insertSpaces = options?.insertSpaces ?? true;
  const unit = insertSpaces ? " ".repeat(tabSize) : "\t";
  const output: string[] = [];
  const children = [...document.children].sort((a, b) => a.startOffset - b.startOffset);

  let cursor = 0;
  for (const child of children) {
    appendLooseContent(document.text.slice(cursor, child.startOffset), 0, unit, output);
    formatElement(child, document.text, 0, unit, output);
    cursor = child.endOffset;
  }
  appendLooseContent(document.text.slice(cursor), 0, unit, output);

  return [{ startOffset: 0, endOffset: document.text.length, newText: output.join("\n") }];
}

function formatElement(node: XMLDocument["children"][number], text: string, depth: number, unit: string, output: string[]): void {
  const indent = unit.repeat(depth);
  output.push(indent + buildOpeningTag(node));

  if (node.isSelfClosing) return;

  const startTagEnd = findTagEnd(text, node.startOffset);
  const endTagStart = findEndTagStart(text, node.endOffset);

  const children = [...node.children].sort((a, b) => a.startOffset - b.startOffset);
  let cursor = startTagEnd + 1;

  for (const child of children) {
    appendTextContent(text.slice(cursor, child.startOffset), depth + 1, unit, output);
    formatElement(child, text, depth + 1, unit, output);
    cursor = child.endOffset;
  }

  appendTextContent(text.slice(cursor, endTagStart), depth + 1, unit, output);
  output.push(`${indent}</${node.name}>`);
}

function buildOpeningTag(node: XMLDocument["children"][number]): string {
  const attrs = node.attributes
    .map((attr) => (attr.value === undefined ? attr.name : `${attr.name}="${attr.value}"`))
    .join(" ");
  const attrText = attrs ? ` ${attrs}` : "";
  const close = node.isSelfClosing ? "/>" : ">";
  return `<${node.name}${attrText}${close}`;
}

function findTagEnd(text: string, startOffset: number): number {
  let inQuote = false;

  for (let i = startOffset; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuote = !inQuote;
    if (!inQuote && ch === ">") return i;
  }

  return text.length - 1;
}

function findEndTagStart(text: string, endOffset: number): number {
  const index = text.lastIndexOf("</", Math.max(0, endOffset - 1));
  return index >= 0 ? index : endOffset;
}

function appendLooseContent(segment: string, depth: number, unit: string, output: string[]): void {
  for (const line of segment.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    output.push(unit.repeat(depth) + trimmed);
  }
}

function appendTextContent(segment: string, depth: number, unit: string, output: string[]): void {
  const trimmed = segment.trim();
  if (!trimmed) return;

  for (const line of trimmed.split(/\r?\n/)) {
    const content = line.trim();
    if (!content) continue;
    output.push(unit.repeat(depth) + content);
  }
}

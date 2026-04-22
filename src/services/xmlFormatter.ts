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
 * Re-indents the entire XML document using a simple line-based algorithm and returns
 * a single TextEdit that replaces the full document text with the formatted version.
 * Returns an empty array for empty documents. Does not modify the AST.
 */
export function format(document: XMLDocument, options?: FormatterOptions): TextEdit[] {
  if (!document.text) return [];

  const tabSize = options?.tabSize ?? 2;
  const insertSpaces = options?.insertSpaces ?? true;
  const unit = insertSpaces ? " ".repeat(tabSize) : "\t";

  const lines = document.text.split("\n");
  const output: string[] = [];
  let level = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      output.push("");
      continue;
    }

    if (trimmed.startsWith("</")) {
      level = Math.max(0, level - 1);
      output.push(unit.repeat(level) + trimmed);
    } else if (trimmed.startsWith("<?") || trimmed.startsWith("<!--")) {
      output.push(unit.repeat(level) + trimmed);
    } else if (trimmed.startsWith("<") && !trimmed.endsWith("/>") && !trimmed.includes("</")) {
      output.push(unit.repeat(level) + trimmed);
      level++;
    } else {
      output.push(unit.repeat(level) + trimmed);
    }
  }

  return [{ startOffset: 0, endOffset: document.text.length, newText: output.join("\n") }];
}

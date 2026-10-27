import { XMLNode, XMLAttribute, XMLDocument, SyntaxError } from "./xmlNode.js";
import { collectWellFormednessErrors } from "./wellFormedness.js";
import { offsetToPosition } from "../utils/positionUtils.js";

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function endOfDocument(text: string): { line: number; character: number } {
  return offsetToPosition(text, text.length);
}

export class XMLDocumentImpl implements XMLDocument {
  type: "root" = "root";
  uri: string;
  text: string;
  children: XMLNode[];
  attributes: XMLAttribute[] = [];
  startOffset: number = 0;
  endOffset: number;
  parent: undefined = undefined;
  isSelfClosing: boolean = false;
  name: undefined = undefined;
  syntaxErrors: SyntaxError[];
  readonly rawCST: unknown;

  constructor(uri: string, text: string, cst: any, lexErrors: any[] = [], parseErrors: any[] = []) {
    this.uri = uri;
    this.text = text;
    this.endOffset = text.length;
    this.rawCST = cst;
    this.children = this.buildTree(cst);
    this.syntaxErrors = [
      ...lexErrors.map((e: any) => {
        const start = isFiniteNumber(e.line) && isFiniteNumber(e.column)
          ? { line: Math.max(0, e.line - 1), character: Math.max(0, e.column - 1) }
          : endOfDocument(text);
        const len = isFiniteNumber(e.length) && e.length > 0 ? e.length : 1;
        return {
          message: e.message,
          line: start.line,
          character: start.character,
          endLine: start.line,
          endCharacter: start.character + len,
        };
      }),
      ...parseErrors.map((e: any) => {
        // An error at end of input carries an EOF token whose position is NaN; fall back to the
        // last real token, then to the end of the document.
        const token = [e.token, e.previousToken].find(
          (t) => isFiniteNumber(t?.startLine) && isFiniteNumber(t?.startColumn)
        );
        if (!token) {
          const end = endOfDocument(text);
          return { message: e.message, line: end.line, character: end.character, endLine: end.line, endCharacter: end.character };
        }
        const startLine = Math.max(0, token.startLine - 1);
        const startCol = Math.max(0, token.startColumn - 1);
        const endLine = isFiniteNumber(token.endLine) ? Math.max(0, token.endLine - 1) : startLine;
        const endCol = isFiniteNumber(token.endColumn) ? token.endColumn : startCol + 1;
        return {
          message: e.message,
          line: startLine,
          character: startCol,
          endLine: Math.max(startLine, endLine),
          endCharacter: Math.max(startCol + 1, endCol),
        };
      }),
      ...collectWellFormednessErrors(cst, text),
    ];
  }

  private buildTree(cst: any): XMLNode[] {
    const elements: any[] = cst?.children?.element ?? [];
    return elements.map((element) => this.buildNode(element, this));
  }

  private buildNode(element: any, parent: XMLNode): XMLNode {
    // Chevrotain CST: tag name is in children.Name[0].image, positions in .location
    const nameToken = element?.children?.Name?.[0];
    const isSelfClosing = !element?.children?.SLASH_OPEN?.length;

    const node: XMLNode = {
      type: "element",
      name: nameToken?.image ?? undefined,
      attributes: this.buildAttributes(element?.children?.attribute ?? []),
      children: [],
      startOffset: element?.location?.startOffset ?? 0,
      endOffset: (element?.location?.endOffset ?? 0) + 1,
      parent,
      isSelfClosing,
    };

    // Child elements are nested inside content[0].children.element[]
    const contentElements = element?.children?.content?.[0]?.children?.element ?? [];
    node.children = contentElements.map((child: any) => this.buildNode(child, node));

    return node;
  }

  private buildAttributes(attrs: any[]): XMLAttribute[] {
    return attrs.map((attr: any) => {
      const nameToken = attr?.children?.Name?.[0];
      const valueToken = attr?.children?.STRING?.[0];
      // STRING image includes surrounding quotes, e.g. '"test"'
      const rawValue: string | undefined = valueToken?.image;
      const value = rawValue != null ? rawValue.slice(1, -1) : undefined;

      return {
        name: nameToken?.image ?? "",
        value,
        nameStart: nameToken?.startOffset ?? 0,
        nameEnd: (nameToken?.endOffset ?? 0) + 1,
        valueStart: valueToken != null ? valueToken.startOffset + 1 : undefined,
        valueEnd: valueToken != null ? valueToken.endOffset - 1 : undefined,
      };
    });
  }

  findNodeAt(offset: number): XMLNode {
    return this.findDeepest(this, offset);
  }

  private findDeepest(node: XMLNode, offset: number): XMLNode {
    for (const child of node.children) {
      if (offset >= child.startOffset && offset <= child.endOffset) {
        return this.findDeepest(child, offset);
      }
    }
    return node;
  }

  /**
   * Traverses the entire AST in a depth-first manner.
   * NOTE: This is NOT used for standard operations like finding the current node (which uses offsets).
   * Full traversal is primarily used as a fallback to gather all document elements/attributes 
   * for "smart suggestions" in autocompletion when an XSD schema is unavailable.
   */
  traverse(callback: (node: XMLNode) => void): void {
    this.traverseNode(this, callback);
  }

  private traverseNode(node: XMLNode, callback: (node: XMLNode) => void): void {
    callback(node);
    for (const child of node.children) {
      this.traverseNode(child, callback);
    }
  }
}

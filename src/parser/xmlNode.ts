/** Represents a single attribute on an XML element, including its name and optional value with source offsets. */
export interface XMLAttribute {
  name: string;
  value: string | undefined;
  nameStart: number;
  nameEnd: number;
  valueStart: number | undefined;
  valueEnd: number | undefined;
}

/** Represents a node in the XML parse tree, covering elements, text, comments, and the root. */
export interface XMLNode {
  type: "element" | "text" | "comment" | "root";
  name: string | undefined;
  attributes: XMLAttribute[];
  children: XMLNode[];
  startOffset: number;
  endOffset: number;
  endTagStartOffset?: number;
  parent: XMLNode | undefined;
  isSelfClosing: boolean;
}

/** Represents the root of a parsed XML document, extending XMLNode with document-level metadata. */
export interface XMLDocument extends XMLNode {
  type: "root";
  uri: string;
  text: string;
  findNodeAt(offset: number): XMLNode;
  traverse(callback: (node: XMLNode) => void): void;
}

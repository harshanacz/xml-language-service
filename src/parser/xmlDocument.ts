import { XMLNode, XMLAttribute, XMLDocument } from "./xmlNode";

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

  constructor(uri: string, text: string, cst: any) {
    this.uri = uri;
    this.text = text;
    this.endOffset = text.length;
    this.children = this.buildTree(cst);
  }

  private buildTree(cst: any): XMLNode[] {
    const elements: any[] = cst?.children?.element ?? [];
    return elements.map((element) => this.buildNode(element, this));
  }

  private buildNode(element: any, parent: XMLNode): XMLNode {
    const node: XMLNode = {
      type: "element",
      name: element?.name ?? undefined,
      attributes: this.buildAttributes(element?.attributes ?? []),
      children: [],
      startOffset: element?.position?.startOffset ?? 0,
      endOffset: element?.position?.endOffset ?? 0,
      parent,
      isSelfClosing: !element?.syntax?.closeBody,
    };

    node.children = (element?.subElements ?? []).map((child: any) =>
      this.buildNode(child, node)
    );

    return node;
  }

  private buildAttributes(attrs: any[]): XMLAttribute[] {
    return attrs.map((attr: any) => ({
      name: attr?.key ?? "",
      value: attr?.value ?? undefined,
      nameStart: attr?.syntax?.key?.startOffset ?? 0,
      nameEnd: attr?.syntax?.key?.endOffset ?? 0,
      valueStart: attr?.value != null ? attr?.syntax?.value?.startOffset : undefined,
      valueEnd: attr?.value != null ? attr?.syntax?.value?.endOffset : undefined,
    }));
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

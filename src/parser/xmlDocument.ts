import { XMLNode, XMLAttribute, XMLDocument } from "./xmlNode.js";

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
      endTagStartOffset: element?.children?.SLASH_OPEN?.[0]?.startOffset,
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

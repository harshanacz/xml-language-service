import { parse } from "@xml-tools/parser";

export interface AttributeInfo {
  name: string;
  description: string; // from xs:documentation
  type: string;        // xs:string, xs:boolean, etc.
  required: boolean;   // use="required"
}

export interface ElementInfo {
  name: string;
  description: string;     // from xs:documentation
  attributes: AttributeInfo[];
  children: string[];      // valid child element names
}

export interface SchemaCompletionData {
  elements: Map<string, ElementInfo>; // elementName → ElementInfo
}

export class XsdCompletionProvider {
  private data: SchemaCompletionData;

  constructor(xsdText: string) {
    this.data = { elements: new Map() };
    const { cst } = parse(xsdText);
    this.buildData(cst);
  }

  private buildData(cst: any): void {
    const data = this.data;
    // Maps complexType name → direct child element names, for type-ref resolution.
    const complexTypeChildren = new Map<string, string[]>();
    // Maps element name → type attribute value, for post-walk resolution.
    const elementTypeRefs = new Map<string, string>();

    function getAttrValue(node: any, attrName: string): string {
      for (const attr of node.children?.attribute ?? []) {
        if (attr.children?.Name?.[0]?.image === attrName) {
          const raw: string = attr.children?.STRING?.[0]?.image ?? "";
          return raw.replace(/^["']|["']$/g, "");
        }
      }
      return "";
    }

    function getTextContent(node: any): string {
      const parts: string[] = [];
      for (const content of node.children?.content ?? []) {
        for (const chardata of content.children?.chardata ?? []) {
          const text: string = chardata.children?.TEXT?.[0]?.image ?? "";
          if (text) parts.push(text);
        }
      }
      return parts.join("").trim();
    }

    function getTagName(node: any): string {
      return node.children?.Name?.[0]?.image ?? "";
    }

    function isXsdTag(tagName: string, localName: string): boolean {
      return tagName === localName || tagName.endsWith(":" + localName);
    }

    function findDocumentation(node: any): string {
      for (const content of node.children?.content ?? []) {
        for (const child of content.children?.element ?? []) {
          const childTag = getTagName(child);
          if (isXsdTag(childTag, "annotation")) {
            for (const annContent of child.children?.content ?? []) {
              for (const docNode of annContent.children?.element ?? []) {
                if (isXsdTag(getTagName(docNode), "documentation")) {
                  return getTextContent(docNode);
                }
              }
            }
          }
        }
      }
      return "";
    }

    // Collects the names of xs:element children reachable through
    // xs:sequence / xs:all / xs:choice inside `node` (one level of elements only).
    function collectDirectElementNames(node: any): string[] {
      const names: string[] = [];
      function collect(n: any): void {
        const tag = getTagName(n);
        if (isXsdTag(tag, "element")) {
          const childName = getAttrValue(n, "name") || getAttrValue(n, "ref");
          if (childName && !names.includes(childName)) names.push(childName);
        } else if (
          isXsdTag(tag, "sequence") ||
          isXsdTag(tag, "all") ||
          isXsdTag(tag, "choice")
        ) {
          for (const content of n.children?.content ?? []) {
            for (const child of content.children?.element ?? []) {
              collect(child);
            }
          }
        }
      }
      for (const content of node.children?.content ?? []) {
        for (const child of content.children?.element ?? []) {
          collect(child);
        }
      }
      return names;
    }

    function walk(node: any, parentElementName: string | null): void {
      const tagName = getTagName(node);

      if (isXsdTag(tagName, "element")) {
        const name = getAttrValue(node, "name");
        const ref  = getAttrValue(node, "ref");

        // ref-only element: wire it to the parent without declaring a new element.
        if (!name && ref) {
          if (parentElementName !== null) {
            const parent = data.elements.get(parentElementName);
            if (parent && !parent.children.includes(ref)) {
              parent.children.push(ref);
            }
          }
          return;
        }

        if (!name) {
          recurseChildren(node, parentElementName);
          return;
        }

        if (!data.elements.has(name)) {
          data.elements.set(name, {
            name,
            description: findDocumentation(node),
            attributes: [],
            children: [],
          });
        }

        // Record any type reference for post-walk resolution.
        const typeRef = getAttrValue(node, "type");
        if (typeRef) elementTypeRefs.set(name, typeRef);

        if (parentElementName !== null) {
          const parent = data.elements.get(parentElementName);
          if (parent && !parent.children.includes(name)) {
            parent.children.push(name);
          }
        }

        recurseChildren(node, name);
      } else if (isXsdTag(tagName, "attribute")) {
        const name = getAttrValue(node, "name");
        if (name && parentElementName !== null) {
          const parent = data.elements.get(parentElementName);
          if (parent && !parent.attributes.find((a) => a.name === name)) {
            parent.attributes.push({
              name,
              description: findDocumentation(node),
              type: getAttrValue(node, "type"),
              required: getAttrValue(node, "use") === "required",
            });
          }
        }
        recurseChildren(node, parentElementName);
      } else if (isXsdTag(tagName, "complexType")) {
        // Top-level named complexType: snapshot its direct element children so
        // xs:element type="X" declarations can be resolved after the walk.
        const typeName = getAttrValue(node, "name");
        if (typeName && parentElementName === null) {
          complexTypeChildren.set(typeName, collectDirectElementNames(node));
        }
        // Always pass the current parent element name through.
        recurseChildren(node, parentElementName);
      } else if (
        isXsdTag(tagName, "sequence") ||
        isXsdTag(tagName, "all") ||
        isXsdTag(tagName, "choice")
      ) {
        // Pass the current parent element name down into group containers.
        recurseChildren(node, parentElementName);
      } else {
        recurseChildren(node, parentElementName);
      }
    }

    function recurseChildren(node: any, parentElementName: string | null): void {
      for (const content of node.children?.content ?? []) {
        for (const child of content.children?.element ?? []) {
          walk(child, parentElementName);
        }
      }
    }

    // Enter from document root → schema element → top-level XSD declarations
    for (const rootEl of cst.children?.element ?? []) {
      for (const content of rootEl.children?.content ?? []) {
        for (const child of content.children?.element ?? []) {
          walk(child, null);
        }
      }
    }

    // Resolve xs:element type="X" references to xs:complexType name="X".
    // This connects elements like <xs:element name="project" type="Model"> to
    // the children collected from <xs:complexType name="Model">.
    for (const [elementName, typeRef] of elementTypeRefs) {
      const localType = typeRef.includes(":") ? typeRef.split(":").pop()! : typeRef;
      const children = complexTypeChildren.get(localType);
      if (!children) continue;
      const element = data.elements.get(elementName);
      if (!element) continue;
      for (const childName of children) {
        if (!element.children.includes(childName)) {
          element.children.push(childName);
        }
      }
    }
  }

  /** Returns the ElementInfo for the given element name, or undefined if not found. */
  getElement(name: string): ElementInfo | undefined {
    return this.data.elements.get(name);
  }

  /** Returns all known element names extracted from the schema. */
  getAllElements(): string[] {
    return Array.from(this.data.elements.keys());
  }

  /** Returns valid child element names for the given parent element. */
  getChildren(elementName: string): string[] {
    return this.data.elements.get(elementName)?.children ?? [];
  }

  /** Returns attribute definitions for the given element. */
  getAttributes(elementName: string): AttributeInfo[] {
    return this.data.elements.get(elementName)?.attributes ?? [];
  }

  /** Returns the xs:documentation description for the given element, or empty string. */
  getDescription(elementName: string): string {
    return this.data.elements.get(elementName)?.description ?? "";
  }

  /** Returns true if at least one element was extracted from the schema. */
  hasData(): boolean {
    return this.data.elements.size > 0;
  }
}

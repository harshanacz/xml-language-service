import { describe, it, expect } from "vitest";
import { XsdCompletionProvider } from "../../src/schema/xsdCompletionProvider.js";

const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
           targetNamespace="http://test.com">
  <xs:element name="root">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="child"/>
        <xs:element name="item"/>
      </xs:sequence>
      <xs:attribute name="id" type="xs:string" use="required"/>
      <xs:attribute name="class" type="xs:string"/>
    </xs:complexType>
  </xs:element>
  <xs:element name="child">
    <xs:complexType>
      <xs:attribute name="name" type="xs:string"/>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

describe("XsdCompletionProvider", () => {
  const provider = new XsdCompletionProvider(xsd);

  it("creates without throwing", () => {
    expect(() => new XsdCompletionProvider(xsd)).not.toThrow();
  });

  it("hasData() returns true", () => {
    expect(provider.hasData()).toBe(true);
  });

  it("getAllElements() includes 'root' and 'child'", () => {
    const elements = provider.getAllElements();
    expect(elements).toContain("root");
    expect(elements).toContain("child");
  });

  it("getChildren('root') includes 'child' and 'item'", () => {
    const children = provider.getChildren("root");
    expect(children).toContain("child");
    expect(children).toContain("item");
  });

  it("getAttributes('root') contains an attribute named 'id'", () => {
    const attrs = provider.getAttributes("root");
    const idAttr = attrs.find((a) => a.name === "id");
    expect(idAttr).toBeDefined();
  });

  it("getAttributes('root') — 'id' attribute has required: true", () => {
    const attrs = provider.getAttributes("root");
    const idAttr = attrs.find((a) => a.name === "id");
    expect(idAttr?.required).toBe(true);
  });

  it("getAttributes('root') — 'class' attribute has required: false", () => {
    const attrs = provider.getAttributes("root");
    const classAttr = attrs.find((a) => a.name === "class");
    expect(classAttr).toBeDefined();
    expect(classAttr?.required).toBe(false);
  });

  it("getAttributes('child') contains a 'name' attribute", () => {
    const attrs = provider.getAttributes("child");
    const nameAttr = attrs.find((a) => a.name === "name");
    expect(nameAttr).toBeDefined();
  });

  it("getElement('unknown') returns undefined", () => {
    expect(provider.getElement("unknown")).toBeUndefined();
  });

  it("getChildren('unknown') returns []", () => {
    expect(provider.getChildren("unknown")).toEqual([]);
  });
});

// -------------------------------------------------------------------
// Walk-function correctness: patterns from the fix strategy
// -------------------------------------------------------------------

describe("XsdCompletionProvider — deep nesting (inline complexTypes)", () => {
  const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="project">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="groupId"/>
        <xs:element name="dependencies">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="dependency">
                <xs:complexType>
                  <xs:sequence>
                    <xs:element name="artifactId"/>
                    <xs:element name="version"/>
                  </xs:sequence>
                </xs:complexType>
              </xs:element>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;
  const p = new XsdCompletionProvider(xsd);

  it("project children include groupId and dependencies", () => {
    expect(p.getChildren("project")).toContain("groupId");
    expect(p.getChildren("project")).toContain("dependencies");
  });

  it("dependencies children include dependency", () => {
    expect(p.getChildren("dependencies")).toContain("dependency");
  });

  it("dependency children include artifactId and version", () => {
    expect(p.getChildren("dependency")).toContain("artifactId");
    expect(p.getChildren("dependency")).toContain("version");
  });

  it("groupId is not a child of dependencies or dependency", () => {
    expect(p.getChildren("dependencies")).not.toContain("groupId");
    expect(p.getChildren("dependency")).not.toContain("groupId");
  });
});

describe("XsdCompletionProvider — named complexType with type references", () => {
  const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="project" type="ProjectType"/>
  <xs:complexType name="ProjectType">
    <xs:sequence>
      <xs:element name="groupId"/>
      <xs:element name="dependencies" type="DependenciesType"/>
    </xs:sequence>
  </xs:complexType>
  <xs:complexType name="DependenciesType">
    <xs:sequence>
      <xs:element ref="dependency"/>
    </xs:sequence>
  </xs:complexType>
  <xs:element name="dependency">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="artifactId"/>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;
  const p = new XsdCompletionProvider(xsd);

  it("project children resolved via type reference", () => {
    expect(p.getChildren("project")).toContain("groupId");
    expect(p.getChildren("project")).toContain("dependencies");
  });

  it("dependencies children resolved via ref attribute", () => {
    expect(p.getChildren("dependencies")).toContain("dependency");
  });

  it("dependency children resolved correctly", () => {
    expect(p.getChildren("dependency")).toContain("artifactId");
  });
});

describe("XsdCompletionProvider — xs:choice inside xs:sequence", () => {
  const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="root">
    <xs:complexType>
      <xs:sequence>
        <xs:choice>
          <xs:element name="option1"/>
          <xs:element name="option2"/>
        </xs:choice>
        <xs:element name="always"/>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;
  const p = new XsdCompletionProvider(xsd);

  it("root children include both choice options and the unconditional element", () => {
    expect(p.getChildren("root")).toContain("option1");
    expect(p.getChildren("root")).toContain("option2");
    expect(p.getChildren("root")).toContain("always");
  });
});

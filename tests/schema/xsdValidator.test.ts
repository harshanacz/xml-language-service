import { describe, it, expect, beforeAll } from "vitest";
import { XsdValidatorService, Diagnostic } from "../../src/schema/xsdValidator.js";

const simpleXsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="root">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="child" type="xs:string" minOccurs="0"/>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

const validXml = `<?xml version="1.0"?><root><child>hello</child></root>`;
const invalidXml = `<?xml version="1.0"?><root><unknown>hello</unknown></root>`;
const brokenXml = `<root><unclosed>`;

describe("XsdValidatorService.create()", () => {
  it("resolves without throwing for a valid XSD", async () => {
    await expect(XsdValidatorService.create(simpleXsd)).resolves.toBeDefined();
  });
});

describe("XsdValidatorService.validate()", () => {
  let validator: XsdValidatorService;

  beforeAll(async () => {
    validator = await XsdValidatorService.create(simpleXsd);
  });

  it("returns an empty array for a valid document", async () => {
    const result = await validator.validate(validXml);
    expect(result).toEqual([]);
  });

  it("returns at least one Diagnostic for an invalid document", async () => {
    const result = await validator.validate(invalidXml);
    expect(result.length).toBeGreaterThan(0);
  });

  it("all diagnostics have severity 'error' or 'warning'", async () => {
    const result = await validator.validate(invalidXml);
    for (const d of result) {
      expect(["error", "warning"]).toContain(d.severity);
    }
  });

  it("all diagnostics have a non-empty message string", async () => {
    const result = await validator.validate(invalidXml);
    for (const d of result) {
      expect(typeof d.message).toBe("string");
      expect(d.message.length).toBeGreaterThan(0);
    }
  });

  it("all diagnostics have source === 'xsd'", async () => {
    const result = await validator.validate(invalidXml);
    for (const d of result) {
      expect(d.source).toBe("xsd");
    }
  });

  it("returns an array (not throws) for broken XML", async () => {
    await expect(validator.validate(brokenXml)).resolves.toBeInstanceOf(Array);
  });

  it("broken XML diagnostics have source === 'xsd'", async () => {
    const result = await validator.validate(brokenXml);
    for (const d of result) {
      expect(d.source).toBe("xsd");
    }
  });

  it("dispose() does not throw", () => {
    expect(() => validator.dispose()).not.toThrow();
  });
});

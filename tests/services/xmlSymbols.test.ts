import { describe, it, expect } from "vitest";
import { parseXMLDocument } from "../../src/parser/xmlParser.js";
import { findDocumentSymbols, DocumentSymbol } from "../../src/services/xmlSymbols.js";

const xml = `<root>
  <child name="test">
    <grandchild/>
  </child>
</root>`;

describe("findDocumentSymbols", () => {
  const doc = parseXMLDocument("file:///test.xml", xml);
  const symbols = findDocumentSymbols(doc);

  it("returns array with one top-level symbol", () => {
    expect(symbols).toHaveLength(1);
  });

  it("top-level symbol name is 'root'", () => {
    expect(symbols[0].name).toBe("root");
  });

  it("root has one child symbol named 'child'", () => {
    expect(symbols[0].children).toHaveLength(1);
    expect(symbols[0].children[0].name).toBe("child");
  });

  it("child has one child symbol named 'grandchild'", () => {
    expect(symbols[0].children[0].children).toHaveLength(1);
    expect(symbols[0].children[0].children[0].name).toBe("grandchild");
  });

  it("grandchild has no children", () => {
    expect(symbols[0].children[0].children[0].children).toHaveLength(0);
  });

  it("all symbols have valid range with start before or at end", () => {
    function checkRanges(syms: DocumentSymbol[]): void {
      for (const sym of syms) {
        const { start, end } = sym.range;
        const startsBefore =
          start.line < end.line ||
          (start.line === end.line && start.character <= end.character);
        expect(startsBefore).toBe(true);
        checkRanges(sym.children);
      }
    }
    checkRanges(symbols);
  });

  it("all symbols have kind 'element'", () => {
    function checkKind(syms: DocumentSymbol[]): void {
      for (const sym of syms) {
        expect(sym.kind).toBe("element");
        checkKind(sym.children);
      }
    }
    checkKind(symbols);
  });
});

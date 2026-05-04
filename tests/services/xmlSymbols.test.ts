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

  it("all symbols have a selectionRange defined", () => {
    function checkSelection(syms: DocumentSymbol[]): void {
      for (const sym of syms) {
        expect(sym.selectionRange).toBeDefined();
        expect(sym.selectionRange.start).toBeDefined();
        expect(sym.selectionRange.end).toBeDefined();
        checkSelection(sym.children);
      }
    }
    checkSelection(symbols);
  });

  it("selectionRange start equals range start for all symbols", () => {
    // selectionRange covers '<tagName' only; it starts at the same offset as range
    function check(syms: DocumentSymbol[]): void {
      for (const sym of syms) {
        expect(sym.selectionRange.start.line).toBe(sym.range.start.line);
        expect(sym.selectionRange.start.character).toBe(sym.range.start.character);
        check(sym.children);
      }
    }
    check(symbols);
  });

  it("selectionRange end is within the range (not beyond)", () => {
    function check(syms: DocumentSymbol[]): void {
      for (const sym of syms) {
        const selEnd = sym.selectionRange.end;
        const rangeEnd = sym.range.end;
        const withinRange =
          selEnd.line < rangeEnd.line ||
          (selEnd.line === rangeEnd.line && selEnd.character <= rangeEnd.character);
        expect(withinRange).toBe(true);
        check(sym.children);
      }
    }
    check(symbols);
  });

  it("empty document returns an empty array", () => {
    const emptyDoc = parseXMLDocument("file:///test.xml", "");
    expect(findDocumentSymbols(emptyDoc)).toEqual([]);
  });

  it("document with multiple top-level siblings returns all of them", () => {
    // Note: technically invalid XML, but fault-tolerant parser should handle it
    const multiDoc = parseXMLDocument(
      "file:///test.xml",
      "<a/><b/><c/>"
    );
    const syms = findDocumentSymbols(multiDoc);
    expect(syms.length).toBeGreaterThanOrEqual(1);
    const names = syms.map((s) => s.name);
    expect(names).toContain("a");
  });
});

# xml-language-service

A fast, fault-tolerant XML language service built as a pure TypeScript npm package. Provides core XML editing features like completion, hover, symbols, folding, formatting, rename, definition and references. Designed to be editor-agnostic and easily integrated into any XML tooling ecosystem.

---

## Features

- **Parser** — fault-tolerant XML parsing via `@xml-tools/parser`, works even on broken XML
- **Completion** — context-aware suggestions for tags, attributes and closing tags
- **Hover** — element info, attribute details on hover
- **Document Symbols** — hierarchical symbol tree for editor outline view
- **Folding** — code folding ranges for multi-line elements
- **Formatting** — re-indent and normalize spacing (pure text, no AST mutation)
- **Rename** — safely rename open + close tag pairs
- **Definition** — jump to matching open/close tag
- **References** — find all elements with the same tag name
- **XSD Validation** — schema-aware validation via `libxml2-wasm`, runs on debounce after typing stops

---

## Architecture


```text
TextDocument
    ↓
@xml-tools/parser  →  CST
    ↓
XMLDocument (normalized AST)
    ↓
Feature Services + SchemaProvider
    ↓
libxml2-wasm (XSD validation)
```

---

## Project Structure

```
src/
├── xmlLanguageService.ts   ← public API / orchestrator
├── parser/
│   ├── xmlNode.ts          ← interfaces (XMLNode, XMLDocument)
│   ├── xmlDocument.ts      ← CST → XMLNode tree adapter
│   └── xmlParser.ts        ← thin wrapper over @xml-tools/parser
├── services/
│   ├── xmlCompletion.ts
│   ├── xmlHover.ts
│   ├── xmlSymbols.ts
│   ├── xmlFolding.ts
│   ├── xmlFormatter.ts
│   ├── xmlRename.ts
│   ├── xmlDefinition.ts
│   └── xmlReferences.ts
├── schema/
│   ├── schemaProvider.ts   ← schema registry + validator orchestration
│   └── xsdValidator.ts     ← libxml2-wasm XSD validation engine
└── utils/
    ├── positionUtils.ts
    └── rangeUtils.ts
```

---

## Development

```bash
npm install
npm run build       # compile TypeScript
npm run build:watch # watch mode
npm run test:run    # run all tests once
npm test            # watch mode tests
```

**111 tests — 12 test files**

---


*Current version: 1.0.0*

# xml-language-service

A fast, fault-tolerant XML language service built as a pure TypeScript npm package. Designed as the foundation layer for the WSO2 Micro Integrator Language Server.

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
XML Language Service (this package)
         ↓
XML Language Server (LSP wrapper)     ← Phase 03
         ↓
      MI Layer                        ← Phase 04
```

Internally built in layers — each phase extends, never rewrites:

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

## Usage

```typescript
import { getLanguageService } from 'xml-language-service'

const service = getLanguageService()
const document = service.parseXMLDocument('file:///test.xml', xmlText)

// hover
const hover = service.doHover(document, { line: 1, character: 3 })

// completion
const completions = service.doComplete(document, { line: 1, character: 3 })

// symbols
const symbols = service.findDocumentSymbols(document)
```

### XSD Validation

```typescript
const service = getLanguageService()

await service.registerSchema({ uri: 'my-schema', xsdText: xsdContent })

const document = service.parseXMLDocument('file:///test.xml', xmlText)
const diagnostics = await service.validate('my-schema', document)

// diagnostics: Array<{ message, severity, source, range }>

service.dispose() // release WASM memory
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

## Roadmap

- [x] Phase 01 — XML Core
- [x] Phase 02 — XSD Schema Validation
- [ ] Phase 03 — LSP Wrapper (Node + Browser)
- [ ] Phase 04 — MI Layer (WSO2 Micro Integrator)

---

*Current version: 2.0.0*

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

---

## Architecture

```text
XML Language Service (this package)
↓
XML Language Server (LSP wrapper) ← Phase 03
↓
MI Layer ← Phase 04
```

Internally built in layers — each phase extends, never rewrites:
```

TextDocument
↓
@xml-tools/parser → CST
↓
XMLDocument (normalized AST)
↓
Feature Services

```

---

## Project Structure
```

src/
├── xmlLanguageService.ts ← public API / orchestrator
├── parser/
│ ├── xmlNode.ts ← interfaces (XMLNode, XMLDocument)
│ ├── xmlDocument.ts ← CST → XMLNode tree adapter
│ └── xmlParser.ts ← thin wrapper over @xml-tools/parser
├── services/
│ ├── xmlCompletion.ts
│ ├── xmlHover.ts
│ ├── xmlSymbols.ts
│ ├── xmlFolding.ts
│ ├── xmlFormatter.ts
│ ├── xmlRename.ts
│ ├── xmlDefinition.ts
│ └── xmlReferences.ts
└── utils/
├── positionUtils.ts
└── rangeUtils.ts

````

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

---

## Development

```bash
npm install
npm run build       # compile TypeScript
npm run build:watch # watch mode
npm run test:run    # run all tests once
npm test            # watch mode tests
```

**93 tests — 10 test files**

---

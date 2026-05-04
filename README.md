# xml-language-service

A pure TypeScript XML language service — no Java, no heavy runtime. Drop it into any editor extension or tooling pipeline and get full XML editing support plus XSD validation out of the box.

The interesting part: XSD validation is powered by **Apache Xerces-C++ compiled to WebAssembly**. We compiled the battle-tested Xerces C++ library to WASM using Emscripten, then wrote a thin JS bridge on top. Because Xerces uses a SAX streaming parser, it validates as it reads — so you get both syntax errors and schema violations in the same pass, even on broken or incomplete XML. Most XML validators (including libxml2-wasm, which we replaced) require the document to be fully parsed before validation can run, making them useless on malformed files.

---

## Features

| Feature | What it does |
|---|---|
| **Parser** | Fault-tolerant — builds a partial tree even on broken XML, never crashes |
| **Completion** | Tag, attribute and closing-tag suggestions; XSD-aware when a schema is loaded |
| **Hover** | Element description, valid children and attributes from the XSD |
| **Document Symbols** | Hierarchical outline for the editor sidebar |
| **Folding** | Collapsible regions for multi-line elements |
| **Formatting** | Re-indent and normalize spacing |
| **Rename** | Renames open + close tag pair atomically |
| **Definition** | Jump between matching open/close tags |
| **References** | Find all elements with the same tag name |
| **XSD Validation** | Syntax + schema errors in one pass via Xerces WASM, works on malformed XML |

---

## XSD Validation

### How it works

Xerces streams through the raw XML text character by character with schema validation enabled. Errors are collected as they are encountered — the parse never needs to finish for errors to be reported.

```
raw XML text
    ↓
Xerces SAX stream (parsing + schema validation simultaneously)
    ↓
syntax errors  →  source: "syntax"
schema errors  →  source: "xsd"
```

### Behaviour by scenario

| Scenario | syntax errors | schema errors |
|---|---|---|
| Valid XML | none | none |
| Schema violations only | none | all violations |
| Syntax error only | fatal error reported | none — parse stopped |
| Schema error then syntax error | fatal error reported | errors up to the crash point |

Xerces stops at the first fatal syntax error. Everything before that point is reported — both syntax and schema errors together.

### Single XSD

```typescript
const service = getLanguageService();

await service.registerSchema({
  uri:     "file:///my-schema.xsd",
  xsdText: xsdContent,
});

const doc    = service.parseXMLDocument("file:///my-file.xml", xmlText);
const errors = await service.validate("file:///my-schema.xsd", doc);
```

### Multi-file XSD (xs:include / xs:import)

Pass a `SchemaBundle` when your XSD references other files via `xs:include` or `xs:import`. The `imports` keys must match the `schemaLocation` values used inside the XSD.

```typescript
await service.registerSchema({
  uri:     "file:///root.xsd",
  xsdText: rootXsdContent,
  imports: {
    "types.xsd":  typesXsdContent,   // <xs:include schemaLocation="types.xsd"/>
    "common.xsd": commonXsdContent,  // <xs:import  schemaLocation="common.xsd"/>
  },
});
```

### Built-in schemas

The service ships with schemas for common file types and auto-associates them by filename or `xmlns` namespace — no registration needed.

| File | Schema |
|---|---|
| `pom.xml` | Maven 4.0.0 |
| `web.xml` | Java Servlet 3.1 |

Custom schemas and patterns can be registered with `addUserAssociation()`.

---

## Architecture

```
TextDocument
    ↓
@xml-tools/parser  →  CST  (fault-tolerant, works on broken XML)
    ↓
XMLDocument  (normalized node tree)
    ↓
Feature Services  (completion, hover, symbols, folding, …)
SchemaProvider    (schema registry + validation orchestration)
    ↓
Xerces-C++ WASM   (SAX parse + XSD validation in one pass)
```

---

## Project Structure

```
src/
├── index.ts                     ← public API (barrel)
├── xmlLanguageService.ts        ← service factory / orchestrator
├── parser/
│   ├── xmlNode.ts               ← XMLNode / XMLDocument interfaces
│   ├── xmlDocument.ts           ← CST → node tree
│   └── xmlParser.ts             ← @xml-tools/parser wrapper
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
│   ├── schemaProvider.ts        ← schema registry + orchestration
│   ├── xsdValidator.ts          ← Xerces WASM wrapper
│   ├── xsdCompletionProvider.ts ← XSD-aware completions/hover
│   └── schemaAssociator.ts      ← filename/namespace → schema mapping
├── resources/
│   └── default/                 ← built-in XSD files
├── xerces-wasm/
│   ├── xerces_validator.js      ← Emscripten-generated JS glue
│   └── xerces_validator.wasm    ← compiled Xerces-C++
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

**208 tests — 16 test files**

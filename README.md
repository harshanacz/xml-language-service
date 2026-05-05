# xml-language-service

<p align="center">
  <a href="https://www.npmjs.com/package/xml-language-service">
    <img src="https://img.shields.io/npm/v/xml-language-service?logo=npm&label=npm" alt="npm package" />
  </a>
  <a href="https://www.npmjs.com/package/xml-language-service">
    <img src="https://img.shields.io/npm/dm/xml-language-service?logo=npm&label=downloads" alt="npm downloads" />
  </a>
  <a href="https://github.com/harshanacz/xml-language-service/blob/main/LICENSE">
    <img src="https://img.shields.io/npm/l/xml-language-service" alt="license" />
  </a>
  <img src="https://img.shields.io/node/v/xml-language-service" alt="node version" />
</p>

Editor-agnostic XML language service for JavaScript and TypeScript projects. It gives you fault-tolerant XML parsing, completions, hover text, document symbols, folding, formatting, rename, definition, references, and XSD validation powered by Apache Xerces-C++ compiled to WebAssembly.

Use it in editor extensions, language servers, CLIs, web tooling, test utilities, or any project that needs XML intelligence without a Java runtime or native installation step.

## Links

| Resource | URL |
| --- | --- |
| npm package | https://www.npmjs.com/package/xml-language-service |
| Documentation | https://harshanacz.github.io/xml-language-service/ |
| Repository | https://github.com/harshanacz/xml-language-service |
| Issues | https://github.com/harshanacz/xml-language-service/issues |

## Install

```bash
npm install xml-language-service
```

Requirements:

- Node.js 18 or newer
- ESM-compatible project setup

The npm package includes the Xerces WASM assets, so consumers do not need to install Java, Xerces, Emscripten, or a native compiler.

## Quick Start

```typescript
import { getLanguageService } from "xml-language-service";

const service = getLanguageService();

const xml = `<catalog>
  <book id="bk101">
    <title>XML Developer Guide</title>
  </book>
</catalog>`;

const document = service.parseXMLDocument("file:///catalog.xml", xml);

const completions = service.doComplete(document, { line: 1, character: 4 });
const hover = service.doHover(document, { line: 2, character: 6 });
const symbols = service.findDocumentSymbols(document);
const foldingRanges = service.getFoldingRanges(document);

console.log(completions.items);
console.log(hover);
console.log(symbols);
console.log(foldingRanges);

service.dispose();
```

## What You Get

| Feature | Description |
| --- | --- |
| Fault-tolerant parser | Builds a usable partial tree even when the XML is incomplete or malformed. |
| Completion | Suggests element names, attributes, and closing tags. Can become XSD-aware when a schema is registered. |
| Hover | Returns contextual information for XML elements, comments, and schema-backed nodes. |
| Document symbols | Produces a hierarchical outline for editor sidebars and navigation views. |
| Folding | Finds multi-line XML regions that can be collapsed. |
| Formatting | Returns text edits for consistent XML indentation and spacing. |
| Rename | Renames matching opening and closing tags together. |
| Definition | Jumps between matching opening and closing tags. |
| References | Finds elements with the same tag name in the document. |
| XSD validation | Reports syntax and schema diagnostics through Xerces-C++ WASM. |
| AST/CST printer | Prints parser output as a tree or JSON for debugging and snapshot tests. |

## Public API

The main entry point is `getLanguageService()`.

```typescript
import { getLanguageService } from "xml-language-service";

const service = getLanguageService();
```

Common service methods:

| Method | Purpose |
| --- | --- |
| `parseXMLDocument(uri, text)` | Parse XML text into an `XMLDocument`. |
| `doComplete(document, position, fileName?, documentPath?)` | Get completion items. |
| `doHover(document, position, fileName?, documentPath?)` | Get hover content. |
| `findDocumentSymbols(document)` | Get a nested document symbol tree. |
| `getFoldingRanges(document)` | Get folding ranges. |
| `format(document, options?)` | Get formatting text edits. |
| `doRename(document, position, newName)` | Rename an element tag pair. |
| `doDefinition(document, position)` | Find the matching tag definition. |
| `findReferences(document, position)` | Find same-name element references. |
| `registerSchema(schema)` | Register an XSD schema or schema bundle. |
| `validate(schemaUri, document)` | Validate a parsed document against a registered schema. |
| `addUserAssociation(association)` | Associate schemas with file names, paths, or namespaces. |
| `printTreeAST(document)` | Print the AST as a visual text tree (`├──`, `└──`). |
| `printAST(document, options?)` | Print the parsed AST for debugging. |
| `printCST(document, options?)` | Print the raw CST for debugging. |
| `dispose()` | Release schema provider resources. |

The package also exports core types such as `XMLDocument`, `XMLNode`, `XMLAttribute`, `Position`, `Range`, `Diagnostic`, `SchemaBundle`, `CompletionItem`, `HoverResult`, `DocumentSymbol`, `FoldingRange`, and `TextEdit`.

## XSD Validation

XSD validation is handled by Apache Xerces-C++ compiled to WebAssembly. Xerces uses a SAX streaming parser, so parsing and schema validation happen in the same pass.

```text
raw XML text
    |
    v
Xerces SAX stream
    |
    +-- syntax diagnostics
    +-- XSD diagnostics
```

This matters because diagnostics can still be reported for the part of the document Xerces was able to read before a fatal syntax error.

### Register A Single XSD

```typescript
const service = getLanguageService();

await service.registerSchema({
  uri: "file:///schema.xsd",
  xsdText: xsdContent,
});

const document = service.parseXMLDocument("file:///catalog.xml", xmlText);
const diagnostics = await service.validate("file:///schema.xsd", document);
```

### Register A Schema Bundle

Use a `SchemaBundle` when the root schema references other files with `xs:include` or `xs:import`. The `imports` keys should match the `schemaLocation` values used inside the XSD.

```typescript
await service.registerSchema({
  uri: "file:///root.xsd",
  xsdText: rootXsdContent,
  imports: {
    "types.xsd": typesXsdContent,
    "common.xsd": commonXsdContent,
  },
});
```

### Built-In Schemas

The service ships with built-in schemas for common XML files and can associate them automatically by filename or namespace.

| File | Schema |
| --- | --- |
| `pom.xml` | Maven 4.0.0 |
| `web.xml` | Java Servlet 3.1 |

You can register additional associations with `addUserAssociation()`.

## Debugging AST And CST Output

Three functions let you inspect parser output, create snapshot tests, or understand the tree structure of any XML document.

```typescript
import { getLanguageService } from "xml-language-service";

const service = getLanguageService();
const document = service.parseXMLDocument(
  "file:///catalog.xml",
  `<catalog><book id="bk101"/></catalog>`,
);

// Visual text tree — quick structural overview
console.log(service.printTreeAST(document));
// Document
// └── catalog
//     └── book

// Full AST — includes attributes, text and comment nodes
console.log(service.printAST(document));
console.log(service.printAST(document, { includePositions: true }));
console.log(service.printAST(document, { format: "json" }));

// Raw CST — every grammar rule and token produced by the parser
console.log(service.printCST(document));
```

`printAST` and `printCST` accept these options:

| Option | Type | Default |
| --- | --- | --- |
| `format` | `"tree" \| "json"` | `"tree"` |
| `indent` | `number` | `2` |
| `includePositions` | `boolean` | `false` |
| `includeTokens` | `boolean` | `true` |

### Manual Debug Script

A ready-made script at `tests/utils/manual.mjs` exercises all three printers against a sample XML document. Run it directly with Node — no test runner needed:

```bash
npm run build
node tests/utils/manual.mjs
```

## Architecture

```text
TextDocument
    |
    v
@xml-tools/parser
    |
    v
XMLDocument
    |
    +-- completion
    +-- hover
    +-- symbols
    +-- folding
    +-- formatting
    +-- rename
    +-- definition
    +-- references
    |
    v
SchemaProvider
    |
    v
Xerces-C++ WASM
```

## Development

```bash
npm install
npm run build
npm run build:watch
npm run test:run
npm test
```

Useful scripts:

| Script | Description |
| --- | --- |
| `npm run build` | Compile TypeScript and copy schema/WASM assets into `dist`. |
| `npm run build:watch` | Compile TypeScript in watch mode. |
| `npm run test:run` | Run the Vitest suite once. |
| `npm test` | Run Vitest in watch mode. |

## License

Apache-2.0

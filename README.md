# xml-language-service
## Pure TypeScript (No Java dependencies)

A fast, fault-tolerant XML language service built as a pure TypeScript npm package. Provides core XML editing features like completion, hover, symbols, folding, formatting, rename, definition and references. Designed to be editor-agnostic and easily integrated into any XML tooling ecosystem.

---

## XML Language Service Core Features (SUMMARY)

- **Parser** — fault-tolerant XML parsing via `@xml-tools/parser`, works even on broken XML
- **Completion** — context-aware suggestions for tags, attributes and closing tags
- **Hover** — element info, attribute details on hover
- **Document Symbols** — hierarchical symbol tree for editor outline view
- **Folding** — code folding ranges for multi-line elements
- **Formatting** — re-indent and normalize spacing (pure text, no AST mutation)
- **Rename** — safely rename open + close tag pairs
- **Definition** — jump to matching open/close tag
- **References** — find all elements with the same tag name
- **XSD Validation** — schema-aware validation via Apache Xerces-C++ compiled to WebAssembly; reports both syntax errors and schema violations in a single pass, even on malformed XML

---

## XML Language Service Core Features (DETAILED)

### 1. Parser (Foundation)
The foundation of the service is a robust XML parser.
- **Input:** Any XML text, including broken or incomplete documents.
- **Output:** A clean `XMLNode` tree.
- **Resilience:**
    - Works while the user is still typing.
    - Never crashes on invalid XML.

### 2. Completion
Provides context-aware suggestions during editing.
- **Context 1: After `<`**
    - Suggests valid child elements.
    - Uses XSD if loaded; otherwise, performs a document scan.
- **Context 2: Inside a tag (attribute position)**
    - Suggests valid attributes.
    - Merges XSD-defined attributes with those found in the document.
- **Context 3: After `</`**
    - Suggests the matching closing tag.
- **Context 4: Empty file**
    - Suggests the `<?xml` declaration.

### 3. Hover
Displays relevant information when hovering over any element:
- Element name.
- Description from XSD (if schema is loaded).
- List of valid child elements.
- List of attributes and their values.

### 4. Document Symbols
Builds a hierarchical outline of the XML file, powering the VS Code outline panel.

**Example Structure:**
```
root
├── child1
│     └── grandchild
└── child2
```

### 5. Folding Ranges
Identifies collapsible regions in the document, powering VS Code code folding.
```xml
<root>          <!-- fold start -->
  <child/>
</root>         <!-- fold end -->
```

### 6. Formatting
Re-indents the entire XML document and normalizes spacing.
- Performs pure text transformation (never modifies the AST).
- Respects `tabSize` and `insertSpaces` options.

### 7. Rename
Provides atomic renaming of element tags.
- Renames `<oldName>` to `<newName>` and matches the closing `</oldName>` to `</newName>`.
- Synchronizes both open and close tags atomically.
- Properly handles self-closing tags.

### 8. Definition
Allows jumping between matching tags:
- Placing the cursor on `<root>` jumps to `</root>`.
- Placing the cursor on `</root>` jumps to `<root>`.

### 9. References
Finds all usages of the same element name:
- Placing the cursor on `<item>` finds ALL `<item>` tags in the file.
- Returns a list of all locations.

### 10. XSD Validation

Validates XML against any provided XSD using **Apache Xerces-C++ compiled to WebAssembly**.

Xerces re-parses the raw XML text directly in a single SAX streaming pass with schema validation enabled. This means both syntax errors and schema violations are reported together, even on malformed or incomplete documents.

**Validation behaviour by scenario:**

| Scenario | `parseErrors` | `schemaErrors` |
|---|---|---|
| Valid XML | `[]` | `[]` |
| Schema violations | `[]` | all violations |
| Syntax error | fatal error | `[]` |
| Schema error before syntax error | fatal error | errors up to crash point |

- `parseErrors` → reported with `source: "syntax"`
- `schemaErrors` → reported with `source: "xsd"`
- Xerces stops at the first fatal syntax error — anything after that point is not reached

**Why Xerces instead of libxml2-wasm:**
`libxml2-wasm` exposes only a DOM parse path — it must fully parse the document before validation can run, so malformed XML produces no schema errors at all. Xerces uses a SAX streaming approach that validates as it parses, matching the behaviour of the WSO2 MI Language Server.

### 11. Schema-Aware Features
Automatically detects XSDs based on:
- Filename (e.g., `pom.xml` → Maven XSD).
- `xmlns` namespace.
- User-defined custom patterns.

---

## Built-in Schemas:
- Maven (`pom.xml`)
- Java web-app (`web.xml`)

Users can also register custom XSDs.

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
Xerces-C++ WASM (XSD validation — syntax + schema in one pass)
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
│   └── xsdValidator.ts     ← Xerces WASM validation engine
├── wasm/
│   ├── xerces_validator.js ← Emscripten-generated JS glue
│   └── xerces_validator.wasm
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

**112 tests — 12 test files**

---

*Current version: 1.0.0*

# xml-language-service
## Pure TypeScript (No java dependencies)

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
- **XSD Validation** — schema-aware validation via `libxml2-wasm`, runs on debounce after typing stops

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

## 8. Definition
Allows jumping between matching tags:
- Placing the cursor on `<root>` jumps to `</root>`.
- Placing the cursor on `</root>` jumps to `<root>`.

## 9. References
Finds all usages of the same element name:
- Placing the cursor on `<item>` finds ALL `<item>` tags in the file.
- Returns a list of all locations.

### 10. XSD Validation
Validates XML against any provided XSD.
- Powered by `libxml2-wasm`.
- Returns `Diagnostic[]` with errors and warnings.
- Includes precise line numbers and descriptive messages.

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

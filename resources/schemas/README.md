# Bundled schemas

`catalog.json` maps file names, namespaces and schema locations to the schemas in this folder.
Every schema must be self-contained: all `xs:include` / `xs:import` targets are stored here as
relative paths, because the validator cannot fetch remote schemas. `tests/schema/catalogSchemas.test.ts`
enforces this and validates real documents against each entry.

| Schema | Source | Notes |
|---|---|---|
| `build/maven-4.0.0.xsd` | https://maven.apache.org/xsd/maven-4.0.0.xsd | Apache License 2.0 |
| `javaee/web-app_3_1.xsd` and the files it includes (`web-common_3_1.xsd`, `javaee_7.xsd`, `jsp_2_3.xsd`, `javaee_web_services_client_1_4.xsd`) | https://www.oracle.com/webfolder/technetwork/jsc/xml/ns/javaee/ | Oracle, CDDL/GPL (see file headers). Servlet 3.1 only; `javaee_7.xsd` imports `xml.xsd` from the local copy below instead of from w3.org |
| `javaee/xml.xsd` | https://www.w3.org/2001/xml.xsd | W3C. Defines `xml:lang` for `javaee_7.xsd` |
| `javaee/persistence_2_2.xsd` | https://www.oracle.com/webfolder/technetwork/jsc/xml/ns/persistence/persistence_2_2.xsd | Oracle, CDDL/GPL (see file header) |
| `frameworks/spring-beans-4.3.xsd` | https://www.springframework.org/schema/beans/spring-beans-4.3.xsd | Apache License 2.0 |

The only edit to a vendored file is in `javaee/javaee_7.xsd`, where
`schemaLocation="http://www.w3.org/2001/xml.xsd"` was changed to `schemaLocation="xml.xsd"`.

## Adding a schema

1. Download the XSD and every file it includes or imports into this folder.
2. Rewrite remote `schemaLocation` values to the local relative path.
3. Add an entry to `catalog.json` and a sample valid and invalid document to `catalogSchemas.test.ts`.

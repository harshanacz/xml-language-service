import { afterAll, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { SchemaProvider } from "../../src/schema/schemaProvider.js";
import { parseXMLDocument } from "../../src/parser/xmlParser.js";

const SCHEMAS_ROOT = path.join(process.cwd(), "resources", "schemas");
const catalog = JSON.parse(fs.readFileSync(path.join(SCHEMAS_ROOT, "catalog.json"), "utf-8"));

/** Loads every file reachable through xs:include / xs:import / xs:redefine, keyed relative to the entry's directory. */
function loadWithImports(entryPath: string): { xsdText: string; imports: Record<string, string>; remote: string[] } {
  const rootDir = path.dirname(entryPath);
  const imports: Record<string, string> = {};
  const remote: string[] = [];
  const visit = (file: string, text: string) => {
    for (const m of text.matchAll(/<(?:\w+:)?(?:include|import|redefine)\b[^>]*\bschemaLocation\s*=\s*(["'])([^"']+)\1/g)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(m[2])) {
        remote.push(m[2]);
        continue;
      }
      const resolved = path.resolve(path.dirname(file), m[2]);
      const key = path.relative(rootDir, resolved).split(path.sep).join("/");
      if (key in imports) continue;
      imports[key] = fs.readFileSync(resolved, "utf-8");
      visit(resolved, imports[key]);
    }
  };
  const xsdText = fs.readFileSync(entryPath, "utf-8");
  visit(entryPath, xsdText);
  return { xsdText, imports, remote };
}

const providers: SchemaProvider[] = [];
afterAll(() => Promise.all(providers.map((p) => p.dispose())));

async function validateAgainst(entryId: string, xml: string) {
  const entry = catalog.schemas.find((e: any) => e.id === entryId);
  const { xsdText, imports } = loadWithImports(path.join(SCHEMAS_ROOT, entry.path));
  const provider = new SchemaProvider();
  providers.push(provider);
  const uri = `auto://${entryId}`;
  await provider.registerSchema({ uri, xsdText, imports, xsdPath: path.join(SCHEMAS_ROOT, entry.path) });
  return provider.validate(uri, parseXMLDocument("file:///doc.xml", xml));
}

describe("catalog.json integrity", () => {
  it("only references files that exist", () => {
    for (const entry of catalog.schemas) {
      expect(fs.existsSync(path.join(SCHEMAS_ROOT, entry.path)), `${entry.id} -> ${entry.path}`).toBe(true);
    }
  });

  it("has unique ids", () => {
    const ids = catalog.schemas.map((e: any) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every entry a way to be matched", () => {
    for (const entry of catalog.schemas) {
      const matchers = [entry.pattern, ...(entry.namespaces ?? []), ...(entry.systemIds ?? [])].filter(Boolean);
      expect(matchers.length, entry.id).toBeGreaterThan(0);
    }
  });

  it("maps each namespace and systemId to at most one schema", () => {
    const seen = new Map<string, string>();
    for (const entry of catalog.schemas) {
      for (const key of [...(entry.namespaces ?? []), ...(entry.systemIds ?? [])]) {
        expect(seen.get(key), `${key} is claimed by ${seen.get(key)} and ${entry.id}`).toBeUndefined();
        seen.set(key, entry.id);
      }
    }
  });

  it("only lists .xsd files, since the validator cannot load DTDs from the catalog", () => {
    for (const entry of catalog.schemas) expect(entry.path.endsWith(".xsd"), entry.id).toBe(true);
  });

  it("is self-contained: no schema imports or includes a remote location", () => {
    for (const entry of catalog.schemas) {
      expect(loadWithImports(path.join(SCHEMAS_ROOT, entry.path)).remote, entry.id).toEqual([]);
    }
  });

  it("has every included file present on disk", () => {
    for (const entry of catalog.schemas) {
      expect(() => loadWithImports(path.join(SCHEMAS_ROOT, entry.path)), entry.id).not.toThrow();
    }
  });
});

const samples: Record<string, { valid: string; invalid: string; invalidMessage: RegExp }> = {
  "maven-4.0.0": {
    valid: `<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>g</groupId><artifactId>a</artifactId><version>1</version></project>`,
    invalid: `<project xmlns="http://maven.apache.org/POM/4.0.0"><bogus/></project>`,
    invalidMessage: /bogus/,
  },
  "servlet-web-app-3.1": {
    valid: `<web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee" version="3.1">
  <display-name>demo</display-name>
  <servlet><servlet-name>s</servlet-name><servlet-class>a.B</servlet-class></servlet>
  <servlet-mapping><servlet-name>s</servlet-name><url-pattern>/x</url-pattern></servlet-mapping>
  <session-config><session-timeout>30</session-timeout></session-config>
  <welcome-file-list><welcome-file>index.html</welcome-file></welcome-file-list>
</web-app>`,
    invalid: `<web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee" version="3.1"><not-a-real-element/></web-app>`,
    invalidMessage: /not-a-real-element/,
  },
  "jpa-persistence-2.2": {
    valid: `<persistence xmlns="http://xmlns.jcp.org/xml/ns/persistence" version="2.2">
  <persistence-unit name="u" transaction-type="RESOURCE_LOCAL">
    <provider>org.hibernate.jpa.HibernatePersistenceProvider</provider>
    <class>com.example.Thing</class>
    <properties><property name="a" value="b"/></properties>
  </persistence-unit>
</persistence>`,
    invalid: `<persistence xmlns="http://xmlns.jcp.org/xml/ns/persistence" version="2.2"><persistence-unit name="u"><bogus/></persistence-unit></persistence>`,
    invalidMessage: /bogus/,
  },
  "spring-beans": {
    valid: `<beans xmlns="http://www.springframework.org/schema/beans">
  <bean id="a" class="com.example.A"><property name="x" value="1"/></bean>
  <bean id="b" class="com.example.B"><constructor-arg ref="a"/></bean>
</beans>`,
    invalid: `<beans xmlns="http://www.springframework.org/schema/beans"><nope/></beans>`,
    invalidMessage: /nope/,
  },
};

describe("catalog schemas validate real documents", () => {
  for (const entry of catalog.schemas) {
    const sample = samples[entry.id];
    it(`${entry.id}: has test samples`, () => {
      expect(sample, `add a sample for ${entry.id}`).toBeDefined();
    });
    if (!sample) continue;

    it(`${entry.id}: accepts a valid document with no diagnostics`, async () => {
      expect(await validateAgainst(entry.id, sample.valid)).toEqual([]);
    });

    it(`${entry.id}: rejects an invalid document`, async () => {
      const diagnostics = await validateAgainst(entry.id, sample.invalid);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics.some((d) => sample.invalidMessage.test(d.message))).toBe(true);
    });
  }
});

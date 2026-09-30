/**
 * Runs the oracles over many generated documents, shrinks each failure to a
 * small reproducer and groups the reproducers into distinct findings.
 */
import {
  cloneModel,
  createRng,
  generateModel,
  randomSerializeOptions,
  serialize,
  type SerializeOptions,
  type XElement,
  type XModel,
} from "./generator.js";
import { ORACLES, type Oracle, type Violation } from "./oracles.js";

export interface Finding {
  oracle: string;
  family: Oracle["family"];
  description: string;
  /** Seeds whose document violated this oracle. */
  seeds: number[];
  /** Distinct minimized documents, smallest first. */
  reproducers: { seed: number; text: string; message: string }[];
}

export interface CampaignResult {
  seeds: number;
  documentsWithViolation: number;
  findings: Finding[];
}

const fails = (oracle: Oracle, model: XModel, options: SerializeOptions) => oracle.check(model, options).length > 0;

/** Every model that is one step smaller than `model`. */
function* reductions(model: XModel): Generator<XModel> {
  for (let i = 0; i < model.prolog.length; i++) {
    const m = cloneModel(model);
    m.prolog.splice(i, 1);
    yield m;
  }
  const elements: XElement[] = [];
  const walk = (el: XElement) => {
    elements.push(el);
    el.children.forEach((c) => c.kind === "element" && walk(c));
  };
  walk(model.root);
  for (let e = 0; e < elements.length; e++) {
    const el = elements[e];
    // Hoist a single child element into the root to drop wrapper levels.
    if (e === 0) {
      for (const c of el.children) {
        if (c.kind === "element") yield { prolog: cloneModel(model).prolog, root: structuredClone(c) };
      }
    }
    for (let i = 0; i < el.children.length; i++) {
      const m = cloneModel(model);
      pick(m, e).children.splice(i, 1);
      yield m;
    }
    for (let i = 0; i < el.attrs.length; i++) {
      const m = cloneModel(model);
      pick(m, e).attrs.splice(i, 1);
      yield m;
    }
    for (let i = 0; i < el.children.length; i++) {
      const c = el.children[i];
      if (c.kind === "element") continue;
      const simpler = c.value.includes("\n") ? "x\ny" : "x";
      if (c.value !== simpler) {
        const m = cloneModel(model);
        (pick(m, e).children[i] as { value: string }).value = simpler;
        yield m;
      }
    }
  }
}

function pick(model: XModel, index: number): XElement {
  const elements: XElement[] = [];
  const walk = (el: XElement) => {
    elements.push(el);
    el.children.forEach((c) => c.kind === "element" && walk(c));
  };
  walk(model.root);
  return elements[index];
}

/** Greedy delta debugging over the model: keep any smaller model that still fails. */
export function shrink(oracle: Oracle, model: XModel, options: SerializeOptions): XModel {
  let current = model;
  let progress = true;
  while (progress) {
    progress = false;
    for (const candidate of reductions(current)) {
      if (fails(oracle, candidate, options)) {
        current = candidate;
        progress = true;
        break;
      }
    }
  }
  return current;
}

export function runCampaign(seedCount: number, firstSeed = 1): CampaignResult {
  const findings = new Map<string, Finding>();
  let documentsWithViolation = 0;

  for (let seed = firstSeed; seed < firstSeed + seedCount; seed++) {
    const rng = createRng(seed);
    const model = generateModel(rng);
    const options = randomSerializeOptions(rng);
    let violated = false;

    for (const oracle of ORACLES) {
      const violations: Violation[] = oracle.check(model, options);
      if (violations.length === 0) continue;
      violated = true;

      let finding = findings.get(oracle.id);
      if (!finding) {
        finding = { oracle: oracle.id, family: oracle.family, description: oracle.description, seeds: [], reproducers: [] };
        findings.set(oracle.id, finding);
      }
      finding.seeds.push(seed);

      // Shrinking is the expensive part; a handful of reproducers per oracle is plenty.
      if (finding.reproducers.length < 5) {
        const small = shrink(oracle, model, options);
        const text = serialize(small, options).text;
        if (!finding.reproducers.some((r) => r.text === text)) {
          finding.reproducers.push({ seed, text, message: oracle.check(small, options)[0].message });
        }
      }
    }
    if (violated) documentsWithViolation++;
  }

  for (const f of findings.values()) f.reproducers.sort((a, b) => a.text.length - b.text.length);
  return { seeds: seedCount, documentsWithViolation, findings: [...findings.values()] };
}

export function renderReport(result: CampaignResult): string {
  const lines: string[] = [];
  lines.push("# Semantic oracle campaign");
  lines.push("");
  lines.push(`Generated documents: ${result.seeds}. Documents violating at least one oracle: ${result.documentsWithViolation}.`);
  lines.push("");
  lines.push("| Oracle | Family | Failing documents | What it checks |");
  lines.push("| --- | --- | --- | --- |");
  for (const o of ORACLES) {
    const f = result.findings.find((x) => x.oracle === o.id);
    lines.push(`| ${o.id} | ${o.family} | ${f ? f.seeds.length : 0} | ${o.description} |`);
  }
  for (const f of result.findings) {
    lines.push("");
    lines.push(`## ${f.oracle}`);
    lines.push("");
    lines.push(f.description);
    for (const r of f.reproducers.slice(0, 3)) {
      lines.push("");
      lines.push(`Seed ${r.seed}: ${r.message}`);
      lines.push("");
      lines.push("```xml");
      lines.push(r.text.replace(/\r\n/g, "␍\n").trimEnd());
      lines.push("```");
    }
  }
  lines.push("");
  lines.push("(␍ marks a CRLF line ending.)");
  return lines.join("\n") + "\n";
}

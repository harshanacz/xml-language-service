import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { renderReport, runCampaign } from "./campaign.js";

const SEEDS = Number(process.env.ORACLE_SEEDS ?? 300);

test(`semantic oracle campaign over ${SEEDS} generated documents`, () => {
  const result = runCampaign(SEEDS);
  const out = join(dirname(fileURLToPath(import.meta.url)), "results");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "report.md"), renderReport(result));
  writeFileSync(join(out, "findings.json"), JSON.stringify(result, null, 2));

  for (const f of result.findings) console.log(`${f.oracle.padEnd(26)} ${f.seeds.length} documents`);
  // The campaign is exploratory: it reports, it does not gate.
  expect(result.seeds).toBe(SEEDS);
}, 600_000);

# Semantic oracles for language servers (feasibility study)

LSPFuzz (ASE 2025) finds crashes in LSP servers. In its future work it says that
functional bugs, where the server answers without crashing but answers wrongly,
need richer test oracles. This folder is a small working prototype of such oracles,
aimed at this XML language service.

```bash
npm run research:oracles                    # campaign + killer tests
ORACLE_SEEDS=5000 npm run research:oracles  # larger campaign
```

The campaign writes `results/report.md` and `results/findings.json`. The killer
tests in `killer.test.ts` are expected to fail until the bugs are fixed.
None of this runs in `npm test`.

## How it works

| File | Role |
| --- | --- |
| `generator.ts` | Seeded generator of well-formed XML. The serializer records the offset of every tag, which gives a ground truth that does not come from the service. |
| `oracles.ts` | 12 oracles in three families (below). |
| `campaign.ts` | Runs the oracles over many documents, shrinks each failure (delta debugging on the model) and groups the results. |
| `killer.test.ts` | Minimized reproducers written as ordinary tests. |

Oracle families:

- **Ground truth (GT)**: compare with the offsets the generator recorded.
- **Metamorphic (MR)**: relations between calls, no expected output needed.
  Definition round-trip, reference-set consistency, rename inverse, format
  idempotence, format preserves content, LF/CRLF invariance, line-shift invariance.
- **Differential (DIFF)**: compare with an independent implementation.
  `vscode-html-languageservice` stands in for the Java server (LemMinX based),
  which could not be downloaded in the sandbox this was built in.

## Result of the first run (1000 documents, valid XML only)

| Bug | Oracles that caught it | Failing documents |
| --- | --- | --- |
| Go-to-definition jumps to the wrong closing tag (nested same name, name prefix such as `a`/`ab` or `ns:x`/`ns:xy`, `</b>` inside a comment) | GT-DEF-OPEN-TO-CLOSE, MR-DEF-ROUNDTRIP, DIFF-MATCHING-TAG | 324 |
| Formatter changes the characters inside CDATA sections | MR-FMT-PRESERVES-CONTENT | 134 |
| Multi-line comments are never folded, although `FoldingRange` has a `comment` kind | DIFF-FOLDING | 142 |

No oracle needed a crash to fire. The MR and DIFF oracles need no ground truth,
so they can be pointed at any LSP server, which is what the final-year project
would do (over stdio JSON-RPC, against LemMinX and the TypeScript server).

## Lessons already learned

- An early version generated `</a>` inside attribute values, which is not
  well-formed XML. It produced many extra "bugs" (rename, references, format
  idempotence). Oracles are only as good as the validity of their inputs, and
  false positive triage has to be part of the method.
- The differential oracle needs normalization: the HTML service ends a folding
  region on the line before the closing tag, and it knows nothing about CDATA,
  so those documents are skipped.

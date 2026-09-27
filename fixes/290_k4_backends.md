# fixes/290_k4_backends.md — W40 · LANE K4 · B4+Q2'S PAYOUT (backend edges + syntax/calls/commands)

**Lane:** W40 K4. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE in path → shell grep only; keep one-liners SHORT).
**Mission:** finish TWO dead lanes' sweeps. (1) B4 (`fixes/288_b4_backends.md`; died at `deleg_5f2a88c4/task-3.log` t≈00:20 after patches to rt-client.ts/probe.ts/mock.ts/cassette.ts landed; ledger items 1–4 + 6–7 never done). (2) Q2 (`fixes/288_q2_syntax.md`; died at `task-5.log` t≈00:21 mid second patch of `src/lib/auth/server.ts`; ledger rows 1–10 landed, remaining sweep items + console.tsx:4044 float-promise pending).
**Baseline HEAD:** `2fa3cd9` (clean tree at lane start). CODE + `node --check`; NO gates / keyed calls.
**Sibling lanes read fresh:** K2 `fixes/290_k2_persist.md` (store/db/migrations — not mine) · K3 `fixes/290_k3_scripts.md` (guard scripts + Q1 naming; explicitly not cli.mjs/tests) · K8 `fixes/290_k8_records.md` (docs/records).

## Verified state of the dead lanes' landed work (at 2fa3cd9)

- B4 landed (all present in tree, confirmed by grep):
  - `src/lib/rt-client.ts:268` R4-f06 finite-guard on imported crash `at` (was `typeof parsed.at === "number"`).
  - `src/lib/llm/providers/probe.ts:105-121` R4-f09 `safeNow()` — contains the injectable clock seam.
  - `src/lib/llm/providers/mock.ts:92` + `src/lib/cassette.ts:453` — `copyEnvelope` refusal arm now round-trips `usage` (Y1 I2 parity).
- B4 NOT done: `openai-compatible.ts` items 1–4 (response parsing/error mapping/timeouts/headers — never patched), probe/mock parity remainder, research/verify/exec layer item 6, rt-client remainder item 7.
- Q2 landed: ledger rows 1–10 (import extensions across auth/* + multiplayer + router + phases/…); batch 2 = `src/lib/auth/server.ts` first patch landed (00:21:29), second patch in-flight when it died.
- Q2 NOT done: floating promise `console.tsx:4044`, import-extension completeness re-check, `import type` discipline, stale budget comments, await/catch/===/let-const remainder.

## Item ledger (append-only — one evidence line per fix, file:line → before → after)

| # | file | item | status |
|---|---|---|---|
| 1 | openai-compatible.ts | response-parsing edges | PENDING |
| 2 | openai-compatible.ts | vendor error → right RT_E_ class | PENDING |
| 3 | openai-compatible.ts | timeouts/aborts | PENDING |
| 4 | openai-compatible.ts | header construction | PENDING |
| 5 | probe.ts + mock.ts | probe honesty / mock parity remainder | PENDING |
| 6 | research/verify/exec | validation, coded refusals, aborts, caps, argv-only, fail-closed | PENDING |
| 7 | rt-client.ts | sweep minus Z3's item | PENDING |
| 8 | Q2 tail | console.tsx float-promise + sweep remainder | PENDING |

## Log (append-only)

### [t0] lane start — byte-state verified

- Both transcripts + logs read; tree state verified (landed patches above). This log written EARLY.
- Siblings K2/K3/K8 read fresh; boxes disjoint from mine (K3 not cli.mjs; K2 not llm/verify/exec; K8 docs).

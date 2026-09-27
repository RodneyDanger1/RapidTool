# 271 · LANE S — STATE + TESTS (store/packet/dod/io + the R2/§R9 test class)

**Lane:** W29 LANE S (state/tests). **Brief:** `wave_plans/W29/coders.md` §LANE S. **Box:** `src/lib/store.ts`
(EXCEPT `:1105` — E1 owns it), `src/lib/packet.ts`, `src/lib/dod.ts`, `src/lib/io.ts`, the listed test files
(`llm.test.ts`, `chat.test.ts`, `packet.test.ts`, `store.test.ts`, `io.test.ts`, `codegen.server.test.ts`, `gates.test.ts`, …).
FORBIDDEN by brief: `engine.ts`, `headless.ts` (E1), `scripts/**` (H). Baseline HEAD: `0f85c32`.

**Rows:** R9-f01 (first) → R9-f02 → R9-f04 → C1-f01/R2-f01 wipe class → R2-f02 → R2 remaining (§R2) → R9-f05 → R9-f06 (cheap).

**Rules honoured:** targeted single-file/leg runs only; no full gates; no keyed calls; log-and-continue (any blocker →
`[EXT-FAIL]`); cross-lane needs → "for <lane>" section below.

---

## Status board

| Row | Pri | State | Files | Proven by |
|---|---|---|---|---|
| R9-f01 (2 RED pins → NO_BALANCE) | P0 | IN PROGRESS | llm.test.ts, chat.test.ts | targeted 2-file leg |
| R9-f01 xAI twin | P0 | TODO | llm.test.ts | (depends on P/R4-f01) |
| R9-f02 (`:1313` → null + runGate(p,6) pin) | P1 | TODO | codegen.server.test.ts (+codegen.server.ts) | |
| R9-f04 (mint-predicate pins) | P1 | TODO | codegen.server.test.ts (+codegen.server.ts) | |
| C1-f01/R2-f01 wipe class | P1 | TODO | packet.ts, store.test.ts, packet.test.ts | |
| R2-f02 (6 wild-run guards) | P1 | TODO | store.ts, store.test.ts | |
| R2-f03/f04/f05/f06/f07 | P2 | TODO | io.ts, dod.ts, packet.ts, store.ts | |
| R9-f05 (fixtures pair test) | P2 | TODO | fixtures test | |
| R9-f06 (guard heuristics) | P2 | TODO (if cheap) | | |

---

## Baseline (BEFORE any lane edit) — HEAD `0f85c32`

- `node --experimental-strip-types --test src/lib/llm.test.ts src/lib/chat.test.ts` →
  `# tests 96 · # pass 94 · # fail 2` (the two superseded 402→REJECTED pins). **Confirms §R9-f01 live.**

---

## Landed

### R9-f01 · P0 · the two superseded 402 pins → `RT_E_LLM_NO_BALANCE` (+ xAI twin)

- **Bytes before:** `llm.test.ts:131-143` + `chat.test.ts:303-315` asserted `RT_E_LLM_REJECTED` for an HTTP 402
  "Insufficient Balance" refusal — the pre-`b721f9c` mapping (the NO_BALANCE doctrine landed in `deepseek.ts:437-444`).
- **Now:** both pins assert `RT_E_LLM_NO_BALANCE`, keep the `/402|balance/i` message assert; the llm pin also cites
  `ERROR_CODE_DOC` (registry entry must stay documented + non-empty, no prose pinning).
- **xAI twin:** added to `llm.test.ts` (R4-f01's shape: `createOpenAiCompatibleProvider(XAI_SPEC, ["probe-model-id"])`
  + fake 402 fetch → `RT_E_LLM_NO_BALANCE`). **RED-FIRST at HEAD** — `openai-compatible.ts:488-495` still returns the
  generic `RT_E_LLM_REJECTED`; the product half is **lane P's R4-f01** (see "for P"). Twin is GREEN once that lands.
- **Runs (targeted, both files):**
  - baseline: `# tests 96 · # pass 94 · # fail 2`
  - after the two replacements (`--test-skip-pattern="R4-f01 twin"`): **`# tests 96 · # pass 96 · # fail 0`** ✅ done-when
  - full leg with the twin: `# tests 97 · # pass 96 · # fail 1` — the ONLY fail is
    `not ok 8 - maps an xAI 402 balance refusal to RT_E_LLM_NO_BALANCE (R4-f01 twin)` (expected: P owns the fix).

---

## For other lanes (cross-box needs — DO NOT touch here)

- **for P** (llm/providers/**): `openai-compatible.ts:488-495` maps ANY refusal to `RT_E_LLM_REJECTED`
  (`code: "RT_E_LLM_REJECTED"` unconditional) — R4-f01/W-17. My xAI twin pin (llm.test.ts) is RED until this lands.
- **for E1** (engine.ts): R2-f01's second layer — `wellFormedDecisionRow` (`engine.ts:2021-2037`) is typeof-only;
  needs `typeof d.decidedAt === "number" && Number.isFinite(d.decidedAt)`. Packet-side `isoFromMs` clamp landed by me
  makes the render total (the wipe is closed on the packet half); the row guard is the engine half.
- **for E1/B** (scaffold.ts): R9-f04's "throwing-stub → no mint" product half = W-04(a) `scaffold.ts:1596-1615`
  (tree-job row swallows non-ReferenceError throws). Pin-side owed depends on the seam; see R9-f04 entry.

## [EXT-FAIL] / deviations

_(none yet)_

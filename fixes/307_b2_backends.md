# fixes/307_b2_backends.md — B2 · BACKEND WIRING SWEEP II (packet/handoff · crew · llm/deepseek)

> Wave 307 · B-lane. HEAD `84784b5` (F-wave rewrite landed; clean tree at open).
> Box (sole writer): `src/lib/packet.ts` · `src/lib/handoff.ts` · `src/lib/crew*.ts` · `src/lib/llm/**`
> · `src/lib/deepseek.server.ts` (+ their colocated tests). Siblings: B1 engine/store/headless ·
> B3 rt-events · B4 bug-sprint sweep · U1 console · U2 pipeline-rail. Mandate: BUGS / NON-WIRED /
> PARTIAL ONLY — no new features, additive-only, honest disabled+reason over fakes. No keyed calls.
> Legs FOREGROUND. Evidence per fix: file:line → bug → patch → proof. (Log opened pre-edit per the
> wave brief — 2026-09-29, B2.)

## 0 — Status board

| Item | Status |
|---|---|
| Early log | DONE (this file) |
| §1 Cache-chain: emit 2 spreads (deepseek provider) + pin test | IN PROGRESS |
| §2 Cache-chain fold (run-eval read-side — ownership check vs B4) | TODO |
| §3 F3 packet context: narrative + next-actions + why-trail (packet.ts, three additive blocks + envelope keys) | TODO |
| §4 handoff.ts provenance extension | TODO |
| §5 Pins: packet 57/57 hold + new; handoff leg green; deepseek tap pin | TODO |
| §6 Dead exports / F2-07/09 state in box | TODO |
| §7 Crew budget seam — verify consumed (F2-10) | TODO |
| §8 Legs + evidence ledger | TODO |

## 1 — Cache-chain break (F6 `fixes/306_f6_factory.md` §1, k6 handoff #4)

- **Bug (byte-verified at open):** `LlmCallTapRecord` declares `cachedPromptTokens?: number | null` /
  `cacheMissTokens?: number | null` (`src/lib/llm/providers/deepseek.ts:658-659`) and the parse site
  populates `LlmUsage` with the vendor split (`:577-582`), but the tap EMIT (`completeDeepSeek`
  wrapper, `:708-717`) forwards only `at/ok/requestedModel/servedModel/code/promptTokens/
  completionTokens` → cache spend is invisible to every driver downstream (run-eval fold incl.).
- **Patch:** 2 additive conditional spreads at the emit (byte-identical record when the vendor
  reports no split — mirrors the `:577-582` parse-site discipline).
- **LANDED (B2, byte-verified):** `src/lib/llm/providers/deepseek.ts:717-730` — the two spreads
  (`...typeof res.usage.cachedPromptTokens === "number" ? {cachedPromptTokens} : {}` and the
  `cacheMissTokens` twin). **Pin LANDED:** `src/lib/deepseek.server.test.ts` +2 tests (new
  describe "the call tap's cache split (W42 B2 · k6 #4 completion)"): (a) vendor split
  `{hit:1100, miss:100}` rides the record; (b) legacy usage keeps the 7-key record byte-for-byte
  (deepEqual on Object.keys — no fabricated 0). **Leg:** `node --experimental-strip-types --test
  src/lib/deepseek.server.test.ts` → **26/26 pass** (24 pre-existing + 2 new).
- **FOR B4 — the read-side fold (`scripts/run-eval.mjs`, B4's box; NOT edited by B2).** B4's kickoff:
  it owns the `run-eval.mjs` read-sides; "coordinate edits 'for B2/B3'". Exact minimal spec:
  1. `llmEvidenceFromCallRecords` (~:1170-1214): inside the recordSpend call (~:1188-1193) add
     `...(typeof r.cachedPromptTokens === "number" ? { cachedPromptTokens: r.cachedPromptTokens } : {}),`
     to the spend object — `recordSpend` merges CACHE_LEDGER_FIELDS (`token-ledger.ts:154-192`);
     a `cacheMissTokens` forward is a NO-OP there (not a ledger field — DeepSeek-only attribution
     key; keep on the tap record only).
  2. The `usage` block (~:1195-1199): add
     `...(typeof ledger.cachedPromptTokens === "number" ? { cachedPromptTokens: ledger.cachedPromptTokens } : {}),`
     so the row can see measured cache reads (null-when-absent convention holds).
  3. Pin (run-eval.test.mjs, near the W24/B2 wire test ~:1050-1105): stub fetch with
     `usage {prompt_tokens: 11, completion_tokens: 3, prompt_cache_hit_tokens: 9, prompt_cache_miss_tokens: 2}`
     → assert `records[0].cachedPromptTokens === 9` and `ev.usage.cachedPromptTokens === 9`; legacy
     response (no cache keys) → key ABSENT (no fabricated 0).
  4. Optional/honest-pricing note: `DEEPSEEK_PRICE_TABLE_USD_PER_M` rows carry no
     `cachedInputPerMillion` → `estimateCostUsd` defaults hit tokens to the full input price
     (over-bills, never under-bills; PRICE_BASIS_TABLE self-describes as "cache-miss list rates").
     Add a `cachedInputPerMillion` line only WITH a documented basis — else leave and note.
  The emit these fields ride on: `fixes/307_b2_backends.md` §1 (landed above). A-110(2)-(4)
  (openai-compatible parse, LlmModel derive, llm-tasks) remain W43 per `wave_plans/W42/SPEC.md:194`.

## 2 — F3 field map (from its recon summary; `fixes/306_f3_agentctx.md` never landed — lane hit
max_iterations with zero edits; field map recovered verbatim from the delegation record)

- Narrative sources: `project.phases[].status` + `gate {passed, unmet[], evidenceHash}`; `logs[]`
  (`gate.verdict`, `dod.blocked`, `p6.repair.delta`, `p6.repair.patch.refused`, `acceptance.stale`,
  `run.accepted|failed|aborted`); `artifacts[]` (kind `gate`); `decisions[].decidedVia`; `lastTest`.
- Next-actions sources: `project.hitl` · `project.status` · phase `gate.unmet[]` · `hardDodMessage`
  (`dod.ts:1018`) · `phaseCoverage()` · `project.acceptance`.
- Why-trail sources: `decisions[].decidedVia` (envelope has `decided_via`; prose ledger doesn't) +
  `traces[]` + artifact provenance. Honesty hazard: `capabilities.verify`/`model_route` hardcoded.
- Plan: three additive render blocks gated on non-empty inputs + matching envelope keys
  (null-when-absent, PACKET_VERSION stays 3); handoff provenance extension; pins 57/57 hold + new.

(Evidence appended as it lands.)

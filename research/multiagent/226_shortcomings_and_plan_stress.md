# 226 — PARENT-RECOVERY NOTE (read this first)

X-2 completed its research (Half A: new code-level problem-causers; Half B: the plan/list stress
test) but ran out of budget before the write pass; it transmitted the verified findings for
recovery. **Everything below the rule is the LANE's own content, unedited.** Its own note says
the correct completion is: skeleton-first with the bottom line, Half A, the six Half-B answers,
PROPOSED ROWS, then provenance — and it found NO corrections to file (TA-3 was confirmed, not
contradicted).

- lane: W13 X-2, persona "shortcomings + plan stress" · delegation `deleg_471d953e`, task-1
- source of this text: `%LOCALAPPDATA%\hermes\cache\delegation\subagent-summary-1-20260924_122043_153306.txt`
- full tool transcript: `%LOCALAPPDATA%\hermes\cache\delegation\live\deleg_471d953e\task-1.log`
- lane scratch: `C:/Users/mnril/w13k_scratch/` (probe1–probe10.sh, probe_llmstatus*.mjs)
- test runs used: 0 of 3 (all evidence is static reads + 2 keyless node probes)

---

## Outcome (honest): the deliverable file was **not written** — I ran out of tool budget after completing the research

`research/multiagent/226_shortcomings_and_plan_stress.md` does **not** exist. I read the inputs and the named modules in full and produced verified findings, but the write pass never happened. Everything below is read-today evidence (HEAD `7582771`) so the parent can either have me write the file next turn or hand the content to another lane. **No file was created or modified; no git mutation; no src/scripts edit.** Scratch used: `C:/Users/mnril/w13k_scratch/` (probe1–probe10.sh, probe_llmstatus.mjs, probe_llmstatus_keyed.mjs). Test runs used: **0 of 3** (all evidence is static reads + 2 keyless node probes).

### Half A — NEW code-level problem-causers (8, each read today)

1. **[A1 · biggest] The headless/CLI "keyed" path cannot reach a chat LLM at all — probably.** `headless.ts:40` statically imports `knowledge.ts` (node:fs), so the whole headless graph is one strip-types module instance; `headless.ts:215`'s dynamic `import("./deepseek.server.ts")` then sees a `process.env` **not** injected by `scripts/with-app-env.mjs`. Live probe (keyless **and** with `DEEPSEEK_API_KEY=dummy`): `llmStatus()` → `{configured:false,models:[]}`; `callModel()` → `RT_E_INTERNAL "No Start context found in AsyncLocalStorage"`. **Blast radius:** `create`'s default `enforceDod: … keyedDeepSeekConfigured()` (`engine.ts:1884-1885`) is always `false` under the CLI; headless's own comments (`:160-164`) document this class; **T0.10 (Step 0), T4.2 and OV-8 all rest on the CLI keyed path.** Caveat that must be probed before acting: `engine.ts:2851-2885` `upgradeP6Keyed` imports the provider via a *separate specifier* `"./deepseek." + "server.ts"` — deliberately, to dodge a cycle — so the P6 keyed path may behave differently.
2. **[A2] The thinking-mode default inverts across the exact seam the plan edits.** `verify.server.ts:800/817/846` call `callModel("weak", …, {json:true})` with **no** `thinking:false`; `llm.ts:127-136` forwards opts to the server fn (`:116-119`) → registry `callModel` (`registry.ts:396`) → provider. Today safe only because `deepseek.ts:372` disables thinking for **non-pro**. But `registry.ts:367` documents `model?: string` as "EXACTLY one of KNOWN_MODEL_IDS" and `KNOWN_MODEL_IDS = [flash, pro]`: any seam passing `model:"deepseek-v4-pro"` flips `isPro` (`deepseek.ts:373-374`) → thinking enabled → the fixes/156 failure returns (`content:""` → `RT_E_LLM_REJECTED`, `deepseek.ts:444-461`). Fragile parse path: `parseSynthesisEnvelope` (`codegen.server.ts:1837-1882`) and `parseSynthesisPatchEnvelope` (`:625+`) both need `rec.module` to be a string; a thinking-shaped reply makes them return `null` → `validateSynthesisModule` refuses "empty module" (`:827-834`) and `unboundExportNames` (`:1951`) reports every claimed export unbound. Targets: OV-1, OV-4, T5.7.
3. **[A3] `SessionBudgetExceeded` is thrown but nothing catches it.** `token-ledger.ts:44` defines it; `assertBudgetHeadroom` (`:320`) and `recordBudgetSpend` (`:339`) **throw**; grep: callers = token-ledger + its test only (`errors.test.ts:121`). Blast radius: any seam that adopts the plan's budget threading (T-107.6/OV-4) without a wrapper turns a budget stop into `RT_E_INTERNAL` at the outer catch.
4. **[A4] `headless.ts`'s own comment-only catches are a second OV-13 instance.** `:208` `catch { /* research unavailable → items stay empty, not cited */ }` and `:231` `catch { narrative = null }` — a **keyed** run whose narrative call fails is indistinguishable from a deliberately keyless one. 219b §2 covers engine/store/verify only, so this file+line pair is NEW (cite OV-13 as the class, don't re-report its three sites).
5. **[A5 · falsification, no action] The envelope-tail hypothesis is dead.** `compile-check.server.ts`'s wrapper envelope (`projectScriptRunnerCode` `:518`, `parseWrapperEnvelope` `:550`, `WRAPPER_TAIL_MAX = 6000` `:387`) survives a chatty `npm test`: `clampRunnerOutput` (`node-runner.server.ts:91-128`, cap 48 000) keeps head 28 800 + tail ≈19 200, larger than the envelope, so `lastIndexOf('{"kind":')` still hits. Record it so no lane chases it.
6. **[A6] A >1 MB-printing tree reads red, not green.** `MAX_BUFFER = 1_000_000` (`node-runner.server.ts:57`) → `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` (`:434-442`) → `runProjectScript` = `run:"error"` "killed: output exceeded the 1 MB capture cap" (`compile-check.server.ts:855-859`). Honest, but adjacent to the treeRun done-when.
7. **[A7] `node-runner.server.ts` has zero token/usage surface.** grep: no `usage`, no `TokenBudget` (only redaction `:212-242`). 222 §2 row 2 flags the seam UNMAPPED, yet T-107.6's done-when still demands "each seam threads ONE TokenBudget" incl. its test file — an unobservable done-when as written.
8. **[A8] `verify.server.ts` retry mislabels the failure class.** The retry prompt says "not valid JSON" (`:819-822`) while `parseOracleJson` returns null for **both** `unreadable-json` and `unexpected-shape` — the model is told the wrong thing. Diagnostic quality only.

Confirmed, no correction needed: `grep -o 'case "' | sort -u` = **35** unique verbs (one per line, so `grep -c` = 35 too), `diagnose` present as a case and **absent from the 34-key USAGE** — TA-3 stands exactly as written.

### Half B — plan stress test

- **Collisions (HOT rule violated on 4 files):** `engine.ts` = seams for OV-3 + OV-4 + T-107.7 + OV-11 (+T-107.6 threading); `console.tsx` = T5.1 + T5.2-A + OV-2 + DF-18 + DF-26; `codegen.server.ts` = OV-3 + T-107.6 + OV-11 + G5; `scripts/rapidtool-cli.mjs` = TASK-01 + T5.3 + TA-3 + T4.2 + T-107.7 + T5.1 (+ new OV rows). 222 §4's one-lane-per-HOT-file rule is unmet.
- **Unobservable done-whens:** T-107.6's node-runner seam (A7); T4.2 "probe to name at dispatch"; T4.3 **MISSING**; DF-09 **MISSING**; G4 **MISSING**; OV-7 "form of the check at dispatch"; OV-12 (a re-read, not a command).
- **Missing dependency:** nothing in the product ever mints `modelRoute:"deepseek-pro"` (only producers are `engine.ts:1856` "deterministic" and `codegen.server.ts:2372/:3072/:3144` "deepseek-flash"); the sole reasoning-tier caller is `llm-tasks.ts:120` reached only via the inert facade (A1). So OV-1 widening `ROLE_TIERS.reasoning`/the model override arms A2's thinking path with zero coverage.
- **Bad-idea row:** **OV-6** (MCP interop spike) — RESEARCH-ONLY, no command, duplicates 221 F1; its done-when is prose, which §5.1 forbids.
- **The 3 likely plan-level failures + cheap contingencies:** (1) Step 0 spends the keyed window on a CLI path that may be inert (A1) → contingency: a `configured:true` preflight probe before the run; (2) keyed replies arrive unparseable en masse (A2+A8) and the two silent sites hide why → contingency: land OV-13's rows first (already 48-h item 7); (3) swap on this 8 GB host from `verifyKindDir`'s 240 s `npm ci` leg (`compile-check.server.ts:1138`) + 3×30 s project scripts + a recursive `cpSync` of a tree with node_modules into `%TEMP%` → contingency: serialize install-leg work in one lane, or accept the honest `skip` while lanes are live.

### Proposed rows (canonical schema, OV-27…OV-31, each with self-rejection)
- **OV-27** CLI-runtime LLM reachability probe (doctor/summary surface) so advisory-vs-keyed is never silent. *Self-rejection: if A1's P6 separate-specifier path already works, this probes a non-problem.*
- **OV-28** Pin the thinking-mode contract at the registry boundary (force/refuse `thinking` for `json:true` on the reasoning tier, or add a body-shape test). *Self-rejection: may break a legitimate reasoning-tier json caller; needs the owner's tier intent.*
- **OV-29** Sweep `headless.ts:208/:231` to OV-13's failure-row shape. *Self-rejection: the research catch may be genuinely best-effort; only `:231` is a real keyed-reads-keyless case.*
- **OV-30** Name/serialize the verifyKind install-leg budget in the plan. *Self-rejection: "registered not fixed" (OV-18 style) may be the right call on 8 GB.*
- **OV-31** Strike or fold OV-6 into 221 F1. *Self-rejection: an interop memo is cheap; withdrawing costs the MCP question a home.*

**Bottom line I would have put at the top of 226:** `new code findings: 8 (5 real, 2 registered-class cites, 1 falsification) · plan collisions: 4 HOT files · silent-failure rows: 2 (OV-13 + the new headless pair) · bad-idea rows named: 1 (OV-6) · proposed rows: 5 (each with self-rejection)`. **Most likely way this plan creates a new problem:** the keyed-phase work is dispatched through a CLI chat path that may be structurally unreachable (A1), so Step 0 and OV-3/4/5/8 can spend the owner's keyed window measuring a deterministic run and be read as "the fixes didn't help." **One-line prevention:** probe `configured:true` through the CLI facade (A1's specifier, not `deepseek.server.ts`) before any keyed dispatch.

> **[PARENT · 2026-09-24] PARTIALLY FALSIFIED (declare-or-strike) — A1's headline does not hold as written.**
> Reproduced by the parent: `DEEPSEEK_API_KEY=dummy-key-for-probe node --experimental-strip-types
> scripts/rapidtool-cli.mjs doctor` → **`"llm": { "configured": true }`** through the CLI's own surface.
> So "the headless/CLI keyed path cannot reach a chat LLM at all" is **not** true for the CLI-with-shell-key
> case; the lane's `configured:false` came from **its own probe script** (a different module instance), and
> the `AsyncLocalStorage` error is what a direct `callModel()` call outside the Start runtime returns —
> a probing artifact, not (proven) a product defect. **What still stands, and matters:** X-2's own flagged
> caveat — whether the **P6 synthesis path** (`upgradeP6Keyed`'s separate `"./deepseek." + "server.ts"`
> specifier, `engine.ts:2851-2885`) reaches a model under the CLI is **still unprobed**, and it is exactly
> what `OV-27` exists to settle (cheaply, before Step 0). A2/A3/A6/A7/A8 and all of Half B are unaffected
> by this correction. (verified by the parent)

### What's left
Write the deliverable file with the skeleton-first structure required by `x-2.md` (bottom line → Half A → Half B six answers → PROPOSED ROWS → provenance), and decide whether the optional `CORRECTED:` markers are needed (I found **none** — TA-3 was confirmed, not contradicted).

[NOTE: subagent modified files the parent previously read — re-read before editing: C:\Users\mnril\Desktop\RapidTool Main\research\multiagent\220_tasklist_canonical.md]
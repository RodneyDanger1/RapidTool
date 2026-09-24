# 219e · Gap to "best in class" + the 100%-solid plan

**Lane 5 of 5 · W13 state-of-the-factory inquest · written 2026-09-24 · READ-ONLY except this file.**
**Plan followed:** `wave_plans/W13/lane-5.md` (read in full, first).
**Tree state at writing:** HEAD `7582771` (W12 close) + uncommitted W10/W11/W12 work; tree green as of
2026-09-24 11:08 (`bash scripts/gate.sh` → `{"ok":true}`, 218 §5: typecheck 0 · lint 0 · scripts 261/261 ·
lib 1957/1957 (+1 by-design skip) · build 0).

> [WD-C · 2026-09-24] CORRECTED: "+ uncommitted W10/W11/W12 work" → **nothing was uncommitted**: the tree was
> clean at `7582771` (committed 2026-09-24 11:15:16 -0500; that commit contains the W10–W12 work) —
> `git status -s` 11:19–11:36 shows no ` M` on src/scripts and no uncommitted tracked work. The
> "aa12c6c + dirty" phrasing (219a/219b) died with the 11:15:16 commit; stale by 11:16. (verified by WD-C, not by the lane)

**Evidence rules (owner's standard — "100% solid and no hallucinations/fake code/ and is zero
bullshit 100% truth").**
- Every **competitor** fact below is quoted from the repo's dossiers (`90_LEAPFROG.md`,
  `107_competitors_agentic.md`, `108_competitors_app_generators.md`, `110_ui_audit_vs_competitors.md`)
  with the dossier + line. Where a dossier is silent on an axis, the cell says **NOT IN THE DOSSIERS —
  needs a fresh spike**. No competitor fact is stated from memory.
- Every **RapidTool** fact is a `file:line` I read today, or a command's real output pasted today.
- Items I could not verify are labelled **UNVERIFIED**.

---

## 0. Provenance — what I actually read and ran today (2026-09-24)

| # | What | Command / read | Result used below |
|---|---|---|---|
| 1 | Lane plan | `read wave_plans/W13/lane-5.md` | my axes list + constraints |
| 2 | Keyed run truth | `cat research/eval-out/_keyed-run.log` | **4/9** · M1,M5,M6,M8=1 · M2,M3,M4,M7,M9=0 · 756.2 s · 2026-09-10 |
| 3 | Latest eval | `node -e` over `research/eval-out/results.json` | **keyless 6/9** · 6 entries · `generatedAt 2026-09-17T02:49Z` · M2,M5,M6,M7,M8,M9=1 · **M1,M3,M4=0** · has `graderDir` + `trials` |
| 4 | Corpus artifact | `find research/eval-out/coffeehouse2home-property-ledger--trial-2` + `head src/jobs/*.ts` | 4 of 5 job files are `export * from "./track.ts"` "tree bridge" re-exports; `track.ts` is real (36 lines, JOBS list + self-tests) |
| 5 | Governance fix state | `grep/sed` on `src/lib/headless.ts:723-870`, `src/lib/policy.ts`, `src/lib/dod.ts:48-140,448-594`, `src/lib/engine.ts:1646` | P0-01/P0-02 **fixed**: actor seats + `RT_HUMAN_SEAT_TOKEN` + one-seam `evaluatePolicy`; criteria now read the ledger, not `status==="complete"` |
| 6 | Tiers | `grep WILD_CLASSIFIER_MODEL / P6_SYNTH_MODEL` | both `deepseek-v4-flash` (`wild-mode.server.ts:32`, `codegen.server.ts:145`) — the 100 §P0-03 inversion collapsed |
| 7 | Patch primitive | `grep` in `src/lib/codegen.server.ts`, `src/lib/headless.ts`, `src/lib/patch.ts`, `scripts/rapidtool-cli.mjs` | `patch.ts` + `edit` verb landed (dry-run default; policy-seam gated; ledger row) |
| 8 | Provider state | `head src/lib/llm/providers/registry.ts`, `grep LlmModel` | registry + role tiers + explicit-model rule; **one provider** (DeepSeek) + test mock; `LlmModel` still 2 DeepSeek ids; multi-provider "deliberately deferred" (registry header) |
| 9 | Cost/context | `grep recordBudgetSpend/createTokenBudget` callers; `head src/lib/compaction.ts`; `grep clampRunnerOutput` | TokenBudget seam helpers exist; **only P6 records spend** (`codegen.server.ts:2118,2150`); compaction = vocabulary only ("no compaction site exists in engine.ts today"); runner clamp 48 000 (`node-runner.server.ts:74,91,412-413`) |
| 10 | MCP/streaming | `grep -rIn "jsonrpc\|Model Context Protocol\|mcp__"` → **0 hits**; `grep stream` | no MCP surface; `stream: false` at `src/lib/llm/providers/deepseek.ts:377`; end-to-end streaming absent |
| 11 | Self-improvement | `grep` `report-intake.ts`, `knowledge.ts`, `codegen.server.ts` | memory write-back lands (`report-intake.ts:25-32,431-445`); lesson→P6 prompt read-back (`codegen.server.ts:104-105,2468-2473`); F1 probe-tags wire landed W12 (`knowledge.ts:952`) |
| 12 | Autonomy | `grep` cap/scheduler | wild cap 20 (`store.ts:1124`); forceHuman cannot be autopilot-approved (`engine.ts:1646`); **no scheduler anywhere** |
| 13 | CLI surface | `grep -c 'case "'` `scripts/rapidtool-cli.mjs` | **35 verbs** (README says 34 — drift; `edit` is the new one, CLI header :27) |
| 14 | Verifications | `grep` `compile-check.server.ts` | `verifyKindDir` = scratch copy → `npm ci`/install → declared build/test (`:1058-1096`); "unverified ≠ fabricated" strings (`:841,918`) |
| 15 | Deploy/git | `grep` `engine.ts`, `scaffold.ts` | P9 emits canned GitHub-Actions + GCP/Firebase sketch (`engine.ts:1027,1050-1051`); `.gitignore` emitted (`scaffold.ts:491,2480`); no git init/commit surface found |
| 16 | Eval plumbing | `head scripts/browser-smoke.mjs`, `grep playwright` | Playwright is a real dep (`package.json:93`) used by `scripts/browser-smoke.mjs` (console smoke) — **never run** on the W11/W12 pixels (218 §4) |
| 17 | Dossiers | `read` 107, 108, 90 §0-7+§9 head, 100, 103, 110 §1, 217c §3-4, 218, RESUME §1.0/§1.4, remainingwaves, taskuniverselog | all competitor/bar citations below |
| 18 | Siblings | `ls research/multiagent/219*` | 219a/219b existed but were **skeletons** at my read time (11:15-11:16) — I did not block on them |

**Not done by me (honesty):** no keyed run (no key use permitted here; `DEEPSEEK_API_KEY` liveness is
itself unverified — T0.10, `taskuniverselog.md` §5), no `npm run typecheck/test/build` (forbidden this
wave), no browser pass, no competitor spike (dossier facts only).

---

## 1. The axes that decide "best" for this class — derived from the dossiers

The class, as the dossiers define it, is **not** "an AI that writes code" — it is the union of two
families RapidTool straddles:

- **Agentic SWE harnesses** (107's 8 questions): untrusted-code execution, self-verification, provider
  abstraction, edit application, context/memory, cost control, parallelism, and **the oracle problem**
  (`107:9-18`).
- **Brief→app generators** (108's 8 questions): brief→plan, file writing **and updating**, multi-file
  coherence, does-it-run, tests, BYOK, cost/streaming, review surface (`108:42-51`).

And the strategy docs add axes that are not in either question set:

- **Governed honesty as protocol** — evidence-hashed gates, typed envelopes, append-only ledger (90 Axis
  1, `90:189-199`); the dossiers argue no competitor sells this and 107 finds the closest analogues are
  *configuration* (Codex exec policy, OpenCode policy engine), not law (`107:225-237`).
- **Deterministic keyless floor** — a run that is a function of the brief (90 Axis 2, `90:201-210`).
- **Bounded autonomy + hard HITL** — bounds are the feature (90 Axis 3, `90:212-221`).
- **Paper trail as product / replay** (90 Axis 4, `90:223-232`; 107 lesson 7, `107:281-293`).
- **Compounding self-learning** — the only axis that gets better per run (90 Axis 5, `90:234-243`).
- **Human surface (first ten minutes)** — 110 exists because the owner said the UI is "VERY COMPLICATED…
  LOTS OF JARGON" (`110:11-13`), and 90 §3 rank 6 lists "Diff/artifact review UI for gates" (`90:171`).
- **Honest losses are also axes**: 90 §7 says RapidTool will keep losing at in-repo editing ergonomics,
  cloud-scale fleets, visual polish, frontier IQ, community gravity, distribution, and mid-run steer
  richness — the plan below must not fight those (`90:318-327`).

**The 15 axes in the gap table** are those 13 required by the lane plan plus two the dossiers argue for
explicitly: *edit/update of existing projects* (107 §10 lesson 1 — "the single largest value gap",
`107:196-209`; 108 mechanism 1, `108:554-567`) and *streaming/interactive steering* (90 §3 rank 1,
`90:166`; 103 A6, `103:174`).

---

## 2. The axis-by-axis gap table

Verdict legend: **CLOSED** (at or above the dossier's field bar for this class) · **OPEN-CLOSEABLE**
(engineering can close it; no owner decision needed) · **PRODUCT-DECISION** (owner owns it) ·
**UNKNOWN** (evidence insufficient; needs a run/spike). Ranked by consequence, not by effort.

| # | Axis | RapidTool today (file:line / command, read TODAY) | The field's bar (dossier citation) | Verdict |
|---|---|---|---|---|
| 1 | **Raw generation capability** | Keyed run: **4/9** (`research/eval-out/_keyed-run.log`, 2026-09-10, 756.2 s). Keyless: **6/9** (`results.json` `generatedAt 2026-09-17T02:49Z`; M1/M3/M4=0). P6 chunked synthesis + bounded repair incl. `str_replace` repair level (`codegen.server.ts:145,2055,1048`). Fresh scaffold census: `{stubs:0, reexports:0, real:3}` (W8, `fixes/216k:177`; `taskuniverselog.md:466-467`). | Dyad runs the emitted app (Playwright, `108:456-475`); bolt.diy's bar = build passes (`108:261-268`); smol ships a zero-dependency app (`108:158-164`). But 108's own finding: **"Nothing here demonstrates a large, dependency-heavy, multi-file app that installs and runs first-try without human intervention"** (`108:542-545`). | **OPEN-CLOSEABLE** — the field's demonstrated bar is *lower* than RapidTool's own; the gap is the never-green keyed run |
| 2 | **Verification depth (runs what it makes)** | `emit --check` / `--run` (tree-run in-loop) / `--verify-kind` (scratch copy → `npm ci` → declared build/test; `RT_E_VERIFY_KIND_FAILED`; `compile-check.server.ts:1058-1096`; CLI `:781`); T-18: a tree failing its own `npm test` can never be `ok:true` (`taskuniverselog.md:432`; README capability row). **Missing:** running-instance E2E; keyless `lastTest` "unlabeled" + NO evidenceHash (M4=0, `results.json`); no browser pass ever run on the console (218 §4). | Dyad: human-approved assertion cards → grounded Playwright assertions against a **running** app ("OMIT that entry rather than guessing", `108:468-475`, `108:639-653`); Cline's 3-layer eval pyramid + flakiness score (`107:89`); Codex: policy engine + human approval, **no code-correctness oracle** (`107:128`). | **OPEN-CLOSEABLE** for the M3/M4 promotion work; the running-instance E2E sub-part is **PRODUCT-DECISION** (isolation — see §5) |
| 3 | **Determinism / reproducibility** | Keyless deterministic floor is real and tested (`bench.ts` no-LLM, `algorithms.ts` plan/oracle, keyless envelopes). **No replay/cassette** (`grep` today: only prose hits); **no `trace.ts`/`snapshots.ts`** (`ls` today → absent). | OpenHands: runs replay step-by-step (90 §1.8, `90:75-77`); Codex: compaction as a lifecycle with hooks + `TokenUsageRecord` attribution (`107:131-132`); Cline: checkpoint-diff/restore (`107:89`). | **OPEN-CLOSEABLE** |
| 4 | **Governance (policy, HITL, ledger, audit)** | One-seam policy engine (`policy.ts`, 245 lines; default-deny; type-enforced fallback — `policy.ts:3-35`); every approval routed (`headless.ts:796-870`); actor seats + out-of-band token (CLI `:543-595`); ledger rows carry `decidedVia` policy provenance (`headless.ts:738-766`); criteria read the ledger (`dod.ts:448,460,582,594`); forceHuman cannot be autopilot-approved (`engine.ts:1646`); wild cap 20 (`store.ts:1124`). | Codex `Decision::{Allow,Prompt,Forbidden}` + approvals (`107:128`); OpenCode `evaluate(action, resource, fallback)` (`107:161`, cited as the steal in `107:225-237`); PR-Agent auto-approve only via a named opt-in (`107:151`). The dossier's verdict: nobody else has **evidence-hashed gates + append-only decision ledger** as engine law (`90:189-199`). | **CLOSED** (in-class; no higher bar found in the dossiers) |
| 5 | **Honesty mechanisms** | `factoryClaim` latch → `autonomousSoftwareFactory: false` + named `gaps[]` (`headless.ts:3186-3192`); `RT_E_*` registry; keyless `not-configured` envelopes; `sandbox:false` everywhere; declare-or-strike **exercised** (an over-claim was struck with evidence, 218 §2.4); run-side frozen graders + leak scan (`results.json` `graderDir`, `graderLeak`). | 107 lesson 5: **freeze the grader outside the agent then score across trials** (`107:252-264`) — landed here; Aider/Codex/PR-Agent "honest by abstention" (`107:77,134,151`). | **CLOSED** — the strongest axis; it is the product |
| 6 | **Autonomy (unattended / scheduled / fleet)** | Bounded Wild Mode (one macro-action/step; cap 20, `store.ts:1124`; `forceHuman` gates). **No scheduler, no daemon, no queue** (`grep` today → none; 100 P1-02). `doctor` still says not autonomous. | Codex `approval_policy: never`; Devin fleets + hours-long runs (`90:47-48`); OpenHands cron triggers own *when* (`107:116`); Claude Routines (`90:33`). | **OPEN-CLOSEABLE** for scheduling; **PRODUCT-DECISION** for how autonomous it may be allowed to run (90 Axis 3 says the bound *is* the strategy) |
| 7 | **Self-improvement (the loop that compounds)** | Loop fires: lesson family verbs; memory write-back (`report-intake.ts:25-32,431-445`); lesson→P6 prompt (`codegen.server.ts:2468-2473`); T-11 green-seal gate (a red seal mints zero lessons); F1 probe-tags wired W12 (`knowledge.ts:952`). M7 measured so far only as a baseline row (keyless M7=1 "prior same-domain 0"; keyed M7=0). | Devin "reads past session trajectories" (prose, opaque) (`90:47`); Codex local memories are LLM-summarized prose, off by default (`90:371-375`); 90 Axis 5: lessons as **structured rows with provenance + deterministic ranking** exist nowhere else (`90:234-243`). | **OPEN-CLOSEABLE** — the mechanism is in; its *measurable effect* (run N+1 beats run N) is unproven |
| 8 | **Context / cost discipline** | `TokenBudget` seam + cache-aware `estimateCostUsd` (`token-ledger.ts:237,269,339`); **only P6 records spend** (`codegen.server.ts:2118,2150` — the only callers today); `RAPIDTOOL_TOKEN_CAP` unset by default (100 P1-05); compaction = vocabulary only, no wired site (`compaction.ts` header); runner output clamp 48 000 chars (`node-runner.server.ts:74,412-413`). | SWE-agent per-instance **and** global `$` caps, on breach autosubmit the diff (`107:58`); Cline cache-aware cost formula — "oversized outputs cost **quadratically** over the remaining run" (`107:92,274-276`); MetaGPT `max_budget=10.0` + `invest()` (`108:334-339`); Codex per-turn/session attribution (`107:132`). | **OPEN-CLOSEABLE** |
| 9 | **Provider & model breadth** | Registry + role tiers (main/reasoning/weak) + explicit-model rule that REFUSES unknown ids (`llm/providers/registry.ts:1-55`); **exactly one real provider** (DeepSeek) + a test-only mock; `LlmModel` = 2 DeepSeek ids (`llm.ts:18`); multi-provider env selection, failover, doctor surfacing **deliberately deferred** (registry header; spec in `101` §4). | Cline `registerHandler(providerId, factory)` + generated catalog (`107:90`); bolt.diy 21 providers incl. ollama/lmstudio (`108:273-277`); litellm single abstraction (SWE-agent/Aider, `107:55,72`); Codex `model-provider` crate + `--oss`/ollama (`107:129`). | **OPEN-CLOSEABLE**; its keyed tests are key-gated (cross-family judging needs ≥2 families) |
| 10 | **Tool / interop surface** | **35** CLI verbs incl. `edit` (dry-run default + policy + ledger row — `scripts/rapidtool-cli.mjs:27,1135`), `diagnose`, `tree-run`, `repair`, lesson family; packet v3. **No MCP client or server** (0 protocol-term hits today). Six handoff profiles built but **test-only** (`exportProfiles`, `packet.ts:660`; only importer `packet.test.ts` — re-verified today, 103 G4 still true). | MCP is table stakes (Codex `codex mcp`, DSH `mcp__<server>__<tool>`, Gemini settings.json, Antigravity MCP Store — `90:174`); ACP is the coalescing interop layer (OpenHands/Cursor/DSH, `90:76`); 90 10× plan: MCP **through the phase machine** exists nowhere (`90:230,309`). | **OPEN-CLOSEABLE** (MCP is the largest one) |
| 11 | **Multi-language output** | TypeScript-only in behavior; kinds `webapp\|cli-tool\|library\|game\|service` (`ProjectKind`, `scaffold.ts:76`), all TS (`scaffold.ts:431-433,564-598`); boundary **not stated anywhere** (217c §3 D-1, verbatim read: "the boundary is NOT stated anywhere I could find"). | Not comparable in the dossiers' tables as a single bar — 108's generators all emit one ecosystem; **"NOT IN THE DOSSIERS as a ranked bar — the repo's own decision register D-1 is the only spec".** | **PRODUCT-DECISION** (217c §3 D-1; stays a decision per the lane plan) |
| 12 | **Packaging / deploy** | `DEPLOY.md` emitted (read today in the trial tree: "template derived from P9/P12 artifacts — verify credentials before any deploy"); P9 emits canned GitHub-Actions YAML + a GCP/Firebase sketch (`engine.ts:1027,1050-1051`); `.gitignore` emitted (`scaffold.ts:491,2480`); **no git init/commit surface** found today; deploy is never executed. | Bolt/Lovable/v0 end-to-end deploy + hosting (`90:53-70`); Dyad: a git commit **per assistant message** + revert (`108:488-495`); gpt-engineer ships a `run.sh` entrypoint (`108:66-67`). | **OPEN-CLOSEABLE** for the git tail; the hosting/deploy execution half is closer to **PRODUCT-DECISION** |
| 13 | **UI/UX — a human's first ten minutes** | W11/W12 landed: tiered tabs (`RUN_TABS`, `console.tsx:153-163` — 10 tabs, primary/advanced, plain-language `purpose` lines; read today), real Export menu (`console.tsx:1501,2488` per 218 §1), keyboard focus ring (`styles.css:133` per 218 §1), plain-language status labels (`console.tsx:103-119` per 218 §2.2). **No browser pass has ever run on these pixels** (218 §4: "Nobody has looked at these pixels"); 110 quantified the density problem it inherited (5 452-line console, ~48 affordances before doing anything, `110:21-40`); no diff-review UI (103 A10). | Antigravity artifact review + inline comments (`90:96-97`); Cursor Plan Mode with reviewable plan files (`90:39`); Dyad problems panel + preview + proposal cards (`108:488-495`); bolt.diy workbench (`108:283-286`). | **OPEN-CLOSEABLE** (verify + copy); the *preview of the emitted app* sub-part is a larger, isolation-adjacent build |
| 14 | **Streaming & mid-run steering** | `stream: false` (`llm/providers/deepseek.ts:377`); no SSE/ReadableStream anywhere in `src/`; chat is persisted now (`types.ts:402` `chatLog?: ChatLogRow[]`) but one-shot. | Every competitor streams (`90:166`: Codex `codex.sse_event`, Gemini `--output-format stream-json`, Cursor steering keys); bolt.diy drives per-action status from its token stream (`108:618-628`). | **OPEN-CLOSEABLE** (S1 in 90; M) |
| 15 | **Edit/update of an existing project** *(dossier-argued axis)* | **Landed**: `patch.ts` `str_replace` primitive (unique-match refusal + graded fuzzy) + `edit` verb — dry-run default, applies only after `evaluatePolicy("repair.apply", tree:<dir>)`, lands ONE attributed ledger row with before/after hashes (CLI header `:27`; `patch.ts:2`); wired as an opt-in repair level (`codegen.server.ts:2055`; `headless.ts:2169-2270`). Residual: preservation/conflict semantics on *user-edited* trees (T4.3/TA-18 pushed twice — `remainingwaves.md:202,218-220`). | Dyad dry-run `search-replace` then apply, with `<dyad-write>` fallback (`108:432-442`); Aider ~15 edit formats + graded fuzzy chain (`107:73`); Codex `apply_patch` with a Lark grammar + graded `seek_sequence` (`107:130`); gpt-engineer line-drift hunk repair (`108:78-83`). | **CLOSED core / OPEN-CLOSEABLE residual** |

> [WD-C · 2026-09-24] CORRECTED (row 9): "bolt.diy 21 providers incl. ollama/lmstudio (108:273-277)" →
> the clone on disk today has **22** provider modules — `ls /c/Users/mnril/rt-competitors/bolt.diy/app/lib/modules/llm/providers/ | wc -l`
> → 22 (amazon-bedrock … z-ai). Dossier 108 carries the stale 21; lane 6 measured 22 too.
> (verified by WD-C, not by the lane)

**Reading the table.** Rows 4, 5, 15 are closed (and rows 4–5 are the *reason* to build this instead of
adopting any competitor). Rows 1–3 and 6–14 are engineered **to the point where the remaining gap is
evidence, not invention**: the mechanisms exist on disk and their last verification predates the wave
that landed them. That is the honest shape of "what's stopping it" — see §3.

---

## 3. What is preventing it from being the best

Ranked by consequence. Each item: the anchor that proves it today + the cost of leaving it.

**1. The factory has never passed its own acceptance test in a single run — and the only run that
counts is key-gated.** Keyed: **4/9** (M2/M3/M4/M7/M9=0, `_keyed-run.log`, 2026-09-10). Keyless:
**6/9** (M1/M3/M4=0, `results.json`, 2026-09-17). The zeros are complementary: no mode has ever
demonstrated substance + runtime + machine verification together. The last keyed run **predates every
fix of W5–W12** (policy seam, patch primitive, grader hardening, verify-kind install leg). The key is
the owner's, and its liveness is itself unverified (`taskuniverselog.md` §5 T0.10: "Everything
quality-related ultimately rests on this"; 103 G8: doctor checks env **presence only**).
*Cost of leaving it:* every "best-in-class" claim stays capped at "untested hypothesis"; the owner's
question cannot be answered with anything but the score.

**2. The product artifact on disk is stale — the multi-job fix landed but has never been
re-materialised.** The corpus emission on disk (2026-09-10) still shows four of five job files as
`export * from "./track.ts"` bridges (read today, trial-2). The fix is verified elsewhere (W8 census
`{0,0,3}` through the real scaffold path, `fixes/216k:177`) and `fixes/216k:186` states it plainly:
the LIVE corpus artifact **"re-materialises only via a fresh KEYED run (user-owned T0.10)"**.
*Cost of leaving it:* the one artifact a skeptic would open still argues the opposite of the claim.

**3. Machine verification is not promoted on the emitted path in current runs (M3/M4=0 in both
modes).** The M4 evidence string is exact: `lastTest label="unlabeled" + NO evidenceHash`; M3: "P6 gate
recorded FAIL (Machine verification promoted a tested verdict…)". The probes exist (`dod.ts` p6-verified
/ p6-brief-fit / p6-arch; `verify.server.ts` runCases) but the *promotion* — a passing machine run
stamping `label==="tested"` + evidenceHash into the run — is what the scorecard wants and what no
current run shows. *Cost of leaving it:* the flagship claim ("gates with hashed evidence, not prose")
has no current end-to-end artefact behind it.

**4. Cost/context discipline is one-seam and opt-in.** Only the P6 path records spend
(`codegen.server.ts:2118,2150` — the sole callers, verified today); the cap is unset by default; the
compaction module is vocabulary with **no wired site** (`compaction.ts` header: "no compaction site
exists in engine.ts today"); no USD anywhere. *Cost of leaving it:* an unattended/long run cannot be
bounded honestly, and the dossiers' bar here is held by three competitors (SWE-agent caps Cline's
cache-aware math, MetaGPT's `invest`) — `107:266-279`, `108:594-604`.

**5. Provider monoculture, and therefore no cross-family judge.** One real provider
(`llm/providers/registry.ts` header: "Today it knows exactly one provider"), `LlmModel` = 2 DeepSeek
ids (`llm.ts:18`), multi-provider selection "deliberately deferred". Since P6 and the classifier are
now the *same tier* (`codegen.server.ts:145`, `wild-mode.server.ts:32`), 100 §P0-03's durable fix —
**cross-family judging** — is blocked until at least a second family exists. *Cost of leaving it:* the
judge is structurally the producer's sibling; no BYOK; the quality ceiling is one vendor's roadmap.

**6. The human surface is unverified and still jargon-first.** The W11/W12 UI work is verified by
typecheck+lint+build only; **nobody has looked at the pixels** (218 §4, verbatim) even though a
Playwright smoke harness exists and was never run on them (`scripts/browser-smoke.mjs`); 110's audit
found ~48 affordances before doing anything and noun-only tab labels (`110:21-40`); there is still no
diff-review surface for gates (103 A10) and no preview of the emitted app (90 §3 rank 12; G-18).
*Cost of leaving it:* the friend's first ten minutes — the actual maker test in RESUME §1.0 — remain
untested, and "the paper trail as the product" cannot be *seen*.

---

### The single highest-leverage move

> **Run the keyed maker test on the current tree and drive its four zeroed criteria to green — M2 (the
> emitted tree's own tests), M3 (P6 journey convergence), M4 (a machine-verified verdict with an
> evidenceHash) and M9 (a clean on-time stop) — because the last keyed run (4/9, 756 s, 2026-09-10)
> predates every fix of Waves 5–12, and until that run is green no other work on this list changes the
> answer to the owner's question.**

Everything below is sequenced to make that run pass — and to make its result *legible*.

---

## 4. The plan — sequenced waves (respecting the repo's own contract)

**Constraints this plan obeys (cited where each is recorded):** flash-only delegation, ≤5 lanes,
disjoint file ownership, gate green at every boundary (`remainingwaves.md:19`, `:231-247`);
declare-or-strike — never claim what the code cannot back, strike what you cannot verify
(`AGENTS.md` honesty contract #3; exercised in `fixes/218` §2.4); the two user-owned decisions stay
DECISIONS, not work items (`fixes/217c` §3 D-1/D-2, lines 472-537); **no isolator exists on this host**
→ no sandbox claims (`taskuniverselog.md:513`; `fixes/217c` §4); the one thing engineering cannot buy is
a live model key — named where it gates below (T0.10, `taskuniverselog.md` §5).

**Step 0 — owner, before/parallel to W14 (≈15 min + key; gates everything after it).**
- Lands: a fresh keyed run's artifacts — `research/eval-out/results.json` (regenerated),
  `_keyed-run.log`, per-trial dirs.
- Command (exactly as the last one was recorded, `_keyed-run.log:2`): `npm run eval -- --keyed`
  (bounded to 1 corpus entry by default; `--all`/`--limit=N` widen it).
- Done-when: a keyed row exists with all nine criteria scored, and the project log names the unmet
  probes; the score is pasted into `taskuniverselog.md` §5 as the new T0.10 evidence.
- Depends on: a **live** key (presence-only check today, 103 G8 — treat the run itself as the liveness
  probe).
- Why first: it converts "what is preventing it" from opinion to data, and it re-materialises the
  corpus artifact (blocker §3.2).

**W14 — "Backlog + eyes on the UI" (5 lanes, ≈1.5–2 h; all files free; independent of Step 0).**
| Lane | What lands | Files | Done-when | Verify | Size | Deps |
|---|---|---|---|---|---|---|
| L1 | `nextAction` on the summary envelope (TASK-01, carried twice) **+** an `eval` verb exposing the M1–M9 scorecard (103 A18/G6) | `src/lib/headless.ts`, `src/lib/headless.test.ts`, `scripts/rapidtool-cli.mjs`, `scripts/README-cli.md` (+ doc-contract test) | `nextAction` implements 111's action vocabulary as distinguishable cases (parent decision recorded, `taskuniverselog.md:533-539`); `eval` prints one JSON object with mode/generatedAt/per-criterion scores and refuses honestly when no results exist | `node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts`; then `node --experimental-strip-types scripts/rapidtool-cli.mjs eval` | M | none |
| L2 | Finish T-107.6: token ledger records **measured** spend at the four free seams | `src/lib/token-ledger.ts`, `src/lib/verify.server.ts`, `src/lib/chat.server.ts`, `src/lib/crew.server.ts`, `src/lib/node-runner.server.ts` (+ their tests), `fixes/216w` body | each seam threads ONE `TokenBudget` (`token-ledger.ts:269-339`) and records real usage; over-cap refuses **before** the wire with a coded message; keyless path byte-identical | the four seam test files at `--test-concurrency=2` | M | none |
| L3 | Provider breadth step 1: multi-provider env selection + doctor surfacing (per the registry's own deferred list, `registry.ts:35-38`; spec `101` §4) | `src/lib/llm/providers/registry.ts` (+test), `src/lib/doctor.ts` (+test) | unknown provider id → `RT_E_VALIDATION` refusal; default path byte-identical; doctor prints the provider/model team honestly (keyless ⇒ not-configured) | `node --experimental-strip-types --test --test-concurrency=2 src/lib/llm/providers/registry.test.ts` + doctor test | M | none |
| L4 | The first real browser pass on the console, then fix/register what it shows (**retires 218 §4's caveat with evidence**) | `src/components/console.tsx`, `src/styles.css`, `scripts/browser-smoke-verdict.mjs` (only if a flag is wrong) | `node scripts/browser-smoke.mjs --url http://localhost:8080 --out-png <scratch>.png` against `npm run dev` returns ok; every finding is fixed or registered (declare-or-strike); flags confirmed against `parseSmokeArgs` at dispatch | the smoke command + `npx eslint` on touched files | M | dev server on 8080 |
| L5 | Doc-truth sweep of the counts that drifted again: README's "34 verbs" vs **35** on disk; test counts; AGENTS.md verb count | `README.md` (:9,:14,:80,:101), `AGENTS.md`, `taskuniverselog.md`, `remainingwaves.md` | every count re-derived by a command in the same commit; README-cli's doc-contract test extended to `eval` | `grep -c 'case "' scripts/rapidtool-cli.mjs` = 35; README-cli test green | S | L1 (same verb list) |

Boundary: `bash scripts/gate.sh` (parent-only, after all lanes stop) → `{"ok":true}`.

> [WD-C · 2026-09-24] CORRECTED (plan step W14-L4 — the verify command as written is NOT runnable on this host;
> the step needs the guard fix as its first task): (i) `browser-smoke.mjs` rejects `--url`/`--out-png` —
> `parseSmokeArgs` fails on any unknown `--` arg (`scripts/browser-smoke-verdict.mjs:17-40`); the url and
> outPng are POSITIONAL; (ii) even with positionals, **every output path fails on Windows**:
> `checkedOutputPath` compares the resolved `C:\…` path against the literal `/workspace\` prefix →
> reproduced `"screenshot path must be under /workspace, got C:\workspace\…"` — fix
> `scripts/browser-guard.mjs:34-42` (resolve each allowed dir), or run it in Linux/CI; (iii) chromium IS
> installed (`%LOCALAPPDATA%\ms-playwright\chromium-1234`) and `mkdirSync` creates the output dir
> (`browser-smoke.mjs:69`) — closest-runnable command after the guard fix:
> `node scripts/browser-smoke.mjs http://localhost:8080/ C:/workspace/screenshots/w13-l4.png` against
> `npm run dev` (:8080). The file to fix is `scripts/browser-guard.mjs`, not the verdict module.
> (verified by WD-C, not by the lane)

**W15 — "The zeros" (5 lanes, ≈2 h; lanes 1–3 read Step 0's log; if Step 0 has not run, their done-when
degrades to a diagnosis memo — do not patch blind).**
| Lane | What lands | Files | Done-when | Verify | Size | Deps |
|---|---|---|---|---|---|---|
| L1 | M2 leg: the emitted tree's own tests run and report honestly in the tree-run path | `src/lib/compile-check.server.ts` (+test), `src/lib/scaffold.ts` (+test), `src/lib/codegen.server.ts` (+test) | on a corpus-shaped keyless fixture, tree-run executes the tree's own typecheck+test; pass/fail/`unverified` are three distinct outcomes (the `:841,918` strings stay exact); a red tree keeps `ok:false` | `node --experimental-strip-types --test --test-concurrency=2 src/lib/compile-check.server.test.ts` | M | Step 0 log |
| L2 | M3/M4 leg: promote a machine-verified verdict into the run record | `src/lib/verify.server.ts` (+test), `src/lib/dod.ts` (+test) | a passing verification records `lastTest.label === "tested"` **with** an evidenceHash; the P6 probes read the promoted verdict; failures carry the unmet probe + hashed evidence | `node --experimental-strip-types --test --test-concurrency=2 src/lib/verify.server.test.ts` | M | Step 0 log |
| L3 | M9/M7 leg: journey stop conditions + the learning baseline read | `scripts/run-eval.mjs`, `src/lib/maker-score.ts`, `src/lib/headless.ts` (journey stop paths only) | journey terminates within its configured budget with a clean stop reason; a second same-domain run reports M7=1 citing run #1's row in `baseline`/evidence | `npm run eval -- --trials=2` (keyless; heavy — owner-window) + targeted lib tests | M | Step 0 log |
| L4 | Git landing tail (T4.2): an emitted tree can be initialized/committed **behind an explicit seat** (never the user's repo without one) | new `src/lib/git.server.ts` (name at dispatch), `scripts/rapidtool-cli.mjs`, `src/lib/scaffold.ts` (+test) | `git init` + one commit per cycle available on a scratch tree; `.gitignore` already emitted (`scaffold.ts:491,2480`); no drive-by writes to the host repo | new module test + scratch-dir CLI probe | M | none |
| L5 | Interop spike (research-only): can the 35-verb headless surface be exposed as MCP tools without breaking the honesty contract? | `research/multiagent/219g_interop_spike.md` (+ scratch server outside the repo) | memo answers feasibility/cost/risks with a real handshake trace or an explicit "could not run X because Y" | — (memo; no core edits) | M | none |

**W16 — "Continuity + re-take".**
- L1: checkpoint + `resume` verb (T-107.7; pushed twice — `remainingwaves.md:202,219`). Files:
  `src/lib/engine.ts`, `src/lib/types.ts`, `src/lib/headless.ts`, `scripts/rapidtool-cli.mjs`.
  Done-when: kill mid-P6 → resume → same state hash, same next phase, same verdict (the falsification
  test of `90` Axis 2 item 1); a restore is itself a ledgered event (`90` Axis 3 item 2). Verify:
  targeted resume probe + lib tests. Size M/L — split if needed.
- L2: patch preservation / conflict semantics (T4.3/TA-18 residual, row 15). Files: `src/lib/patch.ts`,
  `src/lib/io.ts`, `src/lib/codegen.server.ts`. Done-when: an edit cycle over a **user-modified** tree
  either preserves the user edit or refuses loudly — never silently overwrites. Size M.
- L3: eval-corpus expansion + grader-freeze audit (`research/eval-corpus/**`, `scripts/run-eval.mjs`) so
  M7/learning is measurable across domains. Size M.
- L4 (**owner**): keyed run #2 — same domain as run #1 → M7's real baseline; publish the score; flip
  README/doctor claims **only** per the new evidence.
- L5: buffer (flake attribution / doc index / whatever Step 0's log surfaced).

### The shortest path to the 10/10 maker test (Coffeehouse2Home / Property-Ledger)

The bar is fixed by the repo itself: a friend-usable real-estate app = `reexports:0, stubs:0, real ≥ 3`
+ ≥3 job modules passing their own oracle rows + a keyed end-to-end run (`remainingwaves.md:25`,
milestone M-A; RESUME §1.0 is the mission). Ordered checklist:

1. **Confirm the key** — run Step 0; the key is presence-checked only today (103 G8), so the run *is*
   the liveness probe.
2. **Keyed run #1** on the current tree (`npm run eval -- --keyed`); capture
   `results.json` + `_keyed-run.log`.
3. **Fix the zeros** (W15 L1–L3) — M2/M3/M4/M9, from that log, not from guesswork.
4. **Keyless re-verify** on the exact failure shapes (targeted tests, `--test-concurrency=2`) + a green
   boundary gate.
5. **Keyed run #2** (same domain; this is what makes M7 real) — publish the honest score.
6. **Emit the app**: emit Coffeehouse2Home to a real directory; `doctor --tree <dir>` must read
   `stubs:0, reexports:0, real ≥ 3`; `tree-run --dir <dir>` must show ≥3 job modules passing their own
   oracle rows (the M-A acceptance, on the artifact itself).
7. **Hand it over**: the tree + its `DEPLOY.md` (already emitted, read today) + `npm install && npm test`
   — and treat the friend's first real use as the acceptance test (RESUME §1.0).
8. **Flip the claims last** — README/doctor wording changes only in the same commit as the evidence;
   anything unverifiable is struck, not softened (declare-or-strike).

---

## 5. What NOT to do

Tempting moves the evidence rules out. Each with its reason:

1. **Do not claim sandbox / isolation / Docker / bwrap — and do not re-wire `runSandboxed` to imply it.**
   W11-L2 settled it: **no isolator on this host** (`docker`/`bwrap` → exit 127;
   `taskuniverselog.md:513`); `sandbox-policy.ts` wording stays until provably true (103 §4 item 12;
   AGENTS.md: "bounded local runner — not an OS sandbox").
2. **Do not advertise E2E of a running emitted app** (browser driver + dev server). 108 calls this
   "the honest hard one": the runner is not a sandbox, so such a claim needs either a real isolation
   boundary or a plainly-stated un-isolated run (`108:639-653`). Until the product decision, `emit --run`
   / `tree-run` is the maximum honest claim.
3. **Do not start multi-language work (D-1) or server-side/multi-tenant work (D-2).** They are
   owner-gated decisions (`fixes/217c` §3, lines 472-537), D-1 costs L and multiplies the isolation
   surface; D-2 contradicts the anti-cloud positioning of Axis 2 (`90:201-210`).
4. **Do not widen the tool/agent surface for its own sake.** Crew is advisory by design — "it never
   approves, rejects, advances, or deploys" (`crew.server.ts:16`); orchestration is a *consumer* of plan
   + memory, so building agents before those are proven is theater (`90:308`).
5. **Do not build a second budget system, and do not "fix" the deprecated runner.** Extend
   `token-ledger.ts` (103 §4 items 2/12); the seam helpers already exist (`token-ledger.ts:269-339`).
6. **Do not chase the losses.** Visual polish, frontier IQ, cloud fleets, community scale — `90` §7 says
   these are structural losses; the winnable war is governed, evidence-grade production (`90:318-327`).
7. **Do not claim multi-job output before a fresh census on the artifact a skeptic would open.** The
   corpus emission still shows 5 re-exports today; the census must be re-taken through a keyed run
   (`fixes/216k:186`; remainingwaves standing rule 1).
8. **Do not re-verify-and-rebuild what already landed**: `patch.ts` + `edit` verb, `policy.ts` seam,
   run-side graders + trials + leak scan, `compaction.ts` constants, verify-kind install leg, emitted
   `.gitignore`, 48 000-char runner clamp. Re-implementing any of these burns a wave and risks the tree
   (103 §4; all re-verified on disk today).
9. **Do not run the heavy gates casually.** `npm run typecheck`, `npm test`, `npm run build` are
   boundary/parent commands on this memory-tight host while lanes run — this wave's own rules exist
   because W12's red boundary came from exactly this (`218` §2.1-2.2, §5).
10. **Do not soften a failed criterion into a nicer sentence.** The repo's own history shows the fix:
    strike the claim with the falsification recorded (218 §2.4). The score is the product.

---

## 6. Plain-language bottom line (for the owner)

RapidTool is not failing because it lacks mechanisms — it is the only tool in the dossier set with
evidence-hashed gates, a one-seam approval policy, an append-only decision ledger and a frozen grader
outside the agent, and it now also has the surgical edit primitive and the cost/context vocabulary the
competitors do. **What is missing is a single, honest, end-to-end proof:** its last keyed maker run
scored 4/9 and predates every fix since; the corpus artifact still on disk still shows the old
five-names-one-module product; and machine verification has not been promoted with an evidenceHash in
any current run. **The one bar it has not cleared is its own acceptance test, taken fresh on today's
tree — and that test needs your key.** The first move is therefore step 0 of the plan: run
`npm run eval -- --keyed`, publish the real score, then let the W15 lanes close exactly the four zeros
that run names.

---

## 7. Honest limits of this dossier

- The keyed 4/9 is read from `_keyed-run.log`/`results.json` on disk (dated 2026-09-10) — **not
  re-run by me**; I hold no key and the machine is memory-tight with 5 lanes.
- The keyless 6/9 is read from `results.json` (2026-09-17) — likewise not re-run.
- Sibling lanes 219a/219b were skeletons at my read time; I did not consume them (no blocking per the
  lane plan).
- The UI state of the W11/W12 pixels is **UNVERIFIED by any human or browser** (218 §4) — that is a
  finding, not a gap in my research; the fix for it is W14-L4.
- The `browser-smoke.mjs` invocation in the plan uses `--url/--out-png` inferred from its guarded
  parsers (`browser-smoke-verdict.mjs`); confirm flags at dispatch.
- All "field bar" claims are dossier-cited only. Where the dossiers are silent (notably: an explicit
  multi-language bar, and current 2026 industry state beyond the 2026-09-16 dossiers), this dossier
  says **NOT IN THE DOSSIERS — needs a fresh spike** rather than guessing. No new competitor research
  was run in this lane.

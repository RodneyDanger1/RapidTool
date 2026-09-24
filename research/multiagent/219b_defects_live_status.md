# 219b — LANE 2: what is broken and what is SILENTLY broken (live defect status)

**Wave:** W13 · **Lane:** 2 — defects. **Read-only on src/scripts/docs**: this file is the only write.
**Sweep window:** 2026-09-24 11:15–11:45 local. **HEAD:** `aa12c6c` (W9 close) + uncommitted W10/W11/W12 work in the working tree (`git status --short` read today: 21 modified incl. `engine.ts`, `console.tsx`, `scaffold.ts`, `knowledge.ts`, `codegen.server.ts`, `errors.ts`, `alerts`, + 6 untracked `fixes/216x…217d`).
**Tree drift vs the registers:** `console.tsx` 4 958 → **6 203** lines, `engine.ts` 2 439 → **3 891**, CLI 2 938 lines — every line anchor in the 93 ledger is stale; all rows below were re-checked **by marker string** against today's bytes.
> [WD-A · 2026-09-24] CORRECTED: "**HEAD:** `aa12c6c` (W9 close) + uncommitted W10/W11/W12 work in the working tree" → true when measured (11:14:58–11:15:03, transcript `task-1.log`), but at **11:15:16** the parent committed that working tree as **`7582771`**; HEAD now reads `7582771` and `git status --short` (WD-A, 11:19–11:29) shows no modified src/scripts files (only untracked research/wave_plans files). The line anchors below were read from the same bytes, now committed — nothing else in this dossier is affected. — evidence: `git reflog` HEAD@{0} = commit `7582771` @ 2026-09-24 11:15:16; `git log --oneline -2`; `git status --short` read by WD-A. (verified by WD-A, not by the lane)

**Machine:** memory-tight; probes live in `C:/Users/mnril/w13l2_scratch/`; the two targeted test runs used `--test-concurrency=2` (2 of the ≤3 allowed).

**Provenance rule:** a claim is a `file:line` read today, a command run today (output pasted below), or an explicit UNVERIFIED. A register item already fixed is a FALSIFICATION, proven with the command.

---

## §0 — Method (what was actually run today)

```
git log --oneline -5 | cat → aa12c6c W9 close …  HEAD aa12c6ca2cee9f3c07a64f77c9bd18d655452717
git status --short          → 21 M + 6 ?? (uncommitted W10–W12 bytes; no git mutation performed)
node --experimental-strip-types C:/Users/mnril/w10l5_scratch/scan_errors.mjs
   → files 215 / catch_blocks 377 / dot_catch 24 / signal 162 / empty 89 / swallow 126 / detached 24
     (saved: C:/Users/mnril/w13l2_scratch/scan_today.json)
node … scripts/rapidtool-cli.mjs summary --project C:/nonexistent_nope.json   (cwd OUTSIDE repo)
   → EXIT=1 · stdout 204 B: one coded JSON envelope {code:"RT_E_PROJECT_MISSING", exit_code:1} · stderr 0 B
node --experimental-strip-types --test --test-concurrency=2 src/lib/honesty-guards.test.ts
   → # tests 5 / # pass 5 / # fail 0
node --experimental-strip-types --test --test-concurrency=2 src/lib/errors.test.ts
   → # tests 34 / # pass 34 / # fail 0
+ ~20 read-only grep/sed batches against today's working tree (all file:line below are from those reads)
```

**Freshness caveat (honest limit):** the lane plan's "green as of 11:08" predates `src/components/console.tsx`'s mtime **11:09:23** by ~1 minute. I did **not** run the full gate (forbidden); "the current console edit is gate-green" is **UNVERIFIED**.

---

## §1 — The registers, swept and re-verified TODAY

Status legend: **FIXED** (bytes prove it) · **OPEN** (bytes still match the defect) · **PARTIAL** · **UNVERIFIED**.

### 1.1 `research/multiagent/93_design_flaws.md` — DF-01 … DF-39

> The 93 ledger has **no status column** (its §0 table carries ID/Rank/One-line/Location only, lines 20–60 read today), so every row was re-verified from scratch.

| ID | Claim (93, 1 line) | Status TODAY | Evidence read/grepped today | Blast radius |
|---|---|---|---|---|
| DF-01 | P6 = phase-gate simulator; brief never enters code | **FIXED (honest-by-label)** | Keyless artifact retitled `"P6 placeholder module (deterministic template)"` (`engine.ts:873`) + source comment "the p6-brief-fit probe records that FAIL honestly" (`:872`); probe fails the toy **by construction** (`dod.ts:527-548`); keyed path = `liveP6Synthesis` (`engine.ts:2872-2885`, codegen refusals logged `codegen.server.ts:72-80,2186`). Residual: keyless floor is still a simulator — now labeled and gate-FAILed. | Was P0; now contained |
| DF-02 | P8 "interface contract" describes RapidTool's own console | **FIXED** | `grep "Surfaces: intake" → 0 hits`; P8 rewritten client-shaped with B-18 keyless tail "prototype pending — … a declaration …, not an implementation" (`engine.ts:931-943`) | Was P0; contained |
| DF-03 | P1 topology artifact fixes every build to agent-harness domain | **FIXED** | P1 now emits brief verbs/nouns (`engine.ts:694-710`), title switches only when the brief itself carries agent vocab (`:690-691,708`), explicit "no parallel, event, or failover topology is claimed beyond what the brief states" (`:705`) | Was P0; contained |
| DF-04 | Unimplemented capabilities stated as fact (MCP/A2A, Ollama, Brave MCP, checkpoints) | **PARTIAL** | `a2a`/`search.brave`/`bind_policy`/`RRF(k=60)`/`Ollama` claim strings → **0 hits** in `engine.ts` artifacts; `grok-4.5` only in legacy-hydrate mapping comments (`:1853,1957,1970`); P10 now "No remote model inference or edge handoff is claimed" (`:1064-1071`); P11 "declared, not bound at runtime" (`:1081-1098`). **Residual:** P7 artifact still says `"deterministic 0–12 graph with HITL, MCP/A2A, and ADRs"` (`engine.ts:922`) with no disclaimer — and **no MCP/ACP server module exists** (`ls src/lib | grep -i mcp` → exit 1; `grep McpServer` → 0) | Agent-facing prose overclaim (1 residual) |
| DF-05 | P4 gate asks approval of a 256 MB/30 s isolate that does not exist | **FIXED** | Gate prompt now: "Declared-not-implemented (do NOT approve as fact): 256 MB …" alongside the real `ramMb …unset` runtime values (`engine.ts:794-800`) | Was P0; contained |
| DF-06 | "Durable checkpoint" artifact claims a persistence layer that doesn't exist | **FIXED (struck)** | `grep "Durable checkpoint key" → 0`; `grep "checkpoint" src/lib/engine.ts → 0` | Contained |
| DF-07 | Spec graph = fixed web-app topology presented as the build's plan, no label | **PARTIAL** | `planSpecGraph` still emits the fixed frame `src/api/routes.ts`, `src/state/store.ts`, `src/ui/console.tsx`, `tests/oracle.spec.ts` (now + lattice jobs + `src/domain/<domain>.ts`) (`algorithms.ts:699-750`); **no template label** in the tab (`console.tsx:2934-2946`) or the packet section (`packet.ts:413-416`) | Coding agent uses a template file plan |
| DF-08 | Gates advisory by default; FAIL-gated phases read "sealed" | **PARTIAL** | Keyed default flipped ON: `enforceDod: … : keyedDeepSeekConfigured()` (`engine.ts:1884-1885`); delivery record carries census "… N failed gates: <ids>" (`engine.ts:1143-1157`); console end-state banner "Sealed with N failed gates — review the gate records" (`console.tsx:2400-2412`); phase record "gate FAIL recorded at completion — DoD gates are advisory, so the phase still moved" (`console.tsx:5790,5796`). **Residual:** the rail still prints `{done}/{total} sealed · {pct}%` unqualified (`console.tsx:3178`; `:435`) | Presentation honesty mostly landed |
| DF-09 | Approval needs no note even over an unmet DoD / override | **OPEN (loud)** | `approveHitl` note optional (`engine.ts:1650`); `store.approve` passes `{decidedBy:"human", force, requestedAt}` — no note (`store.ts:1529-1534`); console `onApprove(force)` → `approve(projectId, { force })` (`console.tsx:1838-1841`); only **rejection** carries the ≥12-char guard (`store.ts:1547`, `console.tsx:1849-1853`). Corrob.: `fixes/123` CG-16 still lists note-symmetry as backlog (P1) | Governance hole — approvals with no rationale over failed gates |
| DF-10 | No undo/checkpoint/restore anywhere | **OPEN** | `grep "checkpoint" console.tsx/store.ts` → only the dead empty-state string (`console.tsx:3072`) | Roadmapped; no user surface |
| DF-11 | HITL evidence = artifact titles only | **PARTIAL** | `evidenceForGate` now rows: last-test caption, oracle count, contracts, P-artifacts, spec order, crew reviewer (`console.tsx:459-511`) — still titles, **no diffs / probe ids / hashes** | Approver can't see criteria detail |
| DF-12 | Chat not persisted, not streamed, no stop | **PARTIAL** | Persistence landed (`chatLog` on Project, `types.ts:402`; console reads it `:5358`); stream/stop **absent and captioned**: "one-shot reply — … (no stream/stop yet)" (`console.tsx:5619-5621`) | Honest limitation, visible |
| DF-13 | Chat context cap invisible; no meter | **FIXED** | Context meter renders `… chars · context v…` + idle/unavailable states (`console.tsx:5383-5551`; cap `CHAT_CONTEXT_MAX_CHARS = 3200`, `chat.server.ts:53`) | — |
| DF-14 | Crew tab shows static seats; live transcript lands elsewhere, unpresisted | **PARTIAL** | Tab labeled "A set of advisory agent roles for the current phase" (`console.tsx:1328-1330`), empty state "No crew yet — a crew is the advisory set of agent roles" (`:2959`); run transcript is **component state** "kept on screen until the next run" (`:207`) | Transcript still evaporates |
| DF-15 | Oracle tab shows cases never run; implies acceptance tests | **FIXED (labeled)** | Tab copy: "Template-derived given/expect prose plus an executable machine-verify block. They describe acceptance; they do not run the product." (`console.tsx:1322`) | — |
| DF-16 | Verify-fix loop invisible in UI | **FIXED** | "Machine verify (executable)" block always visible + rerun (`console.tsx:3004`, `5261-5305`) | — |
| DF-17 | Vault read-only vs 90 §9.3 human edit surface | **OPEN** | "Pure read-only view over vault.ts — no store writes" (`console.tsx:3931-3933`) | Human-edit loop missing |
| DF-18 | Scorecard UI drops the "deterministic estimate" label the packet carries | **OPEN (loud)** | Packet carries `(deterministic feasibility estimate — template-derived, not live research)` (`packet.ts:498`); `ScorecardBlock` renders overall/axes/competitors with **no caveat** (`console.tsx:3303-3362`); grep "feasibility\|template-derived\|not live research" in console.tsx → **0** | The one headline number, unlabeled in the UI |
| DF-19 | Live research never updates scorecard/competitors | **OPEN** | `scorecard()` written only in P0's apply (`engine.ts:532-562`); `liveLayer` appends research corpus/artifacts only (`engine.ts:2962-3001`) — no scorecard write | Scorecard ignores live corpus |
| DF-20 | P5 title "…& Self-Learning" — no loop behind it | **PARTIAL** | Title kept; subtitle now honest: "self-learning: lesson capture live (L1/L2/L5), cross-run retrieval partial — roadmap" (`phases.ts:47-49`); lesson writers + probe-tag wiring exist (`knowledge.ts:952`) | Title vs reality now labeled |
| DF-21 | P7 competitor matrix = 5 hardcoded domains + 2 shared rows | **PARTIAL** | Now 7 domain buckets (logistics/health-ops/finance-ops/marketplace/operations/real-estate/construction) + 2 shared, **all** stamped `source:"illustrative"` (`engine.ts:116-149`); artifact carries "Illustrative competitor templates (source: illustrative — NOT live research)" (`:916`) | Structurally still canned; honestly labeled |
| DF-22 | Rejection response is keyword-matched template prose ("Deltas applied") | **OPEN** | `rejectionResponseBlock` still appends `"Deltas applied this regeneration:"` + regex-matched lines to the artifact (`engine.ts:266-283`, used at `:1404`) — no label that deltas are keyword-matched | Artifact implies bespoke deltas |
| DF-23 | Wild strip renders pauses without the machine-readable code | **OPEN** | Strip renders RUNNING/PAUSED/STOPPED/IDLE words + reload honesty note (`console.tsx:1055-1135`); no `RT_E_*` code badge (grep `RT_E` console → 16 hits, none wild-pause) | Headless operator can't classify pause |
| DF-24 | Learning pillars unwired to any run | **PARTIAL** | Wired since: harvest→headless (`headless.ts:3242-3245`), knowledge lesson writers + `packet --knowledge` seam (`packet.ts:205`), verify→UI/headless. Still orphaned: `watcher.ts` (no caller anywhere), `bench/swarm/ast-mine` CLI-only | Half the pillar shelf still dark |
| DF-25 | Six handoff profiles landed but never wired | **OPEN** | `exportProfiles` production callers → **0** (only `packet.test.ts`); console "Copy phase handoff" still uses generic `phaseHandoff` (`console.tsx:2004`) | Underdelivered headline feature |
| DF-26 | Packet truncation marker buried; no UI affordance | **OPEN (loud)** | `TRUNC_MARKER` + hard truncation (`packet.ts:17,545-569`); console renders packet as plain body, **no banner/accounting** (grep "TRUNC" console → 0) | Downstream agent silently loses sections |
| DF-27 | Home CTA silently disabled under 12 chars; no counter/guidance | **OPEN** | Still `disabled={brief.trim().length < 12 || busy}` (`console.tsx:1448`; guard `:1401`) — no counter/why; only generic hint "Phase 0 starts locked to the brief" (`:1455`) | First-run onboarding |
| DF-28 | Templates = 4 ops briefs; demo project presented as a real build | **OPEN** | `seedIfEmpty` still creates `"Northwind Dispatch"` unlabeled (`store.ts:1731-1737`); no demo/sample badge found in console (grep "demo\|sample" → DesignSample only) | First-run user runs a demo believing it's theirs |
| DF-29 | Run header ≈25 controls, no grouping | UNVERIFIED | Not re-derived (cosmetic); W12 lane D did land an Export menu (`console.tsx:2488` per 218 §1) | Cosmetic |
| DF-30 | Memory sidebar 8-row cap, no vault link, provenance unrendered | **OPEN** | `project.memory.slice(0, 8)` (`console.tsx:3063`); no show-all (grep `showAll` → 0) | Hidden rows / no provenance |
| DF-31 | Dead empty-states ("open a brief first" / "until Phase 0 writes") | **OPEN** | Both strings still present (`console.tsx:2947`, `:3072`) | Dead copy |
| DF-32 | Artifact tab: no kind filter/sort/edit | **OPEN** | `ArtifactPane` = list + copy only (`console.tsx:3549-3640`) | Weak work surface |
| DF-33 | Vault and packet downloads share one filename | **OPEN** | Both call `downloadFilename(project, "md")` (`console.tsx:2044` vs `:4149`) → `slugName(name).md` (`io.ts:421-423`) | Overwrite prompt every time |
| DF-34 | Markdown renderer subset (no tables/links/inline-code) | **OPEN** | `MarkdownBody` cases h1–h3/p/li/code only (`console.tsx:3698-3760`+); table/link appear only as real JSX (`:3329`) | Lossy rendering (safe) |
| DF-35 | Diagram tab: static data-URI image, no pan/zoom | **OPEN** | `data:image/svg+xml…` `<img>` still (`console.tsx:4943`) | Non-interactive graph |
| DF-36 | Wild toggle degrades to local-only but looks enabled | **FIXED** | Static binding to store contract; source comments state "no local-only fallback, no 'not wired' labels remain" (`console.tsx:533-539,700-702`) | — |
| DF-37 | P12 ADRs/OpenAPI canned, disconnected from the ledger | **PARTIAL** | ADRs now brief-derived (nouns/pipeline/surfaces per project, `engine.ts:1141-1156`) + "declarations, not runtime bindings"; still deterministic boilerplate | Dilutes audit axis |
| DF-38 | CLI lacks eval/replay/restore/plan verbs | **OPEN** | No `case "eval"\|"restore"\|"replay"\|"plan"` (`rapidtool-cli.mjs`); verb count today = **35** `case "` labels (grep -c) vs AGENTS.md's "34 verbs" — doc drift | No replay/restore operationalization |
| DF-39 | LLM-extracted constraints (P2) never consumed by the scheduler | **OPEN** | Artifact pushed at `engine.ts:3021-3031`; no consumer of extracted constraints found (`grep constraint` → lattice/scorecard only, `algorithms.ts:438-449`) | "Extracted constraints" constrains nothing |

> [WD-A · 2026-09-24] CORRECTED (DF-09 row anchor): "`approveHitl` note optional (`engine.ts:1650`)" → the optional note field is at `engine.ts:1631` (`note?: string`) and its write is `note: opts?.note,` at `engine.ts:1663` (inside the `HitlDecision` row); `engine.ts:1650` is `const next = Math.min(12, phase + 1) as PhaseId;` — an unrelated line. The DF-09 finding itself is VERIFIED: `store.ts:1529-1534` and `console.tsx:1838-1841` pass no note, rejection alone carries the ≥12-char guard (`store.ts:1547`). — evidence: `grep -n "note:" src/lib/engine.ts` + `sed -n '1658,1668p' src/lib/engine.ts` (WD-A read 2026-09-24 11:29). (verified by WD-A, not by the lane)

### 1.2 `fixes/216y_oracle_and_error_audits.md` §2.3 — G1–G7 (re-run today)

| # | Status TODAY | Evidence |
|---|---|---|
| G1 | **FIXED** | CLI probe (today, cwd outside repo): exit 1 · stdout one coded envelope `RT_E_PROJECT_MISSING` · **stderr 0 B**. Code: `return respond(...)` on both refusal branches (`rapidtool-cli.mjs:381,388`; fix note `:118`) |
| G2 | **FIXED** | `runPhaseAsync` catch now returns `{...floor, logs:[…, liveLayerFailureRow(phase, err)]}` (`engine.ts:3258-3266`); row = `level:"warn"`, `event:"p<phase>.live.failed"`, "deterministic floor used instead" (`:3230-3246`) |
| G3 | **FIXED** | Codes registered (`errors.ts:53-56`) + classifier branches EACCES/EPERM→PERMISSION_DENIED, ENOSPC→DISK_FULL, EADDRINUSE→PORT_IN_USE, connect/DNS family→NETWORK_UNREACHABLE (`:196-204`); `errors.test.ts` **34/34 green** (ran today) |
| G4 | **OPEN** | `grep "empty catch\|unchecked\|unhandled\|swallow" src/lib/compile-check.server.ts` → **0 hits**; no emitted-tree error scan exists |
| G5 | **OPEN** | Re-grep today: every file under `w9l5_emit/src` + `/tests` → `RT_E` count **0** |
| G6 | **FIXED** | `EnvelopeReadFailure`/`readFailure`/`envelopeReadLogEntry` seam (`codegen.server.ts:565-750`); sink wired into the live call sites (`:897`, `:2605,2608`, `:2952…`); event `p6.synthesis.envelope.unreadable` (`:749`) |
| G7 | **RESOLVED as decided (documented)** | The 4 code-free catches remain (`auth/popup.server.ts:163,169,173`; `routes/__root.tsx:69`) but each now carries an adjacent multi-line comment explaining throw-source + why ignoring is correct (`popup.server.ts:158-172`; `__root.tsx:69`) |

### 1.3 `fixes/217b_watchdog_verification.md` §5 — F1–F4

| # | Status TODAY | Evidence |
|---|---|---|
| F1 | **FIXED** | `...probeTagsFromSignature(signature)` now spread into `lessonRow`'s tags (`knowledge.ts:952`); the formerly-red pin `honesty-guards.test.ts` is **5/5 green** (ran today — it failed 4/5 in W11 *because* of this gap) |
| F2 | **OPEN as registered (not fixed)** | clamp marker window ≈64–118 for custom caps; no change found; 218 §3.3 keeps it registered; guard test pins only healthy caps (217b §1.4 E1). Not re-probed today (UNVERIFIED beyond the register) |
| F3 | **FIXED** | `fixes/216z` §1 item 2 now explicitly **STRUCK (FALSIFIED 2026-09-24 by W11-L2)** with the evidence (`216z_w10_landing_record.md:33-39`) |
| F4 | **FIXED** | `wave_plans/W11/README.md:7` now cites `fixes/216z_w10_landing_record.md` (exists); the dead `217_w10_close` citation is gone |

### 1.4 `fixes/218_w12_close_record.md` §3 — carried forward (re-checked today)

| # | Item | Status TODAY | Evidence |
|---|---|---|---|
| 1 | TASK-01 `nextAction` ABSENT in `headless.ts` | **STILL TRUE — FALSIFICATION ATTEMPT FAILED** | `grep nextAction` in `headless.ts` / `types.ts` / `cli.mjs` → **0**; only the UI-side `uiNextAction` exists (`console.tsx:311`, used `:1806-1811`). The machine wire contract is still missing |
| 2 | Skeleton logs unfilled (217e/f/h/j/k/l/m/n) | **PARTIAL** | All now carry content (sizes today: 217e 2 170 B · 217f 1 870 B · 217h 6 500 B · 217i 16 967 B · 217j 2 911 B · 217k 2 226 B · 217l 2 649 B · 217m 2 862 B · 217n 4 222 B; mtime 09-24 11:04) — parent notes, per 218 §3.2; but 217h states "Status: IN PROGRESS / BOTTOM LINE pending" and 217i "Status: IN PROGRESS — updated on each poll" |
| 3 | F2 registered, not fixed | **STILL TRUE** | see F2 row |
| 4 | G4/G5 → W13 | **STILL OPEN** | see G4/G5 rows (re-verified today) |
| 5 | L3 anchor spot-checks owed | **RESOLVED (internally inconsistent doc)** | 218 **§2.6** says "L3's anchor spot-check (owed by WD-1) — DONE by the parent. 7 anchors verified"; §3.5 repeats the old "still owes 5". I spot-checked 2 of that list today: `chat.server.ts:53` = `export const CHAT_CONTEXT_MAX_CHARS = 3200;` ✓ and `engine.ts:252` = `function art(` ✓ |
| 6 | 217h/217i partially filled | **STILL TRUE** | see row 2 |

### 1.5 `RESUME.md` §4 (1–19) + §6.1

| # | Item | Status TODAY | Evidence (today's bytes) |
|---|---|---|---|
| 1 | T-07 emit refuses/banners on uncleared red tree-run | **FIXED** | Red-tree guard + top-of-README banner `"> ## RED TREE-RUN — THIS ARTIFACT IS NOT VERIFIED (RapidTool T-07 / F-07)"` (`headless.ts:1214-1362`) |
| 2 | TA-2 harness must not stamp bare `decidedBy:"human"` | **FIXED** | Actor model: machine = `{decidedBy:"autopilot", seat:"harness"}` (`headless.ts:736`); human needs the seat token (`:730,775-776,841`); run-eval comment "216 TA-2: `approve()` never mints decidedBy:'human' for a [machine seat]" (`run-eval.mjs:649-651`) |
| 3 | T-04/T-05 scaffold entry silently dropped / UI imports unwritten path | **FIXED — FALSIFIED AS OPEN** | Landed in 216d (2026-09-16): exact-match entry allowlist + loud refusals (`scaffold.ts:211-228`), pins exist today at `scaffold.test.ts:756/803/887` (read: refused row in no file + README line, verbatim entry, computed entry import). RESUME row is stale |
| 4 | TA-15 multi-job emission | **LANDED (per W8 commit + code), end-to-end UNVERIFIED today** | Census machinery + README census lines (`scaffold.ts:1093,2020-2021`); `git log` W8: "TA-15 ACCEPTANCE MET through the scaffold path (census {0,0,3})". Not re-emitted today |
| 5 | T-09/T-10/T-15 prose-in-code / unsatisfiable prompt / Math.random | **LANDED (code-backed)** | Math.random refused + re-prompt naming the token (`codegen.server.ts:447-449,1005,1972,2968`); determinism guard `check-assertion-gaps`-adjacent scanner exists (`determinism-guard.test.ts:28,118`). Tests not re-run |
| 6 | T-11 gate lesson capture on green seal | **FIXED** | Red seal mints no lesson + `p6.seal.unmet` warn (217b §1.1 legacy; pin green today) |
| 7 | T-13 10 jobs vs materialised 5 | **LANDED** | Counted `p6.jobs.shortfall` warn row (`engine.ts:1336-1364`, caller `:1497-1499`) |
| 8 | T-14 P7–P12 unreachable / report "7 of 13" | **LANDED** | `phaseCoverage` + `phaseCoverageLine` "7 of 13 phases executed / 0 artifacts from P7–P12" (`phases.ts:160-240`), surfaced in the packet (`packet.ts:227,436`) |
| 9 | T-17 assertion-gap lint | **FIXED** | `scripts/check-assertion-gaps.mjs` wired as gate 3 (`gate.sh:9-10,87`; gate id `assertionGaps` `:146,178`) |
| 10 | T-18 tree-run must build+test | **LANDED (with honest skip legs)** | tree-run runs the tree's own `typecheck`/`test`/`build` scripts (`compile-check.server.ts:899-923`); specs via `node --test` (`:656`); no-`node_modules` → explicit UNVERIFIED text `"npm run build" was NOT executed; … not a fabricated pass` (`:841,918`); install via `npm ci`/`npm install` when lockfile present (`:1059-1080`); injected seam marked `mocked:true` |
| 11 | T0.4 `reasoningEffort` for P6 + assert | **PARTIAL / UNVERIFIED** | Provider wire: pro default `{thinking:{enabled}, reasoning_effort:"high"}`, flash/synthesis shape has **no** `reasoning_effort` (`llm/providers/deepseek.ts:368-374`; tests assert the shapes `deepseek.server.test.ts:447-492`); P6 synthesis deliberately `thinking:false` (`codegen.server.ts:2563-2571`, fixes/154/156). The task's "assert it for P6" is not evidenced |
| 12 | TA-3 counts executable; `fixtures` missing from README-cli | **PARTIALLY FALSIFIED** | `fixtures` IS documented (`scripts/README-cli.md:14,22`) and dispatched (`rapidtool-cli.mjs:896`); stale count strings "1632/1957/261" → 0 hits in README/AGENTS. Executable count check: UNVERIFIED. **Drift found:** AGENTS.md says "34 verbs", grep today = 35 |
| 13 | TA-21 P9 deploy-artifact honesty | **OPEN/PARTIAL** | P9 artifacts still canned (`"GitHub Actions workflow"` `engine.ts:1026-1044`, `"IaC sketch"` `:1046-1055`); the HITL prompt says "…routing **templates** to be written" (`:1062`) but the artifact bodies carry no "template — not executed" label |
| 14 | TA-1 verify the 4 `[lane-reported]` blockers | **MIXED** | P1-02 no scheduler: grep cron/daemon in cli/headless → 0 (still true) · P1-03 `humanFixtures` writer: grep → 0 (still true) · P1-04 harness human-stamp: addressed by TA-2 fix · P1-06 = TA-21 above |
| 15 | 111 UI tasks + 110 derived list | **LANDED (per W12 lane D + bytes)** | Tab tiering/RunStatusPanel/export menu/focus ring per 218 §1; `RUN_TABS` tiers + Export menu present in today's console (`console.tsx:158,2488`) |
| 16 | 107/108 steals (str_replace, provider registry, policy engine, run-side fixtures, edit verb) | **LANDED** | `edit` verb (`rapidtool-cli.mjs:1135`), `fixtures` (`:896`), provider modules (`src/lib/llm/providers/*`), W5 commit "policy routing, provider registry, run-side graders" |
| 17 | 112 remaining T5/T9/T11/T12 | **PARTIAL** | T5 landed: `lesson --advise` / `--verify` with anchors (`rapidtool-cli.mjs:50-51,1869`); T9 `canonicalStem` fixed-point test landed (218 §2.3; `algorithms.ts:1199`); T11/T12 UNVERIFIED |
| 18 | 109 remaining C-02/C-06/C-08/C-09/C-10 | **FALSIFIED (mostly) + C-09 re-verified today** | C-09: `entries()` returns `[...this.cache]` (`knowledge.ts:363-366`) — copy confirmed; C-02/C-06/C-08 falsified by W12 lane C (218 §1, parent-spot-read); C-10 test added (`218 §2.3`) |
| 19 | T0.10 keyed eval re-run | **UNVERIFIED (owner: user, keyed)** | Not performed (no keyed runs by this lane; forbidden by budget) |

**§6.1 unverified-claims list** — statuses unchanged today: C-01 reproduction gap (UNVERIFIED, needs keyed), F-04/F-05 flash re-confirm (UNVERIFIED; the code-side guards landed), Lane-A test files (resolved by parent's green suite 218 §5), Lane C %TEMP% numbers (as noted), gpt-pilot worm (verified clean before; not re-checked today).

---

## §2 — The silently-broken class (own hunt; numbers re-derived today)

**Re-derived scan** (`scan_errors.mjs` re-run today): **215 files / 377 catch blocks / 24 `.catch()` handlers / 162 signal-bearing / 89 empty / 126 no-signal-swallow / 24 detached**. The classifier is heuristic (≤2 statements + no signal token = "swallow"); every "empty" entry read in the sample is comment-explained best-effort/telemetry, except the 4 G7 sites (each now documented). I read the swallow list filtered to engine/store/headless/codegen/knowledge/verify/scaffold/cli — most are honest sentinel returns (`return null` after a documented degrade).

**Real hits, ranked by how a user/agent would be misled:**

| Rank | Hit | What it hides | Evidence |
|---|---|---|---|
| 1 | **Packet truncation with no UI affordance** (DF-26) | A downstream coding agent pastes a packet whose tail was cut at 14 000 chars, marker buried in body text | `packet.ts:17,545-569`; console has **0** truncation UI (grep) |
| 2 | **Approval note hole** (DF-09) | The record shows an approval over a failed/overridden gate with **no rationale at all** — the audience (auditor, future agent) reads a clean decision row | `engine.ts:1650`; `store.ts:1529-1534`; `console.tsx:1838-1841` |
| 3 | **Keyed narrative/constraint LLM failures are silent** | `catch { /* narrative unavailable → deterministic result stands */ }` (`engine.ts:3012`) and the constraints twin (`:3030`) log **no row, no code** — a keyed run where the model call failed is byte-identical in the record to a deliberately keyless one (artifact simply absent); same shape for an unexpected P6-synthesis throw (`:2883-2885` — *normal* refusals do log `p6.synthesis.refused`, `codegen.server.ts:2186`) | reads today; `grep "unavailable →" engine.ts` → 3 sites |
| 4 | **`archProductComplete` computed, never surfaced** | The honest "skip ≠ product-complete" distinction for the tree probe exists only in tests + a comment; no UI/CLI/packet consumer → keyless single-module "passes" p6-arch vacuously with no visible signal | `dod.ts:232,546`; consumers = `gates.test.ts` only (grep) |
| 5 | **UI-path fallback catch is comment-only** | `synthesizeAsync`'s catch degrades to the deterministic floor with no failure row (the normal path delegates to `runPhaseAsync`, which *does* log; only the import-failure/unexpected path is silent) | `store.ts:573-578` vs `engine.ts:3258-3266` |
| 6 | **`verify.server` case-list parse returns `null` with no signal** | An unparseable model case list is indistinguishable from "no cases" — caller handling **UNVERIFIED** | `verify.server.ts:271-276` |

**Label-mint audit (mint sites grepped):** no evidence-free mints found —
`tested` requires `gate.passed === true` before minting (`headless.ts:2493-2515`); `decidedBy:"human"` requires the seat token (`headless.ts:775-841`); `verifyKindDir`'s skip is honest "Absent is not a pass" (`compile-check.server.ts:1287-1300`); a throwing DoD probe = unmet criterion (`dod.ts:637`). This is a **confirmation**, not a finding.

**What W11-L5 landed does surface:** a degraded keyed phase now carries `p<phase>.live.failed` (warn) "deterministic floor used instead" on the returned project's log rows (`engine.ts:3230-3246,3266`) — the record is distinguishable from a deliberately deterministic run. Whether that row is rendered in a specific UI list = UNVERIFIED (not traced).

---

## §3 — Absolute claims in the docs vs the code (8 load-bearing)

| Claim (verbatim, doc line) | Verdict | Proof |
|---|---|---|
| AGENTS.md:70 "a red-gate complete seal exits 1 (`RT_E_GATES_FAILED`, `sealedWithFailures: true`)" | **TRUE** | `sealedWithFailures = outcome==="complete" && !sealHonesty(...).clean` (`headless.ts:715,1019`); CLI exit-1 branch (`rapidtool-cli.mjs:457-490`); code registered (`errors.ts:38,386`) |
| AGENTS.md:85 "Keyed runs default enforce-DoD ON" | **TRUE (creation path)** | `enforceDod: typeof input.enforceDod === "boolean" ? … : keyedDeepSeekConfigured()` (`engine.ts:1884-1885`); hydrate of **legacy** payloads defaults `false` (`:2361`) — consistent with "runs default", worth knowing |
| AGENTS.md:91 "telemetry … must NEVER change engine behavior (purity-tested)" | **UNVERIFIED** | Found purity tests for compile-check/patch/policy/judgment (`*.test.ts` grep) and an rt-client latch comment (`rt-client.test.ts:125`), but **no test file found** that pins rt-events/rt-client telemetry against engine behavior |
| AGENTS.md:76 "No fabrication … never invented" | **TRUE with one residual counterexample** | Everywhere sampled, artifact claims now carry B-18/label tails; residual: P7 artifact prose "…with HITL, MCP/A2A, and ADRs" (`engine.ts:922`) — no MCP/ACP module exists (`ls`+grep → 0) |
| README.md:93 "tree-run … runs the tree's own `npm run typecheck`+`npm test`; a failing tree can never be `ok:true`" | **TRUE** | `runProjectScript(work,"typecheck"…"test"…)`, `red.length===0` verdict (`compile-check.server.ts:899-923`), specs-green floor (`:1029`) |
| AGENT_GUIDE.md:13 "gates … never block the deterministic [keyless run]" | **TRUE** | advisory branch + keyed flip (`engine.ts:1884-1885`; console end-state distinguishes FAILs) |
| AGENT_GUIDE.md:81 "It never fabricates model output" | **TRUE (keyless)** | not-configured envelopes; codegen logs refusals (`codegen.server.ts:72-80`) |
| RESUME.md §5.4 "Skip ≠ green. Stubs ≠ complete." | **TRUE in emitted specs** | `test.skip("<id> — NOT IMPLEMENTED")` visible + census line (`scaffold.ts:2020-2021`) |

---

## §4 — The three loudest (open or silent)

**1. Approval requires no rationale — even over a FAILED gate (DF-09, enforced hole).**
*User sees:* an approve button next to evidence; a tickbox for override. *Actually happening:* `approveHitl`'s `note` is optional and **no caller passes one** — the console calls `approve(projectId, { force })` (`console.tsx:1838-1841`), the store forwards `{decidedBy:"human", force, requestedAt}` (`store.ts:1529-1534`), the engine writes `note: opts?.note` → `undefined` (`engine.ts:1650`). Rejection, by contrast, is triple-guarded at 12 chars. *Proved:* the greps above + the pre-existing backlog row `fixes/123` CG-16 ("HITL evidence cards … + note symmetry", still open). *Cost:* the audit trail records go/no-go decisions with no stated reason — exactly the 15-second null-note approval class 87/88 caught; a self-improving factory cannot learn from approvals it cannot read.

> [WD-A · 2026-09-24] CORRECTED: "the engine writes `note: opts?.note` → `undefined` (`engine.ts:1650`)" → the write is at `engine.ts:1663`; `:1650` is `const next = Math.min(12, phase + 1) as PhaseId;`. Every other reference in this item verified exact today: `store.ts:1529-1534` (no note passed), `console.tsx:1838-1841` (`approve(projectId, { force })`), `store.ts:1547` (rejection's ≥12-char guard), `engine.ts:1631` (`note?: string`). (verified by WD-A, not by the lane)

**2. The Agent Packet can be truncated with no visible warning (DF-26, silently broken for agents).**
*User/agent sees:* a packet to paste into a coding session; marker buried mid-body if noticed. *Actually happening:* the compiler hard-truncates at 14 000 chars and appends `…[TRUNCATED — regenerate at a HITL gate for the full plan]` (`packet.ts:17,545-569`); the console renders the packet as plain body text with **no banner, no "sections cut" accounting** (grep "TRUNC" → 0). *Cost:* the downstream agent silently loses the ledger tail / latest sections — the exact artifact the product exists to deliver.

**3. The Phase-0 scorecard drops its own honesty label in the UI (DF-18).**
*User sees:* "Phase 0 scorecard" with an overall score, verdict, axis cards and a competitor table. *Actually happening:* the packet version of the same data carries `(deterministic feasibility estimate — template-derived, not live research)` (`packet.ts:498`); `ScorecardBlock` renders none of it (`console.tsx:3303-3362`; grep "feasibility/template-derived/not live research" in console → 0). *Cost:* the first number every operator reads looks like researched output; the caveat exists in the product, one tab away. (Runners-up for this slot: DF-28's unlabeled demo seed and DF-38's missing `restore`/`replay` verbs.)

---

## §5 — Plain-language bottom line

The P0 "wrong product" family is genuinely contained — P6's toy is labeled and fails a `p6-brief-fit` gate by construction, P8/P4 gates no longer approve fictions, and the retired capability strings (Ollama, Brave-MCP bind, RRF(k=60), durable checkpoints) are gone from the artifacts — so the headline "fabrication" class is mostly closed, verified by marker greps today. What remains broken is narrower but real: **approvals can be recorded with no rationale at all (DF-09)**, the **Agent Packet can be truncated without the console saying so (DF-26)**, and the **scorecard's template-estimate caveat is dropped in the UI (DF-18)** — the exact class of quiet mislabeling this repo treats as its worst failure. The old defect ledger is largely stale in the opposite direction: G1/G2/G3/G6, F1/F3/F4, T-04/T-05/T-07/T-13/T-14/T-17, TA-2 are all genuinely fixed with today's bytes, and the remaining named gaps are honest ones (G4/G5, chat stream/stop captioned as such, no checkpoints). The most systemic unfinished thing is not a lie but an omission: the machine contract still lacks `nextAction` (218 §3.1 confirmed again today), and the silent-failure hunt's worst live instance is the comment-only catch around keyed narrative/constraint failures (engine.ts:3012/3030) — a keyed model failure and a deliberate keyless run leave identical records. One caveat on this whole dossier: `console.tsx` was edited at 11:09:23, one minute **after** the last green gate (11:08), so "current bytes are gate-green" is UNVERIFIED.

---

## §6 — Honest limits of this sweep

- No full gate / typecheck / lint / build (forbidden); 2 of ≤3 test runs used (honesty-guards 5/5, errors 34/34). Nothing keyed or network was executed.
- DF-29 not re-derived; F2 not re-probed; verify.server caller tracing incomplete (row 6, §2 `UNVERIFIED`).
- All statuses are from marker greps + targeted line reads, not from re-running the product end-to-end; an emitted-tree census re-run (TA-15) was not performed.
- `console.tsx` (mtime 11:09:23) postdates the last known green gate (11:08) by ~1 min — any "green" claim strictly about current bytes is UNVERIFIED.
- Dossier author: W13 lane 2 (subagent). Every command above ran in this session; outputs pasted as returned. Probes: `C:/Users/mnril/w13l2_scratch/` (`df_sweep.sh`, `console_sweep.sh`, `batch3–15.sh`, `scan_today.json`, `g1probe/`).

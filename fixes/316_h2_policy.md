# fixes/316_h2_policy.md — H2 · THE POLICY REGISTRAR (A5 + A6)

Lane: H2 (316 wave). HEAD at lane start: `564db1f` (all gates green per context).
Writer: H2 — **one writer per file**; this lane owns the A5 hunks in `src/lib/rt-events.ts`, `src/lib/rt-events.test.ts` + the `wildApproveGate` consult in `src/lib/engine.ts` + its pins in `src/lib/wild-step.test.ts`.
Rule honored: **NO keyed calls.** Log written **FIRST** (before any code edit), per lane contract.

## Status board

| # | Item | Status |
|---|---|---|
| A5a | `wild.paused_policy` registered in `rt-events.ts` RT_EVENT_NAMES (+ pin list, + census comment arithmetic) | LANDING — §1 |
| A5b | The EMIT at the policy-overlay refusal path (`wildApproveGate`) + overlay reason in detail | LANDING — §2 |
| A5c | The `engine.ts` consult (`policyOverlayRefusal` from the project's `wildPolicy` overlay at the gate) | LANDING — §2 |
| A5d | Pins (behavioral): catalogue pin + refusal-path pin | LANDING — §3 |
| A6 | T3.4 write-path disposition table (`writeFile`/`writeFileSync`/`appendFileSync`/rm/rename in `src/`+`scripts/`) | LANDING — §4 |

## 0. The precise RS-03 spec (read FIRST, before acting)

The lane brief cited "the RS-03 row in `308_map4_claims.md`/`308_bugmap.md`". **Recon correction (verified, not assumed):** neither 308 map carries an RS-03 row — `grep -rn "RS-03" fixes/308_map4_claims.md fixes/308_bugmap.md` → **0 hits**. RS-03 lives in **`fixes/274_wdx2.md:39`** (the WDX-2 re-spec dossier's correction set RS-01…RS-04), re-cited by `fixes/311_se2_surfaces.md:48` and `fixes/311_wd_guard.md:140`. Verbatim (the precise spec):

> **RS-03** (F4): precise needed-after: (a) register `wild.paused_policy` in rt-events.ts (not present today), (b) consult `applyPolicyOverlay`/`policyOverlayRefusal` from the engine's `wildApproveGate` (engine.ts:3668) + store gate path, (c) emit the event on deny, (d) UI surface (console has the refusal rendering at :3836 already — extend).

Re-verified at HEAD `564db1f` before touching anything:

- `grep -rn "paused_policy" src scripts` → **0 hits** (premise (a) stands).
- `policyOverlayRefusal`/`applyPolicyOverlay` consumers = **console.tsx only** (`:47` import, `:2242` approve funnel, `:4070` gate dock); **engine.ts: 0 hits** (premise (b) stands).
- 274's `engine.ts:3668` has drifted → `wildApproveGate` is at **`engine.ts:4215`** at HEAD (312/313 lanes shifted it); target function unchanged — verified by grep: 2 call sites, `:4687` + `:4766`, both inside `wildStep`.

## 1. A5a — the registration (`rt-events.ts`)

**Design (mirrors the closest sibling, `wild.step_paused`):**

- `"wild.paused_policy": "wild-step"` added to `RT_EVENT_NAMES` in the `// wild-step` block (the refusal happens inside a wild step's gate handling; `wild-step` is the legal scope).
- Pin list in `src/lib/rt-events.test.ts` (the sorted `Object.keys(RT_EVENT_NAMES)` deep-equal) gains the name — adding a catalogue name without the pin would fail the test by construction, which is exactly the guardrail.
- Census comment arithmetic re-derived honestly: catalogue `56 → 57`, emitted `18 → 19` (the new name gets a real emitter in §2), dead stays `38` (`+1 / +1 / 0`), dated H2 note appended.

*(Evidence: §E1.)*

## 2. A5b + A5c — the consult + the emit (`engine.ts` `wildApproveGate`)

**Spec reading:** (b) consult `policyOverlayRefusal` from `wildApproveGate`; (c) emit the event on deny, with the overlay's reason in detail. The engine consult lands at **`wildApproveGate`** only — the "+ store gate path" half of RS-03 (b) is a separate seam this lane did not touch (see §5 residual note).

**The consult (narrow-only, mirrors the console's shape exactly):**

- New, right after the `forceHuman` check and before any classifier work: `policyOverlayRefusal((p as { wildPolicy?: unknown }).wildPolicy, "hitl.approve", "gate:P" + phase)` — the same accessor shape the console uses (`console.tsx:332-333` reads `wildPolicy` off the project) and the same action/resource pair as `console.tsx:4070`.
- Non-null refusal ⇒ the step refuses to self-approve; the run parks. Fail-closed by construction: `policyOverlayRefusal` already returns a coded refusal for an *unreadable* list, so a malformed `wildPolicy` can never be silently ignored. Absent list ⇒ `null` ⇒ byte-identical pre-landing behavior.
- Consult placed before classifier resolution: a refused action must not spend a classifier call, and the refusal is deterministic — independent of classifier state.
- Applies under the `agentSeal` too (narrow-only: the project's list may further restrict the sealed unattended policy; nothing here can widen it).

**The pause + the emit (the refusal path):**

- Ledger row + park: `wildPause(...)` with event **`wild.paused_policy`** (sibling ledger names: `wild.paused_human` / `wild.paused_classifier`), detail carrying the overlay's own reason verbatim (`refusal.code` + `refusal.detail`), explicit park `{ code: "RT_E_GATE_PENDING", unlock }` where `unlock` maps the refusal's own semantics: `alwaysAsk` ⇒ `human-gate` (an explicit human decision unlocks it); off-list / denied / unreadable / escape ⇒ `human-retry` (a human must fix the list, then resume).
- RT emit: one `wild.paused_policy` seed through the existing `opts.onEvent` sink (same shape as `finishStep`'s `wild.step_paused` emit: `scope: "wild-step"`, `level: "warn"`, `capture: "src/lib/engine.ts:wildApproveGate"`, `code: "RT_E_GATE_PENDING"` — the RT_E class; the policy-seam code `policy.action-*` travels in the message + payload, never minted as an RT_E).
- Result code `RT_E_GATE_PENDING` (same class the `forceHuman` and reject parks carry) so `parkIfNull`/UI/keyed-runs read one consistent class.

*(Evidence: §E2.)*

## 3. A5d — pins (behavioral)

1. `rt-events.test.ts` catalogue pin (updated; §1).
2. `wild-step.test.ts`: a behavioral pin proving the refusal path: project carrying `wildPolicy` with `denyActions: ["hitl.approve"]` at an awaiting gate ⇒ `wildStep` pauses, `lastAutoLog` names the refusal, the park is `RT_E_GATE_PENDING` with the mapped unlock, and the `onEvent` recorder sees exactly one `wild.paused_policy` row whose message carries the overlay's reason. Plus the negative half: no `wildPolicy` ⇒ the pre-landing behavior is byte-identical (the existing suite's green doubles as this).

*(Evidence: §E3.)*

## 4. A6 / T3.4 — the write-path disposition table

Method: `grep -rn` for `writeFile|writeFileSync|appendFileSync|\.rm\(|rmSync|rename|unlink` across `src/` + `scripts/`; every hit dispositioned into exactly one class:

- **harness-safe** — writes confined to app-owned/service paths (store data dir, temp dirs, logs), not user/agent-controlled targets, no repo escape;
- **emitted-dir** — writes into an emitted/minted tree under the run's own output dir (the harness's product);
- **self-mod-candidate** — a write whose target can be repo/source files (the self-mod surface the SE2 dossier guards).

No code changes (disposition only) unless a write is a REAL escape — then a tiny fix + proof.

*(Table: §4.1; scan command + raw counts: §4.0.)*

### 4.0 — the scan (command + raw counts) — run 2026-09-30 @ HEAD `091b389` (W44 · A3; live tree incl. sibling lane edits)

Command (verbatim; `cd` first — space in path; code-file includes + test exclusion stated explicitly, since §4's method text left them open):

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
grep -rnE 'writeFile|writeFileSync|appendFileSync|\.rm\(|rmSync|rename|unlink' src scripts --include='*.ts' --include='*.tsx' --include='*.mjs' > /tmp/a3_writes_raw.txt
```

Raw output: **559 rows** (incl. `*.test.*` rows). Test-file rows: **382**. Non-test working set: **177 rows across 37 files**. Per-file counts (verbatim from `cut -d: -f1 /tmp/a3_writes.txt | sort | uniq -c | sort -rn`):

```
     24 src/lib/headless.ts
     16 scripts/run-eval.mjs
     11 scripts/rapidtool-cli.mjs
      9 src/lib/runtime-log.server.ts
      9 src/lib/checkpoint.server.ts
      8 src/lib/knowledge.ts
      8 src/lib/algorithms.ts
      8 scripts/write-atomic.mjs
      7 src/lib/write-set.ts
      7 src/lib/quarantine.ts
      7 src/lib/compile-check.server.ts
      7 src/lib/cassette.ts
      7 src/components/console.tsx
      5 src/lib/store.ts
      5 src/lib/node-runner.server.ts
      5 src/lib/git.server.ts
      4 src/lib/selfmod.server.ts
      4 src/lib/engine.ts
      4 scripts/preview.mjs
      3 src/lib/scaffold.ts
      3 scripts/browser-smoke.mjs
      1 × 16 files (watchdog · vector · vault · tracing · rt-ring · rt-events · rt-client · phases · packet · llm/providers/registry · llm/providers/deepseek · harvest · diagnose · design · compaction · auth/middleware)
```

Row accounting: **177 = 61 write-site rows + 116 non-site rows** (imports / comments / strings / store-action calls / git argv / catch-vars — §4.1b). Site rows classify as **39 harness-safe · 12 emitted-dir · 10 self-mod-candidate**. Scope note: the regex matches the §4 token set only — adjacent ops without a token (`mkdirSync`, `openSync(…, "a")`, `writeSync`) are outside this scan by construction.

### 4.1 — the disposition table

#### 4.1a — write sites (every row in exactly one class)

| file | rows | class | basis / guard |
|---|---|---|---|
| `src/lib/cassette.ts` | :249,:250 | harness-safe | LLM cassette tape (caller-provided `tapePath` — the harness's own recording artifact); staging+rename hardened (:239-246) |
| `src/lib/checkpoint.server.ts` | :228,:229,:233,:327,:333 | harness-safe | `<projectDir>/.rapidtool/checkpoint.json*`; A1-06 bad-dir refusal; sweep deliberately bounded to `checkpoint.json*` |
| `src/lib/compile-check.server.ts` | :1403,:1440,:1447,:1997,:2098 | harness-safe | `rmSync` bounded to the module's own `mkdtemp` temp copies (test/run work copies) |
| `src/lib/headless.ts` | :183,:190 | harness-safe | stale-lock reclaim (rename-aside + unlink) beside the store; O_EXCL claim (`:201-218`) |
| `src/lib/headless.ts` | :237,:238,:241 | harness-safe | `saveProject` tmp+rename+sweep — the app's project-store JSON at the caller's project path |
| `src/lib/headless.ts` | :253,:2094 | harness-safe | lock release (`<target>.lock`), best-effort in `finally` |
| `src/lib/headless.ts` | :2391 | harness-safe | work-copy temp cleanup (best-effort) |
| `src/lib/knowledge.ts` | :535,:536,:539 | harness-safe | knowledge-store JSON staging+rename+sweep (unique staging name per writer) |
| `src/lib/node-runner.server.ts` | :268 | harness-safe | `mkdtemp` temp cleanup; unowned-dir guard (`:311`) |
| `src/lib/runtime-log.server.ts` | :96,:104,:125 | harness-safe | NDJSON log dir: rotate rm + rotate rename + `appendFileSync` |
| `scripts/browser-smoke.mjs` | :161,:171 | harness-safe | `checkedOutputPath(..., ["/workspace"], …)` allow-listed verdict JSON |
| `scripts/preview.mjs` | :279,:309 | harness-safe | `ROOT/.grok/preview.pid` — the tooling's own dir |
| `scripts/run-eval.mjs` | :1046 | harness-safe | `prepareCleanEmitDir` refuses any target outside the eval out dir (`:1035-1040`) before its rm |
| `scripts/run-eval.mjs` | :2689,:2716,:2752,:2781,:2802,:2821 | harness-safe | `writeJsonAtomic` / `writeMarkerAtomic` / `results.json` under `OUT_DIR` (`EVAL_OUT_DIR` override; the driver's own artifact tree) — re-grepped post-A1-dedup + T5.4 (W44: line cites refreshed from the :2988-era pre-dedup rows) |
| `scripts/write-atomic.mjs` | :77 | harness-safe | `handOver` is itself the guard: `stagingError` + `physicalInside`; refuses `public/` staging (`:52-58`) |
| `src/lib/headless.ts` | :2059 | emitted-dir | emit ghost-file wipe inside the emit target (lock-held; snapshot/rollback) |
| `src/lib/headless.ts` | :3047,:3048,:3052 | emitted-dir | `repairApply` tmp+rename+sweep into the tree; fence = `repairTreePathRefusal` + `REPAIR_TREE_ALLOWED_ROOTS` (`:2675-2712`) |
| `src/lib/headless.ts` | :3391,:3397 | emitted-dir | `writeVault` notes → output dir (default homedir slug / `--out`; caller-resolved) |
| `src/lib/quarantine.ts` | :113,:119 | emitted-dir | moves foreign files INSIDE the emit-dir root; `isInside` refusal; copy+unlink fallback |
| `src/lib/write-set.ts` | :116,:122,:147,:171 | emitted-dir | apply/rollback; `absOf` + `physicalInside` narrow-only guard; emit + repair roots |
| `src/lib/git.server.ts` | :664,:665,:668,:1014 | self-mod candidate | landing marker staging+rename+sweep into `<target>/.rapidtool/` — the repo being landed into; fence = the caller's allow-list (not the write) |
| `scripts/rapidtool-cli.mjs` | :1243,:1264,:2492,:2534 | self-mod candidate | user-directed `--out`/`--html` artifact writes (target = whatever the user names — same trust class as a shell redirect; not an autonomous write) |
| `scripts/rapidtool-cli.mjs` | :2186,:2187 | self-mod candidate | `edit --write` patch target (atomic tmp+rename); user-directed, project-scoped |

#### 4.1b — non-site rows (no fs write of their own)

| file | rows | what they are |
|---|---|---|
| `src/components/console.tsx` | 7 | store-action calls (`rename(projectId,…)`) + prose/JSX |
| `src/lib/algorithms.ts` | 8 | stemming lexicon/prose ("rename"/"renamer") |
| `src/lib/auth/middleware.ts` · `design.ts` · `diagnose.ts` · `packet.ts` · `phases.ts` · `compaction.ts` | 6 | comments / prompt strings ("do not rename") |
| `src/lib/cassette.ts` · `checkpoint.server.ts` · `compile-check.server.ts` · `git.server.ts` · `knowledge.ts` · `node-runner.server.ts` · `runtime-log.server.ts` · `write-set.ts` | 30 | imports + design comments (the sites above cite them) |
| `src/lib/engine.ts` | 4 | comments (B-12 rename scheme) |
| `src/lib/harvest.ts` | 1 | regex label ("points to a rename") |
| `src/lib/headless.ts` | 10 | import + comments |
| `src/lib/llm/providers/deepseek.ts` · `registry.ts` | 2 | comments |
| `src/lib/quarantine.ts` | 5 | comments + `catch (renameErr)` var rows |
| `src/lib/rt-client.ts` · `rt-events.ts` · `rt-ring.ts` · `tracing.ts` · `watchdog.ts` · `vault.ts` · `vector.ts` | 7 | "EXPORT SURFACE … do not rename" comments |
| `src/lib/scaffold.ts` | 3 | comments + emitted-code comment string |
| `src/lib/selfmod.server.ts` | 4 | comments + git argv (`--no-renames` flags — read-side numstat, no fs write) |
| `src/lib/store.ts` | 5 | type decl + comments + in-memory zustand action |
| `scripts/browser-smoke.mjs` · `preview.mjs` | 3 | imports |
| `scripts/rapidtool-cli.mjs` | 5 | import + comments + summary string |
| `scripts/run-eval.mjs` | 9 | import + comments |
| `scripts/write-atomic.mjs` | 7 | comment / import / signature default / refusal string |

#### 4.1c — done-when verdict

- **Every grep row carries a disposition:** 61 site rows → exactly one class each (39 + 12 + 10); 116 non-site rows → accounted above. Σ = 177 = the non-test command's row count (re-run 2026-09-30 @ `091b389`; re-runnable verbatim from §4.0).
- **REAL escapes: NONE** (H2's finding re-confirmed on current bytes). The only arbitrary-target seams are (1) the git landing marker — the documented self-mod landing seam, fenced by the caller's allow-list, and (2) the CLI's user-directed `--out`/`--html`/`edit --write` targets — a user's explicit instruction, not a harness-initiated write. Both live as `self-mod candidate` rows, neither is an escape.
- **Fixes applied: none — disposition-only, as §4 prescribes.**

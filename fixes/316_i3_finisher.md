# fixes/316_i3_finisher.md — I3: the log+floor finisher (H4's + H7's evidence · T8.6 · the two floor pins · W43 flips)

**Lane:** I3 (post-H-wave finisher, deleg finisher task) · **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`.
**HEAD at entry:** `71154b1` ("H-wave: P7 seam honored (probe) + wildExecEdgeFor shared picker + repair edge WIRED, wild.paused_policy live, spend envelope, UI first-run, cron root-caused"); **worktree clean** at entry.
**Writers:** I own `fixes/316_h4_uitails.md`, `fixes/316_h7_survive.md`, `wave_plans/W43/COMPLETION-TASKS.md`, the pin region of `src/lib/headless.test.ts`, and the Leg-11 append of `scripts/cli-exit-taxonomy.test.mjs` (I2's finisher owns that file's Leg 10 — coordination note in §W43). README.md: **read-only here** — T8.6's paragraph is already on disk (`2fa3cd9`), so the pointer is recorded, no edit owed. **No keyed calls. Log written FIRST.**

## Deliverable board

| # | Item | Status |
|---|---|---|
| L1 | H4's log filled from the rescue (`316_h4_uitails.md`: status board + T8.5 before/after + T8.3-tail envelope + T8.6 pointer + the F5 correction) | LANDED — §L1 |
| L2 | H7's ledgers + (a)–(f) verdicts + no-bad-code audit table (`316_h7_survive.md`) | LANDED — §L2 |
| L3 | T8.6 recorded: README `.env`-vs-shell pointer + F5-claim correction (README not edited — paragraph pre-exists) | LANDED — §L3 |
| P1 | The interrupted-save pin (short-write → original intact) in `src/lib/headless.test.ts` | LANDED — §P1 |
| P2 | The CLI-floors pin (bare/`--help`/unknown-verb refusals) in `scripts/cli-exit-taxonomy.test.mjs` | LANDED — §P2 |
| W43 | Closed rows' statuses flipped (statuses + evidence columns only) | LANDED — §W43 |
| G | Gates: targeted legs green (typecheck + lint scoped; per-pin legs) | §G |

## §L1 — H4's log (filled from the rescue)

Filled `fixes/316_h4_uitails.md` from `fixes/316_wd3_guard.md` §RESCUES (H4 block; state.db session `20260929_184834_9ac4a9` msg `117262`) + the on-disk artifacts the lane left (`~/h4_emit/`). Byte-anchors used (all verified by grep/read at `71154b1`):

- T8.5a hint: `console.tsx:1816-1825` — 0-char branch added; >0 branch byte-identical (diff read).
- T8.5b box: `console.tsx:1852-1858` — two-paragraph house empty-state; old one-liner quoted in the file.
- T8.3-tail: the real `emit --run` envelope `~/h4_emit/emit1.json` (substance census `{stubs:0,reexports:1,real:1}` / `verdict:"mixed"` / `greenWhileStubbed:true` + SUBSTANCE MARKING note; `treeRun.ok:true`; `verdictHash 1062536735`) + cross-surface `doctor` census `~/h4_emit/doc1.json` (`factory.inventory` identical).
- T8.5c recorded honestly as NOT captured (no Playwright pass) with the exact next step.

## §L2 — H7's log (filled from the rescue)

Filled `fixes/316_h7_survive.md` from `fixes/316_wd3_guard.md` §RESCUES (H7 block; session `20260929_185003_e6a3e6` msg `117238`): FIXED/RECORDED/CLEAN ledgers, verdicts (a)–(f) with file:line anchors, and the no-bad-code classification table (0 violations). Re-verified at `71154b1` before writing: crew `args.maxSteps` line still live (`rapidtool-cli.mjs:2297-2298`), `MAX_FILES` silent truncation still live (`compile-check.server.ts:75`/`:176`), `saveProject` atomic mechanism (`headless.ts:220-259`). The `--agent-seal` usage-completeness finding is marked RESOLVED cross-lane (H3's V2-finding-#4 fix documented it: `rapidtool-cli.mjs:44`/:4027 + refusals :116-130).

## §L3 — T8.6 (key-setup parity)

- **On disk (verified):** `README.md:138-148` states the split — browser app reads `.env` (tooling loads it), headless CLI does NOT (export the shell variable; exact example command given), landed `2fa3cd9`. **No paragraph owed → pointer recorded** (in W43's T8.6 row + H4's log).
- **Correction carried (H4-verified; I3 re-verified):** F5's log claim that the split text lives in `errors.ts RT_E_LLM_NOT_CONFIGURED.agentAction` is **WRONG** — the agentAction (`errors.ts:433-436`) says only "…tell the user to set DEEPSEEK_API_KEY." The split lives in README only. Carried against F5-2/T8.4.

## §P1 — the interrupted-save pin

Added to `src/lib/headless.test.ts` (new describe, 2 tests — see file). Approach: **real-FS fault simulation, no monkeypatching** (verified: ESM named imports of `node:fs` are NOT patchable — live-binding-patch test returned false):
1. **Killed writer's short-write residue** — a truncated `${target}.tmp-<pid>-<ts>` (exactly what an interrupted save leaves) never dents the original: `loadProject` still reads v1; the next save lands v2.
2. **Blocked tmp write** — `Date.now` frozen (patchable; restored in `finally`) to predict the tmp name, a directory planted at it ⇒ the write step throws inside `saveProject` ⇒ the catch path runs: original v1 intact, lock released (`saveProject`'s `finally`), a retry lands v2.

**Result:** both tests green — headless **106/106** (§G).

## §P2 — the CLI-floors pin

Added to `scripts/cli-exit-taxonomy.test.mjs` (behavioral spawn, same house pattern as Leg 5: temp cwd + scrubbed env + `import.meta.url` paths). Pins the H7-verified fresh-command floor: bare / `--help` / unknown verb → **exit 1 + one `ok:false` envelope, `code:"RT_E_VALIDATION"`, `remedy` present, `exit_code === status`, empty stderr (no stack)**. I3 pre-captured the exact behavior from a real spawn before pinning (3/3 shapes identical).

**Result:** Leg 11 green — taxonomy **11/11** (§G); coordination note in §W43.

## §W43 — the status flips

Flipped only rows closed on disk (statuses + evidence columns; no restructuring). See `wave_plans/W43/COMPLETION-TASKS.md` diff. Rows flipped **LANDED**: T3.3, T5.2, T5.5, T7.1, T8.3 (U2), T8.5, T8.6 + **T1.4** (probe+wire `71154b1`; §S5 pins in-tree via I2, verified 28/28). Evidence brought current: **T8.2** (F5-1 guard ON DISK `71154b1`; taxonomy seat pin owed), **T4.4** (engine + CLI flag + refusals + Leg 10 refusals-half in-tree; seeded keyless `wild.complete` run owed), **T6.2** (P7 edge probe-verified; no-mint walk owed). Count line re-derived: **43 = 14 LANDED / 12 LANDING / 17 OWED**. Sibling coordination: I2 landed the seal Leg 10 + §S5 pins mid-session (verified, not raced); I4's busy-path (CLI) + a sibling's T5.4/T6.3 work (`run-eval.mjs` telemetry, `entry-oracle.ts`) is in-flight — those W43 rows were left as-is for their own evidence.

## §G — gates

- `node --experimental-strip-types --test src/lib/wild-seal.test.ts` → **10/10** (4 suites) — cited for W43.
- `node --experimental-strip-types --test src/lib/compile-check.server.test.ts` → **56 pass / 0 fail / 1 skip** — T8.3's named leg.
- `node --experimental-strip-types --test src/lib/headless.test.ts` → **106/106 pass** (was 104; +2 = P1's describe).
- `node --test scripts/cli-exit-taxonomy.test.mjs` → **11/11 pass** (I2's Leg 10 + my Leg 11, run together).
- `npm run typecheck` → **clean (exit 0)** on the whole program, incl. my `headless.test.ts` edit.
- `npm run lint` → my edits clean; the run shows **1 error + 10 warnings, ALL in `scripts/run-eval.mjs`** (a sibling's in-flight T5.4 edit: `normalizeEmittedFiles` redeclare at :729 + unused telemetry imports at :117-124) **+ 1 pre-existing warning** (`wild-seal.test.ts:67`) — none from I3's files. The parent must not bank until that sibling's edit is finished.

## LOG (append-only, timestamped)

- **[t0]** Entry: HEAD `71154b1` clean; h1/h2/h3/h5/h6/wd3 logs already filled+committed; h4/h7 skeletons (mine). Commit stat scanned: console.tsx = T8.5; headless.ts = H6 spend envelope + pin; engine.ts + rt-events = H1/H2/H3/H6 bytes.
- **[t1]** Recon for flips: T3.3 bytes live (rt-events.ts:161; engine.ts:4309/4319/4329; pins rt-events.test.ts:94, wild-step.test.ts:373+); T5.5 bytes live (headless.ts:1480/:1513; pin headless.test.ts:412); README:138-148 = the split (2fa3cd9); errors.ts:433-436 = NO split (F5 claim false); `--seat` guard live (rapidtool-cli.mjs:929-973) but no taxonomy pin; seal CLI flag + refusals live (:44/:3526, :116-130) but **E1 Leg 10 absent** (file's last commit = 54c6649; legs stop at 9); `wild-seal.test.ts` = §S1–S4, **no P7 arm** (§S5 pins still owed); `wild-step.test.ts` = P6 + policy pins only; `compile-check.server.test.ts` substance pins present (:1156/:1330).
- **[t2]** Logs written first (§L1/§L2/§L3 edits landed). Pins next.
- **[t3]** H4's log + H7's ledgers filled; T8.6 pointer recorded. Mid-session discovery: siblings are live in my pin targets' neighborhood — I2's finisher had just landed Leg 10 in the taxonomy file (19:20:53) + 426 lines of §S5 pins in `wild-step.test.ts`; I4 owns the CLI busy path; `entry-oracle.ts` (T6.3) is being written. Strategy: append-only, read-before-write, verify-before-flip.
- **[t4]** P1 + P2 applied: `headless.test.ts` +2 tests (describe `fixes/316_h7 addendum P1 (I3)`); `cli-exit-taxonomy.test.mjs` Leg 11 + header legs 10–11, anchored at a stable 19:23:36 read. T1.4's §S5 pins verified myself (`wild-step.test.ts` 28/28).
- **[t5]** Legs: headless **106/106** · taxonomy **11/11** · wild-seal **10/10** · wild-step **28/28** · compile-check **56 pass / 0 fail / 1 skip** · typecheck **0**. Lint: only the sibling's in-flight `run-eval.mjs` + pre-existing warnings — none mine.
- **[t6]** W43 flips applied (11 row edits + count line; statuses + evidence columns only). All I3 deliverables sit on the worktree, **uncommitted** (siblings mid-edit; parent banks the merge). DONE.

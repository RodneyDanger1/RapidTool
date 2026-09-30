# 316 — H7: survivability sweep + no-bad-code audit + small helpfuls

Date: 2026-09-29 · HEAD at start: 564db1f · Owner: H7 (lane: survivability + bad-code sweep)
Siblings live: H1, H2, H3, H4, H5, H6 (do NOT touch their files; free files or "for H<k>" notes only).

**Lane ended @18:59:08, exit = max_iterations — status=completed, no code changed, no gates run.** Ledgers below filled post-hoc by the I3 finisher from the lane's rescued final (`fixes/316_wd3_guard.md` §RESCUES · state.db session `20260929_185003_e6a3e6` msg `117238`), with `[I3]` re-verifications at `71154b1`. The finisher addendum at the bottom records the two named gap-pins landing.

## Scope (from the wave brief)

1. **Survivability class** — (a) save atomicity (temp+rename?), (b) fresh-command floor (bare/--help/unknown verb),
   (c) emitted-tree independence, (d) hostile `RAPIDTOOL_*` env values, (e) 8GB-machine guard (unbounded parallelism),
   (f) .env-missing keyless path re-confirm.
2. **No-bad-code audit** — grep TODO/FIXME/HACK/XXX/placeholder/mock/stub in src/ + scripts/; classify every hit;
   fix or loudly record violations. Spot-check ~8 lying-comment candidates.
3. **Small helpfuls** — (a) CLI usage-block completeness vs parsed flags, (b) up to 2 tiny proven extras.

Status: COMPLETED (capped) — log filled from the rescue by the finisher.

## Ledger

### FIXED
_(none by this lane — the cap hit before any landing; no code changed by H7. Its two named small helpfuls are recorded below; the two named gap-pins landed post-lane by I3 — see ADDENDUM.)_

### RECORDED

1. **`crew --max-steps` silently no-ops** — `rapidtool-cli.mjs:2297-2298` reads `args.maxSteps`, but usage documents the flag as `--max-steps` (`:31` header + `:4011` USAGE); parseArgs never produces the `maxSteps` key from `--max-steps` ⇒ the documented flag never reaches `opts`. Real defect, one-line fix class; **recorded, unlanded** (not in the finisher's remit; CLI byte-ownership stays with the wave's owner). `[I3]` verified still live at `71154b1` (line shifted 2263→2297 by H3's seal edits).
2. **`--agent-seal` usage-block completeness** — H7 found the flag parsed, absent from USAGE + header. **RESOLVED cross-lane**: H3's V2-finding-#4 fix documented it (`rapidtool-cli.mjs:44` header + `:4027` USAGE) and added coded pointer refusals (`:116-130`, sites `:693`/`:793`/`:839`/`:893`). `[I3]` verified.
3. **`compile-check.server.ts` `MAX_FILES=2000` truncates the walk silently** (`:75`; `:176` `if (filesSeen >= MAX_FILES) return;`) — unlike `MAX_CHECK_BYTES`, which yields a fail verdict when it trips. A >2000-file tree gets a quietly partial check. **Recorded nit, unlanded.** `[I3]` verified still live.
4. **GAP (record-only in-lane): no interrupt/short-write pin** for save atomicity — the mechanism is temp+rename + `O_EXCL` lock (`headless.ts:220-259`), the happy-path + lock classes are pinned in `headless.test.ts` ("file persistence (atomic)" @L148), but nothing simulated an interrupted write. **CLOSED by the finisher — ADDENDUM P1.**

### CLEAN

| Class | Verdict | Anchor |
|---|---|---|
| (a) save atomicity | **CLEAN** — temp+rename + exclusive lock; pinned except the interrupt case (now closed) | `headless.ts:220-259`, `:201`; pin `headless.test.ts` "file persistence (atomic)" |
| (b) fresh-command floor | **CLEAN** — bare/`--help`/unknown → exit 1 `RT_E_VALIDATION`, no stack; not pinned in-lane | behavior below; pin = ADDENDUM P2 |
| (c) emitted-tree independence | **CLEAN** @HEAD — fresh tree 16 files, `npm test` 11/11 with no `node_modules`; the committed `research/eval-out/coffeehouse2home-property-ledger` is a STALE pre-HEAD artifact, not a HEAD defect | H7 lane run |
| (d) hostile `RAPIDTOOL_*` env | **CLEAN** — `RAPIDTOOL_TOKEN_CAP=banana` → unmetered (named note); junk `ITERATE` → named notes; no crash | H7 lane run |
| (e) 8GB-machine guard | **CLEAN** — only 2 `Promise.all` in the tree: `subagent.ts:587` (bounded ≤4) + `migrate.mjs:50`; no unbounded spawn loops | grep sweep |
| (f) keyless path | **CLEAN** — `crew` exit 3 `RT_E_LLM_NOT_CONFIGURED`; red-seal exit 1; NDJSON stamps present | H7 lane run |

## Survivability verdicts (a)–(f)

- **(a) save atomicity — CLEAN / pinned-except-interrupt.** `saveProject` (`headless.ts:214-251` in-lane; now `:222-259`) writes `${target}.tmp-${pid}-${ts}` then `renameSync` over the target, under an `O_EXCL` lock (`acquireExclusiveLock`, `:201`). Pinned: round-trip, no-temp-left, lock refusal (`RT_E_BUSY`), stale-lock reclamation. GAP then: no pin simulating an interrupted/short write — **closed by ADDENDUM P1**.
- **(b) fresh-command floor — CLEAN, not pinned (in-lane).** Bare / `--help` / unknown verb → exit 1 + `RT_E_VALIDATION`, no stack. **Pin = ADDENDUM P2** (taxonomy leg's home).
- **(c) emitted-tree independence — CLEAN @HEAD.** A freshly emitted tree ran its own suite (16 files, `npm test` **11/11**) with no `node_modules`. The committed `research/eval-out/coffeehouse2home-property-ledger` fails independence only because it is a **stale pre-HEAD artifact** — not a HEAD defect.
- **(d) hostile env — CLEAN.** `RAPIDTOOL_TOKEN_CAP=banana` → unmetered with a named note (strict `^\d+$` parse holds); junk `RAPIDTOOL_ITERATE_THRESHOLD` → named notes; no crash in either.
- **(e) 8GB guard — CLEAN.** No unbounded parallelism: exactly 2 `Promise.all` sites tree-wide — `subagent.ts:587` (bounded ≤4) and `migrate.mjs:50`; no unbounded spawn loops.
- **(f) keyless path — CLEAN.** `crew` → exit 3 `RT_E_LLM_NOT_CONFIGURED`; red-seal → exit 1; NDJSON event stamps land as documented.

## No-bad-code audit (src/ + scripts/)

**ZERO VIOLATIONS.** Every hit of the vocabulary classified as incidental (data/strings supplied by callers or fixtures) or *designed honesty vocabulary* (the repo's declare-or-strike markers). Classification table (counts as swept by H7):

| Token | Count | Disposition |
|---|---|---|
| `TODO` | 174 | incidental / designed (`TODO(E-15)` = declared stub markers; TODO in fixtures/comments naming future work) |
| `FIXME` | 0 | — |
| `HACK` | 0 | — |
| `XXX` | 0 | — |
| `not-implemented` | 36 | designed honesty vocabulary (coded not-yet surfaces) |
| `placeholder` | 141 | incidental (UI placeholder text / fixture fields) |
| `mock` | 315 | incidental (test doubles, injection seams) |
| `stub` | 463 | designed (substance census classes + K3/K4 honesty surfaces) |

**Lying-comment spot-checks: 8/8 pass** — each sampled comment matched the bytes it describes.

## Evidence log

_(commands + observed output, as recorded by the lane; `[I3]` = finisher re-verify at `71154b1`)_

- `headless.ts:222-259 saveProject` — temp `:235` → `writeFileSync :237` → `renameSync :238`; catch removes tmp `:241`; `finally` releases lock `:248/:253`. `[I3]` read.
- `headless.ts:201 acquireExclusiveLock` — `openSync(lockPath,"wx")` + stale reclaim. `[I3]` read.
- `rapidtool-cli.mjs:2297-2298` — `args.maxSteps` read (crew). `[I3]` grep at `71154b1`.
- `compile-check.server.ts:75/:176` — `MAX_FILES = 2000`; silent `return`. `[I3]` read.
- Fresh-command floor, real spawn (`[I3]`, temp cwd, keyless env): bare → exit 1, stdout JSON `{ok:false, error:"Missing subcommand.", code:"RT_E_VALIDATION", remedy:…, exit_code:1}`, stderr **0 bytes**; `--help` → identical; `bogusverb` → same + `error:"Unknown subcommand: bogusverb"`. No stack in any shape.

## ADDENDUM (I3 finisher, post-`71154b1`) — the two named gap-pins landed

**P1 — interrupted-save pin — LANDED, green.** `src/lib/headless.test.ts`, new describe `fixes/316_h7 addendum P1 (I3) — an interrupted save never dents the original`, 2 tests:

- *Short-write residue:* save v1 → plant a truncated `${target}.tmp-99999-1` (a killed writer's exact residue — the rename never ran) → `loadProject` still reads v1 → the next save lands v2. A half-written temp is inert.
- *Write-failure path:* freeze `Date.now` (restored in `finally`) + plant a DIRECTORY at the predicted `${target}.tmp-${pid}-<fixed>` name → the temp write throws inside `saveProject` → the catch path runs: the error propagates (asserted NOT `RT_E_BUSY` — the lock was held fine), the original v1 survives, `.lock` is released, the retry lands v2. No fs monkeypatching — ESM named imports of `node:fs` are provably not patchable (live-binding probe: false).
- Run: `node --experimental-strip-types --test src/lib/headless.test.ts` → **106/106 pass** (104 before; +2 = this describe). Typecheck 0.

**P2 — CLI-floors pin — LANDED, green.** `scripts/cli-exit-taxonomy.test.mjs`, **Leg 11** (`316 I3 — the fresh-command floor: bare / --help / unknown verb refuse CODED (exit 1, RT_E_VALIDATION), never STACK`). Three shapes (bare / `--help` / unknown verb) each assert: exit 1 · exactly one `ok:false` envelope · `cmd` matches the shape · `code:"RT_E_VALIDATION"` · `error` names the shape · `remedy` non-empty (the K5/K6 seam) · `exit_code === status` · no Node stack.

- Run: `node --test scripts/cli-exit-taxonomy.test.mjs` → **11/11 pass** (I2's Leg 10 + this Leg 11). Behavior was pre-captured from real spawns before pinning.
- Coordination: I2's finisher landed Leg 10 (H3's seal refusals) in this file ~19:20; this append was made at a stable read (19:23:36), end-of-file additive; the header leg list was updated for legs 10–11.

*(Both pins sit on the worktree, uncommitted with the rest of the I-wave — parent banks.)*

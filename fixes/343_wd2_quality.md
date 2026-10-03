# 343 wave — watchdog 2 (code quality + claims)

**Role:** non-mutating overseer. Watch added lines for prohibited code, claim-vs-byte drift,
toothless tests, and new tsc/eslint errors. Alert only; never fix.

**Baseline recorded** 2026-10-03 ~07:1x CT:
- `git rev-parse HEAD` = `73f660a4694a817240d8f9efa94faf837b84fdd1` ("342 wave: six engineers +
  three residual resumes + two verifiers").
- Working tree: **clean** at scan 0 — `git status --porcelain` = 0 entries, `git diff --stat`
  empty, no untracked. The 343 writers have landed nothing yet.
- No `fixes/343_*.md` lane logs exist yet; no `fixes/343_0_parent.md` brief found yet.
- References read: `AGENTS.md` (honesty contract), `fixes/342_0_parent.md` (honest 100% eval).

## Scan log

| Scan | Time | diff files | untracked | prohibited hits | tsc | eslint | notes |
|---|---|---|---|---|---|---|---|
| 0 | 07:1x | 0 | 0 | 0 | not run (tree clean) | not run | baseline; wave not started |
| 1 | 09:46 | 1 tracked + more | 3 src + 3 fixes logs | 0 | **6 errors** (WIP tests) | **3 warnings** (console.tsx, WIP) | lane 343-1/343-2/343-3 bytes landing |
| 2 | ~10:05 | 17 tracked | 4 src new files | 0 | **0 errors** (ALERT-1 cleared) | **1 warning** (console.tsx:2262) | git delivery, repo-map, best-of-N, one-shot-fetch landed |
| 3 | ~10:12 | 22 tracked | 4 src new | 0 | **0 errors** | **0 problems** (ALERT-2 cleared) | +auth/gates, rt-ring, rt-events, registry, openai-compatible; 0 warnings |
| 4 | ~10:18 | 30 tracked | 4 src new | 0 | **0 errors** | **0 problems** | +README-cli `--git` (ALERT-3 cleared), codegen repo-map follow-up + TS2323 |
| 5 | ~10:25 | 34 tracked | 4 src new | 0 | (see below) | (see below) | +harvest budget-slice fix, mcp UTF-8 byte-cap fix (bh2 F3/F4) |

## Alerts

**ALERT-3 (CLEARED).** `scripts/README-cli.md` originally did not document the new `emit --git` flag
while the CLI `USAGE.emit` did and the behaviour shipped (`scripts/rapidtool-cli.mjs:2205`). A
subsequent lane landed the fix: `README-cli.md` now adds `[--git]` to the emit synopsis and a `--git`
paragraph (diff at lines ~174-183), so the contract doc matches the shipped flag. **Cleared.**

### Scan 1 detail (2026-10-03 ~09:46–09:55 CT)

Landed bytes at scan 1:
- `src/lib/codegen.server.ts` (+162/−17, lane 343-1): best-of-N wiring.
- `src/lib/synthesis-policy.ts` (new, lane 343-1): pure policy module.
- `src/lib/repo-map.ts` + `src/lib/repo-map.test.ts` (new, lane 343-2).
- `src/lib/packet.ts` + `src/lib/packet.test.ts` (modified, lane 343-2).
- `src/components/console.tsx` (modified, lane 343-2).
- `src/lib/git.server.test.ts`, `src/lib/headless.test.ts` (modified, lane 343-3).

Prohibited-construct scan on added tracked lines + all untracked new source: **0 hits** (no
`TODO`/`FIXME`/`as any`/`@ts-ignore`/`eslint-disable`/`.only(`/`console.log`). Note: test files
use `undefined as unknown as string` / `junk as unknown as Params` deliberately for hostile-input
coverage — not `as any`, not prohibited.

**ALERT-1 (WIP, may clear): tsc RED — 6 errors, tests reference not-yet-landed exports.**
- `src/lib/git.server.test.ts:21` TS2305 `EMITTED_RECORD_REL` not exported by `git.server.ts`
- `:22` `GIT_LAND_DELIVERY_MARKER`; `:28` `LAND_COMMIT_TYPE`; `:30` `conventionalLandMessage`;
  `:32` `gitLandEmitted` — all TS2305.
- `src/lib/headless.test.ts:24` TS2305 `landEmittedTree` not exported by `headless.ts`.
This is test-first WIP by lane 343-3; the impl (`git.server.ts`/`headless.ts`) has not landed yet.
Must be 0 at the wave boundary.

**ALERT-2 (WIP, may clear): eslint — 3 warnings in `src/components/console.tsx` (lane 343-2 UI WIP).**
- `:60` `repoMapElisionMarker` imported but unused.
- `:2260` `repoMap` assigned but never used.
- `:2262` `useMemo` missing dependency `project`.
Repo requires **0 warnings** at the boundary.

### Observations (not alerts)

- 343-1 cost: in the single-module best-of-N, a budget stop at candidate *i* does not break the
  `selectBestOfN` loop, so candidates *i+1..cap* each still fire a model call before being
  accounted. Bounded by the hard cap (4), so ≤2 extra calls; the code comment "budget stop — keep
  sampling bounded" slightly overstates the stop. Low severity.

### Scan 2 detail (~10:05 CT)

17 tracked files, +1378/−30; 4 new src files. New lanes landed: git delivery (`git.server.ts`
+443, `headless.ts` +24, `rapidtool-cli.mjs`), repo-map (`repo-map.ts`), best-of-N
(`synthesis-policy.ts`, `codegen.server.ts` +179), a credential-strip fix
(`one-shot-fetch.server.ts`), and touches to `dod.ts`/`phases.ts`/`wild-mode.server.ts`/
`checkpoint.server.test.ts`.

- Prohibited-construct scan (all added tracked lines + all untracked new source): **0 hits**.
- **tsc: 0 errors** — ALERT-1 (the 6 WIP test errors) CLEARED once `git.server.ts`/`headless.ts`
  landed the exports.
- **eslint: 1 warning** (was 3) — `console.tsx:2262` `useMemo` missing dep `project`. The two
  unused-var warnings cleared. ALERT-2 partially cleared.

## Spot-checks (independent re-derivation from the bytes)

Probes in `$env:TEMP\rt343_wd2\`; none runs the writers' tests.

1. **343-2 claim: "hard char budget, `rendered.length ≤ budget`" + determinism + no-invented
   symbols** — `probe1.mjs`. **CONFIRMED.** Over 61 × 13 adversarial (files × budget) cases
   including 0/1/−5/NaN/1.5/1e9 budgets and 60 files of long paths: `rendered.length ≤ budget`
   never violated (worst margin −1), `shown+omitted == total`, elision marker always present when
   truncated; reordered/duplicated inputs render byte-identical; prose/comment/regex never forge
   an export name.
2. **343-1 claim: resolver default 1 / hard cap 4 / explicit-wins-over-env; `selectBestOfN` is
   lazy** — `probe1.mjs`. **CONFIRMED.** Hostile inputs (0, −3, NaN, `"abc"`, `"2.5"`, `{}`) → 1;
   9 → 4; explicit 2 beats env 4; `count=1` produces exactly one and never a winner; first passing
   candidate stops production at index 1 (produced == 2 of 4); `null` samples count as lost.
3. **Security claim: a cross-origin redirect must NOT forward `Authorization` (but keeps other
   headers)** — `probe2.mjs` with real `node:http` servers. **CONFIRMED.** Direct same-origin
   delivers `Bearer sk-…`; a 302 to a different host (`localhost` vs `127.0.0.1`) yields
   `authorization === undefined` while `x-trace` still travels.
4. **Claim-vs-byte: `dod.ts` / `phases.ts` moved "durable-checkpoints" to `implemented` and
   rewrote the P2 claim to say the per-phase checkpoint is WIRED (commit after every committed
   phase, re-entered by resume/unattended).** **CONFIRMED, not a false claim.** The bytes exist:
   `headless.ts:938 commitRunCheckpoint` → `writeCheckpoint`, called at `:1253` and `:3845`;
   `headless.ts:976 loadResumableCheckpoint` (read→admit→hydrate); the CLI consumes it at
   `scripts/rapidtool-cli.mjs:1314` (`resume` arm) and `:1383` (unattended arm). The
   `checkpoint.server.ts:355` comment's "L2-era TODO is closed" matches; no live TODO remains.
5. **343-3 claim: the delivery seam stages ONLY the emitted manifest, reports foreign files,
   is an idempotent no-op, and structurally refuses a foreign/host repo** — `probe3.mjs` with real
   git + temp repos. **CONFIRMED.** First land staged exactly the 4 manifest files and reported
   `stray.txt` as foreign; second land `noop:true`; a dir nested inside another work tree refused
   `target-in-work-tree`; a pre-existing foreign repo refused `not-a-landing-repo`; a dir without
   `.rapidtool/project.json` refused `not-an-emitted-tree`; a `../escape.ts` manifest refused
   `bad-input`; the envelope message equals the pure `conventionalLandMessage` derivation.

6. **Claim-vs-byte: `rt-events.ts` comment re-census "catalogue 60 · emitted 21 · dead 39" and
   "sys.step_overdue has no emitter".** `probe4.mjs` re-derived independently. **CONFIRMED.**
   Imported `RT_EVENT_NAMES` → 60 keys; parsed the dead list → 39 names, all catalogue members;
   scanned all non-test `src`/`scripts` for the literal `event: "…"` → 21 distinct emitted names;
   `event: "sys.step_overdue"` sites → 0; arithmetic 60 = 21 + 39. The comment's numbers are honest.
7. **Claim-vs-byte: `openai-compatible.ts` now parses `prompt_tokens_details.cached_tokens`**
   (the test `registry.test.ts` asserts `cachedPromptTokens === 80`). The production bytes exist at
   `openai-compatible.ts:381` (`prompt_tokens_details?: { cached_tokens?: unknown }`) and `:588-589`
   (`cachedPromptTokens: usage.prompt_tokens_details.cached_tokens`). **CONFIRMED** — the test is
   not asserting un-landed behaviour.

### Transient WIP artifacts observed and cleared (no alert)

- At scan 2/3 a **duplicated** `it("343 bh2: …")` block appeared twice in `registry.test.ts`; by the
  next read it was back to **one** occurrence (writer mid-save). Not a durable defect.
- At an intermediate read `openai-compatible.ts` was unmodified while its test already asserted the
  cached-token behaviour; the production fix landed moments later (`:588-589`). No false claim now.
- One `node` import of `git.server.ts` transiently reported "does not provide an export named
  `conventionalLandMessage`" during a mid-write; the export is present on the next read. Transient.

## Scan 4 detail (~10:18–10:21 CT) — late follow-up bytes

`codegen.server.ts` grew again (10:20:54; now +196/−21 in that file; wave total **1700 insertions**):
a **343-1 follow-up** implemented 343-2's STOP-and-REPORT — `repoMapForProject` is imported and a
`withRepoMapContext` block (`codegen.server.ts:1233`) appends the persisted tree's ranked outline to
the primary chunk prompt (`:4894`), budget `P6_SYNTH_REPO_MAP_BUDGET = 1200`. Verified against the
comment's claim: the map is built with `{ generatedTree: … }` **only** (`:4880`), so the
`generatedSource` fallback is NOT used and a tree-less project contributes zero bytes — the comment
"tree-only input" is accurate. The accompanying test (`codegen.server.test.ts:5766`) pins the exact
`${prior}\n\nREPO MAP …` append and the no-invention rule. `rule 11` in the P6 system prompt now names
a **fourth** compiler class, TS2323 (`Cannot redeclare exported variable`), matching the keyed evidence.
tsc **0 errors**, eslint **0 problems**, prohibited constructs **0** on the new bytes.

Minor wording (not an alert): the appended header says "the tree so far", but the map is built from the
**persisted** `generatedTree` once, before the chunk loop — it does not include chunks synthesized in the
current run. The comment on `withRepoMapContext` says "PRIMARY chunk prompt", which is accurate.

## Scan 5 detail (~10:25 CT) — the bh2 reported drifts were then fixed

`harvest.ts` + `mcp.server.ts` (+ tests) landed, closing two drifts bh2 had only **REPORTED**:
- **harvest budget:** `HARVEST_BOUNDS_LABEL`'s "12 s wall-clock budget" is now real — each search leg is
  handed `Math.min(remainingMs(), HARVEST_SEARCH_TIMEOUT_MS=8000)` (`harvest.ts:434`) instead of a fixed
  8000, and a leg that ignores its slice is detected post-await and noted with `RT_E_BUDGET_EXHAUSTED`.
  The code is genuinely registered (`errors.ts:45`, documented `:513`). Test pins both the shrinking
  slice and the overrun note.
- **MCP frame cap:** the cap is documented in bytes but was enforced with `String.length`; now an
  incremental `Buffer.byteLength` counter (`mcp.server.ts:201,274,289`) enforces real UTF-8 bytes. Test
  uses a real stub server and a `€`-padded frame (400 UTF-16 units < 600 cap, 1200 UTF-8 bytes > cap).
  tsc/eslint re-run after these bytes: (see final state).

Minor wording (not an alert): the harvest doc-comment says an overrun is "reported as a coded degraded
result"; `HarvestSearchResult` has only `notes: string[]` (no `code` field), so the code rides inside a
note string. Consistent with the module's note idiom, but "coded" is loose.

## Test teeth (mutation check in a COPY under scratch)

- **`synthesis-policy.test.ts`** — copied `synthesis-policy.ts` + its test to
  `$env:TEMP\rt343_wd2\mut1\` and mutated the module twice:
  - Mutation A (`P6_SYNTH_CANDIDATES_MAX` 4 → 99): test suite **FAILS** (exit 1, 7 pass / 1 fail).
  - Mutation B (`selectBestOfN` made non-lazy — produce all up front): suite **FAILS** (exit 1,
    7 pass / 1 fail).
  - Baseline copy passes 8/8. **Teeth CONFIRMED** — the test guards both the cap and laziness.
- **`rt-ring.test.ts` hydrate bound pin** — independently re-derived in `probe5.mjs`: a 400-row blob
  hydrates to exactly `RING_CAP`=200 (oldest `m200` kept first, newest kept last, 32 001 ≤ 65 536
  bytes); a bulky 200-row blob is byte-trimmed to 146 rows (65 217 ≤ 65 536). **CONFIRMED** — the
  hydrate re-applies both caps.
- **`sign-in-gate.test.ts`** (`SignInButtons handles a rejected signIn` source guard, WIP lane) — used
  its own `RT_GATES_TX` seam: pointed the guard at a copy of `gates.tsx` with the `.catch(...)` chain
  reverted to the pre-fix `onClick={() => signIn(...)}`. Result: **FAILS** (`not ok 2`, 3 pass / 1 fail,
  exit 1). **Teeth CONFIRMED** — the guard really pins the rejection handler, and the repo is untouched
  (the mutant lives in `$TEMP`).

## Scan 3 detail (~10:12–10:20 CT)

25 tracked files, +1507/−34; more lanes landed: `auth/gates.tsx` + `sign-in-gate.test.ts` (a real
unhandled-promise fix on `signIn`), `rt-ring.ts` hydrate bound-re-application, `rt-events.ts` census
re-count, `openai-compatible.ts` cached-token parse + `registry.test.ts` pin, `rt-events.test.ts`
coalesce boundary pin. tsc **0 errors**; eslint **0 problems** (ALERT-2 fully cleared); prohibited
constructs **0**.

## Final quality state (watch ended ~10:30 CT; tree quiet ≈7 min, no writer source edits after 10:23)

- **Prohibited-code count: 0.** Zero `TODO`/`FIXME` bodies, `as any`, `@ts-ignore`/
  `@ts-expect-error`/`@ts-nocheck`, `eslint-disable`, `.only(`, unconditional `.skip(`, debug
  `console.log`, empty/silent `catch {}`, or hardcoded fake returns across **all** added tracked
  lines and the 4 new source files. (Documented best-effort catches — e.g. the delivery-marker
  staging sweep — carry explanatory comments and rethrow/return honestly, not silent swallows.)
- **tsc --noEmit: exit 0** (last run ~10:29, 34-file tree). **eslint .: exit 0, 0 problems**
  (last run ~10:29).
- **Test teeth:** 3 mutation checks run in scratch copies, all killed (`synthesis-policy` cap +
  laziness; `sign-in-gate` source guard). Plus 6 independent probes (`probe1..5`) all CONFIRMED.
- **Claim-vs-byte:** every durable claim checked matched its bytes; two transient WIP artifacts and
  three WIP alerts cleared on their own. No durable false claim or fabrication found.
- **Unclean / residual (honest, all reported by the writing lanes, none introduced as a false claim
  by this wave):** (a) the lane-1 **pass-rate delta** claim ("expected pass@1 rises with N") is a
  reasoned expectation, **not measured** — its own log says so; (b) pre-existing low-severity drifts
  surfaced by the bug hunters and **left reported** — harvest's now-fixed label, `chat.ts` identity
  validators (F7), `vault.lessonNotes` hostile-input (F8), `diagnose.ts` rule-7 dead branch (F9),
  `knowledge.fingerprint` NUL delimiter (F6), `deepseek` retry-set asymmetry (F5). These are lane
  findings, not wave-introduced false claims.
- **Not determined by me:** the keyed measurements (343-1 §3d; 342 §7) — no keyed call was made, so
  the "converged on candidate 2" evidence is taken as the lane's measured output, not re-derived.
  The full `npm test` gate was intentionally not run (eight concurrent writers); only targeted
  files/tests were executed.

## Scan-count summary

10 scan snapshots (scan 0 baseline → scan 5 + 4 tsc/eslint refreshes + 6 probes + 4 quiescence
checks). Alerts raised: 3 (ALERT-1 tsc WIP, ALERT-2 eslint WIP, ALERT-3 README doc drift) — **all
cleared** by writer bytes before the boundary. Alerts that stand: **none**.

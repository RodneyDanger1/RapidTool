# 320 · G2 · DIAGNOSE FIXER — `diagnose` wildRun disk-truth projection (RapidTool W44 Phase-2 wave-2)

Lane G2 (fixer), wave-2. Repo: `C:\Users\mnril\Desktop\RapidTool Main`
(git-bash `/c/Users/mnril/Desktop/RapidTool Main`). HEAD at start: `c1049ba` (tree clean,
boundary green of record at `21c4731`).
Box (only writable): `src/lib/diagnose.ts` · `src/lib/diagnose.test.ts` · `fixes/320_g2_diagnose.md`.
Scratch (outside repo): `C:/Users/mnril/g2_scratch/`.
Bug ticket: wave-2 small fix #6 (fixes/319_keyed_trial.md:48) — T1 F-D · T2 BUG-2. Keyless lane; no repo edits outside box; scoped proofs only.

## Status

**COMPLETE (lane scope)** — recon → repro → fix (diagnose.ts) → pin (diagnose.test.ts) → scoped proofs → [FOR-PARENT] wiring for the out-of-box CLI load+projection. End-to-end effect lands when the parent applies §6 (`scripts/rapidtool-cli.mjs` is outside this lane's box by rule).

---

## §1 Recon — the verified divergence and its exact mechanics

**Symptom (T1 F-D · T2 BUG-2, both re-read at source):** on a parked/paused run the disk
holds `wildRun: {active:true, pause:true, stoppedAt:null}` while `diagnose` projects
`{active:false, pause:false, stoppedAt:<read-time>}` + a `overdueMs` that grows per call.
Evidence bytes: `C:/Users/mnril/w44_trial/game/build.json` vs `.../game/06_diagnose.out`
(stoppedAt 1790783913861 ≈ its own generatedAt 1790783913906; overdueMs 98419) — same shape
in website/ and program/.

**Mechanic (verified line-by-line, not assumed):**

1. CLI `diagnose` loads the project with **no preserveWildRun**:
   `scripts/rapidtool-cli.mjs:3798` `const p = h.loadProject(CLI_PROJECT);`
   → `src/lib/headless.ts:102-107` `loadProject(path, opts?)` → `io.importProject(raw, opts)`
   (`src/lib/io.ts:454`, `:522` passes `opts` to `hydrateProject`) →
   `src/lib/engine.ts:2408` `hydrateWildRun(raw.wildRun, currentPhase, opts?.preserveWildRun === true)`.
   `opts` undefined ⇒ preserve=false ⇒ `engine.ts:2227-2239`: an **active** run is returned
   force-stopped: `active:false, pause:false, park:null, stoppedAt: run.stoppedAt ?? Date.now()`.
   That `Date.now()` is the read-time fabrication — the in-memory view, **never persisted**
   (T1 verified mtime/size unchanged; those semantics are deliberate for the browser hydrate —
   engine.ts:2184-2190 — and for `wild --start` — rapidtool-cli.mjs:3532-3534 — but wrong for
   a read-only observer verb).
2. CLI projects `wr.stoppedAt` from that force-stopped copy verbatim (`:3819`) and computes
   `overdueMs: lastAutoAt != null ? Date.now() - lastAutoAt : null` (`:3820`) —
   unconditionally, so even a parked/stopped run gets a **growing** overdue clock.

**Coherence check (the honest idiom already in-tree):** the UI path
`src/lib/rt-client.ts:643-654` (`projectToDiagnosis`) derives
`overdueMs: wr.active && !wr.pause && wr.lastAutoAt !== null ? Math.max(0, now - wr.lastAutoAt) : null`
— i.e. an overdue clock exists ONLY for a run that is genuinely progressing. The CLI copy of
the same projection diverged (unconditional derivation + it reads a force-stopped hydrate).
So the fix = make `diagnose` load with `preserveWildRun:true` (exactly like
pause/resume/step/stop do — `rapidtool-cli.mjs:3543`) and derive `overdueMs` with the
in-tree honest rule, never fabricating `stoppedAt`.

**Wiring vs box:** the load line + projection call are in `scripts/rapidtool-cli.mjs`
(OUTSIDE this lane's box) → exact [FOR-PARENT] patch text in §6. The projection logic
itself is moved into this lane's box (`src/lib/diagnose.ts`) as the one canonical,
pinned implementation: `projectWildRun(raw, now)`.

**Discarded as not-the-fix:** rules 1-2 of `buildDiagnosis` are already correct — a parked
run (pause:true) never ranks `wild-step-timeout`, and `buildDiagnosis` is pure (it can only
project what its input carries). No fabrication happens inside diagnose.ts today; the
fabrication is upstream in what the CLI feeds it. A diagnose.ts-side clamp cannot recover
`active/pause` from a force-stopped input (indistinguishable from a genuine stop) — hence the
helper + the [FOR-PARENT] wiring, not a guess inside the builder.

## §2 Repro (BEFORE) — live, keyless, against the scratch copy

- Scratch copy: `C:/Users/mnril/g2_scratch/g2_game_parked.json` ←
  `C:/Users/mnril/w44_trial/game/build.json` (trial dir untouched). sha256
  `2d37abe403f826ac4c939af76388401dabd79e37981d87ffec39f0f81efae5db`, 41637 bytes.
- Repro driver: `C:/Users/mnril/g2_scratch/g2_repro.sh` (two consecutive CLI `diagnose` runs,
  3s apart, keyless `env -u DEEPSEEK_API_KEY`, outputs in `before_diag1.json` /
  `before_diag2.json`; project sha256 re-checked after).

(Results appended below in §2b.)

### §2b Repro results — CONFIRMED (2026-09-30, keyless, live)

`bash C:/Users/mnril/g2_scratch/g2_repro.sh` → captured verbatim (masked nothing; scratch paths only):

```
== sha256 BEFORE ==  2d37abe403f826ac4c939af76388401dabd79e37981d87ffec39f0f81efae5db
== disk wildRun (truth) == {"active":true,"pause":true,"stoppedAt":null}
== run 1 == exit=0
== run 2 == exit=0
== sha256 AFTER ==   2d37abe403f826ac4c939af76388401dabd79e37981d87ffec39f0f81efae5db   (UNCHANGED)
== diagnose run1 wildRun ==
{"generatedAt":1790785806328,"wildRun":{"active":false,"pause":false,"phase":0,
 "startedAt":1790783801207,"lastAutoAt":1790783815484,"lastAutoLog":"P0 review REJECTED: … + seque",
 "stoppedAt":1790785806282,"overdueMs":1990841}}
== diagnose run2 wildRun ==
{"generatedAt":1790785810902,"wildRun":{"active":false,"pause":false,"phase":0,
 "startedAt":1790783801207,"lastAutoAt":1790783815484,"lastAutoLog":"P0 review REJECTED: … + seque",
 "stoppedAt":1790785810865,"overdueMs":1995417}}
== stderr bytes == 0 / 0 (one parseable JSON on stdout; exit 0 both)
```

**Read:** run 1 `stoppedAt` = 1790785806282 = its own `generatedAt` − 46 ms (read-time stamp);
run 2 `stoppedAt` = 1790785810865 — MOVED (read-time again). `overdueMs` grew 1990841 → 1995417
(+4576 ms across a ~4.57 s gap) on a run that is PARKED, not overdue. Disk bytes + sha256
identical before/after across both runs (projection-only divergence, no write). This is
exactly T1 F-D / T2 BUG-2, now reproduced against the scratch copy — trial dir untouched
(re-hashed at the end of the lane in §5).

**Repro-of-cause (module level, same run):** `h.loadProject(scratch)` without opts — the
diagnose load path — returns an in-memory wildRun already force-stopped
(`active:false, pause:false, stoppedAt:<now>`); the same file loaded with
`{preserveWildRun:true}` keeps `active:true, pause:true, stoppedAt:null`. (§5 quotes this.)

## §3 Fix (in box) — `projectWildRun`

`src/lib/diagnose.ts`: new export `projectWildRun(raw: unknown, now: number): DiagnosisWildRun`
— the ONE canonical projection from a persisted wildRun value to the diagnosis view:

- `active` / `pause` / `phase` / `startedAt` / `lastAutoAt` / `lastAutoLog` — disk truth,
  defensively coerced (finite-number / string guards, `null` for junk — the M3 hostile-input
  spirit of the file).
- `stoppedAt` — the persisted number-or-null **verbatim**; NEVER a read-time fallback.
- `overdueMs` — derived ONLY while `active && !pause && lastAutoAt !== null`
  (`Math.max(0, now - lastAutoAt)`), else `null` — the rt-client.ts:653 idiom; a parked or
  stopped run has no overdue clock.
- Junk input (null/number/array) → `null` (no throw).

## §4 Pin — `src/lib/diagnose.test.ts` (additive; fixture = the parked disk scalars)

Pins: parked run projects `active:true, pause:true, stoppedAt:null, overdueMs:null` and is
**stable across two reads at different `now`** (no read-time fields); progressing-run
derivation; stopped-run passthrough; junk guards; and the builder echo (parked run through
`buildDiagnosis` is byte-stable and never ranks as a timeout/stop).

## §5 Proofs (all scoped; 2026-09-30)

1. **Scoped suite (the pin)**: `node --experimental-strip-types --test src/lib/diagnose.test.ts`
   → `TEST_EXIT=0`, `# tests 21 / # pass 21 / # fail 0` (baseline before the pin: 17/17 —
   +4 additive G2 tests, no existing test/helper touched).
2. **Scoped lint**: `npx eslint src/lib/diagnose.ts src/lib/diagnose.test.ts` → `ESLINT_EXIT=0`
   (stdout carries only the npm notices; 0 problems).
3. **Fixture byte-fidelity check** (`C:/Users/mnril/g2_scratch/g2_fixture_check.mjs` — extracts
   the pin fixture from `diagnose.test.ts` and diffs it against the scratch copy):
   `scalars equal: true` · `lastAutoLog equal: true` (300 chars, verbatim).
4. **Fix-chain probe** (`C:/Users/mnril/g2_scratch/g2_probe.mjs` — module level, keyless):

```
disk wildRun                  : {"active":true,"pause":true,"stoppedAt":null}
BEFORE read1 (old chain)      : {"active":false,"pause":false,"stoppedAt":1790786054618,"overdueMs":2184516}
BEFORE read2 (old chain)      : {"active":false,"pause":false,"stoppedAt":1790786054618,"overdueMs":2188516}
AFTER  read1 (fixed chain)    : {"active":true,"pause":true,"stoppedAt":null,"overdueMs":null}
AFTER  read2 (fixed chain)    : {"active":true,"pause":true,"stoppedAt":null,"overdueMs":null}
after stable across reads     : true
HALF  helper on old load      : {"active":false,"pause":false,"stoppedAt":1790786054618,"overdueMs":null}
```

   Reading: BEFORE (default load + old inline projection) reproduces the divergence —
   `active:false/pause:false`, `stoppedAt` = load time, `overdueMs` growing (+4000 ms read1→read2);
   AFTER (`preserveWildRun:true` load + `projectWildRun`) is disk truth and STABLE;
   HALF proves the helper alone cannot recover `active/pause` from a force-stopped hydrate —
   the [FOR-PARENT] load flag is REQUIRED (both halves of §6 are load-bearing).
   Honest limit of the pair: the probe shares one forced-load instance across its two BEFORE
   reads, so `stoppedAt` is constant within the pair — the CLI-level repro (§2b) shows it
   MOVING across processes.
5. **Trial dir untouched / scratch integrity**: `w44_trial/game/build.json` sha256 still
   `2d37abe403f826ac4c939af76388401dabd79e37981d87ffec39f0f81efae5db` (= the copy's hash,
   checked at §2b start, §2b end, and §5 probe); the scratch project hash is identical before
   and after every run above (projection-only divergence, no writes).
6. **git status / box discipline (end of lane)**: MY delta = `M src/lib/diagnose.ts` ·
   `M src/lib/diagnose.test.ts` · `?? fixes/320_g2_diagnose.md`. Concurrent sibling lanes are
   visible in the same tree and were NOT touched (G3 promotion lane: `M scripts/rapidtool-cli.mjs`
   — exactly one hunk `@@ -1453,6 +1453,33 @@`; `M src/lib/headless.ts`; `M src/lib/headless.test.ts`;
   `M scripts/run-eval.mjs`; `M scripts/run-eval.test.mjs`; `?? fixes/320_g3_promote.md`).
   Line numbers in §6 were read from the CURRENT working tree (which carries G3's +27-line hunk)
   and are **content-anchored** — apply by matching the literal text, not the number.

**Re-verification (fresh re-run, 2026-09-30T16:36Z):** `node --experimental-strip-types --test src/lib/diagnose.test.ts` → `TEST_EXIT=0` (`# tests 21 / # pass 21 / # fail 0 / # cancelled 0 / # skipped 0`); `npx eslint src/lib/diagnose.ts src/lib/diagnose.test.ts` → `ESLINT_EXIT=0`; fixture check → `scalars equal: true` / `lastAutoLog equal: true`; fix-chain probe → AFTER arm stable, scratch hash unchanged (`2d37abe4…`). Identical to the §5 record. Full-workspace gates (`npm test` / `typecheck` / `gate.sh` / `hermes verify`) are intentionally NOT run from this lane — the wave reserves them for the parent + V boundary, and the tree carries sibling lanes' uncommitted edits (G3), so a full run would not be attributable to this box.

**Known honest limit (pin scope):** `diagnose.test.ts` (src/lib) cannot import
`scripts/rapidtool-cli.mjs`, so the pin locks the projection contract + the divergence fields
against the parked fixture; the CLI wiring is locked by the §2b live repro + the §5 probe +
the §6 patch. If the parent wants the verb itself pinned in-repo, a scripts-leg spawn pin
(kind of `scripts/cli-exit-taxonomy.test.mjs`) on the scratch shape is the candidate — out of
this lane's box.

## §6 [FOR-PARENT] — exact CLI patch (out of box; NOT applied here)

Both halves of the divergence live in the CLI's `diagnose` verb (`scripts/rapidtool-cli.mjs`).
`src/lib/diagnose.ts` now owns the canonical honest projection (`projectWildRun`, pinned above);
the verb must (A) load the project with `preserveWildRun: true` and (B) feed its projection from
`diagnose.ts` instead of the inline copy. **Apply by CONTENT** — the numbers below were read from
the current working tree (G3's +27-line hunk at :1453 is in the file; re-check before editing).

### Hunk A — the load (current tree **:3825**)

BEFORE (exact):
```js
              const p = h.loadProject(CLI_PROJECT);
```

AFTER (exact):
```js
              // G2 (fixes/320): diagnose OBSERVES the persisted run — load it
              // with preserveWildRun so engine.hydrateWildRun cannot force-stop
              // a parked/active run into a read-time artifact (its browser-
              // hydrate default); pause/resume/step/stop load the same way
              // (this file's wild arm, :3543).
              const p = h.loadProject(CLI_PROJECT, { preserveWildRun: true });
```

### Hunk B — the projection (current tree **:3836-3849**)

BEFORE (exact):
```js
              const wr = p.wildRun;
              if (wr && typeof wr === "object") {
                const lastAutoAt = typeof wr.lastAutoAt === "number" ? wr.lastAutoAt : null;
                wildRun = {
                  active: wr.active === true,
                  pause: wr.pause === true,
                  phase: typeof wr.phase === "number" ? wr.phase : null,
                  startedAt: typeof wr.startedAt === "number" ? wr.startedAt : null,
                  lastAutoAt,
                  lastAutoLog: typeof wr.lastAutoLog === "string" ? wr.lastAutoLog : null,
                  stoppedAt: typeof wr.stoppedAt === "number" ? wr.stoppedAt : null,
                  overdueMs: lastAutoAt != null ? Date.now() - lastAutoAt : null,
                };
              }
```

AFTER (exact):
```js
              // G2 (fixes/320): the canonical projection now lives in
              // diagnose.ts (`projectWildRun`) — disk truth verbatim; overdueMs
              // derived ONLY for a progressing run (active && !pause), never a
              // growing `now - lastAutoAt` on a parked/stopped run.
              wildRun = rtDiag.projectWildRun(p.wildRun, Date.now());
```

(`rtDiag` is already imported at the top of this case — `if (!rtDiag) rtDiag = await import(RT_DIAG_PATH);`,
current tree :3790 — so no new import is needed.)

### Expected effect after A+B

Two consecutive `diagnose` calls on the parked scratch copy report
`"active":true,"pause":true,"stoppedAt":null,"overdueMs":null` — identical across reads — with
the project file sha256 unchanged. The §5 AFTER arm already demonstrates this exact chain at
module level; §2b is the before-bytes to diff against.

### Optional follow-ups (NOT required for ticket #6)

- `src/lib/rt-client.ts:652-653` carries the same derivation inline; adopting `projectWildRun`
  there would dedupe (its current idiom is already honest — no divergence today). Out of box.
- A scripts-leg spawn pin for the wired verb (see §5 known-limit) — parent's call.

=== END 320_g2_diagnose — COMPLETE ===

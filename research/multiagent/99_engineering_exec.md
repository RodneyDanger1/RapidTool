# 99 — ENGINEERING COMPLETION EXEC: scripts-leg fix + stability gate (P-96)

- **File:** `research/multiagent/99_engineering_exec.md`
- **Executor:** PRO executor P-96 (engineering-completion lane) · 2026-09-06
- **Consumes:** `research/multiagent/96_engineering_completion.md` §2 / §3 / §6.2
  (completion-checklist steps 1-3 and 8). This file is the exec log for those.
- **Ownership (strict, honored):** `scripts/*.test.mjs`, `scripts/grok-pwa-shared.mjs`
  (test-side only — left untouched), NEW `scripts/gate.sh`, this file. **No `src/`
  file was modified.** The fixer wave `deleg_ee964d63` was mid-flight the whole
  pass; every src-side red below is theirs, recorded here for the scorecard only.
- **Discipline:** baseline reproduced → test-only patches (file:line) → scripts
  leg re-run → full `npm test` (both legs) → lint sweep for scripts/ → gate.sh
  build + verdict-logic smoke tests → full gate run.

---

## 1. Baseline (reproduced before touching anything)

| Reading | Result |
|---|---|
| `node --test "scripts/**/*.test.mjs"` | **195 tests · 185 pass · 10 fail · 0 skip** |
| 8 × `grok-pwa-plugin.test.mjs` | identity leak: `grok-pwa-shared.mjs` identity probes default to `process.cwd()` and the repo root IS a RapidTool project (`src/lib/og/site.json` = RapidTool + `public/og.jpg`), so the repo's own title/`og.jpg` beat the expected document-title / host-slug / placeholder output |
| 2 × symlink tests | `EPERM: operation not permitted` from `symlinkSync(join(projectRoot(),"scripts"), link)` into `%TEMP%` (this Windows box has no Developer Mode / symlink privilege) |
| `npm test` | scripts leg failed first → **src leg never ran** (the `&&` chain) — reproduced exactly as 96 §0 states |
| `npx eslint scripts/` | 0 problems (nothing to clear in scripts/) |

---

## 2. Fixes landed (all test-side, zero product-code changes)

### 2.1 `scripts/grok-pwa-plugin.test.mjs` — the 8 identity-leak tests now use the
same `mkdtempSync` cwd isolation as their 39 passing siblings (mechanical)

| test | isolation added |
|---|---|
| platform chrome overwrites share-card metas… (105) | `cwd: mkdtempSync(join(tmpdir(),"grok-og-title-"))` :112 |
| published grok.me slug is still a title fallback (246) | `grok-og-slug-` :254 |
| emits og:image for a public host… (305) | `grok-og-placeholder-` :316 · `grok-og-customcard-` :328 |
| placeholder og:image appends site.color (326) | `grok-og-themed-` :338 · `grok-og-badcolor-` :348 · `grok-og-customcolor-` :355 |
| document title entities not double-escaped (349) | `grok-og-entities-` :363 |
| injects into documents with no head (365) | `grok-og-nohead-` :380 |
| streaming injector matches </HEAD> (372) | `grok-og-stream-` :390 (via `createHeadInjector`) |
| uses the app name in the injected title (397) | `grok-og-apptitle-` :418 |

`grok-pwa-shared.mjs` defaults deliberately untouched — real apps rely on
`process.cwd()` resolution; changing the default would break
`server/middleware/grok-pwa.ts` (96 §2.1 fix-plan item 2).

### 2.2 Symlink tests — junction on win32, documented honest skip as fallback

- `scripts/check-auth-invariant.test.mjs:101-115` — `symlinkSync(target, link, process.platform === "win32" ? "junction" : undefined)`; on win32 `EPERM` → `t.skip("symlink test needs Developer Mode on Windows (junction refused: EPERM)")` :112.
- `scripts/with-app-env.test.mjs:119-133` — same pattern, skip at :130.
- Junctions are privilege-free directory reparse points and still exercise the
  `process.argv[1]`-via-link path both tests guard. **On this box both tests
  PASS via junction** (the skip branch was not needed here; it exists for
  locked-down hosts). Linux is unaffected: `undefined` type → real symlink.

### 2.3 NEW `scripts/gate.sh` — the stability gate (96 §6.2 item 8)

Runs, in order, with every gate recorded even when an earlier one is red (one
invocation reports the whole picture):

1. `npm run typecheck` (tsc --noEmit) → 2. `npm run lint` (eslint .) →
3. scripts-leg tests, then the src/lib suite (same commands and order as
   `npm test`, so the gate stays honest about the chain `npm test` `&&`-s) →
4. `npm run build` (vite build + db:migrate — slowest, least diagnostic, last).

- `--double`: re-runs both test legs a second time in the same invocation.
  A test that flips between run 1 and run 2 (pass→fail **or** fail→pass) is a
  flake → **exit 3**. A test failing BOTH runs is a hard failure → **exit 1**.
  All green → **exit 0**. (Symmetric difference = flake; intersection = hard.)
- Verdict: exactly **one JSON object on stdout**, always:
  `{"ok":bool,"double":bool,"flakes":[...],"hardFails":[...],"skips":N,"wallMs":N,"gates":{"typecheck":{ok,exit,ms},"lint":{ok,exit,ms,problems},"testsScripts":{ok,exit,ms,pass,fail,skipped},"testsLib":{...},"build":{ok,exit,ms}}}`
  Diagnostics go to stderr only, so the JSON pipes/parses directly.
- The verdict-builder logic was smoke-tested in isolation against fake node-test
  logs before the real run: green→0, green+double→0, hard-fail→1, flake→3 — all
  four exit paths and the JSON shape verified (fixtures under `/tmp/gate-smoke`,
  throwaway).

---

## 3. Verification numbers (this pass, Windows)

| Gate | Before | After |
|---|---|---|
| scripts leg (9 files) | 185 pass / **10 fail** | **195 pass / 0 fail / 0 skip** (junctions worked → no skips needed) |
| `npm test` full | scripts leg blocked the `&&` chain — src leg never ran | scripts leg 195/195 → **src leg now runs**: 1106 tests · 1097 pass · **9 fail** · 0 skip — every fail in the fixer wave's files (§4), none in scripts/ |
| `npm run typecheck` | not re-run (wave editing) | **exit 0** (40.9s inside gate.sh) |
| `eslint .` | 0 err / 9 warn (96 §3) | 1 error + N warnings, N drifting **11 → 16 during this pass** (wave editing live) — all src/ or root debris, **zero in scripts/** (eslint exit 1) |
| `npm run build` | not re-run | **exit 0** (147.6s inside gate.sh: vite build + db:migrate) |
| `bash scripts/gate.sh` | n/a (new) | runs; verdict JSON emitted; exit 1 today **solely** from lint error + the wave's 9 src-leg fails (§4) |

Run-to-run drift noted: the src leg showed 10 fails on one `npm test` pass and
9 on the next while the wave edited live — `gate.sh --double` exists precisely
to catch that class of thing once the wave lands.

---

## 4. Not mine — wave-transient src-side reds (recorded for the scorecard)

Owned by `deleg_ee964d63` (fixes/97-101 lanes); untouched by this exec:

- **src-leg fails (9):** `parseSynthesisEnvelope` (subtests: parses a plain
  envelope; tolerates ```json fences), `signatureFunctionNames`,
  `briefFitSatisfied` (vocabulary-free brief), `liveP6Synthesis` ×3 (T4/T5 —
  fixes/97 P0-01), `scratch-dir cleanup` + `runNodeBounded` (node-runner) —
  engine/dod/prompt-engine/exec lane files.
- **lint error:** `src/lib/codegen.server.ts:515` prefer-const (new file, wave).
- **lint warnings (10):** `probe-f6.ts` ×3 (root debris — 96 §3 sweep item, not
  a scripts file), `engine.ts:15 b18Tail`, `harvest.ts:701 joined`,
  `store.test.ts:12 hydrateProject`, `vault.ts` ×4 (strField/tsField/row/rowsOf).

---

## 5. Scorecard rows this exec owns (96 §8 checklist)

| Step | Acceptance | Status |
|---|---|---|
| 1 — fix the 8 grok-pwa identity leaks | 47/47 in suite, zero product changes | **DONE** — whole leg 195/195 |
| 2 — fix the 2 symlink tests | junction pass on Windows or documented skip | **DONE** — junction pass, skip-with-reason fallback in place |
| 3 — verify scripts leg | 9/9 files, 0 fail | **DONE** |
| 8 — stability gate | gate + `--double` + JSON verdict | **DONE** — `scripts/gate.sh`, logic smoke-tested; full `--repeat 3` ×3 acceptance (96 §6.2) deferred until the wave lands and all legs are green |

## 6. Hand-off notes

- Once the wave lands: `bash scripts/gate.sh --double` ×3 consecutive with
  `ok:true, flakes:[]` is the 96 §6.2 acceptance; skip budget ≤ 2 documented.
- `probe-f6.ts` (3 lint warnings + debris) and the 96 §1.3 root-probe cleanup
  are out of this lane's ownership — a finishing-pass item.

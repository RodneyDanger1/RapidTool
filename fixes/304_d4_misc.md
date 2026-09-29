# fixes/304_d4_misc.md — LANE L4 ROUND 2 · SCRIPTS/GUARDS/CLI HYGIENE (CODER D4)

> Wave W42 · cards L4-G1…G13 per `wave_plans/W42/SPEC.md` §2 · L4. HEAD `8418b04` (C4's G1+G2 landed in it).
> File box (sole writer): `scripts/gate.sh` · `scripts/gate-verdict.test.mjs` · `scripts/migration-plan.mjs` ·
> `scripts/migration-plan.test.mjs` · `scripts/write-atomic.mjs` · `scripts/write-atomic.test.mjs` ·
> `scripts/browser-guard.mjs` · `scripts/browser-guard.test.mjs` · `scripts/brand-check.mjs` ·
> `scripts/preview.mjs` · `scripts/rapidtool-cli.mjs` · `scripts/cli-exit-taxonomy.test.mjs` ·
> `src/lib/runtime-log.server.ts` · `src/lib/runtime-log.server.test.ts` · `src/lib/headless.ts` · `package.json`.
> Rules honored: PATCH-FIRST, additive-only · `node --check` per edited file · legs FOREGROUND · NO keyed
> calls · per-card evidence line below (append-only, `file:line · before → after · proof`).

## Status board

| Card | What | Status |
|---|---|---|
| L4-G1 | gate.sh zero-pass guard + double-mode stderr tails + verdict case F | DONE (C4) — verify leg |
| L4-G2 | migration-plan de-dupe (`authSchemaCopyState`) + anti-vacuity diagnostic | landed (C4) — leg run owed |
| L4-G3 | write-atomic mkdir inside try + rename-failure pin | TODO |
| L4-G4 | browser-guard dead bare `::1` drop + `[::1]` pin | TODO |
| L4-G5 | "am I main?" idiom (brand-check · preview · write-atomic) | TODO |
| L4-G6 | readRtTail bounded fd read + >256 KB tail pin | TODO |
| L4-G7 | tree-run dirDirty note | TODO |
| L4-G8 | envelope code doc-guard + static code-literal leg | TODO |
| L4-G9 | doctor spend surfacing | TODO |
| L4-G10 | package.json `--test-reporter=tap` pin (both legs) | TODO |
| L4-G11 | USAGE emit line `[--verify-kind] [--force]` | TODO |
| L4-G12 | parseArgs refusal remedy clause (verify/update) | TODO |
| L4-G13 | envelope field-check sweep (doctor/diagnose/fixtures --draft) | TODO |

## Evidence

(log opened pre-edit per spec §2 per-lane rules, round 2 — 2026-09-29, coder D4.)

- **L4-G1 (C4, verified)** · `scripts/gate.sh` zero-pass guard + double-mode tails · `bash -n scripts/gate.sh` OK · `node --test scripts/gate-verdict.test.mjs` → **6/6 pass** (case intact) · HEAD `8418b04`.
- **L4-G2 (C4 landing, leg run by D4)** · `migration-plan.mjs:138` exports `authSchemaCopyState` (lazy fs import), test imports it; local `authSchemaCopies` gone (`grep -c` → 0); anti-vacuity diagnostic at test `:83` · `node --check` both OK · `node --test scripts/migration-plan.test.mjs` → **20/20 pass**.
- **L4-G3** · `scripts/write-atomic.mjs:67-75` — `mkdirSync(dirname(target), {recursive:true})` moved from outside the try to INSIDE it (first statement before `rename`); EXDEV message verbatim · `node --check` both OK · `node --test scripts/write-atomic.test.mjs` → **12/12 pass** incl. new pin "an injected rename failure re-throws the raw error and leaves the target absent" (asserts error identity `err === denied`, target absent, staged intact).
- **L4-G4** · `scripts/browser-guard.mjs:19-23` — `LOOPBACK_HOSTNAMES` dropped dead bare `"::1"` (WHATWG `URL.hostname` yields `"[::1]"`) and is now exported; `const` → `export const` · pin `browser-guard.test.mjs:120-133` asserts `new URL("http://[::1]:8080/").hostname === "[::1]"` ∈ set and bare `"::1"` ∉ set · `node --check` both OK · leg → **6/6 pass**.
- **L4-G5** · `write-atomic.mjs:20-24,89` · `brand-check.mjs:32-35,199` · `preview.mjs:24-27,335` — naive `import.meta.url === pathToFileURL(process.argv[1]).href` replaced with shared `isMainModule(import.meta.url)` (import from `./with-app-env.mjs`; realpath compare, symlink/case safe); unused `pathToFileURL` import dropped from all three (`pathToFileURL` now comment-only per file — grep shows 1 comment cite each, 0 code uses) · `node --check` ×3 OK · main smokes: `write-atomic` usage-refusal exit 1, `brand-check` ok JSON exit 0, `preview` usage-refusal exit 1 (all main blocks fire) · `write-atomic.test.mjs` (spawned-CLI path) **12/12 pass**.
- **L4-G6** · `runtime-log.server.ts:22-33,137-170` — whole-file `readFileSync(file).subarray(start)` replaced with `openSync` + `readSync` exactly the `size-start` window (short-read loop + `closeSync` in finally; torn/junk skip, newest-first `slice(-n).reverse()`, `[]`-on-missing preserved; `readFileSync` no longer imported — grep-visible) · test `runtime-log.server.test.ts:88-116` "reads a bounded window of a >256 KB file" (1400 rows ≈ 350 KB; newest-first asserted; row 1 outside window NOT returned; deterministic lower bound; `< 1400` proves window-bounded) · `--experimental-strip-types --check` both OK · leg → **9/9 pass**.
- **L4-G7** · `rapidtool-cli.mjs:1569-1577` — `catch { /* advisory only */ }` → `catch (e)` setting `payload.dirDirtyNote = "ledger read failed — divergence report skipped: " + (<msg>).slice(0,200)` (exit/verdict semantics untouched) · `node --check` OK · smokes on X3 scratch (`…\Temp\x3_cli_smoke`): broken ledger (`not json{{`) → exit 1 RT_E_VALIDATION (loader-owned refusal, byte-identical to pre-change; `dirDirtyNote` null — the loader exits before the arm's catch); happy path (`--dir emitted --project build.json`) → **exit 0**, `dirDirty` 5 keys, no note. **Honest reachability note:** `h.importTreeDir` is total for every JSON-reachable input (per-row defenses: `repairTreePathRefusal` + per-file try) and `loadProjectFor` responds+exits rather than throws, so the note branch is defense-in-depth; its landed expression verified by extract-eval on the real bytes: `Error("boom")` → `"ledger read failed — divergence report skipped: boom"`, string throw → same prefix, 500-char message → total 248 (bounded).

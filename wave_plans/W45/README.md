# W45 (the 331 wave) — six-lane repair wave — shared contract

**Opened:** 2026-10-02. **HEAD at open:** `03a6d0b` (`330 wave`), tree clean.

## Why this wave exists (disk + live evidence, gathered before dispatch)

1. **The keyed path is BLOCKED by a stale env var, not by funding.** Live probe today:
   - `GET https://api.deepseek.com/models` with the key in repo `.env` (tail `…19b3`) → **200**.
   - `POST /chat/completions` with `deepseek-v4-flash` → **200**, real completion, tokens billed.
   - The repo's own keyed path (`crew --max-steps 1`) → **401 "Your api key: ****42ff is invalid"**.
   - `DEEPSEEK_API_KEY` is set at **User scope** (tail `…42ff`, invalid) and **shadows nothing in
     `.env` because nothing loads `.env`**: `grep` for `loadEnvFile|dotenv` across `src/`, `scripts/`,
     `.grok/` returns **zero hits**. `.env` is only ever read by Vite's `load-env` plugin on the
     dev/build path (`with-app-env.mjs` loads only `.grok/app-env.json`, only `VITE_*`).
   - Consequence: every wave since W25 recorded "account unfunded / all keyed calls 402 / O-1
     blocker". That diagnosis is **stale**. The account is funded; the machine sends the wrong key.
2. **The keyed failure also crashes the process**: after the 401, `crew` exited with
   `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76`
   (exit `0xC0000409`). A red keyed call must exit through the code taxonomy, not abort libuv.
3. **The emitted product is still a single throwing stub.** Keyless `create` → `gate --autopilot`
   → `emit` on `research/eval-corpus/house-flip-manager.md` produced one job file,
   `src/jobs/flip.ts`, whose only body is `throw new Error("RT_E_VALIDATION · TODO(E-15) stub: implement job flip")`.
   `doctor` still reports `leftoverJobsAreReexportsOrStubs: true`, `autonomousSoftwareFactory: false`.
4. **Lane-owed items from the 330 logs** (each lane's own §owed sections):
   - `330_1 §6.1` — `headless.ts:2038` `materializeEmitTree` early-returns on zero tree rows, so a
     lone `generatedSource` with CJS residue is never materialized.
   - `330_4 §3.1` — L4 `verifiedProcedureLesson` id is unstable (forks on iteration count); exact
     two-part fix named.
   - `330_4 §3.3` — `driftLesson` (`knowledge.ts:1353`) has no production caller.
   - `330_5 §5.1` — the `scan` findings path still reports `RT_E_UNKNOWN`.
   - `330_5 §5.2` — valueless-flag asymmetry on six other verbs.

**Baseline gates (measured at open, before any lane edits):**
`npm run typecheck` exit 0 · `npm run lint` clean (`eslint` exit 0) · `npm test`
**774 suites / 2621 tests / 2611 pass / 0 fail / 10 skipped**, exit 0.

## Lane table

| Lane | Persona | Owned files (STRICT — no cross-lane edit) | Log |
|---|---|---|---|
| 331-1 | **Keywright** — provider/key plumbing + keyed-path repair | `scripts/rapidtool-cli.mjs`, `scripts/README-cli.md`, `scripts/cli-exit-taxonomy.test.mjs`, `src/lib/llm/**` (incl. `providers/*`), `src/lib/deepseek.server.ts`, `src/lib/errors.ts` | `fixes/331_1_keywright.md` |
| 331-2 | **Assayer** — verification core + lesson identity | `src/lib/verify.server.ts`, `src/lib/knowledge.ts`, `src/lib/harvest.ts`, `src/lib/engine.ts` + colocated `*.test.ts` | `fixes/331_2_assayer.md` |
| 331-3 | **Transit** — emitted-artifact integrity | `src/lib/headless.ts`, `src/lib/scaffold.ts`, `src/lib/compile-check.server.ts` + colocated tests | `fixes/331_3_transit.md` |
| 331-4 | **Composer** — codegen plan + census | `src/lib/codegen.server.ts`, `src/lib/doctor.ts` + colocated tests | `fixes/331_4_composer.md` |
| 331-5 | **Chrome** — console UI + real-browser proof | `src/components/console.tsx`, `src/routes/**` | `fixes/331_5_chrome.md` |
| 331-6 | **Warden** — harness guards + typecheck coverage | `scripts/**` EXCEPT the three Keywright files, `tsconfig.json`, `tsconfig.scripts.json`, `eslint.config.mjs` | `fixes/331_6_warden.md` |

## Cross-lane contracts (pre-specified so lanes can run in parallel)

- **C1.** `headless.ts` (331-3) is the only place the emit writer changes. `codegen.server.ts`
  (331-4) owns `treeChunkPlan` / `orderTreeChunks` output shape. If a codegen change needs the
  scaffold to consume something new, **331-4 writes the contract into its log and 331-3
  implements it** — neither edits the other's file.
- **C2.** `errors.ts` is owned by **331-1 only**. Any lane needing a new `RT_E_*` code
  **requests it in its log** (name + when it fires + remedy) and does not add it.
- **C3.** `scripts/rapidtool-cli.mjs`, `scripts/README-cli.md`, `scripts/cli-exit-taxonomy.test.mjs`
  are **331-1 only**. 331-6 owns every other `scripts/` file.
- **C4.** `console.tsx` / `routes/**` are **331-5 only**.

## Hard rules (inherited, non-negotiable)

1. **Never print, echo, or commit a secret.** Diagnose keys by **last-4 tail only**. `.env` and
   `.env.bak-*` are never committed and never `VITE_`-prefixed.
2. **No fabrication.** Evidence is a command's real output or bytes read today. A keyless path must
   return an honest floor, never invented model text. `source:"illustrative"` is scaffolding, not fact.
3. **No full gate while siblings are mid-edit.** Targeted suites only (`node --test --test-reporter=tap <file>`,
   `npx tsc --noEmit` scoped where possible, `npx eslint <files>`). The **parent (boundary owner)**
   runs `npm run typecheck`, `npm run lint`, both test legs, `npm run build`, and `bash scripts/gate.sh`.
4. **Never run keyed calls in a loop / never run `npm run eval`** (it rewrites tracked
   `research/eval-out/**`). Keyed calls must be **bounded and budgeted** (one or two calls), and each
   keyed call must be reported with its token usage.
5. **Patch-only** on existing files. No export renames without updating every consumer. Node imports
   use explicit `.ts` extensions in the `src` chain. No `node:fs` import into client-safe modules.
6. **Logs are append-only**, one per lane, at the path above. Write the log incrementally; it must end
   with: verdict · per-fix before/after evidence · tests added and their real results · what you did
   NOT do and why.
7. **STOP-and-REPORT** any finding that needs a file you do not own. Do not reach across.
8. Run node as **Node 22** where the repo pins it (`%LOCALAPPDATA%\hermes\node\node.exe`) and also
   record the host Node (`v24.15.0`) result for suites you touch.

## OUTCOME (closed 2026-10-02)

All six lanes and three follow-ups landed. Boundary gates after every writer stopped:
typecheck 0 · lint 0 warnings · **788 suites / 2682 tests / 2672 pass / 0 fail / 10 skipped** ·
build 0 · **`gate.sh` `ok:true`, exit 0, no flakes**. Baseline at open: 2621 tests / 2611 pass (+61).

Headline results: the **keyed path is unblocked on all three surfaces** (the register's `O-1`
"unfunded account" premise was false — a stale ambient key was shadowing a valid, funded `.env` key),
a real browser keyed action returns real model text, and a keyed run emits **7 real job modules** with
`treeRun.substance {stubs:0, reexports:0, real:3}` (the M-A bar) plus `p6-arch`/`p6-brief-fit` PASS.
Full boundary report: **`fixes/331_0_parent.md`**. Keyed evidence: **`parent-keyed-findings.md`**.
Register append: **`AW45-c01…c08`**. Lane logs: `fixes/331_1…331_6_*.md`.

## Suggested persona charter (all lanes)

You are a senior engineer on a six-person team shipping a governed, honest software factory. You
write code that a reviewer would approve without comment: no dead code, no placeholder logic, no
silent catches, no claim in a comment or doc that the bytes do not support. Every fix ships with a
test that fails before it and passes after. You measure before you claim.

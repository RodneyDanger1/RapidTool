# 334 wave (W48) — parent / boundary record

**Boundary owner:** parent. **Opened** 2026-10-02 at HEAD `0d5b250`, tree clean. **Six personas
re-dispatched** plus one follow-up; every lane opened with a reconciliation of its own former work
(claimed / on disk / still open) before touching anything. Contract and briefs: `wave_plans/W48/`.
Lane logs: `fixes/334_1…334_6_*.md`.

## 1. Boundary gates (after every writer stopped)

| Gate | Command | Result |
|---|---|---|
| typecheck | `npm run typecheck` | **exit 0** — both legs; `tsc -p tsconfig.scripts.json --noEmit` is now **0 errors** |
| lint | `npm run lint` | **exit 0**, 0 warnings |
| assertions | `scripts/check-assertion-gaps.mjs` | **exit 0** (with the new tautology rule active) |
| tests | `npm test` | **scripts 405 / lib 2771 / 0 fail / 2 skipped**, exit 0 |
| build | `npm run build` | **exit 0** |
| gate of record | `bash scripts/gate.sh` | **`ok:true`, exit 0**, `flakes: []`, `hardFails: []` |

Baseline at wave open: 398 scripts + 2747 lib → **+31 tests, all green**. The headline: **the `scripts/**`
typecheck debt went from 134 errors across 14 files to 0, and `ERROR_BUDGET` is now `{}`** — retired, not
re-budgeted.

## 2. What each lane found and fixed in its own former work

| Lane | Result |
|---|---|
| **334-1 Prompter** | Found and fixed an **over-refusal**: a legal chain (`const THEN = "then"; getProperty(id)[THEN](cb)`) was being refused as a computed read — over-refusing costs more than the gap, since a legal promise chain refused surfaces to the operator as a synthesis failure. Closed the `this.m()` receiver gap (with an encloser tie so a same-named sync member on another receiver is not over-refused). Proved the F-2 deletion left no debris **and** that the surviving `p6.tree.shortfall` row still fires. Pinned the prior-render elision budget. Then, in a follow-up, folded the declared-script state into the minted evidence hash. `codegen.server.test.ts` 163 → **170**. |
| **334-2 Ledger** | L1: the keyed outcome is now **persisted on the project record** (`keyedTrailOutcome` / `foldLastKeyedOutcome`), so a *fresh* `doctor` process reports `keyState:"rejected"` with a tail-only key source instead of the honest-but-useless `unverified` (before/after measured on a real CLI run, no keyed call). L2: `RunResult.code` now carries the coded class of a P6 refusal in that invocation. L3: spend folds for `repairTreeDir` and the wild verbs. L4: appended the dated correction to `fixes/331_0_parent.md` (the 38-error claim). `headless.test.ts` 129 → **134**. |
| **334-3 Transit** | Decided the top open item with evidence: an unverified tree **legitimately satisfies** `p6-test`/`p6-verified`, because those measure the *executed* self-test (the specs really ran), and requiring the declared toolchain would be unsatisfiable on every fresh tree and block the mint forever — so the gap is a **named limit**, carried loudly on the emitted README banner (new) and on the envelope. It also tightened `p6-verified` so a hollow `"tested"` stamp (no `ok`, empty detail) can no longer pass a criterion whose name reads as verification. **And it found a false green**: a declared `main:"./src/main.ts"` was silently dropped by the traversal guard, so corrupting the declared entry still returned `ok:true` — now the declared entry is honoured and a corrupted one reds. `scaffold` 48 → 50, `compile-check` 78 → 79, new `dod.test.ts` 3. |
| **334-4 Switchboard** | **Retired the entire scripts typecheck debt**: `npx tsc -p tsconfig.scripts.json --noEmit` 134 errors / 14 files → **0 / 0**, `ERROR_BUDGET` now `{}`. Diagnostics surfaced real bugs fixed at the type, including a `.d.mts` declaring `Uint8Array[]` where the implementation returns `Buffer[]` (making a legal `.toString("utf8")` a type error), a one-line JSDoc swallowing a return type, and discriminated-union losses at the root of 7 test errors. Made the CLI act on an unverified tree (exit 5, documented). Ratchet teeth re-proven by planting an error in a previously-budgeted file, then reverting byte-identically. `cli-exit-taxonomy.test.mjs` 30 → **31**; the affected 11-suite set 244/244. |
| **334-5 Chrome** | Consumed the run-result code: the run and approve failure arms now carry `code`, ten error paths that showed prose now name their class (e.g. `RT_E_VALIDATION — Report phase must be an integer between 0 and 12.`), and the chip flips to the keyed class on a real refusal — browser-proven with **one keyed call, 0 tokens**, plus desktop 1440×900 and mobile 390×844 sweeps with 0 console/page/HTTP≥400 errors. `store.test.ts` → 93/93; combined 123/123. |
| **334-6 Warden** | Shipped the `always-true-expr` tautology rule it had withheld in the 331 wave (the parent had since fixed both instances it was blocked on) — it flags `x \|\| true`, `true \|\| x`, all-truthy `&&`/`??`/ternary forms, and correctly leaves 8 falsifiable forms alone. Shipped **stale-allowlist detection** so the coverage guard now fails on an allowlist entry whose module is covered again. Found **three dead modules with zero importers** (`db.ts`, `app-data/index.ts`, `multiplayer/index.ts`) and **two factually wrong allowlist reasons** (`app-data/index.ts` called "server-only" is the client-safe barrel; `db.ts` has zero imports referencing it). `check-assertion-gaps.test.mjs` 25 → **30**; `check-module-coverage.test.mjs` 6 → **7**. |

## 3. Boundary-owner work (cross-lane resolution)

1. **The `emit --run` exit-code collision.** Lane 334-4 made a green-but-unverified tree exit **5**; lane
   334-2 had already reported `headless.test.ts`'s `E-25` case failing as a sibling interaction. The stale
   expectation was in the test (`green tree must exit 0`), not in the CLI, so I updated the test to pin the
   new contract **with more assertions than before**: exit 5, `ok:true`, `unverified:true`,
   `unverifiedDeclaredScripts` naming the unrun script, and no `RT_E` code riding the signal. `headless.test.ts`
   134/134. **Note the consequence:** because the tree-run's dependency copy excludes `node_modules`, every
   freshly emitted scaffolded tree is unverified, so `emit --run` now exits 5 in the normal flow; exit 0
   requires every declared script to have actually run. That is a deliberate contract change (documented in
   `README-cli.md`), and it is recorded here as the operator-facing cost — if the preferred default is
   0-plus-envelope with an opt-in strict mode, that is a one-flag change for the next pass.
2. **Landed `types.ts`'s `lastKeyedOutcome`** (`{ code; at; keySource? }`) — lane 334-2's request, so the
   persisted keyed outcome is a first-class field rather than a local intersection.
3. **Closed the one cross-lane finding neither lane could fix:** `treeRunTestedEvidence` minted the **same**
   evidence hash for a verified and an unverified toolchain, defeating 334-3/334-4's new distinction at the
   proof level. Lane 334-1 (resumed) folded the declared-script state into the hash with canonical ordering
   and **conditional tokens** so a default/legacy run keeps its prior bytes — the one numeric hash pin in the
   repo (`wild-step.test.ts:988`) still holds. Verified `2834449053` vs `1625406386` vs `2383827441` for
   verified / unverified / entry-skipped. `codegen.server.test.ts` 170/170.

## 4. Proposals needing YOUR sign-off (nothing was deleted)

1. **`.t4scratch/` — 192 tracked files, 4.3 MB, duplicating `src/lib/**`.** Audited by lane 334-6: added in
   **one** commit (`2fa3cd9`, 2026-09-27), never touched since, **zero live readers** (all 44 hits are docs
   and lane logs plus one census script; nothing in `src/**`, `package.json`, `gate.sh`, CI or tests), and
   **105 of 192 files have drifted** from the real `src/lib` — a frozen ancestor snapshot that still carries
   the pre-fix `|| true` tautologies. Fully recoverable from `2fa3cd9`. **Proposal: `git rm -r .t4scratch`
   in one commit.** I did not delete anything: the repo's own rule permits deletion only when a path is
   untracked, which this is not. Lane 334-6 did add `.t4scratch/` to `.gitignore` so it cannot be re-tracked.
2. **Three dead modules with zero importers** — `src/lib/db.ts`, `src/lib/app-data/index.ts`,
   `src/lib/multiplayer/index.ts`. Each is either deleted or wired to a consumer; that is a product decision.

## 5. Still open (with owners)

1. **`emit --run`'s default exit for a fresh tree is 5** (see §3.1). Owner: the product owner, if the
   default should be an opt-in strict mode.
2. **`npm run eval` still not run** — it rewrites tracked `research/eval-out/**`. Owner: a wave that accepts
   the artifact churn.
3. **`R11-f01`**: the dev server binds `0.0.0.0` with no auth middleware — a documented host/port contract,
   so it is the product owner's call.
4. **The stale User-scope `DEEPSEEK_API_KEY`** is still set on this machine; the repo wins over it and says so
   by tail. Owner: the machine owner.
5. **A red kind-entry leaves `outcome.error` unset** while the failure tail names it (reported by 334-3).
6. **`cli-tool` has no declared `main`** — its `bin` launcher spawns on import, so it is not a load-smoke
   target (reported by 334-3).
7. **`AGENTS.md`'s `.grok/` claim needs the correction lane 334-6 wrote** (it names the four live read paths
   and the stale `status` file); `AGENTS.md` was not that lane's file, so the exact replacement text sits in
   `fixes/334_6_warden.md`.

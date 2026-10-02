# 334-6 · "Warden" — guards & repo hygiene (W48, pass 3)

**Lane:** 334-6 (Warden). **Wave:** W48 (334). **HEAD at open:** `0d5b250`, tree clean (only
`?? wave_plans/W48/`). **Owned (STRICT):** `scripts/check-assertion-gaps.mjs` + test,
`scripts/check-module-coverage.mjs` + test, `.gitignore`. **Runtime:** pinned Node
`%LOCALAPPDATA%\hermes\node\node.exe` = **v22.23.2**; host Node **v24.15.0**; every parsed
`node --test` run passed `--test-reporter=tap`. Scratch: `%TEMP%\rt334_6\`.
**Rules obeyed:** no full gate (siblings mid-edit), targeted suites only; no `npm run eval`;
no keyed calls; no secret printed; no tracked file deleted; no repo probe file left behind.

> Third pass on this lane: Step 0 read `fixes/331_6_warden.md`, `fixes/332_6_watchdog.md`,
> `fixes/333_1_verifier.md`, `fixes/333_2_registrar.md`, then `fixes/333_0_parent.md` §5 /
> `fixes/332_0_parent.md` §5, then the guard files on disk.

---

## Step 0 — reconciliation

### claimed (what the former passes said they landed)

- **331-6** shipped `scripts/check-assertion-gaps.mjs` (`tautology:true-literal` /
  `:length-floor` / `:literal-pair` / `:same-operand` / `:presence-only` / `:typeof-only` +
  `zero-assertion`) at **25 tests**; `scripts/check-module-coverage.mjs` at **6 tests** with a
  21→19-entry allowlist; `scripts/typecheck-scripts.test.mjs` (4). It **deliberately withheld**
  a `|| true` rule and reported two genuine never-fail assertions:
  `src/lib/codegen.server.test.ts:559` and `src/lib/node-runner.server.test.ts:92`.
- **332-6** (Watchdog) was a different file set (`rt-*`); its only guard-adjacent work was the
  `exec.test.ts` load-flake fix. No guard-file change claimed.
- **333-1 (Verifier)** re-derived the coverage guard live: **19 allowlisted · 0 unallowlisted**;
  the two `fixtures*` entries are gone (reached by `fixtures.review.test.ts`); F-6 recorded
  `.t4scratch/` as 192 tracked duplicates of `src/lib/**`.
- **333-2 (Registrar)** traced every claim to bytes (all reproduced) and corrected `AGENTS.md`
  (verb count 35→39; suite counts) + register appends `AW47-*`.

### on disk (verified today at `0d5b250`)

- `scripts/check-assertion-gaps.mjs` present with all six tautology rules + `zero-assertion`;
  `findTautologies` / `findZeroAssertionTests` / `lintSource` / `maskSource` exported.
- `scripts/check-module-coverage.mjs` present, **19-entry** allowlist, no `fixtures*` entries.
- Both parent fixes are real: `grep '|| true'` over `src/**` returns **0** — neither
  `codegen.server.test.ts` nor `node-runner.server.test.ts` carries the tautology any more.
- `.t4scratch/` **192** tracked files (4,345,663 bytes); `.grok/` **89** tracked.
- `.gitignore` = the 318_a4-corrected content (secrets, logs, `.hermes/`, `**/.rapidtool/logs/`).

### still open (before this lane's edits, with `file:line`)

1. `scripts/check-assertion-gaps.mjs:348` — `alwaysTruthySubject()` had no branch for an
   always-true boolean expression, so `assert.ok(x || true)` was never flagged. (Fixed here.)
2. `scripts/check-module-coverage.mjs:218-248` — `main()` exited only on *unallowlisted gaps*;
   a **stale** allowlist entry (module now reached) was undetectable — the parent flagged this
   blind spot in `fixes/332_0_parent.md` §3.4. (Fixed here.)
3. `.t4scratch/` — 192 tracked duplicate files, deletion owed (proposal in G3; not deleted).
4. `AGENTS.md:122` — blanket "`.grok/` … stale scaffolding … not the contract" is false for
   four live read paths (correction in G4; file not mine, reported only).

---

## G1 — the `|| true` tautology rule (landed green)

### What shipped

New rule **`tautology:always-true-expr`** in `scripts/check-assertion-gaps.mjs`, driven by a new
exported `alwaysTrueExpression(masked, raw)` that recurses over top-level boolean constructs:

| construct | flagged when | reason |
|---|---|---|
| `A \|\| B` | either operand always truthy | `` a `\|\|` expression with an always-truthy operand `` |
| `A && B` | both operands always truthy | `` a `&&` expression whose operands are all always truthy `` |
| `A ?? B` | left operand always truthy | `` a `??` expression whose left operand is always truthy `` |
| `c ? A : B` | both branches always truthy | `a ternary whose branches are both always truthy` |
| `assert.equal(<always-true>, true)` | the non-`true` side is always-true | `assert.equal compares … to the literal true — the comparison cannot fail` |

Operand truthiness reuses the existing `alwaysTruthySubject` (object/array/function/`new`/regex/
non-empty string/non-empty template/non-zero number/bare `typeof`) **plus** the bare literal
`true`; structure is read from masked text (string bodies blanked), so a `}` or `||` inside a
fixture string cannot confuse it, and `||=`/`&&=`/`??=`/`?.` are excluded.

**Deliberately NOT flagged** (documented in the file): falsifiable disjunctions
(`res.status === 0 || res.status === 2`), `x ?? true` (because `0 ?? true` is `0`), `x || false`,
`x && y`, `c ? true : false`, `assert.equal(y, true)`, and `assert.equal(x || true, false)`
(always fails — not a tautology). These can fail, so they are weak tests, not tests that cannot.

### Probe (scratch, out of repo) — `%TEMP%\rt334_6\probe_always_true.mjs`

```
lines 5–16  (12 positives: || true, true || x, || "default", || 1, || {}, || [], || /re/,
             || typeof w, true && true, c ? true : 1, assert.equal(x||true,true),
             assert.strictEqual(true, x||true))  -> 12 findings, all tautology:always-true-expr
lines 20–27 (8 falsifiable: ===-disjunction, ?? true, || false, || y, a && b, c?true:false,
             equal(...,"yes"), x.length > 0)      -> 0 findings
```

### Live tree

`node scripts/check-assertion-gaps.mjs` → `[assertion-gap] clean — 124 test file(s) scanned, 0 findings`, exit 0.
(123→124 between runs is a sibling adding a test file; the guard is clean over both.)

### Planted-teeth proof (RED before, GREEN after)

Appended `assert.ok(1 || true);` to `scripts/check-module-coverage.test.mjs` (owned, HEAD-clean):

```
=== RED (planted) ===
scripts/check-module-coverage.test.mjs:127: [tautology:always-true-expr] asserting a `||` expression
  with an always-truthy operand — always truthy, so the assertion cannot fail — assert.ok(1 || true);
[assertion-gap] 1 finding(s) across 123 test files — fix the assertion, do not delete it
RED_EXIT=1
```

`git checkout -- scripts/check-module-coverage.test.mjs` → `git status --porcelain` empty for the
file, plant marker ABSENT, `git hash-object` == `HEAD:…` == `06d562c2e730f2d6bc9b8b5e1cabeb8835d23fb5`.
Then `node scripts/check-assertion-gaps.mjs` → clean, `GREEN_EXIT=0`.
*(Transparency: a first combined hash check in the same command printed `False` because of a
`git hash-object --path=` invocation quirk; the explicit re-check above matched byte-for-byte.)*

### Tests added (`scripts/check-assertion-gaps.test.mjs`, 25 → 30)

200→
- `T-17 always-true: an \`||\`/\`&&\`/ternary construct that cannot fail is flagged` (11 shapes)
- `T-17 always-true: a falsifiable disjunction, nullish, or ternary is never flagged` (7 shapes)
- `T-17 always-true: assert.equal(<always-true>, true) is flagged, a real comparison is not`
- `T-17 always-true: assert.ok(true) stays a single true-literal finding (no double-count)`
- `T-17 CLI: an assert.ok(<expr> || true) plant trips the run (RED-first)`

---

## G2 — coverage-guard ratchet honesty

### Audit (19 entries)

All 19 allowlist entries are **currently genuine gaps** — `node scripts/check-module-coverage.mjs`
prints exactly the 19 keys, so **0 stale entries at HEAD**. But the guard could not *detect* a
stale entry (only "the module exists" + "reason length > 20" were pinned), which is the hole the
parent noted in `fixes/332_0_parent.md` §3.4.

Per-entry disposition (verified against the tree today):

| entry | verdict | evidence |
|---|---|---|
| 14 × `src/lib/auth/*` | **justified** (live surface, no test) | messages are surface-naming; generic tail was W45-stale → reworded |
| `src/lib/error-component.tsx` | **justified** | imported by `src/routes/__root.tsx:4` + `src/router.tsx:2` (no test reaches routes; no render harness) |
| `src/lib/multiplayer/p2p.ts` | **justified, dormant by design** | own HONESTY header says nothing imports it; no `/api/rtc` relay ships |
| `src/lib/multiplayer/index.ts` | **unjustified as-is** | barrel for the dormant client; **zero importers** anywhere |
| `src/lib/app-data/index.ts` | **reason was WRONG** | old reason said "server-only app-data barrel"; `index.ts` is the *client-safe* barrel (re-exports types/login), the server-only halves (`client.server.ts`, `server-only.ts`) are separate and ARE covered. **Zero importers** of the barrel |
| `src/lib/db.ts` | **reason was WRONG** | old reason "reached only through the build/migrate path"; **no import statement anywhere** references `@/lib/db` — only prose in `scripts/migrate.mjs:13`, `scripts/migration-plan.mjs:4,132,198`, `src/lib/auth/middleware.ts:11` (all comments) |

**Reported, not actioned** (modules are not mine): `db.ts`, `app-data/index.ts` and
`multiplayer/index.ts` have **zero importers** in the tracked tree — they are dead exports, not
merely untested surfaces; the honest disposition is *delete or wire*, not allowlist. `p2p.ts` and
`error-component.tsx` are real surfaces that genuinely lack a test.

### What shipped

- **`staleAllowlistEntries(gaps, allowlist)`** — returns entries whose module IS reached now.
  `main()` prints them as `STALE allowlist entry — this module is reached by a test now; delete
  the entry`, adds `stale` to `--json`, appends it to the summary line, and **exits 1** when any
  exist. The allowlist can now only shrink by adding a real test — never linger as a silent
  exemption. (The existing orphan → exit-1 behaviour is unchanged.)
- Reworded the generic tail `UNCOVERED_NO_OWNER` (was "no lane in the **W45** table owns this
  surface — recorded for the next wave") to name the current wave and the action owed, and rewrote
  the three inaccurate/vague reasons above.

### Planted-teeth proofs

**Stale entry (guard vs a covered module).** Temporarily added
`"src/lib/fixtures.ts": "plant"` to `COVERAGE_ALLOWLIST`:

```
=== RED ===
src/lib/fixtures.ts: [module-coverage] STALE allowlist entry — this module is reached by a test now; delete the entry
[module-coverage] 103/122 … · 19 allowlisted · 0 unallowlisted gap(s) · 1 stale allowlist entry
RED_EXIT=1
```

Reverted the line → `19 allowlisted · 0 unallowlisted gap(s) · 0 stale allowlist entries`, exit 0.

**Genuinely orphaned module (guard must still fail).** Out-of-repo harness
`%TEMP%\rt334_6\probe_orphan.mjs` builds a temp `src/lib` with `orphan.ts` (no importer) plus a
directly- and a transitively-imported module:

```
total=3 covered=2 gaps=["src/lib/orphan.ts"]
allowlisted=[] unallowlisted=["src/lib/orphan.ts"]
guard would exit 1 on the planted orphan
```

(The temp tree also reports the 19 *live* entries as "stale relative to itself" — expected and
not the signal; `unallowlisted` non-empty is the orphan firing.)

### Tests added (`scripts/check-module-coverage.test.mjs`, 6 → 7)

- `module-coverage: a stale allowlist entry (module now reached) fails the guard` — unit
  (`staleAllowlistEntries`) + live-repo assertion that today's allowlist has **0** stale entries.

### Typecheck note (caught and fixed by this lane)

My first test version passed an explicit allowlist object to `staleAllowlistEntries`; the scripts
typecheck ratchet flagged **2 × TS2345** in `scripts/check-module-coverage.test.mjs:125-126`
(the object not assignable to the inferred literal type of `COVERAGE_ALLOWLIST`). Fixed by
JSDoc-typing both `partitionGaps` and `staleAllowlistEntries` params as
`@param {Record<string, string>} [allowlist]`. Ratchet back to **6/6** (Node 22). I did **not**
touch the budget (334-4 owns it; its counts moved concurrently).

---

## G3 — `.t4scratch/` deletion proposal (evidence; nothing deleted)

### What it is

**192 tracked files under `.t4scratch/lib/**`, 4,345,663 bytes (~4.3 MB)** — a copy of
`src/lib/**`. Origin: lane T4's in-repo scratch for mutation/teeth proofs
(`finalsprint.md:124,188,195` records `cp src/lib/engine.ts .t4scratch/lib/engine.ts`).

### Provenance (`git`)

- Added in **exactly one commit**: `2fa3cd9` — *2026-09-27 00:56:08 -0500, "W29-W39: the
  completion era — spine real, gates registered green"*; `git log -- .t4scratch` count = **1**,
  never modified since.
- `README.md:369` claims it was "tracked at `ac6b151`", but `ac6b151` is a W41 commit that does
  **not** touch `.t4scratch` — README provenance is wrong (minor doc drift).

### Reference scan (zero live readers)

`grep t4scratch` over the repo → 44 hits, **all documentation/lane logs/wave plans**, plus
`fixes/297_r1_counts.sh:7` (a historical directory-census loop) and the `README.md` census rows.
No reference in `src/**`, `package.json`, `gate.sh`, CI, or any test. Both guards and `node --test`
skip dot-directories, so nothing executes against it.

### Drift (it is a frozen snapshot, not a mirror)

- 192/192 scratch files have a counterpart in `src/lib` (**0** missing in `src`).
- **87 byte-identical · 105 DRIFTED (55%)**.
- The drift is not cosmetic: the scratch copies still carry the **pre-fix** `|| true` tautologies
  the parent removed from `src/lib` — `.t4scratch/lib/codegen.server.test.ts:499` and
  `.t4scratch/lib/node-runner.server.test.ts:92`. That proves the tree is an ancestor snapshot.
- 222 current `src/lib` files have no scratch copy at all.

### Live-reader nuance

The tree is not wholly inert as a gate input: `npx eslint .t4scratch/lib/engine.ts -f json` → 1
result / 0 messages (eslint *will* lint it when targeted), and `fixes/275` §33 records
`npm run lint` returning **rc=1** solely from `.t4scratch/lib/engine.ts` during W29. Removing it
shrinks the lint surface.

### Proposal (parent signs off — owner decision)

1. `git rm -r .t4scratch` in one commit (192 files, ~4.3 MB); the removal is fully recoverable
   from `2fa3cd9`.
2. **Applied now, within ownership:** added `.t4scratch/` to `.gitignore` (probes section, with a
   dated pointer here) so the directory cannot be re-tracked after removal.
3. **I deleted nothing.** The repo rule (untracked + zero-references + no live lane log + parent
   sign-off) is honoured: the deletion is proposed, not performed.

---

## G4 — `.grok/` documentation truth (report only; `AGENTS.md` not edited)

### Live read paths measured today (register `R15-f08`, re-derived)

| path | reader | status |
|---|---|---|
| `.grok/app-env.json` | `scripts/with-app-env.mjs:34` (`APP_ENV_REL_PATH`) — read on **every** `npm run dev/build/preview` | **LOAD-BEARING** (content today: `{"VITE_AUTH_ENABLED":"false","deploy":{"database":false}}`) |
| `.grok/skills/og/SKILL.md` | `scripts/brand-check.mjs:91` | **LOAD-BEARING** (tested at `brand-check.test.mjs:324,337,374`) |
| `.grok/og-pending` | `scripts/brand-check.mjs:44` (`OG_PENDING_REL_PATH`) | **LOAD-BEARING** (write path) |
| `.grok/preview.pid`, `.grok/preview.log` | `scripts/preview.mjs:33-34` | **STATE** (read/write) |
| `.grok/status` | none (writer-less) | **STALE LIAR** — `{"status":"READY","message":"workspace-server running","timestamp":"2026-09-04T10:58:21Z"}`; `git grep "grok/status"` = 0 code hits (docs only) |
| 18 × `.grok/skills/*`, 6 × `.grok/references/*` | no code reads (source comments only) | agent-doc pointers |

Register drift: R15-f08's line numbers have moved (it cited `with-app-env.mjs:28`,
`brand-check.mjs:41,88`, `preview.mjs:30-31`), the skills count has grown **16 → 18**, and both
`fixes/273_t2_r15.md:22` and `finalsprint.md:344` claim *"R15-f08 LANDED (AGENTS.md live-reads
correction)"* — but **no correction is in `AGENTS.md` bytes** (see below).

### Current `AGENTS.md:120-124` (unchanged, blanket claim)

```
## Legacy scaffolding — do not build on it

`.grok/`, `server/` middleware, `scripts/grok-pwa-*`, `AGENTS.project.md`, and `startup.sh`
are stale scaffolding from the repo's origin. They are **not the contract** (ignore them
unless a named doc above points at them). Their keep-or-descope fate is decided in
94 §B1 / 96. Do not delete or extend them until that lands.
```

### Exact correction `AGENTS.md` needs (owner applies; not my file)

Replace the sentence at `AGENTS.md:122-124` with:

```
Most of `.grok/` (18 `skills/*`, 6 `references/*`, and the writer-less stale `.grok/status`)
plus `server/` middleware, `scripts/grok-pwa-*`, `AGENTS.project.md`, and `startup.sh` are
stale scaffolding from the repo's origin. But `.grok/` is **partially load-bearing — do not
delete these reads:** `scripts/with-app-env.mjs:34` reads `.grok/app-env.json` on every
`npm run dev/build/preview` (it ships `VITE_AUTH_ENABLED=false`); `scripts/brand-check.mjs:91`
reads `.grok/skills/og/SKILL.md` and `:44` writes `.grok/og-pending`; `scripts/preview.mjs:33-34`
uses `.grok/preview.{pid,log}`. Their keep-or-descope fate is decided in 94 §B1 / 96; do not
delete or extend until that lands.
```

`.grok/status` is also an honesty wart (a writer-less "READY — workspace-server running" from
2026-09-04) — delete or gitignore it, per R15-f08's own fix list. I did **not** edit `AGENTS.md`.

---

## Tests added / real results (both runtimes)

| file | before | after | Node 22 | Node 24 |
|---|---|---|---|---|
| `scripts/check-assertion-gaps.test.mjs` | 25 | **30** | 30/30/0 | 30/30/0 |
| `scripts/check-module-coverage.test.mjs` | 6 | **7** | 7/7/0 | 7/7/0 |

Other measured results:

- `node scripts/check-assertion-gaps.mjs` → clean, 124 files, 0 findings, **exit 0**.
- `node scripts/check-module-coverage.mjs` → 103/122 reached · 19 allowlisted · 0 unallowlisted ·
  **0 stale**, **exit 0**.
- `node --test --test-reporter=tap scripts/typecheck-scripts.test.mjs` (Node 22) → **6/6**.
- `npx eslint` on all four owned `.mjs` files → **exit 0**.
- Diff is exactly the five owned paths: `.gitignore`, `scripts/check-assertion-gaps.mjs` (+test),
  `scripts/check-module-coverage.mjs` (+test).

## What I stopped on / did NOT do, and why

- **Did not edit `AGENTS.md`** (334-6 does not own it) — exact replacement text reported in G4.
- **Did not delete `.t4scratch/`** — proposal only; the parent signs off (G3). Added the
  `.gitignore` guard so removal is durable.
- **Did not fix the three dead modules** (`db.ts`, `app-data/index.ts`, `multiplayer/index.ts`) —
  not owned; reported with evidence.
- **Did not run the full gate**, `npm run eval`, or any keyed call — five siblings are mid-edit
  (`console.tsx`, `codegen.server.ts`, the `scripts/**` debt list all show `M`).
- **Did not touch the typecheck budget / the 14 budgeted `scripts/**` files** (334-4's). I ran the
  ratchet only to prove my own new test is type-clean.
- **No probe file left in the repo:** the two repo plants (`assert.ok(1 || true)` in the coverage
  test; the `fixtures.ts` allowlist entry) were reverted and the reverted file proven byte-identical
  to `HEAD` (`git hash-object` match, `git status --porcelain` empty, marker absent).

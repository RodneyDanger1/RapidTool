# 358 · lane `close-taxonomy` — the registry/exit-code contract (R-9), the owed `RT_E_RATCHET_METRIC_UNAVAILABLE`, and the two missing kind-surface pins (R-11)

**Wave:** W358 (closure). **Lane:** `close-taxonomy` (persona `ledger`). **Repo:**
`C:\Users\mnril\Desktop\RapidTool Main` (path contains a space). **Host:** Node v24.15.0, Windows
PowerShell 5.1. **Tree:** dirty (no commit since HEAD `30bce78`); three sibling lanes
(`close-kindjsx`, `close-ui`, `cartographer`) were editing other files throughout — the one transient
red this caused is attributed **by file** in §6. **Plan:** `wave_plans/W358/close-taxonomy.md`.
**Append-only; this lane is its only writer.**

**Owned files:** `scripts/README-cli.md` · `scripts/cli-exit-taxonomy.test.mjs` ·
`scripts/quality-ratchet.floors.json` · `scripts/quality-ratchet.mjs` · `scripts/quality-ratchet.test.mjs` ·
`src/lib/errors.ts`. **`scripts/rapidtool-cli.mjs` was NOT edited** — see §1.4. No other file was touched;
`src/lib/codegen.server.ts`, `src/lib/compile-check.server.ts`, `src/lib/scaffold.ts` and
`src/components/software-preview.tsx` were never opened for write.

**Headline:** the boundary's only scripts-leg red (`exit taxonomy — EXIT_BY_CODE is exactly the README
error table (both directions)`) is **GREEN on the frozen bytes** — **62 tests · 62 pass · 0 fail**. The
owed registry code is **landed and verified**. The two unpinned surface legs now have pins that fail when
planted. The lint floor reading is re-pinned 947 → **5** with the bar still **0**.

---

## 1. JOB 1 · R-9 — the exit-class contract for a code with no CLI arm

### 1.1 The defect (reproduced at the start of this lane)

The W357 boundary (`%TEMP%\rt-campaign\w357-boundary-gate.log`) read
`testsScripts {"ok":false,"exit":1,"pass":658,"fail":1}` with the single hard fail
`exit taxonomy — EXIT_BY_CODE is exactly the README error table (both directions)`. `fix-preview` grew
`scripts/README-cli.md`'s registry table **35 → 56 rows** to mirror `ERROR_CODE_DOC` (its own log row 12),
and `scripts/cli-exit-taxonomy.test.mjs`'s **test-local** `EXIT_BY_CODE` map still carried 35 keys — so 21
table codes had no mapping. The table *was* genuinely incomplete; the map was the un-updated side.

### 1.2 THE CONTRACT I CHOSE (stated as the test states it)

**A code with no CLI arm has no exit class.** The README's `typical exit_code` cell *is* the class, and
the parity test now **derives** `EXIT_BY_CODE` from those cells instead of keeping a second, hand-kept
list beside them. Two classes, mutually exclusive in both directions:

| the README cell | the class | `EXIT_BY_CODE` must carry |
|---|---|---|
| a number (`1`), a range (`1–4`), an alternation (`1 or 4`) | the code **reaches a CLI envelope** and exits that class | exactly that class (`[1,2,3,4]` for a range, `[1,4]` for an alternation) |
| `—` / `-` (e.g. `— (guard \`expectedCode\`; \`scripts/guards/*\`)`) | **NO CLI ARM** — produced inside `src/lib`/`scripts`, never rides a CLI envelope | `null` — **and the cell must assert no exit** |

The assertion, quoted from the test (the drift direction that resolves R-9):

```js
  const documented = documentedExitByCode();
  const classDrift = mapped
    .filter((c) => JSON.stringify(EXIT_BY_CODE[c] ?? null) !== JSON.stringify(documented[c] ?? null))
    .map(
      (c) =>
        `${c}: README-cli.md documents ${JSON.stringify(documented[c] ?? null)}, EXIT_BY_CODE says ` +
        `${JSON.stringify(EXIT_BY_CODE[c] ?? null)} — \`null\` is the "no CLI arm" class and a number is an asserted ` +
        `exit class; the two must not disagree`,
    );
  assert.deepEqual(
    classDrift,
    [],
    `the exit class drifted from the doc's own \`typical exit_code\` cell:\n  ${classDrift.join("\n  ")}`,
  );
```

and the class derivation itself (what "no CLI arm" *is*, mechanically):

```js
  if (single) return Number(single[1]);
  if (/^[—-]/.test(cell)) return null; // the documented "no CLI arm / never fails the CLI" class
  return undefined;                    // unreadable → must be declared, not tolerated
```

This is **stronger** than the pre-fix leg, not weaker: before, a code could sit in the table with a
nonsense cell and the map could say anything at all as long as the *name* sets matched. Now each cell's
own words are compared to the map, and an unreadable cell is a named failure of its own.

### 1.3 What changed on each side

- **`EXIT_BY_CODE`: 35 → 57 keys** (additive; every existing key untouched). 21 codes carry the class the
  table already documented, and the one new registry code (§2) carries `null`. The four codes that DO
  reach a CLI envelope carry **the table's own wording, quoted in the map** — nothing invented:
  `RT_E_PATH_KIND_MISMATCH: [1,2,3,4]` ("1–4 (classified in place — EISDIR/ENOTDIR)"),
  `RT_E_SUBSTANCE_EMPTY: 1`, `RT_E_PLAN_UNDERPRODUCED: 1`, `RT_E_SRC_EDITED_DURING_RUN: 1`
  (`emit --run --git` substance hold / the below-floor refusal + floor seal / the RUNLOCK refusal).
  The other **17 are `null`** (guard `expectedCode`, engine/`dod` domain, tree-run legs) — the table
  asserts no exit for them and neither does the map. **No README row was deleted and no exit code was
  invented.**
- **`scripts/README-cli.md`** — the row for the newly registered code (§2) and a rewritten re-derivation
  note (56 → **57** codes) that states the contract in the doc itself, so a reader can see what `—` means
  and that the guard derives the mapping from these cells.
- **`scripts/cli-exit-taxonomy.test.mjs`** — the leg above, plus two additions: (a) the table's parse must
  find a **duplicate-free** row set (`table.length === rows.length`), and (b) **the table and the
  canonical registry are the same set** (`ERROR_CODE_DOC` ⊇ table and table ⊇ `ERROR_CODE_DOC`). (b) is
  the pin whose absence let a 35-row table sit against a 56-code registry unnoticed; it is the reason the
  new code's README row is mandatory rather than optional. The `RT_E_BUDGET_EXHAUSTED` exit-1 row
  assertion, the four leg-1 `errCode` checks, leg 4's literal scan and the vacuity floor are all
  **unchanged**.

### 1.4 The one file I was scoped to but did not need

`scripts/rapidtool-cli.mjs` holds **no** `EXIT_BY_CODE` table — the mapping is test-local:
`Select-String -Path scripts/rapidtool-cli.mjs -Pattern 'EXIT_BY_CODE'` → **0 hits**. So no CLI byte was
changed, and leg 1's `errCode`-site scan is exercised against the same 27+ sites as before. (Checked that
none of the 21 codes sits at an `errCode(...)` site: the CLI carries `RT_E_SRC_EDITED_DURING_RUN`,
`RT_E_PLAN_UNDERPRODUCED` and `RT_E_SUBSTANCE_EMPTY` only as `code: "…"` envelope fields, never as an
`errCode(err, "…")` call.)

---

## 2. JOB 2 · the owed code — `RT_E_RATCHET_METRIC_UNAVAILABLE` is REGISTERED

### 2.1 The exact bytes landed (both halves, verbatim from `fixes/357_fix_gates.md` §5)

`src/lib/errors.ts` — `ERROR_CODES`, appended after `"RT_E_VALIDATION",`:

```ts
  // W358 lane `close-taxonomy` (fixes/358_close_taxonomy.md): the quality ratchet's
  // OWN cause — a pinned floor whose producer ran but produced no usable reading
  // (a reader's shape changed under a live producer, or the reading cannot be
  // formed at all). Armed by W356 lane `ratchet` and left documented in
  // fixes/357_fix_gates.md §5; landed here because W357 owned no `src/**` file.
  "RT_E_RATCHET_METRIC_UNAVAILABLE",
```

`src/lib/errors.ts` — `ERROR_CODE_DOC`, mirroring `RT_E_VALIDATION`:

```ts
  RT_E_RATCHET_METRIC_UNAVAILABLE: {
    meaning: "A pinned quality-ratchet floor could not be measured — the producer ran but produced no usable reading.",
    agentAction:
      "Re-run the named producer and read its output; if the artifact is genuinely absent say so with RT_E_PROJECT_MISSING, and if a reader's shape changed fix the reader instead of the floor.",
  },
```

plus its row in `scripts/README-cli.md`'s registry table (`meaning`/`agentAction` copied from the
canonical registry; the cell is `— (measurement domain, \`scripts/quality-ratchet.mjs\`; **no CLI arm**)`),
which §1.3(b) now forces.

### 2.2 `floors.json#owedCodes` reconciled — the debt is PAID, and the payment is VERIFIED

The entry no longer says "owed". It records `status: "registered"`, who landed it, and that `owedEdit` is
**APPLIED**, with the residual stated: the ratchet still classifies its unavailable readings **by cause**
through the three long-standing codes, so this code has **no emitter site yet** — adopting it for the
"producer ran, no usable reading" site changes which causes hard-fail and is the boundary owner's call,
not a silent edit here.

`canary.errorCodes.owed-code-not-emitted` now checks **both** directions, so the record can neither lie
nor go vacuous:

- (a) a code still recorded as **owed** is never **emitted** before the register carries it (unchanged,
  fail closed);
- (b) a code whose debt is recorded as **paid** (`status:"registered"`) really **is** in `ERROR_CODES` —
  the recorded payment is verified against the register, never claimed.

Readings (real run, `--all`):

| | before | after |
|---|---|---|
| `canary.errorCodes.owed-code-not-emitted` | `ok=true {owed:["RT_E_RATCHET_METRIC_UNAVAILABLE"], emittedBeforeRegistration:[], paid:[], registered:56}` | `ok=true {owed:["RT_E_RATCHET_METRIC_UNAVAILABLE"], unpaid:[], emittedBeforeRegistration:[], paid:[], paidButUnregistered:[], registered:57}` |
| `canary.errorCodes.registered` | `ok=true {codes:56}` | `ok=true {codes:57}` |

A third selftest tooth was added for direction (b) — `canary.errorCodes.registered-debt-is-verified`
(a debt recorded as paid whose code is absent from the register **fails**), and the two existing teeth
were re-planted against a synthetic `status:"owed"` entry so they still prove direction (a) without
editing the real record. `scripts/quality-ratchet.test.mjs`'s owed-code test was rewritten from "the debt
is armed and unregistered" to "the debt is declared, **registered**, and not emitted", per its own
pre-fix message ("if it IS [registered], the owed edit has landed and the pin must be re-read").
`errors.test.ts` (lib leg) → **44/44 pass**: `ERROR_CODES` and `ERROR_CODE_DOC` still agree exactly at 57.

---

## 3. JOB 3 · R-11 — the two surface legs are pinned, and each fails when planted

`kindFit.game.surfaceOk` (0 of 1) and `kindFit.library.surfaceOk` (0 of 1) had **no pin at all**: the
only leg that actually fails for those kinds was prose in the `.fit` pins' `reason`, while the three
legs that pass (all 1 of 1) were pinned. Two pins were added (both

`"direction": "atLeast", "floor": 0, "status": "enforced", "reading": 0, "readingPinned": true`) with a
`nonRegressible` accounting whose honest content is: the reading sits at its **structural minimum** (the
only game/library unit on disk is a **mis-stamp** — cartographer §3.1B: `testruns/bakery-website/emitted`
stamped `game`, `testruns/mobile-companion/emitted` stamped `library`), so no regression can move the
count **down** and the honest bar (1) cannot be pinned without turning a red tree redder; it becomes a
regressible floor the day a properly-stamped unit exists (cartographer §3.4 item 2) and the boundary
owner must re-pin it then. The `.fit` pins' `reason` strings were updated so they no longer claim the leg
is unpinned.

**Planted proofs** (`%TEMP%\rt358_plants.mjs`, in-memory against the REAL floors file; quoted verbatim):

```
kindFit.game.surfaceOk: floor=0 status=enforced planted=-1 -> ok=false regressions=["kindFit.game.surfaceOk (atLeast floor 0, measured -1)"]
kindFit.library.surfaceOk: floor=0 status=enforced planted=-1 -> ok=false regressions=["kindFit.library.surfaceOk (atLeast floor 0, measured -1)"]
kindFit.game.surfaceOk: -> ok=false unavailableEnforced=["kindFit.game.surfaceOk (RT_E_PROJECT_MISSING): no emitted artifact for a game-kind brief"]
kindFit.library.surfaceOk: -> ok=false unavailableEnforced=["kindFit.library.surfaceOk (RT_E_PROJECT_MISSING): no emitted artifact for a game-kind brief"]
```

The second pair is the **real** failure mode this pin buys: because the pin is `enforced`, the leg stops
being silent when its reading disappears entirely (an `unavailable` `RT_E_PROJECT_MISSING` reading is a
HARD failure) — which is what R-11 said only `entryOk ≥ 1` / `units ≥ 1` (neither of which measures the
surface) could catch.

Ledger movement: `--all` **metrics 48 → 50**, `--selftest` **teeth 31 → 32**, **enforced floors beaten
35/35 → 37/37**, and `canary.floors.atleast-zero-pins-are-accounted` now reads
`{zeroPins:[productQuality.qualityCount, acceptance.passCount, kindFit.app.fit, kindFit.game.fit,
kindFit.game.surfaceOk, kindFit.library.fit, kindFit.library.surfaceOk], accounted:7, unaccounted:[]}`.
Both are covered by the existing "A PLANTED REGRESSION ON EVERY ENFORCED FLOOR IS A NAMED HARD FAILURE"
leg and by the new named test; **no floor was lowered** (both are new, both pinned at the measured 0).

---

## 4. JOB 4 · `lint.problems` re-pinned honestly — reading 947 → 5, bar still 0

The floor is unchanged (`atMost`, **floor 0**, `pending-first-green`); only the recorded **reading** and
its reason moved. Live re-measurement at this lane's edits: `npm run lint` → **`✖ 5 problems (0 errors,
5 warnings)`, exit 0**, and the 5 are exactly the two files the reason names —
`scripts/quality-ratchet.mjs` (2 × `no-unused-vars`) and `scripts/quality-ratchet.test.mjs` (3). The
947 → 5 move is `fix-lint`'s `testruns/**` ignore (0 tracked files; generated run output, not this repo's
source) plus the wave's source fixes; **my own edits add zero warnings** — the one I introduced (an
unused helper) was removed, and lint is back at exactly 5.

Planted (in-memory, against the real floors file):

```
as pinned, reading 5 -> ratchet.ok = true | metric = "pending" | pending = ["lint.problems (BELOW THE HONEST BAR today)"]
flipped to enforced, reading 5 -> ratchet.ok = false | regressions = ["lint.problems (atMost floor 0, measured 5)"]
flipped to enforced, reading 1 -> ratchet.ok = false | regressions = ["lint.problems (atMost floor 0, measured 1)"]
flipped to enforced, reading 0 -> ratchet.ok = true  | regressions = []
```

**Stated honestly, because the distinction matters:** the metric can **never read as a pass** while
`lint.problems > 0` — it reads `pending` with the `(BELOW THE HONEST BAR today)` marker, and the floor
stays 0. But the ratchet's **overall** `ok` is *not* moved by a `pending-first-green` pin (that is the
floors file's own policy: such a pin is REPORTED, never enforced, until the boundary owner flips it on a
green tree). So "the ratchet cannot pass with lint.problems > 0" is true **at the metric level and only
after the owner flips the status**; I did **not** flip it — the tree is still red (the lib leg carries
residuals) and re-pinning a floor's *status* is the boundary owner's call, not a lane edit that reddens
the parent's gate. The plant above shows the flip would hard-fail, named, at 5 and at 1, and pass at 0.

Also verified: `lint.problems` cannot read `unavailable`-as-green — inside the gate it is read from the
gate's own `lint.log` (`problems: 5`), and standalone it reports
`unavailable (RT_E_RUNNER_UNAVAILABLE)` (a missing input), never a pass.

---

## 5. Verification (exact commands, readings on the bytes as they now stand)

| command | result |
|---|---|
| `node --test --test-reporter=tap scripts/cli-exit-taxonomy.test.mjs` | **62 tests · 62 pass · 0 fail** (final run, 251.8 s) |
| `node --test --test-reporter=tap scripts/quality-ratchet.test.mjs` | **36 tests · 36 pass · 0 fail** |
| `node scripts/quality-ratchet.mjs --all` | `ok:true` · **50 metrics** · 22 canaries · `regressions:[]` · `canaryFailures:[]` · `unavailableEnforced:[]` |
| `node scripts/quality-ratchet.mjs --selftest` | `ok:true` · **32 teeth** · **37/37** enforced floors beaten → all caught · `selftestOk:true` |
| `npx tsc --noEmit` | **exit 0** |
| `npm run lint` | **exit 0** · `✖ 5 problems (0 errors, 5 warnings)` — back to the re-pinned reading |
| `node --test scripts/README-cli.test.mjs` | **12 pass / 0 fail** |
| `node --test scripts/typecheck-scripts.test.mjs` | **7 pass / 0 fail** (the measurement layer is still un-budgeted and typechecks) |
| `node --experimental-strip-types --test src/lib/errors.test.ts` | **44 pass / 0 fail** (registry ↔ doc agree at 57) |

**Not run, by instruction:** the full `bash scripts/gate.sh` (the parent owns the boundary), any keyed LLM
call, any git write. Probes live in `%TEMP%` only (`rt358_readme_table.mjs`, `rt358_registry_probe.mjs`,
`rt358_reads_verdicts.mjs`, `rt358_plants.mjs`, `rt358_lint_plant.mjs`); no probe file is in the repo.

---

## 6. Transient reds, attributed by file (and re-run before believing)

My **baseline** run of `scripts/cli-exit-taxonomy.test.mjs` read **62 tests · 59 pass · 3 fail**: the R-9
leg (real, this lane's) plus

- `not ok 40 - … a fresh tree is now VERIFIED …` at `scripts/cli-exit-taxonomy.test.mjs:2758` — the
  envelope came back `RT_E_SRC_EDITED_DURING_RUN` naming **`src/lib/compile-check.server.ts`**;
- `not ok 44 - 341-6 - a SINGLE keyless \`unattended\` …` at `:3027` — `+ 'RT_E_SRC_EDITED_DURING_RUN'
  - 'RT_E_GATES_FAILED'`.

Both are the CLI's **in-run RUNLOCK guard correctly refusing while a sibling lane (`close-kindjsx`) was
editing `src/lib/compile-check.server.ts` mid-run** — the same concurrency class the W357 cartographer
recorded for `factory-watch.test.mjs` (§5.7). Both are green on every re-run (62/62 twice, including the
final frozen run), and **no byte of mine is involved**: the files I wrote are `scripts/**` docs/tests,
`src/lib/errors.ts`, and the ratchet/floors pair.

---

## 7. Honest limits / unverified

1. **The registered code has no emitter site yet.** The ratchet classifies `unavailable` readings by
   CAUSE through `RT_E_RUNNER_UNAVAILABLE` / `RT_E_PROJECT_MISSING` / `RT_E_VALIDATION` (the W356
   decision). Registering the code makes the vocabulary complete and the debt paid; **adopting** it for
   the "producer ran, produced no usable reading" site (e.g. `tree.tscPassSample` when `treeRun` resolves
   no declared typecheck, `quality-ratchet.mjs:1425`) would change which causes hard-fail, so it is
   recorded as the owner's follow-up rather than done here. `canary.errorCodes.registered` therefore
   still guards exactly the three emitted codes.
2. **The two new pins are structurally non-regressible at their current reading**, which is disclosed in
   their `nonRegressible` text rather than presented as teeth: a *decrease* cannot move a count already
   at 0 of 1. What they add is enforcement (a hard failure the moment the reading cannot be produced) and
   a pin the owner must re-pin at the honest bar once the corpus carries a properly-stamped game/library
   unit. This is the same disposition `acceptance.passCount` carries, and it is the honest half of R-11
   that a corpus re-stamp has to finish.
3. **`lint.problems` is reported, not enforced** (see §4) — the metric can never read as a pass, but the
   ratchet's overall verdict does not move while the pin is `pending-first-green`.
4. **`RT_E_PATH_KIND_MISMATCH`'s range comes from the doc, not from a CLI invocation**: the table says
   `1–4 (classified in place — EISDIR/ENOTDIR)` and the map now says `[1,2,3,4]`. Same for
   `RT_E_SUBSTANCE_EMPTY` / `RT_E_PLAN_UNDERPRODUCED` / `RT_E_SRC_EDITED_DURING_RUN` (`1`): these four
   codes appear in the CLI only as **envelope `code:` fields** on the `emit`/`run`/`tree-run` arms, never
   at an `errCode(...)` site, so leg 1 does not independently re-derive their exit — the mapping is the
   doc's, and the doc's cell is what the new derivation assertion pins. If a future wave routes one of
   them through `errCode`, leg 1 checks the site against this class immediately.
5. **No whole-leg verdict.** I did not run the full gate or the whole scripts/lib legs, so the boundary is
   still the first frozen measurement of the leg; what this lane froze is the single red it was sent to
   clear, plus its own two suites.

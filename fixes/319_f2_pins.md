# 319 · F2 FIXER — pin log (T8.2 seat-refusal taxonomy leg + T6.2(c) no-mint⇒P6-red walk)

Lane: F2 (FIXER 2), W44 Phase-2 heavy team. Repo: `C:\Users\mnril\Desktop\RapidTool Main`
HEAD at start: `a3ebcdf` (on `cdf2510`). Boundary green of record: `gate.sh ok:true`, scripts leg 357/357.
Box (only writable): `scripts/cli-exit-taxonomy.test.mjs` · `src/lib/wild-seal.test.ts` · `src/lib/wild-step.test.ts` · `fixes/319_f2_pins.md`

## Status

- [x] **Phase A — COMPLETE + DRY-RUN-VALIDATED**: both pins fully designed, literal code written below, insertion points re-read at plan time, behavior PRE-CAPTURED from real keyless probes, and BOTH exact pin bodies dry-run green OUTSIDE the repo (probes + dry-runs live at `C:/Users/mnril/f2_scratch/`):
  - `node --experimental-strip-types --test C:/Users/mnril/f2_scratch/f2_pin_dryrun_p6.test.ts` → **2/2 pass, 0 fail** (the banked P6 code, imports adapted).
  - `node --test C:/Users/mnril/f2_scratch/f2_pin_dryrun_seat.test.mjs` → **1/1 pass, 0 fail** (10.6s; the banked seat code, CLI_PATH adapted).
- [ ] **Phase B — pending GO marker** (`C:/Users/mnril/w44_trial/fix_go.md`). Apply = 2 additive edits + scoped runs + record.

**Design headline: ZERO production-code changes.** Both pins are pure test additions against mechanisms already on disk (guards landed `f270b38`/`54c6649`/`71154b1`). No engine.ts / codegen.server.ts / CLI edit required → no boundary risk from behavior change; the pin itself can only go red if the guarded behavior drifts.

## Evidence index (bytes read at plan time)

| Artifact | What was read |
|---|---|
| `scripts/cli-exit-taxonomy.test.mjs` (689 lines) | header leg-list style :1-57; leg 5 spawn harness :274-315; legs 10/11 (mkdtemp+scrub+no-stack idiom) :577-688 |
| `scripts/rapidtool-cli.mjs` (4107 lines) | seat guard bytes :923-1073 (bare/mutual-exclusion/bogus-seat refusal envelopes; `--seat autopilot` machine branch; `hitl.approve` policy consult :1048) |
| `src/lib/policy.ts` | `hitl.approve` rule :127-128 `requiresHumanSeat: false` (autopilot allowed BY DESIGN); `hitl.force` :131-132 requires human |
| `fixes/316_h7_survive.md` | T8.2 canon: guard landed, taxonomy pin named OWED (:91 sweep note; §ADDENDUM conventions) |
| `fixes/317_j2_preflight.md` | §3b no-mint CASE-A/B/C observation w/ live keyless probe (:115-125); §3c the K1 door: bare approve non-TTY refusal bytes + `--seat autopilot` exit 0 (:127-135); §6 re-verify at cdf2510 (:226-238) |
| `wave_plans/W43/COMPLETION-TASKS.md` | T8.2 row :91 ("named taxonomy pin for the seat refusal is still OWED"); T6.2(c) row :77 ("no-mint P6-red walk remains OWED"); TOP-BLOCK condition 3(c) :16 |
| `src/lib/codegen.server.ts` | `mintTreeRunTested` :3755-3811 (skipped-row branch :3778-3794; mint branch :3796-3810); `treeRunTestedEvidence` :3728-3753 |
| `src/lib/dod.ts` | `p6-verified` probe :600-620 (needs `label==="tested"` + non-empty `evidenceHash`); p6 criteria set :573-667 (`p6-test` :573, `p6-source` :582, `p6-artifact` :587, `p6-brief-fit` :627) |
| `src/lib/engine.ts` | leave check `wildLeavePhase` :4486-4505 (`wild.paused_dod` + `RT_E_GATE_PENDING` + `P${phase} DoD unmet — hard gate blocks advance: <ids>`); gate-approval post-check :4408-4427; `wildExecEdgeFor` P6/P7 :4584+; `applyPhaseResult` exported :1405; `emptyProject` :1874 |
| `src/lib/wild-step.test.ts` (871 lines) | `p6WildFixture` :232-251 + W-01 P6 seam pins :253-361; `wildFixture` :16-41; P7 enforceDod precedent :464-494 + §316 H1 :519-661 + §316 H3 repair :749-871 |
| `src/lib/wild-seal.test.ts` (310 lines) | §S1-§S5 harness (emptyProject/wildStep/runGate idiom) — inspected, NOT chosen as home (see [FOR-PARENT]) |
| `src/lib/compile-check.server.ts` | `TreeRunOutcome` :380-438, `TreeSpecVerdict` :301-315, `CompileCheckResult` :49-60 (import types for the pin) |
| `src/lib/sandbox.ts` | `briefNounHits` :236+ + `BRIEF_STOPWORDS` (vocabulary-free brief = stopwords only ⇒ `required: []` ⇒ p6-brief-fit vacuous) |
| `fixes/318_probe_h1_p7.mjs` | seeded-fixture idiom copied for the P6 analog (injection contract: "invents no gate verdicts: the re-run's runGate does") |

## Live probe evidence (keyless, 2026-09-30; probes outside repo)

### Probe 1 — `C:/Users/mnril/f2_scratch/f2_p6_nomint_probe.mjs` (in-memory; imports engine/dod/codegen.server)

```
ARM0 seeded(no mint): {"gate6":{"pass":false,"unmet":["p6-test","p6-source","p6-artifact","p6-verified"],...},"lastTest":null}
ARM-A post-mint: {"lastTest":null,"skippedRows":1,"mintedRows":0,
  "skipDetail":"tree-run ok but no executable spec ran (0 spec file(s), 0 assertion(s)) — no \"tested\" stamp minted (honest: nothing executed headless)",
  "skipLevel":"warn","skipPhase":6,"gate6":{"pass":false,"unmet":["p6-test","p6-source","p6-artifact","p6-verified"],...}}
ARM-A walk: {"outcome":"paused","code":"RT_E_GATE_PENDING","error":"P6 DoD unmet — hard gate blocks advance: p6-verified.",
  "currentPhase":6,"gate6":{"pass":false,"unmet":["p6-verified"],...},
  "park":{"code":"RT_E_GATE_PENDING","event":"wild.paused","unlock":"human-gate"},
  "rows":[... "warn gate.verdict: FAIL · 1 unmet · 19503792" ... "warn dod.blocked: P6 advance blocked — unmet: p6-verified" ... "warn wild.paused_dod: P6 DoD unmet — hard gate blocks advance: p6-verified"]}
ARM-B post-mint (control): {"lastTest":{"ok":true,"detail":"tree-run green: compile 1/1 file(s) · 1 spec file(s) pass · 2 assertion(s) · specs [tests/oracle.spec.ts]","label":"tested","evidenceHash":"3655235467"},"mintedRows":1,"gate6":{"pass":false,"unmet":["p6-source","p6-artifact"],...}}
ARM-C red: {"sameRef":true,"lastTest":null,"newRows":0}
```

**KEY DISCOVERY (probe, load-bearing):** the P6 floor exec (`applyPhaseResult(q,6)`) OVERWRITES `lastTest` with its own honest marker `{ok:true, detail:"tests.pass"}`. Therefore a pre-step mint is clobbered, and the production-faithful walk must mint AFTER the exec — exactly the production order the keyed edge uses (`driveP6Journey`'s converged branch invokes `mintTreeRunTested` ONCE with the real TreeRunOutcome, `codegen.server.ts:3720-3722`). The pin therefore drives BOTH walk arms through the documented **`p6Edge` seam** (W-01 contract, `wild-step.test.ts:253+`): seam = `applyPhaseResult(q,6)` + the REAL `mintTreeRunTested`. Only the TreeRunOutcome differs between arms.

### Probe 1b — the two seam arms (same probe, extended)

```
ARM-D1 walk (seam, no-spec mint): {"outcome":"paused","code":"RT_E_GATE_PENDING","error":"P6 DoD unmet — hard gate blocks advance: p6-verified.",
  "currentPhase":6,"lastTest":{"ok":true,"detail":"tests.pass"},
  "gate6":{"pass":false,"unmet":["p6-verified"],"evidenceHash":"1950379213"},
  "park":{"code":"RT_E_GATE_PENDING","event":"wild.paused","unlock":"human-gate"},
  "rows":[... "warn p6.tree.tested.skipped: tree-run ok but no executable spec ran (...) — no \"tested\" stamp minted (honest: nothing executed headless)", "info wild.exec: P6 executed (injected edge seam)", "warn gate.verdict: FAIL · 1 unmet · 19503792", "warn dod.blocked: P6 advance blocked — unmet: p6-verified", "warn wild.paused_dod: P6 DoD unmet — hard gate blocks advance: p6-verified"]}
ARM-D2 walk (seam, minted control): {"outcome":"advanced","code":null,"error":null,"currentPhase":7,
  "lastTest":{"...","label":"tested","evidenceHash":"3655235467"},
  "gate6":{"pass":true,"unmet":[],"evidenceHash":"3047279992"},"park":null,
  "rows":[... "info p6.tree.tested: tested-equivalent minted after green tree-run · compile 1/1 file(s) · 1 spec file(s) pass · 2 assertion(s) · specs [tests/oracle.spec.ts] · ...", "info wild.exec: P6 executed (injected edge seam)", "info gate.verdict: PASS · 0 unmet · 30472799", "info wild.advance: P6 sealed → P7 (classifier)"]}
```

→ The ONLY unmet criterion the D1 walk stops on is `p6-verified`; the identical fixture + one executed spec (same seam, same fixture, real mint) advances to P7. Deterministic mint hash `3655235467` reproduces J2's §3b CASE-B (`fixes/317_j2_preflight.md:120`) — same value, second machine, second run.

### Probe 2 — `C:/Users/mnril/f2_scratch/f2_seat_probe.sh` (real keyless CLI spawns; scratch cwd)

```
CREATE  → exit 0, status intake, enforceDod false (keyless default)
WILD --start --steps 8 → exit 0, {"outcome":"paused","steps":5}, summary {status:"awaiting_hitl", currentPhase:4,
    phaseCounts {complete:4, awaiting_hitl:1, locked:8}, nextAction{kind:"approve", phase:4}, ...}, note "Classifier not configured."
APPROVE BARE (non-TTY) → exit 1: {"ok":false,
    "error":"approve from a non-TTY names no claimable seat — the human seat needs an interactive terminal (--i-am-human + typed RT_HUMAN_SEAT_TOKEN re-entry; refused off-TTY) and a machine decision must be explicit. Next step: `approve --project <p> --seat autopilot` for an explicit machine approval, or run the verb from a terminal where a person can confirm.",
    "code":"RT_E_VALIDATION",
    "remedy":"Name exactly one seat: `--seat autopilot` (explicit machine attribution, works non-TTY) or `--i-am-human` from an interactive terminal (human seat, typed token re-entry).","exit_code":1}
APPROVE --seat human → exit 1: {"ok":false,
    "error":"approve: --seat \"human\" is not a seat — name 'autopilot' for an explicit machine decision, or drop --seat and pass --i-am-human for the human seat.",
    "code":"RT_E_VALIDATION",
    "remedy":"Re-run with exactly one seat: `approve --project <p> --seat autopilot` (explicit machine attribution) or `approve --project <p> --i-am-human` from an interactive terminal (human seat).","exit_code":1}
APPROVE --seat autopilot → exit 0: {"ok":true,"summary":{"currentPhase":5,"status":"running",
    "lastGate":{"phase":4,"decision":"approve","note":"[seat harness] autopilot seat — no human decision claimed","decidedBy":"autopilot","decidedAt":1790783806868}, ...}}
PROJECT JSON after: {status:"running", currentPhase:5, hitl:null, lastDecision:{decidedBy:"autopilot",decision:"approve",note:"[seat harness] autopilot seat — no human decision claimed"}}
```

→ Non-TTY bare + bogus-seat arms refuse CODED at exit 1 with remedies naming BOTH seat paths; the machine door exits 0 and stamps its own machine attribution; the parked gate (P4) clears and the cursor moves to P5. Probe sequence (bare → bogus → autopilot) confirms the refusals leave the gate untouched.

---

## PIN A — T8.2 seat-refusal taxonomy leg (`scripts/cli-exit-taxonomy.test.mjs`)

**Owed by:** T8.2 (`wave_plans/W43/COMPLETION-TASKS.md:91`: "The named taxonomy pin for the seat refusal is still OWED (grep \"no seat named\" over `scripts/*.test.mjs` = 0 hits today)"). Guard on disk: `rapidtool-cli.mjs:956-1015` (314 F5 · K2/K5). F5-1 flag + seat guard landed earlier; this pins the behavior.

### Insertion points (re-read at plan time; re-read again before edit)

1. **Header leg-list** — after line 51 (`//      \`RT_E_VALIDATION\` envelope, no stack.`), add leg 12 lines (exact text in code block below, `HEADER_ADD`).
2. **End of file** — after line 689 (the final `});` closing Leg 11). Purely additive; no existing test touched.

### Literal code (complete)

`HEADER_ADD` (insert after the leg-11 header block, before the closing `// ---...` rule of the banner):

```js
//  12. (T8.2 · 314 F5 K2/K5; 311_sd_product §1, behavioral spawn + source) the
//      approve seat discipline: the seat is NEVER guessed — a bare approve
//      (non-TTY) and a non-`autopilot` `--seat` value both refuse CODED
//      (exit 1 + RT_E_VALIDATION + a remedy naming both seat paths), the
//      explicit `--seat autopilot` machine door works non-TTY and stamps its
//      own machine attribution, and the TTY arm's bytes (the K2 silent
//      machine-attribution bug this guard killed) stay on disk.
```

`TEST_ADD` (append at end of file):

```js
// ---------------------------------------------------------------------------
// Leg 12 (T8.2 · 314 F5 K2/K5 — 311_sd_product §1/§5 #2, BEHAVIORAL + source).
// The K2 integrity bug: a bare `approve` on a TTY silently fell through to
// `{decidedBy:"autopilot", seat:"harness"}` — a human's decision attributed to
// the machine; the non-TTY arm pointed at "the autopilot gate" with no exact
// next step. The F5 fix made the seat NAMED, exactly one of `--i-am-human`
// (human ceremony, TTY only) or `--seat autopilot` (explicit machine door).
// This leg drives a REAL parked gate (keyless create + `wild --start` parks on
// the P4 stock gate) and pins the three seat shapes end-to-end: bare refuse,
// non-seat `--seat` refuse, machine door works — plus the TTY arm's source
// bytes (unreachable from a non-PTY spawn; the spawn arms below exercise the
// non-TTY arm). The refusal fires AFTER the project load + gate-pending check
// (rapidtool-cli.mjs :929-1015), hence the real park.
// ---------------------------------------------------------------------------
test("T8.2 — approve's seat is never guessed: bare / non-seat refuse CODED; `--seat autopilot` is the machine door", () => {
  // TTY-arm source guard: the spawn arms below cannot carry a TTY, so the
  // K2-killed text (a bare approval would be attributed to the MACHINE) is
  // pinned as bytes: if it vanishes, that is a deliberate re-derivation.
  assert.ok(
    cliText.includes("process.stdin.isTTY === true"),
    "rapidtool-cli.mjs must keep the TTY arm of the seat refusal (the K2 bug: a bare TTY approve silently minted decidedBy:\"autopilot\")",
  );
  assert.match(
    cliText,
    /no seat named[\s\S]{0,400}seat is never guessed/,
    "the TTY arm's refusal text (bare approval would be attributed to the MACHINE — the seat is never guessed) must stay on disk",
  );
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-seat-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) {
    delete env[key];
  }
  try {
    // Harness: a real project parked on the P4 stock HITL gate, keyless. The
    // brief matches the lattice vocabulary so P0-P3 advance deterministically;
    // the classifier cannot self-approve keylessly ⇒ the loop parks at P4.
    const proj = join(cwd, "seat-pin.json");
    const created = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        CLI_PATH,
        "create",
        "--brief",
        "Build an inventory tracker for a small warehouse team: track products, stock levels, and reorder alerts with a simple dispatcher workflow.",
        "--name",
        "SeatPin",
        "--out",
        proj,
      ],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(created.status, 0, `fixture create failed.\nstdout: ${created.stdout}\nstderr: ${created.stderr}`);
    const walked = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "wild", "--project", proj, "--start", "--steps", "8"],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(walked.status, 0, `wild --start must exit 0 (paused outcome).\nstdout: ${walked.stdout}\nstderr: ${walked.stderr}`);
    const walkedJson = JSON.parse(walked.stdout);
    assert.equal(walkedJson.outcome, "paused");
    assert.equal(
      walkedJson.summary.status,
      "awaiting_hitl",
      "harness precondition: the keyless wild run must park ON a gate (a drifted brief or floor moves the park — fix the fixture, never the assertions below)",
    );
    assert.equal(walkedJson.summary.currentPhase, 4, "the park must sit on the P4 stock gate for the approve legs");
    assert.equal(walkedJson.summary.nextAction?.kind, "approve", "the park's next action is the approval this leg pins");

    // Leg 1 — bare approve (non-TTY): the seat is never guessed (the 216/f5
    // guard that killed the silent machine-attribution fall-through).
    const bare = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, "approve", "--project", proj], {
      cwd,
      env,
      encoding: "utf8",
      timeout: 120_000,
    });
    const bareStderr = bare.stderr ?? "";
    assert.ok(
      !/(^|\n)\s+at\s/.test(bareStderr),
      `bare approve must never print a Node stack:\n${bareStderr}`,
    );
    assert.equal(
      bare.status,
      1,
      `bare approve → exit 1 (RT_E_VALIDATION is usage-class).\nstdout: ${bare.stdout}\nstderr: ${bareStderr}`,
    );
    const bareJson = JSON.parse(bare.stdout);
    assert.equal(bareJson.cmd, "approve");
    assert.equal(bareJson.ok, false);
    assert.equal(
      bareJson.code,
      "RT_E_VALIDATION",
      "an unnamed seat is a usage-class refusal — never a fall-through to a machine-attributed approval (K2)",
    );
    assert.ok(
      String(bareJson.error).includes("no claimable seat"),
      `the non-TTY refusal says WHY (no claimable seat exists off-TTY): ${bareJson.error}`,
    );
    assert.ok(
      String(bareJson.remedy).includes("--seat autopilot"),
      `the remedy names the machine door: ${bareJson.remedy}`,
    );
    assert.ok(
      String(bareJson.remedy).includes("--i-am-human"),
      `the remedy names the human door: ${bareJson.remedy}`,
    );
    assert.equal(bareJson.exit_code, bare.status, "the envelope's exit_code must equal the process exit");

    // Leg 2 — a NON-seat `--seat` value is refused with the 'autopilot' pointer.
    const bogus = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "approve", "--project", proj, "--seat", "human"],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    const bogusStderr = bogus.stderr ?? "";
    assert.ok(
      !/(^|\n)\s+at\s/.test(bogusStderr),
      `--seat human must never print a Node stack:\n${bogusStderr}`,
    );
    assert.equal(bogus.status, 1, `a non-seat --seat value → exit 1.\nstdout: ${bogus.stdout}\nstderr: ${bogusStderr}`);
    const bogusJson = JSON.parse(bogus.stdout);
    assert.equal(bogusJson.ok, false);
    assert.equal(bogusJson.code, "RT_E_VALIDATION", "an unknown seat value is a usage-class refusal");
    assert.ok(
      String(bogusJson.error).includes('--seat "human" is not a seat'),
      `the refusal names the bad value verbatim: ${bogusJson.error}`,
    );
    assert.ok(
      String(bogusJson.error).includes("'autopilot'"),
      `the refusal names the ONE valid seat value: ${bogusJson.error}`,
    );
    assert.equal(bogusJson.exit_code, bogus.status, "the envelope's exit_code must equal the process exit");

    // Leg 3 — the explicit machine door works non-TTY and stamps its own seat.
    const autopilot = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "approve", "--project", proj, "--seat", "autopilot"],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(
      autopilot.status,
      0,
      `\`--seat autopilot\` must approve (the documented machine door).\nstdout: ${autopilot.stdout}\nstderr: ${autopilot.stderr}`,
    );
    const apJson = JSON.parse(autopilot.stdout);
    assert.equal(apJson.ok, true);
    assert.equal(apJson.exit_code, autopilot.status, "the envelope's exit_code must equal the process exit");
    assert.equal(apJson.summary.currentPhase, 5, "the P4 gate was actually decided — the cursor moved to P5");
    const gate = apJson.summary.lastGate;
    assert.equal(gate?.phase, 4, "the recorded gate row is the P4 decision this leg made");
    assert.equal(gate?.decision, "approve");
    assert.equal(
      gate?.decidedBy,
      "autopilot",
      "the machine door stamps its OWN attribution — never a human seat (the whole point of the explicit door)",
    );
    assert.ok(
      String(gate?.note).includes("[seat harness]"),
      `the row carries the decisively-labeled machine seat tag: ${gate?.note}`,
    );
    // The on-disk project agrees (a real decision, not an envelope flourish).
    const onDisk = JSON.parse(readFileSync(proj, "utf8"));
    assert.equal(onDisk.status, "running", "the approved project left the awaiting_hitl park");
    assert.equal(onDisk.currentPhase, 5);
    assert.equal(onDisk.hitl ?? null, null, "the gate cleared — no stale hitl block");
    assert.equal(
      onDisk.decisions[onDisk.decisions.length - 1]?.decidedBy,
      "autopilot",
      "the minted ledger row carries the machine actor",
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
```

**Pins it must not weaken (non-weakening evidence):**
- Purely additive: no existing test/helper byte is touched (new `test(...)` appended after Leg 11; header gets 5 comment lines).
- Leg 3 (two-channel seat, :167-217) counts `flag(args,"i-am-human") ? await humanSeatClaim(` sites vs `await humanSeatClaim(` calls — untouched by this pin (no CLI byte changes).
- Leg 10 (:577-624) leg 11 (:634-688) idiomatic contracts copied verbatim: `mkdtempSync` cwd isolation, the 4-key env scrub, no-stack regex `/(^|\n)\s+at\s/`, `JSON.parse(res.stdout)`, `exit_code === status`.
- Scripts-leg cwd rule respected: the test never depends on repo cwd (CLI via `CLI_PATH` = `import.meta.url`); temp dir removed in `finally`.
- Expected counts: scripts leg 357 → **358 tests** (+1 `test()`); no existing count line in this file pins a total.

**Known honest limit:** the TTY arm's *behavior* cannot be spawned without a PTY — it is pinned at the source level (first two asserts) + the shared classification/remedy are pinned behaviorally; the non-TTY arm's exact error bytes are pinned behaviorally. (J2 §3c and this probe both captured the non-TTY arm live.)

---

## PIN B — T6.2(c) no-mint ⇒ P6-red walk (`src/lib/wild-step.test.ts`)

**Owed by:** T6.2(c) (`wave_plans/W43/COMPLETION-TASKS.md:77`: "**(c) the no-mint P6-red walk remains OWED** (no pin found today; `313_d1_seal.md` §S7 still unchecked)"); observed keyless by J2 §3b (`fixes/317_j2_preflight.md:115-125`).

**Home decision (read-driven):** `wild-step.test.ts` — the P6/P7 WALKING harness lives there: `p6WildFixture` (:232-251), W-01 P6 seam pins (:253-361), the P7 enforceDod precedent + exact probe-arm-A pause-text pin (:464-661), §316 H3 repair blocks (:749-871). `wild-seal.test.ts` carries the seal-specific pins (§S1-§S5) and has no P6-walk fixtures. See [FOR-PARENT] on the canon's box wording.

### Insertion points (re-read at plan time; re-read again before edit)

1. **Import block** — after line 13 (`import type { Project } from "./types.ts";`), add 2 lines (codegen mint + TreeRunOutcome type).
2. **End of file** — after line 871 (closing `});` of the §316 H3 describe). Purely additive.

### Literal code (complete)

`IMPORT_ADD` (insert after `import type { Project } from "./types.ts";`):

```ts
import { mintTreeRunTested } from "./codegen.server.ts";
import type { TreeRunOutcome } from "./compile-check.server.ts";
```

`SECTION_ADD` (append at end of file):

```ts
// ---------------------------------------------------------------------------
// T6.2(c) — THE NO-MINT ⇒ P6-RED WALK (W43 canon: wave_plans/W43/COMPLETION-TASKS.md
// §F6/T6.2(c) + fixes/317_j2_preflight.md §3b, the CASE-A observation pinned).
// A green tree-run that executed NO spec must never mint a "tested" stamp: the
// honest producer (codegen.server.ts `mintTreeRunTested`, :3772) logs the coded
// `p6.tree.tested.skipped` row and leaves `p6-verified` UNMET in runGate(6).
// The enforceDod leave check then hard-stops the run on that red — the cursor
// never leaves P6 (wild.paused_dod naming p6-verified) — and the SAME fixture
// with one executed spec mints a tested stamp and advances. Keyless, in-memory:
// the walk drives the REAL floor exec (`applyPhaseResult`) plus the REAL mint
// through the documented `p6Edge` seam (the W-01 contract above), in the
// production order (exec ⇒ tree-run mint on the post-exec project ⇒ leave
// gate). No gate verdict is ever fabricated — the leave check's own runGate
// decides. Load-bearing probe finding pinned here: the P6 floor exec OVERWRITES
// lastTest with its honest `{ok:true, detail:"tests.pass"}` marker, so the mint
// must ride the post-exec project (exactly where the keyed edge mints).
// ---------------------------------------------------------------------------

/** T6.2(c) fixture: priors 0-5 sealed, cursor on a ready phase 6, enforceDod
 *  ON. The brief is stopword-only, so p6-brief-fit passes vacuously — the ONLY
 *  degree of freedom between the two walk arms below is the minted stamp. */
function p6NoMintFixture(): Project {
  const p = emptyProject({
    name: "P6NoMint",
    brief: "A simple app with a list of items.",
    enforceDod: true,
  });
  p.wildMode = true;
  p.wildRun = {
    active: true,
    phase: 6,
    startedAt: Date.now(),
    lastAutoLog: "Wild run at P6",
    lastAutoAt: Date.now(),
    stoppedAt: null,
    pause: false,
  };
  p.currentPhase = 6;
  p.status = "running";
  p.phases = p.phases.map((r) =>
    r.id < 6 ? { ...r, status: "complete" as const } : r.id === 6 ? { ...r, status: "ready" as const } : r,
  );
  return p;
}

/** A green TreeRunOutcome whose one spec file was SKIPPED — 0 specs ran and 0
 *  assertions executed (the UI-shell / no-spec tree shape; J2 §3b CASE-A). */
function greenNoSpecOutcome(): TreeRunOutcome {
  return {
    ok: true,
    dir: "C:/pin/tree",
    compile: { ok: true, dir: "C:/pin/tree", checked: 1, passed: 1, failed: 0, skipped: 0, verdicts: [{ file: "src/generated.ts", verdict: "pass" }] },
    tests: [{ file: "tests/oracle.spec.ts", compile: "pass", run: "skip", tests: { pass: 0, fail: 0 } }],
    run: null,
  };
}

/** The discriminating control: the same green shape with 1 spec PASSING —
 *  2 assertions actually executed (J2 §3b CASE-B; deterministic hash). */
function greenExecutedOutcome(): TreeRunOutcome {
  return {
    ok: true,
    dir: "C:/pin/tree",
    compile: { ok: true, dir: "C:/pin/tree", checked: 1, passed: 1, failed: 0, skipped: 0, verdicts: [{ file: "src/generated.ts", verdict: "pass" }] },
    tests: [{ file: "tests/oracle.spec.ts", compile: "pass", run: "pass", tests: { pass: 2, fail: 0 } }],
    run: null,
  };
}

const approvingP6Reviewer: WildReviewer = async () => ({
  ok: true,
  verdict: "approve",
  feedback: "P6 pin reviewer approves the advance.",
  model: "pin",
});

/** The production order as one seam: REAL floor exec ⇒ REAL mint attempt on
 *  the post-exec project (the keyed edge's own order — `mintTreeRunTested` is
 *  invoked with the real TreeRunOutcome by driveP6Journey's converged branch).
 *  Only the outcome differs between the two arms below. */
const p6SeamWith = (outcome: TreeRunOutcome) => async (q: Project): Promise<Project> =>
  mintTreeRunTested(applyPhaseResult(q, 6), outcome);

describe("T6.2(c) — the no-mint ⇒ P6-red walk (W43 canon; fixes/317_j2_preflight §3b)", () => {
  it("a green tree-run with NO executed spec never mints: honest skipped row, p6-verified stays unmet", () => {
    const noSpec = mintTreeRunTested(p6NoMintFixture(), greenNoSpecOutcome());
    assert.equal(noSpec.lastTest ?? null, null, "no 'tested' stamp for a run that executed nothing (honest absence)");
    const skipped = (noSpec.logs ?? []).filter((l) => l.event === "p6.tree.tested.skipped");
    assert.equal(skipped.length, 1, "exactly ONE honest skipped row explains the absence");
    assert.equal(skipped[0]!.level, "warn");
    assert.equal(skipped[0]!.phase, 6);
    assert.equal(
      skipped[0]!.detail,
      'tree-run ok but no executable spec ran (0 spec file(s), 0 assertion(s)) — no "tested" stamp minted (honest: nothing executed headless)',
      "the skipped row's exact honest detail bytes",
    );
    assert.equal(
      (noSpec.logs ?? []).filter((l) => l.event === "p6.tree.tested").length,
      0,
      "no mint row may exist for a run that executed nothing",
    );
    assert.ok(
      runGate(noSpec, 6).unmet.some((u) => u.id === "p6-verified"),
      "the p6-verified criterion reads RED while no tested stamp exists",
    );

    // Control — one executed spec + assertions mints the stamp and clears the criterion.
    const minted = mintTreeRunTested(p6NoMintFixture(), greenExecutedOutcome());
    assert.equal(minted.lastTest?.label, "tested");
    assert.equal(
      minted.lastTest?.evidenceHash,
      "3655235467",
      "the deterministic tree-run evidence hash (reproduces J2 §3b CASE-B)",
    );
    assert.equal((minted.logs ?? []).filter((l) => l.event === "p6.tree.tested").length, 1, "exactly one mint row");
    assert.ok(
      !runGate(minted, 6).unmet.some((u) => u.id === "p6-verified"),
      "a REAL mint clears p6-verified — the gate discriminates",
    );
  });

  it("enforceDod blocks leaving P6 on that red — and a minted stamp clears the walk (the cursor advances)", async () => {
    const savedKey = process.env.DEEPSEEK_API_KEY;
    try {
      delete process.env.DEEPSEEK_API_KEY;
      // Arm 1 — no executed spec ⇒ no mint ⇒ the enforceDod leave check hard-stops.
      const res = await wildStep(p6NoMintFixture(), {
        reviewer: approvingP6Reviewer,
        p6Edge: p6SeamWith(greenNoSpecOutcome()),
      });
      assert.equal(res.outcome, "paused");
      assert.equal(res.code, "RT_E_GATE_PENDING");
      assert.equal(
        res.error,
        "P6 DoD unmet — hard gate blocks advance: p6-verified.",
        "the exact hard-DoD error naming the one red criterion",
      );
      assert.equal(res.project.currentPhase, 6, "the cursor never left P6");
      assert.notEqual(res.project.lastTest?.label, "tested", "nothing minted — the honest absence rides the park");
      assert.deepEqual(
        runGate(res.project, 6).unmet.map((u) => u.id),
        ["p6-verified"],
        "p6-verified is the ONLY unmet criterion the walk stopped on (the mint's absence is the blocker)",
      );
      const row = (res.project.logs ?? []).find((l) => l.event === "wild.paused_dod");
      assert.ok(row, "wild.paused_dod row present");
      assert.equal(row!.detail, "P6 DoD unmet — hard gate blocks advance: p6-verified");
      const blocked = (res.project.logs ?? []).find((l) => l.event === "dod.blocked");
      assert.ok(
        blocked && String(blocked.detail).includes("unmet: p6-verified"),
        "the dod.blocked row names the criterion",
      );
      assert.equal(res.project.wildRun?.park?.code, "RT_E_GATE_PENDING");
      assert.equal(res.project.wildRun?.park?.unlock, "human-gate");
      assert.equal(
        (res.project.logs ?? []).filter((l) => l.event === "p6.tree.tested").length,
        0,
        "the skipped path never mints a tested row through the walk",
      );

      // Arm 2 (control) — one executed spec ⇒ the REAL mint clears p6-verified
      // ⇒ the identical walk advances. Same fixture, same seam, same reviewer.
      const ok = await wildStep(p6NoMintFixture(), {
        reviewer: approvingP6Reviewer,
        p6Edge: p6SeamWith(greenExecutedOutcome()),
      });
      assert.equal(ok.outcome, "advanced", "a minted tested stamp clears p6-verified — the leave check proceeds");
      assert.equal(ok.project.currentPhase, 7, "the cursor advances to P7 only once the stamp exists");
      assert.equal(ok.project.lastTest?.label, "tested");
      assert.deepEqual(runGate(ok.project, 6).unmet, [], "gate green after the mint");
      assert.equal(
        (ok.project.logs ?? []).some((l) => l.event === "wild.paused_dod"),
        false,
        "no DoD park when the mint cleared the gate",
      );
      assert.ok(
        (ok.project.logs ?? []).some((l) => l.event === "wild.advance" && l.detail.includes("P6 sealed → P7")),
        "the advance row proves the pre-mint hard-stop is cured",
      );
    } finally {
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
    }
  });
});
```

**Pins it must not weaken (non-weakening evidence):**
- Purely additive: new helpers (`p6NoMintFixture`, `greenNoSpecOutcome`, `greenExecutedOutcome`, `approvingP6Reviewer`, `p6SeamWith`) + 1 new describe; no existing fixture/helper/test byte touched. Name-collision check vs file: existing = `wildFixture`, `p6WildFixture`, `p7WildFixture`, `approvingP7Reviewer`, `p7SeamResult`, `notConfiguredReviewer`, `errorReviewer`, `recorder` — all distinct from mine.
- W-01 P6 seam pins (:253-361) untouched: they still own the call-site semantics (seam called once, `wild.exec` edge-naming) and the byte-parity floor (`P6 executed (deterministic floor)`).
- P7 enforceDod precedent (:636-660) untouched: exact probe-arm-A pause text still pinned there; my pin mirrors the idiom at P6 (and enters through the seam, so the no-seam floor bytes stay exclusively pinned by W-01).
- New import is type + function additive; `applyPhaseResult`/`emptyProject`/`wildStep`/`runGate` imports were already present. Keyless discipline: DEEPSEEK_API_KEY scrubbed in-test (house pattern) so a keyed host can never swap the P6 edge out from under the arms.
- Expected counts: `wild-step.test.ts` 28 → **30 tests**; wild-seal+wild-step together 39 → **41**; scoped run must show 0 fail.

---

## Phase B plan (on GO — no keyed run in flight)

1. Confirm `C:/Users/mnril/w44_trial/fix_go.md` exists AND `tasklist | grep -i node` shows no wild/emit run in flight (T1's keyed trial window closed).
2. Re-read the two target files' tails + the CLI seat bytes fresh (patch-only discipline); apply via `patch` (additive only).
3. Scoped proofs, foreground:
   - `node --test scripts/cli-exit-taxonomy.test.mjs` → expect 12/12 (was 11/11; +1).
   - `node --experimental-strip-types --test src/lib/wild-step.test.ts` → expect 30/30 (was 28/28; +2).
   - Control re-run of the untouched sibling: `node --experimental-strip-types --test src/lib/wild-seal.test.ts` → 11/11 unchanged.
4. Record counts + decisive assertion lines here; fix any [BUG] tickets in-box if small+provable; else [FOR-PARENT]. End marker `COMPLETE`.
5. Check `git status` — my diff must be exactly: `scripts/cli-exit-taxonomy.test.mjs`, `src/lib/wild-step.test.ts`, `fixes/319_f2_pins.md` (no other lane's file).

## Notes / open items

- **[FOR-PARENT]** T6.2(c) home: canon's box wording (`COMPLETION-TASKS.md:77` "box: `engine.ts` + `wild-seal.test.ts`") names `wild-seal.test.ts`; read-driven decision = `src/lib/wild-step.test.ts` (P6/P7 walking harness + fixtures live there; both files are in my box; zero production-code edits needed either way). If the parent prefers wild-seal, the same code moves 1:1 (it imports engine/dod same as that file; only import adders differ).
- **[FOR-PARENT]** T1/T2/T3 live keyed trial: my Phase A probes were strictly keyless, cwd-insulated (`C:/Users/mnril/f2_scratch/`), no repo writes (`git status` re-checked after each probe). Phase B waits for the GO marker per the freeze.
- Probe artifacts (outside repo): `C:/Users/mnril/f2_scratch/f2_p6_nomint_probe.mjs`, `C:/Users/mnril/f2_scratch/f2_seat_probe.sh`, outputs captured in this log above.

=== END 319_f2_pins — PARTIAL (Phase A banked; Phase B awaiting GO) ===

---

## [PARENT] Phase B completion (2026-09-30)

GO arrived (`fix_go.md` live 11:02); F2 applied **both pins** before its cap:
- Pin (a) T8.2 seat-refusal leg → `scripts/cli-exit-taxonomy.test.mjs` (+183; new leg 12).
- Pin (b) T6.2(c) no-mint⇒P6-red walk → `src/lib/wild-step.test.ts` (+189).
One type error remained (`wild-step.test.ts:985` — `.evidenceHash` absent from the `Project.lastTest` type). **Parent applied the house cast** (`codegen.server.test.ts:567` idiom) at `:985`.

Fresh scoped proofs (parent, same day):
- `node --experimental-strip-types --test src/lib/wild-step.test.ts` → **30/30 · 0 fail** (was 28; +2)
- `node --experimental-strip-types --test src/lib/wild-seal.test.ts src/lib/io.test.ts src/lib/store.test.ts` → **155/155 · 0 fail** (11+60+84)
- `node --test scripts/cli-exit-taxonomy.test.mjs` → **12/12 · 0 fail** (was 11; +1)
- `npx eslint` on all 7 touched files → 0 problems · `npm run typecheck` → **0 errors**

**[FOR-PARENT] T6.2(c) home resolved:** `src/lib/wild-step.test.ts` (read-driven; the canon's box wording allowed either file; zero production-code edits). Boundary re-run by parent post-wave.

=== END 319_f2_pins — COMPLETE (Phase A by F2; Phase B applied by F2 pre-cap; parent: 1-line cast + fresh proofs) ===

# 322 · X2 FIXER #2 — scripts/** + tests box (W44 Phase-2 fixers)

Lane X2 (fixer #2, scripts + test-files box) of the W44 "10 EXPERIMENTS" campaign.
Repo `C:\Users\mnril\Desktop\RapidTool Main` · HEAD `20802b1` · tree CLEAN + FROZEN.
Boundary of record: typecheck 0 · lint 0 · scripts 359/359 · lib 2482/2481+1 · gate.sh ok:true.

**Hard rules honored:** single write surface = THIS log (+ script/test patches ONLY once
`C:/Users/mnril/w44_trial/fix_go2.md` exists). No keyed calls (shell verified keyless:
`DEEPSEEK_API_KEY` unset, `RT_HUMAN_SEAT_TOKEN` unset). No boundary runs. Repros are
read-only w.r.t. the repo (temp-dir projects + keyless CLI spawns). Space-in-path ⇒
terminal `grep` only; ripgrep unavailable.

**Watch surface:** `fixes/321_d1_live.md` (operator, live bytes) · `fixes/321_d2_monitor.md`
(monitor QA + ticket register) · `fixes/322_e1_ten.md` / `322_e2_monitor.md` / `322_e3_backend.md`
(wave-2 E1 campaign, watched each poll) · `C:/Users/mnril/w44_trial/live1/**` raw envelopes.

## Ticket register (scripts-side relevance triage)

| # | sev | ticket | scripts-side? |
|---|---|---|---|
| **T / F-2** | LOW-MED | forceHuman autopilot approve → `RT_E_INTERNAL` / exit 4 + generic "retry… escalate" remedy; wants a policy code + human-door remedy | **YES — seeded ticket, this lane** |
| F-1 | MED-HIGH | machine `reject` mints `decidedBy:"human"` | split: src/lib attribution (X1) + CLI reject seat seam (this lane, blocked-on-X1) |
| OBS F-3 | obs | honest exit-2 parks logged `level:"error"`, `code:null` in diagnose | partial scripts component (`respond()` level mapping); adjudication pending — HOLD |
| OBS F-4 | obs | P6 hard-red remedy prose references a HITL prompt while `hitl:null` | src/lib (headless/diagnose) → not this box; [OTHER-BOX: X1] |
| OBS F-5 | obs | classifier review note cut at 1467 chars mid-sentence | classifier reply cap (`wild-mode.server.ts:286 maxTokens:320`); CLI passes verbatim → no scripts-side fix |

## Ticket T — mechanism mapping (read-only)

- **Bytes:** `live1/03_sealed_approve_autopilot.out` — `{ok:false, error:"Autopilot may not
  approve a forceHuman gate (R3/B-03).", code:"RT_E_INTERNAL", remedy:"Log the full error,
  retry once if it may be transient, and escalate with the raw message rather than
  paraphrasing.", exit_code:4}` + Node stack (`engine.ts:1691` → `headless.ts:1231` → `rapidtool-cli.mjs:1069`).
- **Throw site:** `src/lib/engine.ts:1690-1691` — `approveHitl` bare-throws
  `Error("Autopilot may not approve a forceHuman gate (R3/B-03).")` when
  `project.hitl.forceHuman && decidedBy === "autopilot" && !opts?.force`.
- **Wrap site:** the approve arm has NO local try/catch, so the throw reaches `main()`'s
  internal catch (`scripts/rapidtool-cli.mjs:3956-3963`):
  `respond({ ok:false, error: message, ...errCode(err, "RT_E_INTERNAL") }, 4)`. The plain
  `Error` carries no `.code`; `classifyError` (src/lib/errors.ts) object-matches only, so the
  `RT_E_INTERNAL` fallback rides. `respond()` then fills `remedy` from `ERROR_CODE_DOC`
  (`remedyFor`) = the generic internal-escalate line.
- **Taxonomy home:** `scripts/cli-exit-taxonomy.test.mjs` Leg 1 (`EXIT_BY_CODE`) scans
  `errCode(err,"<CODE>")` sites — the internal catch is CORRECT for its class; the defect is
  that a deterministic POLICY refusal entered the internal class at all. Sibling shapes are
  already refused CODED at the verb: bare/non-seat approve → `RT_E_VALIDATION` exit 1
  (:1002-1014), policy-seam denial → `RT_E_VALIDATION` exit 1 (:1059-1067).
- **Code choice:** the registry (`src/lib/errors.ts` ERROR_CODE_DOC) has NO dedicated
  governance code; the usage class `RT_E_VALIDATION` exit 1 is the documented idiom for
  every seat refusal in this verb and matches D2's adjudicated fix direction ("RT_E_VALIDATION
  (or governance code) → clean exit 1 like 04"). A dedicated code (e.g. `RT_E_HUMAN_ONLY_GATE`)
  would be an X1 src/lib registry change (union + ERROR_CODE_DOC + README table) — see
  [OTHER-BOX: X1]; this patch can be re-coded in one line when/if it lands.

## Reproduction (keyless, temp dir — read-only w.r.t. repo)

Flow: `create` (keyless) → `wild --start --steps 8` (keyless ⇒ deterministic floor, parks at P4
STOCK gate) → flip `hitl.forceHuman = true` in a temp copy (the exact byte-shape the review-reject
mint writes) → spawn the door.

PRE-FIX (repo CLI `20802b1`), `approve --seat autopilot` on the flipped gate:
```
APPROVE_EXIT=4
{
  "schema_version": 1,
  "cmd": "approve",
  "ok": false,
  "error": "Autopilot may not approve a forceHuman gate (R3/B-03).",
  "code": "RT_E_INTERNAL",
  "remedy": "Log the full error, retry once if it may be transient, and escalate with the raw message rather than paraphrasing.",
  "exit_code": 4
}
stderr: Error: Autopilot may not approve a forceHuman gate (R3/B-03).
    at approveHitl (src/lib/engine.ts:1691:11)
    at Module.approve (src/lib/headless.ts:1231:5)
    at main (scripts/rapidtool-cli.mjs:1069:27)
```
→ **ticket T reproduced byte-for-byte (keyless).** Same run, `--seat autopilot --force`:
```
APPROVE_FORCE_EXIT=1  {code:"RT_E_VALIDATION", error:"approve: refused by the policy seam —
force-requires-human-seat — a autopilot/harness seat may never force past a human gate; only a
verified human seat may.", remedy:<generic validation agentAction>}
```
(exit class already correct there; remedy is the generic validation line, not a human-door line —
recorded as a residual, not part of T. Also: policy.ts reason carries a typo "a autopilot" —
[OTHER-BOX: X1] cosmetic.)

## FIX T — prepared patches (NOT YET APPLIED — waiting on `fix_go2.md`)

### T1 · `scripts/rapidtool-cli.mjs` — refuse the machine seat on a forceHuman gate, CODED, at the verb

CLAIM: applying this hunk makes `approve --seat autopilot` on any gate with
`hitl.forceHuman === true` return the coded usage-class refusal (exit 1, `RT_E_VALIDATION`,
human-door remedy) BEFORE `h.approve` — the engine throw becomes unreachable for this shape via
the CLI; every other approve path (bare/non-seat/policy-seam/human door/stock-gate machine door)
stays byte-identical. Engine throw remains as defense-in-depth.
PROOF (post-apply, scoped): `node --check scripts/rapidtool-cli.mjs` · keyless repro spawn →
exit 1 + `RT_E_VALIDATION` + remedy `--i-am-human` (see §Mirror pre-validation for the exact
bytes this patch produced).

```diff
--- a/scripts/rapidtool-cli.mjs
+++ b/scripts/rapidtool-cli.mjs
@@ -1013,6 +1013,28 @@
             1,
           );
         }
+        // W44 X2 (seeded ticket T · fixes/321_d2_monitor F-2): a forceHuman gate
+        // is HUMAN-ONLY (R3/B-03) — a rejected review park / failed P6 sandbox
+        // is never machine-cleared. The engine enforces this with a bare throw
+        // (engine.approveHitl), which main()'s internal catch wraps as
+        // RT_E_INTERNAL / exit 4 + the generic "retry / escalate" remedy — the
+        // WRONG class for a deterministic governance refusal. The gate's own
+        // state is already loaded here, so refuse CODED at the verb (usage
+        // class, exit 1, remedy = the human door) before the driver call; the
+        // engine throw stays as defense-in-depth (live bytes:
+        // C:/Users/mnril/w44_trial/live1/03_sealed_approve_autopilot.out).
+        if (machineSeat && project.hitl.forceHuman) {
+          return respond(
+            {
+              ok: false,
+              error: `approve: the open gate (P${project.hitl.phase}) is human-only (forceHuman — R3/B-03): a machine seat may never approve a forceHuman gate, and --force cannot carry it either.`,
+              code: "RT_E_VALIDATION",
+              remedy:
+                "Use the human door: run `approve --project <p> --i-am-human` from an interactive terminal (typed RT_HUMAN_SEAT_TOKEN re-entry), or send the phase back with `reject --project <p> --note <qualitative feedback>`. A forceHuman gate can never be machine-approved.",
+            },
+            1,
+          );
+        }
         // 216o (T-107.3 · P0-01/P0-06 · W5-L3 — the CLI length of the ONE seam):
```

### T2 · `scripts/cli-exit-taxonomy.test.mjs` — Leg 13 (behavioral pin; pin-strengthening only)

CLAIM: adds a behavioral leg that pins the T1 refusal end-to-end, keylessly: coded refusal
(exit 1 + `RT_E_VALIDATION`), error names the human-only gate + R3/B-03 + the gate phase,
remedy = the human door (`--i-am-human`, `reject --project`), NO stack on stderr, and NOTHING
minted on disk (status stays `awaiting_hitl`, `forceHuman` stays true, decisions length
unchanged). NO existing leg/assertion is modified (parse — a pin never weakens; the two hunks
below only ADD).
PROOF (post-apply, scoped): `node --test scripts/cli-exit-taxonomy.test.mjs` → expect 13/13
(mirror run: `# tests 13 · # pass 13 · # fail 0`, 36.2s).

```diff
--- a/scripts/cli-exit-taxonomy.test.mjs
+++ b/scripts/cli-exit-taxonomy.test.mjs
@@ -56,6 +56,11 @@
 //      explicit `--seat autopilot` machine door works non-TTY and stamps its
 //      own machine attribution, and the TTY arm's bytes (the K2 silent
 //      machine-attribution bug this guard killed) stay on disk.
+//  13. (W44 X2 · seeded ticket T / D2 F-2, behavioral spawn) the forceHuman
+//      gate's machine door: `approve --seat autopilot` on a forceHuman gate
+//      refuses CODED at the verb (exit 1 + RT_E_VALIDATION + the human-door
+//      remedy) and decides nothing — never the engine throw's RT_E_INTERNAL /
+//      exit 4 wrap (live bytes: live1/03_sealed_approve_autopilot.out).
 //
 // House rules honored: cwd-independent (paths via import.meta.url — a
 // scripts-leg test must not depend on process cwd); failure messages name the
@@ -867,6 +872,133 @@
     );
   } finally {
     rmSync(cwd, { recursive: true, force: true });
+  }
+});
+
+// ---------------------------------------------------------------------------
+// Leg 13 (W44 X2 · seeded ticket T / fixes/321_d2_monitor F-2 — BEHAVIORAL
+// spawn). The minted forceHuman gate (review-reject park / failed P6 sandbox)
+// is HUMAN-ONLY (R3/B-03). Before this leg, `approve --seat autopilot` on such
+// a gate reached headless.approve, the engine's bare throw escaped to main()'s
+// internal catch, and a DETERMINISTIC governance refusal came back wrapped as
+// RT_E_INTERNAL / exit 4 + the generic "retry… escalate" remedy (live bytes:
+// C:/Users/mnril/w44_trial/live1/03_sealed_approve_autopilot.out). The fix
+// refuses CODED at the verb — usage class, exit 1, remedy = the human door —
+// before the driver call, and decides nothing. This leg re-derives the exact
+// shape keylessly: a real keyless park, then the gate's forceHuman bit flipped
+// exactly as the review-reject mint writes it.
+// ---------------------------------------------------------------------------
+test("W44 X2 — a forceHuman gate refuses the autopilot door CODED (exit 1, human-door remedy), never RT_E_INTERNAL/exit 4", () => {
+  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-forcehuman-"));
+  const env = { ...process.env };
+  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) {
+    delete env[key];
+  }
+  try {
+    // Fixture: a real keyless park (the leg-12 harness), then the forceHuman
+    // flip the review-reject mint applies (forceHuman: true on the hitl block).
+    const proj = join(cwd, "forcehuman-pin.json");
+    const created = spawnSync(
+      process.execPath,
+      [
+        "--experimental-strip-types",
+        CLI_PATH,
+        "create",
+        "--brief",
+        "Build an inventory tracker for a small warehouse team: track products, stock levels, and reorder alerts with a simple dispatcher workflow.",
+        "--name",
+        "ForceHumanPin",
+        "--out",
+        proj,
+      ],
+      { cwd, env, encoding: "utf8", timeout: 120_000 },
+    );
+    assert.equal(created.status, 0, `fixture create failed.\nstdout: ${created.stdout}\nstderr: ${created.stderr}`);
+    const walked = spawnSync(
+      process.execPath,
+      ["--experimental-strip-types", CLI_PATH, "wild", "--project", proj, "--start", "--steps", "8"],
+      { cwd, env, encoding: "utf8", timeout: 120_000 },
+    );
+    assert.equal(walked.status, 0, `wild --start must exit 0 (paused outcome).\nstdout: ${walked.stdout}\nstderr: ${walked.stderr}`);
+    const before = JSON.parse(readFileSync(proj, "utf8"));
+    assert.equal(
+      before.status,
+      "awaiting_hitl",
+      "fixture precondition: the keyless wild run parks on a gate (a drifted brief/floor — fix the fixture, never the assertions below)",
+    );
+    assert.ok(before.hitl && Number.isInteger(before.hitl.phase), "fixture precondition: the park carries a hitl block with its phase");
+    assert.ok(!before.hitl.forceHuman, "fixture precondition: a STOCK park is not human-only — the flip below is the only difference");
+    before.hitl.forceHuman = true; // the byte-shape the review-reject mint writes
+    writeFileSync(proj, JSON.stringify(before, null, 2));
+    const decisionsBefore = (before.decisions ?? []).length;
+
+    const res = spawnSync(
+      process.execPath,
+      ["--experimental-strip-types", CLI_PATH, "approve", "--project", proj, "--seat", "autopilot"],
+      { cwd, env, encoding: "utf8", timeout: 120_000 },
+    );
+    assert.equal(res.error, undefined, `spawn failed: ${String(res.error)}`);
+    const stderr = res.stderr ?? "";
+    assert.ok(
+      !/(^|\n)\s+at\s/.test(stderr),
+      `a governance refusal must never print a Node stack (the RT_E_INTERNAL wrap this leg killed):\n${stderr}`,
+    );
+    assert.equal(
+      res.status,
+      1,
+      `autopilot on a forceHuman gate → exit 1 (usage class). Exit 4 IS the regressed internal wrap.\nstdout: ${res.stdout}\nstderr: ${stderr}`,
+    );
+    let json = null;
+    try {
+      json = JSON.parse(res.stdout);
+    } catch {
+      /* surfaced below */
+    }
+    assert.ok(json, `exactly one JSON envelope on stdout.\nstdout: ${res.stdout}\nstderr: ${stderr}`);
+    assert.equal(json.ok, false, "the refusal is a refusal envelope");
+    assert.equal(json.cmd, "approve");
+    assert.equal(
+      json.code,
+      "RT_E_VALIDATION",
+      "a deterministic governance refusal is usage-class — a generic/missing code means the RT_E_INTERNAL wrap is back",
+    );
+    assert.ok(
+      String(json.error).includes("human-only"),
+      `the refusal says WHY (the gate is human-only): ${json.error}`,
+    );
+    assert.ok(
+      String(json.error).includes("R3/B-03"),
+      `the refusal cites the governance rule (R3/B-03): ${json.error}`,
+    );
+    assert.ok(
+      String(json.error).includes(`P${before.hitl.phase}`),
+      `the refusal names the open gate's phase: ${json.error}`,
+    );
+    assert.ok(
+      String(json.remedy).includes("--i-am-human"),
+      `the remedy is the human door: ${json.remedy}`,
+    );
+    assert.ok(
+      String(json.remedy).includes("reject --project"),
+      `the remedy keeps the send-back door visible: ${json.remedy}`,
+    );
+    assert.ok(
+      !/may be transient|escalate with the raw message/.test(String(json.remedy)),
+      `the generic internal-escalate remedy must never ride a policy refusal: ${json.remedy}`,
+    );
+    assert.equal(json.exit_code, res.status, "the envelope's exit_code must equal the process exit");
+
+    // The refused attempt decided NOTHING: the human-only gate is still open.
+    const after = JSON.parse(readFileSync(proj, "utf8"));
+    assert.equal(after.status, "awaiting_hitl", "a refused machine attempt must not decide the gate");
+    assert.equal(after.hitl?.forceHuman, true, "the human-only gate stays open for the human door");
+    assert.equal(
+      (after.decisions ?? []).length,
+      decisionsBefore,
+      "no ledger row may be minted by a refused attempt",
+    );
+  } finally {
+    rmSync(cwd, { recursive: true, force: true });
   }
 });
 
```

### T3 · `scripts/README-cli.md` — declare the refusal class (declare-or-strike)

CLAIM: the agent-loop section declares the new refusal shape (coded, exit 1, human-door remedy,
never exit-4) — the doc sentence the behavior now matches. No pinned sentence changes (taxonomy
leg 2's "Exit 4 = backend or internal runtime failure" line untouched; README-cli.test.mjs pins
verb counts/arms — untouched). Note: this file is CRLF; keep CRLF.

```diff
--- a/scripts/README-cli.md
+++ b/scripts/README-cli.md
@@ -228,8 +228,11 @@
 ## Driving to completion (agent loop)
 
 Stock HITL gates (P4, P5, P8, P9) — and any `forceHuman` gate — are **never**
-auto-approved, even with `--autopilot` (governance rule R3/B-03). So the honest
-autopilot loop is:
+auto-approved, even with `--autopilot` (governance rule R3/B-03). An
+`approve --seat autopilot` on a `forceHuman` gate is refused CODED — exit 1,
+`RT_E_VALIDATION`, remedy = the human door (`--i-am-human` / `reject --note`) —
+never the exit-4 internal class: it is a deterministic governance refusal, not
+a runtime failure. So the honest autopilot loop is:
```

## Mirror pre-validation (temp only — NOT repo edits)

An isolated mirror was built under `%TEMP%` (`scripts/` copy + `src` & `node_modules`
junctions → repo) and the three patches were applied there, proving the exact patch text
before the window opens:

- `node --check` mirror CLI → OK; line endings preserved (CLI/test = LF, README = CRLF).
- Mirror keyless repro (patched CLI), flip-then-`approve --seat autopilot`:
  ```
  APPROVE_EXIT=1
  {
    "schema_version": 1,
    "cmd": "approve",
    "ok": false,
    "error": "approve: the open gate (P4) is human-only (forceHuman — R3/B-03): a machine seat may never approve a forceHuman gate, and --force cannot carry it either.",
    "code": "RT_E_VALIDATION",
    "remedy": "Use the human door: run `approve --project <p> --i-am-human` from an interactive terminal (typed RT_HUMAN_SEAT_TOKEN re-entry), or send the phase back with `reject --project <p> --note <qualitative feedback>`. A forceHuman gate can never be machine-approved.",
    "exit_code": 1
  }
  ```
  (stderr EMPTY — no stack.)
- FULL mirror test file: `1..13 · # tests 13 · # pass 13 · # fail 0 · duration 36.2s` —
  leg 13 green AND legs 1-12 stay green (pin strengthening proven, nothing weakened).
- `npx eslint` on mirror files → "File ignored because outside of base path" (expected);
  scoped eslint will run on the real files post-apply.

## F-1 scoping (reject door) — [OTHER-BOX: X1] + held scripts half

Observed (live1/05 + D2 F-1): non-TTY machine `reject --note` mints `lastGate.decidedBy:"human"`
+ ledger row `decidedBy:"human"` (engine.ts:1809 `rejectHitl` hardcodes it). CLI `reject`
(:1075-1110) has NO seat/policy seam (approve has one at :969-1068). README-cli.md:1094-1101
claims approvals never mint a human actor from a machine path — reject currently violates it.

- **[OTHER-BOX: X1 — src/lib half, requested]:** give `rejectHitl`/`headless.reject` an explicit
  actor param (no silent "human"; machine callers = `{decidedBy:"autopilot", seat:"harness"}`,
  human only via the two-channel claim) and stamp `decidedVia` like approve does
  (headless.ts:1215-1233 shape); thread `store.reject` if its API needs the actor. Also cosmetic:
  policy.ts reason typo "a autopilot/harness seat".
- **Scripts half (PREPARED below; lands ONLY with X1's seam — "the two patches must land together", X1 log §Ticket R):** mirror approve's seat discipline onto the CLI `reject` verb + pass the actor. X1's seam shape: engine `rejectHitl(project, note, opts?: { decidedBy?: HitlDecision["decidedBy"] })` (absent ⇒ legacy "human" so the console/store path keeps byte-identical rows); `headless.reject(project, note, actor?)` — parent picks variant R-A (machine default = `HARNESS_APPROVE_ACTOR`) or R-B (refuse undefined actor, coded `RT_E_VALIDATION`). **My CLI shape below is COMPATIBLE WITH BOTH picks** (bare is refused at the verb either way; every allowed path passes an explicit actor). **HARD GATE: DO NOT apply S1 standalone — with today's 2-arg `headless.reject` the 3rd arg is silently ignored and `--seat autopilot` would mint `decidedBy:"human"` worse than today. Apply only when `grep -n "export function reject" src/lib/headless.ts` shows the actor param (X1 landed) AND the marker clears F-1.** Re-read both files immediately before editing.

**F1-S1 · `scripts/rapidtool-cli.mjs` reject arm — seat block + actor pass.** CLAIM: bare reject → coded refusal (exit 1, both seat doors in remedy), non-seat `--seat`/both-flags refused like approve, `--seat autopilot` → `{decidedBy:"autopilot", seat:"harness"}` and `--i-am-human` → the two-channel human actor both ride `h.reject`'s new 3rd arg; nothing is written on any refusal. INSERT (after the ≥12-char note floor, before `const updated = h.reject(project, note.value);` — replace that call line):

```js
        // 322 X2 (F-1 scripts half · D2 F-1): the reject door carries the SAME
        // explicit-seat discipline as approve — the seat is never guessed, and a
        // machine path can never mint a human actor. The pre-fix path left the
        // seat to rejectHitl, which hardcoded decidedBy:"human" for EVERY caller
        // (live bytes: live1/05_sealed_reject_note.out — a non-TTY machine
        // reject stamped "human"). Exactly one seat: `--seat autopilot`
        // (explicit machine attribution) or `--i-am-human` (human ceremony —
        // TTY + typed RT_HUMAN_SEAT_TOKEN re-entry, refused off-TTY); the chosen
        // actor rides h.reject's actor parameter (X1's seam).
        const humanClaim = flag(args, "i-am-human");
        const seatArg = args.seat;
        const machineSeat = seatArg === "autopilot";
        if (seatArg !== undefined && !machineSeat) {
          const shown = seatArg === true ? "(no value)" : JSON.stringify(seatArg);
          return respond(
            {
              ok: false,
              error: `reject: --seat ${shown} is not a seat — name 'autopilot' for an explicit machine rejection, or drop --seat and pass --i-am-human for the human seat.`,
              code: "RT_E_VALIDATION",
              remedy:
                "Re-run with exactly one seat: `reject --project <p> --note <t> --seat autopilot` (explicit machine attribution) or `reject --project <p> --note <t> --i-am-human` from an interactive terminal (human seat).",
            },
            1,
          );
        }
        if (humanClaim && machineSeat) {
          return respond(
            {
              ok: false,
              error:
                "reject: --i-am-human and --seat autopilot are mutually exclusive — a decision is either a person's or the machine's; name exactly one seat.",
              code: "RT_E_VALIDATION",
              remedy: "Drop one flag: keep `--i-am-human` for the human seat (TTY-only) or `--seat autopilot` for explicit machine attribution.",
            },
            1,
          );
        }
        if (!humanClaim && !machineSeat) {
          return respond(
            {
              ok: false,
              error:
                process.stdin.isTTY === true
                  ? `reject: no seat named — a bare rejection would carry no claimed seat and the seat is never guessed. Name the seat: \`--i-am-human\` for a human decision (typed RT_HUMAN_SEAT_TOKEN re-entry at the prompt) or \`--seat autopilot\` for an explicit machine decision.`
                  : `reject from a non-TTY names no claimable seat — the human seat needs an interactive terminal (--i-am-human + typed RT_HUMAN_SEAT_TOKEN re-entry; refused off-TTY) and a machine decision must be explicit. Next step: \`reject --project <p> --note <t> --seat autopilot\` for an explicit machine rejection, or run the verb from a terminal where a person can confirm.`,
              code: "RT_E_VALIDATION",
              remedy:
                "Name exactly one seat: `--seat autopilot` (explicit machine attribution, works non-TTY) or `--i-am-human` from an interactive terminal (human seat, typed token re-entry).",
            },
            1,
          );
        }
        const humanSeat = flag(args, "i-am-human") ? await humanSeatClaim("reject") : null;
        if (humanSeat && humanSeat.error) {
          return respond({ ok: false, error: humanSeat.error, code: "RT_E_VALIDATION" }, 1);
        }
        const updated = h.reject(project, note.value, humanSeat ? humanSeat.actor : { decidedBy: "autopilot", seat: "harness" });
```
(pin interaction: adds ONE `flag(args,"i-am-human") ? await humanSeatClaim(` site → leg-3(d) counts move 3→4 on both sides, assertion `>= 3` + equality stay green; no new `process.env.RT_HUMAN_SEAT_TOKEN` reads.)

**F1-S2 · `scripts/rapidtool-cli.mjs` `humanSeatClaim` — the cmd-aware machine pointer gets a reject branch.** CLAIM: a non-TTY `reject --i-am-human` names the correct machine door (today it falls to the generic else-branch "omit --i-am-human", the K5 dead-end class). Replace the ternary chain:

```js
    const machineLine =
      cmd === "approve"
        ? "For an explicit MACHINE decision use `approve --project <p> --seat autopilot` — a bare call is never guessed a seat."
        : cmd === "reject"
          ? "For an explicit MACHINE rejection use `reject --project <p> --note <t> --seat autopilot` — a bare call is never guessed a seat."
          : cmd === "fixtures"
            ? "Approving fixtures is a human-only decision (the autopilot seat can never approve them) — run the verb from a terminal where a person can confirm."
            : "Use the autopilot seat instead (omit --i-am-human) or run the verb from a terminal where a person can confirm.";
```

**F1-S3 · `scripts/README-cli.md` — declare the reject seat (2 hunks)**. CLAIM: quickstart + seat section document the reject discipline (declare-or-strike; no pinned sentence touched — the verb-count list/paragraph untouched, no number-noun claims added). Hunk A (quickstart step 4 comment):

```md
# 4. Approve / reject the pending gate (`reject` requires ≥12 characters of --note;
#    a shorter note is refused — exit 1 RT_E_VALIDATION, nothing written. Both
#    verbs require an explicit seat: --seat autopilot (machine) or --i-am-human
#    (TTY + typed RT_HUMAN_SEAT_TOKEN re-entry; refused off-TTY))
```
Hunk B (insert before "The token is deliberately out-of-band:" paragraph in §The `approve` seat):

```md
### The same seat on `reject` (322 · F-1)

The reject door carries the identical discipline: exactly one seat — `--seat autopilot`
(`decidedBy: "autopilot"`, seat harness) or `--i-am-human` (the human two-channel claim,
TTY only). A bare `reject` (either TTY state) is refused CODED — exit 1, `RT_E_VALIDATION`,
with both seat doors in the remedy — and the chosen actor is stamped on the minted ledger
row + `lastGate`, so a machine reject can never mint `decidedBy: "human"` (the pre-322
behaviour: `rejectHitl` hardcoded the human stamp for every caller; live bytes
`live1/05_sealed_reject_note.out`).
```

**F1-S4 · `scripts/cli-exit-taxonomy.test.mjs` — Leg 14 DRAFT (finalize at window; needs BOTH boxes landed).** Pin shape (behavioral spawn, same keyless-park harness as legs 12/13): (1) bare `reject --note` (non-TTY) → exit 1 + `RT_E_VALIDATION` + error includes "no claimable seat" + remedy includes `--seat autopilot`; nothing minted (status stays `awaiting_hitl`); (2) `--seat human` → exit 1 + `--seat "human" is not a seat`; (3) `--seat autopilot` → exit 0, `summary.status:"blocked"`, `lastGate.decidedBy:"autopilot"`, disk `decisions[-1].decidedBy:"autopilot"` (this assertion needs X1's engine change — without it the row says "human" and the leg goes RED, correctly). Header bullet 14 added. Full text drafted in-lane; adapted to X1's landed variant before apply. PROOF: `node --test scripts/cli-exit-taxonomy.test.mjs` → 14/14.

### Combined mirror pre-validation (MIR3 — temp only, non-repo)

Second temp mirror (`%TEMP%/tmp.npQwW2QxSS`, scripts copy + src/node_modules junctions) with **T1 + T2 + F1-S1 + F1-S2 applied together**:
- `node --check` OK; full suite `1..13 · # pass 13 · # fail 0` — F1's new `humanSeatClaim("reject")` claim site keeps leg-3(d) counts 4=4 and every other pin green.
- Keyless refusal surfaces (fresh keyless parks): bare `reject --note` (non-TTY) → **exit 1 + `RT_E_VALIDATION` + "no claimable seat" + both-door remedy, stderr EMPTY, nothing minted** (gate stays `awaiting_hitl`, decisions 0); `--seat human` → exit 1 + `--seat "human" is not a seat`; `--i-am-human` non-TTY → exit 1 + seam refusal naming the NEW reject machine door.
- (`--seat autopilot` success deliberately NOT validated standalone — it requires X1's actor seam; with today's 2-arg `h.reject` it would still mint "human" — the exact hazard the HARD GATE above forbids.)

## OBS F-5 scoping (1467-char review-note cut) — classifier reply cap, no scripts-side component

- Measured: `02_sealed_wild.out` note = **exactly 1467 chars**, ends mid-sentence
  (`…marketing site with`); D1's journey note showed the SAME cut in the CLI envelope `note` and
  the minted `hitl.prompt` (one source, two surfaces).
- Origin: the Auto-Review classifier completion cap — `src/lib/wild-mode.server.ts:286`
  `maxTokens: 320` on `completeFn(...)`. The reply is parsed verbatim (`parseWildReview(res.text)`,
  no slice); the CLI passes `res.note` verbatim (`rapidtool-cli.mjs:3630`); no CLI-surface
  truncation exists for notes/prompts (the only CLI clip is `clipSurface` 600 on
  `wildRun.park.reason`/`lastAutoLog`, explicitly marked with "…" — src/lib).
- Remedy/honesty: nothing discloses the cut — the feedback text carries no truncation marker,
  and no remedy line mentions a cap. So the ~1467-char sentence-end is a token-budget stop, not
  a char slice, and it is currently silent.
- **No scripts-side fix** (nothing in scripts/** causes or can detect it — the CLI never sees
  `finish_reason`). [OTHER-BOX: X1] if the campaign wants it addressed upstream: raise the cap,
  or mark truncation (e.g. append "… [review truncated at reply cap]" when the completer reports
  a length-stop), or surface it in the minted prompt/stakes text.

## OBS-5 candidacy (P6 hard-red remedy names a non-existent HITL door) — scripts-side slice CONFIRMED (candidate, HOLD unless cleared)

Mechanism (keyless repro of the exact bytes): both DoD-red envelopes are CLI-BUILT —
`respondDriveOutcome` (`rapidtool-cli.mjs:543-561`) and the run/gate arm (`:761-780`) — and set
`code:"RT_E_GATE_PENDING"` with NO custom remedy, so `respond()` fills the registry agentAction
("Route the project through the open HITL prompt (approve/reject with feedback)…") while
`hitl:null` — there is no prompt to route through. Keyless repro (fresh project, `enforceDod`
hand-flipped true, 2 approve cycles → P6): `gate` → exit 1, `outcome:"dod"`,
`failedGates:[P6: p6-verified, p6-brief-fit]`, remedy = the HITL line above. (D1 keyed bytes match:
`live1/15_journey_gate3.out`; E2 register OBS-5 + X1 log §F-4 both flag it; X1 punted adjudication
to the parent with "[OTHER-BOX: X2] if the envelope is CLI-built" — it IS.)

CANDIDATE PATCH **OBS-5-S** (both sites; apply ONLY if the marker clears OBS-5): add a custom
remedy after `code: "RT_E_GATE_PENDING",`:

```js
              remedy:
                "A hard DoD red is repaired, not approved: read summary.failedGates (the unmet criteria), fix the phase's artifacts or re-run the phase, then re-run `gate` — no HITL accept/reject door exists for a red gate.",
```
Site 1 anchor = the `respondDriveOutcome` block (has `...extras,` before `code:`); Site 2 anchor =
the run/gate block (has `...(unattended ? { unattended: true } : {}),` before `code:`). CLAIM: a
call-site remedy passes through untouched (`respond()` :169-174) → the red envelope stops naming a
door that does not exist; nothing else changes. PROOF (at apply): keyless DoD-red repro byte check
+ full scripts-leg suite. **Mirror-validated (MIR3, with T+F1 applied): both hunks applied clean;
`node --check` OK; keyless DoD-red repro against the patched CLI returns the custom remedy
byte-exact (`outcome:"dod" · code:"RT_E_GATE_PENDING" · remedy:"A hard DoD red is repaired, not
approved: …"`); full suite stays 13/13.** STATUS: **HOLD — not a cleared ticket; do not apply
without the marker.**

## OBS F-3 candidacy (HOLD — not a cleared ticket)

Honest exit-2 parks log `level:"error", code:null` rows (`respond()` maps
`level: exitCode === 0 ? "info" : "error"`, rapidtool-cli.mjs:183) and diagnose then reads
"not a clean bill of health". A one-line scripts-side change (`exitCode === 2` → `"info"`, or a
`parked` outcome field) exists, but D2 marked adjudication pending. HOLD: no patch prepared
pending adjudication; do not apply without a cleared ticket.

## Apply ledger

| when | patches | proofs | result |
|---|---|---|---|
| — | _none applied yet_ | — | waiting on `C:/Users/mnril/w44_trial/fix_go2.md` |

## Poll log

| # | time (CDT) | marker | new tickets / notes |
|---|---|---|---|
| P1 | 15:58 | absent | register read: T/F-2, F-1, F-3, F-4, F-5; E1 wave at EXP03, no new scripts-box tickets |
| P2 | 16:04 | absent | E2 register added BUG-1…BUG-4 + E3-1 — homes: `codegen.server.ts` / `src/lib/sandbox.ts` / `dod.ts` / `knowledge.ts` / packet-side — ALL src/lib → [OTHER-BOX: X1]; **no scripts/test-side components found** (checked prose-in-code, briefNounHits, LESSON_TEXT_MAX, sandbox.ts paths). E1 at EXP04. |

---

## WINDOW #2 APPLY LEDGER (X2b applier · `fix_go2.md` present 16:45 CDT · closed 16:47 CDT) — CLEARED SET APPLIED, ALL PROOFS GREEN

Parent picks honored: **R-A** (headless `reject` default = harness autopilot actor; engine `rejectHitl` `opts?.decidedBy` with `?? "human"` legacy default — landed by X1b in parallel, consumed here only after the disk-proven gate). Threshold **0.35** is X1b's (this lane touched no src/lib and no threshold).

| # | patch | pick | proofs (scoped, fresh) | result |
|---|---|---|---|---|
| W2-1 | **T1** — CLI forceHuman machine-door refusal (diff as written) | — | `node --check` OK; keyless repro → exit 1 · `RT_E_VALIDATION` · error `approve: the open gate (P4) is human-only (forceHuman — R3/B-03)…` · human-door remedy · stderr EMPTY · nothing minted — **byte-identical to §Mirror pre-validation** | APPLIED |
| W2-2 | **T2** — leg 13 + header bullet 13 (as written) | — | `node --test` → `1..13 · # tests 13 · # pass 13 · # fail 0` (37.6s) | APPLIED |
| W2-3 | **T3** — README-cli declare hunk | — | CRLF preserved (CR 1144→1147 = line count) | APPLIED |
| W2-4 | **OBS-5-S** — DoD-red remedy, BOTH CLI sites (cleared by `fix_go2.md` item 6) | — | keyless DoD-red repro → `outcome:"dod"` · `code:"RT_E_GATE_PENDING"` · remedy byte-exact · `failedGates:[P6]` | APPLIED |
| W2-5 | **HARD GATE** — X1b actor seam poll | R-A | **PASSED ON DISK** — `grep -n "export function reject" src/lib/headless.ts` → `1251:export function reject(` with `actor: ApproveActor = HARNESS_APPROVE_ACTOR` (1251–1255); engine `rejectHitl` `opts?: { decidedBy?: HitlDecision["decidedBy"] }` (engine.ts:1795) + `decidedBy: opts?.decidedBy ?? "human"` (:1820) | GATE PASSED → F1-* released |
| W2-6 | **F1-S1 + F1-S2** — reject seat discipline + cmd-aware machine pointer (as written) | R-A | keyless repros → bare reject (non-TTY): exit 1 · `RT_E_VALIDATION` · "no claimable seat" · both-door remedy · nothing minted; `--seat human`: `--seat "human" is not a seat`; `--seat autopilot`: exit 0 · `summary.status:"blocked"` · `lastGate.decidedBy:"autopilot"` · ledger row `decidedBy:"autopilot"` | APPLIED |
| W2-7 | **F1-S3** — README reject-seat hunks (declare) | — | CRLF preserved (CR 1147→1159 = line count) | APPLIED |
| W2-8 | **F1-S4** — leg 14 **adapted to R-A** (full text written at window) + header bullet 14 | R-A | `node --test` → `1..14 · # tests 14 · # pass 14 · # fail 0` (21.0s); legs 1–13 stay green (pin strengthening only, nothing weakened) | APPLIED |

**Adapted bits (window-time, R-A-shaped):**
- Leg 14 (the F1-S4 draft finalized at apply — parent spec: success leg asserts `status blocked` + `lastGate.decidedBy:"autopilot"` + a decisions row `decidedBy:"autopilot"`): fixture = the leg-13 keyless park; (1) bare `reject --note` (non-TTY) → exit 1 + `RT_E_VALIDATION` + error ⊇ `no claimable seat` + remedy ⊇ `--seat autopilot` + `--i-am-human`, nothing minted (gate stays `awaiting_hitl`, decisions unchanged); (2) `--seat human` → exit 1 + error ⊇ `--seat "human" is not a seat`; (3) `--seat autopilot` → exit 0 + `summary.status:"blocked"` + `summary.lastGate.decision:"reject"` + `summary.lastGate.decidedBy:"autopilot"` + on-disk `decisions[-1].decidedBy:"autopilot"`.
- F1-S1/S2/S3 needed **no adaptation**: the landed seam matches the drafted 3rd-arg contract; the CLI passes `humanSeat.actor` (`{decidedBy:"human",seat:"human-cli-i-am-human"}`) or `{ decidedBy:"autopilot", seat:"harness" }`.
- T2's diff geometry: the leg-13 block is a mid-file insertion that reuses the last test's `  }` / `});` closers (added run = 127 lines: `  }`…`rmSync`); reproduced byte-exactly. The F1-S4 leg was appended self-contained in the same house style.

**Fresh proofs, final state (scoped only — no npm test / build / gate.sh):**
- `node --check scripts/rapidtool-cli.mjs` → OK · `node --check scripts/cli-exit-taxonomy.test.mjs` → OK.
- `node --test scripts/cli-exit-taxonomy.test.mjs` → `1..14 · # tests 14 · # pass 14 · # fail 0 · duration 21.0s`.
- Keyless repro spawns (temp-dir projects; env scrubbed; the live repo CLI): forceHuman door refusal byte-identical to §Mirror; DoD-red remedy byte-exact; F1 bare/non-seat/autopilot shapes as row W2-6.
- `npx eslint scripts/rapidtool-cli.mjs scripts/cli-exit-taxonomy.test.mjs` → exit 0, no findings.
- README-cli.md still CRLF (**1159 CRs / 1159 lines**); CLI + test stay LF (0 CRs); every region re-read immediately before its edit; one writer per file.
- `git status --short` (this lane's paths): only `scripts/rapidtool-cli.mjs`, `scripts/cli-exit-taxonomy.test.mjs`, `scripts/README-cli.md` + lane logs; `src/lib/**` untouched by this lane (X1b's box, applied in parallel).

**HARD-GATE outcome: APPLIED** — seam proven on disk before any F1-* edit (evidence row W2-5); the hold path was never needed.

**F-3 (HOLD — no edit):** exit-2 `code:null` adjudication left as observed (D2 pending); no patch prepared or applied. F-4/F-5 remain src/lib-only ([OTHER-BOX: X1]). OBS-5-S's earlier "HOLD" label in this log is superseded by `fix_go2.md` item 6 — applied (W2-4).

=== END 322_x2_fixes — COMPLETE ===

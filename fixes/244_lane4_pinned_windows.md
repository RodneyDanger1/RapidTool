# 244 · LANE 4 (W16) — OV-18 + OV-14: pin the unpinned honesty windows

**Lane:** W16 LANE 4. **Box:** `src/lib/honesty-guards.test.ts`, `src/lib/gates.test.ts`, `src/lib/packet.test.ts` ONLY.
No silent semantics changes; any src change needed ⇒ exact patch proposal here (NOT applied).
Scratch: `C:/Users/mnril/w16l4_scratch/` (probe7.mts = boundary scans + capture table).

## BOTTOM LINE

- **OV-18 · the clamp window is PINNED** in `honesty-guards.test.ts` (4 new tests, suite 9/9): exact caps table,
  boundary scans at two text lengths (torn/in-tact/full-tail edges), the torn-window shape + count rule, and the
  48 000 production identity. The degraded region is pinned as REGISTERED-DEGRADED (217b §1.4 E1) — pins document
  it, never bless it; the code fix is OUT of this lane's box ⇒ exact patch proposal below, NOT applied.
- **OV-14 · the surface is PROVEN + NAMED:** the **P6 reqTrace artifact** (`"P6 architecture trace (reqTrace)"`,
  `engine.ts:1538` stamp, rendered by the packet's `## Artifacts (trimmed)`) carries the p6-arch verdict; for
  tree-carrying projects the verdict **tracks `archProductComplete` exactly (PASS ⇔ true, FAIL ⇔ false)** — proven in
  `gates.test.ts` + `packet.test.ts`. The **skip leg surfaces as SILENCE** (no artifact, no log, gate record
  identical) — that residual is pinned, and the packet-side fix is OUT of box ⇒ exact patch proposal below.
- **Suites (foreground, targeted):** honesty-guards **9/9** · gates **87/87** · packet **48/48** — all fail 0 (commands in §Evidence).

---

## OV-18 · clamp marker window (custom caps)

**Implementation read first:** `src/lib/node-runner.server.ts` — `RUNNER_OUTPUT_MAX_CHARS = 48_000` (:74);
`clampRunnerOutput` (:91–128): `cap < 64` ⇒ plain `slice(0, cap)` head-cut, counted (exact); `cap ≥ 64` ⇒ two-pass
marked layout (`head = floor(0.6·cap)`, marker `\n… [<n> chars elided by runner output cap] …\n`), then
`:123` `out.length <= cap ? out : out.slice(0, cap)` → the slice is what tears the marker when it cannot fit.

**What is PINNED** (`honesty-guards.test.ts`, describe “W16 L4 honesty guards — OV-18 clamp window pin”):

1. Exact-cap capture table for L=50 000 (`TAIL-END` sentinel):
   | cap | outLen | marker | full tail | elidedChars |
   |---|---|---|---|---|
   | 63 | 63 | none (plain cut) | no | 49 937 (= L−63, exact) |
   | 64 | 64 | **TORN** | no | 49 962 (= L−38 = L−head) |
   | 100 | 100 | **TORN** | no | 49 940 |
   | 115 | 115 | **TORN** | no | 49 931 |
   | 116 | 116 | intact | no | 49 931 |
   | 120 | 120 | intact | no (tail=1 char) | 49 927 |
   | 135 | 135 | intact | no | 49 912 |
   | 136 | 136 | intact | **yes** | 49 911 |
   | 200 | 200 | intact | yes | 49 847 |
   | 1 000 | 1 000 | intact | yes | 49 047 |
2. Boundary SCANS (not literals — the scan asserts the edge): L=50 000 → last torn **115**, first intact **116**,
   first full-tail **136**; L=1 000 → **110 / 111 / 131** (edges move with the digit count of the elided number —
   that is why the registered window reads “≈64–118”).
3. Torn-window shape: `text.length === cap`, marker PREFIX present (never silent), marker TORN (closing `] …` absent),
   no tail, `elidedChars === originalChars − floor(0.6·cap)`. Boundary: cap 63 is the last plain counted cut.
   Slight-over anchor: L=101 @ cap 100 → torn, `elidedChars = 41` (= 101 − head 60).
4. Sweep caps 64–400 at L=50 000: every result is torn-exactly OR intact-exactly; intact ⇒
   `elidedChars === L − (outLen − markerLen)` and marker number === `elidedChars`. Zero violations (scratch
   edge sweep L=65..400 × cap 64..L−1 also 0 violations).
5. Production identity: default cap 48 000 on a 100 000-char input → outLen 48 000, marker intact, full tail
   survives, `elidedChars 52 047`, exact accounting. Callers checked: only `node-runner.server.ts:412–413`, both
   with the default cap — **no production impact** from the window.

**What remains UNPINNED (and why):** (a) the FIX itself — `node-runner.server.ts` is outside LANE 4's box, and the
task forbids silent semantics changes; (b) a general closed-form pin for ARBITRARY L — the tests fix two sample
lengths + one full sweep (the scan asserts the edges for those lengths); unbounded-L coverage would need a
property-style oracle, and the scratch edge sweep already shows the rule (recorded, not test-pinned to keep the
suite deterministic and fast); (c) whether `<64` should carry an in-text marker — the code’s documented fallback is
a count-only cut (pinned since W11 at cap 40, and at cap 63 here); the playbook’s “never silent” phrasing is
carried by the ENVELOPE count, not the text — noted, not changed.

### Patch proposal — `src/lib/node-runner.server.ts` (exact, NOT applied)

```diff
   const out = `${text.slice(0, head)}${marker}${tail > 0 ? text.slice(text.length - tail) : ""}`;
+  if (out.length > cap) {
+    // Degenerate custom cap (≈64–118 for long texts): the marked layout cannot
+    // fit; a torn marker + dropped tail is worse than the counted plain cut
+    // (217b §1.4 E1). Reuse the <64 fallback's honest semantics.
+    return { text: text.slice(0, cap), clamped: true, originalChars: text.length, elidedChars: text.length - cap };
+  }
   return {
-    text: out.length <= cap ? out : out.slice(0, cap),
+    text: out,
     clamped: true,
     originalChars: text.length,
     elidedChars: elided,
   };
```

Consequences, stated honestly: at the 48 000 production cap the branch never triggers (`out.length === cap` there) →
production bytes unchanged; inside the degenerate window the result becomes the counted plain cut, so `elidedChars`
changes from `L − head` to `L − cap` (both are exact for “input chars not kept”, but the marker bytes no longer
occupy the output) — i.e. the fix intentionally removes the torn-marker bytes. The torn rows in the new pins are
labelled REGISTERED-DEGRADED and are the rows to FLIP when this lands. Alternative (not recommended without owner
review): shrink `head` so `head + marker + ≥1 tail` always fit — bigger layout change, preserves a (1-char) tail.

---

## OV-14 · `archProductComplete` — skip ≠ complete made observable

**Facts established by reading (commands in §Evidence):** `archProductComplete` (`dod.ts:232`) has exactly two
consumers: `dod.ts` itself (`:546` comment) and `gates.test.ts` — no production caller. `reqTrace`/`p6-arch` appear
**0 times** in `packet.ts`, `headless.ts`, `rapidtool-cli.mjs`, `console.tsx`. The `doctor` `productComplete`
(`doctor.ts:167`, “skip≠green; stubs≠complete”) is the OV-9 job-inventory flag — a DIFFERENT fact (the playbook
warns against two surfaces of one fact; not reused).

**Surface PROVEN + NAMED:** the **P6 reqTrace artifact** `"P6 architecture trace (reqTrace)"` + its `dod.reqtrace`
log row (engine `stampP6ReqTrace`), rendered by the packet’s `## Artifacts (trimmed)` section.

- `gates.test.ts` (describe “W16 L4 — OV-14 skip≠complete observability via the reqTrace artifact”):
  - tree-carrying: artifact body `**p6-arch: PASS** · tree (2 files)` ⇔ `archProductComplete → true`; missing-capability
    tree: `**p6-arch: FAIL**` + named “Missing capabilities” ⇔ `false` — the verdict tracks the predicate exactly.
  - skipped (fixture = `promote(fullRun())`, every other probe green, NO tree): `skipped: true`,
    `archProductComplete → false`, `runGate(·,6)` passes vacuously, `stampP6ReqTrace` is a same-reference no-op
    (no artifact, no log) — and the recorded gate is **identical** to its tree sibling’s (`passed:true` both;
    the two fixtures differ only in the p6-arch inputs — `generatedTree` + `implementationSpec` — so every other
    probe reads identical state) ⇒ the gate record cannot carry the distinction.
- `packet.test.ts` (new test): complete ⇒ packet contains `### P6 · P6 architecture trace (reqTrace)` +
  `**p6-arch: PASS** · tree (1 file)`; incomplete ⇒ `**p6-arch: FAIL**` + “Missing capabilities”; skipped ⇒ packet
  contains neither `reqTrace` nor `p6-arch` — the fact surfaces as **silence**.

**Residual (registered, not fixed):** the SKIP leg has no production surface at all (only the module functions
`archTrace`/`archProductComplete` know it). Fixing that needs `packet.ts` (or a CLI field) — outside this box.

### Patch proposal — `src/lib/packet.ts` (exact, NOT applied)

1. Add `import { archProductComplete, archTrace } from "./dod.ts";` (client-safe: `dod.ts` imports only
   `types.ts`, `algorithms.ts`, `policy.ts`, `sandbox.ts`).
2. In `compileAgentPacket`, beside `const coverage = …` (~`:227`), CALL the producers (never recompute):
   `const arch = archTrace(project);` · `const archComplete = archProductComplete(arch);`
3. Surface it as a FACT (not a gate) in the System JSON envelope (`systemJson`, ~`:84`; thread the two values in):
   `arch: { product_complete: archComplete, skipped: arch.skipped === true, present: arch.present === true, missing: arch.missing.length, stub_files: arch.stubFiles.length },`
4. Byte-identity note for the landing: this changes the `## System JSON` block for every packet ⇒ any golden pin of
   that block must be re-baselined in the same landing; the packet’s determinism pins (H-05 D1/D2: compile-twice /
   re-stamp byte-identical) are unaffected (the value derives from project state). Do NOT echo it into prose claims
   without declare-or-strike review — a vacuous keyless packet must not read “complete”.
   Optional follow-on (registered): the same field on the CLI `summary` envelope (`headless.ts`), sequenced by the owner.

---

## Evidence ledger (every claim = the command)

```
# Reads
playbook OV-14 :851-870 / OV-18 :987-1006 (research/multiagent/230_task_execution_playbook.md; grep -n "OV-18\|OV-14")
clamp impl: src/lib/node-runner.server.ts :74, :91-128 (sed)
registration: fixes/217b_watchdog_verification.md:123-130 (E1: “slice(0, cap) truncates the marker mid-way … and the tail is dropped”)
consumers: grep -rn "archProductComplete" src/ scripts/  → dod.ts:187/:232/:546 + gates.test.ts:11/:932/:939/:1000/:1014/:1028
           grep -c "p6-arch" src/lib/packet.ts → 0; grep -rn "clampRunnerOutput" | grep -v test → :412/:413 only (default cap)

# Probe (scratch, foreground): C:/Users/mnril/w16l4_scratch/probe7.mts
node --experimental-strip-types probe7.mts
  → L=50000: violations=0 lastTorn=115 firstIntact=116 firstTailFull=136
  → L=1000:  violations=0 lastTorn=110 firstIntact=111 firstTailFull=131
  → L=9999/10000: 112/113/133 · L=120000: 117/118/138 · L=101: torn through 100
  → DEFAULT: {cap:48000, outLen:48000, intact:true, tailFull:true, elided:52047}
  (probe1/3 had a capture-group bug — noted and fixed in probe7; edge sweep L=65..400 × cap 64..L−1: 0 violations)

# Suites (FOREGROUND — background node dies `stdin is not a tty`, host artifact)
node --experimental-strip-types --test --test-concurrency=2 src/lib/honesty-guards.test.ts → # tests 9 · # pass 9 · # fail 0
node --experimental-strip-types --test --test-concurrency=2 src/lib/gates.test.ts         → # tests 87 · # pass 87 · # fail 0
node --experimental-strip-types --test --test-concurrency=2 src/lib/packet.test.ts       → # tests 48 · # pass 48 · # fail 0

# Footprint
git status --porcelain → M src/lib/gates.test.ts · M src/lib/honesty-guards.test.ts · M src/lib/packet.test.ts (+ this log)
  — no src/ file of mine touched; W15/W16 sibling lanes' edits visible in the same status are NOT mine.
```

One mid-run correction, recorded for honesty: the first gates run failed my own new assertion (`skip records a
PASSING gate`) because the first skip fixture (`applyPhaseResult(fullRun(),6)`) is red for OTHER probes
(p6-verified/p6-brief-fit). Fixture corrected to `promote(fullRun())` — the shape the file already pins as
all-green — so both shapes differ ONLY by `generatedTree`, which is what makes the indistinguishability claim
exact, not incidental. No production code was touched at any point.

## Verification (re-run after the final cleanup edits — these are the landing numbers)

```
node_modules/.bin/eslint src/lib/gates.test.ts src/lib/honesty-guards.test.ts src/lib/packet.test.ts
  → exit 0 (scoped lint — LANE 4's box only; full `eslint .` is not run while sibling lanes are mid-edit)
node --experimental-strip-types --test --test-concurrency=2 src/lib/honesty-guards.test.ts → # tests 9  · # pass 9  · # fail 0 · exit 0
node --experimental-strip-types --test --test-concurrency=2 src/lib/gates.test.ts          → # tests 87 · # pass 87 · # fail 0 · exit 0
node --experimental-strip-types --test --test-concurrency=2 src/lib/packet.test.ts        → # tests 48 · # pass 48 · # fail 0 · exit 0
```

Final cleanup applied before this run: the two OV-18 edge scans now share one `scanEdges` helper (DRY); no
assertion semantics changed. Repo-wide `npm test` / `npm run typecheck` / `npm run build` are deliberately NOT run
from this lane — the brief marks them FORBIDDEN (parent/boundary only) and sibling lanes hold uncommitted edits in
`scripts/` + `src/lib/`, so a repo-wide result now would be invalid as evidence. The parent owns the boundary gate.

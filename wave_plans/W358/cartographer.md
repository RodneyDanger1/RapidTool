# W358 · lane `cartographer` — verify the closure wave, and finalise the W359 kind-fidelity plan

**Wave:** W358. **Persona:** `cartographer`. **Author:** the wave parent. Read FIRST.

## Mission

Verify the three closure lanes against the bytes, map any regression they introduce, and finalise the
**W359 kind-fidelity plan** you began in `research/multiagent/357_cartographer.md`.

Your W357 report already found the campaign's deepest defect: `engine.ts:219-241`'s ordered first-hit
keyword table **mis-resolves 3 of 10 corpus briefs** — including the only game brief (`arcade-breakout` →
`app` via `screen/screens`), `showing-booking` → `tool` via `agent`, and `coffeehouse2home` → `service` —
and **neither non-`app` kindFit unit is an honest case** (a bakery website stamped `game`, a mobile app
stamped `library`, both via the bare noun `level`). If the kind is wrong, the factory builds the wrong
product no matter how good synthesis is. That is the next wave's subject.

## Owned files (findings only)

`research/multiagent/358_cartographer.md` (the only file you write). Read anything.

## Job 1 — verify the three lanes (adversarial)

Read `fixes/358_close_taxonomy.md`, `358_close_kindjsx.md`, `358_close_ui.md` as they land; they may be
mid-flight. Pin the revision window. Verify by measurement, never from a lane's log:

- **`close-taxonomy`**: the `EXIT_BY_CODE` ↔ README parity test passes **without** an invented exit code
  and **without** deleting README rows — read the contract the lane chose and judge whether it is honest
  (a code with no CLI arm must not assert an exit code). `RT_E_RATCHET_METRIC_UNAVAILABLE` is registered in
  **both** `ERROR_CODES` and `ERROR_CODE_DOC`, and the ratchet's owed-code canaries still behave. The two
  new `kindFit` pins fail at floor−1 when planted. The `lint.problems` floor is re-pinned honestly with the
  bar at 0.
- **`close-kindjsx`**: for **every** kind, the emitted source compiles under the emitted `tsconfigJson`'s
  options — re-derive the extension-vs-compiler-option table yourself, do not accept the lane's table.
  R-8's type-level fix actually makes an omitted census scope fail the typecheck (plant it).
- **`close-ui`**: the wave owner's decision (merge: keep the spec-derived page set **and** bind ≥2 real
  spec-derived fields plus an interaction) is honoured, or the residual is named with evidence; both
  `scaffold.test.ts` capabilities are green or the discarded one is recorded; R-10's alert now keys on the
  banner the scaffold truly writes, verified for **both** the below-floor and red-tree branches.

Report each as **CONFIRMED / REFUTED / PARTLY / UNDECIDED** with the deciding command.

## Job 2 — the regression map

An ignore/parity fix that hides a real mismatch; a kind-aware tsconfig that breaks a web kind; a merge that
reduces the emitted product while both tests pass; an alert whose new key misses a third banner variant.
Each with `file:line` + the query that shows it.

## Job 3 — finalise the W359 kind-fidelity plan (the campaign's main line)

Deliver a **sequenced, file-level, lane-shaped plan** for making the factory deliver the best version of
the **requested** kind. Cover, at minimum:

1. **The resolver.** `engine.ts:219-241`'s keyword table mis-resolves 3/10 measured briefs. Specify the
   replacement (a scored/weighted resolution with an explicit tie policy and a recorded
   `kindResolution{kind, confidence, evidence}`), and name the exact briefs that must flip, with the input
   that must still resolve as it does today.
2. **The corpus.** Every non-`app` kindFit unit today is a **mis-stamp**, so the pins measure the wrong
   thing. Specify the honest per-kind corpus (which real emitted tree per kind, or a new fixture) and the
   re-stamping step.
3. **The injection.** Your measured insertion point: `codegen.server.ts:2286`
   (`p6SynthesisChunkUserPrompt`) — a ~1 KB project-stable `DELIVERY KIND` block after `BRIEF:` and before
   the volatile `TYPE SIGNATURES` block, under the 60,000-char / 32,000-token caps. Specify its content and
   what the second site (`prompt-engine.ts:262`/`:419`, the kind-blind six-key expansion envelope) needs.
4. **The three holes** an honestly-resolved kind must be threaded through:
   `scripts/rapidtool-cli.mjs:1632` (the inert `kind` flag), `src/lib/engine.ts:4073` (the keyed-only
   stamp), `src/lib/headless.ts:6602` (`(kind: undefined)`).
5. **The gates.** Which DoD criteria must bind per kind so a kind-mismatched product cannot seal, and how
   `kindFit` is pinned per kind.
6. **Sequencing.** Which lane does which file, in what order, with the done-when for each — ready to become
   `wave_plans/W359/*`.

## Evidence bar

Every claim cites `file:line` + the command or read; every absence claim carries its zero-result query;
where a lane's log and the bytes disagree, the bytes win. State what you could not determine.

## Do not

- Do not edit any product file, doc, script, the register, or another lane's log.
- No keyed LLM call. Do not run the full gate (the parent runs the boundary). No git writes.

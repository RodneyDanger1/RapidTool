# 339 wave (W53) — parent / boundary record

**Boundary owner:** parent. **Opened** 2026-10-02 at HEAD `c4348f4`, tree clean. **Six coding lanes,
then three verifier-driven repair resumes, then two independent verifiers.** Logs:
`fixes/339_1_oracle-harness.md` … `fixes/339_8_verifier-b.md`.

The owner's question this wave: *"what is truly preventing RapidTool from being an autonomous software
factory?"* The answer is now measured, not argued — and the machine-fixable half is closed.

## 1. Boundary gates

| Gate | Result |
|---|---|
| typecheck | **exit 0** (both legs) |
| lint | **exit 0**, 0 warnings |
| assertionGaps | **exit 0** |
| tests | **scripts 411 / lib 3035 tests / 0 fail / 2 skipped** (gate of record: `scripts 411 pass 0 fail`, `lib 3033 pass 0 fail 2 skipped`) |
| build | **exit 0** |
| `gate.sh` | **`ok:true`, `flakes: []`, `hardFails: []`** |

Baseline at open: `scripts 411 + lib 2942`. **+93 lib tests.** Diff: **28 files, +2822 / −195.**
**No tracked file deleted** (independent audit, §3.7: baseline 2066 = current 2066; `git stash` empty).

## 2. What the six lanes settled

- **339-1 Oracle harness** (`verify.server.ts`): aligned `sanitizeOracleExpression` with the grammar the
  oracle prompt actually asks for; the rejection reason is now named verbatim (case id + expression +
  reason); added call-site name-binding enforcement; **then fixed the decisive blocker in §4** (the
  harness could not compile TypeScript); then closed a false-attestation vector the verifier found (§3.1).
- **339-2 Oracle generation** (`codegen.server.ts`): contracted the machine oracle to the module's
  **measured export surface** (`oracleContractNames`, not the plan's signature list); fed the previous
  cycle's refusal into the PRIMARY synthesis prompt so cycle N+1 is informed by cycle N; raised the
  refusal-context and detail caps (200→1200 / 160→1200, head+tail with a visible elision). Then closed
  the `exportedNamesOf` over-rejection gap (§3.3).
- **339-3 Criteria** (`dod.ts`, `judgment.ts`, `maker-score.ts`): decided the `p6-brief-fit` floor
  question honestly — a keyless floor project **can never and must not pass**, so the criterion now
  **names the state** (`deterministic floor state — no keyed model synthesis ran` / `keyed model
  synthesis ran but no cycle was accepted (p6.synthesis.refused)` / `generated source is missing …`)
  while the 0.35 bar, the probe logic and the evidence hash are unchanged. Fixed a real bar divergence:
  `maker-score.ts` scored the same criterion at `0.5` while claiming "verbatim" parity with `dod.ts`'s
  `0.35`; aligned to `0.35` with a boundary test.
- **339-4 Envelopes** (`prompt-engine.ts`, `llm.ts`, providers): documented the provider's real
  structured-output contract (a `json_object` **mode request**, not schema enforcement — no
  `json_schema` claim anywhere) and made the spec envelope refuse a non-conforming reply after one
  bounded repair with `RT_E_VALIDATION`. Then tightened element-type validation (§3.2).
- **339-5 Packet** (`packet.ts`, `handoff.ts`): the packet now carries the persisted generated artifact
  census, names the **emitted contract path** `tests/oracle.spec.ts` (not a raw spec-graph node path),
  and states the exact runnable continuation (`from the emitted tree root: npm install → npm run
  typecheck → npm test`). DoD rows render the augmented criterion.
- **339-6 Spine** (`verify.ts`, `entry-oracle.ts`): closed hollow-`passed` minting (present-but-empty
  `cases` / empty evidence) and vacuous entry-oracle pins (empty `expectStdout`/`expectStderr`,
  non-integer `expectExit`). Proved the learning loop is real **through the model boundary** with a
  bounded keyed A/B: run 2's real prompt carries the harvested lesson and the emitted spec adds an
  explicit guard of the harvested case (`prompt bytes 2810 → 3149`, `specs byte-identical: false`).

## 3. The independent verification round (verifiers A/B, no trust)

Two adversarial verifiers re-derived every lane's claims in scratch copies (working tree untouched) and
mutation-tested the new tests. They **caught three real defects**, all landed:

1. **A false machine pass (HIGH — honesty contract).** The type-strip fix from §4 used
   `stripTypeScriptTypes` unconditionally. TypeScript's parser reads the valid-JS sequence
   `f(a < b, c > (d))` as a generic call and rewrites it to `f(a(d))`; the harness then ran the
   **corrupted** bytes and could mint `pass:true` for a module whose real `exports` value was `false`.
   Fixed by **parse-first exactness**: a source the JS parser accepts is run **verbatim**; only a source
   the JS parser refuses is stripped. Pinned with the ambiguous-generic byte pin and a colon-bearing pin
   (the verifier's mutation B had shown the old no-op pin did not catch a colon-eating stripper).
2. **Silent spec defaults (MEDIUM).** `expandedSpecViolations` checked key presence and array-ness but
   not element types, so a reply whose five arrays held `[42, null, {}]`-shaped garbage was accepted on
   the first call with silent `[]` defaults — contradicting its own "never defaulted" comment. Fixed to
   validate every element as a non-empty string (all six keys are string arrays per the consumers), with
   the explicit-`[]` allowance and extra-key tolerance documented and pinned.
3. **An over-rejection vector (LOW-MEDIUM).** `exportedNamesOf` missed computed CJS export forms
   (`module.exports['x'] =`, `exports["x"] =`, `module.exports = ident`, `Object.assign(module.exports,
   {…})`), so a module mixing a recognised export with a computed one dropped the computed name from the
   oracle contract and a real export could be flagged undefined. Fixed in the shared helper, with the
   boundary discipline (109 T-08 / 330 P3) preserved and pinned.

Also reported and **not** silently accepted: the name-binding gate still commits a case that only
*reads* an undefined identifier (it degrades to an honest runtime failure, never a false pass — now
narrowed substantially by the value-read extension in §3.1), and the `verify.test.ts` 337-3 fixtures
still permit an *absent* `cases` field to mint `tested` (declared residual, no real-pass path).

## 4. THE DECISIVE EVIDENCE — the unattended journey now completes

The wave's own `doctor` question was *"does RapidTool truly work as an autonomous software factory?"* So
the boundary owner drove the documented agent loop with **zero human input**, a real `.env` key, and the
machine seat only (`--seat autopilot`), on a `statlib` brief.

**Before this wave** (`fixes/338_0_parent.md` §4): the run hard-blocked at P6 (`RT_E_GATE_PENDING`,
`unmet: [p6-verified, p6-brief-fit]`); the keyed P6 synthesis was refused three cycles and the
deterministic floor stood.

**Root cause found by the parent on the real bytes** (`p6.synthesis.refused` detail):
`RT_E_RUNNER_FAILED · … case-1: error ReferenceError: mean is not defined; … (source failed to compile
in the harness)`. The 338 typing fix had correctly made the P6 prompt demand TypeScript annotations —
but `buildHarness` compiles the raw module with `new Function`, a JavaScript-only parser, so **every
typed module failed to compile in the harness**, `__exports` stayed empty, and every oracle case errored.
Probe: `SyntaxError: Unexpected token ':'` → `ReferenceError: mean is not defined`. A typed module could
never verify; `p6-verified` could never mint `tested`; `p6-brief-fit` is coupled to it.

**Two runs after the fix, both unattended, both on the final tree:**

| Run | Result |
|---|---|
| 1 | `phase 12` · `status: complete` · `failedGates: []` · `sealedWithFailures: false` · `emit --run --require-verified` **exit 0** |
| 2 | same, plus `p6.synthesis: LLM module machine-verified · 1 iteration · 10/10 machine-run cases passed on iteration 1` · `p6.journey.converged` |

`lastTest` (run 2, verbatim): `{ok:true, label:"tested", evidenceHash:"678026713", detail:"tree-run
green: compile 9/9 file(s) · 1 spec file(s) pass · 7 assertion(s) · specs [tests/oracle.spec.ts] · entry
headless pass"}`.

So: a brief now goes in, and a machine-verified, machine-gated, paste-ready delivery comes out with
**no human input at every park**, including P6.

## 5. What is truly preventing "autonomous software factory" — the honest answer

Measured on the emitted tree of the completed run (`doctor --tree`):
`leftoverJobsAreReexportsOrStubs: false`, `inventory {stubs: 0, reexports: 0, real: 1}`,
`autonomousSoftwareFactory: false`, `gaps: [no human-approved fixtures (decidedBy:"human"), no real
multi-job product, product-complete bar not met]`.

The pipeline blocker is **gone**. The flag is still `false` for three reasons, and they are different in
kind:

1. **The human acceptance door is deliberate.** `doctor.ts:400-427` requires `humanFixtures === true`
   (a `decidedBy:"human"` stamp). The machine **drafts the acceptance bar it would be graded against**
   (`brief-fixtures.ts`), so a machine-allowed approval would be a self-certified factory claim — the
   one thing the flag exists to prevent. The 338-4 decision (acceptance stays human; the criterion is
   made machine-**checkable**) stands. `autonomousSoftwareFactory:true` is therefore **intentionally
   unreachable without a human**, and closing it would be dishonest, not progress.
2. **Product breadth.** `no real multi-job product` needs ≥2 real job modules; a single-domain library
   brief yields one (`src/jobs/validate.ts`). This is a brief/product-shape question, not a pipeline
   break.
3. **Product-complete bar** on this brief, plus the declared **no isolation boundary** (the
   node-runner is a bounded timeout + env allowlist — explicitly *not* a sandbox). Both are honest,
   named limits.

Net: RapidTool is now a governed autonomous factory **with one deliberate human acceptance gate**. The
remaining distance to a fully unattended factory is a design decision about that gate, not a defect to
code around.

## 6. Remaining work (next round's brief, precisely)

1. **Human acceptance door:** decide explicitly whether to (a) keep it human and have `doctor` report
   `autonomousSoftwareFactoryExceptAcceptance: true` with that meaning, or (b) build a *real* machine
   acceptance path with genuine provenance and a non-self-graded bar. Do not fake a human stamp.
2. **Multi-job breadth:** find the brief/kind where the census genuinely reaches ≥2 real jobs and record
   it; or make the census semantics explicit for library-kind products.
3. **Name-binding residual:** the value-read gate is now broad, but an absent `cases` field can still
   mint `tested` (the 337-3 fixtures pin it). Bring those fixtures to non-empty case sets so the client
   mint can require one.
4. **The `headless.ts:4085` manual Oracle/CLI seam** can hand a materialized ESM barrel to `runCases`
   (`import`/`export` are not `new Function`-parseable). Named by 339-1, not fixed — needs an ESM→CJS
   transform and belongs to a lane that owns `headless.ts`.
5. Prior-round leftovers that still stand: `.t4scratch/` + dead-module sign-off, `npm run eval --keyed`
   unrun (use `--out <scratch>`), `R11-f01` (dev-server bind), the stale machine-scope key.

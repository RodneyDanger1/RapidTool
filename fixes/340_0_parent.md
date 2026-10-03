# 340 wave (W54) — parent / boundary record

**Boundary owner:** parent. **Opened** 2026-10-03 at HEAD `a097fa8`, tree clean. **Six coding lanes +
two verifier-driven repair resumes, then two independent verifiers, then two more resumes closing the
verifiers' findings.** Logs: `fixes/340_1_mcp.md` … `fixes/340_8_verifier-b.md`.

Owner's brief: *"professionally code and bug-hunt the rest to complete RapidTool … no bad or mock/fake
code, only professionally written 100% working code."* This wave closes the remaining named shells from
`finalsprint.md` and the prior wave's own remaining list, then subjects every claim to adversarial
re-derivation.

## 1. Boundary gates

| Gate | Result |
|---|---|
| typecheck | **exit 0** (both legs) |
| lint | **exit 0**, 0 warnings |
| assertionGaps | **exit 0** |
| tests | **scripts 413 / lib 3112 pass / 0 fail / 2 skipped** (gate of record) |
| build | **exit 0** |
| `gate.sh` | **`ok:true`, `hardFails: []`, `flakes: []`** on the re-run (the first run flaked one scripts test — see the note below) |

Baseline at open: `scripts 413 + lib 2942→3035`. Diff: **22 tracked files + 2 new modules, +2590 / −151.**
**No tracked file deleted** (verifier audit: baseline 2075 = current 2075; `git stash` empty).

> **Flake honesty:** the first `gate.sh` run failed one scripts test (`W49 · 335-4: --help / -h / help
> are a SUCCESS`). Direct reproduction: `--help` exits **0**; the test passes **4/4** when run alone; the
> scripts leg re-runs **413/413/0**. It is a spawn-timing flake under the full-gate load, not a regression
> — recorded here rather than smoothed over.

## 2. What the six lanes settled

- **340-1 MCP runtime client (F1/R8-f11)** — `src/lib/mcp.server.ts` (NEW, 544 lines) + a spawned stub
  server fixture + 23 tests. A real **JSON-RPC 2.0 over stdio** client (MCP `2024-11-05`,
  newline-delimited framing): owner-gated OFF by default (`RT_E_MCP_DISABLED`, no child spawned, no
  `tools` key), `initialize` handshake, id-correlated requests, per-request timeout, the repo's
  scrubbed child-env allowlist, `tools/list` + a read-only `tools/call`. It never fabricates a tool list
  and never reads a tool name from `initialize`; an unlisted or non-read-only tool is refused.
- **340-2 doctor truth** — `awaitingHumanAcceptance` added as a **derived, fail-closed** signal that
  distinguishes the deliberate human-acceptance door from a real defect (a machine-complete-but-unaccepted
  run is now visible to an operator), and the census wording now names the measured single-job case
  (`FACTORY_GAP.singleJob`) instead of mislabelling a one-entry library. It cannot flip the latch and no
  hand-fed field can set it. Surfaced through `headless.ts` so the CLI `doctor --tree` JSON carries it.
- **340-3 verification spine** — closed two hollow-`tested` paths (an **absent** `cases` field; an
  absent/blank `finalSource`) and made an **ESM barrel** refuse with the real coded cause instead of an
  opaque harness compile error, with zero model wire. Found and closed a sibling in the same class, and
  named three residual (non-minting) items.
- **340-4 deterministic cassette (T5.7)** — wired the previously-orphaned `cassette.ts` around **both**
  provider seams: `off`/unset is byte-identical, `record` writes the tape, `replay` serves it with no
  transport call, a miss is a coded refusal with no text, and a two-process record→replay returns
  identical request/result bytes.
- **340-5 headless governance** — lifted the **forced-emit quarantine** into `emitProject` so every
  forced caller moves foreign files aside and reports them (a failed move refuses `RT_E_FOREIGN_FILES` +
  `judgingSkipped`, so no tree-run can mint `tested` over a mixed tree); implemented the **R13-f02**
  classifier review + **pause-before-first-mutation** (a real `wild.plan_review` row and a real park,
  `steps:0`, no mutation first); rendered the stored plan into the production wild prompt so the review
  actually sees the rows; forwarded the quarantine report on the CLI envelope.
- **340-6 emitted UI (A3-f07)** — replaced the emitted webapp **name-dump** with a real, deterministic,
  kind-aware generator driven by the project's spec and the generated entry's real export surface: it
  emits a form whose fields are real domain/parameter names and whose handler calls a name the generated
  module really exports, with the `TODO(A3-f07)` marker removed once the ≥2-domain-field/interaction bar
  was genuinely met.

## 3. The verification round — what it caught, and what was done about it

Two adversarial verifiers re-derived every claim in scratch copies (working tree untouched), plus a
targeted audit of the existing paths.

**Verifier A (new capabilities) — CONFIRMED with two real holes, both now closed:**
1. **MCP protocol-violation handling.** A duplicate id or a garbage line arriving *after* a correlated
   reply resolved left the first `listTools()` returning `ok:true` while the server had committed a
   protocol violation. Closed: a **sticky** `faulted` state on the client (first violation wins, never
   clears), every later request refuses with the original coded reason, and the header now states the
   honest boundary verbatim instead of over-claiming. 23/23 on both runtimes.
2. **Cassette integrity.** The tape bound the *request* but not the *response*, so a swapped response was
   served verbatim; and the provider-agnostic key let a DeepSeek tape serve an xAI-family call. Closed:
   `CASSETTE_VERSION` 1→2 with a `responseHash` verified on load and on serve, the **provider family in
   the canonical key**, and a v1 tape refused with a coded "re-record" reason (no committed tape
   existed). 56/56 + 132/132 provider regressions on both runtimes.
3. Emitted UI, determinism, and the no-module branch: **CONFIRMED** (the verifier imported the emitted
   entry at runtime and executed the generated `synthesize`).

**Verifier B (existing behaviour + census + destruction) — CONFIRMED**, with two stale comments found
(cross-resume drift that *understated* capability): `engine.ts`'s "the production prompt does not render
`wildPlan`" and `quarantine.ts`'s "the CLI no longer forwards the report". Both were corrected at the
boundary. It also named three pre-existing, out-of-wave residuals (below).

**Census (added lines across `src/lib/**` + `scripts/**`, ~2294 lines):** 0 `as any`, 0 `@ts-ignore`
variants, 0 `eslint-disable`, 0 empty `catch {}`, 0 `.only`/unconditional `.skip`, 0 hardcoded-return
fakes; the only `TODO` hits are `TODO(E-15)` **fixture inputs**. Destruction: **2066→2075 tracked, 0
deletions, 0 renames, stash empty.**

## 4. Honest residuals this wave did NOT close (named, not hidden)

- **MCP is not wired to a live consumer.** The transport + read-only round-trip are real and tested, but
  enablement is an owner trust decision; `doctor`/CLI/engine have no MCP surface. Wiring is owed.
- **`coerceFactoryClaim` still honours a hand-fed `humanFixtures:true`** (pre-existing; the function has
  **zero non-test callers**, and the new `awaitingHumanAcceptance` cannot be forged through it).
- **Spine residuals:** `oracleSignatureFunctionNames` (exported, zero call sites), `VerifyOutcome.lint`
  (produced, never read), and `withCommonJsExports` under-covering `async function`/generators (honest
  `NO_CALLABLE_EXPORTS` refusal, no false pass). `import.meta.url`-only ESM falls to the generic compile
  marker (still no false mint).
- **Console/store wild driver** does not stage the plan review (UI surface owed); `types.ts:521` carries
  an unconsumed UI TODO.
- **`.t4scratch/`** (in-repo scratch) cleanup is still owed.
- The declared limits stand: no OS isolation boundary (the node-runner is not a sandbox), and the
  human acceptance stamp is required by design.

## 5. Evidence — the unattended journey still completes

Re-driven after the wave (machine door only, `--seat autopilot`, zero human input): `gate-5 exit 0`,
`phase 12`, `status complete`, `lastTest.label: "tested"`, `p6.synthesis: LLM module machine-verified ·
1 iteration · 11/11 machine-run cases passed`, `p6.journey.converged`, and `emit --run
--require-verified` exit 0.

## 6. Wave log index

`fixes/340_1_mcp.md` · `340_2_doctor-truth.md` · `340_3_spine.md` · `340_4_cassette.md` ·
`340_5_headless-gov.md` · `340_6_emitted-ui.md` · `340_7_verifier-a.md` · `340_8_verifier-b.md`.

## 7. Gate of record

`gate.sh` re-run (all writers stopped):
`{"ok":true,"hardFails":[],"flakes":[],"gates":{"typecheck":{"ok":true},"lint":{"ok":true},
"assertionGaps":{"ok":true},"build":{"ok":true},"testsScripts":{"pass":413,"fail":0},
"testsLib":{"pass":3112,"fail":0,"skipped":2}}}`.
The one first-run scripts flake is documented in §1 and does not reproduce.

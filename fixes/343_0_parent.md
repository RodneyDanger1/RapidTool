# 343 wave (W57) — parent / boundary record + honest evaluation

**Boundary owner:** parent. **Opened** 2026-10-03 at HEAD `73f660a`, tree clean. **Three duo-persona build
lanes (analyst + engineer), three duo-persona bug-hunt lanes, two watchdogs, then four residual resumes.**
Logs: `fixes/343_1_synthesis.md` … `fixes/343_wd2_quality.md`.

**Recon answer up front:** nothing structural blocks RapidTool. The pipeline, governance and wiring are
complete and verified (342 wave); the binding constraint is **keyed synthesis quality** (first-run
`pass@1 = 0.182`, mean 6.09/9). So this wave attacked synthesis quality, context intelligence, and
delivery — the areas competitor agent-factories lead on — and ran an independent bug hunt plus two
watchdogs over the whole tree.

## 1. Boundary gates

| Gate | Result |
|---|---|
| typecheck | **exit 0** |
| lint | **exit 0**, 0 warnings |
| tests | **scripts 427 pass / 0 fail · lib 3261 pass / 0 fail / 2 skipped** (gate of record) |
| build | **exit 0** |
| `gate.sh` | **`ok:true`, `hardFails: []`, `flakes: []`** |

Diff: **34 tracked files, +1839 / −62**, plus 4 new source files and 8 logs. **0 tracked-file deletions**
(tracked 1913, unchanged; watchdogs confirmed).

## 2. Build lanes (competitor-informed, each analyst→engineer)

- **343-1 Synthesis quality — best-of-N with the pipeline's own gates as selector.** Analyst shortlist
  (mined the repo's own competitor research first, then live citations incl. SWE-agent's `ChooserRetryLoop`,
  CodeT, AlphaCode, Aider's lint/test loop) picked *lazy best-of-N*: new `src/lib/synthesis-policy.ts`
  (`resolveSynthesisCandidates` default **1 = byte-identical**, cap 4; `selectBestOfN` stops at the first
  gate-clean candidate) wired into both P6 paths. **Measured (keyed):** the primary sample failed the real
  `tsc` (`TS2323`), an independent resample was selected and **sealed** — recorded in a
  `p6.synthesis.candidates` event. Pareto: when the first sample passes, N=4 costs the same 1 call.
- **343-2 Context intelligence — a deterministic repo map, wired to the packet and the UI.** New
  `src/lib/repo-map.ts` (masked lexical scan, in-degree + export count + role rank, hard char budget with
  a visible elision marker, never invents a symbol) now renders a bounded `## Repo map` section in the
  Agent Packet and a console card (browser-verified desktop + mobile). Aider's repo-map idea, without a
  new subsystem.
- **343-3 Delivery — git landing for the emitted product.** `gitLandEmitted` + `emit --git`: one
  Conventional-Commits commit staged from the emitted manifest only, idempotent, foreign files reported
  and never committed, and the **RapidTool repo structurally un-landable** (HEAD asserted unchanged
  before/after). Proved on real temp repos.

## 3. Bug-hunt lanes (senior sweeps + mutation-tested teeth)

- **BH-1 pipeline/engine/governance.** Three **false user-visible claims** fixed (phases.ts P2 summary and
  `dod.ts` CAPABILITIES said the durable checkpoint layer was "unwired" when it has been wired since
  341/342 — the claim renders into the packet and prompts); a real **test-teeth gap** closed (the
  checkpoint read guard's out-of-graph integer bound was never pinned — the mutant survived; now killed).
  Added-`slice` regression 687/687.
- **BH-2 model/verification layer.** **F1 (Medium, security): a cross-origin redirect forwarded the
  `Authorization` header** — i.e. the API key — to a different origin, against standard fetch behaviour;
  fixed with `stripCrossOriginSecrets` and a real two-server reproduction. **F2:** the OpenAI-family
  adapter dropped `prompt_tokens_details.cached_tokens` (usage under-count); fixed. **8/8 mutations
  killed** (key precedence, cassette response hash, retry set, env-allowlist secret, MCP frame refusal,
  cassette key family, verify no-callables gate, entry-oracle `complete`).
- **BH-3 UI/routes/tooling.** **F2 (Med): prototype-key lookup crash** —
  `designTokens({domain:"constructor"})` threw `TypeError` (free-text domain reaches the table); fixed
  with own-key lookups (also `diagram.kindTheme`). F1 ring-hydration bounds re-applied; F4 unhandled
  promise in the sign-in click path; F5 census re-count; F6 an unfalsifiable boundary pin made real.
  Browser-verified desktop + mobile, 0 console/page errors.

## 4. Watchdogs (non-mutating overseers)

- **WD-1 destruction/ownership:** 30 polls over ~50 min. **One non-destructive alert:** a reflog
  `reset: moving to HEAD` at 09:57:20 — target HEAD never moved, `git ls-files --deleted` = 0, tracked
  1913 unchanged, all lane work present; consistent with an unstaging, not a `--hard`. **No ownership
  violations, no mass rewrites, no deletions, stash empty.** Final: GREEN.
- **WD-2 quality/claims:** five full-diff scans; **0 prohibited constructs** throughout; `tsc` and
  `eslint` at **0** on the settled tree; three alerts raised mid-wave (test-first WIP tsc errors, two
  unused-symbol warnings, the undocumented `--git` flag) **all cleared by the writers' own bytes**; 8/8
  independent spot-checks **CONFIRMED**; test teeth confirmed by mutation (best-of-N cap/laziness, the
  sign-in guard).

## 5. Residuals landed after the eight (cross-lane)

- **Repo map → P6 synthesis prompt (343-2's STOP, landed by 343-1):** a bounded, conditional
  `REPO MAP …` block appended to the chunked primary prompt; **no-tree prompts proven byte-identical**;
  no pin moved. Plus **rule 11 now names TS2323** (the class the keyed probe actually hit).
- **BH-2's F4/F3:** the MCP frame cap is now enforced in **real UTF-8 bytes** (a multibyte frame the old
  `String.length` check admitted at 489 "bytes" is refused at 1289) with an O(1) running counter; the
  harvest search leg now honours the **real remaining wall-clock budget** and emits a coded
  `RT_E_BUDGET_EXHAUSTED` note on an overrun (the "12 s" claim is now true for production seams).
- **Doc:** `emit --git` documented in the CLI synopsis (WD-2 caught the drift; closed).

## 6. Remaining (honest)

- **Synthesis quality is still the constraint.** Best-of-N is an *amplifier*: it buys independent
  attempts and keeps only gate-clean ones. Its fixture-level pass-rate delta is **not yet measured** (§7).
- The single-module lane's prompt and the bounded repair re-prompt do not yet carry the repo map (the
  chunked primary does); a one-wrapper change.
- Reported-not-fixed (all low, none wave-introduced): `chat.ts` identity-validator envelope; `vault`
  hostile input; `diagnose` rule-7 dead branch; `knowledge` NUL fingerprint delimiter; the DeepSeek vs
  OpenAI-compatible retry-set asymmetry; the `strictPort` dev-server collision (a lane could not start a
  second `npm run dev`).
- Unchanged declared limits: no OS isolation; the human acceptance stamp is required by design; MCP
  owner-gated; failover unarmed by evidence.

## 7. Keyed re-measure + gate of record

**Gate of record:** `{"ok":true,"hardFails":[],"flakes":[],"gates":{"typecheck":ok,"lint":ok,"assertionGaps":ok,
"build":ok,"testsScripts":{"pass":427,"fail":0},"testsLib":{"pass":3261,"fail":0,"skipped":2}}}`.

**Keyed eval (best-of-N lever ON, `P6_SYNTH_CANDIDATES=2`):** appended below when the run finishes.

## 8. Wave log index

`fixes/343_1_synthesis.md` · `343_2_context.md` · `343_3_delivery.md` · `343_bh1_bughunt.md` ·
`343_bh2_bughunt.md` · `343_bh3_bughunt.md` · `343_wd1_watchdog.md` · `343_wd2_quality.md`.

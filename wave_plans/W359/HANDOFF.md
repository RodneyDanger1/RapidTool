# W359 — HANDOFF (PAUSED 2026-10-15)

**The wave was paused mid-flight at the owner's request.** Everything on disk was committed and pushed.
This file is the authoritative record of **what landed, what is half-done, and what is left**, per lane
and per file. Every claim about a file cites its observed state (mtime / byte evidence); every claim a
lane made about itself is marked as a **lane claim** until a boundary re-derives it.

**Tree state at the pause:** `npx tsc --noEmit` → **exit 0** (no `error TS` lines), so nothing was left
syntactically broken. 19 modified files carried a one-line marker comment
`W359 PAUSED 2026-10-15 — … see wave_plans/W359/HANDOFF.md`; `scripts/quality-ratchet.floors.json` was
skipped because **JSON cannot carry a comment** (it was verified to still parse).

**Not verified by the parent:** no boundary was run after the pause, so the lane-reported test numbers
below are the lanes' own claims. **Re-derive them at the next boundary before trusting them.**

---

## 1. Lane status at the pause

| lane | state | evidence | what is left |
|---|---|---|---|
| `kind-gate` | **LANDED (the wave's P0)** | `fixes/359_kind_gate.md` (7,991 B) is filled in with before/after tables; it reports `scaffold.test.ts` **144/144**, `codegen.server.test.ts` **331/331**, `tsc` exit 0 | Re-derive at a boundary. Its per-kind before/after (kind `tool`/`service`/`library` from exit 2 with 167 errors → **exit 0**) is a **lane claim** until then. |
| `resolve-kind` | **LANDED, with 6 disclosed residuals** | `fixes/359_resolve_kind.md` (18,519 B) is filled in, incl. an explicit residual list | The 6 residuals in its §6 (below). Corpus calibration is explicitly deferred to `kind-corpus`/a measurement job. |
| `inject-kind` | **LANDED, with residuals** | `fixes/359_inject_kind.md` (15,533 B) filled in, incl. an **encoding incident and its repair** | Its §4 residuals: the prompt change is unmeasured on a real keyed run (by construction), `prompt_cache_hit_tokens` gain is a placement argument not an observed number, and whether a model obeys the per-kind REQUIRED rows is run-side. |
| `thread-kind` | **HALF-DONE, log not filled in** | its files moved: `scripts/rapidtool-cli.mjs` 16:55:51 · `src/lib/headless.ts` 16:59:34 · `scripts/README-cli.md` 17:02:43. Its log `fixes/359_thread_kind.md` is **still a skeleton** — all six sections read `_skeleton._` | **All four jobs need their state established from the bytes:** (1) the CLI `--kind` wire on `create` (`rapidtool-cli.mjs:1632`), (2) `headless.ts:6602` printing the resolved kind, (3) `headless.ts:6427` `promptExpand` carrying the kind, (4) the **dead gate seam** `stampEmittedSurfaceForGate` (`headless.ts:5855`) — wired, or recorded as a named defect. Nothing is documented, so assume nothing. |
| `kind-corpus` | **HALF-DONE, log not filled in** | it created `testruns/kind-corpus/units.json` **and a real emitted tree** `testruns/kind-corpus/arcade-breakout/emitted/**` (a genuine `index.html`/`package.json`/`tsconfig.json`/`vite.config.ts` tree). It modified `scripts/quality-ratchet.mjs` (17:17:06), `quality-ratchet.test.mjs` (17:10:02), `quality-ratchet.floors.json` (17:11:40). Its log is a **skeleton with all four jobs `_pending_`** | All four jobs: (1) the per-unit honest/mis-stamp verdict table, (2) the per-kind coverage matrix, (3) each pin **able to fire** with a planted `floor − 1` proof, (4) `realProductOnly` re-verified over `src/**`. Because the floors file and the reader both moved without a log, **the next session must diff those three files against `HEAD` first** to learn what was actually changed. |
| `cartographer` | **NOT STARTED** | no `research/multiagent/359_cartographer.md` exists | The whole lane: verify all five lanes adversarially, map the wave's regressions, and re-measure the P6 wall into a **W360 lane plan** (its §JOB 3 mandate). |

**Successful recovery worth recording:** `inject-kind` mangled `src/lib/prompt-engine.ts` while editing
(248 mojibake lines, CR on every line, 603/409 diff lines), diagnosed it, restored the file
**byte-faithfully from the `HEAD` blob** (no git write) and re-applied only its own block with LF/UTF-8
tooling, then normalised EOLs. Post-repair `git diff --numstat` = **191 insertions / 0 deletions** and
38 spurious cross-suite failures vanished. The lesson: **edit EOL-sensitive files with explicit encoding,
never through a naive reader/writer.**

---

## 2. The files left mid-flight (each carries an in-file marker)

| file | its lane | state |
|---|---|---|
| `src/lib/scaffold.ts` · `src/lib/scaffold.test.ts` | `kind-gate` | landed (P0) |
| `src/lib/engine.ts` · `engine.test.ts` · `src/lib/types.ts` · `src/lib/dod.ts` · `dod.test.ts` · `scripts/run-eval.mjs` · `run-eval.test.mjs` | `resolve-kind` | landed + residuals |
| `src/lib/codegen.server.ts` · `codegen.server.test.ts` · `src/lib/prompt-engine.ts` · `prompt-engine.test.ts` | `inject-kind` | landed + residuals |
| `scripts/rapidtool-cli.mjs` · `src/lib/headless.ts` · `scripts/README-cli.md` | `thread-kind` | **half-done, undocumented** |
| `scripts/quality-ratchet.mjs` · `quality-ratchet.test.mjs` · `quality-ratchet.floors.json` · `testruns/kind-corpus/**` | `kind-corpus` | **half-done, undocumented** |

---

## 3. How to resume (recommended order)

1. **Diff the undocumented files against `HEAD` first** — that is the only way to learn what
   `thread-kind` and `kind-corpus` actually did:
   ```powershell
   cd "C:\Users\mnril\Desktop\RapidTool Main"
   git diff HEAD -- scripts/rapidtool-cli.mjs src/lib/headless.ts scripts/README-cli.md
   git diff HEAD -- scripts/quality-ratchet.mjs scripts/quality-ratchet.test.mjs scripts/quality-ratchet.floors.json
   ```
2. **Run the two legs that decide the wave**, then the full boundary (which is now the only thing that can
   promote any of the above from "lane claim" to fact):
   ```powershell
   npx tsc --noEmit
   node --experimental-strip-types --test --test-reporter=tap src/lib/scaffold.test.ts src/lib/codegen.server.test.ts
   node scripts/quality-ratchet.mjs --all
   & 'C:\Program Files\Git\bin\bash.exe' scripts/gate.sh
   ```
   **Expected if `kind-gate` is right: the first fully green boundary of the campaign.** The single
   previously-failing test was the kind-fidelity pin, and that lane reports it green.
3. **Then finish `thread-kind`** (four jobs, §1) — the dead gate seam is the highest-value item because a
   dead seam makes the DoD gate read the *synthesized* surface, which can produce a **false refusal**.
4. **Then finish `kind-corpus`** (four jobs, §1) — without honest per-kind units, the whole wave's
   improvement cannot be measured.
5. **Then dispatch `cartographer`** to verify and produce the W360 plan.
6. Re-read `wave_plans/W359/README.md` for the lane mandates and the parent's amendments, and
   `NEXTSTEPS.md` §7 for how W359 sits in the remaining waves.

---

## 4. Residuals handed back (not this wave's to fix)

From `resolve-kind` §6, disclosed rather than worked around:
1. **The keyword table needs calibration from measurement**, not opinion — the per-kind emits from
   `kind-corpus` are the input.
2. `src/lib/sandbox.ts:509` carries a comment naming the resolver's **old identifier** (`engine.DELIVERY_KIND_KEYWORDS`); the file is not owned by that lane, so the comment is stale by one name.
3. `src/lib/scaffold.ts:8269`'s README note will now render "declared kind" for a **resolved** kind — a
   wording item in `kind-gate`'s file.
4. The `app`-kind surface contract for briefs that declare no page noun is unchanged (`none`), so
   `p6-web-surface` imposes nothing on them. Binding that contract is `kind-gate`'s mandate.
5. The emitted trees were not regenerated, so no end-to-end emit was re-scored.
6. The quality ratchet was not run by that lane (the boundary owns it).

From `inject-kind` §4: the prompt change is unmeasured on a real keyed run; the cache-hit improvement is
a placement argument; model obedience to the per-kind REQUIRED rows is run-side.

# W12 · WATCHDOG 1 — close out the LAST run (`deleg_cbb4ad83`, W11) against the bytes

**Read this file FIRST.** Then `AGENTS.md`, `RESUME.md` §5.4 + §13 (how to prove a claim),
`wave_plans/W11/README.md` (the ownership map and each lane's declared deliverable), each
`wave_plans/W11/lane-N.md`, and `fixes/216z_w10_landing_record.md` (the standard the parent used to
verify the previous wave — match that quality).

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2, git-bash /c/Users/mnril/Desktop/RapidTool Main).
PATH HAS A SPACE → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
MANDATORY RULES (the parent rejects violations):
1. YOU ARE READ-ONLY ON `src/`, `scripts/`, `wave_plans/` and every existing doc. You may WRITE ONLY
   your report file (below). You fix NOTHING — you report with evidence.
2. PATCH-ONLY for the report file (create it once with write_file, then `patch` to extend).
3. NEVER run git checkout/stash/reset/clean/commit.
4. Your only allowed heavy command is a targeted test run:
   `node --experimental-strip-types --test --test-concurrency=2 <file>`. NO `npm run typecheck`,
   NO `npm test`, NO `npm run build` — other lanes share this 8 GB machine right now.
5. Every claim needs a command you actually ran + its real output. If you cannot verify something,
   write UNVERIFIED and say what you tried. A watchdog that over-claims is worse than none.
6. Landing log / deliverable: `fixes/217h_w11_verification_register.md`
```

**Mission.** W11 (`deleg_cbb4ad83`, 6 lanes) has just stopped. Two lanes reported **complete** (L2
watchdog, L3 researcher), two reported **partial**: L4 ("STATUS: INCOMPLETE — ran out of tool
budget mid-task") and L5 ("both items LANDED, final gate + log fill NOT completed"), L6 reported
green, and L1 reported later. **Lane self-reports are not evidence.** Build the register that tells
the parent exactly what is on disk, what is claimed-but-absent, and what must be repaired before W11
can be closed. This is the "help with the last run" deliverable: the parent will repair from your
register, so it must be precise enough to act on without re-doing your work.

## Numbered plan

1. **Create the report skeleton FIRST** (per-lane sections + a bottom-line table), then fill as you go.
2. **Baseline the tree**: `git status --short`, `git diff --stat | tail -30`, and the mtime of every
   file each W11 lane claimed. Paste the raw output. This is the frozen evidence for your verdicts.
3. **Per lane, verify every declared deliverable against the bytes.** For each item below: find the
   symbol/string, paste the `grep -n` line, and mark **VERIFIED / PARTIAL / ABSENT / UNVERIFIED**.
   - **L1** (`wave_plans/W11/lane-1.md`): is `verifyKindDir` still async with the install leg? Does
     `tree-run`'s `project` block now carry a **`build` verdict** (T-18)? Are the install-leg tests
     present in `compile-check.server.test.ts`? Run that suite and paste the tail.
   - **L2**: `src/lib/honesty-guards.test.ts` exists (207 lines reported) — run it; does it pass? Do
     its assertions actually have teeth (spot-check 3 of them against the source they pin)? Does
     `fixes/217b_watchdog_verification.md` contain the isolation probe (`docker`/`bwrap`/`wsl`)
     results with raw output?
   - **L3**: `fixes/217c_phase5_spec_and_decision_register.md` — spot-check **5** of its `file:line`
     anchors against the real files. Any stale anchor is a finding. Is the T5.6/T5.8 decision
     register present and honestly marked user-owned?
   - **L4** (reported INCOMPLETE): `scripts/rapidtool-cli.mjs` — is the G1 fix present (the
     `makeLoader` guard/catch must **return** the `respond(...)`, not fall through)? Reproduce it
     yourself: run `summary --project C:/nonexistent_nope.json`, `packet --project C:/nonexistent_nope.json`
     and bare `summary` — capture stdout, stderr and the exit code for each, and state whether the
     output is ONE coded JSON object with NO `TypeError` stack (the audit's G1 symptom). In
     `src/lib/headless.ts`: does `nextAction` exist, is it exported, is it on `ProjectSummary` and in
     `summary()`'s return, and does `src/lib/headless.test.ts` cover each arm (list the arm names you
     can find)? Run `headless.test.ts` and paste the tail. List every item from the lane brief that
     is **missing** — that list is the repair order for the parent.
   - **L5**: `src/lib/engine.ts` — does the `runPhaseAsync` catch now log an honest warn row instead
     of swallowing (grep the new event name and paste the catch block)? `src/lib/scaffold.ts` — is a
     `.gitignore` emitted (grep the push site) and is it asserted in `scaffold.test.ts`? Run
     `lesson-writers.test.ts` and `scaffold.test.ts`; paste both tails. Is `fixes/217f_…md` complete
     or a skeleton (report its length and whether it has the final-gate section)?
   - **L6**: `src/components/console.tsx` — verify the three S1 fixes by grep (the `a`-shortcut
     override guard, the dialog-open guard, the shared execute predicate) and the compaction items
     (Crew empty state, per-tab hints, legend from `SHORTCUTS`, second shortcut binding). Is
     `fixes/217g_…md` complete? Report each as PRESENT/ABSENT with the line.
4. **Cross-cutting checks** (these catch what per-lane checks miss):
   - Does the tree still hold together? Run ONLY these targeted suites, in this order, and paste each
     tail: `errors.test.ts`, `knowledge.test.ts`, `scaffold.test.ts`, `lesson-writers.test.ts`,
     `headless.test.ts`, `token-ledger.test.ts`, `compile-check.server.test.ts`,
     `honesty-guards.test.ts`. (NO typecheck — the parent runs the single full gate at the boundary.)
   - **Ownership violations:** did any lane write outside its declared files? Compare each lane's
     claimed edits against `wave_plans/W11/README.md`'s ownership table and list every file modified
     that no lane owned.
   - **Unbacked claims:** for each lane, name one claim from its summary that you could NOT verify
     and say exactly what you tried.
5. **Bottom line at the top of the report:** a table `lane → verdict → blocking repair (if any)` and
   then the **ordered repair list** for the parent (most-blocking first), each item phrased as a
   concrete action with file:line. Keep your own test-count numbers separate from any lane's claimed
   numbers, and never restate a lane's number as if you measured it.

# W11 · LANE 2 — Watchdog: independent verification + the honesty guard tests

**Read this file FIRST, before any other file.** Then `AGENTS.md`, `RESUME.md` §5.4
(honesty invariants) + §13 (how to prove a claim), and `fixes/216y_oracle_and_error_audits.md`
(the audit you inherit — its §2.3 defect ledger G1–G7 is your checking list).

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2). HOST QUIRK: the path contains a SPACE,
so search_files/ripgrep FAIL — use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
Read `AGENTS.md` at the repo root FIRST (the repo's own contract).
Read `RESUME.md` at the repo root (session handoff: gate contract + hard rules), `taskuniverselog.md`
(the live task-status board — check YOUR task's current status there), and the research dossier
named in your task (each fix is already specified with file:line and a done-when — your job is to
ENACT it, not re-derive it).

MANDATORY WORKING RULES — the parent will reject violations:
1. PATCH-ONLY on existing files. Use the `patch` tool with small targeted old_string/new_string edits.
   NEVER use write_file to rewrite an existing file. Re-read the exact region immediately before
   patching (line numbers drift as siblings edit).
2. NO mock, demo, stub, placeholder or TODO code. Production quality only, real working logic, same
   code style as the file (explicit `.ts` import extensions; TSDoc comments carrying the finding id).
3. NEVER run `git checkout`, `git stash`, `git reset`, `git clean`, or `git commit`. Another agent's
   work may be in the tree; reverting is the parent's call, not yours.
4. Do NOT run the full `npm test` or `npm run build` — siblings are mid-edit and the repo rule is
   never to run the full gate while agents are editing. Verify with:
     npm run typecheck
     node --experimental-strip-types --test <your test file(s)>
   Both must pass before you claim done.
5. Stay strictly inside your owned files. If a fix needs a change elsewhere, STOP and REPORT it —
   do not make it.
6. Every claim in your report must be backed by a command you actually ran and its real output.
   NEVER invent test counts or results. If you run out of budget mid-edit, SAY SO PLAINLY and describe
   the real state — an honest "incomplete, does not typecheck" is far more valuable than a claimed
   green. (A lane in the previous wave did exactly this and it is the reason a broken tree was caught
   immediately.)
7. If an existing test pins the OLD (buggy) behaviour, you may update it deliberately — but record
   old → new in your log with the reason, and NEVER weaken an assertion or delete a test to get green.
8. Write your landing log at the path given in your task (you are its ONLY writer). Record: task id,
   what changed, file:line, the command you ran, the observed result.
```

**Your owned files (ONLY these — you are the wave's READ-ONLY-ON-SRC lane):**
- `src/lib/honesty-guards.test.ts` (NEW file — create it)
- `fixes/217b_watchdog_verification.md` (NEW file — create it)

You may READ any file. You may WRITE only those two. **You fix nothing in `src/`.**

**Persona.** You are the watchdog: the lane whose only loyalty is to the bytes on disk. A
sibling's summary is a self-report, not evidence. If a claim cannot be reproduced by a command
you ran, record it as UNVERIFIED with the command you tried.

---

## Your numbered plan

1. **Write both file skeletons first** (log title + numbered sections; the test file with its
   header comment, imports, and an empty `describe`). A watchdog that dies mid-verification
   must still leave its findings on disk.
2. **Verify the W10 landings against bytes** (the parent believes these landed; falsify or
   confirm each with a command, and say which):
   - **T-11 green-seal gate.** Re-run the red-seal probe the W10 evidence names:
     `cd /c/Users/mnril/w9l5_scratch && node --experimental-strip-types probe_a_red_seal.mjs`
     (if that scratch dir is gone, replicate the probe against the current `engine.ts` with a
     small script you keep OUTSIDE the repo, e.g. under `C:/Users/mnril/w11l2_scratch/`).
     Expected after W10-L1: NO `lesson.capture` ledger event on the red seal; a
     `p<N>.seal.unmet` **warn** log instead, carrying the unmet DoD **probe ids**. Record the
     raw JSON you observed.
   - **`probe:<id>` tags.** `grep -rn "probe:" src/lib/knowledge.ts` and confirm the tag is
     derived from the row's own `failureSignature` anchors (so every existing writer inherits
     it) — then prove at least one writer emits it, via a targeted run.
   - **Token-ledger cache fields (T-107.6).** Read `src/lib/token-ledger.ts` and confirm the
     legacy 3-key spend shape is byte-identical when no cache sample is reported (the test at
     `src/lib/token-ledger.test.ts` asserts this — run that suite and paste the real tail).
   - **Runner output cap (T-107.6).** Confirm `clampRunnerOutput` is actually WIRED into
     `runNodeBounded` (not just exported) and that an under-cap stream leaves the envelope
     byte-identical (no `outputClamp` key). Run `src/lib/node-runner.server.test.ts`.
   - **verify-kind install leg (T4.1/TA-16).** Confirm the leg never fabricates: the seam path
     must be marked `mocked: true`, and a no-`build` tree must return the honest skip.
3. **Probe the isolation question that gates T-107.8** (216y / `remainingwaves.md` §W11): is a
   real isolator available on this host? Run and record the raw output of each:
   `docker --version`, `docker info` (report only whether a daemon answered),
   `bwrap --version`, `wsl.exe --status`. **Conclusion must be one of the two honest states:**
   either a real isolator IS available (name it, version, and the exact probe), or it is NOT —
   in which case `sandbox-policy.ts`'s claim stays exactly as it is and T-107.8 stays skipped.
   Never soften the wording; never claim a sandbox.
4. **Write the honesty guard tests** in `src/lib/honesty-guards.test.ts`. These are
   *behaviour* pins for invariants the repo calls non-negotiable (RESUME §5.4) — additive, no
   production code touched. Each test must be able to FAIL for its own reason (no tautologies —
   `scripts/check-assertion-gaps.mjs` is a gate and will catch you). Cover at least:
   - a red seal (`complete` phase with an unmet gate) mints **no** lesson row, while a green
     seal still mints through the normal path;
   - a lesson row built from a signature carrying anchors exposes `probe:<id>` tags, and an
     anchor-less signature exposes none;
   - `clampRunnerOutput` is a no-op below the cap and COUNTS what it elides above it (assert
     `elidedChars === originalChars - text.length` after accounting for the marker);
   - `verifyKindDir` on a non-`package.json` dir is `RT_E_VALIDATION` + `ok:false`, and the
     no-`build` case is `ok:true, skipped:true` (an absent script is never a pass).
   Import only from `src/lib/*.ts` (explicit `.ts` extensions). Keep the file under ~200 lines
   and make every assertion specific enough that a reader can see what breaks if it fails.
5. **Record the 216y defect ledger's live status** in your log: for each of G1–G7, state
   whether it is still reproducible today, the command you ran, and the raw result. G1 is
   being fixed concurrently by W11-L4 — verify it AFTER L4's patch is on disk if it is; if it
   is not yet, record the pre-fix behaviour with a timestamp so the parent can attribute it.
6. **Report, do not fix.** Any new defect you find gets: file:line, the command that showed
   it, the raw output, the blast radius, and a proposed fix — in `fixes/217b_watchdog_verification.md`.
7. **Re-run** `npm run typecheck` and
   `node --experimental-strip-types --test src/lib/honesty-guards.test.ts`, paste the real tail
   into the log, and state the final test count.

**Bias rule:** when the evidence is ambiguous, call it UNVERIFIED. A watchdog that over-claims
is worse than no watchdog.

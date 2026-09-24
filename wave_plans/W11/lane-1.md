# W11 · LANE 1 — Software engineer: T-18 tree-run `build` verdict + the owed verify-kind tests

**Read this file FIRST, before any other file.** It is your plan. Then read `AGENTS.md`,
`RESUME.md` (§5 hard rules), `fixes/216x_t11_verification_and_108t7_spike.md` §2 (the T-18
spec), and `wave_plans/W10/lane-3.md` (what the verify-kind leg was supposed to be).

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

**Your owned files (ONLY these):**
- `src/lib/compile-check.server.ts`
- `src/lib/compile-check.server.test.ts`

**Landing log (your ONLY write outside the two files above):**
`fixes/217d_verify_kind_leg_tests_and_tree_run_build.md` — write the skeleton FIRST (title +
section headings + "status: in progress"), then fill as you go.

---

## Context you can rely on (verified by the parent on 2026-09-24 — do not re-derive)

1. **W10-L3 landed a real install leg** in `verifyKindDir` — it is now
   `export async function verifyKindDir(dir, opts?: { timeoutMs?; installTimeoutMs?;
   installCommand? }): Promise<VerifyKindResult>` (search for `export async function
   verifyKindDir`; the line moved, do not trust a line number). It: refuses a non-dir /
   no-`package.json` dir with `RT_E_VALIDATION`; skips honestly when there is no `build`
   script; otherwise `mkdtempSync` scratch-copies the tree (skipping top-level
   `node_modules` + `.git`), resolves the install tool via `installToolFor(copy)`
   (`npm ci` when `package-lock.json` present, else `npm install`, both `--no-audit
   --no-fund`), runs it through `runNodeBounded` with its own timeout, then runs the
   tree's declared `build`/`test` scripts. `opts.installCommand` is a **test seam** and
   MUST be labelled `mocked: true` on the returned verdict (never evidence of a real
   install). The whole block has a long `216z` contract comment — read it.
2. **The parent already repaired the two stale sync calls** in
   `src/lib/compile-check.server.test.ts` (`describe("B1 verifyKindDir")`): both now
   `await verifyKindDir(...)` and the first asserts the honest no-build skip. Do not revert
   those; build on them. **The install leg has ZERO tests today** — that is your debt to pay.
3. **T-18 is still open.** `tree-run`'s `project` block today carries `typecheck` + `test`
   verdicts but **no `build` key** (`fixes/216x` §2.2 item 3). Target state per
   `fixes/216x` §2.3 item 2: *"add a `build` verdict to `tree-run`'s `project` block
   (declared `npm run build`), executed only when deps are present; keep the honest
   skip+note otherwise; leave `run.kind:"ui-shell" → skip` **untouched**."* The
   "builds and tests" ceiling is the honest maximum — **never** claim "E2E" (no dev
   server, no browser driver, no sandbox claim; see 216x §2.2 CANNOT items).
4. **Measured budget on this host (216x §2.1, re-verified in the W10 evidence):** a cold
   `npm install` of an emitted webapp ≈ 31 s, its `vite build` ≈ 4.1 s, `tsc --noEmit`
   ≈ 10.5 s. Any new timeout you add must have headroom over the install cost and must
   SURFACE that cost.
5. **Honesty floor strings are pinned in tests.** The no-deps note comes from
   `compile-check.server.ts` (search for `is UNVERIFIED (npm install, then re-run to verify)`);
   the `ui-shell` skip comes from the same file. Neither may change wording without an
   old → new record.

## Your numbered plan

1. **Write the landing-log skeleton** + `wc -l src/lib/compile-check.server.test.ts`
   (record the baseline count; you will report old → new).
2. **Add install-leg tests via the seam** (no network, no real npm) in
   `src/lib/compile-check.server.test.ts`, using a temp dir with a `package.json` that
   declares a `build` script:
   - `installCommand` that exits 0 → envelope has `install.run === "pass"`,
     `install.mocked === true`, `install.tool === "seam"`, and the declared build script
     actually ran.
   - `installCommand` that exits non-zero → `install.run === "fail"`, `ok === false`,
     `code === "RT_E_VERIFY_KIND_FAILED"`, and the declared build/test scripts are
     **short-circuited** with `skipped` + the exact reason (assert that marker).
   - `installCommand` that never exits (e.g. a long sleep) with a small
     `installTimeoutMs` → `install.run === "timeout"` and the whole call stays bounded
     (assert elapsed < the outer bound).
   - a tree with NO `build` script → the honest skip, `skipped === true`, `ok === true`.
   - `installToolFor(dir)`: lockfile present → `"npm ci"`; absent → `"npm install"`.
     (Export it if it is not exported — that is inside your file.)
   - **`dir` is never mutated**: assert the subject tree's file list is byte-identical
     before/after the call (the scratch copy is the point).
   Keep the REAL `npm` path behind the existing `RT_VERIFYKIND_INSTALL=1` env gate that
   the 216z comment documents: when that env var is absent your new tests must not touch
   the network. If the env gate does not exist in the test file yet, add it in the same
   style the file already uses for opt-in (skip, never a fake pass).
3. **Add the T-18 `build` verdict to `tree-run`'s `project` block** in
   `src/lib/compile-check.server.ts`:
   - Execute the declared `build` script **only when dependencies are present** (i.e. the
     subject dir has a `node_modules/`); otherwise keep today's honest skip with an
     explicit reason string that says the build is UNVERIFIED until deps are installed —
     mirror the existing typecheck skip wording pattern, do not invent a new tone.
   - The verdict shape must be the same shape as the existing `typecheck`/`test` verdicts
     (`{ kind|cmd, run: "pass"|"fail"|"skip"|"timeout"|"error", ... , durationMs }`) —
     read the existing block and match it exactly.
   - **Do NOT change** `run.kind:"ui-shell" → skip`, and do NOT add any "verified"/"E2E"
     wording. Absent is not a pass.
   - Add at least three tests: (a) no `node_modules` → `build.run === "skip"` + the note;
     (b) deps present + a `build` script that exits 0 → `build.run === "pass"` (use a
     tiny real script such as `node -e "0"` in a temp dir you create yourself — no
     network); (c) deps present + a `build` script that exits 2 → `build.run === "fail"`
     with the coded failure preserved.
4. **Re-run** `npm run typecheck` and
   `node --experimental-strip-types --test src/lib/compile-check.server.test.ts`
   and paste the real tail into your log.
5. **Finish the log**: task ids, file:line of every change, old → new test counts, the
   exact commands + results, and a plain statement of anything you did NOT do.

**If you run out of budget:** stop at the first numbered item you cannot finish and say
exactly which items landed and which did not.

# W11 · LANE 5 — Coding engineer: make the engine's failures visible + the emitted tree reviewable

**Read this file FIRST, before any other file.** Then `AGENTS.md`, `RESUME.md` §5.4
(honesty invariants — this lane exists because of one of them),
`fixes/216y_oracle_and_error_audits.md` §2.3 **G2** (your bug, with the reproduction) and
§2.1 (the catch inventory), and `fixes/216x_t11_verification_and_108t7_spike.md` §2.3 item 1
(the T4.2 `.gitignore` decision: *"no `.gitignore` is emitted today — once installs/build
artifacts (`node_modules/`, `dist/`) exist inside emitted trees, `.gitignore` + git integration
are what keep the output reviewable units; land the snippet with T4.1's scratch-copy choice so
verification never dirties the artifact"*).

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
- `src/lib/engine.ts`
- `src/lib/lesson-writers.test.ts`
- `src/lib/scaffold.ts`
- `src/lib/scaffold.test.ts`

**Landing log:** `fixes/217f_engine_error_surface_and_tree_gitignore.md` (skeleton FIRST).

**Persona.** You are the coding engineer on the produced artifact's honesty: a failure the
system knows about must be visible in the record, and a produced tree a person is asked to
review must not fill up with things that should have been ignored.

---

## Item 1 — G2: the engine's silent catch-all (do this first, it is small)

**The defect (`fixes/216y` §2.3 G2, re-verified by the parent on 2026-09-24).**
`export async function runPhaseAsync(project, phase)` in `src/lib/engine.ts` (search for it —
it wraps `liveLayer(project, phase)` in `try { ... } catch { return applyPhaseResult(project,
phase); }`). The bare `catch {` swallows **every** unexpected live-layer error with no code, no
ledger row and no NDJSON event, so a keyed live-layer failure is indistinguishable from a
deliberately deterministic run — the audit's words: *"a degraded run is indistinguishable from a
deterministic one."*

**What to do:**
1. Keep the floor: the catch must STILL return `applyPhaseResult(project, phase)` — a run must
   never break because a live layer threw. Do not rethrow.
2. Make it visible: on the catch path, append an honest, bounded log row to the returned
   project's `logs` (same `JsonLog` shape `applyPhaseResult` already appends: `ts`, `phase`,
   `level`, `event`, `detail`). Give it a stable event name in the repo's existing dotted style
   (read the surrounding events first and match them, e.g. a `p<phase>.*` warn event), a
   `warn` level, and a `detail` carrying the error's real message, truncated to a bounded
   length, plus an explicit statement that the deterministic floor was used instead. **Never
   swallow silently and never invent a cause** — if you cannot classify the error, say so in
   the detail rather than guessing a code.
3. Add the ledger/telemetry row the same way the neighbouring code does if — and only if — the
   module already has a non-throwing seam for it (re-read `applyPhaseResult`'s logging and the
   optional-importer seams; **do not import `node:fs`** and do not break the file's
   client-safety, which `AGENTS.md` calls the H2 crash class). A pure `logs` row is acceptable
   and is the minimum bar; say in your log which surface you used and why.
4. Purity: the function must stay safe to call from the UI store path. No I/O, no globals.
5. **Tests** in `src/lib/lesson-writers.test.ts` (the engine-seal suite that already drives
   `applyPhaseResult`/`runUntilGate` through real fixtures — read its helpers first):
   - force `liveLayer` to throw (look at how the suite or `headless.test.ts` already injects
     stubs/env to steer the live layer; do NOT add a production-only test hook — if the only
     way is an env var or a missing key, use that and say so), then assert the returned project
     is the deterministic floor's output AND the new warn row is present with its bounded detail.
   - a normal (non-throwing) run asserts the new row is **absent** (no false positives).
   If you conclude the throw is genuinely unreachable without a new seam, STOP and report it
   with the evidence instead of adding a hook.

## Item 2 — T4.2: emit a `.gitignore` with the tree

**Today:** the emitter writes `DEPLOY.md`, `.env.example`, `package.json`, `tsconfig.json`,
`.rapidtool/project.json` and the kind/tree files — and **no `.gitignore`**. Once T4.1's
install leg and a real `npm run build` run inside an emitted tree, `node_modules/` and `dist/`
land in the artifact, which is exactly what makes an emitted tree a bad "reviewable unit".

**What to do:**
1. Add a `.gitignore` to the emitted file set in `src/lib/scaffold.ts` where the other root
   documents are pushed (find the `push("DEPLOY.md", ...)` / `push(".env.example", ...)` block —
   mirror how `.env.example` is produced so the new file matches the file's existing style and
   so it is emitted for **every** kind, tree-mode included).
2. Content must be honest and minimal: ignore the build/install artifacts a real install+build
   creates (`node_modules/`, `dist/`) and the transient verification output, and **keep
   `.rapidtool/project.json` (and the notes/report files) tracked** — they are the artifacts the
   user actually reviews. Do not ignore the generated source.
3. Keep the file byte-stable (no timestamps, no absolute paths) — the repo pins determinism.
4. **Tests** in `src/lib/scaffold.test.ts`: the emitted file set contains `.gitignore`, its body
   pins the ignore lines you added, and it is emitted in **both** single-module and tree mode
   (find how the suite already asserts file-set membership and reuse that assertion style —
   do not invent a new one). If the suite asserts an exact file list count, update that count
   and record old → new.
5. **Do NOT** run `git init` or any git command against the emitted dir, and do NOT touch the
   user's repo history — this item emits a file and nothing else. (The audit's "git landing"
   concern beyond the ignore file is a later wave's call.)

## Then

- Re-run `npm run typecheck`,
  `node --experimental-strip-types --test src/lib/lesson-writers.test.ts`, and
  `node --experimental-strip-types --test src/lib/scaffold.test.ts`; paste the real tails and
  the old → new counts (record the counts BEFORE you edit).
- Finish the log: file:line per change, old → new, what could break (name the suites that read
  `engine.ts` and the emitted-tree file-set assertions), and anything you did not do.

**Order matters: item 1, then item 2, then the tests for each as you go.** If you run out of
budget, stop and report exactly which items landed.

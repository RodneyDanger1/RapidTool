# W11 · LANE 4 — Agentic engineer: the agent-facing surface (`nextAction` + the CLI dispatch bug)

**Read this file FIRST, before any other file.** Then `AGENTS.md`, `RESUME.md` §5,
`research/multiagent/111_ui_design_research.md` **TASK-01** (the exact spec + done-when),
`scripts/README-cli.md` (the machine contract + exit taxonomy), and
`fixes/216y_oracle_and_error_audits.md` §2.3 **G1** (the bug, with its reproduction).

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
- `src/lib/headless.ts`
- `src/lib/headless.test.ts`
- `scripts/rapidtool-cli.mjs`

**Landing log:** `fixes/217e_next_action_and_cli_dispatch.md` (skeleton FIRST).

**Persona.** You are the agentic engineer: the agent that *drives* RapidTool is your user. Your
two jobs are (1) make the CLI stop lying about its own failures, and (2) make every operator —
human or agent — able to ask *"what do I do now?"* and get one computed answer.

---

## Context you can rely on (verified by the parent on 2026-09-24)

- **G1 is a real, reproducible defect.** In `scripts/rapidtool-cli.mjs`, the shared loader
  factory (`makeLoader`, search for `const makeLoader = (h) => (cmdName) =>`) calls the async
  `respond(...)` **without `return`** on both the `proj.error` guard and inside its `catch`.
  Because `respond` awaits `cliLogEvent(...)` before `process.exit`, execution falls through,
  the verb proceeds with `undefined`, and a raw `TypeError` stack lands on stderr while a coded
  JSON envelope also goes to stdout — two responses racing, with the exit code decided by the
  race. The audit reproduced it 3/3 (`summary --project <missing>`, `packet --project <missing>`,
  `summary` with no flag).
- **`ProjectSummary`** is `headless.ts:960`, built by the pure `summary(project)` at `:985`.
  The CLI spreads that envelope, so a new field there reaches the CLI for free.
- **TASK-01's exact contract** (`111` TASK-01): a new pure
  `export function nextAction(project: Project): NextAction` next to `failedGates`/`summary`,
  plus one new field on `ProjectSummary` in `summary()`'s return. The type carries
  `kind`, `cmd`, `phase`, `why`. The mapping must cover `complete` / `blocked` /
  `awaiting_hitl` / `rejected` / `sealedWithFailures` / locked-next / **`unknown`**.
  **The `unknown` arm is mandatory — it is what stops the function ever fabricating.**
  It must be **pure** (no `node:fs`, no I/O) to survive the repo's purity tests.
- **The UI already renders its own `uiNextAction`** (`src/components/console.tsx:273`) — a
  SIBLING file you do not own, and the wave explicitly keeps the two computations independent
  this wave so a shared-module refactor cannot break the console. Do **not** import from or
  edit the console. If you believe the two should be unified, say so in your log as a
  follow-up; do not do it.

## Your numbered plan

1. **Fix G1 first (smallest, highest blast radius), then log it.**
   - Add the missing `return` on both `respond(...)` calls in `makeLoader` so a handled
     project-load refusal ends the verb there. Match the file's existing style for
     `return respond(...)` if that pattern exists elsewhere in the file — grep before you edit.
   - **Sweep for the same defect class**: grep every `respond(` in the file and check whether
     each is in a guard/branch position that then continues to use a value that only exists on
     the success path. Fix only the sites that are genuinely the same bug; list each in your log
     with file:line + why. **Do not refactor beyond the defect.**
   - **Prove it**: run each of these and paste the real stdout/stderr/exit code:
     `node --experimental-strip-types scripts/rapidtool-cli.mjs summary --project C:/nonexistent_nope.json`
     `node --experimental-strip-types scripts/rapidtool-cli.mjs packet --project C:/nonexistent_nope.json`
     `node --experimental-strip-types scripts/rapidtool-cli.mjs summary`
     Expected after the fix: **exactly one** coded JSON object on stdout
     (`RT_E_PROJECT_MISSING` / `RT_E_VALIDATION`), **no** `TypeError` stack on stderr, exit 1.
     A "single JSON object on stdout" contract is what `README-cli.md` promises — read it.
2. **TASK-01 — the derived `nextAction`.**
   - Add `NextAction` + `export function nextAction(project: Project): NextAction` beside
     `failedGates`/`summary`, with a TSDoc that names the task id and states the purity
     contract. Add the field to `ProjectSummary` and to `summary()`'s return.
   - Cover, in this order of precedence: `unknown` (nothing recognisable — never fabricate),
     `blocked`, `rejected`, `awaiting_hitl` (a HITL gate is parked ⇒ the action is approve/
     reject, and `cmd` must name the real CLI verb that does it), `complete`, locked-next
     (earlier phase red ⇒ the action is to fix that gate), `sealedWithFailures`.
     Precedence must be written down in the TSDoc — a reader must be able to predict the arm.
   - `cmd` must be a **real** verb from `scripts/README-cli.md` (verify the verb exists —
     grep the dispatcher). `why` is one plain sentence: no jargon, no JSON-looking text.
   - Tests in `src/lib/headless.test.ts`: one assertion per arm on a small fixture project
     (reuse the fixtures the suite already builds — read the file's existing helpers first),
     plus a purity assertion if the suite has an established pattern for it.
3. **CLI end-to-end proof**: with a real project JSON that the repo already ships
   (`build.json` at the repo root is accepted by the CLI — verify before you rely on it),
   run `summary --project build.json` and paste the observed `nextAction` field + exit 0.
4. **Re-run** `npm run typecheck` and
   `node --experimental-strip-types --test src/lib/headless.test.ts`; paste the real tail and
   the old → new test count.
5. **Finish the log**: what changed, file:line, the commands, the observed results, and
   anything you deliberately did NOT do.

**Do not** touch `summary`'s existing fields' values (other suites pin them), the exit-code
taxonomy, or any other verb's behaviour.

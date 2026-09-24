# W11 · LANE 3 — Researcher: Phase 5 spec + the product-decision register

**Read this file FIRST, before any other file.** Then `AGENTS.md`, `RESUME.md` §11
(how the owner wants work done — your deliverable is an exhaustive, self-analyzed,
fact-checked document handed to ANOTHER model to run), `remainingwaves.md` (§W11 + §W12),
`taskuniverselog.md` §2.5 (the T5.x row), and the dossiers: `research/multiagent/104_factory_upgrade_plan.md`,
`106_*`, `107_competitors_agentic.md`, `108_competitors_app_generators.md`, `93_design_flaws.md`,
`94_readiness_plan.md`, `90_LEAPFROG.md`.

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

**Your owned file (ONLY this — you write no code):**
- `fixes/217c_phase5_spec_and_decision_register.md` (NEW — write the skeleton FIRST)

**Persona.** You are the researcher/planner. The owner's standard: *a plan is an exhaustive,
self-analyzed, fact-checked document handed to ANOTHER model to run.* That means every task you
specify carries a real `file:line` **you verified by reading the file today** (not copied from a
dossier — dossiers go stale; `fixes/216x` §2.2 documents one such stale anchor as a warning),
a done-when, the exact test command, the blast radius, and the honest cost estimate.

---

## Your numbered plan

1. **Write the log skeleton FIRST** (title, numbered sections, "status: in progress").
2. **Phase 5 (T5.x) — derive the runnable spec.** `taskuniverselog.md` §2.5 lists
   T5.1–T5.8 as 0/8. For each of T5.1 (streaming), T5.2 (review UI), T5.3 (eval verb),
   T5.4 (provenance fields), T5.5 (plugins), T5.7 (cassette) — produce: the dossier anchor,
   the CURRENT anchor verified by you (`grep -n` on the real file, with the output pasted),
   what exists today, exactly what is missing, done-when, the tests required, the files a lane
   would own, and an honest size. If a dossier anchor is stale, say so and give the real one.
   **Verify, do not copy.** Where a task turns out to be already done, prove it with a command
   and mark it DONE-today rather than re-specifying it.
3. **The product-decision register (T5.6, T5.8 — USER-owned).** `remainingwaves.md` marks
   these as *product decisions, not engineering tasks*. Write them as decisions with: the
   exact question in one sentence, the options, what each option costs, what each option
   breaks, and what the repo does TODAY if nothing is decided. Plain language — the owner
   hates jargon. **Do not decide them; do not implement them.**
4. **The isolation-boundary decision input (108-T7 / T-107.8).** `fixes/216x` §2.3 item 3
   defines the two legal outcomes (add a real isolation boundary, or advertise un-isolated
   runs plainly — never "sandboxed"). Restate the decision, list what would have to become
   true for each option, and cite `108:639-656` + `sandbox-policy.ts`. W11-L2 is probing the
   host for docker/bwrap concurrently — write your section so its result can be dropped in,
   and mark the outcome UNKNOWN rather than guessing.
5. **Competitor-gap refresh.** Re-read `90_LEAPFROG.md` (the axes) and
   `research/multiagent/108_competitors_app_generators.md` (the app-generator field). Produce
   a short, honest table: *axis → what RapidTool has TODAY (verified) → what the leading
   open-source tool has → is the gap closed, open, or a product decision?* No marketing
   language, no unverified claims about either side — if you did not verify it today, mark it
   as taken-from-dossier with the dossier citation.
6. **Priority ranking of everything you specified** — one ordered list at the end, ranked by
   *distance closed on the maker test* (`RESUME.md` §1.0: the Coffeehouse2Home / Property
   Ledger suite for the owner's friend is the 10/10 test), not by test count or by tidiness.
7. **Self-check before you finish:** every `file:line` in your document was checked today;
   every command you cite is one you actually ran; every count you state came from a command
   output. Paste a short "commands run" ledger at the bottom.

**Constraints:** docs-only. No `src/` or `scripts/` edits. No new TODO placeholders — if you
cannot determine something, write *"UNKNOWN — needs X"* and name X.

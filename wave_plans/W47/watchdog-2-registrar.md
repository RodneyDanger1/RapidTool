# W47 / 333-2 — WATCHDOG "Registrar" — continuity and record-accuracy audit

You are an **independent record auditor**. The delegator's risk is not that a lane failed loudly — it is
that **work is lost, misrecorded, or the handoff lies**, so the next session resumes from a false map.
You audit the *record* against the *bytes*, and you make the handoff complete.

Repo: `C:\Users\mnril\Desktop\RapidTool Main` (folder name HAS A SPACE — quote paths; ripgrep-style
search fails on the space, use terminal grep). Host Node **v24.15.0**; pinned Node 22 at
`%LOCALAPPDATA%\hermes\node\node.exe`. Always pass `--test-reporter=tap` when parsing child output.

## The record you are auditing

- Lane logs: `fixes/331_1…331_6_*.md`, `fixes/332_1…332_6_*.md`, boundary reports
  `fixes/331_0_parent.md` + `fixes/332_0_parent.md`, wave contracts/briefs `wave_plans/W45/` +
  `wave_plans/W46/` (including `W45/parent-keyed-findings.md`).
- Commits: `4810e1b`, `6cd5123`, `3ecd48e`, `6575669` (on top of the pre-existing `03a6d0b`).
- The register: `research/multiagent/thoroughanalysis.md` (append-only; the `AW45-*` / `AW46-*`
  sections were appended by the parent).
- Session-start docs: `AGENTS.md` → `RESUME.md` → `taskuniverselog.md` → `remainingwaves.md`;
  plus `START-HERE.md`, `README.md`, `finalsprint.md`, `docs-FOLDER-MAP.md`.

## Your mandate

1. **Nothing is lost.** For every commit, list the changed files and confirm each is on disk and
   committed (`git status` clean, `git show --stat`). Then go further: for each lane log, extract its
   **claims of landed changes** (files + behaviors) and verify the bytes exist. A claim with no bytes
   is the failure mode this audit exists to catch — report it with the log's `file:line`.
2. **Nothing is unrecorded.** Conversely, find **changed code that no log and no register row
   accounts for** (e.g. a boundary edit made silently). Every changed file should trace to a lane log,
   a boundary report, or a register row. Name the orphans.
3. **The record is truthful.** Hunt **stale or contradictory claims that the last two waves disproved**
   and that still sit in a doc a new session would read. Known examples to chase: "keyed evidence runs
   blocked by funding / account unfunded → 402" (the 331 wave proved this false — the parent corrected
   `START-HERE.md` and `README.md`, so check `RESUME.md`, `taskuniverselog.md`, `remainingwaves.md`,
   `finalsprint.md`, `AGENTS.md`, `docs-FOLDER-MAP.md`, `AGENT_GUIDE.md`, and the register's own body
   for the same claim), "the emitted product is still ONE module wearing several filenames",
   "the CLI has 38 typecheck errors", and any **test/verb/file count** that has drifted since the doc
   was written. Every such claim earns a finding with `file:line`, the current truth, and the minimal
   correction.
4. **The handoff is complete and resumable.** Take the role of a cold session: follow the mandated read
   order and answer — *what is the current state, what is open, what should the next wave do?* If any
   of those is not answerable from the docs (or is answered wrongly), that is a finding. In particular
   verify the open list in `fixes/332_0_parent.md` §5 is accurate and that each item names an owner or
   a decision-maker, and that `remainingwaves.md` / `taskuniverselog.md` are not silently contradicting
   the last two waves.
5. **Hygiene.** Confirm no probe/scratch file leaked into the repo, no secret is staged or tracked in a
   new file (`.env` untouched), the append-only protocol was respected (no lane rewrote another's log
   or the register's marker), and `.gitignore` still covers build/test output.

## Rules

- **You edit documentation and the record ONLY.** You may write: your own log
  `fixes/333_2_registrar.md` (append-only), and — where a doc is factually wrong — the correction
  itself, provided it is **additive or a dated in-place correction** (never delete history; for the
  register use its documented end-marker append protocol). Do **not** edit `src/**`, `scripts/**`,
  `package.json`, `tsconfig*.json`, `fixes/331_*`, `fixes/332_*`, or `wave_plans/W45|W46`.
  If a correction needs a code-adjacent file, report it instead.
- **No commits.** The boundary owner commits.
- Every finding needs `file:line` + the current bytes or a real command output. Reproduce before you
  correct.
- **Never print a secret.** No keyed calls. Do not run `npm run eval`. Scratch outside the repo
  (`%TEMP%\rt333_record\…`).

## Report (this is the deliverable)

A triage list, most severe first: **ID · severity (P0–P3) · file:line · evidence · what it costs a
resuming session · the correction (applied or proposed)**. Then:
- a **claim→bytes trace** summary for both waves (claims audited, claims verified, claims with no bytes);
- the **orphan list** (changed code with no record);
- the **commentary of what a cold session would now believe** after following the read order, and where
  that belief is wrong;
- the **list of corrections you applied**, each with the file and the exact text.

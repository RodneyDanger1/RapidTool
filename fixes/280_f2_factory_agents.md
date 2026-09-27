# 280 · F2 — THE AGENT + DELEGATION LAYER (W35 factory-analysis lane)

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; `grep`). HEAD `0f85c32` + W29–W35 in-flight era (L1–L3 / P1–P3 / A1–A2 siblings may be landing — re-read bytes).
**Slice:** the packet (`src/lib/packet.ts`) · agent docs (`AGENTS.md`, `AGENT_GUIDE.md`, `START-HERE.md`, `263_state_of_play.md`) · `crew.ts` + `subagent.ts` de-scope + agent-role surfaces · HITL/seat/approval/policy chain (`policy.ts`, seats, two-channel token, `forceHuman`) · handoff (`handoff.ts`, `io.ts` export paths) · ingest (`report-intake.ts`).
**Contract:** READ-ONLY on product code · no test runs · no builds · no keyed calls · log-and-continue · every claim byte-checked TODAY (grep/read) · deliverable = §F2 appended to `wave_plans/W35/factory-notes.md` above END-OF-FILE-MARKER-FACTORY.
**Dedupe:** W34 `prep.md`/`code-notes.md` (cited, not repeated); `fixes/276_*`–`fixes/279_*` read.

## Timeline

- (t0) Read `wave_plans/W35/factory-notes.md` in full (22 lines; marker = line 23). Read `START-HERE.md`, `AGENT_GUIDE.md`, `AGENTS.md` (repo contract), `finalsprint.md` (head + WDX-1 polls), `wave_plans/W34/prep.md` + `code-notes.md`, lane logs `fixes/276_*`–`fixes/279_*`. Wrote this log EARLY (contract).

## Findings ledger (working notes — final text lives in §F2)

(populated as I read; each numbered item = what/why/fix/done-when/traps)

- (reading begins…)

## Collisions / notes

- Sibling W35 lanes F1/F3/F4/F5 may append to the same files' analysis — this lane touches NO product file and NO file another lane owns (only `wave_plans/W35/factory-notes.md` §F2 + this log).

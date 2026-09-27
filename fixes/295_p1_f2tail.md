# fixes/295_p1_f2tail.md — W41 · LANE P1 · THE F2 TAIL

**Lane:** W41 P1. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → shell grep only; short one-liners; legs FOREGROUND).
**Contract:** PATCH-FIRST — land item → its check; `node --check` each edited file; additive only; no gates/keyed calls/full runs; `TODO(<id>)` at exact line when window-limited; log `for <lane>`.
**Baseline HEAD:** `ac6b151`. **Box:** `packet.ts` · `crew.ts` · `crew.server.ts` (+ their tests).
**Sources:** `fixes/294_n2_pipeline.md` (N2 ordered list) · `fixes/291_k12_agents.md` + `subagent-summary-2-20260927_013043_538398.txt` (K12 byte-check — exact intent) · `fixes/293_m2_pipeline.md` · F2 card `subagent-summary-1-20260926_195114_767464.txt` · W40 `CONTINUE-PROMPT.md` §3-D.
**Siblings P2–P4 LIVE** → read fresh before each patch; log `for <lane>`.

## Ledger (append-only — evidence per item: file:line → before → after)

### [t0] open — sources read in full; order fixed
Order: 1 F2-03 · 2 F2-04 · 3 F2-07 · 4 F2-09 · 5 F2-10.
Cards: F2-03 = fold notes/artifacts into `compiledAtFor` (deterministic, no wall-clock; packet.test.ts envelope pins per-key → additive-safe per K12).
F2-04 = W-21/W-48 `{spent, cap, stopReason}` budget boundary never landed (`stopReason` 0 hits repo-wide; `spend` measured-only, honest-when-absent).
F2-07 = `exportProfiles` (:868+) zero consumers outside `packet.test.ts`. F2-09 = `crewToReport` (`crew.server.ts:1406`) dead.
F2-10 = crew spend escapes ledger; seam = `crew.ts:155-167` (createServerFn → runCrewServer); `recordSpend` consumers = `codegen.server.ts` + `harvest.ts` only.

### [t1] F2-03 LANDED — `packetInputHash` + envelope `input_hash`
- `packet.ts`: new exported `packetInputHash(project)` (FNV-1a fold: createdAt, logs[].ts, decisions[].decidedAt, notes, artifacts id/phase/kind/title/body, memory id/kind/phase/score/text; stored order; no wall-clock; `kind:"packet"` artifact EXCLUDED — it is the compile output, folding it broke the H-05/D2 re-stamp pin; telemetry counters excluded per types.ts). Envelope: added `input_hash: packetInputHash(project)` after `research_hash` (additive; PACKET_VERSION stays 3).
- `packet.test.ts`: import + 2 new tests (present/deterministic/notes-move + compiled_at stays put; artifacts/memory move, telemetry stable).
- Evidence: `node --experimental-strip-types --check` OK both files; FIRST run caught the D2 red (sealed packet artifact folded → churn), fixed by exclusion; **packet leg 52/52 pass** (was 50 pre-edit + 2 new).

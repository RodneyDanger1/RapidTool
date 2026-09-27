# fixes/285_g2_agent_visibility.md — W38 · LANE G2 · THE AGENT-VISIBILITY GUARANTOR

**Lane:** W38 G2. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE in path → shell grep only).
**Mission:** guarantee that a DOWNSTREAM agent (and the delegator) can SEE everything they need — packet fields,
export/handover round-trip, the logs' coded events, the report-intake chain, `AGENT_GUIDE.md`'s promises.
Verify first; tiny fixes only (wiring/visibility, never redesign); where already true, the ✓ row.
**Box (mine):** `src/lib/packet.ts` · `src/lib/io.ts` · `src/lib/handoff.ts` · `src/lib/report-intake.ts` ·
`src/lib/runtime-log.server.ts` · `src/lib/diagnose.ts` · `AGENT_GUIDE.md`.
**NOT mine (live lanes):** `codegen.server.ts` + `src/lib/llm/**` (Y1) · `engine.ts`/`store.ts`/`rt-*.ts` runtime (Y2) ·
`console.tsx`/routes (G1) — findings there recorded `for <lane>`, never edited. Read fresh, never collide.
**Contract:** CODE-ONLY — no test runs, no typecheck, no builds, no gates, no keyed calls. Log-and-continue.

## [t0] Mandatory reads (verified, ~today's session)

- `fixes/284_wiring_guarantee.md` — G1 sibling log, read; box boundaries confirmed (console.tsx = G1's) ✓
- `wave_plans/W38/NEW-SESSION-PROMPT.md` — read in full; context (final close-out, honesty laws) ✓
- `AGENTS.md` — repo contract re-read (space-in-path search failure confirmed live: search_files → 0 hits) ✓

## [t0] Byte-state (this tree, this session — code = truth)

| File | Lines | Note |
|---|---|---|
| `src/lib/packet.ts` | 1034 | render + systemJson + exportProfiles + truncateToBudget |
| `src/lib/io.ts` | 535 | exportProjectJson · importProject · exportPacketText · slugName · downloadFilename |
| `src/lib/handoff.ts` | 195 | phaseHandoff (pure; F2-20 decidedVia row live) |
| `src/lib/report-intake.ts` | 524 | validateReport · applyReportResult · applyReport |
| `src/lib/runtime-log.server.ts` | 181 | NDJSON append/read/rotate — the CLI half |
| `src/lib/diagnose.ts` | 384 | reads the NDJSON tail back |
| `AGENT_GUIDE.md` | 95 | the promises under test |

## Pointer map (the deliverable)

STATUS: ✓ = verified true today · FIXED = this lane's patch · for-Y1/Y2/G1 = recorded, owned elsewhere · GAP = recorded, no safe tiny fix.

_(rows land below as verified — append-only)_

## Log (append-only)

### [t0] log opened — edges 1–5 verification begins

- Edge 1 (packet fields): reading `compileAgentPacket` render + `systemJson` against the consumed-field list
  (decidedVia · lastTest · acceptance/verification label · census · artifact bodies · nextAction).
- Edge 2 (export/handover): `exportPacketText` reads `project.packet` — the stamped field, not a fresh compile;
  will check stamp path + hydrate survival.
- Edge 3 (logs): registry (`rt-events.ts`) vs emit sites vs `diagnose` read-back.
- Edge 4 (report-intake): labels/caps/idempotence + ingest→store→packet chain.
- Edge 5 (AGENT_GUIDE): each promise → grep the named code (verbs/fields/buttons).

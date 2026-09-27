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

## [W40 K8 · 2026-09-27] THE OWED MAP ROWS — appended from the lane's delegation summary

**Why here:** G2 (W38) exhausted its iteration budget **before any code patch** ("The only file I created is the log (`fixes/285_g2_agent_visibility.md`) with its t0 sections (mission, box, byte-state table, edge plan). **No source fix was applied**" — verbatim). The delegation summary (`~/AppData/Local/hermes/cache/delegation/subagent-summary-0-20260926_203820_897659.txt`) is the only persisted record — re-landed below verbatim. Byte-verified at lane time (tree `0f85c32` + W29–W38 era; **later waves may have landed some — re-verify before acting**). Appended by W40 K8 as the Z4 payout's G-map record.

### G2 · EDGE 1 — packet fields
- ✓ **census** — `phase_coverage` in the envelope (`packet.ts:161-165`) + the rail line (`:639`) share one `phaseCoverage()`; honest.
- ✓ **artifact bodies** — `packet.ts:478-485` renders the last 8 non-`packet` artifacts, 900-char trimmed.
- ✓ **decidedVia (prose)** — types.ts:229 + `handoff.ts:134-157` renders label/action/resource/tokenPath (F2-20 landed).
- **GAP (F2-01, still open)** — `systemJson` decisions rows (`packet.ts:142-149`) carry only `phase/decision/decided_by/note/requested_at/decided_at`; the **machine block drops `decidedVia` seat provenance**. Tiny additive fix: add a `decided_via` key.
- **GAP (F2-02/F2-06)** — `packet.ts:642` hardcodes `P6 template self-test (last run): pass|FAIL` while `types.ts:396` defines `label: "self-test"|"real-run"|"tested"` and `chat.server.ts:257-294` reads it honestly with a floor tag. The packet **mislabels a machine-verified (`tested`) run as a template self-test** and omits `label`/`evidenceHash` from the envelope.
- **GAP** — grep = **0 hits** for `acceptance`/`verification` in `packet.ts`: `acceptance`/`acceptanceFixtures`/`acceptanceApprovedAt` (types.ts:466-472) are invisible to a downstream agent.
- **Note** — `nextAction` is not a packet field at all; it lives in `headless.ts:1212/1301/1341` (`summary.nextAction`) + console. Fine as designed, but a packet-reading agent won't see it.

### G2 · EDGE 2 — export/handover
- `exportPacketText` (`io.ts:508-512`) returns the **stamped** `project.packet` + appends `## Operator notes` when `notes` are set — but `compileAgentPacket` *already* embeds `## Operator notes (human steering)` (`packet.ts:592-599`), so a notes-bearing project can render the block **twice** in the copy/download path. `io.test.ts:623-636` pins only the notes-absent/simple cases.
- Stamp path coherent: `engine.ts:1230/1924/383` (`stampPacket`), re-stamp guarded at `engine.ts:2581`; `hydrateProject` keeps `raw.packet` strings (`:2446`).
- **F2-23 confirmed by read**: console's packet tab renders `project.packet` (`console.tsx:3324`) while copy/download uses `exportPacketText` (`console.tsx:2412`) — three byte strings; `exportProfiles` (packet.ts:868+) has **no production consumer** (tests only) = dead surface (F2-07).

### G2 · EDGE 3 — logs/telemetry
- ✓ Registry names ↔ emit sites ↔ diagnose all agree: `wild.step_timeout` (console:1197), `wild.step_start` (engine:3997), `runner.failed|unavailable` (rt-events:177-178), `hydrate.recovered_corrupt` (rt-client:161), `sys.longtask|mainthread_stall` (rt-client:465/531), `persist.quota_failed` (store:847) — all read by `diagnose.ts:172-274`.
- ✓ CLI exit round trip: `respond()` → `cliLogEvent` → `makeCliRow`/`appendRtLine` into `resolveLogDir(CLI_PROJECT)`; `diagnose` reads the same dir, tail 200.
- **GAP** — `diagnose.ts:174` looks for `wild.step_start`/`wild.step_ok` **inside the `errors` array**, which the CLI filters to error/critical only; those are info rows, so that evidence arm is unreachable (dead). Tiny fix: cite from `timeline`.

### G2 · EDGE 4 — report-intake
- ✓ Labels (`REPORT_TITLE_PREFIX`, `REPORT_FOOTER "external report — unverified by engine"`, `REPORT_BLOCK_MARKER`), caps (12 artifacts / 50k body), idempotence (`contentFingerprint` → ids → `alreadyApplied` → `applied:false,"duplicate"`) all verified.
- **KEY GAP (F2-22, closed-loop broken)** — `store.ingestReport` (`store.ts:1501-1552`) applies the report to artifacts/logs/memory but **never re-stamps the packet**, and `headless.ingestResult` (`headless.ts:1110-1134`) likewise returns the merged project with no re-stamp; `h.packet` then serves a **stale packet**. The agent's report lands in state but is invisible in the packet it reads. → log `for Y2` (store/engine).
- **For X6** — `report-intake.test.ts:205/209` still assert pre-marker notes; the `[agent report] ` marker (report-intake.ts:426) will fail those pins (Y3 already flagged "pin re-point owed").

### G2 · EDGE 5 — AGENT_GUIDE.md
- ✓ Named surfaces exist: "Copy agent packet"/"Copy phase handoff"/"Download packet" (`console.tsx:1528,2893`), "Phase narrative (LLM)" (`engine.ts:3035/3078/3217`), `TAVILY_API_KEY` (`tavily.server.ts:4/37`), `DEEPSEEK_API_KEY`.
- **Contradiction (F2-24/F2-25)** — §4 line 69 "has no live LLM/research/sandbox feedback channel" vs §5 line 81 "calls a real LLM when configured"; and §4's "paste output back … so it flows into the next packet compile" is only half-true given the Edge-4 stale-packet gap.

### G2 · RECOMMENDATION FOR THE PARENT (verbatim)
Highest-value **tiny, in-my-box** fixes awaiting one more pass: (1) `packet.ts:142-149` add `decided_via`; (2) `packet.ts:642` read `lastTest.label` instead of hardcoding "P6 template self-test"; (3) surface `project.acceptance` label; (4) de-dupe the io.ts:511 notes block; (5) `AGENT_GUIDE.md` §4 wording. Store/engine re-stamp (Edge 4) and the diagnose evidence arm (Edge 3) are recorded `for Y2`/`for X6` rather than edited, per the box rules.

_— appended by W40 K8, 2026-09-27 (markerless append at EOF; the lane's own sections above were not edited)._

# Pro Auditor B — UI/chat/algorithms/logic audit specs (transcribed by parent)

Transcribed from Pro B's capped final summary (2026-09-06). Every finding
file:line-proven; PB-01 live-reproduced. Implement in order (P0 first).
Executors: F2 (UI/chat: PB-02, PB-03, PB-05), F3 (logic: PB-01, PB-04).

## PB-01 — P0 — functionality — stemmer non-canonicalization breaks plural↔singular matching across the entire logic core

- **Anchor:** `src/lib/algorithms.ts` `stemToken()` (line 968) + `tokenizeWords()` (line 990) + `phraseHits()` (line 257) + `fusionRank()` (line 376) + `intentLattice()` (line 269).
- **Bug:** `stemToken` single-pass strips plural suffixes after the trailing-e drop, and the e-drop uses a `>4` guard. So `file→"file"` but `files→"fil"`, `code→"code"` but `codes→"cod"`, `page/pages`, `note/notes`, `case/cases`, `type/types`, `role/roles`, `name/names`, `date/dates` all MISMATCH (live repro printed these). `vault.ts` already fixes this by canonicalizing each stem to its fixed point (`canonicalStem`, line 830); the algorithms core never does.
- **Blast radius (live repro):**
  - `intentLattice("rename pdf files into dated folders",…)` → entities `["folder"]` — the `file` entity is silently dropped (singular brief correctly returns `["file","folder"]`). Wrong jobs/entities → wrong contracts → wrong Spec Graph → wrong crew.
  - `fusionRank("files", [{text:"file list for the job"}])` scores **0.218** (pure noise floor) — lexical overlap is 0, so plural queries cannot rank singular memory rows.
  - `phraseHits` fails for any LEX term whose surface form is a plural of a 4-letter `-e` word.
- **Fix (surgical, 2 parts):** (1) In `stemToken`, change the e-drop guard from `w.length > 4` to `w.length >= 4` (keep `!endsWith("le")`), so `file→fil` and `files→fil` agree — matches the documented intent ("trailing-e drop for long tokens") and existing route/scan/invoice/jobs/tech/technology test assertions still pass. (2) Make `tokenizeWords` canonicalize each token to its fixed point (`canonicalStem`: iterate `stemToken` until stable, max 4 passes — port vault.ts:830 verbatim or export it from algorithms and reuse). Neutralizes single-pass non-idempotence and makes phraseHits/fusionRank/intentLattice consistent.
- **Regression test:** `tokenizeWords("files")[0] === tokenizeWords("file")[0]`; same for `codes/code`, `pages/page`, `notes/note`; `intentLattice("rename pdf files into dated folders","custom-software").entities` includes `"file"`; `fusionRank("files",[{id:"r1",kind:"episodic",phase:1,text:"file list for the job",score:0.8}])[0].score > 0.218`.
- **Tag:** functionality.

## PB-02 — P1 — functionality/honesty — Runtime Log "Diagnose" fabricates green persistence + zeroed chatLog growth

- **Anchor:** `src/components/console.tsx:3267` (`runDiagnosis`) + `src/lib/rt-client.ts:680`.
- **Bug:** `buildClientDiagnosis` is called with `persistHealth: { ok: true, lastError: null }` hardcoded — a real persist failure still reports green. And `buildClientDiagnosis` hardcodes `chatLog: 0` in the growth block despite `project.chatLog` being present.
- **Fix:** In `RuntimeLogPane`, call `persistStorageHealth()` (exported at `store.ts:539`) and pass its result into `persistHealth`; capture the result in state (idempotent). In `rt-client.ts`, set `chatLog: input.project?.chatLog?.length ?? 0` instead of `0`.
- **Regression test:** `buildClientDiagnosis({project:{...mock, chatLog:[{...row}]}})` returns `growth.rows.chatLog === 1`; a unit asserting the UI passes `persistHealth.lastError` through when `persistStorageHealth()` reports an error.
- **Tag:** functionality/honesty.

## PB-03 — P1 — functionality — "Run live research (P7)" deep-seam is a permanently dead control

- **Anchor:** `src/components/console.tsx:4854` (`DEEPEN_ACTION_NAMES` / `findDeepenAction`) vs `src/lib/store.ts` (no deepen action) and `src/lib/engine.ts:1964` (`deepenResearch` exists as a free fn).
- **Bug:** `findDeepenAction` probes the store for `deepenResearchAsync|deepenResearch|deepenAsync|runDeepen`; none exist, so the affordance always renders "deepen seam is not available in this build" — even though `engine.deepenResearch` is implemented. E-21/E-13 wiring never completed.
- **Fix:** Add a store action (e.g. `deepenResearch: (id, phase) => serialized(id, () => deepenResearch(project, phase).then(p => ({ok:true, project:p})))` committed via `rebaseUserFields`) OR re-point `findDeepenAction` to a runtime resolver that calls `engine.deepenResearch` against the live project and commits the result through the store. Preserve the honest "unavailable" fallback.
- **Regression test:** With `deepenResearch` resolvable, `findDeepenAction()` returns non-null and a click produces "live research running…", not "not available".
- **Tag:** functionality.

## PB-04 — P1 — functionality — rt-client watchdog seam is entirely unwired (heartbeat/lag/stall/stall-latch never fire from a real run)

- **Anchor:** `src/lib/rt-client.ts:355` (`setBusyProbe`), `:366` (`tryStartWild`/`releaseWildStart`), `:476` (heartbeat loop reads `busyProbe`) vs console/store.
- **Bug:** `setBusyProbe`, `tryStartWild`, `releaseWildStart` have zero production callers (grep: only rt-client.test.ts). `busyProbe` stays null, so the §5.3 heartbeat → `sys.heartbeat_lag` → `sys.mainthread_stall` chain can never trigger for a console-driven wild run. The only watchdog that works is `WildConsole`'s own poll (console.tsx:735), a narrower stall check.
- **Fix:** In `WildConsole` (and the chat send path), register a busy probe via `setBusyProbe(() => …)` reading `useRapid.getState()` for the active wild run (mapping `wildRun.active/pause/startedAt/lastAutoAt/phase` into `RtBusyState`), clear on unmount/idle. Add `tryStartWild`/`releaseWildStart` around `store.startWildRun`'s single-flight entry so §5.5's latch actually guards.
- **Regression test:** After mounting `WildConsole` with an active run, `setBusyProbe` is called with a function; calling it returns the live `RtBusyState`.
- **Tag:** functionality.

## PB-05 — P2 — minor — wrong busy state in WildConsole "Stop" + unwired grounding-context meter

- **Anchor:** `src/components/console.tsx:798` (`onStop` sets `setBusy("resume")`); `src/lib/chat.ts:128` (`chatContextInfo`) has no UI call site.
- **Bug:** (a) `WildConsole.onStop` reuses `"resume"` as its busy mode — the Stop button shows the resume branch's spinner/affordance (semantically wrong, no functional break). (b) The documented "grounding-context meter (DF-13/P1-5)" — the exact characters/version the next reply is grounded in — has a working client wrapper (`chatContextInfo`) the ChatPane never renders.
- **Fix:** (a) Add a `"stop"` member to the `busy` union, use it in `onStop`. (b) In `ChatPane`, fetch `chatContextInfo(project)` into state, render a small `chars/max · context v<N>` meter next to the backend label; `null` → "context meter unavailable".
- **Regression test:** Unit that `onStop` sets the stop busy mode; ChatPane renders the meter when `chatContextInfo` resolves.
- **Tag:** minor-functionality.

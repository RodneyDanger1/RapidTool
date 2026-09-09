# 143 — G3 continuation audit: every "keep working on built software" surface, traced

Auditor G3 · read-only on src/scripts. Question: **can a user/agent tell RapidTool to KEEP
WORKING on software it already built — reopen it, resume it, iterate it, edit what it emitted?
What does each continuation surface actually do today, with file:line evidence?**

Bottom line up front: RapidTool is a **governed pre-flight compiler, not a builder**
(AGENT_GUIDE.md:5-7, in-app Guide console.tsx:856). Every continuation surface below
re-opens the *project ledger* (phases/artifacts/packet), and only along the one-way P0→P12
edge. There is **no surface that re-imports an emitted file tree and keeps building it**, no
post-completion iteration, and chat is advice-only. "Keep working on built software" today =
reopen the ledger, resume a parked/blocked run on the same edge, wild-run the same linear
pipeline, or hand the packet to an *external* coding agent and paste its report back as an
append-only note. The emit→edit→re-emit loop with the tree as the workspace does not exist.

---

## 1. Reopen / load an existing project

**UI (dev server, localStorage only).** All projects live in one zustand store persisted to
**localStorage** under the key `rapidtool.v4` (store.ts:766-768 `persistOptions`, partialize
`projects/activeId/autopilot/demoSeeded`; quota-safe wrapper store.ts:693-756; corrupt-blob
recovery + demo seed store.ts:761-795). **No indexedDB anywhere in src** (only denylist regexes
in codegen.server.ts:103 and sandbox.ts:13); the Neon/PGLite DB (`db.ts getSql`) is consumed
only by `src/lib/auth/middleware.ts` — never by project storage (AGENT_GUIDE.md:81 "does not
persist server-side (browser localStorage only)").
- Landing screen lists saved builds from the store — "Builds" rail (console.tsx:1042-1075);
  click → `select(p.id)` + navigate `/run/$id` (console.tsx:1057-1060). Status line shows
  `P{currentPhase} · {status}` (console.tsx:1065-1067).
- Reload rehydration runs `hydrateProject` repair per saved project (store.ts:775-795,
  seedIfEmpty store.ts:1572-1600).
- Import: a saved project JSON is parsed + shape-validated + hydrated by **io.importProject**
  (io.ts:260-324, cap 10 MB io.ts:31) and added-or-replaced in the store, becoming the active
  build (store.importProject store.ts:1551-1571). UI Import affordance console.tsx:1515;
  Export JSON console.tsx:1459-1470. The round-trip is the documented cross-machine handoff
  (AGENT_GUIDE.md:71-74, console Guide console.tsx:868).

**CLI.** Every mutating verb takes `--project <file.json>` (rapidtool-cli.mjs:278,
makeLoader 290-307 → headless.loadProject headless.ts:59-64, which is io.importProject —
same parse+hydrate+repair). Project files are written back atomically after mutating verbs
(headless.ts:67-83 saveProject). Example artifact on disk: `builds/recipe-box.json`.

**What reopen does NOT do:** reopening restores the *ledger*, not the *software*. A reopened
project continues at its recorded `currentPhase` edge; there is no notion of re-ingesting
source files an external builder produced (see §4).

## 2. Resume a paused / blocked run

**Blocked (reject-with-notes → retry).** The only interactive reopen of a rejected phase:
- Human rejects an open gate with ≥12 chars of feedback → phase record becomes `rejected`,
  project `status: "blocked"`, note + decision + memory row appended (store.reject
  store.ts:1406-1424; engine.rejectHitl engine.ts:1340-1397, rejectionHistory append-only).
- `retry` → engine.unlockRetry (engine.ts:1399-1427): **only** a `rejected` phase on a
  `blocked` project flips back to `ready`/`running`; any other state returns untouched.
  Store action store.ts:1468-1475; UI button + notice "Phase reopened — review the rejection
  notes, then re-run" console.tsx:1723-1725; CLI `retry` verb (README-cli.md #5).
- The rejection note persists on the record and steers the next attempt (re-surfaced verbatim
 to the wild classifier review, wild-mode.server.ts:100-112, and as `(stale)`-flagged memory
 in chat context chat.server.ts:160-187).

**Awaiting_hitl → approve/force.** `approve` completes the current phase and moves the cursor
(store.ts:1367-1405; engine.approveHitl engine.ts:1247+); autopilot/CLI `--force` guards and
the human-only failed-P6-sandbox override (store.ts:1376-1387) are the resume gates. CLI
`run`/`gate` park with exit code 2 when they stop at `awaiting_hitl`/`blocked`, 0 otherwise
(rapidtool-cli.mjs:342-355), so a driver loop can branch on the stop reason.

**Wild pause → resume.** A paused wild run keeps `active:true + pause:true` (the "PA-01
resume path"); the *driver that parked it has exited* (store.ts:988-991 returns `paused`), so
resuming = re-entering the driver. The store's only resume entry is **a second
`startWildRun` while `pause:true`** (store.ts:900-916; tested store.test.ts:956-971) or
headless `wildResumeRun` which just clears `pause` (headless.ts:1836-1859). Wrinkles found:
- UI Resume button calls only `toggleWildPause` (console.tsx:683-701), which flips the flag
  (store.ts:1026-1033) but starts no driver; `startWildRun` is called from exactly one UI
  site, the Wild enable toggle (console.tsx:433). A UI-resumed run is therefore
  `active:true, pause:false, driverless` — rendered RUNNING (console.tsx:498) with only a
  stale-run telemetry watchdog (console.tsx:655-667, emits `wild.step_timeout`, never
  restarts). The tested resume (startWildRun-while-paused) is not what the button does.
- After a reload, a persisted `active` wild run is force-stopped by hydration
  (engine.ts:1665-1694 hydrateWildRun; loud `wild.stop` log engine.ts:1967-1979), so CLI
  `wild --resume` (rapidtool-cli.mjs:1046-1047 → headless.wildResumeRun) always sees
  `active:false` → `not-active`, exit 1. The CLI even warns about this before acting
  (rapidtool-cli.mjs:1024-1033). Only a same-session UI pause (or a resumed driver re-entry
  that nothing wires) can resume; after any load the run must be **started fresh** from the
  current phase.

## 3. Wild mode — what startWildRun actually does, and its ceiling

Full chain: store.startWildRun (store.ts:871-1017) → engine.wildStep (engine.ts:3066-3279).
Step-by-step for one `startWildRun(id)`:
1. Guards: single-flight latch (store.ts:874, rt-client), project exists, `wildMode ===
   true`, not an unpaused double-start, and **`status === "complete"` → immediate
   `{ok:true, ran:0, stoppedReason:"complete"}`** (store.ts:917) — a completed project is
   never wild-iterated.
2. Stamps `wildRun {active:true, phase:currentPhase, pause:false, …}` + `wild.start`/resume
   log, commits (store.ts:922-971).
3. Driver loop: up to **20 steps** (store.ts:978); each step calls `wildStep`, commits via
   `commitWild` with concurrent-edit rebase (store.ts:959-970), and returns on pause
   (store.ts:988-991), `complete` (992-994), or cap → `wildPause` park "step cap (20)"
   (store.ts:999-1001).
4. One `wildStep` resolves exactly one edge (engine.ts:3060-3279): refused when
   mode-off/paused/**blocked**/already-**complete** (engine.ts:3126-3149); open gate →
   classifier self-approve or honest pause (engine.ts:3169-3171, 2887-2972); complete edge
   <P12 → classifier "advance" review (engine.ts:3173-3177, 2978-3042); locked/rejected →
   pause (engine.ts:3178-3201); else **execute the phase deterministically via
   applyPhaseResult** (engine.ts:3224-3233, log `wild.exec … (deterministic floor)`), then
   record gate, re-stamp packet, review to leave. P12 → `wildFinalize` stamps complete and
   stops the run (engine.ts:3045-3058, 3237-3242).
5. Reviewer = configured-only deepseek-v4-flash classifier (wild-mode.server.ts:243-306);
   not-configured → deterministic DoD floor for advance reviews, pause at human gates
   (engine.ts:2858-2878, 2910-2918). Hard-DoD (enforceDod) blocks pause the run
   (engine.ts:2948-2961, 3006-3019).

**Can it keep iterating a completed project? No.** Guards above: engine.ts:3147-3149
("Project already complete."), store.ts:917, headless wildStartRun noop (headless.ts:1760-1769).
Wild is a bounded governor over the *same one-way* P0→P12 pipeline; once P12 seals, `active`
flips false and no verb re-opens any phase. Notable consequence: **wild never produces the
keyed LLM module** — it executes `applyPhaseResult` (deterministic floor, engine.ts:3232-3233,
3279 docs), while the LLM brief-faithful P6 synthesis (`liveP6Synthesis`) runs only in the
async `liveLayer` path (engine.ts:2295-2333, reachable via store executeAsync/runUntilHitlAsync
or CLI `run --live`), never inside wildStep. Clone of a completed project (store.ts:1481-1509)
copies status `complete`, so it is equally unextendable.

## 4. The emitted software on disk — is there any re-import / edit / re-emit path?

**Emit exists and is one-shot.** CLI `emit --project f.json [--out dir] [--check]`
(rapidtool-cli.mjs:539-582) → headless.emitProject (headless.ts:1001-1022) →
scaffold.scaffoldProject writes a deterministic file tree (scaffold.ts header): README/DEPLOY/
.env.example, per-kind package.json+tsconfig, `.rapidtool/project.json` (the live project
export), browser boot files for webapp/game, `src/` modules per spec-graph node with the
generated module embedded verbatim (host file scaffold.ts:620-638), and real oracle tests.
`--check` per-file parse verdicts over the dir (compile-check.server.ts:1-38, CLI
case "check" rapidtool-cli.mjs:698-724). The emitted tree is stamped
"regenerate, don't hand-edit" (scaffold.ts:83 MACHINE_STAMP).

**Nothing reads an emitted tree back.** Consumers of an emitted dir: `check` (parse verdicts
only) and `mine --dir` (structural map for knowledge, headless.ts:1556) — neither edits nor
re-imports. `verify` machine-edits **`project.generatedSource` (one in-memory module string)**
via verify.server.ts / verify.ts and `--apply` persists verdict/lastTest back into the project
file — it never touches files on disk and cannot be pointed at an emitted tree. The scaffold's
`.rapidtool/project.json` *is* a valid `--project` file (io round-trip works), so a human
could manually feed it back to `run/gate/wild`, but: (a) nothing automates that, (b) once the
project is complete no verb advances it (§3), and (c) edits made to emitted `src/*` files are
invisible to every verb — regeneration overwrites them (scaffold machine-stamp). **There is no
emit→edit→re-emit loop; the tree is a deliverable, not a workspace.** The honest two-way
channel with the real builder is the packet + append-only report intake: `ingest` validates an
external agent's report and lands it as `[agent report]` artifacts/logs — "pure intake", gate
advancement stays with approve/execute (store.ts:1273-1318; README-cli.md #6). `deepen`
re-runs live research only over **completed** research phases 0/7/11 (headless.ts:1689-1704,
CLI rapidtool-cli.mjs:1146+).

## 5. Chat on a project — advice-only

Grounded copilot, one turn at a time: UI Chat tab → chat.ts `chatOnce` server fn (chat.ts:19-30,
58-73) → chat.server.ts `chatOnceServer` (chat.server.ts:267-360). The model sees a
deterministic ≤2500-char compaction of the whole project (buildChatContext chat.server.ts:113-221:
status/phases/gates/packet line/memory top-3/research count/lastTest/open HITL) plus ≤6 history
turns; system prompt rules 1-3 (chat.server.ts:82-91) say answer **only** from context and
"suggest next actions by concrete phase id". The reply is text + provenance stamp; **no code
path in the chat seam mutates the project** — the console send path appends the exchange to
`chatLog` only (console.tsx:4657-4679 → store.appendChatRows store.ts:1527-1536, cap 40).
"Can a user instruct changes and have them applied?" → **No**: chat never calls
execute/approve/retry/emit and has no tool loop. The copilot can tell you P4 is
`awaiting_hitl` and what to review; applying that is a button/CLI action. (CLI `chat`
rapidtool-cli.mjs:1087-1144 is the same function under bare Node; exit 3 when keyless.)

---

## What "keep working on this software" does today vs. would need

| Ask | Today (evidence) | Ceiling |
|---|---|---|
| Reopen a build | Builds rail → localStorage `rapidtool.v4` (console.tsx:1047-1073, store.ts:766-795); CLI `--project` file + import round-trip (headless.ts:59-64, io.ts:260-324) | Restores the ledger at its P0→P12 edge; no source-tree state |
| Resume a parked run | approve/retry reopen edge (store.ts:1367-1424, engine.ts:1399-1427); wild pause→startWildRun resume (store.ts:900-916) | Same-session wild resume only; reload force-stops runs (engine.ts:1665-1694); UI Resume unparks without a driver (console.tsx:683-701); CLI `--resume` dead after hydrate |
| Keep iterating automatically | Wild = bounded (20-step store cap, 24 CLI) classifier-governed **deterministic** P0→P12 loop (engine.ts:3066-3279) | `complete` refuses re-entry everywhere (store.ts:917, engine.ts:3147, headless.ts:1760); never emits the keyed LLM module (engine.ts:3232 vs 2304-2332) |
| Edit the built software | `emit` one-shot tree + `--check` parse verdicts; `verify --apply` fixes only `generatedSource` in the project JSON | No consumer reads emitted files; no emit→edit→re-emit; edits die on regenerate (scaffold.ts:83) |
| Instruct via chat | Grounded advice naming concrete phases (chat.server.ts:82-91, 267-360) | Advice-only; no action application (console.tsx:4657-4679) |

**What an emit→edit→re-emit continuation would need (not present today):**
1. a verb/surface that imports an emitted dir (or the `.rapidtool/project.json` inside it) as
   a workspace and can re-open the run loop past `complete` — i.e. an "iterate on built
   software" mode distinct from the sealed 13-phase ledger;
2. reading *edited* tree files back as the build's source of truth (today only
   `generatedSource` is ever edited, and only inside the project JSON);
3. wild/LLM execution paths that actually regenerate/replace tree files (wild is
   deterministic-only by construction today, §3) plus a guard that an edited tree is not
   silently overwritten on re-emit (the "regenerate, don't hand-edit" stamp scaffold.ts:83
   would have to be lifted or versioned);
4. a chat→action bridge if natural-language change requests are ever to land (today the
   console's only mutation paths are the explicit buttons/CLI verbs).

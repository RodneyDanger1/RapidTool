# console.tsx — competitor source badges (M-01-UI) + blocked-state guidance (M-12) + Spawn-crew panel (build agent flash #5)

- **File touched:** `src/components/console.tsx` ONLY (repo root `C:/Users/mnril/Desktop/RapidTool Main`, NOT git). All other files read-only.
- **Date / agent:** 2026-09-05 · Flash build agent #5.
- **Inputs:** `audit-bugs/05_multiagent.md` (M-01-UI at console.tsx:1570-1591, M-12 at :1611-1613 + store.ts:631 `guidance-` artifact) · `research/multiagent/03_crew_design.md` §6-7 (crew ingest seam + safety).
- **Concurrency note:** this pass ran while a sibling agent was writing `src/lib/crew.ts` + `crew.server.ts` and another was editing `src/lib/engine.ts` (M-01 engine side). console.tsx consumes the **landed** `crew.ts` API (verified on disk; see §4 for the drift between the design doc and the shipped contract).
- **Additive only:** every change is an addition or an extended table/state; no existing control flow, handler, or style was rewritten.

---

## 1. M-01-UI — per-row competitor source badge (scorecard table)

`ScorecardBlock` (`console.tsx`) previously rendered name/class/gap only; the engine's per-row `source` label was invisible. Now:

- New `<th>Source</th>` column (right-aligned; table `min-w` 520→640px to fit).
- Per-row badge in the last `<td>`:
  - `c.source === "cited"` → `cited` (ok-toned `border-ok/40 text-ok`), `title` = "Labelled “cited” by the engine — confirm the backing research artifact".
  - anything else (`"illustrative"` or the optional-field absent on legacy rows) → `illustrative template` (warn-toned `border-warn/30 text-warn`), `title` = "Deterministic template row — never present template prose as live research".
- Honesty contract (M-01 #3): an operator can now distinguish a verified row from a deterministic template row in the same UI that shows the table. UI-only fix — the engine-side source-promotion bug (M-01 #1/#2) is owned by the engine agent's pass.

## 2. M-12 — rejection guidance surfaced in the blocked state

`rejectAsync` (store.ts:631) appends a `docs` artifact `"Rejection guidance (LLM)"` (id prefix `guidance-`) after the project flips to `status: "blocked"` — but `HitlDock` returns null while blocked (hitl is null), so the guidance was only reachable via the artifacts tab.

- New module-scope helpers (console.tsx):
  - `latestRejectionGuidance(project)` — reverse scan of `project.artifacts` for the newest artifact whose `phase === project.currentPhase` and whose title starts with `Rejection guidance` (matches the store's exact title; engine never emits it).
  - `BlockedGuidanceBlock({ project })` — bordered warn-toned info block: mono caption "Rejection guidance (LLM) · advisory — deterministic deltas on regeneration may differ" + the artifact body as `whitespace-pre-wrap` text. Returns `null` when no guidance artifact exists.
- Rendered inside the `project.status === "blocked"` action fragment (right under the "rejected: …" note), so the freshest LLM steering is visible next to the Retry button without opening the artifacts tab.

## 3. Spawn-crew button + result panel (wired to `runCrew` → `ingestReport`)

New "Spawn crew" button in the phase-header action row — visible whenever `llmStatus.configured`, `Bot` icon, label flips to "Spawning crew…" while `busyAction === "crew"`. Runs under the same `busyRef` latch + `busyAction` as execute/run-to-gate, so no double-spawn and no concurrent engine run.

`onSpawnCrew()`:

1. `const res = await runCrew(current)` (client wrapper from `@/lib/crew`, imported statically; current = the live `Project` snapshot).
2. `ok:true` → build an `AgentReport`-shaped object and call the existing store seam `ingestReport(projectId, report)`:
   - `phase: current.currentPhase`
   - `status: "complete"` — or `"partial"` when `res.stopped` is `max-steps`/`cost-limit` (crew.ts ships guard-stops as `ok:true` + `stopped`; never label a guard-stop "complete").
   - `summary`: last message content (truncated at 400 chars with `…`) or a deterministic fallback naming turn count + phase title (validateReport requires non-empty).
   - `artifacts`: `res.artifacts.map(({title, body}) => …)` — lands via `validateReport`/`applyReport` as `[agent report]` artifacts with the `external report — unverified by engine` footer. Crew never touches gates/phase status (store owns advancement).
   - Success → green `notice` ("Crew run complete — N messages · M artifacts ingested as “[agent report]”."); ingest failure → honest error.
3. `ok:false` (`not-configured` | `error`) → honest error line naming the reason; deterministic engine result stays authoritative. (No fabricated session is ever shown — crew.ts returns no transcript on this arm.)
4. Any transport exception → "Crew run failed: <message>".

Result panel (rendered under the action row, above the ingest-report box, whenever the last run produced messages): header line with run state (`complete` / `partial — max-steps (guard stop)` / ingest-failure caveat) + one `<li>` per crew message: `#<idx> · <role> → <type>`, prose `content`, and an `artifacts:` line listing attached artifact titles. State lives in a local `CrewRunView` (component state only — no store change); cleared on the next spawn.

### New local types (module scope)
- `CrewMsgView { seq, role, type, to, content, artifactTitles }` — display view over `crew.ts`'s `CrewMessage`.
- `CrewRunView { ok, ingested?, stopped?, reason?, messages }` — panel state.

## 4. API drift notes (design doc §6.2 vs. landed crew.ts)

The landed `src/lib/crew.ts` differs from `research/multiagent/03_crew_design.md` §6.2 — console.tsx was adapted to the shipped contract:

| Design doc §6.2 | Landed crew.ts | console.tsx effect |
|---|---|---|
| `CrewSession`-wrapped result (`session.messages`/`session.artifacts`/`session.steps`) | top-level `messages: CrewMessage[]`, `artifacts: CrewPhaseArtifact[]` (`{phase,title,body}`), `stopped: "done"\|"final"\|"max-steps"\|"cost-limit"` | mapped top-level fields; no `steps` (derived from `messages.length`) |
| `CrewMessage` with `seq/from/to/ts/phase` | `{role, type, content, artifacts?}` only | panel uses index as seq, omits the `to` slot (empty string) |
| Guard stops = `ok:false` (`max-steps`/`cost-limit` reasons) | Guard stops = `ok:true` + `stopped`; `ok:false` only `not-configured`/`error` with no transcript | partial runs ingested as `status: "partial"`; failure arm shows honest error only |
| `status: "complete"` | `status: "partial"` used for guard stops | ingest label follows `stopped` |

## 5. Verification (as of this write-up)

- `npx tsc --noEmit`: console.tsx has **zero** errors. Only outstanding errors at write time were inside the sibling agent's in-progress `src/lib/crew.server.ts` (their TS2322 at :378, fixed by them after this pass) — re-run after their files settle.
- `npm test`: 185/195 pass. The 10 failures are all `scripts/**/*.test.mjs` platform-chrome / CLI-symlink tests (grok.me OG-metadata + symlinked CLI invocation) — pre-existing, environment/scripts-scope only, none touch `src/` or this change. The full src/lib TS suite is green.
- `npm run build` is gated on the sibling crew/engine files compiling (vite bundles console.tsx → crew.ts → crew.server.ts); re-run at the end of the wave.

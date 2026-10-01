# fixes/328_p4_switchboard.md — Wave 328, persona 4 (Switchboard: CLI & Console Engineer)

**Scope:** verify every assigned gap against disk, then close the real ones only.
**Owned files:** `scripts/rapidtool-cli.mjs` · `src/components/console.tsx` · `src/routes/**` ·
`src/lib/quarantine.ts` · `src/lib/quarantine.test.ts`. **This log is written incrementally.**

Repo: `C:\Users\mnril\Desktop\RapidTool Main`, branch `main`, HEAD `a1f4f10`, tree clean at start.

---

## 0. Method

Disk wins over any status doc. Every claim below is backed by a command whose real output is quoted.
No browser is available to this lane, no UI test harness exists (the src leg runs `src/lib/*.test.ts`
only — see §5), so interactive paths are stated as UNVERIFIED, never implied tested.

---

## 1. Gap ledger (verified against disk)

| # | Finding | Disk verdict | Action |
|---|---|---|---|
| 1 | R11-f08 `--force` quarantine in-engine lift | CLI wire + `quarantine.ts` LANDED; engine lift owed (needs `src/lib/headless.ts`, NOT owned) | CLI-side mixed-tree judging hole CLOSED (§2); engine lift REPORTED |
| 2 | R11-f01 dev-server bind hardening | ALREADY LANDED in `vite.config.ts:159-161` (loopback default + `RAPIDTOOL_BIND_ALL=1` opt-in) | confirmed honest-as-is; NOT my file |
| 3 | R6-f12 pane error boundary | `PaneBoundary` LANDED (console.tsx:1662, emits `ui.pane_crash` :1679); wraps Home + Run **center content**; sidebar + phase rail uncovered | extend boundary to cover all Run panes (§3) |
| 4 | `TODO(seat)` / `TODO(N2)` console labels | label text is honest; the **Unattended** row was STALE | struck the stale claim (§4) |
| 5 | sweep for other dead labels / TODO shells | one stale claim (unattended), no dead CLI verb branch | recorded below |

(placeholder — filled in as work lands)

---

## 2. R11-f08 — `--force` quarantine: the in-engine lift, and the CLI hole I could close

**What is on disk (verified).** `src/lib/quarantine.ts` (the move seam) and the CLI wire are landed.
`src/lib/headless.ts:2185` `emitProject` still KEEPS foreign survivors in place
(`survivors: opts.force === true ? foreign : []`) — i.e. the engine itself does not quarantine. The
ONLY production caller that passes `force:true` is the CLI `emit` arm (checked: `headless.ts:2512`
uses `{redTree:"probe"}`, `scripts/run-eval.mjs:2046` uses `{redTree:"banner"}`, `headless.test.ts`
uses `force:true` in tests only). So every real forced emit goes through the CLI, which DOES
quarantine — before the judging legs:

```
1575  if (Array.isArray(res.survivors) && res.survivors.length > 0) { … quarantineFiles … }
```
and the comment at :1568 asserts those legs then "judge the intended tree only (A1-f07)".

**The hole.** If the quarantine move FAILS, the old code set `payload.ok=false` and then **fell
through** into `--verify-kind` / `--check` / `--run` anyway. Those legs then judged a tree that STILL
held the foreign survivors, and a green `--run` would mint `label:"tested"` over those bytes — the
exact A1-f07 defect the move exists to prevent. That is reachable (a locked file on Windows, a
cross-device copy failure, an un-creatable quarantine dir).

**Fix (my file, additive).** `scripts/rapidtool-cli.mjs` — new `foreignLeftInPlace` latch; when the
move reports `ok:false` the three judging legs are gated behind `!foreignLeftInPlace`, and the
envelope carries a loud `judgingSkipped` string. Exit taxonomy unchanged (the failure already exits
1 with `RT_E_FOREIGN_FILES`). Also updated the `quarantine.ts` wiring docstring to record the guard;
the `TODO(R11-f08)` (lift INTO `emitProject`) is STILL accurate and stays.

**Empirical proof (real command, real output).**

Happy path — `emit --force --check` into a dir holding `NOTES.md`:
```
"quarantined": [ "NOTES.md" ],
"quarantineDir": "...\\emitted\\.rapidtool-quarantine\\2026-10-01T17-06-50-477Z",
"check": { "ok": true, "checked": 8, "passed": 8, "failed": 0, ... },
"exit_code": 0
```
→ the foreign file moved aside; `--check` still ran (the guard does NOT disable the good path).

Failure path — same emit with `.rapidtool-quarantine` pre-created as a FILE so the move cannot land:
```
"ok": false,
"quarantined": [],
"quarantineFailed": [ { "path": "NOTES.md", "error": "move failed: ENOENT … copyfile …" } ],
"code": "RT_E_FOREIGN_FILES",
"judgingSkipped": "foreign files could not be quarantined — --verify-kind/--check/--run did not run (the tree is still mixed; R11-f08 · A1-f07)",
"exit_code": 1        ← and NO "check" / NO "treeRun" field
```
→ the legs did not run and no `tested` mint could fire over the mixed tree.

**Left owed / not mine (STOP-and-REPORT).** The true in-engine lift — quarantine INSIDE
`emitProject` so *every* future forced caller is covered, not just the CLI — needs
`src/lib/headless.ts`, which is **not in my owned set** (and is being edited by a sibling this wave:
`git status` shows it modified). Recorded, not attempted.

---

## 3. R6-f12 — pane error boundary: verify, then extend

**What is on disk (verified).** `PaneBoundary` EXISTS (`console.tsx:1662`), emits exactly one
`ui.pane_crash` row with a dev re-bubble dedupe (`markBoundaryError`, :1677), and the fallback keeps
a "Try again" control — no fake recovery. It already wrapped the Home content (:1770) AND the Run
**center** content (`<PaneBoundary label="Run screen">`, now :2828). RS-04's "RunScreen **unwrapped**"
is **stale** — disk wins.

**The remaining gap.** The phase rail and the right sidebar (gate health, shell surfaces, diagnostics)
were SIBLINGS of that boundary, so a throw in either still unmounted the whole Run screen via the
router-level `AppErrorComponent`. **Fix (my file, additive):** wrapped `<PhaseRail>` in
`<PaneBoundary label="Phase rail">` and the `<aside id="run-sidebar">` in
`<PaneBoundary label="Run sidebar">`. `PaneBoundary` returns its children unchanged when healthy (no
wrapper DOM node), so the 3-column grid is unaffected.

**NOT verified.** No browser is available and there is NO UI test harness — the src leg runs only
`src/lib/*.test.ts` (no jsdom / react-testing-library / `react-dom/server` render path is wired into
any suite; `package.json` has no DOM test deps). So the "forced-throw pin" the finalsprint row asks for
(`pin: forced throw keeps the shell mounted, one row lands`) **could not be added** without a new test
dependency — which the brief forbids. Reported as owed; the boundary logic itself is type-checked.

---

## 4. `TODO(seat)` / `TODO(N2)` — keep the honest label; strike the stale one

- **`TODO(seat)`** (`console.tsx:7118`, "no console delivery seam yet — the CLI carries the
  out-of-band token"): verified honest. `src/lib/seat.ts` / `seat.server.ts` are NOT on disk
  (`Test-Path` false), the console approve path stamps `decidedBy:"human"` via `store.ts:1761` with no
  token, and the row's `title` discloses exactly that. No control added — **honest as-is**; wiring a
  real seat needs `seat.ts`, not my file.
- **`TODO(N2)`** (`console.tsx:7070`, "checkpoint reads are server-side — no console read seam"):
  verified honest. `src/lib/checkpoint.server.ts` IS on disk but is server-only (`node:fs`), and the
  console has no project→dir mapping, so it cannot read `.rapidtool/checkpoint.json`. **Honest as-is**;
  a seam needs a new server-fn route + the dir mapping, which is not a patch-only change (reported).
- **Unattended row (`W-47`) — this one was STALE, and I fixed it.** The row said
  *"refused by design — no scheduler/daemon host (`RT_E_UNATTENDED_UNSUPPORTED`)"*. Reality on disk:
  the `unattended` CLI verb is REAL (`rapidtool-cli.mjs:944` case arm; README-cli §35-36) and
  `RT_E_UNATTENDED_UNSUPPORTED` is registered in `errors.ts` (:79/:533) but has **ZERO throw sites**
  (grep over `src`+`scripts` = registration only). So the label named a refusal that never fires while
  hiding a working verb. **Struck** the "refused by design (RT_E_…)" text and rewrote the row to the
  real state: *"no in-product scheduler — the CLI `unattended` verb resumes from a checkpoint when an
  external hook invokes it; stock HITL gates still park"*, with the honest limits in `title`. Also
  corrected the ShellSurfacesCard truth-source note (`console.tsx:7004`). Still text-only — no fake
  control added. (`errors.ts` is not mine, so the unthrown code stays registered; flagged in §6.)

---

## 5. Sweep results (issue 5)

- **CLI dead/inactive verb branches:** none. `grep -c 'case "' scripts/rapidtool-cli.mjs` = **39**,
  and every arm listed resolves to a distinct verb (create…diagnose). No unreachable `case`.
- **Stale labels in my files:** one found (the Unattended row) → fixed (§4). The remaining shell rows
  (Wild plan · R13-f02 · Token streaming · Cassette · Isolation · Human seat · Checkpoint) each match
  disk (verified individually) — kept as honest labels.
- **`TODO(` shells in my files:** `quarantine.ts` `TODO(R11-f08)` (needs `headless.ts` — reported);
  `console.tsx` `TODO(N2)` / `TODO(seat)` / `TODO(R13-f04)` (each names a server seam not on disk —
  kept as honest labels, reported).
- **Routes:** `src/routes/**` are thin and correct (`index.tsx`, `run.$id.tsx`, `__root.tsx`); no
  unwired affordance, no `TODO(`. `run.$id.tsx` already keys `<RunScreen key={id}>` per project.

---

## 6. Cross-lane / not-mine items (STOP-and-REPORT)

1. **R11-f08 in-engine lift** → `src/lib/headless.ts` (not owned; sibling editing). §2.
2. **R11-f01 dev-server bind hardening** → ALREADY DONE in `vite.config.ts:145-161` (loopback default,
   `RAPIDTOOL_BIND_ALL=1` opt-in, port 8080/strictPort unchanged, dev script no longer `--host`).
   Nothing owed; not my file.
3. **R6-f12 forced-throw pin** → needs a DOM test harness or a `scripts/*.test.mjs` pin; both outside my
   owned set (scripts tests are not mine). §3.
4. **`RT_E_UNATTENDED_UNSUPPORTED`** is registered with no throw site (`errors.ts`, not mine) — flagged
   so its owner can either wire it or strike it.

---

## 7. Commands run + real results

| Command | Result |
|---|---|
| `npm run typecheck` | **exit 0** (first attempt raced a sibling `npm install` that temporarily emptied `lucide-react` types → 2 transient TS7016; clean on re-run) |
| `& node22 --test --test-reporter=tap "scripts/**/*.test.mjs"` | **371 tests, 371 pass, 0 fail, 0 skipped**, exit 0 |
| `& node22 --experimental-strip-types --test --test-reporter=tap "src/lib/quarantine.test.ts"` | **5 pass, 0 fail**, exit 0 |
| forced-emit happy-path probe (§2) | `quarantined:["NOTES.md"]` + `check` ran, exit 0 |
| forced-emit failure probe (§2) | `ok:false` + `judgingSkipped`, no `check`/`treeRun`, exit 1 |

**Interactive paths NOT exercised (no browser, no UI harness):** the pane boundary's crash/fallback
rendering and "Try again" recovery for the Home / Run-content / Run-sidebar / Phase-rail panes; the
approval dock; every console visual. All console edits here are type-checked and additive only.


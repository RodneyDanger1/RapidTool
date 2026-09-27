# W34b · CODE-NOTES — 2 read-only analysts: every small bug, bad pattern, and weak spot — with instructions.
**Readers share this file.** Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; `grep`). HEAD `0f85c32` + the W29–W33 era (L1/L2/L3 + P1/P2/P3 may be landing beside you — re-read bytes; NEVER touch product code).
**MANDATE:** find and LIST — read-only, no edits — small bugs, badly-written code, weak spots and gaps across your half. For EVERY item, three things minimum: **① WHAT & WHERE** (file:line, the code quoted) · **② WHY IT'S WRONG / THE FAILURE MODE** (what breaks, when, for whom — or why the writing is bad: fragile, duplicated, unclear, over-clever) · **③ HOW TO FIX IT** (the concrete change — a mini code sketch where useful — plus the done-when). Then, where the code is *badly written rather than broken*, the **④ BETTER-WAY note** (the idiom this repo should use instead — cite good examples from the tree: the seam-cast idiom `as unknown as typeof r`, the marker protocol, the FixturesPanel honesty pattern, `path-safety.mjs`'s realpath approach…).
**ALSO (both): a final "FOR THE CODERS" mini-guide section** — 10–15 rules drawn from what you saw: how to write code THIS repo will accept first try (test contracts to respect, the code-only wave rules, the no-tty test-leg quirk, the fuzzy-patch pitfall, the declare-or-strike law, byte-compat rules, collision etiquette, the E-15 marker + RT_E_VALIDATION prefix, log-and-continue).
**BE EXTENSIVE** — dozens of items is right; small-and-real beats big-and-vague; every claim byte-checked (grep/read TODAY). No test runs; no builds; no keyed calls; log-and-continue.
**RECORD:** `wave_plans/W34/code-notes.md` — append-only via END-OF-FILE-MARKER-NOTES; §A1/§A2 are yours; re-read before EVERY append. Lane logs `fixes/279_a<n>_codenotes.md` EARLY.

## A1 — THE RUNTIME HALF
`src/lib/**` core: engine.ts · store.ts · phases.ts · dod.ts · gates* · packet.ts · io.ts · codegen.server.ts · scaffold.ts · compile-check.server.ts · llm/** (incl. providers) · all `*.server.ts` seams · rt-* telemetry · types.ts · errors.ts. Read for: latent crashes (null/undefined paths, unguarded renders), silent catches, contract mismatches between siblings (io↔hydrate validators class), duplications that will drift, dead code, over-broad types, error messages that mislead, byte-compat hazards, unbounded growth. ALSO review the newest additions critically (checkpoint.server.ts — the parent wrote it tonight: find ITS weak spots honestly: e.g. buffer/typing/perf/edge cases), wild-review.ts, the W29–W33 patch sites.

## A2 — THE PERIPHERY HALF
scripts/** (CLI arms incl. the new resume/unattended as they land, run-eval, gate.sh, guards, path-safety.mjs, migration-plan/migrate, write-*), src/components/** + routes/** (console.tsx above all: render risks, state holes, a11y, wording), tests/guards quality (vacuous asserts, blind spots), configs (tsconfig chain, vite, package.json), docs-vs-code drift, migrations' resilience, and the shell-sprint's new files. Same ①②③④ treatment; same final mini-guide.

---

# §A1 — THE RUNTIME HALF (lane 279 · A1 · read-only)

**Reader:** A1 runtime-half analyst (runtime half = `src/lib/**` core). **Byte state:** every quote below re-verified by read/grep on 2026-09-26 ~19:30–20:00 (HEAD `0f85c32` + the W29–W33 working-tree era; `src/lib/store.ts` mtime 19:07 and `src/lib/scaffold.ts`/`headless.ts` 19:42–43 — sibling lanes are live, so **line numbers are at-read-time**; re-grep before acting). `checkpoint.server.ts` and `wild-review.ts` are **untracked** (`git status --short` → `??`). No product file touched by this lane.
**Notation:** ① WHAT & WHERE (code quoted) · ② WHY WRONG (failure mode) · ③ FIX + done-when · ④ BETTER-WAY (writing problems only). ✦ = newest additions, reviewed critically as asked.

Verification appendix (raw evidence used):
- `git status --short -- src/lib/checkpoint.server.ts src/lib/wild-review.ts` → `?? src/lib/checkpoint.server.ts` / `?? src/lib/wild-review.ts` (never committed).
- `grep -rn "writeCheckpoint\|readCheckpoint\|clearCheckpoint\|checkpointAdmits" src scripts` (excl. the module itself) → **zero hits** — the checkpoint module has **no consumer anywhere yet**.
- `grep -rn "tooLargeToPersist" src scripts` → the string exists **only in io.ts:34's comment**.
- `grep -rn "slice(-200)" src/lib src/routes src/components` → 30 sites (list in A1-47).
- `grep -rn "CHAT_LOG_MAX_ROWS" .` → only store.ts:102's comment (+ a `.t4scratch/lib/store.ts` copy). No definition.
- `grep -rn "HITL_PHASES" src scripts` → production-dead (tests only); `STOCK_HITL` duplicated literal in phases.ts/store.ts.

---

## ✦ A1-01 · `readCheckpoint` throws before its own guard (the module's core law violated)
**① WHERE** `src/lib/checkpoint.server.ts:142-146`:
```ts
export function readCheckpoint(projectDir: string): CheckpointReadResult {
  const path = checkpointPath(projectDir);
  if (typeof projectDir !== "string" || projectDir.length === 0) {
    return { ok: false, code: "RT_E_CHECKPOINT_MISSING", error: "checkpoint: empty projectDir", path };
```
`checkpointPath` (L39-41) is `return join(projectDir, ".rapidtool", "checkpoint.json");`.
**② WHY WRONG** The guard exists precisely for junk input, but `join()` runs FIRST — `readCheckpoint(undefined as never)` / `null` / a number throws `TypeError` inside `node:path` before the guard is reachable. The module header's load-bearing law (L10-11) is "read NEVER throws on junk; it returns a coded refusal … Callers branch on `ok`, never on exceptions" — every caller written to that law breaks on exactly the input the law names. (For `""` it survives but returns a *relative* bogus path `.rapidtool/checkpoint.json` in the MISSING envelope.)
**③ FIX** Validate before deriving: move the `typeof projectDir !== "string" || length === 0` check to the top and compute `path` only after it (returning `path: ""` in the refusal). Same pattern in `clearCheckpoint` (A1-06). Done-when: a unit test calls `readCheckpoint(undefined as never)` and gets the coded refusal, and `readCheckpoint("")` reports a MISSING whose `path` is not a fabricated relative path.
**④ BETTER-WAY** Order-of-operations discipline: in this repo every public seam returns `{ok:false, code}` unions (see `deepseek.server.ts`'s re-export envelope family, `io.ImportResult`) — a validator placed *after* a thrower is dead code that merely looks like defense. Put the guard first, always.

## ✦ A1-02 · `writeCheckpoint` can throw outside its try (partial project / missing `logs`)
**① WHERE** `checkpoint.server.ts:69-84` + `:118-123`:
```ts
  const bounded: Project = {
    ...project,
    logs: project.logs.slice(-CHECKPOINT_CAPS.logs),
    decisions: project.decisions.slice(-CHECKPOINT_CAPS.decisions),
  };
  if (Array.isArray(project.memory)) { bounded.memory = project.memory.slice(-CHECKPOINT_CAPS.memory); }
```
```ts
  const payload: RunCheckpoint = { version: CHECKPOINT_VERSION, savedAt: Date.now(), run, project: boundProjectForCheckpoint(project) };
```
**② WHY WRONG** `memory`/`artifacts`/`research` are `Array.isArray`-guarded, but `logs`/`decisions` are **not** — a partial/persisted-legacy project (the exact class the module says it defends) throws `TypeError: project.logs.slice is not a function` at L122, which sits **outside** both try blocks (they wrap only `JSON.stringify` and the fs calls). The declared contract "Returns a coded refusal instead of throwing on I/O failure" (L105) is false for shape failure. Also `run` is only checked for finite phase/step after A1-04.
**③ FIX** Either guard every slice (`Array.isArray(project.logs) ? project.logs.slice(-cap) : []`), or move the `boundProjectForCheckpoint(project)` call inside the first try so the coded-refusal path covers it. Done-when: `writeCheckpoint(dir, { id: "x", phases: [/*…*/] } as Project, run)` returns `{ok:false, code:"RT_E_VALIDATION"}` (or a coded envelope), never throws.
**④ BETTER-WAY** The bound-on-a-COPY idea is right; express it through one helper that takes `unknown` and returns `unknown[]` (`asArray(v)` idiom used in engine.ts hydrate: `const rawLogs = Array.isArray(raw.logs) ? raw.logs : [];`) so "bound" can't be half-applied field-by-field.

## ✦ A1-03 · The caps comment is false in BOTH directions — three cap vocabularies (drift)
**① WHERE** `checkpoint.server.ts:29-36`:
```ts
/** Trim caps — kept identical to store.ts's salvageTrim so both layers bound the same fields. */
export const CHECKPOINT_CAPS = { logs: 200, decisions: 100, memory: 80, artifacts: 120, research: 24 } as const;
```
vs `store.ts:696-697` + `:740-743`:
```ts
const RESCUE_LOG_CAP = 200;
const RESCUE_CHAT_CAP = 40;
…
const logs = Array.isArray(rec.logs) ? (rec.logs as unknown[]).slice(-RESCUE_LOG_CAP) : rec.logs;
const chatLog = Array.isArray(rec.chatLog) ? (rec.chatLog as unknown[]).slice(-RESCUE_CHAT_CAP) : rec.chatLog;
```
**② WHY WRONG** Byte-checked: `salvageTrim` bounds **logs + chatLog only** (200 / 40) and never touches `decisions`/`memory`/`artifacts`/`research`; the checkpoint bounds **logs/decisions/memory/artifacts/research** and **never bounds `chatLog`**. So (a) the "kept identical" claim is false, and (b) a checkpoint of a long keyed run carries `chatLog` (capped at 40 by `appendChatRows` today, but unbounded from imports/legacy) while claiming to mirror a layer that would trim it. A third vocabulary lives in io.ts:411's bare `.slice(-200)`.
**③ FIX** Reword to the truth and share the numbers: one exported `HISTORY_CAPS` (say in `types.ts` or the checkpoint module) consumed by `salvageTrim` **and** `CHECKPOINT_CAPS` **and** io's repair-log slice; extend salvageTrim to the same 5 fields it's safe to trim. Done-when: grep for `slice(-200)`/`slice(-40)` finds only references to the shared constant (see A1-47), and the comment matches the code.
**④ BETTER-WAY** This repo already has a constant-sharing precedent (RESCUE_* in store.ts; `LOG_KEEP/LOG_ROTATE_BYTES` in rt-events.ts). Cap literals are exactly what "duplications that will drift" means here — every new write seam copies `200` and the next audit re-finds it.

## ✦ A1-04 · `writeCheckpoint` writes unvalidated `run.mode` to disk (a checkpoint the reader can never read)
**① WHERE** `checkpoint.server.ts:114-122`:
```ts
  if (!Number.isFinite(run?.phase) || !Number.isFinite(run?.step)) {
    return { ok: false, code: "RT_E_VALIDATION", error: "checkpoint: run.phase/step must be finite" };
  }
  …
  const payload: RunCheckpoint = { version: CHECKPOINT_VERSION, savedAt: Date.now(), run, project: boundProjectForCheckpoint(project) };
```
vs the reader's `isRunCheckpoint` (L95): `if (run.mode !== "keyless" && run.mode !== "keyed") return false;`
**② WHY WRONG** TypeScript types don't exist at runtime: a JS caller (or a future CLI assembling `run` from argv) can pass `mode: "Keyed"` (case slip) or omit it; the writer happily persists it, and then `readCheckpoint` refuses the very file the writer promised is fine — the resume path then reports "unrecognized shape or version" on a checkpoint the product itself wrote. Self-invalidation, silent until resume time. `phase` is also only "finite" (1.5 passes write, fails no reader check, and resume math is the caller's).
**③ FIX** Validate on write exactly as on read: `if (run?.mode !== "keyless" && run?.mode !== "keyed") return coded refusal;` and require integer phase ≥ 0 (range 1..13 stays the caller's table per the L184-186 TODO — document that in the refusal text). Done-when: writing `{mode:"Keyed"}` returns a coded refusal and no file is created.
**④ BETTER-WAY** "Validate at the boundary you own" — the repo's `io.importProject` does exactly this (fail-fast whitelist before hydration). A writer/reader pair sharing one `isRunCheckpoint`-style predicate (export it) makes write/read drift impossible.

## ✦ A1-05 · Checkpoint refusals misclassify I/O failures as `RT_E_VALIDATION`
**① WHERE** `checkpoint.server.ts:136-138` and `:152-155`:
```ts
  } catch (error) {
    return { ok: false, code: "RT_E_VALIDATION", error: `checkpoint: write failed (${String(error)})` };
  }
```
```ts
    text = readFileSync(path, { encoding: "utf8" });
  } catch (error) {
    return { ok: false, code: "RT_E_VALIDATION", error: `checkpoint: unreadable (${String(error)})`, path };
```
**② WHY WRONG** `RT_E_VALIDATION` tells every consumer "the payload is bad" — but EACCES/ENOSPC/EBUSY are environment failures; `errors.ts` minted `RT_E_PERMISSION_DENIED` / `RT_E_DISK_FULL` (and `classifyError` maps them) precisely so agents "do not retry the same path unchanged". A disk-full resume reported as VALIDATION will read as "the checkpoint is garbage — start over" (data loss by advice), not "free space". Also inconsistent: empty `projectDir` reads as `RT_E_CHECKPOINT_MISSING` (L145) while the writer's empty-dir refusal is VALIDATION (L109).
**③ FIX** `code: classifyError(error, "RT_E_VALIDATION")` on both catch paths (import from `./errors.ts` — pure, client-safe), and pick ONE class for an empty dir (VALIDATION, since it's an argument error, or MISSING on both sides — document the choice). Done-when: a write into a read-only directory surfaces PERMISSION_DENIED; the empty-dir class is consistent across read/write/clear.
**④ BETTER-WAY** `classifyError` exists for exactly this; `liveLayerFailureRow`/`liveDegradeCode` (engine.ts:3314) show the in-repo pattern of classifying before coding.

## ✦ A1-06 · `clearCheckpoint` — same order-of-operations hole, and no `projectDir` guard at all
**① WHERE** `checkpoint.server.ts:169-172`:
```ts
export function clearCheckpoint(projectDir: string): { ok: true } | { ok: false; code: "RT_E_VALIDATION"; error: string } {
  const path = checkpointPath(projectDir);
  try {
```
**② WHY WRONG** `checkpointPath(undefined)` throws before the `try` that the function's own union type promises covers failures; there is no `typeof` guard anywhere in the function, unlike its read/write siblings. A resume CLI that clears after success with a partially-parsed arg crashes at the *happy* path's tail.
**③ FIX** Guard first (`typeof projectDir !== "string" || length === 0` → coded refusal), then derive `path` inside the try. Done-when: `clearCheckpoint(undefined as never)` returns a coded refusal.
**④ BETTER-WAY** Factor `checkpointPath`'s consumers through a tiny `resolveOrRefuse(projectDir)` helper — three copies of "validate then join" is how one of them ends up wrong (it did).

## ✦ A1-07 · `checkpointAdmits` is identity+mode only — no staleness, no phase sanity, no version re-ask
**① WHERE** `checkpoint.server.ts:188-203`:
```ts
export function checkpointAdmits(checkpoint: RunCheckpoint, ask: { projectId: string; mode: "keyless" | "keyed" }): …
  if (checkpoint.project.id !== ask.projectId) { … }
  if (checkpoint.run.mode !== ask.mode) { … }
  return { ok: true };
```
with the TODO at L181-186 ("the phase-validity range check (1..13) belongs to the caller's phase table").
**② WHY WRONG** A checkpoint found on disk from *six weeks ago*, or one whose `run.phase` is `99` (read side doesn't range-check either), or one saved under a same-id different-brief project (id reuse after clone/edit) all `admit`. The gate reads as "identity and mode still match the request" (L182) and that's all it is — resume then re-enters at a garbage phase or silently resurrects an ancient graph. This is the function the CLI will branch on, so the honesty of the *whole* resume path rests on these two lines.
**③ FIX** Keep the TODO's table-free stance but add what's cheap and table-free: `Number.isInteger(checkpoint.run.phase) && checkpoint.run.phase >= 0` here, and surface `savedAt` to the caller in the admit result (`{ok:true, savedAt}`) so the CLI can apply a max-age policy and PRINT the snapshot age in its resume prompt. Done-when: admitting a `phase: 99` snapshot fails closed, and the CLI's resume output names the snapshot age (never resumes silently).
**④ BETTER-WAY** "Admission decisions belong to the seam, not scattered in callers" — the policy.ts / evaluatePolicy precedent: one predicate owns the whole verdict.

## ✦ A1-08 · Fixed-name `.tmp` staging: concurrent writers can publish torn bytes on Windows
**① WHERE** `checkpoint.server.ts:130-135`:
```ts
    mkdirSync(dirname(path), { recursive: true });
    const staging = `${path}.tmp`;
    writeFileSync(staging, text, { encoding: "utf8" });
    renameSync(staging, path); // atomic on same-volume rename; torn files are impossible
```
**② WHY WRONG** The atomicity claim holds for ONE writer, but the staging name is fixed per project: two writers (CLI run + a console/headless process, or two CLI invocations) interleave `writeFileSync` on the same tmp — truncate+write from two handles interleaves bytes — and on Windows `renameSync` REPLACES the destination silently, so a mixed tmp is published as the "atomic" checkpoint and *read back as valid JSON* (both halves happened to be JSON). No fsync either, so the crash-during-kernel-buffer window the header sells ("a crash mid-write can never leave a torn checkpoint") is only true at the rename layer.
**③ FIX** Unique staging: `${path}.${process.pid}.${Date.now()}.tmp` (then rename; a stale `.tmp` sweep in `clearCheckpoint` already exists for the old name — extend the pattern), or document/assert single-writer and keep the fixed name deliberately. Done-when: a comment states the single-writer assumption OR two concurrent writers cannot collide on the staging path.
**④ BETTER-WAY** The repo already thinks in "write-atomic" terms (`scripts/write-atomic.mjs`); a checkpoint that wants the same guarantee should copy that module's behaviour (unique tmp + rename) instead of re-deriving it in-line.

## ✦ A1-09 · Reader returns a strongly-typed `RunCheckpoint` whose nested `Project` was never validated (type lie at the seam)
**① WHERE** `checkpoint.server.ts:96-100` (checks) and `:165` (return):
```ts
  const project = candidate.project as Partial<Project> | undefined;
  if (!project || typeof project !== "object") return false;
  if (typeof project.id !== "string" || project.id.length === 0) return false;
  if (!Array.isArray(project.phases) || project.phases.length === 0) return false;
```
```ts
  return { ok: true, checkpoint: parsed, path };
```
**② WHY WRONG** Only `id` and `phases` are proven; everything else (`logs`, `memory`, `decisions`, `artifacts`, `currentPhase`, …) rides onto a value the type system advertises as full `Project`. The header says the checks are "enough to refuse junk, never enough to guess" — fine — but the return type should not then *guess for the caller*. Any consumer that trusts the type and touches `project.logs.length` (the A1-42 bug class) crashes on a checkpoint that read "ok".
**③ FIX** Two honest options: (a) type it truthfully — `checkpoint: RunCheckpoint` where `RunCheckpoint.project: Partial<Project> & Pick<Project, "id"|"phases">` is overkill; simpler (b): document on `CheckpointReadResult` — "shape is minimal; run `hydrateProject` before use" — and have the future resume path call `hydrateProject` (which repairs/defends). Done-when: the contract text where consumers read it says the read side is minimal + the resume path hydrates.
**④ BETTER-WAY** "Readers refuse; hydrators repair" — engine.hydrateProject is the repo's one repair pass; the checkpoint reader should piggyback its *contract*, not duplicate 200 lines of shape checks.

## ✦ A1-10 · `wild-review.ts` swallows every load failure silently — a broken provider is indistinguishable from "no key"
**① WHERE** `src/lib/wild-review.ts:109-113`:
```ts
  } catch {
    // Missing provider module / load failure — the engine's default resolution
    // stays in charge (honest not-configured path), never a fake reviewer.
    return null;
  }
```
**② WHY WRONG** `null` means "keep the engine default" — but the engine default then reports *not-configured* for the Auto-Review verdict. If `deepseek.server.ts` fails to load because of a genuine bug (bad export name, ESM/CJS break, a bundler denial), the product tells the operator "no backend → deterministic floor", which is the wrong story AND invisible in telemetry (`reportRt` exists and this module is client-safe — nothing prevents logging). Debugging this seam today means adding a console line and re-running.
**③ FIX** Log before returning null: `reportRt({ level: "warn", scope: "wild", event: "wild.reviewer_load_failed", message: String(error), capture: "src/lib/wild-review.ts:createNodeWildReviewer", err: error })` (keep `return null`). Done-when: a deliberately broken import shows a warn row in the runtime ring on a bare-Node wild start.
**④ BETTER-WAY** The repo's silent-catch doctrine is "degrade silently ONLY where the failure is the expected path" (e.g. `currentStorage()` returning undefined). A failed *dynamic import of our own module* is never the expected path — see engine's `upgradeP6Keyed`, whose catch comment is honest but which at least preserves the floor *and* has the codegen refusal logs behind it.

## ✦ A1-11 · wild-review.ts carries the same TODO twice (and both name the same lane)
**① WHERE** `wild-review.ts:35-40` and `:95-99` — two `TODO(R14-f01)` blocks with the same content ("the keyed evidence run … plus any remaining driver threading … land with the funded boundary run"). 
**② WHY WRONG** Duplicate lane notes drift (one gets updated when the work lands, the other becomes a lie); also they sit inside an `async` function body, so every implementation should re-read both before touching. This is a brand-new file that already has a redundancy.
**③ FIX** Keep the header block (module contract) and delete/merge the in-body one, or make the in-body one a pointer (`// see header TODO(R14-f01)`). Done-when: `grep -c "TODO(R14-f01)" src/lib/wild-review.ts` → 1.
**④ BETTER-WAY** One authoritative note per lane item, in the file header where reviewers read it (the repo's header-block convention covers this).

## ✦ A1-12 · The concatenated dynamic-import idiom now exists in 4 places — extract it before it drifts
**① WHERE** `engine.ts:2871` (`const dsSpec = "./deepseek." + "server.ts";`), `store.ts:951` (`const headlessSpec = "./headless." + "ts";`), `wild-review.ts:86` and `:100`:
```ts
    const dsSpec = "./deepseek." + "server.ts";
    …
    const wmSpec = "./wild-mode." + "server.ts";
```
**② WHY WRONG** The idiom exists to defeat the TanStack import-protection plugin's static specifier match. Four hand-rolled copies means: a plugin/rule change (or a bundler that normalizes string concatenation) breaks four sites with no single place to fix or test; two of the four are brand new (tonight), so the count is growing, not shrinking.
**③ FIX** One exported helper, e.g. in a tiny client-safe module: `export function clientSafeServerSpecifier(base: "deepseek" | "wild-mode" | "headless", file = "server.ts") { return \`./${base}.\` + file; }` — call sites keep the `import(spec)` shape. Done-when: `grep -n '\+\s*"server\.ts"' src/lib` shows one definition.
**④ BETTER-WAY** The repo already names this idiom in comments; naming it in code is the same move the seam-cast idiom gets ("the cast is confined to this one forwarding boundary" — registry.ts:675-680). Confinement is explained in prose but not enforced by a single definition — enforce it.

## A1-13 · store: `releaseWildStart(id)` is called twice on every start (and the logic is two nested try/finallys)
**① WHERE** `store.ts:1148-1167`:
```ts
        } finally {
          // PB-04: release the single-flight latch once the loop ends …
          releaseWildStart(id);
        }
        } finally {
          // 174-2: early returns (missing project / wildMode off / already
          // active / complete) must also release the latch.
          releaseWildStart(id);
        }
```
**② WHY WRONG** Not a bug (verified: `rt-client.ts:357-361`'s `releaseWildStart` is idempotent — it just nulls a matching latch), but it's misread bait: the inner finally belongs to the loop try, the outer to the whole action; the double release reads like a latch refcount bug and will survive a refactor into a real one. The nested try/finally also hides the error path (a caught error returns a coded result, then both finallys run).
**③ FIX** Collapse to ONE `try { … } finally { releaseWildStart(id); }` around the whole action body (the loop's try only needs the catch, not its own finally). Done-when: exactly one `releaseWildStart(id)` call in `startWildRun`, and a store test still proves the latch clears on an early refusal.
**④ BETTER-WAY** `serialized()` (store.ts:199-213) already owns "wrap the whole action, clean up at the tail" — the latch release could ride the same shape, so future latches get release-by-construction.

## A1-14 · Two async store actions skip the ST-6 serialization that every sibling got
**① WHERE** `store.ts:898` (`runVerifyAsync: async (id) => {`) and `:939` (`runP6Journey: async (id, opts) => {`) — bare `async`, no `serialized(id, …)`; contrast `:1294`:
```ts
      executeAsync: (id) =>
        serialized(id, async () => {
```
(and `runUntilHitlAsync` :1330, `runModuleReal` :1391, `rejectAsync` :1620, `deepenResearch` :884 all use it).
**② WHY WRONG** These two commit whole-project snapshots (`set(...)` with `rebaseUserFields`) computed from *pre-await* snapshots. ST-6's own comment (store.ts:186-196) describes the exact failure: overlapping actions both compute from the same pre-run snapshot and the LAST committer wins — a verify/p6-journey settling after a `runUntilHitlAsync` rolls the graph back. The P6 journey runs minutes (keyed), so overlap is not hypothetical.
**③ FIX** Wrap both in `serialized(id, async () => …)` exactly like their peers (`runP6Journey`'s keyless passthrough still returns its envelope unchanged). Done-when: a store test fires `runP6Journey` and `executeAsync` against one id and asserts the earlier commit is not clobbered.
**④ BETTER-WAY** The rule "async actions that commit a whole project are serialized per id" is a law with 5 compliers and 2 exceptions — either make it enforcement (a shared `serializedAction(id, fn)` wrapper all actions import) or lose it. 

## A1-15 · Magic `12` / `13` graph bounds, one of them under a comment claiming the opposite
**① WHERE** `store.ts:467`/`:535`/`:652` (`if (rec.status === "complete" && phase < 12)`), `:1240`/`:1339`:
```ts
        // B-24: the loop bound derives from the graph, not a magic constant. …
        const maxRuns = (13 - start.currentPhase) * 2 + 2;
```
**② WHY WRONG** The comment says "derives from the graph"; the code hard-codes `13` and `12` (five sites). `PHASES.length`/a `PHASE_LAST` export already exist in phases.ts (`PHASE_TAIL_START`, `PHASE_COUNT = 13` in io.ts) — if the graph ever grows, the packet says 14 phases while `runUntilHitl` caps at 13 and `finishPhase` stops advancing at 12; a silent partial pipeline. Comments that claim non-constant derivation that ISN'T are exactly the class this audit exists for.
**③ FIX** Import from phases.ts (e.g. `PHASES.length - 1` / a new `PHASE_LAST: PhaseId = 12`), and reword the comment. Done-when: `grep -n "phase < 12\|(13 -" src/lib/store.ts` is empty and the phases.test pin still verifies the graph length. 
**④ BETTER-WAY** phases.ts is the single graph authority; store/dod/io already import from it — the literals are the odd ones out (`PHASE_COUNT` in io.ts is the pattern to copy).

## A1-16 · Positional phase indexing in store vs the repo's id-match law (A20)
**① WHERE** `store.ts:436` and `:626`:
```ts
  const phase = project.currentPhase;
  const rec = project.phases[phase];
```
and `:1607`: `if (project.phases[project.currentPhase]?.status !== "awaiting_hitl") {`.
**② WHY WRONG** phases.ts:141-145 states the law ("Index by record id, not array position (A20): a partial, unsorted, or sparse phase array must never silently mis-seal the graph") and every module that learned it (`priorsSealed`, `phaseCoverage`, `repairPhases`, `approvalActor`) uses `.find(r => r.id === …)`. store's transition guards stayed positional: a project reaching the store without hydrate (tests, `seedIfEmpty` skipped, a crafted record) can have `phases[3]` be P7 → `advanceOnce` reads the wrong record's status and refuses/advances wrongly, while DoD and priorsSealed simultaneously disagree.
**③ FIX** `const rec = project.phases.find((r) => r.id === phase);` in both mirrors + `.find(...)` in `reject`. Done-when: a store test with a deliberately shuffled `phases` array still advances/refuses by id.
**④ BETTER-WAY** Where a law exists in a header comment, the codebase should make it mechanical — `phaseRecord(project, id)` helper in phases.ts, used by store/dod/packet.

## A1-17 · The quota-salvage pass bounds 2 fields while claiming engine parity; a third of the growth is untouched
**① WHERE** `store.ts:689-694` comment + `:735-748`:
```ts
 * H4: engine/UI caps reused by the quota-salvage write. The engine already
 * trims logs to 200 and chatLog to 40 rows on every append, so a salvage
 * write that trims a project to these same caps loses nothing the engine
 * would not have trimmed on its next write anyway …
```
```ts
        return { ...rec, logs, chatLog } as unknown as Project;
```
**② WHY WRONG** `decisions` (append per approval), `memory` (append per lesson/research), `artifacts` (append per phase + gates + runs), `research` (append per run) are all unbounded in the product and all ride the same localStorage blob. The salvage retry can therefore still fail on a quota error whose cause it never touched, and the escalation text blames "storage capacity" while the product's own largest arrays go untrimmed. The claim "loses nothing the engine would not have trimmed" is only true for logs/chatLog.
**③ FIX** Extend `salvageTrim` to the same field set the checkpoint already bounds (A1-03's shared constant), keeping the row-loss capped to the newest entries (keep the tail like the checkpoint does). Done-when: a synthetic over-quota payload whose bulk is `artifacts`/`decisions` salvages successfully, and the warning names which fields were trimmed.
**④ BETTER-WAY** The `as unknown as Project` cast at the return papers over the pattern; the checkpoint module's `boundProjectForCheckpoint` (already written, already handles 5 fields on a copy) is the exact helper this should call — one bounding pass, two consumers.

## A1-18 · `clone()` copies an ACTIVE `wildRun` — a lie surface until the next reload
**① WHERE** `store.ts:1675-1687`:
```ts
        // B-08: clone = full snapshot with a fresh identity — deep copy, never an empty fork.
        copy = structuredClone(project);
        …
        copy.id = …; copy.name = `${project.name} (copy)`; copy.createdAt = Date.now();
```
**② WHY WRONG** `hydrateProject`'s doctrine (engine.ts:2068-2072) is explicit: "a persisted ACTIVE run is stopped on hydrate: the driver loop is a session artifact and dies with the page, so an active surface would be a lie after reload". `clone` bypasses hydrate — the copy lands with `wildRun: { active: true, … }` and **no driver**: the Runtime/console surfaces show a live wild run that can never step, and `startWildRun` on the copy refuses ("A wild run is already active", store.ts:1044) because the phantom run blocks it. Only a page reload heals it.
**③ FIX** In clone, run the same stop pass: `copy.wildRun = copy.wildRun?.active ? { ...copy.wildRun, active: false, pause: false, stoppedAt: copy.wildRun.stoppedAt ?? Date.now() } : copy.wildRun;` (+ a `wild.stop` log row, mirroring hydrate's honest trail). Done-when: cloning a mid-run project yields a copy whose wildRun is stopped and whose log says why.
**④ BETTER-WAY** The session-break honesty rule belongs in ONE place (`hydrateWildRun`'s stop branch); clone should call it (exported) rather than re-implement or skip it.

## A1-19 · `synthesizeAsync`'s fallback catch is silent — a throwing engine path is invisible
**① WHERE** `store.ts:582-593`:
```ts
    try {
      const mod = await import("./engine.ts");
      …
    } catch {
      // engine.runPhaseAsync unavailable or threw → deterministic fallback below.
    }
  }
  return applyPhaseResult(project, phase);
```
**② WHY WRONG** "Not configured" is the expected path (fine to be quiet); a `runPhaseAsync` *throw* is not — the run silently degrades to the deterministic floor and the audit trail (project.logs) shows nothing, so the operator cannot tell a keyless run from a broken keyed run. Every sibling degradation in the engine writes a coded row (`liveLayerFailureRow`, `liveDegradeRow` with `liveDegradeCode`); this seam swallows.
**③ FIX** In the catch, keep the fallback but stamp a warn row onto the returned project (e.g. `llm.degrade` with `classifyError(err)`), same as `withLiveDegradeRows` does engine-side. Done-when: a store test forcing `runPhaseAsync` to throw produces the fallback project with a `llm.degrade`/coded warn row.
**④ BETTER-WAY** engine.ts:3274+ (`liveLayerFailureRow` / `liveDegradeCode` / `withLiveDegradeRows`) is the canonical "never fail silently" toolkit — reuse instead of a bare comment.

## A1-20 · `appendChatRows` cites `CHAT_LOG_MAX_ROWS` — a constant that does not exist
**① WHERE** `store.ts:102` and `:1724`:
```ts
  // P0-2: append persisted chat rows (cap 40 = CHAT_LOG_MAX_ROWS headroom).
```
```ts
              ? { ...p, chatLog: [...(p.chatLog ?? []), ...list].slice(-40) }
```
**② WHY WRONG** `grep -rn "CHAT_LOG_MAX_ROWS" .` finds only this comment (and a `.t4scratch` copy) — the referenced constant was never created or was deleted; the number `40` is hand-copied here and in `RESCUE_CHAT_CAP`. A comment citing a nonexistent symbol is worse than no comment: a future reader greps, finds nothing, and changes one of the two 40s.
**③ FIX** Either define `CHAT_LOG_MAX_ROWS = 40` (in types.ts or the store) and use it in both places, or reword the comment to name the real mechanism. Done-when: the comment's cited symbol exists in the tree, and the two constants are one.
**④ BETTER-WAY** declare-or-strike applies to comments too — the repo's own AGENTS.md law. Grep your comment's promises before landing.

---

### engine.ts (hydrate / stamp / wild)

## A1-21 · hydrateProject's clean-return condition omits SIX repair flags — repaired payloads return with a stale packet
**① WHERE** `engine.ts:2525-2537` (early return) vs the repair set at `:2446-2459`:
```ts
  if (
    filled.packet && filled.lattice && filled.specGraph &&
    !phaseRepair.repaired && !cpRepaired && !edgeRepaired && !rowRepaired && !scalarRepaired && !hw.stopped
  ) {
    return filled;   // ← no re-stamp, no attachAlgorithms
  }
  return attachAlgorithms(filled);
```
The logging block just above uses the FULL set: `phaseRepair.repaired || cpRepaired || edgeRepaired || holeRepaired || rowRepaired || scalarRepaired || chatLogRepaired || researchRepaired || implRepaired || scorecardRepaired || treeRepaired || fixturesRepaired`.
**② WHY WRONG** A payload that only triggered `holeRepaired` / `researchRepaired` / `implRepaired` / `scorecardRepaired` / `treeRepaired` / `fixturesRepaired` / `chatLogRepaired` takes the early return: the just-appended `hydrate.repaired` warn row lands in `logs`, but `filled.packet` is the OLD packet (compiled from the dropped junk — e.g. research rows the packet still cites, scorecard axes that were nulled, the old `currentPhase` for a hole repair) and the A2/A4 traces stay stale. The repair pass's entire promise ("repair is loud, never silent") is undermined by shipping a document that still describes the pre-repair world; the mismatch persists until the next stamp, and on a read-only load it persists forever.
**③ FIX** Compute one `const repaired = <full set>` (the same expression already written at :2446) and use it in BOTH places — the log-if and the early-return-if. Simplest correct form: `if (filled.packet && filled.lattice && filled.specGraph && !repaired && !hw.stopped) return filled;` (`holeRepaired` also flips `currentPhase`, which the packet bakes — include it unconditionally). Done-when: a hydrate test per flag (one payload each) asserts `packet` differs from the pre-hydrate packet whenever any flag fires.
**④ BETTER-WAY** Two hand-synced boolean lists in one function is the drift generator this audit keeps finding; the flag list should be built once (`const repairs = [...]`, then `.some(Boolean)`), same as the detail-token assembly ten lines above already does.

## A1-22 · specGraph / contracts inner-shape still undefended engine-side — the live whole-store-wipe vector
**① WHERE** `engine.ts:2403-2404`:
```ts
    specGraph: isPlainObject(raw.specGraph) ? raw.specGraph : null,
    contracts: isPlainObject(raw.contracts) ? raw.contracts : null,
```
vs `packet.ts:597-601` (`(project.specGraph?.order ?? []).map((id) => { const n = project.specGraph?.nodes.find(…) })`) and `io.ts:270-288`'s own note: "specGraph — hydrate's plain-object guard passes {order: 5} / {nodes: 5}, which compileAgentPacket then .map()s into a throw."
**② WHY WRONG** The io half defends this on IMPORT; the persistence path (localStorage → `onRehydrateStorage` → `seedIfEmpty` → `hydrateProject`) does NOT go through io. A stored blob with `specGraph: {order: 5}` (hand-edited, older schema, torn write) passes hydrate's isPlainObject guard, passes the early return (no repair flag fires — A1-21's list doesn't cover it), and then `compileAgentPacket` (called by `stampPacket` on the next action, or by anything reading `specGraph.order.map`) throws. The store comment `store.ts:825-831` documents where that throw lands: `recoverFromCorruptPersistence()` re-seeds EMPTY over the user's workspace. That's the exact wipe class the io work closed for scorecard/research (A1-02 fixes/122 landed engine-side — `engine.ts:2250`, `:2289-2301`) but **specGraph/contracts never followed**.
**③ FIX** Add `usableSpecGraph`/`usableContracts` guards in hydrateProject mirroring io's structural checks (order/nodes arrays; entity rows need name+fields arrays; endpoint rows plain objects), nulling + flagging like scorecard does, and fold those flags into A1-21's `repaired`. Done-when: a project with `specGraph:{order:5}` hydrates with a `hydrate.repaired` row and `compileAgentPacket(hydrated)` never throws; and a test pins that localStorage-style hydrate (not io) defends it.
**④ BETTER-WAY** Two validators for one field family is the root cause (io.ts's own header calls itself "the only serialization boundary", yet hydrate re-implements weaker copies). Extract `sanitizeProjectFields(payload)` into one module both io and hydrate call — the "io↔hydrate validator class" ends there instead of per-field.

## A1-23 · io.ts comment about research is stale — the engine half HAS landed
**① WHERE** `io.ts:141-143`:
```ts
//   - research, which NO hydrate pass normalizes (the engine half of H-03 lands
//     in a later pass): a non-array container becomes [], and corpus entries
//     must be {query, items[]} with plain-object items;
```
vs `engine.ts:2242-2264`:
```ts
  // H-03 (fixes/115): `research` rode the ...raw spread unvalidated — a corrupt
  // non-array value survived hydrate and threw inside compileAgentPacket's
  // researchSources/researchHash …
  // A1-01 (fixes/122): ALSO drop junk at the ITEM level …
  const research = Array.isArray(raw.research) ? raw.research.filter(…) : [];
```
**② WHY WRONG** A reader planning the "later pass" will find it already done (fixes/122) and cannot tell whether the io note or the engine code is current — comments that invert reality cost a future lane real time, and "the engine half lands later" is now false.
**③ FIX** Reword io's bullet to "research — normalized engine-side since fixes/122; this io pass keeps its own defense for the import boundary ahead of hydration". Done-when: the sentence contains no unlanded-work claim (or names the landed commit).
**④ BETTER-WAY** Reference the landing (fixes/122) the way the engine comment does — the repo's comments already cite fix ids; io's bullet was written before the id existed and never updated.

## A1-24 · io vs hydrate disagree on what a valid research item IS (two strictnesses, asymmetric round-trips)
**① WHERE** `io.ts:204` keeps any plain-object item:
```ts
        const items = e.items.filter((it): it is Record<string, unknown> => isPlainObject(it));
```
vs `engine.ts:2257-2259` drops items without a string url:
```ts
          const cleanItems = (entry.items ?? []).filter(
            (it) => it !== null && typeof it === "object" && typeof (it as { url?: unknown }).url === "string",
          );
```
**② WHY WRONG** An imported corpus entry with an item `{title: "x"}` (no url) survives `importProject`, then is silently dropped the first time the project round-trips through localStorage (`hydrateProject`) — the export/import/re-export "byte no-op" law holds, but import→reload is lossy with no repair note visible to the user (the drop is loud in logs, but the *import* said "clean"). More importantly the packet render reads `it.title` on io-kept items whose title is missing (A1-26), so the two layers disagree about which rows are renderable.
**③ FIX** Pick one predicate and share it (engine's url-required one is the packet-render truth — `researchSources` prints `title — url`). io should drop url-less items with a note. Done-when: an import with a url-less item reports `research:items:-1` and a subsequent reload doesn't change the corpus.
**④ BETTER-WAY** Same as A1-22: one `coerceResearch(raw)` used by both boundaries.

## A1-25 · io refuses an over-cap import WITHOUT the machine-readable code the comment promises
**① WHERE** `io.ts:32-38` (comment) vs `:435-439` (code):
```ts
 * R12-f11 (P3): lowered 10 MB → 5 MB. The persist layer must survive a
 * localStorage-class ~5 MB budget, so a payload that could never survive a
 * reload is refused AT IMPORT with a machine-readable `tooLargeToPersist` code
```
```ts
  if (json.length > IMPORT_MAX_CHARS) {
    return {
      ok: false,
      error: `Import payload too large (${json.length.toLocaleString("en-US")} chars; cap ${IMPORT_MAX_CHARS.toLocaleString("en-US")}).`,
    };
  }
```
**② WHY WRONG** `tooLargeToPersist` exists nowhere else in the tree (grep: io.ts:34 only). The stated reason for the H4 cap — "the store action can label the refusal honestly instead of reporting a persistence failure later" — is unimplementable because the refusal carries no code and `ImportResult.code` stays empty. The store caller (store.ts:1743-1744) forwards only `error`. Declare-or-strike violation inside a comment that was part of a shipped fix.
**③ FIX** Either mint the code (add `"RT_E_IMPORT_TOO_LARGE"`-style entry — careful: existing codes are `RT_E_*`; a `tooLargeToPersist` sub-code would ride `code?: string` — the field exists on `ImportResult` for exactly this) and set it, or rewrite the comment to describe what actually happens. Done-when: the chosen behaviour is pinned by a test (`io.test.ts` likely already asserts the refusal — extend it to the code).
**④ BETTER-WAY** `ImportResult` already has `code?: string`; the repo's registry discipline (`errors.ts` HEADER: "adding a code without a doc entry fails errors.test.ts") means the code path exists — half-honoring it (comment says yes, code says nothing) is the worst of the three options.

## A1-26 · io's repair-log append silently discards older log rows
**① WHERE** `io.ts:396-411`:
```ts
function stampImportRepairLog(p: Record<string, unknown>, notes: string[]): void {
  …
  p.logs = [ ...(p.logs as unknown[]), { ts: Date.now(), phase: …, level: "warn", event: "import.repaired", detail: notes.join(" ") } ].slice(-200);
}
```
**② WHY WRONG** If the imported payload carries more than 200 log rows, a *repaired* import silently drops the oldest `n-199` rows — a data-loss edit during an operation whose stated contract (io.ts:155-157) is "a byte-for-byte NO-OP on well-formed payloads". The repair notes name the sanitized fields but never mention the truncation, so the operator sees "import.repaired research:dropped" and not "logs:-700".
**③ FIX** Either don't slice here (let the store's own caps handle growth after commit), or push a `logs:-N` token into the same note when the slice actually drops rows. Done-when: importing a payload with 900 logs either preserves them or reports `logs:-N` in the repair detail.
**④ BETTER-WAY** When a boundary repairs, it should report *every* mutation it makes (the same function's `notes` design already anticipates this — it just missed its own slice).

## A1-27 · `sealPacketArtifact` mutates its argument in place while pretending to be a swap
**① WHERE** `engine.ts:357-369`:
```ts
function sealPacketArtifact(project: Project): Project {
  project.artifacts = [ ...project.artifacts.filter((a) => a.kind !== "packet"), { … } ];
  return project;
}
```
**② WHY WRONG** Every engine write elsewhere builds a fresh object (`{ ...project, artifacts: [...] }` — see `recordGateInto` dod.ts:891-908, `recordGate` store.ts:355-372). This one assigns through the parameter, so any caller holding the previous reference sees its array mutate (aliasing bugs in React change-detection / memo deps, and test fixtures that reuse a `const p` get silently rewritten). It's the function's return value that's used, so the mutation buys nothing.
**③ FIX** `return { ...project, artifacts: [...] };`. Done-when: `stampPacket`'s input object is unchanged after the call (assert in a test).
**④ BETTER-WAY** The repo's purity convention for engine helpers is immutable spreads; call sites (store/wild/headless) rely on it for the H-01/H-06 rebase reasoning.

## A1-28 · hydrateProject coerces `sandbox` inconsistently — `isolated`/`timeoutS` accept type-junk
**① WHERE** `engine.ts:2391-2396`:
```ts
    sandbox: {
      runtime,
      ramMb: typeof raw.sandbox?.ramMb === "number" ? raw.sandbox.ramMb : null,
      timeoutS: raw.sandbox?.timeoutS ?? 30,
      isolated: raw.sandbox?.isolated ?? false,
    },
```
**② WHY WRONG** `ramMb` gets a typeof guard; `timeoutS`/`isolated` only get `??` — a corrupt `isolated: "false"` (string) or `"no"` persists as a truthy **string** in a `boolean` slot, and `timeoutS: "30"` rides into arithmetic (`ramMb`/claims render, runner option math). Downstream `sandboxClaim`/packet envelopes then describe a type the value isn't. Same class as the `enforceDod`/`wildMode` booleans, which ARE coerced (`raw.enforceDod === true`).
**③ FIX** `timeoutS: typeof raw.sandbox?.timeoutS === "number" && Number.isFinite(raw.sandbox.timeoutS) ? raw.sandbox.timeoutS : 30`, `isolated: raw.sandbox?.isolated === true`, and keep `runtime`'s explicit union check (already right). Done-when: a hydrate test with junk sandbox scalars yields well-typed defaults + a repair note (extend `scalarRepaired`).
**④ BETTER-WAY** One `asFiniteNumber(v, fallback)` / `asBool(v)` pair for all scalar coercion — hydrate already hand-writes this pattern 8+ times.

## A1-29 · The `enforceDod` legacy-default mismatch between create and hydrate (decide + document)
**① WHERE** `engine.ts:1900-1903` (emptyProject):
```ts
 * input.enforceDod (CLI --advisory sends false) always wins. …
    enforceDod: typeof input.enforceDod === "boolean" ? input.enforceDod : keyedDeepSeekConfigured(),
```
vs `:2379`: `enforceDod: raw.enforceDod === true,`
**② WHY WRONG** AGENTS.md's contract says "Keyed runs default **enforce-DoD ON** (the engine defaults `enforceDod` to the keyed state)". That default exists at CREATE only: any project persisted before the field (or with the field stripped by a hand edit) rehydrates as `false` → advisory — including one being resumed by a keyed CLI run, where the operator expects enforcement. Either the contract sentence needs a "for newly created projects" qualifier, or hydrate needs the keyed default for absent fields (a byte-behaviour change — needs the lane's decision). Ambiguity here means two surfaces disagree about what "default ON" means.
**③ FIX** Record the decision where the contract is read (AGENTS.md/engine comment) and pin it with a test: hydrate({no field}) under a keyed host → advisory (today) — if that's intended, say why ("never upgrade a persisted project's gate posture silently"). Done-when: the behaviour is pinned and the wording matches.
**④ BETTER-WAY** This repo's honesty law prefers "never silently change persisted posture" — keep `=== true`, but write the sentence in the hydrate comment so the next reader doesn't "fix" it.

## A1-30 · `hydrateWildRun` trusts integer phase but clamps with magic 12; `WildRunState.phase` is `number`
**① WHERE** `engine.ts:2083-2086`:
```ts
  const intOr = (x: unknown, fallback: number): number =>
    typeof x === "number" && Number.isInteger(x) ? x : fallback;
  const phase = Math.min(12, Math.max(0, intOr(w.phase, currentPhase)));
```
and `types.ts:148`: `phase: number;` in `WildRunState`.
**② WHY WRONG** Three vocabularies again: `WildRunState.phase` is `number` (not `PhaseId`), the clamps are literal `12`/`0`, and consumers (wildGateInfo/store startWildRun) re-implement clamps. A hand-edited `phase: 40` clamps fine here, but `store.ts:1070` reads `p.wildRun.phase` straight into display/log text with no clamp of its own. Not a crash today; a boundary mess that guarantees a future one when the graph changes.
**③ FIX** Use `PHASES.length - 1`, and route every clamp through one `clampPhase(n)` helper (phases.ts); type `WildRunState.phase` as the clamp domain deliberately (document why it's `number`: legacy payload tolerance).
**④ BETTER-WAY** Store the raw value with the clamp visible at the read sites, or normalize at the one write site — currently both happen in overlapping places.

---

### packet.ts

## A1-31 · packet.ts claims junk research "contribute[s] nothing instead of throwing" — half true
**① WHERE** `packet.ts:486-494`:
```ts
  // … Junk entries (null / missing items on hand-built payloads) contribute nothing instead of throwing.
  const researchSources = (project.research ?? [])
    .slice(-5)
    .flatMap((entry) => (entry?.items ?? []).slice(0, 5).map((it) => `- ${it.title} — ${it.url}`))
    .join("\n");
```
**② WHY WRONG** The guard covers `entry` null and `items` ABSENT. It does not cover: `items` present-but-not-an-array (truthy `5` → `.slice` throws), or a `null` ITEM (`.map` hits `it.title` → throws). Both are the "hand-built payload" family the comment names — i.e. the comment asserts more defense than exists, and the io/hydrate guards are what actually save the shipped paths (see A1-22/A1-24 for where they don't).
**③ FIX** `Array.isArray(entry?.items) ? entry.items.slice(0,5).filter((it) => it && typeof it === "object").map(...) : []`, or tighten the comment to "absent/null items containers contribute nothing". Done-when: `compileAgentPacket` on a hand-built `{research:[{items:5}]}`-style project returns a packet instead of throwing (add to the fuzz/sweep test).
**④ BETTER-WAY** Defense-in-depth comments should be written to the *weakest covered case*, not the strongest — this repo's audit culture greps exactly these claims.

## A1-32 · Title-less research items render as `- undefined — <url>`
**① WHERE** same expression (`packet.ts:494`): the guard chain admits items with only a `url` (hydrate requires `url` string but nothing requires `title`; io keeps items without either — A1-24), and the template prints `it.title` verbatim.
**② WHY WRONG** `"- undefined — https://…"` in the agent packet is a visible trust leak (an agent reading the packet sees a broken citation line); it is exactly the class the packet's own "cite these, do not invent sources" footer is meant to prevent.
**③ FIX** Render `it.title || "(untitled)"`, or require `title` in the hydrate/io predicate (prefer the render guard — never drop a real citation for a missing label). Done-when: a corpus item without title renders with a placeholder, pinned in packet.test.
**④ BETTER-WAY** Render-time placeholders are the repo's pattern for empty content ("(no brief supplied …", "(none yet)") — reuse it.

## A1-33 · `truncateToBudget`'s legacy paths exceed the declared budget by the marker
**① WHERE** `packet.ts:744-745` and `:750-753`:
```ts
    // No schema section (future format drift): legacy whole-document cut.
    return `${assembled.slice(0, PACKET_MAX_CHARS)}\n${TRUNC_MARKER}`;
```
with the doc at :737-738 "the result never exceeds the budget".
**② WHY WRONG** `slice(0, 14_000)` + `"\n"` + the ~60-char marker = up to `PACKET_MAX_CHARS + ~61` chars. The main path (budget-derived cut) is correct; the two legacy/pathological branches are not, so the invariant "never exceeds" is false exactly where the code took the emergency exit. Small — but the packet is a byte-compat artifact and the sentence is load-bearing.
**③ FIX** `assembled.slice(0, PACKET_MAX_CHARS - markerLine.length)` (or subtract in the slice), or reword the doc to "the content cut never exceeds the budget; the marker may add a line". Done-when: a test with a synthetic no-schema 15k packet asserts `result.length <= PACKET_MAX_CHARS` (if the invariant is kept) or the doc says differently.
**④ BETTER-WAY** Keep the invariant AND the marker by reserving for it — reserving space is exactly how the main path already works (`const budget = PACKET_MAX_CHARS - tail.length - markerBlock.length;`), so the fallback contradicts the function's own discipline.

## A1-34 · Non-null assertions on `rejectionHistory` survive junk shapes into the render
**① WHERE** `packet.ts:506-509`:
```ts
  const loopCount = curRecord?.rejectionHistory?.length ?? 0;
  const lastLoopNote = loopCount > 0 ? (curRecord!.rejectionHistory![loopCount - 1]?.note ?? null) : null;
```
**② WHY WRONG** `?? 0` only covers null/undefined — a corrupt `rejectionHistory: "abc"` yields `loopCount = 3` and then `"abc"[2]?.note` → `undefined` (no crash, luck), while a `rejectionHistory: 17` yields `?? 0`. It happens to survive today; the non-null `!` pair documents a false guarantee and will crash the day someone tightens the render to `h[...]` instead of the optional form. hydrate does repair it (`rejectionHistory ?? []` is the only defense — a non-array persists).
**③ FIX** `const h = Array.isArray(curRecord?.rejectionHistory) ? curRecord.rejectionHistory : [];` and derive both values from `h`. Done-when: a payload with junk `rejectionHistory` compiles a packet with `loopCount 0`.
**④ BETTER-WAY** `?? []` is not a shape guard — the repo's own `asArray` idiom (`Array.isArray(x) ? x : []`) is; use it in every `?? []` that reads PERSISTED data.

---

### dod.ts / gate-stats.ts

## A1-35 · `approvalActor` returns the FIRST approve row and an unvalidated `decidedBy` (type lie)
**① WHERE** `dod.ts:145-151`:
```ts
const approvalActor = (p: Project, phase: number): "human" | "autopilot" | null => {
  const row = (p.decisions ?? []).find((d) => d.phase === phase && d.decision === "approve");
  if (!row) return null;
  return policyConsistentApproval(row, phase) ? row.decidedBy : null;
};
```
**② WHY WRONG** Two issues: (1) first-wins on an append-only journal — a corrupted/forged earlier row shadows a later legitimate one (and a re-approval after a reject reads as the older decision); (2) for an `untagged` row `policyConsistentApproval` returns `true` without inspecting `decidedBy` (dod.ts:135), so a row with `decidedBy: "system"` (or anything else) is returned through a signature that claims `"human" | "autopilot"` — a downstream `=== "human"` check silently becomes false and the criterion fails with a wrong story. The DoD probes (p4-approved etc.) rest on this.
**③ FIX** `const actor = row.decidedBy; return actor === "human" || actor === "autopilot" ? actor : null;` — and decide first-vs-newest explicitly (`for (let i = decisions.length - 1; i >= 0; i--)` matches `refusalClassOf`'s newest-first scan three functions away in engine.ts:1274). Done-when: a decision set with two approve rows for one phase has a pinned, documented winner, and a junk `decidedBy` fails the criterion.
**④ BETTER-WAY** engine's `refusalClassOf` scans newest-first with an explicit comment; two journal scanners in one codebase should share one scan helper (and one answer to "which row speaks for the phase").

## A1-36 · "PURE gate-recorder" stamps `Date.now()` — purity claim vs code
**① WHERE** `dod.ts:837-846` (doc: "E-02: record a machine-checkable DoD verdict … the shared PURE gate-recorder (store.recordGate parity). Semantics mirror store.recordGate (store.ts:83-124) byte-for-byte") vs `:881`/`:897`: `checkedAt: Date.now()` and `ts: Date.now()`.
**② WHY WRONG** "Pure" in this repo is a load-bearing word (determinism-guard scans for `Date.now` in derivation modules; tracing.ts's doctrine is "the pure core never invents time — the host stamps it"). The recorder is deterministic-except-two-timestamps; the doc should say "pure except the arrival stamps (checkedAt/ts)", or the stamps should be parameters defaulted by callers. As written, a future guard widening to dod.ts would flag it and the doc would argue past the finding.
**③ FIX** Reword the doc: "deterministic given `now`; stamps checkedAt/ts from the host clock". (No behaviour change needed — the same wording pattern engine uses for trace `ranAt`.)
**④ BETTER-WAY** `store.recordGate` carries the same stamps without the purity claim — the claim is what needs fixing, not the timestamps.

## A1-37 · CAPABILITIES (and phases.ts P2) still declare "No durable checkpoint layer" while `checkpoint.server.ts` now ships
**① WHERE** `dod.ts:932-937`:
```ts
  memory: {
    implemented: ["project-memory-80-row", "knowledge-store-file"],
    declared: ["durable-checkpoints", "cross-encoder-rerank"],
    claim:
      "Persistence = browser localStorage + JSON project files. No durable checkpoint layer, no RRF/cross-encoder (FusionRank is lexical, deliberately).",
```
and `phases.ts:22-26` (`P2` summary: "honest persistence model (no durable checkpoint layer)").
**② WHY WRONG** T-107.7's module exists in-tree (untracked tonight, unwired). Today the claims are still *literally* true (nothing runs it), but the moment L2 wires it, both texts assert the opposite of the shipped code (and they are user-visible: capability lines copy into artifact bodies, the P2 summary into packets). This is the classic declare-or-strike drift the wave exists to prevent — the contradiction is one wiring commit away, and the same lane will not remember two far-apart strings.
**③ FIX** Now: annotate both with the T-107.7 pointer ("until T-107.7's call site lands"). At wiring: flip `durable-checkpoints` to implemented and rewrite both claims in the same commit as the call-site. Done-when: `grep -n "durable checkpoint layer" src/lib` returns either an updated claim or an annotated one.
**④ BETTER-WAY** Capability claims should reference the owning module (`checkpoint.server.ts`) so the next audit greps from the claim to the code in one hop.

## A1-38 · `round2` rounds to 3 decimals (name lies); the window's `Date.now()` is fine but undocumented
**① WHERE** `gate-stats.ts:22` vs `:78`:
```ts
const round2 = (x: number): number => Math.round(x * 1000) / 1000;
…
  const rejectRate = n > 0 ? round2(rejects / n) : 0;
```
**② WHY WRONG** `* 1000 / 1000` is three decimals; the function name says two. The doc comment above the export says "rejectRate … rounded to 3 decimals" (right) — so the name is the only wrong member. Trivial, but this is a rail that renders to operators, and the next dev adding a second use of `round2` will expect 2dp output.
**③ FIX** Rename `round3` (both call sites) or change to `Math.round(x*100)/100` and fix the doc. Done-when: name, doc, and math agree; gate-stats tests pin the exact displayed precision.
**④ BETTER-WAY** Naming discipline for numeric helpers (`fnv8` in knowledge.ts does this correctly — the name encodes the digits).

---

### rt-client.ts / llm.ts / registry.ts

## A1-39 · `buildClientDiagnosis` crashes on the exact legacy project its neighbor guards
**① WHERE** `rt-client.ts:674-684`:
```ts
    growth: {
      rows: {
        ledger: input.project?.logs.length ?? 0,
        …
        // … Optional-chain: legacy projects without a
        // chatLog field report 0, never throw.
        chatLog: input.project?.chatLog?.length ?? 0,
```
**② WHY WRONG** The comment names the defense it applies to `chatLog` (two `?.`) but `ledger` has ONE: for a project object present but without `logs` (legacy persisted shape — the same class hydrate repairs, but the diagnosis input can be any Project-typed value passed by the console), `input.project?.logs.length` throws `TypeError` — inside the diagnostic builder whose sibling-path philosophy is "never throw while diagnosing". The `?? 0` can't save it because the throw precedes it.
**③ FIX** `ledger: input.project?.logs?.length ?? 0`. Done-when: `buildClientDiagnosis({ project: { id: "x" } as never })` returns a DiagnosisJson instead of throwing (test in rt-client's suite).
**④ BETTER-WAY** When a comment explicitly claims optional-chain safety, the two lines it covers must look identical — the asymmetry here is how the bug got in.

## A1-40 · `stampSeed`'s throwaway-ring fallback can mint a row with a session that never exists
**① WHERE** `rt-client.ts:195-196`:
```ts
function stampSeed(seed: RtEventSeed, host: RtHost): RtEvent {
  const r = ring ?? createRtRing();
```
**② WHY WRONG** If `ring` is null (module just loaded, some future caller stamping before `getRtRing()`), the row is stamped with a **new random sessionId** from a ring that is immediately discarded — the row later gets pushed onto the real ring through some path, carrying a `sessionId` that matches no ring, no persisted blob, and no crash snapshot. SessionId is the correlation key for the whole diagnosis story (`buildDiagnosis.session.sessionId`); a wrong one silently orphans the row. Today `reportRt`/`getRtRing` ordering makes it unreachable — a landmine, not a bug.
**③ FIX** `const r = ring ?? (ring = getRtRing());` — or assert `ring !== null` in `stampSeed` and let the callers own initialization. Done-when: no code path can construct an `RtEvent` from a ring other than the singleton (`stampSeed` is module-private today; pin with a comment or the fix).
**④ BETTER-WAY** Singletons should initialize through one accessor (`getRtRing`) — two initialization routes is the same drift shape as A1-12.

## A1-41 · `complete()` cannot forward `thinking` — the "facade must forward it" parity fix landed on `callModel` only
**① WHERE** `llm.ts:56-61` (comment on the server validator) vs `:77-84` (public wrapper):
```ts
        /** 216 (T0.5 — fixes/156 E1 parity): the server call sites pass
         *  `thinking: false` for structured json envelopes … The facade must
         *  forward it or the UI / engine path silently re-enables that blocker. */
        thinking?: boolean;
```
```ts
export async function complete(prompt: string, opts?: {
    model?: LlmModel; system?: string; maxTokens?: number; json?: boolean;
}): Promise<LlmResult> {
```
(`callModel` at :127-136 DOES carry `thinking?: boolean`.)
**② WHY WRONG** The public `complete()` — the API the module header tells engine/store/UI code to use — has no `thinking` on its parameter type, so a caller that needs the structured-json fix (disable thinking so `reasoning_content` can't eat the max_tokens window and return `content:""` — the "empty-content blocker" the comment names) cannot pass it through this path; TS refuses. The validator accepts it, the server understands it, the wrapper strips it — the exact regression the comment warns about, surviving on the older of the two APIs. The internal cast (`opts` passed as-is) means a JS caller could pass it, which makes it a *type-level* trap rather than a hard block — worse, because it passes review.
**③ FIX** Add `thinking?: boolean;` to `complete()`'s opts (one line — it's already forwarded by the payload once typed). Done-when: `complete(p, { json: true, thinking: false })` typechecks and a call-shape test asserts the field survives the wrapper.
**④ BETTER-WAY** Two hand-maintained option shapes for one server seam (complete vs callModel) is the drift generator; derive both from the server validator's input type (`Parameters<typeof completeServer>[0]["opts"]`) once it's referenced.

## A1-42 · `registry.callModel` reads `process.env` unguarded (works only because callers are server-side)
**① WHERE** `llm/providers/registry.ts:688` and `:696`:
```ts
  const envSelection = resolveEnvProvider(process.env);
  …
  const fallbackChain = resolveFallbackChain(process.env);
```
**② WHY WRONG** The module's own docs route it everywhere through `createServerFn` handlers today (llm.ts:117), so it's fine *now*; but `llm.ts` statically imports `type RapidToolModelRole` from this file (llm.ts:15), and the day someone imports a value (the `ROLE_TIERS` table is exported) into a client module, the first `callModel` call throws `ReferenceError: process is not defined` in the browser instead of a coded refusal. engine.ts guards its own host probes (`keyedDeepSeekConfigured`, engine.ts:1820-1827) — this module skips the guard.
**③ FIX** `const env = typeof process !== "undefined" ? process.env : {};` before the two resolvers (both already tolerate `{}` — unset ⇒ default path). Done-when: importing + calling `callModel` in a browser-ish context returns the not-configured/refusal envelope, never a ReferenceError.
**④ BETTER-WAY** The H2 crash-class rule ("never import node:fs into client-safe modules") has a sibling for `process`: any module reachable from the client graph should read ambient host globals defensively. A comment stating "server-only; do not import values client-side" is cheaper still — do one of the two.

## A1-43 · FAILOVER-CHAIN refusal is exemplary — keep it; one nit inside
**① WHERE** `registry.ts:692-716` — the chain is resolved before dispatch and refused while unarmed, with the reason naming the TODO row (`R13-f09 / 221 §F2 step 2`), and code `RT_E_VALIDATION` + "Unset `RAPIDTOOL_FALLBACK_PROVIDERS` to use the single-provider path". 
**② WHY (nit only)** The refusal fires even when the caller explicitly passed `opts.provider` — no, it can't: the explicit path returns at :670-681 before the chain check. Correct as-is. The nit: the unarmed-chain refusal is `reason: "error"` and the LlmResult callers that pass a domain fallback code (e.g. verify) will already see the message; fine.
**③ Record as a GOOD EXAMPLE** for the mini-guide: this is the model for honest shelved features (coded refusal > silent no-op > remove the config). No fix.
**④ BETTER-WAY** —.

---

### Cross-cutting (sweeps run today)

## A1-44 · `slice(-200)` — the log cap is hand-copied at 30 sites across 13 files
**① WHERE** (grep today, non-test): `codegen.server.ts:2409,2652,3451,3525,3541` · `dod.ts:903,1049` · `engine.ts:1449,1519,1596,1728,1782,2508,2523,3210,3385,3430,3550` · `headless.ts:401,456,786,814,831,1057,1979` · `io.ts:411` · `knowledge.ts:1431` · `report-intake.ts:495` · `store.ts:317,367,1478-1480,1643,1697` (grep shows 30+ sites across 13 files — this list is the byte-checked subset).
**② WHY WRONG** Exactly the "duplications that will drift" class the brief names: the cap is a product policy ("engine trims logs to 200" — store.ts:691) expressed as a bare literal everywhere. Any lane that decides 200→300 (or makes it per-host) must find and edit ~30 sites; the audit trail shows this file family has already been re-found by successive waves (H-01/H-06/ST-6 all touched log caps). One miss = a silent unbounded array (the H4 quota class) or a pre-200-slide of history in one path.
**③ FIX** Export `LOG_CAP = 200` (types.ts or a tiny `caps.ts`; store.ts's `RESCUE_LOG_CAP` consumes it too) and sweep the literals with a trivial mechanical pass (the parent can hand it to a cheap lane — no logic change, byte-identical output for ≤200-row logs). Done-when: `grep -n "slice(-200)" src/lib` (non-test) = 0, and gates stay green. Add a sibling constant for chat (40).
**④ BETTER-WAY** rt-events.ts already exports `LOG_KEEP/LOG_ROTATE_BYTES` for the disk family — the in-memory family deserves the same single source.

## A1-45 · Sync/async mirror pairs keep needing paired patches (drift evidence in-file)
**① WHERE** `store.ts` — `advanceOnce`(:431-494) vs `advanceOnceAsync`(:620-677); `runReady`(:496-514) vs `runReadyAsync`(:598-617); `runUntilHitl`(:1231-1289) vs `runUntilHitlAsync`(:1330-1386). Comments record the paired history: ":445 SWEEP-2 (st-7): … previously only approveHitl's inline record landed here" duplicated at ":635"; ":452 E-20 … log the DoD-fail denial" duplicated at ":638"; ":557 SWEEP-2 (st-7): … patch" recurs.
**② WHY WRONG** ~120 duplicated lines where every fix is applied twice by hand (three fix ids are visible in the duplication), and one pair already diverges in comment depth (the async mirror's P10 note is a pointer, the sync one is a paragraph — fine, but it shows no mechanical link). The next transition-guard fix will be applied to the sync path, tested via store tests that mostly exercise sync, and the async path (the one the console actually runs against a keyed LLM) will lag.
**③ FIX** Extract a `transitionCore(project, autopilot)` for the guard ladder (it's pure — no awaits until `runReady`), with the async runner injecting `synthesizeAsync` vs `applyPhaseResult` for the final step; or at minimum add a store test that asserts the two paths' guard ORDER stays identical (a table of inputs → same error strings). Done-when: one guard-ladder definition; the paired-patch comment ids collapse to one history.
**④ BETTER-WAY** `serialized()` shows this repo is comfortable injecting behaviour raisers (`fn: () => Promise<T>`); the same idea applies here (pass the step function, share the ladder).

## A1-46 · `dedupeMemoryIds`' collision loop can silently re-mint a colliding id after 10k
**① WHERE** `engine.ts:301-305`:
```ts
    let suffix = n;
    let id = `${m.id}-${suffix}`;
    while (occupied.has(id) && suffix < 10_000) {
      suffix += 1; id = `${m.id}-${suffix}`;
    }
    occupied.add(id); // H-02 … register the minted id so a later occurrence cannot mint it again
```
**② WHY WRONG** If suffixes `n..9999` are all occupied, the loop exits with `id` still colliding and the function returns a DUPLICATE id — the exact invariant (`H-02`) the block exists to protect, silently broken at the cap (and the write path then persists a row fusionRank will collapse, with no note — packet.ts's `countIdCollisions` rail is the only surface that would show it, downstream). Reachable only via pathological payloads, but the cap is invisible (no constant, no comment).
**③ FIX** After the loop, if `occupied.has(id)` still, fall back to a deterministic suffix beyond the cap (`-${suffix}` after `while` unbounded, or append a hash of text) — or at minimum push a repair note. Done-when: a synthetic 10 001-collision row set yields all-unique ids (test).
**④ BETTER-WAY** Loops with a hidden bound should name it (`MAX_ID_SUFFIX = 10_000`) and handle the exit condition explicitly — this repo's audit style (A22/A16 guards in phases.ts) is exactly "handle the impossible branch loudly".

## A1-47 · The checkpoint seam is a declared-but-dead island (status note, not a bug)
**① WHERE** `checkpoint.server.ts` (untracked tonight) — grep for `writeCheckpoint|readCheckpoint|clearCheckpoint|checkpointAdmits` outside the module: **zero consumers**. Its TODO (L184) says the store/engine call site lands in lane L2.
**② WHY WRONG / the honest status** No runtime path calls it: the module's own header sells value ("a run that dies … can be RESUMED instead of restarted") that no surface can currently deliver. That's acceptable for a wave seam ONLY if nothing user-visible claims resumability yet — the A1-37 claims check found the opposite risk (`RT_E_CHECKPOINT_MISSING`/`unattended` codes are pre-registered in errors.ts:80, and the CLI's `resume` verb is A2's half). Also: an unwired module can drift from its tests the moment wiring starts.
**③ FIX** Ensure the L2 wiring commit lands before any surface text mentions resume/checkpoints, and that the wiring path hydrates (`hydrateProject`) the read-side minimal shape (A1-09). Done-when: `grep -rn "checkpoint" src scripts` (excl. the module + errors registry) shows a real call site, or no surface claims resumability.
**④ BETTER-WAY** — (see the honesty-guards precedent: shells are fine when they refuse loudly; they are not fine when surfaces claim them).

---

## FOR THE CODERS — mini-guide (how to write code THIS repo accepts first try)

1. **Read the byte-state, then quote it.** Every finding/fix must cite `file:line` + the literal code you read *today*. If the comment and the code disagree, that disagreement IS the finding (`tooLargeToPersist`, "derives from the graph", "kept identical to salvageTrim" — all three were caught this way). Never paraphrase a quote you didn't re-read after the lane started.
2. **Append-only, marker-last.** Shared notes files take sections *above* `END-OF-FILE-MARKER-*`; re-read the tail immediately before EVERY append (this file had no marker until §A1 added one). Never edit a sibling's section; your section number is yours (`§A1`/`§A2`).
3. **Guards BEFORE derivations.** A validator placed after `join()`/property access is dead code (A1-01/A1-06). Order: typeof → range → derive → try → act.
4. **If a function promises "never throws", the try must cover every fallible call** — including the bounding/JSON work *before* the fs calls (A1-02). Coded refusals (`{ok:false, code}`) over exceptions, always; codes come from `errors.ts` and `ERROR_CODE_DOC` must gain an entry in the same commit (errors.test enforces).
5. **I/O failures are not `RT_E_VALIDATION`.** Use `classifyError(err, fallback)` so EACCES/ENOSPC/EADDRINUSE surface as their own codes (A1-05). `RT_E_VALIDATION` is for payload shape.
6. **One cap, one constant.** No new bare `200`/`40`/`12`/`13` literals — import `LOG_CAP`/`CHAT_CAP`/`PHASE_LAST` (A1-15/A1-20/A1-44). If you must add a literal, put it next to the others in the same module.
7. **Repair passes must re-stamp everything downstream** (the packet + traces). If you repaired a field, the early-return condition must include its flag (A1-21) — build the flag list once.
8. **One validator per field family.** io↔hydrate, scorecard/specGraph/contracts/research — if two boundaries both defend a field they must call the same predicate (A1-22/A1-24); divergence is the whole-store-wipe class (`store.ts:825-831` shows the wipe).
9. **Async whole-project commits are per-id serialized** (`serialized(id, …)`) **and rebased** (`rebaseUserFields` + `keepLiveWildRun`); if your action skips the wrapper, justify it in the PR (A1-14).
10. **Don't mutate engine args.** Build `{ ...project, field }` — `sealPacketArtifact`'s in-place assign (A1-27) is the odd one out and the class React memo bugs come from.
11. **Host globals defensively:** `typeof process !== "undefined"`, `typeof window !== "undefined"`, `Array.isArray(x)` before `.length/.map/slice` on anything that rode persisted state or user input (`?? []` is NOT a shape guard) (A1-42/A1-39/A1-34).
12. **The server-import idiom is one thing, defined once:** use the helper for the concatenated dynamic specifier (A1-12); never statically import `*.server.ts` into a client-safe graph (H2 crash class). Server-only modules own `node:fs`, full stop.
13. **Purity words are measured:** "pure"/"deterministic" functions may not call `Date.now()`/`Math.random()` (determinism-guard scope grows; tracing.ts doctrine is "the core never invents time") — if you must stamp, take `now` or word the claim correctly (A1-36).
14. **Sync/async twins get paired patches in ONE commit** (or a shared core) — the repo history shows every mirror fix applied twice (A1-45).
15. **Comments are contracts under audit:** declare-or-strike applies to them; grep the symbols your comment cites (the comment at `store.ts:102` cites `CHAT_LOG_MAX_ROWS`, which does not exist — A1-20); a shelved feature gets a coded refusal, never a silent no-op or a doc claim (registry's unarmed-failover refusal — A1-43 — is the model to copy). And log-and-continue: no test runs/builds/keyed calls from an audit lane; land findings in the log file EARLY, fix product code never.

## §A2 — THE PERIPHERY HALF (W34 lane A2 · read-only) — appended 2026-09-27 by W40 K8 (N4 → Z4 payout)

**Status:** OWED SINCE W34 — the lane hit its tool ceiling **before appending §A2**; its log `fixes/279_a2_codenotes.md` stayed a stub. This block is the lane's **findings inventory** verbatim from its delegation summary (`~/AppData/Local/hermes/cache/delegation/subagent-summary-1-20260926_195032_506645.txt`), re-landed here as the owed record. All items were byte-checked via grep/read at lane time (2026-09-26 ~19:50 CDT); lines cited are from that read — re-verify against current bytes before acting (sibling lanes were landing). **Items marked as unverified at the end were never verified — do not publish them as fact.**

### A2 · FINDINGS INVENTORY (all byte-checked at lane time)

**Contracts that lie (highest value)**
1. `AGENTS.md:18` — "the dev server binds `0.0.0.0:8080` (vite.config.ts). Do not change the host/port contracts" **vs** `vite.config.ts` R11-f01 block + `README.md:29` ("loopback by default"). The repo-level contract doc states the pre-R11-f01 (unauthenticated-RCE) behavior. Fix: amend AGENTS.md to loopback + `RAPIDTOOL_BIND_ALL=1`. Done-when: AGENTS.md ≠ `0.0.0.0` as the default.
2. `AGENTS.md:50` "35 verbs" **vs** `grep -c 'case "'` = **37** **vs** `README-cli.md:10` "**37 subcommands**". `README-cli.test.mjs` binds README↔dispatcher; **nothing binds AGENTS.md**. Fix: strike/repin. (The `USAGE.commands` object is a *third* copy of the verb list — no test binding its strings was found.)
3. `rapidtool-cli.mjs:602` + `:1567` cite `scripts/cli-exit-taxonomy.test.mjs` as a static guard — **the file does not exist**. Create-or-strike.

**Latent crash / data-loss**
4. `rapidtool-cli.mjs:165-166` — `respond()` does `process.stdout.write(…); process.exit(code)`. On Windows `process.exit` truncates a pending async stdout write **on the very surfaces whose contract is stdout purity** (`emit --check`, `eval`, `packet` >64 KB piped). The repo already knows the fix: `gate.sh:213-216` uses `fs.writeSync(process.stdout.fd, …)` + `process.exitCode` and documents why. Fix: adopt the same idiom.
5. `run-eval.mjs:2798` — `main().catch()` writes `results.json` as `{entries: [], error}` and **exits 0**, clobbering the previous run's results with a crash stub — while the run *marker* (`writeMarkerAtomic`, `:2396`) exists precisely to stop stale/absent results being misread. Fix: write the crash stub elsewhere (or preserve prior bytes) and keep the marker semantics.
6. `run-eval.mjs:2346/2364` — `results.json`/`history.json` written with plain non-atomic `writeFileSync`, while the marker protecting them *is* atomic. Inconsistent atomicity. Also **`history.json` is unbounded**: no `slice`/cap found (grep for `history.slice|MAX_HISTORY|history.length` = 0).

**Vacuous tests / weak guards**
7. `migration-plan.test.mjs:84-97` — "the copy check reads both files and catches an edit" **re-implements `authSchemaCopy` inline** instead of importing it (:29-34). Passes while the real helper drifts.
8. `migration-plan.test.mjs:72-82` — byte-identity test `if (pair === null) return` → **vacuous in the shipped state** (`migrations/` contains only `auth/`; `.grok/app-env.json` = `"VITE_AUTH_ENABLED": "false"`). Green by absence.
9. `gate.sh:171-176` — a leg that **exits 0 with a log that produced no `# pass` lines at all** still yields `gates[id].ok = true, pass: 0`. `noTapNames` only fires when `exit ≠ 0`. The gate's verdict depends on node's *default* reporter staying TAP-ish; nothing pins `--test-reporter` or asserts `pass > 0`. False-green blind spot (sibling of the `--test-name-pattern` no-op trap codified in `test-name-pattern-guard.test.mjs:5-27`).
10. `gate.sh:221-224` — the stderr tail loop covers only `typecheck lint assertionGaps testsScripts testsLib build`; under `--double` the **second-run logs (`testsScripts2`/`testsLib2`) are never tailed**, so a flake is named with no diagnostic.

**Migrations resilience**
11. Preflight (`authSchemaRefusal`, `migration-plan.mjs:77-91`) only checks for a migration creating the Better Auth `user` table. But `migrations/auth/` held **two** files (`0001_auth.sql`, new `0002_account_unique.sql`, mtime Sep 26 18:06). Copying up only `0001` **passes the preflight** and runs without the uniqueness constraint. The refusal text says "plus any later migrations/auth/*.sql" — nothing enforces it.
12. `migrate.mjs:81-85` — relies on pg simple-query multi-statement inside `BEGIN`/`COMMIT`; a future migration file carrying its own `BEGIN;`/`COMMIT;` silently escapes the one-transaction + `_migrations` record guarantee. Latent resilience gap.

**UI (console.tsx / routes) — state holes & render**
13. `console.tsx:3824` — `HitlDock`'s `forceOverride` ("I approve anyway") is local state and the dock is **not keyed by phase**; a ticked override carries into the next phase's gate. Fix: reset on `h.phase` change / key the dock.
14. `console.tsx:1745` — `PaneBoundary` wraps **only `HomeScreen`**; `RunScreen` (~40 panes) has none, so its doc-comment claim (`:1632-1641`) is true only for Home. `ui.pane_crash` is registered (`rt-events.ts:141`) and pinned (`rt-events.test.ts:82`) but emitted by nothing else.
15. `console.tsx:3261-3472` — all 10 `Tabs.Content` use `forceMount` + `data-[state=inactive]:hidden`, so **every pane stays mounted** with its own poller (`RuntimeLogPane :4409`, `RuntimeTimelinePane :97`, `ChatPane :5885` at 2 s/1 s). Pollers run even for hidden tabs, for every project.
16. `runtime-timeline-pane.tsx:39` — `clockLabel` uses `toISOString().slice(11,23)` = **UTC**, labelled a clock; `console.tsx:760-763` `fmtClock` uses **local** `getHours()`. Same ts → two different displayed times in one console.
17. `console.tsx:2406/2419/4620/5163/5438` — `URL.revokeObjectURL` on a fixed `setTimeout(…, 1000)` (5+ copies) — the classic truncated-download race, no unmount revoke. Should be one helper.
18. `console.tsx:2005-2010` — the global keydown guard queries `[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]` to detect "ANY modal dialog", but Radix dropdowns/popovers/tooltips (Export menu `:1872`, Term tooltips) carry neither attribute → `e`/`g`/`a` shortcuts still fire behind them. Documented over-claim.
19. `console.tsx:1697/1700-1715` — `HomeScreen`'s `busy` latch is vacuous: `setBusy(true)` then immediately `setBusy(false)` around a synchronous `create()`, feeding `disabled={… || busy}`. And hydration seeding rides a magic `setTimeout(…, 80)`.

**scripts/** quality**
20. `parseArgs` (`rapidtool-cli.mjs:62-97`) treats a value starting with `--` as boolean → `edit --find x --replace "-- foo"` **refuses** ("missing required --replace", `:1552`) though a value was given. Workaround `--replace=…`; a legal replacement starting with dashes is a false refusal.
21. Three implementations of one "am I main?" predicate: `with-app-env.mjs:97` (realpath — correct), `run-eval.mjs:2787` (lowercased resolve), and the naive `pathToFileURL` form in `brand-check.mjs:196`, `preview.mjs:332`, `write-atomic.mjs:78` — the last makes those scripts silent no-ops under a symlinked path (the helper's own docstring says so).
22. `rapidtool-cli.mjs:3308` hardcodes `budgetsMs: { wildStep: 255_000, chat: 60_000 }` with a "keep in sync" comment while `diagnose.ts:156` **imports** the same constants (`rt-events.ts:213-220`). Values correct today; pure drift hazard.
23. `write-atomic.mjs:64` — `mkdirSync(dirname(target))` runs **before** the rename try, so a failed EXDEV rename has already created target dirs; the test "a failed hand-over creates no directory" (`write-atomic.test.mjs:101-106`) only passes because ENOENT throws earlier.
24. `browser-guard.mjs:49-58` — on win32 *any* POSIX-literal entry makes the whole check fail closed, discarding legitimate later Windows dirs; and `LOOPBACK_HOSTNAMES` carries a dead `"::1"` (URL.hostname yields `"[::1]"`).
25. `docs-module-parity.mjs:96` — `--self-check` changes only a *label string*; the `fixtures` booleans are computed unconditionally. The flag is decorative.
26. `package.json` — no `format:check` (only write-mode `"format": "prettier --write ."`), no `--test-reporter` pin on either leg, and `"sideEffects": false` at an app root whose telemetry/router install side-effects at module scope.
27. `tsconfig.json` `"include": ["src","server"]` → the 165 KB CLI, 130 KB run-eval and all guards are **untypechecked** in the gate (`tsconfig.scripts.json` documents 1030 errors, staged, honest).
28. `README-cli.md:1001-1007` "## Tests" lists only two `src/lib` suites while `npm test` runs all of `src/lib/**`.

### A2 · UNVERIFIED (do not publish as fact)

- The exact `USAGE.commands`-vs-arm diff, and whether any test binds `USAGE` strings.

### A2 · NEXT STEP FOR WHOEVER PICKS THIS UP (verbatim)

Read `wave_plans/W34/code-notes.md`, re-check these 28 against current bytes (sibling lanes are landing), then append `§A2` with ①②③④ per item + the FOR-THE-CODERS guide (test contracts; the no-tty/`--test-name-pattern` green-lie; fuzzy-patch is opt-in-only in `patch.ts` but the **CLI `edit` never exposes it**; declare-or-strike; collision etiquette; E-15/RT_E_VALIDATION; log-and-continue).
<!-- END-OF-FILE-MARKER-NOTES · every lane appends ABOVE this line · never edit or delete this line -->

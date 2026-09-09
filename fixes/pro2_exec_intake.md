# Pro #2 — Bounded local code runner + agent-report intake

## Scope (strict ownership)

Created ONLY these files:

- `src/lib/node-runner.server.ts` — local bounded runner (honestly labeled non-sandbox)
- `src/lib/exec.ts` — client-facing `runCode()` with the honest `{ok:false, reason}` shape
- `src/lib/report-intake.ts` — `validateReport()` + `applyReport()` (pure)
- `src/lib/exec.test.ts` — runner contract (mocked) + harmless echo fixture
- `src/lib/report-intake.test.ts` — validation + pure apply tests

No edits to `io.ts` / `store.ts` / `engine.ts` / `types.ts` (report-intake imports
`types.ts` read-only). No touch of `scripts/`, `public/`, `server/`, `migrations/`,
`.env`, `package.json`, `package-lock.json`, `node_modules`.

## Public contract (for Pro #3 / #4)

- `src/lib/exec.ts`
  - `type ExecResult = { ok:true; stdout; stderr; durationMs; exitCode } | { ok:false; reason:"not-configured"|"timeout"|"error"|"refused"; error? }`
  - `runCode(code, opts?: { timeoutMs?, runner? })` — `runner` is test-only DI.
- `src/lib/report-intake.ts`
  - `type AgentReport = { phase:number; status:"complete"|"blocked"|"partial"; summary:string; artifacts?; files? }`
  - `validateReport(raw): {ok:true, report} | {ok:false, error}`
  - `applyReport(project, report): Project` (pure, returns new project)

## Design decisions / honesty notes

1. **Runner is bounded, not a sandbox.** `node-runner.server.ts` header and every
   doc line state it enforces only: wall-clock timeout (tree-kill via
   `taskkill /pid <pid> /T /F` on win32 + `SIGKILL`), output caps (`maxBuffer` +
   manual slice), a fresh scratch `cwd` (courtesy, not a jail), and a proxy-scrubbed
   child env (`HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY` emptied, `NO_PROXY="*"` —
   best-effort, raw sockets bypass). It does **not** claim filesystem/memory/CPU/network
   isolation.
2. **`-e` vs file.** Task specifies `spawn('node', ['-e', code])`; implemented as
   `spawn(process.execPath, ["-e", code], …)` — the exact Node binary, passed as an
   argument (never through a shell), so quoting is a non-issue. `process.execPath`
   avoids PATH surprises on Windows.
3. **Timeout signal.** Wall-clock is enforced by my own timer (sets `timedOut=true`,
   then tree-kill + `child.kill("SIGKILL")`) rather than the built-in `spawn.timeout`,
   to avoid the Windows direct-child-only kill leaving grandchildren behind and to
   make the timeout reason deterministic (`close` checks `timedOut || signal !== null`).
   `maxBuffer` remains the output-bomb hard guard; an overflow kill surfaces as
   `reason:"timeout"` (documented: both are "bounded" kills).
4. **`refused` reason** is returned for empty/whitespace-only source (both layers).
   **`not-configured`** is returned when `runnerAvailable()` is false (no
   `process.execPath`) or the injected runner is null.
5. **Report artifacts: `kind:"docs"` + a `report-` marker.** `ArtifactKind`
   (`types.ts`) has no `"other"`/`"report"` member and types.ts is read-only, so an
   ingested report lands as `kind:"docs"` and is made distinguishable via the
   `report-<phase>-<idx>-<ts>` id prefix, the `"[agent report] "` title prefix, and an
   `"external report — unverified by engine"` body footer (R-4 #2/#3: never confused
   with engine output).
6. **Rejection-free blocked note.** `applyReport` with `status:"blocked"` sets
   `phases[report.phase].rejectionNote = summary` but does **not** flip status to
   `"rejected"`, does **not** append a `rejectionHistory` entry, and leaves
   `project.status` unchanged — so it never engages the store's rejection stop or a
   regeneration attempt counter. The store still owns gate advancement (per task).

## Verification

- `npm run typecheck` — 0 errors repo-wide (re-run at end; concurrent-wave errors in
  non-owned files are expected and out of scope).
- `node --experimental-strip-types --test src/lib/exec.test.ts src/lib/report-intake.test.ts`
  — all green. The exec suite mocks the server call for
  not-configured/timeout/error/refused/success-shape/timeoutMs-forwarding, plus three
  harmless real-runner fixtures (echo, non-zero exit, infinite-loop timeout kill).
- No untrusted code is ever run by tests: only `console.log`, `process.exit(3)`, and
  a bounded `while(true){}` timeout-kill fixture.

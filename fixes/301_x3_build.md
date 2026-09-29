# fixes/301 — X3: the fourth gate — BUILD + preview boot + keyless CLI e2e

HEAD on entry: `4af061a` (tree dirty only with untracked `fixes/300_v1_sixpins.md`). Scope:
run the repo's build gate (`npm run build` = `vite build` + `db:migrate`) for the first time
in this campaign, fix what it finds (configs — vite.config.ts / nitro / vercel preset — are
this lane's), then a BOUNDED preview boot smoke (real HTTP response, never faked) and a
keyless CLI end-to-end smoke (`create` → `run` → `emit`) on a scratch dir outside the repo.
Every line below is a captured real output; nothing is inferred. No keyed calls.

Status: COMPLETE — all three legs GREEN: build exit 0 (no fix needed), preview boot REAL
(HTTP/1.1 200 + verified kill), keyless CLI e2e create/run/emit exits 0/0/0. No code changes
were required; one host pitfall recorded (taskkill `//F`).

## 1. Build gate — `npm run build` (first run this campaign)

### 1.1 First run — GREEN (exit 0), no fix needed

Command: `npm run build` (`node scripts/with-app-env.mjs vite build && npm run db:migrate`),
run foreground; full log captured at `/tmp/x3_build1.log` (session shell).

Real tail:

```
✓ built in 11.94s
[PLUGIN_TIMINGS] Plugin hooks ran for 6.7s of this 11.9s build (57%). …
ℹ Generated .vercel/output/nitro.json
[nitro] ✔ You can preview this build using npx vite preview
npm notice run app-builder-workspace@0.1.0 db:migrate
[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).
```

- Whole command exit: **0** (`npm run build` exit code captured; wall ≈ 90s incl. npm
  + migrate overhead; vite itself 11.94s, 1988 client modules transformed, nitro
  `preset: "vercel"` → `.vercel/output`, nodejs22.x runtime).
- Zero error lines. Non-fatal warnings only, recorded not "fixed" (build verdict is
  the gate and it is green):
  1. `Module "node:path" / "node:fs" has been externalized for browser compatibility,
     imported by "src/lib/knowledge.ts"` — rolldown browser-externalization notices
     (guard seam, not a failure).
  2. Two `[INEFFECTIVE_DYNAMIC_IMPORT]` — `src/lib/llm.ts` and `src/lib/research.ts`
     dynamically imported by `store.ts` but statically imported by `engine.ts`
     (chunking advisory only).
  3. Chunk-size >500 kB advisory (`algorithms-BypwnV6P.js` 992.58 kB / gzip 454.19 kB).
- No source/config changes were needed for the build leg.

## 2. Preview boot smoke — REAL (bounded)

`npm run preview` (background; `node scripts/with-app-env.mjs vite preview`), then a bounded
curl loop against `http://127.0.0.1:8081/`:

- Try 1 refused (still starting); try 2: **`HTTP/1.1 200`** with
  `content-type: text/html; charset=utf-8`.
- Body is the real built app shell (CSS asset name matches the build output
  `styles-CKOEyhIQ.css`):
  `<!DOCTYPE html>…<meta property="og:title" content="RapidTool">…`
  full title: **`<title>RapidTool — governed 13-phase delivery harness</title>`**.
- The server banner itself printed `➜  Local:   http://127.0.0.1:8081/`; no keyed call.
- Kill + verification: `process kill` on the npm wrapper left the vite child (PID 764)
  listening; tree-killed via `MSYS2_ARG_CONV_EXCL='*' taskkill /F /T /PID 764`
  (`SUCCESS: The process with PID 764 … has been terminated`). Post-kill:
  `curl http://127.0.0.1:8081/` → **HTTP=000**, `netstat` shows no 8081 LISTENING.
- PITFALL (recorded for the lane): on this host `taskkill //F …` is rejected
  (`ERROR: Invalid argument/option - '//F'`) — MSYS does not translate `//F`; use
  `MSYS2_ARG_CONV_EXCL='*' taskkill /F /T /PID <pid>`, then re-verify the port.

## 3. Keyless CLI end-to-end smoke — SCRATCH dir (outside the repo)

Scratch: `C:/Users/mnril/AppData/Local/Temp/x3_cli_smoke` (created fresh for this run; the
repo's own state was never the project dir). Invocation per `scripts/README-cli.md`:
`node --experimental-strip-types "<repo>/scripts/rapidtool-cli.mjs" <verb> …`, cwd = scratch.
No `DEEPSEEK_API_KEY` present and none used.

### 3.1 `create` — process EXIT 0

`create --brief "Tiny X3 build-gate smoke: a hello counter page." --name "X3 Smoke" --out build.json`

Full stdout, verbatim (644 bytes):

```json
{
  "schema_version": 1,
  "cmd": "create",
  "ok": true,
  "path": "C:\\Users\\mnril\\AppData\\Local\\Temp\\x3_cli_smoke\\build.json",
  "summary": {
    "name": "X3 Smoke",
    "currentPhase": 0,
    "status": "intake",
    "phaseCounts": { "ready": 1, "locked": 12 },
    "lastGate": null,
    "researchCount": 0,
    "memoryCount": 3,
    "vaultReady": true,
    "failedGates": [],
    "sealedWithFailures": false,
    "nextAction": { "kind": "run", "cmd": "gate", "phase": 0,
      "why": "Ready when you are — run P0 (Deep Research & Feasibility)." }
  },
  "enforceDod": false,
  "exit_code": 0
}
```

- Envelope: `schema_version 1`, `cmd "create"`, `ok true`, `exit_code 0`, **no `code` field**
  (codes are failure-only per README §Error codes). `enforceDod: false` — keyless ⇒ advisory
  (honesty contract #5).
- On disk after: `build.json` (14 805 bytes) + `.rapidtool/` in the scratch dir.

### 3.2 `run` — process EXIT 0 (one step; deterministic floor)

`run --project build.json`

Full stdout, verbatim (641 bytes):

```json
{
  "schema_version": 1,
  "cmd": "run",
  "ok": true,
  "path": "build.json",
  "summary": {
    "name": "X3 Smoke",
    "currentPhase": 1,
    "status": "running",
    "phaseCounts": { "complete": 1, "ready": 1, "locked": 11 },
    "lastGate": null,
    "researchCount": 0,
    "memoryCount": 5,
    "vaultReady": true,
    "failedGates": [],
    "sealedWithFailures": false,
    "nextAction": { "kind": "run", "cmd": "gate", "phase": 1,
      "why": "Ready when you are — run P1 (Core Orchestration & State Graph)." }
  },
  "steps": 1,
  "stopped": false,
  "events": [],
  "exit_code": 0
}
```

- `steps: 1`, `stopped: false`; phase advanced 0 → 1 (`status "running"`,
  phaseCounts complete 1 / ready 1 / locked 11). `researchCount: 0` = the keyless
  deterministic corpus; nothing fabricated.

### 3.3 `emit` — process EXIT 0

`emit --project build.json --out emitted`

Full stdout, verbatim (322 bytes):

```json
{
  "schema_version": 1,
  "cmd": "emit",
  "ok": true,
  "dir": "C:\\Users\\mnril\\AppData\\Local\\Temp\\x3_cli_smoke\\emitted",
  "count": 16,
  "moduleEmbedded": true,
  "summary": "16 files · kind webapp · packet 7c52976f-90a7-4fa0-b12e-08031dd40bcf — write them to disk with the emit command",
  "exit_code": 0
}
```

- `count: 16`, `moduleEmbedded: true`. On-disk proof: `find emitted -type f | wc -l` = **16**
  (`index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `README.md`, `DEPLOY.md`,
  `src/{api,domain,jobs,state,ui}/…`, `src/main.tsx`, `tests/oracle.spec.ts`).

### 3.4 Paper trail (real NDJSON)

`.rapidtool/logs/rapidtool.ndjson` exists in the scratch dir; captured last line:

```json
{"schema_version":1,"ts":1790653345387,"level":"info","host":"cli","sessionId":"cli-mum4rm74","scope":"cli-command","event":"cli.invocation","message":"emit exit 0","phase":null,"projectId":null,"code":null,"stack":null,"payload":{"cmd":"emit","exitCode":0},"runRef":null,"elapsedMs":null}
```

`.rapidtool/checkpoint.json` also present.

## 4. Verdict

- All three X3 legs GREEN: build exit 0; preview real `HTTP/1.1 200` then verified kill;
  CLI `create` → `run` → `emit` exits **0/0/0** with `ok:true` envelopes and **no error
  codes** on any of them.
- **No code or config changes were needed or made this lane** — the only repo file touched by
  X3 is this log; the other lanes' `src/lib` edits were left untouched.
- Pitfall for future lanes: `taskkill //F` is rejected on this host; use
  `MSYS2_ARG_CONV_EXCL='*' taskkill /F /T /PID <pid>` and re-verify the port.
- Scratch artifacts left for inspection at `C:/Users/mnril/AppData/Local/Temp/x3_cli_smoke`
  (`build.json`, `emitted/`, `.rapidtool/`); nothing added under the repo root beyond this log.


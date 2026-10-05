# U2 — build / launch / persistence plumbing (rt350-build)

Scope: `scripts/**` (owned), `package.json`. No `src/**` touched (see blocker).

## The seam

The owner's Desktop is Windows. The existing lifecycle scripts are the sandbox's:
`scripts/preview.mjs` resolves port owners from `/proc` and hard-refuses anywhere
else (`preview.mjs:355` — `if (!existsSync("/proc/self")) { … "only runs inside
the sandbox" }`). So `npm run preview:restart` / `preview:stop` cannot be a Desktop
entry point, and plain `npm run preview` collides on the strictPort 8081 the second
time it is double-clicked.

New seam, one command a Desktop shortcut can call:

- `scripts/launch-rapidtool.mjs` — `start` (default) / `stop` / `restart`.
  - POSIX: delegates to the proven `preview.mjs` (`/proc`) path.
  - win32: owns the lifecycle natively — pidfile (`.grok/preview.pid`) + port
    owners from `netstat -ano` + `taskkill /T /F` to reap the whole
    `node -> with-app-env -> vite` tree.
  - `start` stops any stale server first, so relaunch is clean; waits for a real
    HTTP answer before reporting; opens the browser (`RAPIDTOOL_NO_OPEN=1` opt-out).
- `scripts/launch-rapidtool.cmd` — double-click wrapper (`pause` on failure).
- `package.json` — adds `launch` / `launch:stop`. All existing scripts unchanged.

## Bugs fixed

1. **No Windows launch path** — `preview:restart`/`preview:stop` exit 1 on Windows
   (`scripts/preview.mjs:355`, "no /proc"). A Desktop double-click could neither
   start nor cleanly relaunch. Fixed by the new cross-platform launcher above.
   Proof: `node scripts/preview.mjs stop` → `[preview] no /proc …` exit 1;
   `node scripts/launch-rapidtool.mjs start` → HTTP 200.

2. **Launcher lost `node_modules/.bin`** — the child `with-app-env.mjs` spawns a
   shelled `vite`; outside `npm run` (which is exactly what a Desktop `.cmd` is)
   PATH has no local bin dir, so `vite` was "not recognized" and start failed.
   Fixed by prepending `node_modules/.bin` to the spawned child's `PATH`
   (`scripts/launch-rapidtool.mjs`, `startWin`). Proof below.

## Verify (observed)

```
> node scripts/preview.mjs stop
[preview] no /proc — this script only runs inside the sandbox   (exit 1)

> node scripts/launch-rapidtool.mjs start          # = Desktop .cmd path
[launch] nothing was listening on 8081
[launch] RapidTool is running at http://127.0.0.1:8081/ (pid 11632, …)
HTTP=200 LEN=8467 RAPIDTOOL=True    pidfile=11632   listener=TCP 127.0.0.1:8081 LISTENING 30996

> node scripts/launch-rapidtool.mjs start          # relaunch
[launch] stopped pid(s) 11632, 30996 — port 8081 is free
[launch] RapidTool is running at http://127.0.0.1:8081/ (pid 31600, …)
HTTP=200 LEN=8467

> node scripts/launch-rapidtool.mjs stop
[launch] stopped pid(s) 31600, 17208 — port 8081 is free
pidfile=False   listeners=0
```

- `npm run build` → exit 0 (~58s; output `.vercel/output`, no top-level `dist/`).
- `node --test scripts/launch-rapidtool.test.mjs scripts/preview.test.mjs` → 25 pass.
- `npx tsc -p tsconfig.scripts.json --noEmit` → exit 0.

## Persistence

With `.grok/app-env.json` setting `VITE_AUTH_ENABLED=false` and `migrations/`
holding only `auth/` (no top-level `*.sql`), neither applier has work: `db:migrate`
is a no-op and the PGLite bootstrap is skipped (`vite.config.ts:hasGlobbedMigrations`).
App data is the client store over `localStorage` (origin `http://127.0.0.1:8081`),
which survives a stop→start cycle in the same browser profile — confirmed the app
serves the same built bundle (same asset hashes) across the relaunch above. The
workspace's own `build.json` is a repo file and persists trivially.

## Blocker (outside owned files — reported, not changed)

`src/lib/db.ts:126` builds PGLite with **no `dataDir`**, so it is in-memory and the
server-side DB resets on every restart (its own comment says so). Once sign-in is
enabled (`VITE_AUTH_ENABLED` not `"false"`), Better Auth users/sessions live in that
in-memory DB and are lost on relaunch. Fix belongs in `src/lib/db.ts` (a `dataDir`
under a stable path such as `.grok/pglite`), which is FORBIDDEN for this lane; left
for the owning lane. Not triggered by the current config (auth off, no migrations).

# 350 · LANE U3 — release prep: persistent memory + a real launch experience

Branch `main`, base HEAD `a6c44c4`. Windows / PowerShell / Node (`node -v` on this box is
v24.15.0; the repo pins Node 22). Real repo, real build, real server, real browser.

## 1. Persistent memory fix (additive)

`src/lib/db.ts` built the embedded Postgres with **no `dataDir`**, so it was in-memory and
server-side data reset on every restart (the module comment admitted it: "it resets on
dev-server restart". Now fixed additively — an env dir is honored when set, today's
in-memory behavior stands when it is not.

- `src/lib/db.ts:39-42` — new `pgliteDataDir`: `RAPIDTOOL_PGLITE_DIR` trimmed, empty/whitespace
  treated as unset (same rule as `DATABASE_URL`), exported for callers.
- `src/lib/db.ts:137-146` — `createPgliteSql`: when `pgliteDataDir` is set, `mkdirSync(dir,
  {recursive:true})` first (PGlite's NodeFS mkdir is non-recursive — a fresh
  `%LOCALAPPDATA%\RapidTool` would otherwise ENOENT) and pass `dataDir` to `new PGlite(...)`.
  The `node:fs` import is lazy (H2 crash-class rule: no top-level `node:fs` in a
  client-capable module). No env set → constructor args are byte-identical to before.
- `src/lib/db.ts:302` — `ensureDbReady` doccomment updated to say "in-memory unless
  `RAPIDTOOL_PGLITE_DIR` names a directory".

## 2. The launcher sets a stable dir

- `scripts/launch-rapidtool.mjs:55-71` — `resolvePgliteDir(env, platform)`: an explicit
  `RAPIDTOOL_PGLITE_DIR` wins; else `%LOCALAPPDATA%\RapidTool\pglite` on win32,
  `$XDG_DATA_HOME/RapidTool/pglite` (or `~/.local/share/RapidTool/pglite`) elsewhere; `null`
  only with no home.
- `scripts/launch-rapidtool.mjs:73-79` — `applyPgliteDir()`: resolves, `mkdirSync(recursive)`,
  exports to `process.env` so the spawned server (Windows) or the POSIX `preview.mjs` delegate
  opens the same DB; logs `[launch] app data lives at …`.
- Wired at `scripts/launch-rapidtool.mjs:230-231` (startWin) and `:277-278` (POSIX start).
- Tests `scripts/launch-rapidtool.test.mjs:41-72` pin the resolution (override wins, empty
  override ignored, Windows/POSIX defaults, null with no home).

## 3. Launch experience

- `scripts/launch-rapidtool.cmd` — the double-click entry: prints what it is doing, runs the
  launcher (default = build-if-needed + start on `127.0.0.1:8081` + open the default browser),
  pauses on failure, and on a successful start prints how to stop
  (`npm run launch:stop`). `%*` is forwarded, so `launch-rapidtool.cmd stop` also works.
- `package.json` — `launch` / `launch:stop` already present from the U2 lane; no restructure,
  host/port contracts untouched.
- `LAUNCH.md` (new) — plain-English start / use / close / relaunch, where data lives, and what
  to do when it fails.
- **Desktop shortcut:** `C:\Users\mnril\Desktop\RapidTool.lnk` — created via `WScript.Shell`,
  TargetPath `…\scripts\launch-rapidtool.cmd`, WorkingDirectory `C:\Users\mnril\Desktop\RapidTool Main`.

## 4. Evidence — launch → use → close → relaunch (one shell, real server)

The harness reaps a command's Job Object when the command returns, so the detached preview
server dies with its parent shell; the whole cycle is therefore run in a single invocation
(this is why the sibling U2 lane's evidence is also one block). Exact commands (PowerShell,
`RAPIDTOOL_NO_OPEN=1` so automation does not spawn a browser; the default path opens the
browser via `start "" <url>`):

```
node scripts/launch-rapidtool.mjs start
Invoke-WebRequest http://127.0.0.1:8081/ -UseBasicParsing
node %TEMP%\rt_u3_shot.mjs %TEMP%\rt_u3\rapidtool-running.png
node scripts/launch-rapidtool.mjs stop
node scripts/launch-rapidtool.mjs start
Invoke-WebRequest http://127.0.0.1:8081/ -UseBasicParsing
node scripts/launch-rapidtool.mjs stop
```

Observed:

```
=== 1. START ===
[launch] nothing was listening on 8081
[launch] app data lives at C:\Users\mnril\AppData\Local\RapidTool\pglite
[launch] RapidTool is running at http://127.0.0.1:8081/ (pid 29960, …)
START_EXIT=0
=== 2. SERVE CHECK ===
HTTP_STATUS=200   LEN=8467   HAS_ROOT=False
=== 3. SCREENSHOT ===
{"status":200,"url":"http://127.0.0.1:8081/","title":"RapidTool — governed 13-phase delivery harness","textLen":681,"out":"C:\\Users\\mnril\\AppData\\Local\\Temp\\rt_u3\\rapidtool-running.png"}
SHOT_EXIT=0
=== 4. STOP ===
[launch] stopped pid(s) 29960, 30992 — port 8081 is free
STOP_EXIT=0   PIDFILE_EXISTS=False   LISTENERS=0
=== 5. RELAUNCH ===
[launch] nothing was listening on 8081
[launch] app data lives at C:\Users\mnril\AppData\Local\RapidTool\pglite
[launch] RapidTool is running at http://127.0.0.1:8081/ (pid 16492, …)
HTTP2_STATUS=200   LEN2=8467
=== 6. STOP AGAIN ===
[launch] stopped pid(s) 16492, 24680 — port 8081 is free
STOP2_EXIT=0   PIDFILE2_EXISTS=False   LISTENERS2=0
```

- **Screenshot:** `C:\Users\mnril\AppData\Local\Temp\rt_u3\rapidtool-running.png`
  (73,962 bytes, PNG signature verified; Playwright chromium, 1440×900; shows the rendered
  RapidTool home screen — header "RapidTool / governed delivery harness", the "Research first…"
  hero, the client-brief box and the builds rail).
- After the run: `Get-NetTCPConnection -LocalPort 8081 -State Listen` = 0, pidfile absent,
  no `node` processes left.

## 5. Evidence — PGlite persistence across a restart (the db.ts seam)

The shipped app env is `VITE_AUTH_ENABLED=false` with no top-level `migrations/*.sql`, so the
preview server never opens the DB (its bootstrap plugin skips; auth resolves a dev user without
a database). A restart-through-the-app persistence test is therefore **not** possible today, and
is not claimed. Instead the real `src/lib/db.ts` is loaded through Vite (so its `import.meta.glob`
resolves) in two separate Node processes against the launcher's exact dir:

```
node %TEMP%\rt_u3_pglite_proof.mjs write C:\Users\mnril\AppData\Local\RapidTool\pglite
node %TEMP%\rt_u3_pglite_proof.mjs read  C:\Users\mnril\AppData\Local\RapidTool\pglite
```

Observed (dir did NOT exist before the write — proves the recursive mkdir):

```
cleaned; exists=False
{"step":"resolved","dbSource":"pglite","pgliteDataDir":"C:\\Users\\mnril\\AppData\\Local\\RapidTool\\pglite"}
{"mode":"write","rows":[{"k":"marker","v":"survived-restart","written_at":"2026-10-05 12:02:35.898-06"}]}
WRITE_EXIT=0

dir files: 979
{"step":"resolved","dbSource":"pglite","pgliteDataDir":"…\\RapidTool\\pglite"}
{"mode":"read","rows":[{"k":"marker","v":"survived-restart","written_at":"2026-10-05 12:02:35.898-06"}]}
READ_EXIT=0
```

Process 2 read back the same value and the same `written_at` the write process recorded, from a
fresh process and the on-disk data directory (979 files). This is the seam the app uses; it is
not a claim that the current auth-off preview exercises it.

## 6. Verification

```
node --test --test-reporter=tap scripts/launch-rapidtool.test.mjs      → 5 pass / 0 fail
node --experimental-strip-types --test --test-reporter=tap src/lib/db.test.ts src/lib/db-bootstrap.test.ts → 6 pass / 0 fail
npx tsc -p tsconfig.scripts.json --noEmit                              → exit 0
node_modules/.bin/tsc.cmd --noEmit                                     → exit 0
npm run build                                                          → exit 0 (routeTree.gen.ts not regenerated)
```

## Blockers / out-of-scope

- None for this lane. `src/lib/store.ts`'s demo seed ("Northwind Dispatch") is visible in the
  screenshot but is pre-existing and outside U3 ownership (reported by the U1 lane).

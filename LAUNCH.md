# Running RapidTool

RapidTool is still a program you run from a checkout (there is no installer yet).
This page is the plain-English guide: start it, use it, close it, start it again.

## Start it

Double-click the **RapidTool** shortcut on your Desktop, or double-click
`scripts\launch-rapidtool.cmd` in the project folder.

That one action:

1. builds the app the first time (about a minute; later launches skip it),
2. starts the server on `http://127.0.0.1:8081/`, and
3. opens the app in your default browser.

You can close the small black window once it says RapidTool is running — the
server keeps running in the background.

## Use it

It is a normal web app in your browser at `http://127.0.0.1:8081/`. Nothing is
sent to the internet. If the browser did not open, paste that address in
yourself.

## Close it

Open a terminal in the project folder and run:

```
npm run launch:stop
```

(equivalently: `node scripts\launch-rapidtool.mjs stop`). Stopping the server
releases port 8081 and removes the pidfile; nothing is left running.

## Start it again (relaunch)

Double-click the **RapidTool** shortcut again. You do not need to stop it first:
the launcher stops any server it started before, then starts a fresh one, so a
double-click always gives you a clean, up-to-date app instead of a
"port already in use" error.

## Where your data lives

- **The app's browser data** (the things you create in the UI) lives in your
  browser's storage for the `http://127.0.0.1:8081/` address. It survives
  stopping and restarting the server as long as you use the same browser and
  do not clear site data.
- **The server-side database** (used for sign-in and other server features)
  lives on disk at:

  ```
  %LOCALAPPDATA%\RapidTool\pglite
  ```

  (usually `C:\Users\<you>\AppData\Local\RapidTool\pglite`). It is deliberately
  outside the project folder so it is never wiped by a rebuild or a git clean.
  The launcher creates it and points the app at it
  (`RAPIDTOOL_PGLITE_DIR`); if that variable is unset, the app falls back to a
  throwaway in-memory database, which is how it behaved before this change.
  To move your data, set `RAPIDTOOL_PGLITE_DIR` to another folder before
  launching.
- **Logs** from launches are appended to `.grok\preview.log` inside the project.

## If something goes wrong

- Nothing happens in the browser — open `http://127.0.0.1:8081/` manually.
- The launch window says it failed — read the tail of `.grok\preview.log`; the
  window also pauses so you can see the message.
- Port 8081 seems stuck — run `npm run launch:stop`, then launch again.
- Want to launch without a browser window opening — set `RAPIDTOOL_NO_OPEN=1`
  in the environment before running the launcher.

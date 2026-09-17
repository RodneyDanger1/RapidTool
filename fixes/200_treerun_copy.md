# 200 — treeRun copy-to-temp (Phase F / 174-F8)

`treeRun` copies the subject dir to `tmpdir()/rt-treerun-*`, runs compile +
specs + entry smoke on the **copy**, then deletes it.

- Live emit dir is never the cwd of `node --test` / entry smoke.
- `outcome.dir` stays the **subject** path (operator-facing).
- Copy failure → `ok:false`, live dir unused (fail closed).
- Purity test still holds (subject listing unchanged).

This is isolation of the *emit tree*, not a Docker sandbox.

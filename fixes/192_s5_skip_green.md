# 192 — 185-S5 treeRun skip is green only for UI shells

`treeRun.ok` no longer treats every `run==="skip"` as a pass.

- **UI shell** (`index.html`, no headless entry): skip stays green (compile pass, nothing to execute).
- **Headless skip** (no `package.json` main / no job entry, not a UI shell): `ok: false`.

Pin recast in `compile-check.server.test.ts`. Composer `deleg_77ba1742` is on knowledge `shouldPromoteLesson` + swarm advisory (191).

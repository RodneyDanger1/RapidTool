# 263 · Lane B3 — organization: stray files, .gitignore gaps, cross-module wiring audit, wave index

**Lane:** W24 spring-clean B3 (`wave_plans/W24/spring-clean.md` §B3). **HEAD:** `b721f9c`. **Written early, appended as work lands** (append-only; this file is new this wave).
**Box:** repo root, `.gitignore`, untracked/stray files, `wave_plans/**`, new files elsewhere. Did NOT touch: console/routes (U1/U2), `src/lib` core (B1), `src/lib/llm/**`+`scripts/**` (B2), `AGENTS.md`.

## 0. Baseline

```
$ cd "/c/Users/mnril/Desktop/RapidTool Main" && git status --porcelain
 M scripts/run-eval.mjs          <- sibling/prior lane (W23-L1 eval wires), not mine
 M src/components/console.tsx    <- U1's pane / parent T5.2-A wire, not mine
?? src/lib/fixtures.review.ts    <- new fixtures layer (parent/T5.2-A), not mine
?? wave_plans/W24/               <- this wave's plans, my box
```

## 1. Stray-file inventory (repo root)

`git status --porcelain --ignored=matching` shows only the 4 entries above as live git state; the
root clutter below is either **tracked** (committed earlier, so it shows no status) or **ignored**
(`*.log`). Inventory taken from `ls -la` at root + `git ls-files | grep -v /`:

### 1a. Ignored, untracked junk at root (disk clutter, invisible to git)

| File | Size/date | Refs | Action |
|---|---|---|---|
| `rt_lib2.log` | 488KB · Sep 24 | 0 in git | DELETE (clearly junk, 0 refs) |
| `_tc217g.log` | 53B · Sep 24 | 1 | (pending ref check) |
| `_tc217g_run2.log` | 713B · Sep 24 | — | (pending) |
| `_tc217g_run3.log` | 53B · Sep 24 | — | (pending) |
| `_tc217g_run4.log` | 53B · Sep 24 | — | (pending) |
| `_el217g.log` | 68B · Sep 24 | 1 | (pending) |
| `debug.log` | 132B · Sep 5 | 1 | (pending) |

### 1b. Tracked root-level scratch/artifacts (deletion = commit; proposals below)

`probe2.test.ts`, `probe3.test.ts`, `probe4.test.ts`, `probe-b2-before.ts`, `probe-b2-runspec.ts`,
`probe-b2-tree.ts`, `probe-r5-misc.ts`, `probe-r5-vector.ts`, `arch-e2e.svg`, `flow-e2e.svg`,
`phases-e2e.svg`, `design-e2e.html`, `packet-e2e.md`, `build.json`, `w1-source-project.json`,
`agentnotes.md` (612KB), `.node_modules.lock`, dirs `artifacts/ attachments/ audit/ audit-bugs/
builds/ proposals/ review/ screenshots/ vault-e2e/ .audit-g2/ server/`.

## 2. `.gitignore` audit

Current `.gitignore` covers `node_modules/`, `dist/`, `.env` (+`.env.local`/`.env.*.local`/`.env.bak-*`),
`*.log`, `.rapidtool/logs/`, `.hermes/`, `.probe-tmp/`, `logs/trajectory.db*`. Verified by
`git check-ignore -v` — pending eval-out/run-artifact gap analysis (findings below).

## 3. Wiring audit (static grep-level)

*(in progress — findings land below with exact file:line)*

## 4. `fixes/263_index.md`

*(in progress)*

---
*Append-only from here; written early at ~8 calls per the wave rules.*

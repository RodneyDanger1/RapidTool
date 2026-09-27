---
name: "Arcade Breakout"
brief: "A browser arcade game: a paddle, a ball and rows of bricks; three levels of increasing speed; score and high-score; keyboard controls; pause and resume; win and lose screens; canvas only."
kind: "game"
domain: "gaming"
expectedNouns: ["paddle", "ball", "brick", "level", "speed", "score", "highScore", "pause", "winScreen", "loseScreen"]
expectedCapabilities: ["A paddle moved by keyboard controls", "A ball that bounces off walls and the paddle", "Brick rows broken per hit", "Three levels of increasing ball speed", "Score and high-score tracking", "Pause and resume", "Win and lose screens", "Canvas-only rendering"]
acceptance: "One runnable game loop: keyboard-moved paddle, ball physics off walls, paddle and brick rows, three speed-increasing levels, live score plus a persisted high score, pause/resume, and win/lose end screens — all on a canvas."
baseline: "not yet measured by an eval run — the brief is K9's probe-verified kind brief (W40 probe-k9-kinds.mjs, game 11/11: pkg.main src/main.ts, index.html refs /src/main.ts, vite.config.ts + assets/manifest.json emitted); authored 2026-09-27 by W41 · P3 (fixes/295_p3_eval.md) — no dossier, no run row behind it; its first recorded run establishes the baseline"
---

## Provenance

- **Authored, NOT transcribed — stated plainly:** this fixture was authored 2026-09-27 by W41 · P3 to close the
  missing-kind gap (§R7-f04): the corpus carried 7/7 `webapp` fixtures and no `game` case. Its brief text is the
  one K9's runnable-kind probe (`probe-k9-kinds.mjs`) verified empirically (game 11/11 — `pkg.main`, the
  `index.html` entry reference, `vite.config.ts`, `assets/manifest.json`, the README Kind line and treeRun);
  unlike the six 2026-09-08 fixtures this brief is **not** transcribed from a dossier run, and there is no
  eval-run row behind it — the `baseline` line says so.
- **What is evidence-shaped and what is not:** `expectedNouns` / `expectedCapabilities` decompose the brief text
  above (the corpus schema's documented purpose); the `acceptance` line is documentation of the run-side bar in
  `graders/arcade-breakout.grader.json`, which is the grading source of truth and is read only by
  `scripts/run-eval.mjs`.
- **Declared kind:** `game` — mapped to `Project.kind: "game"` by the driver (`deliveryKindOf`) and asserted
  against the emitted README's `**Kind:**` line by the grader's `expectedKind`.

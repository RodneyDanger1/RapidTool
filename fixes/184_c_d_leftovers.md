# 184 — C/D leftovers (decidedBy, 174-6, eval-gated, CLI force)

## decidedBy
`approveHitl` requires explicit `decidedBy: "human" | "autopilot"`. No default `"human"`.
CLI `approve --force` from a non-TTY needs `--i-am-human`.

## 174-6
Removed unused `cpSync`/`mkdtempSync`. Inner `node --test` now has `cwd` = emit dir.

## C eval-gated
`shouldPromoteLesson(prior, next)` — refuse missing next; first card ok; regression refused.

## E keyed eval (operator)
Default still 1 entry. Full corpus: `node scripts/run-eval.mjs --keyed --all`
That run is **not** claimed here (costs tokens; needs human fixture approve).

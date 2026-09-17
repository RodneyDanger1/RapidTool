# 208 — store RunResult dual-channel (parent, parallel to Composer 3-pack)

## What
`RunResult` ok:true used to carry optional `error` when a partial run stopped on
error/cap/dod after `ran > 0` (B-13). That violated 185-H1.

## Fix
- `ok: true` → optional `note` (stop detail)
- `ok: false` → required `error`
- `runUntilHitl` + `runUntilHitlAsync` both paths
- Console `executeAsync` / `runUntil` surface `note` via `setNotice`

## Not
Job bodies, keyed eval, factory claim.

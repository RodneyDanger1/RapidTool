# 316 — H7: survivability sweep + no-bad-code audit + small helpfuls

Date: 2026-09-29 · HEAD at start: 564db1f · Owner: H7 (lane: survivability + bad-code sweep)
Siblings live: H1, H2, H3, H4, H5, H6 (do NOT touch their files; free files or "for H<k>" notes only).

## Scope (from the wave brief)

1. **Survivability class** — (a) save atomicity (temp+rename?), (b) fresh-command floor (bare/--help/unknown verb),
   (c) emitted-tree independence, (d) hostile `RAPIDTOOL_*` env values, (e) 8GB-machine guard (unbounded parallelism),
   (f) .env-missing keyless path re-confirm.
2. **No-bad-code audit** — grep TODO/FIXME/HACK/XXX/placeholder/mock/stub in src/ + scripts/; classify every hit;
   fix or loudly record violations. Spot-check ~8 lying-comment candidates.
3. **Small helpfuls** — (a) CLI usage-block completeness vs parsed flags (coordinate w/ H3 if same line),
   (b) up to 2 tiny proven extras.

Status: IN PROGRESS — writing log first per lane brief.

## Ledger

(Will be filled as findings land.)

### FIXED
_(pending)_

### RECORDED
_(pending)_

### CLEAN
_(pending)_

## Survivability verdicts (a)–(f)

_(pending — filled at end)_

## Evidence log

_(commands + observed output appended as I go)_

# 204 — wild dual-channel honesty + fixtures USAGE + README truth

## Dual-channel (185-H1)
`wildStartHeadless` / `wildStartRun` / idempotent pause·resume·stop used to return
`{ ok: true, error: "…" }`. That is a dual-channel lie.

**Fix:** ok:true carries optional `note` only. Failures still use `error`.
CLI `wild` envelope mirrors `note` on success.

## Docs
- USAGE lists `fixtures` (was implemented, missing from USAGE).
- README status: 1562 tests, leftover jobs = re-export/stub honesty, chat slash tools,
  doctor factory=false. Chat free-text still needs key.

## Not done
Still not a factory. Still not Codex-class. Keyed `--all` still opt-in.

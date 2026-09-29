# 304 · CODER D2 — LANE L2 ROUND 2 (finish P-5 crew leg · P-6/P-7/P-8)

> Brief: `wave_plans/W42/SPEC.md` §2 · L2 (cards P-1…P-8). HEAD `8418b04`. Coder: D2.
> Round-1 state (C2, `fixes/303_c2_packet.md` + commit `8418b04`): P-1 P-2 P-3 P-4 DONE + verified; P-5 PARTIAL (only the additive `code?: ErrorCode` in `planning.ts:82-89`; the crew-side wiring NOT landed); P-6/P-7/P-8 NOT STARTED.
> Rules honored: PATCH-FIRST, additive-only · `node --check` per edited file · legs FOREGROUND · NO keyed calls · one writer per file · per-card evidence line below (append-only).

## Ledger (append per card)

| Card | Item | Evidence (file:line · before → after · proof) |
|---|---|---|
| — | log opened | `fixes/304_d2_packet.md` created pre-edit; round-1 state re-verified by fresh greps (TODO(F2-07) `packet.ts:1005`, TODO(F2-09) `crew.server.ts:1405`, acceptance key `packet.ts:161`, budget key `:201`) |

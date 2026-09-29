# 303 · CODER C2 — LANE L2 (packet/crew budget + lint-0)

> Brief: `wave_plans/W42/SPEC.md` §2 · L2 (cards P-1…P-8). HEAD `424f9e5`. Coder: C2.
> Rules honored: PATCH-FIRST, additive-only · `node --check` per edited file · legs FOREGROUND · NO keyed calls · one writer per file · per-card evidence line below (append-only).

## Ledger (append per card)

| Card | Item | Evidence (file:line · before → after · proof) |
|---|---|---|
| — | log opened | `fixes/303_c2_packet.md` created pre-edit (spec §2 per-lane rules) |
| L2-P1 · F2-04 | packet budget boundary | `src/lib/packet.ts:331-347` `PacketBudget` type added; `:407-431` `packetBudgetBoundary()` added; `systemJson` gains `budget` param + envelope key `budget:` right after `spend:` (`:118`/`:191-196`); `compileAgentPacket` opts `budget?: TokenBudget \| null` (`:499-503`) + `const budget = opts?.budget ?? sessionTokenBudget()` (`:521-524`) + call-site pass (`:673`). Proof: `node --experimental-strip-types --check src/lib/packet.ts` → OK · `npx eslint src/lib/packet.ts` → **0 problems** (was 4 warnings) · `node --experimental-strip-types --test src/lib/packet.test.ts` → **56/56 pass, 0 fail** (52 baseline + 4 new F2-04 cases: empty→null, spend-no-cap, cap-crossed + on-cap, hostile-input tolerance). |

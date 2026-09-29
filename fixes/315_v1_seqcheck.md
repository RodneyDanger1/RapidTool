# 315 — V1 Sequential Check (verify the parent's landings + A2 pins file)

Lane: V1 (verifier-1, sequential checker). Repo: `C:\Users\mnril\Desktop\RapidTool Main`.
HEAD at entry: `f270b38` (Parent landings: agent-seal switch wired + T10.1 ramp sweep + T10.2 probe deleted).
Siblings live (never touch): F1/F2/F5/F6 + WD2. Dirty tree at entry: `fixes/314_wd2_guard.md` (M) — WD2's in-flight file.

## Verdict table (filled as checks complete)

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| A1a | `--agent-seal` flag parse + `flag()` semantics | PENDING | |
| A1b | Both headless signatures carry `agentSeal?: boolean` + both wildStep call sites spread it | PENDING | |
| A1c | Engine arms read it (engine.ts:4217/:4350) | PENDING | |
| A1d | Behavioral: scratch wild run with seal engages; without flag bytes as before | PENDING | |
| A1e | `npm run typecheck` — parent's files clean (only F2 selfmod reds if live) | PENDING | |
| T10.1 | greps 0 + eslint 0 on `runtime-timeline-pane.tsx` / `cmd-palette.tsx` | PENDING | |
| T10.2 | `probe_c1_arith.mjs` absent | PENDING | |
| T8.2 | cli:928-944 guard + keyless `approve` bare refusal | PENDING | |
| A2 | `src/lib/wild-seal.test.ts` exists with S1–S6 pins, keyless green | PENDING | |

## Log

- Entry: HEAD confirmed f270b38; git status shows only WD2's `fixes/314_wd2_guard.md` modified.
- Next: read `fixes/313_d1_seal.md` (the S1–S6 pin spec for A2), then verify A1 in order.


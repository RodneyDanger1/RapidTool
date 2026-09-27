# fixes/291_k12_agents.md — W40 · LANE K12 · THE AGENT-LAYER REMAINDER + THE EVENTS SETTLEMENT

**Lane:** W40 K12 (deleg_2879dda4 task-2). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE in path → shell grep only).
**Mission:** (1) §F2's remaining governance/provenance items Y3 didn't reach (`crew*.ts` / `policy.ts` /
`handoff.ts` / `report-intake.ts` / `packet.ts` boxes — verify each against bytes; skip F2-20/F2-21 = Y3-done);
(2) **the events settlement Z5 never landed** — the ~30 registered `rt-events.ts` names with no client emitter:
grep CLI/server emitters → server-emitted = ✓ record; genuinely never-emitted = honest `TODO(<row>)` comment in
`rt-events.ts` (additive, no removals). Console heartbeat scope fix = K7's — skip;
(3) any §F2 packet-truth item K7's 12-item list doesn't cover.
**Contract:** CODE-ONLY — no test runs, no typecheck, no builds, no gates, no keyed calls. Read fresh (K1–K15
LIVE; log `for <lane>`). `node --check` on every file edited. Additive only.
**Baseline HEAD:** `2fa3cd9`. Sources: `subagent-summary-1-20260926_195114_767464.txt` (F2's 31 findings) ·
`fixes/282_y3_agents.md` (landed = F2-20/F2-21 markers in `handoff.ts:128` / `report-intake.ts:99+:421`) ·
`fixes/287_z5_runtime_tail.md` (Part 2 = the registry question) · `fixes/290_k7_tinyfixes.md` (K7 = Z3 10 + Z5 G1 5 + README minors).

## Item ledger (append-only — evidence per item: file:line → before → after)

### A. §F2 remainder in my boxes (byte-verify → land / log-for-owner)
| F2 | Sev | Item | Box | Status |
|---|---|---|---|---|
| F2-01 | P1 | packet machine block hides seat provenance (`decided_via`) | packet.ts | K7 item 1 — skip |
| F2-02 | P1 | `lastTest.ok` truthiness at packet.ts:642 | packet.ts | K7 item 2 — skip |
| F2-03 | P1 | stale-packet class (compiledAtFor inputs · store re-stamp · input_hash) | packet.ts (+store) | VERIFY |
| F2-04 | P2 | no budget boundary in packet | packet.ts | VERIFY |
| F2-06 | P2 | no verification label | packet/run-eval | K9 box — log |
| F2-07 | P2 | `exportProfiles` dead surface (packet.ts:844-1010) | packet.ts | VERIFY |
| F2-09 | P2 | `crewToReport` dead (crew.server.ts:1406) | crew.server.ts | VERIFY |
| F2-10 | P1 | crew spend escapes ledger (crew.server.ts:962-984) | crew.server.ts | VERIFY |
| F2-12 | P3 | `subagent.ts` orphan — TODO(R13-f14) honest | record only | VERIFY |
| F2-13/30 | P2 | packet crew ≠ live crew | packet.ts/crew.ts | VERIFY |
| F2-14 | P0 | console approve bypasses policy seam (store.ts:1580) | store.ts | OUT — log for K10/K1 |
| F2-15 | P1 | F4 overlay zero consumers (engine/console) | policy.ts + out | VERIFY |
| F2-17 | P1 | missing `cli-exit-taxonomy.test.mjs` citation | scripts | OUT — log |
| F2-18 | P1 | two-channel seat CLI-only (headless.ts:942) | headless.ts | OUT — log |
| F2-19 | P2 | DoD teeth on note substring (dod.ts) | dod.ts | OUT — log for K10 |
| F2-22 | P1 | closed loop broken (store re-stamp) + AGENT_GUIDE wording | store + docs | PART K7 (item 10) — log rest |
| F2-23 | P2 | "the packet" is three byte strings (io.ts dup) | io.ts | K7 item 4 — log residual |
| F2-24 | P1 | AGENT_GUIDE "no live feedback channel" | AGENT_GUIDE.md | VERIFY |
| F2-25 | P1 | AGENT_GUIDE "does not build software itself" | AGENT_GUIDE.md | VERIFY |
| F2-27 | P1 | honesty lie on four surfaces (README/START-HERE/AGENTS.md) | docs | OUT — log for K11 |
| F2-05/08/11/16/28 | ? | not in 9.7 KB summary — read 280_f2 log | — | VERIFY |
| F2-20/21 | P3/P2 | Y3-done (handoff provenance · block marker) | — | skip (verify bytes only) |

### B. The events settlement (Z5 Part 2 — never landed)
| # | Item | Status |
|---|---|---|
| B1 | ~30 registered rt-events names without client emitter — classify via CLI/server greps | PENDING |
| B2 | server-emitted → ✓ record in log | PENDING |
| B3 | genuinely never-emitted → additive `TODO(<row>)` in rt-events.ts | PENDING |

## Log (append-only)

### [t0] log opened — recon read; HEAD 2fa3cd9; sibling logs K2/K3/K7/K8 live; no 291_* logs yet
- Read: F2 summary (31 findings, `subagent-summary-1-20260926_195114_767464.txt`), `282_y3_agents.md` (45 L, table ALL TODO except F2-20/21 whose markers ARE in code: `handoff.ts:128`, `report-intake.ts:99/:421`), `287_z5_runtime_tail.md` (Part 2 machinery: `rt-events.test.ts:39-99` pins the full 55-name catalogue; additive TODO comments = safe move), `290_k7_tinyfixes.md` (12-item list incl. packet 1/2/3, io de-dupe, AGENT_GUIDE; console heartbeat scope = K7), `290_k8_records.md`, K-lane manifests (`deleg_e1758fce` K1–K9; `deleg_2879dda4` K10–K15: K10 owns engine/store/phases/dod/packet/io → collision watch on packet.ts).
- `grep -rn "F2-[0-9]" src/` → only F2-20/21 markers + unrelated F2-84 (audit-43 wave). Nothing else landed by Y3.

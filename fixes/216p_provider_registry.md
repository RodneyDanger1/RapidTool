# 216p — Provider registry + role tiers (W5 · LANE 4): T-107.2

**Status:** SKELETON — in progress. Rewritten to COMPLETE at the end of the lane (this file is
the append-only work log; see §2 for the real command output).

**Owned files (this lane, nobody else):**
- `src/lib/llm/providers/deepseek.ts` — NEW (provider port)
- `src/lib/llm/providers/registry.ts` — NEW (registry: providers + roles + explicit-model rule)
- `src/lib/deepseek.server.ts` — migrated to a thin re-export (exports stable)
- `src/lib/llm.ts` — role-tier API added
- `src/lib/verify.server.ts` / `src/lib/chat.server.ts` / `src/lib/crew.server.ts` — seam switches
- `src/lib/llm.test.ts` / `src/lib/verify.server.test.ts` / `src/lib/chat.test.ts` /
  `src/lib/crew.test.ts` — registry unit tests + one migration test per switched seam
- `fixes/216p_provider_registry.md` — THIS file

**Deferred hops (list, do NOT touch):**
- `src/lib/codegen.server.ts` seam (L1 owns the file) — still calls `completeDeepSeek`.
- `src/lib/doctor.ts` provider/model surfacing (next wave).

**Findings served:** 107 T-107.2; 103 A1 (first step); 100 P0-03 (tier vocabulary).

---

## 1. Design (decided BEFORE code)

TODO

## 2. Work log

TODO

## 3. Verification (real command output)

TODO

## 4. Deferred-hops list + follow-ups

TODO

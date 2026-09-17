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

**W7 boundary status (parent, 2026-09-17):** registry tests 21/21 + verify 20/20 + chat 70/70 +
crew 46/46 + doctor 15/15 verified. Parent fixes recorded: doctor type-only import (W6), gate.sh
nested-test glob (W6), and the W7-L4 mock provider (12/12, verified by the parent — its own
provider, never a DeepSeek alias). Sections 1-3 + the deferred list STILL OWED → W8-L2.

# fixes/272_s3_depth.md — W30 · LANE S3 (DEPTH SHELLS)

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD at start:** `0f85c32` + W29 edits (uncommitted) · **Lane:** S3
**Brief read:** `wave_plans/W30/shell-sprint.md` §S3 + `finalsprint.md` master-table rows (T5.7 · T5.1 · F1 · F2 · F4 · ledger) + `research/multiagent/thoroughanalysis.md` (§W27-B W-41/42/43 · §W27-C W-44/45 · §R12-f02 · §R13-f05..f10 · §R8-f06/f07/f08/f11/f12 · §R4-f03 · §221 §F1/F2/F4).
**Ownership notes:** `src/lib/llm/**` = Lane P (re-read before editing; landed work untouched — additive only). `engine.ts` = E1b's — the ONE F4 consult hunk lands at `wildApproveGate` (documented anchor per §R8-f08); flagged below + in the finalsprint append.

## Recon at t0 (what is actually on disk)

- **T5.7 cassette**: `src/lib/cassette.ts` complete (types, canonicalization, `createCassette` :514, `selectCassette` :654, miss refusal = `CASSETTE_MISS_CODE` `RT_E_LLM_REJECTED` :89) — **ZERO consumers** (only `cassette.test.ts` imports it). No `cassette.server.ts`. → shell = the provider-seam wrapper + guarded wire point.
- **T5.1 streaming**: `DeepSeekCompleteOptions` (`src/lib/llm/providers/deepseek.ts:155`) has NO `onToken`; transport one-shot (`stream:false` :418). CLI `chat` arm (`scripts/rapidtool-cli.mjs:3076`) / `run|gate` arm (:477) have NO `--stream`. → type field + 2 CLI hunks + honest coded refusal.
- **F1 MCP**: `find src scripts -iname '*mcp*'` → empty. Artifact-kind `"mcp"` exists in types.ts only. → new `src/lib/mcp.server.ts` shell (client type + owner gate + coded refusal, zero I/O).
- **F2 step 2**: registry already has the second-family ENTRY SHAPE (`XAI_PROVIDER`, `LlmProviderDescriptor.verification`, `resolveEnvProvider`/`resolveEnvSelectedRoute`, `PROVIDERS=[deepseek, XAI_PROVIDER]`, key env `XAI_API_KEY`) + `probeProviderModels` (probe.ts) + `applyProbedModels` (openai-compatible.ts:200). **Missing:** the composed `probe()` mint shell (probe→applyProbedModels) — gated on the owner's OV-1 decision. → refusal shell in registry.ts, zero I/O.
- **F4 allow-lists**: overlay core landed (`readPolicyOverlay` :383, `policyOverlayRefusal` :421, `applyPolicyOverlay` :495); console consults it (`console.tsx:327 policyAllowListsOf`, :2180 approve funnel, :3836 dock). `Project.wildPolicy` NOT in `types.ts`; `engine.wildApproveGate` (engine.ts:3668) consults nothing; `wild.paused_policy` grep → 0. → `wildPolicy?` on Project + ONE consult in `wildApproveGate` + `wild.paused_policy` pause.
- **ledger (R12-f02 / R4-f03 / W-21)**: **INCOMPLETE** — `grep -n "sessionTokenBudget\|createTokenBudget" src` → `createTokenBudget` exists (token-ledger.ts:298, test-only consumers); **`sessionTokenBudget` → ZERO hits**. `synthWithBackoff` (`codegen.server.ts:2318-2319`) still defaults `emptyLedger()` + duplicate `p6TokenCapFromEnv` (:2286); `headless.ts:3111-3117 verifyGeneratedSource` calls `verifyAndFixServer(source, brief)` with NO budget (`opts.budget` seam exists verify.server.ts:966/986/1048, never supplied). Lane P's W29 log left the R4-f03 row unchecked → **this lane finishes it** (per shell-sprint §S3 "ledger: complete Lane P's partial per-run ledger threading if incomplete").

## Status log (append-only)

- [t0] Recon done (above). Targets + exact sites identified. No code touched yet.

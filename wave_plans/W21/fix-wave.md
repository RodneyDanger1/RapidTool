# W21 · LANES 1–2 + WD — LAND the tree-green fix (the root cause), finish F2, then the watcher runs the keyed run

**All readers share this file.** Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep
FAILS; use `grep`). Read AGENTS.md (patch-only, .ts extensions, no node:fs in client-safe modules).

```text
A WATCHER IS ARMED (proc_e87697cee804): after ALL agent activity goes quiet ≥5 min, it runs
typecheck + `npm run eval -- --keyed` and notifies with the score. Your work therefore feeds run #3 —
finish cleanly; do not leave mid-edit state (if you must stop, say so loudly in your log).

THE ROOT CAUSE (W20-L1, proof on disk): the emitted tenant declares "type":"module", but SINGLE-CHUNK trees
keep RAW CJS bytes (`module.exports.*` in src/generated/*.ts) → the tenant's own spec dies AT IMPORT:
  ReferenceError: module is not defined in ES module scope
→ zero assertions run → treeRunOk:false → C-1's mint stays silent → p6-verified unmet → M2/M3/M4 zeros.
Mechanism: `materializeImportableTree` (codegen.server.ts:1759-1790) rewrites N>1 chunk trees to ESM but
returns SINGLE-FILE trees unchanged ("legacy disk bytes"; fixes/175: "Single-chunk trees are identity").
P6's codegen contract emits CJS (codegen.server.ts:434-453 — "assign module.exports").

⚠️ HOST ARTIFACT: node under Hermes's BACKGROUND harness dies `stdin is not a tty` exit 1 — FOREGROUND only.
QUALITY: production-ready, no stubs/mocks; RED-first for the fix; no eslint-disable; a test that would pass
reverted = finding. WRITE EARLY: skeleton + bottom line within ~10 calls (`fixes/258_lane<N>_<slug>.md`).
FORBIDDEN: npm run typecheck/test/build (the watcher runs typecheck itself). Scratch: C:/Users/mnril/w21l<N>_scratch/.
Error register: fixes/257_error_ledger_v3.md (add [EXT-FAIL] rows for what you find).
```

## LANE 1 — THE FIX: single-chunk trees must be importable under `"type":"module"` (RED-first)
**Owns:** `src/lib/codegen.server.ts` (the `materializeImportableTree` region + the P6 codegen contract region),
`src/lib/codegen.server.test.ts`, and `src/lib/scaffold.ts` (only if the fix belongs there — it is DIRTY from
prior waves; check `git diff` before any edit and keep yours separable).
1. **RED first**: reproduce the crash in a test — a single-chunk tree whose generated entry uses
   `module.exports` + a tenant with `"type":"module"` + an ESM import → the current code must fail
   (`module is not defined`) — pin that RED.
2. **Fix**: make single-chunk trees go through the SAME ESM materialization as N>1 (or emit ESM for
   single-chunk) — without breaking the CJS contract for paths that must stay CJS (check `fixes/175`'s
   intent: "identity" was a deliberate simplification; the fix must preserve its real goal — likely
   "don't rewrite when unnecessary"; an ESM-emitting single-chunk tree makes the rewrite unnecessary).
3. Prove the emitted-artifact consequence: after the fix, the run-#2-style emitted tree's spec imports
   cleanly (a scratch re-materialization probe is acceptable; a full keyed run is NOT yours).
**Done-when:** the RED test exists and now passes; `codegen.server.test.ts` green (its base was 112/112);
the import-crash reproduction is pasted before/after.

## LANE 2 — FINISH F2 (the half-applied provider work) + the probe fixes if budget allows
**Owns:** `src/lib/llm/providers/*` (registry.ts, openai-compatible.ts, provider modules), `registry.test.ts`,
and — if you have budget left after F2 is clean — the p6-brief-fit/p6-arch proposals from
`fixes/255_lane2_probe_truth.md` §P1/§P2 (only if they are small, testable seams; else leave them for the parent).
**The state (W20-L4's honest handoff):** the dead W19 lane left **29 latent type errors** in your box; W20-L4's
fixes are UNVERIFIED and one provider fix is half-applied (`openai-compatible.ts` — type import only).
1. Enumerate the 29 errors with a SCOPED typecheck (scratch tsconfig extending the repo's, files = your box —
   the pattern W17-L2/L5 used) and fix them properly (no `any` casts unless the codebase's own idiom).
2. Complete the half-applied provider fix; verify `registry.test.ts` (29/29 base) + `llm.test.ts` (14/14 base)
   + `mock.test.ts`'s PROVIDERS census pin (W20-L4 repaired it at 18:01 — keep it green).
3. The live-probe evidence for the second family must be on disk (W20-L4's scratch has raws; re-derive if not).
**Done-when:** scoped typecheck = 0 errors in your box; the three suites green (FOREGROUND); the probe raw pasted.

---

## WD — the fix-wave watchdog (`fixes/259_w21_wd.md`)
READ-ONLY (report + scratch `C:/Users/mnril/w21wd_scratch/`; no repo edits; no git mutations; ≤2 FOREGROUND runs).
Poll both lanes ≥3×; verify ≥6 claims against bytes (boxes respected — `scaffold.ts` is dirty from prior waves:
its prior hunks must remain untouchable); re-run ONE named test per lane (≤2 total); no-mock/no-stub hunt;
**the run-readiness check**: before the watcher fires, confirm the tree carries NO half-applied edits from your
lanes (git status review + a scoped typecheck per lane's box) and state `READY-FOR-RUN3: yes/no + why`.
Bottom line at top: `lanes polled · incidents · claims ok/wrong · RUN3-readiness`.

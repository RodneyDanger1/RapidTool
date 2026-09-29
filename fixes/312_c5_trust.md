# fixes/312_c5_trust.md — C5 · THE TRUST FIXER (claims, security-row, stale artifacts)

Lane: C5 (312 wave). HEAD at lane start: `59dc573` (suite green per context). Writer: C5 (one-writer-per-file; this lane owns the host-check fix in `src/lib/engine.ts` + `src/lib/server-spec.ts`, the pins in `src/lib/wild-step.test.ts`, doc corrections, and `research/eval-out/results.json`).
Rule honored: NO keyed calls. Zero network at test time.

## Status board

| # | Item | Status |
|---|---|---|
| 1 | CF-SE2-1 host-check fix (deny path: `upgradeP6Keyed` + `wildStep` default reviewer) + pins | IN PROGRESS |
| 2 | CF-SE2-4 `token-ledger.ts:12` doc → real seam | PENDING |
| 3 | DA2 staleness: `research/eval-out/results.json` (pre-`endClass`) | PENDING |
| 4 | CF-SE2-2 `finalsprint.md:576` claim correction | PENDING |
| 5 | DA1 falsified detail (expandBrief 3 vs synth 2) wherever it stands | PENDING |
| 6 | M4-12/13 counts re-derive (post-311 drift check) | PENDING |

## Item 1 — CF-SE2-1 (severity high): the import-protection deny path

**The finding (SE2, `fixes/311_se2_surfaces.md` §1 + counter-findings):** the TanStack import-protection plugin denies `*.server.*` imports from the client bundle and REWRITES them to an access-reporting mock proxy whose every property is a callable, truthy, never-settling thenable. Two engine sites trusted the resolved value instead of the host:
- `engine.ts:4332-4334` (`wildStep` default reviewer): `(await import(clientSafeServerSpecifier("wild-mode"))).wildClassifierReview` → in the browser this resolves to the mock; `await reviewer(ctx)` at `:3890` (gate `:3956`/advance `:4030`) hangs forever → the store's `finally { releaseWildStart(id) }` (`store.ts:1290-1297`) never runs → **the per-project wild-start latch stays held until reload**.
- `engine.ts:3028-3064` (`upgradeP6Keyed`): the `typeof ds.isDeepSeekConfigured === "function"` + truthiness probes cannot distinguish the mock from the real module → the keyless-honesty branch is skipped and the codegen await hangs.

**The fix (SE2's recommendation, implemented):** refuse denied specifiers **by HOST CHECK** — only a bare-Node host (`process.versions.node` is a string) can resolve a runtime-assembled `.server` specifier to the real module; every other host gets the honest degradation, and the resolved value is never inspected/trusted there.
- `server-spec.ts`: new exported `isBareNodeHost()` (the ONE host check for this class; `wild-review.ts`'s private copy now imports it — closes the drift class the module doc already names).
- `engine.ts` `upgradeP6Keyed`: `if (!isBareNodeHost()) return floor;` before any import/probe — browser/worker hosts keep the deterministic floor byte-for-byte; bare-Node behavior unchanged.
- `engine.ts` `wildStep`: default reviewer resolution is `opts?.reviewer ?? (isBareNodeHost() ? <import> : notConfiguredWildReviewer)` — the honest substitute returns the same `{ok:false, reason:"not-configured"}` verdict the real classifier mints keyless (`wild-mode.server.ts:264`): open gates pause coded (`RT_E_LLM_NOT_CONFIGURED`), advance decisions take the deterministic DoD floor. The step RETURNS, so the latch releases.

**Pins:** `wild-step.test.ts` — (a) denied host + spoofed keyed `process` shim + no injected reviewer ⇒ gate pause `RT_E_LLM_NOT_CONFIGURED` (a denied host stays denied under a spoofed proxy env; never the mock); (b) denied host + spoofed keyed env ⇒ `liveLayer(p, 6)` performs ZERO `fetch` calls (stubbed spy) — the keyed upgrade never attempts a call denied hosts cannot make.

(evidence appended below as the items land)

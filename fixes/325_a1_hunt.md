# fixes/325_a1_hunt.md — W44 SIX-PROFESSIONAL BUG-HUNT · lane A1 (engine.ts box)

**Lane:** A1 · bug-hunter · box = `src/lib/engine.ts` ONLY (+ new `src/lib/engine.test.ts` pins).
**Base:** `e2fbd9d` (fix era; boundary GREEN: typecheck 0, lint 0, scripts 365/365, lib 2513 pass +1 skip).
**Scratch:** `C:/Users/mnril/a1_scratch/` (keyless repros, no key, no network).
**Register (not re-reported):** masker regex/stem/threshold · review-park mint · R-A reject seam ·
CLI coded refusals · diagnose disk-truth · spend scope label · truncation marker · honest park levels ·
checkpoint staleness · lesson clips/census/ternary · LEX fixture.
**Scoped proofs only:** `node --check`, `node --experimental-strip-types --test`, `npx eslint`.

---

### A1-1 · [HIGH · data-integrity / persisted-record loss] `WILD_PARK_UNLOCKS` mirror omits `"agent-seal"` ⇒ every persisted SEALED park (and any `lastStep` carrying one) is silently dropped by hydrate

- **Evidence (bytes):**
  - `src/lib/types.ts:152` — `export type WildParkUnlock = "configure-key" | "human-gate" | "human-retry" | "resume" | "operator" | "agent-seal";` (313 D1 added `agent-seal`).
  - `src/lib/engine.ts:2142` — `const WILD_PARK_UNLOCKS: readonly string[] = ["configure-key", "human-gate", "human-retry", "resume", "operator"];` ← the mirror was never updated; the 3140-… comment above it says "types.ts erases the unions, so the structural guards below mirror them by value".
  - `src/lib/engine.ts:2162` — `WILD_PARK_UNLOCKS.includes(unlock) &&` — false for `"agent-seal"` ⇒ `usableWildPark` → `null`.
  - `src/lib/engine.ts:2230-2231` — `const park = run.pause ? usableWildPark(w.park) : null; if (park) run.park = park;` ⇒ the sealed park is dropped, `pause` stays `true`: a paused run whose documented "park present iff pause" (types.ts:242-243, engine.ts:2227) record is gone.
  - `src/lib/engine.ts:2191` — `(s.park === undefined || s.park === null || usableWildPark(s.park) !== null)` ⇒ a `lastStep` that carries the sealed park fails the guard and the WHOLE summary is dropped too (engine.ts:2232-2233).
  - The sealed park is minted at `engine.ts:4415` — `seal ? { code: "RT_E_LLM_NOT_CONFIGURED", unlock: "agent-seal" } : null` (pinned in `src/lib/wild-seal.test.ts:247-256`), and the CLI loads project files with `preserveWildRun: true` (`src/lib/headless.ts:102`, `scripts/rapidtool-cli.mjs:3749`, `:4009`) — i.e. exactly the paths where the record must survive.
- **Repro (keyless, `C:/Users/mnril/a1_scratch/repro1.mjs`):** `wildStep(fixture, {reviewer: not-configured, agentSeal:true})` → in-memory `park.unlock = "agent-seal"`, `lastStep.park.unlock = "agent-seal"`; after `hydrateProject(p, {preserveWildRun:true})` → `pause = true`, `park = undefined`, `lastStep = undefined`; control (no seal) → `park.unlock = "human-retry"` survives. Output:
  `IN-MEMORY park.unlock = agent-seal` / `HYDRATED pause = true` / `HYDRATED park = undefined` / `HYDRATED lastStep = undefined` / `CONTROL (no seal) park.unlock = human-retry`.
- **Impact:** the ONE coded park class the seal exists to advertise (`agent-seal` + its `unlockText`) is unreadable after any save/load; console/CLI/diagnose branch on `park` and see none while `pause:true`. Silent truncation of the persisted truth — the exact class this wave hunts.
- **Fix (`src/lib/engine.ts:2142-2152`):** add `"agent-seal"` to the mirror + a compile-time drift alarm so the next `types.ts` union growth fails typecheck instead of silently dropping records; `.includes` call widened explicitly (the tuple no longer is `readonly string[]`).
- **Pin (`src/lib/engine.test.ts` · §A1-1):** in-memory sealed park → hydrate(`preserveWildRun:true`) keeps `park` and `lastStep` byte-identical (deep-equal); default hydrate (force-stop) clears `park` (the pre-existing invariant, unchanged); a garbage unlock is still REJECTED (guard not weakened).

---

## Closure (parent-appended 2026-09-30; lane A1b capped after landing both fixes; proofs parent-run fresh)

**A1-1 (inherited, re-verified + HARDENED beyond the sketch above):** the fix was upgraded from a hand-maintained mirror to a DERIVED accept-set — `acceptedParkUnlock()` (`engine.ts:2154`) reads the compile-time-exhaustive `WILD_UNLOCK_TEXT` record (`engine.ts:3897`); the old `WILD_PARK_UNLOCKS` array is GONE (0 residues) so the drift class is structurally dead. Mirror audit: the three sibling accept-lists (`WILD_STEP_OUTCOMES`/`ACTIONS`/`NEXT_ACTIONS`) match types.ts exactly — no remaining drift of this class.

**A1-2 (NEW, found + fixed by A1b):** `parkIfNull` (`engine.ts:~4799-4822`) stamped a fixed `event:"wild.paused"` — a row that does not exist on ~14 pause arms (a lying contract for `WildParkInfo.event`, referenced by diagnose/UI). Now: `event` = the last `wild.*` log row (append-only, one row per pause ⇒ the last row IS the pause row), fallback `wild.paused`. Repro `a1_scratch/repro2.mjs`: unsealed classifier park → `wild.paused_classifier` (row exists ✓), locked edge → `wild.error` (✓); sealed control unchanged. (Already inventoried at `fixes/308_bugmap.md:42,181,196` — listed, never landed, unprotected by any pin; now fixed + pinned.)

**Fresh proofs (parent-run, post-patch):** `node --check` engine.ts **OK** · `engine.test.ts` **10/10** · `wild-seal.test.ts` + `wild-step.test.ts` **49/49** · `eslint` engine+test **exit 0** · `npm run typecheck` **exit 0 · 0 errors**. Logs: `w44_eng2.log`, `w44_ws3.log`, `w44_esl5.log`, `w44_tc8.log`.
**Pins:** `src/lib/engine.test.ts` (CREATED) — §A1-1a round-trip verbatim + non-sealed control · §A1-1b all 6 union unlocks accepted / 7 near-miss+garbage rejected / bad `lastStep.park` drops the whole summary · §A1-1c pause⇔park invariant across preserve-hydrate / default-hydrate / resume · §A1-2 four park arms each asserting `park.event` ∈ its own rows.

=== END 325_a1_hunt — COMPLETE (parent-completed; hunter A1 + finisher A1b edits; proofs parent-run; cross-verified by V6/V7) ===


# fixes/312_c5_trust.md — C5 · THE TRUST FIXER (claims, security-row, stale artifacts)

Lane: C5 (312 wave). HEAD at lane start: `59dc573` (suite green per context). Writer: C5 (one-writer-per-file; this lane owns the host-check fix in `src/lib/engine.ts` + `src/lib/server-spec.ts`, the pins in `src/lib/wild-step.test.ts`, doc corrections, and `research/eval-out/results.json`).
Rule honored: NO keyed calls. Zero network at test time.

## Status board

| # | Item | Status |
|---|---|---|
| 1 | CF-SE2-1 host-check fix (deny path: `upgradeP6Keyed` + `wildStep` default reviewer) + pins | **LANDED** — C3's structural fix + C5's pins; D5 re-ran 2/2 at `de7deae` (§1) |
| 2 | CF-SE2-4 `token-ledger.ts:12` doc → real seam | **LANDED** — premise falsified; `:21` corrected (§2) |
| 3 | DA2 staleness: `research/eval-out/results.json` (pre-`endClass`) | **LANDED** — stamped stale in place; read-side cites `absent 1` (§3) |
| 4 | CF-SE2-2 `finalsprint.md:576` claim correction | **LANDED** — §C5-TRUST above the end marker (§4) |
| 5 | DA1 falsified detail (expandBrief 3 vs synth 2) wherever it stands | **LANDED** — comment corrected with provenance (§5) |
| 6 | M4-12/13 counts re-derive (post-311 drift check) | **LANDED** — C5 re-derive + D5 post-C-wave re-derive (§6 · §D5.3) |

**Close-out (2026-09-29, D5 finisher):** all six landed; the per-item evidence (§1–§6) and the D5 landing verifications (§D5) are appended below.

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

---

## Evidence — the six items, as landed (appended 2026-09-29 by the D5 finisher)

*Filled from C5's own record (its close-out `subagent-summary-4-20260929_165019_785496.txt`) with every cited byte re-read on `de7deae`; line numbers are the `de7deae` bytes.*

### §1 — CF-SE2-1 deny path: LANDED (structural fix by the 312-C3 lane; independent pins by C5)

- **Where it landed.** The host check + trust gates live in the NEW `settle.ts`: `isBareNodeHost()` `:51` (`typeof process !== "undefined" && typeof process.versions?.node === "string"`), `isTrustedCallable()` `:62` (one `.name` property read — safe on the mock, a string on real functions), `settleWithin()` `:87` (refuses mock-shaped callables before adoption, `:89-97`; never rejects; ref'd-timer rationale in the doc). `engine.ts:5` imports all three from `./settle.ts`.
- **The two sites.** `upgradeP6Keyed` (`engine.ts:3056`): `:3065` `if (!isBareNodeHost()) return floor;` before any import/probe; `:3087` `isTrustedCallable(codegen.liveP6Synthesis)` gate; `:3095` `settleWithin(…, P6_SYNTH_HANG_BOUND_MS)` (`:3037`). `wildStep` (`engine.ts:4326`): `:4446` `await resolveWildReviewer(opts?.reviewer)`; `resolveWildReviewer()` `:3951-3962` — a provided reviewer is trusted only via `isTrustedCallable` (`:3952`), a denied host gets `unavailableWildReviewer` (`:3953`; `:3936` returns `{ ok: false, reason: "not-configured" }`), the imported candidate is trust-checked (`:3958`), a load failure falls to the honest substitute (`:3962`); the resolved call awaits through `settleWithin` (`:3995`). The step RETURNS on every path ⇒ the store's `finally { releaseWildStart(id) }` runs — the latch the hang held releases (C3's root cause: a mock-proxy await is microtask starvation — no timer can bound it; `fixes/312_c3_lifecycle.md` §1).
- **Reconciliation (skeleton vs landed — the skeleton was written early).** The skeleton's plan named `server-spec.ts` for the new export + a wild-review import-dedupe. Landed bytes: the gates are in `settle.ts`; `server-spec.ts` is untouched (it remains the A1-12 specifier-assembly helper); `wild-review.ts` keeps its own private host guard (`:70`) — `settle.ts`'s doc names it "the mirror of wild-review.ts's host guard". Behaviorally equivalent (both read `process.versions.node`); the dedupe did not land.
- **C5's independent pins — re-run green by D5 on `de7deae`.** `src/lib/deny-path.test.ts` (117 lines, new; its header cites this log). `node --experimental-strip-types --test src/lib/deny-path.test.ts` → exit 0, `# tests 2 · # pass 2 · # fail 0`:
  - (a) *"a denied host stays denied under a spoofed proxy env — the gate pauses coded, never hangs"* — browser-shaped `process` shim (keyed env, no `versions.node`) + no injected reviewer ⇒ `wildStep` returns `outcome:"paused"`, `code:"RT_E_LLM_NOT_CONFIGURED"`, `wildRun.pause === true`, a `wild.paused_classifier` row — never the never-settling mock.
  - (b) *"a denied host keeps P6 on the deterministic floor — a spoofed keyed env triggers ZERO keyed calls"* — stubbed `fetch` spy ⇒ 0 calls; the control leg asserts `isDeepSeekConfigured() === true` under the same spoof, so the refusal is the HOST CHECK, not env blindness.

### §2 — CF-SE2-4: premise FALSIFIED; doc corrected (token-ledger)

- **The function EXISTS.** `recordSpendWithinCap` — exported at `token-ledger.ts:540` (added `673e349`, 2026-09-16), pinned by `token-ledger.test.ts:52` (unmetered no-op-throws) and `:114-119` ("allows landing on cap; throws only past it"). The "non-existent" premise is disproven on bytes.
- **Line-ref note (drift).** C5's close-out and `finalsprint.md` §C5-TRUST cite `:533` — that was the PRE-edit position; C5's own `:21` comment edit (+7 lines; the C-wave diff hunk `@@ -18,8 +18,15 @@`) shifted the export to `:540` (current byte, re-derived by D5). Grep `:540`.
- **The correction.** `:12` left as-is (accurate: the unmetered-path list). `:21-30` now carries the corrected parent wiring: "the codegen synth paths meter through `accountSynthUsage` → recordSpend + the session-budget cross-check. The ledger-object helpers here (wouldExceed / assertWithinBudget / recordSpendWithinCap — all REAL exports, test-pinned) … are the seam-callable API; the three ledger-object helpers have no production call site today." Byte-present at `de7deae`.

### §3 — DA2 staleness: `results.json` stamped in place (not refreshed) — verified

- **Pre-HEAD `59dc573`:** `git show 59dc573:research/eval-out/results.json` → `generatedAt 2026-09-25T00:03:43.504Z`, `mode:"keyed"`, **zero** `stale` keys, **zero** `endClass` occurrences (grep counts 0/0): the entry row predates the `endClass` key (`8418b04`, 2026-09-28).
- **It rode the C-wave commit as the stamp.** `git show de7deae -- research/eval-out/results.json` — the commit's only delta is +3 keys: `stale:true`, `staleStampedAt:"2026-09-29T21:45:54Z"`, `staleNote`. On disk today `grep -c endClass results.json` = 1 — and that single line is inside the `staleNote` text; the entry row still carries no class.
- **Read-side live proof (read-only; no network/key).** `node --experimental-strip-types scripts/rapidtool-cli.mjs eval` → exit 0, 24,825 bytes, `ok:true`, `dir:"…\research\eval-out"`; census line: `"endClass census (1 entries): funded 0 · unfunded 0 · unmeasured 0 · absent 1 — \"absent\" = the row carried no endClass (a legacy artifact predating the key); never guessed into a class."` (per-row `"endClass": null`).
- **Why stamp-over-refresh still holds (re-verified).** `scripts/run-eval.mjs` flags = `--keyed` `:119` · `--all` `:121` · `--limit=` `:122` · `--trials=` `:129` · `--k=` `:139` · `--preflight` `:3131` — no read-only re-render mode exists; a refresh is a real harness run that would overwrite this newest keyed record. Reader-tolerance citation verified, `run-eval.mjs:2589-2590`: "A reader must still tolerate the key's absence on legacy artifacts (scorecard reader) — never invent a class." **Nothing left to change: the stamp is the honest fix and it is accurate.**

### §4 — CF-SE2-2 finalsprint correction: appended above the end marker — verified

- `finalsprint.md:594` `## §C5-TRUST — 312 C5 lane corrections (fixes/312_c5_trust.md)`; `:596` the CF-SE2-2 correction ("WIRE-2 … FALSE on the browser host": the phase-6 branch is gated on `keyedDeepSeekConfigured()` — client-false; console Execute uses `liveLayer`, never `headless.runP6Edge`; bare-Node reach only; a client shim still lands the coded floor + row); `:597` the corrected status ("the wire exists in bytes … console reach is NOT present today — OPEN"); `:599` also-filed (CF-SE2-4 · expandBrief · the results.json stamp); `:601` sign-off "Appended 2026-09-29 by C5 (312)". It sits ABOVE the file's end marker at `:603` (`<!-- END-OF-FILE-MARKER-SPRINT · every lane appends ABOVE this line · never edit or delete this line -->`). Re-read at `de7deae`; byte-intact.

### §5 — DA1 expandBrief 3-vs-2: corrected at its live home — verified

- `codegen.server.ts:2459-2471` — the retry-with-backoff block now reads "expandBrief: `P6_EXPAND_MAX_ATTEMPTS = 3`; this synthesis seam: `P6_SYNTH_MAX_ATTEMPTS = 2`", with the provenance sentence (at the `:2466` "312 C5:" marker): *"this sentence used to read \"expandBrief already has: 2 attempts\" — DA1 falsified the count and the 311 guard re-verified it (`fixes/311_da1_claims.md:16`, `fixes/311_wd_guard.md:39`): the 2 belongs to synthesis, expandBrief is 3 (backoff 500/1000ms, see `:2429`/`:2449`)."* Byte-present at `de7deae`.

### §6 — M4-12/13 counts: C5's re-derive + the D5 post-C-wave re-derive

- C5 re-derived post-311: `fixes/` **484→526**, Total **1,792→1,834**; every other row matched (research 476 · wave_plans 106 · scripts 45 · src 212 · multiagent 103 · eval-corpus 23 · .t4scratch 192); patched `README.md` (5 spots) + `START-HERE.md` (1). M4-13 census re-run: **56 catalogue / 18 emitted / 38 dead** — unchanged; re-count stamped `rt-events.ts:230-233` ("312 C5 re-count 2026-09-29 … catalogue 56 · emitted 18 · dead 38 — still 38 of 56").
- **D5 re-derived ONE more time post-C-wave** (HEAD `de7deae`): the C-wave commit moved five counts again — full command list, outputs, reconciliation and the README/START-HERE patches are in **§D5.3** below.

---

## §D5 — D5 close-out (2026-09-29): log filled · results.json verified · counts re-derived · rescue headers

**D5.1 — C5's log evidence sections: FILLED (this write, made FIRST per the cap lesson).** §2–§6 above + the item-1 landed-bytes block; the status board is set to LANDED. The skeleton's early `server-spec.ts` bullet is reconciled in §1 (landed reality: the gates are in `settle.ts`; `wild-review.ts` keeps its private mirror).

**D5.2 — `research/eval-out/results.json`: VERIFIED — not refreshed; the honest in-place stamp holds.** Full evidence in §3. It rode the C-wave commit as the +3-key stamp (`stale:true`, `staleStampedAt`, `staleNote`); the entry row carries no `endClass` (pre-`endClass` artifact; `grep -c endClass` = 1 and that hit is inside the `staleNote`). The read-only read-side (`eval` verb, run at `de7deae`) exits 0, `ok:true`, and cites `endClass census … absent 1 … never guessed into a class`. Re-render alternatives checked honestly and infeasible: the `eval` verb is a scorecard over existing bytes (no re-render), `run-eval.mjs` has **no** read-only mode (`--keyed`/`--all`/`--limit=`/`--trials=`/`--k=`/`--preflight` only), and any harness run would overwrite this newest keyed record — keyed runs are out (NO keyed calls). **Verdict: stamp-over-refresh was the correct honest fix; no change made; the stamp is accurate.**

**D5.3 — README/START-HERE counts re-derived ONE more time post-C-wave.** Commands + outputs (HEAD `de7deae`, tracked index; siblings mid-edit in the working tree — index numbers are unaffected):
```
git ls-files | wc -l                        → 1,846   (was 1,834 at 59dc573)
git ls-files fixes | wc -l                  → 532     (was 526)
git ls-files src | wc -l                    → 215     (was 212)
git ls-files src/lib | wc -l                → 204 = 116 modules + 88 tests (was 201 = 115 + 86)
git ls-files wave_plans | wc -l             → 107     (was 106; +W43/COMPLETION-TASKS.md)
git ls-files | awk '!/\//' | wc -l          → 45 root (was 43; +2 probes)
git ls-files scripts | wc -l                → 45 (unchanged)
git ls-files research | wc -l               → 476 = multiagent 103 + eval-corpus 23 + eval-out 345 + 5 top-level (unchanged)
grep -c 'case "' scripts/rapidtool-cli.mjs  → 39 verbs (unchanged)
```
All other census rows unchanged (`.grok` 89 · `builds` 50 · `vault-e2e` 47 · `screenshots` 16 · `public` 10 · `audit-bugs` 5 · `audit`/`review`/`proposals` 3+3+3 · `server` 2 · `migrations` 2 · `.github` 1 · `attachments`/`artifacts`/`.audit-g2` 1+1+1 · `.t4scratch` 192).
**Delta reconciliation:** `git diff --name-status 59dc573..de7deae` = 12 A / 0 D — the 6 `312_*` lane logs + `probe_311_shots.mjs` + `probe_c1_arith.mjs` + `src/lib/{deny-path.test.ts, settle.test.ts, settle.ts}` + `wave_plans/W43/COMPLETION-TASKS.md` ⇒ +12 tracked = 1,834→1,846 exactly.
**Patches applied by D5 (post-C-wave).** `README.md` — ① catalog heading → 1,846; ② census paragraph (1,846 · HEAD `de7deae` · the caveat now names the C-wave movement + the live D-wave untracked set); ③ §10.1 heading HEAD; ④ `fixes/` row → 532; ⑤ `src/` row → 215; ⑥ `wave_plans/` row → 107 (+W43); ⑦ root row → 45; ⑧ Total → 1,846; ⑨ §10.2 heading → 45 + the two probe rows added (`probe_311_shots.mjs`, `probe_c1_arith.mjs`); ⑩ §10.6 heading → 204 = 116+88; ⑪ §10.9 heading → 532; ⑫ §10.10 heading → 107 (+W43); ⑬ §10.10 tracked-waves list → +W43; ⑭ §10.10 named list → +`W43/COMPLETION-TASKS.md`. `START-HERE.md` — row 1 `src/lib` 201→204; row 5 `fixes/` 526→532; row 6 `wave_plans/` 106→107 + `W4`→`W43`. Post-patch re-grep confirms every number; `git diff --stat` = README 39 lines · START-HERE 6 lines touched.
**M4-13 census:** unchanged — `rt-events.ts:230-233` re-count (56 catalogue / 18 emitted / 38 dead) byte-present at `de7deae`.

**D5.4 — rescue-header corrections: ALL FIVE 311 rescues (satisfies `fixes/311_wd_guard.md:205`'s "parent may tidy" flag).** One line inserted directly under each file's line-1 RESCUED header, so it precedes the stale status note a reader hits first (verbatim; ONE line per file, starting with a `>` blockquote marker):
```
> **RESCUED-header correction (2026-09-29):** this file is on disk and complete — content verbatim from the auditor's final summary as pasted by the parent; the stale "file not written / not yet on disk" self-references below describe the original iteration-cap moment, not this file's state.
```

**Applied to:** `fixes/311_da1_claims.md` (stale refs: "⚠️ FILE NOT WRITTEN", "was never created") · `fixes/311_da2_data.md` ("The file is NOT yet on disk", "was never written") · `fixes/311_se1_pipeline.md` ("Deliverable gap: I did not write…") · `fixes/311_se2_surfaces.md` ("CAP HIT — … was NOT written") · `fixes/311_ma_competitive.md` ("deliverable file NOT written", "File not written"). Verified: `grep -c 'RESCUED-header correction'` = 1 in each of the five.

**D5.5 — hygiene / notes.** No keyed calls; no product code touched (docs + one standalone read-only test-file run + the read-only `eval` verb + a `/tmp` redirect only; the `eval` verb's standard NDJSON telemetry row lands under `.rapidtool/logs/` — gitignored). Drift on record: `token-ledger.ts` `:533→:540` (§2) — `finalsprint.md` §C5-TRUST still cites `:533`; flagged here, no edit made (out of lane scope). Live-tree state at write: siblings mid-edit (` M` on `scripts/*`, `src/lib/*`, `fixes/312_c2/c3/c4`, + `?? fixes/313_d1_seal.md`, `?? probe_d4_verify.mjs`); the §D5.3 counts are the tracked index at `de7deae` — D-wave files not yet tracked will move them again at commit (the README caveat now says exactly this).
**Files modified by D5:** `fixes/312_c5_trust.md` (this log) · `README.md` · `START-HERE.md` · `fixes/311_da1_claims.md` · `fixes/311_da2_data.md` · `fixes/311_se1_pipeline.md` · `fixes/311_se2_surfaces.md` · `fixes/311_ma_competitive.md`. No product code; not committed (left for the parent's wave commit).

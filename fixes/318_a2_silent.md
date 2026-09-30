# 318 A2 — Silent-error finisher: store.ts thrown-path class (W44 lane A2)

Lane A2 · Box: `src/lib/store.ts` · `src/lib/store.test.ts` · this log.
Dispatch HEAD: **091b389** — boot `git status --porcelain` printed nothing (clean), `git log -1` = 091b389 (ran today).

Sources read today (2026-09-30): `fixes/317_l1_silent.md` (skeleton, 23 L), `fixes/317_l1w_watch.md` (skeleton, 25 L),
`fixes/317_k1_bugcheck.md` §K1-R10, `git show ba5a392 -- src/lib/store.ts src/lib/store.test.ts`,
`fixes/316_h7_survive.md:83` (ESM un-patchability), `src/lib/errors.ts:155-316` (classifyError semantics),
`src/lib/engine.ts:2948-3430` (fetchResearch + deepenResearch), `src/lib/io.ts`, `src/components/console.tsx:6438-6503`.

Import confirmed live: **store.ts:42** `import { classifyError, type ErrorCode } from "./errors.ts";`

Class definition (narrow, per task): `catch (err)` blocks on store actions whose returned envelope carries/could
carry `code?: ErrorCode` but the catch returns **no** code — the thrown path's failure class is invisible to callers.

---

## 1. L1W's three landed sites — re-verified at HEAD 091b389 (read today)

| # | site | comment line | coded return line | verdict |
|---|------|--------------|-------------------|---------|
| 1 | runVerifyAsync catch | store.ts:1040 | store.ts:1041 | **STANDING ✓** |
| 2 | runP6Journey catch | store.ts:1094 | store.ts:1095 | **STANDING ✓** |
| 3 | runModuleReal F3-08 seam catch | store.ts:1606 | store.ts:1607 | **STANDING ✓** |

All three return `code: classifyError(err, "RT_E_INTERNAL")`; their declarations carry `code?: ErrorCode`
(runVerifyAsync :133, runP6Journey :156, runModuleReal :162 — widened in ba5a392 for the first two).
NOTE: my fix below inserts **one line at :1003**, so every line after it shifts **+1**:
L1W sites become :1041-42 / :1095-96 / :1607-08 (re-verified post-edit — see §6).

## 2. Full catch sweep of store.ts — all 18 sites (`grep -n catch src/lib/store.ts`, run today)

Class key: **(i) CLASS MEMBER** = uncoded thrown-path envelope on an action whose declaration carries/could
carry `code`; **(ii) intentional quiet guard/pattern** = leave, with why.

| # | line | shape | class | rationale / why-not |
|---|------|-------|-------|---------------------|
| 1 | 627 | `catch (err)` — synthesizeAsync | (ii) | A1-19 **coded warn-row pattern**: the throw ALREADY surfaces classified — `detail: ...runPhaseAsync failed (${classifyError(err)})...` (:642) → `llm.degrade` warn row; return type is `Promise<Project>` — no envelope/code slot exists. |
| 2 | 779 | `catch {}` — currentStorage() | (ii) | storage absence is an expected runtime state; `undefined` is the helper's contract (zustand persist handles absence). |
| 3 | 833 | `catch {}` — persist getItem JSON.parse | (ii) | corrupt blob → `null` = "empty" so hydration ALWAYS completes; the next write heals the blob (comment :834-836). |
| 4 | 849 | `catch (err)` — persist setItem quota/blocked | (ii) | H4 doctrine "Never propagate into the action" (:850): a quota error must not throw through a zustand `set()` into the UI button; failure is retried via salvage below. |
| 5 | 858 | `catch (err2)` — salvage retry failed | (ii) | second failure is RECORDED: `lastPersistFailure` (:859) + `reportRt` telemetry (:861-868) + `console.warn` (:872-874), surfaced via `persistStorageHealth()` (:767). |
| 6 | 869 | `catch {}` — reportRt telemetry | (ii) | contract law (AGENTS.md §7): telemetry must never throw into the code it observes. |
| 7 | 881 | `catch {}` — removeItem | (ii) | best-effort; a blocked remove must never throw into callers (:882). |
| 8 | 932 | `catch {}` — preserveUnreadableBlob | (ii) | K2 rescue copy is explicitly best-effort, runs inside the hydration callback, must never throw (:933). |
| 9 | 978 | `catch {}` — onRehydrateStorage | (ii) | H4 belt-and-braces: recover instead of stranding hydration (:979-981). |
| 10 | **1003** | `catch (err)` — **deepenResearch** | **(i) CLASS MEMBER → FIXED** | returned the envelope with NO code; declaration carried `code?`; callers receive the envelope (console.tsx:6483-6484). Fixed as `code: classifyError(err, "RT_E_INTERNAL")` + `// 318_a2:` comment. |
| 11 | 1039 | `catch (err)` — runVerifyAsync | (already coded) | 317_l1w: `code: classifyError(err, "RT_E_INTERNAL")` (:1041). Verified standing. |
| 12 | 1093 | `catch (err)` — runP6Journey | (already coded) | 317_l1w: same (:1095). Verified standing. |
| 13 | 1289 | `catch (e)` — startWildRun loop | (already coded) | returns `code: "RT_E_INTERNAL"` hardcoded (audit-43 P1-1 comment :1290-91); envelope `WildRunResult` (:79) carries `code?: ErrorCode`. Not uncoded → NOT in class. (Hardcoded literal is deliberate per audit-43; leave.) |
| 14 | 1605 | `catch (err)` — runModuleReal F3-08 seam | (already coded) | 317_l1w: same (:1607). Verified standing. |
| 15 | 1690 | `catch {}` — refreshStatuses (llm probe) | (ii) | feature-probe: absent llm.ts → honest deterministic default (:1672, :1691); no failure envelope exists. |
| 16 | 1707 | `catch {}` — refreshStatuses (research probe) | (ii) | same pattern for research.ts (:1673, :1708). |
| 17 | 1833 | `catch {}` — rejectAsync guidance | (ii) | guidance is optional; must never block the rejection; action returns `{ok:true}` regardless (:1834, :1836). |
| 18 | 1858 | `catch {}` — clone structuredClone | (ii) | documented B-08 fallback → `JSON.parse(JSON.stringify(...))` (:1859); result is a Project, not an error envelope. |

**Sweep verdict: exactly ONE remaining class member — deepenResearch :1003.** All other uncoded catches are
intentional (guard/probe/telemetry/persistence doctrine), each with its why above. No over-conversion.

## 3. The fix (store.ts) — LANDED (exact, as applied)

**F1 — catch :1003-1005** (before):
```ts
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
```
(after):
```ts
        } catch (err) {
          // 318_a2: classify the thrown path — the declaration above carries code?.
          return { ok: false, error: err instanceof Error ? err.message : String(err), code: classifyError(err, "RT_E_INTERNAL") };
        }
```
Mirrors L1W's comment style exactly (lane tag swapped).

**F2 — declaration :127 alignment** (after): `code?: string` → `code?: ErrorCode`.
- Neighbours :133/:156/:162 already `code?: ErrorCode`; the impl now returns ErrorCode values (`"RT_E_PROJECT_MISSING"` literal ∈ ErrorCode — proven by :1010/:1053 compiling under ErrorCode decls — plus `classifyError(...)` → `ErrorCode`).
- Consumer check (grep today): the store action's only real consumer is console.tsx `DeepenResearchButton` (:6444-6457) — duck-typed via `as unknown as DeepenAction` reading only `.error` (:6484) → unaffected; no test/scripts consumers (`grep -rn deepenResearch src scripts`). Honest minimal change: align to the neighbours. Proven by typecheck + suite (§5).

## 4. Pins (store.test.ts) — LANDED (both pinned; suite green — §7)

- **Pin P1 (guard arm)** — unknown id ⇒ `{ ok:false, code:"RT_E_PROJECT_MISSING" }` (guard at :996). Currently unpinned
  (`grep -n deepenResearch src/lib/store.test.ts` → empty, today). Style mirrors L1W's :388 pin.
- **Pin P2 (thrown path)** — reachability trace (see §5): a genuine throw IS inducible through the public action
  with a malformed stored record (`phases` non-array → engine.ts:3323 `(project.phases ?? []).find` TypeError →
  store catch). Pin asserts `ok:false`, `code:"RT_E_INTERNAL"`, `/is not a function/`. Real engine code throws; no monkeypatch, no mock.
- No L1W pins weakened; additions only.

## 5. Thrown-path reachability trace (depth for the task's "never fake" bar)

`store.deepenResearch(id, phase)` → serialized → `await deepenResearchEngine(p, phase)` (static import, store.ts:20).
`engine.deepenResearch` (engine.ts:3309-3428):
- :3322 `if (!RESEARCH_PHASES.has(phase)) return project;` — no throw.
- :3323 `const rec = (project.phases ?? []).find(...)` — **throws TypeError when `phases` is a non-nullish non-array**
  (the H4 junk-shape family store.ts:784-793 itself names: "a `phases` value that is neither an array nor absent … would throw").
- :3324 `if (!rec || rec.status !== "complete") return project;` — no throw.
- :3326 `await fetcher(...)` = fetchResearch (engine.ts:2948-3007): **never throws** — both inner failure paths are
  swallowed (`catch { unavailable = true }` :2975-77; `catch { narrative = null }` :3002-04); returns null for non-research.
- :3329+ post-processing on a complete research record — pure helpers (`researchQueryFor`/`art`/`recordGateInto`), no reachable throw with a well-formed record.
- KEYLESS constraint: tests must not use keys/network, so no live-fetcher throw is inducible; the action exposes **no DI seam** (signature `(id, phase)` only — unlike runVerifyAsync's opts.server / runP6Journey's deps).
- ESM note: force-swapping the engine import is impossible — ESM named imports are live bindings, provably not
  patchable (`fixes/316_h7_survive.md:83`: "ESM named imports … are provably not patchable (live-binding probe: false)").
- **Conclusion: the only genuine inducible throw is the malformed-record one (engine.ts:3323) — that is what P2 pins.**
  Well-formed inputs early-return; that arm is covered by P1 (guard) + existing no-op behavior.

## 6. Cross-file sweep (idle src/lib, same class?) — done today

| file | catch sites checked | verdict |
|------|---------------------|---------|
| chat.ts | :66-72, :431-433, :457-461 | already `code: classifyError(err, "RT_E_INTERNAL")` — CLEAN |
| crew.ts | :193-199 (+ :209 quiet default) | already classified — CLEAN |
| llm.ts | :131-137, :183-189 | already classified — CLEAN |
| knowledge.ts | :182-188 (code:"RT_E_VALIDATION"), :377 rethrow, :537 rethrow | coded or deliberate rethrow/refusal — CLEAN for the class |
| planning.ts | :180, :211 | quiet nulls — CLEAN |
| io.ts | :466-467, :513-514 | **cousin — NOT patched, ticket below** |

### `for parent:` ticket — thread `ImportResult.code` end-to-end (io.ts ↔ store) [NOT done this lane]
- io.ts:466-467 (`JSON.parse` catch) and :513-514 (hydration catch) return `ImportResult` (io.ts:20-22 — carries
  `code?: string`) with NO code. classifyError mappings when it lands: both would map (JSON SyntaxError → `RT_E_VALIDATION`;
  hydration throw → fallback `RT_E_INTERNAL`, decide per-mint).
- **BUT the store drops even the field**: store.ts:1951 `return { ok: false, error: parsed.error };` and store-side
  `ImportProjectResult` (store.ts:81-83) has NO `code` slot — so a catch-level fix alone would be invisible end-to-end.
- io.ts:37-41 (**A1-25**) explicitly defers exactly this: "TODO(A1-25): mint `RT_E_IMPORT_TOO_LARGE` (+ ERROR_CODE_DOC
  entry) and thread it through `ImportResult` when the errors-registry pass lands — until then the message is the contract."
- Required when landed: io.ts both catches + io.ts:20-22 stays `code?: string`→`ErrorCode`?, store.ts:81-83 gains `code?: ErrorCode`,
  store.ts:1951 forwards `code: parsed.code`, pins in io.test.ts §importProject (:95+) and store.test.ts importProject pin. Older notes:
  this needs a small cross-file decision + test updates ⇒ ticket, not a tiny drive-by.

### drift note for K1-R9 / A3 (`wild-seal.test.ts` line cites) — RE-MEASURED post-A2
- wild-seal.test.ts:21 and :310 cite `store.ts:1241` / `:1283`; K1-R9 already flags them stale. My +1-line insert at
  :1003 shifts everything after it. **Post-A2 actuals (measured today):** `for (let step = 0; step < 20; step++)` is now
  **store.ts:1242**; the cap site is now **:1284** (`"wild.cap",`) / **:1285** ("Wild loop step cap (20) reached — run parked.").
  A3/K1 must re-grep at edit time (A3 owns wild-seal.test.ts this wave).
- `git grep -n "store\.ts:[0-9]"` over src+scripts (run today): the ONLY live src/scripts file citing store.ts line
  numbers is wild-seal.test.ts (`fixes/*.md` cites are historical append-only entries — do NOT touch).

## 7. PROOF — all legs run today (foreground, redirected to files, then read)

**Leg 1 — scoped suite** · `node --experimental-strip-types --test src/lib/store.test.ts` → `EXIT:0`
```
1..83
# tests 83
# suites 0
# pass 83
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2183.9365
```
- New pins: `ok 16 - deepenResearch unknown id carries the declared RT_E_PROJECT_MISSING code (318_a2)` ·
  `ok 17 - deepenResearch classifies the thrown path — a real engine throw carries RT_E_INTERNAL (318_a2)`.
- L1W pins still green: `ok 15 - runVerifyAsync unknown id carries the declared RT_E_PROJECT_MISSING code (317_l1w)` ·
  `ok 18 - runP6Journey guards an unknown project id (fixes/150 M4 ms4 journey mirror)`.

**Leg 2 — scoped lint** · `npx eslint src/lib/store.ts src/lib/store.test.ts` → `ESLINT_EXIT:0`; log = npm-notice lines only → **0 problems**.

**Leg 3 — typecheck (≤1 run)** · `npm run typecheck` → `TYPECHECK_EXIT:0`; log = npm-notice lines only.

**Re-run (fresh, post-log edits — verifier hook wants current evidence on the changed paths)** · scoped suite again → `TEST_EXIT:0`
— `1..83 / # tests 83 / # pass 83 / # fail 0 / # duration_ms 1763.1114`; new pins `ok 16` / `ok 17` present in this run ·
eslint again → `ESLINT_EXIT:0` (npm-notice lines only). typecheck NOT re-run (lane cap ≤1; the single run above was already
post-edit and exit 0).

## 8. Post-edit verification + workspace state

- L1W sites re-grepped post-insert (all STANDING): :1041-42 runVerifyAsync · :1095-96 runP6Journey · :1607-08 runModuleReal
  F3-08 — each `// 317_l1w:` comment + `code: classifyError(err, "RT_E_INTERNAL")`. New site: :1004 comment + :1005 code.
- Decl check: `grep -n "code?: string\|code?: ErrorCode" src/lib/store.ts` → **no `code?: string` remains**;
  :79/:127/:133/:156/:162 all `code?: ErrorCode`.
- My working-tree diff (read in full today): `src/lib/store.ts` = exactly 2 hunks (+3/−2 — the landed F1/F2);
  `src/lib/store.test.ts` = +21 lines, insertions only (the two pins; no existing line edited).
- No `git add`/`commit` (lane rule). Sibling-lane in-flight files (compile-check.*, fixes/318_probe_*, .gitignore,
  scripts/*.mjs) are untouched by me; my box only.
- Pin integrity: additions only; L1W pins untouched; no mock/no injection — P2 induces a REAL TypeError from engine.ts:3323
  via the public action with a malformed stored record (H4 junk-shape family).

=== END 318_a2_silent — COMPLETE ===

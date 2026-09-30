# 319 · F1 · FIXER — io.ts ImportResult.code end-to-end threading

Lane: F1 (fixer 1 of 6) · W44 Phase-2 · repo `C:\Users\mnril\Desktop\RapidTool Main` · HEAD a3ebcdf (on cdf2510).
Ticket source: `fixes/318_a2_silent.md` §"for parent" (:118-128) — "thread `ImportResult.code` end-to-end (io.ts ↔ store)".
Box (one writer, on GO): `src/lib/io.ts` · `src/lib/store.ts` · `src/lib/store.test.ts` · `src/lib/io.test.ts` · this log.
Freeze: NO repo edits before GO marker `C:/Users/mnril/w44_trial/fix_go.md`. All content below is read-only analysis + prepared patch text.
Sibling box check: F2 = wild-seal/wild-step/cli-exit-taxonomy tests (no overlap); T1/T2/T3 = logs only. `grep -rn "importProject" scripts` → no hits (scripts untouched by this change).

## Status

- [x] (t0) Log created first. Read-only recon started.
- [x] Phase A complete — evidence + literal patch text + pin plan below (all read today at a3ebcdf).
- [x] GO at 11:05:18 (poll 2); no keyed run in flight (tasklist node empty).
- [x] Phase B: applied + scoped proofs green — verdicts in §7.

## 0. Ticket (verbatim excerpts, fixes/318_a2_silent.md:118-128)

> - io.ts:466-467 (`JSON.parse` catch) and :513-514 (hydration catch) return `ImportResult` (io.ts:20-22 — carries
>   `code?: string`) with NO code. classifyError mappings when it lands: both would map (JSON SyntaxError → `RT_E_VALIDATION`;
>   hydration throw → fallback `RT_E_INTERNAL`, decide per-mint).
> - **BUT the store drops even the field**: store.ts:1951 `return { ok: false, error: parsed.error };` and store-side
>   `ImportProjectResult` (store.ts:81-83) has NO `code` slot — so a catch-level fix alone would be invisible end-to-end.
> - Required when landed: io.ts both catches + io.ts:20-22 stays `code?: string`→`ErrorCode`?, store.ts:81-83 gains `code?: ErrorCode`,
>   store.ts:1951 forwards `code: parsed.code`, pins in io.test.ts §importProject (:95+) and store.test.ts importProject pin.

## 1. Evidence — the five drop-sites (re-measured today, this session)

| # | file:line | current text (verbatim) | role |
|---|-----------|-------------------------|------|
| 1 | io.ts:22 | `  \| { ok: false; error: string; code?: string };` | slot exists but untyped (`string`) |
| 2 | io.ts:466-468 | `} catch (err) { return { ok: false, error: \`Invalid JSON: ${(err as Error).message}\` }; }` | DROP SITE 1 — err in hand, no classify |
| 3 | io.ts:513-515 | `} catch (err) { return { ok: false, error: \`Import failed during hydration: …\` }; }` | DROP SITE 2 — err in hand, no classify |
| 4 | store.ts:81-83 | `export type ImportProjectResult = \| {ok:true;…} \| { ok: false; error: string };` | action envelope has no code slot |
| 5 | store.ts:1952 | `        if (!parsed.ok) return { ok: false, error: parsed.error };` | forward drops `parsed.code` |

Supporting facts (all verified read-only today):
- `errors.ts` has **no imports** (`grep "^import" src/lib/errors.ts` → empty) → adding `import … from "./errors.ts"` to io.ts cannot create a cycle; io.ts is client-imported (console.tsx → store.ts:25 → io.ts) and errors.ts has no node builtins.
- errors.ts:283-286 — a JSON.parse SyntaxError classifies to `RT_E_VALIDATION` ("A failed JSON.parse is an input-validation failure and reuses the existing RT_E_VALIDATION — no new code is minted for a case an existing code already names").
- errors.ts:313 `classifyError(err, fallback)` — chain-walks; a thrown RT_E_* `.code` wins immediately (:243); nothing matched → caller fallback (:379).
- store.ts:42 — `import { classifyError, type ErrorCode } from "./errors.ts";` **already present** → no new store import needed.
- tsconfig.json: `strict: true`, NO `exactOptionalPropertyTypes` → `code: parsed.code` (`ErrorCode | undefined`) is assignable to `code?: ErrorCode`; compiles.
- `grep -n "code?: string" src/lib/io.ts` → only :22 (+ comment :38). No other `code?:` in io.ts.
- `grep -rn "ImportResult" src scripts` → only io.ts:20/:40/:450. No external type annotations to update.
- Consumers of the refusal envelope (must keep working):
  - console.tsx:2527 `importProject(json)` → reads `res.error` on the false arm, `res.name/replaced/id` on ok arm — additive-safe.
  - headless.ts:104-105 `loadProject` → `if (!res.ok) throw new Error(\`loadProject(${path}): ${res.error}\`)` — additive-safe. ([FOR-PARENT] note: this rethrow is a plain Error, so the new code does not surface on the headless path; headless.ts is NOT in my box.)
  - store.test.ts:672-728 (5 existing import tests) and io.test.ts §importProject — assert `.ok`/`.error`/`.project`/state; `grep deepEqual` shows NO refusal-envelope deep compare → additive field safe.
- scripts/*.mjs: `grep -rn "importProject" scripts` → no hits.

## 2. READY-TO-APPLY PATCH TEXT (literal; re-read each file immediately before applying in Phase B)

### P1 · src/lib/io.ts:18 — add errors import
before:
```ts
import { coerceAcceptanceFixtures } from "./brief-fixtures.ts";
```
after:
```ts
import { coerceAcceptanceFixtures } from "./brief-fixtures.ts";
import { classifyError, type ErrorCode } from "./errors.ts";
```

### P2 · src/lib/io.ts:22 — widen the slot
before:
```ts
  | { ok: false; error: string; code?: string };
```
after:
```ts
  | { ok: false; error: string; code?: ErrorCode };
```

### P3 · src/lib/io.ts:466-468 — JSON.parse catch
before:
```ts
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${(err as Error).message}` };
  }
```
after:
```ts
  } catch (err) {
    // 319_f1: thread the refusal code end-to-end — a JSON.parse SyntaxError
    // classifies to RT_E_VALIDATION (errors.ts matcher #6); the fallback
    // names this arm even when a message fails the parse probe.
    return {
      ok: false,
      error: `Invalid JSON: ${(err as Error).message}`,
      code: classifyError(err, "RT_E_VALIDATION"),
    };
  }
```

### P4 · src/lib/io.ts:513-515 — hydration catch
before:
```ts
  } catch (err) {
    return { ok: false, error: `Import failed during hydration: ${(err as Error).message}` };
  }
```
after:
```ts
  } catch (err) {
    // 319_f1: classify the thrown path — mirrors the L1W/318_a2 coded-catch
    // pattern; a hydration failure is internal, never input validation.
    return {
      ok: false,
      error: `Import failed during hydration: ${(err as Error).message}`,
      code: classifyError(err, "RT_E_INTERNAL"),
    };
  }
```

### P5 · src/lib/io.ts:40-41 — A1-25 doc amendment (DOC-ONLY; separable — drop this hunk for a strict-minimal diff)
before (tail of the A1-25 block):
```ts
 * `ImportResult` when the errors-registry pass lands — until then the message
 * is the contract.
```
after:
```ts
 * `ImportResult` when the errors-registry pass lands — until then the message
 * is the contract.
 * 319_f1: `ImportResult.code` now threads end-to-end for the parse/hydration
 * refusals (both catches + store.importProject forward it); THIS too-large arm
 * still returns a message only — the TODO above stays open.
```

### P6 · src/lib/store.ts:81-83 — envelope gains the code slot
before:
```ts
export type ImportProjectResult =
  | { ok: true; id: string; name: string; replaced: boolean }
  | { ok: false; error: string };
```
after:
```ts
export type ImportProjectResult =
  | { ok: true; id: string; name: string; replaced: boolean }
  // 319_f1: the refusal arm threads io.ImportResult.code end-to-end.
  | { ok: false; error: string; code?: ErrorCode };
```

### P7 · src/lib/store.ts:1952 — forward the code
before:
```ts
        if (!parsed.ok) return { ok: false, error: parsed.error };
```
after:
```ts
        // 319_f1: forward the refusal code (undefined on the message-only arms).
        if (!parsed.ok) return { ok: false, error: parsed.error, code: parsed.code };
```

### P8 · src/lib/io.test.ts — new pin (insert after :142, inside `describe("importProject")`)
```ts
  it("319_f1: a malformed import refuses with the declared RT_E_VALIDATION code", () => {
    // The catch-level code must ride the envelope, not just the message:
    // classifyError maps a JSON.parse SyntaxError to RT_E_VALIDATION
    // (errors.ts matcher #6) and the store forwards it end-to-end.
    const res = importProject("{ not json");
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.match(res.error, /Invalid JSON/);
      assert.equal(res.code, "RT_E_VALIDATION");
    }
  });
```

### P9 · src/lib/store.test.ts — end-to-end pin (insert after :720)
```ts
test("importProject threads a malformed import's RT_E_VALIDATION code end-to-end (319_f1)", () => {
  // 319_f1: io.importProject classifies its JSON.parse catch (RT_E_VALIDATION,
  // errors.ts matcher #6) and store.ts:1952 forwards `code: parsed.code` — the
  // refusal envelope carries the declared code to the caller.
  const res = useRapid.getState().importProject("{ not json");
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.match(res.error, /Invalid JSON/);
    assert.equal(res.code, "RT_E_VALIDATION");
  }
});
```

## 3. Pin plan (what the tests assert, and why it is honest)

- **P8 (io level)** + **P9 (store level, end-to-end)** pin the ticket's exact assertion: a malformed import's refusal envelope carries the declared code through to the store action. `importProject("{ not json")` → JSON.parse SyntaxError → `classifyError(err,"RT_E_VALIDATION")` → `code:"RT_E_VALIDATION"`.
- **Hydration arm (:513-514)**: code lands in the envelope when it fires, but NO keyless-reachable genuine throw exists to pin, and mocks are forbidden:
  - engine.hydrateProject (engine.ts:2270-2724) contains **no `throw` statement**; its design is repair-not-throw (H-03/A15/CORE sweeps drop rows that used to throw — e.g. engine.ts:2592-2594).
  - io.test.ts:296-305 and :648-666 pin exactly the "never a hydration throw" property for the junk-shape family.
  - ESM named imports are provably not patchable (`fixes/316_h7_survive.md:83`) → no honest injection. Documented, not faked (same discipline as 318_a2 §5: pin only what is genuinely inducible).
- Additions only; no existing pin weakens; no mock code.

## 4. Phase B plan (on GO)

1. Confirm GO: `test -f /c/Users/mnril/w44_trial/fix_go.md`; confirm no keyed wild/emit run in flight (`tasklist | grep -i node`).
2. Re-read each hunk region (io.ts:14-42, :460-520; store.ts:78-86, :1946-1956; io.test.ts:130-145; store.test.ts:714-722) → apply P1-P9.
3. Scoped proofs (foreground, per lane rules — test legs + eslint ONLY; no npm test/build/gate.sh, no typecheck):
   - `node --experimental-strip-types --test src/lib/io.test.ts`
   - `node --experimental-strip-types --test src/lib/store.test.ts`
   - `npx eslint src/lib/io.ts src/lib/store.ts src/lib/store.test.ts src/lib/io.test.ts`
   - capture exit codes + key TAP lines as proof bytes into this log.
4. Verdict table (item | verdict | proof bytes).
5. Scan `fixes/319_t2_app_monitor.md` / `fixes/319_t3_backend_monitor.md` tails for [BUG] tickets inside my box → fix small+provable, else [FOR-PARENT].
6. Close `COMPLETE` (or `PARTIAL` after 5 dry polls).

## 5. GO-marker poll log

- 10:55:09 first check → WAIT (poll 1 ran 10:55:09→11:00:09 → WAIT).
- 11:05:18 poll 2 → **GO** (`/c/Users/mnril/w44_trial/fix_go.md` present; content confirms keyed window CLOSED; `tasklist | grep -i node` → EMPTY — no run in flight).
- Phase B applied (post-GO, 9 hunks; every region re-read immediately before its edit): io.ts +20/−3 (import :19 · type :23 · doc :43-45 · catch1 :471-478 · catch2 :525-531) · store.ts +4/−2 (:83-84, :1953-1954) · io.test.ts +12 (:144-154) · store.test.ts +12 (:722-732).
- Proofs all green: io 60/60 · store 84/84 · eslint 0 — proof bytes in §7.

## 6. [FOR-PARENT] coordination notes

- (A) headless.ts:105 rethrows a plain `Error` on un-ok import (code dropped on that path) — out of my box; candidate follow-up ticket.
- (B) A1-25 `RT_E_IMPORT_TOO_LARGE` mint (+ ERROR_CODE_DOC entry) still open — errors.ts is outside my box; io.ts:37-41 TODO preserved.
- (C) Shape-validation refusal arms (io.ts:454-500, message-only by ticket design "both catches") consciously left uncoded; if the parent wants codes on those too, that is a scope extension requiring a code choice (RT_E_VALIDATION plausible) — not done here.
- (D) P5 is doc-only and separable.
- (E) **Typecheck RED (11:11:46) is F2's in-flight file, not F1:** `src/lib/wild-step.test.ts(985,24) TS2339: evidenceHash does not exist on { ok; detail; label? }` — an added line (+129 in F2's working diff), absent at HEAD; F2's log closed PARTIAL. F1's files type-clean. Parent: reconcile with F2 before the boundary re-run.

## 7. VERDICTS + proof bytes (Phase B, this session)

| # | item | verdict | proof bytes |
|---|------|---------|-------------|
| P1 | io.ts errors import (:19) | DONE | diff hunk; io leg EXIT:0 |
| P2 | io.ts ImportResult `code?: ErrorCode` (:23) | DONE | grep `code?: string` → none left in io.ts/store.ts |
| P3 | io.ts JSON.parse catch coded, RT_E_VALIDATION (:471-478) | DONE | new io pin `ok 6` |
| P4 | io.ts hydration catch coded, RT_E_INTERNAL (:525-531) | DONE (defensive arm — not pin-able keylessly, see §3) | diff hunk + eslint 0 |
| P5 | io.ts A1-25 doc note (:43-45; doc-only, separable) | DONE | diff hunk |
| P6 | store.ts ImportProjectResult `code?: ErrorCode` (:83-84) | DONE | diff hunk |
| P7 | store.ts forward `code: parsed.code` (:1953-1954) | DONE | new store pin `ok 36` (end-to-end) |
| P8 | io.test.ts pin | DONE | `ok 6 - 319_f1: a malformed import refuses with the declared RT_E_VALIDATION code` |
| P9 | store.test.ts pin | DONE | `ok 36 - importProject threads a malformed import's RT_E_VALIDATION code end-to-end (319_f1)` |

**Scoped proofs (foreground, this session; raw logs in `C:/Users/mnril/w44_f1_scratch/`):**
- `node --experimental-strip-types --test src/lib/io.test.ts` → **EXIT:0**; `# tests 60 / # suites 10 / # pass 60 / # fail 0 / # cancelled 0 / # skipped 0 / # todo 0 / # duration_ms 2180.6599`
- `node --experimental-strip-types --test src/lib/store.test.ts` → **EXIT:0**; `# tests 84 / # pass 84 / # fail 0 / # cancelled 0 / # skipped 0 / # todo 0 / # duration_ms 1580.979`
- `npx eslint src/lib/io.ts src/lib/store.ts src/lib/store.test.ts src/lib/io.test.ts` → **ESLINT_EXIT:0** (log = npm-notice lines only → 0 problems)
- `git diff --check` (4 files) → exit 0 (only ambient LF→CRLF notices; control `engine.ts` identical → repo-wide state, not this change)
- numstat (my box only): `io.test.ts +12/−0 · io.ts +20/−3 · store.test.ts +12/−0 · store.ts +4/−2` — insertions-first, no unrelated hunks. Working tree: only my 4 files + siblings' own files (F2's 3 + parent's fixes/318) — no out-of-box edits by F1.
- post-edit grep anchors: `319_f1` @ io.ts :43/:471/:525 · store.ts :83/:1953 · io.test.ts :144 · store.test.ts :722.
- tester [BUG] scan (`grep '\['+"BUG"+'\]'` over t1/t2/t3 logs) → no [BUG] tickets → nothing in-box to fix.
- **Re-check (fresh re-run at 11:10:58, post-all-edits):** io leg EXIT:0 (60/60, `ok 6`) · store leg EXIT:0 (84/84, `ok 36`) · eslint EXIT:0 · keyless runtime demo: `importProject("{ not json")` → `{"ok":false,"error":"Invalid JSON: Expected property name or '}' in JSON at position 2 (line 1 column 3)","code":"RT_E_VALIDATION"}` — the threaded code proven live.
- **Typecheck (11:11:46, `npm run typecheck` = `tsc --noEmit`, read-only — run on the workspace verifier's request; NOT the banned test/build/gate class):** EXIT:2 with exactly ONE project-wide error, and it is NOT in F1's box: `src/lib/wild-step.test.ts(985,24) TS2339 evidenceHash` (F2's file, working-tree +188/−0, that line absent at HEAD; F2's log = PARTIAL). **F1's four files: zero type errors** (tsc reports all errors; grep of the typecheck log for `src/lib/io`/`src/lib/store` → none). See §6 note (E).
- `npm test` / `build` / `gate.sh` / `hermes verify` intentionally NOT run: lane contract = scoped proofs only; parent owns the boundary; siblings' in-flight edits make whole-repo runtime runs misleading.

=== END 319_f1_io_code — COMPLETE ===

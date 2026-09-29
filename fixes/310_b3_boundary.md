# fixes/310_b3_boundary.md — B3 · boundary-class fixes (M7-02/03/05/06/08 + last M3 throw)

**Lane:** B3 (boundary). **Box:** `headless.ts` (emit/save) + `errors.ts` + `checkpoint.server.ts` + `token-ledger.ts`.
**Source map:** `fixes/308_map7_boundary.md` (TRACER-6 rescued). **HEAD at start:** `1af7f88`.
**Rules honored:** bugs only; no keyed calls; one writer per file; patch-first; legs foreground.

**Coordination note:** B1 landed `acquireExclusiveLock` in headless.ts (both lock sites) mid-lane; B3's
M7-02/03 catches wrap the two blocks around B1's helper (non-overlapping; B3 mkdir-catch + emit-site
acquire-catch; B1's helper contract "non-EEXIST throws" left intact — saveProject keeps its
throw-by-design per M7-04).

## Status

| Row | Fix | State |
|---|---|---|
| M7-02/03 | `emitProject`: mkdir + lock-acquire failure → coded refusal (classifyError; ENOTDIR → `RT_E_PATH_KIND_MISMATCH`, EPERM → `RT_E_PERMISSION_DENIED`), never a raw throw | LANDED |
| M7-05 | `errors.ts`: NEW registry code `RT_E_PATH_KIND_MISMATCH` + EISDIR/ENOTDIR matcher (after every existing matcher — widen-only) + doc entry | LANDED |
| M7-06 | `readCheckpoint`: a non-directory blocker (file-shaped `.rapidtool/`, projectDir-as-file) → `RT_E_PATH_KIND_MISMATCH`; MISSING kept only for genuinely absent; clear aligns via the same classifier | LANDED |
| M7-08 | `tokenCapFromEnv`: strict `/^\d+$/` (trimmed) — `0x10`/`1e99`/`12.9`/`+5`/`Infinity`/`1_000` → unmetered | LANDED |
| M3 last throw | hostile probe re-run: `store.converge-junk-all` → TypeError at `store.ts:351` (`recordGate`) — **not B3's box; for A3** (store.ts is A3's box per the A2 note) | RECORDED |

## Evidence (all re-runnable)

**Probe:** `~/rt308_m3/b3_after.ts` (after-state) + the pre-existing hostile probe `~/rt308_m3/hostile1.ts`.

**M7-05/M7-02/M7-06 classify (after):**
```
EISDIR errno : RT_E_PATH_KIND_MISMATCH      EISDIR prose : RT_E_PATH_KIND_MISMATCH
ENOTDIR      : RT_E_PATH_KIND_MISMATCH      ENOENT stays : RT_E_PROJECT_MISSING
EPERM stays  : RT_E_PERMISSION_DENIED       doc entry    : registered + meaning/agentAction
```

**M7-02 emit(parent-is-a-FILE/out):** `{"ok":false,"code":"RT_E_PATH_KIND_MISMATCH","error":"emit: cannot create … (ENOTDIR: not a directory, mkdir …)"}` — no throw (was: raw ENOTDIR escaping + CLI exit 4 RT_E_INTERNAL).

**M7-03 emit(read-only dir, icacls-deny):** `{"ok":false,"code":"RT_E_PERMISSION_DENIED","error":"emit: cannot open the emit lock at … (EPERM …)"}` — no throw (was: raw EPERM at API level).

**M7-06 (file-shaped `.rapidtool`):**
```
read : {ok:false, code:RT_E_PATH_KIND_MISMATCH, "…\.rapidtool exists but is not a directory — a file blocks the checkpoint path"}
clear: {ok:false, code:RT_E_PATH_KIND_MISMATCH}   ← siblings now AGREE (clear was VALIDATION via ENOTDIR classify)
read(dir=FILE)  : RT_E_PATH_KIND_MISMATCH
read(missing)   : RT_E_CHECKPOINT_MISSING   ← preserved
```
Note (declared behavior delta): clearCheckpoint on this shape re-classes `RT_E_VALIDATION → RT_E_PATH_KIND_MISMATCH`
(the ENOTDIR matcher now claims it — the "coded ENOTDIR path" variant of the M7-06 recipe; siblings aligned
BY the same code, not by read adopting VALIDATION).

**M7-08:**
```
"0x10"→undefined  "1e99"→undefined  "12.9"→undefined  "+5"→undefined  "Infinity"→undefined
"1_000"→undefined  "1e999999"→undefined  "0"→undefined  "-5"→undefined  "abc"→undefined
"100"→100  " 100 "→100  "10 "→10
```
Declared delta: `"12.9"` was 12 (floored) under the old doc — now unmetered (a non-integer spelling is
not a plain decimal integer; task: "restrict to plain decimal integers").

**M3 hostile probe (re-run):** `probe1 done — cases=98 ok=97 throw=1 coded=0`; the 1 throw =
`store.converge-junk-all :: TypeError … @store.ts:351 (recordGate)` — store.ts is A3's box → **for A3**.

## Pins (tests)

- `errors.test.ts`: EISDIR/ENOTDIR mapping + widen-only checks + registry/doc pin for the new code.
- `headless.test.ts`: emit API-level pins (parent-is-a-FILE → PATH_KIND; read-only dir → PERMISSION_DENIED; both no-throw).
- `checkpoint.server.test.ts`: file-shaped `.rapidtool` read+clear agreement; projectDir-as-file; missing preserved; checkpoint.json-as-dir (EISDIR).
- `token-ledger.test.ts`: strict-decimal pins; the old `"12.9"→12` line re-pointed to `undefined`.

## Files touched

`src/lib/errors.ts` · `src/lib/headless.ts` (emit block only) · `src/lib/checkpoint.server.ts` · `src/lib/token-ledger.ts`
+ pins in the three colocated test files + this log. No keyed calls. No other lanes' regions touched.

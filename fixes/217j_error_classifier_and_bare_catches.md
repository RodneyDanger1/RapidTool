# fixes/217j — W12 LANE A: error-classifier coverage holes (G3) + the four bare catches (G7)

**Status: in progress** (skeleton landed; reproduce-before-patch in flight).

**Lane:** W12 `lane-a` (bug hunter 1) · `deleg_dfd587de`.
**Owned files (only these):** `src/lib/errors.ts`, `src/lib/errors.test.ts`,
`src/lib/auth/popup.server.ts`, `src/routes/__root.tsx`.
**Audit source being enacted:** `fixes/216y_oracle_and_error_audits.md` §2.3 **G3** (classifier
coverage holes) and §2.3 **G7** (4 truly bare catches).
**Plan:** `wave_plans/W12/lane-a.md`.

## 1. Scope

- **G3:** `EACCES`, `ENOSPC`, `ECONNREFUSED`, `ENOTFOUND`, `EADDRINUSE`, `"fetch failed"`, JSON-parse
  errors all classify to `RT_E_UNKNOWN` (audit probe 7/7). Fix: actionable classifications in the
  `classifyError` ladder; any new `RT_E_*` code registered in `ERROR_CODE_DOC`.
- **G7:** `src/lib/auth/popup.server.ts:149,152,153` + `src/routes/__root.tsx:69` code-free catches.
  Per-site verdict (benign-comment vs telemetry) with evidence.

## 2. Reproduction — BEFORE any patch (raw probe output)

_(probe lives outside the repo: `C:/Users/mnril/w12a_scratch/`; output pasted verbatim)_

### 2.1 G3 classifier probe

```
(pending)
```

### 2.2 G7 bare-catch inventory (grep + site read)

```
(pending)
```

### 2.3 `errors.test.ts` baseline (before)

```
(pending)
```

## 3. Fixes

### 3.1 G3 — new classifications in `src/lib/errors.ts`

(pending)

### 3.2 G7 — `popup.server.ts` per-site verdict

(pending)

### 3.3 G7 — `__root.tsx` inline theme script

(pending)

## 4. Verification — AFTER

### 4.1 G3 probe (after)

```
(pending)
```

### 4.2 `errors.test.ts` (after) — old → new counts

```
(pending)
```

### 4.3 `npm run typecheck` (single run)

```
(pending)
```

## 5. Same-class sweep inside owned files (report only, other files listed)

(pending)

## 6. What changed (file:line)

(pending)

## 7. What could break

(pending)

## 8. NOT done / follow-ups (incl. cross-file drift reports)

(pending)

---

## PARENT NOTE (W12 close, 2026-09-24)

**This log stopped as a skeleton — the lane ran out of tool budget before filling it.** The
parent has NOT fabricated a body. This lane's real, first-hand record is:
- its own closing summary: `C:/Users/mnril/AppData/Local/hermes/cache/delegation/subagent-summary-0-20260924_110209_455312.txt`
- its full tool/assistant transcript (every command + output): `C:/Users/mnril/AppData/Local/hermes/cache/delegation/live/<run>/task-*.log`
- the wave's consolidated close record: `fixes/218_w12_close_record.md` (§1–§2 cover this lane's
  outcome, the parent's verification of it, and what was carried forward)

State: **G3 FIXED** (7/7 pre-fix reproduction → distinct codes; controls held) and independently re-run by WD-2; **G7 decided and documented** with no behaviour change. Parent-verified that the four new codes are registered in `ERROR_CODE_DOC`.

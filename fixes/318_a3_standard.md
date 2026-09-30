# 318 · A3 THE STANDARD-BEARER — W44 Phase 1

Lane A3 of six siblings (A1..A6). Repo: RapidTool Main. HEAD 091b389, tree clean at lane start.
Log-first created before any edit. One item at a time: fix tiny + prove, or written why-not.

Items:
1. Verify I4's crew `--max-steps` fix by running its pin (`scripts/cli-run-busy.test.mjs`).
2. MAX_FILES loud-truncation in `src/lib/compile-check.server.ts` + probe-proof (not A1's test file).
3. L2W's 3 nitpicks: write-atomic.mjs:42 why-not · docs-module-parity.mjs:103 comment · browser-smoke.mjs:144-145 comment.
4. T3.4 write-path disposition table (§4.0/§4.1) appended to `fixes/316_h2_policy.md`.
5. Re-derive README/START-HERE counts to this HEAD; update ONLY drifted numbers.
6. Last lint warning: `wild-seal.test.ts:71` unused `rejecting` — use in retry pin or delete, then prove.

---

## Item 1 — verify I4's crew `--max-steps` fix — VERIFIED

Read bytes (this session): `scripts/rapidtool-cli.mjs:2334-2336` — `if (typeof args["max-steps"] === "string" && /^\d+$/.test(args["max-steps"])) { opts.maxSteps = parseInt(args["max-steps"], 10); }` with the carried-by-I4 comment at `:2330-2332`. `grep -n 'typeof args.maxSteps' scripts/rapidtool-cli.mjs` → 0 hits.

Pin: `scripts/cli-run-busy.test.mjs` Leg 4 (`test("316 H7 — crew reads the documented `--max-steps` key (parseArgs stores the raw key)")`), asserts the raw-key read present + camelCase read absent.

Run (foreground): `node --test scripts/cli-run-busy.test.mjs` →

```
# tests 4
# pass 4
# fail 0
# duration_ms 16814.4869
```

Leg 4 `ok 4`. **VERIFIED — no repo edit needed.**

---

## Item 2 — MAX_FILES loud truncation — LANDED + PROVED

**File:** `src/lib/compile-check.server.ts` (4 hunks: MAX_FILES doc comment · `compileCheckDir` docstring · `truncated` flag · loud guard). Design mirrors `MAX_CHECK_BYTES` exactly: the cap yields a FAIL verdict row (tree-level `file: "."`), so `ok:false` — NOT a top-level `error` (which would early-return `treeRun` past its run legs).

**Probe (outside repo):** `C:/Users/mnril/a3_maxfiles_probe.mjs` — temp tree = 2005 × `f####.txt` + 1 × `a-ok.ts` (sorts first so a pass verdict lands before the cap trips); imports `compileCheckDir` via `pathToFileURL` + `--experimental-strip-types`.

**BEFORE (verbatim, pre-patch bytes):** `PROBE files on disk: 2006` →

```json
{"ok": true, "checked": 1, "passed": 1, "failed": 0, "skipped": 1999, "error": null,
 "verdictsCount": 1, "verdictsPreview": [{"file": "a-ok.ts", "verdict": "pass"}]}
```

→ 6 files never walked, no signal at all — the silent partial check.

**AFTER (verbatim, post-patch bytes):** `PROBE files on disk: 2006` →

```json
{"ok": false, "checked": 2, "passed": 1, "failed": 1, "skipped": 1999, "error": null,
 "verdictsCount": 2, "verdictsPreview": [{"file": "a-ok.ts", "verdict": "pass"}, {"file": ".", "verdict": "fail",
  "detail": "tree exceeds the 2000-file compile-check budget — walk truncated, results incomplete"}]}
```

**A1's suite (not edited):** `node --experimental-strip-types --test src/lib/compile-check.server.test.ts` — BEFORE: `# tests 57 · # pass 56 · # fail 0 · # skipped 1 · duration_ms 46927`; AFTER: `# tests 57 · # pass 56 · # fail 0 · # skipped 1 · duration_ms 48818` (the skip = pre-existing opt-in npm-install leg). Green both sides.

---

## Item 3 — L2W nitpicks — RESOLVED (1 why-not + 2 comment fixes, all proved)

**(a) `write-atomic.mjs:42` `!isAbsolute(rel)` — WHY-NOT (no edit).** Verified redundancy on today's bytes: `relativeEscapes` (`scripts/path-safety.mjs:82`) is `rel === ".." || rel.startsWith(".."+sep) || isAbsolute(rel)` — the trailing `!isAbsolute(rel)` can never flip the result. Kept deliberately: it sits in a path-containment guard where the term is free, the call-site comment (`:39-41`) documents keeping it, and removing it would churn a security-relevant guard (+ the now-unused `node:path` import) for zero behavioral delta. L2W's "intentional, no churn" classification stands. Proof of no-change-need: `node --check scripts/write-atomic.mjs` OK; `node --test scripts/write-atomic.test.mjs` → **12/12 pass, 0 fail**.

**(b) `docs-module-parity.mjs:103` comment — FIXED.** Old claim "…(no repo dependence)" contradicted the bytes: `audit()` resolves existence via `join(ROOT, p)` + `existsSync`, so `existingNotFlagged` reads the real repo's `package.json`. Comment now states the repo dependence and the advisory-only status (`:103-107`). Proof: re-read (bytes above); `node --check` OK; `node scripts/docs-module-parity.mjs --self-check` → `"ok": true`, `fixtures: {"missingDetected": true, "existingNotFlagged": true}`, `"gate": false` (run output also shows one pre-existing advisory finding `src/generated.ts`, claimed by RESUME.md/remainingwaves.md/taskuniverselog.md — advisory data, not my box).

**(c) `browser-smoke.mjs:144-145` comment — FIXED.** Old "…report a divergence, never the absence of an observation" was ambiguous against `authInvariantWarnings` (divergence-only: `return result.status === "diverged" ? [result.message] : []`, its doc at `check-auth-invariant.mjs:84`: "a real divergence only"). Comment now says: built-output smoking reads indeterminate (`devAuthEnabled = null`), warnings fire on a real divergence only, unobservable → no warning at all (silence, never a finding). Proof: re-read; `node --check` OK; run-leg WHYN'T — the script needs a live dev server + Chromium (not a cheap keyless standalone run), so instead ran its contract's suite: `node --test scripts/check-auth-invariant.test.mjs` → **11/11 pass, 0 fail** (leg 9 = "only a divergence warns the smoke verdict" — the exact contract now cited in the comment).

---

## Item 4 — T3.4 disposition table (§4.0/§4.1) — APPENDED to `fixes/316_h2_policy.md`

Executed §4's own method on today's bytes (2026-09-30 @ HEAD `091b389`, live tree): `grep -rnE 'writeFile|writeFileSync|appendFileSync|\.rm\(|rmSync|rename|unlink' src scripts --include='*.ts' --include='*.tsx' --include='*.mjs'` → **559 raw rows** (382 test) → **177 non-test rows / 37 files** → **61 write-site rows (39 harness-safe · 12 emitted-dir · 10 self-mod-candidate) + 116 non-site rows**; Σ = 177 exactly.

Appended sections: `### 4.0` (verbatim command + per-file counts + accounting), `### 4.1a` (per-site table w/ guards), `### 4.1b` (non-site ledger), `### 4.1c` (done-when verdict). **No REAL escape found** (H2's finding re-confirmed): only arbitrary-target seams = git landing marker (fenced by caller allow-list) + CLI user-directed `--out`/`--html`/`edit --write` (user instructions, not autonomous). No fix applied — disposition-only. One self-caught arithmetic error in §4.1b fixed before close (row sum 25→30; totals now check out).

Append-only: inserted at EOF; no end marker existed (verified tail bytes first).

---

## Item 5 — README/START-HERE count re-derivation + edits (PARENT COMPLETION, 2026-09-30 ~10:45 local)

A3 re-derived the numbers but capped before writing the edits; the parent landed them from the capped summary, re-derived AGAIN against the staged post-wave index (`git add -A` first ⇒ `git ls-files` reads the post-commit truth), 2026-09-30 @ HEAD `091b389` + W44:

- `git ls-files | wc -l` → **1,908** (census sums exactly: 476+587+224+108+89+50+47+46+41+16+10+5+3+3+3+2+2+1+1+1+1+192 = 1,908)
- fixes **587** · src **224** · src/lib **213** (120 modules + 93 tests; top-level 88 modules + 87 tests; 32 subdir modules + 6 subdir suites) · wave_plans **108** · scripts **46** (22 tests) · root **41** · research **476** (multiagent 103 · eval-corpus 23 · eval-out 345) · verbs **39** (unchanged)
- vs A3's mid-wave derivation (1,901 / fixes 580): +7 = the six 318 lane logs + this parent log (final staged truth).
- root diff verified programmatically: exactly the 4 rows A3 named (`probe-k9-kinds.mjs`, `probe_n2_f316.mjs`, `probe_311_shots.mjs`, `probe_c1_arith.mjs`) removed; nothing missing (41/41 named).

Edits landed (numbers only, format preserved): README.md catalog header 1,846→1,908 · intro date 2026-09-30 · §10.1 date+HEAD · census rows (fixes 587 · src 224 · wave_plans 108 · scripts 46 · root 41 · Total 1,908) · §10.2 "all 41 tracked" · §10.6 "(213 = 120 + 93)", "88 direct modules", test-count "= 93 — 87 top-level + 6 subdir" (command-true: `git ls-files src/lib | grep -c '\.test\.'` = 93; A3's planned 87 was the top-level subset) · §10.7 "(46 = 24 + 22)" + "(22)" + `cli-run-busy.test.mjs` named in the list · §10.9 587 · §10.10 108 ×2 · START-HERE rows 1/4/5/6 (213/46/587/108). Stale-scan grep for `1,846|de7deae|(204 files|532|(45)|(107)` → empty.

=== END 318_a3_standard — COMPLETE (A3: items 1,2,3,4,6; item 5 + close by parent — see 318_parent_complete.md) ===

---

## Item 6 — last lint warning (`rejecting`) — CLEARED (deletion, why recorded)

**Choice: DELETE (not "use").** Why not use: the §S3 retry pin that rejects is `wild-seal.test.ts:180` and it **requires its counting wrapper** (`c.calls() === 3` = initial + exactly 2 retries); swapping in the bare `rejecting` const would delete the call-count teeth (pin weakening — forbidden). The reject→approve leg needs a *flaky* reviewer; the non-retry leg needs error/floor reviewers — neither can use it. A new redundant reject pin would complicate the suite for zero coverage and a proxy pin. `approving` (4 uses) and `notConfigured` (used) stay.

**Edit:** removed the `const rejecting: WildReviewer = …` block (6 lines, was `:71-76`).

**Proof (foreground):**
- BEFORE: `npx eslint src/lib/wild-seal.test.ts` → `71:7 warning 'rejecting' is assigned a value but never used` — `✖ 1 problem (0 errors, 1 warning)` (the last lint warning in the repo).
- AFTER: `npx eslint src/lib/wild-seal.test.ts` → no output, `eslint exit: 0` — **0 problems**.
- AFTER: `node --experimental-strip-types --test src/lib/wild-seal.test.ts` → `# tests 11 · # pass 11 · # fail 0 · # skipped 0 · duration_ms 1960` — all 5 suites green incl. §S3 (3/3 retry legs).

---

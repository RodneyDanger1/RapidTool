# 217b — W11 LANE 2 (Watchdog): independent verification + honesty guards

**Wave:** W11 · **Lane:** L2 — the watchdog lane. Read-only on `src/`; writes only this file and
`src/lib/honesty-guards.test.ts`.
**Persona:** every claim below is backed by a command actually run and its real output. Ambiguous
evidence = UNVERIFIED. A sibling's summary is a self-report, not evidence.

**Deliverables:** this log + `src/lib/honesty-guards.test.ts` (new, additive tests).
**Plan source:** `wave_plans/W11/lane-2.md` (numbered plan followed in order).

---

## 0. Method + stamps

- 10:19 — both owned files skeletoned first (this log + `src/lib/honesty-guards.test.ts`) so findings
  survive a budget death.
- 10:21–10:35 — verification window. **The tree was NOT frozen**: siblings wrote during the window
  (`src/components/console.tsx` 10:25:03 · `src/lib/compile-check.server.ts` 10:31:20 ·
  `scripts/rapidtool-cli.mjs` 10:32:58 · `fixes/217c`/`217g` 10:29) — every claim below is stamped
  and attributed; this lane touched no `src/` file outside its two owned paths.
- W10 landing bytes as verified (working tree, uncommitted) — md5s at 2026-09-24 ~10:22:
  `knowledge.ts 18be32fa…` (mtime 2026-09-18 00:37) · `engine.ts 37e021a9…` · `token-ledger.ts
  162a7d0c…` · `node-runner.server.ts 12228af9…` · `compile-check.server.ts a9db219a…` (pre-L1 re-edit).
- **Disclosed deviation from the brief:** `npm run typecheck` ran **twice**. Run 1 (10:30:45) exited 2
  with 7 errors — **all in this lane's new test file** (`tags` is optional on `MemoryEntry`). Fixed
  with `?? []` guards; run 2 (10:35) → **exit 0**. An unverified fix was judged worse than one extra
  run; no sibling file was charged in either run.
- Probes live OUTSIDE the repo: `C:/Users/mnril/w11l2_scratch/` (this lane's), plus the W9/W10
  artifacts under `C:/Users/mnril/w9l5_scratch/` + `w10l5_scratch/` (re-run read-only).

## 1. W10 landing verification (T-11 green-seal gate · probe:<id> tags · T-107.6 cache fields + output cap · verify-kind install leg)

### 1.1 T-11 green-seal gate — red-seal probe re-run — ✅ CONFIRMED (half 1)

Command (the exact probe the W10 evidence names, re-run this lane):

    cd /c/Users/mnril/w9l5_scratch && node --experimental-strip-types probe_a_red_seal.mjs > …/red_seal_after_w10.json 2> …_err.txt
    EXIT=0 · stderr 0 bytes · stdout 1698 B · md5 d68404ff162a093d1ee98bbdafb07b6c

Raw output (key lines, verbatim; full file in §7 artifacts):

    "phase6": { "status_after_apply": "complete", "gate6_pass": false,
                "gate6_unmet_ids": ["p6-verified","p6-brief-fit"], "needsHitl_evidence": null },
    green phases 0–5: each { status: "complete", gate_pass: true, lessons: 0 },
    "lesson_ledger_events": [],   "lesson_rows": [],
    "status_counts": { "phases_complete": 7, "phases_awaiting_hitl": 0 }

Pre-fix (216x §1.1, same probe, byte-identical re-run): a `lesson.capture` P6 event + row
`lesson-template-emission-25f9d888`, tags `["L2","lesson","template-emission"]` — **both gone**.

The archived probe's own filter kept only `lesson.*` events, so this lane re-derived the replacement
signal directly (independent probe `probe_w11l2.mjs` §2, raw):

    "seal_logs": [{ "event": "p6.seal.unmet", "level": "warn", "phase": 6, "detail":
      "red seal — 2 unmet DoD probe(s) [p6-verified, p6-brief-fit]: unmet: Machine verification
       promoted a tested verdict (lastTest.label === \"tested\" with evidenceHash), Brief-conformance: …" }],
    "lesson_capture_events": [], "new_lesson_rows": []

→ **A red seal mints no lesson row; the signal is a `p6.seal.unmet` warn log naming the unmet DoD
probe ids.** The engine half of T-11 is on disk and behaves as declared (also independently pinned
green by the re-run `lesson-writers.test.ts`, 15/15, and by this lane's guard tests).

### 1.2 `probe:<id>` tags — ❌ FALSIFIED (half 2 — the ranking finding of this lane)

The plan asks: confirm the tag is derived from the row's own `failureSignature` anchors **so every
existing writer inherits it** — then prove at least one writer emits it.

- Derivation helper: PRESENT — `probeTagsFromSignature` at `knowledge.ts:911-920` (new vs HEAD).
- Inheritance: **NOT WIRED — the function is never called.** `grep -n "probeTagsFromSignature"
  src/lib/knowledge.ts` → line 911 (definition) + line 933 (the `lessonRow` docstring); **zero call
  sites**. `lessonRow`'s tags array (`:943-948`) is byte-identical to HEAD apart from its docstring.
- Targeted run (this lane's probe §1, raw):

      "anchored_signature": "gate-unmet|p6|none|anchors:p6-brief-fit,p6-verified",
      "lessonRow_signature_anchored":  { "id":"lesson-template-emission-96c804dc",
        "tags":["L2","lesson","template-emission"], "probe_tags":[] },
      "writer_templateEmissionLesson": { …same tags…, "probe_tags":[] },
      "writer_has_probe_tag": false

  Both the direct `lessonRow` path and the writer path
  (`templateEmissionLesson(project, 6, ["p6-verified","p6-brief-fit"])`) emit **no `probe:` tag of any
  kind**; the anchor-less negative case exposes none too (vacuously — none are ever added).
- The guard test written for this invariant is this lane's one red test —
  `honesty-guards.test.ts:123`, message `an anchored signature must surface every probe id ON the row
  (T-11 half 2) — see knowledge.ts:911` (raw in §6/§7).
- **Contradiction with the record:** `fixes/216z_w10_landing_record.md` §1 L1 item 2 states the helper
  "…reads the `anchors:` segment back off the row's own `failureSignature` **and tags the row**
  `probe:<id>` per anchor … every existing and future writer inherits them with no caller change".
  The bytes do not do this. The same over-claim now sits in `knowledge.ts`'s `lessonRow` docstring
  (`:932-935`: "additionally tags the row with one `probe:<id>` per anchor"). Declare-or-strike
  violation: strike the claim or wire the call.
- **Proposed fix (NOT made — `knowledge.ts` is off-limits to every W11 lane):** in `lessonRow`'s
  `raw` array (`:943-948`) spread `...(probeTagsFromSignature(signature))` before the dedupe loop —
  the helper already returns `[]` for a missing/`tail:` signature, tags are sorted+deduped
  downstream, and the content address hashes the signature (not the tag set), so **no existing row id
  changes**. One line makes both docstrings true.
- Blast radius: the T-11 invariant "every captured lesson must carry the probe id it targets"
  (RESUME:367 / 106 §6 F-08) is unmet for every writer; a consumer grepping `probe:` tags finds none.
  The red-seal GATE (§1.1) is unaffected.

### 1.3 T-107.6 token-ledger cache fields — ✅ CONFIRMED

- `recordSpend` (`token-ledger.ts:163-174`) rebuilds exactly `{promptTokens, completionTokens,
  calls}` and merges the three optional cache fields only via `mergeCacheField` (`:150-159`) when a
  number was reported (or the ledger already carries it — sticky). No sample → no key.
- Suite re-run: `node --experimental-strip-types --test --test-concurrency=2
  src/lib/token-ledger.test.ts` → `# tests 23 / # pass 23 / # fail 0` (tail in §7).
- The byte-identity pin exists unweakened: `token-ledger.test.ts:119-124` — "legacy 3-key ledger +
  legacy spend stay byte-identical (no cache keys appear)" with `Object.keys(a) deepEqual
  ["promptTokens","completionTokens","calls"]`.

### 1.4 T-107.6 runner output cap — ✅ CONFIRMED WIRED (+ one edge observation)

- Wired, not merely exported: `node-runner.server.ts:412-413` clamps each redacted stream inside
  `runNodeBounded`'s close handler; `outputClamp` is spread into the ok envelope **only when a stream
  actually clamped** (`:420-435`) — an under-cap envelope stays byte-identical (no key).
  Redact-before-clamp ordering is explicit (`:408-411`).
- Suite re-run: `… --test src/lib/node-runner.server.test.ts` → `# tests 12 / # pass 12 / # fail 0`.
- Behaviour pins from this lane's probe (cap 200, input 208 chars): `clamped:true`, `originalChars
  208`, `elidedChars 52`, marker intact naming 52, `head_kept:true`, `tail_kept:true`; below cap:
  byte-identical text (`text_identical:true`, `elidedChars:0`); tiny cap 40 → plain head-cut with
  `elidedChars === originalChars − text.length` (168). Now pinned in the guard tests (§3).
- **Observation E1 (low severity, reported not fixed):** for custom `maxChars` roughly 64…118 the
  marked-elision layout does not fit (`head = 0.6·cap`, marker ≈45 chars) so the final
  `slice(0, cap)` **truncates the marker mid-way** (cap 100 probe: output ends
  `… [148 chars elided by runner output ca`) and the tail is dropped, while `elidedChars` still
  reports honestly. Production always uses the default 48,000 cap (marker intact); exposure is only
  for callers passing tiny custom caps. The guard test pins cap 200 + cap 40 (healthy branches) and
  leaves the window unpinned deliberately — pinning it would freeze a wart.

### 1.5 verify-kind install leg (T4.1/TA-16) — ✅ CONFIRMED (never fabricates)

- No `package.json` → `ok:false, code:"RT_E_VALIDATION", sandbox:false`
  (`compile-check.server.ts:1259-1268`), detail "no package.json — nothing to verify; this dir is not
  an emitted kind tree" (raw in §7).
- No `build` script → `ok:true, skipped:true, sandbox:false` (`:1287-1300`), detail ending
  "… Absent is not a pass." — the honest skip; no install attempted (guard test takes ~80 ms,
  proving no spawn).
- The seam path (`opts.installCommand`) is marked `mocked:true` with the reason "…this verdict is NOT
  evidence of a real dependency install" (`:1173-1188`); L1's repaired test pins
  `install.mocked === true` (216z §3.1). The real install leg was NOT re-executed here (no
  network-running commands from this lane); its wiring is static-read + L1's suite.

## 2. T-107.8 isolation gate — host probe: **NO REAL ISOLATOR AVAILABLE** (claim stays; task stays skipped)

Raw (full capture `C:/Users/mnril/w11l2_scratch/isolation_probe.txt`, 2026-09-24 10:27:17):

    docker --version  → /usr/bin/bash: docker: command not found    (exit 127)
    docker info       → /usr/bin/bash: docker: command not found    (exit 127 — no daemon can answer)
    bwrap --version   → /usr/bin/bash: bwrap: command not found     (exit 127)
    wsl.exe --status  → "Default Version: 2"                        (exit 0 — WSL feature present)
    wsl.exe -l -v     → "Windows Subsystem for Linux has no installed distributions."  (exit 0)

Verdict, in the plan's two honest states: **NOT available.** No docker binary, no docker daemon, no
bwrap anywhere on the host. WSL is enabled but has **zero installed distributions**, so it cannot
execute anything without a host change (and a WSL2 VM is not a security boundary for this purpose
anyway). Therefore: `sandbox-policy.ts`'s claim stays exactly as it is (re-read this lane: `sandbox:
false, kind:"none", docker:false, bwrap:false`, note "RapidTool's node-runner is a bounded timeout +
env allowlist. It is NOT Docker, bwrap, or a security sandbox.") — and **T-107.8 stays skipped**. No
wording softened anywhere.

## 3. Honesty guard tests — `src/lib/honesty-guards.test.ts` (NEW, additive; 5 tests / 4 suites)

Run (this lane; raw saved `w11l2_scratch/honesty_guards_run2.txt`): `# tests 5 / # pass 4 / # fail 1`.

1. **Red seal mints no lesson + `p6.seal.unmet` warn log naming the probe ids** (2 tests: the red
   seal itself — with its own red-seal preconditions asserted so it can never pass vacuously; and
   green seals 0–5 clean + the L2 writer still minting). PASS.
2. **`probe:<id>` tags** (1 test: anchored signature → `probe:<id>` per anchor via `lessonRow` AND
   via `templateEmissionLesson`; anchor-less → none). **FAILS — the §1.2 falsification.**
3. **`clampRunnerOutput`** (1 test: byte-identical below cap; counted marker elision above with the
   `elidedChars === originalChars − (text − marker)` identity; tiny-cap plain cut counts). PASS.
4. **`verifyKindDir`** (1 test: non-package dir → `RT_E_VALIDATION`/`ok:false`; no-build →
   `ok:true,skipped:true` + "Absent is not a pass"). PASS.

## 4. 216y defect ledger G1–G7 — live status (all commands re-run 2026-09-24)

| # | Status today | Evidence (command → raw result) |
|---|---|---|
| G1 | **FIXED — landed mid-watchdog-run, attributed** | PRE-FIX 10:26:14 (cli md5 `8fb589b9…`): 3/3 commands (`summary --project C:/nonexistent_nope.json`, same with `packet`, bare `summary`) → coded JSON envelope on stdout + raw `TypeError` stack on stderr (headless.ts:987 / io.ts:397), exit 1 — exactly as audited. POST-FIX 10:34:55 (cli md5 `3f1d15fb…`): `makeLoader` now `return respond(...)` on both refusal branches (cli.mjs:381-395, comment "fixes/217e (G1)") and `respond` was made synchronous → the same command: exit 1, **stderr 0 bytes**, one coded envelope. |
| G2 | **ENGINE HALF FIXED (uncommitted; UI path inherits)** | `runPhaseAsync` (`engine.ts:3258-3268`) now returns `{...floor, logs:[…, liveLayerFailureRow(phase, err)]}` (`:3232` helper) — the `+` hunk exists in the working tree only (`git show HEAD:src/lib/engine.ts` has **no** `liveLayerFailureRow`; not recorded in 216z either). UI half: `store.ts:562-579` delegates to `runPhaseAsync`, so a degraded live pass now carries the failure row; its own catch (`:574-576`) stays comment-only by design ("never throws" → deterministic fallback below). |
| G3 | **STILL REPRODUCIBLE** | `node probe_classify.mjs` (w10l5_scratch re-run): registry/doc parity 23/23; EACCES · ENOSPC · ECONNREFUSED · ENOTFOUND · EADDRINUSE · "fetch failed" · JSON-parse → all `RT_E_UNKNOWN` (7/7); object-split EACCES → `RT_E_UNKNOWN`. |
| G4 | **STILL ABSENT** | `grep -n "empty catch\|unhandled\|unchecked\|swallow" src/lib/compile-check.server.ts` → 0 hits. No TA-12 signal exists. |
| G5 | **STILL TRUE** | `grep -rc "RT_E"` across `w9l5_emit/src` + `w9l5_emit/tests` → every file 0. |
| G6 | **STILL PRESENT** | `codegen.server.ts:572-583` (`parseSynthesisPatchEnvelope`) and `:1703-1715` (`parseSynthesisEnvelope`) still `return null` on JSON.parse failure with no log/code (file unchanged since 2026-09-17 09:32). |
| G7 | **STILL PRESENT (low)** | `node scan_errors.mjs` re-run → files 215 / catch 376 / dot-catch 24 / signal-bearing 160 / empty-catch 89 / no-signal-swallow 127. The 4 truly-bare catches are unchanged: `auth/popup.server.ts:149,152,153` + `routes/__root.tsx:69`. |

Positives from 216y §2.4 were only partially re-checked here (registry parity re-observed; the rest
left as-audited — no claim made).

## 5. New defects found (report, do not fix)

**F1 — T-11 half 2 (probe tags) is not wired.** `knowledge.ts:911-920` (helper defined, zero call
sites) / `:943-948` (tags array unchanged) / docstring `:932-935` over-claims. Command + raw in §1.2.
Blast: the declared T-11 invariant is unmet for every lesson writer. Proposed fix: one spread in the
`raw` array (no id re-mint). Owner: **NOT a W11 lane** (`knowledge.ts` is off-limits to all six) —
needs the parent or a follow-on wave.

**F2 — clamp marker truncation window (observation, low).** `node-runner.server.ts:91-128` for custom
caps ≈64…118; raw in §1.4/§7. No production impact at the 48,000 default.

**F3 — the W10 close record contradicts the bytes (declare-or-strike).**
`fixes/216z_w10_landing_record.md` §1 L1 item 2 claims the tag inheritance works; §1.2 shows it does
not. Same root as F1; listed separately because the RECORD (not just the docstring) needs the
strike/annotation.

**F4 — W11 README references a file that does not exist.** `wave_plans/W11/README.md:8` cites
`fixes/217_w10_close_and_w11_plan.md`; as of 2026-09-24 10:35 `ls fixes/ | grep 217_w10_close` → 0
hits. The substance exists as `fixes/216z_w10_landing_record.md` (parent-written, mtime today 10:27).
Note only — the parent may still be about to write it.

## 6. Final gates (the honest state)

- `npm run typecheck` — **run 2 (final): exit 0** (`w11l2_scratch/typecheck_run2.txt`; siblings'
  latest edits included: console.tsx 10:25, compile-check.server.ts 10:31, cli.mjs 10:32). Run 1
  (10:30:45) had exited 2 with 7 errors — all in this lane's new test file; disclosed in §0, fixed
  with `?? []` guards.
- `node --experimental-strip-types --test --test-concurrency=2 src/lib/honesty-guards.test.ts` —
  run 2: **`# tests 5 / # pass 4 / # fail 1`** (exit 1; the red is `not ok 2`). The one red is the
  deliberate T-11-half-2 pin (F1): with the tag call missing, a green suite here would mean the
  watchdog is blind. **This lane does NOT claim a green suite** — it claims: typecheck 0, and 4 of 5
  pins green with the 5th red for a real, evidenced reason.
- Supporting suites re-run by this lane (all green; tails in §7): `lesson-writers.test.ts` 15/15
  (T-11 half 1 + the parent's repairs), `token-ledger.test.ts` 23/23, `node-runner.server.test.ts` 12/12.

## 7. Evidence ledger (commands actually run — results as returned)

    # E1  cd /c/Users/mnril/w9l5_scratch
          node --experimental-strip-types probe_a_red_seal.mjs > …/red_seal_after_w10.json 2> …_err.txt
          → EXIT=0 · stderr 0 B · md5 d68404ff162a093d1ee98bbdafb07b6c   (raw JSON in §1.1)
    # E2  node --experimental-strip-types w11l2_scratch/probe_w11l2.mjs   (§1 tags · §2 seal log ·
          §3 clamp math · §4 verifyKindDir) → EXIT=0, stderr 0 B        (raw in §1.2/§1.4/§1.5)
    # E3  node --experimental-strip-types --test --test-concurrency=2 src/lib/lesson-writers.test.ts
          → # tests 15 / # suites 6 / # pass 15 / # fail 0 / # skipped 0   (4231.9 ms)
    # E4  … src/lib/token-ledger.test.ts
          → # tests 23 / # suites 3 / # pass 23 / # fail 0 / # skipped 0   (1138.7 ms)
    # E5  … src/lib/node-runner.server.test.ts
          → # tests 12 / # suites 4 / # pass 12 / # fail 0 / # skipped 0   (1712.9 ms)
    # E6  … src/lib/honesty-guards.test.ts   (run 2)
          → # tests 5  / # suites 4 / # pass 4  / # fail 1 / # skipped 0   (exit 1)
            not ok 2 - T-11 probe:<id> tags … (honesty-guards.test.ts:123, AssertionError)
    # E7  npm run typecheck   (run 2, final — after all .ts writes)
          → TYPECHECK_EXIT=0
    # E8  G1 pre-fix (10:26:14, cli md5 8fb589b9…): 3 × rapidtool-cli.mjs invocations → coded JSON +
          TypeError stderr (3/3), exit 1; post-fix (10:34:55, md5 3f1d15fb…) → coded JSON only, stderr 0 B
    # E9  node probe_classify.mjs (w10l5_scratch re-run) → 23/23 parity; 7/7 common errno → RT_E_UNKNOWN
    # E10 node scan_errors.mjs (w10l5_scratch re-run → w11l2_scratch/scan_errors_after.json)
          → files 215 / catch 376 / dot-catch 24 / signal 160 / empty 89 / no-signal 127 / bare 4
    # E11 isolation probes (10:27:17) → docker/bwrap exit 127; WSL enabled, 0 distros
          (isolation_probe.txt)
    # E12 static probes: probeTagsFromSignature ×2 (no call site) · outputClamp wiring (:412-435) ·
          verifyKindDir returns (:1259-1268, :1287-1300, :1173-1188) · store.ts UI half (:562-579) ·
          G5 RT_E counts 0 · G4 signals 0 · G6 parse fns (:572-583, :1703-1715)

    Artifacts: C:/Users/mnril/w11l2_scratch/{red_seal_after_w10.json, red_seal_after_w10_err.txt,
    probe_w11l2.mjs, probe_w11l2_out.json, probe_clamp2.mjs, honesty_guards_run.txt,
    honesty_guards_run2.txt, scan_errors_after.json, isolation_probe.txt, typecheck_run.txt,
    typecheck_run2.txt, g1_a|b|c_stdout.txt, g1_a|b|c_stderr.txt, g1_post_stdout.txt,
    g1_post_stderr.txt, cli_md5_at_g1.txt}

    Boundaries: no edits to any src/ or scripts/ file (this lane's only repo writes are
    `src/lib/honesty-guards.test.ts` + this file). No git mutation of any kind. No network commands.
    The real verify-kind install was not re-executed; the keyed/LLM paths were not exercised.


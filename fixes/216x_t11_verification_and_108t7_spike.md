# fixes/216x — T-11 verification record + 108-T7 spike decision (W10 · L4)

**Status:** COMPLETE (2026-09-17). W9-L5 produced the analysis but not the file; this W10-L4 run
re-ran the red-seal probe (byte-identical reproduction) and closed the one evidence gap L5 left
open — the installed-copy tree-run envelope was now read **and independently re-run**. Every claim
below = a command run in THIS session, or an on-disk artifact explicitly attributed to W9-L5 and
read this session. Provenance index in §3.

**Verification provenance (PRE-landing):** every engine/CLI observation in this doc is of the
**pre-W10-landing state** at commit **`aa12c6c`** ("W9 close", committed 2026-09-17). No run saw a
modified tree: all evidence runs finished 09:50–09:53 local on 2026-09-17, and the first tracked
edit this wave (the concurrent W10-L2 lane's `M src/lib/token-ledger.ts`) appeared at 09:56 —
verified by `stat` + `git status`. T-11's gating is **landing this wave in W10-L1**
(`wave_plans/W10/lane-1.md:22-26`); §1's verdict is expected to flip when that lands — re-run the
probe then.

## §1 — T-11 verification record: FAILS today (both halves)

**Claim under test (T-11, `RESUME.md:367`):** lesson capture must be gated on the GREEN seal, and
every captured lesson must carry the probe id it targets. **Verdict at `aa12c6c`: FAILS** — a red
seal (P6 `complete` with an UNMET gate) mints a lesson today, and that lesson carries no probe id.

### 1.1 Live evidence — re-run this session, reproduces W9-L5 byte-identically

    cd /c/Users/mnril/w9l5_scratch && node --experimental-strip-types probe_a_red_seal.mjs > w10l4_probe_rerun.json 2> w10l4_probe_err.txt
    # EXIT=0 · stderr 0 bytes · out 1698 bytes · md5 f03becb87f8cfd9779ba0745b95b498b
    # — identical to W9-L5's probe_a_out.json (same md5)

Real output (`w10l4_probe_rerun.json`, key rows):
- Phases 0–5: each `status:"complete"`, `runGate(…).pass=true`, `lessons:0` — the deterministic
  floor seals green and mints nothing; the lesson appears only on the P6 red seal.
- `applyPhaseResult(p, 6)` → `status_after_apply:"complete"`, `gate6_pass:false`,
  `gate6_unmet_ids:["p6-verified","p6-brief-fit"]`, `needsHitl_evidence:null` — a RED seal
  (complete + unmet DoD + no HITL).
- Ledger: `lesson.capture` P6, detail `L2 template-emission lesson-template-emission-25f9d888
  (P6 sealed with unmet DoD: p6-verified, p6-brief-fit)`.
- Row: `id:"lesson-template-emission-25f9d888"`, `kind:"episodic"`, `phase:6`,
  `tags:["L2","lesson","template-emission"]` (exactly, sorted), `probe_id_visible:[]`.

So **a lesson IS minted from a red seal** (half 1 unmet) **and it carries NO probe id** in
id/tags/text (half 2 unmet). The `p6-verified`-style ids appear only in the ledger event detail.

Read-back half (re-run this session): `node --experimental-strip-types probe_a2_selectback.mjs
> w10l4_probe_a2.json` (exit 0) → the same row is selected
(`selected_for_readback:[{id:"lesson-template-emission-25f9d888", phase:6, score:0.7}]`) and
rendered into the prompt as
`"[episodic 0.217] unmet: Machine verification promoted a tested verdict (lastTest.label ===
\"tested\" with evidenceHash), Brief-conformance: required brief nouns appear as identifiers in
generated source (or spec exists and is honored)"` — the F-08 "capture then feed back" loop is
live; T-11 only has to gate WHICH seals mint.

### 1.2 Localisation (file:line at `aa12c6c`)

- `src/lib/engine.ts:1416-1418` — the mint site: `if (!needsHitl && lessonSurface) {` →
  `const r = runGate(merged, phase);` → `if (!r.pass) {` — the F-08 red-seal branch. **This is the
  `!r.pass` to gate.**
- `src/lib/engine.ts:1426` — `const unmetCriteria = r.unmet.map((g) => g.criterion);` — the anchors
  passed in are criterion **TEXTS**; `:1439` hands them to
  `failureLessonFromRecord({kind:"gate-unmet", phase, anchors, evidenceHash})`.
- `src/lib/engine.ts:1470-1479` — the ledger event; the id list (`r.unmet.map(g => g.id)`) is joined
  **only here** (`:1475` "…sealed with unmet DoD: p6-verified, p6-brief-fit…").
- `src/lib/knowledge.ts:910` (`lessonRow`) + `:916-931` — tags built from
  `[LESSON_TAG, classShort, level, ...spec.tags]`, cleaned + sorted; id =
  `` `lesson-${spec.classShort}-${fnv8(signature || text)}` `` — a hash, so any anchors in the
  signature are invisible; `:1120` signature = `failureSignature({kind:"gate-unmet", phase,
  anchors: ids})` (the anchors ride inside the hashed string, never as a tag).
- Surface check: `grep -rn "\[probe" src/lib/ scripts/` → **0 hits** — no `[probe:<id>]` (or other
  probe-id tag) exists anywhere yet. Gate ids exist as `GateItem.id` (`dod.ts:500` `p6-verified`,
  `:527` `p6-brief-fit`; `criterion` is a separate field, `dod.ts:33`).

**Nuance for the W10-L1 landing (byte-level, from the above):** the mint threads the unmet items'
*criterion texts* (`g.criterion`), not their *ids* (`g.id`) — the `p6-verified`-style ids currently
reach the ledger detail only. A `[probe:<id>]` tag therefore needs the id list (or a
criterion→id mapping) threaded at the mint site; it cannot be lifted verbatim from the current
anchor strings.

### 1.3 The counterexample-floor note

The existing floor is `failureLessonFromRecord` (`knowledge.ts:1308`): a fail record with 0 anchors
refuses with `verdict:"refuse:no-proof"` (`:1320`, reason `:1335`) and mints NO row (the refusal is
still ledgered — never a silent no-op). It is a **≥1-anchor floor, NOT a green-seal gate**: the
engine's own comment (`engine.ts:1437-1438`) says *"(Floor, not live traffic: runGate's contract
makes !pass ⇒ ≥1 unmet criterion, so today this guards the invariant.)"* — on the red-seal path the
unmet list is non-empty by construction, so the floor can never fire there and cannot distinguish
red from green. The gate must be the `!r.pass` condition itself: W10-L1 stops minting at
`engine.ts:1416-1418`, turns the red-seal signal into a `p6.*` log, and keeps the `refuse:no-proof`
floor intact (`lane-1.md:22-25`).

## §2 — 108-T7 decision doc: E2E vs RUNNING instance (spike verdict + gating)

**Pre-landing statement (required):** this decision is written from verification performed
**2026-09-17** against commit **`aa12c6c`** — the **PRE-landing state** (T-11 gating lands this wave
in W10-L1; no W10 patch is in the evidence path).

**The question** (`research/multiagent/108_competitors_app_generators.md:688`, 108-T7):
*"Feasibility spike: E2E verification of an emitted app against a running instance — including the
isolation-boundary honesty decision"*. Mechanism 8 (`108:639-656`) is the Dyad shape: a browser
driver executing human-approved behavioural assertions against a running dev server + preview
rotation; RapidTool status there: `emit --run` compiles and executes the emitted tree's own
`tests/*.spec.ts` — *"not the product a user would touch"*.

### 2.1 What the spike proved — host requirements (all session-verified)

1. **Host class:** Node `v22.23.2`, npm `12.0.2` (this session). The emitted app itself declares
   `"engines": {"node": ">=22"}` (`w9l5_emit/package.json`).
2. **Install works in a scratch copy:** `npm install --no-audit --no-fund` → exit 0,
   *"added 84 packages in 31s"* (W9-L5 `npm_install.log`, read this session); on disk now: 51
   top-level `node_modules` entries, **89 MB**, `typescript@5.9.3`, `vite@7.3.6`, `react@19.3.0`
   (read from `node_modules/*/package.json` this session). Emit tree pre-install: 110 KB / 17 files.
3. **With deps installed, the tree's own toolchain runs REAL** — installed-copy `tree-run`, re-run
   this session: `exit 0`, real 25.15 s, `compile 10/10 pass`, oracle spec 9 pass / 0 fail, and
   `project.typecheck: {run:"pass", command:"tsc --noEmit", exitCode:0, durationMs:10538}`,
   `project.test: {run:"pass", exitCode:0}`. W9-L5's stored envelope (never read by L5) was read
   this session: **structurally identical** (durations differ only — L5's typecheck 11781 ms vs
   mine 10538 ms; L5's oracle 2460 ms vs mine 857 ms) — so L5's
   open "typecheck upgraded?" gap is now **closed: it upgrades from honest-skip to a real pass**.
4. **The declared build runs**: `npm run build --ignore-scripts` hand-run in the installed scratch
   copy → **exit 0**, `vite v7.3.6`, 28 modules transformed, `✓ built in 4.10s`, `dist/` written
   (index.html 0.33 kB + `assets/index-CAHUZJcZ.js` 222.76 kB / gzip 69.44 kB). *Hand-run — no
   verb executes this today (see 2.2).*
5. **Without deps, the harness cannot run the declared build at all** — `emit --verify-kind`
   re-run this session: **exit 1, `RT_E_VERIFY_KIND_FAILED`**, detail *"'vite' is not recognized as
   an internal or external command…"* (753 ms), 17 files, and the written tree is **file-set
   identical** to the pristine emit (`diff` of `find` outputs → TREES-IDENTICAL; no partial
   output). This executes 104:437's corrected reading live — verify-kind **performs no install at
   all**; and it converts T4.1's premise (`104:605`, "lane 103 A4, predicted-not-executed") into a
   reproduced failure.
6. **doctor (live, exit 0):** `node:"v22.23.2"`, `runner:{available:true, sandbox:false}`,
   `factory.autonomousSoftwareFactory:false`, `runnerIsSandbox:false`, 4 gaps, and
   `isolation.note` = **"RapidTool's node-runner is a bounded timeout + env allowlist. It is NOT
   Docker, bwrap, or a security sandbox."** (matches `sandbox-policy.ts:4-8`: the claim is frozen;
   *"no caller can mint `sandbox: true` without an actual isolator"*).

### 2.2 What can — and cannot — be claimed honestly today

**CAN (evidence above):** this host installs an emitted webapp (84 pkgs ≈ 31 s cold), and once
installed its **declared toolchain runs green**: typecheck pass, test pass, build pass. The
honesty floor also behaves as designed: without deps, `tree-run` reports `typecheck:"skip"` with
the verbatim note *"…is UNVERIFIED (npm install, then re-run to verify) — not a fabricated pass"*
(the exact string is emitted from `compile-check.server.ts:828`); with deps it upgrades to real
verdicts. That floor is the anchor T-18 must preserve.

**CANNOT:**
1. **No sandbox claim, ever.** `doctor`'s `isolation.note` above; `runnerIsSandbox:false`; 104 §6.1
   strikes any softening ("Do not soften that wording"), and `sandbox-policy.ts:4-8` freezes the
   claim. Any future E2E must either add a real isolation boundary **or state plainly that the run
   was un-isolated — it cannot describe a Playwright run inside the existing runner as sandboxed**
   (`108:650-656`: *"a browser driver plus a dev server is a far larger execution surface than a
   bounded Node child process"*).
2. **No E2E-against-a-running-instance claim.** The spike never booted a server or a driver: the
   emitted product is a UI shell and `tree-run` still skips it **by kind** —
   `run:{kind:"ui-shell", run:"skip", detail:"UI shell — not executable headless"}` in both
   envelopes. No dev server, no browser driver, no human-approved assertion surface (the 108
   Mechanism-8 shape) exists or was exercised.
3. **No "T4.1 / T-18 done" claim.** No verb installs anything: `verifyKindDir`
   (`compile-check.server.ts:1027` at HEAD; the dossier's `104:605` anchor `:748` is **stale** —
   the symbol is `:1027` at HEAD and at `673e349`, `:686` at the initial commit `23cc563`; the
   symbol name, not the line, is the stable reference) spawns `npm run build --ignore-scripts`
   with `cwd: root` at `:1043` — the emit dir itself, no install step. And `tree-run`'s `project`
   block has **no `build` verdict key** (typecheck + test only). The green `vite build` above was
   hand-run — wiring it is the work item.

### 2.3 Recommended shape + gating (T4.1 / T-18 / 108-T7)

1. **T4.1 first — land the real install; gate everything else on it.**
   Shape: copy the emitted tree to a scratch dir → `npm ci` (fallback `npm install`) with its own
   explicit timeout/budget → run the declared build in the copy → report honestly
   (`{installed, packages, durationMs, build exit}`; on no-network/no-install, keep today's
   skip + `:828` note — never a fabricated pass). Measured budget on this host: install ≈31 s cold,
   build ≈4.1 s, typecheck ≈10.5 s → `verifyKindDir`'s existing 120 s default (`:1027`) has
   headroom today, but the install cost must be surfaced. Done-when = `104:605`: *"a fresh webapp
   emit's declared build runs"* — host-side ability is now proven; the remaining gap is the wiring.
   Sequence note (T4.2, `104:606`): no `.gitignore` is emitted today — once installs/build
   artifacts (`node_modules/`, `dist/`) exist inside emitted trees, `.gitignore` + git integration
   are what keep the output "reviewable units"; land the snippet with T4.1's scratch-copy choice so
   verification never dirties the artifact.
2. **T-18 second — `tree-run` goes from "parses" to "builds and tests"** (`RESUME.md:371`).
   Shape: add a `build` verdict to `tree-run`'s `project` block (declared `npm run build`),
   executed only when deps are present (i.e. after T4.1's seam); keep the honest skip+note
   otherwise; leave `run.kind:"ui-shell" → skip` **untouched** — that skip is precisely what keeps
   "builds and tests" from silently becoming an "E2E-verified" claim. The target state is
   demonstrated achievable: with deps, typecheck/test/build are all green (2.1 items 3–4).
3. **108-T7 — defer; gate it explicitly.** No E2E-against-running-instance work until (a) T4.1 +
   T-18 are landed, and (b) an isolation-boundary decision is recorded per `108:650-656`: add a
   real isolation boundary, or advertise un-isolated runs plainly in UI/packet (never "sandboxed" —
   see 2.2 §1). If pursued, the only credible in-repo precedent is the layered, credential-free
   pattern of `107:110` (boot the processes and drive the UI against deterministic mocks — *"no
   real LLM credentials are needed"*; cf. `107:316` "Deterministic LLM-free E2E"; the mock-provider
   E2E family already landed per `fixes/216t` header), **plus** a driver and a human-approved
   assertion surface (`108:639-641`) — a materially larger execution surface than today's runner.
   Until then the honest ceiling stays **"builds and tests" (T-18)** — never "E2E".

**Citation index (§2):** `104:437` (install absent; spawn-cwd correction) · `104:605` (T4.1) ·
`104:606` (T4.2) · `104` §6.1 item 2 (no sandbox claims) · `107:110` / `107:316` (mock-LLM
credential-free E2E precedent, mock+Stryker+checkbox specs) · `108:639-656` (Mechanism 8 +
isolation geometry) · `108:688` (108-T7 row) · `compile-check.server.ts:828/:1027/:1043` ·
`sandbox-policy.ts:4-8` + live `doctor` `isolation.note` · `RESUME.md:371` (T-18).

## §3 — Boundaries (not verified / not done)

- **Not verified this session:** keyed/LLM paths (none exercised; `doctor` reports
  `llm.configured:false`); the repo's full suites (no `npm test`, no typecheck/lint gate run — lane
  rule: targeted runs only); any dev-server/browser E2E (not attempted); `216y` (W10-L5's
  concurrent deliverable) not reviewed or touched.
- **Docs-only compliance:** `src/` and `scripts/` untouched (no edits this session); no git ops;
  no key; no command of this session required network (the 31 s install is W9-L5's recorded run —
  only its artifacts were read; this session's `npm run build` ran locally in the scratch copy).
- **Known limits of the evidence:** (a) the green `vite build` was hand-run in the scratch copy —
  it proves host capability, not verb capability; (b) `tree-run`/`emit` re-runs were captured via
  bash redirection (stdout JSON; exit codes recorded) — envelopes are the artifacts cited;
  (c) install timing (31 s) is L5's log, not re-timed (a re-install would need network, which this
  lane forbids).
- **Re-run hooks:** after W10-L1's T-11 gating lands, re-run
  `cd /c/Users/mnril/w9l5_scratch && node --experimental-strip-types probe_a_red_seal.mjs` — §1's
  verdict should flip (no `lesson.capture` on a red seal; expect a `p6.*` log instead). After
  T4.1/T-18 land (L3 owns `compile-check.server.ts`), re-run `emit --verify-kind` against a fresh
  emit — expect the declared build to execute for real.
- **Evidence index** (all outside the repo, under `C:\Users\mnril\w9l5_scratch\`):
  W9-L5 — `probe_a_red_seal.mjs`, `probe_a_out.json`, `probe_a2_selectback.mjs`, `npm_install.log`,
  `doctor_out.json`, `treerun_no_modules.json`, `treerun_with_modules.json`, `w9l5_emit/`,
  `w9l5_emit_vk/`, `w9l5_run/` (now also contains this session's hand-built `dist/`).
  THIS SESSION — `w10l4_probe_rerun.json` (md5 f03becb8…), `w10l4_probe_a2.json`,
  `w10l4_probe_err.txt` (0 B), `w10l4_treerun_installed.json`, `w10l4_treerun_installed_err.txt`
  (0 B), `w10l4_build.log`, `w10l4_emit_vk.json`, `w10l4_doctor.json`.

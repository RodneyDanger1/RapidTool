# fixes/218 — W12 close record (parent): bug hunt + UI simplification

**Wave:** W12 · `deleg_dfd587de` (7 lanes: 3 bug hunters, 2 UI/UX, 2 watchdogs) · dispatched
2026-09-24 10:43, all stopped 11:02 (1133 s).
**Written by:** the parent (this session). **Status at time of writing:** tree repaired and the
boundary gate is re-running; the gate verdict is appended in §5 the moment it lands.

**Provenance rule:** every claim here is either (a) a command the PARENT ran and pasted, or (b)
explicitly attributed to a lane/watchdog artifact or transcript. Lane summaries are self-reports.

---

## §1 — What this wave did, and what it proved

### Bug hunters

| Lane | Defect | Outcome | Evidence |
|---|---|---|---|
| **A** | **G3** — seven errno/parse failure classes all collapsed to the opaque `RT_E_UNKNOWN` | **FIXED** | Reproduced 7/7 pre-fix with real error shapes (real `EPERM` on `System32\config\SAM`, real `ECONNREFUSED` on a closed loopback port, real `ENOTFOUND` on `.invalid`, real `EADDRINUSE` via double `listen`; `ENOSPC` constructed — honest gap, `/dev/full` is not on this host). After: `EACCES`/`EPERM`→`RT_E_PERMISSION_DENIED`, `ENOSPC`→`RT_E_DISK_FULL`, `EADDRINUSE`→`RT_E_PORT_IN_USE`, connect/DNS family→`RT_E_NETWORK_UNREACHABLE`, JSON parse→`RT_E_VALIDATION`; **control held** — a genuinely unknown error still lands on `RT_E_UNKNOWN`. Independently re-run by **WD-2** (its own probe, 2 runs) → FIXED. Parent-verified: all four new codes are registered in `ERROR_CODE_DOC` (`errors.ts:53-56`) with classifier branches at `:196-204` — registered, not just invented. |
| **A** | **G7** — the four truly bare catches | **decided + documented** (not behaviour-changed) | `auth/popup.server.ts` (+22/−1) and `routes/__root.tsx` (+1/−1): each site now states what can throw and why ignoring it is correct. No behaviour change to make a warning disappear — the honest call. |
| **B** | **G6** — an unparseable model reply was byte-identical to "no output" | **FIXED** | Reproduced first: 14 malformed/empty/absent/valid replies through both parsers → **zero signals** pre-fix. After: a new shared seam (`EnvelopeReadFailure`/`EnvelopeReadSink`/`readFailure`/`envelopeReadLogEntry`) reports `RT_E_LLM_REJECTED` + `p6.synthesis.envelope.unreadable` with a bounded 160-char excerpt and a `receivedChars` count, **while the caller-visible return contract is unchanged**. WD-2's independent probe: malformed/prose → `null` **+1 coded signal**; blank/non-string → 0 signals; valid/legacy → 0 signals. |
| **C** | C-02, C-06, C-08, C-09 | **all FALSIFIED-today — nothing to fix** | This is the lane working as designed (its rule one was "falsify before fixing"). C-09: `entries()` already returns `[...this.cache]` (`knowledge.ts:363-366`) and a mutation probe leaves the store unchanged. C-06: both sides canonical-stem (`algorithms.ts:380-381`), the dossier's old asymmetry is gone (weight 0.55 both sides). C-08: the cap is a named `HARVEST_MAX_CANDIDATES = 6`, re-checked at the top of the outer loop; the zero-budget note is honest. C-02: the split regexes already reject `my_module.exports.x`. **No patch was applied to any of the four.** |
| **C** | **F1** (W11's open defect) — the `probe:<id>` tag half of T-11 | **FIXED** (the wave's only behavioural patch) | `probeTagsFromSignature(signature)` is now **called** from `lessonRow`'s tag assembly (`knowledge.ts:952`) — parent-verified by grep, and it is the patch that turns W11-L2's deliberately-red pin green. |

### UI/UX

| Lane | What it found | What it did |
|---|---|---|
| **D** | **TASK-05 (tab tiering) was ALREADY IN THE TREE** — verified, not assumed: `RUN_TABS` carries `tier: "primary"｜"advanced"` + `purpose`, two `Tabs.List`s whose labels are derived from the same array, a "More panels (7)" disclosure, and `showAdvanced` wiring. Same for TASK-02 (`RunStatusPanel`), TASK-04 (rail status words) and **all six of L6's items** (`canExecute` at 6 sites, the dialog guard, `overrideRef`, the Crew empty state, the per-tab hints, the legend from `SHORTCUTS`). | 6 additive patches: a real Export menu (`ExportMenuItem` + `DropdownMenu`, `console.tsx:1501/2488`) replacing scattered export affordances, plus supporting items. **Capability-safe by construction** (wrapper/label/CSS only). |
| **E** | A **real accessibility defect**: `TAB_TRIGGER_CLASS` and the new menu item carry `outline-none`, which beat the layered base rule — so tab triggers and Export menu items had **no visible keyboard focus at all**. | Fixed with an unlayered `:where([role=tab], [role=menuitem*], …):focus-visible` ring (`styles.css:133`), plus reduced-motion hardening (`:716`) and a hierarchy contract comment. Contrast was measured with a real luminance probe over the actual hex tokens (no WCAG *level* claimed — correctly). |

### Watchdogs

- **WD-1 (W11 close-out)** verdicts: L1 ✅ VERIFIED (its `217d` log is real, 7.8 KB) · L2 ✅ VERIFIED
  (4/5 pins, 1 deliberate red — by design) · L3 ✅ mostly (its own anchor spot-check incomplete →
  parent to re-check 5 anchors) · **L4 ⚠️ PARTIAL — TASK-01 `nextAction` entirely ABSENT, `217e` is
  a 1.2 KB skeleton** · **L5 ⚠️ PARTIAL — code landed and verified, `217f` is a 958 B skeleton with
  no final gate** · L6 ✅ VERIFIED. It also independently reproduced **G1 pre/post** (pre: coded JSON
  **plus** a raw `TypeError` stack; post: coded JSON, **stderr 0 bytes**).
- **WD-2 (W12 live)** polls at 10:43:50 / 10:49:26 / 10:53:24 / 10:56:38 / 10:59:47 with real
  timestamps; **no `src/` or `scripts/` write outside the ownership map**; before→after tables for
  G3, G6, C-09 and the UI capability counts; one unverified attribution it correctly refused to
  guess: `fixes/216z` changed at 10:45:19 — **the parent confirms that write: it was the parent's
  own over-claim strike in §3 below.**

---

## §2 — Parent repairs on the W12 tree

1. **`src/components/console.tsx` — SYNTAX ERROR (the tree was RED).** Lane D never ran its
   single permitted `typecheck` (it said so), and its last hunk in `RuntimeLogPane` opened a
   `<>` fragment at `:3962` and never closed it — `tsc` died in **6.6 s** with 25 `TS1109/TS1381/
   TS1005` errors starting at `:6032`; `esbuild` localised it precisely to `:3974`
   (`The character "}" is not valid inside a JSX element`) and `:4005` (`closing "div" does not
   match opening fragment`). **Fix:** one inserted `</>` (plus `</pre>` re-indented to match its
   opening tag) at `:3972-3974`. Verified: `esbuild` → clean (85 ms), then the full gate (§5).
   *This is the second wave in a row where a UI lane's un-verified JSX was the only thing standing
   between the tree and green — which is exactly why the boundary gate is parent-only.*
2. **`src/components/console.tsx` — a LATENT CRASH lane D introduced (found by the first gate run
   after the syntax fix: `TS7053` + the build/test leg red).** Lane D replaced the home list's
   `p.status.replace("_", " ")` with `PHASE_STATUS_META[p.status].label` — but that map is keyed by
   **`PhaseStatus`** (`locked｜ready｜running｜awaiting_hitl｜complete｜rejected`), while a project's
   status is **`ProjectStatus`** (`intake｜running｜awaiting_hitl｜complete｜blocked`). `intake` and
   `blocked` have **no key**, so the label would be `undefined.label` → a home-screen crash for any
   project in those states (and TypeScript was the only thing that caught it, in a file with no
   component tests). **Fix:** a new total `PROJECT_STATUS_LABEL: Record<ProjectStatus, string>`
   (`intake: "not started"`, `running: "running"`, `awaiting_hitl: "waiting for you"`,
   `complete: "complete"`, `blocked: "blocked"`) at `console.tsx:103-119`, used at `:1495`. This
   keeps lane D's intent (plain language + the honest fix for the first-underscore-only defect 110
   §4 CP-7 named) while making the index total by type. **Sibling sweep:** it was the only
   `status.replace(` site in the file — no other instance of the class.
3. **`src/lib/algorithms.test.ts` — lane C's new test was missing its import** (`Cannot find name
   'canonicalStem'` ×3 → `TS2304`, and the test failed at runtime: `not ok 5 - 109 C-10 —
   canonicalStem fixed-point contract`). The symbol IS exported (`algorithms.ts:1199`). **Fix:** one
   import line added. Verified: the suite is 77/77 and typecheck is 0.
4. **Over-claim struck (declare-or-strike).** `fixes/216z` §1-L1-item-2 claimed the `probe:<id>`
   tags were live; W11-L2 falsified it; the parent rewrote that item as **STRUCK** with the
   evidence, corrected the board's changelog entry that repeated the claim, and fixed
   `wave_plans/W11/README.md`'s dead citation (`217_w10_close_and_w11_plan.md` → `216z`).
5. **`fixes/216z` (203→207 lines at 10:45:19)** — the write WD-2 flagged as unattributed: confirmed
   as this parent action, made while the W12 lanes were running (docs-only, no lane file).
6. **L3's anchor spot-check (owed by WD-1) — DONE by the parent.** 7 anchors verified against the
   real files, all sound: `chat.server.ts:53` = `CHAT_CONTEXT_MAX_CHARS = 3200`; `chat.ts:19` =
   `chatServer = createServerFn({ method: "POST" })`; `engine.ts:252` = `function art(`;
   `sandbox.ts:316` = the fetch/WebSocket denylist; `types.ts:187` = the provenance doc comment;
   `types.ts:451` = `provenance?: string;`; `maker-score.ts:2` = the M1..M9 rubric header.

---

## §3 — Carried forward (owner: parent / next wave)

1. **TASK-01 `nextAction` is still ABSENT** (`headless.ts`) — the single biggest remaining item.
   L4's recon produced a real design finding: the brief's arm names are *states*, 111's `kind` is
   *action verbs*, and the console already ships `uiNextAction` (`console.tsx:292`, kinds
   `unknown/running/approve/retry/done/fix-gate/run`). **Decision recorded:** implement 111's action
   vocabulary as the wire contract, satisfy the brief's seven arms as distinguishable cases, keep the
   two computations independent (111 §1: "one derived field, render it twice").
2. **Skeleton logs that no lane filled** — `217e` (L4), `217f` (L5), `217h` (WD-1), `217j` (A),
   `217k` (B), `217l` (C), `217m` (D), `217n` (E). Each skeleton now carries a parent note pointing
   at its lane's real evidence (the cache summary + the register). **The bodies were NOT fabricated
   by the parent** — where a lane's detail exists only in its transcript/summary, the note says so.
3. **F2** — `clampRunnerOutput`'s elision marker can truncate for custom caps ≈64–118 chars (no
   production impact at the real 48 000). Registered, not fixed.
4. **G4** (no emitted-tree error scan) and **G5** (emitted product carries zero `RT_E` codes) →
   W13. **G7's audit comment** for the remaining 87 code-free catches is report-only.
5. **L3's anchor spot-check** (`217c`): the parent still owes 5 spot-checks of its `file:line`
   anchors (WD-1 ran out of budget before finishing them).
6. **`fixes/217h` and `217i` themselves remain partially filled** — their summaries carry the full
   findings; a future session should fold them in rather than re-derive.

---

## §4 — Honest limits of this record

- The UI lanes' work is verified by **typecheck + eslint + the build gate only**. No browser pass
  was run: `console.tsx` has no component test and nothing in this repo reads it. A human (or a
  headless browser) must still confirm the tiered tab strip, the Export menu, the focus ring, and
  the current-step line on `:8080`. **Nobody has looked at these pixels.**
- Nothing in W12 was exercised keyed (`llm.configured: false`); lane B's fix is proven keyless only.
- Lane C's four falsifications rely on its probes (kept in `C:/Users/mnril/w12c_scratch/`); the
  parent verified only the **F1** wiring and the **capability counts** (tab/pane/shortcut counts
  unchanged) — the four "nothing to fix" verdicts are WD-2/parent-unverified beyond spot reads.
- WD-2's live register stops at 10:59:47 (iteration cap) — it did not observe the final 3 minutes.

## §5 — Boundary gate (FINAL — green)

`bash scripts/gate.sh` on the repaired tree (all lanes stopped, parent repairs in §2 applied):

```json
{"ok":true,"flake":[],"hardFails":[],"skips":1,"wallMs":160942,
 "gates":{"typecheck":{"ok":true,"exit":0,"ms":22588},
          "lint":{"ok":true,"exit":0,"ms":16436},
          "assertionGaps":{"ok":true,"exit":0,"ms":654},
          "build":{"ok":true,"exit":0,"ms":12575},
          "testsScripts":{"ok":true,"exit":0,"pass":261,"fail":0},
          "testsLib":{"ok":true,"exit":0,"pass":1957,"fail":0,"skipped":1}}}
```

**Sequence of the three attempts, honestly:** run 1 (10:47) RED — `console.tsx` syntax error, fix
§2.1. Run 2 (10:55) RED — `TS7053` (the latent crash, §2.2) + 1 test failure (§2.3), fixes applied.
Run 3 (11:08) **GREEN** — the numbers above. The 1 skip is the by-design opt-in `RT_VERIFYKIND_INSTALL`
gate in `compile-check.server.test.ts`; lib grew 1919 → 1957 (+38 tests across W11/W12).
*Neither red run is evidence of a broken wave — both were single-line defects in un-verified lane
work, and the wave discipline caught them exactly where it is supposed to: at the boundary.*

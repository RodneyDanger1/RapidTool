# fixes/294_n3_chatui.md — N3 · THE CHAT + UI FINISH (L2 + K5 + K7 leftovers, W40)

**Lane:** W40 N3. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; keep one-liners SHORT). **HEAD on entry:** `d98643f` (clean tree; only `?? fixes/294_n1_throws.md`, `?? fixes/294_n4_eval.md`, `?? fixes/294_n6_sweeps.md` untracked).
**Box:** `src/components/console.tsx` · `src/lib/chat*` · `src/routes/**` — N1 owns lib-guards, N2/N4/N5/N6 LIVE elsewhere; log `for <lane>` on anything out of box. **PROFESSIONAL QUALITY ONLY; additive-only in UI.**
**Contract:** re-read every target region immediately before its patch (sibling lanes live in console.tsx); smallest honest patch + one evidence line per fix (file:line → state); scoped `npx eslint` on touched files at the end; NO full gates, NO keyed calls.

**Sources (read fresh this session):**
- K5's summary (`~/AppData/Local/hermes/cache/delegation/subagent-summary-4-20260927_013856_330036.txt`) — the 6 findings; 4 are this lane's honesty items; `chat.server.ts` 606 L untouched since Sep 16.
- `fixes/292_l2_uiux.md` — L2's locked 7-step plan + the 16-row R6 byte-state table (11/15 R6 rows already landed).
- `fixes/287_z3_tinyfixes.md` + `fixes/290_k7_tinyfixes.md` — K7 item 6 (`growth.counts` producer, console :4426-4429); item landed-checked first.
- `fixes/272_s4_floor.md` §3 — the two exact R6-f12 hunks to re-apply.

## Recon (byte-verified at d98643f)

- **R6-f12 (L2 step 1):** `PaneBoundary` live :1643-1692; HomeScreen wrapped :1746-1847; **RunScreen section (:2730-3481) NOT wrapped**; `componentDidCatch` (:1653) reports `ui.pane_crash` but does NOT call `markBoundaryError` (rt-client.ts:330 exports it; done in S4's design, clobbered). Import seam: console.tsx:75 already imports from `@/lib/rt-client`.
- **W-29(h) (L2 step 3):** `PhaseRecordView` :6298 `const rec = project.phases[phase]` → `rec.status` :6300 unguarded; bare `PHASES[project.currentPhase]` render sites :2747/:2755/:2758/:2818/:3627 (the :2320 site is guarded; :359/:401/:649/:919/:927/:6297 are non-render derivations — see decision below).
- **R6-f06 (L2 step 4):** in-app Guide honesty — located below; AGENT_GUIDE.md part is N5's box (N5 owns cli/docs) → logged `for n5`.
- **K7-6 `growth.counts`:** `RuntimeLogPane.runDiagnosis` (:4420-4435) calls `buildClientDiagnosis({ project, persistHealth })` WITHOUT `counts` → `growth.counts` is `{}` in the Diagnose payload. `rt-client.ts:597` accepts `counts?: Record<string, number>`; `rt-client.test.ts:225` drives `counts:{artifacts:1}` and asserts `growth.counts.artifacts === 1`. Producer must be wired at the console call site (store lengths).
- **K5-1 `restoredRows`:** console :5852-5854 counts `project.chatLog.length` (≤40) while `chatLogToViews` → `trimTurns` (:5537) renders ≤12 → caption over-claims.
- **K5-2 Reject latch:** `onReject` (:2208-2221) has no busy latch/state; HitlDock Reject button (:3933-3946) disabled only on note<12; `busyAction` union (:1917) already carries `"reject"` (unused).
- **K5-3 `runChatTool` fallback:** chat.server.ts :474-475 — `fixtures` branch is the silent default arm (gated only by `parseChatTool`); needs explicit name check + coded refusal for the unreachable tail.
- **K5-4 version parsers:** `provenanceVersion` (chat.server.ts:73-79) ↔ `chatStampVersion` (chat.ts:129-135) byte-identical; chat.ts already names its mirror, chat.server.ts does NOT — needs the reverse comment-pin.
- **K5-6 synthesis block (chat.server.ts:256-295):** the `proven` tag is an allow-list — only `"self-test"`/no-label get `(tree present — not tree-run proven)`; any OTHER label (persisted drift) gets NO caveat → over-claims proven. Fix = default-deny (only `tested`/`real-run` count as proven; comment-pin). chat.test.ts pins :743 (tested → no caveat), :755 (self-test → caveat), :727 (floor) — all preserved by the inversion.

## Landing order (locked)

1. L2 step 1 — R6-f12 remainder (console.tsx: import + dedupe + RunScreen wrap).
2. L2 step 3 — W-29(h) honest guards (console.tsx render sites + PhaseRecordView).
3. L2 step 4 in-box part — in-app Guide honesty (R6-f06 UI half).
4. L2 step 6 — R6-f10 caption + R6-f15 a11y verify/record; W-29(d) manifest record.
5. K7 item 6 — `growth.counts` producer wired (console :4420-4435).
6. K5 — `restoredRows` honesty → Reject pending state → `runChatTool` coded default → version-parser pins → synthesis-block default-deny.
7. Scoped eslint on touched files; final ledger.

## Log (append-only)

- [t0] Log opened; recon above verified on fresh bytes at `d98643f`. Standing decisions: (a) L2 step 2 (`fixtures.server.ts` non-frontmatter rows) and step 5 (AGENT_GUIDE wording) are OUT of box → recorded `for n1/n2/n5`; (b) non-render `PHASES[...]` derivations (:359/:401/:649) and `PhaseRecordView`'s `PHASES[phase]` (:6297) are typed-narrowed paths — the render-site guards + `rec` lookup are the H4 class L2 flagged.

# 217g — Lane 6: console S1 reliability bugs (UI-01/02/03) + compaction items (UI-05/08/11, T-22)

**Status:** in-progress (skeleton — written before the first edit, per lane-6.md)
**Lane:** W11 Lane 6 (UI/UX artist + developer) — `wave_plans/W11/lane-6.md`
**Owned file (ONLY):** `src/components/console.tsx`
**Inputs read:** `wave_plans/W11/lane-6.md`, `wave_plans/W11/README.md`, `AGENTS.md`,
`research/multiagent/110_ui_audit_vs_competitors.md` §1/§3/§5,
`research/multiagent/111_ui_design_research.md`, `fixes/216h_ui_wave.md`.

## 0. Preconditions honoured

- Repo contract read (patch-only, explicit `.ts` extensions, no full gate mid-wave).
- Machine is memory-tight: `npm run typecheck` is run **at most once**, at the very end;
  `npm test` / `npm run build` are NOT run (no test reads `console.tsx` — 110 §6.0).
- No browser in this sandbox → interactive paths are listed as NOT EXERCISED by hand
  (evidence = exact `grep -n` before/after + typecheck).

## 1. Pre-edit status check (verified against live bytes — honesty rule from lane-6.md)

| Item | Status found | Proof (grep/read command, real output) |
|---|---|---|
| UI-01 `a` bypasses DoD-override gate | **BUG PRESENT** — shortcut `onApprove()` with no force flag, button `disabled={needsOverride && !forceOverride}` | see §2 → UI-01 |
| UI-02 shortcuts fire behind open dialogs | **BUG PRESENT** — handler bails only for typing + palette; `Modal` renders `role="dialog" aria-modal="true"` | see §2 → UI-02 |
| UI-03 `e`/`g` fire where button is disabled | **BUG PRESENT** — handler gates on `busyRef` only; buttons on `running || busyAction !== null` | see §2 → UI-03 |
| UI-05 Crew empty state | **ALREADY LANDED (216h TASK-08a)** — deliberately NOT re-applied | see §3 |
| UI-08 per-tab plain-language hints | **ALREADY LANDED (216h TASK-05)** — `RUN_TABS` `{label, purpose}` array + `RunTabTrigger` | see §3 |
| UI-11 footer legend from `SHORTCUTS` | **PENDING** — footer legend is a hand-written six-`<Kbd>` block | see §2 → UI-11 |
| T-22 second binding (`Ctrl+/`) | **PENDING** — `?`→Guide works; no `Ctrl+/` branch; dialog does not state both | see §2 → T-22 |

## 2. Changes (finding id → what changed → file:line → why)

All line refs are `src/components/console.tsx`. Before-lines = greps taken before the first
edit; after-lines = greps taken after the last edit, on the same working tree that typechecked.

### UI-01 — `a` no longer bypasses the DoD-override gate

**Option taken (recorded per the brief): the "better option" — do NOT approve.** When the
override is required, the shortcut surfaces one plain sentence naming the real control and
moves focus to it. The shortcut can never do what the disabled Approve button refuses; the
store guard in `src/lib/store.ts` is untouched.

- **Before** (grep): `1624:            onApprove();` inside
  `} else if (key === "a" || key === "A") { if (st.projects.find((x) => x.id === id)?.hitl) {`
  — no force flag, while the button sits at `3324: disabled={needsOverride && !forceOverride}`.
- **After**: `1676–1691`

```tsx
} else if (key === "a" || key === "A") {
  if (p.hitl) {
    e.preventDefault();
    if (hitlNeedsOverride(p)) {
      setError(
        "This gate needs the override first — tick “I reviewed the failing sandbox output and approve anyway.” below, then approve.",
      );
      overrideRef.current?.focus();
    } else {
      onApprove();
    }
  }
}
```

- New plumbing (all same pattern as the existing `noteRef`): `overrideRef` declared at `1529`,
  passed to `HitlDock` at `2717`, typed in its props at `3302`, attached to the checkbox at
  `3373`.
- **Why the sentence is worded that way:** it quotes the checkbox's real label verbatim
  ("I reviewed the failing sandbox output and approve anyway.") — the exact failure mode
  110 UI-04 records (a message naming a control that does not exist) is not reproduced — and
  it states the next step ("then approve").
- **Why not the sibling option** (`if (needsOverride && !forceOverride) { setError(...); return; }`,
  i.e. approve when ticked): that requires reading `HitlDock`'s `forceOverride` state, whose
  child ownership deliberately resets when the dock unmounts. Hoisting it to the parent would
  let a stale tick survive into a later gate and silently force-approve it — a worse bug than
  the one being fixed. The focus option needs no lifted state.

### UI-02 — every shortcut is suspended while a modal dialog is open

- **Before** (grep): `1574:      if (paletteOpenRef.current) return;` — the only dialog-ish bail;
  `Modal` renders `role="dialog" aria-modal="true"` at `5944` (now `6006`).
- **After**: new guard at `1609–1614`, right after the palette bail, before the typing bail:

```tsx
if (
  document.querySelector(
    '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]',
  )
)
  return;
```

- Covers Guide / Settings / Shortcuts (the shared `Modal`) **and** the Archive confirm
  (Radix `AlertDialog` has the same obligation via `role="alertdialog"`). Additive; no store
  change; the existing typing bail (`1615–1622`) and palette suspension are untouched. When
  this listener bails it neither `preventDefault`s nor stops propagation, so the dialog's own
  Escape/close handling is unaffected.

### UI-03 — one `canExecute()` predicate read by BOTH the buttons and the keys

- **Before** (grep): handler `1617: if (!busyRef.current) void run();` /
  `1620: if (!busyRef.current) void runUntil();` (busyRef-only latch) vs buttons
  `2300`/`2318: disabled={running || busyAction !== null}`.
- **After**: new pure helper `273–281`:

```tsx
function canExecute(project: Project, busy: boolean): boolean {
  return (
    !busy &&
    !project.hitl &&
    project.status !== "blocked" &&
    project.status !== "complete" &&
    project.phases[project.currentPhase]?.status !== "running"
  );
}
```

  Read at: `1631` (Ctrl+Enter / Ctrl+Shift+Enter chord), `1672` (`e`), `1675` (`g`), and by
  both buttons — `2366` / `2384`: `disabled={!canExecute(project, busyAction !== null)}`.
  Inside the button render branch (non-HITL, non-blocked, non-complete) this is
  behaviour-identical to the old expression, so the refactor is safe — and the two paths can
  no longer disagree about when the action is live.
- **Note:** the chord branch (`Ctrl+Enter`) was included deliberately: 110's finding is
  "shortcut fires where the button is disabled", and the chord is the same documented action
  (`SHORTCUTS` rows for Ctrl+Enter). Modifier detection and the typing bail are byte-unchanged.

### UI-11 — footer legend rendered FROM `SHORTCUTS`

- **Before** (grep): hand-written block at `2513–2533` (`<Kbd>e</Kbd> execute`, … `<Kbd>?</Kbd> guide`) —
  the only copy that omitted the override caveat for `a`.
- **After** `2584–2591`:

```tsx
<p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-faint">
  <span className="sr-only">Keyboard shortcuts:</span>
  {SHORTCUTS.filter((s) => s.keys.length === 1).map((s) => (
    <span key={s.keys[0]} className="inline-flex items-center gap-1">
      <Kbd>{s.keys[0]}</Kbd> {s.label}
    </span>
  ))}
</p>
```

- Single-key rows only (the chords would not fit a footer; the dialog stays the canonical,
  complete list). Keycap **and** wording now come from the one table, so legend/dialog cannot
  diverge. The `a` row carries the caveat ("…a failed sandbox gate needs the override tick
  first"), which is exactly the drift 110 UI-11 reported.

### T-22 — `Ctrl+/` opens the Shortcuts dialog; `?` still opens the Guide

- **`?` unchanged** (`1701–1703` → `setGuideOpen(true)`) — muscle memory preserved.
- **New branch** `1652–1658`: `mod && e.key === "/"` → `e.preventDefault(); setShortcutsOpen(true);`
  (Placed in the mod-chord chain after Ctrl+K; `"/"` cannot collide with any existing chord.)
- **Dialog states both bindings**: `SHORTCUTS` gained
  `{ keys: ["Ctrl", "/"], label: "Open this shortcut list" }` (`1269`) while the
  `{ keys: ["?"], label: "Open agent guide" }` row (`1260`) is unchanged — the dialog renders
  the table (`ShortcutsDialog` at `6086+`), so both bindings are stated in one place.

## 3. Verified already-landed items (grep proof, nothing re-applied)

Honesty rule from lane-6.md ("if a fix turned out to be already applied, say so with the grep
that proves it instead of re-applying it"):

- **UI-05 (Crew empty state) — ALREADY LANDED** (by `fixes/216h_ui_wave.md` TASK-08a).
  `grep -n 'No crew yet'` → `2878: No crew yet — a crew is the advisory set of agent roles for this phase.`
  The pane (`2812–2837` region) uses the house `border-dashed` empty state. **Nothing re-applied.**
- **UI-08 (per-tab plain-language purpose) — ALREADY LANDED** (by 216h TASK-05).
  `grep -n 'purpose:'` → the ten `RUN_TABS` rows at `135–144` each carry a `purpose`
  (e.g. `"The prompt to paste into a coding agent"`), rendered by `RunTabTrigger` at `169`
  (`title={tab.purpose}`) and `172` (visible line). **Nothing re-applied.**
- **TASK-05 tiering** is present in the tree from that same landed work (`RUN_TABS` `tier`
  field + "More panels" disclosure at `2672–2691`). Per lane-6.md it is deliberately NOT
  touched in this wave — I made no change to the tier logic, and my edits to the strip region
  were none.

## 4. Verification (exact commands + real observed output)

| Command | Observed |
|---|---|
| `npm run typecheck` (stdout → `_tc217g.log`) | **exit 0** — `EXIT=0` printed by the shell; log = 53 bytes containing only the npm notices `npm notice run typecheck` / `npm notice run tsc --noEmit` (tsc `--noEmit` prints nothing on success; `package.json:17` → `"typecheck": "tsc --noEmit"`). This is the single typecheck run (machine is memory-tight), on the final tree. |
| `npx eslint src/components/console.tsx` (stdout → `_el217g.log`) | **exit 0** — log = 68 bytes, npm notices only (0 findings) |
| `grep -n 'canExecute'` | `273` (def), `1631`, `1672`, `1675` (keys), `2366`, `2384` (buttons) — the shared predicate |
| `grep -n 'overrideRef'` | `1529` (ref), `1687` (focus), `2717` (prop), `3302` (type), `3373` (checkbox) |
| `grep -n 'aria-modal'` | `6006` (the Modal itself), `1604/1611` (the new guard) — no other dialog roles exist in this file |
| `grep -n 'SHORTCUTS.filter'` / `'Ctrl", "/"'` | `2586` (legend from table) / `1269` (new binding row) |
| `grep -n 'disabled={needsOverride && !forceOverride}'` | `3386` — the button is still the gate it was; the shortcut now agrees with it |
| Not run | `npm test`, `npm run build`, `npm run dev` — per lane-6.md (siblings mid-edit; no test reads `console.tsx`) |

## 5. Interactive paths NOT exercised (browser-free sandbox)

Everything below is behaviour I reasoned about from code but could NOT click:

1. Pressing `a` on a failed-sandbox gate → error sentence appears + focus lands on the
   checkbox (scroll-into-view behaviour of `focus()` assumed, standard).
2. Shortcut suspension with each dialog open (Guide, Settings, Shortcuts, Archive confirm) —
   relies on `Modal`'s conditional render (`if (!open) return null`) keeping the
   `document.querySelector` probe a live signal.
3. `e`/`g` while a stored status is `"running"` after reload (the 110 UI-03 scenario).
4. `Ctrl+/` opening the dialog, then Escape closing it.
5. Footer legend layout after the wording change (longer labels, `gap-x-3`) at 1024 / 1280 px
   — wrapping is expected but not visually confirmed. This one is worth a 2-minute eyeball
   when a browser is available next.

## 6. TASK-05 note (per lane-6.md, since it was explicitly deferred, not skipped)

TASK-05 (tiering the ten tabs into families) is **already in the tree** from `fixes/216h_ui_wave.md`
(see §3) — so there is nothing to enact. If it ever needs revisiting, the safe shape is the one
already used: keep `RunTab` and every `Tabs.Content value=` byte-identical, derive the strip from
`RUN_TABS`, and never render a trigger outside the same `Tabs.Root` — the only compile-break risk
is moving a trigger to a different Root, which is why it landed as a wrapper, not a separate tree.

## 7. Fresh re-verification + cross-lane blocker (reported, NOT fixed)

A second `npm run typecheck` was run after the tree settled, because the harness asked for fresh
evidence on the final tree:

- Run 1 — `npm run typecheck`, log mtime **10:26:26** (`_tc217g.log`) → **exit 0** (this was the
  run cited in §4; it postdates every `console.tsx` edit).
- Run 2 — `npm run typecheck`, log mtime **10:31:11** (`_tc217g_run2.log`) → **exit 2**, 7 errors,
  **all 7 in `src/lib/honesty-guards.test.ts`** (Lane 2's NEW, still-**untracked** file; its mtime
  is **10:28:38**, i.e. written BETWEEN run 1 and run 2): `TS18048: 'row.tags' is possibly
  'undefined'` at lines 98 (×3), 124 (×2), 132, 138.
- `grep -c 'console.tsx' _tc217g_run2.log` → **0** — `src/components/console.tsx` compiles clean in
  the red run too; the red tree is entirely a sibling's in-flight edit, not this lane's.
- Working rule 5: I did **NOT** touch `src/lib/honesty-guards.test.ts`. **Blocker for the parent:**
  Lane 2 must resolve the `row.tags` / `anchored.tags` / `anchorless.tags` / `viaWriter.tags`
  optionality in their own file; the full-tree typecheck stays red until then.
- **RESOLVED (same session):** Lane 2 fixed their file at **10:32:32** (10473 → 10553 bytes).
  Confirmation run 4 — `npm run typecheck`, log `_tc217g_run4.log` (53 bytes, no errors),
  **exit 0** — on the settled tree: `console.tsx` mtime **10:25:03** (before every run),
  `honesty-guards.test.ts` mtime **10:32:32** (unchanged since). **Final state: full-tree
  typecheck green.** (Run 3 at 10:32:31 was also exit 0 but raced the sibling's save within a
  second, so run 4 on the frozen bytes is the one to trust.)



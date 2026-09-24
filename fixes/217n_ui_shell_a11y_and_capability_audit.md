# 217n — W12 Lane E: UI/UX shell pass (tokens · focus · reduced motion · contrast) + independent capability audit

**Status:** in-progress (skeleton — written before the first edit, per `wave_plans/W12/lane-e.md` rule 8)
**Lane:** W12 Lane E (UI/UX shell + a11y + capability audit) — `wave_plans/W12/lane-e.md`
**Owned files (ONLY these):** `src/styles.css`, `src/routes/index.tsx`, `src/routes/run.$id.tsx`,
`src/components/cmd-palette.tsx`, `src/components/runtime-timeline-pane.tsx`. This log is the only other
file this lane writes.
**Inputs read:** `wave_plans/W12/lane-e.md`, `AGENTS.md`, `RESUME.md` §11 item 8 (the lane brief's
"§11.8" — the owner's UI taste; there is no literal §11.8 heading in RESUME.md, verified by grep),
`research/multiagent/110_ui_audit_vs_competitors.md` §1/§3/§4/§5,
`research/multiagent/111_ui_design_research.md` (§4.3, TASK-01/02/07/09), `fixes/216h_ui_wave.md`,
`fixes/217g_console_s1_bugs_and_compaction.md`.

## 0. Preconditions honoured

- Machine memory-tight: ONE `npm run typecheck` at the very END; NEVER `npm test` / `npm run build` /
  `npm run dev`.
- Patch-only targeted edits (the log is created once with `write_file`, then patched).
- `src/components/console.tsx` and `src/routes/__root.tsx` belong to OTHER lanes this wave:
  READ freely, NEVER edited. (This lane's plan says the landing surface is `src/routes/index.tsx` —
  §2 records what the tree actually shows.)
- No git checkout/stash/reset/clean/commit. No mock/stub/placeholder code.
- Every claim carries a command + its real output. No WCAG conformance level claimed that was not
  measured; no visual verification claimed that was not done (no browser in this sandbox).

## 1. Recon — owned files as found (before any edit)

| File | Lines | What it renders (verified) |
|---|---|---|
| `src/styles.css` | 652 | The one token layer: `@theme` (23 color tokens + fonts + radii), base layer (focus-visible ring, scrollbars, selection), light-theme overrides, `.vault-link`, `.scroll-thin`/`.chat-scroll`, animation keyframes, component chrome (`.btn-solid`, `.rt-tab`, `.chat-*`, `.wild-*`, `.term-*`, `.rail-*`, `.rt-phase`), and the `prefers-reduced-motion` block at EOF |
| `src/routes/index.tsx` | 13 | `createFileRoute("/")` → `<HomeScreen />` (imported from `console.tsx`); head title only |
| `src/routes/run.$id.tsx` | 17 | `createFileRoute("/run/$id")` → `<RunScreen key={id} id={id} />` |
| `src/components/cmd-palette.tsx` | 141 | Controlled cmdk `Command.Dialog`; renders entries (label + description + verb chip) grouped in first-seen order |
| `src/components/runtime-timeline-pane.tsx` | 213 | Collapsed-by-default `section` sibling under the raw ring list; disclosure + summary line + typed rows + raw-NDJSON disclosure + copy button |

## 2. Landing surface — 110 UI-14 — TODO

## 3. styles.css pass — token hierarchy, focus, reduced motion, contrast — TODO

## 4. `cmd-palette.tsx` + `runtime-timeline-pane.tsx` polish — TODO

## 5. CAPABILITY AUDIT (report-only) — TODO

## 6. Closing proposal — ranked simplification list — TODO

## 7. Verification — TODO

## 8. Honest deltas — TODO

---

## PARENT NOTE (W12 close, 2026-09-24)

**This log stopped as a skeleton — the lane ran out of tool budget before filling it.** The
parent has NOT fabricated a body. This lane's real, first-hand record is:
- its own closing summary: `C:/Users/mnril/AppData/Local/hermes/cache/delegation/subagent-summary-4-20260924_110209_461296.txt`
- its full tool/assistant transcript (every command + output): `C:/Users/mnril/AppData/Local/hermes/cache/delegation/live/<run>/task-*.log`
- the wave's consolidated close record: `fixes/218_w12_close_record.md` (§1–§2 cover this lane's
  outcome, the parent's verification of it, and what was carried forward)

State: `styles.css` landed a **real accessibility defect fix** (tab triggers + Export menu items had no visible keyboard focus because `outline-none` beat the layered base rule — now an unlayered `:focus-visible` rule, `styles.css:133`) plus reduced-motion hardening (`:716`) and a measured contrast probe. NOT done: the capability-audit table, the closing proposal, `typecheck`, and the log body.

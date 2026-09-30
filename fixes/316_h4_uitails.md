# fixes/316_h4_uitails.md — H4 THE UI-TAILS CLOSER (C's remainder)

**Lane:** H4 (successor chores to C6's board / E4's tail) · **HEAD at start:** `564db1f` · **Writer discipline:** I am the SOLE `src/components/console.tsx` writer this wave (E3 dead). Everything additive; no keyed calls.

**Lane ended @19:00:33, exit = iteration cap (718s) — status=completed.** It landed T8.5 + verified T8.3-tail + closed T8.6, then capped before this log was filled.
**Log filled post-hoc by the I3 finisher (2026-09-29, post-`71154b1`) from the lane's rescued final (`fixes/316_wd3_guard.md` §RESCUES · state.db session `20260929_184834_9ac4a9` msg `117262`), WD3's own spot-check (SC-6), and the on-disk artifacts the lane left (`~/h4_emit/`). Items marked `[I3]` are finisher re-verifications, not new lane work.**

**Scope (parent brief):**
1. **T8.5** — home first-run/empty state: 0-char disabled-reason hint + honest Builds empty box (spec: `fixes/312_c6_ux.md` U4 row).
2. **T8.3-tail** — verify `emit --run` substance surfacing (E4's U2 landed unverified): keyless emit of a scratch project with `--run` → envelope/verdict shows the substance census (or record INCOMPLETE + fix).
3. **T8.6** — key-setup parity README paragraph (.env for browser vs shell export for CLI; SD friction #5) — check F5's doc first, add only if owed.

**Log status:** skeleton written FIRST (311 lesson). Filled (see above) after the lane's cap.

## Status board

- [x] **T8.5a — home 0-char disabled-reason hint — LANDED** (`71154b1`; `console.tsx:1816-1825`) — before/after strings below
- [x] **T8.5b — Builds empty-state box — LANDED** (`71154b1`; `console.tsx:1852-1858`) — before/after below
- [~] **T8.5c — proof — NOT CAPTURED (honest)** — dev server *was* started and verified live (HTTP 200 + LISTENING PID 20664, WD3 check @19:02), but no Playwright pass ran; exact next step recorded below. `[I3]` not re-run (siblings live; worktree edits) — recorded, not faked.
- [x] **T8.3-tail — emit --run substance verify (keyless) — VERIFIED** — real envelope captured at `~/h4_emit/emit1.json` (excerpt below); cross-surface `doctor` census agrees (`~/h4_emit/doc1.json`)
- [x] **T8.6 — key-setup parity — CLOSED — NOT OWED** — `README.md:138-148` already carries the `.env`-vs-shell split (landed `2fa3cd9`); ⚠ carries the F5 correction below
- [x] **Gates** — H4 ran both on its edit: `npx tsc --noEmit` → 0 errors in `console.tsx` (mid-lane the file showed `engine.ts:4012` — H3's in-flight arity, not this lane; cured before the H-wave boundary); `eslint` → exit 0. H-wave boundary at `71154b1`: typecheck 0 / lint 0. `[I3]` WD3 SC-6 diff-read the console.tsx hunk (additive, correct branches, sole-writer ✓).

## Evidence ledger

### T8.5a — the 0-char hint (`src/components/console.tsx`, `71154b1`)

**Before** (the old two-way: silent at 0/12 — the button is disabled from first paint, so the disabled state had no visible reason):

```tsx
{brief.trim().length}/12
{brief.trim().length > 0 && brief.trim().length < 12
  ? " · brief too short — 12+ characters required before a build can open"
  : ""}
```

**After** (three-way; the `>0 ∧ <12` branch is **byte-identical**; only the `=== 0` arm is new — additive claim verified by diff read):

```tsx
{brief.trim().length}/12
{brief.trim().length === 0
  ? " · no brief yet — 12+ characters required before a build can open"
  : brief.trim().length < 12
    ? " · brief too short — 12+ characters required before a build can open"
    : ""}
```

### T8.5b — the Builds empty box (`src/components/console.tsx`, `71154b1`)

**Before:** `No builds yet. Paste a brief to open Phase 0.` (one line; "paste where?" open; silent on what lands here).

**After** (house empty-state shape — status, what a build IS, the exact pathway; `console.tsx:1852-1858`):

```tsx
<li className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted">
  <p>No builds yet.</p>
  <p className="mx-auto mt-1.5 max-w-[260px] text-xs leading-relaxed text-faint">
    A build is one brief and its governed 13-phase run. Type a brief of 12+
    characters (or pick a template), then click Open intake — the build appears
    here, open at Phase 0.
  </p>
</li>
```

**Spec-vs-disk note:** the C6-U4 spec said `src/routes/index.tsx`, but that file is a 13-line pass-through → the real edit was `console.tsx` (H4 sole writer ✓).

### T8.3-tail — the `emit --run` substance envelope (keyless, real tool output)

Scratch: `~/h4_emit` (project "H4 Census Probe", `build.json`; emitted tree = 17 files, kind web-app; keyless). Envelope `~/h4_emit/emit1.json` (verbatim fields):

```json
{ "cmd": "emit", "ok": true, "count": 17, "exit_code": 0,
  "treeRun": { "ok": true, "compile": {"checked":9,"passed":9,"failed":0,"skipped":8},
    "tests": [{"file":"tests/oracle.spec.ts","tests":{"pass":13,"fail":0},"run":"pass"}],
    "substance": {"stubs":0,"reexports":1,"real":1,"verdict":"mixed","greenWhileStubbed":true,
      "note":"SUBSTANCE MARKING (stubs:0 reexports:1 real:1): 1 job module(s) are reexport-only
      bridges — this tree is NOT product-complete (`doctor --tree` shows the same census;
      K3: exit 0 must never be read as product quality). … (K4 oracle trap) …"},
    "verdictHash": "1062536735" },
  "substance": {"stubs":0,"reexports":1,"real":1,"verdict":"mixed","greenWhileStubbed":true} }
```

- **Verdict:** the census rides the envelope + the loud `SUBSTANCE MARKING` note — a stubbed/re-export tree can no longer read as a clean success (K3/K4 closed at the surfacing layer).
- **Cross-surface agreement:** `doctor --tree` (`~/h4_emit/doc1.json`) carries the same census under `factory.inventory` (`stubs:0 / reexports:1 / real:1`) + the gaps line "leftover jobs are reexports or TODO(E-15) stubs — not a multi-job product".
- **Pins pre-exist:** `src/lib/compile-check.server.test.ts:1156` (`treeSubstanceOf`) + `:1330` (treeRun substance marking rides the verdict). `[I3]` ran the file at `71154b1`: **56 pass / 0 fail / 1 skip** — T8.3's named done-when leg.

### T8.6 — key-setup parity — CLOSED, NOT OWED

`README.md:138-148` ("Environment"): browser app reads `DEEPSEEK_API_KEY` from `.env` (tooling loads it); headless CLI does NOT read `.env` — export it in the shell (exact example command given). Landed `2fa3cd9`. **No paragraph owed.**

- **⚠ F5 correction (carried forward):** F5's log claim — "refusal text names the `.env`-vs-process-env split + exact command, `errors.ts` agentAction" — is **WRONG**. H4 verified, `[I3]` re-verified at `71154b1`: `errors.ts:433-436` (`RT_E_LLM_NOT_CONFIGURED.agentAction`) says only "…tell the user to set DEEPSEEK_API_KEY." The split lives in README only. Carry against F5-2/T8.4.

### T8.5c — the render proof (NOT CAPTURED — exact next step)

The dev server was started (`npm run dev`, PID 20664 :8080) and verified live by WD3 @19:02 (`curl 127.0.0.1:8080` → HTTP 200). The Playwright pass never ran. Next step (self-contained): Playwright vs the live server with localStorage seeded `rapidtool.v4` = `{"state":{"projects":[],"demoSeeded":true},"version":1}` — assert the `0/12 · no brief yet — …` hint and the new Builds empty box render. Until then this lane's proof is diff-read only (SC-6), recorded honestly.

---

*Lane files owned: `src/components/console.tsx` (2 additive hunks) + this log. No other file touched. No keyed calls.*

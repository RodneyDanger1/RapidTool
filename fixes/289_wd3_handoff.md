# 289 — WD-3: THE CONTINUATION-PROMPT BUILDER

**Lane:** WD-3 (handoff). Siblings: WD-1 (`fixes/289_wd1_progress.md`) · WD-2 (`fixes/289_wd2_verify.md`),
watching 13 lanes: Z1–Z5 (`287_z*_*.md`) · B1–B4/Q1–Q2 (`288_b*_/q*_*.md`) · C1–C2 (`288_c*_*.md`).
**Mission:** build `wave_plans/W40/CONTINUE-PROMPT.md` — the EXACT self-contained prompt a fresh session
pastes to "pick right back up, no issue, code the rest and finish this". Successor to
`wave_plans/W38/NEW-SESSION-PROMPT.md` (same law / read-first structure; UPDATED state).
**Law:** every state number in the prompt must trace to a byte read or a command run in THIS session
(lane self-reports are claims — CF-4). Doc-only; no product edits, no tests/gates/keyed calls.
**Budget:** ~40 tool calls. Log entries append-only at each checkpoint.

---

## 1. Deliverable spec (fixed at t0)

`wave_plans/W40/CONTINUE-PROMPT.md` sections:
1. **§0 Identity + the law** — reused from W38 §0 (SPACE path / no-tty / short one-liners / the standing laws).
2. **§1 Read-first list (UPDATED)** — START-HERE · W37 master-pack · finalsprint §MASTER-CORRECTIONS ·
   the register §W27-WORKLIST/§R1–R15 · W34 prep/code-notes · W35 factory-notes · the W39 lane logs
   (`fixes/287_*`, `fixes/288_*`) · WD-1/WD-2/WD-3 watchdogs.
3. **§2 THE STATE BLOCK (exact)** — gates (typecheck/lint registered green 20:5x; the leg sweep green list
   with counts; the ONE red = store.test.ts:972 → Z1's note-doctrine fix); commit status (HEAD `0f85c32`,
   whole W29–W39 era uncommitted); what the 13 lanes landed vs left owed.
4. **§3 THE TODO LIST** — todo-tool ready, ordered: boundary re-close → **COMMIT** → lane leftovers →
   the 17 G-lane mapped items → register remainder (owner-gated O-1→O-4) → the funded keyed run.
5. **§4 TRAPS** — no-tty legs (foreground only), SPACE path (ripgrep/search_files fail), pipes mask exit
   codes, foreground legs one at a time, read_file binary misdetection on finalsprint.md.
6. **§5 THE FINISH** — what DONE means: all gates green ON COMMITTED BYTES; owner items NAMED (not faked);
   ONE clear first command to run.

---

## 2. Live-status sweep (t = start)

| Item | Value | Source |
|---|---|---|
| HEAD | `0f85c32` (W27/W28 mass investigation) | `git log --oneline -3` run this session |
| `git status --short` | 161 entries (the W29–W39 era, uncommitted) | command run this session |
| wave_plans/ | W4…W38; **no W39, no W40 yet** | `ls wave_plans/` |
| W38 prompt | `wave_plans/W38/NEW-SESSION-PROMPT.md` — 48 lines, 10,433 b | read in full |
| Lane logs present at t0 | `287_z1…z5`, `288_b1`, `288_b2`, `288_b4`, `288_c1`, `286_readme_catalog` | `ls fixes/ \| grep -E '^(286\|287\|288\|289)'` |
| Watchdog logs | `289_wd2_verify.md` ✅ (skeleton, sweeps pending) · `289_wd1_progress.md` ⏳ | read WD-2 |

## 3. Log

### [t0] opened — deliverable spec fixed, state swept, W38 template read
- Read `wave_plans/W38/NEW-SESSION-PROMPT.md` in full (the successor's skeleton) + `wave_plans/W37/master-pack.md`
  (the X1–X6 lane packs + the boundary leg list).
- Read `fixes/289_wd2_verify.md` (WD-2's skeleton) and `fixes/287_z1_boundary_close.md` (the boundary closer —
  the ONE red's doctrine + the before-state 72/1).
- Confirmations so far: HEAD `0f85c32`; 161 dirty entries; Z1's log carries its own before/after evidence
  (72/1 → pending re-run) rather than a bare claim.

*(next: poll the lanes until most close; then read each lane's landed/owed section + WD-1/WD-2 tails)*

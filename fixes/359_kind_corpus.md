# 359 · lane `kind-corpus` — an honest per-kind corpus, so the kind pins can actually fire

**Wave:** W359 (kind fidelity). **Lane:** `kind-corpus` (persona `ledger`). **Repo:**
`C:\Users\mnril\Desktop\RapidTool Main` (path contains a space). **Host:** Node v24.15.0, Windows
PowerShell 5.1. **Plan:** `wave_plans/W359/kind-corpus.md` (+ the wave index `wave_plans/W359/README.md`).
**Append-only; this lane is its only writer.**

**Owned files:** `scripts/quality-ratchet.mjs` · `scripts/quality-ratchet.test.mjs` ·
`scripts/quality-ratchet.floors.json` · the per-kind fixture stamping data under `testruns/`
(`testruns/kind-corpus/**`, new). No `src/**` byte, no `scripts/rapidtool-cli.mjs`, no
`src/lib/headless.ts`, no `scripts/run-eval.mjs`, no `scripts/prevention/**` and no other lane's log was
opened for write.

**Owner directive in force (verbatim):** *100% working, high-quality, functional code only — no mock,
stub, demo, fake, or placeholder code may be written by any subagent on any production path. Test doubles
only inside a test seam.*

---

## 0. LOG SKELETON (written first, filled in below as each job lands)

| job | state |
|---|---|
| 1 · per-unit honest / mis-stamp verdict table | _pending_ |
| 2 · per-kind coverage matrix (every kind an honest case, or a named gap) | _pending_ |
| 3 · each pin ABLE TO FIRE + its planted `floor − 1` proof | _pending_ |
| 4 · `realProductOnly` re-verified over `src/**` (repo + emitted + stubs) | _pending_ |

---

## 7. PARENT NOTE - wave PAUSED 2026-10-15 (appended by the parent; this is the parent's observation of the BYTES, not the lane's own claim)

The lane was stopped mid-flight at the owner's request while its log still read all four jobs `_pending_`.
What is known from disk, not from the lane:

- **Files/dirs this lane changed:** `scripts/quality-ratchet.mjs` (mtime 17:17:06),
  `scripts/quality-ratchet.test.mjs` (17:10:02), `scripts/quality-ratchet.floors.json` (17:11:40), and it
  CREATED `testruns/kind-corpus/units.json` plus a real emitted tree
  `testruns/kind-corpus/arcade-breakout/emitted/**` (a genuine `index.html`, `package.json`,
  `tsconfig.json`, `vite.config.ts` tree - real emission, not a fixture stub).
- **Because the reader (`.mjs`), its test, and the FLOORS all moved with no log, the next session MUST
  diff those three files against `HEAD` before trusting any reading.** Run:
  `git diff HEAD -- scripts/quality-ratchet.mjs scripts/quality-ratchet.test.mjs scripts/quality-ratchet.floors.json`
- **Its four chartered jobs are UNDOCUMENTED:** (1) the per-unit honest / mis-stamp verdict table;
  (2) a per-kind coverage matrix so `kindFit.tool` and `kindFit.service` stop being `uncovered`;
  (3) each pin ABLE TO FIRE, proven by a planted `floor - 1`; (4) `realProductOnly` re-verified over
  `src/**` (the owner's no-mock rule) plus the `stubProductionModules` debt (measured 3 at the last
  boundary).
- **Not broken:** `npx tsc --noEmit` exits 0 at the pause; `scripts/quality-ratchet.floors.json` still
  parses (verified; it could not carry a marker comment because JSON forbids comments).
- **RESUME:** full order in `wave_plans/W359/HANDOFF.md` section 3.

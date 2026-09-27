# fixes/286 — README-CATALOG LANE (W38) · work log

**Lane:** README-CATALOG (W38). **Scope:** DOC-ONLY — `README.md` + this log. No product code touched.
**Mission:** rebuild `README.md` into the literal, accurate catalog of EVERY tracked file
(`git ls-files` = **1391** today) + AI-agent reading instructions + corrected honest-state;
preserve every existing correct claim and every claim pinned by `scripts/README-cli.test.mjs`;
log every correction here with before/after.

**Started:** 2026-09-26 · HEAD `0f85c32` + live lanes' uncommitted edits (Y1/Y2/G1–G4 mid-edit).

## Initial byte-facts gathered (evidence)

- `git ls-files | wc -l` = **1391** (matches the expected ~1,39x).
- `grep -c 'case "' scripts/rapidtool-cli.mjs` = **39** ← the real verb count today.
  - Root `README.md` says **37 verbs** in 5 places (:9, :10, :89, :110, + inline). **STALE — must be corrected to 39.**
  - `scripts/README-cli.md` already says **39 subcommands** and lists exactly the 39 arms — it is the home of the CLI contract; README.md must LINK it, not duplicate it.
  - `scripts/README-cli.test.mjs` pins: the `**N subcommands**` claim (all occurrences), the README-cli.md verb list vs case arms (both directions), every `grep -c 'case "'`-quoting line's numbers, no stale `N subcommands|case arms|verbs` phrasings, the `edit` arm (dry-run default + `--write` + `applyStrReplace` + `evaluatePolicy("repair.apply")` + `decidedVia`), USAGE-keys parity, and the emit `--red-tree` policy (`refuse`/`banner` + `redTree`) + `redTreeBanner` doc. **This test pins `scripts/README-cli.md`, NOT root README.md** — root README edits must still keep every claim it repeats about the CLI TRUE (39, not 37).
- Top-level tracked-file census: research 468 (multiagent 103 · eval-corpus 15 · eval-out 345 · 5 root) · fixes 321 · src 201 · wave_plans 93 · .grok 89 · scripts 40 · builds 35 · vault-e2e 32 · screenshots 16 · public 10 · audit-bugs 5 · review 3 · proposals 3 · audit 3 · server 2 · migrations **1** (`migrations/auth/0001_auth.sql` only) · root misc ~55.
- **`finalsprint.md` and `docs-FOLDER-MAP.md` are UNTRACKED** (`git ls-files | grep -c` = 0 each) — START-HERE references them, but they are not in the tracked universe. Noted in README's untracked-files note.
- `builds/vault.md/*.md` + more filenames contain spaces + unicode (·, –, ≅) — quoted in `git ls-files` output.

## Corrections found so far (before → after)

| # | Where | Before | After (evidence) |
|---|---|---|---|
| C1 | README.md :9, :10, :89, :110 | "**37 verbs**" | **39 verbs** (`grep -c 'case "'` = 39; `scripts/README-cli.md` headline) |
| C2 | README.md :157, :182 | `research/multiagent/` "103 files today" | verify count (103 per `git ls-files research/multiagent/ | wc -l` — re-check below) |
| C3 | README.md Status block | 2026-09-24 W12 gate as latest | re-verify against START-HERE/finalsprint honest state (W12 counts may still be the last full gate — keep but mark provenance) |

_(more as batches land)_

## Batch log

- [x] B0 — recon: `git ls-files` census, CLI arm count, top-level groups, key docs read (README.md, START-HERE.md, AGENT_GUIDE.md, W38 NEW-SESSION-PROMPT, register preamble, README-cli.test.mjs).
- [ ] B1 — root files + configs
- [ ] B2 — src/
- [ ] B3 — scripts/
- [ ] B4 — research/ (multiagent / eval-corpus / eval-out)
- [ ] B5 — fixes/ + wave_plans/
- [ ] B6 — the rest (builds, vault-e2e, screenshots, audit*, review, proposals, server, .grok, public, migrations, .github)
- [ ] B7 — README rebuild + verification pass

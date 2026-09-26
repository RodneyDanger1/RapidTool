# fixes/269_lane15_audit_everything.md — W28 R15 · THE EVERYTHING-ELSE SWEEP (final)

**Lane:** R15 (everything-else auditor) · **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD:** e3d3fe4
**Read window:** 2026-09-26 16:08–16:25 CDT · **No product edits · no keyed calls · no full-gate runs.**
**Deliverables:** §R15 appended to `research/multiagent/thoroughanalysis.md` via the END-OF-FILE-MARKER-W25
protocol (verified: marker intact + last line at 1105, single occurrence; 14 findings rows + verified-HELD list +
hand-offs + the full-tree COVERAGE STATEMENT; 22 `R15-f` mentions) + this lane log.

## Read-first log (all done)
`wave_plans/W28/extension.md` (R15 box) → `wave_plans/W27/mass-investigation.md` (mission + append protocol) →
`research/multiagent/thoroughanalysis.md` (mission + A1–A4/C1–C6 + all landed §R sections) →
`research/multiagent/thoroughaction.md` (watchdog ledger) → AGENTS.md → the codebase (bytes).

## Method
1. `git ls-files` = **1,370 tracked files** → mapped every path against every slice box (A1–A4 · C1–C6 · R1–R14).
2. Found the genuinely-unowned set: `src/lib/auth/**` (19), `app-data/**` (7), `multiplayer/**` (2), `db.ts`,
   `templates.ts`, `og/site.json`, `error-component.tsx`, `preview-embedder-origin.ts`, `testing/fixtures.ts`,
   configs (`tsconfig.json`, `vite.config.ts`, `eslint.config.mjs`, `.prettierrc`, `.gitignore`, `.env.example`,
   `package-lock.json`), `.github/workflows/gate.yml`, `server/**`, `public/**`, `.grok/**`, root artifacts (35),
   archives (`builds` 50 · `vault-e2e` 47 · `screenshots` 16), prior dossiers (`audit` 3 · `audit-bugs` 5 ·
   `review` 3 · `proposals` 3), `attachments`, and the cross-cutting concerns.
3. Prior art used: `audit/03_auth_appdata_platform_audit.md` (a FULL pre-git audit of the auth/app-data/platform
   scope) — its 8-item bug register re-verified against current bytes; 3 bugs CLOSED, 2 re-flagged, 3 handed off.

## Findings (all appended to §R15; IDs match)
| ID | Sev | What | Key evidence (read today) | Status |
|---|---|---|---|---|
| R15-f01 | P2 | "autonomous software agency" 4th home — `src/lib/og/site.json` ships as og:description on every unfurl; A4-f01 census missed it | `og/site.json:1`; chain `grok-pwa-shared.mjs:11/269/351`, `grok-pwa-plugin.mjs:166`, `grok-pwa.ts:18` | READY (extend A4-f01) |
| R15-f02 | P2 | Auth schema unreachable: only migration lives in `migrations/auth/`; both migrators non-recursive; no copy-up. Sub: `account` lacks unique (providerId,accountId) | `migrate.mjs:15-20`, `db.ts:134-141`, `0001_auth.sql:40-54`; audit/03 §8.2-7 re-verified | READY |
| R15-f03 | P3 | ~30 unused prod deps (17 Radix + shadcn/template set) + unused `eslint-plugin-prettier` | import-specifier census script (33/52 zeros; tailwind/router-plugin excluded after config audit); `package.json:87` | READY |
| R15-f04 | P2 | `tsc` covers only src+server → 40 scripts (incl. `rapidtool-cli.mjs` 154KB) untyped; 2/40 carry `@ts-check` | `tsconfig.json:32-35`, `package.json:17` | READY (staged) |
| R15-f05 | P3 | Formatting unenforced + no `.prettierignore`; `npm run format` would rewrite eval corpus | `.prettierrc`; `package.json:22`; no `.prettierignore`; gate.sh has no prettier step | READY |
| R15-f06 | P2 | CI (`gate.yml`) inherits A2-f02 (green with red leg) + never executed | `gate.yml:5-6,27-30,70`; A2-f02 `gate.sh:154-178` | BLOCKED on A2-f02 |
| R15-f07 | P3 | 10 tracked scratch probes in product tree (9 root + `.audit-g2`); policy flipped twice; G10 flags them | `git ls-files`; e3d3fe4 log; `103_feature_gaps.md:151-153` | READY (owner call) |
| R15-f08 | P3 | `.grok/` partially LOAD-BEARING (4 live reads) + stale `.grok/status` "READY" (3 weeks) | `with-app-env.mjs:28`, `brand-check.mjs:41,88`, `preview.mjs:30-31`, `.grok/status` | READY |
| R15-f09 | P3 | `.env.example` documents 2 of ~20 env vars (model overrides, seat token, pricing untold) | env census (DEEPSEEK ×100, RT_HUMAN_SEAT_TOKEN ×27, …); `.env.example:1-11` | READY |
| R15-f10 | P3 | No `version`, no `engines`, template name; inner contracts versioned (schema_version, PACKET_VERSION=3) | `package.json:2`; `rapidtool-cli.mjs:125`; `packet.ts:25` | READY |
| R15-f11 | P3 | i18n: none + undeclared; `Intl.` 0 hits; `date-fns` unused | greps 16:16 | READY (one-line) |
| R15-f12 | P3 | a11y: no automated guard anywhere; install CSS has no focus styles; emitted UI gap (A3-f07) | console 96 aria-*; no axe; `install/styles.css` focus grep 0 | READY |
| R15-f13 | P2 | `attachments/RapidTool_Complete_Master.md` overclaim persona prompt (unindexed) + `agentnotes.md` 5,774-line orphan (no current refs) | attachments:1-3 vs `AGENT_GUIDE.md:52-54`; refs greps exit 1 | READY |
| R15-f14 | P3 | Origin residue: `.node_modules.lock` 0 bytes / 0 refs; `startup.sh` + `AGENTS.project.md` `/workspace`-shaped | stats + greps 16:23 | READY |

**Verified-HELD (no findings owed):** `with-app-env.mjs` (full read) · audit/03 bugs A/D/H now CLOSED
(`login.ts:29-38`, `isolation.server.ts:44-46`, `verify.server.ts:51-57`) · error-reporting chain
(`error-component.tsx` + `router.tsx` + `error-scan.server.ts`) · export/import round-trip exists
(`console.tsx:2260/2316` + CLI `export`) → no backup finding · public assets sized + referenced · LICENSE/config
files fine.
**Hand-offs (other boxes):** audit/03 bug C → R5 (`grok-pwa-shared.mjs:135`, bytes unchanged) · audit-bugs/04
S-04/S-05 → R11 · audit/03 bugs B/F → re-verify against current lines before scheduling (anchors given).

## COVERAGE STATEMENT (summary; full text in §R15)
- **1,370 tracked files**: 1,370/1,370 assigned to a slice or R15.
- **Tier A — read/byte-verified ≈380 (≈28%)** — includes **100% of the product surface** (src 201/201, scripts
  40/40, root 35/35, server 2/2, migrations 1/1, .github 1/1, public 10/10).
- **Tier B — indexed/classified/sampled ≈760 (≈56%)** — fixes (indexed), eval-out (R8 box), multiagent (R7 box),
  wave_plans, .grok, archives, prior dossiers.
- **Tier C — never opened ≈220 (≈16%; all docs/archive/binary, zero product code/config)** — explicit list in
  §R15: agentnotes body · audit/01-02 + review/proposals/audit-bugs bodies · ~78 .grok skill/reference bodies ·
  builds 49 · vault-e2e 46 · screenshots 14 · probes 7 · research root 5 · e2e artifact bodies.
- Cross-cutting disposition: logging HELD · error reporting HELD · backups no-gap · versioning GAP (f10) ·
  a11y no guard (f12) · i18n none+undeclared (f11) · design tokens HELD (shell) · dependency hygiene GAP (f03).

## Status: **COMPLETE** — both deliverables landed; no product edits made.

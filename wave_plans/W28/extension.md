# W28 · MASS INVESTIGATION part 2 — 5 more auditors (R9–R13) + 2 more watchdogs (WD-γ, WD-δ)

**All readers share this file.** Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; `grep`).
```text
SAME GOAL as W27 (read `wave_plans/W27/mass-investigation.md` IN FULL first — the mission, the READ-FIRST
list, the append protocol). You ADD to that investigation; you do NOT repeat R1–R8's slices (they own
engine/phases · store/io/packet/dod · codegen/scaffold/compile-check · llm/server/telemetry · scripts/CLI ·
UI/routes · docs/corpus · mission-gap). The mission: RapidTool = a truly autonomous software factory / the
best AI agent harness in the world — GOOD code, any kind of software (games/web/apps/tools/…), continuously
self-improving, perfect UI/UX for what it emits, professional quality in EVERY file/function.

READ FIRST: `research/multiagent/thoroughanalysis.md` (mission + A1–A4, C1–C6, R1–R8 as they land — re-read:
10 writers) + `research/multiagent/thoroughaction.md` (the watchdogs' ledger) + `fixes/263_index.md` +
AGENTS.md. THEN READ THE CODEBASE ITSELF.
APPEND PROTOCOL: append-only via `<!-- END-OF-FILE-MARKER-W25 … -->` (patch: old = marker line exactly;
new = your block + unchanged marker; RE-READ before EVERY append). Sections R9–R13 are yours. NO keyed calls.
NO full-gate runs. Lane logs: `fixes/269_lane<N>_audit_<slice>.md`. WRITE EARLY (~8 calls).
EVERY finding: ID (R9-fNN…) · severity · evidence (file:line + read time, or a real command's output) ·
why vs THE MISSION · the coder-ready fix spec (change + done-when) · READY/BLOCKED/OWNER-ONLY.
```

## R9 — THE TEST SUITES AS A SYSTEM (do the tests mean anything?)
**Box:** all `src/lib/**/*.test.ts`, `scripts/*.test.mjs`, `src/lib/llm/**` tests. **Hunt:** vacuous asserts
(`assert.ok(true)`-class), pins that would PASS with the feature reverted (mentally revert each critical pin),
tests asserting the implementation instead of the contract, coverage gaps vs the mission's claims, suites
that never run (the H2 79-vs-81 class — now fixed: verify the new glob actually includes them), the guard
suites' real teeth. Output: a per-suite verdict table + the list of REPLACE/ADD test items for the coders.

## R10 — THE 13-PHASE DATA FLOW END-TO-END (the spaces between the files)
**Box:** trace ONE journey's data hop-by-hop through the code (brief → intake → lattice → design → codegen →
emit → tree-run → verify → packet → handover): at each hop, read the ACTUAL structures passed; find where
shape/fields/ids are lost, re-mapped wrongly, or never consumed (the "calls between things" class the owner
flagged). Compare the keyed vs keyless journeys; note every place a claim is made in the packet that no data
supports. Output: the hop table + the wiring-fix specs.

## R11 — SECURITY · SAFETY · ROBUSTNESS (trust boundaries)
**Box:** node-runner/sandbox claims, `spawn`/child-process sites, path handling (the S-04/S-05 open items in
`audit-bugs/04`), credential hygiene (`.env` handling + the never-print rules + the redaction warning C1
recorded), untrusted-input surfaces (briefs, corpus fixtures, graders, emitted code), the `--force`/refusal
paths. Task-framing: an autonomous factory runs code it didn't write — what must be true, and what isn't.
Output: findings + specs; P0 if a real boundary is broken.

## R12 — PERFORMANCE · RELIABILITY under the real box
**Box:** the 8GB/RAM constraints, timeouts/backoffs/retries (`synthWithBackoff`, node-runner limits, budget
caps), unbounded growth (arrays/maps/timers in console/store/telemetry), the watchdog/timer patterns, the
run marker's lifecycle, memory leaks in the UI's subscriptions. Output: findings + specs with the failure
mode named (when does it bite, on what input).

## R13 — THE "BEST IN THE WORLD" GAP (competitive/leapfrog lens)
**Box:** `research/multiagent/90_LEAPFROG.md` + the competitor dossiers + the 17-clone evidence. Audit what
the MISSION requires vs what the field's best do: which capabilities does a best-in-class autonomous
harness have that RapidTool lacks (or fakes), mapped to files (what exists / what's missing / smallest
complete design). Be evidence-based (the dossiers cite real code); no invented competitor claims.

## R14 — THE FULL-STACK WIRING TRACE (UI ↔ backend, every call edge)
**Box:** the whole client↔server chain, read as a GRAPH. Catalogue EVERY edge: user action (component) →
store action → server-fn / route handler → lib call → side effect (file/spawn/network), and every return
path back (server → store → render). Sources: `src/components/**`, `src/routes/**`, `src/lib/*.ts` server-fns
(`createServerFn` sites), `*.server.ts`, `src/router.tsx`/`routeTree.gen.ts`, the dev-server config
(vite.config.ts, ports, proxy). For EACH edge: wired ✓ / broken ✗ / dead (no caller) / ghost (calls nothing).
Include: API calls (all fetch/spawn/network sites), server modules' surface, the client/server boundary
(node: imports, lazy imports), and the API contracts between them. Output: the edge table (from → to →
verdict → file:line) + fix specs. NOT R6's job (UI polish) — yours is the CHAIN.

## R15 — THE EVERYTHING-ELSE SWEEP (files no slice has audited yet)
**Box:** `git ls-files` the WHOLE tree; diff against every audited slice (R1–R14 + A1–A4/C1–C6); audit the
REMAINING files/folders to the same standard — configs, tsconfig chain, vite config, `.github/`,
`migrations/`, root scripts, assets, `.grok/` legacy (descope status), fixtures/templates, whatever is
left — plus cross-cutting concerns NOBODY mentioned: logging, error reporting, versioning, backups,
accessibility, i18n, typography/design tokens, dependency hygiene (package.json versions, dev vs prod).
Deliver: findings per file (same row shape) + a COVERAGE STATEMENT (what % of the tracked tree the
investigation waves have now examined, and the explicit list of anything still unexamined).

---

## WD-γ · live watch of R9–R13 + codebase cross-read (`fixes/270_wd_gamma.md` + `thoroughaction.md` §WD-6)
Same as WD-α's brief: poll ≥5×, verify ≥10 claims against bytes, marker integrity, box enforcement — AND
read the codebase ITSELF in the new slices (tests/data-flow/security) for counter-findings. Rows via the
END-OF-FILE-MARKER-ACTION protocol (re-read before every append). Bottom line at top of your first block.

## WD-δ · GLOBAL SWEEP + WORKLIST-COMPLETENESS AUDITOR (`fixes/270_wd_delta.md` + `thoroughaction.md` §WD-7)
Two duties: (1) the fleet-wide sweep (all live delegations' mtimes, git change signal, both shared logs'
markers + row counts, silent lanes, box violations — WD-4's pattern); (2) **audit WD-β's §W27-WORKLIST for
completeness**: every finding in §A1–A4/§C1–C6/§R1–R13 must map to a register row (grep the IDs); any
missing/duplicated/mis-prioritized item = a row in your section + (if the worklist exists) an append-only
`§W27-WORKLIST ADDITIONS` block citing it. You are the register's own safety net.

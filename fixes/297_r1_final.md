# 297 — R1 final: land Q-wave remaining patch lists

Base: HEAD=60c92a2 (5 commits, clean tree, gates green, no keyed calls).
Status legend: [ ] pending · [x] landed · [v] verified already-landed · [!] blocked
Order: Q2 (stdout) → Q6 → Q8 → Q1 → Q4.

## Items
- [x] **Q2** rapidtool-cli.mjs respond() stdout drain — LANDED 2026-09-28
- [ ] **Q6a** io.test.ts exportPacketText de-dupe PIN (single-render)
- [ ] **Q6b** ui.boundary_crash registry entry (verify + add additively)
- [ ] **Q6c** AGENT_GUIDE.md §4 reword (G2 note)
- [ ] **Q6d** README §10.1/§10.2/§10.6 count corrections to live numbers
- [ ] **Q8** cli-exit-taxonomy.test.mjs leg-1 regex WIDENING; envelope-code-membership leg
- [ ] **Q1** headless.ts:2153/2706/2748 + wild-review.ts:86/100 → clientSafeServerSpecifier
- [ ] **Q4a** run-eval.mjs entry-runs EXECUTION path (pending branch :721-729)
- [ ] **Q4b** passesAcceptance/acceptanceFailReason over real runtime evidence
- [ ] **Q4c** history.json end-class key (funded|unfunded|unmeasured)
- [ ] **Q4-tests** run-eval.test.mjs + gate-verdict.test.mjs FOREGROUND

(evidence lines appended per item as landed — bytes read today only)

### Q2 — respond() stdout drain (rapidtool-cli.mjs)
- Q2's own lane log `fixes/296_q2_a2.md` is NOT on disk; source = summary `subagent-summary-1-20260927_043617_513416.txt` row 4 (byte-walk verdict: "`rapidtool-cli.mjs:176` still `write` then `process.exit(exitCode)` (comment at :123). Not my box → for P4/N5").
- Pre-fix bytes: `rapidtool-cli.mjs:175` `process.stdout.write(JSON.stringify(out, null, 2) + "\n");` → `:176` `process.exit(exitCode);`.
- Local repro probe (honest): `node -e 'stdout.write(200MB); process.exit()' | (sleep 1; wc -c)` → full 200,000,015 B — NOT reproducible in git-bash MSYS pipes on this box; the async-pipe truncation class is Node-documented ("Pipes: asynchronous on Windows") → landed as hardening, fix kept in-tick (jurisdiction: 217e G1 fall-through note at :122-129; bare `respond(` statement sites exist — e.g. `:517` — so exitCode+return would re-open the fall-through).
- After: `:180-194` sync drain `writeSync(1, payload)` (try) with `process.stdout.write(payload)` fallback (catch) BEFORE `process.exit`; import adds `writeSync` at `:58`.
- Evidence: `node --check scripts/rapidtool-cli.mjs` → CHECK-OK; `doctor` piped (`| node -e` parse) → `piped parsed ok=true exit_code=0`; `doctor > .d1tmp.json` → `file parsed ok=true exit_code=0` (tmp removed).

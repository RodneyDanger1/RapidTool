# W15 · LANES 1–4 — finish the loose ends the COMPLETED tasks left behind (owner: "finish things that aren't finished from completed tasks first")

**All four lanes share this file.** Read your own section. Repo: `C:\Users\mnril\Desktop\RapidTool Main`
(Node v22.23.2; git-bash `/c/Users/mnril/Desktop/RapidTool Main`; SPACE in path → ripgrep FAILS, use `grep`).

```text
TREE: uncommitted on 7582771, C-1+C-2+docs+browser all landed and boundary-verified at 13:10:
  run-eval 17/17 · headless 91/91 · browser-verdict 40/40 · README-cli 11/11 · typecheck 0.
Two watchdogs (WD-α fixe/238, WD-β fixe/239) already reported; their findings are the source for
lanes 1-3. READ THEM: fixes/238_wd_alpha_report.md (WD-α) and fixes/239_wd_beta_report.md (WD-β).

RULES (binding): no fake code / no hallucinations / no bad code / no problem causers. "Do not rebuild
before all tasks are done" — never re-implement a capability (do-not-rebuild list in
220_tasklist_canonical.md §2). ONE lane per HOT file (boxes below). WRITE EARLY: skeleton + bottom line
within the first ~10 calls, then write as you go (`fixes/241_lane<N>_<slug>.md`). Every claim = the
command that produced it. FORBIDDEN: `npm run typecheck`, `npm test`, `npm run build` (boundary/parent
only). Scratch outside the repo (`C:/Users/mnril/w15l<N>_scratch/`).
```

## LANE 1 — close C-1's second-seam gap + port the guard harness into a real pin
**Owns:** `src/lib/headless.test.ts` (the repair region), `scripts/browser-guard.test.mjs` (**new file**).
1. **C-1's repair seam has NO dedicated test.** The journey seam got one; `repairTreeDir`'s `recordGreen`
   (`headless.ts` ≈`:2502-2516`) got the same fix with zero coverage — a future refactor can silently
   revert it. Write a RED-first test in the repair region: a candidate project (P6 complete) + a green
   verdict carrying an executed spec → assert `lastTest.label === "tested"` **and** the returned `gate`
   reflects the mint (the deadlock's second seam). **Prove RED first** by reverting the mint line in a
   scratch copy or by the existing test's absence — state the RED evidence honestly in your log.
2. **Port WD-α/L3's finding R2**: Lane 3's 4-case guard harness lives only in scratch
   (`C:/Users/mnril/w14l3_scratch/guard-check.mjs`). Create `scripts/browser-guard.test.mjs` pinning the
   four cases (accept `C:/workspace/...`; refuse `..`-escape, outside-dir, the strict dir itself). Run it.
**Done-when:** `node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts`
shows the new test green **and** the count increased by ≥1 (91 → ≥92); the new guard test file runs green
on its own. Keep every other assertion untouched.

## LANE 2 — close C-2's registry gap + the RT_ code audit
**Owns:** `src/lib/errors.ts`, `src/lib/errors.test.ts`, and (read-only) `scripts/run-eval.mjs`.
1. **C-2 flagged it honestly: `RT_EVAL_STALL` and `RT_EVAL_REFUSED` are thrown/returned by the drain but
   absent from the `errors.ts` registry.** Certify the claim (grep both codes across `src/` + `scripts/`),
   then either register them in the error registry **with real codes** (follow the registry's own
   convention exactly — read 2 neighbours first) or strike the claim with the reason (declare-or-strike).
2. Sweep for **any other `RT_E_*` string in `scripts/` that the registry lacks** (a one-command grep);
   register or list them with a decision each. Do not invent codes; reuse the registry's families.
**Done-when:** `node --experimental-strip-types --test --test-concurrency=2 src/lib/errors.test.ts` green;
the grep evidence pasted in your log shows the before/after count; every listed code has a status.

## LANE 3 — finish the browser pass's registered items (R1, R3, R5–R7) honestly
**Owns:** `fixes/241_lane3_browser_residuals.md` (your log), `scripts/browser-smoke.mjs` (arg handling
only), `src/styles.css` or `src/components/console.tsx` ONLY for a defect you actually observe; nothing else.
1. **Read `fixes/237_lane3_browser_pass.md` §4** (the 7 REGISTERED items). For each R: fix it (if cheap and
   inside your box), or re-register with a sharper reason. Specifically:
   - **R1**: port 8080 was held by a FOREIGN dev server (`contractorapp`, PID 14140 since 09:43). Check if
     it is still held (`netstat`/`wmic`); if free, run the LITERAL
     `node scripts/browser-smoke.mjs http://localhost:8080/ C:/workspace/screenshots/w15.png` against
     `npm run dev` (background, kill after). If still held, re-register with the live PID evidence.
   - **R3** (`brandWarnings`: no custom `public/og.jpg`): determine whether this is a defect of THIS repo
     or a non-issue; register or fix accordingly — do NOT add binary assets (out of box).
2. **A second real browser look** is welcome if a defect was observed: describe pixels, never claim a run
   you did not do.
**Done-when:** every R1–R7 has a status (fixed / re-registered with reason / out-of-box-noted) with its
evidence command; the literal-8080 smoke ran or its blocker has live PID evidence.

## LANE 4 — the 13 WEAK verifications (draft the strengthened commands; DO NOT edit the plan corpus)
**Owns:** `research/multiagent/241_weak_verification_strengthenings.md` (new file). Read-only elsewhere.
ENG-WD2's audit (`235`) graded **13 of 17 placed rows' verification commands as WEAK** — "a green command
that could pass while the row is broken". For each WEAK row (get the list from `235`; cross-check the
row's block in `230_task_execution_playbook.md`):
1. Name the failure the weak command could hide (one line).
2. Write the **strengthened command** (exact, copy-pasteable, real paths) and the observable it must pin.
3. State whether the strengthening changes the row's done-when or only the proof.
**Deliverable format:** one block per row, headed by the row id, plus a summary table (`row | weak because
| strengthened command | changes done-when?`). The parent folds these into the corpus at merge — you never
touch the corpus yourself.
**Done-when:** all 13 rows covered with a real command each (no placeholders); 0 corpus edits by you.

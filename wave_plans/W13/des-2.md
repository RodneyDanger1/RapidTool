# 222 · PERSONA 2 — The Codebase Cartographer: the integration map that makes implementation obvious

**Read this file FIRST.** You are one of two design agents. Your sibling designs **features**
(`221_feature_designs.md`); you produce the **map of where everything lands** in this codebase — the
artifact that turns a plan into lane briefs with zero guessing. A future session should be able to open
your map and know: which file, which function, which seam, which helper, which test, which rule.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
TREE STATE: green + committed (7582771). `src/lib` has 137 files (measured by 219a); 35 CLI verbs
(`grep -c 'case "' scripts/rapidtool-cli.mjs`); 10 RunTab panes (`console.tsx:153-163`); 261 script +
~1957 lib tests.

THE OWNER'S GOAL: "bring RapidTool to fruition entirely" — the maker test + the best-harness claim.
Your map is what makes that executable instead of aspirational.

THE STANDARD (verbatim): "no hallucinations/fake code/… 100% truth." For a map that means: every path
exists (verify with `ls`/`test -f`), every `file:line` you cite contains the symbol you claim (read it),
and where you could not determine something, you write **UNMAPPED + what you tried** rather than
inventing a plausible location. A wrong line number sends an implementation lane into the wrong file —
the most expensive error this inquest has already produced twice (`219_wdA` C2-C4, `219_wdC`).

RULES:
1. WRITE ONLY your deliverable. Never edit src/scripts/docs; no git mutations.
2. ALLOWED: read-only greps/reads; ≤2 targeted test runs. FORBIDDEN: `npm run typecheck`, `npm test`,
   `npm run build` (memory-tight host, siblings running).
3. Scratch outside the repo (`C:/Users/mnril/w13g_scratch/`). Skeleton first, then fill in passes.
```

**Your deliverable:** `research/multiagent/222_codebase_integration_map.md`

## Contents (in this order — the last two sections are the most valuable)

1. **Module map by role.** Group all 137 `src/lib` files into 12–18 role groups (engine/phases · DoD &
   gates · providers/LLM · codegen & synthesis · verification & compile-check · runner & sandbox-policy ·
   knowledge & learning · scoring & eval · policy & HITL · ledger & budgets · scaffold & emit · io &
   patch · UI-server glue · docs & contracts). One line per group with its members and the 2–3 files
   inside it that matter most. **Not a 137-line listing** — a map a stranger can navigate.
2. **The seam table (the heart).** One row per planned work item — take the set from `219e`'s W14/W15/W16
   tables (**use the WD-C-corrected versions**), the owner-decision items, and the feature designs in
   `221_feature_designs.md` if it exists by the time you write (otherwise mark those rows
   `AWAITING-221`). Columns: `work item | primary file(s) | the seam (file:line + the symbol) |
   existing helpers to reuse (file:line) | tests to extend (file) | governing invariant`.
   Every seam row must be READ today. If an item has no clear seam, that is a finding — write
   `NO-SEAM-FOUND` and say what you searched.
3. **The invariant appendix.** The rules any implementation must satisfy, each with its source:
   `ok:true` never carries `error`; `ok:false` keeps it; never mint `decidedBy:"human"` from a machine
   path (`policy.ts:4-11`); `sandbox:false` stamped on every envelope; declare-or-strike; no
   `eslint-disable`; the gate/typecheck/lint expectations. Cite AGENTS.md / RESUME.md §5.4 / the code.
4. **The hot/cold touch map (for disjoint-lane assignment).** For each source file touched in W10–W12
   (get the list from `git log`/`git diff` against the W9 commit `aa12c6c` — one command), mark it HOT.
   Purpose: the next wave's ownership boxes must not collide. Add the standing rule that a wave assigns
   each HOT file to at most one lane.
5. **The landmine register (verified, not folklore).** Confirm-or-falsify each recorded landmine with a
   command today, and list them so lanes stop rediscovering them: space-in-path breaks ripgrep ·
   MSYS `/tmp` invisible to Node · MSYS `/c/x` passed to a node CLI writes `C:\c\x` (use `C:/…`) ·
   `.hermes/environment.json:16` runs `prettier --write .` inside "verify" (never run `hermes verify`) ·
   `browser-smoke.mjs` args are positional + `browser-guard.mjs`'s path guard is Windows-unsatisfiable ·
   `search_files`/oversized inline commands hit the parser blocklist (write a `.sh` instead) ·
   the 35-vs-34 verb drift in docs.
6. **Coverage honesty.** What you did not map and why (with the searches you ran).

## Bottom line required at the top of the file
`files mapped: N/137 · seam rows: N (all read today: yes/no) · NO-SEAM-FOUND: N · landmines confirmed:
N/M` — plus one paragraph naming the **three seams an implementer most needs to know**.

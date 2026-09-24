# 234 · ENGINEERING WATCHDOG 1 — code-on-code depth audit: is RapidTool genuinely ahead, and can the plan make it so?

**Read this file FIRST.** Twenty-three agents have said RapidTool "leads on three mechanisms, trails on
three". **Nobody has tested that claim code-against-code** — RapidTool's implementation vs the clone's
implementation of the same mechanism, line by line. You do. You are one of two engineering watchdogs; the
other audits execution-readiness. Your verdict feeds the owner's "best of the best / farther than all
competitors" goal — honestly, with evidence, whichever way it falls.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
COMPETITOR CLONES: /c/Users/mnril/rt-competitors/ (17 repos). ⚠️ NEVER EXECUTE ANYTHING FROM A CLONE —
reading/grepping only (one historically carried a credential-stealer).

THE OWNER'S ASK (verbatim): "ensure the plan's goal of making RapidTool the best of the best / truly
advanced and farther along than all competitors open source or paid for competitors."

THE HONEST FRAME YOU MUST USE (the owner demands 100% truth; do not hype, do not sandbag):
- "farther along than ALL competitors" is **not claimable today** — RapidTool has not yet produced a real
  app (the maker test is unproven) and its keyed path is deadlocked (WB-1, parent-verified). Any agent
  claiming otherwise would be lying.
- What IS testable, mechanism by mechanism, is **engineering depth**: does RapidTool's `verification /
  governance / honesty` machinery contain work that the clone's does not — more invariants, more evidence
  binding, more failure modes handled — and is any clone's version deeper? Answer that with code.
- Where RapidTool trails, your job is to judge whether the PLANNED close (221's F1/F2/F5, the CI row, the
  permission-granularity row) actually closes it as designed, or whether the design would fail on contact.

RULES: WRITE ONLY your deliverable. Never edit src/scripts, the plan files, or anything else; no git
mutations; never execute clone code. Allowed: read-only reads/greps (repo + clones), ≤3 targeted test runs
(`--test-concurrency=2`). FORBIDDEN: `npm run typecheck`, `npm test`, `npm run build`. Scratch outside the
repo (`C:/Users/mnril/w13o_scratch/`). Skeleton first, then fill in passes.
Every claim = a `file:line` in RapidTool you read today, or a clone path + symbol you read today (with the
clone's revision noted if you check `git -C <clone> log -1`). UNVERIFIED labels where you could not read.
```

**Your deliverable:** `research/multiagent/234_engineering_depth_audit.md`

## The five depth comparisons (do all five; budget your reads)

For each: **RapidTool's implementation** (function + what it enforces + what it records) vs **the clone's
best implementation** (same) → **depth verdict**: `RAPIDTOOL-DEEPER` / `PARITY` / `COMPETITOR-DEEPER` /
`DIFFERENT-AXIS` — with the specific delta named (an invariant, a binding, a failure mode, a recovery path).

1. **Verification depth** — RapidTool: `treeRun` + `compile-check.server.ts` verdicts + the DoD probe registry
   (`dod.ts`) + the evidence-hash binding (`mintTreeRunTested`). Clones: whichever of OpenHands / cline /
   Roo / aider actually runs the produced artifact's own tests (find it — e.g. grep for `test` invocation
   in their agent loops) — is their check *bound to the artifact* like the hash is, or advisory?
2. **Budget/cost enforcement** — RapidTool: `token-ledger.ts` + `SessionBudgetExceeded` + the (unwired!)
   seams. Clones: find at least two clones' cost/limit mechanisms (they all have something — e.g. cline's
   context management, aider's token accounting, OpenHands' condenser) and compare what actually *stops*.
   NOTE the honest wrinkle AUD-1 found: RapidTool's cap is **landed but unwired** on the default path
   (`RAPIDTOOL_TOKEN_CAP` unset → `accountSynthUsage` never throws). Weigh that.
3. **Governance / approval policy** — RapidTool: `policy.ts` (seats, default-deny, `hitl.force`
   requiresHumanSeat, the "never mint decidedBy human" rule). Clones: their permission/approval models
   (cline's auto-approve settings, OpenHands' confirmation modes, Roo's per-tool ask/deny) — do they bind
   *who* decided, or only *whether* to ask?
4. **Honesty invariants** — RapidTool: coded refusals, `sandbox:false` stamping, declare-or-strike,
   the B-18 declarations. Clones: is there ANY analogue (an explicit "we could not verify X" surface) or is
   "success" always printed optimistically? Quote the strongest counter-example you can find.
5. **Learning/self-improvement** — RapidTool: the lesson store + `refuse:no-proof` floor + red-seal mute
   (T-11). Clones: their memory/learning mechanisms (e.g. cline's memory bank patterns, aider's repo map
   caching, Roo's checkpoints) — do any of them *measure* that learning helped? (Expected: no — verify.)

## Then the two verdicts the owner actually needs

1. **The defensible-superiority statement**: write the strongest claim about RapidTool that the evidence
   SUPPORTS today, in one paragraph, in precise words (no marketing). Then the claim that the evidence
   would support AFTER the maker test passes — and the one that would still be false forever.
2. **The planned-close viability check**: for each planned close (F1 MCP client, F2 provider breadth,
   F5/policy granularity, the CI workflow row), say whether the design in `221`/`224` survives contact with
   the code you read — `VIABLE AS DESIGNED` / `VIABLE WITH CHANGE (name it)` / `NOT VIABLE (why)`.

## Bottom line at the top of the file
`comparisons done: 5/5 · RAPIDTOOL-DEEPER: N · PARITY: N · COMPETITOR-DEEPER: N · planned closes viable:
N/4` — then one paragraph: **the single mechanism that, if RapidTool ships it well, most credibly makes it
"farther along" than the field — and the mechanism where a chase would be wasted effort.**

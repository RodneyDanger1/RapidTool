# 219b · What is broken and what is SILENTLY broken — live defect status

**You are lane 2 of 5 in a read-only "state of the factory" inquest. The owner asked:**
> *"So what is going on? What is left to do / what's broken / silently broken? What is preventing
> RapidTool from being the best agentic AI harness / software factory / autonomous software factory /
> self-fixing and self-improving coder out there?"*

You own the **defect half**: every known defect register, re-checked against today's bytes, plus a
hunt for the failure modes nobody has named yet. Four sibling lanes cover inventory, autonomy,
self-improvement and the plan; the parent synthesises.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
TREE STATE: green as of 2026-09-24 11:08 (`bash scripts/gate.sh` → {"ok":true}); W10/W11/W12 just landed
(fixes/216z, fixes/218 are the close records — read them; do NOT trust their statuses, re-check).

THE STANDARD — the owner's words: "100% solid and no hallucinations/fake code/ and is zero bullshit
100% truth." For every sentence: a claim is (a) a `file:line` you read TODAY, or (b) a command you ran
TODAY with real output pasted, or (c) explicitly labelled UNVERIFIED. Never invent a count or a line
number. Prefer "could not verify" over a confident guess.

RULES:
1. READ-ONLY: you may WRITE ONLY your dossier (below). Never edit src/scripts/docs. No git mutations.
2. ALLOWED heavy commands: `node --experimental-strip-types --test --test-concurrency=2 <file>`
   (≤3 runs) + read-only greps / `node -e` one-offs. FORBIDDEN: `npm run typecheck`, `npm test`,
   `npm run build`.
3. Scratch probes OUTSIDE the repo (`C:/Users/mnril/w13l2_scratch/`).
4. Skeleton first, then fill in passes.
```

**Your dossier:** `research/multiagent/219b_defects_live_status.md`

## What to establish

1. **The registers, swept and re-verified.** Build ONE table; each row = `id → claim (1 line) →
   status TODAY (FIXED / OPEN / PARTIAL / UNVERIFIED) → evidence (file:line or command output) →
   blast radius`. Sweep:
   - `research/multiagent/93_design_flaws.md` — the DF-01…DF-39 ledger (**read its own status column
     first**; many may already be closed — falsify rather than re-report);
   - `fixes/216y_oracle_and_error_audits.md` §2.3 — G1–G7 (**G1, G2, G3, G6, G7 were addressed in
     W11/W12: verify each is genuinely closed today; G4 and G5 are expected still OPEN**);
   - `fixes/218_w12_close_record.md` §3 — the carried-forward list;
   - `fixes/217b_watchdog_verification.md` — F1–F4;
   - `RESUME.md` §4 (items 1–19) + §6.1 (the lanes' own unverified-claim list).
   Where a register item is stale (already fixed), say so with the command that proves it — that is
   valuable, not wasted work.
2. **The silently-broken class — hunt it, don't just list it.** The known shape is: *the system knows
   something failed and the record does not say so.* Grep-level hunt, with real hits only:
   - bare/comment-only `catch` blocks and `.catch()` handlers (a prior scan found 368 catches / 87
     code-free / 126 sentinel-swallow — **re-derive the numbers yourself today**, don't quote them);
   - functions that return `null`/`undefined` on a parse/decode failure with no signal (the G6 class
     — check `codegen.server.ts` is really fixed and look for SIBLINGS in other files);
   - `skip`/`catch → deterministic fallback` paths that a user could read as success (e.g. the engine's
     live-layer floor — verify what W11-L5 landed actually surfaces, and whether any OTHER silent
     fallback of the same shape remains);
   - anything that mints `tested`/green/label strings without evidence (grep the mint sites).
   For each hit: file:line, what it hides, and the blast radius. Rank by how a *user or agent* would
   be misled, not by tidiness.
3. **Anything in the tree that is a claim the code cannot back.** Search the docs for absolute claims
   (`never`, `always`, `cannot`, `100%`, `guaranteed`, `verified`) and check the 6–8 most load-bearing
   ones against the code. A single genuinely-false absolute claim is a headline finding; a list of
   true ones is a useful confirmation. Report both honestly.
4. **The three loudest examples, written out.** Pick the three defects (open or silent) with the
   worst user/agent impact and write each as: what the user sees → what is actually happening
   (file:line) → how you proved it (command + output) → what it costs. No fix proposals (lane 5 owns
   the plan) — just truth.
5. **Plain-language bottom line (3–6 sentences)** in the owner's register: what is broken, what is
   silently broken, and which one matters most.

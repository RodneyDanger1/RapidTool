# 219c · Why isn't it already autonomous? The autonomy blockers, traced to code

**You are lane 3 of 5 in a read-only "state of the factory" inquest. The owner asked:**
> *"So what is going on? What is left to do / what's broken / silently broken? What is preventing
> RapidTool from being the best agentic AI harness / software factory / **autonomous** software
> factory / self-fixing and self-improving coder out there?"*

You own the **autonomy question**: the factory reports `autonomousSoftwareFactory: false` — find out
precisely why, in code, and what would have to change. Siblings own inventory, defects,
self-improvement and the plan; the parent synthesises.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
TREE STATE: green as of 2026-09-24 11:08 (gate {"ok":true}). Read `fixes/216z`, `fixes/218` for what just
landed, but verify statuses yourself.

THE STANDARD — the owner's words: "100% solid and no hallucinations/fake code/ and is zero bullshit
100% truth." Every claim: a `file:line` read TODAY, or a command run TODAY with output pasted, or
explicitly labelled UNVERIFIED. Never invent a line number or a behaviour. `doctor` currently reports
`llm.configured: false` — there is NO API key available, so any keyed behaviour must be traced
in code and labelled as traced-not-run.

RULES:
1. READ-ONLY: write ONLY your dossier. No src/scripts/doc edits. No git mutations.
2. ALLOWED heavy commands: `node --experimental-strip-types --test --test-concurrency=2 <file>` (≤2),
   read-only greps, `node -e` one-offs, and **running the CLI itself** (`doctor`, `create`, `run`,
   `wild`, `tree-run` on a scratch project OUTSIDE the repo — these are read-only on the repo).
   FORBIDDEN: `npm run typecheck`, `npm test`, `npm run build`.
3. Scratch OUTSIDE the repo (`C:/Users/mnril/w13l3_scratch/`).
4. Skeleton first, then fill.
```

**Your dossier:** `research/multiagent/219c_autonomy_blockers.md`

## What to establish

1. **The latch itself, decoded.** `src/lib/doctor.ts` computes `factory.autonomousSoftwareFactory`.
   Read that function and paste the exact conditions (with `file:line`). For EACH of the four
   `gaps[]` strings it emits, trace what it is testing and what would have to become true to clear it.
   Then answer: **is the latch honestly unattainable today, or is it attainable-but-blocked?**
2. **The keyed dependency.** Trace exactly what changes when `DEEPSEEK_API_KEY` is present:
   the provider registry (`src/lib/llm*`), the engine's `enforceDod` default, the live-layer seams
   (`codegen.server.ts` `liveP6Synthesis`, `verify.server.ts`, `chat/crew/swarm`), and the CLI's
   exit-3 `RT_E_LLM_NOT_CONFIGURED` path. Cite code. Then state plainly: **how much of the factory is
   disabled without a key**, and whether anything keyless could be made equivalent (the honest answer
   may be "no — generation needs a model").
3. **How far the unattended loop can actually go.** Read the driver(s): `runUntilGate`, wild-mode
   (`wildStep` + the Auto-Review Supervisor classifier), the HITL gate semantics, and the policy seam
   (`policy.ts` — seats, default-deny, and which actions can be self-approved). Produce a **step
   table of one unattended run**: `step → who decides (machine/human) → what stops it → code anchor`.
   Include where it is *by design* impossible to continue without a human ("never mint decidedBy human
   from a machine path") — that is a feature, not a bug; say so.
4. **The execution floor.** `src/lib/node-runner.server.ts` + `src/lib/sandbox-policy.ts`: the runner
   is a bounded timeout + env allowlist, explicitly **not** a sandbox, and W11-L2 verified NO isolator
   exists on this host (docker/bwrap exit 127, WSL has no distros). State what that blocks for real
   autonomy (running generated code, E2E of an emitted app, self-verification of untrusted output) and
   what it does not. Cite the policy lines; never soften the claim.
5. **The honest ranking.** List, ranked, the things standing between today and an unattended
   end-to-end run that produces a real app — each as: blocker → code anchor → what it costs → is it
   engineering, a key, or a product decision? **Name the single highest-leverage blocker.**
6. **Plain-language bottom line (3–6 sentences)** for the owner: why it is not autonomous yet, and
   what the one real gate is.

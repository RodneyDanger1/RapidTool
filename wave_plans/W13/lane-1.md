# 219a · What RapidTool actually IS today — inventory + claim-vs-evidence

**You are lane 1 of 5 in a read-only "state of the factory" inquest. The owner asked:**
> *"So what is going on? What is left to do / what's broken / silently broken? What is preventing
> RapidTool from being the best agentic AI harness / software factory / autonomous software factory /
> self-fixing and self-improving coder out there?"*

Your job is the **inventory half**: what exists, what runs, what is only declared. You and four
sibling lanes each write ONE dossier; the parent synthesises the final answer to the owner.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
TREE STATE: green as of 2026-09-24 11:08 (`bash scripts/gate.sh` → {"ok":true}: typecheck 0, lint 0,
assertion-gaps 0, scripts 261/261, lib 1957/1957 + 1 by-design skip, build 0).

THE STANDARD — the owner's words: "100% solid and no hallucinations/fake code/ and is zero bullshit
100% truth." That means, for every sentence you write:
- a claim is either (a) backed by a `file:line` you read TODAY, or (b) backed by a command you ran
  TODAY with its real output pasted, or (c) explicitly labelled **UNVERIFIED / taken-from-dossier**;
- NEVER invent a count, a line number, a competitor fact, or a code snippet. If you did not run it,
  say you did not;
- prefer "I could not verify X because Y" over a confident guess. A short honest dossier beats a
  long plausible one.

RULES:
1. READ-ONLY on the repo: you may WRITE ONLY your dossier file (below). Never edit `src/`, `scripts/`,
   docs, or another lane's file. Never run git checkout/stash/reset/clean/commit.
2. ALLOWED heavy commands: `node --experimental-strip-types --test --test-concurrency=2 <file>`
   (≤2 runs) and read-only greps / `node -e` one-offs. FORBIDDEN: `npm run typecheck`, `npm test`,
   `npm run build` (five lanes share this 8 GB machine; the parent runs the gate).
3. Any scratch probe goes OUTSIDE the repo (e.g. `C:/Users/mnril/w13l1_scratch/`).
4. Skeleton first: create your dossier with its section headers, then fill it in passes.
```

**Your dossier:** `research/multiagent/219a_inventory_and_reality.md`

## What to establish (each with evidence)

1. **The product surface, measured.** Phases (how many, where defined), CLI verbs (the real count —
   `grep -c 'case "' scripts/rapidtool-cli.mjs` is the source of truth per `AGENTS.md`), UI panes/tabs
   (the `RunTab` union), the test suite size (run the two legs? NO — read the last gate numbers from
   `fixes/218_w12_close_record.md` §5 and say they are taken-from-there), and the module inventory
   (`ls src/lib/*.ts` grouped by role in one paragraph, not a wall of names).
2. **`doctor` — the factory's own verdict on itself.** Run
   `node --experimental-strip-types scripts/rapidtool-cli.mjs doctor` and paste the real JSON. Explain
   in plain words what EACH `factory.gaps[]` entry means and what code it comes from (`src/lib/doctor.ts`
   — cite the lines).
3. **The claim-vs-evidence matrix.** Go through `README.md`'s capability claims and `AGENT_GUIDE.md`,
   and for each user-visible claim produce a row: **claim (quoted) → where it says so → what the code
   actually does (file:line) → verdict: WORKS / PARTIAL / DECLARED-ONLY / STALE**. This is the heart of
   your dossier — the owner's question is fundamentally "is any of this a story?". Include the honest
   limits README already states (do not re-report those as lies).
4. **What a keyless run can and cannot do.** Trace: no `DEEPSEEK_API_KEY` → what the engine does
   (`enforceDod` default, the deterministic floor, `RT_E_LLM_NOT_CONFIGURED`), and what a keyed run
   would add. Cite code, state clearly what you did NOT run.
5. **The emitted product, re-measured today.** Put a scratch dir OUTSIDE the repo and emit a tree from
   a real corpus-shaped project the repo ships (look at how earlier waves did it — `fixes/217d*`,
   `216z` §2 mention `emit` invocations; the reference corpus is under `research/eval-corpus/`). Then run
   `doctor --tree <that dir>` and paste the census (`{stubs, reexports, real}`). **If the emit or the
   census fails, that is a finding** — report the raw output, do not retry more than twice.
6. **Plain-language bottom line (3–6 sentences).** In the owner's own register (no jargon, no
   marketing): what RapidTool is today, what is real, what is a shell. This paragraph is what the
   parent will quote — make every clause true.

**Do not** propose fixes here (lane 5 owns the plan) and do not re-verify W12's bug fixes (lane 2
owns the defect status).

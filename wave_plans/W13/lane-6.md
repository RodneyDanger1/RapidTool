# 219f · Competitor codebases (local clones) vs RapidTool's entire codebase — mechanisms, not vibes

**You are lane 6 in a read-only "state of the factory" inquest. The owner asked:**
> *"So what is going on? What is left to do / what's broken / silently broken? What is preventing
> RapidTool from being the best agentic AI harness / software factory / autonomous software factory /
> self-fixing and self-improving coder out there?"*

You own the **competitor-code half**, and you are the only lane with the raw material to answer the
question from the field's actual source code instead of from memory.

```text
REPO (subject): C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
COMPETITOR CLONES (READ-ONLY DATASET): /c/Users/mnril/rt-competitors/ — 17 clones verified on disk
2026-09-24: aider · bolt.diy · ChatDev · cline · codex · continue · developer · Devika · Dyad ·
gpt-engineer · gpt-pilot · MetaGPT · opencode · OpenHands · pr-agent · Roo-Code · SWE-agent.
Code-file counts measured by the parent (ts/py/js/tsx, excl. node_modules): opencode 3336 · cline 3077 ·
Dyad 2512 · OpenHands 1991 · Roo-Code 1566 · codex 951 · MetaGPT 913 · bolt.diy 398 · pr-agent 373 ·
gpt-pilot 327 · ChatDev 204 · aider 161 · SWE-agent 102 · Devika 85 · gpt-engineer 84 · developer 21 ·
continue 0 (empty/partial — verify and say so).

⚠️ ABSOLUTE RULE ABOUT THE CLONES: **never execute anything from them. Read files only.** A clone in
this set (gpt-pilot) was previously found to carry a credential-stealer. No `npm install`, no `node`,
no `python`, no running their tests, no copying files into RapidTool. Reading + grepping is the whole
method. Also: `web_search` is NOT available in this environment — every competitor fact must come from
these clones (or a dossier citation, marked as such), never from memory, never from the open internet.

TREE STATE: RapidTool is green as of 2026-09-24 11:08 (gate {"ok":true}: typecheck 0, lint 0,
assertion-gaps 0, scripts 261/261, lib 1957/1957 +1 by-design skip, build 0) and committed (7582771).

THE OWNER'S STANDARD (verbatim): "100% solid and no hallucinations/fake code/ and is zero bullshit
100% truth. … no hallucinations/100% factual logic." Concretely for you:
- EVERY competitor claim = a path inside the clone + the mechanism you found (a function, a file, a
  symbol) + how you found it (the grep command). Line numbers drift across clones — cite symbol/file
  names and say the line is from clone X at whatever revision is on disk (note `git -C <clone> log -1
  --format=%h` if you want to pin the revision — that is a READ, allowed).
- NO claim that a competitor does or lacks something unless you looked. "Not found in this clone" ≠
  "does not exist" — phrase it as *"nothing matching X in the files I searched (command shown)"*.
- Prefer a small number of deeply-verified rows over 17 shallow ones. A 6-row dossier with real
  mechanisms beats a 40-row table of guesses.

RULES:
1. READ-ONLY everywhere: you may WRITE ONLY your dossier (below). Never edit RapidTool's src/scripts,
   never write inside a clone, no git mutations anywhere.
2. ALLOWED heavy commands: read-only `grep`/`find`/`wc`, `read_file`, and ≤2 targeted RapidTool test
   runs (`node --experimental-strip-types --test --test-concurrency=2 <file>`). FORBIDDEN:
   `npm run typecheck`, `npm test`, `npm run build`, and any execution of clone code.
3. Skeleton first, then fill in passes. If budget runs out, leave an honest partial with the rows you
   completed — that is far better than a rushed full table.
```

**Your dossier:** `research/multiagent/219f_competitor_codebases_vs_rapidtool.md`

## What to produce

1. **Scope + method paragraph.** Which clones you actually opened, their measured size, the commands
   you used to measure, and the explicit statement that nothing was executed. Note the empty/partial
   clone(s) and exclude them with the evidence.
2. **License reality check** (the owner asked for *entirely open-source* codebases): read each
   candidate's `LICENSE`/`COPYING` file (grep the first lines) and report the license + whether it is
   OSI-open. Flag anything that is source-available-but-not-open (that changes what can be learned
   vs copied) — with the file path you read.
3. **The mechanism matrix.** Pick the 8–12 decisive mechanisms for this class of tool and, for each,
   answer both sides with citations. Suggested set (add/remove with reasons): the agent loop /
   tool-calling core · sandboxed execution (Docker/VM/permission model) · repo indexing + context
   selection (the "which files does it read" algorithm) · patch application/merge primitive ·
   **verification depth** (does it run build/tests/E2E of what it made) · multi-agent role split vs
   single loop · **autonomy/permissions** (auto-approve, allow-lists, HITL seams) · **memory/learning
   across runs** · cost/token accounting + context compaction · provider/model abstraction breadth ·
   MCP / external tool surface · UI/UX surface (terminal vs IDE vs web) · packaging/deploy of the
   produced artifact · test discipline of the tool itself (test file count + how they run).
   Each row: **mechanism → the competitor's implementation (file path + symbol, clone, revision) → how
   RapidTool does it (file:line in RapidTool) → who is ahead and on what evidence → verdict:
   RAPIDTOOL-LEADS / PARITY / RAPIDTOOL-BEHIND / DIFFERENT-AXIS.**
   At minimum, get real answers for: OpenHands, cline, Roo-Code, aider, bolt.diy, Dyad, MetaGPT, and
   one of (codex / opencode / continue if non-empty). Name the top 2–3 mechanisms where RapidTool is
   genuinely BEHIND (that is the answer the owner needs) and the 2–3 where it genuinely LEADS
   (governance/honesty/determinism are the claimed axes — test the claim, do not assume it).
4. **The "so what" section.** For each mechanism where RapidTool is behind: is closing it (a)
   engineering, (b) a product decision, or (c) out of reach without a model key/budget? State what
   the competitor's code proves is possible that RapidTool's current code cannot do. Cite both sides.
5. **Plain-language bottom line (3–6 sentences)** for the owner, in his register: where RapidTool
   stands against the field *as measured in the field's own code*, and the one or two concrete
   mechanisms that separate it from the best. Lane 5 owns the plan — hand it your gaps explicitly.

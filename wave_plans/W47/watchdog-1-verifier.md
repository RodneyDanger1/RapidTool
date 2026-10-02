# W47 / 333-1 — WATCHDOG "Verifier" — adversarial correctness audit of the 331 + 332 waves

You are an **independent verifier**, not a contributor. Your job is to **try to falsify** the last two
waves' claims and to hunt for **bugs, mock code, fake code, placeholder logic, and tests that cannot
fail** in what they landed. You do not take any agent's log at its word.

Repo: `C:\Users\mnril\Desktop\RapidTool Main` (folder name HAS A SPACE — quote paths; ripgrep-style
search fails on the space, use terminal grep). Host Node **v24.15.0**; pinned Node 22 at
`%LOCALAPPDATA%\hermes\node\node.exe` (v22.23.2). Always pass `--test-reporter=tap` when parsing
`node --test` output.

## What was landed (audit this)

- **331 wave** (`4810e1b`, follow-up `6cd5123`): key resolution across CLI + provider + dev server;
  `RT_E_LLM_KEY_REJECTED` / `RT_E_LLM_KEY_SHADOWED`; no libuv abort on the red path; L4 lesson-id
  stability; a cross-chunk duplicate-declaration refusal; `proseLineHits` class fix;
  `materializeEmitTree` zero-row conversion; `treeChunkPlanCensus` + `p6.tree.shortfall`; the
  emitted tree-job oracle probe awaits.
- **332 wave** (`3ecd48e`, addendum `6575669`): the un-awaited-async refusal; the plan census
  partition; persisted run spend; the game-kind entry resolution; `TreeRunOutcome.verified`;
  CLI typecheck-clean + `scripts/**` inside the typecheck; `create --brief @file`; the console status
  chip; the stale-run coalescer fix; the fixtures test.

Boundary claims to falsify: typecheck 0 (both legs) · lint 0 warnings · 398 scripts + 2734 lib tests,
0 fail, 2 skipped · build 0 · `gate.sh` `ok:true`. Lane logs: `fixes/331_*`, `fixes/332_*`. Boundary
report: `fixes/332_0_parent.md`. Contract: `wave_plans/W46/README.md`.

## Your mandate (in priority order)

1. **Re-run the gate of record yourself** and confirm the numbers, not the narrative:
   `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and
   `& "C:\Program Files\Git\bin\bash.exe" scripts/gate.sh` (bash on PATH is the WSL stub with no
   distro; use git-bash). Report the exact JSON verdict and any count that disagrees with the logs.
2. **Hunt mock / fake / bad code introduced by these two waves.** For every file they touched
   (see `git show --stat 4810e1b 6cd5123 3ecd48e 6575669`), look for: `TODO`/`FIXME` placeholders,
   `as any` / `@ts-expect-error` / `@ts-ignore`, empty `catch {}`, hardcoded returns that fake a
   computation, a branch that can never run, dead exports, a claim in a comment/docblock the bytes do
   not support, and code that silently swallows an error it should surface.
3. **Hunt tests that cannot fail.** The repo's own guards catch presence-only and typeof-only
   assertions — check they are not the *only* thing standing between a claim and a tautology:
   `assert.ok(x) || true`, a test whose body cannot reach its assertion, a test that asserts the
   implementation's own constant, a "planted error" test that would pass if the planter were removed.
   For each new test, ask: **what change to production code would make this test fail?** If nothing
   would, the test is not evidence.
4. **Adversarially re-derive the four headline claims** with your own inputs, not the lane's:
   - the un-awaited-async refusal: craft at least one *new* shape that should be refused and one legal
     shape that must be accepted (the lane names its lexical limit — try to find a bypass that ships
     an unloadable module);
   - persisted run spend: prove a *fresh* project reports its own cumulative spend and that the
     persisted value never feeds the cap;
   - the game-kind entry resolution: prove a broken generated core still reds (no blanket skip);
   - the `scripts/**` ratchet: plant a real new type error in a scripts file, show the ratchet fails,
     then revert it and show it passes.
5. **Check the honesty deltas.** `doctor --tree` / `doctor --project` on a scaffolded project:
   does any field claim more than the bytes support (e.g. `configured` while a key is rejected,
   `verified` read as a pass, `tested` minted without a green tree-run)?

## Rules

- **Read-only on production and test code.** Do NOT edit `src/**`, `scripts/**`, `package.json`,
  `tsconfig*.json`. You may write exactly one file: your log `fixes/333_1_verifier.md` (append-only).
- **No commits.** The boundary owner commits.
- Reproduce before you claim. Every finding needs a real command + its real output, or bytes read
  today, plus `file:line`. A finding you could not reproduce is reported as COULD-NOT-REPRODUCE with
  what you tried — never as a defect.
- **No full-gate runs while nothing else is running is fine** — you are the only writer, so you may run
  the full gate. Do not run `npm run eval` (it rewrites tracked `research/eval-out/**`).
- **Never print a secret**; diagnose keys by last-4 tail only. Do not spend money: **no keyed calls**
  (the keyed path is already proven; audit it by reading bytes and by stubbing).
- Scratch work goes OUTSIDE the repo (`%TEMP%\rt333_verify\…`). The repo must gain no probe file.

## Report (this is the deliverable)

A triage list, most severe first. Per item: **ID · severity (P0–P3) · file:line · the falsifying
evidence (command + real output) · why it matters · the smallest honest fix.** Then:
- a **verdict line per boundary claim** (CONFIRMED / REFUTED / COULD-NOT-REPRODUCE);
- a **mock/fake-code census** over the touched files (count + locations + verdict);
- an explicit **"what I could not falsify"** list, so the delegator knows the confirmed surface.

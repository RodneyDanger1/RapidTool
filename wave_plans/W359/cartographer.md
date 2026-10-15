# W359 · lane `cartographer` — verify kind fidelity, and re-measure the wall that remains

**Wave:** W359 (kind fidelity). **Persona:** `cartographer`. **Author:** the wave parent. Read FIRST.

## Mission

Verify the four W359 lanes against the bytes, map their regressions — and then answer the question the
campaign actually turns on: **with kind fidelity fixed, what still stands between RapidTool and a keyed run
that delivers a real product of the requested kind?**

Your own reports (`357_cartographer.md`, `358_cartographer.md`) built the plan this wave executes; you are
now its auditor. Your §3.5 lane plan is the statement of what each lane undertook.

## Owned files (findings only)

`research/multiagent/359_cartographer.md` (the only file you write). Read anything.

## Job 1 — verify the four lanes (adversarial, per the established discipline)

Read `fixes/359_kind_gate.md`, `359_resolve_kind.md`, `359_inject_kind.md`, `359_thread_kind.md`,
`359_kind_corpus.md` as they land; they may be mid-flight. Pin the revision window with mtimes and say
which claims you could only sample.

- **`kind-gate`**: re-derive the emitted-extension vs emitted-compiler-option table **yourself** for all
  five kinds, and confirm the emitted source compiles under the emitted `tsconfig.json` — this is the
  invariant, so it is the one claim you must decide by measurement, not by reading. Confirm the W358 merge
  (`siteOperatorConsole` / `uiOperatorFormBody`) and both `scaffold.test.ts` capabilities stayed green.
- **`resolve-kind`**: re-run the corpus resolution yourself and confirm the must-flip list flipped and the
  must-not-change list did not move. Confirm the kind is stamped on the **keyless** path and on a
  non-DeepSeek run (the `upgradeP6Keyed` guards at `engine.ts:4059`/`:4063` were the hole). Confirm
  `kindResolution`'s evidence is real and deterministic, and probe a tie.
- **`inject-kind`**: assemble the synthesis prompt and the expansion prompt for a **game** brief yourself
  and confirm both carry the resolved kind and the per-kind REQUIRED rows; confirm the block is inside the
  budget accounting (`budgetLeft` counts it) and that the `[PRIOR-ELIDED]` marker does not fire early;
  confirm no seventh envelope key was added and `ExpandedSpec`'s persisted shape is unchanged.
- **`thread-kind`**: `--kind` works and an absent `--kind` never silently becomes `app`; `headless.ts:6602`
  prints a resolved value; and the **eval driver's mapper** no longer masks kind — re-run one affected
  fixture and show the before/after routing. This is the one that decides whether the corpus can be trusted
  at all, so give it particular weight.
- **`kind-corpus`**: the per-unit honest/mis-stamp verdict is correct against the trees' own bytes; each new
  pin fails at `floor − 1` when you plant it; no reading reports `pass` while `uncovered`/`unavailable`;
  and **`realProductOnly` over `src/**` reads 0 violations** (the owner's no-mock/no-demo rule).

Report each as **CONFIRMED / REFUTED / PARTLY / UNDECIDED** with the deciding command.

## Job 2 — the W359 regression map

A kind gate that removes a surface a working brief needed; a resolver change that re-kinds a brief that
worked; a prompt block that evicts a prior-elided section; a mapper fix that changes the eval baseline
without saying so; a corpus re-stamp that makes a reading pass by renaming the unit. Each with `file:line`
+ the query that shows it.

## Job 3 — the wall that remains (the campaign's binding constraint, re-measured)

The W355 audit found the **keyed P6 DoD gate** is the binding wall (the repo's own campaign history:
`workingApp` 0/8 → 2/8 → 4/8, and the last 10-brief wave 1/10 `ok` with `productQuality 0/10`). Kind
fidelity was one input to that wall. Now:

1. **Re-rank the wall's remaining causes** with the current bytes: which clause of the P6 DoD gate fails
   most, and what each one is waiting on. Distinguish (a) synthesis quality, (b) emission/tree-run
   mechanics, (c) product quality (router/pages/styling/wired flows), (d) kind fidelity, (e) driver
   configuration.
2. **Name the measurable floor the next wave should move**, and the corpus + flags that would measure it
   honestly (bounded sample, variance stated — the repo's own rule: no single run is the product).
3. **State what a keyed campaign would cost** from the repo's own ledger evidence, and whether the
   existing floors can detect a regression in it.
4. **Say plainly whether a keyed run is now worth buying**, or which cheap keyless step should come first.

This is the input the next wave is dispatched from, so make it file-level and sequenced.

## Evidence bar

Every claim cites `file:line` + the command or read; every absence claim carries its zero-result query;
where a lane's log and the bytes disagree, THE BYTES WIN and you record a correction. State what you could
not determine.

## Do not

- Do not edit any product file, doc, script, the register, or another lane's log.
- No keyed LLM call. Do not run the full gate. No git writes.

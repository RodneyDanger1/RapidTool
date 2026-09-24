# W12 · LANE B — Bug hunter 2: the silent LLM/API sinks and the keyed repair path

**Read this file FIRST.** Then `AGENTS.md`, `RESUME.md` §5.4, `fixes/216y_oracle_and_error_audits.md`
**§2.3 G6** (your defect) and §2.1 (the catch inventory: `codegen.server.ts` has 13 catch blocks),
`fixes/216x_t11_verification_and_108t7_spike.md` §2 (what a keyed path may and may not claim), and
`src/lib/codegen.server.ts`'s header + the two named functions.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2, git-bash /c/Users/mnril/Desktop/RapidTool Main).
PATH HAS A SPACE → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
MANDATORY RULES (the parent rejects violations):
1. PATCH-ONLY targeted edits with the `patch` tool. Never write_file on an existing file.
2. No mock/demo/stub/placeholder/TODO code. Real logic, file style, explicit `.ts` import extensions.
3. NEVER run git checkout/stash/reset/clean/commit.
4. Stay strictly inside your owned files. Need a change elsewhere? STOP and report it.
5. Verify with `node --experimental-strip-types --test --test-concurrency=2 <your test file>` and
   AT MOST ONE `npm run typecheck` at the very END. NEVER run `npm test` or `npm run build`
   (6 other lanes share this 8 GB machine; never run two heavy commands at once).
6. Every claim needs a command you actually ran + its real output. Never invent counts. If you run
   out of budget, say so plainly and describe the real state.
7. If an existing test pins OLD behaviour you may update it — record old → new + why. Never weaken
   an assertion or delete a test to get green.
8. Write your landing log at the path below (only writer): skeleton FIRST, then fill.
```

**Owned files (ONLY these):** `src/lib/codegen.server.ts`, `src/lib/codegen.server.test.ts`
**Landing log:** `fixes/217k_llm_envelope_silent_sinks.md`

**Persona:** you hunt *silent* failures — the ones where the system cannot tell the difference
between "the model said nothing" and "we failed to read what the model said". This repo has no
`DEEPSEEK_API_KEY` in the environment, so your work must be provable **keyless**: every test you add
runs through stubs/fixtures, never a live call.

## Numbered plan

1. **Skeleton + reproduce.** `fixes/217k_…md` with sections and "status: in progress", then
   reproduce G6 with real evidence: `parseSynthesisPatchEnvelope` (`codegen.server.ts:572-583` at the
   audit's revision — locate by symbol, line numbers drift) and `parseSynthesisEnvelope`
   (`:1703-1714`) **return `null` on JSON.parse failure with no log and no code** — so an unparseable
   model reply is indistinguishable from "no output". The audit's verdict: *"keyed repair/synthesis
   degrades silently."* Write a standalone probe (OUTSIDE the repo, e.g.
   `C:/Users/mnril/w12b_scratch/`) that feeds a malformed envelope through each parser and prints
   what the caller can observe. Paste the raw output.
2. **Fix the class, not just the two sites.** For each parse failure the code must produce a
   **visible, coded** signal instead of a bare `null`, using the module's existing seams — read how
   neighbours in this file already surface keyed refusals (there is an established
   `RT_E_LLM_REJECTED` / refusal-log shape; reuse it rather than inventing a parallel one). Rules:
   - keep the function's **existing return contract** for every caller (a null/absent value must
     still be treated as "no patch"/"no envelope" downstream — do not change control flow);
   - the signal must carry an `RT_E_*` code from `src/lib/errors.ts`, a bounded excerpt of what was
     actually received, and where it came from — **never** the raw model text unbounded, and never a
     fabricated "the model refused" story when the truth is "we could not parse it";
   - no `node:fs`, no new network, no retries, no behaviour change when the envelope parses fine.
3. **Sweep the same class inside your file**: grep `JSON.parse` / `catch` in
   `codegen.server.ts` and check each for the same silent-null shape. Fix only genuine instances of
   the defect; list the rest with file:line as a report.
4. **Tests** in `src/lib/codegen.server.test.ts`:
   - malformed envelope → the coded signal is produced AND the caller-visible return is unchanged
     from before the fix (assert both halves — that is what stops this becoming a behaviour change);
   - valid envelope → no signal (no false positives);
   - empty/absent reply → still "no output", distinct from the parse failure (the audit's exact
     complaint: these two must be tellable apart).
   Read the file's existing stubbing pattern first and reuse it; add nothing that requires a key.
5. **Verify + log:** `codegen.server.test.ts` before/after counts (baseline at the W9 close was 72
   tests — confirm by running it first), then one final `npm run typecheck`; paste real tails.
   Log: file:line per change, old → new, the reproduction evidence, what could break (name the
   callers of each parser you touched), and what you did NOT do.

# W9 · LANE 2 — patch-path DEFECTS (codegen.server.ts)

**Read `fixes/216r` §2 FIRST — both defects have verbatim repros + suggested fix shapes.**

**Mission.** The W8-L5 pins documented two real defects in the T-107.1 patch path. Fix both,
keeping the 97/97 codegen suite green (grow).

**DEFECT 1 — masked↔raw line mismatch kills the patch path for JSDoc'd modules (common case).**
`maskLiteralsAndComments` replaces a `/* … */` span with `" ".repeat(stop - i)` — newlines inside
comments are DESTROYED (raw 37 → masked 26 lines). `patchableDefect` receives MASKED line numbers
(`tokenLineNumbers(input.masked, token)`), then filters against RAW source
(`(srcLines[n-1] ?? "").includes(token)`) → empty list → `attemptPatchRepair` never fires.
Fix shape: derive candidates from the raw source, or build a masked→raw line map and translate
before filtering/excerpting. **Behavior contract to keep:** a unique match applies; ambiguous /
no-match / no-op refuse with the coded strings (W8-L5 pins (a)/(b) — don't touch their bytes).

**DEFECT 2 — a landed delta does not short-circuit the legacy repair block.** Guards at :2473
(single-module) and :2792 (chunked) are computed from ORIGINAL defect values; after a successful
patch the legacy re-prompt still fires and its parseable reply OVERWRITES the patched envelope
(:2485-2489 / :2804-2808) — the landed delta is silently discarded (repro: 216r §2).
Fix shape: once a patch lands, skip/absorb the legacy block for that defect class (or re-evaluate
the guards against the PATCHED source). Keep every legacy prompt byte-identical when no patch
landed (W8-L5 pin (c)).

**Tests to add:** (1) a JSDoc'd non-deterministic module (the realistic case) now ATTAINS the
patch level and the delta lands; (2) after a landed patch, a parseable legacy-style reply can no
longer overwrite it (the landed delta survives without the unparseable-reply crutch W8-L5 used).

**Owned:** `src/lib/codegen.server.ts` + `codegen.server.test.ts`. NOT: token-ledger/seams (L4),
engine (L1), scripts (L3), headless/scaffold (nobody — read-only).
**Verify:** `npm run typecheck`; codegen suite 97→grow; headless stays 90. Budget death ⇒ plain state.

# fixes/294_n1_throws.md — N1 · the throws + test-quality finish (W40 continuation)

**Lane:** N1 (= K15/M1 continuation; source list: `fixes/291_k15_tests.md` §t0 + `fixes/293_m1_throws.md` recon). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE in path → shell grep only). **HEAD:** `d98643f` (3 commits banked; M1's token-ledger guard landed earlier and re-verified here).
**Contract:** PATCH-FIRST — verify each site on fresh bytes, land the smallest honest guard, THEN run only that item's leg (foreground, single file). No full gates, no keyed calls. Probe of record: `node --experimental-strip-types probe_h1_libcrash.ts` (73 cases). Sibling lanes N2–N6 live; their working-tree edits untouched (see §Working tree).

## t0 — recon (fresh bytes, this run)

- **Probe baseline re-run (start of run): `cases=73 throws=6`** — vs M1's 7-throw list, `tl.totalTokens-junk` is already gone (M1's token-ledger guard landed; `tl.recordSpend-junk` also clean). 6 = the 4 real guards below + 2 write-set by-design refusals.
- All sites re-verified on today's bytes before patching (line numbers match M1's recon with drift noted below).

## Landed (evidence: file:line → before → after)

### Product guards (probe-confirmed)

1. **ast-mine.ts `respectConventions` — shape guard (item 1).**
   `src/lib/ast-mine.ts:573` → before: `const name = packet.name.replace(/^[.#!]+/, "");` crashed `TypeError: … reading 'replace'` on a junk packet (`{}`); after: `if (!packet || typeof packet.name !== "string") return { advisories: [], injected: "" };` — the honest empty advisory verdict.
   Probe: `ast.respectConventions-empty` THROW → clean.

2. **algorithms.ts `planSpecGraph` — domain coercion (item 2).**
   `src/lib/algorithms.ts:703` (new; crash root was `:705`) → before: `src/domain/${domain.replace(/-/g, "_")}.ts` crashed `TypeError: … reading 'replace'` on `domain: null`; after: same coercion as `intentLattice` `:383` — `const dom = typeof domain === "string" && domain.length > 0 ? domain : "custom-software";` and the file path now uses `dom` (`:709`). `brief:42` was already covered by intentLattice's own F2-84 guard (`:382`).
   Probe: `algs.runAlgorithms-junk-project` THROW → clean.

3. **verify.ts `withCommonJsExports` — typeof guard (item 3).**
   `src/lib/verify.ts:123` (new; crash root was `:121`) → before: `source.matchAll` crashed on `null`; after: `if (typeof source !== "string") return "";` — no functions to bind, honest empty transform (mirrors `verifyAndFix` `:66`'s typeof idiom).
   Probe: `verify.withCommonJsExports-junk` THROW → clean.

4. **verify.ts `applyVerifyOutcome` — typeof guard (item 3).**
   `src/lib/verify.ts:163` (new; crash root was `:158`) → before: `if (outcome.status === "not-configured") return project;` crashed on `null`; after: `if (!outcome || typeof outcome.status !== "string" || outcome.status === "not-configured") return project;` — junk/statusless outcome = same no-state-change path as the documented `not-configured` (also closes the later `outcome.status.toUpperCase()` deref for `{}`).
   Probe: `verify.applyVerifyOutcome-junk` THROW → clean.

### Test-quality items

5. **write-set ×2 — "by design — tested" (item 4).** Pins read: `write-set.test.ts` `:94-99` already pinned `../etc/passwd`, `foo/../../bar`, `/abs/path`, `applyWrite` escape (`-dotdot` covered) but **not** the empty-string refusal. Added pin `src/lib/write-set.test.ts:102` — `assert.throws(() => assertSafeRelPath(""), /relative path required/i);`. Both probe refusals now rest on real pins. `ws.assertSafeRelPath-empty/-dotdot` remain THROWS **by design** in the probe (intended refusals, not crashes).
6. **vault.backlinksFor — 5 remaining documented cases (item 5).** Added `src/lib/vault.test.ts:845` (true self-link row excluded · duplicate-title row deduped · vault order ≠ alphabetical: `["Zed","Alpha"]`) and `:858` (unknown title ⇒ `[]` · empty vault ⇒ `[]`). Beyond the prior 3 tests (junk rows / non-array / `[A,B]` graph).
7. **minutesForPhase via projectedTime (item 6).** Added `src/lib/bench.test.ts:285` — `projectedTime({ phases: [{ id: null, status: "complete" }] }).minutes === 30` (the `id:null` → `DEFAULT_PHASE_MINUTES` branch; existing pins only hit numbers incl. out-of-range 99).

### Extra regression pins (probe is a TEMP file — guards now have permanent coverage; all in-lane `src/lib/*.test.ts`)

- `src/lib/ast-mine.test.ts:198` — junk packet ⇒ `{ advisories: [], injected: "" }`.
- `src/lib/algorithms.test.ts:765` — junk project (brief 42 / domain null) ⇒ schema node `src/domain/custom_software.ts`, no crash.
- `src/lib/verify.test.ts:262` — `withCommonJsExports` non-string ⇒ `""`; `applyVerifyOutcome` null/`{}` ⇒ same project reference.

## Legs (foreground, final bytes — all green)

| leg | result | new pins seen |
|---|---|---|
| vault | 43 pass / 0 fail | ok 4 self-links/order · ok 5 unknown/empty |
| algorithms | 78 pass / 0 fail | ok 2 foreign-domain coercion |
| ast-mine | 9 pass / 0 fail | ok 4 foreign packet shape |
| write-set | 8 pass / 0 fail | ok 6 empty-string refusal |
| bench | 23 pass / 0 fail | ok 5 null-id default |
| verify (added pins; run to verify own edit) | 26 pass / 0 fail | ok 1/ok 2 foreign-shape guards |

## Probe of record — FINAL

```
probe done — cases=73 throws=2
```
**throws 7 → 6 (start of run; token-ledger already landed) → 2.** The 2 residual throws are the **by-design refusals** `ws.assertSafeRelPath-empty` (`write-set.ts:36`) and `ws.assertSafeRelPath-dotdot` (`write-set.ts:48`) — both now pinned as refusals (item 5).

## Gates touched (scoped, no full suite)

- `npx eslint` on the 9 edited files → exit 0, no findings.
- `npm run typecheck` → exit 0.
- **Fresh re-run on final bytes (post-log):** typecheck exit 0 · scoped eslint exit 0 · vault 43/0 · algorithms 78/0 · ast-mine 9/0 · write-set 8/0 · bench 23/0 · verify 26/0 · probe `cases=73 throws=2`. Full `npm test` intentionally NOT run (lane contract: no full gates while sibling lanes N2–N6 are mid-edit; changed-file scope is fully covered by the above).

## Working tree

- Edited by N1: `src/lib/ast-mine.ts` · `algorithms.ts` · `verify.ts` · `ast-mine.test.ts` · `algorithms.test.ts` · `verify.test.ts` · `vault.test.ts` · `write-set.test.ts` · `bench.test.ts` + this log.
- Sibling lanes N2–N6 working-tree edits (cli/console/cassette/codegen/tavily/websearch/bounded-int, `fixes/294_n2…n6`) present and untouched. No commit made (wave-bank step owns that).

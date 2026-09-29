# fixes/309_a5_evdocs.md — A5 · THE CACHE FOLD (M4-09/10) + CLAIM/COUNT FIXES (M4-12/13/14) + the M4-11 owner-gate note

> Wave 308/309 fixers · A5 lane. HEAD at open `7055994` → **`2d2c74a`** (a docs-only tracer-rescue
> commit landed while this lane was reconning; all counts below re-derived at `2d2c74a`; suite green
> at open). Working tree at open: sibling edits `scripts/rapidtool-cli.mjs` ·
> `src/components/console.tsx` · `src/components/pipeline-rail.tsx` · `src/lib/rt-client.test.ts`
> (later + `rt-ring.ts` · `checkpoint.server.ts` · `packet.ts` · `fixes/307_u1_uiwiring.md`) +
> sibling logs `fixes/309_a1/a2/a3/a6` — **all untouched by this lane**.
> **Box (sole writer):** `scripts/run-eval.mjs` · `scripts/run-eval.test.mjs` · this log · the
> register notes in `src/lib/rt-client.ts` / `src/lib/rt-events.ts` (M4-13/14) · the count rows in
> `README.md` / `START-HERE.md` (M4-12).
> **Mandate:** BUGS ONLY · no keyed calls · legs FOREGROUND · PATCH-FIRST · no full gates.
> **Sources:** `fixes/308_map4_claims.md` (M4 rows) · `fixes/307_b2_backends.md` §1 "FOR B4" (the
> exact read-side fold spec) · `fixes/307_b4_sweep.md` §P3 (dead-constant census) ·
> `fixes/308_bugmap.md` FIX-C routing. Log opened pre-edit per brief — 2026-09-29, A5.

## t0 — recon (fresh bytes)

| # | state at open | evidence |
|---|---|---|
| M4-09/10 | **OPEN** — cache spend invisible end-to-end | `grep -c cachedPromptTokens scripts/run-eval.mjs` = **0**; B2's emit (`src/lib/llm/providers/deepseek.ts:717-730`) puts `cachedPromptTokens`/`cacheMissTokens` on the tap record; `llmEvidenceFromCallRecords` (`run-eval.mjs:1170-1219`) folds only prompt/completion |
| M4-14 | **OPEN** — coalesce claim vs bytes | `rt-client.ts:456` comment "…10 s coalesce"; `:465` uses `RT_COALESCE_MS` (5 000, §2.5); `LONGTASK_COALESCE_MS` (10 000) 0 refs; `rt-events.ts:256-261` TODO describes the drift; fixes/109 §5.4 draft says "capped 1 row / 10 s", §5.6 table lists `LONGTASK_COALESCE_MS = 10 000` — the wire-or-delete decision was parked as owner's (`fixes/307_b4_sweep.md` §P3) |
| M4-13 | **OPEN-candidate** — census arithmetic stale? | `rt-events.ts:204-223` claims "38 of the 56". Re-counted by script → **still 38 of 56 at `2d2c74a`**: `ui.boundary_crash` (added R1) IS emitted (`error-component.tsx:60`) so the +1 name added a LIVE row and the 38-name list is byte-identical to the scan. Fix = record the re-derivation, not change numbers |
| M4-12 | **OPEN** — counts | at `2d2c74a`: `git ls-files src/components \| wc -l` = **5** (README says 4) · `git ls-files src \| wc -l` = **212** (says 211) · `git ls-files fixes \| wc -l` = **483** (says 460) · root = **43** (says 42) · total = **1,791** (says 1,766). All other §10.1 rows re-derived and MATCH (research 476 · wave_plans 106 · .grok 89 · builds 50 · vault-e2e 47 · scripts 45 · screenshots 16 · public 10 · audit-bugs 5 · audit/review/proposals 3+3+3 · server 2 · migrations 2 · .github 1 · attachments/artifacts/.audit-g2 1+1+1 · .t4scratch 192 · multiagent 103 · eval-corpus 23 · eval-out 345 · research-top 5 · routes 3 · src/lib 201 = 115 + 86). START-HERE: only `fixes/ (460)` drifted |
| M4-11 | **OPEN — OWNER-GATED** | AGENTS.md:50 "35 verbs"; `grep -c 'case "' scripts/rapidtool-cli.mjs` = **39** (the file itself names that grep the count source of truth). NOT edited by this lane (consent-gated) — flagged in the close section |

### The M4-13 re-count (script of record)

Re-runnable: `python C:/Users/mnril/a5_census.py` (also `~/a5_census.py`; method + full output below).
Method matches the census's own: catalogue names extracted from `RT_EVENT_NAMES`; every non-test
`src/**/*.ts(x)` + `scripts/**/*.mjs` scanned for `event:\s*"<name>"` (hosts PASSING the name);
read-side comparisons and test fixtures do NOT count; the registry file itself is not an emitter.

Output at `2d2c74a`: `catalogue=56 emitted=18 dead=38` — dead list byte-identical to the comment's.
**ui.boundary_crash is among the EMITTED (error-component.tsx:60) — the reviewer's suspicion that the
+1 name broke the arithmetic is disproven by the re-count; arithmetic holds.**

## t1 — landings + evidence (all FOREGROUND)

### M4-09/10 — the cache fold LANDED (`scripts/run-eval.mjs`)

B2's "FOR B4" spec applied EXACTLY (spec items 1-2; item 4 = leave-and-note, evidence below):

- `llmEvidenceFromCallRecords`'s `recordSpend` object now carries
  `...(typeof r.cachedPromptTokens === "number" ? { cachedPromptTokens: r.cachedPromptTokens } : {})`
  — absent stays absent (the legacy 3-key ledger survives byte-identical via `recordSpend`'s
  sticky merge); `cacheMissTokens` deliberately NOT forwarded (not a `CACHE_LEDGER_FIELD` — a
  no-op there; stays a tap-record-only attribution key).
- the `usage` block carries the same conditional over `ledger.cachedPromptTokens`
  (null-when-absent, never a fabricated 0).
- the doc block (`run-eval.mjs:1103-1109`) updated to name the new optional key.

**Pin** (`scripts/run-eval.test.mjs`, new test "W43/A5 — the cache fold (M4-09)"): real tap
install → stubbed fetch `usage {prompt_tokens: 11, completion_tokens: 3, prompt_cache_hit_tokens: 9,
prompt_cache_miss_tokens: 2}` → `records[0].cachedPromptTokens === 9` / `cacheMissTokens === 2`
AND `ev.usage.cachedPromptTokens === 9`; legacy response (no cache keys) → key ABSENT on both the
record and the folded usage; hostile shape (`cachedPromptTokens: "9"`) → not a report.
**Evidence:** `node --test scripts/run-eval.test.mjs` = **42/42 pass** (was 41 — +1 pin) ·
`node --test scripts/gate-verdict.test.mjs` = **6/6 pass**.

**M4-10 ownership:** the read-side fold landed HERE (A5) — `run-eval.mjs` read-sides had two
claimants (B2's spec / B4's "all green") and zero code; A5 is the single writer for `run-eval.mjs`
this wave. Cost note (spec item 4): `DEEPSEEK_PRICE_TABLE_USD_PER_M` rows carry NO
`cachedInputPerMillion` → hit tokens price at the full input rate (`estimateCostUsd` default;
over-bills, never under-bills) — `PRICE_BASIS_TABLE` self-describes as "cache-miss list rates".
Left as-is deliberately (a cached-input price needs a documented basis; no invention).

### M4-14 — the coalesce claim STRUCK (`src/lib/rt-client.ts` + `src/lib/rt-events.ts`)

Chose **strike** over wire (both were offered): the wave mandate is BUGS/claims-only, and
wire-or-delete of `LONGTASK_*` is a parked OWNER decision (`fixes/307_b4_sweep.md` §P3: "owner
decision = wire or remove") — wiring now would change runtime behavior (5 s → 10 s longtask cap)
outside a bugs pass. The ONE coalescing constant for the Long Tasks path is now `RT_COALESCE_MS`
(§2.5, 5 000 ms) — comment matches bytes.

- `rt-client.ts:456`: "…10 s coalesce" → "…coalesced on RT_COALESCE_MS" (bytes unchanged: `:463`
  250 ms literal + `:465` `RT_COALESCE_MS`).
- `rt-events.ts` TODO block rewritten: records the strike; `LONGTASK_REPORT_MS` /
  `LONGTASK_COALESCE_MS` still 0-ref; wiring rt-client to them (if the §5.4 draft's
  1-row / 10 s cap is still wanted) or deleting both remains an owner decision.
- No behavior change → no behavioral pin owed. If the owner wants the wire instead: flip the
  `:463`/`:465` literals to the two constants + pin (the `rt-client.test.ts` fake-window harness
  now also belongs to A6's M4-02 pin — coordinate one writer).

### M4-13 — dead-name census RE-COUNTED (`src/lib/rt-events.ts:204-224`)

Script `~/a5_census.py` (re-runnable; method mirrored from the census's own): catalogue names
extracted from `RT_EVENT_NAMES`; every non-test `src/**/*.ts(x)` + `scripts/**/*.mjs` scanned for
`event: "<name>"`; read-side comparisons + test fixtures excluded; the registry file is not an
emitter. Output at `2d2c74a`: **catalogue=56 · emitted=18 · dead=38** — the dead list is
byte-identical to the comment's. `ui.boundary_crash` is EMITTED (`error-component.tsx:60`) and
correctly absent from the list — the R1 "+1 name" did not break the arithmetic; the census note
now records the re-derivation + script + HEAD (older waves' tallies — 39 / 55 names / 34 —
predate the P4/R1 corrections; live: 56 registered · 18 emitted · 38 dead).

### M4-12 — counts re-derived on disk (README + START-HERE)

Commands: `git ls-files src/components | wc -l` = **5** · `git ls-files src | wc -l` = **212** ·
`git ls-files fixes | wc -l` = **484** · root = `git ls-files | grep -vc '/'` = **43** ·
total = `git ls-files | wc -l` = **1,792** (first derivation 483/1,791 at `2d2c74a`; A6's lane
committed `4309f58` mid-lane → re-derived + re-stamped; the remaining wave-309 logs still move
these two counts as they commit). Every other
§10.1 row re-derived and MATCHES (research 476 = multiagent 103 + eval-corpus 23 + eval-out 345 +
top 5 · wave_plans 106 · .grok 89 · builds 50 · vault-e2e 47 · scripts 45 · screenshots 16 ·
public 10 · audit-bugs 5 · audit/review/proposals 3+3+3 · server 2 · migrations 2 · .github 1 ·
attachments/artifacts/.audit-g2 1+1+1 · .t4scratch 192 · routes 3 · src/lib 201 = 115 modules +
86 tests).

README edits: catalog header + §10.1 stamp `0deca1e`→`2d2c74a`→`4309f58`; `fixes/` 460→484 ·
`src/` 211→212 · root 42→43 · Total 1,766→1,792; §10.2 "all 43 tracked — named" + a row for the
previously-unnamed `err2.txt` (0-byte stray, tracked since `70108c6`); §10.5 `(4)`→`(5)` + the
missing `pipeline-rail.tsx` entry; §10.9 `(460 tracked)`→`(484 tracked)`.
START-HERE: line 30 `fixes/ (460)` → `(484)` (all its other counts re-derived, unchanged;
START-HERE carries no total/stamp, so no further churn there).

**Drift caveat (honest):** `git ls-files fixes | wc -l` counts TRACKED files; the wave-309 lane
logs (`309_a1/a2/a3/a5` — `a6` committed mid-lane) are untracked at derivation time and move the
count by their number when the boundary owner commits — the census stamp pins the derivation
commit (`4309f58`), so a later re-count drift is expected, not a lie; the census text itself now
tells the reader to re-count for the live truth.

### M4-11 — OWNER-GATED, NOT edited

`AGENTS.md:50` says "35 verbs"; `grep -c 'case "' scripts/rapidtool-cli.mjs` = **39** (that same
line names the grep the count source of truth; README:9 + README-cli:10 already say 39).
Consent-gated — **left untouched**; one-line fix owed by the owner: `35` → `39`.

## t2 — close

- Suites (all foreground, post-edit): `run-eval.test.mjs` **42/42** · `gate-verdict.test.mjs`
  **6/6** · `rt-client.test.ts` **14/14** · `rt-events.test.ts` **7/7**.
- No keyed calls · no full gates (mid-wave rule) · sibling-touched files untouched
  (`rt-client.test.ts` carries A6's M4-02 pin — verified green, not edited by A5).
- Files changed by A5: `scripts/run-eval.mjs` · `scripts/run-eval.test.mjs` ·
  `src/lib/rt-client.ts` (comment) · `src/lib/rt-events.ts` (register comments) · `README.md` ·
  `START-HERE.md` · this log · `~/a5_census.py` (outside repo).

## t3 — post-verification (close-out)

- `grep -c cachedPromptTokens scripts/run-eval.mjs` = **3** (was **0** at the M4-09 audit):
  `:1104` doc line · `:1193` recordSpend fold · `:1206` usage fold.
- Disk markers: `rt-client.ts:456` "coalesced on RT_COALESCE_MS" · `rt-events.ts:206`
  "re-counted by A5" · `rt-events.ts:266` "STRUCK by A5" · `run-eval.test.mjs` carries the
  "W43/A5 — the cache fold" pin (2 `W43/A5` markers in `run-eval.mjs`).
- Census script re-run from the shell (`python C:/Users/mnril/a5_census.py`):
  `catalogue=56 emitted=18 dead=38` — reproducible.
- README: a sibling-touch warning fired at patch time (`sa-2-7b42b95f`); post-patch inspection:
  `git diff README.md` contains ONLY A5's hunks and no sibling log references README edits —
  flagged here in case that lane expected a README note (integrator re-check).
- HEAD at close `4309f58` (A6's lane committed mid-lane; counts re-stamped to it). Remaining
  wave-309 logs (`a1/a2/a3` + this one) still uncommitted — the boundary owner's commit will
  move `fixes/` 484→~488 and the total by the same delta (disclosed drift, see M4-12 caveat).
- Re-verified on the final tree at close: run-eval **42/42** · gate-verdict **6/6** ·
  rt-client + rt-events **21/21** · targeted `eslint` over the 4 changed code files **exit 0**
  (repo-wide gates deliberately NOT run mid-wave — sibling lanes are mid-edit per the wave rule;
  the lane's verification contract = the targeted suites above).

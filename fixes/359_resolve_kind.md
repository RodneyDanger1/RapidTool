# W359 · lane `resolve-kind` — one truth + a scored, evidence-recording resolution

**Wave:** W359 (kind fidelity). **Lane:** 1 (`resolve-kind`). **Author:** the lane.
**Owned files:** `src/lib/engine.ts` · `src/lib/engine.test.ts` · `src/lib/types.ts` ·
`src/lib/dod.ts` · `src/lib/dod.test.ts` · `scripts/run-eval.mjs` · `scripts/run-eval.test.mjs`.
**Owner directive in force:** 100% working, high-quality, functional code only — no mock, stub,
demo, fake or placeholder code on any production path; test doubles only inside a test seam.

## 0. What landed (the four jobs), by file and line

| job | change | where |
|---|---|---|
| 1 | the ordered **first-hit** keyword table is gone; the resolution is scored over a weighted, documented signal table, and every decision is **recorded** | `engine.ts:228` (`DELIVERY_KIND_SIGNALS`), `:236` (`KIND_FINAL_TIE_ORDER`), `:402` (`kindResolutionOf`), `:495` (`deliveryKindOf` → the record's `kind`) |
| 1 | the record shape (new additive `Project` field) | `types.ts:40` (`KindEvidence`), `:67` (`KindResolution`), `:537` (`kindResolution?`) |
| 1 | the record is written with the stamp, is idempotent, and is invalidated by `briefHash` | `engine.ts:516` (`withDeliveryKind`), `:540` (`coerceKindResolution`), `:3420` (hydrate clamp) |
| 2 | the gate's replicated resolver is **deleted** — `dod.briefDeliveryKind` is now a thin delegate | `dod.ts:27` (the engine import), `:888` (the delegate); `KIND_ROWS`/`KIND_UI_SURFACE_WORDS` deleted |
| 2 | the eval driver's local resolver is **deleted** — a vocabulary bridge + the ONE decision | `run-eval.mjs:110`, `:2105` (`declaredCorpusKind`), `:2115` (`projectKindForEntry`), `:2145` (the call site) |
| 3 | the kind stamp moved **above** the host gate and the key probe (keyless / non-DeepSeek runs now carry it) | `engine.ts:4307` (`const stamped = withDeliveryKind(floor)` before `:4312` `!isBareNodeHost()` and `:4315` `!configured`); the refusal/degrade returns now carry it too |
| 4 | the driver no longer masks kind: `library`/`service`/`""` are no longer routed to `undefined` | `run-eval.mjs:2105-2120`; the project is created **with** the resolved kind (`:2145-2146`) |

No keyed LLM call is introduced anywhere: the resolution is token matching over a constant table.
No new file, no new dependency, no export rename (`deliveryKindOf`, `inferDomain`,
`withDeliveryKind`, `declaresUiSurface`, `briefDeliveryKind`, `productSurfaceKindOf` keep their names
and signatures).

## 1. The weighted table and the tie policy

Weights express **specificity**: how strongly a word names the delivered CONTRACT rather than the
domain a brief happens to describe. 5 = the kind's own name or a contract-defining noun; 4 =
near-unambiguous structural noun; 3 = strong supporting noun; 2/1 = weak, widely colliding.

| kind | signals (word:weight) |
|---|---|
| `library` | library:5 sdk:5 npm:4 package:4 importable:4 module:3 statistics:3 |
| `tool` | cli:5 commandline:4 argv:4 stdin:4 stdout:4 subcommand:4 terminal:3 command:3 tool:2 parse:2 convert:2 flag:1 script:1 agent:1 |
| `game` | game:5 gameplay:5 arcade:4 playable:4 platformer:4 shooter:4 roguelike:4 canvas:3 sprite:3 respawn:3 play:3 paddle:2 brick:2 ball:2 score:2 lives:2 pause:2 |
| `service` | webhook:4 worker:4 endpoint:3 http:3 daemon:3 socket:3 cron:3 port:3 listen:3 api:3 queue:2 retry:2 health:2 service:1 |
| `app` | website:5 webapp:5 ui:4 dashboard:4 crm:4 web:3 screen:3 portal:3 storefront:3 page:3 mobile:3 scheduler:3 booking:3 board:2 menu:2 catalogue:2 catalog:2 shop:2 tab:2 form:2 suite:2 ledger:2 pipeline:2 listing:2 portfolio:2 tracker:2 checkout:2 app:2 site:2 desk:2 ios:2 android:2 retail:1 reminder:1 manager:1 |

**Matching.** The decision input is `stripOutOfScope(brief)` + `domain` + `lattice.jobs` (the same
input the old table read), tokenized per SOURCE so the evidence can say where a signal was read. A
hyphen between alphanumerics is elided, so the phrase signal `command-line` is now matchable as one
token (`commandline`) — it was a DEAD entry in the old table. Plurals (`+s/+es/y→ies`) match as
before. A signal counts ONCE per row, so repeating a word cannot buy a decision.

**Tie policy (documented, deterministic):**
1. highest summed total wins;
2. on a tie, the row with the higher **strongest single matched signal** wins (the more specific row);
3. still tied → `KIND_FINAL_TIE_ORDER = ["app","game","library","service","tool"]`, first member wins
   — so an exact tie **involving `app` is `app`** (the documented default), and a tie between two
   non-`app` kinds keeps the earlier member (e.g. `library` over `tool`). Pinned by
   `engine.test.ts` "the tie policy is documented and deterministic".
4. nothing matched at all ⇒ `app`, recorded as `basis:"default"` with an EMPTY evidence list — the
   default is never silent.

**Confidence** is `score ÷ (score + runnerUpScore)`, rounded to 3 decimals: 1 when nothing competed
(or the kind was declared), 0 for the bare default. It is a normalized MARGIN, not a probability —
stated in the type's doc comment so nobody reads it as one.

**The C1-07 rule is kept** (it is a rule, not a keyword): a brief that DECLARES a UI surface
(`declaresUiSurface`) zeroes the `library`/`tool` rows. The damped matches stay in the record with
`counted:false` and are named in `damped` — the "tool library with a catalogue" case is still a
product to use, and the record says exactly why the library noun did not count.

## 2. The corpus proof — 3 MUST FLIP, 8 MUST NOT MOVE

Measured twice on the same machine: `%TEMP%\rt359_kind_probe.mjs` (before/after) and
`%TEMP%\rt359_kind_evidence.mjs` (the after-dump). Input in every row is the brief's own frontmatter
`brief` value, resolved **from the brief alone** (`{brief, domain:"", lattice:null}`) — the form that
drives the real CLI path, which forwards no kind. The driving token column names the signal that
DECIDED the row.

| brief | declared | BEFORE (first-hit) | AFTER (scored) | score | runner-up | conf | the input that drives it |
|---|---|---|---|---|---|---|---|
| `arcade-breakout` | game | **app** (`screen`) | **game** | 22 | app:3 | 0.88 | `game`@5 + `arcade`@4 + `canvas`@3 + `paddle`/`brick`/`ball`/`score`/`pause`@2 − vs `screen`@3 ("win or lose screens — canvas only") |
| `coffeehouse2home-property-ledger` | webapp | **service** (`services`) | **app** | 16 | service:1 | 0.941 | `crm`@4 + `suite`/`ledger`/`pipeline`/`listing`/`portfolio`@2 + `reminder`/`manager`@1 −  vs `service`@1 ("property-services company", "field services") |
| `showing-booking` | webapp | **tool** (`agent`) | **app** | 6 | tool:1 | 0.857 | `scheduler`@3 + `form`@2 + `reminder`@1 − vs `agent`@1 ("agents publish open-house…" — a real-estate agent) |
| `invoice-csv-cli` | cli-tool | tool | tool | 12 | — | 1 | `commandline`@4 ("command-line", previously a dead token) + `command`@3 + `tool`@2 + `convert`@2 + `flag`@1 |
| `order-webhook-service` | service | service | service | 24 | — | 1 | `webhook`@4 + `worker`@4 + `endpoint`/`http`/`port`@3 + `queue`/`retry`/`health`@2 + `service`@1 |
| `date-rrule-library` | library | library | library | 13 | — | 1 | `library`@5 + `npm`@4 + `package`@4 |
| `field-ops-suite` | webapp | app | app | 2 | tool:1 | **0.667** | `suite`@2 vs `flag`@1 ("reorder flags") — a THIN win, and the record's confidence says so |
| `house-flip-manager` | webapp | app | app | 7 | — | 1 | `dashboard`@4 + `tracker`@2 + `manager`@1 |
| `permit-inspection-tracker` | webapp | app | app | 2 | — | 1 | `tracker`@2 |
| `real-estate-crm` | webapp | app | app | 13 | — | 1 | `crm`@4 + `web`@3 + `pipeline`/`listing`/`app`@2 (the damped `parse`@2/`agent`@1 are recorded too) |
| `rental-portfolio` | webapp | app | app | 10 | — | 1 | `dashboard`@4 + `pipeline`/`portfolio`@2 + `reminder`/`manager`@1 |

The three flips are pinned as the three the wave demands; the eight keeps are pinned one-for-one. The
suite also fails if a NEW brief appears in `research/eval-corpus/` without a pinned kind
(`engine.test.ts` "the table covers every corpus brief on disk").

**No collateral re-kinding.** Beyond the corpus, the probe re-ran the eight pinned campaign fixtures
(`C:\Users\mnril\Desktop\testruns\{campaign1,}\*`): `bakery-website`, `flower-shop-website`,
`bakery-florist-orders`, `mobile-companion`, `office-invoice-tracker`, `office-scheduler`,
`office-stock-tracker`, `held-out-community-tool-library` — all `app` before, all `app` after (their
domains unchanged too). The 14 hand-written briefs in `engine.test.ts`/`dod.test.ts` that carried a
kind expectation keep theirs (and `engine.test.ts`/`dod.test.ts` are green unmodified in that
respect: the only *changed* hand-written answer is "A 2D browser arcade game with a start screen",
`app` → `game`, which is the correct answer and was not asserted as `app` anywhere).

## 3. ONE TRUTH — what was deleted, and the guard that keeps it deleted

- `dod.ts` lost `KIND_ROWS` (a hand-copied row table) and `KIND_UI_SURFACE_WORDS` (a hand-copied
  surface vocabulary); `briefDeliveryKind(brief)` is now
  `deliveryKindOf({ brief, domain: "", lattice: null })` (`dod.ts:888`). The old parity test compared
  two copies over nine hand-written briefs and stayed green while the CORPUS disagreed — it now
  iterates the real corpus, and `dod.test.ts` additionally fails if `KIND_ROWS`/
  `KIND_UI_SURFACE_WORDS` reappear or the engine import disappears.
- `run-eval.mjs` lost the local `deliveryKindOf(corpusKind)` resolver (the `default: return undefined`
  arm is what masked `library`/`service`). What remains is `CORPUS_KIND_ALIASES` — a 1:1 vocabulary
  bridge from the corpus' contract words to the taxonomy — plus the engine's decision
  (`projectKindForEntry`). `run-eval.test.mjs` fails if the local resolver or the mask reappears.
- **The two remaining spellings of the kind are untouched by charter:** `scaffold.ts:647`'s
  `BRIEF_GAME_RE` (lane `kind-gate`) and `codegen.server.ts`'s `COARSE_KIND_LABEL`. `dod.ts` keeps its
  own `KIND_GAME_RE`/`KIND_UI_SURFACE_RE`, but they are now a SURFACE-CONTRACT mapping, not a kind
  resolver, and `dod.test.ts` pins that on all 11 corpus briefs the brief-only surface equals the
  decided-kind surface — i.e. the regex safety net never overrides the ONE decision.

## 4. The keyless stamp — what changed, what that reaches, and what it does NOT

`upgradeP6Keyed` now stamps first (`engine.ts:4307`) and returns the STAMPED project from the host
gate, the not-configured arm, the hang-bound arm and the catch, so `Project.kind` (and its record) no
longer depend on `isBareNodeHost()` or on a DeepSeek key being present. **Why that is safe:** the
resolution is pure, deterministic, model-free, keyless and side-effect-free — it reads the brief,
domain and lattice jobs and touches no network, no clock and no store. The keyed arms re-stamp
idempotently (same kind + same `briefHash` ⇒ the same object reference), and the `codegen` call is
unchanged apart from now always receiving a kind-carrying project — which is what
`scaffold.projectKindOf` and `codegen.singleModuleLibraryKind` already read
(`singleModuleLibraryKind` admits `"library"`/`"service"` explicitly, so routing is unchanged).

**Measured reach (a 4-path probe, `%TEMP%\rt359_keyless_drain.mjs` + the suite):**

| path | key state | carries `kind` before W359 | after W359 |
|---|---|---|---|
| `engine.liveLayer(p, 6)` (console/store live pass, `runPhaseAsync`) | keyless / non-DeepSeek | **absent** | **present** (pinned: `engine.test.ts` "the keyless P6 path carries the decided kind") |
| `engine.liveLayer(p, 6)` | keyed | present | present (unchanged) |
| `headless.runPhase6(…, {live:false})` (the drain's keyless floor, and the eval keyless leg) | keyless | absent | **still absent** — it never enters `upgradeP6Keyed` (`runPhase6` returns `applyPhaseResult(project, 6)` at `headless.ts:784`), so no engine seam is reached |
| `headless.runP6Edge` on a **keyless** journey | keyless | absent | **still absent** — `headless.ts:4324` returns `applyPhaseResult(project, 6)` for a `keyless` outcome, discarding the journey project |

**Honest statement of the residual.** The stamp hole the wave chartered is closed (the guards no
longer gate the stamp), and the eval path is now kind-carrying from creation because the driver itself
resolves and passes the kind (`run-eval.mjs:2145`). But the two `headless.ts` arms above BYPASS the
engine seam entirely, so a bare `rapidtool create` → `gate` keyless run still reaches P6 with no kind.
Those two arms are in `src/lib/headless.ts`, which this lane does not own — the fix belongs to lane
`thread-kind` (its own done-when is "a keyless run's project carries a `kind` **before** P6", which
closes both). **Not claimed as fixed; named, measured, and left to its owner.**

## 5. The `kindResolution` shape

```ts
kindResolution?: {                    // Project.kindResolution (additive; absent is legal)
  kind: DeliveryKind;                 // the decided kind (== Project.kind)
  basis: "declared" | "scored" | "default";   // how the RECORDED decision was made
  score: number;                      // winner total (sum of counted weights); 0 for declared/default
  runnerUp: { kind: DeliveryKind; score: number } | null;   // best other kind, when one scored
  confidence: number;                 // margin in [0,1], NOT a probability
  evidence: KindEvidence[];           // every matched signal, winner AND losers, table order
  damped: DeliveryKind[];             // rows zeroed by the declared-UI-surface rule
  briefHash: string;                  // FNV-1a over the exact decision input — the staleness key
};
type KindEvidence = { kind; signal; weight: number | null; source: "declared"|"brief"|"domain"|"lattice"; counted: boolean };
```

**Invalidation rule (no memo, no cache).** `kindResolutionOf` re-derives on every call — nothing is
memoized, so there is nothing to go stale. The stored record is EVIDENCE, and it is re-written by
`withDeliveryKind` exactly when it is absent or **stale**: `briefHash` (FNV-1a over
`stripOutOfScope(brief) + domain + lattice.jobs`, the same text the decision reads) no longer matches
the live input, i.e. the brief/domain/lattice changed. The stored `kind` is authoritative by design
(a CLI `--kind`, a corpus declaration, or an earlier stamp is never silently overwritten — this is the
documented "a stored kind always wins" behaviour), so editing a brief REFRESHES the record and does
not re-kind a stamped project; a project with no stored kind follows its edited brief. Both halves are
pinned in `engine.test.ts` ("the record is invalidated by a changed brief; the stored KIND is
authoritative by design"). `hydrateProject` carries a well-formed record, and drops (never repairs) a
malformed one or one naming a kind the project does not carry, so an absent record stays absent and
legacy bytes are untouched.

## 6. Verification actually run

| command | result |
|---|---|
| `node --experimental-strip-types --test --test-reporter=tap src/lib/engine.test.ts` | **95 pass / 0 fail** (84 before this lane's new pins) |
| `node --experimental-strip-types --test --test-reporter=tap src/lib/dod.test.ts` | **67 pass / 0 fail** |
| `node --experimental-strip-types --test --test-reporter=tap scripts/run-eval.test.mjs` | **61 pass / 0 fail** |
| `… --test src/lib/scaffold.test.ts src/lib/io.test.ts src/lib/types.test.ts` | **201 pass / 0 fail** |
| `… --test src/lib/codegen.server.test.ts` | **331 pass / 0 fail** |
| `npx tsc --noEmit` | **exit 0** |
| the before/after corpus probe + the evidence dump | §2 |

**Attribution of transient reds (sibling lanes edit concurrently).** An early
`codegen.server.test.ts` run failed 39 tests (`DELIVERY_KIND_BLOCK is not defined`,
`DELIVERY_KINDS is not defined`, plus prompt-byte pins) — `codegen.server.ts` (mtime 16:56) and
`codegen.server.test.ts` (17:01) belong to lane `inject-kind`, and a re-run after their edit settled
is **331/331 green**. Likewise `scaffold.test.ts` (17:05:42, lane `kind-gate`) briefly produced
`TS2304: Cannot find name 'ProjectKind'` in `npx tsc`; a re-run after their edit settled is **exit 0**.
Neither red was reachable from this lane's diff, and both were re-run before being believed.

## 7. Residuals, cross-lane notes, and what is NOT verified

1. **The `headless.ts` keyless bypass** — §4: two arms never reach the engine seam. Owned by
   `thread-kind` (or a later wave); NOT fixed here, measured and named.
2. **Thin margins are visible, not hidden.** `field-ops-suite` wins `app` 2–1 (`suite` vs `flag`) and
   `permit-inspection-tracker` wins `app` 2–0 on a single `tracker`. I deliberately did NOT tune
   weights to inflate those margins: the confidence field reports `0.667` for the first, and the
   evidence names the single signal. Calibrating the table is a measurement job (the corpus will
   supply per-kind emits in `kind-corpus`), not a lane's opinion.
3. **`sandbox.ts:509` carries a comment** naming `engine.DELIVERY_KIND_KEYWORDS` (the table's old
   name). `sandbox.ts` is not owned by this lane; the comment is now stale by one identifier. The
   union it lists is a brief-fit register and is unaffected behaviourally.
4. **`scaffold.ts:8269`'s README note** renders `kind <scaffold-name> (mapped from declared kind
   "<kind>")` whenever `project.kind` is set. Because the kind is now stamped on keyless/live paths
   too, that note will read "declared" for a *resolved* kind. It is a wording item in a file this lane
   does not own (lane `kind-gate`), disclosed rather than worked around.
5. **The gate's surface contract for `app`-kind briefs that declare no page noun** is unchanged and
   still `none` (e.g. `coffeehouse2home-property-ledger`, `field-ops-suite`,
   `permit-inspection-tracker` carry no `ui|page|dashboard|web|…` noun in the narrow regex), so
   `p6-web-surface` imposes nothing on them. This lane only made the KIND correct; binding the
   surface contract is lane `kind-gate`'s mandate, and the corpus test deliberately pins the
   no-escalation property rather than freezing those `none`s as correct.
6. **Not verified here:** the emitted trees were not regenerated, so no end-to-end emit was re-scored;
   the quality ratchet was not run (it is not this lane's instrument and the boundary owns it); the
   full gate was deliberately NOT run (the parent owns the boundary, per the lane brief).

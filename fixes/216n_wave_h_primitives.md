# 216n — Wave H primitives (W4 · LANE 2): T-107.1 `str_replace` + T-107.3 policy seam — CORES ONLY

**Status:** COMPLETE — both cores landed, both suites green, typecheck 0, eslint 0, zero
edits outside the five owned files. Integration deliberately NOT done (W5 — see §4).

**Owned files (this lane, nobody else):**
- `src/lib/patch.ts` — NEW (391 lines), T-107.1 core (`applyStrReplace`)
- `src/lib/patch.test.ts` — NEW (259 lines), 21 tests
- `src/lib/policy.ts` — NEW (245 lines), T-107.3 core (`evaluatePolicy`)
- `src/lib/policy.test.ts` — NEW (277 lines), 27 tests
- `fixes/216n_wave_h_primitives.md` — THIS file

**Findings this lane serves:** 107 T-107.1 + T-107.3; 103 A9; 100 P0-01 / P0-02 / P0-04 / P0-06.

---

## 1. What each module is

| Module | One sentence | Doctrine |
|---|---|---|
| `patch.ts` | `applyStrReplace(source, { oldStr, newStr, fuzzy? })` — one textual replacement or an honest coded refusal; diff-as-result; opt-in graded fuzzy that always self-reports. | pure · deterministic · total |
| `policy.ts` | `evaluatePolicy(action, resource, ctx) → { decision, reason, fallback? }` — the ONE seam every approval routes through in W5; default-DENY on unknown action/resource/seat; seat-compatible with `headless.ts`'s `ApproveActor` (read-only). | pure leaf (no imports, no `process.env`) · total · deterministic |

Key entry points (line refs are current on disk):
- `patch.ts:279` `applyStrReplace`; `patch.ts:140` `patchSimilarity` (the graded scorer);
  `patch.ts:117` `PATCH_MAX_LISTED`; types `PatchResult`/`PatchSuccess`/`PatchRefusal`
  (`patch.ts:80/93/112`).
- `policy.ts:170` `evaluatePolicy`; `policy.ts:102` `KNOWN_POLICY_ACTIONS`;
  `policy.ts:134` `isVerifiedHumanSeatToken`; `policy.ts:146` `seatLabel`;
  types `PolicySeat` (`:44`) / `PolicyVerdict` (`:63-66`) / `PolicyCtx` (`:69`).

Contracts implemented exactly as the lane plan specifies, plus two documented tightenings
(§5): refusals carry `kind: "none"`, and `PolicyVerdict` is a discriminated union whose DENY
arm *requires* `fallback` (the "mandatory fallback" of P0-01 is type-enforced, not a convention).

## 2. Work log (append-only)

1. RECON — read `wave_plans/W4/lane-2.md`, `AGENTS.md`, dossier rows
   (`107_competitors_agentic.md:326/328` for T-107.1/T-107.3; `100_factory_blockers.md:30/48/141`
   for P0-01/P0-06; `103_feature_gaps.md:177` for A9), the house-style exemplar
   `src/lib/rt-timeline.ts` + `.test.ts`, `src/lib/errors.ts` (RT_E registry + `ERROR_CODE_DOC`),
   and `headless.ts:721-775` (`ApproveActor` / `HARNESS_APPROVE_ACTOR` / `approve` seat+token
   path — read-only, not edited).
2. Skeleton log written BEFORE deep work (Rule 9).
3. `patch.ts` authored: unique-match scan (all occurrences, overlapping starts counted),
   multi-match refusal naming the count + capped candidate lines, opt-in fuzzy level
   (`{ threshold }` ∈ (0,1]) over line windows scored by Dice bigram similarity with a
   STRICT-best requirement, diff-as-result (structured `PatchDiff` + minimal unified hunk),
   totality guards for non-string/garbage input.
4. `patch.test.ts` authored; first run: 20/21 (one wrong *test* expectation — `"aaaa"` with
   needle `"aa"` honestly reports the three candidates all on line 1; the implementation was
   right, the expectation was fixed — no implementation change).
5. `policy.ts` authored: seat classifier, uniform Rule A (autopilot seat, or human seat +
   verified out-of-band token), Rule B for `hitl.force` (human seat REQUIRED), resource
   namespaces (`gate:P<n>`, `tree:<path>`), default-deny, reason = kebab id + " — " + clause.
6. `policy.test.ts` authored; first run failed 3 assertions because ids were emitted as
   `unknown-action:<value>` — implementation changed so the kebab id stays branchable and the
   hostile value moved into the clause (`unknown-action — "gate.approve" is not in …`).
7. Final verification: 48/48 tests, typecheck 0, eslint 0 findings, `git status` proof that
   all five owned files are new (`??`) and no owned file is modified (`M` list is empty).

## 3. Verification (real command output)

```text
$ npm run typecheck
npm notice run typecheck
npm notice run tsc --noEmit
                                        (no output ⇒ 0 errors)

$ node --experimental-strip-types --test src/lib/patch.test.ts
# tests 21
# pass 21
# fail 0

$ node --experimental-strip-types --test src/lib/policy.test.ts
# tests 27
# pass 27
# fail 0

$ node --experimental-strip-types --test src/lib/patch.test.ts src/lib/policy.test.ts
# tests 48
# suites 8
# pass 48
# fail 0

$ npx eslint src/lib/patch.ts src/lib/policy.ts src/lib/patch.test.ts src/lib/policy.test.ts
                                        (no findings; exit 0)

$ git status --porcelain -- src/lib/patch.ts src/lib/patch.test.ts src/lib/policy.ts \
      src/lib/policy.test.ts fixes/216n_wave_h_primitives.md
?? fixes/216n_wave_h_primitives.md
?? src/lib/patch.test.ts
?? src/lib/patch.ts
?? src/lib/policy.test.ts
?? src/lib/policy.ts

$ git status --porcelain | grep "^ M" | grep -E "patch|policy|216n"
                                        (empty ⇒ no owned file was modified)
```

Teeth in the suites (each would fail on a weaker implementation):
- `patch.test.ts` — multi-match refusal asserts `matches === 3` and `ok === false`
  (a first-match downgrade returns `ok: true` + text, so the test fails); "does NOT fuzzy by
  default" asserts `threshold === null` + refusal (a silently-fuzzy implementation fails);
  the frozen-request test fails on any input mutation; the tie test fails if a fuzzy tie is
  resolved by guessing.
- `policy.test.ts` — the P0-01 forgery (`{decidedBy:"human"}` with no token) must deny; the
  unknown action denies *even with a perfectly verified human seat* (default-deny beats
  evidence); `hitl.force` denies under both autopilot seats; and the purity test sets
  `RT_HUMAN_SEAT_TOKEN` in `process.env` and proves the verdict does not change (no env read).
- `policy.test.ts` also type-pins `ApproveActor` (from `headless.ts`, type-only import) to
  `PolicySeat`, so a seat-shape drift breaks `npm run typecheck` instead of runtime.

## 4. What W5 must wire (explicit integration list — nothing of this lane touched these files)

1. **`headless.ts:734` (`approve`, non-force path)** — replace the seat handling with
   `evaluatePolicy("hitl.approve", `gate:P${project.hitl.phase}`, { actor, humanSeatToken,
   expectedHumanSeatToken: (process.env.RT_HUMAN_SEAT_TOKEN ?? "") })`. The environment read
   stays AT THE CALL SITE (policy.ts must stay env-free — its purity test pins this). Deny ⇒
   throw with the existing coded-refusal shape (mirror `headless.ts:771-775`); allow ⇒ keep the
   `[seat ${seatLabel(actor)}]` note tag (policy.ts supplies the identical label vocabulary).
2. **`scripts/rapidtool-cli.mjs:517` (force guard)** — the `--force` non-TTY check becomes
   `evaluatePolicy("hitl.force", `gate:P${phase}`, ctx)`; the existing `--i-am-human` flag is the
   human-seat claim and must be paired with the token. `hitl.force` can never be self-approved.
3. **`src/lib/dod.ts:337,349,471,483` (P0-02 criteria)** — T-107.4's provenance assertion should
   use `seatLabel` / `isVerifiedHumanSeatToken` as its vocabulary. NOTE (pre-existing, W5 must
   fix in the ledger): a ledger row currently records only `decidedBy`; a criterion can only
   test the claim if the row also records the seat label + whether the token path was taken —
   `policy.ts` supplies the words, the row must supply the provenance.
4. **`headless.ts repairTreeDir` / codegen P6 emit deltas (103 A9)** — use `applyStrReplace` for
   per-file deltas: refuse ⇒ surface the coded refusal (`RT_E_REPAIR_FAILED` at the verb level)
   instead of writing; succeed ⇒ carry `diff` (structured + `unified`) into the emit ledger.
   Never re-emit a whole file when a unique patch exists; never accept a fuzzy hit without
   recording `kind: "fuzzy"` + `score` + `threshold` (declare-or-strike).
5. **`tree.emit` / `repair.apply` actions** — registered in `policy.ts` for the write seams;
   W5 chooses the call sites (emit/repair paths) and passes `resource: "tree:<path>"`.

## 5. Deviations / notes (all deliberate, all observable in the code)

1. **No new `RT_E_*` codes.** `errors.ts` is outside this lane's ownership and `ERROR_CODES` is
   append-only with a doc-entry invariant (`errors.test.ts` fails on an undocumented code), so
   every refusal reuses **`RT_E_VALIDATION`** ("Input or model output failed validation and
   cannot be used" — the exact meaning). W5 may allocate a dedicated `RT_E_PATCH_*` when it owns
   that registry edit.
2. **`PatchKind` includes `"none"`.** The lane shape `"exact" | "fuzzy"` cannot describe a
   refusal, and the result must stay total; a refusal carries `kind: "none"` and no `text`/`diff`.
3. **`PolicyVerdict` is a discriminated union.** ALLOW cannot carry `fallback`; DENY must
   (§`policy.ts:63-66`). This is a strict subset of `{decision, reason, fallback?}` — a deny can
   never leak out without naming the sanctioned alternative.
4. **`policy.ts` never reads `process.env`** (purity): `ctx.expectedHumanSeatToken` is passed in
   by the caller. Mirror of `headless.ts:769-773`, where the env read lives at the call site.
5. **Action registry is grounded, not speculative:** the four actions map to the routing sites
   the dossier names (approve / force / emit / repair). Any other string is default-deny with
   `fallback: "none"`.
6. **Fuzzy acceptance requires a STRICT best** (a tie refuses) and the reported `diff.removed` is
   the ACTUAL matched source slice, not the caller's `oldStr` — a fuzzy hit never pretends to be
   an exact one (`matches: 0`, `kind: "fuzzy"`, `score` + `threshold` reported).
7. `git status` in this repo is broadly dirty from other concurrent lanes/waves — the only entries
   this lane added are the five owned files, all new (`??`); no `M` entry belongs to this lane.

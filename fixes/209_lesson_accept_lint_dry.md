# 209 — lesson `--accept` real write + lint/DRY residual

## What was broken

Human `lesson --accept` mapped rows via `acceptedLessonEntry` **without a
maker `score`**. Lesson-tagged `savePattern` always routes through
`saveLessonIfImproved` → `shouldPromoteLesson(prior, next)`.

`shouldPromoteLesson(undefined, undefined) === false` → every accept returned
`{ appended:false, refused:true, reason:"eval-gated-regression" }` while the
CLI still reported `ok:true` and `promoted: top.length` (attempt count, not
appends). **The only human-gated cross-project lesson write was a silent no-op.**

## Fixes

1. **`acceptedLessonEntry`** — copies finite `row.score` onto the NewKnowledgeEntry
   (score is not part of the content fingerprint).
2. **`saveLessonIfImproved`** — rows tagged `accepted` + `actor:*` (human CLI
   accept) bypass the maker eval-gate. The human flag **is** the gate; machine
   auto-lesson saves still eval-gate.
3. **CLI `lesson --accept`** — envelope honesty:
   - `promoted` = newly appended count
   - `attempted` = input row count
   - `refused` = refused count
   - per-row `refused` / `reason`
4. **Tests** — knowledge pure core + CLI spawn smoke (append then idempotent
   re-accept).
5. **Lint/DRY residual** — dead imports cleaned (engine/headless/wild/prompt-engine/
   gates/io/rt-client); `liveLayer` P6 path calls `upgradeP6Keyed` once (no
   duplicate inline); removed `.probe-tmp` G3 leftover.

## Still false

- Not an autonomous software factory.
- Not better than Codex/Claude Code/OpenHands.
- Real flip/record/show/publish still need keyed P6 (no invented bodies).
- `keyed --all` still user-gated.

## Parent follow-on (same wave)

6. **store.ts dual-channel types (209-b)** — `deepenResearch` / `runVerifyAsync` /
   `runModuleReal` / `ingestReport` are now discriminated unions:
   `ok:true` never types `error`; success-path stop detail is `note?` where needed.
   Runtime already correct; type surface now matches 185-H1 / 208. store tests 72/72.

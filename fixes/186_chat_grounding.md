# 186 — Chat grounding: notes · fixtures · lastTest · tree-run honesty

- **File:** `fixes/186_chat_grounding.md`
- **Date:** 2026-09-09
- **Lane:** Composer 2.5 — `chat.server.ts` + `chat.test.ts` only
- **Parent-owned (DO NOT TOUCH):** store/engine/io/headless/codegen/deepseek/brief-fixtures/scaffold/maker-score/compile-check/dod/types/console/cli/sandbox + sibling diagnose/harvest

## 0. Goal

`buildChatContext` omitted operator notes, acceptance-fixture pending/approved
counts, and synthesis/tree-run honesty. The copilot could read a green
`lastTest: ok=true label=self-test` and claim “the software works.” Ground those
signals as compact honest lines. Legacy projects (fields absent) stay
**byte-identical**. Cap may rise only if needed (≤4000). Keyless still
`{ ok:false, reason:"not-configured" }`.

## 1. What / why / where

| What | Why | Where |
|---|---|---|
| Emit `notes:` when `project.notes` trim non-empty (clip 240) | Operator standing instructions were inert in chat (168A-1) | `buildChatContext` after `memory:` |
| Emit `fixtures: total=N approved=A pending=P` when `acceptanceFixtures` is an array; tag `(pending — not functional)` if pending>0 or total=0 | Copilot must not claim functional acceptance while fixtures pending | after `researchEntries:` |
| Tag `lastTest` self-test / unlabeled-no-tree with `(deterministic floor — not tree-run)` | Green self-test ≠ tree-run proof | `lastTest:` line |
| Emit `synthesis:` derived from `generatedTree` + lastTest label (`floor` / `tree N files` / tested-equivalent) | Project has no `synthesisSucceeded` field; derive honest signal | after `lastTest:` |
| Raise `CHAT_CONTEXT_MAX_CHARS` 2500 → **3200** | Headroom for new lines without eating HITL tail | constant |

## 2. Before / after context shape

### Before (fixed order, ≤2500)

```
RAPIDTOOL COPILOT CONTEXT
project: …
domain: …
kind: …
status: …
currentPhase: …
phases: …
[rejected: …]          # optional
lastGate: …
packet: …
memory: …
researchEntries: …
lastTest: ok=… label=…: … | none
hitl: …
```

### After (additive lines; absence = omit → byte-identical)

```
…memory: …
notes: …                 # ONLY when project.notes trim non-empty (clip ≤240)
researchEntries: …
fixtures: total=N approved=A pending=P […]   # ONLY when acceptanceFixtures is an array
lastTest: ok=… label=…[ (deterministic floor — not tree-run)]: …
synthesis: floor (synthesisSucceeded=false — …) | tree N files; lastTest label=… | …
hitl: …
```

- **notes** — standing operator instructions (168A-1).
- **fixtures** — pending/approved counts; when `pending>0` or `total===0`, tag
  `(pending — not functional)`.
- **lastTest** — keep ok+label+detail; floor qualifier when `label==="self-test"`
  or missing label with no generatedTree.
- **synthesis** — derived (no Project.synthesisSucceeded field):
  - `generatedTree.length>0` → `tree N files` (+ label; unproven tag if self-test)
  - else if lastTest `tested` / `real-run` → tested-equivalent / real-run (no tree)
  - else if lastTest present → `floor (synthesisSucceeded=false — …)`
  - bare legacy (no lastTest, no tree) → **omit**

## 3. Cap

`CHAT_CONTEXT_MAX_CHARS`: 2500 → **3200** (≤4000).

## 4. Implementation status

- [x] Skeleton this file
- [x] `buildChatContext` lines + cap
- [x] Tests in `chat.test.ts` (fixes/186 describe + legacy assertion updates)
- [x] `node --experimental-strip-types --test src/lib/chat.test.ts` green
- [x] Landing log

## 5. Verification log

```
node --experimental-strip-types --test src/lib/chat.test.ts
# tests 52
# suites 11
# pass 52
# fail 0
# duration_ms ~3525
```

- New suite: `buildChatContext — grounding honesty (fixes/186)` — 9 tests
  (notes omit/clip, fixtures pending/approved/empty, self-test floor +
  synthesisSucceeded=false, tree+tested, tree+self-test unproven, bare legacy
  omit, full-honesty budget ≤3200).
- Keyless path unchanged: `chatOnceServer` still returns
  `{ ok:false, reason:"not-configured", code:"RT_E_LLM_NOT_CONFIGURED" }` with
  zero network (existing tests green).
- Parent-owned files untouched.

## 6. Files touched

- `src/lib/chat.server.ts` — `buildChatContext` + `CHAT_CONTEXT_MAX_CHARS=3200`
- `src/lib/chat.test.ts` — assertion updates + 186 suite
- `fixes/186_chat_grounding.md` — this log

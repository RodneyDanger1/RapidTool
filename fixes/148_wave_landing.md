# 148 — wave landing logs (F1/F2/F3; F4 on disk)

## F1 — tree-trigger scope fix (code LANDED + integrated; log by parent)
- codegen.server.ts:976 `singleModuleLibraryKind` — kind-scoped rule: declared kind
  ("app"/"tool"/"game" — all non-library delivery kinds) ALWAYS routes to the chunked tree;
  the ≤8 byte-parity single-module path serves ONLY kind-absent (undeclared/legacy) projects.
  liveP6Synthesis branches :1080. Parent widened the param type to accept kind:null
  (test pinned `{kind:null} → single-module eligible`) + corrected two test expectations:
  the chunked path's lastTest is undefined (no fabricated stamp — verify is the tree-run
  lane's step), never 'self-test'. codegen 55/55 · suite 1360/1360.
- OPEN (F1's flag, adopted): real webapp journeys still flow in kind-absent → still
  single-module. entry.kind → project.kind wiring at create/drain is the M1 flip for the
  keyed re-run.

## F2 — E2's three regression tests (NOT landed — lane capped at recon; queued)
Verified seam map: driveP6Journey fake-deps injection pattern headless.test.ts:369-464;
applyTreeRunTestedMint + defaultP6Synthesize + p6CycleLiveDeps export seams; mintTreeRunTested
codegen.server.ts:1444-1532 (mints only when specs+assertions executed; red → same ref;
green-but-no-spec → warn p6.tree.tested.skipped). The three describes (treeFailure reaches
synthesis deps; mint fires only on real green spec runs, never UI-shell skips; P6 hard-block
honesty under keyed enforceDod) remain to write.

## F3 — lesson verb family (code LANDED + smoke-verified; log by parent)
rapidtool-cli.mjs lesson case arms completed per mission: list (fusionRank when --brief,
score-desc/id-asc fallback, refined rows with class/level/evidence), propose (lazy deepseek
seam when keyed, deterministic proposeLessonFallback keyless, labeled), accept (human-gated
cross-project write via acceptedLessonEntry), supersede/refute (--evidence optional; wiring
markSuperseded/bumpCounterEvidence). Smoke runs exit-correct. README-cli rows landed.
Remaining: regression test file + full gate evidence (suite 1360/1360 covers the tree).

## Post-148 gate (parent): typecheck 0 · lint 0 · build 0 · suite 1360/1360.

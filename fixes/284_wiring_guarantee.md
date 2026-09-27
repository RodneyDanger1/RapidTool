# fixes/284_wiring_guarantee.md — W38 · LANE G1 · THE WIRING-GUARANTEE PASS

**Lane:** W38 G1. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · HEAD `0f85c32` + the W29–W37 uncommitted era.
**Mission:** guarantee function — every interactive element reaches a real seam; every seam is reachable; every
reference (label, name, path, event) agrees with the code it points at. Small honest fixes only; where already
right, RECORD the verified ✓ (the pointer map is half the deliverable).
**Box (mine):** `src/components/console.tsx` · `src/routes/**` · `src/routeTree.gen.ts` · the seam layer
(`chat.ts` · `crew.ts` · `exec.ts` · `fixtures.review.ts` · `llm.ts` · `research.ts` · `verify.ts` · `rt-events.ts`
read-side/emitters in UI). **NOT mine (live lanes):** `codegen.server.ts` + `src/lib/llm/**` (Y1) ·
`engine.ts`/`store.ts`/`rt-*.ts` (Y2) — findings there are recorded `for-Y1`/`for-Y2`, never edited.
**Contract:** CODE-ONLY — no test runs, no typecheck, no builds, no gates, no keyed calls. Log-and-continue.
Smallest honest patch per broken pointer · additive only in console.tsx · never weaken a contract · never remove
a control · never an enabled no-op.

## [t0] Mandatory reads (verified, ~20:30)

- `wave_plans/W37/master-pack.md` — read in full (54 lines; X3 = the UI lane this pass completes at wiring scope) ✓
- `fixes/281_n3_ui.md` — read in full; the N3 baseline: `ShellSurfacesCard` appended at console.tsx EOF
  (7 rows: plan · checkpoint · unattended · stream · cassette · seat · isolation), render line after
  `<GateHealthCard/>`; byte-state table at :24-37 is the baseline I verify against ✓
- `fixes/276_f3_ui_close.md` — read (24-line skeleton; no byte-state table; delivers the F3 context: the
  `RT_E_*` codes + `wildPlan` shape decisions that drove N3) ✓
- §R6 worklist `research/multiagent/thoroughanalysis.md:1370-1388` (R6-f01…f15) — read in full ✓
- §R14 edge table `thoroughanalysis.md:1105-1111` (R14-f01…f05 + the wired-✓ table) — read in full ✓
- §R6 verifications that HELD (must re-verify, do not "fix"): 0 non-null assertions · 59 buttons swept ·
  RUN_TABS single source ✓ pending re-check below.

## [t0] Byte-state (this tree, this session — code = truth)

| File | Bytes/lines | Note |
|---|---|---|
| `src/components/console.tsx` | **6,832 lines** | N3's edits live (6,677 → 6,832 = +155 claimed; matches N3 log) |
| `src/routes/__root.tsx` | 89 lines | PreviewHostBridge :8 · TelemetryBoot :80 (R14-f05 claim) |
| `src/routes/index.tsx` | 15 lines | renders a console export |
| `src/routes/run.$id.tsx` | 17 lines | renders a console export |
| `src/routeTree.gen.ts` | (src/, not src/routes/) | R14 f05 cited `routeTree.gen.ts:11-24` |
| `src/lib/chat.ts` · `crew.ts` · `exec.ts` · `fixtures.review.ts` · `llm.ts` · `research.ts` · `verify.ts` | 517 · 212 · 103 · 39 · 159 · 109 · 288 | the 7 facade files (8 facades' createServerFn sites) |
| `src/lib/rt-events.ts` | 395 lines | the event registry |
| `src/lib/store.ts` | 1,882 lines | Y2's box — read-only for me |

## Pointer map (the deliverable)

STATUS: ✓ = verified true today · FIXED = this lane's patch · for-Y1/Y2 = recorded, owned elsewhere ·
N/A = not-a-pointer.

_(rows land below as verified — append-only)_

## Log (append-only)

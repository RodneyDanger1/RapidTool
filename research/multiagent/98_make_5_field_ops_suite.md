# Make 5/5 — Field-Ops Suite (project/payroll/tasklist/supply) — audit dossier (Phase 1)

Driven by Flash B5 through the FIXED pipeline with the real key (2026-09-07). Journey
reached P8 (parked on a human gate) before the agent cap; probes + full audit of the
P0-P8 evidence. Scratch: `%TEMP%\rapidtool-make-b5\` (field-ops.json at P8, field-ops2.json,
~15 envelopes, probe-l2.mjs/probe-l2b.mjs, drive-journey.sh ready for the remainder).

## Verdict (interim) ≈ 1/10 delivery — the seam fixes WORK but P6 still never ships a
module; lesson capture works when probed directly but the real keyed run captured ZERO
lessons.

## What WORKS (fixes proven live)
1. **Keyed-P6 seam fires under bare Node**: the run's own log shows `p6.synthesis.refused |
   P6 | RT_E_LLM_TIMEOUT · DeepSeek request timed out after 90s` — the seam genuinely calls
   DeepSeek now (in make-2/3 it never attempted; server-fn guard) and honestly records the
   refusal. generatedSource stayed the deterministic placeholder; P6 DoD gate honestly FAILs
   (2 unmet: p6-verified, p6-brief-fit); modelRoute:deterministic, no implementationSpec.
2. **Lesson builders + wiring work under bare Node**: probe-l2.mjs reproduced the exact
   headless seal path → minted lesson-template-emission-2d72e3d2 + lesson.capture log.
3. Real LLM P0/P7 narratives + live research (2 corpus entries, 5 items each, duckduckgo)
   landed honestly.

## What is STILL BROKEN
1. **P6 synthesis has NO retry-with-backoff**: a single non-retrying 90s-capped attempt;
   when it times out, that IS the delivery outcome. (expandBrief has backoff; the main
   synthesis call does not.)
2. **L2 lesson capture bypassed on the real keyed run**: the codegen timeout path
   (refuse() at codegen.server.ts:404) preserves memory but returns the pre-seal project —
   the L2 mint point in the deterministic seal is never reached. Root cause: lesson capture
   is NOT wired into the live-synthesis failure path.
3. **Deterministic phase bodies residual**: P1 "Dispatcher topology" / P4 runner-policy
   prose / P8 one-screen artifact at 330 B on a field-ops brief; lattice jobs just [track]
   with noise entities listing/list; research drifted to field-service competitor pages
   (domain-classification residual for construction/field-ops vocab).
4. Field-ops2 journey (prepared driver) still needs the remaining phases + verify + pillars.

## Files for the next pass
drive-journey.sh is ready to finish project 2's keyed journey; probe-l2.mjs reproduces the
seal lesson path. Dossier incomplete by cap, not by design.

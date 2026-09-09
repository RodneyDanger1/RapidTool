# QUEUE — Wire-Everything + Compiler wave (6 Flash) — fires when deleg_945162fb + deleg_2eb4be8d land

User directive (2026-09-07): after the current 6 agents (4 analysts → fixes/122/123/124 +
research/99; 2 Pro wirers → fixes/125/126) complete, spawn 6 Flash agents to:

1. **Wire everything that isn't wired** (consume fixes/124_unwired_seams.md + 125/126 results).
2. **Bug-check every step of the pipeline** — from the chat UI/chat itself to the END of the
   pipeline (producing software, learning loop, api calls, file formats, compile).
3. **Ensure code is truly written / software truly created** — analyze what RapidTool is
   SUPPOSED to do and make it so.
4. **COMPILER / true-program generation**: analyze the produced file types — does the
   output compile? If not, add a compiler pass at the END of the pipeline to truly create
   programs/software — more file types (real apps: TS/TSX entry, HTML, CSS, package.json,
   executable scripts), compile check (tsc/esbuild-style or node --check), honest verdict
   per produced artifact.
5. **Constraints**: patch-only on existing files; brand-new files get ONE write; scan
   GitHub for open-source self-hosted / no-key tools to integrate (steal code/ideas —
   esbuild? swc? a tiny TS compiler? a bundler?) — no keys required, self-hosted.

## Lane plan (spawn on batch land, model deepseek-v4-flash, ≤3 concurrent × 2 waves if needed)
- F-X1: pipeline run/seal/gate/verify wiring + red-gate honesty residuals (engine/headless/dod/verify).
- F-X2: chat UI → chat → report-intake → knowledge loop bugs + wiring (console/chat/chat.server/knowledge/store/report-intake).
- F-X3: learning-loop + lesson writers + API-call seams (knowledge/engine lesson sites/llm/deepseek/rt-*).
- F-X4: COMPILER/PRODUCE pass — file-format analysis + compile-verify seam + scaffold/emit real-app wiring (io/scaffold/codegen/CLI emit verb + a new compile module ONE write).
- F-X5: UI/output reachability + artifacts/export/design/diagram/vault + runtime-log (console/io/headless output verbs).
- F-X6: cross-cutting bug sweep of api calls + memory/evidence math + wild-driver + swarm/crew/packet (engine/store/wild/crew/swarm/packet).
All: consume 122/123/124/125/126 + research/99 FIRST; log in fixes/127_wireeverything.md;
gates: typecheck 0 / lint 0 / full suite green / build 0.

# fixes/316_h3_v2findings.md — H3: the V2-findings curer (real p6Edge in the headless wild loop + seal repair alive + `--agent-seal` pointer refusals + pins)

**Lane:** H3. **HEAD at start:** 564db1f ("V-round cured: seal provenance stored … wild-seal.test.ts 10/10, forge-refused pin"). **Baseline:** all gates green (parent: "HEAD=564db1f; all gates green").
**Scope (per parent brief + 315_v2_deepcheck findings #1/#2/#4):**
1. **Production-dead repair (finding #1):** `wildDodRepairOnce` (engine.ts:3959) consumes ONLY `opts.p6Edge`; both headless wild loops (`wildStartRun`/`wildStartHeadless`) pass none ⇒ on a real sealed run the ONE repair pass can never fire. Wire: headless threads the equivalent P6 edge (`runP6Edge` — W-02's route, headless.ts:548/:2611) into `wildStep`'s opts as `p6Edge`, keyed-only (keyless keeps its exact bytes); engine consumes `dodRepair` first (finding #2 — declared, zero consumers) then the ONE `wildExecEdgeFor` picker shared with the execute site (so the two can never drift again).
2. **Silent flag (finding #4):** `approve --agent-seal` / `gate --agent-seal` silently absorbed by parseArgs → coded POINTER refusals (RT_E_VALIDATION + remedy naming the correct door `wild --start|--resume --agent-seal`) + USAGE mentions.
3. **Pins:** the headless opts-thread (keyless, injected edge spy) + the engine repair consumption + the CLI refusals.
4. **Rule:** NO keyed calls. Professional quality only; byte-parity guards for the keyless path.
**Files (one writer per file):** `src/lib/engine.ts`, `src/lib/headless.ts`, `scripts/rapidtool-cli.mjs`, `src/lib/headless.test.ts`, `src/lib/wild-seal.test.ts`, `scripts/cli-exit-taxonomy.test.mjs`, `scripts/README-cli.md`, this log.
**Overlap note:** H1 (316_h1_p7.md) also targets the engine wild P7 region; this lane stays off P7 (`liveEdge` untouched) except note-leaving it to H1.

## Status board
- [ ] Log opened (this file) — FIRST, before any edit
- [ ] Engine: `wildExecEdgeFor` picker + `wildDodRepairOnce` consumes `dodRepair` → picker
- [ ] Headless: both wild loops thread `p6Edge` (keyed `runP6Edge`; `opts.p6Edge` seam passthrough)
- [ ] CLI: `approve`/`gate` `--agent-seal` pointer refusals + USAGE lines (+ README-cli)
- [ ] Pins: headless opts-thread · engine repair consumption · CLI refusals
- [ ] Legs foreground: headless.test.ts · wild-seal.test.ts · wild-step.test.ts · cli-exit-taxonomy.test.mjs · typecheck · lint

## Evidence log (append-only, timestamped)

- [t0 18:52] Log opened. Recon: HEAD=564db1f clean (two untracked sibling logs: 316_h1_p7.md, 316_h4_uitails.md). Read 315_v2_deepcheck (findings #1–#4), 313_d1_seal seam table, engine.ts:3740–4000/4200–4444/4552–4810, headless.ts:500–571/2195–2223/2595–2614/4163–4412, rapidtool-cli.mjs:74–114/668–757/858–960/3431–3545/3953–3996. Key lines: engine.ts:3963 (`opts?.p6Edge` only) · engine.ts:4753–4755 (execute-site resolution) · headless.ts:4197–4201/4390–4394 (wildStep opts — no p6Edge) · CLI:3495 (only `agent-seal` reader).

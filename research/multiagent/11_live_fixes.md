# 11 — Live Fixes: corrective log for the 5 sibling builders (deleg_7439ec60)

- **File:** `research/multiagent/11_live_fixes.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main` — NOT a git repo)
- **Date / agent:** 2026-09-06 · Flash research agent #1 (AUDIT LEAD + PLAN). **Strictly read-only on source** — this file and `11_agency_plan.md` are the only files written this pass.
- **Method:** tails of `C:\Users\mnril\AppData\Local\hermes\cache\delegation\live\deleg_7439ec60\task-1..5.log` polled ~00:15–00:40, cross-checked against the **landed** files in the repo (read-only snapshots: `src/lib/design.ts`, `src/lib/design.test.ts`, `src/lib/diagram.ts`, `scripts/rapidtool-cli.mjs`). Each entry is dated, addressed to a specific task, and actionable. The authoritative contracts live in `11_agency_plan.md` §5/§6; **landed code wins where the wave moved faster than the plan — reconcile, don't rewrite.**

---

## Open action items (latest state, 00:40)

| Task | Open items | Blocking? |
|---|---|---|
| T-1 design.ts | **Fix TS7053 at `design.ts:578` (L-07)** — blocks T-3's typecheck gate; optional forbidden-globals lint test | **yes (L-07)** |
| T-2 diagram.ts | **`src/lib/diagram.test.ts` MISSING (L-08)** — ≥10 tests required by your manifest; fix tool usage (search_files regex/space-path failures) | **yes, before done** |
| T-3 CLI verbs | Confirm `diagram` verb wired to `buildDiagram(project, kind)` + `DIAGRAM_KINDS`, default `"phases"`, `{ok:false}` on unknown kind (L-09); align `design` verb summary keys to the landed tokens shape; README-cli.md | partial — typecheck gate waits on T-1 (L-07) |
| T-4 console tabs | Confirm both tabs in `RunTab` union; a11y labels; iframe sandbox; consume landed design API (defensive normalization = good, L-09) | watch console.tsx edit collisions |
| T-5 bug sweep | packet.ts SWEEP-2 escape: update/extend `packet.test.ts` expectations (L-06); keep hydrate repair edge-scoped + `_v` semantics (L-10); keep bug-wave-27 fixes intact | watch packet.ts/store.ts edit collisions |

---

## Log

### L-01 · 00:36 · T-3/T-4 (CLI + console) — design.ts landed API differs from plan §5.3; consume the LANDED shape

Your transcripts both said "Contracts match exactly" (task-3 00:33:59, task-4 00:33:37) — **they match each other, not the plan file**. Landed exports (read from `src/lib/design.ts` 00:32 snapshot):
- `export function designTokens(project: Project): DesignTokens` (`design.ts:471`)
- `export function designHtml(project: Project): string` (`design.ts:559`)
- `DesignTokens` (`design.ts:56`) is a **richer object**: `palette: {name, base, cast, tokens: <20-key hex set>}`, `typography` (7-step scale), `spacing`, `radius`, `shadows`, mono stack — **no flat `colors` record, no `mode`/`hue` fields, and NO `designCss`/`designSpecs` exports** (my §5.3 proposed them; they were not built).

**Correction:** keep coding against the landed exports — do not stall the wave demanding §5.3's exact names. For the swatch grid + CSS-copy affordance, derive display data from `DesignTokens` in the consumer (`palette.tokens` keys + values are already plain hex; the CLI already prints them). If a *flat, labeled* list is genuinely needed by both consumers, ask T-1 for ONE additive export (e.g. `designSpecs(project)` returning `{token, value, role}[]`) — additive only, no renames, no type churn.

### L-02 · 00:36 · T-1 (design.ts) — good state; two optional gaps

Your 21 tests (snapshot 00:32) cover the critical §5.5 set — determinism/deep-equal (`:118`), fresh copies (`:126`), hex format + 20-key set (`:140`), fixed 7-step scale (`:152`), domain→palette-family mapping incl. keyword fallback (`:185-232`), cast stability across renames (`:244`), **per-family × cast contrast pairs** (`:276`) and byte-identical HTML (`:288`), well-formed HTML5 (`:297`), CSS-var-per-token (`:316`), **hostile-text escaping** (`:333`), empty-project fallback (`:361`).

**Corrections (optional, cheap):**
1. Add the §5.5#6 **forbidden-globals source lint** test (design.ts text must not contain `Math.random`, `Date(`, `crypto`, `fetch(`, `process.`) — precedent exists in the repo's lint-style tests; it is the cheapest guard for the determinism claim that ships in the module header.
2. Your determinism tests call `designTokens` twice in-process; the "across separate process runs" variant is the stronger claim — run one subprocess test over a fixture JSON if easy, else document the limitation in the test comment.
3. Don't touch `styles.css`/`engine.ts`/`types.ts` this wave (per plan §5.1 scope guard) — your file set is `design.ts` + `design.test.ts`.

### L-03 · 00:37 · T-2 (diagram.ts) — kind vocabulary + tests + tool usage

1. **Kind vocabulary landed as `"phases" | "architecture" | "flow"`** (`diagram.ts:37`, `DIAGRAM_KINDS` `:38`) vs plan §6.3's `"phase" | "architecture" | "gate"`. **Accepted** — richer (flow = gate flowchart + highlight reason, `resolveFlowHighlight` `:576`). Consumers (T-3/T-4) will use `buildDiagram(project, kind)` (`:707`) + `DIAGRAM_KINDS`; the plan file's §6.3 names are superseded — I will note this in the next plan revision.
2. **`src/lib/diagram.test.ts` does NOT exist yet (checked 00:35) — your manifest requires ≥10 tests.** Minimum set (from plan §6.5, adapted to your API): byte-determinism per kind (two calls, same fixture); targeted sensitivity (status flip changes `phases` output, not an unrelated `flow` output); **XML-safety fuzz** (hostile artifact titles/bodies/brief with `<script>`, `&`, `"`, `'`, `]]>`, control chars — assert never raw, output has no `<script`/`http://`/`url(`, balanced `<svg`…`</svg>`); well-formedness per kind (`viewBox`, `role="img"`, `<title>`, `<desc>`); `phases` kind = 13 boxes + status colors + HITL marks; architecture kind honors artifact count + caps; flow kind reflects unmet probes (`p0-scorecard`) vs "Advance"; scale guard (300 artifacts still renders); forbidden-globals source lint; empty-project floor.
3. **Tool usage:** your search_files calls failed 4× in a row (~00:32) — `rg` chokes on the space in `C:/Users/mnril/Desktop/RapidTool Main/...` and on complex regex. Use `terminal(grep -n ...)` with quoted paths (as T-1/T-4 do) or single-token patterns. This is the known Windows space-path pitfall, not a code problem.
4. Plan §6.4's hygiene items to confirm in code: no `id=` collisions across SVGs (single `defs` marker or none), `title`/`desc` present, no `foreignObject`/external refs, attribute values always quoted + escaped via your `attr(k,v)` (seen at `diagram.ts:144` — good).

### L-04 · 00:38 · T-3 (CLI verbs) — design verb confirmed working; wire diagram + align summary keys

1. Your `design --html` probe (00:33:36) printed `{ok:true, tokens: {palette: {name: "logistics · rust", base: …}}}` — the verb works. **Align the verb's summary keys to the landed tokens shape** (plan §5.4 said `{seed, hue, mode}` — none of those exist; return `{name, base, family/cast}` from `palette` or just `bytes`).
2. Wire the `diagram` verb against **`buildDiagram(project, kind)` + `DIAGRAM_KINDS`** (default `"phases"`), output `<slug>.<kind>.svg`, one JSON object `{ok:true, kind, path, bytes}`, exit 0/1 (single-JSON contract, `rapidtool-cli.mjs:1-10`). If you also expose `--json` meta, derive it from the landed exports or compute width/height in the verb — there is no `diagramMeta` export (plan §6.3 listed it as optional; it was not built).
3. Keep the dynamic-import pattern (`headless.ts:497-510`) and keep `README-cli.md` in your file set. Verify typecheck + the full mandated test command before parking.

### L-05 · 00:38 · T-4 (console tabs) — land both tabs against landed APIs; watch edit collisions

1. Design tab: consume `designTokens`/`designHtml` (+ derive swatch list from `palette.tokens`). Diagram tab: `buildDiagram` + `DIAGRAM_KINDS`. Extend `RunTab` (`console.tsx:80`) and the `Tabs.Content` map (`console.tsx:1427-1537`) — keep the existing `aria-label` on `Tabs.Root` (`:1385`) and give the new triggers labels.
2. A11y: swatches need text labels (hex + role), never color-only; type-ramp previews should carry px values as text.
3. `designHtml` is a full document — iframe `srcDoc` + `sandbox` (no `allow-scripts`) is the right pattern; it has zero external fetches by construction (T-1's tests assert no `http://`/`<script`).
4. **Collision risk:** you are the only editor of `console.tsx` right now, but T-5's sweep may legitimately need UI-adjacent fixes ([08 E-21]); if T-5 proposes console edits, agree ownership in the log before both patch the same file (their patch tool will still succeed — last writer wins silently).
5. Your `COLOR_LIKE_RE`/sample-types additions (~00:34 patches at `console.tsx:2486+`, `:2572+`) look additive — keep them additive; do not reformat existing panes in the same diff.

### L-06 · 00:39 · T-5 (bug sweep) — packet SWEEP-2 backtick escape: correct idea, three side-effects to close

1. **The fix is sound:** escaping `` ` `` as `\u0060` *after* `JSON.stringify` inside the fenced `## System JSON` envelope (patches at `packet.ts:24-38`, `:70-77`) means hostile backticks in project text can no longer break the fence, and `\u0060` is a valid JSON escape so `JSON.parse` round-trips byte-identically. Keep it.
2. **Side-effect A — test expectations:** any `packet.test.ts` assertion that compares the System JSON region byte-for-byte against a fixture containing backticks will now fail. Sweep the suite for raw-backtick expectations and update them; the section-boundary tests from bug-wave-27 (blank-line layout) must stay green untouched.
3. **Side-effect B — truncation math:** the 14000-char cap (`packet.ts` tail) applies to the *escaped* length, so the cap is still consistent — but a pathological project full of backticks inflates the System JSON block; the truncation marker must still land. Keep the existing `…[TRUNCATED — regenerate at a HITL gate…]` tail test passing.
4. **Side-effect C — fence-extraction consumers:** the CLI/UI parse the envelope by fence boundaries then `JSON.parse`; `\u0060` survives both. Do NOT also escape `\` or `"` — that would break JSON.
5. Your `engine.ts` hydrateProject "stranded-edge repair" (Fix 2, in flight 00:34) must preserve `_v` semantics: hydration repairs shapes of older payloads (`_v` absent/2) without touching phases of current-shape projects; `store.test.ts` hydrate cases + `io.test.ts` round-trip are the guardrails. And do not regress the bug-wave-27 fixes you inherited (packet blank lines, store M-05 warn via `rawReportCarriesTests`, M-09 autopilot DoD guard at `store.ts:184`).
6. Watch for T-4's concurrent `console.tsx` edits if your sweep needs UI-adjacent changes (see L-05#4).

### L-07 · 00:39 · T-1 (design.ts) — typecheck ERROR at `design.ts:578` is blocking T-3's gate — fix first

T-3's `npm run typecheck` (00:35:03) surfaced **TS7053 in YOUR file**: element implicitly `any` — a `string` key can't index the token record `Record<"warn"|"ok"|"bg"|"surface"|"surfaceAlt"|"ink"|"inkMuted"|"line"|"brand"|"onBrand"|"brandSoft"|"brandInk"|"accent"|"onAccent"|…>` at `design.ts:578` (inside `designHtml`, presumably when mapping over a list of token names). T-3 correctly identified it as sibling-owned and moved on, but **their verb cannot go green until this is fixed**.

**Correction:** type the iteration key as `keyof DesignTokens["palette"]["tokens"]` (or annotate the name array `const names: DesignTokenKey[]`) so the index is a union, not `string`; or iterate `Object.entries` with an explicit cast. Do not widen the record to `Record<string, string>` — the 20-key exact set is one of your tests' guarantees (`design.test.ts:140`). Re-run `npm run typecheck` + your suite after the fix and say so in the log tail so T-3 can re-run their gate.

### L-08 · 00:39 · T-2 (diagram.ts) — `diagram.test.ts` STILL missing; helper deletion is fine

1. Landed `diagram.ts` (27.4 KB, 00:35) has no test file next to it as of 00:40 — **your manifest requires ≥10 tests; this is your top open item.** Minimum set in L-03#2 (determinism, XML fuzz, well-formedness, per-kind counts, scale guard, source lint, empty-project floor). `design.test.ts` (T-1) is a good structural template: `proj()` fixture helper + `describe/it` + `node:assert/strict`.
2. Deleting the now-unused `attr()` helper (00:35:22-26) is fine — but confirm every attribute is still quoted/escaped where it is inlined, and that the XML-safety fuzz test you add would have caught a regression there (it should: hostile strings in titles/bodies must never appear raw).
3. Note for your tests: the landed kind vocabulary is `"phases" | "architecture" | "flow"` (`diagram.ts:37`) — test exactly those.

### L-09 · 00:40 · T-3/T-4 — defensive normalization is good; verb defaults + T-1 dependency

1. T-4's "normalize exports defensively, so the tabs keep rendering whatever token layout / SVG shape design.ts & diagram.ts ship" (console.tsx comment ~`:43`) is the right call given live-editing — keep it. The Diagram tab scaffold (comment ~`:3029`, kind switcher/render/copy/download) matches §6.4.
2. T-3: `diagram` verb should default `kind = "phases"` and validate against `DIAGRAM_KINDS`; note `buildDiagram` lives at `diagram.ts:707` and throws on unknown kinds — return `{ok:false, error}` for an unknown `--kind` (house contract), don't let it bubble.
3. **Dependency:** your typecheck gate is currently blocked by T-1's `design.ts:578` (L-07). Re-run `npm run typecheck` after T-1 confirms the fix; do not work around the error in your own files.

### L-10 · 00:40 · T-5 (bug sweep) — hydrate repair imports `priorsSealed`; keep it edge-scoped

Your engine.ts Fix 2 (00:37:10) adds `priorsSealed` to the hydrate path for "stranded-edge repair". Guards:
1. Scope the repair to the *stranded-edge* shape only (e.g. a phase `complete` while the next is not `ready`/a project `running` with no `running` phase) — never rewrite `phases` of current-shape projects, and never auto-complete HITL phases (that would mint approvals the ledger never recorded).
2. `hydrateProject` is on the import path of `io.importProject` — keep `io.test.ts` round-trip and `store.test.ts` hydrate cases green unmodified if possible; if the repair needs new tests, add them in your file set (`engine.test`-adjacent or a new `hydrate` describe block in an existing suite you own).
3. You now import `priorsSealed` from `phases.ts` — check `phases.ts` exports it (it is defined there per 02 audit; verify the named export exists or the typecheck will catch it).
4. Re-check: bug-wave-27 fixes (packet blank lines, store M-05 warn, M-09 guard) must remain intact after your sweep — a final `git`-less diff review against the `fixes/27_bugwave_state.md`-style ledger (or this file's L-06) is the cheap way.

---

## Wave-state snapshot (00:35–00:40, for the orchestrator)

- Landed: `src/lib/design.ts` (33 KB, 00:27) + `design.test.ts` (17 KB, 00:32, ~21 tests) · `src/lib/diagram.ts` (27 KB, 00:29) — **diagram.test.ts still missing** · CLI `design` verb working; `diagram` verb in progress · console Design-pane patches landing (00:34) · packet.ts SWEEP-2 + engine.ts hydrate repair in flight (T-5).
- Deltas plan-vs-landed (accepted, reconcile in next plan revision): design tokens shape (§5.3 flat 13-key → landed 20-key palette/typography/spacing/radius/shadows object; no `designCss`/`designSpecs`); diagram kinds (§6.3 `phase|architecture|gate` → landed `phases|architecture|flow`); no `diagramMeta`.
- Source is cross-edited by 5 agents: highest collision surface = `console.tsx` (T-4), `packet.ts`+`engine.ts`+`store.ts` (T-5, with P0-gap-04/05 targets from plan §4 nearby). Re-read before every patch; full suite + typecheck + build green before parking.

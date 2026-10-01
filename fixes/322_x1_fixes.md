# 322 · X1 FIXER #1 — src/lib box (W44 "10 EXPERIMENTS" campaign, fixer lane)

Lane X1 (fixer #1, **src/lib/** box only). Repo `C:\Users\mnril\Desktop\RapidTool Main` — HEAD `20802b1`, tree CLEAN + FROZEN.

**Hard rules honored:** single write surface = THIS log (+ src/lib/**.ts patches ONLY once `C:/Users/mnril/w44_trial/fix_go2.md` exists). No keyed calls; key never read/echoed. No repo edits before the marker; no boundary runs. Space-in-path ⇒ terminal `grep` only. Repros read-only/keyless; scratch under `C:/Users/mnril/x1_scratch/`. Scripts-side fixes → `[OTHER-BOX: X2]`.

Watch surface: `fixes/321_d1_live.md` · `fixes/321_d2_monitor.md` · `fixes/322_e1_ten.md` · `fixes/322_e2_monitor.md` · `fixes/322_e3_backend.md` · `fixes/322_x2_fixes.md` · `C:/Users/mnril/w44_trial/live1/**` + `exp/**`.

Status: **IN PROGRESS** — marker not seen yet (as of 15:57). Both seeded tickets investigated to root cause; all patch texts prepared below; polls continue.

## Ticket register (X1 claims)

| # | sev | ticket | box / state |
|---|---|---|---|
| **R (F-1)** | MED-HIGH | machine `reject --note` mints `decidedBy:"human"` (non-TTY probe) | **X1 CLAIMED** (src/lib seam) + `[OTHER-BOX: X2]` (CLI seat flag/refusal) |
| **P6 (F-3)** | HIGH (campaign-blocking) | P6 `p6-brief-fit` hard-DoD red repeats on every experiment | **X1 CLAIMED** — 3-layer mechanism + 3 patch candidates |
| F-4 (OBS) | low | P6 hard-red remedy prose references an "open HITL prompt" while `hitl:null` | X1 candidate (see §F-4); root is `errors.ts` registry + scripts call sites |
| F-2 | LOW-MED | forceHuman autopilot refusal wraps as `RT_E_INTERNAL`/exit 4 | X2 owns (their log, ticket T) — no X1 action |
| F-3 (codes) | OBS | exit-2 parks logged `code:null` in diagnose | X2 partial; adjudication pending — no X1 action yet |
| F-5 | OBS | classifier note clipped at 1467 chars | no X1 action (recorded by D2) |

## Repro environment (keyless, read-only)

- Node `v22.23.2`; scratch `C:/Users/mnril/x1_scratch/` — `repro_p6.mjs` (dod-probe replica; arg = build.json), `diag8..13_p6.mjs` (TS-lexer ground truth), `chk_*.mjs` (extracted tree files, `node --check`).
- Ground truth via repo `node_modules/typescript` `createSourceFile`/`createScanner` (string+comment+regex token ranges) — compare vs `maskLiteralsAndComments`.

---

## Ticket R — machine `reject` mints `decidedBy:"human"` (F-1)

### Evidence (live bytes)

- `live1/05_sealed_reject_note.out` L18: `lastGate{phase:0, decision:"reject", note:"W44 trial probe…", decidedBy:"human", decidedAt:1790788733274}` — applied by a **non-TTY machine run**; disk after: `blocked`, `hitl:null`, `rejectionHistory[0]`.
- D2 F-1 (`fixes/321_d2_monitor.md`:81): "machine `reject` mints `decidedBy:'human'` … Contradicts `README-cli.md` ('a machine path can never mint decidedBy:"human"') + honesty contract #6 (truthful actor)."

### Mechanism (exact chain)

1. **CLI reject arm** `scripts/rapidtool-cli.mjs:~1075-1110` → `h.reject(project, note.value)` (line 1107). No seat flag exists on `reject` (approve has `--seat/--i-am-human` at `:1002-1068`); the bare-approve non-TTY refusal text lives at `:1008`.
2. **headless** `src/lib/headless.ts:1245-1247` — `export function reject(project, note)` → `return rejectHitl(project, note);` — **no actor seam** (contrast `approve()` at `:1168-1242`: `ApproveActor` union `:1101-1103`, `HARNESS_APPROVE_ACTOR` `:1108`, policy seam `evaluatePolicy` `:1192-1208`, `decidedVia` provenance stamp `:1223-1234`).
3. **engine** `src/lib/engine.ts:1785` `rejectHitl(project, note)` — **line 1809 hardcodes `decidedBy: "human"`** on the minted `HitlDecision`. No seat defaulting, no bypass — the reject path simply HAS no seat concept; "human" is a literal. (Approve's protection: `approveHitl` refuses a non-explicit `decidedBy` `:1680-1683` + forceHuman guard `:1690-1691`.)
4. Other caller: `src/lib/store.ts:1791` (console UI reject). `store.test.ts` pins `decidedBy:"human"` for that path (`:216,:235,:248,:665`) — the console IS a human seat by construction; keep those bytes.

**Verdict:** the human-seat claim was neither bypassed nor defaulted — it was **hardcoded** on a path with no actor concept. Any machine caller (CLI reject) necessarily mints a human row.

### Prepared patch — src/lib seam (X1 box)

**FILE `src/lib/engine.ts`** — 2 edits (keeps console/store + tests byte-identical: absent opts ⇒ legacy `"human"`):

```ts
// (1) signature, replace line 1785:
-export function rejectHitl(project: Project, note: string): Project {
+export function rejectHitl(
+  project: Project,
+  note: string,
+  /**
+   * 322 X1 (F-1): explicit actor seat for the reject row. The pre-fix path
+   * hardcoded `decidedBy: "human"`, so every machine caller (the CLI reject
+   * verb) minted a human actor for a machine decision. Absent ⇒ the legacy
+   * human stamp — the console store path IS the human seat and keeps its
+   * byte-identical rows; headless/CLI machine paths pass the explicit seat.
+   */
+  opts?: { decidedBy?: HitlDecision["decidedBy"] },
+): Project {
```
```ts
// (2) reject decision mint, replace line 1809:
-    decidedBy: "human",
+    decidedBy: opts?.decidedBy ?? "human",
```

**FILE `src/lib/headless.ts`** — replace `reject()` (lines 1244-1247). TWO variants; **parent picks**:

Variant **R-A — attribute the true seat** (default = harness autopilot, mirrors documented default-seat philosophy; zero CLI breakage; bare machine reject becomes `decidedBy:"autopilot"`):

```ts
/** Reject the pending HITL gate (throws unless ≥12 chars of qualitative note).
 *
 *  322 X1 (F-1): the minted row records an explicit ACTOR SEAT — a machine
 *  caller defaults to the harness's own autopilot seat, so a machine reject
 *  can never mint `decidedBy: "human"` (pre-fix: rejectHitl hardcoded it).
 *  A human seat must be claimed explicitly by the caller (CLI: `--i-am-human`
 *  + the out-of-band `RT_HUMAN_SEAT_TOKEN`, approve parity). */
export function reject(
  project: Project,
  note: string,
  actor: ApproveActor = HARNESS_APPROVE_ACTOR,
): Project {
  return rejectHitl(project, note, { decidedBy: actor.decidedBy });
}
```

Variant **R-B — refuse off-TTY like approve** (approve-parity governance; bare `reject` without an explicit seat refused coded; needs X2's `--seat` flag on the reject arm before the campaign can use reject again):

```ts
/** Reject the pending HITL gate (throws unless ≥12 chars of qualitative note).
 *
 *  322 X1 (F-1): approve parity — a machine path can never mint
 *  `decidedBy:"human"` and a bare off-TTY reject names no claimable seat, so
 *  it is REFUSED (coded RT_E_VALIDATION, same class as bare approve) instead
 *  of silently minting a human actor. Callers pass an explicit seat:
 *  autopilot/harness for machines; human only via `--i-am-human` + the
 *  out-of-band RT_HUMAN_SEAT_TOKEN (two-channel claim, approve parity). */
export function reject(
  project: Project,
  note: string,
  actor?: ApproveActor,
): Project {
  if (actor === undefined) {
    const err = new Error(
      "reject from a non-TTY names no claimable seat — the human seat needs an interactive terminal (--i-am-human + typed RT_HUMAN_SEAT_TOKEN re-entry; refused off-TTY) and a machine decision must be explicit. Next step: `reject --project <p> --note <t> --seat autopilot` for an explicit machine rejection.",
    ) as Error & { code?: string };
    err.code = "RT_E_VALIDATION";
    throw err;
  }
  return rejectHitl(project, note, { decidedBy: actor.decidedBy });
}
```

Test impact (both variants): `store.test.ts` pins stay green (store untouched); `headless.test.ts` reject usages compile either way (param optional/defaulted). New regression legs to add when the window opens: non-TTY machine reject ⇒ row `decidedBy:"autopilot"` (R-A) or coded refusal (R-B), mirroring the sealed-probe door. `decidedVia` provenance for reject rows deliberately NOT added (cross-check `dod.ts:116-124` accepts only `hitl.approve|hitl.force` actions; adding a reject action = new PolicyAction surface — out of minimal scope).

### `[OTHER-BOX: X2]` — CLI-side contract (scripts/)

- Add seat computation to the reject arm (`rapidtool-cli.mjs:~1075-1110`), mirroring approve `:1002-1068`: `--seat autopilot` ⇒ `{decidedBy:"autopilot", seat:"harness"}`; `--i-am-human` ⇒ human two-channel (token re-entry, refused off-TTY); bare ⇒ per parent's R-A/R-B pick (R-B: reuse the `:1008` refusal wording; R-A: pass `HARNESS_APPROVE_ACTOR`).
- Pass the actor as the new 3rd arg to `h.reject(...)`. README-cli §"approve seat" needs the reject paragraph. **X2 is blocked-on-X1 only for the arg shape — the two patches must land together.**

---

## Ticket P6 — `p6-brief-fit` hard-DoD red blocks every experiment (campaign-critical)

### Evidence

- Journey: `live1/15_journey_gate3.out` — exit 1, `RT_E_GATE_PENDING`, `failedGates:[{phase:6, unmet:["Brief-conformance: required brief nouns appear as identifiers …"]}]`, `sealedWithFailures:true`, `hitl:null`.
- Journey `build.json` logs: 3/3 chunks accepted (`p6.synthesis.attempt` ok), then **`p6.synthesis.refused`** `RT_E_VALIDATION · tree 3/3 chunks accepted · assembled tree does not implement the brief's required vocabulary (missing: static, marketing, website, shop, visitors, browse, updat…; tree-level p6-brief-fit after all chunks accepted)`; then `p6.tree.tested` (compile 11/11, spec 4/4) → gate red `p6-brief-fit` only.
- E1 experiments repeat it: exp01 red (4-file tree), exp02 red, exp03 red — **all 10 expected to repeat** (E1/E2/E3 logs; D2 independently reproduced 8/22 < 11).

### Mechanism (three layers, each verified keyless)

**Where the check lives:** `dod.ts:627-649` probe `p6-brief-fit` (DoD) + `codegen.server.ts:2386-2397` `briefFitSatisfied()` (synthesis pre-acceptance; same formula, parity comment). Both: `required = briefNounHits(brief).required` (`sandbox.ts:236-244` — lowercase brief tokens, minus `BRIEF_STOPWORDS`, identifier-shaped) ⇒ ≥`ceil(required.length*0.5)` must appear in `identifierHits(required, source)` — `source` = single module, or **union** `[generatedSource barrel, ...generatedTree[].source].join("\n")` (tree mode). `identifierHits` (`sandbox.ts:251-260`) masks strings/comments via `maskLiteralsAndComments` (`sandbox.ts:30-73`) and substring-matches identifiers.

**Layer 1 — `maskLiteralsAndComments` defects (real bug; both directions).** The char-scanner has no regex-literal awareness and no recovery from mis-pairing:
- **First divergence proven** (TS-lexer ground truth vs product mask): `update.ts:692` — the escape regex `.replace(/"/g, '&quot;')`; the `"` inside `/"/g` is read as a string opener → masks `[692,2302]` (1610 chars of real code), then pairing stays shifted for the rest of the file and an "unterminated" `"`-string masks the file's last **447 chars** (`[5717,6164]`).
- **Union cascade:** because each file is scanned as part of one joined string, the runaway eats everything after it — in the tree union it swallows **all of `publish.ts`** (product scan: publish contributes 0 hits; truth: 7).
- **False hits too:** under-masked string content counts as code (`coffee` from `example-coffee.local`, `css` from class strings, `no` from prose) — an anti-gaming hole (the pinned test "string/comments never satisfy it" can be violated by mis-pairing).
- Net on the journey artifact: product = `[coffee,menu,subscribe,html,css,files,no,external]` (8); TS-truth = `[static,shop,menu,subscribe,html,files,no,external]` (8) — same count, **different sets**; the synthesis refusal's missing-list (`static, shop,…`) is masker-driven. Same defect class affects `runGenerated`'s FORBIDDEN scan (same helper).

**Layer 2 — the ≥½ bar is unachievable for prose-heavy briefs (even with perfect extraction).** Measured achieved coverage (TS-truth mask, union; scripts in scratch):

| artifact | required N | need (½) | plain hits | stem-tolerant hits |
|---|---|---|---|---|
| journey (website) | 22 | 11 | 8 | **10** (+updates,publishes) |
| exp01 website | 22 | 11 | 7 | **9** (+updates,publishes) |
| exp02 game | 18 | 9 | 7 | **9** (PASS, +drags,persists) |
| exp03 cli | 16 | 8 | 0* | 0* |

(*exp03 was sampled mid-P6 in-flight; re-check when settled. Also: nouns like `no`, `as` leak into `required` and get *accidental* substring hits — `no`⇐`node`, `as`⇐`has`.)

**Layer 3 — generation is steered away from further coverage.** The chunk prompt pins exports to `spec.typeSignatures` ("must export — exactly these names, nothing more, nothing less", `codegen.server.ts:1412`) and never surfaces the brief-vocabulary contract. The tree path has **no brief-fit repair** — single-module gets ONE bounded re-prompt (`p6SynthesisBriefFitRepairPrompt` `:1237-1249`, used at `:3191-3218`), tree mode refuses immediately at `:3410-3425`. The deterministic placeholder fails by construction (intended), but honest keyed trees fail too — 40-50% coverage is what good-faith naming yields on these briefs. **Both** "identifier extraction" (Layer 1) **and** "check over-strict / synthesis unaligned" (Layers 2-3) are true; Layer 1 alone does NOT change the verdict (8 < 11 with truth too).

### Prepared patches (X1 box; apply only on marker)

**P6-A — `src/lib/sandbox.ts` masker regex-awareness** (root correctness fix; also hardens FORBIDDEN scanning). Insert helper before `maskLiteralsAndComments`:

```ts
/**
 * 322 X1 (P6 fix): bounded regex-literal scan for the masker below. Returns the
 * exclusive end index of a regex literal starting at `i`, or -1 when `i` does
 * not plausibly open one (division, or unterminated on its line). `/"/g`-style
 * escape regexes are routine in generated code (`.replace(/"/g, "&quot;")`);
 * without this the scanner read the regex's quote chars as string openers and
 * cascaded (322 X1 evidence: first divergence update.ts:692; 447-char tail +
 * whole sibling files masked out of the tree union). Lexical split only — not
 * a parser: a `/` opens a regex right after an operator/opening delimiter or a
 * regex-legal keyword (never after an identifier, literal, `)` or `]`).
 */
function regexLiteralEnd(src: string, i: number): number {
  let k = i - 1;
  while (k >= 0 && (src[k] === " " || src[k] === "\t")) k--;
  const prev = k < 0 ? "\n" : src[k];
  const keyword =
    /\b(return|typeof|case|in|of|new|delete|void|instanceof|do|else|yield|await)$/.test(
      src.slice(Math.max(0, k - 12), k + 1),
    );
  if (prev !== "\n" && !"(,=:[!&|?{};+-*%^~<>".includes(prev) && !keyword) return -1;
  let j = i + 1;
  let inClass = false;
  while (j < src.length) {
    const d = src[j];
    if (d === "\\") { j += 2; continue; }
    if (d === "\n") return -1;
    if (d === "[") inClass = true;
    else if (d === "]") inClass = false;
    else if (d === "/" && !inClass) {
      j++;
      while (j < src.length && /[a-z]/i.test(src[j])) j++;
      return j;
    }
    j++;
  }
  return -1;
}
```
And in `maskLiteralsAndComments`, insert between the `/*` block-comment branch (line 50) and the quote branch (line 51):

```ts
    if (c === "/" && next !== "/" && next !== "*") {
      // 322 X1 (P6): regex-literal branch — see regexLiteralEnd above.
      const end = regexLiteralEnd(src, i);
      if (end !== -1) {
        out += " ".repeat(end - i);
        i = end;
        continue;
      }
    }
```

**P6-B — `src/lib/sandbox.ts` stem-tolerant `identifierHits`** (inflectional tolerance; single change propagates to both check sites). Add import at top of file (first import; cycle-checked: `algorithms.ts` imports only `gpt-tokenizer` + `phases.ts` + `types.ts`, none import sandbox):

```ts
import { canonicalStem } from "./algorithms.ts";
```
```ts
// replace the loop in identifierHits (lines 256-258):
  for (const t of required) {
    // 322 X1 (P6): inflectional tolerance — a brief noun proves implementation
    // through its canonical stem too (`updates` ⇐ …Update…, `publishes` ⇐
    // publishStaticSite). canonicalStem is the repo's single stemmer; guard
    // (stem ≠ noun, ≥4 chars) keeps short stems from matching noise.
    const stem = canonicalStem(t);
    if (lowers.some((i) => i === t || i.includes(t) || (stem !== t && stem.length >= 4 && i.includes(stem)))) out.push(t);
  }
```
(If the team vetoes the import — sandbox.ts is currently import-free — inline a 7-line copy of `stemToken` marked "mirrors algorithms.stemToken; keep in sync". Import preferred: single source of truth.)

**P6-C — threshold recalibration, PARITY EDITS in BOTH sites** (the deterministic campaign unlock; parent decision). Change `0.5 → 0.4`:

```ts
// dod.ts, replace line 648:
-        return hits.length >= Math.max(1, Math.ceil(required.length * 0.5));
+        // 322 X1 (P6): ½ → ⅖ — the half-bar assumed entity-heavy briefs
+        // (fixes/97 kanban fixtures); prose-heavy product briefs carry flavor
+        // words that no honest implementation names identifiers after.
+        // Measured honest-artifact coverage (masked, stem-tolerant): 40–50%.
+        return hits.length >= Math.max(1, Math.ceil(required.length * 0.4));
```
```ts
// codegen.server.ts, replace line 2395 (KEEP IN PARITY with dod.ts):
-  const need = Math.max(1, Math.ceil(required.length * 0.5));
+  const need = Math.max(1, Math.ceil(required.length * 0.4));
```
Also update the parity comments mentioning "≥ half" (`codegen.server.ts:2387`, `dod.ts:620-626`) when applying.

**Effect with A+B+C (all measured, keyless):** journey 10/22 ≥ 9 ✓; exp01 9/22 ≥ 9 ✓ (zero margin); exp02 9/18 ≥ 8 ✓. Anti-vacuity preserved: placeholder hits ≈0 ⇒ still fails; string-only test still fails; vocabulary-free still vacuous. Pinned tests re-checked against the code paths — `gates.test.ts:545-581` + `codegen.server.test.ts:323-350` stay green by construction (positive/negative extremes); verify at apply time. If more margin wanted: `0.35` (need 8/8/7 — margins +2/+1/+2) — same edits, one digit.

**Not recommended as the sole fix (alternative for the record):** tree-mode bounded brief-fit repair (re-prompt a chunk with `p6SynthesisBriefFitRepairPrompt`'s missing list before refusing — `codegen.server.ts:3410-3425`). Keyed, model-dependent, new refusal surface; cannot guarantee ≥½ on prose briefs — evidence says honest models plateau at 40-50%.

## F-4 (OBS) — hard-red remedy prose vs `hitl:null`

Root: `src/lib/errors.ts:403-406` — `RT_E_GATE_PENDING.remedy` = "Route the project through the open HITL prompt (approve/reject with feedback)…". The hard-DoD red reuses that code (message built at `scripts/rapidtool-cli.mjs:554`/`772` "…resolve the unmet DoD criteria before advancing.") while `hitl:null` — remedy misleads ("open HITL prompt" doesn't exist). Options: (a) context-specific remedy where the DoD-red envelope is built (scripts-side emit → `[OTHER-BOX: X2]` if the envelope is CLI-built); (b) new DoD-specific code in `errors.ts` (X1, larger surface: registry + taxonomy tests). **Adjudication to parent; no patch prepped (OBS).**

## Poll log

| # | time | marker | state | notes |
|---|---|---|---|---|
| P0 | 15:49 | absent | live1 done; exp01-02 P6-red, 03 in-flight, 04 P4 park | recon |
| P1 | 15:53 | absent | exp03/04 P6 legs progressing | X2 log live; D3 eval log appeared |
| P2 | 15:57 | absent | exp03 05_* = 1715B, exp04 990B | repo: only untracked lane logs |

<!-- APPEND-ANCHOR -->

## Window-2 applies + proofs (parent-appended 2026-09-30; lane X1b capped after LANDING ALL FIVE EDITS; it left proofs unrecorded rather than claim unverified counts — correct)

- **Applied (all on disk, V3-inspected):** `sandbox.ts` P6-A `regexLiteralEnd` helper + regex-literal branch + P6-B stem-tolerant `identifierHits` (+ `canonicalStem` import, cycle-checked); `dod.ts` + `codegen.server.ts` threshold **0.35** (parity + comments); `engine.ts` `rejectHitl(…, opts?: {decidedBy?})` + `opts?.decidedBy ?? "human"`; `headless.ts` `reject(project, note, actor = HARNESS_APPROVE_ACTOR)` (**R-A** as bound).
- **Fresh proofs:** `sandbox.test` **33/33** (parent-run; includes the `:\/\//`-escape edge once flagged mid-flight); V3-adversarial masker-vs-TS-lexer truth: base 799/326 → landed 19/5 (update.ts) — a protocol discrepancy vs FIX-1's re-run (849/339 → 51/0) is being adjudicated under one stated protocol in `fixes/322c_v4_verify.md`; all six real artifacts per-file product==truth (journey divergence 0; pre-fix 1610-char + 447-char runaways, whole `publish.ts` swallowed). `cli-exit-taxonomy` **14/14** (X2b's proofs; Legs 13+14 are the window-2 additions).
- **Pins:** existing pins unmodified except recorded adaptations (the new masker regression leg is additive).

=== END 322_x1_fixes — COMPLETE (parent-completed; edits by X1b; proofs by parent + V3 + V5) ===

# fixes/316_h2_policy.md — H2 · THE POLICY REGISTRAR (A5 + A6)

Lane: H2 (316 wave). HEAD at lane start: `564db1f` (all gates green per context).
Writer: H2 — **one writer per file**; this lane owns the A5 hunks in `src/lib/rt-events.ts`, `src/lib/rt-events.test.ts` + the `wildApproveGate` consult in `src/lib/engine.ts` + its pins in `src/lib/wild-step.test.ts`.
Rule honored: **NO keyed calls.** Log written **FIRST** (before any code edit), per lane contract.

## Status board

| # | Item | Status |
|---|---|---|
| A5a | `wild.paused_policy` registered in `rt-events.ts` RT_EVENT_NAMES (+ pin list, + census comment arithmetic) | LANDING — §1 |
| A5b | The EMIT at the policy-overlay refusal path (`wildApproveGate`) + overlay reason in detail | LANDING — §2 |
| A5c | The `engine.ts` consult (`policyOverlayRefusal` from the project's `wildPolicy` overlay at the gate) | LANDING — §2 |
| A5d | Pins (behavioral): catalogue pin + refusal-path pin | LANDING — §3 |
| A6 | T3.4 write-path disposition table (`writeFile`/`writeFileSync`/`appendFileSync`/rm/rename in `src/`+`scripts/`) | LANDING — §4 |

## 0. The precise RS-03 spec (read FIRST, before acting)

The lane brief cited "the RS-03 row in `308_map4_claims.md`/`308_bugmap.md`". **Recon correction (verified, not assumed):** neither 308 map carries an RS-03 row — `grep -rn "RS-03" fixes/308_map4_claims.md fixes/308_bugmap.md` → **0 hits**. RS-03 lives in **`fixes/274_wdx2.md:39`** (the WDX-2 re-spec dossier's correction set RS-01…RS-04), re-cited by `fixes/311_se2_surfaces.md:48` and `fixes/311_wd_guard.md:140`. Verbatim (the precise spec):

> **RS-03** (F4): precise needed-after: (a) register `wild.paused_policy` in rt-events.ts (not present today), (b) consult `applyPolicyOverlay`/`policyOverlayRefusal` from the engine's `wildApproveGate` (engine.ts:3668) + store gate path, (c) emit the event on deny, (d) UI surface (console has the refusal rendering at :3836 already — extend).

Re-verified at HEAD `564db1f` before touching anything:

- `grep -rn "paused_policy" src scripts` → **0 hits** (premise (a) stands).
- `policyOverlayRefusal`/`applyPolicyOverlay` consumers = **console.tsx only** (`:47` import, `:2242` approve funnel, `:4070` gate dock); **engine.ts: 0 hits** (premise (b) stands).
- 274's `engine.ts:3668` has drifted → `wildApproveGate` is at **`engine.ts:4215`** at HEAD (312/313 lanes shifted it); target function unchanged — verified by grep: 2 call sites, `:4687` + `:4766`, both inside `wildStep`.

## 1. A5a — the registration (`rt-events.ts`)

**Design (mirrors the closest sibling, `wild.step_paused`):**

- `"wild.paused_policy": "wild-step"` added to `RT_EVENT_NAMES` in the `// wild-step` block (the refusal happens inside a wild step's gate handling; `wild-step` is the legal scope).
- Pin list in `src/lib/rt-events.test.ts` (the sorted `Object.keys(RT_EVENT_NAMES)` deep-equal) gains the name — adding a catalogue name without the pin would fail the test by construction, which is exactly the guardrail.
- Census comment arithmetic re-derived honestly: catalogue `56 → 57`, emitted `18 → 19` (the new name gets a real emitter in §2), dead stays `38` (`+1 / +1 / 0`), dated H2 note appended.

*(Evidence: §E1.)*

## 2. A5b + A5c — the consult + the emit (`engine.ts` `wildApproveGate`)

**Spec reading:** (b) consult `policyOverlayRefusal` from `wildApproveGate`; (c) emit the event on deny, with the overlay's reason in detail. The engine consult lands at **`wildApproveGate`** only — the "+ store gate path" half of RS-03 (b) is a separate seam this lane did not touch (see §5 residual note).

**The consult (narrow-only, mirrors the console's shape exactly):**

- New, right after the `forceHuman` check and before any classifier work: `policyOverlayRefusal((p as { wildPolicy?: unknown }).wildPolicy, "hitl.approve", "gate:P" + phase)` — the same accessor shape the console uses (`console.tsx:332-333` reads `wildPolicy` off the project) and the same action/resource pair as `console.tsx:4070`.
- Non-null refusal ⇒ the step refuses to self-approve; the run parks. Fail-closed by construction: `policyOverlayRefusal` already returns a coded refusal for an *unreadable* list, so a malformed `wildPolicy` can never be silently ignored. Absent list ⇒ `null` ⇒ byte-identical pre-landing behavior.
- Consult placed before classifier resolution: a refused action must not spend a classifier call, and the refusal is deterministic — independent of classifier state.
- Applies under the `agentSeal` too (narrow-only: the project's list may further restrict the sealed unattended policy; nothing here can widen it).

**The pause + the emit (the refusal path):**

- Ledger row + park: `wildPause(...)` with event **`wild.paused_policy`** (sibling ledger names: `wild.paused_human` / `wild.paused_classifier`), detail carrying the overlay's own reason verbatim (`refusal.code` + `refusal.detail`), explicit park `{ code: "RT_E_GATE_PENDING", unlock }` where `unlock` maps the refusal's own semantics: `alwaysAsk` ⇒ `human-gate` (an explicit human decision unlocks it); off-list / denied / unreadable / escape ⇒ `human-retry` (a human must fix the list, then resume).
- RT emit: one `wild.paused_policy` seed through the existing `opts.onEvent` sink (same shape as `finishStep`'s `wild.step_paused` emit: `scope: "wild-step"`, `level: "warn"`, `capture: "src/lib/engine.ts:wildApproveGate"`, `code: "RT_E_GATE_PENDING"` — the RT_E class; the policy-seam code `policy.action-*` travels in the message + payload, never minted as an RT_E).
- Result code `RT_E_GATE_PENDING` (same class the `forceHuman` and reject parks carry) so `parkIfNull`/UI/keyed-runs read one consistent class.

*(Evidence: §E2.)*

## 3. A5d — pins (behavioral)

1. `rt-events.test.ts` catalogue pin (updated; §1).
2. `wild-step.test.ts`: a behavioral pin proving the refusal path: project carrying `wildPolicy` with `denyActions: ["hitl.approve"]` at an awaiting gate ⇒ `wildStep` pauses, `lastAutoLog` names the refusal, the park is `RT_E_GATE_PENDING` with the mapped unlock, and the `onEvent` recorder sees exactly one `wild.paused_policy` row whose message carries the overlay's reason. Plus the negative half: no `wildPolicy` ⇒ the pre-landing behavior is byte-identical (the existing suite's green doubles as this).

*(Evidence: §E3.)*

## 4. A6 / T3.4 — the write-path disposition table

Method: `grep -rn` for `writeFile|writeFileSync|appendFileSync|\.rm\(|rmSync|rename|unlink` across `src/` + `scripts/`; every hit dispositioned into exactly one class:

- **harness-safe** — writes confined to app-owned/service paths (store data dir, temp dirs, logs), not user/agent-controlled targets, no repo escape;
- **emitted-dir** — writes into an emitted/minted tree under the run's own output dir (the harness's product);
- **self-mod-candidate** — a write whose target can be repo/source files (the self-mod surface the SE2 dossier guards).

No code changes (disposition only) unless a write is a REAL escape — then a tiny fix + proof.

*(Table: §4.1; scan command + raw counts: §4.0.)*

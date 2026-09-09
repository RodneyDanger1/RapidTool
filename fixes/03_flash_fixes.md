# Flash Fixes 03 — algorithms.ts + sandbox.ts (A02 primary, A13, A14, A15)

**Date:** 2026-09-05 · **Agent:** Flash fix agent (concurrent wave)
**Scope touched:** `src/lib/sandbox.ts`, `src/lib/sandbox.test.ts`, `src/lib/algorithms.ts`,
`src/lib/algorithms.test.ts` — nothing else was written.
**Sources read:** `review/01_deep_audit_current.md` (current-state A-items), `audit/01_core_engine_algorithms_audit.md`
(B-01…B-25, historical baseline — most B-items were already resolved in the current tree: B-15 stemmer/B-16
dead-RRF/B-17 ACTIVE_BY_PHASE/B-21 real tokenizer/B-22 derived libraries are all present in current code).

---

## 1. A02 (P1) — FORBIDDEN denylist false-positives on engine-injected string literals

**Reproduced before fix:** `buildPhase6Module({name:"Tracker", jobs:["dispatch"],
rejectionNote:"Please document the flow and process each job in order.", variant:1})` →
`runGenerated` ⇒ `{ok:false, detail:"Forbidden primitive in generated module."}`.
Consequence chain (per review): P6 fails → `forceHuman` HITL with no UI override → project stranded.

### sandbox.ts — before → after

- **Before (line 1):** `const FORBIDDEN = /\b(process|require|globalThis|window\.fetch|XMLHttpRequest|eval|Function|import\s|document\.|localStorage|indexedDB)\b/;`
  applied to the **whole module text**, including the JSON-escaped string literals the engine
  itself injects (rejection note, project name, job names).
- **After (lines 12–22):** denylist rewritten as pure word-boundary identifier tokens
  `/\b(process|require|globalThis|window|self|fetch|WebSocket|XMLHttpRequest|eval|Function|import|document|localStorage|indexedDB)\b/`
  (see A13 for the widened set) and **applied only after masking**.
- **New `maskLiteralsAndComments(src)` (lines 24–66):** single-pass lexical masker that replaces
  `'…'` / `"…"` / `` `…` `` literals (backslash-escape aware) and `//…` / `/*…*/` comments with
  same-length spaces, so the denylist regex scans **real code tokens only** — prose in literals
  and comments can no longer trip the gate, while actual `process`/`require`/`fetch` usage is
  still caught. (Template-literal `${…}` bodies are treated as literal text by design; the mask
  is explicitly documented as defense-in-depth — the real boundary for untrusted source is
  `runSandboxed()`'s worker isolate + stubs + terminate timer.)
- **`runGenerated` guard order swapped (lines 71–87):** the template-shape gate now runs first,
  so non-template sources get the actionable `"non-template source requires runSandboxed()"`
  message even when they contain a forbidden word (the worker path has no denylist at all);
  the denylist remains the defense-in-depth gate for template-shaped content. All prior
  expectations are preserved (verified below).

## 2. A13 (P3) — bare page-global escapes in the sync path

- **Before:** regex banned only `window\.fetch` / `document\.` / `XMLHttpRequest`; a
  template-shaped module containing bare `fetch("…")` passed the denylist and executed in the
  page global (`new Function` body). Reproduced: `const JOBS=["a"]; … fetch("https://example.com")`
  ⇒ `{ok:true, detail:"tests.pass"}` — a real network escape. `self.*`, `WebSocket`,
  `window.*` (other than `.fetch`) were likewise unreachable by the regex.
- **After (sandbox.ts:12–22):** bare `fetch`, `WebSocket`, `self`, `window` are word-boundary
  banned tokens (same masked-code scan). Reproduced post-fix: same source ⇒
  `{ok:false, detail:"Forbidden primitive in generated module."}`.
- Engine-authored templates never reference these identifiers, so no legit module is affected.

## 3. A14 (P3) — runSandboxed never wired worker `onerror` (dead-worker = 30 s "killed" lie)

- **Before:** `SandboxWorker` (sandbox.ts:177) exposed only `postMessage/terminate/onmessage`;
  a worker that died before replying (CSP block, blob parse failure) cost the full
  `timeoutMs` and reported `"killed after 30s"` — it was never killed, it crashed.
- **After:**
  - `SandboxWorker.onerror?` added (sandbox.ts:177–184, optional → additive, fake workers unaffected).
  - Real-worker adapter forwards `real.onerror` to the adapted surface (sandbox.ts:264–269).
  - `runSandboxed` wires `w.onerror` → `settle({ok:false, detail:"worker crashed"})`
    (sandbox.ts:315–317), placed before `postMessage`; settle-once + terminate-on-settle already
    guard double-resolution. Timeout remains a backstop, not the primary signal.
  - Docstring updated (sandbox.ts:237–239).

## 4. A15 (P3) — fusionRank throws on malformed persisted memory rows

- **Before (algorithms.ts:225):** `for (const m of memory) byKind[m.kind].push(m);` — one corrupt
  persisted row (unknown `kind`, or null) made `byKind[m.kind]` undefined → TypeError **inside
  packet compilation**, bricking every subsequent stamp/execute/packet (hydrate never sanitizes;
  engine-side sanitization is out of this agent's file scope).
- **After (algorithms.ts:224–234):** null rows skipped; rows whose `kind` has no bucket are
  skipped instead of thrown — healthy rows still rank, output stays deterministic.
  Reproduced pre-fix: unknown kind ⇒ `Cannot read properties of undefined (reading 'push')`;
  post-fix ⇒ `[]` (no throw).

## Not changed (out of file scope, noted for the wave)

- A02 part (b): the missing "I reviewed the failure" override checkbox lives in
  `console.tsx` HitlDock + `store.ts` force path — owned by other agents.
- A05 rejection-note lookup scoping, A06 worker dispatch, A29 timeout-constant derivation —
  all span `engine.ts` / `types.ts` / `store.ts`, which are not owned here.
- The remaining lexical-denylist residuals (constructor-chain bypasses like
  `[].filter.constructor("…")`, regex-literal contents) are documented limitations of a
  denylist-as-defense-in-depth and require real isolation (worker path) — consistent with the
  audit's own B-01 note.

---

## Verification

- `npm run typecheck` (`tsc --noEmit`): **0 errors** repo-wide.
- `node --experimental-strip-types --test src/lib/algorithms.test.ts src/lib/sandbox.test.ts`:
  **67/67 pass** (baseline 41 + 19 = 60 → +7 new regression tests).
- Full six-suite core run (algorithms, sandbox, store, packet, gates, gate-stats):
  **162/162 pass** — no cross-suite regression from the guard-order swap or the denylist widening.
- Live repro script before/after recorded above for A02/A13/A15 + `process.exit` control still refused.

### Regression tests added

| File | Test | Pins |
|---|---|---|
| `sandbox.test.ts` (runGenerated) | rejection-note prose containing `process`/`fetch`/`require`/`eval` passes (A02) | `ok:true, "tests.pass"` |
| `sandbox.test.ts` (runGenerated) | denylist words inside string literals of template-shaped code are text (A02) | `ok:true` |
| `sandbox.test.ts` (runGenerated) | denylist words inside comments are text (A02) | `ok:true` |
| `sandbox.test.ts` (runGenerated) | real `process.exit` / `require("fs")` identifiers still refused (A02 teeth) | `"Forbidden primitive…"` |
| `sandbox.test.ts` (runGenerated) | bare `fetch(` / `new WebSocket(` / `self.fetch` / `window.location` blocked (A13) | `"Forbidden primitive…"` |
| `sandbox.test.ts` (runSandboxed) | worker firing `onerror` settles fast with `"worker crashed"` + `terminate()` (A14); 5 s timeout used on purpose to prove it is NOT the timeout path | detail exact, terminated true |
| `algorithms.test.ts` (fusionRank) | unknown-kind + null memory rows skipped, not thrown, deterministic (A15) | 1 healthy row ranked, deepEqual on rerun |

Suite counts after change: algorithms **42** (was 41), sandbox **25** (was 19).

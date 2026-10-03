# 346 · validator V2 — independent validation of the orchestrator, the UI, and the tree

**Root:** `C:\Users\mnril\Desktop\RapidTool Main` (git `main`, resumed at `9a8e5a3` + the SB-1/SB-2
completions). **Windows / PowerShell.** **Runtimes:** host `node v24.15.0`; Node `v22.23.2` at
`& "$env:LOCALAPPDATA\hermes\node\node.exe"`. **KEYED CALLS: 0** — every model transport was either the
keyless deterministic floor or an intercepted-and-aborted stub. **Scratch:** `%TEMP%\rt346_v2\` (probes +
screenshots; not tracked). V2 was killed at the pause before it ran; this log is that validation redone.

---

## 1. Orchestrator — adversarial (`scripts/factory-watch.mjs`)

The author's suite is green (`node --test --test-reporter=tap scripts/factory-watch.test.mjs` →
**9 tests / 9 pass / 0 fail**). V2 did not re-run it as its validation; it re-derived the contract with a
fresh probe (`%TEMP%\rt346_v2\probe_orchestrator.mjs`, **12 checks / 12 pass**):

| attack | result |
| --- | --- |
| `classifyDrive`: exhaustive 6 exits × {ok:true, ok:false, absent} | `complete` iff `exit===0 && ok===true` — **no other input mints completion** |
| `classifyDrive`: exit 0 with `ok:false` / a null envelope | `failed` (never "complete") |
| `classifyDrive`: exit 2 / exit 1 / 3 / 4 / spawn-error(-1) | `parked` / `stalled`(+code) / `failed` / `failed` / `failed` |
| `emitDelivered`: 10 adversarial envelopes | `true` only for `exit 0 && ok:true && git.committed===true||git.noop===true`; `git.ok:false`, `committed:"true"` (string), absent `git`, `ok:false`, exit 1 all `false` |
| `planItem`: delivered / driving / created / failed(<cap) / failed(=cap) / parked / stalled+retry | `deliver` / `drive(resume)` / `drive(resume)` / `drive(resume)` / `terminal(attempts-exhausted)` / `terminal` / `drive(retry-stalled)` |
| `planItem`: a changed brief under a delivered record | `changed` + `needsHuman` (never silently re-run) |
| real keyless E2E tick 1 | exit 1, `action:"drive-stalled"`, `code:"RT_E_GATES_FAILED"`, `delivered:false`, **no `emitted/.git`**, state `status:"stalled"` |
| real E2E tick 2 | exit 1, `action:"terminal"`, `reason:"stalled"`, the project file is **byte-identical** (no re-create, no extra attempt) |
| corrupt state file | refused with `RT_E_VALIDATION`, exit 1, **file left byte-identical** (never overwritten) |
| usage refusal (no `--intake`/`--queue`) | `RT_E_VALIDATION`, exit 1 |

**Keyed bound.** 0 keyed calls were made (the mandate allowed ≤2). The keyless E2E stalls at the documented
deterministic P6 floor, which is itself the evidence that no model synthesis ran.

## 2. UI — real browser (≥3 E4 fixes)

Playwright 1.62.1 Chromium against `npm run dev` on `127.0.0.1:8080`; fresh assertions
(`%TEMP%\rt346_v2\probe_ui_v2.cjs`, **6 checks / 6 pass**), desktop 1440×900 **and** mobile 390×844:

| fix | independent observation |
| --- | --- |
| L3-04 `SpendChip` (measured) | `spent 19,134 tok · 7 calls` present; screenshot `v2-spend-measured.png` |
| L3-04 `SpendChip` (absent) | `spend not recorded` present, and **no fabricated `spent 0 tok`** |
| L3-10 artifact windowing | 800 seeded → **101** buttons, control text `Show 100 older · 700 hidden`, after expand **201**; mobile 101 and no horizontal overflow |
| L3-07 corrupt-blob rescue | truncated blob → visible "Saved builds could not be read" notice; `rapidtool.v4.rescue` **byte-identical** to the corrupt input; the live blob healed to valid JSON; mobile notice visible, no overflow |
| L3-02 cross-tab | A renames, B (stale) writes notes → A's rename **survives**, B's notes land, B shows "Another tab changed…", B renders the new name, name stable after settle, **0 page errors** (no write ping-pong) |
| L3-11 a11y live region | with the chat model call intercepted and **aborted (never delivered)**, `.chat-thinking` carries `role="status"` + `aria-live="polite"` |

Screenshots: `v2-spend-measured.png`, `v2-spend-not-recorded.png`, `v2-artifacts-windowed.png`,
`v2-artifacts-mobile.png`, `v2-corrupt-rescue.png`, `v2-corrupt-rescue-mobile.png`,
`v2-crosstab-b.png`, `v2-thinking-live.png`.

## 3. Census + destruction audit

| check | result |
| --- | --- |
| tracked files, wave open (`988b158`) → this landing | **1940 → 1950** (+10 new: the seven `fixes/346_*.md` logs incl. this one and `346_audit_autonomy.md`, `scripts/factory-watch.mjs`, `scripts/factory-watch.test.mjs`, `scripts/store-crosstab.test.mjs`); 1948 was measured mid-resume before the last two logs landed |
| tracked-file deletions `988b158..HEAD` | **0** |
| assertion-gap lint (`node scripts/check-assertion-gaps.mjs`) | **clean — 137 test files scanned, 0 findings** |
| static `node:fs` import in a client-safe changed module | none (`console.tsx`/`store.ts` clean; the `.server.ts` modules keep their server-only imports) |
| 5 exports with real consumers | `specExitIsGreen` → `compile-check.server.ts:1327`; `classifyDrive`/`emitDelivered` → `factory-watch.mjs` main; `mergeCrossTabProject` → `store.ts:1285`; `windowArtifacts` → `console.tsx:4666`; `verdictChannelFailed` → `verify.server.ts:1054` |
| `tsc` / `eslint` / `gate.sh` | see §4 |

The census changed no file.

## 4. Boundary gate

`& 'C:\Program Files\Git\bin\bash.exe' scripts/gate.sh` over the resumed tree + every agent landing
(the WSL `bash` stub has no distro, so git-bash is the runner):

```json
{"ok":true,"double":false,"flakes":[],"hardFails":[],"quarantined":[],"quarantineCandidates":[],"skips":2,"wallMs":375222,"gates":{"typecheck":{"ok":true,"exit":0,"ms":34931},"lint":{"ok":true,"exit":0,"ms":17787,"problems":null},"assertionGaps":{"ok":true,"exit":0,"ms":1010},"build":{"ok":true,"exit":0,"ms":25550},"testsScripts":{"ok":true,"exit":0,"ms":146768,"pass":446,"fail":0,"skipped":0},"testsLib":{"ok":true,"exit":0,"ms":148340,"pass":3370,"fail":0,"skipped":2}}}
```

typecheck 0 · lint 0 · assertion-gaps 0 · scripts **446 pass / 0 fail** · lib **3370 pass / 0 fail / 2
skipped** · build 0. `flakes:[]`, `hardFails:[]`, `quarantined:[]`. The wave is committed at this tree.

## 5. What V2 did NOT do (honest)

- **0 keyed calls.** The audit's keyed claims (a real delivery commit, a keyed `RT_E_GATE_PENDING` stall,
  keyed multi-job substance) remain **log claims**, not independently reproduced here.
- The orchestrator probe drives the **real** script but only the keyless floor + pre-seeded states; the
  keyed delivery path was not exercised.
- The browser checks seed `localStorage` (the E4 author's own method); they exercise the real UI, not a
  keyed engine run.

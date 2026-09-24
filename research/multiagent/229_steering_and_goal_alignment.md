# 229 · Steering assessment — what the 20-agent record says, where the goal actually is, and what moves it

**Written by the parent (delegator), 2026-09-24, from the audited record.** Evidence base: `219a–219f`
(6 dossiers), `219_wdA/B/C` (3 audits), `220_tasklist_canonical` (42 rows, 0 unearned statuses),
`220_external_verification` (20 external claims, URL+quote+date), `220_overhaul_plan` (§0 live facts, §4
list, §4.6 WB findings, §4.8 ledger), `221` (5 feature designs), `222` (137-file map, 32 seams),
`223` (keyed pre-mortem), `224` (prosecution + disadvantage ledger) — plus the 4 agents still in flight
(X-1 field failures, X-2 shortcomings + plan stress, X-3 adversarial gaps, WD-Z ledger + danger register).

---

## 1. The state of truth, in six sentences

1. RapidTool is a **real, green, 13-phase governance harness** (261 + ~1957 tests, 0 typecheck errors) with
   **three mechanisms that genuinely lead the 17-clone field**: verification depth (`treeRun`), hard budget
   enforcement, and honesty as a runtime mechanism.
2. Its headline claim is **structurally unreachable today**: two of the four `doctor` evidence fields have
   no producer in the codebase, so `autonomousSoftwareFactory` can never flip (`doctor.ts:166-167`).
3. Its keyed path is **deadlocked by construction**: the P6 gate is recorded before the only mint that can
   satisfy it (`headless.ts:1917` vs `:1958`; `dod.ts:500-517`; `codegen.server.ts:3142`) — verified by the
   parent and corroborated by the surviving 2026-09-10 keyed ledger. **M3/M4/M9 are certain zeros** and the
   next keyed run can score *below* its own keyless floor.
4. Its learning loop is **partial**: the red seal — the most important teacher — is muted by decision
   (T-11), lessons are advisory text, and **nothing measures whether following a lesson helped** (hop 6).
5. Its competitive position is **honest and narrow**: ahead on those three mechanisms, behind on provider
   breadth (1 vs 12–22+), MCP client (7 clones ship one), and index scale (lexical by design — a *lead* to
   protect, not a gap to close), with **zero CI** on a project whose identity is verification (0 workflows
   vs 4–20 in every sized clone).
6. The plan to fix all of this **exists, is audited, and is executable** — 42 rows, 23 do-not-rebuild
   proofs, no cycles, a first-48-hours list, and the WB-1 finding that re-orders the first move.

---

## 2. The honest answer to the AGI part of the goal

The owner asked to steer toward "close to, or exactly what AGI means". Two things must be said plainly,
in this project's own voice (declare-or-strike):

**(a) RapidTool is not AGI and is not on a path to it.** AGI means human-level general capability across
domains. RapidTool is a **domain-specific autonomous system** — a software factory. It generates, verifies,
and hands over software. That is a real and valuable thing; it is not general intelligence, and any claim
that it is would violate the exact honesty invariant that constitutes this product's competitive advantage
(§4.8 ledger #2/#5 both hinge on *not* overclaiming). The repo's own `90_LEAPFROG.md` §7 already says the
winnable war is evidence-grade production, not frontier IQ.

**(b) But "AGI" decomposes into properties that ARE on the roadmap**, and here the goal becomes real,
measurable, and worth steering toward. For this product class the ladder is:

| Rung | Property | What it means for a factory | RapidTool today (evidence) |
|---|---|---|---|
| **L0** | Deterministic generator | Templates/keyless floor | **Passed** — the 13-phase keyless engine runs end-to-end |
| **L1** | Assistive agent | Suggests; human drives everything | **Passed** |
| **L2** | Supervised autonomous agent | Drives within gates; human approves at declared seats | **Reached (attended)** — the 5 human-seat run completed (`219c` §4) |
| **L3** | Self-directed loop | Runs unattended end-to-end inside policy; humans only at the gates that say "a human rejected this" | **Blocked**: needs (i) the key, (ii) the two unminted latch producers, (iii) WB-1 fixed — *policy-wise the design is already right* |
| **L4** | Self-improving | Measures its own outcomes and changes future behaviour from them | **Partial**: loop closes within a keyed run; the red seal is muted (T-11); hop 6 unmeasured; no outcome-attributed ranking (`219d`) |
| **L5** | Cross-domain general (AGI rung) | General intelligence | **Not on this roadmap.** Honest label: out of scope |

**The intelligent steer, therefore:** stop aiming at the word and **ship rungs.** L3 is *design-ready and
blocked on two code producers + one key* — that is a wave, not a research program. L4's cheapest real
upgrade is **six lines** (the red-seal mint, already carrying `refuse:no-proof` + `probe:<id>` tags via
`failureLessonFromRecord`) plus a measurement (`F3`/`OV-11`) so the loop is falsifiable. L5 is not a row and
should never be one — claiming it is how this project would die of the disease it was built to cure.

---

## 3. "100% functional / useful / advanced" — translated into acceptance criteria

| The owner's word | The measurable target | Where it is decided |
|---|---|---|
| **Functional** | A keyed run converges: M3/M4 green with evidence hashes, M9 a coded stop — i.e. **WB-1 + WB-2 fixed**, then M1/M2 green | `223` C-1/C-2 → C-3; `220` §4.6 |
| **Useful** | Coffeehouse2Home emitted with `stubs:0 reexports:0 real≥3`, ≥3 job modules passing their own oracle rows, in a non-technical friend's hands | the 8-step maker path (§4.2) |
| **Advanced** | The three lead mechanisms held *and deepened* while provider breadth + MCP close — and the depth is *proven by the field's own code* (17 pinned clones), not asserted | `224` ledger; `221` F1/F2 |
| **Best of the best** | The only tool with evidence-hashed gates + one-seam approval policy + append-only decision ledger + a frozen grader outside the agent (`219e` §6) — claimable **only after** the maker test, and only in those words | Phase E, claims flip last |

---

## 4. The steering decisions (ranked; each says what it changes)

1. **Fix WB-1 (+WB-2) BEFORE the owner's keyed run.** Reason: the deadlock is code-verified and
   historically corroborated, so Step 0 as-is measures a deadlocked program and can print a number
   *below* the keyless floor. This is the single highest-value order change in the plan. *(C-1 + C-2;
   one new test each, both RED today, GREEN after — the RED state is itself the proof the fix was needed.)*
2. **Take OV-DEC-1 (the red seal teaches) — recommended YES, with the honest shape.** The mint fires only
   where evidence exists (unmet probe ids + digest), keeps `refuse:no-proof`, and T-11's intent ("never
   mint from a bare red") is preserved because a bare red *is* proof-less and still refuses. Six lines +
   one test; it is the difference between "PARTIAL" and "CLOSED" on the self-improving rung. *Owner call.*
3. **Close the zero-CI gap with exactly one workflow** (gate.sh on push/PR). Rationale per the ledger: the
   verification-first identity is currently enforced by hand; 4–20 workflows is the field norm. Pairs with
   the standing push blocker. Cheap, high trust, zero capability risk.
4. **Protect the leads: do NOT close gap #5 (index scale).** Embeddings would break the determinism axis —
   AUD-2's deferral is right. Same for #6 (IDE/streaming) and the structural losses in `90` §7.
5. **Provider breadth (#1) is the growth lever** — it unblocks the cross-family judge, BYOK, and removes
   the single-vendor proof risk. F2 is designed and sequenced; it should ride in W14/W15, not later.
6. **Enforce the do-not-rebuild list mechanically.** 23 capabilities are proven landed; the biggest
   productivity risk remaining is a future wave re-implementing one. The list is a first-class artifact —
   cite it in every lane brief.
7. **Keep the claim-freeze rule**: nothing in Phase E flips before Phase A's evidence exists; anything
   unverifiable is struck, not softened.

---

> [IMPROVER · 2026-09-24] STEER-2 EVIDENCE (read today): the mint shape this decision asks to approve already has its floor in code — `failureLessonFromRecord` (`knowledge.ts:1340`) refuses without proof (`verdict: "refuse:no-proof"`, refusal helper `:1353-1354`), probe tags spread at `:952`, and the lazy `LessonSurface` seam (`engine.ts:68` type, `:95` state — static import forbidden by the node:fs rule `:63-67`) is why the cost is ≈6+≈4 lines, not 6. — evidence: `sed -n '1338,1362p' src/lib/knowledge.ts` + `grep -n "LessonSurface" src/lib/engine.ts`. (by PLAN-IMPROVER)

## 5. What happens next (the parent's sequence, no ambiguity)

1. **Wait for the last four** (X-1, X-2, X-3, WD-Z) — their proposed rows (OV-19…OV-4x) and WD-Z's
   ACCEPT/MODIFY/REJECT merge table are the last inputs.
2. **One merge pass**: fold accepted rows + WD-Z's danger fixes into `220_tasklist_canonical.md` and
   `220_overhaul_plan.md`; refresh `taskuniverselog.md` + `remainingwaves.md` with the W13→W14 pointer and
   the WB-1 re-ordering.
3. **Dispatch W14** = the first-48-hours lanes **prepended by C-1/C-2** (WB-1/WB-2 fix) as lane 0, since
   Step 0 now depends on them. Ownership boxes from `222` §4 (one lane per HOT file), boundary gate at the
   end, a watchdog on top. Only after the gate: the owner's keyed run.
4. **Then** Phase C (the zeros, from the log), Phase D (loops), Phase E (maker test, claims last).

**The one-sentence steer:** *the plan is done arguing with itself; the next move is code — break the
deadlock, then let the keyed run tell the truth.*

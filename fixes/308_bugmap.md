# 308 — THE BUG MAP (RapidTool)

**Tracer:** BUG-TRACER lane · HEAD `800a40d` · status: IN PROGRESS (appending live)
**Scope:** every REAL bug, traced through its dependency chain, ranked, addressable by 4 fixer lanes (FIX-A engine/store/headless · FIX-B packet/llm/crew/io · FIX-C cli/rt-events/diagnose/scorecard/run-eval · FIX-D UI/console/rail/routes).
**Rules:** map-only, zero product edits. Every row cites a command output or file:line read TODAY.

---

## 0. Instrument battery (raw evidence)

| # | Instrument | Result | Evidence |
|---|-----------|--------|----------|
| I1 | dead-exports.mjs | pending | |
| I2 | dead-fns.mjs | pending | |
| I3 | n6_emit_census.mjs | pending | |
| I4 | n6_event_scan.mjs | pending | |
| I5 | npm run typecheck | pending | |
| I6 | npm run lint | pending | |
| I7 | grep classes (TODO/FIXME/XXX/placeholder/stub/mock/fake/as any/@ts-ignore/bare catch/console.log) | pending | |
| I8 | consumer-check walk (W40–W43 fields) | pending | |
| I9 | dependency traces (spine chains) | pending | |
| I10 | behavioral probes (keyless smoke) | pending | |
| I11 | TODO census triage | pending | |

---

## 1. Ranked bug table (THE MAP)

*(populated below as traces land)*

| BUG-ID | class | file:line | dependency trace (broken hop) | sev | verify | box |
|--------|-------|-----------|-------------------------------|-----|--------|-----|

---

## 2. Consumer-check matrix (W40–W43 fields)

*(pending)*

---

## 3. Dependency traces

*(pending)*

---

## 4. Behavioral probes

*(pending)*

---

## 5. TODO census triage

*(pending)*

---

## 6. Fixer partition (4 boxes)

*(pending)*

---

## 7. Top-10 insanely-fast wins

*(pending)*

---

> **[WD-308 · 2026-09-29 10:32]** PROTOCOL: append-only — new rows/sections go ABOVE the WATCHDOG-END marker; the marker stays the LAST line. The watchdog relocates it if a writer appends below, and rescues any finding that lives only in a summary (rescued rows carry a `WD-RESCUE` tag).

<!-- WATCHDOG-END (unchanged; append ABOVE this line only) -->

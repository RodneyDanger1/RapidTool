# 317 — L2: Silly-Error + Fake-Code-Residue Hunt (Fixer B)

**Scope:** `scripts/` + `src/components/` (minus `console.tsx`, `runtime-timeline*`, `cmd-palette*` — recently done) + small `src/lib/` utilities NOT in L1's cores.
**Class hunted:** (a) copy-paste bugs; (b) off-by-ones; (c) wrong units; (d) typos/pluralization in user-facing strings; (e) stale references; (f) wrong defaults; (g) silent fake/mock residue.
**Baseline:** HEAD=6a9ff96 + in-flight edits (5 agents live). No keyed calls.

Findings are appended below as they are verified & fixed. Each: file:line → before → after → why → proof.

---

## FIX 1 — `fixes/317_l2_silly.md` skeleton
Log created first per brief. No code fix yet.

---

(scanning…)

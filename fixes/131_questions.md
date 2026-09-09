# 131 — Research-relay questions (append-only)

Coders append questions as `## Q-<tag>` blocks (one per finding, tag = their lane).
The researcher answers as `## A-<tag>` blocks in fixes/131_findings.md (append-only),
each answer with sources (URLs) + a concrete recommendation sized for this codebase.
Coders POLL findings before finalizing each fix and cite the answer in their log.

---

## Q-c2 (coder C2 — compile-check seam + enforceDod default-on)

### Q-c2.1 — Emitted-scaffold compile gate: syntax-parse verdicts vs full tsc

We are landing a per-file compile-check seam (`compile check --dir`, `emit --check`)
that reports one honest verdict per emitted file of a machine-generated scaffold
(`.js/.mjs/.cjs` via `node --check`; `.ts/.tsx` via the `typescript` devDep's
per-file transpile parse — syntactic diagnostics only, NOT a cross-file typecheck).
Question: for machine-emitted code scaffolds, do established codegen tools
(and the "does it compile" claim in agent/low-code products) gate on
(a) per-file syntax/parse checks, (b) a full `tsc --noEmit` against the emitted
project's own tsconfig, or (c) emit → install → build/test? Which level is the
industry norm for a *post-generation* compile gate, and is a per-file syntax
verdict honest as a "compiles" claim when cross-file type errors would still slip?

### Q-c2.2 — Post-generation build/test gates in low-code / agent codegen tools

For governed agent runs that end in generated code (P6 synthesis + scaffold emit
in our 13-phase harness), do comparable products (e.g. Lovable/v0/Bolt-style
agents, Replit Agent, Windsurf/Cursor codegen, or harnesses like LangGraph/Claude
Code) run an automatic build/compile/test gate after generation *by default*, or
is compile feedback only surfaced asynchronously (IDE/CI)? What failure semantics
do they use — block the run, park for human review, or record-and-continue —
and what does that imply for making a compile check part of a Definition-of-Done
gate vs keeping it an advisory diagnostic? (We currently plan: verdicts recorded
in the run, enforced only when the project has hard DoD enforcement on.)

### Q-c2.3 — Enforcement-by-default when an LLM is configured

We are flipping our project-creation default so that *keyed* runs (a
`DEEPSEEK_API_KEY` is configured) create projects with hard Definition-of-Done
enforcement ON (a machine advance may not leave a phase whose exit gate fails),
while keyless/deterministic runs stay advisory, plus a CLI `--advisory` escape
hatch. Question: in governed agent harnesses / AI coding agents with gates or
checklists, is *enforcement on by default once a model is configured* (with an
explicit opt-out) the safer norm, or do products keep gates advisory-by-default
and opt-in per run? Any evidence on default-on blockers causing more
false-positive stalls than silent-failure damage in practice?

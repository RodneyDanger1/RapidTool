# W355 · lane `reviewer-surfaces` — code review 3 of 3

**Wave:** W355 (the audit/freeze wave). **Kind:** read-only code review. **Author:** the wave parent.
**You are one of 6 Wave 0 lanes** (3 reviewers · 2 bug inspectors · 1 cartographer).

## Mission

Review RapidTool's **two thin surfaces** — the browser console and the headless CLI — plus the
contracts that bind them. RapidTool is "one engine with two surfaces"; if a surface lies, dead-ends,
or contradicts the engine, the product is not functional regardless of engine quality.

## Scope (yours alone)

- `src/components/console.tsx` — the main console (run tabs, phase rail, wild toggle/strip, keyboard)
- `src/components/**` — the other components, including the new untracked preview surfaces
  (`software-preview.tsx`, `preview-sandbox.worker.ts`) and the export path
- `src/routes/**` — `__root.tsx`, `index.tsx`, `run.$id`, `login.tsx`
- `src/lib/software-export.ts`, `preview*.ts`, `zip.ts`, `artifacts.ts`, `io.ts`, `chat.ts`
- `scripts/rapidtool-cli.mjs` — the 39-verb CLI (`grep -c 'case "'` is the count source of truth)
- `scripts/README-cli.md` — the machine contract
- `scripts/browser-smoke.mjs`, `run-shot.mjs`, `preview-thumbnail.mjs`, `launch-rapidtool.mjs`
- the `*.test.mjs` suites that pin the above

## Specific questions to answer

1. **Tab inventory.** The docs' latest correction says **12** run tabs. Re-derive the real list and
   count from `RUN_TABS`. For each tab: does it render real data for a real project, or can it show a
   permanent empty/dead state?
2. **Dead ends.** Walk each tab's render path for the state a real project is actually in (a run that
   parked at P6 or emitted below-floor). Name every surface that shows a coded refusal with no way
   forward, and every one that shows nothing at all.
3. **Preview/export.** The README claims the Preview tab and the ZIP work for a below-floor run. Read
   `software-export.ts` + `software-preview.tsx` and confirm or refute, per branch (below-floor,
   red-tree, other refusal). Does the sandboxed iframe (`sandbox=""`) actually run the emitted product,
   or is it inert?
4. **CLI contract.** Is every verb's exit code consistent with `scripts/README-cli.md` (0/1/2/3/4/5)?
   Name any verb whose documented exit or JSON shape the bytes contradict. Are the 39 verbs real (each
   dispatching to a live path) or are some stubs?
5. **The error-boundary gap.** The repo records a partial pane error boundary (R6-f12). Find exactly
   where an uncaught render error in a run pane takes down the surface, and what the user sees.
6. **Wild Mode from the console.** The browser reaches the classifier through a server-fn bridge.
   Read that path end to end; state exactly which hosts can drive a zero-human wild run and which
   cannot.
7. **Auth.** `VITE_AUTH_ENABLED=false` ships by default. Confirm the default renders byte-identically
   with no login demanded, and that the enabled path is real (not a facade).
8. **Tests.** Which console/CLI behaviors a later wave could break with no test failing? Name them.

## Deliverable

`research/multiagent/355_3_review_surfaces.md` — the ONLY file you write. Structure:

1. **Method** — exact commands (including `Select-String` reads of `console.tsx`).
2. **Surface inventory** — tabs, verbs, routes; each marked real / partial / dead, with evidence.
3. **Findings** — `id | severity (P0/P1/P2/P3) | title | file:line | evidence | why it matters`.
4. **What is genuinely sound** — with evidence (required).
5. **What I could not verify** — including anything needing a running browser (say so plainly).
6. **Recommended owners** — which Wave 1/3 lane should carry each P0/P1.

## Evidence bar (non-negotiable)

Every finding cites `file:line` **and** the command/read that produced it. Where a doc and the bytes
disagree, the bytes win. Do not restate a doc claim as fact.

## Do not

- Do not edit any product file, the register, or another lane's report.
- Do not run `npm test`, `npm run build`, or `gate.sh`; targeted per-file runs only.
- **Do not start a dev server or a browser.** Wave 1's `aperture-ui` lane owns live browser
  verification. Your evidence is the bytes.

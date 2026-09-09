# 143 — G4 AUDIT: OUTPUT LANDING (where completed software goes, and whether a user can find it)

Auditor G4 · 2026-09-07 · read-only probe (no src/scripts edits). Scope: default emit/export
destinations, existence of any "Completed Software" folder, the post-journey UX, the dev-UI
export surface, and the minimal findable-output fix.

---

## 1. Findings

### F1. Default emit destination = `<CWD>/emit` — a fixed, project-less folder name in the launch directory

- CLI `emit` default: `const dir = typeof args.out === "string" ? args.out : "./emit/";`
  then `h.emitProject(project, resolve(dir))` — `scripts/rapidtool-cli.mjs:547-548`.
- `resolve` is `node:path.resolve` (`rapidtool-cli.mjs:43`) → resolved against
  **`process.cwd()`**, i.e. wherever the CLI was invoked from. Nothing pins it to the
  project file, a data dir, Desktop, or Temp.
- `headless.ts emitProject` (`src/lib/headless.ts:1001-1022`) re-`resolve`s the dir,
  `mkdirSync(dir, {recursive:true})`, then writes every scaffold file. So the answer to
  "where does completed software land with no `--out`?" is: **`./emit/` relative to the
  shell CWD** — when run from the repo root (the normal case for this machine) that is
  `C:\Users\mnril\Desktop\RapidTool Main\emit\`, buried inside the engine's own source
  tree. The folder is always named `emit` regardless of project name; a second emit of a
  different project merges/overwrites the same folder (`writeFileSync` is unconditional).
- Empirically verified: fresh temp CWD → `create` + `emit` with no `--out` returned
  `"dir": "<temp>\emit", "count": 15`, `moduleEmbedded: true` (even keyless — the
  deterministic template module is embedded). Emitted tree (webapp kind): `README.md`,
  `DEPLOY.md`, `package.json`, `tsconfig.json`, `.env.example`, `index.html`,
  `vite.config.ts`, `.rapidtool/project.json`, `src/*`, `tests/*` (scaffold push list,
  `src/lib/scaffold.ts:1464-1484+`). Probe cleaned up; no repo residue.
- Same CWD-relative pattern for `vault` (default `./vault/`, `rapidtool-cli.mjs:591`) and
  `create` (default `<slug>.json` in CWD, `rapidtool-cli.mjs:322`). `packet`/`export`
  default to stdout only (no file at all).
- Related wart: the scaffold summary still reads `… — write them to disk with the emit
  command` (`src/lib/scaffold.ts:1555`) even though emit has already written them — stale
  pre-fixes/126 copy echoed verbatim in the emit success payload.

### F2. No "RapidTool Completed Software" folder exists anywhere, and none is ever created

- String `Completed Software` / `Completed-Software` appears **nowhere** in the repo
  (code or docs, grepped all of `*.md/*.ts/*.tsx/*.mjs`).
- Directory sweep of `Desktop`, `AppData\Local`, `AppData\Roaming`, `AppData\Local\Temp`
  (maxdepth 3, `*completed*` / `*software*`): no RapidTool-related match. The only
  RapidTool dirs on Desktop are `RapidTool Main` (this repo, plus its `.rapidtool` NDJSON
  telemetry log) and an unrelated older copy under `Desktop\Dante_Roadmap_Copies\rapidtool`.
- Nothing in the codebase creates a deliverables folder or archive automatically: emit is
  the only disk-writer of software, and its target is exactly the `--out`/default above.

### F3. Post-journey UX — the browser product hands over documents; the software tree exists only in a CLI world the UI never mentions

- Browser (localhost:8080) header actions on a run: Copy agent packet, Copy phase handoff,
  Clone, **Download packet (.md)**, **Export** (project JSON), Copy JSON, Ingest report,
  Import, Archive (`src/components/console.tsx:1824-1897`); plus "Download vault.md"
  (console.tsx:3365). All are browser downloads of `<slug>.md` / `<slug>.json`
  (`src/lib/io.ts:352-354`) into the OS Downloads folder. State is localStorage-only
  ("Saved to this browser only · Export for backup", console.tsx:1968; AGENT_GUIDE.md §5).
- The console's own positioning is explicit: "It does not build software itself — a real
  agent does the building under enforced, auditable constraints" (console.tsx:856-868;
  AGENT_GUIDE.md:4-7). Deliverables per AGENT_GUIDE.md:21-28 = packet `.md` + project
  JSON + vault.
- The one path that produces an actual software tree — CLI `emit` — is invisible to that
  journey: it is **absent from the README verb table** (README.md:95-123 rows end at
  `wild`/`deepen`; grep finds no `` `emit` `` row) and has **no section in
  `scripts/README-cli.md`**. It exists only in the CLI's own usage header/help
  (rapidtool-cli.mjs:16, 1315) and in fix-wave logs (fixes/126-era comments). A user who
  ran the full journey and wants "the software" is never told what to run or where it
  lands; someone who does find `emit` and runs it with no `--out` gets `./emit/` in an
  arbitrary CWD, named `emit`, silently clobberable.

### F4. Dev UI: no download/export of built software (emit is CLI-only)

- Routes are only `__root.tsx`, `index.tsx`, a 586-byte `run.$id.tsx` shell — a
  localStorage SPA; there is no server route that scaffolds or zips a project.
- All `<Download>`/export affordances in `console.tsx` write the packet `.md`, project
  `.json`, or vault `.md` (F3). `codegen.server.ts` (keyed P6 synthesis) feeds phase
  artifacts in-browser; nothing writes a scaffold folder or archive. Browser cannot
  produce the emitted tree; the UI never surfaces the CLI `emit` command or its output
  path.

### F5. Net answer

Completed software lands in a **CWD-relative `./emit/` folder (repo root when launched
there), unnamed per project, undocumented in README/CLI docs, unreachable from the UI**.
No Desktop/Completed-Software folder, no archive, no per-project folder, no download
button. For the target user (ran a keyed journey, wants the finished suite) this is
effectively unfindable.

---

## 2. Recommended minimal change (findable output)

**Core (one expression + one helper in `scripts/rapidtool-cli.mjs`): default the emit dir
to a named, per-project folder on the user's Desktop instead of CWD `./emit/`.**
`--out` keeps overriding for agents that want a scratch tree. `emitProject`/`scaffold`
stay untouched (they already take an explicit dir and print the absolute path).

```js
// rapidtool-cli.mjs — imports: add existsSync to the node:fs import + fs literal;
// add  import { homedir } from "node:os";   (join/resolve already imported)

/** G4: findable default — Desktop\RapidTool Software\<slug> (home fallback). */
function defaultEmitDir(project) {
  const slug = h.filename(project.name);               // slugName, never empty (io.ts)
  const home = homedir();
  const desktop = join(home, "Desktop");
  return join(existsSync(desktop) ? desktop : home, "RapidTool Software", slug);
}

// case "emit":  (rapidtool-cli.mjs:547)  — before
const dir = typeof args.out === "string" ? args.out : "./emit/";
// after
const dir = typeof args.out === "string" ? args.out : defaultEmitDir(project);
```

Why this shape:
- **Findable**: `Desktop\RapidTool Software\<Project Slug>\` is where a non-technical
  user looks; it is outside the engine repo, so deliverables never mix with source.
- **Per-project**: `<slug>` (the same slug used for packet/JSON downloads, io.ts:340-354)
  stops cross-project clobber and names the folder after the brief. Re-emit of the same
  project stays byte-idempotent (deterministic scaffold) — no force flag needed.
- **Minimal**: `mkdirSync(recursive)` already creates the parents; no headless/scaffold
  changes; `--out` semantics unchanged; the response already returns the absolute `dir`.
- **Portable fallback**: Desktop probed via `existsSync`; absent (server/CI) → `homedir()`.

**Supporting one-liners (same wave):**
1. Add the `emit` row to the README verb table (README.md:95-123) and a short emit section
   to `scripts/README-cli.md` — today the verb is documented nowhere user-facing.
2. Fix the stale summary suffix at `src/lib/scaffold.ts:1555` (drop "— write them to disk
   with the emit command"; emit already wrote them).
3. Optional same-default for `vault` (`./vault/` → per-project) for consistency; not
   software-critical.

**UI (minimal step, deferred to a follow-up if out of wave scope):** no in-browser zip —
the UI has no disk access and a zip route is a larger change (server route + archive dep).
Minimal honest UI fix instead: one line in the run-screen completed-state/guide copy
(console.tsx:856-868 area) — "Software scaffold: `rapidtool emit --project <slug>.json`
→ `Desktop\RapidTool Software\<slug>\`" — so the finished-journey user is told where the
software is and how to produce it. A "Download software (.zip)" button (POST project JSON
to a Nitro route that scaffolds + zips) is the natural later enhancement, not the minimal
change.

## 3. Acceptance
- `emit` with no `--out` on this machine creates `C:\Users\mnril\Desktop\RapidTool
  Software\<slug>\` containing the runnable tree, and the response `dir` points there.
- `emit --out <anything>` behaves exactly as before.
- Two different projects never share an emit folder; re-emit of one project is idempotent.
- README + README-cli document the verb and its default destination; four gates stay green.

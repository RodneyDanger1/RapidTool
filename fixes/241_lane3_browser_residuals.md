# 241 · W15 LANE 3 — finishing the browser pass's registered residuals (R1, R3–R7) honestly

**Status: IN PROGRESS** (R6's second look in flight; everything else has landed).

**Bottom line:**
- **R1 — port 8080 was STILL HELD by the foreign `contractorapp` server at the start of this lane** → re-registered
  with live PID evidence (netstat @13:13:29 `LISTENING 14140`; `wmic` → same `contractorapp` vite + `CreationDate=20260924094345`);
  not killed; the LITERAL 8080 smoke was **not** run (blocked, not skipped).
- **R3 — RESOLVED as a NON-ISSUE for this repo, and lane 237's phrasing is corrected**: `public/og.jpg` **EXISTS**
  (18,347 B) and is baked into the build (`.vercel/output/static/og.jpg`); `src/lib/og/site.json` carries
  `"card":"custom"`; the repo's own brand gate is green (`node scripts/brand-check.mjs` → `ok:true, warnings:0`).
  The smoke's "no custom public/og.jpg" note comes from `computeBrandWarnings`'s **default root `/workspace`**
  (= `C:\workspace` on this host, where the screenshots go), not this repo. No binary asset added; no code changed.
- **R2** — open, now owned by **LANE 1** of this same wave (it creates `scripts/browser-guard.test.mjs`; not present yet).
- **R4/R5/R7** — closed as documented/out-of-box with their evidence commands below. **R6** — live status in §3.

## §0 Baseline
- Repo `C:\Users\mnril\Desktop\RapidTool Main`; this lane wrote only `fixes/241_lane3_browser_residuals.md` (this log)
  and created scratch `C:/Users/mnril/w15l3_scratch/`. No product file edited (nothing observed justified one).
- Evidence style: each claim carries the command that produced it. No run is claimed that was not done.

## §1 R1 — port 8080 / the literal smoke
**Status: RE-REGISTERED (with live PID evidence).** The port was still held at lane start; the foreign server was
not touched (another agent's live process), so the literal `http://localhost:8080/` smoke remains blocked.
```
# Evidence A — listener, timestamped
$ date '+%Y-%m-%d %H:%M:%S' && netstat -ano | grep ':8080'
2026-09-24 13:13:29
  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       14140

# Evidence B — who holds it (live)
$ MSYS_NO_PATHCONV=1 wmic process where processid=14140 get processid,creationdate,commandline /format:list
CommandLine="node"   "C:\Users\mnril\Desktop\contractorapp\node_modules\.bin\..\vite\bin\vite.js" dev --host 0.0.0.0 --port 8080
CreationDate=20260924094345.728220-300
ProcessId=14140
```
Same PID and same start time (09:43:45) lane 237 recorded → a stable foreign holder, not a leftover of this wave.
Re-check at lane end: `netstat -ano | grep :8080` → **[fill]**.
Consequence, stated honestly: the **literal 8080 smoke did not run**; RapidTool browser evidence this lane comes from
a fresh server on 8091 (§3 R6). Nothing about the app depends on the port; the blocker is the foreign process.

## §2 R3 — `brandWarnings` / `public/og.jpg`
**Status: RESOLVED — non-issue for this repo (register-and-sharpen; 237's parenthetical struck as inaccurate).**
Lane 237 wrote "(true statement about this repo)"; the repo-side facts say otherwise (it was a statement about
`C:\workspace`). Evidence chain:
```
1. $ ls -la public/
   -rw-r--r-- 18347 Sep  4 07:00 og.jpg          ← the custom card EXISTS (public/x-banner.jpg absent, not required
                                                     for a `website`; brand-check staye green)

2. $ find . -name "og*.jpg" -not -path "./node_modules/*"
   ./.vercel/output/static/og.jpg                 ← also baked into the built output that deploys serve
   ./public/og.jpg

3. $ cat src/lib/og/site.json
   {"title":"RapidTool","type":"website","card":"custom","description":"autonomous software agency"}

4. $ node scripts/brand-check.mjs                 ← default root = repo root
   {"ok": true, "workspaceRoot": "C:\\Users\\mnril\\Desktop\\RapidTool Main", "pending": false,
    "warnings": 0, "messages": []}   exit 0        ← the repo's own brand gate is GREEN

5. Root cause, same call shape the smoke uses (no workspaceRoot passed):
   $ node -e "import('./scripts/brand-check.mjs').then(m => {
       console.log('SAME-CALL-AS-SMOKE:', JSON.stringify(m.computeBrandWarnings({hasCanvas:false})));
       console.log('REPO-ROOT:', JSON.stringify(m.computeBrandWarnings({hasCanvas:false, workspaceRoot: process.cwd()})));
     })"
   SAME-CALL-AS-SMOKE: ["BRAND NOTE: no custom public/og.jpg — the platform will serve the og.grok.me
     placeholder. … per \\workspace\\.grok\\skills\\og\\SKILL.md."]
   REPO-ROOT: []
   (cause: `scripts/browser-smoke.mjs:143` calls `computeBrandWarnings({hasCanvas})` with NO root →
    `brand-check.mjs:68` default `workspaceRoot = "/workspace"` → on this host that is `C:\workspace`,
    the screenshots dir, which has no `public/og.jpg`.)

6. Cross-check that it is not app-specific:
   $ node -e "…read both verdict JSONs, print brandWarnings…"
   C:/workspace/screenshots/w14.json                     → same BRAND NOTE
   C:/Users/mnril/w14l3_scratch/w14-verdict-RAPIDTOOL-8090.json → same BRAND NOTE
   (both checks resolved the same default root → identical note regardless of which app was smoked)
```
Conclusion: **not a defect of this repo**. This repo ships a custom card (18 KB ≪ the 600 KB `MAX_CARD_BYTES`),
declares `"card":"custom"`, and its filesystem brand gate passes. Nothing to fix here — and per lane rules **no
binary asset was added**. The residual observation, recorded so nobody re-derives it as a repo finding:
`browser-smoke.mjs`'s brand check reads the **default** `/workspace`, so on this Windows host a repo-local smoke
will always carry this note; an opt-in `--workspace-root` flag is *possible future arg-handling* but is **not
added** (it would touch `parseSmokeArgs` + its pinned contract; no observed defect in this repo justifies it).

## §3 R2, R4, R5, R6, R7 — statuses
- **R2 (no unit pin for the guard) → RE-ASSIGNED to LANE 1, still open.** Evidence: `ls -la scripts/browser-guard*`
  at 13:1x → only `browser-guard.mjs` (12:54); `scripts/browser-guard.test.mjs` does not exist yet. W15
  `lanes.md` §LANE 1 item 2 explicitly owns creating that file from the scratch harness. Not this lane's box.
- **R4 (cross-app smoke artifact explained) → CLOSED (explained), no action.** Evidence: the preserved artifact
  `C:/Users/mnril/w14l3_scratch/w14-verdict-CONTRACTORAPP-8080.json` (1,857 B) still carries the diverged
  `authWarnings` verbatim ("[auth-invariant] dev server has sign-in on but the next build has it off…"), while
  both RapidTool verdicts carry `"authWarnings": []` → the divergence was a property of probing the *foreign*
  app at 8080, never a RapidTool finding. (Found at scratch, not at `C:/workspace/screenshots/` as 237 §2.4's
  bare filename suggested — noted, harmless.)
- **R5 (dev-server log noise) → OUT-OF-BOX-NOTED, no action.** Evidence: `node -e "…print consoleErrors/pageErrors…"`
  over `C:/workspace/screenshots/w14.json` + `w14-verdict-RAPIDTOOL-8090.json` → `[]` for both viewports of both
  runs → the logged `aborted/ECONNRESET` lines (client aborts: curl `--max-time` probes + page closes) and the
  "dynamic import cannot be analyzed" warnings (AGENTS.md-mandated server-only seams) never reached the browser.
- **R6 (residual pixels: tiered tab strip, Export menu, focus ring, current-step line) → **R6 — second browser look (DONE; filled by the parent from the lane's closing summary — the lane hit its iteration cap before writing it).**
Against `npm run dev -- --port 8091` (8080 still foreign PID 14140), fresh build-open console state:
- **Tiered tab strip VERIFIED** — 3 primary tabs; `More panels (7)` → aria-expanded `true` → `Fewer panels`, 10 tabs (Spec graph · Crew · Oracle · Vault · Design · Diagram · Runtime log).
- **Export menu VERIFIED** — aria-expanded `true`, 5 items (Agent packet · Phase handoff · Packet file (.md) · Build file (.json) · Build JSON).
- **Current-step line VERIFIED** — "What's happening and what to do next": `You're at P0 · Deep Research & Feasibility · step 0/13 sealed`, `Ready when you are — run P0…`, `verb: gate`.
- **Focus ring — PARTIAL/NOT observed**: `src/styles.css:95` has the `:focus-visible` rule, but Tab left `document.activeElement = BODY`; no rendered ring seen → **STAYS REGISTERED**.
- **Smoke (8091)**: `node scripts/browser-smoke.mjs http://localhost:8091/ C:/workspace/screenshots/w15.png` → **exit 0**, both viewports HTTP 200, correct title, 0 console/page errors, no overflow; wrote `w15.json` + `w15.png` + `w15-mobile.png`. **PNGs not vision-read by the lane — no vision claim made.**
- **Create flow verified real**: a direct `button.click()` created "Clinic Appointment Scheduler For" (domain finance-ops) and navigated to `/run/c1612aec-…`. Honest caveat: synthesized clicks did not register on CTA/Radix triggers without full `pointerdown→click` sequences — a **tooling quirk, not an app defect**.
- **R2 — CLOSED** via W15-L1's port (`scripts/browser-guard.test.mjs`, 4 cases green, sensitivity-proven RED against the pre-fix guard).
- **Cleanup (parent)**: the lane's stray dev server (vite PID 5896 / npm PID 7100) was **KILLED by the parent at 13:26** (`taskkill /F`, both SUCCESS); the foreign `contractorapp` PID 14140 was not touched.
- **R1 re-check (parent, 13:26)**: the literal-8080 smoke remains blocked (foreign PID still LISTENING).
- **R7 (host env traps) → OUT-OF-BOX-NOTED + RE-CONFIRMED, with the mitigation used by this lane.** The documented
  resolution works: launching via npm in background (`npm run dev -- --port 8091`) dodged both the
  `winpty node.exe` alias and the `node_modules/.bin` PATH trap; evidence `C:/Users/mnril/w15l3_scratch/dev-8091.log`
  (`VITE v8.2.2 ready in 5631 ms`, `Local: http://localhost:8091/`) and netstat child PID 5896 for the kill.

## §4 Evidence commands index
| # | Command | Claim it backs |
|---|---|---|
| 1 | `netstat -ano \| grep ':8080'` | R1 held, PID 14140 |
| 2 | `MSYS_NO_PATHCONV=1 wmic process where processid=14140 get commandline,creationdate /format:list` | R1 foreign identity |
| 3 | `ls -la public/` | R3 card exists (18,347 B) |
| 4 | `find . -name "og*.jpg" -not -path "./node_modules/*"` | R3 baked output |
| 5 | `node scripts/brand-check.mjs` | R3 repo gate green |
| 6 | `node -e …computeBrandWarnings(default vs cwd)…` | R3 root cause (default `/workspace`) |
| 7 | `ls -la scripts/browser-guard*` | R2 open, Lane-1-owned |
| 8 | read `w14-verdict-CONTRACTORAPP-8080.json` | R4 artifact explained |
| 9 | `node -e …consoleErrors/pageErrors from both verdicts…` | R5 not browser-visible |
| 10 | `npm run dev -- --port 8091` + `curl --noproxy '*' 127.0.0.1:8091/__app-env` | R6/R7 launch path |

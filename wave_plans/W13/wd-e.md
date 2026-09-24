# 220 · WATCHDOG E — external reality check (live web + command realism) for the overhaul plan

**Read this file FIRST.** You are the only agent in this inquest with a mandate to check the plan
against **the world outside this machine** — and the only one allowed to say "the plan assumes
something the internet contradicts".

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
COMPETITOR CLONES: /c/Users/mnril/rt-competitors/ (17 repos, READ-ONLY — never execute anything from
them; one historically carried a credential-stealer).

WEB ACCESS — VERIFIED FACTS (do not re-litigate):
- `web_search` / `web_extract` are NOT configured on this machine (Firecrawl key absent) — the parent
  tested it and got: "Web tools are not configured. Set FIRECRAWL_API_KEY…".
- BUT the BROWSER TOOL WORKS: the parent loaded https://example.com successfully via `browser_navigate`
  (local Chromium, no proxy). So LIVE web research IS possible through the browser tools.
  TEST IT YOURSELF FIRST (one navigate); if it fails for you, say so immediately and fall back to
  Rule 3 below — do not fake research you could not do.

RULE 3 (fallback): if the browser does not work for you, your deliverable becomes the command-realism
audit + the clone-based verifications only, and every web question is reported as
"MISSING-CAPABILITY: browser unavailable to this lane".

THE OWNER'S STANDARD (verbatim): "100% factual web research … no hallucinations/fake code/…
100% truth." Therefore: EVERY external claim needs (a) the URL you loaded, (b) a short QUOTE of what
the page actually says, (c) the date you read it. A claim without a quote does not go in the file.
Where a page is silent or unreadable, write exactly that.

RULES:
1. WRITE ONLY your deliverable (below) + scratch notes OUTSIDE the repo (`C:/Users/mnril/w13e_scratch/`).
   Never edit RapidTool src/scripts/docs; no git mutations; never execute clone code.
2. ALLOWED heavy commands: read-only greps/reads; ≤2 targeted test runs. FORBIDDEN: `npm run typecheck`,
   `npm test`, `npm run build` (memory-tight host).
3. Budget: you have ~50 tool calls. That is enough for ~6-10 page loads + ~10 local checks. Plan the
   pages you load before you load them; do not browse casually.
```

**Your deliverable:** `research/multiagent/220_external_verification.md`

## Work list (in priority order)

1. **Browser capability test** (1 call) + the fallback decision (Rule 3).
2. **Verify the competitor mechanisms the plan leans on** — open the LIVE repository pages (GitHub)
   for the three or four competitors the plan's "behind" verdicts rest on, and quote what the page
   says about the specific mechanism. Minimum set: **MCP client support in OpenHands and Cline** (the
   "no MCP runtime client" gap), and **OpenHands' sandboxed runtime** (the isolation bar). Local-clone
   evidence already exists (`219f`); your job is to confirm the LIVE repos do not contradict it and to
   capture the URL + quote.
3. **The MCP spec itself** — load `modelcontextprotocol.io` (or the spec repo page) and record: what
   version/date the spec is at, and what a compliant *client* must implement (tools/list, tools/call,
   transports). This is the concrete input for the interop spike in the plan (`W15-L5`). Quote it.
4. **Field refresh — anything NEW the local clones miss.** The clones were taken 2026-09-16; the plan
   claims to compare against "the field". Load one or two aggregating pages (e.g. a GitHub topic/trending
   page for "autonomous agents"/"coding agent", or a well-known curated list) and report ONLY what the
   pages show (names + URLs + one-line quotes). Explicitly flag if you cannot find a credible page —
   "no credible page found in N attempts" is a valid, useful result.
5. **The key/provider assumption.** The plan's Step 0 is an owner keyed run. Load the provider's public
   API docs page (the one RapidTool integrates) and record: the documented model ids available today and
   whether a "flash"-class model is among them. NOTE: RapidTool's own memory records the API id it uses
   (`deepseek-flash`) — if the live docs disagree with that, that is a HIGH-VALUE finding for Step 0
   (a wrong model id is exactly what would make the owner's keyed run fail for a silly reason).
6. **Command-realism audit (local, no web needed).** Open `research/multiagent/220_tasklist_canonical.md`
   if it exists (WD-D is writing it in parallel); otherwise use `219e`'s W14/W15/W16 tables. For EVERY
   row: (a) does each named file exist on disk? (`ls`/`test -f`), (b) does the verification command
   reference a real script/entrypoint? (`ls scripts/`, `grep` the target), (c) is any command known-broken
   (WD-C already found `browser-smoke.mjs` rejects `--url` and `browser-guard.mjs`'s path guard is
   Windows-unsatisfiable — re-confirm those two only if you touch them). Produce a per-row verdict:
   `OK / FILE-MISSING / CMD-INVALID / KNOWN-BROKEN(reason)`. Do NOT fix anything — report.
7. **Bottom line at the top of the file**: `web research: WORKS / FALLBACK`; `external claims verified:
   N`; `plan rows audited: N, invalid: M`; and the single most consequential external or local finding.

## What you must NOT do

- Do not summarise a page you did not load. Do not infer a version number, licence, or feature from
  memory. Do not "confirm" a claim by citing another dossier — external means external.
- Do not treat a search-engine result snippet as verification; open the target page.

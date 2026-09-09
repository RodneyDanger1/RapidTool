# RapidTool — Audit-Bug 04: Scripts, OG/PWA Chrome, p2p/ai Honesty, and the Integration Surface

- **File:** `audit-bugs/04_scripts_integration.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`)
- **Date / agent:** 2026-09-05 · Flash audit agent (read-only; the ONLY file written this pass is this one)
- **Host:** Windows 10 (git-bash), Node `v22.23.2` (verified `node -v`). Repo is NOT git.
- **Method:** every file named below was read in full against the on-disk bytes; every `file:line` in a finding was re-grepped and confirmed before being written. The full script test suite was **re-run** (`node --test scripts/*.test.mjs`) to separate known environmental failures from new ones. All findings are in-tree; no web validation was required for any claim made here.
- **Legend:** P0 critical · P1 high · P2 medium · P3 low · P4 note. `[re-verify]` = a prior-document finding re-checked against the current tree. `[NEW]` = not previously registered.
- **Prior documents consulted (do not duplicate):** `audit/01_core_engine_algorithms_audit.md`, `audit/02_ui_console_multiplayer_audit.md`, `audit/03_auth_appdata_platform_audit.md`, `review/01_deep_audit_current.md`, `review/02_purpose_walkdown_gap.md`, `fixes/01..06`, `research/runtime-integration.md`, `research/deepseek-api.md`. The **known 10 script-suite env failures** (og `site.json` coupling + symlink EPERM) are documented in `review/01` (L20-21, L405) and `fixes/06_reconciliation.md` (L13) — catalogued in §1 only to bound the re-run and **not** re-litigated.

---

## 0. Tree-shape deltas vs. the audit brief (verified; matters for reading every later section)

| Brief said | On-disk reality | Verified how |
|---|---|---|
| `src/lib/multiplayer/client.ts` | **Does not exist.** `src/lib/multiplayer/` contains exactly `index.ts` (9 lines) + `p2p.ts` (576 lines). All client logic lives in `p2p.ts` (`P2PRoom`). | `ls` |
| `src/lib/og/*` (site.json + "any lib") | `src/lib/og/` contains **only** `site.json` (1 line). No og lib — OG logic lives in `scripts/grok-pwa-shared.mjs` (+ Vite plugin + Nitro middleware), consumed via the `virtual:grok-og-identity` shim (`server/virtual-grok-og-identity.d.ts`). | `ls` |
| `src/lib/preview.ts` | **No top-level `src/lib/preview.ts`.** The baked-preview-credentials module is `src/lib/auth/preview.ts`; the origin-check pair is `src/lib/preview-embedder-origin.ts` + `src/lib/preview-host-bridge.ts`. | `ls src/lib` |
| `site.json` bytes | `{"title":"RapidTool","type":"website","card":"custom","description":"autonomous software agency"}` and `public/og.jpg` (18,347 B) exists → repo is in the "custom card" state. | `cat`, `ls -la` |
| Server surface | `server/` ships only `middleware/grok-pwa.ts` (+ the og-identity type shim). **No `/api/rtc`, no `signaling.server.ts`, no `src/routes/api/*` at all** (`src/routes/` = `__root.tsx`, `index.tsx`, `run.$id.tsx`). | `find`, `ls` |

### 0.1 In-scope inventory (all read in full)

**scripts/ (platform chrome; pure logic split out so `node --test` covers it):**

| File | Lines | Role |
|---|---|---|
| `browser-smoke.mjs` | 177 | Playwright gate: desktop+mobile screenshots, console/page errors, brand + auth-invariant warnings, optional baseline compare |
| `browser-smoke-verdict.mjs` | 128 | Pure verdict/baseline logic (hash, prefix, compare, exit-code policy) |
| `brand-check.mjs` | 227 | Brand-asset gate (og card ≤600 KB, `card:"custom"`, `x:game`, x-banner); runnable |
| `preview.mjs` | 343 | Owns :8081 built-output preview; `/proc`-based port-owner kill; stop/restart |
| `preview-thumbnail.mjs` | 42 | Thumbnail capture for the sandbox service (loopback URL + /tmp output contract) |
| `write-atomic.mjs` | 94 | Staged-file hand-over via `rename` (atomic within one filesystem) |
| `check-auth-invariant.mjs` | 109 | Dev-vs-build `VITE_AUTH_ENABLED` divergence guard |
| `grok-pwa-plugin.mjs` | 190 | Vite dev/preview half of PWA chrome (manifest, install page, head injection) |
| `grok-pwa-shared.mjs` | 527 | Single source of truth for PWA/OG head chrome (shared with Nitro middleware) |
| `sign-out-plan.mjs` | 160 | Sign-out/pre-sign-in sequencing (pure; consumed by `src/lib/auth/client.ts`) |
| `browser-guard.mjs` | 47 | URL + output-path confinement for the Playwright capture scripts |
| `grok-pwa-shared.d.mts` | 80 | Type surface for the .mjs shared module |
| `install-page.html` | 147 | iOS install tutorial template (`?install=1&platform=ios`) |
| (tests) `brand-check`, `browser-smoke-verdict`, `check-auth-invariant`, `grok-pwa-plugin`, `migration-plan`, `preview`, `sign-out-plan`, `with-app-env`, `write-atomic` `.test.mjs` | 373/416/110/506/90/257/248/128/201 | Unit companions; all pure logic (no Playwright) |

**src/lib/ surface in scope:**

| File | Lines | Role |
|---|---|---|
| `ai.ts` | 137 | Orphaned LLM stub (§5) |
| `multiplayer/index.ts` + `p2p.ts` | 9 + 576 | Dormant WebRTC full-mesh room client (§4) |
| `preview-embedder-origin.ts` | 72 | Parent-origin allowlist resolver (§6) |
| `preview-host-bridge.ts` | 287 | Guest-side postMessage bridge protocol (§6) |
| `preview-host-bridge.test.ts` | (runs in `npm test`) | Bridge unit tests |
| `og/site.json` | 1 | OG identity (`RapidTool`, `type:website`, `card:custom`) |

Cross-referenced for the cross-cutting audit (§7): `engine.ts` 1118, `phases.ts` 134, `sandbox.ts` 324, `types.ts` 240, `packet.ts` (+`packet.test.ts`), `store.ts` 427, `console.tsx` 1290, `dod.ts` 293, `db.ts` — read in the relevant ranges only, on top of the full reads in audits 01/02.

---

## 1. Full script-suite re-run — same known 10, **no new failures**

`node --test scripts/*.test.mjs` (repo root, Node v22.23.2): **195 tests → 185 pass / 10 fail** — byte-identical to the count in `review/01:405` and `fixes/06:13`.

| # | Failing subtest (runner name) | Test file | Root cause class |
|---|---|---|---|
| 1 | "platform chrome overwrites share-card metas and always sets og:title" | `grok-pwa-plugin.test.mjs` | og `site.json` / `og.jpg` cwd-coupling (known) |
| 2 | "published grok.me slug is still a title fallback" | `grok-pwa-plugin.test.mjs` | same |
| 3 | "emits og:image for a public host and prefers a custom card" | `grok-pwa-plugin.test.mjs` | same |
| 4 | "placeholder og:image appends site.color when it is 6-digit hex" | `grok-pwa-plugin.test.mjs` | same |
| 5 | "document title entities are not double-escaped on og:title" | `grok-pwa-plugin.test.mjs` | same |
| 6 | "injects into documents with no head element" | `grok-pwa-plugin.test.mjs` | same |
| 7 | "streaming injector matches </HEAD> case-insensitively" | `grok-pwa-plugin.test.mjs` | same |
| 8 | "uses the app name in the injected title tag" | `grok-pwa-plugin.test.mjs` | same |
| 9 | "the CLI reports rather than silently passing when run via a symlink" | `write-atomic.test.mjs` | symlink EPERM on Windows (known) |
| 10 | "the CLI still runs when invoked through a symlinked path" | `write-atomic.test.mjs` | same |

**Cause of 1-8, verified from the runner's assertion payloads:** the subtests call `injectGrokPwaHead(html)` / `createHeadInjector({})` with **no `ctx.cwd`**, so `normalizeHeadContext` defaults `cwd = process.cwd()` (`grok-pwa-shared.mjs:404`) and `readOgSite` / `ogCardPublicPath` / `applyCustomCardFromFs` (`grok-pwa-shared.mjs:245-260,330-334,409-412`) read this repo's **live** `site.json` (`title:"RapidTool"`, `description`, `card:"custom"`) and real `public/og.jpg`. The "actual" HTML in every failure contains `og:title content="RapidTool"` and `og:description content="autonomous software agency"` — the repo's own brand — plus `https://wild-race.grok.me/og.jpg` custom-card URLs. The asserted behavior is **correct product behavior**; the tests were authored against an un-customized scaffold, where they pass (hence `fixes/06:13` "pass on platform Linux CI"). Root-cause remediation is new work: **S-03**.

**Conclusion:** the known-10 set is unchanged; nothing new surfaced by the re-run. The 185 passing tests pass on this Windows host, which confirms the pure-logic split (`browser-smoke-verdict`, `check-auth-invariant`, `preview` parsers, `sign-out-plan`, `write-atomic` core) is genuinely platform-neutral.

---

## 2. Script bugs register (scripts/ — new findings only)

### S-01 — `check-auth-invariant.mjs` `--dev-url` with no value misreports the dev server — P3 `[NEW]`
- **file:line:** `scripts/check-auth-invariant.mjs:93-94` (`const devUrl = devUrlFlag === -1 ? DEFAULT_DEV_URL : argv[devUrlFlag + 1];`).
- **Verified:** invoking `node scripts/check-auth-invariant.mjs --dev-url` (flag last, no value) yields `devUrl === undefined`. `probeDevAuthEnabled(undefined)` then runs `new URL(APP_ENV_ROUTE, undefined)` — the constructor throws (`Invalid URL`), the `catch` at `:74-76` returns `null`, and the CLI exits **2 ("could not observe")** with the message *"could not read the dev server's resolved VITE_AUTH_ENABLED"* — blaming a live server for a bad invocation. A flag-as-value (`--dev-url --anything`) degrades identically.
- **Why it matters:** this script is the guard that exists to *fail loudly* on dev/build auth drift (`check-auth-invariant.mjs:2-9`); on misuse it fails on the wrong axis, and its exit code 2 is indistinguishable from "no server running" (`:104`).
- **PROPOSED FIX:** when `devUrlFlag !== -1` and the next token is `undefined` or starts with `"--"`, print `usage: … [--dev-url <url>]` to stderr and `process.exit(1)`. Optionally validate with `new URL(...)` and exit 1 on throw.

### S-02 — Flag-value parsers swallow a following flag as their value — P3 `[NEW]`
- **file:line:** `scripts/browser-smoke-verdict.mjs:22-25` (`parseSmokeArgs`: `--baseline` takes `argv[++i]` with no "starts with `--`" guard) and `scripts/brand-check.mjs:182-184` (`parseBrandCheckArgs`: `--root` takes `argv[++i]`, guarding only `undefined`).
- **Verified:** `node scripts/brand-check.mjs --root --game` assigns `root = "--game"` and never sets `game`; `brandWarningsOnDisk` then runs against `join("--game", …)` → `readOgSite` silently returns `{}` (ENOENT swallowed at `grok-pwa-shared.mjs:245-253`), and the CLI prints `workspaceRoot: "--game"` with warnings computed against the wrong tree and the **exit code decided on the wrong workspace** (`brand-check.mjs:226`). `--baseline --game` similarly turns `realpathSync("--game")`'s throw into a "baseline unreadable: ENOENT" divergence (`browser-smoke.mjs:39-44,71-77`). Same pattern class as S-01.
- **Why it matters:** these CLIs are invoked by *agents* (brand pass, smoke gates) from generated commands; an ordering mistake silently audits the wrong directory instead of erroring.
- **PROPOSED FIX:** in both parsers reject a value token that starts with `--` (`--root needs a directory` / `--baseline requires a path to a prior verdict JSON`), and prefer the `--flag=value` form already partially supported (`browser-smoke-verdict.mjs:26-29`).

### S-03 — The 8 OG test failures are cwd-coupling, not logic; tests exercise repo-relative defaults — P2 (test-isolation / process) `[NEW angle on the known 10]`
- **file:line:** the failing subtests in `scripts/grok-pwa-plugin.test.mjs` (list in §1) call `injectGrokPwaHead(html)` / `createHeadInjector({})` with no `ctx.cwd`; the production functions are all cwd-parameterized (`grok-pwa-shared.mjs:245,256,262,269,286,325,330,341,404`) — only the tests lean on the implicit `process.cwd()` default.
- **Verified:** see §1 payload evidence. On the platform's pristine scaffold the same assertions pass; this repo's honest-brand customization — exactly what `brand-check.mjs` *enforces* — permanently turns `npm test` red here and in any customized workspace.
- **Why it matters:** a green suite is the gate the whole audit program leans on (`fixes/06:29`: "full TS suite 247/247 … lint 0"). Eight of its 195 script tests are hostage to workspace branding state.
- **PROPOSED FIX:** convert the 8 subtests to isolated fixtures (`fs.mkdtempSync` under `os.tmpdir()` with a *minimal* `src/lib/og/site.json` + `public/og.jpg` written per case, passed as `cwd`), asserting against fixture identity — never the live workspace. Add one explicit test asserting the default reads `process.cwd()` so the contract stays intentional. Tests-only change; no product code. Belongs to whoever owns the platform test-suite fix.

### S-04 — Sandbox-only output guard silently degrades on Windows: `/workspace` resolves to `C:\workspace` and gets auto-created — P2 `[NEW]`
- **file:line:** `scripts/browser-guard.mjs:34-42` (`checkedOutputPath`) + `scripts/browser-smoke.mjs:30,32-33,69` (`checkedOutputPath(args.outPng, ["/workspace"])` … `mkdirSync(dirname(outPng), { recursive: true })`) + `scripts/preview-thumbnail.mjs:12-15` (default `/tmp/preview-thumbnail.png`).
- **Verified:** on this Windows host, Node's `path.resolve("/workspace/screenshots/x.png")` returns `C:\workspace\screenshots\x.png` (POSIX-absolute strings root at the current drive), which **passes** the `abs.startsWith(dir + sep)` check; `browser-smoke.mjs:69` then `mkdirSync(recursive)` happily **creates `C:\workspace\…`** on a developer machine. The guard's intent — output confined to the sandbox `/workspace`, loopback URL only (`browser-guard.mjs:12-30`) — is silently satisfiable anywhere on Windows (any drive). `preview-thumbnail`'s `/tmp` default → `C:\tmp` likewise.
- **Why it matters:** the guard exists because these scripts run Chromium with agent-controlled URL/path argv (`browser-guard.mjs:1-7`); on Windows the confinement half is cosmetic and a misdirected run writes PNGs/verdict JSON to an arbitrary drive root instead of failing closed. (The URL half — loopback-only — still holds.)
- **PROPOSED FIX:** in `checkedOutputPath`, when `process.platform === "win32"`, either (a) fail with "these capture scripts are sandbox-only (/proc + /workspace); refusing to run on win32" — mirroring the explicit `/proc/self` gate in `preview.mjs:338-341` — or (b) compare against the physical path and treat a POSIX-style absolute as never-inside a Windows allowed dir. Prefer (a): it makes the platform boundary explicit instead of emulating it. No test change needed (the guard is not under `node --test`).

### S-05 — `write-atomic.mjs` lexical `isInside` — symlink aliasing defeats the `public/` refusal — P3 `[re-verify of audit/03 E]`
- **file:line:** `scripts/write-atomic.mjs:30-33` (`isInside`) and `:40-46` (`stagingError`).
- **Verified:** unchanged since `audit/03_auth_appdata_platform_audit.md:409-412`. If any directory component between the project root and the staged file is a symlink aliasing `public/` (e.g. `.grok/stage → public`), the lexical `relative()` containment test passes while the `rename` physically lands inside `public/` — which `vite build` ships verbatim (`write-atomic.mjs:35-39`). The cross-filesystem `EXDEV` refusal at `write-atomic.mjs:61-66` is sound; only the lexical check is the hole.
- **PROPOSED FIX (unchanged, restated):** `realpathSync` the staged file's *directory* and the target's *directory* before the containment comparison, then check the physical paths.

### S-06 — Scripts are otherwise clean on the hunted cross-platform axes — P4 `[NEW, verified-negative]`
- Spawn/process handling: the only spawner is `preview.mjs` (`spawn("npm", ["run","preview"], { detached:true … })` at `:300-305`, group-kill via `process.kill(-pid,…)` at `:178-195`), and it is Linux-gated (`/proc/self` check, `:338-341`) with a clear error — no Windows `npm.cmd` issue can arise because the script refuses to start.
- Symlinks: `browser-smoke.mjs:41` `realpathSync(args.baseline)` is the only symlink-touching call outside tests; guarded with an honest "unresolvable path" fallback (`:39-44,71-77`).
- Globbing: `package.json` `test` uses `node --test scripts/**/*.test.mjs` — Node 22's `--test` expands the glob itself, so no cmd.exe `**` problem — and the TS list is fully explicit. Encoding: all reads/writes are `utf8`; the streaming head injector searches `</head>` as latin1 (`grok-pwa-shared.mjs:475-478,514-515`) — correct for an ASCII marker inside UTF-8.
- `preview.mjs` pure functions (`parsePid:46-50`, `parsePgid:53-61`, `parseListenerInodes:66-75`, `looksLikePreviewProcess:77-91`, `previewOwners:98-108`, `terminatePids:124-134`, `stopOutcome:141-157`) are unit-tested and pass on Windows (part of the 185).

---

## 3. OG / PWA / brand surface (grok-pwa-shared.mjs, grok-pwa-plugin.mjs, brand-check.mjs, site.json)

Full reads found the PWA/OG machinery in good shape: escaping on every interpolated meta (`escapeHtml`, `grok-pwa-shared.mjs:31-38`), share-key dedup stripping app-authored duplicates (`stripShareMetaTags` `:378-386` over the 13-key set `:13-29`), streaming injection buffering only to `</head>` with whole-document fallback (`:485-527`), manifest/install-page serving (`grok-pwa-plugin.mjs:45-78`), and mirrored Nitro middleware (audit/03 §4.1). Remaining findings:

### O-01 — P4 "Isolation policy" artifact prints `RAM cap: null MB` and the raw runtime enum — P3 `[NEW]`
- **file:line:** artifact text template `src/lib/engine.ts:399-401` inside `case 4` (`:391`; phase 4 = "Security, Isolation & Authorization", `phases.ts:37-39`), against defaults `src/lib/engine.ts:993-999` (`newProject` → `sandbox = { runtime: "sync-template", ramMb: null, timeoutS: 30, isolated: true }`) and `engine.ts:1078-1082` (hydrate keeps `ramMb: null` when absent).
- **Verified:** a fresh project reaches phase 4 with `ramMb === null` — no code path sets a number (grep of `ramMb` shows only `types.ts:212`, engine defaults/hydrate, and UI reads). The artifact then literally contains `Runtime: sync-template` and `RAM cap: null MB` (`engine.ts:399-400`). `sync-template` is an *internal* enum: the packet compiler forbids printing that literal (`packet.test.ts:240`: "runtime literal never printed directly") yet the sibling artifact prints it verbatim, while the UI handles null properly (`console.tsx:482-484` renders runtime + timeout when `ramMb === null`).
- **Why it matters:** this artifact is a spec document an operator reads and may paste; "null MB" and an internal enum name are exactly what the repo's B-18 honesty conventions exist to prevent — and the honesty footer on the same artifact (`engine.ts:410`) makes the inconsistency visible.
- **PROPOSED FIX:** in the `case 4` template, render the RAM line conditionally (`ramMb === null ? "RAM cap: not enforced (engine-template runner)" : \`RAM cap: ${ramMb} MB\``) and replace the raw `Runtime:` line with `sandboxClaim(project.sandbox)` text (`sandbox.ts:158-167`) — dropping the raw enum.

### O-02 — Phase-3 "MCP + A2A contracts" artifact presents an unimplemented tool roster with no "declared, not live" marker — P3 `[NEW]`
- **file:line:** `src/lib/engine.ts:364-385` (`case 3`, artifact "MCP + A2A contracts"): `servers: search.brave (stdio+ws)` `:375`, `repo.fs (stdio)` `:376`, `sandbox.exec (ws, stream)` `:377`, `a2a` `:379`, `long_running: "websocket progress frames every 250ms"` `:380`.
- **Verified:** none of these tools exist in the tree — no `search.brave`/`repo.fs`/`sandbox.exec` server implementation, no WebSocket endpoint (the only `ws`-adjacent runtime code is dormant `p2p.ts` and the *lexically banned* `WebSocket` in `sandbox.ts:12-13`). The artifact is a deterministic design declaration, but unlike sibling `case 4` it carries **no** footer equivalent to `engine.ts:410` ("Implementation today: … policy above is the P4 declaration (B-18 honesty)"). A reader of the artifact tab sees a concrete-sounding stack with transports and frame cadence.
- **Why it matters:** this is the one place in the deterministic engine where a capability list reads as live without a disclaiming line — and the repo solved the identical problem one `case` over, so the fix is mechanical consistency. (The *packet* path is safe: `packet.test.ts:228-248` enforces the honest "Execution:" line and forbids `wasm`/`net-deny` fiction.)
- **PROPOSED FIX:** append to the `case 3` artifact body a final line — e.g. `` `Declared MCP/A2A contract — none of these servers are implemented today (deterministic P3 spec).` `` — mirroring `engine.ts:410`, and add an assertion analogous to `packet.test.ts:228-248` that the MCP roster artifact carries the marker.

### O-03 — `brand-check` and `browser-smoke` disagree about who enforces "no canvas, no `--game`" — P3 `[NEW, low]`
- **file:line:** `scripts/brand-check.mjs:176-179` (the `--game` flag exists precisely because "DOM board/word games … have no canvas to detect") vs `scripts/browser-smoke.mjs:143` (`computeBrandWarnings({ hasCanvas: viewports.desktop.hasCanvas })` — no `--game`-equivalent on the smoke path).
- **Verified:** `brand-check.mjs:196-227` is runnable standalone and is the documented enforcement path for the brand task; `browser-smoke`'s brand warnings are informational and never affect `exitCodeFor` (`browser-smoke-verdict.mjs:120-128`). A DOM game is therefore brand-checked only if the agent *remembers* the standalone invocation. RapidTool itself declares `type:"website"` and no game UI, so impact today is nil.
- **PROPOSED FIX (platform tooling):** accept `BROWSER_SMOKE_GAME=1` (env) in `browser-smoke.mjs` and OR it into the `hasCanvas` passed to `computeBrandWarnings`, so the smoke and the brand pass can never disagree about game status.

### O-04 — `renderWebManifest` never consults `site.json` — installed-PWA name diverges from the OG/app identity — P3 `[NEW, low]`
- **file:line:** `scripts/grok-pwa-shared.mjs:160-183` (`renderWebManifest` names the app solely from the request host via `appNameFromHost` `:62-82`); manifest route at `grok-pwa-plugin.mjs:55-63`. Contrast the head injector, which resolves `site.title` first (`resolveOgTitle` `:300-314`, used at `:343` and `:429-434`).
- **Verified:** with `VITE_PUBLIC_HOSTNAME`/host unset (local dev), the manifest name is `DEFAULT_APP_NAME` "Grok App" (`:9`); on `rapidtool.grok.me` it would be slug-title-cased from the host. The manifest `name`/`short_name` therefore never equals the brand title `RapidTool` that OG tags and `apple-mobile-web-app-title` (`:191-194`) use — a home-screen icon labeled "Grok App" beside a document titled "RapidTool". Platform-wide behavior, minor.
- **PROPOSED FIX:** thread the site/baked title into the manifest path: `renderWebManifest(hostHeader, siteTitle)` preferring `site.title` via the same `resolveOgTitle` order before host-slug fallback; the Vite plugin already has `snapshotOgIdentity(root)` available (`grok-pwa-plugin.mjs:166`) to source it.

---

## 4. Multiplayer / p2p — honesty re-verification (dormant state confirmed; no fake P2P claims)

The task asked for "p2p honesty (any fake 'P2P' claim)". Fresh whole-tree grep + full re-read of `p2p.ts` (576 lines) and `index.ts` (9 lines):

- **Nothing imports `@/lib/multiplayer`** — grep for `multiplayer|P2PRoom|defaultIceServers|PeerInfo|/api/rtc` outside `src/lib/multiplayer/` returns zero matches (verified this pass; matches `audit/02:303` and `review/02 §4 row 6`). The module's own header states it is dormant (`p2p.ts:6-11`) and that **no relay exists** — byte-true today (`server/` ships only `middleware/grok-pwa.ts`; no `src/routes/api/*`; no `rtc` string elsewhere in `src/`+`server/`).
- **No UI claim:** the console has no peer/room/online concept; the only "multiplayer-ish" string in the app is the stale "That build is not on this station." copy — already registered (`audit/02` §7.3, `console.tsx` missing-project fallback).
- **Library defects M-1..M-12 / BUG-22..25** were audited in depth in `audit/02:357-368,459-469`. This pass re-read the same code; the table below re-anchors each finding to **current** line numbers (several shifted by the +6 lines since audit/02's 570-line file).

| audit/02 ID | Current anchor (verified this pass) | Still present? |
|---|---|---|
| M-1 relay absent → silent infinite 404 poll | `p2p.ts:125-137` (`join` swallows first-poll error), `:194-227` (`pollOnce`/`poll` swallow all); relay truly absent | Yes |
| M-2 no TURN | `p2p.ts:90-102` (`defaultIceServers` STUN-only) | Yes |
| M-3 no fetch timeout/abort on signaling poll | `p2p.ts:194-217` (bare `fetch`, no signal) | Yes |
| M-4 no backoff / no visibility pause | `p2p.ts:83-84,219-227` (fixed 400 ms/2 s cadence) | Yes |
| M-5 unbounded payloads on unreliable channel | `p2p.ts:156-170` (`JSON.stringify` + bare `send`) | Yes |
| M-6 connected-zombie pairs never reaped | `p2p.ts:520` (`if (slot.terminal || live === "connected") continue;`) | Yes |
| M-7 selfId tie-break (same id → nobody dials) | `p2p.ts:238` (dial rule), `:383` (polite rule) | Yes |
| M-8 lost-answer give-up relies on next cycle | `p2p.ts:472-476` (warn + return) | Yes |
| M-9 `close()` leaves in-flight poll socket | `p2p.ts:139-153` | Yes |
| M-10 relay wire types `payload: unknown`, client-sent name | `p2p.ts:29-34`, `:195-199` | Yes |
| M-11 watchdog rebuild race with in-flight channels | `p2p.ts:403-408`, `:529-538` | Yes |
| M-12 `emitPeers` fingerprint includes `rttMs` (2 s re-render churn) | `p2p.ts:565-575` | Yes |
| BUG-22/23/24/25 (library) | `p2p.ts:125-131,213-221` / `:328-337,479-491` / `:156-170` / `:520` | Yes |

All remain conditional on the module ever being adopted; none are false claims — the file is *honest about being dormant*.

- **One doc-freshness note `[NEW, P4]`:** `p2p.ts:6-11` (and `ai.ts:4-9,31-32`, see A-03) cite transient working docs (`review/02 §4 row 6`, `review/01 A25/A26`). When the Pro pass retires `ai.ts` and decides `multiplayer/`'s fate, those headers must be rewritten to self-describe without external pointers.

**Verdict:** p2p is honest — an orphaned, well-engineered transport whose own docs correctly disclaim it. Recommendation stands as `audit/02:499`: **delete `src/lib/multiplayer/` (kit-restorable on scaffold) or adopt deliberately with a relay**; it is *not* needed for any integration surface in §8.

---

## 5. `src/lib/ai.ts` — exact current shape, assessment, replace/retire plan

### 5.1 What the file is today (137 lines, full read)
- Header (`ai.ts:1-33`) states STATUS NOT WIRED; no importer exists — verified this pass (grep for `lib/ai|aiWiringState|isAiConfigured|complete(` outside `ai.ts` → zero).
- Exports: `AI_DEFAULT_BASE_URL = "https://api.x.ai/v1"` (`:35`), `AI_DEFAULT_MODEL = "grok-4.5"` (`:36`), typed result/wiring unions (`:38-49`), `isAiConfigured()` (`:57-60`), `aiWiringState()` (`:63-71`), and `complete()` (`:78-137`): a single-turn OpenAI-compatible `/chat/completions` POST gated on `VITE_AI_API_KEY` (+ optional `VITE_AI_BASE_URL`/`VITE_AI_MODEL`), 20 s `AbortController` (`:88-89`), prompt sliced to 8,000 chars (`:102`), `max_tokens` 300 default (`:87`), typed `{ok:false, reason:"not-configured"|"network"|"http"|"invalid-response"}` outcomes, abort detected via `DOMException` name (`:124`).
- The old `enrichBrief` server fn is **gone** (header `:31-32` documents its removal); the earlier `{ok:false, error:"edge"|"failover"}` shape described in `review/02 §4 row 4` is **not** in the current bytes.

### 5.2 Assessment
A **well-formed honest stub** — never fabricates output, typed failure modes, and a production note (`:28-32`: key must move server-side behind a `createServerFn`) that names the correct end state. It is the right *shape* at the wrong *location/backend* for the Pro build: the repo's configured backend is DeepSeek (`.env.example` `DEEPSEEK_API_KEY`; `research/deepseek-api.md:1`), not x.ai `grok-4.5`. Findings:

### A-01 — `isAiConfigured()` and `aiWiringState()` disagree about what "configured" means — P3 `[NEW]`
- **file:line:** `src/lib/ai.ts:57-60` vs `:63-71`.
- **Verified:** `isAiConfigured()` requires **both** `VITE_AI_BASE_URL` **and** `VITE_AI_API_KEY`; `aiWiringState()` reports `status:"wired"` given **only** the key (base URL falls back to the x.ai default at `:68`). Key-only env ⇒ one predicate says not-configured while the other says wired — the ambiguity the module's honesty contract (`:12-18`) exists to prevent; whichever predicate a future UI calls will mislabel state.
- **PROPOSED FIX:** one source of truth: configured ⇔ key present (base URL is optional by design, `:68`), or make `aiWiringState` mirror `isAiConfigured` exactly and expose a single `aiConfig()` helper both call.

### A-02 — Default model/base drift vs. the repo's real backend — P3 `[NEW]`
- **file:line:** `src/lib/ai.ts:35-36` (`api.x.ai`, `grok-4.5`) vs `.env.example` (`DEEPSEEK_API_KEY`) and `research/deepseek-api.md` §1/§3-4 (DeepSeek `https://api.deepseek.com`, `deepseek-chat`/`deepseek-reasoner`, live-verified).
- **Verified:** nothing in the repo provisions an x.ai key; a dev following the module's own "HOW TO ENABLE" (`ai.ts:20-26`) with the repo's `.env` would configure a second, unprovisioned provider. The `VITE_AI_*` key path also self-exposes if deployed (`:22-24`) — fine for a local tool by design, but the repo's server-env idiom (`*.server.ts` reading `process.env`; `deepseek-api.md:319-337`) is the sanctioned pattern and this module predates it.
- **PROPOSED FIX:** during R-1, replace the defaults with the DeepSeek endpoint/model (env-overridable server-side) and never add a `VITE_` key path to any new module.

### A-03 — Header cites transient working docs that the next cleanup will delete — P4 `[NEW]`
- **file:line:** `src/lib/ai.ts:4-5` ("see review/01 A25/A26 and review/02 §4 row 4") and `:31-32`.
- **Verified:** the referenced findings exist today (`review/01:61-62,410`; `review/02:462`), but `review/`/`fixes/` are campaign working documents.
- **PROPOSED FIX:** fold into R-1 — when the server-side provider ships, rewrite the header self-contained (no file pointers outside `src/`), same class as the §4 note.

### 5.3 Retire-vs-replace recommendation (grounds for R-1)
**Retire the `VITE_AI_*` client path as the intended wiring; keep the typed-result *shape*.** The module's own production note (`ai.ts:28-32`) concedes the client path is dev-only. Pro work: (1) add a server-only provider module reading `process.env.DEEPSEEK_API_KEY` (never `VITE_`), returning the same `{ok:true,text} | {ok:false,reason:…}` union extended with the DeepSeek-verified error taxonomy (`deepseek-api.md:241-261`: 429 rate-limit, insufficient-balance, `reasoner` vs `chat`); (2) expose it over a `createServerFn`; (3) delete `ai.ts` or reduce it to a thin local-dev wrapper over that server fn. The file must **not** remain the only "LLM" surface: its defaults point at an unprovisioned provider (A-02).

---

## 6. Preview-origin & host bridge — delta re-check vs. audit/02 (full re-read, current bytes)

`src/lib/preview-embedder-origin.ts` (72 lines) and `src/lib/preview-host-bridge.ts` (287 lines) read in full; state vs. the audit/02 register:

| Prior finding | Current bytes | Status |
|---|---|---|
| BUG-12 — parameterized route patterns leak into host autosuggest (`audit/02:429-430`) | `preview-host-bridge.ts:270` now filters `/\$|:|\*/` with an explanatory comment (`:267-270`) | **FIXED in tree** (current file is 287 lines vs 283 audited; the guard is present) |
| BUG-11 — location report can race router state (`queueMicrotask`) | `preview-host-bridge.ts:190` still reports via `queueMicrotask` after `navigate()` | **Open** (P3, as filed) |
| BUG-13 — version mismatch is drop-silent; reports are hand-built | `preview-host-bridge.ts:174-175` (silent drop); `reportLocation` payloads hand-built `:117-126` | **Open** (P3, as filed) |
| BUG-14 — unconditional loopback embedder trust in dev | `preview-embedder-origin.ts:20` unchanged | **Open** (P3, as filed) |

- **No new bridge/origin defects found.** Re-checked and clean: allowlist parsing + protocol restriction (`preview-embedder-origin.ts:15-28`), sandbox-guest pair logic (`:35-45`), `isSafeBridgePath` (rejects `//`, `\`, protocol escape; `preview-host-bridge.ts:47-57`), `post()` targetOrigin discipline (`:113-115`), `event.source === window.parent` + origin equality (`:170-172`), history-root floor for Back (`:84-111,194-201`), schema-enforced envelopes (`:20-38,174-201`), and `collectRoutePathsFromTree` (`:249-287`).
- Coverage note: `preview-host-bridge.test.ts` now exists and runs in `npm test` (partially addressing `audit/02:513`); `preview-embedder-origin.ts` still has no dedicated unit-test file (only transitive coverage). P4.

---

## 7. Cross-cutting false-capability audit (whole `src/` tree — claims vs. wiring)

Method: grep for `wasm|WebAssembly`, `P2P|WebRTC|RTCPeerConnection`, `research|Research`, `LLM|llm`, `agent|Agent`, `sandbox`, `deploy|deployed`, `ws://|WebSocket|websocket`, `Tavily`, `enrichBrief` across `src/**/*.{ts,tsx}`; every hit was read in context and classified.

| Capability word | Where it appears (file:line) | What it actually is | Verdict |
|---|---|---|---|
| **wasm** | `db.ts` (PGlite); `packet.test.ts:231,246` | PGlite is genuinely WebAssembly; the packet tests assert the compiled agent packet **never claims** wasm isolation (honesty guard). No code claims a wasm sandbox. | Honest |
| **P2P / WebRTC** | `multiplayer/{index,p2p}.ts` only | Dormant; zero importers; header disclaims the missing relay (§4). | Honest (orphaned) |
| **research** | `phases.ts:7,63` (P0/P7 titles); `engine.ts:57,529`; `packet.ts:208`; `types.ts:64`; `dod.ts:133` | All P0/P7 output is deterministic template content labeled `illustrative` / "NOT live research" (`engine.ts:529`); `Competitor.source` reserves `"cited"` (`types.ts:64`); packet says "deterministic feasibility estimate — template-derived, not live research" (`packet.ts:208`). No UI/artifact claims live research. | Honest — nothing wired, nothing claims to be |
| **LLM / llm** | `ai.ts` (§5); `algorithms.ts:756-757` (LiteLLM row inside a deterministic platform-comparison table); engine/phase comments + `modelRoute` labels | `modelRoute` hard-coded `"local-edge"` (`engine.ts:988`), `"grok-4.5"/"failover"` survive only as labels (audit/01:439) — display-only. ai.ts stub is honest. | Honest |
| **agent / Agent** | `console.tsx`, `packet.ts:126` ("You are a governed implementation agent…"), `handoff.ts`, `io.ts`, engine/store/phase machinery | The app's *subject matter* — it governs an agent prompt/spec factory. Deterministic artifact content, not a claim of a running agent. | Honest |
| **sandbox** | `engine.ts:12,377,399-410,993-999`; `sandbox.ts` (whole); `console.tsx:76-77,482-484`; `types.ts:211-216` | `runtime:"sync-template"` default; `sandboxClaim()` labels the runner honestly everywhere quoted (`sandbox.ts:158-167`); console "sandbox pass/fail" reports the real deterministic self-test. `runSandboxed()` worker isolate (`sandbox.ts:170+`) is imported **only by its test** (`sandbox.test.ts:7,266-311`) — no production caller — and non-template source is refused (`sandbox.ts:82`): a tested-but-reserved capability, honestly described (`engine.ts:994-995`). | Honest — CC-1/CC-2 are the two artifact-text leaks |
| **deploy / deployed** | `auth/*`, `db.ts`, `p2p.ts:6`, `preview-host-bridge.ts:5`, phase-9 title | Real tri-mode auth/deploy handling (audit/03 §1); P9 artifact is deterministic design content anchored by the P4 footer (`engine.ts:410`). | Honest |
| **ws:// / WebSocket / websocket** | `algorithms.ts:602` (advisory text); `engine.ts:375-380` (MCP roster); `sandbox.ts:12-13` (banned primitive); dormant `p2p.ts`; `packet.test` | See **O-02** — the phase-3 MCP roster is the only place an unimplemented WebSocket/MCP capability reads as concrete without a disclaimer. | O-02 (P3) |
| **Tavily** | `.env.example` only ("Leave blank to keep research in honest 'not-configured' deterministic-fallback mode") | Env placeholder; no consumer yet. | Planned, not claimed |
| **enrichBrief** | `ai.ts` header only (documents its own removal, `:31-32`) | Gone; removal claim verified. | Honest |

Cross-cutting findings (beyond the registers above):

### CC-1 — "Isolation policy" artifact leaks `null MB` and the raw `sync-template` enum (cross-cutting instance of O-01)
See O-01 — `engine.ts:399-400` + defaults at `engine.ts:993-999,1078-1082`. P3; fix as proposed there.

### CC-2 — Sibling-artifact disclaimer asymmetry: P4 has the B-18 footer, P3 does not (cross-cutting instance of O-02)
See O-02 — `engine.ts:364-385` vs the footer at `engine.ts:410`. P3.

### CC-3 — `runSandboxed` (worker isolate) is tested but has no production caller — reserved capability, keep honest — P4 `[NEW, verified]`
`sandbox.ts:170-324` (worker protocol: network stubs, console capture, wall-clock terminate, host-side crash surface) is imported **only** by `sandbox.test.ts`; the engine imports `runGenerated`/`buildPhase6Module`/`healSource`/`sandboxClaim` (`engine.ts:12`) and refuses non-template source (`sandbox.ts:82`), so no current path generates code needing the worker. This is the correct honest posture for R1 (`engine.ts:994-995`). Flagging so the Pro wiring does not rediscover it as a bug, and so any future non-template producer is *required* to route through `runSandboxed` rather than widening `new Function`.

---

## 8. Integration-surface gaps — what the ai.ts replacement + research + agent-report intake must look like (requirements only)

Grounding: `research/runtime-integration.md` §1 (Tavily spec + file targets) and §2 (bounded Node runner), `research/deepseek-api.md` §1/§10 (DeepSeek spec + server-env idiom), plus the verified tree state above. This section lists **requirements**; the Pro agents own the implementations. Every target below is a new file or an already-named seam.

### R-1 — LLM provider replacement (retire the ai.ts client path)
- **Server-only provider module** (new `src/lib/llm.server.ts` or `src/lib/deepseek.server.ts`), reading `process.env.DEEPSEEK_API_KEY` (+ optional `LLM_BASE_URL`/`LLM_MODEL` overrides) — **never** `VITE_` (`.env.example` header rule). Copy the typed-result contract of `ai.ts:38-45,78-137`: `{ ok: true; text: string } | { ok: false; reason: "not-configured"|"http"|"network"|"invalid-response"|"rate-limited"; status?; message? }`, abort-on-timeout, no fabricated fallback (`deepseek-api.md:237`).
- **Server fn exposure** via TanStack Start `createServerFn`; client modules import only the fn, never `process.env` (the `ai.ts:28-32` production note, made real). Follow the repo's `*.server.ts` env idiom (`gate-identity.server.ts`, `auth/server.ts:69`, `app-data/client.server.ts:21`).
- **Model mapping:** DeepSeek `deepseek-chat` (flash tier) / `deepseek-reasoner` (pro tier) per `deepseek-api.md:300-317`. Leave `modelRoute:"local-edge"` untouched unless a real router ships (audit/01:439).
- **Disposition of `ai.ts`:** delete, or keep strictly as a dev-only local wrapper over the server fn; drop the x.ai defaults (A-02); rewrite the header self-contained (A-03). Carry over `complete()`'s 20 s timeout / 8k slice conventions.
- **Tests:** result-handling unit tests with an injected `fetch` — never a live key.

### R-2 — Real research wiring (P0 "Deep Research & Feasibility", P7 "Domain & Market Research")
- **New `src/lib/tavily.server.ts`** — copy-paste spec already validated in `research/runtime-integration.md:61-120` (request/response contract; error map 400/401/429/432/433/500 at `:130-136`; cost guardrails at `:137`). Server-only env; `.env.example` already reserves `TAVILY_API_KEY`.
- **Expose via a `createServerFn`** (e.g. new `src/lib/research.ts`) — client never imports the server module.
- **Engine/store hook:** `synthesizePhase` is synchronous; research is async — the practical wiring is an async pre-step in `src/lib/store.ts` `execute` for P0/P7 (or a dedicated "Run research" action on the phase cards, `research/runtime-integration.md:144`), stashing `{query, results[]}` before the phase artifact builds.
- **Data model:** `types.ts:64` already reserves `Competitor.source:"cited"`; add optional `sources?: { title: string; url: string; content?: string }[]` to `Artifact` (or embed a markdown source list in `artifact.body` — lower touch). On success emit a real artifact with `source:"cited"` rows; on missing key/timeout/cap, **keep today's deterministic output untouched and label the phase honestly** ("research backend not configured/unavailable — content illustrative"), per `research/runtime-integration.md:145`.
- **UI:** cited-vs-illustrative labeling in `console.tsx` artifact rendering + a footnote when fallback fired; never present fallback rows as findings.

### R-3 — Chat / conversational intake (only if the product brief calls for it)
- Requirement: **no silent mock chat.** Any chat surface must either (a) call the R-1 server fn with the typed result surfaced verbatim, or (b) be labeled "simulated preview". Do not ship `ai.ts`'s `complete()` client-side with a dev key as the production path. If chat drives phase intake, the deterministic synthesis stays the offline default — the B-18/B-23 honesty apparatus is untouched.

### R-4 — Agent-report intake (making the packet a two-way artifact)
- **Gap:** the packet is export-only (copy/download via `console.tsx`/`io.ts`; no server route — `audit/01:454` finding (c) still stands). If paste-back intake is in scope, requirements:
  1. **Validation-first import** — zod schema over the report shape; reject malformed input without touching store state (mirror `io.ts` `importProject` conventions).
  2. **Append-only, distinguishable landing spot** — new `Project.reports[]` (or reuse `decisions`/logs) so imported text is never confused with engine output.
  3. **Honest labeling** — imported agent text visibly marked "external report, unverified by engine".
  4. **Server route only if remote agents must POST** — new `src/routes/api/packet.ts` + deployed-mode auth rules; otherwise keep clipboard/file as the channel.
  5. **No p2p/WebRTC involvement** — §4's module is not the substrate for this.

### R-5 — Sandbox next step (deferred, must not be forgotten)
- When any producer can emit non-template code, that path **must** call `runSandboxed()` (`sandbox.ts:170+`) — the only legal executor (`sandbox.ts:82,170`); do not widen `new Function`. If the worker blob needs a stable URL in production (Vite asset), add it then. Land O-01's `ramMb`/runtime rendering fix at the same time.

### R-6 — Test hygiene bundle for the Pro pass
- Fixture-isolate the 8 cwd-coupled OG tests (S-03).
- Add `preview-embedder-origin.ts` unit tests (currently only transitive coverage) and a guard test for BUG-14's loopback expansion if it stays.
- Keep the 185-passing baseline green on this Windows host; the symlink pair (#80/#184) stays POSIX-only by design (skip-if-EPERM, don't delete).

---

## 9. Priority order & tally

| ID | Sev | Area | One-line fix |
|---|---|---|---|
| S-04 | P2 | `browser-guard.mjs` / `browser-smoke.mjs` | Fail closed on win32 for sandbox-only capture scripts — no silent `C:\workspace` writes |
| S-03 | P2 | `grok-pwa-plugin.test.mjs` | Fixture-isolate the 8 cwd-coupled OG tests so customized apps keep `npm test` green |
| O-01 / CC-1 | P3 | `engine.ts:399-400` | Render RAM conditionally; print `sandboxClaim` text, not the raw runtime enum |
| O-02 / CC-2 | P3 | `engine.ts:364-385` | Add the "declared, not implemented" footer to the P3 MCP roster (mirror `:410`) |
| A-01 | P3 | `ai.ts:57-71` | Single configuration predicate (key-only = wired) |
| A-02 | P3 | `ai.ts:35-36` | Point defaults at the provisioned DeepSeek backend during R-1, or delete the file |
| S-01 | P3 | `check-auth-invariant.mjs:93-94` | Reject a missing/flag `--dev-url` value with exit 1 |
| S-02 | P3 | `browser-smoke-verdict.mjs:22-25`, `brand-check.mjs:182-184` | Reject flag-like values in flag-value parsers |
| S-05 | P3 | `write-atomic.mjs:30-33` | Realpath the staging dir before the containment check (audit/03 E, re-verified) |
| O-04 | P3 | `grok-pwa-shared.mjs:160-183` | Manifest name prefers `site.title` (resolveOgTitle order) |
| O-03 | P3 | `browser-smoke.mjs:143` | Accept an env/flag game indicator so smoke and brand-check agree |
| A-03 / §4 note | P4 | `ai.ts`/`p2p.ts` headers | Rewrite headers self-contained when review/ docs are pruned |
| CC-3 | P4 | `sandbox.ts:170+` | Keep `runSandboxed` reserved; route future non-template exec through it |

**Tally of this pass:** NEW verified findings — 5 script/tooling (`S-01…S-05`, one P2), 4 OG/brand (`O-01…O-04`), 3 ai.ts (`A-01…A-03`), plus the cross-cutting instances CC-1/CC-2 (the O-01/O-02 artifact leaks, reachable from whole-tree grep) and CC-3 (reserved-capability note). Re-verified-open items referenced without duplication: p2p M-1..M-12 / BUG-22..25 (re-anchored to current lines in §4), bridge BUG-11/13/14 and BUG-12-fixed (§6), write-atomic audit/03-E (S-05), packet export-only `audit/01` finding (c) (§8 R-4). The known 10 script-suite failures were re-run and confirmed unchanged (8 og-coupling + 2 symlink-EPERM), **no new failures**; the coupling's root cause is new work in S-03.

**Bottom line:** the scripts/OG/PWA layer and the dormant p2p module are *honest* — every "live" claim found in the whole `src/` tree checks out or is explicitly disclaimed, and the deterministic engine's labeling conventions (illustrative/cited, `sandboxClaim`, packet-test guards) hold except for two artifact-text leaks (O-01/O-02). The real work is integration, not correction: retire the client-side `VITE_AI_*` path for a server-only DeepSeek provider (R-1), make `TAVILY_API_KEY` real through a server module + async P0/P7 hook (R-2), and decide the agent-report intake channel with validation-first import (R-4) — none of which require touching the platform chrome this audit re-verified as sound.

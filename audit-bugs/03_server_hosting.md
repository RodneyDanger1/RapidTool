# RapidTool Audit-Bugs 03 — Auth / DB / Server / Hosting + server-side LLM·research·exec gaps

**Repo:** `C:/Users/mnril/Desktop/RapidTool Main` (NOT a git repository)
**Agent:** Flash AUDIT (strictly read-only; the only file written is this one)
**Date:** 2026-09-05

## 0. Scope, method, posture

### 0.1 Files read in full (with line counts at audit time)
- Auth: `src/lib/auth/gate-identity.server.ts` (210), `gate-session.server.ts` (352), `verify.server.ts` (111),
  `middleware.ts` (47), `isolation.server.ts` (59), `server.ts` (261), `client.ts` (243), `popup.server.ts` (178),
  `preview.ts` (32), `providers.ts` (31), `email-password.ts` (10), `pglite-dialect.ts` (138), `use-current-user.ts` (82),
  `gates.tsx` (132), `sign-in-gate.ts` (13), `provider.tsx` (15), `gate-session-marker.ts` (18)
- App-data: `client.server.ts` (355), `types.ts` (38), `errors.ts` (56), `login.ts` (36), `index.ts` (14), `server-only.ts` (11)
- DB/migrations: `src/lib/db.ts` (238), `migrations/auth/0001_auth.sql` (67), `scripts/migration-plan.mjs` (46), `scripts/migrate.mjs` (90)
- Build/hosting: `vite.config.ts` (183), `scripts/with-app-env.mjs` (136), `scripts/app-env-plugin.mjs` (34),
  `scripts/grok-pwa-plugin.mjs` (190), `scripts/grok-pwa-shared.mjs` (527), `server/middleware/grok-pwa.ts` (111),
  `.vercel/output/config.json` (22), `.vercel/output/functions/__server.func/.vc-config.json`, `.grok/app-env.json`,
  `.env` / `.env.example`, `package.json`, `startup.sh`, `src/lib/ai.ts` (137)
- Docs/context: `.grok/references/data-and-auth.md`, `.grok/references/deploy-target.md`, `AGENTS.md`, `AGENT_GUIDE.md`,
  `research/deepseek-api.md`, `research/runtime-integration.md`, prior `audit/03_auth_appdata_platform_audit.md`,
  `fixes/06_reconciliation.md`

### 0.2 Method
Every claim below was verified against current file bytes and quoted with `file:line`. No `package-lock.json`,
`node_modules`, or `.vercel/output` bundle internals were read (the two `.json` control files above are exceptions,
read for the hosting contract). Items previously fixed per `fixes/06_reconciliation.md` (audit/03 A/B/D/F/G/H) were
re-read in the current tree; where a *residual* of a fix survives it is reported as such (SH-01, SH-10). The
task-mandated "PWA XSS" claim was re-checked against the current bytes and remains refuted (§2.1) — it is not
re-raised, and no new evidence for it was found.

### 0.3 Runtime posture of THIS tree (context for severities)
- The RapidTool app itself is **fully client-side**: no `createServerFn` call sites exist in `src/components` or
  `src/routes` (verified by grep), persistence is `localStorage` only (`src/lib/io.ts`), and the server is an SSR
  shell. Auth is OFF (`.grok/app-env.json` → `"VITE_AUTH_ENABLED": "false"`, `"deploy": {"database": false}`), `.env`
  sets no `DATABASE_URL`, and `src/lib/ai.ts` has **zero callers** (self-documented at `ai.ts:4-9`, re-verified).
- Consequently most findings in §1 are **latent template / config-safety bugs**: they bite the moment a fork (or
  this app's future server work) turns on auth, a real database, connectors, or provider keys. Each severity
  assumes that activation context and notes where it is harmless today.

---

## 1. Verified bugs register

### SH-01 — Gate-materialization dedupe lock is per-process; Neon/serverless multi-isolate double-fire can still mint duplicate user + account rows — P3 (data integrity; no privilege escalation)
**Where:** `src/lib/auth/gate-session.server.ts:36-57` (in-process `materializationLocks` Map + queue), `:261`
(`withMaterializationLock(identity.sub, …)`), `:295-311` (`handleOAuthUserInfo` read-then-insert); schema gap at
`migrations/auth/0001_auth.sql:40-54`.
**Verified (byte trace):**
- `gate-session.server.ts:26-35` — the file's own comment states better-auth account linking is read-then-insert
  with "no DB unique constraint on (`providerId`, `accountId`) — see the auth migration".
- `migrations/auth/0001_auth.sql:40-54` — the `account` table columns `accountId`/`providerId` have **no** unique
  index; the only indexes created are `session_userId_idx`, `account_userId_idx`, `verification_identifier_idx`
  (`:65-67`). Confirmed.
- `gate-session.server.ts:36-57` — the lock is a `Map<string, Promise<void>>` in module scope: it serializes only
  within one Node process/isolate.
- Deployed apps run Better Auth against Neon through Vercel serverless (`__server.func/.vc-config.json` →
  `launcherType: Nodejs`, `runtime: nodejs22.x`); the SPA + prefetch double-fire on `/get-session` that the lock
  exists for can land on two isolates that both read "no account row" and both insert → two `user` rows + two
  `grok-gate` account rows for one gate `sub`, one orphaned.
- This is the residual of the previously-fixed F2/G (`fixes/06_reconciliation.md`); the in-process fix is complete
  for the PGLite preview (single process) but not for Neon.
**Why it matters:** duplicate identity rows are a silent integrity wart — lookups still match either row today, but
`sessionBoundToGateIdentity` (`gate-identity.server.ts:166-176`) and any future identity-merge logic see ambiguous
state; the orphan's rows are unreachable garbage. No privilege escalation (the attacker controls neither identity).
**PROPOSED FIX:** (1) follow-up migration:
`create unique index if not exists account_provider_account_idx on "account" ("providerId","accountId");`
(2) in the gate hook, wrap `handleOAuthUserInfo` (`gate-session.server.ts:296-311`) so a unique-violation (pg code
`23505`) is caught and resolved by re-reading the existing user via `findAccounts` for
(`providerId` = `grok-gate`, `accountId` = `sub`) instead of inserting; (3) keep the in-process lock for PGLite.
Do **not** add the constraint and ignore the conflict — better-auth's insert would then throw on the legitimate
double-fire and break first-visit sign-in.

### SH-02 — Better-Auth schema is never auto-applied; flipping `VITE_AUTH_ENABLED` on without a manual copy-up leaves a schema-less auth DB (Neon AND PGLite) — P2 (operational, fails at runtime)
**Where:** `src/lib/db.ts:140-144` (PGLite glob `"/migrations/*.sql"`, non-recursive → `migrations/auth/` excluded),
`scripts/migrate.mjs:29-40` (Neon `readdir`, non-recursive + exits 0 without `DATABASE_URL`),
`scripts/migration-plan.mjs:39-46` (top-level `.sql` filter), `migration-plan.mjs:9-13` (comment: auth schema is
"safe to copy from `migrations/auth/` into `migrations/` when an app turns sign-in on"),
`.grok/references/data-and-auth.md:30-33` (manual "copy it up" step).
**Verified (byte trace):**
- `find migrations` on this tree returns **only** `migrations/auth/0001_auth.sql` — `migrations/` root has zero
  `.sql` files, so `_migrations`-tracked appliers have nothing to run here (correct for the auth-off app).
- `src/lib/auth/server.ts:144-146` — Better Auth runs against `new Pool(DATABASE_URL)` (Neon) or
  `pgliteDialect(() => getPglite())` (PGLite preview). Neither backend ever creates `"user"`/`"session"`/
  `"account"`/`"verification"` unless `0001_auth.sql` has been copied up by a human.
- The one fail-closed guard that exists covers the *opposite* misconfiguration: DB-set-but-auth-off
  (`verify.server.ts:21-27`). There is no inverse guard (auth-on-but-schema-missing): failure surfaces only at the
  first Better-Auth query (`relation "user" does not exist`), in the live preview too — i.e. the documented promise
  "sandbox live preview: real sign-in works" (`auth/server.ts:16-22`) collapses on the most likely misconfig.
**Why it matters:** the tri-mode story depends on a manual file copy that nothing enforces; both backends fail late
and loudly-ish, but only under real traffic, and the error text points nowhere.
**PROPOSED FIX:** (a) startup assertion in `src/lib/auth/server.ts` after `ensureDbReady()` (`:50-51`): when
`authConfigured` (`:85-86`), run `select 1 from "user" limit 1` and on failure `console.error` an actionable
message naming the copy step (style of `verify.server.ts:21-27`); (b) when `VITE_AUTH_ENABLED !== "false"`, make
the **PGLite** applier descend one level into `migrations/auth/*.sql` so preview parity is automatic; Neon keeps
the build-time `db:migrate` path (which needs the file at `migrations/` root — see SH-03); (c) extend
`scripts/check-auth-invariant.mjs` with a schema probe when auth is on.

### SH-03 — Neon schema is applied ONLY at build time, and only when `DATABASE_URL` exists in the *build* env; `db.ts` comment claims auto-apply "on both backends" — P2 (doc-vs-code contradiction + deploy footgun)
**Where:** `src/lib/db.ts:88-106` (`createNeonSql` — OID parsers + bare `Pool`, **no migration pass**),
`src/lib/db.ts:186-187` (doc comment: "Schema comes from `migrations/*.sql`, auto-applied before the first query on
**both backends**"), `scripts/migrate.mjs:21-27` (`DATABASE_URL` unset → log + `process.exit(0)`),
`package.json:11` (`build` = `vite build && npm run db:migrate`), `.grok/references/data-and-auth.md:24-26`.
**Verified (byte trace):**
- `createNeonSql` (`db.ts:88-106`) contains no migration logic — pool creation at `:96`, query wrapper at `:97-100`.
- The PGLite path self-migrates on first connect (`db.ts:139-157`, transaction-per-file, `_migrations`-tracked);
  the Neon path's only applier is `npm run db:migrate`, invoked **after** `vite build` (`package.json:11`).
- If Vercel's build environment does not carry `DATABASE_URL` (env scoped runtime-only in project settings — a
  routine misconfig), `migrate.mjs` logs and **exits 0** (`migrate.mjs:22-27`) → deploy ships green with zero
  tables; runtime still never migrates, so every DB query 500s.
**Why it matters:** green deploy with a dead database; the failure knob is a Vercel env-scoping setting, invisible
in this repo.
**PROPOSED FIX:** (1) make the comment true: run the same `pendingMigrations` transaction-per-file pass on first
Neon connection inside `createNeonSql` (idempotent via `_migrations`, exactly like `db.ts:145-156` and
`migrate.mjs:56-75`); or (2) if runtime DDL on Neon is unwanted, make the build fail loudly — in `migrate.mjs`,
when `DATABASE_URL` is absent AND pending `.sql` files exist AND `NODE_ENV === "production"` (or `VERCEL`/`CI` is
set), exit 1 with "DATABASE_URL must be exposed to builds (`npm run build` runs `db:migrate`)"; and (3) fix the
`db.ts:186-187` comment either way. Double application is safe because of basename keying (`migration-plan.mjs:39-46`).

### SH-04 — Silent PGLite fallback in production serverless: misprovisioned deploy (no `DATABASE_URL`) runs per-isolate in-memory DBs with no guard — P2 (config-safety)
**Where:** `src/lib/db.ts:8-19` (empty/whitespace `DATABASE_URL` → `dbSource = "pglite"`), `:108-168` (in-memory
`PGlite`, per-process `_migrations`, data dies with the isolate), `:232-238` (eager boot on module load).
**Verified (byte trace):**
- `db.ts:8-11` — normalization treats empty/whitespace `DATABASE_URL` as unset; the adjacent comment
  (`:6-7`) states why: "otherwise production would silently run on the PGLite fallback".
- `db.ts:19` — `dbSource` is `"pglite"` whenever no `DATABASE_URL`; **nothing checks `NODE_ENV`** before that choice.
- PGLite is a per-process in-memory Postgres whose `_migrations` table is created fresh per instance
  (`db.ts:122-124`) — on Vercel's Nodejs isolates, concurrent requests are load-balanced across warm instances,
  each with an independent DB: rows written on isolate A are invisible on isolate B.
**Why it matters:** inert while `deploy.database: false` and no DB use; the moment a fork adds migrations/auth
without a provisioned `DATABASE_URL`, the deployed app "works" per-request then silently loses/never-sees data —
the exact failure the `:6-7` comment worries about, with no runtime tripwire.
**PROPOSED FIX:** in `createSql()` (`db.ts:172-180`) or the eager boot (`:232-238`): when
`dbSource === "pglite"` and `process.env.NODE_ENV === "production"`, throw: "DATABASE_URL is not set in this
deployment — refusing to run the ephemeral in-memory PGLite fallback in production." Dev/preview keep the fallback
unchanged.

### SH-05 — Gate-identity issuer resolution silently returns null for any host outside two hard-coded platform domains — deployed preview/custom hosts never materialize gate sessions — P3
**Where:** `src/lib/auth/gate-identity.server.ts:129-162` (`resolveGateEndpoints`), `:150-159` (only
`app-builder-testing.com` / `grok.me` and their subdomains map to an issuer), `:159` (`if (!issuer) return null`),
consumed at `:185-186` (`gateIdentityFromHeaders` → null, silent).
**Verified (byte trace):**
- `gate-identity.server.ts:136-141` — with no `GROK_PROJECT_ID` (preview), endpoints default to the local preview
  gate `127.0.0.1:6014`; with `GROK_PROJECT_ID` set (deployed) and `GROK_GATE_ORIGIN` unset, the issuer is chosen
  **from the request host** against exactly two suffixes (`:150-158`).
- Any other host (Vercel preview URL, custom domain, staging host) → `endpoints === null` → a valid
  `x-grok-identity` JWT is silently ignored → `/get-session` returns signed-out. No log line exists on this path
  (`:185-186` just returns null).
**Why it matters:** zero-click gate sign-in dies silently on legitimate alternate hosts. The escape hatch exists —
`GROK_GATE_ORIGIN` (`:130-134`) — but nothing tells an operator it is required.
**PROPOSED FIX:** (1) in `gateIdentityFromHeaders` (`:178-192`), when `gateIdentityEnabled()` and
`env("GROK_PROJECT_ID")` are set and `resolveGateEndpoints` returns null, emit a rate-limited `console.error`
explaining gate identity needs a grok.me/app-builder-testing.com host or `GROK_GATE_ORIGIN`; (2) document
`GROK_GATE_ORIGIN` as mandatory for non-platform hosts in the deployer env contract (§4). Do **not** widen the host
allowlist — that mapping is the platform's trust list.

### SH-06 — `/auth/popup` responses carry no CSP / frame-ancestors / referrer policy, including the token-bearing completion page — P3 (hardening; residual bounded by cookie flags)
**Where:** `src/lib/auth/popup.server.ts:44-51` and `:115-123` (headers are only `content-type` +
`cache-control: no-store`), `:126-158` (`completionHtml` embeds the session token as a JSON payload in the DOM),
`src/lib/auth/client.ts:193-199` (opener side: origin + `event.source` checks).
**Verified (byte trace):**
- The completion page (`?done=1`) is same-origin, embeds the visitor's live session token
  (`popup.server.ts:38,144`), and sets **no** `Content-Security-Policy`, `X-Frame-Options`, or `Referrer-Policy`.
- Exploitability is bounded today: the session cookie is `__Host-` + `Secure` + `SameSite=Lax`, no `Domain`
  (`server.ts:223-231`), so a cross-site frame of the completion URL receives no cookie (token null); the inline
  script posts only to `window.opener` with `targetOrigin = window.location.origin` (`popup.server.ts:151`), so a
  malicious opener is rejected; `</` escaping in the JSON payload (`:129`) blocks script-element breakout.
- This is defense-in-depth debt: the one page in the app that deliberately renders a credential is also the one
  page with no security headers.
**PROPOSED FIX:** add to `completionResponse`/phase-2 (and where permitted on the 302):
`content-security-policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'`,
`x-frame-options: DENY`, `referrer-policy: no-referrer`. The page is self-contained inline HTML/JS, so
`script-src 'unsafe-inline'` suffices — verify popup completion still posts/ closes before shipping.

### SH-07 — `gatePost` (connectors `call-tool`) has no timeout/abort — a stalled gate hangs the server function — P3
**Where:** `src/lib/app-data/client.server.ts:122-127` (`fetch(\`${base}/call-tool\`, …)` with no `signal`), versus
the house pattern `src/lib/ai.ts:88-89` (20 s `AbortController`) and `research/runtime-integration.md:94-95`.
**Verified (byte trace):** `gatePost` awaits an unbounded `fetch` (`client.server.ts:122-127`). A gate that accepts
the connection but never responds stalls the calling `createServerFn` until the platform's own function timeout;
the 5 s failure memo (`:191-227`) never engages because the call never settles to memoize. Every other provider
call in the codebase sets a timeout; this is the only unbounded one.
**PROPOSED FIX:** add `signal: AbortSignal.timeout(15_000)` (or an `AbortController` mirroring `ai.ts:88-89`) at
`client.server.ts:122`, mapping the abort to the existing `fail()` path (`:339-341`) with a
"connector gate timed out after 15s" message so it memoizes like other failures.

### SH-08 — Deployed Better-Auth `trustedOrigins` retains loopback dev origins — P3/P4 (CSRF surface trim)
**Where:** `src/lib/auth/server.ts:118-119` (`explicitBaseURL ? [explicitBaseURL, ...LOCAL_DEV_ORIGINS] : […]`),
`LOCAL_DEV_ORIGINS` at `:101-105`.
**Verified (byte trace):** with `BETTER_AUTH_URL` set (deployed), credentialed auth POSTs are accepted when the
browser's `Origin` is `http://localhost:8080`, `http://127.0.0.1:8080`, or `http://[::1]:8080`. Not remotely
exploitable — a browser only sends those Origin values for code genuinely running on that loopback origin (DNS
rebinding fails because the forged page's Origin is the attacker's host, which is rejected) — but production
should not bless dev origins.
**PROPOSED FIX:** when `explicitBaseURL` is present, use `[explicitBaseURL]` (+ operator allowlist) and drop
`LOCAL_DEV_ORIGINS`; local dev without `BETTER_AUTH_URL` already receives loopback origins via the non-explicit
branch (`:120-126`), so nothing local breaks.

### SH-09 — Live API keys sit in an unprotected `.env` with no ignore/guard file; platform snapshots/handoffs would ship them — P2 (secret hygiene, workspace level)
**Where:** workspace root `.env` (250 B; keys `DEEPSEEK_API_KEY`, `TAVILY_API_KEY` verified present),
`.env.example` (declares both), `research/deepseek-api.md:5-6` ("The key is … not … anywhere in the repo's
committed files (it lives only in the local `.env`)"), and **no `.gitignore`/exclusion file exists** (verified:
root `ls -a` shows no ignore file; `.grok/` also accumulates `preview.log`).
**Verified (byte trace):** `ls -a` at the workspace root lists `.env` and no `.gitignore`/`.npmignore`; the
platform snapshots, hibernates and revives the workspace (`AGENTS.md` §1, `startup.sh`) and hands it between
agents/machines (`AGENT_GUIDE.md:64-74` — "Export to back up", "move between machines"). A `.env` holding live
provider keys is exactly what such a handoff would carry. The only other long hex secret in source is the
by-design low-privilege shared preview client secret (`src/lib/auth/preview.ts:21`, documented `:13-17`).
**PROPOSED FIX:** add `.gitignore` (and platform-equivalent exclusions) covering `.env`, `.env.local`,
`.env.*.local`, `.vercel/output`, `node_modules`, `*.log`; where the loader supports it, keep real local keys in an
excluded `.env.local`; for deploy rely solely on platform env injection (never bake keys into the bundle — §3
GAP-L4); note the rule in `AGENTS.md` startup section ("keep no secrets that shouldn't live in the workspace
snapshot").

### SH-10 — `isDocumentPath` treats any dot-suffixed route as an asset, silently stripping PWA/OG/install chrome — P3 (audit/03-C, re-verified OPEN in current bytes)
**Where:** `scripts/grok-pwa-shared.mjs:128-137` (`!/\.[a-z0-9]+$/i.test(path)` at `:135`), used by
`scripts/grok-pwa-plugin.mjs:65,96` and `server/middleware/grok-pwa.ts:84,99`.
**Verified (byte trace):** current bytes are unchanged from audit/03-C — a route whose final segment ends in
`.<ext>` (future `/login.html`, `/about.en`, `/v1.0`) is classified as an asset: no head-tag injection, no
share-meta stripping, no `?install=1` tutorial, no manifest. No such route exists in this tree today, so it is a
latent regression trap for forks.
**PROPOSED FIX:** match a known-asset allowlist (`\.(?:js|css|png|jpe?g|gif|svg|webp|woff2?|ico|json|txt|mp[34]|wasm)$`)
instead of any trailing `.[a-z0-9]+`, keeping the `/__grok/`, `/api/`, `/@`, `/node_modules` exclusions.

---

## 2. Checked-and-cleared (re-verified against current bytes — do NOT re-file these)

### 2.1 "PWA XSS via host header" — REFUTED, still refuted (task-mandated re-check; no new evidence)
- `x-forwarded-host` → `appNameFromHost` (`grok-pwa-shared.mjs:62-82`) returns only a slug matched against
  `^[a-z0-9-]{1,63}$` or the constant `DEFAULT_APP_NAME` (`:72-74`), so hostile hosts collapse to a safe constant.
- Every interpolation sink is escaped: install page `renderInstallPageHtml` `escapeHtml`s both substitutions
  (`:154-158`); manifest is `JSON.stringify`'d (`:160-183`); head/OG tags escape appName/title/description/image/
  banner/creator/projectId (`:185-201`, `:220-243`, `:336-376`); `escapeHtml` covers `&<>"'` (`:31-38`).
- The streaming injector splices only at a real `</head>` (`:475-527`); `isInstallQuery` requires `install=1`
  **and** `platform=ios` (`:119-125`), so it is not a general HTML-injection gadget.
- Residual is integrity-level only: a direct-to-server client can spoof the share-card host / manifest name in
  proxy-bypassed preview contexts (prior audit/03 §7.5). Not an XSS.

### 2.2 Non-HttpOnly gate marker cookie (`__Host-grok_gate_session`) — benign by design
Value is the constant `"1"`; it only toggles whether `UserButton` shows its sign-out control (`gates.tsx:95-99,116`).
No security decision reads it (`gate-session-marker.ts:13-18`). `__Host-` prefix + no `Domain` blocks sibling
`*.grok.me` planting (`gate-session-marker.ts:6-9`). An XSS that can set/clear cookies is already game-over.

### 2.3 Shared preview client secret baked into source (`preview.ts:20-21`) — bounded, documented, not a leak
Low-privilege broker client restricted to `*.grok-sandbox.com` callbacks; broker stores only `base64url(SHA-256)`
of the secret (`preview.ts:13-17`). Deployed apps use injected `GROK_AUTH_*` (`server.ts:80-86`); the fallback only
matters when injection is missing — and then fails *loudly at the broker* (redirect_uri not sandbox), not as a
silent credential surrender. Ops note, not a code bug: because the fallback exists, `authConfigured`
(`server.ts:85-86`) cannot detect "deployer forgot `GROK_AUTH_*`".

### 2.4 `Authorization: Bearer …` lines are intact — the "***" seen in tool output is a display artifact
`src/lib/app-data/client.server.ts:116`, `src/lib/ai.ts:95`, `research/runtime-integration.md:99` each read as a
standard `Bearer` header in raw bytes (audit/03 seed disposition 3 established this; re-confirmed — each file
contains exactly one `Bearer` occurrence). No literal `***` exists in any audited source file.

### 2.5 Cross-site/same-site isolation residual — accepted and documented, not re-filed
`isolation.server.ts:22-29` documents the no-`Sec-Fetch-*`-header residual (audit/03-D disposition:
accept-and-document). Enforced at the single auth chokepoint (`middleware.ts:44`) and the connector chokepoint
(`client.server.ts:179-189,258`); the session is additionally guarded by `__Host-` cookies, `SameSite=Lax`, and
Better-Auth `trustedOrigins` origin checks — defense-in-depth, as the file states.

### 2.6 Gate JWT/JWKS verification chain — no weakness found
EdDSA-only with pinned algorithms (`gate-identity.server.ts:107-113`), pinned issuer + audience
(`app:<GROK_PROJECT_ID>` or `preview`, `:37-40,109-110`), required claims `sub/iat/exp`, `maxTokenAge: 10m`,
`kid`-miss refetch with 5 min cache (`:71-88`), fail-closed null on every error (`:122-124`), type-checked claim
extraction (`:114-121`). Host-header influence is confined to *which* gate URL the JWKS is fetched from (platform
domains or `GROK_GATE_ORIGIN`); forging still requires the gate's Ed25519 key.

### 2.7 Connector failure memo — correct; 401 bypass verified
Keyed on full-token SHA-256 (`client.server.ts:194-203`), failures only, 5 s TTL with sweep on write
(`:205-227`), 401s bypass the memo (`:312-325`), no data rows ever memoized. Per-process map cannot leak across
serverless isolates (each carries its own), and memory is bounded by the TTL sweep.

### 2.8 OID normalization & migration mechanics — as documented, no drift found
int8/date/interval parsers registered in lockstep for both drivers (`db.ts:53-68`, `:93-95`, `:114-119`).
Migrations: keyed by basename, sorted, transaction-per-file, `_migrations`-tracked (`migration-plan.mjs:39-46`,
`migrate.mjs:56-75`, `db.ts:145-156`). Glob and `readdir` share the same non-recursive scope, so dev/prod cannot
disagree about which files apply (they can only disagree via the manual auth-copy — SH-02).

### 2.9 PGLite ephemerality, `.server` discipline, popup correlation, `__Host-` cookie set — correct in current bytes
- In-memory-per-process semantics are documented and consistent with globalThis singletons (`db.ts:41-51,108-130`,
  `auth/server.ts:53-65` — preview secret also on globalThis so HMR cannot invalidate PGLite-backed sessions).
- Node-only imports live behind `.server` filenames or dynamic imports (`isolation.server.ts:4-9`,
  `middleware.ts:37-46`, `app-data/server-only.ts:1-11`); no client module statically imports a server-only module
  (the `app-data` barrel re-exports only the client-safe surface — `app-data/index.ts:1-14`).
- Popup waiters correlate per attempt via `event.source !== popup` + origin check (`client.ts:193-199`) — the
  audit/03-F1 cross-settle is closed in current bytes.
- All four auth cookies are `__Host-` + Secure + SameSite=Lax + Path=/ with no `Domain` (`server.ts:223-231`),
  closing the sibling cookie-toss vector twice over; identity swaps actively expire the `session_data` cache
  (`gate-session.server.ts:139-166,333-334`).

---

## 3. Server-side gaps for LLM / research / exec

RapidTool's honesty contract (`AGENT_GUIDE.md:9-14`) and the two research specs (`research/deepseek-api.md`,
`research/runtime-integration.md`) define the intended wiring. **None of it exists in `src/` yet** (verified: no
module reads `DEEPSEEK_API_KEY`/`TAVILY_API_KEY`; `ai.ts` has zero callers; `engine.ts`/`store.ts` are synchronous
and localStorage-only). The app currently cannot call an LLM, do live web research, or run server-side code —
every "AI" beat is a correctly-labeled deterministic simulation. The gaps below are the server-only modules and
endpoints that close that loop while preserving the honesty contract and the platform secret pattern
(`GROK_AUTH_*` env injection used by `auth/server.ts:67-86`; trimmed `env()` readers at `gate-identity.server.ts:28-31`).

### GAP-L1 — DeepSeek chat-completions proxy (server-only module + gated server function)
**New module `src/lib/deepseek.server.ts`** (the `.server.ts` suffix is load-bearing, exactly like
`popup.server.ts`/`isolation.server.ts`):
- Read the key with the house helper — `process.env.DEEPSEEK_API_KEY`, trimmed, empty→undefined. **Never**
  `import.meta.env`, never a `VITE_` prefix (`.env.example:5-6`, `deepseek-api.md:33`; the `ai.ts:22-24` comment
  documents the client-side footgun to avoid).
- Verified API contract (`deepseek-api.md:19-34,37-64,175-193`): `POST https://api.deepseek.com/chat/completions`
  (no `/v1`); models `deepseek-v4-flash` / `deepseek-v4-pro` (legacy `deepseek-chat`/`deepseek-reasoner` aliases
  resolve to flash — never use them); always send explicit `max_tokens` and `thinking: {type:"disabled"}` for the
  flash fast path (reasoning tokens count against `max_tokens`); JSON mode requires the prompt to ask for JSON.
- Typed result union mirroring `ai.ts:38-45`:
  `{ ok: true; text: string } | { ok: false; reason: "not-configured"|"network"|"http"|"invalid-response"|"timeout"; status?; message? }`
  with a 20 s `AbortController` (`ai.ts:88-89`); never fabricate output when unconfigured.
- Expose **only** via `createServerFn({ method: "POST" })` with a zod-validated body (e.g. `{ prompt: string ≤ 8000,
  system?: string ≤ 4000, model: "flash"|"pro", maxTokens?: int ≤ 8192 }`), defined in a server module the client
  never imports — same boundary shape as the app-data flow (`data-and-auth.md:84-97`).
- **Protect the paid endpoint** (the app is anonymous today): require a *verified* `x-grok-identity` via
  `gateIdentityFromHeaders` (`gate-identity.server.ts:178-192`) — present only behind the platform edge — else
  403; allow the dev-user path only when `VITE_AUTH_ENABLED=false` and `NODE_ENV !== "production"`. Optionally reuse
  the connector failure-memo pattern for per-viewer rate limiting.
- Wire sites (future work): the deterministic beats in `engine.ts` `synthesizePhase` (P0/P7 research summaries,
  phase regeneration) per `runtime-integration.md:139-145`, keeping the deterministic artifact as the honest
  fallback whenever the provider is unconfigured/unavailable/timeout.

### GAP-L2 — Tavily research endpoint (server-only module + gated server function)
- **New module `src/lib/tavily.server.ts`** implementing the verified call shape (`runtime-integration.md:84-119`):
  `POST https://api.tavily.com/search`, key via trimmed `env("TAVILY_API_KEY")` (`.env.example:9-10`),
  `query.slice(0,500)`, `max_results` 3–5, `search_depth: "basic"` default, 20 s abort, typed union like ai.ts.
- **Honor the error map** (`runtime-integration.md:130-135`): 400/401/429 → typed `http` with detail; **432/433
  (plan / pay-as-you-go caps) must map to a "research backend credit exhausted" reason** the phase treats like
  not-configured so a run never strands and the deterministic artifact ships with an honest note
  (`runtime-integration.md:137,145`).
- **Per-project result cache** keyed `sha256(query|topic|depth)` (bounded server-side TTL, or a small table when a
  DB exists) so re-runs do not re-burn credits (`runtime-integration.md:137`).
- On success, append `sources: { title, url }[]` to the phase artifact and flip affected `Competitor.source` rows
  from `"illustrative"` to `"cited"` — the type already reserves `"cited"` (`src/lib/types.ts:58-65`,
  `runtime-integration.md:8,143`).

### GAP-L3 — Bounded local exec runner (server-only, honest labeling)
- **New module `src/lib/node-runner.ts`** per the verified reference implementation
  (`runtime-integration.md:185-199`): `spawn` with `timeout: 30_000` + SIGKILL, `maxBuffer` output caps
  (~1 MB/stream), `cwd` = fresh `mkdtemp` removed in `finally`, scrubbed `env` (strip secrets; set
  `HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY` empty + `NO_PROXY: "*"`), `detached: false`, `windowsHide: true`, and on
  Windows always follow a timeout with `taskkill /pid <pid> /T /F` — plain SIGKILL kills only the direct child and
  grandchildren survive (`runtime-integration.md:172,180`).
- **Label honestly**: bounded, not a security sandbox — mirror the `sandboxClaim()` phrasing (`sandbox.ts:93-96`);
  the required disclaimer text is in `runtime-integration.md:183`. Never expose exec over a public server route;
  dev/CLI and P10-style local-edge only, engine-authored code only.

### GAP-L4 — Key-holding contract (follow the `GROK_AUTH_*` pattern end-to-end)
1. **Local dev:** keys in the workspace `.env` (today's arrangement) — read only by `.server.ts` modules via the
   trimmed `env()` helper; never `VITE_*`; apply SH-09's exclusions so `.env` never rides a snapshot/handoff.
2. **Deploy:** the deployer injects `DEEPSEEK_API_KEY`, `TAVILY_API_KEY` as **server-only** env vars exactly like
   `GROK_AUTH_CLIENT_ID/SECRET`, `BETTER_AUTH_SECRET`, `DATABASE_URL` (`auth/server.ts:67-86`). Nothing may be
   inlined at build: Vite only inlines `VITE_*`, and `with-app-env.mjs:10-12,46-52` only forwards `VITE_` keys.
3. **Runtime guard:** each provider module exports a `configured` boolean and callers branch on it to stay in
   honest deterministic mode (the ai.ts philosophy) rather than emitting half-wired calls.
4. **Ops invariant:** when a key is present but the feature is off — or vice versa — log the explicit
   console.error style of `verify.server.ts:21-27`; misconfiguration must be loud, not silent.

---

## 4. Deploy/hosting checklist (Vercel/nitro surface, validated against current code)

**Verified good in the current tree:**
- Nitro Vercel preset is gated to build/preview only and keeps `serverDir: "./server"` (`vite.config.ts:170-180`);
  removing that option silently unwires `?install=1`, the manifest, and head injection on deploys
  (`deploy-target.md:38-40`).
- `.vercel/output` artifact is coherent: `config.json` = immutable CDN cache for `/assets/(.*)` + filesystem
  handle + `/(.*)` → `__server`; function config = Nodejs `nodejs22.x`, streaming enabled, `nf3` pinned
  (`package.json:7-8`).
- Deploy-side PWA/OG chrome ships the install template via `?raw` and bakes OG identity at build — Vercel
  functions have no `public/` FS (`server/middleware/grok-pwa.ts:6-17`, `snapshotOgIdentity` at
  `grok-pwa-shared.mjs:269-284`). This tree has `public/og.jpg` + `src/lib/og/site.json`
  (`{"title":"RapidTool","type":"website","card":"custom",…}`), so the share card bakes `card=custom`.
- `with-app-env.mjs` merges `.grok/app-env.json` before Vite starts (`:107-121`), with correct env precedence
  (`:64-66`) and a win32 shell fallback for bare `node_modules/.bin` shims (`:113-120`); dev/build parity of
  `VITE_AUTH_ENABLED` is enforced by `check-auth-invariant.mjs` via the dev-only `/__app-env` route
  (`app-env-plugin.mjs:12-33`).

**Operational requirements this tree encodes but does not enforce (each maps to a §1 bug):**
1. `DATABASE_URL` must be a **build-time** Vercel env for any DB/auth app (SH-03); runtime-only scoping ships a
   schema-less DB with a green build.
2. `migrations/auth/0001_auth.sql` must be copied to `migrations/` when auth turns on (SH-02) — nothing in code
   performs the copy.
3. Any DB/auth deploy must also carry `DATABASE_URL` at runtime — its absence silently selects per-isolate PGLite
   (SH-04).
4. Gate-auth deploys need `GROK_AUTH_*` + `BETTER_AUTH_SECRET` + `BETTER_AUTH_URL` + `VITE_AUTH_ENABLED=true`, and
   the builder-created `src/routes/api/auth/$.ts` mount (`data-and-auth.md:49-51`). The mount is **not shipped in
   this tree** (auth off — correct here); an auth-on fork that forgets it sends every `/api/auth/*` call —
   including the `/get-session` gate-materialization endpoint (`gate-session.server.ts:240-253`) — to the SPA/404.
   Recommend extending `check:auth` to probe that `/api/auth/get-session` answers JSON, not HTML, when the flag is on.
5. Env surface enumerated from code (`grep` of `env("…")`/`process.env.*` over `src/`, `scripts/`, `server/`):
   `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `GROK_AUTH_ISSUER`, `GROK_AUTH_CLIENT_ID`,
   `GROK_AUTH_CLIENT_SECRET`, `GROK_GATE_ORIGIN`, `GROK_PROJECT_ID`, `GROK_CONNECTORS_URL`,
   `GROK_CONNECTOR_ACCESS_TOKEN` (non-production only — `client.server.ts:68-71`), `VITE_AUTH_ENABLED`,
   `VITE_PUBLIC_HOSTNAME`, `VITE_PROJECT_ID`, `X_CREATOR`, `X_CREATOR_ID`, plus future `DEEPSEEK_API_KEY` /
   `TAVILY_API_KEY` (GAP-L4). `.env.example` already documents the last two with the correct "never `VITE_`" rule.

---

## 5. Severity roll-up

| ID | Sev | Area | One-line |
|---|---|---|---|
| SH-01 | P3 | auth/gate | in-process dedupe lock only; Neon multi-isolate double-fire can duplicate user+account rows (add unique index + conflict-relink) |
| SH-02 | P2 | auth/db | Better-Auth schema never auto-applied; flag flip without copy-up = schema-less auth on Neon and PGLite |
| SH-03 | P2 | db/deploy | Neon migrates only at build and only when `DATABASE_URL` is a build env; `db.ts:186-187` comment claims runtime auto-apply "on both backends" (false) |
| SH-04 | P2 | db/deploy | silent PGLite fallback in production serverless = per-isolate in-memory DBs; no `NODE_ENV` guard |
| SH-05 | P3 | auth/gate | gate issuer resolution silently null outside grok.me/app-builder-testing.com hosts (log + require `GROK_GATE_ORIGIN`) |
| SH-06 | P3 | auth/security | `/auth/popup` pages (incl. token completion page) have no CSP/XFO/referrer headers |
| SH-07 | P3 | app-data | `gatePost` connectors fetch has no timeout; a stalled gate hangs the server function |
| SH-08 | P3/P4 | auth | production `trustedOrigins` still includes loopback dev origins |
| SH-09 | P2 | secrets/ops | live keys in unprotected `.env`; no ignore file; workspace snapshots/handoffs would ship them |
| SH-10 | P3 | PWA | `isDocumentPath` dot-suffix regex strips platform chrome from dot-suffixed routes (audit/03-C, still open) |
| GAP-L1–L4 | — | LLM/research/exec | missing server-only DeepSeek proxy, Tavily endpoint, bounded node runner, and key-holding contract (§3) |

**Checked-and-cleared:** PWA host-header XSS (refuted, §2.1) · marker-cookie non-HttpOnly (§2.2) · baked preview
client secret (§2.3) · `Bearer`-line display redactions (§2.4) · Sec-Fetch residual (documented, §2.5) ·
EdDSA/JWKS gate chain (§2.6) · connector failure memo (§2.7) · OID/migration mechanics (§2.8) · ephemeral-PGLite
semantics, `.server` discipline, popup correlation, `__Host-` cookie set (§2.9).

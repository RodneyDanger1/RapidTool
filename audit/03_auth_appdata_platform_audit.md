# RapidTool Audit 03 — Auth, App-Data, and Platform/PWA/Scripting Layer

- **Scope:** `src/lib/auth/*`, `src/lib/app-data/*`, `src/lib/db.ts`, `migrations/auth/0001_auth.sql`, `server/middleware/grok-pwa.ts`, `server/virtual-grok-og-identity.d.ts`, `scripts/*` (non-test), `public/__grok/*`, `vite.config.ts`, `package.json`, `startup.sh`, `.grok/app-env.json`, `tsconfig.json`, `eslint.config.mjs`.
- **Method:** every non-test file in scope read in full; every finding below carries a `file:line` reference verified against the actual bytes. Not a git repo; app was **not** run; no file other than this report was modified.
- **Runtime context:** TanStack Start / React 19 / Tailwind v4 / PGlite / better-auth ~1.6.30 / Kysely 0.28 / Vite 8 / Nitro (Vercel preset). App runs as an autonomous software agency inside an xAI Grok "App Builder Workspace".
- **Legend:** P0 = critical, P1 = high, P2 = medium, P3 = low. "Seed finding N" markers show where a prior partial audit's finding was re-verified against the code.

---

## 0. Files covered (inventory, all read in full unless noted)

### src/lib/auth/ — 20 files, 19 non-test (no `types.ts`; the client entry is `client.ts`)

| File | Lines | Role |
|---|---|---|
| `client.ts` | 236 | Browser better-auth client: bearer-token attach, preview popup sign-in, sign-out |
| `email-password.ts` | 10 | Off-by-default email/password switch (flag only) |
| `gate-identity.server.ts` | 210 | Gate JWT verification: JWKS resolver/cache, endpoint resolution, user-info mapping |
| `gate-identity.test.ts` | 495 | SKIMMED — unit tests for the verifier (key resolution, audience/issuer, claims) |
| `gate-session.server.ts` | 339 | `/get-session` before-hook: gate materialization, cookie emission, marker upkeep |
| `gate-session-marker.ts` | 18 | Client-readable `__Host-grok_gate_session` marker cookie |
| `gates.tsx` | 132 | `SignedIn`/`SignedOut`/`SignInGate`/`SignInButtons`/`UserButton`/`RedirectToSignIn` |
| `isolation.server.ts` | 52 | Fetch-Metadata sibling isolation (`assertSameSiteRequest`) |
| `middleware.ts` | 47 | Dual client/server `authMiddleware` (bearer forward + userId resolution) |
| `pglite-dialect.ts` | 138 | Hand-rolled Kysely dialect over the shared PGLite singleton |
| `popup.server.ts` | 178 | `/auth/popup` handler: broker 302 + token postMessage completion page |
| `preview.ts` | 32 | Baked shared preview OAuth client id/secret + issuer + allowed hosts |
| `provider.tsx` | 15 | Passthrough `AuthProvider` seam |
| `providers.ts` | 31 | `GROK_PROVIDERS` (grok-google/grok-x) — dependency-free, client-safe |
| `server.ts` | 261 | The better-auth instance: tri-mode config, cookies, plugins, DB wiring |
| `sign-in-gate.ts` | 13 | Pure sign-in gate state machine |
| `sign-in-gate.test.ts` | 30 | SKIMMED — state-machine unit test |
| `use-current-user.ts` | 83 | `useCurrentUserState`/`useCurrentUser`, dev-user fallback |
| `verify.server.ts` | 97 | `requireUserId`/`getSessionUser`/`UnauthorizedError`, fail-closed logic |

### src/lib/app-data/ — 7 files

| File | Lines | Role |
|---|---|---|
| `client.server.ts` | 369 | `callTool` RPC to the connectors host; failure memo; gate host resolution |
| `errors.ts` | 56 | Error classification into UI kinds |
| `index.ts` | 14 | Client-safe barrel |
| `login.ts` | 29 | `isLoginRequired` + `redirectToLoginIfRequired` |
| `server-only.ts` | 11 | Module-load server-only assert |
| `types.ts` | 38 | Connector enum, tool constants, result/option shapes |
| `app-data.test.ts` | 393 | SKIMMED — callTool/memo/classification unit tests |

### src/lib, migrations, server — 4 files

| File | Lines | Role |
|---|---|---|
| `src/lib/db.ts` | 238 | Dual-driver SQL surface (Neon pg / PGLite), OID normalization, auto-migrate |
| `migrations/auth/0001_auth.sql` | 67 | Better Auth schema (user/session/account/verification + indexes) — opt-in |
| `server/middleware/grok-pwa.ts` | 111 | Deployed Nitro PWA middleware (manifest, install page, streaming head injection) |
| `server/virtual-grok-og-identity.d.ts` | 13 | Type shim for the baked OG virtual module |

### scripts/ — 22 non-test .mjs/.d.mts/.html files; see §4 for each role; tests skimmed

`grok-pwa-shared.mjs` (527) · `grok-pwa-plugin.mjs` (190) · `grok-pwa-shared.d.mts` (80) · `install-page.html` (lines incl. inline JS) · `app-env-plugin.mjs` (34) · `with-app-env.mjs` (130) · `check-auth-invariant.mjs` (109) · `sign-out-plan.mjs` (160) · `browser-guard.mjs` (47) · `browser-smoke.mjs` (177) · `browser-smoke-verdict.mjs` (128) · `brand-check.mjs` (227) · `preview.mjs` (343) · `preview-thumbnail.mjs` (42) · `write-atomic.mjs` (94) · `migrate.mjs` (90) · `migration-plan.mjs` (46) — plus their `.test.mjs` companions (skimmed; the pure-logic split exists so `node --test` can cover scripts).

### Config / static — 9 files

`vite.config.ts` (183) · `package.json` (97) · `startup.sh` (8) · `.grok/app-env.json` (6) · `tsconfig.json` (36) · `eslint.config.mjs` (47) · `public/__grok/icon-180.png` + `install/{styles.css,assets/homescreen/}` · `index.html` (root shell — no CSP headers observed). Excluded per brief: `package-lock.json`, `node_modules`, `AGENTS.md`, `.grok/references/*`, `attachments/*`.

## 1. Auth architecture deep dive

### 1.1 Tri-mode auth — how the same code is three products

The auth stack is one better-auth instance (`src/lib/auth/server.ts:175-253`) whose behavior is selected by environment at import time:

| Mode | Trigger | Identity source | Session store | Notes |
|---|---|---|---|---|
| **Deployed** | Deployer injects `GROK_AUTH_ISSUER/_CLIENT_ID/_CLIENT_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `DATABASE_URL`, `VITE_AUTH_ENABLED=true` | Broker federated OAuth (Google/X) via shared Grok auth broker | Neon Postgres (`pg` Pool, `server.ts:144-145`) | Cookie auth, full-page redirects, `__Host-` cookies |
| **Sandbox live preview** | No injection | Same broker, but with the **baked shared preview client** (`src/lib/auth/preview.ts:19-21`) | Embedded in-memory PGLite (`server.ts:146`) | iframe + partitioned cookies → bearer-token auth in `sessionStorage`; popup sign-in via `/auth/popup` |
| **Off (shipped default)** | `VITE_AUTH_ENABLED=false` in `.grok/app-env.json:2` | None — shared dev user | None | `requireUserId()` → `"dev-user"`, **unless** `DATABASE_URL` is set (then it fails closed) |

Key decision points:

- `src/lib/auth/server.ts:75` — `authDisabled = env("VITE_AUTH_ENABLED") === "false"`. The same predicate inverted drives the *client* (`client.ts:38`, `authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false"`) and the *gate identity* hook (`gate-identity.server.ts:33-35`). The three must never disagree — `scripts/check-auth-invariant.mjs` exists precisely to police the dev-server vs next-build split (see §4.4).
- `server.ts:80-82` — broker creds fall back from `GROK_AUTH_*` to `PREVIEW_CLIENT_ID/SECRET`. `authConfigured` (`server.ts:85-86`) is true only when a client id *and* secret resolve and auth is not disabled. When auth is "on" but no creds exist (a misconfig), the app is signed-out-only: `requireUserId` resolves nothing and throws 401 (`verify.server.ts:94-96`).
- `server.ts:51` — `void ensureDbReady()` kicks PGLite bootstrap as soon as the auth server module loads, sharing the same embedded DB as app data (§3).
- `server.ts:59-65` — the preview signing secret is pinned to `globalThis.__grokAuthPreviewSecret__` so an HMR module re-eval cannot invalidate PGLite session rows mid-dev. Process restart wipes secret + PGLite together. In deployed mode `BETTER_AUTH_SECRET` is injected.

### 1.2 Fail-closed dev-user logic

`src/lib/auth/verify.server.ts` is the single server-side authority for "who is the caller":

- `verify.server.ts:16` — `databaseConfigured = Boolean(process.env.DATABASE_URL?.trim())`; empty/whitespace counts as unset (same convention as `db.ts:8-11`).
- `verify.server.ts:21-27` — if `DATABASE_URL` is set while auth is disabled, a loud console error explains the fail-closed contract at startup.
- `verify.server.ts:84-97` — `requireUserId()`: auth off + no DB → `DEV_USER_ID` (`"dev-user"`, `verify.server.ts:30`); auth off + **DB set** → throws a plain `Error` (not `UnauthorizedError`), refusing to share one dev user across visitors on a real database. Auth on → resolves the session or throws `UnauthorizedError` (`verify.server.ts:37-43`, `status: 401`, message `"Unauthorized"` is a documented client contract).
- `verify.server.ts:57-71` — `getSessionUser(bearerToken?)` resolves via `auth.api.getSession` on the request headers, optionally stamping an `Authorization` header with the preview bearer token (`verify.server.ts:64-67`). Only the result of this verification is ever trusted; the header comment at `verify.server.ts:11-13` makes "never trust a client-supplied user id" an explicit invariant.
- `server.ts:241-247` — the `bearer()` plugin is installed unconditionally; its hook only fires when an `Authorization` header is present, so the deployed cookie path is untouched.

Seed finding 1 (**confirmed**): the fail-closed path is exactly as described — `VITE_AUTH_ENABLED=false` + `DATABASE_URL` set makes `requireUserId` throw for every request (`verify.server.ts:86-91`), while auth-off + no DB yields the shared `dev-user`.

### 1.3 The gate chain (deployed edge → app)

The platform's gate edge injects two request headers that this layer consumes:

1. **`x-grok-identity`** — a short-lived EdDSA JWT vouching for the human behind the request.
2. **`x-connector-access-token`** — the connector credential (see §2).

`src/lib/auth/gate-identity.server.ts` is the verifier:

- `gate-identity.server.ts:33-35` — `gateIdentityEnabled()` = `VITE_AUTH_ENABLED !== "false"`; the gate hook is inert in the shipped default.
- `gate-identity.server.ts:37-40` — audience is `app:<GROK_PROJECT_ID>` when deployed, `preview` otherwise. Exact-audience match is enforced at `gate-identity.server.ts:110`.
- `gate-identity.server.ts:129-162` — `resolveGateEndpoints(headers)`: explicit `GROK_GATE_ORIGIN` env wins; otherwise, with no `GROK_PROJECT_ID` the preview gate is `http://127.0.0.1:6014` (local gate tooling; plain HTTP, sandbox-only); with a project id the issuer is derived from the request host — `x-forwarded-host` preferred over `host` (`:143-144`), mapped to `gate.app-builder-testing.com` for `*.app-builder-testing.com` (`:151-155`) or `gate.grok.me` for `*.grok.me` (`:156-158`). Unrecognized hosts → `null` → no gate identity.
- `gate-identity.server.ts:102-125` — `verifyGateIdentityToken` pins `algorithms: ["EdDSA"]`, issuer, audience, `requiredClaims: ["sub","iat","exp"]` and `maxTokenAge: "10 minutes"` (`:108-112`). Any failure returns `null` (fail closed). Claims are individually type-checked (`:114-121`).
- `gate-identity.server.ts:56-94` — JWKS resolution with a **300 s cache** (`:11`), Ed25519/OKP key selection (`:65-69`), and a **kid-miss refetch** path (`:80-88`) so key rotation heals within one request instead of failing until TTL expiry. No key → throws (`:89-91`), which surfaces as a failed verification.
- `gate-identity.server.ts:166-176` — `sessionBoundToGateIdentity` matches local `account` rows (`providerId === "grok-gate"` and `accountId === identity.sub`) against the verified identity.
- `gate-identity.server.ts:201-209` — synthesized user info: real email when present, else `sub@viewer.grok.invalid`; `emailVerified` = whether the token carried an email (broker X identities are synthetic/unverified, hence `server.ts:203` `requireLocalEmailVerified: false`).

Seed finding 2 (gate-identity half, **confirmed**): the 300 s cache (`gate-identity.server.ts:11,72`), kid-rotation refetch (`:80-88`), and EdDSA-only pinning (`:108`) all match the seed.

### 1.4 Gate session materialization — `gate-session.server.ts`

`gateIdentitySessions()` (`gate-session.server.ts:208-338`) is a better-auth plugin whose single `before` hook matches `path === "/get-session"` (`:214`). Flow per request:

1. Inert when gate disabled (`:216`); skips requests already carrying `authorization` (bearer preview sessions, `:223`).
2. No `x-grok-identity` header → clear the stale client marker if present (`:224-227` → `clearGateMarkerIfPresent` `:184-191`) and return: an anonymous viewer (or a broker session) must not keep sign-out hidden.
3. Header present but verification failed → error log, return (`:229-235`). The browser then gets the regular session answer — fail closed, no fallback identity.
4. Session cookie already present → load the session (`:239-243`) and its `account` rows (`:245-250`). If the session is already bound to this gate identity (`:258-267`) → refresh the marker, done. If bound to a *different* identity → delete the stale session row (`:268-277`) and materialize anew (identity swap).
5. Materialize: `handleOAuthUserInfo` (`:280-296`, better-auth's standard OAuth-account-link machinery) → `setSessionCookie` (`:299`) → **explicitly sign and emit the session cookie** via `emitSessionCookie` (`:304-315`), because better-auth's internal response-header bag is unreliable on TanStack Start (documented at `:24-32` and `:301-303` — previously caused a silent signed-out render).
6. Write the gate marker (`:317`), expire the previous user's cached `session_data` cookie (`:319-320`, see below), and re-inject the session cookie into the request headers so the rest of `/get-session` resolves the new session in the same round-trip (`:322-329`).

Notable sub-mechanics:

- **`emitSessionCookie`** (`:33-97`) delivers through two paths: TanStack Start's `setCookie` + response cookie store (`:69-78`), and appending to better-auth's `responseHeaders` bag for after-hooks such as `tanstackStartCookies()` (`:85-94`). Both failures are logged, and a missing final cookie is a logged error, not a silent success (`:309-315`).
- **`expireSessionDataCookie`** (`:106-136`) exists because `session.cookieCache` (5-minute TTL, `server.ts:211`) is signed against the *old* session: after an identity swap, `/get-session` would otherwise keep answering from the stale cookie cache. This is the **documented identity-swap race** and the mitigation is real — see §5 bug F.
- **Marker cookie** `__Host-grok_gate_session` (`gate-session-marker.ts:11`) is **deliberately non-HttpOnly** (`gate-session.server.ts:159`, and the hand-written append at `:170` also omits HttpOnly). The client reads it via `hasGateSessionMarker()` (`gate-session-marker.ts:13-18`) so `UserButton` can hide sign-out for gate sessions (`gates.tsx:95-99,116`) — signing out of a gate session is a no-op because the next request re-materializes it. `__Host-` prefix + no `Domain` is the anti-toss protection (comment at `gate-session-marker.ts:6-9`; browsers reject a `__Host-` cookie that carries a `Domain`, so a sibling `*.grok.me` app cannot plant a parent-domain copy that the host-only clear could never expire).
- `removeRequestCookie` (`:194-206`) drops the stale `session_data` cookie from the outbound request's `Cookie` header (inverse of `setRequestCookie`).

Seed finding 2 (gate-session half, **confirmed**): marker cookie `__Host-grok_gate_session` is non-HttpOnly by design (`gate-session.server.ts:159-160,170`), materialization runs through `handleOAuthUserInfo`, and `preview.ts` vs `gateIdentitySessions` are two separate auth paths that coexist (bearer skips the gate hook at `:223`).

### 1.5 Dynamic baseURL, trusted origins, and the OAuth-to-broker plumbing

- `server.ts:94-114` — deployed apps get an explicit `BETTER_AUTH_URL`; preview/local gets a dynamic baseURL whose `allowedHosts` are the preview wildcard plus loopback hosts (`localhost`, `127.0.0.1`, `[::1]`), `protocol: "auto"`, `fallback: http://localhost:8080`. Better Auth derives each request's origin from the (proxied) host so the OAuth `redirect_uri` is the concrete `https://<preview-host>/api/auth/oauth2/callback/...` the broker's preview client accepts (`preview.ts:26-31`).
- `server.ts:116-126` — `trustedOrigins` covers preview wildcards in host and full-origin form plus the three loopback dev origins. Missing entries here are the classic "Invalid origin" 403 on credentialed POSTs.
- `server.ts:130-137` — broker OAuth endpoints are **static** (authorize/token/userinfo paths matching the broker's discovery document), deliberately skipping OIDC discovery so the preview popup doesn't stall on an extra network hop.
- `server.ts:153-173` — one `genericOAuth` provider per upstream in `GROK_PROVIDERS` (`providers.ts:28-31`: `grok-google`→`google`, `grok-x`→`twitter`), all sharing this app's client id/secret and differing only by the `idp` hint (`authorizationUrlParams: { idp, prompt: "login" }`, `:170`). `prompt: "login"` forces broker re-authentication so the user always gets the account chooser. The broker holds the real Google/X secrets; the app never sees them.
- `server.ts:193-205` — `account.encryptOAuthTokens: true`; account linking trusts only the broker providers + `grok-gate`, with `requireLocalEmailVerified: false` because X emails are synthetic. Google and X carry distinct emails, so they never merge into one user.
- `server.ts:223-232` — cookie hardening: `__Host-` names (`SESSION_TOKEN_COOKIE = "__Host-grok-auth.session_token"`, `:149`), `useSecureCookies: false` so better-auth doesn't emit its own `__Secure-` prefix (which permits `Domain`), and explicit `defaultCookieAttributes: { secure: true, sameSite: "lax", path: "/" }`. Browsers accept Secure cookies on `http://localhost`, so local dev survives.
- `server.ts:234-252` — plugin order: `gateIdentitySessions()` → `genericOAuth` → `bearer()` → `tanstackStartCookies()` **last** ("MUST be last so it runs after every other plugin's hooks", `:249-251`).
- `server.ts:255-257` — `readSessionToken()` helper reads the session cookie via TanStack's `getCookie`.

### 1.6 Session verification chain (server functions)

`src/lib/auth/middleware.ts` defines `authMiddleware`, the standard wrapper for server functions:

- **Client half** (`middleware.ts:29-35`): dynamically imports `./client` and forwards `getBearerToken()` as `sendContext.bearerToken`. Null when deployed (cookie auth) → no-op there.
- **Server half** (`middleware.ts:36-47`): dynamically imports only `*.server` modules (comment at `:37-40` explains the `.server` suffix is load-bearing — shipping `@tanstack/react-start/server` to the browser dies with `AsyncLocalStorage is not a constructor`), then `assertSameSiteRequest()` (`:44`) then `requireUserId(context.bearerToken)` (`:45`), exposing `context.userId` to the handler.

**Fetch-Metadata sibling isolation** — `src/lib/auth/isolation.server.ts:34-52`:

- Allowed: no `Sec-Fetch-Site` header (non-browser / SSR — comment `:17-18`), `same-origin`, `none` (address-bar load), and top-level GET navigations (`sec-fetch-mode: navigate` + GET + dest not object/embed — this is how the broker's OAuth callback arrives, `:44-50`).
- Rejected (403 `CrossSiteRequestError`, `:25-31`): anything cross-site *or same-site* that is scripted — i.e. a sibling `*.grok.me` app POSTing to this app's server functions while the victim's `SameSite=Lax` cookie rides along. The threat model is documented at `isolation.server.ts:10-23`: same-site apps are mutually untrusted.

Seed finding 2 (flow shape, **confirmed**): gate → materialized better-auth session → `authMiddleware` resolves `context.userId`; marker cookie is read client-side only.

### 1.7 Client: sign-in, popup, bearer, sign-out

`src/lib/auth/client.ts` is the browser entry (there is **no** `types.ts` in `src/lib/auth/` — verified against the directory listing; the client entry is `client.ts`. Seed finding 3 first half: **confirmed**).

- `client.ts:20-29` — `createAuthClient` with `genericOAuthClient()`; `onRequest` attaches the stored preview bearer token. Comment at `:16-19` warns to use the local `signOut()`, never raw `authClient.signOut()`, or the token keeps re-attaching and the visitor stays signed in.
- `client.ts:38` — `authEnabled` is a build-time constant (`import.meta.env.VITE_AUTH_ENABLED !== "false"`).
- `client.ts:48-68` — bearer token lives in `sessionStorage` under `grok-auth.bearer-token`; empty everywhere except the live preview after a popup sign-in, so the cookie path is untouched. Reads/writes are try/catch-guarded (storage may be unavailable in the sandbox iframe).
- `client.ts:75-80` — `inLivePreview()` = hostname ends with `.grok-sandbox.com`.
- `client.ts:99-153` — `signIn(providerId)`: opens the popup **synchronously** on the user gesture (`:109`, before any await — awaiting first drops user-gesture privilege from a cross-origin iframe opener), clears any prior session via `runPreSignInSignOut` (`:116-121`, bounded per environment — see §4.5), then either awaits `waitForPopupToken` (preview) or performs a full-page broker redirect via `authClient.signIn.oauth2` (`:146-152`).
- `client.ts:164-170` — `openSignInPopup` opens the real URL `${origin}/auth/popup?providerId=…` with a **unique window name per attempt** (`grok-signin-${Date.now()}`) so a prior attempt stuck on the SPA is never reused; `popup,width=500,height=650`.
- `client.ts:176-207` — `waitForPopupToken` validates `event.origin === origin` and `data.source === "grok-auth-popup"` before settling (`:187-192`); polls `popup.closed` with a 400 ms grace period so the completion page's postMessage wins over a racing close (`:193-199`). See §5 bug F for the multi-waiter race.
- `client.ts:221-236` — `signOut(redirectTo)` delegates to `runSignOut` (§4.5): deployed → rejects unless the server confirmed; preview → local clear is sufficient and always resolves.
- The popup endpoint itself is `src/lib/auth/popup.server.ts` (server-only), wired by the Vite `authPopupPlugin` (`vite.config.ts:64-143`) — **not** a React route. Phase 1 (`?providerId=`) 302s straight to the broker (`popup.server.ts:65-104`), forwarding the broker's `Set-Cookie` (OAuth state/PKCE) so the callback completes first-party in the popup (`:98-104`). Phase 2 (`?done=1`) serves a tiny no-store HTML page that postMessages the session token (read from the cookie, `:38`) to the opener and closes (`:36-52`, `:126-158`). The JSON payload is embedded in `<script type="application/json">` with `<` escaped (`:129`) — the comment at `:127-128` explains this avoids JS-source escaping pitfalls. The opener checks the message origin on receipt (client.ts:188). A `cache-control: no-store` guards the token-bearing page (`:49,120`).

Seed finding 3 second half (**confirmed**): earlier display of a mangled `Bearer ${token}` in this layer was a display-artifact; raw bytes contain the literal `Bearer` (byte-level check: `'Bearer' in source == True`) and the authorization header is intact in `client.ts:25`, `verify.server.ts:66` and `app-data/client.server.ts:116` (that last one renders as `authorization: Bearer ${token}` — see §2.2).

### 1.8 UI gates, hooks, provider

- `src/lib/auth/gates.tsx` — `SignedIn`/`SignedOut` (`:25-38`) render only on *resolved* state to avoid a signed-out flash; `RedirectToSignIn` uses TanStack `<Navigate>` (not a hard reload, which re-bootstraps the SPA and doubles the loading feel — comment `:40-47`); `SignInGate` (`:52-64`) wraps children/fallback; `SignInButtons` (`:66-81`) renders one button per `GROK_PROVIDERS` entry with `callbackURL: "/"`; `UserButton` (`:90-132`) shows the avatar chip and a sign-out button only when `authEnabled && !gateSession` (`:116`), with a busy state that survives failure (`:119-124`). `SIGN_IN_PATH = "/login"` (`:22`) is the route the app must create.
- `src/lib/auth/sign-in-gate.ts` — pure `resolveSignInGateState` state machine (pending/signed_in/signed_out), kept pure for unit testing.
- `src/lib/auth/use-current-user.ts` — `useCurrentUserState()` returns `DEV_USER` immediately when auth is off (`:58`, module-level `authEnabled` keeps hook order stable across renders — `eslint-disable` at `:59` documents this); otherwise better-auth `useSession()`. `AppUser` shape at `:4-11`; `DEV_USER.id === "dev-user"` matches the server's `DEV_USER_ID` (`verify.server.ts:30`) so per-user rows written in dev belong to one consistent owner (`use-current-user.ts:13-26`).
- `src/lib/auth/provider.tsx` — `AuthProvider` is a **passthrough** today (better-auth React needs no context provider); kept as the stable mount point for future providers (see §6).
- `src/lib/auth/email-password.ts` — `emailAndPasswordEnabled = false` (`:10`); wiring in `server.ts:214` spreads the config only when flipped. Off by default, by design; `server.ts:4-9` forbids editing `server.ts` to enable it.

### 1.9 CSRF / XSS / trust-boundary posture (summary)

- **CSRF:** same-site sibling POSTs are blocked by `assertSameSiteRequest` at the `authMiddleware` chokepoint (`middleware.ts:44`), backed by `__Host-` cookies (`server.ts:223-232`) and better-auth `trustedOrigins` (`server.ts:116-126`). Residual gap: the check trusts `Sec-Fetch-*` headers, which non-browser clients and very old browsers omit — those pass as "non-browser" (`isolation.server.ts:38-41`). Since cookies only ride on genuine browser requests, and every modern browser sends `Sec-Fetch-Site`, this is defense-in-depth with a documented residual (see §5 bug D).
- **XSS:** no CSP headers were observed on the app shell; the client relies on React escaping. The platform injects `https://grok.com/grok-app-builder/extensions.js` into every HTML document (`grok-pwa-shared.mjs:203,237-242`) — a platform-controlled script executes in every app origin with full cookie access; this is by design but is the single largest supply-chain trust point (see §7.6).
- **Bearer token in sessionStorage** (`client.ts:48-68`) is XSS-readable by design (it must be, for JS to attach it); the deployed cookie path never uses it.
- **Bypass attempts reviewed:** direct `x-grok-identity` forging fails at signature/issuer/audience/age checks (`gate-identity.server.ts:107-113`); replay of a captured token fails the 10-minute `maxTokenAge`; a sibling app planting cookies fails the `__Host-` no-Domain rule; header spoofing of `x-forwarded-host` only relocates which *issuer/JWKS URL* is consulted, and the signature still must verify against that issuer's published key — an attacker who controls the header but not a matching private key gains nothing (see §7.5 for the one nuance).

---

### 1.10 End-to-end request flows (as the code composes them)

**Deployed, cookie auth (a signed-in visitor calls a server function):**
browser (grok.me app) → POST to a `createServerFn` → TanStack middleware chain → `authMiddleware.client` (no bearer; no-op) → `authMiddleware.server` → `assertSameSiteRequest` (Sec-Fetch-Site: same-origin passes) → `requireUserId` → `auth.api.getSession` on request headers with the `__Host-grok-auth.session_token` cookie → session row (or the 5-min signed `session_data` cookie cache, `server.ts:211`) → `context.userId` → handler queries scoped by `userId`.

**Deployed, first sign-in:** click "Continue with Google" → `signIn` (`client.ts:99-153`) → `runPreSignInSignOut` (best-effort; full 10 s window) → `authClient.signIn.oauth2` → full-page redirect to broker authorize (`authorizationUrlParams: { idp: google, prompt: "login" }`) → broker round-trip to Google → callback lands on `/api/auth/oauth2/callback/grok-google` (top-level GET — passes isolation via the navigate exception, `isolation.server.ts:44-50`) → better-auth exchanges code at the static broker token URL → `handleOAuthUserInfo` links/creates the local user → session cookie set (TanStack cookies bridge) → redirect back to the app.

**Sandbox live preview, popup sign-in:** iframe on `*.grok-sandbox.com`; cookies partitioned → click handler synchronously opens `/auth/popup?providerId=…` (`client.ts:164-170`, `vite.config.ts:64-143`) → server-side `signInWithOAuth2` 302s the popup to the broker, forwarding Set-Cookie (`popup.server.ts:98-104`) → broker redirects back to the popup's `?done=1` URL (first-party in the popup, so the session cookie sticks there) → completion page reads the cookie server-side and postMessages the token to the opener (`popup.server.ts:36-52,126-158`) → opener origin-checks, stores the token in `sessionStorage`, refreshes the client session (`client.ts:123-143`) → every later server-function call forwards the token via `authMiddleware.client` → server `bearer()` plugin resolves the session from the token instead of a cookie.

**Gate viewer (deployed, zero-click "Sign in with Grok"):** edge injects `x-grok-identity` (EdDSA JWT, ≤10 min) → the SPA's `/get-session` request carries it → `gateIdentitySessions` before-hook verifies against the gate JWKS (300 s cache, kid-refetch) → no session cookie yet → `handleOAuthUserInfo` materializes user + session rows → signed cookie emitted via the dual path → gate marker cookie set → `session_data` cache of any prior identity expired → request headers rewritten so the same round-trip resolves the new session → SPA renders signed in; `UserButton` hides sign-out because the marker says the next request will just re-materialize (`gates.tsx:95-99,116`).

**Sign-out:** `signOut()` (`client.ts:221-236`) → `runSignOut` (§4.5): deployed → `authClient.signOut()` awaited; only a confirmed server response clears the HttpOnly cookie, so a timeout/failure throws "you are still signed in" (`sign-out-plan.mjs:113-122`); preview → server call is best-effort (1.5 s bound), then the `sessionStorage` token is dropped and the page redirects — dropping the token IS signing out in a partitioned iframe (`sign-out-plan.mjs:102-111`). Gate sessions skip the UI entirely (no button), because sign-out would be undone by the next gate request.

**Auth-disabled dev mode:** `VITE_AUTH_ENABLED=false` → client renders `DEV_USER` (`use-current-user.ts:58`), `requireUserId` returns `"dev-user"` when no `DATABASE_URL` is set (`verify.server.ts:85-93`) — the gate hook and all OAuth plugins are inert, and with a real DB configured the same call throws (fail closed).

## 2. App-data layer

### 2.1 Surface

`src/lib/app-data/types.ts` declares the connector universe: **7 connector types** (`types.ts:3-11`: GoogleDrive, Gmail, GoogleCalendar, Outlook, OutlookCalendar, MicrosoftTeams, Mcp), the access-token request header name `x-connector-access-token` (`types.ts:1`), Google Drive tool-name constants (`types.ts:16-22`), and the shared result/options shapes (`types.ts:24-36`). Seed finding 4 (connector list, **confirmed**).

The barrel `index.ts` re-exports types + client-safe helpers (`isLoginRequired`, `redirectToLoginIfRequired`, `classifyCallToolError`); `server-only.ts` throws if any server module is imported in a browser context (`server-only.ts:1-11`) — `client.server.ts:16` and `:11` both assert this at module load.

### 2.2 `client.server.ts` — the callTool RPC

The single outbound RPC is `callTool(toolName, args, options)` (`client.server.ts:267-356`), server-only, POSTing to the platform connectors host:

- **Host resolution** (`client.server.ts:36-52`): explicit `GROK_CONNECTORS_URL` env wins; otherwise derived from the inbound public host — `connectors.app-builder-testing.com` for staging (`:18,42-47`), `connectors.grok.me` for prod (`:19,48-50`); loopback or unknown hosts → `null`.
- **Token acquisition** (`client.server.ts:62-77`): inbound `x-connector-access-token` header first; else `GROK_CONNECTOR_ACCESS_TOKEN` env — **but only when `NODE_ENV !== "production"`** (`:68-71`), a deliberate guard so a stray env var can never leak into prod behavior. Per-request override via `options.token` (`:276`).
- **Gate host guard** (`:94-111`): refuses to fetch without a resolved base and refuses relative or non-http(s) bases (`:107-111`).
- **Request shape** (`:113-127`): JSON POST to `${base}/call-tool` with an `authorization` header set to a Bearer token built from the connector access token (`:116`), `x-forwarded-host` forwarded (`:118-120`), and **`redirect: "manual"`** (`:126`) so a 3xx from the gate is surfaced as a status, never silently followed (redirect-following could leak the bearer to a bounce host).
- **Response parsing** (`:129-140`): non-JSON bodies are folded into a structured error carrying the first 200 chars.
- **Gate sign-in URL** (`:145-164`): `connectors.<env>` → `gate.<env>` host swap, with `return_to=<public app URL>` when a public host is known.
- **401 handling** (`:326-339`): returns `loginRequired: true` + loginUrl, and is **never memoized** — the visitor may have completed sign-in in the meantime, so the next call must retry the gate. 403s and error bodies **are** memoized.
- **Failure memoization** (`:191-245`): 5-second TTL (`:191`), lazily swept on insert (`:236-238`), keyed by `[toolName, args, connectorType, connectorCatalogId, tokenIdentityKey(token)]` (`:292-298`). `tokenIdentityKey` hashes the JWT's `sub`+`team_id` claims when parseable, else the raw token (`:194-217`) — so rotating tokens for the same identity share a memo slot (see §5 bug B). Only **failures** are memoized; successes never are.
- **Call-shape guards** (`:272-273`): `crossSiteBlockedResult()` runs `assertSameSiteRequest()` first (`:179-189`) — the same Fetch-Metadata sibling isolation as auth middleware — then `nonPostBlockedResult()` refuses any inbound method that is not POST (`:255-265`): connector calls must live inside `createServerFn({ method: "POST" })` handlers. Both are checked before any token is spent.
- **Mcp requires a catalog id** (`:305-311`); missing `connectorType` is a structured error (`:282-290`); catch-all network failures become memoized errors (`:353-355`).

Seed finding 4 (**confirmed** with two refinements): the 401 login-required path is never memoized (`client.server.ts:326-339` returns directly, bypassing `fail()`), and the dev fallback token is additionally gated on `NODE_ENV !== "production"` (`:68-71`).

### 2.3 Login redirection & error classification (client-safe)

- `src/lib/app-data/login.ts:3-5` — `isLoginRequired` = `!ok && loginRequired === true`.
- `login.ts:15-29` — `redirectToLoginIfRequired`: framed context → `window.open(url, "_blank")` and, if a window came back, neuter `opener` and return; **if `window.open` returns null (popup blocked) it falls through to `window.location.assign(url)` inside the iframe** (`:27`) and still returns `true`. See §5 bug A.
- `src/lib/app-data/errors.ts:17-56` — `classifyCallToolError` maps raw gate messages to UI kinds: `login`, `not_connected` (matches `not_connected` / `failed_precondition`), `scope_denied`, `access_denied`, else generic `error` — each with a copywriter-grade user message. `login` kind takes precedence (`:23-28`).

### 2.4 Invariants of the layer

1. Server-only by construction: `server-only.ts` double-asserts; the browser never sees `client.server.ts` code.
2. Cross-site scripted calls are blocked before any credential use (`client.server.ts:272`).
3. Connector calls only run inside POST server functions (`:255-265`).
4. `redirect: manual` — the gate's 401/403 shape is what drives `loginRequired`, never a follow.
5. Failures are bounded in memory (5 s TTL, keyed, swept) so a wedged gate cannot be hammered per request.
6. The app never stores connector tokens; they arrive per-request from the edge (`inboundContext`, `:62-77`).

---

### 2.5 End-to-end connector call trace (as the code composes it)

A client component wants Drive files: it calls a `createServerFn({ method: "POST" })` wrapper → the wrapper dynamically imports `@/lib/app-data/client.server` (never statically — keeps pg/Node modules out of client bundles; `server-only.ts` throws if the browser ever gets it) → calls `callTool("google_drive_list_folder", {...}, { connectorType: ConnectorType.GoogleDrive })` →

1. `crossSiteBlockedResult()` (`client.server.ts:179-189`): sibling/cross-site scripted requests end here with a 403-shaped result — before any token is read.
2. `nonPostBlockedResult()` (`:255-265`): a GET/other inbound method is refused; connector work must run in POST handlers (matches `authMiddleware` culture: mutations through POST server functions).
3. `inboundContext()` (`:62-77`): token = `x-connector-access-token` header (edge-injected when the app is opened through the gate) → else non-prod `GROK_CONNECTOR_ACCESS_TOKEN`; publicHost from `x-forwarded-host`→`host`; connectorsBase from env override or host mapping.
4. Missing token → `missingAuthResult` with a `loginUrl` pointing at `gate.<env>/__gate/signin?return_to=<app>` (`:145-177`) — the UI then calls `redirectToLoginIfRequired` and pops the gate sign-in.
5. Token present → memo key built (`:292-302`); a live memoized failure (≤5 s) short-circuits the network.
6. `gatePost` (`:94-143`): POST `${base}/call-tool` with the bearer authorization header, `x-forwarded-host`, JSON body `{ host, connector_type, tool_name, arguments, connector_catalog_id }`, `redirect: "manual"`.
7. Response triage (`:326-355`): 401 → `loginRequired` (never memoized — the visitor may have completed sign-in by now); 403 → memoized `access_denied`; error body/HTTP ≥ 400/`ok:false` → memoized failure; else `{ ok: true, data }`.
8. The wrapper returns a `CallToolResult`; the component classifies it via `classifyCallToolError` (`errors.ts:17-56`) for the right message, or auto-redirects on `loginRequired`.

Failures return structured `CallToolResult`s everywhere — the layer never throws across the server-function boundary except for configuration errors (unresolvable gate host at `:100-105`).

## 3. DB & migrations full walkdown

### 3.1 `src/lib/db.ts` — dual-driver shared SQL surface

- **Backend selection** (`db.ts:8-19`): `DATABASE_URL` set (after trim) → `dbSource = "neon"`; else in-memory PGLite. An empty/whitespace URL explicitly means "unset" so a misconfigured deploy can never silently run on PGLite (`:6-11`).
- **Shared `Sql` interface** (`:29-38`): tagged template + `.query()` forms, both returning row arrays.
- **Result-type parity** (`:53-68`): pg and PGLite disagree on int8 (pg → string, PGLite → BigInt, which `JSON.stringify` rejects) and date (pg → local-midnight Date, PGLite → UTC Date). Both drivers register parsers: `int8`→Number (past 2^53 loses precision — documented; `::text` escape hatch), `date`→`YYYY-MM-DD` string, `interval`→text. Numeric already arrives as string on both. This makes preview and production return identical JSON-safe shapes — a real correctness trap the template engineered away.
- **Neon path** (`:88-106`): lazy `pg` import (never loads on the PGLite path), `types.setTypeParser` for the three OIDs (`:93-95`), one Pool per process (`:96`); failed init clears its global slot so the next call retries (`:101-104`).
- **PGLite path** (`:108-168`): one instance per process on `globalThis.__pgliteInstance__` (survives HMR module re-evals; resets on server restart — dev data is ephemeral by design), parser config in the PGlite constructor (`:114-120`), a `_migrations` table created up front (`:122-124`).
- **Auto-migration** (`:139-157`): `import.meta.glob("/migrations/*.sql", { query: "?raw", eager: true })` — **non-recursive**, so `migrations/auth/` stays out (see §3.4). Pending files (via `pendingMigrations`, shared with the deploy migrator) apply **each inside a PGlite transaction, atomically with its `_migrations` record** (`:152-155`), mirroring `migrate.mjs`. Passes are serialized on a global promise chain (`:158-162`) so concurrent callers never double-apply; a failed pass clears the chain slot.
- **Memoization** (`:170-195`): `getSql()` memoizes success only; failures retry on next call.
- **Browser guard** (`:172-178`): calling `getSql()` client-side throws with an explanatory message.
- **`getPglite()`** (`:202-210`): the shared instance *with migrations applied*, for better-auth's Kysely dialect; throws on the Neon path. **`ensureDbReady()`** (`:222-225`) is a no-op on Neon (lazy pool) and eagerly bootstraps PGLite; the module self-kicks at load in Node (`:229-238`), and `vite.config.ts:33-52` additionally awaits it during dev-server setup **only when the app has root-level migrations** (`:38`) so an app with no schema doesn't pay for a PGLite instance it never queries.

### 3.2 Better Auth's database wiring

`server.ts:139-146`: `DATABASE_URL` → `new Pool({ connectionString })` (Neon); else `{ dialect: pgliteDialect(() => getPglite()), type: "postgres" }` — better-auth persists into the **same embedded DB as app data** in preview, including email/password users if ever enabled. `src/lib/auth/pglite-dialect.ts` is a hand-rolled Kysely dialect:

- Lazy client resolution on first connection (`pglite-dialect.ts:24-45`), so migrations finish before auth queries run.
- **Single-connection serialization**: `acquireConnection` queues waiters while a connection is held (`:47-58`) and `releaseConnection` hands it to the next waiter (`:60-70`) — PGLite is inherently single-connection, and the queue preserves better-auth's transaction expectations.
- Transactions via raw `begin` / `commit` / `rollback` (`:72-96`), honoring isolation level.
- `destroy()` deliberately does **not** close the shared PGlite (`:98-105`) — auth teardown must not poison app SQL.
- Query/stream execution (`:108-137`) maps `affectedRows` to `BigInt` and returns `rows` arrays. Note the whole dialect serializes through one connection, so auth + app SQL share PGLite safely but with no intra-process concurrency on that DB (fine for an in-memory preview).

### 3.3 `migrations/auth/0001_auth.sql` — table-by-table

Header (lines 1-17) documents: generated by the Better Auth CLI for its Postgres adapter; **camelCase columns must stay double-quoted**; `_migrations` records applied files by name; app schema belongs in new ordered files `0002_*…`; per-user tables should use `user_id TEXT NOT NULL` (TEXT, not UUID — the preview dev user id is the string `'dev-user'`).

| Table | Lines | Columns / notes |
|---|---|---|
| `"user"` | 19-27 | `id` PK; `name`, `email` (unique), `emailVerified` NOT NULL; `image` nullable; `createdAt`/`updatedAt` defaults `CURRENT_TIMESTAMP` (updatedAt is NOT NULL but has no trigger — better-auth sets it in code). |
| `"session"` | 29-38 | `id` PK; `expiresAt`; `token` **unique**; `ipAddress`/`userAgent` nullable; `userId` FK → `user(id)` **on delete cascade**. |
| `"account"` | 40-54 | `id` PK; `accountId`; `providerId`; `userId` FK cascade; OAuth token columns (`accessToken`, `refreshToken`, `idToken`, both expiry timestamps, `scope`); `password` (email/password); timestamps. No unique constraint on (`providerId`, `accountId`) or (`userId`, `providerId`) — better-auth's stock schema; identity dedupe is enforced in application code (`handleOAuthUserInfo` lookup path), see §5 bug G note. |
| `"verification"` | 56-63 | `id` PK; `identifier`, `value`, `expiresAt` — better-auth's generic challenge store (email verification, password reset). |
| Indexes | 65-67 | `session_userId_idx`, `account_userId_idx`, `verification_identifier_idx`. |

### 3.4 Migration mechanics

- **`scripts/migration-plan.mjs`** — shared bookkeeping: `migrationName` = basename (`:20-22`); `isMigrationFile` (`:28-30`); `pendingMigrations(paths, applied)` sorts by `localeCompare` on the basename and drops non-`.sql` entries (`:39-46`). **Keying by basename is deliberate**: a DB that already ran `0001_auth.sql` (from `migrations/`) will not re-run it when the same file appears via `migrations/auth/` — this is what makes the auth schema safe to copy up.
- **`scripts/migrate.mjs`** (deploy path, runs as `npm run db:migrate` after every `vite build` — `package.json:11`): no `DATABASE_URL` → skip with an explanatory log (`:21-27`); non-recursive `readdir` of `migrations/` (`:29-38`); refuses to connect at all when there is nothing pending (`:39-43`); one `pg.Pool` with `max: 1` (`:45`); `_migrations` created (`:48-50`); each file applied via `BEGIN` + the file in one simple-query call (multi-statement files work) + `INSERT INTO _migrations` + `COMMIT` (`:56-63`), `ROLLBACK` on failure keeping the original error (`:64-71`); rich error context on exit (`:83-90`).
- **Appliers do not recurse**: `migrations/auth/*.sql` is out of scope for both `migrate.mjs` and the PGLite glob until it is copied into `migrations/` root. **Nothing in this repository performs that copy** (grep of all non-test sources: only comments reference it) — it is an operator/deployer step ("copied into `migrations/` when the app turns sign-in on", `server.ts:142-143`; same story in `0001_auth.sql:8-11` and `migration-plan.mjs:6-12`). Consequence: today `migrations/` contains only `auth/` (no root-level files), so a workspace that enables auth locally (flag flip) but forgets the copy runs better-auth against a PGLite with **no `user`/`session`/`account` tables** → materialization fails at insert with relation-not-found and no session (see §8.2 for the operational trap).
- PGLite auto-apply is per-module-instance + serialized on a global chain (`db.ts:158-162`) and transactional per file (`db.ts:152-155`), giving preview/prod parity of schema and of the once-only guarantee.

---

### 3.5 Schema-evolution guidance & drift risks

- **Where new tables go:** `migrations/0002_*.sql`, `0003_*.sql`, … at root level only (the header of `0001_auth.sql:8-17` says so, and both appliers are non-recursive). Per-user tables should use `user_id TEXT NOT NULL` (TEXT — the dev user id is the string `'dev-user'`) and every query must be scoped by the verified `context.userId` server-side.
- **Naming:** app tables snake_case (auth tables are camelCase because better-auth queries them that way — the double quotes at `0001_auth.sql:19-63` are mandatory, not stylistic).
- **Drift risk 1 — two appliers, one ledger:** PGLite applies at runtime from the Vite glob (`db.ts:140-144`); Neon applies at build via `migrate.mjs` (package.json `build` = `vite build && npm run db:migrate`). Both record by basename in `_migrations`, so ordering, once-only, and naming must agree between the two paths — `pendingMigrations` is the shared oracle (`migration-plan.mjs:39-46`). A file added to `migrations/` while a dev server is running is applied on the next module re-eval of `db.ts` (the glob is eager per module instance) — but an HMR *client-only* edit won't re-run it; a server restart is the reliable trigger.
- **Drift risk 2 — auth schema copy:** `migrations/auth/0001_auth.sql` is invisible to both appliers until copied to root. The copy is documented in three places (`0001_auth.sql:8-11`, `server.ts:142-143`, `migration-plan.mjs:6-12`) and performed by nobody in-repo (see §8.2 item 7).
- **Drift risk 3 — OID parsers:** any future query that surfaces int8/date/interval columns depends on the parsers registered at `db.ts:93-95` (pg) and `db.ts:115-119` (PGLite). They are in sync today; a new backend or a raw `pg` usage elsewhere (e.g. better-auth's own Pool at `server.ts:145`, which has no custom parsers but also touches no int8/date columns) must register the same parsers or JSON shapes will diverge between preview and prod.
- **Transactions:** PGLite migrations wrap file+record atomically (`db.ts:152-155`); Neon migrations use BEGIN/COMMIT with ROLLBACK-on-error and error-context printing (`migrate.mjs:56-75,83-90`). Better-auth's Kysely dialect honors isolation levels (`pglite-dialect.ts:72-96`).

## 4. Platform / PWA / scripts mechanics

### 4.1 PWA + OG head injection (`grok-pwa-shared.mjs`, Vite plugin, Nitro middleware)

**`scripts/grok-pwa-shared.mjs`** is the single source of truth for platform head chrome, consumed by both the dev plugin and the deployed Nitro middleware:

- `escapeHtml` (`:31-38`) + `unescapeHtml` (`:41-48`) — decode order documented (`&amp;` last).
- **`appNameFromHost`** (`:62-82`): `"wild-race.grok.me" → "Wild Race"`; host must end `.grok.me`, slug must match `^[a-z0-9-]{1,63}$` (`:72`), then Title-Case join. Anything else → `DEFAULT_APP_NAME` ("Grok App"). (Host header is the only dynamic input; see §5 bug E for the trust analysis.)
- **`publicAppHost`** (`:95-105`): hostname usable for absolute og:image URLs; rejects IP literals, Vercel system domains (Envoy rewrites origin Host to `*.vercel.app`, `:84-92`), and anything outside `[a-z0-9.-]`. **`resolvePublicHost`** (`:113-117`) prefers `VITE_PUBLIC_HOSTNAME` (the deployed grok.me host the deployer injects) over request headers.
- **`isInstallQuery`** (`:119-125`): `?install=1|true` **and** `platform=ios` — the iOS Home-Screen tutorial trigger.
- **`isDocumentPath`** (`:128-137`): excludes `/__grok/`, `/api/`, `/@`, `/node_modules`, and **any path whose final segment ends `.<ext>`** (`:135`) — see §5 bug C.
- **`renderInstallPageHtml`** (`:154-158`) substitutes `{{APP_NAME}}`/`{{APP_URL}}` **both escapeHtml'd** into `scripts/install-page.html` (UA-sniffing template; references `/__grok/install/styles.css` + `assets/`).
- **`renderWebManifest`** (`:160-183`): per-app-named manifest, JSON.stringify'd (injection-safe), single icon `/__grok/icon-180.png`, standalone.
- **`grokPwaHeadTags`** (`:185-201`): manifest link, apple-touch-icon, `apple-mobile-web-app-title` (**escaped**, `:193`), status-bar style, theme-color. Legacy web-app-capable metas deliberately absent.
- **Extensions script** (`:203`, `:231-243`): `https://grok.com/grok-app-builder/extensions.js` injected into **every** document, with `data-project-id` and `<meta name="grok-project-id">` when `VITE_PROJECT_ID` is set; `x:creator`/`x:creator:id` metas when `X_CREATOR(_ID)` are set (`:220-228`).
- **OG identity**: `readOgSite` reads `src/lib/og/site.json` (tolerant; `:245-253`); `ogCardPublicPath` detects `public/og.jpg|png` (`:256-260`); **`snapshotOgIdentity`** (`:269-284`) bakes `{site}` at build time — the Vercel function has no workspace FS. If `site.json` claims `card: custom` but no file exists, the claims are deleted so a 404 `/og.jpg` never bakes (`:276-279`). `grokOgHeadTags` (`:336-376`) emits `twitter:card`, `og:title`/`og:description` (escaped), `og:type=x:game` when declared, and an absolute `og:image` — a custom card on the public host, else the **og.grok.me placeholder service** URL (`og.grok.me/v1/card.png?host=…&title=…[&color=…]`, `:361-363`), plus `x:game:image` banner tags (`:367-373`). `stripShareMetaTags` (`:378-386`) removes any app-authored duplicates of the 13 share keys before injection.
- **`injectGrokPwaHead`** (`:425-473`): strip → inject OG after `<head>` → append only *missing* PWA tags before `</head>` (per-tag dedupe at `:437-443`) → extensions script/meta dedupe (`:450-469`).
- **`createHeadInjector`** (`:485-527`): streaming-safe — buffers chunks in latin1 until the `</head>` marker (ASCII, cannot appear in a UTF-8 continuation byte — `:475-478,514`), transforms exactly the head, then passes later chunks straight through so SSR keeps its early flush. `flush()` handles documents with no `</head>`.

**`scripts/grok-pwa-plugin.mjs`** (dev/preview half, registered in `vite.config.ts:167` **before** `tanstackStart` so its middleware precedes the SPA fallback): serves `/__grok/manifest.webmanifest|.json` (`:55-63`) and the `?install=1` tutorial (`:65-74`); `wrapHtmlResponses` (`:87-152`) wraps `res.write`/`res.end` to stream-inject head tags, skipping content-encoded bodies (compression ordering handled in `configurePreviewServer` post-hook, `:180-188`); provides the `virtual:grok-og-identity` module baked from disk (`:161-167`).

**`server/middleware/grok-pwa.ts`** (deployed Nitro half; auto-registered because `vite.config.ts:177` sets `serverDir: "./server"`): same manifest/install routing as h3 global middleware (`:73-97`), then for HTML documents it awaits `next()` and pipes the response body through a `TransformStream` head injector, deleting `content-length` (`:39-61,101-109`). The install page ships inside the server bundle via `?raw` (`:17`) since `public/` is CDN-only on Vercel; OG identity comes from the virtual module (`:18`). h3-discards-`response`-hook and missing `render:html` in Nitro v3 are documented as the reason this is middleware (`:14-15`).

Seed finding on scripts (**confirmed**): `grok-pwa-plugin.mjs` + `grok-pwa-shared.mjs` inject head tags, extensions.js, and OG tags with `escapeHtml` at every sink (`grok-pwa-shared.mjs:156,193,225-227,347-373,453,460`); `server/middleware/grok-pwa.ts` is the deployed twin.

### 4.2 `scripts/with-app-env.mjs`, `app-env-plugin.mjs`, `check-auth-invariant.mjs`

- **`with-app-env.mjs`** wraps `dev`/`build`/`preview` (`package.json:10-14`) so all three resolve `.grok/app-env.json` identically. Only `VITE_`-prefixed string keys are honored (`:37-52`); explicit process env wins over the file (`:64-66`). It exists because a dev server started *outside* the wrapper can disagree with the next build about `VITE_AUTH_ENABLED` — a divergence that only surfaces as a built-output mismatch much later. `exitStatusFromChild` maps signals to `128+n` instead of re-raising them, because under qemu-user a self-directed signal can be delivered as SIGSEGV to the wrong process (`:68-83`). Signal forwarding keeps the wrapper the dev server's parent (`:116-118`).
- **`app-env-plugin.mjs`** serves the dev-only `/__app-env` JSON of Vite's resolved env (`apply: "serve"`, `:14-33`) so the invariant checker can observe the live server.
- **`check-auth-invariant.mjs`** compares dev (`probeDevAuthEnabled` via `/__app-env`, `:68-79`) vs build (`mergeAppEnv(readAppEnv(...))`, `:87-90`); exits 0 agree / 1 diverged / 2 unobservable (`:92-105`). Wired as `npm run check:auth` (`package.json:18`) and folded into every `browser-smoke` run (`browser-smoke.mjs:146-151`). Its header documents why the *built* bundle cannot be inspected (Vite inlines + minifier folds the comparison away, `:16-18`).

### 4.3 QA/verdict scripts (Playwright gates)

- **`browser-guard.mjs`** — safety rails for all capture scripts: URLs must be http/https **loopback** (file:/data: excluded; `BROWSER_ALLOW_EXTERNAL_HOST=1` opt-out, `:13-31`) and outputs must resolve strictly inside allowed dirs (default `/workspace`) with `..` neutralized (`:34+`). Rationale: unchecked, these scripts run Chromium `--no-sandbox` as root and would happily render `file:///root/.grok/auth.json` to a PNG.
- **`browser-smoke.mjs`** — Playwright chromium verdict run: desktop **1280×800** and mobile **390×844** viewports (`:64-67`); captures HTTP status, title, canvas presence, body-text length/hash/prefix, **horizontal overflow**, console errors and page errors (`:100-141`); `domcontentloaded` + 1 s settle instead of `networkidle` (HMR websocket never idles — `:108-112`); writes a JSON verdict next to the PNG; folds in `computeBrandWarnings` (`:143`) and auth-invariant warnings (`:146-151`); optional `--baseline` comparison guarded against self-overwrite (`:35-60`); exit code via `exitCodeFor` so the `finally` browser teardown always runs (`:162-177`).
- **`browser-smoke-verdict.mjs`** — pure verdict logic: normalized body-text hash (`:2-10`), baseline diff with collapse detection (body text < 50 % of baseline = collapse, `:85`), trivial-delta tolerance (20 chars or 10 %, `:88-97`), exit codes 0/1/2 (`:120-128`).
- **`brand-check.mjs`** — brand-asset gate: a canvas app (≈ game/visually rich) must ship `public/og.jpg` ≤ 600 KB (`:38`), declare `card: custom` in `src/lib/og/site.json`, declare `type: x:game` for games, and ship `public/x-banner.jpg` (1200×264) for X game-card unfurls (`:97-164`). The `.grok/og-pending` marker silences gates while the brand task works, expiring after 10 minutes (`:41-44,50-57,71-72`) so a Stop mid-generation can't hide a missing card forever. Runnable standalone (`:196-227`).

### 4.4 Preview lifecycle

- **`preview.mjs`** owns port **8081**, the built-output QA server (`vite preview` is strictPort, so a stale preview both fails the next start and serves the old build). It finds port owners by scanning `/proc/net/tcp{,6}` listener inodes → `/proc/<pid>/fd` socket readlinks (`:63-75,214-259`), corroborated by the pidfile whose pid is only trusted if its `/proc/<pid>/cmdline` still looks like a preview (`:77-108,197-212`) — pids are re-used across hibernate/revive. Signals process groups for leaders (`:178-195`), SIGTERM then SIGKILL after grace (`:119+`), refuses pid 1 (`:47-50`), and **hard-refuses to run without `/proc`** (`:338-341`) — Linux-sandbox-only, as the header says (`:1-11`). `restart()` detaches `npm run preview`, unrefs it, polls for readiness (60 s), and kills the fresh server if it never answers — a server that binds late would serve a build the agent was told to distrust (`:295-330`).
- **`startup.sh`** stops any leftover preview, no-ops if port 8080 already answers, else launches `npm run dev` logging to `/tmp/app-startup.log`.
- **`preview-thumbnail.mjs`** (42 lines) is the sandbox service's thumbnail hook — `preview.mjs:83-85` explicitly excludes it (and itself) from kill targets.

### 4.5 Sign-out / pre-sign-in sequencing (`sign-out-plan.mjs`)

Pure, unit-testable sequence used by `client.ts`:

- Preview vs deployed timeouts: **1500 ms preview** (local token clear IS the sign-out; a wedged request must never strand the button) vs **10 s deployed** (only the server can clear the HttpOnly cookie — and with `cookieCache` maxAge 300, `/get-session` would keep answering from cache for minutes; so a timeout must report failure, not fake success) (`:27-34,43-45`).
- `settleWithin` never rejects (`:55-72`); `runSignOut` (`:94-123`): preview → best-effort server call, always clear token + redirect; deployed → **throws unless the server confirmed** (`:113-122`).
- `runPreSignInSignOut` (`:148-160`): best-effort drop of any prior session before a new sign-in so switching providers switches identity; bounded by the same per-environment rule.

### 4.6 Other scripts

- **`write-atomic.mjs`** — staged-file handover via `rename(2)`: refuses a staged path inside `public/` (vite ships it verbatim), refuses same-path, and turns EXDEV into a "stage under /workspace/.grok/" error — a copy fallback would have to land a temp in the target directory, defeating the point (`:40-69`). See §5 bug E.
- **`migrate.mjs` / `migration-plan.mjs`** — §3.4.
- **`install-page.html`** — §4.1; **`public/__grok/`** holds `icon-180.png` and `install/{styles.css, assets/}` (static; `/__grok/` is excluded from document handling so these never get double-injected).
- Test entry (`package.json:19`) runs `scripts/**/*.test.mjs` under `node --test`, plus the TS auth/app-data tests under `node --experimental-strip-types`.

---

### 4.7 Test coverage notes (tests skimmed, not read in full)

- `scripts/*.test.mjs` (7 suites, 1700+ lines) exercise the pure-logic splits under `node --test`: `grok-pwa-plugin.test.mjs` and the shared injector behavior (head injection, dedupe, streaming), `write-atomic.test.mjs` (EXDEV injection — the rename is parameterized precisely so the cross-device refusal is testable, `write-atomic.mjs:53`), `migration-plan.test.mjs` (basename keying, ordering), `check-auth-invariant.test.mjs`, `sign-out-plan.test.mjs` (settleWithin timeouts), `with-app-env.test.mjs` (env precedence, exit-status mapping incl. the qemu signal note), `brand-check.test.mjs` and `browser-smoke-verdict.test.mjs` (baseline diff heuristics), `preview.test.mjs` (/proc parsing pure functions).
- TS suites run with `node --experimental-strip-types` (`package.json:19`): `gate-identity.test.ts` (495 lines — verifier behavior under key rotation/mismatch, audience, claim types), `sign-in-gate.test.ts` (30 lines), `app-data.test.ts` (393 lines — callTool triage, memo TTL/keying, error classification).
- The deliberate split pattern — side-effectful script + pure module (`sign-out-plan.mjs` ↔ `client.ts`, `migration-plan.mjs` ↔ `db.ts`/`migrate.mjs`, `check-auth-invariant.mjs` ↔ `browser-smoke.mjs`, `browser-smoke-verdict.mjs` ↔ `browser-smoke.mjs`) — is what makes `node --test` coverage possible at all, since `node --test` only reaches `scripts/`; the TS modules can't run under it without strip-types.
- QA verdict scripts are themselves part of the platform contract: agents smoke the app after every meaningful change and the verdict JSON/baseline flow (`browser-smoke.mjs:152-165`) is how regressions get caught across turns.

## 5. Bugs register

### A. Popup-blocked connector login leaves the user stranded but reports success — P2
**Where:** `src/lib/app-data/login.ts:20-28`.
**Verified behavior:** when framed, `redirectToLoginIfRequired` opens a popup; only if `window.open` returns **null** (popup blocker / third-party-policy denial) does it fall through to `window.location.assign(url)` *inside the iframe* and unconditionally return `true`. Two problems: (1) in the sandbox the gate sign-in origin almost certainly forbids framing (and cross-origin iframe navigation without user activation is blocked by the browser), so the assignment silently does nothing; (2) the caller receives "handled" either way and shows no "allow pop-ups" affordance. The seed described this as a "double-fire when window.open returns null" — that wording is imprecise: `assign` runs **only** when `open` returned null; the open+assign pair never both execute. The real defect is the dead-end fallback that claims success.
**Fix:** in the framed branch, return `false` (or a distinct "popup blocked" signal) when `window.open` returns null, and surface a user-facing "allow pop-ups for this site" message; never `assign` a cross-origin URL from inside an iframe.

### B. Connector failure memo keyed on JWT claims, not the token — P3
**Where:** `src/lib/app-data/client.server.ts:194-217` (`tokenIdentityKey`) and `:292-302` (memo key).
**Verified behavior:** failures are memoized 5 s keyed by `sub`+`team_id` (when the token parses) rather than the token itself. After a token is revoked/rotated but the same subject reconnects within 5 s, the new request can receive the *previous* identity's memoized error message (error text only — no data rows are ever memoized, since only failures enter the memo). Cross-identity error bleed is transient and low-sensitivity, but it is real.
**Fix:** include a hash of the full token (or an `exp` claim) in the key, or drop claim parsing and always hash the token.

### C. `isDocumentPath` dot-extension regex blocks legitimate dot-suffixed routes — P3
**Where:** `scripts/grok-pwa-shared.mjs:135` (used by `grok-pwa-plugin.mjs:65,96`, `server/middleware/grok-pwa.ts:84,99`).
**Verified behavior:** any document path whose final segment ends in `.<ext>` (`/\.[a-z0-9]+$/i`) is treated as an asset: no PWA head injection, no OG tags, no `?install=1` tutorial, no share-meta stripping. A TanStack client route such as `/login.html`, `/about.en`, `/v1.0` (server route named with a dot) loses all platform chrome, and crawlers see raw HTML without share tags.
**Fix:** match known asset extensions only (`\.(?:js|css|png|jpe?g|gif|svg|webp|woff2?|ico|json|txt|mp[34]|wasm)$`) or require the preceding char not to be alphanumeric in route positions; keep `__grok/api/@` exclusions.

### D. Same/same-site isolation rests on `Sec-Fetch-*` headers — P2
**Where:** `src/lib/auth/isolation.server.ts:38-50`, enforced at `middleware.ts:44` and `app-data/client.server.ts:272`.
**Verified behavior:** requests with **no** `Sec-Fetch-Site` header are allowed unconditionally (`:41`). All modern browsers send it on every request type, but non-browser HTTP clients, privacy proxies that strip it, and legacy engines fall into the "non-browser / SSR" bucket and bypass sibling isolation entirely. The cookie + `__Host-` + `trustedOrigins` layers still protect the session, so the practical risk is CSRF-style rides from exotic clients with a stolen/leaked cookie — but the security model's documentation (`isolation.server.ts:17-18`) overstates "server-to-server, which send no Sec-Fetch-Site" as the *only* headerless population.
**Fix:** accept the residual and document it (it is inherent to Fetch Metadata), or add a same-origin confirmation (Origin vs Host comparison) for the no-header path where `Origin` exists, plus a session-bound CSRF token for cookie-authenticated POSTs.

### E. `write-atomic.mjs` `isInside` is lexical — symlink aliasing defeats the public/ refusal — P3
**Where:** `scripts/write-atomic.mjs:30-33` (`isInside`), `:40-46` (`stagingError`).
**Verified behavior:** containment is checked on the lexical relative path. If any path component between the project root and the staged file is a **symlink that aliases `public/`** (e.g. `.grok/stage` → `public/`), the lexical test passes while the physical file lands inside `public/` — and since `vite build` ships `public/` verbatim, an interrupted or careless run ships the temp file, which is exactly what the refusal exists to prevent. `rename(2)` does not follow the source path's final symlink but does traverse directory symlinks.
**Fix:** `realpathSync` both `staged` and `publicDir` (with a `realpath` failure → refuse) before the containment check; also realpath the target directory.

### F. Same-name/concurrent hook races in the auth client & gate session path — P2 (low likelihood)
**Where:** `src/lib/auth/client.ts:176-207` (popup waiters) and `src/lib/auth/gate-session.server.ts:215-335` (`/get-session` before-hook); mitigation at `gate-session.server.ts:106-136`.
**Verified behavior (two distinct races):**
1. **Popup waiter cross-settle:** every `signIn` call attaches its own `window` `message` listener (`client.ts:205`) with the same origin + source filter. A rapid double-click on two different providers opens two popups; the *first* completion message settles **both** waiters (`:187-192` has no per-attempt token/correlation check). Both calls then store the same token and race `getSession`/navigation — the second provider's flow can finish with the first provider's session. Unique popup window names (`:168`) prevent popup reuse but not listener cross-settle.
2. **Parallel `/get-session` materialization:** two simultaneous `/get-session` requests from a fresh gate viewer both see no session cookie and both run `handleOAuthUserInfo` + `setSessionCookie` (`gate-session.server.ts:280-320`), creating two session rows and emitting two different session cookies; last-writer-wins in the browser while the orphan row stays valid server-side. The related identity-swap staleness race (stale `session_data` cookie cache serving the replaced user) **is** handled — `expireSessionDataCookie` (`:106-136`) exists for exactly that, keyed off the comment at `:99-105` — but the concurrent-first-materialization case has no guard.
**Fix:** (1) correlate popup messages per attempt (random attempt id round-tripped through the popup URL and echoed back in the message) and remove stale listeners on settle; (2) serialize the gate materialization path per identity (in-process mutex keyed on `sub`), and after `setSessionCookie`, delete any other session rows for the same user created in the same window.

### G. `account` table has no uniqueness constraint on (providerId, accountId) — P3
**Where:** `migrations/auth/0001_auth.sql:40-54`.
**Verified behavior:** stock better-auth schema; duplicate link rows are prevented by better-auth's read-then-insert in `handleOAuthUserInfo`, not by the database. Under the bug-F race above (two concurrent materializations for one identity) both inserts succeed and the user ends up with two identical `grok-gate` account rows — harmless today (lookups match either) but a data-integrity wart that also weakens `sessionBoundToGateIdentity`'s guarantee slightly (any matching row counts).
**Fix:** add `create unique index if not exists account_provider_account_idx on "account" ("providerId","accountId")` in a follow-up migration and handle the constraint violation in the gate hook.

### H. (Seed finding 1, reframed) `verify.server.ts` fail-closed throw is a plain `Error` — P3
**Where:** `src/lib/auth/verify.server.ts:86-91`.
**Verified behavior:** the misconfig guard throws a bare `Error` with no `status`; callers routing on `err.status === 401` (the documented contract at `:33-36`) will treat it as a 500-class failure. Arguably correct (it is a server misconfiguration, not the caller's fault) but worth an explicit `status: 500` so client handling is unambiguous.

---

## 6. Dead code / TODO / stubs

- **`src/lib/auth/provider.tsx`** — `AuthProvider` is an explicit passthrough (`<>{children}</>`, `:13-15`) with a doc comment naming it the future mount point for toasts/themes. Not dead — a deliberate seam — but zero behavior today. Grep confirms no other auth context exists client-side (better-auth `useSession` is provider-less).
- **`src/lib/auth/email-password.ts`** — `emailAndPasswordEnabled = false` (`:10`): dormant-but-wired. Flipping the flag activates `server.ts:214`'s spread and needs matching UI/forms that don't exist yet. Documented as intentional ("auth skill" flow).
- **`sign-in-gate.ts` / `sign-in-gate.test.ts`** — the pure state machine is used by `gates.tsx:60`; the test file is a 30-line unit test. Not dead.
- **Client-visible comments referencing `auth skill`, `design-ui skill`, `og skill`** (e.g. `server.ts:5`, `gates.tsx:86`, `brand-check.mjs:6`) — these are agent-facing pointers to `.grok/skills/*`, not code TODOs.
- **No `TODO`/`FIXME`/`XXX` markers** were found in any in-scope non-test file (the codebase is unusually clean in that regard; the closest are honest "could not observe"/"unlikely" style comments).
- **`app-data/index.ts`** — pure barrel; re-exports only client-safe surface, keeping `client.server` out of browser bundles (verified: no client import of `client.server.ts`).
- **`customOgAssetPath` / `resolveOgCardAsset` / `ogServiceUrl`** (`grok-pwa-shared.mjs:286-327`) — exported and typed in `grok-pwa-shared.d.mts` but referenced only internally by `grokOgHeadTags` in this repo; the exports serve the og brand tooling outside the repo.
- **`preview-thumbnail.mjs`** — used by the sandbox service (referenced in `preview.mjs:83-85`); not reachable from npm scripts in this repo.
- **`server/virtual-grok-og-identity.d.ts`** — type shim for the Vite virtual module; `tsconfig.json:32-35` includes `server` so `typecheck` resolves it (and `allowJs`/`checkJs` at `tsconfig.json:17-18` type the `.mjs` imports from `db.ts` — `migration-plan.mjs` is `@ts-check`ed).
- **Dead-ish duplication:** `middleware.ts:41-42` and `app-data/client.server.ts:3-6` both dynamically import isolation/verify — necessary for the `.server` split, not duplication.
- **ESLint posture** (`eslint.config.mjs`): recommended sets + react-hooks + react-refresh; `no-unused-vars` is warn with `^_` ignores (`:38-41`); `no-explicit-any` off (`:42`). No custom security rules; `@typescript-eslint/strict` not enabled.

---

## 7. Security review

### 7.1 Session & cookie hardening — strong
`__Host-` names for all four auth cookies (`server.ts:227-231`), `Secure` + `SameSite=Lax` + `Path=/` defaults (`:225`), deliberate `useSecureCookies: false` to stop better-auth's `__Secure-` prefix from allowing a `Domain` attribute (`:220-224`), and the `__Host-` gate marker with the same no-Domain property (`gate-session-marker.ts:6-9`). The cookie-toss attack by a sibling `*.grok.me` tenant is closed twice (name prefix rule + no `Domain` emitted). Session data cached in a signed cookie (`server.ts:207-211`) — signature prevents forgery; TTL 300 s bounds staleness, and identity swaps actively expire it (`gate-session.server.ts:106-136`).

### 7.2 Identity verification — strong
EdDSA-only JWT verification with pinned issuer/audience/algorithms, required claims, 10-minute max age (`gate-identity.server.ts:107-113`), JWKS caching with kid-miss refetch (`:71-88`), fail-closed `null` on any error (`:122-124`), and type-checked claim extraction (`:114-121`). The gate hook never fabricates a session: `handleOAuthUserInfo` + real session rows or nothing (`gate-session.server.ts:280-329`).

### 7.3 CSRF / sibling isolation — good with a documented residual
Fetch-Metadata gate at the single auth chokepoint (`middleware.ts:44`) and the connector chokepoint (`client.server.ts:272`); top-level GET navigations allowed for OAuth returns (`isolation.server.ts:44-50`); everything scripted and cross/same-site rejected. Residual: headerless clients bypass (bug D). No CSRF tokens beyond better-auth's origin checking (`trustedOrigins`, `server.ts:116-126`) — acceptable given the header gate.

### 7.4 Secrets handling
- **Preview client secret is baked into the repo** (`preview.ts:20-21`, 64 hex chars). This is an explicit design decision (documented `:1-17`): the broker needs one client that accepts any `*.grok-sandbox.com` callback; the broker stores only `base64url(SHA-256)` of the secret; rotation = regenerate broker env + constant together. Low-privilege by construction (preview hosts only). It ships in the deployed server bundle too (`server.ts:81-82` fallback) — but the deployed path uses injected `GROK_AUTH_*`, so the fallback only matters if injection is missing.
- `BETTER_AUTH_SECRET` is injected when deployed; the preview secret is process-random on `globalThis` (`server.ts:59-65`). HMR cannot invalidate sessions; process restart wipes PGLite rows + secret together — consistent.
- Connector tokens never touch the browser or disk: per-request header from the edge (`client.server.ts:67`) or non-prod env (`:68-71`).
- Bearer session token in `sessionStorage` (`client.ts:48-68`) is the necessary price of partitioned-cookie previews; the popup completion page that carries it is `no-store` (`popup.server.ts:49,120`), and the popup→opener handoff is origin-checked (`client.ts:188`) with the payload JSON-escaped (`popup.server.ts:129`).
- Log lines that could carry secrets are pre-trimmed (e.g. cookie preview slices at `gate-session.server.ts:63` — 120 chars of a signed cookie, acceptable; and no token values are logged anywhere else in scope).

### 7.5 Host-header trust — the one genuine nuance
Request `Host`/`x-forwarded-host` drives: gate issuer selection (`gate-identity.server.ts:143-158`), connectors host selection (`client.server.ts:62-66`), gate sign-in `return_to` (`client.server.ts:152-159`), and (in preview, without `VITE_PUBLIC_HOSTNAME`) the absolute og:image host (`grok-pwa-shared.mjs:113-117,356-373`). In sandbox previews the *platform's own proxy* sets the forwarded host, so header spoofing is only possible when a client can hit the origin directly — for deployed apps the grok.me gate edge is the only entry. Impact of spoofing where possible: the app would fetch JWKS from / POST connector calls to a host the attacker names — but the JWKS signature, the broker audience, and the connector token (edge-injected) still must validate, so no credential is surrendered; worst case is a self-inflicted denial or a spoofed share-card hostname. This is why `publicAppHost` charset-whitelists (`grok-pwa-shared.mjs:101`) and **every sink that embeds host-derived or title-derived strings is `escapeHtml`'d** (`:156,193,347-373`).

**Seed finding on the "PWA-injection XSS via host header" (a) — investigated and corrected:** the seed claimed `x-forwarded-host` → `appNameFromHost` is injected **unescaped** into app HTML. That is **not** reachable in the current bytes: (1) `appNameFromHost` only ever returns a slug derived from `^[a-z0-9-]{1,63}$` or the constant `DEFAULT_APP_NAME` (`grok-pwa-shared.mjs:68-81`), so hostile hosts collapse to a safe constant; (2) every interpolation point is escaped — install page `renderInstallPageHtml` `escapeHtml`s both substitutions (`grok-pwa-shared.mjs:156-157`), `grokPwaHeadTags` escapes the app title (`:193`), OG tags escape title/description/image/banner (`:347-373`), and manifest output is `JSON.stringify`'d (`:162`). No unescaped host-derived string reaches HTML in `grok-pwa-shared.mjs`, `grok-pwa-plugin.mjs`, `server/middleware/grok-pwa.ts`, or `install-page.html`. Residual risk is integrity-level only (a direct-to-server client can spoof the share-card host / manifest name in preview contexts where the platform proxy is bypassed). Severity: P3 informational, not an XSS.

### 7.6 Third-party script injection & supply chain
`grok.com/grok-app-builder/extensions.js` is injected into **every** HTML document this app serves (dev and deployed, `grok-pwa-shared.mjs:231-243`), and it runs before app scripts (defer, head position) with same-origin cookie/bearer access. This is platform architecture — the "Created with Grok" chrome and preview bridge — but it is the largest single trust point in the system: a compromise of that endpoint compromises every tenant app. Worth stating explicitly in the threat model; nothing app-side can or should change it (the injection is the contract), but it belongs in the risk register. No SRI possible for a platform script that must evolve; acceptable platform trade-off.

### 7.7 Misc observations
- Connector errors are memoized **per process** (`client.server.ts:192`) — serverless instances each carry their own memo; no cross-instance leak, and the TTL bounds memory. The memo never stores data rows, only error text.
- `popup.server.ts` phase-2 reads the session cookie from the *request* and hands it to the opener — the cookie is HttpOnly (`server.ts` defaults), so only the server-side handler can read it; the popup page is `no-store`. Sound.
- `verify.server.ts:60` — `getSessionUser` returns null when no request context exists; server functions always run inside one, so no silent auth bypass is possible from that path.
- `email-password` disabled by default removes the largest password-hygiene surface; enabling it later inherits better-auth's standard protections.
- Dev server binds `0.0.0.0:8080` (`vite.config.ts:149-153`) — the live-preview contract — so the sandbox dev server is LAN-reachable; mitigated by the sandbox network topology, and the preview server binds loopback only (`:154-158`).

---

## 8. Potentiality & platform constraints

### 8.1 What this layer is *for*
This template layer exists to make three environments behave identically from an app's point of view: sandbox live preview (partitioned-cookie iframe on `*.grok-sandbox.com`), deployed grok.me app (edge-gated, Envoy-proxied, Vercel/Nitro serverless), and local dev (loopback). The architecture's spine is: **edge injects identity + connector credentials → app verifies (JWT/JWKS) → better-auth materializes a first-party session → server functions scope every query by `context.userId`** — with the connector RPC as the only sanctioned way to reach user data outside the app's own DB.

### 8.2 Platform constraints encoded in the code (things agents must not "fix away")
1. **`0.0.0.0:8080` dev / `127.0.0.1:8081` preview, strict ports** (`vite.config.ts:149-158`) — the sandbox and the preview tooling both hard-code these (comments at `vite.config.ts:145-147`, `preview.mjs:26-27`).
2. **Preview client id/secret baked in** (`preview.ts:19-21`) — must equal the broker's `GROK_PREVIEW_CLIENT_*`; never "clean up" by removing.
3. **`/auth/popup` is middleware-owned** (`vite.config.ts:64-143`) — creating `src/routes/auth/popup.tsx` breaks popup sign-in by painting the app shell in the popup; the file header says so in both places (`popup.server.ts:14-17`, `vite.config.ts:54-63`).
4. **`serverDir: "./server"` must stay** (`vite.config.ts:170-180`) — without it Nitro v3 never scans `server/middleware/`, silently unwiring `?install=1`, the manifest, and head injection on deploys.
5. **`.server` suffixes are load-bearing** (`isolation.server.ts:4-9`, `middleware.ts:37-40`) — renaming them ships Node-only imports to the browser (`AsyncLocalStorage is not a constructor`).
6. **`VITE_AUTH_ENABLED` must agree between dev and build** — enforced by `with-app-env.mjs` + `check-auth-invariant.mjs` (§4.2). The shipped `.grok/app-env.json:2` sets `"false"`; the deployer overrides to `"true"` in project env (documented in `with-app-env.mjs:14-17`). Do not "helpfully" remove the key.
7. **Migrations keyed by basename, non-recursive** (`migration-plan.mjs:6-12`) — `migrations/auth/0001_auth.sql` is opt-in. **Nothing in the repo performs the copy-up**; when an app enables auth, the agent/operator must copy `migrations/auth/0001_auth.sql` → `migrations/` (or have the deployer do it) or every better-auth write fails on both Neon (migrate never sees the file) and PGLite (glob never descends). Today `migrations/` contains only `auth/`, so this workspace is one flag flip away from a schema-less auth DB — worth a guard or a copy step in `with-app-env`/`db:migrate` if auth is enabled locally.
8. **PGLite is in-memory per process** — preview sessions and data vanish on server restart; the code leans into this (globalThis singletons, `db.ts:108-130`, `server.ts:59-65`) and it is the *documented* preview semantics, not a bug.
9. **`preview.mjs` requires `/proc`** (`preview.mjs:338-341`) — Linux sandbox only; it refuses to run elsewhere rather than half-work.
10. **`write-atomic` staging contract** — staged files belong under `/workspace/.grok/`, never `public/` and never a different filesystem (EXDEV refusal, `write-atomic.mjs:61-66`); the atomicity argument depends on rename(2) within one filesystem.
11. **OID parity is a contract** (`db.ts:53-68`) — new app migrations should avoid int8/date/interval drift or must register parsers; both drivers' parsers were changed in lockstep for a reason.
12. **Nitro beta pin + `nf3` override** (`package.json:7-8,90`) — deliberate pins (Vercel preset behavior); changing them is a platform risk.
13. **Vercel functions have no workspace FS** — hence OG identity baking at build (`snapshotOgIdentity`, `grok-pwa-shared.mjs:269-284`), the install page shipped via `?raw` (`server/middleware/grok-pwa.ts:17`), and the public/ CDN split; brand assets generated *after* a build do not reach deployed share cards until the next build.
14. **The `x:creator`, `grok-project-id`, and extensions.js metas are platform contract** (`grok-pwa-shared.mjs:220-243,450-469`) — removing them breaks attribution/preview chrome; they are re-added if the app strips them.
15. **Gate/connector host mapping is env-conditional** (`gate-identity.server.ts:151-158`, `client.server.ts:42-51`) — staging vs prod is derived from the inbound host, with explicit env overrides (`GROK_GATE_ORIGIN`, `GROK_CONNECTORS_URL`) for isolated environments; loopback deliberately resolves to *no* gate/connectors host (local dev has none).

### 8.3 Forward-looking notes
- **Auth-on preview needs the schema copy** (constraint 7) — the highest-likelihood operational failure in this layer for an agent flipping auth on; a startup assertion comparing `pendingMigrations` against the better-auth tables would catch it early.
- **Gate sessions are ephemeral by design**: signing out is hidden (`gates.tsx:116`), the next `x-grok-identity` re-materializes. Apps that need "log out of this kiosk" semantics must clear the gate cookie *and* the app session and accept re-materialization is the platform's call.
- **Browser-smoke baselines** (`browser-smoke-verdict.mjs:50-100`) treat body-text collapse and console-error appearance as verdict failures; agents should re-baseline deliberately, never by deleting the baseline and reading "diverges" as a pass (the code explicitly flags an unreadable baseline as diverging, `browser-smoke.mjs:71-89`).
- The connector memo (bug B) and the popup/message races (bug F) are the two spots most likely to produce confusing "works in preview, flaky in prod" reports; both have cheap fixes listed in §5.

---

### Seed-finding disposition summary
1. **Confirmed.** Tri-mode + fail-closed (`verify.server.ts:84-97`).
2. **Confirmed** with details (JWKS TTL/kid-refetch; marker non-HttpOnly; materialization chain).
3. **Confirmed.** No `types.ts`; `Bearer`-header redactions were display artifacts (bytes verified intact).
4. **Confirmed** with two refinements (401 never memoized; env fallback gated on non-production).
5. **Confirmed.** DB dual-driver, OID normalization, basename-keyed non-recursive migrations, auth schema never auto-applied.
6. **Confirmed.** Script roles as listed; `preview.mjs` Linux-only via `/proc`.
7. Bugs: (a) **corrected/refuted as XSS** — sinks are escaped and the slug charset is whitelisted; reframed as host-trust integrity note. (b) **corrected wording** — no double-fire; dead-end fallback when popup blocked. (c)(d)(e) **confirmed** as written. (f) **re-derived** into two concrete races (popup waiter cross-settle; parallel gate materialization) plus the already-mitigated session_data cache race.

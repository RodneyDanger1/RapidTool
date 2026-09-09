# Flash Fix 04 — Auth + App-Data (audit/03 findings A–H)

- **Date:** 2026-09-05
- **Scope owner:** Flash fix agent (auth/app-data). Concurrent with 2 Pro + 2 Flash fix agents; edits confined to
  `src/lib/auth/*.ts`, `src/lib/app-data/*.ts`, and the three legacy suites (`gate-identity.test.ts`,
  `sign-in-gate.test.ts`, `app-data.test.ts`). Platform chrome (`server/`, `scripts/`, `migrations/`, `public/`)
  untouched. Not a git repo.
- **Ground floor re-measured before editing:** `npm run typecheck` had exactly 1 error, in `src/lib/engine.ts`
  (non-owned — concurrent Pro wave mid-edit; not touched). Zero errors in any owned file. The three legacy
  auth/app-data suites: **45/45 pass** (gate-identity + sign-in-gate + app-data).
- **Sources:** `audit/03_auth_appdata_platform_audit.md` (bug register §5, findings A–H) is the finding source.
  `review/01` covers only core engine files outside this scope; `review/03` has no auth/app-data findings
  (verified by grep — it is the competitor-usefulness review).

## Findings disposition (audit/03 §5 bugs register)

| Finding | Where | Disposition |
|---|---|---|
| **A** popup-blocked connector login | `src/lib/app-data/login.ts` | **Fixed** (code + test pin) |
| **B** claim-keyed failure memo | `src/lib/app-data/client.server.ts` | **Fixed** (code + test pin) |
| **C** `isDocumentPath` dot-extension regex | `scripts/grok-pwa-shared.mjs` | **Skipped** — `scripts/` outside ownership |
| **D** isolation on `Sec-Fetch-*` | `src/lib/auth/isolation.server.ts` | **Fixed** (documented residual — audit's accepted fix option) |
| **E** `write-atomic` lexical `isInside` | `scripts/write-atomic.mjs` | **Skipped** — `scripts/` outside ownership |
| **F1** popup waiter cross-settle | `src/lib/auth/client.ts` | **Fixed** (listener bound to own popup source) |
| **F2** concurrent gate materialization | `src/lib/auth/gate-session.server.ts` | **Fixed** (per-identity serialization) |
| **G** account (providerId, accountId) uniqueness gap | `migrations/auth/0001_auth.sql` + gate hook | **Mitigated in code** (F2 lock removes the app-side duplicate-account race; the DB unique index belongs in a follow-up migration — `migrations/` is outside ownership) |
| **H** plain-`Error` fail-closed throw | `src/lib/auth/verify.server.ts` | **Fixed** (structured `status: 500` error) |

---

## Fix A — `login.ts`: popup-blocked redirect must not claim success

**Finding:** `src/lib/app-data/login.ts:20-28` (audit/03 A, P2). When framed, `redirectToLoginIfRequired` opened a
popup and, if `window.open` returned `null` (popup blocker / third-party-policy denial), fell through to
`window.location.assign(url)` *inside the iframe* and unconditionally returned `true`. The gate sign-in origin
forbids framing and cross-origin iframe navigation without user activation is browser-blocked, so the assign
silently did nothing while the caller treated the redirect as handled — no "allow pop-ups" affordance, visitor
stranded.

**Before (`login.ts:20-28`):**
```ts
if (isFramed()) {
  const opened = window.open(url, "_blank");
  if (opened) {
    opened.opener = null;
    return true;
  }
}
window.location.assign(url);
return true;
```
**After (`login.ts:20-36`):** framed branch returns `false` (not handled) when the popup is blocked and never
navigates the iframe; the top-level (non-framed) branch still uses `location.assign` (a plain navigation is
correct there). Comments document why. Caller contract unchanged: `true` = a popup was opened or a top-level
navigation started; `false` = nothing happened (no `loginUrl`, not login-required, server-side, or **popup
blocked** — the caller may now surface an allow-pop-ups affordance).

**Test pin updated:** `app-data.test.ts:271` — "reports NOT handled when framed and the popup is blocked (no
iframe navigation)" now asserts `did === false` and `assigned === ""` (was: `true` + full-URL assign, pinning the
bug). No in-repo caller of `redirectToLoginIfRequired` exists outside the barrel exports (verified by grep), so
the return-value change cannot strand any wired flow.

---

## Fix B — `client.server.ts`: failure memo keyed on the concrete token

**Finding:** `src/lib/app-data/client.server.ts:194-220` (audit/03 B, P3). `tokenIdentityKey` decoded the JWT and
keyed the 5 s failure memo on `sub`+`team_id` claims when parseable. A revoked/rotated token that carries the
same claims as a successor (e.g. the subject reconnects under a fresh grant) would receive the *predecessor's*
memoized error within the window — cross-identity error bleed. Only failures are memoized (never data), so the
impact was transient error text, but it was real.

**Before:** ~26-line claim decode → `sha256(JSON.stringify([sub, team_id]))` with raw-token-hash fallback.
**After (`client.server.ts:194-203`):** `tokenIdentityKey` = `sha256` of the full token bytes. Only byte-identical
repeats share a slot. Correctness over memo hit-rate: the memo holds failures only, 401s bypass it entirely
(`callTool` 401 path returns without `fail()`), and the sweep keeps the map bounded — so the hit-rate cost is
acceptable and the bleed is structurally impossible.

**Test pin updated:** `app-data.test.ts:68` — "keys by the concrete token so a reminted token never replays a
stale failure": same `sub`, reminted token (different `iat`/`exp`) now refetches (2 calls), a different `sub`
also refetches (3 calls). Existing pins that still hold unchanged: byte-identical repeats replay without
refetching (`app-data.test.ts:53`), TTL sweep (`:103`), 401 never memoized (`:129`).

---

## Fix D — `isolation.server.ts`: honest documentation of the headerless residual

**Finding:** `src/lib/auth/isolation.server.ts:17-18` (audit/03 D, P2). The header comment claimed the
no-`Sec-Fetch-Site` population is only "SSR / server-to-server"; in reality privacy proxies that strip
`Sec-Fetch-*`, non-browser clients, and legacy engines also land in the allowed bucket. The audit's accepted fix
options: "accept the residual and document it (it is inherent to Fetch Metadata)" or add an Origin-vs-Host
confirmation — the latter is unsafe here because the deployed Envoy proxy rewrites the internal `Host` to
`*.vercel.app` while the browser's `Origin` stays the public grok.me host, so an equality check would reject
legitimate first-party POSTs (the reason the codebase keeps `trustedOrigins` as the origin authority).

**Change:** header doc block (`isolation.server.ts:17-31`) and the inline gate comment (`:44-47`) now name the
real headerless population and spell out the remaining layers (`__Host-` no-`Domain` cookies, `trustedOrigins`,
cookies ride only on genuine browser requests) that make this defense-in-depth, not the last line. Zero behavior
change.

---

## Fix F1 — `client.ts`: popup waiter settled only by its own popup

**Finding:** `src/lib/auth/client.ts:176-207` (audit/03 F part 1, P2 low likelihood). Every `signIn` call attached
a `message` listener filtered on origin + `data.source` only. A rapid double-click on two providers opened two
popups; the first completion message settled **both** waiters, so both calls stored the first provider's token
and the second flow could finish signed in as the first identity. Unique popup window names prevented popup
reuse but not listener cross-settle.

**Fix (`client.ts:195`):** each waiter now also requires `event.source === popup` — the `WindowProxy` this exact
attempt opened (stable across the popup's cross-origin navigations, since it is one browsing context). A
completion from a *different* attempt's popup can no longer settle this waiter. This is the strongest
correlation available without round-tripping an attempt id through the broker `redirect_uri` (the broker-registered
callback URL `…/auth/popup?done=1` cannot carry extra query params without risking an OAuth redirect-uri
mismatch). Stale listeners were already removed on settle (`cleanup()`), and per-attempt popup names already
prevented window reuse.

---

## Fix F2 + G mitigation — `gate-session.server.ts`: per-identity materialization lock

**Finding:** `src/lib/auth/gate-session.server.ts:215-335` (audit/03 F part 2 + G, P2 low likelihood / P3).
Two simultaneous `/get-session` requests from a fresh gate viewer both see no session cookie and both run
`handleOAuthUserInfo` + `setSessionCookie`. Better Auth's account linking is read-then-insert with **no DB
unique constraint on (`providerId`, `accountId`)** (the auth migration is the DB-side fix, out of ownership), so
the interleaved pair can mint two identical `grok-gate` account rows for one identity.

**Fix:** an in-process promise-chain mutex, `withMaterializationLock` (`gate-session.server.ts:33-63`), keyed by
gate identity `sub`, wraps the entire read-decide-materialize region (`:261-346`) — the existing-session check,
stale-session deletion (identity swap), `handleOAuthUserInfo`, `setSessionCookie`, cookie emission, marker, and
request-header rewrite all run atomically per identity. The second concurrent request now observes the first
one's account row and links to the same user — no duplicate account/user rows can be created through this path.
Queue-slot cleanup is exact (the map entry is deleted only when no one queued behind). Serialization is
in-process only (module-level `Map`); across serverless instances the DB unique index remains the proper
backstop (follow-up migration, out of ownership).

**Documented residual:** a second **session** row can still be minted under the double-fire (each
`handleOAuthUserInfo`+`setSessionCookie` creates one); the browser's last-writer-wins cookie wins and the orphan
row is self-expiring. Deleting same-window sibling sessions after `setSessionCookie` was considered and deferred:
it would require guessing better-auth `internalAdapter` session-listing APIs with no in-scope test coverage on
this delicate file. This is noted in the code comment.

---

## Fix H — `verify.server.ts`: fail-closed throw carries structured context

**Finding:** `src/lib/auth/verify.server.ts:86-91` (audit/03 H, P3). The misconfig guard (`auth disabled +
DATABASE_URL set`) threw a bare `Error` with no `status`, so callers routing on `err.status === 401` (the
documented `UnauthorizedError` contract at `:33-36`) would treat a server misconfiguration as a 500-class
failure only by accident of `instanceof` fallthrough — ambiguous.

**Before (`verify.server.ts:87-90`):**
```ts
throw new Error(
  "Auth is disabled (VITE_AUTH_ENABLED=false) but DATABASE_URL is set — " +
    "refusing to fall back to the shared dev user against a real database.",
);
```
**After:** new `export class AuthMisconfigurationError extends Error { readonly status = 500; }`
(`verify.server.ts:45-57`), thrown at `:101-105`. Message text unchanged (still the loud explanatory string);
the class mirrors the existing `UnauthorizedError` pattern so handlers can branch on `err.status` (500 vs 401)
and on `instanceof` alike. Additive export; nothing imports `verify.server.ts` in the three legacy suites.

---

## Files modified

1. `src/lib/auth/verify.server.ts` — H: `AuthMisconfigurationError` class (`:45-57`), throw site (`:101`).
2. `src/lib/app-data/login.ts` — A: framed/popup-blocked branch returns `false`, no iframe navigation (`:20-36`).
3. `src/lib/app-data/client.server.ts` — B: `tokenIdentityKey` hashes the full token (`:194-203`).
4. `src/lib/auth/client.ts` — F1: `event.source !== popup` correlation in `waitForPopupToken` (`:195`).
5. `src/lib/auth/gate-session.server.ts` — F2/G: `withMaterializationLock` (`:33-63`) + wrapped
   materialization region (`:261-346`); file reformatted with repo prettier (printWidth 100) after the wrap.
6. `src/lib/auth/isolation.server.ts` — D: documented headerless residual (header block `:17-31`, gate comment `:44-47`).
7. `src/lib/app-data/app-data.test.ts` — updated the two pins that asserted the buggy contracts
   (memo remint-sharing `:68`; framed popup-blocked iframe-assign `:271`).

No new exports were consumed outside the owned files; no API-key plumbing, no new features.

## Verification

- `npm run typecheck` → **0 errors** (the single pre-existing `src/lib/engine.ts` error from the concurrent Pro
  wave cleared during this window; zero errors ever in owned files, re-checked after every edit).
- `node --experimental-strip-types --test src/lib/auth/gate-identity.test.ts src/lib/auth/sign-in-gate.test.ts
  src/lib/app-data/app-data.test.ts` → **45/45 pass, 0 fail** (gate-identity 33, sign-in-gate 3, app-data 9 by
  suite granularity; runner reports 45 tests / 12 suites).
- Not run (outside scope): `scripts/*.test.mjs`, browser smoke, app boot. Findings C/E intentionally skipped
  (`scripts/` ownership); the DB unique-index half of G intentionally skipped (`migrations/` ownership).

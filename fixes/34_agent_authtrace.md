# 34 — Agent AuthTrace: auth + preview-bridge end-to-end trace, fixes, sibling findings

Flash agent #8 (AUTH + BRIDGE TRACE + FIX). Scope edited: `src/lib/auth/*.ts`, `src/lib/ai.ts`, `src/lib/preview-host-bridge.ts` + test files only. Gates: `npm run typecheck` 0 ✓ · auth+bridge test glob 42/42 ✓ (`node --experimental-strip-types --test src/lib/auth/*.test.ts src/lib/preview-host-bridge.test.ts`).

## 1. Sign-in flow traced end-to-end

- **Route guard → gate**: `src/routes/__root.tsx` mounts `<AuthProvider>` (passthrough) + `<PreviewHostBridge/>`; there is **no route guard anywhere** — no consumer of `SignInGate`/`SignedIn`/`SignedOut`/`RedirectToSignIn`/`useCurrentUser(State)`/`UserButton` outside `src/lib/auth/` itself. No `/login` route exists (`SIGN_IN_PATH = "/login"` in gates.tsx:22 is a pointer to a route that does not exist). No server fn uses `authMiddleware`/`requireUserId`. Grep across `src/` for `@/lib/auth` → only `__root.tsx`.
- **Chain**: `client.ts authClient.useSession()` → `/api/auth/get-session` (cookie deployed; bearer in live preview, attached by `onRequest` from sessionStorage `grok-auth.bearer-token`) → `server.ts` Better Auth → `gateIdentitySessions()` before-hook (`gate-session.server.ts`) → `x-grok-identity` verified in `gate-identity.server.ts` (EdDSA, issuer/audience pinned, `maxTokenAge 10m`, JWKS cached 300s w/ refetch-on-miss) → `handleOAuthUserInfo` materializes user+account+session under a per-`sub` in-process lock → cookie emitted via TanStack `setCookie` + `responseHeaders` dual path + gate-session marker cookie → `use-current-user.ts` normalizes to `AppUser` → `gates.tsx` renders.
- **What breaks when unauthorized/expired/edge**:
  - Expired/revoked identity token → `verifyGateIdentityToken` null → hook logs, returns → BA resolves no session → signed-out UI. Fail-closed ✓.
  - Session cookie expires mid-SPA (deployed, 7d default; cookieCache 300s) → `/get-session` re-materializes from a fresh `x-grok-identity` (each proxied request carries one) — zero-click.
  - **Stale bearer masks a valid gate identity (preview restart)** — see Fix 2. This was the one real "expired/revoked" dead-end: PGLite sessions are wiped on process restart while the iframe's sessionStorage bearer survives; the bearer short-circuit skipped the gate path, so the visitor sat signed out until a manual popup re-sign-in even though the gate could materialize them.
  - **Empty/whitespace claims** — see Fix 1: `email: ""`/`name: "   "` passed through verification untouched and were persisted as blank values with `Boolean(" ")` = "verified".
  - Sign-out: `client.ts signOut()` → `scripts/sign-out-plan.mjs` (preview: local clear, best-effort server call, bounded 1.5s; deployed: server-confirmed or throw, 10s bound). Sound; no bug.
  - Popup races (`waitForPopupToken`) correctly bind `event.source === popup` + origin so concurrent attempts can't cross-settle.

## 2. Preview-host bridge traced

- **Mount**: `__root.tsx` → `components/preview-host-bridge.tsx` → `lib/preview-host-bridge.ts installPreviewHostBridge({navigate: router push, getRoutePaths})`. Noops unless parent origin passes `preview-embedder-origin.ts` trust model.
- **Outgoing**: `ready` (announce), `location` (path/search/hash), `routes` (static path list) — all `channel:"grok-preview-bridge", version:1`.
- **Incoming**: `hello` (re-announce), `navigate` (path; `isSafeBridgePath` + origin re-check before router push), `history` (±1 only; `history.go` blocked at the ROOT_STATE_KEY-tagged first entry so Back never leaves the preview). Unknown types silently dropped; wrong channel/version dropped.
- **Validation**: envelope zod-parse, `event.origin === parentOrigin`, `event.source === window.parent`, version pinned === 1. History methods patched to stamp root-ness + report location; dispose restores them.
- **Verdict**: `preview-host-bridge.ts` itself is sound in scope — the one real trust-model flaw lives in its sibling dependency `preview-embedder-origin.ts` (Finding S1). Bridge test file covers path safety/route collection/embedder model but nothing exercises `installPreviewHostBridge` itself (needs DOM; node tests can't) — coverage gap, registered.

## 3. ai.ts audit

`ai.ts` is a 16-line deliberate shim: RETIRED x.ai `VITE_*` wiring replaced by `llm.ts` (DeepSeek server-side key). All 4 re-exports (`complete`, `llmStatus`, `LlmModel`, `LlmResult`) verified present in `llm.ts`; **zero importers** (absolute or relative — grepped). Not stale, not buggy; header comment accurate. Keep as-is: deleting it would turn a graceful stale-import resolve into a hard break. Registered, no change.

## 4. Bugs fixed (mine)

1. **gate-identity.server.ts:117-134 — whitespace/empty identity claims pass verification** (`verifyGateIdentityToken` returned `payload.email`/`name`/`team_id` verbatim). Fix: `optionalString` — trim, empty/whitespace-only → `null`. Downstream (`gateIdentityUserInfo`) then falls back to the synthetic email / `"Grok user"` instead of persisting `""`/`"   "` (blank display name; empty-string email that `Boolean(" ")` marks "verified" and collides across identities / unique index). Tests: `gate-identity.test.ts:184` (collapse) + `:208` (trim).
2. **gate-session.server.ts:256-284 — stale bearer masks a valid gate identity** (`/get-session` before-hook skipped the entire gate path whenever `Authorization` was present, trusting the comment "already carries a session"). After a preview process restart PGLite session rows are gone but the iframe's sessionStorage bearer survives → gate never materialized → permanent signed-out until manual popup re-sign-in. Fix: when `x-grok-identity` is ALSO present, probe the bearer via `internalAdapter.findSession` (existence verified in installed better-auth `dist/db/internal-adapter.mjs`); live bearer → skip as before (popup-chosen identity authoritative); stale → fall through to gate materialization. No gate header → unchanged fast path. If `findSession` is unavailable → log + old behavior (fail-safe, no session churn). **Not unit-testable** here (needs a full Better Auth ctx) — review-grade, logic documented inline.
3. Future-`iat` "hole" — hypothesized, then **empirically disproven**: jose `maxTokenAge` already rejects any future `iat` (probe: rejected at +5s, `ERR_JWT_CLAIM_VALIDATION_FAILED`). No patch (comment added at gate-identity.server.ts:121 documenting the finding). Note: zero skew tolerance is a pre-existing platform constraint — a gate issuer clock running ahead of the app server bricks all gate tokens (fail-closed; acceptable).

## 5. Sibling-file findings (register only — NOT edited)

- **S1 [preview-embedder-origin.ts:61-65] — sandbox-guest clause trusts ANY parent origin.** `resolveParentEmbedderOrigin` returns `url.origin` when `isSandboxPreviewGuestHost(guestHostname)` is true, with no constraint on the candidate URL — so a `*.grok-sandbox.com` guest trusts any http/https parent (incl. `https://evil.com`, plaintext `http://…`), contradicting the module's own trust-model comment ("may additionally be paired with a same-suffix parent host"). Impact today is limited (preview URLs are unguessable per-session; worst case a framer steers the app's own routes via `navigate`/`history` and reads `location`), but it is a defense-in-depth break and a plaintext-downgrade hole. Suggested fix: replace the disjunct with `isGrokEmbedderOrigin(candidate) || (https-only && (isSandboxPreviewGuestHost(candidateHost) || isRemintPreviewPair(guestHostname, candidateHost)))`. **Belongs to whoever owns `preview-embedder-origin.ts`** (outside my file set).
- **S2 [routes, whole app] — zero auth consumers.** No route guard, no `/login` route, no `SignInGate`/`useCurrentUser` consumer, no `authMiddleware` on any server fn, no 401/`Unauthorized` handling in routes/components. Auth is platform plumbing, fully dormant (`VITE_AUTH_ENABLED=false` default). Nothing *breaks* today, but the first server fn that adopts `authMiddleware` must handle `UnauthorizedError` (message contract `"Unauthorized"`); `SIGN_IN_PATH` has no matching route yet.
- **S3 [console.tsx read-only] — no auth or bridge references at all**; console flow unaffected by identity state. Nothing to fix there; register for the record.
- **S4 [components/preview-host-bridge.tsx] — clean**: single `useEffect`, dispose returned, `[router]` dep stable. No issue.
- **S5 [gate-session.server.ts:210-217 residual] — marker clear inconsistency (minor, pre-existing):** `clearGateMarkerIfPresent` runs only when neither authorization nor gate header is present; a stale-bearer + no-header request leaves a stale gate marker set. Effect: sign-out control stays hidden for a session that can't re-materialize. Low impact; left as-is to avoid churn in the just-patched block.
- **S6 [client.ts signIn hash mismatch (minor, pre-existing)]:** callbackURL comparison ignores `hash`, so `callbackURL: "/#section"` from an already-matching path never applies the hash. Cosmetic; left.

## 6. Verification

- `npm run typecheck` → 0 errors (post-patch, full project).
- `node --experimental-strip-types --test src/lib/auth/*.test.ts src/lib/preview-host-bridge.test.ts` → **42 pass / 0 fail** (baseline 40 + 2 new normalization tests).
- jose future-iat probe (throwaway script, deleted) documented the no-patch decision.

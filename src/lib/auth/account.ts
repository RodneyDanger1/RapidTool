/**
 * The app's per-user server function (Decision D3 · B2-F3).
 *
 * This is the real call site that makes `authMiddleware` load-bearing: before
 * this module the middleware and `requireUserId` had ZERO importers, so the
 * "invariant" was never exercised by a request. `fetchVerifiedAccount` runs
 * through `authMiddleware`, whose server hook calls `assertSameSiteRequest()`
 * then `requireUserId()` — an unauthenticated request is rejected with
 * `UnauthorizedError` (status 401) BEFORE this handler body runs. The handler
 * therefore never sees a client-supplied id: it returns the id/email the server
 * resolved from the request session.
 *
 * With auth disabled (`VITE_AUTH_ENABLED=false`, the shipped default) the
 * middleware resolves the shared dev user, so this returns `dev-user` — the SAME
 * id `verify.server.ts` hands every other dev-user surface. A single-user local
 * tool must not demand a login, so the disabled path stays exactly as it was.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "./middleware.ts";

export type VerifiedAccount = {
  /** The verified user id — `context.userId`, never a client value. */
  userId: string;
  /** The verified email, or null (dev path / an identity without an email). */
  email: string | null;
};

export const fetchVerifiedAccount = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<VerifiedAccount> => {
    return { userId: context.userId, email: context.email };
  });

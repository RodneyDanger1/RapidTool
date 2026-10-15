import { Navigate, createFileRoute } from "@tanstack/react-router";
import { SignInButtons, SignInGate } from "@/lib/auth/gates.tsx";

/**
 * The real sign-in route (Decision D3 · B2-F2). `gates.SIGN_IN_PATH` points
 * here, and `__root.tsx`'s `AuthGate` redirects a signed-out visitor here when
 * `VITE_AUTH_ENABLED` is on, so `SIGN_IN_PATH` is a route that actually exists
 * instead of the 404 screen.
 *
 * Already signed in (or auth disabled, where `useCurrentUserState` resolves the
 * dev user) -> `<Navigate to="/" />`. Signed out -> the provider buttons.
 * Still resolving the session -> `SignInGate` renders nothing, so there is no
 * signed-out flash before the real state is known.
 */
export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "RapidTool — Sign in" }] }),
});

function LoginPage() {
  return (
    <main id="main-content" className="grid min-h-dvh place-items-center bg-bg px-6 py-12">
      <SignInGate fallback={<SignInCard />}>
        <Navigate to="/" />
      </SignInGate>
    </main>
  );
}

function SignInCard() {
  return (
    <div className="w-full max-w-sm">
      <h1 className="text-xl font-medium tracking-tight text-fg">Sign in to RapidTool</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        RapidTool runs its own sign-in and keeps your session on this origin. Pick a provider to
        continue.
      </p>
      <div className="mt-5">
        <SignInButtons />
      </div>
    </div>
  );
}

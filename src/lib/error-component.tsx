import type { ErrorComponentProps } from "@tanstack/react-router";
import { ArrowLeft, RotateCcw, TriangleAlert } from "lucide-react";
import { markBoundaryError, reportRt } from "./rt-client.ts";

const MAX_MESSAGE_CHARS = 500;

/**
 * Best-effort human message for whatever the error boundary caught. Handles
 * Error instances, thrown strings, and plain objects with a `message` field —
 * router/server boundaries can surface serialized plain-object errors and
 * render code may `throw { message }`, so duck-typing beats `instanceof` here.
 * Never stringifies non-message values into "[object Object]" and never
 * returns a message that is only whitespace.
 */
function messageOf(error: unknown): string | null {
  if (typeof error === "string") {
    const t = error.trim();
    return t === "" ? null : t;
  }
  if (error instanceof Error) {
    const t = error.message.trim();
    return t === "" ? null : t;
  }
  if (error !== null && typeof error === "object") {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string") {
      const t = m.trim();
      if (t !== "") return t;
    }
  }
  return null;
}

/** Truncate on code-point boundaries so a split surrogate pair never leaks a
 *  lone half of a multi-code-unit character into the rendered message. */
function clipMessage(message: string): string {
  const units = Array.from(message);
  if (units.length <= MAX_MESSAGE_CHARS) return message;
  return `${units.slice(0, MAX_MESSAGE_CHARS).join("").trimEnd()}…`;
}

/**
 * Router-level error boundary content. Wired in `src/router.tsx` as
 * `defaultErrorComponent` so any route render/load error lands here instead
 * of a blank screen. Never leaks a raw stack: long messages are truncated and
 * the user gets a reload path back into the app.
 *
 * SH-2: themed with the app's own tokens (`bg-bg`/`text-fg`/`text-danger`) so
 * the error/not-found states match the dark shell instead of hard-coded zinc.
 */
export function AppErrorComponent({ error }: ErrorComponentProps) {
  // CAP-2: report the boundary crash into the runtime ring BEFORE rendering
  // the fallback — the dev re-bubble to window.onerror is deduped by
  // markBoundaryError, so exactly one telemetry row lands.
  try {
    if (markBoundaryError(error)) {
      reportRt({
        level: "critical",
        scope: "ui-render",
        event: "ui.boundary_crash",
        message: messageOf(error) ?? "Route render crashed.",
        capture: "src/lib/error-component.tsx:AppErrorComponent",
        err: error,
      });
    }
  } catch {
    /* the reporter must never take the boundary down with it */
  }
  const message = messageOf(error);
  const shown =
    message === null ? null : clipMessage(message);

  return (
    <main
      id="main-content"
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg"
    >
      <span className="text-danger" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md break-words text-sm text-muted">
        {shown ?? "An unexpected error occurred. Try reloading the page."}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-md bg-fg px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Reload
        </button>
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-fg transition-colors hover:border-accent/40"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to home
        </a>
      </div>
    </main>
  );
}

/**
 * Router-level not-found content. Wired both on the root route
 * (`__root.tsx` `notFoundComponent`) and as the router default, so an
 * unmatched URL renders inside the app shell instead of a blank page.
 */
export function AppNotFoundComponent() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg"
    >
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="max-w-md text-sm text-muted">
        The address you opened doesn’t match any RapidTool screen.
      </p>
      <a
        href="/"
        className="mt-2 inline-flex items-center gap-2 rounded-md bg-fg px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to home
      </a>
    </main>
  );
}

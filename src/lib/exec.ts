// ---------------------------------------------------------------------------
// exec.ts — client-facing bounded code runner (honest {ok:false, reason} shape).
//
// Thin wrapper over node-runner.server.ts's local bounded runner. It returns a
// typed, non-throwing result and maps every failure to an explicit reason AND
// a machine-readable `code` an AI agent can branch on:
//   • reason "not-configured" + code RT_E_RUNNER_UNAVAILABLE — the local
//     runner is unavailable in this environment;
//   • reason "refused"        + code RT_E_VALIDATION — the input is not
//     runnable (empty / non-string source, invalid timeoutMs);
//   • reason "timeout"        + code RT_E_RUNNER_FAILED — the run hit the
//     wall-clock cap and was killed;
//   • reason "error"          + code RT_E_RUNNER_FAILED (the runner itself
//     failed: spawn / kill) or RT_E_INTERNAL (the server round-trip broke).
//
// This is a bounded runner, NOT a security sandbox — see node-runner.server.ts
// for the honest boundary. The `runner` option is dependency injection for
// tests only; production callers must never pass it.
// ---------------------------------------------------------------------------
import { createServerFn } from "@tanstack/react-start";

export type ExecResult =
  | { ok: true; stdout: string; stderr: string; durationMs: number; exitCode: number }
  | {
      ok: false;
      reason: "not-configured";
      code: "RT_E_RUNNER_UNAVAILABLE";
      error?: string;
    }
  | { ok: false; reason: "refused"; code: "RT_E_VALIDATION"; error?: string }
  | { ok: false; reason: "timeout"; code: "RT_E_RUNNER_FAILED"; error?: string }
  | {
      ok: false;
      reason: "error";
      code: "RT_E_RUNNER_FAILED" | "RT_E_INTERNAL";
      error?: string;
    };

export type RunnerFn = (code: string, opts?: { timeoutMs?: number }) => Promise<ExecResult>;

const runServer = createServerFn({ method: "POST" })
  .validator((input: { code: string; timeoutMs?: number }) => input)
  .handler(async ({ data }) => {
    const { runNodeBounded, runnerAvailable } = await import(
      "./node-runner.server.ts"
    );
    if (!runnerAvailable()) {
      return {
        ok: false,
        reason: "not-configured",
        code: "RT_E_RUNNER_UNAVAILABLE",
        error: "local bounded runner unavailable in this environment",
      } as const;
    }
    return runNodeBounded(data.code, { timeoutMs: data.timeoutMs });
  });

export async function runCode(
  code: string,
  opts?: { timeoutMs?: number; runner?: RunnerFn | null },
): Promise<ExecResult> {
  if (typeof code !== "string" || code.trim().length === 0) {
    return {
      ok: false,
      reason: "refused",
      code: "RT_E_VALIDATION",
      error: "empty source",
    };
  }
  // A non-positive / non-finite timeoutMs would silently become the 30 s
  // default inside the runner — refuse it explicitly instead of surprising
  // the caller with a hang of an unknown length.
  const t = opts?.timeoutMs;
  if (t !== undefined && (typeof t !== "number" || !Number.isFinite(t) || t <= 0)) {
    return {
      ok: false,
      reason: "refused",
      code: "RT_E_VALIDATION",
      error: "timeoutMs must be a positive finite number",
    };
  }
  // Test/dev dependency injection: a caller-provided runner bypasses the server round-trip.
  if (opts?.runner !== undefined) {
    return opts.runner
      ? opts.runner(code, { timeoutMs: opts.timeoutMs })
      : {
          ok: false,
          reason: "not-configured",
          code: "RT_E_RUNNER_UNAVAILABLE",
          error: "local bounded runner unavailable in this environment",
        };
  }
  try {
    return await runServer({ data: { code, timeoutMs: opts?.timeoutMs } });
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      code: "RT_E_INTERNAL",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

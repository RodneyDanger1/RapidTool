/**
 * Provider model PROBE (F2 · W19-L5 — fixes/252) — "a probe, not a promise".
 *
 * `research/multiagent/221_feature_designs.md` §F2 item 2 + `101_provider_integration.md`
 * §4.6 rules, implemented verbatim against a registry descriptor's own
 * `verification.modelsEndpoint` (probed live 2026-09-24 for xAI — see
 * `./openai-compatible.ts`'s header for the raw evidence):
 *
 *   1. 3 s HARD CAP on network time (`resolveProbeTimeoutMs` — a caller may ask
 *      for less, never more).
 *   2. NEVER THROWS: doctor/host surfaces must stay never-throwing, so every
 *      failure comes back as an honest result object with a code.
 *   3. `configured` (credential present) is reported SEPARATELY from
 *      `reachable`/`authenticated` (probe outcome). Status ≥ 400 is NEVER
 *      "reachable"; a 200 with an empty model list is reachable and
 *      authenticated but NOT usable.
 *   4. Keyless ⇒ `configured:false` + `RT_E_LLM_NOT_CONFIGURED` with ZERO
 *      network I/O (mirror of the provider keyless floor, deepseek.ts:320-324).
 *   5. Failure is NEVER cached — and, deliberately, this module caches NOTHING
 *      at all: every call performs its own I/O. A stale "verified" stamp is as
 *      dishonest as a fake one (221's own risk note, RESUME §5.4), and until a
 *      consumer owns a TTL policy, a no-cache probe is the honest floor. The
 *      success path's model ids are read back from the vendor's OWN response —
 *      never from a static list, never from us.
 *   6. A descriptor without a live-probe endpoint is refused as a probe target
 *      (`RT_E_VALIDATION`): DeepSeek's verification is `static` and mock's is
 *      absent — probing them here would be a fake "reachable" claim.
 *
 * Server-only module (reads `process.env` at CALL time; no `node:fs`, no
 * import-time env read, no key value ever echoed into a result).
 */

import { classifyError } from "../../errors.ts";
import type { ErrorCode } from "../../errors.ts";
import type { LlmProviderDescriptor } from "./registry.ts";

/** Hard cap on a probe's network budget — 101 §4.6: "timeout 3 s (matches
 *  probeTavily's 3 s cap)". */
export const PROBE_TIMEOUT_MS = 3_000;

/** The honest result of one probe attempt. `models` is non-empty ONLY for a
 *  200 whose body carried readable ids; `status` is `null` when no request
 *  left the machine (keyless, or no probe endpoint declared). */
export type ProviderProbeResult = {
  readonly id: string;
  /** Credential present for this provider's `apiKeyEnv` (read server-side; the
   *  value is never echoed). */
  readonly configured: boolean;
  /** The probe answered HTTP 200. Status ≥ 400 is never reachable. */
  readonly reachable: boolean;
  /** The credential was presented and the vendor accepted it (200). */
  readonly authenticated: boolean;
  /** HTTP status of the probe request, `null` when no I/O was performed. */
  readonly status: number | null;
  /** Model ids READ BACK from the vendor's own response (never hardcoded). */
  readonly models: readonly string[];
  /** When the probe ran (ISO-8601). */
  readonly probedAt: string;
  /** One honest line about the outcome — never claims more than the result. */
  readonly note: string;
  /** Machine-readable class on refusals (errors.ts); absent on success. */
  readonly code?: ErrorCode;
};

export type ProviderProbeOptions = {
  /** Injectable transport (tests pin the matrix without touching the network). */
  fetch?: typeof fetch;
  /** Injectable env (defaults to `process.env`). */
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  /** Requested timeout — clamped to `PROBE_TIMEOUT_MS`. */
  timeoutMs?: number;
  /** Injectable clock for `probedAt` (tests pin the stamp). */
  now?: () => number;
};

/** Clamp a caller's timeout request into the probe's honest budget: anything
 *  non-finite/non-positive counts as UNSET; the 3 s cap can never be raised. */
export function resolveProbeTimeoutMs(requested?: number): number {
  if (typeof requested !== "number" || !Number.isFinite(requested) || requested <= 0) {
    return PROBE_TIMEOUT_MS;
  }
  return Math.min(Math.floor(requested), PROBE_TIMEOUT_MS);
}

function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return true;
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "AbortError"
  );
}

/** Read a response body ONCE and produce a bounded, whitespace-collapsed
 *  excerpt — a gateway HTML page or plain-text refusal stays VISIBLE in the
 *  note instead of vanishing (same discipline as the providers' describeError). */
async function boundedExcerpt(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  const flat = raw.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  return flat.length > 200 ? `: ${flat.slice(0, 200)}…` : `: ${flat}`;
}

/**
 * Contain the injectable clock seam (R4-f09 · W39·B4): this module is
 * documented never-throwing, but `opts.now` is caller-supplied — a broken or
 * hostile hook (NaN / Infinity / a thrower) must yield the real clock instead
 * of a RangeError escaping BEFORE the try below. A non-finite result can never
 * become `probedAt`.
 */
function safeNow(now?: () => number): number {
  try {
    const t = (now ?? Date.now)();
    return typeof t === "number" && Number.isFinite(t) ? t : Date.now();
  } catch {
    return Date.now();
  }
}

/**
 * Probe one provider: `GET <descriptor.verification.modelsEndpoint>` with the
 * family's bearer key. Never throws; never caches; never invents an id.
 */
export async function probeProviderModels(
  descriptor: LlmProviderDescriptor,
  opts: ProviderProbeOptions = {},
): Promise<ProviderProbeResult> {
  const env = opts.env ?? process.env;
  const probedAt = new Date(safeNow(opts.now)).toISOString();
  const keyEnv = typeof descriptor.apiKeyEnv === "string" ? descriptor.apiKeyEnv : "";
  const key = keyEnv ? String(env[keyEnv] ?? "").trim() : "";
  const endpoint =
    descriptor.verification && descriptor.verification.kind === "live-probe"
      ? descriptor.verification.modelsEndpoint
      : "";

  const result = (
    partial: Partial<ProviderProbeResult> & Pick<ProviderProbeResult, "note">,
  ): ProviderProbeResult => ({
    id: descriptor.id,
    configured: Boolean(key),
    reachable: false,
    authenticated: false,
    status: null,
    models: [],
    probedAt,
    ...partial,
  });

  if (!endpoint) {
    return result({
      note:
        `"${descriptor.id}" declares no live-probe endpoint — its model ids cannot be probed from this host ` +
        "(probe only where the descriptor names one; never a fake reachability claim)",
      code: "RT_E_VALIDATION",
    });
  }

  if (!key) {
    return result({
      note: `no ${keyEnv || "API key"} set — configured:false with ZERO network I/O (the provider's keyless floor)`,
      code: "RT_E_LLM_NOT_CONFIGURED",
    });
  }

  const timeoutMs = resolveProbeTimeoutMs(opts.timeoutMs);
  const fetchImpl = opts.fetch ?? ((...args) => fetch(...args));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(endpoint, {
      method: "GET",
      headers: { accept: "application/json", authorization: `Bearer ${key}` },
      signal: controller.signal,
    });

    if (!res.ok) {
      const excerpt = await boundedExcerpt(res);
      return result({
        status: res.status,
        note: `probe failed: HTTP ${res.status}${excerpt} — status ≥ 400 is never "reachable"; the failure is not cached`,
        code: "RT_E_LLM_REJECTED",
      });
    }

    const raw = await res.text().catch(() => "");
    let ids: string[] = [];
    let shapeNote = "";
    try {
      const body: unknown = JSON.parse(raw);
      const data =
        body !== null && typeof body === "object" && !Array.isArray(body)
          ? (body as { data?: unknown }).data
          : undefined;
      if (Array.isArray(data)) {
        const seen: string[] = [];
        for (const entry of data) {
          const id =
            entry !== null && typeof entry === "object" && typeof (entry as { id?: unknown }).id === "string"
              ? (entry as { id: string }).id.trim()
              : "";
          if (id && !seen.includes(id)) seen.push(id);
        }
        ids = seen;
      } else {
        shapeNote = " (200 body carried no `data` array — no ids could be read back)";
      }
    } catch {
      return result({
        reachable: true,
        authenticated: true,
        status: res.status,
        note: `probe answered HTTP ${res.status} with a non-JSON body — the credential was accepted but no ids could be read back (not cached)`,
        code: "RT_E_INTERNAL",
      });
    }

    if (ids.length === 0) {
      return result({
        reachable: true,
        authenticated: true,
        status: res.status,
        models: [],
        note: `authenticated, but the vendor listed ZERO models${shapeNote} — reachable is NOT usable; register nothing from this probe`,
      });
    }
    return result({
      reachable: true,
      authenticated: true,
      status: res.status,
      models: ids,
      note: `read back ${ids.length} model id(s) from the vendor's own response (never hardcoded; never cached)`,
    });
  } catch (err) {
    if (isAbortError(err)) {
      return result({
        note: `probe timed out after ${timeoutMs}ms (hard cap ${PROBE_TIMEOUT_MS}ms) — never throws, failed probes are never cached`,
        code: "RT_E_LLM_TIMEOUT",
      });
    }
    return result({
      note: `probe failed: ${err instanceof Error ? err.message : String(err)} — never throws, failed probes are never cached`,
      code: classifyError(err, "RT_E_LLM_REJECTED"),
    });
  } finally {
    clearTimeout(timer);
  }
}

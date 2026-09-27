// ---------------------------------------------------------------------------
// T5.7 (fixes/217c §2.6; dossier 103 A8) — the deterministic LLM cassette:
// record real model traffic to a tape, replay it byte-identically, and REFUSE
// a miss with a coded error instead of ever fabricating text.
//
// Why: a keyed run is inherently irreproducible today — the eval harness
// re-calls the API on every run (103:176). A tape turns one real entry into a
// deterministic fixture, keyed by the canonical input hash (the same FNV-1a
// the repo uses for every evidence hash — 217c §T5.7 anchor; `fnv1a` from
// `./algorithms.ts`).
//
// DOCTRINE (mirrors `./llm/providers/mock.ts`, the landed injection half of
// the same row — a mock LLM *is* a replay fixture):
//   1. NEVER on by default. An unset/blank env selection yields an INERT
//      cassette whose `wrap()` returns the transport untouched — the wrapper
//      IS the transport, provably byte-identical behavior. Only an explicit
//      constructor call or the EXACT env values below arm it.
//   2. NEVER fabrication. A tape miss (no entry) or a hash-collision guard
//      trip is a CODED refusal (`CASSETTE_MISS_CODE`) carrying the key — no
//      text, no template, no "sensible default" envelope. A recorded refusal
//      envelope replays as that same refusal.
//   3. NEVER a silent replacement. Replay stamps T5.4 provenance with
//      `producer: "replay"` (fixes/249 declared the vocabulary; "replay" was
//      reserved for exactly this lane) so a downstream artifact says it came
//      from a tape rather than passing as a live run.
//
// T5.4 CONSUMPTION (fixes/249_lane5_t54.md §"Exact field names"): entries mint
// `ArtifactProvenance = { producer, model?, timestamp, inputHash }` with
//   - producer : "model" on record (an LLM call produced it), "replay" on
//     replay — both from the closed `ARTIFACT_PRODUCERS` set;
//   - model    : the model id ACTUALLY served, read off the returned envelope
//     (never the requested id) — so an ok:false envelope mints NO stamp at all
//     (nothing was produced, no model was served; absent = honest unknown);
//   - timestamp: injected `now()` (epoch ms) at the producing write;
//   - inputHash: the cassette key = String(fnv1a(canonical request)).
// Validation uses io.ts's own `coerceArtifactProvenance` (the T5.4 boundary),
// so cassette stamps can never drift from the serializer's law: a
// `producer:"model"` stamp without a served model id is a contradiction the
// T5.4 validator refuses, and this module cannot mint one.
//
// TAPE = DATA, NOT CODE: tapes carry real prompts and may contain brief
// content. Write them under a run directory, never into `src/` (217c blast
// radius note). The tape file is created only at an explicit path.
//
// NOT in this module (separable remainders, 217c §T5.7 items 4-5): wiring the
// wrapper into `llm/providers/registry.ts` `callModel`, the run-eval
// `--record`/`--replay` flags, CLI flags, and the README note. Nothing in the
// pipeline imports this module today, so the keyless `npm run eval` leg and
// every existing suite are byte-identical by construction (pinned by
// `cassette.test.ts`'s wiring scan).
// ---------------------------------------------------------------------------

import { fnv1a } from "./algorithms.ts";
import { classifyError, ERROR_CODES } from "./errors.ts";
import type { ErrorCode } from "./errors.ts";
import { coerceArtifactProvenance } from "./io.ts";
import type { ArtifactProducer, ArtifactProvenance } from "./io.ts";
import type { LlmResult } from "./llm.ts";
import type { DeepSeekCompleteOptions } from "./llm/providers/deepseek.ts";

// ---------------------------------------------------------------------------
// Vocabulary + env selection (exact values only — the mock's discipline)
// ---------------------------------------------------------------------------

/** Closed mode set. "off" is the unset-equivalent: an inert cassette. */
export const CASSETTE_MODES = ["off", "record", "replay"] as const;
export type CassetteMode = (typeof CASSETTE_MODES)[number];

/** Env half of explicit selection: the mode. Unset/blank/"off" = inert. */
export const CASSETTE_MODE_ENV = "RAPIDTOOL_CASSETTE_MODE";

/** Env half of explicit selection: the tape file the mode reads/writes. */
export const CASSETTE_TAPE_ENV = "RAPIDTOOL_CASSETTE_TAPE";

/** The tape's on-disk format version (a mismatched tape fails closed at load). */
export const CASSETTE_VERSION = 1;

/**
 * The coded refusal a tape miss returns.
 *
 * `RT_E_LLM_REJECTED` is the registry's existing "the model side refused to
 * serve this call" code — the same code the mock provider returns when its
 * fixture queue cannot serve. A dedicated `RT_E_CASSETTE_MISS` would be an
 * additive registration in `src/lib/errors.ts` (outside this lane's box);
 * flipping this one constant plus the registry entry is the whole change, and
 * the miss detail already carries a stable `cassette miss:` prefix so
 * consumers can branch on the prose today.
 */
export const CASSETTE_MISS_CODE: ErrorCode = "RT_E_LLM_REJECTED";

// ---------------------------------------------------------------------------
// The canonical request — what the tape is keyed by
// ---------------------------------------------------------------------------

/** One prior turn, as the tape stores it (deepseek.ts `DeepSeekMessage` shape). */
export type CassetteMessage = { role: "user" | "assistant"; content: string };

/**
 * The semantic request subset the tape is keyed by. Deliberately EXCLUDES
 * transport seams (`fetch`/`sleep`/`random`/`timeoutMs`): they change HOW a
 * call is made, never WHAT is asked, so a tape recorded under one set of test
 * seams replays under another.
 */
export type CassetteRequest = {
  prompt: string;
  /** The resolved model id the call was issued for (opts.model), if any. */
  model?: string;
  system?: string;
  maxTokens?: number;
  json?: boolean;
  thinking?: boolean;
  history?: readonly CassetteMessage[];
};

/**
 * The canonical projection actually stored + hashed. Only these fields, in
 * this order, are ever stringified — so the key is independent of a caller's
 * object key order and of fields the provider treats identically:
 *   - `json: false` ≡ omitted (both send the non-JSON body);
 *   - `thinking: true` ≡ omitted (deepseek.ts:168: "Omitted (or `true`) keeps
 *     the per-tier default ... BYTE-IDENTICAL"); `thinking: false` is a
 *     distinct forced shape and stays distinct.
 * `history` is kept whole and order-preserving: the key must never conflate
 * two caller inputs the provider would send as different bytes.
 */
export type CanonicalRequest = {
  prompt: string;
  model: string | null;
  system: string | null;
  maxTokens: number | null;
  json: boolean;
  thinking: "default" | "off";
  history: CassetteMessage[];
};

/** Project a caller request onto the canonical form (pure; field order fixed). */
export function canonicalizeRequest(req: CassetteRequest): CanonicalRequest {
  return {
    prompt: req.prompt,
    model: req.model ?? null,
    system: req.system ?? null,
    maxTokens: req.maxTokens ?? null,
    json: req.json === true,
    thinking: req.thinking === false ? "off" : "default",
    history: (req.history ?? []).map((m) => ({ role: m.role, content: m.content })),
  };
}

/**
 * Stable stringify of a canonical request: reconstructs the declared fields in
 * the declared order, so a stored entry round-trips to identical bytes no
 * matter how the tape file happened to order its keys (the collision guard and
 * the load-time integrity check both compare this string).
 */
export function canonicalJson(c: CanonicalRequest): string {
  return JSON.stringify({
    prompt: c.prompt,
    model: c.model,
    system: c.system,
    maxTokens: c.maxTokens,
    json: c.json,
    thinking: c.thinking,
    history: c.history.map((m) => ({ role: m.role, content: m.content })),
  });
}

/** The exact bytes the key hashes. */
export function canonRequest(req: CassetteRequest): string {
  return canonicalJson(canonicalizeRequest(req));
}

/** The tape's lookup key: FNV-1a (32-bit, stringified) of the canonical request. */
export function cassetteKey(req: CassetteRequest): string {
  return String(fnv1a(canonRequest(req)));
}

// ---------------------------------------------------------------------------
// Tape shape + serialization
// ---------------------------------------------------------------------------

/** One recorded call. `provenance` is absent on a recorded refusal (see header). */
export type CassetteEntry = {
  /** Stringified FNV-1a of `canonicalJson(request)` — verified at load. */
  key: string;
  /** The canonical request, stored verbatim (collision guard + inspection). */
  request: CanonicalRequest;
  /** The envelope exactly as the live transport returned it. */
  response: LlmResult;
  /** T5.4 stamp minted at record time (producer "model"); absent on refusals. */
  provenance?: ArtifactProvenance;
};

export type CassetteTape = {
  version: number;
  /** Optional human label (e.g. the run/corpus slug a tape was recorded for). */
  label?: string;
  entries: CassetteEntry[];
};

function serializeTape(tape: CassetteTape): string {
  return JSON.stringify(tape, null, 2) + "\n";
}

// ---------------------------------------------------------------------------
// Stores — the tape read/write seam (injectable; file store imports fs lazily)
// ---------------------------------------------------------------------------

/**
 * Where a tape lives. `read()` returns the raw text, or `null` for "no tape
 * present" (an empty tape — every replay call then refuses with a miss).
 */
export type CassetteStore = {
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
};

/**
 * File-backed store. `node:fs`/`node:path` are imported LAZILY inside the
 * methods (the repo's fs seam rule, AGENTS.md §working rules) so merely
 * importing this module never pulls a filesystem module into a bundle.
 * The parent directory is created on first write.
 */
export function createFileCassetteStore(tapePath: string): CassetteStore {
  return {
    async read(): Promise<string | null> {
      const { readFile } = await import("node:fs/promises");
      try {
        return await readFile(tapePath, "utf8");
      } catch (err) {
        if ((err as { code?: unknown }).code === "ENOENT") return null;
        throw err;
      }
    },
    async write(text: string): Promise<void> {
      const { mkdir, writeFile } = await import("node:fs/promises");
      const { dirname } = await import("node:path");
      await mkdir(dirname(tapePath), { recursive: true });
      await writeFile(tapePath, text, "utf8");
    },
  };
}

/** In-memory store (tests + in-process replay); no filesystem at all. */
export function createMemoryCassetteStore(initial: string | null = null): CassetteStore {
  let text: string | null = initial;
  return {
    async read(): Promise<string | null> {
      return text;
    },
    async write(next: string): Promise<void> {
      text = next;
    },
  };
}

// ---------------------------------------------------------------------------
// Load validation — fail closed, never repair a tape silently
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isErrorCode(s: string): s is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(s);
}

function validateCanonicalRequest(v: unknown): CanonicalRequest | null {
  if (!isPlainObject(v)) return null;
  if (typeof v.prompt !== "string") return null;
  if (v.model !== null && typeof v.model !== "string") return null;
  if (v.system !== null && typeof v.system !== "string") return null;
  if (v.maxTokens !== null && (typeof v.maxTokens !== "number" || !Number.isFinite(v.maxTokens))) return null;
  if (typeof v.json !== "boolean") return null;
  if (v.thinking !== "default" && v.thinking !== "off") return null;
  if (!Array.isArray(v.history)) return null;
  const history: CassetteMessage[] = [];
  for (const m of v.history) {
    if (!isPlainObject(m)) return null;
    if (m.role !== "user" && m.role !== "assistant") return null;
    if (typeof m.content !== "string") return null;
    history.push({ role: m.role, content: m.content });
  }
  return {
    prompt: v.prompt,
    model: v.model,
    system: v.system,
    maxTokens: v.maxTokens,
    json: v.json,
    thinking: v.thinking,
    history,
  };
}

function validateResponse(v: unknown): LlmResult | null {
  if (!isPlainObject(v)) return null;
  if (v.ok === true) {
    if (typeof v.text !== "string") return null;
    if (typeof v.model !== "string" || v.model.trim().length === 0) return null;
    const usage = v.usage;
    if (usage === undefined) return { ok: true, text: v.text, model: v.model };
    if (!isPlainObject(usage)) return null;
    if (typeof usage.promptTokens !== "number" || typeof usage.completionTokens !== "number") return null;
    return {
      ok: true,
      text: v.text,
      model: v.model,
      usage: { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens },
    };
  }
  if (v.ok === false) {
    if (v.reason !== "not-configured" && v.reason !== "error") return null;
    if (v.error !== undefined && typeof v.error !== "string") return null;
    if (v.code !== undefined && (typeof v.code !== "string" || !isErrorCode(v.code))) return null;
    return {
      ok: false,
      reason: v.reason,
      ...(typeof v.error === "string" ? { error: v.error } : {}),
      ...(typeof v.code === "string" ? { code: v.code } : {}),
    };
  }
  return null;
}

type TapeParse = { ok: true; tape: CassetteTape } | { ok: false; error: string };

/**
 * Parse + validate tape text. Any defect is a refusal detail (the caller wraps
 * it in a coded result): a corrupt tape is NEVER treated as an empty one — that
 * would silently turn a recorded run into a wall of misses.
 */
function parseTape(text: string | null, label: string): TapeParse {
  if (text === null) return { ok: true, tape: { version: CASSETTE_VERSION, entries: [] } };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: `${label}: tape is not valid JSON (${err instanceof Error ? err.message : String(err)})` };
  }
  if (!isPlainObject(raw)) return { ok: false, error: `${label}: tape is not a JSON object` };
  if (raw.version !== CASSETTE_VERSION) {
    return {
      ok: false,
      error: `${label}: tape version ${String(raw.version)} is not supported (this build reads/writes version ${CASSETTE_VERSION})`,
    };
  }
  if (typeof raw.label !== "undefined" && typeof raw.label !== "string") {
    return { ok: false, error: `${label}: tape label is not a string` };
  }
  if (!Array.isArray(raw.entries)) return { ok: false, error: `${label}: tape entries is not an array` };
  const entries: CassetteEntry[] = [];
  for (let i = 0; i < raw.entries.length; i++) {
    const row: unknown = raw.entries[i];
    const where = `${label}: entry ${i}`;
    if (!isPlainObject(row)) return { ok: false, error: `${where} is not an object` };
    if (typeof row.key !== "string" || row.key.trim().length === 0) return { ok: false, error: `${where} has no key` };
    const request = validateCanonicalRequest(row.request);
    if (request === null) return { ok: false, error: `${where} has a malformed request` };
    const response = validateResponse(row.response);
    if (response === null) return { ok: false, error: `${where} has a malformed response envelope` };
    // Integrity: the key must be the hash of the request it rides with. A tape
    // where they disagree is tampered/corrupt — fail closed rather than serve
    // an unverifiable envelope.
    const expected = String(fnv1a(canonicalJson(request)));
    if (row.key !== expected) {
      return { ok: false, error: `${where} key ${row.key} does not match its request (expected ${expected})` };
    }
    let provenance: ArtifactProvenance | undefined;
    if (row.provenance !== undefined) {
      // The T5.4 serializer's own validator: a stamp this module can mint can
      // never be one io.ts would drop.
      const stamp = coerceArtifactProvenance(row.provenance);
      if (stamp === null) return { ok: false, error: `${where} carries a provenance block the T5.4 validator refuses` };
      provenance = stamp;
    }
    entries.push({ key: row.key, request, response, ...(provenance ? { provenance } : {}) });
  }
  return {
    ok: true,
    tape: { version: CASSETTE_VERSION, ...(typeof raw.label === "string" ? { label: raw.label } : {}), entries },
  };
}

// ---------------------------------------------------------------------------
// The cassette itself
// ---------------------------------------------------------------------------

/** The transport seam the cassette wraps — signature-compatible with every
 *  provider `complete` in `llm/providers/` (mock.ts's precedent). */
export type CassetteTransport = (prompt: string, opts?: DeepSeekCompleteOptions) => Promise<LlmResult>;

/** One handled call, in order (the mock's `calls()` audit precedent). */
export type CassetteServedCall = {
  readonly index: number;
  readonly key: string;
  readonly mode: "record" | "replay";
  /** The canonical request the call was keyed by. */
  readonly request: CanonicalRequest;
  /** What was returned to the caller (the live envelope, or the served/refusal one). */
  readonly response: LlmResult;
  /** T5.4 stamp for this call, or null when nothing was produced (ok:false). */
  readonly provenance: ArtifactProvenance | null;
  /** Honest anomaly note (e.g. a key collision the tape cannot represent). */
  readonly note?: string;
};

export type Cassette = {
  readonly mode: CassetteMode;
  readonly tapePath: string | null;
  /** A snapshot copy of the tape's entries. */
  entries(): readonly CassetteEntry[];
  size(): number;
  /**
   * Wrap a transport. "off" returns the transport ITSELF (identity — provably
   * inert); "record" calls through and persists what came back; "replay"
   * serves from the tape or returns a coded refusal.
   */
  wrap(transport: CassetteTransport): CassetteTransport;
  /** Every call the cassette handled, in order. */
  served(): readonly CassetteServedCall[];
  /** The T5.4 stamp of served call `index` (default: the last), or null. */
  provenanceFor(index?: number): ArtifactProvenance | null;
  /** One-line honest description of what this cassette is doing. */
  describe(): string;
};

export type CassetteInit = {
  mode: CassetteMode;
  /** Where the tape lives. Required for record/replay; a `tapePath` alone
   *  builds the file store. */
  store?: CassetteStore;
  tapePath?: string;
  label?: string;
  /** Deterministic clock seam (defaults to Date.now). */
  now?: () => number;
};

export type CassetteInitResult =
  | { ok: true; cassette: Cassette }
  | { ok: false; code: ErrorCode; error: string };

function copyEnvelope(env: LlmResult): LlmResult {
  if (env.ok) {
    return env.usage
      ? {
          ok: true,
          text: env.text,
          model: env.model,
          usage: { promptTokens: env.usage.promptTokens, completionTokens: env.usage.completionTokens },
        }
      : { ok: true, text: env.text, model: env.model };
  }
  // W39·B4 sweep: LlmResult's refusal arm may carry `usage` (Y1's I2 contract —
  // a refusal that still burned tokens must stay meterable). The tape must
  // round-trip that field byte-honestly, or a recorded refusal replays with
  // LESS information than the live call returned (silent under-count).
  return {
    ok: false,
    reason: env.reason,
    ...(env.error !== undefined ? { error: env.error } : {}),
    ...(env.code !== undefined ? { code: env.code } : {}),
    ...(env.usage
      ? { usage: { promptTokens: env.usage.promptTokens, completionTokens: env.usage.completionTokens } }
      : {}),
  };
}

/**
 * The T5.4 provenance stamp for an envelope the cassette just handled.
 *
 * `mode` is the cassette's mode, not the producer's mood: "record" mints
 * `producer:"model"` (a live call produced it), "replay" mints `producer:"replay"`
 * (a tape served it — the downstream artifact must say so). `model` is the id
 * actually served, read off the envelope — an ok:false envelope mints NO stamp
 * (nothing was produced; T5.4's validator requires a served model for both
 * non-deterministic producers, and absent = honest unknown).
 */
export function provenanceForServed(
  mode: "record" | "replay",
  res: LlmResult,
  inputHash: string,
  now: number,
): ArtifactProvenance | null {
  if (!res.ok) return null;
  const producer: ArtifactProducer = mode === "replay" ? "replay" : "model";
  return { producer, model: res.model, timestamp: now, inputHash };
}

/** The coded miss refusal — never fabricated text. */
function missRefusal(why: string, key: string, request: CanonicalRequest, tapePath: string | null): LlmResult {
  return {
    ok: false,
    reason: "error",
    code: CASSETTE_MISS_CODE,
    error:
      `cassette miss: ${why} — key ${key} (model ${request.model ?? "(unset)"}, prompt ${request.prompt.length} chars` +
      `${tapePath ? `, tape ${tapePath}` : ""}). The cassette NEVER fabricates text: record the call ` +
      `(${CASSETTE_MODE_ENV}=record) or run live.`,
  };
}

function createOffCassette(): Cassette {
  const empty: readonly CassetteEntry[] = Object.freeze([]);
  const none: readonly CassetteServedCall[] = Object.freeze([]);
  return {
    mode: "off",
    tapePath: null,
    entries: () => empty,
    size: () => 0,
    wrap: (transport) => transport,
    served: () => none,
    provenanceFor: () => null,
    describe: () => "cassette(mode=off): inert — the transport passes through unmodified",
  };
}

/**
 * Build a cassette. Record/replay require a `store` or a `tapePath`; the tape
 * is read (and validated, fail-closed) before the cassette is returned.
 */
export async function createCassette(init: CassetteInit): Promise<CassetteInitResult> {
  const now = init.now ?? (() => Date.now());
  if (init.mode === "off") return { ok: true, cassette: createOffCassette() };
  const tapePath = init.tapePath ?? null;
  const label = tapePath ?? `cassette(mode=${init.mode}${init.label ? `, label=${init.label}` : ""})`;
  const store = init.store ?? (tapePath ? createFileCassetteStore(tapePath) : null);
  if (store === null) {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error: `a "${init.mode}" cassette needs a store or a tapePath — the cassette never picks a tape location implicitly`,
    };
  }
  let raw: string | null;
  try {
    raw = await store.read();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, code: classifyError(err, "RT_E_VALIDATION"), error: `${label}: tape read failed — ${detail}` };
  }
  const tapeFound = raw !== null;
  const parsed = parseTape(raw, label);
  if (!parsed.ok) return { ok: false, code: "RT_E_VALIDATION", error: parsed.error };
  const tape = parsed.tape;
  const log: CassetteServedCall[] = [];

  const run = async (
    transport: CassetteTransport,
    prompt: string,
    opts: DeepSeekCompleteOptions | undefined,
  ): Promise<LlmResult> => {
    const request = canonicalizeRequest({
      prompt,
      model: opts?.model,
      system: opts?.system,
      maxTokens: opts?.maxTokens,
      json: opts?.json,
      thinking: opts?.thinking,
      history: opts?.history,
    });
    const canon = canonicalJson(request);
    const key = String(fnv1a(canon));

    if (init.mode === "record") {
      // Live traffic; persist what came back (write-through — a recorded
      // evidence tape must exist on disk the moment the call returns). A
      // transport throw propagates untouched and records nothing.
      const live = await transport(prompt, opts);
      const at = now();
      const existing = tape.entries.find((e) => e.key === key);
      let note: string | undefined;
      if (existing && canonicalJson(existing.request) !== canon) {
        note =
          "key collision: a different recorded request already owns this key — the tape keeps the first and cannot represent both";
      } else if (!existing) {
        const provenance = provenanceForServed("record", live, key, at);
        tape.entries.push({
          key,
          request,
          response: copyEnvelope(live),
          ...(provenance ? { provenance } : {}),
        });
        await store.write(serializeTape(tape));
      }
      log.push({
        index: log.length,
        key,
        mode: "record",
        request,
        response: copyEnvelope(live),
        provenance: provenanceForServed("record", live, key, at),
        ...(note ? { note } : {}),
      });
      return copyEnvelope(live);
    }

    // Replay: serve from the tape or refuse. The live transport is NEVER called.
    const entry = tape.entries.find((e) => e.key === key);
    if (!entry) {
      const why = tapeFound ? "no entry for this call" : `no tape file at ${tapePath ?? "(unset)"}`;
      const refusal = missRefusal(why, key, request, tapePath);
      log.push({ index: log.length, key, mode: "replay", request, response: copyEnvelope(refusal), provenance: null });
      return refusal;
    }
    if (canonicalJson(entry.request) !== canon) {
      // Two DIFFERENT requests hashing to the same 32-bit key. Serving the
      // stored envelope would hand back another prompt's answer — refuse.
      const refusal = missRefusal(
        "this key is shared with a different recorded request (FNV-1a collision) — refusing rather than serving the wrong envelope",
        key,
        request,
        tapePath,
      );
      log.push({ index: log.length, key, mode: "replay", request, response: copyEnvelope(refusal), provenance: null });
      return refusal;
    }
    const served = copyEnvelope(entry.response);
    log.push({
      index: log.length,
      key,
      mode: "replay",
      request,
      response: copyEnvelope(served),
      provenance: provenanceForServed("replay", served, key, now()),
    });
    return served;
  };

  return {
    ok: true,
    cassette: {
      mode: init.mode,
      tapePath,
      entries: () => tape.entries.slice(),
      size: () => tape.entries.length,
      wrap: (transport) => (prompt, opts) => run(transport, prompt, opts),
      served: () => log.slice(),
      provenanceFor: (index?: number) => {
        const i = index ?? log.length - 1;
        if (i < 0 || i >= log.length) return null;
        return log[i].provenance;
      },
      describe: () =>
        `cassette(mode=${init.mode}, tape=${tapePath ?? "(memory store)"}, entries=${tape.entries.length}` +
        `${tapeFound ? "" : ", tape not found"})`,
    },
  };
}

// ---------------------------------------------------------------------------
// Explicit selection (the env/param half — never a default)
// ---------------------------------------------------------------------------

/**
 * Build the cassette the environment asked for. Returns an INERT cassette when
 * nothing is armed (unset/blank/`off`) — never an error, never a surprise
 * tape. An armed mode without a tape path, or a value that is not an exact
 * mode, is a coded refusal (`RT_E_VALIDATION`): a sloppy env must never arm a
 * cassette by accident (the mock's exact-value doctrine).
 */
export async function selectCassette(
  deps: {
    env?: Record<string, string | undefined>;
    /** The param half: wins over the env, always an explicit act. */
    explicit?: { mode: "record" | "replay"; store?: CassetteStore; tapePath?: string; label?: string };
    now?: () => number;
  } = {},
): Promise<CassetteInitResult> {
  if (deps.explicit) {
    return createCassette({
      mode: deps.explicit.mode,
      ...(deps.explicit.store ? { store: deps.explicit.store } : {}),
      ...(deps.explicit.tapePath ? { tapePath: deps.explicit.tapePath } : {}),
      ...(deps.explicit.label ? { label: deps.explicit.label } : {}),
      ...(deps.now ? { now: deps.now } : {}),
    });
  }
  const env = deps.env ?? process.env;
  const raw = env[CASSETTE_MODE_ENV];
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "" || value === "off") {
    return createCassette({ mode: "off" });
  }
  if (value !== "record" && value !== "replay") {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error:
        `${CASSETTE_MODE_ENV}="${raw}" is not a cassette mode — exact values only (${CASSETTE_MODES.join(" | ")}); ` +
        "leave it unset for an inert run. A cassette is never armed by a sloppy value.",
    };
  }
  const tapeRaw = env[CASSETTE_TAPE_ENV];
  const tapePath = typeof tapeRaw === "string" ? tapeRaw.trim() : "";
  if (tapePath === "") {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error: `${CASSETTE_MODE_ENV}=${value} needs a tape path in ${CASSETTE_TAPE_ENV} — the cassette never picks a tape location implicitly.`,
    };
  }
  return createCassette({ mode: value, tapePath, ...(deps.now ? { now: deps.now } : {}) });
}

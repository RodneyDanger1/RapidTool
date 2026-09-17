/**
 * mock.test.ts — the explicit-select mock LLM provider (T-107.10, W7 · L4 —
 * fixes/216t).
 *
 * Three contracts pinned here:
 *   1. HONESTY — the mock is never a default (not in `PROVIDERS`, not in
 *      `ROLE_TIERS`, its id not in `KNOWN_MODEL_IDS`, `getProvider("mock")`
 *      undefined) and NEVER satisfies a configured probe (`isConfigured()`
 *      is hard-wired false; selecting it leaves `isDeepSeekConfigured()`
 *      false). An exhausted queue is a CODED refusal, never fabricated text.
 *   2. EXPLICIT SELECTION — `RAPIDTOOL_MOCK_LLM=1` (exact value only) or
 *      `explicit: true`; anything else is refused with `RT_E_VALIDATION`.
 *      The registry's explicit path (`callModel(…, {provider})`) dispatches
 *      through the mock with the model validated in the MOCK's own namespace
 *      (a DeepSeek id is refused there), never falling back to the tier.
 *   3. ONE E2E: brief → (mock) synthesis → emitted tree files on disk. The
 *      REAL pipeline runs — real chunk planner, real synthesis prompts, real
 *      envelope parser, real per-file validation, real tree assembly, real
 *      scaffold emission — with ONLY the model transport replaced. `fetch` is
 *      tripwired: zero network, and the pipeline asks the mock exactly the
 *      calls it would have asked DeepSeek.
 *
 * Run: node --experimental-strip-types --test src/lib/llm/providers/mock.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MOCK_MODEL_ID,
  MOCK_MODEL_IDS,
  MOCK_PROVIDER_ID,
  MOCK_SELECT_ENV,
  MOCK_SELECT_VALUE,
  createMockProvider,
  mockSelected,
  selectMockProvider,
} from "./mock.ts";
import {
  KNOWN_MODEL_IDS,
  PROVIDERS,
  ROLE_TIERS,
  callModel,
  getProvider,
  resolveExplicitProvider,
} from "./registry.ts";
import { isDeepSeekConfigured } from "./deepseek.ts";
import type { LlmResult } from "../../llm.ts";

const KEY = "DEEPSEEK_API_KEY";

/** A global-fetch tripwire (repo convention, e.g. algo-tools.test.ts): any
 *  network attempt during the mock E2E throws instead of leaving the box. */
function noNetworkTripwire(): { calls: () => number; restore: () => void } {
  const real = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (input: unknown) => {
    calls += 1;
    throw new Error(`network attempted during the mock E2E: ${String(input)}`);
  }) as typeof fetch;
  return {
    calls: () => calls,
    restore: () => {
      globalThis.fetch = real;
    },
  };
}

/** Set env vars for one test; returns the restorer (deletes vars that were unset). */
function withEnv(vars: Record<string, string>): () => void {
  const saved = new Map<string, string | undefined>();
  for (const [k, v] of Object.entries(vars)) {
    saved.set(k, process.env[k]);
    process.env[k] = v;
  }
  return () => {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
}

/** Clear the real key (and the mock select var) for one test; restore after. */
function withCleanLlmEnv(vars: Record<string, string> = {}): () => void {
  const saved = new Map<string, string | undefined>();
  for (const k of [KEY, MOCK_SELECT_ENV]) {
    saved.set(k, process.env[k]);
    delete process.env[k];
  }
  for (const [k, v] of Object.entries(vars)) process.env[k] = v;
  return () => {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
}

const okEnvelope = (text: string): LlmResult => ({
  ok: true,
  text,
  // Parent boundary fix (W7): LlmResult's ok arm carries the serving model id.
  model: MOCK_MODEL_ID,
  usage: { promptTokens: 7, completionTokens: 11 },
});

// ---------------------------------------------------------------------------
// 1. Honesty — never a default, never "configured", never fabrication
// ---------------------------------------------------------------------------

describe("mock provider — honesty (T-107.10)", () => {
  it("is never a default: not in PROVIDERS/ROLE_TIERS/KNOWN_MODEL_IDS; getProvider(\"mock\") is undefined", () => {
    const mock = createMockProvider([]);
    assert.equal(mock.descriptor.id, MOCK_PROVIDER_ID);
    assert.equal(getProvider(MOCK_PROVIDER_ID), undefined, "the mock is never resolvable by the registry's default lookup");
    assert.equal(
      PROVIDERS.some((p) => p.id === MOCK_PROVIDER_ID),
      false,
      "the mock is never a registered provider",
    );
    assert.equal(
      PROVIDERS.length,
      1,
      "the registered provider census is unchanged (DeepSeek only)",
    );
    for (const role of Object.keys(ROLE_TIERS) as (keyof typeof ROLE_TIERS)[]) {
      assert.equal(ROLE_TIERS[role].provider, "deepseek", `${role} still resolves to DeepSeek`);
    }
    for (const id of MOCK_MODEL_IDS) {
      assert.equal(KNOWN_MODEL_IDS.includes(id), false, `${id} must NOT be a DeepSeek-known model id`);
    }
  });

  it("never satisfies a configured probe: isConfigured() stays false even when the mock is selected", () => {
    const restore = withCleanLlmEnv({ [MOCK_SELECT_ENV]: MOCK_SELECT_VALUE });
    try {
      assert.equal(mockSelected(), true, "precondition: the env really selects the mock");
      const sel = selectMockProvider({});
      assert.equal(sel.ok, true);
      if (!sel.ok) return;
      assert.equal(sel.mock.descriptor.isConfigured(), false, "a mock NEVER reports configured");
      assert.equal(isDeepSeekConfigured(), false, "the keyless floor is untouched by mock selection");
      assert.equal(PROVIDERS[0]!.isConfigured(), false);
    } finally {
      restore();
    }
  });

  it("an exhausted queue is a CODED refusal naming the mock — never fabricated text", async () => {
    const mock = createMockProvider([]);
    const res = await mock.complete("anything");
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.reason, "error");
      assert.equal(res.code, "RT_E_LLM_REJECTED");
      // Parent boundary fix (W7): LlmResult's refusal arm has `error?: string`.
      assert.match(res.error ?? "", /mock provider \(mock\) queue exhausted/);
      assert.match(res.error ?? "", /NEVER fabricates/);
    }
    assert.equal(mock.remaining(), 0);
    assert.equal(mock.calls().length, 1, "the refusal is still an observed call");
  });

  it("canned envelopes are served in order; ok envelopes carry the mock's own model id", async () => {
    const mock = createMockProvider([okEnvelope("first"), okEnvelope("second")]);
    const a = await mock.complete("prompt-a", { json: true });
    const b = await mock.complete("prompt-b");
    assert.deepEqual(a, {
      ok: true,
      text: "first",
      model: MOCK_MODEL_ID,
      usage: { promptTokens: 7, completionTokens: 11 },
    });
    assert.equal(b.ok && b.text, "second");
    assert.deepEqual(
      mock.calls().map((c) => c.prompt),
      ["prompt-a", "prompt-b"],
      "the pipeline's real prompts are logged in order",
    );
    assert.equal(mock.calls()[0]!.opts.json, true, "the pipeline's opts ride along");
    assert.equal(mock.remaining(), 0);
    mock.push(okEnvelope("third"));
    assert.equal(mock.remaining(), 1);
    mock.reset();
    assert.equal(mock.remaining(), 0);
    assert.equal(mock.calls().length, 0, "reset clears the call log by default");
  });

  it("a refusal ENVELOPE passes through verbatim (the mock can be asked to fail, honestly)", async () => {
    const refusal: LlmResult = { ok: false, reason: "error", error: "provider 503", code: "RT_E_LLM_REJECTED" };
    const mock = createMockProvider([refusal, okEnvelope("after")]);
    const first = await mock.complete("p1");
    assert.deepEqual(first, refusal);
    const second = await mock.complete("p2");
    assert.equal(second.ok, true, "the queue keeps going after a canned refusal");
  });
});

// ---------------------------------------------------------------------------
// 2. Explicit selection — env + param, coded refusals otherwise
// ---------------------------------------------------------------------------

describe("mock provider — explicit selection only", () => {
  it("mockSelected: exact value `1` only — unset/blank/other values are NOT selected", () => {
    assert.equal(mockSelected({}), false);
    assert.equal(mockSelected({ [MOCK_SELECT_ENV]: "" }), false);
    assert.equal(mockSelected({ [MOCK_SELECT_ENV]: "  " }), false);
    assert.equal(mockSelected({ [MOCK_SELECT_ENV]: "true" }), false, "a sloppy env can never arm the mock");
    assert.equal(mockSelected({ [MOCK_SELECT_ENV]: "yes" }), false);
    assert.equal(mockSelected({ [MOCK_SELECT_ENV]: "0" }), false);
    assert.equal(mockSelected({ [MOCK_SELECT_ENV]: "1" }), true);
    assert.equal(mockSelected({ [MOCK_SELECT_ENV]: " 1 " }), true, "trimmed exact value");
  });

  it("selectMockProvider REFUSES without explicit selection (coded, never a silent mock)", () => {
    const sel = selectMockProvider({ env: {} });
    assert.equal(sel.ok, false);
    if (!sel.ok) {
      assert.equal(sel.code, "RT_E_VALIDATION");
      assert.match(sel.error, /requires EXPLICIT selection/);
      assert.match(sel.error, new RegExp(`${MOCK_SELECT_ENV}=${MOCK_SELECT_VALUE}`));
      assert.match(sel.error, /never a default and never satisfies a configured probe/);
    }
  });

  it("selectMockProvider succeeds via the env path or the explicit param (and only then)", () => {
    const viaEnv = selectMockProvider({ env: { [MOCK_SELECT_ENV]: MOCK_SELECT_VALUE }, envelopes: [okEnvelope("env")] });
    assert.equal(viaEnv.ok, true);
    const viaParam = selectMockProvider({ env: {}, explicit: true, envelopes: [okEnvelope("param")] });
    assert.equal(viaParam.ok, true);
    if (!viaEnv.ok || !viaParam.ok) return;
    assert.equal(viaEnv.mock.remaining(), 1);
    assert.equal(viaParam.mock.remaining(), 1);
    assert.notEqual(viaEnv.mock, viaParam.mock, "every selection gets its own queue + call log");
  });

  it("registry explicit path: callModel dispatches to the mock and validates the model id in the MOCK's namespace", async () => {
    const mock = createMockProvider([okEnvelope("canned reply")]);
    const res = await callModel("main", "hello mock", { provider: mock.descriptor });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.text, "canned reply");
      assert.equal(res.model, MOCK_MODEL_ID, "the mock's own model id rides the reply");
    }

    // Provider-scoped ids: a DeepSeek id is NOT requestable through the mock
    // (and a mock id is not requestable through the tier path).
    const wrongNamespace = await callModel("main", "hello", { provider: mock.descriptor, model: "deepseek-v4-flash" });
    assert.equal(wrongNamespace.ok, false);
    if (!wrongNamespace.ok) {
      assert.equal(wrongNamespace.code, "RT_E_VALIDATION");
      assert.match(wrongNamespace.error ?? "", /ids are provider-scoped/);
    }
    const tierPathMockId = await callModel("main", "hello", { model: MOCK_MODEL_ID });
    assert.equal(tierPathMockId.ok, false);
    if (!tierPathMockId.ok) {
      assert.equal(tierPathMockId.code, "RT_E_VALIDATION");
      assert.match(tierPathMockId.error ?? "", /not a known model id/);
    }
  });

  it("resolveExplicitProvider: hostile/partial descriptors are coded refusals — never a tier fallback", () => {
    const cases: unknown[] = [
      null,
      undefined,
      "mock",
      42,
      [],
      {},
      { id: "" },
      { id: "half", complete: () => undefined },
      { id: "no-models", complete: () => undefined, isConfigured: () => false, requestModelIds: [] },
    ];
    for (const provider of cases) {
      const r = resolveExplicitProvider(provider);
      assert.equal(r.ok, false, `${JSON.stringify(provider)} must not resolve`);
      if (!r.ok) {
        assert.equal(r.code, "RT_E_VALIDATION");
        assert.ok(r.error.length > 0);
      }
    }
    const mock = createMockProvider([]);
    const good = resolveExplicitProvider(mock.descriptor);
    assert.equal(good.ok, true);
    if (good.ok) assert.equal(good.model, MOCK_MODEL_ID);
  });

  it("the DEFAULT path is untouched: keyless callModel still returns the honest not-configured envelope", async () => {
    const restore = withCleanLlmEnv();
    try {
      const res = await callModel("main", "hello");
      assert.deepEqual(res, { ok: false, reason: "not-configured", code: "RT_E_LLM_NOT_CONFIGURED" });
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// 3. E2E — brief → (mock) synthesis → emitted tree files
// ---------------------------------------------------------------------------
// The fixture mirrors src/lib/codegen.server.test.ts's proven chunked fixture
// (LEDGER brief, 20 signatures → 8/8/4, job-keyed src/jobs/rent*.ts paths):
// deterministic canned envelopes for the expansion + one per chunk, with the
// REAL pipeline around them.

const E2E_BRIEF =
  "a property ledger for rent collection with tenant records, lease renewal reminders and payment tracking";

function e2eSignatures(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `export function collectRent${i}(payment: Payment): Receipt`);
}

const E2E_SPEC = {
  requirements: ["Track rent collection per tenant.", "Remind lease renewals before their due date."],
  edgeCases: ["Empty payment records are skipped, never thrown."],
  errorHandling: ["Invalid payments raise a coded error."],
  typeSignatures: e2eSignatures(20),
  dataFlow: ["payment → ledger → receipt"],
  negativeConstraints: ["DO NOT invent tenant data."],
};

/** Deterministic canned chunk module (codegen fixture shape): binds exactly
 *  the chunk's names and carries every brief noun as identifiers. */
function e2eChunkModule(names: readonly string[]): string {
  return [
    ...names.map((n) => `/** (216t mock chunk fn) ${n} */\nfunction ${n}(input) { return input; }`),
    "const ledgerKit = { property: 1, ledger: 1, rent: 1, collection: 1, tenant: 1, records: 1, lease: 1, renewal: 1, reminders: 1, payment: 1, tracking: 1 };",
    ...names.map((n) => `module.exports.${n} = ${n};`),
  ].join("\n");
}

describe("mock provider — E2E (brief → mock synthesis → emitted tree files)", () => {
  it("runs the real P6 chunked pipeline over canned envelopes and emits the tree verbatim (zero network)", async () => {
    const { applyPhaseResult, emptyProject } = await import("../../engine.ts");
    const { TREE_ENTRY_PATH, chunkTypeSignatures, liveP6Synthesis, signatureFunctionNames } = await import(
      "../../codegen.server.ts"
    );
    const { emitProject } = await import("../../headless.ts");
    const { parseExpandedSpecJson } = await import("../../prompt-engine.ts");

    // The chunk grouping the pipeline itself will compute — used to CAN the
    // envelopes the mock will serve (the pipeline's own plan is what is run).
    const groups = chunkTypeSignatures(E2E_SPEC.typeSignatures);
    assert.equal(groups.length, 3, "fixture precondition: 20 signatures chunk 8/8/4");

    // 1 expansion envelope + one synthesis envelope per chunk.
    const mock = createMockProvider([
      okEnvelope(JSON.stringify(E2E_SPEC)),
      ...groups.map((g) =>
        okEnvelope(
          JSON.stringify({
            module: e2eChunkModule(signatureFunctionNames(g)),
            exports: signatureFunctionNames(g),
            reqTrace: {},
          }),
        ),
      ),
    ]);

    // The expansion seam: the REAL parser (`parseExpandedSpecJson`) over the
    // mock's canned text (the production expansion PROMPT needs the network;
    // see fixes/216t §6 — the prompt here is an explicit e2e stand-in).
    const expand = async (brief: string, _lessons?: readonly string[]) => {
      const res = await mock.complete(`e2e expansion request (not the production prompt): ${brief}`, { json: true });
      if (!res.ok) {
        return res.reason === "not-configured"
          ? ({ ok: false, reason: "not-configured" } as const)
          : ({ ok: false, reason: "error", error: res.error } as const);
      }
      const spec = parseExpandedSpecJson(res.text);
      return spec === null
        ? ({ ok: false, reason: "error", error: "model returned an unparseable expansion payload" } as const)
        : ({ ok: true, spec } as const);
    };
    let verifyCalls = 0;
    const verify = async () => {
      verifyCalls += 1;
      return { status: "error" as const, iterations: 0, evidence: "the chunked tree path never verifies", finalSource: "", cases: [] };
    };

    const restoreKey = withEnv({ [KEY]: "«redacted:mock-e2e-key»" });
    const network = noNetworkTripwire();
    const dir = mkdtempSync(join(tmpdir(), "rapidtool-mock-e2e-"));
    try {
      const base = { ...applyPhaseResult(emptyProject({ name: "RentLedger", brief: E2E_BRIEF }), 6), kind: "app" as const };
      const q = await liveP6Synthesis(base, { complete: mock.complete, expand, verify });

      // (a) the synthesis really happened, through the mock, over the real prompts.
      assert.notEqual(q.generatedSource, base.generatedSource, "the deterministic floor was replaced by the synthesized tree entry");
      assert.equal(verifyCalls, 0, "the chunked tree path never calls the verify leg");
      assert.equal(mock.calls().length, 4, "1 expansion + 3 chunk synthesis calls — exactly what the pipeline asked");
      assert.equal(mock.remaining(), 0, "every canned envelope was consumed (none unused)");
      for (const call of mock.calls().slice(1)) {
        assert.ok(call.prompt.includes(E2E_BRIEF), "every chunk prompt carries the brief");
        assert.ok(call.prompt.includes("Track rent collection per tenant."), "…and the requirement list");
      }

      // (b) the emitted tree files exist at their expected paths, verbatim.
      const tree = q.generatedTree ?? [];
      assert.equal(tree.length, 4, "A0 barrel + one file per chunk");
      assert.deepEqual(
        tree.map((t) => t.path),
        [TREE_ENTRY_PATH, "src/jobs/rent.ts", "src/jobs/rent-2.ts", "src/jobs/rent-3.ts"],
      );
      const emitted = await emitProject(q, dir, { redTree: "probe" });
      assert.equal(emitted.ok, true, emitted.ok ? "" : emitted.error);
      if (!emitted.ok) return;
      for (const row of tree) {
        const file = join(dir, row.path);
        assert.ok(existsSync(file), `${row.path} was emitted`);
        assert.equal(readFileSync(file, "utf8"), row.source, `${row.path} emitted verbatim (byte-identical to the tree row)`);
        assert.ok(emitted.files.includes(row.path), `${row.path} is reported in the emit result`);
      }
      assert.ok(existsSync(join(dir, "README.md")), "the real scaffold landed around the tree");

      // (c) ZERO network: the tripwire saw no fetch at all.
      assert.equal(network.calls(), 0, "no fetch was attempted anywhere in the pipeline");
    } finally {
      network.restore();
      restoreKey();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

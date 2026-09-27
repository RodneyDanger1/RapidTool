// ---------------------------------------------------------------------------
// cassette.test.ts — T5.7 deterministic LLM cassette (record/replay).
// Run: node --experimental-strip-types --test src/lib/cassette.test.ts
//
// What this suite pins (the lane's done-when list):
//   1. round-trip: record → tape (memory + FILE on disk) → replay is
//      byte-identical and NEVER touches the live transport;
//   2. hash-key: the key IS String(fnv1a(canonical request)) — cross-host
//      pinned literals, canonicalization aliases, and distinct-input separation;
//   3. miss-refusal: a miss is a CODED RT_E_* refusal with no fabricated text,
//      including the FNV-1a key-collision guard (exercised with a REAL colliding
//      pair, see COLLISION_A/B below);
//   4. fail-closed tapes: corrupt/tampered tapes refuse at load — never become
//      an "empty tape" that silently turns a recorded run into a wall of misses;
//   5. off-by-default selection: unset env = an inert cassette whose wrap() is
//      the identity, and a sloppy env value is refused, never armed;
//   6. T5.4 consumption: every minted stamp passes io.ts's own
//      `coerceArtifactProvenance`, and nothing in the pipeline is wired to the
//      cassette (the mechanical basis of "keyless `npm run eval` stays
//      byte-identical": the eval driver cannot see this module).
//
// COLLISION_A/B: "collision-probe-30159" and "collision-probe-533074" are a
// genuine FNV-1a-32 collision pair on this module's key surface (both key
// "3138489782"). Found by a 1e6-probe search on 2026-09-24 — the observed
// birthday rate was 52-142 collisions per 1e6 strings, so the collision guard
// is not theoretical. Both literals are pure-function inputs; they stay valid
// as long as `fnv1a` + `canonicalJson` stay byte-stable.
// ---------------------------------------------------------------------------

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fnv1a } from "./algorithms.ts";
import { ERROR_CODES } from "./errors.ts";
import { ARTIFACT_PRODUCERS, coerceArtifactProvenance } from "./io.ts";
import {
  CASSETTE_MISS_CODE,
  CASSETTE_MODE_ENV,
  CASSETTE_TAPE_ENV,
  CASSETTE_VERSION,
  canonicalJson,
  canonicalizeRequest,
  canonRequest,
  cassetteKey,
  createCassette,
  createFileCassetteStore,
  createMemoryCassetteStore,
  provenanceForServed,
  selectCassette,
  type CanonicalRequest,
  type CassetteEntry,
  type CassetteRequest,
  type CassetteTransport,
} from "./cassette.ts";
import type { LlmResult } from "./llm.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXED_NOW = 1_700_000_000_000;

/** A real-shaped success envelope the fake live transport returns. */
function envelope(prompt: string, model = "deepseek-v4-flash"): LlmResult {
  return {
    ok: true,
    text: `live:${prompt}`,
    model,
    usage: { promptTokens: 3, completionTokens: 5 },
  };
}

/** A fake live transport that records the prompts it was called with. */
function liveTransport(log: string[]): CassetteTransport {
  return async (prompt, opts) => {
    log.push(prompt);
    return envelope(prompt, opts?.model ?? "deepseek-v4-flash");
  };
}

/** A transport that FAILS the test if replay ever calls it. */
const forbiddenTransport: CassetteTransport = async (prompt) => {
  throw new Error(`replay called the live transport for prompt "${prompt}" — it must never`);
};

function entryBody(req: CassetteRequest, response: LlmResult = envelope(req.prompt)): Omit<CassetteEntry, "provenance"> {
  const request = canonicalizeRequest(req);
  return { key: String(fnv1a(canonicalJson(request))), request, response };
}

function tapeText(entries: unknown[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ version: CASSETTE_VERSION, ...extra, entries }, null, 2) + "\n";
}

async function withTmpDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "w19l6-cassette-"));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Unwrap a successful init (a helper so a refusal fails the calling test loudly). */
function unwrap(res: Awaited<ReturnType<typeof createCassette>>) {
  assert.equal(res.ok, true, res.ok ? "" : `cassette init refused: ${res.error}`);
  if (!res.ok) throw new Error("unreachable");
  return res.cassette;
}

// ---------------------------------------------------------------------------
// 1. canonicalization + hash key
// ---------------------------------------------------------------------------

describe("cassetteKey — the hash key", () => {
  it("is String(fnv1a(canonical request)) — the repo's own hash, not a new one", () => {
    const req: CassetteRequest = { prompt: "hello world", model: "deepseek-v4-flash", json: true };
    assert.equal(cassetteKey(req), String(fnv1a(canonRequest(req))));
  });

  it("is pinned cross-host: literal canonical string + key for a fixed request", () => {
    const req: CassetteRequest = {
      prompt: "W19-L6 cassette key sample",
      model: "deepseek-v4-flash",
      system: "sys",
      maxTokens: 64,
      json: true,
      thinking: false,
      history: [{ role: "user", content: "hi" }],
    };
    assert.equal(
      canonRequest(req),
      '{"prompt":"W19-L6 cassette key sample","model":"deepseek-v4-flash","system":"sys","maxTokens":64,"json":true,"thinking":"off","history":[{"role":"user","content":"hi"}]}',
    );
    assert.equal(cassetteKey(req), "1844731533");
  });

  it("pins the literal keys for the two canonical-alias variants", () => {
    assert.equal(cassetteKey({ prompt: "hello world", model: "deepseek-v4-flash", json: true }), "775478552");
    // json:true and json absent are DIFFERENT requests (json mode changes the body).
    assert.notEqual(
      cassetteKey({ prompt: "hello world", model: "deepseek-v4-flash" }),
      cassetteKey({ prompt: "hello world", model: "deepseek-v4-flash", json: true }),
    );
  });

  it("canonicalizes the aliases the provider itself documents as identical", () => {
    const base = { prompt: "alias probe", model: "deepseek-v4-flash" };
    assert.equal(cassetteKey({ ...base, json: false }), cassetteKey(base));
    assert.equal(cassetteKey({ ...base, thinking: true }), cassetteKey(base));
    assert.equal(cassetteKey({ ...base, model: undefined }), cassetteKey({ prompt: "alias probe" }));
    assert.equal(cassetteKey({ ...base, history: [] }), cassetteKey(base));
  });

  it("keeps semantically different requests on different keys", () => {
    const base = { prompt: "separation probe", model: "deepseek-v4-flash" };
    const variants: CassetteRequest[] = [
      { ...base, json: true },
      { ...base, thinking: false },
      { ...base, model: "deepseek-v4-pro" },
      { ...base, system: "" },
      { ...base, system: "sys" },
      { ...base, maxTokens: 64 },
      { ...base, history: [{ role: "user", content: "hi" }] },
      { ...base, history: [{ role: "assistant", content: "hi" }] },
      { ...base, history: [{ role: "user", content: "hi" }, { role: "user", content: "hi" }] },
    ];
    const keys = variants.map((v) => cassetteKey(v));
    assert.equal(new Set(keys).size, keys.length, `variant keys collided: ${keys.join(",")}`);
    for (const k of keys) assert.notEqual(k, cassetteKey(base));
  });

  it("canonicalJson reconstructs the declared fields — stored key order can never change the bytes", () => {
    const canonical = canonicalizeRequest({ prompt: "order probe", model: "m", history: [{ role: "user", content: "x" }] });
    const scrambled = {
      history: canonical.history,
      thinking: canonical.thinking,
      json: canonical.json,
      maxTokens: canonical.maxTokens,
      system: canonical.system,
      model: canonical.model,
      prompt: canonical.prompt,
      // An unknown sibling key a future tape might carry: tolerated + ignored.
      extra: "ignored",
    } as CanonicalRequest;
    assert.equal(canonicalJson(scrambled), canonicalJson(canonical));
  });
});

// ---------------------------------------------------------------------------
// 2. record → replay round-trip
// ---------------------------------------------------------------------------

describe("record → replay round-trip", () => {
  it("records live envelopes with T5.4 provenance, then replays them byte-identically", async () => {
    const store = createMemoryCassetteStore();
    const liveLog: string[] = [];
    const rec = unwrap(await createCassette({ mode: "record", store, now: () => FIXED_NOW }));
    const recTransport = rec.wrap(liveTransport(liveLog));

    const first = await recTransport("hello world", { model: "deepseek-v4-flash", json: true });
    const second = await recTransport("second call", { model: "deepseek-v4-pro", thinking: false });
    assert.deepEqual(liveLog, ["hello world", "second call"]);
    assert.equal(first.ok, true);

    // The tape entry + its T5.4 stamp come from REAL emit data.
    const entries = rec.entries();
    assert.equal(entries.length, 2);
    const e0 = entries[0];
    assert.equal(e0.key, cassetteKey({ prompt: "hello world", model: "deepseek-v4-flash", json: true }));
    assert.equal(e0.provenance?.producer, "model");
    assert.equal(e0.provenance?.model, "deepseek-v4-flash");
    assert.equal(e0.provenance?.timestamp, FIXED_NOW);
    assert.equal(e0.provenance?.inputHash, e0.key);
    assert.notEqual(coerceArtifactProvenance(e0.provenance), null, "io.ts's T5.4 validator must accept the record stamp");
    assert.equal(entries[1].provenance?.model, "deepseek-v4-pro");

    // Replay over the SAME store: byte-identical, and the live transport is never called.
    const rep = unwrap(await createCassette({ mode: "replay", store, now: () => FIXED_NOW + 999 }));
    const repTransport = rep.wrap(forbiddenTransport);
    const firstAgain = await repTransport("hello world", { model: "deepseek-v4-flash", json: true });
    const secondAgain = await repTransport("second call", { model: "deepseek-v4-pro", thinking: false });
    assert.deepEqual(firstAgain, first);
    assert.deepEqual(secondAgain, second);

    // Replay mints producer "replay" — the downstream artifact can say it came from a tape.
    const replayStamp = rep.provenanceFor();
    assert.equal(replayStamp?.producer, "replay");
    assert.equal(replayStamp?.model, "deepseek-v4-pro");
    assert.equal(replayStamp?.timestamp, FIXED_NOW + 999);
    assert.equal(replayStamp?.inputHash, entries[1].key);
    assert.notEqual(coerceArtifactProvenance(replayStamp), null, "io.ts's T5.4 validator must accept the replay stamp");
  });

  it("round-trips through a FILE tape on disk, and the tape file is byte-deterministic", async () => {
    await withTmpDir(async (dir) => {
      const pathA = join(dir, "run-a", "tape.json");
      const storeA = createFileCassetteStore(pathA);
      const recA = unwrap(await createCassette({ mode: "record", store: storeA, tapePath: pathA, now: () => FIXED_NOW }));
      const t = recA.wrap(liveTransport([]));
      await t("disk call one", { model: "deepseek-v4-flash" });
      await t("disk call two", { model: "deepseek-v4-pro", json: true });

      const textA = readFileSync(pathA, "utf8");
      const parsed = JSON.parse(textA) as { version: number; entries: CassetteEntry[] };
      assert.equal(parsed.version, CASSETTE_VERSION);
      assert.equal(parsed.entries.length, 2);

      // Replay from a FRESH cassette over the same file: identical envelopes.
      const rep = unwrap(await createCassette({ mode: "replay", tapePath: pathA }));
      const repT = rep.wrap(forbiddenTransport);
      const one = await repT("disk call one", { model: "deepseek-v4-flash" });
      assert.deepEqual(one, envelope("disk call one"));

      // A second tape recorded from the same deterministic traffic is byte-identical.
      const pathB = join(dir, "run-b", "tape.json");
      const recB = unwrap(await createCassette({ mode: "record", tapePath: pathB, now: () => FIXED_NOW }));
      const tB = recB.wrap(liveTransport([]));
      await tB("disk call one", { model: "deepseek-v4-flash" });
      await tB("disk call two", { model: "deepseek-v4-pro", json: true });
      assert.equal(readFileSync(pathB, "utf8"), textA);
    });
  });

  it("write-through: the tape file exists with the first entry before the second call returns", async () => {
    await withTmpDir(async (dir) => {
      const path = join(dir, "tape.json");
      const rec = unwrap(await createCassette({ mode: "record", tapePath: path, now: () => FIXED_NOW }));
      const t = rec.wrap(liveTransport([]));
      await t("call one", {});
      assert.equal(JSON.parse(readFileSync(path, "utf8")).entries.length, 1);
      await t("call two", {});
      assert.equal(JSON.parse(readFileSync(path, "utf8")).entries.length, 2);
    });
  });

  it("first-wins: re-recording the same call never rewrites the recorded envelope", async () => {
    const store = createMemoryCassetteStore();
    const rec1 = unwrap(await createCassette({ mode: "record", store, now: () => FIXED_NOW }));
    const first = await rec1.wrap(liveTransport([]))("stable call", {});
    const afterFirst = await store.read();
    assert.equal(first.ok, true);

    // A second record pass whose live transport answers DIFFERENTLY: the tape
    // keeps the first envelope (recorded evidence is never silently rewritten).
    const rec2 = unwrap(await createCassette({ mode: "record", store, now: () => FIXED_NOW + 1 }));
    const different: CassetteTransport = async () => ({ ok: true, text: "DIFFERENT LIVE TEXT", model: "deepseek-v4-pro" });
    const second = await rec2.wrap(different)("stable call", {});
    assert.equal(second.ok, true);
    assert.deepEqual(rec2.entries().length, 1);
    assert.equal(await store.read(), afterFirst);

    const rep = unwrap(await createCassette({ mode: "replay", store }));
    assert.deepEqual(await rep.wrap(forbiddenTransport)("stable call", {}), first);
  });

  it("records an ok:false envelope as a first-class entry and replays the same refusal", async () => {
    const store = createMemoryCassetteStore();
    const refusal: LlmResult = { ok: false, reason: "error", code: "RT_E_LLM_TIMEOUT", error: "provider timed out" };
    const rec = unwrap(await createCassette({ mode: "record", store, now: () => FIXED_NOW }));
    const recorded = await rec.wrap(async () => refusal)("doomed call", {});
    assert.deepEqual(recorded, refusal);

    const entry = rec.entries()[0];
    assert.equal(entry.response.ok, false);
    // Nothing was produced and no model was served — T5.4's validator requires a
    // served model for "model", so the honest record has NO stamp at all.
    assert.equal("provenance" in entry, false);
    assert.equal(provenanceForServed("record", refusal, entry.key, FIXED_NOW), null);

    const rep = unwrap(await createCassette({ mode: "replay", store }));
    const replayed = await rep.wrap(forbiddenTransport)("doomed call", {});
    assert.deepEqual(replayed, refusal);
    assert.equal(rep.provenanceFor(), null);
  });

  it("a transport throw in record mode propagates untouched and records nothing", async () => {
    const store = createMemoryCassetteStore();
    const rec = unwrap(await createCassette({ mode: "record", store, now: () => FIXED_NOW }));
    const boom: CassetteTransport = async () => {
      throw new Error("transport exploded");
    };
    await assert.rejects(() => rec.wrap(boom)("exploding call", {}), /transport exploded/);
    assert.equal(rec.entries().length, 0);
    assert.equal(await store.read(), null);
  });

  it("logs every handled call with its key + provenance (the audit surface)", async () => {
    const store = createMemoryCassetteStore();
    const rec = unwrap(await createCassette({ mode: "record", store, now: () => FIXED_NOW }));
    await rec.wrap(liveTransport([]))("audit one", {});
    await rec.wrap(liveTransport([]))("audit two", {});
    const served = rec.served();
    assert.equal(served.length, 2);
    assert.deepEqual(served.map((c) => c.mode), ["record", "record"]);
    assert.equal(served[0].request.prompt, "audit one");
    assert.equal(served[0].key, cassetteKey({ prompt: "audit one" }));
    assert.equal(served[0].provenance?.producer, "model");
    assert.equal(rec.provenanceFor(0)?.inputHash, served[0].key);
    assert.equal(rec.provenanceFor(1)?.inputHash, served[1].key);
    assert.equal(rec.provenanceFor(99), null);
    assert.match(rec.describe(), /mode=record/);
  });
});

// ---------------------------------------------------------------------------
// 3. miss = coded refusal (never fabricated text)
// ---------------------------------------------------------------------------

describe("a tape miss is a coded refusal", () => {
  it("refuses an unrecorded call with CASSETTE_MISS_CODE and no text field", async () => {
    const store = createMemoryCassetteStore();
    const rec = unwrap(await createCassette({ mode: "record", store, now: () => FIXED_NOW }));
    await rec.wrap(liveTransport([]))("recorded call", {});

    const rep = unwrap(await createCassette({ mode: "replay", store }));
    const res = await rep.wrap(forbiddenTransport)("unrecorded call", {});
    assert.equal(res.ok, false);
    if (res.ok) throw new Error("unreachable");
    assert.equal(res.reason, "error");
    assert.equal(res.code, CASSETTE_MISS_CODE);
    const missCode = res.code;
    if (missCode === undefined) throw new Error("a miss must always carry a code");
    assert.equal(missCode, "RT_E_LLM_REJECTED");
    assert.ok(ERROR_CODES.includes(missCode), "the miss code must be a REGISTERED RT_E_* code");
    assert.match(res.error ?? "", /^cassette miss: /);
    assert.match(res.error ?? "", new RegExp(cassetteKey({ prompt: "unrecorded call" })));
    assert.equal("text" in res, false, "a miss must never carry fabricated text");
    // The miss is logged too — the audit surface shows what was refused.
    assert.equal(rep.served()[0].provenance, null);
    const servedMiss = rep.served()[0].response;
    assert.equal(servedMiss.ok, false);
    if (servedMiss.ok) throw new Error("unreachable");
    assert.match(servedMiss.error ?? "", /cassette miss/);
  });

  it("refuses every call when the tape file does not exist (and says so)", async () => {
    await withTmpDir(async (dir) => {
      const rep = unwrap(await createCassette({ mode: "replay", tapePath: join(dir, "missing", "tape.json") }));
      assert.match(rep.describe(), /tape not found/);
      const res = await rep.wrap(forbiddenTransport)("anything", {});
      assert.equal(res.ok, false);
      if (res.ok) throw new Error("unreachable");
      assert.equal(res.code, CASSETTE_MISS_CODE);
      assert.match(res.error ?? "", /no tape file at/);
    });
  });

  it("refuses instead of serving the wrong envelope on a REAL FNV-1a key collision", async () => {
    // COLLISION_A and COLLISION_B share key "3138489782" (see file header).
    const A: CassetteRequest = { prompt: "collision-probe-30159" };
    const B: CassetteRequest = { prompt: "collision-probe-533074" };
    assert.equal(cassetteKey(A), "3138489782");
    assert.equal(cassetteKey(B), "3138489782");
    assert.notEqual(canonRequest(A), canonRequest(B));

    const aEnvelope = envelope("A-ANSWER");
    const store = createMemoryCassetteStore(
      tapeText([{ ...entryBody(A, aEnvelope), provenance: { producer: "model", model: aEnvelope.ok ? aEnvelope.model : "?", timestamp: FIXED_NOW, inputHash: "3138489782" } }]),
    );
    const rep = unwrap(await createCassette({ mode: "replay", store }));
    const res = await rep.wrap(forbiddenTransport)(B.prompt, {});
    assert.equal(res.ok, false);
    if (res.ok) throw new Error("unreachable");
    assert.equal(res.code, CASSETTE_MISS_CODE);
    assert.match(res.error ?? "", /FNV-1a collision/);
    assert.equal(JSON.stringify(res).includes("A-ANSWER"), false, "the other request's envelope must never be served");

    // Sanity: the recorded call itself still replays fine.
    const hit = await rep.wrap(forbiddenTransport)(A.prompt, {});
    assert.deepEqual(hit, aEnvelope);
  });
});

// ---------------------------------------------------------------------------
// 4. corrupt tapes fail closed at load
// ---------------------------------------------------------------------------

describe("corrupt or tampered tapes are refused at load", () => {
  async function loadRefusal(text: string) {
    const res = await createCassette({ mode: "replay", store: createMemoryCassetteStore(text) });
    assert.equal(res.ok, false);
    if (res.ok) throw new Error("unreachable");
    return res;
  }

  it("refuses non-JSON text", async () => {
    const res = await loadRefusal("{ not json");
    assert.equal(res.code, "RT_E_VALIDATION");
    assert.match(res.error, /not valid JSON/);
  });

  it("refuses an unsupported version instead of guessing", async () => {
    const res = await loadRefusal(tapeText([], { version: 99 }));
    assert.match(res.error, /version 99 is not supported/);
  });

  it("refuses an entry whose key does not match its request (tampered tape)", async () => {
    const entry = entryBody({ prompt: "tampered" });
    const res = await loadRefusal(tapeText([{ ...entry, key: "12345" }]));
    assert.match(res.error, /does not match its request/);
  });

  it("refuses a malformed request or response row", async () => {
    const badReq = await loadRefusal(tapeText([{ ...entryBody({ prompt: "x" }), request: { prompt: 5 } }]));
    assert.match(badReq.error, /malformed request/);
    const badRes = await loadRefusal(tapeText([{ ...entryBody({ prompt: "x" }), response: { ok: true } }]));
    assert.match(badRes.error, /malformed response envelope/);
    const badCode = await loadRefusal(
      tapeText([{ ...entryBody({ prompt: "x" }), response: { ok: false, reason: "error", code: "NOPE" } }]),
    );
    assert.match(badCode.error, /malformed response envelope/);
  });

  it("refuses a provenance block the T5.4 validator would drop", async () => {
    const entry = entryBody({ prompt: "bad provenance" });
    const res = await loadRefusal(
      tapeText([{ ...entry, provenance: { producer: "model", timestamp: FIXED_NOW, inputHash: entry.key } }]),
    );
    assert.match(res.error, /T5.4 validator refuses/);
  });
});

// ---------------------------------------------------------------------------
// 5. selection: off by default, exact values only
// ---------------------------------------------------------------------------

describe("selectCassette — off by default, explicit only", () => {
  it("an unset env yields an INERT cassette whose wrap IS the transport", async () => {
    const sel = await selectCassette({ env: {} });
    assert.equal(sel.ok, true);
    if (!sel.ok) throw new Error("unreachable");
    assert.equal(sel.cassette.mode, "off");
    assert.equal(sel.cassette.size(), 0);
    const log: string[] = [];
    const live = liveTransport(log);
    assert.equal(sel.cassette.wrap(live), live, "off mode must return the transport itself (identity)");
    const res = await sel.cassette.wrap(live)("still live", {});
    assert.equal(res.ok, true);
    assert.deepEqual(log, ["still live"]);
  });

  it("blank and 'off' values are inert; exact 'record'/'replay' arm it; sloppy values refuse", async () => {
    for (const value of ["", "   ", "off"]) {
      const sel = await selectCassette({ env: { [CASSETTE_MODE_ENV]: value } });
      assert.equal(sel.ok, true);
      if (sel.ok) assert.equal(sel.cassette.mode, "off");
    }
    for (const value of ["1", "true", "yes", "on", "RECORD", "Replay"]) {
      const sel = await selectCassette({ env: { [CASSETTE_MODE_ENV]: value } });
      assert.equal(sel.ok, false, `"${value}" must never arm a cassette`);
      if (!sel.ok) {
        assert.equal(sel.code, "RT_E_VALIDATION");
        assert.match(sel.error, /exact values only/);
      }
    }
  });

  it("an armed mode without a tape path is a coded refusal, not an implicit tape", async () => {
    const sel = await selectCassette({ env: { [CASSETTE_MODE_ENV]: "replay" } });
    assert.equal(sel.ok, false);
    if (!sel.ok) {
      assert.equal(sel.code, "RT_E_VALIDATION");
      assert.match(sel.error, new RegExp(CASSETTE_TAPE_ENV));
    }
  });

  it("exact env values arm the right mode over the named tape", async () => {
    await withTmpDir(async (dir) => {
      const path = join(dir, "tape.json");
      const env = { [CASSETTE_MODE_ENV]: "replay", [CASSETTE_TAPE_ENV]: path };
      const sel = await selectCassette({ env });
      assert.equal(sel.ok, true);
      if (sel.ok) {
        assert.equal(sel.cassette.mode, "replay");
        assert.equal(sel.cassette.tapePath, path);
      }
    });
  });

  it("the explicit param wins over the env, and needs a store or tapePath", async () => {
    const explicit = await selectCassette({ env: { [CASSETTE_MODE_ENV]: "record", [CASSETTE_TAPE_ENV]: "/nope" }, explicit: { mode: "replay", store: createMemoryCassetteStore() } });
    assert.equal(explicit.ok, true);
    if (explicit.ok) assert.equal(explicit.cassette.mode, "replay");

    const bad = await selectCassette({ explicit: { mode: "record" } });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.match(bad.error, /needs a store or a tapePath/);
  });
});

// ---------------------------------------------------------------------------
// 6. T5.4 consumption + the off-by-default wiring scan
// ---------------------------------------------------------------------------

describe("T5.4 provenance consumption", () => {
  it("mints producers from the closed ARTIFACT_PRODUCERS set", () => {
    const key = cassetteKey({ prompt: "producer probe" });
    const ok: LlmResult = { ok: true, text: "t", model: "deepseek-v4-flash" };
    const record = provenanceForServed("record", ok, key, FIXED_NOW);
    const replay = provenanceForServed("replay", ok, key, FIXED_NOW);
    assert.equal(record?.producer, "model");
    assert.equal(replay?.producer, "replay");
    assert.ok(ARTIFACT_PRODUCERS.includes("replay"), "T5.4 reserves 'replay' for this lane");
    assert.ok(record !== null && ARTIFACT_PRODUCERS.includes(record.producer));
    assert.ok(replay !== null && ARTIFACT_PRODUCERS.includes(replay.producer));
  });

  it("never mints a stamp T5.4 would drop: model id required, absent on refusals", () => {
    const key = cassetteKey({ prompt: "no stamp probe" });
    const failed: LlmResult = { ok: false, reason: "not-configured" };
    assert.equal(provenanceForServed("record", failed, key, FIXED_NOW), null);
    assert.equal(provenanceForServed("replay", failed, key, FIXED_NOW), null);
    // The would-be contradiction (producer "model" with no served model) is refused
    // by io.ts — so a cassette stamp can never be one the serializer drops.
    assert.equal(coerceArtifactProvenance({ producer: "model", timestamp: FIXED_NOW, inputHash: key }), null);
  });

  it("declares the shipped tape format version", () => {
    assert.equal(CASSETTE_VERSION, 1);
  });
});

describe("off by default: nothing in the pipeline is wired to the cassette", () => {
  const ROOT = new URL("../../", import.meta.url);
  const ALLOWED = new Set(["src/lib/cassette.ts", "src/lib/cassette.test.ts"]);

  it("no module imports src/lib/cassette.ts (the keyless eval cannot see it)", () => {
    const hits: string[] = [];
    for (const dir of ["src", "scripts"]) {
      for (const rel of readdirSync(new URL(dir + "/", ROOT), { recursive: true }) as string[]) {
        const posix = rel.split("\\").join("/");
        if (!/\.(ts|mts|mjs|js)$/.test(posix)) continue;
        const repoRel = `${dir}/${posix}`;
        if (ALLOWED.has(repoRel)) continue;
        const text = readFileSync(new URL(repoRel, ROOT), "utf8");
        // Only the module SPECIFIER counts — comments may name the row (io.ts does).
        if (/cassette\.ts|["'`]\.\/cassette["'`]/.test(text)) hits.push(repoRel);
      }
    }
    assert.deepEqual(hits, [], `the cassette must stay unwired (off by default); unwire or update this pin: ${hits.join(", ")}`);
  });

  it("scripts/run-eval.mjs carries no cassette mode at all", () => {
    const evalDriver = readFileSync(new URL("scripts/run-eval.mjs", ROOT), "utf8");
    assert.equal(/cassette/i.test(evalDriver), false, "the eval driver must not know about the cassette");
  });
});

// ---------------------------------------------------------------------------
// algo-tools.test.ts — algorithm workbench (register G-27/G-28/G-29, wave 3).
// Run: node --experimental-strip-types --test src/lib/algo-tools.test.ts
// ---------------------------------------------------------------------------
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  COMPLEXITY_CAVEAT,
  benchmarkHarness,
  complexityOf,
  exportedNamesOf,
  parseAlgorithmSpecJson,
  propertyTestsFor,
  specToAlgorithm,
} from "./algo-tools.ts";

const KEY = "DEEPSEEK_API_KEY";
const realFetch = globalThis.fetch;

beforeEach(() => {
  delete process.env[KEY];
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env[KEY];
});

function okResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Fixture sources (CommonJS `exports.x =` shape, as the verify lane expects)
// ---------------------------------------------------------------------------

const O1_SRC = "export const add = (a, b) => a + b;";

const ON_SRC = [
  "exports.max = (arr) => {",
  "  let m = arr[0];",
  "  for (let i = 1; i < arr.length; i++) {",
  "    if (arr[i] > m) m = arr[i];",
  "  }",
  "  return m;",
  "};",
].join("\n");

const ON2_SRC = [
  "exports.pairs = (xs) => {",
  "  const out = [];",
  "  for (let i = 0; i < xs.length; i++) {",
  "    for (let j = i + 1; j < xs.length; j++) {",
  "      out.push([xs[i], xs[j]]);",
  "    }",
  "  }",
  "  return out;",
  "};",
].join("\n");

const LOGN_SRC = [
  "exports.binSearch = (arr, target) => {",
  "  let lo = 0;",
  "  let hi = arr.length - 1;",
  "  while (lo <= hi) {",
  "    const mid = Math.floor((lo + hi) / 2);",
  "    if (arr[mid] === target) return mid;",
  "    if (arr[mid] < target) lo = mid + 1;",
  "    else hi = mid - 1;",
  "  }",
  "  return -1;",
  "};",
].join("\n");

const NLOGN_SRC = [
  "exports.f = (n) => {",
  "  let acc = 0;",
  "  for (let i = 0; i < n; i++) {",
  "    let j = n;",
  "    while (j > 1) {",
  "      j = Math.floor(j / 2);",
  "      acc++;",
  "    }",
  "  }",
  "  return acc;",
  "};",
].join("\n");

const MASK_SRC = [
  "// for (let k = 0; k < n; k++) { noop(); }",
  'const s = "while (x) { }";',
  "const t = `for (;;) { }`;",
  "const re = /for\\s*\\(/;",
  "exports.f = (arr) => {",
  "  for (let i = 0; i < arr.length; i++) {",
  "    arr[i] = arr[i] * 2;",
  "  }",
  "  return arr;",
  "};",
].join("\n");

const DOWHILE_SRC = [
  "exports.count = (n) => {",
  "  let i = 0;",
  "  do {",
  "    i++;",
  "  } while (i < n);",
  "  return i;",
  "};",
].join("\n");

// T-06 (109 C-03) fixtures — the halving probe is HEADER-only now:
// HDR_LOGN_SRC carries its halving step in the for-update (header) clause and
// must stay O(log n); BODY_HALF_SRC / BODY_DIV_SRC are the reproduced false
// positives (a `0.5` literal / `x / 2` in the BODY) and must publish O(n).
const HDR_LOGN_SRC = [
  "exports.halve = (n) => {",
  "  let acc = 0;",
  "  for (let i = n; i > 1; i /= 2) {",
  "    acc += i;",
  "  }",
  "  return acc;",
  "};",
].join("\n");

const BODY_HALF_SRC = [
  "exports.half = (a) => {",
  "  let s = 0;",
  "  for (const x of a) {",
  "    s += x * 0.5;",
  "  }",
  "  return s;",
  "};",
].join("\n");

const BODY_DIV_SRC = [
  "exports.avg = (a) => {",
  "  let s = 0;",
  "  for (const x of a) {",
  "    s += x / 2;",
  "  }",
  "  return s;",
  "};",
].join("\n");

// T-06: a linear loop CONTAINING a header-halving loop still reports O(n log n).
const NLOGN_HDR_SRC = [
  "exports.f = (n) => {",
  "  let acc = 0;",
  "  for (let i = 0; i < n; i++) {",
  "    for (let j = n; j > 1; j = Math.floor(j / 2)) {",
  "      acc++;",
  "    }",
  "  }",
  "  return acc;",
].join("\n");

// T10 (112 F5): a loop inside a `${…}` interpolation is CODE — the report may
// no longer claim O(1) about it (the reproduced false-optimistic report).
const INTERP_LOOP_SRC = [
  "exports.f = (items) => {",
  "  const rows = `${items.map((i) => { for (const x of items) { sink(x); } return i; })}`;",
  "  return rows;",
  "};",
].join("\n");

// Nested template inside an interpolation: the inner template's TEXT stays
// masked, its own loop-bearing interpolation is code (112 F5).
const NESTED_INTERP_SRC = [
  "const t = `${`${xs.map((v) => { while (v > 1) { v = v - 1; } return v; })}`}`;",
].join("\n");

const SORT_SRC = ["exports.sort = (arr) => arr.slice().sort((a, b) => a - b);"].join("\n");

const BENCH_SRC = [
  "// deterministic bubble-sort fixture (benchmark harness tests)",
  "exports.bubbleSort = (arr) => {",
  "  const a = arr.slice();",
  "  for (let i = 0; i < a.length; i++) {",
  "    for (let j = 1; j < a.length - i; j++) {",
  "      if (a[j - 1] > a[j]) {",
  "        const t = a[j - 1];",
  "        a[j - 1] = a[j];",
  "        a[j] = t;",
  "      }",
  "    }",
  "  }",
  "  return a;",
  "};",
].join("\n");

// ---------------------------------------------------------------------------
// complexityOf — static heuristic (G-29)
// ---------------------------------------------------------------------------

describe("complexityOf", () => {
  it("O(1): no loops at all", () => {
    const rep = complexityOf(O1_SRC);
    assert.equal(rep.notation, "O(1)");
    assert.equal(rep.loops, 0);
    assert.equal(rep.maxNesting, 0);
    assert.deepEqual(rep.lineRefs, []);
    assert.match(rep.caveat, /not a proof/);
  });

  it("O(n): one flat loop, with exact line refs", () => {
    const rep = complexityOf(ON_SRC);
    assert.equal(rep.notation, "O(n)");
    assert.equal(rep.loops, 1);
    assert.equal(rep.maxNesting, 1);
    assert.equal(rep.halvingLoops, 0);
    assert.deepEqual(rep.lineRefs, [3]);
  });

  it("O(n^2): nested loops", () => {
    const rep = complexityOf(ON2_SRC);
    assert.equal(rep.notation, "O(n^2)");
    assert.equal(rep.loops, 2);
    assert.equal(rep.maxNesting, 2);
    assert.deepEqual(rep.lineRefs, [3, 4]);
  });

  it("O(log n): halving loop whose halving step is in the HEADER (T-06 done-when)", () => {
    const rep = complexityOf(HDR_LOGN_SRC);
    assert.equal(rep.notation, "O(log n)");
    assert.equal(rep.halvingLoops, 1);
    assert.deepEqual(rep.lineRefs, [3]);
    assert.equal(rep.caveat, COMPLEXITY_CAVEAT, "a counted halving step needs no extra note");
  });

  // T-06 (109 C-03) — UPDATED EXPECTATION, deliberate (logged in
  // fixes/216c_algorithms.md): the halving probe is header-only, so this
  // fixture's `(lo + hi) / 2` — a BODY shape — no longer counts.
  // OLD: notation O(log n), halvingLoops 1. NEW: the conservative O(n) plus
  // the explicit body-halving note. A binary-search-shaped while loop is the
  // documented cost of the fix (the heuristic no longer guesses the step).
  it("binary-search body halving reports O(n) + the body-halving note (T-06)", () => {
    const rep = complexityOf(LOGN_SRC);
    assert.equal(rep.notation, "O(n)");
    assert.equal(rep.halvingLoops, 0);
    assert.deepEqual(rep.lineRefs, [4]);
    assert.match(rep.caveat, /body-level halving detected — not counted/);
  });

  it("O(n log n): linear loop containing a header-halving loop (T-06)", () => {
    const rep = complexityOf(NLOGN_HDR_SRC);
    assert.equal(rep.notation, "O(n log n)");
    assert.equal(rep.maxNesting, 2);
    assert.equal(rep.halvingLoops, 1);
    assert.deepEqual(rep.lineRefs, [3, 4]);
    assert.equal(rep.caveat, COMPLEXITY_CAVEAT);
  });

  // T-06 — UPDATED EXPECTATION, deliberate (logged): the same fixture whose
  // inner `while (j > 1) { j = Math.floor(j / 2); }` keeps its halving step in
  // the BODY. OLD: O(n log n), halvingLoops 1. NEW: O(n^2) + the note — the
  // downgrade is pinned exactly where the old optimistic claim used to sit.
  it("body-halving inner loop reads O(n^2) + the note, same fixture (T-06)", () => {
    const rep = complexityOf(NLOGN_SRC);
    assert.equal(rep.notation, "O(n^2)");
    assert.equal(rep.maxNesting, 2);
    assert.equal(rep.halvingLoops, 0);
    assert.deepEqual(rep.lineRefs, [3, 5]);
    assert.match(rep.caveat, /body-level halving detected — not counted/);
  });

  it("body-level `* 0.5` / `x / 2` no longer publishes O(log n) (T-06 done-when)", () => {
    for (const src of [BODY_HALF_SRC, BODY_DIV_SRC]) {
      const rep = complexityOf(src);
      assert.equal(rep.notation, "O(n)", "a linear loop whose body merely contains a halving SHAPE stays linear");
      assert.equal(rep.halvingLoops, 0);
      assert.deepEqual(rep.lineRefs, [3]);
      assert.equal(rep.caveat, `${COMPLEXITY_CAVEAT} body-level halving detected — not counted.`);
    }
  });

  it("counts loops inside template interpolations — no silent O(1) (T10/F5)", () => {
    const rep = complexityOf(INTERP_LOOP_SRC);
    assert.equal(rep.notation, "O(n)", "the n-loop inside `${…}` is code and is counted");
    assert.equal(rep.loops, 1);
    assert.equal(rep.maxNesting, 1);
    assert.deepEqual(rep.lineRefs, [2]);
  });

  it("handles a loop in a template nested inside an interpolation (T10/F5)", () => {
    const rep = complexityOf(NESTED_INTERP_SRC);
    assert.equal(rep.loops, 1);
    assert.equal(rep.notation, "O(n)");
    assert.deepEqual(rep.lineRefs, [1]);
  });

  it("ignores loops inside comments, strings, template literals and regex literals", () => {
    const rep = complexityOf(MASK_SRC);
    assert.equal(rep.loops, 1, "only the real `for` counts");
    assert.deepEqual(rep.lineRefs, [6]);
    assert.equal(rep.notation, "O(n)");
  });

  it("counts a do-while once (the terminator `while` is not a second loop)", () => {
    const rep = complexityOf(DOWHILE_SRC);
    assert.equal(rep.loops, 1);
    assert.deepEqual(rep.lineRefs, [3]);
    assert.equal(rep.notation, "O(n)");
  });

  it("is deterministic: same source -> identical report, twice", () => {
    const a = complexityOf(ON2_SRC);
    const b = complexityOf(ON2_SRC);
    assert.deepEqual(a, b);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });

  it("lineRefs equal the naive per-index oracle on a 40-loop source (T10/F6)", () => {
    // The single-pass line resolution must agree with the pre-T10 per-index
    // rescan on EVERY loop keyword, not only on the hand-written fixtures.
    const many = [
      "exports.many = (xs) => {",
      "  let acc = 0;",
      ...Array.from(
        { length: 40 },
        (_, k) => `  for (let i${k} = 0; i${k} < xs.length; i${k}++) { acc += xs[i${k}]; }`,
      ),
      "  return acc;",
      "};",
    ].join("\n");
    const naiveLineOf = (src: string, index: number): number => {
      let line = 1;
      for (let i = 0; i < index && i < src.length; i++) if (src[i] === "\n") line++;
      return line;
    };
    const naive: number[] = [];
    const re = /\bfor\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(many)) !== null) naive.push(naiveLineOf(many, m.index));
    const rep = complexityOf(many);
    assert.equal(rep.loops, 40, "guard never silently no-ops");
    assert.deepEqual(rep.lineRefs, naive);
    assert.deepEqual(rep.lineRefs, Array.from({ length: 40 }, (_, k) => 3 + k));
    assert.equal(rep.notation, "O(n)");
  });

  it("keeps the base COMPLEXITY_CAVEAT byte-stable; extras append, never replace (T-06)", () => {
    assert.equal(complexityOf(O1_SRC).caveat, COMPLEXITY_CAVEAT, "no extras -> the base string verbatim");
    const noted = complexityOf(BODY_HALF_SRC);
    assert.ok(noted.caveat.startsWith(COMPLEXITY_CAVEAT), "the base caveat leads, unchanged");
    assert.equal(noted.caveat.slice(COMPLEXITY_CAVEAT.length), " body-level halving detected — not counted.");
  });
});

// ---------------------------------------------------------------------------
// specToAlgorithm — LLM synthesis (G-27 keyed half)
// ---------------------------------------------------------------------------

describe("specToAlgorithm", () => {
  it("returns honest not-configured when the key is deleted (no fetch)", async () => {
    delete process.env[KEY];
    globalThis.fetch = (async () => {
      throw new Error("fetch must not run keyless");
    }) as typeof fetch;
    assert.deepEqual(await specToAlgorithm("spec text", "brief text"), {
      ok: false,
      reason: "not-configured",
      code: "RT_E_LLM_NOT_CONFIGURED",
    });
  });

  it("returns a parsed structured algorithm on success (flash, json:true)", async () => {
    process.env[KEY] = "sk-test";
    const captured: {
      body: {
        model?: unknown;
        messages?: Array<{ content?: string }>;
        response_format?: unknown;
        thinking?: unknown;
      };
    } = { body: {} };
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      captured.body = JSON.parse(String(init?.body));
      return okResponse({
        model: "deepseek-v4-flash",
        choices: [
          {
            message: {
              content:
                '{"name":"deadline-schedule","steps":["Sort jobs by deadline ascending","Pick each job greedily when it fits before its deadline"],"complexity":"O(n log n) — dominated by the deadline sort","edgeCases":["empty job list","deadline already past"]}',
            },
          },
        ],
      });
    }) as typeof fetch;
    const res = await specToAlgorithm("Schedule jobs by deadline.", "A dispatch tool.");
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.algorithm.name, "deadline-schedule");
      assert.equal(res.algorithm.steps.length, 2);
      assert.match(res.algorithm.complexity, /O\(n log n\)/);
      assert.deepEqual(res.algorithm.edgeCases, ["empty job list", "deadline already past"]);
    }
    assert.equal(captured.body.model, "deepseek-v4-flash");
    assert.deepEqual(captured.body.response_format, { type: "json_object" });
    assert.deepEqual(captured.body.thinking, { type: "disabled" });
    const messages = captured.body.messages ?? [];
    assert.match(messages[messages.length - 1]?.content ?? "", /Schedule jobs by deadline/);
  });

  it("never fabricates: an unparseable model reply is an honest error", async () => {
    process.env[KEY] = "sk-test";
    globalThis.fetch = (async () =>
      okResponse({
        model: "deepseek-v4-flash",
        choices: [{ message: { content: '{"name": 42}' } }],
      })) as typeof fetch;
    const res = await specToAlgorithm("spec", "brief");
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.reason, "error");
      assert.equal(res.error, "model returned an unparseable algorithm payload");
      assert.equal(res.code, "RT_E_VALIDATION");
    }
  });

  it("rejects empty spec/brief with RT_E_VALIDATION before any network call", async () => {
    process.env[KEY] = "sk-test";
    globalThis.fetch = (async () => {
      throw new Error("fetch must not run for validation failures");
    }) as typeof fetch;
    const res = await specToAlgorithm("   ", "brief");
    assert.deepEqual(res, {
      ok: false,
      reason: "error",
      error: "spec and brief must both be non-empty",
      code: "RT_E_VALIDATION",
    });
  });
});

describe("parseAlgorithmSpecJson", () => {
  it("parses valid payloads, tolerates fences, rejects garbage, is deterministic", () => {
    const fenced =
      '```json\n{"name":"x-algo","steps":["a","b"],"complexity":"O(n)","edgeCases":[]}\n```';
    const parsed = parseAlgorithmSpecJson(fenced);
    assert.ok(parsed !== null);
    if (parsed !== null) {
      assert.equal(parsed.name, "x-algo");
      assert.deepEqual(parsed.steps, ["a", "b"]);
      assert.deepEqual(parsed.edgeCases, []);
    }
    assert.deepEqual(parseAlgorithmSpecJson(fenced), parseAlgorithmSpecJson(fenced));
    assert.equal(parseAlgorithmSpecJson("not json at all"), null);
    assert.equal(parseAlgorithmSpecJson('{"name":"","steps":["a"],"complexity":"O(n)"}'), null);
    assert.equal(parseAlgorithmSpecJson('{"name":"x","steps":"nope","complexity":"O(n)"}'), null);
    assert.equal(parseAlgorithmSpecJson("[1,2,3]"), null);
  });
});

// ---------------------------------------------------------------------------
// propertyTestsFor — property-style cases in the VerifyCase shape (G-28)
// ---------------------------------------------------------------------------

describe("propertyTestsFor", () => {
  it("returns honest not-configured when the key is deleted (no fetch)", async () => {
    delete process.env[KEY];
    globalThis.fetch = (async () => {
      throw new Error("fetch must not run keyless");
    }) as typeof fetch;
    assert.deepEqual(await propertyTestsFor(SORT_SRC, "Sort arrays."), {
      ok: false,
      reason: "not-configured",
      code: "RT_E_LLM_NOT_CONFIGURED",
    });
  });

  it("returns VerifyCase-shaped property cases on success and names real exports in the prompt", async () => {
    process.env[KEY] = "sk-test";
    const captured: { body: { messages?: Array<{ content?: string }> } } = { body: {} };
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      captured.body = JSON.parse(String(init?.body));
      return okResponse({
        model: "deepseek-v4-flash",
        choices: [
          {
            message: {
              content:
                '{"cases":[{"id":"sort-idempotent","expression":"JSON.stringify(sort(sort([3,1,2]))) === JSON.stringify(sort([3,1,2]))"},{"id":"sort-permutation","expression":"(() => { const a = [3,1,2]; const s = sort(a); return s.length === a.length && a.every(v => s.includes(v)); })()"}]}',
            },
          },
        ],
      });
    }) as typeof fetch;
    const res = await propertyTestsFor(SORT_SRC, "Sort arrays.");
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.cases.length, 2);
      assert.deepEqual(
        res.cases.map((c) => c.id),
        ["sort-idempotent", "sort-permutation"],
      );
      for (const c of res.cases) {
        assert.ok(c.id.length > 0 && c.expression.trim().length > 0, "VerifyCase shape holds");
      }
    }
    const messages = captured.body.messages ?? [];
    const prompt = messages[messages.length - 1]?.content ?? "";
    assert.match(prompt, /PROPERTY-style/);
    assert.match(prompt, /exports these names ONLY/);
    assert.match(prompt, /\bsort\b/); // export inventory surfaced honestly in the prompt
  });
});

// ---------------------------------------------------------------------------
// benchmarkHarness — generated node:test benchmark file body (G-27 static half)
// ---------------------------------------------------------------------------

describe("benchmarkHarness", () => {
  it("is byte-deterministic and structurally complete (node:test + perf + complexity claim)", () => {
    const a = benchmarkHarness(BENCH_SRC, "Sort numbers fast.");
    const b = benchmarkHarness(BENCH_SRC, "Sort numbers fast.");
    assert.equal(a, b, "same input -> byte-identical body");
    assert.notEqual(
      benchmarkHarness(BENCH_SRC, "Different brief."),
      a,
      "the brief is wired into the header",
    );
    assert.match(a, /import \{ test \} from "node:test"/);
    assert.match(a, /performance\.now/);
    assert.match(a, /BENCH /);
    assert.match(a, /ns\/op/);
    assert.match(a, /O\(n\^2\)/, "complexity claim from the static scan lands in the header");
    assert.ok(a.includes("exports.bubbleSort"), "source embedded verbatim");
    assert.ok(!a.includes("deepseek"), "zero LLM surface in the static harness");
    assert.equal(complexityOf(BENCH_SRC).notation, "O(n^2)");
  });

  it("generated body really runs under node and times the export", () => {
    const body = benchmarkHarness(BENCH_SRC, "Sort numbers fast.");
    const dir = mkdtempSync(join(tmpdir(), "rt-bench-"));
    const file = join(dir, "bench.mjs");
    try {
      writeFileSync(file, body, "utf8");
      let stdout = "";
      assert.doesNotThrow(() => {
        stdout = execFileSync(process.execPath, [file], {
          encoding: "utf8",
          timeout: 60_000,
          windowsHide: true,
        });
      }, "node:test run must exit 0 (a failing test exits non-zero)");
      assert.match(stdout, /BENCH bubbleSort \d+ ns\/op/, "timing row for the export");
      assert.ok(!/not ok/.test(stdout), `every node:test case passed:\n${stdout}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 109 T-08 — exportedNamesOf CJS detection: only REAL module exports. The old
// single regex's `module\.` alternative matched the TAIL of
// `my_module.exports.x`, so the property-case prompt advertised a phantom
// export. The first test's rows are the dossier's own probe set (W3-L5).
// ---------------------------------------------------------------------------

describe("exportedNamesOf — CJS export detection (109 T-08)", () => {
  it("probe rows: member-chain tails are never reported as module exports", () => {
    assert.deepEqual(exportedNamesOf("my_module.exports.x = 1;"), [], "mid-identifier tail never counts");
    assert.deepEqual(exportedNamesOf("obj.exports.y = 2;"), [], "member chain never counts");
    assert.deepEqual(exportedNamesOf("module.exports.z = 3;"), ["z"]);
    assert.deepEqual(exportedNamesOf("exports.real = 4;"), ["real"]);
  });

  it("masking still holds: comment/string lookalikes never become exports", () => {
    assert.deepEqual(
      exportedNamesOf("// exports.fake = 1;\n/* module.exports.alsoFake = 2; */"),
      [],
      "prose that looks like an export is not one",
    );
    assert.deepEqual(exportedNamesOf('const s = "exports.str = 3;";'), []);
  });

  it("mixes CJS + ESM declarations: sorted, deduped union", () => {
    const src = [
      "exports.gamma = 3;",
      "module.exports.beta = 2;",
      "export const alpha = 1;",
      "export function delta() {}",
    ].join("\n");
    assert.deepEqual(exportedNamesOf(src), ["alpha", "beta", "delta", "gamma"]);
  });
});

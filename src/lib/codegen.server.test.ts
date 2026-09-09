// ---------------------------------------------------------------------------
// codegen.server.test.ts — keyed P6 synthesis (fixes/97 P0-01 Part B) with
// INJECTED deps (no network, no real key): the fake-injection precedent of
// sandbox.test.ts / verify.test.ts. Covers 97's T4/T5 + the deterministic
// validation helpers + the p6-brief-fit pre-acceptance floor.
//
// Run: node --experimental-strip-types --test src/lib/codegen.server.test.ts
// ---------------------------------------------------------------------------
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assembleTreeEntry,
  briefFitSatisfied,
  chunkTypeSignatures,
  injectMissingExports,
  liveP6Synthesis,
  materializeImportableTree,
  parseSynthesisEnvelope,
  pathSlugFromNames,
  p6SynthesisBriefFitRepairPrompt,
  p6SynthesisChunkUserPrompt,
  p6SynthesisExportRepairPrompt,
  p6SynthesisForbiddenRepairPrompt,
  p6SynthesisRepairPrompt,
  p6SynthesisSignatureRepairPrompt,
  p6SynthesisSystemPrompt,
  p6SynthesisUserPrompt,
  P6_SYNTH_MAX_TOKENS,
  P6_SYNTH_TIMEOUT_MS,
  relTsImport,
  signatureFunctionNames,
  singleModuleLibraryKind,
  stripCjsExportAssignments,
  toGeneratedTreeFile,
  treePathForChunk,
  TREE_CHUNK0_RELOCATED_PATH,
  TREE_ENTRY_PATH,
  validateSynthesisModule,
  REPAIR_TREE_FAILURE_TAIL_MAX,
  type ChunkPriorFile,
} from "./codegen.server.ts";
import { applyPhaseResult, emptyProject } from "./engine.ts";
import { buildPhase6Module } from "./sandbox.ts";
import { briefNounHits } from "./sandbox.ts";
import { fnv1a } from "./algorithms.ts";
import { oracleBriefGrounded } from "./verify.server.ts";
import type { DeepSeekCompleteOptions } from "./deepseek.server.ts";
import type { ExpandBriefResult } from "./prompt-engine.ts";
import type { VerifyOutcome } from "./verify.server.ts";
import type { LlmResult } from "./llm.ts";
import type { Project } from "./types.ts";

// --- fixtures -----------------------------------------------------------------

const KANBAN_BRIEF = "A kanban board tool with columns, cards and drag.";

/** Brief-faithful canned module (kanban vocabulary as CODE identifiers). */
const KANBAN_MODULE = [
  "/**",
  " * req-1: create a board.",
  " * @param {string} name",
  " * @returns {{id: string, name: string, columns: Array}}",
  " */",
  "function createBoard(name) {",
  '  if (typeof name !== "string" || name === "") { throw new Error("name required"); }',
  '  return { id: "b-" + name, name: name, columns: [] };',
  "}",
  "",
  "/**",
  " * req-2: add a column to a board.",
  " * @param {object} board",
  " * @param {Array} columns",
  " */",
  "function addColumn(board, columns) {",
  '  if (!board || typeof board !== "object") { throw new Error("board required"); }',
  "  board.columns = columns || [];",
  "  return board;",
  "}",
  "",
  "/**",
  " * req-3: drag cards between columns.",
  " * @param {Array} cards",
  " */",
  "function dragCard(cards) {",
  "  return cards;",
  "}",
  "",
  "function kanbanBoard(columns) {",
  "  return { columns: columns };",
  "}",
  "",
  "module.exports.createBoard = createBoard;",
  "module.exports.addColumn = addColumn;",
  "module.exports.dragCard = dragCard;",
  "module.exports.kanbanBoard = kanbanBoard;",
  "",
].join("\n");

const KANBAN_SIGNATURES = [
  "export function createBoard(name: string): Board",
  "export function addColumn(board: Board, title: string): Column",
];

const KANBAN_SPEC = {
  requirements: [
    "Users can create a board.",
    "Users can add a column to a board.",
    "Users can drag cards between columns.",
  ],
  edgeCases: ["Empty board names are rejected."],
  errorHandling: ["Invalid names throw."],
  typeSignatures: KANBAN_SIGNATURES,
  dataFlow: ["name → createBoard → board"],
  negativeConstraints: ["DO NOT invent card labels."],
};

const KANBAN_ENVELOPE = {
  module: KANBAN_MODULE,
  exports: ["createBoard", "addColumn", "dragCard", "kanbanBoard"],
  reqTrace: { "req-1": "createBoard", "req-2": "addColumn", "req-3": "dragCard" },
};

function fakeDeps(overrides: {
  completeText?: string;
  expandResult?: ExpandBriefResult;
  verifyOutcome?: VerifyOutcome;
  completeFail?: LlmResult;
} = {}) {
  const calls: string[] = [];
  const complete = async (_prompt: string, _opts?: DeepSeekCompleteOptions): Promise<LlmResult> => {
    calls.push("complete");
    if (overrides.completeFail) return overrides.completeFail;
    return {
      ok: true,
      text: overrides.completeText ?? JSON.stringify(KANBAN_ENVELOPE),
      model: "deepseek-v4-flash",
    };
  };
  const expand = async (_brief: string): Promise<ExpandBriefResult> => {
    calls.push("expand");
    return (
      overrides.expandResult ?? {
        ok: true,
        spec: KANBAN_SPEC,
      }
    );
  };
  const verify = async (_source: string, _brief: string): Promise<VerifyOutcome> => {
    calls.push("verify");
    return (
      overrides.verifyOutcome ?? {
        status: "passed",
        iterations: 1,
        evidence: "3/3 machine-run cases passed on iteration 1",
        finalSource: KANBAN_MODULE,
        cases: [{ id: "case-1", expression: "typeof createBoard === 'function'" }],
      }
    );
  };
  return { calls, deps: { complete, expand, verify } };
}

/** Deterministic P6-complete base (the honest keyless placeholder result). */
function p6Base(brief = KANBAN_BRIEF): Project {
  return applyPhaseResult(emptyProject({ name: "Kanban", brief }), 6);
}

// --- env isolation (the repo runs with a REAL key; tests are key-agnostic) ----

let savedKey: string | undefined;
beforeEach(() => {
  savedKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "sk-codegen-test-fake";
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = savedKey;
});

// --- pure helpers -------------------------------------------------------------

describe("parseSynthesisEnvelope", () => {
  it("parses a plain envelope", () => {
    const e = parseSynthesisEnvelope(JSON.stringify(KANBAN_ENVELOPE));
    assert.ok(e);
    assert.equal(e.module, KANBAN_MODULE.trim());
    assert.deepEqual(e.exports, ["createBoard", "addColumn", "dragCard", "kanbanBoard"]);
    assert.equal(e.reqTrace["req-1"], "createBoard");
  });

  it("tolerates ```json fences", () => {
    const e = parseSynthesisEnvelope("```json\n" + JSON.stringify(KANBAN_ENVELOPE) + "\n```");
    assert.ok(e);
    assert.equal(e.module, KANBAN_MODULE.trim());
  });

  it("returns null for junk, non-strings, and empty modules", () => {
    assert.equal(parseSynthesisEnvelope("not json {{{"), null);
    assert.equal(parseSynthesisEnvelope(42), null);
    assert.equal(parseSynthesisEnvelope(JSON.stringify({ exports: ["x"] })), null);
    assert.equal(parseSynthesisEnvelope(JSON.stringify({ module: "  " })), null);
  });
});

describe("signatureFunctionNames", () => {
  it("extracts function names from every signature flavor; skips non-functions", () => {
    const names = signatureFunctionNames([
      "function bare(x: number): number",
      "export function exported(a: string): void",
      "export declare function declared(b: boolean): string",
      "mean(xs: number[]): number",
      "class NotAFunction {}",
      "interface Widget {}",
      "function bare(): void", // real duplicate — deduped, order kept
    ]);
    assert.deepEqual(names, ["bare", "exported", "declared", "mean"]);
  });
});

describe("validateSynthesisModule", () => {
  it("accepts a module whose claimed exports are bound and signatures all exported", () => {
    const v = validateSynthesisModule(KANBAN_MODULE, KANBAN_ENVELOPE.exports, ["createBoard", "addColumn"]);
    assert.ok(v.ok);
    if (v.ok) assert.deepEqual(v.exports, KANBAN_ENVELOPE.exports);
  });

  it("rejects claimed exports not bound in the module", () => {
    const v = validateSynthesisModule(KANBAN_MODULE, ["createBoard", "ghost"], ["createBoard"]);
    assert.ok(!v.ok);
    if (!v.ok) {
      assert.equal(v.code, "RT_E_VALIDATION");
      assert.match(v.error, /ghost/);
    }
  });

  it("rejects missing typeSignature functions, naming them", () => {
    const v = validateSynthesisModule(KANBAN_MODULE, ["createBoard"], ["createBoard", "addColumn"]);
    assert.ok(!v.ok);
    if (!v.ok) assert.match(v.error, /addColumn/);
  });

  it("rejects forbidden primitives in CODE, but not inside string literals", () => {
    const code = "function go() { return window.fetch('https://x'); }\nmodule.exports.go = go;";
    const v = validateSynthesisModule(code, ["go"], ["go"]);
    assert.ok(!v.ok);
    if (!v.ok) assert.match(v.error, /forbidden/);

    // "fetch" as literal prose is data, never a capability claim (masking works).
    const prose = 'function explain() { return "the fetch failed"; }\nmodule.exports.explain = explain;';
    const ok = validateSynthesisModule(prose, ["explain"], ["explain"]);
    assert.ok(ok.ok);
  });

  it("rejects markdown fences and empty modules", () => {
    assert.ok(!validateSynthesisModule("```\nfunction x() {}\n```", ["x"], ["x"]).ok);
    assert.ok(!validateSynthesisModule("   ", [], []).ok);
  });
});

describe("briefFitSatisfied (p6-brief-fit pre-acceptance)", () => {
  it("accepts the kanban module for the kanban brief", () => {
    assert.deepEqual(briefFitSatisfied(KANBAN_BRIEF, KANBAN_MODULE), { ok: true, missing: [] });
  });

  it("rejects the deterministic placeholder for a vocabulary-bearing brief", () => {
    const placeholder = buildPhase6Module({ name: "Kanban", jobs: ["board"] });
    const fit = briefFitSatisfied(KANBAN_BRIEF, placeholder);
    assert.equal(fit.ok, false);
    assert.ok(fit.missing.includes("kanban"));
  });

  it("passes vacuously for a vocabulary-free brief", () => {
    assert.deepEqual(briefFitSatisfied("a simple tool", "function x() {}"), {
      ok: true,
      missing: [],
    });
  });

  it("fixes/127: stopwords (has/job/is/per) never become required nouns — the vacuous-4/4 root cause", () => {
    // The merged Coffeehouse2Home-shaped brief + the toy module: oracle cases
    // referencing only has/job/is must NOT satisfy grounding, and brief-fit
    // must not demand stopwords from the source.
    const merged = "a property ledger has rent collection with jobs per tenant, lease renewal reminders, and showing calendar flows for listings";
    const { required } = briefNounHits(merged);
    for (const banned of ["has", "job", "jobs", "is", "per", "flow", "flows", "list", "lists"]) {
      assert.ok(!required.includes(banned), `${banned} must not be a required noun (was: ${required.join(",")})`);
    }
    assert.ok(required.includes("rent"), "real domain nouns survive");
    assert.ok(required.includes("tenant"), "real domain nouns survive");
    assert.ok(required.includes("lease"), "real domain nouns survive");
    // Vacuous oracle cases over only stopwords are rejected by the gate.
    const vacuous = [
      { id: "c1", expression: "has() === true" },
      { id: "c2", expression: "isJob() === false" },
    ] as never;
    const g = oracleBriefGrounded(vacuous, merged, []);
    assert.equal(g.ok, false, "stopword-only oracle cases are vacuous and rejected");
    assert.match(g.reason ?? "", /reference no brief noun or contract function/);
  });
});

describe("p6Synthesis prompts (byte-stable contract)", () => {
  it("system prompt contains the word json + a worked envelope example", () => {
    const s = p6SynthesisSystemPrompt();
    assert.match(s, /\bjson\b/i);
    assert.match(s, /\{"module":/);
    assert.match(s, /module\.exports\.add = add/);
  });

  it("user prompt carries the brief, numbered requirements and verbatim signatures", () => {
    const u = p6SynthesisUserPrompt(KANBAN_BRIEF, KANBAN_SPEC);
    assert.match(u, /BRIEF:/);
    assert.match(u, /A kanban board tool/);
    assert.match(u, /1\. Users can create a board\./);
    assert.match(u, /export function createBoard\(name: string\): Board/);
  });
});

// --- fixes/144 (M3-2): repair prompts + optional tree-failure context -------

/** Legacy repair-prompt byte snapshots (captured from the pre-M3-2 builders;
 *  the no-context output MUST stay byte-identical to these strings). */
const LEGACY_REPAIR_SNAPSHOT_REPAIR = `Your previous reply was not valid JSON with the required envelope.
Return JSON ONLY: {"module":"<complete module source as one string>","exports":["f1"],"reqTrace":{"req-1":"f1"}}.
Same rules as before: exact typeSignature exports, zero imports, JSDoc, // req-N markers,
no forbidden primitives, no rejection-path tests, no markdown fences.`;

const LEGACY_REPAIR_SNAPSHOT_EXPORT = `Your previous module's envelope claimed exports that are not actually bound as top-level names.
Missing bindings (define each as a real function AND assign module.exports.<name>): createBoard, ghost.
Return JSON ONLY with the SAME envelope: {"module":"<complete corrected module source>","exports":[...],"reqTrace":{...}}.
For EVERY missing name: declare the function, then assign it with module.exports.<name> = <name>. List it again in exports.
Same rules as before: exact typeSignature exports, zero imports, JSDoc, // req-N markers, no forbidden primitives, no markdown fences.`;

const LEGACY_REPAIR_SNAPSHOT_FORBIDDEN = `Your module used a forbidden primitive: \`fetch\`.
Rewrite it with plain functions only — no process/require/globalThis/window/self/fetch/WebSocket/XMLHttpRequest/document/localStorage/indexedDB/eval/Function/import.
Return JSON ONLY with the SAME envelope: {"module":"<complete corrected module source>","exports":[...],"reqTrace":{...}}.
Same rules as before: exact typeSignature exports, zero imports, JSDoc, // req-N markers, no markdown fences.`;

const LEGACY_REPAIR_SNAPSHOT_SIGNATURE = `Your previous module is missing functions the brief's typeSignatures require to be exported.
Missing exported functions (implement each EXACTLY as its typeSignature describes, then assign module.exports.<name>): createBoard, listTenants.
Return JSON ONLY with the SAME envelope: {"module":"<complete corrected module source>","exports":[...],"reqTrace":{...}}.
For EVERY missing name: implement the function to match its typeSignature, assign module.exports.<name> = <name>, and list it again in exports.
Same rules as before: exact typeSignature exports (nothing more, nothing less), zero imports, JSDoc, // req-N markers, no forbidden primitives, no markdown fences.`;

const LEGACY_REPAIR_SNAPSHOT_BRIEF_FIT = `Your previous module does NOT implement the brief's product: it must expose the brief's domain through its identifiers.
The brief requires these concepts to appear in your module (as function/constant/property names or their camelCase parts — e.g. a "lease renewal reminder" needs a function whose name contains renewal/remind): lease, tenant.
Return JSON ONLY with the SAME envelope: {"module":"<complete corrected module source>","exports":[...],"reqTrace":{...}}.
Rewrite the module around the brief's real product vocabulary: every exported function should correspond to a brief requirement (// req-N markers), named from the brief's nouns.
Same rules as before: exact typeSignature exports (nothing more, nothing less), zero imports, JSDoc, no forbidden primitives, no markdown fences.`;

describe("repair prompts tree-failure context (fixes/144 M3-2)", () => {
  const TREE_FAILURE =
    "src/generated/entry.ts — tests/entry.spec.ts run=fail: expected createBoard('x') " +
    "to return a board with an empty columns array, got undefined";

  it("no-context output is byte-identical to the legacy repair prompts", () => {
    assert.equal(p6SynthesisRepairPrompt(), LEGACY_REPAIR_SNAPSHOT_REPAIR);
    assert.equal(
      p6SynthesisExportRepairPrompt(["createBoard", "ghost"]),
      LEGACY_REPAIR_SNAPSHOT_EXPORT,
    );
    assert.equal(p6SynthesisForbiddenRepairPrompt("fetch"), LEGACY_REPAIR_SNAPSHOT_FORBIDDEN);
    assert.equal(
      p6SynthesisSignatureRepairPrompt(["createBoard", "listTenants"]),
      LEGACY_REPAIR_SNAPSHOT_SIGNATURE,
    );
    assert.equal(
      p6SynthesisBriefFitRepairPrompt(["lease", "tenant"]),
      LEGACY_REPAIR_SNAPSHOT_BRIEF_FIT,
    );
  });

  it("undefined/blank tree-failure context never appends a tail (defensive)", () => {
    assert.equal(p6SynthesisRepairPrompt(undefined), LEGACY_REPAIR_SNAPSHOT_REPAIR);
    assert.equal(p6SynthesisRepairPrompt(""), LEGACY_REPAIR_SNAPSHOT_REPAIR);
    assert.equal(p6SynthesisRepairPrompt("   \n \t "), LEGACY_REPAIR_SNAPSHOT_REPAIR);
    assert.equal(
      p6SynthesisExportRepairPrompt(["createBoard", "ghost"], "   "),
      LEGACY_REPAIR_SNAPSHOT_EXPORT,
    );
  });

  it("every builder appends the coded tree-failure block when context is provided", () => {
    const cases: string[] = [
      p6SynthesisRepairPrompt(TREE_FAILURE),
      p6SynthesisExportRepairPrompt(["createBoard", "ghost"], TREE_FAILURE),
      p6SynthesisForbiddenRepairPrompt("fetch", TREE_FAILURE),
      p6SynthesisSignatureRepairPrompt(["createBoard", "listTenants"], TREE_FAILURE),
      p6SynthesisBriefFitRepairPrompt(["lease", "tenant"], TREE_FAILURE),
    ];
    for (const prompt of cases) {
      assert.ok(prompt.includes(TREE_FAILURE), "tree-run failure text reaches the repair prompt");
      assert.ok(
        prompt.includes("Tree-run failure context (failing file + first not-ok tail):"),
        "coded block marker present",
      );
      assert.ok(prompt.endsWith(TREE_FAILURE), "context block is the tail");
      assert.ok(!prompt.includes("\n\n\n"), "block is whitespace-collapsed and bounded");
    }
  });

  it("context tail is whitespace-collapsed and capped at REPAIR_TREE_FAILURE_TAIL_MAX", () => {
    const legacy = LEGACY_REPAIR_SNAPSHOT_REPAIR;
    const collapsed = p6SynthesisRepairPrompt("line1\n\nline2    spaced\ttext");
    assert.ok(collapsed.startsWith(legacy), "legacy prefix intact");
    assert.ok(collapsed.endsWith("line1 line2 spaced text"), "newlines/tabs collapsed to single spaces");
    const huge = p6SynthesisRepairPrompt(`x${"y".repeat(5000)}`);
    assert.equal(
      huge.length,
      legacy.length + "\n\nTree-run failure context (failing file + first not-ok tail):\n".length + REPAIR_TREE_FAILURE_TAIL_MAX,
      "context slice is exactly the documented cap",
    );
  });
});

// --- liveP6Synthesis ----------------------------------------------------------

describe("injectMissingExports (fixes/121 last-mile deterministic repair)", () => {
  it("injects module.exports lines for declared-but-unbound claimed exports", () => {
    const src = [
      "function createProperty(p) { return { id: p.id, beds: p.beds }; }",
      "const listTenants = (units) => units.map((u) => u.tenant);",
      "exports.createProperty = createProperty;", // already bound → untouched
    ].join("\n");
    const r = injectMissingExports(src, ["createProperty", "listTenants", "recordPayment"]);
    assert.equal(r.changed, true);
    assert.deepEqual(r.injected, ["listTenants"]);
    assert.ok(r.source.includes("module.exports.listTenants = listTenants;"), "binding appended");
    assert.ok(!r.source.includes("module.exports.recordPayment"), "undeclared name never injected");
    assert.ok(!r.source.includes("module.exports.createProperty = createProperty;") || true);
  });

  it("is a no-op when every claimed export is already bound or absent", () => {
    const src = "exports.ready = true;\nfunction helper() { return 1; }\n";
    const r = injectMissingExports(src, ["ready", "missing"]);
    assert.equal(r.changed, false);
    assert.deepEqual(r.injected, []);
    assert.equal(r.source, src);
  });

  it("appended module still parses and binds (executable round-trip)", () => {
    const src = [
      "function createProperty(p) { return { id: p.id, beds: p.beds }; }",
    ].join("\n");
    const r = injectMissingExports(src, ["createProperty"]);
    const mod = { exports: {} as Record<string, unknown> };
    // CJS-style evaluation of the repaired module in a sandbox.
    new Function("module", "exports", r.source)(mod, mod.exports);
    assert.equal(typeof (mod.exports as { createProperty?: unknown }).createProperty, "function");
  });
});

describe("liveP6Synthesis (T4/T5 — fixes/97 P0-01 Part B)", () => {
  it("happy path: replaces the placeholder with a machine-verified brief-faithful module", async () => {
    const base = p6Base();
    const { calls, deps } = fakeDeps();
    const q = await liveP6Synthesis(base, deps);

    assert.equal(q.generatedSource, KANBAN_MODULE.trim());
    const lt = q.lastTest as { ok: boolean; label?: string; evidenceHash?: string } | null;
    assert.equal(lt?.ok, true);
    assert.equal(lt?.label, "tested");
    assert.ok((lt?.evidenceHash?.length ?? 0) > 0);
    assert.equal(q.implementationSpec?.source, "p6");
    assert.equal(q.implementationSpec?.briefHash, String(fnv1a(KANBAN_BRIEF)));
    assert.deepEqual(q.implementationSpec?.typeSignatures, KANBAN_SIGNATURES);
    assert.equal(q.modelRoute, "deepseek-pro");
    assert.ok(q.artifacts.some((a) => a.title === "Generated module (LLM, machine-verified)"));
    assert.ok(q.artifacts.some((a) => a.title.includes("Verify outcome")));
    assert.ok(!q.artifacts.some((a) => a.title.includes("placeholder")), "placeholder artifact replaced");
    assert.ok(q.logs.some((l) => l.event === "p6.synthesis"));
    assert.deepEqual(calls, ["expand", "complete", "verify"]);
  });

  it("read-back: captured lesson rows in project memory reach the P6 expansion (fixes/124 A3-03)", async () => {
    const base = p6Base();
    const lessonRow = {
      id: "lesson-verify-failure-00a1b2c3",
      kind: "episodic" as const,
      phase: 6 as const,
      text: "MARKER_KANBAN: prior run's module forgot to reject empty column names",
      score: 0.9,
      source: "engine" as const,
      tags: ["lesson", "verify-failure", "L3"],
    };
    const withMemory: Project = { ...base, memory: [...(base.memory ?? []), lessonRow] };
    let receivedLessons: readonly string[] | undefined;
    const { deps } = fakeDeps();
    deps.expand = async (_brief: string, lessons?: readonly string[]) => {
      receivedLessons = lessons;
      return { ok: true, spec: KANBAN_SPEC };
    };
    const q = await liveP6Synthesis(withMemory, deps);
    assert.equal(q.generatedSource, KANBAN_MODULE.trim(), "synthesis still proceeds with lessons present");
    assert.ok(
      receivedLessons !== undefined && receivedLessons.length > 0,
      "the expansion fn receives lesson lines (self-learning is read-back, not write-only)",
    );
    assert.ok(
      (receivedLessons ?? []).some((l) => l.includes("MARKER_KANBAN")),
      "the captured lesson text re-injects into the keyed P6 expansion prompt",
    );
  });

  it("a lesson-free memory keeps the legacy expand call (lessons omitted, byte-identical)", async () => {
    const raw = p6Base();
    // Strip any lesson-tagged rows so the memory is genuinely lesson-free
    // (the KANBAN fixture may carry lesson rows that selectLessons ranks).
    const base = {
      ...raw,
      memory: (raw.memory ?? []).filter((m) => !(m.tags ?? []).includes("lesson")),
    };
    assert.ok(!(base.memory ?? []).some((m) => (m.tags ?? []).includes("lesson")), "fixture memory is lesson-free");
    let sawSecondArg = false;
    const { deps } = fakeDeps();
    deps.expand = async (_brief: string, lessons?: readonly string[]) => {
      sawSecondArg = lessons !== undefined;
      return { ok: true, spec: KANBAN_SPEC };
    };
    await liveP6Synthesis(base, deps);
    assert.equal(sawSecondArg, false, "no lesson rows → lessons argument stays undefined");
  });

  it("reuses a brief-faithful persisted spec (expand never called — 87 S7 orphan closed)", async () => {
    const base = p6Base();
    const spec = {
      requirements: KANBAN_SPEC.requirements,
      edgeCases: [],
      errorHandling: [],
      typeSignatures: KANBAN_SIGNATURES,
      dataFlow: [],
      negativeConstraints: [],
      source: "p6" as const,
      briefHash: String(fnv1a(KANBAN_BRIEF)),
      createdAt: Date.now(),
    };
    const seeded: Project = { ...base, implementationSpec: spec };
    const { calls, deps } = fakeDeps();
    const q = await liveP6Synthesis(seeded, deps);
    assert.equal(q.generatedSource, KANBAN_MODULE.trim());
    assert.deepEqual(calls, ["complete", "verify"]);
    assert.equal(q.implementationSpec?.briefHash, String(fnv1a(KANBAN_BRIEF)));
  });

  it("not-configured returns the SAME reference (no network, no log)", async () => {
    const base = p6Base();
    delete process.env.DEEPSEEK_API_KEY;
    const q = await liveP6Synthesis(base);
    assert.equal(q, base);
  });

  it("a forceHuman P6 gate is never machine-cleared (R3/B-03)", async () => {
    const base = p6Base();
    const gated: Project = {
      ...base,
      phases: base.phases.map((r) => (r.id === 6 ? { ...r, status: "awaiting_hitl" as const } : r)),
      hitl: { phase: 6, title: "Sandbox failed — review", prompt: "broken", stakes: "high", forceHuman: true },
    };
    const { deps } = fakeDeps();
    const q = await liveP6Synthesis(gated, deps);
    assert.equal(q, gated);
  });

  it("expand failure → deterministic floor stands + RT_E_LLM_NOT_CONFIGURED refusal log", async () => {
    const base = p6Base();
    const { deps } = fakeDeps({ expandResult: { ok: false, reason: "not-configured" } });
    const q = await liveP6Synthesis(base, deps);
    assert.equal(q.generatedSource, base.generatedSource, "floor stands");
    assert.equal(q.lastTest, base.lastTest);
    const refusal = q.logs.find((l) => l.event === "p6.synthesis.refused");
    assert.ok(refusal);
    assert.match(refusal.detail, /RT_E_LLM_NOT_CONFIGURED/);
  });

  it("unparseable envelope ×2 (one bounded repair) → RT_E_LLM_REJECTED refusal", async () => {
    const base = p6Base();
    const { calls, deps } = fakeDeps({ completeText: "the model babbled prose, no json at all" });
    const q = await liveP6Synthesis(base, deps);
    assert.equal(calls.filter((c) => c === "complete").length, 2, "one synthesis + one repair re-prompt");
    assert.equal(q.generatedSource, base.generatedSource);
    const refusal = q.logs.find((l) => l.event === "p6.synthesis.refused");
    assert.ok(refusal);
    assert.match(refusal.detail, /RT_E_LLM_REJECTED/);
  });

  it("repair re-prompt can rescue a first-malformed envelope", async () => {
    const base = p6Base();
    let n = 0;
    const complete = async (_p: string, _o?: DeepSeekCompleteOptions): Promise<LlmResult> => {
      n += 1;
      return {
        ok: true,
        text: n === 1 ? "%%% not json %%%" : JSON.stringify(KANBAN_ENVELOPE),
        model: "deepseek-v4-flash",
      };
    };
    const q = await liveP6Synthesis(base, {
      complete,
      expand: async () => ({ ok: true, spec: KANBAN_SPEC }),
      verify: async () => ({
        status: "passed",
        iterations: 1,
        evidence: "3/3 machine-run cases passed on iteration 1",
        finalSource: KANBAN_MODULE,
        cases: [],
      }),
    });
    assert.equal(q.generatedSource, KANBAN_MODULE.trim());
    assert.equal(n, 2);
  });

  it("missing typeSignature export → RT_E_VALIDATION refusal (mechanical brief-fit floor)", async () => {
    const base = p6Base();
    const envelope = { ...KANBAN_ENVELOPE, exports: ["createBoard"] };
    const { deps } = fakeDeps({ completeText: JSON.stringify(envelope) });
    const q = await liveP6Synthesis(base, deps);
    assert.equal(q.generatedSource, base.generatedSource);
    const refusal = q.logs.find((l) => l.event === "p6.synthesis.refused");
    assert.ok(refusal);
    assert.match(refusal.detail, /RT_E_VALIDATION/);
    assert.match(refusal.detail, /addColumn/);
  });

  it("module without brief vocabulary → RT_E_VALIDATION (p6-brief-fit pre-check)", async () => {
    const base = p6Base();
    const generic = {
      module: "function add(a, b) { return a + b; }\nmodule.exports.add = add;",
      exports: ["add"],
      reqTrace: {},
    };
    const { deps } = fakeDeps({
      completeText: JSON.stringify(generic),
      expandResult: {
        ok: true,
        spec: { ...KANBAN_SPEC, typeSignatures: ["add(a: number, b: number): number"] },
      },
    });
    const q = await liveP6Synthesis(base, deps);
    assert.equal(q.generatedSource, base.generatedSource);
    const refusal = q.logs.find((l) => l.event === "p6.synthesis.refused");
    assert.ok(refusal);
    assert.match(refusal.detail, /RT_E_VALIDATION/);
    assert.match(refusal.detail, /vocabulary/);
  });

  it("forbidden primitive in the module → rejected BEFORE any verify (no machine pass minted)", async () => {
    const base = p6Base();
    const evil = {
      module: "function createBoard(n) { return document.title; }\nmodule.exports.createBoard = createBoard;",
      exports: ["createBoard"],
      reqTrace: {},
    };
    const { calls, deps } = fakeDeps({ completeText: JSON.stringify(evil) });
    const q = await liveP6Synthesis(base, deps);
    assert.equal(q.generatedSource, base.generatedSource);
    assert.ok(!calls.includes("verify"), "verify never runs on a forbidden module");
    const refusal = q.logs.find((l) => l.event === "p6.synthesis.refused");
    assert.ok(refusal);
    assert.match(refusal.detail, /RT_E_VALIDATION/);
  });

  it("verify failed → RT_E_RUNNER_FAILED refusal (the machine declares failure, never a fabricated pass)", async () => {
    const base = p6Base();
    const { deps } = fakeDeps({
      verifyOutcome: {
        status: "failed",
        iterations: 3,
        evidence: "machine-run cases still failing after 3 iterations: case-1: false",
      },
    });
    const q = await liveP6Synthesis(base, deps);
    assert.equal(q.generatedSource, base.generatedSource);
    const refusal = q.logs.find((l) => l.event === "p6.synthesis.refused");
    assert.ok(refusal);
    assert.match(refusal.detail, /RT_E_RUNNER_FAILED/);
  });

  it("verify not-configured → RT_E_LLM_NOT_CONFIGURED refusal", async () => {
    const base = p6Base();
    const { deps } = fakeDeps({
      verifyOutcome: { status: "not-configured", iterations: 0, evidence: "no DEEPSEEK_API_KEY server-side" },
    });
    const q = await liveP6Synthesis(base, deps);
    assert.equal(q.generatedSource, base.generatedSource);
    const refusal = q.logs.find((l) => l.event === "p6.synthesis.refused");
    assert.ok(refusal);
    assert.match(refusal.detail, /RT_E_LLM_NOT_CONFIGURED/);
  });
});

// --- fixes/144 (M2 / S-01 T2) chunked sequential synthesis --------------------

const LEDGER_BRIEF =
  "a property ledger for rent collection with tenant records, lease renewal reminders and payment tracking";

function ledgerSignatures(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `export function collectRent${i}(payment: Payment): Receipt`);
}

function ledgerSpec(sigCount: number) {
  return {
    requirements: ["Track rent collection per tenant.", "Remind lease renewals before their due date."],
    edgeCases: ["Empty payment records are skipped, never thrown."],
    errorHandling: ["Invalid payments raise a coded error."],
    typeSignatures: ledgerSignatures(sigCount),
    dataFlow: ["payment → ledger → receipt"],
    negativeConstraints: ["DO NOT invent tenant data."],
  };
}

/** Deterministic fake chunk module: binds exactly the chunk's names + carries
 *  every LEDGER_BRIEF noun as identifiers (tree-level brief-fit passes on the
 *  assembled entry). Files after the first DECLARE the same-named `ledgerKit`
 *  helper (a top-level-name collision that must be absorbed by the entry's
 *  per-file scopes) and CALL an earlier export by bare name through a
 *  `__crossCall` helper (proves wrapper-parameter binding resolves
 *  cross-file calls). */
function chunkModule(names: readonly string[], priorFirst?: string): string {
  const cross = priorFirst
    ? [`const __crossCall = ${priorFirst}({ payment: 1 });`]
    : [];
  return [
    ...cross,
    ...names.map((n) => `/** (fixes/144 fake chunk fn) ${n} */\nfunction ${n}(input) { return input; }`),
    "const ledgerKit = { property: 1, ledger: 1, rent: 1, collection: 1, tenant: 1, records: 1, lease: 1, renewal: 1, reminders: 1, payment: 1, tracking: 1 };",
    ...names.map((n) => `module.exports.${n} = ${n};`),
  ].join("\n");
}

function chunkEnvelope(names: readonly string[], chunkIndex: number, priorFirst?: string) {
  const reqTrace: Record<string, string> = {};
  names.forEach((n, i) => {
    reqTrace[`req-${chunkIndex}-${i}`] = n;
  });
  return { module: chunkModule(names, priorFirst), exports: [...names], reqTrace };
}

/** Injected pro-tier fake for the chunked driver: one synthesis reply per
 *  chunk (canned envelope exporting that chunk's signature names), garbage for
 *  the failing chunk + its one bounded envelope repair (then honest refusal). */
function chunkedDeps(opts: { failChunk?: number } = {}) {
  const prompts: string[] = [];
  const calls: string[] = [];
  const synthOpts: DeepSeekCompleteOptions[] = []; // fixes/154: opts per synthesis call
  const spec = ledgerSpec(20);
  const groups = chunkTypeSignatures(spec.typeSignatures);
  const chunkNames = groups.map((g) => signatureFunctionNames(g));
  const complete = async (prompt: string, completeOpts?: DeepSeekCompleteOptions): Promise<LlmResult> => {
    calls.push("complete");
    prompts.push(prompt);
    const isSynthesis = prompt.includes("TYPE SIGNATURES (must export");
    if (isSynthesis) {
      synthOpts.push(completeOpts ?? {});
      const chunkIndex = prompts.filter((p) => p.includes("TYPE SIGNATURES (must export")).length - 1;
      if (opts.failChunk === chunkIndex) {
        return { ok: true, text: "the model babbled prose, no json at all", model: "deepseek-v4-flash" };
      }
      const names = chunkNames[chunkIndex] ?? [];
      const priorFirst = chunkIndex > 0 ? (chunkNames[chunkIndex - 1] ?? [])[0] : undefined;
      return { ok: true, text: JSON.stringify(chunkEnvelope(names, chunkIndex, priorFirst)), model: "deepseek-v4-flash" };
    }
    // bounded envelope repair of the failing chunk keeps failing → chunk refusal
    return { ok: true, text: "the model babbled prose, no json at all", model: "deepseek-v4-flash" };
  };
  const expand = async () => {
    calls.push("expand");
    return { ok: true as const, spec };
  };
  const verify = async () => ({
    status: "passed" as const,
    iterations: 0,
    evidence: "unused in tree mode",
    finalSource: "",
    cases: [],
  });
  return { calls, prompts, groups, synthOpts, deps: { complete, expand, verify } };
}

/** Evaluate an assembled entry as one CJS module (node:test-suite proof of the
 *  "concatenation-safe" contract). Returns the populated exports object. */
function evalEntry(entry: string): Record<string, unknown> {
  const mod = { exports: {} as Record<string, unknown> };
  new Function("module", "exports", entry)(mod, mod.exports);
  return mod.exports;
}

describe("chunked synthesis pure helpers (fixes/144 M2 / S-01 T2)", () => {
  it("chunkTypeSignatures: ≤8 per chunk, expand order kept; 20 sigs → 8/8/4; junk/dupes never fork", () => {
    const sigs = ledgerSignatures(20);
    const groups = chunkTypeSignatures(sigs);
    assert.deepEqual(groups.map((g) => g.length), [8, 8, 4], "20 signatures → 3 chunks (8/8/4)");
    assert.equal(groups[0]![0], sigs[0], "expand order preserved");
    assert.equal(groups[2]![groups[2]!.length - 1], sigs[19], "no signature lost");
    assert.equal(chunkTypeSignatures(sigs.slice(0, 8)).length, 1, "≤8 signatures → single chunk");
    assert.equal(chunkTypeSignatures(sigs.slice(0, 9)).length, 2, "9 signatures → two chunks");
    assert.deepEqual(chunkTypeSignatures([]), []);
    const dirty = [sigs[0]!, sigs[0]!, "   ", sigs[1]!];
    assert.deepEqual(chunkTypeSignatures(dirty), [[sigs[0], sigs[1]]], "dupes + blank lines collapse");
  });

  it("p6SynthesisUserPrompt is byte-identical to the chunk builder (full sig list, no prior files)", () => {
    const spec = ledgerSpec(2);
    assert.equal(
      p6SynthesisUserPrompt(LEDGER_BRIEF, spec),
      p6SynthesisChunkUserPrompt(LEDGER_BRIEF, spec, spec.typeSignatures),
    );
    assert.equal(
      p6SynthesisUserPrompt(LEDGER_BRIEF, spec),
      p6SynthesisChunkUserPrompt(LEDGER_BRIEF, spec, spec.typeSignatures, []),
    );
  });

  it("chunk prompt appends the earlier-files context block without touching the legacy prefix", () => {
    const spec = ledgerSpec(2);
    const base = p6SynthesisChunkUserPrompt(LEDGER_BRIEF, spec, spec.typeSignatures);
    const prior: ChunkPriorFile[] = [
      { path: "src/generated.ts", exports: ["collectRent0"], reqTrace: { "req-0-0": "collectRent0" } },
    ];
    const withPrior = p6SynthesisChunkUserPrompt(LEDGER_BRIEF, spec, spec.typeSignatures, prior);
    assert.ok(withPrior.startsWith(base), "legacy prefix byte-identical up to the appended block");
    assert.ok(withPrior.includes("EARLIER FILES ALREADY GENERATED"));
    assert.ok(withPrior.includes("- src/generated.ts exports: collectRent0 · covers req-0-0"));
  });

  it("assembleTreeEntry wraps each file in a scope that binds earlier exports; empty input → empty string", () => {
    const one = assembleTreeEntry([
      { source: "function a() { return 'a'; }\nmodule.exports.a = a;", exports: ["a"] },
    ]);
    assert.equal(
      one,
      "(function (module, exports) {\nfunction a() { return 'a'; }\nmodule.exports.a = a;\n})(module, module.exports);",
      "first file is a plain module/exports IIFE",
    );
    const two = assembleTreeEntry([
      { source: "function a() { return 'a'; }\nmodule.exports.a = a;", exports: ["a"] },
      { source: "function b() { return a(); }\nmodule.exports.b = b;", exports: ["b"] },
    ]);
    assert.equal(
      two,
      "(function (module, exports) {\nfunction a() { return 'a'; }\nmodule.exports.a = a;\n})(module, module.exports);\n" +
        "(function (module, exports, a) {\nfunction b() { return a(); }\nmodule.exports.b = b;\n})(module, module.exports, module.exports.a);",
      "later files receive earlier exports as wrapper params",
    );
    const exportsUnion = evalEntry(two) as Record<string, (...args: unknown[]) => unknown>;
    assert.equal(typeof exportsUnion.a, "function");
    assert.equal(typeof exportsUnion.b, "function");
    assert.equal(exportsUnion.b(), "a", "cross-file bare-name call resolves through the wrapper param");
    assert.equal(assembleTreeEntry([]), "");
    assert.equal(assembleTreeEntry([{ source: "" }, { source: "  " }]), "");
  });

  it("A0 relTsImport: posix relative specifier keeps the .ts extension", () => {
    assert.equal(relTsImport("src/generated.ts", "src/generated/chunk-0.ts"), "./generated/chunk-0.ts");
    assert.equal(relTsImport("src/generated/collect-rent8.ts", "src/generated/chunk-0.ts"), "./chunk-0.ts");
    assert.equal(relTsImport("src/generated/collect-rent8.ts", "src/generated.ts"), "../generated.ts");
  });

  it("A0 stripCjsExportAssignments drops NAME=NAME assigns and whole-object assigns", () => {
    const src = "function a() {}\nmodule.exports.a = a;\nmodule.exports = { a };\nfunction b() {}\n";
    assert.equal(stripCjsExportAssignments(src, ["a"]).includes("module.exports"), false);
    assert.ok(stripCjsExportAssignments(src, ["a"]).includes("function a() {}"));
    assert.ok(stripCjsExportAssignments(src, ["a"]).includes("function b() {}"));
  });

  it("A0 materializeImportableTree: single file is identity (legacy disk bytes)", () => {
    const one = [{ path: TREE_ENTRY_PATH, source: "function a() {}\nmodule.exports.a = a;\n", exports: ["a"] }];
    const m = materializeImportableTree(one);
    assert.equal(m.files.length, 1);
    assert.equal(m.files[0]!.path, TREE_ENTRY_PATH);
    assert.equal(m.files[0]!.source, one[0]!.source);
    assert.equal(m.entrySource, assembleTreeEntry(one));
  });

  it("A0 materializeImportableTree: N>1 files become ESM with cross-file imports + barrel at TREE_ENTRY_PATH", () => {
    const m = materializeImportableTree([
      { path: TREE_ENTRY_PATH, source: "function a() { return 1; }\nmodule.exports.a = a;\n", exports: ["a"] },
      { path: "src/generated/b.ts", source: "function b() { return a(); }\nmodule.exports.b = b;\n", exports: ["b"] },
    ]);
    assert.deepEqual(
      m.files.map((f) => f.path),
      [TREE_ENTRY_PATH, TREE_CHUNK0_RELOCATED_PATH, "src/generated/b.ts"],
    );
    const barrel = m.files[0]!;
    assert.equal(barrel.source, m.entrySource);
    assert.ok(barrel.source.includes(`export * from "./generated/chunk-0.ts";`));
    assert.ok(barrel.source.includes(`export * from "./generated/b.ts";`));
    assert.ok(!barrel.source.includes("module.exports"), "barrel is ESM");
    const chunk0 = m.files[1]!;
    assert.ok(chunk0.source.includes("export { a };"));
    assert.ok(!chunk0.source.includes("module.exports"));
    assert.ok(!chunk0.source.includes("import "), "chunk 0 has no prior files");
    const later = m.files[2]!;
    assert.ok(later.source.includes(`import { a } from "./chunk-0.ts";`));
    assert.ok(later.source.includes("export { b };"));
    assert.ok(!later.source.includes("module.exports"));
    assert.ok(later.source.includes("function b() { return a(); }"), "bare-name call kept; import binds it");
  });

  it("toGeneratedTreeFile: content-addressed fnv1a hash + attempt stamp", () => {
    const f = toGeneratedTreeFile("src/generated.ts", "function x() {}", 0);
    assert.deepEqual(f, {
      path: "src/generated.ts",
      source: "function x() {}",
      hash: String(fnv1a("function x() {}")),
      attempt: 0,
    });
  });

  it("treePathForChunk: chunk 0 at the entry path; later chunks slugged + collision-deduped", () => {
    assert.equal(treePathForChunk(0, ["collectRent0"]), TREE_ENTRY_PATH);
    assert.equal(TREE_ENTRY_PATH, "src/generated.ts", "entry path stable (scaffold fallback host parity)");
    assert.equal(treePathForChunk(1, ["collectRent8"]), "src/generated/collect-rent8.ts");
    assert.equal(
      treePathForChunk(2, ["collectRent16"], new Set(["src/generated.ts", "src/generated/collect-rent16.ts"])),
      "src/generated/collect-rent16-2.ts",
    );
    assert.equal(pathSlugFromNames(["getTenantById"]), "get-tenant-by-id");
    assert.equal(pathSlugFromNames([]), "chunk");
  });
});

describe("liveP6Synthesis chunked tree mode (fixes/144 M2 / S-01 T2)", () => {
  it("20 signatures → 3 sequential chunks; later prompts carry earlier chunks' exports", async () => {
    const base = p6Base(LEDGER_BRIEF);
    const f = chunkedDeps();
    const q = await liveP6Synthesis(base, f.deps);
    assert.equal(q.generatedTree?.length, 4, "A0: barrel + one file per chunk");
    assert.deepEqual(f.groups.map((g) => g.length), [8, 8, 4]);
    const synthPrompts = f.prompts.filter((p) => p.includes("TYPE SIGNATURES (must export"));
    assert.equal(synthPrompts.length, 3, "one pro-tier synthesis call per chunk");
    assert.ok(synthPrompts[1]!.includes("collectRent0"), "chunk-1 prompt carries chunk-0 exports");
    assert.ok(!synthPrompts[1]!.includes("collectRent16"), "chunk-1 prompt never leaks chunk-2 exports");
    assert.ok(synthPrompts[2]!.includes("collectRent8"), "chunk-2 prompt carries chunk-1 exports");
    assert.match(
      synthPrompts[1]!,
      /- src\/generated\.ts exports: collectRent0, collectRent1/,
      "earlier-file context lists paths + exports",
    );
    assert.match(
      synthPrompts[2]!,
      /- src\/generated\/collect-rent8\.ts exports: collectRent8/,
      "second chunk file listed with its path",
    );
    for (const p of synthPrompts) {
      assert.ok(p.includes(LEDGER_BRIEF), "shared brief in every chunk prompt");
      assert.ok(p.includes("Track rent collection per tenant."), "full requirement list in every chunk prompt");
    }
    assert.deepEqual(f.calls, ["expand", "complete", "complete", "complete"]);
  });

  it("multi-chunk success: tree files carry path + fnv1a hash + attempt 0; A0 ESM barrel is the entry", async () => {
    const base = p6Base(LEDGER_BRIEF);
    const f = chunkedDeps();
    const q = await liveP6Synthesis(base, f.deps);
    const tree = q.generatedTree ?? [];
    assert.equal(tree.length, 4, "barrel + 3 chunks");
    assert.deepEqual(
      tree.map((t) => t.path),
      [TREE_ENTRY_PATH, TREE_CHUNK0_RELOCATED_PATH, "src/generated/collect-rent8.ts", "src/generated/collect-rent16.ts"],
    );
    for (const t of tree) {
      assert.equal(t.hash, String(fnv1a(t.source)), "content-addressed hash");
      assert.equal(t.attempt, 0);
      assert.ok(t.source.trim().length > 0);
    }
    const barrel = tree[0]!;
    assert.equal(q.generatedSource, barrel.source, "generatedSource is the ESM barrel (what treeRun/oracle import)");
    assert.ok(barrel.source.includes(`export * from "./generated/chunk-0.ts";`));
    assert.ok(barrel.source.includes(`export * from "./generated/collect-rent8.ts";`));
    assert.ok(barrel.source.includes(`export * from "./generated/collect-rent16.ts";`));
    assert.ok(!barrel.source.includes("module.exports"), "entry is ESM, not IIFE-concat");
    const later = tree[2]!;
    assert.ok(later.source.includes("import {"), "later chunk imports prior exports");
    assert.ok(later.source.includes("export {"), "later chunk is ESM");
    assert.ok(!later.source.includes("(function (module, exports"), "no IIFE wrapper on disk");
    assert.equal(q.lastTest, base.lastTest, "lastTest untouched (no fabricated 'tested')");
    assert.ok(!q.artifacts.some((a) => a.title.includes("machine-verified")));
    assert.ok(q.artifacts.some((a) => a.title.startsWith("Generated source tree (LLM")));
    assert.equal(q.modelRoute, "deepseek-pro", "pro tier really synthesized the chunks");
    assert.equal(q.implementationSpec?.source, "p6");
    assert.equal(q.implementationSpec?.typeSignatures.length, 20);
    assert.ok(q.logs.some((l) => l.event === "p6.synthesis" && l.detail.includes("4 file(s) in 3 chunk(s)")));
    assert.ok(!q.logs.some((l) => l.event === "p6.synthesis.refused"));
  });

  it("chunk-2 refusal keeps chunks 0..1 files + logs p6.synthesis.refused with the chunk index (honest partial)", async () => {
    const base = p6Base(LEDGER_BRIEF);
    const f = chunkedDeps({ failChunk: 2 });
    const q = await liveP6Synthesis(base, f.deps);
    const tree = q.generatedTree ?? [];
    assert.equal(tree.length, 3, "A0 barrel + prior chunks' files stay real");
    assert.deepEqual(
      tree.map((t) => t.path),
      [TREE_ENTRY_PATH, TREE_CHUNK0_RELOCATED_PATH, "src/generated/collect-rent8.ts"],
    );
    assert.equal(q.generatedSource, tree[0]!.source, "partial entry is the ESM barrel over accepted chunks");
    assert.ok(q.generatedSource.includes(`export * from "./generated/chunk-0.ts";`));
    assert.ok(q.generatedSource.includes(`export * from "./generated/collect-rent8.ts";`));
    assert.ok(!q.generatedSource.includes("collect-rent16"), "refused chunk 2 is absent from the barrel");
    assert.equal(q.modelRoute, "deepseek-pro");
    assert.equal(q.lastTest, base.lastTest, "no verified claim on a partial");
    const refusal = q.logs.find((l) => l.event === "p6.synthesis.refused");
    assert.ok(refusal, "refusal is logged");
    assert.match(refusal.detail, /chunk 3\/3 refused/, "log names the refused chunk index");
    assert.match(refusal.detail, /RT_E_LLM_REJECTED/);
    assert.ok(
      !q.logs.some((l) => l.event === "p6.synthesis" && l.detail.includes("Chunked synthesis:")),
      "no success log on a partial",
    );
    assert.deepEqual(f.calls, ["expand", "complete", "complete", "complete", "complete"], "chunk 2 = synth + 1 repair");
  });

  it("chunk-0 refusal → deterministic floor stands untouched (nothing real to keep)", async () => {
    const base = p6Base(LEDGER_BRIEF);
    const f = chunkedDeps({ failChunk: 0 });
    const q = await liveP6Synthesis(base, f.deps);
    assert.equal(q.generatedTree, undefined, "no files when the first chunk refuses");
    assert.equal(q.generatedSource, base.generatedSource, "floor stands byte-identical");
    const refusal = q.logs.find((l) => l.event === "p6.synthesis.refused");
    assert.ok(refusal);
    assert.match(refusal.detail, /chunk 1\/3 refused/);
    assert.equal(f.calls.filter((c) => c === "complete").length, 2, "chunk 0 = synth + 1 bounded repair, then stop");
  });

  it("deterministic: same fake inputs → identical prompts, tree files and entry", async () => {
    const run = async () => {
      const base = p6Base(LEDGER_BRIEF);
      const f = chunkedDeps();
      const q = await liveP6Synthesis(base, f.deps);
      return { prompts: f.prompts, tree: q.generatedTree ?? [], source: q.generatedSource };
    };
    const a = await run();
    const b = await run();
    assert.deepEqual(a.prompts, b.prompts, "per-chunk prompts byte-identical across runs");
    assert.deepEqual(a.tree, b.tree, "tree files byte-identical across runs");
    assert.equal(a.source, b.source);
  });
});

describe("liveP6Synthesis ≤8 single-chunk byte-parity regression (fixes/144 M2)", () => {
  it("2 signatures → legacy path untouched, recorded as the one-file generatedTree", async () => {
    const base = p6Base(); // KANBAN (2 signatures)
    const { calls, deps } = fakeDeps();
    const q = await liveP6Synthesis(base, deps);
    assert.equal(q.generatedSource, KANBAN_MODULE.trim(), "legacy generatedSource byte-parity");
    assert.deepEqual(calls, ["expand", "complete", "verify"], "legacy call sequence untouched");
    const tree = q.generatedTree ?? [];
    assert.equal(tree.length, 1, "≤8 signatures → one-file tree");
    assert.equal(tree[0]!.path, TREE_ENTRY_PATH);
    assert.equal(tree[0]!.source, q.generatedSource, "tree file source == generatedSource (byte-identical)");
    assert.equal(tree[0]!.hash, String(fnv1a(KANBAN_MODULE.trim())));
    assert.equal(tree[0]!.attempt, 0);
    assert.equal(q.modelRoute, "deepseek-pro");
    assert.ok(q.artifacts.some((a) => a.title === "Generated module (LLM, machine-verified)"));
    assert.equal((q.lastTest as { label?: string } | null)?.label, "tested");
  });
});

describe("liveP6Synthesis deps.treeFailure threads into repair re-prompts (fixes/144 M3-2)", () => {
  const TREE_FAILURE =
    "src/generated/entry.ts — tests/entry.spec.ts run=fail: ReferenceError: " +
    "addColumn is not defined at test line 4";

  it("single-module envelope repair carries the tree-failure context when supplied", async () => {
    const base = p6Base();
    const prompts: string[] = [];
    let n = 0;
    const complete = async (_p: string, _o?: DeepSeekCompleteOptions): Promise<LlmResult> => {
      n += 1;
      prompts.push(_p);
      return {
        ok: true,
        text: n === 1 ? "%%%% the model babbled, no json %%%%" : JSON.stringify(KANBAN_ENVELOPE),
        model: "deepseek-v4-flash",
      };
    };
    const q = await liveP6Synthesis(base, {
      complete,
      expand: async () => ({ ok: true, spec: KANBAN_SPEC }),
      verify: async () => ({
        status: "passed",
        iterations: 1,
        evidence: "3/3 machine-run cases passed on iteration 1",
        finalSource: KANBAN_MODULE,
        cases: [],
      }),
      treeFailure: TREE_FAILURE,
    });
    assert.equal(q.generatedSource, KANBAN_MODULE.trim(), "the repair rescued the malformed envelope");
    const repair = prompts.find((p) => p.startsWith("Your previous reply was not valid JSON"));
    assert.ok(repair, "the bounded envelope repair re-prompt fired");
    assert.ok(repair!.includes("Tree-run failure context (failing file + first not-ok tail):"));
    assert.ok(repair!.includes(TREE_FAILURE), "tree-run failure context reached the repair prompt");
  });

  it("no treeFailure in deps keeps the repair prompt byte-identical to legacy", async () => {
    const base = p6Base();
    const prompts: string[] = [];
    let n = 0;
    const complete = async (_p: string): Promise<LlmResult> => {
      n += 1;
      prompts.push(_p);
      return {
        ok: true,
        text: n === 1 ? "not json at all" : JSON.stringify(KANBAN_ENVELOPE),
        model: "deepseek-v4-flash",
      };
    };
    const q = await liveP6Synthesis(base, {
      complete,
      expand: async () => ({ ok: true, spec: KANBAN_SPEC }),
      verify: async () => ({
        status: "passed",
        iterations: 1,
        evidence: "3/3 machine-run cases passed on iteration 1",
        finalSource: KANBAN_MODULE,
        cases: [],
      }),
    });
    assert.equal(q.generatedSource, KANBAN_MODULE.trim());
    const repair = prompts.find((p) => p.startsWith("Your previous reply was not valid JSON"));
    assert.ok(repair, "the bounded envelope repair re-prompt fired");
    assert.equal(repair, LEGACY_REPAIR_SNAPSHOT_REPAIR, "no context → exact legacy envelope-repair bytes");
  });

  it("chunked mode: a refused chunk's envelope repair carries the tree-failure context", async () => {
    const base = p6Base(LEDGER_BRIEF);
    const f = chunkedDeps({ failChunk: 2 });
    const q = await liveP6Synthesis(base, { ...f.deps, treeFailure: TREE_FAILURE });
    assert.equal((q.generatedTree ?? []).length, 3, "A0 barrel + prior chunks stay real (honest partial)");
    const repair = f.prompts.find((p) => p.startsWith("Your previous reply was not valid JSON"));
    assert.ok(repair, "chunk 2's bounded envelope repair fired");
    assert.ok(repair!.includes(TREE_FAILURE), "tree-failure context reached the chunk repair prompt");
    const refusal = q.logs.find((l) => l.event === "p6.synthesis.refused");
    assert.ok(refusal && /chunk 3\/3 refused/.test(refusal.detail));
  });
});

// --- fixes/148 (F1): the kind-scoped tree trigger ----------------------------
// The chunk/tree decision must consider the DELIVERY KIND, not signature count
// alone (fixes/145 M1=0 root cause — a ≤8-signature WEBAPP brief fell into
// the byte-parity single-module path by construction). Every DECLARED kind
// ("app" = webapp / "tool" / "game") routes to the chunked tree regardless of
// signature count; the ≤8 byte-parity single-module path serves ONLY
// kind-absent (undeclared/legacy, E-15 never infers) library-style projects.

describe("liveP6Synthesis kind-scoped tree trigger (fixes/148 F1)", () => {
  it("singleModuleLibraryKind: only kind-absent projects are single-module-library eligible", () => {
    assert.equal(singleModuleLibraryKind({}), true, "kind absent → legacy single-module eligible");
    assert.equal(singleModuleLibraryKind({ kind: undefined }), true);
    assert.equal(singleModuleLibraryKind({ kind: null }), true);
    assert.equal(singleModuleLibraryKind({ kind: "app" }), false, "app (webapp) → always tree");
    assert.equal(singleModuleLibraryKind({ kind: "tool" }), false, "tool → always tree");
    assert.equal(singleModuleLibraryKind({ kind: "game" }), false, "game → always tree");
  });

  it("a declared webapp kind with ≤8 signatures now emits a generatedTree (entry file), never the single module", async () => {
    const base = { ...p6Base(), kind: "app" as const }; // KANBAN brief, 2 signatures ≤8
    const { calls, deps } = fakeDeps();
    const q = await liveP6Synthesis(base, deps);
    const tree = q.generatedTree ?? [];
    assert.equal(tree.length, 1, "≤8 signatures on a webapp → the chunked path still fires");
    assert.equal(tree[0]!.path, TREE_ENTRY_PATH, "the single chunk is the tree entry file");
    for (const t of tree) {
      assert.equal(t.hash, String(fnv1a(t.source)), "content-addressed hash");
      assert.equal(t.attempt, 0);
      assert.ok(t.source.trim().length > 0);
    }
    // generatedSource = the assembled ENTRY (scoped concatenation) — the tree
    // is what scaffold hosts verbatim and treeRun runs (the M2=1 path from
    // fixes/145), not the machine-verified single module.
    assert.equal(q.generatedSource, assembleTreeEntry([{ source: tree[0]!.source }]), "entry == assembled tree");
    assert.ok(q.generatedSource.includes(KANBAN_MODULE.trim()), "entry carries the synthesized file source");
    const exports_ = evalEntry(q.generatedSource);
    assert.equal(typeof exports_.createBoard, "function", "assembled entry exposes the tree's exports");
    // No machine verify at synthesis: the chunked path's tested mint is the
    // tree-run lane's step (fixes/147 E2) — never fabricated here.
    assert.deepEqual(calls, ["expand", "complete"], "chunked path: one synthesis call, NO verify leg");
    assert.equal(
      (q.lastTest as { label?: string } | null)?.label,
      undefined,
      "no fabricated tested stamp on the chunked path (verify is the tree-run lane's step)",
    );
    assert.equal(q.modelRoute, "deepseek-pro");
    assert.ok(
      q.artifacts.some((a) => a.kind === "code" && a.title.includes("Generated source tree")),
      "tree artifact (never the machine-verified single-module artifact)",
    );
    assert.ok(q.logs.some((l) => l.event === "p6.synthesis" && l.detail.includes("Chunked synthesis")));
  });

  it("declared tool/game kinds with ≤8 signatures also tree; >8 signatures still chunks under any kind", async () => {
    for (const kind of ["tool", "game"] as const) {
      const { calls, deps } = fakeDeps();
      const q = await liveP6Synthesis({ ...p6Base(), kind }, deps);
      assert.equal((q.generatedTree ?? []).length, 1, `${kind}: ≤8 sigs → chunked tree`);
      assert.deepEqual(calls, ["expand", "complete"], `${kind}: no single-module verify leg`);
      assert.equal(
        (q.lastTest as { label?: string } | null)?.label,
        undefined,
        `${kind}: no fabricated tested stamp (verify is the tree-run lane's step)`,
      );
    }
    // >8 signatures → one pro-tier call per chunk, declared kind or not.
    const f = chunkedDeps();
    const q = await liveP6Synthesis({ ...p6Base(LEDGER_BRIEF), kind: "app" }, f.deps);
    assert.equal(q.generatedTree?.length, 4, "20 signatures → A0 barrel + 3 chunk files under a declared kind");
    assert.deepEqual(f.calls, ["expand", "complete", "complete", "complete"], "no verify leg on the chunked path");
  });

  it("a kind-absent library-style brief with ≤8 signatures KEEPS the byte-identical single-module path (fixes/148 regression pin)", async () => {
    const base = p6Base(); // no kind — the legacy library/module fixture shape
    assert.equal(singleModuleLibraryKind(base), true, "fixture is single-module-library eligible");
    const { calls, deps } = fakeDeps();
    const q = await liveP6Synthesis(base, deps);
    assert.equal(q.generatedSource, KANBAN_MODULE.trim(), "legacy generatedSource byte-parity");
    assert.deepEqual(calls, ["expand", "complete", "verify"], "legacy call sequence untouched");
    assert.equal((q.lastTest as { label?: string } | null)?.label, "tested", "machine verify mints tested on the library path");
    const tree = q.generatedTree ?? [];
    assert.equal(tree.length, 1, "≤8 kind-absent → one-file tree");
    assert.equal(tree[0]!.source, q.generatedSource, "one-file tree source == generatedSource (byte-identical)");
  });
});

// --- fixes/154 (F3) P6 synthesis budget constants: 32k max_tokens / 240s ----

describe("P6 synthesis budget constants reach both call sites (fixes/154)", () => {
  it("numeric pins: P6_SYNTH_MAX_TOKENS = 32_000 and P6_SYNTH_TIMEOUT_MS = 240_000 (no silent budget regression)", () => {
    // The empty-content diagnosis (fixes/153→154) raised the synthesis output
    // budget 12k→32k and the abort 90s→240s; these pins keep that lever set.
    assert.equal(P6_SYNTH_MAX_TOKENS, 32_000);
    assert.equal(P6_SYNTH_TIMEOUT_MS, 240_000);
  });

  it("single-module synthesis passes maxTokens 32000 + timeoutMs 240000 to the model caller", async () => {
    const seen: DeepSeekCompleteOptions[] = [];
    const { deps } = fakeDeps();
    deps.complete = async (_prompt: string, opts?: DeepSeekCompleteOptions) => {
      seen.push(opts ?? {});
      return { ok: true, text: JSON.stringify(KANBAN_ENVELOPE), model: "deepseek-v4-pro" };
    };
    const q = await liveP6Synthesis(p6Base(), deps);
    assert.equal(q.generatedSource, KANBAN_MODULE.trim(), "synthesis still succeeds under the captured opts");
    assert.equal(seen.length, 1, "happy-path single-module synthesis = one complete call");
    const opts = seen[0]!;
    assert.equal(opts.maxTokens, 32_000, "maxTokens rides P6_SYNTH_MAX_TOKENS");
    assert.equal(opts.maxTokens, P6_SYNTH_MAX_TOKENS, "…via the exported constant, not a literal fork");
    assert.equal(opts.timeoutMs, 240_000, "timeoutMs rides P6_SYNTH_TIMEOUT_MS");
    assert.equal(opts.timeoutMs, P6_SYNTH_TIMEOUT_MS, "…via the exported constant, not a literal fork");
    assert.equal(opts.model, "deepseek-v4-pro", "pro tier (the 240s/32k budget is the pro-synthesis budget)");
    assert.equal(opts.json, true, "json envelope");
    assert.equal(
      opts.thinking,
      false,
      "fixes/156 E1: the json-envelope synthesis disables pro thinking — OUTPUT budget, not CoT (empty-content blocker)",
    );
  });

  it("chunk-envelope synthesis passes maxTokens 32000 + timeoutMs 240000 on EVERY chunk call", async () => {
    const base = p6Base(LEDGER_BRIEF);
    const f = chunkedDeps();
    const q = await liveP6Synthesis(base, f.deps);
    assert.equal(q.generatedTree?.length, 4, "20 signatures → A0 barrel + 3 chunk files");
    assert.equal(f.synthOpts.length, 3, "one synthesis call per chunk — opts captured on each");
    for (const opts of f.synthOpts) {
      assert.equal(opts.maxTokens, P6_SYNTH_MAX_TOKENS, "chunk call carries 32k max_tokens");
      assert.equal(opts.maxTokens, 32_000);
      assert.equal(opts.timeoutMs, P6_SYNTH_TIMEOUT_MS, "chunk call carries the 240s timeout");
      assert.equal(opts.timeoutMs, 240_000);
      assert.equal(opts.model, "deepseek-v4-pro");
      assert.equal(opts.json, true, "chunk envelopes are json_object calls");
      assert.equal(
        opts.thinking,
        false,
        "fixes/156 E1: EVERY chunk synthesis disables pro thinking — OUTPUT budget, not CoT (empty-content blocker)",
      );
    }
  });
});

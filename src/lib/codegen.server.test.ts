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
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import {
  assembleTreeEntry,
  asyncExportNames,
  asyncNamesInScope,
  briefFitSatisfied,
  chunkTypeSignatures,
  crossChunkDuplicateDeclarations,
  ENVELOPE_READ_EXCERPT_MAX,
  envelopeReadLogEntry,
  forbiddenPrimitiveHit,
  FORBIDDEN_PRIMITIVE_NAMES,
  injectMissingExports,
  liveP6Synthesis,
  localBindingLines,
  materializeImportableTree,
  mintTreeRunTested,
  neutralizeResidualCjsExports,
  nondeterministicPrimitiveHit,
  parseSynthesisEnvelope,
  parseSynthesisPatchEnvelope,
  patchExcerptWindows,
  pathSlugFromNames,
  PATCH_REPAIR_DIFF_MAX,
  PATCH_REPAIR_MAX_WINDOWS,
  PATCH_REPAIR_WINDOW_MAX_LINES,
  p6SynthesisBriefFitRepairPrompt,
  p6SynthesisChunkUserPrompt,
  p6SynthesisContractsLines,
  p6SynthesisAsyncAwaitRepairPrompt,
  p6SynthesisDuplicateDeclRepairPrompt,
  p6SynthesisExportRepairPrompt,
  p6SynthesisForbiddenRepairPrompt,
  p6SynthesisNondeterministicRepairPrompt,
  p6SynthesisPatchRepairPrompt,
  p6SynthesisProseRepairPrompt,
  p6SynthesisRepairPrompt,
  p6SynthesisSignatureRepairPrompt,
  p6SynthesisSystemPrompt,
  p6SynthesisUserPrompt,
  P6_SYNTH_MAX_TOKENS,
  P6_SYNTH_PRIOR_MAX_FILES,
  P6_SYNTH_PROMPT_MAX_CHARS,
  P6_SYNTH_TIMEOUT_MS,
  relTsImport,
  signatureFunctionNames,
  singleModuleLibraryKind,
  specGraphJobTargets,
  stripCjsExportAssignments,
  toGeneratedTreeFile,
  tokenLineNumbers,
  orderTreeChunks,
  treeChunkPlan,
  treeChunkPlanCensus,
  treeRunTestedEvidence,
  treePathForChunk,
  TREE_CHUNK0_RELOCATED_PATH,
  TREE_ENTRY_PATH,
  validateSynthesisModule,
  unawaitedAsyncValueUses,
  REPAIR_TREE_FAILURE_TAIL_MAX,
  synthWithBackoff,
  proseLineHits,
  type AsyncUnawaitedUse,
  type ChunkPriorFile,
  type EnvelopeReadFailure,
  type P6SynthesisDeps,
} from "./codegen.server.ts";
import { applyPhaseResult, emptyProject } from "./engine.ts";
import { runGate, archTrace } from "./dod.ts";
import { buildPhase6Module } from "./sandbox.ts";
import { briefNounHits, maskLiteralsAndComments } from "./sandbox.ts";
import { fnv1a } from "./algorithms.ts";
import { resetSessionBudget, sessionTokenBudget } from "./token-ledger.ts";
import { oracleBriefGrounded } from "./verify.server.ts";
import type { DeepSeekCompleteOptions } from "./deepseek.server.ts";
import type { ExpandBriefResult } from "./prompt-engine.ts";
import type { VerifyOutcome } from "./verify.server.ts";
import type { LlmResult } from "./llm.ts";
import type { Project } from "./types.ts";
import type { TreeRunOutcome } from "./compile-check.server.ts";
import type { RankableLessonRow } from "./knowledge.ts";
import { exportProjectJson, importProject, type ArtifactProvenance } from "./io.ts";

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

/**
 * FM-01 (W37 Y1): the single-module (kind-absent, ≤8-signature) synthesis now
 * records the SAME materialized ESM shape the chunked path records — an ESM
 * barrel at TREE_ENTRY_PATH + the accepted module relocated to
 * TREE_CHUNK0_RELOCATED_PATH with its CJS assigns stripped; `generatedSource`
 * is the barrel's own bytes. These helpers materialize the EXPECTED module
 * through the same deterministic function the production seam calls, so a pin
 * on its output stays byte-precise (any drift in the transform — or a
 * different accepted module — changes the bytes) without the suite having to
 * run `node` inside the tenant.
 */
function materializedSingle(
  moduleSrc: string,
  exports: readonly string[] = KANBAN_ENVELOPE.exports,
): ReturnType<typeof materializeImportableTree> {
  return materializeImportableTree([{ path: TREE_ENTRY_PATH, source: moduleSrc, exports: [...exports] }]);
}

/** FM-01: assert the recorded tree == the deterministic materialization of
 *  `moduleSrc` (barrel + chunk, path/source byte-exact) and return the chunk
 *  file's source for further byte assertions on the accepted module. */
function assertRecordedMaterialized(
  q: Project,
  moduleSrc: string,
  exports: readonly string[] = KANBAN_ENVELOPE.exports,
): string {
  const m = materializedSingle(moduleSrc, exports);
  assert.deepEqual(
    (q.generatedTree ?? []).map((f) => ({ path: f.path, source: f.source })),
    m.files.map((f) => ({ path: f.path, source: f.source })),
    "FM-01: the recorded tree is the deterministic materialization of the accepted module (barrel + relocated chunk)",
  );
  assert.equal(q.generatedSource, m.entrySource, "FM-01: generatedSource is the entry barrel's own bytes");
  assert.ok(!(q.generatedSource ?? "").includes("module.exports"), "FM-01: the recorded entry carries no raw CJS");
  return m.files[1]!.source;
}

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

  it("322 X1 (P6-C): bar 0.35 boundary — N=20 (6 fail / 7 pass), N=10 (3 fail / 4 pass)", () => {
    const w20 =
      "aurora basalt cipher dune ember fjord glade harbor isle juniper kestrel lagoon mesa nimbus orchid peak quarry ridge summit tundra".split(
        " ",
      );
    const src = (k: number) => w20.slice(0, k).map((n) => `const ${n} = 0;`).join("\n");
    const b20 = w20.join(" ");
    assert.equal(briefFitSatisfied(b20, src(6)).ok, false, "ceil(20×0.35)=7 — six hits are one short");
    assert.equal(briefFitSatisfied(b20, src(7)).ok, true, "seven hits meet the bar exactly");
    const b10 = w20.slice(0, 10).join(" ");
    assert.equal(briefFitSatisfied(b10, src(3)).ok, false, "ceil(10×0.35)=4 — three hits are one short");
    assert.equal(briefFitSatisfied(b10, src(4)).ok, true, "four hits meet the bar exactly");
    // KEEP IN PARITY with dod.ts's p6-brief-fit probe (same 0.35 bar).
  });
});

describe("p6Synthesis prompts (byte-stable contract)", () => {
  it("system prompt contains the word json + a worked envelope example", () => {
    const s = p6SynthesisSystemPrompt();
    assert.match(s, /\bjson\b/i);
    assert.match(s, /\{"module":/);
    assert.match(s, /module\.exports\.add = add/);
  });

  // fixes/215b: the prompt's rule 4 and the validator denylist MUST agree.
  // They drifted once (prompt omitted require/globalThis/self/XMLHttpRequest);
  // a keyed chunk 2/4 then refused on `globalThis`, a primitive the model was
  // never told to avoid. These two invariants make that drift impossible.
  it("215b: system prompt names EVERY validator-enforced forbidden primitive", () => {
    const s = p6SynthesisSystemPrompt();
    for (const name of FORBIDDEN_PRIMITIVE_NAMES) {
      assert.ok(
        s.includes(name),
        `system prompt omits forbidden primitive \`${name}\` — the model would be blind-sided by the validator`,
      );
    }
  });

  it("215b: FORBIDDEN_PRIMITIVE_NAMES is exactly the validator denylist (no name unmatched, none missing)", () => {
    for (const name of FORBIDDEN_PRIMITIVE_NAMES) {
      const hit = forbiddenPrimitiveHit(name);
      assert.ok(
        hit.hard !== null || hit.soft !== null,
        `FORBIDDEN_PRIMITIVE_NAMES lists \`${name}\` but the validator regexes do not match it`,
      );
    }
    // Every HARD/SOFT alternative must be represented in the names list, so a
    // newly-banned primitive cannot be enforced without being advertised.
    const advertised = new Set<string>(FORBIDDEN_PRIMITIVE_NAMES);
    const hardNames = ["eval", "Function", "import"];
    const softNames = [
      "process",
      "require",
      "globalThis",
      "window",
      "self",
      "fetch",
      "WebSocket",
      "XMLHttpRequest",
      "document",
      "localStorage",
      "indexedDB",
    ];
    for (const n of [...hardNames, ...softNames]) {
      assert.ok(advertised.has(n), `validator bans \`${n}\` but the prompt list omits it`);
    }
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
    assert.ok(
      !r.source.includes("module.exports.createProperty = createProperty;"),
      "an already-bound export is never re-injected as module.exports",
    );
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

    assertRecordedMaterialized(q, KANBAN_MODULE.trim()); // FM-01: recorded as the materialized ESM tree
    const lt = q.lastTest as { ok: boolean; label?: string; evidenceHash?: string } | null;
    assert.equal(lt?.ok, true);
    assert.equal(lt?.label, "tested");
    assert.ok((lt?.evidenceHash?.length ?? 0) > 0);
    assert.equal(q.implementationSpec?.source, "p6");
    assert.equal(q.implementationSpec?.briefHash, String(fnv1a(KANBAN_BRIEF)));
    assert.deepEqual(q.implementationSpec?.typeSignatures, KANBAN_SIGNATURES);
    assert.equal(q.modelRoute, "deepseek-flash");
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
    assertRecordedMaterialized(q, KANBAN_MODULE.trim()); // FM-01 re-point: lessons present, recorded materialized
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
    assertRecordedMaterialized(q, KANBAN_MODULE.trim()); // FM-01: recorded as the materialized ESM tree
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
    assertRecordedMaterialized(q, KANBAN_MODULE.trim()); // FM-01: recorded as the materialized ESM tree
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

/**
 * W21-258: load a materialized tree the way the EMITTED tenant does — the
 * scaffold writes `package.json` `"type":"module"` + every tree file verbatim,
 * and `tests/oracle.spec.ts` statically imports the tree ENTRY as ESM. This
 * writes the files into a temp tenant, imports the ENTRY exactly as the
 * scaffold resolves it (scaffold.ts:2385-2394: the file at `src/generated.ts`
 * when the tree has one, else the alphabetically-first accepted row) and
 * returns the real `node` process verdict. Deterministic, no network.
 */
function importMaterializedTree(m: {
  files: readonly { path: string; source: string }[];
}): { status: number | null; stdout: string; stderr: string; entry: string } {
  const dir = mkdtempSync(join(tmpdir(), "rt-w21l1-tree-"));
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module" }, null, 2) + "\n");
    for (const f of m.files) {
      const abs = join(dir, f.path);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, f.source);
    }
    const sorted = [...m.files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    const entry = (m.files.find((f) => f.path === TREE_ENTRY_PATH) ?? sorted[0])!.path;
    writeFileSync(
      join(dir, "spec.ts"),
      `import * as treeModule from ${JSON.stringify("./" + entry)};\n` +
        `console.log("TREE_IMPORT_OK exports=[" + Object.keys(treeModule).sort().join(",") + "]");\n`,
    );
    const run = spawnSync(process.execPath, ["--experimental-strip-types", "spec.ts"], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return {
      status: run.status,
      stdout: String(run.stdout ?? ""),
      stderr: String(run.stderr ?? ""),
      entry,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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

  it("W45/331-4 treeChunkPlanCensus: the plan's declared-vs-planned shortfall is counted, never silent", () => {
    const project = {
      specGraph: {
        nodes: [
          { id: "job-0", file: "src/jobs/alpha.ts", purpose: "Implement job “alpha” against the contract" },
          { id: "job-1", file: "src/jobs/beta.ts", purpose: "Implement job “beta” against the contract" },
        ],
      },
    };
    // Both jobs are named by their own signatures -> both plan a file.
    const both = treeChunkPlanCensus(project, [
      "runAlpha(command: AlphaCmd): Promise<Alpha>",
      "listBetaRuns(id: string): Promise<BetaRun[]>",
    ]);
    assert.deepEqual(both.declared, ["alpha", "beta"]);
    assert.deepEqual(both.planned, ["alpha", "beta"]);
    assert.deepEqual(both.unbound, []);
    assert.equal(both.legacy, false);
    assert.ok(both.paths.includes("src/jobs/alpha.ts"));
    assert.ok(both.paths.includes("src/jobs/beta.ts"));
    // Only alpha is named -> beta gets no chunk: the counted shortfall.
    const partial = treeChunkPlanCensus(project, ["runAlpha(command: AlphaCmd): Promise<Alpha>"]);
    assert.deepEqual(partial.planned, ["alpha"]);
    assert.deepEqual(partial.unbound, ["beta"]);
    assert.equal(partial.legacy, false);
    assert.equal(partial.paths.includes("src/jobs/beta.ts"), false, "an unbound job has no planned file");
    // No signature binds to either job -> the legacy src/generated mapping; both counted.
    const none = treeChunkPlanCensus(project, ["collectRent(payment: Payment): Receipt"]);
    assert.deepEqual(none.unbound, ["alpha", "beta"]);
    assert.equal(none.legacy, true);
    assert.equal(none.paths.includes("src/jobs/alpha.ts"), false);
    // The census is derived FROM the plan (no second path rule to drift).
    const viaPlan = orderTreeChunks(
      treeChunkPlan(project, [
        "runAlpha(command: AlphaCmd): Promise<Alpha>",
        "listBetaRuns(id: string): Promise<BetaRun[]>",
      ]),
    );
    assert.deepEqual([...both.paths].sort(), viaPlan.map((c) => c.path).sort());
  });

  it("W45/331-4: the core sentinel job is never a coverage obligation (vague-brief parity)", () => {
    const project = {
      specGraph: {
        nodes: [
          { id: "job-0", file: "src/jobs/deliver_core_workflow.ts", purpose: "Implement job “deliver-core-workflow” against the contract" },
        ],
      },
    };
    const census = treeChunkPlanCensus(project, ["collectRent(payment: Payment): Receipt"]);
    assert.deepEqual(census.declared, [], "the sentinel is not a declared capability");
    assert.deepEqual(census.unbound, []);
    assert.equal(census.legacy, true, "no keyable job chunk -> the legacy mapping");
    assert.deepEqual(specGraphJobTargets(project).map((t) => t.label), ["deliver-core-workflow"]);
  });

  it("R10-f01 (331-4): p6SynthesisContractsLines renders the A6 contract; the chunk prompt carries it, absent keeps legacy bytes", () => {
    assert.deepEqual(p6SynthesisContractsLines(null), []);
    assert.deepEqual(p6SynthesisContractsLines({ entities: [], endpoints: [] }), []);
    const contracts = {
      entities: [{ name: "House", fields: [{ name: "id", type: "ulid" }, { name: "arv", type: "number" }] }],
      endpoints: [{ method: "POST" as const, path: "/v1/flip", job: "flip" }],
    };
    const lines = p6SynthesisContractsLines(contracts);
    assert.ok(lines.includes("entities:"));
    assert.ok(lines.includes("- House (id:ulid, arv:number)"));
    assert.ok(lines.includes("endpoints:"));
    assert.ok(lines.includes("- POST /v1/flip (flip)"));
    const spec = ledgerSpec(2);
    const withC = p6SynthesisChunkUserPrompt(LEDGER_BRIEF, spec, spec.typeSignatures, [], [], contracts);
    assert.ok(withC.includes("DATA CONTRACTS"), "R10-f01: the contract reaches the chunk prompt");
    assert.ok(withC.includes("- House (id:ulid, arv:number)"));
    const without = p6SynthesisChunkUserPrompt(LEDGER_BRIEF, spec, spec.typeSignatures, [], []);
    assert.equal(without.includes("DATA CONTRACTS"), false, "no contract -> no block (legacy bytes)");
    assert.ok(withC.startsWith(without), "the block is additive; the legacy bytes are the prefix");
    // The 12-row cap is visible, never a silent cut.
    const many = {
      entities: Array.from({ length: 20 }, (_, i) => ({ name: `E${i}`, fields: [{ name: "id", type: "ulid" }] })),
      endpoints: [],
    };
    const capped = p6SynthesisContractsLines(many);
    assert.ok(capped.some((l) => l.includes("[CONTRACTS-ELIDED: 8 row(s) beyond the 12-row render cap")));
  });

  it("R12-f01 (331-4): the prior-file render is capped with a visible elision marker; only the newest files are re-sent", () => {
    const prior: ChunkPriorFile[] = Array.from({ length: 20 }, (_, i) => ({
      path: `src/generated/f${i}.ts`,
      exports: [`f${i}`],
      reqTrace: {},
    }));
    const spec = ledgerSpec(2);
    const prompt = p6SynthesisChunkUserPrompt(LEDGER_BRIEF, spec, spec.typeSignatures, prior, []);
    assert.ok(
      prompt.includes(`[PRIOR-ELIDED: 8 earlier file(s) beyond the ${P6_SYNTH_PRIOR_MAX_FILES}-file render cap`),
      "the file-cap elision marker is visible",
    );
    assert.ok(prompt.includes("- src/generated/f19.ts exports: f19"), "the newest file is kept");
    assert.equal(prompt.includes("- src/generated/f0.ts exports: f0"), false, "the oldest files past the cap are cut");
    // ≤ the cap file lines are rendered at all (O(chunks²)→O(chunks·cap)).
    const fileLines = prompt.split("\n").filter((l) => /^- src\/generated\/f\d+\.ts exports: /.test(l));
    assert.equal(fileLines.length, P6_SYNTH_PRIOR_MAX_FILES);
  });

  it("334-1 P3: the prior render also honours the per-chunk byte budget (a visible cut, not only the file cap)", () => {
    // Under the 12-file cap with huge export lists, so only the byte budget can
    // cut. 331-4 pinned the file cap; the second cut was untested until now.
    const big: ChunkPriorFile[] = Array.from({ length: 12 }, (_, i) => ({
      path: `src/generated/f${i}.ts`,
      exports: Array.from({ length: 1500 }, (_, j) => `exp${i}_${j}`),
      reqTrace: {},
    }));
    const spec = ledgerSpec(2);
    const prompt = p6SynthesisChunkUserPrompt(LEDGER_BRIEF, spec, spec.typeSignatures, big, []);
    const fileLines = prompt.split("\n").filter((l) => /^- src\/generated\/f\d+\.ts exports: /.test(l));
    assert.ok(fileLines.length >= 1 && fileLines.length < 12, "the byte budget cuts below the file cap");
    const marker = /\[PRIOR-ELIDED: (\d+) file\(s\) beyond the 60,000-char prompt budget/.exec(prompt);
    assert.ok(marker, "the byte-budget cut carries its visible marker");
    assert.equal(Number(marker![1]) + fileLines.length, 12, "every non-rendered file is counted in the marker");
    assert.ok(prompt.length <= P6_SYNTH_PROMPT_MAX_CHARS + 400, "the rendered prompt honours the budget (plus the marker)");
    // Legal control: a small prior block renders all and shows no marker.
    const small: ChunkPriorFile[] = Array.from({ length: 3 }, (_, i) => ({ path: `src/generated/s${i}.ts`, exports: [`s${i}`], reqTrace: {} }));
    const smallPrompt = p6SynthesisChunkUserPrompt(LEDGER_BRIEF, spec, spec.typeSignatures, small, []);
    assert.equal(smallPrompt.includes("PRIOR-ELIDED"), false);
    assert.equal(smallPrompt.split("\n").filter((l) => /^- src\/generated\/s\d/.test(l)).length, 3);
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

  it("C1/U4: empty lessons keep the legacy prompt; nonempty lessons append PRIOR LESSONS", () => {
    const spec = ledgerSpec(2);
    const legacy = p6SynthesisUserPrompt(LEDGER_BRIEF, spec);
    assert.equal(p6SynthesisUserPrompt(LEDGER_BRIEF, spec, []), legacy);
    assert.equal(p6SynthesisChunkUserPrompt(LEDGER_BRIEF, spec, spec.typeSignatures, [], []), legacy);
    const withLessons = p6SynthesisUserPrompt(LEDGER_BRIEF, spec, ["never mint accepted from a red gate"]);
    assert.ok(withLessons.startsWith(legacy));
    assert.ok(withLessons.includes("PRIOR LESSONS"));
    assert.ok(withLessons.includes("never mint accepted from a red gate"));
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

  it("216 T-01/T-16: a MULTI-LINE module.exports = {…} is removed WHOLE and the output still parses", () => {
    // The pre-216 code dropped only the `module.exports = {` line and kept the object body,
    // leaving a dangling `};` plus bare identifiers — a SyntaxError in every emitted module.
    // This feeds the multi-line form the old test never used, and asserts on PARSE, not shape.
    const src = [
      "function a() { return 1; }",
      "function b() { return 2; }",
      "module.exports = {",
      "  a,",
      "  b,",
      "};",
      "function c() { return 3; }",
      "",
    ].join("\n");
    const out = stripCjsExportAssignments(src, ["a", "b"]);
    assert.equal(out.includes("module.exports"), false, "the assign line is gone");
    assert.equal(out.includes("};"), false, "the literal's closing brace goes with it");
    assert.ok(!/^\s*[ab],\s*$/m.test(out), "no bare object keys are left behind");
    assert.ok(out.includes("function a() { return 1; }"), "unrelated code is preserved");
    assert.ok(out.includes("function c() { return 3; }"), "code AFTER the construct is preserved");
    // The real defect was a module body that did not parse — assert the parse, not the text.
    assert.doesNotThrow(() => new Function(out), "the stripped output must still parse");
    // TEETH: the pre-216 output shape does NOT parse, so this test would have caught the bug.
    assert.throws(
      () => new Function("function a() {}\n  a,\n  b,\n};\n"),
      SyntaxError,
      "the pre-216 output shape must be rejected — the old test could not see this",
    );
  });

  it("216 T-01: single-line whole-object assign is still fully dropped (legacy behaviour kept)", () => {
    const src = "function a() { return 1; }\nmodule.exports = { a };\n";
    const out = stripCjsExportAssignments(src, ["a"]);
    assert.equal(out.includes("module.exports"), false);
    assert.ok(out.includes("function a() { return 1; }"));
    assert.doesNotThrow(() => new Function(out));
  });

  it("216 T-01: braces inside string literals do not confuse the depth tracking", () => {
    const src = [
      "function a() { return \"}\"; }",
      "module.exports = {",
      "  a,",
      "  note: \"} not a close\",",
      "};",
      "function c() { return 3; }",
      "",
    ].join("\n");
    const out = stripCjsExportAssignments(src, ["a"]);
    assert.equal(out.includes("module.exports"), false);
    assert.ok(
      out.includes("function c() { return 3; }"),
      "code after the literal survives a `}` that sits inside a string",
    );
    assert.doesNotThrow(() => new Function(out));
  });

  it("325 A3: a brace REGEX inside a dropped whole-object assign never leaves a dangling `};`", () => {
    // Pre-fix the depth walk ignored regex literals: the `}` in `/}/g` closed
    // the construct early and the emitted chunk carried a dangling `};` — a
    // SyntaxError under the tenant's `"type":"module"` spec import. Assert on
    // the PARSE, not the shape.
    const src = [
      "function parse(s) { return String(s); }",
      "module.exports = {",
      "  parse: parse,",
      '  fmt: (s) => s.replace(/}/g, "!"),',
      "};",
      "function tail() { return 1; }",
      "",
    ].join("\n");
    const out = stripCjsExportAssignments(src, ["parse"]);
    assert.equal(out.includes("module.exports"), false, "the whole-object assign is gone");
    assert.ok(out.includes("function parse(s) { return String(s); }"), "code before survives");
    assert.ok(out.includes("function tail() { return 1; }"), "code AFTER the construct survives");
    assert.doesNotThrow(() => new Function(out), "no dangling `};` — the stripped output must parse");
    // TEETH: the pre-fix output shape (dangling `};`) does NOT parse.
    assert.throws(
      () => new Function("function parse(s) { return String(s); }\n};\nfunction tail() { return 1; }\n"),
      SyntaxError,
      "the pre-fix dangling-brace shape must be rejected — this test would have caught the bug",
    );
  });

  it("325 A3: a `[`-opening regex inside a dropped whole-object assign does not swallow the rest of the file", () => {
    // Pre-fix `/[{]/` added a phantom depth level and the construct consumed
    // through EOF — `const keep = 1;` vanished, leaving only `export { keep };`
    // (no binding) in the emitted file: `Export 'keep' is not defined`.
    const src = ["module.exports = {", "  open: /[{]/,", "};", "const keep = 1;", ""].join("\n");
    const out = stripCjsExportAssignments(src, ["open"]);
    assert.equal(out.includes("module.exports"), false);
    assert.ok(out.includes("const keep = 1;"), "code after the construct is preserved, not swallowed");
    assert.doesNotThrow(() => new Function(out));
  });

  it("W21-258: materializeImportableTree has NO single-file identity path — one chunk is materialized like N", () => {
    // fixes/175 returned single-file input unchanged ("legacy disk bytes");
    // fixes/258 removed that path: the emitted tenant always declares
    // `"type":"module"`, so a 1-chunk tree must be real ESM like every other
    // tree (the identity path is what killed the emitted spec at import:
    // `module is not defined in ES module scope`).
    const one = [{ path: TREE_ENTRY_PATH, source: "function a() {}\nmodule.exports.a = a;\n", exports: ["a"] }];
    const m = materializeImportableTree(one);
    assert.deepEqual(m.files.map((f) => f.path), [TREE_ENTRY_PATH, TREE_CHUNK0_RELOCATED_PATH]);
    assert.equal(m.entrySource, m.files[0]!.source, "entrySource is the entry file's own bytes");
    assert.ok(m.entrySource.includes(`export * from "./generated/chunk-0.ts";`), "the entry path is an ESM barrel");
    assert.ok(!m.entrySource.includes("module.exports"), "barrel is ESM");
    assert.equal(m.files[1]!.path, TREE_CHUNK0_RELOCATED_PATH, "the entry-path chunk moved off the barrel");
    assert.ok(!m.files[1]!.source.includes("module.exports"), "the chunk's CJS assigns are gone");
    assert.ok(m.files[1]!.source.includes("export { a };"), "the chunk exports its names as ESM");
    assert.deepEqual(materializeImportableTree(one), m, "deterministic: identical input ⇒ identical files");
    assert.deepEqual(materializeImportableTree([]), { files: [], entrySource: "" }, "empty input stays empty");
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

  it("W21-258: a residual CJS extra in a MULTI-chunk tree is neutralized too (no module refs in any emitted file)", () => {
    const m = materializeImportableTree([
      {
        path: TREE_ENTRY_PATH,
        source: "function a() { return 1; }\nmodule.exports.a = a;\nmodule.exports._kit = { a: a };\n",
        exports: ["a"],
      },
      { path: "src/generated/b.ts", source: "function b() { return a(); }\nmodule.exports.b = b;\n", exports: ["b"] },
    ]);
    for (const f of m.files) assert.ok(!f.source.includes("module.exports"), `${f.path} is pure ESM`);
    const chunk0 = m.files.find((f) => f.path === TREE_CHUNK0_RELOCATED_PATH)!;
    assert.ok(chunk0.source.includes("const _kit = { a: a };"), "the extra surface is converted, never left as CJS");
    assert.ok(chunk0.source.includes("export { a, _kit };"), "the file exports its whole real surface");
    const later = m.files.find((f) => f.path === "src/generated/b.ts")!;
    assert.ok(later.source.includes(`import { a, _kit } from "./chunk-0.ts";`), "later files import the full prior surface");
    const run = importMaterializedTree(m);
    assert.equal(run.status, 0, `the emitted tree must import under type:module — stderr:\n${run.stderr}`);
    assert.equal(run.stdout.trim(), "TREE_IMPORT_OK exports=[_kit,a,b]", "the barrel exposes the union");
  });

  it("W21-258 RED→GREEN: a single-chunk tree materializes as ESM importable under the tenant's `\"type\":\"module\"`", () => {
    // Run #2's artifact shape (fixes/255 §1): ONE accepted chunk at its own
    // planned path, raw P6 CommonJS bytes — including a NON-listed export
    // surface the model added on its own (`module.exports._internals`, the
    // 258-line get-property.ts's last line). The emitted tenant declares
    // `"type":"module"` and its spec statically imports the tree ENTRY as ESM:
    // before the fix that import died with `ReferenceError: module is not
    // defined in ES module scope` at the chunk's last line, so ZERO spec
    // assertions ever ran (treeRunOk:false → the C-1 mint stayed silent).
    const chunk = {
      path: "src/generated/get-property.ts",
      source: [
        "const LEDGER = { entries: [] };",
        "function getProperty(propertyId) {",
        "  return { propertyId: propertyId, ledger: LEDGER };",
        "}",
        "module.exports.getProperty = getProperty;",
        "module.exports._internals = { LEDGER: LEDGER };",
        "",
      ].join("\n"),
      exports: ["getProperty"],
    };
    const m = materializeImportableTree([chunk]);
    // THE PIN — the emitted spec's load, executed by real `node` in a real
    // `"type":"module"` tenant (RED before the fix: the crash below).
    const run = importMaterializedTree(m);
    assert.equal(
      run.status,
      0,
      `the tenant's ESM import of the tree entry must succeed (entry: ${run.entry}) — stderr:\n${run.stderr}`,
    );
    assert.ok(!run.stderr.includes("module is not defined"), "no CJS-in-ESM crash (fixes/255 layer 1)");
    assert.equal(
      run.stdout.trim(),
      "TREE_IMPORT_OK exports=[_internals,getProperty]",
      "the entry re-exports the chunk's real surface (listed + converted names)",
    );
    // Shape: the single chunk goes through the SAME materialization as N>1 —
    // ESM barrel at TREE_ENTRY_PATH + the chunk file, no CJS bytes in either.
    assert.equal(m.files.length, 2, "1 chunk → ESM barrel + the chunk file");
    assert.equal(m.files[0]!.path, TREE_ENTRY_PATH, "the barrel is the tree entry");
    assert.equal(m.entrySource, m.files[0]!.source, "entrySource is the entry file's own bytes");
    assert.ok(m.entrySource.includes(`export * from "./generated/get-property.ts";`), "barrel re-exports the chunk");
    const chunkFile = m.files.find((f) => f.path === chunk.path)!;
    assert.ok(!chunkFile.source.includes("module.exports"), "no CJS export bytes survive into the emitted tree");
    assert.ok(chunkFile.source.includes("export { getProperty, _internals };"), "listed + converted names exported");
  });

  it("325 A3: regex-brace assigns + bare-`let` residuals materialize to IMPORTABLE ESM (W21-258 import legs)", () => {
    // Leg 1 = A-2's dangling shape (`/}/g` inside the dropped whole-object
    // assign): pre-fix the emitted chunk imported as SyntaxError.
    const dangling = materializeImportableTree([
      {
        path: TREE_ENTRY_PATH,
        source: [
          "function parse(s) { return String(s); }",
          "module.exports = {",
          "  parse: parse,",
          '  fmt: (s) => s.replace(/}/g, "!"),',
          "};",
          "function tail() { return 1; }",
          "",
        ].join("\n"),
        exports: ["parse"],
      },
    ]);
    const runDangling = importMaterializedTree(dangling);
    assert.equal(runDangling.status, 0, `dangling leg must import — stderr:\n${runDangling.stderr}`);
    assert.equal(runDangling.stdout.trim(), "TREE_IMPORT_OK exports=[parse]");
    // Leg 2 = A-3's duplicate-declaration shape (`let cache;` + residual
    // assign): pre-fix the chunk imported as
    // `Identifier 'cache' has already been declared`.
    const bare = materializeImportableTree([
      {
        path: TREE_ENTRY_PATH,
        source: [
          "let cache;",
          "function compute() { return { ok: true }; }",
          "module.exports.cache = cache || compute();",
          "module.exports.compute = compute;",
          "",
        ].join("\n"),
        exports: ["cache", "compute"],
      },
    ]);
    assert.ok(
      !bare.files.some((f) => f.source.includes("const cache =")),
      "no duplicate `cache` declaration anywhere in the emitted tree",
    );
    const runBare = importMaterializedTree(bare);
    assert.equal(runBare.status, 0, `bare-let leg must import — stderr:\n${runBare.stderr}`);
    assert.equal(runBare.stdout.trim(), "TREE_IMPORT_OK exports=[cache,compute]");
  });

  it("W21-258: neutralizeResidualCjsExports clears every remaining CJS export statement (real-artifact shape)", () => {
    // The shape run #2's accepted chunk shipped (fixes/255 §1): declared-name
    // assigns go first (stripCjsExportAssignments), then whatever CJS surface
    // the chunk itself wrote must not survive into the ESM file.
    const src = [
      "const LEDGER = { entries: [] };",
      "const counter = 1;",
      "function getProperty(id) { return { id: id, ledger: LEDGER }; }",
      "module.exports._internals = { LEDGER: LEDGER };", // not bound → const + exported
      "module.exports.counter = counter;", // bound → statement dropped, name kept exported
      "module.exports.default = counter;", // reserved word → dropped, never exported
      "module.exports.registry = {",
      "  LEDGER: LEDGER,",
      "};", // multi-line value → const, value lines kept verbatim
      "module.exports[globalThis.key] = 1;", // computed → dropped
      "",
    ].join("\n");
    const out = neutralizeResidualCjsExports(src);
    assert.ok(!/^[ \t]*(module\.)?exports[\s.[]/m.test(out.source), "no CJS export statement survives");
    assert.deepEqual(out.exported, ["_internals", "counter", "registry"], "surface names, source order, reserved skipped");
    assert.ok(out.source.includes("const _internals = { LEDGER: LEDGER };"), "unbound CJS name minted as a const binding");
    assert.ok(out.source.includes("const registry = {"), "multi-line value keeps its lines");
    assert.ok(out.source.includes("  LEDGER: LEDGER,"), "multi-line value body kept verbatim");
    assert.equal(out.source.split("const counter =").length - 1, 1, "an already-bound name is never re-declared");
    assert.ok(!out.source.includes("const default"), "a reserved word is never minted as a binding");
    assert.ok(!out.source.includes("globalThis.key"), "computed CJS surface is dropped whole");
    assert.doesNotThrow(() => new Function(out.source), "the neutralized body still parses");
    // A comment mentioning the pattern is inert — a statement must START with it.
    const commented = neutralizeResidualCjsExports("// module.exports.x = x;\nfunction x() {}\n");
    assert.deepEqual(commented.exported, []);
    assert.ok(commented.source.includes("// module.exports.x = x;"), "comments are never rewritten");
  });

  it("325 A3: a bare `let cache;` is a local binding — the residual assign drops, never a duplicate const", () => {
    // Pre-fix `localBindingNames` only saw `const|let|var NAME =` shapes, so
    // `module.exports.cache = cache || compute();` converted to
    // `const cache = cache || compute();` beside the file's own `let cache;` —
    // a duplicate declaration (and a TDZ self-reference) that killed the whole
    // emitted tree at import.
    const src = [
      "let cache;",
      "function compute() { return { ok: true }; }",
      "module.exports.cache = cache || compute();",
      "module.exports.compute = compute;",
      "",
    ].join("\n");
    const out = neutralizeResidualCjsExports(stripCjsExportAssignments(src, ["cache", "compute"]));
    assert.equal(out.source.split(/\b(?:const|let|var)\s+cache\b/).length - 1, 1, "exactly ONE declaration of cache");
    assert.ok(out.source.includes("let cache;"), "the file's own declaration is kept");
    assert.ok(!out.source.includes("const cache ="), "no duplicate const conversion");
    assert.deepEqual(out.exported, ["cache"], "the name stays on the export surface");
    assert.doesNotThrow(() => new Function(out.source));
    // destructuring arm: `const { id } = row;` binds `id` — the residual
    // `module.exports.id = id;` must not mint `const id = id;`.
    const destructured = neutralizeResidualCjsExports("const { id } = row;\nmodule.exports.id = id;\n");
    assert.ok(!destructured.source.includes("const id ="), "destructured names are bindings too");
    assert.deepEqual(destructured.exported, ["id"]);
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
      /- src\/jobs\/rent\.ts exports: collectRent0, collectRent1/,
      "earlier-file context lists paths + exports (216k W6: chunk-0 file is the JOB file)",
    );
    assert.match(
      synthPrompts[2]!,
      /- src\/jobs\/rent-2\.ts exports: collectRent8/,
      "second chunk file listed with its path (216k W6: sibling -2 file)",
    );
    for (const p of synthPrompts) {
      assert.ok(p.includes(LEDGER_BRIEF), "shared brief in every chunk prompt");
      assert.ok(p.includes("Track rent collection per tenant."), "full requirement list in every chunk prompt");
    }
    assert.deepEqual(f.calls, ["expand", "complete", "complete", "complete"]);
  });

  it("W45/331-4: the chunked driver persists ONE p6.tree.shortfall warn naming the unbound declared jobs", async () => {
    // The LEDGER brief declares 4 capabilities (track/record/lease/rent) whose
    // spec graph materialises 4 job nodes; every `collectRent<i>` signature names
    // only `rent`, so the other three get no chunk and no file — silently, until
    // this census. (The existing fixture never noticed: it only asserts rent.ts.)
    const f = chunkedDeps();
    const q = await liveP6Synthesis(p6Base(LEDGER_BRIEF), f.deps);
    const rows = q.logs.filter((l) => l.event === "p6.tree.shortfall");
    assert.equal(rows.length, 1, "one persisted row, not one per chunk");
    assert.equal(rows[0]!.level, "warn");
    assert.match(rows[0]!.detail, /no src\/jobs module will be synthesized/);
    for (const label of ["track", "record", "lease"]) {
      assert.match(rows[0]!.detail, new RegExp(`\\b${label}\\b`), `${label} is a declared job with no bound signature`);
    }
    assert.equal(/\brent\b/.test(rows[0]!.detail), false, "the bound job is not named");
    // Negative control: a base whose only job node IS named logs nothing.
    const onlyRent = p6Base(LEDGER_BRIEF);
    onlyRent.specGraph = {
      nodes: (onlyRent.specGraph?.nodes ?? []).filter(
        (n) => !String(n.id).startsWith("job-") || n.file === "src/jobs/rent.ts",
      ),
    } as Project["specGraph"];
    const clean = await liveP6Synthesis(onlyRent, chunkedDeps().deps);
    assert.equal(clean.logs.some((l) => l.event === "p6.tree.shortfall"), false);
  });

  it("W45/331-4 (Finding B) e2e: a later chunk redeclaring an earlier export is refused, repaired, then accepted", async () => {
    const base = p6Base(LEDGER_BRIEF);
    const spec = ledgerSpec(20);
    const groups = chunkTypeSignatures(spec.typeSignatures);
    const chunkNames = groups.map((g) => signatureFunctionNames(g));
    const prompts: string[] = [];
    let synthIndex = 0;
    // Chunk 1's first reply ALSO redeclares chunk 0's first export — the recorded
    // real shape (flip.ts importing estimateARV AND declaring it). The bounded
    // duplicate-declaration repair must then return the corrected chunk.
    const complete = async (prompt: string): Promise<LlmResult> => {
      prompts.push(prompt);
      if (!prompt.includes("TYPE SIGNATURES (must export")) {
        const names = chunkNames[1] ?? [];
        return { ok: true, text: JSON.stringify(chunkEnvelope(names, 1, names[0])), model: "deepseek-v4-flash" };
      }
      const idx = synthIndex++;
      let names = chunkNames[idx] ?? [];
      if (idx === 1) names = [...names, chunkNames[0]![0]!];
      const priorFirst = idx > 0 ? chunkNames[idx - 1]?.[0] : undefined;
      return { ok: true, text: JSON.stringify(chunkEnvelope(names, idx, priorFirst)), model: "deepseek-v4-flash" };
    };
    const expand = async () => ({ ok: true as const, spec });
    const verify = async () => ({ status: "passed" as const, iterations: 0, evidence: "unused", finalSource: "", cases: [] });
    const q = await liveP6Synthesis(base, { complete, expand, verify });
    const dupRepairs = prompts.filter((p) => p.includes("already exported by "));
    assert.equal(dupRepairs.length, 1, "exactly one duplicate-declaration repair fired");
    assert.match(dupRepairs[0]!, /already exported by src\/jobs\/rent\.ts/);
    assert.match(dupRepairs[0]!, /"collectRent0"/);
    assert.ok(!q.logs.some((l) => l.event === "p6.synthesis.refused"), "the repair converged — no chunk refused");
    assert.equal(q.generatedTree?.length, 4, "barrel + 3 chunks (the repaired chunk accepted)");
    // The repaired, materialized chunk imports the earlier chunk's exports but no
    // longer declares them — the duplicate-import SyntaxError cannot ship.
    const rent2 = (q.generatedTree ?? []).find((f) => f.path === "src/jobs/rent-2.ts");
    assert.ok(rent2, "the repaired chunk is on disk");
    assert.ok(rent2!.source.includes("import {"), "it imports its sibling");
    assert.equal(/^(?:export\s+)?(?:async\s+)?function\s+collectRent0\s*\(/m.test(rent2!.source), false, "no redeclaration of the prior export");
  });

  it("multi-chunk success: tree files carry path + fnv1a hash + attempt 0; A0 ESM barrel is the entry", async () => {
    const base = p6Base(LEDGER_BRIEF);
    const f = chunkedDeps();
    const q = await liveP6Synthesis(base, f.deps);
    const tree = q.generatedTree ?? [];
    assert.equal(tree.length, 4, "barrel + 3 chunks");
    assert.deepEqual(
      tree.map((t) => t.path),
      [TREE_ENTRY_PATH, "src/jobs/rent.ts", "src/jobs/rent-2.ts", "src/jobs/rent-3.ts"],
    );
    for (const t of tree) {
      assert.equal(t.hash, String(fnv1a(t.source)), "content-addressed hash");
      assert.equal(t.attempt, 0);
      assert.ok(t.source.trim().length > 0);
    }
    const barrel = tree[0]!;
    assert.equal(q.generatedSource, barrel.source, "generatedSource is the ESM barrel (what treeRun/oracle import)");
    assert.ok(barrel.source.includes(`export * from "./jobs/rent.ts";`));
    assert.ok(barrel.source.includes(`export * from "./jobs/rent-2.ts";`));
    assert.ok(barrel.source.includes(`export * from "./jobs/rent-3.ts";`));
    assert.ok(!barrel.source.includes("module.exports"), "entry is ESM, not IIFE-concat");
    const later = tree[2]!;
    assert.ok(later.source.includes("import {"), "later chunk imports prior exports");
    assert.ok(later.source.includes("export {"), "later chunk is ESM");
    assert.ok(!later.source.includes("(function (module, exports"), "no IIFE wrapper on disk");
    // 216 (T-06 / F-02): the tree REPLACED the artifact, so the template
    // `tests.pass` stamp describes a template that no longer exists. The old
    // assertion here pinned identity (`lastTest untouched`) — which kept the
    // no-fabrication intent but ALSO let a stale green stamp outlive its
    // artifact, which is exactly the shipped-packet F-02 (packet records
    // ok:true while the shipped test exits 1). Now: invalidate, and still never
    // fabricate a 'tested' claim in its place.
    assert.equal(
      base.lastTest?.detail,
      "tests.pass",
      "precondition: the base really carried a template tests.pass stamp (else this test proves nothing)",
    );
    assert.equal(
      q.lastTest,
      null,
      "216 T-06: a stamp describing the REPLACED artifact is INVALIDATED, not carried forward",
    );
    assert.notEqual(
      (q.lastTest as { label?: string } | null)?.label,
      "tested",
      "and no fabricated 'tested' claim is minted in its place",
    );
    assert.ok(!q.artifacts.some((a) => a.title.includes("machine-verified")));
    assert.ok(q.artifacts.some((a) => a.title.startsWith("Generated source tree (LLM")));
    assert.equal(q.modelRoute, "deepseek-flash", "flash tier really synthesized the chunks");
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
      [TREE_ENTRY_PATH, "src/jobs/rent.ts", "src/jobs/rent-2.ts"],
    );
    assert.equal(q.generatedSource, tree[0]!.source, "partial entry is the ESM barrel over accepted chunks");
    assert.ok(q.generatedSource.includes(`export * from "./jobs/rent.ts";`));
    assert.ok(q.generatedSource.includes(`export * from "./jobs/rent-2.ts";`));
    assert.ok(!q.generatedSource.includes("collect-rent16"), "refused chunk 2 is absent from the barrel");
    assert.equal(q.modelRoute, "deepseek-flash");
    // R9-f02 (W29 · W-05/A1-f05/R8-f16): identity (`lastTest === base.lastTest`)
    // was the OPPOSITE guard — it let the floor's green template stamp outlive
    // the artifact it described, so `p6-test` read green for untested code.
    // The partial tree REPLACED that artifact: invalidate, never carry.
    assert.equal(
      base.lastTest?.detail,
      "tests.pass",
      "precondition: the base really carried a template tests.pass stamp (else this test proves nothing)",
    );
    assert.equal(q.lastTest, null, "no verified claim on a partial");
    // …and the MACHINE gate must read the same thing the packet does: the
    // p6-test probe (dod.ts) can never pass on a null lastTest.
    const gate = runGate(q, 6);
    assert.equal(gate.pass, false, "a partial tree never clears the P6 DoD gate");
    assert.ok(
      gate.unmet.some((i) => i.id === "p6-test"),
      "runGate(p,6) reads p6-test UNMET on a partial tree",
    );
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

describe("liveP6Synthesis ≤8 single-chunk regression (fixes/144 M2 pipeline; FM-01 records ESM)", () => {
  it("2 signatures → legacy pipeline untouched, recorded as the materialized ESM tree", async () => {
    const base = p6Base(); // KANBAN (2 signatures)
    const { calls, deps } = fakeDeps();
    const q = await liveP6Synthesis(base, deps);
    // fixes/144 pinned the legacy PIPELINE bytes — one synthesis call + bounded
    // repair + machine verify; that stands untouched.
    assert.deepEqual(calls, ["expand", "complete", "verify"], "legacy call sequence untouched");
    // FM-01 (W37 Y1): what changed is the RECORDED artifact — the verified
    // module is materialized to ESM at synthesis time (barrel + relocated
    // chunk). The old raw-CJS one-file tree died at import in the
    // `"type":"module"` tenant whenever a consumer read it without emitting.
    const chunk = assertRecordedMaterialized(q, KANBAN_MODULE.trim());
    const tree = q.generatedTree ?? [];
    assert.equal(tree.length, 2, "≤8 signatures → barrel + one chunk file (FM-01)");
    assert.equal(tree[0]!.path, TREE_ENTRY_PATH, "the barrel is the tree entry");
    assert.equal(tree[0]!.hash, String(fnv1a(tree[0]!.source)), "content-addressed hash");
    assert.equal(tree[1]!.path, TREE_CHUNK0_RELOCATED_PATH, "the module moved off the entry path");
    assert.equal(tree[1]!.hash, String(fnv1a(tree[1]!.source)), "content-addressed hash");
    assert.equal(tree[1]!.attempt, 0);
    assert.equal(chunk, tree[1]!.source, "the chunk file carries the accepted module's bytes");
    assert.equal(q.modelRoute, "deepseek-flash");
    assert.ok(q.artifacts.some((a) => a.title === "Generated module (LLM, machine-verified)"));
    assert.equal((q.lastTest as { label?: string } | null)?.label, "tested");
  });

  it("FM-01: a fresh single-module synthesis ships ESM BEFORE any emit — zero CJS residue in the tree", async () => {
    const base = p6Base();
    const { deps } = fakeDeps();
    const q = await liveP6Synthesis(base, deps);
    const rows = q.generatedTree ?? [];
    assert.ok(rows.length > 0, "a generatedTree exists at synthesis time (no emit ran in this test)");
    // The emit-time residue probe's own shape (headless.ts:1642 CJS_RESIDUE_RE,
    // mirrored here): a tree that trips it at emit is exactly the defect FM-01
    // closed at the synthesis seam. `materializeEmitTree` is now a no-op over
    // this tree — the guard stays as the backstop only.
    const cjsResidue = /module\.exports|(?:^|[^\w$.])exports\s*(?:\.|=[^=])/;
    for (const r of rows) {
      assert.ok(!cjsResidue.test(r.source), `${r.path} carries no CJS residue before emit`);
    }
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
    assertRecordedMaterialized(q, KANBAN_MODULE.trim()); // FM-01 re-point: the repair rescued the malformed envelope, recorded materialized
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
    assertRecordedMaterialized(q, KANBAN_MODULE.trim()); // FM-01: recorded as the materialized ESM tree
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

// --- fixes/326 F1b: the one-shot gate-repair context on the PRIMARY prompts ---
// The journey's diverted repair cycle feeds the recorded unmet P6 DoD
// requirements through deps.gateRepair; codegen appends it as ONE bounded
// block on the PRIMARY synthesis prompt (single-module and every tree chunk).
// Absent/blank ⇒ the prompt stays byte-identical to the legacy text.

describe("liveP6Synthesis deps.gateRepair rides the PRIMARY synthesis prompts (fixes/326 F1b)", () => {
  /** A single-line context (whitespace-collapse is identity here) so the
   *  expected block bytes are exact. */
  const GATE_REPAIR =
    "P6 DoD unmet: p6-brief-fit | Recorded missing requirements: missing: static, marketing, website";
  const block = (t: string): string =>
    "\n\nP6 GATE REPAIR CONTEXT (the previous cycle's tree-run was GREEN; the P6 DoD gate weighed it and REFUSED — implement these recorded unmet requirements with real working code, not renames or padding):\n" +
    t;

  it("single-module: the block is appended to the primary user prompt exactly once; absent deps keep the legacy bytes", async () => {
    const run = async (gateRepair?: string): Promise<string[]> => {
      const base = p6Base();
      const prompts: string[] = [];
      const complete = async (p: string): Promise<LlmResult> => {
        prompts.push(p);
        return { ok: true, text: JSON.stringify(KANBAN_ENVELOPE), model: "deepseek-v4-flash" };
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
        ...(gateRepair === undefined ? {} : { gateRepair }),
      });
      assertRecordedMaterialized(q, KANBAN_MODULE.trim());
      return prompts;
    };
    const withRepair = await run(GATE_REPAIR);
    const legacy = await run();
    assert.equal(withRepair.length, 1, "one primary synthesis call");
    assert.equal(legacy.length, 1, "one primary synthesis call (legacy run)");
    const primary = withRepair[0]!;
    // Byte-exact: the legacy prompt + exactly one bounded block appended.
    assert.equal(
      primary,
      legacy[0]! + block(GATE_REPAIR),
      "the gate-repair block is appended once to the legacy prompt bytes",
    );
    assert.equal(primary.split("P6 GATE REPAIR CONTEXT").length - 1, 1, "the block appears ONCE");
    assert.equal(legacy[0]!.includes("P6 GATE REPAIR CONTEXT"), false, "absent deps.gateRepair ⇒ no block");
  });

  it("chunked: every PRIMARY chunk prompt carries the block once when deps.gateRepair is present; absent keeps the legacy bytes", async () => {
    const base = p6Base(LEDGER_BRIEF);
    const withDeps = chunkedDeps();
    const legacyDeps = chunkedDeps();
    const qWith = await liveP6Synthesis(base, { ...withDeps.deps, gateRepair: GATE_REPAIR });
    const qLegacy = await liveP6Synthesis(base, legacyDeps.deps);
    assert.ok((qWith.generatedTree ?? []).length >= 2, "the chunked tree assembled");
    assert.deepEqual(
      (qLegacy.generatedTree ?? []).map((f) => f.path),
      (qWith.generatedTree ?? []).map((f) => f.path),
      "the additive context does not change the tree shape",
    );
    const synth = (ps: string[]): string[] => ps.filter((p) => p.includes("TYPE SIGNATURES (must export"));
    const withPrompts = synth(withDeps.prompts);
    const legacyPrompts = synth(legacyDeps.prompts);
    assert.equal(withPrompts.length, legacyPrompts.length, "same number of chunk synthesis calls");
    assert.ok(withPrompts.length >= 2, "a real multi-chunk run");
    for (let i = 0; i < withPrompts.length; i++) {
      assert.equal(
        withPrompts[i],
        legacyPrompts[i] + block(GATE_REPAIR),
        `chunk ${i + 1}'s primary prompt = legacy bytes + one block`,
      );
      assert.equal(withPrompts[i]!.split("P6 GATE REPAIR CONTEXT").length - 1, 1, `chunk ${i + 1} carries the block once`);
    }
  });
});

// --- fixes/328 F1 (Ledger): the previous-refusal context on the PRIMARY prompts ---
// Closes PREP-2: `deps.synthesisRefusal` was produced by headless
// p6CycleLiveDeps but read by NOTHING — a refused cycle re-synthesized blind.
// It now rides the SAME PRIMARY prompt seams as gateRepair (single-module +
// every tree chunk) as ONE bounded, whitespace-collapsed block; absent/blank ⇒
// byte-identical legacy bytes, so a cycle that was NOT refused synthesizes
// exactly as before.

describe("liveP6Synthesis deps.synthesisRefusal rides the PRIMARY synthesis prompts (fixes/328 F1)", () => {
  /** Single-line, no whitespace runs ⇒ collapse is the identity here; the
   *  collapse + bound are exercised by their own test below. */
  const REFUSAL = "RT_E_LLM_REJECTED · the model refused the multi-file tree brief: returned a stub only";
  const block = (t: string): string =>
    "\n\nP6 PREVIOUS-REFUSAL CONTEXT (the previous synthesis cycle was REFUSED — this is the refusal class and the model's own recorded reason, NOT a new requirement; correct the stated cause and return a valid envelope):\n" +
    t;

  /** Run the single-module primary synthesis once and return every prompt the
   *  model saw (exactly one on a clean envelope). */
  const runPrimary = async (synthesisRefusal?: string): Promise<string[]> => {
    const base = p6Base();
    const prompts: string[] = [];
    const complete = async (p: string): Promise<LlmResult> => {
      prompts.push(p);
      return { ok: true, text: JSON.stringify(KANBAN_ENVELOPE), model: "deepseek-v4-flash" };
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
      ...(synthesisRefusal === undefined ? {} : { synthesisRefusal }),
    });
    assertRecordedMaterialized(q, KANBAN_MODULE.trim());
    return prompts;
  };

  it("single-module: the block is appended to the primary prompt exactly once; absent deps keep the legacy bytes", async () => {
    const withRefusal = await runPrimary(REFUSAL);
    const legacy = await runPrimary();
    assert.equal(withRefusal.length, 1, "one primary synthesis call");
    assert.equal(legacy.length, 1, "one primary synthesis call (legacy run)");
    assert.equal(
      withRefusal[0],
      legacy[0]! + block(REFUSAL),
      "the refusal block is appended once to the legacy prompt bytes",
    );
    assert.equal(withRefusal[0]!.split("P6 PREVIOUS-REFUSAL CONTEXT").length - 1, 1, "the block appears ONCE");
    assert.equal(legacy[0]!.includes("P6 PREVIOUS-REFUSAL CONTEXT"), false, "absent deps.synthesisRefusal ⇒ no block");
  });

  it("single-module: blank/whitespace-only synthesisRefusal is byte-identical to the legacy prompt", async () => {
    const legacy = await runPrimary();
    for (const blank of ["", "   ", "\n\t  \n"]) {
      const got = await runPrimary(blank);
      assert.equal(got[0], legacy[0], `blank refusal ${JSON.stringify(blank)} keeps the legacy bytes`);
    }
  });

  it("single-module: multi-line reason is whitespace-collapsed and the block is bounded to 200 chars", async () => {
    const messy = await runPrimary("RT_E_LLM_REJECTED ·   the model\nrefused\t the  tree   brief");
    assert.ok(
      messy[0]!.includes(block("RT_E_LLM_REJECTED · the model refused the tree brief")),
      "a whitespace-collapsed single-line block (newlines/tabs/runs → one space)",
    );
    const long = await runPrimary("Z".repeat(260));
    assert.ok(long[0]!.endsWith(block("Z".repeat(200))), "a >200-char refusal is capped at the 200-char bound");
    assert.equal(long[0]!.includes("Z".repeat(201)), false, "the cap never leaks a 201st char into the prompt");
  });

  it("chunked: every PRIMARY chunk prompt carries the block once when deps.synthesisRefusal is present; absent keeps the legacy bytes", async () => {
    const base = p6Base(LEDGER_BRIEF);
    const withDeps = chunkedDeps();
    const legacyDeps = chunkedDeps();
    const qWith = await liveP6Synthesis(base, { ...withDeps.deps, synthesisRefusal: REFUSAL });
    const qLegacy = await liveP6Synthesis(base, legacyDeps.deps);
    assert.ok((qWith.generatedTree ?? []).length >= 2, "the chunked tree assembled");
    assert.deepEqual(
      (qLegacy.generatedTree ?? []).map((f) => f.path),
      (qWith.generatedTree ?? []).map((f) => f.path),
      "the additive context does not change the tree shape",
    );
    const synth = (ps: string[]): string[] => ps.filter((p) => p.includes("TYPE SIGNATURES (must export"));
    const withPrompts = synth(withDeps.prompts);
    const legacyPrompts = synth(legacyDeps.prompts);
    assert.equal(withPrompts.length, legacyPrompts.length, "same number of chunk synthesis calls");
    assert.ok(withPrompts.length >= 2, "a real multi-chunk run");
    for (let i = 0; i < withPrompts.length; i++) {
      assert.equal(
        withPrompts[i],
        legacyPrompts[i] + block(REFUSAL),
        `chunk ${i + 1}'s primary prompt = legacy bytes + one block`,
      );
      assert.equal(withPrompts[i]!.split("P6 PREVIOUS-REFUSAL CONTEXT").length - 1, 1, `chunk ${i + 1} carries the block once`);
    }
  });

  it("both gateRepair and synthesisRefusal present ⇒ both blocks, gateRepair first (composition order)", async () => {
    const base = p6Base();
    const prompts: string[] = [];
    const complete = async (p: string): Promise<LlmResult> => {
      prompts.push(p);
      return { ok: true, text: JSON.stringify(KANBAN_ENVELOPE), model: "deepseek-v4-flash" };
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
      gateRepair: "P6 DoD unmet: p6-brief-fit | Recorded missing requirements: missing: x",
      synthesisRefusal: REFUSAL,
    });
    assertRecordedMaterialized(q, KANBAN_MODULE.trim());
    const primary = prompts[0]!;
    const gi = primary.indexOf("P6 GATE REPAIR CONTEXT");
    const ri = primary.indexOf("P6 PREVIOUS-REFUSAL CONTEXT");
    assert.ok(gi >= 0 && ri >= 0, "both context blocks are present on the primary prompt");
    assert.ok(gi < ri, "the gateRepair block precedes the refusal block (stable composition order)");
  });
});

// --- T4 (112 §4.4 / 216g): cross-project proven lessons reach the prompts ---
// `knowledge.provenRowsFromStore` resolves a configured KnowledgeStore into
// rankable rows; `lessonLinesForBrief` already accepts `opts.proven`. This pins
// that the rows actually reach ALL THREE lesson sites (expansion advisory +
// single-module PRIMARY + every tree chunk PRIMARY). Absent/empty ⇒ the legacy
// prompt bytes (the additive-field discipline gateRepair/synthesisRefusal use).

describe("liveP6Synthesis deps.proven ranks cross-project lessons into the prompts (T4 · 112 §4.4)", () => {
  /** One resolved cross-project row, shaped exactly as `provenToLessonRow`
   *  produces them (id prefixed `proven-`, source "research"). */
  const PROVEN: readonly RankableLessonRow[] = [
    {
      id: "proven-K1deadbeef",
      kind: "semantic",
      phase: 0,
      text: "MARKER_PROVEN: a prior accepted run shipped a board that dropped the empty-column rejection guard — keep it.",
      score: 0.95,
      source: "research",
      tags: ["lesson"],
    },
  ];

  /** Run the single-module PRIMARY synthesis once, capturing every model prompt
   *  and the expansion lessons argument; memory is lesson-free so the only
   *  possible lesson source is deps.proven. */
  const runPrimary = async (
    proven?: readonly RankableLessonRow[],
  ): Promise<{ prompts: string[]; expandLessons: readonly string[] | undefined }> => {
    const raw = p6Base();
    const base: Project = {
      ...raw,
      memory: (raw.memory ?? []).filter((m) => !(m.tags ?? []).includes("lesson")),
    };
    const prompts: string[] = [];
    let expandLessons: readonly string[] | undefined;
    const complete = async (p: string): Promise<LlmResult> => {
      prompts.push(p);
      return { ok: true, text: JSON.stringify(KANBAN_ENVELOPE), model: "deepseek-v4-flash" };
    };
    const q = await liveP6Synthesis(base, {
      complete,
      expand: async (_brief: string, lessons?: readonly string[]) => {
        expandLessons = lessons;
        return { ok: true, spec: KANBAN_SPEC };
      },
      verify: async () => ({
        status: "passed",
        iterations: 1,
        evidence: "3/3 machine-run cases passed on iteration 1",
        finalSource: KANBAN_MODULE,
        cases: [],
      }),
      ...(proven === undefined ? {} : { proven }),
    });
    assertRecordedMaterialized(q, KANBAN_MODULE.trim());
    return { prompts, expandLessons };
  };

  it("single-module: proven rows append the PRIOR LESSONS block; absent/empty keep the legacy prompt bytes", async () => {
    const legacy = await runPrimary();
    assert.equal(legacy.prompts.length, 1, "one primary synthesis call (legacy run)");
    assert.equal(legacy.prompts[0]!.includes("PRIOR LESSONS"), false, "no proven rows ⇒ no lessons block");
    assert.equal(legacy.expandLessons, undefined, "no proven rows ⇒ the expansion call keeps its legacy arity");
    // Absent vs empty array are BOTH the legacy bytes (byte-identity control).
    for (const empty of [undefined, [] as readonly RankableLessonRow[]]) {
      const got = await runPrimary(empty);
      assert.equal(got.prompts[0], legacy.prompts[0], "absent/empty deps.proven keeps the prompt byte-identical");
    }
    const withProven = await runPrimary(PROVEN);
    assert.equal(withProven.prompts.length, 1, "one primary synthesis call (proven run)");
    assert.ok(
      withProven.prompts[0]!.startsWith(legacy.prompts[0]!),
      "proven rows only APPEND the advisory lessons block (legacy prefix byte-identical)",
    );
    assert.ok(withProven.prompts[0]!.includes("PRIOR LESSONS"), "the lessons block is present");
    assert.ok(withProven.prompts[0]!.includes("MARKER_PROVEN"), "the proven row's text reaches the prompt");
    assert.equal(withProven.prompts[0]!.split("PRIOR LESSONS").length - 1, 1, "the block appears ONCE");
  });

  it("expansion site: proven rows reach the expansion fn's advisory lessons", async () => {
    const withProven = await runPrimary(PROVEN);
    assert.ok(
      withProven.expandLessons !== undefined && withProven.expandLessons.length > 0,
      "the expansion call receives lesson lines",
    );
    assert.ok(
      (withProven.expandLessons ?? []).some((l) => l.includes("MARKER_PROVEN")),
      "the cross-project row is ranked into the expansion advisory block",
    );
  });

  it("chunked: every chunk's PRIMARY prompt carries the proven lesson; absent keeps the legacy bytes", async () => {
    const base = p6Base(LEDGER_BRIEF);
    const withDeps = chunkedDeps();
    const legacyDeps = chunkedDeps();
    const qWith = await liveP6Synthesis(base, { ...withDeps.deps, proven: PROVEN });
    const qLegacy = await liveP6Synthesis(base, legacyDeps.deps);
    assert.ok((qWith.generatedTree ?? []).length >= 2, "the chunked tree assembled");
    assert.deepEqual(
      (qLegacy.generatedTree ?? []).map((f) => f.path),
      (qWith.generatedTree ?? []).map((f) => f.path),
      "the additive lessons do not change the tree shape",
    );
    const synth = (ps: string[]): string[] => ps.filter((p) => p.includes("TYPE SIGNATURES (must export"));
    const withPrompts = synth(withDeps.prompts);
    const legacyPrompts = synth(legacyDeps.prompts);
    assert.equal(withPrompts.length, legacyPrompts.length, "same number of chunk synthesis calls");
    assert.ok(withPrompts.length >= 2, "a real multi-chunk run");
    for (let i = 0; i < withPrompts.length; i++) {
      assert.equal(legacyPrompts[i]!.includes("PRIOR LESSONS"), false, `chunk ${i + 1} legacy: no lessons block`);
      assert.ok(
        withPrompts[i]!.startsWith(legacyPrompts[i]!),
        `chunk ${i + 1}'s prompt keeps the legacy prefix and appends only the lessons block`,
      );
      assert.ok(withPrompts[i]!.includes("MARKER_PROVEN"), `chunk ${i + 1} carries the proven row's text`);
    }
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
    assert.equal(tree.length, 2, "≤8 signatures on a webapp → the chunked path still fires (barrel + 1 chunk)");
    assert.equal(tree[0]!.path, TREE_ENTRY_PATH, "the ESM barrel is the tree entry");
    assert.equal(tree[1]!.path, TREE_CHUNK0_RELOCATED_PATH, "the chunk moved off the entry path");
    for (const t of tree) {
      assert.equal(t.hash, String(fnv1a(t.source)), "content-addressed hash");
      assert.equal(t.attempt, 0);
      assert.ok(t.source.trim().length > 0);
    }
    // generatedSource = the materialized ENTRY file's own bytes — the tree is
    // what scaffold hosts verbatim and treeRun runs (the M2=1 path from
    // fixes/145), never the machine-verified single module. fixes/258: a
    // single-chunk tree is materialized like any other, so the entry is the ESM
    // barrel instead of an IIFE concat of raw CommonJS.
    assert.equal(q.generatedSource, tree[0]!.source, "generatedSource is the entry barrel's own bytes");
    assert.ok(q.generatedSource.includes(`export * from "./generated/chunk-0.ts";`), "barrel re-exports the chunk");
    // The emitted artifact under the tenant's module system: a real ESM import
    // of the entry must load and expose the synthesized module's exports.
    const run = importMaterializedTree({ files: tree });
    assert.equal(run.status, 0, `the emitted ≤8-signature tree must import under type:module — stderr:\n${run.stderr}`);
    assert.equal(
      run.stdout.trim(),
      "TREE_IMPORT_OK exports=[addColumn,createBoard,dragCard,kanbanBoard]",
      "the entry exposes the synthesized module's exports",
    );
    // No machine verify at synthesis: the chunked path's tested mint is the
    // tree-run lane's step (fixes/147 E2) — never fabricated here.
    assert.deepEqual(calls, ["expand", "complete"], "chunked path: one synthesis call, NO verify leg");
    assert.equal(
      (q.lastTest as { label?: string } | null)?.label,
      undefined,
      "no fabricated tested stamp on the chunked path (verify is the tree-run lane's step)",
    );
    assert.equal(q.modelRoute, "deepseek-flash");
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
      assert.equal((q.generatedTree ?? []).length, 2, `${kind}: ≤8 sigs → chunked tree (barrel + chunk)`);
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

  it("a kind-absent library-style brief with ≤8 signatures KEEPS the single-module pipeline (fixes/148 pin; FM-01: recorded as ESM)", async () => {
    const base = p6Base(); // no kind — the legacy library/module fixture shape
    assert.equal(singleModuleLibraryKind(base), true, "fixture is single-module-library eligible");
    const { calls, deps } = fakeDeps();
    const q = await liveP6Synthesis(base, deps);
    assert.deepEqual(calls, ["expand", "complete", "verify"], "legacy call sequence untouched");
    assert.equal((q.lastTest as { label?: string } | null)?.label, "tested", "machine verify mints tested on the library path");
    // FM-01 (W37 Y1): the recorded artifact is now the materialized ESM tree
    // (barrel + chunk) — the PIPELINE above is what stays legacy, not the bytes.
    const chunk = assertRecordedMaterialized(q, KANBAN_MODULE.trim());
    const tree = q.generatedTree ?? [];
    assert.equal(tree.length, 2, "≤8 kind-absent → barrel + one chunk file (FM-01)");
    assert.equal(tree[0]!.path, TREE_ENTRY_PATH);
    assert.ok(chunk.includes("function createBoard("), "the verified module's bytes live in the chunk file");
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
    assertRecordedMaterialized(q, KANBAN_MODULE.trim()); // FM-01 re-point: synthesis still succeeds under the captured opts, recorded materialized
    assert.equal(seen.length, 1, "happy-path single-module synthesis = one complete call");
    const opts = seen[0]!;
    assert.equal(opts.maxTokens, 32_000, "maxTokens rides P6_SYNTH_MAX_TOKENS");
    assert.equal(opts.maxTokens, P6_SYNTH_MAX_TOKENS, "…via the exported constant, not a literal fork");
    assert.equal(opts.timeoutMs, 240_000, "timeoutMs rides P6_SYNTH_TIMEOUT_MS");
    assert.equal(opts.timeoutMs, P6_SYNTH_TIMEOUT_MS, "…via the exported constant, not a literal fork");
    assert.equal(opts.model, "deepseek-v4-flash", "216 T0.1: flash tier (the 240s/32k budget is the synthesis budget)");
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
      assert.equal(opts.model, "deepseek-v4-flash", "216 T0.1: same tier at both P6 call sites");
      assert.equal(opts.json, true, "chunk envelopes are json_object calls");
      assert.equal(
        opts.thinking,
        false,
        "fixes/156 E1: EVERY chunk synthesis disables pro thinking — OUTPUT budget, not CoT (empty-content blocker)",
      );
    }
  });
});

describe("synthWithBackoff token ledger (194/199)", () => {
  const okWithUsage = (n: number): LlmResult => ({
    ok: true,
    text: "module.exports = {}",
    model: "deepseek-v4-pro",
    usage: { promptTokens: n, completionTokens: 0 },
  });

  it("no cap: usage is recorded but the ok result is returned (unmetered)", async () => {
    // R4-f03 (W30 · LANE S3): `undefined` ledger now means the PROCESS session
    // budget — reset it so this test starts from an empty ledger (isolation).
    resetSessionBudget();
    const res = await synthWithBackoff(async () => okWithUsage(99999), "p", {}, async () => {}, undefined, undefined);
    assert.equal(res.ok, true);
  });

  it("missing usage is a no-op even with a cap", async () => {
    resetSessionBudget();
    const res = await synthWithBackoff(
      async () => ({ ok: true, text: "x", model: "deepseek-v4-pro" }),
      "p",
      {},
      async () => {},
      undefined,
      1,
    );
    assert.equal(res.ok, true);
  });

  it("cap exceeded after usage → RT_E_BUDGET_EXHAUSTED (never a green module)", async () => {
    resetSessionBudget();
    const res = await synthWithBackoff(async () => okWithUsage(50), "p", {}, async () => {}, undefined, 10);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "RT_E_BUDGET_EXHAUSTED");
  });

  it("R4-f03/W-21: the defaults are ONE process session budget — the cap trips ACROSS sub-cap calls (R12-f02)", async () => {
    const prev = process.env.RAPIDTOOL_TOKEN_CAP;
    process.env.RAPIDTOOL_TOKEN_CAP = "100";
    try {
      resetSessionBudget(); // re-reads env ⇒ cap=100, empty ledger
      assert.equal(sessionTokenBudget().cap, 100);
      const first = await synthWithBackoff(async () => okWithUsage(60), "p", {}, async () => {});
      assert.equal(first.ok, true); // 60 ≤ 100 — call #1 passes
      const second = await synthWithBackoff(async () => okWithUsage(60), "p", {}, async () => {});
      assert.equal(second.ok, false); // 120 > 100 — call #2 refuses on the RUN total
      if (!second.ok) assert.equal(second.code, "RT_E_BUDGET_EXHAUSTED");
    } finally {
      if (prev === undefined) delete process.env.RAPIDTOOL_TOKEN_CAP;
      else process.env.RAPIDTOOL_TOKEN_CAP = prev;
      resetSessionBudget();
    }
  });
});

// --- 216f (W2 · R3) — synthesis honesty: T-09 prose-in-code, T-15 determinism, T-10 contract ----

/**
 * 216f T-09 regression fixture: VERBATIM prose lines from the REAL leaked blob
 * (`research/eval-out/coffeehouse2home-property-ledger/src/generated/chunk-0.ts`
 * lines 342, 344 and 362) — LLM deliberation that shipped inside a module body.
 * Line 342 is the W1 residual evader (the `/` in "flip/rental/field ops");
 * line 350 (the model's own statement of the T-10 contradiction) is the same
 * shape. The full 11-line region is re-checked against the real file by the
 * lane's on-disk probe (11/11 hits).
 */
const LEAKED_BLOB_PROSE = [
  "Given the constraints, I must interpret: The type signatures are the only exported functions; the other requirements (5,6,7, etc.) are implemented through internal mechanisms or through the existing functions when applicable. For example, creating a lead or dealing with a property might trigger flip/rental/field ops logic. But without external APIs to manage those domains, it's impossible.",
  "Maybe the generator expects that the module can include non-exported functions and the exported functions can call them. But the user cannot interact with them directly. The requirements say \"Provide a flip manager...\" Could be that the flip manager is just data structures and functions internal, but not exported? The brief says \"implement\" but not necessarily export. Yet the instructions say \"Export EXACTLY the functions the spec's typeSignatures name; nothing more, nothing less.\" So we cannot export additional functions. But we can have internal functions. The requirements might be satisfied if the internal functions exist and are somehow triggered through the exported ones. For example, when we create a lead with a property, we might also create a flip acquisition if the property is a flip? That seems forced.",
  "I'll write the code now.",
].join("\n");

/** The exact scaffold-authored line that trips the prose detector in the real
 *  emitted tree (`research/eval-out/<app>/src/main.tsx:11`) — OUT OF SCOPE by
 *  construction: only LLM chunk envelopes reach the chunk gate (the import ban
 *  fires first regardless — pinned below). */
const SCAFFOLD_UI_IMPORT_LINE = 'import Console from "./ui/console";';

/** Verbatim shape of the real scaffold-authored UI entry (main.tsx head). */
const SCAFFOLD_UI_FIXTURE = [
  "// ---------------------------------------------------------------------------",
  "// src/main.tsx — Browser entry — mounts the UI shell (P8 interface contract)",
  "// machine-generated from RapidTool packet aa185020-cfff-49ac-9224-25b108274a17; regenerate, don't hand-edit.",
  "// The mounted surface is the contract-level Console shell from src/ui; wiring",
  "// it to the store/job modules is the build work ahead (see README honest",
  "// boundaries).",
  "// ---------------------------------------------------------------------------",
  "",
  'import { createRoot } from "react-dom/client";',
  "",
  SCAFFOLD_UI_IMPORT_LINE,
  "",
  'const rootEl = document.getElementById("root");',
  'if (!rootEl) throw new Error("missing #root element — index.html did not load");',
  "createRoot(rootEl).render(<Console />);",
].join("\n");

/** LEGAL-code control (must NEVER be refused by the T-09/T-15 gates): the
 *  brief-faithful kanban module plus division-shaped lines, a prose-shaped
 *  string, a comment that merely MENTIONS Math.random (masked — data). */
const LEGAL_DETERMINISTIC_CONTROL = [
  KANBAN_MODULE,
  "",
  "// flip/rental/field ops — documented in a comment, never code.",
  "/**",
  " * req-3 note: deterministic math only — never Math.random().",
  " */",
  "function shareOf(name, groups) {",
  '  const label = "flip/rental/field ops";',
  "  return name.length / groups + label.length;",
  "}",
].join("\n");

/** Legal single lines that must stay invisible to the T-09 detector: division
 *  slashes, semicolons, strings/comments carrying prose or a slash, calls. */
const LEGAL_PROSE_LOOKALIKES = [
  "const total = count / pages;",
  "return total / pages;",
  "const ratio = count / total / groups;",
  "if (total > 0) { return count / total; }",
  "'use strict';",
  "module.exports.createBoard = createBoard;",
  'if (typeof name !== "string" || name === "") { throw new Error("name required"); }',
  'const URL_PART = "a/b";',
  'return "flip/rental/field ops";',
  "// flip/rental/field ops are documented here",
  "return firstName / lastName / department / section;",
  "assign(firstName / lastName / department / section);",
  "const pick = (row) => row.price / row.qty;",
  "return negative ? -cents : cents;",
  "return flag ? alpha : beta;",
  "balance: negative ? -cents : cents,",
  // W45/331-4: the two live false positives the repair loop refused
  // (parent-keyed-findings §3b-2) — member-expression arithmetic minus and a
  // ternary whose quoted arm masks away.
  "return a.index - b.index;",
  "const span = a.index - b.index;",
  "return items.length ? items : defaultItems;",
  "arvNote: arvAvailable ? undefined : 'ARV unavailable: no comparables',",
  "label: ready ? 'yes' : 'no',",
];

/** Records every synthesis prompt (one synthesis + its bounded repairs). */
function captureDeps(reply: string) {
  const prompts: string[] = [];
  const calls: string[] = [];
  const complete = async (prompt: string): Promise<LlmResult> => {
    calls.push("complete");
    prompts.push(prompt);
    return { ok: true, text: reply, model: "deepseek-v4-flash" };
  };
  return {
    calls,
    prompts,
    deps: {
      complete,
      expand: async (): Promise<ExpandBriefResult> => ({ ok: true, spec: KANBAN_SPEC }),
      verify: async (): Promise<VerifyOutcome> => {
        // Parent-fix (W2 boundary): the stub must RECORD itself like every other
        // capture harness in this suite — the legal-control e2e asserts
        // `calls.includes("verify")`, which could never pass otherwise.
        calls.push("verify");
        return {
          status: "passed",
          iterations: 1,
          evidence: "unused — the deterministic floor refuses before verify",
          finalSource: KANBAN_MODULE,
          cases: [],
        };
      },
    },
  };
}

describe("216f T-09/T-15 detectors (proseLineHits / nondeterministicPrimitiveHit)", () => {
  it("T-09: flags EVERY prose line of the real leaked blob excerpt, incl. the W1 residual evader", () => {
    const hits = proseLineHits(LEAKED_BLOB_PROSE);
    assert.deepEqual(
      hits.map((h) => h.line),
      [1, 2, 3],
      "all three verbatim blob lines are prose-in-code",
    );
    // Parent-fix: `text` is a bounded EXCERPT (PROSE_EXCERPT_MAX), so the assertion
    // must check the HIT LINE, not a substring of the excerpt.
    const slashLine =
      LEAKED_BLOB_PROSE.split("\n").findIndex((l) => l.includes("flip/rental/field ops")) + 1;
    assert.ok(
      hits.some((h) => h.line === slashLine),
      "the chunk-0.ts:342 slash-prose line is caught (W1's 1-line residual gap closed)",
    );
  });

  it("T-09 control: legal code and prose-shaped strings/comments stay invisible", () => {
    for (const src of LEGAL_PROSE_LOOKALIKES) {
      assert.deepEqual(proseLineHits(src), [], `unexpected prose hit on legal line: ${src}`);
    }
    assert.deepEqual(
      proseLineHits(LEGAL_DETERMINISTIC_CONTROL),
      [],
      "the legal-code control module carries zero prose hits",
    );
  });

  it("T-09 322 X3 (BUG-4): ternaries are code — prose question/colon shapes stay flagged", () => {
    // The exact line the shipped heuristic refused (EXP03 cycle-3 log bytes).
    assert.deepEqual(proseLineHits("return negative ? -cents : cents;"), []);
    assert.deepEqual(proseLineHits("return items.length ? items : defaultItems;"), []);
    // The exclusion must not widen to prose: sentence-terminal question/colon
    // lines carry the same punctuation and MUST stay prose hits.
    assert.equal(proseLineHits("Should we ship it? Yes: ship.").length, 1);
    assert.equal(proseLineHits("Was it good? Yes: great.").length, 1);
  });

  it("W45/331-4: member-operand arithmetic minus and masked-literal ternary arms are code, never prose", () => {
    // The two real repair-loop false positives (parent-keyed-findings §3b-2):
    // repair's own patched output for invoice.ts / list-line-items.ts was refused
    // as "prose-in-code", one reason the bounded repair loop could not converge.
    assert.deepEqual(proseLineHits("return a.index - b.index;"), []);
    assert.deepEqual(proseLineHits("arvNote: arvAvailable ? undefined : 'ARV unavailable: no comparables',"), []);
    // Documented exclusions that already worked stay working.
    assert.deepEqual(proseLineHits("balance: amountDue - amountPaid"), []);
    assert.deepEqual(proseLineHits("return negative ? -cents : cents;"), []);
    assert.deepEqual(proseLineHits("const total = subtotal - discounts;"), []);
    // Controls: real deliberation prose is still caught (the class fix must not disarm the gate).
    assert.equal(proseLineHits("I will write the code now and make sure it works.").length, 1);
    assert.equal(proseLineHits("We should really just simplify the whole flow here.").length, 1);
    assert.equal(proseLineHits("Should we ship it? Yes: ship.").length, 1);
  });

  it("T-15: flags Math.random in CODE; a literal/comment mention is data (masked contract)", () => {
    assert.equal(
      nondeterministicPrimitiveHit(maskLiteralsAndComments('function f() { return "x" + Math.random(); }')),
      "Math.random",
    );
    assert.equal(
      nondeterministicPrimitiveHit(
        maskLiteralsAndComments('// never call Math.random()\nfunction f() { return "Math.random"; }'),
      ),
      null,
      "comment + string mentions are masked away — data, never a violation",
    );
    assert.equal(nondeterministicPrimitiveHit(""), null);
    assert.equal(nondeterministicPrimitiveHit(undefined as unknown as string), null);
  });
});

describe("216f validateSynthesisModule gates (T-09 prose, T-15 Math.random)", () => {
  it("T-09: the leaked-blob module is refused (RT_E_VALIDATION) naming the prose lines", () => {
    const v = validateSynthesisModule(
      `${LEGAL_DETERMINISTIC_CONTROL}\n${LEAKED_BLOB_PROSE}`,
      ["createBoard", "addColumn"],
      ["createBoard", "addColumn"],
    );
    assert.ok(!v.ok);
    if (!v.ok) {
      assert.equal(v.code, "RT_E_VALIDATION");
      assert.match(v.error, /prose-in-code in generated module \(3 prose lines/);
      assert.match(v.error, /first at line \d+/);
    }
  });

  it("T-15: a Math.random() module is refused (RT_E_VALIDATION); the legal control is NOT refused", () => {
    const broken = KANBAN_MODULE.replace(
      'return { id: "b-" + name, name: name, columns: [] };',
      'return { id: "b-" + Math.random(), name: name, columns: [] };',
    );
    assert.notEqual(broken, KANBAN_MODULE, "teeth: the fixture really swaps in Math.random()");
    const v = validateSynthesisModule(broken, KANBAN_ENVELOPE.exports, ["createBoard", "addColumn"]);
    assert.ok(!v.ok);
    if (!v.ok) {
      assert.equal(v.code, "RT_E_VALIDATION");
      assert.match(v.error, /non-deterministic primitive.*Math\.random/);
    }
    const ok = validateSynthesisModule(
      LEGAL_DETERMINISTIC_CONTROL,
      ["createBoard", "addColumn"],
      ["createBoard", "addColumn"],
    );
    assert.ok(ok.ok, "the legal-code control must NOT be refused by the new gates");
  });

  it("chunk-gate scope: scaffold-authored UI content is refused for the IMPORT, never for prose", () => {
    // Layering: the zero-import contract is consulted BEFORE the prose rule, so
    // the documented main.tsx:11 false-positive shape can never be the
    // operative refusal for scaffold-shaped content. Scaffold-authored files
    // never reach this validator anyway — its only callers are the two LLM
    // synthesis drivers (+ their repair re-checks), pinned by the e2e tests.
    const v = validateSynthesisModule(SCAFFOLD_UI_FIXTURE, [], []);
    assert.ok(!v.ok);
    if (!v.ok) {
      assert.match(v.error, /forbidden primitive in generated module code \(import\)/);
      assert.ok(!v.error.includes("prose-in-code"), "prose is never the operative refusal here");
    }
    const hits = proseLineHits(SCAFFOLD_UI_FIXTURE);
    assert.deepEqual(hits.map((h) => h.line), [11], "only the import line trips the prose shape");
    assert.equal(hits[0]!.text, SCAFFOLD_UI_IMPORT_LINE.slice(0, 80));
    const bodyOnly = SCAFFOLD_UI_FIXTURE.split("\n")
      .filter((l) => !l.startsWith("import "))
      .join("\n");
    assert.deepEqual(proseLineHits(bodyOnly), [], "the scaffold UI body itself is not prose-shaped");
  });
});

describe("W45/331-4 (Finding B) cross-chunk duplicate declarations", () => {
  const PRIOR = [{ path: "src/generated/list-line-items.ts", exports: ["estimateARV"] }];

  it("validateSynthesisModule refuses a top-level redeclaration of an earlier chunk's export", () => {
    const mod = [
      "async function estimateARV(propertyId) { return { propertyId }; }",
      "module.exports.estimateARV = estimateARV;",
    ].join("\n");
    const refused = validateSynthesisModule(mod, ["estimateARV"], ["estimateARV"], PRIOR);
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, "RT_E_VALIDATION");
      assert.match(refused.error, /cross-chunk duplicate declaration/);
      assert.match(refused.error, /"estimateARV" \(declared at line 1; already exported by src\/generated\/list-line-items\.ts\)/);
      assert.match(refused.error, /SyntaxError: Identifier 'estimateARV' has already been declared/);
    }
    // No prior chunks (the single-module path) is unchanged: still accepted.
    assert.deepEqual(validateSynthesisModule(mod, ["estimateARV"], ["estimateARV"]), {
      ok: true,
      exports: ["estimateARV"],
    });
    // A prior export the module does NOT redeclare is fine.
    assert.equal(
      validateSynthesisModule(mod, ["estimateARV"], ["estimateARV"], [{ path: "x.ts", exports: ["other"] }]).ok,
      true,
    );
  });

  it("localBindingLines reports the DECLARATION line; comments/strings never report", () => {
    const lines = localBindingLines(
      [
        "// function ghost()",
        'const s = "function other()";',
        "function real() { return 1; }",
        "const also = 2;",
        "const { picked } = input;",
      ].join("\n"),
    );
    assert.deepEqual(lines.get("real"), [3]);
    assert.deepEqual(lines.get("also"), [4]);
    assert.deepEqual(lines.get("picked"), [5]);
    assert.equal(lines.has("ghost"), false, "a commented declaration never reports");
    assert.equal(lines.has("other"), false, "a string-literal declaration never reports");
  });

  it("crossChunkDuplicateDeclarations is deterministic and names every conflict", () => {
    const mod = ["function a() {}", "function b() {}", "module.exports.a = a;", "module.exports.b = b;"].join("\n");
    assert.deepEqual(
      crossChunkDuplicateDeclarations(mod, [
        { path: "src/generated/x.ts", exports: ["b"] },
        { path: "src/generated/y.ts", exports: ["a"] },
      ]),
      [
        { name: "b", line: 2, priorPath: "src/generated/x.ts" },
        { name: "a", line: 1, priorPath: "src/generated/y.ts" },
      ],
    );
    assert.deepEqual(crossChunkDuplicateDeclarations(mod, []), []);
    assert.deepEqual(crossChunkDuplicateDeclarations(mod, null), []);
  });

  it("the duplicate repair prompt names the identifier, line and exporting sibling", () => {
    const p = p6SynthesisDuplicateDeclRepairPrompt([
      { name: "estimateARV", line: 546, priorPath: "src/generated/list-line-items.ts" },
    ]);
    assert.match(p, /"estimateARV" — declared at line 546; already exported by src\/generated\/list-line-items\.ts/);
    assert.match(p, /SyntaxError/);
    assert.match(p, /zero imports/);
  });
});

describe("216f e2e refusals through liveP6Synthesis (T-09 / T-15)", () => {
  it("T-09 e2e: a synthesis emitting the leaked blob is REFUSED after ONE prose repair (floor stands)", async () => {
    const base = p6Base();
    const envelope = {
      module: `${KANBAN_MODULE}\n${LEAKED_BLOB_PROSE}`,
      exports: KANBAN_ENVELOPE.exports,
      reqTrace: KANBAN_ENVELOPE.reqTrace,
    };
    const { calls, prompts, deps } = captureDeps(JSON.stringify(envelope));
    const q = await liveP6Synthesis(base, deps);
    assert.deepEqual(calls, ["complete", "complete"], "one synthesis + ONE bounded prose repair re-prompt");
    assert.ok(
      prompts[1]!.includes("English prose sentences written into the module body"),
      "the repair re-prompt carries the PROSE defect class (not the generic repair)",
    );
    assert.equal(q.generatedSource, base.generatedSource, "the deterministic floor stands — never a fabricated pass");
    const refusal = q.logs.find((l) => l.event === "p6.synthesis.refused");
    assert.ok(refusal, "p6.synthesis.refused logged");
    assert.match(refusal.detail, /RT_E_VALIDATION/);
    assert.match(refusal.detail, /prose-in-code/);
    assert.ok(!q.logs.some((l) => l.event === "p6.synthesis"), "no success event minted");
  });

  it("T-15 e2e: a synthesis using Math.random() is REFUSED after ONE determinism repair", async () => {
    const base = p6Base();
    const broken = KANBAN_MODULE.replace(
      'return { id: "b-" + name, name: name, columns: [] };',
      'return { id: "b-" + Math.random(), name: name, columns: [] };',
    );
    const envelope = {
      module: broken,
      exports: KANBAN_ENVELOPE.exports,
      reqTrace: KANBAN_ENVELOPE.reqTrace,
    };
    const { calls, prompts, deps } = captureDeps(JSON.stringify(envelope));
    const q = await liveP6Synthesis(base, deps);
    assert.deepEqual(calls, ["complete", "complete"]);
    assert.ok(
      prompts[1]!.includes("non-deterministic primitive"),
      "the determinism repair class dispatched (not the generic repair)",
    );
    assert.equal(q.generatedSource, base.generatedSource);
    const refusal = q.logs.find((l) => l.event === "p6.synthesis.refused");
    assert.ok(refusal);
    assert.match(refusal.detail, /RT_E_VALIDATION/);
    assert.match(refusal.detail, /Math\.random/);
  });

  it("legal-code control e2e: the deterministic control is NOT refused and reaches the machine verify", async () => {
    const base = p6Base();
    const envelope = {
      module: LEGAL_DETERMINISTIC_CONTROL,
      exports: ["createBoard", "addColumn"],
      reqTrace: { "req-1": "createBoard", "req-2": "addColumn" },
    };
    const { calls, deps } = captureDeps(JSON.stringify(envelope));
    const q = await liveP6Synthesis(base, deps);
    assert.ok(calls.includes("verify"), "the legal module reached the machine verify step");
    assert.ok(!q.logs.some((l) => l.event === "p6.synthesis.refused"), "no refusal for legal, deterministic code");
  });

  it("chunk-gate scope: an LLM CHUNK module with prose is refused inside the chunked driver (chunk 1/3, honest partial)", async () => {
    const base = p6Base(LEDGER_BRIEF);
    const spec = ledgerSpec(20);
    const groups = chunkTypeSignatures(spec.typeSignatures);
    const chunkNames = groups.map((g) => signatureFunctionNames(g));
    const prompts: string[] = [];
    const calls: string[] = [];
    const proseChunk = (names: readonly string[]) =>
      [
        "const ledgerKit = { property: 1, ledger: 1, rent: 1, collection: 1, tenant: 1, records: 1, lease: 1, renewal: 1, reminders: 1, payment: 1, tracking: 1 };",
        LEAKED_BLOB_PROSE,
        ...names.map((n) => `function ${n}(input) { return input; }`),
        ...names.map((n) => `module.exports.${n} = ${n};`),
      ].join("\n");
    const complete = async (prompt: string): Promise<LlmResult> => {
      calls.push("complete");
      prompts.push(prompt);
      const isSynth = prompt.includes("TYPE SIGNATURES (must export");
      const idx = isSynth ? prompts.filter((p) => p.includes("TYPE SIGNATURES (must export")).length - 1 : 0;
      const names = chunkNames[idx] ?? [];
      // The model stays stubborn through the bounded prose repair: prose again.
      return {
        ok: true,
        text: JSON.stringify({ module: proseChunk(names), exports: [...names], reqTrace: {} }),
        model: "deepseek-v4-flash",
      };
    };
    const q = await liveP6Synthesis(base, {
      complete,
      expand: async () => ({ ok: true as const, spec }),
      verify: async () => ({ status: "passed" as const, iterations: 0, evidence: "unused", cases: [] }),
    });
    assert.equal(q.generatedSource, base.generatedSource, "chunk 0 refused → nothing real exists → floor stands");
    const refusal = q.logs.find((l) => l.event === "p6.synthesis.refused");
    assert.ok(refusal, "chunk refusal logged");
    assert.match(refusal.detail, /chunk 1\/3 refused/);
    assert.match(refusal.detail, /prose-in-code/);
    assert.ok(
      prompts.some((p) => p.includes("English prose sentences written into the module body")),
      "the PROSE repair class dispatched inside the chunked path (this is the LLM-chunk gate)",
    );
    assert.equal(
      prompts.filter((p) => p.includes("TYPE SIGNATURES (must export")).length,
      1,
      "only chunk 0 ever synthesized (the refusal stopped the walk)",
    );
  });
});

describe("216f T-10 — prompt contract: signature ceiling vs requirement duty", () => {
  it("system prompt: the export ceiling is scoped per file, hidden logic is forbidden (no unsatisfiable pair)", () => {
    const s = p6SynthesisSystemPrompt();
    assert.ok(
      !s.includes("1. Export EXACTLY the functions the spec's typeSignatures name; nothing more, nothing less."),
      "old unscoped rule 1 replaced",
    );
    assert.ok(s.includes("nothing more, nothing less"), "the export ceiling is retained");
    assert.ok(s.includes("each file exports ONLY its own listed signatures"), "ceiling scoped per file");
    assert.ok(
      s.includes("never hide a requirement's logic behind non-exported helpers"),
      "hidden logic explicitly forbidden (the leak's failed workaround)",
    );
  });

  it("chunk prompt: requirements are project-wide; implementation duty is scoped to THIS file's signatures", () => {
    const spec = ledgerSpec(16);
    const chunk = p6SynthesisChunkUserPrompt(LEDGER_BRIEF, spec, spec.typeSignatures.slice(0, 8), [
      { path: "src/generated.ts", exports: ["collectRent0", "collectRent1"], reqTrace: { "req-1": "collectRent0" } },
    ]);
    assert.ok(chunk.includes("TYPE SIGNATURES (must export"), "synthesis-prompt marker preserved for the test-internal detector");
    assert.ok(chunk.includes("implemented across ALL of its files"), "requirements marked project-wide");
    assert.ok(
      chunk.includes("this file implements every one its TYPE SIGNATURES below cover"),
      "implementation duty scoped to this file's signatures",
    );
    assert.ok(chunk.includes("never hide its logic behind non-exported helpers here"), "hidden logic forbidden in-file");
    assert.ok(
      chunk.includes("nothing more, nothing less; THIS file's share of the project"),
      "signature list scoped to this file (other files export the rest)",
    );
  });

  it("satisfiability: a 10-capability brief chunked to N files demands only each file's own signatures", () => {
    // The exact scenario the model called impossible at chunk-0.ts:350 — 10
    // capabilities, 5 files — now demands (a) every requirement implemented
    // SOMEWHERE, (b) this file's signatures only, (c) no hidden logic.
    const spec = {
      requirements: Array.from({ length: 10 }, (_, i) => `Capability ${i + 1} must be provided.`),
      edgeCases: [],
      errorHandling: [],
      typeSignatures: ledgerSignatures(10),
      dataFlow: [],
      negativeConstraints: [],
    };
    const chunk2Sigs = chunkTypeSignatures(spec.typeSignatures)[1]!;
    const prior: ChunkPriorFile[] = [
      {
        path: "src/generated.ts",
        exports: signatureFunctionNames(chunkTypeSignatures(spec.typeSignatures)[0]!),
        reqTrace: {},
      },
    ];
    const chunk2 = p6SynthesisChunkUserPrompt(LEDGER_BRIEF, spec, chunk2Sigs, prior);
    for (let i = 1; i <= 10; i++) {
      assert.ok(chunk2.includes(`${i}. Capability ${i} must be provided.`), `requirement ${i} visible in the chunk prompt`);
    }
    const sigBlock = chunk2.slice(chunk2.indexOf("TYPE SIGNATURES"), chunk2.indexOf("NEGATIVE CONSTRAINTS"));
    const listed = sigBlock.split("\n").filter((l) => l.startsWith("- export function"));
    assert.deepEqual(
      listed.map((l) => l.slice(2)),
      chunk2Sigs,
      "only THIS chunk's signatures are demanded from this file",
    );
    assert.ok(!sigBlock.includes("collectRent0("), "another file's signatures are never demanded from this file");
    assert.ok(
      chunk2.includes("implemented across ALL of its files") && chunk2.includes("implemented THERE"),
      "the other capabilities are owned by the other files — satisfiable without exceeding the ceiling",
    );
  });

  it("T-09/T-15 refusals are advertised in the system prompt (215b drift-proof principle)", () => {
    const s = p6SynthesisSystemPrompt();
    assert.ok(s.includes("Never use Math.random()"), "Math.random ban advertised to the model");
    assert.ok(s.includes("non-deterministic primitive"), "determinism wording present");
    assert.ok(s.includes("Write CODE only"), "prose-in-code refusal advertised");
    assert.ok(s.includes("I'll write the code now"), "the exact failure mode is named");
    assert.ok(
      nondeterministicPrimitiveHit(maskLiteralsAndComments("const id = Math.random();")) !== null,
      "the advertised token is the one the validator matches",
    );
  });
});

// --- 216r T-107.1 (W8-L5): the patch (str_replace) repair level ----------------
// The W7-L1 wiring (codegen.server.ts patch-repair section; liveP6Synthesis
// deps.patchRepairs) gets the tests it shipped without. Three contracts:
//   (a) a unique-match delta applies via applyStrReplace + revalidates;
//   (b) ambiguous / no-match / no-op deltas REFUSE coded, and the legacy
//       full-rewrite repair that follows stays byte-identical;
//   (c) with no patch in play (level off, or a non-patchable defect class)
//       every existing prompt/module byte is unchanged.

/** 216r fixture: KANBAN_MODULE + the 216f leaked prose blob. The PROSE defect
 *  class carries raw line numbers end-to-end, so this fixture exercises the
 *  wired patch level (the token classes need a comment-free module — see the
 *  JSDoc'd-shape defect recorded in fixes/216r §3). */
const PROSE_REFUSED_ENVELOPE = {
  module: `${KANBAN_MODULE}\n${LEAKED_BLOB_PROSE}`,
  exports: KANBAN_ENVELOPE.exports,
  reqTrace: KANBAN_ENVELOPE.reqTrace,
};

/** 216r fixture: comment-free kanban module carrying Math.random() — raw and
 *  masked line numbers align only when no block comment precedes the defect. */
const NOCOMMENT_NONDET_MODULE = [
  "function createBoard(name) {",
  '  return { id: "b-" + Math.random(), name: name, columns: [] };',
  "}",
  "function addColumn(board, columns) { board.columns = columns || []; return board; }",
  "function dragCard(cards) { return cards; }",
  "function kanbanBoard(columns) { return { columns: columns }; }",
  "module.exports.createBoard = createBoard;",
  "module.exports.addColumn = addColumn;",
  "module.exports.dragCard = dragCard;",
  "module.exports.kanbanBoard = kanbanBoard;",
].join("\n");

/** Classifies one recorded synthesis call by the prompt family it belongs to. */
function patchCallKind(prompt: string): string {
  if (prompt.includes("TYPE SIGNATURES (must export")) return "synthesis";
  if (prompt.includes("ONE bounded replacement instead of rewriting the module")) return "patch";
  if (prompt.includes("Your previous reply was not code: it contained English prose sentences")) return "legacy-prose";
  if (prompt.includes("Your module used a non-deterministic primitive:")) return "legacy-nondeterministic";
  if (prompt.includes("Your module used a forbidden primitive:")) return "legacy-forbidden";
  if (prompt.includes("claimed exports that are not actually bound")) return "legacy-export-binding";
  if (prompt.includes("missing functions the brief's typeSignatures require")) return "legacy-missing-signature";
  if (prompt.includes("Your previous reply was not valid JSON with the required envelope")) return "envelope-repair";
  return "other";
}

/** 216r harness: prompt-recording fake `complete` (replies[n-1] answers call n;
 *  the last one repeats) + a `verify` seam that ECHOES the source it received,
 *  so the ACCEPTED module stays observable byte-for-byte. `patchRepairs`
 *  mirrors the liveP6Synthesis opt-in. */
function patchHarness(
  replies: ((prompt: string, n: number) => LlmResult)[],
  opts: { patchRepairs?: boolean } = {},
): { prompts: string[]; kinds: string[]; deps: P6SynthesisDeps } {
  const prompts: string[] = [];
  const kinds: string[] = [];
  const complete = async (prompt: string): Promise<LlmResult> => {
    kinds.push(patchCallKind(prompt));
    prompts.push(prompt);
    return replies[Math.min(prompts.length - 1, replies.length - 1)]!(prompt, prompts.length);
  };
  const deps: P6SynthesisDeps = {
    complete,
    expand: async (): Promise<ExpandBriefResult> => ({ ok: true, spec: KANBAN_SPEC }),
    verify: async (source: string): Promise<VerifyOutcome> => ({
      status: "passed",
      iterations: 1,
      evidence: "w8-l5 harness echo verify",
      finalSource: source,
      cases: [],
    }),
  };
  if (opts.patchRepairs) deps.patchRepairs = true;
  return { prompts, kinds, deps };
}

/** A model delta reply — the patch envelope's FIRST FORM. */
function patchReply(oldStr: string, newStr: string): string {
  return JSON.stringify({ patch: { oldStr, newStr } });
}

describe("216r patch primitives (W8-L5 pins)", () => {
  it("parseSynthesisPatchEnvelope: parses the delta form (fences, empty newStr deletion, fuzzy passthrough)", () => {
    const e = parseSynthesisPatchEnvelope(JSON.stringify({ patch: { oldStr: "a", newStr: "b" } }));
    assert.deepEqual(e, { oldStr: "a", newStr: "b" });
    const fenced = parseSynthesisPatchEnvelope(
      "```json\n" + JSON.stringify({ patch: { oldStr: "a", newStr: "" } }) + "\n```",
    );
    assert.deepEqual(fenced, { oldStr: "a", newStr: "" }, "empty newStr is a legal DELETE, never null");
    const fuzzy = parseSynthesisPatchEnvelope(
      JSON.stringify({ patch: { oldStr: "a", newStr: "b", fuzzy: { threshold: 0.2 } } }),
    );
    assert.deepEqual(fuzzy, { oldStr: "a", newStr: "b", fuzzy: { threshold: 0.2 } }, "fuzzy rides through verbatim");
  });

  it("parseSynthesisPatchEnvelope: every non-delta reply is null — the legacy path stays available", () => {
    assert.equal(parseSynthesisPatchEnvelope("not json {{{"), null);
    assert.equal(parseSynthesisPatchEnvelope(42), null);
    assert.equal(parseSynthesisPatchEnvelope(JSON.stringify({ module: "x", exports: [] })), null, "legacy module envelope is NOT a delta");
    assert.equal(parseSynthesisPatchEnvelope(JSON.stringify({ patch: { oldStr: "", newStr: "x" } })), null, "empty needle");
    assert.equal(parseSynthesisPatchEnvelope(JSON.stringify({ patch: { oldStr: "x" } })), null, "missing newStr");
    assert.equal(parseSynthesisPatchEnvelope(JSON.stringify({ patch: { oldStr: "x", newStr: 7 } })), null, "non-string newStr");
    assert.equal(parseSynthesisPatchEnvelope("[]"), null);
  });

  it("patchExcerptWindows / tokenLineNumbers: verbatim whole lines, merging, caps, total on garbage", () => {
    const src = ["alpha", "beta", "gamma", "delta", "epsilon"].join("\n");
    assert.deepEqual(tokenLineNumbers(src, "gamma"), [3]);
    assert.deepEqual(tokenLineNumbers(src, "zzz"), []);
    assert.deepEqual(tokenLineNumbers(src, ""), [], "empty needle is total");
    const w = patchExcerptWindows(src, [3]);
    assert.deepEqual(w, { windows: [{ firstLine: 2, lastLine: 4, text: "beta\ngamma\ndelta" }], omittedLines: 0 });
    const merged = patchExcerptWindows(src, [2, 4]);
    assert.equal(merged.windows.length, 1, "adjacent windows merge");
    assert.equal(merged.windows[0]!.text, src, "the merged window is the source's own lines, verbatim");
    const many = Array.from({ length: 60 }, (_, i) => `line-${i + 1}`).join("\n");
    const capped = patchExcerptWindows(many, [5, 15, 25, 35, 45]);
    assert.equal(capped.windows.length, PATCH_REPAIR_MAX_WINDOWS, "window count capped");
    assert.equal(capped.omittedLines, 2, "omitted windows are counted honestly");
    assert.equal(capped.windows[0]!.firstLine, 4);
    assert.ok(
      capped.windows.every((win) => win.lastLine - win.firstLine + 1 <= PATCH_REPAIR_WINDOW_MAX_LINES),
      "line cap respected",
    );
    assert.deepEqual(patchExcerptWindows(42, [1]), { windows: [], omittedLines: 0 }, "garbage source is total");
    assert.deepEqual(patchExcerptWindows(src, [0, 99, 1.5]), { windows: [], omittedLines: 0 }, "garbage lines never fabricate a window");
  });

  it("p6SynthesisPatchRepairPrompt: names the defect, quotes verbatim windows, offers BOTH reply forms, carries the tree-failure tail", () => {
    const windows = [
      { firstLine: 3, lastLine: 4, text: "beta\ngamma" },
      { firstLine: 9, lastLine: 9, text: "epsilon" },
    ];
    const p = p6SynthesisPatchRepairPrompt("the module uses a forbidden primitive: `fetch`", windows);
    assert.ok(
      p.startsWith("Your previous module was refused by the deterministic validator: the module uses a forbidden primitive: `fetch`."),
    );
    assert.ok(p.includes("--- lines 3-4 (line numbers are for orientation only — they are NOT part of the text) ---\nbeta\ngamma\n--- end lines 3-4 ---"));
    assert.ok(p.includes("--- lines 9-9 (line numbers are for orientation only — they are NOT part of the text) ---\nepsilon\n--- end lines 9-9 ---"));
    assert.ok(p.includes('FIRST FORM (preferred): {"patch":{"oldStr"'), "delta offered first");
    assert.ok(p.includes('SECOND FORM, only if one unique replacement cannot fix the defect: {"module"'), "full-rewrite envelope is the alternative");
    assert.ok(!p.includes("Tree-run failure context"), "no treeFailure → no context block (legacy bytes)");
    const withTree = p6SynthesisPatchRepairPrompt("d", windows, "src/jobs/rent.ts — tests fail: boom");
    assert.ok(withTree.endsWith("Tree-run failure context (failing file + first not-ok tail):\nsrc/jobs/rent.ts — tests fail: boom"));
  });

  it("325 A3: the FIRST FORM example is itself valid JSON (no trailing comma)", () => {
    // Pre-fix the example ended `…"},}.` — a model copying the preferred form
    // byte-for-byte produced a reply JSON.parse refuses, so the delta was
    // refused on a technicality and the legacy full-rewrite repair burned an
    // extra call. The prompt's own example must parse.
    const p = p6SynthesisPatchRepairPrompt("the module uses a forbidden primitive: `fetch`", []);
    const prefix = "Return JSON ONLY, FIRST FORM (preferred): ";
    const line = p.split("\n").find((l) => l.startsWith(prefix)) ?? "";
    assert.notEqual(line, "", "the FIRST FORM line is present");
    const example = line.slice(prefix.length).replace(/\.$/, "");
    const parsed = JSON.parse(example) as { patch?: { oldStr?: unknown; newStr?: unknown } };
    assert.equal(typeof parsed.patch?.oldStr, "string", "the example's oldStr is a string");
    assert.equal(typeof parsed.patch?.newStr, "string", "the example's newStr is a string");
    assert.equal(p.includes('"},}'), false, "the pre-fix trailing-comma shape is gone");
    // TEETH: the pre-fix example bytes do not parse.
    assert.throws(
      () => JSON.parse('{"patch":{"oldStr":"x","newStr":"y"},}'),
      SyntaxError,
      "the pre-fix trailing-comma example must be rejected",
    );
  });
});

describe("216r patch repair through liveP6Synthesis (W8-L5 pins)", () => {
  it("(a) a unique-match delta applies via applyStrReplace, revalidates, and the patch re-prompt is offered FIRST", async () => {
    const base = p6Base();
    const h = patchHarness(
      [
        // 1 synthesis (prose defect), 2 the patch delta (unique match, DELETE),
        // any later call gets non-JSON so nothing overwrites the landed delta.
        () => ({ ok: true, text: JSON.stringify(PROSE_REFUSED_ENVELOPE), model: "deepseek-v4-flash" }),
        () => ({ ok: true, text: patchReply(LEAKED_BLOB_PROSE, ""), model: "deepseek-v4-flash" }),
        () => ({ ok: true, text: "no json — the model never answers a follow-up", model: "deepseek-v4-flash" }),
      ],
      { patchRepairs: true },
    );
    const q = await liveP6Synthesis(base, h.deps);

    assert.equal(h.kinds[0], "synthesis");
    assert.equal(h.kinds[1], "patch", "patch-first: the delta re-prompt is the FIRST repair call");
    assert.ok(
      h.prompts[1]!.includes(LEAKED_BLOB_PROSE),
      "the patch prompt quotes the exact current source (character-for-character copyable)",
    );
    assert.ok(h.prompts[1]!.includes("--- lines 38-41 "), "the quoted window carries its 1-based line markers");

    const deltas = (q.logs ?? []).filter((l) => l.event === "p6.repair.delta");
    assert.equal(deltas.length, 1, "exactly one landed-delta record");
    const rec = JSON.parse(deltas[0]!.detail) as {
      path: string;
      kind: string;
      score: number;
      threshold: number | null;
      matches: number;
      removedLines: number;
      addedLines: number;
      unified: string;
    };
    assert.equal(rec.path, TREE_ENTRY_PATH);
    assert.equal(rec.kind, "exact", "the wire requires an exact unique match — no fuzzy guessing");
    assert.equal(rec.score, 1);
    assert.equal(rec.threshold, null, "fuzzy was never opted in on this wire");
    assert.equal(rec.matches, 1);
    assert.equal(rec.removedLines, 3);
    assert.equal(rec.addedLines, 1);
    assert.ok(rec.unified.startsWith("@@ -39,3 +39,1 @@\n-Given the constraints"), "bounded unified hunk, start line named");
    assert.ok(rec.unified.includes("-Maybe the generator expects"));
    assert.ok(rec.unified.length <= PATCH_REPAIR_DIFF_MAX, "diff record is capped");

    // The delta's own output IS the accepted module (prose deleted byte-exactly)…
    // FM-01 (W37 Y1): the recorded artifact is its deterministic materialization —
    // assert on the chunk file, which carries those bytes.
    const chunkA = assertRecordedMaterialized(q, KANBAN_MODULE.trim());
    assert.ok(!chunkA.includes("I'll write the code now."), "the prose blob is GONE, not paraphrased");
    // …and the result revalidates under the SAME deterministic validator (the
    // acceptance path; a patched module that still failed would be refused).
    assert.ok(validateSynthesisModule(chunkA, KANBAN_ENVELOPE.exports, ["createBoard", "addColumn"]).ok);
    assert.equal((q.generatedTree ?? [])[1]?.source, chunkA, "the chunk file carries the patched bytes (FM-01)");
    assert.ok(!(q.logs ?? []).some((l) => l.event === "p6.synthesis.refused"), "no refusal — the patched module was accepted");
  });

  it("(a) the non-deterministic class lands its delta too (comment-free module: raw↔masked lines align)", async () => {
    const base = p6Base();
    const h = patchHarness(
      [
        () => ({ ok: true, text: JSON.stringify({ module: NOCOMMENT_NONDET_MODULE, exports: KANBAN_ENVELOPE.exports, reqTrace: KANBAN_ENVELOPE.reqTrace }), model: "deepseek-v4-flash" }),
        () => ({ ok: true, text: patchReply("Math.random()", "name"), model: "deepseek-v4-flash" }),
        () => ({ ok: true, text: "still no json", model: "deepseek-v4-flash" }),
      ],
      { patchRepairs: true },
    );
    const q = await liveP6Synthesis(base, h.deps);

    assert.equal(h.kinds[1], "patch");
    const rec = JSON.parse((q.logs ?? []).find((l) => l.event === "p6.repair.delta")!.detail) as {
      kind: string;
      matches: number;
      unified: string;
    };
    assert.equal(rec.kind, "exact");
    assert.equal(rec.matches, 1);
    assert.equal(rec.unified, "@@ -2,1 +2,1 @@\n-Math.random()\n+name", "single-line hunk, exact bytes");
    // FM-01 (W37 Y1): assert on the recorded chunk file (the materialized accepted module).
    const chunkB = assertRecordedMaterialized(q, NOCOMMENT_NONDET_MODULE.replace("Math.random()", "name").trim());
    assert.ok(!chunkB.includes("Math.random"), "the determinism defect is gone");
    assert.ok(validateSynthesisModule(chunkB, KANBAN_ENVELOPE.exports, ["createBoard", "addColumn"]).ok);
  });

  it("(b) an AMBIGUOUS delta refuses coded; the legacy full-rewrite repair follows byte-identical and still fixes", async () => {
    const base = p6Base();
    const h = patchHarness(
      [
        () => ({ ok: true, text: JSON.stringify(PROSE_REFUSED_ENVELOPE), model: "deepseek-v4-flash" }),
        // "module.exports." occurs 4× → the unique-match contract refuses.
        () => ({ ok: true, text: patchReply("module.exports.", "module.exportsX."), model: "deepseek-v4-flash" }),
        () => ({ ok: true, text: JSON.stringify(KANBAN_ENVELOPE), model: "deepseek-v4-flash" }),
      ],
      { patchRepairs: true },
    );
    const q = await liveP6Synthesis(base, h.deps);

    assert.deepEqual(h.kinds, ["synthesis", "patch", "legacy-prose"], "patch attempt first, then the legacy repair");
    const refusal = (q.logs ?? []).find((l) => l.event === "p6.repair.patch.refused");
    assert.ok(refusal, "the refusal is recorded");
    assert.equal(
      refusal!.detail,
      "src/generated.ts · RT_E_VALIDATION · oldStr matches 4 times — refusing; a unique match is required (candidate lines: 34, 35, 36, 37).",
    );
    assert.ok(!(q.logs ?? []).some((l) => l.event === "p6.repair.delta"), "a refused delta never stamps a delta record");
    // The legacy path is byte-identical — same prompt the builder produces.
    assert.equal(h.prompts[2], p6SynthesisProseRepairPrompt(proseLineHits(PROSE_REFUSED_ENVELOPE.module)));
    // …and it still lands: the legacy repair's reply is the accepted module.
    assertRecordedMaterialized(q, KANBAN_MODULE.trim()); // FM-01: recorded as the materialized ESM tree
    assert.ok(!(q.logs ?? []).some((l) => l.event === "p6.synthesis.refused"));
  });

  it("(b) a NO-MATCH delta refuses coded; the legacy repair bytes and outcome are unchanged", async () => {
    const base = p6Base();
    const h = patchHarness(
      [
        () => ({ ok: true, text: JSON.stringify(PROSE_REFUSED_ENVELOPE), model: "deepseek-v4-flash" }),
        () => ({ ok: true, text: patchReply("NOT PRESENT ANYWHERE()", "x"), model: "deepseek-v4-flash" }),
        () => ({ ok: true, text: JSON.stringify(KANBAN_ENVELOPE), model: "deepseek-v4-flash" }),
      ],
      { patchRepairs: true },
    );
    const q = await liveP6Synthesis(base, h.deps);

    assert.deepEqual(h.kinds, ["synthesis", "patch", "legacy-prose"]);
    const refusal = (q.logs ?? []).find((l) => l.event === "p6.repair.patch.refused");
    assert.ok(refusal);
    assert.equal(
      refusal!.detail,
      "src/generated.ts · RT_E_VALIDATION · no exact match for oldStr (0 occurrences) — refusing; a unique match is required.",
    );
    assert.equal(h.prompts[2], p6SynthesisProseRepairPrompt(proseLineHits(PROSE_REFUSED_ENVELOPE.module)));
    assertRecordedMaterialized(q, KANBAN_MODULE.trim()); // FM-01: recorded as the materialized ESM tree
  });

  it("(b) a NO-OP delta (oldStr === newStr) refuses coded; the legacy repair bytes and outcome are unchanged", async () => {
    const base = p6Base();
    const h = patchHarness(
      [
        () => ({ ok: true, text: JSON.stringify(PROSE_REFUSED_ENVELOPE), model: "deepseek-v4-flash" }),
        () => ({ ok: true, text: patchReply("I'll write the code now.", "I'll write the code now."), model: "deepseek-v4-flash" }),
        () => ({ ok: true, text: JSON.stringify(KANBAN_ENVELOPE), model: "deepseek-v4-flash" }),
      ],
      { patchRepairs: true },
    );
    const q = await liveP6Synthesis(base, h.deps);

    assert.deepEqual(h.kinds, ["synthesis", "patch", "legacy-prose"]);
    const refusal = (q.logs ?? []).find((l) => l.event === "p6.repair.patch.refused");
    assert.ok(refusal);
    assert.equal(
      refusal!.detail,
      "src/generated.ts · RT_E_VALIDATION · oldStr and newStr are identical — a no-op is not an edit; refusing to report one.",
    );
    assert.equal(h.prompts[2], p6SynthesisProseRepairPrompt(proseLineHits(PROSE_REFUSED_ENVELOPE.module)));
    assertRecordedMaterialized(q, KANBAN_MODULE.trim()); // FM-01: recorded as the materialized ESM tree
  });

  it("(c) with the patch level OFF, the T-15 repair prompt and the accepted module stay byte-identical", async () => {
    const base = p6Base();
    const broken = KANBAN_MODULE.replace(
      'return { id: "b-" + name, name: name, columns: [] };',
      'return { id: "b-" + Math.random(), name: name, columns: [] };',
    );
    const envelope = { module: broken, exports: KANBAN_ENVELOPE.exports, reqTrace: KANBAN_ENVELOPE.reqTrace };
    const h = patchHarness([
      () => ({ ok: true, text: JSON.stringify(envelope), model: "deepseek-v4-flash" }),
      () => ({ ok: true, text: JSON.stringify(KANBAN_ENVELOPE), model: "deepseek-v4-flash" }),
    ]); // no patchRepairs → the legacy level
    const q = await liveP6Synthesis(base, h.deps);

    assert.deepEqual(h.kinds, ["synthesis", "legacy-nondeterministic"], "no patch call when the level is off");
    assert.equal(h.prompts[1], p6SynthesisNondeterministicRepairPrompt("Math.random"), "legacy repair prompt byte-identical to its builder");
    assert.ok(!(q.logs ?? []).some((l) => l.event.startsWith("p6.repair")), "no patch records when the level is off");
    assertRecordedMaterialized(q, KANBAN_MODULE.trim()); // FM-01 re-point: legacy repair's accepted bytes, recorded materialized
  });

  it("(c) a non-patchable defect keeps the legacy prompt/module bytes with the level ON and OFF", async () => {
    const envelope = { ...KANBAN_ENVELOPE, exports: ["createBoard", "addColumn", "ghost"] };
    const run = async (patchRepairs: boolean) => {
      const h = patchHarness(
        [
          () => ({ ok: true, text: JSON.stringify(envelope), model: "deepseek-v4-flash" }),
          () => ({ ok: true, text: JSON.stringify(KANBAN_ENVELOPE), model: "deepseek-v4-flash" }),
        ],
        { patchRepairs },
      );
      const q = await liveP6Synthesis(p6Base(), h.deps);
      return { h, q };
    };
    const off = await run(false);
    const on = await run(true);

    for (const r of [off, on]) {
      assert.deepEqual(r.h.kinds, ["synthesis", "legacy-export-binding"], "an unbound-export defect never takes a patch call");
      assert.equal(r.h.prompts[1], p6SynthesisExportRepairPrompt(["ghost"]), "legacy repair prompt byte-identical to its builder");
      assert.ok(
        !(r.q.logs ?? []).some((l) => l.event === "p6.repair.delta" || l.event === "p6.repair.patch.refused"),
        "no patch records for a non-patchable defect",
      );
      assertRecordedMaterialized(r.q, KANBAN_MODULE.trim()); // FM-01 re-point: accepted bytes unchanged, recorded materialized
    }
    assert.equal(on.h.prompts[1], off.h.prompts[1], "the level ON changes no prompt byte when no patch is in play");
    assert.deepEqual(on.h.kinds, off.h.kinds, "call sequence unchanged when no patch is in play");
    assert.equal(on.q.generatedSource, off.q.generatedSource);
  });
});

// --- 216r patch-path defect fixes (W9-L2) ------------------------------------
// fixes/216r §2 recorded two real defects in the T-107.1 patch path; this block
// pins their fixes:
//   (d) the masked↔raw line map — a JSDoc'd module (the system prompt mandates
//       full JSDoc; block comments destroy the masked line numbering) ATTAINS
//       the patch level and its delta lands with RAW line numbers;
//   (e) a landed delta short-circuits the legacy full-rewrite block — a
//       PARSEABLE legacy-style reply can no longer overwrite the patched
//       envelope (the unparseable-reply crutch the W8-L5 (a) pins used is
//       gone).

/** W9-L2 fixture: the realistic JSDoc'd module — KANBAN_MODULE carries full
 *  block-comment JSDoc, and has Math.random() swapped into code. Raw 38 lines
 *  → masked 27: this is the exact shape whose masked line numbers used to
 *  empty the patch candidate list (W8-L5 defect 1). */
const JSDOC_NONDET_MODULE = KANBAN_MODULE.replace(
  'return { id: "b-" + name, name: name, columns: [] };',
  'return { id: "b-" + Math.random(), name: name, columns: [] };',
);

describe("216r patch-path defect fixes (W9-L2)", () => {
  it("(d) a JSDoc'd non-deterministic module ATTAINS the patch level — the delta lands with RAW line numbers", async () => {
    const base = p6Base();
    const h = patchHarness(
      [
        () => ({ ok: true, text: JSON.stringify({ module: JSDOC_NONDET_MODULE, exports: KANBAN_ENVELOPE.exports, reqTrace: KANBAN_ENVELOPE.reqTrace }), model: "deepseek-v4-flash" }),
        () => ({ ok: true, text: patchReply("Math.random()", "name"), model: "deepseek-v4-flash" }),
        // Unparseable follow-up (the W8-L5 style): this test isolates defect 1
        // — the parseable-overwrite case is (e)'s.
        () => ({ ok: true, text: "no json — the patch is the only repair this module gets", model: "deepseek-v4-flash" }),
      ],
      { patchRepairs: true },
    );
    const q = await liveP6Synthesis(base, h.deps);

    assert.equal(h.kinds[0], "synthesis");
    assert.equal(h.kinds[1], "patch", "patch-first: the JSDoc'd module attains the patch level (masked↔raw map)");
    assert.ok(
      h.prompts[1]!.includes(
        '--- lines 7-9 (line numbers are for orientation only — they are NOT part of the text) ---\n' +
          '  if (typeof name !== "string" || name === "") { throw new Error("name required"); }\n' +
          '  return { id: "b-" + Math.random(), name: name, columns: [] };\n}',
      ),
      "the excerpt window quotes the RAW lines 7-9 verbatim around the code occurrence",
    );

    const deltas = (q.logs ?? []).filter((l) => l.event === "p6.repair.delta");
    assert.equal(deltas.length, 1, "exactly one landed-delta record");
    const rec = JSON.parse(deltas[0]!.detail) as { kind: string; matches: number; unified: string };
    assert.equal(rec.kind, "exact");
    assert.equal(rec.matches, 1);
    assert.equal(rec.unified, "@@ -8,1 +8,1 @@\n-Math.random()\n+name", "the hunk names the RAW line (8) — the masked line (4) never leaks into the record");

    // FM-01 (W37 Y1): the accepted module is recorded as its materialized ESM
    // tree — assert on the chunk file (the accepted bytes live there).
    const expectedD = JSDOC_NONDET_MODULE.replace("Math.random()", "name").trim();
    const chunkD = assertRecordedMaterialized(q, expectedD);
    assert.ok(!chunkD.includes("Math.random"), "the determinism defect is gone");
    assert.ok(validateSynthesisModule(chunkD, KANBAN_ENVELOPE.exports, ["createBoard", "addColumn"]).ok);
    assert.ok(!(q.logs ?? []).some((l) => l.event === "p6.synthesis.refused"), "no refusal — the patched module was accepted");
  });

  it("(e) after a landed delta a PARSEABLE legacy-style reply can no longer overwrite it (legacy block short-circuited)", async () => {
    const base = p6Base();
    const h = patchHarness(
      [
        () => ({ ok: true, text: JSON.stringify({ module: NOCOMMENT_NONDET_MODULE, exports: KANBAN_ENVELOPE.exports, reqTrace: KANBAN_ENVELOPE.reqTrace }), model: "deepseek-v4-flash" }),
        () => ({ ok: true, text: patchReply("Math.random()", "name"), model: "deepseek-v4-flash" }),
        // A PARSEABLE legacy full-rewrite reply — the pre-fix overwrite path
        // (216r §2 defect 2): it used to be accepted and replace the patched
        // module with the plain kanban one, silently discarding the delta.
        () => ({ ok: true, text: JSON.stringify(KANBAN_ENVELOPE), model: "deepseek-v4-flash" }),
      ],
      { patchRepairs: true },
    );
    const q = await liveP6Synthesis(base, h.deps);

    assert.deepEqual(h.kinds, ["synthesis", "patch"], "a landed delta short-circuits the legacy block — no third call");
    assert.equal(h.prompts.length, 2, "the parseable legacy-style reply was never consumed");
    const deltas = (q.logs ?? []).filter((l) => l.event === "p6.repair.delta");
    assert.equal(deltas.length, 1, "the delta landed once");
    // FM-01 (W37 Y1): assert on the recorded chunk file.
    const expectedE = NOCOMMENT_NONDET_MODULE.replace("Math.random()", "name").trim();
    const chunkE = assertRecordedMaterialized(q, expectedE);
    assert.notEqual(
      chunkE,
      materializedSingle(KANBAN_MODULE.trim()).files[1]!.source,
      "the overwrite would have produced the plain kanban module (materialized)",
    );
    assert.ok(!chunkE.includes("Math.random"));
    assert.ok(!(q.logs ?? []).some((l) => l.event === "p6.synthesis.refused"));
  });
});

// --- 217k (W12 LANE B · fixes/216y §2.3 G6): the silent LLM sinks -------------
// Both envelope readers used to return a bare `null` when a reply ARRIVED but
// could not be READ — no log, no code — so an unparseable model reply was
// indistinguishable from "no output". This block pins the fix's three halves:
//   (1) the coded signal IS produced on every read failure, with a bounded
//       excerpt of what arrived and the reader that refused to read it;
//   (2) the caller-visible return is UNCHANGED (null still means "no
//       envelope"/"no patch" — control flow untouched, proven end-to-end);
//   (3) valid/absent replies stay silent — "no output" remains its own state,
//       distinguishable from "unreadable output" by the signal's presence.

/** Collects the read-failure signals a reader emits (the fix's observable). */
function collectReadFailures(): { sink: (f: EnvelopeReadFailure) => void; failures: EnvelopeReadFailure[] } {
  const failures: EnvelopeReadFailure[] = [];
  return { sink: (f) => failures.push(f), failures };
}

describe("217k envelope read-failure signals (G6 silent sinks)", () => {
  it("parseSynthesisEnvelope: malformed reply → coded signal; the caller-visible return is UNCHANGED", () => {
    const { sink, failures } = collectReadFailures();
    const out = parseSynthesisEnvelope("%%% not json %%%", sink);
    assert.equal(out, null, "null still = no envelope (the pre-fix caller contract)");
    assert.equal(failures.length, 1, "exactly one coded signal for one unreadable reply");
    const f = failures[0]!;
    assert.equal(f.code, "RT_E_LLM_REJECTED", "a registry code, not a bare null");
    assert.equal(f.source, "parseSynthesisEnvelope", "the signal names WHERE it came from");
    assert.equal(f.reason, "unreadable-json");
    assert.equal(f.receivedChars, 16);
    assert.ok(f.excerpt.includes("%%% not json %%%"), "the excerpt carries what was actually received");
    assert.match(f.message, /could not be read/, "the truth is 'we could not read it'…");
    assert.ok(!/refused/i.test(f.message), "…never a fabricated 'the model refused' story");
  });

  it("parseSynthesisEnvelope: every wrong-shape read is coded too (missing module / non-object payload)", () => {
    for (const [text, why] of [
      [JSON.stringify({ exports: ["x"] }), /no non-empty `module`/],
      [JSON.stringify({ module: "  " }), /no non-empty `module`/],
      ["[1,2,3]", /not a JSON object/],
      ["42", /not a JSON object/],
    ] as [string, RegExp][]) {
      const { sink, failures } = collectReadFailures();
      assert.equal(parseSynthesisEnvelope(text, sink), null);
      assert.equal(failures.length, 1, `wrong shape stays null AND signals: ${text}`);
      assert.equal(failures[0]!.code, "RT_E_LLM_REJECTED");
      assert.equal(failures[0]!.reason, "unexpected-shape");
      assert.match(failures[0]!.message, why, "the concrete read rule that failed is named");
    }
  });

  it("EMPTY/ABSENT replies stay SILENT — 'no output' is not a read failure (the G6 distinction)", () => {
    for (const text of ["", "   \n\t ", "```json\n```", undefined, null, 42]) {
      const { sink, failures } = collectReadFailures();
      assert.equal(parseSynthesisEnvelope(text, sink), null);
      assert.equal(failures.length, 0, `absent/blank input must not signal: ${JSON.stringify(text)}`);
    }
  });

  it("valid envelope → NO signal (no false positives; fences tolerated as before)", () => {
    const { sink, failures } = collectReadFailures();
    const e = parseSynthesisEnvelope(JSON.stringify(KANBAN_ENVELOPE), sink);
    assert.ok(e);
    const fenced = parseSynthesisEnvelope("```json\n" + JSON.stringify(KANBAN_ENVELOPE) + "\n```", sink);
    assert.ok(fenced);
    assert.equal(failures.length, 0, "a readable envelope never signals");
  });

  it("parseSynthesisPatchEnvelope: unreadable reply signals; the legacy module envelope stays silent (documented continuation)", () => {
    const { sink, failures } = collectReadFailures();
    assert.equal(parseSynthesisPatchEnvelope("I could not apply that patch, sorry.", sink), null);
    assert.equal(failures.length, 1);
    assert.equal(failures[0]!.code, "RT_E_LLM_REJECTED");
    assert.equal(failures[0]!.source, "parseSynthesisPatchEnvelope");
    assert.equal(failures[0]!.reason, "unreadable-json");
    // The legacy full-rewrite envelope is READABLE — a non-delta, not a failure.
    assert.equal(parseSynthesisPatchEnvelope(JSON.stringify({ module: "x", exports: [] }), sink), null);
    assert.equal(failures.length, 1, "a legacy module envelope never signals (the legacy path reads it fine)");
    // Non-string and blank replies stay silent ("no output").
    assert.equal(parseSynthesisPatchEnvelope(42, sink), null);
    assert.equal(parseSynthesisPatchEnvelope("   ", sink), null);
    assert.equal(failures.length, 1);
    // A valid delta never signals.
    assert.deepEqual(parseSynthesisPatchEnvelope(JSON.stringify({ patch: { oldStr: "a", newStr: "b" } }), sink), {
      oldStr: "a",
      newStr: "b",
    });
    assert.equal(failures.length, 1);
  });

  it("parseSynthesisPatchEnvelope: a malformed patch block is coded (empty oldStr / missing newStr)", () => {
    const { sink, failures } = collectReadFailures();
    assert.equal(parseSynthesisPatchEnvelope(JSON.stringify({ patch: { oldStr: "", newStr: "x" } }), sink), null);
    assert.equal(parseSynthesisPatchEnvelope(JSON.stringify({ patch: { oldStr: "x" } }), sink), null);
    assert.equal(failures.length, 2);
    assert.ok(failures.every((f) => f.reason === "unexpected-shape" && f.code === "RT_E_LLM_REJECTED"));
    assert.match(failures[0]!.message, /empty `oldStr`/);
    assert.match(failures[1]!.message, /no string `newStr`/);
  });

  it("the excerpt is BOUNDED: a 10k-char garbage reply reports its length but only ENVELOPE_READ_EXCERPT_MAX excerpt chars", () => {
    const big = "%".repeat(10_000);
    const { sink, failures } = collectReadFailures();
    assert.equal(parseSynthesisEnvelope(big, sink), null);
    assert.equal(failures[0]!.receivedChars, 10_000, "the full received length is reported");
    assert.equal(failures[0]!.excerpt.length, ENVELOPE_READ_EXCERPT_MAX, "the excerpt is capped");
    assert.ok(!failures[0]!.message.includes(big), "never the raw model text unbounded");
    const entry = envelopeReadLogEntry(failures[0]!, "src/generated.ts");
    assert.ok(entry.detail.length <= 440, "the log line stays bounded (400-char cap + path/code prefix)");
  });

  it("envelopeReadLogEntry: the established refusal-log shape — coded, path-prefixed, warn level", () => {
    const failure: EnvelopeReadFailure = {
      code: "RT_E_LLM_REJECTED",
      source: "parseSynthesisEnvelope",
      reason: "unreadable-json",
      excerpt: "%%%",
      receivedChars: 3,
      message: 'parseSynthesisEnvelope: the reply was received but could not be read — JSON.parse failed (3 chars; excerpt "%%%")',
    };
    const entry = envelopeReadLogEntry(failure, "src/generated.ts");
    assert.equal(entry.event, "p6.synthesis.envelope.unreadable");
    assert.equal(entry.level, "warn");
    assert.equal(entry.phase, 6);
    assert.ok(entry.detail.startsWith("src/generated.ts · RT_E_LLM_REJECTED · "), "codes ride the detail like the neighbours");
    assert.match(entry.detail, /could not be read/);
    assert.ok(!/refused/i.test(entry.detail));
  });

  it("e2e: an unparseable synthesis reply is VISIBLE (coded warn ×2) and the terminal refusal is unchanged", async () => {
    const base = p6Base();
    const { deps } = fakeDeps({ completeText: "the model babbled prose, no json at all" });
    const q = await liveP6Synthesis(base, deps);
    assert.equal(q.generatedSource, base.generatedSource, "the deterministic floor still stands");
    const readWarns = (q.logs ?? []).filter((l) => l.event === "p6.synthesis.envelope.unreadable");
    assert.equal(readWarns.length, 2, "BOTH unreadable reads (synthesis + bounded repair) are recorded — pre-fix: zero");
    for (const w of readWarns) {
      assert.equal(w.level, "warn");
      assert.match(w.detail, /src\/generated\.ts · RT_E_LLM_REJECTED · /);
      assert.match(w.detail, /could not be read/);
      assert.ok(w.detail.includes("the model babbled prose"), "the excerpt names what actually arrived");
      assert.ok(!/refused/i.test(w.detail), "the entry never claims the model refused");
    }
    const refusal = q.logs.find((l) => l.event === "p6.synthesis.refused");
    assert.ok(refusal && /RT_E_LLM_REJECTED/.test(refusal.detail), "the terminal refusal trail is unchanged");
  });

  it("e2e: an EMPTY reply reads as 'no output' — zero warns, unlike the unreadable reply (the audit's exact complaint)", async () => {
    const base = p6Base();
    const { deps } = fakeDeps({ completeText: "" });
    const q = await liveP6Synthesis(base, deps);
    assert.equal(q.generatedSource, base.generatedSource, "the floor stands (unchanged)");
    assert.equal(
      (q.logs ?? []).filter((l) => l.event === "p6.synthesis.envelope.unreadable").length,
      0,
      "nothing was received → nothing to report; the warn is the tell that separates it from the garbage case",
    );
    const refusal = q.logs.find((l) => l.event === "p6.synthesis.refused");
    assert.ok(refusal && /unparseable synthesis envelope/.test(refusal.detail), "the terminal refusal still lands");
  });

  it("e2e: a rescue is NOT a refusal — the warn is recorded, the cycle is accepted, p6.synthesis.refused stays clean", async () => {
    const base = p6Base();
    let n = 0;
    const complete = async (): Promise<LlmResult> => {
      n += 1;
      return { ok: true, text: n === 1 ? "%%% not json %%%" : JSON.stringify(KANBAN_ENVELOPE), model: "deepseek-v4-flash" };
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
    assertRecordedMaterialized(q, KANBAN_MODULE.trim()); // FM-01 re-point: the bounded repair rescued the cycle, recorded materialized
    const readWarns = (q.logs ?? []).filter((l) => l.event === "p6.synthesis.envelope.unreadable");
    assert.equal(readWarns.length, 1, "exactly one warn — only the FIRST reply was unreadable");
    assert.ok(readWarns[0]!.detail.includes("%%% not json %%%"));
    assert.ok(
      !(q.logs ?? []).some((l) => l.event === "p6.synthesis.refused"),
      "a rescued parse must never read as a refused cycle (p6.synthesis.refused is the terminal census)",
    );
  });

  it("e2e: an unreadable PATCH reply is recorded on p6.repair.patch.refused; the legacy repair rescues, control flow unchanged", async () => {
    const base = p6Base();
    const h = patchHarness(
      [
        () => ({ ok: true, text: JSON.stringify(PROSE_REFUSED_ENVELOPE), model: "deepseek-v4-flash" }),
        () => ({ ok: true, text: "I could not produce a patch, sorry — here is prose.", model: "deepseek-v4-flash" }),
        () => ({ ok: true, text: JSON.stringify(KANBAN_ENVELOPE), model: "deepseek-v4-flash" }),
      ],
      { patchRepairs: true },
    );
    const q = await liveP6Synthesis(base, h.deps);

    assert.deepEqual(h.kinds, ["synthesis", "patch", "legacy-prose"], "the call sequence is unchanged by the fix");
    const refusal = (q.logs ?? []).find((l) => l.event === "p6.repair.patch.refused");
    assert.ok(refusal, "the unreadable delta reply is recorded (pre-fix: this line was silent)");
    assert.match(refusal!.detail, /^src\/generated\.ts · RT_E_LLM_REJECTED · /);
    assert.match(refusal!.detail, /could not be read/);
    assert.match(refusal!.detail, /I could not produce a patch/, "the excerpt carries the received bytes");
    assert.ok(!/refused/i.test(refusal!.detail), "no fabricated refusal story for a reply we merely could not read");
    assertRecordedMaterialized(q, KANBAN_MODULE.trim()); // FM-01 re-point: the legacy full-rewrite repair still lands, recorded materialized
    assert.ok(!(q.logs ?? []).some((l) => l.event === "p6.repair.delta"), "an unreadable reply never stamps a delta record");
    assert.ok(!(q.logs ?? []).some((l) => l.event === "p6.synthesis.refused"), "no terminal refusal — the cycle was rescued");
  });

  it("e2e: the chunked path records an unreadable chunk reply with the planned FILE path (honest partial unchanged)", async () => {
    const base = p6Base(LEDGER_BRIEF);
    const f = chunkedDeps({ failChunk: 1 });
    const q = await liveP6Synthesis(base, f.deps);
    const warns = (q.logs ?? []).filter((l) => l.event === "p6.synthesis.envelope.unreadable");
    assert.equal(warns.length, 2, "chunk 1's synthesis AND its bounded repair were unreadable → both recorded");
    assert.ok(
      warns.every((w) => w.detail.startsWith("src/jobs/rent-2.ts · RT_E_LLM_REJECTED · ")),
      "the planned file path attributes the failure to the refused chunk",
    );
    const refusal = (q.logs ?? []).find((l) => l.event === "p6.synthesis.refused");
    assert.ok(refusal && /chunk 2\/3 refused/.test(refusal.detail), "the terminal honest-partial refusal is unchanged");
    assert.ok(
      !(q.generatedSource ?? "").includes("collectRent8"),
      "the refused chunk's export is absent from the entry barrel",
    );
    // fixes/258: the entry IS the ESM barrel, so the prior chunk's code lives
    // in its own file — assert on the tree, not on the entry's text.
    const prior = (q.generatedTree ?? []).find((t) => t.path === "src/jobs/rent.ts");
    assert.ok(prior !== undefined && prior.source.includes("collectRent0"), "the prior chunk's real file stays on the project");
    assert.ok(
      (q.generatedTree ?? []).some((t) => t.path === TREE_ENTRY_PATH),
      "the entry barrel is on the project too",
    );
    assert.ok(!(q.generatedTree ?? []).some((t) => t.path === "src/jobs/rent-2.ts"), "the refused chunk never lands");
  });
});

// ---------------------------------------------------------------------------
// T5.4 (W18 LANE 5) — artifact provenance from REAL emit data. Every artifact
// record codegen emits carries `provenance = { producer, model?, timestamp,
// inputHash }` derived from the run itself: the SERVED model id (the provider
// LlmResult, never the requested constant), the emit-time clock, and the
// hashed derivation input. The block survives the io serializer round-trip
// (export → import; boundary laws pinned in io.test.ts).
// ---------------------------------------------------------------------------

/** The stamp on a record, read through the widen-in-place seam (the types.ts
 *  `Artifact` does not carry `provenance` yet — io.ts owns the shape). */
const provenanceOf = (a: { id: string }): ArtifactProvenance | undefined =>
  (a as unknown as { provenance?: ArtifactProvenance }).provenance;

describe("T5.4 artifact provenance (real emit data)", () => {
  it("single-module success: the model artifact names the SERVED model + brief hash; the verify record is deterministic", async () => {
    const base = p6Base();
    const t0 = Date.now();
    const { deps } = fakeDeps();
    const q = await liveP6Synthesis(base, deps);
    const t1 = Date.now();

    const code = q.artifacts.find((a) => a.title === "Generated module (LLM, machine-verified)");
    assert.ok(code, "precondition: the model-produced code artifact exists");
    const codeProv = provenanceOf(code!);
    assert.ok(codeProv, "the model-produced artifact must carry a provenance stamp");
    assert.equal(codeProv!.producer, "model");
    assert.equal(
      codeProv!.model,
      "deepseek-v4-flash",
      "the SERVED id off the LlmResult — never the requested P6_SYNTH_MODEL constant",
    );
    assert.ok(codeProv!.timestamp >= t0 && codeProv!.timestamp <= t1, "timestamp is the real emit-time clock");
    assert.equal(codeProv!.inputHash, String(fnv1a(KANBAN_BRIEF)), "input hash = the synthesis brief hash");
    assert.equal(codeProv!.inputHash, q.implementationSpec?.briefHash, "and equals what the implementationSpec persisted");

    const verify = q.artifacts.find((a) => a.title.includes("Verify outcome"));
    assert.ok(verify, "precondition: the machine verify artifact exists");
    const vProv = provenanceOf(verify!);
    assert.ok(vProv, "the machine verify record must carry a provenance stamp");
    assert.equal(vProv!.producer, "deterministic", "machine-run evidence is machine-derived, never model-stamped");
    assert.equal("model" in vProv!, false, "a deterministic record carries no model key at all");
    const evidence = "3/3 machine-run cases passed on iteration 1"; // fakeDeps default
    assert.equal(
      vProv!.inputHash,
      // FM-01 (W37 Y1): the verify record hashes the verified MODULE bytes (its
      // real derivation input — verifyOutcomeArtifact(finalModule, outcome));
      // generatedSource is now the materialized barrel, so recompute from the module.
      String(fnv1a(`${KANBAN_MODULE.trim()}${evidence}`)),
      "input hash = fnv1a(verified module + evidence) — the record's real derivation input",
    );
  });

  it("chunked tree success: the tree artifact stamps the served model + brief hash", async () => {
    const base = p6Base(LEDGER_BRIEF);
    const f = chunkedDeps();
    const q = await liveP6Synthesis(base, f.deps);
    const treeArt = q.artifacts.find((a) => a.title.includes("chunked synthesis"));
    assert.ok(treeArt, "precondition: the tree code artifact exists");
    const prov = provenanceOf(treeArt!);
    assert.ok(prov, "the chunked tree artifact must carry a provenance stamp");
    assert.equal(prov!.producer, "model");
    assert.equal(prov!.model, "deepseek-v4-flash");
    assert.equal(prov!.inputHash, q.implementationSpec?.briefHash, "the chunked synthesis input hash is the shared brief hash");
    assert.ok(prov!.timestamp > 0);
  });

  it("an unnamed served model yields NO stamp (fail closed — never a guessed producer)", async () => {
    const base = p6Base();
    const { deps } = fakeDeps();
    // A rogue provider reply with no servable model id: the module is still
    // accepted, but its provenance can name nothing — so it stamps nothing.
    deps.complete = async (): Promise<LlmResult> => ({ ok: true, text: JSON.stringify(KANBAN_ENVELOPE), model: "" });
    const q = await liveP6Synthesis(base, deps);
    assertRecordedMaterialized(q, KANBAN_MODULE.trim()); // FM-01 re-point: precondition — the synthesis still succeeded, recorded materialized
    const code = q.artifacts.find((a) => a.title === "Generated module (LLM, machine-verified)");
    assert.ok(code, "precondition: the code artifact exists");
    assert.equal(provenanceOf(code!), undefined, "no stamp is better than a guessed one (declare-or-strike)");
    // The verify record's stamp needs no model id — it is still minted.
    const verify = q.artifacts.find((a) => a.title.includes("Verify outcome"));
    assert.equal(provenanceOf(verify!)?.producer, "deterministic");
  });

  it("provenance populates from real emit data AND survives the io save/load round-trip", async () => {
    const base = p6Base();
    const { deps } = fakeDeps();
    const q = await liveP6Synthesis(base, deps);
    const before = q.artifacts.map((a) => provenanceOf(a));
    assert.ok(before.some((p) => p?.producer === "model"), "precondition: a model stamp exists to survive");

    const res = importProject(exportProjectJson(q));
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.deepEqual(
      res.project.artifacts.map((a) => provenanceOf(a)),
      before,
      "stamps identical after save → load (producer + served model + clock + input hash)",
    );
    assert.equal(
      JSON.stringify(res.project.artifacts),
      JSON.stringify(q.artifacts),
      "the artifact rows round-trip byte-identically",
    );
  });
});

// ---------------------------------------------------------------------------
// W46/332-1 (P1) — un-awaited async imports. The real keyed tree's
// `src/jobs/rehab.ts` called the async `getProperty(propertyId)` without
// `await` and read `.ok` off the returned Promise, so the rejection floated past
// the spec and redded the whole file. The validator must refuse the detectable
// value-position forms before the tree is emitted.
// ---------------------------------------------------------------------------

/** The recorded keyed-tree shape: a `Promise.resolve().then(…)` body whose var
 *  is read with `.ok` off the un-awaited async `getProperty` (bytes from
 *  `wave_plans/W46/lane-1-prompter.md`). */
const REHAB_ASYNC_MODULE = [
  "/**",
  " * req-4: rehab timeline for a property.",
  " * @param {string} propertyId",
  " * @returns {Promise<object>}",
  " */",
  "function getRehabTimeline(propertyId) {",
  "  return Promise.resolve().then(function () {",
  "    var property = getProperty(propertyId);",
  "    if (property && property.ok === false) {",
  "      return { ok: false, error: property.error };",
  "    }",
  "    return { ok: true, timeline: [] };",
  "  });",
  "}",
  "module.exports.getRehabTimeline = getRehabTimeline;",
].join("\n");

const GET_PROPERTY_PRIOR = [
  { path: "src/generated/get-property.ts", exports: ["getProperty"], asyncExports: ["getProperty"] },
];

describe("W46/332-1 (P1) un-awaited async imports", () => {
  it("the recorded rehab.ts shape is REFUSED when the sibling async mark is present, accepted without it (the pre-fix hole)", () => {
    // Negative control first: the same bytes with the async mark absent are the
    // exact pre-fix validator behaviour — a model slip sailed straight through.
    const withoutMark = validateSynthesisModule(REHAB_ASYNC_MODULE, ["getRehabTimeline"], ["getRehabTimeline"], [
      { path: "src/generated/get-property.ts", exports: ["getProperty"] },
    ]);
    assert.equal(withoutMark.ok, true, "without the async mark the validator cannot know getProperty returns a Promise");
    // Same bytes, same prior chunk, now marked async: the value-position read is refused.
    const refused = validateSynthesisModule(REHAB_ASYNC_MODULE, ["getRehabTimeline"], ["getRehabTimeline"], GET_PROPERTY_PRIOR);
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, "RT_E_VALIDATION");
      assert.match(refused.error, /un-awaited async call used as a value/);
      assert.match(refused.error, /"getProperty" at line 9 \(bound-then-read\)/);
      assert.match(refused.error, /Promise/);
    }
  });

  it("refuses the direct property-read and destructure forms; accepts an awaited call and a .then consumer", () => {
    const direct = [
      "function f(id) { return getProperty(id).ok; }",
      "module.exports.f = f;",
    ].join("\n");
    const directV = validateSynthesisModule(direct, ["f"], ["f"], GET_PROPERTY_PRIOR);
    assert.equal(directV.ok, false);
    if (!directV.ok) assert.match(directV.error, /\(property-read\)/);

    const destructure = [
      "function f(id) {",
      "  const { ok, value } = getProperty(id);",
      "  return { ok: ok, value: value };",
      "}",
      "module.exports.f = f;",
    ].join("\n");
    const destructureV = validateSynthesisModule(destructure, ["f"], ["f"], GET_PROPERTY_PRIOR);
    assert.equal(destructureV.ok, false);
    if (!destructureV.ok) assert.match(destructureV.error, /\(destructure\)/);

    const awaited = [
      "async function f(id) {",
      "  const property = await getProperty(id);",
      "  return { ok: property.ok };",
      "}",
      "module.exports.f = f;",
    ].join("\n");
    assert.equal(validateSynthesisModule(awaited, ["f"], ["f"], GET_PROPERTY_PRIOR).ok, true, "await is the fix");

    const thenConsumer = [
      "function f(id) {",
      "  return getProperty(id).then(function (p) { return p.ok; });",
      "}",
      "module.exports.f = f;",
    ].join("\n");
    assert.equal(
      validateSynthesisModule(thenConsumer, ["f"], ["f"], GET_PROPERTY_PRIOR).ok,
      true,
      ".then is a legal promise consumer, never the value-position defect",
    );

    // A synchronously-declared name that merely shares the vocabulary is not refused.
    const syncRead = [
      "function f(input) {",
      "  const r = validateLineItemInput(input);",
      "  return r.ok;",
      "}",
      "module.exports.f = f;",
    ].join("\n");
    assert.equal(validateSynthesisModule(syncRead, ["f"], ["f"], GET_PROPERTY_PRIOR).ok, true);
  });

  it("333-1 F-1: optional-chaining and computed member reads off an un-awaited async call are refused", () => {
    const optional = "function f(id) { return getProperty(id)?.ok; }\nmodule.exports.f = f;";
    const optionalV = validateSynthesisModule(optional, ["f"], ["f"], GET_PROPERTY_PRIOR);
    assert.equal(optionalV.ok, false, "`?.ok` reads off the Promise exactly like `.ok`");
    if (!optionalV.ok) assert.match(optionalV.error, /"getProperty" at line 1 \(property-read\)/);

    const computed = 'function f(id) { return getProperty(id)["ok"]; }\nmodule.exports.f = f;';
    const computedV = validateSynthesisModule(computed, ["f"], ["f"], GET_PROPERTY_PRIOR);
    assert.equal(computedV.ok, false, "`[\"ok\"]` reads off the Promise exactly like `.ok`");
    if (!computedV.ok) assert.match(computedV.error, /\(computed-read\)/);

    const optionalComputed = 'function f(id) { return getProperty(id)?.["ok"]; }\nmodule.exports.f = f;';
    assert.equal(validateSynthesisModule(optionalComputed, ["f"], ["f"], GET_PROPERTY_PRIOR).ok, false);

    // The bound-then-read shape through the same tails.
    const boundOptional = [
      "function f(id) {",
      "  const property = getProperty(id);",
      "  return property?.ok;",
      "}",
      "module.exports.f = f;",
    ].join("\n");
    assert.equal(validateSynthesisModule(boundOptional, ["f"], ["f"], GET_PROPERTY_PRIOR).ok, false);
    const boundComputed = [
      "function f(id) {",
      "  const property = getProperty(id);",
      '  return property["ok"];',
      "}",
      "module.exports.f = f;",
    ].join("\n");
    assert.equal(validateSynthesisModule(boundComputed, ["f"], ["f"], GET_PROPERTY_PRIOR).ok, false);
    // The reported line is the member READ, not the call binding.
    const boundComputedV = validateSynthesisModule(boundComputed, ["f"], ["f"], GET_PROPERTY_PRIOR);
    if (!boundComputedV.ok) assert.match(boundComputedV.error, /"getProperty" at line 3 \(bound-then-read\)/);

    // Legal shapes through the same tails stay accepted.
    const awaitedOptional = [
      "async function f(id) {",
      "  const property = await getProperty(id);",
      "  return property?.ok;",
      "}",
      "module.exports.f = f;",
    ].join("\n");
    assert.equal(validateSynthesisModule(awaitedOptional, ["f"], ["f"], GET_PROPERTY_PRIOR).ok, true, "await is the fix");
    const computedThen = 'function f(id) { return getProperty(id)["then"](function (p) { return p.ok; }); }\nmodule.exports.f = f;';
    assert.equal(validateSynthesisModule(computedThen, ["f"], ["f"], GET_PROPERTY_PRIOR).ok, true, "computed `.then` is a legal consumer");
    const optionalThen = "function f(id) { return getProperty(id)?.then(function (p) { return p.ok; }); }\nmodule.exports.f = f;";
    assert.equal(validateSynthesisModule(optionalThen, ["f"], ["f"], GET_PROPERTY_PRIOR).ok, true);
  });

  it("333-1 F-1: async-arrow / function-expression / method / CJS-export declarations are discovered and refused", () => {
    const boundRead = "function f(id) { const p = getProperty(id); return p.ok; }\nmodule.exports.f = f;";
    const forms: [string, string][] = [
      ["arrow const", `const getProperty = async (id) => { return { ok: true, id: id }; };\n${boundRead}\nmodule.exports.getProperty = getProperty;`],
      ["single-param arrow", `const getProperty = async id => { return { ok: true, id: id }; };\n${boundRead}\nmodule.exports.getProperty = getProperty;`],
      ["function expression", `const getProperty = async function (id) { return { ok: true, id: id }; };\n${boundRead}\nmodule.exports.getProperty = getProperty;`],
    ];
    for (const [label, mod] of forms) {
      assert.ok(asyncNamesInScope(mod).includes("getProperty"), `${label}: the async declaration is discovered`);
      const v = validateSynthesisModule(mod, ["f", "getProperty"], ["f", "getProperty"]);
      assert.equal(v.ok, false, `${label}: the un-awaited bound read is refused`);
      if (!v.ok) assert.match(v.error, /bound-then-read/);
    }

    // A CJS-surface async export is discovered too (the module may not use `const`).
    const cjs = `module.exports.getProperty = async (id) => { return { ok: true, id: id }; };\n${boundRead}`;
    assert.ok(asyncNamesInScope(cjs).includes("getProperty"), "an `exports.NAME = async` assignment is discovered");
    assert.equal(validateSynthesisModule(cjs, ["f", "getProperty"], ["f", "getProperty"]).ok, false);

    // A class async method is discovered lexically (bare calls only — see the guard's limit).
    const klass = [
      "class PropertyStore {",
      "  async getProperty(id) {",
      "    return { ok: true, id: id };",
      "  }",
      "}",
      "module.exports.PropertyStore = PropertyStore;",
    ].join("\n");
    assert.ok(asyncNamesInScope(klass).includes("getProperty"), "an `async NAME(` method is discovered");

    // A non-async callable that merely starts with `async` is NOT discovered.
    const asyncThing = "const x = asyncThing();\nfunction f(id) { const p = x; return p.ok; }\nmodule.exports.f = f;";
    assert.equal(asyncNamesInScope(asyncThing).includes("asyncThing"), false);
    assert.deepEqual(asyncNamesInScope("const y = asyncValue;"), []);

    // The awaited arrow is accepted (await is the fix, regardless of declaration form).
    const awaitedArrow = `const getProperty = async (id) => { return { ok: true, id: id }; };\nasync function f(id) { const p = await getProperty(id); return p.ok; }\nmodule.exports.f = f;\nmodule.exports.getProperty = getProperty;`;
    assert.equal(validateSynthesisModule(awaitedArrow, ["f", "getProperty"], ["f", "getProperty"]).ok, true);
  });

  it("334-1 P1: a computed key bound to a const string resolves — a legal `[\"then\"]` chain is not over-refused, a value key still is", () => {
    // 333-1 named the dynamic-key over-refusal; a `const` key is statically
    // resolvable, so a legal then/catch chain through it must not be refused.
    const legalThen = [
      'const THEN = "then";',
      "function f(id) { return getProperty(id)[THEN](function (p) { return p.ok; }); }",
      "module.exports.f = f;",
    ].join("\n");
    assert.equal(validateSynthesisModule(legalThen, ["f"], ["f"], GET_PROPERTY_PRIOR).ok, true, "const-resolved `.then` consumer stays legal");
    const legalCatch = [
      'const CATCH = "catch";',
      "function f(id) { return getProperty(id)[CATCH](function (e) { return e; }); }",
      "module.exports.f = f;",
    ].join("\n");
    assert.equal(validateSynthesisModule(legalCatch, ["f"], ["f"], GET_PROPERTY_PRIOR).ok, true);

    // A const key that resolves to a value property is still the defect.
    const valueKey = 'const OK = "ok";\nfunction f(id) { return getProperty(id)[OK]; }\nmodule.exports.f = f;';
    const valueV = validateSynthesisModule(valueKey, ["f"], ["f"], GET_PROPERTY_PRIOR);
    assert.equal(valueV.ok, false, "`[OK]` reads a value property off the Promise");
    if (!valueV.ok) assert.match(valueV.error, /\(computed-read\)/);

    // The bound-then-read shape through a resolved key: legal `[THEN]`, defect `[OK]`.
    const boundThen = ['const THEN = "then";', "function f(id) { const p = getProperty(id); return p[THEN](function (x) { return x; }); }", "module.exports.f = f;"].join("\n");
    assert.equal(validateSynthesisModule(boundThen, ["f"], ["f"], GET_PROPERTY_PRIOR).ok, true, "`p[THEN](cb)` is a legal chain");
    const boundOk = ['const OK = "ok";', "function f(id) { const p = getProperty(id); return p[OK]; }", "module.exports.f = f;"].join("\n");
    const boundOkV = validateSynthesisModule(boundOk, ["f"], ["f"], GET_PROPERTY_PRIOR);
    assert.equal(boundOkV.ok, false);
    if (!boundOkV.ok) assert.match(boundOkV.error, /bound-then-read/);

    // An unresolvable dynamic key stays conservative (refused, named computed-read).
    const dynamic = "function f(id, k) { return getProperty(id)[k]; }\nmodule.exports.f = f;";
    const dynV = validateSynthesisModule(dynamic, ["f"], ["f"], GET_PROPERTY_PRIOR);
    assert.equal(dynV.ok, false, "an unresolvable key is still a computed read");
    if (!dynV.ok) assert.match(dynV.error, /\(computed-read\)/);
  });

  it("334-1 P1: a `this.m()` receiver call inside the declaring class is refused; legal receivers stay accepted", () => {
    for (const [form, body] of [["property-read", "read(id) { return this.getProperty(id).ok; }"], ["bound-then-read", "read(id) { const p = this.getProperty(id); return p.ok; }"]] as const) {
      const mod = ["class PropertyStore {", "  async getProperty(id) { return { ok: true, id: id }; }", `  ${body}`, "}", "module.exports.PropertyStore = PropertyStore;"].join("\n");
      assert.ok(asyncNamesInScope(mod).includes("getProperty"), "the async method is discovered");
      const v = validateSynthesisModule(mod, ["PropertyStore"], ["PropertyStore"]);
      assert.equal(v.ok, false, `${form}: this.getProperty(...) is refused`);
      if (!v.ok) assert.match(v.error, /un-awaited async call used as a value/);
    }
    // Legal controls: awaited, .then, ["then"] and a synchronously-declared member.
    const legal = [
      "class PropertyStore {",
      "  async getProperty(id) { return { ok: true, id: id }; }",
      "  async read(id) { const p = await this.getProperty(id); return p.ok; }",
      "  chain(id) { return this.getProperty(id).then(function (p) { return p.ok; }); }",
      "  computed(id) { return this.getProperty(id)['then'](function (p) { return p.ok; }); }",
      "}",
      "module.exports.PropertyStore = PropertyStore;",
    ].join("\n");
    assert.equal(validateSynthesisModule(legal, ["PropertyStore"], ["PropertyStore"]).ok, true, "await/.then/['then'] receivers stay legal");
    const syncMember = [
      "class PropertyStore {",
      "  getProperty(id) { return { ok: true, id: id }; }",
      "  read(id) { return this.getProperty(id).ok; }",
      "}",
      "module.exports.PropertyStore = PropertyStore;",
    ].join("\n");
    assert.equal(validateSynthesisModule(syncMember, ["PropertyStore"], ["PropertyStore"]).ok, true, "a sync member is never refused");
    // An async `save` on class A must not refuse class B's synchronous `this.save()`.
    const twoClasses = [
      "class A {",
      "  async save() { return 1; }",
      "}",
      "class B {",
      "  save() { return { ok: true }; }",
      "  run() { return this.save().ok; }",
      "}",
      "module.exports.A = A;",
      "module.exports.B = B;",
    ].join("\n");
    assert.equal(validateSynthesisModule(twoClasses, ["A", "B"], ["A", "B"]).ok, true, "another receiver's same-named sync member is not over-refused");
    // A named receiver (`store.m()`) stays outside the guard (needs type resolution).
    const namedReceiver = [
      "class PropertyStore {",
      "  async getProperty(id) { return { ok: true, id: id }; }",
      "}",
      "function f(store, id) { return store.getProperty(id).ok; }",
      "module.exports.f = f;",
      "module.exports.PropertyStore = PropertyStore;",
    ].join("\n");
    assert.equal(validateSynthesisModule(namedReceiver, ["f", "PropertyStore"], ["f", "PropertyStore"]).ok, true, "a named receiver is not matched (documented limit)");
  });

  it("refuses a module's OWN async function used as a value without await (single-module path, no prior chunks)", () => {
    const mod = [
      "async function load(id) { return { ok: true }; }",
      "function f(id) {",
      "  const x = load(id);",
      "  return x.ok;",
      "}",
      "module.exports.f = f;",
      "module.exports.load = load;",
    ].join("\n");
    const v = validateSynthesisModule(mod, ["f", "load"], ["f", "load"]);
    assert.equal(v.ok, false);
    if (!v.ok) assert.match(v.error, /"load" at line 4 \(bound-then-read\)/);
    const awaited = mod.replace("const x = load(id);", "const x = await load(id);").replace("function f(id)", "async function f(id)");
    assert.equal(validateSynthesisModule(awaited, ["f", "load"], ["f", "load"]).ok, true);
  });

  it("asyncExportNames / unawaitedAsyncValueUses: deterministic, comments and strings never report", () => {
    const src = [
      "// async function ghost(a) {}",
      'const s = "async function other(a) {}";',
      "async function getProperty(id) { return { ok: true, id: id }; }",
      "function sync() { return 1; }",
      "module.exports.getProperty = getProperty;",
      "module.exports.sync = sync;",
    ].join("\n");
    assert.deepEqual(asyncExportNames(src, ["getProperty", "sync", "ghost", "other"]), ["getProperty"]);

    const uses = unawaitedAsyncValueUses(
      ["async function getProperty(id) { return { ok: true }; }", "function f(id) {", "  const property = getProperty(id);", "  return property.ok;", "}"].join("\n"),
      ["getProperty"],
    );
    assert.deepEqual(uses, [{ name: "getProperty", line: 4, form: "bound-then-read" }]);
    assert.deepEqual(unawaitedAsyncValueUses("async function g() {}\nfunction f() { return g(); }", ["g"]), []);
    assert.deepEqual(unawaitedAsyncValueUses("function f() {}", []), []);
  });

  it("the async-await repair prompt names the callable, its line and form, and the await fix", () => {
    const uses: AsyncUnawaitedUse[] = [{ name: "getProperty", line: 9, form: "bound-then-read" }];
    const prompt = p6SynthesisAsyncAwaitRepairPrompt(uses);
    assert.match(prompt, /"getProperty" at line 9/);
    assert.match(prompt, /bound-then-read/);
    assert.match(prompt, /`await`/);
    assert.match(prompt, /unhandled rejection/);
    assert.match(prompt, /Return JSON ONLY/);
    assert.equal(p6SynthesisAsyncAwaitRepairPrompt([]).includes("(none listed)"), true);
  });

  it("the system prompt advertises the await rule the validator enforces (drift-proof)", () => {
    const s = p6SynthesisSystemPrompt();
    assert.match(s, /ASYNCHRONOUS/);
    assert.match(s, /MUST `await`/);
    assert.match(s, /reads `undefined` off a Promise/);
  });

  it("the chunk prompt marks an async earlier export and states the await rule (absent mark keeps legacy bytes)", () => {
    const spec = ledgerSpec(2);
    const prior: ChunkPriorFile[] = [
      { path: "src/generated/get-property.ts", exports: ["getProperty"], reqTrace: {}, asyncExports: ["getProperty"] },
    ];
    const withAsync = p6SynthesisChunkUserPrompt(LEDGER_BRIEF, spec, spec.typeSignatures, prior);
    assert.ok(withAsync.includes("asynchronous (must await): getProperty"), "the async export is marked in the earlier-files block");
    assert.ok(withAsync.includes("you MUST `await` it before reading any property off the result"));
    const legacy: ChunkPriorFile[] = [
      { path: "src/generated/get-property.ts", exports: ["getProperty"], reqTrace: {} },
    ];
    const withoutAsync = p6SynthesisChunkUserPrompt(LEDGER_BRIEF, spec, spec.typeSignatures, legacy);
    assert.ok(!withoutAsync.includes("asynchronous (must await)"), "no mark ⇒ no per-file async tag");
  });

  it("e2e single-module: an un-awaited local async value is repaired by ONE async re-prompt, then accepted", async () => {
    const bad = [
      "/** req-1: create a board. */",
      "async function loadBoard(name) { return { id: name, name: name, columns: [] }; }",
      "function createBoard(name) {",
      "  const board = loadBoard(name);",
      "  return { id: board.id, name: name, columns: [] };",
      "}",
      "/** req-2: add a column. */",
      "function addColumn(board, columns) { board.columns = columns || []; return board; }",
      "function kanbanBoard(columns) { return { columns: columns }; }",
      "module.exports.loadBoard = loadBoard;",
      "module.exports.createBoard = createBoard;",
      "module.exports.addColumn = addColumn;",
      "module.exports.kanbanBoard = kanbanBoard;",
    ].join("\n");
    const repaired = bad
      .replace("function createBoard(name) {", "async function createBoard(name) {")
      .replace("const board = loadBoard(name);", "const board = await loadBoard(name);");
    const prompts: string[] = [];
    const complete = async (prompt: string): Promise<LlmResult> => {
      prompts.push(prompt);
      const isAsyncRepair = prompt.includes("ASYNCHRONOUS function without");
      const module = isAsyncRepair ? repaired : bad;
      const exports = ["loadBoard", "createBoard", "addColumn", "kanbanBoard"];
      const reqTrace: Record<string, string> = {};
      exports.forEach((n, i) => (reqTrace[`req-${i}`] = n));
      return { ok: true, text: JSON.stringify({ module, exports, reqTrace }), model: "deepseek-v4-flash" };
    };
    const q = await liveP6Synthesis(p6Base(), {
      complete,
      expand: async () => ({ ok: true, spec: KANBAN_SPEC }),
      verify: async () => ({
        status: "passed" as const,
        iterations: 1,
        evidence: "repaired",
        finalSource: repaired,
        cases: [],
      }),
    });
    assert.equal(prompts.filter((p) => p.includes("ASYNCHRONOUS function without")).length, 1, "exactly one async re-prompt");
    assert.match(prompts[1]!, /"loadBoard" at line 5/);
    assert.ok(!q.logs.some((l) => l.event === "p6.synthesis.refused"), "the repair converged — never a refused cycle");
    const chunk = (q.generatedTree ?? []).find((f) => f.path === TREE_CHUNK0_RELOCATED_PATH);
    assert.ok(chunk, "the accepted module is materialized on the tree");
    assert.ok(chunk!.source.includes("await loadBoard("), "the emitted bytes carry the awaited call");
    assert.ok(!chunk!.source.includes("const board = loadBoard("), "the un-awaited form is gone");
  });

  it("e2e chunked: a later chunk reading .ok off an async SIBLING export is refused, repaired, then accepted", async () => {
    const base = p6Base(LEDGER_BRIEF);
    const spec = ledgerSpec(20);
    const chunkNames = chunkTypeSignatures(spec.typeSignatures).map((g) => signatureFunctionNames(g));
    const withAsyncExport = (names: readonly string[]): string =>
      `${chunkModule(names)}\nasync function getProperty(id) { return { ok: true, id: id }; }\nmodule.exports.getProperty = getProperty;\n`;
    const asyncCall = (names: readonly string[], awaited: boolean): string => {
      const fn = names[0]!;
      const body = awaited
        ? `async function ${fn}(input) { const property = await getProperty(input); return { ok: property.ok, value: input }; }`
        : `function ${fn}(input) { const property = getProperty(input); return { ok: property.ok, value: input }; }`;
      return chunkModule(names).replace(`function ${fn}(input) { return input; }`, body);
    };
    const envelopeOf = (module: string, names: readonly string[], idx: number): string => {
      const reqTrace: Record<string, string> = {};
      names.forEach((n, i) => (reqTrace[`req-${idx}-${i}`] = n));
      return JSON.stringify({ module, exports: [...names], reqTrace });
    };
    const prompts: string[] = [];
    let synthIndex = 0;
    const complete = async (prompt: string): Promise<LlmResult> => {
      prompts.push(prompt);
      if (prompt.includes("ASYNCHRONOUS function without")) {
        return { ok: true, text: envelopeOf(asyncCall(chunkNames[1]!, true), chunkNames[1]!, 1), model: "deepseek-v4-flash" };
      }
      if (!prompt.includes("TYPE SIGNATURES (must export")) {
        return { ok: true, text: "noop", model: "deepseek-v4-flash" };
      }
      const idx = synthIndex++;
      if (idx === 0) {
        return { ok: true, text: envelopeOf(withAsyncExport(chunkNames[0]!), [...chunkNames[0]!, "getProperty"], 0), model: "deepseek-v4-flash" };
      }
      if (idx === 1) {
        return { ok: true, text: envelopeOf(asyncCall(chunkNames[1]!, false), chunkNames[1]!, 1), model: "deepseek-v4-flash" };
      }
      return { ok: true, text: envelopeOf(chunkModule(chunkNames[idx] ?? []), chunkNames[idx] ?? [], idx), model: "deepseek-v4-flash" };
    };
    const q = await liveP6Synthesis(base, {
      complete,
      expand: async () => ({ ok: true, spec }),
      verify: async () => ({ status: "passed" as const, iterations: 0, evidence: "unused", finalSource: "", cases: [] }),
    });
    assert.equal(prompts.filter((p) => p.includes("ASYNCHRONOUS function without")).length, 1, "exactly one async sibling re-prompt");
    assert.match(prompts.find((p) => p.includes("ASYNCHRONOUS function without"))!, /"getProperty"/);
    assert.ok(!q.logs.some((l) => l.event === "p6.synthesis.refused"), "the sibling-async repair converged");
    const second = (q.generatedTree ?? []).find((f) => f.path === "src/jobs/rent-2.ts");
    assert.ok(second, "the repaired second chunk landed on the tree");
    assert.ok(second!.source.includes("await getProperty("), "the emitted chunk awaits the async sibling");
    assert.ok(second!.source.includes("import {"), "the materialized chunk imports the sibling export");
  });
});

// ---------------------------------------------------------------------------
// W46/332-1 (P2) — deterministic, legible plan coverage. Run A emitted 7 files
// (p6-arch PASS); run B emitted 5 (p6-arch FAIL). The recorded café projects
// are the real bytes both shapes are pinned against.
// ---------------------------------------------------------------------------

describe("W46/332-1 (P2) plan-coverage determinism", () => {
  const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
  const readProject = (app: string): Project =>
    JSON.parse(readFileSync(join(REPO_ROOT, "research", "eval-out", app, ".rapidtool", "project.json"), "utf8")) as Project;

  it("run-B recorded bytes (coffeehouse2home-property-ledger): the census counts the unbound job; p6-arch names the uncovered capabilities", () => {
    const p = readProject("coffeehouse2home-property-ledger");
    const sigs = p.implementationSpec?.typeSignatures ?? [];
    assert.equal(sigs.length, 36, "precondition: the recorded run-B spec carries 36 signatures");
    const census = treeChunkPlanCensus(p, sigs);
    assert.deepEqual(census.declared, ["track", "record", "flip", "show", "lease"]);
    assert.deepEqual(census.planned, ["record", "flip", "show", "lease"]);
    assert.deepEqual(census.unbound, ["track"], "the declared job no signature names is COUNTED, never silent");
    assert.equal(census.paths.includes("src/jobs/track.ts"), false, "an unbound job has no planned file");
    assert.equal(census.paths.filter((x) => x.startsWith("src/jobs/")).length, 4, "the four bound jobs get files");
    const trace = archTrace(p);
    assert.equal(trace.present, true);
    assert.ok(trace.missing.length > 0, "the recorded run-B tree does not carry every capability — p6-arch FAILs");
    assert.equal(trace.note, "tree (1 file)", "the surviving tree is the partial/floor shape the refusal left behind");
  });

  it("run-A recorded bytes (…run-2026-09-10): every capability maps (p6-arch PASS) while the census still counts its two unbound jobs", () => {
    const p = readProject("coffeehouse2home-property-ledger.run-2026-09-10");
    const sigs = p.implementationSpec?.typeSignatures ?? [];
    assert.equal(sigs.length, 25, "precondition: the recorded run-A spec carries 25 signatures");
    const census = treeChunkPlanCensus(p, sigs);
    assert.deepEqual(census.unbound, ["track", "publish"]);
    const trace = archTrace(p);
    assert.equal(trace.missing.length, 0, "run A's five-file tree carries every typeSignature capability");
    assert.ok(trace.rows.length > 0);
  });

  it("the census partitions by LABEL, so a duplicated spec-graph label cannot double-count", () => {
    const project = {
      specGraph: {
        nodes: [
          { id: "job-0", file: "src/jobs/flip.ts", purpose: "Implement job “flip” against the contract" },
          { id: "job-1", file: "src/jobs/flip-2.ts", purpose: "Implement job “flip” against the contract" },
        ],
      },
    };
    const census = treeChunkPlanCensus(project, ["runFlip(cmd: Flip): Promise<Flip>"]);
    assert.deepEqual(census.declared, ["flip"]);
    assert.deepEqual(census.planned, ["flip"]);
    assert.deepEqual(census.unbound, []);
  });

  it("the persisted shortfall row carries the full declared/planned/unbound partition", async () => {
    const f = chunkedDeps();
    const q = await liveP6Synthesis(p6Base(LEDGER_BRIEF), f.deps);
    const row = (q.logs ?? []).find((l) => l.event === "p6.tree.shortfall");
    assert.ok(row, "the shortfall row is persisted");
    assert.match(row!.detail, /declared 4, planned 1, unbound 3/);
  });

  it("334-1 P2: the surviving unbound-declared-job shortfall row fires; the deleted reconcile row left no debris", async () => {
    // The 333-1 F-2 deletion removed the unreachable "does not reconcile" row.
    // This proves the LIVE row (an unbound declared job) survived on a real shape,
    // and that no reconcile-row debris is emitted.
    const q = await liveP6Synthesis(p6Base(LEDGER_BRIEF), chunkedDeps().deps);
    const rows = (q.logs ?? []).filter((l) => l.event === "p6.tree.shortfall");
    assert.equal(rows.length, 1, "exactly the unbound path's one row");
    assert.match(rows[0]!.detail, /declared 4, planned 1, unbound 3/);
    assert.match(rows[0]!.detail, /\btrack\b/, "a declared job with no bound signature is named");
    assert.equal(
      (q.logs ?? []).some((l) => /does not reconcile/i.test(String(l.detail ?? ""))),
      false,
      "the deleted reconcile row emits nothing",
    );
  });
});

// ---------------------------------------------------------------------------
// W48/334-1c — the minted tree-run evidence must distinguish the DECLARED
// toolchain state. Siblings 334-3 and 334-4 flagged the conflation: a tree
// whose declared typecheck/build RAN and one whose toolchain NEVER ran minted
// the same evidence hash (2834449053), defeating the just-landed first-class
// `declaredScriptsVerified` / `unverifiedDeclaredScripts` / `unverifiedEntry`
// state. The fix folds booleans + a sorted name list only (no prose) into
// `treeRunTestedEvidence`'s summary — the exact input of the mint's fnv1a.
// ---------------------------------------------------------------------------
describe("W48/334-1c tree-run mint evidence folds the declared-script state", () => {
  /** Green + executed tree-run; only the declared-script fields vary. */
  const outcome = (over: Partial<TreeRunOutcome> = {}): TreeRunOutcome =>
    ({
      ok: true,
      dir: "C:/scratch/rt-334-1c",
      compile: { ok: true, dir: "C:/scratch/rt-334-1c", checked: 2, passed: 2, failed: 0, skipped: 0, verdicts: [] },
      tests: [
        {
          file: "tests/oracle.spec.ts",
          compile: { file: "tests/oracle.spec.ts", ok: true, verdict: null },
          tests: { pass: 3, fail: 0 },
          run: "pass",
        },
      ],
      run: { kind: "ui-shell", run: "skip", detail: "UI shell - not executable headless" },
      ...over,
    }) as unknown as TreeRunOutcome;
  const hashOf = (o: TreeRunOutcome): string => String(fnv1a(treeRunTestedEvidence(o).summary));

  it("a verified and an unverified toolchain no longer mint the same evidence hash", () => {
    const verified = outcome({ declaredScriptsVerified: true, unverifiedDeclaredScripts: [] });
    const unverified = outcome({ declaredScriptsVerified: false, unverifiedDeclaredScripts: ["typecheck", "build"] });
    assert.equal(treeRunTestedEvidence(verified).executed, true, "both are genuinely executed runs");
    assert.equal(treeRunTestedEvidence(unverified).executed, true);
    assert.notEqual(hashOf(verified), hashOf(unverified), "the two toolchain states mint DIFFERENT hashes");
    // The sorted name list is in the evidence, canonical regardless of input order.
    assert.match(treeRunTestedEvidence(unverified).summary, /declared-scripts unverified \[build, typecheck\]/);
    assert.equal(
      hashOf(outcome({ declaredScriptsVerified: false, unverifiedDeclaredScripts: ["build", "typecheck"] })),
      hashOf(unverified),
      "a reordered name list hashes identically (canonical order)",
    );
  });

  it("an entry skip is its own decisive factor; the default state keeps its prior bytes", () => {
    const dflt = outcome();
    // Pre-334-1c hash for this exact green executed shape (reproduced, not cited).
    assert.equal(hashOf(dflt), "2834449053", "a run with no declared-script signal keeps the pre-change hash");
    assert.equal(
      hashOf(outcome({ declaredScriptsVerified: true, unverifiedDeclaredScripts: [] })),
      "2834449053",
      "fully declared-verified hashes like the default (no token)",
    );
    assert.notEqual(hashOf(outcome({ unverifiedEntry: "UI shell - not executable headless" })), hashOf(dflt), "the entry skip is decisive");
    assert.match(treeRunTestedEvidence(outcome({ unverifiedEntry: "why" })).summary, /entry-skipped/);
    assert.equal(hashOf(dflt), hashOf(outcome()), "deterministic across invocations");
  });

  it("the real mint seam writes the distinct evidence hashes onto lastTest", () => {
    const base = (): Project => emptyProject({ name: "Mint334", brief: "A dispatch board for field service." });
    const verified = mintTreeRunTested(base(), outcome({ declaredScriptsVerified: true, unverifiedDeclaredScripts: [] }));
    const unverified = mintTreeRunTested(base(), outcome({ declaredScriptsVerified: false, unverifiedDeclaredScripts: ["typecheck", "build"] }));
    const vh = (verified.lastTest as { evidenceHash?: string } | null)?.evidenceHash;
    const uh = (unverified.lastTest as { evidenceHash?: string } | null)?.evidenceHash;
    assert.ok(vh && uh, "both states still mint a tested verdict");
    assert.notEqual(vh, uh, "the P6 DoD's proof artifact distinguishes the toolchain states");
  });
});


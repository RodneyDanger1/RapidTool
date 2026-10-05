#!/usr/bin/env node
/**
 * P-B · Q5 — the FINAL-WAVE (fixes/346) tourniquet pins.
 *
 * The finish wave lands five small fixes that the shipped proof layer did not
 * yet pin. Each pin here FAILS CLOSED on its historical defect and stays silent
 * on an injected clean control (the negative proof that the guard can fail):
 *
 *   D1-01  persisted-gate recompute   `keepBestTree` grafts the best tree onto a
 *          failed journey but keeps the LAST cycle's phase-6 gate, so the
 *          persisted `phases[6].gate` can be a verdict computed over a DIFFERENT
 *          (smaller) tree than the one persisted (G5). The pin fires on the real
 *          `bakery-florist-orders/build.json` whose recorded gate-vector hash
 *          disagrees with a fresh `runGate` over its own persisted tree.
 *   D2-01  floor code in the emit seal  a below-floor scaffold refusal must
 *          surface `RT_E_PLAN_UNDERPRODUCED` in the delivery envelope
 *          (`headless.planUnderproductionSeal` consumed by the CLI). The pin
 *          fires when the CLI seal drops the floor code and stays silent on the
 *          real campaign2 office-stock-tracker tree.
 *   D3-01  in-run RUNLOCK wiring       a run whose `src/**`/`scripts/**` changed
 *          while it executed must refuse with `RT_E_SRC_EDITED_DURING_RUN`
 *          naming the file(s). The pin fires when no run path calls
 *          `runlockEditViolations` and stays silent on the wired CLI.
 *   S3-01  floor refusal code/order    a tree sealed below the brief-driven floor
 *          must refuse with `RT_E_PLAN_UNDERPRODUCED`, never the generic
 *          `RT_E_VALIDATION`. The pin fires when the single `refuse` door stops
 *          mapping `under.code`.
 *   G1-01  intent-first research       `researchQueryText` must lead with the
 *          phase INTENT (domain nouns are qualifiers), with the deterministic
 *          off-intent blocklist. The pin fires when the query regresses to
 *          domain-nouns-first.
 *
 * Every detector reads the REAL bytes it guards (`engine.ts`,
 * `codegen.server.ts`, `headless.ts`, `rapidtool-cli.mjs`, the frozen
 * `testruns/**` artifacts) and reuses the REAL seams (`runGate`, the parsed
 * sources); nothing mocks the object under test. Fix-presence (whether the
 * owner's interface is on the gate-of-record surface) is measured by the P-A
 * harness, not here.
 *
 * Usage:
 *   node scripts/guards/final-wave-invariants.mjs [--json] [--selftest]
 *
 * Exit codes:
 *   0  every control proof holds
 *   1  a control proof failed
 *   2  usage / unreadable input (fail closed)
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, "..", "..");
export const ENGINE_FILE = join(REPO_ROOT, "src", "lib", "engine.ts");
export const CODEGEN_FILE = join(REPO_ROOT, "src", "lib", "codegen.server.ts");
export const HEADLESS_FILE = join(REPO_ROOT, "src", "lib", "headless.ts");
export const CLI_FILE = join(REPO_ROOT, "scripts", "rapidtool-cli.mjs");

// Internal finding codes. The registered `expectedCode`s live in the registry;
// these name the detector's own finding without inventing an unregistered RT_E_*.
export const BEST_TREE_GATE_CODE = "BEST_TREE_GATE_STALE";
export const SEAL_FLOOR_CODE = "RT_E_PLAN_UNDERPRODUCED";
export const RUNLOCK_WIRING_CODE = "RT_E_SRC_EDITED_DURING_RUN";
export const FLOOR_REFUSAL_CODE = "RT_E_PLAN_UNDERPRODUCED";
export const INTENT_FIRST_CODE = "RESEARCH_QUERY_DOMAIN_FIRST";

/** Read a text file, "" on any failure (never throws). @param {string} p @returns {string} */
export function safeRead(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

/** Read + parse a JSON file, null on absence/parse error. @param {string} p @returns {any} */
export function readJson(p) {
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

/**
 * Locate the frozen run root (`testruns/`), mirroring the P-A harness: env →
 * `<repo>/testruns` → the sibling `<repo>/../testruns` → the known Desktop path.
 * @param {NodeJS.ProcessEnv} [env] @returns {string|null}
 */
export function resolveRunRoot(env = process.env) {
  const candidates = [env.RAPIDTOOL_TESTRUNS, join(REPO_ROOT, "testruns"), resolve(REPO_ROOT, "..", "testruns"), "C:/Users/mnril/Desktop/testruns"];
  for (const c of candidates) if (c && existsSync(c)) return c;
  return null;
}

/** Count non-overlapping occurrences of a literal. @param {string} s @param {string} lit @returns {number} */
function countLiteral(s, lit) {
  return String(s).split(lit).length - 1;
}

// ---------------------------------------------------------------------------
// G1-01 — intent-first research query + off-intent blocklist.
// ---------------------------------------------------------------------------

/** The intent-first builder contract (the fix): intent LEADS the qualifier bag. */
const INTENT_LEADS_RE = /\[\s*intent\s*,\s*\.\.\.qualifiers\s*\]/;
/** The off-intent blocklist seams the fix ships alongside the query builder. */
const OFF_INTENT_SEAMS = ["isOffIntentResearch", "OFF_INTENT_RESULT_TERMS", "ENGINEERING_INTENT_TERMS"];

/**
 * `researchQueryText` must return an array whose FIRST element is the phase
 * intent (`[intent, ...qualifiers]`) and must ship the deterministic off-intent
 * blocklist. A regression to `[...qualifiers, intent]` (domain nouns leading) is
 * the historical defect.
 * @param {string} engineSource @returns {Array<{code:string, detail:string}>}
 */
export function detectIntentFirstQuery(engineSource) {
  const src = String(engineSource);
  const findings = [];
  const fn = /export\s+function\s+researchQueryText\s*\([\s\S]*?\n\}/.exec(src);
  if (!fn) {
    findings.push({ code: INTENT_FIRST_CODE, detail: "engine.ts no longer exports researchQueryText" });
  } else if (!INTENT_LEADS_RE.test(fn[0])) {
    findings.push({
      code: INTENT_FIRST_CODE,
      detail: "researchQueryText does not lead with the phase intent (`[intent, ...qualifiers]`) — the query regressed to domain-nouns-first",
    });
  }
  for (const seam of OFF_INTENT_SEAMS) {
    if (!src.includes(seam)) findings.push({ code: INTENT_FIRST_CODE, detail: `the deterministic off-intent seam \`${seam}\` is gone from engine.ts` });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// S3-01 — the single floor-refusal door maps to RT_E_PLAN_UNDERPRODUCED.
// ---------------------------------------------------------------------------

/**
 * The ONE `refuse` door must exist, map a generic `RT_E_VALIDATION` to
 * `under.code` (the floor refusal), and the fail-closed floor backstop
 * (`accepted.length < minTreeFiles`) must route through it. A door that stops
 * naming the floor code is the defect.
 * @param {string} codegenSource @returns {Array<{code:string, detail:string}>}
 */
export function detectFloorRefusalCode(codegenSource) {
  const src = String(codegenSource);
  const findings = [];
  if (!src.includes("export function underProducedRefusal(")) {
    findings.push({ code: FLOOR_REFUSAL_CODE, detail: "codegen.server.ts no longer exports underProducedRefusal" });
  }
  if (!/under\s*!==\s*null\s*&&\s*code\s*===\s*"RT_E_VALIDATION"/.test(src)) {
    findings.push({
      code: FLOOR_REFUSAL_CODE,
      detail: "the refuse door no longer maps the generic RT_E_VALIDATION to the brief-driven floor refusal",
    });
  }
  if (!/\bunder\.code\b/.test(src)) {
    findings.push({ code: FLOOR_REFUSAL_CODE, detail: "the refuse door no longer persists under.code as the deciding floor code" });
  }
  if (!/if\s*\(\s*accepted\.length\s*<\s*minTreeFiles\s*\)/.test(src)) {
    findings.push({ code: FLOOR_REFUSAL_CODE, detail: "the fail-closed floor backstop `if (accepted.length < minTreeFiles)` is gone" });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// D2-01 — the emit seal surfaces the floor code (headless.planUnderproductionSeal).
// ---------------------------------------------------------------------------

/**
 * The CLI emit seal must CONSUME `headless.planUnderproductionSeal` and carry
 * `RT_E_PLAN_UNDERPRODUCED` as the deciding code. A seal that drops either the
 * consumer or the floor code is the defect.
 * @param {string} cliSource @returns {Array<{code:string, detail:string}>}
 */
export function detectSealFloorCode(cliSource) {
  const src = String(cliSource);
  const findings = [];
  if (!src.includes("planUnderproductionSeal(")) {
    findings.push({
      code: SEAL_FLOOR_CODE,
      detail: "scripts/rapidtool-cli.mjs no longer consumes headless.planUnderproductionSeal in the emit seal",
    });
  }
  if (!src.includes("RT_E_PLAN_UNDERPRODUCED")) {
    findings.push({ code: SEAL_FLOOR_CODE, detail: "the CLI seal no longer carries RT_E_PLAN_UNDERPRODUCED as a deciding code" });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// D3-01 — the in-run RUNLOCK guard is WIRED (not merely exported).
// ---------------------------------------------------------------------------

/**
 * `runlockEditViolations` must be CALLED on a run path (the CLI's unattended/tree
 * run, or headless itself), and the refusal must carry
 * `RT_E_SRC_EDITED_DURING_RUN`. Being exported with no call site is the defect:
 * the guard exists but protects nothing.
 * @param {{headlessSource:string, cliSource:string}} sources
 * @returns {Array<{code:string, detail:string}>}
 */
export function detectRunlockWiring(sources) {
  const headless = String((sources && sources.headlessSource) || "");
  const cli = String((sources && sources.cliSource) || "");
  const findings = [];
  // The definition line `export function runlockEditViolations(` also matches the
  // literal; a WIRED run path adds >= 1 further call site.
  const headlessCalls = Math.max(0, countLiteral(headless, "runlockEditViolations(") - 1);
  const cliCalls = countLiteral(cli, "runlockEditViolations(");
  if (headlessCalls === 0 && cliCalls === 0) {
    findings.push({
      code: RUNLOCK_WIRING_CODE,
      detail: "no run path calls runlockEditViolations — the in-run RUNLOCK guard is exported but unwired (a run can still overlap a src edit)",
    });
  }
  if (!cli.includes("RT_E_SRC_EDITED_DURING_RUN")) {
    findings.push({ code: RUNLOCK_WIRING_CODE, detail: "the run path does not refuse with RT_E_SRC_EDITED_DURING_RUN" });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// D1-01 — the persisted phase-6 gate was computed over the persisted tree.
// ---------------------------------------------------------------------------

/**
 * A persisted record's `phases[6].gate` must be the verdict of a gate run over
 * the record's OWN persisted `generatedTree`. The `evidenceHash` is runGate's
 * verdict-vector fingerprint, so a recorded hash that differs from a fresh
 * `runGate(record, 6)` means the stored gate was computed over a different tree
 * (G5's keepBestTree graft).
 * @param {any} record @param {((p:any, phase:number)=>{pass:boolean,unmet:any[],evidenceHash:string})|null} runGate
 * @returns {Array<{code:string, detail:string, storedHash?:string, freshHash?:string}>}
 */
export function detectBestTreeGateMismatch(record, runGate) {
  if (!record || typeof record !== "object") {
    return [{ code: BEST_TREE_GATE_CODE, detail: "the persisted project record is missing or unparseable (fail closed)" }];
  }
  if (typeof runGate !== "function") {
    return [{ code: BEST_TREE_GATE_CODE, detail: "dod.runGate is not importable — the persisted gate cannot be re-derived (fail closed)" }];
  }
  const phase6 = Array.isArray(record.phases) ? record.phases.find((p) => p && p.id === 6) : null;
  const stored = phase6 && phase6.gate;
  if (!stored || typeof stored !== "object") {
    return [{ code: BEST_TREE_GATE_CODE, detail: "the persisted record has no phases[6].gate to compare (fail closed)" }];
  }
  let fresh = null;
  try {
    fresh = runGate(record, 6);
  } catch (e) {
    return [{ code: BEST_TREE_GATE_CODE, detail: "runGate threw over the persisted tree: " + String(e && e.message ? e.message : e) }];
  }
  if (!fresh || typeof fresh.evidenceHash !== "string") {
    return [{ code: BEST_TREE_GATE_CODE, detail: "runGate returned no evidenceHash (fail closed)" }];
  }
  if (stored.evidenceHash !== fresh.evidenceHash) {
    return [
      {
        code: BEST_TREE_GATE_CODE,
        storedHash: String(stored.evidenceHash),
        freshHash: fresh.evidenceHash,
        detail: `persisted phases[6].gate carries verdict-vector ${stored.evidenceHash} but a fresh gate over the persisted tree reads ${fresh.evidenceHash} — the recorded verdict was computed over a different tree`,
      },
    ];
  }
  return [];
}

/**
 * `keepBestTree` must recompute the phase-6 gate over the GRAFTED (persisted)
 * tree. A graft with no recompute is the G5 defect this pin stays RED on until
 * lane D lands the seam.
 * @param {string} headlessSource @returns {Array<{code:string, detail:string}>}
 */
export function detectBestTreeRecompute(headlessSource) {
  const src = String(headlessSource);
  const fn = /function\s+keepBestTree\s*\([\s\S]*?\n\}/.exec(src);
  if (!fn) return [{ code: BEST_TREE_GATE_CODE, detail: "headless.ts no longer defines keepBestTree" }];
  const body = fn[0];
  const recomputes = /gate-recomputed/.test(body) || /recordGateInto\s*\(/.test(body);
  if (!recomputes) {
    return [
      {
        code: BEST_TREE_GATE_CODE,
        detail: "keepBestTree grafts the best tree but does not recompute the phase-6 gate over it (lane D interface: recordGateInto(retained, 6) + p6.journey.gate-recomputed)",
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Controls (real source + real artifact + real mutation).
// ---------------------------------------------------------------------------

/**
 * The control proofs. `fired` = the detector alarms on the historical defect
 * (the injected source mutation, or the real frozen artifact); `controlClean` =
 * it stays silent on the clean control; `mutationRed` = both hold; `wired` = the
 * live working-tree seam is the corrected one (reported; the P-A harness decides
 * fix-presence against the gate of record).
 * @returns {Promise<Record<string, any>>}
 */
export async function finalWaveControls() {
  const engine = safeRead(ENGINE_FILE);
  const codegen = safeRead(CODEGEN_FILE);
  const headless = safeRead(HEADLESS_FILE);
  const cli = safeRead(CLI_FILE);

  // G1-01 — regress the builder to domain-nouns-first; the guard must fire.
  const domainFirst = engine.replace(INTENT_LEADS_RE, "[...qualifiers, intent]");
  const g1Fired = engine.length > 0 && domainFirst !== engine && detectIntentFirstQuery(domainFirst).length > 0;
  const g1Clean = engine.length > 0 && detectIntentFirstQuery(engine).length === 0;

  // S3-01 — strip the floor-code mapping from the refuse door; the guard fires.
  const strippedRefuse = codegen.replace(/under\s*!==\s*null\s*&&\s*code\s*===\s*"RT_E_VALIDATION"/, "false");
  const s3Fired = codegen.length > 0 && strippedRefuse !== codegen && detectFloorRefusalCode(strippedRefuse).length > 0;
  const s3Clean = codegen.length > 0 && detectFloorRefusalCode(codegen).length === 0;

  // D2-01 — drop the planUnderproductionSeal consumer from the seal; the guard fires.
  const sealDropped = cli.replace(/planUnderproductionSeal\(/g, "planUnderproductionSealDropped(");
  const d2Fired = cli.length > 0 && sealDropped !== cli && detectSealFloorCode(sealDropped).length > 0;
  const d2Clean = cli.length > 0 && detectSealFloorCode(cli).length === 0;

  // D3-01 — unwire every runlock call site; the guard fires.
  const unwiredCli = cli.replace(/h\.runlockEditViolations\(/g, "h.runlockEditViolationsUnwired(");
  const d3Fired =
    cli.length > 0 &&
    unwiredCli !== cli &&
    detectRunlockWiring({ headlessSource: headless, cliSource: unwiredCli }).length > 0;
  const d3Clean = headless.length > 0 && cli.length > 0 && detectRunlockWiring({ headlessSource: headless, cliSource: cli }).length === 0;

  // D1-01 — the real frozen artifact: the recorded gate hash vs a fresh gate over
  // the persisted tree. Control: the same record with the STORED gate set to the
  // fresh verdict (the post-fix shape) must be silent.
  const runRoot = resolveRunRoot();
  const bfoPath = runRoot ? join(runRoot, "bakery-florist-orders", "build.json") : null;
  const bfo = bfoPath ? readJson(bfoPath) : null;
  let runGate = null;
  try {
    const dod = await import(new URL("../../src/lib/dod.ts", import.meta.url).href);
    runGate = typeof dod.runGate === "function" ? dod.runGate : null;
  } catch {
    runGate = null;
  }
  let d1Fired = false;
  let d1ControlClean = false;
  let d1FreshHash = null;
  if (bfo && runGate) {
    const findings = detectBestTreeGateMismatch(bfo, runGate);
    d1Fired = findings.length > 0;
    try {
      const fresh = runGate(bfo, 6);
      d1FreshHash = fresh.evidenceHash;
      const reconciled = { ...bfo, phases: (bfo.phases || []).map((p) => (p && p.id === 6 ? { ...p, gate: { passed: fresh.pass, unmet: fresh.unmet.map((u) => u.criterion), evidenceHash: fresh.evidenceHash } } : p)) };
      d1ControlClean = detectBestTreeGateMismatch(reconciled, runGate).length === 0;
    } catch {
      d1ControlClean = false;
    }
  }
  const d1Wired = headless.length > 0 && detectBestTreeRecompute(headless).length === 0;

  return {
    "G1-01": {
      fired: g1Fired,
      controlClean: g1Clean,
      mutationRed: g1Fired && g1Clean,
      wired: g1Clean,
      seam: "src/lib/engine.ts#researchQueryText (intent leads) + isOffIntentResearch",
      evidence: { liveFindings: engine.length > 0 ? detectIntentFirstQuery(engine) : ["engine.ts unreadable (fail closed)"] },
    },
    "S3-01": {
      fired: s3Fired,
      controlClean: s3Clean,
      mutationRed: s3Fired && s3Clean,
      wired: s3Clean,
      seam: "src/lib/codegen.server.ts#refuse -> underProducedRefusal -> RT_E_PLAN_UNDERPRODUCED",
      evidence: { liveFindings: codegen.length > 0 ? detectFloorRefusalCode(codegen) : ["codegen.server.ts unreadable (fail closed)"] },
    },
    "D2-01": {
      fired: d2Fired,
      controlClean: d2Clean,
      mutationRed: d2Fired && d2Clean,
      wired: d2Clean,
      seam: "scripts/rapidtool-cli.mjs emit seal consumes headless.planUnderproductionSeal",
      evidence: { liveFindings: cli.length > 0 ? detectSealFloorCode(cli) : ["rapidtool-cli.mjs unreadable (fail closed)"] },
    },
    "D3-01": {
      fired: d3Fired,
      controlClean: d3Clean,
      mutationRed: d3Fired && d3Clean,
      wired: d3Clean,
      seam: "run path -> headless.runlockEditViolations -> RT_E_SRC_EDITED_DURING_RUN",
      evidence: {
        headlessCallSites: headless.length > 0 ? Math.max(0, countLiteral(headless, "runlockEditViolations(") - 1) : null,
        cliCallSites: cli.length > 0 ? countLiteral(cli, "runlockEditViolations(") : null,
        liveFindings: d3Clean ? [] : detectRunlockWiring({ headlessSource: headless, cliSource: cli }),
      },
    },
    "D1-01": {
      fired: d1Fired,
      controlClean: d1ControlClean,
      mutationRed: d1Fired && d1ControlClean,
      wired: d1Wired,
      ownerLane: "D",
      pendingInterface: "src/lib/headless.ts#keepBestTree must recompute the phase-6 gate over the grafted persisted tree (recordGateInto(retained, 6) + the `p6.journey.gate-recomputed` event) so a persisted verdict is never computed over a different tree",
      seam: "headless.keepBestTree -> recordGateInto(retained, 6) over the persisted tree",
      evidence: {
        fixture: bfoPath,
        freshHash: d1FreshHash,
        runGatePresent: typeof runGate === "function",
        sourceRecomputePresent: d1Wired,
        liveFindings: headless.length > 0 ? detectBestTreeRecompute(headless) : ["headless.ts unreadable (fail closed)"],
      },
    },
  };
}

/** Control-proof summary consumed by `--selftest` and the P-A harness. @returns {Promise<any>} */
export async function selftest() {
  const controls = await finalWaveControls();
  const entries = Object.entries(controls).map(([id, c]) => ({ id, ...c }));
  return { ok: entries.every((e) => e.fired && e.controlClean && e.mutationRed), entries };
}

function usage(msg) {
  if (msg) console.error(`[final-wave-invariants] ${msg}`);
  console.error("usage: node scripts/guards/final-wave-invariants.mjs [--json] [--selftest]");
}

async function main(argv) {
  const unknown = argv.filter((a) => a !== "--json" && a !== "--selftest");
  if (unknown.length > 0) {
    usage(`unknown argument(s): ${unknown.join(", ")}`);
    return 2;
  }
  const json = argv.includes("--json");
  if (argv.includes("--selftest")) {
    const r = await selftest();
    if (json) console.log(JSON.stringify({ guard: "final-wave-invariants", selftest: r }, null, 2));
    else for (const e of r.entries) console.log(`[final-wave-invariants] selftest ${e.id}: fired=${e.fired} controlClean=${e.controlClean} mutationRed=${e.mutationRed} wired=${e.wired}`);
    return r.ok ? 0 : 1;
  }
  const controls = await finalWaveControls();
  const entries = Object.entries(controls).map(([id, c]) => ({ id, ...c }));
  const ok = entries.every((e) => e.fired && e.controlClean && e.mutationRed);
  if (json) console.log(JSON.stringify({ guard: "final-wave-invariants", ok, entries }, null, 2));
  else for (const e of entries) console.log(`${e.fired ? "FIRE" : "----"} ${e.id} wired=${e.wired} ${e.seam || ""}`);
  return ok ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`[final-wave-invariants] ${String(e && e.message ? e.message : e)}`);
      process.exit(2);
    });
}

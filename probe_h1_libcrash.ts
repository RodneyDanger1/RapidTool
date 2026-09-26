// TEMP PROBE (H1, W26) — hostile-but-real input sweep over src/lib non-core modules.
// Deleted after the run; not product code.
import { phaseHandoff } from "./src/lib/handoff.ts";
import { seedProject } from "./src/lib/testing/fixtures.ts";
import * as vault from "./src/lib/vault.ts";
import * as swarm from "./src/lib/swarm.ts";
import * as bench from "./src/lib/bench.ts";
import * as ast from "./src/lib/ast-mine.ts";
import * as algs from "./src/lib/algorithms.ts";
import * as ri from "./src/lib/report-intake.ts";
import * as rt from "./src/lib/rt-timeline.ts";
import * as comp from "./src/lib/compaction.ts";
import * as tl from "./src/lib/token-ledger.ts";
import { createPluginRegistry } from "./src/lib/plugin.ts";
import * as harvest from "./src/lib/harvest.ts";
import * as verify from "./src/lib/verify.ts";
import * as ws from "./src/lib/write-set.ts";
import * as pat from "./src/lib/patch.ts";

type C = { name: string; run: () => unknown };
const cases: C[] = [];
const c = (name: string, run: () => unknown) => cases.push({ name, run });

const seed = seedProject();
// Realistic hand-edited / foreign variants (bytes a hand edit or older version can hold).
const junk = (patch: Record<string, unknown>) =>
  ({ ...(seed as unknown as Record<string, unknown>), ...patch }) as never;

// --- handoff (claims robustness to foreign objects) --------------------------
c("handoff.brief-number", () => phaseHandoff(junk({ brief: 42 }), 0));
c("handoff.brief-null", () => phaseHandoff(junk({ brief: null }), 0));
c("handoff.name-missing", () => phaseHandoff(junk({ name: undefined }), 0));
c("handoff.lattice-constraints-string", () =>
  phaseHandoff(junk({ lattice: { constraints: "abc" } }), 0));
c("handoff.schedule-bad-extraHitl", () =>
  phaseHandoff(junk({ schedule: { tightness: 5, securityDelta: 1, apiDelta: 1, extraHitl: null } }), 0));
c("handoff.artifacts-junk-rows", () =>
  phaseHandoff(junk({ artifacts: [null, 7, { phase: 0 }, { phase: 0, kind: null, title: 5, body: 42 }] }), 0));
c("handoff.phase-12-terminal", () => phaseHandoff(seed, 12));
c("handoff.project-null", () => phaseHandoff(null as never, 0));

// --- vault ------------------------------------------------------------------
c("vault.buildVaultNotes-seed", () => vault.buildVaultNotes(seed));
c("vault.buildVaultNotes-junk-memory", () =>
  vault.buildVaultNotes(junk({ memory: [null, 5, { id: 3 }] })));
c("vault.dailyNote-seed", () => vault.dailyNote(seed));
c("vault.dailyNote-bad-date", () => vault.dailyNote(seed, "not-a-date"));
c("vault.dailyNote-empty-string", () => vault.dailyNote(seed, ""));
c("vault.lessonNote-p12", () => vault.lessonNote(seed, 12));
c("vault.searchVaultScored-empty-query", () => vault.searchVaultScored(vault.buildVaultNotes(seed), ""));
c("vault.searchVaultScored-regex-chars", () =>
  vault.searchVaultScored(vault.buildVaultNotes(seed), "a.*[b](c)+\\"));
c("vault.vaultIndex-empty", () => vault.vaultIndex([]));
c("vault.backlinksFor-empty", () => vault.backlinksFor([], "x"));
c("vault.backlinksFor-junk-notes", () => vault.backlinksFor([null, 5] as never, "x"));

// --- swarm ------------------------------------------------------------------
c("swarm.parallelDag-seed", () => swarm.parallelDag(seed));
c("swarm.branchSuggest-seed", () => swarm.branchSuggest(seed));
c("swarm.swarmPlan-seed", () => swarm.swarmPlan(seed));
c("swarm.scanForMarkers-null", () => swarm.scanForMarkers(null as never));
c("swarm.scanForMarkers-empty", () => swarm.scanForMarkers(""));
c("swarm.seatsForPhase-12", () => swarm.seatsForPhase(12));
c("swarm.phaseRecord-missing-phase", () => swarm.phaseRecord(junk({ phases: [] }), 5));

// --- bench ------------------------------------------------------------------
c("bench.projectedTime-empty", () => bench.projectedTime({} as never));
c("bench.projectedTime-null", () => bench.projectedTime(null as never));
c("bench.estimateTokenCost-null", () => bench.estimateTokenCost(null as never));
c("bench.complexityScore-null", () => bench.complexityScore(null as never));
c("bench.failurePointScan-null", () => bench.failurePointScan(null as never));
c("bench.failurePointScan-junk-artifacts", () =>
  bench.failurePointScan(junk({ artifacts: [null, { body: 42 }], phases: [null] })));
c("bench.stripStringsAndComments-unterminated", () =>
  bench.stripStringsAndComments("const a = 'unterminated\n/* unterminated"));
c("bench.participatedPhases-null", () => bench.participatedPhases(null as never));

// --- ast-mine ---------------------------------------------------------------
c("ast.mineCodebase-empty", () => ast.mineCodebase([]));
c("ast.mineCodebase-junk-file", () => ast.mineCodebase([{ path: "a.ts", body: "" }] as never));
c("ast.mineCodebase-bad-body", () => ast.mineCodebase([{ path: "a.ts", body: 42 }] as never));
c("ast.conventionsMap-empty", () => ast.conventionsMap("p", []));
c("ast.respectConventions-empty", () => ast.respectConventions({ conventions: [] } as never, ast.conventionsMap("p", [])));
c("ast.nameStyle-empty", () => ast.nameStyle(""));

// --- algorithms -------------------------------------------------------------
c("algs.intentLattice-empty-brief", () => algs.intentLattice("", "app"));
c("algs.contiguousRun-empty", () => algs.contiguousRun([], []));
c("algs.fusionRank-empty", () => algs.fusionRank([], "", 5));
c("algs.tokenizeWords-empty", () => algs.tokenizeWords(""));
c("algs.stemToken-empty", () => algs.stemToken(""));
c("algs.canonicalStem-empty", () => algs.canonicalStem(""));
c("algs.estimateTokens-empty", () => algs.estimateTokens(""));
c("algs.fnv1a-empty", () => algs.fnv1a(""));
c("algs.runAlgorithms-junk-project", () =>
  algs.runAlgorithms({ brief: 42, domain: null, memory: null, currentPhase: 12 } as never));
c("algs.librariesFor-empty", () => algs.librariesFor("", "app" as never));

// --- report-intake ----------------------------------------------------------
c("ri.validateReport-null", () => ri.validateReport(null));
c("ri.validateReport-phase-13", () => ri.validateReport({ phase: 13, status: "complete", summary: "x" }));
c("ri.validateReport-phase-matches", () => ri.validateReport({ phase: 0, status: "complete", summary: "x" }, 0));
c("ri.applyReportResult-seed", () => {
  const v = ri.validateReport({ phase: 0, status: "complete", summary: "s" });
  return v.ok ? ri.applyReportResult(seed, v.report) : v;
});

// --- rt-timeline ------------------------------------------------------------
c("rt.parseTimeline-null", () => rt.parseTimeline(null as never));
c("rt.parseTimeline-junk-lines", () => rt.parseTimeline(["", "not json", "{}", '{"partial":']));
c("rt.summarizeTimeline-empty", () => rt.summarizeTimeline([]));

// --- compaction / token-ledger / plugin -------------------------------------
c("comp.clampToolOutput-huge-max", () => comp.clampToolOutput("abc", 1e21));
c("comp.clampToolOutput-NaN-max", () => comp.clampToolOutput("abc", NaN));
c("comp.renderCompactionSummary-junk", () => comp.renderCompactionSummary(null as never));
c("tl.recordSpend-junk", () => tl.recordSpend(tl.emptyLedger(), { promptTokens: "x" } as never));
c("tl.estimateCostUsd-junk", () => tl.estimateCostUsd({ promptTokens: 10, completionTokens: 5 } as never, null as never));
c("tl.totalTokens-junk", () => tl.totalTokens(null as never));
c("plugin.register-junk", () => createPluginRegistry().register(null as never));
c("plugin.dispatch-junk", () => {
  const r = createPluginRegistry();
  r.register({ id: "h", apiVersion: 1, kind: "pre-phase", run: () => undefined } as never);
  return r.dispatch("pre-phase", {}, {} as never);
});

// --- harvest / verify / write-set / patch ------------------------------------
c("harvest.extractPatterns-junk", () => harvest.extractPatterns(null as never));
c("harvest.trendNotes-junk", () => harvest.trendNotes("b", [null, 5] as never));
c("verify.withCommonJsExports-junk", () => verify.withCommonJsExports(null as never));
c("verify.applyVerifyOutcome-junk", () => verify.applyVerifyOutcome(seed, null as never));
c("ws.assertSafeRelPath-empty", () => ws.assertSafeRelPath(""));
c("ws.assertSafeRelPath-dotdot", () => ws.assertSafeRelPath("../x"));
c("ws.assertSafeRelPath-tilde", () => ws.assertSafeRelPath("~/x"));
c("pat.parsePatch-junk", () => (pat as unknown as Record<string, unknown>).parsePatch ? ((pat as unknown as Record<string, (s: string) => unknown>).parsePatch(null as never)) : "no-such-export");

let throws = 0;
for (const { name, run } of cases) {
  try {
    run();
  } catch (err) {
    throws++;
    const e = err as Error;
    const at = (e.stack ?? "").split("\n").find((l) => l.includes("src/lib")) ?? "";
    console.log(`THROW ${name} :: ${e.constructor.name}: ${e.message} @${at.trim()}`);
  }
}
console.log(`\nprobe done — cases=${cases.length} throws=${throws}`);

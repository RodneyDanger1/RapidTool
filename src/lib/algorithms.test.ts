// ---------------------------------------------------------------------------
// Algorithm repairs suite (R2/R6/R7/R8 + B-21) — algorithms.test.ts
// Run: node --experimental-strip-types --test src/lib/algorithms.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalStem,
  contiguousRun,
  deriveTypeSignatures,
  estimateTokens,
  feasibilityScorecard,
  fnv1a,
  fusionRank,
  intentLattice,
  librariesFor,
  routeCrew,
  runAlgorithms,
  scheduleConstraints,
  stemToken,
  synthesizeContracts,
  tokenizeWords,
} from "./algorithms.ts";
import type { CrewRole, CrewSeat, IntentLattice, MemoryEntry } from "./types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lattice(over: Partial<IntentLattice> = {}): IntentLattice {
  return {
    domain: "custom-software",
    jobs: ["track"],
    entities: ["order"],
    constraints: [],
    nodes: [],
    complexity: 4,
    ...over,
  };
}

function mem(id: string, kind: MemoryEntry["kind"], text: string, score: number): MemoryEntry {
  return { id, kind, phase: 0, text, score };
}

function scorecard(l: IntentLattice) {
  return feasibilityScorecard(l, scheduleConstraints(l, l.domain));
}

function activeRoles(seats: CrewSeat[]): CrewRole[] {
  return seats.filter((s) => s.active).map((s) => s.role);
}

const ORDER_FIELDS = [
  // fixes/121: neutral work-order shape (marketplace buyer/totalCents removed).
  { name: "id", type: "ulid" },
  { name: "title", type: "string" },
  { name: "status", type: "enum" },
  { name: "note", type: "string" },
];

const JOB_FIELDS = [
  { name: "id", type: "ulid" },
  { name: "assigneeId", type: "ulid" },
  { name: "slaDue", type: "datetime" },
  { name: "status", type: "enum" },
];

const DEFAULT_FIELDS = [
  { name: "id", type: "ulid" },
  { name: "status", type: "enum" },
  { name: "updatedAt", type: "datetime" },
];

// ---------------------------------------------------------------------------
// R7/B-15 — stemToken
// ---------------------------------------------------------------------------

describe("stemToken", () => {
  it("stems route and routing to the same canonical form", () => {
    assert.equal(stemToken("route"), "rout");
    assert.equal(stemToken("routing"), "rout");
    assert.equal(stemToken("route"), stemToken("routing"));
  });

  it("stems scanning and scans to scan", () => {
    assert.equal(stemToken("scanning"), "scan");
    assert.equal(stemToken("scans"), "scan");
    assert.equal(stemToken("scan"), "scan");
  });

  it("stems jobs to job", () => {
    assert.equal(stemToken("jobs"), "job");
    assert.equal(stemToken("job"), "job");
  });

  it("never confuses tech with technology (no prefix truncation)", () => {
    assert.equal(stemToken("tech"), "tech");
    assert.equal(stemToken("technology"), "technology");
    assert.notEqual(stemToken("technology"), stemToken("tech"));
  });

  it("stems invoice and invoicing identically", () => {
    assert.equal(stemToken("invoice"), "invoic");
    assert.equal(stemToken("invoicing"), "invoic");
  });
});

// ---------------------------------------------------------------------------
// R7/B-15 — tokenizeWords
// ---------------------------------------------------------------------------

describe("tokenizeWords", () => {
  it("splits on word boundaries, lowercases, and stems each token", () => {
    assert.deepEqual(tokenizeWords("Scanning routing"), ["scan", "rout"]);
    assert.deepEqual(tokenizeWords("jobs tracking"), ["job", "track"]);
  });

  it("splits hyphenated compounds into stemmed words (P0-A: file-renamer → file+renamer)", () => {
    assert.deepEqual(tokenizeWords("same-day air-gapped follow-up"), [
      "sam", // PB-01: trailing-e canonicalization (same ≡ sames)
      "day",
      "air",
      "gap",
      "follow",
      "up",
    ]);
  });

  it("handles mixed case", () => {
    assert.deepEqual(tokenizeWords("SCAN Job"), ["scan", "job"]);
  });
});

// ---------------------------------------------------------------------------
// R7/B-15 — phraseHits semantics through intentLattice (no substring matching)
// ---------------------------------------------------------------------------

describe("intentLattice word-boundary matching", () => {
  it("does NOT match the vocab term tech inside technology", () => {
    const lat = intentLattice("technology support please", "custom-software");
    assert.ok(!lat.nodes.some((n) => n.label === "tech"), "actor `tech` must not fire on `technology`");
    assert.deepEqual(lat.jobs, ["deliver-core-workflow"], "no jobs extracted -> fallback job kept");
  });

  it("DOES match the vocab term scan from scanning (plural via stem)", () => {
    const lat = intentLattice("scanning barcode", "custom-software");
    assert.ok(lat.jobs.includes("scan"), "`scanning` must surface the job `scan`");
    assert.deepEqual(lat.entities, ["operator", "record"], "entities fallback kept for A5/A6/A7");
  });

  it("matches route from routing via stemming", () => {
    const lat = intentLattice("route the routing crews today", "custom-software");
    assert.ok(lat.jobs.includes("route"));
    assert.ok(lat.jobs.length === 1, `expected only route, got ${lat.jobs.join(",")}`);
  });

  it("weights a term by stem-equal bag tokens (scanning feeds scan)", () => {
    const single = intentLattice("scanning barcode", "custom-software");
    const repeated = intentLattice("scan scan scanning scans barcode", "custom-software");
    const wSingle = single.nodes.find((n) => n.label === "scan")?.weight ?? 0;
    const wRepeated = repeated.nodes.find((n) => n.label === "scan")?.weight ?? 0;
    assert.ok(wSingle >= 0.54 && wSingle <= 0.56, `single-mention weight ${wSingle}`);
    assert.ok(wRepeated >= 0.95, `repeated-mention weight ${wRepeated}`);
    assert.ok(wRepeated > wSingle, "repeated stemmed mentions must boost the weight");
  });
});

// ---------------------------------------------------------------------------
// 109 T-07 — intentLattice frequency must canonical-stem BOTH sides. The old
// pair stemmed bag tokens once (stemToken) but the term to a fixed point, so
// a brief's `listings` under-weighted the `listing` node (freq 0 vs 1).
// ---------------------------------------------------------------------------

describe("109 T-07 — intentLattice plural/singular weight parity", () => {
  it("a brief's `listings` weights the `listing` node the same as `listing`", () => {
    const singular = intentLattice("Track listing status for the realtor dashboard", "real-estate");
    const plural = intentLattice("Track listings status for the realtor dashboard", "real-estate");
    const ws = singular.nodes.find((n) => n.label === "listing")?.weight;
    const wp = plural.nodes.find((n) => n.label === "listing")?.weight;
    assert.equal(typeof ws, "number", "singular brief surfaces the listing node");
    assert.equal(typeof wp, "number", "plural brief surfaces the listing node");
    assert.ok((ws ?? 0) >= 0.54, `stem-matched mention must carry the freq weight (got ${ws})`);
    assert.equal(wp, ws, `plural inflection must not change the weight (${ws} vs ${wp})`);
  });
});

// ---------------------------------------------------------------------------
// 109 C-10 — canonicalStem is the DOCUMENTED fixed point of stemToken (the
// STEMMING note atop algorithms.ts): iterating it again must never move a
// token, or the "one pair" contract (and every two-sided match built on it)
// silently drifts.
// ---------------------------------------------------------------------------

describe("109 C-10 — canonicalStem fixed-point contract", () => {
  it("canonicalStem(canonicalStem(w)) === canonicalStem(w) on the register vocabulary", () => {
    for (const w of [
      "listing", "listings", "showing", "showings", "routing", "route",
      "property", "properties", "invoice", "invoicing", "scan", "scanning",
    ]) {
      assert.equal(
        canonicalStem(canonicalStem(w)),
        canonicalStem(w),
        `canonicalStem must be a fixed point for "${w}"`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// R2/B-02 — intentLattice.vague
// ---------------------------------------------------------------------------

describe("intentLattice vague flag", () => {
  it("marks a brief with no vocabulary hits vague (both fallbacks fired)", () => {
    const lat = intentLattice("build a tool for my team please", "custom-software");
    assert.equal(lat.vague, true);
    assert.deepEqual(lat.jobs, ["deliver-core-workflow"], "fallback jobs are still provided");
    assert.deepEqual(lat.entities, ["operator", "record"], "fallback entities are still provided");
  });

  it("keeps vague false when jobs came from vocabulary even if entities fell back", () => {
    const lat = intentLattice("scanning barcode", "custom-software");
    assert.equal(lat.vague, false);
  });
});

// ---------------------------------------------------------------------------
// R6/B-16 — fusionRank
// ---------------------------------------------------------------------------

describe("fusionRank", () => {
  const mixed = [
    mem("s1", "semantic", "dispatch routing workflow", 0.8),
    mem("s2", "semantic", "inventory ledger reconciliation", 0.7),
    mem("s3", "semantic", "operator checkpoint discipline", 0.6),
    mem("e1", "episodic", "crew rerouted mid-shift yesterday", 0.9),
    mem("e2", "episodic", "sla breached on overnight batch", 0.8),
    mem("e3", "episodic", "scanner offline in warehouse", 0.7),
    mem("p1", "procedural", "reroute protocol when vehicle stalls", 0.95),
    mem("p2", "procedural", "checkpoint write order is schema first", 0.9),
  ];

  it("returns every input id exactly once (no dead accumulation duplicates)", () => {
    const out = fusionRank("dispatch routing", mixed, mixed.length);
    assert.equal(out.length, mixed.length);
    const ids = out.map((r) => r.id).sort();
    const want = mixed.map((m) => m.id).sort();
    assert.deepEqual(ids, want);
  });

  it("is deterministic for identical inputs", () => {
    const a = fusionRank("dispatch routing", mixed, 6);
    const b = fusionRank("dispatch routing", mixed, 6);
    assert.deepEqual(a, b);
  });

  it("lets a strong match in a crowded kind outrank a weak singleton", () => {
    const memory: MemoryEntry[] = [
      mem("epi-weak", "episodic", "annual tax audit review notes", 0.95),
      ...Array.from({ length: 100 }, (_, i) => mem(`sem-${i}`, "semantic", "dispatch routing workflow", 0.8)),
    ];
    const out = fusionRank("dispatch routing workflow", memory, 6);
    assert.equal(out.length, 6);
    assert.ok(out.every((r) => r.kind === "semantic"), "crowded semantic kind must fill the top 6");
    const wide = fusionRank("dispatch routing workflow", memory, 101);
    const singleton = wide.find((r) => r.id === "epi-weak");
    assert.ok(singleton, "singleton still present when the limit is large");
    assert.ok(wide[0]!.score > singleton!.score, "weak singleton must not outscore a strong crowded match");
  });

  it("does not let a singleton kind dominate a crowded kind", () => {
    const memory: MemoryEntry[] = [
      mem("epi-solo", "episodic", "dispatch routing workflow", 0.9),
      ...Array.from({ length: 20 }, (_, i) => mem(`sem-${i}`, "semantic", "dispatch routing workflow", 0.8)),
    ];
    const out = fusionRank("dispatch routing workflow", memory, 6);
    assert.equal(out.length, 6);
    assert.equal(out[0]!.id, "epi-solo", "singleton may lead when equally relevant");
    const semanticSlots = out.filter((r) => r.kind === "semantic").length;
    assert.equal(semanticSlots, 5, "crowded kind must still take 5 of the top 6 slots");
    const ids = out.map((r) => r.id);
    assert.equal(new Set(ids).size, 6, "no id twice in the output");
  });

  it("skips malformed memory rows (unknown kind / null) instead of throwing (A15)", () => {
    const good = mem("s1", "semantic", "dispatch routing workflow", 0.8);
    // Corrupt persisted payload: unknown `kind`, a null row, and a row that is
    // missing text — none of these may throw inside packet compilation.
    const corrupt = [
      { id: "bogus-kind", kind: "not-a-real-kind", phase: 3, text: "process notes", score: 0.9 },
      null,
    ] as unknown as MemoryEntry[];
    const out = fusionRank("dispatch routing", [good, ...corrupt]);
    assert.equal(out.length, 1, "only the healthy row ranks");
    assert.equal(out[0]!.id, "s1");
    // Deterministic under the same corrupt input (no partial-state thrash).
    const again = fusionRank("dispatch routing", [good, ...corrupt]);
    assert.deepEqual(out, again);
  });
});

// ---------------------------------------------------------------------------
// E-18 — FusionRank cited-boost (research-backed rows)
// ---------------------------------------------------------------------------

describe("fusionRank — E-18 cited boost", () => {
  /** Clone a row with an explicit provenance source (E-18 additive field). */
  const withSource = (
    m: MemoryEntry,
    source: NonNullable<MemoryEntry["source"]>,
  ): MemoryEntry => ({ ...m, source });

  const template = mem("tpl", "semantic", "dispatch routing workflow", 0.8);
  const cited = withSource(mem("src", "semantic", "dispatch routing workflow", 0.8), "research");
  // "dispatch routing" (2 tokens) ⊂ "dispatch routing workflow" (3 tokens):
  // a PARTIAL overlap (ox ≈ 0.82), the common real-world shape.
  const QUERY = "dispatch routing";

  it("ranks a research row above an equal-overlap template row (+0.15 boost)", () => {
    const out = fusionRank(QUERY, [template, cited], 5);
    assert.equal(out.length, 2);
    assert.equal(out[0]!.id, "src", "cited row must lead despite the same text/score");
    assert.equal(out[1]!.id, "tpl");
    // The template row keeps the higher rrf slot (input order wins the tie),
    // so the gap is the +0.15 boost minus one rrf step (~0.0015).
    const delta = out[0]!.score - out[1]!.score;
    assert.ok(delta > 0.14 && delta <= 0.151, `delta ${delta} ≈ 0.15 − rrf step`);
  });

  it("overcomes a modest prior-score handicap of the boilerplate row (E-18 fixture)", () => {
    const strongTemplate = mem("tpl2", "semantic", "dispatch routing workflow", 0.9);
    const weakCited = withSource(
      mem("src2", "semantic", "dispatch routing workflow", 0.7),
      "research",
    );
    const out = fusionRank(QUERY, [strongTemplate, weakCited], 5);
    assert.equal(out[0]!.id, "src2", "fetched-and-sourced row beats higher-prior boilerplate");
    assert.ok(out[0]!.score - out[1]!.score > 0.1);
  });

  it("is default-off: no source field, other provenances, or zero overlap never boost", () => {
    // Legacy row (no source) ≡ identical row stamped "human"/"engine"/"agent-report".
    const legacy = mem("leg", "semantic", "dispatch routing workflow", 0.8);
    for (const src of ["human", "engine", "agent-report"] as const) {
      const a = fusionRank(QUERY, [legacy], 5);
      const b = fusionRank(QUERY, [withSource(legacy, src)], 5);
      assert.deepEqual(b, a, `source:${src} must not change scores`);
    }
    // Research row with ZERO lexical overlap gets no boost: scores match the
    // provenance-less twin exactly (no cite, no penalty).
    const offTopic = mem("off", "semantic", "annual tax audit review notes", 0.8);
    const citedOffTopic = withSource(offTopic, "research");
    assert.deepEqual(
      fusionRank("dispatch routing", [citedOffTopic], 5),
      fusionRank("dispatch routing", [offTopic], 5),
    );
  });

  it("stays deterministic and honors limit under the boost", () => {
    const out1 = fusionRank(QUERY, [template, cited], 1);
    const out2 = fusionRank(QUERY, [template, cited], 1);
    assert.deepEqual(out1, out2);
    assert.equal(out1.length, 1);
    assert.equal(out1[0]!.id, "src");
  });
});

// ---------------------------------------------------------------------------
// T8 (112 F2+F3) — fusionRank/contiguousRun cost fix, score-preserving
// ---------------------------------------------------------------------------

describe("fusionRank — T8 golden (frozen pre-refactor output)", () => {
  const withSource = (m: MemoryEntry, source: NonNullable<MemoryEntry["source"]>): MemoryEntry => ({
    ...m,
    source,
  });

  // Mixed corpus: all three kinds (kind-prior blend + per-kind rrf), a cited
  // research row, phrase runs of 3 / 2 / 1 (the contiguousRun boost band), a
  // duplicate id (the dedupe path), a non-finite prior score (floored to 0)
  // and malformed rows (unknown kind, null, non-string text) that must be
  // skipped. Every scored row is covered by the golden below.
  const corpus: MemoryEntry[] = [
    mem("s1", "semantic", "dispatch routing workflow", 0.8),
    mem("s2", "semantic", "inventory ledger reconciliation", 0.7),
    mem("s3", "semantic", "dispatch routing workflow for overnight shifts", 0.6),
    mem("s4", "semantic", "routing dispatch reversed order notes", 0.55),
    mem("e1", "episodic", "crew rerouted mid-shift yesterday", 0.9),
    mem("e2", "episodic", "sla breached on overnight batch", 0.8),
    mem("e3", "episodic", "dispatch routing capacity planning", 0.7),
    mem("e4", "episodic", "dispatch routing workflow journal", 0.75),
    withSource(mem("r1", "episodic", "dispatch routing workflow recap", 0.5), "research"),
    mem("p1", "procedural", "reroute protocol when vehicle stalls", 0.95),
    mem("p2", "procedural", "dispatch routing workflow checklist", 0.9),
    mem("dup", "semantic", "dispatch routing workflow", 0.75),
    mem("dup", "semantic", "dispatch routing workflow duplicate row", 0.75),
  ];
  const malformed = [
    { id: "bad-kind", kind: "not-a-real-kind", phase: 3, text: "process notes", score: 0.9 },
    null,
    { id: "bad-text", kind: "semantic", phase: 1, text: 42, score: 0.5 },
    { id: "nan-score", kind: "semantic", text: "dispatch routing workflow nan", score: Number.NaN },
  ] as unknown as MemoryEntry[];
  const input: MemoryEntry[] = [...corpus, ...malformed];
  const QUERY = "dispatch routing workflow";

  // FROZEN 2026-09-16 before the T8 refactor (captured from the pre-change
  // module, raw JSON in fixes/216c_algorithms.md): id + score + kind + text,
  // in output order, for the limit-20 call. The refactor may not move a
  // single score or reorder a single row.
  const GOLDEN: { id: string; score: number; text: string; kind: MemoryEntry["kind"] }[] = [
    { id: "r1", kind: "episodic", text: "dispatch routing workflow recap", score: 0.624 },
    { id: "s1", kind: "semantic", text: "dispatch routing workflow", score: 0.549 },
    { id: "p2", kind: "procedural", text: "dispatch routing workflow checklist", score: 0.549 },
    { id: "dup", kind: "semantic", text: "dispatch routing workflow", score: 0.543 },
    { id: "e4", kind: "episodic", text: "dispatch routing workflow journal", score: 0.5 },
    { id: "s3", kind: "semantic", text: "dispatch routing workflow for overnight shifts", score: 0.459 },
    { id: "nan-score", kind: "semantic", text: "dispatch routing workflow nan", score: 0.435 },
    { id: "e3", kind: "episodic", text: "dispatch routing capacity planning", score: 0.379 },
    { id: "s4", kind: "semantic", text: "routing dispatch reversed order notes", score: 0.311 },
    { id: "p1", kind: "procedural", text: "reroute protocol when vehicle stalls", score: 0.262 },
    { id: "e1", kind: "episodic", text: "crew rerouted mid-shift yesterday", score: 0.22 },
    { id: "s2", kind: "semantic", text: "inventory ledger reconciliation", score: 0.211 },
    { id: "e2", kind: "episodic", text: "sla breached on overnight batch", score: 0.209 },
  ];

  it("deep-equals the frozen pre-refactor output (ids + scores + order + text)", () => {
    assert.deepEqual(fusionRank(QUERY, input, 20), GOLDEN);
    assert.equal(GOLDEN.length, corpus.length, "one duplicate id collapsed, every other valid row ranked");
  });

  it("keeps the top-6 slice frozen too (limit path unchanged)", () => {
    assert.deepEqual(fusionRank(QUERY, input, 6), GOLDEN.slice(0, 6));
  });
});

// ---------------------------------------------------------------------------
// T8 (112 F3) — contiguousRun: KMP vs the naive reference it replaced
// ---------------------------------------------------------------------------

describe("contiguousRun — T8 differential vs the naive reference", () => {
  /** The pre-refactor implementation, kept as the oracle (restart scan). */
  const naive = (q: string[], row: string[]): number => {
    let best = 0;
    for (let i = 0; i < row.length; i++) {
      let j = 0;
      while (j < q.length && i + j < row.length && q[j] === row[i + j]) j++;
      if (j > best) best = j;
    }
    return best;
  };
  // Seeded mulberry32 — deterministic, no Math.random in the suite.
  const seeded = (seed: number): (() => number) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  it("agrees with the naive oracle on 10,000 seeded token-sequence pairs", () => {
    const rnd = seeded(0x216c5eed);
    const alpha = ["a", "b", "c"];
    for (let n = 0; n < 10_000; n++) {
      const q = Array.from({ length: Math.floor(rnd() * 6) }, () => alpha[Math.floor(rnd() * 3)]!);
      const row = Array.from({ length: Math.floor(rnd() * 10) }, () => alpha[Math.floor(rnd() * 3)]!);
      assert.equal(
        contiguousRun(q, row),
        naive(q, row),
        `pair #${n}: q=[${q.join(",")}] row=[${row.join(",")}]`,
      );
    }
  });

  it("handles the degenerate quadratic case (one token repeated) identically", () => {
    const all = Array.from({ length: 40 }, () => "x");
    assert.equal(contiguousRun(all, all), 40);
    assert.equal(contiguousRun(all, all.slice(0, 12)), 12);
    assert.equal(contiguousRun(["x"], all), 1);
    // Empty inputs: no run, never a throw (the old scan also yielded 0).
    assert.equal(contiguousRun([], all), 0);
    assert.equal(contiguousRun(all, []), 0);
  });
});

// ---------------------------------------------------------------------------
// R7/B-15 — synthesizeContracts
// ---------------------------------------------------------------------------

describe("synthesizeContracts", () => {
  it("picks the longest matching field key (sales-order -> order bank)", () => {
    const c = synthesizeContracts(lattice({ entities: ["sales-order"], jobs: [] }));
    assert.equal(c.entities.length, 1);
    assert.equal(c.entities[0]!.name, "SalesOrder");
    assert.deepEqual(c.entities[0]!.fields, ORDER_FIELDS);
  });

  it("maps job-board to the job bank via stemmed tokens", () => {
    const c = synthesizeContracts(lattice({ entities: ["job-board"], jobs: [] }));
    assert.deepEqual(c.entities[0]!.fields, JOB_FIELDS);
  });

  it("falls back to the default bank when no key matches", () => {
    const c = synthesizeContracts(lattice({ entities: ["fleet"], jobs: [] }));
    assert.deepEqual(c.entities[0]!.fields, DEFAULT_FIELDS);
  });

  it("copies field banks per entity (no shared references)", () => {
    const l = lattice({ entities: ["order", "sales-order"], jobs: [] });
    const first = synthesizeContracts(l);
    assert.equal(first.entities.length, 2);
    first.entities[0]!.fields[0]!.name = "tampered";
    assert.equal(first.entities[1]!.fields[0]!.name, "id", "sibling entity must keep its own copy");
    const fresh = synthesizeContracts(l);
    assert.equal(fresh.entities[0]!.fields[0]!.name, "id", "FIELD_BANK itself must be untouched");
  });
});

// ---------------------------------------------------------------------------
// R8/B-17 — routeCrew
// ---------------------------------------------------------------------------

describe("routeCrew", () => {
  const sched = scheduleConstraints(lattice(), "custom-software");
  const seatsFor = (phase: number) => routeCrew(lattice(), sched, "Build", phase);

  it("activates at least one seat for every phase 0..12", () => {
    for (let phase = 0; phase <= 12; phase++) {
      const seats = seatsFor(phase);
      assert.ok(seats.some((s) => s.active), `phase ${phase} must have an active seat`);
    }
  });

  it("marks reviewer (not architect) active on P4", () => {
    const roles = activeRoles(seatsFor(4));
    assert.deepEqual(roles, ["reviewer"]);
    assert.ok(!roles.includes("architect"), "architect must not be force-activated on P4");
  });

  it("matches the ACTIVE_BY_PHASE table exactly for every phase", () => {
    const expected: Record<number, CrewRole[]> = {
      0: ["architect"],
      1: ["architect"],
      2: ["architect"],
      3: ["architect"],
      4: ["reviewer"],
      5: ["reviewer", "tester"],
      6: ["implementer", "tester"],
      7: ["architect"],
      8: ["implementer"],
      9: ["reviewer"],
      10: ["implementer"],
      11: ["implementer"],
      12: ["reviewer"],
    };
    for (let phase = 0; phase <= 12; phase++) {
      assert.deepEqual(activeRoles(seatsFor(phase)), expected[phase], `phase ${phase}`);
    }
  });

  it("runs reviewer + tester together on P5 and implementer + tester on P6", () => {
    assert.deepEqual(activeRoles(seatsFor(5)), ["reviewer", "tester"]);
    assert.deepEqual(activeRoles(seatsFor(6)), ["implementer", "tester"]);
  });
});

// ---------------------------------------------------------------------------
// R2/B-02 — feasibilityScorecard
// ---------------------------------------------------------------------------

describe("feasibilityScorecard", () => {
  it("returns reframe for a vague brief (HR-1) and floors delivery at 4", () => {
    const lat = intentLattice("build a tool for my team please", "custom-software");
    assert.equal(lat.vague, true);
    const sc = scorecard(lat);
    assert.equal(sc.verdict, "reframe");
    const delivery = sc.axes.find((a) => a.key === "delivery");
    assert.equal(delivery?.score, 4);
  });

  it("never proceeds on a maximal-risk complexity-10 brief", () => {
    const lat = lattice({
      domain: "marketplace",
      jobs: ["quote", "pay"],
      entities: ["buyer", "seller"],
      constraints: ["realtime", "pci", "multi-tenant"],
      complexity: 10,
      vague: false,
    });
    const sc = scorecard(lat);
    assert.notEqual(sc.verdict, "proceed", "complexity 10 + realtime + Δ3 must not proceed");
    assert.ok(sc.overall < 7.5, `overall ${sc.overall} should be knocked down`);
  });

  it("downgrades a high-overall complexity-8 brief to proceed-with-guards (HR-2)", () => {
    const lat = lattice({
      domain: "health-ops",
      jobs: ["track", "dispatch", "scan"],
      entities: ["order", "invoice"],
      constraints: ["hipaa"],
      complexity: 8,
      vague: false,
    });
    const sc = scorecard(lat);
    assert.ok(sc.overall >= 7.5, `overall ${sc.overall} must clear the proceed bar`);
    assert.equal(sc.verdict, "proceed-with-guards", "HR-2 caps complexity>=8 at proceed-with-guards");
  });

  it("proceeds (>= 7.5) on a solid Northwind-style brief", () => {
    const lat = intentLattice("track jobs, dispatch crews, scan inventory", "custom-software");
    const sc = scorecard(lat);
    assert.ok(sc.overall >= 7.5, `overall ${sc.overall} must reach the proceed band`);
    assert.equal(sc.verdict, "proceed");
  });

  it("scores delivery 6 for a single-job brief", () => {
    const sc = scorecard(lattice({ jobs: ["track"], entities: ["order"] }));
    const delivery = sc.axes.find((a) => a.key === "delivery");
    assert.equal(delivery?.score, 6);
  });
});

// ---------------------------------------------------------------------------
// B-21 — estimateTokens
// ---------------------------------------------------------------------------

describe("estimateTokens", () => {
  // Symbol-dense minified-style code: cl100k_base pays ~1 token per punctuation
  // run, so len/4 (which assumes ~4 chars/token) undercounts by >1.5x here.
  const codeHeavy =
    '!@#$%^&*()_+{}[]|\\:;"\'<>?,./~`-=' +
    '!@#$%^&*()_+{}[]|\\:;"\'<>?,./~`-=' +
    '!@#$%^&*()_+{}[]|\\:;"\'<>?,./~`-=' +
    "const{map,filter}=await fetchData('/v1/orders',{method:'POST'})";

  it("returns 0 for empty and whitespace-only input", () => {
    assert.deepEqual(estimateTokens(""), { tokensEst: 0, tokensLo: 0, tokensHi: 0 });
    assert.deepEqual(estimateTokens("   \n\t "), { tokensEst: 0, tokensLo: 0, tokensHi: 0 });
  });

  it("counts symbol-dense code far heavier than the len/4 heuristic", () => {
    const est = estimateTokens(codeHeavy).tokensEst;
    const naive = codeHeavy.length / 4;
    assert.ok(est > 1.5 * naive, `tokens ${est} must deviate >1.5x from len/4 (${naive})`);
  });

  it("keeps the estimate inside its ±15% band (lo <= est <= hi)", () => {
    const samples = [codeHeavy, "dispatch routing workflow", '{"id":"ulid","status":"enum","updatedAt":"datetime"}'];
    for (const s of samples) {
      const { tokensEst, tokensLo, tokensHi } = estimateTokens(s);
      assert.ok(tokensEst >= 1, `estimate for ${s.slice(0, 20)}...`);
      assert.ok(tokensLo <= tokensEst && tokensEst <= tokensHi, `${s.slice(0, 20)}: ${tokensLo}<=${tokensEst}<=${tokensHi}`);
      assert.equal(tokensLo, Math.round(tokensEst * 0.85));
      assert.equal(tokensHi, Math.round(tokensEst * 1.15));
    }
  });

  it("is cached and repeatable for the same input", () => {
    const a = estimateTokens(codeHeavy);
    const b = estimateTokens(codeHeavy);
    assert.deepEqual(a, b);
  });

  // T7 (112 F1) — the old LRU key was fnv1a(text), a 32-bit hash. This pair
  // collides on it (both hash to 933450742), so whichever string was
  // estimated FIRST poisoned the other's count: with B first the short word
  // "rjmr" was reported as 16 tokens (its own count is 3), and with A first
  // the 31-char string was reported as 3 (5.3x low — the direction that lets
  // a prompt pass the enforceTokenBudget guard while materially over budget).
  // The pair was found by hashing candidate strings against the module's own
  // fnv1a; the tripwire below keeps it a genuine collision if either changes.
  const TOKEN_COLLIDE_A = "rjmr";
  const TOKEN_COLLIDE_B = "lasipzafzrmsnlpmtfnstxtvfmtmnet";

  it("keeps the pinned collision pair a real fnv1a collision (tripwire)", () => {
    assert.equal(fnv1a(TOKEN_COLLIDE_A), fnv1a(TOKEN_COLLIDE_B), "pair must collide on the OLD cache key");
    assert.equal(fnv1a(TOKEN_COLLIDE_A), 933450742);
    assert.notEqual(TOKEN_COLLIDE_A.length, TOKEN_COLLIDE_B.length);
  });

  it("returns each colliding string's OWN estimate in both call orders (T7)", () => {
    // Long string first, short word second — the reproduced bug order.
    assert.deepEqual(estimateTokens(TOKEN_COLLIDE_B), { tokensEst: 16, tokensLo: 14, tokensHi: 18 });
    assert.deepEqual(estimateTokens(TOKEN_COLLIDE_A), { tokensEst: 3, tokensLo: 3, tokensHi: 3 });
    // Short word first, long string second — the other poisoning direction.
    assert.equal(estimateTokens(TOKEN_COLLIDE_A).tokensEst, 3);
    assert.equal(estimateTokens(TOKEN_COLLIDE_B).tokensEst, 16);
    // A non-colliding neighbour is unaffected by whichever order ran first.
    assert.equal(estimateTokens("dispatch routing workflow").tokensEst, 3);
  });
});

// ---------------------------------------------------------------------------
// T9 — fnv1a
// ---------------------------------------------------------------------------

describe("fnv1a", () => {
  it("is deterministic and stable on the empty string", () => {
    assert.equal(fnv1a("scanning barcode"), fnv1a("scanning barcode"));
    assert.equal(fnv1a(""), 2166136261); // FNV-1a 32-bit offset basis
  });

  it("differs for distinct inputs", () => {
    assert.notEqual(fnv1a("scanning barcode"), fnv1a("scanning barcodes"));
  });
});

// ---------------------------------------------------------------------------
// B-22/R9 — librariesFor
// ---------------------------------------------------------------------------

describe("librariesFor", () => {
  it("returns base + domain rows and follows constraints", () => {
    const rows = librariesFor("health-ops", { constraints: ["hipaa"] });
    const names = rows.map((r) => r.name);
    assert.ok(names.includes("TanStack Start"));
    assert.ok(names.includes("Zod"));
    assert.ok(names.includes("HIPAA-aware audit logger"), "domain row");
    assert.ok(names.includes("Audit + access-control layer"), "constraint row");
  });

  it("dedupes constraint rows that resolve to the same library", () => {
    const rows = librariesFor("health-ops", { constraints: ["hipaa", "phi"] });
    const names = rows.map((r) => r.name);
    assert.equal(rows.length, 4, "2 base + 1 domain + 1 (deduped) constraint");
    assert.equal(names.filter((n) => n === "Audit + access-control layer").length, 1);
  });

  it("omits constraint rows when no lattice/constraints are given", () => {
    const rows = librariesFor("logistics", null);
    assert.deepEqual(
      rows.map((r) => r.name),
      ["TanStack Start", "Zod", "Geo/dispatch SDK"],
    );
  });
});

// ---------------------------------------------------------------------------
// R6 — runAlgorithms no longer computes A2
// ---------------------------------------------------------------------------

describe("runAlgorithms", () => {
  it("does not compute or return ranked (A2 moved to compileAgentPacket)", () => {
    const out = runAlgorithms({
      brief: "track jobs, dispatch crews, scan inventory",
      domain: "custom-software",
      memory: [],
      currentPhase: 0,
    });
    assert.ok(!("ranked" in out), "ranked must be absent from the runAlgorithms result");
    const traceIds = out.traces.map((t) => t.id);
    assert.ok(!traceIds.includes("A2"), "A2 trace must be gone from runAlgorithms");
    for (const id of ["A1", "A3", "A5", "A6", "A7", "A8"] as const) {
      assert.ok(traceIds.includes(id), `missing trace ${id}`);
    }
    assert.ok(out.lattice.jobs.length >= 1);
    assert.ok(out.crew.some((s) => s.active));
    assert.ok(out.contracts.entities.length >= 1);
  });

  it("coerces a foreign domain instead of crashing the spec graph (H1 probe)", () => {
    // W40 N1: probe case algs.runAlgorithms-junk-project — null domain must
    // coerce exactly like intentLattice's guard (custom-software), not crash.
    const out = runAlgorithms({
      brief: 42,
      domain: null,
      memory: null,
      currentPhase: 12,
    } as never);
    const schema = out.specGraph.nodes.find((n) => n.id === "schema");
    assert.equal(schema?.file, "src/domain/custom_software.ts");
  });

  it("carries the COERCED domain on the lattice, never the raw param (325 BUG B)", () => {
    // A6b (325 BUG B): the last raw-domain site of the class — intentLattice's
    // `return { domain }` leaked null/42 onto lattice.domain (bootstrapMemory
    // then printed `Domain null;` into memory text). The lattice must carry the
    // same coerced `dom` every sibling consumer reads, for junk and for real.
    const nulled = runAlgorithms({
      brief: "track jobs",
      domain: null,
      memory: [],
      currentPhase: 0,
    } as never);
    assert.equal(nulled.lattice.domain, "custom-software", "null domain coerces to the default");
    const numeric = runAlgorithms({
      brief: "track jobs",
      domain: 42,
      memory: [],
      currentPhase: 0,
    } as never);
    assert.equal(numeric.lattice.domain, "custom-software", "non-string domain coerces to the default");
    assert.equal(intentLattice("track jobs", "").domain, "custom-software", "empty domain coerces");
    assert.equal(intentLattice("track jobs", "health-ops").domain, "health-ops", "a real domain passes through");
  });
});

// ---------------------------------------------------------------------------
// 95 P0-A — LEX consumer/dev-tool register (91/92 taxonomy vocabulary)
// Kill criterion (95 §2.2): RenamePro/StatKit corpus briefs stop being
// vague:true and stop falling back to deliver-core-workflow; vocabulary-free
// briefs stay honestly vague (existing pins above must not drift).
// ---------------------------------------------------------------------------

describe("intentLattice — consumer/dev-tool vocabulary (95 P0-A)", () => {
  it("PB-01: plural and singular -e words canonicalize to the same stem", () => {
    for (const [a, b] of [
      ["file", "files"],
      ["code", "codes"],
      ["page", "pages"],
      ["note", "notes"],
      ["type", "types"],
      ["name", "names"],
    ] as const) {
      assert.equal(tokenizeWords(a)[0], tokenizeWords(b)[0], `${a} ≡ ${b}`);
    }
  });

  it("PB-01: plural brief keeps the singular entity in the lattice", () => {
    const lat = intentLattice("rename pdf files into dated folders", "custom-software");
    assert.equal(lat.vague, false);
    assert.ok(lat.entities.includes("file"), `entities ${lat.entities.join(",")}`);
  });

  it("PB-01: fusionRank lexical overlap works for plural queries over singular rows", () => {
    const ranked = fusionRank("files", [
      { id: "r1", kind: "episodic" as const, phase: 1, text: "file list for the job", score: 0.8 },
    ]);
    assert.ok((ranked[0]?.score ?? 0) > 0.218, `plural query must rank the singular row (got ${ranked[0]?.score})`);
  });

  it("extracts jobs + entities from the RenamePro corpus brief (87) — not vague", () => {
    const lat = intentLattice(
      "a batch file-renamer CLI with dry-run, regex rules, and undo",
      "custom-software",
    );
    assert.equal(lat.vague, false, "RenamePro brief has real vocabulary — must not be vague");
    assert.ok(lat.jobs.includes("rename"), `jobs ${lat.jobs.join(",")}`);
    assert.ok(lat.jobs.includes("undo"), `jobs ${lat.jobs.join(",")}`);
    assert.ok(lat.jobs.includes("batch"), `jobs ${lat.jobs.join(",")}`);
    assert.ok(!lat.jobs.includes("deliver-core-workflow"), "no fallback job on a real brief");
    assert.ok(lat.entities.includes("file"), `entities ${lat.entities.join(",")}`);
  });

  it("extracts entities from the Team Kanban corpus brief (86) — not vague", () => {
    const lat = intentLattice(
      "a team kanban board web app with drag-and-drop columns, task cards, and localStorage persistence",
      "custom-software",
    );
    assert.equal(lat.vague, false, "Team Kanban brief has board/card/column/task vocabulary");
    const hasBoardFamily = ["board", "card", "column", "task"].some((t) => lat.entities.includes(t));
    assert.ok(hasBoardFamily, `entities ${lat.entities.join(",")}`);
    assert.ok(!lat.jobs.includes("deliver-core-workflow"));
  });

  it("extracts entities from the StatKit corpus brief (88) — not vague", () => {
    const lat = intentLattice(
      "a tiny math/statistics library with mean, median, stddev, and percentile functions, zero dependencies, full JSDoc",
      "custom-software",
    );
    assert.equal(lat.vague, false, "StatKit brief names library/statistics — must not be vague");
    assert.ok(
      lat.entities.includes("library") || lat.entities.includes("statistic"),
      `entities ${lat.entities.join(",")}`,
    );
  });

  it("covers the dev-tool job class (lint/test/build/parse/convert)", () => {
    const lat = intentLattice("a CLI that lints, converts, and tests files", "custom-software");
    for (const job of ["lint", "convert", "test"]) {
      assert.ok(lat.jobs.includes(job), `missing dev-tool job ${job} in ${lat.jobs.join(",")}`);
    }
    assert.equal(lat.vague, false);
  });

  it("covers the consumer-media object class (video/image/audio)", () => {
    const lat = intentLattice("a media player that streams video and audio", "custom-software");
    assert.equal(lat.vague, false);
    assert.ok(lat.jobs.includes("stream"), `jobs ${lat.jobs.join(",")}`);
    for (const obj of ["media", "video", "audio"]) {
      assert.ok(lat.entities.includes(obj), `missing consumer object ${obj} in ${lat.entities.join(",")}`);
    }
  });

  it("still marks vocabulary-free briefs vague (existing pin preserved)", () => {
    const lat = intentLattice("build a tool for my team please", "custom-software");
    assert.equal(lat.vague, true);
    assert.deepEqual(lat.jobs, ["deliver-core-workflow"]);
  });

  it("never substring-matches: codebase does not fire code, file-manager fires file", () => {
    const noSub = intentLattice("maintain our codebase please", "custom-software");
    assert.ok(
      !noSub.entities.includes("code"),
      "`code` must not fire inside `codebase` (word-boundary law)",
    );
    const word = intentLattice("file manager", "custom-software");
    assert.ok(word.entities.includes("file"));
  });

  it("marks quality constraints (deterministic / idempotent / cross-platform)", () => {
    const lat = intentLattice(
      "a deterministic idempotent cross-platform sync tool",
      "custom-software",
    );
    assert.equal(lat.vague, false);
    for (const c of ["deterministic", "idempotent", "cross-platform"]) {
      assert.ok(lat.constraints.includes(c), `missing constraint ${c} in ${lat.constraints.join(",")}`);
    }
  });
});

// ---------------------------------------------------------------------------
// fixes/136 — gerund-noun stem-collision guard (P8 / lattice-stem cleanup)
// ---------------------------------------------------------------------------

describe("intentLattice — gerund-noun firing guard (fixes/136)", () => {
  it("does NOT fire the real-estate `showing` entity from a bare `show` verb", () => {
    const lat = intentLattice("Track requests and show a status dashboard.", "real-estate");
    assert.ok(
      !lat.entities.includes("showing"),
      `show must not surface showing entity — got ${lat.entities.join(",")}`,
    );
    assert.ok(lat.jobs.includes("show"), "the verb `show` itself still fires as a job");
  });

  it("does NOT fire the `listing` entity from a bare `list`/`lists` noun", () => {
    const lat = intentLattice("A to-do list app. Add items to your list and track them.", "real-estate");
    assert.ok(
      !lat.entities.includes("listing"),
      `list must not surface listing entity — got ${lat.entities.join(",")}`,
    );
  });

  it("does NOT ship showing/landlord/listing entities for a maintenance tracker", () => {
    const lat = intentLattice(
      "Maintenance tracker. Track requests and open tickets, schedule repairs, create work orders per asset, show a status dashboard.",
      "real-estate",
    );
    for (const noise of ["showing", "landlord", "listing"]) {
      assert.ok(!lat.entities.includes(noise), `${noise} must not fire in a maintenance tracker — got ${lat.entities.join(",")}`);
    }
  });

  it("still fires `showing` on a genuine gerund phrase (showings)", () => {
    const lat = intentLattice("Schedule showings and open houses for properties.", "real-estate");
    assert.ok(lat.entities.includes("showing"), `showings must surface showing — got ${lat.entities.join(",")}`);
  });

  it("still fires `listing` on a genuine gerund phrase (listings)", () => {
    const lat = intentLattice("Browse property listings and save favorites.", "real-estate");
    assert.ok(lat.entities.includes("listing"), `listings must surface listing — got ${lat.entities.join(",")}`);
  });

  it("keeps verb inflection stemming (scanning→scan, routing→route) intact", () => {
    const scan = intentLattice("scanning barcode", "custom-software");
    assert.ok(scan.jobs.includes("scan"), "scanning must still fire scan");
    const route = intentLattice("route the routing crews today", "custom-software");
    assert.ok(route.jobs.includes("route"), "routing must still fire route");
  });
});

// ---------------------------------------------------------------------------
// fixes/159 (F1 — single-chunk collapse): deriveTypeSignatures — capability
// scope drives type-signature count. A 7-capability brief used to collapse to
// ≤8 LLM-judged typeSignatures ⇒ ONE synthesis chunk ⇒ a one-file tree with
// the other spec-graph jobs left TODO(E-15) stubs (fixes/157 §8). The pure
// derivation must yield ≥9 distinct signatures for a 7-capability lattice
// (multi-chunk tree), keep the ≤8 legacy single-chunk arity for small
// lattices, and return [] for capability-free lattices (byte-parity).
// ---------------------------------------------------------------------------
describe("deriveTypeSignatures — capability scope drives signature count (fixes/159 F1)", () => {
  // The 7-capability §8 fixture: Coffeehouse2Home Property Ledger (the
  // eval-corpus brief whose keyed run shipped the one-file collapsed tree).
  const PROPERTY_LEDGER_BRIEF =
    "Coffeehouse2Home is one software suite for a property-services company that does brokerage, house flipping, rentals, and field services, run by one shared Property Ledger: every property has a single record (ownership, address, status, full history) shared across all five domains. The real-estate CRM tracks contacts, buyer and seller leads, and a deal pipeline with stages; any listing, flip, or rental property can publish showing slots (private showings and open houses) that buyers book with email confirmation, reminders, calendar-sync stub, and a per-property showing history with buyer feedback. The flip manager tracks acquisitions, renovation budgets with line items, contractor bids, flip project phases, and job costing per property. The rental portfolio manages leases, tenants, rent roll with payment records, maintenance requests, vacancy tracking, and lease-renewal reminders. The field-ops suite turns work orders raised from any property (a flip task, a maintenance request, a buyer-requested repair) into crew task lists, rolls crew time sheets into weekly payroll with rates and overtime, and tracks material/supply lists with purchase records and reorder flags. Cross-domain data flows: work-order hours feed payroll and job cost, showings on flip or rental properties create CRM buyer leads, and every property's deals, flips, leases, and work orders accumulate on its shared ledger record.";

  it("yields ≥9 distinct signatures for a 7-capability lattice (multi-file tree)", () => {
    const lat = lattice({
      jobs: ["track", "record", "flip", "show", "publish", "rent", "bid"],
      entities: ["property", "showing", "listing", "lease", "work-order", "buyer"],
      nodes: [],
    });
    const sigs = deriveTypeSignatures(lat);
    assert.ok(sigs.length >= 9, `7 capabilities must clear the 8-signature chunk ceiling — got ${sigs.length}`);
    assert.equal(new Set(sigs).size, sigs.length, "every derived signature must be distinct");
    // Every capability contributes its own signatures: each job's PascalCase
    // token appears in exactly its own run<Job>/list<Job>Runs pair.
    for (const job of lat.jobs) {
      const P = job === "work-order" ? "WorkOrder" : job.charAt(0).toUpperCase() + job.slice(1);
      assert.ok(
        sigs.some((s) => s.startsWith(`run${P}(`)) && sigs.some((s) => s.startsWith(`list${P}Runs(`)),
        `capability ${job} must own a run${P} + list${P}Runs signature pair`,
      );
    }
  });

  it("yields a genuine multi-chunk tree for the 7-capability property-ledger brief (§8 fixture)", () => {
    const lat = intentLattice(PROPERTY_LEDGER_BRIEF, "real-estate");
    assert.ok(lat.jobs.length >= 7, `corpus brief must surface ≥7 capability jobs — got ${lat.jobs.length}`);
    const sigs = deriveTypeSignatures(lat);
    assert.ok(sigs.length >= 9, `≥7-capability lattice must exceed P6_SYNTH_CHUNK_SIZE (8) — got ${sigs.length}`);
    // Chunking is a deterministic ≤8 partition of distinct signature lines:
    // >8 distinct lines ⇒ ≥2 chunks ⇒ a multi-file tree, never the collapse.
    const groups = Math.ceil(sigs.length / 8);
    assert.ok(groups >= 2, `signature count must force ≥2 synthesis chunks — got ${groups} from ${sigs.length} sigs`);
    assert.ok(
      sigs.every((s) => !s.includes("DeliverCoreWorkflow")),
      "the deliver-core-workflow fallback must never contribute a signature",
    );
  });

  it("keeps the legacy single-chunk arity for a 1-capability lattice", () => {
    const sigs = deriveTypeSignatures(lattice({ jobs: ["track"], entities: ["order"] }));
    assert.equal(sigs.length, 2, "one capability contributes exactly its own signature pair");
    assert.ok(sigs.length <= 8, "≤8 signatures ⇒ one chunk ⇒ the legacy single-chunk synthesis path");
    assert.ok(sigs[0]!.startsWith("runTrack(") && sigs[1]!.startsWith("listTrackRuns("));
  });

  it("sits exactly on the chunk ceiling at 4 capabilities and crosses it at 5", () => {
    const four = deriveTypeSignatures(lattice({ jobs: ["track", "record", "flip", "show"] }));
    assert.equal(four.length, 8, "4 capabilities ⇒ exactly P6_SYNTH_CHUNK_SIZE — the last single-chunk arity");
    const five = deriveTypeSignatures(lattice({ jobs: ["track", "record", "flip", "show", "publish"] }));
    assert.ok(five.length >= 9, `5 capabilities must cross into the chunked tree — got ${five.length}`);
  });

  it("returns [] for a capability-free lattice (byte-parity: no capabilities ⇒ no derived signatures)", () => {
    // The vague fallback lattice (both fallbacks fired) and a lattice whose
    // only job is the deliver-core-workflow sentinel never name a capability.
    const vague = lattice({ jobs: ["deliver-core-workflow"], entities: ["operator", "record"], vague: true });
    assert.deepEqual(deriveTypeSignatures(vague), []);
    assert.deepEqual(deriveTypeSignatures(lattice({ jobs: ["deliver-core-workflow"], entities: ["record"] })), []);
    assert.deepEqual(deriveTypeSignatures(lattice({ jobs: [], entities: [] })), []);
    assert.deepEqual(deriveTypeSignatures(lattice({ jobs: ["deliver-core-workflow", "track"] })).length, 2);
  });

  it("is pure and deterministic, dedupes, and never emits an unparsable name", () => {
    const a = lattice({ jobs: ["track", "flip"], entities: ["property", "showing"] });
    const b = lattice({ jobs: ["track", "flip"], entities: ["property", "showing"] });
    assert.deepEqual(deriveTypeSignatures(a), deriveTypeSignatures(b), "identical lattices ⇒ identical signatures");
    // Duplicate job labels (hand-built payload) collapse to one pair; a label
    // with no word characters (pascal("") = "") contributes nothing.
    const dupes = deriveTypeSignatures(lattice({ jobs: ["flip", "flip", "!!!", "record"] }));
    assert.equal(dupes.length, 4, "duplicate + unparseable labels must not fork signatures");
    for (const s of dupes) assert.match(s, /^(?:run|list)[A-Za-z][A-Za-z0-9]*\(/, `signature must parse a function name: ${s}`);
    // Entity rotation stays deterministic and an entity-free lattice still
    // yields the neutral `record` pair, never a crash or a shared reference.
    const noEntities = deriveTypeSignatures(lattice({ jobs: ["flip", "show"], entities: [] }));
    assert.ok(noEntities[0]!.includes("Record"), `entity-free pair falls back to Record — got ${noEntities[0]}`);
    assert.ok(noEntities[1]!.includes("FlipRun[]"), `second signature carries the job's Run row — got ${noEntities[1]}`);
  });
});

// ---------------------------------------------------------------------------
// 326 L4 — multi-word register terms weight like single-word terms. The freq
// count used `canonicalStem(term)` over the WHOLE term string; for a hyphenated
// entry ("work-order") the trailing `er` was stripped as an agent noun
// ("work-ord") and matched no bag token, so every multi-word term plateaued at
// the 0.35 base weight no matter how literally the brief named it (the same
// under-weighting class as 109 T-07, still live for hyphenated terms).
// ---------------------------------------------------------------------------

describe("326 L4 — multi-word register terms weight by phrase mentions", () => {
  const weightOf = (brief: string, label: string, domain: string): number | undefined =>
    intentLattice(brief, domain).nodes.find((n) => n.label === label)?.weight;
  // The implementation's own weight formula — compared exactly, not rounded.
  const expectWeight = (freq: number, constraint: boolean): number =>
    Math.min(1, 0.35 + freq * 0.2 + (constraint ? 0.15 : 0));

  it("scores a hyphenated term by its phrase, matching a one-word term", () => {
    assert.equal(weightOf("create a work order for the site", "work-order", "construction"), expectWeight(1, false));
    assert.equal(weightOf("work-order management", "work-order", "construction"), expectWeight(1, false));
    assert.equal(weightOf("set up follow-up reminders", "follow-up", "construction"), expectWeight(1, false));
    // constraint terms carry the extra +0.15 prior at one mention
    assert.equal(weightOf("same-day delivery", "same-day", "logistics"), expectWeight(1, true));
    // single-word path unchanged (0.55 for one mention)
    assert.equal(weightOf("track a ledger", "ledger", "analytics"), expectWeight(1, false));
    // repeated phrase mentions escalate exactly like the single-word path
    const once = weightOf("work order for the site", "work-order", "construction");
    const thrice = weightOf("work order work order work order", "work-order", "construction");
    assert.equal(once, expectWeight(1, false));
    assert.ok((thrice ?? 0) > (once ?? 0), `repeated phrase mentions must raise the weight (${thrice} vs ${once})`);
  });
});

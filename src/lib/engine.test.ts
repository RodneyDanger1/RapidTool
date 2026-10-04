// ---------------------------------------------------------------------------
// engine.test.ts — 325 A1/A1b pins: a persisted SEALED park must survive
// hydrate on the CLI load path (`preserveWildRun: true`).
//
// Run: node --experimental-strip-types --test src/lib/engine.test.ts
//
// Context (fixes/325_a1_hunt.md · A1-1, HIGH · data-integrity): hydrateWildRun
// rebuilds `wildRun` and carries `park`/`lastStep` only through structural
// guards. The park guard's accept-list used to be a hand-maintained mirror
// array that 313 D1's `agent-seal` union growth (types.ts:152) never reached —
// so `usableWildPark` returned null for every SEALED park: hydrate kept
// `pause:true`, dropped `park`, and (via the summary guard) the whole
// `lastStep` carrying it. The landed fix derives the accept-set from
// `WILD_UNLOCK_TEXT` — the compile-time-exhaustive `Record<WildParkUnlock,
// string>` — so the next union growth fails typecheck instead of silently
// dropping records (engine.ts: `acceptedParkUnlock`).
//
// Keyless + fully injected reviewer: no DEEPSEEK_API_KEY, no network, no TTY.
// Pins:
//   §A1-1a  a persisted sealed park (unlock "agent-seal", pause:true) hydrates
//           VERBATIM through the CLI path — park + lastStep byte-identical
//           (pre-fix: park undefined, lastStep undefined); a non-sealed park
//           keeps surviving too.
//   §A1-1b  the guard is derived, not blunted: every WildParkUnlock member is
//           accepted; garbage/near-miss unlock values are still rejected — at
//           run.park AND lastStep.park level.
//   §A1-1c  "park present iff pause" holds across the family: preserve-hydrate
//           (park kept), browser force-stop (cleared), stale-park drop, and
//           the CLI resume (wildResumeRun clears; re-hydrate stays clean).
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { approveHitl, emptyProject, databaseSchemaSql, deliveryKindOf, hydrateProject, liveLayer, wildLog, wildStep, withDeliveryKind, type WildReviewer } from "./engine.ts";
import { wildResumeRun } from "./headless.ts";
import type { RankableLessonRow } from "./knowledge.ts";
import type { RtEventSeed } from "./rt-events.ts";
import type { Project, WildParkInfo } from "./types.ts";

/** An ACTIVE wild-run project parked on the P0 approval gate (wild-seal.test.ts shape). */
function sealedFixture(): Project {
  const p = emptyProject({ name: "Sealed", brief: "A sealed brief for the autonomous loop." });
  p.wildMode = true;
  p.wildRun = {
    active: true,
    phase: 0,
    startedAt: Date.now(),
    lastAutoLog: "Wild run started at P0",
    lastAutoAt: Date.now(),
    stoppedAt: null,
    pause: false,
  };
  p.currentPhase = 0;
  p.status = "awaiting_hitl";
  p.phases[0] = { ...p.phases[0], status: "awaiting_hitl" };
  p.hitl = { phase: 0, title: "P0 gate", prompt: "Approve?", stakes: "high", forceHuman: false };
  return p;
}

const notConfigured: WildReviewer = async () => ({ ok: false, reason: "not-configured" });

/** The REAL sealed park: one keyless agentSeal step parks P0 on the missing classifier. */
async function sealedParkedProject(): Promise<Project> {
  const res = await wildStep(sealedFixture(), { reviewer: notConfigured, agentSeal: true });
  assert.equal(res.outcome, "paused");
  assert.equal(res.code, "RT_E_LLM_NOT_CONFIGURED");
  const park = res.project.wildRun?.park;
  assert.ok(park, "the sealed step stamps its park record");
  assert.equal(park.unlock, "agent-seal");
  return res.project;
}

/** The persisted payload a hand edit would produce: same parked run, tampered unlock. */
function taintedPark(p: Project, unlock: string): Project {
  const run = p.wildRun;
  const park = run?.park;
  assert.ok(run && park, "taint helper needs a parked run");
  return {
    ...p,
    wildRun: { ...run, park: { ...park, unlock: unlock as unknown as WildParkInfo["unlock"] } },
  };
}

describe("§A1-1a sealed-park hydrate round-trip (325 A1, HIGH)", () => {
  it("a persisted agent-seal park + its lastStep hydrate VERBATIM (CLI preset path)", async () => {
    const parked = await sealedParkedProject();
    const parkBefore = parked.wildRun?.park;
    const lastStepBefore = parked.wildRun?.lastStep;
    assert.ok(parkBefore, "in-memory: the park is stamped");
    assert.ok(lastStepBefore?.park, "in-memory: the summary mirrors the park");
    assert.equal(parked.wildRun?.pause, true);

    const re = hydrateProject(parked, { preserveWildRun: true });
    assert.equal(re.wildRun?.pause, true, "pause survives");
    const rePark = re.wildRun?.park;
    assert.ok(rePark, "the SEALED park survives hydrate (pre-fix: dropped to undefined)");
    assert.deepEqual(rePark, parkBefore, "park byte-identical");
    assert.equal(JSON.stringify(rePark), JSON.stringify(parkBefore), "verbatim in serialized bytes");
    const reLastStep = re.wildRun?.lastStep;
    assert.ok(reLastStep, "the lastStep carrying it survives (pre-fix: dropped whole)");
    assert.deepEqual(reLastStep, lastStepBefore, "lastStep byte-identical");
    assert.equal(JSON.stringify(reLastStep), JSON.stringify(lastStepBefore), "verbatim in serialized bytes");
    assert.equal(reLastStep.park?.unlock, "agent-seal");
  });

  it("a non-sealed park of the same shape keeps surviving (no regression)", async () => {
    const res = await wildStep(sealedFixture(), { reviewer: notConfigured });
    const park = res.project.wildRun?.park;
    assert.ok(park, "the unsealed pause stamps a park");
    assert.equal(park.unlock, "human-retry", "the pre-seal unlock class");
    const re = hydrateProject(res.project, { preserveWildRun: true });
    const rePark = re.wildRun?.park;
    assert.ok(rePark, "the non-sealed park survives hydrate");
    assert.deepEqual(rePark, park);
  });
});

describe("§A1-1b the accept-guard stays honest (derived, not blunted)", () => {
  /** Every member of the WildParkUnlock union (types.ts:152) — all must ride. */
  const ACCEPTED = ["configure-key", "human-gate", "human-retry", "resume", "operator", "agent-seal"] as const;
  /** Near-misses a weakened guard would swallow. */
  const REJECTED = ["agent-seal ", " Agent-Seal", "agent-seal\n", "agent_seal", "seal", "garbage", ""];

  it("every declared unlock class is accepted; near-miss / garbage values are rejected", async () => {
    const parked = await sealedParkedProject();
    for (const unlock of ACCEPTED) {
      const re = hydrateProject(taintedPark(parked, unlock), { preserveWildRun: true });
      assert.equal(re.wildRun?.park?.unlock, unlock, `"${unlock}" must round-trip`);
    }
    for (const unlock of REJECTED) {
      const re = hydrateProject(taintedPark(parked, unlock), { preserveWildRun: true });
      assert.equal(re.wildRun?.park ?? null, null, `"${unlock}" must not slip the guard`);
    }
  });

  it("a garbage unlock inside lastStep.park drops the whole summary (both levels guarded)", async () => {
    const parked = await sealedParkedProject();
    const run = parked.wildRun;
    const lastStep = run?.lastStep;
    assert.ok(run && lastStep?.park, "fixture carries the summary");
    const tainted: Project = {
      ...parked,
      wildRun: {
        ...run,
        lastStep: {
          ...lastStep,
          park: { ...lastStep.park, unlock: "bogus" as unknown as WildParkInfo["unlock"] },
        },
      },
    };
    const re = hydrateProject(tainted, { preserveWildRun: true });
    assert.equal(re.wildRun?.park?.unlock, "agent-seal", "the run-level park is still carried");
    assert.equal(
      re.wildRun?.lastStep ?? null,
      null,
      "the summary carrying the garbage park is dropped whole",
    );
  });
});

describe("§A1-1c park present iff pause — the invariant across the family", () => {
  it("preserve-hydrate keeps pause:true WITH the park (CLI load path)", async () => {
    const parked = await sealedParkedProject();
    const re = hydrateProject(parked, { preserveWildRun: true });
    assert.equal(re.wildRun?.pause, true);
    assert.ok(re.wildRun?.park, "pause ⇒ park is present");
  });

  it("default hydrate force-stops the session: pause:false, park cleared, history kept", async () => {
    const parked = await sealedParkedProject();
    const re = hydrateProject(parked);
    assert.equal(re.wildRun?.active, false, "the driver died with the session — active cannot survive");
    assert.equal(re.wildRun?.pause, false);
    assert.equal(re.wildRun?.park ?? null, null, "no park may ride the forced stop");
    assert.ok(re.wildRun?.lastStep, "the step history itself survives the stop");
  });

  it("a stale park on a non-paused run is dropped, never resurrected", async () => {
    const parked = await sealedParkedProject();
    const run = parked.wildRun;
    assert.ok(run);
    const stale: Project = { ...parked, wildRun: { ...run, pause: false } };
    const re = hydrateProject(stale, { preserveWildRun: true });
    assert.equal(re.wildRun?.pause, false);
    assert.equal(re.wildRun?.park ?? null, null, "park must not resurrect on a live run");
  });

  it("CLI resume clears the preserved park; the resumed run re-hydrates clean", async () => {
    const parked = await sealedParkedProject();
    const hydrated = hydrateProject(parked, { preserveWildRun: true });
    const resumed = await wildResumeRun(hydrated);
    assert.equal(resumed.ok, true);
    if (!resumed.ok) return;
    assert.equal(resumed.changed, true);
    assert.equal(resumed.project.wildRun?.pause, false);
    assert.equal(resumed.project.wildRun?.park ?? null, null, "resume clears the record");

    const re = hydrateProject(resumed.project, { preserveWildRun: true });
    assert.equal(re.wildRun?.pause, false);
    assert.equal(re.wildRun?.park ?? null, null, "no resurrection across a second save/load");
    assert.ok(re.wildRun?.lastStep, "the step record is not collateral");
  });
});

describe("§A1-2 a minted park's event names its OWN recording row (325 A1b)", () => {
  /** Park one arm's run + return the park and the project's wild.* ledger rows. */
  async function pauseArm(p: Project): Promise<{ park: WildParkInfo; rows: string[] }> {
    const res = await wildStep(p, { reviewer: notConfigured });
    assert.equal(res.outcome, "paused");
    const park = res.project.wildRun?.park;
    assert.ok(park, "the pause stamps a park record");
    const rows = (res.project.logs ?? [])
      .filter((l) => l.event.startsWith("wild."))
      .map((l) => l.event);
    return { park, rows };
  }

  it("unsealed classifier park references its wild.paused_classifier row (pre-fix: 'wild.paused')", async () => {
    const { park, rows } = await pauseArm(sealedFixture());
    assert.equal(park.event, "wild.paused_classifier");
    assert.ok(
      rows.includes("wild.paused_classifier"),
      `park.event must name an existing row (rows: ${rows.join(", ")})`,
    );
  });

  it("locked / rejected / human-only arms each reference THEIR OWN row", async () => {
    const locked = sealedFixture();
    locked.status = "running";
    locked.hitl = null;
    locked.phases[0] = { ...locked.phases[0], status: "locked" };
    const l = await pauseArm(locked);
    assert.equal(l.park.event, "wild.error");
    assert.ok(l.rows.includes("wild.error"), "the locked-edge wild.error row exists");

    const rejected = sealedFixture();
    rejected.status = "running";
    rejected.hitl = null;
    rejected.phases[0] = { ...rejected.phases[0], status: "rejected" };
    const r = await pauseArm(rejected);
    assert.equal(r.park.event, "wild.paused");
    assert.ok(r.rows.includes("wild.paused"), "the rejected-edge wild.paused row exists");

    const human = sealedFixture();
    human.hitl = { ...human.hitl!, forceHuman: true };
    const h = await pauseArm(human);
    assert.equal(h.park.event, "wild.paused_human");
    assert.ok(h.rows.includes("wild.paused_human"), "the human-only wild.paused_human row exists");
  });
});

describe("T4 · 112 §4.4 — deps.proven is additive on the engine's keyless P6 floor (330 · Composer)", () => {
  /** One resolved cross-project row (provenToLessonRow shape). */
  const PROVEN: readonly RankableLessonRow[] = [
    {
      id: "proven-K1deadbeef",
      kind: "semantic",
      phase: 0,
      text: "MARKER_PROVEN: a prior accepted run dropped the empty-column rejection guard — keep it.",
      score: 0.95,
      source: "research",
      tags: ["lesson"],
    },
  ];

  it("liveLayer(p, 6, { proven }) returns the byte-identical keyless floor as liveLayer(p, 6)", async () => {
    // The engine forwards deps verbatim to codegen ONLY on the keyed path; this
    // pins that adding proven changes nothing when keyless (no key ⇒ the
    // deterministic floor both times — the additive-field byte-identity law).
    const saved = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    try {
      const p = emptyProject({ name: "Proven", brief: "A kanban board tool with columns, cards and drag." });
      const plain = await liveLayer(p, 6);
      const withProven = await liveLayer(p, 6, { proven: PROVEN });
      assert.equal(withProven.generatedSource, plain.generatedSource, "keyless generated source unchanged");
      assert.deepEqual(
        withProven.artifacts.map((a) => a.title),
        plain.artifacts.map((a) => a.title),
        "keyless artifacts unchanged",
      );
      assert.deepEqual(
        withProven.logs.map((l) => l.event),
        plain.logs.map((l) => l.event),
        "keyless log events unchanged (proven mints no row)",
      );
    } finally {
      if (saved === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = saved;
    }
  });
});

// ---------------------------------------------------------------------------
// 331 V3 (telemetry invariant) — wildLog is a ledger writer: it must never
// throw into the run it observes. Pre-fix `[...p.logs, …]` raised
// "p.logs is not iterable" on a hand-built / foreign project with no `logs`
// array (the same class the 330 wave fixed in knowledge.ts lessonLog).
// ---------------------------------------------------------------------------
describe("331 V3 — wildLog never throws into the run it observes", () => {
  const base = () => emptyProject({ name: "Wild", brief: "A brief long enough to seal the lattice gate." });

  it("control: appends one ledger row on a normal project", () => {
    const p = base();
    const q = wildLog(p, 3, "info", "wild.test", "hello");
    assert.equal(q.logs.length, p.logs.length + 1, "exactly one row appended");
    assert.equal(q.logs.at(-1)!.event, "wild.test");
    assert.equal(q.logs.at(-1)!.phase, 3);
  });

  it("a hand-built project without a `logs` array still yields the row (never throws)", () => {
    const foreign = { ...base(), logs: undefined } as unknown as Project;
    const q = wildLog(foreign, 3, "warn", "wild.test", "no logs field");
    assert.equal(q.logs.length, 1, "the row lands, nothing thrown");
    assert.equal(q.logs[0]!.event, "wild.test");
    assert.equal(q.logs[0]!.level, "warn");
  });

  it("the ≤200-row window is preserved", () => {
    let p = base();
    for (let i = 0; i < 205; i++) p = wildLog(p, 0, "info", "wild.tick", `t${i}`);
    assert.equal(p.logs.length, 200, "capped at 200 like every log writer");
    assert.equal(p.logs.at(-1)!.detail, "t204", "newest row survives the cap");
  });
});

// ---------------------------------------------------------------------------
// W50/336-1 — the P12 database-schema producer (the 335-1 STOP item). The A6
// contract carries the schema input (entity names + typed fields), so the DDL
// is DERIVED; nothing is invented and an empty contract produces no schema.
// ---------------------------------------------------------------------------
describe("W50/336-1 — the P12 database-schema producer (derived, never invented)", () => {
  it("derives one CREATE TABLE per contract entity with the contract's own columns", () => {
    const sql = databaseSchemaSql({
      entities: [
        {
          name: "Shop",
          fields: [
            { name: "id", type: "ulid" },
            { name: "total", type: "int" },
            { name: "closedAt", type: "datetime?" },
            { name: "status", type: "enum" },
          ],
        },
      ],
      endpoints: [],
    });
    assert.match(sql, /CREATE TABLE IF NOT EXISTS "Shop" \(/);
    assert.match(sql, /"id" TEXT NOT NULL PRIMARY KEY/);
    assert.match(sql, /"total" INTEGER NOT NULL/);
    assert.match(sql, /"status" TEXT NOT NULL/);
    assert.match(sql, /"closedAt" TIMESTAMP/);
    assert.ok(!/"closedAt" TIMESTAMP NOT NULL/.test(sql), "a `?` field is nullable");
    assert.match(sql, /derived from the A6 data contract/);
    assert.match(sql, /provisions and runs no database \(B-18\)/);
  });

  it("fabricates nothing: an empty or absent contract yields no schema", () => {
    assert.equal(databaseSchemaSql(null), "");
    assert.equal(databaseSchemaSql(undefined), "");
    assert.equal(databaseSchemaSql({ entities: [], endpoints: [] }), "");
    assert.equal(databaseSchemaSql({ entities: [{ name: "", fields: [] }], endpoints: [] }), "");
    assert.equal(databaseSchemaSql({ entities: [{ name: "Empty", fields: [] }], endpoints: [] }), "");
  });

  it("is deterministic and escapes an embedded double quote in a name", () => {
    const c = { entities: [{ name: 'We"ird', fields: [{ name: "id", type: "ulid" }] }], endpoints: [] };
    assert.equal(databaseSchemaSql(c), databaseSchemaSql(c));
    assert.match(databaseSchemaSql(c), /"We""ird"/);
  });
});

// ---------------------------------------------------------------------------
// 342-4 — kind resolution single source of truth. The engine's brief
// classifier decides a library brief, but Project.kind could not EXPRESS
// "library", so the decision was never stored — the tree trigger read the
// absence signal instead. RED before the widening: hydration drops the value.
// ---------------------------------------------------------------------------
describe("342-4 — the stored delivery kind is the single source of truth", () => {
  const LIB_BRIEF = "A kanban board library exposing a typed board client";

  it("hydrateProject preserves a stored library kind (it must be expressible)", () => {
    const base = emptyProject({ name: "KanbanLib", brief: LIB_BRIEF });
    const h = hydrateProject({ ...base, kind: "library" } as never);
    assert.equal(h.kind, "library", "a declared library kind survives hydration, not dropped as junk");
  });

  it("deliveryKindOf is the ONE decision — library-first, and a stored kind always wins", () => {
    assert.equal(deliveryKindOf(emptyProject({ name: "KanbanLib", brief: LIB_BRIEF })), "library");
    assert.equal(deliveryKindOf(emptyProject({ name: "Dispatch", brief: "A kanban board for dispatch teams" })), "app");
    assert.equal(deliveryKindOf(emptyProject({ name: "Arcade", brief: "Retro arcade game with levels" })), "game");
    assert.equal(deliveryKindOf(emptyProject({ name: "Billing", brief: "Webhook worker API for billing" })), "service");
    // A stored value is read back verbatim — the brief is never re-inferred over it.
    assert.equal(deliveryKindOf(emptyProject({ name: "KanbanLib", brief: LIB_BRIEF, kind: "game" })), "game");
  });

  it("withDeliveryKind stamps the decision once and is idempotent", () => {
    const p = emptyProject({ name: "KanbanLib", brief: LIB_BRIEF });
    assert.equal(p.kind, undefined, "create leaves the kind absent (the stamp is the one decision point)");
    const stamped = withDeliveryKind(p);
    assert.equal(stamped.kind, "library");
    assert.equal(withDeliveryKind(stamped), stamped, "an already-decided project is returned unchanged");
  });
});

// ---------------------------------------------------------------------------
// 345 F2 · A1-05 — the mutation-invisible engine guards, pinned.
// Each test below fails if its guard is made inert (the V1 mutation probe found
// no suite failed on removal). They pin HEAD behavior; the source is unchanged.
// ---------------------------------------------------------------------------
describe("345 F2 (A1-05) — wildStep/approveHitl guards are fail-able", () => {
  /** An active, unpaused wild run whose cursor sits on `phase`. */
  function activeWildAt(phase: number, recordStatus: "ready" | "running"): Project {
    const p = emptyProject({ name: "Guarded", brief: "A governed field-service dispatch brief with enough vocabulary." });
    p.wildMode = true;
    p.currentPhase = phase as Project["currentPhase"];
    p.status = "running";
    p.wildRun = {
      active: true,
      phase,
      startedAt: Date.now(),
      lastAutoLog: "Wild run started",
      lastAutoAt: Date.now(),
      stoppedAt: null,
      pause: false,
    };
    p.phases = p.phases.map((r) => (r.id === phase ? { ...r, status: recordStatus } : r));
    return p;
  }

  it("pause guard: an active+PAUSED run is a noop (no phase may execute)", async () => {
    const p = activeWildAt(0, "ready");
    p.wildRun = { ...p.wildRun!, pause: true };
    const res = await wildStep(p, { reviewer: notConfigured });
    assert.equal(res.outcome, "noop");
    assert.equal(res.ran, false);
    assert.equal(res.project, p, "a paused step returns the input untouched");
  });

  it("priors-sealed guard: a READY edge with unsealed priors pauses (never executes over a gap)", async () => {
    const p = activeWildAt(2, "ready"); // P0/P1 stay locked from emptyProject
    const res = await wildStep(p, { reviewer: notConfigured });
    assert.equal(res.outcome, "paused");
    assert.equal(res.code, "RT_E_PHASE_ILLEGAL");
    assert.ok(res.project.logs.some((l) => l.event === "wild.paused_guard"), "the guard pause is ledgered");
  });

  it("approveHitl: an autopilot approval of a forceHuman gate throws (never a machine pass)", () => {
    const p = emptyProject({ name: "HumanOnly", brief: "A brief that parks on a human-only gate." });
    p.currentPhase = 0;
    p.status = "awaiting_hitl";
    p.phases[0] = { ...p.phases[0], status: "awaiting_hitl" };
    p.hitl = { phase: 0, title: "Reframe the brief", prompt: "Tighten the brief.", stakes: "high", forceHuman: true };
    assert.throws(
      () => approveHitl(p, { decidedBy: "autopilot" }),
      /Autopilot may not approve a forceHuman gate/,
      "no autopilot path may clear a human-only gate",
    );
  });
});

// ---------------------------------------------------------------------------
// 346 P2-6 — `boundedStepWatch`'s production consumer. Before this wiring the
// export had zero non-test callers (fixes/344 A3-05); now `wildStep` wraps its
// phase-execution await in it, so store `startWildRun` and the headless wild
// loops watch every executed step. The pins below fail without that call site:
// a real overrun must surface a coded row AND park the run (§5.2 tier 2), while
// a step inside budget must emit nothing new and keep its bytes.
// ---------------------------------------------------------------------------
describe("346 P2-6 — the wild step is watched by boundedStepWatch", () => {
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  /** A P6-ready wild fixture: priors 0-5 sealed, cursor on a ready phase 6. */
  function p6ReadyFixture(): Project {
    const p = emptyProject({ name: "WatchedWild", brief: "A governed wild-loop brief with enough vocabulary." });
    p.wildMode = true;
    p.wildRun = {
      active: true,
      phase: 6,
      startedAt: Date.now(),
      lastAutoLog: "Wild run at P6",
      lastAutoAt: Date.now(),
      stoppedAt: null,
      pause: false,
    };
    p.currentPhase = 6;
    p.status = "running";
    p.phases = p.phases.map((r) =>
      r.id < 6 ? { ...r, status: "complete" as const } : r.id === 6 ? { ...r, status: "ready" as const } : r,
    );
    return p;
  }

  function recorder(): { rows: RtEventSeed[]; onEvent: (seed: RtEventSeed) => void } {
    const rows: RtEventSeed[] = [];
    return { rows, onEvent: (seed) => rows.push(seed) };
  }

  /** Wall-clock masks only — the same volatile set the wild-step parity pin uses. */
  function normalize(p: Project): unknown {
    const strip = (s: string) =>
      s
        .replace(/compiled_at: [^\n]+/g, "compiled_at: FIXED")
        .replace(/project_id: [^\n]+/g, "project_id: FIXED")
        .replace(/"compiled_at": "[^"]+"/g, '"compiled_at": "FIXED"')
        .replace(/"project_id": "[^"]+"/g, '"project_id": "FIXED"')
        .replace(/"input_hash": "[^"]+"/g, '"input_hash": "FIXED"');
    return {
      ...p,
      id: "fixture",
      createdAt: 0,
      artifacts: (p.artifacts ?? []).map((a) => ({ ...a, body: strip(a.body) })),
      logs: (p.logs ?? []).map((l) => ({ ...l, ts: 0, detail: l.event === "wild.exec" ? "FIXED" : l.detail })),
      packet: strip(p.packet),
      traces: (p.traces ?? []).map((a) => ({ ...a, ranAt: 0 })),
      wildRun: p.wildRun
        ? {
            ...p.wildRun,
            startedAt: 0,
            lastAutoAt: 0,
            park: p.wildRun.park ? { ...p.wildRun.park, at: 0 } : p.wildRun.park,
            lastStep: p.wildRun.lastStep
              ? {
                  ...p.wildRun.lastStep,
                  park: p.wildRun.lastStep.park
                    ? { ...p.wildRun.lastStep.park, at: 0 }
                    : p.wildRun.lastStep.park,
                }
              : p.wildRun.lastStep,
          }
        : p.wildRun,
      phases: (p.phases ?? []).map((r) => ({
        ...r,
        startedAt: r.startedAt === null ? null : 0,
        completedAt: typeof r.completedAt === "number" ? 0 : r.completedAt,
        gate: r.gate && typeof r.gate === "object" ? { ...(r.gate as object), checkedAt: 0 } : r.gate,
      })),
    };
  }

  it("overrun: a step resolving at ≥ 2× budget fires the tier rows AND parks coded", async () => {
    const r = recorder();
    const res = await wildStep(p6ReadyFixture(), {
      reviewer: notConfigured,
      // Slow injected edge (any key state): resolves well past the 2× tier.
      p6Edge: async (q) => {
        await sleep(80);
        return { ...q, lastTest: { ok: true, detail: "slow edge" } };
      },
      onEvent: r.onEvent,
      stepBudgetMs: 20, // tier 1 = 20ms, tier 2 = 40ms
    });

    const names = r.rows.map((x) => x.event);
    assert.ok(names.includes("sys.step_overdue"), `tier-1 overdue row fired (got: ${names.join(", ")})`);
    assert.ok(names.includes("wild.step_timeout"), `tier-2 timeout row fired (got: ${names.join(", ")})`);
    const timeout = r.rows.find((x) => x.event === "wild.step_timeout")!;
    assert.equal(timeout.scope, "wild-step", "the timeout row's scope is its catalogue scope");
    assert.equal(timeout.code, "RT_E_LLM_TIMEOUT", "the timeout row is coded");

    assert.equal(res.outcome, "paused", "pause-on-resolve: an overrun must not silently advance");
    assert.equal(res.code, "RT_E_LLM_TIMEOUT");
    assert.equal(res.project.wildRun?.pause, true, "the run is parked");
    assert.equal(res.project.wildRun?.park?.unlock, "human-retry", "a human resumes to retry");
    assert.ok(
      (res.project.logs ?? []).some((l) => l.event === "wild.step_timeout"),
      "the park is ledgered under wild.step_timeout",
    );
  });

  it("normal path: a fast step fires NO watchdog rows and is byte-identical across budgets", async () => {
    const edge = async (q: Project): Promise<Project> => ({ ...q, lastTest: { ok: true, detail: "fast edge" } });

    const r = recorder();
    const within = await wildStep(p6ReadyFixture(), {
      reviewer: notConfigured,
      p6Edge: edge,
      onEvent: r.onEvent,
      stepBudgetMs: 20, // tiny, but the step resolves immediately
    });
    const names = r.rows.map((x) => x.event);
    assert.ok(!names.includes("sys.step_overdue"), `no overdue row on a fast step (got: ${names.join(", ")})`);
    assert.ok(!names.includes("wild.step_timeout"), `no timeout row on a fast step (got: ${names.join(", ")})`);
    assert.notEqual(within.code, "RT_E_LLM_TIMEOUT", "a fast step is never paused by the watchdog");

    // Control: the wrap is inert on the fast path — a different budget cannot
    // change the produced bytes (only wall-clock fields differ; masked).
    const large = await wildStep(p6ReadyFixture(), {
      reviewer: notConfigured,
      p6Edge: edge,
      stepBudgetMs: 1_000_000,
    });
    assert.deepEqual(normalize(large.project), normalize(within.project), "byte-identical modulo wall-clock");
    assert.equal(large.outcome, within.outcome);
    assert.equal(large.code, within.code);
  });
});

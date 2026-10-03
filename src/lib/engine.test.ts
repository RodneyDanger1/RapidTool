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
import { emptyProject, databaseSchemaSql, deliveryKindOf, hydrateProject, liveLayer, wildLog, wildStep, withDeliveryKind, type WildReviewer } from "./engine.ts";
import { wildResumeRun } from "./headless.ts";
import type { RankableLessonRow } from "./knowledge.ts";
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

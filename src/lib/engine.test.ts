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
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyPhaseResult, approveHitl, deepenResearch, emptyProject, databaseSchemaSql, declaresUiSurface, deliveryKindOf, filterOffIntentResearch, hydrateProject, inferDomain, inferName, isOffIntentResearch, liveLayer, recordPhaseSpend, rejectHitl, repairPhases, researchQueryText, stripOutOfScope, synthesizePhase, wildLog, wildStep, withDeliveryKind, type WildReviewer } from "./engine.ts";
import { exportProjectJson, importProject } from "./io.ts";
import { normalizeLedger, recordSessionSpend, resetSessionBudget, sessionTokenBudget, type TokenSpend } from "./token-ledger.ts";
import { wildResumeRun } from "./headless.ts";
import { PHASES } from "./phases.ts";
import { ALL_PHASES, runHeadless, seedProject } from "./testing/fixtures.ts";
import type { RankableLessonRow } from "./knowledge.ts";
import type { RtEventSeed } from "./rt-events.ts";
import type { PhaseId, Project, WildParkInfo } from "./types.ts";

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
// 346 T1 — classification matches the words a brief WROTE, never stem
// collisions. Pre-fix, tokenizeWords canonicalized every brief word and the
// registers were compared stem-to-stem, so ordinary English hijacked a domain/
// kind: a bakery site's "Home" page ⇒ real-estate, "shows"⇒showing,
// "list"⇒listing, "multi-tenant"⇒real-estate, "packaging"⇒package(library),
// "field-level"⇒level(game). Each assertion below failed on the pre-fix code.
// ---------------------------------------------------------------------------
describe("346 T1 — surface-word classification (no stem collisions)", () => {
  it("a marketing-site brief is not typed real-estate by its Home page", () => {
    const brief =
      "A marketing website for a neighbourhood bakery. Home page, a menu with allergen tags, an opening-hours badge, and an order form with field-level validation.";
    // W61 C2: the new `web-marketing` register names this correctly (it was
    // `custom-software` before the register existed); the 346 point stands — it
    // is NOT real-estate.
    assert.equal(inferDomain(brief), "web-marketing");
    assert.notEqual(inferDomain(brief), "real-estate");
  });

  it("a back-office with a product list and multi-tenant scope is operations, not real-estate", () => {
    const brief =
      "An internal back-office to take orders, manage inventory and stock, and show a product list. Multi-tenant support is out of scope.";
    assert.equal(inferDomain(brief), "operations");
  });

  it("an appointment 'title' field does not make a scheduler real-estate", () => {
    const brief = "An office shift and appointment scheduler: each appointment has a title, a room and a date.";
    assert.notEqual(inferDomain(brief), "real-estate");
  });

  it("a genuine rental brief still classifies real-estate (no false negative)", () => {
    const brief =
      "A rental portfolio manager: track each rental property, its tenants and lease terms, and collect rent payments.";
    assert.equal(inferDomain(brief), "real-estate");
  });

  it("'field-level' is not a game and 'packaging' is not a library", () => {
    const web = emptyProject({
      name: "Bakery",
      brief: "A bakery marketing website with field-level form validation and a menu.",
    });
    assert.equal(deliveryKindOf(web), "app");
    const mobile = emptyProject({
      name: "Companion",
      brief: "A mobile companion app; no app-store packaging required; works one-handed.",
    });
    assert.equal(deliveryKindOf(mobile), "app");
  });

  it("the unambiguous kind signals still decide game/library/service", () => {
    assert.equal(deliveryKindOf(emptyProject({ name: "Arcade", brief: "Retro arcade game with levels" })), "game");
    assert.equal(
      deliveryKindOf(emptyProject({ name: "Lib", brief: "A kanban board library exposing a typed board client" })),
      "library",
    );
    assert.equal(deliveryKindOf(emptyProject({ name: "Hook", brief: "A webhook worker API for billing" })), "service");
  });
});

// ---------------------------------------------------------------------------
// W62 · C1-07 (R-08) — the held-out brief must classify as a UI product, not a
// lending library. The proof is the REAL brief texts: the held-out community
// tool-library brief resolves {custom-software, app} while the seven campaign /
// historical briefs (byte-identical) keep their corrected labels. The rule is
// falsifiable, never keyed to the fixture: a genuine library brief still
// resolves `library`, and the SAME library noun with a declared UI surface
// resolves `app`.
// ---------------------------------------------------------------------------
describe("W62 C1-07 — the held-out tool-library brief is a UI app, not a lending library", () => {
  const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
  const TESTRUNS = join(REPO_ROOT, "..", "testruns");
  const CAMPAIGN = join(TESTRUNS, "campaign1");
  const EXPECTED: Record<string, { domain: string; kind: string }> = {
    "bakery-website": { domain: "web-marketing", kind: "app" },
    "flower-shop-website": { domain: "web-marketing", kind: "app" },
    "bakery-florist-orders": { domain: "web-marketing", kind: "app" },
    "mobile-companion": { domain: "mobile", kind: "app" },
    "office-invoice-tracker": { domain: "finance-ops", kind: "app" },
    "office-scheduler": { domain: "custom-software", kind: "app" },
    "office-stock-tracker": { domain: "operations", kind: "app" },
    "held-out-community-tool-library": { domain: "custom-software", kind: "app" },
  };
  const briefOf = (slug: string): string | null => {
    for (const root of [CAMPAIGN, TESTRUNS]) {
      const file = join(root, slug, "brief.md");
      if (existsSync(file)) return readFileSync(file, "utf8");
    }
    return null;
  };

  it("classifies the real held-out brief {custom-software, app} and never analytics/library", () => {
    const brief = briefOf("held-out-community-tool-library");
    if (!brief) return; // frozen checkout without the external fixtures: nothing to pin
    const domain = inferDomain(brief);
    const kind = deliveryKindOf({ brief, domain, lattice: null });
    assert.equal(domain, "custom-software", "the held-out tool-library brief is software, not analytics");
    assert.equal(kind, "app", "a declared UI surface is never kind:library");
  });

  it("keeps the seven campaign briefs' corrected labels (no regression)", () => {
    let checked = 0;
    for (const slug of Object.keys(EXPECTED).filter((s) => s !== "held-out-community-tool-library")) {
      const brief = briefOf(slug);
      if (!brief) continue;
      const domain = inferDomain(brief);
      const kind = deliveryKindOf({ brief, domain, lattice: null });
      assert.equal(domain, EXPECTED[slug]!.domain, `${slug}: domain`);
      assert.equal(kind, EXPECTED[slug]!.kind, `${slug}: kind`);
      checked++;
    }
    assert.ok(checked === 0 || checked === 7, `expected all seven fixtures or none, checked ${checked}`);
  });

  it("the rule keys on the declared surface, not the fixture nouns", () => {
    const lib = "A kanban board library exposing a typed board client";
    assert.equal(declaresUiSurface(lib), false);
    assert.equal(deliveryKindOf(emptyProject({ name: "KanbanLib", brief: lib })), "library");
    const uiLib = "A kanban board library that ships a dashboard screen";
    assert.equal(declaresUiSurface(uiLib), true);
    assert.equal(
      deliveryKindOf(emptyProject({ name: "KanbanLibUi", brief: uiLib })),
      "app",
      "the same library noun with a UI surface is a UI product",
    );
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

// ---------------------------------------------------------------------------
// 346 K3 — console PHASE-run spend. The engine meters every model call it makes
// during a step into the PROCESS session ledger; the exported `wildStep`
// wrapper surfaces the step's measured DELTA to `opts.onUsage`, so a driver
// (store.startWildRun) can fold it into `Project.tokenUsage`. The sink is pure
// observation: a step with a sink produces the same result as one without it,
// and an unmeasured step never calls the sink (no fabricated zero).
// ---------------------------------------------------------------------------
describe("346 K3 - wildStep surfaces the step measured session-ledger usage to onUsage", () => {
  /** A P6-ready wild fixture: priors 0-5 sealed, cursor on a ready phase 6. */
  function spendP6Fixture(): Project {
    const p = emptyProject({ name: "SpendWild", brief: "A governed wild-loop brief with enough vocabulary." });
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

  it("hands the REAL metered delta to onUsage and leaves the step result unchanged", async () => {
    resetSessionBudget();
    /** The injected edge stands in for a model call: it meters a REAL session spend. */
    const meteringEdge = async (q: Project): Promise<Project> => {
      recordSessionSpend({ promptTokens: 111, completionTokens: 22 });
      return { ...q, lastTest: { ok: true, detail: "edge metered one call" } };
    };

    const seen: TokenSpend[] = [];
    const withSink = await wildStep(spendP6Fixture(), {
      reviewer: notConfigured,
      p6Edge: meteringEdge,
      onUsage: (u) => seen.push(u),
    });
    assert.equal(seen.length, 1, "the sink fires exactly once for a measured step");
    assert.deepEqual(seen[0], { promptTokens: 111, completionTokens: 22, calls: 1 }, "the delta is the REAL metered usage");

    // Control: the SAME step with no sink behaves identically (pure observation).
    resetSessionBudget();
    const without = await wildStep(spendP6Fixture(), { reviewer: notConfigured, p6Edge: meteringEdge });
    assert.equal(withSink.outcome, without.outcome, "the sink never changes the outcome");
    assert.equal(withSink.code, without.code, "the sink never changes the code");
    assert.equal(withSink.ran, without.ran, "the sink never changes progress");
    assert.equal(withSink.summary?.action, without.summary?.action, "the sink never changes what the step did");
    assert.equal(withSink.summary?.completedPhase, without.summary?.completedPhase);
    assert.equal(withSink.summary?.advancedTo, without.summary?.advancedTo);
  });

  it("never calls onUsage when nothing was metered (no fabricated zero)", async () => {
    resetSessionBudget();
    const floorEdge = async (q: Project): Promise<Project> => ({ ...q, lastTest: { ok: true, detail: "floor edge" } });
    const seen: TokenSpend[] = [];
    await wildStep(spendP6Fixture(), { reviewer: notConfigured, p6Edge: floorEdge, onUsage: (u) => seen.push(u) });
    assert.equal(seen.length, 0, "an unmeasured step calls no sink - nothing to record");
  });
});

// ---------------------------------------------------------------------------
// 350 (F1) — the console phase-run twin: runPhaseAsync folds the phase's
// MEASURED session-ledger delta onto its PhaseRecord.spend (the engine helper
// is the same arithmetic as headless.recordPhaseSpend, pinned directly here).
// ---------------------------------------------------------------------------
describe("350 F1 - engine.recordPhaseSpend writes only a measured delta", () => {
  it("folds a measured delta and no-ops an empty one", () => {
    resetSessionBudget();
    const p = emptyProject({ name: "PhaseSpend", brief: "a brief with enough vocabulary for the engine" });
    const baseline = normalizeLedger(sessionTokenBudget().ledger);
    recordSessionSpend({ promptTokens: 77, completionTokens: 9 });
    const measured = recordPhaseSpend(p, 6 as PhaseId, baseline);
    assert.deepEqual(measured.phases.find((r) => r.id === 6)!.spend, { promptTokens: 77, completionTokens: 9, calls: 1 });
    const baseline2 = normalizeLedger(sessionTokenBudget().ledger);
    assert.equal(recordPhaseSpend(measured, 6 as PhaseId, baseline2), measured, "an empty delta leaves the record untouched");
  });
});

// ---------------------------------------------------------------------------
// M7-01 (fixes/310) — a phase record that repairPhases has to INSERT must carry
// the same hydrate birth-stamps (rejectionHistory/gate) a KEPT record gets.
// Without them the repaired payload's first export→import→export hop silently
// ADDED both keys (the exact drift M7-01 exists to kill).
// ---------------------------------------------------------------------------
describe("M7-01 - a repaired phase INSERT is already normalized (no first-hop key drift)", () => {
  it("repairPhases stamps rejectionHistory/gate on inserted records", () => {
    const base = emptyProject({ name: "Repair", brief: "a repaired brief with vocabulary" });
    const raw = base.phases.filter((p) => p.id !== 5);
    const rep = repairPhases(raw as never);
    assert.deepEqual(rep.inserted, [5]);
    assert.deepEqual(rep.phases.find((p) => p.id === 5), {
      id: 5,
      status: "locked",
      rejectionHistory: [],
      gate: null,
    });
  });

  it("a missing-phase payload export→import→export is byte-stable on the FIRST hop", () => {
    const base = emptyProject({ name: "Repair", brief: "a repaired brief with vocabulary", enforceDod: false });
    const raw = JSON.parse(exportProjectJson(base)) as { phases: unknown[] };
    raw.phases.splice(5, 1);
    const hydrated = hydrateProject(raw as never);
    const e1 = exportProjectJson(hydrated);
    const imported = importProject(e1);
    assert.equal(imported.ok, true, "the repaired export still imports");
    assert.equal(
      exportProjectJson((imported as { project: Project }).project),
      e1,
      "the inserted record must not gain rejectionHistory/gate on the next hop",
    );
  });
});

// ---------------------------------------------------------------------------
// H-03 / B-25 - repairs are LOUD, never silent. The research normalizer dropped
// entry-level junk (a null/non-object entry, or `items` that is not an array)
// without setting researchRepaired → the entry vanished from the corpus with no
// hydrate.repaired row. The flag now names every entry-level drop.
// ---------------------------------------------------------------------------
describe("H-03 - entry-level research drops are recorded in hydrate.repaired", () => {
  const cases: [string, unknown][] = [
    ["a null entry", [null]],
    ["a primitive entry", [5]],
    ["an entry whose items is not an array", [{ items: 5 }]],
  ];
  for (const [label, research] of cases) {
    it(`logs the repair for ${label}`, () => {
      const base = emptyProject({ name: "Research", brief: "a research brief with vocabulary" });
      const h = hydrateProject({ ...base, research } as never);
      assert.deepEqual(h.research, [], "the junk entry contributes nothing");
      assert.ok(
        h.logs.some((l) => l.event === "hydrate.repaired" && String(l.detail).includes("research:dropped")),
        "the drop is named in the repair log",
      );
    });
  }
});

// ---------------------------------------------------------------------------
// Uncoded-failure lead: every engine refusal a machine caller can hit carries
// its RT_E_* code on the thrown Error (the phases.ts phaseDef precedent), so a
// caller classifies on `err.code` and never string-matches the message.
// ---------------------------------------------------------------------------
describe("engine refusals carry their RT_E_* code (never an uncoded throw)", () => {
  const codeOf = (fn: () => unknown): string | undefined => {
    try {
      fn();
    } catch (e) {
      return (e as { code?: string }).code;
    }
    return undefined;
  };

  it("applyPhaseResult refuses an out-of-graph phase as RT_E_PHASE_ILLEGAL", () => {
    const p = emptyProject({ name: "Coded", brief: "a coded refusal brief" });
    assert.equal(codeOf(() => applyPhaseResult(p, 99 as never)), "RT_E_PHASE_ILLEGAL");
  });

  it("approveHitl refuses a missing/invalid seat and a machine forceHuman pass as RT_E_VALIDATION", () => {
    const p = emptyProject({ name: "Coded", brief: "a coded refusal brief" });
    p.status = "awaiting_hitl";
    p.phases[0] = { ...p.phases[0], status: "awaiting_hitl" };
    p.hitl = { phase: 0, title: "Gate", prompt: "Approve?", stakes: "high", forceHuman: false };
    assert.equal(codeOf(() => approveHitl(p, { decidedBy: "agent" as never })), "RT_E_VALIDATION");
    p.hitl = { phase: 0, title: "Human only", prompt: "Approve?", stakes: "high", forceHuman: true };
    assert.equal(codeOf(() => approveHitl(p, { decidedBy: "autopilot" })), "RT_E_VALIDATION");
  });

  it("rejectHitl refuses short feedback as RT_E_VALIDATION", () => {
    const p = emptyProject({ name: "Coded", brief: "a coded refusal brief" });
    p.status = "awaiting_hitl";
    p.phases[0] = { ...p.phases[0], status: "awaiting_hitl" };
    p.hitl = { phase: 0, title: "Gate", prompt: "Approve?", stakes: "high", forceHuman: false };
    assert.equal(codeOf(() => rejectHitl(p, "too short")), "RT_E_VALIDATION");
  });

  it("the scorecard precondition refusal is RT_E_INTERNAL (its own comment says the branch is unreachable)", () => {
    const p = emptyProject({ name: "Coded", brief: "a coded refusal brief" });
    p.lattice = null;
    assert.equal(codeOf(() => synthesizePhase(p, 0)), "RT_E_INTERNAL");
  });
});

// ---------------------------------------------------------------------------
// W61 lane C - C2 (classifier taxonomy + negation stripping) and C3 (inferName
// markdown strip). RED before the change: the negation fixture matched tenant
// from an out-of-scope line; every name began with "# ".
// ---------------------------------------------------------------------------
describe("W61 C2 - classifier registers + out-of-scope stripping", () => {
  it("an out-of-scope 'multi-tenant' line no longer forces real-estate", () => {
    const brief =
      "An internal back-office to take orders, manage inventory and stock, and show a product list. Multi-tenant support is out of scope.";
    assert.equal(inferDomain(brief), "operations");
    assert.notEqual(inferDomain(brief), "real-estate");
    // The negated sentence is dropped; the first sentence's nouns survive.
    const stripped = stripOutOfScope(brief);
    assert.ok(stripped.includes("inventory"), "the kept sentence survives");
    assert.ok(!/multi-?tenant/i.test(stripped), "the negated sentence is removed");
  });

  it("drops an entire 'Explicitly out of scope' section (barcode/supplier never become core)", () => {
    const brief =
      "# Tracker\n\n## What this is\nTrack items and reorder stock.\n\n## Explicitly out of scope\n- Barcode scanning.\n- Supplier ordering.\n";
    const stripped = stripOutOfScope(brief);
    assert.ok(stripped.includes("reorder"), "in-scope text survives");
    assert.ok(!/barcode/i.test(stripped), "out-of-scope barcode removed");
    assert.ok(!/supplier/i.test(stripped), "out-of-scope supplier removed");
  });

  it("the new web/retail/mobile registers classify, not fall through to a bare default", () => {
    assert.equal(inferDomain("A marketing website with a landing page and brand content"), "web-marketing");
    assert.equal(inferDomain("A retail shop with a storefront, checkout cart and till"), "retail");
    assert.equal(inferDomain("A mobile app for ios and android with a touchscreen-friendly viewport"), "mobile");
  });

  it("a website/mobile brief is an app kind (the surface nouns are explicit)", () => {
    assert.equal(deliveryKindOf(emptyProject({ name: "Site", brief: "A marketing website with pages and a menu" })), "app");
    assert.equal(deliveryKindOf(emptyProject({ name: "App", brief: "A mobile app with a bottom tab bar" })), "app");
  });
});

describe("W61 C3 - inferName strips markdown without truncating mid-word", () => {
  it("strips the H1 marker and the subtitle separator", () => {
    assert.equal(inferName("# Golden Crust Bakery - Marketing Website\n\nBody text."), "Golden Crust Bakery");
    assert.equal(inferName("# Wildstem Florist - Marketing Website"), "Wildstem Florist");
    assert.equal(inferName("# Officestock - Office Supplies Inventory Tracker"), "Officestock");
  });

  it("never returns a leading '#' or a trailing separator", () => {
    for (const brief of [
      "# Crumb & Bloom Companion - Mobile App",
      "# Shiftline - Office Shift & Appointment Scheduler",
      "# Ledgeline - Office Invoice & Expense Tracker",
      "# Wildstem Florist -",
    ]) {
      const name = inferName(brief);
      assert.ok(!name.startsWith("#"), `no leading # (${name})`);
      assert.ok(!/[-\u2014|:]\s*$/.test(name), `no trailing separator (${name})`);
      assert.ok(name.trim().length > 0 && name !== "Untitled system", `a real name (${name})`);
    }
  });

  it("caps at four whole words, never mid-word", () => {
    const name = inferName("# A Very Long Product Name That Keeps Going");
    assert.equal(name, "A Very Long Product");
  });
});

// ---------------------------------------------------------------------------
// W61 lane C - C6: engine.deepenResearch must refuse an empty-corpus deepen
// instead of stamping a liveUnavailable waiver + re-recording a FAILED gate to
// PASS (R1 BL-011 residual; the 346-T2 fix guarded only the store wrapper).
// ---------------------------------------------------------------------------
describe("W61 C6 - deepenResearch empty-corpus guard", () => {
  const p7Complete = (): Project => {
    const p = emptyProject({ name: "Deep", brief: "A field-service research deepen brief with vocabulary." });
    p.phases = p.phases.map((r) =>
      r.id === 7
        ? {
            ...r,
            status: "complete" as const,
            gate: { passed: false, unmet: ["p7-research"], evidenceHash: "deadbeefcafe", checkedAt: 1 },
          }
        : r,
    );
    return p;
  };

  it("a no-findings deepen refuses (RT_E_RESEARCH_UNAVAILABLE) and records nothing", async () => {
    const code = await deepenResearch(p7Complete(), 7 as PhaseId, async () => ({
      items: [],
      narrative: null,
      provider: null,
      unavailable: true,
    })).then(
      () => null,
      (e: { code?: string }) => e.code ?? null,
    );
    assert.equal(code, "RT_E_RESEARCH_UNAVAILABLE", "the empty-corpus deepen is a coded refusal");
  });

  it("a deepen that lands findings still re-records (the guard is not over-broad)", async () => {
    const out = await deepenResearch(p7Complete(), 7 as PhaseId, async () => ({
      items: [{ title: "t", url: "https://e/x", content: "c" }],
      narrative: null,
      provider: "tavily",
      unavailable: false,
    }));
    assert.ok((out.research ?? []).length > 0, "the corpus landed");
    assert.notEqual(
      out.phases.find((r) => r.id === 7)?.gate?.evidenceHash,
      "deadbeefcafe",
      "the gate was re-recorded over a real corpus",
    );
  });
});

// ---------------------------------------------------------------------------
// W61 lane C - C9 (PR-17): intent-first research query + deterministic
// off-intent filter. RED before the change: the domain noun bag LED the query,
// so a bakery/flower P0 pass researched "property rental tenant lease …
// architecture feasibility" and grounded itself in rental/lease category pages
// (BL-001 recurrence); nothing dropped an off-intent category page from an
// engineering-phase corpus.
// ---------------------------------------------------------------------------
describe("W61 C9 - intent-first research query + off-intent filter", () => {
  const p0Intent = "architecture feasibility 2026";

  it("the phase intent leads; at most 3 domain qualifiers follow", () => {
    const p = emptyProject({
      name: "Golden Crust Bakery",
      brief:
        "# Golden Crust Bakery\n\nA marketing website for a bakery: menu, order pickup, delivery zones, contact.",
    });
    p.domain = "web-marketing";
    const q = researchQueryText(p, p0Intent);
    assert.ok(q.startsWith(p0Intent), `the phase intent leads (got: ${q})`);
    const qualifiers = q.slice(p0Intent.length).trim().split(/\s+/).filter(Boolean);
    assert.ok(qualifiers.length >= 1, "at least one domain qualifier rides along");
    assert.ok(
      qualifiers.length <= 3,
      `at most 3 domain qualifiers (got ${qualifiers.length}: ${qualifiers.join(" ")})`,
    );
  });

  it("a mislabeled real-estate domain no longer makes the domain bag lead", () => {
    const p = emptyProject({
      name: "Wildstem Florist",
      brief: "A florist website selling bouquets with delivery zones and an enquiry form.",
    });
    p.domain = "real-estate";
    const q = researchQueryText(p, p0Intent);
    assert.ok(q.startsWith(p0Intent), "the phase intent is the subject, never the domain");
    // If a domain noun rides along at all it can only follow the intent.
    const firstDomain = q.search(/\b(rental|tenant|lease|property)\b/);
    assert.ok(firstDomain === -1 || firstDomain > 0, "domain nouns never precede the intent");
  });

  it("the blocklist drops a rental/lease category page for an engineering phase", () => {
    const listing = {
      title: "Apartments for Rent in Austin, TX",
      url: "https://www.apartments.com/austin-tx/",
      content: "Find your next rental home.",
    };
    const tutorial = {
      title: "React architecture patterns for a property management app",
      url: "https://example.com/blog/react-architecture",
      content: "How to build the frontend and wire the API.",
    };
    assert.equal(isOffIntentResearch(p0Intent, listing), true, "the listings page is off-intent");
    assert.equal(isOffIntentResearch(p0Intent, tutorial), false, "the software-building page is kept");
    const { accepted, dropped } = filterOffIntentResearch(p0Intent, [listing, tutorial]);
    assert.deepEqual(accepted, [tutorial], "only the on-intent result survives");
    assert.deepEqual(dropped, [listing], "the off-intent result is dropped");
  });

  it("the blocklist is inert outside engineering phases (a competitor pass keeps domain pages)", () => {
    const listing = {
      title: "Best rental property management software",
      url: "https://example.com/rental-software",
    };
    assert.equal(
      isOffIntentResearch("competitors market landscape", listing),
      false,
      "P7 market-landscape research is not subject to the engineering blocklist",
    );
  });
});

// ---------------------------------------------------------------------------
// 349 L3 — every pipeline stage produces a real, visible artifact. The
// per-phase Artifact rows are the run's "real output", so a full keyless run
// must leave ≥1 artifact with a NON-EMPTY body on every phase 0..12 (a phase
// whose body were empty would render as a blank deliverable). Drives the same
// real engine via the shared fixtures (runHeadless → applyPhaseResult, the
// deterministic keyless floor) — no mocks, no key, no network.
// ---------------------------------------------------------------------------
describe("349 L3 — every phase 0..12 records ≥1 artifact with a non-empty body after a full run", () => {
  const done = runHeadless(seedProject(), ALL_PHASES);

  it("the run is a real, complete keyless pipeline (P12 sealed)", () => {
    assert.equal(done.status, "complete");
    assert.equal(done.currentPhase, 12);
    assert.equal(done.phases.filter((r) => r.status === "complete").length, PHASES.length);
  });

  it("each phase records at least one artifact whose body is real (non-empty)", () => {
    for (const def of PHASES) {
      const rows = (done.artifacts ?? []).filter((a) => a.phase === def.id);
      assert.ok(rows.length >= 1, `P${def.id} ${def.title} recorded no artifact`);
      assert.ok(
        rows.some((a) => typeof a.body === "string" && a.body.trim().length > 0),
        `P${def.id} ${def.title}: every recorded artifact has an empty body`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// W11 · LANE 2 (watchdog) — honesty guard tests. ADDITIVE: no production
// module is modified by this file. Each block pins a non-negotiable invariant
// from RESUME.md §5.4 against the actual behaviour on disk, so every test is
// written to FAIL for its own reason (see the assertion messages; no
// tautologies — scripts/check-assertion-gaps.mjs is a gate).
//
// Pins (evidence in /fixes/217b_watchdog_verification.md):
//   1. T-11 green-seal gate — a RED seal (complete phase + unmet DoD gate)
//      mints NO lesson row; the signal is a `p<N>.seal.unmet` warn log naming
//      the unmet DoD probe ids (engine.ts:1463-1496 as landed by W10-L1).
//   2. T-11 over-gating guard — the green deterministic floor records no
//      seal.unmet log, and the L2 writer still mints from machine evidence.
//   3. T-11 probe tags — a lesson row built from a failureSignature carrying
//      `anchors:` exposes one `probe:<id>` tag per anchor (knowledge.ts:911
//      probeTagsFromSignature); an anchor-less signature exposes none.
//   4. T-107.6 runner output cap — clampRunnerOutput (node-runner.server.ts:91)
//      is a byte-identical no-op at/below the cap and a COUNTED middle-elision
//      above it; the tiny-cap branch counts what it drops.
//   5. T4.1/TA-16 verify-kind — a non-package.json dir is ok:false +
//      RT_E_VALIDATION; a package.json with no `build` script is
//      ok:true, skipped:true (an absent script is never a pass).
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyPhaseResult, approveHitl, rejectHitl } from "./engine.ts";
import type { PhaseId, Project } from "./types.ts";
import { runGate } from "./dod.ts";
import { runHeadless, runToGate, seedProject } from "./testing/fixtures.ts";
import { failureSignature, lessonRow, templateEmissionLesson } from "./knowledge.ts";
import { RUNNER_OUTPUT_MAX_CHARS, clampRunnerOutput } from "./node-runner.server.ts";
import { verifyKindDir } from "./compile-check.server.ts";

/** Warm the engine's lazy lesson seam (engine.ts:96 `void import("./knowledge.ts")`)
 *  so `applyPhaseResult`'s seal branch (`!needsHitl && lessonSurface`) is live. */
async function warmLessonSeam(): Promise<void> {
  await import("./knowledge.ts");
  await new Promise((resolve) => setTimeout(resolve, 250));
}

describe("W11 L2 honesty guards — T-11 red seal mints no lesson", () => {
  it("a RED seal mints no lesson row and records a p6.seal.unmet warn log naming the unmet probe ids", async () => {
    await warmLessonSeam();
    const parked = runToGate(seedProject(), 6);
    const out = applyPhaseResult(parked, 6);
    // Control: this fixture IS a red seal (complete + unmet DoD + no HITL). If
    // the fixture ever flips green, the test must fail HERE — never pass
    // vacuously by losing the precondition.
    assert.equal(out.phases.find((r) => r.id === 6)?.status, "complete", "P6 must seal complete (red-seal precondition)");
    assert.equal(runGate(out, 6).pass, false, "P6 gate must be UNMET here (red-seal precondition)");
    const before = new Set((parked.memory ?? []).map((m) => m.id));
    const newLessons = (out.memory ?? []).filter(
      (m) => String(m.id).startsWith("lesson-") && !before.has(m.id),
    );
    assert.equal(
      newLessons.length,
      0,
      "a red seal must mint no lesson row — the F-08 contradiction (a lesson whose probe never passed)",
    );
    const seal = (out.logs ?? []).find((l) => l.event === "p6.seal.unmet");
    assert.ok(seal, "the red seal must be recorded as a p6.seal.unmet log row (not a silent fallback)");
    assert.equal(seal.level, "warn");
    assert.equal(seal.phase, 6);
    assert.match(
      String(seal.detail),
      /\[p6-verified, p6-brief-fit\]/,
      "the log must name the unmet DoD probe ids a green seal would have to satisfy",
    );
    assert.ok(
      !(out.logs ?? []).some((l) => l.event === "lesson.capture"),
      "no lesson.capture ledger event may fire on the red-seal path",
    );
  });

  it("green seals 0-5 record no seal.unmet log, mint no lesson row, and the L2 writer still mints (over-gating guard)", async () => {
    await warmLessonSeam();
    const p = runHeadless(seedProject(), [0, 1, 2, 3, 4, 5]);
    for (const phase of [0, 1, 2, 3, 4, 5]) {
      assert.equal(p.phases.find((r) => r.id === phase)?.status, "complete", `phase ${phase} seals complete`);
      assert.equal(runGate(p, phase).pass, true, `phase ${phase} gate is green (green-seal control)`);
    }
    assert.ok(
      !(p.logs ?? []).some((l) => String(l.event).endsWith(".seal.unmet")),
      "a green seal must never record a seal.unmet log",
    );
    assert.equal(
      (p.memory ?? []).filter((m) => String(m.id).startsWith("lesson-")).length,
      0,
      "the deterministic green floor mints no lesson rows",
    );
    // T-11 must not over-gate: the normal L2 writer still mints a row from
    // machine evidence (the surviving headless/report-intake path rides it).
    const row = templateEmissionLesson(p, 6, ["p6-verified", "p6-brief-fit"]);
    assert.match(row.id, /^lesson-template-emission-[0-9a-f]{8}$/, "writer still content-addresses its row");
    assert.ok(
      (row.tags ?? []).includes("lesson") &&
        (row.tags ?? []).includes("template-emission") &&
        (row.tags ?? []).includes("L2"),
      "writer row carries its class tags",
    );
    assert.ok(
      !(p.memory ?? []).some((m) => m.id === row.id),
      "the writer mints ON DEMAND — the green seal path itself added nothing",
    );
  });
});

describe("W11 L2 honesty guards — T-11 probe:<id> tags on lesson rows", () => {
  it("a lesson row built from a signature carrying anchors exposes probe:<id> tags; an anchor-less signature exposes none", () => {
    const spec = {
      classShort: "template-emission",
      level: "L2",
      kind: "episodic",
      phase: 6,
      text: "unmet: sample digest",
      score: 0.7,
      source: "engine",
    } as const;
    const anchored = lessonRow({
      ...spec,
      signature: failureSignature({ kind: "gate-unmet", phase: 6, anchors: ["p6-verified", "p6-brief-fit"] }),
    });
    assert.ok(
      (anchored.tags ?? []).includes("probe:p6-verified") &&
        (anchored.tags ?? []).includes("probe:p6-brief-fit"),
      "an anchored signature must surface every probe id ON the row (T-11 half 2) — see knowledge.ts:911",
    );
    const anchorless = lessonRow({
      ...spec,
      signature: failureSignature({ kind: "gate-unmet", phase: 6, detailTail: "no anchors here" }),
    });
    assert.ok(
      !(anchorless.tags ?? []).some((t) => t.startsWith("probe:")),
      "an anchor-less signature (tail: fallback) must expose NO probe tag",
    );
    // The writer path inherits the tags with no caller change:
    const viaWriter = templateEmissionLesson(seedProject(), 6, ["p6-verified"]);
    assert.ok(
      (viaWriter.tags ?? []).includes("probe:p6-verified"),
      "templateEmissionLesson's row must inherit the probe tag (every writer goes through lessonRow)",
    );
  });
});

describe("W11 L2 honesty guards — T-107.6 runner output cap", () => {
  it("clampRunnerOutput is a byte-identical no-op below the cap and a COUNTED middle-elision above it", () => {
    const under = "hello world";
    const rUnder = clampRunnerOutput(under, 100);
    assert.equal(rUnder.text, under, "at/below the cap the text stays byte-identical");
    assert.equal(rUnder.clamped, false);
    assert.equal(rUnder.elidedChars, 0, "nothing elided below the cap");

    const input = `${"A".repeat(200)}TAIL-END`; // 208 chars
    const r = clampRunnerOutput(input, 200);
    assert.equal(r.clamped, true, "over-cap text is clamped");
    assert.equal(r.originalChars, input.length, "the original size is reported, not the clamped size");
    const marker = r.text.match(/\n… \[(\d+) chars elided by runner output cap\] …\n/);
    assert.ok(marker, "the elision marker must survive intact (marked cut, never a silent one)");
    assert.equal(Number(marker[1]), r.elidedChars, "the marker names exactly the counted elision");
    assert.equal(
      r.originalChars - (r.text.length - marker[0].length),
      r.elidedChars,
      "elidedChars === originalChars − the text kept OUTSIDE the marker (head+tail)",
    );
    assert.ok(r.text.startsWith(input.slice(0, 120)), "the head survives (first 60% of the cap)");
    assert.ok(r.text.endsWith("TAIL-END"), "the tail survives (the final failure lines)");

    // Cap too small for a marked elision (< 64): plain head-cut that still counts.
    const tiny = clampRunnerOutput(input, 40);
    assert.equal(tiny.text.length, 40);
    assert.equal(tiny.clamped, true);
    assert.equal(tiny.elidedChars, tiny.originalChars - tiny.text.length, "even the plain cut counts what it dropped");
  });
});

describe("W11 L2 honesty guards — T4.1/TA-16 verify-kind never fabricates", () => {
  it("a non-package.json dir is ok:false + RT_E_VALIDATION; a no-build tree is ok:true, skipped:true", async () => {
    const noPkg = mkdtempSync(join(tmpdir(), "rt-hg-nopkg-"));
    try {
      const r = await verifyKindDir(noPkg);
      assert.equal(r.ok, false, "a dir that is not an emitted kind tree must never be ok");
      assert.equal(r.code, "RT_E_VALIDATION");
      assert.equal(r.sandbox, false, "verify-kind is honest about its isolation (never a sandbox claim)");
      assert.notEqual(r.skipped, true, "an unreadable subject is a refusal, not an honest skip");
    } finally {
      rmSync(noPkg, { recursive: true, force: true });
    }
    const noBuild = mkdtempSync(join(tmpdir(), "rt-hg-nobuild-"));
    try {
      writeFileSync(
        join(noBuild, "package.json"),
        JSON.stringify({ name: "rt-hg-nobuild", scripts: { test: 'node -e ""' } }),
        "utf8",
      );
      const r = await verifyKindDir(noBuild);
      assert.equal(r.ok, true, "a missing build script is not a failure");
      assert.equal(r.skipped, true, "…but it must be an explicit SKIP — an absent script is never a pass");
      assert.ok(r.code == null, "a skip carries no error code");
      assert.equal(r.sandbox, false);
      assert.match(String(r.detail), /Absent is not a pass/, "the skip detail states the honesty boundary");
    } finally {
      rmSync(noBuild, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// W16 L4 (OV-18) — the custom-cap marker WINDOW is pinned. 217b §1.4 E1
// (fixes/217b_watchdog_verification.md:123-130) registered the TORN-marker
// regime (custom caps ≈64–118) as unfixed; W51 · 337-3 landed the fix (the
// same fallback 337-1 landed in compaction.clampToolOutput): when the marked
// layout cannot fit, the result is the COUNTED plain head-cut the <64 arm uses
// — never a sliced/partial marker. This block pins the FLIPPED regime — the
// plain-cut window, the intact window, the counts and the boundary scans — so
// the torn state can never silently return.
// Capture: scratch probe against the module (values literal below; the probe
// command lives in fixes/337_3_trust.md). The 48 000 production identity and the
// <64 counted plain cut are untouched by this block.
// ---------------------------------------------------------------------------
describe("W16 L4 honesty guards — OV-18 clamp window pin (custom caps, torn regime retired)", () => {
  const TAIL = "TAIL-END";
  const L = 50_000;
  const longText = "A".repeat(L - TAIL.length) + TAIL;
  const FULL_MARKER = /\n… \[(\d+) chars elided by runner output cap\] …\n/;
  /** Scan caps 64–400 and return the window's three edges for this text. */
  const scanEdges = (text: string) => {
    let lastPlain = -1;
    let firstIntact = -1;
    let firstTailFull = -1;
    for (let cap = 64; cap <= 400; cap++) {
      const r = clampRunnerOutput(text, cap);
      if (r.text.match(FULL_MARKER)) {
        if (firstIntact < 0) firstIntact = cap;
        if (firstTailFull < 0 && r.text.endsWith(TAIL)) firstTailFull = cap;
      } else {
        lastPlain = cap;
      }
    }
    return { lastPlain, firstIntact, firstTailFull };
  };

  it("pins the regime window at exact caps (L=50 000): plain counted cut 64–115 · intact 116+ · full tail 136+", () => {
    // Literal capture table — every row a pin of the window at that cap.
    // In the plain-cut window elided = L − cap (the head-cut drops everything
    // after it); in the intact window elided = L − head − tail.
    const rows = [
      { cap: 63, outLen: 63, intact: false, tailFull: false, elided: 49_937 },
      { cap: 64, outLen: 64, intact: false, tailFull: false, elided: 49_936 },
      { cap: 100, outLen: 100, intact: false, tailFull: false, elided: 49_900 },
      { cap: 115, outLen: 115, intact: false, tailFull: false, elided: 49_885 },
      { cap: 116, outLen: 116, intact: true, tailFull: false, elided: 49_931 },
      { cap: 120, outLen: 120, intact: true, tailFull: false, elided: 49_927 },
      { cap: 135, outLen: 135, intact: true, tailFull: false, elided: 49_912 },
      { cap: 136, outLen: 136, intact: true, tailFull: true, elided: 49_911 },
      { cap: 200, outLen: 200, intact: true, tailFull: true, elided: 49_847 },
      { cap: 1_000, outLen: 1_000, intact: true, tailFull: true, elided: 49_047 },
    ];
    for (const row of rows) {
      const r = clampRunnerOutput(longText, row.cap);
      assert.equal(r.clamped, true, `cap ${row.cap}: over-cap text is clamped`);
      assert.equal(r.originalChars, L, `cap ${row.cap}: the original size is reported`);
      assert.equal(r.text.length, row.outLen, `cap ${row.cap}: returned length`);
      assert.equal(
        r.text.match(FULL_MARKER) !== null,
        row.intact,
        `cap ${row.cap}: marker ${row.intact ? "intact" : "absent (counted plain cut, 337-3)"}`,
      );
      assert.equal(
        r.text.endsWith(TAIL),
        row.tailFull,
        `cap ${row.cap}: full 8-char tail ${row.tailFull ? "survives" : "does not survive"}`,
      );
      assert.equal(r.elidedChars, row.elided, `cap ${row.cap}: counted elision`);
    }
    // Window edges as scans (no magic numbers beyond the asserted edge itself):
    // for THIS text the plain-cut window ends at 115, intact markers start at
    // 116, and the full tail first fits at 136. The edges move with the digit
    // count of the elided number (proven just below).
    assert.deepEqual(scanEdges(longText), { lastPlain: 115, firstIntact: 116, firstTailFull: 136 }, "edges (L=50 000)");
    // digit-count dependence: a 1 000-char stream (3-digit elided count →
    // shorter marker) moves every edge down — pinned at both sample lengths.
    assert.deepEqual(
      scanEdges("B".repeat(1_000 - TAIL.length) + TAIL),
      { lastPlain: 110, firstIntact: 111, firstTailFull: 131 },
      "edges (L=1 000) — digit-count dependence",
    );
  });

  it("the too-small window is a COUNTED plain head-cut, never a torn marker (337-3)", () => {
    const r = clampRunnerOutput(longText, 100);
    assert.equal(r.text, longText.slice(0, 100), "the result IS the head-cut — no marker bytes at all");
    assert.equal(r.text.match(FULL_MARKER), null, "and certainly no marker (torn or otherwise)");
    assert.ok(!r.text.includes("\n… ["), "not even the marker PREFIX lands (the stub was the defect)");
    assert.ok(!r.text.endsWith(TAIL), "no tail survives inside the plain-cut window");
    assert.equal(r.elidedChars, L - 100, "count = originalChars − the kept head, exactly");
    // 63 takes the same counted plain cut — the two arms are now identical here.
    const plain = clampRunnerOutput(longText, 63);
    assert.equal(plain.text, longText.slice(0, 63), "below 64: bare head-cut (by design, no marker bytes)");
    assert.equal(plain.elidedChars, L - 63, "…and the cut still counts what it dropped");
    // Slightly-over case: L=101 at cap 100 — a plain head-cut of 1 elided char,
    // never a broken marker naming a bogus count.
    const slight = clampRunnerOutput("A".repeat(93) + TAIL, 100);
    assert.equal(slight.text, ("A".repeat(93) + TAIL).slice(0, 100));
    assert.equal(slight.text.match(FULL_MARKER), null, "L=101 @ 100 is inside the plain-cut window too");
    assert.equal(slight.elidedChars, 1, "count = 101 − 100 — exact for 'input chars not kept'");
  });

  it("sweep rule, caps 64–400 (L=50 000): every result is intact-exactly or plain-cut-exactly — never a partial marker", () => {
    for (let cap = 64; cap <= 400; cap++) {
      const r = clampRunnerOutput(longText, cap);
      assert.equal(r.clamped, true, `cap ${cap}: clamped`);
      assert.equal(r.originalChars, L, `cap ${cap}: originalChars`);
      assert.ok(r.text.length <= cap, `cap ${cap}: never exceeds the cap`);
      const m = r.text.match(FULL_MARKER);
      if (m) {
        const keptOutsideMarker = r.text.length - m[0].length;
        assert.equal(
          r.elidedChars,
          L - keptOutsideMarker,
          `cap ${cap}: intact marker count equals input chars not kept`,
        );
        assert.equal(Number(m[1]), r.elidedChars, `cap ${cap}: the marker names the envelope's own count`);
      } else {
        assert.equal(r.text, longText.slice(0, cap), `cap ${cap}: the fallback is the exact head-cut`);
        assert.ok(!r.text.includes("\n… ["), `cap ${cap}: no partial marker may land`);
        assert.equal(r.elidedChars, L - cap, `cap ${cap}: plain-cut count = originalChars − cap`);
      }
    }
  });

  it("the production cap (48 000) is intact + exactly counted — the real-path identity the window must never touch", () => {
    assert.equal(RUNNER_OUTPUT_MAX_CHARS, 48_000, "the production cap constant");
    const big = "C".repeat(100_000 - TAIL.length) + TAIL;
    const r = clampRunnerOutput(big);
    assert.equal(r.text.length, 48_000, "the default-cap stream lands exactly on the cap");
    const m = r.text.match(FULL_MARKER);
    assert.ok(m, "at the real cap the marker is intact");
    assert.ok(r.text.endsWith(TAIL), "and the tail (the final error lines) survives");
    assert.equal(Number(m![1]), r.elidedChars, "marker names the counted elision");
    assert.equal(r.elidedChars, 52_047, "counted elision at the production cap (100 000-char input)");
    assert.equal(
      r.elidedChars,
      big.length - (r.text.length - m![0].length),
      "count = input chars not kept, exactly (no torn-marker overcount at the real cap)",
    );
  });
});

// ---------------------------------------------------------------------------
// W23 L6 (DF-09 · 249 SPEC 1) — an approval over a FAILED P6 gate must carry a
// rationale. Design per research/multiagent/249_define_first_specs.md §SPEC 1:
// the trigger is the engine's own `forcedOverride` condition (force ⇒ failed P6
// sandbox); the floor is 12 trimmed chars, mirroring rejectHitl's guard; the
// store pre-checks (typed `{ ok: false }`) and the engine throws coded
// RT_E_VALIDATION (defense in depth for every non-store caller, incl. the CLI).
// Pre-guard this block is RED by construction: the store call returned
// `{ ok: true }` and the engine call did not throw (the spec's recorded read of
// the gap). It goes green only with the store+engine guards in place — and it
// cannot pass vacuously: the fixture's precondition trio fails HERE first.
// ---------------------------------------------------------------------------

/** Node has no localStorage, and zustand's persist resolves its storage when
 *  store.ts is evaluated — this polyfill (store.test.ts:16-38 pattern) MUST be
 *  installed before the dynamic import below, or persist binds no storage. */
class L6MemoryStorage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
}
(globalThis as unknown as { localStorage: Storage }).localStorage = new L6MemoryStorage();
(globalThis as unknown as { window: unknown }).window = globalThis;
// Dynamic import: must run AFTER the polyfill so persist binds a real storage.
const { useRapid } = await import("./store.ts");
// Let the initial rehydration (empty storage) settle before the first pin.
await new Promise((resolve) => setTimeout(resolve, 10));

/** The fixture rationale (≥12 trimmed chars) — the ledger row must carry it verbatim. */
const L6_RATIONALE =
  "Reviewed the failing sandbox output myself: the red P6 gate is a known fixture defect — overriding to continue (DF-09).";

/** The engine's own `forcedOverride` fixture (249 §SPEC 1): parked at the P6
 *  mouth, human-only gate, failing sandbox recorded — exactly the condition
 *  `Boolean(opts.force) && phase === 6 && lastTest !== null && !lastTest.ok`. */
function l6Gated(over: Partial<Project> = {}): Project {
  const p6 = runToGate(seedProject(), 6);
  return {
    ...p6,
    status: "awaiting_hitl" as const,
    hitl: {
      ...(p6.hitl ?? { phase: 6 as PhaseId, title: "Sandbox failed — review", prompt: "broken", stakes: "high" }),
      phase: 6 as PhaseId,
      forceHuman: true,
    },
    lastTest: { ok: false, detail: "fixture: failing sandbox output" },
    ...over,
  };
}

/** Precondition trio — fail HERE, never pass vacuously. */
function l6AssertFixture(gated: Project, label: string): void {
  assert.equal(gated.currentPhase, 6, `${label}: precondition — parked at the P6 mouth`);
  assert.equal(gated.hitl?.forceHuman, true, `${label}: precondition — human-only gate`);
  assert.equal(gated.lastTest?.ok, false, `${label}: precondition — failing sandbox output on record`);
}

describe("W23 L6 honesty guards — DF-09 approval rationale", () => {
  it("A1 store seat: a FORCED override of a failed P6 gate with no rationale is refused and journals nothing", () => {
    const gated = l6Gated();
    l6AssertFixture(gated, "A1");
    useRapid.setState({ projects: [gated], activeId: gated.id, hydrated: true, autopilot: false });
    const res = useRapid.getState().approve(gated.id, { force: true });
    assert.equal(
      res.ok,
      false,
      "a rubber-stamp override is refused (the pre-guard store returned {ok:true} — that is the gap this pins)",
    );
    if (!res.ok) {
      assert.match(res.error, /rationale|note/i, "the refusal names what is missing");
    }
    const after = useRapid.getState().projects.find((p) => p.id === gated.id);
    assert.ok(after, "the gated project stays installed in the store");
    assert.equal(after.status, "awaiting_hitl", "the refusal leaves the gate parked");
    assert.equal(after.currentPhase, 6, "no phase advanced on a refused override");
    assert.equal(after.decisions.length, gated.decisions.length, "a refused override journals nothing");
  });

  it("A2 engine seat: the same override THROWS a coded RT_E_VALIDATION (never a bare internal)", () => {
    const gated = l6Gated();
    l6AssertFixture(gated, "A2");
    // W31 T4 (fixes/273 §1): the fixture is built by runToGate, which journals its
    // own below-gate approval rows — snapshot the count so the "journals nothing"
    // compare below is non-vacuous and tests the real guarantee (the throw must
    // leave the pure-function input untouched). The W23 literal `=== 0` compare
    // could never hold against this fixture (found red: 2 !== 0, fixes/273 §0).
    const decisionsBefore = gated.decisions.length;
    assert.ok(
      decisionsBefore > 0,
      "fixture precondition: runToGate journals its below-gate approvals — the compare below is non-vacuous",
    );
    assert.throws(
      () => approveHitl(gated, { decidedBy: "human", force: true }),
      (err: unknown) => {
        assert.equal(
          (err as { code?: string }).code,
          "RT_E_VALIDATION",
          "the throw must be CODED — the CLI leg classifies exit 1, never RT_E_INTERNAL",
        );
        assert.match((err as Error).message, /rationale|note/i, "the error names the missing rationale");
        return true;
      },
    );
    assert.equal(
      gated.decisions.length,
      decisionsBefore,
      "a thrown refusal journals nothing (the input project is untouched)",
    );
    assert.equal(gated.status, "awaiting_hitl", "the fixture project is untouched (pure-function contract)");
  });

  it("A3a with a ≥12-char rationale: the override lands and the row carries the rationale verbatim (both seats)", () => {
    const gated = l6Gated();
    l6AssertFixture(gated, "A3a");
    assert.ok(L6_RATIONALE.trim().length >= 12, "the fixture rationale clears the floor");
    useRapid.setState({ projects: [gated], activeId: gated.id, hydrated: true, autopilot: false });
    const res = useRapid.getState().approve(gated.id, { force: true, note: L6_RATIONALE });
    assert.equal(res.ok, true, "with a rationale the override is allowed");
    const after = useRapid.getState().projects.find((p) => p.id === gated.id);
    assert.ok(after, "the approved project is in the store");
    const row = after.decisions[after.decisions.length - 1];
    assert.equal(row.decision, "approve", "an approval row is journaled");
    assert.equal(row.note, L6_RATIONALE, "the ledger row carries the caller's rationale verbatim (DF-09's observable)");
    assert.ok(
      after.logs.some((l) => l.event === "hitl.approved_override"),
      "the override is still LOUD (the DF-09 guard adds a rationale; it never silences the override log)",
    );

    // Engine seat — the same rule, no store in the path:
    const viaEngine = approveHitl(l6Gated(), { decidedBy: "human", force: true, note: L6_RATIONALE });
    const engineRow = viaEngine.decisions[viaEngine.decisions.length - 1];
    assert.equal(engineRow.note, L6_RATIONALE, "the engine records the rationale too (non-store callers get the same ledger)");
    assert.equal(engineRow.decidedBy, "human", "the human actor is preserved");
  });

  it("A3b controls (an over-broad guard must fail HERE): a non-failed gate needs no note; autopilot's note path records; reject's floor is intact", () => {
    const base = l6Gated();
    const control: Project = {
      ...base,
      lastTest: { ok: true, detail: "fixture: sandbox green" },
      hitl: { ...base.hitl!, forceHuman: false },
    };
    assert.equal(control.hitl?.forceHuman, false, "control precondition: not a human-only override gate");
    assert.equal(control.lastTest?.ok, true, "control precondition: no failed sandbox on record");

    // Engine seat: a non-failed parked gate approves with NO note and mints
    // neither an override log nor a fabricated note.
    const approved = approveHitl(control, { decidedBy: "human" });
    const row = approved.decisions[approved.decisions.length - 1];
    assert.equal(row.decision, "approve", "the ordinary approval still lands");
    assert.equal(row.note, undefined, "no note was required — and none was fabricated");
    assert.ok(
      !approved.logs.some((l) => l.event === "hitl.approved_override"),
      "no forced-override log on a non-forced approval",
    );

    // The autopilot note-carrying self-approval path keeps recording its note.
    const autoNote = "[seat autopilot] bounded self-approval note (DF-09 control)";
    const auto = approveHitl(control, { decidedBy: "autopilot", note: autoNote });
    assert.equal(
      auto.decisions[auto.decisions.length - 1].note,
      autoNote,
      "the autopilot path is exempt from the human-rationale requirement and records its own note",
    );

    // Reject's 12-char floor is unchanged — the mirror the DF-09 floor copies.
    assert.throws(
      () => rejectHitl(control, "too short"),
      /12 characters/,
      "the reject guard still refuses short feedback",
    );
    const rejected = rejectHitl(control, "A real reason told in more than twelve characters.");
    assert.equal(rejected.decisions[rejected.decisions.length - 1].decision, "reject", "a valid rejection still lands");

    // Store seat, force path, NON-failed gate: the DF-09 trigger is the failed
    // sandbox, not `force` alone — this control fails if the guard got too broad.
    useRapid.setState({ projects: [control], activeId: control.id, hydrated: true, autopilot: false });
    const storeRes = useRapid.getState().approve(control.id, { force: true });
    assert.equal(
      storeRes.ok,
      true,
      "a forced approval of a NON-failed gate is not the DF-09 case — it must still land with no note",
    );
  });
});

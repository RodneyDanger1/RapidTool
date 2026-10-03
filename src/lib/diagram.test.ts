// ---------------------------------------------------------------------------
// Deterministic SVG diagram suite — src/lib/diagram.test.ts
// Run: node --experimental-strip-types --test src/lib/diagram.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HITL_PHASES, PHASES } from "./phases.ts";
import { ALL_PHASES, runHeadless, seedProject } from "./testing/fixtures.ts";
import {
  DOC_THEME,
  KIND_THEME,
  STATUS_THEME,
  UNKNOWN_KIND_THEME,
  buildDiagram,
  kindTheme,
  resolveFlowHighlight,
  resolvePhaseStatus,
} from "./diagram.ts";
import type { Artifact, ArtifactKind, PhaseId, PhaseStatus, Project } from "./types.ts";

/** One full 13-phase engine execution — fixed instance, pure reads afterwards. */
const RUN: Project = runHeadless(seedProject(), ALL_PHASES);

const ALL_KINDS: ArtifactKind[] = [
  "scorecard",
  "graph",
  "memory",
  "mcp",
  "security",
  "validation",
  "code",
  "research",
  "ui",
  "cicd",
  "edge",
  "tools",
  "docs",
  "packet",
  "algorithm",
  "gate",
];

function craft(over: Partial<Project>): Project {
  return { ...seedProject(), ...over };
}

/** Override phase-record statuses by id; untouched records keep their seed state. */
function statuses(p: Project, list: ReadonlyArray<readonly [number, PhaseStatus]>): Project {
  const map = new Map<number, PhaseStatus>(list);
  return {
    ...p,
    phases: p.phases.map((r) => (map.has(r.id) ? { ...r, status: map.get(r.id)! } : r)),
  };
}

/** Seed variance (id/createdAt/log timestamps) normalized away. */
function normalizedSeed(): Project {
  const s = seedProject();
  return { ...s, id: "fixed-id", createdAt: 0, logs: [] };
}

// -- fixture shapes used across suites ----------------------------------------

/** One project exposing five visual statuses at once (no blocked). */
function richProject(): Project {
  return statuses(craft({ currentPhase: 3 as PhaseId, status: "running" }), [
    [0, "complete"],
    [1, "complete"],
    [2, "ready"],
    [3, "running"],
    [4, "awaiting_hitl"],
  ]);
}

/** Blocked project: every unsealed phase must read "blocked". */
function blockedProject(): Project {
  return statuses(craft({ currentPhase: 3 as PhaseId, status: "blocked" }), [
    [0, "complete"],
    [1, "complete"],
    [2, "ready"],
    [3, "rejected"],
    [4, "awaiting_hitl"],
  ]);
}

/** Project parked awaiting human review at P5. */
function awaitingProject(): Project {
  return statuses(craft({ currentPhase: 5 as PhaseId, status: "awaiting_hitl" }), [
    [0, "complete"],
    [1, "complete"],
    [2, "complete"],
    [3, "complete"],
    [4, "complete"],
    [5, "awaiting_hitl"],
  ]);
}

const evilName = `A&B <script>alert("x")</script>'`;

/** Project whose labels are full of XML-hostile characters + control chars. */
function evilProject(): Project {
  return craft({
    name: evilName,
    status: "awaiting_hitl",
    currentPhase: 4 as PhaseId,
    artifacts: [
      { id: "evil-1", phase: 4 as PhaseId, kind: "code", title: "T<&>x\u0001\u0002", body: "b" },
      {
        id: "evil-2",
        phase: 12 as PhaseId,
        kind: "docs",
        title: "quotes \" & apostrophe '",
        body: "b",
      },
    ],
    openapi: "openapi: 3.1.0",
    adr: "# ADR-001 first\n# ADR-002 second",
  });
}

// ---------------------------------------------------------------------------

describe("buildDiagram — standalone SVG shell", () => {
  for (const kind of ["phases", "architecture", "flow"] as const) {
    it(`kind "${kind}" returns a complete standalone SVG on a full-run project`, () => {
      const out = buildDiagram(RUN, kind);
      assert.ok(out.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), "xmlns on root");
      assert.ok(out.includes('viewBox="0 0 '), "viewBox present");
      assert.ok(out.endsWith("</svg>\n"), "closing root tag");
      assert.equal((out.match(/<svg\b/g) ?? []).length, 1, "exactly one root element");
      assert.equal((out.match(/<\/svg>/g) ?? []).length, 1);
      assert.ok(out.includes("<title>"), "has <title>");
      assert.ok(out.includes('role="img"'), "a11y role");
      assert.ok(!/<rect[^>]*fill="none"/.test(out), "no invisible rects");
    });

    it(`kind "${kind}" output is XML-well-formed (tag balance)`, () => {
      const out = buildDiagram(evilProject(), kind);
      const tags = out.match(/<\/?[a-zA-Z][^>]*>/g) ?? [];
      let opens = 0;
      let closes = 0;
      for (const t of tags) {
        if (/^<\//.test(t)) closes += 1;
        else if (!/\/>$/.test(t)) opens += 1;
      }
      assert.equal(opens, closes, "every open tag is closed");
      assert.ok(opens > 3);
    });
  }

  it("throws on an unknown kind instead of guessing", () => {
    assert.throws(() => buildDiagram(RUN, "bogus" as never), /Unknown diagram kind: bogus/);
  });
});

describe("buildDiagram — determinism", () => {
  it("same project object ⇒ byte-identical output for every kind", () => {
    for (const kind of ["phases", "architecture", "flow"] as const) {
      assert.equal(buildDiagram(RUN, kind), buildDiagram(RUN, kind), kind);
      assert.equal(
        buildDiagram(evilProject(), kind),
        buildDiagram(evilProject(), kind),
        `evil ${kind}`,
      );
    }
  });

  it("equivalent freshly-seeded projects ⇒ identical output for every kind", () => {
    const a = normalizedSeed();
    const b = normalizedSeed();
    for (const kind of ["phases", "architecture", "flow"] as const) {
      assert.equal(buildDiagram(a, kind), buildDiagram(b, kind), kind);
    }
  });
});

describe("buildDiagram — XML safety", () => {
  it("escapes <, >, &, quotes and strips control chars in every kind", () => {
    for (const kind of ["phases", "architecture", "flow"] as const) {
      const out = buildDiagram(evilProject(), kind);
      assert.ok(!out.includes("<script"), `${kind}: raw <script must not appear`);
      assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(out), `${kind}: no unescaped &`);
      assert.ok(out.includes("&amp;"), `${kind}: & was escaped`);
      assert.ok(out.includes("&lt;script&gt;"), `${kind}: <script> was escaped`);
      assert.ok(
        !out.includes("\u0001") && !out.includes("\u0002"),
        `${kind}: control chars stripped`,
      );
      assert.ok(!out.includes(`>${evilName}<`), `${kind}: raw hostile name never rendered`);
    }
  });

  it("never emits NaN, Infinity or undefined — full run, fresh, blocked, sparse", () => {
    const sparse = craft({ phases: [] }); // fully sparse phase array
    const projects = [
      RUN,
      seedProject(),
      blockedProject(),
      awaitingProject(),
      sparse,
      evilProject(),
    ];
    for (const p of projects) {
      for (const kind of ["phases", "architecture", "flow"] as const) {
        const out = buildDiagram(p, kind);
        assert.ok(!out.includes("NaN"), `${kind}: NaN leaked`);
        assert.ok(!out.includes("Infinity"), `${kind}: Infinity leaked`);
        assert.ok(!out.includes("undefined"), `${kind}: undefined leaked`);
      }
    }
  });
});

describe("phases pipeline diagram", () => {
  it("draws exactly the 13 P0..P12 boxes with their codes", () => {
    const out = buildDiagram(RUN, "phases");
    assert.equal((out.match(/<rect[^>]*data-state=/g) ?? []).length, 13, "13 phase boxes");
    for (const def of PHASES) {
      assert.ok(out.includes(`>${def.code}<`), `${def.code} code label rendered`);
    }
  });

  it("paints all 13 phases complete on a full run, in the complete theme", () => {
    const out = buildDiagram(RUN, "phases");
    const th = STATUS_THEME.complete;
    const m = out.match(/<rect[^>]*fill="#[0-9a-f]+"[^>]*data-state="complete"/g) ?? [];
    assert.equal(m.length, 13);
    for (const rect of m) {
      assert.ok(rect.includes(`fill="${th.fill}"`), "complete fill");
      assert.ok(rect.includes(`stroke="${th.stroke}"`), "complete stroke");
    }
  });

  it("draws the 12 legal edges (11 horizontal + the P6→P7 elbow wrap)", () => {
    const out = buildDiagram(RUN, "phases");
    assert.equal((out.match(/<line /g) ?? []).length, 11, "11 same-row arrows");
    assert.ok(out.includes("V187 H104"), "P6→P7 wrap elbow present");
  });

  it("marks every HITL phase with a diamond", () => {
    const out = buildDiagram(RUN, "phases");
    assert.equal((out.match(/data-hitl="true"/g) ?? []).length, HITL_PHASES.length);
    assert.ok(HITL_PHASES.length === 4);
  });

  it("legend names all six visual statuses plus the HITL gate", () => {
    const out = buildDiagram(RUN, "phases");
    for (const st of Object.keys(STATUS_THEME) as (keyof typeof STATUS_THEME)[]) {
      assert.ok(out.includes(`>${st}<`), `legend label ${st}`);
    }
    assert.ok(out.includes(">HITL gate<"));
  });
});

describe("status resolution & coloring", () => {
  it("maps records/project state to the six visual statuses (unit)", () => {
    const rich = richProject();
    assert.equal(resolvePhaseStatus(rich, 0), "complete");
    assert.equal(resolvePhaseStatus(rich, 1), "complete");
    assert.equal(resolvePhaseStatus(rich, 2), "ready"); // ready but NOT current
    assert.equal(resolvePhaseStatus(rich, 3), "current"); // currentPhase beats "running"
    assert.equal(resolvePhaseStatus(rich, 4), "awaiting_hitl"); // awaiting beats current-id? id ≠ current here
    assert.equal(resolvePhaseStatus(rich, 5), "locked");

    const blocked = blockedProject();
    assert.equal(resolvePhaseStatus(blocked, 0), "complete", "sealed survives a block");
    assert.equal(resolvePhaseStatus(blocked, 2), "blocked");
    assert.equal(resolvePhaseStatus(blocked, 3), "blocked"); // rejected rec under blocked project
    assert.equal(resolvePhaseStatus(blocked, 4), "blocked");

    const parked = statuses(craft({ currentPhase: 4 as PhaseId, status: "awaiting_hitl" }), [
      [4, "awaiting_hitl"],
    ]);
    assert.equal(
      resolvePhaseStatus(parked, 4),
      "awaiting_hitl",
      "awaiting record wins over current-id",
    );

    const rerun = statuses(craft({ currentPhase: 5 as PhaseId, status: "running" }), [
      [5, "rejected"],
    ]);
    assert.equal(
      resolvePhaseStatus(rerun, 5),
      "current",
      "rejected record reads as current (back in work)",
    );

    const fresh = seedProject();
    assert.equal(resolvePhaseStatus(fresh, 0), "current");
    assert.equal(resolvePhaseStatus(fresh, 1), "locked");

    const sparse = craft({ phases: [] });
    assert.equal(resolvePhaseStatus(sparse, 0), "current"); // currentPhase fallback
    assert.equal(resolvePhaseStatus(sparse, 7), "locked");
  });

  it("all six status themes have pairwise-distinct fills and strokes", () => {
    const fills = Object.values(STATUS_THEME).map((t) => t.fill);
    const strokes = Object.values(STATUS_THEME).map((t) => t.stroke);
    assert.equal(new Set(fills).size, 6);
    assert.equal(new Set(strokes).size, 6);
    assert.equal(Object.keys(STATUS_THEME).length, 6);
  });

  it("phase boxes carry the matching theme fill per visual status", () => {
    const out = buildDiagram(richProject(), "phases");
    for (const st of ["complete", "ready", "current", "awaiting_hitl", "locked"] as const) {
      const th = STATUS_THEME[st];
      const count = (
        out.match(new RegExp(`<rect[^>]*fill="${th.fill}"[^>]*data-state="${st}"`, "g")) ?? []
      ).length;
      assert.ok(count >= 1, `${st}: at least one box painted with its theme`);
    }
  });

  it("a blocked project paints every unsealed phase blocked (red theme)", () => {
    const out = buildDiagram(blockedProject(), "phases");
    const th = STATUS_THEME.blocked;
    const boxes = out.match(/<rect[^>]*data-state="blocked"/g) ?? [];
    assert.equal(boxes.length, 11, "13 phases − 2 sealed = 11 blocked boxes");
    for (const rect of boxes) assert.ok(rect.includes(`fill="${th.fill}"`));
    const complete = out.match(/<rect[^>]*data-state="complete"/g) ?? [];
    assert.equal(complete.length, 2);
  });
});

describe("architecture diagram", () => {
  it("groups artifact boxes into deterministic phase bands with band labels", () => {
    const p = craft({
      contracts: null, // isolate the artifact bands from the seed's derived contract box
      artifacts: [
        { id: "g1", phase: 1 as PhaseId, kind: "graph", title: "State graph", body: "b" },
        { id: "a1", phase: 1 as PhaseId, kind: "code", title: "Dispatcher core", body: "b" },
        { id: "s1", phase: 4 as PhaseId, kind: "security", title: "Isolation policy", body: "b" },
        { id: "r1", phase: 7 as PhaseId, kind: "research", title: "Competitor scan", body: "b" },
      ],
    });
    const out = buildDiagram(p, "architecture");
    assert.equal((out.match(/<rect[^>]*data-kind=/g) ?? []).length, 4, "one box per artifact");
    assert.ok(out.includes(p.name), "project name rendered");
    for (const code of [">P1<", ">P4<", ">P7<"])
      assert.ok(out.includes(code), `band label ${code}`);
    const boxes = [
      ...out.matchAll(/<rect x="(\d+)" y="(\d+)" width="168"[^>]*data-kind="([a-z]+)"/g),
    ].map((m) => ({ x: Number(m[1]), y: Number(m[2]), kind: m[3] }));
    assert.equal(boxes.length, 4);
    const pos = new Set(boxes.map((b) => `${b.x},${b.y}`));
    assert.equal(pos.size, 4, "no two boxes share a slot");
    const yOf = (kind: string) => boxes.find((b) => b.kind === kind)!.y;
    assert.ok(yOf("code") === yOf("graph"), "same band ⇒ same row");
    assert.ok(yOf("security") > yOf("code"), "later phase band sits lower");
    assert.ok(yOf("research") > yOf("security"), "band order follows phase id");
  });

  it("renders every artifact of a full run with its kind theme + spec-layer docs", () => {
    const out = buildDiagram(RUN, "architecture");
    assert.equal((out.match(/<rect[^>]*data-phase=/g) ?? []).length, RUN.artifacts.length);
    const present = new Set(RUN.artifacts.map((a) => a.kind));
    for (const kind of present) {
      const th = KIND_THEME[kind];
      const rects =
        out.match(new RegExp(`<rect[^>]*fill="${th.fill}"[^>]*data-kind="${kind}"`, "g")) ?? [];
      assert.ok(rects.length >= 1, `kind ${kind} box uses its theme`);
    }
    // Specification layer derived from Project fields (contract/openapi/adr).
    assert.equal((out.match(/<rect[^>]*data-kind="contract"/g) ?? []).length, 1);
    assert.equal((out.match(/<rect[^>]*data-kind="openapi"/g) ?? []).length, 1);
    assert.equal((out.match(/<rect[^>]*data-kind="adr"/g) ?? []).length, 1);
    assert.ok(out.includes("3.1.0 declared"), "openapi version surfaced");
    assert.ok(out.includes("entities · "), "contract box carries counts");
    const docFill = out.match(/<rect[^>]*fill="#[0-9a-f]+"[^>]*data-kind="openapi"/)?.[0] ?? "";
    assert.ok(docFill.includes(`fill="${DOC_THEME.openapi.fill}"`), "doc box uses DOC_THEME");
  });

  it("falls back to the unknown-kind theme for out-of-union kinds", () => {
    const p = craft({
      artifacts: [
        {
          id: "u1",
          phase: 2 as PhaseId,
          kind: "bogus" as ArtifactKind,
          title: "Legacy blob",
          body: "b",
        },
      ],
    });
    const out = buildDiagram(p, "architecture");
    assert.ok(
      out.includes(`fill="${UNKNOWN_KIND_THEME.fill}"`),
      "unknown kind drawn with the fallback theme",
    );
    assert.ok(out.includes('data-kind="bogus"'));
  });

  it("shows a deterministic empty state when there are no artifacts or docs", () => {
    const out = buildDiagram(craft({ contracts: null }), "architecture");
    assert.ok(out.includes("No artifacts yet"), "empty-state message");
    assert.equal((out.match(/<rect[^>]*data-kind=/g) ?? []).length, 0);
    assert.ok(!out.includes("Specification layer"), "no spec strip when fields are empty");
  });

  it("caps artifact boxes at 72 and reports the overflow", () => {
    const artifacts: Artifact[] = Array.from({ length: 80 }, (_, i) => ({
      id: `cap-${i}`,
      phase: (i % 13) as PhaseId,
      kind: ALL_KINDS[i % ALL_KINDS.length],
      title: `cap artifact ${i}`,
      body: "b",
    }));
    const out = buildDiagram(craft({ artifacts }), "architecture");
    assert.equal((out.match(/<rect[^>]*data-phase=/g) ?? []).length, 72);
    assert.ok(out.includes("+8 more artifacts not shown (cap 72)"), "overflow note");
  });

  it("truncates over-long names and titles with an ellipsis", () => {
    const longName = "N".repeat(300);
    const longTitle = "Z".repeat(240);
    const p = craft({
      name: longName,
      artifacts: [{ id: "t1", phase: 6 as PhaseId, kind: "code", title: longTitle, body: "b" }],
    });
    const out = buildDiagram(p, "architecture");
    assert.ok(out.includes("…"), "ellipsis present");
    assert.ok(!out.includes(longName), "full name never rendered");
    assert.ok(!out.includes(longTitle), "full title never rendered");
  });
});

describe("flow diagram", () => {
  it("highlights the gate diamond while a human decision is pending", () => {
    const p = awaitingProject();
    const out = buildDiagram(p, "flow");
    assert.ok(out.includes('data-node="gate" data-highlight="true"'), "gate node active");
    assert.ok(out.includes("awaiting_hitl · P5"), "status chip shows the live state");
    assert.ok(out.includes("human review pending"), "reason line");
    assert.ok(out.includes('data-node="sealed"/>'), "sealed node not highlighted");
    assert.ok(!out.includes('data-node="sealed" data-highlight'), "sealed stays dim");
  });

  it("highlights the sealed/advance node on a complete pipeline", () => {
    const out = buildDiagram(RUN, "flow");
    assert.ok(out.includes('data-node="sealed" data-highlight="true"'));
    assert.ok(out.includes("complete · P12"), "chip shows complete · P12");
    assert.ok(!out.includes('data-node="gate" data-highlight'));
  });

  it("highlights the handoff node on a fresh project", () => {
    const out = buildDiagram(seedProject(), "flow");
    assert.ok(out.includes('data-node="handoff" data-highlight="true"'));
    assert.ok(out.includes("DoR met"), "reason line");
  });

  it("highlights execute while running", () => {
    const p = statuses(craft({ currentPhase: 5 as PhaseId, status: "running" }), [
      [0, "complete"],
      [1, "complete"],
      [2, "complete"],
      [3, "complete"],
      [4, "complete"],
      [5, "running"],
    ]);
    const out = buildDiagram(p, "flow");
    assert.ok(out.includes('data-node="run" data-highlight="true"'));
    assert.ok(out.includes("running · P5"));
  });

  it("highlights reject/retry when the project is blocked after rejection", () => {
    const p = statuses(craft({ currentPhase: 5 as PhaseId, status: "blocked" }), [
      [0, "complete"],
      [1, "complete"],
      [2, "complete"],
      [3, "complete"],
      [4, "complete"],
      [5, "rejected"],
    ]);
    const out = buildDiagram(p, "flow");
    assert.ok(out.includes('data-node="reject" data-highlight="true"'));
    assert.ok(out.includes("blocked · P5"), "chip");
    assert.ok(out.includes("Reject → revise &amp; retry"), "reject label (XML-escaped)");
    assert.ok(out.includes('stroke-dasharray="5 4"'), "retry loop drawn dashed");
  });

  it("labels the gate human vs machine from the phase's HITL flag", () => {
    const at4 = buildDiagram(craft({ currentPhase: 4 as PhaseId }), "flow");
    assert.ok(at4.includes("DoD + HITL gate"), "P4 gate is human");
    assert.ok(at4.includes("human decision"));
    const at6 = buildDiagram(craft({ currentPhase: 6 as PhaseId }), "flow");
    assert.ok(at6.includes("DoD gate"), "P6 gate is machine-checked");
    assert.ok(at6.includes("machine checks"));
    assert.ok(!at6.includes("DoD + HITL gate"));
  });

  it("names the next phase on the advance node and ends the spine at P12", () => {
    const at8 = buildDiagram(craft({ currentPhase: 8 as PhaseId }), "flow");
    assert.ok(at8.includes("Advance → P9 handoff"), "advance names the next phase");
    const at12 = buildDiagram(RUN, "flow");
    assert.ok(at12.includes("All phases sealed — done"), "P12 terminal label");
    assert.equal(resolveFlowHighlight(RUN).node, "sealed");
    assert.equal(resolveFlowHighlight(seedProject()).node, "handoff");
    assert.equal(resolveFlowHighlight(awaitingProject()).node, "gate");
  });
});

describe("palette integrity", () => {
  it("KIND_THEME covers all 16 ArtifactKind members with distinct fills/strokes", () => {
    assert.equal(Object.keys(KIND_THEME).length, 16);
    assert.equal(new Set(ALL_KINDS.map((k) => KIND_THEME[k].fill)).size, 16);
    assert.equal(new Set(ALL_KINDS.map((k) => KIND_THEME[k].stroke)).size, 16);
  });

  it("kindTheme falls back to UNKNOWN_KIND_THEME for prototype member names", () => {
    // The exported contract says runtime-garbage kinds get the fallback theme;
    // a plain-object read would instead hand back Object.prototype members.
    for (const kind of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      assert.deepEqual(kindTheme(kind), UNKNOWN_KIND_THEME, `${kind} must use the fallback theme`);
    }
  });
});

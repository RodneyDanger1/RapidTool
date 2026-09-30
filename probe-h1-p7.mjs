// ---------------------------------------------------------------------------
// probe-h1-p7.mjs — H1/A4 · T1.4: the P7 hard-DoD falsification probe.
//
// 311_se1_pipeline.md §3's cheapest falsification: drive a SEEDED
// `enforceDod:true` project through `wildStep` with an injected reviewer and
// assert whether/what pauses at P7 — and whether the wild path honors the P7
// execution edge (`opts.liveEdge`, the 313 D1 seam).
//
// Keyless, no network, no TTY. Two arms on identical fresh fixtures:
//   arm A — production shape: no live-edge seam → whatever the wild path does.
//   arm B — the SAME step with `opts.liveEdge` injected (the documented seam).
// The arms answer one question: is P7's live seam consumed by the wild path?
//   pre-wire  → arm B ≡ arm A (the seam is silently ignored — the false claim)
//   post-wire → arm B executes through the seam and ADVANCES; arm A keeps the
//               keyless floor (the repo's keyless-floor contract).
//
// The injected seam is the REAL contract shape: it runs the REAL deterministic
// floor (applyPhaseResult(…, 7)) and layers the ONE thing the live layer adds —
// a research corpus entry, exactly the shape bareNodeLiveOverlay writes for
// fetched findings. It invents no gate verdicts: the re-run's runGate does.
//
// usage: node --experimental-strip-types probe-h1-p7.mjs
// ---------------------------------------------------------------------------
import { applyPhaseResult, emptyProject, wildStep } from "./src/lib/engine.ts";
import { runGate } from "./src/lib/dod.ts";

const approving = async () => ({
  ok: true,
  verdict: "approve",
  feedback: "Probe reviewer approves the advance — keyless plumbing probe.",
  model: "probe",
});

/** P6→P7 boundary seed: priors 0-6 sealed, cursor on a ready phase 7. */
function seededP7() {
  const p = emptyProject({
    name: "Probe P7",
    brief: "A seeded enforceDod project for the T1.4 P7 falsification probe.",
    enforceDod: true,
  });
  p.wildMode = true;
  p.wildRun = {
    active: true,
    phase: 7,
    startedAt: Date.now(),
    lastAutoLog: "Wild run at P7",
    lastAutoAt: Date.now(),
    stoppedAt: null,
    pause: false,
  };
  p.currentPhase = 7;
  p.status = "running";
  p.phases = p.phases.map((r) =>
    r.id < 7 ? { ...r, status: "complete" } : r.id === 7 ? { ...r, status: "ready" } : r,
  );
  return p;
}

/** The 313 D1 P7 live edge, injected through its documented seam contract. */
const liveEdgeSeam = async (q) => {
  const done = applyPhaseResult(q, 7);
  const items = [
    {
      title: "Probe finding (injected seam)",
      url: "https://example.invalid/probe-h1-p7",
      content: "Live-layer seam probe finding — exercises the corpus path only.",
    },
  ];
  return {
    ...done,
    research: [...(done.research ?? []), { query: `probe:${done.domain}`, provider: "probe-seam", items }],
    artifacts: [
      ...done.artifacts,
      {
        id: `research-7-probe-${done.id}`,
        phase: 7,
        kind: "research",
        title: items[0].title,
        body: `${items[0].content}\n\nSource: ${items[0].url}`,
        language: "markdown",
      },
    ],
  };
};

function summarize(res) {
  const after = res.project;
  const gate = runGate(after, 7);
  return {
    outcome: res.outcome,
    ran: res.ran,
    code: res.code ?? null,
    error: res.error ?? null,
    pausedAtPhase: after.wildRun?.pause ? after.currentPhase : null,
    park: after.wildRun?.park
      ? { code: after.wildRun.park.code, event: after.wildRun.park.event, unlock: after.wildRun.park.unlock }
      : null,
    p7Gate: { pass: gate.pass, unmet: gate.unmet.map((u) => u.id) },
    researchCorpus: (after.research ?? []).length,
    liveUnavailable: after.meta?.liveUnavailable === true,
    wildEvents: (after.logs ?? []).filter((l) => l.event.startsWith("wild.")).map((l) => `${l.event}: ${l.detail}`),
  };
}

const armA = await wildStep(seededP7(), { reviewer: approving });
const armB = await wildStep(seededP7(), { reviewer: approving, liveEdge: liveEdgeSeam });

const seamHonored = armB.outcome === "advanced";

console.log(
  JSON.stringify(
    {
      probe: "h1-p7 (T1.4)",
      head: "564db1f + working tree",
      armA_noSeam: summarize(armA),
      armB_liveEdgeSeam: summarize(armB),
      verdict: seamHonored
        ? "SEAM HONORED — opts.liveEdge was consumed: P7 executed through the edge, p7-research cleared, the enforceDod leave check advanced to P8."
        : "SEAM IGNORED — opts.liveEdge had NO effect: P7 executed the deterministic floor; the enforceDod leave check hard-stopped at p7-research (wild.paused_dod).",
    },
    null,
    2,
  ),
);

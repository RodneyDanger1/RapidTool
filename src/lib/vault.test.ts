// ---------------------------------------------------------------------------
// vault.test.ts — Obsidian-style "second brain" vault (src/lib/vault.ts)
// Run: node --experimental-strip-types --test src/lib/vault.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  backlinksFor,
  buildVaultNotes,
  dailyNote,
  lessonNote,
  lessonNotes,
  searchVault,
  searchVaultScored,
  traceNote,
  vaultIndex,
  vaultMarkdown,
} from "./vault.ts";
import type { VaultNote } from "./vault.ts";
import { createTrace, recordSpan, traceSpan } from "./tracing.ts";
import type { AgentTrace } from "./tracing.ts";
import { ALL_PHASES, runHeadless, seedProject } from "./testing/fixtures.ts";
import type { Artifact, HitlDecision, Project } from "./types.ts";

/** A fully engine-run project: real memory rows, decisions, research, artifacts. */
const fullRun = () => runHeadless(seedProject(), ALL_PHASES);

/** First link whose target is not a note title, or null when the graph is clean. */
function danglingLink(notes: VaultNote[]): string | null {
  const titles = new Set(notes.map((n) => n.title));
  for (const n of notes) {
    for (const l of n.links) {
      if (!titles.has(l)) return `${n.title} -> ${l}`;
    }
  }
  return null;
}

function artifact(id: string, phase: number, kind: Artifact["kind"], title: string, body: string): Artifact {
  return { id, phase: phase as Artifact["phase"], kind, title, body };
}

function decision(id: string, phase: number, title: string, over: Partial<HitlDecision> = {}): HitlDecision {
  return {
    id,
    phase: phase as HitlDecision["phase"],
    title,
    decision: "approve",
    decidedBy: "human",
    requestedAt: 1_700_000_000_000,
    decidedAt: 1_700_000_100_000,
    ...over,
  };
}

/** Curated project with controlled titles/bodies for search-ranking assertions. */
function searchProject(): Project {
  return seedProject({
    name: "Curated Vault",
    memory: [
      { id: "m1", kind: "episodic", phase: 0, text: "Cold-start handling for fleets.", score: 0.9 },
      { id: "m2", kind: "semantic", phase: 2, text: "Dispatch uses priority scoring.", score: 0.8 },
    ],
    decisions: [
      decision("d1", 4, "Approve the isolation policy", { note: "Sandbox caps accepted." }),
      decision("d2", 5, "Approve validation contract"),
    ],
    research: [
      {
        query: "widget market size",
        provider: "tavily",
        items: [
          {
            title: "Widget report",
            url: "https://example.com/widget",
            content: "Deep dive into zebra margins across regions.",
          },
        ],
      },
    ],
    artifacts: [
      artifact("a1", 6, "scorecard", "Pricing zebra tiers", "Quarterly margin scorecard."),
      artifact("a2", 6, "research", "Quarterly margins", "Customer interviews mention zebra pricing loyalty plans."),
      artifact("a3", 7, "docs", "Ops handbook", "Documentation on episodic memory buffers for the ops crew."),
    ],
  });
}

/** Project with colliding titles: duplicate memory texts, decisions, artifact. */
function dupeProject(): Project {
  return seedProject({
    name: "Dupe Vault",
    memory: [
      { id: "mm1", kind: "semantic", phase: 2, text: "Repeat this insight", score: 0.9 },
      { id: "mm2", kind: "episodic", phase: 7, text: "Repeat this insight", score: 0.8 },
    ],
    decisions: [
      decision("dd1", 4, "Approve the plan"),
      decision("dd2", 5, "Approve the plan", { decision: "reject", note: "Tighten scope." }),
    ],
    artifacts: [artifact("aa1", 5, "code", "Approve the plan", "const plan = 1;")],
  });
}

describe("buildVaultNotes — fully engine-run project", () => {
  it("emits one note per production, covering every kind", () => {
    const p = fullRun();
    const notes = buildVaultNotes(p);
    const kinds = new Set(notes.map((n) => n.kind));
    assert.deepEqual([...kinds].sort(), ["artifact", "decision", "index", "memory", "project", "research"]);
    assert.equal(notes.filter((n) => n.kind === "index").length, 1);
    assert.equal(notes.filter((n) => n.kind === "project").length, p.phases.length);
    assert.equal(notes.filter((n) => n.kind === "memory").length, p.memory.length);
    assert.equal(notes.filter((n) => n.kind === "decision").length, p.decisions.length);
    assert.equal(notes.filter((n) => n.kind === "research").length, (p.research ?? []).length);
    assert.equal(
      notes.filter((n) => n.kind === "artifact").length,
      Math.min(10, p.artifacts.length),
    );
    // A full run must actually exercise decisions + live research corpus.
    assert.ok(p.decisions.length > 0, "full run should record HITL decisions");
    assert.ok((p.research ?? []).length > 0, "full run should carry a live research corpus");
  });

  it("keeps the hub first with links to every other note", () => {
    const p = fullRun();
    const notes = buildVaultNotes(p);
    const hub = notes[0];
    assert.equal(hub.kind, "index");
    assert.equal(hub.title, `${p.name} · Vault Index`);
    assert.equal(hub.links.length, notes.length - 1);
    assert.deepEqual(new Set(hub.links), new Set(notes.slice(1).map((n) => n.title)));
    assert.equal(hub.updatedAt, p.createdAt);
    assert.ok(hub.body.startsWith(`# ${hub.title}`));
    assert.ok(hub.body.includes(p.brief));
  });

  it("zips notes back to their sources with the exact contract tags", () => {
    const p = fullRun();
    const notes = buildVaultNotes(p);
    const memoryNotes = notes.filter((n) => n.kind === "memory");
    for (let i = 0; i < p.memory.length; i++) {
      const m = p.memory[i];
      const n = memoryNotes[i];
      assert.deepEqual(n.tags, ["memory", m.kind]);
      assert.equal(n.phase, m.phase);
      assert.ok(n.body.includes(m.text), `memory body should carry text: ${m.text}`);
    }
    const decisionNotes = notes.filter((n) => n.kind === "decision");
    for (let i = 0; i < p.decisions.length; i++) {
      const d = p.decisions[i];
      const n = decisionNotes[i];
      assert.deepEqual(n.tags, ["decision", d.decision]);
      assert.equal(n.phase, d.phase);
      assert.equal(n.updatedAt, d.decidedAt);
      assert.ok(n.body.includes(d.title));
    }
    const researchNotes = notes.filter((n) => n.kind === "research");
    for (let i = 0; i < (p.research ?? []).length; i++) {
      const e = (p.research ?? [])[i];
      const n = researchNotes[i];
      assert.deepEqual(n.tags, ["research", e.provider ?? "unknown"]);
      assert.ok(n.body.includes(e.query));
      assert.deepEqual(n.links, [notes[0].title]); // research -> index hub
    }
  });

  it("artifact notes carry verbatim artifact bodies and top-10 tail selection", () => {
    const p = fullRun();
    const notes = buildVaultNotes(p);
    const top = p.artifacts.slice(-10);
    const artifactNotes = notes.filter((n) => n.kind === "artifact");
    for (let i = 0; i < top.length; i++) {
      const a = top[i];
      const n = artifactNotes[i];
      assert.equal(n.body, a.body, `artifact ${a.id} body must be verbatim`);
      assert.deepEqual(n.tags, ["artifact", a.kind]);
      assert.equal(n.phase, a.phase);
    }
  });

  it("phase spine notes group their own memory/decisions/artifacts as wikilinks", () => {
    const p = fullRun();
    const notes = buildVaultNotes(p);
    const titles = new Set(notes.map((n) => n.title));
    for (const pn of notes.filter((n) => n.kind === "project")) {
      assert.ok(pn.title.startsWith("P"), `phase note title ${pn.title}`);
      assert.equal(pn.tags[0], "project");
      assert.ok(pn.phase !== undefined);
      // Every cluster link targets a note of the matching kind/phase.
      for (const l of pn.links) {
        assert.ok(titles.has(l));
      }
    }
  });

  it("never dangles: every link target is a note title and bodies render [[links]]", () => {
    const p = fullRun();
    const notes = buildVaultNotes(p);
    assert.equal(danglingLink(notes), null);
    for (const n of notes) {
      if (n.kind === "artifact") continue; // verbatim bodies (no synthesized links)
      for (const l of n.links) {
        assert.ok(
          n.body.includes(`[[${l}]]`),
          `${n.title} body must embed its link [[${l}]]`,
        );
      }
    }
  });

  it("titles are unique and the build is deterministic for a fixed project", () => {
    const p = fullRun();
    const notes = buildVaultNotes(p);
    assert.equal(new Set(notes.map((n) => n.title)).size, notes.length);
    assert.deepEqual(
      JSON.parse(JSON.stringify(notes)),
      JSON.parse(JSON.stringify(buildVaultNotes(p))),
    );
  });
});

describe("buildVaultNotes — title disambiguation", () => {
  it("suffixes colliding titles with counters and keeps cluster links correct", () => {
    const p = dupeProject();
    const notes = buildVaultNotes(p);
    assert.equal(new Set(notes.map((n) => n.title)).size, notes.length);
    assert.equal(danglingLink(notes), null);

    const memoryNotes = notes.filter((n) => n.kind === "memory");
    assert.equal(memoryNotes.length, 2);
    assert.deepEqual(
      memoryNotes.map((n) => n.title).sort(),
      ["Repeat this insight", "Repeat this insight (2)"],
    );
    // Phase cluster pages must list the SUFFIXED titles (both phases resolve).
    const p2 = notes.find((n) => n.phase === 2 && n.kind === "project");
    const p7 = notes.find((n) => n.phase === 7 && n.kind === "project");
    assert.ok(p2?.body.includes("[[Repeat this insight]]"));
    assert.ok(p7?.body.includes("[[Repeat this insight (2)]]"));

    // Decision title stolen twice: decision keeps base, artifact gets the next counter.
    const decisionTitles = notes.filter((n) => n.kind === "decision").map((n) => n.title);
    const artifactTitle = notes.find((n) => n.kind === "artifact")?.title;
    assert.ok(decisionTitles.includes("Approve the plan"));
    assert.ok(decisionTitles.includes("Approve the plan (2)"));
    assert.equal(artifactTitle, "Approve the plan (3)");
  });

  it("disambiguates identical titles even when only tags/phase differ", () => {
    const p = seedProject({
      name: "Same Text",
      memory: [
        { id: "x1", kind: "semantic", phase: 0, text: "Ship it", score: 0.9 },
        { id: "x2", kind: "procedural", phase: 0, text: "Ship it", score: 0.8 },
      ],
    });
    const notes = buildVaultNotes(p);
    const memHits = searchVault(notes, "ship it").filter((n) => n.kind === "memory");
    assert.equal(memHits.length, 2);
    assert.equal(new Set(memHits.map((n) => n.title)).size, 2, "duplicate texts get distinct titles");
  });
});

describe("searchVault — ranking", () => {
  it("ranks a title hit above a body hit", () => {
    const notes = buildVaultNotes(searchProject());
    const a1 = notes.find((n) => n.body === "Quarterly margin scorecard.")!;
    const a2 = notes.find((n) => n.body.includes("zebra pricing loyalty plans"))!;
    const results = searchVault(notes, "zebra");
    assert.ok(results.length >= 2);
    assert.equal(results[0].title, a1.title, "title match must lead");
    assert.ok(results.indexOf(a2) > results.indexOf(a1), "body-only hit trails title hit");
  });

  it("ranks a tag match above a body-only match", () => {
    const notes = buildVaultNotes(searchProject());
    const m1 = notes.find((n) => n.tags.includes("episodic"))!;
    const a3 = notes.find((n) => n.body.includes("episodic memory buffers"))!;
    assert.ok(!a3.tags.includes("episodic"), "artifact must be a body-only hit");
    const results = searchVault(notes, "episodic");
    assert.ok(results.length >= 2);
    assert.equal(results[0].title, m1.title);
    assert.ok(results.indexOf(a3) > results.indexOf(m1));
  });

  it("is case-insensitive and token-based (prefix-tolerant, never cross-word)", () => {
    const notes = buildVaultNotes(searchProject());
    assert.deepEqual(
      searchVault(notes, "ZEBRA").map((n) => n.title),
      searchVault(notes, "zebra").map((n) => n.title),
    );
    // A query token that prefixes a real token still hits ("zeb" → "zebra").
    assert.ok(searchVault(notes, "zeb").length >= 1, "token prefix should match");
    // Cross-word substrings are gone: "ebr" hides inside "zebra" but is not a
    // token or token prefix, and "zebraprice" is not a token anyone owns.
    assert.deepEqual(searchVault(notes, "ebr"), []);
    assert.deepEqual(searchVault(notes, "zebraprice"), []);
    const cold = searchVault(notes, "cold");
    assert.ok(cold.length >= 1);
    assert.equal(cold[0].title, "Cold-start handling for fleets.");
  });

  it("returns [] for blank queries and no-match queries", () => {
    const notes = buildVaultNotes(searchProject());
    assert.deepEqual(searchVault(notes, ""), []);
    assert.deepEqual(searchVault(notes, "   "), []);
    // Hyphens split into tokens now (P0-A), so every part must be absent.
    assert.deepEqual(searchVault(notes, "qqzzq-wqxqz-xqvxx"), []);
  });

  it("works on a fully engine-run vault (hub wins a project-name query)", () => {
    const p = fullRun();
    const notes = buildVaultNotes(p);
    const results = searchVault(notes, p.name);
    assert.ok(results.length >= 1);
    assert.equal(results[0].kind, "index", "hub title hit must rank first");
  });
});

describe("searchVaultScored — token-overlap ranking (E-17)", () => {
  /** Hand-made note so scores are exact and not diluted by hub/MOC bodies. */
  function rawNote(
    title: string,
    body: string,
    tags: string[] = [],
    kind: VaultNote["kind"] = "memory",
  ): VaultNote {
    return { title, body, tags, links: [], updatedAt: 1_700_000_000_000, kind };
  }

  it("scores title (4) > tag exact (2) > body (1) per query token, sorted desc", () => {
    const notes = [
      rawNote("Zebra pricing tiers", "Quarterly scorecard.", ["artifact"]),
      rawNote("Ops handbook", "Runbook for the ops crew.", ["zebra", "docs"]),
      rawNote("Quarterly margins", "Loyalty plans mention zebra pricing.", ["artifact"]),
      rawNote("Cold-start handling", "Dispatch priority scoring.", ["memory"]),
    ];
    const hits = searchVaultScored(notes, "zebra");
    assert.deepEqual(
      hits.map((h) => h.note.title),
      ["Zebra pricing tiers", "Ops handbook", "Quarterly margins"],
    );
    assert.deepEqual(
      hits.map((h) => h.score),
      [4, 2, 1],
    );
  });

  it("is tie-stable: equal scores keep vault order and scores never ascend", () => {
    const a = rawNote("Alpha run", "Shared note body.", ["x"]);
    const b = rawNote("Beta run", "Shared note body.", ["x"]);
    const c = rawNote("Gamma run", "Shared note body.", ["x"]);
    const hits = searchVaultScored([a, b, c], "shared note");
    assert.deepEqual(
      hits.map((h) => h.note.title),
      ["Alpha run", "Beta run", "Gamma run"],
    );
    for (let i = 1; i < hits.length; i++) {
      assert.ok(hits[i - 1].score >= hits[i].score, "scores must be sorted desc");
    }
  });

  it("multi-token overlap ranks a two-token note above a one-token note", () => {
    const both = rawNote("Margins ledger", "Zebra margins deep dive.", ["artifact"]);
    const one = rawNote("Ops handbook", "Zebra ops.", ["docs"]);
    const hits = searchVaultScored([one, both], "zebra margin");
    assert.deepEqual(
      hits.map((h) => h.note.title),
      ["Margins ledger", "Ops handbook"],
    );
    assert.ok(hits[0].score > hits[1].score);
  });

  it("is stem-invariant: zebra/zebras and margin/margins/case variants agree", () => {
    const notes = [
      rawNote("Zebra pricing tiers", "Quarterly scorecard.", ["artifact"]),
      rawNote("Ops handbook", "No zebra here.", ["zebra", "docs"]),
      rawNote("Quarterly margins", "Loyalty plans mention zebra pricing.", ["artifact"]),
    ];
    const titles = (q: string) => searchVaultScored(notes, q).map((h) => h.note.title);
    assert.deepEqual(titles("zebras"), titles("zebra"));
    assert.deepEqual(titles("ZEBRA"), titles("zebra"));
    assert.deepEqual(titles("margins"), titles("margin"));
  });

  it("wrapper parity: searchVault returns exactly the scored variant's notes", () => {
    const notes = [
      rawNote("Zebra pricing tiers", "Quarterly scorecard.", ["artifact"]),
      rawNote("Ops handbook", "No zebra here.", ["zebra", "docs"]),
      rawNote("Quarterly margins", "Loyalty plans mention zebra pricing.", ["artifact"]),
    ];
    assert.deepEqual(searchVault(notes, "zebra"), searchVaultScored(notes, "zebra").map((h) => h.note));
    assert.deepEqual(searchVaultScored(notes, "qqzzq-wqxqz-xqvxx"), []);
    assert.deepEqual(searchVaultScored(notes, "  "), []);
    assert.deepEqual(searchVaultScored(notes, "!!!"), []);
  });
});

describe("vaultIndex — MOC + tag cloud", () => {
  it("groups notes by kind with [[wikilinks]] and a tag cloud", () => {
    const notes = buildVaultNotes(searchProject());
    const moc = vaultIndex(notes);
    assert.ok(moc.startsWith("## Map of Content"));
    assert.ok(moc.includes("### Project (13)"));
    assert.ok(moc.includes("### Memory (2)"));
    assert.ok(moc.includes("### Decisions (2)"));
    assert.ok(moc.includes("### Research (1)"));
    assert.ok(moc.includes("### Artifacts (3)"));
    assert.ok(moc.includes("- [[Cold-start handling for fleets.]]"));
    assert.ok(moc.includes("- [[Pricing zebra tiers]]"));
    assert.ok(moc.includes("## Tag cloud"));
    assert.ok(moc.includes("- `#memory` (2)"));
    assert.ok(moc.includes("- `#artifact` (3)"));
    // Hub never lists itself.
    assert.ok(!moc.includes("### Index"));
    assert.ok(!moc.includes(`[[${notes[0].title}]]`));
  });

  it("handles an empty vault and stays deterministic", () => {
    const moc = vaultIndex([]);
    assert.ok(moc.includes("## Map of Content"));
    assert.ok(moc.includes("_none_"));
    assert.ok(moc.includes("_no tags_"));
    const notes = buildVaultNotes(searchProject());
    assert.equal(vaultIndex(notes), vaultIndex(notes));
  });
});

describe("vaultMarkdown — frontmatter'd concatenated vault", () => {
  it("emits one YAML-ish frontmatter block per note with title/kind/tags/updatedAt", () => {
    const p = fullRun();
    const notes = buildVaultNotes(p);
    const md = vaultMarkdown(notes);
    assert.ok(md.startsWith("---\ntitle: \""));
    assert.equal((md.match(/^title: "/gm) ?? []).length, notes.length);
    assert.equal((md.match(/^kind: /gm) ?? []).length, notes.length);
    assert.equal((md.match(/^updatedAt: \d+$/gm) ?? []).length, notes.length);
    assert.ok(md.includes(`kind: index`));
    assert.ok(md.includes(`kind: memory`));
    assert.ok(md.includes(`kind: decision`));
    assert.ok(md.includes(`kind: research`));
    assert.ok(md.includes(`kind: artifact`));
    assert.ok(md.includes(`kind: project`));
    assert.ok(md.includes(`phase: ${p.memory[0]?.phase}`));
    assert.ok(md.includes(`# ${notes[0].title}`), "hub heading present");
  });

  it("round-trips block counts and deterministic output on a curated project", () => {
    const notes = buildVaultNotes(searchProject());
    const md = vaultMarkdown(notes);
    const blocks = md.split(/^---\ntitle: "/m).filter(Boolean);
    assert.equal(blocks.length, notes.length);
    assert.equal(vaultMarkdown(notes), vaultMarkdown(notes));
    // Every note title appears as an H1 in its own block (generated notes).
    for (const n of notes) {
      if (n.kind === "artifact") continue; // verbatim bodies
      assert.ok(md.includes(`# ${n.title}`), `missing heading for ${n.title}`);
    }
    assert.ok(md.includes("## Map of Content"));
  });
});

describe("edge cases", () => {
  it("builds a usable vault for a fresh project with no rows yet", () => {
    const p = seedProject({ memory: [], decisions: [], research: [], artifacts: [] });
    const notes = buildVaultNotes(p);
    assert.equal(notes[0].kind, "index");
    assert.equal(notes.filter((n) => n.kind === "project").length, p.phases.length);
    assert.equal(danglingLink(notes), null);
    assert.ok(notes[0].body.includes("## Map of Content"));
    assert.deepEqual(searchVault(notes, "zzzz-no-such-token"), []);
  });

  it("skips phase links when a project has no phase records (hand-built edge)", () => {
    const p = seedProject({
      phases: [],
      memory: [{ id: "orphan", kind: "episodic", phase: 4, text: "Orphan row", score: 0.5 }],
      decisions: [],
      research: [],
      artifacts: [],
    });
    const notes = buildVaultNotes(p);
    assert.equal(notes.length, 2); // hub + one memory note
    const memoryNote = notes.find((n) => n.kind === "memory")!;
    assert.deepEqual(memoryNote.links, [], "no phase note exists — no dangling link");
    assert.equal(danglingLink(notes), null);
  });

  it("truncates very long memory texts in titles but keeps full text in the body", () => {
    const long = "a".repeat(500);
    const p = seedProject({
      memory: [{ id: "long", kind: "semantic", phase: 1, text: long, score: 0.7 }],
      decisions: [],
      research: [],
      artifacts: [],
    });
    const notes = buildVaultNotes(p);
    const n = notes.find((x) => x.kind === "memory")!;
    assert.ok(n.title.length < 100);
    assert.ok(n.body.includes(long));
  });
});

// ---------------------------------------------------------------------------
// traceNote — G-40 wave 3: agent-run trace filed as a vault memory note
// ---------------------------------------------------------------------------

/** A fully closed crew-like trace with one failed leaf (deterministic). */
function tracedRun(): AgentTrace {
  const T0 = 1_700_000_000_000;
  let t = createTrace("run-7f3a", T0);
  t = recordSpan(
    t,
    traceSpan("s1", null, "crew", "Architect sprint", T0, T0 + 5_000, "ok"),
  );
  t = recordSpan(
    t,
    traceSpan(
      "s2",
      "s1",
      "llm",
      "DeepSeek architect turn",
      T0 + 100,
      T0 + 1_842,
      "ok",
      { model: "deepseek-v4-flash", tokensIn: 412, tokensOut: 88 },
    ),
  );
  t = recordSpan(
    t,
    traceSpan("s3", "s1", "llm", "DeepSeek reviewer turn", T0 + 2_000, T0 + 2_120, "error", {
      verdict: "parse-failed",
    }),
  );
  t = recordSpan(t, traceSpan("s4", null, "research", "Live web check", T0 + 2_500));
  return t;
}

describe("traceNote — agent-run traces in the vault", () => {
  it("emits a standalone memory note tagged trace with the run timeline", () => {
    const p = seedProject({ name: "Trace Vault" });
    const n = traceNote(tracedRun(), p);
    assert.equal(n.kind, "memory");
    assert.deepEqual(n.tags, ["trace"]);
    assert.deepEqual(n.links, []);
    assert.equal(n.phase, undefined);
    assert.equal(n.title, "Trace — run-7f3a");
    assert.ok(n.body.startsWith(`# ${n.title}`));
    assert.ok(n.body.includes("**Project:** Trace Vault"));
    assert.ok(n.body.includes("**Run:** run-7f3a"));
    assert.ok(n.body.includes("4 spans (2 ok · 1 error · 1 open)"), n.body);
    assert.ok(n.body.includes("## Timeline"));
    assert.ok(n.body.includes("- [ok] `s2` **llm** · DeepSeek architect turn — 1.74s"));
    assert.ok(
      n.body.includes("- [error] `s3` **llm** · DeepSeek reviewer turn — 120ms"),
      "a failed run is visibly red-flagged in the vault note",
    );
    assert.ok(n.body.includes("- [started] `s4` **research** · Live web check — in flight"));
  });

  it("is pure and deterministic for the same trace + project", () => {
    const p = fullRun();
    const a = traceNote(tracedRun(), p);
    const b = traceNote(tracedRun(), p);
    assert.deepEqual(a, b);
    // Different run ids land on different titles (merging keeps both).
    const t2: AgentTrace = {
      ...tracedRun(),
      runId: "run-other",
      startedAt: 1_700_000_000_000 + 60_000,
    };
    const c = traceNote(t2, p);
    assert.notEqual(c.title, a.title);
    assert.notEqual(a.body, c.body);
  });

  it("derives updatedAt from the newest instant the trace covers", () => {
    const p = seedProject({ name: "Times" });
    // The newest instant is s1's endTs (T0+5000); s4 starts later than the
    // other closed spans but still before s1 finished.
    assert.equal(traceNote(tracedRun(), p).updatedAt, 1_700_000_005_000);
    // An empty trace falls back to the trace's own startedAt.
    const empty = traceNote(createTrace("run-empty", 1_700_000_000_000), p);
    assert.equal(empty.updatedAt, 1_700_000_000_000);
    assert.ok(empty.body.includes("0 spans"));
  });

  it("renders an all-open trace as in flight and a skipped span honestly", () => {
    const p = seedProject({ name: "Open" });
    let t = createTrace("run-live", 1_700_000_000_000);
    t = recordSpan(t, traceSpan("a", null, "crew", "still thinking", 1_700_000_000_000));
    t = recordSpan(
      t,
      traceSpan("b", null, "research", "skipped deep dive", 1_700_000_000_100, undefined, "skipped"),
    );
    const n = traceNote(t, p);
    assert.ok(n.body.includes("2 spans (1 skipped · 2 open)"), n.body);
    assert.ok(n.body.includes("· **Total:** in flight"), n.body);
    assert.ok(n.body.includes("- [skipped] `b` **research** · skipped deep dive — in flight"));
  });

  it("merges cleanly into a built vault (MOC + frontmatter round-trip)", () => {
    const p = fullRun();
    const notes = [...buildVaultNotes(p), traceNote(tracedRun(), p)];
    const md = vaultMarkdown(notes);
    assert.ok(md.includes(`title: "Trace — run-7f3a"`));
    assert.ok(md.includes("tags: [trace]"));
    // MOC lists it under Memory; no dangling links anywhere.
    assert.ok(vaultIndex(notes).includes("Trace — run-7f3a"));
    assert.equal(danglingLink(notes), null);
    // Search finds it via the trace tag (tag-exact match scores).
    const hits = searchVaultScored(notes, "trace");
    assert.ok(hits.some((h) => h.note.title === "Trace — run-7f3a"));
  });
});

// ---------------------------------------------------------------------------
// lessonNote / lessonNotes — phase completion/rejection digest (fixes/98 §4.3,
// L3/L5 human-review surface — dailyNote-adjacent).
// ---------------------------------------------------------------------------

/** Phase 6 with lesson rows, a failed gate, rejection history and a
 *  correction decision; phase 3 with an out-of-phase lesson row. */
function lessonProject(): Project {
  const p = seedProject({
    name: "Lesson Vault",
    // Fixed createdAt so the deterministic gate/decision stamps below are
    // always the newest instants the digest covers.
    createdAt: 1_000_000_000_000,
    memory: [
      {
        id: "lesson-l3-x",
        kind: "episodic",
        phase: 6,
        text: "L3 verify-failure: machine-run cases failing after 2 iterations: sandbox timeout; evidenceHash=abcd1234.",
        score: 0.7,
        source: "engine",
        tags: ["lesson", "verify-failure", "L3"],
      },
      {
        id: "lesson-l4-y",
        kind: "procedural",
        phase: 6,
        text: "L4 verified-procedure: P6 verify passed; evidenceHash=99aa. Reuse this module shape next run.",
        score: 0.8,
        source: "engine",
        tags: ["lesson", "verified-procedure", "L4"],
      },
      { id: "plain-row", kind: "semantic", phase: 6, text: "Ordinary memory row, not a lesson.", score: 0.5 },
      {
        id: "lesson-other-phase",
        kind: "episodic",
        phase: 3,
        text: "L2 drift: phase P3 touched files of P2.",
        score: 0.6,
        source: "engine",
        tags: ["lesson", "drift", "L2"],
      },
    ],
    decisions: [
      decision("d-ok", 6, "Approve the sandbox patch"),
      decision("d-rej", 6, "Reject the isolation policy", { decision: "reject", note: "Sandbox caps too tight." }),
    ],
  });
  const rec = p.phases[6];
  p.phases[6] = {
    ...rec,
    status: "rejected",
    gate: { passed: false, unmet: ["p6-test", "p6-source"], evidenceHash: "abc", checkedAt: 1_700_000_300_000 },
    rejectionHistory: [{ note: "Gate unmet — regenerate", at: 1_700_000_200_000 }],
  };
  return p;
}

describe("lessonNote — phase completion/rejection digest (fixes/98)", () => {
  it("emits one standalone digest with gate, lesson rows, rejections and corrections", () => {
    const p = lessonProject();
    const n = lessonNote(p, 6);
    assert.ok(n, "phase 6 has lessons to teach");
    assert.equal(n!.title, "Lessons — P6");
    assert.deepEqual(n!.tags, ["lesson", "p6"]);
    assert.deepEqual(n!.links, [], "standalone note (dailyNote-adjacent)");
    assert.equal(n!.phase, 6);
    assert.equal(n!.kind, "memory");
    assert.ok(
      n!.body.includes("**Phase:** P6 · **Status:** rejected · **Gate:** failed (unmet: p6-test; p6-source)"),
      n!.body,
    );
    assert.ok(n!.body.includes("**Rejections:** 1"));
    assert.ok(n!.body.includes("- [episodic 0.7] L3 verify-failure:"), n!.body);
    assert.ok(n!.body.includes("- [procedural 0.8] L4 verified-procedure:"), n!.body);
    assert.ok(n!.body.includes("Gate unmet — regenerate"));
    assert.ok(n!.body.includes("- reject · Reject the isolation policy · human — Sandbox caps too tight."));
    assert.ok(!n!.body.includes("Ordinary memory row"), "non-lesson memory rows stay out of the digest");
    assert.ok(!n!.body.includes("phase P3"), "other phases' lessons stay out");
    assert.equal(n!.updatedAt, 1_700_000_300_000, "newest covered instant (gate checkedAt)");
  });

  it("returns null for a clean phase and an unknown phase; a bare rejection still signals", () => {
    const p = lessonProject();
    assert.equal(lessonNote(p, 0), null, "phase 0 has no lesson signal");
    assert.equal(lessonNote(p, 99), null, "unknown phase -> no note");

    const p2 = seedProject();
    const rec2 = p2.phases[5];
    p2.phases[5] = { ...rec2, status: "rejected" };
    const n = lessonNote(p2, 5);
    assert.ok(n, "a rejection alone is a lesson signal");
    assert.ok(n!.body.includes("**Status:** rejected"));
    assert.ok(n!.body.includes("**Gate:** not recorded"), "missing gate rendered honestly");
    assert.ok(!n!.body.includes("### Lesson rows"), "empty sections are omitted");
  });

  it("lessonNotes returns only signal phases in order, deterministically, and merges cleanly", () => {
    const p = lessonProject();
    const notes = lessonNotes(p);
    assert.equal(notes.length, 2, "phase 3 (drift row) and phase 6 (rejection) carry signals");
    assert.equal(notes[0].title, "Lessons — P3", "phase order, ascending");
    assert.equal(notes[1].title, "Lessons — P6");
    assert.deepEqual(notes, lessonNotes(p), "byte-deterministic");

    const merged = [...buildVaultNotes(p), ...notes];
    assert.equal(danglingLink(merged), null);
    assert.ok(vaultIndex(merged).includes("Lessons — P6"), "MOC lists the digest under Memory");
    assert.ok(vaultIndex(merged).includes("Lessons — P3"));
    const md = vaultMarkdown(merged);
    assert.ok(md.includes('title: "Lessons — P6"'), "frontmatter round-trips");
    assert.ok(md.includes('tags: [lesson, p6]'));
  });
});

describe("vault corrupt-store hardening (strField/tsField/row/rowsOf)", () => {
  it("buildVaultNotes never throws on non-array collections or junk rows", () => {
    const p = seedProject({
      name: "Hostile",
      // @ts-expect-error intentional corrupt collections
      memory: null,
      // @ts-expect-error intentional corrupt collections
      decisions: "nope",
      // @ts-expect-error intentional corrupt collections
      artifacts: { not: "array" },
      research: undefined,
    });
    // phases may still be real from seed — leave them
    const notes = buildVaultNotes(p);
    assert.ok(notes.length >= 1, "hub still produced");
    assert.equal(notes[0].kind, "index");
    assert.equal(notes.filter((n) => n.kind === "memory").length, 0);
    assert.equal(notes.filter((n) => n.kind === "decision").length, 0);
    assert.equal(notes.filter((n) => n.kind === "artifact").length, 0);
  });

  it("buildVaultNotes skips scalar junk inside memory/decision arrays", () => {
    const p = seedProject({
      memory: [
        { id: "m1", kind: "episodic", phase: 0, text: "real row", score: 0.5 },
        // @ts-expect-error junk row
        null,
        // @ts-expect-error junk row
        "string-row",
        // @ts-expect-error junk row
        42,
      ],
      decisions: [
        {
          id: "d1",
          phase: 4 as const,
          title: "ok decision",
          decision: "approve",
          decidedBy: "human",
          requestedAt: 1_700_000_000_000,
          decidedAt: 1_700_000_100_000,
        },
        // @ts-expect-error junk row
        undefined,
      ],
    });
    const notes = buildVaultNotes(p);
    assert.equal(notes.filter((n) => n.kind === "memory").length, 1);
    assert.equal(notes.filter((n) => n.kind === "decision").length, 1);
  });

  it("dailyNote floors out-of-range timestamps (no RangeError)", () => {
    const p = seedProject({
      createdAt: 1_700_000_000_000,
      logs: [
        { ts: 9e15, phase: 0 as const, level: "info", event: "hostile.ts", detail: "too big" },
        { ts: 1_700_000_050_000, phase: 0 as const, level: "info", event: "ok.event", detail: "fine" },
      ],
      decisions: [
        {
          id: "d1",
          phase: 1 as const,
          title: "D",
          decision: "approve",
          decidedBy: "human",
          requestedAt: 1_700_000_000_000,
          decidedAt: Number.POSITIVE_INFINITY,
        },
      ],
    });
    const n = dailyNote(p, "2023-11-14");
    assert.equal(n.title, "Daily — 2023-11-14");
    assert.ok(n.body.includes("ok.event"), "valid log still rendered");
    assert.ok(!n.body.includes("hostile.ts"), "out-of-range log skipped (utcDay null)");
    assert.ok(Number.isFinite(n.updatedAt), "updatedAt stays finite");
  });

  it("dailyNote survives non-array logs/decisions", () => {
    const p = seedProject({
      createdAt: 1_700_000_000_000,
      // @ts-expect-error intentional
      logs: null,
      // @ts-expect-error intentional
      decisions: 7,
    });
    const n = dailyNote(p);
    assert.ok(n.title.startsWith("Daily — "));
    assert.ok(n.body.includes("_none_"));
  });

  it("a gate whose unmet is missing/non-array never throws (coerces to [])", () => {
    const base = seedProject();
    const p = {
      ...base,
      phases: base.phases.map((r, i) =>
        i === 0
          ? {
              ...r,
              status: "complete" as const,
              // Corrupt persisted gate: `unmet` omitted (type lie at the edge).
              gate: { passed: false, evidenceHash: "x", checkedAt: 1 } as unknown as NonNullable<
                typeof r.gate
              >,
            }
          : r,
      ),
    };
    assert.doesNotThrow(() => buildVaultNotes(p), "buildVaultNotes floors a corrupt gate");
    let note: ReturnType<typeof lessonNote> = null;
    assert.doesNotThrow(() => {
      note = lessonNote(p, 0);
    }, "lessonNote floors a corrupt gate");
    assert.ok(note && (note as { body: string }).body.includes("**Gate:** failed (unmet: unknown)"));
  });
});

// W-16: backlinksFor was this file's only untested export; the [null, 5] case
// threw although the doc block promises "unknown/empty input yields []".
describe("backlinksFor (W-16 junk-row guard)", () => {
  it("yields [] for junk rows (null/scalars) instead of throwing", () => {
    assert.deepEqual(backlinksFor([null, 5, "x"] as unknown as VaultNote[], "Target"), []);
  });

  it("yields [] for a non-array notes value", () => {
    assert.deepEqual(backlinksFor(null as unknown as VaultNote[], "Target"), []);
  });

  it("still inverts a real graph, dedupes, and never self-links", () => {
    const notes = [
      { title: "A", links: ["Target"] },
      { title: "B", links: ["Target", "A"] },
      { title: "Target", links: ["A"] },
      { title: "C", links: [] },
    ] as unknown as VaultNote[];
    assert.deepEqual(backlinksFor(notes, "Target"), ["A", "B"]);
  });

  it("excludes true self-links, dedupes repeat titles, and keeps vault order (not alphabetical)", () => {
    // W40 N1: the remaining doc-contract cases beyond junk rows + the [A, B]
    // graph — a true self-link row, a duplicate-title row, and order-vs-sort.
    const notes = [
      { title: "Zed", links: ["Target"] },
      { title: "Target", links: ["Target", "Zed"] }, // true self-link → excluded
      { title: "Alpha", links: ["Target"] },
      { title: "Alpha", links: ["Target"] }, // duplicate title → one backlink
      { title: "Plain", links: [] },
    ] as unknown as VaultNote[];
    assert.deepEqual(backlinksFor(notes, "Target"), ["Zed", "Alpha"]);
  });

  it("yields [] for an unknown title and for the empty vault", () => {
    const notes = [{ title: "A", links: ["B"] }] as unknown as VaultNote[];
    assert.deepEqual(backlinksFor(notes, "Missing"), []);
    assert.deepEqual(backlinksFor([], "Any"), []);
  });
});

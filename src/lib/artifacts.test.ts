// ---------------------------------------------------------------------------
// artifacts.test.ts — materialize phase artifacts as visible markdown files.
// Run: node --experimental-strip-types --test src/lib/artifacts.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createProject, runPhase } from "./headless.ts";
import { materializeArtifacts } from "./artifacts.ts";
import type { Artifact, PhaseId, Project } from "./types.ts";
import { FIXTURE_BRIEF } from "./testing/fixtures.ts";

async function runP0(): Promise<Project> {
  return runPhase(createProject({ brief: FIXTURE_BRIEF }), 0);
}

function projectWith(artifacts: Artifact[]): Project {
  return { ...createProject({ brief: FIXTURE_BRIEF }), artifacts };
}

describe("artifacts: materializeArtifacts", () => {
  it("emits one markdown document per phase artifact at artifacts/P<phase>-<id>.md", async () => {
    const p = await runP0();
    const docs = materializeArtifacts(p);
    assert.equal(docs.length, p.artifacts.length, "one document per artifact");
    for (const d of docs) {
      assert.match(d.path, /^artifacts\/P\d+-.+\.md$/, `path shape: ${d.path}`);
    }
    const paths = docs.map((d) => d.path);
    assert.equal(new Set(paths).size, paths.length, "paths are unique");
  });

  it("carries a plain-English title header and the artifact's own body verbatim", () => {
    const a: Artifact = {
      id: "p12-adr",
      phase: 12 as PhaseId,
      kind: "docs",
      title: "Architecture Decision Record",
      body: "# ADR-0001\n\nWe chose the boring option.",
      language: "markdown",
    };
    const docs = materializeArtifacts(projectWith([a]));
    assert.equal(docs.length, 1);
    assert.equal(docs[0].path, "artifacts/P12-p12-adr.md");
    assert.ok(docs[0].body.startsWith("# Architecture Decision Record"), "title header first");
    assert.ok(docs[0].body.includes("P12 — Documentation & Technical Specs"), "plain-English phase name");
    assert.ok(docs[0].body.includes("kind: `docs`"), "kind stated");
    assert.ok(docs[0].body.includes("language: `markdown`"), "language stated");
    assert.ok(docs[0].body.includes("# ADR-0001\n\nWe chose the boring option."), "body verbatim");
  });

  it("annotates an empty/absent body honestly instead of inventing prose", () => {
    const docs = materializeArtifacts(
      projectWith([
        { id: "empty", phase: 6 as PhaseId, kind: "code", title: "Empty Artifact", body: "" },
        { id: "missing", phase: 6 as PhaseId, kind: "code", title: "Missing Body" } as unknown as Artifact,
      ]),
    );
    assert.equal(docs.length, 2);
    for (const d of docs) {
      assert.ok(d.body.includes("No body was recorded for this artifact"), `honest placeholder: ${d.path}`);
    }
  });

  it("deduplicates colliding paths without dropping a document", () => {
    const docs = materializeArtifacts(
      projectWith([
        { id: "dup", phase: 3 as PhaseId, kind: "tools", title: "First", body: "one" },
        { id: "dup", phase: 3 as PhaseId, kind: "tools", title: "Second", body: "two" },
      ]),
    );
    assert.equal(docs.length, 2);
    assert.equal(docs[0].path, "artifacts/P3-dup.md");
    assert.equal(docs[1].path, "artifacts/P3-dup-2.md");
  });

  it("sanitizes unsafe ids and is pure/deterministic", () => {
    const a: Artifact = { id: "a/b c*d", phase: 1 as PhaseId, kind: "graph", title: "Graph", body: "x" };
    const p = projectWith([a]);
    const d1 = materializeArtifacts(p);
    assert.equal(d1[0].path, "artifacts/P1-a-b-c-d.md");
    assert.deepEqual(d1, materializeArtifacts(p), "same record => identical output");
    assert.deepEqual(materializeArtifacts(projectWith([])), [], "a run with no artifacts yields no documents");
  });
});

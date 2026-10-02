// ---------------------------------------------------------------------------
// io.test.ts — project import/export + packet file + filename slug suite.
// Run: node --experimental-strip-types --test src/lib/io.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ARTIFACT_PRODUCERS,
  coerceArtifactProvenance,
  IMPORT_MAX_CHARS,
  PHASE_COUNT,
  downloadFilename,
  exportPacketText,
  exportProjectJson,
  importProject,
  slugName,
  type ArtifactProvenance,
} from "./io.ts";
import { compileAgentPacket } from "./packet.ts";
import { hydrateProject, stampPacket } from "./engine.ts";
import { phaseHandoff } from "./handoff.ts";
import { ALL_PHASES, runHeadless, seedProject } from "./testing/fixtures.ts";
import type { Project, WildParkInfo, WildStepSummary } from "./types.ts";

const fullRun = () => runHeadless(seedProject(), ALL_PHASES);

describe("exportProjectJson", () => {
  it("serializes a project to JSON that round-trips structurally", () => {
    const p = fullRun();
    const json = exportProjectJson(p);
    assert.equal(typeof json, "string");
    const parsed = JSON.parse(json) as Project;
    assert.equal(parsed.id, p.id);
    assert.equal(parsed.name, p.name);
    assert.equal(parsed.brief, p.brief);
    assert.equal(parsed.currentPhase, p.currentPhase);
    assert.equal(parsed.phases.length, PHASE_COUNT);
    // JSON is lossy for `undefined` (optional fields), so compare against a
    // second JSON pass rather than the live object.
    assert.deepEqual(JSON.parse(exportProjectJson(p)), parsed);
  });

  it("is stable (same project, same bytes)", () => {
    const p = seedProject();
    assert.equal(exportProjectJson(p), exportProjectJson(p));
  });
});

// ---------------------------------------------------------------------------
// M7-01 (fixes/310 B4): the round-trip is a BYTE no-op on the FIRST pass.
//
// The hydrate normalizers stamp defaults at IMPORT time — repairPhases
// (`?? []` / `?? null` per phase row) + the research/implementationSpec
// top-level defaults — so a project created without those keys drifted on its
// first export→import→export hop (probe ~/rt6/probes/p3_roundtrip.mjs:
// R2 equal:false, 24 structured diffs, ALL "key ADDED": rejectionHistory ×13,
// gate ×9, research, implementationSpec). emptyProject (engine.ts) now stamps
// the same defaults at the one place rows/projects are created, so persisted
// bytes equal re-serialized bytes on the first pass (R2 equal:true) — a
// reloaded clone emits identical project.json bytes.
// ---------------------------------------------------------------------------
describe("M7-01 (fixes/310): first-pass export→import→export byte parity", () => {
  it("a full run round-trips byte-identically on the FIRST pass (no key drift)", () => {
    const p = fullRun();
    const s1 = exportProjectJson(p);
    const res = importProject(s1);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(
      exportProjectJson(res.project),
      s1,
      "import must not add keys the first export omitted (rejectionHistory/gate/research/implementationSpec)",
    );
  });

  it("a fresh project (pre-run) round-trips byte-identically too", () => {
    const p = seedProject();
    const s1 = exportProjectJson(p);
    const res = importProject(s1);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(exportProjectJson(res.project), s1);
  });

  it("hydrateProject alone is byte-stable on a healthy run (no repair drift)", () => {
    const p = fullRun();
    assert.equal(
      exportProjectJson(hydrateProject(p)),
      exportProjectJson(p),
      "hydrate of a healthy payload must not mutate its serialized shape",
    );
  });
});

describe("importProject", () => {
  it("round-trips a full exported project back to an ok project", () => {
    const p = fullRun();
    const res = importProject(exportProjectJson(p));
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.project.id, p.id);
    assert.equal(res.project.currentPhase, p.currentPhase);
    assert.equal(res.project.phases.length, PHASE_COUNT);
    assert.equal(res.project.status, p.status);
  });

  it("refuses non-string payloads outright (no JSON.parse coercion)", () => {
    // JSON.parse coerces its argument via toString — numbers/objects would
    // otherwise be parsed as "[object Object]" style junk instead of being
    // refused with the honest message.
    for (const bad of [42, true, { id: "x" }, ["x"], null, undefined]) {
      const res = importProject(bad as unknown as string);
      assert.equal(res.ok, false, `should refuse ${String(bad)}`);
      if (!res.ok) assert.match(res.error, /JSON string/i);
    }
  });

  it("refuses oversized payloads before any parse work (bounded memory)", () => {
    const res = importProject(`{"pad":"${"x".repeat(IMPORT_MAX_CHARS + 1)}"}`);
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.error, /too large/i);
  });

  it("accepts a payload at the size cap boundary (no off-by-one refusal)", () => {
    // A project exactly AT the cap parses and shape-validates like any other
    // (padding sits inside an unknown field the engine carries through).
    const p = fullRun();
    const raw = JSON.parse(exportProjectJson(p)) as Record<string, unknown>;
    const pad = Math.max(0, IMPORT_MAX_CHARS - exportProjectJson(p).length);
    raw.padding = "x".repeat(pad);
    const json = JSON.stringify(raw);
    assert.ok(json.length <= IMPORT_MAX_CHARS, `payload ${json.length} must fit under the cap`);
    const res = importProject(json);
    assert.equal(res.ok, true);
    if (res.ok) assert.equal(res.project.id, p.id);
  });

  it("rejects malformed JSON", () => {
    const res = importProject("{ not json");
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.error, /Invalid JSON/);
  });

  // W49 · 335-2: `maxChars` lets a byte-source that ALREADY holds the payload
  // (the file loader — its readFileSync precedes this call) lift the hostile-
  // PASTE cap, so a record the tool's own writer produced is never unreadable
  // by its own reader. The default cap stays byte-identical.
  it("W49 · 335-2: maxChars lifts the paste cap only for the caller that asks", () => {
    const p = fullRun();
    const raw = JSON.parse(exportProjectJson(p)) as Record<string, unknown>;
    raw.padding = "x".repeat(IMPORT_MAX_CHARS + 50); // over the default cap, shape still valid
    const json = JSON.stringify(raw);
    assert.ok(json.length > IMPORT_MAX_CHARS, "fixture is genuinely over the cap");
    assert.equal(importProject(json).ok, false, "the default hostile-paste cap is unchanged");
    assert.equal(
      importProject(json, { maxChars: Number.POSITIVE_INFINITY }).ok,
      true,
      "an explicit maxChars lifts the cap for a trusted byte source",
    );
    assert.equal(importProject(json, { maxChars: 10 }).ok, false, "a caller-pinned cap still refuses");
  });

  it("319_f1: a malformed import refuses with the declared RT_E_VALIDATION code", () => {
    // The catch-level code must ride the envelope, not just the message:
    // classifyError maps a JSON.parse SyntaxError to RT_E_VALIDATION
    // (errors.ts matcher #6) and the store forwards it end-to-end.
    const res = importProject("{ not json");
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.match(res.error, /Invalid JSON/);
      assert.equal(res.code, "RT_E_VALIDATION");
    }
  });

  it("rejects non-object payloads (array, null, string)", () => {
    for (const bad of ["[]", "null", "\"hello\"", "42"]) {
      const res = importProject(bad);
      assert.equal(res.ok, false, `should reject ${bad}`);
      if (!res.ok) assert.match(res.error, /project object/i);
    }
  });

  it("rejects a missing or non-string id", () => {
    const p = seedProject() as unknown as Record<string, unknown>;
    delete p.id;
    assert.equal(importProject(JSON.stringify(p)).ok, false);
    const empty = { ...seedProject(), id: "" };
    const res = importProject(JSON.stringify(empty));
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.error, /id/);
  });

  it("rejects a missing name or brief", () => {
    const noName = seedProject() as unknown as Record<string, unknown>;
    delete noName.name;
    assert.equal(importProject(JSON.stringify(noName)).ok, false);

    const noBrief = seedProject() as unknown as Record<string, unknown>;
    delete noBrief.brief;
    assert.equal(importProject(JSON.stringify(noBrief)).ok, false);
  });

  it("rejects a phases array that is not exactly 13 records", () => {
    const p = seedProject() as unknown as Record<string, unknown>;
    p.phases = (p.phases as unknown[]).slice(0, 5);
    const res = importProject(JSON.stringify(p));
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.error, /13/);
  });

  it("rejects an out-of-range currentPhase", () => {
    for (const bad of [-1, 13, 1.5, "4"]) {
      const p = seedProject() as unknown as Record<string, unknown>;
      p.currentPhase = bad;
      const res = importProject(JSON.stringify(p));
      assert.equal(res.ok, false, `should reject currentPhase ${bad}`);
    }
  });

  it("rejects missing artifacts/logs arrays", () => {
    const noArt = seedProject() as unknown as Record<string, unknown>;
    delete noArt.artifacts;
    assert.equal(importProject(JSON.stringify(noArt)).ok, false);

    const noLogs = seedProject() as unknown as Record<string, unknown>;
    delete noLogs.logs;
    assert.equal(importProject(JSON.stringify(noLogs)).ok, false);
  });

  it("hydrates a payload with a bad phase id (repair, still 13 phases, still ok)", () => {
    const p = fullRun() as unknown as Record<string, unknown>;
    const phases = (p.phases as unknown[]).slice();
    phases[0] = { id: 99, status: "complete" }; // unknown id → dropped + re-inserted
    p.phases = phases;
    const res = importProject(JSON.stringify(p));
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.project.phases.length, PHASE_COUNT);
      assert.ok(res.project.phases.every((r) => r.id >= 0 && r.id <= 12));
    }
  });
});

// ---------------------------------------------------------------------------
// CORE sweep (58_ready_core) — corrupt NESTED rows at the import boundary.
// importProject validates the container (arrays of the right length) but the
// payload still hydrates when individual ROWS are junk; hydrateProject now
// per-row repairs artifacts/decisions/logs/memory and rebuilds junk
// lattice/schedule, so a hand-edited or truncated import can never crash the
// first stamp/compile/handoff/run that touches it.
// ---------------------------------------------------------------------------

describe("importProject — corrupt nested rows", () => {
  const fullRun = () => runHeadless(seedProject(), ALL_PHASES);
  const corrupt = (mutate: (raw: Record<string, unknown>) => void): string => {
    const raw = JSON.parse(exportProjectJson(fullRun())) as Record<string, unknown>;
    mutate(raw);
    return JSON.stringify(raw);
  };

  it("drops junk artifact rows at import so stamping/compiling never throws", () => {
    const json = corrupt((raw) => {
      raw.artifacts = [null, 42, "x", { ...(raw.artifacts as object[])[0] }];
    });
    const res = importProject(json);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.project.artifacts.length, 1, "null/number/string rows are dropped");
    assert.ok(res.project.logs.some((l) => l.event === "hydrate.repaired"), "repair is logged");
    const stamped = stampPacket(res.project); // attachAlgorithms → compileAgentPacket
    assert.ok(stamped.packet.length > 0);
    assert.doesNotThrow(() => phaseHandoff(stamped, 3));
  });

  it("drops corrupt decisions rows (null / missing decidedAt) but keeps well-formed ones", () => {
    const json = corrupt((raw) => {
      raw.decisions = [
        null,
        { phase: 0, decision: "approve", decidedBy: "human" }, // no decidedAt → ledger toISOString would throw
        { id: "ok", phase: 1, decision: "approve", decidedBy: "human", requestedAt: 1, decidedAt: 2, note: null },
      ];
    });
    const res = importProject(json);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.project.decisions.length, 1);
    assert.equal(res.project.decisions[0].id, "ok");
    stampPacket(res.project); // renders the ledger — must not throw
  });

  it("drops memory rows with non-string text or non-numeric score", () => {
    const json = corrupt((raw) => {
      raw.memory = [
        { id: "m1", kind: "episodic", phase: 0, text: 42, score: 0.5 },
        { id: "m2", kind: "semantic", phase: 1, text: "ok", score: "high" },
        { id: "m3", kind: "semantic", phase: 1, text: "fine", score: 0.8 },
      ];
    });
    const res = importProject(json);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.project.memory.length, 1);
    assert.equal(res.project.memory[0].id, "m3");
    stampPacket(res.project);
  });

  it("rebuilds junk lattice/schedule values instead of crashing the pipeline", () => {
    const cases: [string, unknown][] = [
      ["lattice", "x"],
      ["schedule", {}],
      ["schedule", "bogus"],
      ["schedule", { tightness: "tight" }],
    ];
    for (const [field, junk] of cases) {
      const json = corrupt((raw) => {
        raw[field] = junk;
      });
      const res = importProject(json);
      assert.equal(res.ok, true, `${field}=${JSON.stringify(junk)} must import`);
      if (!res.ok) continue;
      assert.notEqual(res.project[field as "lattice" | "schedule"], null, `${field} junk is rebuilt`);
      assert.doesNotThrow(() => stampPacket(res.project), `${field} junk must not break stamping`);
      assert.doesNotThrow(() => phaseHandoff(res.project, 3), `${field} junk must not break handoff`);
    }
  });

  it("H-03 P1: importProject normalizes a non-array research cleanly (never a hydration throw)", () => {
    const json = corrupt((raw) => {
      raw.research = 5;
    });
    const res = importProject(json);
    assert.equal(res.ok, true, "corrupt research imports (normalized, not thrown)");
    if (!res.ok) return;
    assert.ok(Array.isArray(res.project.research), "research coerced to an array");
    assert.equal(res.project.research.length, 0);
  });

  it("H-04 G2: the packet research_hash dedupes duplicate corpus URLs (stable fingerprint)", () => {
    const base = seedProject();
    const entry = {
      query: "rental software",
      provider: "duckduckgo",
      items: [{ title: "A", url: "https://a.example", content: "x" }],
    };
    const single = hydrateProject({
      ...base,
      research: [entry] as never,
    });
    const dup = hydrateProject({
      ...base,
      research: [entry, { ...entry, items: [...entry.items, { title: "A", url: "https://a.example", content: "x" }] }] as never,
    });
    const h1 = compileAgentPacket(single).match(/research_hash: (\d+)/)?.[1];
    const h2 = compileAgentPacket(dup).match(/research_hash: (\d+)/)?.[1];
    assert.equal(h1, h2, "a duplicate URL cannot churn the corpus fingerprint");
  });

  it("215: hydrateProject preserves a legal delivery kind and drops a junk one", () => {
    const base = seedProject();
    const app = hydrateProject({ ...base, kind: "app" } as never);
    assert.equal(app.kind, "app", "declared kind survives hydration (codegen tree trigger reads it)");
    const game = hydrateProject({ ...base, kind: "game" } as never);
    assert.equal(game.kind, "game");
    // A hand-edited / legacy payload with an unknown kind must not survive —
    // singleModuleLibraryKind() reads it directly and a garbage value would
    // silently mis-route synthesis. Absent → the legacy library path.
    const junk = hydrateProject({ ...base, kind: "banana" } as never);
    assert.equal(junk.kind, undefined, "unknown kind is dropped");
    assert.equal("kind" in junk, false, "dropped kind is absent, not undefined-valued (byte-identical floor)");
  });

  it("survives a legacy modelRoute with junk log rows (per-row log repair)", () => {
    const json = corrupt((raw) => {
      raw.modelRoute = "grok-4.5"; // legacy route → hydrate scans logs for LLM evidence
      raw.logs = [
        null,
        42,
        "nope",
        { ts: 1, phase: 0, level: "info", event: "deepseek.call", detail: "ok" },
      ];
    });
    const res = importProject(json);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.project.modelRoute, "deepseek-flash", "surviving LLM log evidence routes honestly");
  });

  it("keeps unknown/future fields through the import round trip", () => {
    const raw = JSON.parse(exportProjectJson(fullRun())) as Record<string, unknown>;
    raw.futureField = { nested: [1, 2, 3] };
    (raw.phases as Record<string, unknown>[])[0].future = 7;
    (raw.artifacts as Record<string, unknown>[])[0].futureFlag = true;
    const res = importProject(JSON.stringify(raw));
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const out = JSON.parse(exportProjectJson(res.project)) as Record<string, unknown>;
    assert.deepEqual(out.futureField, { nested: [1, 2, 3] });
    assert.equal((out.phases as Record<string, unknown>[])[0].future, 7);
    assert.equal((out.artifacts as Record<string, unknown>[])[0].futureFlag, true);
  });
});

// ---------------------------------------------------------------------------
// fixes/115 H-03 (io half) — corrupt post-whitelist field defense at the
// import boundary. The whitelist validates id/name/brief/phases/currentPhase/
// artifacts/logs; EVERY other field used to ride through unvalidated, so a
// corrupt research value threw inside hydrateProject's compile pass with a
// misleading "Import failed during hydration" — or rode through an early-return
// hydrate and crashed the NEXT stampPacket/approve/execute. importProject now
// coerces-or-drops defensible post-whitelist fields before hydration and writes
// a loud `import.repaired` trail row (probe-io.ts vector).
// ---------------------------------------------------------------------------

describe("importProject — corrupt post-whitelist fields (fixes/115 H-03 io half)", () => {
  const corrupt = (mutate: (raw: Record<string, unknown>) => void): string => {
    const raw = JSON.parse(exportProjectJson(fullRun())) as Record<string, unknown>;
    mutate(raw);
    return JSON.stringify(raw);
  };
  const repairRow = (res: { ok: true; project: Project } | { ok: false; error: string }) =>
    res.ok ? res.project.logs.find((l) => l.event === "import.repaired") : undefined;

  it("fixes/144 M2: a well-formed generatedTree round-trips byte-identically", () => {
    const raw = JSON.parse(exportProjectJson(fullRun())) as Record<string, unknown>;
    raw.generatedTree = [
      { path: "src/domain/property.ts", source: "export interface Property {}", hash: "h1", attempt: 0 },
      { path: "src/domain/lease.ts", source: "export interface Lease {}", hash: "h2", attempt: 1 },
    ];
    const res = importProject(JSON.stringify(raw));
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.deepEqual(res.project.generatedTree, raw.generatedTree);
    assert.equal(repairRow(res), undefined, "no repair note on a well-formed tree");
  });

  it("T0.2: unknown per-row keys on a well-formed generatedTree survive import", () => {
    const raw = JSON.parse(exportProjectJson(fullRun())) as Record<string, unknown>;
    raw.generatedTree = [
      {
        path: "src/domain/property.ts",
        source: "export interface Property {}",
        hash: "h1",
        attempt: 0,
        fixtureIds: ["fx-1"],
      },
    ];
    const res = importProject(JSON.stringify(raw));
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const row = res.project.generatedTree?.[0] as { fixtureIds?: unknown } | undefined;
    assert.deepEqual(row?.fixtureIds, ["fx-1"], "future per-file fields must not be stripped");
    assert.equal(repairRow(res), undefined, "preserving extras is not a repair");
  });

  it("A1: well-formed acceptanceFixtures round-trip; junk rows dropped; legacy absence byte-identical", () => {
    const good = {
      id: "orc-1",
      requirementId: "orc-1",
      capability: "record",
      name: "job.record.happy",
      given: { address: "1 Main" },
      expect: { kind: "shape", value: { id: "p-1" } },
      kind: "pure",
      source: "a7",
      approval: "pending",
      target: "createProperty",
    };
    const raw = JSON.parse(exportProjectJson(fullRun())) as Record<string, unknown>;
    assert.equal("acceptanceFixtures" in raw, false, "legacy export has ABSENCE, not []");
    raw.acceptanceFixtures = [good, { id: "" }, null];
    raw.acceptanceBriefHash = "abc";
    raw.acceptanceApprovedAt = 1;
    const res = importProject(JSON.stringify(raw));
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.project.acceptanceFixtures?.length, 1);
    assert.equal(res.project.acceptanceFixtures?.[0]?.target, "createProperty");
    assert.equal(res.project.acceptanceBriefHash, "abc");
    const note = repairRow(res);
    assert.ok(
      note === undefined || String(note.detail).includes("acceptanceFixtures"),
      "junk rows are dropped loudly or silently if hydrate already coerced",
    );
  });

  it("A1: non-array acceptanceFixtures is dropped (absence), never a throw", () => {
    const res = importProject(corrupt((raw) => (raw.acceptanceFixtures = 5)));
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.project.acceptanceFixtures, undefined);
  });

  it("fixes/144 M2: corrupt generatedTree is dropped loudly, never a hydration throw", () => {
    // non-array junk → field absent (legal legacy shape)
    for (const junk of [5, "str", true]) {
      const res = importProject(corrupt((raw) => (raw.generatedTree = junk)));
      assert.equal(res.ok, true, `generatedTree=${JSON.stringify(junk)} must import cleanly`);
      if (!res.ok) continue;
      assert.equal(res.project.generatedTree, undefined, `generatedTree=${JSON.stringify(junk)} dropped`);
      const row = repairRow(res);
      assert.ok(
        row && String(row.detail).includes("generatedTree:dropped"),
        `repair note records the drop for ${JSON.stringify(junk)}`,
      );
    }
    // array with junk items → junk items filtered, well-formed kept
    const res = importProject(
      corrupt((raw) => {
        raw.generatedTree = [
          { path: "src/a.ts", source: "x", hash: "h" },
          null,
          { path: 5, source: "y", hash: "h2" },
          { path: "src/b.ts", source: "y", hash: "h2", attempt: 2 },
        ];
      }),
    );
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.deepEqual(res.project.generatedTree, [
      { path: "src/a.ts", source: "x", hash: "h", attempt: 0 },
      { path: "src/b.ts", source: "y", hash: "h2", attempt: 2 },
    ]);
    assert.ok(
      repairRow(res) &&
        String(repairRow(res)!.detail).match(/generatedTree:(files:-\d+|dropped)/),
      "item-level junk records the drop",
    );
  });

  it("coerces a corrupt research container to [] with a repair note — clean import, never a hydration throw", () => {
    for (const junk of [5, {}, "str", null, true]) {
      const res = importProject(corrupt((raw) => (raw.research = junk)));
      assert.equal(res.ok, true, `research=${JSON.stringify(junk)} must import cleanly`);
      if (!res.ok) continue;
      assert.deepEqual(res.project.research, [], `research=${JSON.stringify(junk)} coerced to []`);
      const row = repairRow(res);
      assert.ok(
        row && String(row.detail).includes("research:dropped"),
        `repair trail names research:dropped for ${JSON.stringify(junk)}`,
      );
      assert.doesNotThrow(() => stampPacket(res.project), "stamping the repaired project must not throw");
    }
  });

  it("drops junk research entries/items but keeps the well-formed corpus rows", () => {
    const json = corrupt((raw) => {
      raw.research = [
        { query: "q1", items: [{ title: "t", url: "https://x", content: "c" }] },
        null,
        42,
        { query: "no-items" },
        { query: "q2", items: [null, { title: "u", url: "https://u", content: "" }, "junk"] },
      ];
    });
    const res = importProject(json);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const research = res.project.research ?? [];
    assert.equal(research.length, 2, "two well-formed entries survive");
    assert.equal(research[1].items.length, 1, "junk items dropped inside a kept entry");
    const row = repairRow(res);
    assert.ok(row && String(row.detail).includes("research:entries:-3"), "trail counts dropped entries");
    assert.ok(row && String(row.detail).includes("research:items:-2"), "trail counts dropped items");
    assert.doesNotThrow(() => stampPacket(res.project));
  });

  it("defends a corrupt chatLog: junk container dropped, junk rows filtered, repair noted", () => {
    const containerJunk = importProject(corrupt((raw) => (raw.chatLog = 5)));
    assert.equal(containerJunk.ok, true, "non-array chatLog imports cleanly");
    if (!containerJunk.ok) return;
    assert.deepEqual(containerJunk.project.chatLog, []);
    const row1 = repairRow(containerJunk);
    assert.ok(row1 && String(row1.detail).includes("chatLog:dropped"), "trail names chatLog:dropped");

    const rowJunk = importProject(
      corrupt((raw) => {
        raw.chatLog = [
          null,
          42,
          { role: "user", text: "hi", ts: 1 },
          { role: "assistant", text: "yo", ts: 2 },
        ];
      }),
    );
    assert.equal(rowJunk.ok, true, "chatLog with junk rows imports cleanly");
    if (!rowJunk.ok) return;
    assert.deepEqual(rowJunk.project.chatLog, [
      { role: "user", text: "hi", ts: 1 },
      { role: "assistant", text: "yo", ts: 2 },
    ]);
    const row2 = repairRow(rowJunk);
    assert.ok(row2 && String(row2.detail).includes("chatLog:rows:-2"), "trail counts dropped chat rows");
    assert.doesNotThrow(() => stampPacket(rowJunk.project));
  });

  it("defends a corrupt oracle: non-array container and nameless/null rows are dropped with a note", () => {
    const containerJunk = importProject(corrupt((raw) => (raw.oracle = "nope")));
    assert.equal(containerJunk.ok, true, "non-array oracle imports cleanly");
    if (!containerJunk.ok) return;
    assert.deepEqual(containerJunk.project.oracle, []);
    const row1 = repairRow(containerJunk);
    assert.ok(row1 && String(row1.detail).includes("oracle:dropped"), "trail names oracle:dropped");

    const rowJunk = importProject(
      corrupt((raw) => {
        raw.oracle = [
          null,
          42,
          { id: "o2", name: "has-name", given: "in", expect: "out", job: "j" },
          { id: "o3" }, // no name → unaddressable junk
        ];
      }),
    );
    assert.equal(rowJunk.ok, true, "oracle with junk rows imports cleanly");
    if (!rowJunk.ok) return;
    assert.equal(rowJunk.project.oracle.length, 1, "only the named oracle row survives");
    assert.equal(rowJunk.project.oracle[0].id, "o2");
    const row2 = repairRow(rowJunk);
    assert.ok(row2 && String(row2.detail).includes("oracle:rows:-3"), "trail counts dropped oracle rows");
    assert.doesNotThrow(() => stampPacket(rowJunk.project));
  });

  it("nulls a structurally-broken scorecard (missing axes/bottlenecks/attackVectors) with a note", () => {
    const res = importProject(corrupt((raw) => (raw.scorecard = { overall: 8, verdict: "proceed" })));
    assert.equal(res.ok, true, "scorecard without its arrays imports cleanly");
    if (!res.ok) return;
    assert.equal(res.project.scorecard, null, "untrustable scorecard dropped to the null floor");
    const row = repairRow(res);
    assert.ok(row && String(row.detail).includes("scorecard:dropped"), "trail names scorecard:dropped");
    assert.doesNotThrow(() => stampPacket(res.project));
  });

  it("filters junk scorecard axes rows but keeps the rest of a well-formed scorecard", () => {
    const res = importProject(
      corrupt((raw) => {
        const sc = raw.scorecard as Record<string, unknown>;
        sc.axes = [...(sc.axes as unknown[]).slice(0, 1), null, "junk"];
      }),
    );
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.project.scorecard!.axes.length, 1, "only the well-formed axis survives");
    const row = repairRow(res);
    assert.ok(row && String(row.detail).includes("scorecard:axes:-2"), "trail counts dropped axes rows");
    assert.doesNotThrow(() => stampPacket(res.project));
  });

  it("nulls specGraph/contracts whose inner collections are junk (plain-object guard bypass)", () => {
    const sg = importProject(corrupt((raw) => (raw.specGraph = { order: 5, nodes: "x" })));
    assert.equal(sg.ok, true, "specGraph {order:5} imports cleanly");
    if (!sg.ok) return;
    const sgRow = repairRow(sg);
    assert.ok(sgRow && String(sgRow.detail).includes("specGraph:dropped"), "trail names specGraph:dropped");
    assert.ok(
      Array.isArray(sg.project.specGraph?.order) && Array.isArray(sg.project.specGraph?.nodes),
      "specGraph rebuilt to a usable shape (algorithms re-attach)",
    );
    assert.doesNotThrow(() => stampPacket(sg.project));

    const ct = importProject(corrupt((raw) => (raw.contracts = { entities: 5 })));
    assert.equal(ct.ok, true, "contracts {entities:5} imports cleanly");
    if (!ct.ok) return;
    assert.equal(ct.project.contracts, null, "untrustable contracts dropped to null");
    const ctRow = repairRow(ct);
    assert.ok(ctRow && String(ctRow.detail).includes("contracts:dropped"), "trail names contracts:dropped");
    assert.doesNotThrow(() => stampPacket(ct.project));
  });

  it("filters junk crew rows (a null row used to crash the packet crew render)", () => {
    const res = importProject(corrupt((raw) => (raw.crew = [null, "x", 42])));
    assert.equal(res.ok, true, "crew with junk rows imports cleanly");
    if (!res.ok) return;
    assert.deepEqual(res.project.crew, []);
    const row = repairRow(res);
    assert.ok(row && String(row.detail).includes("crew:rows:-3"), "trail counts dropped crew rows");
    assert.doesNotThrow(() => stampPacket(res.project));
  });

  it("regression (probe-io vector): research=5 + corrupt oracle/chatLog imported cleanly with one trail row", () => {
    const json = corrupt((raw) => {
      raw.research = 5; // used to throw "(project.research ?? []).slice is not a function"
      raw.oracle = "nope";
      raw.chatLog = [null];
    });
    const res = importProject(json);
    assert.equal(
      res.ok,
      true,
      "hostile payload imports cleanly — was: ok:false 'Import failed during hydration: … .slice is not a function'",
    );
    if (!res.ok) return;
    const detail = String(repairRow(res)?.detail ?? "");
    assert.ok(detail.includes("research:dropped"), `trail names research: ${detail}`);
    assert.ok(detail.includes("oracle:dropped"), `trail names oracle: ${detail}`);
    assert.ok(detail.includes("chatLog:rows:-1"), `trail names chatLog rows: ${detail}`);
    assert.doesNotThrow(() => stampPacket(res.project), "next stamp must not throw on the defended payload");
  });
});

describe("exportPacketText", () => {
  it("returns the packet text when there are no operator notes", () => {
    const p = seedProject();
    assert.equal(exportPacketText(p), p.packet);
  });

  it("appends the operator notes block when notes are present", () => {
    const p = { ...seedProject(), notes: "Ship the audit trail first." };
    const text = exportPacketText(p);
    assert.ok(text.startsWith(p.packet));
    assert.ok(text.includes("## Operator notes"));
    assert.ok(text.includes("Ship the audit trail first."));
  });

  it("de-dupe pin (K7-4 / G2 edge 2): a compiled packet already embedding the notes renders ONCE", () => {
    const p = { ...fullRun(), notes: "Ship the audit trail first." };
    const compiled = compileAgentPacket(p);
    assert.ok(compiled.includes("## Operator notes (human steering)"), "compile embeds the notes block");
    const text = exportPacketText({ ...p, packet: compiled });
    assert.equal(text, compiled, "stamped packet passes through unmodified — no second notes block");
    assert.equal(text.split("## Operator notes").length - 1, 1, "exactly ONE notes block renders");
  });

  it("de-dupe pin: notes edited AFTER the last compile still append (the packet is the stale side)", () => {
    const p = { ...fullRun(), notes: "first note" };
    const compiled = compileAgentPacket(p);
    const text = exportPacketText({ ...p, notes: "new note after compile", packet: compiled });
    assert.ok(text.startsWith(compiled), "compiled packet stays the prefix");
    assert.equal(text.split("## Operator notes").length - 1, 2, "embedded + appended block both render");
    assert.ok(text.includes("new note after compile"));
  });
});

describe("slugName + downloadFilename", () => {
  it("slugifies names (lowercase, dash-separated, trimmed)", () => {
    assert.equal(slugName("Northwind Dispatch"), "northwind-dispatch");
    assert.equal(slugName("  Hello, World!  "), "hello-world");
    assert.equal(slugName("ACME & Sons / Repair"), "acme-sons-repair");
  });

  it("never returns an empty slug", () => {
    assert.equal(slugName(""), "project");
    assert.equal(slugName("!!!###"), "project");
  });

  it("caps slugs at 80 chars so download filenames stay filesystem-safe", () => {
    assert.equal(slugName("A".repeat(500)).length, 80);
    const fn = downloadFilename(seedProject({ name: `${"x".repeat(300)} name` }), "json");
    assert.ok(fn.length <= 85, `filename unexpectedly long: ${fn.length}`);
    assert.ok(fn.endsWith(".json"));
    // The cap never leaves a dangling '-' (cut mid-separator) and never empties.
    const cut = slugName(`${"a".repeat(79)} - b`);
    assert.equal(cut, "a".repeat(79));
    const cut2 = slugName(`${"a".repeat(80)}-`);
    assert.equal(cut2, "a".repeat(80));
  });

  it("builds .json and .md filenames from the project name", () => {
    const p = seedProject({ name: "Northwind Dispatch" });
    assert.equal(downloadFilename(p), "northwind-dispatch.json");
    assert.equal(downloadFilename(p, "md"), "northwind-dispatch.md");
  });
});

describe("174-3 preserveWildRun hydrate", () => {
  it("default hydrate force-stops an active run; preserveWildRun keeps it", () => {
    const p = seedProject({ name: "WildKeep" });
    const active = {
      ...p,
      wildMode: true,
      wildRun: {
        active: true,
        phase: p.currentPhase,
        startedAt: 1,
        lastAutoLog: "started",
        lastAutoAt: 1,
        stoppedAt: null,
        pause: false,
      },
    };
    const json = exportProjectJson(active);
    const def = importProject(json);
    assert.equal(def.ok, true);
    if (def.ok) {
      assert.equal(def.project.wildRun?.active, false, "browser/default hydrate still force-stops");
    }
    const keep = importProject(json, { preserveWildRun: true });
    assert.equal(keep.ok, true);
    if (keep.ok) {
      assert.equal(keep.project.wildRun?.active, true);
      assert.equal(keep.project.wildRun?.startedAt, 1);
    }
  });

  // -------------------------------------------------------------------------
  // 312 D2 (B-01): the 306-F5 records must ride save→load VERBATIM — the 308
  // tracer found the hydrate rebuild ERASED `park` + `lastStep`, and the
  // session-break force-stop could leak a stale park onto a stopped surface.
  // The engine guards (usableWildPark / usableWildStepSummary) keep right-
  // shaped records by value, so a JSON round-trip preserves them field-for-field.
  // -------------------------------------------------------------------------
  const PARK_RT: WildParkInfo = {
    code: "RT_E_LLM_NOT_CONFIGURED",
    event: "wild.paused",
    reason: "Auto-Review classifier not configured.",
    unlock: "configure-key",
    unlockText:
      "Configure the LLM key (DEEPSEEK_API_KEY) so Auto-Review can verdict, then resume the run.",
    resumePhase: 4,
    resumeAction: "gate",
    at: 1_740_000_000_000,
  };
  const LAST_STEP_RT: WildStepSummary = {
    outcome: "paused",
    action: "park",
    phase: 4,
    completedPhase: null,
    advancedTo: null,
    artifacts: 0,
    nextPhase: 4,
    nextAction: "park",
    park: PARK_RT,
  };

  it("312 D2 (B-01): park + lastStep ride save→load verbatim; the session-break stop clears the park", () => {
    const parked: Project = {
      ...seedProject(),
      wildMode: true,
      wildRun: {
        active: true,
        phase: 4,
        startedAt: 17,
        lastAutoLog: "paused at P4",
        lastAutoAt: 18,
        stoppedAt: null,
        pause: true,
        park: PARK_RT,
        lastStep: LAST_STEP_RT,
      },
    };
    const json = exportProjectJson(parked);

    // preserveWildRun (the CLI pause/resume/step path): active stays true and
    // both 306-F5 records survive field-for-field.
    const keep = importProject(json, { preserveWildRun: true });
    assert.equal(keep.ok, true);
    if (!keep.ok) return;
    assert.equal(keep.project.wildRun?.active, true, "a preserved active run stays active");
    assert.equal(keep.project.wildRun?.pause, true);
    assert.deepEqual(
      keep.project.wildRun?.park,
      PARK_RT,
      "park must ride the round-trip verbatim (308 B-01: the rebuild used to erase it)",
    );
    assert.deepEqual(
      keep.project.wildRun?.lastStep,
      LAST_STEP_RT,
      "lastStep must ride the round-trip verbatim (308 B-01 key-erasure class)",
    );

    // Session break (browser/default hydrate): the driver died with the session —
    // the forced stop marks stopped AND clears the park ("present iff pause");
    // the old rebuild leaked the stale record onto the stopped surface.
    const def = importProject(json);
    assert.equal(def.ok, true);
    if (!def.ok) return;
    assert.equal(def.project.wildRun?.active, false, "session-break hydrate still force-stops");
    assert.equal(def.project.wildRun?.pause, false);
    assert.equal(def.project.wildRun?.park ?? null, null, "the forced stop clears the park");
    assert.equal(typeof def.project.wildRun?.stoppedAt, "number");
    assert.ok(
      (def.project.logs ?? []).some((l) => l.event === "wild.stop"),
      "the forced stop must say so (wild.stop log row — session-break honesty)",
    );
    assert.deepEqual(
      def.project.wildRun?.lastStep,
      LAST_STEP_RT,
      "lastStep is history — the stop keeps it; only the pause-bound park clears",
    );
  });
});

// ---------------------------------------------------------------------------
// T5.4 (W18 LANE 5) — artifact provenance at the serialization boundary.
// An emitted artifact record may carry `provenance = { producer, model?,
// timestamp, inputHash }`; a well-formed stamp rides through import untouched,
// a malformed/contradictory one is dropped LOUDLY (never repaired into shape,
// never fabricated), and a legacy row without a stamp stays unstamped. The
// emit-side population from real codegen data is pinned in
// codegen.server.test.ts; this block pins the boundary laws.
// ---------------------------------------------------------------------------

describe("artifact provenance (T5.4)", () => {
  const MODEL_STAMP = {
    producer: "model",
    model: "deepseek-v4-flash",
    timestamp: 1_740_000_000_000,
    inputHash: "1234567890",
  } as const;
  const DET_STAMP = { producer: "deterministic", timestamp: 1_740_000_000_001, inputHash: "987654321" } as const;

  /** A full-run project whose first N artifacts carry the given stamps.
   *  (The stamp field is not yet on the types.ts Artifact — io.ts owns the
   *  shape until a lane owning types.ts folds it on; tests widen structurally.) */
  const stamped = (stamps: unknown[]): Project => {
    const p = fullRun();
    assert.ok(p.artifacts.length >= stamps.length, "fixture precondition: enough artifacts to stamp");
    const artifacts = p.artifacts.map((a, i) => (i < stamps.length ? Object.assign({}, a, { provenance: stamps[i] }) : a));
    return { ...p, artifacts } as unknown as Project;
  };
  const provOf = (p: Project, i: number): unknown => {
    const row = p.artifacts[i] as unknown as { provenance?: unknown };
    return row.provenance;
  };
  const repairNote = (res: { ok: true; project: Project } | { ok: false; error: string }): string =>
    res.ok ? String(res.project.logs.find((l) => l.event === "import.repaired")?.detail ?? "") : "";

  it("a well-formed model stamp survives export → import untouched (no repair note)", () => {
    const p = stamped([MODEL_STAMP]);
    const exported = exportProjectJson(p);
    const res = importProject(exported);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.deepEqual(provOf(res.project, 0), MODEL_STAMP, "the stamp comes back byte-for-byte");
    assert.equal(repairNote(res), "", "preserving a valid stamp is not a repair");
    // The provenance guarantee is scoped to the artifact rows: hydrate (engine.ts)
    // legitimately re-stamps phase timing on load, so a whole-project byte
    // comparison would pin out-of-box behaviour, not the provenance boundary.
    assert.equal(
      JSON.stringify(res.project.artifacts),
      JSON.stringify(p.artifacts),
      "artifact rows (stamp included) round-trip byte-identically",
    );
  });

  it("a deterministic stamp round-trips and never gains a model key", () => {
    const res = importProject(exportProjectJson(stamped([DET_STAMP])));
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const stamp = provOf(res.project, 0) as Record<string, unknown>;
    assert.deepEqual(stamp, DET_STAMP);
    assert.equal("model" in stamp, false, "deterministic records are never model-stamped");
    assert.equal(repairNote(res), "");
  });

  it("unknown sibling keys on a well-formed stamp ride through (T0.2 additive tolerance)", () => {
    const withExtra = { ...MODEL_STAMP, tapeId: "tape-1" };
    const res = importProject(exportProjectJson(stamped([withExtra])));
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.deepEqual(provOf(res.project, 0), withExtra, "future provenance fields must not be stripped");
    assert.equal(repairNote(res), "", "preserving extras is not a repair");
  });

  it("legacy artifacts (no stamp) stay unstamped — provenance is never fabricated at import", () => {
    const p = fullRun();
    assert.ok(p.artifacts.length > 0, "fixture precondition: the run produced artifacts");
    assert.ok(
      p.artifacts.every((a) => !("provenance" in a)),
      "fixture precondition: engine artifacts carry no stamp yet (the T5.4 remainder)",
    );
    const res = importProject(exportProjectJson(p));
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.ok(
      res.project.artifacts.every((a) => !("provenance" in a)),
      "absence stays absence (types.ts:187 law — fail closed, never invent provenance for old rows)",
    );
    assert.equal(repairNote(res), "", "nothing to defend on a stamp-free payload");
  });

  it("malformed or contradictory stamps are dropped loudly, never repaired into shape", () => {
    const junk: unknown[] = [
      { producer: "model", timestamp: 1, inputHash: "x" }, // model claim with no served id
      { producer: "deterministic", model: "deepseek-pro", timestamp: 1, inputHash: "x" }, // contradiction
      { producer: "wizard", timestamp: 1, inputHash: "x" }, // outside the closed vocabulary
      "not-an-object",
      { producer: "deterministic", timestamp: 1 }, // no input hash
      { producer: "deterministic", timestamp: 0, inputHash: "x" }, // clock never advanced
      { producer: "replay", model: "   ", timestamp: 1, inputHash: "x" }, // blank served id
    ];
    const res = importProject(exportProjectJson(stamped(junk)));
    assert.equal(res.ok, true);
    if (!res.ok) return;
    for (let i = 0; i < junk.length; i++) {
      assert.equal(provOf(res.project, i), undefined, `junk stamp ${i} is dropped, not repaired`);
    }
    assert.match(repairNote(res), /artifacts:provenance:-7/, "the drops are loud (one trail row names the count)");
  });
});

describe("coerceArtifactProvenance (T5.4 vocabulary + laws)", () => {
  it("the producer vocabulary is the closed T5.4 set (replay reserved for the T5.7 cassette)", () => {
    assert.deepEqual([...ARTIFACT_PRODUCERS], ["deterministic", "model", "replay"]);
  });

  it("accepts well-formed model / replay / deterministic stamps", () => {
    assert.deepEqual(coerceArtifactProvenance({ producer: "model", model: "deepseek-v4-flash", timestamp: 5, inputHash: "h" }), {
      producer: "model",
      model: "deepseek-v4-flash",
      timestamp: 5,
      inputHash: "h",
    });
    assert.equal(coerceArtifactProvenance({ producer: "replay", model: "deepseek-pro", timestamp: 6, inputHash: "h" })?.producer, "replay");
    assert.deepEqual(coerceArtifactProvenance({ producer: "deterministic", timestamp: 7, inputHash: "h" }), {
      producer: "deterministic",
      timestamp: 7,
      inputHash: "h",
    });
  });

  it("fails closed on every malformed / contradictory shape", () => {
    const cases: [string, unknown][] = [
      ["non-object", "provenance"],
      ["null", null],
      ["array", []],
      ["unknown producer", { producer: "engine", timestamp: 1, inputHash: "h" }],
      ["missing producer", { timestamp: 1, inputHash: "h" }],
      ["model without a served id", { producer: "model", timestamp: 1, inputHash: "h" }],
      ["blank served id", { producer: "model", model: "  ", timestamp: 1, inputHash: "h" }],
      ["replay without a served id", { producer: "replay", timestamp: 1, inputHash: "h" }],
      ["deterministic + model id", { producer: "deterministic", model: "deepseek-flash", timestamp: 1, inputHash: "h" }],
      ["non-numeric timestamp", { producer: "deterministic", timestamp: "1", inputHash: "h" }],
      ["NaN timestamp", { producer: "deterministic", timestamp: Number.NaN, inputHash: "h" }],
      ["non-positive timestamp", { producer: "deterministic", timestamp: 0, inputHash: "h" }],
      ["empty input hash", { producer: "deterministic", timestamp: 1, inputHash: "" }],
      ["non-string input hash", { producer: "deterministic", timestamp: 1, inputHash: 7 }],
    ];
    for (const [label, bad] of cases) {
      assert.equal(coerceArtifactProvenance(bad), null, `must fail closed: ${label}`);
    }
  });

  it("returns the canonical stamp for a validated value (typed surface for consumers)", () => {
    const stamp: ArtifactProvenance | null = coerceArtifactProvenance({ producer: "model", model: "m", timestamp: 2, inputHash: "h" });
    assert.deepEqual(stamp, { producer: "model", model: "m", timestamp: 2, inputHash: "h" });
  });
});

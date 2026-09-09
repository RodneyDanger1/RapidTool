// ---------------------------------------------------------------------------
// knowledge.test.ts — JSON-backed pattern store suite (Pillar 11).
// Run: node --experimental-strip-types --test src/lib/knowledge.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  KnowledgeStore,
  type KnowledgeEntry,
  type NewKnowledgeEntry,
  LESSON_TAG,
  LESSON_TEXT_MAX,
  lessonRow,
  selectLessons,
  shouldPromoteLesson,
  lessonEvidenceDetail,
  absentLexNouns,
  vagueBriefLesson,
  templateEmissionLesson,
  verifyFailureLesson,
  verifiedProcedureLesson,
  correctionLesson,
  driftLesson,
  pressureAt,
  manualLesson,
  dismissLessonRows,
  proposeLessonFallback,
  buildSupersedeEntry,
  consolidatedRunNote,
} from "./knowledge.ts";
import { seedProject } from "./testing/fixtures.ts";
import type { HitlDecision, IntentLattice, PhaseId } from "./types.ts";

function tempStorePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "rt-knowledge-"));
  return join(dir, "store.json");
}

function cleanup(file: string): void {
  rmSync(dirname(file), { recursive: true, force: true });
}

const BASE: NewKnowledgeEntry = {
  project: "alpha",
  kind: "pattern",
  title: "Debounce watcher events",
  tags: ["fs.watch", "debounce", "node"],
  body: "Coalesce rapid fs events into one batched callback per quiet window; cap the pending set.",
  sourcePath: "src/lib/watcher.ts",
};

describe("KnowledgeStore — persistence", () => {
  it("round-trips entries through the JSON file and writes the versioned shape", () => {
    const file = tempStorePath();
    const store = new KnowledgeStore(file);
    const res = store.savePattern(BASE);
    assert.equal(res.appended, true);
    assert.match(res.entry.id, /^K[0-9a-f]{8}$/);
    assert.ok(!Number.isNaN(Date.parse(res.entry.savedAt)), "savedAt is an ISO timestamp");

    const raw = JSON.parse(readFileSync(file, "utf8")) as { version: number; entries: KnowledgeEntry[] };
    assert.equal(raw.version, 1);
    assert.equal(raw.entries.length, 1);

    // A fresh store over the same file sees the same entry (persistence).
    const reloaded = new KnowledgeStore(file);
    assert.equal(reloaded.count(), 1);
    assert.deepEqual(reloaded.entries(), [res.entry]);

    // No stray temp file is left behind by the atomic write.
    assert.ok(!existsSync(`${file}.tmp`));
    cleanup(file);
  });

  it("is append-only and idempotent: duplicate saves append nothing", () => {
    const file = tempStorePath();
    const store = new KnowledgeStore(file);
    store.savePattern({ ...BASE, title: "First pattern" });
    const dup = store.savePattern({ ...BASE, title: "First pattern" });
    assert.equal(dup.appended, false);
    assert.equal(dup.entry.id, store.entries()[0].id);
    assert.equal(store.count(), 1);

    store.savePattern({ ...BASE, title: "Second pattern", tags: ["zod", "react"] });
    assert.equal(store.count(), 2);

    // Append-only: first entry is byte-identical after later saves.
    const reloaded = new KnowledgeStore(file);
    assert.equal(reloaded.count(), 2);
    assert.deepEqual(reloaded.entries()[0], dup.entry);
    assert.equal(reloaded.entries()[1].title, "Second pattern");
    cleanup(file);
  });

  it("save→find round-trips (exact + fuzzy) without ever returning an empty read-back", () => {
    const file = tempStorePath();
    const store = new KnowledgeStore(file);
    store.savePattern({
      project: "alpha",
      kind: "pattern",
      title: "Debounce watcher events",
      tags: ["fs.watch", "debounce"],
      body: "Coalesce rapid fs events into one batched callback per quiet window.",
    });
    // Read-back is non-empty: the write-only-store bug (98_make_1) is that
    // entries() returned [] for a freshly saved file.
    assert.equal(store.entries().length, 1, "saved row must survive read-back");
    assert.equal(new KnowledgeStore(file).entries().length, 1, "fresh instance read-back");

    // Exact token match (title) -> top hit, score 1.
    const exact = store.findPatterns("debounce watcher", 5);
    assert.equal(exact.length, 1);
    assert.equal(exact[0].entry.title, "Debounce watcher events");
    assert.equal(exact[0].score, 1);

    // Fuzzy: query tokens that only occur in the body/tags still surface the row.
    const bodyOnly = store.findPatterns("coalesce batched callback", 5);
    assert.equal(bodyOnly.length, 1, "body-only tokens must match");
    assert.equal(bodyOnly[0].entry.id, exact[0].entry.id);
    const tagOnly = store.findPatterns("fs.watch", 5);
    assert.equal(tagOnly.length, 1, "tag-only tokens must match");
    assert.equal(tagOnly[0].entry.id, exact[0].entry.id);
    cleanup(file);
  });

  it("savePattern fails closed on malformed rows instead of writing write-only junk", () => {
    const file = tempStorePath();
    const store = new KnowledgeStore(file);
    const cases: [string, NewKnowledgeEntry][] = [
      ["missing body", { project: "p", kind: "pattern", title: "X", tags: ["a"] } as NewKnowledgeEntry],
      ["body undefined", { ...BASE, body: undefined } as unknown as NewKnowledgeEntry],
      ["non-string body", { ...BASE, body: 123 as unknown as string }],
      ["out-of-enum kind", { ...BASE, kind: "semantic" as unknown as NewKnowledgeEntry["kind"] }],
      ["missing kind", { ...BASE, kind: undefined as unknown as NewKnowledgeEntry["kind"] }],
      ["missing tags", { ...BASE, tags: undefined as unknown as string[] }],
    ];
    for (const [label, input] of cases) {
      assert.throws(
        () => store.savePattern(input),
        /refusing to save a malformed entry/,
        `case "${label}" must throw`,
      );
    }
    // Nothing was persisted by the rejected saves — the store is still empty.
    assert.equal(store.entries().length, 0);
    assert.equal(new KnowledgeStore(file).entries().length, 0);
    // And a valid row still saves cleanly afterwards.
    const ok = store.savePattern(BASE);
    assert.equal(ok.appended, true);
    assert.equal(store.entries().length, 1);
    cleanup(file);
  });

  it("refuses a corrupt store file instead of overwriting append-only data", () => {
    const file = tempStorePath();
    writeFileSync(file, "{ this is not valid json", "utf8");
    const store = new KnowledgeStore(file);
    assert.throws(() => store.entries(), /Refusing to overwrite append-only data/);
    cleanup(file);
  });
});

describe("KnowledgeStore — ranking + injection", () => {
  function seeded(): { store: KnowledgeStore; file: string } {
    const file = tempStorePath();
    const store = new KnowledgeStore(file);
    store.savePattern(BASE); // debounce / watcher / fs events
    store.savePattern({
      project: "beta",
      kind: "fix",
      title: "React form validation",
      tags: ["react", "zod"],
      body: "Schema-first forms: zod resolver on every submit path.",
    });
    return { store, file };
  }

  it("findPatterns ranks by idf-weighted token overlap, deterministically", () => {
    const { store, file } = seeded();
    const top = store.findPatterns("fs.watch debounce coalesce events", 5);
    assert.ok(top.length >= 1);
    assert.equal(top[0].entry.title, "Debounce watcher events");
    assert.equal(top[0].score, 1);
    for (const m of top) {
      assert.ok(m.score > 0 && m.score <= 1);
    }

    // React/zod query surfaces the other entry.
    const react = store.findPatterns("react zod form", 5);
    assert.equal(react[0].entry.title, "React form validation");

    // No shared tokens -> nothing returned; limit respected; deterministic.
    assert.deepEqual(store.findPatterns("quantum orbital mechanics", 5), []);
    const a = store.findPatterns("watcher debounce", 1);
    const b = store.findPatterns("watcher debounce", 1);
    assert.deepEqual(a, b);
    assert.equal(a.length, 1);
    cleanup(file);
  });

  it("injectProven returns cross-project advisory rows only, never self-project", () => {
    const file = tempStorePath();
    const store = new KnowledgeStore(file);
    store.savePattern({
      project: "event-hub",
      kind: "pattern",
      title: "Debounce watcher events",
      tags: ["node"],
      body: "task runner pattern: debounce watcher events, cap pending batches, batch per quiet window.",
    });
    store.savePattern({
      project: "task-runner",
      kind: "note",
      title: "Own capture dirs",
      tags: [],
      body: "task runner note: keep agent output in one capture dir.",
    });

    const rows = store.injectProven("task-runner", { limit: 3, minScore: 0.12 });
    assert.ok(rows.length >= 1, "cross-project proven patterns should surface");
    assert.ok(rows.every((r) => r.source === "knowledge-store"));
    assert.ok(rows.every((r) => r.project !== "task-runner"), "self-project rows excluded");
    assert.equal(rows[0].project, "event-hub");
    assert.equal(rows[0].title, "Debounce watcher events");
    assert.ok(rows[0].score >= 0.12 && rows[0].score <= 1);
    assert.match(rows[0].advice, /^Reuse "Debounce watcher events" \(stored from project "event-hub"/);

    // Unknown project with no overlaps -> no rows.
    assert.deepEqual(store.injectProven("quantum-xyzzy"), []);
    cleanup(file);
  });
});

// ---------------------------------------------------------------------------
// Learning-loop regression tests (fixes/98 §4.2/§6.2) — the K-tier telemetry
// (counterEvidence / supersededBy / supersedes) and the M-tier lesson surface
// landed in this module. Every claim here pins the deterministic floor.
// ---------------------------------------------------------------------------

describe("KnowledgeStore — learning-loop telemetry (fixes/98 §4.2/§6.2)", () => {
  it("legacy fingerprint stability: supersedes:[] fingerprints identically to an absent supersedes", () => {
    const f1 = tempStorePath();
    const f2 = tempStorePath();
    const a = new KnowledgeStore(f1).savePattern(BASE);
    const b = new KnowledgeStore(f2).savePattern({ ...BASE, supersedes: [] });
    assert.equal(a.appended, true);
    assert.equal(b.appended, true);
    assert.equal(a.entry.id, b.entry.id, "empty supersedes must not fork the legacy fingerprint");
    cleanup(f1);
    cleanup(f2);
  });

  it("bumpCounterEvidence mutates telemetry only, persists, and returns null for unknown ids", () => {
    const file = tempStorePath();
    const store = new KnowledgeStore(file);
    const saved = store.savePattern(BASE).entry;
    const bumped = store.bumpCounterEvidence(saved.id);
    assert.ok(bumped);
    const { counterEvidence, ...rest } = bumped;
    assert.deepEqual(rest, saved, "content fields byte-identical after a bump");
    assert.equal(counterEvidence, 1);
    assert.equal(store.bumpCounterEvidence(saved.id)?.counterEvidence, 2);
    // Persisted: a fresh store over the same file sees the telemetry.
    assert.equal(new KnowledgeStore(file).entries()[0].counterEvidence, 2);
    assert.equal(store.bumpCounterEvidence("K00000000"), null, "unknown id -> null");
    cleanup(file);
  });

  it("counter-evidence decay halves the score per recurrence and retires at LESSON_RETIRE_COUNTER", () => {
    const file = tempStorePath();
    const store = new KnowledgeStore(file);
    const saved = store.savePattern(BASE).entry;
    // Single entry = the only match = raw score 1; decay multiplies it.
    assert.equal(store.findPatterns("debounce watcher")[0].score, 1);
    store.bumpCounterEvidence(saved.id);
    assert.equal(store.findPatterns("debounce watcher")[0].score, 0.5, "halve per recurrence");
    store.bumpCounterEvidence(saved.id);
    store.bumpCounterEvidence(saved.id);
    assert.deepEqual(store.findPatterns("debounce watcher"), [], "retired at 3 units by default");
    const raw = store.findPatterns("debounce watcher", 5, { includeRetired: true });
    assert.equal(raw.length, 1);
    assert.equal(raw[0].score, 0.125, "retired rows visible for audit reads, still decayed");
    cleanup(file);
  });

  it("markSuperseded appends the by-id once and never touches content fields", () => {
    const file = tempStorePath();
    const store = new KnowledgeStore(file);
    const old = store.savePattern(BASE).entry;
    assert.deepEqual(store.markSuperseded(old.id, "Kdeadbeef")?.supersededBy, ["Kdeadbeef"]);
    assert.deepEqual(
      store.markSuperseded(old.id, "Kdeadbeef")?.supersededBy,
      ["Kdeadbeef"],
      "deduped append",
    );
    store.markSuperseded(old.id, "Kcafebabe");
    assert.deepEqual(store.entries()[0].supersededBy, ["Kdeadbeef", "Kcafebabe"]);
    assert.equal(store.markSuperseded("K00000000", "Kdeadbeef"), null);
    const { supersededBy: _sb, ...rest } = store.entries()[0];
    assert.deepEqual(rest, old, "only the telemetry field changed");
    cleanup(file);
  });

  it("superseded rows are excluded from findPatterns + injectProven by default, visible via includeSuperseded", () => {
    const file = tempStorePath();
    const store = new KnowledgeStore(file);
    const fix = store.savePattern({ ...BASE, title: "Debounce fix v1" }).entry;
    const note = store.savePattern({
      project: "alpha",
      kind: "note",
      title: "Supersedes debounce fix",
      tags: ["lesson", "supersede"],
      body: "v1 remedy failed; see the new approach.",
      supersedes: [fix.id],
    });
    assert.equal(note.appended, true);
    const def = store.findPatterns("debounce watcher fix");
    assert.ok(!def.some((m) => m.entry.id === fix.id), "superseded row excluded by default");
    assert.ok(def.length >= 1, "the superseding row itself still matches");
    const raw = store.findPatterns("debounce watcher fix", 5, { includeSuperseded: true });
    assert.ok(raw.some((m) => m.entry.id === fix.id), "audit read can still see it");
    const proven = store.injectProven("debounce");
    assert.ok(
      !proven.some((r) => r.entryId === fix.id),
      "injectProven never serves superseded rows",
    );
    cleanup(file);
  });
});

describe("M-tier lesson surface (fixes/98 §2/§3)", () => {
  it("lessonRow content-addresses: same spec twice -> same id; different text forks (H43-P2-1)", () => {
    const spec = {
      classShort: "vague-brief",
      level: "L1",
      kind: "semantic",
      phase: 0,
      text: "brief had 0 LEX hits",
      score: 0.7,
      source: "engine",
    } as const;
    const a = lessonRow(spec);
    const b = lessonRow(spec);
    assert.equal(a.id, b.id, "re-synthesis must never fork ids");
    assert.match(a.id, /^lesson-vague-brief-[0-9a-f]{8}$/);
    assert.notEqual(a.id, lessonRow({ ...spec, text: "different text" }).id);
  });

  it("lessonRow normalizes tags (sorted, deduped, always [lesson, class, level]) and caps text", () => {
    const row = lessonRow({
      classShort: "drift",
      level: "L2",
      kind: "episodic",
      phase: 3,
      text: `  ${"x".repeat(500)}  `,
      score: 0.6,
      source: "engine",
      tags: ["L2", "extra", "extra"],
    });
    assert.equal(row.text.length, LESSON_TEXT_MAX, "H43-P2-2: text capped at 240");
    assert.deepEqual(row.tags, ["L2", "drift", "extra", LESSON_TAG]);
    const junk = lessonRow({
      classShort: "drift",
      level: "L2",
      kind: "episodic",
      phase: 3,
      text: "",
      score: Number.NaN,
      source: "engine",
    });
    assert.equal(junk.score, 0.5, "junk score floors to 0.5");
    assert.equal(junk.text, "");
  });

  describe("lessonEvidenceDetail (fixes/144 M5-1 shared digest — engine-half byte parity)", () => {
    it("formats the canonical single-line digest: unmet list + class + collapsed 300-char tail", () => {
      assert.equal(
        lessonEvidenceDetail(
          ["P6 gate unmet: module exports addColumn", "second criterion"],
          "RT_E_VALIDATION",
          "First line of the failure\n   second   line   padded   ",
        ),
        "unmet: P6 gate unmet: module exports addColumn, second criterion · class: RT_E_VALIDATION · tail: First line of the failure second line padded",
      );
    });

    it("tail cap 300: longer tails collapse whitespace then slice to the first 300 chars", () => {
      const longTail = `t${"x".repeat(400)}`;
      const out = lessonEvidenceDetail(["c1"], "RT_E_LLM_REJECTED", longTail);
      const tail = out.slice(out.indexOf("tail: ") + "tail: ".length);
      assert.equal(tail.length, 300);
      assert.ok(out.startsWith("unmet: c1 · class: RT_E_LLM_REJECTED · tail: t"));
    });

    it("zero-class: the class clause is omitted when no refusal class is given", () => {
      assert.equal(lessonEvidenceDetail(["c1"], undefined, "some tail"), "unmet: c1 · tail: some tail");
      assert.equal(lessonEvidenceDetail(["c1"], null, null), "unmet: c1", "null class/tail omitted too");
    });

    it("zero-tail: the tail clause is omitted when no tail is given", () => {
      assert.equal(lessonEvidenceDetail(["c1", "c2"], "RT_E_VALIDATION"), "unmet: c1, c2 · class: RT_E_VALIDATION");
    });

    it("deterministic: identical inputs → identical bytes; junk input never throws", () => {
      const args = ["c1", "c2"] as const;
      assert.equal(lessonEvidenceDetail(args, "RT_E_VALIDATION", "tail"), lessonEvidenceDetail(args, "RT_E_VALIDATION", "tail"));
      assert.equal(
        lessonEvidenceDetail(["  ", 42 as never, "c1"], "  RT_E_X  ", "  "),
        lessonEvidenceDetail(["c1"], "RT_E_X", undefined),
        "whitespace-only criteria/class/tail are filtered out identically",
      );
    });
  });

  it("selectLessons: phase-match first, phase-agnostic fallback, class filter, tiebreaks", () => {
    const mk = (id: string, phase: number, score: number, tags: string[]) => ({
      id,
      kind: "semantic" as const,
      phase: phase as PhaseId,
      text: `t ${id}`,
      score,
      tags,
    });
    const rows = [
      mk("a", 0, 0.5, [LESSON_TAG, "vague-brief"]),
      mk("b", 3, 0.9, [LESSON_TAG, "verify-failure"]),
      mk("c", 3, 0.7, [LESSON_TAG, "vague-brief"]),
      mk("d", 9, 0.8, [LESSON_TAG, "vague-brief"]),
      mk("e", 9, 0.8, [LESSON_TAG, "vague-brief"]),
      mk("f", 3, 0.6, ["other"]), // not a lesson row
    ];
    assert.deepEqual(selectLessons(rows, 3, 2).map((m) => m.id), ["b", "c"]);
    assert.deepEqual(selectLessons(rows, 3, 2, ["vague-brief"]).map((m) => m.id), ["c"]);
    assert.deepEqual(
      selectLessons(rows, 5, 2, ["vague-brief"]).map((m) => m.id),
      ["d", "e"],
      "phase-agnostic fallback when no phase-5 row exists",
    );
    // Tiebreak: equal scores -> id asc (findPatterns convention).
    assert.deepEqual(selectLessons(rows, 9, 2, ["vague-brief"]).map((m) => m.id), ["d", "e"]);
    assert.deepEqual(selectLessons([], 0), []);
    assert.deepEqual(selectLessons(rows, 3, 0), []);
  });

  it("C: shouldPromoteLesson refuses unknown/regression, allows first or non-worse card", () => {
    assert.equal(shouldPromoteLesson(undefined, undefined), false);
    assert.equal(shouldPromoteLesson(0.5, undefined), false);
    assert.equal(shouldPromoteLesson(undefined, 0.4), true);
    assert.equal(shouldPromoteLesson(0.4, 0.4), true);
    assert.equal(shouldPromoteLesson(0.4, 0.5), true);
    assert.equal(shouldPromoteLesson(0.5, 0.4), false);
  });

  it("class builders L1-L5 + drift emit the 98 §2.3 shapes with bounded texts", () => {
    const p = seedProject();
    const l1 = vagueBriefLesson(p, ["kanban", "statkit"]);
    assert.equal(l1.kind, "semantic");
    assert.equal(l1.source, "engine");
    assert.ok((l1.tags ?? []).includes("vague-brief") && (l1.tags ?? []).includes("L1"));
    assert.match(l1.text, /^L1 vague-brief:/);
    assert.ok(l1.text.length <= LESSON_TEXT_MAX);

    const l2e = templateEmissionLesson(p, 3, ["p3-mcp"]);
    assert.equal(l2e.source, "engine");
    assert.match(l2e.text, /evidenceHash=[0-9a-f]{8}/);
    const l2r = templateEmissionLesson(p, 3, ["p3-mcp"], [], undefined, "agent-report");
    assert.equal(l2r.source, "agent-report", "M-08 E-18 stamp mirror");
    assert.equal(l2e.id, l2r.id, "source is provenance, not content — same id");

    const l3 = verifyFailureLesson(p, 6, "cases failed: x y z", 2, "the fixture was wrong");
    assert.equal(l3.kind, "episodic");
    assert.match(l3.text, /\| hypothesis: the fixture was wrong/);
    assert.ok(l3.text.length <= LESSON_TEXT_MAX, "hypothesis + evidence fit the 240-char budget");

    const l4 = verifiedProcedureLesson(p, 6, "6/6 machine-run cases passed");
    assert.equal(l4.kind, "procedural");
    assert.equal(l4.score, 0.8);

    const decision: HitlDecision = {
      id: "d1",
      phase: 4,
      title: "Approve security",
      decision: "reject",
      decidedBy: "human",
      note: "Sandbox caps rejected by operator",
      requestedAt: 1,
      decidedAt: 2,
    };
    const l5 = correctionLesson(p, decision);
    assert.equal(l5.source, "human");
    assert.ok((l5.tags ?? []).includes("user-correction"));
    const l5null = correctionLesson(p, { ...decision, decision: "approve", note: "" });
    assert.ok((l5null.tags ?? []).includes("null-note"), "null-note anti-pattern flagged (98 §7)");

    const drift = driftLesson(p, 9, 3, "aaaa1111", "bbbb2222", ["p3-mcp"]);
    assert.equal(drift.score, 0.6);
    assert.ok((drift.tags ?? []).includes("drift"));
    assert.match(drift.text, /L2-style drift/);
  });

  it("absentLexNouns is deterministic and lattice-derived", () => {
    const lattice: IntentLattice = {
      domain: "demo",
      jobs: ["deliver core workflow"],
      entities: ["operator"],
      constraints: [],
      nodes: [{ kind: "actor", label: "operator", weight: 1 }],
      complexity: 1,
    };
    const brief = "kanban board for operators";
    const a = absentLexNouns(brief, lattice);
    const b = absentLexNouns(brief, lattice);
    assert.deepEqual(a, b, "deterministic");
    // "operators" stems to "operator" (B-15 stemmer), which the lattice's
    // entities/nodes DO cover — so only truly absent nouns remain.
    assert.deepEqual(a, ["kanban", "board"], "only brief tokens missing from lattice vocab");
    assert.deepEqual(
      absentLexNouns(brief, null),
      ["kanban", "board", "operator"],
      "null lattice -> all brief tokens (stemmed)",
    );
  });

  it("manualLesson, dismissLessonRows, pressureAt floors", () => {
    const row = manualLesson({
      classShort: "drift",
      level: "L2",
      kind: "episodic",
      phase: 2,
      text: "manual",
      score: 0.6,
      tags: ["gate:p2-memory"],
    });
    assert.equal(row.source, "human");
    const mem = [row, { ...row, id: "other" }];
    assert.deepEqual(dismissLessonRows(mem, row.id).map((m) => m.id), ["other"]);
    assert.equal(dismissLessonRows(mem, "nope").length, 2);
    assert.equal(pressureAt([], 60), false);
    assert.equal(pressureAt(new Array(60).fill(row)), true);
    assert.equal(pressureAt(new Array(60).fill(row), 61), false);
  });

  it("proposeLessonFallback + buildSupersedeEntry + consolidatedRunNote deterministic floors", () => {
    const prop = proposeLessonFallback({
      project: "alpha",
      kind: "fix",
      title: "  Cap the  watcher batches ",
      tags: [LESSON_TAG, LESSON_TAG],
      body: "raw evidence text",
    });
    assert.equal(prop.title, "Cap the watcher batches");
    assert.deepEqual(prop.tags, [LESSON_TAG]);
    const s = buildSupersedeEntry({ oldId: "K12345678", reason: "remedy refuted", project: "alpha" });
    assert.deepEqual(s.supersedes, ["K12345678"]);
    assert.equal(s.kind, "note");
    assert.equal(s.sourcePath, "supersedes:K12345678");

    const p = seedProject();
    const rowA = manualLesson({ classShort: "verify-failure", level: "L3", kind: "episodic", phase: 6, text: "a", score: 0.7 });
    const rowB = manualLesson({ classShort: "verify-failure", level: "L3", kind: "episodic", phase: 6, text: "b", score: 0.7 });
    assert.equal(consolidatedRunNote(p, 6, "verify-failure", [rowA, rowB]), null, "<3 rows -> no consolidation");
    const rowC = manualLesson({ classShort: "verify-failure", level: "L3", kind: "episodic", phase: 6, text: "c", score: 0.7 });
    const note = consolidatedRunNote(p, 6, "verify-failure", [rowA, rowB, rowC]);
    assert.ok(note);
    assert.equal(note?.kind, "note");
    assert.equal(note?.title, "Run lessons P6 verify-failure");
    assert.ok(note?.body.includes("a") && note?.body.includes("b") && note?.body.includes("c"));
  });
});

// ---------------------------------------------------------------------------
// harvest.test.ts — Pillar 1 harvester suite (deterministic, NO network).
//
// Every network-touching path is exercised through the HarvestOptions seams
// (search / fetchText / fetchJson / llm) with fakes, so this suite is fully
// hermetic: no DNS, no keys, no external calls. The suite pins the honesty
// contract — not-configured keyword floor, fetch/time bounds, honest empty
// results, no fabrication — plus smoke tests for the new headless bridges
// (harvest/swarmPlan/promptExpand/benchProject/mineDir/knowledgeSave/
// knowledgeFind/wildStartHeadless) that the CLI subcommands call.
//
// Run: node --experimental-strip-types --test src/lib/harvest.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildHarvestQueries,
  extractPatterns,
  EXTRACT_PATTERN_DISCLAIMER,
  harvestEvidenceLesson,
  harvestForPacket,
  harvestRepos,
  harvestResultLesson,
  HARVEST_MAX_CANDIDATES,
  TREND_NOTE_DISCLAIMER,
  trendNotes,
} from "./harvest.ts";
import type { HarvestLessonReason, HarvestLlmResult, HarvestOptions } from "./harvest.ts";
import {
  benchProject,
  harvest,
  knowledgeFind,
  knowledgeSave,
  mineDir,
  promptExpand,
  swarmPlan,
  wildStartHeadless,
} from "./headless.ts";
import { FIXTURE_BRIEF, seedProject } from "./testing/fixtures.ts";
import type { Project } from "./types.ts";

// ---------------------------------------------------------------------------
// Fakes.
// ---------------------------------------------------------------------------

const tmp = (): string => mkdtempSync(join(tmpdir(), "rapidtool-harvest-"));

type FakeItem = { title: string; url: string; content: string };

type SearchOk = { ok: true; query: string; items: FakeItem[]; provider: "duckduckgo" };
type SearchFail = { ok: false; reason: "error"; code: "RT_E_INTERNAL"; error: string };

const searchWith =
  (items: FakeItem[] | "fail") =>
  async (q: string): Promise<SearchOk | SearchFail> => {
    if (items === "fail") return { ok: false, reason: "error", code: "RT_E_INTERNAL", error: "backend down" };
    return { ok: true, query: q, items, provider: "duckduckgo" };
  };

const OK_README = "# Acme Lib\n\nA real-time scheduler for HVAC dispatch.\n".repeat(20); // > 300 chars

const llmOk = (queries: string[]) => async (): Promise<HarvestLlmResult> => ({
  ok: true,
  text: JSON.stringify({ queries }),
});
const llmFail = (error: string) => async (): Promise<HarvestLlmResult> => ({ ok: false, error });
const llmThrow = () => async () => {
  throw new Error("network exploded");
};

const KEYWORD_OPTS: HarvestOptions = { llmConfigured: false };

// ---------------------------------------------------------------------------
// buildHarvestQueries.
// ---------------------------------------------------------------------------

describe("buildHarvestQueries", () => {
  const brief = "Real-time field service dispatch scheduling for HVAC technicians";

  it("not-configured → deterministic keyword floor with source 'keyword'", async () => {
    const plan = await buildHarvestQueries(brief, KEYWORD_OPTS);
    assert.equal(plan.source, "keyword");
    assert.ok(plan.queries.length >= 1, "keyword floor should produce queries");
    for (const q of plan.queries) assert.match(q, /github/, "queries should target GitHub");
    assert.equal(plan.note, undefined);
  });

  it("deterministic: same brief → byte-identical queries across calls", async () => {
    const a = await buildHarvestQueries(brief, KEYWORD_OPTS);
    const b = await buildHarvestQueries(brief, KEYWORD_OPTS);
    assert.deepEqual(a, b);
  });

  it("empty brief → no queries, source keyword, honest note", async () => {
    const plan = await buildHarvestQueries("   ", KEYWORD_OPTS);
    assert.equal(plan.source, "keyword");
    assert.deepEqual(plan.queries, []);
    assert.ok(plan.note && plan.note.includes("empty brief"));
  });

  it("llm path success → source 'llm' and deduped, capped queries", async () => {
    const plan = await buildHarvestQueries(brief, {
      llmConfigured: true,
      llm: llmOk(["a b c", "a b c", "d e f"]),
    });
    assert.equal(plan.source, "llm");
    assert.deepEqual(plan.queries, ["a b c", "d e f"]);
  });

  it("llm failure → keyword floor with honest degradation note", async () => {
    const plan = await buildHarvestQueries(brief, { llmConfigured: true, llm: llmFail("HTTP 429") });
    assert.equal(plan.source, "keyword");
    assert.ok(plan.queries.length >= 1);
    assert.ok(plan.note && plan.note.includes("HTTP 429"), `note should carry the LLM error, got: ${plan.note}`);
  });

  it("llm unparseable payload → keyword floor + note", async () => {
    const plan = await buildHarvestQueries(brief, {
      llmConfigured: true,
      llm: async () => ({ ok: true, text: "not json at all" }),
    });
    assert.equal(plan.source, "keyword");
    assert.ok(plan.note && plan.note.includes("no usable queries"));
  });

  it("llm throws → keyword floor + note (never a thrown failure)", async () => {
    const plan = await buildHarvestQueries(brief, { llmConfigured: true, llm: llmThrow() });
    assert.equal(plan.source, "keyword");
    assert.ok(plan.note && plan.note.includes("threw"));
  });

  it("185-H1: dual-channel ok:true + error fail-closes onto the keyword floor (never uses the LLM queries)", async () => {
    const plan = await buildHarvestQueries(brief, {
      llmConfigured: true,
      // Hostile dual-channel payload (185-H1 class). Cast: the public seam is
      // discriminated; runtime must still fail-close if a caller lies.
      llm: (async () => ({
        ok: true,
        text: JSON.stringify({ queries: ["poisoned-llm-query github"] }),
        error: "already complete",
      })) as HarvestOptions["llm"],
    });
    assert.equal(plan.source, "keyword");
    assert.ok(!plan.queries.includes("poisoned-llm-query github"), "dual-channel must not mint LLM queries");
    assert.ok(plan.note && plan.note.includes("already complete"), `note should carry the dual-channel error, got: ${plan.note}`);
  });

  it("185-H1: whitespace-only error on ok:true is not dual-channel (LLM queries used)", async () => {
    const plan = await buildHarvestQueries(brief, {
      llmConfigured: true,
      llm: (async () => ({
        ok: true,
        text: JSON.stringify({ queries: ["kept-llm-query github"] }),
        error: "   ",
      })) as HarvestOptions["llm"],
    });
    assert.equal(plan.source, "llm");
    assert.deepEqual(plan.queries, ["kept-llm-query github"]);
  });

  it("llm ok:false without error prose → keyword floor + unknown", async () => {
    const plan = await buildHarvestQueries(brief, {
      llmConfigured: true,
      llm: async () => ({ ok: false }),
    });
    assert.equal(plan.source, "keyword");
    assert.ok(plan.note && plan.note.includes("unknown"), `note should carry unknown, got: ${plan.note}`);
  });
});

// ---------------------------------------------------------------------------
// harvestRepos — bounds + no-fabrication.
// ---------------------------------------------------------------------------

describe("harvestRepos", () => {
  it("no queries → hits [] + note", async () => {
    const res = await harvestRepos([], KEYWORD_OPTS);
    assert.deepEqual(res.hits, []);
    assert.ok(res.notes.some((n) => n.includes("no queries")));
  });

  it("search unavailable → honest empty hit list (nothing fabricated)", async () => {
    const res = await harvestRepos(["x"], {
      search: searchWith("fail") as unknown as HarvestOptions["search"],
    });
    assert.deepEqual(res.hits, []);
    assert.ok(res.notes.some((n) => n.includes("honest empty")));
  });

  it("happy path: README fetch + license spot-check, ≤4 fetches, provenance github-raw", async () => {
    let fetchTextCalls = 0;
    let fetchJsonCalls = 0;
    const res = await harvestRepos(["field service scheduler"], {
      search: searchWith([{ title: "Acme", url: "https://github.com/acme/scheduler", content: "search summary text" }]),
      fetchText: async () => {
        fetchTextCalls += 1;
        return OK_README;
      },
      fetchJson: async () => {
        fetchJsonCalls += 1;
        return { license: { spdx_id: "MIT", name: "MIT License" } };
      },
    });
    assert.equal(res.hits.length, 1);
    const hit = res.hits[0];
    assert.equal(hit.repo, "acme/scheduler");
    assert.equal(hit.license, "MIT");
    assert.equal(hit.provenance, "github-raw");
    assert.match(hit.snippet, /^# Acme Lib/);
    assert.ok(fetchTextCalls + fetchJsonCalls <= 4, `total fetches ${fetchTextCalls + fetchJsonCalls} exceeded the 4-fetch bound`);
  });

  it("raw README fetch fails → search-snippet fallback, provenance web-search, no license claim", async () => {
    const res = await harvestRepos(["q"], {
      search: searchWith([{ title: "Acme", url: "https://github.com/acme/scheduler", content: "search summary text" }]),
      fetchText: async () => {
        throw new Error("HTTP 404");
      },
      fetchJson: async () => ({ license: null }),
    });
    assert.equal(res.hits.length, 1);
    assert.equal(res.hits[0].provenance, "web-search");
    assert.match(res.hits[0].snippet, /search summary text/);
    assert.equal(res.hits[0].license, undefined);
    assert.ok(res.notes.some((n) => n.includes("raw README fetch failed")));
  });

  it("license spot-check unreachable → license ABSENT + honest note (never invented)", async () => {
    const res = await harvestRepos(["q"], {
      search: searchWith([{ title: "Acme", url: "https://github.com/acme/scheduler", content: "s" }]),
      fetchText: async () => "readme",
      fetchJson: async () => {
        throw new Error("HTTP 403 rate limited");
      },
    });
    assert.equal(res.hits.length, 1);
    assert.equal(res.hits[0].license, undefined);
    assert.ok(res.notes.some((n) => n.includes("license spot-check failed")));
  });

  it("fetch budget bound: maxFetches 2 with 3 candidates → exactly 2 attempts + budget note", async () => {
    let attempts = 0;
    const urls = [
      "https://github.com/a/one",
      "https://github.com/b/two",
      "https://github.com/c/three",
    ];
    const res = await harvestRepos(["q"], {
      maxFetches: 2,
      search: searchWith(urls.map((url) => ({ title: url, url, content: "summary" }))),
      fetchText: async () => {
        attempts += 1;
        return "readme body";
      },
      fetchJson: async () => {
        attempts += 1;
        return { license: null };
      },
    });
    assert.equal(attempts, 2, `fetch attempts should equal the 2-fetch budget, got ${attempts}`);
    assert.ok(res.notes.some((n) => n.includes("budget")), `notes should mention the budget: ${JSON.stringify(res.notes)}`);
    assert.ok(res.hits.length <= 1, "no more than one repo can complete within a 2-fetch budget");
  });

  it("time budget bound: exhausted deadline → no fetches, honest empty", async () => {
    let attempts = 0;
    const slowSearch: HarvestOptions["search"] = async (q) => {
      await new Promise((r) => setTimeout(r, 15)); // burn past the 1 ms budget deterministically
      return {
        ok: true,
        query: q,
        items: [{ title: "Acme", url: "https://github.com/acme/scheduler", content: "s" }],
        provider: "duckduckgo",
      };
    };
    const res = await harvestRepos(["q"], {
      timeoutMs: 1,
      search: slowSearch,
      fetchText: async () => {
        attempts += 1;
        return "readme";
      },
      fetchJson: async () => {
        attempts += 1;
        return { license: null };
      },
    });
    assert.equal(attempts, 0, "no fetches may run after the deadline");
    assert.deepEqual(res.hits, []);
    assert.ok(res.notes.some((n) => n.includes("time budget") || n.includes("time budget exhausted")), JSON.stringify(res.notes));
  });

  it("URL hygiene: non-GitHub and GitHub-chrome URLs are ignored; repo URLs are kept", async () => {
    const res = await harvestRepos(["q"], {
      maxFetches: 2,
      search: searchWith([
        { title: "NotGitHub", url: "https://example.com/x", content: "nope" },
        { title: "Chrome", url: "https://github.com/topics/ai", content: "chrome" },
        { title: "Real", url: "https://github.com/acme/real-repo", content: "yes" },
      ]),
      fetchText: async () => "readme",
      fetchJson: async () => ({ license: null }),
    });
    assert.equal(res.hits.length, 1);
    assert.equal(res.hits[0].repo, "acme/real-repo");
  });

  // 109 T-09 / W5-L2 (a): cap-enforcement teeth for the loop-top break
  // (`harvest.ts:417`) — the per-result break at `:441` only caps the list
  // WITHIN one query page, so without the loop-top check a further query still
  // burned a search call with a full candidate list in hand. 4 queries × 4
  // distinct repos: query 1 fills 4, query 2 tops up to HARVEST_MAX_CANDIDATES
  // (6) mid-page, queries 3–4 must NOT be searched at all.
  it("candidate cap: stops searching once HARVEST_MAX_CANDIDATES is reached (loop-top break)", async () => {
    let searchCalls = 0;
    const search: HarvestOptions["search"] = async (q) => {
      searchCalls += 1;
      const qi = q.replace(/\D/g, "");
      return {
        ok: true,
        query: q,
        items: [1, 2, 3, 4].map((i) => ({
          title: `cap ${qi}/${i}`,
          url: `https://github.com/capq${qi}/repo-${i}`,
          content: "candidate summary",
        })),
        provider: "duckduckgo",
      };
    };
    const res = await harvestRepos(["q1", "q2", "q3", "q4"], {
      maxFetches: 20, // generous: the cap under test is the CANDIDATE cap
      search,
      fetchText: async () => "readme body",
      fetchJson: async () => ({ license: null }),
    });
    assert.equal(
      searchCalls,
      2,
      `the cap must stop further searches: 4+2 candidates fill the cap in 2 queries, got ${searchCalls} search calls`,
    );
    assert.equal(res.hits.length, HARVEST_MAX_CANDIDATES, `hits must be the capped candidate list, got ${res.hits.length}`);
    assert.ok(
      !res.hits.some((h) => h.repo.includes("capq3") || h.repo.includes("capq4")),
      `repos surfaced only by post-cap queries must not appear: ${JSON.stringify(res.hits.map((h) => h.repo))}`,
    );
  });

  // W5-L2 (b): the zero-budget note branch — `fetches === 0` (no attempt was
  // made) must NEVER read as tried-and-failed (109 T-09 fix at `harvest.ts:511`).
  it("zero fetch budget: honest zero-attempt note, never a tried-and-failed claim", async () => {
    let attempts = 0;
    const res = await harvestRepos(["q"], {
      maxFetches: 0,
      search: searchWith([
        { title: "Acme", url: "https://github.com/acme/one", content: "summary one" },
        { title: "Beta", url: "https://github.com/beta/two", content: "summary two" },
      ]),
      fetchText: async () => {
        attempts += 1;
        return "readme";
      },
      fetchJson: async () => {
        attempts += 1;
        return { license: null };
      },
    });
    assert.equal(attempts, 0, "a zero fetch budget must make zero fetch attempts");
    assert.deepEqual(res.hits, []);
    assert.ok(
      res.notes.includes("fetch budget is 0 — no candidate fetched"),
      `zero-attempt note must state the real reason: ${JSON.stringify(res.notes)}`,
    );
    assert.ok(
      !res.notes.some((n) => n.includes("all candidate fetches failed")),
      `zero attempts must never be reported as tried-and-failed: ${JSON.stringify(res.notes)}`,
    );
  });

  // W5-L2 (b, second trigger): a deadline that expired before the first attempt
  // is the same `fetches === 0` state and takes the same honest note (`harvest.ts:418`
  // pushed the time note; the aggregate note must agree).
  it("deadline expired before the first fetch also takes the zero-attempt note", async () => {
    const res = await harvestRepos(["q"], {
      timeoutMs: 1,
      search: async (q) => {
        await new Promise((r) => setTimeout(r, 15)); // burn past the 1 ms budget deterministically
        return {
          ok: true,
          query: q,
          items: [{ title: "Acme", url: "https://github.com/acme/one", content: "s" }],
          provider: "duckduckgo",
        };
      },
      fetchText: async () => "readme",
      fetchJson: async () => ({ license: null }),
    });
    assert.deepEqual(res.hits, []);
    assert.ok(
      res.notes.includes("fetch budget is 0 — no candidate fetched"),
      `expired deadline with zero attempts must state the real reason: ${JSON.stringify(res.notes)}`,
    );
    assert.ok(
      !res.notes.some((n) => n.includes("all candidate fetches failed")),
      `zero attempts must never be reported as tried-and-failed: ${JSON.stringify(res.notes)}`,
    );
  });

  // W5-L2 (c): every fetch attempt fails while the budget is spent. Pinned honest
  // shape (probe 2026-09-16, real output): attempts 4 → hits 2, both `web-search`
  // (the candidates' own search snippets), one per-candidate failure note each —
  // nothing fabricated, no license claimed. NOTE (reachability, witnessed): the
  // aggregate "all candidate fetches failed" arm of the ternary at `harvest.ts:511`
  // is DORMANT in the current implementation — every iteration that increments
  // `fetches` unconditionally pushes a hit at `:498`, so `hits.length === 0`
  // implies `fetches === 0` (the zero-attempt note). The arm stays as defense:
  // if a future edit ever drops failed candidates, it names the truth. Reverting
  // the ternary to the old unconditional wording flips the two tests above RED.
  it("all fetch attempts fail with budget spent: honest web-search hits, per-candidate notes, aggregate claim stays dormant", async () => {
    let attempts = 0;
    const res = await harvestRepos(["q"], {
      maxFetches: 4,
      search: searchWith([
        { title: "Acme", url: "https://github.com/acme/one", content: "summary one" },
        { title: "Beta", url: "https://github.com/beta/two", content: "summary two" },
        { title: "Gamma", url: "https://github.com/gamma/three", content: "summary three" },
      ]),
      fetchText: async () => {
        attempts += 1;
        throw new Error("HTTP 404");
      },
      fetchJson: async () => {
        attempts += 1;
        throw new Error("HTTP 403 rate limited");
      },
    });
    assert.equal(attempts, 4, `the whole budget is spent on attempts, got ${attempts}`);
    assert.equal(res.hits.length, 2, `every attempted candidate still yields an honest hit, got ${res.hits.length}`);
    assert.ok(
      res.hits.every((h) => h.provenance === "web-search"),
      `failed fetches must fall back to the search snippet (web-search), never claim raw/api: ${JSON.stringify(res.hits.map((h) => h.provenance))}`,
    );
    assert.ok(
      res.hits.every((h) => h.license === undefined),
      `no license may be claimed without a successful spot-check: ${JSON.stringify(res.hits)}`,
    );
    assert.equal(
      res.notes.filter((n) => n.includes("raw README fetch failed")).length,
      2,
      `one honest failure note per attempted candidate: ${JSON.stringify(res.notes)}`,
    );
    assert.equal(
      res.notes.filter((n) => n.includes("license spot-check failed")).length,
      2,
      `one honest spot-check note per attempted candidate: ${JSON.stringify(res.notes)}`,
    );
    assert.ok(
      res.notes.some((n) => n.includes("fetch budget (4) reached")),
      `the spent budget must be stated: ${JSON.stringify(res.notes)}`,
    );
    assert.ok(
      !res.notes.some((n) => n.includes("all candidate fetches failed")),
      `the tried-and-failed aggregate must not fire while hits exist: ${JSON.stringify(res.notes)}`,
    );
  });
});

// ---------------------------------------------------------------------------
// extractPatterns — pattern-level, honest label.
// ---------------------------------------------------------------------------

const FIXTURE_SOURCE = [
  "// sample module",
  "export function topExported(a: number): number {",
  "  return a + 1;",
  "}",
  "function topLevelPrivate(b: string): string {",
  "  function nestedInside() { return 1; }",
  "  return b;",
  "}",
  "export const arrowExport = (x: number) => x * 2;",
  "interface Payload {",
  "  id: string;",
  "  weight: number;",
  "}",
  "type Alias = { ok: boolean };",
  "const CONFIG = {",
  "  host: \"localhost\",",
  "  port: 8080,",
  "  retries: 3,",
  "};",
  "export const SCHEMA = {",
  "  apiKey: \"\",",
  "  timeoutMs: 5000,",
  "};",
].join("\n");

describe("extractPatterns", () => {
  it("finds top-level functions/exports/types/schemas with keys; excludes nested functions", () => {
    const patterns = extractPatterns(FIXTURE_SOURCE);
    const names = new Set(patterns.map((p) => `${p.kind}:${p.name}`));
    assert.ok(names.has("function:topExported"));
    assert.ok(names.has("function:topLevelPrivate"));
    assert.ok(names.has("export:arrowExport"));
    assert.ok(names.has("type:Payload"));
    assert.ok(names.has("type:Alias"));
    assert.ok(names.has("schema:CONFIG"));
    assert.ok(names.has("schema:SCHEMA"));
    assert.ok(![...names].some((n) => n.includes("nestedInside")), "indented nested function must NOT be claimed top-level");
    const config = patterns.find((p) => p.name === "CONFIG");
    assert.ok(config && config.kind === "schema" && Array.isArray(config.keys));
    assert.deepEqual(config?.keys, ["host", "port", "retries"]);
    for (const p of patterns) assert.equal(p.confidence, "pattern");
  });

  it("carries the honest pattern-level disclaimer constant", () => {
    assert.match(EXTRACT_PATTERN_DISCLAIMER, /NOT an AST/);
  });

  it("non-string input → empty", () => {
    assert.deepEqual(extractPatterns(null as unknown as string), []);
    assert.deepEqual(extractPatterns(42 as unknown as string), []);
  });
});

// ---------------------------------------------------------------------------
// trendNotes — deprecated-API advisory.
// ---------------------------------------------------------------------------

describe("trendNotes", () => {
  const hit = (repo: string, snippet: string) => ({
    repo,
    snippet,
    url: `https://github.com/${repo}`,
    provenance: "web-search" as const,
  });

  it("markers detected → repo-specific advisory notes, disclaimer first", () => {
    const notes = trendNotes("hvac dispatch", [
      hit("old/lib", "This library is deprecated since v2 and removed in v3."),
      hit("fine/repo", "Healthy project."),
    ]);
    assert.ok(notes[0].includes(TREND_NOTE_DISCLAIMER));
    assert.ok(notes.some((n) => n.includes("old/lib") && n.includes("deprecated")));
    assert.ok(notes.some((n) => n.includes("removal")));
  });

  it("no markers → single honest no-signal note (deterministic)", () => {
    const notes = trendNotes("", [hit("fine/repo", "Healthy project.")]);
    assert.ok(notes[0].includes(TREND_NOTE_DISCLAIMER));
    assert.ok(notes.some((n) => n.includes("No deprecation/removal signals")));
    const again = trendNotes("", [hit("fine/repo", "Healthy project.")]);
    assert.deepEqual(notes, again);
  });

  it("empty hit list → honest coverage note, no crash", () => {
    const notes = trendNotes("b", []);
    assert.ok(notes.length >= 2);
    assert.ok(notes.some((n) => n.includes("No deprecation/removal signals")));
  });
});

// ---------------------------------------------------------------------------
// harvestForPacket — research rows.
// ---------------------------------------------------------------------------

describe("harvestForPacket", () => {
  it("produces deduped research rows (kind 'research', provenance 'harvest')", async () => {
    const project = seedProject();
    const res = await harvestForPacket(project, {
      llmConfigured: false,
      search: searchWith([
        { title: "One", url: "https://github.com/acme/scheduler", content: "summary one" },
        { title: "Dup", url: "https://github.com/acme/scheduler", content: "summary one again" }, // same repo
        { title: "Two", url: "https://github.com/beta/worker", content: "summary two" },
      ]),
      fetchText: async () => "readme one",
      fetchJson: async () => ({ license: { spdx_id: "Apache-2.0", name: "Apache 2.0" } }),
    });
    assert.ok(res.ok === true);
    if (res.ok !== true) return; // narrow for TS
    assert.equal(res.querySource, "keyword");
    const repos = res.rows.map((r) => r.repo);
    assert.deepEqual([...new Set(repos)], repos, "rows must be deduped by repo");
    for (const row of res.rows) {
      assert.equal(row.kind, "research");
      assert.equal(row.provenance, "harvest");
      assert.ok(typeof row.snippet === "string" && row.snippet.length > 0);
      assert.ok(typeof row.url === "string");
    }
  });

  it("project without a brief → validation failure with RT_E_VALIDATION", async () => {
    const res = await harvestForPacket({} as Project, KEYWORD_OPTS);
    assert.equal(res.ok, false);
    if (res.ok !== false) return;
    assert.equal(res.reason, "validation");
    assert.equal(res.code, "RT_E_VALIDATION");
  });

  it("honest empty rows when search is down (never fabricated rows)", async () => {
    const res = await harvestForPacket(seedProject(), {
      llmConfigured: false,
      search: searchWith("fail") as unknown as HarvestOptions["search"],
    });
    assert.ok(res.ok === true);
    if (res.ok !== true) return;
    assert.deepEqual(res.rows, []);
    assert.ok(res.notes.some((n) => n.includes("honest empty") || n.includes("unavailable")));
  });

  it("185-H1: dual-channel LLM seam degrades to keyword; packet ok:true never carries error", async () => {
    const res = await harvestForPacket(seedProject(), {
      llmConfigured: true,
      llm: (async () => ({
        ok: true,
        text: JSON.stringify({ queries: ["poisoned-llm-query github"] }),
        error: "already complete",
      })) as HarvestOptions["llm"],
      search: searchWith("fail") as unknown as HarvestOptions["search"],
    });
    assert.equal(res.ok, true);
    if (res.ok !== true) return;
    assert.equal(res.querySource, "keyword");
    assert.equal("error" in res, false, "ok:true packet must not dual-channel");
    assert.ok(!res.queries.includes("poisoned-llm-query github"));
    assert.ok(res.notes.some((n) => n.includes("already complete")));
  });
});

// ---------------------------------------------------------------------------
// New headless bridges (the CLI calls these; smoke-test the honest shapes).
// ---------------------------------------------------------------------------

describe("headless new-pillar bridges", () => {
  it("harvest() forwards opts and returns honest rows via the seam", async () => {
    const res = await harvest(seedProject(), {
      llmConfigured: false,
      search: searchWith("fail") as unknown as HarvestOptions["search"],
    });
    assert.equal(res.ok, true);
    if (res.ok !== true) return;
    assert.deepEqual(res.rows, []);
  });

  it("swarmPlan() returns an advisory critique set for the current phase", async () => {
    const res = await swarmPlan(seedProject());
    assert.equal(res.ok, true);
    assert.equal(res.advisory, true);
    assert.ok(res.critiques.length > 0);
    assert.ok(typeof res.refinedPlan === "string" && res.refinedPlan.length > 0);
  });

  it("promptExpand() is honest not-configured when no DeepSeek key is present", async (t) => {
    if (process.env.DEEPSEEK_API_KEY) {
      t.skip("DEEPSEEK_API_KEY set on this host — not-configured path not testable here");
      return;
    }
    const res = await promptExpand(seedProject());
    assert.equal(res.ok, false);
    if (res.ok !== false) return;
    assert.equal(res.reason, "not-configured");
  });

  it("benchProject() returns all four synthetic estimators with the disclaimer", async () => {
    const res = await benchProject(seedProject());
    assert.equal(res.ok, true);
    assert.match(res.disclaimer, /synthetic dry-run estimate/);
    const token = res.token as { estimate?: boolean };
    const time = res.time as { minutes?: number };
    assert.equal(token.estimate, true);
    assert.ok(typeof time.minutes === "number");
  });

  it("knowledgeSave/knowledgeFind round-trip with idempotent append", async () => {
    const dir = tmp();
    try {
      const storePath = join(dir, "patterns.json");
      const input = {
        project: "p1",
        kind: "pattern" as const,
        title: "Auth refresh pattern",
        tags: ["auth", "refresh"],
        body: "rotate tokens before expiry",
      };
      const first = await knowledgeSave(storePath, input);
      assert.equal(first.appended, true);
      assert.ok(first.entry && typeof (first.entry as { id?: string }).id === "string");
      const again = await knowledgeSave(storePath, input);
      assert.equal(again.appended, false, "identical entry must be an idempotent no-op");
      const matches = await knowledgeFind(storePath, "auth refresh", 5);
      assert.ok(matches.length >= 1);
      assert.ok(matches[0].score > 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("mineDir() maps a bounded source tree; skips node_modules + non-source; ENOENT throws", async () => {
    const dir = tmp();
    try {
      writeFileSync(join(dir, "a.ts"), "export const a = 1;\nimport { x } from \"./b.ts\";\n");
      writeFileSync(join(dir, "b.ts"), "export const x = 2;\n");
      writeFileSync(join(dir, "note.txt"), "not source");
      mkdirSync(join(dir, "node_modules", "pkg"), { recursive: true });
      writeFileSync(join(dir, "node_modules", "pkg", "dep.ts"), "export const dep = 1;\n");
      const res = await mineDir(dir);
      assert.equal(res.ok, true);
      const paths = (res.files as { path: string }[]).map((f) => f.path);
      assert.equal(paths.length, 2, `expected only a.ts/b.ts, got ${JSON.stringify(paths)}`);
      assert.ok(paths.some((p) => p.endsWith("a.ts")) && paths.some((p) => p.endsWith("b.ts")));
      assert.ok(res.skipped.excluded >= 1, "note.txt should be counted as excluded");
      await assert.rejects(() => mineDir(join(dir, "missing")), /mineDir/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("mineDir() honors the file-count bound and reports the overflow", async () => {
    const dir = tmp();
    try {
      writeFileSync(join(dir, "one.ts"), "export const one = 1;\n");
      writeFileSync(join(dir, "two.ts"), "export const two = 2;\n");
      const res = await mineDir(dir, { maxFiles: 1 });
      assert.equal(res.ok, true);
      assert.equal((res.files as unknown[]).length, 1);
      assert.ok(res.skipped.overLimit.length >= 1, "overflow files must be reported, never silently dropped");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("wildStartHeadless() — not-wild and not-active are honest refusals", async () => {
    const plain = seedProject();
    const a = await wildStartHeadless(plain);
    assert.equal(a.ok, false);
    if (a.ok !== false) return;
    assert.equal(a.reason, "not-wild");

    const active = seedProject({
      wildMode: true,
      wildRun: {
        active: false,
        phase: 0,
        startedAt: null,
        lastAutoLog: "",
        lastAutoAt: null,
        stoppedAt: null,
        pause: false,
      },
    });
    const b = await wildStartHeadless(active);
    assert.equal(b.ok, false);
    if (b.ok !== false) return;
    assert.equal(b.reason, "not-active");
  });

  it("wildStartHeadless() runs a bounded loop and stops on a noop outcome", async () => {
    const paused = seedProject({
      wildMode: true,
      wildRun: {
        active: true,
        phase: 0,
        startedAt: Date.now(),
        lastAutoLog: "",
        lastAutoAt: null,
        stoppedAt: null,
        pause: true, // wildStep returns noop without any backend import
      },
    });
    const res = await wildStartHeadless(paused, { maxSteps: 12 });
    assert.equal(res.ok, true);
    if (res.ok !== true) return;
    assert.equal(res.outcome, "noop");
    assert.equal(res.steps, 1, "a paused run must stop after the first noop step");
  });
});

// ---------------------------------------------------------------------------
// harvest lesson rows — honest negative evidence (fixes/98 §3 extension,
// fixes/101): rate-limited / empty harvests earn content-addressed lesson
// rows so the next run knows the environment may have caused the miss.
// ---------------------------------------------------------------------------

describe("harvest lesson rows — honest negative evidence (fixes/98)", () => {
  it("harvestEvidenceLesson mints a tagged, bounded, content-addressed row per reason", () => {
    const p = seedProject();
    const row = harvestEvidenceLesson(p, { reason: "rate-limit", detail: "GitHub API returned HTTP 403", phase: 1 });
    assert.ok(Array.isArray(row.tags));
    assert.ok(row.tags.includes("lesson"), "every lesson row carries the lesson tag");
    assert.ok(row.tags.includes("harvest"));
    assert.ok(row.tags.includes("negative-evidence"));
    assert.ok(row.tags.includes("harvest-rate-limit"), "classShort rides the tags");
    assert.ok(row.id.startsWith("lesson-harvest-rate-limit-"), "content-addressed class id");
    assert.equal(row.kind, "episodic");
    assert.equal(row.phase, 1);
    assert.equal(row.score, 0.6);
    assert.equal(row.source, "engine");
    assert.ok(row.text.length <= 240, "bounded text (H43-P2-2)");
    assert.ok(row.text.includes("rate limit"));
    assert.ok(row.text.includes("nothing fabricated"), "honest negative label always present");
    // Idempotency (H43-P2-1): identical inputs mint the identical id — a
    // retried harvest can never fork a duplicate row.
    const again = harvestEvidenceLesson(p, { reason: "rate-limit", detail: "GitHub API returned HTTP 403", phase: 1 });
    assert.equal(again.id, row.id);
    assert.deepEqual(again, row);
  });

  it("harvestResultLesson derives empty / rate-limit / degraded / null deterministically", () => {
    const p = seedProject();
    const empty = harvestResultLesson(p, {
      hits: [],
      notes: ["no GitHub repositories surfaced by search — honest empty hit list"],
    });
    assert.ok(empty && empty.id.startsWith("lesson-harvest-empty-"), "zero hits -> empty");

    const rate = harvestResultLesson(p, {
      hits: [],
      notes: ["GitHub API license spot-check failed (unreachable or rate-limited) — license left absent"],
    });
    assert.ok(rate && rate.id.startsWith("lesson-harvest-rate-limit-"), "zero hits + rate note -> rate-limit");
    assert.ok(rate!.text.includes("rate limit"));

    const degraded = harvestResultLesson(p, {
      hits: [{ repo: "a/b" }],
      notes: ["fetch budget exhausted", "search backend rate-limited"],
    });
    assert.ok(degraded && degraded.id.startsWith("lesson-harvest-degraded-"), "hits under pressure -> degraded");

    const clean = harvestResultLesson(p, { hits: [{ repo: "a/b" }], notes: [] });
    assert.equal(clean, null, "a clean non-empty harvest has no negative evidence");
  });

  it("floors junk outcome input without throwing", () => {
    const p = seedProject();
    const junk = harvestResultLesson(p, {});
    assert.ok(junk && junk.id.startsWith("lesson-harvest-empty-"), "empty outcome = honest empty row");

    const counted = harvestResultLesson(p, { hits: [null, undefined], notes: [42 as unknown as string] });
    assert.equal(counted, null, "hit count is array length — junk hits count as present, never a throw");

    const fallback = harvestEvidenceLesson(p, {
      reason: "bogus" as unknown as HarvestLessonReason,
      detail: "",
    });
    assert.ok(fallback.id.startsWith("lesson-harvest-empty-"), "unknown reason falls back to empty");
    assert.ok(fallback.text.includes(`brief "${FIXTURE_BRIEF.slice(0, 60)}"`), "blank detail falls back to brief context");
  });

  it("328 P5: the SAME harvest failure converges on ONE row (a differing detail tail cannot fork it)", () => {
    const p = seedProject();
    // The note/detail is volatile (a rate-limit message varies per backend and
    // run); reason+phase are the failure's identity. Two recurrences that agree
    // there but differ in the note must NOT mint two rows (112 §4.2 T1).
    const a = harvestEvidenceLesson(p, { reason: "rate-limit", detail: "GitHub API returned HTTP 403", phase: 1 });
    const b = harvestEvidenceLesson(p, { reason: "rate-limit", detail: "secondary rate limit hit; retry after 60s", phase: 1 });
    assert.equal(b.id, a.id, "same reason+phase ⇒ ONE row id regardless of the note");
    assert.notEqual(b.text, a.text, "the volatile detail still rides the row TEXT");

    // Different reason / different phase stay DIFFERENT rows (never over-collapse).
    const empty = harvestEvidenceLesson(p, { reason: "empty", detail: a.text, phase: 1 });
    assert.notEqual(empty.id, a.id, "a different reason is a different failure");
    const laterPhase = harvestEvidenceLesson(p, { reason: "rate-limit", detail: a.text, phase: 6 });
    assert.notEqual(laterPhase.id, a.id, "a different phase is a different failure");

    // The derivation path inherits the convergence: two harvest outcomes that
    // agree on reason+phase but not on the note text mint the SAME row id.
    const r1 = harvestResultLesson(p, { hits: [], notes: ["rate limit from backend A"] });
    const r2 = harvestResultLesson(p, { hits: [], notes: ["rate limit from backend B"] });
    assert.ok(r1 && r2, "premise: two rate-limit outcomes each derive a row");
    assert.equal(r2!.id, r1!.id, "harvestResultLesson converges on reason+phase, not the note");
  });
});

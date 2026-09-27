import { encode } from "gpt-tokenizer/encoding/cl100k_base";
import { PHASES } from "./phases.ts";
import type {
  AlgorithmTrace,
  CrewSeat,
  CrewRole,
  DataContract,
  IntentLattice,
  MemoryEntry,
  OracleTest,
  PhaseId,
  Project,
  SchedulerPlan,
  SpecGraph,
  SpecNode,
} from "./types";

// ---------------------------------------------------------------------------
// STEMMING — one canonical pair, one tokenizer (109 C-10, C-06).
//
// `stemToken` (one pass: lowercase, trailing-e drop, one of ing|ed|es|s,
// agent-noun `er`, doubled-consonant collapse) and `canonicalStem` (its fixed
// point, ≤ 4 passes) are THE stemming pair in this repo; `tokenizeWords` is
// the shared tokenizer built on it. fusionRank, phraseHits and intentLattice
// all match through that tokenizer, and BOTH sides of every comparison must
// go through the same function — stemming one side only is the C-06 bug class
// (intentLattice's freq count canonicalizes both sides, T-07).
//
// Two scoped exceptions are intentional, not drift:
//   • knowledge.ts's own `tokenize` (findPatterns / `lesson find`) — UNSTEMMED
//     token-overlap search; routing it through the pair above changes search
//     results and must land whole, with its tests (112 T9).
//   • engine.ts's `researchStem` — mining-only plural collapse (ies→y) for
//     research-query building; never a ranking stemmer.
// ---------------------------------------------------------------------------

const STOP = new Set(
  "a an the and or of to for with from into on at by is are be as we you they it this that build create make design develop system app software tool".split(
    " ",
  ),
);

const LEX: Record<IntentLattice["nodes"][number]["kind"], string[]> = {
  actor: [
    "shop",
    "tech",
    "technician",
    "dispatcher",
    "nurse",
    "clinician",
    "buyer",
    "seller",
    "admin",
    "operator",
    "driver",
    "manager",
    "customer",
    "client",
    "crew",
    "patient",
    "maker",
    // 95 P0-A (91/92 software-type taxonomy, types 1/9/11 + consumer apps):
    // consumer/dev-tool actors — the register previously carried zero CLI,
    // library or consumer vocabulary, so every such brief fell back to
    // deliver-core-workflow with vague:true (87 S1 root cause).
    "user",
    "player",
    "developer",
    "author",
    "editor",
    "reviewer",
    "contributor",
    "visitor",
    "viewer",
    "subscriber",
    "member",
    // 118 P-D3: real-estate / construction-trades actors (property briefs must
    // classify as real-estate, not analytics — the register previously carried
    // zero REI/trades vocabulary so every such brief fell back to a vague lattice).
    "agent",
    "realtor",
    "tenant",
    "landlord",
    "contractor",
    "flipper",
    "appraiser",
    "inspector",
    "lender",
    "subcontractor",
    "electrician",
    "plumber",
    "carpenter",
    "roofer",
  ],
  job: [
    "dispatch",
    "quote",
    "estimate",
    "invoice",
    "approve",
    "schedule",
    "route",
    "track",
    "bill",
    "reconcile",
    "alert",
    "assign",
    "handoff",
    "reroute",
    "search",
    "intake",
    "follow-up",
    "scan",
    // 95 P0-A: consumer/dev-tool jobs from 91's CLI (type 9), library (type 11)
    // and consumer-web types — rename/convert/undo are the RenamePro brief's
    // exact vocabulary (87); parse/lint/test/build cover the dev-tool class.
    "rename",
    "convert",
    "transform",
    "lint",
    "format",
    "deploy",
    "publish",
    "release",
    "scrape",
    "crawl",
    "watch",
    "sync",
    "backup",
    "batch",
    "migrate",
    "compile",
    "benchmark",
    "serve",
    "stream",
    "record",
    "query",
    "summarize",
    "analyze",
    "aggregate",
    "calculate",
    "validate",
    "parse",
    "generate",
    "install",
    "update",
    "test",
    "debug",
    "undo",
    // Consumer-web board verbs (86 Team Kanban): drag-and-drop + persistence.
    "drag",
    "drop",
    "persist",
    // 118 P-D3: real-estate / construction-trades jobs.
    "flip",
    "renovate",
    "rehab",
    "lease",
    "appraise",
    "close",
    "show",
    "stage",
    "rent",
    "bid",
    "inspect",
  ],
  object: [
    // 128 X5 (research/99 §7): marketplace relic + junk nouns removed from the
    // object register. Generic relational nouns (order/job/jobs/list/feed/field/
    // flag) fired on ANY brief using them as ordinary words — the property-ledger
    // merged run shipped `order` at 0.9501 (outranking lead/crew) and job/jobs/
    // list/feed/field/flag noise entities. `crew` is actor vocabulary already;
    // the fixes/121 object copy made entities list it twice. Real products name
    // these things with domain terms (work-order, ledger, calendar, booking) —
    // those are registered below so brief-faithful nouns still surface.
    "parts",
    "sku",
    "inventory",
    "lead",
    "ticket",
    "patient",
    "invoice",
    "estimate",
    "route",
    "fleet",
    "listing",
    "kpi",
    "dashboard",
    "ledger",
    // 95 P0-A: consumer/dev-tool objects from 91/92's taxonomy — files/dirs
    // (RenamePro), board/card/column/task (Team Kanban 86), library/statistics
    // (StatKit 88), media/navigation for consumer apps, and the packaging
    // surface for libraries/CLIs (package/config/schema/flag/command).
    "file",
    "folder",
    "directory",
    "repo",
    "repository",
    "package",
    "module",
    "config",
    "document",
    "task",
    "item",
    "card",
    "column",
    "board",
    "table",
    "entry",
    "account",
    "profile",
    "asset",
    "media",
    "audio",
    "video",
    "image",
    "chart",
    "graph",
    "page",
    "link",
    "url",
    "path",
    "text",
    "code",
    "script",
    "command",
    "option",
    "rule",
    "policy",
    "stream",
    "log",
    "event",
    "notification",
    "report",
    "dataset",
    "database",
    "schema",
    "index",
    "queue",
    "cache",
    "token",
    "library",
    "statistics",
    "statistic",
    "sdk",
    "api",
    // 118 P-D3: real-estate / construction-trades objects.
    "house",
    "property",
    "home",
    "estate",
    "showing",
    "calendar",
    "booking",
    "arv",
    "rental",
    "portfolio",
    "mortgage",
    "appraisal",
    "escrow",
    "title",
    "deed",
    "condo",
    "duplex",
    "multifamily",
    "comps",
    "comparable",
    "beds",
    "baths",
    "sqft",
    "permit",
    "punch-list",
    "material",
    // fixes/121: field-ops construction vocab (make-5 — the field-ops brief
    // drifted to field-service for want of crew/payroll/supply words).
    "work-order",
    "timesheet",
    "payroll",
    "supply",
    "vendor",
    "budget",
    "job-cost",
    "site",
    "subcontractor",
  ],
  constraint: [
    "same-day",
    "offline",
    "hipaa",
    "soc2",
    "audit",
    "air-gapped",
    "on-prem",
    "latency",
    "realtime",
    "multi-tenant",
    "gdpr",
    "pci",
    "timeout",
    "phi",
    "sla",
    // 95 P0-A: engineering-quality constraints the 91/92 taxonomy names for
    // deterministic/portable tooling (determinism is RapidTool's own Axis 2).
    "deterministic",
    "idempotent",
    "cross-platform",
    "local-first",
  ],
  risk: [
    "phi",
    "pii",
    "payment",
    "secret",
    "injection",
    "privilege",
    "leak",
    "outage",
    "rate-limit",
    "sandbox",
  ],
};

const DOMAIN_RISK: Record<string, { security: number; api: number; hitlBias: number }> = {
  "health-ops": { security: 2, api: 1, hitlBias: 1 },
  "finance-ops": { security: 2, api: 1, hitlBias: 1 },
  marketplace: { security: 1, api: 2, hitlBias: 0 },
  logistics: { security: 0, api: 1, hitlBias: 0 },
  "agent-platform": { security: 1, api: 1, hitlBias: 1 },
  "revenue-ops": { security: 1, api: 1, hitlBias: 0 },
  operations: { security: 0, api: 1, hitlBias: 0 },
  analytics: { security: 0, api: 1, hitlBias: 0 },
  "custom-software": { security: 0, api: 0, hitlBias: 0 },
  // 118 P-D3: real-estate carries PII + money (buyer/seller/tenant identities,
  // mortgage/escrow docs) so it sits above custom-software; construction is a
  // trade-ops domain without a payment/PII hot surface.
  "real-estate": { security: 1, api: 1, hitlBias: 0 },
  construction: { security: 0, api: 0, hitlBias: 0 },
};

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    // Hyphens are separators, not word chars: "file-renamer" must yield both
    // `file` and `renamer` (P0-A 95: the RenamePro brief's compound noun).
    .replace(/[^a-z0-9+ ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function phraseHits(text: string, vocab: string[]): string[] {
  // R7/B-15: word-boundary match over the STEMMED token set — never substring.
  // "technology support" no longer yields actor `tech`; "scanning barcode"
  // still yields job `scan` via inflectional stemming.
  const set = new Set(tokenizeWords(text));
  // fixes/136 (P8/lattice-stem): the inflectional stemmer collapses a derived
  // NOUN ending in "ing" (showing / listing / booking — real-estate and
  // hospitality register nouns) onto its bare BASE verb (show / list / book),
  // so a maintenance tracker's "show a status dashboard" surfaces a
  // real-estate `showing` entity and a to-do list's "list" surfaces a
  // `listing` entity. A gerund-noun register term must therefore fire only on
  // a REAL brief phrase — the gerund itself or its "ings" plural — never on a
  // shorter base verb. The phrase-match stays on the BRIEF's own tokens; no
  // register seeding.
  const raw = new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  return vocab.filter((v) => {
    const termTokens = tokenizeWords(v);
    if (termTokens.length === 0) return false;
    if (!termTokens.every((t) => set.has(t))) return false;
    const rawTermWords = v.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    if (rawTermWords.length === 1 && rawTermWords[0]!.endsWith("ing")) {
      const gerund = rawTermWords[0]!;
      if (!raw.has(gerund) && !raw.has(`${gerund}s`)) return false;
    }
    return true;
  });
}

/** A1 — Intent Lattice */
export function intentLattice(brief: string, domain: string): IntentLattice {
  // F2-84: never index/tokenize a non-string brief or domain — an empty brief
  // is the honest vague input, not a crash (hand-built / truncated payloads).
  const text = typeof brief === "string" ? brief : "";
  const dom = typeof domain === "string" && domain.length > 0 ? domain : "custom-software";
  const bag = tokens(text);
  const nodes: IntentLattice["nodes"] = [];
  (Object.keys(LEX) as Array<keyof typeof LEX>).forEach((kind) => {
    for (const term of phraseHits(text, LEX[kind])) {
      // R7/B-15: freq counts bag tokens whose stem equals the term's stem —
      // no substring in either direction ("scanning" feeds `scan`; "tech"
      // never feeds "technology" or vice versa).
      //
      // 109 T-07: canonical-stem BOTH sides (fixed point). The old pair
      // stemmed each bag token ONCE (stemToken) while the term went through
      // tokenizeWords → canonicalStem — so a brief's `listings` (single-pass
      // "listing") never matched the term `listing` (fixed-point "list") and
      // the node was under-weighted (0.35 vs 0.55 for the same mention count).
      // Both sides now iterate to the same fixed point, so singular/plural
      // inflections weight a node identically.
      const termStem = canonicalStem(term);
      const freq = bag.filter((t) => canonicalStem(t) === termStem).length;
      nodes.push({
        kind,
        label: term,
        weight: Math.min(1, 0.35 + freq * 0.2 + (kind === "constraint" ? 0.15 : 0)),
      });
    }
  });
  const seen = new Set<string>();
  const unique = nodes.filter((n) => {
    const k = `${n.kind}:${n.label}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  unique.sort((a, b) => b.weight - a.weight);
  if (dom === "health-ops") {
    // F2-84: the health-ops defaults are forced INDEPENDENTLY and kind-aware.
    // The old `.some(label === hipaa || label === phi)` conflated a constraint
    // `hipaa` with a risk `phi` (and vice versa): a health-ops brief declaring
    // "phi" (risk + constraint nodes) silently suppressed the hipaa constraint
    // default, and one declaring "hipaa" suppressed the phi RISK node — while
    // the PHI node is exactly what the risk surface must flag. Each default is
    // now added only when its own (kind, label) is absent.
    if (!unique.some((n) => n.kind === "constraint" && n.label === "hipaa")) {
      unique.push({ kind: "constraint", label: "hipaa", weight: 0.9 });
    }
    if (!unique.some((n) => n.kind === "risk" && n.label === "phi")) {
      unique.push({ kind: "risk", label: "phi", weight: 0.9 });
    }
    // F2-84: the defaults were appended AFTER the sort, so a health-ops lattice
    // with brief-derived nodes shipped them out of weight order (and could drop
    // them past the 18-node cap while derived lists still carried them) —
    // re-sort so `nodes` stays weight-desc, consistent with the derived lists.
    unique.sort((a, b) => b.weight - a.weight);
  }
  const jobs = unique.filter((n) => n.kind === "job").map((n) => n.label);
  const entities = unique.filter((n) => n.kind === "actor" || n.kind === "object").map((n) => n.label);
  const constraints = unique.filter((n) => n.kind === "constraint").map((n) => n.label);
  // R2/B-02: vague ⇔ BOTH fallbacks fired (no jobs AND no entities came from
  // brief vocabulary). The fallback arrays stay — A5/A6/A7 need ≥1 job; the
  // honesty signal is the flag, not emptied arrays.
  const vague = jobs.length === 0 && entities.length === 0;
  return {
    domain,
    jobs: jobs.length ? jobs : ["deliver-core-workflow"],
    entities: entities.length ? entities : ["operator", "record"],
    constraints,
    nodes: unique.slice(0, 18),
    complexity: Math.min(10, 3 + unique.length * 0.45 + constraints.length),
    vague,
  };
}

function overlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const set = new Set(b);
  let hit = 0;
  for (const t of a) if (set.has(t)) hit++;
  return hit / Math.sqrt(a.length * b.length);
}

/**
 * Longest contiguous in-order run of query tokens inside a row's token
 * sequence (exact stem equality, the same matching overlap uses). A run of
 * >= 2 means the row carries the query words as an actual PHRASE — the
 * stronger relevance signal a bag-of-words overlap cannot see ("invoice
 * approval" adjacent in "invoice approval workflow" vs scattered across
 * "approval workflow invoice"). Competitor retrieval treats exact-phrase
 * presence as a first-class signal (Obsidian-style token search boosts it;
 * Claude Code/Devin recall targeted, whole-item context — see fixes/106).
 *
 * T8 (112 F3): "longest contiguous run" IS "length of the longest prefix of
 * `q` that occurs as a contiguous substring of `row`", so one KMP pass
 * (O(|q| + |row|)) replaces the old restart scan, whose degenerate inputs
 * (row = the q token repeated) were O(|row|·|q|). Output is identical by
 * construction — the maximum KMP match state IS the old `best`. Exported for
 * the differential property test that proves it against the naive reference
 * (algorithms.test.ts).
 */
export function contiguousRun(q: string[], row: string[]): number {
  if (q.length === 0 || row.length === 0) return 0;
  // Failure table: fail[i] = length of the longest proper prefix of q[0..i]
  // that is also a suffix of q[0..i] (standard KMP preprocessing).
  const fail = new Array<number>(q.length).fill(0);
  for (let i = 1, k = 0; i < q.length; i++) {
    while (k > 0 && q[i] !== q[k]) k = fail[k - 1]!;
    if (q[i] === q[k]) k++;
    fail[i] = k;
  }
  let best = 0;
  for (let i = 0, k = 0; i < row.length; i++) {
    while (k > 0 && row[i] !== q[k]) k = fail[k - 1]!;
    if (row[i] === q[k]) k++;
    if (k === q.length) return q.length; // the whole query is a phrase here
    if (k > best) best = k;
  }
  return best;
}

/**
 * A2 — FusionRank (R6/B-16).
 *
 * Per-kind ranked blend with a kind prior — deliberately NOT multi-list RRF:
 * memory is partitioned by kind, each kind is ranked once by lexical overlap
 * + prior score, and every item is scored exactly once (no dead accumulation
 * branch). The rank contribution is normalized by kind population —
 * `rrf = 1/(60 + rank_i + kindSize*0.5)` — so a singleton kind does not
 * dominate a crowded kind, and a crowded kind's tail cannot bury a strong
 * singleton. True multi-retriever RRF over a shared candidate universe is
 * deferred to R-201.
 */
export function fusionRank(
  query: string,
  memory: MemoryEntry[],
  limit = 6,
): { id: string; score: number; text: string; kind: MemoryEntry["kind"] }[] {
  // CORE-09: stem the lexical inputs (tokenizeWords, the same B-15 word-boundary
  // stemmed tokenizer phraseHits/intentLattice use) so inflected pairs match:
  // "reroute"/"rerouting", "invoice"/"invoicing", "jobs"/"job" score overlap
  // instead of zero. The legacy unstemmed tokens() bag is kept only for
  // intentLattice's raw frequency counts.
  // F2-84 input normalization: a non-string query and a non-array/absent
  // memory list (hand-built or truncated payloads) must rank as empty input,
  // never throw — compileAgentPacket is the hot consumer and must not brick.
  // Fixes/106 (H3): query tokens are DE-DUPLICATED before scoring. overlap is
  // symmetric with a sqrt(|q|·|row|) normalizer, so a query that repeats a
  // stem ("build a fleet healthcheck tool, build the dashboard") used to
  // inflate every row's score by the repeated token's count — ranking noise
  // that no competitor ranker carries (bag-of-words matching counts a
  // distinct concept once; Claude Code/Devin recall on item-level relevance,
  // not query verbosity). Unique-ifying keeps one vote per distinct stem.
  const q = [...new Set(tokenizeWords(typeof query === "string" ? query : ""))];
  const rows = Array.isArray(memory) ? memory : [];
  // F2-84 limit normalization: NaN / negative / fractional limits used to flow
  // into slice() (slice(0, -5) returns ALL BUT the last 5 rows; NaN behaves as
  // 0 but still pays the dedupe pass) — clamp to a whole number in [0, ∞).
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  const byKind: Record<MemoryEntry["kind"], MemoryEntry[]> = {
    episodic: [],
    semantic: [],
    procedural: [],
  };
  // A15 (deep-audit-01): hydrate never sanitizes persisted memory, so a single
  // corrupt row (unknown `kind`, or null from a hand-edited payload) used to
  // throw here — inside packet compilation — and brick every subsequent
  // stamp/execute/packet. Unknown/malformed rows are skipped, not fatal: the
  // healthy rows still rank, and the corruption surfaces nowhere else.
  // F2-84: a row with a KNOWN kind but a non-string `text` (or no text at all)
  // used to fall through A15's guard and throw inside tokenizeWords(a.text)
  // during the per-kind sort — same brick, one row deeper. Skipped like the
  // other malformed rows; a non-finite prior score is floored to 0 (a NaN
  // comparator makes the sort order implementation-defined).
  for (const m of rows) {
    if (!m) continue;
    const bucket = byKind[m.kind];
    if (!bucket) continue;
    if (typeof m.text !== "string") continue;
    bucket.push(m);
  }

  const scored: { id: string; score: number; text: string; kind: MemoryEntry["kind"] }[] = [];
  (Object.keys(byKind) as MemoryEntry["kind"][]).forEach((kind) => {
    const kindSize = byKind[kind].length;
    if (!kindSize) return;
    const priorOf = (m: MemoryEntry): number => (Number.isFinite(m.score) ? m.score : 0);
    // T8 (112 F2): tokenize each row ONCE into a parallel {row, tokens} list.
    // The old comparator re-tokenized BOTH sides on every comparison
    // (O(k log k · L) tokenizations per kind for k rows of length L) and the
    // scoring pass tokenized a third time. tokenizeWords is pure and
    // deterministic, so the cached tokens are score- and order-identical
    // (frozen golden in algorithms.test.ts).
    const prepared = byKind[kind].map((m) => ({ m, tokens: tokenizeWords(m.text) }));
    prepared.sort((a, b) => {
      const sa = overlap(q, a.tokens) + priorOf(a.m) * 0.15;
      const sb = overlap(q, b.tokens) + priorOf(b.m) * 0.15;
      return sb - sa;
    });
    prepared.forEach(({ m: item, tokens: itemTokens }, i) => {
      const rrf = 1 / (60 + (i + 1) + kindSize * 0.5);
      const ox = overlap(q, itemTokens);
      const ce =
        0.55 * ox + 0.25 * priorOf(item) + 0.2 * (kind === "procedural" ? 0.9 : kind === "semantic" ? 0.7 : 0.5);
      // Fixes/106 (H3): contiguous-phrase boost. A row whose tokens carry a
      // >= 2-token contiguous in-order run of the query is a PHRASE hit — the
      // same evidence bag-of-words overlap cannot express. Additive, capped at
      // +0.1 so it can sharpen a tie but never overwhelm the +0.15 cited
      // boost or the prior/kind blend (small, honest, deterministic).
      const run = contiguousRun(q, itemTokens);
      const phraseBoost = run >= 2 ? Math.min(0.1, 0.05 * (run - 1)) : 0;
      // E-18: research-backed rows (MemoryEntry.source === "research") that
      // lexically overlap the query get a +0.15 cited boost — the 2nd brain
      // must rank fetched-and-sourced rows above boilerplate of EQUAL overlap.
      // Any token overlap qualifies (ox > 0): gating on full overlap (ox >= 1)
      // would leave the common "query ⊂ longer row text" case undiscriminated.
      // Rows without source:"research" never take the boost — additive,
      // default-off for legacy rows and every other provenance.
      const citedBoost = item.source === "research" && ox > 0 ? 0.15 : 0;
      scored.push({
        id: item.id,
        kind: item.kind,
        text: item.text,
        score: Math.round((0.6 * rrf * 10 + 0.4 * ce + citedBoost + phraseBoost) * 1000) / 1000,
      });
    });
  });

  // F2-84 duplicate-id guard (audit B-12 residual, "duplicate-memory
  // displacement"): the engine mints memory ids as `${phase}-${kind}-${score}`
  // and dedupes them at its merge sites (engine.dedupeMemoryIds), but a
  // persisted payload that skipped that pass (hand-edited export, pre-B-12
  // localStorage, or an import whose rows survived repair) can carry two rows
  // with the same id. Every consumer that keys results by id (packet render,
  // React keys, report-intake lookups) then DISPLACES one row silently. The
  // engine-side replacement fix is out of this module's lane (hydrateProject
  // should run the same dedupe pass); here the output contract — "every input
  // id exactly once" — is enforced deterministically: rows are already sorted
  // score-desc, so collapsing to the FIRST occurrence per id keeps the
  // highest-ranked (best-match) row and is stable for ties. Rows with a
  // missing/empty id are not keyable and are never collapsed (no content loss
  // for content that was already unaddressable). A ranking caller that needs
  // the collapse count can diff against the source list itself.
  const sorted = scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: { id: string; score: number; text: string; kind: MemoryEntry["kind"] }[] = [];
  for (const row of sorted) {
    if (out.length >= cap) break;
    if (typeof row.id === "string" && row.id.length > 0) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
    }
    out.push(row);
  }
  return out;
}

/** A3 — Constraint Scheduler */
export function scheduleConstraints(lattice: IntentLattice, domain: string): SchedulerPlan {
  const base = DOMAIN_RISK[domain] ?? DOMAIN_RISK["custom-software"];
  const constraintLoad = lattice.constraints.length;
  const securityDelta = base.security + (lattice.constraints.some((c) => /hipaa|pci|gdpr|soc2|phi/.test(c)) ? 1 : 0);
  const apiDelta = base.api + (constraintLoad > 2 ? 1 : 0);
  const extraHitl = new Set<PhaseId>();
  if (base.hitlBias || securityDelta >= 2) extraHitl.add(6);
  if (apiDelta >= 2) extraHitl.add(11);
  const tightness = Math.min(10, 4 + securityDelta * 1.5 + apiDelta + lattice.complexity * 0.25);
  return {
    securityDelta,
    apiDelta,
    tightness: Math.round(tightness * 10) / 10,
    extraHitl: [...extraHitl],
    notes: [
      securityDelta >= 2 ? "Elevate isolate + OAuth review; treat data as sensitive." : "Standard isolate policy.",
      apiDelta >= 2 ? "Cap live-tool calls and cache search results." : "Default API budget.",
      extraHitl.size ? `Extra HITL on P${[...extraHitl].join(", P")}.` : "Stock HITL set (P4, P5, P8, P9).",
    ],
  };
}

function pascal(s: string) {
  return s
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function topo(nodes: SpecNode[]): string[] {
  const incoming = new Map<string, number>();
  const outs = new Map<string, string[]>();
  for (const n of nodes) {
    incoming.set(n.id, incoming.get(n.id) ?? 0);
    outs.set(n.id, []);
  }
  for (const n of nodes) {
    for (const d of n.dependsOn) {
      if (!incoming.has(d)) continue;
      incoming.set(n.id, (incoming.get(n.id) ?? 0) + 1);
      outs.get(d)?.push(n.id);
    }
  }
  const q = [...incoming.entries()].filter(([, v]) => v === 0).map(([k]) => k);
  const order: string[] = [];
  while (q.length) {
    const id = q.shift()!;
    order.push(id);
    for (const nxt of outs.get(id) ?? []) {
      const left = (incoming.get(nxt) ?? 1) - 1;
      incoming.set(nxt, left);
      if (left === 0) q.push(nxt);
    }
  }
  for (const n of nodes) if (!order.includes(n.id)) {
    throw new Error("Spec graph contains a cycle");
  }
  return order;
}

/** A5 — Spec Graph Planner */
export function planSpecGraph(lattice: IntentLattice, domain: string): SpecGraph {
  // W40 N1 (H1 leftover): same foreign-domain coercion as intentLattice —
  // a null/non-string domain (hand-built / post-hydrate payload) must never
  // crash the schema file path; the honest fallback domain is custom-software.
  const dom = typeof domain === "string" && domain.length > 0 ? domain : "custom-software";
  const jobs = lattice.jobs.slice(0, 5);
  const jobIds = jobs.map((_, i) => `job-${i}`);
  const nodes: SpecNode[] = [
    {
      id: "schema",
      file: `src/domain/${dom.replace(/-/g, "_")}.ts`,
      purpose: "Typed entities from the lattice",
      dependsOn: [],
      owner: "architect",
    },
    {
      id: "api",
      file: "src/api/routes.ts",
      purpose: "HTTP contracts bound to jobs",
      dependsOn: ["schema"],
      owner: "architect",
    },
    {
      id: "store",
      file: "src/state/store.ts",
      purpose: "Checkpointed client/server state",
      dependsOn: ["schema"],
      owner: "implementer",
    },
    ...jobs.map((job, i) => ({
      id: `job-${i}`,
      file: `src/jobs/${job.replace(/[^a-z0-9]+/g, "_")}.ts`,
      purpose: `Implement job “${job}” against the contract`,
      dependsOn: ["api", "store"],
      owner: "implementer" as const,
    })),
    {
      id: "ui",
      file: "src/ui/console.tsx",
      purpose: "Operator surfaces bound to store fields",
      dependsOn: ["store", ...jobIds],
      owner: "implementer",
    },
    {
      id: "tests",
      file: "tests/oracle.spec.ts",
      purpose: "Acceptance tests from the oracle",
      dependsOn: ["api", "ui"],
      owner: "tester",
    },
  ];
  return { nodes, order: topo(nodes) };
}

const FIELD_BANK: Record<string, { name: string; type: string }[]> = {
  default: [
    { name: "id", type: "ulid" },
    { name: "status", type: "enum" },
    { name: "updatedAt", type: "datetime" },
  ],
  job: [
    { name: "id", type: "ulid" },
    { name: "assigneeId", type: "ulid" },
    { name: "slaDue", type: "datetime" },
    { name: "status", type: "enum" },
  ],
  patient: [
    { name: "id", type: "ulid" },
    { name: "mrnHash", type: "string" },
    { name: "slot", type: "datetime" },
  ],
  invoice: [
    { name: "id", type: "ulid" },
    { name: "totalCents", type: "int" },
    { name: "approvedBy", type: "ulid?" },
  ],
  order: [
    // fixes/121: a neutral work-order shape — "vendor work orders" on a
    // property brief must never inherit marketplace buyer/totalCents fields.
    { name: "id", type: "ulid" },
    { name: "title", type: "string" },
    { name: "status", type: "enum" },
    { name: "note", type: "string" },
  ],
};

/** A6 — Contract Synthesizer (R7/B-15: longest stem-matched field key; copied banks). */
export function synthesizeContracts(lattice: IntentLattice): DataContract {
  const names = [...new Set([...lattice.entities, ...lattice.jobs])].slice(0, 6);
  // Longest-key match over stemmed word tokens of the entity name
  // ("sales-order" → order bank via token `order`; "job-board" → job bank;
  // anything unmatched → default). Bank rows are copied per entity so
  // mutating one contract can never leak into another or into FIELD_BANK.
  const bankKeys = Object.keys(FIELD_BANK)
    .filter((k) => k !== "default")
    .sort((a, b) => b.length - a.length);
  const entities = names.map((name) => {
    const nameStems = new Set(
      name
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .map((w) => stemToken(w)),
    );
    const key = bankKeys.find((k) => nameStems.has(stemToken(k))) ?? "default";
    return {
      name: pascal(name),
      fields: (FIELD_BANK[key] ?? FIELD_BANK.default).map((f) => ({ ...f })),
    };
  });
  const endpoints = lattice.jobs.slice(0, 6).map((job) => ({
    method: job.match(/report|search|track/) ? ("GET" as const) : ("POST" as const),
    path: `/v1/${job.replace(/[^a-z0-9]+/g, "-")}`,
    job,
  }));
  return { entities, endpoints };
}

/** A7 — Test Oracle */
export function buildTestOracle(lattice: IntentLattice): OracleTest[] {
  const tests: OracleTest[] = lattice.jobs.slice(0, 5).map((job, i) => ({
    id: `orc-${i + 1}`,
    name: `job.${job}.happy`,
    given: `Authorized operator submits “${job}” with a valid ${lattice.entities[0] ?? "record"}`,
    expect: `200 + persisted entity + checkpoint written`,
    job,
  }));
  for (const c of lattice.constraints.slice(0, 3)) {
    tests.push({
      id: `orc-c-${c}`,
      name: `constraint.${c}`,
      given: `Request violates ${c}`,
      expect: `403 or 422; no side effect; diagnostic JSON`,
      job: lattice.jobs[0] ?? "core",
    });
  }
  tests.push({
    id: "orc-phase",
    name: "graph.no-skip",
    given: "Agent requests P9 while P4 is open",
    expect: "Illegal transition; no deploy artifacts",
    job: "graph",
  });
  return tests;
}

// ---------------------------------------------------------------------------
// fixes/159 (F1 — single-chunk collapse): capability scope → type-signature
// count. The keyed expansion (prompt-engine expandBrief) sizes
// implementationSpec.typeSignatures by LLM judgment alone, and a 7-capability
// real-estate brief collapsed to ≤8 signatures ⇒ ONE synthesis chunk ⇒ a
// one-file tree with the other spec-graph jobs left as TODO(E-15) stubs
// (fixes/157 §8; fixes/155 §2). THIS derivation is the pure deterministic
// floor for that judgment: every brief-named job — the lattice's capability
// proxy, the same list A7 oracle rows are cut from — contributes its own pair
// of TypeScript function signatures (run<Job> executes the capability;
// list<Job>Runs reads its checkpointed history), so capability scope
// mechanically bounds the signature count: n jobs ⇒ 2n signatures, which
// crosses P6_SYNTH_CHUNK_SIZE (8) at n = 5 ⇒ a genuine multi-chunk tree for
// every ≥5-capability brief. A lattice with no brief-named capability
// (vague:true, or only the deliver-core-workflow fallback job — the sentinel
// engine.ts:358 filters the same way) derives NOTHING, so every existing
// deterministic/keyless path that never had capabilities keeps byte-parity.
// Pure + keyless: no store, no LLM, no time — safe anywhere runAlgorithms is.
// ---------------------------------------------------------------------------
export function deriveTypeSignatures(lattice: IntentLattice): string[] {
  const jobs = (Array.isArray(lattice?.jobs) ? lattice.jobs : []).filter(
    (j): j is string => typeof j === "string" && j.trim().length > 0 && j !== "deliver-core-workflow",
  );
  const entities = (Array.isArray(lattice?.entities) ? lattice.entities : []).filter(
    (e): e is string => typeof e === "string" && e.length > 0,
  );
  // Entity rotation: job i pairs with entity i (mod pool), so the run<Job>
  // return type names a real brief entity when the lattice carries one; a
  // hand-built entity-free lattice falls back to the neutral `record`.
  const pool = entities.length > 0 ? entities : ["record"];
  const sigs: string[] = [];
  const seen = new Set<string>();
  jobs.forEach((job, i) => {
    const P = pascal(job);
    if (!P) return;
    const E = pascal(pool[i % pool.length] ?? "record");
    for (const line of [
      `run${P}(command: ${P}Command): Promise<${E}>`,
      `list${P}Runs(id: string, limit?: number): Promise<${P}Run[]>`,
    ]) {
      if (!seen.has(line)) {
        seen.add(line);
        sigs.push(line);
      }
    }
  });
  return sigs;
}

/**
 * R8/B-17: explicit phase → active-roles table. Replaces the blind
 * "force-activate architect" fallback (which lit architect up on P4/P7/P11).
 * Every phase 0..12 has ≥1 entry — property-tested in algorithms.test.ts.
 */
const ACTIVE_BY_PHASE: Record<number, CrewRole[]> = {
  0: ["architect"],
  1: ["architect"],
  2: ["architect"],
  3: ["architect"],
  4: ["reviewer"], // security/isolation review
  5: ["reviewer", "tester"],
  6: ["implementer", "tester"],
  7: ["architect"], // market research = architecture synthesis
  8: ["implementer"],
  9: ["reviewer"],
  10: ["implementer"],
  11: ["implementer"],
  12: ["reviewer"],
};

/** A8 — Crew Router */
export function routeCrew(
  lattice: IntentLattice,
  schedule: SchedulerPlan,
  phaseTitle: string,
  phase = 0,
): CrewSeat[] {
  const tight = schedule.tightness >= 7;
  const active = (role: CrewRole) => ACTIVE_BY_PHASE[phase]?.includes(role) ?? false;
  const seats: CrewSeat[] = [
    {
      role: "architect",
      mandate: `Lock schema and routes for ${lattice.jobs.slice(0, 3).join(", ") || "core jobs"} before code.`,
      tools: ["read_repo", "write_spec", "mcp.search"],
      budgetTokens: tight ? 1800 : 2600,
      handoff: "Pass Spec Graph order + contracts to implementer. Do not write feature code.",
      active: active("architect"),
    },
    {
      role: "implementer",
      mandate: `Write files in Spec Graph order. Current edge: ${phaseTitle}.`,
      tools: ["edit_file", "run_tests", "sandbox.exec"],
      budgetTokens: tight ? 3200 : 4800,
      handoff: "Stop when oracle tests fail twice; hand traceback to reviewer.",
      active: active("implementer"),
    },
    {
      role: "reviewer",
      mandate: "Diff against contracts. Reject invented endpoints and leaked PHI/PII.",
      tools: ["read_diff", "comment_pr"],
      budgetTokens: 1400,
      handoff: "Approve only if A6 endpoints and A7 oracle are green.",
      active: active("reviewer"),
    },
    {
      role: "tester",
      mandate: "Run oracle + one adversarial case per constraint.",
      tools: ["run_tests", "sandbox.exec"],
      budgetTokens: tight ? 900 : 1400,
      handoff: `Constraints in scope: ${lattice.constraints.join(", ") || "none"}.`,
      active: active("tester"),
    },
  ];
  return seats;
}

export function bootstrapMemory(lattice: IntentLattice): MemoryEntry[] {
  return [
    {
      id: "boot-sem",
      kind: "semantic",
      phase: 0,
      text: `Domain ${lattice.domain}; jobs ${lattice.jobs.slice(0, 4).join(", ")}.`,
      score: 0.8,
      // E-18: engine-template provenance (distinct from agent-report/human/research rows).
      source: "engine",
    },
    {
      id: "boot-proc",
      kind: "procedural",
      phase: 0,
      text: "Graph is sequential 0–12. HITL on P4, P5, P8, P9. Rejection needs ≥12 characters.",
      score: 0.95,
      source: "engine",
    },
    {
      id: "boot-epi",
      kind: "episodic",
      phase: 0,
      text: `Constraints declared: ${lattice.constraints.join(", ") || "none"}.`,
      score: 0.7,
      source: "engine",
    },
  ];
}

/** R2/B-02: axes now spread real ranges (1..10) so weak briefs can score < 6. */
function clamp1_10(n: number): number {
  return Math.max(1, Math.min(10, n));
}

export function feasibilityScorecard(lattice: IntentLattice, schedule: SchedulerPlan): {
  overall: number;
  verdict: "proceed" | "proceed-with-guards" | "reframe";
  axes: { key: string; label: string; score: number; note: string }[];
  bottlenecks: string[];
  attackVectors: string[];
} {
  const constraintLoad = lattice.constraints.length;
  // Recalibrated B-02 formulas: complexity 3 → 8 … complexity 10 → 3 (a
  // complexity ≥ 8 brief pays an extra 1.5); realtime and ≥3 constraints cost
  // scale headroom; sec/api widen downward via their scheduler Δs; delivery
  // collapses to 4 on vague briefs, 6 on single-job briefs.
  const feas = clamp1_10(Math.round(10 - lattice.complexity * 0.6 - (lattice.complexity >= 8 ? 1.5 : 0)));
  const scale = clamp1_10(
    Math.round(9 - (lattice.constraints.includes("realtime") ? 1.5 : 0) - (constraintLoad >= 3 ? 1 : 0)),
  );
  const sec = clamp1_10(Math.round(7 + schedule.securityDelta * 1.5));
  const api = clamp1_10(Math.round(8 - schedule.apiDelta * 1.5));
  const delivery = lattice.vague ? 4 : lattice.jobs.length <= 1 ? 6 : 8;
  const axes = [
    { key: "feasibility", label: "Technical feasibility", score: feas, note: "Typed contracts + sequential graph." },
    { key: "scale", label: "Scale headroom", score: scale, note: "Stateless workers + durable checkpoints." },
    { key: "security", label: "Security posture", score: sec, note: `Scheduler Δ${schedule.securityDelta}.` },
    { key: "api", label: "API / rate-limit risk", score: api, note: `Live-tool Δ${schedule.apiDelta}.` },
    { key: "delivery", label: "Delivery confidence", score: delivery, note: "Phased graph prevents skipped work." },
  ];
  const overall = Math.round((axes.reduce((a, x) => a + x.score, 0) / axes.length) * 10) / 10;
  // Hard rules override the threshold verdict (computed on the mean, applied
  // on top of it): HR-1 — vague briefs always reframe; HR-2 — complexity ≥ 8
  // is never a straight "proceed" (ceiling: proceed-with-guards).
  let verdict: "proceed" | "proceed-with-guards" | "reframe" =
    overall >= 7.5 ? "proceed" : overall >= 6 ? "proceed-with-guards" : "reframe";
  if (lattice.vague) verdict = "reframe";
  else if (verdict === "proceed" && lattice.complexity >= 8) verdict = "proceed-with-guards";
  return {
    overall,
    verdict,
    axes,
    bottlenecks: [
      "Long-running tools must stream over WebSocket MCP.",
      "HITL rejection without a qualitative note is illegal.",
      ...lattice.constraints.slice(0, 2).map((c) => `Constraint: ${c}`),
    ],
    attackVectors: [
      "Prompt injection via ingested competitor pages.",
      "Tool-call privilege escalation if OAuth scopes are inherited.",
      "Sandbox escape if generated exec has network.",
    ],
  };
}

export function runAlgorithms(project: Pick<Project, "brief" | "domain" | "memory" | "currentPhase">): {
  lattice: IntentLattice;
  schedule: SchedulerPlan;
  specGraph: SpecGraph;
  contracts: DataContract;
  oracle: OracleTest[];
  crew: CrewSeat[];
  traces: AlgorithmTrace[];
} {
  const lattice = intentLattice(project.brief, project.domain);
  const schedule = scheduleConstraints(lattice, project.domain);
  // R6: A2 (FusionRank) no longer runs here — compileAgentPacket (packet.ts)
  // is its single consumer and recomputes it over the packet context.
  const specGraph = planSpecGraph(lattice, project.domain);
  const contracts = synthesizeContracts(lattice);
  const oracle = buildTestOracle(lattice);
  // CORE-03 (defense-in-depth): never index PHASES[] with an unvalidated
  // currentPhase — hydrateProject clamps it, but a hand-built Project with a
  // corrupt value must degrade to P0's title rather than crash mid-attach.
  const crewPhase = project.currentPhase;
  const crew = routeCrew(
    lattice,
    schedule,
    (PHASES[crewPhase] ?? PHASES[0]).title,
    Number.isInteger(crewPhase) && crewPhase >= 0 && crewPhase <= 12 ? crewPhase : 0,
  );
  const traces: AlgorithmTrace[] = [
    {
      id: "A1",
      name: "Intent Lattice",
      ranAt: Date.now(),
      summary: `${lattice.nodes.length} nodes · complexity ${lattice.complexity.toFixed(1)}`,
    },
    {
      id: "A3",
      name: "Constraint Scheduler",
      ranAt: Date.now(),
      summary: `tightness ${schedule.tightness} · sec+${schedule.securityDelta}`,
    },
    {
      id: "A5",
      name: "Spec Graph",
      ranAt: Date.now(),
      summary: `${specGraph.nodes.length} files · order ${specGraph.order.slice(0, 3).join(" → ")}`,
    },
    {
      id: "A6",
      name: "Contract Synth",
      ranAt: Date.now(),
      summary: `${contracts.entities.length} entities · ${contracts.endpoints.length} endpoints`,
    },
    {
      id: "A7",
      name: "Test Oracle",
      ranAt: Date.now(),
      summary: `${oracle.length} cases`,
    },
    {
      id: "A8",
      name: "Crew Router",
      ranAt: Date.now(),
      summary: crew.map((c) => c.role[0]).join("") + ` · ${crew.reduce((a, c) => a + c.budgetTokens, 0)} tok`,
    },
  ];
  return { lattice, schedule, specGraph, contracts, oracle, crew, traces };
}

/**
 * B-21/T5: real BPE token count via gpt-tokenizer (cl100k_base — the closest
 * published encoding for the grok / deepseek model families; neither vendor
 * ships a browser tokenizer). Empty/whitespace-only input → 0 (the old
 * max(1, …) floor is gone). tokensLo/tokensHi frame an honest ±15% band
 * around the estimate; the console chip renders `≈{tokensEst} tok`. Results
 * are memoized in a module-level LRU keyed by the TEXT itself (cap 100) so an
 * unchanged packet never re-encodes on re-render.
 *
 * T7 (112 F1): the old key was fnv1a(text) — a 32-bit hash. Distinct texts
 * that collide on it returned EACH OTHER's count: reproduced with
 * fnv1a("rjmr") === fnv1a("lasipzafzrmsnlpmtfnstxtvfmtmnet") === 933450742,
 * which reported the 31-char string as 3 tokens (5.3x low) when the short
 * word was estimated first — the direction that lets a prompt pass the
 * enforceTokenBudget truncation guard while materially over budget
 * (crew.server.ts). The text itself is the key: collision is impossible, and
 * the 100-entry cap bounds retained text to the same recent inputs the caller
 * just handed in.
 */
const tokenEstimateCache = new Map<string, number>();

export function estimateTokens(text: string): { tokensEst: number; tokensLo: number; tokensHi: number } {
  if (!text.trim()) return { tokensEst: 0, tokensLo: 0, tokensHi: 0 };
  let tokensEst = tokenEstimateCache.get(text);
  if (tokensEst === undefined) {
    tokensEst = encode(text).length;
    if (tokenEstimateCache.size >= 100) {
      const oldest = tokenEstimateCache.keys().next().value;
      if (oldest !== undefined) tokenEstimateCache.delete(oldest);
    }
  } else {
    tokenEstimateCache.delete(text); // refresh LRU recency
  }
  tokenEstimateCache.set(text, tokensEst);
  return {
    tokensEst,
    tokensLo: Math.round(tokensEst * 0.85),
    tokensHi: Math.round(tokensEst * 1.15),
  };
}

// ---------------------------------------------------------------------------
// Core-commit primitives (B-15/R7 stemmer, R9 derived libraries, T9 hashing)
// ---------------------------------------------------------------------------

/** FNV-1a 32-bit — deterministic string hash (rejection steering variants, memo keys). */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic inflectional-lite stemmer (B-15): lowercase, trailing-e drop for
 * long tokens, then strip one of ing|ed|es|s, then collapse a doubled consonant.
 * `route`/`routing` -> `rout`; `scanning` -> `scan`; `jobs` -> `job`. Never
 * returns a token shorter than 3 chars unless the input was.
 */
export function stemToken(input: string): string {
  const s = input.toLowerCase().trim();
  if (s.length <= 3) return s;
  let w = s;
  // PB-01 (111): the e-drop guard must match the -es plural strip so 4-letter
  // -e words canonicalize ("file" ≡ "files" both → "fil"). The old "le"
  // exclusion broke exactly that ("file" ends "le" → kept its e, "files"
  // stripped "es" → "fil" — mismatch). Drop it: consistency beats cosmesis.
  if (w.endsWith("e") && w.length >= 4) w = w.slice(0, -1);
  for (const suf of ["ing", "ed", "es", "s"]) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      w = w.slice(0, -suf.length);
      break;
    }
  }
  // Agent-noun suffix (P0-A 95): "renamer" must stem to the same form as
  // "rename" (→ "renam"). Length-guarded so short words like "user" survive
  // untouched (remainder must be ≥ 4 chars).
  if (w.endsWith("er") && w.length - 2 >= 4) w = w.slice(0, -2);
  if (w.length > 3 && w.endsWith(w[w.length - 1] + w[w.length - 1])) {
    w = w.slice(0, -1);
  }
  return w.length >= 3 ? w : s;
}

/** Fixed-point stem (PB-01): iterate stemToken until stable (max 4 passes) —
 *  the vault.ts approach, now the algorithms core so phraseHits/fusionRank/
 *  intentLattice all agree on inflectional variants ("zebra" ≡ "zebras"). */
export function canonicalStem(word: string): string {
  let prev = word;
  for (let i = 0; i < 4; i++) {
    const next = stemToken(prev);
    if (next === prev) return next;
    prev = next;
  }
  return prev;
}

/** Word-boundary tokenizer -> stemmed tokens (the B-15 replacement for substring hits). */
export function tokenizeWords(text: string): string[] {
  // Hyphens/pluses are separators, not word chars (P0-A 95): "file-renamer"
  // must yield `file` + `renamer`, "drag-and-drop" three words.
  const raw = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return raw.map(canonicalStem);
}

const LIB_BASE: { name: string; role: string }[] = [
  { name: "TanStack Start", role: "Typed app shell and file routes" },
  { name: "Zod", role: "Schema lock on generated artifacts" },
];

const LIB_DOMAIN: Record<string, { name: string; role: string }[]> = {
  "revenue-ops": [{ name: "CRM SDK (vendor)", role: "Lead/pipeline sync" }],
  operations: [{ name: "Inventory core (vendor or in-house)", role: "SKU truth + stock ledger" }],
  marketplace: [{ name: "Checkout + dispute SDK", role: "Two-sided payments" }],
  "agent-platform": [
    { name: "LiteLLM-compatible router", role: "Model failover without session loss" },
    { name: "FastMCP", role: "Isolated tool microservices" },
    { name: "Ollama", role: "Edge draft/format loops" },
  ],
  "health-ops": [{ name: "HIPAA-aware audit logger", role: "No PHI in logs; access trail" }],
  logistics: [{ name: "Geo/dispatch SDK", role: "Same-day routing + ETA" }],
  "finance-ops": [{ name: "Ledger + payments SDK", role: "Tax-ready books" }],
  analytics: [{ name: "Warehouse + BI", role: "KPI dashboards" }],
  "real-estate": [{ name: "MLS / property-data API", role: "Listings, comps, and ARV inputs" }],
  construction: [{ name: "Estimating + scheduling core", role: "Bids, materials, punch lists" }],
};

const LIB_CONSTRAINT: Record<string, { name: string; role: string }> = {
  realtime: { name: "WebSocket/sync layer", role: "Live state" },
  offline: { name: "Sync engine + local cache", role: "Offline-first writes" },
  hipaa: { name: "Audit + access-control layer", role: "PHI containment" },
  phi: { name: "Audit + access-control layer", role: "PHI containment" },
  pci: { name: "PCI-scoped tokenization", role: "Card data minimization" },
};

/**
 * Deterministic library suggestions derived from domain + constraints (B-22/R9).
 * Rows are an illustrative baseline — callers must say so when rendering.
 */
export function librariesFor(
  domain: string,
  lattice?: { jobs?: string[]; constraints?: string[] } | null,
): { name: string; role: string }[] {
  const rows = [...LIB_BASE, ...(LIB_DOMAIN[domain] ?? [])];
  const seen = new Set(rows.map((r) => r.name));
  for (const c of lattice?.constraints ?? []) {
    const key = c.toLowerCase();
    for (const [k, lib] of Object.entries(LIB_CONSTRAINT)) {
      if (key.includes(k) && !seen.has(lib.name)) {
        rows.push(lib);
        seen.add(lib.name);
      }
    }
  }
  return rows;
}

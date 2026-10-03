/**
 * T5.2-A — fixtures review surface · DATA LAYER (pure, client-safe).
 *
 * Parses `research/eval-corpus/<slug>.md` fixture frontmatter and the run-side
 * graders (`graders/<slug>.grader.json`) from STRINGS. IO lives in the
 * `fixtures.server.ts` sibling (lazy `node:fs`) — this module never touches the
 * filesystem (the H2 crash class: no `node:` imports into client-safe modules).
 *
 * Honesty contract carried through verbatim, from the grader's own `authority`:
 * the grader is RUN-SIDE authority — read ONLY by `scripts/run-eval.mjs`, never
 * copied into a project tree (`graderLeakScan` pins that). The review surface
 * therefore shows the bar next to every fixture and labels approval as a
 * RECORDED DECISION, never a bar edit.
 *
 * No `node:` imports and no IO. Deterministic: same inputs → same rows, stable order.
 * (One pure sibling import — `brief-fixtures.ts`'s decidedBy vocabulary — so the
 * acceptance-decision reader below shares ONE seat enum with the writer.)
 */
import { BRIEF_FIXTURE_DECIDED_BY } from "./brief-fixtures.ts";

/** The one line every review surface must show (T5.2-A honesty label). */
export const FIXTURE_REVIEW_LABEL =
  "read-only review — the grader is run-side authority; approval is a CLI action (fixtures --approve --ids …) and this view records no decision";

/**
 * @de-scoped (W42·L1-E5) — zero consumers; the human fixture decision CANNOT
 * ride `project.decisions` as-is: a `HitlDecision` requires phase/title/
 * requestedAt/decidedAt, and the engine's `wellFormedDecisionRow`
 * (engine.ts:2037 — `typeof phase === "number"`, `typeof decidedAt ===
 * "number"`, `decidedBy`/`decision` strings) would drop a mismatched row —
 * a `FixtureDecisionEntry` carries none of those keys. Kept for the day the
 * fixture-decision journal gets its own shape; do not wire it into
 * `project.decisions` without that shape. Evidence: repo-wide grep 2026-09-28
 * (`FixtureDecisionEntry|fixtureDecisionEntry|FixtureVerdict`) → definitions
 * here + the console.tsx W24 note only (no reader); see fixes/295_p3_eval.md t0.
 */

/** Verdicts the human seat may record for one fixture. */
export type FixtureVerdict = "approve" | "reject";

/** One decision-journal entry as this surface records it (never written here). */
export interface FixtureDecisionEntry {
  kind: "fixture-review";
  slug: string;
  verdict: FixtureVerdict;
  actor: string;
  note: string | null;
  at: string;
}

export type FixtureParse =
  | { ok: true; slug: string; fields: Record<string, string | string[]>; body: string }
  | { ok: false; slug: string; reason: string };

export interface FixtureGrader {
  graderVersion: number;
  slug: string;
  caseName: string;
  acceptanceBar: string;
  requiredIdentifiers: string[];
  authority: string;
}

export type GraderParse =
  | { ok: true; grader: FixtureGrader }
  | { ok: false; slug: string; reason: string };

/** The slug of a parse result, wherever it lives (ok variant: on the grader). */
export function graderSlug(g: GraderParse): string {
  return g.ok ? g.grader.slug : g.slug;
}

/** One rendered row of the fixtures review surface. */
export interface FixtureReviewRow {
  slug: string;
  name: string;
  kind: string;
  domain: string;
  acceptanceBar: string;
  requiredIdentifiers: string[];
  expectedNouns: string[];
  expectedCapabilities: string[];
  baseline: string | null;
  graderOk: boolean;
  /** Why this row cannot be reviewed on the GRADER side (null when the grader
   *  is ok): the grader's own parse failure — or, when the FIXTURE itself
   *  never parsed, the fixture's parse failure (possibly joined with the
   *  grader's). Shown, never hidden. */
  graderProblem: string | null;
  /** W42·L1-E4 (W-29(g)): why the FIXTURE failed to parse (null when ok) —
   *  the fixture axis, kept distinct from the grader axis. */
  fixtureProblem: string | null;
  /** `##` headings found in the fixture body (provenance etc.), in file order. */
  provenanceHeadings: string[];
  reviewState: "awaiting-decision" | "bar-missing";
  label: string;
}

/** Strip one layer of matching single/double quotes; trim whitespace. */
function unquote(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    return t.slice(1, -1);
  }
  return t;
}

/**
 * Parse a `[a, b, "c"]`-style inline list tolerantly: JSON first (the corpus
 * writes quoted entries), then a comma split with per-item unquoting. Never
 * throws — a malformed list becomes its items as-written rather than a crash.
 */
function parseInlineList(v: string): string[] {
  const t = v.trim();
  try {
    const j: unknown = JSON.parse(t);
    if (Array.isArray(j) && j.every((x) => typeof x === "string")) return j as string[];
  } catch {
    /* fall through to the tolerant split */
  }
  const inner = t.startsWith("[") && t.endsWith("]") ? t.slice(1, -1) : t;
  return inner
    .split(",")
    .map((s) => unquote(s))
    .filter((s) => s.length > 0);
}

/**
 * Parse a corpus fixture's YAML-ish frontmatter block (the corpus writes a
 * flat `key: value` map; values are quoted strings or inline lists). The body
 * after the closing fence is returned verbatim.
 */
export function parseFixtureFrontmatter(text: string, sourceName: string): FixtureParse {
  const slug = sourceName.replace(/\.md$/i, "");
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    return { ok: false, slug, reason: "no frontmatter fence: first line is not `---`" };
  }
  let close = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i]?.trim() === "---") {
      close = i;
      break;
    }
  }
  if (close === -1) return { ok: false, slug, reason: "frontmatter fence never closes" };

  const fields: Record<string, string | string[]> = {};
  for (let i = 1; i < close; i += 1) {
    const line = lines[i] ?? "";
    const m = /^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(line);
    if (!m) continue; // blank lines / continuation prose are ignored, never guessed
    const key = m[1] as string;
    const raw = m[2] ?? "";
    fields[key] = raw.trim().startsWith("[") ? parseInlineList(raw) : unquote(raw);
  }

  const body = lines.slice(close + 1).join("\n");
  return { ok: true, slug, fields, body };
}

/** Parse a run-side grader document (JSON) with a shape check on the fields the surface shows. */
export function parseGrader(text: string, sourceName: string): GraderParse {
  const slug = sourceName.replace(/\.grader\.json$/i, "").replace(/\.json$/i, "");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, slug, reason: `not valid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (typeof raw !== "object" || raw === null) return { ok: false, slug, reason: "document is not an object" };
  const o = raw as Record<string, unknown>;
  const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  const str = (v: unknown): v is string => typeof v === "string";
  const strArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
  if (!num(o.graderVersion)) return { ok: false, slug, reason: "graderVersion missing or not a number" };
  if (!str(o.slug)) return { ok: false, slug, reason: "slug missing" };
  if (!str(o.caseName)) return { ok: false, slug, reason: "caseName missing" };
  if (!str(o.acceptanceBar)) return { ok: false, slug, reason: "acceptanceBar missing" };
  if (!strArr(o.requiredIdentifiers)) return { ok: false, slug, reason: "requiredIdentifiers missing or not a string array" };
  if (!str(o.authority)) return { ok: false, slug, reason: "authority missing (the run-side contract line must be kept verbatim)" };
  return {
    ok: true,
    grader: {
      graderVersion: o.graderVersion,
      slug: o.slug,
      caseName: o.caseName,
      acceptanceBar: o.acceptanceBar,
      requiredIdentifiers: o.requiredIdentifiers,
      authority: o.authority,
    },
  };
}

/** `##` headings in a fixture body, in file order (provenance surfaces etc.). */
export function bodyHeadings(body: string): string[] {
  return body
    .split(/\r?\n/)
    .filter((l) => /^##\s+\S/.test(l))
    .map((l) => l.replace(/^##\s+/, "").trim());
}

/**
 * Join fixtures with their graders by slug into display rows, in stable
 * slug order. A fixture without a parseable grader surfaces `reviewState:
 * "bar-missing"` with the reason — never silently. W42·L1-E4: a fixture whose
 * own frontmatter never parsed is never reviewable either — it can no longer
 * mint `awaiting-decision` off the strength of its grader (W-29(g) fake row);
 * its parse failure is named in `fixtureProblem` AND folded into
 * `graderProblem` (the display slot the console reads), one problem per axis.
 */
export function fixtureReviewRows(fixtures: FixtureParse[], graders: GraderParse[]): FixtureReviewRow[] {
  const graderBySlug = new Map<string, GraderParse>();
  for (const g of graders) graderBySlug.set(graderSlug(g), g);
  const rows: FixtureReviewRow[] = fixtures.map((f) => {
    const g = graderBySlug.get(f.slug);
    const graderOk = g != null && g.ok;
    const grader = graderOk && g.ok ? g.grader : null;
    const fields = f.ok ? f.fields : {};
    const asStr = (v: string | string[] | undefined): string => (Array.isArray(v) ? v.join(" · ") : (v ?? ""));
    const asArr = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);
    // W42·L1-E4 (W-29(g); handoff p3): an unparseable fixture + a valid grader
    // used to mint `awaiting-decision` — a fake review row. The fixture's own
    // parse failure must be the problem named (never the misleading "no grader
    // file for this slug" when that is not the actual fault).
    const fixtureProblem = f.ok ? null : `fixture frontmatter unparseable — ${f.reason}`;
    const graderProblem = g == null ? "no grader file for this slug" : g.ok ? null : g.reason;
    return {
      slug: f.slug,
      name: asStr(fields.name) || f.slug,
      kind: asStr(fields.kind) || "—",
      domain: asStr(fields.domain) || "—",
      acceptanceBar: grader?.acceptanceBar ?? asStr(fields.acceptance) ?? "",
      requiredIdentifiers: grader?.requiredIdentifiers ?? [],
      expectedNouns: asArr(fields.expectedNouns),
      expectedCapabilities: asArr(fields.expectedCapabilities),
      baseline: asStr(fields.baseline) || null,
      graderOk,
      graderProblem: [fixtureProblem, graderProblem].filter((p): p is string => p !== null).join(" · ") || null,
      fixtureProblem,
      provenanceHeadings: f.ok ? bodyHeadings(f.body) : [],
      reviewState: f.ok && graderOk ? "awaiting-decision" : "bar-missing",
      label: FIXTURE_REVIEW_LABEL,
    };
  });
  return rows.sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Build (never write) the decision-journal entry for one verdict. The caller
 * appends it through the project's existing decision path with the acting
 * human's name and an optional note — same actor+ISO-timestamp discipline as
 * phase approvals (T2).
 *
 * @de-scoped (W42·L1-E5) — see the block above `FixtureVerdict`: no consumer
 * today, and it cannot append to `project.decisions` without a journal shape
 * (HitlDecision mismatch). Kept, documented, not wired.
 */
export function fixtureDecisionEntry(
  slug: string,
  verdict: FixtureVerdict,
  actor: string,
  note?: string,
  at: Date = new Date(),
): FixtureDecisionEntry {
  return {
    kind: "fixture-review",
    slug,
    verdict,
    actor,
    note: note && note.trim().length > 0 ? note.trim() : null,
    at: at.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// fixes/338-4 (W52) — the acceptance DECISION as data (the doctor's gap 4).
//
// The factory bar's fixture term asks "who accepted the acceptance bar?" — a
// question no machine run may ANSWER for itself. `policy.ts`'s `fixtures.approve`
// rule keeps `requiresHumanSeat: true` because the machine DRAFTS those cases
// (`brief-fixtures.ts:18-22`: every case is born `approval:"pending"`); a machine
// that also approved them would set the bar it is then graded against —
// self-certification, and the factory flag would certify a self-graded product.
// So this module never mints a decision: only the CLI's seat-verified approve
// path stamps `decidedBy` (`scripts/rapidtool-cli.mjs:2288`).
//
// What it DOES do is make the question machine-CHECKABLE without making it
// machine-ANSWERABLE. Any run can compute which state the decision is in —
// nothing drafted · drafted and pending a human · decided by the autopilot seat ·
// approved with no attributable seat · human-approved — and therefore tell
// "waiting on a human" apart from "broken". `acceptanceDecisionQuestion` returns
// the ONE honest sentence for each state; the doctor's gap text and the maker
// scorecard (M1/M2) both read it, so the two surfaces cannot tell two stories
// about the same run.
// ---------------------------------------------------------------------------

/** Who decided a project's acceptance fixtures (its `decidedBy` value). */
export type FixtureAcceptanceSeat = "human" | "autopilot" | "undecided";

export const FIXTURE_ACCEPTANCE_STATES = [
  "no-fixtures",
  "unreadable",
  "pending",
  "machine-decided",
  "unattributed",
  "human-approved",
] as const;
export type FixtureAcceptanceStateKind = (typeof FIXTURE_ACCEPTANCE_STATES)[number];

/**
 * The machine-checkable state of a project's acceptance DECISION
 * (`project.acceptanceFixtures`), read from the record as-is. Never a verdict:
 * it reports which of the six states the record is in, so a caller can name the
 * gap without ever claiming a decision the bytes do not carry.
 *
 * `decidedBy` describes the APPROVED rows only, and is `"human"` only when every
 * approved row was stamped by the verified human seat. A mixed or partly-decided
 * set therefore reads as its non-human seat (or `"undecided"`), never as human.
 */
export type FixtureAcceptanceState = {
  state: FixtureAcceptanceStateKind;
  total: number;
  approved: number;
  pending: number;
  decidedBy: FixtureAcceptanceSeat;
};

const NO_FIXTURES: FixtureAcceptanceState = {
  state: "no-fixtures",
  total: 0,
  approved: 0,
  pending: 0,
  decidedBy: "undecided",
};

/**
 * Read the acceptance-decision state from a raw `acceptanceFixtures` value.
 *
 * Total by construction (hostile input ⇒ a named state, never a throw):
 * absent/empty ⇒ `no-fixtures`; a present non-list ⇒ `unreadable` (a malformed
 * record is named, never silently treated as "no fixtures"); any unapproved row
 * ⇒ `pending` (the machine waits on a human, which is not the same failure as
 * `no-fixtures`); every row approved ⇒ `machine-decided` when any was stamped by
 * the autopilot seat, else `unattributed` when any carries no recognizable seat,
 * else `human-approved`. Only `human-approved` satisfies the doctor's fixture
 * term; nothing here can move a record into that state.
 */
export function fixtureAcceptanceState(raw: unknown): FixtureAcceptanceState {
  if (raw === undefined || raw === null) return { ...NO_FIXTURES };
  if (!Array.isArray(raw)) return { ...NO_FIXTURES, state: "unreadable" };
  if (raw.length === 0) return { ...NO_FIXTURES };

  const seats = new Set<FixtureAcceptanceSeat>();
  let approved = 0;
  let pending = 0;
  for (const row of raw) {
    const rec = row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : null;
    if (rec?.approval !== "approved") {
      // A row that is not an approved case is still an undecided case — a
      // malformed row is counted as pending, never dropped.
      pending += 1;
      continue;
    }
    approved += 1;
    const decidedBy = rec.decidedBy;
    if (typeof decidedBy === "string" && (BRIEF_FIXTURE_DECIDED_BY as readonly string[]).includes(decidedBy)) {
      seats.add(decidedBy as FixtureAcceptanceSeat);
    } else {
      seats.add("undecided");
    }
  }

  const machine = seats.has("autopilot");
  const undecided = seats.has("undecided");
  const decidedBy: FixtureAcceptanceSeat = machine ? "autopilot" : undecided ? "undecided" : approved > 0 ? "human" : "undecided";
  const state: FixtureAcceptanceStateKind =
    pending > 0 ? "pending" : machine ? "machine-decided" : undecided ? "unattributed" : "human-approved";
  return { state, total: raw.length, approved, pending, decidedBy };
}

/**
 * The ONE honest sentence for an acceptance-decision state — `null` exactly when
 * the state is `human-approved` (the only state that satisfies the factory bar).
 * The doctor's fixture gap and maker-score's M1/M2 evidence both render this
 * string, so "why is this still false?" has a single answer across surfaces.
 */
export function acceptanceDecisionQuestion(state: FixtureAcceptanceState): string | null {
  switch (state.state) {
    case "human-approved":
      return null;
    case "no-fixtures":
      return "no acceptance fixtures exist — nothing was drafted, so there is no decision to record (draft with `fixtures --draft`); this is an absent bar, not a human keeping the machine waiting";
    case "unreadable":
      return "the acceptance-fixture record is not a list — the decision state cannot be read; fix the record (a malformed record is never an approval)";
    case "pending":
      return `${state.pending} of ${state.total} acceptance fixture(s) await a human decision — the machine door (\`--seat autopilot\`) may not approve them (\`policy.fixtures.approve\` requires a verified human seat); a human decides with \`fixtures --approve --ids … --i-am-human\``;
    case "machine-decided":
      return `${state.approved} acceptance fixture(s) were approved under the autopilot seat — a machine may not set the bar it is graded against; an attributed machine decision is not an acceptance decision, and \`decidedBy:"human"\` is never minted for it`;
    case "unattributed":
      return `${state.approved} acceptance fixture(s) are approved with no recorded decision seat — an approval with no attribution cannot be read as human; re-decide through the seat path so the record names who accepted the bar`;
  }
}

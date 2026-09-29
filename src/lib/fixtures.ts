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
 * Zero dependencies. Deterministic: same inputs → same rows, stable order.
 */

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

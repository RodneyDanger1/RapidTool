// ---------------------------------------------------------------------------
// vault.ts — Obsidian-style "second brain" export for a RapidTool Project.
//
// Turns one Project into an interlinked markdown knowledge base: atomic notes
// per memory row / decision / research-corpus entry / artifact, a phase spine
// (kind "project"), and a hub note (kind "index") whose body is the MOC.
// Pure + deterministic: same Project in ⇒ byte-identical output out (all
// timestamps are derived from project fields; nothing calls Date.now()).
//
// EXACT EXPORT SURFACE (the CLI/UI agents compile against these — do not
// rename, and keep semantics below stable):
//
//   export type VaultNote
//   export type VaultSearchHit = { note: VaultNote; score: number }
//   export function buildVaultNotes(project: Project): VaultNote[]
//   export function vaultMarkdown(notes: VaultNote[]): string
//   export function vaultIndex(notes: VaultNote[]): string
//   export function searchVaultScored(notes: VaultNote[], query: string): VaultSearchHit[]
//   export function searchVault(notes: VaultNote[], query: string): VaultNote[]
//   export function backlinksFor(notes: VaultNote[], title: string): string[]
//   export function dailyNote(project: Project, dateIso?: string): VaultNote
//   export function traceNote(trace: AgentTrace, project: Project): VaultNote
//   export function lessonNote(project: Project, phase: number): VaultNote | null
//   export function lessonNotes(project: Project): VaultNote[]
//
// SEMANTICS (read before consuming):
// - One vault per project. Note set: 1 hub (kind "index"), one phase-spine
//   note per PhaseRecord (kind "project", phase = record id — these are the
//   [[wikilink]] targets of memory↔phase / decision↔phase), every memory row
//   (kind "memory", tags ["memory", kind]), every HitlDecision (kind
//   "decision", tags ["decision", decision]), every ResearchCorpusEntry (kind
//   "research", tags ["research", provider]), and the top 10 artifacts (kind
//   "artifact", tags ["artifact", artifact.kind], body = artifact body
//   verbatim). Artifacts are ranked by recency: the stable tail of
//   project.artifacts (engine appends in production order).
// - `links` holds BARE target titles (no [[ ]] brackets) — resolve directly
//   against note titles; prefix/suffix [[ ]] only when rendering. Wikilinks
//   never dangle: notes only link to notes that exist in the same vault.
// - Titles are unique per vault; collisions get a counter suffix " (2)",
//   " (3)"… applied in first-come order (hub, phase spine, memory, decision,
//   research, artifact). Titles strip chars that would break [[wikilinks]]
//   or YAML-ish frontmatter ([ ] | # " ` and control whitespace).
// - vaultIndex skips kind "index" notes in the grouped lists (a hub never
//   lists itself) and ends with a tag cloud over every note's tags.
// - searchVault/searchVaultScored: token-overlap search over title + body +
//   tags (E-17). Query and note text are word-tokenized and stemmed with the
//   shared algorithms.ts stemmer (tokenizeWords/stemToken, B-15), canonicalized
//   to the stemmer's fixed point so "zebra" and "zebras" agree. Ranking per
//   query token: title token (4) > tag exact (2) > body token (1), summed;
//   a token also matches when it is a PREFIX (>= 3 chars) of a title/body
//   token, so incremental typing stays useful — tags match exactly only.
//   Fixes/106 (H3): two additive refinements over the raw sum — (a) a note
//   whose title/body carries ALL query tokens as a CONTIGUOUS in-order run
//   (a true phrase hit, >= 2 tokens) earns +2 title / +1 body phrase bonus
//   on top of the per-token weights; (b) exact score ties break by recency
//   (updatedAt desc — newer notes first, mirroring the recency bias of
//   Claude Code memory / Codex consolidation, which prunes memories unrecalled
//   for 30 days), then by vault order (stable). Both are pure + deterministic.
//   Ties that survive recency keep vault order (stable sort).
//   Blank query or a query with no word tokens ⇒ []. searchVault is a thin
//   wrapper over searchVaultScored.
// - backlinksFor inverts the link graph (S2): for a bare note title it returns
//   the vault-ordered titles of the notes whose `links` contain it — the
//   Obsidian "Linked from" list. The note itself is never its own backlink
//   (self-links are excluded); unknown titles and empty vaults ⇒ [].
// - dailyNote renders one deterministic "Daily — YYYY-MM-DD" digest note (kind
//   "memory", tags ["memory", "daily"]) over a single UTC day of the project's
//   logs + decision ledger. dateIso is optional and defaults to the project's
//   latest-activity day (newest of createdAt / log ts / decision decidedAt);
//   an unparsable or impossible dateIso falls back to that same default. Pure:
//   no Date.now(), all day math in UTC via toISOString, so the same project
//   always yields the same note. It is standalone (links []) — a consumer that
//   merges it into a built vault owns title de-duplication (see titleTaker).
// - traceNote maps one agent-run trace (AgentTrace from ./tracing.ts, the
//   G-40 wave-3 span model) onto a standalone note (kind "memory", tags
//   ["trace"], links []): summary counts + the spansAsText markdown timeline,
//   so an agent run can be filed into the vault next to its memory rows.
//   Pure — every timestamp derives from the trace itself (no Date.now()).
//   Title "Trace — <runId>"; a consumer merging it into a built vault owns
//   title de-duplication, exactly like dailyNote.
// - lessonNote is the dailyNote-adjacent digest for the self-learning loop
//   (fixes/98 §4.3, L3/L5 human-review surface): ONE deterministic standalone
//   note (kind "memory", tags ["lesson", "p<N>"], links []) summarizing what
//   a single phase taught — its memory rows tagged "lesson", the recorded
//   gate verdict, rejection-history entries, and correction decisions (reject
//   or note-carrying) at that phase. A phase with NO such signal (clean pass,
//   no rows, no rejections) yields null so consumers append only meaningful
//   notes. lessonNotes returns the notes for every signal-bearing phase in
//   phase order. Pure: no Date.now() — updatedAt derives from project fields.
// ---------------------------------------------------------------------------
import { PHASES } from "./phases.ts";
import { stemToken, tokenizeWords } from "./algorithms.ts";
import { formatDurationMs, spansAsText, traceSummary } from "./tracing.ts";
import type { AgentTrace } from "./tracing.ts";
import type { Project } from "./types.ts";

/** Largest epoch ms Date#toISOString can render (±100M days). Timestamps
 *  beyond it (corrupt rows, hostile stores) are treated as invalid, never
 *  passed to toISOString (which would throw RangeError). */
const MAX_EPOCH_MS = 8_640_000_000_000_000;

export type VaultNote = {
  title: string;
  body: string;
  tags: string[];
  links: string[];
  phase?: number;
  updatedAt: number;
  kind: "project" | "memory" | "decision" | "research" | "artifact" | "index";
};

type NoteKind = VaultNote["kind"];

/** Title chars that would break [[wikilinks]] (| # ]) or YAML-ish frontmatter (" newline). */
const TITLE_BAN = /[[\]|#"`\\]/g;

/** C0 control chars + DEL (XML/HTML/markdown-hostile). */
// eslint-disable-next-line no-control-regex
const CONTROL_BAN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

// --- corrupt-store row coercion -------------------------------------------
// The vault is built from store projects that may arrive via export/import
// round-trips or hand edits. Junk rows are coerced/skipped deterministically
// (never a TypeError), mirroring the readStore/hydrateProject stance: valid
// rows pass through byte-identical; only junk changes.

/** String field: non-strings coerce to "" (never a .trim()/.replace crash). */
function strField(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Finite numeric field or undefined (NaN/Infinity/non-numbers are junk). */
function numField(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Epoch-ms field clamped to the ISO-representable range; 0 = invalid. */
function tsField(v: unknown): number {
  const n = numField(v);
  return n !== undefined && n > 0 && n <= MAX_EPOCH_MS ? n : 0;
}

/** Plain-object row guard: null/arrays/scalars are junk (return null). */
function row(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** Collection guard: corrupt stores may hold non-array collections. */
function rowsOf<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/** One-line, link-safe title text: collapse whitespace, drop banned + control
 *  chars, cap length. A title may never carry chars that break [[wikilinks]],
 *  frontmatter double-quoted YAML (quotes AND backslashes), or file systems. */
function cleanTitle(raw: unknown, cap: number): string {
  // Junk row values (undefined/null/non-strings on corrupt rows) coerce to
  // "" → "Untitled" — a title builder never TypeErrors.
  const t = strField(raw)
    .replace(/\s+/g, " ")
    .replace(CONTROL_BAN, "")
    .replace(TITLE_BAN, "")
    .trim();
  const cut = t.length > cap ? `${t.slice(0, cap).trimEnd()}…` : t;
  return cut || "Untitled";
}

/** One safe tag value for frontmatter lists / the tag cloud: free-form strings
 *  (research provider, hand-set row kinds) are collapsed to [A-Za-z0-9_-];
 *  curated union values (memory kinds, decisions, artifact kinds) pass through
 *  unchanged. Never empty. */
function tagClean(raw: unknown, fallback: string): string {
  const t = strField(raw)
    .replace(/\s+/g, "-")
    .replace(CONTROL_BAN, "")
    .replace(/[[\]|,#"`\\]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return t || fallback;
}

/** Unique-title allocator: first come keeps the base title; later ones get " (n)". */
function titleTaker(): (base: string) => string {
  const seen = new Set<string>();
  return (base: string): string => {
    let candidate = base;
    let n = 2;
    while (seen.has(candidate)) {
      candidate = `${base} (${n})`;
      n += 1;
    }
    seen.add(candidate);
    return candidate;
  };
}

/** Deterministic ISO stamp from a project-derived epoch (no Date.now() anywhere). */
function iso(ts?: unknown): string {
  const t = tsField(ts);
  return t > 0 ? new Date(t).toISOString() : "n/a";
}

/** Cap a research source excerpt so one corpus note stays readable. */
function excerpt(content: unknown, cap: number): string {
  // Junk content (undefined/null on corrupt rows) clips to "" — no crash.
  const c = strField(content).replace(/\s+/g, " ").trim();
  if (!c) return "";
  return c.length > cap ? `${c.slice(0, cap).trimEnd()}…` : c;
}

/**
 * Build the full vault for one project: hub index note first, then the phase
 * spine (kind "project"), memory rows, decisions, research corpus entries and
 * the top 10 (most recently produced) artifacts. Fully deterministic.
 */
export function buildVaultNotes(project: Project): VaultNote[] {
  // Corrupt-store collections: non-arrays coerce to [] (never a .map TypeError).
  const phaseList = rowsOf<Project["phases"][number]>(project.phases).filter((r) => row(r) !== null);
  const memoryList = rowsOf<Project["memory"][number]>(project.memory).filter((m) => row(m) !== null);
  const decisionList = rowsOf<Project["decisions"][number]>(project.decisions).filter((d) => row(d) !== null);
  const researchList = rowsOf<NonNullable<Project["research"]>[number]>(project.research).filter(
    (e) => row(e) !== null,
  );
  const artifactList = rowsOf<Project["artifacts"][number]>(project.artifacts).filter((a) => row(a) !== null);

  const createdAt = tsField(project.createdAt);
  const take = titleTaker();

  // Hub title is reserved first so it can never be stolen by a row collision.
  const indexTitle = take(`${cleanTitle(project.name, 64)} · Vault Index`);

  // --- Phase spine (kind "project"): memory↔phase / decision↔phase targets.
  const phaseNotes: VaultNote[] = phaseList.map((rec) => {
    const def = PHASES.find((p) => p.id === rec.id);
    const title = take(`P${rec.id} · ${def?.title ?? `Phase ${rec.id}`}`);
    return {
      title,
      kind: "project" as const,
      tags: ["project", `p${rec.id}`],
      links: [] as string[],
      phase: rec.id,
      updatedAt: tsField(rec.completedAt) || tsField(rec.startedAt) || createdAt,
      body: "", // filled after row titles are final (cluster lists must link them)
    };
  });
  const phaseTitleByPhase = new Map<number, string>();
  for (const pn of phaseNotes) {
    if (pn.phase !== undefined) phaseTitleByPhase.set(pn.phase, pn.title);
  }

  // --- Memory rows (kind "memory", tags ["memory", kind]).
  const memoryNotes: VaultNote[] = memoryList.map((m) => {
    const text = strField(m.text);
    const title = take(cleanTitle(text, 72));
    const kindTag = tagClean(m.kind, "memory");
    const meta: string[] = [`**Kind:** ${strField(m.kind) || "memory"}`, `**Score:** ${m.score}`];
    const phaseTitle = phaseTitleByPhase.get(m.phase);
    const links: string[] = [];
    if (phaseTitle) {
      meta.push(`**Phase:** [[${phaseTitle}]]`);
      links.push(phaseTitle);
    }
    return {
      title,
      kind: "memory" as const,
      tags: ["memory", kindTag],
      links,
      phase: m.phase,
      updatedAt: createdAt,
      body: [`# ${title}`, "", text, "", meta.join(" · ")].join("\n"),
    };
  });

  // --- Decision ledger rows (kind "decision", tags ["decision", decision]).
  const decisionNotes: VaultNote[] = decisionList.map((d) => {
    const title = take(cleanTitle(d.title, 88));
    const phaseTitle = phaseTitleByPhase.get(d.phase);
    const links: string[] = [];
    const head: string[] = [
      `**Decision:** ${strField(d.decision) || "decision"} · **Decided by:** ${strField(d.decidedBy) || "unknown"}`,
    ];
    if (phaseTitle) {
      head.push(`**Phase:** [[${phaseTitle}]]`);
      links.push(phaseTitle);
    }
    const note = strField(d.note);
    const body = [
      `# ${title}`,
      "",
      head.join(" · "),
      `**Requested:** ${iso(d.requestedAt)} · **Decided:** ${iso(d.decidedAt)}`,
      "",
      note.trim() ? note : "_No note recorded._",
    ].join("\n");
    return {
      title,
      kind: "decision" as const,
      tags: ["decision", tagClean(d.decision, "decision")],
      links,
      phase: d.phase,
      updatedAt: tsField(d.decidedAt) || createdAt,
      body,
    };
  });

  // --- Live-research corpus (kind "research", tags ["research", provider]).
  const researchNotes: VaultNote[] = researchList.map((entry) => {
    const title = take(cleanTitle(`Research: ${strField(entry.query)}`, 88));
    const provider = strField(entry.provider) || "unknown";
    const items = rowsOf<NonNullable<typeof entry.items>[number]>(entry.items).filter((it) => row(it) !== null);
    const rows = items.map((it) => {
      const ex = excerpt(it.content, 400);
      const line = `- **${strField(it.title).replace(TITLE_BAN, "")}** — ${strField(it.url)}`;
      return ex ? `${line}\n  ${ex}` : line;
    });
    const body = [
      `# ${title}`,
      "",
      `**Provider:** ${provider} · **Sources:** ${items.length} · **Hub:** [[${indexTitle}]]`,
      "",
      ...rows,
    ].join("\n");
    return {
      title,
      kind: "research" as const,
      tags: ["research", tagClean(provider, "unknown")],
      links: [indexTitle],
      updatedAt: createdAt,
      body,
    };
  });

  // --- Top 10 artifacts: stable tail of project.artifacts (most recent wins).
  const topArtifacts = artifactList.slice(-10);
  const artifactNotes: VaultNote[] = topArtifacts.map((a) => {
    const title = take(cleanTitle(a.title, 88));
    const links: string[] = [];
    const phaseTitle = phaseTitleByPhase.get(a.phase);
    if (phaseTitle) links.push(phaseTitle);
    return {
      title,
      kind: "artifact" as const,
      tags: ["artifact", tagClean(a.kind, "artifact")],
      links,
      phase: a.phase,
      updatedAt: createdAt,
      // Contract: artifact note body IS the artifact body (verbatim).
      body: strField(a.body),
    };
  });

  // --- Phase note bodies: cluster lists of the rows that exist at that phase.
  for (const pn of phaseNotes) {
    const id = pn.phase;
    const memTitles = memoryNotes.filter((n) => n.phase === id).map((n) => n.title);
    const decTitles = decisionNotes.filter((n) => n.phase === id).map((n) => n.title);
    const artTitles = artifactNotes.filter((n) => n.phase === id).map((n) => n.title);
    const rec = phaseList.find((r) => r.id === id);

    const parts: string[] = [`# ${pn.title}`, ""];
    const gate =
      rec?.gate != null
        ? rec.gate.passed
          ? ` · **Gate:** passed${rec.gate.unmet.length ? ` (unmet: ${rec.gate.unmet.join("; ")})` : ""}`
          : ` · **Gate:** failed (unmet: ${rec.gate.unmet.join("; ")})`
        : "";
    parts.push(`**Status:** ${rec?.status ?? "unknown"}${gate}`);
    if (rec?.startedAt || rec?.completedAt) {
      parts.push(
        `**Started:** ${iso(rec?.startedAt)} · **Completed:** ${iso(rec?.completedAt)}`,
      );
    }
    const rejections = rec?.rejectionHistory?.length ?? 0;
    if (rejections > 0) parts.push(`**Rejections:** ${rejections}`);

    pn.links = [...memTitles, ...decTitles, ...artTitles];
    const section = (header: string, rows: string[]): string[] =>
      rows.length
        ? [`### ${header} (${rows.length})`, ...rows.map((t) => `- [[${t}]]`), ""]
        : [];
    const sections = [
      ...section("Memory", memTitles),
      ...section("Decisions", decTitles),
      ...section("Artifacts", artTitles),
    ];
    pn.body = [...parts, "", ...sections].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
  }

  // --- Hub note (kind "index"): links to every other note; body embeds the MOC.
  const others: VaultNote[] = [
    ...phaseNotes,
    ...memoryNotes,
    ...decisionNotes,
    ...researchNotes,
    ...artifactNotes,
  ];
  const indexNote: VaultNote = {
    title: indexTitle,
    kind: "index",
    tags: ["index"],
    links: others.map((n) => n.title),
    updatedAt: createdAt,
    body: "",
  };
  const all: VaultNote[] = [indexNote, ...others];
  const facts: (string | null)[] = [
    `# ${indexTitle}`,
    "",
    strField(project.brief).trim() || "_No brief recorded._",
    "",
    `- **Status:** ${strField(project.status) || "?"} · **Domain:** ${strField(project.domain) || "n/a"}`,
    `- **Current phase:** P${project.currentPhase} · **Model route:** ${strField(project.modelRoute) || "n/a"}`,
    project.scorecard
      ? `- **Feasibility:** ${project.scorecard.overall}/10 — ${project.scorecard.verdict}`
      : null,
    `- **Created:** ${iso(createdAt)} · **Content notes:** ${others.length}`,
    "",
    vaultIndex(all),
  ];
  indexNote.body = facts.filter((f) => f !== null).join("\n");
  return all;
}

// ---------------------------------------------------------------------------
// Link-graph helpers (S2 backlinks + daily digest) — additive, pure.
// ---------------------------------------------------------------------------

/**
 * Invert the vault's link graph (Obsidian-style "Linked from" / backlinks):
 * the vault-ordered titles of every note whose `links` contain `title`.
 * Bare titles in, bare titles out — resolve against note titles exactly like
 * `links`. A note is never its own backlink (self-links are excluded), each
 * backlink title appears once, and unknown/empty input yields [].
 */
export function backlinksFor(notes: VaultNote[], title: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  // W-16: junk rows (null/scalars) and a non-array notes value yield no
  // backlink — the documented "unknown/empty input yields []" must hold for
  // `[null, 5]` too (never throw on foreign input; same row() guard as above).
  if (!Array.isArray(notes)) return out;
  for (const n of notes) {
    const r = row(n);
    if (!r) continue;
    const t = typeof r.title === "string" ? r.title : null;
    if (t === null || t === title) continue; // a note does not link back to itself
    const links = Array.isArray(r.links) ? (r.links as string[]) : [];
    if (links.includes(title) && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/** True for a real calendar day in YYYY-MM-DD (UTC); rejects impossible dates. */
function isRealDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const d = new Date(`${day}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

/** UTC calendar day (YYYY-MM-DD) of an epoch, or null for invalid timestamps. */
function utcDay(ts: unknown): string | null {
  const t = tsField(ts);
  if (t === 0) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/** UTC wall-clock HH:MM:SS of an epoch, or "??:??:??" when the stamp is junk. */
function utcTime(ts: unknown): string {
  const t = tsField(ts);
  return t > 0 ? new Date(t).toISOString().slice(11, 19) : "??:??:??";
}

/**
 * Deterministic default day for dailyNote: the UTC day of the project's newest
 * activity (createdAt, latest log, latest decision). Mirrors the "latest first"
 * spirit of a fresh digest without ever calling Date.now().
 */
function latestActivityDay(project: Project): string {
  let latest = 0;
  const consider = (ts: unknown): void => {
    const t = tsField(ts);
    if (t > latest) latest = t;
  };
  consider(project.createdAt);
  for (const l of rowsOf(project.logs)) {
    const r = row(l);
    if (r) consider(r.ts);
  }
  for (const d of rowsOf(project.decisions)) {
    const r = row(d);
    if (r) consider(r.decidedAt);
  }
  return utcDay(latest) ?? "1970-01-01";
}

/** Collapse a log/decision note to one displayable line (digest courtesy). */
function oneLine(text: unknown, cap: number): string {
  const t = strField(text).replace(/\s+/g, " ").trim();
  return t.length > cap ? `${t.slice(0, cap).trimEnd()}…` : t;
}

/**
 * One deterministic daily-digest note for the project (kind "memory", tags
 * ["memory", "daily"]): title "Daily — YYYY-MM-DD" over a single UTC day,
 * body summarizing that day's JsonLog rows (time, phase, level, event, detail)
 * and HitlDecision rows (time, approve/reject, title, decided-by, note when
 * recorded). `dateIso` selects the day and defaults to the latest-activity day
 * (see latestActivityDay); a malformed or impossible dateIso falls back to the
 * same default. Empty days still produce a well-formed note with "_none_"
 * sections. Pure + standalone: links [], phase undefined, no Date.now() —
 * byte-identical for a fixed project. Consumers merging the note into a built
 * vault own title de-duplication.
 */
export function dailyNote(project: Project, dateIso?: string): VaultNote {
  const day =
    dateIso !== undefined && isRealDay(dateIso) ? dateIso : latestActivityDay(project);
  const title = `Daily — ${day}`;

  const dayLogs = rowsOf<Project["logs"][number]>(project.logs).filter(
    (l) => row(l) !== null && utcDay(l.ts) === day,
  );
  const dayDecisions = rowsOf<Project["decisions"][number]>(project.decisions).filter(
    (d) => row(d) !== null && utcDay(d.decidedAt) === day,
  );

  const logLines = dayLogs.map((l) => {
    const when = utcTime(l.ts);
    const detail = strField(l.detail).trim() ? ` — ${oneLine(l.detail, 200)}` : "";
    return `- ${when} [P${l.phase}] [${strField(l.level) || "?"}] ${strField(l.event)}${detail}`;
  });
  const decisionLines = dayDecisions.map((d) => {
    const when = utcTime(d.decidedAt);
    const note = strField(d.note).trim() ? ` — ${oneLine(d.note, 200)}` : "";
    return `- ${when} ${strField(d.decision)} · ${strField(d.title)} · ${strField(d.decidedBy)}${note}`;
  });

  const body = [
    `# ${title}`,
    "",
    `**Project:** ${strField(project.name) || "Untitled"} · **Status:** ${strField(project.status) || "?"} · **Phase:** P${project.currentPhase}`,
    "",
    `## Log (${dayLogs.length})`,
    ...(logLines.length ? logLines : ["_none_"]),
    "",
    `## Decisions (${dayDecisions.length})`,
    ...(decisionLines.length ? decisionLines : ["_none_"]),
  ].join("\n");

  // updatedAt: newest timestamp the digest actually covers; generated-note
  // convention (createdAt) when the day has no activity of its own.
  let updatedAt = tsField(project.createdAt);
  for (const l of dayLogs) {
    const t = tsField(l.ts);
    if (t > updatedAt) updatedAt = t;
  }
  for (const d of dayDecisions) {
    const t = tsField(d.decidedAt);
    if (t > updatedAt) updatedAt = t;
  }

  return {
    title,
    kind: "memory",
    tags: ["memory", "daily"],
    links: [],
    updatedAt,
    body,
  };
}

// ---------------------------------------------------------------------------
// Agent-run trace note (G-40 wave 3 — additive, pure)
// ---------------------------------------------------------------------------

/**
 * One deterministic vault note for an agent-run trace (the G-40 span model in
 * ./tracing.ts): kind "memory", tags ["trace"], standalone (links [], phase
 * undefined). The body carries the run's summary counts (ok/error/skipped/
 * open, closed-span window) plus the spansAsText markdown timeline, so a
 * traced run can be filed into the vault next to its memory/decision rows.
 * Pure: all timestamps come from the trace itself — no Date.now() — and the
 * same (trace, project) always yields a byte-identical note. updatedAt is the
 * newest instant the trace covers (closed endTs, else startTs, else the
 * trace's startedAt). Consumers merging the note into a built vault own title
 * de-duplication ("Trace — <runId>"), exactly like dailyNote.
 */
export function traceNote(trace: AgentTrace, project: Project): VaultNote {
  const title = cleanTitle(`Trace — ${trace.runId}`, 88);
  const summary = traceSummary(trace);
  const mix = [
    summary.okCount > 0 ? `${summary.okCount} ok` : null,
    summary.errorCount > 0 ? `${summary.errorCount} error` : null,
    summary.skippedCount > 0 ? `${summary.skippedCount} skipped` : null,
    summary.openCount > 0 ? `${summary.openCount} open` : null,
  ].filter((x) => x !== null) as string[];
  const spanLabel =
    summary.spanCount === 0
      ? "0 spans"
      : `${summary.spanCount} spans (${mix.join(" · ")})`;
  const total =
    summary.totalMs === null
      ? summary.spanCount === 0
        ? "—"
        : "in flight"
      : formatDurationMs(summary.totalMs);
  const started = trace.startedAt > 0 ? ` · **Started:** ${iso(trace.startedAt)}` : "";
  const body = [
    `# ${title}`,
    "",
    `**Project:** ${project.name} · **Run:** ${trace.runId} · **Spans:** ${spanLabel} · **Total:** ${total}${started}`,
    "",
    "## Timeline",
    "",
    spansAsText(trace),
  ].join("\n");

  let updatedAt = trace.startedAt;
  for (const s of trace.spans) {
    const ts = s.endTs ?? s.startTs;
    if (ts > updatedAt) updatedAt = ts;
  }
  return {
    title,
    kind: "memory",
    tags: ["trace"],
    links: [],
    updatedAt,
    body,
  };
}

// ---------------------------------------------------------------------------
// Lesson digest (fixes/98 §4.3, L3/L5 human-review surface — additive, pure)
// ---------------------------------------------------------------------------

/** Lesson rows of one phase (the knowledge.ts LESSON_TAG literal — kept
 *  inline so vault.ts stays free of node:fs). Junk rows are skipped. */
function phaseLessonRows(project: Project, phase: number): Project["memory"] {
  return rowsOf<Project["memory"][number]>(project.memory).filter(
    (m) =>
      row(m) !== null &&
      Array.isArray(m.tags) &&
      m.tags.includes("lesson") &&
      m.phase === phase,
  );
}

/**
 * One deterministic standalone digest note for a single phase's lessons —
 * the self-learning loop's dailyNote-adjacent human-review surface
 * (fixes/98 §4.3 + L3/L5 writers): kind "memory", tags ["lesson", "p<N>"],
 * links [] (standalone, exactly like dailyNote/traceNote). Body sections:
 * phase status + recorded gate verdict, the phase's memory rows tagged
 * "lesson" (`[kind score] text`), rejection-history entries, and correction
 * decisions (reject, or any decision carrying a note) at that phase — each
 * section omitted when empty.
 *
 * Returns null when the phase has NOTHING to teach: no lesson rows, a
 * passing (or unrecorded) gate, no rejections, no correction decisions, and
 * a non-rejected status — a clean phase leaves no digest (consumers append
 * only meaningful notes). Pure + deterministic: every timestamp derives from
 * project fields, never Date.now().
 */
export function lessonNote(project: Project, phase: number): VaultNote | null {
  const rec = rowsOf<Project["phases"][number]>(project.phases).find((r) => row(r) !== null && r.id === phase);
  if (!rec) return null;

  const lessonRows = phaseLessonRows(project, phase);
  const rejections = Array.isArray(rec.rejectionHistory) ? rec.rejectionHistory : [];
  const corrections = rowsOf<Project["decisions"][number]>(project.decisions).filter(
    (d) =>
      row(d) !== null &&
      d.phase === phase &&
      (d.decision === "reject" || strField(d.note).trim() !== ""),
  );
  const gate = rec.gate ?? null;
  const gateFailed = gate !== null && gate !== undefined && gate.passed === false;
  const rejected = rec.status === "rejected" || (typeof rec.rejectionNote === "string" && rec.rejectionNote.trim() !== "");

  if (
    lessonRows.length === 0 &&
    !gateFailed &&
    rejections.length === 0 &&
    corrections.length === 0 &&
    !rejected
  ) {
    return null;
  }

  const title = cleanTitle(`Lessons — P${phase}`, 88);
  const createdAt =
    typeof project.createdAt === "number" && Number.isFinite(project.createdAt)
      ? project.createdAt
      : 0;

  // --- Header facts (gate verdict recorded at completion, status, rejections).
  let gateText = "not recorded";
  if (gate !== null && gate !== undefined) {
    gateText = gate.passed
      ? `passed${gate.unmet.length ? ` (unmet: ${gate.unmet.join("; ")})` : ""}`
      : `failed (unmet: ${gate.unmet.join("; ") || "unknown"})`;
  }
  const facts = [
    `# ${title}`,
    "",
    `**Phase:** P${phase} · **Status:** ${rec.status} · **Gate:** ${gateText}`,
  ];
  if (rejections.length > 0) facts.push(`**Rejections:** ${rejections.length}`);

  // --- Lesson rows: provenance-visible `[kind score] text` (packet form).
  const section = (header: string, lines: string[]): string[] =>
    lines.length ? [`### ${header} (${lines.length})`, ...lines, ""] : [];
  const lessonLines = lessonRows.map(
    (m) => `- [${m.kind} ${m.score}] ${oneLine(m.text, 240)}`,
  );
  const rejectionLines = rejections.map(
    (r) => `- ${iso(r.at)} ${oneLine(String(r.note ?? ""), 200)}`,
  );
  const correctionLines = corrections.map((d) => {
    const note = typeof d.note === "string" && d.note.trim() ? ` — ${oneLine(d.note, 200)}` : "";
    return `- ${d.decision} · ${oneLine(d.title, 88)} · ${d.decidedBy}${note}`;
  });

  const body = [
    ...facts,
    "",
    ...section("Lesson rows", lessonLines),
    ...section("Rejections", rejectionLines),
    ...section("Correction decisions", correctionLines),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();

  // --- updatedAt: the newest instant the digest covers (project fields only).
  let updatedAt = createdAt;
  const consider = (ts: number | undefined): void => {
    if (typeof ts === "number" && Number.isFinite(ts) && ts > updatedAt) updatedAt = ts;
  };
  consider(rec.completedAt);
  consider(rec.startedAt);
  if (gate !== null && gate !== undefined) consider(gate.checkedAt);
  for (const r of rejections) consider(r.at);
  for (const d of corrections) consider(d.decidedAt);

  return {
    title,
    kind: "memory",
    tags: ["lesson", `p${phase}`],
    links: [],
    phase,
    updatedAt,
    body,
  };
}

/** Every signal-bearing phase's lesson digest, in phase order (fixes/98). */
export function lessonNotes(project: Project): VaultNote[] {
  const out: VaultNote[] = [];
  for (const rec of project.phases) {
    const note = lessonNote(project, rec.id);
    if (note) out.push(note);
  }
  return out;
}

/**
 * Concatenated vault as one markdown document. Each note is a block of
 * YAML-ish frontmatter (title, kind, tags, phase?, updatedAt) followed by its
 * body, so the export can be split back into per-note units on the
 * /^---\ntitle:/m boundaries (or imported file-by-file into Obsidian).
 */
export function vaultMarkdown(notes: VaultNote[]): string {
  const blocks = notes.map((n) => {
    // YAML double-quoted titles: backslashes AND quotes must be escaped so the
    // frontmatter round-trips exactly (defensive — cleanTitle already strips
    // both from generated titles, but consumers may hand-build notes).
    const fmTitle = n.title
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');
    const fm: string[] = [
      `title: "${fmTitle}"`,
      `kind: ${n.kind}`,
      `tags: [${n.tags.join(", ")}]`,
    ];
    if (n.phase !== undefined) fm.push(`phase: ${n.phase}`);
    fm.push(`updatedAt: ${n.updatedAt}`);
    return `---\n${fm.join("\n")}\n---\n\n${n.body.trim()}`;
  });
  return blocks.join("\n\n") + "\n";
}

const KIND_SECTION: Record<NoteKind, string> = {
  project: "Project",
  memory: "Memory",
  decision: "Decisions",
  research: "Research",
  artifact: "Artifacts",
  index: "Index",
};
const SECTION_ORDER: NoteKind[] = ["project", "memory", "decision", "research", "artifact"];

/**
 * Obsidian-style Map-of-Content markdown over the given notes: grouped lists
 * by kind with [[wikilinks]], plus a tag cloud. Hub notes (kind "index") are
 * never listed — an MOC does not link to itself.
 */
export function vaultIndex(notes: VaultNote[]): string {
  const byKind = new Map<NoteKind, VaultNote[]>();
  for (const kind of SECTION_ORDER) byKind.set(kind, []);
  for (const n of notes) {
    if (n.kind === "index") continue;
    byKind.get(n.kind)?.push(n);
  }

  const parts: string[] = ["## Map of Content", ""];
  for (const kind of SECTION_ORDER) {
    const rows = byKind.get(kind) ?? [];
    parts.push(`### ${KIND_SECTION[kind]} (${rows.length})`);
    if (rows.length === 0) {
      parts.push("_none_");
    } else {
      for (const n of rows) parts.push(`- [[${n.title}]]`);
    }
    parts.push("");
  }

  parts.push("## Tag cloud");
  parts.push("");
  const counts = new Map<string, number>();
  for (const n of notes) {
    for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  if (counts.size === 0) {
    parts.push("_no tags_");
  } else {
    const sorted = [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
    );
    for (const [tag, count] of sorted) parts.push(`- \`#${tag}\` (${count})`);
  }
  return parts.join("\n") + "\n";
}

export type VaultSearchHit = { note: VaultNote; score: number };

/** Per-field weight of one matched query token (E-17: title > tag exact > body). */
const TITLE_TOKEN_WEIGHT = 4;
const TAG_EXACT_WEIGHT = 2;
const BODY_TOKEN_WEIGHT = 1;

/** Fixes/106 (H3): extra weight when ALL query tokens (>= 2) form a contiguous
 *  in-order run in a field — a true phrase hit beats the same tokens scattered
 *  (the ranking refinement the E-17 sum alone cannot express). */
const TITLE_PHRASE_BONUS = 2;
const BODY_PHRASE_BONUS = 1;

/**
 * The B-15 stemmer (stemToken) is single-pass and therefore not idempotent
 * ("zebra" → "zebr" but "zebras" → "zebra"). Search canonicalizes every token
 * to its fixed point so inflectional variants agree ("zebra" ≡ "zebras"),
 * which is what the rest of the product expects from a stemmed overlap.
 */
function canonicalStem(word: string): string {
  let prev = word;
  for (let i = 0; i < 4; i++) {
    const next = stemToken(prev);
    if (next === prev) return next;
    prev = next;
  }
  return prev;
}

/**
 * True when the (stemmed, canonical) query token q matches the (stemmed,
 * canonical) field token c: exact equality, or — for q of >= 3 chars — q
 * prefixes c. Prefix matching keeps incremental search useful ("zeb" →
 * "zebra") without reviving the old cross-word substring behavior ("ebr"
 * matches nothing).
 */
function tokenMatch(q: string, c: string): boolean {
  return q === c || (q.length >= 3 && c.startsWith(q));
}

/** Canonical stemmed word tokens of a text (tokenizeWords → fixed-point stem). */
function stemmedTokens(text: string): string[] {
  return tokenizeWords(text).map(canonicalStem);
}

/** Canonical stemmed, de-duplicated query tokens; [] when none exist. */
function queryTokens(query: string): string[] {
  return [...new Set(stemmedTokens(query))];
}

/**
 * Fixes/106 (H3): longest contiguous in-order run of query tokens inside a
 * field's canonical token sequence, using the same tokenMatch (exact or
 * >= 3-char prefix) relation the per-token weights use. A run that covers ALL
 * query tokens means the note carries the query as an actual phrase — the
 * evidence the per-token sum cannot see ("zebra pricing" adjacent in a title
 * vs scattered across a long body).
 */
function contiguousFieldRun(qTokens: string[], fieldTokens: string[]): number {
  let best = 0;
  for (let i = 0; i < fieldTokens.length; i++) {
    let j = 0;
    while (j < qTokens.length && i + j < fieldTokens.length && tokenMatch(qTokens[j], fieldTokens[i + j])) j++;
    if (j > best) best = j;
  }
  return best;
}

/**
 * Token-overlap search over the vault (E-17), scored and sorted: for every
 * note, each query token that appears in the title (weight 4), matches a tag
 * exactly (weight 2), or appears in the body (weight 1) adds its weight; the
 * note's score is the sum. Fixes/106 (H3) refinements on top of the sum: a
 * full contiguous query run (>= 2 tokens) in the title adds +2 and in the
 * body +1 (phrase hits outrank the same tokens scattered). Hits sort by score
 * desc, then updatedAt desc (recency — newer notes win exact ties), then
 * vault order (Array.prototype.sort is stable, so equal-score-equal-recency
 * notes keep vault order: deterministic, tie-stable).
 * Blank query, or a query with no word tokens, returns [].
 */
export function searchVaultScored(notes: VaultNote[], query: string): VaultSearchHit[] {
  const qTokens = queryTokens(query);
  if (qTokens.length === 0) return [];
  const hits: VaultSearchHit[] = [];
  for (const n of notes) {
    const titleTokens = stemmedTokens(n.title);
    const bodyTokens = stemmedTokens(n.body);
    const tagStems = new Set(n.tags.map(canonicalStem));
    let score = 0;
    for (const q of qTokens) {
      if (titleTokens.some((c) => tokenMatch(q, c))) score += TITLE_TOKEN_WEIGHT;
      if (tagStems.has(q)) score += TAG_EXACT_WEIGHT;
      if (bodyTokens.some((c) => tokenMatch(q, c))) score += BODY_TOKEN_WEIGHT;
    }
    if (score > 0) {
      // Phrase refinement: full contiguous run (>= 2 query tokens) in a field
      // is worth extra weight — an exact-phrase note beats a scattered-token
      // note of equal per-token score. Single-token queries have no run to
      // speak of (every match would be a "run of 1") and stay unboosted.
      if (qTokens.length >= 2) {
        if (contiguousFieldRun(qTokens, titleTokens) === qTokens.length) score += TITLE_PHRASE_BONUS;
        if (contiguousFieldRun(qTokens, bodyTokens) === qTokens.length) score += BODY_PHRASE_BONUS;
      }
      hits.push({ note: n, score });
    }
  }
  hits.sort((a, b) => b.score - a.score || b.note.updatedAt - a.note.updatedAt);
  return hits;
}

/**
 * Token-overlap search returning just the matching notes, ranked (E-17).
 * Thin wrapper over searchVaultScored — consumers that need the ranking use
 * the scored variant directly.
 */
export function searchVault(notes: VaultNote[], query: string): VaultNote[] {
  return searchVaultScored(notes, query).map((h) => h.note);
}

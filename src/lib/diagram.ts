// ---------------------------------------------------------------------------
// Deterministic standalone SVG diagrams — src/lib/diagram.ts
//
// buildDiagram(project, kind) renders a COMPLETE, self-contained SVG 1.1
// document (xmlns + viewBox, dark-theme palette via presentation attributes,
// system font stack only — no external fonts, images, CSS or JS) for one of
// three views:
//
//   "phases"       — the 13-node pipeline P0..P12: per-phase visual status
//                    (complete/current/ready/locked/blocked/awaiting_hitl)
//                    with distinct fills + a legend, arrows for the legal
//                    Pn → Pn+1 edges, HITL gate phases marked with diamonds.
//   "architecture" — artifact map: every project.artifact box (colored by
//                    kind) laid out in deterministic phase bands, plus a
//                    "specification layer" strip derived from the project's
//                    contract/openapi/adr fields (the artifact kinds in the
//                    domain model are the 16 ArtifactKind values; docs live
//                    on Project.*, so the strip is drawn from those fields).
//   "flow"         — the current phase's gate path flowchart (handoff → gate
//                    decision → approve/seal/advance or reject/revise/retry)
//                    with the node matching the project's live status
//                    highlighted.
//
// Guarantees: pure & deterministic (same Project ⇒ byte-identical output, no
// Date/Math.random, no Map iteration order in layout), XML-safe (every label
// is escaped and control-character-stripped; coordinates are finite-rounded
// integers so NaN/Infinity can never leak into attributes), defensive against
// sparse/malformed phase or artifact arrays, zero dependencies.
//
// Run: node --experimental-strip-types --test src/lib/diagram.test.ts
// ---------------------------------------------------------------------------
import { PHASES } from "./phases.ts";
import type { Artifact, ArtifactKind, PhaseId, Project } from "./types.ts";

// --- public vocabulary ------------------------------------------------------

export type DiagramKind = "phases" | "architecture" | "flow";
export const DIAGRAM_KINDS: readonly DiagramKind[] = ["phases", "architecture", "flow"];

/**
 * Statuses a phase box can visually take in the pipeline diagram. Derived from
 * the phase record AND project-level state (blocked paints every unsealed
 * phase; the current phase is highlighted even when its record only says
 * "ready"). "rejected" records read as "current" (the phase is back in work).
 */
export type PhaseVisualStatus =
  "complete" | "current" | "ready" | "locked" | "blocked" | "awaiting_hitl";

export type KindBoxTheme = { fill: string; stroke: string };

export const THEME = {
  bg: "#0d1117",
  divider: "#1c2129",
  bright: "#e6edf3",
  text: "#c9d1d9",
  dim: "#8b949e",
  faint: "#6e7681",
  arrow: "#3a4351",
  /** HITL gate marker / decision-gate accent. */
  hitl: "#d2a8ff",
  /** Active-path highlight (flow flowchart) / legend accent. */
  highlight: "#ffd33d",
} as const;

/** Fill/stroke/text per phase visual status — all dark-theme friendly. */
export const STATUS_THEME: Record<PhaseVisualStatus, KindBoxTheme & { text: string }> = {
  complete: { fill: "#0d2f1c", stroke: "#3fb950", text: "#7ee787" },
  current: { fill: "#33280a", stroke: "#f5a623", text: "#ffd9a0" },
  ready: { fill: "#0e2233", stroke: "#58a6ff", text: "#c9d1d9" },
  locked: { fill: "#10151c", stroke: "#2d333b", text: "#6e7681" },
  blocked: { fill: "#331315", stroke: "#f85149", text: "#ffa198" },
  awaiting_hitl: { fill: "#241235", stroke: "#d2a8ff", text: "#e6c9ff" },
};

/** Fill/stroke per artifact kind (all 16 members of ArtifactKind). */
export const KIND_THEME: Record<ArtifactKind, KindBoxTheme> = {
  scorecard: { fill: "#101f33", stroke: "#58a6ff" },
  graph: { fill: "#1d1430", stroke: "#bc8cff" },
  memory: { fill: "#2a1230", stroke: "#f778ba" },
  mcp: { fill: "#0d2a30", stroke: "#39c5cf" },
  security: { fill: "#2a1113", stroke: "#f85149" },
  validation: { fill: "#0d2a16", stroke: "#3fb950" },
  code: { fill: "#0d2f1e", stroke: "#7ee787" },
  research: { fill: "#2d1d0c", stroke: "#ffa657" },
  ui: { fill: "#2f2608", stroke: "#ffd33d" },
  cicd: { fill: "#1c1430", stroke: "#a371f7" },
  edge: { fill: "#332a08", stroke: "#e3b341" },
  tools: { fill: "#331313", stroke: "#ff7b72" },
  docs: { fill: "#151b22", stroke: "#8b949e" },
  packet: { fill: "#2d2005", stroke: "#d29922" },
  algorithm: { fill: "#0d1d33", stroke: "#79c0ff" },
  gate: { fill: "#331d0d", stroke: "#db6d28" },
};

/** Fallback theme for unknown/runtime-garbage artifact kinds. */
export const UNKNOWN_KIND_THEME: KindBoxTheme = { fill: "#161b22", stroke: "#6e7681" };

/** Theme for the specification-layer boxes derived from Project fields. */
export const DOC_THEME: Record<string, KindBoxTheme> = {
  contract: { fill: "#0d2a30", stroke: "#39c5cf" },
  openapi: { fill: "#101f33", stroke: "#58a6ff" },
  adr: { fill: "#1d1430", stroke: "#bc8cff" },
};

export function kindTheme(kind: string): KindBoxTheme {
  return (KIND_THEME as Record<string, KindBoxTheme | undefined>)[kind] ?? UNKNOWN_KIND_THEME;
}

// --- tiny XML / geometry helpers --------------------------------------------

const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c]);
}

/** Single-line safe label: strip control chars, collapse whitespace, clamp. */
function label(s: string, max: number): string {
  const clean = Array.from(String(s ?? ""))
    .map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? " " : ch))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  const cap = Math.max(2, max);
  return clean.length <= cap ? clean : `${clean.slice(0, cap - 1)}…`;
}

/** Finite-rounded integer for attributes; NaN/Infinity can never leak out. */
function N(v: number): string {
  const r = Math.round(v);
  return Number.isFinite(r) ? String(r) : "0";
}

function text(
  x: number,
  y: number,
  s: string,
  max: number,
  o: {
    size?: number;
    fill?: string;
    weight?: number;
    anchor?: "start" | "middle" | "end";
    opacity?: number;
  } = {},
): string {
  const size = o.size ?? 10;
  const fill = o.fill ?? THEME.text;
  const anchor = o.anchor ?? "start";
  return (
    `<text x="${N(x)}" y="${N(y)}" font-size="${String(size)}" fill="${fill}"` +
    (o.weight !== undefined ? ` font-weight="${o.weight}"` : "") +
    (anchor !== "start" ? ` text-anchor="${anchor}"` : "") +
    (o.opacity !== undefined ? ` opacity="${String(o.opacity)}"` : "") +
    `>${esc(label(s, max))}</text>`
  );
}

function rectEl(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  o: { sw?: number; extra?: string } = {},
): string {
  const sw = o.sw ?? 1.25;
  return (
    `<rect x="${N(x)}" y="${N(y)}" width="${N(w)}" height="${N(h)}" rx="6"` +
    ` fill="${fill}" stroke="${stroke}" stroke-width="${String(sw)}"` +
    (o.extra ?? "") +
    "/>"
  );
}

function lineEl(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  marker: string,
  color = THEME.arrow,
): string {
  return (
    `<line x1="${N(x1)}" y1="${N(y1)}" x2="${N(x2)}" y2="${N(y2)}"` +
    ` stroke="${color}" stroke-width="1.25" marker-end="url(#${marker})"/>`
  );
}

function pathEl(
  d: string,
  o: { color?: string; sw?: number; dash?: string; marker?: string } = {},
): string {
  const color = o.color ?? THEME.arrow;
  const sw = o.sw ?? 1.25;
  return (
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${String(sw)}"` +
    (o.dash ? ` stroke-dasharray="${o.dash}"` : "") +
    (o.marker ? ` marker-end="url(#${o.marker})"` : "") +
    "/>"
  );
}

function svgDoc(w: number, h: number, title: string, body: string, defs = ""): string {
  const t = esc(label(title, 160));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${N(w)}" height="${N(h)}"` +
    ` viewBox="0 0 ${N(w)} ${N(h)}" role="img" aria-label="${t}"` +
    ` font-family="ui-sans-serif, system-ui, 'Segoe UI', sans-serif">\n` +
    `<title>${t}</title>\n` +
    `<rect x="0" y="0" width="${N(w)}" height="${N(h)}" fill="${THEME.bg}"/>` +
    (defs ? `\n${defs}` : "") +
    `\n${body}\n</svg>\n`
  );
}

function phaseNum(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  const t = Math.trunc(n);
  return Math.min(12, Math.max(0, t));
}

function codeOf(id: number): string {
  const def = id >= 0 && id <= 12 ? PHASES[id] : undefined;
  return def ? def.code : `P${id}`;
}

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function artifactSortKey(a: Artifact): [number, string, string, string] {
  const ph = Number(a.phase);
  const band = Number.isFinite(ph) ? Math.trunc(ph) : 99;
  return [band, String(a.kind), String(a.title), String(a.id)];
}

function phaseRecord(project: Project, id: number): { id: number; status: string } | undefined {
  return (project.phases ?? []).find((r) => Number(r.id) === id);
}

/**
 * Resolve the visual status of one phase from the project state. Ordering is
 * intentional and documented: a sealed phase stays "complete" even on a
 * blocked project; project-level "blocked" paints every unsealed phase
 * (engine parity: a rejected record lives under status "blocked", so the
 * red state is project-scoped); an awaiting record wins over the bare
 * current-phase highlight; "rejected"/"running" records and the current
 * phase read as "current"; any other "ready" record is "ready".
 */
export function resolvePhaseStatus(project: Project, phase: PhaseId): PhaseVisualStatus {
  const rec = phaseRecord(project, phase);
  const st = rec?.status;
  if (st === "complete") return "complete";
  if (project.status === "blocked") return "blocked";
  if (st === "awaiting_hitl") return "awaiting_hitl";
  if (st === "running" || st === "rejected" || phase === project.currentPhase) return "current";
  if (st === "ready") return "ready";
  return "locked";
}

// --- kind: "phases" — 13-node pipeline --------------------------------------

const PIPE_COLS = 7;
const PIPE = {
  pad: 26,
  pitch: 192,
  bw: 156,
  bh: 58,
  row1Y: 96,
  rowGap: 66,
  width: 2 * 26 + (PIPE_COLS - 1) * 192 + 156, // 1360
};

function pipeX(col: number): number {
  return PIPE.pad + col * PIPE.pitch;
}

/**
 * Row/column placement per phase id: row 1 hosts P0..P6 left→right, row 2
 * hosts P7..P12 left→right (col = id - 7) so the whole pipeline reads L→R.
 */
function pipeSlot(id: number): { col: number; y: number } {
  const row = id <= 6 ? 0 : 1;
  const col = row === 0 ? id : id - 7;
  return { col, y: PIPE.row1Y + row * (PIPE.bh + PIPE.rowGap) };
}

/** Complete standalone SVG of the P0..P12 pipeline with statuses + legend. */
export function buildPhasesDiagram(project: Project): string {
  const sealed = PHASES.filter((f) => resolvePhaseStatus(project, f.id) === "complete").length;
  const hitlCount = PHASES.filter((f) => f.hitl).length;
  const rows = PIPE.row1Y + PIPE.bh + PIPE.rowGap + PIPE.bh; // row 2 bottom edge
  const legendY = rows + 26;
  const H = legendY + 24;

  const title = `${label(project.name, 64)} — phase pipeline`;
  const sub =
    `P0 → P12 · status ${project.status} · ${sealed}/${PHASES.length} sealed · ` +
    `${hitlCount} HITL gates`;

  const marker = `<defs><marker id="dg-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${THEME.arrow}"/></marker></defs>`;

  const parts: string[] = [];
  parts.push(text(26, 30, title, 70, { size: 15, fill: THEME.bright, weight: 700 }));
  parts.push(text(26, 50, sub, 150, { size: 10.5, fill: THEME.dim }));

  // Edges: legal moves are strictly Pn → Pn+1 (phases.canEnter), so arrows
  // connect consecutive ids. Within a row the arrow is horizontal; the P6→P7
  // wrap is a two-corner elbow dropping into row 2.
  for (let i = 0; i < PHASES.length - 1; i++) {
    const a = pipeSlot(i);
    const b = pipeSlot(i + 1);
    if (a.y === b.y) {
      const y = a.y + PIPE.bh / 2;
      parts.push(lineEl(pipeX(a.col) + PIPE.bw, y, pipeX(b.col), y, "dg-a"));
    } else {
      const xa = pipeX(a.col) + PIPE.bw / 2;
      const xb = pipeX(b.col) + PIPE.bw / 2;
      const midY = a.y + PIPE.bh + 33;
      parts.push(
        pathEl(`M${N(xa)},${N(a.y + PIPE.bh)} V${N(midY)} H${N(xb)} V${N(b.y)}`, {
          marker: "dg-a",
        }),
      );
    }
  }

  // Phase boxes (drawn after arrows so they sit on top), status fills first.
  for (const def of PHASES) {
    const { col, y } = pipeSlot(def.id);
    const x = pipeX(col);
    const cx = x + PIPE.bw / 2;
    const st = resolvePhaseStatus(project, def.id);
    const th = STATUS_THEME[st];
    parts.push(
      rectEl(x, y, PIPE.bw, PIPE.bh, th.fill, th.stroke, { extra: ` data-state="${st}"` }),
    );
    parts.push(
      text(cx, y + 23, def.code, 8, { size: 12, fill: th.text, weight: 700, anchor: "middle" }),
    );
    parts.push(
      text(cx, y + 41, def.title, 27, {
        size: 9,
        fill: st === "locked" ? THEME.faint : THEME.text,
        anchor: "middle",
      }),
    );
    if (def.hitl) {
      parts.push(
        `<polygon points="${N(cx)},${N(y - 19)} ${N(cx + 9)},${N(y - 10)} ${N(cx)},${N(y - 1)} ${N(cx - 9)},${N(y - 10)}"` +
          ` fill="${THEME.hitl}" stroke="${THEME.bright}" stroke-width="1" data-hitl="true"/>`,
      );
    }
  }

  // Legend: one swatch per visual status + the HITL diamond.
  const order: PhaseVisualStatus[] = [
    "complete",
    "current",
    "ready",
    "locked",
    "blocked",
    "awaiting_hitl",
  ];
  let lx = 26;
  for (const st of order) {
    const th = STATUS_THEME[st];
    parts.push(rectEl(lx, legendY - 10, 10, 10, th.fill, th.stroke));
    parts.push(text(lx + 16, legendY, st, 20, { size: 9.5, fill: THEME.dim }));
    lx += 122;
  }
  parts.push(
    `<polygon points="${N(lx + 5)},${N(legendY - 19)} ${N(lx + 14)},${N(legendY - 10)} ${N(lx + 5)},${N(legendY - 1)} ${N(lx - 4)},${N(legendY - 10)}"` +
      ` fill="${THEME.hitl}" stroke="${THEME.bright}" stroke-width="1"/>`,
  );
  parts.push(text(lx + 21, legendY, "HITL gate", 20, { size: 9.5, fill: THEME.dim }));

  return svgDoc(PIPE.width, H, title, parts.join("\n"), marker);
}

// --- kind: "architecture" — artifact map by phase bands ---------------------

const ARCH = {
  pad: 20,
  labelW: 96,
  boxX: 128,
  boxW: 168,
  boxH: 34,
  pitch: 182,
  perRow: 4,
  rowH: 48,
  top: 84,
  cap: 72,
  width: 862,
};

function archBox(
  x: number,
  y: number,
  title: string,
  sub: string,
  th: KindBoxTheme,
  extra = "",
): string {
  return [
    rectEl(x, y, ARCH.boxW, ARCH.boxH, th.fill, th.stroke, { extra }),
    text(x + 8, y + 15, title, 24, { size: 9.5, fill: THEME.text, weight: 600 }),
    text(x + 8, y + 27, sub, 30, { size: 7.5, fill: th.stroke }),
  ].join("\n");
}

/** Derived specification-layer entries from Project fields (not artifacts). */
function docEntries(project: Project): { kind: string; title: string; sub: string }[] {
  const out: { kind: string; title: string; sub: string }[] = [];
  const c = project.contracts;
  if (c && Array.isArray(c.entities)) {
    out.push({
      kind: "contract",
      title: "Data contract",
      sub: `${c.entities.length} entities · ${(c.endpoints ?? []).length} endpoints`,
    });
  }
  if (typeof project.openapi === "string" && project.openapi.trim().length > 0) {
    out.push({
      kind: "openapi",
      title: "OpenAPI spec",
      sub: project.openapi.includes("3.1.0") ? "3.1.0 declared" : "declared",
    });
  }
  if (typeof project.adr === "string" && project.adr.trim().length > 0) {
    const n = (project.adr.match(/ADR-\d+/g) ?? []).length;
    out.push({ kind: "adr", title: "ADR trail", sub: `${n} record${n === 1 ? "" : "s"}` });
  }
  return out;
}

/** Complete standalone SVG artifact map grouped into deterministic phase bands. */
export function buildArchitectureDiagram(project: Project): string {
  const all = (project.artifacts ?? []).slice().sort((a, b) => {
    const [pa, ka, ta, ia] = artifactSortKey(a);
    const [pb, kb, tb, ib] = artifactSortKey(b);
    return pa - pb || cmpStr(ka, kb) || cmpStr(ta, tb) || cmpStr(ia, ib);
  });

  // Band the sorted artifacts by phase, keeping deterministic order.
  const bands: { id: number; items: Artifact[] }[] = [];
  for (const a of all) {
    const ph = artifactSortKey(a)[0];
    const last = bands[bands.length - 1];
    if (last && last.id === ph) last.items.push(a);
    else bands.push({ id: ph, items: [a] });
  }

  const title = `${label(project.name, 64)} — architecture`;
  const noun = all.length === 1 ? "artifact" : "artifacts";
  const pnoun = bands.length === 1 ? "phase" : "phases";
  const sub =
    all.length > 0
      ? `${all.length} ${noun} across ${bands.length} ${pnoun} · box color = kind`
      : "no artifacts yet";

  const parts: string[] = [];
  parts.push(text(20, 30, title, 80, { size: 15, fill: THEME.bright, weight: 700 }));
  parts.push(text(20, 50, sub, 160, { size: 10.5, fill: THEME.dim }));

  let cursor = ARCH.top;
  let drawn = 0;
  const bandLayout: { id: number; yTop: number; rows: number }[] = [];

  // Reserve rows per band (up to the box cap) so heights are stable.
  for (const band of bands) {
    const take = Math.min(band.items.length, ARCH.cap - drawn);
    const rows = Math.max(0, Math.ceil(take / ARCH.perRow));
    bandLayout.push({ id: band.id, yTop: cursor, rows });
    cursor += rows * ARCH.rowH;
    drawn += take;
  }
  const skipped = all.length - drawn;

  if (bands.length === 0) {
    parts.push(
      text(ARCH.boxX, cursor + 24, "No artifacts yet — run phases to populate this map.", 90, {
        size: 10.5,
        fill: THEME.dim,
      }),
    );
    cursor += ARCH.rowH;
  }

  // Draw artifact boxes band by band (honoring the shared 72-box cap so the
  // layout rows reserved above and the boxes actually drawn always agree).
  let drawnCount = 0;
  for (const band of bands) {
    const layout = bandLayout.find((b) => b.id === band.id)!;
    for (let i = 0; i < band.items.length && drawnCount < ARCH.cap; i++, drawnCount++) {
      const a = band.items[i];
      const r = Math.floor(i / ARCH.perRow);
      const c = i % ARCH.perRow;
      const x = ARCH.boxX + c * ARCH.pitch;
      const y = layout.yTop + r * ARCH.rowH + 7;
      const th = kindTheme(String(a.kind));
      parts.push(
        archBox(
          x,
          y,
          String(a.title),
          String(a.kind),
          th,
          ` data-phase="${String(artifactSortKey(a)[0])}" data-kind="${esc(String(a.kind))}"`,
        ),
      );
    }
  }

  // Band labels live in the fixed label column, vertically centered per band.
  // Bands with rows === 0 are fully past the shared box cap: no rows were
  // reserved for them, so drawing the label there would stack it on the
  // previous band's cursor position (the +N overflow note explains the rest).
  for (const b of bandLayout) {
    if (b.rows === 0) continue;
    const mid = b.yTop + (b.rows * ARCH.rowH) / 2;
    const def = b.id >= 0 && b.id <= 12 ? PHASES[b.id] : undefined;
    parts.push(
      text(ARCH.pad + ARCH.labelW / 2, mid - 2, def ? def.code : `P${b.id}`, 8, {
        size: 10.5,
        fill: THEME.bright,
        weight: 700,
        anchor: "middle",
      }),
    );
    parts.push(
      text(ARCH.pad + ARCH.labelW / 2, mid + 10, def ? def.title : "", 15, {
        size: 7,
        fill: THEME.faint,
        anchor: "middle",
      }),
    );
  }

  if (skipped > 0) {
    parts.push(
      text(
        ARCH.boxX,
        cursor + 24,
        `+${skipped} more artifact${skipped === 1 ? "" : "s"} not shown (cap ${ARCH.cap})`,
        90,
        {
          size: 9.5,
          fill: THEME.faint,
        },
      ),
    );
    cursor += ARCH.rowH;
  }

  // Specification layer strip (derived from Project fields when present).
  const docs = docEntries(project);
  let H = cursor + 16;
  if (docs.length > 0) {
    const specTop = cursor + 6;
    parts.push(
      text(ARCH.boxX, specTop + 12, "Specification layer — derived from project fields", 90, {
        size: 8,
        fill: THEME.faint,
      }),
    );
    const y = specTop + 22;
    for (let i = 0; i < docs.length; i++) {
      const d = docs[i];
      parts.push(
        archBox(
          ARCH.boxX + i * ARCH.pitch,
          y,
          d.title,
          d.sub,
          DOC_THEME[d.kind] ?? UNKNOWN_KIND_THEME,
          ` data-kind="${esc(d.kind)}"`,
        ),
      );
    }
    H = y + ARCH.boxH + 16;
  }

  return svgDoc(ARCH.width, H, title, parts.join("\n"));
}

// --- kind: "flow" — current phase gate-path flowchart -----------------------

type FlowNodeKey = "handoff" | "run" | "gate" | "approve" | "sealed" | "reject";

const FLOW = { width: 880, rightX: 570, rightW: 280 };

/**
 * Which flowchart node is live for the project right now, plus a one-line
 * human reason. Resolution is deterministic and mirrors resolvePhaseStatus:
 * sealed record → seal node; awaiting record/project → the gate diamond;
 * rejected record or blocked project → reject node; running → execute;
 * otherwise the phase is parked at handoff.
 */
export function resolveFlowHighlight(project: Project): { node: FlowNodeKey; reason: string } {
  const cur = phaseNum(project.currentPhase, 0);
  const rec = phaseRecord(project, cur);
  const code = codeOf(cur);
  const st = rec?.status;
  if (st === "complete") {
    return {
      node: "sealed",
      reason:
        project.status === "complete"
          ? "pipeline complete — all 13 phases sealed"
          : `${code} sealed — ready to advance`,
    };
  }
  if (st === "awaiting_hitl" || project.status === "awaiting_hitl") {
    return { node: "gate", reason: "human review pending at the gate" };
  }
  if (st === "rejected") {
    return { node: "reject", reason: "blocked after rejection — relaunch to retry" };
  }
  if (project.status === "blocked") {
    return { node: "reject", reason: "project blocked — intervention required" };
  }
  if (st === "running" || project.status === "running") {
    return { node: "run", reason: "executing — synthesize + self-test in flight" };
  }
  return { node: "handoff", reason: "DoR met — ready to execute" };
}

/** Complete standalone SVG flowchart of the current phase's gate path. */
export function buildFlowDiagram(project: Project): string {
  const cur = phaseNum(project.currentPhase, 0);
  const def = PHASES[cur];
  const code = def.code;
  const next = cur < 12 ? PHASES[cur + 1] : null;
  const hl = resolveFlowHighlight(project);

  const title = `${label(project.name, 64)} — gate flow`;
  const sub = `${code} · ${label(def.title, 78)} — ${hl.reason}`;

  const defs =
    `<defs><marker id="dg-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" fill="${THEME.arrow}"/></marker>` +
    `<marker id="dg-r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" fill="#f85149"/></marker></defs>`;

  const body: string[] = [];

  // Header + status chip (right-aligned).
  body.push(text(20, 28, title, 64, { size: 15, fill: THEME.bright, weight: 700 }));
  body.push(text(20, 47, sub, 140, { size: 10, fill: THEME.dim }));
  const chipText = `${project.status ?? ""} · ${code}`;
  // Measure the CLAMPED label, never the raw status: text() truncates at 40
  // chars, so a hostile multi-hundred-char status would otherwise size the
  // chip rect from the full string and shove it off-canvas (x < 0).
  const chipLabel = label(chipText, 40);
  const chipW = Math.round(chipLabel.length * 6.4) + 26;
  const chipX = FLOW.width - 24 - chipW;
  const chipSt =
    project.status === "blocked"
      ? "#f85149"
      : project.status === "awaiting_hitl"
        ? THEME.hitl
        : project.status === "complete"
          ? "#3fb950"
          : THEME.arrow;
  body.push(rectEl(chipX, 12, chipW, 24, "#10151c", chipSt, { extra: ` data-node="chip"` }));
  body.push(
    text(chipX + chipW / 2, 28, chipLabel, 40, {
      size: 10.5,
      fill: THEME.text,
      weight: 600,
      anchor: "middle",
    }),
  );

  // 1) handoff → 2) execute → 3) gate diamond (top-down spine at x=260).
  const box = (
    key: FlowNodeKey,
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    stroke: string,
    t: string,
  ) => {
    const active = hl.node === key;
    const extra = ` data-node="${key}"` + (active ? ` data-highlight="true"` : "");
    return (
      rectEl(x, y, w, h, active ? "#1c1608" : fill, active ? THEME.highlight : stroke, {
        sw: active ? 2.4 : 1.25,
        extra,
      }) +
      "\n" +
      text(x + w / 2, y + h / 2 + 4, t, 44, {
        size: 10.5,
        fill: active ? THEME.highlight : THEME.text,
        weight: 600,
        anchor: "middle",
      })
    );
  };

  body.push(box("handoff", 110, 64, 300, 46, "#10151c", "#30363d", `Handoff — ${code} ready`));
  body.push(lineEl(260, 110, 260, 150, "dg-a"));
  body.push(
    box("run", 110, 150, 300, 46, "#10151c", "#58a6ff", "Execute — synthesize & self-test"),
  );
  body.push(lineEl(260, 196, 260, 244, "dg-a"));

  // Gate diamond — human when the phase carries an HITL gate (def.hitl).
  const gx = 260;
  const gy = 300;
  const dx = 130;
  const dy = 56;
  const gateActive = hl.node === "gate";
  const gateTxt = def.hitl ? ["DoD + HITL gate", "human decision"] : ["DoD gate", "machine checks"];
  const gateExtra = ` data-node="gate"` + (gateActive ? ` data-highlight="true"` : "");
  body.push(
    `<polygon points="${N(gx)},${N(gy - dy)} ${N(gx + dx)},${N(gy)} ${N(gx)},${N(gy + dy)} ${N(gx - dx)},${N(gy)}"` +
      ` fill="${gateActive ? "#1c1608" : "#10151c"}" stroke="${gateActive ? THEME.highlight : THEME.hitl}"` +
      ` stroke-width="${gateActive ? "2.4" : "1.25"}"${gateExtra}/>`,
  );
  body.push(
    text(gx, gy - 4, gateTxt[0], 24, {
      size: 9.5,
      fill: gateActive ? THEME.highlight : THEME.text,
      anchor: "middle",
    }),
  );
  body.push(text(gx, gy + 13, gateTxt[1], 24, { size: 8.5, fill: THEME.dim, anchor: "middle" }));

  // 4) approve branch (right) → seal/advance; 5) reject branch (down) → retry loop.
  body.push(lineEl(gx + dx, gy, FLOW.rightX, gy, "dg-a"));
  body.push(
    box(
      "approve",
      FLOW.rightX,
      258,
      FLOW.rightW,
      44,
      "#10151c",
      "#3fb950",
      `Approve — seal ${code}`,
    ),
  );
  body.push(lineEl(FLOW.rightX + FLOW.rightW / 2, 302, FLOW.rightX + FLOW.rightW / 2, 348, "dg-a"));
  body.push(
    box(
      "sealed",
      FLOW.rightX,
      348,
      FLOW.rightW,
      44,
      "#10151c",
      "#30363d",
      next ? `Advance → ${next.code} handoff` : "All phases sealed — done",
    ),
  );
  body.push(lineEl(gx, gy + dy, gx, 400, "dg-a"));
  body.push(box("reject", 150, 400, 220, 40, "#10151c", "#f85149", "Reject → revise & retry"));
  // Retry loop: reject node left edge → up the left corridor → back into execute.
  body.push(pathEl(`M150,420 H64 V173 H110`, { color: "#f85149", dash: "5 4", marker: "dg-r" }));

  // Bottom legend: active-path + retry-loop samples.
  const ly = 462;
  body.push(rectEl(26, ly - 10, 10, 10, "#1c1608", THEME.highlight, { sw: 2.4 }));
  body.push(text(42, ly, "active path", 20, { size: 9, fill: THEME.dim }));
  body.push(pathEl(`M150,${ly} H186`, { color: "#f85149", dash: "5 4" }));
  body.push(text(196, ly, "retry loop", 20, { size: 9, fill: THEME.dim }));

  return svgDoc(FLOW.width, 478, title, body.join("\n"), defs);
}

// --- entry point -------------------------------------------------------------

/**
 * Render a complete standalone SVG for the requested diagram kind.
 * Deterministic: the same Project always produces the byte-identical string.
 * Throws on an unknown kind (defensive — never silently returns a wrong view).
 */
export function buildDiagram(project: Project, kind: DiagramKind): string {
  if (!DIAGRAM_KINDS.includes(kind)) {
    throw new Error(`Unknown diagram kind: ${String(kind)}`);
  }
  if (kind === "phases") return buildPhasesDiagram(project);
  if (kind === "architecture") return buildArchitectureDiagram(project);
  return buildFlowDiagram(project);
}

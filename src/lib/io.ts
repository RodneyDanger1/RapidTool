// ---------------------------------------------------------------------------
// Project import/export + packet file export (pure, unit-tested) — io.ts
//
// The only serialization boundary for a Project: exportProjectJson turns a
// live project into a stable JSON string, importProject parses + shape-validates
// + hydrates (repair) a JSON string back into a usable project, and the packet
// helpers produce the paste-ready Agent Packet as a downloadable file.
//
// These are pure functions: no store, no DOM, no side effects — so they can be
// exercised under `node --experimental-strip-types --test src/lib/io.test.ts`.
//
// Import: hydration delegates to engine.hydrateProject so an imported project
// gets exactly the same repair pass (B-25/R9: per-id phase repair, missing
// array defaults, _v:2 marker) that persisted localStorage state receives.
// ---------------------------------------------------------------------------
import { hydrateProject } from "./engine.ts";
import type { Project } from "./types.ts";
import { coerceAcceptanceFixtures } from "./brief-fixtures.ts";

export type ImportResult =
  | { ok: true; project: Project }
  | { ok: false; error: string; code?: string };

/** The pipeline always has exactly 13 phase records (P0..P12). */
export const PHASE_COUNT = 13;

/**
 * H4: hard cap on import payload size (chars). A hostile or corrupt import
 * string is refused BEFORE JSON.parse so a multi-hundred-MB paste can never
 * blow the tab's memory in one allocation.
 *
 * R12-f11 (P3): lowered 10 MB → 5 MB. The persist layer must survive a
 * localStorage-class ~5 MB budget, so a payload that could never survive a
 * reload is refused AT IMPORT with a human-readable reason the store can
 * forward instead of reporting a persistence failure later.
 *
 * A1-25: this comment used to promise a machine-readable `tooLargeToPersist`
 * code; no such code exists and the store forwards only `error`. TODO(A1-25):
 * mint `RT_E_IMPORT_TOO_LARGE` (+ ERROR_CODE_DOC entry) and thread it through
 * `ImportResult` when the errors-registry pass lands — until then the message
 * is the contract.
 */
export const IMPORT_MAX_CHARS = 5_000_000;

/** Serialize a project to pretty-printed JSON (2-space indent, stable keys). */
export function exportProjectJson(project: Project): string {
  return JSON.stringify(project, null, 2);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// T5.4 (W18 LANE 5) — artifact provenance: the additive stamp an emitted
// artifact record may carry, and the serialization boundary that keeps it
// honest.
//
// Shape (additive + OPTIONAL on the record — legacy rows stay unstamped):
//   artifact.provenance = { producer, model?, timestamp, inputHash }
//   - producer : "deterministic" | "model" | "replay" — what actually produced
//     the record. "deterministic" = machine-derived content no LLM call
//     produced (NEVER model-stamped); "model" = an LLM call produced it;
//     "replay" = a recorded envelope served from a T5.7 cassette tape. No
//     writer mints "replay" yet — the vocabulary + validator accept it so the
//     cassette lane can label a replay honestly instead of letting it pass as
//     a live run.
//   - model    : the model id ACTUALLY served (never the requested id).
//     Present iff producer !== "deterministic".
//   - timestamp: epoch ms at record emission.
//   - inputHash: FNV-1a (stringified) of the input the record derives from.
//
// Import laws (this file is the only serialization boundary for a Project):
//   - a WELL-FORMED stamp rides through import untouched — the
//     export→import→export round-trip of a healthy project stays byte-no-op;
//   - a MALFORMED or CONTRADICTORY stamp is DROPPED, loudly (repair note), and
//     is never repaired into shape — absence is honest, a guessed producer is
//     not (the types.ts:187 law: fail closed on a contradiction, never invent
//     provenance);
//   - an ABSENT stamp stays absent: legacy rows are never stamped at import.
// ---------------------------------------------------------------------------

/** T5.4: the closed producer vocabulary for an artifact provenance stamp. */
export const ARTIFACT_PRODUCERS = ["deterministic", "model", "replay"] as const;
export type ArtifactProducer = (typeof ARTIFACT_PRODUCERS)[number];

/** T5.4: the additive provenance stamp on an emitted artifact record. */
export type ArtifactProvenance = {
  producer: ArtifactProducer;
  /** The model id actually served — present iff producer !== "deterministic". */
  model?: string;
  /** Epoch ms at emission (Date.now() at the producing write). */
  timestamp: number;
  /** FNV-1a (stringified) of the input this record was derived from. */
  inputHash: string;
};

function isArtifactProducer(v: unknown): v is ArtifactProducer {
  return typeof v === "string" && (ARTIFACT_PRODUCERS as readonly string[]).includes(v);
}

/**
 * T5.4: validate a carried provenance value. Returns the stamp (canonical keys,
 * original values) when it is well-formed and non-contradictory, else null —
 * the caller DROPS a null result rather than repair it (fail closed).
 * Unknown sibling keys are tolerated by the caller and preserved (the
 * generatedTree T0.2 additive-tolerance precedent); the known fields are strict.
 */
export function coerceArtifactProvenance(v: unknown): ArtifactProvenance | null {
  if (!isPlainObject(v)) return null;
  if (!isArtifactProducer(v.producer)) return null;
  const timestamp = v.timestamp;
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp <= 0) return null;
  const inputHash = v.inputHash;
  if (typeof inputHash !== "string" || inputHash.trim().length === 0) return null;
  if (v.producer === "deterministic") {
    // The T5.4 law: a deterministic record is never model-stamped. A model id
    // here is a contradiction — the whole stamp fails closed.
    if (v.model !== undefined) return null;
    return { producer: "deterministic", timestamp, inputHash };
  }
  // model / replay: the claim is unverifiable without the served model id.
  if (typeof v.model !== "string" || v.model.trim().length === 0) return null;
  return { producer: v.producer, model: v.model, timestamp, inputHash };
}

// ---------------------------------------------------------------------------
// fixes/115 H-03 (io half) — import-time field defense.
//
// importProject's whitelist below validates the containers the pipeline cannot
// run without (id/name/brief/phases/currentPhase/artifacts/logs), but every
// OTHER field used to ride through unvalidated. A hostile/corrupt value in one
// of them either threw mid-hydration (research=5 → "(project.research ??
// []).slice is not a function" inside hydrateProject's compile pass) and
// surfaced as a misleading "Import failed during hydration" — or, on a payload
// whose packet/lattice/specGraph let hydrate return early, LANDED IN THE STORE
// intact and crashed the next stampPacket/approve/execute, which are not
// try/caught.
//
// sanitizeImportPayload therefore coerces-or-drops every defensible
// post-whitelist field BEFORE hydration so a corrupt import becomes a CLEAN
// import whose damage is contained and LOUD:
//   - the collections hydrateProject already repairs at container level but
//     NOT at row level (chatLog / oracle / crew): junk rows (null, primitives)
//     are dropped so the packet render / chat replay that reads row fields can
//     never throw on them;
//   - research, normalized engine-side since fixes/122 (hydrateProject filters
//     the container AND its item rows — A1-23): this pass keeps its own defense
//     for the import boundary AHEAD of hydration: a non-array container becomes
//     [], and corpus entries must be {query, items[]} with plain-object items;
//   - scorecard / specGraph / contracts, which pass hydrate's plain-object
//     guards but crash compileAgentPacket when their inner collections are
//     junk ({axes:5} → .map throws; specGraph {order:5} → .map throws;
//     contracts {entities:5} → .map throws): structurally-broken values are
//     dropped to the honest null/[] floor;
//   - every repair is written into the payload's own log trail as ONE
//     `import.repaired` warn row (mirroring hydrateProject's hydrate.repaired
//     convention), naming the field(s) + drop counts, so the operator and the
//     store can see exactly what was defended.
//
// The pass is a byte-for-byte NO-OP on well-formed payloads (no field touched,
// no row appended), so export→import→export round-trips of a healthy project
// stay byte-identical (io probe, fixes/115 §N4).
// ---------------------------------------------------------------------------

/**
 * Container + row defense for an optional collection field. Absent → untouched.
 * Non-array → replaced with [] (+ `${field}:dropped`). Array → rows failing
 * `keep` (default: not a plain object) are dropped (+ `${field}:rows:-N`).
 */
function defendRowArray(
  raw: Record<string, unknown>,
  field: string,
  notes: string[],
  keep: (row: Record<string, unknown>) => boolean = () => true,
): void {
  const v = raw[field];
  if (v === undefined) return; // absent optional field — nothing to defend
  if (!Array.isArray(v)) {
    raw[field] = [];
    notes.push(`${field}:dropped`);
    return;
  }
  const kept = v.filter((r): r is Record<string, unknown> => isPlainObject(r) && keep(r));
  if (kept.length !== v.length) notes.push(`${field}:rows:-${v.length - kept.length}`);
  raw[field] = kept;
}

/**
 * H-03 (io half): coerce-or-drop corrupt post-whitelist fields in place.
 * Returns the repair-note tokens (empty ⇒ payload was well-formed). Runs
 * BEFORE hydrateProject so the engine never sees a value it could throw on.
 */
function sanitizeImportPayload(raw: Record<string, unknown>): string[] {
  const notes: string[] = [];

  // research — the known H-03 vector: a non-array value survives hydrate and
  // throws inside compileAgentPacket's researchHash/researchSources. Entries
  // must be {query, items[]} with plain-object items carrying a STRING url
  // (researchHash reads item.url; researchSources reads item.title) — the
  // same predicate hydrateProject applies engine-side (A1-24). A url-less
  // item is dropped LOUDLY here; the old weaker filter kept rows that the
  // first localStorage round-trip silently dropped (import said "clean").
  if (raw.research !== undefined && !Array.isArray(raw.research)) {
    raw.research = [];
    notes.push("research:dropped");
  } else if (Array.isArray(raw.research)) {
    const keptEntries: Record<string, unknown>[] = [];
    let entriesDropped = 0;
    let itemsDropped = 0;
    for (const e of raw.research) {
      if (isPlainObject(e) && Array.isArray(e.items)) {
        // A1-24: mirror hydrate's url-required item predicate — divergence made
        // import→reload lossy with no note (io kept, the packet render then
        // printed `undefined` urls and hydrate dropped the row).
        const items = e.items.filter(
          (it): it is Record<string, unknown> =>
            isPlainObject(it) && typeof (it as { url?: unknown }).url === "string",
        );
        itemsDropped += e.items.length - items.length;
        // {...e, items} keeps the original key order (items was already present).
        keptEntries.push({ ...e, items });
      } else {
        entriesDropped += 1;
      }
    }
    if (entriesDropped > 0) notes.push(`research:entries:-${entriesDropped}`);
    if (itemsDropped > 0) notes.push(`research:items:-${itemsDropped}`);
    raw.research = keptEntries;
  }

  // chatLog — container is engine-repaired, rows are not: a null/primitive row
  // would break the chat replay that reads row.role/row.text.
  defendRowArray(raw, "chatLog", notes);

  // oracle — hydrate guards the container only; a null row crashes the packet
  // oracle render (t.name read). Rows without a name are unaddressable junk.
  defendRowArray(raw, "oracle", notes, (row) => typeof row.name === "string");

  // crew — container only in hydrate; a null row crashes the packet crew
  // render (c.role read).
  defendRowArray(raw, "crew", notes);

  // T5.4 (W18 LANE 5): artifact provenance — the additive stamp
  // { producer, model?, timestamp, inputHash } on an artifact row. A
  // well-formed stamp rides through UNTOUCHED (byte no-op, so a healthy
  // export→import→export round-trip keeps its stamps byte-identically); a
  // malformed or contradictory stamp is DROPPED with a loud note and never
  // repaired into shape (fail closed — absence is honest, a guessed producer
  // is not). An absent stamp stays absent: legacy rows are never stamped here.
  const artifactRows = raw.artifacts;
  if (Array.isArray(artifactRows)) {
    let droppedStamps = 0;
    for (const row of artifactRows) {
      if (!isPlainObject(row) || row.provenance === undefined) continue;
      if (coerceArtifactProvenance(row.provenance) === null) {
        delete row.provenance;
        droppedStamps += 1;
      }
    }
    if (droppedStamps > 0) notes.push(`artifacts:provenance:-${droppedStamps}`);
  }

  // scorecard — never regenerated by attachAlgorithms and never normalized by
  // hydrate, so a structurally-broken object reaches compileAgentPacket and
  // throws (scorecard.axes.map when axes is missing/not an array). Drop to the
  // honest null floor ("Not written — run Phase 0 first.") rather than trust it.
  const sc = raw.scorecard;
  if (sc !== undefined && sc !== null) {
    if (
      !isPlainObject(sc) ||
      !Array.isArray(sc.axes) ||
      !Array.isArray(sc.bottlenecks) ||
      !Array.isArray(sc.attackVectors)
    ) {
      raw.scorecard = null;
      notes.push("scorecard:dropped");
    } else {
      const axes = sc.axes.filter((a): a is Record<string, unknown> => isPlainObject(a));
      if (axes.length !== sc.axes.length) notes.push(`scorecard:axes:-${sc.axes.length - axes.length}`);
      sc.axes = axes;
    }
  }

  // specGraph — hydrate's plain-object guard passes {order: 5} / {nodes: 5},
  // which compileAgentPacket then .map()s into a throw. Require the two arrays;
  // node rows need a string id for the order→node lookup.
  const sg = raw.specGraph;
  if (sg !== undefined && sg !== null) {
    if (!isPlainObject(sg) || !Array.isArray(sg.order) || !Array.isArray(sg.nodes)) {
      raw.specGraph = null;
      notes.push("specGraph:dropped");
    } else {
      const nodes = sg.nodes.filter(
        (n): n is Record<string, unknown> => isPlainObject(n) && typeof n.id === "string",
      );
      if (nodes.length !== sg.nodes.length) notes.push(`specGraph:nodes:-${sg.nodes.length - nodes.length}`);
      sg.nodes = nodes;
      const order = sg.order.filter((id): id is string => typeof id === "string");
      if (order.length !== sg.order.length) notes.push(`specGraph:order:-${sg.order.length - order.length}`);
      sg.order = order;
    }
  }

  // contracts — same class as specGraph: entities/endpoints that are present
  // but not arrays (or entity rows without a fields array) throw in the packet
  // contract render. Drop the whole object to null — algorithms rebuild it on
  // the next stamp.
  const ct = raw.contracts;
  if (ct !== undefined && ct !== null) {
    if (
      !isPlainObject(ct) ||
      (ct.entities !== undefined && !Array.isArray(ct.entities)) ||
      (ct.endpoints !== undefined && !Array.isArray(ct.endpoints))
    ) {
      raw.contracts = null;
      notes.push("contracts:dropped");
    } else {
      if (Array.isArray(ct.entities)) {
        const entities = ct.entities.filter(
          (e): e is Record<string, unknown> =>
            isPlainObject(e) && typeof e.name === "string" && Array.isArray(e.fields),
        );
        if (entities.length !== ct.entities.length)
          notes.push(`contracts:entities:-${ct.entities.length - entities.length}`);
        ct.entities = entities;
      }
      if (Array.isArray(ct.endpoints)) {
        const endpoints = ct.endpoints.filter(
          (e): e is Record<string, unknown> => isPlainObject(e),
        );
        if (endpoints.length !== ct.endpoints.length)
          notes.push(`contracts:endpoints:-${ct.endpoints.length - endpoints.length}`);
        ct.endpoints = endpoints;
      }
    }
  }

  // fixes/144 (M2): generatedTree — additive multi-file tree. A non-array
  // container is dropped (absent is legal legacy); junk rows are filtered,
  // well-formed rows kept (path/source/hash strings required; attempt
  // defaulted to 0). Hydrate re-guards the non-io path (localStorage).
  const tree = raw.generatedTree;
  if (tree !== undefined && tree !== null) {
    if (!Array.isArray(tree)) {
      delete raw.generatedTree;
      notes.push("generatedTree:dropped");
    } else {
      const kept: Record<string, unknown>[] = [];
      let dropped = 0;
      for (const f of tree) {
        if (
          isPlainObject(f) &&
          typeof f.path === "string" &&
          typeof f.source === "string" &&
          typeof f.hash === "string"
        ) {
          // T0.2 (fixes/162): preserve unknown per-row keys (e.g. future
          // fixtureIds). Whitelist reconstruction used to strip them silently.
          const extra: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(f)) {
            if (k === "path" || k === "source" || k === "hash" || k === "attempt") continue;
            extra[k] = v;
          }
          kept.push({
            ...extra,
            path: f.path,
            source: f.source,
            hash: f.hash,
            attempt: typeof f.attempt === "number" ? f.attempt : 0,
          });
        } else {
          dropped += 1;
        }
      }
      if (dropped > 0) notes.push(`generatedTree:files:-${dropped}`);
      raw.generatedTree = kept;
    }
  }

  // A1 (fixes/162): acceptanceFixtures — additive. Non-array dropped;
  // invalid rows filtered; empty kept-set → ABSENCE (never []).
  const fxRaw = raw.acceptanceFixtures;
  if (fxRaw !== undefined && fxRaw !== null) {
    const fx = coerceAcceptanceFixtures(fxRaw);
    if (fx.containerDropped) {
      delete raw.acceptanceFixtures;
      notes.push("acceptanceFixtures:dropped");
    } else {
      if (fx.dropped > 0) notes.push(`acceptanceFixtures:dropped:${fx.dropped}`);
      if (fx.value) raw.acceptanceFixtures = fx.value;
      else delete raw.acceptanceFixtures;
    }
  }
  if (raw.acceptanceApprovedAt !== undefined && typeof raw.acceptanceApprovedAt !== "number") {
    delete raw.acceptanceApprovedAt;
    notes.push("acceptanceApprovedAt:dropped");
  }
  if (
    raw.acceptanceBriefHash !== undefined &&
    (typeof raw.acceptanceBriefHash !== "string" || raw.acceptanceBriefHash.trim().length === 0)
  ) {
    delete raw.acceptanceBriefHash;
    notes.push("acceptanceBriefHash:dropped");
  }

  return notes;
}

/** Append one `import.repaired` warn row to the payload's log trail (loud repairs). */
function stampImportRepairLog(p: Record<string, unknown>, notes: string[]): void {
  const currentPhase = p.currentPhase;
  const phase =
    typeof currentPhase === "number" && Number.isInteger(currentPhase)
      ? currentPhase
      : 0;
  // A1-26: the cap slice is a real mutation on repaired imports — when it
  // drops older rows the repair note must SAY so (a >200-row payload used to
  // lose its oldest rows with the note silent about it). The clamp keys off
  // PHASE_COUNT (A1-44 spirit), not a bare 12.
  const priorRows = Array.isArray(p.logs) ? p.logs.length : 0;
  const dropped = Math.max(0, priorRows + 1 - 200);
  const detail = dropped > 0 ? [...notes, `logs:-${dropped}`].join(" ") : notes.join(" ");
  p.logs = [
    ...(p.logs as unknown[]),
    {
      ts: Date.now(),
      phase: Math.min(PHASE_COUNT - 1, Math.max(0, phase)),
      level: "warn",
      event: "import.repaired",
      detail,
    },
  ].slice(-200);
}

/**
 * Parse + validate + hydrate a JSON string back into a Project.
 *
 * Shape validation (fail fast with a specific message before any repair):
 *   - top level must be a JSON object
 *   - `id` must be a non-empty string
 *   - `name` / `brief` must be strings (the engine reads them on hydrate)
 *   - `phases` must be an array of exactly 13 records
 *   - `currentPhase` must be an integer in 0..12
 *   - `artifacts` and `logs` must be arrays
 *
 * Then the payload runs through engine.hydrateProject so the imported project
 * carries the same repair guarantees as rehydrated localStorage state.
 */
export function importProject(json: string, opts?: { preserveWildRun?: boolean }): ImportResult {
  // H4: refuse non-string / oversized inputs before any parse work. JSON.parse
  // coerces its argument (numbers/objects/arrays become their toString), which
  // both mislabels junk input and lets a giant payload through to the parser.
  if (typeof json !== "string") {
    return { ok: false, error: "Import payload must be a JSON string." };
  }
  if (json.length > IMPORT_MAX_CHARS) {
    return {
      ok: false,
      error: `Import payload too large (${json.length.toLocaleString("en-US")} chars; cap ${IMPORT_MAX_CHARS.toLocaleString("en-US")}).`,
    };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${(err as Error).message}` };
  }
  if (!isPlainObject(raw)) {
    return { ok: false, error: "Expected a project object." };
  }
  const p = raw as Record<string, unknown>;
  if (typeof p.id !== "string" || p.id.length === 0) {
    return { ok: false, error: "Project is missing a string id." };
  }
  if (typeof p.name !== "string" || p.name.length === 0) {
    return { ok: false, error: "Project is missing a string name." };
  }
  if (typeof p.brief !== "string") {
    return { ok: false, error: "Project is missing a string brief." };
  }
  if (!Array.isArray(p.phases) || p.phases.length !== PHASE_COUNT) {
    return { ok: false, error: `Project must carry exactly ${PHASE_COUNT} phase records (found ${Array.isArray(p.phases) ? p.phases.length : typeof p.phases}).` };
  }
  if (
    typeof p.currentPhase !== "number" ||
    !Number.isInteger(p.currentPhase) ||
    p.currentPhase < 0 ||
    // B2 (W39): the graph authority is PHASE_COUNT, not a bare 12 (the A1-15
    // drift class — the sibling check at :473 already keys off PHASE_COUNT).
    p.currentPhase > PHASE_COUNT - 1
  ) {
    return { ok: false, error: "Project currentPhase must be an integer between 0 and 12." };
  }
  if (!Array.isArray(p.artifacts)) {
    return { ok: false, error: "Project artifacts must be an array." };
  }
  if (!Array.isArray(p.logs)) {
    return { ok: false, error: "Project logs must be an array." };
  }
  // H-03 (fixes/115, io half): coerce-or-drop corrupt post-whitelist fields
  // BEFORE hydration. A hostile/corrupt value in a field the whitelist does not
  // cover (research, chatLog rows, oracle rows, scorecard/specGraph/contracts
  // shapes, …) used to throw inside hydrateProject — surfacing as a misleading
  // hydration error — or rode through an early-return hydrate and crashed the
  // NEXT stamp. Now it imports cleanly with a loud `import.repaired` trail row
  // and a defended value. Byte no-op on well-formed payloads.
  const importRepairs = sanitizeImportPayload(p);
  if (importRepairs.length > 0) stampImportRepairLog(p, importRepairs);
  try {
    const project = hydrateProject(raw as unknown as Project, opts);
    return { ok: true, project };
  } catch (err) {
    return { ok: false, error: `Import failed during hydration: ${(err as Error).message}` };
  }
}

/**
 * The paste-ready Agent Packet plus (when present) the operator notes block.
 *
 * G2 (fixes/285 edge 2; K7 item 4): the compiled packet ALREADY embeds the
 * operator-notes block when notes existed at compile time (packet.ts
 * `## Operator notes (human steering)`), so appending unconditionally rendered
 * the same notes TWICE on the copy/download path. Append only when the stamped
 * packet does not already carry the current notes (searched from the embedded
 * block onward — the notes text alone may legitimately appear elsewhere, e.g.
 * quoted into a mission line). Notes edited AFTER the last compile still
 * append: the packet is the stale side there.
 */
export function exportPacketText(project: Project): string {
  const packet = project.packet ?? "";
  const notes = (project.notes ?? "").trim();
  if (!notes) return packet;
  const embeddedAt = packet.indexOf("## Operator notes (human steering)");
  if (embeddedAt !== -1 && packet.indexOf(notes, embeddedAt) !== -1) return packet;
  return `${packet}\n\n## Operator notes\n${notes}`;
}

/**
 * Slugify a project name for filesystem-safe filenames (never empty).
 *
 * Capped at 80 chars so `downloadFilename` can never produce a path that
 * hits OS filename limits (255 bytes on Windows/macOS) no matter how long
 * the project name is.
 */
export function slugName(name: string): string {
  const slug = (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "project";
}

/** Download filename for a project: `<slug>.json` by default, `<slug>.md` for the packet. */
export function downloadFilename(project: Project, ext: "json" | "md" = "json"): string {
  return `${slugName(project.name)}.${ext}`;
}

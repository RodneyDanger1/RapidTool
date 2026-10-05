/**
 * artifacts.ts — materialize a run's phase artifacts as visible markdown files.
 *
 * `materializeArtifacts(project)` is PURE: it reads a persisted project record
 * and returns `{ path, body }[]` — one real markdown document per phase artifact,
 * at `artifacts/P<phase>-<id>.md`, each carrying a plain-English title header
 * (phase name/number, artifact kind, language) followed by the artifact's OWN
 * body, verbatim.
 *
 * HONEST BY CONSTRUCTION: an artifact whose `body` is empty/absent is annotated
 * with the fact ("no body was recorded"), never padded with invented prose. The
 * function never reads the clock and never touches the filesystem — the writer
 * (headless.writeRunDocuments) does the I/O.
 */
import type { PhaseId, Project } from "./types.ts";
import { phaseDef } from "./phases.ts";

export type MaterializedArtifact = {
  /** Run-dir-relative POSIX path (e.g. `artifacts/P6-abc.md`). */
  path: string;
  /** The full markdown document (title header + the artifact's own body). */
  body: string;
};

/** Filesystem-safe id fragment: keep letters/digits/._- and collapse the rest. */
function safeId(raw: unknown, fallback: string): string {
  const s = typeof raw === "string" ? raw : "";
  const cleaned = s.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned.slice(0, 120) : fallback;
}

function phaseLabel(phase: number): string {
  try {
    const def = phaseDef(phase as PhaseId);
    return `${def.code} — ${def.title}`;
  } catch {
    return `P${phase}`;
  }
}

function asNonEmptyString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

/** Materialize every phase artifact on the record as a markdown document. */
export function materializeArtifacts(project: Project): MaterializedArtifact[] {
  const artifacts = Array.isArray(project?.artifacts) ? project.artifacts : [];
  const out: MaterializedArtifact[] = [];
  const used = new Map<string, number>();

  for (let i = 0; i < artifacts.length; i++) {
    const a = artifacts[i];
    if (!a || typeof a !== "object") continue;
    const phase = Number.isInteger(a.phase) ? a.phase : -1;
    const rawId = asNonEmptyString(a.id) ?? `artifact-${i + 1}`;
    const id = safeId(rawId, `artifact-${i + 1}`);

    let path = `artifacts/P${phase}-${id}.md`;
    const seen = used.get(path) ?? 0;
    used.set(path, seen + 1);
    if (seen > 0) path = `artifacts/P${phase}-${id}-${seen + 1}.md`;

    const title = asNonEmptyString(a.title) ?? `Artifact ${phaseLabel(phase)} · ${rawId}`;
    const kind = asNonEmptyString(a.kind) ?? "kind not recorded";
    const language = asNonEmptyString(a.language);
    const meta =
      `_Artifact \`${rawId}\` · ${phaseLabel(phase)} · kind: \`${kind}\` · ` +
      `language: ${language ? `\`${language}\`` : "not recorded"}_`;
    const body = asNonEmptyString(a.body)
      ? a.body
      : `> No body was recorded for this artifact (the record's \`body\` field is empty or absent).`;

    out.push({ path, body: [`# ${title}`, "", meta, "", body, ""].join("\n") });
  }

  return out;
}

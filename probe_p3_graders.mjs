// ---------------------------------------------------------------------------
// probe_p3_graders.mjs — W41 · P3 · the grader-v2 assertions vs REAL emitted trees.
//
// Run:  node --experimental-strip-types probe_p3_graders.mjs
//
// For every grader in research/eval-corpus/graders/*.grader.json:
//   1. loadGrader() must accept it (a grader that cannot be trusted never grades)
//   2. checkAcceptance() against a REAL emitted tree of the case's kind:
//        webapp  — research/eval-out/<slug>/ (the on-disk run artifacts)
//        game/cli-tool/library/service — K9's probe-emitted trees under /tmp/k9-*
//          (the runnable-kind probe's own output dirs; paths printed, missing
//           dirs are reported honestly, never skipped silently)
//   3. print per-row behavior verdicts + the verification label + the expectedKind
//      assertion. A failing row is a FAIL line (exit 1); all-pass prints the marker.
// Throwaway probe — evidence for fixes/295_p3_eval.md.
// ---------------------------------------------------------------------------
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { loadGrader, checkAcceptance, trialEmitDir, listCorpusEntries } from "./scripts/run-eval.mjs";
import { ALL_PHASES, runHeadless, seedProject } from "./src/lib/testing/fixtures.ts";
import { emitProject } from "./src/lib/headless.ts";

// --fresh [slug,slug]: ignore the on-disk trees and EMIT a fresh keyless tree per
// case from the fixture's own brief/name/kind (the CURRENT emitter's output),
// then run the same acceptance check. The honest proof that the v2 assertions
// hold for what the driver emits today (an old tree may fail — it is not the
// emitter's current output). No keyed calls, no network.
const FRESH = process.argv.includes("--fresh");
const only = (() => {
  const i = process.argv.indexOf("--only");
  return i >= 0 && process.argv[i + 1] ? new Set(process.argv[i + 1].split(",").map((s) => s.trim())) : null;
})();

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const GRADER_DIR = join(ROOT, "research", "eval-corpus", "graders");
const OUT_DIR = join(ROOT, "research", "eval-out");

// K9's probe output dirs (probe-k9-kinds.mjs): find the newest *-emit per kind.
function newest(tmpRoot, kind) {
  const hits = [];
  try {
    for (const d of readdirSync(tmpRoot)) {
      if (!d.startsWith("k9-")) continue;
      for (const inner of readdirSync(join(tmpRoot, d))) {
        if (inner === `${kind}-emit`) hits.push({ path: join(tmpRoot, d, inner), m: join(tmpRoot, d, inner) });
      }
    }
  } catch { /* no tmp dir */ }
  return hits.at(-1)?.path ?? null;
}
const TMP = process.env.TMPDIR || process.env.TEMP || "/tmp";

const KIND_TREE = {
  "arcade-breakout": () => newest(TMP, "game"),
  "invoice-csv-cli": () => newest(TMP, "cli-tool"),
  "date-rrule-library": () => newest(TMP, "library"),
  "order-webhook-service": () => newest(TMP, "service"),
};

let fails = 0;
const graders = readdirSync(GRADER_DIR).filter((f) => f.endsWith(".grader.json")).sort();
const corpus = FRESH
  ? Object.fromEntries(listCorpusEntries().filter((r) => r.entry).map((r) => [r.entry.slug, r.entry]))
  : {};
for (const f of graders) {
  const slug = f.replace(/\.grader\.json$/, "");
  if (only && !only.has(slug)) continue;
  const loaded = loadGrader(slug);
  if (!loaded.ok) { console.log(`--- ${slug} FAIL loadGrader: ${loaded.error}`); fails += 1; continue; }
  const grader = loaded.grader;
  let dir = KIND_TREE[slug] ? KIND_TREE[slug]() : trialEmitDir(OUT_DIR, slug, 1, 1);
  let how = "on-disk";
  if (FRESH) {
    const entry = corpus[slug];
    if (!entry) { console.log(`--- ${slug} FAIL (--fresh: no corpus fixture loaded)`); fails += 1; continue; }
    const kind = entry.kind === "webapp" || entry.kind === "app" ? "app" : entry.kind === "game" ? "game" : entry.kind === "cli-tool" || entry.kind === "tool" ? "tool" : undefined;
    const project = runHeadless(seedProject({ brief: entry.brief, name: entry.name, ...(kind ? { kind } : {}) }), ALL_PHASES);
    dir = join(mkdtempSync(join(tmpdir(), "p3-")), `${slug}-emit`);
    const res = await emitProject(project, dir, { redTree: "probe" });
    if (!res.ok) { console.log(`--- ${slug} FAIL fresh emit: ${res.error}`); fails += 1; continue; }
    how = "fresh-emit";
  } else if (!dir || !existsSync(dir)) {
    console.log(`--- ${slug} SKIP (no emitted tree at ${dir ?? "?"})`);
    continue;
  }
  // Emitted-file manifest relative to the tree (same shape the driver uses).
  const files = [];
  const walk = (rel) => {
    for (const name of readdirSync(join(dir, rel || "."))) {
      const p = rel ? `${rel}/${name}` : name;
      const isDir = (() => { try { readdirSync(join(dir, p)); return true; } catch { return false; } })();
      if (isDir) walk(p); else files.push(p);
    }
  };
  walk("");
  const acc = checkAcceptance(grader, dir, files);
  const bad = [];
  if (!acc.filesOk) bad.push(`filesOk=false missing=${JSON.stringify(acc.missingFiles)}`);
  if (!acc.contentOk) bad.push(`contentOk=false ${JSON.stringify(acc.failedContent)}`);
  if (!acc.behaviorOk) bad.push(`behaviorOk=false ${JSON.stringify(acc.behavior.rows.filter((r) => r.status === "fail"))}`);
  if (acc.kindOk === false) bad.push(`kindOk=false ${acc.kind.reason}`);
  if (bad.length) fails += 1;
  console.log(`--- ${slug} ${bad.length ? "FAIL" : "PASS"}`);
  console.log(`    grader=${loaded.path} v${grader.graderVersion} expectedKind=${grader.expectedKind ?? "(v1 none)"} files=${JSON.stringify(grader.expectedFiles)}`);
  console.log(`    tree=${dir} (${how})`);
  console.log(`    filesOk=${acc.filesOk} contentOk=${acc.contentOk} behaviorOk=${acc.behaviorOk} rows=${acc.behavior.passed}/${acc.behavior.declared} pass ${acc.behavior.pending} pending · kindOk=${acc.kindOk === null ? "n/a" : acc.kindOk}${acc.kind ? ` (${acc.kind.actual} vs ${acc.kind.expected})` : ""}`);
  console.log(`    verification="${acc.verification}"`);
  for (const b of bad) console.log(`    x ${b}`);
}
console.log(fails === 0 ? "P3 GRADERS PROBE: ALL PASS" : `P3 GRADERS PROBE: FAIL (${fails})`);
process.exitCode = fails === 0 ? 0 : 1;

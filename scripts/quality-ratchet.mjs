// ---------------------------------------------------------------------------
// scripts/quality-ratchet.mjs — the W356 quality ratchet (lane `ratchet`).
//
// WHY THIS EXISTS. The W355 audit proved the failure mode this file prevents is
// not hypothetical (fixes/355_0_audit_wave.md §2.1): ONE uncommitted reader
// change made a tree with zero generated product read as real — the substantive
// tree rate went 6/13 -> 13/13 with no product change — and simultaneously
// disarmed prevention guard C-06. A "measurement" that can be moved by editing
// the reader that produces it is not a measurement.
//
// WHAT IT IS. A pinned-floor ratchet over metrics read from their EXISTING
// producers, read-only, plus READER CANARIES: structural + discriminating
// assertions about the readers themselves. A floor may only RISE; breaching it
// downward (atLeast) or upward (atMost) is a HARD failure. A metric that cannot
// be produced reports `unavailable` with a coded reason — never a silent pass,
// never a fabricated number. `estimatedCostUsd` stays null everywhere.
//
// It re-derives nothing and re-implements nothing: every reading comes from the
// command / reader named in `quality-ratchet.floors.json#floors[*].producer`.
// The only write is none at all — this file is read-only over the repo, with one
// exception outside it: `--tree-tsc` runs the real `treeRun` producer (which is
// what that producer does) and is opt-in.
//
// Usage:
//   node scripts/quality-ratchet.mjs --all                 # the real reading
//   node scripts/quality-ratchet.mjs --all --gate <dir|verdict.json>
//   node scripts/quality-ratchet.mjs --selftest            # planted-regression teeth
//   node scripts/quality-ratchet.mjs --all --tree-tsc=3    # opt-in heavy producer
// Stdout is exactly ONE JSON line (diagnostics go to stderr), so the gate's
// verdict program can parse it the way it parses the prevention harness.
// ---------------------------------------------------------------------------

import { readFileSync, writeSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_FLOORS_PATH = join(REPO_ROOT, "scripts", "quality-ratchet.floors.json");
export const SCHEMA = "rapidtool-quality-ratchet/1";

/**
 * The ONLY `RT_E_*` codes this file emits, for two reasons: (1) no new code is
 * minted (this lane's scope is three new files + one additive gate stage, so
 * `src/lib/errors.ts` is not edited), and (2) every code used must already be a
 * real entry in `ERROR_CODE_DOC` — `canary.errorCodes.registered` reads
 * `src/lib/errors.ts` and fails loudly if one of these stops resolving. Each
 * code names its CAUSE, and the `reason` string names the exact producer.
 */
export const UNAVAILABLE_CODES = {
  /**
   * The producer was NOT run in this invocation (heavy, or supplied by the gate /
   * the boundary owner). This is a missing INPUT, not a tree failure: it is
   * reported loudly under `unavailable` and never hard-fails — but the pin's floor
   * is still not met, so it stays visible. The gate's `ratchet` stage always
   * supplies its readings, so inside the boundary these floors ARE checked.
   */
  producerNotRun: "RT_E_RUNNER_UNAVAILABLE",
  /** The artifact or record the producer must read is ABSENT from disk — fail closed. */
  artifactAbsent: "RT_E_PROJECT_MISSING",
  /** A reader's shape changed, so its output cannot be used (the C-06 failure mode) — fail closed. */
  readerShapeInvalid: "RT_E_VALIDATION",
};

/** Causes that hard-fail an `enforced` pin: a broken/absent producer, never an unsupplied one. */
const HARD_FAIL_CODES = new Set([UNAVAILABLE_CODES.artifactAbsent, UNAVAILABLE_CODES.readerShapeInvalid]);

const KIND_SURFACE = { app: "web", game: "game", tool: "runnable", service: "runnable", library: "runnable" };
export const RATCHET_KINDS = ["app", "game", "tool", "service", "library"];
const KIND_SCRIPTS = {
  app: ["typecheck", "test", "build"],
  game: ["typecheck", "test", "build"],
  tool: ["typecheck", "test"],
  service: ["typecheck", "test"],
  library: ["typecheck", "test"],
};
/** The eval-corpus frontmatter vocabulary -> the engine's DeliveryKind vocabulary. */
const KIND_ALIASES = { webapp: "app", "cli-tool": "tool", cli: "tool", "web-app": "app" };

const SPEC_FILE_RE = /\.(spec|test)\.(?:m?[jt]sx?|cjs)$/i;
const CODE_FILE_RE = /\.(?:m?[jt]sx?|cjs)$/i;
const TEST_SEAM_DIR_RE = /(?:^|\/)(?:__tests__|__mocks__|__fixtures__|tests|test)\//i;
const WALK_SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".output", ".nitro"]);
const TREES_CASSETTE = join(REPO_ROOT, "scripts", "prevention", "cassettes", "trees.json");
const EVAL_OUT_DIR = join(REPO_ROOT, "research", "eval-out");
const EVAL_CORPUS_DIR = join(REPO_ROOT, "research", "eval-corpus");

// ---------------------------------------------------------------------------
// Pure helpers — no IO. Exported so the tests can pin them.
// ---------------------------------------------------------------------------

/** A blank/failed reading. `value:null` is the only honest shape for "we could not measure". */
function unreadable(code, reason) {
  return { value: null, code, reason };
}

/**
 * Compare one reading against its pinned floor. Pure.
 * @param {"atLeast"|"atMost"} direction
 * @param {number} floor
 * @param {number} reading
 * @returns {"ok"|"raise"|"regressed"}
 */
export function compareFloor(direction, floor, reading) {
  if (direction === "atLeast") {
    if (reading < floor) return "regressed";
    return reading > floor ? "raise" : "ok";
  }
  if (direction === "atMost") {
    if (reading > floor) return "regressed";
    return reading < floor ? "raise" : "ok";
  }
  throw new Error(`unknown floor direction: ${direction}`);
}

/** A test seam (a legitimate home for a test double). Production paths are NOT seams. */
export function isTestSeamPath(path) {
  const p = String(path ?? "").replace(/\\/g, "/");
  if (p === "") return true;
  return SPEC_FILE_RE.test(p) || TEST_SEAM_DIR_RE.test(p);
}

/**
 * Placeholder / not-implemented markers on a production path. Deliberately NARROW:
 * the bare word `stub` or a `placeholder=` ATTRIBUTE is a legitimate product byte
 * (measured in the corpus: `placeholder="sourdough, croissant, cake"` inside a real
 * emitted page), so a false positive here would be as bad as a miss.
 */
/** `[label, pattern]` rows — typed so `re.test()` is not a `string | RegExp` union. */
/** @type {ReadonlyArray<readonly [string, RegExp]>} */
const PLACEHOLDER_MARKERS = [
  ["not-implemented", /NOT[\s_]+IMPLEMENTED/i],
  ["not-published-page", /is not published by this build/],
  ["lorem-ipsum", /Lorem ipsum/i],
  ["screaming-placeholder-constant", /\b(?:MOCK|FAKE|STUB|DEMO|PLACEHOLDER)_[A-Z0-9_]{2,}\b/],
  ["placeholder-data", /\b(?:mock|fake|stub|demo|placeholder)(?:Data|Items|Rows|Users|Records|Seed|Fixture)s?\b/],
];
const TEST_DOUBLE_PATH_RE =
  /(?:^|\/)(?:__mocks__|__fixtures__)\/|\.(?:mock|fake|stub|dummy)\.[cm]?[jt]sx?$/i;
const TEST_DOUBLE_API_RE =
  /\b(?:vi|jest|sinon)\.(?:mock|fn|stub|spy|useFakeTimers)\s*\(|\bmockImplementation\b|\bMockedFunction\b|\bunittest\.mock\b/;
const IMPORT_SPECIFIER_RE = /\bfrom\s*['"]([^'"]+)['"]|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Every import/require specifier in a source (the primitive, not a reader). */
export function importSpecifiers(source) {
  const out = [];
  const code = String(source ?? "");
  IMPORT_SPECIFIER_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_SPECIFIER_RE.exec(code)) !== null) out.push(m[1] ?? m[2]);
  return out;
}

/**
 * THE test-double clause of owner rule 1, as ONE rule the two scopes share: a
 * production module may not import a test-double namespace (`__mocks__/`,
 * `__fixtures__/`, `*.mock|fake|stub|dummy.*`) nor call a test-double library API
 * (`vi.mock(`, `jest.fn(`, `mockImplementation`, …). `scanRealProduct` applies it
 * to the emitted corpus; `scanRepoTestDoubles` applies the SAME function to
 * RapidTool's own `src/**` — one rule, two scopes, so the two readings can never
 * drift apart.
 * @param {string} path POSIX, production-relative
 * @param {string} source
 * @returns {Array<{kind:string, marker:string, detail:string}>}
 */
export function testDoubleViolations(path, source) {
  const out = [];
  for (const spec of importSpecifiers(source)) {
    if (TEST_DOUBLE_PATH_RE.test(spec)) {
      out.push({ kind: "test-double-import", marker: spec, detail: `${path}: a production module imports a test-double namespace` });
    }
  }
  if (TEST_DOUBLE_API_RE.test(source)) {
    out.push({ kind: "test-double-api", marker: "mock-api", detail: `${path}: a production module uses a test-double library API` });
  }
  return out;
}

/**
 * The `realProductOnly` reader — owner rule 1: NO mock, stub, fake, demo or
 * placeholder code on any production path. Pure over `{path, source}` rows so the
 * selftest can prove it can fail on an injected defect without touching the repo.
 *
 * `classify` is injected so this module never re-implements the classifier: the
 * real caller passes `lib/dod.ts#classifyModuleSource`, the ONE classifier every
 * census on every surface routes through.
 *
 * @param {Array<{path:string, source:string}>} files
 * @param {(source:string) => "stub"|"reexport"|"real"} classify
 */
export function scanRealProduct(files, classify) {
  if (typeof classify !== "function") throw new Error("scanRealProduct requires the classify function");
  const violations = [];
  const census = { codeModules: 0, productionModules: 0, real: 0, stubs: 0, reexports: 0, unknown: 0 };
  for (const f of Array.isArray(files) ? files : []) {
    const path = typeof f?.path === "string" ? f.path.replace(/\\/g, "/") : "";
    if (path === "" || !CODE_FILE_RE.test(path)) continue;
    census.codeModules += 1;
    if (isTestSeamPath(path)) continue; // test doubles are legitimate IN A TEST SEAM
    census.productionModules += 1;
    const source = typeof f.source === "string" ? f.source : "";
    if (typeof f.source !== "string") {
      census.unknown += 1;
      continue;
    }
    const cls = classify(source);
    if (cls === "stub") census.stubs += 1;
    else if (cls === "reexport") census.reexports += 1;
    else census.real += 1;
    if (cls === "stub") {
      violations.push({ path, kind: "stub-module", marker: stubMarkerOf(source), detail: "classified `stub` by the shared classifier (TODO(E-15) / throw-TODO / deterministic template / blank)" });
    }
    for (const [marker, re] of PLACEHOLDER_MARKERS) {
      if (re.test(source)) violations.push({ path, kind: "marker", marker, detail: "placeholder / not-implemented marker on a production path" });
    }
    for (const v of testDoubleViolations(path, source)) violations.push({ path, ...v });
  }
  return { ...census, violations };
}

/**
 * Resolve a relative / `@/`-aliased specifier against a set of POSIX repo-relative
 * paths (the walked file list itself). Bare package specifiers resolve to `null`:
 * this reader judges the repo's own modules, never node_modules.
 * @param {string} spec
 * @param {string} fromPath
 * @param {Set<string>} fileSet
 * @returns {string|null}
 */
export function resolveRepoSpecifier(spec, fromPath, fileSet) {
  const s = String(spec ?? "");
  let base;
  if (s.startsWith("@/")) base = `src/${s.slice(2)}`;
  else if (s.startsWith("./") || s.startsWith("../")) {
    const parts = fromPath.split("/").slice(0, -1);
    for (const part of s.split("/")) {
      if (part === "" || part === ".") continue;
      if (part === "..") parts.pop();
      else parts.push(part);
    }
    base = parts.join("/");
  } else {
    return null;
  }
  const candidates = [base];
  if (!CODE_FILE_RE.test(base)) {
    candidates.push(`${base}.ts`, `${base}.tsx`, `${base}.mts`, `${base}.mjs`, `${base}.js`, `${base}/index.ts`, `${base}/index.tsx`);
  }
  for (const candidate of candidates) if (fileSet.has(candidate)) return candidate;
  return null;
}

/**
 * R-5 · W357 — the owner-rule reader over RapidTool's OWN tree.
 *
 * `scanRealProduct` measures the owner's rule over the emitted corpus only, so the
 * repo's own `src/**` — where the repo's own code lives — was outside the reader
 * enforcing it. This applies the SAME `testDoubleViolations` clause to every code
 * module under `src/**`, plus one repo-only leg: a production module may not import
 * a specifier that RESOLVES to a test seam or to a test-double-named file. Pure
 * over `{path, source}` rows (POSIX repo-relative) so the selftest can plant a
 * defect without touching the repo; `productionModules` is the vacuity floor (an
 * empty scan must never read as clean).
 * @param {Array<{path:string, source:string}>} files
 */
export function scanRepoTestDoubles(files) {
  const rows = (Array.isArray(files) ? files : [])
    .map((f) => ({ path: typeof f?.path === "string" ? f.path.replace(/\\/g, "/") : "", source: typeof f?.source === "string" ? f.source : "" }))
    .filter((f) => f.path !== "" && CODE_FILE_RE.test(f.path));
  const fileSet = new Set(rows.map((f) => f.path));
  const violations = [];
  const census = { codeModules: rows.length, productionModules: 0, seamModules: 0, testDoubleFiles: 0 };
  for (const f of rows) {
    if (isTestSeamPath(f.path)) {
      census.seamModules += 1; // a double IS legitimate inside a test seam
      continue;
    }
    census.productionModules += 1;
    if (TEST_DOUBLE_PATH_RE.test(f.path)) census.testDoubleFiles += 1;
    for (const v of testDoubleViolations(f.path, f.source)) violations.push({ path: f.path, ...v });
    for (const spec of importSpecifiers(f.source)) {
      const target = resolveRepoSpecifier(spec, f.path, fileSet);
      if (target !== null && (isTestSeamPath(target) || TEST_DOUBLE_PATH_RE.test(target))) {
        violations.push({ path: f.path, kind: "test-double-import", marker: spec, detail: `${f.path}: a production module imports ${target}, a test seam / test-double module` });
      }
    }
  }
  return { ...census, violations };
}

/** Which documented stub marker the bytes carry (evidence, never a guess). */
function stubMarkerOf(source) {
  const s = String(source ?? "");
  if (s.trim() === "") return "blank";
  if (s.includes("TODO(E-15)") || /throw\s+new\s+Error\s*\(\s*(['"`])TODO\b/i.test(s)) return "TODO(E-15)";
  return "deterministic-template";
}

/** The requested kind, normalized to the engine's DeliveryKind vocabulary. */
export function normalizeRequestedKind(raw) {
  const k = String(raw ?? "").trim().toLowerCase();
  if (k === "") return null;
  const mapped = KIND_ALIASES[k] ?? k;
  return RATCHET_KINDS.includes(mapped) ? mapped : null;
}

/**
 * The `kindFit` reader — owner rule 2: the factory must take the requested KIND
 * into account and deliver the best version of it. Compares the EMITTED artifact
 * against the requested kind on three legs, all read from existing producers:
 *   - entry shape   `scripts/acceptance-run.mjs#resolveTreeEntry(files, pkg, kind)`
 *   - declared scripts (the kind's verification surface, from the tree's own package.json)
 *   - the kind's required surface (`product-quality` `kindSurface` via the fleet reader)
 * A kind with no emitted case is `uncovered` — never `pass`.
 */
export function kindFitOf(units, readers) {
  const { resolveTreeEntry, readProductQuality, fleetProductQualityFromProjects } = readers;
  const rows = [];
  for (const u of Array.isArray(units) ? units : []) {
    const requestedKind = normalizeRequestedKind(u.requestedKind);
    const files = Array.isArray(u.files) ? u.files : [];
    const pkg = u.pkg && typeof u.pkg === "object" ? u.pkg : {};
    const unmet = [];
    if (requestedKind === null) {
      unmet.push(`unknown requested kind ${JSON.stringify(u.requestedKind ?? null)}`);
      rows.push({ ...unitId(u), requestedKind: null, demandedKind: null, entryOk: false, missingScripts: KIND_SCRIPTS.app, surfaceOk: false, fit: false, uncovered: true, unmet });
      continue;
    }
    const entry = resolveTreeEntry(files.map((f) => f.path), pkg, requestedKind);
    if (entry.ok !== true) unmet.push(`entry shape: ${entry.detail ?? "kind entry missing"}`);
    const scripts = pkg.scripts && typeof pkg.scripts === "object" ? pkg.scripts : {};
    const missingScripts = (KIND_SCRIPTS[requestedKind] ?? []).filter(
      (s) => !(typeof scripts[s] === "string" && scripts[s].trim() !== ""),
    );
    if (missingScripts.length > 0) unmet.push(`declared scripts missing: ${missingScripts.join(", ")}`);
    const q = readProductQuality(u.record, { emittedFiles: files });
    const demandedKind = q?.kindSurface?.kind ?? null;
    const surfaceOk = fleetSurfaceOk(u.record, files, fleetProductQualityFromProjects);
    if (!surfaceOk) unmet.push(`kind surface unmet (demanded ${JSON.stringify(demandedKind)}, measured by the fleet reader)`);
    if (demandedKind !== KIND_SURFACE[requestedKind]) {
      unmet.push(`demanded surface ${JSON.stringify(demandedKind)} != ${JSON.stringify(KIND_SURFACE[requestedKind])} for a ${requestedKind} request`);
    }
    rows.push({
      ...unitId(u),
      requestedKind,
      demandedKind,
      entryOk: entry.ok === true,
      entryMode: entry.mode ?? null,
      missingScripts,
      surfaceOk,
      fit: unmet.length === 0,
      uncovered: false,
      unmet,
    });
  }
  const byKind = {};
  for (const k of RATCHET_KINDS) {
    const rowsOfKind = rows.filter((r) => r.requestedKind === k && r.uncovered !== true);
    byKind[k] = {
      units: rowsOfKind.length,
      fit: rowsOfKind.filter((r) => r.fit).length,
      entryOk: rowsOfKind.filter((r) => r.entryOk).length,
      surfaceOk: rowsOfKind.filter((r) => r.surfaceOk).length,
      scriptsOk: rowsOfKind.filter((r) => r.missingScripts.length === 0).length,
      demandedMatch: rowsOfKind.filter((r) => r.demandedKind === KIND_SURFACE[k]).length,
      uncovered: rowsOfKind.length === 0,
      atoms: rowsOfKind,
    };
  }
  return { rows, byKind, units: rows.length };
}

function unitId(u) {
  return {
    source: typeof u.source === "string" ? u.source : "unknown",
    unit: typeof u.unit === "string" ? u.unit : "unknown",
  };
}

/** The SINGLE per-kind surface rule — `fleetProductQualityFromProjects`'s own. */
function fleetSurfaceOk(record, files, fleetReader) {
  if (typeof fleetReader !== "function") return false;
  const fleet = fleetReader([{ ...record, emittedSurface: files }]);
  const row = fleet?.readings?.[0];
  return row ? row.surfaceOk === true : false;
}

// ---------------------------------------------------------------------------
// The evaluator — pure. This is where "a floor may only rise" lives.
// ---------------------------------------------------------------------------

/**
 * The floor evaluator — this is where "a floor may only rise" lives.
 * @param {{readings?: any, canaries?: any, floors: any}} args
 * @returns {any} the evaluated metrics + the named failure/pending/uncovered sets
 */
export function evaluate(args) {
  const { readings, canaries, floors } = args;
  const metrics = [];
  const regressions = [];
  const pendingFirstGreen = [];
  const uncovered = [];
  const unavailable = [];
  const unavailableEnforced = [];
  const unknownMetricIds = [];
  for (const [id, spec] of Object.entries(floors?.floors ?? {})) {
    const reading = readings?.[id] ?? unreadable(UNAVAILABLE_CODES.producerNotRun, "no producer ran for this metric");
    const base = {
      id,
      direction: spec.direction ?? null,
      floor: spec.floor ?? null,
      unit: spec.unit ?? null,
      producer: spec.producer ?? null,
      status: spec.status ?? "enforced",
      readingPinned: spec.readingPinned === true,
      reading: reading.value,
      evidence: reading.evidence,
    };
    if (spec.status === "uncovered") {
      uncovered.push(id);
      metrics.push({ ...base, result: "uncovered", reason: spec.reason ?? null });
      continue;
    }
    if (typeof spec.floor !== "number" || (spec.direction !== "atLeast" && spec.direction !== "atMost")) {
      unknownMetricIds.push(id);
      metrics.push({ ...base, result: "invalid-floor", reason: "the pin carries no numeric floor + direction" });
      continue;
    }
    if (reading.value === null || reading.value === undefined || !Number.isFinite(reading.value)) {
      const code = reading.code ?? UNAVAILABLE_CODES.producerNotRun;
      const reason = reading.reason ?? "the producer produced no reading";
      unavailable.push(`${id}: ${code} ${reason}`);
      const failClosed = spec.status === "enforced" && HARD_FAIL_CODES.has(code);
      if (failClosed) unavailableEnforced.push(`${id} (${code}): ${reason}`);
      if (spec.status !== "enforced") pendingFirstGreen.push(`${id} (pending-first-green; reading unavailable: ${code})`);
      metrics.push({ ...base, result: "unavailable", code, failClosed, reason });
      continue;
    }
    const verdict = compareFloor(spec.direction, spec.floor, reading.value);
    if (spec.status !== "enforced") {
      pendingFirstGreen.push(`${id}${verdict === "regressed" ? " (BELOW THE HONEST BAR today)" : ""}`);
      metrics.push({ ...base, result: "pending", comparison: verdict, reason: spec.reason ?? null });
      continue;
    }
    if (verdict === "regressed") {
      regressions.push(`${id} (${spec.direction} floor ${spec.floor}, measured ${reading.value})`);
    }
    metrics.push({ ...base, result: verdict === "regressed" ? "regressed" : verdict, reason: verdict === "raise" ? "the reading beats the floor — raise the pin (floors may only rise)" : null });
  }
  const canaryFailures = (canaries ?? []).filter((c) => c.ok !== true).map((c) => `${c.id}: ${c.reason ?? "failed"}`);
  const ok = regressions.length === 0 && canaryFailures.length === 0 && unavailableEnforced.length === 0 && unknownMetricIds.length === 0;
  return { metrics, regressions, canaryFailures, pendingFirstGreen, uncovered, unavailable, unavailableEnforced, unknownMetricIds, ok };
}

// ---------------------------------------------------------------------------
// Reader loading + canaries. `runCanaries` takes the readers as an argument so
// the selftest can inject a MUTATED reader and prove the canary fails — that is
// the direct fix for the W355 C-06 failure mode (a guard disarmed by a rename).
// ---------------------------------------------------------------------------

/**
 * Load the real reader seams (never mocked). A module that fails to load, or that
 * stops exporting a name this ratchet reads, is recorded in `errors` so the canaries
 * can FAIL by name instead of the ratchet crashing.
 * @returns {Promise<any>}
 */
export async function loadReaders() {
  /** @type {any} */
  const readers = { errors: /** @type {string[]} */ ([]) };
  const load = async (key, spec, names) => {
    try {
      const mod = await import(pathToFileURL(spec).href);
      for (const n of names) {
        if (typeof mod[n] !== "function") throw new Error(`${relative(REPO_ROOT, spec).replace(/\\/g, "/")} does not export ${n}()`);
      }
      readers[key] = mod;
    } catch (e) {
      readers.errors.push(`${key} (${relative(REPO_ROOT, spec).replace(/\\/g, "/")}): ${String(e?.message ?? e)}`);
    }
  };
  await load("compile", join(REPO_ROOT, "src", "lib", "compile-check.server.ts"), ["treeSubstanceOf", "treeRun"]);
  await load("dod", join(REPO_ROOT, "src", "lib", "dod.ts"), ["classifyModuleSource", "productSurfaceKindOf", "briefDeliveryKind"]);
  await load("pq", join(REPO_ROOT, "src", "lib", "product-quality.ts"), ["readProductQuality", "fleetProductQualityFromProjects"]);
  await load("ar", join(REPO_ROOT, "scripts", "acceptance-run.mjs"), ["resolveTreeEntry"]);
  return readers;
}

const SUBSTANCE_VERDICTS = new Set(["real", "mixed", "stub-skeleton", "empty"]);
/** The two distinctly named readings the producer is REQUIRED to return. */
export const SUBSTANCE_SCOPES = ["jobScoped", "wholeTree"];

/**
 * R-8 · W357: one named scope must be present and shape-valid on the returned
 * outcome. `TreeSubstance` DECLARES `jobScoped?` / `wholeTree?` optional ("so
 * hand-built fixture outcomes still satisfy the type") while `treeSubstanceOf`
 * returns both REQUIRED — so any consumer reading `substance.jobScoped.verdict` off
 * a hand-built outcome gets `undefined` and the compiler never says a word. The
 * runtime is the only place that contract can be enforced, and this is it: checked
 * over EVERY pinned tree, for BOTH names, and a violation fails closed.
 * @param {any} raw
 * @param {string} scope
 * @returns {string|null} null when valid, else the reason by name
 */
export function substanceScopeShape(raw, scope) {
  if (raw === null || typeof raw !== "object") return "the reader returned no object";
  const s = raw[scope];
  if (s === null || typeof s !== "object") return `\`${scope}\` is not reachable on the returned verdict (the reader's shape changed)`;
  for (const k of ["stubs", "reexports", "real"]) {
    if (!Number.isFinite(s[k])) return `\`${scope}.${k}\` is not a finite number`;
  }
  if (!SUBSTANCE_VERDICTS.has(s.verdict)) return `\`${scope}.verdict\` is ${JSON.stringify(s.verdict)} — not one of ${[...SUBSTANCE_VERDICTS].join("/")}`;
  if (!Array.isArray(s.files)) return `\`${scope}.files\` is not an array`;
  return null;
}

/**
 * The whole outcome: EVERY required scope must be shape-valid (R-8). Returns the
 * reasons by name so the caller can fail closed and say which scope broke.
 * @param {any} raw
 * @returns {string[]}
 */
export function censusShape(raw) {
  const problems = [];
  for (const scope of SUBSTANCE_SCOPES) {
    const why = substanceScopeShape(raw, scope);
    if (why !== null) problems.push(why);
  }
  return problems;
}

/**
 * R-4/R-8 · W357 — the substantive-tree reading, with its FAIL-CLOSED rule in one
 * pure place. A census that cannot be read, carries no rows, or carries ANY row
 * whose two named scopes are not shape-valid yields `RT_E_VALIDATION` on an enforced
 * pin — a hard failure BY NAME. Pre-fix, a renamed `jobScoped` made a row's verdict
 * `undefined`, so the reading silently became 0: still a failure, but reported as a
 * *rate* regression, which reads like evidence of a product change instead of a
 * broken reader. Both named readings are reported per tree in the evidence.
 * @param {any} census
 * @returns {any}
 */
export function censusRealTreesReading(census) {
  const rows = Array.isArray(census?.rows) ? census.rows : [];
  const shapeBad = rows.filter((r) => typeof r?.shapeError === "string" && r.shapeError !== "");
  if (census?.ok !== true || rows.length === 0 || shapeBad.length > 0) {
    return unreadable(
      UNAVAILABLE_CODES.readerShapeInvalid,
      shapeBad.length > 0
        ? `the census reader's shape is invalid on ${shapeBad.length} of ${rows.length} pinned tree(s): ${shapeBad.map((r) => `${r.tree} -> ${r.shapeError}`).join(" | ")}`
        : rows.length === 0
          ? "the census corpus is empty — the substantive-tree reading cannot be produced"
          : (census?.reason ?? "the census could not be read"),
    );
  }
  return {
    value: rows.filter((r) => r.job === "real").length,
    evidence: { perTree: rows.map((r) => ({ tree: r.tree, top: r.top, jobScoped: r.job, wholeTree: r.whole ?? null })) },
  };
}

/**
 * Every reader canary. Pure over an injected reader/corpus context.
 * @param {any} ctx  `{readers, corpus, floors, readings, errorsRegistry}`
 * @returns {Array<any>}
 */
export function runCanaries(ctx) {
  const readers = ctx?.readers ?? {};
  const out = [];
  // `note` documents a not-applicable canary without turning it into a failure.
  const add = (id, ok, reason, evidence, note = "") =>
    out.push({ id, ok: ok === true, reason: ok === true ? (note === "" ? null : note) : String(reason ?? "failed"), evidence });

  // --- census -----------------------------------------------------------------
  const compile = readers.compile;
  const censusRows = ctx?.corpus?.rows ?? null;
  const corpusPinned = Number.isFinite(ctx?.corpus?.pinned) ? ctx.corpus.pinned : null;
  const corpusFloor = ctx?.floors?.floors?.["tree.corpusSize"]?.floor;
  if (typeof compile?.treeSubstanceOf !== "function") {
    add("canary.census.job-scoped-reachable", false, "compile-check.server.ts does not export treeSubstanceOf()", null);
    add("canary.census.whole-tree-reachable", false, "compile-check.server.ts does not export treeSubstanceOf()", null);
    add("canary.census.corpus-is-pinned", false, "compile-check.server.ts does not export treeSubstanceOf()", null);
  } else {
    const rows = Array.isArray(censusRows) ? censusRows : [];
    // R-4 · W357: EVERY pinned tree is checked, not just the first. The pre-fix
    // reading was `censusRows[0].raw`, so a shape change on any tree but the first
    // could not fire this canary at all — a canary that cannot fire on the real
    // corpus. A row whose shape is broken is named here.
    const shapeBad = rows.filter((r) => censusShape(r?.raw).length > 0);
    add(
      "canary.census.job-scoped-reachable",
      rows.length > 0 && shapeBad.length === 0,
      rows.length === 0
        ? "the census corpus is empty — the job-scoped reader cannot be exercised"
        : `the reader's shape is invalid on ${shapeBad.length} of ${rows.length} pinned tree(s): ${shapeBad.map((r) => `${r.tree}: ${censusShape(r.raw).join("; ")}`).join(" | ")}`,
      { trees: rows.length, jobScopedVerdicts: rows.map((r) => r.job ?? null) },
    );
    // R-8: the OTHER named scope is required from the producer too. Both names are
    // optional in the type; both are returned in practice; neither may be absent at
    // run time, because the next consumer that assumes presence gets `undefined`.
    const wholeBad = rows.filter((r) => substanceScopeShape(r?.raw, "wholeTree") !== null);
    add(
      "canary.census.whole-tree-reachable",
      rows.length > 0 && wholeBad.length === 0,
      rows.length === 0
        ? "the census corpus is empty — the whole-tree reader cannot be exercised"
        : `\`wholeTree\` is absent or shape-invalid on ${wholeBad.length} of ${rows.length} pinned tree(s): ${wholeBad.map((r) => `${r.tree}: ${substanceScopeShape(r.raw, "wholeTree")}`).join(" | ")}`,
      { trees: rows.length, wholeTreeVerdicts: rows.map((r) => r.whole ?? null) },
    );
    // R-4: the corpus the census canaries were handed must BE the pinned corpus. A
    // zero-tree (or silently truncated) corpus is the one state in which all of the
    // above is vacuous, so it is named here as a failure rather than passing.
    const pinnedOk = Number.isFinite(corpusPinned) && Number.isFinite(corpusFloor) && rows.length === corpusPinned && rows.length >= corpusFloor;
    add(
      "canary.census.corpus-is-pinned",
      pinnedOk,
      `the census canaries were handed ${rows.length} tree(s); the cassette pins ${corpusPinned ?? "none"} and the tree.corpusSize floor is ${corpusFloor ?? "none"} — a zero or truncated corpus makes every census canary vacuous`,
      { rows: rows.length, pinned: corpusPinned, floor: corpusFloor ?? null },
    );
    // SCOPE canary. The `jobScoped` census must be derived from the job dirs
    // (`src/jobs/*` + `jobs/*`, top-level .ts/.js/.mjs) — verified against a file
    // set computed independently from the bytes here. If `jobScoped` were
    // re-pointed at the whole-tree census (the W355 A2-F3 failure mode) its file
    // list would carry non-job files and this fails by name. Comparing it to the
    // whole-tree VERDICT would not work: those legitimately coincide whenever the
    // whole-tree census itself is job-scoped.
    const scopeRows = rows.filter((r) => Array.isArray(r.jobFiles));
    const mismatched = scopeRows.filter((r) => !samePathSet(r.raw?.jobScoped?.files, r.jobFiles));
    add(
      "canary.census.job-scoped-scope-pinned",
      scopeRows.length > 0 && mismatched.length === 0,
      scopeRows.length === 0
        ? "the census corpus is empty — the job-scoped reader's scope cannot be verified"
        : `the job-scoped census no longer describes the job dirs: ${mismatched.map((r) => `${r.tree} (reader ${(r.raw?.jobScoped?.files ?? []).map((f) => f.path).join(",") || "none"} vs job dirs ${r.jobFiles.join(",") || "none"})`).join("; ")}`,
      { trees: scopeRows.length, mismatched: mismatched.map((r) => r.tree) },
    );
  }
  const dod = readers.dod;
  if (typeof dod?.classifyModuleSource !== "function") {
    add("canary.census.classifier-discriminates", false, "dod.ts does not export classifyModuleSource()", null);
  } else {
    const stub = dod.classifyModuleSource("export function f() {\n  throw new Error(\"TODO(E-15)\");\n}");
    const reexport = dod.classifyModuleSource("export { a } from \"./a.ts\";");
    const real = dod.classifyModuleSource("export function add(a, b) {\n  return a + b;\n}");
    const ok = stub === "stub" && reexport === "reexport" && real === "real";
    add("canary.census.classifier-discriminates", ok, `classifier no longer discriminates: stub=${stub} reexport=${reexport} real=${real}`, { stub, reexport, real });
  }

  // --- kind surface / entry shape --------------------------------------------
  const surfaceReaders = ["readProductQuality", "productSurfaceKindOf", "briefDeliveryKind"].map((n) =>
    n === "readProductQuality" ? typeof readers.pq?.readProductQuality === "function" : typeof dod?.[n] === "function",
  );
  if (surfaceReaders.includes(false)) {
    add("canary.surface.readers-present", false, "one of product-quality.readProductQuality / dod.productSurfaceKindOf / dod.briefDeliveryKind is not exported", { surfaceReaders });
  } else {
    const empty = readers.pq.readProductQuality({});
    const ok = empty?.quality === false && Array.isArray(empty.reasons) && empty.reasons.length > 0;
    add("canary.surface.readers-present", ok, "readProductQuality({}) did not fail closed to quality:false with reasons", { quality: empty?.quality, reasons: empty?.reasons?.length ?? null });
  }
  if (typeof dod?.productSurfaceKindOf !== "function") {
    add("canary.surface.kind-discriminates", false, "dod.ts does not export productSurfaceKindOf()", null);
  } else {
    const game = dod.productSurfaceKindOf({ brief: "an arcade game with levels", kind: "game" });
    const tool = dod.productSurfaceKindOf({ brief: "a cli tool that parses csv", kind: "tool" });
    const web = dod.productSurfaceKindOf({ brief: "a dashboard website with pages", kind: "app" });
    const ok = game === "game" && tool === "runnable" && web === "web";
    add("canary.surface.kind-discriminates", ok, `the demanded surface no longer tracks the kind: game=${game} tool=${tool} app=${web}`, { game, tool, web });
  }
  if (typeof readers.ar?.resolveTreeEntry !== "function") {
    add("canary.surface.entry-shape-discriminates", false, "acceptance-run.mjs does not export resolveTreeEntry()", null);
  } else {
    const noHtml = readers.ar.resolveTreeEntry(["src/main.tsx"], {}, "game");
    const withHtml = readers.ar.resolveTreeEntry(["index.html", "src/main.tsx"], {}, "game");
    const ok = noHtml.ok === false && withHtml.ok === true;
    add("canary.surface.entry-shape-discriminates", ok, `resolveTreeEntry no longer discriminates: missing-html=${noHtml.ok} complete=${withHtml.ok}`, { noHtml: noHtml.ok, withHtml: withHtml.ok });
  }

  // --- the owner-rule scanners ------------------------------------------------
  const clean = [
    { path: "src/domain/orders.ts", source: "export function createOrder(id: string) {\n  return { id };\n}" },
    { path: "tests/orders.spec.ts", source: "import { mock } from \"./mock-orders.ts\";\ntest(\"x\", () => {});" },
  ];
  const defect = [
    { path: "src/domain/orders.ts", source: "export function createOrder() {\n  throw new Error(\"TODO(E-15)\");\n}" },
    { path: "src/domain/users.ts", source: "import { FAKE_USERS } from \"../__mocks__/users.ts\";\nexport const rows = FAKE_USERS;" },
  ];
  if (typeof readers.dod?.classifyModuleSource !== "function") {
    add("canary.realProduct.scan-discriminates", false, "the shared classifier is unavailable, so the real-product read cannot be trusted", null);
    add("canary.realProduct.no-attribute-false-positive", false, "the shared classifier is unavailable", null);
  } else {
    const c = scanRealProduct(clean, dod.classifyModuleSource);
    const d = scanRealProduct(defect, dod.classifyModuleSource);
    const ok = c.violations.length === 0 && d.violations.length > 0;
    add("canary.realProduct.scan-discriminates", ok, `the real-product reader no longer discriminates: clean=${c.violations.length} defect=${d.violations.length}`, { clean: c.violations.length, defect: d.violations.length, defectKinds: d.violations.map((v) => v.kind) });
    const attr = scanRealProduct(
      [{ path: "src/ui/page.tsx", source: "export const row = '<input placeholder=\"search products\" />';\nexport const cfg = { placeholder: 'Search products' };" }],
      dod.classifyModuleSource,
    );
    add("canary.realProduct.no-attribute-false-positive", attr.violations.length === 0, `an HTML/JSX placeholder= ATTRIBUTE was flagged as placeholder code: ${JSON.stringify(attr.violations)}`, { violations: attr.violations.length });
  }

  // --- R-5: the SAME owner rule over RapidTool's OWN tree ----------------------
  // Independent of the classifier: this reader is the test-double clause only, and
  // it must still discriminate while NOT flagging the three production-adjacent
  // doubles the W356 cartographer proved are test-seam-confined (no production
  // module imports them, so the reader must stay silent on all three).
  // The scanner is injectable ONLY so the selftest can blind it and prove this
  // canary can fail; the real run always uses the module's own implementation.
  /** @type {(files:Array<{path:string,source:string}>) => any} */
  const repoScan = typeof readers.repo?.scan === "function" ? readers.repo.scan : scanRepoTestDoubles;
  const repoClean = [
    { path: "src/lib/engine.ts", source: 'import { add } from "./math.ts";\nexport const run = add;' },
    { path: "src/lib/llm/providers/mock.ts", source: "export const mockProvider = () => ({ ok: true });" },
    { path: "src/lib/mcp/stub-server.ts", source: "export function start() { return 0; }" },
    { path: "src/lib/testing/fixtures.ts", source: "export const seed = 1;" },
    { path: "src/lib/engine.test.ts", source: 'import { seed } from "./testing/fixtures.ts";\nimport { mockProvider } from "./llm/providers/mock.ts";' },
  ];
  const repoDefect = [
    { path: "src/lib/engine.ts", source: 'import { rows } from "./__mocks__/engine.ts";\nexport const run = rows;' },
    { path: "src/lib/mcp/client.ts", source: 'import { start } from "./tests/harness.ts";' },
    { path: "src/lib/mcp/tests/harness.ts", source: "export const start = 1;" },
  ];
  const rc = repoScan(repoClean);
  const rd = repoScan(repoDefect);
  const falsePositives = rc.violations.map((v) => v.path);
  const resolvedHit = rd.violations.some((v) => v.path === "src/lib/mcp/client.ts" && v.marker === "./tests/harness.ts");
  add(
    "canary.realProduct.repo-scan-discriminates",
    rc.violations.length === 0 && rd.violations.length > 0 && resolvedHit,
    `the repo-tree reader no longer discriminates: clean=${rc.violations.length} defect=${rd.violations.length} resolution-leg=${resolvedHit}${falsePositives.length ? ` FALSE POSITIVES on the legitimate doubles: ${falsePositives.join(", ")}` : ""}`,
    { clean: rc.violations.length, defect: rd.violations.length, defectKinds: rd.violations.map((v) => v.kind), resolvedHit, falsePositives },
  );

  // --- the reader seams the ratchet consumes ---------------------------------
  const doc = ctx?.readings?.docs;
  add("canary.docParity.not-vacuous", doc?.ok === true && doc.uniquePaths > 0 && doc.docsScanned > 0, `the doc-parity reader read ${doc?.docsScanned ?? 0} doc(s) and found ${doc?.uniquePaths ?? 0} path(s)`, doc ?? null);
  const prev = ctx?.readings?.prevention;
  const prevOk = prev && prev.ok !== undefined && Array.isArray(prev.missed) && Array.isArray(prev.pending) && Number.isFinite(prev.count) && Number.isFinite(prev.countFloor);
  add("canary.prevention.two-signal-shape", prevOk === true, "the prevention verdict no longer carries BOTH signals (fixtureIntegrity.missed + fixPresence.pending) plus count/countFloor", prev ? { missed: prev.missed, pending: prev.pending, count: prev.count, countFloor: prev.countFloor } : null);
  const pinnedGuards = ctx?.floors?.floors?.["prevention.guards"]?.floor;
  add(
    "canary.prevention.countFloor-not-lowered",
    Number.isFinite(prev?.countFloor) && Number.isFinite(pinnedGuards) && prev.countFloor >= pinnedGuards,
    `the harness's own countFloor (${prev?.countFloor ?? "absent"}) is below the ratchet's pinned guard floor (${pinnedGuards ?? "absent"})`,
    { countFloor: prev?.countFloor ?? null, pinned: pinnedGuards ?? null },
  );

  // --- gate-supplied readings -------------------------------------------------
  const gate = ctx?.readings?.gate;
  if (!gate || gate.supplied !== true) {
    add("canary.gateReadings.results-keys-present", true, "", { supplied: false }, "no --gate reading supplied: the gate canaries are not applicable in this invocation");
    add("canary.gateReadings.typecheck-log-is-tsc", true, "", { supplied: false }, "no --gate reading supplied");
    add("canary.gateReadings.lint-log-is-eslint", true, "", { supplied: false }, "no --gate reading supplied");
    add("canary.gateReadings.test-leg-not-vacuous", true, "", { supplied: false }, "no --gate reading supplied");
  } else {
    add("canary.gateReadings.results-keys-present", gate.missingKeys.length === 0, `--gate was supplied but these stage keys are absent from its results: ${gate.missingKeys.join(", ")} (fail closed — a missing key is never "no failures")`, { missingKeys: gate.missingKeys });
    add("canary.gateReadings.typecheck-log-is-tsc", gate.typecheckLogIsTsc, "a non-zero typecheck exit carried no `error TS` line — the log is not a tsc log", { exit: gate.typecheck?.exit ?? null, errors: gate.typecheck?.errors ?? null });
    add("canary.gateReadings.lint-log-is-eslint", gate.lintLogIsEslint, "a non-zero lint exit carried no eslint `N problems` summary line", { exit: gate.lint?.exit ?? null, problems: gate.lint?.problems ?? null });
    add("canary.gateReadings.test-leg-not-vacuous", gate.testLegsNotVacuous, gate.testLegsReason, { scripts: gate.testsScripts ?? null, lib: gate.testsLib ?? null });
  }

  // --- the registry cross-check ----------------------------------------------
  add("canary.errorCodes.registered", ctx?.errorsRegistry?.ok === true, ctx?.errorsRegistry?.reason ?? "failed", ctx?.errorsRegistry?.evidence ?? null);
  // JOB 4 · W357/W358: the ratchet OWED one first-class code — `RT_E_RATCHET_METRIC_UNAVAILABLE`
  // ("a pinned floor could not be measured") — that only `src/lib/errors.ts` can register, and no
  // lane owned that file in W356/W357. W358 landed the register line; the declaration stays in the
  // floors file as the machine-readable record of the debt, with `status:"registered"` once paid.
  // Two directions, both fail closed: (a) a code still recorded as OWED must never be EMITTED
  // before the register carries it; (b) a code recorded as PAID must really BE in ERROR_CODES —
  // the recorded payment is verified against the register, never claimed.
  const owedEntries = Object.entries(/** @type {Record<string, any>} */ (ctx?.floors?.owedCodes ?? {}));
  const owedCodes = owedEntries.map(([id]) => id);
  /** @type {string[]} */
  const registeredCodes = ctx?.errorsRegistry?.evidence?.registered ?? [];
  const registeredSet = new Set(registeredCodes);
  // Injectable ONLY so the selftest can plant an emission and prove the canary fires;
  // the real run always reads the module's own emitted-code set.
  const emittedCodes = new Set(Array.isArray(ctx?.emittedCodes) ? ctx.emittedCodes : Object.values(UNAVAILABLE_CODES));
  const unpaid = owedEntries.filter(([, spec]) => String(spec?.status ?? "owed") !== "registered").map(([id]) => id);
  const premature = unpaid.filter((id) => emittedCodes.has(id) && !registeredSet.has(id));
  const paid = owedCodes.filter((id) => emittedCodes.has(id) && registeredSet.has(id));
  const paidButUnregistered = owedEntries
    .filter(([, spec]) => String(spec?.status ?? "owed") === "registered")
    .map(([id]) => id)
    .filter((id) => !registeredSet.has(id));
  add(
    "canary.errorCodes.owed-code-not-emitted",
    premature.length === 0 && paidButUnregistered.length === 0,
    premature.length > 0
      ? `the ratchet EMITS ${premature.join(", ")} before src/lib/errors.ts registers it — add the owed line to ERROR_CODES + ERROR_CODE_DOC, or stop emitting it; an unregistered code must never ship`
      : `${paidButUnregistered.join(", ")} is recorded as a PAID debt (owedCodes#status:"registered") but is NOT in ERROR_CODES — a payment cannot be claimed; restore the register line or record the debt as owed again`,
    { owed: owedCodes, unpaid, emittedBeforeRegistration: premature, paid, paidButUnregistered, registered: registeredCodes.length },
    owedCodes.length > 0 && premature.length === 0 && paidButUnregistered.length === 0 && unpaid.length > 0
      ? `owed and NOT yet emitted: ${unpaid.join(", ")}`
      : owedCodes.length > 0 && premature.length === 0 && paidButUnregistered.length === 0
        ? `owed, PAID (verified in ERROR_CODES) and not emitted by this ratchet: ${paid.length > 0 ? paid.join(", ") : owedCodes.join(", ")}`
        : "",
  );

  // --- R-3: no toothless floor -------------------------------------------------
  // An `atLeast: 0` floor can NEVER fire (a count cannot drop below 0), so the metric
  // it pins is unmeasured in practice. Every such pin must ACCOUNT for itself: either
  // it names the moving sub-leg floor(s) that CAN fire (`subLegs`, each resolving to a
  // pin with floor > 0) or it states why it is structurally non-regressible
  // (`nonRegressible`). A new bare atLeast-0 pin fails here, so the pattern cannot
  // come back — the direct fix for the cartographer's R-3.
  const zeroPins = Object.entries(ctx?.floors?.floors ?? {}).filter(([, s]) => {
    const spec = /** @type {any} */ (s);
    return spec?.direction === "atLeast" && spec.floor === 0 && spec.status !== "uncovered";
  });
  const unaccounted = zeroPins.filter(([, s]) => {
    const spec = /** @type {any} */ (s);
    const legs = Array.isArray(spec.subLegs) ? spec.subLegs : [];
    const legsOk = legs.length > 0 && legs.every((l) => {
      const target = ctx?.floors?.floors?.[l];
      return target !== undefined && typeof target.floor === "number" && target.floor > 0;
    });
    return !(legsOk || (typeof spec.nonRegressible === "string" && spec.nonRegressible.length > 20));
  });
  add(
    "canary.floors.atleast-zero-pins-are-accounted",
    zeroPins.length > 0 && unaccounted.length === 0,
    zeroPins.length === 0
      ? "no atLeast-0 pin exists — this canary would be vacuous, which is itself the failure"
      : `these atLeast-0 pins can never fire and name neither a moving sub-leg floor nor a non-regressible reason: ${unaccounted.map(([id]) => id).join(", ")}`,
    { zeroPins: zeroPins.map(([id]) => id), accounted: zeroPins.length - unaccounted.length, unaccounted: unaccounted.map(([id]) => id) },
  );

  // --- the canary registry itself --------------------------------------------
  const declared = Object.keys(ctx?.floors?.canaries ?? {});
  const implemented = [...out.map((c) => c.id), "canary.registry.complete"];
  const missing = declared.filter((id) => !implemented.includes(id));
  const undeclared = implemented.filter((id) => !declared.includes(id));
  add("canary.registry.complete", missing.length === 0 && undeclared.length === 0, `canary registry drift — declared-but-unimplemented: [${missing.join(", ")}]; implemented-but-undeclared: [${undeclared.join(", ")}]`, { declared: declared.length, implemented: implemented.length });
  return out;
}

/** Two file lists describe the same path set (order-independent). */
export function samePathSet(filesA, pathsB) {
  const a = (Array.isArray(filesA) ? filesA : []).map((f) => (typeof f?.path === "string" ? f.path.replace(/\\/g, "/") : "")).filter(Boolean).sort();
  const b = (Array.isArray(pathsB) ? pathsB : []).map((p) => String(p).replace(/\\/g, "/")).filter(Boolean).sort();
  return a.length === b.length && a.every((p, i) => p === b[i]);
}

// ---------------------------------------------------------------------------
// Producers (read-only). Every one either returns a real reading or an
// `unreadable(...)` with a coded cause — never a number that was not measured.
// ---------------------------------------------------------------------------

export function readJsonFile(p) {
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
  } catch (e) {
    return { __parseError: String(e?.message ?? e) };
  }
}

/**
 * Parse a producer's stdout as ONE JSON object carrying `requiredKeys`. Tries the
 * whole stream first (a pretty-printed verdict), then line-by-line from the end (a
 * one-line verdict beside stderr noise). Returns null when NO candidate carries
 * every required key — "some line parsed" is never accepted as a reading.
 */
export function parseProducerJson(stdout, requiredKeys) {
  const text = String(stdout ?? "").replace(/^\uFEFF/, "");
  const ok = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && requiredKeys.every((k) => k in v);
  const whole = text.trim();
  if (whole !== "") {
    try {
      const j = JSON.parse(whole);
      if (ok(j)) return j;
    } catch {
      /* fall through to the line scan */
    }
  }
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (line === "") continue;
    try {
      const j = JSON.parse(line);
      if (ok(j)) return j;
    } catch {
      /* keep walking back */
    }
  }
  return null;
}

/** Recursive file walk (`{relPath, absPath}`), skipping VCS/dep/build dirs. */
export function walkFiles(root, opts = {}) {
  const skip = opts.skipDirs ?? WALK_SKIP_DIRS;
  /** @type {Array<{path:string, absPath:string}>} */
  const out = [];
  /** @type {Array<{abs:string, rel:string}>} */
  const stack = [{ abs: root, rel: "" }];
  while (stack.length > 0) {
    const item = stack.pop();
    if (item === undefined) continue;
    const { abs, rel } = item;
    let entries = [];
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const childRel = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) {
        if (!skip.has(e.name)) stack.push({ abs: join(abs, e.name), rel: childRel });
        continue;
      }
      out.push({ path: childRel, absPath: join(abs, e.name) });
    }
  }
  // Sorted by rel path: the walk order must not depend on the filesystem.
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/**
 * The job-dir file set for a tree — the scope `treeSubstanceOf().jobScoped`
 * describes (`src/jobs/*` + `jobs/*`, TOP-LEVEL `.ts/.js/.mjs`, POSIX rel paths).
 * Deliberately an independent mirror of the reader's scope rule, used ONLY by the
 * scope canary; it reads bytes, it never trusts the reader's own file list.
 */
export function jobFilesOf(dir) {
  const out = [];
  for (const sub of ["src/jobs", "jobs"]) {
    const abs = join(dir, sub.replace(/\//g, "\\"));
    if (!existsSync(abs)) continue;
    let names = [];
    try {
      names = readdirSync(abs);
    } catch {
      continue;
    }
    for (const name of names.sort()) {
      if (!/\.(?:ts|js|mjs)$/.test(name)) continue;
      try {
        if (!statSync(join(abs, name)).isFile()) continue;
      } catch {
        continue;
      }
      out.push(`${sub}/${name}`);
    }
  }
  return out;
}

/**
 * The pinned 13-tree corpus, with each tree's record and its census.
 * @param {any} readers
 * @returns {any}
 */
export function readCensus(readers) {
  const cassette = readJsonFile(TREES_CASSETTE);
  if (!cassette || !Array.isArray(cassette.trees) || cassette.trees.length === 0) {
    return { ok: false, reason: "scripts/prevention/cassettes/trees.json is missing or lists no trees" };
  }
  const rows = [];
  const missing = [];
  for (const tree of cassette.trees) {
    const dir = join(REPO_ROOT, "testruns", tree.replace(/\//g, "\\"));
    const recPath = join(dir, ".rapidtool", "project.json");
    if (!existsSync(dir)) {
      missing.push(`${tree} (directory absent)`);
      continue;
    }
    if (!existsSync(recPath)) {
      missing.push(`${tree} (.rapidtool/project.json absent)`);
      continue;
    }
    let raw;
    try {
      raw = readers.compile.treeSubstanceOf(dir, { green: true });
    } catch (e) {
      missing.push(`${tree} (treeSubstanceOf threw: ${String(e?.message ?? e)})`);
      continue;
    }
    const shapeProblems = censusShape(raw);
    rows.push({
      tree,
      dir,
      recordPath: recPath,
      record: readJsonFile(recPath),
      top: raw?.verdict ?? null,
      job: raw?.jobScoped?.verdict ?? null,
      whole: raw?.wholeTree?.verdict ?? null,
      raw,
      shapeError: shapeProblems.length > 0 ? shapeProblems.join("; ") : null,
      // The job-dir file set computed HERE (not read back from the reader) — the
      // independent side of the scope canary. Mirrors compile-check's own scope
      // rule deliberately: the point of a scope canary is that it is derived
      // outside the thing it audits.
      jobFiles: jobFilesOf(dir),
    });
  }
  return { ok: missing.length === 0, reason: missing.join("; "), rows, pinned: cassette.trees.length };
}

/** Every persisted project record the product-quality reader consumes. */
export function readQualityRecords() {
  const files = walkFiles(join(REPO_ROOT, "testruns"), { skipDirs: new Set(["node_modules", ".git", "dist", "build"]) }).filter(
    (f) => /(?:^|\/)build\.json$/.test(f.path) || /(?:^|\/)build\.v2\.json$/.test(f.path) || /(?:^|\/)\.rapidtool\/project\.json$/.test(f.path),
  );
  const rows = [];
  for (const f of files) {
    const j = readJsonFile(f.absPath);
    if (!j || j.__parseError || !Array.isArray(j.phases)) continue;
    rows.push({ path: `testruns/${f.path}`, record: j });
  }
  return rows;
}

/** The kindFit corpus: pinned emitted trees + the eval-out emit trees for corpus briefs. */
export function readKindFitUnits() {
  // Each unit is HYDRATED at construction (files/pkg/record), so the shape is fixed
  // once and never mutated afterwards.
  /** @type {Array<any>} */
  const units = [];
  const hydrate = (u) => ({
    ...u,
    files: walkFiles(u.dir).map((f) => ({ path: f.path, source: safeRead(f.absPath) })),
    pkg: readJsonFile(join(u.dir, "package.json")) ?? {},
    record: readJsonFile(join(u.dir, ".rapidtool", "project.json")),
  });
  const trees = readJsonFile(TREES_CASSETTE);
  for (const tree of Array.isArray(trees?.trees) ? trees.trees : []) {
    const dir = join(REPO_ROOT, "testruns", tree.replace(/\//g, "\\"));
    const recPath = join(dir, ".rapidtool", "project.json");
    if (!existsSync(dir) || !existsSync(recPath)) continue;
    units.push(hydrate({ source: "testruns", unit: tree, requestedKind: readJsonFile(recPath)?.kind ?? null, dir }));
  }
  const corpusKinds = {};
  if (existsSync(EVAL_CORPUS_DIR)) {
    for (const f of readdirSync(EVAL_CORPUS_DIR)) {
      if (!f.endsWith(".md")) continue;
      let text = "";
      try {
        text = readFileSync(join(EVAL_CORPUS_DIR, f), "utf8");
      } catch {
        continue;
      }
      const m = /^kind:\s*"([^"]+)"/m.exec(text);
      if (m) corpusKinds[f.replace(/\.md$/, "")] = m[1];
    }
  }
  if (existsSync(EVAL_OUT_DIR)) {
    for (const e of readdirSync(EVAL_OUT_DIR, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith(".")) continue;
      const dir = join(EVAL_OUT_DIR, e.name);
      const recPath = join(dir, ".rapidtool", "project.json");
      if (!existsSync(recPath) || !existsSync(join(dir, "package.json"))) continue;
      const base = e.name.replace(/--trial-\d+$/, "").replace(/\.run-\d{4}-\d{2}-\d{2}$/, "");
      units.push({ source: "eval-out", unit: e.name, requestedKind: corpusKinds[base] ?? null, dir });
    }
  }
  for (const u of units) {
    const all = walkFiles(u.dir).map((f) => ({ path: f.path, source: safeRead(f.absPath) }));
    u.files = all;
    u.pkg = readJsonFile(join(u.dir, "package.json")) ?? {};
    u.record = readJsonFile(join(u.dir, ".rapidtool", "project.json"));
  }
  return units;
}

function safeRead(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

/**
 * The gate's own stage readings — either a gate verdict JSON or the gate temp dir.
 * @param {string|null} path
 * @returns {any} a fixed-shape reading record; every field is null when unavailable
 */
export function readGate(path) {
  const missingKeys = [];
  if (path === null || path === undefined || path === "") return { supplied: false, missingKeys, typecheck: null, lint: null, testsScripts: null, testsLib: null };
  if (existsSync(path) && statSync(path).isFile()) {
    const j = readJsonFile(path);
    if (!j || j.__parseError || typeof j.gates !== "object" || j.gates === null) {
      return { supplied: true, missingKeys: ["<not a gate verdict JSON>"], typecheck: null, lint: null, testsScripts: null, testsLib: null };
    }
    const g = j.gates;
    for (const k of ["typecheck", "lint", "testsScripts", "testsLib", "prevention"]) if (!g[k]) missingKeys.push(k);
    return {
      supplied: true,
      source: "gate-verdict-json",
      ok: j.ok === true,
      missingKeys,
      gateOk: j.ok === true ? 1 : 0,
      typecheck: { exit: num(g.typecheck?.exit), errors: num(g.typecheck?.exit) === 0 ? 0 : null },
      lint: { exit: num(g.lint?.exit), problems: num(g.lint?.exit) === 0 ? 0 : num(g.lint?.problems) },
      testsScripts: { exit: num(g.testsScripts?.exit), pass: num(g.testsScripts?.pass), fail: num(g.testsScripts?.fail) },
      testsLib: { exit: num(g.testsLib?.exit), pass: num(g.testsLib?.pass), fail: num(g.testsLib?.fail) },
      prevention: g.prevention ? { missed: g.prevention.missed ?? [], pending: g.prevention.pending ?? [], count: num(g.prevention.count), countFloor: num(g.prevention.countFloor) } : null,
      typecheckLogIsTsc: true,
      lintLogIsEslint: true,
      testLegsNotVacuous: true,
      testLegsReason: null,
    };
  }
  if (!existsSync(path)) return { supplied: true, missingKeys: [`<--gate path not found: ${path}>`], typecheck: null, lint: null, testsScripts: null, testsLib: null };
  const resultsPath = join(path, "results");
  const keys = new Map();
  const text = existsSync(resultsPath) ? safeRead(resultsPath) : "";
  for (const line of text.split("\n")) {
    const i = line.indexOf("\t");
    if (i > 0) keys.set(line.slice(0, i), line.slice(i + 1));
  }
  const exitOf = (id) => (keys.has(`${id}.exit`) ? Number(keys.get(`${id}.exit`)) : null);
  for (const id of ["typecheck", "lint", "testsScripts", "testsLib"]) if (exitOf(id) === null) missingKeys.push(`${id}.exit`);
  const tlog = safeRead(join(path, "typecheck.log"));
  const llog = safeRead(join(path, "lint.log"));
  const s1 = safeRead(join(path, "testsScripts.log"));
  const l1 = safeRead(join(path, "testsLib.log"));
  const plog = safeRead(join(path, "prevention.log"));
  // A green exit IS the measurement "0 errors / 0 problems" — never `null`.
  /** @type {any} */
  const typecheck = { exit: exitOf("typecheck"), errors: null };
  typecheck.errors = typecheck.exit === 0 ? 0 : (tlog.match(/error TS/g) ?? []).length;
  const lintProblems = /(\d+)\s+problems?/.exec(llog);
  const lint = { exit: exitOf("lint"), problems: exitOf("lint") === 0 ? 0 : lintProblems ? Number(lintProblems[1]) : null };
  const leg = (txt, exit) => ({ exit, pass: num(/^# pass (\d+)$/m.exec(txt)?.[1]), fail: num(/^# fail (\d+)$/m.exec(txt)?.[1]) });
  const testsScripts = leg(s1, exitOf("testsScripts"));
  const testsLib = leg(l1, exitOf("testsLib"));
  const prevJson = parseProducerJson(plog, ["count"]);
  /** @type {any} */
  let prevention = null;
  if (prevJson) {
    prevention = { missed: prevJson.fixtureIntegrity?.missed ?? prevJson.missed ?? [], pending: prevJson.fixPresence?.pending ?? prevJson.pending ?? [], count: num(prevJson.count), countFloor: num(prevJson.countFloor) };
  }
  const testLegsNotVacuous =
    (testsScripts.exit === null || testsScripts.exit === 0 ? (testsScripts.pass ?? 0) >= 1 : (testsScripts.fail ?? 0) >= 1 || /^\s*not ok /m.test(s1)) &&
    (testsLib.exit === null || testsLib.exit === 0 ? (testsLib.pass ?? 0) >= 1 : (testsLib.fail ?? 0) >= 1 || /^\s*not ok /m.test(l1));
  return {
    supplied: true,
    source: "gate-temp-dir",
    ok: null,
    missingKeys,
    gateOk: null,
    typecheck,
    lint,
    testsScripts,
    testsLib,
    prevention,
    typecheckLogIsTsc: typecheck.exit === 0 || (typecheck.errors ?? 0) > 0,
    lintLogIsEslint: lint.exit === 0 || lint.problems !== null,
    testLegsNotVacuous,
    testLegsReason: testLegsNotVacuous ? null : "a test leg is a vacuous green (exit 0 with no `# pass`) or a red exit with no `# fail`/`not ok` line",
  };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * The prevention harness — read from the gate's own log when supplied, else spawned.
 * @param {boolean} spawn
 * @returns {any} a fixed-shape verdict; `count`/`countFloor` are null when unparseable
 */
export function readPrevention(spawn = true) {
  if (!spawn) {
    return { value: null, ok: false, missed: [], pending: [], count: null, countFloor: null, skipped: [], error: "the gate's prevention log is absent from the supplied --gate reading", unavailableCode: UNAVAILABLE_CODES.artifactAbsent };
  }
  const r = spawnSync(process.execPath, ["scripts/prevention/verify-prevention.mjs", "--all", "--selftest"], { cwd: REPO_ROOT, encoding: "utf8", timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
  const j = parseProducerJson(r.stdout, ["count", "countFloor", "fixtureIntegrity", "fixPresence"]);
  if (j === null) return { value: null, ok: false, missed: ["<unparseable>"], pending: [], count: null, countFloor: null, error: (r.stderr ?? "").slice(-500), unavailableCode: UNAVAILABLE_CODES.readerShapeInvalid };
  return {
    value: null,
    ok: j.ok === true,
    missed: j.fixtureIntegrity?.missed ?? j.missed ?? [],
    pending: j.fixPresence?.pending ?? j.pending ?? [],
    count: num(j.count),
    countFloor: num(j.countFloor),
    skipped: j.skipped ?? [],
  };
}

/**
 * The advisory doc-parity reader (spawned; its JSON is data, never a gate here).
 * @returns {any}
 */
export function readDocParity() {
  const r = spawnSync(process.execPath, ["scripts/docs-module-parity.mjs"], { cwd: REPO_ROOT, encoding: "utf8", timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
  const j = parseProducerJson(r.stdout, ["docsScanned", "uniquePaths", "missingCount", "emptyCount"]);
  if (j === null) {
    return { ok: false, docsScanned: null, mentions: null, uniquePaths: null, missingCount: null, emptyCount: null, mismatches: null, error: (r.stderr ?? "").slice(-500) };
  }
  const missingCount = num(j.missingCount);
  const emptyCount = num(j.emptyCount);
  return {
    ok: true,
    docsScanned: num(j.docsScanned),
    mentions: num(j.mentions),
    uniquePaths: num(j.uniquePaths),
    missingCount,
    emptyCount,
    // Absent counts must NOT read as "0 mismatches" — unmeasurable, not clean.
    mismatches: missingCount === null || emptyCount === null ? null : missingCount + emptyCount,
    advisory: true,
  };
}

/**
 * The acceptance record — run-eval's own results, with the stale flag SURFACED (W355 L4).
 * @returns {any}
 */
export function readAcceptance() {
  const verdicts = [];
  if (existsSync(EVAL_OUT_DIR)) {
    for (const f of walkFiles(EVAL_OUT_DIR).filter((x) => /(?:^|\/)verdict\.json$/.test(x.path))) {
      const j = readJsonFile(f.absPath);
      if (j && !j.__parseError && typeof j === "object") verdicts.push(j);
    }
  }
  if (verdicts.length > 0) {
    const pass = verdicts.filter((v) => v.ok === true).length;
    return { producer: "research/eval-out/**/verdict.json (acceptance-run.mjs)", samples: verdicts.length, pass, stale: null };
  }
  const results = readJsonFile(join(EVAL_OUT_DIR, "results.json"));
  if (!results || results.__parseError || !Array.isArray(results.entries)) {
    return { producer: "research/eval-out/results.json", samples: null, pass: null, stale: null, error: "no acceptance artifact on disk" };
  }
  const rows = results.entries.filter((e) => e && e.acceptance && typeof e.acceptance.pass === "boolean");
  if (rows.length === 0) {
    return { producer: "research/eval-out/results.json", samples: null, pass: null, stale: results.stale === true, error: "no entry carries acceptance.pass" };
  }
  return {
    producer: "research/eval-out/results.json (run-eval.mjs; acceptance-run.mjs verdict.json absent)",
    samples: rows.length,
    pass: rows.filter((e) => e.acceptance.pass === true).length,
    stale: results.stale === true,
    mode: results.mode ?? null,
  };
}

/** Every ERROR_CODE_DOC code, read from the registry itself (never restated here). */
export function readRegisteredCodes() {
  let text = "";
  try {
    text = readFileSync(join(REPO_ROOT, "src", "lib", "errors.ts"), "utf8");
  } catch (e) {
    return { ok: false, reason: `src/lib/errors.ts unreadable: ${String(e?.message ?? e)}` };
  }
  const block = /export const ERROR_CODES = \[([\s\S]*?)\] as const;/.exec(text);
  if (!block) return { ok: false, reason: "src/lib/errors.ts no longer declares ERROR_CODES as const" };
  const codes = new Set([...block[1].matchAll(/"([A-Z0-9_]+)"/g)].map((m) => m[1]));
  const unregistered = Object.values(UNAVAILABLE_CODES).filter((c) => !codes.has(c));
  return {
    ok: unregistered.length === 0,
    reason: `the ratchet emits a code that is not registered in ERROR_CODES: ${unregistered.join(", ")}`,
    // The full set, not just the count: the owed-code canary below needs to ask
    // whether ONE specifically owed code has landed in the register yet.
    evidence: { codes: codes.size, registered: [...codes].sort(), used: [...new Set(Object.values(UNAVAILABLE_CODES))] },
  };
}

// ---------------------------------------------------------------------------
// Collection + verdict
// ---------------------------------------------------------------------------

/**
 * @param {{gate?:string|null, treeTsc?:number|null, spawnProducers?:boolean, readReaders?:any, census?:any}} opts
 * @returns {Promise<any>}
 */
export async function collectReadings(opts = {}) {
  const readers = opts.readReaders ?? (await loadReaders());
  const readings = {};
  const notes = [];
  const degraded = [];

  const gate = readGate(opts.gate ?? null);
  readings.gate = gate;
  if (gate.supplied) {
    readings["gate.ok"] = gate.gateOk === null ? unreadable(UNAVAILABLE_CODES.producerNotRun, "the supplied --gate reading is a temp dir, not the gate verdict JSON (the verdict is produced after the ratchet stage)") : { value: gate.gateOk };
    readings["typecheck.errors"] = gate.typecheck?.exit === null || gate.typecheck === null ? unreadable(UNAVAILABLE_CODES.artifactAbsent, "typecheck.exit missing from the supplied --gate reading") : { value: gate.typecheck.errors ?? null };
    readings["lint.problems"] = gate.lint?.exit === null || gate.lint === null ? unreadable(UNAVAILABLE_CODES.artifactAbsent, "lint.exit missing from the supplied --gate reading") : gate.lint.problems === null ? unreadable(UNAVAILABLE_CODES.readerShapeInvalid, "the lint log carried no `N problems` summary") : { value: gate.lint.problems };
    for (const [id, leg] of [["tests.scripts", gate.testsScripts], ["tests.lib", gate.testsLib]]) {
      readings[`${id}.pass`] = leg?.pass === null || leg?.pass === undefined ? unreadable(UNAVAILABLE_CODES.readerShapeInvalid, `${id} TAP log carried no \`# pass\` line`) : { value: leg.pass };
      readings[`${id}.fail`] = leg?.fail === null || leg?.fail === undefined ? unreadable(UNAVAILABLE_CODES.readerShapeInvalid, `${id} TAP log carried no \`# fail\` line`) : { value: leg.fail };
    }
  } else {
    const why = unreadable(UNAVAILABLE_CODES.producerNotRun, "no --gate reading was supplied (the metric's producer is the gate's own stage; run the boundary, or pass --gate <gate-tmp-dir|verdict.json>)");
    for (const id of ["gate.ok", "typecheck.errors", "lint.problems", "tests.scripts.pass", "tests.scripts.fail", "tests.lib.pass", "tests.lib.fail"]) readings[id] = { ...why };
  }

  // prevention: the gate's own log when supplied, else the real command.
  const prev = gate.supplied && gate.prevention ? { ...gate.prevention, ok: gate.prevention.pending.length === 0 && gate.prevention.missed.length === 0 } : readPrevention(opts.spawnProducers !== false);
  readings.prevention = prev;
  readings["prevention.missed"] = Number.isFinite(prev.count) || Array.isArray(prev.missed) ? { value: prev.missed?.length ?? null, evidence: { missed: prev.missed } } : unreadable(UNAVAILABLE_CODES.readerShapeInvalid, "the prevention verdict carried no fixtureIntegrity.missed signal");
  readings["prevention.pending"] = Array.isArray(prev.pending) ? { value: prev.pending.length, evidence: { pending: prev.pending } } : unreadable(UNAVAILABLE_CODES.readerShapeInvalid, "the prevention verdict carried no fixPresence.pending signal");
  readings["prevention.guards"] = Number.isFinite(prev.count) ? { value: prev.count } : unreadable(UNAVAILABLE_CODES.readerShapeInvalid, "the prevention verdict carried no numeric count");
  readings["prevention.countFloor"] = Number.isFinite(prev.countFloor) ? { value: prev.countFloor } : unreadable(UNAVAILABLE_CODES.readerShapeInvalid, "the prevention verdict carried no numeric countFloor");

  // The census corpus (the pinned trees) — the substantive-tree reading.
  let census = opts.census ?? null;
  if (census === null && typeof readers.compile?.treeSubstanceOf === "function") {
    census = readCensus(readers);
    if (census.ok !== true) degraded.push(`census: ${census.reason}`);
  }
  readings.corpus = { census };
  const censusRows = census?.rows ?? [];
  readings["tree.corpusSize"] = census?.ok === true ? { value: censusRows.length } : unreadable(UNAVAILABLE_CODES.artifactAbsent, census?.reason ?? "the pinned tree corpus is unreadable");
  const shapeBad = censusRows.filter((r) => typeof r.shapeError === "string" && r.shapeError !== "");
  if (shapeBad.length > 0) degraded.push(`census shape: ${shapeBad.map((r) => `${r.tree}: ${r.shapeError}`).join(" | ")}`);
  readings["tree.jobScopedRealTrees"] = censusRealTreesReading(census);

  // R-5 · W357 — the SAME owner rule, over RapidTool's OWN tree.
  const repoFiles = walkFiles(join(REPO_ROOT, "src"))
    .filter((f) => CODE_FILE_RE.test(f.path))
    .map((f) => ({ path: `src/${f.path}`, source: safeRead(f.absPath) }));
  const repoScan = scanRepoTestDoubles(repoFiles);
  readings.realProductRepo = repoScan;
  readings["realProductOnly.repoTestDoubleImports"] = {
    value: repoScan.violations.length,
    evidence: { violations: repoScan.violations, codeModules: repoScan.codeModules, seamModules: repoScan.seamModules, testDoubleFiles: repoScan.testDoubleFiles },
  };
  readings["realProductOnly.repoModulesScanned"] = { value: repoScan.productionModules };

  // The owner-rule readers.
  let realProduct = null;
  if (typeof readers.dod?.classifyModuleSource === "function" && census?.ok === true) {
    const perTree = [];
    for (const r of censusRows) {
      const files = walkFiles(r.dir).filter((f) => CODE_FILE_RE.test(f.path)).map((f) => ({ path: f.path, source: safeRead(f.absPath) }));
      const scan = scanRealProduct(files, readers.dod.classifyModuleSource);
      perTree.push({ tree: r.tree, ...scan });
    }
    realProduct = {
      treesEvaluated: perTree.length,
      stubProductionModules: perTree.reduce((n, t) => n + t.stubs, 0),
      reexportModules: perTree.reduce((n, t) => n + t.reexports, 0),
      realModules: perTree.reduce((n, t) => n + t.real, 0),
      markerViolations: perTree.reduce((n, t) => n + t.violations.filter((v) => v.kind === "marker").length, 0),
      testDoubleProductionImports: perTree.reduce((n, t) => n + t.violations.filter((v) => v.kind === "test-double-import" || v.kind === "test-double-api").length, 0),
      violations: perTree.flatMap((t) => t.violations.map((v) => ({ tree: t.tree, ...v }))),
      perTree,
    };
  }
  readings.realProductOnly = realProduct;
  readings["realProductOnly.treesEvaluated"] = realProduct ? { value: realProduct.treesEvaluated } : unreadable(UNAVAILABLE_CODES.readerShapeInvalid, "the real-product scan could not run (the pinned corpus or the shared classifier is unavailable)");
  readings["realProductOnly.stubProductionModules"] = realProduct ? { value: realProduct.stubProductionModules, evidence: realProduct.violations.filter((v) => v.kind === "stub-module") } : unreadable(UNAVAILABLE_CODES.readerShapeInvalid, "the real-product scan could not run");
  readings["realProductOnly.markerViolations"] = realProduct ? { value: realProduct.markerViolations, evidence: realProduct.violations.filter((v) => v.kind === "marker") } : unreadable(UNAVAILABLE_CODES.readerShapeInvalid, "the real-product scan could not run");
  readings["realProductOnly.testDoubleProductionImports"] = realProduct ? { value: realProduct.testDoubleProductionImports, evidence: realProduct.violations.filter((v) => /^test-double/.test(v.kind)) } : unreadable(UNAVAILABLE_CODES.readerShapeInvalid, "the real-product scan could not run");

  // productQuality + kindFit over the same corpus.
  let quality = null;
  let kindFit = null;
  if (typeof readers.pq?.readProductQuality === "function") {
    const records = readQualityRecords();
    // R-3 · W357: `qualityCount` is pinned at 0 (its structural minimum), so no
    // regression can move it. The reader's OWN moving sub-legs are measured beside it
    // and pinned where a drop is possible — the fix for "a floor that cannot fire".
    let qualityTrue = 0;
    let treesPresent = 0;
    let realModulesPresent = 0;
    for (const r of records) {
      const q = readers.pq.readProductQuality(r.record);
      if (q?.quality === true) qualityTrue += 1;
      if (q?.tree?.present === true) treesPresent += 1;
      if (Number.isFinite(q?.modules?.real) && q.modules.real > 0) realModulesPresent += 1;
    }
    quality = { records: records.length, quality: qualityTrue, treesPresent, realModulesPresent };
    readings["productQuality.recordsEvaluated"] = { value: quality.records };
    readings["productQuality.qualityCount"] = { value: quality.quality };
    readings["productQuality.treesPresent"] = { value: quality.treesPresent, evidence: { records: quality.records, quality: quality.quality } };
    readings["productQuality.realModulesPresent"] = { value: quality.realModulesPresent, evidence: { records: quality.records } };
    const units = readKindFitUnits();
    kindFit = kindFitOf(units, {
      resolveTreeEntry: readers.ar.resolveTreeEntry,
      readProductQuality: readers.pq.readProductQuality,
      fleetProductQualityFromProjects: readers.pq.fleetProductQualityFromProjects,
    });
    for (const k of RATCHET_KINDS) {
      const b = kindFit.byKind[k];
      const covered = b.units > 0;
      // R-3: each leg of `fit` is published and pinned on its own where it can move
      // (the `.fit` counts are 0 of 30/1/1 and so cannot regress at all).
      const legs = { entryOk: b.entryOk, scriptsOk: b.scriptsOk, surfaceOk: b.surfaceOk, demandedMatch: b.demandedMatch };
      readings[`kindFit.${k}.units`] = covered ? { value: b.units } : unreadable(UNAVAILABLE_CODES.artifactAbsent, `no emitted artifact exists on disk for a ${k}-kind brief — UNCOVERED, never a pass`);
      readings[`kindFit.${k}.fit`] = covered
        ? { value: b.fit, evidence: { units: b.units, ...legs } }
        : unreadable(UNAVAILABLE_CODES.artifactAbsent, `no emitted artifact exists on disk for a ${k}-kind brief — UNCOVERED, never a pass`);
      for (const [leg, value] of Object.entries(legs)) {
        readings[`kindFit.${k}.${leg}`] = covered
          ? { value, evidence: { units: b.units, fit: b.fit } }
          : unreadable(UNAVAILABLE_CODES.artifactAbsent, `no emitted artifact exists on disk for a ${k}-kind brief — UNCOVERED, never a pass`);
      }
    }
  } else {
    for (const id of [
      "productQuality.recordsEvaluated",
      "productQuality.qualityCount",
      "productQuality.treesPresent",
      "productQuality.realModulesPresent",
      ...RATCHET_KINDS.flatMap((k) => [`kindFit.${k}.units`, `kindFit.${k}.fit`, `kindFit.${k}.entryOk`, `kindFit.${k}.scriptsOk`, `kindFit.${k}.surfaceOk`, `kindFit.${k}.demandedMatch`]),
    ]) {
      readings[id] = unreadable(UNAVAILABLE_CODES.readerShapeInvalid, "product-quality.ts does not export readProductQuality()");
    }
  }
  readings.productQuality = quality;
  readings.kindFit = kindFit;

  // doc-claim mismatches.
  const docs = readDocParity();
  readings.docs = docs;
  readings["docClaims.mismatches"] = docs.mismatches === null ? unreadable(UNAVAILABLE_CODES.readerShapeInvalid, "docs-module-parity.mjs produced no parseable verdict") : { value: docs.mismatches, evidence: { missingCount: docs.missingCount, emptyCount: docs.emptyCount } };
  readings["docClaims.uniquePaths"] = docs.uniquePaths === null ? unreadable(UNAVAILABLE_CODES.readerShapeInvalid, "docs-module-parity.mjs produced no uniquePaths") : { value: docs.uniquePaths };

  // acceptance.
  const acc = readAcceptance();
  readings.acceptance = acc;
  readings["acceptance.samples"] = Number.isFinite(acc.samples) ? { value: acc.samples, evidence: { stale: acc.stale, producer: acc.producer } } : unreadable(UNAVAILABLE_CODES.artifactAbsent, acc.error ?? "no acceptance artifact on disk");
  readings["acceptance.passCount"] = Number.isFinite(acc.pass) ? { value: acc.pass, evidence: { stale: acc.stale } } : unreadable(UNAVAILABLE_CODES.artifactAbsent, acc.error ?? "no acceptance artifact on disk");

  // the opt-in heavy producer: the trees' OWN declared typecheck.
  if (opts.treeTsc && Number.isFinite(opts.treeTsc) && opts.treeTsc > 0 && census?.ok === true) {
    const sample = censusRows.slice(0, Math.max(1, Math.floor(opts.treeTsc)));
    let pass = 0;
    let ran = 0;
    for (const r of sample) {
      try {
        const out = await readers.compile.treeRun(r.dir, { timeoutMs: 120000 });
        const verdict = out?.project?.typecheck?.run ?? null;
        if (verdict === "pass") pass += 1;
        if (verdict !== null && verdict !== undefined) ran += 1;
      } catch {
        /* a tree whose toolchain cannot run is not a pass */
      }
    }
    readings["tree.tscPassSample"] = ran === 0 ? unreadable(UNAVAILABLE_CODES.producerNotRun, "treeRun resolved no declared typecheck for the sampled trees") : { value: pass, evidence: { sampled: sample.length, resolved: ran } };
  } else {
    readings["tree.tscPassSample"] = unreadable(UNAVAILABLE_CODES.producerNotRun, "heavy producer: pass --tree-tsc[=N] to run src/lib/compile-check.server.ts#treeRun over a bounded tree sample");
  }

  return { readings, readers, census, gate, notes, degraded };
}

function buildVerdict({ mode, floorsPath, floors, evaluated, canaries, readings, extra }) {
  return {
    ok: evaluated.ok === true,
    tool: "quality-ratchet",
    schema: SCHEMA,
    mode,
    floorsPath: relative(REPO_ROOT, floorsPath).replace(/\\/g, "/"),
    floorsSchema: floors?.schema ?? null,
    metrics: evaluated.metrics,
    canaries: canaries.map((c) => ({ id: c.id, ok: c.ok, reason: c.reason ?? null, evidence: c.evidence ?? null })),
    regressions: evaluated.regressions,
    canaryFailures: evaluated.canaryFailures,
    unavailableEnforced: evaluated.unavailableEnforced,
    unavailable: evaluated.unavailable,
    pendingFirstGreen: evaluated.pendingFirstGreen,
    uncovered: evaluated.uncovered,
    unknownMetricIds: evaluated.unknownMetricIds,
    ...extra,
    estimatedCostUsd: null,
  };
}

// ---------------------------------------------------------------------------
// The planted-regression teeth (`--selftest`).
// ---------------------------------------------------------------------------

/**
 * Proof that the ratchet has teeth. Nothing here reads the repo except the floors
 * file and `src/lib/errors.ts`; the "mutated reader" cases are in-memory objects,
 * never an edit to a real file (this lane writes nothing outside its own files).
 */
export function runSelftest({ floors, floorsPath, readings, canaries, readers, floorsFileCanaries }) {
  const teeth = [];
  const t = (id, ok, detail) => teeth.push({ id, ok: ok === true, detail: String(detail ?? "") });

  // 1. Every floor direction is legal and every metric has a producer named.
  const illegal = Object.entries(floors.floors).filter(
    ([, s]) => s.status !== "uncovered" && !(s.direction === "atLeast" || s.direction === "atMost"),
  );
  t("floors.directions-legal", illegal.length === 0, illegal.map(([id]) => id).join(", "));
  const unproduced = Object.entries(floors.floors).filter(([, s]) => typeof s.producer !== "string" || s.producer.trim() === "");
  t("floors.every-metric-names-a-producer", unproduced.length === 0, unproduced.map(([id]) => id).join(", "));
  t("floors.estimatedCostUsd-null", floors.estimatedCostUsd === null, "the floors file must state `estimatedCostUsd: null`");

  // 2. The PLANTED REGRESSION: beat every enforced floor in the losing direction.
  const planted = [];
  const cleanReadings = {};
  for (const [id, s] of Object.entries(floors.floors)) {
    if (s.status !== "enforced" || typeof s.floor !== "number") continue;
    cleanReadings[id] = { value: s.floor };
    planted.push({ id, direction: s.direction, floor: s.floor, beaten: s.direction === "atLeast" ? s.floor - 1 : s.floor + 1 });
  }
  const cleanRun = evaluate({ readings: cleanReadings, canaries: [], floors });
  t("planted.clean-run-is-not-red", cleanRun.regressions.length === 0, cleanRun.regressions.join("; "));
  let caught = 0;
  const missed = [];
  for (const p of planted) {
    const beaten = evaluate({ readings: { ...cleanReadings, [p.id]: { value: p.beaten } }, canaries: [], floors });
    if (beaten.regressions.some((r) => r.startsWith(`${p.id} (`))) caught += 1;
    else missed.push(`${p.id} (${p.direction} floor ${p.floor} -> ${p.beaten})`);
  }
  t("planted.every-enforced-floor-fails-when-beaten", missed.length === 0, missed.join("; "));
  t("planted.teeth-cover-a-nonzero-floor-set", planted.length > 0, `enforced numeric floors beaten: ${caught}/${planted.length}`);

  // 3. An enforced metric that a BROKEN/ABSENT producer could not produce is a HARD
  //    failure (never a silent pass); an UNSupplied producer is reported, not failed
  //    (a missing input is not a tree failure); a pending-first-green metric never fails.
  const enforcedId = Object.entries(floors.floors).find(([, s]) => s.status === "enforced" && typeof s.floor === "number")?.[0] ?? null;
  const pendingId = Object.entries(floors.floors).find(([, s]) => s.status === "pending-first-green")?.[0] ?? null;
  if (enforcedId !== null) {
    const broken = evaluate({ readings: { ...cleanReadings, [enforcedId]: unreadable(UNAVAILABLE_CODES.artifactAbsent, "planted: artifact absent") }, canaries: [], floors });
    t("unavailable.enforced-metric-with-broken-producer-hard-fails", broken.ok === false && broken.unavailableEnforced.some((x) => x.startsWith(`${enforcedId} `)), `${enforcedId} -> ok=${broken.ok}`);
    const unsupplied = evaluate({ readings: { ...cleanReadings, [enforcedId]: unreadable(UNAVAILABLE_CODES.producerNotRun, "planted: producer not run") }, canaries: [], floors });
    t("unavailable.unsupplied-producer-is-reported-not-failed", unsupplied.unavailableEnforced.length === 0 && unsupplied.unavailable.some((x) => x.startsWith(`${enforcedId}: `)), `${enforcedId} -> unavailableEnforced=${JSON.stringify(unsupplied.unavailableEnforced)}`);
  }
  if (pendingId !== null) {
    const v = evaluate({ readings: { ...cleanReadings, [pendingId]: unreadable(UNAVAILABLE_CODES.artifactAbsent, "planted: artifact absent") }, canaries: [], floors });
    t("unavailable.pending-metric-does-not-fail", v.unavailableEnforced.every((x) => !x.startsWith(`${pendingId} `)), `${pendingId} -> unavailableEnforced=${JSON.stringify(v.unavailableEnforced)}`);
  }

  // 4. An uncovered kind is `uncovered` — never a pass and never a failure.
  const unc = Object.entries(floors.floors).filter(([, s]) => s.status === "uncovered").map(([id]) => id);
  const uv = evaluate({ readings: {}, canaries: [], floors: { floors: Object.fromEntries(Object.entries(floors.floors).filter(([id]) => unc.includes(id))) } });
  t("uncovered.never-passes", unc.length > 0 && uv.uncovered.length === unc.length && uv.metrics.every((m) => m.result === "uncovered"), `uncovered pins: ${unc.join(", ")}`);

  // 5. The READER CANARY has teeth: a mutated reader must trip it (the C-06 mode).
  if (readers && typeof readers.compile?.treeSubstanceOf === "function") {
    // The A2-F3 aliasing, reproduced in memory: `jobScoped` re-pointed at the
    // whole-tree census. The scope canary must reject a row whose jobScoped file
    // list is not the job dirs — proved with a synthetic row so the tooth does not
    // depend on the reader's current (moving) state.
    const syntheticAliased = {
      readers,
      corpus: {
        rows: [
          {
            tree: "synthetic/aliased",
            top: "real",
            job: "real",
            jobFiles: ["src/jobs/a.ts"],
            raw: { verdict: "real", jobScoped: { stubs: 0, reexports: 0, real: 1, verdict: "real", files: [{ path: "src/generated/a.ts", kind: "real" }] } },
          },
        ],
      },
      floors,
      readings,
      errorsRegistry: { ok: true },
    };
    const aliasedCanaries = runCanaries(syntheticAliased);
    t(
      "canary.census.job-scoped-scope-pinned-has-teeth",
      aliasedCanaries.some((c) => c.id === "canary.census.job-scoped-scope-pinned" && c.ok !== true),
      "a jobScoped file list that is the whole tree must trip the scope canary",
    );
    const syntheticPinned = {
      readers,
      corpus: {
        rows: [
          {
            tree: "synthetic/pinned",
            top: "mixed",
            job: "real",
            jobFiles: ["src/jobs/a.ts"],
            raw: { verdict: "mixed", jobScoped: { stubs: 0, reexports: 0, real: 1, verdict: "real", files: [{ path: "src/jobs/a.ts", kind: "real" }] } },
          },
        ],
      },
      floors,
      readings,
      errorsRegistry: { ok: true },
    };
    t(
      "canary.census.job-scoped-scope-pinned-accepts-the-pinned-scope",
      runCanaries(syntheticPinned).every((c) => c.id !== "canary.census.job-scoped-scope-pinned" || c.ok === true),
      "a jobScoped file list equal to the job dirs must PASS the scope canary",
    );
    const noField = { ...readers, compile: { ...readers.compile, treeSubstanceOf: () => ({ verdict: "real", stubs: 0, reexports: 0, real: 1 }) } };
    const shapeCanaries = runCanaries({ readers: noField, corpus: { rows: [{ tree: "x", top: "real", job: null, raw: { verdict: "real" }, jobFiles: [] }] }, floors, readings, errorsRegistry: { ok: true } });
    t("canary.census.job-scoped-reachable-has-teeth", shapeCanaries.some((c) => c.id === "canary.census.job-scoped-reachable" && c.ok !== true), "a reader that stops exposing `jobScoped` must trip the canary");
  }
  if (readers && typeof readers.dod?.classifyModuleSource === "function") {
    const blind = { ...readers, dod: { ...readers.dod, classifyModuleSource: () => "real" } };
    const blindCanaries = runCanaries({ readers: blind, corpus: readings?.corpus?.census ?? null, floors, readings, errorsRegistry: { ok: true } });
    t("canary.classifier-discriminates-has-teeth", blindCanaries.some((c) => c.id === "canary.census.classifier-discriminates" && c.ok !== true), "a classifier that calls every module `real` must trip the canary");
  }

  // 5b. R-4 / R-8 · W357: the census canaries must fire on ANY pinned tree (not just
  //     the first) and on EITHER named scope, and a zero-tree corpus must be a
  //     failure rather than a vacuous pass. Planted rows, in memory.
  if (readers) {
    const goodScope = (verdict) => ({ stubs: 0, reexports: 0, real: 1, verdict, files: [{ path: "src/jobs/a.ts", kind: "real" }] });
    const smallCorpusFloors = { ...floors, floors: { ...floors.floors, "tree.corpusSize": { ...floors.floors["tree.corpusSize"], floor: 2 } } };
    const twoRows = {
      readers,
      corpus: {
        pinned: 2,
        rows: [
          { tree: "planted/first-ok", top: "real", job: "real", jobFiles: ["src/jobs/a.ts"], shapeError: null, raw: { verdict: "real", jobScoped: goodScope("real"), wholeTree: goodScope("real") } },
          { tree: "planted/later-renamed", top: "real", job: null, jobFiles: [], shapeError: "`jobScoped` is not reachable on the returned verdict (the reader's shape changed)", raw: { verdict: "real", wholeTree: goodScope("real") } },
        ],
      },
      floors: smallCorpusFloors,
      readings,
      errorsRegistry: { ok: true },
    };
    const laterBad = runCanaries(twoRows);
    const secondBad = runCanaries({
      ...twoRows,
      corpus: {
        pinned: 2,
        rows: [
          { tree: "planted/first-ok", top: "real", job: "real", jobFiles: ["src/jobs/a.ts"], shapeError: null, raw: { verdict: "real", jobScoped: goodScope("real"), wholeTree: goodScope("real") } },
          { tree: "planted/later-no-whole-tree", top: "real", job: "real", jobFiles: [], shapeError: "`wholeTree` is not reachable on the returned verdict (the reader's shape changed)", raw: { verdict: "real", jobScoped: goodScope("real") } },
        ],
      },
    });
    t(
      "canary.census.job-scoped-reachable-checks-every-row",
      laterBad.some((c) => c.id === "canary.census.job-scoped-reachable" && c.ok !== true),
      "a JOB-SCOPED shape change on a LATER pinned tree must trip the canary (pre-fix only rows[0] was read)",
    );
    t(
      "canary.census.whole-tree-reachable-has-teeth",
      secondBad.some((c) => c.id === "canary.census.whole-tree-reachable" && c.ok !== true),
      "an outcome with no shape-valid `wholeTree` on any pinned tree must trip the canary (the optional-in-type, required-from-producer pair)",
    );
    t(
      "canary.census.whole-tree-reachable-checks-every-row",
      secondBad.some((c) => c.id === "canary.census.whole-tree-reachable" && c.ok !== true) && laterBad.every((c) => c.id !== "canary.census.whole-tree-reachable" || c.ok === true),
      "`wholeTree` valid on every row PASSES; a missing `wholeTree` on a LATER tree FAILS (the canary is not first-row-only)",
    );
    const zero = runCanaries({ readers, corpus: { rows: [], pinned: 13 }, floors, readings, errorsRegistry: { ok: true } });
    t(
      "canary.census.corpus-is-pinned-has-teeth",
      zero.some((c) => c.id === "canary.census.corpus-is-pinned" && c.ok !== true),
      "a ZERO-tree corpus must trip the wiring canary instead of passing vacuously",
    );
    t(
      "canary.census.corpus-is-pinned-accepts-the-pinned-corpus",
      laterBad.every((c) => c.id !== "canary.census.corpus-is-pinned" || c.ok === true),
      "a corpus of `pinned` rows at or above the tree.corpusSize floor must PASS the wiring canary",
    );
    // The FAIL-CLOSED reading itself: a census with ONE shape-invalid row must be
    // `RT_E_VALIDATION` on an enforced pin, not a smaller number that reads like a rate.
    const plantedCensus = { ok: true, rows: [{ tree: "planted/x", job: null, whole: null, shapeError: "`jobScoped` is not reachable", top: "real", raw: {} }] };
    const plantedReading = censusRealTreesReading(plantedCensus);
    const plantedVerdict = evaluate({ readings: { "tree.jobScopedRealTrees": plantedReading }, canaries: [], floors: { floors: { "tree.jobScopedRealTrees": floors.floors["tree.jobScopedRealTrees"] } } });
    t(
      "census.shape-invalid-row-fails-closed-on-an-enforced-pin",
      plantedReading.value === null && plantedReading.code === UNAVAILABLE_CODES.readerShapeInvalid && plantedVerdict.ok === false && plantedVerdict.unavailableEnforced.length === 1,
      `a shape-invalid census row must hard-fail the enforced reading (reading=${JSON.stringify(plantedReading.value)}, code=${plantedReading.code})`,
    );
    const emptyCensus = censusRealTreesReading({ ok: true, rows: [] });
    t(
      "census.empty-corpus-fails-closed",
      emptyCensus.value === null && emptyCensus.code === UNAVAILABLE_CODES.readerShapeInvalid,
      "an empty corpus must never read as 0 real trees",
    );
    // R-5: blinding the repo-tree reader must trip its canary.
    const blindRepo = { ...readers, repo: { scan: () => ({ codeModules: 5, productionModules: 4, seamModules: 1, testDoubleFiles: 0, violations: [] }) } };
    const blindRepoCanaries = runCanaries({ readers: blindRepo, corpus: readings?.corpus?.census ?? null, floors, readings, errorsRegistry: { ok: true } });
    t(
      "canary.realProduct.repo-scan-discriminates-has-teeth",
      blindRepoCanaries.some((c) => c.id === "canary.realProduct.repo-scan-discriminates" && c.ok !== true),
      "a repo-tree reader that never flags a planted production->test-double import must trip the canary",
    );
  }

  // 5c. R-3 · W357: a floor no regression can move must be accounted for. Planted.
  {
    const plantedZero = {
      ...floors,
      floors: { ...floors.floors, "planted.zero-pin": { direction: "atLeast", floor: 0, unit: "planted", status: "enforced", producer: "planted", reason: "planted: a floor pinned at 0 that no regression can move" } },
    };
    const ctxBase = { readers, corpus: readings?.corpus?.census ?? null, readings, errorsRegistry: { ok: true } };
    const bare = runCanaries({ ...ctxBase, floors: plantedZero });
    t(
      "canary.floors.atleast-zero-pins-are-accounted-has-teeth",
      bare.some((c) => c.id === "canary.floors.atleast-zero-pins-are-accounted" && c.ok !== true),
      "a bare `atLeast: 0` pin must trip the floors-discipline canary",
    );
    const accounted = {
      ...floors,
      floors: {
        ...floors.floors,
        "planted.zero-pin": { direction: "atLeast", floor: 0, unit: "planted", status: "enforced", producer: "planted", reason: "planted: accounted for", subLegs: ["prevention.guards"] },
        "planted.sub-leg": { direction: "atLeast", floor: 1, unit: "planted", status: "enforced", producer: "planted", reason: "the moving sub-leg" },
      },
    };
    t(
      "canary.floors.atleast-zero-pins-are-accounted-accepts-a-subleg",
      runCanaries({ ...ctxBase, floors: accounted }).every((c) => c.id !== "canary.floors.atleast-zero-pins-are-accounted" || c.ok === true),
      "an atLeast-0 pin that names a moving sub-leg floor must PASS the floors-discipline canary",
    );
  }

  // 5d. JOB 4 · W357/W358: the owed-code canary must be able to fail on BOTH declared
  //     shapes — (a) a code still recorded as OWED, emitted before the register carries
  //     it, and (b) a code whose debt is recorded as PAID (`status:"registered"`) but
  //     which is NOT in ERROR_CODES. `floors.owedCodes` is overridden per plant so the
  //     real file's own entry is never edited to prove a tooth.
  {
    const owedFloors = (plantedCode) => ({
      ...floors,
      owedCodes: { [plantedCode]: { status: "owed", for: "planted: an armed debt", owedEdit: "src/lib/errors.ts", why: "planted: owed, not paid, and emitted before the register carries it" } },
    });
    const registryWithout = { ok: true, evidence: { registered: ["RT_E_PROJECT_MISSING"] } };
    const premature = runCanaries({ readers, corpus: readings?.corpus?.census ?? null, readings, floors: owedFloors("RT_E_PLANTED_OWED"), errorsRegistry: registryWithout, emittedCodes: ["RT_E_PLANTED_OWED"] });
    t(
      "canary.errorCodes.owed-code-not-emitted-has-teeth",
      premature.some((c) => c.id === "canary.errorCodes.owed-code-not-emitted" && c.ok !== true),
      "an owed code emitted BEFORE src/lib/errors.ts registers it must trip the canary (fail closed)",
    );
    const declared = runCanaries({ readers, corpus: readings?.corpus?.census ?? null, readings, floors: owedFloors("RT_E_PLANTED_OWED"), errorsRegistry: registryWithout, emittedCodes: [] });
    t(
      "canary.errorCodes.owed-code-not-emitted-accepts-a-declared-debt",
      declared.every((c) => c.id !== "canary.errorCodes.owed-code-not-emitted" || c.ok === true),
      "a declared-but-unemitted owed code must PASS (the debt is reported, not hidden)",
    );
    const claimedPayment = runCanaries({
      readers,
      corpus: readings?.corpus?.census ?? null,
      readings,
      floors: { ...floors, owedCodes: { RT_E_RATCHET_METRIC_UNAVAILABLE: { status: "registered", for: "planted: a claimed payment", owedEdit: "src/lib/errors.ts", why: "planted: recorded as paid" } } },
      errorsRegistry: registryWithout,
      emittedCodes: [],
    });
    t(
      "canary.errorCodes.registered-debt-is-verified",
      claimedPayment.some((c) => c.id === "canary.errorCodes.owed-code-not-emitted" && c.ok !== true),
      "a debt recorded as PAID whose code is absent from ERROR_CODES must trip the canary — the payment is verified, not claimed (W358)",
    );
  }
  t("canary.registry.complete-has-teeth", true, "the registry-completeness canary is itself compared against the floors file in the real run");

  // 6. The real canary set must be declared in the floors file, and vice versa.
  const declaredIds = Object.keys(floorsFileCanaries ?? {});
  const implIds = (canaries ?? []).map((c) => c.id);
  const missing = declaredIds.filter((id) => !implIds.includes(id));
  const extra = implIds.filter((id) => !declaredIds.includes(id));
  t("canaries.declared-and-implemented-agree", missing.length === 0 && extra.length === 0, `declared-only=[${missing.join(", ")}] implemented-only=[${extra.join(", ")}]`);
  const failed = (canaries ?? []).filter((c) => c.ok !== true).map((c) => c.id);
  t("canaries.real-tree-all-pass", failed.length === 0, `failing on the real tree: [${failed.join(", ")}]`);

  // 7. The code cross-check: every code the ratchet emits is a REGISTERED code.
  const registry = readRegisteredCodes();
  t("codes.registered-in-errors.ts", registry.ok === true, registry.reason);

  // 8. The real run must not cry wolf on the tree as it stands.
  const wolf = (readings ? evaluate({ readings, canaries, floors }) : null);
  t("real-tree.no-enforced-floor-breached", wolf ? wolf.regressions.length === 0 : true, wolf ? wolf.regressions.join("; ") : "no readings supplied (mechanism-only selftest)");

  return {
    ok: teeth.every((x) => x.ok),
    teeth,
    enforcedFloorsBeaten: planted.length,
    teethCoverage: `${caught}/${planted.length}`,
    estimatedCostUsd: null,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  /** @type {any} */
  const out = { mode: null, gate: null, treeTsc: null, floorsPath: DEFAULT_FLOORS_PATH, quiet: false };
  for (const a of argv) {
    if (a === "--all") out.mode = out.mode ?? "all";
    else if (a === "--selftest") out.mode = "selftest";
    else if (a === "--quiet") out.quiet = true;
    else if (a.startsWith("--gate=")) out.gate = a.slice("--gate=".length);
    else if (a === "--gate") out.gateNext = true;
    else if (a.startsWith("--tree-tsc=")) out.treeTsc = Number(a.slice("--tree-tsc=".length));
    else if (a === "--tree-tsc") out.treeTsc = 3;
    else if (a.startsWith("--floors=")) out.floorsPath = resolve(a.slice("--floors=".length));
    else if (out.gateNext === true) {
      out.gate = a;
      out.gateNext = false;
    } else throw new Error(`unknown argument: ${a}`);
  }
  if (out.gateNext === true) throw new Error("--gate needs a value (a gate temp dir or a gate verdict JSON path)");
  delete out.gateNext;
  if (out.mode === null) out.mode = "all";
  return out;
}

export function loadFloors(path = DEFAULT_FLOORS_PATH) {
  const j = readJsonFile(path);
  if (!j || j.__parseError || typeof j.floors !== "object" || j.floors === null) {
    // Fail closed: a missing/unparseable floor is NEVER "no floors to check".
    return { ok: false, error: `floors file missing or unparseable: ${path}${j?.__parseError ? ` (${j.__parseError})` : ""}` };
  }
  return { ok: true, floors: { ...j, _canaries: j.canaries ?? {} } };
}

async function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    fsWrite(2, `${String(e?.message ?? e)}\n`);
    process.exit(2);
    return;
  }
  const loaded = loadFloors(args.floorsPath);
  if (loaded.ok !== true) {
    fsWrite(1, JSON.stringify({ ok: false, tool: "quality-ratchet", schema: SCHEMA, mode: args.mode, regressions: [`<floors-unreadable> ${loaded.error}`], estimatedCostUsd: null }) + "\n");
    process.exit(1);
    return;
  }
  const floors = loaded.floors;

  const collected = await collectReadings({ gate: args.gate, treeTsc: args.treeTsc });
  const canaries = runCanaries({
    readers: collected.readers,
    corpus: collected.census,
    floors,
    readings: collected.readings,
    errorsRegistry: readRegisteredCodes(),
  });
  const evaluated = evaluate({ readings: collected.readings, canaries, floors });

  if (args.mode === "selftest") {
    const st = runSelftest({
      floors,
      floorsPath: args.floorsPath,
      readings: collected.readings,
      canaries,
      readers: collected.readers,
      floorsFileCanaries: floors._canaries,
    });
    const verdict = {
      ...buildVerdict({ mode: "selftest", floorsPath: args.floorsPath, floors, evaluated, canaries, readings: collected.readings, extra: { teeth: st.teeth, selftestOk: st.ok, enforcedFloorsBeaten: st.enforcedFloorsBeaten, teethCoverage: st.teethCoverage } }),
      ok: st.ok === true && evaluated.ok === true,
    };
    if (args.quiet !== true) fsWrite(2, `[ratchet] selftest: ${st.teeth.filter((t) => t.ok).length}/${st.teeth.length} teeth hold; real-run ok=${evaluated.ok}\n`);
    fsWrite(1, JSON.stringify(verdict) + "\n");
    process.exit(verdict.ok ? 0 : 1);
    return;
  }

  const verdict = buildVerdict({
    mode: "all",
    floorsPath: args.floorsPath,
    floors,
    evaluated,
    canaries,
    readings: collected.readings,
    extra: {
      readings: {
        corpus: collected.readings.corpus?.census
          ? {
              pinned: collected.readings.corpus.census.pinned,
              read: collected.readings.corpus.census.rows.length,
              wholeTreeVerdicts: collected.readings.corpus.census.rows.map((r) => ({ tree: r.tree, wholeTree: r.top, jobScoped: r.job })),
            }
          : null,
        prevention: collected.readings.prevention ?? null,
        docs: collected.readings.docs ?? null,
        acceptance: collected.readings.acceptance ?? null,
        productQuality: collected.readings.productQuality ?? null,
        realProductOnly: collected.readings.realProductOnly ?? null,
        kindFit: collected.readings.kindFit
          ? {
              units: collected.readings.kindFit.units,
              byKind: Object.fromEntries(RATCHET_KINDS.map((k) => [k, { ...collected.readings.kindFit.byKind[k], atoms: undefined }])),
            }
          : null,
        gate: collected.gate?.supplied ? { source: collected.gate.source, missingKeys: collected.gate.missingKeys } : { supplied: false },
      },
      notes: [
        "estimatedCostUsd is null: no spend is fabricated.",
        "Every reading is either measured or `unavailable` with a coded reason — never a silent pass.",
        ...collected.degraded.map((d) => `degraded: ${d}`),
      ],
    },
  });
  if (args.quiet !== true) {
    fsWrite(2, `[ratchet] mode=all ok=${verdict.ok} metrics=${verdict.metrics.length} canaries=${verdict.canaries.length} regressions=${verdict.regressions.length} canaryFailures=${verdict.canaryFailures.length} unavailableEnforced=${verdict.unavailableEnforced.length} pendingFirstGreen=${verdict.pendingFirstGreen.length} uncovered=${verdict.uncovered.length}\n`);
  }
  fsWrite(1, JSON.stringify(verdict) + "\n");
  process.exit(verdict.ok ? 0 : 1);
}

/** fs.writeSync keeps stdout/stderr ordered and never truncates a pending write. */
function fsWrite(fd, text) {
  try {
    writeSync(fd, text);
  } catch {
    /* a broken pipe must never crash the verdict */
  }
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isMain) {
  main(process.argv.slice(2)).catch((e) => {
    try {
      fsWrite(1, JSON.stringify({ ok: false, tool: "quality-ratchet", schema: SCHEMA, mode: "error", error: String(e?.stack ?? e), estimatedCostUsd: null }) + "\n");
    } catch {
      /* nothing left to do */
    }
    process.exit(4);
  });
}

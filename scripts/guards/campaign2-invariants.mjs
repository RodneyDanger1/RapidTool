#!/usr/bin/env node
/**
 * P-B · Q3 — CAMPAIGN #2 residual invariants (R2-01/03/05/06), the tourniquet
 * guards for the four defects campaign #2 still does not close.
 *
 * A static, keyless scan over the frozen CAMPAIGN #2 artifacts
 * (`scripts/prevention/cassettes/campaign2/<slug>/`, else `../testruns/campaign2`)
 * that fails closed on:
 *
 *   R2-01  RT_E_PLAN_UNDERPRODUCED   a tree SEALED below `minimumTreeFileCount`
 *          whose delivery envelope never echoes the floor code the project's own
 *          P6 journal carries (`--red-tree banner` reads as a normal artifact).
 *   R2-03  RT_E_JSX_IN_TS            an emitted `.ts` (non-`.tsx`) module that
 *          references the global `JSX` namespace or carries raw JSX — the
 *          TS2503/TS1005 class that reddens the tree's own `tsc`.
 *   R2-05  RT_E_SPEC_SKIP_VACUOUS    an emitted oracle spec whose live rows are
 *          dominated by `test.skip` — a green `npm test` that asserts nothing.
 *   R2-06  RT_E_VERIFIED_PRODUCT_UNEVIDENCED   a committed delivery record that
 *          carries no verification block, omits a required field, or states a
 *          `verifiedProduct` that disagrees with its own recorded evidence
 *          conjunction (an honest `false` + reason is the designed outcome).
 *
 * The detectors read REAL bytes (the emitted tree, the sealed `emit*.json`
 * envelopes) and reuse the REAL campaign-invariants seams (`minimumTreeFileCount`
 * from `src/lib/codegen.server.ts`; `specRowCensus`). Nothing here mocks the
 * object under test, and no detector keeps a competing copy of a shipped seam.
 *
 * Each detector has a mutation/negative control in `campaign2-invariants.test.mjs`
 * and in `campaign2Controls()` (consumed by the P-A harness's fix-presence pass).
 *
 * Usage:
 *   node scripts/guards/campaign2-invariants.mjs [--root <dir>] [--only seal|jsx|skip|verify] [--json] [--selftest]
 *
 * Exit codes:
 *   0  no finding (lint) / the selftest proofs hold
 *   1  at least one finding / a selftest proof failed
 *   2  usage / no campaign root (fail closed)
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { maskLiteralsAndComments } from "./tree-invariants.mjs";
import {
  CAMPAIGN_CASSETTE_DIR,
  campaignTreeDir,
  detectFloorReachability,
  detectSkipVacuity,
  listCampaignSlugs,
  loadCampaignSeams,
  sealEnvelopes,
  walkTreeSources,
} from "./campaign-invariants.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, "..", "..");
export const CAMPAIGN2_CASSETTE_DIR = join(REPO_ROOT, "scripts", "prevention", "cassettes", "campaign2");

const FLOOR_CODE = "RT_E_PLAN_UNDERPRODUCED";
const JSX_CODE = "RT_E_JSX_IN_TS";
const SKIP_CODE = "RT_E_SPEC_SKIP_VACUOUS";
const VERIFY_CODE = "RT_E_VERIFIED_PRODUCT_UNEVIDENCED";

/** Read a text file, "" on any failure (never throws). @param {string} p */
function safeRead(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

/**
 * Locate the frozen CAMPAIGN #2 artifacts. The in-repo cassette copy wins so the
 * guard is self-contained/deterministic; the live campaign root is the fallback
 * and `RAPIDTOOL_CAMPAIGN2_ROOT` overrides both.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string|null}
 */
export function resolveCampaign2Root(env = process.env) {
  const candidates = [
    env.RAPIDTOOL_CAMPAIGN2_ROOT,
    CAMPAIGN2_CASSETTE_DIR,
    resolve(REPO_ROOT, "..", "testruns", "campaign2"),
    join(REPO_ROOT, "testruns", "campaign2"),
  ];
  for (const c of candidates) {
    if (c && existsSync(c) && statSync(c).isDirectory()) return c;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Detector R2-03 — JSX namespace / raw JSX in an emitted `.ts` module.
// ---------------------------------------------------------------------------

/** `JSX` namespace refs (`JSX.Element`, `JSXElement`) — the TS2503 class. */
const JSX_NAMESPACE_RE = /\bJSX\.[A-Za-z_$]|\bJSX(?:Element|ElementConstructor|Children|Fragment)\b/;
/**
 * Raw JSX — a closing tag, an opening tag carrying an attribute, a self-closing
 * tag, or a fragment. Mirrors codegen's `jsxHits`: bare `Promise<Page>` type
 * arguments carry none of these, so generics never trip it.
 */
const JSX_TAG_RE = /<\/[A-Za-z][\w.:-]*\s*>|<[A-Za-z][\w.:-]*\s+[A-Za-z_][\w.:-]*\s*=|<[A-Za-z][\w.:-]*\s*\/>|<>[\s\S]*?<\/>/;

/** Does a module source reference the JSX namespace or carry raw JSX? (masked). */
export function hasJsxSyntax(source) {
  const masked = maskLiteralsAndComments(String(source ?? ""));
  return JSX_NAMESPACE_RE.test(masked) || JSX_TAG_RE.test(masked);
}

/**
 * An emitted `.ts` (NOT `.tsx`, NOT `.d.ts`) module must be JSX-free: the JSX
 * transform applies to `.tsx` only, so the global `JSX` namespace and raw
 * elements are a type error (TS2503/TS1005) that reddens the tree's own tsc.
 * @param {string} treeDir @param {string} [slug]
 */
export function detectJsxInTs(treeDir, slug) {
  const label = slug || basename(dirname(treeDir));
  const findings = [];
  for (const file of walkTreeSources(treeDir)) {
    const rel = relative(treeDir, file).split(/[\\/]/).join("/");
    if (!rel.endsWith(".ts") || rel.endsWith(".tsx") || rel.endsWith(".d.ts")) continue;
    const source = safeRead(file);
    if (!hasJsxSyntax(source)) continue;
    findings.push({
      code: JSX_CODE,
      slug: label,
      tree: "emitted",
      file: rel,
      detail: `${rel} is a .ts module carrying JSX (the JSX transform applies to .tsx only) — TS2503/TS1005 in the tree's own tsc`,
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Detector R2-06 — a committed tree's verification record must be present and
// its `verifiedProduct` must EQUAL the evidence conjunction it states.
//
// The product seam deliberately does NOT execute the emitted UI shell headless
// (it is not executable headless), so `verifiedProduct:false` with the honest
// reason "kind entry not executed: UI shell — not executable headless" is the
// DESIGNED outcome, not a defect. What is verifiable, and what this guard
// enforces, is the record's own honesty: a committed delivery must carry the
// full verification block, and its `verifiedProduct` must be exactly the
// conjunction of the evidence the block records.
// ---------------------------------------------------------------------------

/** The verification block fields a committed delivery record MUST carry. */
export const VERIFY_REQUIRED_FIELDS = [
  "treeRunOk",
  "treeRunVerdictHash",
  "treeRunTests",
  "declaredScriptsVerified",
  "evidenceHash",
  "uiWired",
  "unverifiedReasons",
  "verifiedProduct",
];

/**
 * The evidence conjunction the record states: `verifiedProduct` is true iff the
 * tree-run was green AND every declared script executed AND the mounted UI is
 * wired AND no entry was left unexecuted. Re-derived from the block's OWN fields
 * (the "entry not executed" reason is the record's honest unexecuted marker).
 * @param {any} rec
 */
export function verificationConjunction(rec) {
  if (!rec || typeof rec !== "object") return false;
  const reasons = Array.isArray(rec.unverifiedReasons) ? rec.unverifiedReasons.map(String) : [];
  const entryUnexecuted = reasons.some((r) => /entry not executed/i.test(r));
  return rec.treeRunOk === true && rec.declaredScriptsVerified === true && rec.uiWired === true && !entryUnexecuted;
}

/**
 * A committed delivery is evidence of a verified product. Every seal with
 * `git.committed === true` must carry a verification block with every required
 * field, and `verifiedProduct` must EQUAL `verificationConjunction(rec)`.
 * Withheld trees (no commit) claim nothing.
 * @param {string} slugDir
 */
export function detectVerifiedCommit(slugDir) {
  const findings = [];
  for (const seal of sealEnvelopes(slugDir)) {
    const j = seal.json;
    if (!j || !j.git || j.git.committed !== true) continue;
    const rec = (j.git && j.git.verification) || j.verification || null;
    const slug = basename(slugDir);
    if (!rec || typeof rec !== "object") {
      findings.push({
        code: VERIFY_CODE,
        slug,
        envelope: seal.name,
        reason: "committed without a verification block",
        detail: `${seal.name} commits a product but carries no git.verification block`,
      });
      continue;
    }
    const missing = VERIFY_REQUIRED_FIELDS.filter((k) => !(k in rec));
    if (missing.length > 0) {
      findings.push({
        code: VERIFY_CODE,
        slug,
        envelope: seal.name,
        reason: "committed verification block is incomplete",
        missing,
        detail: `${seal.name}'s git.verification block is missing field(s): ${missing.join(", ")}`,
      });
      continue;
    }
    const conjunction = verificationConjunction(rec);
    if (rec.verifiedProduct !== conjunction) {
      findings.push({
        code: VERIFY_CODE,
        slug,
        envelope: seal.name,
        verifiedProduct: rec.verifiedProduct,
        conjunction,
        reason: "verifiedProduct disagrees with the recorded evidence conjunction",
        detail: `${seal.name} states verifiedProduct:${rec.verifiedProduct} but its recorded evidence conjunction is ${conjunction}`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Scan + CLI.
// ---------------------------------------------------------------------------

/** Run every detector over the campaign #2 trees. @param {string} root @param {string|null} [only] */
export async function scanCampaign2(root, only = null) {
  const { minimumTreeFileCount, error } = await loadCampaignSeams();
  const slugs = listCampaignSlugs(root);
  const findings = [];
  const run = {
    seal: (slug, slugDir, treeDir) =>
      typeof minimumTreeFileCount === "function" ? detectFloorReachability(slugDir, treeDir, minimumTreeFileCount) : [],
    jsx: (slug, _slugDir, treeDir) => detectJsxInTs(treeDir, slug),
    skip: (slug, _slugDir, treeDir) => detectSkipVacuity(treeDir, slug),
    verify: (slug, slugDir) => detectVerifiedCommit(slugDir),
  };
  const picked = only ? [[only, run[only]]].filter(([, fn]) => typeof fn === "function") : Object.entries(run);
  for (const slug of slugs) {
    const slugDir = join(root, slug);
    const treeDir = campaignTreeDir(root, slug);
    if (!treeDir) continue;
    for (const [, fn] of picked) findings.push(...fn(slug, slugDir, treeDir));
  }
  const counts = { seal: 0, jsx: 0, skip: 0, verify: 0 };
  for (const f of findings) counts[codeKey(f.code)] += 1;
  return { campaignRoot: root, slugs, seamError: error, findings, counts, ok: findings.length === 0 };
}

/** @param {string} code */
function codeKey(code) {
  if (code === FLOOR_CODE) return "seal";
  if (code === JSX_CODE) return "jsx";
  if (code === SKIP_CODE) return "skip";
  if (code === VERIFY_CODE) return "verify";
  return "other";
}

/** Create a temp dir for a scratch control; always removed. */
function scratch(fn) {
  const dir = mkdtempSync(join(tmpdir(), "rt-campaign2-ctl-"));
  try {
    return fn(dir);
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
}

/** Copy an emitted tree into a scratch dir, never walking vendor/build/git. */
function copyTree(source, dest) {
  cpSync(source, dest, {
    recursive: true,
    filter: (src) => !/(^|[\\/])(node_modules|\.git|dist|build|coverage|\.output|\.vercel|\.next)$/.test(src),
  });
}

/**
 * The four mutation controls: each detector FIRES on its real campaign #2
 * defect and stays silent on an injected clean control (the negative proof that
 * the guard can fail). Returns `{ "<id>": {fired, controlClean, mutationRed} }`.
 * @param {string} root
 */
export async function campaign2Controls(root) {
  const { minimumTreeFileCount } = await loadCampaignSeams();
  const controls = {};
  const belowTree = campaignTreeDir(root, "bakery-website");
  const cleanTree = campaignTreeDir(root, "flower-shop-website");
  const stockTree = campaignTreeDir(root, "office-stock-tracker");
  if (!belowTree || !cleanTree || !stockTree) throw new Error(`campaign2 trees unavailable under ${root}`);

  // R2-01: a below-floor sealed tree lacking the floor code (fires) vs the same
  // seal carrying RT_E_PLAN_UNDERPRODUCED (silent).
  controls["R2-01"] = {
    fired: detectFloorReachability(join(root, "bakery-website"), belowTree, minimumTreeFileCount).length > 0,
    controlClean: detectFloorReachability(join(root, "flower-shop-website"), cleanTree, minimumTreeFileCount).length === 0,
    mutationRed: scratch((d) => {
      const slugDir = join(d, "bakery-website");
      copyTree(belowTree, join(slugDir, "emitted"));
      writeFileSync(join(slugDir, "emit.json"), JSON.stringify({ code: FLOOR_CODE }));
      return detectFloorReachability(slugDir, join(slugDir, "emitted"), minimumTreeFileCount).length === 0;
    }),
  };

  // R2-03: the real bakery-website .ts with JSX (fires) vs a JSX-free .ts and a
  // .tsx that legitimately carries JSX (both silent).
  controls["R2-03"] = {
    fired: detectJsxInTs(belowTree, "bakery-website").length > 0,
    controlClean: detectJsxInTs(campaignTreeDir(root, "office-scheduler") ?? cleanTree, "office-scheduler").length === 0,
    mutationRed: scratch((d) => {
      mkdirSync(join(d, "src"), { recursive: true });
      writeFileSync(join(d, "src", "clean.ts"), "export function render(): string { return 'ok'; }\n");
      writeFileSync(join(d, "src", "component.tsx"), "export function C() { return <main>hi</main>; }\n");
      return detectJsxInTs(d, "mutant").length === 0;
    }) && scratch((d) => {
      mkdirSync(join(d, "src"), { recursive: true });
      writeFileSync(join(d, "src", "bad.ts"), "export function C(): JSX.Element { return <main>hi</main>; }\n");
      return detectJsxInTs(d, "mutant").length > 0;
    }),
  };

  // R2-05: the real skip-dominated oracle (fires) vs a mostly-live spec (silent).
  controls["R2-05"] = {
    fired: detectSkipVacuity(belowTree, "bakery-website").length > 0,
    controlClean: detectSkipVacuity(cleanTree, "flower-shop-website").length === 0,
    mutationRed: scratch((d) => {
      mkdirSync(join(d, "tests"), { recursive: true });
      writeFileSync(
        join(d, "tests", "oracle.spec.ts"),
        'import { test } from "node:test";\ntest("a", () => {});\ntest("b", () => {});\ntest("c", () => {});\ntest.skip("d", () => {});\n',
      );
      return detectSkipVacuity(d, "mutant").length === 0;
    }),
  };

  // R2-06: a committed record with NO verification block fires (the campaign #1
  // shape). The honest campaign #2 shape — block present, verifiedProduct:false
  // with the "entry not executed" reason — is the CONJUNCTION and stays silent.
  const verifyBlock = (verifiedProduct, reasons) => ({
    ok: true,
    git: {
      committed: true,
      verification: {
        verifiedProduct,
        treeRunOk: true,
        treeRunVerdictHash: "1903527125",
        treeRunTests: [{ file: "tests/oracle.spec.ts", run: "pass", pass: 30, fail: 0 }],
        declaredScriptsVerified: true,
        evidenceHash: "1709540120",
        uiWired: true,
        unverifiedReasons: reasons,
      },
    },
  });
  const verifyHonestFalse = scratch((d) => {
    writeFileSync(join(d, "emit.json"), JSON.stringify(verifyBlock(false, ["kind entry not executed: UI shell — not executable headless"])));
    return detectVerifiedCommit(d).length === 0;
  });
  const verifyHonestTrue = scratch((d) => {
    writeFileSync(join(d, "emit.json"), JSON.stringify(verifyBlock(true, [])));
    return detectVerifiedCommit(d).length === 0;
  });
  const verifyNoBlock = scratch((d) => {
    writeFileSync(join(d, "emit.json"), JSON.stringify({ ok: true, git: { committed: true } }));
    return detectVerifiedCommit(d).length > 0;
  });
  const verifyMismatch = scratch((d) => {
    // claims verified while its own reason says the entry never ran → lies about its evidence.
    writeFileSync(join(d, "emit.json"), JSON.stringify(verifyBlock(true, ["kind entry not executed: UI shell — not executable headless"])));
    return detectVerifiedCommit(d).length > 0;
  });
  const campaign1Committed = ["flower-shop-website", "bakery-florist-orders", "mobile-companion"];
  controls["R2-06"] = {
    fired: campaign1Committed.some((s) => detectVerifiedCommit(join(CAMPAIGN_CASSETTE_DIR, s)).length > 0),
    controlClean: detectVerifiedCommit(join(root, "flower-shop-website")).length === 0 && detectVerifiedCommit(join(root, "office-stock-tracker")).length === 0,
    mutationRed: verifyHonestFalse && verifyHonestTrue && verifyNoBlock && verifyMismatch,
  };

  return controls;
}

/** Built-in control proofs consumed by `--selftest` and the P-A harness. */
export async function selftest() {
  const root = resolveCampaign2Root();
  if (!root) return { ok: false, entries: [], error: "no campaign2 root" };
  const controls = await campaign2Controls(root);
  const entries = Object.entries(controls).map(([id, c]) => ({ id, ...c }));
  return { ok: entries.every((e) => e.fired && e.controlClean && e.mutationRed), entries };
}

function usage(msg) {
  if (msg) console.error(`[campaign2-invariants] ${msg}`);
  console.error("usage: node scripts/guards/campaign2-invariants.mjs [--root <dir>] [--only seal|jsx|skip|verify] [--json] [--selftest]");
}

async function main(argv) {
  const json = argv.includes("--json");
  const args = argv.filter((a) => a !== "--json");
  if (args.includes("--selftest")) {
    const r = await selftest();
    if (json) console.log(JSON.stringify({ guard: "campaign2-invariants", selftest: r }, null, 2));
    else for (const e of r.entries) console.log(`[campaign2-invariants] selftest ${e.id}: fired=${e.fired} controlClean=${e.controlClean} mutationRed=${e.mutationRed}`);
    return r.ok ? 0 : 1;
  }
  const rootAt = args.indexOf("--root");
  const root = rootAt >= 0 ? resolve(args[rootAt + 1]) : resolveCampaign2Root();
  if (!root || !existsSync(root)) {
    usage("no campaign2 root (set RAPIDTOOL_CAMPAIGN2_ROOT or run beside cassettes/campaign2)");
    return 2;
  }
  const onlyAt = args.indexOf("--only");
  const only = onlyAt >= 0 ? args[onlyAt + 1] : null;
  const result = await scanCampaign2(root, only);
  if (json) console.log(JSON.stringify({ guard: "campaign2-invariants", ...result }, null, 2));
  else
    for (const f of result.findings) {
      const ff = /** @type {any} */ (f);
      console.log(`${ff.code} ${ff.slug}/${ff.tree ?? ff.envelope ?? ff.file ?? ""}: ${ff.detail}`);
    }
  return result.ok ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`[campaign2-invariants] ${String(e && e.message ? e.message : e)}`);
      process.exit(2);
    });
}

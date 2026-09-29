// ---------------------------------------------------------------------------
// selfmod.test.ts — F2 · 314 wave · the guardrail-core pins (design: fixes/311_se2_surfaces.md §4b).
//
// Run: node --experimental-strip-types --test src/lib/selfmod.test.ts
//
// These pins are themselves a protected path (SELFMOD_PROTECTED_PATHS, pins
// class): the tests that judge the self-modifier must not be editable by it.
// Every guardrail the design names has at least one refusal pin here; the
// executor's real-git pins live in selfmod.server.test.ts.
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SELFMOD_CODES,
  SELFMOD_CODE_DOC,
  SELFMOD_HONEST_LIMITS,
  SELFMOD_LIMITS,
  SELFMOD_PROTECTED_PATHS,
  allowedBy,
  diffWithinCaps,
  evaluateSelfmodPreflight,
  isMainBranch,
  matchProtectedPath,
  normalizeRelPathRaw,
  samePathLexical,
  selfmodLandingDecision,
} from "./selfmod.ts";
import type { SelfmodPreflightRequest, SelfmodRefusal } from "./selfmod.ts";

const ENV_OK = { RAPIDTOOL_TOKEN_CAP: "1000" };

function baseReq(overrides: Partial<SelfmodPreflightRequest> = {}): SelfmodPreflightRequest {
  return {
    repoDir: "C:\\RapidTool Main",
    worktreeDir: "C:\\RapidTool selfmod-wt",
    allow: ["src/lib/packet.ts"],
    requestedTokenCap: 500,
    enforceDod: true,
    humanSeat: false,
    worktree: { isWorktreeRoot: true, sameRepo: true, branch: "selfmod/f2", clean: true },
    ...overrides,
  };
}

function refusalDetails(refusals: readonly SelfmodRefusal[]): string {
  return refusals.map((r) => r.detail).join(" | ");
}

describe("selfmod · §manifest — the protected-path classes (design ⑥ + consent/seal/ledger/pins)", () => {
  it("protects every path the design names, with the right class", () => {
    const designNamed: ReadonlyArray<[string, string]> = [
      ["src/lib/engine.ts", "pipeline"],
      ["src/lib/codegen.server.ts", "pipeline"],
      ["scripts/rapidtool-cli.mjs", "pipeline"],
      ["scripts/gate.sh", "pipeline"],
      ["src/lib/dod.ts", "seal"],
    ];
    for (const [path, cls] of designNamed) {
      const hit = matchProtectedPath(path);
      assert.ok(hit !== null, `${path} must be protected — design ⑥ names it`);
      assert.equal(hit.class, cls, `${path} class`);
    }
  });

  it("covers all six classes (consent · pipeline · seal · ledger · pins · guardrails)", () => {
    const classes = new Set(SELFMOD_PROTECTED_PATHS.map((e) => e.class));
    for (const cls of ["consent", "pipeline", "seal", "ledger", "pins", "guardrails"] as const) {
      assert.ok(classes.has(cls), `class ${cls} must be represented`);
    }
    // The consent docs the contract rides on, by exact path.
    assert.equal(matchProtectedPath("AGENTS.md")?.class, "consent");
    assert.equal(matchProtectedPath("AGENT_GUIDE.md")?.class, "consent");
    assert.equal(matchProtectedPath("RESUME.md")?.class, "consent");
    // The ledger: the budget machinery + the append-only landing-log paper trail.
    assert.equal(matchProtectedPath("src/lib/token-ledger.ts")?.class, "ledger");
    assert.equal(matchProtectedPath("fixes/314_f2_selfimprove.md")?.class, "ledger");
    // Self-protection: the guardrail core may not be edited by what it guards.
    assert.equal(matchProtectedPath("src/lib/selfmod.ts")?.class, "guardrails");
    assert.equal(matchProtectedPath("src/lib/selfmod.server.ts")?.class, "guardrails");
  });

  it("matches case- and separator-insensitively (Windows + git-printed forms)", () => {
    assert.equal(matchProtectedPath("SRC\\LIB\\Engine.ts")?.path, "src/lib/engine.ts");
    assert.equal(matchProtectedPath("./src/lib/engine.ts")?.path, "src/lib/engine.ts");
    assert.equal(matchProtectedPath("scripts/GATE.SH")?.path, "scripts/gate.sh");
  });

  it("does not overreach: near-miss suffixes and unrelated paths stay editable", () => {
    assert.equal(matchProtectedPath("src/lib/engine.ts.bak"), null);
    assert.equal(matchProtectedPath("engine.ts"), null);
    assert.equal(matchProtectedPath("src/lib2/engine.ts"), null);
    assert.equal(matchProtectedPath("src/lib/packet.ts"), null);
    assert.equal(matchProtectedPath(42), null);
    assert.equal(matchProtectedPath(""), null);
  });

  it("normalizes repo-relative paths and refuses non-relative forms", () => {
    assert.equal(normalizeRelPathRaw("src\\lib\\x.ts"), "src/lib/x.ts");
    assert.equal(normalizeRelPathRaw("./src/x.ts"), "src/x.ts");
    assert.equal(normalizeRelPathRaw("src/lib/"), "src/lib");
    for (const bad of ["", "/etc/passwd", "C:/x.ts", "a/../b", "a/./b", "a//b", 7, null, undefined]) {
      assert.equal(normalizeRelPathRaw(bad), null, `${JSON.stringify(bad)} must not normalize`);
    }
  });
});

describe("selfmod · §preflight — the envelope refusals (design ①④⑤⑥ + caps)", () => {
  it("accepts a fully governed request and reports caps/token checks + honest limits", () => {
    const v = evaluateSelfmodPreflight(baseReq(), ENV_OK);
    assert.ok(v.ok, refusalDetails(v.ok ? [] : v.refusals));
    assert.equal(v.caps.maxFiles, SELFMOD_LIMITS.maxFilesDefault);
    assert.equal(v.caps.maxChangedLines, SELFMOD_LIMITS.maxChangedLinesDefault);
    assert.equal(v.tokenCap, 500);
    assert.equal(v.envCap, 1000);
    assert.equal(v.branch, "selfmod/f2");
    assert.ok(v.checks.length >= 3, "the verdict must report its checks");
    assert.equal(v.honestLimits, SELFMOD_HONEST_LIMITS);
  });

  it("REFUSES a protected path on the allow-list, coded (design ⑥ pin)", () => {
    const v = evaluateSelfmodPreflight(baseReq({ allow: ["src/lib/engine.ts"] }), ENV_OK);
    assert.ok(!v.ok);
    const hit = v.refusals.find((r) => r.code === SELFMOD_CODES.PROTECTED);
    assert.ok(hit, "a protected allow entry must refuse with RT_E_SELFMOD_PROTECTED");
    assert.match(hit.detail, /engine\.ts/);
  });

  it("REFUSES a directory allow-entry that would COVER protected paths (both directions)", () => {
    const v = evaluateSelfmodPreflight(baseReq({ allow: ["src/lib"] }), ENV_OK);
    assert.ok(!v.ok);
    const details = refusalDetails(v.refusals);
    assert.match(details, /would cover protected path src\/lib\/engine\.ts/);
    assert.match(details, /would cover protected path src\/lib\/token-ledger\.ts/);
    const scripts = evaluateSelfmodPreflight(baseReq({ allow: ["scripts"] }), ENV_OK);
    assert.ok(!scripts.ok);
    const scriptsDetails = refusalDetails(scripts.refusals);
    assert.match(scriptsDetails, /scripts\/gate\.sh/);
    assert.match(scriptsDetails, /scripts\/rapidtool-cli\.mjs/);
  });

  it("REFUSES malformed and empty allow-lists as validation", () => {
    const v = evaluateSelfmodPreflight(baseReq({ allow: ["", "/abs/x.ts", "C:/x.ts", "a/../b.ts", 42] }), ENV_OK);
    assert.ok(!v.ok);
    const validation = v.refusals.filter((r) => r.code === "RT_E_VALIDATION");
    assert.ok(validation.length >= 4, `every malformed entry refuses (got ${validation.length})`);
    const empty = evaluateSelfmodPreflight(baseReq({ allow: [] }), ENV_OK);
    assert.ok(!empty.ok);
    assert.match(refusalDetails(empty.refusals), /at least one repo-relative path/);
  });

  it("REFUSES caps above the hard ceilings (defaults apply when absent)", () => {
    const over = evaluateSelfmodPreflight(baseReq({ maxFiles: SELFMOD_LIMITS.maxFilesCeiling + 1 }), ENV_OK);
    assert.ok(!over.ok);
    assert.equal(over.refusals.find((r) => r.detail.includes("maxFiles"))?.code, SELFMOD_CODES.CAP_EXCEEDED);
    const zero = evaluateSelfmodPreflight(baseReq({ maxFiles: 0 }), ENV_OK);
    assert.ok(!zero.ok);
    assert.equal(zero.refusals.find((r) => r.detail.includes("maxFiles"))?.code, SELFMOD_CODES.CAP_EXCEEDED);
    const stringy = evaluateSelfmodPreflight(baseReq({ maxChangedLines: "800" as unknown as number }), ENV_OK);
    assert.ok(!stringy.ok);
    assert.equal(stringy.refusals.find((r) => r.detail.includes("maxChangedLines"))?.code, SELFMOD_CODES.CAP_EXCEEDED);
    // Boundaries are INCLUSIVE: exactly the ceiling is allowed.
    const atCeiling = evaluateSelfmodPreflight(
      baseReq({ maxFiles: SELFMOD_LIMITS.maxFilesCeiling, maxChangedLines: SELFMOD_LIMITS.maxChangedLinesCeiling }),
      ENV_OK,
    );
    assert.ok(atCeiling.ok, "a cap exactly at the ceiling is inside the wall");
  });

  it("REFUSES an unmetered or junk token cap (design ⑤: no cap in force = refusal)", () => {
    const unset = evaluateSelfmodPreflight(baseReq(), {});
    assert.ok(!unset.ok);
    assert.equal(unset.refusals.find((r) => r.detail.includes("RAPIDTOOL_TOKEN_CAP"))?.code, SELFMOD_CODES.UNGOVERNED);
    const junkForms = ["junk", "0", "0x10", "1e99", "12.9"];
    for (const cap of junkForms) {
      const v = evaluateSelfmodPreflight(baseReq(), { RAPIDTOOL_TOKEN_CAP: cap });
      assert.ok(!v.ok, `cap spelling ${cap} must refuse (strict parse, never a silent cap)`);
      assert.ok(v.refusals.some((r) => r.code === SELFMOD_CODES.UNGOVERNED || r.code === "RT_E_VALIDATION"));
    }
  });

  it("REFUSES --cap above the session cap (narrow yes, widen no) and non-positive caps", () => {
    const widen = evaluateSelfmodPreflight(baseReq({ requestedTokenCap: 1001 }), ENV_OK);
    assert.ok(!widen.ok);
    assert.match(refusalDetails(widen.refusals), /never widen it/);
    assert.equal(widen.refusals.find((r) => r.detail.includes("exceeds the session cap"))?.code, SELFMOD_CODES.UNGOVERNED);
    const zero = evaluateSelfmodPreflight(baseReq({ requestedTokenCap: 0 }), ENV_OK);
    assert.ok(!zero.ok);
    assert.equal(zero.refusals.find((r) => r.detail.includes("--cap"))?.code, "RT_E_VALIDATION");
    const boundary = evaluateSelfmodPreflight(baseReq({ requestedTokenCap: 1000 }), ENV_OK);
    assert.ok(boundary.ok, "--cap equal to the session cap is allowed");
  });

  it("REFUSES enforceDod off / missing (design ⑤) and human-seat forgeries (design ④)", () => {
    const advisory = evaluateSelfmodPreflight(baseReq({ enforceDod: false }), ENV_OK);
    assert.ok(!advisory.ok);
    assert.match(refusalDetails(advisory.refusals), /enforceDod/);
    assert.equal(advisory.refusals.find((r) => r.detail.includes("enforceDod"))?.code, SELFMOD_CODES.UNGOVERNED);
    const missing = evaluateSelfmodPreflight(baseReq({ enforceDod: undefined }), ENV_OK);
    assert.ok(!missing.ok);
    const forged = evaluateSelfmodPreflight(baseReq({ humanSeat: true }), ENV_OK);
    assert.ok(!forged.ok);
    assert.match(refusalDetails(forged.refusals), /never forges the human seat/);
  });

  it("REFUSES unsafe worktrees: not-a-root, wrong repo, main branch, dirty start", () => {
    for (const [field, value] of [
      ["isWorktreeRoot", false],
      ["sameRepo", false],
      ["clean", false],
    ] as const) {
      const facts = { isWorktreeRoot: true, sameRepo: true, branch: "selfmod/f2", clean: true, [field]: value };
      const v = evaluateSelfmodPreflight(baseReq({ worktree: facts }), ENV_OK);
      assert.ok(!v.ok, `worktree ${field}=${String(value)} must refuse`);
      assert.ok(v.refusals.some((r) => r.code === SELFMOD_CODES.UNGOVERNED));
    }
    for (const branch of ["main", "master", "MAIN", "main/hotfix"]) {
      const v = evaluateSelfmodPreflight(
        baseReq({ worktree: { isWorktreeRoot: true, sameRepo: true, branch, clean: true } }),
        ENV_OK,
      );
      assert.ok(!v.ok, `branch ${branch} must refuse`);
      assert.match(refusalDetails(v.refusals), /never main/);
    }
    const unknown = evaluateSelfmodPreflight(
      baseReq({ worktree: { isWorktreeRoot: true, sameRepo: true, clean: true } }),
      ENV_OK,
    );
    assert.ok(!unknown.ok);
    assert.match(refusalDetails(unknown.refusals), /branch unknown/);
    const missingFacts = evaluateSelfmodPreflight(baseReq({ worktree: null }), ENV_OK);
    assert.ok(!missingFacts.ok);
    assert.ok(missingFacts.refusals.length >= 4, "all four worktree facts refuse when absent");
  });

  it("REFUSES the repo itself as the worktree (self-mod never edits the live checkout)", () => {
    const v = evaluateSelfmodPreflight(baseReq({ worktreeDir: "C:\\RapidTool Main\\" }), ENV_OK);
    assert.ok(!v.ok);
    assert.match(refusalDetails(v.refusals), /DEDICATED worktree/);
  });

  it("is fail-closed with honest limits on every branch and never throws on garbage", () => {
    const garbage = evaluateSelfmodPreflight(null as unknown as SelfmodPreflightRequest, ENV_OK);
    assert.ok(!garbage.ok);
    assert.equal(garbage.refusals[0].code, "RT_E_VALIDATION");
    const failed = evaluateSelfmodPreflight(baseReq(), {});
    assert.ok(!failed.ok);
    assert.deepEqual(failed.honestLimits, SELFMOD_HONEST_LIMITS);
    const ok = evaluateSelfmodPreflight(baseReq(), ENV_OK);
    assert.ok(ok.ok);
    for (const r of failed.refusals) {
      assert.match(r.code, /^RT_E_[A-Z0-9_]+$/, `code ${r.code} must be registry-shaped`);
    }
  });
});

describe("selfmod · §diff — the scope + size caps on the REAL change set", () => {
  const CAPS = { maxFiles: 3, maxChangedLines: 100 };

  it("accepts an in-scope, in-cap diff and reports totals", () => {
    const v = diffWithinCaps(
      [{ path: "src/lib/packet.ts", added: 10, deleted: 5 }],
      CAPS,
      ["src/lib/packet.ts"],
    );
    assert.ok(v.ok);
    assert.deepEqual(v.totals, { files: 1, lines: 15 });
  });

  it("REFUSES a protected file in the diff even when a directory allow-entry covers it (design ⑥ pin)", () => {
    const v = diffWithinCaps(
      [{ path: "src/lib/engine.ts", added: 3, deleted: 3 }],
      CAPS,
      ["src/lib"],
    );
    assert.ok(!v.ok);
    const hit = v.refusals.find((r) => r.code === SELFMOD_CODES.PROTECTED);
    assert.ok(hit);
    assert.match(hit.detail, /diff touches protected path src\/lib\/engine\.ts/);
  });

  it("REFUSES out-of-scope files (allow-list scope guard)", () => {
    const v = diffWithinCaps(
      [{ path: "src/routes/index.tsx", added: 1, deleted: 0 }],
      CAPS,
      ["src/lib/packet.ts"],
    );
    assert.ok(!v.ok);
    assert.match(refusalDetails(v.refusals), /outside the --allow list/);
  });

  it("REFUSES over-cap diffs: files, lines, and both together (real totals in the detail)", () => {
    const files = diffWithinCaps(
      [
        { path: "src/lib/a.ts", added: 1, deleted: 0 },
        { path: "src/lib/b.ts", added: 1, deleted: 0 },
        { path: "src/lib/c.ts", added: 1, deleted: 0 },
        { path: "src/lib/d.ts", added: 1, deleted: 0 },
      ],
      CAPS,
      ["src/lib"],
    );
    assert.ok(!files.ok);
    assert.match(refusalDetails(files.refusals), /4 files > cap 3/);
    const lines = diffWithinCaps(
      [{ path: "src/lib/a.ts", added: 600, deleted: 300 }],
      CAPS,
      ["src/lib"],
    );
    assert.ok(!lines.ok);
    assert.match(refusalDetails(lines.refusals), /900 lines \(added\+deleted\) > cap 100/);
    assert.equal(lines.refusals.find((r) => r.detail.includes("900 lines"))?.code, SELFMOD_CODES.CAP_EXCEEDED);
  });

  it("counts untracked entries and refuses garbage without throwing", () => {
    const untracked = diffWithinCaps(
      [{ path: "src/lib/new.ts", added: 20, deleted: 0, untracked: true }],
      CAPS,
      ["src/lib"],
    );
    assert.ok(untracked.ok);
    assert.equal(untracked.totals.files, 1);
    const garbage = diffWithinCaps(null as unknown as [], CAPS, ["src/lib"]);
    assert.ok(!garbage.ok);
    assert.equal(garbage.refusals[0].code, "RT_E_VALIDATION");
    assert.deepEqual(garbage.totals, { files: 0, lines: 0 });
    const nullEntry = diffWithinCaps([null as unknown as { path: string; added: number; deleted: number }], CAPS, ["src/lib"]);
    assert.ok(!nullEntry.ok);
    assert.equal(nullEntry.refusals[0].code, "RT_E_VALIDATION");
  });

  it("allowedBy: file equality, directory prefix, and honest non-matches", () => {
    assert.ok(allowedBy(["src/lib/packet.ts"], "src/lib/packet.ts"));
    assert.ok(allowedBy(["src/lib"], "src/lib/deep/nested.ts"));
    assert.ok(!allowedBy(["src/lib/packet.ts"], "src/lib/packet.test.ts"));
    assert.ok(!allowedBy(["src/lib"], "src/libx/escape.ts"));
    assert.ok(!allowedBy(["src/lib"], "/abs.ts"));
  });
});

describe("selfmod · §landing — design ③: a failed verify is NEVER a commit", () => {
  it("lands only with a green verify on a non-main branch", () => {
    const d = selfmodLandingDecision({ verify: { ok: true }, branch: "selfmod/f2" });
    assert.equal(d.mayLand, true);
    assert.equal(d.rollbackRequired, false);
    assert.deepEqual(d.refusals, []);
  });

  it("REFUSES an absent verify verdict (mandatory self-DoD) — pin", () => {
    const d = selfmodLandingDecision({ verify: null, branch: "selfmod/f2" });
    assert.equal(d.mayLand, false);
    assert.equal(d.rollbackRequired, true);
    const hit = d.refusals.find((r) => r.code === SELFMOD_CODES.VERIFY_FAILED);
    assert.ok(hit);
    assert.match(hit.detail, /scripts\/gate\.sh is mandatory/);
  });

  it("REFUSES a red verify verdict and carries the gate tail as evidence — pin", () => {
    const d = selfmodLandingDecision({
      verify: { ok: false, reason: "tests leg red", tail: "TS2339: Property 'x' does not exist", ms: 1234 },
      branch: "selfmod/f2",
    });
    assert.equal(d.mayLand, false);
    const hit = d.refusals.find((r) => r.code === SELFMOD_CODES.VERIFY_FAILED);
    assert.ok(hit);
    assert.match(hit.detail, /tests leg red/);
    assert.match(hit.detail, /TS2339/);
  });

  it("REFUSES main even with a green verify", () => {
    const d = selfmodLandingDecision({ verify: { ok: true }, branch: "main" });
    assert.equal(d.mayLand, false);
    assert.match(refusalDetails(d.refusals), /never main/);
    assert.equal(d.refusals.find((r) => r.detail.includes("never main"))?.code, SELFMOD_CODES.UNGOVERNED);
  });

  it("passes caps violations through and is fail-closed on garbage input", () => {
    const d = selfmodLandingDecision({
      verify: { ok: true },
      branch: "selfmod/f2",
      capsVerdict: { ok: false, refusals: [{ code: SELFMOD_CODES.CAP_EXCEEDED, detail: "diff touches 9 files > cap 3" }] },
    });
    assert.equal(d.mayLand, false);
    assert.match(refusalDetails(d.refusals), /9 files > cap 3/);
    const garbage = selfmodLandingDecision(null as unknown as { verify: null; branch: string });
    assert.equal(garbage.mayLand, false);
    assert.equal(garbage.refusals[0].code, "RT_E_VALIDATION");
  });
});

describe("selfmod · §codes + helpers", () => {
  it("exposes the four reserved codes with complete registry docs", () => {
    const codes = Object.values(SELFMOD_CODES);
    assert.equal(codes.length, 4);
    for (const code of codes) {
      assert.match(code, /^RT_E_[A-Z0-9_]+$/);
      assert.ok(SELFMOD_CODE_DOC[code], `${code} needs a doc entry`);
      assert.ok(SELFMOD_CODE_DOC[code].meaning.length > 20, `${code} meaning`);
      assert.ok(SELFMOD_CODE_DOC[code].agentAction.length > 20, `${code} agentAction`);
    }
  });

  it("keeps every default at or under its hard ceiling", () => {
    assert.ok(SELFMOD_LIMITS.maxFilesDefault <= SELFMOD_LIMITS.maxFilesCeiling);
    assert.ok(SELFMOD_LIMITS.maxChangedLinesDefault <= SELFMOD_LIMITS.maxChangedLinesCeiling);
    assert.ok(SELFMOD_LIMITS.maxFilesCeiling <= SELFMOD_LIMITS.maxChangedLinesCeiling * 100, "sanity: ceilings are finite small numbers");
  });

  it("states the honest limits up front (design ⑦): bounded runner, never a sandbox", () => {
    assert.ok(SELFMOD_HONEST_LIMITS.length >= 4);
    assert.ok(SELFMOD_HONEST_LIMITS.some((l) => l.includes("NOT an OS sandbox")));
    assert.ok(SELFMOD_HONEST_LIMITS.some((l) => l.includes("human seat")));
    assert.ok(SELFMOD_HONEST_LIMITS.some((l) => l.includes("keyless = refusal")));
  });

  it("classifies mainline branches and same-path forms exactly", () => {
    for (const b of ["main", "master", "MAIN", "Master", "main/x", ""]) {
      assert.equal(isMainBranch(b), true, `${JSON.stringify(b)} is mainline`);
    }
    for (const b of ["selfmod/f2", "feature/x", "d-wave", "mains"]) {
      assert.equal(isMainBranch(b), false, `${JSON.stringify(b)} is not mainline`);
    }
    assert.equal(isMainBranch(undefined), false);
    assert.ok(samePathLexical("C:\\Repo\\", "c:/repo"));
    assert.ok(!samePathLexical("C:\\repo", "C:\\repo-wt"));
    assert.ok(!samePathLexical(null, "C:\\repo"));
  });
});

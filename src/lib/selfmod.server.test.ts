// ---------------------------------------------------------------------------
// selfmod.server.test.ts — F2 · 314 wave · the EXECUTOR pins (real temp repos).
//
// Run: node --experimental-strip-types --test src/lib/selfmod.server.test.ts
//
// Scoping rule (mirrors git.server.test.ts): every repo this suite creates
// lives in a REAL temp dir under C:/Users/mnril/f2_scratch/ — never inside the
// repo. Each pin asserts on real git state (log counts, porcelain, HEADs), so
// "a failed verify = no commit", "over-cap refused", and "protected-path write
// refused" are behavioral facts, not pure-function theater.
// ---------------------------------------------------------------------------
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import {
  collectSelfmodDiff,
  discardSelfmodWorktreeChanges,
  landSelfmodWorktree,
  preflightSelfmodRun,
  runSelfmodVerifyGate,
  validateSelfmodWorktree,
} from "./selfmod.server.ts";
import { SELFMOD_CODES, diffWithinCaps, isMainBranch } from "./selfmod.ts";

// ---------------------------------------------------------------------------
// harness
// ---------------------------------------------------------------------------

const SCRATCH_ROOT = process.env.F2_SCRATCH_ROOT ?? "C:\\Users\\mnril\\f2_scratch";
mkdirSync(SCRATCH_ROOT, { recursive: true });

const made: string[] = [];
function scratch(prefix: string): string {
  const d = mkdtempSync(join(SCRATCH_ROOT, prefix));
  made.push(d);
  return d;
}
after(() => {
  for (const d of made) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      // best-effort — a locked file must not fail the suite after it passed.
    }
  }
});

const HAS_GIT = spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;
const HAS_BASH = spawnSync("bash", ["-c", "exit 0"], { encoding: "utf8" }).status === 0;
const SKIP_GIT = "git is not installed on this host";
const SKIP_BASH = "bash is not installed on this host";

function sh(cwd: string, argv: string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync("git", argv, { cwd, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}
function mustSh(cwd: string, argv: string[]): string {
  const r = sh(cwd, argv);
  assert.equal(r.status, 0, `git ${argv.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}
const ID = ["-c", "user.name=Test", "-c", "user.email=test@local"];

function gateScript(kind: "green" | "red" | "sleepy"): string {
  if (kind === "green") return "#!/usr/bin/env bash\nprintf '%s\\n' '{\"ok\":true,\"double\":false}'\n";
  if (kind === "red") return "#!/usr/bin/env bash\nprintf '%s\\n' '{\"ok\":false,\"hardFails\":[\"tests\"]}'\nexit 1\n";
  return "#!/usr/bin/env bash\nsleep 5\nprintf '%s\\n' '{\"ok\":true}'\n";
}

/** A scratch repo: main branch, one initial commit, lib.js, optional gate stub. */
function setupRepo(gate: "green" | "red" | "sleepy" | "missing" = "green"): string {
  const repo = scratch("repo-");
  mustSh(repo, ["init", "-b", "main"]);
  writeFileSync(join(repo, "lib.js"), "export const a = 1;\n", "utf8");
  if (gate !== "missing") {
    mkdirSync(join(repo, "scripts"), { recursive: true });
    writeFileSync(join(repo, "scripts", "gate.sh"), gateScript(gate), "utf8");
  }
  mustSh(repo, ["add", "-A"]);
  mustSh(repo, [...ID, "commit", "-m", "setup"]);
  return repo;
}

let branchCounter = 0;
/** A clean linked worktree of `repo` on a unique non-main branch. */
function addWorktree(repo: string): { dir: string; branch: string } {
  const dir = scratch("wt-");
  const branch = `selfmod/t${++branchCounter}`;
  mustSh(repo, ["worktree", "add", dir, "-b", branch]);
  return { dir, branch };
}

// Lazy singletons — the shared repos are never mutated past setup; each pin
// creates its own worktree (unique branch) so pins cannot contaminate one another.
const repos: Partial<Record<"green" | "red" | "sleepy" | "missing", string>> = {};
function repo(kind: "green" | "red" | "sleepy" | "missing"): string {
  repos[kind] ??= setupRepo(kind);
  return repos[kind] as string;
}

function headCount(dir: string, ref: string): number {
  return Number(mustSh(dir, ["rev-list", "--count", ref]));
}
/** Porcelain as-is — the XY columns' LEADING SPACE is data (staged vs not). */
function porcelain(dir: string): string {
  const r = sh(dir, ["status", "--porcelain"]);
  assert.equal(r.status, 0, `git status failed: ${r.stderr}`);
  return r.stdout.replace(/[\r\n]+$/, "");
}

// ---------------------------------------------------------------------------
// §validate — design ②: worktree, branch, never main, clean start
// ---------------------------------------------------------------------------

describe("selfmod.server · §validate — the worktree discipline", () => {
  it("accepts a clean linked worktree of the same repo on a non-main branch", async (t) => {
    if (!HAS_GIT) return t.skip(SKIP_GIT);
    const r = repo("green");
    const wt = addWorktree(r);
    const v = await validateSelfmodWorktree({ repoDir: r, worktreeDir: wt.dir });
    assert.ok(v.ok, v.ok ? "" : JSON.stringify(v.refusals));
    assert.equal(v.branch, wt.branch);
    assert.match(v.head, /^[0-9a-f]{40}$/);
    assert.equal(v.checks.length, 4);
  });

  it("REFUSES a dirty worktree at start (attribution impossible)", async (t) => {
    if (!HAS_GIT) return t.skip(SKIP_GIT);
    const wt = addWorktree(repo("green"));
    writeFileSync(join(wt.dir, "dirty.txt"), "x\n", "utf8");
    const v = await validateSelfmodWorktree({ repoDir: repo("green"), worktreeDir: wt.dir });
    assert.ok(!v.ok);
    assert.match(v.refusals.map((x) => x.detail).join(" | "), /not clean at start/);
    assert.equal(v.refusals[0].code, SELFMOD_CODES.UNGOVERNED);
  });

  it("REFUSES a worktree on main (never main — design ②)", async (t) => {
    if (!HAS_GIT) return t.skip(SKIP_GIT);
    const r = repo("green");
    mustSh(r, ["checkout", "--detach"]); // frees `main` for a linked worktree
    const dir = scratch("wt-main-");
    mustSh(r, ["worktree", "add", dir, "main"]);
    const v = await validateSelfmodWorktree({ repoDir: r, worktreeDir: dir });
    assert.ok(!v.ok);
    assert.ok(v.refusals.some((x) => x.code === SELFMOD_CODES.UNGOVERNED && /never main/.test(x.detail)));
    // The main ref is untouched by the refusal.
    assert.equal(headCount(r, "main"), 1);
    mustSh(r, ["worktree", "remove", "--force", dir]); // free `main` for later pins
  });

  it("REFUSES a worktree of a DIFFERENT repo", async (t) => {
    if (!HAS_GIT) return t.skip(SKIP_GIT);
    const wtOther = addWorktree(repo("red"));
    const v = await validateSelfmodWorktree({ repoDir: repo("green"), worktreeDir: wtOther.dir });
    assert.ok(!v.ok);
    assert.match(v.refusals.map((x) => x.detail).join(" | "), /not a worktree of repoDir/);
  });

  it("REFUSES the repo itself, a subdir, and a missing path", async (t) => {
    if (!HAS_GIT) return t.skip(SKIP_GIT);
    const r = repo("green");
    const same = await validateSelfmodWorktree({ repoDir: r, worktreeDir: r });
    assert.ok(!same.ok);
    assert.match(same.refusals.map((x) => x.detail).join(" | "), /DEDICATED worktree/);
    const wt = addWorktree(r);
    mkdirSync(join(wt.dir, "sub"));
    const sub = await validateSelfmodWorktree({ repoDir: r, worktreeDir: join(wt.dir, "sub") });
    assert.ok(!sub.ok);
    assert.match(sub.refusals.map((x) => x.detail).join(" | "), /worktree ROOT/);
    const gone = await validateSelfmodWorktree({ repoDir: r, worktreeDir: join(SCRATCH_ROOT, "no-such-worktree-314") });
    assert.ok(!gone.ok);
    assert.match(gone.refusals.map((x) => x.detail).join(" | "), /does not exist/);
  });

  it("REFUSES MSYS-style paths on Windows with the correct hint", async (t) => {
    if (!HAS_GIT) return t.skip(SKIP_GIT);
    if (process.platform !== "win32") return t.skip("win32-only form");
    const v = await validateSelfmodWorktree({ repoDir: "/c/Users/nope", worktreeDir: "/c/Users/nope-wt" });
    assert.ok(!v.ok);
    assert.match(v.refusals.map((x) => x.detail).join(" | "), /MSYS-style path/);
  });
});

// ---------------------------------------------------------------------------
// §preflight — the composition: real git facts → the pure envelope verdict
// ---------------------------------------------------------------------------

describe("selfmod.server · §preflight — real facts + envelope guards", () => {
  it("passes a fully governed request on a real worktree", async (t) => {
    if (!HAS_GIT) return t.skip(SKIP_GIT);
    const wt = addWorktree(repo("green"));
    const r = await preflightSelfmodRun({
      repoDir: repo("green"),
      worktreeDir: wt.dir,
      allow: ["lib.js"],
      requestedTokenCap: 100,
      enforceDod: true,
      env: { RAPIDTOOL_TOKEN_CAP: "500" },
    });
    assert.ok(r.ok, r.ok ? "" : JSON.stringify(r.refusals));
    assert.equal(r.worktree.branch, wt.branch);
    assert.equal(r.verdict.tokenCap, 100);
    assert.equal(r.verdict.envCap, 500);
  });

  it("REFUSES a protected path on the allow-list (design ⑥) even on a green worktree", async (t) => {
    if (!HAS_GIT) return t.skip(SKIP_GIT);
    const wt = addWorktree(repo("green"));
    const r = await preflightSelfmodRun({
      repoDir: repo("green"),
      worktreeDir: wt.dir,
      allow: ["src/lib/engine.ts"],
      requestedTokenCap: 100,
      enforceDod: true,
      env: { RAPIDTOOL_TOKEN_CAP: "500" },
    });
    assert.ok(!r.ok);
    assert.ok(r.refusals.some((x) => x.code === SELFMOD_CODES.PROTECTED));
  });

  it("REFUSES a dirty worktree BEFORE the pure envelope is even judged", async (t) => {
    if (!HAS_GIT) return t.skip(SKIP_GIT);
    const wt = addWorktree(repo("green"));
    writeFileSync(join(wt.dir, "foreign.txt"), "someone else's work\n", "utf8");
    const r = await preflightSelfmodRun({
      repoDir: repo("green"),
      worktreeDir: wt.dir,
      allow: ["lib.js"],
      requestedTokenCap: 100,
      enforceDod: true,
      env: { RAPIDTOOL_TOKEN_CAP: "500" },
    });
    assert.ok(!r.ok);
    assert.match(r.refusals.map((x) => x.detail).join(" | "), /not clean at start/);
  });

  it("REFUSES an unmetered run (design ⑤) on a green worktree", async (t) => {
    if (!HAS_GIT) return t.skip(SKIP_GIT);
    const wt = addWorktree(repo("green"));
    const r = await preflightSelfmodRun({
      repoDir: repo("green"),
      worktreeDir: wt.dir,
      allow: ["lib.js"],
      requestedTokenCap: 100,
      enforceDod: true,
      env: {},
    });
    assert.ok(!r.ok);
    assert.ok(r.refusals.some((x) => x.code === SELFMOD_CODES.UNGOVERNED && /RAPIDTOOL_TOKEN_CAP/.test(x.detail)));
  });
});

// ---------------------------------------------------------------------------
// §collect — the real change set (numstat + untracked)
// ---------------------------------------------------------------------------

describe("selfmod.server · §collect — the real change set", () => {
  it("sees tracked edits and untracked files with honest counts", async (t) => {
    if (!HAS_GIT) return t.skip(SKIP_GIT);
    const wt = addWorktree(repo("green"));
    appendFileSync(join(wt.dir, "lib.js"), "export const b = 2;\nexport const c = 3;\n", "utf8");
    writeFileSync(join(wt.dir, "notes.txt"), "one\ntwo\nthree\nfour\nfive\n", "utf8");
    const c = await collectSelfmodDiff(wt.dir);
    assert.ok(c.ok, JSON.stringify(c.refusals));
    const lib = c.entries.find((e) => e.path === "lib.js");
    assert.ok(lib, "lib.js must appear");
    assert.equal(lib.added, 2);
    const notes = c.entries.find((e) => e.path === "notes.txt");
    assert.ok(notes, "notes.txt must appear");
    assert.equal(notes.added, 5);
    assert.equal(notes.untracked, true);
  });

  it("reports an empty change set on a clean worktree", async (t) => {
    if (!HAS_GIT) return t.skip(SKIP_GIT);
    const wt = addWorktree(repo("green"));
    const c = await collectSelfmodDiff(wt.dir);
    assert.ok(c.ok);
    assert.deepEqual(c.entries, []);
  });
});

// ---------------------------------------------------------------------------
// §gate — scripts/gate.sh, parsed honestly (green iff last stdout line ok:true)
// ---------------------------------------------------------------------------

describe("selfmod.server · §gate — the self-DoD verdict", () => {
  it("reads a green verdict from the worktree's gate.sh", async (t) => {
    if (!HAS_GIT || !HAS_BASH) return t.skip(!HAS_GIT ? SKIP_GIT : SKIP_BASH);
    const wt = addWorktree(repo("green"));
    const v = await runSelfmodVerifyGate(wt.dir);
    assert.equal(v.ok, true);
    assert.match(v.reason ?? "", /gate\.sh ok/);
    assert.ok(typeof v.ms === "number");
  });

  it("reads a RED verdict and a missing gate as failures, never a green guess", async (t) => {
    if (!HAS_GIT || !HAS_BASH) return t.skip(!HAS_GIT ? SKIP_GIT : SKIP_BASH);
    const red = await runSelfmodVerifyGate(addWorktree(repo("red")).dir);
    assert.equal(red.ok, false);
    assert.match(red.reason ?? "", /without an ok:true verdict/);
    const missing = await runSelfmodVerifyGate(addWorktree(repo("missing")).dir);
    assert.equal(missing.ok, false);
    assert.match(missing.reason ?? "", /missing in the worktree/);
  });

  it("bounds a hanging gate: a timeout is a red verdict, not a hang", async (t) => {
    if (!HAS_GIT || !HAS_BASH) return t.skip(!HAS_GIT ? SKIP_GIT : SKIP_BASH);
    const wt = addWorktree(repo("sleepy"));
    const v = await runSelfmodVerifyGate(wt.dir, { timeoutMs: 1000 });
    assert.equal(v.ok, false);
    assert.match(v.reason ?? "", /could not run \(timeout\)/);
  });
});

// ---------------------------------------------------------------------------
// §land — design ③ pins: failed verify = NO commit · over-cap refused ·
//         protected-path write refused · never main
// ---------------------------------------------------------------------------

describe("selfmod.server · §land — the verify-before-commit gate", () => {
  it("lands ONLY on a green verify: commit exists on the branch, never on main", async (t) => {
    if (!HAS_GIT || !HAS_BASH) return t.skip(!HAS_GIT ? SKIP_GIT : SKIP_BASH);
    const r = repo("green");
    const wt = addWorktree(r);
    appendFileSync(join(wt.dir, "lib.js"), "export const b = 2;\n", "utf8");
    const verify = await runSelfmodVerifyGate(wt.dir);
    assert.equal(verify.ok, true);
    const msg = "selfmod: scratch change";
    const land = await landSelfmodWorktree({
      worktreeDir: wt.dir,
      message: msg,
      verify,
      caps: { maxFiles: 5, maxChangedLines: 50 },
      allow: ["lib.js"],
    });
    assert.ok(land.ok, land.ok ? "" : JSON.stringify(land.refusals));
    assert.match(land.commit, /^[0-9a-f]{40}$/);
    assert.equal(land.branch, wt.branch);
    assert.equal(headCount(wt.dir, "HEAD"), 2);
    assert.equal(headCount(r, "main"), 1, "main must not move");
    assert.equal(porcelain(wt.dir), "");
    assert.equal(mustSh(wt.dir, ["log", "-1", "--format=%s"]), msg);
  });

  it("PIN: a failed verify = NO commit (log count unchanged, nothing staged)", async (t) => {
    if (!HAS_GIT || !HAS_BASH) return t.skip(!HAS_GIT ? SKIP_GIT : SKIP_BASH);
    const wt = addWorktree(repo("red"));
    appendFileSync(join(wt.dir, "lib.js"), "export const b = 2;\n", "utf8");
    const verify = await runSelfmodVerifyGate(wt.dir);
    assert.equal(verify.ok, false);
    const before = headCount(wt.dir, "HEAD");
    const land = await landSelfmodWorktree({
      worktreeDir: wt.dir,
      message: "must not land",
      verify,
      caps: { maxFiles: 5, maxChangedLines: 50 },
      allow: ["lib.js"],
    });
    assert.equal(land.ok, false);
    assert.ok(land.refusals.some((x) => x.code === SELFMOD_CODES.VERIFY_FAILED));
    assert.equal(headCount(wt.dir, "HEAD"), before, "no commit after a red verify");
    assert.equal(land.unstaged, false, "a red verify refuses BEFORE staging — zero git mutation");
    assert.match(porcelain(wt.dir), / M lib\.js/);
  });

  it("PIN: an over-cap diff is refused with real totals, no commit", async (t) => {
    if (!HAS_GIT || !HAS_BASH) return t.skip(!HAS_GIT ? SKIP_GIT : SKIP_BASH);
    const wt = addWorktree(repo("green"));
    appendFileSync(join(wt.dir, "lib.js"), "export const b = 2;\nexport const c = 3;\nexport const d = 4;\n", "utf8");
    const verify = await runSelfmodVerifyGate(wt.dir);
    assert.equal(verify.ok, true);
    const before = headCount(wt.dir, "HEAD");
    const land = await landSelfmodWorktree({
      worktreeDir: wt.dir,
      message: "over cap",
      verify,
      caps: { maxFiles: 1, maxChangedLines: 2 },
      allow: ["lib.js"],
    });
    assert.equal(land.ok, false);
    const cap = land.refusals.find((x) => x.code === SELFMOD_CODES.CAP_EXCEEDED);
    assert.ok(cap, "the over-cap diff must refuse CAP_EXCEEDED");
    assert.match(cap.detail, /3 lines \(added\+deleted\) > cap 2/);
    assert.equal(headCount(wt.dir, "HEAD"), before, "no commit over cap");
    assert.equal(land.unstaged, true, "the refused staging was undone");
  });

  it("PIN: a protected-path WRITE in the worktree is refused coded, no commit (design ⑥)", async (t) => {
    if (!HAS_GIT || !HAS_BASH) return t.skip(!HAS_GIT ? SKIP_GIT : SKIP_BASH);
    const wt = addWorktree(repo("green"));
    mkdirSync(join(wt.dir, "src", "lib"), { recursive: true });
    writeFileSync(join(wt.dir, "src", "lib", "engine.ts"), "// the run trying to edit its own engine\n", "utf8");
    const verify = await runSelfmodVerifyGate(wt.dir);
    assert.equal(verify.ok, true, "the gate itself is green — the refusal must come from the manifest");
    const before = headCount(wt.dir, "HEAD");
    const land = await landSelfmodWorktree({
      worktreeDir: wt.dir,
      message: "forbidden edit",
      verify,
      caps: { maxFiles: 5, maxChangedLines: 50 },
      allow: ["src"], // scope-legal by the allow-list — the MANIFEST must be the wall
    });
    assert.equal(land.ok, false);
    const hit = land.refusals.find((x) => x.code === SELFMOD_CODES.PROTECTED);
    assert.ok(hit, "a protected-path write must refuse RT_E_SELFMOD_PROTECTED");
    assert.match(hit.detail, /diff touches protected path src\/lib\/engine\.ts/);
    assert.equal(headCount(wt.dir, "HEAD"), before, "no commit of a protected write");
    assert.ok(existsSync(join(wt.dir, "src", "lib", "engine.ts")), "the refused file stays for inspection");
  });

  it("REFUSES to land on main even with a green verify (zero mutation)", async (t) => {
    if (!HAS_GIT) return t.skip(SKIP_GIT);
    const r = repo("green");
    mustSh(r, ["checkout", "--detach"]);
    const dir = scratch("wt-main-");
    mustSh(r, ["worktree", "add", dir, "main"]);
    const land = await landSelfmodWorktree({
      worktreeDir: dir,
      message: "must not land on main",
      verify: { ok: true },
      caps: { maxFiles: 5, maxChangedLines: 50 },
      allow: ["lib.js"],
    });
    assert.equal(land.ok, false);
    assert.ok(land.refusals.some((x) => /never main/.test(x.detail)));
    assert.equal(headCount(r, "main"), 1);
    assert.ok(isMainBranch("main"), "sanity: the branch in question is mainline");
    mustSh(r, ["worktree", "remove", "--force", dir]); // free `main` for later pins
  });

  it("REFUSES malformed commit messages without running any git", async (t) => {
    if (!HAS_GIT) return t.skip(SKIP_GIT);
    const wt = addWorktree(repo("green"));
    const before = headCount(wt.dir, "HEAD");
    for (const bad of ["", "  ", "x".repeat(501), `bad\u0001control`]) {
      const land = await landSelfmodWorktree({
        worktreeDir: wt.dir,
        message: bad,
        verify: { ok: true },
        caps: { maxFiles: 5, maxChangedLines: 50 },
        allow: ["lib.js"],
      });
      assert.equal(land.ok, false, `message ${JSON.stringify(bad.slice(0, 12))} must refuse`);
      assert.equal(land.refusals[0].code, "RT_E_VALIDATION");
    }
    assert.equal(headCount(wt.dir, "HEAD"), before, "no commit from a message refusal");
  });
});

// ---------------------------------------------------------------------------
// §discard — the rollback path
// ---------------------------------------------------------------------------

describe("selfmod.server · §discard — the rollback path", () => {
  it("discards ALL uncommitted changes: tracked restored, untracked removed, status clean", async (t) => {
    if (!HAS_GIT) return t.skip(SKIP_GIT);
    const wt = addWorktree(repo("green"));
    appendFileSync(join(wt.dir, "lib.js"), "export const junk = 1;\n", "utf8");
    writeFileSync(join(wt.dir, "untracked.txt"), "junk\n", "utf8");
    const d = await discardSelfmodWorktreeChanges(wt.dir);
    assert.ok(d.ok, d.ok ? "" : JSON.stringify(d.refusals));
    assert.equal(d.status, "");
    assert.equal(porcelain(wt.dir), "");
    assert.equal(existsSync(join(wt.dir, "untracked.txt")), false, "untracked file must be removed");
    // The tracked file is byte-back to the committed state (diff is empty).
    assert.equal(mustSh(wt.dir, ["diff", "HEAD"]), "");
    assert.equal(headCount(wt.dir, "HEAD"), 1, "rollback never touches history");
  });

  it("REFUSES to discard on a main worktree (defense in depth)", async (t) => {
    if (!HAS_GIT) return t.skip(SKIP_GIT);
    const r = repo("green");
    mustSh(r, ["checkout", "--detach"]);
    const dir = scratch("wt-main-");
    mustSh(r, ["worktree", "add", dir, "main"]);
    const d = await discardSelfmodWorktreeChanges(dir);
    assert.equal(d.ok, false);
    assert.ok(d.refusals.some((x) => x.code === SELFMOD_CODES.UNGOVERNED));
    mustSh(r, ["worktree", "remove", "--force", dir]); // free `main` for later pins
  });
});

// ---------------------------------------------------------------------------
// §composition — the future verb's flow, end to end (preflight → collect →
// caps → verify → land) on one real worktree
// ---------------------------------------------------------------------------

describe("selfmod.server · §composition — the full guarded flow", () => {
  it("takes a green-change request from preflight to a landed branch commit", async (t) => {
    if (!HAS_GIT || !HAS_BASH) return t.skip(!HAS_GIT ? SKIP_GIT : SKIP_BASH);
    const r = repo("green");
    const wt = addWorktree(r);
    const env = { RAPIDTOOL_TOKEN_CAP: "1000" };
    const pre = await preflightSelfmodRun({
      repoDir: r,
      worktreeDir: wt.dir,
      allow: ["lib.js"],
      requestedTokenCap: 700,
      enforceDod: true,
      env,
      maxFiles: 3,
      maxChangedLines: 40,
    });
    assert.ok(pre.ok, pre.ok ? "" : JSON.stringify(pre.refusals));
    appendFileSync(join(wt.dir, "lib.js"), "export const improved = true;\n", "utf8");
    const diff = await collectSelfmodDiff(wt.dir);
    assert.ok(diff.ok);
    const capped = diffWithinCaps(diff.entries, pre.verdict.caps, ["lib.js"]);
    assert.ok(capped.ok, JSON.stringify(capped.refusals));
    const verify = await runSelfmodVerifyGate(wt.dir);
    assert.equal(verify.ok, true);
    const land = await landSelfmodWorktree({
      worktreeDir: wt.dir,
      message: "selfmod: guarded scratch improvement",
      verify,
      caps: pre.verdict.caps,
      allow: ["lib.js"],
    });
    assert.ok(land.ok, land.ok ? "" : JSON.stringify(land.refusals));
    assert.equal(headCount(r, "main"), 1, "main never moved");
    assert.equal(headCount(wt.dir, "HEAD"), 2);
  });
});

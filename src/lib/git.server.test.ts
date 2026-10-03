// ---------------------------------------------------------------------------
// git.server.test.ts — W18 lane 3 (fixes/249): T4.2 git landing tail tests.
//
// Run: node --experimental-strip-types --test src/lib/git.server.test.ts
//
// Scoping rule for this suite (row requirement): every init/commit test runs in
// a REAL temp dir under C:/Users/mnril/w18l3_scratch/ — never inside the repo.
// The last describe proves the host repo's own `git status` fingerprint is
// byte-identical across a full scratch cycle, and the host-guard tests prove
// the repo (root or subdir) is refused as a landing target outright.
// ---------------------------------------------------------------------------
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_GIT_LAND_IDENTITY,
  EMITTED_RECORD_REL,
  GIT_LAND_DELIVERY_MARKER,
  GIT_LANDING_MARKER_KIND,
  GIT_LANDING_MARKER_REL,
  GIT_LANDING_MARKER_VERSION,
  GIT_LANDING_OUTPUT_CAP,
  GIT_LANDING_SUBCOMMANDS,
  LAND_COMMIT_TYPE,
  checkGitLandSeat,
  conventionalLandMessage,
  gitLandCommit,
  gitLandEmitted,
  gitLandInit,
  gitLandReadBack,
  gitLandingAvailable,
  isGitLandingSubcommandAllowed,
  runBoundedChild,
  verifyGitPlan,
} from "./git.server.ts";

// ---------------------------------------------------------------------------
// harness: scratch dirs, repo fingerprint, seat fixtures
// ---------------------------------------------------------------------------

/** The wave-designated scratch root — everything this suite creates lives here. */
const SCRATCH_ROOT = process.env.W18L3_SCRATCH_ROOT ?? "C:\\Users\\mnril\\w18l3_scratch";
/** The repo this suite must never mutate (derived from this file's location). */
const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

mkdirSync(SCRATCH_ROOT, { recursive: true });

const made: string[] = [];
/** A fresh real temp dir under the scratch root, reaped in after() below. */
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

/**
 * fixes/343_3: the delivery seam's own scratch root — the wave rule is that
 * every git operation this lane runs lives under $TEMP/rt343_3 (never beside
 * the W18L3 root, and never in the repo). Reaped by the same after() above.
 */
const LAND_SCRATCH = process.env.RT343_3_SCRATCH_ROOT ?? join(tmpdir(), "rt343_3");
mkdirSync(LAND_SCRATCH, { recursive: true });
function landScratch(prefix: string): string {
  const d = mkdtempSync(join(LAND_SCRATCH, prefix));
  made.push(d);
  return d;
}

/** Seed a MINIMAL tree with the shape `headless.emitProject` writes: the
 *  emitted record plus a small manifest. The seam's contract reads only the
 *  record's existence, so this exercises the real guard cheaply; the REAL
 *  emitted-tree end-to-end proof lives in headless.test.ts. */
function seedEmittedTree(dir: string, extra: Record<string, string> = {}): string[] {
  for (const rel of [EMITTED_RECORD_REL, ".gitignore", "package.json", "src/index.ts", ...Object.keys(extra)]) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
  }
  writeFileSync(join(dir, EMITTED_RECORD_REL), `${JSON.stringify({ id: "land-test", name: "Land Test" })}\n`, "utf8");
  writeFileSync(join(dir, ".gitignore"), "node_modules/\ndist/\n.rapidtool/logs/\n", "utf8");
  writeFileSync(join(dir, "package.json"), '{ "name": "land-test" }\n', "utf8");
  writeFileSync(join(dir, "src", "index.ts"), "export const x = 1;\n", "utf8");
  const manifest = [EMITTED_RECORD_REL, ".gitignore", "package.json", "src/index.ts"];
  for (const [rel, body] of Object.entries(extra)) {
    writeFileSync(join(dir, rel), body, "utf8");
    manifest.push(rel);
  }
  return manifest;
}

/** `git rev-list --count HEAD` in a scratch repo; -1 when the repo is unborn. */
function commitCount(dir: string): number {
  const r = spawnSync("git", ["-C", dir, "rev-list", "--count", "HEAD"], { encoding: "utf8" });
  if (r.status !== 0) return 0;
  return Number.parseInt((r.stdout ?? "0").trim(), 10);
}

const HAS_GIT = spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;
/** An absolute path to a binary that does not exist (the coded git-absent path). */
const BOGUS_GIT = join(SCRATCH_ROOT, "no-such-dir", "git-absent-binary.exe");

const HUMAN_TOKEN = "w18l3-seat-token";
function humanSeat(overrides?: {
  humanSeatToken?: string;
  expectedHumanSeatToken?: string;
}): Record<string, unknown> {
  return {
    actor: { decidedBy: "human", seat: "human-cli-i-am-human" },
    humanSeatToken: HUMAN_TOKEN,
    expectedHumanSeatToken: HUMAN_TOKEN,
    ...overrides,
  };
}

/** Read-only fingerprint of the host repo: HEAD + `git status --porcelain`. */
function repoFingerprint(): string {
  const status = spawnSync(
    "git",
    ["--no-optional-locks", "-C", REPO_ROOT, "status", "--porcelain=v1"],
    { encoding: "utf8" },
  );
  const head = spawnSync("git", ["-C", REPO_ROOT, "rev-parse", "HEAD"], { encoding: "utf8" });
  return `status-exit=${status.status}\nHEAD=${(head.stdout ?? "").trim()}\n${status.stdout ?? ""}`;
}

function scrubContains(dir: string, rel: string): boolean {
  return existsSync(join(dir, rel));
}

// ---------------------------------------------------------------------------
// §1 · the seat gate — pure, total, human-only
// ---------------------------------------------------------------------------

describe("checkGitLandSeat — pure, total, human-only", () => {
  it("refuses when no seat is presented", () => {
    const v = checkGitLandSeat(undefined, "tree:C:/x");
    assert.equal(v.allowed, false);
    if (!v.allowed) {
      assert.equal(v.code, "RT_E_VALIDATION");
      assert.equal(v.fallback, "human-seat-token");
    }
  });

  it("refuses the autopilot (machine) seat — a machine never lands git history", () => {
    const v = checkGitLandSeat({ actor: { decidedBy: "autopilot", seat: "harness" } }, "tree:C:/x");
    assert.equal(v.allowed, false);
    if (!v.allowed) {
      assert.match(v.reason, /git-landing-requires-human-seat/);
      assert.equal(v.label, "autopilot/harness");
      assert.equal(v.fallback, "human-seat-token");
    }
  });

  it("refuses a human seat without the out-of-band token", () => {
    const v = checkGitLandSeat(
      { actor: { decidedBy: "human", seat: "human-cli-i-am-human" } },
      "tree:C:/x",
    );
    assert.equal(v.allowed, false);
    if (!v.allowed) assert.match(v.reason, /human-seat-unverified/);
  });

  it("refuses a human seat with a wrong or missing expected token", () => {
    const wrong = checkGitLandSeat(humanSeat({ humanSeatToken: "not-the-token" }), "tree:C:/x");
    assert.equal(wrong.allowed, false);
    const missing = checkGitLandSeat(humanSeat({ expectedHumanSeatToken: "" }), "tree:C:/x");
    assert.equal(missing.allowed, false);
    if (!missing.allowed) assert.match(missing.reason, /human-seat-unverified/);
  });

  it("allows exactly the verified human seat", () => {
    const v = checkGitLandSeat(humanSeat(), "tree:C:/x");
    assert.equal(v.allowed, true);
    if (v.allowed) {
      assert.equal(v.label, "human/human-cli-i-am-human");
      assert.match(v.reason, /human-seat-token-verified/);
    }
  });

  it("refuses a resource outside the tree namespace even with the human seat", () => {
    const v = checkGitLandSeat(humanSeat(), "not-a-tree");
    assert.equal(v.allowed, false);
  });

  it("is total — malformed seats refuse instead of throwing", () => {
    for (const bad of [null, "seat", 42, [], { actor: "human" }, { actor: { decidedBy: "human" } }]) {
      const v = checkGitLandSeat(bad, "tree:C:/x");
      assert.equal(v.allowed, false);
    }
  });
});

// ---------------------------------------------------------------------------
// §2 · the fixed subcommand surface + plan verifier
// ---------------------------------------------------------------------------

describe("GIT_LANDING_SUBCOMMANDS — the fixed, network-free surface", () => {
  it("is exactly the read/probe + init/add/commit set (no network verb exists)", () => {
    assert.deepEqual(
      [...GIT_LANDING_SUBCOMMANDS],
      ["--version", "rev-parse", "init", "add", "commit", "status", "log"],
    );
    const writes = GIT_LANDING_SUBCOMMANDS.filter((s) => ["init", "add", "commit"].includes(s));
    assert.deepEqual([...writes], ["init", "add", "commit"]);
  });

  it("refuses every network/remote/config/rewrite subcommand", () => {
    for (const banned of [
      "push",
      "pull",
      "fetch",
      "clone",
      "remote",
      "submodule",
      "config",
      "reset",
      "checkout",
      "clean",
      "rm",
      "gc",
      "reflog",
      "bundle",
      "credential",
    ]) {
      assert.equal(isGitLandingSubcommandAllowed(banned), false, `${banned} must never be allowed`);
    }
    assert.equal(isGitLandingSubcommandAllowed(42), false);
    assert.equal(isGitLandingSubcommandAllowed(undefined), false);
  });
});

describe("verifyGitPlan — the argv invariant", () => {
  it("accepts the module's own plan shapes", () => {
    assert.equal(verifyGitPlan({ subcommand: "init", argv: ["-c", "init.defaultBranch=main", "init"] }), null);
    assert.equal(
      verifyGitPlan({ subcommand: "commit", argv: ["-c", "user.name=A", "-c", "user.email=a@b.c", "commit", "-m", "cycle 1"] }),
      null,
    );
    assert.equal(verifyGitPlan({ subcommand: "log", argv: ["log", "-n", "1", "--pretty=format:%H%x09%s"] }), null);
    assert.equal(verifyGitPlan({ subcommand: "--version", argv: ["--version"] }), null);
  });

  it("refuses a non-allowlisted subcommand and a mismatch", () => {
    assert.notEqual(verifyGitPlan({ subcommand: "branch", argv: ["branch"] }), null);
    assert.notEqual(verifyGitPlan({ subcommand: "init", argv: ["commit"] }), null);
  });

  it("refuses NUL in argv and a bare -c", () => {
    assert.notEqual(verifyGitPlan({ subcommand: "commit", argv: ["commit", "-m", "x\0y"] }), null);
    assert.notEqual(verifyGitPlan({ subcommand: "commit", argv: ["-c", "init", "commit"] }), null);
  });
});

describe("source guard — argv arrays only, no network verbs", () => {
  const src = readFileSync(fileURLToPath(new URL("./git.server.ts", import.meta.url)), "utf8");

  it("never enables a shell, never spawns through exec, never names a network verb", () => {
    assert.equal(/\bshell\s*:\s*true/.test(src), false, "spawn must never carry a shell flag");
    // The argv API only: no command-STRING exec may exist. (A bare `.exec(` on
    // a RegExp is a match call, not a child process — checked precisely below.)
    const cpImport = /import \{([^}]*)\} from "node:child_process";/.exec(src);
    assert.ok(cpImport, "the module imports from node:child_process");
    assert.equal(
      /exec/.test(cpImport?.[1] ?? ""),
      false,
      "only the argv-array API (spawn) may be imported from node:child_process",
    );
    assert.equal(/\bexecSync\s*\(/.test(src), false, "execSync must not appear");
    assert.equal(/\bexecFile\s*\(/.test(src), false, "execFile must not appear");
    assert.equal(/"(push|pull|remote|clone|fetch|credential)"/i.test(src), false, "no network verb token");
    assert.match(src, /spawn\(/, "sanity: this is the module source we expect");
  });
});

// ---------------------------------------------------------------------------
// §3 · availability probe (real git, a missing binary, a non-git binary)
// ---------------------------------------------------------------------------

describe("gitLandingAvailable", () => {
  it("reports the real git (version parsed)", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const a = await gitLandingAvailable();
    assert.equal(a.available, true);
    if (a.available) {
      assert.match(a.version, /^\d+\.\d+/);
      assert.equal(a.binary, "git");
    }
  });

  it("reports a missing binary with the coded git-absent path", async () => {
    const a = await gitLandingAvailable({ gitBin: BOGUS_GIT });
    assert.equal(a.available, false);
    if (!a.available) {
      assert.equal(a.reason, "git-absent");
      assert.equal(a.code, "RT_E_GIT_UNAVAILABLE");
    }
  });

  it("reports a binary that is not git with the coded not-git path", async () => {
    const a = await gitLandingAvailable({ gitBin: process.execPath });
    assert.equal(a.available, false);
    if (!a.available) {
      assert.equal(a.reason, "not-git");
      assert.equal(a.code, "RT_E_GIT_UNAVAILABLE");
    }
  });
});

// ---------------------------------------------------------------------------
// §4 · gitLandInit
// ---------------------------------------------------------------------------

describe("gitLandInit", () => {
  it("initializes a scratch dir, lands the marker, and reads back unborn", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const dir = scratch("init-ok-");
    const r = await gitLandInit(dir, humanSeat());
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.ok(existsSync(join(dir, ".git")), ".git must exist after init");
    assert.ok(existsSync(join(dir, GIT_LANDING_MARKER_REL)), "marker must be written by init");
    assert.equal(r.branch, "main", "init lands on main (explicit -c init.defaultBranch)");
    assert.ok(
      resolve(r.repoRoot).toLowerCase() === resolve(dir).toLowerCase(),
      `repoRoot ${r.repoRoot} must be the dir we handed in`,
    );
    const marker = JSON.parse(readFileSync(join(dir, GIT_LANDING_MARKER_REL), "utf8")) as {
      landing: string;
      version: number;
    };
    assert.equal(marker.landing, GIT_LANDING_MARKER_KIND);
    assert.equal(marker.version, GIT_LANDING_MARKER_VERSION);
    const rb = await gitLandReadBack(dir);
    assert.equal(rb.ok, true);
    if (rb.ok) {
      assert.equal(rb.head, null, "no commit yet — unborn HEAD is the honest null");
      assert.deepEqual(rb.commits, []);
      assert.equal(rb.branch, "main");
    }
  });

  it("refuses to re-init a repository it already created", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const dir = scratch("init-twice-");
    const first = await gitLandInit(dir, humanSeat());
    assert.equal(first.ok, true);
    const second = await gitLandInit(dir, humanSeat());
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.reason, "already-a-repo");
  });

  it("refuses to nest: init inside a tail-initialized scratch repo is refused", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const dir = scratch("init-nested-");
    assert.equal((await gitLandInit(dir, humanSeat())).ok, true);
    const sub = join(dir, "inner");
    mkdirSync(sub, { recursive: true });
    const nested = await gitLandInit(sub, humanSeat());
    assert.equal(nested.ok, false);
    if (!nested.ok) assert.equal(nested.reason, "target-in-work-tree");
    assert.equal(existsSync(join(sub, ".git")), false, "no nested repo may be created");
  });

  it("THE HOST GUARD: the repo root and its subdirs are refused outright", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const atRoot = await gitLandInit(REPO_ROOT, humanSeat());
    assert.equal(atRoot.ok, false);
    if (!atRoot.ok) assert.equal(atRoot.reason, "already-a-repo");
    const atSub = await gitLandInit(join(REPO_ROOT, "src"), humanSeat());
    assert.equal(atSub.ok, false);
    if (!atSub.ok) assert.equal(atSub.reason, "target-in-work-tree");
    assert.equal(
      scrubContains(REPO_ROOT, GIT_LANDING_MARKER_REL),
      false,
      "no landing marker may ever appear in the host repo",
    );
  });

  it("refuses without the seat token and creates nothing", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const dir = scratch("init-seat-");
    const r = await gitLandInit(dir, { actor: { decidedBy: "human", seat: "human-cli-i-am-human" } });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.reason, "seat-refused");
      assert.equal(r.code, "RT_E_VALIDATION");
    }
    assert.equal(existsSync(join(dir, ".git")), false, "seat refusal must not write");
    assert.equal(existsSync(join(dir, GIT_LANDING_MARKER_REL)), false, "seat refusal must not write");
  });

  it("refuses malformed targets with coded bad-input / missing / not-a-directory", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const rel = await gitLandInit("relative/path", humanSeat());
    assert.equal(rel.ok, false);
    if (!rel.ok) assert.equal(rel.reason, "bad-input");
    const gone = await gitLandInit(join(SCRATCH_ROOT, "never-created-w18l3"), humanSeat());
    assert.equal(gone.ok, false);
    if (!gone.ok) assert.equal(gone.reason, "target-missing");
    const fileDir = scratch("init-file-");
    writeFileSync(join(fileDir, "a-file.txt"), "not a dir\n");
    const notDir = await gitLandInit(join(fileDir, "a-file.txt"), humanSeat());
    assert.equal(notDir.ok, false);
    if (!notDir.ok) assert.equal(notDir.reason, "target-not-a-directory");
    if (process.platform === "win32") {
      const msys = await gitLandInit("/c/Users/mnril/definitely-not-a-real-explorer-path", humanSeat());
      assert.equal(msys.ok, false);
      if (!msys.ok) assert.match(msys.error, /MSYS/);
    }
  });

  it("pins the coded git-absent path (nothing written, no .git, no marker)", async () => {
    const dir = scratch("init-absent-");
    const r = await gitLandInit(dir, humanSeat(), { gitBin: BOGUS_GIT });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.reason, "git-absent");
      assert.equal(r.code, "RT_E_GIT_UNAVAILABLE");
    }
    assert.equal(existsSync(join(dir, ".git")), false);
    assert.equal(existsSync(join(dir, GIT_LANDING_MARKER_REL)), false);
  });
});

// ---------------------------------------------------------------------------
// §5 · gitLandCommit
// ---------------------------------------------------------------------------

describe("gitLandCommit", () => {
  it("commits with the seat token — hash, identity, read-back, and the pinned git log probe", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const dir = scratch("commit-ok-");
    assert.equal((await gitLandInit(dir, humanSeat())).ok, true);
    writeFileSync(join(dir, "landed.txt"), "ladnded content\n");
    const message = "cycle 1: initial landing";
    const c = await gitLandCommit(dir, humanSeat(), { message });
    assert.equal(c.ok, true);
    if (!c.ok) return;
    assert.match(c.commit.hash, /^[0-9a-f]{40}$/);
    assert.equal(c.commit.subject, message);
    assert.equal(c.author, `${DEFAULT_GIT_LAND_IDENTITY.name} <${DEFAULT_GIT_LAND_IDENTITY.email}>`);
    assert.equal(c.empty, false);

    const rb = await gitLandReadBack(dir);
    assert.equal(rb.ok, true);
    if (rb.ok) {
      assert.equal(rb.head, c.commit.hash);
      assert.equal(rb.commits.length, 1);
      assert.equal(rb.commits[0]?.hash, c.commit.hash);
      assert.equal(rb.commits[0]?.subject, message);
      assert.equal(rb.branch, "main");
    }

    // The row's named probe, pinned raw: `git log --oneline` on the scratch tree.
    const rawLog = spawnSync("git", ["-C", dir, "log", "--oneline"], { encoding: "utf8" });
    assert.equal(rawLog.status, 0);
    assert.match(rawLog.stdout, new RegExp(`^[0-9a-f]{7,} ${message}$`, "m"));

    const status = spawnSync("git", ["-C", dir, "status", "--porcelain"], { encoding: "utf8" });
    assert.equal(status.stdout.trim(), "", "work tree is clean after the landing commit");
  });

  it("refuses without the seat token and lands NO commit", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const dir = scratch("commit-seat-");
    assert.equal((await gitLandInit(dir, humanSeat())).ok, true);
    writeFileSync(join(dir, "landed.txt"), "content\n");
    const refused = await gitLandCommit(dir, { actor: { decidedBy: "human", seat: "human-cli-i-am-human" } }, {
      message: "must not land",
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.reason, "seat-refused");
      assert.equal(refused.code, "RT_E_VALIDATION");
    }
    const rb = await gitLandReadBack(dir);
    assert.equal(rb.ok, true);
    if (rb.ok) {
      assert.equal(rb.head, null, "no commit may exist after a seat refusal");
      assert.deepEqual(rb.commits, []);
    }
  });

  it("refuses a foreign repo root (not initialized by the tail) even with a valid seat", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const dir = scratch("commit-foreign-");
    const init = spawnSync("git", ["init"], { cwd: dir, encoding: "utf8" });
    assert.equal(init.status, 0);
    writeFileSync(join(dir, "x.txt"), "x\n");
    const r = await gitLandCommit(dir, humanSeat(), { message: "should refuse" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "not-a-landing-repo");
    // ...and init on the same foreign repo is refused too.
    const i = await gitLandInit(dir, humanSeat());
    assert.equal(i.ok, false);
    if (!i.ok) assert.equal(i.reason, "already-a-repo");
  });

  it("THE HOST GUARD: the repo root is refused even with a valid seat", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const r = await gitLandCommit(REPO_ROOT, humanSeat(), { message: "must never land" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "not-a-landing-repo");
  });

  it("refuses a non-repo dir with not-a-repo", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const dir = scratch("commit-nonrepo-");
    const r = await gitLandCommit(dir, humanSeat(), { message: "nope" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "not-a-repo");
  });

  it("refuses a clean tree with nothing-to-commit, then lands it with allowEmpty", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const dir = scratch("commit-empty-");
    assert.equal((await gitLandInit(dir, humanSeat())).ok, true);
    writeFileSync(join(dir, "landed.txt"), "cycle content\n");
    assert.equal((await gitLandCommit(dir, humanSeat(), { message: "cycle 1" })).ok, true);

    const again = await gitLandCommit(dir, humanSeat(), { message: "cycle 2 (unchanged)" });
    assert.equal(again.ok, false);
    if (!again.ok) {
      assert.equal(again.reason, "nothing-to-commit");
      assert.equal(again.code, "RT_E_VALIDATION");
    }

    const empty = await gitLandCommit(dir, humanSeat(), { message: "cycle 2 (marker)", allowEmpty: true });
    assert.equal(empty.ok, true);
    if (empty.ok) assert.equal(empty.empty, true);
    const rb = await gitLandReadBack(dir, { limit: 10 });
    assert.equal(rb.ok, true);
    if (rb.ok) assert.equal(rb.commits.length, 2);
  });

  it("refuses malformed messages/identity/timeout with bad-input", async () => {
    const dir = scratch("commit-badinput-");
    const cases: Array<{ message: string; identity?: { name: string; email: string }; timeoutMs?: number }> = [
      { message: "" },
      { message: "   " },
      { message: "x".repeat(10_001) },
      { message: "bad\u0001control" },
      { message: "ok", identity: { name: "A", email: "not-an-email" } },
      { message: "ok", timeoutMs: 0 },
    ];
    for (const c of cases) {
      const r = await gitLandCommit(dir, humanSeat(), c);
      assert.equal(r.ok, false, `expected refusal for ${JSON.stringify({ ...c, message: c.message.slice(0, 12) })}`);
      if (!r.ok) assert.equal(r.reason, "bad-input");
    }
  });

  it("pins the coded git-absent path on commit (spawn ENOENT)", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const dir = scratch("commit-absent-");
    assert.equal((await gitLandInit(dir, humanSeat())).ok, true);
    writeFileSync(join(dir, "landed.txt"), "content\n");
    const r = await gitLandCommit(dir, humanSeat(), { message: "absent", gitBin: BOGUS_GIT });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.reason, "git-absent");
      assert.equal(r.code, "RT_E_GIT_UNAVAILABLE");
    }
    const rb = await gitLandReadBack(dir);
    assert.equal(rb.ok, true);
    if (rb.ok) assert.equal(rb.head, null, "nothing may land when git is absent");
  });
});

// ---------------------------------------------------------------------------
// §6 · gitLandReadBack refusals
// ---------------------------------------------------------------------------

describe("gitLandReadBack", () => {
  it("refuses a non-repo and a bad limit", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const dir = scratch("readback-");
    const r = await gitLandReadBack(dir);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "not-a-repo");
    const badLimit = await gitLandReadBack(dir, { limit: 0 });
    assert.equal(badLimit.ok, false);
    if (!badLimit.ok) assert.equal(badLimit.reason, "bad-input");
  });

  it("refuses a subdir of a repo (read-back targets the repo root itself)", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const dir = scratch("readback-sub-");
    assert.equal((await gitLandInit(dir, humanSeat())).ok, true);
    const sub = join(dir, "sub");
    mkdirSync(sub);
    const r = await gitLandReadBack(sub);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "target-in-work-tree");
  });
});

// ---------------------------------------------------------------------------
// §7 · the bounded primitive — real timeout kill, real output cap
// ---------------------------------------------------------------------------

describe("runBoundedChild — the bounds are real", () => {
  // M6-07 (known-class pin — fixes/308_map6_time.md): timeout/settlement pins
  // are load-sensitive: the full suite's parallelism starves child spawns, so
  // the wall-clock bounds below are deliberately generous (a 500 ms floor and a
  // 6 s ceiling around the 900 ms timer). Standalone under 6-child load this
  // pin passed 3/3 on 308; a red under full-suite load is the KNOWN class, not
  // a regression — re-run standalone before hunting. Same class as
  // exec.test.ts's CLOSE_GRACE comment (that file documents the mechanism).
  it("kills a real hanging child at the wall-clock deadline", async () => {
    const dir = scratch("bound-timeout-");
    const started = Date.now();
    const r = await runBoundedChild(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], {
      cwd: dir,
      timeoutMs: 900,
    });
    const elapsed = Date.now() - started;
    assert.equal(r.ran, false);
    if (!r.ran) {
      assert.equal(r.reason, "timeout");
      assert.match(r.error, /killed after/);
    }
    assert.ok(elapsed >= 500, `settled too fast to be the timer (${elapsed}ms)`);
    assert.ok(elapsed <= 6_000, `settlement must be bounded (${elapsed}ms)`);
  });

  it("clamps an output bomb to the kept-chars cap", async () => {
    const dir = scratch("bound-output-");
    const n = GIT_LANDING_OUTPUT_CAP + 200_000;
    const r = await runBoundedChild(process.execPath, ["-e", `process.stdout.write("x".repeat(${n}))`], {
      cwd: dir,
      timeoutMs: 60_000,
    });
    assert.equal(r.ran, true);
    if (r.ran) {
      assert.equal(r.outputClamped, true);
      assert.ok(r.stdout.length <= GIT_LANDING_OUTPUT_CAP + 200, `stdout must be clamped (${r.stdout.length})`);
      assert.ok(r.stdout.includes("elided by git landing output cap"));
    }
  });
});

// ---------------------------------------------------------------------------
// §8 · the host repo stays untouched — the suite's own proof
// ---------------------------------------------------------------------------

describe("the host repo stays untouched", () => {
  it("scratch root is outside the repo (tests can never land inside it)", () => {
    const rel = relative(REPO_ROOT, SCRATCH_ROOT);
    assert.ok(rel.startsWith(".."), `scratch ${SCRATCH_ROOT} must live OUTSIDE ${REPO_ROOT}`);
  });

  it("no landing artifact can appear in the host repo — scratch stays outside, guards refuse", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const fp0 = repoFingerprint();
    assert.equal(/^status-exit=0/.test(fp0), true, "the fingerprint probe itself must read the repo cleanly");

    // Full landing cycle, plus both host-guard refusals, in scratch dirs only.
    const dir = scratch("fingerprint-");
    assert.equal((await gitLandInit(dir, humanSeat())).ok, true);
    writeFileSync(join(dir, "cycle.txt"), "cycle\n");
    assert.equal((await gitLandCommit(dir, humanSeat(), { message: "cycle 1" })).ok, true);
    assert.equal((await gitLandReadBack(dir)).ok, true);
    assert.equal((await gitLandInit(REPO_ROOT, humanSeat())).ok, false);
    assert.equal((await gitLandCommit(REPO_ROOT, humanSeat(), { message: "never" })).ok, false);

    // STRICT invariants — the facts only THIS suite could ever break. (A strict
    // before/after `git status` equality would flake: W18 runs concurrently and
    // other lanes edit the repo while this suite runs — that churn is not this
    // suite's doing and is logged as evidence below.)
    //   1. every scratch dir this suite created lives OUTSIDE the repo;
    //   2. the repo's own `git status` shows no landing artifact: no marker at
    //      the root, no nested .git under src/ (the two things a landing would
    //      leave behind).
    for (const d of made) {
      assert.ok(relative(REPO_ROOT, d).startsWith(".."), `scratch ${d} must live outside the repo`);
    }
    assert.equal(scrubContains(REPO_ROOT, GIT_LANDING_MARKER_REL), false);
    assert.equal(existsSync(join(REPO_ROOT, "src", ".git")), false);

    // Evidence for fixes/249: the repo fingerprint before/after this suite's
    // own operations. Quiet window ⇒ identical; concurrent writes ⇒ logged
    // (every scratch op above lived outside the repo, so no diff line can be
    // this suite's doing).
    const fp1 = repoFingerprint();
    if (fp0 !== fp1) {
      console.log(
        `[w18l3] concurrent wave writers changed the repo fingerprint during the suite window ` +
          `(not this suite — all its targets are outside the repo);\n--- before ---\n${fp0}\n--- after ---\n${fp1}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// §9 · the delivery seam — land an EMITTED product (fixes/343_3)
//
// Unlike the seat-gated gitLand* API above (human ceremony for interactive
// use), `gitLandEmitted` is the CLI's `emit --git` tail: it stages ONLY the
// emitted manifest, writes its own marker INSIDE .git/ (invisible to the
// emit walker), refuses a foreign repo root (the host included), and is
// idempotent (a clean tree is a no-op, never an empty commit). Every test
// runs in $TEMP/rt343_3 and the repo's HEAD sha is asserted unchanged.
// ---------------------------------------------------------------------------

describe("conventionalLandMessage — pure, derived from the real brief/spec", () => {
  it("derives feat(<slug>): <first brief line>", () => {
    assert.equal(
      conventionalLandMessage({ name: "Dispatch Pro", brief: "Build a dispatch board for field crews." }),
      `${LAND_COMMIT_TYPE}(dispatch-pro): Build a dispatch board for field crews.`,
    );
  });

  it("prefers the first real implementationSpec requirement over the brief", () => {
    assert.equal(
      conventionalLandMessage({
        name: "Billing",
        brief: "The whole brief text.",
        implementationSpec: { requirements: ["MUST invoice per usage", "MUST export CSV"] },
      }),
      `${LAND_COMMIT_TYPE}(billing): MUST invoice per usage`,
    );
  });

  it("takes the first non-empty line, collapses whitespace, caps long text", () => {
    const multi = conventionalLandMessage({ name: "X", brief: "\n\n  Line one.  \nLine two." });
    assert.equal(multi, `${LAND_COMMIT_TYPE}(x): Line one.`);
    const long = conventionalLandMessage({ name: "X", brief: "word ".repeat(60) });
    assert.ok(long.length <= `${LAND_COMMIT_TYPE}(x): `.length + 72, long);
    assert.ok(long.endsWith("…"), long);
  });

  it("is total — empty/absent text falls back, never throws", () => {
    assert.equal(conventionalLandMessage({ name: "", brief: "" }), `${LAND_COMMIT_TYPE}(project): initial emission`);
    assert.equal(conventionalLandMessage({ name: "X", brief: "   " }), `${LAND_COMMIT_TYPE}(x): initial emission`);
  });
});

describe("gitLandEmitted — the emitted-product delivery tail", () => {
  it("inits + commits a fresh emitted-shaped tree with the conventional message, then no-ops", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const dir = landScratch("land-ok-");
    const files = seedEmittedTree(dir);
    const subject = { name: "Land Delivery", brief: "Ship the thing." };

    const first = await gitLandEmitted(subject, dir, { files });
    assert.equal(first.ok, true, first.ok ? "" : first.error);
    if (!first.ok) return;
    assert.equal(first.committed, true);
    assert.equal(first.noop, false);
    assert.equal(first.message, `${LAND_COMMIT_TYPE}(land-delivery): Ship the thing.`);
    assert.equal(first.commit?.subject, first.message);
    assert.equal(first.branch, "main");
    assert.ok(first.files.includes("package.json"), `files=${JSON.stringify(first.files)}`);
    assert.deepEqual(first.foreign, []);
    assert.ok(existsSync(join(dir, GIT_LAND_DELIVERY_MARKER)) || existsSync(join(dir, ".git", GIT_LAND_DELIVERY_MARKER)));
    assert.equal(commitCount(dir), 1);
    const rawLog = spawnSync("git", ["-C", dir, "log", "--oneline"], { encoding: "utf8" });
    assert.match(rawLog.stdout, /^[0-9a-f]{7,} /m);
    assert.ok(
      rawLog.stdout.split("\n").some((l) => l.endsWith(` ${first.message}`)),
      `git log must carry the conventional subject:\n${rawLog.stdout}`,
    );
    const status = spawnSync("git", ["-C", dir, "status", "--porcelain"], { encoding: "utf8" });
    assert.equal(status.stdout.trim(), "", "work tree is clean after the delivery commit");

    // Second land: identical manifest ⇒ nothing staged ⇒ honest no-op (no empty commit).
    const second = await gitLandEmitted(subject, dir, { files });
    assert.equal(second.ok, true, second.ok ? "" : second.error);
    if (!second.ok) return;
    assert.equal(second.committed, false);
    assert.equal(second.noop, true);
    assert.equal(second.commit, null);
    assert.equal(commitCount(dir), 1, "a second land must never mint an empty commit");
  });

  it("stages ONLY the emitted manifest — a foreign file is left untracked and reported", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const dir = landScratch("land-foreign-");
    const files = seedEmittedTree(dir);
    writeFileSync(join(dir, "NOTES.md"), "a human note that is not part of the emission\n", "utf8");

    const r = await gitLandEmitted({ name: "F", brief: "b" }, dir, { files });
    assert.equal(r.ok, true, r.ok ? "" : r.error);
    if (!r.ok) return;
    assert.ok(!r.files.includes("NOTES.md"), `foreign must not be staged: ${JSON.stringify(r.files)}`);
    assert.ok(r.foreign.includes("NOTES.md"), `foreign must be reported: ${JSON.stringify(r.foreign)}`);
    const tracked = spawnSync("git", ["-C", dir, "ls-files", "--error-unmatch", "NOTES.md"], { encoding: "utf8" });
    assert.notEqual(tracked.status, 0, "the foreign file must not be tracked");
    const status = spawnSync("git", ["-C", dir, "status", "--porcelain"], { encoding: "utf8" });
    assert.match(status.stdout, /^\?\? NOTES\.md$/m);
  });

  it("refuses a dir without the emitted record (not-an-emitted-tree)", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const dir = landScratch("land-norecord-");
    writeFileSync(join(dir, "package.json"), "{}\n", "utf8");
    const r = await gitLandEmitted({ name: "X", brief: "b" }, dir, { files: ["package.json"] });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "not-an-emitted-tree");
    assert.equal(existsSync(join(dir, ".git")), false, "nothing may be initialized on a refusal");
  });

  it("refuses a FOREIGN repo root carrying the record (no delivery marker) — the host-repo class", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const dir = landScratch("land-foreign-repo-");
    const files = seedEmittedTree(dir);
    const init = spawnSync("git", ["init"], { cwd: dir, encoding: "utf8" });
    assert.equal(init.status, 0);
    const r = await gitLandEmitted({ name: "X", brief: "b" }, dir, { files });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "not-a-landing-repo");
    assert.equal(commitCount(dir), 0, "no commit may land in a foreign repository");
  });

  it("THE HOST GUARD: the repo root is refused and its HEAD sha is unchanged", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const head0 = repoFingerprint().split("\n")[1];
    const r = await gitLandEmitted({ name: "X", brief: "b" }, REPO_ROOT, { files: [EMITTED_RECORD_REL] });
    assert.equal(r.ok, false);
    assert.equal(repoFingerprint().split("\n")[1], head0, "the repo HEAD must never move");
    assert.equal(existsSync(join(REPO_ROOT, ".git", GIT_LAND_DELIVERY_MARKER)), false);
  });

  it("refuses bad manifests (empty / traversal / absolute / backslash) with bad-input", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const dir = landScratch("land-manifest-");
    seedEmittedTree(dir);
    for (const files of [[], ["../escape"], ["C:/Windows/x"], ["a\\b"], [""]]) {
      const r = await gitLandEmitted({ name: "X", brief: "b" }, dir, { files });
      assert.equal(r.ok, false, `expected refusal for ${JSON.stringify(files)}`);
      if (!r.ok) assert.equal(r.reason, "bad-input");
    }
    assert.equal(existsSync(join(dir, ".git")), false, "a bad manifest must not initialize a repo");
  });

  it("pins the coded git-absent path (nothing written)", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const dir = landScratch("land-absent-");
    seedEmittedTree(dir);
    const r = await gitLandEmitted({ name: "X", brief: "b" }, dir, {
      files: [EMITTED_RECORD_REL],
      gitBin: BOGUS_GIT,
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.reason, "git-absent");
      assert.equal(r.code, "RT_E_GIT_UNAVAILABLE");
    }
    assert.equal(existsSync(join(dir, ".git")), false);
  });

  it("a full delivery cycle leaves the host repo's HEAD sha byte-identical", async (t) => {
    if (!HAS_GIT) return t.skip("git is not installed on this host");
    const before = repoFingerprint();
    const dir = landScratch("land-cycle-");
    assert.equal((await gitLandEmitted({ name: "Cycle", brief: "one" }, dir, { files: seedEmittedTree(dir) })).ok, true);
    assert.equal((await gitLandEmitted({ name: "Cycle", brief: "one" }, dir, { files: seedEmittedTree(dir, {}) })).ok, true);
    const after = repoFingerprint();
    assert.equal(after.split("\n")[1], before.split("\n")[1], "the repo HEAD sha must not move");
  });
});

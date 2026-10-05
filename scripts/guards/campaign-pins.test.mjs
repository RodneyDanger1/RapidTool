// ---------------------------------------------------------------------------
// campaign-pins.test.mjs — P-B/Q2 pins for the CLI-level campaign #1 residuals
// (PR-28): C1-09 plain `--brief <path>` and C1-10 cross-process campaign
// ledger. Both interfaces LANDED (lane B) while this lane was open, so both
// pins are green and each carries a negative control proving it can fail.
//
// These drive the REAL CLI keylessly (the `create` verb writes the project
// envelope without a model call). Nothing here mocks the object under test; the
// only injected state is the operator's ledger file / env, which is the seam
// under test.
//
// Run: node --test --test-reporter=tap scripts/guards/campaign-pins.test.mjs
// ---------------------------------------------------------------------------
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "scripts", "rapidtool-cli.mjs");
const BRIEF = join(ROOT, "scripts", "prevention", "cassettes", "campaign1", "office-scheduler", "brief.md");

function read(p) {
  return readFileSync(p, "utf8");
}

function runCli(args, extraEnv = {}, cwd = ROOT) {
  /** @type {NodeJS.ProcessEnv} */
  const env = { ...process.env, ...extraEnv };
  // Keyless: `create` needs no model call, and the ambient key must not shadow
  // the deterministic path.
  delete env.DEEPSEEK_API_KEY;
  delete env.NODE_TEST_CONTEXT;
  const res = spawnSync(process.execPath, ["--experimental-strip-types", CLI, ...args], { cwd, env, encoding: "utf8", timeout: 120_000 });
  if (res.error) throw res.error;
  let json = null;
  try {
    json = JSON.parse((res.stdout ?? "").trim());
  } catch {
    /* surfaced by the caller */
  }
  return { status: res.status, json, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

test("C1-09 plain --brief <path>: the real CLI reads an existing path (no RT_E_VALIDATION refusal)", () => {
  assert.ok(existsSync(BRIEF), `the real campaign brief must exist: ${BRIEF}`);
  const out = mkdtempSync(join(tmpdir(), "rt-c1-09-"));
  /** @type {{status:number|null,json:any,stdout:string,stderr:string}} */
  let res;
  try {
    // The historical defect (campaign #1 §1): the plain form was refused with
    // `create: --brief "<path>" names an existing file ...` (RT_E_VALIDATION).
    res = runCli(["create", "--brief", BRIEF, "--out", join(out, "p.json")]);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
  assert.ok(res.json, `create did not print a JSON envelope (exit ${res.status}).\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  assert.equal(
    res.json.ok,
    true,
    "C1-09 regressed: plain `create --brief <path>` must read the file, not refuse it; " +
      `got code=${res.json.code} error=${res.json.error}`,
  );
  assert.equal(res.json.code, undefined, "the plain-path form must not carry a refusal code");
  assert.doesNotMatch(res.stdout, /names an existing file/, "the historical filename-as-prose refusal must be gone");
  // Negative control: the guard's predicate rejects exactly the historical refusal text.
  const historicalRefusal = 'create: --brief "brief.md" names an existing file — a file path is never silently used as the brief prose';
  const refused = (msg) => /names an existing file/.test(msg);
  assert.equal(refused(historicalRefusal), true, "the predicate catches the historical refusal");
  assert.equal(refused(res.json.error ? String(res.json.error) : ""), false, "the live envelope is not the refusal (control)");
});

test("C1-10 campaign ledger (KD-8): the cross-process ledger refuses once the bound is reached", () => {
  const src = read(join(ROOT, "src", "lib", "token-ledger.ts")) + "\n" + read(CLI);
  const seam = (s) => /RAPIDTOOL_LEDGER_FILE/.test(s) && /RAPIDTOOL_CAMPAIGN_TOKEN_CAP/.test(s) && /"--token-ledger"|"token-ledger"/.test(s);
  assert.equal(seam(src), true, "C1-10 regressed: the CLI must name the cross-process ledger (--token-ledger / RAPIDTOOL_LEDGER_FILE) and its cap (RAPIDTOOL_CAMPAIGN_TOKEN_CAP)");
  // Mutation control: dropping the env seam stops the predicate matching.
  assert.equal(seam(src.replace(/RAPIDTOOL_LEDGER_FILE/g, "__ABSENT__")), false, "removing the ledger env seam stops the check (control)");

  assert.ok(existsSync(BRIEF), `the real campaign brief must exist: ${BRIEF}`);
  const dir = mkdtempSync(join(tmpdir(), "rt-c1-10-"));
  try {
    // A ledger already at/over bound: the preflight refuses BEFORE dispatch.
    const ledger = join(dir, "ledger.json");
    writeFileSync(ledger, JSON.stringify({ schema_version: 1, cap: 5, spent: 9, calls: 3, entries: [] }));
    const over = runCli(["create", "--brief", BRIEF, "--out", join(dir, "over.json")], {
      RAPIDTOOL_LEDGER_FILE: ledger,
      RAPIDTOOL_CAMPAIGN_TOKEN_CAP: "5",
    });
    assert.ok(over.json, `over-bound create printed no envelope (exit ${over.status}).\n${over.stdout}\n${over.stderr}`);
    assert.equal(over.json.ok, false, "an over-bound campaign invocation must refuse");
    assert.equal(over.json.code, "RT_E_BUDGET_EXHAUSTED", "the refusal carries the campaign-bound code");
    assert.equal(over.json.campaignLedger.spent, 9, "the envelope surfaces the cross-process spend");
    assert.equal(existsSync(join(dir, "over.json")), false, "the preflight refuses before the verb writes anything");

    // Negative control: a fresh ledger well under bound proceeds.
    const under = runCli(["create", "--brief", BRIEF, "--out", join(dir, "under.json")], {
      RAPIDTOOL_LEDGER_FILE: join(dir, "fresh.json"),
      RAPIDTOOL_CAMPAIGN_TOKEN_CAP: "1000000",
    });
    assert.equal(under.json && under.json.ok, true, "an under-bound campaign invocation proceeds (control)");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

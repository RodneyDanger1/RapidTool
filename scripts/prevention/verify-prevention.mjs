// ---------------------------------------------------------------------------
// scripts/prevention/verify-prevention.mjs — the SINGLE prevention command (P-A).
//
//   node scripts/prevention/verify-prevention.mjs --all --selftest
//
// The command reports TWO orthogonal signals (KD-7 / §4.6):
//   · fixtureIntegrity — does each detector FIRE on the historical defect bytes?
//   · fixPresence      — is the live fixer seam present AND wired (with a
//                        mutation control proving the check can fail)?
//
// The gate of record is:
//   ok ⟺ fixtureIntegrity.missed:[] ∧ fixPresence.pending:[] ∧ skipped:[]
//         ∧ count ≥ countFloor
// A `status:"pending"` registry entry fails; `skipped` is derived from real
// per-guard skip markers (never hardcoded). Keyless by default; `--keyed`/
// `--budget` are opt-in and never required for acceptance.
// ---------------------------------------------------------------------------

import { resolveRunRoot, loadCassettes, loadGuardRegistry, runAll, finalize, formatVerdict, parseArgs, CASSETTE_DIR, GUARD_REGISTRY_PATH } from "./replay-harness.mjs";

const EMPTY = (extra) => ({
  ok: false,
  guards: 0,
  count: 0,
  countFloor: 15,
  historical: 0,
  fixtureIntegrity: { fired: [], missed: [] },
  fixPresence: { enforced: [], pending: [] },
  fired: [],
  missed: [],
  pending: [],
  skipped: [],
  registry: "n/a",
  controlMissed: [],
  ...extra,
});

async function main() {
  // `--all` / `--selftest` are the documented invocation; the two-signal
  // evaluation always runs, so a bare invocation is equivalent and keyless.
  parseArgs(process.argv.slice(2));
  const runRoot = resolveRunRoot();
  if (!runRoot) {
    // A missing run root is a hard, named failure — never a silent skip.
    console.log(JSON.stringify(EMPTY({ missed: ["<run-root-missing>"], error: "testruns/ not found (set RAPIDTOOL_TESTRUNS)" })));
    process.exit(1);
    return;
  }
  const registry = loadGuardRegistry(GUARD_REGISTRY_PATH);
  const cassettes = loadCassettes(CASSETTE_DIR);
  const verdict = await runAll({ runRoot, cassettes, registry });
  const final = finalize(verdict);
  console.log(formatVerdict(final));
  process.exit(final.ok ? 0 : 1);
}

main().catch((e) => {
  console.log(JSON.stringify(EMPTY({ missed: ["<harness-error>"], error: String(e && e.message ? e.message : e) })));
  process.exit(2);
});

# fixes/309_a1_wildverb.md — A1 · wild-verb load guard FINISH (308 M3 carry)

**Role:** A1 wild-verb finisher — inherit the parent's in-flight task: verify + finish the
`wild` load guard in `scripts/rapidtool-cli.mjs` (the 4 wild-arm STACK(exit4) fuzz
suspects), add the behavioral pin, scrub scratch.
**Run:** 2026-09-29 · opened at HEAD `7055994` + ONE uncommitted parent patch (the guard,
below); HEAD advanced to `2d2c74a`/`4309f58` as siblings banked mid-lane — no A1 read was
invalidated (guard bytes unchanged since open).
**Box (sole writer):** `scripts/rapidtool-cli.mjs` · `scripts/cli-exit-taxonomy.test.mjs`
(the pin, explicitly mandated by the lane brief) · this log · the parent scratch sweep.
5 siblings live; their uncommitted files were never touched.

## §1 — The inherited patch (as-found on disk, unchanged by A1)

`git diff scripts/rapidtool-cli.mjs` = **21+/4−**, at `rapidtool-cli.mjs:3360-3380`: the
`wild` arm's non-`--start` path called `h.loadProject(path, { preserveWildRun: true })`
**RAW**; the patch wraps it in try/catch with the `makeLoader` (E-25, `:566-586`) classify
contract — read ENOENT → `RT_E_PROJECT_MISSING` (`errors.ts:236`), malformed/dir →
`RT_E_VALIDATION` fallback via `errCode`, both **exit 1**, never STACK/exit 4.

Diagnosis (from 308 M3): all 4 wild-arm `STACK(exit4)` suspects (ENOENT / EISDIR /
missing-id / +`--out`) landed on this one raw call while every makeLoader-guarded verb
stayed coded. **No further CLI change was needed** — the inherited guard was sufficient.

## §2 — Verification (evidence, in order)

- `node --check scripts/rapidtool-cli.mjs` → **exit 0** (`NODE_CHECK_OK`; run at open and
  re-run after the final state — both clean).
- **Fuzz re-run, FOREGROUND, full 195 cases** (`cd ~/rt308_m3 && timeout 540 node
  cli_fuzz.mjs`; run window ≈10:58 → `cli_fuzz.json` mtime 11:03:42):
  → **`TOTAL=195 · SUSPECT=0`** (was 4). Wild rows (all `refusal`):
  `noargs → RT_E_VALIDATION` · `proj-nowhere → RT_E_PROJECT_MISSING` ·
  `proj-emptydir → RT_E_VALIDATION` · `proj-wrongshape → RT_E_VALIDATION` ·
  `out-file → RT_E_PROJECT_MISSING`.
  - Forensics: the stale `cli_fuzz.json` (10:54:58, still showing the 4 STACKs) **predates
    the patch** (`rapidtool-cli.mjs` mtime 10:55:18) — not a post-patch result. The
    parent's correction note in `cli_fuzz.log` confirms the 10:30 `FUZZ_EXIT=1` attempt was
    a backgrounded no-tty death (zero cases executed), and that a foreground 195-case run
    was the wanted proof. Targeted pre-check before the sweep: `wild --project nope.json`
    → `{ok:false, code:"RT_E_PROJECT_MISSING", exit_code:1}`, stderr empty.
- **CLI legs, foreground** (repo cwd):
  - `node --test scripts/cli-exit-taxonomy.test.mjs` → **4/4** pre-pin, then **5/5**
    after the pin (§3).
  - `node --test scripts/rapidtool-cli-edit.test.mjs` → **10/10** (29.1 s).
  - `node --test scripts/rapidtool-cli-fixtures.test.mjs` → **4/4** (22.1 s).
  - `node --test scripts/gate-verdict.test.mjs` → **6/6** (5.7 s).
  - The new wild `errCode(err, "RT_E_VALIDATION")` site also satisfies the existing static
    leg: nearest following `}, 1)` = 1 = the documented class for that code.

- **Final-state re-verification** (post-log, same bytes): `node --check` on the pinned test
  file → OK; `node --test scripts/cli-exit-taxonomy.test.mjs` re-run fresh → **5/5**; direct
  probe re-run → `wild --project nope.json` coded `RT_E_PROJECT_MISSING`, exit 1.

## §3 — Behavioral pin (NEW · `scripts/cli-exit-taxonomy.test.mjs:246-297`)

**Leg 5** — the file's first behavioral leg (spawns the CLI as a child; the CLI is still
never *imported*): temp cwd + keyless/seatless env (same scrub set as the edit suite),
exact fuzz shape `wild --project <missing>.json`, asserts
**no stack in stderr** (`/(^|\n)\s+at\s/` — the fuzz's own STACK detector) · **exit 1** ·
one JSON envelope · `ok:false` · **`code:"RT_E_PROJECT_MISSING"`** · `exit_code === status`.
Header truth-up at `:20-23`: "Legs 1–4 are source-text only … Leg 5 (309/A1) is BEHAVIORAL
by design". Why behavioral: the static scan pins the exit *class* of the errCode site; only
a real process pins the fuzz shape end-to-end (guard present ⇒ coded refusal, never stack +
exit 4). Verified: `node --check` clean; leg run → **5/5**.

## §4 — Scrub

- **Removed** (regenerable run byproducts of the wild fuzz work — re-created by the harness
  on its next run): `~/rt308_m3/cli/` (fuzz inputs + create-scenario outputs),
  `~/rt308_m3/.rapidtool/` (transient ndjson), `/tmp/w1.out` / `/tmp/w1.err` (A1 probe).
- **Kept deliberately (evidence):** `~/rt308_m3/cli_fuzz.mjs` (harness) ·
  `cli_fuzz.json` (the `SUSPECT=0` artifact, 11:03:42) · `cli_fuzz.log` (the parent's
  correction note) · the M3-era probes (`t_import.mjs`, `t_capneg.mjs`, `hostile1.ts`,
  `probe1_full|rerun.log`, `e2e/`, `e2e_run.sh`, `ckpt_a/`) — another lane's evidence
  chain, not A1's to destroy. Whole-dir removal post-banking is one `rm -rf ~/rt308_m3`
  if the parent wants it.
- **Repo-side:** nothing to scrub — untracked/ignored sweep found no wave scratch
  (`err2.txt` is tracked + clean; root `_*.log` files predate the wave and are
  ignore-listed).

## §5 — Status

**ALL GREEN — READY TO COMMIT** (the parent banks). Banking set:
`scripts/rapidtool-cli.mjs` (guard) · `scripts/cli-exit-taxonomy.test.mjs` (pin + header
truth-up, +65/−3) · `fixes/309_a1_wildverb.md` (this log).
Read-back honesty: the tree also carries siblings' uncommitted work (README/START-HERE,
run-eval*, src/lib rows, UI rail) — untouched by A1; commit scoping is the parent's call.

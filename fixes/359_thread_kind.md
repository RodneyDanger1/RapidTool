# 359 · lane `thread-kind` — the kind must reach every consumer (CLI `--kind`, the planner context, the expansion prompt, and the dead P6 gate seam)

**Wave:** W359 (kind fidelity). **Lane:** `thread-kind` (persona `ledger`). **Repo:**
`C:\Users\mnril\Desktop\RapidTool Main`. **Host:** Node v24.15.0, Windows PowerShell 5.1.
**Plan:** `wave_plans/W359/thread-kind.md` + `wave_plans/W359/README.md`. **Source measurement:**
`research/multiagent/358_cartographer.md` §2f/§3.3. **Append-only; this lane is its only writer.**

**Owned files:** `scripts/rapidtool-cli.mjs` · `src/lib/headless.ts` (+ `scripts/README-cli.md` — the
`create` flags block). `scripts/run-eval.mjs` is **`resolve-kind`'s** file this wave (wave README §Lanes
amendment 1 and the lane brief): its mapper (hole 5) is owned elsewhere and was **not** touched here.

**Headline:** _pending — filled at the end._

---

## 1. JOB 1 · `scripts/rapidtool-cli.mjs` — the inert/refused `--kind` on `create`

### 1.1 The measured pre-state (reproduced before the edit)

The hole is **worse than "inert"**: the flag never reaches the arm. The per-verb flag scope is DERIVED
from the verb's own USAGE line (`rapidtool-cli.mjs:260-268 acceptedFlagsFor` → `refuseVerbFlag:277`), and
`create`'s line did not document `--kind`, so the pre-dispatch guard refused it as a foreign flag:

```
$ node --experimental-strip-types scripts/rapidtool-cli.mjs create --brief "…HVAC…" --name HVAC --kind game --out k.json
{"schema_version":1,"cmd":"create","ok":false,
 "error":"create: --kind is not a flag `create` accepts — it is documented for a different verb, so it would have been silently ignored.",
 "code":"RT_E_VALIDATION","exit_code":1}            # exit 1, nothing written
```

### 1.2 The change (old → new)

| site | old | new |
|---|---|---|
| `USAGE.commands.create` (`:6129`) | `create --brief <text\|file> [--name <text>] [--advisory] [--out <file.json>]` | `create --brief <text\|file> [--name <text>] [--kind app\|tool\|game\|library\|service] [--advisory] [--out <file.json>]` (+ the `#` clause: `--kind` stores an EXPLICIT kind, anything else is a usage refusal exit 1, omitting it stores NO kind and lets the resolver infer) |
| the `create` arm (`:1632`) | `h.createProject({ brief: briefSource.value, name: args.name })` | validates `args.kind` against `h.DELIVERY_KINDS` (coded refusal, exit 1) and forwards `...(kind === undefined ? {} : { kind })` |

Because the flag's accepted set IS the USAGE line, adding the flag to the arm without adding it to the
USAGE line would have kept `--kind` refused — the doc and the guard move together by construction, which
is the repo's own B1-F2 contract (`cli-exit-taxonomy.test.mjs:470`).

`h.DELIVERY_KINDS` is a **re-export** of `types.ts`'s `DELIVERY_KINDS` (`headless.ts`, appended to the
existing `./types.ts` edge), never a second list — the CLI validates against the ONE vocabulary the same
way it already reads `h.DIAGRAM_KINDS` (`cli:4370`). A `--kind` typo is a usage refusal, not a stored
nonsense kind; an ABSENT `--kind` stores **no kind at all**, so the ONE resolver decides.

### 1.3 The proof (keyless, `%TEMP%\rt359_probe`)

```
$ create --brief "Build a field-service dispatch board for HVAC technicians." --name HVAC --kind game --out explicit.json
exit 0 · explicit.json.kind === "game"            # an explicit --kind WINS and is stored verbatim
$ create --brief "Build a playable arcade breakout game with paddle, ball and bricks." --name Breakout --out inferred.json
exit 0 · explicit.json has key "kind"? → false     # ABSENT stores nothing: never a silent `app`
```

The doc-parity legs are green: `README-cli.test.mjs` **9/9** and `cli-exit-taxonomy.test.mjs` **62/62**
(§5). `scripts/README-cli.md:131-143` — the `create` block — gained the flag and its absent-behaviour
clause.

**Residual (documented, not hidden):** `create` itself does NOT stamp the resolved kind onto the record.
Doing so would need `emptyProject`/`engine.ts` (lane `resolve-kind`'s file this wave) and would make the
create path disagree with the engine's own stamping policy; the absent-kind record is instead resolved at
every consumer (jobs 2-4 below), which is what "the resolver decides" means here.

## 2. JOB 2 · `src/lib/headless.ts:6602` — the wild planner's context prints the STORED kind

_skeleton._

## 3. JOB 3 · `src/lib/headless.ts:6427` — `promptExpand` does not carry the kind

_skeleton._

## 4. JOB 4 · the dead gate seam `stampEmittedSurfaceForGate`

_skeleton._

## 5. Verification (keyless; every command run in this lane)

_skeleton._

## 6. Transient red / cross-lane notes

_skeleton._

---

## 7. PARENT NOTE - wave PAUSED 2026-10-15 (appended by the parent; this is the parent's observation of the BYTES, not the lane's own claim)

The lane was stopped mid-flight at the owner's request while its log was still a skeleton. What is known
from disk, not from the lane:

- **Files this lane changed:** `scripts/rapidtool-cli.mjs` (mtime 16:55:51), `src/lib/headless.ts`
  (16:59:34), `scripts/README-cli.md` (17:02:43).
- **Its four chartered jobs are UNDOCUMENTED.** Assume nothing about their completion:
  1. wire the inert CLI `--kind` on the `create` path (`scripts/rapidtool-cli.mjs:1632`);
  2. `src/lib/headless.ts:6602` must print the RESOLVED kind, not `(kind: undefined)`;
  3. `src/lib/headless.ts:6427` `promptExpand(project, policies)` must carry the kind into
     `prompt-engine`'s new fourth parameter;
  4. **the dead gate seam** `src/lib/headless.ts:5855 stampEmittedSurfaceForGate` - it has exactly one
     hit repo-wide (its own definition), so the DoD gate reads the SYNTHESIZED surface. Either wire it at
     the right call site or record it as a named defect with the missing call site. This is the lane's
     highest-value item: a dead seam can produce a FALSE REFUSAL.
- **Not broken:** `npx tsc --noEmit` exits 0 at the pause (no `error TS` lines).
- **RESUME:** diff these three files against `HEAD` FIRST (`git diff HEAD -- <files>`), then establish each
  job's state from the bytes. Full resume order: `wave_plans/W359/HANDOFF.md` section 3.

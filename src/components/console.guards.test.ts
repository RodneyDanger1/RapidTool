// console.guards.test.ts — W60 (346 wave) lane 5 source pins for the in-lane
// UI defects fixed this lane (3 carried-in observations + 1 hunted tone bug). These are JSX-shape invariants proved
// interactively in a real browser (probe evidence in %TEMP%\rt346_C5), pinned
// here the same way src/lib/ui-surface-guards.test.ts pins console.tsx. The
// repo test glob only discovers `src/lib/**/*.test.ts`, so this file runs with
// `node --experimental-strip-types --test src/components/console.guards.test.ts`.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";

const CONSOLE_PATH =
  process.env.RT346C5_CONSOLE_TX ??
  fileURLToPath(new URL("./console.tsx", import.meta.url));
const CONSOLE = readFileSync(CONSOLE_PATH, "utf8");

const RAIL_PATH =
  process.env.RT348_RAIL_TX ??
  fileURLToPath(new URL("./pipeline-rail.tsx", import.meta.url));
const RAIL = readFileSync(RAIL_PATH, "utf8");

test("PipelineRail surfaces the per-stage audit (348 · W3)", () => {
  // fixes/348: the per-stage DiagnosisStage rows had no user-facing surface —
  // the audit was only visible as raw diagnose JSON. The rail now projects them
  // with the SAME pure projector the diagnose verb uses and renders status /
  // gate / unmet / coded refusal / unknown per phase.
  assert.match(
    RAIL,
    /import \{ projectDiagnosisStages, type DiagnosisStage \} from "@\/lib\/diagnose\.ts";/,
    "the rail must import the shared projector read-only",
  );
  assert.match(
    RAIL,
    /projectDiagnosisStages\(\s*\{ phases: project\.phases, artifacts: project\.artifacts, tokenUsage: project\.tokenUsage \},\s*snap\.tail,?\s*\)/,
    "the rail must feed the projector the project slices + ring tail",
  );
  assert.match(RAIL, /Machine audit/, "the detail panel must label the audit block");
  assert.match(RAIL, /not observed: \{stage\.unknown\.join/, "unobserved facts must be named, never guessed");
  assert.match(
    RAIL,
    /stage=\{stages\.find\(\(s\) => s\.phase === openPhase\) \?\? null\}/,
    "the open phase must receive its projected audit row",
  );
});

test("Runtime telemetry renders the heartbeat as a human age, never a raw epoch", () => {
  // The pre-fix bytes rendered `{snap.ring.lastHeartbeat?.ts ?? null}` — a
  // 13-digit epoch when a heartbeat row existed.
  assert.doesNotMatch(CONSOLE, /lastHeartbeat\?\.ts \?\? null/);
  assert.match(
    CONSOLE,
    /lastHeartbeat \? `\$\{agoLabel\(snap\.ring\.lastHeartbeat\.ts\)\} ago` : "none"/,
    "the heartbeat caption must format the ts and fall back to 'none'",
  );
});

test("More panels toggle: the action matches the visible tier and discloses aria-controls", () => {
  // Pre-fix `onClick={() => setAdvancedOpen((v) => !v)}` inverted the action in
  // the force-open state ("Fewer panels" set the flag true), so leaving an
  // advanced panel left the tier expanded.
  assert.doesNotMatch(CONSOLE, /onClick=\{\(\) => setAdvancedOpen\(\(v\) => !v\)\}/);
  assert.match(
    CONSOLE,
    /setAdvancedOpen\(\(v\) => !\(v \|\| activeIsAdvanced\)\)/,
    "next state must derive from the VISIBLE tier (showAdvanced)",
  );
  assert.match(CONSOLE, /aria-controls="advanced-panels"/, "toggle must name its region");
  assert.match(CONSOLE, /id="advanced-panels"/, "the advanced Tabs.List must carry that id");
});

test("WildConsole note: the successful stop confirmation is not a danger alert", () => {
  assert.match(CONSOLE, /const \[noteIsError, setNoteIsError\] = useState\(true\)/);
  assert.match(CONSOLE, /setNoteIsError\(false\); \/\/ success confirmation, not an error/);
  assert.match(
    CONSOLE,
    /role=\{noteIsError \? "alert" : "status"\}/,
    "the shared strip note must tone itself by whether it is an error",
  );
  assert.doesNotMatch(CONSOLE, /role="alert" className="mt-2 font-mono text-xs leading-relaxed text-danger"/);
});

test("DesignPane.copyCssVars uses the latest-action flash guard", () => {
  assert.match(CONSOLE, /const cssFlashTs = useRef\(0\)/);
  assert.match(
    CONSOLE,
    /if \(cssFlashTs\.current === my\) setCopiedCss\(false\)/,
    "only the latest CSS copy may clear the toast",
  );
  // The un-guarded timer that cleared a newer copy early must be gone.
  assert.doesNotMatch(CONSOLE, /window\.setTimeout\(\(\) => setCopiedCss\(false\), 1600\)/);
});

test("Run CTAs reflect the busy latch (346 T4 · UI-11)", () => {
  // A client run commits its phases in ONE store update, so the phase record
  // stays "ready" while run/step is in flight. The next-action panel must fold
  // the busy latch into `running`, or it renders "Ready when you are" plus an
  // ENABLED Run button beside the action bar's "Running…" (operator ui-03).
  assert.match(
    CONSOLE,
    /const actionRunning = running \|\| busyAction === "run" \|\| busyAction === "step";/,
    "the next-action running flag must include the run/step busy actions",
  );
  assert.match(CONSOLE, /uiNextAction\(project, actionRunning\)/, "uiNextAction must read the busy-inclusive flag");
  assert.doesNotMatch(CONSOLE, /uiNextAction\(project, running\)/, "the record-only running flag must not drive the panel");
  // RunStatusPanel's primary button disables while ANY action is in flight.
  assert.match(CONSOLE, /disabled=\{busy === true\}/, "RunStatusPanel button must gate on busy");
  assert.match(CONSOLE, /busy=\{busyAction !== null\}/, "RunScreen must pass the busy latch to RunStatusPanel");
  // The Artifacts empty-state CTA is a run action too — same predicate as the bar.
  assert.match(
    CONSOLE,
    /onClick=\{\(\) => void runUntil\(\)\}\s*\n\s*disabled=\{!canExecute\(project, busyAction !== null\)\}/,
    "the Artifacts empty-state Run CTA must use the shared canExecute predicate",
  );
});

test("Phase gate detail survives a PARTIAL foreign gate (350 · U1)", () => {
  // repairPhases keeps a record's `gate` verbatim (`r.gate ?? null`), so a
  // hand-edited/foreign build.json can carry `gate: { passed: false }` with no
  // `unmet` array and no `evidenceHash`. Both phase-detail surfaces then threw
  // `TypeError: Cannot read properties of undefined (reading 'slice')` and the
  // PaneBoundary replaced the pane (browser-reproduced on an imported record:
  // probe10). Each read must render an honest unknown, never throw.
  assert.doesNotMatch(RAIL, /rec\.gate\.evidenceHash\.slice\(/, "rail must not slice a missing hash");
  assert.match(
    RAIL,
    /typeof gate\.evidenceHash === "string" && gate\.evidenceHash\.length > 0/,
    "rail must guard the evidence hash before slicing it",
  );
  assert.match(RAIL, /Array\.isArray\(gate\.unmet\) \? gate\.unmet : \[\]/, "rail must coerce a junk unmet");
  assert.doesNotMatch(RAIL, /rec\.gate\.unmet\.length/, "rail must not read .length on a missing unmet");
  assert.doesNotMatch(RAIL, /rec\.gate\.evidenceHash\.slice\(/, "rail must not slice an unguarded hash");

  assert.match(
    CONSOLE,
    /typeof rec\.gate\.evidenceHash === "string" && rec\.gate\.evidenceHash\.length > 0/,
    "record view must guard the evidence hash before slicing it",
  );
  assert.doesNotMatch(CONSOLE, /rec\.gate\.unmet\.length/, "record view must not read .length on a missing unmet");
  assert.doesNotMatch(
    CONSOLE,
    /text-faint"> · \{rec\.gate\.evidenceHash\.slice\(0, 8\)\}/,
    "record view must not render an unguarded evidence slice",
  );
  assert.match(CONSOLE, /Array\.isArray\(rec\.gate\.unmet\)/, "record view must coerce a junk unmet");
  assert.match(CONSOLE, /Array\.isArray\(gate\.unmet\) \? gate\.unmet : \[\]/, "gate verdict must coerce a junk unmet");
});

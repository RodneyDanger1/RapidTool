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

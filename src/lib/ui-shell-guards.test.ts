// ui-shell-guards.test.ts — W50 · 336-5 "Chrome" source-level guards for the
// app-shell polish landed this wave (global skip link, state-aware run title,
// mobile header density) and for the store action this lane wired to a real
// consumer.
//
// Why STATIC: these are JSX/route-shape invariants (every screen main is the
// global skip target; the run route's head derives its title from the store).
// They are proved interactively in a real browser (fixes/336_5_chrome.md §2),
// but a browser run is not a durable regression guard and the repo's test glob
// only discovers `src/lib/**/*.test.ts` (package.json `"test"`). So the pins
// live here as source assertions — the same instrument `ui-surface-guards.test.ts`
// (335-5) uses for console.tsx.
//
// RED-first: every assertion below FAILS against HEAD's bytes (`fac37d4`) and
// PASSES against this lane's. `RT336_*_TX` harness hooks let a reviewer point
// any pin at a pre-change copy without touching the working tree.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";

const root = (name: string, env: string, rel: string) =>
  process.env[env] ?? fileURLToPath(new URL(rel, import.meta.url));

const ROOT_TSX = readFileSync(root("root", "RT336_ROOT_TX", "../routes/__root.tsx"), "utf8");
const ERROR_TSX = readFileSync(
  root("err", "RT336_ERR_TX", "../lib/error-component.tsx"),
  "utf8",
);
const CONSOLE_TSX = readFileSync(
  root("console", "RT336_CONSOLE_TX", "../components/console.tsx"),
  "utf8",
);
const RUN_ROUTE = readFileSync(
  root("runroute", "RT336_RUNROUTE_TX", "../routes/run.$id.tsx"),
  "utf8",
);

const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;

test("__root.tsx: one global skip link targets #main-content", () => {
  assert.match(ROOT_TSX, /href="#main-content"/, "the global skip link must target #main-content");
  assert.match(ROOT_TSX, /Skip to main content/, "the link must carry visible text");
  // exactly one, so the shell never renders two first-focus stops.
  assert.equal(count(ROOT_TSX, /href="#main-content"/g), 1);
});

test("every screen main is the global skip target (#main-content)", () => {
  for (const [name, text] of [
    ["error-component.tsx", ERROR_TSX],
    ["console.tsx", CONSOLE_TSX],
  ] as const) {
    const mains = count(text, /<main\b/g);
    assert.ok(mains > 0, `${name} must render at least one <main>`);
    assert.equal(
      count(text, /<main\b[^>]*\bid="main-content"/g),
      mains,
      `${name}: every <main> must carry id="main-content" (skip target)`,
    );
  }
});

test("run route: head derives its title from real project existence", () => {
  assert.match(RUN_ROUTE, /hasProject/, "the route head must consult the store's hasProject");
  assert.match(RUN_ROUTE, /RapidTool — build not found/, "a missing build must name itself in the title");
  assert.match(RUN_ROUTE, /RapidTool — Delivery run/, "a found build keeps the delivery-run title");
  // The head must not be a bare static object any more.
  assert.doesNotMatch(
    RUN_ROUTE,
    /head:\s*\(\)\s*=>\s*\(\{\s*meta:\s*\[\{\s*title:\s*"RapidTool — Delivery run"\s*\}\]/,
    "the static title-only head is the defect being fixed",
  );
});

test("run header: chrome (status chips + view/config controls) collapses on mobile", () => {
  assert.match(CONSOLE_TSX, /const \[headerStatusOpen/, "the disclosure needs its own state");
  assert.match(
    CONSOLE_TSX,
    /aria-controls="run-status-strip run-options-strip"/,
    "the one toggle must name both collapsed groups",
  );
  assert.match(CONSOLE_TSX, /\bid="run-status-strip"/, "the chip strip needs the documented id");
  assert.match(CONSOLE_TSX, /\bid="run-options-strip"/, "the view/config group needs the documented id");
  // Desktop must keep both groups visible: each carries `sm:flex`.
  assert.equal((CONSOLE_TSX.match(/sm:flex sm:w-auto/g) ?? []).length, 2, "both groups stay visible on `sm`+");
});

test("ShellSurfacesCard reads the plan through store.wildPlanFor (surface→backend)", () => {
  assert.match(
    CONSOLE_TSX,
    /wildPlanFor\(/,
    "the card must read the documented store accessor, not project.wildPlan directly",
  );
});

test("WildToggle surfaces startWildRun's refusal instead of dropping it", () => {
  // The enable path used to `void startWildRun(...)` and throw the result away,
  // so a refusal (e.g. Wild enabled on an already-complete build) left the
  // toggle reading "on" with an idle strip and no explanation. The refusal must
  // be both HANDLED and RENDERED (the resume path already does this).
  assert.doesNotMatch(
    CONSOLE_TSX,
    /void useRapid\.getState\(\)\.startWildRun\(project\.id\);/,
    "the start result must not be dropped",
  );
  assert.match(
    CONSOLE_TSX,
    /startWildRun\(project\.id\)[\s\S]{0,220}res\.ok/,
    "the refusal arm must be handled",
  );
  assert.match(CONSOLE_TSX, /role="alert"[\s\S]{0,120}\{err\}/, "the refusal must be visible");
});

test("Reject dock handles a rejection from rejectAsync (no floating promise)", () => {
  // W51 · 337-2: `void rejectAsync(...).then(onFulfilled).finally(...)` had NO
  // onRejected. `.finally` does not absorb a rejection, so IF rejectAsync ever
  // rejected the failure would float as an unhandled rejection (the same class
  // the WildToggle fix closed). The store action cannot throw today, but the
  // call site must still handle the rejection and surface it.
  assert.match(
    CONSOLE_TSX,
    /void rejectAsync\(projectId, note\)\s*\.then\(\s*\(res\)\s*=>\s*\{[\s\S]*?\},\s*\(errCaught: unknown\)\s*=>/,
    "rejectAsync's rejection must be handled, not left floating",
  );
});

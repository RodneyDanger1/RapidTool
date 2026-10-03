// ui-surface-guards.test.ts — W49 · 335-5 "Chrome" source-level guards for the
// console surfaces this lane touched.
//
// Why a STATIC test: the defects below are DOM/JSX-shape invariants (an
// aria-label on a generic role is dropped by assistive tech; a flex item
// without `min-w-0`/`truncate` cannot shrink a long build name). They are
// proved interactively in a real browser (fixes/335_5_chrome.md §2), but a
// browser run is not a durable regression guard, and the repo's test glob only
// discovers `src/lib/**/*.test.ts` (package.json `"test"`). So the pins live
// here as source assertions — the same instrument `scripts/next-action-arm-parity.test.mjs`
// already uses to pin console.tsx (that guard reads console.tsx too).
//
// RED-first: the assertions below all FAIL against HEAD's console.tsx
// (hash e284177…) and PASS against this lane's bytes. `RT335_CONSOLE_TX` is a
// harness hook: point it at a copy of the pre-change file to reproduce the
// red run without touching the working tree.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";

const CONSOLE_PATH =
  process.env.RT335_CONSOLE_TX ?? fileURLToPath(new URL("../components/console.tsx", import.meta.url));
const CONSOLE = readFileSync(CONSOLE_PATH, "utf8");

/** Every `<div>`/`<span>` opening tag that carries `aria-label` but no `role=`.
 *  A generic-role element cannot be named, so such a label is dead ARIA. */
function genericRoleLabelled(text: string): string[] {
  const hits: string[] = [];
  for (const m of text.matchAll(/<(div|span)(\s[^>]*?)?>/gs)) {
    const attrs = m[2] ?? "";
    if (attrs.includes("aria-label") && !/\brole=/.test(attrs)) {
      hits.push(m[0].replace(/\s+/g, " ").slice(0, 90));
    }
  }
  return hits;
}

test("console.tsx: no aria-label on a generic (roleless) div/span", () => {
  assert.deepEqual(genericRoleLabelled(CONSOLE), []);
});

test("console.tsx: the run screen's `main` is the global skip target", () => {
  // 336-5: the run-only skip link is superseded by the ONE global link in
  // routes/__root.tsx; every screen main now carries id="main-content" (pinned
  // in ui-shell-guards.test.ts). The console must not render a second
  // identical first-focus stop.
  assert.match(CONSOLE, /<main\b[^>]*\bid="main-content"/, "run screen must render <main id=\"main-content\">");
  assert.doesNotMatch(CONSOLE, /Skip to main content/, "the skip link must live in __root.tsx, not here");
  // exactly one closing tag per opening tag of each kind (no stray rename).
  assert.equal((CONSOLE.match(/<main\b/g) ?? []).length, (CONSOLE.match(/<\/main>/g) ?? []).length);
});

test("console.tsx: a very long build name cannot blow the layout out (header + home list)", () => {
  // Header: the name control is capped + ellipsised and its flex parent can shrink.
  assert.match(
    CONSOLE,
    /className="hidden max-w-\[46vw\] min-w-0 truncate text-sm text-muted sm:inline-block"/,
    "header build-name control must cap + truncate",
  );
  assert.match(CONSOLE, /<div className="flex min-w-0 items-center gap-3">/, "header name group must carry min-w-0");
  // Home build list row: shrinkable column + a break for unbroken tokens.
  assert.match(CONSOLE, /<span className="min-w-0">/, "home list row must carry min-w-0");
  assert.match(
    CONSOLE,
    /className="block text-sm font-medium \[overflow-wrap:anywhere\]">\{p\.name\}/,
    "home list build name must wrap long unbroken tokens",
  );
  // Archive dialog title can wrap an unbroken name too.
  assert.match(CONSOLE, /tracking-tight \[overflow-wrap:anywhere\]">\s*Archive \{project\.name\}\?/);
});

test("console.tsx: aria-labelled regions use a real role (not a bare div)", () => {
  assert.match(CONSOLE, /<section aria-label="Phase progress"/, "phase progress must be a labelled <section> region");
  assert.match(CONSOLE, /\brole="group"\s+className="flex flex-wrap items-center gap-1\.5 px-5 pt-2"/);
  assert.match(CONSOLE, /\brole="group"\s+className="overflow-auto rounded-md border border-border bg-surface"/);
  assert.match(CONSOLE, /\brole="img"\s+title=\{doc \? doc\.agentAction/);
});

test("console.tsx: no visible internal TODO() marker leaks to the operator", () => {
  // The three ShellSurfacesCard rows used to print "(TODO(N2)).", "TODO(seat)"
  // and "TODO(R13-f04)" as VISIBLE copy. Their honest limitation sentences stay;
  // only the engineering marker is gone (ticket ids remain in the `title`/comments).
  assert.doesNotMatch(CONSOLE, /no console read seam yet\s*\n\s*\(TODO\(N2\)\)\./);
  assert.doesNotMatch(CONSOLE, /token; TODO\(seat\)/);
  assert.doesNotMatch(CONSOLE, /OS-sandboxed; TODO\(R13-f04\)/);
});

test("console.tsx: zero non-null assertions (hard rule, held)", () => {
  assert.equal((CONSOLE.match(/[A-Za-z0-9_)\]]!\./g) ?? []).length, 0, "no `x!.y`");
  assert.equal((CONSOLE.match(/[A-Za-z0-9_)\]]!\)/g) ?? []).length, 0, "no `x!)`");
  assert.equal((CONSOLE.match(/[A-Za-z0-9_)\]]!;/g) ?? []).length, 0, "no `x!;`");
});

test("sibling components: no aria-label on a generic (roleless) div/span", () => {
  for (const rel of ["pipeline-rail.tsx", "runtime-timeline-pane.tsx", "cmd-palette.tsx"]) {
    const text = readFileSync(fileURLToPath(new URL(`../components/${rel}`, import.meta.url)), "utf8");
    assert.deepEqual(genericRoleLabelled(text), [], `${rel} must not label a generic element`);
  }
});

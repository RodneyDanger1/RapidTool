/**
 * T5.2-A — fixtures review surface · CLIENT-CALLABLE WRAPPER.
 *
 * Mirrors `src/lib/chat.ts`'s exact pattern: a `createServerFn` plus a plain
 * async wrapper the console imports and calls directly (`fn({ data: … })`).
 * The handler lazily imports the `.server.ts` loader, so `node:fs` never
 * enters the client bundle (the H2 crash class). Read-only by construction:
 * the loader has no write path, and the grader is never copied anywhere — it
 * stays run-side authority (`graderLeakScan` pins that).
 */

import { createServerFn } from "@tanstack/react-start";
import type { FixtureLoadResult } from "./fixtures.server.ts";

const fixturesServer = createServerFn({ method: "POST" })
  .validator((input: Record<string, never>) => input)
  .handler(async () => {
    const { loadFixtureReviewRows } = await import("./fixtures.server.ts");
    return loadFixtureReviewRows();
  });

/**
 * Load the corpus fixtures + their graders as review rows (read-only).
 * A failure surfaces as an honest `{ ok: false, … }` shape — never invented
 * rows (the chat function's error discipline).
 */
export async function fixturesReview(): Promise<FixtureLoadResult> {
  try {
    return await fixturesServer({ data: {} });
  } catch (err) {
    return {
      ok: false,
      corpusDir: "",
      rows: [],
      problems: [`fixtures review unavailable: ${err instanceof Error ? err.message : String(err)}`],
      label: "read-only review — the grader is run-side authority; approving here records a decision, it does not modify the bar",
    };
  }
}

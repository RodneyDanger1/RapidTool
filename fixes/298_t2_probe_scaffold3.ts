// T2 probe #3c: byte-exact truth for the scaffold regexes.
// MOVED fixes/301 · X4 (2026-09-28): was repo root `probe-t2-scaffold3.ts`,
// accidentally committed at 4af061a; kept under fixes/ as T2's scaffold-red
// diagnosis evidence. Run from the repo root (its readFileSync path is
// cwd-relative):  node --experimental-strip-types fixes/298_t2_probe_scaffold3.ts
import { readFileSync } from "node:fs";
import { ALL_PHASES, runHeadless, seedProject } from "../src/lib/testing/fixtures.ts";
import { scaffoldProject } from "../src/lib/scaffold.ts";

// 1. raw source lines of the two failing assertions
const testSrc = readFileSync("./src/lib/scaffold.test.ts", "utf8").split("\n");
for (const n of [741, 759]) {
  console.log(`test.ts:${n} RAW: ${JSON.stringify(testSrc[n - 1])}`);
}
// 2. the emitted spec line, byte-exact
const p = runHeadless(seedProject(), ALL_PHASES);
const sc = scaffoldProject(p);
if (!sc.ok) throw new Error(sc.error);
const spec = sc.files.find((x) => x.path === "tests/oracle.spec.ts")!.body;
const line = spec.split("\n").find((l) => l.includes("assert.rejects"))!;
console.log("SPEC LINE RAW:", JSON.stringify(line.trim()));
// 3. extract the regex from the old assertion source and test it against spec
for (const n of [741, 759]) {
  const m = testSrc[n - 1].match(/assert\.match\(spec, (\/.*\/)\);/);
  if (!m) { console.log(n, "no regex parsed"); continue; }
  const src = m[1];
  console.log(`regex source @${n}:`, JSON.stringify(src));
  try {
    const re = new RegExp(src.slice(1, src.lastIndexOf("/")).replace(/\\\//g, "/"), "");
    console.log(`  matches spec: ${re.test(spec)}`);
  } catch (e) {
    console.log("  compile error", (e as Error).message);
  }
}
// 4. what the current emitted bytes are
console.log("spec includes bare TODO(E-15) stub:", spec.includes("TODO(E-15) stub"));
console.log("spec includes backslash-paren form:", spec.includes("TODO\\(E-15\\) stub"));
console.log("spec includes coded form:", spec.includes("RT_E_VALIDATION · TODO\\(E-15\\) stub"));

// T2 probe #3: the exact assert.rejects bytes the oracle spec emits for the
// scaffold leftover-job fixtures (both branches).
import { ALL_PHASES, runHeadless, seedProject } from "./src/lib/testing/fixtures.ts";
import { scaffoldProject } from "./src/lib/scaffold.ts";

const bodyOf = (p: ReturnType<typeof scaffoldProject>, path: string): string => {
  if (!p.ok) throw new Error(p.error);
  const f = p.files.find((x) => x.path === path);
  if (!f) throw new Error("missing " + path);
  return f.body;
};

for (const [label, phases] of [["fullRun", ALL_PHASES], ["primed", [0]]] as const) {
  const p = runHeadless(seedProject(), phases as readonly number[]);
  const spec = bodyOf(scaffoldProject(p), "tests/oracle.spec.ts");
  const lines = spec.split("\n").filter((l) => l.includes("assert.rejects"));
  console.log(`\n=== ${label}: ${lines.length} assert.rejects line(s)`);
  for (const l of lines.slice(0, 4)) console.log("RAW " + JSON.stringify(l.trim()));
  console.log("has old bare form:", spec.includes("TODO+(E-15+) stub"));
  console.log("has coded form:", spec.includes("RT_E_VALIDATION · TODO\\(E-15\\) stub"));
}

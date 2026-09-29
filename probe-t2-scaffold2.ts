// T2 probe #3b: exact chars + which candidate regex matches.
import { ALL_PHASES, runHeadless, seedProject } from "./src/lib/testing/fixtures.ts";
import { scaffoldProject } from "./src/lib/scaffold.ts";

const p = runHeadless(seedProject(), ALL_PHASES);
if (!p) throw new Error("no project");
const sc = scaffoldProject(p);
if (!sc.ok) throw new Error(sc.error);
const spec = sc.files.find((x) => x.path === "tests/oracle.spec.ts")!.body;
const line = spec.split("\n").find((l) => l.includes("assert.rejects"))!;
const i = line.indexOf("TODO");
const seg = line.slice(i, i + 14);
console.log("segment chars:", [...seg].map((c) => `${JSON.stringify(c)}:${c.charCodeAt(0)}`).join(" "));

const candidates: [string, RegExp][] = [
  ["double-backslash form", /assert\.rejects\(route\(ep\.method, ep\.path, \{\}\), \/RT_E_VALIDATION · TODO\\\(E-15\\\) stub\/\)/],
  ["single-backslash form", /assert\.rejects\(route\(ep\.method, ep\.path, \{\}\), \/RT_E_VALIDATION · TODO\(E-15\) stub\/\)/],
  ["no-backslash form", /assert\.rejects\(route\(ep\.method, ep\.path, \{\}\), \/RT_E_VALIDATION · TODO(E-15) stub\/\)/],
];
for (const [name, re] of candidates) console.log(name, "=>", re.test(spec));

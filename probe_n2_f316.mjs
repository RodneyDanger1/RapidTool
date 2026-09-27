// probes N2 F3-16: the evidence digest now distinguishes spec sets with equal counts
import { treeRunTestedEvidence } from "./src/lib/codegen.server.ts";

const mk = (files) => ({
  ok: true,
  dir: "/x",
  compile: { passed: 2, checked: 2 },
  tests: files.map((f) => ({ file: f, compile: "pass", tests: { pass: 3, fail: 0 }, run: "pass" })),
  run: { kind: "library", run: "pass" },
});

const a = treeRunTestedEvidence(mk(["test/a.test.ts", "test/b.test.ts"]));
const b = treeRunTestedEvidence(mk(["test/c.test.ts", "test/d.test.ts"]));
const c = treeRunTestedEvidence(mk(["test/b.test.ts", "test/a.test.ts"]));
console.log("A:", a.summary);
console.log("order-insensitive (sorted):", a.summary === c.summary);
console.log("counts-equal/different-files distinguish:", a.summary !== b.summary);
console.log("executed:", a.executed, "specFiles:", a.specFiles, "assertions:", a.assertions);

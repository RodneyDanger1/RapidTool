// Probe #2: tracing hand-built span validation, render fuzz, vector badge fuzz
import { formatDurationMs, recordSpan, traceSpan, createTrace, spansAsText, traceSummary } from "./src/lib/tracing.ts";
import { renderMarkdownBlocks } from "./src/lib/render.ts";
import { generateBadge, geometricMonogram, BADGE_TONES } from "./src/lib/vector.ts";

const fails: string[] = [];
const check = (name: string, cond: boolean, extra = "") => {
  if (!cond) fails.push(`${name} ${extra}`.trim());
};

// --- T1: hand-built closed span with Infinity endTs sneaks through recordSpan
{
  const t = createTrace("r1", 0);
  const evil = {
    id: "s1", parentId: null, kind: "k", label: "l", startTs: 5,
    endTs: Number.POSITIVE_INFINITY, status: "ok",
  };
  try {
    const t2 = recordSpan(t, evil);
    const s = traceSummary(t2);
    check("T1a Infinity endTs rejected", false, `accepted; totalMs=${s.totalMs}`);
    const txt = spansAsText(t2);
    check("T1b timeline renders sane", !txt.includes("Infinitym"), txt);
  } catch {
    check("T1a Infinity endTs rejected", true);
  }
}
// --- T2: endTs < startTs via hand-built span
{
  const t = createTrace("r1", 0);
  const evil = { id: "s1", parentId: null, kind: "k", label: "l", startTs: 100, endTs: 50, status: "ok" };
  try {
    recordSpan(t, evil);
    check("T2 backwards endTs rejected", false);
  } catch {
    check("T2 backwards endTs rejected", true);
  }
}
// --- T3: closed span with status "started" hand-built
{
  const t = createTrace("r1", 0);
  const evil = { id: "s1", parentId: null, kind: "k", label: "l", startTs: 1, endTs: 2, status: "started" };
  try {
    recordSpan(t, evil);
    check("T3 closed+started rejected", false);
  } catch {
    check("T3 closed+started rejected", true);
  }
}
// --- T4: refresh merges backwards: open at 100, refresh closed at 50
{
  const t = createTrace("r1", 0);
  const open = traceSpan("s1", null, "k", "l", 100);
  const t2 = recordSpan(t, open);
  const close = traceSpan("s1", null, "k", "l2", 50, 60, "ok");
  try {
    recordSpan(t2, close);
    check("T4 refresh backwards rejected", false);
  } catch {
    check("T4 refresh backwards rejected", true);
  }
}
// --- T5: formatDurationMs non-finite
for (const v of [Number.NaN, Number.POSITIVE_INFINITY, "12"] as const) {
  const out = formatDurationMs(v as never);
  check(`T5 fmt(${String(v)}) sane`, !/NaN|Infinity/.test(out), out);
}

// --- R1: render markdown adversarial fuzz — no throws, no infinite loop
{
  const atoms = [
    "```", "````", "``````", "```ts", "# ", "## ", "### ", "#### ", "- ", "* ", "1. ", "12. ",
    "999999999.", "---", "***", "___", "`", "``", "a".repeat(5000), "\t", "\r\n", "\u0000",
    "[x](y)", "<script>", "**bold**", "text ", "  ", "| cell |", "> quote", "=".repeat(50),
  ];
  let seed = 99;
  const rnd = (m: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % m; };
  let okCount = 0;
  for (let iter = 0; iter < 3000; iter++) {
    const lines = Array.from({ length: 1 + rnd(12) }, () => atoms[rnd(atoms.length)]);
    const input = lines.join(rnd(3) === 0 ? "\r\n" : "\n");
    try {
      const blocks = renderMarkdownBlocks(input);
      okCount++;
      const again = renderMarkdownBlocks(input);
      if (JSON.stringify(blocks) !== JSON.stringify(again)) {
        fails.push(`R1 nondeterminism iter=${iter}`); break;
      }
    } catch (e) {
      fails.push(`R1 THROW iter=${iter} err=${String(e)} input=${JSON.stringify(input).slice(0, 200)}`); break;
    }
  }
  check(`R1 render fuzz ok (${okCount})`, fails.length === 0 ? true : false, fails[0] ?? "");
}
// R2: backtick storm line
{
  const storm = "`".repeat(200000);
  try {
    const b = renderMarkdownBlocks(storm + "\nmid\n" + storm);
    check("R2 backtick storm parses", b.length > 0 && b.length < 10, `blocks=${b.length}`);
  } catch (e) {
    fails.push(`R2 THROW ${String(e)}`);
  }
}
// R3: fence info with backticks is not a fence
{
  const b = renderMarkdownBlocks("```a`b\ncode\n```");
  check("R3 backtick-in-info stays paragraph", b[0]?.type === "p" && b.length === 1, JSON.stringify(b).slice(0, 120));
}
// R4: 4-tick fence containing ``` content + trailing ticks on close
{
  const b = renderMarkdownBlocks("````\n```\nx\n```` `bad");
  check("R4 close-line with trailing content is NOT a close (needs [ \\t]*$)", b.length === 1 && b[0].type === "code", JSON.stringify(b).slice(0, 150));
}

// --- V1: badge + monogram determinism/robustness over hostile labels
{
  const hostile = ["", " ", "\u0000\u0001\u001f", "a".repeat(5000), "&<>\"'", "💥🚀", "\ud800x", "line1\nline2", "`backtick`", "| pipe |"];
  for (const label of hostile) {
    for (const tone of BADGE_TONES) {
      try {
        const a = generateBadge(label, tone);
        const b = generateBadge(label, tone);
        check(`V1 deterministic ${JSON.stringify(label.slice(0, 8))}/${tone}`, a === b);
        if (a.includes("</svg>") === false) fails.push(`V1 bad svg shape ${tone}`);
      } catch (e) {
        fails.push(`V1 THROW label=${JSON.stringify(label.slice(0, 20))} tone=${tone} err=${String(e)}`);
      }
    }
    try {
      const m1 = geometricMonogram(label, 7);
      const m2 = geometricMonogram(label, 7);
      check(`V1 mono deterministic ${JSON.stringify(label.slice(0, 8))}`, m1 === m2);
    } catch (e) {
      fails.push(`V1 mono THROW ${String(e)}`);
    }
  }
  // unknown tone throws (contract)
  let threw = false;
  try { generateBadge("x", "bogus" as never); } catch { threw = true; }
  check("V1 unknown tone throws", threw);
}

console.log(fails.length ? "FAILS:\n" + fails.join("\n") : "ALL PROBES PASS");

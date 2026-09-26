// W26 H3 PROBE — W23-L1 call-tap containment (deepseek.ts:585-594, 601-617).
// Question: does a tap that returns a REJECTED PROMISE (async tap) escape the
// try/catch containment and become an unhandled rejection (process crash)?
// Keyless path: no DEEPSEEK_API_KEY => zero network I/O.
import { completeDeepSeek, setLlmCallTap } from "./src/lib/llm/providers/deepseek.ts";

delete process.env.DEEPSEEK_API_KEY;

// (1) sync-throwing tap — the case the try/catch was written for.
setLlmCallTap(() => {
  throw new Error("sync tap boom");
});
const r1 = await completeDeepSeek("hello");
console.log("case1 sync-throwing tap → call survived:", r1.ok === false, "code:", (r1 as { code?: string }).code);

// (2) async-rejecting tap — same contract claim, promise channel.
const seen: string[] = [];
process.on("unhandledRejection", (reason) => {
  seen.push(reason instanceof Error ? reason.message : String(reason));
});
setLlmCallTap(async () => {
  throw new Error("async tap boom");
});
const r2 = await completeDeepSeek("hello");
console.log("case2 async-rejecting tap → call survived:", r2.ok === false, "code:", (r2 as { code?: string }).code);
await new Promise((r) => setTimeout(r, 200));
console.log("case2 unhandledRejection fired:", JSON.stringify(seen));
console.log(seen.length > 0 ? "VERDICT: promise rejection NOT contained" : "VERDICT: contained");

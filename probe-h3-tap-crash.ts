// W26 H3 PROBE — same async tap, NO unhandledRejection listener: does the
// process die the way a real CLI run would (default --unhandled-rejections=throw)?
import { completeDeepSeek, setLlmCallTap } from "./src/lib/llm/providers/deepseek.ts";
delete process.env.DEEPSEEK_API_KEY;
setLlmCallTap(async () => {
  throw new Error("async tap boom (unhandled)");
});
const r = await completeDeepSeek("hello");
console.log("call survived:", r.ok === false);
await new Promise((resolve) => setTimeout(resolve, 200));
console.log("REACHED-END (process did not crash)");

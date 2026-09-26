// W26 H3 PROBE — error-class label for HTTP 402 "Insufficient Balance".
// W23-L1 (fixes/262) doctrine: a broke wallet gets its OWN code
// (RT_E_LLM_NO_BALANCE), never the generic refusal. Compare the DeepSeek
// provider (fixed) with the OpenAI-compatible/xAI adapter (this hunt's box).
process.env.DEEPSEEK_API_KEY = "probe-key-never-sent";
process.env.XAI_API_KEY = "probe-key-never-sent";

const { completeDeepSeek } = await import("./src/lib/llm/providers/deepseek.ts");
const { completeOpenAiCompatible, createOpenAiCompatibleProvider, XAI_SPEC } = await import(
  "./src/lib/llm/providers/openai-compatible.ts"
);

const fake402 = async () =>
  new Response(JSON.stringify({ error: { message: "Insufficient Balance" } }), {
    status: 402,
    headers: { "content-type": "application/json" },
  });

const ds = await completeDeepSeek("probe", { fetch: fake402 as unknown as typeof fetch });
console.log("DeepSeek 402  → code:", (ds as { code?: string }).code);

const verified = createOpenAiCompatibleProvider(XAI_SPEC, ["probe-model-id"]);
const xai = await completeOpenAiCompatible(XAI_SPEC, verified.requestModelIds, "probe", {
  model: "probe-model-id",
  fetch: fake402 as unknown as typeof fetch,
});
console.log("xAI     402  → code:", (xai as { code?: string }).code);
console.log("xAI message:", (xai as { error?: string }).error);

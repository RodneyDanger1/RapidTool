# RapidTool — Technical Deep Dives: 10 Implementation Research Topics

> Research file for the RapidTool client-side console (TanStack Start / React 19 / Tailwind v4 / zustand / PGlite / better-auth, hosted inside a Grok chat-preview iframe).
> Every topic: **best practice with URLs + attributed real code | pitfalls | concrete RapidTool recommendation** (file/function to change + how).
> All snippets are real code copied from the cited source unless marked `[proposed]` (new code suggested for RapidTool).
> Companion digest: `01_*` (audit) and `02_*` (concept) files in this folder.

Codebase anchors referenced throughout (root: `C:\Users\mnril\Desktop\RapidTool Main`):

- `src/lib/algorithms.ts` — `estimateTokens()` (len/4 heuristic), A2 FusionRank (kind-bucketed pseudo-RRF)
- `src/lib/sandbox.ts` — generated-JS runner (`new Function` + substring denylist, no timeout)
- `src/lib/db.ts` — Neon/PGLite dual driver
- `src/lib/store.ts` — zustand store with persist + demo seeding
- `src/lib/packet.ts` — 14 KB agent packet (markdown)
- `src/components/console.tsx` — tab bar (5 plain buttons), whole-store subscriptions
- `AGENTS.md`, `AGENTS.project.md` — repo agent-instruction files (relevant to topic 8)

---

## T1. Accurate client-side token counting & budget display

### Best practice (with URLs)

Counting tokens client-side means running a **BPE tokenizer in JS**. The canonical options:

1. **`gpt-tokenizer`** (niieani) — pure-TS port of OpenAI tiktoken, "fastest, smallest and lowest footprint GPT tokenizer available for all JavaScript environments", synchronous, browser-ready, ships per-model encodings (`cl100k_base`, `o200k_base`, `r50k_base`, `p50k_base`) and even per-model context/cost tables + `estimateCost()`.
   https://github.com/niieani/gpt-tokenizer
2. **`tiktoken` (npm, formerly `@dqbd/tiktoken`)** — official Rust tiktoken compiled to WASM with JS bindings + `js-tiktoken` pure-JS sibling for runtimes where WASM is undesirable. Requires `vite-plugin-wasm` + `vite-plugin-top-level-await` in Vite projects.
   https://github.com/dqbd/tiktoken
3. **Python `tiktoken`** — reference implementation (server-side option).
   https://github.com/openai/tiktoken — plus the canonical cookbook "How to count tokens with Tiktoken":
   https://developers.openai.com/cookbook/examples/how_to_count_tokens_with_tiktoken
4. **Heuristic with error bounds** — the well-known "1 token ≈ 4 chars ≈ 0.75 words (English)" rule of thumb (OpenAI Help Center: https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them) is only a rough estimate; measured error across real tokenizers is documented in e.g. https://zats.io/blog/counting-tokens-in-foundation-models/. Non-OpenAI vendors (Grok/xAI, DeepSeek, Claude) do **not** publish exact client tokenizers, so cross-model counting is inherently approximate — the standard trick is to count with the closest public encoding (Anthropic ~ `cl100k_base`/`o200k_base` ballpark) and display the estimate with a stated error band instead of false precision.

Real usage snippet, `gpt-tokenizer` README (https://github.com/niieani/gpt-tokenizer#usage):

```typescript
import { encode, decode, isWithinTokenLimit, encodeChat } from 'gpt-tokenizer'
// depending on the model, import from the respective file, e.g.:
// import {...} from 'gpt-tokenizer/model/gpt-4o'

const text = 'Hello, world!'
const tokenLimit = 10

// Encode text into tokens
const tokens = encode(text)

// Check if text is within the token limit
// returns false if the limit is exceeded, otherwise returns the actual number of tokens (truthy value)
const withinTokenLimit = isWithinTokenLimit(text, tokenLimit)

// Example chat:
const chat = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'assistant', content: 'gpt-tokenizer is awesome.' },
] as const
const chatTokens = encodeChat(chat)
```

Real usage snippet, `tiktoken` WASM README (https://github.com/dqbd/tiktoken#usage):

```typescript
import { get_encoding, encoding_for_model } from "tiktoken";

// To get the tokeniser corresponding to a specific model in the OpenAI API:
const enc = encoding_for_model("text-davinci-003");

// don't forget to free the encoder after it is not used
enc.free();
```

Notes on chat overhead: OpenAI's cookbook counting functions add a per-message format overhead (3 tokens per message, 3 tokens for the assistant reply priming, etc. in `num_tokens_from_messages`) — relevant when the budget chip must cover system+history, not just the current textarea. For counting *exactly* what the API will charge, the only 100 % ground truth remains `usage.prompt_tokens` in the API response — client estimates should be treated as preflight.

### Pitfalls

- **Model-vs-encoding mismatch**: counting with `cl100k_base` while the endpoint uses a different tokenizer (DeepSeek, Grok) silently drifts. Pick the closest encoding and *say so* in the UI ("≈", "±%"), or count twice (upper/lower bound) if the model is unknown.
- **Perf on every keystroke**: `encode()` of a large transcript on every keypress is wasteful; `isWithinTokenLimit` exists exactly to short-circuit without encoding everything. Debounce + memoize by content hash.
- **WASM bundling friction**: `tiktoken` WASM needs `vite-plugin-wasm` + top-level-await; workers/edge/CDN constraints; Deno unsupported for the WASM variant (pure-JS `js-tiktoken` is the fallback). `gpt-tokenizer` avoids this entirely (no WASM).
- **`len/4` is the worst kind of estimate**: 4 chars/token only holds for average English prose; code, identifiers, JSON, and CJK text diverge by 2–5×. Since RapidTool console content is mostly *code + JSON*, len/4 can be off by >2×.
- Bundle size: BPE vocab tables are ~0.5–2 MB raw; `gpt-tokenizer` ships the most compact encodings and supports dynamic `import()` (lazy load) — load only `o200k_base`-family at startup.
- Special tokens: `<|im_start|>`-style tokens and tool-call blocks are not plain text; `encodeChat` / `allowedSpecial` exist for this.

### RapidTool recommendation

Replace `estimateTokens()` in `src/lib/algorithms.ts`:

- Add `gpt-tokenizer` (pure JS, synchronous, no WASM config). Keep the signature `estimateTokens(text, opts?)` but implement `tokens = encode(text).length` against a `MODEL_TOKENIZER_MAP` (`{ 'grok-*': o200k_base-ish default, 'deepseek-*': cl100k_base default, ... }`) since neither Grok nor DeepSeek publishes a browser tokenizer; expose `estimateTokens(text).length` plus a `bound: {lo, hi}` using the documented heuristic ratio (±~15 %) and render the chip as `≈ 1,240 tok` with a `±` tooltip instead of a fake-exact number.
- Debounce (150 ms) + cache by `hash(text)`; use `isWithinTokenLimit` for the "over budget" red state so big transcripts short-circuit.
- Budget display: `(messages-in-context) + (new text)` computed with the chat-overhead constants; render as `used / budget (model)` progress bar, and include `estimateCost()` from `gpt-tokenizer/models` if RapidTool ever shows $ estimates.
- Keep a server-side Python `tiktoken` path unused for now; do not add WASM complexity.

---

## T2. Real RRF + hybrid retrieval scoring (in-browser)

### Best practice (with URLs)

Hybrid retrieval = **lexical (BM25) + semantic (embeddings) lists fused by Reciprocal Rank Fusion (RRF)**, then optionally a cross-encoder reranker. The canonical references:

- Anthropic, "Introducing Contextual Retrieval" (Sep 2024) — the definitive modern write-up: embeddings alone fail on exact-match queries ("Error code TS-999"); BM25 + embeddings fused by RRF cuts top-20 retrieval failures **49 %**, and adding a reranker cuts them **67 %**; more chunks (top-20) beats fewer (top-5/10). https://www.anthropic.com/engineering/contextual-retrieval
- RRF origin: Cormack, Clarke, Büttcher, "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods", SIGIR 2009 — `k=60` chosen empirically; score(d) = Σ_r 1/(k + rank_r(d)). https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf
- Guillaume Laforge, "Advanced RAG — Understanding RRF in Hybrid Search" — intuition for k (low k ⇒ precision/top-heavy; k=60 ⇒ recall/consensus), and the two-stage pattern RRF(top-100) → cross-encoder(top-10). https://glaforge.dev/posts/2026/02/10/advanced-rag-understanding-reciprocal-rank-fusion-in-hybrid-search/
- MongoDB, "Better RAG results with RRF" https://www.mongodb.com/resources/basics/reciprocal-rank-fusion ; Qdrant hybrid-search demo https://qdrant.tech/course/essentials/day-3/hybrid-search-demo/

**In-browser feasibility**: BM25 is cheap and well-served by **MiniSearch** (in-memory fulltext, BM25-style ranking, zero deps): https://github.com/lucaong/minisearch. Embeddings side needs either precomputed vectors or a local embedder (transformers.js: https://huggingface.co/docs/transformers.js). Cosine top-k over a few thousand rows is trivially fast. RRF itself is ~10 lines.

Real snippet — the RRF function as published in Anthropic's contextual-retrieval post (verbatim code block, k=60 default):

```python
def reciprocal_rank_fusion(search_results_dict, k=60):
    fused_scores = {}
    for query, doc_scores in search_results_dict.items():
        for rank, (doc, score) in enumerate(sorted(doc_scores.items(), key=lambda x: x[1], reverse=True)):
            if doc not in fused_scores:
                fused_scores[doc] = 0
            fused_scores[doc] += 1 / (k + rank)
    reranked_results = dict(sorted(fused_scores.items(), key=lambda x: x[1], reverse=True))
    return reranked_results
```

Real snippet — the "contextual chunking" prompt used in the same post (verbatim):

```
<document>
{{WHOLE_DOCUMENT}}
</document>
Here is the chunk we want to situate within the whole document
<chunk>
{{CHUNK_CONTENT}}
</chunk>
Please give a short succinct context to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk. Answer only with the succinct context and nothing else.
```

Real snippet — MiniSearch basic usage (README, https://github.com/lucaong/minisearch):

```javascript
let miniSearch = new MiniSearch({
  fields: ['title', 'text'],       // fields to index for full-text search
  storeFields: ['title', 'category'] // fields to return with search results
})
miniSearch.addAll(documents)
let results = miniSearch.search('zen art motorcycle')
// => [{ id: 2, title: '...', category: 'fiction', score: 2.77258, match: {...} }, ...]
```

Key RRF properties: scores are **rank-based** (no score normalization needed — that is the whole point vs. weighted-sum hybrids); documents appearing in multiple lists are boosted ("consensus"); lists must be over the same candidate universe or fusion degenerates to interleaving.

### Pitfalls

- **Fusing heuristics, not lists**: A2's kind-bucketed pseudo-RRF with a "heuristic ce constant" is not RRF — RRF requires *ranked lists over the same candidate set*, and its only constant is k (=60, not a tunable per-kind weight). Bucketing by kind then fusing is a hand-rolled weighted sum and will not reproduce RRF's consensus behavior.
- k tuning: k=60 is the empirical default; k too small lets one retriever dominate; too large flattens ranking. Don't expose per-kind "ce" constants pretending to be RRF.
- **Score mixing**: never average cosine (0..1) with BM25 (0..30+); that's the exact failure RRF avoids.
- Disjoint lists ⇒ RRF just interleaves (no fusion gain) — both retrievers must search the same doc set.
- Rerankers (Cohere Rerank https://cohere.com/rerank, Voyage https://docs.voyageai.com/docs/reranker) are API calls — fine server-side, not in a sandboxed iframe; client-side cross-encoders via transformers.js exist but are heavy (several MB).
- BM25 in MiniSearch: no stemming, no stopword list by default — identifiers and code-like text tokenize well, but you may want custom `processTerm`.
- Retrieving everything every keystroke is wasteful: cache index in memory, debounce queries.

### RapidTool recommendation

Replace FusionRank in `src/lib/algorithms.ts` (and wherever A2 ranking lives) with a true pipeline:

1. Keep candidate universe = the same items for both lists.
2. `keywordTopK(query, 20)` via MiniSearch over an in-memory index of project items (names, descriptions, code symbols).
3. `vectorTopK(query, 20)` via cosine similarity against stored embeddings (if none, fall back gracefully to keyword-only — don't fake it).
4. `rrfFuse([bm25List, vecList], k = 60)` — port the function above to TS verbatim, rank-1-indexed, dedupe by id.
5. Take top-K (start with 10; Anthropic found top-20 best when feeding an LLM) and only then apply any per-kind display logic *downstream* of ranking (buckets become a UI concern, not a scoring concern).
6. Delete the heuristic ce constant; if a tunable is ever needed, make it the cross-encoder rerank *threshold*, not an RRF weight. Optional later: contextualize chunk text (the prompt above) at index time.

---

## T3. Real browser sandboxing for generated/untrusted JS

### Best practice (with URLs)

There is **no way to safely run untrusted JS in the same origin/thread** — `new Function` + a substring denylist is a filter, not a sandbox, and filters are bypassable. Real sandboxes use one (or a composition) of:

**A. Web Worker + `terminate()` for hard timeouts (compute-only code).**
A Worker has no DOM access, and `terminate()` kills even a synchronous infinite loop — the only browser primitive that can. MDN: "The `terminate()` method ... immediately terminates the Worker. This does not offer the worker an opportunity to finish its operations; it is stopped at once." https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate

```javascript
const myWorker = new Worker("worker.js");
myWorker.terminate();   // (MDN example)
```

Create the worker from a `Blob` URL (`worker-src blob:` CSP), post the untrusted code as a *string* via `postMessage`, run it with `eval`/`new Function` *inside* the worker, `postMessage` the result back, and kill the worker on timeout — no denylist needed, because the worker has nothing sensitive to reach (structured-clone boundary: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm).

**B. Sandboxed iframe (needs DOM).**
`<iframe sandbox="allow-scripts" srcdoc="...">` gives the code a DOM with an **opaque origin**: no cookies, no localStorage, no parent access. Communication only via `postMessage` + `MessageChannel`. Critical rule: never add `allow-same-origin` together with `allow-scripts` (that combination re-enables full same-origin access — the classic escape). MDN iframe docs: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe (attributes `sandbox`, `csp`, `credentialless`). The `csp` attribute can lock the frame further (e.g. `script-src 'unsafe-inline'`+ nothing else, `connect-src 'none'`).

**C. WebAssembly-interpreter sandbox (quickjs-emscripten) for CPU/memory caps.**
QuickJS compiled to WASM runs untrusted JS with hard **interrupt (CPU-time) and memory limits** — the closest thing to a "256 MB / N sec" claim that is actually true. https://github.com/justjake/quickjs-emscripten — verbatim from its README:

```typescript
import { getQuickJS, shouldInterruptAfterDeadline } from "quickjs-emscripten"

getQuickJS().then((QuickJS) => {
  const result = QuickJS.evalCode("1 + 1", {
    shouldInterrupt: shouldInterruptAfterDeadline(Date.now() + 1000),
    memoryLimitBytes: 1024 * 1024,
  })
  console.log(result)
})
```

Per-runtime limits exist too: `runtime.setMemoryLimit(bytes)` and a `setInterruptHandler`. It supports ES2023-ish, browsers, workers, asyncify.

**D. What the real preview sandboxes do.** CodeSandbox **Sandpack** renders user code in a sandboxed iframe behind a bundler client (VM/Runtime clients, iframe preview, `postMessage` protocol): https://sandpack.codesandbox.io/docs/architecture/overview. StackBlitz **WebContainers** runs Node in the browser via a ServiceWorker + COOP/COEP + WASM filesystem (heavier; overkill for a REPL). Bolt/v0-style AI app generators use these same primitives. The industry consensus for "run this generated snippet" is: **worker for compute (killable), sandboxed iframe for DOM apps, quickjs-emscripten when you need memory/cpu accounting**, all behind a `postMessage` protocol — never `new Function` in the host page.

**E. CSP belts.** Page CSP should not need `'unsafe-eval'` at all once code runs in worker/iframe; if the host app needs eval, scope it. For the sandbox frame, `sandbox` attribute **is** the CSP: default denies everything not listed.

### Pitfalls

- **Denylists are bypassable** (obfuscation, `constructor.constructor`, unicode escapes, `import()` of data URLs, prototype tricks). Removing "dangerous" substrings is not a security control.
- **iframes cannot be time-outed**: replacing `srcdoc`/navigating does not stop a running synchronous loop until it yields — a `while(true){}` in an iframe pegs a CPU core and nothing can kill it. Only `Worker.terminate()` guarantees death. (If you need DOM *and* killability, run compute in the worker and mirror output into an iframe, or put quickjs in the iframe/worker.)
- **`allow-scripts` without `allow-same-origin`** = opaque origin: the frame's own `localStorage`/cookies are unavailable *and* `window.parent` access is blocked — that's intended; don't "fix" it by adding `allow-same-origin`.
- **Structured clone limits**: functions/classes can't cross postMessage; return JSON-serializable values, or the worker will throw `DataCloneError`.
- Message spoofing: verify `event.origin` (for iframes: the opaque origin is `"null"`) and use `MessageChannel`/tokens per run so stale workers can't inject results.
- `new Function`/`eval` inside the worker is fine security-wise but still violates a strict CSP (`worker-src`/`script-src`); sandboxed iframes may evaluate freely — they're already restricted by the sandbox attribute.
- Bundle cost: quickjs-emscripten WASM ~1 MB; load lazily.
- "256 MB / 30 s / no network" claims need an actual mechanism: memory = quickjs `memoryLimitBytes` or worker quota heuristics; time = deadline interrupt or `terminate()`; network = iframe `sandbox` (no `allow-same-origin` ⇒ no credentialed fetch; plus `connect-src 'none'` csp attr), or Worker (fetch exists but no cookies cross-origin... still, block by intercepting `fetch`/`WebSocket` in the wrapper).

### RapidTool recommendation

Rewrite `src/lib/sandbox.ts` around a **killable Worker protocol** (the console's generated JS is compute, not DOM apps):

- Worker created from `import.meta.url`-adjacent module or a small blob wrapper: listen for `{id, code}`; run `new Function('console','...api', code)` inside; return `{id, ok, value|error, logs}` (logs via a stub console that collects strings; keep values JSON-safe).
- Host wrapper `runSandboxed(code, {timeoutMs=5000})`: `worker.postMessage`, `Promise.race` with `setTimeout(() => worker.terminate(), timeoutMs)`; spawn a fresh worker per run (cheap, ~ms) so state and zombie timers never leak between runs; show an honest "killed after N s" error.
- Keep a separate `preview-host-bridge` iframe path (already present as `preview-host-bridge.tsx`) only for generated HTML/CSS previews: `sandbox="allow-scripts"` + `srcdoc`, `postMessage` with `event.origin === 'null'` checks, never `allow-same-origin`.
- If/when the console must cap *CPU* (a busy loop today is only bounded by the worker kill — fine) or expose richer built-ins safely, swap the inner executor to quickjs-emscripten in the worker (`shouldInterruptAfterDeadline` + `memoryLimitBytes`), which is the only way the "256 MB / 30 s" claims become true; until then delete those claims from docs/UI.
- CSP: `worker-src 'self' blob:; frame-src 'self' blob: data:`; drop `'unsafe-eval'` from the host page if present.
- Keep denylist only as a *linter* nicety ("looks suspicious"), never as the boundary.

---

## T4. SSR-hydration-safe client persistence (TanStack Start + zustand persist)

### Best practice (with URLs)

The canonical rules for client stores in SSR frameworks (Next.js guide applies 1:1 to TanStack Start):

1. **No module-level store singletons.** "The store should be created per request" — on the server a module singleton is shared across requests; on the client it causes hydration mismatches. Create the store with a factory and provide it via React context. https://zustand.docs.pmnd.rs/learn/guides/nextjs (official guide; verbatim excerpt below).
2. **Server output must equal first client render** — never let persisted (browser-only) data render during hydration. The React team's summary of mismatch causes includes "using browser-only APIs in rendering logic" and "rendering different data on the server and the client": https://react.dev/reference/react-dom/client/hydrateRoot
3. **Persisted slices hydrate *after* mount** — zustand `persist` supports `skipHydration: true` + manual `rehydrate()`; UI gates on a `hydrated` flag. https://zustand.docs.pmnd.rs/integrations/persisting-store-data
4. TanStack Start's own docs on hydration and client-only code: https://tanstack.com/start/latest/docs/framework/react/hydration — same SSR double-render model as Next; the official pattern for stores is the context provider one below.
5. TkDodo's "Avoiding hydration mismatches with useSyncExternalStore" is the canonical deep-dive on mount-guard + external-store patterns: https://tkdodo.eu/blog/avoiding-hydration-mismatches-with-use-sync-external-store

Official zustand snippet (https://zustand.docs.pmnd.rs/learn/guides/nextjs — creating a store per request + provider; excerpt):

```typescript
// src/stores/counter-store.ts
import { createStore } from 'zustand/vanilla'
export const createCounterStore = (initState: CounterState = defaultInitState) => {
  return createStore<CounterStore>()((set) => ({
    ...initState,
    incrementCount: () => set((state) => ({ count: state.count + 1 })),
  }))
}

// src/providers/counter-store-provider.tsx  ('use client')
export const CounterStoreProvider = ({ children }: CounterStoreProviderProps) => {
  const [store] = useState(() => createCounterStore())
  return <CounterStoreContext.Provider value={store}>{children}</CounterStoreContext.Provider>
}

export const useCounterStore = <T,>(selector: (store: CounterStore) => T): T => {
  const counterStoreContext = useContext(CounterStoreContext)
  if (!counterStoreContext) throw new Error(`useCounterStore must be used within CounterStoreProvider`)
  return useStore(counterStoreContext, selector)
}
```

Persist + SSR recipe (zustand persist docs, https://zustand.docs.pmnd.rs/integrations/persisting-store-data):

```typescript
// skip hydration on the server entirely, hydrate manually after mount:
export const useStore = create<State>()(
  persist(
    (set) => ({ ... }),
    {
      name: 'app-state',
      storage: createJSONStorage(() => localStorage), // browser-only: never touched during SSR
      skipHydration: true,
    },
  ),
)
// in a 'use client' effect after mount:
useStore.persist.rehydrate()
```

Extra safety layers: `createJSONStorage(() => localStorage)` already guards against SSR access (storage getter only runs client-side). If the persisted value can ever legitimately differ from server defaults, gate rendering behind a `hydrated` boolean set in the same effect and render server-identical markup until then. `suppressHydrationWarning` is a last resort (it only silences attribute/text mismatches on that element, React docs: https://react.dev/reference/react-dom/client/hydrateRoot#suppressing-unavoidable-hydration-mismatch-errors) — it does not fix event-handler misattachment risks.

### Pitfalls

- **Demo-seeding before first client render** (current RapidTool pattern) is the classic bug: seed executes during SSR render ⇒ server HTML has state A; client re-runs seed, persisted store hydrates state B ⇒ mismatch warnings, and React may attach handlers to the wrong DOM in the worst case.
- Seeding in a module top-level also runs *on the server* (and per request) — writes to IndexedDB/localStorage throw or no-op there.
- Store created at module scope + multiple route renders ⇒ state bleed across users/requests on the server.
- Persisting whole store including ephemeral UI state (active tab, transient input) ⇒ hydration churn and storage bloat; persist only durable slices (zustand persist supports `partialize`).
- `hasHydrated` render guards that return `null` server-side cause a *different* mismatch class (server renders null, client renders content post-hydration) — the mounted-gate must render the same thing on server and first client pass, then flip after mount (useEffect runs post-hydration, so it is safe).
- React 19 strict-mode double effects: rehydrate must be idempotent.

### RapidTool recommendation

In `src/lib/store.ts` and the route tree:

- Convert the store to a factory `createRapidStore(initialState)` + a `StoreProvider` component mounted once in `src/routes/__root.tsx` (inside the existing root layout, client-only boundary). Remove the module-level store singleton.
- Move **demo-project seeding** out of module scope into an effect in the provider that runs once after mount (post-rehydration), e.g. `if (!useStore.getState().seeded) seedDemoProject()`; SSR then always renders the empty/default state and the client's first render matches it exactly.
- Persist with `skipHydration: true` + explicit `rehydrate()` after mount; `partialize` to durable slices only (sessions/projects), excluding transient console input; gate any component that shows persisted-derived content on a `hydrated` flag from the store, flipping it in the same post-mount effect.
- Add a `createJSONStorage(() => localStorage)` (never `window` at module scope) so accidental SSR import can't throw.
- Verify by running the dev build with `react-dom` hydration warnings on and checking `grep -r "suppressHydrationWarning"` stays empty in new code.

---

## T5. zustand selector best practice (kill whole-store re-renders)

### Best practice (with URLs)

`useStore(selector)` re-renders only when the **selector's output** changes (compared with `Object.is` since v5 removed the default shallow-equality). So: always select narrow slices; never `useStore((s) => s)` unless the component truly needs everything; when the output is an object/array built by the selector, wrap the selector in `useShallow` so shallow-equality is used. Official docs:

- "Prevent rerenders with useShallow": https://zustand.docs.pmnd.rs/learn/guides/prevent-rerenders-with-use-shallow
- `useShallow` reference: https://zustand.docs.pmnd.rs/reference/hooks/use-shallow
- Transient updates (high-frequency state read without re-render): https://zustand.docs.pmnd.rs/learn/guides/transient-updates-for-often-occurring-state-changes

Verbatim from the official docs (https://zustand.docs.pmnd.rs/learn/guides/prevent-rerenders-with-use-shallow):

```typescript
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

const useMeals = create(() => ({
  papaBear: 'large porridge-pot',
  mamaBear: 'middle-size porridge pot',
  littleBear: 'A little, small, wee pot',
}))

export const BearNames = () => {
  // Without useShallow: Object.keys(state) is a NEW array every time,
  // so BearNames re-renders on ANY store change.
  const names = useMeals(useShallow((state) => Object.keys(state)))
  return <div>{names.join(', ')}</div>
}
```

Additional canon: selectors must be **stable/deterministic** — a selector that returns a fresh object every call (`(s) => ({a: s.a, b: s.b})`) without `useShallow` re-renders on every store update (Object.is fails). Vanilla `subscribe(listener)` still gives raw change events for imperative/throttled consumers. zustand v5 changelog notes the removal of the default shallow equality: https://github.com/pmndrs/zustand/releases (v5) — hence `useShallow` is now an explicit, importable util (`zustand/react/shallow`).

### Pitfalls

- `useStore((s) => s)` anywhere in a keystroke path ⇒ every keystroke updates the store ⇒ whole subtree re-renders. Classic offender: binding the textarea value to the root slice.
- Selector returning inline object/array (memoize or `useShallow`); with raw `useSyncExternalStore` (not via zustand's hook) an unstable getSnapshot causes an **infinite loop** — zustand's `useStore` doesn't loop but silently re-renders every update.
- Selecting then *computing* derived values in render without memoization defeats the purpose; derive with selectors that return primitives, or compute once with a selector + `useShallow`.
- Multi-store: separate concerns into separate stores (console input vs. project state) instead of one mega-store — fewer notifications per action.
- Don't shotgun `useShallow` on primitive selectors (unnecessary, slight overhead); do use it whenever output is compound.
- For console output lines that mutate per keystroke (thousands of entries), even narrow selectors re-render the list component on each update — use row-level memoized children or transient `subscribe` + external list virtualization.

### RapidTool recommendation

In `src/components/console.tsx` + `src/lib/store.ts`:

- Split the store along update-frequency lines: `consoleStore` (input text, cursor, output log — high frequency) vs. `projectStore` (projects, phases, agent runs — low frequency). If that's too invasive, keep one store but make every consumer select a primitive slice: `const text = useConsoleStore((s) => s.input)` for the textarea; the log view subscribes to `(s) => s.outputVersion` (a monotonically increasing counter) instead of the array reference, or uses `subscribe` + a `flushSync`-free append path.
- The tab bar and sidebar select `(s) => s.activeTabId` and `(s) => s.tabs` wrapped in `useShallow` for the array, so a keystroke in the console never re-renders chrome.
- Audit with React DevTools "Highlight updates" + a `useWhyDidYouUpdate` pass over console.tsx during typing; target: typing in the textarea re-renders ≤ 3 components.
- Add a lint rule (eslint-plugin-react-hooks exhaustive-deps is unrelated; use a convention + code review) banning `useStore((s) => s)` and banning unstabilized object selectors except behind `useShallow`.

---

## T6. Tab bar: ARIA tabs pattern vs. Radix Tabs (already installed)

### Best practice (with URLs)

Two valid roads:

**Road 1 — Radix Tabs** (dependency already installed per `package.json` deps: Radix pre-wired). Ships the full WAI-ARIA tabs pattern: `role=tablist/tab/tabpanel`, `aria-selected`, `aria-controls`/`aria-labelledby` wiring, roving `tabindex`, arrow-key/Home/End handling, orientation, activation modes — all verified and maintained. Docs + keyboard table: https://www.radix-ui.com/primitives/docs/components/tabs. Official example (verbatim excerpt):

```jsx
import { Tabs } from "radix-ui";

const TabsDemo = () => (
  <Tabs.Root className="TabsRoot" defaultValue="tab1">
    <Tabs.List className="TabsList" aria-label="Manage your account">
      <Tabs.Trigger className="TabsTrigger" value="tab1">Account</Tabs.Trigger>
      <Tabs.Trigger className="TabsTrigger" value="tab2">Password</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content className="TabsContent" value="tab1">
      <p>Make changes to your account here.</p>
    </Tabs.Content>
    <Tabs.Content className="TabsContent" value="tab2">
      <p>Change your password here.</p>
    </Tabs.Content>
  </Tabs.Root>
);
```

Radix keyboard behavior (docs table): Tab focuses active trigger → next Tab moves into active content; ArrowLeft/ArrowRight/Up/Down move and activate; Home/End first/last. Radix activation = automatic (selection follows focus) with manual optional via `activationMode="manual"`.

**Road 2 — hand-rolled WAI-ARIA APG pattern.** The APG "Tabs Pattern" is the normative spec: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ with a full runnable example (markup + JS): https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-automatic/. Required skeleton (from the example; condensed):

```html
<div role="tablist" aria-label="...">
  <button role="tab" id="tab-1" aria-selected="true" aria-controls="tabpanel-1" tabindex="0">…</button>
  <button role="tab" id="tab-2" aria-selected="false" aria-controls="tabpanel-2" tabindex="-1">…</button>
</div>
<div role="tabpanel" id="tabpanel-1" tabindex="0" aria-labelledby="tab-1">…</div>
<div role="tabpanel" id="tabpanel-2" tabindex="0" aria-labelledby="tab-2" hidden>…</div>
```

APG keyboard contract (automatic activation): Tab (into list ⇒ active tab; out of list ⇒ panel), ArrowLeft/Right move focus **and** activate, Home/End first/last; manual-activation variant (Space/Enter to activate) when panel content is expensive. Roving tabindex: selected tab `tabindex=0`, others `-1`. Panels focusable (`tabindex=0`) so screen-reader users can tab into content.

### Pitfalls

- 5 plain `<button>`s with no roles: screen readers announce a flat button list — no tab semantics, no arrow-key navigation, no selected state announced. (Buttons alone are acceptable only for *navigation between pages*, where ARIA tabs are actually an anti-pattern — APG says the tabs pattern is for switching content *within* a page.)
- Wrong roles: putting `role="tab"` on non-interactive elements, missing `aria-controls` targets, or panels without `aria-labelledby` ⇒ broken SR announcements.
- Missing `aria-selected` toggling or leaving every tab `tabindex=0` ⇒ keyboard focus trap/confusion.
- Hiding panels with `display:none` is fine and recommended (APG examples use a `hidden` class) — do *not* use `visibility` tricks that leave them focusable.
- Radix pitfalls: uncontrolled `defaultValue` vs controlled `value`+`onValueChange` mismatch when tab state lives in the zustand store (pick controlled, single source of truth); `Tabs.Content` unmounts inactive content by default (lazy or `forceMount` for keeping console iframes alive — relevant since console panels may hold live preview iframes; unmounting kills them).
- Testing: automated axe checks miss much of this; verify with NVDA/VoiceOver arrow-key behavior.

### RapidTool recommendation

- Adopt **Radix Tabs** in `src/components/console.tsx`: replace the 5 buttons with `<Tabs.Root value={activeTab} onValueChange={...}>` (controlled from the store slice `activeTabId` so URL/session persistence still works), `<Tabs.List aria-label="Console panels">`, `<Tabs.Trigger value="run|logs|files|db|settings">`, `<Tabs.Content>`.
- Because console panels can host live preview iframes/streams, set `forceMount` (or `lazyMount`+keep-mounted) on the preview panel so switching tabs doesn't reload the iframe; Radix keeps `aria-hidden` management correct while mounted.
- If the team prefers zero-dep, copy the APG automatic-activation example's ~40-line controller into a `useTabs` hook + the exact roles above — but given Radix is already installed, the Radix route is strictly less code to maintain and is what the APG "read me first" recommends for production.

---

## T7. PGlite persistence + migrations practice (browser Postgres)

### Best practice (with URLs)

PGlite is embedded Postgres (WASM) — official docs: https://pglite.dev/docs/ and repo: https://github.com/electric-sql/pglite. Key persistence facts (docs, https://pglite.dev/docs/filesystems — verbatim excerpts):

- **IndexedDB FS is the recommended browser persistence** ("We would recommend using the IndexedDB VFS in the browser at the current time as the OPFS VFS is not supported by Safari"). File-level flush: "The IndexedDB filesystem works at the file level, storing whole files (Postgres has a single file per table or index) as blobs... Flushing whole files can take a few milliseconds after each query" — mitigated by `relaxedDurability` mode (query returns immediately, flush scheduled async).

```js
// persist to IndexedDB (browser)
const db = new PGlite('idb://my-pgdata')

// or explicit FS
import { IdbFs } from '@electric-sql/pglite'
const db = new PGlite({ fs: new IdbFs('my-database') })
```

- **OPFS access-handle-pool FS** (`opfs-ahp://`) is faster but Worker-only and unsupported in Safari (252 sync-handle limit); the project ships a **multi-tab worker** to share one PGlite across tabs: https://pglite.dev/docs/multi-tab-worker (PGlite has a single exclusive connection — multi-tab needs the shared worker).
- Query API: `.query()` (parameterized) and `.exec()` (multi-statement — "perfect for migrations and batch inserts with raw SQL"): https://pglite.dev/docs/. Live reactive queries via the live-queries extension: https://pglite.dev/docs/live-queries.
- **Migrations**: generate SQL migrations with Drizzle Kit against the shared schema, apply at startup by executing the SQL files in order, tracked in a version table. Drizzle has a first-class PGlite setup guide: https://orm.drizzle.team/docs/get-started/pglite-new:

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'
export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
// generate: npx drizzle-kit generate   apply: npx drizzle-kit migrate
// driver at runtime:
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
const client = new PGlite(process.env.DATABASE_URL!)
const db = drizzle({ client })
```

Best practice for client-side migrations: keep migrations as **numbered SQL files in the repo** (RapidTool already uses `migrations/000N_*.sql`), and on app boot run `db.exec` of each not-yet-applied file inside a transaction, recording applied versions in a `_migrations` table; atomic because PGlite supports full Postgres transactions. Drizzle's `migrate()` (https://orm.drizzle.team/docs/migrations) can drive this from the generated journal if using Drizzle schema.
- Sync to a real server Postgres later: ElectricSQL builds live sync on top of PGlite (https://electric.ax/sync/pglite; https://pglite.dev/docs/live-queries) — same company, the upgrade path for "Neon dual driver" ambitions.

### Pitfalls

- **Single exclusive connection**: two tabs opening the same `idb://` DB concurrently corrupt/contend — use the multi-tab worker, or a BroadcastChannel "leader tab" pattern.
- IdbFs flushes whole files per change: many small writes ⇒ ms-level stalls; `relaxedDurability: true` trades crash-safety for responsiveness (acceptable for a console scratch DB; keep authoritative data in Neon).
- **Safari**: OPFS VFS broken; IndexedDB FS is the only safe browser choice today.
- Migration races on startup in multiple tabs; migrations must be idempotent-ish or single-runner-gated (version table + transaction).
- `.exec()` is non-parameterized — never interpolate user input into `.exec`; use `.query` with `$1` params.
- Don't block app start on full migration run for huge DBs; run async with a `ready` promise, show skeleton.
- WASM + bundlers: PGlite needs `vite`-friendly config (docs "bundler support" https://pglite.dev/docs/bundler-support); dynamic-import it only in client code to avoid SSR bundling issues (the WASM URL/`fs` resolution differs server-side — Node FS vs IdbFs).
- SSR: constructing `new PGlite('idb://...')` on the server throws — guard with `typeof window !== 'undefined'` **at call site** (module-level guard in `db.ts`, never during render).

### RapidTool recommendation

In `src/lib/db.ts` (dual Neon/PGLite driver):

- Split by environment at the boundary: a `getDb()` that returns the Neon client (server functions) or a **lazily-initialized PGlite singleton** `idb://rapidtool-console` (browser), created inside a `createClientOnlyDb()` guarded by `typeof window`, dynamic-imported (`await import('@electric-sql/pglite')`) so SSR bundles stay clean. Keep the SQL interface identical (both Postgres) so engine code is driver-agnostic.
- Boot sequence in the store provider (post-mount, topic 4): `await db.ready` → run pending migrations from `migrations/*.sql` (Vite `import.meta.glob('/migrations/*.sql', { query: '?raw', eager: false })`) inside `BEGIN; … COMMIT;` with a `_rapidtool_migrations` version table → then seed demo data only if empty.
- Enable `relaxedDurability: true` for console scratch writes; expose a "reset local DB" action that drops the `idb://` store.
- Migrations in dev: keep one canonical schema; use `drizzle-kit generate` locally, commit the SQL; the runtime applier runs the same files for users. No `drizzle-kit push` to production Neon without review.
- If multi-tab collaboration (topic 10) lands, move PGlite into the multi-tab worker so both tabs share one exclusive connection.

---

## T8. Agent packet / prompt-packet structure (context engineering, AGENTS.md conventions, format choice)

### Best practice (with URLs)

**The framing**: Anthropic's "Effective context engineering for AI agents" (Sep 2025) is the canonical essay: context is a finite "attention budget"; every token added depletes it; the goal is "the **smallest possible set of high-signal tokens**"; context rot makes long windows worse than they look (https://research.trychroma.com/context-rot). Concrete practices from the post (https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents):

- System prompts: organize into **distinct sections** — "like `<background_information>`, `<instructions>`, `## Tool guidance`, `## Output description`" — XML tags or Markdown headers; "striving for the minimal set of information that fully outlines your expected behavior" (minimal ≠ short); iterate from a minimal prompt and add only what fixes observed failures.
- Tools: token-efficient return values; small, non-overlapping tool sets; "curating a minimal viable set of tools".
- Examples: a few **diverse, canonical examples**, not a laundry list of edge cases.
- Message history is context: compaction, note-taking/memory, and sub-agent architectures (subagents "return only a condensed, distilled summary of its work (often 1,000–2,000 tokens)").

**Repo-convention files (AGENTS.md / CLAUDE.md)**: the industry has standardized repo-level agent instruction files with a strict "spec-driven, top-loaded, reference-dense" structure. Reference implementations:

- OpenAI's own AGENTS.md (contributor guide) — top-loaded policies, mandatory skills referenced as `$skill-name`, decision rules, verification gates, PR rules. https://github.com/openai/openai-agents-python/blob/main/AGENTS.md (excerpt below).
- The community spec site https://agents.md/ (structure recommendations), and ChatGPT's AGENTS.md support docs: https://learn.chatgpt.com/docs/agent-configuration/agents-md
- Anthropic's CLAUDE.md conventions (repo memory file with build/commands/code-style guidance, kept short, auto-loaded): https://www.anthropic.com/engineering/claude-code-best-practices
- RapidTool already ships `AGENTS.md` (workspace contract, skills routing, triage rules) and `AGENTS.project.md` at the repo root — that is the house style to mirror in generated packets.

Excerpt from OpenAI's AGENTS.md (https://raw.githubusercontent.com/openai/openai-agents-python/main/AGENTS.md):

```markdown
# Contributor Guide
**Location:** `AGENTS.md` at the repository root.
## Table of Contents
1. [Policies & Mandatory Rules](#policies--mandatory-rules)
2. [Code Review Rules](#code-review-rules)
3. [Project Structure Guide](#project-structure-guide)
4. [Operation Guide](#operation-guide)

## Policies & Mandatory Rules
### Mandatory Skill Usage
Repository skills are stored under `.agents/skills/`. A reference such as
`$<skill-name>` in this file is a repository instruction reference, not a
request for manual user invocation. When a rule requires a skill, read
`.agents/skills/<skill-name>/SKILL.md` completely before taking task actions...
```

**Format: structured vs markdown.** Two different jobs, two formats:

- Machine-readable contract (roles, IDs, budgets, deadlines, tool schemas, expected output shape) → **JSON / structured outputs** so it survives any prompt wrapper and is validatable: OpenAI structured outputs guide https://platform.openai.com/docs/guides/structured-outputs; schema-constrained output is more reliable than "please output JSON" for parsers.
- Instructions and prose for the model's judgment → **markdown with XML-tagged sections** (per Anthropic above). Anthropic explicitly recommends delimited sections and notes exact formatting matters less than separation and minimalism.
- Hybrid convention used by serious agent systems (and by this repo's own AGENTS.md): markdown prose instructions + JSON for anything programmatic, with examples as canonical few-shots.

**Grounding**: when a packet references repo/project facts, include source ids/paths and instruct the agent to cite them; external context should be *retrieved and attached* rather than recalled from model memory (grounded-citations practice: https://www.anthropic.com/engineering/building-effective-agents and the citations feature docs). Compression of a 14 KB packet: cut boilerplate, dedupe repeated instructions, move versioned/long reference material to a linked file (agents read on demand — same pattern as `.grok/references/*.md` in RapidTool's AGENTS.md), keep only the irreducible task contract inline.

### Pitfalls

- 14 KB of flat prose buries the actionable contract; models weight the **top and bottom** of context more (another reason to front-load identity/goals and end with the output contract).
- Mixing prose instructions with JSON fields the parser needs ⇒ double maintenance and drift; keep the parseable envelope separate from the instructable body.
- Unbounded packets grow every run (append-only logs, full file dumps) — enforce a byte/token budget per packet with a hard cap and a truncation policy (summarize oldest).
- Boilerplate repetition across packets (same 6 paragraphs of "you are helpful") wastes budget — keep a shared "core identity" that's identical across packets so prompt-caching (Anthropic prompt caching: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) can hit; vary only the tail.
- No grounding ⇒ hallucinated repo facts; require file:line or artifact ids in claims.
- Ignoring the host conventions (AGENTS.md of the target repo) ⇒ agents violate project rules; packet should *point to* AGENTS.md rather than duplicate it.
- JSON-only packets read poorly by models for judgment tasks; markdown-only packets parse poorly for tooling — the "both, separated" split is the best practice.

### RapidTool recommendation

Rebuild the packet builder in `src/lib/packet.ts` around a typed envelope + minimal prose:

```typescript
// [proposed] shape — keep packet ≤ ~2k tokens for the inline contract
type AgentPacket = {
  meta: { packetVersion: 1; role: 'builder'|'reviewer'|'planner'; modelHint?: string }
  mission: { goal: string; constraints: string[]; successCriteria: string[] }   // top-loaded
  contextRefs: { agentsMd?: true; files: Array<{ path: string; why: string }> }  // read-on-demand
  ground: Array<{ fact: string; source: string }>                                // file:id grounding
  output: { format: 'json'|'markdown'; schema?: unknown; maxTokens: number }     // contract at END
  examples?: string[]                                                             // ≤3 canonical
}
```

- Emit as a markdown doc with `<meta>`, `<mission>`, `<context>`, `<grounding>`, `<output>` sections so the prose stays sectioned (Anthropic), while `meta`/`output.schema` also exist as machine-readable JSON for the caller.
- Cap builder output: measure with the T1 tokenizer; if over cap, push the long reference material to a linked artifact (like `.grok/references/`) and say "read on demand".
- Align generated packets with the repo's own `AGENTS.md`/`AGENTS.project.md` conventions (skills routing syntax, "read before building" sections) so external agents behave like the in-repo ones; reference `AGENTS.project.md` instead of restating it.
- Add grounding: every packet gets a `ground` list of {fact, source:file/line or artifact id}; instruct agents to never assert ungrounded project state.

---

## T9. Context-window / token budgeting for multi-agent crews

### Best practice (with URLs)

Primary source: Anthropic, "How we built our multi-agent research system" (Jun 2025) — https://www.anthropic.com/engineering/multi-agent-research-system. Measured, transferable findings:

- **Token spend drives performance**: in their BrowseComp analysis, "token usage by itself explains **80 % of the variance**"; number of tool calls and model choice were the other factors. Multi-agent systems exist to "spend enough tokens to solve the problem" in parallel, isolated contexts.
- Costs are real: agents use ~**4× more tokens than chat**; multi-agent ~**15× more** — budget systems accordingly.
- **Orchestrator–worker with isolated contexts**: lead agent plans and delegates; subagents explore with their own full windows and return **condensed distillations (1,000–2,000 tokens)** — never raw transcripts. Subagent outputs can bypass the lead into **filesystem artifacts** to "minimize the game of telephone" (avoid copying large outputs through conversation history).
- **Prompt-encoded effort scaling**: "Simple fact-finding requires just 1 agent with 3–10 tool calls, direct comparisons 2–4 subagents with 10–15 calls each, complex research more than 10 subagents" — explicit scaling rules in the lead's prompt prevent both over- and under-spend (their early agents spawned 50 subagents for simple queries).
- Long-horizon: summarize completed phases into memory/notes before proceeding; spawn fresh subagents with clean contexts for continuity ("compaction", "checkpointing").
- Not a fit when agents must share one context or have tight inter-dependencies (e.g. most coding tasks).

Secondary sources for crew-style budgeting: LangChain's "Context engineering for agents" https://www.langchain.com/blog/context-engineering-for-agents; Vellum, "How to build multi-agent AI systems with context engineering" https://www.vellum.ai/blog/multi-agent-systems-building-with-context-engineering (shared context bus vs. isolation tradeoffs, budgeting per agent); Anthropic context-engineering post (T8) on subagent summaries and token-efficient tools.

Practical budgeting rules distilled across sources:

1. Global cap first: `totalBudget = f(taskValue)`; then role splits (planner ≤ 15 %, workers 70 %, synthesizer ≤ 15 % is a common heuristic — or simpler: per-worker equal shares of a workers pool).
2. Enforce at the **transport** layer: middleware that counts actual tokens (T1) per request and per session; hard-stop or auto-summarize at thresholds; never rely on the model to self-limit.
3. Shared context only for the plan; workers get task packets (T8), not the whole conversation.
4. Workers return artifacts/summaries, not transcripts; lead merges summaries.
5. Cap turns/tool calls per worker (budget unit = tokens + calls), matching Anthropic's scaling rules.
6. Model-tier budgeting: cheap model for high-volume filtering, expensive model for synthesis (Anthropic: "upgrading to Claude Sonnet 4 is a larger performance gain than doubling the token budget on Sonnet 3.7").
7. Monitor with per-crew telemetry (tokens by role, cost, dead-ends) and review budgets weekly against eval scores.

### Pitfalls

- No global cap ⇒ crews spend to context limit on trivial asks; encode effort scaling in prompts AND enforce caps in code (Anthropic's early failure: 50 subagents for a simple query).
- Sharing one giant context among crew members recreates the single-agent limit you were escaping and multiplies cost O(n × ctx).
- Workers returning full transcripts ⇒ the lead's context floods and "telephone game" degrades fidelity; require summaries/artifacts.
- Static per-role budgets ignore task variance — budget by *difficulty class* with prompt-scaling rules, then cap.
- Forgetting output-side tokens: budget must include the response; count messages, not just prompts.
- Seat budgets (1,800–3,200 tok) are far below model context windows — that's a *product* decision (fairness/cost per seat), so the enforcement point is a metering middleware + queueing, not prompt surgery.

### RapidTool recommendation

For the crew seats (1,800–3,200 tok) in the engine (`src/lib/engine.ts` / `phases.ts`):

- Introduce a `TokenBudget` middleware on every agent call: `spend(packetIn + modelReply)` metered with the T1 tokenizer, per seat; a seat at cap is paused and its accumulated state summarized to ≤ 300 tokens into the shared plan before it may continue (Anthropic compaction pattern).
- Set the seat split against a global run budget: planner 15 %, workers 70 %, synthesizer 15 %; enforce per-worker turn caps (e.g. 3–10 calls by task class, mirroring Anthropic's scaling rules in the orchestrator prompt).
- Workers receive T8 packets + write outputs as **artifacts** (PGlite rows) and return only condensed findings; the lead never receives raw worker logs.
- Track `{seat, inTokens, outTokens, calls, cost}` per run in PGlite and show the budget bar in the console UI (reuses T1 chip logic); log dead-ends for prompt iteration.
- Shared context = plan + phase checklist only; no transcript fan-out.

---

## T10. WebRTC mesh: relay reality + state-sync pattern for shared console sessions

### Best practice (with URLs)

**Connectivity reality**: WebRTC data channels are P2P where possible, but a meaningful share of pairs (symmetric NAT, enterprise firewalls) can *only* connect via a **TURN relay** — without TURN, "mesh w/ missing relay" fails for those pairs, silently (ICE just finds no candidate pair). Canonical explainer: https://bloggeek.me/webrtcglossary/turn/ ("When you need a TURN server... relay candidates as last resort; costs bandwidth through the relay"). Open-source TURN: coturn https://github.com/coturn/coturn. Mesh topology additionally scales O(n²) connections and is fine only for small rooms.

**Signaling**: peers need a rendezvous channel (WebSocket) to exchange SDP/ICE. Simplest credible option: **y-webrtc** — a Yjs connector that *includes* a tiny signaling server (one file) and defaults to public signaling servers, with optional password encryption over untrusted signaling (https://github.com/yjs/y-webrtc). Verbatim from its README:

```js
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'

const ydoc = new Y.Doc()
// clients connected to the same room-name share document updates
const provider = new WebrtcProvider('your-room-name', ydoc, { password: 'optional-room-password' })
const yarray = ydoc.get('array', Y.Array)
```

```sh
# start signaling server  (the repo ships one)
PORT=4444 node ./bin/server.js
```

Same README on mesh limits: "Not suited for a large amount of collaborators on a single document (each peer is connected to each other)"; default `maxConns: 20 + Math.floor(random.rand() * 15)`; same-browser tabs sync via **BroadcastChannel** without WebRTC. PeerJS (https://peerjs.com) is the other common shortcut (hosted cloud signaling + optional TURN); plain `RTCPeerConnection` + custom WS is the from-scratch route.

**State-sync pattern choice** (the actual research question). Three families:

1. **Authoritative-host snapshot + delta / op log** — one host owns state; clients send intents; host applies, broadcasts ordered ops (`seq`), periodic full snapshots (every N ops or on join) for resync. Standard for games/netcode (e.g. netcode snapshot/RPC patterns: https://medium.com/@geretti/netcode-series-part-2-data-channels-c12e9a238800) and for anything needing deterministic replay — which a *shared console session* wants (replay the exact op sequence).
2. **CRDT (Yjs/Automerge)** — no host, offline-capable, converges automatically; ideal for collaborative *text/rich documents*; Yjs over WebRTC = y-webrtc above. Costs: op metadata overhead, weaker story for "authoritative single writer" semantics and arbitrary imperative state (running a console is imperative).
3. **Hybrid (common in production)**: CRDT for editable shared text, authoritative op-log for execution state (which tab's run is live, DB writes), snapshots for joiners.

For a console session the widely-used shape is: **one host (session owner) authoritative over the execution engine; all state mutations flow as ordered ops with a monotonically increasing seq; subscribers get {since, ops} deltas and a snapshot on (re)join; heartbeat + seq-gap detection triggers snapshot resync**. This is the pattern y-webrtc's BroadcastChannel+mesh transport would carry, with Yjs used only if viewers may *edit* the same transcript simultaneously (collaborative REPL = genuinely concurrent text → Yjs is the right call then).

### Pitfalls

- No TURN ⇒ intermittent "works on my Wi-Fi, fails from mobile/office" (classic symptom; https://bloggeek.me/webrtcglossary/turn/); production needs a coturn instance or managed TURN — peer-to-peer claims without relay are fiction for general audiences (same class of fiction as the sandbox claims in T3).
- Mesh + N peers = N² connections; cap peers, or fall back to a host-relay (star) mode for larger rooms.
- Public y-webrtc signaling servers are demo-grade; self-host `bin/server.js` (it's tiny) or run PeerJS cloud for v0.
- No snapshot mechanism ⇒ a joiner mid-session must replay the whole op log or never converges (y-webrtc handles this for Yjs docs; a custom op-log needs explicit snapshotting).
- Ordering: without a single sequencer, ops interleave ⇒ nondeterministic console state; pick host-sequenced ops for anything affecting execution, not last-write-wins.
- localStorage/IDB contention when two tabs write the same PGlite DB (T7) — the shared session makes this likely; route DB writes through the host only.
- Awareness (presence/cursors) is separate from document sync — y-protocols Awareness for presence: https://github.com/yjs/y-protocols.

### RapidTool recommendation

If shared console sessions are adopted:

- **Phase 0 (cheap)**: same-browser multi-tab via BroadcastChannel + the host-authoritative engine (no WebRTC at all) — proves the sync protocol.
- **Phase 1 (real rooms)**: host-authoritative **snapshot + delta op-log**: session owner runs the engine; ops `{seq, type, payload}` broadcast over a WebRTC mesh (y-webrtc-style signaling, self-hosted tiny WS server or PeerJS cloud); joiners fetch `{lastSeq, snapshot}` from the host; heartbeat + gap ⇒ resync. Store the op log in PGlite for replay.
- **Phase 2 (collaborative transcript editing)**: add Yjs only for the transcript/textarea layer (CRDT), keep engine ops host-sequenced.
- Run a coturn (or managed TURN) before telling users multiplayer works; show an honest "relay required" state in ICE diagnostics.
- DB writes (T7) remain host-only; viewers read via replicated state, never by opening the same `idb://` store.

---

## Top picks — ranked shortlist for the 10 enhancements

1. **T3 Real sandbox (Worker + terminate + honest limits)** — closes a real security hole (`new Function` + denylist is theater) and is self-contained: rewrite `src/lib/sandbox.ts` (~1 day). Highest risk today.
2. **T1 Real token counting (gpt-tokenizer)** — small, mechanical, removes a misleading number from the UI and unblocks T9 budgeting: replace `estimateTokens` in `algorithms.ts`. Highest correctness-per-hour.
3. **T4 SSR-safe persistence (store factory + provider + post-mount seed/hydrate)** — fixes hydration mismatches at the architecture level; prerequisite for T5–T7 UI work in `store.ts`/`__root.tsx`.
4. **T2 True RRF + hybrid ranking** — replace pseudo-RRF with MiniSearch BM25 + `rrfFuse(k=60)` in `algorithms.ts`; no new infra, ~½–1 day. Delete the ce heuristic.
5. **T5 zustand selector discipline** — keystroke re-render fix via narrow selectors + `useShallow` + store split in `console.tsx`/`store.ts`; do together with T4 (same files).
6. **T7 PGlite persistence + migration runner in `db.ts`** — makes the existing in-memory PGlite real (idb://, relaxed durability, `import.meta.glob` migration applier with version table); moderate effort, big demo value.
7. **T6 Radix Tabs for the console tab bar** — small, dependency already installed; combine with T5's store slices.
8. **T9 Crew token budgeting (metering middleware + per-seat caps + summaries)** — build on T1's tokenizer; product-level fairness feature with measurable cost control.
9. **T8 Packet redesign (typed envelope + sectioned markdown + grounding + ≤2k-token cap)** — pure `packet.ts` rewrite; improves external agent output quality immediately and aligns with the repo's own AGENTS.md conventions.
10. **T10 WebRTC shared sessions** — largest scope, blocked on infra decisions (TURN, signaling host); start with the BroadcastChannel phase-0 only when the first nine are in.

---

### Source index (URLs cited above, by topic)

T1: github.com/openai/tiktoken · github.com/niieani/gpt-tokenizer · github.com/dqbd/tiktoken · developers.openai.com/cookbook/examples/how_to_count_tokens_with_tiktoken · help.openai.com/en/articles/4936856 · zats.io/blog/counting-tokens-in-foundation-models
T2: anthropic.com/engineering/contextual-retrieval · cormack.uwaterloo.ca/cormacksigir09-rrf.pdf · glaforge.dev (RRF post) · mongodb.com/resources/basics/reciprocal-rank-fusion · qdrant.tech/course (hybrid demo) · github.com/lucaong/minisearch · huggingface.co/docs/transformers.js · cohere.com/rerank · docs.voyageai.com/docs/reranker
T3: developer.mozilla.org/en-US/docs/Web/API/Worker/terminate · developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe · github.com/justjake/quickjs-emscripten · sandpack.codesandbox.io/docs/architecture/overview · developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
T4: zustand.docs.pmnd.rs/learn/guides/nextjs · zustand.docs.pmnd.rs/integrations/persisting-store-data · react.dev/reference/react-dom/client/hydrateRoot · tanstack.com/start/latest/docs/framework/react/hydration · tkdodo.eu/blog/avoiding-hydration-mismatches-with-use-sync-external-store
T5: zustand.docs.pmnd.rs/learn/guides/prevent-rerenders-with-use-shallow · zustand.docs.pmnd.rs/reference/hooks/use-shallow · zustand.docs.pmnd.rs/learn/guides/transient-updates-for-often-occurring-state-changes · github.com/pmndrs/zustand/releases
T6: radix-ui.com/primitives/docs/components/tabs · w3.org/WAI/ARIA/apg/patterns/tabs/ · w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-automatic/
T7: pglite.dev/docs/ · pglite.dev/docs/filesystems · pglite.dev/docs/multi-tab-worker · pglite.dev/docs/live-queries · pglite.dev/docs/bundler-support · orm.drizzle.team/docs/get-started/pglite-new · orm.drizzle.team/docs/migrations · electric.ax/sync/pglite · github.com/electric-sql/pglite
T8: anthropic.com/engineering/effective-context-engineering-for-ai-agents · research.trychroma.com/context-rot · github.com/openai/openai-agents-python (AGENTS.md) · agents.md · learn.chatgpt.com/docs/agent-configuration/agents-md · anthropic.com/engineering/claude-code-best-practices · platform.openai.com/docs/guides/structured-outputs · docs.anthropic.com/en/docs/build-with-claude/prompt-caching
T9: anthropic.com/engineering/multi-agent-research-system · anthropic.com/engineering/effective-context-engineering-for-ai-agents · langchain.com/blog/context-engineering-for-agents · vellum.ai/blog/multi-agent-systems-building-with-context-engineering
T10: github.com/yjs/y-webrtc · github.com/yjs/y-protocols · bloggeek.me/webrtcglossary/turn/ · github.com/coturn/coturn · peerjs.com · medium.com/@geretti/netcode-series-part-2-data-channels-c12e9a238800

---
*Research compiled Sep 2026. Snippets marked verbatim were copied from the cited pages at compile time; `[proposed]` blocks are new code suggested for RapidTool.*




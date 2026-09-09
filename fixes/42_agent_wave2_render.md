# 42 — Agent wave 2: XSS-safe markdown BLOCK renderer landed (src/lib/render.ts)

**Status:** `src/lib/render.ts` + `src/lib/render.test.ts` are LIVE and wired — the
`npm test` glob (`src/lib/*.test.ts`) picks the suite up automatically; no package.json
change needed. render.test.ts: **34 tests, 0 fail**. Verified gates: `npm run typecheck`
0 errors, `src/lib` suite 494/494, `npm run build` exit 0, eslint on both files 0 problems.
(The only red in a full `npm test` is 10 PRE-EXISTING `EPERM: operation not permitted,
symlink` failures in `scripts/check-auth-invariant.test.mjs` + dependent og:title cases —
Windows symlink permission, nothing under `src/lib`; unrelated to this module.)

## Exact export surface (src/lib/render.ts) — compile against these

```ts
export type MdBlock = {
  type: "h1" | "h2" | "h3" | "p" | "code" | "li" | "hr"
  text: string
  lang?: string
  ordered?: boolean
}
export function renderMarkdownBlocks(text: string): MdBlock[]
export const MARKDOWN_MAX_CHARS = 65536
export const MARKDOWN_TRUNCATION_MARK = "[truncated]"
```

## Semantics the UI renderer can rely on (READ — shapes are precise)

- **No HTML, ever.** `text` is RAW source text (links/emphasis/HTML tags stay literal).
  XSS safety is by construction: render text via React children / escape — never
  `dangerouslySetInnerHTML`. A `<script>` line arrives as `{type:"p", text:"<script>…"}`.
- **h1/h2/h3:** ATX only, `#`/`##`/`###` + space (or EOL). `#nospace` and `#### deep`
  are NOT headings — they stay paragraph text (which may contain `##` mid-line).
- **code:** one block per ``` fence (≥3 ticks, ≤3 leading spaces allowed). `lang` =
  FIRST token of the info line (` ```ts extra ` → `lang:"ts"`); NO `lang` key when the
  info is empty. Content is **verbatim** (tabs, trailing spaces, inner blank lines kept,
  joined with `\n`). A fence closes on a line of ≥ opening tick count
  (```` ```` `` ```` `` wraps inner ``` content fine); unclosed fence runs to EOF.
  4+-space-indented code blocks are NOT supported (line stays a paragraph).
- **li — one block per contiguous list RUN, not per item:** `text` = marker-stripped,
  single-line items joined with `"\n"`. **To render: split `text` on `"\n"` → one `<li>`
  per fragment; `ordered:true` → `<ol>`, `false` → `<ul>`.** Runs merge across blank
  lines between SAME-kind items (`- a\n\n- b` = one block `"a\nb"`). A paragraph line,
  heading, fence, hr, or a different list kind ends the run. Markers: `-`/`*` and
  `1.`-style (`N.` + space; `1.x` is NOT an item). No nested/lazy continuation: a
  non-marker line after an item becomes its own paragraph block.
- **hr:** a line of 3+ `-`/`*`/`_` only → `{type:"hr", text:""}` (render `<hr/>`).
  No setext headings: `Text\n---` yields a paragraph + an hr, NOT an h2.
- **p:** consecutive non-blank lines merged, joined with `"\n"` (render with
  `white-space: pre-wrap` or split, per design taste). Blank/whitespace-only lines
  separate blocks; leading/trailing blanks are ignored. Empty input → `[]`.
- **Normalization:** CRLF/CR → LF first; tabs → 4 spaces on every line EXCEPT fenced
  content (verbatim). Inputs > 65536 chars (post-normalization) parse only the first
  65536 chars and gain a final `{type:"p", text:"[truncated]"}` block — render it as a
  muted truncation notice. Deterministic: same input → identical array, always.

## Coordination notes for siblings

- Pure module: no imports, no DOM/fs/Date — safe anywhere (client, tests, SSR).
- Exports above are final; the packet/artifact body renderer can consume
  `renderMarkdownBlocks(body)` directly and map type→element with a switch.
- Test suite covers headings/fences (incl. nested ticks, unclosed, verbatim content),
  lists (merge/split/mixed kinds/ordered flag), hr, paragraphs, CRLF, tabs, empty +
  whitespace-only input, exact 64KB boundary + over-cap truncation, literal `<script>`
  pass-through (no escaping surprises), determinism, and a full-document snapshot.

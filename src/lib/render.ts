// ---------------------------------------------------------------------------
// render.ts — XSS-safe markdown BLOCK parser for packet/artifact bodies.
//
// Pure, deterministic, zero dependencies, no DOM. This module NEVER emits
// HTML: it returns typed MdBlock records whose `text` is RAW source text.
// XSS safety is by construction — the caller renders React elements (text
// nodes escape automatically); there is no HTML escape hatch here. Inline
// markdown (links, emphasis, code ticks) and HTML tags are intentionally NOT
// interpreted: they stay literal text inside their block.
//
// Block grammar (the sibling UI renders these EXACT shapes):
//   - h1/h2/h3  ATX headings: 1-3 leading "#" followed by whitespace/EOL
//               (#foo or #### bar are NOT headings — they are paragraphs).
//   - code      ```-fenced blocks, >=3 ticks; lang = FIRST token of the info
//               string (```ts json → lang "ts"). Content is verbatim (tabs,
//               trailing spaces, blank lines preserved). A fence closes on a
//               line of >= opening tick count; unclosed fences run to EOF.
//               Indented code blocks are NOT supported (4+ leading spaces
//               keep the line a paragraph).
//   - li        One block per contiguous list RUN. Items are marker-stripped,
//               single-line, joined with "\n" — split on "\n" to render <li>s.
//               unordered (-/*) → ordered:false; ordered ("N.") → ordered:true.
//               Blank lines between SAME-kind items keep the run alive; any
//               other line (different list kind, paragraph text, heading,
//               fence, hr) ends it. Lazy/nested continuation is NOT supported:
//               a non-marker line after an item starts its own paragraph.
//   - hr        A line of 3+ "-"/"*"/"_" only (=== setext headings are NOT
//               parsed: "Text\n---" → p + hr). hr.text is always "".
//   - p         Consecutive non-blank lines merged, joined with "\n".
//               Blank/whitespace-only lines separate blocks.
//
// Normalization: CRLF and lone CR → LF first; tabs expand to 4 spaces on
// every line EXCEPT fenced-code content (verbatim). Inputs longer than
// MARKDOWN_MAX_CHARS are parsed from the first MARKDOWN_MAX_CHARS chars and
// get a final p block MARKDOWN_TRUNCATION_MARK. Deterministic: same input →
// identical output, always.
//
// Run: node --experimental-strip-types --test src/lib/render.test.ts
// ---------------------------------------------------------------------------

/** One block of a parsed markdown body. `text` is RAW source text — the
 *  renderer must escape it (React text nodes do this automatically). */
export type MdBlock = {
  type: "h1" | "h2" | "h3" | "p" | "code" | "li" | "hr"
  text: string
  lang?: string
  ordered?: boolean
}

/** Inputs longer than this (chars, after CRLF/CR normalization) are truncated
 *  to this many chars and marked with a trailing "[truncated]" paragraph. */
export const MARKDOWN_MAX_CHARS = 65536
export const MARKDOWN_TRUNCATION_MARK = "[truncated]"

type ListKind = "unordered" | "ordered"

const TAB_WIDTH = 4
const UNORDERED_ITEM = /^ {0,3}[-*](?:[ \t]+(.*))?$/
const ORDERED_ITEM = /^ {0,3}[0-9]{1,9}\.(?:[ \t]+(.*))?$/
const HR = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/
const HEADING = /^ {0,3}(#{1,3})(?:[ \t](.*))?$/
const FENCE_OPEN = /^ {0,3}(`{3,})(.*)$/
const FENCE_CLOSE = /^ {0,3}(`+)[ \t]*$/
const ATX_KINDS = ["h1", "h2", "h3"] as const

function expandTabs(line: string): string {
  return line.includes("\t") ? line.replace(/\t/g, " ".repeat(TAB_WIDTH)) : line
}

function isBlank(line: string): boolean {
  return line.trim().length === 0
}

/** Opening fence info: lang = first whitespace token, undefined when absent.
 *  Info strings containing a backtick (or no info) are not fences. */
function fenceOpenOf(line: string): { ticks: number; lang?: string } | null {
  const m = FENCE_OPEN.exec(line)
  if (m === null) return null
  const info = m[2].trim()
  if (info.includes("`")) return null
  if (info.length === 0) return { ticks: m[1].length }
  return { ticks: m[1].length, lang: info.split(/[ \t]+/, 1)[0] }
}

function isFenceClose(line: string, openTicks: number): boolean {
  const m = FENCE_CLOSE.exec(line)
  return m !== null && m[1].length >= openTicks
}

function headingOf(line: string): { kind: (typeof ATX_KINDS)[number]; text: string } | null {
  const m = HEADING.exec(line)
  if (m === null) return null
  return { kind: ATX_KINDS[m[1].length - 1], text: (m[2] ?? "").trim() }
}

function itemOf(line: string): { kind: ListKind; text: string } | null {
  const u = UNORDERED_ITEM.exec(line)
  if (u !== null) return { kind: "unordered", text: (u[1] ?? "").trimEnd() }
  const o = ORDERED_ITEM.exec(line)
  if (o !== null) return { kind: "ordered", text: (o[1] ?? "").trimEnd() }
  return null
}

function isStructural(line: string): boolean {
  return (
    fenceOpenOf(line) !== null ||
    HR.test(line) ||
    headingOf(line) !== null ||
    itemOf(line) !== null
  )
}

/**
 * Parse markdown-ish packet/artifact text into display blocks.
 *
 * Deterministic and side-effect free. Never returns HTML — the caller maps
 * MdBlock records onto React elements (escaping happens in React).
 */
export function renderMarkdownBlocks(text: string): MdBlock[] {
  if (typeof text !== "string" || text.length === 0) return []
  const normalized = text.replace(/\r\n?/g, "\n")
  const truncated = normalized.length > MARKDOWN_MAX_CHARS
  const source = truncated ? normalized.slice(0, MARKDOWN_MAX_CHARS) : normalized
  const raw = source.split("\n")
  const lines = raw.map(expandTabs)
  const blocks: MdBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (isBlank(line)) {
      i += 1
      continue
    }

    // Fenced code: content is verbatim (raw line, tabs/trailing spaces kept)
    // until a closing fence of >= opening tick count, or EOF.
    const fence = fenceOpenOf(line)
    if (fence !== null) {
      const content: string[] = []
      i += 1
      while (i < lines.length && !isFenceClose(lines[i], fence.ticks)) {
        content.push(raw[i])
        i += 1
      }
      if (i < lines.length) i += 1 // consume the closing fence line
      blocks.push({
        type: "code",
        text: content.join("\n"),
        ...(fence.lang !== undefined ? { lang: fence.lang } : {}),
      })
      continue
    }

    if (HR.test(line)) {
      blocks.push({ type: "hr", text: "" })
      i += 1
      continue
    }

    const heading = headingOf(line)
    if (heading !== null) {
      blocks.push({ type: heading.kind, text: heading.text })
      i += 1
      continue
    }

    // List run: consecutive same-kind items merge into ONE li block; blank
    // lines between same-kind items keep the run alive. Items are
    // marker-stripped single lines joined with "\n".
    const item = itemOf(line)
    if (item !== null) {
      const items = [item.text]
      let j = i + 1
      while (j < lines.length) {
        if (isBlank(lines[j])) {
          let k = j
          while (k < lines.length && isBlank(lines[k])) k += 1
          if (k < lines.length && itemOf(lines[k])?.kind === item.kind) {
            j = k // blank-separated same-kind item: keep the run alive
            continue
          }
          break
        }
        const next = itemOf(lines[j])
        if (next !== null && next.kind === item.kind) {
          items.push(next.text)
          j += 1
          continue
        }
        break
      }
      blocks.push({ type: "li", text: items.join("\n"), ordered: item.kind === "ordered" })
      i = j
      continue
    }

    // Paragraph: merge consecutive non-blank non-structural lines.
    const para: string[] = []
    while (i < lines.length) {
      const cur = lines[i]
      if (isBlank(cur) || isStructural(cur)) break
      para.push(cur.trimEnd())
      i += 1
    }
    blocks.push({ type: "p", text: para.join("\n") })
  }

  if (truncated) blocks.push({ type: "p", text: MARKDOWN_TRUNCATION_MARK })
  return blocks
}

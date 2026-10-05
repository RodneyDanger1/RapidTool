// ---------------------------------------------------------------------------
// vector.ts — LLM-as-designer vector/logo/icon/badge generation (G-37/G-38).
//
// HONEST ARCHITECTURE (research/multiagent/13_top20_gaps.md G-37 §G-37, verified
// in 15_feasibility_review.md): DeepSeek is TEXT-ONLY — there is no image
// endpoint on this key. The model therefore DESIGNS: it emits a compact SVG
// markup string + palette hexes inside a JSON envelope; THIS module renders.
// Every byte the model produced passes through `sanitizeSvg` (the only
// defense — there is no CSP, see feasibility C-6) or is never returned.
//
//   generateLogo(project, brief?, style?)   → one brand mark   (LLM, json:true)
//   generateIconSet(project, concept, count)→ N named glyphs    (LLM, json:true)
//   generateBadge(text, tone?, palette?)    → deterministic badge (NO LLM)
//   geometricMonogram(name, seed?, tokens?) → deterministic floor (NO LLM)
//
// Deterministic-floor rule (same rule as crew.server.ts:18-21): no
// DEEPSEEK_API_KEY → the LLM path is never faked; generateLogo/generateIconSet
// return a machine-declared `source:"deterministic"` asset whose `note` names
// "not-configured". LLM output that fails the sanitizer, fails JSON shape, or
// paints colors outside its declared palette is ALSO never returned — the same
// deterministic floor takes over with an evidence note. Real API failures
// (timeout/HTTP/billing) surface as { ok:false, reason:"error" }.
//
// EXACT EXPORT SURFACE (CLI/headless/UI agents compile against these — do not
// rename, keep semantics stable):
//
//   export type SanitizeResult
//   export function sanitizeSvg(input: string): SanitizeResult
//   export function svgToDataUrl(svg: string): string | null
//   export function usedHexColors(svg: string): string[]
//   export type LogoResult
//   export function generateLogo(project, brief?, style?): Promise<LogoResult>
//   export type IconGlyph / IconSetResult
//   export function generateIconSet(project, concept, count): Promise<IconSetResult>
//   export function generateBadge(text, tone?, tokens?): string
//   export function geometricMonogram(name, seed?, tokens?): string
//   export function promptLogo(project, brief?, style?): string
//   export const BADGE_TONES
//
// Zero new dependencies; importable from client code (the DeepSeek provider is
// reached only via dynamic import inside the async generators, mirroring
// headless.ts's key seam). Pure + deterministic unless the function name says
// "generate": same inputs ⇒ same bytes for sanitizeSvg, geometricMonogram,
// generateBadge, promptLogo. No Date.now(), no Math.random, no network.
// ---------------------------------------------------------------------------
import { fnv1a } from "./algorithms.ts";
import { designTokens } from "./design.ts";
import type { Project } from "./types.ts";

// ---------------------------------------------------------------------------
// Limits (sanitizer contract)
// ---------------------------------------------------------------------------

/** Hard cap on raw model output we will even parse. */
export const VECTOR_MAX_INPUT_CHARS = 24_000;
/** Max nested element depth (root <svg> counts as 1). */
export const VECTOR_MAX_DEPTH = 8;
/** Max total elements per document. */
export const VECTOR_MAX_ELEMENTS = 96;
/** Coordinate/geometry clamp (±). */
export const VECTOR_CLAMP = 4096;
/** Max declared palette entries returned to callers. */
export const VECTOR_MAX_PALETTE = 8;

export const LOGO_VIEWBOX = "0 0 96 96";
export const ICON_VIEWBOX = "0 0 24 24";

// ---------------------------------------------------------------------------
// Allowlists (strict, lowercase). Anything off-list is rejected or stripped —
// never passed through. Sanitizer rebuilds every document from these tables,
// so NO attribute, entity, or element can survive outside the whitelist.
// ---------------------------------------------------------------------------

/** Presentation attrs legal on any drawn shape + <g>. */
const PRESENTATION = new Set([
  "fill",
  "stroke",
  "stroke-width",
  "fill-opacity",
  "transform",
]);

/** Per-tag attribute allowlist. Keys are the whitelisted tags. */
const ALLOWED_ATTRS: Record<string, ReadonlySet<string>> = {
  svg: new Set(["xmlns", "viewBox"]),
  g: PRESENTATION,
  rect: new Set(["x", "y", "width", "height", "rx", "ry", ...PRESENTATION]),
  circle: new Set(["cx", "cy", "r", ...PRESENTATION]),
  ellipse: new Set(["cx", "cy", "rx", "ry", ...PRESENTATION]),
  line: new Set(["x1", "y1", "x2", "y2", ...PRESENTATION]),
  path: new Set(["d", ...PRESENTATION]),
  polygon: new Set(["points", ...PRESENTATION]),
  text: new Set([
    "x",
    "y",
    "font-size",
    "font-family",
    "text-anchor",
    ...PRESENTATION,
  ]),
  defs: new Set<string>([]),
};

/** Tags the model may emit. Anything else ⇒ whole document rejected. */
const ALLOWED_TAGS = new Set(Object.keys(ALLOWED_ATTRS));

/** Tags that may never contain child elements. */
const LEAF_TAGS = new Set([
  "rect",
  "circle",
  "ellipse",
  "line",
  "path",
  "polygon",
]);

const SVG_NS = "http://www.w3.org/2000/svg";

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const NUMBER_RE = /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/;
/** Prefix form of NUMBER_RE for tokenizing numbers out of longer strings. */
const NUMBER_PREFIX_RE = /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?/;
/** Path data charset — 'j'/'u'/'r' (javascript/url) cannot even appear. */
const PATH_CHARSET = /^[MmLlHhVvCcSsQqTtAaZz0-9\s.,+\-eE]+$/;
const POINTS_CHARSET = /^[0-9\s.,+\-eE]+$/;
/** <text> content/font-family charset guard (letters, digits, space, , ' - .). */
const FONT_FAMILY_RE = /^[A-Za-z0-9 ,'.-]+$/;
const TEXT_ANCHORS = new Set(["start", "middle", "end"]);

const TRANSFORM_FNS = new Set([
  "translate",
  "rotate",
  "scale",
  "skewX",
  "skewY",
  "matrix",
]);

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

function fmtNum(x: number): string {
  const r = Math.round(x * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
}

/** Strip XML control characters that are invalid in XML 1.0. */
function stripControl(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}

/** Escape text/attr content for XML emission (& first). */
function xmlEscape(s: string): string {
  return stripControl(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Decode the five XML entities; reject any other reference. Returns null. */
function decodeEntities(s: string): string | null {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const amp = s.indexOf("&", i);
    if (amp === -1) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, amp);
    const m = /^&(amp|lt|gt|quot|apos);/.exec(s.slice(amp));
    if (!m) return null; // raw & or numeric/unknown entity ⇒ reject
    out +=
      m[1] === "amp"
        ? "&"
        : m[1] === "lt"
          ? "<"
          : m[1] === "gt"
            ? ">"
            : m[1] === "quot"
              ? '"'
              : "'";
    i = amp + m[0].length;
  }
  return out;
}

/** Normalize a hex color (#rgb → #rrggbb, lowercase). Null when invalid. */
function normalizeHex(raw: string): string | null {
  const m = HEX_RE.exec(raw.trim());
  if (!m) return null;
  if (m[1].length === 3) {
    const [a, b, c] = m[1];
    return `#${a}${a}${b}${b}${c}${c}`.toLowerCase();
  }
  return `#${m[1]}`.toLowerCase();
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Parse a finite number, clamp into [lo, hi]; null on garbage/NaN/Infinity. */
function numValue(raw: string, lo: number, hi: number): number | null {
  const v = raw.trim();
  if (!NUMBER_RE.test(v)) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return clamp(n, lo, hi);
}

// ---------------------------------------------------------------------------
// Sanitizer
// ---------------------------------------------------------------------------

export type SanitizeResult =
  | { ok: true; svg: string }
  | { ok: false; reason: string };

type ParsedAttr = { name: string; value: string };
type ParsedEl = { tag: string; attrs: ParsedAttr[]; selfClose: boolean };

/** Canonical value for one allowlisted attribute, or null to reject. */
function canonicalAttr(
  _tag: string,
  name: string,
  rawValue: string,
): string | null {
  const v = rawValue.trim();
  if (v === "") return null;
  switch (name) {
    case "xmlns":
      return v === SVG_NS ? SVG_NS : null;
    case "viewBox": {
      const parts = v.split(/[\s,]+/).filter(Boolean);
      if (parts.length !== 4) return null;
      const nums = parts.map((p) => numValue(p, -VECTOR_CLAMP, VECTOR_CLAMP));
      if (nums.some((n) => n === null)) return null;
      const [a, b, c, d] = nums as number[];
      if (c <= 0 || d <= 0) return null; // degenerate viewBox
      return [a, b, c, d].map(fmtNum).join(" ");
    }
    case "fill":
    case "stroke": {
      if (v.toLowerCase() === "none") return "none";
      const hex = normalizeHex(v);
      return hex === null ? null : hex;
    }
    case "fill-opacity": {
      const n = numValue(v, 0, 1);
      return n === null ? null : fmtNum(n);
    }
    case "stroke-width": {
      const n = numValue(v, 0, 96);
      return n === null ? null : fmtNum(n);
    }
    case "font-size": {
      const n = numValue(v, 1, 96);
      return n === null ? null : fmtNum(n);
    }
    case "font-family": {
      const clean = stripControl(v).trim();
      return clean && FONT_FAMILY_RE.test(clean) ? clean : null;
    }
    case "text-anchor":
      return TEXT_ANCHORS.has(v) ? v : null;
    case "x":
    case "y":
    case "cx":
    case "cy":
    case "x1":
    case "y1":
    case "x2":
    case "y2": {
      const n = numValue(v, -VECTOR_CLAMP, VECTOR_CLAMP);
      return n === null ? null : fmtNum(n);
    }
    case "width":
    case "height":
    case "r":
    case "rx":
    case "ry": {
      const n = numValue(v, 0, VECTOR_CLAMP);
      return n === null ? null : fmtNum(n);
    }
    case "transform": {
      const out = canonicalTransform(v);
      return out === null ? null : out;
    }
    case "d": {
      const clean = stripControl(v).trim();
      if (!clean || !PATH_CHARSET.test(clean)) return null;
      return clean;
    }
    case "points": {
      const clean = stripControl(v).trim();
      if (!clean || !POINTS_CHARSET.test(clean)) return null;
      if (clean.split(/[\s,]+/).filter(Boolean).length < 4) return null;
      return clean;
    }
    default:
      return null;
  }
}

/** Parse+canonicalize transform lists like `rotate(45 48 48) translate(2 -3)`. */
function canonicalTransform(v: string): string | null {
  const clean = stripControl(v).trim();
  if (!clean) return null;
  const out: string[] = [];
  let i = 0;
  const n = clean.length;
  while (i < n) {
    while (i < n && /[\s,]/.test(clean[i])) i++;
    if (i >= n) break;
    const fnMatch = /^[a-zA-Z]+/.exec(clean.slice(i));
    if (!fnMatch) return null;
    const fn = fnMatch[0];
    if (!TRANSFORM_FNS.has(fn)) return null;
    i += fn.length;
    while (i < n && /[\s,]/.test(clean[i])) i++;
    if (clean[i] !== "(") return null;
    i++;
    const args: string[] = [];
    while (true) {
      while (i < n && /[\s,]/.test(clean[i])) i++;
      const numMatch = NUMBER_PREFIX_RE.exec(clean.slice(i));
      if (!numMatch) return null;
      args.push(numMatch[0]);
      i += numMatch[0].length;
      while (i < n && /[\s,]/.test(clean[i])) i++;
      if (clean[i] === ")") break;
      if (i >= n || clean[i] === "(") return null;
    }
    i++; // consume ')'
    let minArgs = 1;
    let maxArgs = 1;
    let lo = -VECTOR_CLAMP;
    let hi = VECTOR_CLAMP;
    if (fn === "translate") maxArgs = 2;
    else if (fn === "scale") {
      maxArgs = 2;
      hi = 64;
      lo = -64;
    } else if (fn === "rotate") maxArgs = 3;
    else if (fn === "matrix") {
      minArgs = 6;
      maxArgs = 6;
    }
    if (args.length < minArgs || args.length > maxArgs) return null;
    const nums = args.map((a) => numValue(a, lo, hi));
    if (nums.some((x) => x === null)) return null;
    if (fn === "scale" && nums.some((x) => x === 0)) return null; // degenerate
    const safeNums = nums as number[]; // non-null proven by the guard above
    out.push(`${fn}(${safeNums.map(fmtNum).join(", ")})`);
  }
  return out.length > 0 ? out.join(" ") : null;
}

/** Is this a raw value that smells like an exfiltration vector? */
function unsafeValueReason(name: string, value: string): string | null {
  const v = value.toLowerCase();
  if (/url\s*\(/.test(v)) return `unsafe reference url() in ${name}`;
  if (/javascript\s*:/.test(v)) return `unsafe reference javascript: in ${name}`;
  if (/data\s*:/.test(v)) return `unsafe reference data: in ${name}`;
  if (v.includes("<") || v.includes(">")) return `raw markup in ${name}`;
  return null;
}

/**
 * Strict, zero-dep SVG sanitizer (register spec 13_top20_gaps.md:310 +
 * feasibility corrections 15_feasibility_review.md §G-37: no CSP exists, so
 * this allowlist parser is the whole defense).
 *
 * Semantics:
 *  - DANGEROUS content anywhere (off-whitelist tags, event/style/href attrs,
 *    url()/javascript:/data: values, markup declarations, unknown entities,
 *    unbalanced/oversized/deep input) ⇒ { ok:false, reason } — the document
 *    is REJECTED as a whole (fail closed); callers fall back deterministically.
 *  - Benign-but-unlisted attributes on whitelisted elements (id, class,
 *    opacity, role, version, width/height on <svg>, …) are STRIPPED during the
 *    canonical rebuild.
 *  - The returned svg is ALWAYS a rebuilt canonical document (allowlisted
 *    attrs in input order, normalized hex colors, clamped/rounded numbers,
 *    injected xmlns, escaped text) — never raw model output. Deterministic and
 *    idempotent: sanitizeSvg(sanitizeSvg(x).svg).ok === true.
 */
export function sanitizeSvg(input: string): SanitizeResult {
  if (typeof input !== "string") {
    return { ok: false, reason: "input is not a string" };
  }
  const src = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  if (src.length > VECTOR_MAX_INPUT_CHARS) {
    return {
      ok: false,
      reason: `input too large (${src.length} chars, max ${VECTOR_MAX_INPUT_CHARS})`,
    };
  }

  const out: string[] = [];
  const stack: ParsedEl[] = []; // open container elements
  let root: ParsedEl | null = null;
  let elements = 0;
  let i = 0;
  const n = src.length;

  const fail = (reason: string): SanitizeResult => ({ ok: false, reason });

  /** Parse `<name ...>` / `<name .../>` starting at '<'. Returns end index. */
  const parseOpen = (): { el: ParsedEl; end: number } | SanitizeResult => {
    let j = i + 1;
    const nameMatch = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(src.slice(j));
    if (!nameMatch) return fail("malformed tag");
    const tag = nameMatch[0];
    j += tag.length;
    const attrs: ParsedAttr[] = [];
    while (true) {
      while (j < n && /[\s]/.test(src[j])) j++;
      if (j >= n) return fail(`unclosed tag <${tag}>`);
      if (src[j] === ">") {
        return { el: { tag, attrs, selfClose: false }, end: j + 1 };
      }
      if (src[j] === "/" && src[j + 1] === ">") {
        return { el: { tag, attrs, selfClose: true }, end: j + 2 };
      }
      const attrMatch = /^[a-zA-Z_:][a-zA-Z0-9_:.-]*/.exec(src.slice(j));
      if (!attrMatch) return fail(`malformed attribute on <${tag}>`);
      const name = attrMatch[0];
      j += name.length;
      while (j < n && /[\s]/.test(src[j])) j++;
      if (src[j] !== "=") return fail(`attribute ${name} missing value on <${tag}>`);
      j++;
      while (j < n && /[\s]/.test(src[j])) j++;
      const quote = src[j];
      if (quote !== '"' && quote !== "'") {
        return fail(`attribute ${name} must be quoted on <${tag}>`);
      }
      const close = src.indexOf(quote, j + 1);
      if (close === -1) return fail(`unterminated attribute ${name} on <${tag}>`);
      const rawValue = src.slice(j + 1, close);
      const decoded = decodeEntities(rawValue);
      if (decoded === null) {
        return fail(`unsupported character reference in ${name} on <${tag}>`);
      }
      if (attrs.some((a) => a.name === name)) {
        return fail(`duplicate attribute ${name} on <${tag}>`);
      }
      attrs.push({ name, value: decoded });
      j = close + 1;
    }
  };

  while (i < n) {
    const ch = src[i];
    if (ch === "<") {
      if (src.startsWith("<!--", i)) return fail("comment nodes are not allowed");
      if (src.startsWith("<!", i)) return fail("markup declarations are not allowed");
      if (src.startsWith("<?", i)) return fail("processing instructions are not allowed");
      const closing = src[i + 1] === "/";
      if (closing) {
        if (stack.length === 0) return fail("unbalanced markup: unexpected closing tag");
        const nameMatch = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(src.slice(i + 2));
        if (!nameMatch) return fail("malformed closing tag");
        const name = nameMatch[0];
        let j = i + 2 + name.length;
        while (j < n && /[\s]/.test(src[j])) j++;
        if (src[j] !== ">") return fail(`malformed closing tag </${name}>`);
        const top = stack[stack.length - 1];
        if (top.tag !== name) {
          return fail(`unbalanced markup: unexpected </${name}> (open: <${top.tag}>)`);
        }
        stack.pop();
        if (LEAF_TAGS.has(name)) {
          out.push("/>"); // canonical: leaves always self-close
        } else {
          out.push(`</${name}>`);
        }
        i = j + 1;
        continue;
      }
      // open tag
      const parsed = parseOpen();
      if (!("el" in parsed)) return parsed;
      const { el, end } = parsed;
      const tag = el.tag.toLowerCase();
      const tagIsAllowed = ALLOWED_TAGS.has(tag);
      const originalTag = el.tag;

      // -- whitelist enforcement --------------------------------------------
      if (!tagIsAllowed || tag !== el.tag) {
        return fail(`disallowed element <${originalTag}>`);
      }
      if (tag === "svg") {
        if (root !== null || stack.length > 0) {
          return fail("<svg> must be the single root element");
        }
      } else if (root === null) {
        return fail(`root element must be <svg>, got <${originalTag}>`);
      } else if (stack.length === 0) {
        return fail(`content after root element: <${originalTag}>`);
      }
      elements += 1;
      if (elements > VECTOR_MAX_ELEMENTS) {
        return fail(`too many elements (${elements}, max ${VECTOR_MAX_ELEMENTS})`);
      }
      if (stack.length + 1 > VECTOR_MAX_DEPTH) {
        return fail("markup too deeply nested");
      }
      if (stack.length > 0 && LEAF_TAGS.has(stack[stack.length - 1].tag)) {
        const parent = stack[stack.length - 1];
        return fail(`element inside <${parent.tag}> is not allowed`);
      }

      // -- per-attribute validation -----------------------------------------
      const allowed = ALLOWED_ATTRS[tag];
      const canonical: ParsedAttr[] = [];
      for (const a of el.attrs) {
        const lower = a.name.toLowerCase();
        if (/^on/i.test(lower)) {
          return fail(`event attribute ${a.name} is not allowed`);
        }
        if (lower === "style") return fail("style attribute is not allowed");
        if (lower === "href" || lower === "xlink:href") {
          return fail(`attribute ${a.name} is not allowed (external references are)`);
        }
        const danger = unsafeValueReason(a.name, a.value);
        if (danger !== null) return fail(danger);
        if (tag === "svg" && lower === "xmlns") {
          if (a.value !== SVG_NS) return fail("unsupported xmlns on <svg>");
          continue; // re-emitted canonically below
        }
        // Resolve to the canonical allowlist spelling (viewBox stays viewBox);
        // benign unknown attrs are stripped silently.
        let allowedKey: string | undefined;
        for (const k of allowed) {
          if (k.toLowerCase() === lower) {
            allowedKey = k;
            break;
          }
        }
        if (!allowedKey) continue;
        // Case-variant duplicates (FILL= + fill=) would collide in the
        // canonical rebuild into two same-named attributes — invalid XML and
        // a violation of the sanitizer's idempotency invariant. Fail closed
        // exactly like the parse-level duplicate-attribute rule.
        if (canonical.some((c) => c.name === allowedKey)) {
          return fail(`duplicate attribute ${allowedKey} on <${tag}>`);
        }
        const value = canonicalAttr(tag, allowedKey, a.value);
        if (value === null) {
          return fail(`invalid value for ${a.name} on <${tag}>: "${truncateForReason(a.value)}"`);
        }
        canonical.push({ name: allowedKey, value });
      }

      // -- emission ----------------------------------------------------------
      // svg root: xmlns is injected canonically; viewBox is required.
      let open: string;
      if (tag === "svg") {
        const vb = canonical.find((a) => a.name === "viewBox");
        if (!vb) return fail("missing viewBox on <svg>");
        open = `<svg xmlns="${SVG_NS}" viewBox="${vb.value}"`;
        root = { tag, attrs: canonical, selfClose: el.selfClose };
      } else {
        open =
          `<${tag}${canonical
            .map((a) => ` ${a.name}="${xmlEscape(a.value)}"`)
            .join("")}`;
      }
      if (tag === "text" && !el.selfClose) {
        // <text> content: capture up to </text> — no child elements allowed.
        const endMatch = /<\/text[\s>]/.exec(src.slice(end));
        if (!endMatch) return fail("unclosed element <text>");
        const contentStart = end;
        const contentEnd = end + endMatch.index;
        const rawContent = src.slice(contentStart, contentEnd);
        if (/<[^>]*>/.test(rawContent)) return fail("markup inside <text> is not allowed");
        const decoded = decodeEntities(rawContent);
        if (decoded === null) return fail("unsupported character reference in <text>");
        // Canonical: collapse whitespace runs, then escape.
        const text = xmlEscape(decoded.replace(/\s+/g, " ").trim());
        out.push(`${open}>${text}</text>`);
        i = end + endMatch.index + endMatch[0].length; // past </text>
        continue;
      }
      if (el.selfClose) {
        out.push(`${open}/>`);
      } else if (LEAF_TAGS.has(tag)) {
        // Leaves defer the close: canonical `<rect …/>` appended at </rect>.
        out.push(open);
        stack.push({ tag, attrs: canonical, selfClose: false });
      } else {
        out.push(`${open}>`);
        stack.push({ tag, attrs: canonical, selfClose: false });
      }
      i = end;
      continue;
    }
    // Non-'<' content
    if (/[\s]/.test(ch)) {
      i++;
      continue;
    }
    if (stack.length > 0 && stack[stack.length - 1].tag === "text") {
      // Unreachable: text content is consumed inline at open. Defensive.
      return fail("unexpected content inside <text>");
    }
    if (root === null) return fail("expected <svg> root");
    return fail("unexpected text outside elements");
  }

  if (root === null) return fail("missing <svg> root");
  if (stack.length > 0) {
    return fail(`unclosed element <${stack[stack.length - 1].tag}>`);
  }
  return { ok: true, svg: out.join("") };
}

function truncateForReason(v: string): string {
  const s = v.replace(/\s+/g, " ").trim();
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

/**
 * data: URL for <img> previews. Sanitizes first (null when the svg fails the
 * sanitizer — the caller must never render unsanitized model output).
 */
export function svgToDataUrl(svg: string): string | null {
  const res = sanitizeSvg(svg);
  if (!res.ok) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(res.svg)}`;
}

/** Every #rrggbb fill/stroke color in a sanitized svg, in first-use order. */
export function usedHexColors(svg: string): string[] {
  const seen: string[] = [];
  const re = /(?:fill|stroke)="#([0-9a-f]{6})"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const hex = `#${m[1]}`;
    if (!seen.includes(hex)) seen.push(hex);
  }
  return seen;
}

// ---------------------------------------------------------------------------
// Deterministic floor: geometric monogram (G-37 register: byte-stable, keyless)
// ---------------------------------------------------------------------------

/** Curated brand rows (white-text AA ≥ 4.5:1 verified pairs) for keyless runs. */
const MONOGRAM_ROWS: ReadonlyArray<readonly [string, string]> = [
  ["#4338ca", "#fde68a"], // indigo / amber-200
  ["#0f766e", "#fde68a"], // teal
  ["#7e22ce", "#fde68a"], // purple
  ["#b91c1c", "#fde68a"], // red
  ["#1e3a8a", "#fde68a"], // blue
  ["#166534", "#fde68a"], // green
];

function tokenHex(tokens: Record<string, string> | undefined, key: string): string | undefined {
  const v = tokens?.[key];
  const hex = typeof v === "string" ? normalizeHex(v) : null;
  return hex ?? undefined;
}

/** First letters of a display name (1-2 chars), deterministic. */
export function monogramInitials(name: string): string {
  const clean = stripControl(name.trim());
  const words = clean.split(/[^A-Za-z0-9]+/).filter((w) => w.length > 0);
  if (words.length === 0) {
    const chars = [...clean].filter((c) => !/[\s]/.test(c));
    return chars.length > 0 ? chars.slice(0, 2).join("").toUpperCase() : "RT";
  }
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  const initials = (first + last).toUpperCase();
  return initials.length > 0 ? initials : "RT";
}

/**
 * Deterministic monogram SVG (register G-37 deterministic floor): initials in
 * a seeded rounded brand square with two seeded accent dots, rotated by the
 * seed. Byte-stable for the same (name, seed, tokens); no key, no network.
 */
export function geometricMonogram(
  name: string,
  seed = 0,
  tokens?: Record<string, string>,
): string {
  const h = fnv1a(`${name}::${seed}`);
  const row = MONOGRAM_ROWS[h % MONOGRAM_ROWS.length];
  const brand = tokenHex(tokens, "brand") ?? row[0];
  const accent = tokenHex(tokens, "accent") ?? row[1];
  const onBrand = tokenHex(tokens, "onBrand") ?? "#ffffff";
  const initials = monogramInitials(name);
  // monogramInitials returns 1-2 chars, so only two rungs exist (34 for 2, 46
  // for 1). A `>= 3` rung was unreachable; pinned by vector.test.ts.
  const fontSize = initials.length >= 2 ? 34 : 46;
  const tilt = (h % 50) - 25; // -25..24 degrees
  const dotR = 3 + ((h >>> 17) % 3); // 3..5
  const font =
    'font-family="ui-sans-serif, system-ui, sans-serif" text-anchor="middle"';
  return (
    `<svg xmlns="${SVG_NS}" viewBox="0 0 96 96">` +
    `<rect x="0" y="0" width="96" height="96" rx="22" fill="${brand}"/>` +
    `<g transform="rotate(${tilt} 48 48)">` +
    `<circle cx="48" cy="13" r="${dotR}" fill="${accent}"/>` +
    `<circle cx="48" cy="83" r="${dotR + 1}" fill="${accent}"/>` +
    `</g>` +
    `<text x="48" y="${fmtNum(48 + 0.36 * fontSize)}" fill="${onBrand}" font-size="${fontSize}" ${font}>${xmlEscape(initials)}</text>` +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// Deterministic badge builder (no LLM — G-37/G-38 badge surface)
// ---------------------------------------------------------------------------

export const BADGE_TONES = [
  "brand",
  "accent",
  "ok",
  "warn",
  "bad",
  "neutral",
] as const;
export type BadgeTone = (typeof BADGE_TONES)[number];

/** Curated keyless pairs (AA ≥ 4.5:1 text-on-fill) per tone. */
const BADGE_DEFAULTS: Record<BadgeTone, { fill: string; fg: string; ring?: string }> = {
  brand: { fill: "#4338ca", fg: "#ffffff" },
  accent: { fill: "#0369a1", fg: "#ffffff" },
  ok: { fill: "#dcfce7", fg: "#15803d" },
  warn: { fill: "#fef3c7", fg: "#92400e" },
  bad: { fill: "#fee2e2", fg: "#b91c1c" },
  neutral: { fill: "#e2e8f0", fg: "#0f172a", ring: "#94a3b8" },
};

/** Token keys that pair AA-safe per design.ts invariants (design.ts:37-43). */
const TONE_TOKENS: Record<BadgeTone, { fill: string; fg: string; ring?: string }> = {
  brand: { fill: "brand", fg: "onBrand" },
  accent: { fill: "accent", fg: "onAccent" },
  ok: { fill: "okSoft", fg: "ok" },
  warn: { fill: "warnSoft", fg: "warn" },
  bad: { fill: "badSoft", fg: "bad" },
  neutral: { fill: "surfaceAlt", fg: "ink", ring: "line" },
};

/**
 * Deterministic SVG badge (pill): `text` label on a tone-colored rounded rect.
 * Pure — same (text, tone, tokens) ⇒ byte-identical output. No LLM, no key.
 * When `tokens` (designTokens(project).palette.tokens) is provided it is used
 * with the AA-safe pairs from design.ts's invariant table; otherwise curated
 * defaults. Unknown tone ⇒ throws (callers validate against BADGE_TONES).
 */
export function generateBadge(
  text: string,
  tone: BadgeTone = "brand",
  tokens?: Record<string, string>,
): string {
  if (!BADGE_TONES.includes(tone)) {
    // Coded (RT_E_VALIDATION): an unknown tone is caller input, not an internal
    // fault — an orchestrator branches on the code without parsing the prose.
    throw Object.assign(
      new Error(`unknown badge tone: ${String(tone)} — expected one of ${BADGE_TONES.join(", ")}`),
      { code: "RT_E_VALIDATION" },
    );
  }
  const label = stripControl(String(text));
  const mapped = TONE_TOKENS[tone];
  const fill = tokenHex(tokens, mapped.fill) ?? BADGE_DEFAULTS[tone].fill;
  const fg = tokenHex(tokens, mapped.fg) ?? BADGE_DEFAULTS[tone].fg;
  const ringHex = tokenHex(tokens, mapped.ring ?? "");
  const ring = ringHex ?? BADGE_DEFAULTS[tone].ring;

  const L = label.length;
  const fontSize = L > 34 ? 11 : 13;
  const width = Math.min(680, Math.max(24, Math.round(20 + L * fontSize * 0.62)));
  const textY = fmtNum(12 + 0.36 * fontSize);
  const body =
    `<rect x="0" y="0" width="${width}" height="24" rx="12" fill="${fill}"` +
    (ring ? ` stroke="${ring}" stroke-width="1"` : "") +
    `/>`;
  const labelEl =
    `<text x="${Math.round(width / 2)}" y="${textY}" fill="${fg}" font-size="${fontSize}" ` +
    `text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif">${xmlEscape(label)}</text>`;
  return `<svg xmlns="${SVG_NS}" viewBox="0 0 ${width} 24">${body}${labelEl}</svg>`;
}

// ---------------------------------------------------------------------------
// LLM-as-designer prompts (strict SVG grammar contracts)
// ---------------------------------------------------------------------------

const SVG_RULES =
  "Emit exactly one compact SVG per logo: a single root <svg viewBox=\"0 0 96 96\" " +
  "xmlns=\"http://www.w3.org/2000/svg\"> with at most 12 elements. Allowed elements ONLY: " +
  "svg g rect circle ellipse line path polygon text defs. Allowed attributes ONLY: " +
  "viewBox fill stroke stroke-width fill-opacity transform x y width height rx ry cx cy r " +
  "x1 y1 x2 y2 d points font-size text-anchor. No gradients, no defs content, no <script>, " +
  "no foreignObject, no href/xlink:href, no on* or style attributes, no url() references. " +
  "Fills and strokes MUST be exact hex colors from the provided palette and nothing else. " +
  "Text (if any) is at most 6 characters, centered, and XML-escaped. One line, no prose.";

function paletteTable(tokens: Record<string, string>): string {
  const keys = ["brand", "onBrand", "accent", "onAccent", "ink", "inkMuted", "bg"];
  return keys
    .map((k) => {
      const hex = tokenHex(tokens, k) ?? "#000000";
      return `  ${k}: ${hex}`;
    })
    .join("\n");
}

/** Design palette (design.ts tokens) in a fixed, promptable order. */
function tokenPalette(project: Project): Record<string, string> {
  return designTokens(project).palette.tokens;
}

/**
 * Build the strict logo prompt: palette-only fills, ≤ 12 elements, 96×96.
 * Deterministic for the same project/brief/style. `brief` overrides the
 * project brief; `style` appends extra visual constraints.
 */
export function promptLogo(
  project: Project,
  brief?: string,
  style?: string,
): string {
  const tokens = tokenPalette(project);
  const briefText = stripControl((brief ?? project.brief ?? "").trim()).slice(0, 2000);
  const styleText = stripControl((style ?? "").trim()).slice(0, 400);
  return (
    `Design a flat vector logo for "${project.name}". Project brief: ${briefText || "(none)"}.` +
    (styleText ? ` Extra style constraints: ${styleText}.` : "") +
    `\n\nAllowed fill palette (hex, use ONLY these):\n${paletteTable(tokens)}\n\n` +
    `${SVG_RULES}\n\n` +
    `Reply with exactly one JSON object, no prose: {"name": "<logo name, short>", ` +
    `"svg": "<the svg markup as one escaped string>", "palette": ["#rrggbb", ...]}. ` +
    `"palette" lists every hex you actually used, in use order.`
  );
}

// ---------------------------------------------------------------------------
// LLM JSON envelope handling (json:true flash via completeDeepSeek)
// ---------------------------------------------------------------------------

type DeepSeekOutcome =
  | { ok: true; text: string; model?: string }
  | { ok: false; reason: "not-configured" | "error"; error?: string };

/** Server seam: dynamic import so this module stays client-importable. */
async function callDeepSeekJson(prompt: string, maxTokens: number): Promise<DeepSeekOutcome> {
  const { completeDeepSeek } = await import("./deepseek.server.ts");
  const res = await completeDeepSeek(prompt, {
    model: "deepseek-v4-flash",
    json: true,
    maxTokens,
  });
  if (!res.ok) {
    return {
      ok: false,
      reason: res.reason === "not-configured" ? "not-configured" : "error",
      error: res.error,
    };
  }
  return { ok: true, text: res.text, model: res.model };
}

/** Tolerate markdown-fenced JSON; parse; null on anything else. */
function parseJsonEnvelope(text: string): unknown | null {
  const direct = text.trim();
  try {
    return JSON.parse(direct) as unknown;
  } catch {
    /* fall through to fence stripping */
  }
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(direct);
  if (!fence) return null;
  try {
    return JSON.parse(fence[1].trim()) as unknown;
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Normalize an LLM-declared palette: valid #rgb/#rrggbb, unique, capped. */
function normalizePalette(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const hex = normalizeHex(item);
    if (hex === null || out.includes(hex)) continue;
    out.push(hex);
    if (out.length >= VECTOR_MAX_PALETTE) break;
  }
  return out;
}

function cleanName(raw: unknown, fallback: string, max = 60): string {
  if (typeof raw !== "string") return fallback;
  const s = stripControl(raw).trim().slice(0, max);
  return s.length > 0 ? s : fallback;
}

/** Does the sanitized doc contain at least one drawn shape? */
function hasShapes(svg: string): boolean {
  return /<(rect|circle|ellipse|line|path|polygon)\b/.test(svg);
}

export type VectorSource = "llm" | "deterministic";

export type VectorFailure = { ok: false; reason: "error"; error: string };

/** Shared success shape: LLM win or honest deterministic floor. */
export type GeneratedAsset = {
  ok: true;
  source: VectorSource;
  name: string;
  svg: string;
  palette: string[];
  model?: string;
  note?: string;
};

export type LogoResult = GeneratedAsset | VectorFailure;

const NOT_CONFIGURED_NOTE =
  "DeepSeek not-configured (no DEEPSEEK_API_KEY — RT_E_LLM_NOT_CONFIGURED); deterministic geometric fallback.";
const REJECT_PREFIX = "LLM output rejected";

function fallbackNote(reason: string): string {
  return `${REJECT_PREFIX}: ${reason} — deterministic geometric fallback.`;
}

function monogramAsset(project: Project, note: string): GeneratedAsset {
  const tokens = tokenPalette(project);
  const svg = geometricMonogram(project.name || "RT", 0, tokens);
  return {
    ok: true,
    source: "deterministic",
    name: project.name || "RT",
    svg,
    palette: usedHexColors(svg),
    note,
  };
}

/** Deterministic geometric icon set (keyless floor / all-glyphs-rejected floor). */
function deterministicIconSet(
  project: Project,
  concept: string,
  count: number,
  note: string = NOT_CONFIGURED_NOTE,
): IconSetResult {
  const tokens = tokenPalette(project);
  const brand = tokenHex(tokens, "brand") ?? "#4338ca";
  const onBrand = tokenHex(tokens, "onBrand") ?? "#ffffff";
  const accent = tokenHex(tokens, "accent") ?? "#fde68a";
  const base =
    stripControl(concept)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "icon";
  const nameAt = (i: number): string => (i === 0 ? base : `${base}-${i + 1}`);
  const n = Math.min(12, Math.max(1, Math.floor(count) || 1));
  // Deterministic per-glyph seeded shapes: rounded square + N-gon + dot.
  const icons: IconGlyph[] = [];
  for (let i = 0; i < n; i++) {
    const h = fnv1a(`${project.name}::${base}::${i}`);
    const sides = 3 + (h % 4); // 3..6
    const angle = ((h >>> 7) % 360) * (Math.PI / 180);
    const rot = (h >>> 13) % 90;
    const pts: string[] = [];
    for (let k = 0; k < sides; k++) {
      const a = angle + (k * 2 * Math.PI) / sides;
      pts.push(`${fmtNum(12 + 8.5 * Math.cos(a))},${fmtNum(12 + 8.5 * Math.sin(a))}`);
    }
    const dot = 2 + ((h >>> 19) % 3);
    const svg =
      `<svg xmlns="${SVG_NS}" viewBox="0 0 24 24">` +
      `<rect x="1" y="1" width="22" height="22" rx="6" fill="${brand}"/>` +
      `<g transform="rotate(${rot} 12 12)">` +
      `<polygon points="${pts.join(" ")}" fill="${onBrand}"/>` +
      `</g>` +
      `<circle cx="19" cy="5" r="${dot}" fill="${accent}"/>` +
      `</svg>`;
    icons.push({ name: nameAt(i), svg });
  }
  return {
    ok: true,
    source: "deterministic",
    icons,
    palette: [brand, onBrand, accent],
    note,
  };
}

/**
 * LLM-as-designer brand logo (G-37). One deepseek-v4-flash json:true call; the
 * model returns {name, svg, palette}; every field is validated and the svg is
 * rebuilt by sanitizeSvg before it can leave this function.
 *
 *  - ok + source:"llm"        — model output passed every gate.
 *  - ok + source:"deterministic" + note — keyless, or LLM output rejected with
 *    the evidence reason in `note` (never the raw model output).
 *  - ok:false reason:"error"  — the API call itself failed (surfaced honestly).
 */
export async function generateLogo(
  project: Project,
  brief?: string,
  style?: string,
): Promise<LogoResult> {
  const fallbackName = project.name || "RT";
  const prompt = promptLogo(project, brief, style);
  const call = await callDeepSeekJson(prompt, 1500);
  if (!call.ok) {
    if (call.reason === "not-configured") {
      return monogramAsset(project, NOT_CONFIGURED_NOTE);
    }
    return {
      ok: false,
      reason: "error",
      error: call.error ?? "DeepSeek vector call failed",
    };
  }
  const parsed = parseJsonEnvelope(call.text);
  if (!isRecord(parsed)) {
    return monogramAsset(project, fallbackNote("model reply was not a JSON object"));
  }
  if (typeof parsed.svg !== "string" || parsed.svg.trim() === "") {
    return monogramAsset(project, fallbackNote("missing svg field in model reply"));
  }
  const sanitized = sanitizeSvg(parsed.svg);
  if (!sanitized.ok) {
    return monogramAsset(project, fallbackNote(sanitized.reason));
  }
  if (!hasShapes(sanitized.svg)) {
    return monogramAsset(project, fallbackNote("svg contains no drawn shapes"));
  }
  const palette = normalizePalette(parsed.palette);
  const used = usedHexColors(sanitized.svg);
  if (palette.length === 0 || used.some((hex) => !palette.includes(hex))) {
    const missing = used.find((hex) => !palette.includes(hex)) ?? "(none declared)";
    return monogramAsset(
      project,
      fallbackNote(`palette mismatch: ${missing} used but not declared in palette`),
    );
  }
  return {
    ok: true,
    source: "llm",
    name: cleanName(parsed.name, fallbackName),
    svg: sanitized.svg,
    palette,
    model: call.model,
  };
}

export type IconGlyph = { name: string; svg: string };

export type IconSetResult =
  | {
      ok: true;
      source: "llm";
      icons: IconGlyph[];
      palette: string[];
      dropped: { index: number; name?: string; reason: string }[];
      model?: string;
    }
  | { ok: true; source: "deterministic"; icons: IconGlyph[]; palette: string[]; note: string }
  | VectorFailure;

function promptIconSet(project: Project, concept: string, count: number): string {
  const tokens = tokenPalette(project);
  const conceptText = stripControl(concept.trim()).slice(0, 200);
  return (
    `Design ${count} flat vector icons for the concept "${conceptText || project.name}" ` +
    `(product: ${project.name}; brief: ${stripControl((project.brief ?? "").trim()).slice(0, 800) || "(none)"}). ` +
    `Each icon is a separate compact SVG: single root <svg viewBox="0 0 24 24" ` +
    `xmlns="http://www.w3.org/2000/svg">, at most 6 elements, crisp geometric glyphs on a 24px grid. ` +
    `Allowed elements ONLY: svg g rect circle ellipse line path polygon. Allowed attributes ONLY: ` +
    `viewBox fill stroke stroke-width fill-opacity transform x y width height rx ry cx cy r x1 y1 x2 y2 d points. ` +
    `No text, no gradients, no scripts, no href/on* /style, no url(). ` +
    `Fills/strokes MUST be exact hex colors from this palette and nothing else:\n` +
    `${paletteTable(tokens)}\n` +
    `Reply with exactly one JSON object, no prose: {"icons": [{"name": "<short kebab-case name>", ` +
    `"svg": "<svg markup as one escaped string>"} x ${count}], "palette": ["#rrggbb", ...]}. ` +
    `"palette" lists every hex used across the set, in first-use order.`
  );
}

/**
 * LLM-as-designer icon set (G-37): `count` (1-12) named glyphs for `concept`,
 * each individually sanitized. Glyphs whose model SVG fails the sanitizer or
 * paints outside the declared palette are dropped with reasons; if every glyph
 * is dropped the deterministic geometric set replaces the whole result.
 */
export async function generateIconSet(
  project: Project,
  concept: string,
  count: number,
): Promise<IconSetResult> {
  const n = Math.min(12, Math.max(1, Math.floor(count) || 1));
  const prompt = promptIconSet(project, concept, n);
  const call = await callDeepSeekJson(prompt, 3000);
  if (!call.ok) {
    if (call.reason === "not-configured") {
      return deterministicIconSet(project, concept, n);
    }
    return {
      ok: false,
      reason: "error",
      error: call.error ?? "DeepSeek vector call failed",
    };
  }
  const parsed = parseJsonEnvelope(call.text);
  if (!isRecord(parsed) || !Array.isArray(parsed.icons) || parsed.icons.length === 0) {
    return deterministicIconSet(
      project,
      concept,
      n,
      fallbackNote("model reply was not a JSON object with an icons array"),
    );
  }
  const declared = normalizePalette(parsed.palette);
  const icons: IconGlyph[] = [];
  const dropped: { index: number; name?: string; reason: string }[] = [];
  parsed.icons.slice(0, 12).forEach((raw, index) => {
    const glyphName = isRecord(raw) && typeof raw.name === "string" ? raw.name : undefined;
    const label = cleanName(glyphName, `${concept || "icon"}-${index + 1}`, 40);
    const svgRaw = isRecord(raw) && typeof raw.svg === "string" ? raw.svg : "";
    if (!svgRaw.trim()) {
      dropped.push({ index, name: label, reason: "missing svg field" });
      return;
    }
    const sanitized = sanitizeSvg(svgRaw);
    if (!sanitized.ok) {
      dropped.push({ index, name: label, reason: sanitized.reason });
      return;
    }
    if (!hasShapes(sanitized.svg)) {
      dropped.push({ index, name: label, reason: "svg contains no drawn shapes" });
      return;
    }
    const used = usedHexColors(sanitized.svg);
    if (declared.length === 0 || used.some((hex) => !declared.includes(hex))) {
      const missing = used.find((hex) => !declared.includes(hex)) ?? "(none declared)";
      dropped.push({
        index,
        name: label,
        reason: `palette mismatch: ${missing} used but not declared`,
      });
      return;
    }
    icons.push({ name: label, svg: sanitized.svg });
  });

  if (icons.length === 0) {
    const firstReason = dropped[0]?.reason ?? "all glyphs rejected";
    return deterministicIconSet(
      project,
      concept,
      n,
      fallbackNote(`all ${n} icon(s) rejected (first reason: ${firstReason})`),
    );
  }
  return {
    ok: true,
    source: "llm",
    icons,
    palette: declared,
    dropped,
    model: call.model,
  };
}

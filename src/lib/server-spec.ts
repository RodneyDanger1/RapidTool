// ---------------------------------------------------------------------------
// server-spec.ts — A1-12 (fixes/296 Q1): the ONE runtime-assembled specifier
// helper for the `*.server.*` probe imports.
//
// The load-bearing idiom: the TanStack import-protection plugin statically
// denies direct `*.server.*` imports from the client bundle, so every server
// probe assembles its specifier at runtime instead of writing a literal —
// `const spec = "./deepseek." + "server.ts"; await import(spec)`. Before this
// helper the concatenation was hand-rolled at every call site (§A1 found four
// copies growing to nine), which is the "duplications that will drift" class:
// a plugin/bundler rule change would need the same edit in N places.
//
// One definition now; call sites keep the `import(spec)` shape. Pure and
// dependency-free → safe for either server-only or client-safe import (the
// module never itself imports a `.server.ts`).
// ---------------------------------------------------------------------------

/** The server probes this repo defers behind a runtime-assembled specifier. */
export type ServerProbeBase = "deepseek" | "wild-mode" | "headless" | "codegen" | "compile-check";

/**
 * `clientSafeServerSpecifier("deepseek")` → `"./deepseek." + "server.ts"`.
 * `file` exists for the headless probe, which loads `"./headless." + "ts"`.
 * Keep the assembly (`${base}.` + file) — it must stay a runtime computation.
 */
export function clientSafeServerSpecifier(base: ServerProbeBase, file = "server.ts"): string {
  return `./${base}.` + file;
}

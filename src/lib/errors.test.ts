// ---------------------------------------------------------------------------
// errors.test.ts — machine-readable error-code system (48 chat/errors wave).
// Run: node --experimental-strip-types --test src/lib/errors.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ERROR_CODES,
  ERROR_CODE_DOC,
  classifyError,
  codeError,
  dualChannelFailDetail,
} from "./errors.ts";
import { SessionBudgetExceeded } from "./token-ledger.ts";

function reportRejectedError(message: string): Error {
  return Object.assign(new Error(message), { name: "ReportRejectedError" });
}

function enoentError(): Error {
  return Object.assign(new Error("ENOENT: no such file or directory, open 'x.json'"), {
    code: "ENOENT",
  });
}

describe("codeError", () => {
  it("returns the exact { ok:false, error, code } shape", () => {
    assert.deepEqual(codeError("RT_E_PHASE_ILLEGAL", "P9 is not legal from P1"), {
      ok: false,
      error: "P9 is not legal from P1",
      code: "RT_E_PHASE_ILLEGAL",
    });
  });

  it("is distinct from a bare ok result", () => {
    const r = codeError("RT_E_UNKNOWN", "boom");
    assert.equal(r.ok, false);
    assert.equal(typeof r.error, "string");
    assert.equal(typeof r.code, "string");
  });
});

describe("dualChannelFailDetail (185-H1)", () => {
  it("returns null on clean ok:true (no error channel)", () => {
    assert.equal(dualChannelFailDetail({ ok: true }), null);
    assert.equal(dualChannelFailDetail({ ok: true, text: "hi" }), null);
    assert.equal(dualChannelFailDetail({ ok: true, error: "" }), null);
    assert.equal(dualChannelFailDetail({ ok: true, error: "   " }), null);
  });

  it("returns the error prose when ok:true carries a non-empty error", () => {
    assert.equal(dualChannelFailDetail({ ok: true, error: "already complete" }), "already complete");
    assert.equal(dualChannelFailDetail({ ok: true, error: "  poisoned  " }), "poisoned");
  });

  it("returns null on ok:false (callers handle failures separately)", () => {
    assert.equal(dualChannelFailDetail({ ok: false, error: "nope" }), null);
    assert.equal(dualChannelFailDetail({ ok: false }), null);
  });
});

describe("classifyError", () => {
  it("maps ReportRejectedError by name to RT_E_REPORT_INVALID", () => {
    assert.equal(
      classifyError(reportRejectedError("Invalid report: Report must be an object.")),
      "RT_E_REPORT_INVALID",
    );
  });

  it("maps ReportRejectedError with a phase mention to RT_E_REPORT_PHASE_MISMATCH", () => {
    assert.equal(
      classifyError(
        reportRejectedError("Invalid report: Report phase 3 does not match the current phase 9."),
      ),
      "RT_E_REPORT_PHASE_MISMATCH",
    );
  });

  it("maps ENOENT to RT_E_PROJECT_MISSING", () => {
    assert.equal(classifyError(enoentError()), "RT_E_PROJECT_MISSING");
    assert.equal(
      classifyError(new Error("load failed: ENOENT somewhere")),
      "RT_E_PROJECT_MISSING",
    );
  });

  it("maps AbortError and timeout messages to RT_E_LLM_TIMEOUT", () => {
    assert.equal(
      classifyError(Object.assign(new Error("The operation was aborted"), { name: "AbortError" })),
      "RT_E_LLM_TIMEOUT",
    );
    assert.equal(classifyError(new Error("DeepSeek request timed out after 20s")), "RT_E_LLM_TIMEOUT");
    assert.equal(classifyError(new Error("connect ETIMEDOUT")), "RT_E_LLM_TIMEOUT");
  });

  it("falls back to the supplied fallback for unknown errors", () => {
    assert.equal(classifyError(new Error("some opaque thing"), "RT_E_INTERNAL"), "RT_E_INTERNAL");
    assert.equal(classifyError("a plain string"), "RT_E_UNKNOWN");
    assert.equal(classifyError(undefined, "RT_E_RUNNER_FAILED"), "RT_E_RUNNER_FAILED");
  });

  it("falls back to RT_E_UNKNOWN when no fallback is given", () => {
    assert.equal(classifyError({ weird: true }), "RT_E_UNKNOWN");
  });

  it("maps an ETIMEDOUT errno even when the message is opaque", () => {
    const err = Object.assign(new Error("socket hang up"), { code: "ETIMEDOUT" });
    assert.equal(classifyError(err), "RT_E_LLM_TIMEOUT");
  });

  it("honors a thrown RT_E_* .code immediately (phases.ts/report-throw seam)", () => {
    const err = Object.assign(new Error("Unknown phase 9 in transition"), {
      code: "RT_E_PHASE_ILLEGAL",
    });
    assert.equal(classifyError(err), "RT_E_PHASE_ILLEGAL");
    // Even wrapped in a fetch-style cause chain, the coded link wins once reached.
    const wrapped = Object.assign(new Error("fetch failed"), { cause: err });
    assert.equal(classifyError(wrapped, "RT_E_INTERNAL"), "RT_E_PHASE_ILLEGAL");
  });

  it("classifies SessionBudgetExceeded via thrown RT_E_BUDGET_EXHAUSTED .code", () => {
    assert.equal(classifyError(new SessionBudgetExceeded(10, 10)), "RT_E_BUDGET_EXHAUSTED");
  });

  it("walks the cause chain of wrapper errors", () => {
    // undici-style fetch wrapper: real failure hides in .cause.
    const wrapped = Object.assign(new Error("fetch failed"), {
      cause: Object.assign(new Error("ENOENT: no such file, open 'x.json'"), {
        code: "ENOENT",
      }),
    });
    assert.equal(classifyError(wrapped), "RT_E_PROJECT_MISSING");

    const abortWrapped = Object.assign(new Error("fetch failed"), {
      cause: Object.assign(new Error("The operation was aborted"), {
        name: "AbortError",
      }),
    });
    assert.equal(classifyError(abortWrapped), "RT_E_LLM_TIMEOUT");

    const timeoutCodeInCause = Object.assign(new Error("fetch failed"), {
      cause: Object.assign(new Error("connect phase"), { code: "ETIMEDOUT" }),
    });
    assert.equal(classifyError(timeoutCodeInCause), "RT_E_LLM_TIMEOUT");
  });

  it("walks AggregateError children (Promise.any / undici shapes)", () => {
    // Direct aggregate: the aggregate message ("2 errors") is opaque; the
    // informative failure lives in .errors.
    const agg = new AggregateError(
      [
        Object.assign(new Error("ENOENT: no such file, open 'x.json'"), {
          code: "ENOENT",
        }),
      ],
      "two failures",
    );
    assert.equal(classifyError(agg), "RT_E_PROJECT_MISSING");

    const abortAgg = new AggregateError([
      Object.assign(new Error("The operation was aborted"), { name: "AbortError" }),
    ]);
    assert.equal(classifyError(abortAgg), "RT_E_LLM_TIMEOUT");

    // Wrapped aggregate: fetch-style wrapper with the aggregate in .cause.
    const wrapped = Object.assign(new Error("fetch failed"), { cause: agg });
    assert.equal(classifyError(wrapped), "RT_E_PROJECT_MISSING");

    // A child wrapper error carries the real failure in ITS cause.
    const childWrapped = new AggregateError([
      Object.assign(new Error("fetch failed"), {
        cause: Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" }),
      }),
    ]);
    assert.equal(classifyError(childWrapped), "RT_E_LLM_TIMEOUT");
  });

  it("does not loop or blow up on cyclic or hostile AggregateError shapes", () => {
    const self = new AggregateError([]);
    (self as unknown as { errors: unknown[] }).errors = [self];
    assert.equal(classifyError(self, "RT_E_INTERNAL"), "RT_E_INTERNAL");

    const twin = new AggregateError([]);
    (twin as unknown as { errors: unknown[] }).errors = [twin, twin];
    assert.equal(classifyError(twin, "RT_E_INTERNAL"), "RT_E_INTERNAL");

    // Bounded: an aggregate with > MAX_AGGREGATE_LINKS children whose only
    // match sits past the budget still classifies honestly (no throw, no hang).
    const many = new AggregateError([]);
    (many as unknown as { errors: unknown[] }).errors = Array.from(
      { length: 100 },
      (_, i) => new Error(`plain failure ${i}`),
    );
    assert.equal(classifyError(many, "RT_E_RUNNER_FAILED"), "RT_E_RUNNER_FAILED");
  });

  it("duck-types plain thrown objects with message/code fields", () => {
    // Not every thrown value is an Error: plain { message } / { code } objects
    // must classify by the same fields instead of String()-ing to "[object Object]".
    assert.equal(
      classifyError({ message: "ENOENT: no such file or directory" }),
      "RT_E_PROJECT_MISSING",
    );
    assert.equal(classifyError({ code: "ENOENT" }), "RT_E_PROJECT_MISSING");
    assert.equal(
      classifyError({ message: "request timed out after 30s" }, "RT_E_INTERNAL"),
      "RT_E_LLM_TIMEOUT",
    );
    assert.equal(
      classifyError(Object.assign({ message: "bad report" }, { name: "ReportRejectedError" })),
      "RT_E_REPORT_INVALID",
    );
    // Objects that are NOT Error instances but carry RT_E_* codes win too.
    assert.equal(classifyError({ code: "RT_E_GATE_PENDING" }), "RT_E_GATE_PENDING");
  });

  it("classifies DOMException shapes (browser fetch abort/timeout)", () => {
    assert.equal(
      classifyError(new DOMException("The operation was aborted", "AbortError")),
      "RT_E_LLM_TIMEOUT",
    );
    assert.equal(
      classifyError(new DOMException("The request timed out", "TimeoutError")),
      "RT_E_LLM_TIMEOUT",
    );
    assert.equal(
      classifyError(new DOMException("ENOENT: no such file, open 'x.json'", "NotFoundError")),
      "RT_E_PROJECT_MISSING",
    );
  });

  it("never throws on exotic throw shapes (symbol, function, boolean, boxed)", () => {
    assert.equal(classifyError(Symbol("boom"), "RT_E_INTERNAL"), "RT_E_INTERNAL");
    assert.equal(classifyError(() => "boom", "RT_E_INTERNAL"), "RT_E_INTERNAL");
    assert.equal(classifyError(true, "RT_E_INTERNAL"), "RT_E_INTERNAL");
    assert.equal(classifyError(42, "RT_E_INTERNAL"), "RT_E_INTERNAL");
    assert.equal(classifyError(Object("boxed generic failure"), "RT_E_INTERNAL"), "RT_E_INTERNAL");
    assert.equal(classifyError(null, "RT_E_INTERNAL"), "RT_E_INTERNAL");
    // Boxed strings String()-ify to their text, so marker text still matches.
    assert.equal(
      classifyError(Object("ENOENT: no such file")),
      "RT_E_PROJECT_MISSING",
    );
  });

  it("does not loop on self-referential or deep cause chains", () => {
    const self = Object.assign(new Error("boom"), { name: "SelfRef" });
    self.cause = self;
    assert.equal(classifyError(self, "RT_E_INTERNAL"), "RT_E_INTERNAL");

    // Deeper than the 4-level walk budget: no match, honest fallback.
    let leaf: Error = Object.assign(new Error("ENOENT: leaf"), { code: "ENOENT" });
    for (let i = 0; i < 6; i++) leaf = Object.assign(new Error(`wrap-${i}`), { cause: leaf });
    assert.equal(classifyError(leaf, "RT_E_RUNNER_FAILED"), "RT_E_RUNNER_FAILED");
  });

  // ---- W12 lane-a (fixes/217j) — G3 coverage holes. No OS/network errno may
  // collapse to the opaque default. Shapes are the real Node/undici ones
  // (probe evidence in fixes/217j §2.1/§4.1, node v22.23.2).

  it("maps EACCES/EPERM to RT_E_PERMISSION_DENIED", () => {
    assert.equal(
      classifyError(
        Object.assign(
          new Error("EPERM: operation not permitted, open 'C:\\Windows\\System32\\config\\SAM'"),
          {
            code: "EPERM",
            errno: -4048,
            syscall: "open",
            path: "C:\\Windows\\System32\\config\\SAM",
          },
        ),
      ),
      "RT_E_PERMISSION_DENIED",
    );
    assert.equal(
      classifyError(
        Object.assign(new Error("EACCES: permission denied, open 'x'"), { code: "EACCES" }),
      ),
      "RT_E_PERMISSION_DENIED",
    );
    // Prose-only (a wrapper flattened the errno) still classifies.
    assert.equal(
      classifyError(new Error("EPERM: operation not permitted, mkdir 'y'")),
      "RT_E_PERMISSION_DENIED",
    );
  });

  it("maps ENOSPC to RT_E_DISK_FULL", () => {
    assert.equal(
      classifyError(
        Object.assign(new Error("ENOSPC: no space left on device, write"), { code: "ENOSPC" }),
      ),
      "RT_E_DISK_FULL",
    );
  });

  it("maps EADDRINUSE to RT_E_PORT_IN_USE", () => {
    // Real shape observed in the probe: "listen EADDRINUSE: address already in use 127.0.0.1:52658"
    assert.equal(
      classifyError(
        Object.assign(new Error("listen EADDRINUSE: address already in use 127.0.0.1:52658"), {
          code: "EADDRINUSE",
        }),
      ),
      "RT_E_PORT_IN_USE",
    );
  });

  // ---- 310 B3 (fixes/310_b3_boundary.md · 308 M7-05): the wrong-KIND path
  // family. Real shapes (probe, windows node v22): "EISDIR: illegal operation
  // on a directory, read" (readFileSync on a dir) and "ENOTDIR: not a
  // directory, mkdir 'x'" / ", scandir 'x'" (parent-is-a-FILE). Both used to
  // match nothing and collapse to the caller's fallback (RT_E_VALIDATION for
  // `run --project .`) — a wrong-kind path is its own path-class refusal.

  it("maps EISDIR/ENOTDIR to RT_E_PATH_KIND_MISMATCH", () => {
    assert.equal(
      classifyError(
        Object.assign(new Error("EISDIR: illegal operation on a directory, read"), { code: "EISDIR" }),
      ),
      "RT_E_PATH_KIND_MISMATCH",
    );
    // Prose-only (a wrapper flattened the errno) still classifies.
    assert.equal(
      classifyError(new Error("EISDIR: illegal operation on a directory, read")),
      "RT_E_PATH_KIND_MISMATCH",
    );
    assert.equal(
      classifyError(
        Object.assign(new Error("ENOTDIR: not a directory, mkdir 'afile/out'"), { code: "ENOTDIR" }),
      ),
      "RT_E_PATH_KIND_MISMATCH",
    );
    // A strong signal overrides a caller fallback — a wrong-kind path is NOT
    // "validation" (the M7-05 misreport this pins against).
    assert.equal(
      classifyError(new Error("ENOTDIR: not a directory, scandir 'x'"), "RT_E_VALIDATION"),
      "RT_E_PATH_KIND_MISMATCH",
    );
    // Widen only: the pre-existing families keep their codes (the new matcher
    // sits after every older one).
    assert.equal(
      classifyError(Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" })),
      "RT_E_PROJECT_MISSING",
    );
    assert.equal(
      classifyError(new Error("EPERM: operation not permitted, open 'x'")),
      "RT_E_PERMISSION_DENIED",
    );
  });

  it("maps the connect/DNS errno family to RT_E_NETWORK_UNREACHABLE", () => {
    for (const code of [
      "ECONNREFUSED",
      "ENOTFOUND",
      "EAI_AGAIN",
      "ENETUNREACH",
      "EHOSTUNREACH",
      "ECONNRESET",
    ]) {
      assert.equal(
        classifyError(Object.assign(new Error(`connect ${code} 127.0.0.1:52551`), { code })),
        "RT_E_NETWORK_UNREACHABLE",
        `errno ${code} must not collapse to an opaque code`,
      );
    }
    // Real undici wrapper: the errno hides in .cause (probe G3-3/G3-4).
    const fetchRefused = Object.assign(new Error("fetch failed"), {
      cause: Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:52551"), {
        code: "ECONNREFUSED",
      }),
    });
    assert.equal(classifyError(fetchRefused), "RT_E_NETWORK_UNREACHABLE");
  });

  it("maps a bare 'fetch failed' wrapper only in place of the opaque default (tier-2)", () => {
    assert.equal(classifyError(new TypeError("fetch failed")), "RT_E_NETWORK_UNREACHABLE");
    // Generic wrapper prose must not override a caller's domain fallback —
    // the research seam's own code is a stronger claim than "fetch failed".
    assert.equal(
      classifyError(new TypeError("fetch failed: network down"), "RT_E_RESEARCH_UNAVAILABLE"),
      "RT_E_RESEARCH_UNAVAILABLE",
    );
    assert.equal(
      classifyError(new TypeError("fetch failed"), "RT_E_LLM_REJECTED"),
      "RT_E_LLM_REJECTED",
    );
    // A coded cause still wins: tier-2 runs only after the full chain walk.
    assert.equal(
      classifyError(
        Object.assign(new Error("fetch failed"), {
          cause: Object.assign(new Error("Unknown phase 9"), { code: "RT_E_PHASE_ILLEGAL" }),
        }),
      ),
      "RT_E_PHASE_ILLEGAL",
    );
  });

  it("maps real JSON.parse failures to RT_E_VALIDATION, keeping non-JSON SyntaxErrors opaque", () => {
    const jsonParseError = (text: string): unknown => {
      try {
        JSON.parse(text);
        return null;
      } catch (e) {
        return e;
      }
    };
    // Real V8 shapes (probe, node v22.23.2): three distinct message texts.
    for (const text of ["{oops", "", "{"]) {
      const err = jsonParseError(text);
      assert.ok(err instanceof Error, `JSON.parse(${JSON.stringify(text)}) must have thrown`);
      assert.equal(classifyError(err), "RT_E_VALIDATION");
    }
    // Strong signal: overrides a caller fallback the same way ENOENT does.
    assert.equal(classifyError(jsonParseError("{oops"), "RT_E_LLM_REJECTED"), "RT_E_VALIDATION");
    // A SyntaxError from evaluated CODE is not an input-validation failure.
    assert.equal(classifyError(new SyntaxError("Unexpected token '}'")), "RT_E_UNKNOWN");
    assert.equal(classifyError(new SyntaxError("missing ) after argument list")), "RT_E_UNKNOWN");
  });

  it("keeps genuinely unknown errors on the honest fallback after the G3 additions", () => {
    assert.equal(classifyError(new Error("quantum flux inverted")), "RT_E_UNKNOWN");
    assert.equal(classifyError({ weird: true }), "RT_E_UNKNOWN");
    assert.equal(
      classifyError(new Error("quantum flux inverted"), "RT_E_INTERNAL"),
      "RT_E_INTERNAL",
    );
  });
});

describe("ERROR_CODE_DOC", () => {
  it("has a doc entry for every code", () => {
    for (const code of ERROR_CODES) {
      assert.ok(ERROR_CODE_DOC[code], `missing doc entry for ${code}`);
    }
  });

  it("has exactly the code set as keys (no orphans)", () => {
    const keys = Object.keys(ERROR_CODE_DOC).sort();
    assert.deepEqual(keys, [...ERROR_CODES].sort());
  });

  it("every entry carries a non-empty one-line meaning and agentAction", () => {
    for (const code of ERROR_CODES) {
      const doc = ERROR_CODE_DOC[code];
      assert.ok(doc.meaning.trim().length > 0, `${code} meaning is empty`);
      assert.ok(doc.agentAction.trim().length > 0, `${code} agentAction is empty`);
      // "one line" contract: no embedded newlines.
      assert.ok(!/\n/.test(doc.meaning), `${code} meaning spans lines`);
      assert.ok(!/\n/.test(doc.agentAction), `${code} agentAction spans lines`);
    }
  });

  it("error codes are RT_E_* prefixed and unique", () => {
    for (const code of ERROR_CODES) {
      assert.match(code, /^RT_E_[A-Z_]+$/);
    }
    assert.equal(new Set(ERROR_CODES).size, ERROR_CODES.length);
  });

  it("RT_E_BUSY and RT_E_FOREIGN_FILES stay in ERROR_CODES + ERROR_CODE_DOC", () => {
    assert.ok((ERROR_CODES as readonly string[]).includes("RT_E_BUSY"));
    assert.ok((ERROR_CODES as readonly string[]).includes("RT_E_FOREIGN_FILES"));
    assert.ok(ERROR_CODE_DOC.RT_E_BUSY.meaning.trim().length > 0);
    assert.ok(ERROR_CODE_DOC.RT_E_FOREIGN_FILES.meaning.trim().length > 0);
    assert.ok(ERROR_CODE_DOC.RT_E_BUSY.agentAction.trim().length > 0);
    assert.ok(ERROR_CODE_DOC.RT_E_FOREIGN_FILES.agentAction.trim().length > 0);
  });

  it("W12 G3 additions stay registered with honest docs (append-only)", () => {
    for (const code of [
      "RT_E_PERMISSION_DENIED",
      "RT_E_DISK_FULL",
      "RT_E_PORT_IN_USE",
      "RT_E_NETWORK_UNREACHABLE",
    ] as const) {
      assert.ok(
        (ERROR_CODES as readonly string[]).includes(code),
        `${code} missing from ERROR_CODES`,
      );
      assert.ok(ERROR_CODE_DOC[code].meaning.trim().length > 0, `${code} meaning is empty`);
      assert.ok(ERROR_CODE_DOC[code].agentAction.trim().length > 0, `${code} agentAction is empty`);
    }
  });

  it("310 B3 addition stays registered with an honest doc (append-only)", () => {
    assert.ok(
      (ERROR_CODES as readonly string[]).includes("RT_E_PATH_KIND_MISMATCH"),
      "RT_E_PATH_KIND_MISMATCH missing from ERROR_CODES",
    );
    assert.ok(ERROR_CODE_DOC.RT_E_PATH_KIND_MISMATCH.meaning.trim().length > 0);
    assert.ok(ERROR_CODE_DOC.RT_E_PATH_KIND_MISMATCH.agentAction.trim().length > 0);
    assert.match(ERROR_CODE_DOC.RT_E_PATH_KIND_MISMATCH.meaning, /EISDIR|ENOTDIR/);
  });

  it("345 L2 (A1-07): RT_E_IMPORT_TOO_LARGE is registered with an honest doc", () => {
    assert.ok(
      (ERROR_CODES as readonly string[]).includes("RT_E_IMPORT_TOO_LARGE"),
      "RT_E_IMPORT_TOO_LARGE missing from ERROR_CODES",
    );
    assert.ok(ERROR_CODE_DOC.RT_E_IMPORT_TOO_LARGE.meaning.trim().length > 0);
    assert.ok(ERROR_CODE_DOC.RT_E_IMPORT_TOO_LARGE.agentAction.trim().length > 0);
    assert.match(ERROR_CODE_DOC.RT_E_IMPORT_TOO_LARGE.meaning, /cap|too large/i);
    // The action must name the real escape hatch (maxChars) an agent can use.
    assert.match(ERROR_CODE_DOC.RT_E_IMPORT_TOO_LARGE.agentAction, /maxChars/);
  });

  it("W61 PR-03: the five guard-consumed defect codes are registered with honest docs", () => {
    // RED before PR-03: these strings are referenced as `expectedCode` by
    // scripts/guards/guard-registry.json + scripts/guards/*.mjs (and
    // scripts/prevention/replay-harness.mjs) but were absent from ERROR_CODES,
    // so the "every surfaced failure carries a registry code" invariant was
    // aspirational for them.
    const expectations: { code: string; meaning: RegExp }[] = [
      { code: "RT_E_DUPLICATE_EXPORT", meaning: /TS2308|duplicate/i },
      { code: "RT_E_USE_BEFORE_DECL", meaning: /TS2448|before/i },
      { code: "RT_E_MONEY_SEMANTICS", meaning: /money|price|quantity/i },
      { code: "RT_E_README_PARITY", meaning: /README|manifest/i },
      { code: "RT_E_SRC_EDITED_DURING_RUN", meaning: /src|edit|RUNLOCK|BL-010/i },
    ];
    for (const { code, meaning } of expectations) {
      assert.ok(
        (ERROR_CODES as readonly string[]).includes(code),
        `${code} missing from ERROR_CODES`,
      );
      const doc = ERROR_CODE_DOC[code as (typeof ERROR_CODES)[number]];
      assert.ok(doc, `${code} missing from ERROR_CODE_DOC`);
      assert.ok(doc.meaning.trim().length > 0, `${code} meaning is empty`);
      assert.ok(doc.agentAction.trim().length > 0, `${code} agentAction is empty`);
      assert.match(doc.meaning, meaning, `${code} meaning names the real class`);
    }
  });

  it("W61 PR-03: RT_E_SUBSTANCE_EMPTY and RT_E_PLAN_UNDERPRODUCED are registered with docs", () => {
    for (const code of ["RT_E_SUBSTANCE_EMPTY", "RT_E_PLAN_UNDERPRODUCED"] as const) {
      assert.ok((ERROR_CODES as readonly string[]).includes(code), `${code} missing from ERROR_CODES`);
      const doc = ERROR_CODE_DOC[code];
      assert.ok(doc.meaning.trim().length > 0, `${code} meaning is empty`);
      assert.ok(doc.agentAction.trim().length > 0, `${code} agentAction is empty`);
    }
  });

  it("350: RT_E_SPEC_VACUOUS is registered with an honest doc", () => {
    assert.ok(
      (ERROR_CODES as readonly string[]).includes("RT_E_SPEC_VACUOUS"),
      "RT_E_SPEC_VACUOUS missing from ERROR_CODES",
    );
    const doc = ERROR_CODE_DOC.RT_E_SPEC_VACUOUS;
    assert.ok(doc.meaning.trim().length > 0, "meaning is empty");
    assert.ok(doc.agentAction.trim().length > 0, "agentAction is empty");
    assert.match(doc.meaning, /vacuo|vacuity|no behavioural|shape/i, "the meaning names the class");
  });

  it("W61 final wave G-2: every guard-registry expectedCode resolves in ERROR_CODE_DOC", () => {
    // The proof layer names failure codes as `expectedCode`; a code only the
    // registry believes in is aspirational. Every `RT_E_*` it references must
    // be a real key in ERROR_CODE_DOC, so a guard can never name a code that
    // no failure can actually carry.
    const registryPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "scripts",
      "guards",
      "guard-registry.json",
    );
    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as {
      guards?: { id?: unknown; expectedCode?: unknown }[];
    };
    const referenced = new Map<string, string[]>();
    for (const guard of registry.guards ?? []) {
      const id = typeof guard.id === "string" ? guard.id : "?";
      const raw = typeof guard.expectedCode === "string" ? guard.expectedCode : "";
      for (const code of raw.match(/RT_E_[A-Z0-9_]+/g) ?? []) {
        referenced.set(code, [...(referenced.get(code) ?? []), id]);
      }
    }
    assert.ok((registry.guards ?? []).length > 0, "the guard registry lists guards");
    assert.ok(referenced.size > 0, "the guard registry names at least one RT_E_* code");
    const docKeys = new Set<string>(Object.keys(ERROR_CODE_DOC));
    const aspirational = [...referenced.keys()].filter((code) => !docKeys.has(code));
    assert.deepEqual(
      aspirational,
      [],
      `guard-registry names codes absent from ERROR_CODE_DOC: ${aspirational
        .map((code) => `${code} (${(referenced.get(code) ?? []).join(",")})`)
        .join("; ")}`,
    );
  });
});

// ---- W15-L2 (fixes/241) — registry boundary: the C-2 open item (`RT_EVAL_STALL`
// / `RT_EVAL_REFUSED` absent from the registry) is closed by DECISION
// (declare-or-strike), not by registration. Both strings are the run-eval
// harness's local scoring-evidence labels (scripts/run-eval.mjs — M9's
// `stop.code`, results-row `notes.stopCode`), never thrown and never enveloped;
// their shape fails the registry's `RT_E_*` contract, so they cannot enter it
// as-is, and no EVAL-family code is minted for a case no surfaced failure
// emits. These pins keep it that way.

describe("registry boundary — RT_EVAL_* harness labels (W15-L2 / fixes/241)", () => {
  const HARNESS_LABELS = ["RT_EVAL_STALL", "RT_EVAL_REFUSED"] as const;

  it("keeps the two run-eval labels out of ERROR_CODES and ERROR_CODE_DOC", () => {
    const docKeys: string[] = Object.keys(ERROR_CODE_DOC);
    for (const label of HARNESS_LABELS) {
      assert.ok(
        !(ERROR_CODES as readonly string[]).includes(label),
        `${label} is a harness evidence label, not a registry code`,
      );
      assert.ok(!docKeys.includes(label), `${label} must not get a doc entry`);
    }
  });

  it("documents why they cannot be registered as-is: RT_EVAL* is not the RT_E_* shape", () => {
    for (const label of HARNESS_LABELS) {
      assert.doesNotMatch(label, /^RT_E_[A-Z_]+$/);
    }
    // ...and every real code DOES match that shape (the ERROR_CODE_DOC block
    // above pins it) — the shape is the boundary, not the field name.
  });

  it("classifyError degrades a non-RT_E_ label to the honest fallback (not preserved as a code)", () => {
    const stalled = (code: string): Error =>
      Object.assign(new Error("drain ended without a terminal state"), { code });
    assert.equal(classifyError(stalled("RT_EVAL_STALL")), "RT_E_UNKNOWN");
    assert.equal(classifyError(stalled("RT_EVAL_REFUSED")), "RT_E_UNKNOWN");
    assert.equal(classifyError(stalled("RT_EVAL_STALL"), "RT_E_INTERNAL"), "RT_E_INTERNAL");
    // Contrast — a real registry code in the same position IS preserved:
    assert.equal(classifyError(stalled("RT_E_BUDGET_EXHAUSTED")), "RT_E_BUDGET_EXHAUSTED");
  });
});

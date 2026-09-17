// ---------------------------------------------------------------------------
// errors.test.ts — machine-readable error-code system (48 chat/errors wave).
// Run: node --experimental-strip-types --test src/lib/errors.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
});

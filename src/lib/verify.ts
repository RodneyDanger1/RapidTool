// ---------------------------------------------------------------------------
// verify.ts — client-safe seam for the machine-run verify-fix loop (A3-05).
//
// HONEST DISPOSITION (fixes/134 T1.2, TOP-10 #7): the Oracle tab's
// "Run machine verify" affordance (store.runVerifyAsync) triggers this shim —
// it posts the project's generatedSource + brief to verify.server
// verifyAndFixServer and applies the returned outcome locally via
// applyVerifyOutcome (defined at the bottom of this module). The audit-46
// export binding (withCommonJsExports, moved here from headless.ts) is
// applied before the loop runs, so engine-template sources that declare
// top-level functions without module.exports actually execute inside the
// harness's `with(exports)` oracle instead of failing every case with
// "X is not defined". Whole-project/CLI callers keep using
// headless.verifyGeneratedSource — headless re-exports the helpers defined
// here so there is ONE implementation; they live in this browser-safe module
// because the store (client bundle) must apply an outcome locally without
// pulling headless.ts's server-only node:fs surface into the browser.
//
// Outcome honesty: passed → the project converges (lastTest label "tested" +
// evidenceHash, verify artifact + verify.pass log, P6 gate + packet re-stamped
// when P6 is complete); failed/error → verify.fail artifact + warn log, NO
// tested label; not-configured (no DEEPSEEK_API_KEY server-side) → no state
// change. On transport failure an `{ status: "error" }` envelope is returned —
// never a fabricated verdict.
// ---------------------------------------------------------------------------
import { createServerFn } from "@tanstack/react-start";
import { fnv1a } from "./algorithms.ts";
import { recordGateInto } from "./dod.ts";
import { accrueReproducedCounts, isLessonMemoryId, stampPacket } from "./engine.ts";
import type { Artifact, ArtifactKind, JsonLog, MemoryEntry, PhaseId, Project } from "./types.ts";
import type { VerifyOutcome } from "./verify.server.ts";

export type { VerifyOutcome } from "./verify.server.ts";

const verifyServer = createServerFn({ method: "POST" })
  .validator((input: { source: string; brief: string; maxIterations?: number }) => input)
  .handler(async ({ data }) => {
    const { verifyAndFixServer } = await import("./verify.server.ts");
    // audit-46 binding (see the header): without it, engine-template sources
    // that declare top-level functions but export nothing fail every oracle
    // case with "X is not defined" inside the harness's with(exports).
    return verifyAndFixServer(withCommonJsExports(data.source), data.brief, {
      maxIterations: data.maxIterations,
    });
  });

/** Injected server seam (exec.ts runner-parity) for tests. */
export type VerifyServerFn = (
  source: string,
  brief: string,
  opts?: { maxIterations?: number },
) => Promise<VerifyOutcome>;

/**
 * Raw source/brief verify-fix loop over the server harness — the Oracle tab's
 * "Run machine verify" action (store.runVerifyAsync) calls this with the
 * project's generatedSource + brief and applies the outcome locally. Returns
 * the honest typed outcome; on transport failure an `{ status: "error" }`
 * envelope — never fabricated verdicts.
 */
export async function verifyAndFix(
  source: string,
  brief: string,
  opts?: { maxIterations?: number; server?: VerifyServerFn | null },
): Promise<VerifyOutcome> {
  if (typeof source !== "string" || source.trim().length === 0) {
    return { status: "error", iterations: 0, evidence: "empty source" };
  }
  // Test/dev dependency injection: an explicit `server` bypasses the
  // createServerFn round-trip; `null` models an unavailable transport without
  // inventing a verdict.
  if (opts?.server !== undefined) {
    return opts.server
      ? opts.server(source, brief, { maxIterations: opts.maxIterations })
      : {
          status: "not-configured",
          iterations: 0,
          evidence: "no verify transport (injected server: null)",
        };
  }
  try {
    return await verifyServer({ data: { source, brief, maxIterations: opts?.maxIterations } });
  } catch (err) {
    return {
      status: "error",
      iterations: 0,
      evidence: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Shape of the whole-project verify outcome (moved here from headless.ts —
 * headless re-exports it). Structurally a superset-tolerant view of
 * verify.server's VerifyOutcome. 341-3: the B4 `lint` block the server
 * produces is now part of this view too — applyVerifyOutcome renders it into
 * the verify artifact body, so the produced field has a real consumer rather
 * than dying after the one-line evidence summary.
 */
export type VerifyOutcomeShape = {
  status: "passed" | "failed" | "not-configured" | "error";
  iterations: number;
  evidence: string;
  /** W61 lane D (D2 / I3): the real top-level error class (absent on a pass) —
   *  the contract the CLI/store branch on instead of classifying prose
   *  (RT_E_UNKNOWN). See verify.server.ts VerifyOutcome.code. */
  code?: VerifyOutcome["code"];
  finalSource?: string;
  cases?: unknown[];
  /** B4 lint-advisory findings (verify.server.ts's LintFailure[], structurally).
   *  ADVISORY ONLY — never gates or weakens a machine pass. */
  lint?: VerifyOutcome["lint"];
  /** L3 (failed/error) or L4 (passed) lesson row minted by verify.server.ts's
   *  outcome seam — applyVerifyOutcome appends it to project memory. */
  lesson?: MemoryEntry;
  /** 216i (112 §4.3 — T2): the counterexample-or-nothing refusal envelope
   *  (verify.server.ts's `LessonRefusal`, structurally). NO lesson row exists
   *  on this path; applyVerifyOutcome appends `log` to project.logs as the
   *  visible `lesson.refused` row — never a silent no-op. */
  lessonRefused?: VerifyOutcome["lessonRefused"];
};

/**
 * audit-46 export binding: appends guarded CommonJS export assignments for the
 * source's top-level function declarations so verify.server's oracle harness
 * (which binds expressions via `with(exports)`) can actually call them. No-op
 * when the source already ASSIGNS `module.exports` or declares no top-level
 * function declaration. (The `module.exports` guard does not detect the
 * `exports.x = …` style; if such a source also declares a function, the
 * appended `module.exports` alias is redundant but harmless — the harness
 * folds both CJS styles onto one exports object.)
 *
 * 341-3: the declaration forms covered are the FUNCTION-DECLARATION family —
 * plain, `async`, generator (`function*`), and async generator — each also
 * optionally preceded by `export` (an ESM source still refuses upstream in
 * `esmModuleUnsupportedReason`; binding it here never fabricates a pass). What
 * is deliberately NOT covered: `const f = () => {}` / `const f = function(){}`
 * function-VALUES and class declarations. Those still yield an honest
 * `NO_CALLABLE_EXPORTS` refusal rather than a guessed binding — a bounded text
 * transform cannot distinguish a function value from any other initializer, and
 * a wrong binding would assert an export the module never declared.
 */
export function withCommonJsExports(source: string): string {
  // W40 N1 (H1 leftover): a non-string source has no top-level functions to
  // bind — the honest transform result is the empty source, never a crash.
  if (typeof source !== "string") return "";
  const fns = [
    ...source.matchAll(/^(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/gm),
  ].map((m) => m[1]);
  const unique = [...new Set(fns)];
  if (unique.length === 0) return source; // not a function-module source — honest no-op
  if (/module\.exports/.test(source)) return source; // already assigns module.exports — no-op
  const block = unique
    .map((f) => `if (typeof module !== "undefined" && module.exports) module.exports.${f} = ${f};`)
    .join("\n");
  return `${source}\n${block}\n`;
}

/**
 * E-06: persist a machine verify outcome into the project (pure, never throws;
 * moved here from headless.ts so the client store can apply outcomes without
 * headless's server-only fs surface — headless re-exports this function).
 * - `passed`  → stamps `lastTest` as a machine-tested verdict (label "tested" +
 *   evidenceHash over finalSource+evidence), appends a "verify" artifact
 *   (evidence + cases + iterations) and a `verify.pass` log.
 * - `failed` / `error` → appends a `verify.fail` artifact + warn log with the
 *   evidence. NO labels are minted (an untested verdict must never look like a
 *   machine pass).
 * - `not-configured` → no artifact, no state change (returns the same reference).
 *
 * 216i (112 T1/T2): `outcome.lesson`'s L3 row is appended once and a repeated
 * identical failure accrues `reproducedCount` on the ONE stored row
 * (`lesson.reproduced`); `outcome.lessonRefused` (the §4.3 refusal envelope)
 * appends its visible `lesson.refused` row to project.logs instead — a refusal
 * is never a silent no-op.
 *
 * P0-09 convergence: a PASSED machine verify converges the recorded state —
 * stored `generatedSource` becomes the machine-verified source, and when P6 is
 * complete the P6 gate is re-recorded (recordGateInto) and the packet
 * re-stamped, so gate_passed and the recorded gate agree with reality by
 * construction. Re-apply of the SAME outcome is deduped (23 CAVEAT-2): a
 * re-apply whose evidenceHash already matches the stored tested verdict
 * returns the same reference — no duplicate verify artifacts/logs.
 */
export function applyVerifyOutcome(project: Project, outcome: VerifyOutcomeShape): Project {
  // W40 N1 (H1 leftover): a junk outcome (null/non-object/statusless) is the
  // same no-state-change path as not-configured — never deref a foreign shape.
  if (!outcome || typeof outcome.status !== "string" || outcome.status === "not-configured") return project;
  // 339-6 + 340-3: a `passed` status is a CLAIM; only a genuine runner pass may
  // mint `tested`. verify.server.ts's runner always returns the evidence of the
  // run — a non-empty evidence string, the non-empty case set it evaluated, AND
  // the finalSource it executed. An envelope claiming "passed" with an ABSENT or
  // empty `cases` field, with no evidence text, or with no final source is
  // hollow: it is refused on this same no-state-change path (never a fabricated
  // verdict) instead of stamping a `tested` label that maker-score M4 /
  // judgment.ts read as machine proof (they check label+hash, not the detail
  // dod.ts p6-verified checks). The case set is required because runCases() is
  // refuse-to-run on zero cases, and the finalSource because convergence is
  // impossible without the bytes the harness actually ran. 341-3 (verifier B,
  // 340-8 §2): the case set must also carry at least ONE runnable expression —
  // a non-empty-but-junk `[null, 42, {}]` is not a case set, and minting
  // `tested` from it is machine proof for a run that never happened.
  const evidence = typeof outcome.evidence === "string" ? outcome.evidence : "";
  const caseSet = Array.isArray(outcome.cases) ? outcome.cases : null;
  const hasFinalSource =
    typeof outcome.finalSource === "string" && outcome.finalSource.trim().length > 0;
  const hasRunnableCase =
    caseSet !== null &&
    caseSet.some((c) => {
      const row = c as { expression?: unknown } | null | undefined;
      return (
        !!row &&
        typeof row === "object" &&
        typeof row.expression === "string" &&
        row.expression.trim().length > 0
      );
    });
  if (
    outcome.status === "passed" &&
    (evidence.trim().length === 0 ||
      caseSet === null ||
      caseSet.length === 0 ||
      !hasRunnableCase ||
      !hasFinalSource)
  ) {
    return project;
  }
  const passed = outcome.status === "passed";
  const now = Date.now();
  // The hash must separate its two inputs: concatenating finalSource+evidence
  // without a boundary let two different verified outcomes (("ab","c") vs
  // ("a","bc") → "abc") mint the same stamp, so the second was dropped as a
  // "duplicate" and the record kept the first source. \u0002 is the repo's
  // row-hash separator (packet.ts packetInputHash); it names the boundary for
  // every input the verifier produces. (A field that itself contained \u0002
  // stays theoretically ambiguous — a length prefix would be strictly safer —
  // but no verifier output carries one.)
  // 338-6: the ORACLE CASE SET is the other runCases() input that decides the
  // verdict, so it is committed too. Without it, two outcomes with the same
  // source+evidence but a DIFFERENT case set minted the same hash and the
  // second genuine verification was silently dropped as a "duplicate". The
  // commitment is the [id, expression] pairs in order (values only, so no
  // object-key-order dependence). The codegen.server.ts twins
  // (verifyEvidenceHash, shared by verifyOutcomeArtifact + upgraded) now use
  // this same three-part formula.
  const caseCommitment = JSON.stringify(
    (Array.isArray(outcome.cases) ? outcome.cases : []).map((c) => {
      const row = c as { id?: unknown; expression?: unknown } | null | undefined;
      return [
        typeof row?.id === "string" ? row.id : "",
        typeof row?.expression === "string" ? row.expression : "",
      ];
    }),
  );
  const evidenceHash = String(fnv1a(`${outcome.finalSource ?? ""}\u0002${evidence}\u0002${caseCommitment}`));
  // P0-09 dedupe (23 CAVEAT-2): same-hash re-apply is a no-op (same reference).
  const prior = project.lastTest as { label?: string; evidenceHash?: string } | null;
  if (passed && prior?.label === "tested" && prior.evidenceHash === evidenceHash) {
    return project;
  }
  // 339-6: a foreign `cases` value (non-array) must not throw into the caller —
  // this seam's contract is "pure, never throws". Only an array carries cases.
  const caseLines: string[] = [];
  for (const c of Array.isArray(outcome.cases) ? outcome.cases : []) {
    const row = c as { id?: unknown; expression?: unknown } | null | undefined;
    if (!row || typeof row !== "object") continue;
    const id = typeof row.id === "string" ? row.id : "";
    const expression = typeof row.expression === "string" ? row.expression : "";
    caseLines.push(`- ${id}: ${expression}`);
  }
  // 341-3: the B4 lint block verify.server.ts produces gets its reader here —
  // the structured findings (rule/occurrences/first line/message) render into
  // the verify artifact, so the produced field reaches the delivered packet
  // instead of dying after the one-line evidence summary. ADVISORY: this never
  // blocks or weakens the mint above (a lint-bearing pass is still a pass).
  const lintRows: string[] = [];
  for (const f of Array.isArray(outcome.lint) ? outcome.lint : []) {
    if (!f || typeof f !== "object" || typeof f.rule !== "string") continue;
    const occurrences = typeof f.occurrences === "number" ? f.occurrences : 1;
    const at = typeof f.firstLine === "number" ? `L${f.firstLine}` : "line ?";
    lintRows.push(`- ${f.rule} ×${occurrences} @${at} — ${typeof f.message === "string" ? f.message : ""}`);
  }
  const body = [
    `# Verify outcome — ${passed ? "PASSED (machine-run)" : outcome.status.toUpperCase()}`,
    "",
    evidence || "(no evidence text)",
    `Iterations: ${typeof outcome.iterations === "number" ? outcome.iterations : 0}`,
    ...(caseLines.length > 0 ? ["", "Cases:", ...caseLines] : []),
    ...(lintRows.length > 0 ? ["", "Lint advisory (non-blocking):", ...lintRows] : []),
  ].join("\n");
  const artifact: Artifact = {
    id: `verify-${outcome.status}-${evidenceHash.slice(0, 8)}`,
    phase: 6,
    kind:
      // "verify" joins ArtifactKind with E-07 (sibling-owned types.ts); the
      // double cast keeps this compiling whether or not that member has
      // landed yet — the runtime value is "verify" either way.
      "verify" as unknown as ArtifactKind,
    title: `Verify outcome — ${passed ? "passed (machine-run)" : outcome.status}`,
    body,
    language: "markdown",
  };
  // lastTest: built as a structural value and spread (NOT an inline literal) so
  // the E-07 superset fields (label/evidenceHash) compile before types.ts
  // carries them; once it does, they hydrate unchanged.
  const lastTest = passed
    ? { ok: true as const, detail: evidence, label: "tested" as const, evidenceHash }
    : project.lastTest;
  // P0-09: a passed verdict replaces generatedSource with the machine-verified
  // source (the code the harness actually ran — never a pre-verify shape).
  const finalSource =
    passed && typeof outcome.finalSource === "string" && outcome.finalSource.trim()
      ? outcome.finalSource.trim()
      : null;
  // L3/L4 lesson capture (fixes/98 §2.3 writer 2(c)/3): append the lesson row
  // minted at verify.server.ts's outcome seam to project memory. Idempotent:
  // the id is content-addressed and an existing twin is dropped (H43-P2-1).
  // 216i (112 §4.2 — T1): a repeated identical failure re-derives the SAME
  // signature-based id — the honest record is ONE row whose `reproducedCount`
  // accrues (with a visible `lesson.reproduced` ledger row), never a dropped
  // occurrence and never a forked twin.
  const lesson = outcome.lesson as MemoryEntry | undefined;
  const memoryRows = project.memory ?? [];
  const hasLesson = !!lesson && memoryRows.some((m) => m.id === lesson.id);
  const reproduced = hasLesson && !!lesson && isLessonMemoryId(lesson.id);
  const memory =
    reproduced && lesson
      ? accrueReproducedCounts([lesson, ...memoryRows]).slice(-80)
      : lesson && !hasLesson
        ? [...memoryRows, lesson].slice(-80)
        : memoryRows;
  const accrued =
    reproduced && lesson
      ? (memory.find((m) => m.id === lesson.id)?.reproducedCount ?? 0)
      : 0;
  // 216i (112 §4.3 — T2): the counterexample-or-nothing refusal. A refused L3
  // mint produced NO lesson row; its visible record is the `lesson.refused`
  // payload verify.server.ts put on the outcome — appended here so a real run
  // can never swallow the refusal silently (112 §2.4).
  const refusal = outcome.lessonRefused;
  const refusalRow: JsonLog | null =
    refusal && refusal.log && typeof refusal.log.detail === "string" && refusal.log.detail !== ""
      ? {
          ts: now,
          phase: 6 as PhaseId,
          level: refusal.log.level,
          event: "lesson.refused",
          detail: refusal.log.detail,
        }
      : null;
  const updated: Project = {
    ...project,
    lastTest,
    ...(finalSource !== null ? { generatedSource: finalSource } : {}),
    artifacts: [...(project.artifacts ?? []), artifact],
    memory,
    logs: [
      ...(project.logs ?? []),
      {
        ts: now,
        phase: 6 as PhaseId,
        level: passed ? ("info" as const) : ("warn" as const),
        event: passed ? "verify.pass" : "verify.fail",
        detail: `${outcome.status} · ${evidence.slice(0, 160) || "(no evidence text)"}`,
      },
      ...(lesson && !hasLesson
        ? [
            {
              ts: now,
              phase: 6 as PhaseId,
              level: "info" as const,
              event: "lesson.capture",
              detail: `${passed ? "L4 verified-procedure" : "L3 verify-failure"} ${lesson.id} (verify ${outcome.status})`,
            },
          ]
        : []),
      ...(reproduced && lesson
        ? [
            {
              ts: now,
              phase: 6 as PhaseId,
              level: "info" as const,
              event: "lesson.reproduced",
              detail: `${passed ? "L4 verified-procedure" : "L3 verify-failure"} ${lesson.id} reproduced (verify ${outcome.status} again; reproducedCount=${accrued})`,
            },
          ]
        : []),
      ...(refusalRow ? [refusalRow] : []),
    ].slice(-200),
  };
  if (!passed) return updated;
  // P0-09 convergence: re-record the P6 gate (no-op unless P6 is complete)
  // and re-stamp the packet so gate_passed + the artifact window reflect the
  // machine-verified state.
  return stampPacket(recordGateInto(updated, 6));
}

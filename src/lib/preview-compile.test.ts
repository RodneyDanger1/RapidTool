// ---------------------------------------------------------------------------
// preview-compile.test.ts — the client contract of the preview transpiler
// (src/lib/preview-compile.ts).
//
// The component must never receive a thrown transport error: outside a Start
// request context (this bare-Node test) the server function is unavailable and
// the wrapper has to answer with the honest typed refusal the preview renders.
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compilePreviewModules } from "./preview-compile.ts";

describe("compilePreviewModules (client contract)", () => {
  it("returns an honest typed envelope when the server transport is unavailable", async () => {
    const res = await compilePreviewModules([{ path: "src/x.ts", body: "export const x = 1;\n" }]);
    assert.equal(typeof res, "object");
    assert.equal(res.ok, false, "no Start context ⇒ the transport cannot run the compiler");
    assert.ok(
      typeof res.error === "string" && res.error.length > 0,
      "the refusal carries a human-readable reason",
    );
  });
});

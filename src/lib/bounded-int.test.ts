// ---------------------------------------------------------------------------
// bounded-int.test.ts — W40 · N4: pins the shared knob sanitizer that used to
// live (byte-identically) in both search providers. Run:
//   node --experimental-strip-types --test src/lib/bounded-int.test.ts
// ---------------------------------------------------------------------------

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { boundedInt } from "./bounded-int.ts";

describe("boundedInt — finite ints in [min, max], else the fallback", () => {
  it("passes in-range numbers through (floored)", () => {
    assert.equal(boundedInt(5, 9, 1, 20), 5);
    assert.equal(boundedInt(3.9, 9, 1, 20), 3);
  });

  it("clamps to the ceiling and floors at the minimum", () => {
    assert.equal(boundedInt(1e9, 9, 1, 20), 20);
    assert.equal(boundedInt(0, 9, 1, 20), 9, "below-min values take the fallback, not min");
    assert.equal(boundedInt(1, 9, 1, 20), 1);
  });

  it("returns the fallback for every hostile/typo'd shape", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "5", null, undefined, {}, []]) {
      assert.equal(boundedInt(bad, 7, 1, 20), 7, `${String(bad)} must never reach the wire`);
    }
  });

  it("never returns a non-integer", () => {
    assert.equal(Number.isInteger(boundedInt(2.999, 9, 1, 20)), true);
  });
});

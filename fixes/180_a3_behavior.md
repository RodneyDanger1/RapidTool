# 180 — A3 behavioral assertion, not mere load (landed)

Parent enacted 162/170-B **A3** in `compile-check.server.ts` `runSpecFile`.

## Rule

`tests.pass` / `run:"pass"` requires BOTH:
1. TAP `# pass > 0` and `# tests > 0` (skip-only / empty file → fail)
2. Spec **source** contains an `assert.*` call (Node TAP counts tests, not assertions; `test("load", () => {})` prints `# pass 1` with zero asserts)

Otherwise: `run:"fail"`, `tests.pass = 0`, `detail: "no behavioral assertion ran"`.

## Tests (owned)

`compile-check.server.test.ts` **14/14**:
- load-only import → fail
- empty `test("load")` → fail
- `add(2,2) === 4` → pass

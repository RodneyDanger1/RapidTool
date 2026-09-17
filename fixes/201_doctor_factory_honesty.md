# 201 — doctor factory honesty (agent API)

`doctor` now returns a `factory` object so an external agent with
`DEEPSEEK_API_KEY` cannot infer “this is a software factory” from
`llm.configured: true`.

- `autonomousSoftwareFactory: false` (literal)
- `leftoverJobsAreReexportsOrStubs: true`
- `chatHasSlashToolsOnly: true`
- `runner.sandbox: false` + `isolation` from `sandbox-policy.ts`
- `tokenCap` from `RAPIDTOOL_TOKEN_CAP` (null if unset)

This does **not** implement per-job P6 synthesis. Inventing flip/record/show/publish bodies would fake-green the maker test.

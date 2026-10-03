# 342-5 — MCP consumer wiring + the failover verdict (append-only)

**Actor:** engineer 342-5 (MCP wiring + failover arming).
**Owned files (STRICT):** `src/lib/doctor.ts`, `src/lib/mcp.server.ts`,
`src/lib/mcp.server.test.ts`, `src/lib/llm/providers/registry.ts`,
`src/lib/llm/providers/registry.test.ts`, `scripts/rapidtool-cli.mjs`,
`scripts/cli-exit-taxonomy.test.mjs`, this log. Nothing else edited.
**Root:** `C:\Users\mnril\Desktop\RapidTool Main` (git `main`, HEAD `686d7b6` at open —
observed dirty later with other lanes' files; see §7).
**Runtimes:** host `node` v24.15.0 and pinned `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2.
Every run uses `--test-reporter=tap`. **Scratch:** `%TEMP%\rt342_5\`.
**Keyed budget:** **0** (MCP exercises a real local stub child; the registry uses injected providers/env).
**No full gate.** No tracked-file deletion. No secret handled.

---

## 0. What was asked, what landed

| Mission | Result |
|---|---|
| MCP consumer, owner-gated OFF by default, real `tools/list` only when enabled+configured, coded `RT_E_MCP_DISABLED` when off | **LANDED** — doctor surface + `doctor` verb wiring (§1–§3) |
| Failover: arm if the bytes allow, else keep the loud refusal and name the exact missing piece | **DECIDED: keep the loud refusal**; the gap is now byte-derived and names all three missing pieces (§4) |
| RED-first tests for both, real local stubs / injected providers | **DONE** (§5) |
| Targeted suites, both runtimes | **GREEN** — MCP 38/38, registry 51/51, CLI taxonomy 42/42 on both (§6) |

---

## 1. The MCP consumer (file:line)

The seam from 340-1 (`connectMcpServer` / `listTools` / `callTool`) had **no caller**
(`grep -rn connectMcpServer src scripts` hit only `mcp.server.ts` + its test). It now has one:
the `doctor` capability pre-flight.

- `src/lib/mcp.server.ts:640,644,647` — the env config contract:
  `RAPIDTOOL_MCP_SERVER` (the executable), `RAPIDTOOL_MCP_ARGS` (JSON string array, or a
  whitespace list), `RAPIDTOOL_MCP_CWD` (optional).
- `src/lib/mcp.server.ts:683` — `resolveMcpServerConfig(env)`: **pure**, no I/O. Unset/blank
  command ⇒ `configured:false` (the default, not an error); a malformed args value ⇒ coded
  `RT_E_VALIDATION` (never a silent drop that would spawn the wrong argv).
- `src/lib/mcp.server.ts:705` — `McpToolsSurface` (the honest shape; `tools` is `null` whenever
  nothing was listed, so a fabricated list is unrepresentable).
- `src/lib/mcp.server.ts:745` — `mcpToolsSurface(options)`: the ONE consumer surface. Gate FIRST
  → config → spawn → `tools/list` (+ optional read-only call) → close. `spawnAttempted` is true
  only when `connectMcpServer` was invoked.
- `src/lib/doctor.ts:825` — `doctorMcp(options)`: the doctor surface, a thin lazy-import wrapper
  over `mcpToolsSurface` (mirrors `doctorProviderTeam`'s lazy seam; `src/lib/doctor.ts:57-58`
  are TYPE-ONLY imports, so doctor.ts's static graph stays client-safe).
- `scripts/rapidtool-cli.mjs:475` — `doctorDriver()` lazy-imports `doctor.ts`;
  `scripts/rapidtool-cli.mjs:4654-4701` — the `doctor` arm resolves the gate, calls `doctorMcp`,
  and merges `mcp` into the envelope. An EXPLICIT `--mcp-call <tool>` is a request, so its
  refusal is the process's coded failure (`:4698`); a plain `doctor` reports the gate as data.

**No new `case "` arm was added.** Adding one would change `grep -c 'case "'` from 39 → 41 and
require updates to `scripts/README-cli.md` + `scripts/README-cli.test.mjs`, both outside this
lane's ownership — a ready-to-apply change shape is STOP-and-REPORTed in §7(a). The mission's
"and/or a CLI verb" is satisfied by the `doctor` surface + its `--mcp-call` flag.

### Off-by-default proof (real bytes)

`doctor` with `RAPIDTOOL_MCP_SERVER=<a binary that cannot exist>` and `RAPIDTOOL_MCP_ENABLED` unset:

```
"mcp": {
  "enabled": false,
  "configured": true,
  "spawnAttempted": false,
  "tools": null,
  "refusal": { "code": "RT_E_MCP_DISABLED", ... },
  "line": "mcp: disabled (RAPIDTOOL_MCP_ENABLED unset/false) — 0 child spawned, no tool list fabricated"
}
```

The configured command is a missing binary: had the gate leaked and spawned, the code would have
been `RT_E_RUNNER_FAILED`. It is `RT_E_MCP_DISABLED` ⇒ **no spawn**. `spawnAttempted:false` and
`tools:null` are pinned by the behavioral test `342-5 — MCP OFF by default` and by the unit test
`disabled + configured: RT_E_MCP_DISABLED with zero spawn, zero tools`.

`doctor --mcp-call echo` while OFF: **exit 1, `code:"RT_E_MCP_DISABLED"`, `spawnAttempted:false`.**

Enabled + configured (`RAPIDTOOL_MCP_SERVER=<node>`, `RAPIDTOOL_MCP_ARGS=[…stub-server.ts…]`):

```
"mcp": { "enabled": true, "configured": true, "spawnAttempted": true,
         "serverInfo": { "name": "stub-mcp", "version": "0.0.1" },
         "tools": [ {"name":"echo"}, {"name":"env"}, {"name":"write_thing"} ],
         "call": {"tool":"echo","content":[{"type":"text","text":"hi-342-5"}]},
         "refusal": null,
         "line": "mcp: enabled — 3 tool(s) listed from stub-mcp 0.0.1; called read-only \"echo\"" }
```

The list comes from the server's own response over a real stdio pipe; `write_thing` is listed but
`readOnly:false`, and `--mcp-call delete_everything` (unlisted) refuses `RT_E_VALIDATION`
("did not list a tool named …") — a tool is never invented.

---

## 2. Enablement stays an explicit owner decision

- Default **OFF**: `mcpEnabled` is true only for `RAPIDTOOL_MCP_ENABLED` = `1`/`true`.
- No silent spawn: the gate is checked before any spawn, even when a server is configured.
- No simulator: `tools` is either the server's real list or `null`; there is no fabricated list.
- The gate is not weakened; no default value is set anywhere.
- `runReadOnlyToolRoundTrip` (the 340-1 helper) is not called by the surface — the surface reuses
  the SAME live client it listed on (`client.callTool`), which avoids a second connection. The
  client itself (`connectMcpServer`/`listTools`/`callTool`) now has a production consumer.

---

## 3. `doctor` verb wiring + flags

- `doctor` now always carries a `mcp` field (`enabled`/`configured`/`spawnAttempted`/`serverInfo`/
  `protocolVersion`/`tools`/`call`/`refusal`/`line`). Disabled is a **status**, not a doctor
  failure ⇒ exit 0.
- `doctor --mcp-call <tool> [--mcp-call-args <json>]` exercises the F1 read-only round-trip on
  the same client; a refusal here IS the process's coded failure (exit 1). A valueless
  `--mcp-call`/`--mcp-call-args` and a non-object `--mcp-call-args` are coded `RT_E_VALIDATION`
  refusals (`scripts/rapidtool-cli.mjs:4654-4688`).
- `USAGE.doctor` documents the flags and the off-by-default contract.

---

## 4. Failover — decision from the bytes: **cannot be honestly armed; the loud refusal stays**

### 4.1 The bytes (measured)

- `PROVIDERS` = `[deepseek, xai]` (`registry.ts:184`). `deepseek` is dispatchable
  (`requestModelIds` = flash+pro, `verification.kind:"static"`). `xai` is a **CANDIDATE**:
  `requestModelIds: []` (`openai-compatible.ts:194`) and `isConfigured()` reads `XAI_API_KEY`,
  which is unset on this host.
- `resolveFallbackChain` validates ids against `PROVIDERS` only (`registry.ts:296-332`), so a
  chain can name only those two.
- **No registration seam exists.** `probeProviderModels` → `applyProbedModels` **MINTS** a fresh
  verified descriptor (`openai-compatible.ts:210-258`) but never mutates/registers it into
  `PROVIDERS`; `getProvider` searches only `PROVIDERS`. So even a live probe cannot make
  `RAPIDTOOL_FALLBACK_PROVIDERS=xai` see a verified xai descriptor.
- Every role tier routes to `deepseek` (`ROLE_TIERS`, `registry.ts:494-521`); the default env
  selection is also `deepseek`.

### 4.2 Why arming would be an over-claim

A router can only fail over to a chain entry that is BOTH **dispatchable** (≥1 verified request
id, else `complete` refuses on the candidate rule) AND a **different family** than the primary.
Neither holds: `xai` has 0 ids (undispatchable) and `deepseek` is the primary's own family
(a same-family retry, not failover). Arming a router over this registry would be a no-op or a
mislabeled retry. Arming it only for an **injected** primary (a test-only descriptor) would make
it "armed in tests, unreachable in production" — the same over-claim in a different costume.

### 4.3 What changed (keep the refusal, name the exact gap)

- `src/lib/llm/providers/registry.ts:319` — `failoverArmingGap(ids, primaryId)`: derives the
  reason from the registry's OWN descriptors (never a hardcoded promise). It reports, per chain
  entry, whether it is an unregistered id, a candidate with 0 ids, the same family as the
  primary, or dispatchable-only-without-a-router.
- `src/lib/llm/providers/registry.ts:748-760` — the `callModel` refusal now interpolates that gap
  and names the three exact missing pieces: **(1)** a probe-verified second-family descriptor
  **REGISTERED** in `PROVIDERS`; **(2)** the transient-class per-call router + served-provider
  provenance — provenance has NO field on `LlmResult` (`src/lib/llm.ts:64-81`, outside this
  module), so arming also needs that type widened; **(3)** the owner's keyed evidence wave.
  `TODO(R13-f09)` stays (genuinely open), and `/NOT ARMED/` + the env var name are preserved so
  the pre-existing `registry-failover.test.ts` pins still hold.
- The module header (`registry.ts:41-48`) now states the same byte reason instead of the generic
  "cross-family routing is deferred".

**Evidence (measured):** `RAPIDTOOL_FALLBACK_PROVIDERS=xai` with an injected spy `fetch` →
`RT_E_VALIDATION`, message contains `"xai" is a CANDIDATE with 0 verified request ids … no seam
REGISTERS it in PROVIDERS`, **0 fetch calls**. `=deepseek` → message contains `SAME family the
primary routes to`, 0 fetch calls. Unset → the keyless `RT_E_NOT_CONFIGURED` floor is unchanged.

---

## 5. RED-first evidence

### MCP (before any implementation)

Adding the tests + new named imports to the existing `mcp.server.test.ts` first:

```
# SyntaxError: The requested module './mcp.server.ts' does not provide an export named 'MCP_ARGS_ENV'
# tests 1  # pass 0  # fail 1   (host v24.15.0, EXIT=1)
```

(module/export-new RED: the consumer surface did not exist.)

### Failover (before the comment/message change)

New tests in `registry.test.ts` against the OLD generic refusal:

```
# tests 44  # pass 42  # fail 2   (host v24.15.0, EXIT=1)
  not ok … the only registered second family (xai) is a CANDIDATE with 0 ids … refuses with the exact gap
    The input did not match the regular expression /"xai" is a CANDIDATE with 0 verified request ids/. Input:
  not ok … a chain naming only the role-tier family (deepseek) refuses — a same-family retry is not failover
    The input did not match the regular expression /SAME family the primary routes to/. Input:
```

The other two new pins (the byte-derived gap; the unset keyless floor) were already GREEN — they
freeze the bytes the verdict rests on rather than asserting a change.

---

## 6. GREEN — both runtimes (targeted suites)

| Suite | host v24.15.0 | Node v22.23.2 |
|---|---|---|
| `src/lib/mcp.server.test.ts` | **38 / 38** pass, fail 0 | **38 / 38** pass, fail 0 |
| `src/lib/llm/providers/registry.test.ts` + `registry-failover.test.ts` | **51 / 51** pass, fail 0 | **51 / 51** pass, fail 0 |
| `scripts/cli-exit-taxonomy.test.mjs` | **42 / 42** pass, fail 0 | **42 / 42** pass, fail 0 |

Safety check outside ownership (did not edit): `scripts/README-cli.test.mjs` **12 / 12** (the verb
count is untouched — no new arm), and `npm run typecheck` **exit 0** (incl. its scripts-typecheck
guard "rapidtool-cli.mjs and its taxonomy test are clean and unbudgeted").

---

## 7. STOP-and-REPORT (needed changes outside this lane's ownership)

**(a) A first-class CLI verb (`mcp-tools` / `mcp-call`) is ready but blocked on the docs.**
Adding `case "mcp-tools":` / `case "mcp-call":` to `scripts/rapidtool-cli.mjs` changes
`grep -c 'case "'` 39 → 41, so ALL of these must move together:
- `scripts/README-cli.md:10,31,511,580` — `**39 subcommands**` → `**41 subcommands**` (+ the
  verb list, `**… subcommands** … \`…\` — …`).
- `scripts/README-cli.test.mjs` — no edit needed (it reads the count from the file), but it goes
  red until the README is updated.
- `scripts/cli-exit-taxonomy.test.mjs` `EXIT_BY_CODE` — add `RT_E_MCP_DISABLED: 1` only if the
  new arms route through `errCode(...)`; the current surface reports the code directly.
The `doctor` surface + `--mcp-call` already deliver the behavior; a verb is discoverability sugar.

**(b) The failover arming needs a type change in `src/lib/llm.ts`.** Served-provider provenance
(`failoverFrom`/`servedBy`) has no field on `LlmResult` (`src/lib/llm.ts:64-81`). Arming the
router therefore needs that type widened — out of the registry's ownership.

**(c) A registration seam for probed descriptors.** `applyProbedModels` mints but never registers
into `PROVIDERS`; the failover chain resolver can only see `PROVIDERS`. Arming R13-f09 needs an
explicit registration step (or the chain resolver widened to accept minted descriptors), which is
a design decision for the provider layer, not something to sneak in here.

**(d) `errors.ts:583`'s `agentAction`** was already corrected by 340-1 (it now points at the
landed transport). Nothing further needed.

---

## 8. Mock / fake census (this lane's edits)

- `globalThis.fetch` / protocol mocks: **0** in the MCP path (the only stand-in is the real
  spawned `src/lib/mcp/stub-server.ts`, the server the client is supposed to talk to).
- The registry tests use the documented injected `fetch` seam (fixes/152) — no network, no key.
- `TODO` bodies / `as any` / `@ts-ignore` variants / silent `catch {}` / hardcoded-return fakes:
  **0** (scanned in `mcp.server.ts`, `doctor.ts`, `registry.ts`). Every new `catch` returns a
  coded refusal.
- No unfalsifiable tests: every new assertion is against a real child's bytes or a real refusal.

## 9. Keyed usage
**0** LLM calls; no network I/O beyond the local stub child; no secret read or printed.

---

## 10. Honest verdict

**MCP is now genuinely connected, off by default.** The `doctor` pre-flight is the F1 client's
consumer: disabled ⇒ `RT_E_MCP_DISABLED`, zero spawn, `tools:null`; enabled + configured ⇒ the
server's REAL `tools/list` (and, on `--mcp-call`, the read-only round-trip), never a fabricated
list. Enablement remains an explicit owner decision.

**Failover is correctly resolved-but-UNARMED, and the bytes cannot honestly arm it in-scope.**
The only non-DeepSeek family is an undispatchable candidate, nothing registers a probed
descriptor into `PROVIDERS`, the only dispatchable family is the primary's own, and provenance
has no `LlmResult` field (unowned). Rather than a same-family retry mislabeled "failover", the
loud coded refusal stays — now naming all three missing pieces from the registry's own bytes.

**Remaining:** the CLI-verb form (docs-coupled, §7a), the `LlmResult` provenance field (§7b), and
the probed-descriptor registration seam (§7c) — all owner/other-lane calls.

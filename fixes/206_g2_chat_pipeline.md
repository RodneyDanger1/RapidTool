# 206 — G2 chat pipeline + packet tools (residual 202/203)

**Lane:** chat path only — `src/lib/chat.server.ts`, `src/lib/chat.test.ts`  
**Out of scope (untouched):** headless.ts, store.ts, engine.ts, rapidtool-cli.mjs, wild-mode.server.ts, README, product job modules  
**Doctor pin:** `doctor.factory.chatHasSlashToolsOnly` stays **true** (slash tools only; not Codex/Hermes)

## 0. Goal

Harden/complete keyless packet slash tools after 202 (`/ls` `/read`) + 203 (CLI keyless pin):

- `/ls` `/read` `/help` `/status` `/gate` `/packet` `/fixtures` complete and honest
- **Packet only** (`generatedTree` / `generatedSource`) — no disk walk, no shell
- `..` / absolute / home / control paths refused
- `/read` size-capped (`CHAT_READ_MAX = 8000`)
- No dual-channel `ok:true` + `error` (185-H1)
- Free-text keyless stays `RT_E_LLM_NOT_CONFIGURED` with slash-tool pin

## 1. What was already landed (202/203)

| Item | Status pre-206 |
|---|---|
| `CHAT_TOOLS` includes `ls` + `read` | done |
| `parseChatTool` / `runChatTool` / keyless branch in `chatOnceServer` | done |
| `/ls` lists packet paths + optional `src/generated.ts` host | done |
| `/read` from tree/source; `..` + absolute refused | partial (tilde/`.`/NUL not refused) |
| Keyless free-text error mentions `/ls` `/read` | done |
| CLI USAGE keyless honesty | 203 — **not reworked here** |
| Suite green on prior slash tests | 62 tests |

## 2. Bugs / gaps fixed in 206

### 2.1 Path refusal holes (`packetRelPath`)

**Broken:** `./src/a.ts`, `src/./a.ts`, `~/secrets`, NUL/control chars were accepted as path keys and answered “not on this packet” (looked like a miss) instead of a hard refusal. That blurred “no disk walk” with “missing file.”

**Fixed:** exported `packetRelPath` refuses:

- `..`, `.`, empty segments
- absolute (`/…`), drive (`C:…`), home (`~…`)
- control chars / NUL
- non-string / empty / >200 chars

`/read` still answers with the same honest line:  
`need a repo-relative path (no .., no absolute, no disk walk)`.

### 2.2 Keyless secondary envelope (dual-honesty)

**Broken:** if `completeDeepSeek` returned `not-configured` after the early key check (mid-flight key loss / race), the failure was:

```ts
{ ok: false, reason: "not-configured", code: res.code ?? "RT_E_INTERNAL" }
```

— missing `error` text and the slash-tool pin, and defaulting code to `RT_E_INTERNAL`.

**Fixed:** both early and late not-configured paths share `KEYLESS_FREE_TEXT_ERROR` and prefer `RT_E_LLM_NOT_CONFIGURED`.

### 2.3 Dual-ok (185-H1)

**Status:** tool success path already returned clean `{ ok: true, reply, grounded, provenance }` with no `error` key. 206 pins that in comments + tests; LLM success path documents the same rule. ok:false free-text never carries `reply`/`grounded`.

### 2.4 `/ls` hygiene + `/help` disclosure

- Dedup duplicate `generatedTree` paths (Set) before sort/count
- `/help` discloses **no shell / no disk walk / size-capped** for `/read`
- Export `CHAT_READ_MAX` for tests and callers

## 3. Contract (unchanged product truth)

| Claim | Reality |
|---|---|
| Packet tools | `/ls` `/read` read **in-memory packet only** |
| Disk / shell | **Never** — no `fs`, no `child_process` in chat.server |
| Keyless slash | ok:true, grounded, provenance |
| Keyless free-text | ok:false, `RT_E_LLM_NOT_CONFIGURED`, slash pin in `error` |
| Factory | Still not a software factory; slash tools ≠ Codex tools |
| `chatHasSlashToolsOnly` | remains true |

## 4. Tests

`node --experimental-strip-types --test src/lib/chat.test.ts`

Added/extended under `slash tools (keyless, no LLM)`:

- `packetRelPath` matrix (allow + refuse)
- `/read` size cap at `CHAT_READ_MAX`
- absolute / win / tilde / dot / bare `/read` refused keyless
- `/help` lists every `CHAT_TOOLS` entry + disclosures
- `/ls` path dedupe
- slash tools never call `fetch` even with a key
- keyless free-text dual-ok negative (no reply on ok:false)
- existing dual-ok checks on `/ls` `/read` success

**Result:** 69 pass / 0 fail (was 62).

## 5. Files

| File | Change |
|---|---|
| `src/lib/chat.server.ts` | path harden, export `CHAT_READ_MAX` + `packetRelPath`, keyless envelope unify, ls dedupe, help copy |
| `src/lib/chat.test.ts` | coverage above |
| `fixes/206_g2_chat_pipeline.md` | this log |

## 6. Honest summary

| Broken / incomplete | Fixed |
|---|---|
| Soft-miss for `./` `~` NUL paths | Hard refuse via `packetRelPath` |
| Late not-configured missing pin + weak code | Shared `KEYLESS_FREE_TEXT_ERROR` + `RT_E_LLM_NOT_CONFIGURED` |
| Thin residual coverage after 202 | 7 new tests (path/cap/help/dedupe/network/dual-ok) |
| `/help` under-disclosed | no shell / no disk walk / size-capped |

No CLI USAGE rework (203 done). No headless/store/engine edits. No invented job modules.

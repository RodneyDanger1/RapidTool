# W45 / 331-1 — "Keywright" — provider & keyed-path repair (CRITICAL PATH)

Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash: `/c/Users/mnril/Desktop/RapidTool Main`; the
space breaks ripgrep — use terminal `grep`). Read `wave_plans/W45/README.md` first. Your log:
`fixes/331_1_keywright.md`.

## Owned files (STRICT)

`scripts/rapidtool-cli.mjs` · `scripts/README-cli.md` · `scripts/cli-exit-taxonomy.test.mjs` ·
`src/lib/llm/**` (incl. `providers/*` and their `*.test.ts`) · `src/lib/deepseek.server.ts` ·
`src/lib/errors.ts` · `src/lib/llm.test.ts`, `src/lib/chat.test.ts` ONLY if they pin the 401 shape
you change (say so in the log).

## Findings you are fixing (all reproduced today, 2026-10-02)

**F1 — the machine sends an invalid key and nothing loads `.env`.**
- `.env` holds a **valid, funded** key (tail `…19b3`): `GET https://api.deepseek.com/models` → 200;
  `POST /chat/completions` with `deepseek-v4-flash` → 200 with a real completion and usage.
- `DEEPSEEK_API_KEY` is set at **Windows User scope** with tail `…42ff` and is **rejected**:
  `node --experimental-strip-types scripts/rapidtool-cli.mjs crew --project <p> --max-steps 1`
  → `ok:false`, HTTP 401 `Your api key: ****42ff is invalid`, `code:"RT_E_UNKNOWN"`, exit 4.
- `grep -rn 'loadEnvFile|dotenv' src scripts .grok` → **0 hits**. The CLI never reads `.env`.
  `scripts/with-app-env.mjs` merges only `.grok/app-env.json` and only `VITE_*` keys.
- So: **funded account + correct model ids + documented invocation = 401**, because a stale ambient
  variable wins over the repo's own `.env`.

**F2 — a red keyed call aborts the process instead of exiting through the taxonomy.**
After the 401 the process died with
`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76`,
exit `0xC0000409` (not the documented 0/1/2/3/4). Reproduce on Windows + Node 24; check Node 22.

**F3 — the 401 is diagnosed as `RT_E_UNKNOWN`.** A rejected/unauthorized credential must carry a
specific code (e.g. `RT_E_LLM_KEY_REJECTED` or the closest existing registry entry — read
`ERROR_CODE_DOC` in `src/lib/errors.ts` **before** inventing anything) and the remedy must name the
**source** of the key, by path (`<repo>/.env`) or scope (process environment), **tail-only**.

## Done-when (each a command you ran, output pasted in the log)

1. **A keyed CLI call succeeds end-to-end from a clean shell** with no manual `$env:` fix — the
   documented invocation uses the `.env` key. Prove with a **bounded** keyed call (one `crew
   --max-steps 1`, or `run --live` on the W45 scratch project) showing `ok:true` and the real
   `usage` token counts.
2. **Precedence is explicit and documented** in `scripts/README-cli.md`: which source wins, and why.
   A conflicting ambient key must produce a **loud, coded** signal naming both tails — never a
   silent win, never the full key.
3. **F2 fixed**: the same 401 path exits with a taxonomy code (no libuv abort, no `0xC0000409`).
   A test pins it.
4. A test pins F3: an unauthorized response maps to the specific code, remedy names the source, and
   the message contains a tail but **never** the full secret.
5. `npx eslint scripts/rapidtool-cli.mjs src/lib/llm src/lib/deepseek.server.ts src/lib/errors.ts`
   → exit 0; the suites you touch are green on Node 22 **and** host Node 24:
   `node --test --test-reporter=tap scripts/cli-exit-taxonomy.test.mjs`,
   `node --experimental-strip-types --test --test-reporter=tap "src/lib/llm*.test.ts"`,
   `... "src/lib/llm/**/*.test.ts"`, and `src/lib/chat.test.ts`.

## Do NOT

Run keyed calls in a loop; run `npm run eval`; run the full gate; print a full secret; edit
`headless.ts`/`scaffold.ts`/`codegen.server.ts`/`console.tsx` (other lanes own them); add an
`RT_E_*` code without checking `ERROR_CODE_DOC` first.

## Report back

Verdict · the exact key-resolution rule you landed · the real keyed call output (usage included) ·
F2 before/after exit codes · tests added + real results · anything you stopped on.

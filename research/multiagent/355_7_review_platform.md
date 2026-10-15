# W355 · lane `reviewer-platform` — the foundation: persistence, identity, credentials, provider seam, write safety, build/deploy

**Author:** lane `reviewer-platform` (W355 batch 355b, read-only). **Kind:** code review of the
foundation layer no other W355 lane owns.
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (path contains a space — every command below quotes it).
**Host:** Windows PowerShell 5.1 · `node -v` → `v24.15.0` · `engines.node` = `>=22` (`package.json:8`).
**HEAD:** `30bce78` on `main`, dirty (98 modified + 32 baseline untracked per the wave brief; this lane
added none — **it wrote exactly one file: this report**).
**Doctrine applied:** where a doc and the bytes disagree, the bytes win. No doc is evidence for itself.

> **Premise discipline.** Two path framings handed to this lane are **not true of the bytes** and are
> corrected here rather than restated: (i) `src/lib/key-resolution.ts` and `src/lib/key-source.server.ts`
> do **not** exist at that path — the real files are `src/lib/llm/providers/key-resolution.ts` and
> `src/lib/llm/providers/key-source.server.ts`; (ii) `src/lib/pglite-dialect.ts` does not exist —
> it is `src/lib/auth/pglite-dialect.ts`. `src/lib/providers.ts` / `src/lib/registry.ts` likewise do not
> exist (they are `src/lib/llm/providers/*`). Command: `Test-Path` over each (§1). The substance of the
> scope list is unchanged; only the paths move.

---

## 1. Method — exact commands

Every claim below is a `read_file`/`grep` on the named path or one of these commands, run in
`C:\Users\mnril\Desktop\RapidTool Main` this session. **No** keyed LLM call was made; **no** `npm test`,
`npm run build`, `gate.sh`, `git` write, or dev server was started. No product file, doc, register or
sibling report was edited.

```powershell
# scope paths — existence (the premise correction above)
@('src/lib/key-resolution.ts','src/lib/key-source.server.ts','src/lib/providers.ts',
  'src/lib/registry.ts','src/lib/db.ts','src/lib/pglite-dialect.ts') |
  ForEach-Object { "{0} -> {1}" -f $_, (Test-Path $_) }

# inventory: tracked vs untracked in scope
git ls-files src/lib/auth src/lib/llm migrations scripts/migrate.mjs scripts/migration-plan.mjs `
  scripts/with-app-env.mjs scripts/path-safety.mjs scripts/write-atomic.mjs ...   # read-only
git status --short -- src/lib/auth src/lib/llm migrations                       # read-only

# Q1 — the four precedence cases, on BOTH resolution functions (§2)
$_ = '<script in §2>' ; node --experimental-strip-types -e "<probe>"

# Q5 — hostile relative paths against the write-set guard
node --experimental-strip-types -e "import('./src/lib/write-set.ts').then(m=>{for(const p of ['../../evil.ts','/etc/passwd','C:/win.ts','src/CON','src/NUL','src/COM1.txt','src/aux.ts','foo.','foo ','a.ts','A.ts','src/sub/../ok.ts','..foo/bar.ts']) { try { console.log(JSON.stringify(p),'=> ALLOWED as',JSON.stringify(m.assertSafeRelPath(p))); } catch(e){ console.log(JSON.stringify(p),'=> REFUSED',e.code); } }})"

# Q2/Q3/Q7 — call-site, credential and server-function census
Get-ChildItem src -Recurse -File -Include *.ts,*.tsx | Select-String -Pattern 'createServerFn\('     # 19
Get-ChildItem src -Recurse -File -Include *.ts,*.tsx | Select-String -Pattern '\.middleware\('       # 1 live
Get-ChildItem scripts -Recurse -File -Include *.mjs,*.ts,*.sh | Select-String -Pattern 'RAPIDTOOL_PGLITE_DIR'
Get-ChildItem .vercel -Recurse -File -Include *.js,*.mjs,*.json | Select-String -Pattern 'grok_preview' -List

# Q4 — migrations inventory
Get-ChildItem migrations -Recurse -File      # migrations/auth/*.sql only; ZERO top-level .sql
```

Targeted per-file test suites are **not** re-run by this lane: `key-resolution.test.ts`,
`key-source.test.ts`, `db.test.ts`, `account.test.ts`, `account-default.test.ts` are **read** and their
coverage stated as a finding (§8 / F-12), because the tree is RED at HEAD (`npx tsc --noEmit` exits 2
with 5 errors; `npm test` exits 1 with 622 tests / 607 pass / 15 fail — the brief's measured baseline,
which this lane did not re-derive) and a targeted `node --test` on this dirty tree would add no
information the baseline does not already carry. Every coverage claim below therefore cites the **test file's own assertions** (a read).

---

## 2. Precedence matrix — 4 cases × 3 surfaces, verified

**The documented rule** (`scripts/README-cli.md:75-114`, restated by `.env.example:19-25` and
`AGENTS.md:155-159`):

1. `<cwd>/.env` holds a non-blank value → it wins;
2. a process variable present-but-blank ⇒ intentional keyless disable (`.env` NOT consulted);
3. both present, non-blank, **different** ⇒ `.env` wins **and** a loud coded
   `RT_E_LLM_KEY_SHADOWED` line is emitted (tails only);
4. process variable **absent** ⇒ `.env` is the fallback source.

**The one implementation** is `resolveApiKey` (`src/lib/llm/providers/key-resolution.ts:149-180`); every
surface either calls it directly or calls `resolveProcessKey`
(`src/lib/llm/providers/key-source.server.ts:73-105`), which composes it over one `readFileSync`.

**Command (verbatim, both functions, a temp `.env` holding a fake key):**

```powershell
$env:TMPD = Join-Path $env:TEMP "rt355-prec"; New-Item -ItemType Directory -Force -Path $env:TMPD | Out-Null
Set-Content -Path (Join-Path $env:TMPD ".env") -Value "DEEPSEEK_API_KEY=FAKE_ENV_KEY_AAAA1111" -NoNewline
node --experimental-strip-types -e "const {resolveApiKey}=await import('./src/lib/llm/providers/key-resolution.ts'); const {resolveProcessKey}=await import('./src/lib/llm/providers/key-source.server.ts'); const path=process.env.TMPD+'/.env'; const NAME='DEEPSEEK_API_KEY'; const cases=[['1 env-wins-over-differing-ambient','FAKE_ENV_KEY_AAAA1111','FAKE_AMBIENT_KEY_BBBB2222'],['2 present-but-blank disables','FAKE_ENV_KEY_AAAA1111',''],['3 identical both','FAKE_ENV_KEY_AAAA1111','FAKE_ENV_KEY_AAAA1111'],['4 absent ambient -> .env','FAKE_ENV_KEY_AAAA1111',null]]; ... "
```

**Measured output** (values are obviously-fake fixtures; no real secret was read, materialized or printed):

```
--- resolveApiKey (pure shared rule) ---
1 env-wins-over-differing-ambient => {"eff":{"kind":"repo-env-file","tail":"1111"},"conflict":true}
2 present-but-blank disables     => {"eff":null,"conflict":false}
3 identical both                 => {"eff":{"kind":"repo-env-file","tail":"1111"},"conflict":false}
4 absent ambient -> .env         => {"eff":{"kind":"repo-env-file","tail":"1111"},"conflict":false}
--- resolveProcessKey (server read; .env path declared) ---
1 env-wins-over-differing-ambient => {"eff":{"kind":"repo-env-file","tail":"1111"},"conflict":true}
2 present-but-blank disables     => {"eff":null,"conflict":false}
3 identical both                 => {"eff":{"kind":"repo-env-file","tail":"1111"},"conflict":false}
4 absent ambient -> .env         => {"eff":{"kind":"repo-env-file","tail":"1111"},"conflict":false}
```

### 2a. Matrix (four cases × three surfaces)

| # | Case | **CLI** (`scripts/rapidtool-cli.mjs`) | **Server read** (`deepseek.ts` → `key-source.server.ts`) | **Vite dev server** (`with-app-env.mjs` → same server read) |
|---|---|---|---|---|
| 1 | `.env` wins over a differing non-blank ambient value | **HOLDS** — `rapidtool-cli.mjs:830-899` reads `resolve(process.cwd(),".env")`, parses it, calls `resolveApiKey({envFileValue:parsed.DEEPSEEK_API_KEY ?? null, processValue:process.env.DEEPSEEK_API_KEY ?? null})`, then **installs** the `.env` value into `process.env` (`:886`) | **HOLDS** — `resolveProcessKey` → `resolveApiKey`; on `kind==="repo-env-file"` it installs the value (`key-source.server.ts:94-96`) so the redactor/presence probes agree | **HOLDS** — `with-app-env.mjs:181` declares `RAPIDTOOL_LLM_ENV_FILE`; the provider then resolves identical to the server read |
| 2 | present-but-blank process value ⇒ keyless disable | **HOLDS** — measured row 2; `resolveApiKey:158-162` returns `{effective:null}` before `.env` is consulted | **HOLDS** — same function; `resolveProcessKey:73-88` reads the file first but `resolveApiKey` short-circuits on blank | **HOLDS** — `with-app-env.mjs:76` `mergeAppEnv` lets an explicit `process.env` entry win over `.grok/app-env.json`, so a blank `DEEPSEEK_API_KEY=""` reaches the child |
| 3 | differing non-blank ambient ⇒ coded `RT_E_LLM_KEY_SHADOWED`, tails only | **HOLDS** — `rapidtool-cli.mjs:871-899` `warnConflict` writes `formatShadowWarning(...)` to **stderr** (stdout stays one JSON object) | **HOLDS** — `emitShadowWarning` (`key-source.server.ts:46-54`) writes the same line to stderr, de-duplicated per line | **HOLDS** — same `emitShadowWarning` (one `lastShadowWarning` latch per process) |
| 4 | ambient absent ⇒ `.env` supplies the key | **HOLDS** — measured row 4 | **HOLDS** — measured row 4; with no `RAPIDTOOL_LLM_ENV_FILE` it is a pure, side-effect-free process read (`:80-85`) | **HOLDS** — the wrapper always sets the marker, so the `.env` read always happens |

**Result: 4 cases × 3 surfaces = 12/12 HOLD.** One honest caveat (F-07, P3): the Vite surface declares
`join(projectRoot(), ".env")` (`with-app-env.mjs:181`) — the **repo-root** `.env`, not the documented
**cwd**-relative `<cwd>/.env` that the CLI uses (`rapidtool-cli.mjs:831`). They coincide today only
because `npm run dev` is executed from the package root; `with-app-env.mjs` derives the root from its own
file location, so a wrapper-launched dev server from another cwd would read a different file than the
document. The bytes do not contradict the documented rule in the shipped invocation; they do not
implement it either.

**Corollary (F-08, P3):** the matrix is pinned by `src/lib/llm/providers/key-resolution.test.ts:74-179`
(all four cases, six `it(` blocks) and `key-source.test.ts:29-90` — genuine coverage. What is **not**
pinned is any of the three **surface wirings** (the CLI's `installRepoEnvKey`, the wrapper's marker, the
provider's read) end-to-end; only the pure rule is.

---

## 3. DeepSeek contract conformance — one row per call site

**Spec:** `research/deepseek-api.md` (live-verified 2026-09-05). **Provider:
** `src/lib/llm/providers/deepseek.ts` (the only role-routed family; `registry.ts:190-208`).
Every DeepSeek call goes through `completeDeepSeek` (`deepseek.ts:889`), so the request body is built
**once**, at `deepseek.ts:578-604`.

### 3a. What the single body builder guarantees (all call sites inherit these)

| Spec requirement (§ref) | Bytes | Verdict |
|---|---|---|
| `max_tokens` **always** explicit (§1, §4) | `deepseek.ts:529-531` — `opts.maxTokens ?? (isPro ? 8192 : 1024)`, and `max_tokens: maxTokens` at `:591` is unconditional | **HOLDS** at the wire for every DeepSeek call |
| flash budget ≥ 1024 / pro ≥ 4096 (§4 reference) | `:89-90` `DEFAULT_MAX_TOKENS_FLASH 1024`, `DEFAULT_MAX_TOKENS_PRO 8192` | **HOLDS** |
| `thinking` shape per tier (§4b, §4c) | `:588-590` — flash ⇒ `{type:"disabled"}`; pro ⇒ `{type:"enabled"} + reasoning_effort:"high"`; `thinking:false` forces the disabled shape on pro too | **HOLDS** |
| JSON mode + **required** "respond in JSON" instruction (§4d) | `:547-553` pushes a `system` message `"Respond with valid JSON only — no prose, no markdown fences."` whenever `opts.json`; `response_format:{type:"json_object"}` at `:602` | **HOLDS** (both halves, on every `json:true` site) |
| Base URL / `/chat/completions` / bearer (§3) | `:629` `POST ${DEEPSEEK_BASE_URL}/chat/completions`, `authorization: Bearer ${key}` at `:619` | **HOLDS** |
| 401/402 **NOT** retried (§6) | `TRANSIENT_RETRY_STATUS = {429,500,502,503,504}` (`:115`); `postWithRetry:381-383` returns on any non-member status | **HOLDS** |
| `content_filter` **NOT** retried (§5) | handled once at `:726-733`, returns `RT_E_LLM_REJECTED`, never re-issued | **HOLDS** |
| `insufficient_system_resource` **retried** (§5) | `:626-637` — a 200-body finish_reason retry loop, bounded `bodyAttempt < MAX_ATTEMPTS`, sharing the caller's one abort deadline | **HOLDS** (bounded) |
| `finish_reason:"length"` treated as truncation (§4d, §5) | **only** surfaced on the *empty-content* branch (`:714`, `lengthNote` in the `no text content` refusal at `:741-744`). On the **success** arm (`:746-763`) the field is dropped: `LlmResult`'s ok-arm carries `{text, model, usage?}` only (`src/lib/llm.ts:62-70`) | **FAILS — F-01 (P1)** |
| Validate `content` non-empty before returning (§5) | `:705-745` — empty content ⇒ coded refusal with a reasoning/`length`/capacity note | **HOLDS** |
| `prompt_cache_hit_tokens` / `prompt_tokens_details.cached_tokens` read (§5) | DeepSeek reads `prompt_cache_hit_tokens` **and** `prompt_cache_miss_tokens` (`:300-306`, `:332-339`); the OpenAI-compatible adapter reads `prompt_tokens_details.cached_tokens` (`openai-compatible.ts:384-388`, `:596-600`) | **HOLDS** (both spellings, one per family) |
| reasoning tokens accounted (§5) | `usageFromParsed` (`:322-341`) never reads `usage.completion_tokens_details.reasoning_tokens`; `LlmUsage` has no such field (`llm.ts:43-61`); the ledger field `TokenSpend.reasoningTokens` (`token-ledger.ts:111`) has **no production producer** — the only assignments are literal `null` (`headless.ts:5912-5913`, `doctor.ts:1363-1364`) | **FAILS — F-04 (P2)** |
| Stable shared prefix to raise the cache-hit rate (§5) | the body puts `system` first, then the constant JSON instruction, then `history`, then the user prompt (`:545-576`) — a stable leading prefix **is** available and the call tap forwards the cache split (`:838-839`, `:912-919`) | **HOLDS**; no call site is *engineered* for a shared prefix (§6) |

### 3b. Per call site

`json` below = `response_format` + the JSON instruction (both, per §3a). "length" = the site can tell a
truncated reply from a complete one.

| # | Site (`file:line`) | Role → tier | `maxTokens` | `thinking` | `json` | length detectable? | Notes |
|---|---|---|---|---|---|---|---|
| 1 | P6 **spec expansion** `prompt-engine.ts:373-382` | explicit flash | **3000** | default (flash ⇒ disabled) | **yes** | **no** | 90 s budget (`DEEPSEEK_LONG_TIMEOUT_MS`); caller validates the parsed six-key spec (`expandedSpecViolations`) |
| 2 | P6 **chunk synthesis** `codegen.server.ts:7125-7143` | `P6_SYNTH_MODEL` | **32 000** (`P6_SYNTH_MAX_TOKENS`) | **`false`** (forced off — the `content:""` blocker) | **yes** | **no** | 240 s timeout; seeded sampling (`:7140-7141`) |
| 3 | P6 **repair turns** `codegen.server.ts:7629` (opts reused at `:7144`) | as #2 | **32 000** | `false` | **yes** | **no** | dedicated repair persona |
| 4 | **Oracle case generation** `verify.server.ts:1857` | `weak` → flash | **none** ⇒ 1024 | default (flash ⇒ disabled) | **yes** | **no** | the call whose output decides `p6-verified` gets the smallest output budget of the P6 family |
| 5 | Oracle **pinned-row repair** `verify.server.ts:1885` | `weak` | **none** ⇒ 1024 | disabled | **yes** | **no** | retry prompt for `reason:"empty"` |
| 6 | Oracle **pinned-id repair** `verify.server.ts:1916-1927` | `weak` | **none** ⇒ 1024 | disabled | **yes** | **no** | may return many pinned rows into a 1024-token window |
| 7 | Oracle **name-binding repair** `verify.server.ts:1967-1978` | `weak` | **none** ⇒ 1024 | disabled | **yes** | **no** | |
| 8 | Oracle **shape-only repair** `verify.server.ts:2013-2018` | `weak` | **none** ⇒ 1024 | disabled | **yes** | **no** | |
| 9 | verify verdict/lesson calls `verify.server.ts:2288` | `weak`/`main` | **none** ⇒ 1024 | disabled | (not read) | **no** | `maxTokens` never appears in `verify.server.ts` (grep, §1) |
| 10 | **Grounded copilot** `chat.server.ts:580-586` | `main` → flash | **768** | default (disabled) | no (plain text) | **no** | `history` ≤ 6 turns × 4000 ch (`deepseek.ts:559-570`) |
| 11 | **Phase narrative** `headless.ts:642-644` | `complete` | **none** ⇒ 1024 | default | no | **no** | already the thinnest context in the map |
| 12 | **Crew role turn** `crew.server.ts:1156` | per-role `spec.budgetTokens` | **2048–8192** | default | no | **no** | session ledger metered |
| 13 | **Crew plan-act turn** `crew.server.ts:1375` | per-role | **2048–8192** | default | no | **no** | |
| 14 | **Crew planner** `planning.ts:256` / **reflect** `:307` | — | **2048** | default | no | **no** | a failed plan stops the run (never a silent fallback) |
| 15 | **Auto-Review classifier** `wild-mode.server.ts:376-380` | `WILD_CLASSIFIER_MODEL` | **320** (`WILD_REPLY_MAX_TOKENS`) | default | no | **yes — by proxy** | `:445-458` detects `usage.completionTokens >= 320` and appends a truncation marker *while still accepting the verdict* (the cartographer's B-10) |
| 16 | **Engine pro call** `engine.ts:3833` | explicit pro | **2000** | **`false`** | no | **no** | |
| 17 | **Harvest query builder** `harvest.ts:255-260` | explicit flash | **512** | default (disabled) | **yes** | **no** | |
| 18 | **`lesson --propose`** (CLI) `rapidtool-cli.mjs:4838` | — | **400** | default | **yes** | **no** | keyless ⇒ deterministic draft |
| 19 | eval probes `run-eval.mjs:1672` (8) / `:1788` (1) | — | 8 / 1 | default | no | **no** | deliberate tiny budgets |
| 20 | `algo-tools.ts:119`, `:603` | — | provider default | default | — | **no** | **unreachable** — zero production callers (cartographer B-7) |
| 21 | `vector.ts:862-865` | — | caller-supplied | default | **yes** | **no** | **unreachable** — no non-test importer (cartographer B-8) |
| 22 | `openai-compatible.ts:476-495` (xAI family) | — | **omitted when no caller budget** ⇒ vendor default 128 000 | none forwarded (documented) | **yes** | **no** | family is a **CANDIDATE** with empty `requestModelIds` ⇒ unreachable in production (`registry.ts:296-298`) |

**Read of the table.** Every DeepSeek call site **does** carry an explicit `max_tokens` at the wire
(the provider always fills it), every `json:true` site gets the required instruction, and 401/402/
`content_filter` are never retried. The defect is uniform and provider-level, not per-site: **no call
site can distinguish `finish_reason:"length"` from `"stop"` on a successful reply** (F-01), and **no
site accounts reasoning tokens** (F-04). Sites 4–9 (the whole oracle family) additionally run on the
implicit 1024 default while writing JSON into it — the same class of truncation the spec warns about in
§4d.

---

## 4. Findings

`id | severity (P0/P1/P2/P3) | title | file:line | evidence | why it matters`
Severity: **P0** = broken/dishonest in normal use · **P1** = wrong behaviour, reachable · **P2** =
misleading or fragile · **P3** = cosmetic / drift.

| id | sev | title | file:line | evidence | why it matters |
|---|---|---|---|---|---|
| **F-01** | **P1** | A successful reply with `finish_reason:"length"` is reported `ok:true` with no truncation signal — against the spec's "treat as failure/retry", especially in JSON mode | `src/lib/llm/providers/deepseek.ts:705-745` (length note only on the empty-content branch), `:746-763` (success arm, field dropped); `src/lib/llm.ts:62-70` (`LlmResult` ok-arm has no `finishReason`) | Read both branches + the type. `classifyFinishReason` (`:162-173`) and `finishReasonOf` (`:176-187`) exist, and `lengthNote` is built at `:714`, but `finishClass` is used **only** inside `if (content is empty)` (`:707`). The success return at `:746-763` returns `{ok:true,text,model,usage?}` — no truncation field. Contrast `wild-mode.server.ts:445-458`, which re-derives truncation from `completionTokens >= WILD_REPLY_MAX_TOKENS` precisely because the provider does not report it | `research/deepseek-api.md:241-243` is explicit: "`length` ⇒ output was truncated … With JSON mode this means the JSON may be cut — **treat as failure/retry**". The oracle family (§3b rows 4–9) writes JSON into the *implicit 1024* window, and the classifier accepts a cut verdict. A truncated-but-nonempty JSON reply is returned as a successful completion; the caller's `JSON.parse` is the only thing that catches it, and the failure is reported as "unparseable payload" (`verify.server.ts:1889`) — the wrong diagnosis |
| **F-02** | **P1** | With auth **enabled**, 18 of 19 server functions are reachable with **no user id**; exactly one is guarded | `src/lib/auth/account.ts:28-31` (the only `.middleware([authMiddleware])`); census: 19 `createServerFn(` occurrences across 12 files (`app-data/client.server.ts`, `chat.ts`, `crew.ts`, `exec.ts`, `fixtures.review.ts`, `llm.ts`, `preview-compile.ts`, `research.ts`, `verify.ts`, `wild-bridge.ts`, `auth/account.ts`, `auth/middleware.ts`) vs **1** live `.middleware(` (grep, §1) | `authMiddleware`'s own doc says "use it on every server function that touches per-user data" (`middleware.ts:12-20`) — a convention, not a mechanism. `exec.ts` exposes the bounded runner; `verify.ts`/`crew.ts`/`chat.ts` spend the keyed budget | A deployer who enables `VITE_AUTH_ENABLED=true` gets a sign-in gate on the **UI** and assumes the tool is authenticated. It is not: the only verified identity in the app is `fetchVerifiedAccount`, which returns the id it already has and reads no per-user row. Today there is **no** per-user server data (`getSql` has zero production consumers — see F-05), so nothing is currently exposed; the moment one per-user table lands, its server function is unauthenticated unless the author remembers the comment. The honest claim in `AGENTS.md:490-492` ("auth is real when enabled") is true for the *UI gate* and for *one* function, not for the server surface |
| **F-03** | **P2** | `AGENTS.md` calls `server/` middleware stale scaffolding, but it is **load-bearing on every deploy** | `AGENTS.md:136-138` lists "`server/` middleware … stale scaffolding … do not build on it"; the same paragraph's load-bearing exception names only four `.grok/` reads. Bytes: `vite.config.ts:206-210` passes `serverDir: "./server"` to `nitro({preset:"vercel"})` with the comment "Auto-registers server/middleware/* … Nitro v3 defaults serverDir to false, so removing this silently unwires `/?install=1` on deploys"; `server/middleware/grok-pwa.ts:1-18` confirms: "Auto-registered as global h3 middleware because vite.config.ts sets `serverDir: './server'` — without that option Nitro v3 never scans this directory." `docs-FOLDER-MAP.md:61` repeats the false claim | A lane following the contract deletes `server/` as stale scaffolding and silently breaks the deployed PWA install page, `/__grok/manifest.webmanifest`, and the OG head injection — with no gate catching it (`gate.sh`'s build leg does not assert those routes). This is the exact H-class of failure the doc's own "declare-or-strike" rule exists to prevent. `server/virtual-grok-og-identity.d.ts` is likewise required (it declares the `virtual:grok-og-identity` module `grok-pwa.ts:18` imports) |
| **F-04** | **P2** | Reasoning tokens are in the ledger vocabulary but have **no producer** — never accounted from a real response | `src/lib/llm/providers/deepseek.ts:322-341` (`usageFromParsed` reads only `prompt_tokens`, `completion_tokens`, `prompt_cache_*`; never `completion_tokens_details.reasoning_tokens`); `src/lib/llm.ts:43-61` (`LlmUsage` has no reasoning field); `src/lib/token-ledger.ts:111,126,164,303-304` (`reasoningTokens` in `TokenSpend`/`TokenLedger`/`CACHE_FIELDS`); producers: `headless.ts:5912-5913` and `doctor.ts:1363-1364` set it to literal `null` — grep for `reasoningTokens|reasoning_tokens|completion_tokens_details` returns no other production site (§1) | `research/deepseek-api.md:222-237` names `usage.completion_tokens_details.reasoning_tokens` = "tokens spent thinking" and warns reasoning tokens **count against `max_tokens`**. The provider reads and returns `prompt_cache_hit_tokens` (a real spec field) but not the reasoning split, so `packet.ts:632`'s "reasoning output N" line and `doctor.ts:1401` can only ever be `null`/absent | With thinking **on** (the pro tier is the default for any `reasoning`-role call) a large share of `completion_tokens` is chain-of-thought, and the ledger cannot say how much. Total spend is still honest (reasoning rides inside `completion_tokens`), but the one field built to expose it is dead, and a future "flash vs pro cost" reading will silently omit the dominant term. Confirmed against the live example in the dossier: `completion_tokens: 20` with `reasoning_tokens: 18` |
| **F-05** | **P2** | The SQL surface (`getSql`) has **zero production consumers**; the whole PGLite/Neon scaffolding exists to serve a disabled-by-default Better Auth | `src/lib/db.ts:239-273` (`getSql`); grep for `getSql(` finds only comments (`middleware.ts:17`, `db.ts:48,248`) and `src/lib/db.test.ts` (`:39,:49,:50`). The only live consumer of the module is `src/lib/auth/server.ts:38,152` (`ensureDbReady`, `pgliteDialect(() => getPglite())`) | Because Better Auth is the sole consumer, and `migrations/` holds **no top-level `.sql`** (`Get-ChildItem migrations -Recurse` → only `auth/0001_auth.sql`, `auth/0002_account_unique.sql`), the PGLite instance boots with exactly one table (`_migrations`, `db.ts:153-155`) that nothing queries | "Persistence" in this repo is **not** a database — projects are browser `localStorage` / JSON files (`.vercel/README.md:40-44` states this). The DB layer is a single-tenant auth store that ships **off**. Any lane that "adds a table" expecting an app-data schema will find none, and `npm run build`'s migrate leg will report "no migrations — nothing to do" (`migrate.mjs:73-76`) |
| **F-06** | **P2** | `write-set` accepts Windows reserved device names and trailing-dot/space names — a write can silently land on `NUL`/`CON` or be redirected by Win32 normalization | `src/lib/write-set.ts:35-61` (`assertSafeRelPath`): rejects non-string/empty, `\0`, absolute (incl. `C:/`, `/`), and any `..` segment; **no** reserved-name or trailing-space/dot check. Probe (`§1`): `"src/NUL" => ALLOWED as "src\\NUL"`, `"src/CON" => ALLOWED`, `"src/COM1.txt" => ALLOWED`, `"foo." => ALLOWED`, `"foo " => ALLOWED` | On Windows, `writeFileSync("<root>\\src\\NUL")` targets the NUL device — the bytes vanish and no file is created, yet `applyWrites` reports success and the snapshot records `existed:false`; rollback then `unlinkSync`s a path that never existed. Win32 also strips trailing dots/spaces, so `foo.` and `foo` collide silently — defeating the snapshot map, whose keys are the raw strings (`:113-119`) | An emitted tree is model-authored, so a file path is attacker-influenced input. The guard's own doc claims it refuses "path escape (`..` / absolute)" and that R11-f07 makes it physically safe — but the *write-loss* class (a path that is inside the root yet resolves to a device or a normalized alias) is unhandled and unlogged. The strict-containment half is sound (see §5); this is the remaining hole |
| **F-07** | **P3** | The Vite surface declares the **repo-root** `.env`, the documented rule and the CLI use **`<cwd>/.env`** | `scripts/with-app-env.mjs:181` `env[LLM_ENV_FILE_VAR] = join(projectRoot(), LLM_ENV_REL_PATH)` vs `scripts/rapidtool-cli.mjs:831` `resolve(process.cwd(), ".env")`; docs `scripts/README-cli.md:82-83,113` | Read both lines; `projectRoot()` (`with-app-env.mjs:98-101`) is derived from the wrapper's own file location, `cwd` is not | Coincide for the shipped `npm run dev/build/preview` (npm runs from the package root). A wrapper invocation from another cwd reads a different file than the contract promises — a debugging trap of exactly the kind the W45 "Keywright" work existed to remove |
| **F-08** | **P3** | A shared **preview OAuth client secret is committed** in a module whose name does **not** carry the `.server.` boundary device | `src/lib/auth/preview.ts:19-21` — `PREVIEW_CLIENT_ID = "grok_preview"` and a 64-hex-char `PREVIEW_CLIENT_SECRET` (**value redacted — shape: 64 lowercase hex chars, no prefix**). Importers: `src/lib/auth/server.ts:47-48,88` (server-only) and `src/lib/auth/auth-contract.test.ts:19-22`. Checked for client-bundle reach: `Select-String -Pattern 'grok_preview' -List` over `.vercel/output/**` (all `*.js,*.mjs,*.json`) → **no match**; `.vercel/` is gitignored (`.gitignore:4`, `git ls-files .vercel` = 0) | The module's header says "server-only — NEVER import from the client" and explains the secret is a dedicated low-privilege preview client (`*.grok-sandbox.com` only), base64url(SHA-256)-hashed on the broker. That is a deliberate documented design — but the repo's own enforcement device for server-only modules is the `.server.ts` suffix (`AGENTS.md:121-124`, the H2 crash class), and this file does not use it. `auth-import-contract.test.ts:60-95` pins extensions and parameter properties; nothing pins "no client module imports `preview.ts`" | The secret is **not** client-reachable today (verified) and is documented as low-privilege. The residual is process: a plain-named module exporting a credential is one careless client import away from being inlined into the public bundle by Vite, and the only guard is a comment. Renaming to `preview.server.ts` (or adding an import-contract assertion) removes the class |
| **F-09** | **P3** | `deepseek.server.ts`'s header states the key is read from `process.env` **only** — false since W45 | `src/lib/deepseek.server.ts:17-19` "Reads the key from `process.env.DEEPSEEK_API_KEY` ONLY" vs the actual read: `deepseek.ts:190-197` → `resolveProcessKey` → `resolveApiKey` over a declared `.env` file | Read both; `resolveProcessKey` (`key-source.server.ts:73-105`) consults `RAPIDTOOL_LLM_ENV_FILE` when set | A stale contract line in the re-export shim that ~15 modules import. Small, but it is the sentence a reader uses to decide whether `.env` matters — and it is the exact question W45 repaired |
| **F-10** | **P3** | Two live-verification claims about `/models` contradict each other, and only one can be true | `research/deepseek-api.md:40-56` (verified 2026-09-05) — `/models` returns `deepseek-v4-flash`, `deepseek-v4-pro`, `deepseek-v4-flash-vision-exp`. `src/lib/llm/providers/deepseek.ts:21-33` (verified 2026-09-16, quoted by `registry.ts:196-202`) — `/models` returns **exactly two**: `deepseek-flash` and `deepseek-v4-pro`, and "`deepseek-v4-flash` … is accepted on the request path and served as `deepseek-flash`" | Read both; the code **requests** `deepseek-v4-flash` (`deepseek.ts:70`) and read-back records the served id (`:750-752`) | Not a code bug — the request path works under both readings — but the repo's "live-verified" dossier and its own provider header disagree about what the vendor returns. A future refresh following the dossier would look for three ids including one the header says no longer exists. **I could not resolve it: it needs a keyed `GET /models`, which this lane must not make** |
| **F-11** | **P3** | `.vercel/README.md` says auth has **no login UI** — struck by the 354 wave | `.vercel/README.md:44-47` "**Auth is latent.** better-auth exists at the lib layer but there is **no login UI** … Do not present accounts as a deployed feature"; `.vercel/README.md:54` "The `.vercel/output` above is the last valid build" | Bytes: `src/routes/login.tsx:1-25` is a real sign-in route, `src/routes/__root.tsx:54-55,125` mounts `SignInGate`/`RedirectToSignIn`, `src/lib/auth/account.ts` is a real guarded server function; `AGENTS.md:490-492` (354 block) states auth is real when enabled | `.vercel/` is gitignored and untracked (`git ls-files .vercel` = 0), so this is operator-facing drift only — but it is in this lane's scope list and it directly contradicts the newest correction block. The "last valid build" claim is also unverifiable here (the output is dated 2026-09-06; the tree has moved ~4 waves) |

---

## 5. What is genuinely sound (with evidence)

Required section — these are measured, not vibed, and later waves must not "fix" them.

1. **The credential precedence is a single pure implementation, and it is correct on all four
   documented cases.** `resolveApiKey` (`key-resolution.ts:149-180`) is the only rule; `resolveProcessKey`
   composes it; the CLI calls it directly. Measured 12/12 (§2). The rule's two subtle distinctions are
   both implemented: *absence* vs *present-but-blank* (`:157-162` — `processPresent` is tracked
   separately from `processVal`), and *repo-env-file* vs *process-env* provenance (`:155-175`).
   `tailOf` (`:89-96`) is defended against `slice(-0)` returning the whole secret, and a value of ≤4
   chars is masked entirely rather than "tailed". `describeKeySource` (`:211-220`) proves identity by
   value equality before claiming a source.
2. **`RT_E_LLM_KEY_SHADOWED` never prints a secret.** `formatShadowWarning` (`:72-85`) carries only the
   two last-4 tails plus the `.env` path; the CLI routes it to **stderr** so stdout stays a single JSON
   object (`rapidtool-cli.mjs:871-877`), and `key-source.server.ts:42-54` de-duplicates it. Measured:
   the probe emitted exactly one such line and no key material.
3. **The provider body builder is a single funnel with the spec's safety rules hard-coded.**
   `max_tokens` unconditional (`deepseek.ts:591`), the JSON instruction added by the provider rather than
   trusted to the caller (`:547-553`), unknown model ids refused *before* any network I/O (`:515-526`),
   `temperature`/`seed` dropped when non-finite (`:594-601`), the 32-bit `setTimeout` ceiling clamped
   (`:99-100`, `:540-543`), full-jitter bounded retry with an injectable schedule (`:119-142`,
   `:370-404`), and an AbortError never retried (`:388-390`). `wild-mode.server.ts:445-458`'s independent
   truncation proxy is the one place that works around F-01.
4. **The retry loop shares ONE abort deadline, so a call's wall-clock is bounded by `timeoutMs`
   regardless of the multiply.** `deepseek.ts:604-608` creates the `AbortController` + timer **once**,
   then `postWithRetry` (`:370-404`) and the `insufficient_system_resource` body loop (`:630-637`) both
   re-issue the same `requestInit` bearing that signal. Worst case is ≤9 HTTP requests (3 status attempts
   × 3 body attempts) inside a single 20/60/90/240 s window — a bounded cost, not a retry storm.
5. **`physicalInside` is a real containment check, not a `startsWith`.** `path-safety.mjs:30-67`
   realpaths the deepest **existing** ancestor and re-appends the not-yet-existing suffix lexically, so a
   symlinked/junctioned parent is resolved, and `relativeEscapes` (`:80-82`) is segment-aware, so the
   legal sibling `..foo` is not mis-read as an escape. Three call sites share the one implementation
   (`write-set.ts:19`, `write-atomic.mjs:20`, `rapidtool-cli.mjs`), and its null ("unverifiable") is
   correctly **not** treated as "inside" (`write-set.ts:83-93` throws
   `RT_E_PATH_KIND_MISMATCH` only on a confirmed `false`; `write-atomic.mjs:57-58` keeps the lexical
   verdict on `null`). Probe: `../../evil.ts`, `/etc/passwd`, `C:/win.ts` all REFUSED with
   `RT_E_VALIDATION`.
6. **The write-set is genuinely rollback-safe on the failure it names.** `applyWrites` validates and
   snapshots **every** path before taking the lock (`write-set.ts:246-254`), writes each file via a
   same-directory staged temp + `rename` (`:219-235`), and on any throw rolls the **whole** snapshot
   back before rethrowing (`:257-261`) — so a mid-set failure cannot leave a partial tree. The lock
   (`:186-213`) reclaims a dead owner's lock and refuses `RT_E_BUSY` for a live one.
7. **`npm run build`'s db:migrate leg is safe with no database configured, and a migration cannot fail
   silently.** `migrate.mjs:22-25` exits **0** with a printed reason when `DATABASE_URL` is unset (before
   touching `pg`); with a URL, each file applies inside `BEGIN`/`COMMIT` with `ROLLBACK` on error, prints
   the failing migration's name plus pg's `code/detail/hint/position/where` (`:106-132`, `:142-149`), and
   exits 1. The PGLite applier applies file + ledger row in one transaction (`db.ts:219-223`) and
   **rethrows** through `getSql` (`:158-161`, `:267-272`) rather than swallowing. The two appliers share
   ONE bookkeeping module (`migration-plan.mjs`) so their ordering/dedupe rules cannot drift.
8. **The auth-schema gap is a real, coded, documented refusal — not a silent hole.** Because neither
   applier descends into `migrations/auth/`, sign-in-on-with-no-copied-up-schema is refused
   `RT_E_AUTH_SCHEMA_MISSING` with the copy-up instruction (`migration-plan.mjs:203-231`), from **both**
   entry points (`migrate.mjs:48-73`, `db.ts:193-206`), and a **partial** copy-up is refused too
   (`authCopyUpGaps`, `:110-119`). `RT_E_AUTH_SCHEMA_MISSING` is documented in the CLI contract
   (`scripts/README-cli.md:1447`).
9. **`VITE_AUTH_ENABLED=false` (the shipped default) really is inert.** `.grok/app-env.json` (tracked)
   ships `{"VITE_AUTH_ENABLED":"false"}` → `authDisabled` (`auth/server.ts:81`) → `authConfigured:false`
   (`:90-91`) → `requireUserId` returns `DEV_USER_ID` with no database (`verify.server.ts:109-116`) and
   `getSessionUser` returns `null`. The client constant `authEnabled` (`client.ts:44`) is `false`, so
   `useCurrentUserState` (`use-current-user.ts:56`) returns `DEV_USER` without ever calling
   `authClient.useSession()`. `__root.tsx:54-55` returns `<Outlet/>`-equivalent children unchanged. Both
   halves are pinned: `account-default.test.ts:18-21` (dev-user, no throw) and
   `account.test.ts:22-36` (401 on the enabled path). The four flag readers agree on the predicate and it
   is **the bytes** that define it, not a doc: `with-app-env.mjs`/`migrate.mjs`/`db.ts`/`gate-identity`
   all use "trimmed value ≠ `\"false\"`" (with a documented case-sensitivity caveat — `FALSE` enables).
10. **The deploy path fails closed on a config conflict.** `verify.server.ts:22-27` logs loudly when
    `DATABASE_URL` is set while auth is disabled, and `requireUserId` then throws
    `AuthMisconfigurationError` (status **500**, deliberately distinct from the caller's 401 —
    `:49-56`, `:109-114`) instead of sharing one dev user against a real database. The same-site check
    (`isolation.server.ts:40-63`) is wired at the middleware chokepoint and correctly treats a missing
    server request context as "nothing to guard" rather than leaking an `AsyncLocalStorage` error
    (`account.test.ts:38-43` pins it).
11. **The cassette refuses rather than fabricates, and its key cannot be spoofed across families.**
    `cassette.ts:14-58` states and the code enforces: unset/blank/`"off"` ⇒ identity transport
    (`completeDeepSeek:894`), a miss is a coded refusal (never template text), a v1 tape is refused, and
    the canonical request (`:142-197`) binds provider family + `maxTokens` + `json` + a
    `thinking:"default"|"off"` distinction (so a thinking-off tape can never serve a thinking-on call).
12. **The NDJSON telemetry log is bounded and cannot break the command it observes.**
    `runtime-log.server.ts:116-129` — `mkdirSync` + best-effort rotation (5 MB, 4 files, `LOG_ROTATE_BYTES`/
    `LOG_KEEP` from `rt-events.ts`) + one `appendFileSync`, with **every** failure swallowed; the reader
    (`:133-193`) opens and reads exactly the last 256 KB as **bytes** and skips torn lines.
13. **The build/launch config keeps its hard contracts.** `vite.config.ts:182-190` — loopback `127.0.0.1`
    by default with `RAPIDTOOL_BIND_ALL=1` as the only LAN opt-in, `strictPort: true` on both legs, and a
    documented `PORT` override that **ignores** a non-integer/out-of-range value (`:29-32`).
    `tsconfig.scripts.json` genuinely puts the whole scripts tree inside a `tsc` program with an empty
    error budget (`:5-15,28-30`), and `eslint.config.mjs:10-25` ignores `.vercel/**`/`research/eval-out/**`.
    `.github/workflows/gate.yml` declares **no secrets** (`:15-18`) and states its own never-executed
    limit honestly (`:32-51`).

---

## 6. What I could not verify

- **No keyed LLM call was made**, so no per-call-site claim in §3 is *measured at the wire*. The rows are
  read from the single body builder + the call-site options; the `max_tokens` default path and the
  `thinking`/`json` shapes are inferred from those bytes and are consistent across every site.
- **F-10 is unresolvable here.** Which ids `GET /models` really returns needs a keyed request, which this
  lane is forbidden to make. The two dossiers disagree; I report the disagreement, not a winner.
- **Call site `verify.server.ts:2288`** — I confirmed the orchestrator never passes `maxTokens` anywhere in
  `verify.server.ts` (grep, §1) and read its siblings, but I did not open line 2288 itself; treat its row
  as "no budget ⇒ 1024, `json` unread".
- **The persistent PGLite dir is wired but unexercised.** `RAPIDTOOL_PGLITE_DIR` is read at `db.ts:39-42`
  and passed to `PGlite({dataDir})` at `:148`; it is set only by `scripts/launch-rapidtool.mjs:74-77`
  (called at `:304`, `:351`) — **not** by `npm run dev`/`preview`, which is what `LAUNCH.md:54-63`
  documents. I could not start the launcher or a server (forbidden), so "data survives a restart" is a
  code read, not a measurement, and the reach-around from the launcher's env into the spawned preview
  child is the launcher lane's surface, not verified here.
- **The full `npm test` / `gate.sh` / `npm run build` were not run** (forbidden; the tree is RED). So
  "the foundation suites are green" is not claimed — only their *contents* were read.
- **`.vercel/output/**` is stale** (built 2026-09-06, `.vercel/README.md:10-13`). My Q7 "the secret is not
  in the client bundle" check is therefore against a **stale** artifact; it is evidence about that build,
  not proof about the next one. The durable argument is the import graph (`preview.ts` is reached only
  from `server.ts` + a test).
- **Runtime behaviour of the auth middleware chain end-to-end** (a real signed-out request reaching
  `fetchVerifiedAccount` through `authMiddleware`'s server hook) is not exercised by any test I read and
  needs the TanStack Start request context; `account.test.ts` proves `requireUserId` throws and that the
  server fn is a function, not that the middleware rejects a request.
- **`server/**`'s runtime registration on Vercel** is read from `vite.config.ts:206-210` and the
  middleware's own header; I did not deploy, so "auto-registered" is the config's claim plus the code's
  matching comment, not an observation.
- **Prettier drift** is unmeasured (the brief forbids the broad runs; `package.json:32` only
  `format:check`s two `factory-watch` files).

---

## 7. Recommended owners

| Finding | Recommended owner |
|---|---|
| **F-01** (truncation not surfaced) | the provider seam lane (Wave 1 `conduit-model`) — add an additive `finishReason` to `LlmResult`'s ok-arm (or a coded `RT_E_LLM_TRUNCATED`) and have §3b rows 4–9 raise their explicit budget. **P1** |
| **F-02** (18/19 server fns unguarded) | the identity lane (`mender` / Wave 1) + a doc correction: either adopt `authMiddleware` on the money-spending server fns or strike the "auth is real when enabled" implication down to what the bytes support. **P1** |
| **F-03** (`server/` mislabelled dead) | the docs-truth lane (`docs-ledger`) — add `server/middleware/grok-pwa.ts` + `server/virtual-grok-og-identity.d.ts` to `AGENTS.md`'s load-bearing exception list (the 4-read block at `AGENTS.md:138-142` is the model). **P2**, fix-before-freeze |
| **F-04** (reasoning tokens) | the provider seam lane — parse `usage.completion_tokens_details.reasoning_tokens` into `LlmUsage` and let the ledger's existing `reasoningTokens` field fill itself. **P2** |
| **F-05** (`getSql` unused / no app schema) | the cartographer's map + the docs lanes — state plainly that "persistence" is `localStorage`/JSON and the DB is auth-only; no code change. **P2** |
| **F-06** (reserved names / trailing dot-space) | the write-safety lane — extend `assertSafeRelPath` (`write-set.ts:35-61`) with the Win32 reserved-device set and a trailing `[ .]` refusal, plus the pinning test in §8. **P2** |
| **F-07** (repo-root vs cwd `.env`) | the config lane — either align `with-app-env.mjs:181` to `resolve(process.cwd(), ".env")` or correct the contract text to say "the repo root". **P3** |
| **F-08** (committed preview secret in a non-`.server` module) | the auth lane — rename `preview.ts` → `preview.server.ts`, or add the "no client import" assertion to `auth-import-contract.test.ts`. **P3** |
| **F-09 / F-10 / F-11** (doc drift) | the docs corridor — `AGENTS.md`/`deepseek.server.ts` header/`research/deepseek-api.md`/`.vercel/README.md`. **P3** |
| **F-12** (missing tests, §8) | the `mender` lane, alongside any F-01/F-06 fix — each missing test is named there. **P2** |

---

## 8. Tests — which foundation invariants are unpinned (Q8)

Named by *file* and *the specific missing case*, not "coverage is low".

| # | Invariant | Pinned today? | The specific missing test |
|---|---|---|---|
| T-1 | **PGLite branch of `db.ts`** — the entire persistent path: `RAPIDTOOL_PGLITE_DIR` honored (`db.ts:39-42`, `:136-152`), the recursive `mkdirSync` fix, the `import.meta.glob("/migrations/*.sql")` apply, the auth-schema refusal, and the eager module-load bootstrap (`:318-329`) | **NO** — `src/lib/db.test.ts` drives the **Neon** branch only, by design (its header `:1-14`: the PGlite branch needs `import.meta.glob`, absent under plain Node) | A test that stubs `import.meta.glob` (or a Vite-vitest leg) and asserts: (a) `new PGlite` received `dataDir` === `RAPIDTOOL_PGLITE_DIR`; (b) a parent dir that does not exist is created; (c) `authEnabled && no "user" table` throws `RT_E_AUTH_SCHEMA_MISSING`. Today the persistent-dir change has **no** executable pin, and the file's own coverage note celebrates 5 Neon-branch cases |
| T-2 | **`authMiddleware` actually rejects an unauthenticated request** end-to-end | **PARTIAL** — `account.test.ts:22-31` proves `requireUserId()` throws and `:34-36` proves `fetchVerifiedAccount` is a function; `:38-43` proves the same-site guard no-ops. No test invokes the middleware | A test that drives `fetchVerifiedAccount` (or a fixture server fn) through the middleware with a stubbed request context and asserts a 401 before the handler body runs. As written, the "the guard is wired" claim is asserted, not exercised |
| T-3 | **The same-site gate refuses a scripted cross-site request** | **NO** | `isolation.server.ts:61-63` throws `CrossSiteRequestError` (403) for `sec-fetch-site: cross-site` + `sec-fetch-mode: cors`. Only the *no-request-context* no-op is pinned (`account.test.ts:38-43`). A test with a stubbed `getRequest()` returning that header pair is missing |
| T-4 | **`write-set` refuses Win32 reserved device names and trailing dot/space** (F-06) | **NO** | Extend whatever pins `assertSafeRelPath` with the probe table in §1: `src/NUL`, `src/CON`, `src/COM1.txt`, `foo.`, `foo ` must REFUSE. Also a case-collision case (`A.ts` + `a.ts` in one write-set must not defeat `rollback`) |
| T-5 | **`migrate.mjs` exit-before-preflight ordering** — with `DATABASE_URL` unset the process exits 0 at `:22-25` **before** the auth-schema preflight at `:48-73` | **NO** | `migration-plan.test.mjs` pins `authSchemaRefusal`/`authCopyUpGaps`/`pendingMigrations` as pure functions, but nothing pins that the *no-DB build* never reaches the auth check (a deliberate, load-bearing ordering: a PGLite-only build must not fail on it) |
| T-6 | **The CLI surface wiring of the precedence rule** (`installRepoEnvKey`: cwd-relative `.env`, the install into `process.env`, the stderr-only warning) | **PARTIAL** | `key-resolution.test.ts`/`key-source.test.ts` pin the pure rule and the wrapper's marker string; nothing pins that the CLI resolves `<cwd>/.env` (vs the wrapper's repo-root, F-07) or that a conflict warning never reaches stdout |
| T-7 | **Reasoning tokens** (F-04) | **NO — nothing to pin** | `token-ledger.test.ts:180-272` pins that `reasoningTokens` *round-trips when supplied*; no test asserts a producer exists. The correct pin belongs beside F-04's fix (`usageFromParsed` reads `completion_tokens_details.reasoning_tokens`) |
| T-8 | **Truncation is not a success** (F-01) | **NO** | `deepseek-taxonomy.test.ts` (304 lines) pins `classifyFinishReason`/`finishReasonOf` and the `insufficient_system_resource` retry — the pure classification. No test asserts a 200 body with `content:"{...}"` + `finish_reason:"length"` is reported as a truncation rather than `ok:true` (because the provider cannot currently do it) |

---

*Read-only lane (`reviewer-platform`, W355/355b). No product file, doc, register or sibling report was
modified; this is the only file written. No secret value was printed — F-08 reports a shape and states the
redaction. Where a doc and the bytes disagreed, the bytes are quoted.*

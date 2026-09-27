# fixes/295_p2_chatui.md — P2 · THE CHAT/UI TAIL (N3 items 3-7: K7 growth.counts + K5 chat honesty + Guide/R6 records, W41)

**Lane:** W41 P2. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; keep one-liners SHORT). **HEAD on entry:** `ac6b151` (clean tree; only `?? fixes/296_q5_register.md`, `?? fixes/296_q8_ops.md` untracked — sibling lanes live).
**Box:** `src/components/console.tsx` · `src/lib/chat*`. **PATCH-FIRST; additive-only UI; never weaken `chat.test.ts` pins.**
**Contract:** re-read every target region immediately before its patch (sibling lanes live); smallest honest patch + one evidence line per fix; `npx eslint` scoped on touched files at the end; `node --check src/lib/chat.server.ts` (JS-parse may fail on types — scoped tsc only if quick); NO full gates, NO keyed calls.

**Sources (read fresh this session):**
- `fixes/294_n3_chatui.md` — its byte-verified site table + locked order (items 3-7 unlanded).
- K5's summary (`~/AppData/Local/hermes/cache/delegation/subagent-summary-4-20260927_013856_330036.txt`) — zero patches landed; the 6 findings verbatim.
- `fixes/292_l2_uiux.md` — L2 plan + R6 byte-state table (R6-f06 UI half OWED; f10/f15 verify+record).
- `fixes/285_g4_operator_visibility.md:36` — the fake-0/`growth.counts` doc claim at `rt-client.ts:590`.

## Recon (byte-verified at ac6b151, this session)

- **R6-f12 ALREADY LANDED** (not by this lane): `markBoundaryError` import :75, call in `componentDidCatch` :1658, RunScreen wrapped `<PaneBoundary label="Run screen">` :2743-3497. → record only.
- **W-29(h) render guards**: out of this lane's item list (N3 item 2) — checked anyway at close if cheap.
- **K7-6 `growth.counts`:** `RuntimeLogPane.runDiagnosis` :4436-4451 calls `buildClientDiagnosis({ project, persistHealth })` with NO `counts` → `growth.counts` reads `{}` (:674 `input.counts ?? {}`). Doc at `rt-client.ts:596`: "Growth counts from the store (artifacts/memory/decisions/projects)". `rt-client.test.ts:225/236` drives `counts:{artifacts:1}` → `growth.counts.artifacts === 1`. UI has the store → wire real lengths (active project's artifacts/memory/decisions + store-wide projects count).
- **K5-1 `restoredRows`:** `ChatPane` :5868-5870 freezes `project.chatLog.length` (≤40 storage cap); `chatLogToViews` (:5560-5584) → `trimTurns` (:5553) renders ≤12; caption :6054-6059 says "Thread restored … {restoredRows} rows" → over-claims rows that are NOT rendered.
- **K5-2 Reject latch:** `onReject` :2218-2231 has no busy latch; `HitlDock` Reject button :3949-3962 disabled only on `note.trim().length < 12`; `busyAction` union :1921-1923 already carries `"reject"` (unused). `rejectAsync` in-flight ⇒ human sees nothing.
- **K5-3 `runChatTool` fallback:** chat.server.ts :474-475 — fixtures branch is the silent default arm (gated only by `parseChatTool`'s allow-list). Needs explicit name check + coded refusal for the unreachable tail. `chat.test.ts:984-989` pins the fixtures-absent body — preserved.
- **K5-4 version parsers:** `provenanceVersion` (chat.server.ts:73-79) ↔ `chatStampVersion` (chat.ts:129-135) byte-identical; chat.ts already names its mirror; chat.server.ts has NO reverse pin.
- **K5-6 synthesis block (chat.server.ts:275-295):** `proven` allow-list — only `"self-test"`/no-label get the `(tree present — not tree-run proven)` caveat; ANY other label (persisted drift / future value) reads as PROVEN. Fix = default-deny (only `tested`/`real-run` skip the caveat). Pins :743 (tested → no caveat), :755 (self-test → caveat), :727 (floor) preserved by the inversion.
- **R6-f06 in-app half:** `GUIDE_SECTIONS` :1433-1454 "Feed results back" names notes-paste only — never the `ingest` seam (console "Ingest report" control :2988/:3061, `rapidtool ingest` verb) → additive one-liner. AGENT_GUIDE.md §4 :69 is N5's box (`for n5`).
- **R6-f10:** Autopilot label :2698 "Autopilot · auto-approve eligible gates" + explanatory `title` on the span ⇒ verified DONE.
- **R6-f15:** both `Tabs.List` slices carry derived aria-labels (:3233 primary via `tabListLabel` :178-185, :3257 advanced); triggers = Radix `Tabs.Trigger` (:220) under one `Tabs.Root` (:3224) ⇒ keyboard a11y from Radix; verified, record only.

## Landing order (locked)

1. K7-6 `growth.counts` producer wired (console RuntimeLogPane).
2. K5-1 `restoredRows` honesty (console ChatPane caption source).
3. K5-2 Reject pending state (console `onReject` + HitlDock props/button).
4. K5-3 `runChatTool` explicit fixtures + coded default (chat.server.ts).
5. K5-4 reverse comment-pin on `provenanceVersion` (chat.server.ts).
6. K5-6 synthesis default-deny (chat.server.ts).
7. R6-f06 in-app Guide one-liner (console GUIDE_SECTIONS).
8. Scoped eslint + parse checks; final ledger.

## Log (append-only)

- [t0] Log opened; recon above verified by direct reads/greps at `ac6b151`. R6-f12/R6-f10/R6-f15 recorded as already-landed/verified (evidence lines above).

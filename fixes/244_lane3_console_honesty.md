# fixes/244 — W16 LANE 3 · DF-18 + DF-26 console honesty pair

**Status:** LANDED 2026-09-24 — both wave greps ≥1; render path re-read; parse-clean. Skeleton was written early per wave rule and filled in place.
**Lane:** W16 LANE 3 · `wave_plans/W16/lanes-and-observer.md` §LANE 3.
**Owns:** `src/components/console.tsx` (ScorecardBlock ≈:3303 + packet tab panel region), `src/styles.css` if needed.
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (grep, not ripgrep — space in path). Scratch: `C:/Users/mnril/w16l3_scratch/`.
**Forbidden runs:** `npm run typecheck`, `npm test`, `npm run build` (parent/boundary only). Tests run FOREGROUND (background harness dies `stdin is not a tty`).

## Bottom line

- **DF-18 LANDED** — `grep -cE 'feasibility|template-derived|not live research' src/components/console.tsx` → **0 → 2** (:3357 source comment, :3359 rendered string). The caveat `(deterministic feasibility estimate — template-derived, not live research)` renders in `ScorecardBlock` directly under the headline `overall / 10` number — exact packet.ts:498 wording, never paraphrased. Both call sites inherit it: :2816 (run screen) and :5939 (record browser).
- **DF-26 LANDED** — `grep -c TRUNC src/components/console.tsx` → **0 → 4** (:183 comment, :192 const, :196 helper, :2940 render). Truncation surfaced at two affordance levels: (a) Agent-packet tab — warn banner above the packet frame; (b) Export (copy/download) dropdown — warn strip at the top of the menu, so a reader sees it *before* taking the packet (playbook trap: "a banner that only appears when the user opens the packet defeats the point"). Detection reads the packet's OWN marker out of `project.packet` (`packet.includes(PACKET_TRUNC_MARKER)`) — the 14 000-char cut is **never recomputed** client-side.
- **Layout intact** — all four edited regions re-read post-edit (see Commands); banner/strip are block-flow siblings (no absolute positioning, no fixed heights); parse-only check of the edited TSX = **0 diagnostics (PARSE CLEAN)**, ts 5.9.3. No `src/styles.css` change needed — every utility class used already appears in-file: `border-warn/30` ×8, `bg-raised` ×38, `text-warn` (competitor "illustrative template" chip :3397/:3400), `font-mono text-[11px]`.
- **Test: no console test file exists** — `ls src/components/*.test.*` → none (dir holds only cmd-palette.tsx, console.tsx, preview-host-bridge.tsx, runtime-timeline-pane.tsx; playbook DF-18 row already says "(no console.tsx test file)"). Checks used instead, all actually run: (1) the two wave greps; (2) mirror-identity script — marker + cap byte-identical to packet.ts; (3) the packet's own suite `node --experimental-strip-types --test src/lib/packet.test.ts` FOREGROUND → **47/47 pass**, incl. "packets over 14000 chars carry the TRUNCATED marker (never silent cut)" — proves the marker appears in real packet output; (4) parse-only TSX syntax check. Post-OV-2 browser pass remains the playbook's belt-and-braces (not available to this lane).

## Commands + evidence (append-only) — every claim = its command

```bash
# before (both wave-verify greps RED)
grep -cE 'feasibility|template-derived|not live research' src/components/console.tsx   # 0
grep -c TRUNC src/components/console.tsx                                               # 0
wc -l src/components/console.tsx                                                       # 6203

# read-first (byte references)
sed -n '3300,3372p' src/components/console.tsx      # ScorecardBlock whole (boundary kept)
sed -n '2895,2935p' src/components/console.tsx      # packet tab panel whole
sed -n '2480,2560p' src/components/console.tsx      # Export/copy/download affordance
sed -n '490,505p' src/lib/packet.ts                 # :498 caveat string (source of truth)
sed -n '15,22p;535,579p' src/lib/packet.ts          # :16 cap, :17 marker, :538/:561/:564-569 cut paths

# after
grep -nE 'feasibility|template-derived|not live research' src/components/console.tsx   # 3357, 3359
grep -n TRUNC src/components/console.tsx                                               # 183, 192, 196, 2940
grep -n "DF-18\|DF-26" src/components/console.tsx                                      # only this lane's comment blocks

# mirror byte-identity (marker + cap vs packet.ts:16/:17)
node C:/Users/mnril/w16l3_scratch/verify_mirror.mjs
#   MARKER MIRROR: IDENTICAL (byte-for-byte) · CAP MIRROR: IDENTICAL
#   detect legacy-cut shape / mid-doc / untruncated = true / true / false

# the packet's own truncation accounting, real output (FOREGROUND)
node --experimental-strip-types --test src/lib/packet.test.ts
#   tests 47 · pass 47 · fail 0   (incl. "packets over 14000 chars carry the TRUNCATED marker")

# parse-only syntax check of the edited TSX (not a typecheck / not a gate)
node C:/Users/mnril/w16l3_scratch/parse_check.mjs
#   ts 5.9.3 · parseDiagnostics: 0 · PARSE CLEAN

# class precedent (no styles.css change)
grep -c "border-warn/30" src/components/console.tsx    # 8   (incl. this lane's 2 uses)
grep -c "bg-raised" src/components/console.tsx         # 38

# layout re-reads post-edit
sed -n '178,198p;2536,2556p;2918,2950p;3352,3366p' src/components/console.tsx
```

## Implemented shape (4 hunks, console.tsx)

1. `:180–197` — module consts + helper: `PACKET_MAX_CHARS_MIRROR = 14_000`, `PACKET_TRUNC_MARKER = "…[TRUNCATED — regenerate at a HITL gate for the full plan]"`, `function packetTruncated(packet)`. Comment cites packet.ts:16/:17 and the in-repo mirror precedent (`packet.test.ts:20` mirrors the same literal).
2. `:3354–3360` — DF-18 caveat `<p className="mt-1 font-mono text-[11px] leading-snug text-warn">` in `ScorecardBlock`, under the overall number (same warn family as the block's own "illustrative template" chip).
3. `:2933–2943` — DF-26 banner in the packet tab (`Tabs.Content value="packet"`), above `term-frame`, copy: "This packet is truncated — it hit the packet budget ({PACKET_MAX_CHARS_MIRROR} chars) and the tail was cut. The packet's own marker in the body reads: {PACKET_TRUNC_MARKER}. Copy or download carries this packet as-is."
4. `:2542–2549` — DF-26 strip at the top of the Export dropdown menu: "Packet truncated — hit the {PACKET_MAX_CHARS_MIRROR}-char budget; copy/download carries the cut packet as-is."

## What is NOT surfaced (honest limits — registered, not silently skipped)

- Ctrl+Shift+C chord (`console.tsx:1690`) copies the packet with no menu → no strip on that path. The dropdown + packet tab cover the visible affordances; chord left untouched (out of scope for a footer-level fix).
- Command-palette "copy-packet"/"download-packet" rows call the same handlers but render no strip of their own (kept the diff tight).
- Drift risk: mirrors go stale if packet.ts:16/:17 change — then the banner would **under**-report. Proposed for a later wave (outside this lane's box, deliberately NOT applied here): `export const PACKET_MAX_CHARS` / `export const TRUNC_MARKER` in packet.ts, import them in console.tsx, delete the mirrors — one line each.
- The surface appears only when the packet actually carries the marker — the packet's OWN definition of "truncated", never a length heuristic.

## Notes / deviations

- Sibling-write flag: the patch tool reported "console.tsx was modified by sibling subagent 20260924_094645_b4c890 but this agent never read it" on first edit. All four anchors were counted unique (`grep -c` = 1 each) against live bytes immediately before patching, and all four regions re-read after — no interference observed. (console.tsx is this wave's single-writer file per the lane plan; the flag is ledger history, not a current collision.)
- Box interpretation: the Export dropdown was treated as part of "the packet/download affordance" per the playbook's DF-26 trap; it is console.tsx, and LANE 3 is the only console.tsx writer this wave.
- git truth: the tree is uncommitted-on-7582771, so per-lane `git diff` attribution is not meaningful; evidence = the patch tool's returned diffs (per hunk) + post-edit `sed` re-reads.
- No `packet.ts` edit; no new repo files besides this log; scratch outside repo at `C:/Users/mnril/w16l3_scratch/` (`verify_mirror.mjs`, `parse_check.mjs`).
- Forbidden runs respected (no `npm run typecheck` / `npm test` / `npm run build`); all node runs FOREGROUND (no `stdin is not a tty` met).

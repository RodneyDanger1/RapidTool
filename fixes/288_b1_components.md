# 288 — B1 components sweep (src/components/** minus console.tsx + src/routes/**)

Lane: B1 (owner of `src/components/{cmd-palette,preview-host-bridge,runtime-timeline-pane}.tsx` + `src/routes/**`).
Started: 2026-09-27 (W39). Read fresh each session.

## Findings
_(appending findings + real-time fixes as they land)_

## Fix log (append-only)
| # | file:line | bug | patch | evidence |
|---|---|---|---|---|

## Completion pointer (K1/290)
B1 died mid-sweep (2026-09-27 00:21, mid-patch on `runtime-timeline-pane.tsx`; this log stayed a
skeleton). The sweep was completed in **`fixes/290_k1_components.md`** (lane K1): B1's 3 landed
pane patches were kept + verified; its never-assigned `copyFlashRef` (dead unmount cleanup — the
committed lint warning at `runtime-timeline-pane.tsx:111` was the tell) was fixed, the `paired`
badge count corrected, the root-level `scratch_b1_timeline_probe.mjs` rescued to
`fixes/290_k1_timeline_probe.mjs`, and the five files B1 never swept (`cmd-palette.tsx`,
`preview-host-bridge.tsx`, `__root.tsx`, `index.tsx`, `run.$id.tsx`) re-passed clean.
Findings + wire checks live in 290; §F1 there is the newest-first feed bug this lane proved.

# 263 · Lane U2 — UI: routes / styles / other components (wire + organize + fix UI errors)

**Wave:** W24 spring-clean (U2). **HEAD:** b721f9c. **Box:** `src/routes/**`, `src/styles.css`,
`src/components/**` EXCEPT `console.tsx` (U1).
**Evidence rule:** `npx eslint <files>` exit 0; every change listed before→after; every
style removal carries repo-wide grep evidence.

## Surface in scope (inventory)

| File | Lines | Notes |
|---|---|---|
| `src/routes/__root.tsx` | 83 | shell: head/theme boot/telemetry/AuthProvider/Outlet |
| `src/routes/index.tsx` | 13 | `/` → `HomeScreen` |
| `src/routes/run.$id.tsx` | 17 | `/run/$id` → `RunScreen key={id}` |
| `src/components/cmd-palette.tsx` | 144 | cmdk palette (controlled) |
| `src/components/preview-host-bridge.tsx` | 26 | mount-once host bridge |
| `src/components/runtime-timeline-pane.tsx` | 213 | typed timeline sibling |
| `src/styles.css` | 731 | tailwind v4 entry + component chrome |

## Findings log

_(appended as findings land — every item: file:line, before → after, or "not a bug, because …")_

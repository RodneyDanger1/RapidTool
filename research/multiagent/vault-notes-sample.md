# Vault notes — sample output (2nd-brain demo)

Rendered from `src/lib/vault.ts` against the shared fixture (`runHeadless(seedProject(), ALL_PHASES)`
— a full 13-phase engine run). Pure/deterministic: identical project ⇒ identical output.
The full real export is 47 notes: 1 hub + 13 phase spine + 18 memory + 4 decisions +
1 research corpus entry + 10 artifacts.

## Shape of one note (as embedded in the vaultMarkdown export)

````markdown
---
title: "Approve isolation policy"
kind: decision
tags: [decision, approve]
phase: 4
updatedAt: 1788670322387
---

# Approve isolation policy

**Decision:** approve · **Decided by:** human · **Phase:** [[P4 · Security, Isolation & Authorization]]
**Requested:** 2026-09-06T04:52:02.385Z · **Decided:** 2026-09-06T04:52:02.387Z

_No note recorded._
````

## Hub note (kind: index — body is the MOC)

````markdown
# Fixture · Vault Index

Build a field-service dispatch board for HVAC: jobs, techs, parts, same-day reroutes. Offline warehouse scan.

- **Status:** complete · **Domain:** logistics
- **Current phase:** P12 · **Model route:** local-edge
- **Feasibility:** 6.8/10 — proceed-with-guards
- **Created:** 2026-09-06T04:52:02.246Z · **Content notes:** 46

## Map of Content

### Project (13)
- [[P0 · Deep Research & Feasibility]]
- [[P1 · Core Orchestration & State Graph]]
…
### Memory (18)
- [[ADRs capture why P1 and P7 chose this topology.]]
…
### Decisions (4)
- [[Approve isolation policy]]
…
### Research (1)
- [[Research: fixture live research]]

### Artifacts (10)
- [[Agent packet (A4)]]
…

## Tag cloud

- `#project` (13)
- `#memory` (18)
- `#p12` (1)
…
````

## Phase spine note (kind: project — cluster page, memory↔phase / decision↔phase target)

````markdown
# P4 · Security, Isolation & Authorization

**Status:** complete · **Gate:** passed
**Started:** 2026-09-06T04:52:02.385Z · **Completed:** 2026-09-06T04:52:02.387Z

### Memory (1)
- [[Generated code executes air-gapped inside the isolate.]]

### Decisions (1)
- [[Approve isolation policy]]
````

## Memory / research notes

````markdown
# ADRs capture why P1 and P7 chose this topology.

ADRs capture why P1 and P7 chose this topology.

**Kind:** semantic · **Score:** 0.97 · **Phase:** [[P12 · Documentation & Technical Specs]]
````

````markdown
# Research: fixture live research

**Provider:** duckduckgo · **Sources:** 1 · **Hub:** [[Fixture · Vault Index]]

- **Fixture competitor finding** — https://example.com/fixture
  fixture research corpus
````

## Notes

- Artifact notes carry the artifact body **verbatim** (contract) — their phase
  association lives in `links[]` and frontmatter, not synthesized body prose.
- Titles are unique; duplicates get counter suffixes (`Title (2)`, `Title (3)`).
- Wikilink targets are bare titles; wrap with `[[` / `]]` when emitting markdown
  (the vault export and MOC already embed the brackets).

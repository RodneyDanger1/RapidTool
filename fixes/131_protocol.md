# 131 — Research-relay protocol (3 coders → 1 web researcher)

- Coders append questions as `## Q-<tag>` blocks (one per finding, tag = their lane).
- The researcher answers as `## A-<tag>` blocks in fixes/131_findings.md (append-only),
  each answer with sources (URLs) + a concrete recommendation sized for this codebase.
- Coders POLL findings before finalizing each fix and cite the answer in their log.
- Protocol: researcher is READ-ONLY on source (writes only findings + scratch); coders own
  their files; nobody edits this file except the parent.

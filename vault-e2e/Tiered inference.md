---
title: "Tiered inference"
kind: artifact
tags: [artifact, edge]
phase: 10
updatedAt: 1788672653012
---

Primary: grok-4.5 (architecture, security, HITL summaries)
Edge: Ollama open-weight models (draft, format, long-context tidy)
Failover: secondary OpenAI-compatible route, session intact
Sync: edge patches land in the same checkpoint store before P9 promote

---
title: "OpenAPI 3.1"
kind: artifact
tags: [artifact, docs]
phase: 12
updatedAt: 1788698726406
---

openapi: 3.1.0
info:
  title: Fixture API
  version: "1.0.0"
paths:
  /v1/dispatch:
    post:
      summary: dispatch
      responses:
        "200":
          description: ok
  /v1/reroute:
    post:
      summary: reroute
      responses:
        "200":
          description: ok
  /v1/scan:
    post:
      summary: scan
      responses:
        "200":
          description: ok

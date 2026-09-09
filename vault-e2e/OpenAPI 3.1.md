---
title: "OpenAPI 3.1"
kind: artifact
tags: [artifact, docs]
phase: 12
updatedAt: 1788672653012
---

openapi: 3.1.0
info:
  title: HVAC Dispatch API
  version: "1.0.0"
paths:
  /v1/dispatch:
    post:
      summary: dispatch
      responses:
        "200":
          description: ok
  /v1/route:
    post:
      summary: route
      responses:
        "200":
          description: ok

---
title: "GitHub Actions workflow"
kind: artifact
tags: [artifact, cicd]
phase: 9
updatedAt: 1788698726406
---

name: rapidtool-gate
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: npm ci
      - run: npm run typecheck
      - run: npm test

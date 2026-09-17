#!/usr/bin/env bash
# fixes/215b temporary launcher — bounded keyed eval probe (1 entry, coffeehouse2home).
# Loads DEEPSEEK_API_KEY from .env without echoing it, runs the keyed leg, tees to a log.
set -u
cd "$(dirname "$0")/../.." || exit 1
KEY=$(grep -m1 '^DEEPSEEK_API_KEY=' .env | cut -d= -f2- | tr -d '\r"' | sed "s/^'//;s/'$//")
if [ -z "$KEY" ]; then echo "no key"; exit 2; fi
export DEEPSEEK_API_KEY="$KEY"
echo "key loaded (len=${#KEY}) mode=keyed $(date)"
npm run eval -- --keyed 2>&1 | tee research/eval-out/_keyed-run.log
echo "exit=$? $(date)"

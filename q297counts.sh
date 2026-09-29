#!/bin/bash
# 297 R1 evidence: live category counts per README §10.1 rows (tracked files).
cd "/c/Users/mnril/Desktop/RapidTool Main" || exit 1
echo "total=$(git ls-files | wc -l)"
for d in research fixes src wave_plans .grok builds vault-e2e scripts screenshots public audit-bugs audit review proposals server migrations .github attachments artifacts .audit-g2 .t4scratch; do
  echo "$d=$(git ls-files "$d" | wc -l)"
done
echo "root=$(git ls-files | grep -cv /)"
echo "srclib_direct=$(git ls-files src/lib | grep -cv 'src/lib/.*/')"
echo "srclib_subdir=$(git ls-files src/lib | grep -c 'src/lib/.*/')"
echo "srclib_modules=$(git ls-files src/lib | grep -c '\.ts$' | head -1)"
echo "srclib_direct_tests=$(git ls-files src/lib | grep -cv 'src/lib/.*/' | grep -c 'test.ts$' || true)"

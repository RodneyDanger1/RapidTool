#!/usr/bin/env bash
set -e
# Q6 (W41) evidence: per-directory tracked-file census behind the README §10.1 rows.
# MOVED fixes/301 · X4 (2026-09-28): was repo root `q6counts.sh` (committed at
# 60c92a2); kept under fixes/ as Q6's census evidence. Run from the repo root.
git ls-files > /tmp/q6_all.txt
git ls-files src > /tmp/q6_src.txt
git ls-files src/lib > /tmp/q6_lib.txt
git ls-files scripts > /tmp/q6_scripts.txt
git ls-files fixes > /tmp/q6_fixes.txt
git ls-files wave_plans > /tmp/q6_wp.txt
git ls-files research > /tmp/q6_res.txt
echo "total: $(wc -l < /tmp/q6_all.txt)"
echo "src: $(wc -l < /tmp/q6_src.txt)"
echo "srclib: $(wc -l < /tmp/q6_lib.txt)"
echo "root: $(grep -vc / /tmp/q6_all.txt)"
echo "scripts: $(wc -l < /tmp/q6_scripts.txt)"
echo "fixes: $(wc -l < /tmp/q6_fixes.txt)"
echo "wave_plans: $(wc -l < /tmp/q6_wp.txt)"
echo "research: $(wc -l < /tmp/q6_res.txt)"
grep -E '^src/lib/[^/]+$' /tmp/q6_lib.txt > /tmp/q6_direct.txt
grep -E '^src/lib/.+/' /tmp/q6_lib.txt > /tmp/q6_sub.txt
echo "direct: $(wc -l < /tmp/q6_direct.txt)"
echo "directmod: $(grep -vc '\.test\.' /tmp/q6_direct.txt || true)"
echo "directtest: $(grep -c '\.test\.' /tmp/q6_direct.txt || true)"
echo "sub: $(wc -l < /tmp/q6_sub.txt)"
echo "subtest: $(grep -c '\.test\.' /tmp/q6_sub.txt || true)"
echo "submod: $(grep -vc '\.test\.' /tmp/q6_sub.txt || true)"
echo "--- root files:"
grep -v / /tmp/q6_all.txt

#!/usr/bin/env bash
# 로컬 격리 스택(57122)에 12~15 SQL 을 순서대로 적용하고 NOTICE/행 수를 출력한다. 사용: bash scripts/prod-open/sat30-rehearsal-run.sh [files...]
U=${LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:57122/postgres}
D=data/prod-open/sat-expand-sql
FILES=("$@"); [ ${#FILES[@]} -eq 0 ] && FILES=(12_preflight 12_import 13_keywords 14_new_sets_27_30 15_verify)
for f in "${FILES[@]}"; do echo "== $f"; psql "$U" -q -f "$D/$f.sql" 2>&1 | grep -v '^$' | cut -c1-240 | head -40; done

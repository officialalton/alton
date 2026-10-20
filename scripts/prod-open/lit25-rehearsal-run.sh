#!/usr/bin/env bash
# 로컬 격리 스택(58122)에 16~22 SQL 을 순서대로 적용하고 NOTICE/행 수를 출력한다. 사용: bash scripts/prod-open/lit25-rehearsal-run.sh [files...]
U=${LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:58122/postgres}
case "$U" in *127.0.0.1*|*localhost*) ;; *) echo "로컬이 아님 — 중단"; exit 2;; esac
D=data/prod-open/sat-expand-sql
FILES=("$@"); [ ${#FILES[@]} -eq 0 ] && FILES=(16_preflight 17_release_old_drafts_27_30 18_import_lit25 19_keywords_lit25 20_new_sets_27_30_lit25 21_old_set_versions_lit25 22_verify_lit25)
for f in "${FILES[@]}"; do echo "== $f"; psql "$U" -q -f "$D/$f.sql" 2>&1 | grep -v '^$' | cut -c1-260 | head -60; done

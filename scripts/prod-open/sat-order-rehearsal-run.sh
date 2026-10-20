#!/usr/bin/env bash
# 로컬 격리 스택에 27 SQL 을 적용/검증/롤백 리허설한다. 사용: bash scripts/prod-open/sat-order-rehearsal-run.sh [files...]
# 기본 순서: 27_preflight, 27_set_versions_official_order(2회: 멱등), 27_verify, 99_set_versions_official_order_rollback, 27_verify
U=${LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:59122/postgres}
case "$U" in *127.0.0.1*|*localhost*) ;; *) echo "로컬이 아님 — 중단"; exit 2;; esac
D=data/prod-open/sat-expand-sql
FILES=("$@"); [ ${#FILES[@]} -eq 0 ] && FILES=(27_preflight 27_set_versions_official_order 27_set_versions_official_order 27_verify 99_set_versions_official_order_rollback 27_verify)
for f in "${FILES[@]}"; do echo "== $f"; psql "$U" -f "$D/$f.sql" 2>&1 | grep -v '^$' | cut -c1-240 | head -60; done

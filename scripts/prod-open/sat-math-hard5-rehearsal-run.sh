#!/usr/bin/env bash
# 로컬 격리 스택(PORT_OFFSET=500, project_id ALTON_hard5)에서 46~51·99 SQL 을 리허설한다. 사용: bash scripts/prod-open/sat-math-hard5-rehearsal-run.sh [files...]
# 기본 순서: 46 preflight, 47 import, 48 keywords, 51 discard old drafts, 49 set versions(2회: 멱등), 50 verify
U=${LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54922/postgres}
case "$U" in *127.0.0.1*|*localhost*) ;; *) echo "로컬이 아님 - 중단"; exit 2;; esac
case "$U" in *5442[12]*) echo "공유 스택 포트 - 중단"; exit 2;; esac
D=data/prod-open/sat-expand-sql
FILES=("$@"); [ ${#FILES[@]} -eq 0 ] && FILES=(46_preflight_math_hard5 47_import_math_hard5 48_keywords_math_hard5 51_discard_math_harder_drafts 49_set_versions_math_hard5 49_set_versions_math_hard5 50_verify_math_hard5)
for f in "${FILES[@]}"; do echo "== $f"; psql "$U" -f "$D/$f.sql" 2>&1 | grep -v '^$' | cut -c1-260 | head -${HEAD_LINES:-45}; done

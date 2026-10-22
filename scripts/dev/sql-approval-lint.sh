#!/usr/bin/env bash
# 공유 DB 에 보내는 SQL 파일 점검(2026-10-22). create/alter/drop/grant/revoke/truncate 가 있는 파일은
# 첫 20줄 안에 "-- APPROVED: <오너 승인 근거(날짜·메시지 요약)>" 헤더가 있어야 통과한다. 읽기 전용 select 는 통과.
# 사용: scripts/dev/sql-approval-lint.sh file.sql [...]   (실패 시 종료 코드 1)
set -u
rc=0
for f in "$@"; do
  body=$(sed -E 's/--.*$//' "$f" | tr 'A-Z' 'a-z')
  if echo "$body" | grep -Eq '(^|[^a-z_])(create|alter|drop|grant|revoke|truncate)[[:space:]]'; then
    if ! head -20 "$f" | grep -Eq '^-- APPROVED: .+'; then
      echo "BLOCKED: $f 는 DDL/권한 변경을 포함하지만 '-- APPROVED:' 헤더가 없습니다." >&2; rc=1
    fi
  fi
  if echo "$body" | grep -Eq '(^|[^a-z_])(insert|update|delete)[[:space:]]'; then
    echo "NOTE: $f 는 공유 DB 에 쓰기를 합니다. 공유 DB 쓰기는 운영 변경으로 취급하고 오너 승인 근거를 보고에 적으세요." >&2
  fi
done
exit $rc

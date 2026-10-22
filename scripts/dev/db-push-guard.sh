#!/usr/bin/env bash
# supabase db push 래퍼(2026-10-22): ALTON_MIGRATION_APPROVED 가 가리키는 승인 문서가 있어야만 실행한다.
# 사용: ALTON_MIGRATION_APPROVED=docs/ops/approvals/<날짜>-<이름>.md scripts/dev/db-push-guard.sh [supabase db push 인자...]
set -eu
f="${ALTON_MIGRATION_APPROVED:-}"
if [ -z "$f" ] || [ ! -s "$f" ]; then
  echo "BLOCKED: ALTON_MIGRATION_APPROVED 가 없거나 비어 있습니다. 오너가 승인한 마이그레이션만 적용합니다." >&2; exit 1
fi
pending=$(supabase db push --linked --dry-run "$@" 2>/dev/null | grep -Eo '[0-9]{14}_[a-z0-9_]+\.sql' | sort -u || true)
for m in $pending; do
  grep -q "$m" "$f" || { echo "BLOCKED: 승인 문서에 $m 가 없습니다." >&2; exit 1; }
done
exec supabase db push --linked "$@"

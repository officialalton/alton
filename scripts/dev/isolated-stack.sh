#!/usr/bin/env bash
# 격리 Supabase 스택 시작/정리 래퍼. 공유 스택(ALTON, 54420~54429)은 어떤 경로로도 건드리지 않는다.
#   scripts/dev/isolated-stack.sh start ALTON_<이름>   # config.toml 임시 변경(project_id·포트 +100, smtp +200) → 락 기록 → supabase start
#   scripts/dev/isolated-stack.sh stop                 # 락의 id 로 검사 통과 시에만 `supabase stop --project-id <id> --no-backup`, config 원복, 락 삭제
# 마이그레이션 적용은 start 가 한다(처음부터 전부). 인자 없는 `supabase stop` 은 이 절차에서 쓰지 않는다.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
LOCK=tmp/isolated-stack.lock
case "${1:-}" in
  start)
    ID="${2:-}"; [[ "$ID" =~ ^ALTON_[A-Za-z0-9]+$ ]] || { echo "project id 는 ALTON_<이름> 형식(예: ALTON_apverify)" >&2; exit 1; }
    [[ -e "$LOCK" ]] && { echo "락이 이미 있습니다($LOCK). 먼저 stop." >&2; exit 1; }
    git diff --quiet HEAD -- supabase/config.toml || { echo "config.toml 이 HEAD 와 다릅니다(미커밋·스테이징 변경 포함) — 중단" >&2; exit 1; }
    grep -q '^project_id = "ALTON"$' supabase/config.toml || { echo "HEAD 의 config.toml project_id 가 ALTON 이 아닙니다(이미 격리 값이 커밋됨?) — 중단" >&2; exit 1; }
    python3 - "$ID" <<'PY'
import re,sys
p='supabase/config.toml'; s=open(p).read()
s=re.sub(r'^project_id = ".*"', f'project_id = "{sys.argv[1]}"', s, count=1, flags=re.M)
s=re.sub(r'^(\s*(?:port|shadow_port|smtp_port|pop3_port)\s*=\s*)(54\d{3})\b', lambda m: m.group(1)+str(int(m.group(2))+(200 if 'smtp_port' in m.group(1) else 100)), s, flags=re.M)
s=re.sub(r'^(inspector_port\s*=\s*)8083', r'\g<1>8583', s, flags=re.M)
open(p,'w').write(s)
PY
    if ! npx tsx scripts/dev/isolated-guard-cli.ts config; then git checkout HEAD -- supabase/config.toml; exit 1; fi
    mkdir -p tmp; printf '{"projectId":"%s","createdAt":"%s"}\n' "$ID" "$(date -u +%FT%TZ)" > "$LOCK"
    npx supabase start ;;
  stop)
    ID="$(npx tsx scripts/dev/isolated-guard-cli.ts teardown)" || exit 1
    npx supabase stop --project-id "$ID" --no-backup
    git checkout HEAD -- supabase/config.toml; rm -f "$LOCK"; echo "정리 완료: $ID" ;;
  *) echo "usage: $0 start ALTON_<name> | stop" >&2; exit 1 ;;
esac

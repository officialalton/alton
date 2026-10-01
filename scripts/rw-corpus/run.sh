#!/usr/bin/env bash
# RW 원문 코퍼스 수집 단일 진입점 — **오너가 터미널에서 직접 실행**(에이전트 실행 금지).
#   기본 dry-run: 받을 목록·예상 용량·거부 사유·디스크 여유·사전 점검만 출력(원문 다운로드 없음. 목록 생성 중 MedlinePlus 최신 파일 확인용 HEAD 요청만 나간다).
#   --execute   : 실제 수집 → 후처리 → 요약 출력.
# 사용: CORPUS_CONTACT=you@example.com scripts/rw-corpus/run.sh [--execute]
set -euo pipefail
cd "$(dirname "$0")/../.."
MODE="--dry"; [ "${1:-}" = "--execute" ] && MODE="--execute"
ROOT="$HOME/Developer/ALTON-data/rw-corpus"
WORK="$ROOT/_lists"

echo "== 사전 점검"
# 네트워크 호출 전에 연락처 검증(드라이런 포함 — MedlinePlus 목록 단계가 HEAD 요청을 보낸다)
CONTACT_RE='^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
CC="${CORPUS_CONTACT:-}"
if [ -z "$CC" ]; then echo "CORPUS_CONTACT 가 비어 있습니다. 실제 이메일 주소(영문·숫자)로 CORPUS_CONTACT 를 지정하세요. 예) CORPUS_CONTACT=name@gmail.com"; exit 1; fi
if ! [[ "$CC" =~ $CONTACT_RE ]] || [[ "$CC" =~ [Ee][Xx][Aa][Mm][Pp][Ll][Ee]\.(com|org|net) ]] || [[ "$CC" == *본인* ]] || [[ "$CC" == *[Yy][Oo][Uu][Rr]* ]]; then
  echo "CORPUS_CONTACT 가 실제 이메일 형식이 아니거나 예시 값입니다(값: $CC). 한글·example.com·'your' 같은 예시는 쓸 수 없습니다. 실제 이메일 주소(영문·숫자)로 CORPUS_CONTACT 를 지정하세요."; exit 1
fi
echo "연락처: $CC"
if [ "$MODE" = "--dry" ]; then echo "(안내) dry-run 이라도 MedlinePlus 최신 파일 확인(HEAD 요청 몇 건)과 필요 시 목록 단계에서 네트워크를 씁니다. 원문 본문은 받지 않습니다."; fi
command -v rsync >/dev/null || { echo "rsync 가 없습니다"; exit 1; }
command -v python3 >/dev/null || { echo "python3 가 없습니다"; exit 1; }
case "$ROOT" in *"Mobile Documents"*|*CloudDocs*|*iCloud*) echo "저장 경로가 iCloud 입니다"; exit 1;; esac
case "$ROOT" in "$PWD"/*) echo "저장 경로가 저장소 안입니다"; exit 1;; esac
mkdir -p "$ROOT/catalog" "$WORK"
FREE_KB=$(df -k "$ROOT" | awk 'NR==2{print $4}'); FREE_GB=$((FREE_KB/1024/1024))
echo "디스크 여유: ${FREE_GB}GB (20GB 미만이면 중단)"; [ "$FREE_GB" -ge 20 ] || { echo "디스크 여유 부족"; exit 1; }

echo "== 1. Gutenberg 공식 오프라인 카탈로그 확인"
UA="ALTON-corpus-collector/0.1 (RW reading corpus; contact ${CORPUS_CONTACT:-unset})"
if [ ! -f "$ROOT/catalog/gutenberg_selected.json" ]; then
  if [ "$MODE" = "--dry" ] && { [ ! -f "$ROOT/catalog/pg_catalog.csv" ] || [ ! -f "$ROOT/catalog/rdf-files.tar.bz2" ]; }; then
    echo "  카탈로그(약 150MB)가 아직 없습니다 — dry-run 에서는 받지 않습니다. --execute 때 공식 카탈로그 2개를 받습니다."
  else
    [ -f "$ROOT/catalog/pg_catalog.csv" ] || curl -sS -A "$UA" -o "$ROOT/catalog/pg_catalog.csv" https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv
    sleep 3
    [ -f "$ROOT/catalog/rdf-files.tar.bz2" ] || curl -sS -A "$UA" -o "$ROOT/catalog/rdf-files.tar.bz2" https://www.gutenberg.org/cache/epub/feeds/rdf-files.tar.bz2
    python3 scripts/rw-corpus/gutenberg_select.py
  fi
fi

echo "== 2. 다운로드 목록 생성(상한 적용)"
LISTS=""
if [ -f "$ROOT/catalog/gutenberg_selected.json" ]; then npx tsx scripts/rw-corpus/make-lists.ts --source gutenberg --out "$WORK/gutenberg.jsonl"; LISTS="$WORK/gutenberg.jsonl"; fi
npx tsx scripts/rw-corpus/make-lists.ts --source plos --out "$WORK/plos.jsonl"; LISTS="${LISTS:+$LISTS,}$WORK/plos.jsonl"
npx tsx scripts/rw-corpus/make-lists.ts --source medlineplus --out "$WORK/medlineplus.jsonl"; LISTS="${LISTS:+$LISTS,}$WORK/medlineplus.jsonl"

echo "== 3. 수집 계획 / 실행 ($MODE)"
if [ "$MODE" = "--execute" ]; then
  npx tsx scripts/rw-corpus/collect.ts --list "$LISTS" --execute
  echo "== 4. 후처리·요약"
  npx tsx scripts/rw-corpus/finalize.ts
  echo "== 디스크 사용"; du -sh "$ROOT"/* 2>/dev/null; df -h "$ROOT" | tail -1
else
  npx tsx scripts/rw-corpus/collect.ts --list "$LISTS"
  echo "dry-run 끝 — 실제 수집은 같은 명령에 --execute 를 붙이세요."
fi

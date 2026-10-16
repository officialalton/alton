#!/usr/bin/env bash
# 오너 실행용 — 적재 점검 → 로컬 배정 → 독립 검증 → 문제은행 변환 → 초안 세트 저장(공개 안 함). 비프로덕션 전용.
# 사용: bash scripts/ap-generation/owner-assemble.sh
# 단계마다 결과를 보여주고 y 를 눌러야 다음으로 넘어간다. 키는 터미널 환경변수만 사용(파일·로그에 없음).
set -u
EXPECT="worpsqwqgnspddnrtnvq"
T=(--target "$EXPECT" --i-know-nonprod "$EXPECT")
OUT=data/ap/stock/assembled
SETS=$OUT/sets
export STRUCTURE_GROUPS_FILE=data/ap/stock/structure-groups.json   # 승격된 보수 묶음

[ -n "${SUPABASE_SECRET_KEY:-}" ] && [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ] || { echo "환경변수 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 를 먼저 설정하세요."; exit 1; }
case "$NEXT_PUBLIC_SUPABASE_URL" in *"$EXPECT"*) ;; *) echo "URL 이 비프로덕션이 아닙니다. 중단."; exit 1;; esac
ask() { read -r -p "$1 [y/N] " a; [ "$a" = "y" ]; }
stop() { echo "중단: $1"; exit 1; }
mkdir -p "$SETS"

echo "=== 1. 적재 점검(읽기 전용) + 검증 완료 키 내보내기 ==="
npx tsx scripts/ap-generation/check-load.ts --write-verified $OUT/verified-keys.json | tail -30
ask "모든 파일에서 통과 키 = review_env_ready 입니까? (부족 표시가 없어야 함)" || stop "적재/검증 기록이 덜 끝났습니다. 부족한 파일만 owner-load.sh 로 다시 하세요."

echo; echo "=== 2. BC1 + AB2 배정(로컬 계산, 게시 AB#1 고정) ==="
npx tsx scripts/ap-generation/exact-assign.ts --sets BC1,AB2 --strict-families --min-pending --write-report $OUT/plan-bc1-ab2.json 2>&1 | tail -14
ask "가상 문항 0·위반 0 입니까?" || stop "BC1+AB2 배정 실패 — 결과를 보내 주세요."

echo; echo "=== 3. AB3, BC2, BC3 배정(BC1·AB2 문항 고정 제외) ==="
npx tsx scripts/ap-generation/exact-assign.ts --sets AB3,BC2,BC3 --strict-families --exclude-keys $OUT/plan-bc1-ab2.json --write-report $OUT/plan-rest.json 2>&1 | tail -14
ask "가상 문항 0·위반 0 입니까?" || stop "나머지 세트 배정 실패 — 결과를 보내 주세요."

echo; echo "=== 4~5. 세트별 키 파일 + 독립 검증 ==="
npx tsx scripts/ap-generation/assembly-keys.ts export --report $OUT/plan-bc1-ab2.json --out-dir $SETS | tail -5
npx tsx scripts/ap-generation/assembly-keys.ts export --report $OUT/plan-rest.json --out-dir $SETS | tail -5
FILES="$SETS/BC1.keys.json,$SETS/AB2.keys.json,$SETS/AB3.keys.json,$SETS/BC2.keys.json,$SETS/BC3.keys.json"
npx tsx scripts/ap-generation/assembly-keys.ts verify --files "$FILES" --verified-keys $OUT/verified-keys.json | tail -12
ask "독립 검증 위반이 0 입니까?" || stop "독립 검증 실패 — 결과를 보내 주세요."

echo; echo "=== 6. 문제은행 변환(용도 mock_exam 고정, 검수 환경) ==="
KEYS=$(python3 - <<E
import json
ks=[]
for s in "BC1 AB2 AB3 BC2 BC3".split():
    d=json.load(open("$SETS/%s.keys.json"%s))["keys"]
    for g in d.values(): ks+=g
print(",".join(ks))
E
)
npx tsx scripts/ap-generation/publish-to-bank.ts --purpose mock_exam --keys "$KEYS" "${T[@]}" 2>&1 | tail -12
ask "변환 대상 건수가 기대(이미 변환된 것 제외한 신규)와 맞습니까? --execute" && npx tsx scripts/ap-generation/publish-to-bank.ts --purpose mock_exam --keys "$KEYS" "${T[@]}" --execute 2>&1 | tail -8

echo; echo "=== 7. 초안 세트 저장(공개 안 함, 새 행만 INSERT) ==="
assemble() { # $1=세트 $2=과목 $3=이름
  echo "--- $3 (dry-run) ---"
  npx tsx scripts/ap-generation/assemble-ap-set.ts --subject "$2" --keys-file "$SETS/$1.keys.json" --name "$3" --draft "${T[@]}" 2>&1 | tail -10
  ask "$3 를 초안으로 저장합니까? --execute" && npx tsx scripts/ap-generation/assemble-ap-set.ts --subject "$2" --keys-file "$SETS/$1.keys.json" --name "$3" --draft "${T[@]}" --execute 2>&1 | tail -6
}
assemble BC1 ap_calculus_bc "AP Calculus BC — Practice Exam 1"
assemble AB2 ap_calculus_ab "AP Calculus AB — Practice Exam 2"
assemble AB3 ap_calculus_ab "AP Calculus AB — Practice Exam 3"
assemble BC2 ap_calculus_bc "AP Calculus BC — Practice Exam 2"
assemble BC3 ap_calculus_bc "AP Calculus BC — Practice Exam 3"

echo; echo "=== 8. 사후 점검(읽기 전용) ==="
npx tsx scripts/ap-generation/check-load.ts | tail -4
echo "완료. 위 단계 출력의 마지막 줄들(특히 1·2·3·5의 결과)을 알려주세요. 키는 보내지 마세요."

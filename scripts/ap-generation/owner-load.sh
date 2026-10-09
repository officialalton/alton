#!/usr/bin/env bash
# 오너 실행용 — 비프로덕션(worpsqwqgnspddnrtnvq) 적재·검증 기록. 사용: bash scripts/ap-generation/owner-load.sh graph|siblings|supp
# 각 단계: dry-run 출력 확인 → y 입력 시에만 --execute. 키는 파일에 없고 터미널 환경변수만 사용한다.
set -u
PHASE="${1:-}"
EXPECT_HOST="worpsqwqgnspddnrtnvq"
T=(--target "$EXPECT_HOST" --i-know-nonprod "$EXPECT_HOST")
SD=data/ap/stock

if [ -z "${SUPABASE_SECRET_KEY:-}" ] || [ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" ]; then
  echo "환경변수 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 를 먼저 설정하세요(README 참고)."; exit 1
fi
case "$NEXT_PUBLIC_SUPABASE_URL" in *"$EXPECT_HOST"*) ;; *) echo "URL 이 비프로덕션($EXPECT_HOST)이 아닙니다. 중단."; exit 1;; esac

ask() { read -r -p "$1 [y/N] " a; [ "$a" = "y" ]; }

run_step() { # $1=설명 $2=dry-run 플래그("--report" 또는 "-") 나머지=명령. 실행은 dry-run 플래그를 --execute 로 바꿔 재실행.
  local desc="$1" dry="$2"; shift 2
  local dflag=(); [ "$dry" != "-" ] && dflag=("$dry")
  echo; echo "=== $desc (dry-run) ==="
  npx tsx "$@" ${dflag[@]+"${dflag[@]}"} 2>&1 | tail -15
  if ask "위 dry-run 이 기대값과 같습니까? --execute 실행"; then
    echo "=== $desc (EXECUTE) ==="
    npx tsx "$@" --execute 2>&1 | tail -10
  else
    echo "건너뜀: $desc"; ask "중단할까요?" && exit 1
  fi
}

load_batch() { # $1=items 파일 $2=배치 $3=통과키 파일 $4=증거 파일
  run_step "적재 $1" --report scripts/ap-generation/import-candidates.ts --items "$SD/$1" --batch "$2" --supplement "${T[@]}"
}
verify_batch() { # $1=통과키 파일 $2=증거 파일
  run_step "렌더 기록 $1" - scripts/ap-generation/mark-verified.ts --render --report data/ap/render-check/report.json --keys-file "$SD/$1" "${T[@]}"
  run_step "화면 기록 $1" - scripts/ap-generation/mark-verified.ts --screen --evidence "data/ap/screen-evidence/$2" --keys-file "$SD/$1" "${T[@]}"
}

case "$PHASE" in
  graph)
    EV=evidence-graph-s1s3.json
    for pair in "s1:graph-s1-ab" "s2a:graph-s2-ab" "s2b:graph-s2-bc" "s3a:graph-s3a-ab" "s3b:graph-s3a-bc" "s3c:graph-s3b-ab" "s3d:graph-s3b-bc" "s3e:graph-s3c-ab" "s3f:graph-s3c-bc" "s3g:graph-s3d-bc"; do
      f="${pair%%:*}"; b="${pair##*:}-2026-10-09"
      load_batch "graph-$f-items.json" "$b"
      verify_batch "graph-$f-pass-keys.json" "$EV"
    done;;
  siblings)
    # 형제 21건은 이미 적재된 것으로 가정 — 렌더·화면 기록만.
    verify_batch v1v45-siblings-keys.json evidence-v1v45-siblings.json;;
  supp)
    EV=evidence-supp.json
    for n in b1 b2ab b2bc b3ab b3bc b4ab b5bc b6ab; do
      load_batch "supp-$n-items.json" "supp-$n-2026-10-09"
      verify_batch "supp-$n-pass-keys.json" "$EV"
    done;;
  *) echo "사용: bash scripts/ap-generation/owner-load.sh graph|siblings|supp"; exit 1;;
esac
echo; echo "완료: $PHASE. 모든 dry-run 의 '대상:' 줄이 $EXPECT_HOST 였는지 확인하세요."

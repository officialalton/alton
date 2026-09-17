#!/usr/bin/env bash
# 2026-09-16 — Preview 배포 표준 절차. `vercel deploy --target=preview`만 실행하면
# 새 일회성 URL이 생기고, 브랜치 고정 별칭(alton-git-preview-m4-integration-verification-
# alton7.vercel.app)은 CLI 배포로는 자동 갱신되지 않는다(실사용 중 발견 — Stripe webhook이
# 이 별칭을 고정 수신 주소로 쓰기 때문에, 별칭이 갱신 안 되면 결제 확인이 조용히 끊긴다).
# 이 스크립트는 배포 후 반드시 별칭을 최신 배포로 재지정하고, 실제로 그 별칭이 방금 배포한
# 코드를 서빙하는지 확인한 뒤에만 "완료"로 끝낸다 — 확인에 실패하면 0이 아닌 코드로 종료한다.
set -euo pipefail

SCOPE="alton7"
FIXED_ALIAS="alton-git-preview-m4-integration-verification-alton7.vercel.app"
BYPASS_TOKEN="fMFp1XOXGNLpWgDAP9PyPjwSV5THXgTp"

echo "==> Deploying to Preview..."
DEPLOY_OUTPUT=$(vercel deploy --target=preview --yes --scope "$SCOPE" --json)
DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | python3 -c "import json,sys; print(json.load(sys.stdin)['deployment']['url'].replace('https://','').replace('http://',''))")
DEPLOY_TARGET=$(echo "$DEPLOY_OUTPUT" | python3 -c "import json,sys; print(json.load(sys.stdin)['deployment']['target'])")

if [ "$DEPLOY_TARGET" != "None" ] && [ -n "$DEPLOY_TARGET" ]; then
  echo "FAIL: deployment target is '$DEPLOY_TARGET', expected null(Preview). Refusing to alias — this may be Production." >&2
  exit 1
fi
echo "==> Deployed: https://$DEPLOY_URL (target: $DEPLOY_TARGET — confirmed Preview)"

echo "==> Re-pointing fixed alias $FIXED_ALIAS -> $DEPLOY_URL"
vercel alias set "$DEPLOY_URL" "$FIXED_ALIAS" --scope "$SCOPE"

echo "==> Verifying alias actually serves the new deployment..."
# 방금 배포한 URL 자체와 별칭 둘 다에서 같은 헤더(x-vercel-id 앞부분 dpl 식별자 또는 응답 바디)를
# 비교해 별칭이 실제로 이 배포를 가리키는지 확인한다. 가장 확실한 신호는 Vercel이 응답에 싣는
# x-vercel-cache/x-matched-path가 아니라, 동일 API 라우트가 동일하게 동작하는지 자체다 —
# 여기서는 홈페이지 응답의 첫 바이트를 비교해 최소한 같은 배포가 응답하는지 확인한다.
DIRECT_HASH=$(curl -sS -H "x-vercel-protection-bypass: $BYPASS_TOKEN" "https://$DEPLOY_URL/" | md5)
ALIAS_HASH=$(curl -sS -H "x-vercel-protection-bypass: $BYPASS_TOKEN" "https://$FIXED_ALIAS/" | md5)

if [ "$DIRECT_HASH" != "$ALIAS_HASH" ]; then
  echo "FAIL: alias $FIXED_ALIAS does not appear to serve the same content as the new deployment." >&2
  echo "  direct: $DIRECT_HASH" >&2
  echo "  alias:  $ALIAS_HASH" >&2
  exit 1
fi

echo "==> OK: alias verified — $FIXED_ALIAS now serves the deployment just made (https://$DEPLOY_URL)."
echo "$DEPLOY_URL"

#!/usr/bin/env bash
# 운영 배포 직후 읽기 전용 점검(GET 만). 사용: scripts/prod-launch/healthcheck.sh https://alton.education
set -u
BASE="${1:?base url}"
fail=0
chk() { # path expected_regex
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE$1")
  if [[ "$code" =~ $2 ]]; then echo "OK   $code $1"; else echo "FAIL $code $1 (expect $2)"; fail=1; fi
}
chk / '^200$'
chk /login '^200$'
chk /signup/student '^200$'
chk /reset-password '^200$'
# 크론 라우트는 인증 없이 거부돼야 한다(401/403 = CRON_SECRET 설정됨, 503 = 미설정 → 비활성)
for r in close-payout-month dispatch-approved-payouts mark-expired-invites close-pending-accounts data-retention-batch dispatch-contracts resync-meeting-events; do
  chk "/api/cron/$r" '^(401|403|503)$'
done
chk /api/webhooks/mercury '^(405|501|503)$'
exit $fail

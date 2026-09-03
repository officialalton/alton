#!/usr/bin/env bash
# M1 Google Sandbox 통합 검증 실행 스크립트 (초안 — Claude가 작성, 실행은 하지 않음)
#
# 절대 이 파일을 그대로 blind execute 하지 마세요. 각 STEP을 순서대로 직접 읽고,
# 실행 전 echo로 찍히는 값(계정/프로젝트/수신자)을 눈으로 확인한 뒤 한 블록씩
# 실행하는 것을 전제로 작성했습니다. 이 스크립트 자체를 커밋하지 않습니다
# (요청대로 — 검토 후 직접 실행 전용, git add 하지 마세요).
#
# 근거 문서: docs/2026-09-03-m1-google-sandbox-verification-request.md (범위·상한·
# scope 표·정리 순서의 원본 — 이 스크립트는 그 문서의 절차를 실행 가능한 명령
# 시퀀스로 옮긴 것뿐, 범위를 스스로 넓히지 않습니다). R6 검증 로그(docs/CURRENT.md
# R6 15/N 항목)의 IAM binding·정리 패턴을 그대로 재사용합니다.
#
# 전제(이 스크립트를 실행하기 전 반드시 사람이 직접 확인):
#   1. matchbox512@snu.ac.kr 로만 이메일을 보낸다 — 다른 주소로 절대 보내지 않는다.
#   2. official@alton.education Calendar에 신규 이벤트 1개만 만든다.
#   3. 예상과 다른 응답(DWD scope 거부, 다른 권한 오류 등)이 나오면 그 자리에서
#      즉시 중단하고 범위를 넓히지 않는다 — 재시도로 우회하지 않는다.
#   4. 검증이 끝나면(성공이든 실패든) §7 정리 절차를 반드시 끝까지 실행한다.

set -euo pipefail

PROJECT_ID="alton-integration-sandbox"
SERVICE_ACCOUNT="gate-c-automation@${PROJECT_ID}.iam.gserviceaccount.com"
ORGANIZER_EMAIL="official@alton.education"
TEST_EMAIL_RECIPIENT="matchbox512@snu.ac.kr"   # 절대 다른 주소로 바꾸지 말 것
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 아래 두 값은 이 세션이 실제 GCP 프로젝트 콘솔/기존 R6 인프라 로그에서 직접 확인해야
# 하는 값입니다 — Claude는 실제 리소스 이름을 조회할 권한/맥락이 없어 R6 사례에서
# 쓰인 조건 패턴만 옮겨 적었습니다. 실행 전 gcloud로 실제 존재를 먼저 확인하세요.
WIF_POOL="projects/${PROJECT_ID}/locations/global/workloadIdentityPools/<실제-POOL-ID-확인>"
WIF_PROVIDER_CONDITION="assertion.owner_id=='<Vercel-owner-id>' && assertion.project_id=='<Vercel-project-id>' && assertion.environment=='development'"

echo "=== 실행 전 확인 ==="
echo "PROJECT_ID=${PROJECT_ID}"
echo "SERVICE_ACCOUNT=${SERVICE_ACCOUNT}"
echo "ORGANIZER_EMAIL=${ORGANIZER_EMAIL}"
echo "TEST_EMAIL_RECIPIENT=${TEST_EMAIL_RECIPIENT}"
read -r -p "위 값이 전부 맞으면 Enter, 아니면 Ctrl+C로 중단: " _confirm

################################################################################
# STEP 0 — 사전 확인(쓰기 없음)
################################################################################

echo "--- 현재 gcloud 활성 계정 확인 ---"
gcloud auth list

echo "--- 현재 IAM 정책 확인(변경 전 baseline 기록) ---"
gcloud iam service-accounts get-iam-policy "${SERVICE_ACCOUNT}" \
  --project "${PROJECT_ID}" \
  --format json > /tmp/m1-sandbox-iam-policy-before.json
cat /tmp/m1-sandbox-iam-policy-before.json

echo "--- DWD 등록 scope 문서 대조(이미 문서로 완료 — 재확인만) ---"
echo "docs/2026-09-03-m1-google-sandbox-verification-request.md §2 표를 다시 읽고,"
echo "실제 Admin Console(admin.google.com > 보안 > API 제어 > 도메인 전체 위임)에서"
echo "${SERVICE_ACCOUNT}의 클라이언트 ID에 다음 scope가 전부 등록돼 있는지 직접 확인:"
echo "  - https://www.googleapis.com/auth/calendar.events"
echo "  - https://www.googleapis.com/auth/meetings.space.settings"
echo "  - https://www.googleapis.com/auth/meetings.space.readonly"
echo "하나라도 없으면 여기서 중단 — 추가 등록을 스스로 하지 말고 보고."
read -r -p "위 3개 scope가 전부 등록돼 있으면 Enter, 아니면 Ctrl+C: " _confirm_scope

################################################################################
# STEP 1 — 임시 IAM binding 추가(좁은 조건, R6 패턴 재사용)
################################################################################

echo "--- 임시 environment:development WIF binding 추가 ---"
# R6 15/N과 동일한 패턴: Production 바인딩은 건드리지 않고, 이 세션에서만 쓸
# 좁은 조건의 바인딩을 추가한다. 실제 WIF_POOL 값은 위 변수를 실제 값으로
# 채운 뒤 실행할 것 — placeholder 그대로 실행하면 실패한다(의도된 안전장치).
gcloud iam service-accounts add-iam-policy-binding "${SERVICE_ACCOUNT}" \
  --project "${PROJECT_ID}" \
  --role "roles/iam.workloadIdentityUser" \
  --member "principalSet://iam.googleapis.com/${WIF_POOL}/*" \
  --condition "expression=${WIF_PROVIDER_CONDITION},title=m1-sandbox-temp,description=M1 Sandbox 통합 검증 임시 바인딩(검증 후 즉시 제거)"

echo "--- 바인딩 반영 확인(전파 지연 있을 수 있음, 실패 시 30초 후 재시도) ---"
gcloud iam service-accounts get-iam-policy "${SERVICE_ACCOUNT}" --project "${PROJECT_ID}"

################################################################################
# STEP 2 — 로컬 환경변수 설정(현재 셸에만, .env.local을 영구 수정하지 않음)
################################################################################

echo "--- 로컬 개발 서버용 임시 플래그 ---"
echo "아래 값을 이 터미널 세션에만 export 하거나, .env.local에 임시로 추가한 뒤"
echo "검증이 끝나면 반드시 삭제하세요(§7에서 다시 상기)."
cat <<'ENVVARS'
export CALENDAR_SYNC_ALLOW_REAL_CALLS=true
export GOOGLE_WORKLOAD_IDENTITY_AUDIENCE="<실제 WIF provider full resource name>"
export GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL="official@alton.education"
# CONSULT_ORGANIZER_EMAIL은 기본값이 이미 official@alton.education이라 생략 가능.
ENVVARS
read -r -p "위 환경변수를 실제로 설정했으면 Enter: " _confirm_env

echo "--- SMTP 실발송 설정 확인(이미 .env.local에 있음 — 재확인만, 값 출력 안 함) ---"
grep -q "^SMTP_HOST=" "${REPO_ROOT}/.env.local" && echo "SMTP_HOST 설정됨 — 실제 이메일이 나갈 준비가 됐다는 뜻. 수신자가 ${TEST_EMAIL_RECIPIENT} 하나뿐인지 이후 단계에서 매번 재확인할 것."

echo "--- (선택) 로컬 dev 서버 재시작 필요 — 새 env가 반영되도록 ---"
echo "  npm run dev 를 재시작하세요(이미 떠 있다면 재시작)."

################################################################################
# STEP 3 — 단건 상담 확정 흐름(Calendar+Meet 1개, 확인 이메일 1통)
################################################################################

DB_URL="postgresql://postgres:postgres@127.0.0.1:54422/postgres"

echo "--- 3-1. 이 검증 전용 반복 가능시간 등록(다른 데이터와 겹치지 않게) ---"
psql "${DB_URL}" -X -q -c "
insert into consult_availability_rules (weekday, start_time, end_time)
values (extract(dow from (now() + interval '3 day'))::smallint, '09:00', '20:00');
"

echo "--- 3-2. 홈페이지 신청(테스트 이메일만 사용) ---"
echo "브라우저로 http://localhost:3010/ 접속 → 상담 폼에서:"
echo "  이메일: ${TEST_EMAIL_RECIPIENT}"
echo "  (이름/전화/학년/문의는 아무 값이나 — 단 이메일만 위 주소 고정)"
echo "슬롯을 하나 선택하고 제출."

echo "--- 3-3. 방금 만든 상담 ID 확인 ---"
psql "${DB_URL}" -X -q -c "
select id, status, contact_email, starts_at from consultations
where contact_email = '${TEST_EMAIL_RECIPIENT}' order by requested_at desc limit 1;
"
echo "위 id를 CONSULT_ID로 기억해두세요(이후 단계에서 재사용)."

echo "--- 3-4. 관리자 로그인 → 상담 운영 탭에서 수락 ---"
echo "브라우저로 http://localhost:3010/admin?tab=consult → \"상담 운영(신청·수락·캘린더)\""
echo "→ 방금 신청 건 \"수락(Calendar·Meet 생성)\" 클릭."
echo "이 클릭이 실제로 official@alton.education Calendar에 이벤트+Meet를 만들고,"
echo "Smart Notes 상태를 확인/보정하고, ${TEST_EMAIL_RECIPIENT}로 확인 이메일을 보낸다."

echo "--- 3-5. 실제로 생성됐는지 DB로 확인 ---"
echo "psql \"${DB_URL}\" -X -q -c \"select id, google_event_id, google_meet_link, google_sync_status, smart_notes_config_status, confirmation_email_sent_at from consultations where id='<CONSULT_ID>';\""

echo "--- 3-6. 실제 Google Calendar에서도 눈으로 확인 ---"
echo "official@alton.education으로 calendar.google.com 로그인(또는 관리자에게 공유받은 화면)해서"
echo "방금 생성된 이벤트가 실제로 있는지, Meet 링크가 유효한지 확인."

echo "--- 3-7. ${TEST_EMAIL_RECIPIENT} 받은편지함에서 이메일 실제 수신 확인 ---"
echo "제목: [Alton Education] 상담 일정이 확정되었습니다"
echo "본문의 동의 확인 링크가 http://localhost:3010/consult/consent?token=... 형태의"
echo "절대 URL인지(상대경로 아님) 확인."

################################################################################
# STEP 4 — 동의 토큰 확인 + 재처리 중복 방지
################################################################################

echo "--- 4-1. 이메일의 동의 링크를 실제로 클릭해 확인 처리 ---"
echo "브라우저로 이메일 속 링크 방문 → \"안내 내용을 확인했습니다\" 클릭."

echo "--- 4-2. 확인 기록 DB 확인 ---"
echo "psql \"${DB_URL}\" -X -q -c \"select consent_confirmed_at, consent_confirmed_ip from consultations where id='<CONSULT_ID>';\""

echo "--- 4-3. 같은 링크 재방문(멱등 확인, 재확인 화면이 아니라 \"확인 완료\" 문구만 보여야 함) ---"
echo "같은 브라우저로 같은 링크 다시 방문 → \"확인 완료 (...)\" 문구 확인, 버튼 없어야 함."

echo "--- 4-4. 재처리 시 Calendar/이메일 중복 생성 안 됨 확인 ---"
echo "관리자 화면에서 \"Calendar 재처리 실행\" 버튼을 한 번 더 클릭."
echo "psql로 google_event_id가 그대로인지, confirmation_email_sent_at이 갱신되지 않았는지 확인:"
echo "psql \"${DB_URL}\" -X -q -c \"select google_event_id, confirmation_email_sent_at from consultations where id='<CONSULT_ID>';\""
echo "${TEST_EMAIL_RECIPIENT} 받은편지함에도 이메일이 1통만 있어야 한다(2통이면 버그)."

################################################################################
# STEP 5 — 시간 변경(PATCH) + 새 이메일 1통만
################################################################################

echo "--- 5-1. 관리자 화면에서 \"시간 변경\" 클릭, 새 시간 입력 ---"
echo "--- 5-2. 같은 google_event_id가 유지되는지(신규 이벤트 아님) 확인 ---"
echo "psql \"${DB_URL}\" -X -q -c \"select google_event_id, starts_at from consultations where id='<CONSULT_ID>';\""
echo "--- 5-3. ${TEST_EMAIL_RECIPIENT}에 새 시간이 반영된 이메일이 정확히 1통 더(누적 2통) 도착했는지 확인 ---"

################################################################################
# STEP 6 — 합성 회의(최대 20분) + Smart Notes 원본 자동 연결 + 4조건 게이트
################################################################################

echo "--- 6-1. 통제된 Sandbox 참가자만으로 위 Meet 링크에 실제로 접속해 짧게 회의 ---"
echo "참가자: official@alton.education 및 사전에 합의된 Sandbox 테스트 계정만."
echo "추가 참가자 초대 금지. Smart Notes 생성이 확인되는 즉시 종료 — 최대 20분 절대 초과 금지."

echo "--- 6-2. Workspace Events 수신 확인 ---"
echo "docs/2026-09-03-m1-google-sandbox-verification-request.md §1의 구독 방식을 따른다."
echo "이 로컬 환경은 공인 URL이 없어 Pub/Sub push가 도달하지 못한다 — 다음 중 하나를 선택:"
echo "  (a) R6가 썼던 pull 구독을 재사용해 메시지를 pull한 뒤, 그 payload로"
echo "      curl -X POST http://localhost:3010/api/webhooks/workspace-events 를 수동 재현, 또는"
echo "  (b) 이미 배포된 Preview 환경(공인 URL 보유)에 동일 플래그를 임시로 걸어 실행."
echo "  둘 다 어렵다면 이 단계에서 중단하고 보고 — 임의로 새 공인 엔드포인트를 만들지 않는다."

echo "--- 6-3. 자동 매칭 + drive_file_id 연결 확인 ---"
echo "psql \"${DB_URL}\" -X -q -c \"select smart_notes_drive_file_id, smart_notes_config_status from consultations where id='<CONSULT_ID>';\""
echo "psql \"${DB_URL}\" -X -q -c \"select id, consultation_id, drive_file_id, linked, pubsub_message_id from smart_notes_generation_events order by received_at desc limit 3;\""

echo "--- 6-4. 관리자 전용 노출만 되는지 재확인(잠재고객에게는 노출 경로 없음 — 코드 리뷰로 이미 확인됨) ---"

echo "--- 6-5. 관리자 검토 요약 작성 후 4조건 게이트 통과 확인 ---"
echo "관리자 화면에서 \"상담 결과 기록\" 클릭 → 요약 입력 → outcome 선택."
echo "4개 조건(동의/Smart Notes ON/원본 연결/요약 비공백)이 실제로 전부 충족된 뒤에만"
echo "성공해야 한다 — 하나라도 빠진 상태에서 시도해 서버가 실제로 거부하는지도 한 번 확인."

################################################################################
# STEP 7 — 정리(반드시 끝까지 실행, 성공/실패 무관)
################################################################################

echo "=== 정리 시작 — 검증 성공/실패와 무관하게 전부 실행 ==="

echo "--- 7-1. 생성한 Calendar 이벤트 삭제 ---"
echo "관리자 화면 \"취소\" 버튼 또는 실제 Google Calendar에서 직접 삭제 — 둘 다 실행해"
echo "ALTON DB와 Google 양쪽 모두에서 사라졌는지 확인."

echo "--- 7-2. Workspace Events 구독 정리(6-2에서 새로 만들었다면) ---"
echo "gcloud pubsub subscriptions delete <구독명> --project ${PROJECT_ID}  # 신규로 만들었을 때만"

echo "--- 7-3. 합성 Smart Notes Google Doc 삭제 ---"
echo "official@alton.education 또는 회의 참가자 Drive에서 생성된 합성 문서를 직접 삭제."

echo "--- 7-4. 테스트 데이터 정리(로컬 DB 전용이므로 reset 한 번으로 충분) ---"
cd "${REPO_ROOT}" && npx supabase db reset --local

echo "--- 7-5. 임시 IAM binding 제거 ---"
gcloud iam service-accounts remove-iam-policy-binding "${SERVICE_ACCOUNT}" \
  --project "${PROJECT_ID}" \
  --role "roles/iam.workloadIdentityUser" \
  --member "principalSet://iam.googleapis.com/${WIF_POOL}/*" \
  --condition "expression=${WIF_PROVIDER_CONDITION},title=m1-sandbox-temp,description=M1 Sandbox 통합 검증 임시 바인딩(검증 후 즉시 제거)"

echo "--- 7-6. IAM 정책 재조회로 Production만 남았는지 실제 확인 ---"
gcloud iam service-accounts get-iam-policy "${SERVICE_ACCOUNT}" \
  --project "${PROJECT_ID}" \
  --format json > /tmp/m1-sandbox-iam-policy-after.json
diff /tmp/m1-sandbox-iam-policy-before.json /tmp/m1-sandbox-iam-policy-after.json \
  && echo "정책이 검증 전과 동일함 — 임시 바인딩 완전히 제거 확인." \
  || echo "!!! 정책이 검증 전과 다릅니다 — m1-sandbox-temp 바인딩이 실제로 지워졌는지 직접 재확인하세요 !!!"

echo "--- 7-7. 로컬 임시 파일 삭제 ---"
rm -f /tmp/m1-sandbox-iam-policy-before.json /tmp/m1-sandbox-iam-policy-after.json

echo "--- 7-8. 로컬 환경변수 원복 ---"
echo "STEP 2에서 export/​.env.local에 추가한 CALENDAR_SYNC_ALLOW_REAL_CALLS 등을 전부"
echo "제거하고 dev 서버를 재시작하세요. 아래로 실제 false/미설정임을 확인:"
echo '  echo "CALENDAR_SYNC_ALLOW_REAL_CALLS=${CALENDAR_SYNC_ALLOW_REAL_CALLS:-<unset>}"'
echo '  grep -n "CALENDAR_SYNC_ALLOW_REAL_CALLS" .env.local || echo ".env.local에 없음(정상)"'

echo "=== 정리 완료 — docs/CURRENT.md/실행 로그에 실제 결과(성공/실패/발견된 버그/정리 확인)를 기록할 것 ==="

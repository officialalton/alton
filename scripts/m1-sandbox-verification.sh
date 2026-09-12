#!/usr/bin/env bash
# M1 Google Sandbox 통합 검증 실행 스크립트 (v2 — Claude가 작성, 실행은 하지 않음)
#
# 절대 이 파일을 그대로 blind execute 하지 마세요. 각 STEP을 순서대로 직접 읽고,
# 실행 전 echo로 찍히는 값(계정/프로젝트/수신자)을 눈으로 확인한 뒤 한 블록씩
# 실행하는 것을 전제로 작성했습니다.
#
# 근거 문서: docs/2026-09-03-m1-google-sandbox-verification-request-v2.md (범위·상한·
# 정리 순서의 원본 — 이 스크립트는 그 문서의 절차를 실행 가능한 명령 시퀀스로 옮긴
# 것뿐, 범위를 스스로 넓히지 않습니다). v1 전용 절차(attendee 없는 이벤트, 커스텀
# fallback 이메일 발송 유도 등)는 v2 정책과 맞지 않아 이 버전에서 제거했습니다.
#
# 비밀값 처리: 이 파일에는 어떤 비밀값도 하드코딩하지 않는다 — CALENDAR_SYNC_ALLOW_
# REAL_CALLS/GOOGLE_WORKLOAD_IDENTITY_AUDIENCE 등은 실행하는 사람이 그때그때 셸에
# export하거나 .env.local에 "검증 시작 직전에 추가 → 검증 종료 직후 제거"하는 것을
# 전제로 한다(§2, §7-8). SMTP_PASS 등 이메일 발송 자격증명은 이 스크립트가 전혀
# 건드리지 않는다 — 이미 .env.local에 있는 값을 그대로 쓰거나, 없으면 발송 자체가
# no-op된다(lib/email.ts).
#
# 전제(이 스크립트를 실행하기 전 반드시 사람이 직접 확인):
#   1. 상담 신청자 이메일과 테스트 학생 계정 이메일 둘 다 matchbox512@snu.ac.kr로
#      고정한다 — 역할 검증을 위해 계정을 2개 만들거나 다른 주소를 쓰지 않는다.
#   2. official@alton.education Calendar에 상담 이벤트 1개, 선생님 Calendar에 수업
#      이벤트 1개, 총 신규 이벤트 2개만 만든다.
#   3. Workspace Events 구독은 organizer(상담 관리자/선생님)당 최대 1개.
#   4. 커스텀 SMTP fallback 이메일이 발송되도록 의도적으로 실패를 유도하지 않는다 —
#      이 검증에서 fallback 경로는 테스트하지 않는다(정상 성공 경로만 검증).
#   5. 예상과 다른 응답(DWD scope 거부, 다른 권한 오류, attendee가 원본에 실제로
#      접근 가능한 경우 등)이 나오면 그 자리에서 즉시 중단하고 범위를 넓히지 않는다.
#   6. 검증이 끝나면(성공이든 실패든) §7 정리 절차를 반드시 끝까지 실행한다.

set -euo pipefail

PROJECT_ID="alton-integration-sandbox"
SERVICE_ACCOUNT="gate-c-automation@${PROJECT_ID}.iam.gserviceaccount.com"
CONSULT_ORGANIZER_EMAIL="official@alton.education"
TEACHER_ORGANIZER_EMAIL="<검증에 쓸 실제 선생님 Sandbox 테스트 계정 — 실행 전 채울 것>"
TEST_ACCOUNT="matchbox512@snu.ac.kr"   # 상담 신청자 겸 테스트 학생 attendee — 계정 1개만, 절대 다른 주소로 바꾸지 말 것
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 아래 두 값은 실제 GCP 프로젝트 콘솔/기존 R6 인프라 로그에서 직접 확인해야 하는
# 값입니다 — 이 스크립트는 R6 검증(docs/CURRENT.md R6 15/N) 때 쓰인 조건 패턴만
# 옮겨 적었습니다. placeholder 그대로 실행하면 실패하도록 의도했습니다.
WIF_POOL="projects/${PROJECT_ID}/locations/global/workloadIdentityPools/<실제-POOL-ID-확인>"
WIF_PROVIDER_CONDITION="assertion.owner_id=='<Vercel-owner-id>' && assertion.project_id=='<Vercel-project-id>' && assertion.environment=='development'"

echo "=== 실행 전 확인 ==="
echo "PROJECT_ID=${PROJECT_ID}"
echo "SERVICE_ACCOUNT=${SERVICE_ACCOUNT}"
echo "CONSULT_ORGANIZER_EMAIL=${CONSULT_ORGANIZER_EMAIL}"
echo "TEACHER_ORGANIZER_EMAIL=${TEACHER_ORGANIZER_EMAIL}"
echo "TEST_ACCOUNT(상담 신청자 겸 학생 attendee, 계정 1개)=${TEST_ACCOUNT}"
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

echo "--- DWD 등록 scope 문서 대조 ---"
echo "docs/2026-09-03-m1-google-sandbox-verification-request.md §2 표를 다시 읽고,"
echo "실제 Admin Console(admin.google.com > 보안 > API 제어 > 도메인 전체 위임)에서"
echo "${SERVICE_ACCOUNT}의 클라이언트 ID에 다음 scope가 전부 등록돼 있는지 직접 확인:"
echo "  - https://www.googleapis.com/auth/calendar.events"
echo "  - https://www.googleapis.com/auth/meetings.space.settings"
echo "  - https://www.googleapis.com/auth/meetings.space.readonly"
echo "  - https://www.googleapis.com/auth/admin.directory.user.readonly (Directory API —"
echo "    organizer 이메일→불변 사용자 ID resolve에 필요, lib/google-workspace-directory-readonly.ts)"
echo "  - Workspace Events 구독 생성 자체에 필요한 scope(문서상 미확정 — 실측 자체가 이번 목적 중 하나,"
echo "    최초 호출이 403이면 그 응답을 그대로 기록하고 여기서 중단)"
echo "하나라도 이미 없는 게 확실하면 여기서 중단 — 추가 등록을 스스로 하지 말고 보고."
read -r -p "위 확인이 끝났으면 Enter, 아니면 Ctrl+C: " _confirm_scope

################################################################################
# STEP 0.5 — Pub/Sub 토픽·push subscription·Publisher 권한 준비(쓰기 있음, 신규 GCP 리소스)
################################################################################
#
# 2026-09-03 모델 정정: Workspace Events 구독의 notificationEndpoint.pubsubTopic은
# 실제 Pub/Sub 토픽 리소스(projects/{project}/topics/{topic})여야 하고, 이 토픽과
# 웹훅 HTTP 엔드포인트(app/api/webhooks/workspace-events)는 서로 다른 GCP 리소스다 —
# 토픽에 별도의 Pub/Sub push subscription을 만들어 그 push endpoint로 웹훅 URL을
# 지정해야 실제로 알림이 그 URL까지 전달된다. 이 STEP은 그 전달 경로 전체를 준비한다.

echo "--- 0.5-1. 전용 Pub/Sub 토픽 생성(신규 GCP 리소스 — 상한: 이 검증 전용 1개) ---"
WORKSPACE_EVENTS_TOPIC="projects/${PROJECT_ID}/topics/m1-sandbox-workspace-events-v2"
echo "gcloud pubsub topics create m1-sandbox-workspace-events-v2 --project ${PROJECT_ID}"
echo "(이미 있으면 재사용 — 매번 새로 만들지 않는다)"

echo "--- 0.5-2. Workspace Events 발행 서비스 계정에 이 토픽의 Publisher 권한 부여 ---"
echo "Google Workspace Events가 이 토픽에 발행할 때 쓰는 서비스 계정 이름은 GCP 콘솔"
echo "(Pub/Sub > 토픽 > 권한, 또는 Workspace Events API 활성화 페이지)에서 직접 확인하세요 —"
echo "이 스크립트가 그 이름을 추정해 넣지 않습니다(잘못된 이름으로 권한을 부여하는 실수를"
echo "피하기 위함). 확인한 이름으로 아래 형태의 명령을 실행:"
echo "  gcloud pubsub topics add-iam-policy-binding m1-sandbox-workspace-events-v2 \\"
echo "    --project ${PROJECT_ID} --member=\"serviceAccount:<확인한 발행 서비스 계정>\" \\"
echo "    --role=\"roles/pubsub.publisher\""

echo "--- 0.5-3. 이 토픽에 push subscription 생성 — push endpoint가 실제 웹훅 URL ---"
echo "웹훅 URL은 공인 접근 가능해야 한다(로컬 3010은 불가 — Preview 배포 URL 등 사용):"
echo "  gcloud pubsub subscriptions create m1-sandbox-workspace-events-push-v2 \\"
echo "    --project ${PROJECT_ID} --topic m1-sandbox-workspace-events-v2 \\"
echo "    --push-endpoint=\"<공인 웹훅 URL>/api/webhooks/workspace-events\" \\"
echo "    --push-auth-service-account=\"<OIDC 서명용 서비스 계정>\""
echo "(WORKSPACE_EVENTS_PUSH_AUDIENCE/WORKSPACE_EVENTS_PUSH_SERVICE_ACCOUNT_EMAIL 환경변수를"
echo "이 서비스 계정·오디언스에 맞춰 설정 — app/api/webhooks/workspace-events/route.ts가 이 값으로"
echo "OIDC 토큰을 검증한다.)"

echo "이 토픽 리소스 이름을 STEP 2에서 WORKSPACE_EVENTS_PUBSUB_TOPIC으로 export:"
echo "  export WORKSPACE_EVENTS_PUBSUB_TOPIC=\"${WORKSPACE_EVENTS_TOPIC}\""
read -r -p "0.5-1~0.5-3을 전부 완료했으면 Enter: " _confirm_pubsub

################################################################################
# STEP 1 — 임시 IAM binding 추가(좁은 조건, R6 패턴 재사용)
################################################################################

echo "--- 임시 environment:development WIF binding 추가 ---"
gcloud iam service-accounts add-iam-policy-binding "${SERVICE_ACCOUNT}" \
  --project "${PROJECT_ID}" \
  --role "roles/iam.workloadIdentityUser" \
  --member "principalSet://iam.googleapis.com/${WIF_POOL}/*" \
  --condition "expression=${WIF_PROVIDER_CONDITION},title=m1-sandbox-temp-v2,description=M1 Sandbox v2 통합 검증 임시 바인딩(검증 후 즉시 제거)"

echo "--- 바인딩 반영 확인(전파 지연 있을 수 있음, 실패 시 30초 후 재시도) ---"
gcloud iam service-accounts get-iam-policy "${SERVICE_ACCOUNT}" --project "${PROJECT_ID}"

################################################################################
# STEP 2 — 로컬 환경변수 설정(현재 셸에만, 검증 종료 즉시 원복)
################################################################################

echo "--- 로컬 개발 서버용 임시 플래그(비밀값 없음 — 이 스크립트가 값을 채우지 않는다) ---"
echo "아래 값을 이 터미널 세션에만 export 하거나, .env.local에 '검증 시작 직전에만'"
echo "추가하세요. §7-8에서 반드시 제거합니다."
cat <<'ENVVARS'
export CALENDAR_SYNC_ALLOW_REAL_CALLS=true
export GOOGLE_WORKLOAD_IDENTITY_AUDIENCE="<실제 WIF provider full resource name>"
export GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL="official@alton.education"
export NEXT_PUBLIC_SITE_URL="http://localhost:3010"
export WORKSPACE_EVENTS_PUBSUB_TOPIC="projects/alton-integration-sandbox/topics/m1-sandbox-workspace-events-v2"
# 위 WORKSPACE_EVENTS_PUBSUB_TOPIC은 STEP 0.5-1에서 실제로 만든 토픽의 정확한 리소스
# 이름이어야 한다 — 없거나 형식이 틀리면(예: 웹훅 URL을 넣는 실수) 코드가 실제 API를
# 호출하기 전에 fail-closed로 즉시 거부한다(lib/google-workspace-events-subscriptions.ts).
# CONSULT_ORGANIZER_EMAIL은 기본값이 이미 official@alton.education이라 생략 가능.
# WORKSPACE_PREFLIGHT_ALLOW_REAL_READS=true도 필요(organizer 이메일→Directory API 불변
# 사용자 ID resolve, lib/google-workspace-directory-readonly.ts의 게이트).
# WORKSPACE_EVENTS_PUSH_AUDIENCE / WORKSPACE_EVENTS_PUSH_SERVICE_ACCOUNT_EMAIL은
# 6-2(Workspace Events 수신)에서만 필요 — 로컬은 공인 URL이 없어 pull 재현 방식을 쓴다.
ENVVARS
read -r -p "위 환경변수를 실제로 설정했으면 Enter: " _confirm_env

echo "--- SMTP 실발송 설정 확인(이미 .env.local에 있는 값 재확인만, 값 자체는 출력 안 함) ---"
grep -q "^SMTP_HOST=" "${REPO_ROOT}/.env.local" && echo "SMTP_HOST 설정됨 — Calendar 초대가 정상 성공하면 커스텀 이메일은 발송되지 않는다(중복 방지 정책). fallback 발송은 이 검증에서 의도적으로 유도하지 않는다."

echo "--- (선택) 로컬 dev 서버 재시작 필요 — 새 env가 반영되도록 ---"
echo "  npm run dev 를 재시작하세요(이미 떠 있다면 재시작)."

DB_URL="postgresql://postgres:postgres@127.0.0.1:54422/postgres"

################################################################################
# STEP 3 — 상담 이벤트(attendee 포함) — 최대 1개
################################################################################

echo "--- 3-1. 이 검증 전용 반복 가능시간 등록(다른 데이터와 겹치지 않게) ---"
psql "${DB_URL}" -X -q -c "
insert into consult_availability_rules (weekday, start_time, end_time)
values (extract(dow from (now() + interval '3 day'))::smallint, '09:00', '20:00');
"

echo "--- 3-2. 홈페이지 신청(신청자 이메일 = ${TEST_ACCOUNT} 고정) ---"
echo "브라우저로 http://localhost:3010/ 접속 → 상담 폼에서 이메일을 ${TEST_ACCOUNT}로 입력, 슬롯 선택 후 제출."

echo "--- 3-3. 방금 만든 상담 ID 확인 ---"
psql "${DB_URL}" -X -q -c "
select id, status, contact_email, starts_at from consultations
where contact_email = '${TEST_ACCOUNT}' order by requested_at desc limit 1;
"
echo "위 id를 CONSULT_ID로 기억해두세요(이후 단계에서 재사용)."

echo "--- 3-4. 관리자 로그인 → 상담 운영 탭에서 수락 ---"
echo "브라우저로 http://localhost:3010/admin?tab=consult → \"상담 운영(신청·수락·캘린더)\""
echo "→ 방금 신청 건 \"수락(Calendar·Meet 생성)\" 클릭."
echo "이 클릭이 실제로 ${CONSULT_ORGANIZER_EMAIL} Calendar에 이벤트+Meet를 만들고,"
echo "${TEST_ACCOUNT}를 유일한 attendee로 추가하고 sendUpdates=all로 Google 네이티브"
echo "초대를 발송한다(커스텀 이메일 아님 — 성공 시 커스텀 메일은 나가지 않는다)."

echo "--- 3-5. DB로 attendee/guest 제한/Calendar 상태 확인 ---"
echo "psql \"${DB_URL}\" -X -q -c \"select id, google_event_id, google_meet_link, google_sync_status, smart_notes_config_status from consultations where id='<CONSULT_ID>';\""

echo "--- 3-6. 실제 Google Calendar에서 attendee·guest 제한 확인 ---"
echo "${CONSULT_ORGANIZER_EMAIL}으로 calendar.google.com 로그인해서 방금 생성된 이벤트를 열고:"
echo "  - Guests: ${TEST_ACCOUNT} 하나만 있는지"
echo "  - Guest permissions: 'Modify event'/'Invite others'/'See guest list' 전부 꺼져 있는지"
echo "  - Meet 링크가 유효한지"

echo "--- 3-7. ${TEST_ACCOUNT} 받은편지함에서 Google 네이티브 초대 메일 수신 확인 ---"
echo "발신: Google Calendar(캘린더 초대 형식) — ALTON 커스텀 발신 이메일이 별도로 오지 않았는지도 확인."
echo "이벤트 설명에 AI Smart Notes 안내 + 동의 확인 링크(절대 URL, http://localhost:3010/consult/consent?token=...)가 있는지 확인."

################################################################################
# STEP 4 — 동의 토큰 확인 + 재처리 중복 방지
################################################################################

echo "--- 4-1. 이메일/이벤트 설명 속 동의 링크를 실제로 클릭해 확인 처리 ---"
echo "--- 4-2. 확인 기록 DB 확인 ---"
echo "psql \"${DB_URL}\" -X -q -c \"select consent_confirmed_at, consent_confirmed_ip from consultations where id='<CONSULT_ID>';\""
echo "--- 4-3. 같은 링크 재방문(멱등 확인 — \"확인 완료\" 문구만 보여야 함, 버튼 없음) ---"
echo "--- 4-4. 재처리해도 Calendar 이벤트/초대 메일 중복 생성 안 됨 확인 ---"
echo "관리자 화면 \"Calendar 재처리 실행\" 버튼을 한 번 더 클릭 후:"
echo "psql \"${DB_URL}\" -X -q -c \"select google_event_id from consultations where id='<CONSULT_ID>';\"  # 값이 그대로여야 함"
echo "${TEST_ACCOUNT} 받은편지함에 새 메일이 추가로 오지 않았는지 확인."

################################################################################
# STEP 5 — 시간 변경(같은 이벤트 PATCH, sendUpdates=all 네이티브 변경 알림)
################################################################################

echo "--- 5-1. 관리자 화면 \"시간 변경\" 인라인 폼으로 새 시간 입력·제출 ---"
echo "--- 5-2. 같은 google_event_id가 유지되는지(신규 이벤트 아님) 확인 ---"
echo "psql \"${DB_URL}\" -X -q -c \"select google_event_id, starts_at from consultations where id='<CONSULT_ID>';\""
echo "--- 5-3. ${TEST_ACCOUNT}에 Google 네이티브 '일정 변경' 알림이 왔는지 확인(ALTON 커스텀 메일 추가 발송 없음) ---"

################################################################################
# STEP 6 — 정규수업 이벤트(attendee 포함) — 최대 1개, Workspace Events, Smart Notes
################################################################################

echo "--- 6-1. 선생님 조직에 최소 1개 confirmed 예약을 준비(기존 R6 예약 플로우 사용) ---"
echo "보호자/학생 계정으로 ${TEACHER_ORGANIZER_EMAIL} 선생님의 슬롯을 예약 — 단, 이 검증에서는"
echo "학생 계정 이메일이 ${TEST_ACCOUNT}와 동일해야 하므로, 이 슬롯을 예약하는 학생 프로필의"
echo "auth.users.email이 실제로 ${TEST_ACCOUNT}인지 사전에 확인하세요(다른 테스트 학생이면 attendee가 달라짐)."
echo "psql \"${DB_URL}\" -X -q -c \"select id, email from auth.users where email='${TEST_ACCOUNT}';\""

echo "--- 6-2. 예약 확정 → 선생님 Calendar에 이벤트+attendee 생성 확인 ---"
echo "psql \"${DB_URL}\" -X -q -c \"select id, google_event_id, google_meet_link, google_sync_status from reservations where owner_profile_id=(select id from teachers where workspace_email='${TEACHER_ORGANIZER_EMAIL}') order by created_at desc limit 1;\""
echo "실제 Google Calendar(${TEACHER_ORGANIZER_EMAIL})에서 attendee가 ${TEST_ACCOUNT} 하나뿐이고"
echo "guest 제한 3종이 꺼져 있는지, 보호자 계정은 attendee에 없는지 확인."

echo "--- 6-3. Workspace Events 구독 생성(상담 organizer 1개 + 선생님 organizer 1개, 총 최대 2개) ---"
echo "3-4/6-2에서 Calendar 동기화가 성공하면 ensureSubscriptionForOrganizer()가 각 organizer에"
echo "대해 best-effort로 구독 생성을 시도한다. 이 과정에서 실제로 (a) Directory API로"
echo "organizer 이메일→불변 사용자 ID를 resolve하고(organizer_workspace_user_id에 캐시),"
echo "(b) targetResource=//cloudidentity.googleapis.com/users/{그 ID}로 구독을 생성한다."
echo "결과 확인:"
echo "psql \"${DB_URL}\" -X -q -c \"select organizer_email, organizer_role, organizer_workspace_user_id, status, subscription_name, expires_at, last_error from workspace_events_subscriptions;\""
echo "status가 'error'면 last_error를 그대로 기록하고, (1) Directory API resolve 단계 실패인지"
echo "(2) cloudidentity targetResource 형식 자체가 실제 API에서 거부되는지(이 경우 §1의 안내대로"
echo "canonical Meet space 단위로 전환이 필요할 수 있음 — 코드를 여기서 즉석 수정하지 말고 그 응답을"
echo "그대로 기록해 보고) 구분해서 보고."

echo "--- 6-4. 구독 갱신·삭제 실측(선택 — 구독 생성이 성공했을 때만) ---"
echo "관리자 화면 \"Workspace Events 구독 상태\" 섹션에서 \"만료 임박 구독 갱신 실행\" 클릭 후 결과 확인."
echo "정리 단계(§7)에서 삭제까지 실측한다 — 여기서 미리 삭제하지 않는다."

echo "--- 6-5. 합성 회의(최대 20분, Smart Notes 생성 확인 즉시 종료) ---"
echo "참가자: ${CONSULT_ORGANIZER_EMAIL} 또는 ${TEACHER_ORGANIZER_EMAIL} 및 ${TEST_ACCOUNT}만."
echo "추가 참가자 초대 금지. Smart Notes 생성이 확인되는 즉시 종료 — 최대 20분 절대 초과 금지."

echo "--- 6-6. Workspace Events 수신 확인(로컬은 공인 URL 없음 — pull 재현) ---"
echo "docs/2026-09-03-m1-google-sandbox-verification-request-v2.md §4를 따른다:"
echo "  (a) 기존 pull 구독(있다면)에서 메시지를 pull한 뒤 그 payload로"
echo "      curl -X POST http://localhost:3010/api/webhooks/workspace-events 를 수동 재현, 또는"
echo "  (b) 공인 URL을 가진 배포 환경에 동일 플래그를 임시로 걸어 실행."
echo "  둘 다 어려우면 이 단계에서 중단하고 보고 — 임의로 새 공인 엔드포인트를 만들지 않는다."

echo "--- 6-7. 자동 매칭 + drive_file_id 연결 확인 ---"
echo "psql \"${DB_URL}\" -X -q -c \"select smart_notes_drive_file_id, smart_notes_config_status from consultations where id='<CONSULT_ID>';\""
echo "psql \"${DB_URL}\" -X -q -c \"select id, consultation_id, session_id, drive_file_id, linked, pubsub_message_id from smart_notes_generation_events order by received_at desc limit 5;\""

echo "--- 6-8. ${TEST_ACCOUNT} 계정으로 Smart Notes 원본 접근 차단 실제 확인(중요) ---"
echo "${TEST_ACCOUNT}로 로그인해 방금 생성된 Calendar 이벤트를 열고:"
echo "  - Smart Notes 첨부 존재가 보이는지"
echo "  - 그 첨부를 클릭했을 때 실제로 원본 문서(Google Doc)에 접근되는지"
echo "접근이 실제로 된다면 여기서 즉시 중단하고 §STEP 7 정리만 실행한 뒤 정책 blocker로"
echo "보고한다(공유 범위를 넓히거나 코드로 우회하지 않는다)."

echo "--- 6-9. 관리자 검토 요약 작성 후 4조건 게이트 통과 확인 ---"
echo "관리자 화면 \"상담 결과 기록\" 인라인 폼 → 요약 입력 → outcome 선택 → 저장."
echo "4개 조건(동의/Smart Notes ON/원본 연결/요약 비공백)이 전부 충족된 뒤에만 성공해야 한다."

################################################################################
# STEP 7 — 정리(반드시 끝까지 실행, 성공/실패 무관)
################################################################################

echo "=== 정리 시작 — 검증 성공/실패와 무관하게 전부 실행 ==="

echo "--- 7-1. 생성한 Calendar 이벤트 2개(상담/수업) 삭제 ---"
echo "관리자 화면 \"취소\" 버튼 또는 실제 Google Calendar에서 직접 삭제 — 둘 다 실행해"
echo "ALTON DB와 Google 양쪽 모두에서 사라졌는지 확인."

echo "--- 7-2. Workspace Events 구독 삭제(최대 2개 — 상담 organizer 1 + 선생님 organizer 1) ---"
echo "psql \"${DB_URL}\" -X -q -c \"select organizer_email, subscription_name from workspace_events_subscriptions;\""
echo "관리자 화면 \"Workspace Events 구독 상태\" 섹션에 구독 삭제 UI가 없다면(현재 없음 —"
echo "disableSubscriptionForOrganizer()가 백엔드에는 있으나 admin 액션으로 아직 노출 안 됐을 수"
echo "있음, 코드 확인) Workspace Events API subscriptions.delete를 직접 호출해 삭제 후 DB도"
echo "정리한다."

echo "--- 7-2-1. STEP 0.5에서 만든 Pub/Sub push subscription 삭제 ---"
echo "  gcloud pubsub subscriptions delete m1-sandbox-workspace-events-push-v2 --project ${PROJECT_ID}"

echo "--- 7-2-2. STEP 0.5에서 만든 Pub/Sub 토픽 삭제 ---"
echo "  gcloud pubsub topics delete m1-sandbox-workspace-events-v2 --project ${PROJECT_ID}"

echo "--- 7-2-3. STEP 0.5-2에서 부여한 Publisher IAM binding 제거 ---"
echo "  (토픽 자체를 삭제하면 그 토픽에 걸린 IAM binding도 함께 사라진다 — 별도 제거 불필요,"
echo "  단 gcloud pubsub topics delete 실행 결과로 실제로 사라졌는지 재확인할 것.)"

echo "--- 7-3. 합성 Smart Notes Google Doc 삭제 ---"
echo "${CONSULT_ORGANIZER_EMAIL}/${TEACHER_ORGANIZER_EMAIL} 또는 회의 참가자 Drive에서 생성된 합성 문서를 직접 삭제."

echo "--- 7-4. 테스트 데이터 정리(로컬 DB 전용이므로 reset 한 번으로 충분) ---"
cd "${REPO_ROOT}" && npx supabase db reset --local

echo "--- 7-5. 임시 IAM binding 제거 ---"
gcloud iam service-accounts remove-iam-policy-binding "${SERVICE_ACCOUNT}" \
  --project "${PROJECT_ID}" \
  --role "roles/iam.workloadIdentityUser" \
  --member "principalSet://iam.googleapis.com/${WIF_POOL}/*" \
  --condition "expression=${WIF_PROVIDER_CONDITION},title=m1-sandbox-temp-v2,description=M1 Sandbox v2 통합 검증 임시 바인딩(검증 후 즉시 제거)"

echo "--- 7-6. IAM 정책 재조회로 Production만 남았는지 실제 확인 ---"
gcloud iam service-accounts get-iam-policy "${SERVICE_ACCOUNT}" \
  --project "${PROJECT_ID}" \
  --format json > /tmp/m1-sandbox-iam-policy-after.json
diff /tmp/m1-sandbox-iam-policy-before.json /tmp/m1-sandbox-iam-policy-after.json \
  && echo "정책이 검증 전과 동일함 — 임시 바인딩 완전히 제거 확인." \
  || echo "!!! 정책이 검증 전과 다릅니다 — m1-sandbox-temp-v2 바인딩이 실제로 지워졌는지 직접 재확인하세요 !!!"

echo "--- 7-7. 로컬 임시 파일 삭제 ---"
rm -f /tmp/m1-sandbox-iam-policy-before.json /tmp/m1-sandbox-iam-policy-after.json

echo "--- 7-8. 로컬 환경변수 원복 ---"
echo "STEP 2에서 export/.env.local에 추가한 값을 전부 제거하고 dev 서버를 재시작하세요."
echo "아래로 실제 false/미설정임을 확인:"
echo '  echo "CALENDAR_SYNC_ALLOW_REAL_CALLS=${CALENDAR_SYNC_ALLOW_REAL_CALLS:-<unset>}"'
echo '  grep -n "CALENDAR_SYNC_ALLOW_REAL_CALLS" .env.local || echo ".env.local에 없음(정상)"'
echo "SMTP_PASS 등 이메일 자격증명은 이 스크립트가 건드리지 않았으므로 별도 원복이 필요 없다 —"
echo "혹시 검증 중 수동으로 추가했다면 그것만 별도로 제거·확인하세요."

echo "=== 정리 완료 — docs/CURRENT.md/실행 로그에 실제 결과(성공/실패/발견된 버그/정리 확인)를 기록할 것 ==="

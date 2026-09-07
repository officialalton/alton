# Preview UAT 체크리스트 — 보호자 포털 자녀 추가 상담 신청(2026-09-06)

브랜치 `preview/m4-integration-verification`. 아래는 이번 라운드("보호자 포털 자녀 추가 상담 전용 화면")에 대한 제품 오너 실측 UAT용 체크리스트다. `docs/CURRENT.md`의 "2026-09-06 보호자 포털 자녀 추가 상담 신청" 절에 구현 상세가 있다.

## 사전 조건

- [ ] non-prod(Preview) 원격 DB에 마이그레이션 `20261207000000_m4_guardian_portal_consult_source_enum.sql`/`20261207010000_m4_guardian_portal_consult_request.sql`이 반영되어 있는가 — 이 세션은 자동 실행 정책으로 `db push`가 차단되어 **아직 반영되지 않았을 수 있다**. `npx supabase migration list --linked`로 두 마이그레이션의 `remote` 값이 채워져 있는지 먼저 확인할 것.
- [ ] Preview alias(`https://alton-git-preview-m4-integration-verification-alton7.vercel.app`)가 이번 커밋을 서빙하는지 확인(Vercel Deployment Protection SSO 로그인 필요, 기존 known limitation).

## 1. 보호자 포털 — 새 자녀 상담 신청 화면

- [ ] 보호자로 로그인 → 포털 좌측 네비게이션에 `자녀상담` 탭이 보이는가.
- [ ] `가족` 탭 진입 시 "새 자녀 상담 신청하러 가기 →" 버튼이 보이고, 기존 "자녀 추가 초대" 입력폼/버튼은 흐리게 비활성화되어 클릭이 안 되는가.
- [ ] `가족` 탭의 진입 버튼을 누르면 `자녀상담` 탭으로 바로 이동하는가.
- [ ] `자녀상담` 탭에서 자녀 정보(이름/학년/관심과목/상담내용) 입력 행이 기본 1개 보이는가.
- [ ] `+ 자녀 추가` 버튼으로 자녀를 3명까지 추가할 수 있는가, 2번째 이상 행에 `삭제` 버튼이 보이고 정상 동작하는가(1개 남으면 삭제 버튼 자체가 사라짐).
- [ ] 상담 희망 시간 선택 UI가 랜딩과 동일하게 월간 캘린더 + 날짜별 배지 + 시간 버튼 목록인가(드롭다운이 아님).
- [ ] 보호자 본인 이름/이메일을 다시 입력하라는 필드가 화면에 없는가(세션에서 자동 사용).
- [ ] 자녀 1명만 입력하고 시간을 선택해 제출 → "상담 신청이 접수되었습니다" 안내가 보이는가.
- [ ] 자녀 3명을 입력하고 시간을 선택해 제출 → 정상 접수되는가.
- [ ] 시간을 선택하지 않고 제출 시 "상담 희망 시간을 선택해주세요." 에러가 뜨고 제출되지 않는가.
- [ ] 자녀 이름을 비워두고 제출 시 에러가 뜨고 제출되지 않는가.

## 2. 신청 이력

- [ ] `자녀상담` 탭 하단 "신청 이력"에 방금 신청한 건이 "승인 대기" 상태로 보이는가.
- [ ] 관리자가 칸반에서 해당 카드를 수락(확정)하면, 보호자 화면 이력이 "상담 확정"으로 바뀌고 일시가 표시되는가, Google Meet 링크가 있으면 링크가 보이는가.
- [ ] 관리자가 상담을 취소/거절하면 이력에 "취소/거절"과 사유가 표시되는가.
- [ ] 관리자가 상담 종료(결과 기록)를 하면 이력에 "완료"와 `admin_review_summary`(고객 공개 요약)만 보이고, 내부 관리자 메모나 Smart Notes 원본은 어디에도 노출되지 않는가.

## 3. 관리자 칸반 노출/구분

- [ ] 관리자 "상담 현황" 칸반에서 보호자 포털에서 신청한 카드에 "보호자 포털" 배지가 보이는가(랜딩 신청 카드에는 이 배지가 없어야 함).
- [ ] 그 카드에 "자녀 N명: 이름, 이름" 요약이 보이는가(자녀 3명 신청 시 3명 전부).
- [ ] 별도의 보드가 아니라 기존 단일 "상담 현황" 칸반 안에서 랜딩 신청과 나란히 보이는가.

## 4. 계정 생성 미실행 확인(중요)

- [ ] 보호자 포털에서 상담을 신청한 시점에는 신규 자녀 계정이나 초대 이메일이 전혀 발송되지 않는가(관리자가 별도로 온보딩 발송 버튼을 눌러야만 계정 초대가 나가는 기존 흐름 그대로 유지되는지 확인).

## 5. R11(기존 자녀 문의) — 이번 라운드부터 실구현됨

- [ ] `자녀상담` 화면 안내 문구가 "기존 자녀 문의는 `문의` 탭에서 남겨주세요"로 바뀌어 있는가(예전 "R11에서 지원 예정" 문구가 아님).
- [ ] 보호자 포털 좌측 네비게이션에 `문의` 탭이 새로 보이는가.

---

## 6. (신규) 관리자 온보딩 발송 "관리자만 온보딩 링크를 발급할 수 있습니다" 버그 수정 확인

- [ ] 관리자로 로그인한 상태에서 상담 칸반 카드 상세("다음 단계 — 체험 온보딩" 섹션)를 열고 "체험 온보딩 안내 발송"을 눌렀을 때, 더 이상 "발송 실패(관리자 조치 필요) — 관리자만 온보딩 링크를 발급할 수 있습니다."가 뜨지 않는가(정상 발송되는가).
- [ ] `TrialOnboardingPanel.tsx` 진입점에서도 동일하게 정상 발송되는가.

## 7. (신규) 관리자 상담 가용시간 월간 뷰

- [ ] `상담` → `상담 운영` → "공용 상담 가능시간" 섹션 상단에 "월간 실제 오픈 슬롯" 캘린더가 보이는가.
- [ ] 날짜에 슬롯 개수 배지가 보이고, 날짜를 클릭하면 그날의 시간 목록(또는 "열린 슬롯이 없습니다")이 아래에 보이는가.
- [ ] 기존 "반복 주간 가능시간"/"날짜별 예외" 목록·CRUD는 그대로 동작하는가(회귀 없음).

## 8. (신규) R11 문의·면담 실구현

- [ ] 보호자 포털 `문의` 탭에서 메시지를 작성해 전송하면 즉시 목록에 보이는가.
- [ ] `+ 면담 요청`으로 대상 자녀(선택)·주제(선택)·희망 시간(60분, 캘린더+버튼)을 골라 신청하면 "일정 조율 대기" 상태로 이력에 보이는가.
- [ ] 관리자 `문의·면담` 탭 → `문의함`에서 위 문의가 보이고, 답장을 보내면 보호자 화면에도 즉시 반영되는가. "해결됨으로 표시"를 누르면 미해결 표시가 사라지는가.
- [ ] 관리자 `문의·면담` 탭 → `면담 운영`에서 위 면담 요청이 보이고, "확정 처리"/"완료 처리"/"취소" 버튼으로 상태를 바꿀 수 있는가.
- [ ] 관리자 `면담 운영` 화면에서 면담 전용 반복 가능시간/휴무 예외를 등록할 수 있고, 이 값이 보호자 포털 면담 요청 화면의 캘린더에 반영되는가(상담 가용시간과는 별개 값).
- [ ] 기존 자녀 면담을 신청·확정해도 관리자 "상담 현황" 칸반이나 가입·체험·정규 전환 파이프라인에 새 카드가 생기지 않는가(별도 테이블 `meeting_requests`이므로 자연히 그래야 함).

## 9. (신규, 2026-09-06 2차) 온보딩 링크 redeem 실제 버그 수정 + 관리자 액션 토스트 + 발송 상태 조회

- [ ] 관리자로 "체험 온보딩 안내 발송"에서 보호자 이메일 앞뒤에 공백을 넣어(예: 복사·붙여넣기) 발송해도, 보호자가 링크를 열었을 때 "보호자 계정 생성에 실패했습니다"가 뜨지 않고 정상적으로 계정이 생성되어 `/set-password`로 이동하는가.
- [ ] 상담 칸반 카드 상세의 "다음 단계 — 체험 온보딩" 영역에서 "발송 내역 보기"를 누르면 보호자 이름/이메일, 발송 시각, 링크 상태(발송됨/보호자 확인 대기/완료), 학생별 이름/이메일/학년/과목/계정생성상태가 보이는가.
- [ ] 학생 계정 생성이 실패한 항목에 "재시도" 버튼이 보이고, 누르면 성공/실패가 토스트로 표시되며 목록이 새로고침되는가.
- [ ] `상담` → `상담 운영`에서 "Calendar 재처리 실행"/"Smart Notes 미매칭 재처리"/"만료 임박 구독 갱신 실행"/"Smart Notes 사후 대조 실행"을 눌렀을 때 화면 우하단에 성공/실패 토스트가 몇 초간 명확히 보이는가(실패 시 원인도 함께).
- [ ] "체험 온보딩 안내 발송" 버튼도 발송 성공/실패가 토스트로 보이는가.

## 자동 검증 결과(참고, 2026-09-06 세션)

- `supabase db reset --local` 성공(신규 마이그레이션 3건: `20261208000000_m4_multi_onboarding_link_auth_fix.sql`, `20261209000000_r11_inquiry_and_meeting_requests.sql` — 첫 번째는 실제 버그 수정, 두 번째는 R11 신규 테이블/RPC).
- `npx tsc --noEmit` 클린.
- `npx vitest run` — 182파일/1203건 중 1개 파일 제외 전부 통과(신규 40여 건 포함). 실패했던 4개 파일(`supabase/lesson-reviews.integration.test.ts`, `app/admin/consultation-outcome-smart-notes-gate.integration.test.ts`, `lib/booking/session-final-judgment.integration.test.ts`, `lib/booking/trial-entitlement-and-cancellation.integration.test.ts`)은 전체 병렬 실행 시에만 실패하고 개별 실행 시 42건 전부 통과 — 기존에 문서화된 테스트 격리 이슈이며 이번 변경과 무관.
- `npx next build` 성공.
- **non-prod DB push는 세션 자동 실행 정책으로 차단될 수 있음** — `docs/CURRENT.md` 최신 절 참고.

### 2026-09-06 2차 세션 추가 검증

- 이번 라운드는 DB 스키마 변경 없음(순수 앱 레이어) — `supabase db reset --local` 성공(기존 마이그레이션만 재적용).
- `npx tsc --noEmit` 클린.
- `npx vitest run` — 183파일/1209건 전부 통과.
- `npx next build` 성공.
- 근본 원인은 node 스크립트로 로컬 GoTrue에 직접 `admin.auth.admin.createUser({ email: " foo@example.com " })`를 호출해 `Unable to validate email address: invalid format`(400) 응답을 실측 재현해 확정했다(`app/admin/trial-onboarding-actions.ts`의 `guardianEmail` trim 누락).

### 2026-09-06 3차 세션 — matchbox512@snu.ac.kr 상담건(재발급해도 계속 실패) 실측·수정

- [x] non-prod(`worpsqwqgnspddnrtnvq`)에 psql(`supabase db query --linked`)로 직접 조회해 근본 원인 확정: trim 수정 이후에도 저장된 `guardian_email`은 이미 깨끗했다 — 진짜 원인은 계정 병합(`anonymizeMergedAccount()`)이 Auth 계정을 지울 때 `auth.identities`를 정리하지 않아 좀비 이메일이 남고, 그 이메일로는 재발급을 몇 번 해도 `admin.auth.admin.createUser()`가 영원히 실패하는 것이었다.
- [x] `supabase/migrations/20261210000000_m4_cleanup_orphaned_auth_identities.sql` 추가 — `cleanup_orphaned_auth_identities()`, 계정 생성 직전 항상 호출하도록 `lib/trial-onboarding-finalize.ts`/`app/admin/trial-onboarding-actions.ts` 수정.
- [x] "중복 발행" 차단은 의도된 방어였으나 관리자가 우회할 수단이 없었던 문제 — `reissueTrialOnboardingLinkAction` + `forceReissue` + `TrialOnboardingLinkProgress.tsx`의 "링크 폐기하고 재발급" 버튼 추가.
- [x] 재현 테스트 `supabase/cleanup-orphaned-auth-identities.integration.test.ts` 3건 통과(좀비 시뮬레이션 → 정리 전/후 확인 → 정상 계정 불변 확인).
- [x] `supabase db reset --local` 성공, `npx tsc --noEmit` 클린, `npx vitest run` 184파일/1212건 전부 통과, `npx next build` 성공.
- [x] non-prod에 마이그레이션 반영(`migration list --linked` local=remote 확인) 후, 실제 좀비 `auth.identities` 2건(`matchbox512@snu.ac.kr`, `matchbox512@gmail.com`)을 `cleanup_orphaned_auth_identities()`로 삭제 완료 — 삭제 전/후 SELECT로 0건 확인. 이 상담건의 미redeem 링크(`9a597dfd-cbbe-493a-a113-918af0147eb1`)는 이제 정상적으로 redeem 가능한 상태.
- [ ] 브라우저로 실제 이 링크를 열어 계정 생성까지 end-to-end로 확인하는 것은 이번 세션 범위 밖(실제 고객 이메일 발송 없이 실제 브라우저 클릭까지는 확인하지 않음) — 다음 세션에서 필요 시 Preview에서 직접 확인 권장.

### 2026-09-06 4차 세션 — 골든패스 실사용 7건(온세장/세온장/세장온 가족, matchbox512@snu.ac.kr) 실측·수정

- [x] **#1 체험수업권 미지급**: non-prod psql로 세온장(`6fd6e34a-8485-437e-b7f8-ca5a8811b435`)/세장온(`9c740401-2a36-4f5e-98e1-9df0ef1e4807`) 확인 — 카드는 있으나 `trial_entitlement_grant_status='not_applicable'`, `entitlement_grants` 0건. `_create_student_kanban_card()`가 지급 시도 자체를 안 했던 것이 원인. `20261211000000_m4_multichild_trial_entitlement_grant_fix.sql`로 수정 + 백필. 회귀 테스트 2건(`app/consult/multichild-trial-onboarding.integration.test.ts`) 추가·통과.
- [x] **#2 배정됐는데 예약 불가**: `app/student/lesson-booking-data.ts`의 `hasTrialGrant` 조건이 원인 — #1과 동일 근본원인, #1 수정 후 두 학생 모두 `bookableEnrollments` 조건 충족 확인(코드 변경 없음, 데이터 문제).
- [x] **#3 원 상담 카드 시각 구분**: `is_family_root_with_children` 플래그 추가, 흐림 처리 + "완료(이력)" 배지(`app/admin/ConsultationKanbanBoard.tsx`, `consultation-kanban-actions.ts`). 카드는 그대로 유지(삭제·이동 없음).
- [x] **#4 선생님 배정 확인 절차**: `SubjectEnrollmentPanel.tsx`의 최초 배정 버튼에 `window.confirm()` 확인 단계 추가.
- [x] **#5 선생님 가용시간 부분 시간대 조정**: `docs/CURRENT.md`의 "2026-09-06(6차)" 절 참고 — DB 스키마·`is_teacher_slot_open()`/`computeAvailableSlots()`는 R6부터 이미 부분 시간 예외를 지원했고(마이그레이션 불필요), 실제로 빠졌던 선생님 포털 UI(월간 캘린더 오픈 배지 + 일간 타임라인 + 부분 휴무/임시오픈 등록 폼)만 `app/teacher/TeacherAvailabilityTab.tsx`에 추가. 신규 통합 테스트로 부분 휴무가 `is_teacher_slot_open()`에서 실제로 그 시간대만 제외함을 확인.
- [x] **#6 학생 비번 설정 후 승인 게이트**: 코드 확인 결과 이미 자동 진행(승인 버튼 자체가 없음, `activateStudentIfPending()`이 배정 완료 시 자동 전환) — 논프로드 실측으로 두 학생 모두 `status='active'` 확인. `app/account-pending/page.tsx` 오해 소지 있는 문구만 수정.
- [x] **#7 링크 재발급 시 이메일 수정**: `reissueTrialOnboardingLinkAction()`에 `overrides` 인자 추가, `TrialOnboardingLinkProgress.tsx`에 재발급 전 이메일 수정 폼 추가.
- [x] `supabase db reset --local` 성공 / `npx tsc --noEmit` 0 에러 / `npx vitest run` 184파일·1214건 통과 / `npx next build` 성공.
- [x] non-prod에 `20261211000000` push(`migration list --linked` local=remote 확인) 후, 세온장/세장온 두 학생 모두 관리자 DOB 확인·Smart Notes 동의(관리자/보호자 액션과 동등한 SQL)를 거쳐 재처리 버튼과 동일한 `grant_trial_entitlement_for_consultation()` 호출로 `entitlement_grants` 각 1건 지급 완료·`trial_entitlement_grant_status='granted'` 확인.
- [ ] 브라우저로 실제 학생 포털에 로그인해 "수업권" 탭·예약 화면을 눈으로 확인하는 것은 이번 세션 범위 밖(DB 조회로 조건 충족만 검증) — 다음 세션에서 Preview로 직접 확인 권장.

### 2026-09-06 5차 세션 — 시간대 설정 UI 지적사항(미국 전역 시간대 목록 확장)

- [x] 조사: `app/components/TimezoneSettingsModal.tsx` + `lib/timezone-actions.ts`가 이미 4개 포털(학생/학부모/관리자/선생님) 공용으로 존재하고, 실제 선택된 IANA 값을 `<select value>`로 표시하며(라벨만 표시 아님), `profiles.timezone`/`households.default_timezone`에 영구 저장(세션 아님)됨을 확인 — 지적사항 1/2/4는 이미 구현돼 있었음(`8b3bf26` R6 커밋).
- [x] 지적사항 3(미국 전역 시간대)만 실제로 빠져 있었음 — `lib/timezone.ts`의 `TIMEZONE_OPTIONS`에 `America/Phoenix`(산악, DST 없음)·`America/Anchorage`(알래스카)·`Pacific/Honolulu`(하와이) 추가, 기존 라벨에 동부/중부/산악/태평양 구분 병기.
- [x] 회귀 테스트: `lib/timezone.test.ts`에 미국 시간대 전체 포함 여부 + IANA 값 유효성 검증 추가. `lib/timezone-persistence.integration.test.ts`(신규, psql 직접 접속) 5건 — 개인 시간대 저장 후 재조회(=다음 로그인) 유지, 확장된 시간대(알래스카/하와이/피닉스) 저장·유지, 타인 프로필 RLS 차단, 주 보호자 RPC로 가족 기본값 영구 저장, 비주보호자 거부(fail-closed).
- [x] `supabase db reset --local` 성공(추가 마이그레이션 없음, 기존 컬럼 재사용) / `npx tsc --noEmit` 0 에러 / `npx vitest run` 185파일·1228건 통과 / `npx next build` 성공.
- [ ] 브라우저로 실제 각 포털의 "시간대 설정" 모달을 열어 확장된 7개 미국 시간대가 드롭다운에 보이는지, 선택 후 새로고침해도 유지되는지 눈으로 확인하는 것은 이번 세션 범위 밖 — Preview에서 직접 확인 권장(계정 드롭다운 → "시간대 설정").

### 2026-09-06 6차 세션 — 골든패스 #5(선생님 가용시간 부분 시간대 조정) 완료 — 7건 전부 완료

- [x] 조사 결과 DB 스키마(`teacher_availability_exceptions.start_time_local`/`end_time_local`)와 `is_teacher_slot_open()`(DB 함수, 최종 예약 확정 판정) + `computeAvailableSlots()`(`lib/booking/slot-search.ts`, 학생/보호자 예약 슬롯 후보 계산)가 R6(`20260926000000_r6_availability_and_booking.sql`)부터 이미 부분 시간 예외를 완전히 지원하고 있었다 — 마이그레이션 불필요.
- [x] 실제로 빠졌던 건 선생님 포털 UI뿐 — `app/teacher/TeacherAvailabilityTab.tsx`에 (1) 월간 캘린더 배지를 "예외 있음(회색/빨강)" vs "반복 규칙으로 오픈(초록, 신규)"으로 구분, (2) 날짜 선택 시 "이 날짜의 실제 오픈 시간(반복 규칙+예외 반영)" 타임라인, (3) 시작/종료 시간 입력으로 "이 시간대만 휴무로/임시 오픈으로" 등록하는 폼과 등록된 부분 예외 개별 삭제 추가.
- [x] 신규 순수 함수 `computeOpenWindowsForDate()`(`lib/booking/slot-search.ts`)·`dayOfWeekForDateKey()`(`lib/calendar-date-utils.ts`) 추가, 단위 테스트 10건.
- [x] 신규 통합 테스트 `lib/booking/teacher-partial-time-exception.integration.test.ts`(psql 직접 접속, 2건) — 부분 휴무 등록 전 반복 규칙 시간대 전체 오픈 확인 → 특정 날짜 12:00~13:00만 부분 휴무 등록 → 그 시간대만 `is_teacher_slot_open()`이 false, 전후 시간대·다른 주 같은 요일은 여전히 true임을 실제 DB 함수 호출로 확인.
- [x] `supabase db reset --local` 성공(신규 마이그레이션 없음) / `npx tsc --noEmit` 0 에러 / `npx vitest run` 186파일·1243건 전부 통과(신규 15건 포함) / `npx next build` 성공.
- [x] non-prod DB push 불필요(스키마 변경 없음, 코드만 배포되면 즉시 반영).
- [ ] 브라우저로 실제 선생님 포털에서 월간 캘린더 배지·일간 타임라인·부분 휴무 등록 폼을 눈으로 확인하고, 학생 포털에서 그 시간대가 실제로 예약 불가로 보이는지 확인하는 것은 이번 세션 범위 밖 — Preview에서 직접 확인 권장.

**이 항목 완료로 2026-09-06(4차) 세션에서 발견된 골든패스 실사용 7건(#1~#7)이 전부 완료됐다.**

### 2026-09-06 7차 세션 — 시간대 설정 모달 드롭다운 초기 선택값 재지적(5차 세션 보고가 틀렸음)

- 제품 오너가 Preview에서 모달을 직접 열어본 스크린샷으로 재지적: 5차 세션에서 "지적사항 1/2/4는 이미 실제 선택값을 보여주고 있다"고 보고했으나, 실제로는 개인 시간대 미설정 상태에서 드롭다운에 여전히 추상적인 "✓ 가족 기본값 사용" 옵션이 선택된 채로 노출되고 있었음 — 5차 세션 보고가 코드를 잘못 읽었던 오판이었다.
- [x] `app/components/TimezoneSettingsModal.tsx` 재확인: `personal` state가 미설정 시 `""`(sentinel)로 남고 `<option value="">가족 기본값 사용</option>`이 그대로 selected 되고 있었음을 코드로 확인.
- [x] 수정: `personal`을 항상 실제 IANA 값(`profileTimezone ?? 가족 기본값 ?? America/Los_Angeles`)으로만 채우고, 드롭다운 옵션에서 "가족 기본값 사용" 항목 자체를 제거(`TIMEZONE_OPTIONS`만 렌더링). 개인 시간대를 명시적으로 고정했는지는 별도 `hasOverride` state로 추적 — 드롭다운을 바꾸면 자동으로 override 상태가 되고, 별도의 명시적 "개인 설정 해제 (가족 기본값 따르기)" 버튼(override 상태일 때만 노출)을 눌러야만 다시 가족 기본값을 따르는 상태로 복귀. 저장 로직은 override 여부에 따라 `null`/실제값을 분기 저장하도록 유지.
- [x] 검증: `supabase db reset --local` 성공 / `npx tsc --noEmit` 0 에러 / `npx next build` 성공 / `npx vitest run` 185/186 파일·1242/1243건 통과 — 유일한 실패(`lib/timezone-persistence.integration.test.ts`)는 단독 실행 시 5/5 통과함을 확인(전체 스위트 병렬 실행 시 로컬 DB 공유로 인한 기존 격리 이슈, 이번 변경과 무관).
- [ ] 브라우저로 Preview에서 실제로 모달을 열어 드롭다운 초기 선택값이 구체적 시간대명(도시명+IANA)으로 보이는지, "개인 설정 해제" 버튼이 의도대로 동작하는지 눈으로 확인하는 것은 이번 세션 범위 밖 — Preview alias 갱신 후 직접 확인 권장.

### 2026-09-06 8차 세션 — 학생/선생님 포털 심층 UAT 8건(#1~#8)

제품 오너가 학생 포털·선생님 포털을 더 깊이 써보며 발견한 8건. `docs/CURRENT.md`의 "2026-09-06(8차)" 절에 조사 근거·구현 상세가 있다.

- [x] **#1 버그(최우선)** — 학생 포털 "선생님" 탭 "매칭된 선생님이 없습니다". 근본 원인: `app/student/teacher-data.ts`가 legacy `enrollments`/`teachers` 테이블(정규 전환 후에만 채워짐)만 조회했고, 체험 수업만 있는 학생은 `subject_enrollments`+`teacher_assignments`(v3, R1/R5) 행만 있어 항상 빈 배열이었다. v3 스키마 기준으로 재작성.
- [x] **#2 버그** — 선생님 포털 "학생" 탭 "담당 중인 학생이 없습니다". 동일 근본 원인의 대칭 문제 + RLS 갭: `teaches_student()` DB 함수와 `teachers` 테이블 SELECT 정책이 legacy `enrollments`만 확인하고 있었다(반면 `profiles`/`subject_enrollments`/`teacher_assignments` 정책은 이미 v3 인지). 마이그레이션 `20261212000000_m4_teacher_student_v3_visibility_fix.sql`로 두 곳 모두 v3 배정 경로를 OR 조건으로 추가(additive, 기존 접근 축소 없음). psql로 `set role authenticated` + `request.jwt.claims`를 이용해 실제 RLS 통과를 재현 확인함(#1/#2 양방향).
- [x] **#3 버그** — 선생님 포털 "수업 일정"의 "금주 목록"에 표시 범위 밖(9/16) 수업이 나타남. #4 요구사항으로 그대로 대체해 해결(아래).
- [x] **#4 UX** — "금주 목록" → "예정 수업 목록"으로 개명, 이번 주 제한 없이 오늘 이후 예정된 모든 수업을 표시하도록 `TeacherLessonScheduleTab.tsx`의 `visibleLessons` 필터 로직 변경(주간/월간 뷰는 그대로 유지).
- [x] **#5 UX 통합** — 선생님 포털 "수업"(레거시 `legacy_sessions` 기반)과 "수업 일정"(v3 `sessions`/`reservations`) 탭을 하나의 "수업" 네비게이션 항목으로 통합. v3 예약/캘린더 UI를 기본 서브탭으로, 레거시 뷰 고유 기능(수업 기록, 지각·노쇼 신고, 레거시 리뷰)은 "지난 수업 기록·신고" 서브탭으로 흡수(`TeacherShell.tsx`).
- [x] **#6 UX 통합** — 선생님 포털 "학생"(RosterTab, legacy `enrollments` 기반) 탭 제거, "배정" 탭(`AssignmentsTab.tsx`/`assignments-data.ts`, 원래 v3 기준)으로 통합 — 학년·연락처 표시 추가.
- [x] **#7 버그** — "배정" 탭에 학생 프로필 진입 링크가 아예 없었음(막혀있던 게 아니라 미구현). "학생 프로필 보기" 펼침(이름/학년/과목/연락처)과 "커리큘럼 보기" 버튼(커리큘럼 탭의 해당 학생 뷰로 이동) 추가.
- [ ] **#8 설계 정리(구현 보류)** — 커리큘럼-배정 연동. 조사 결과 `teacher_assignments`에 이미 `curriculum_handoff_status`(`not_applicable`/`pending`/`done`) 컬럼과 승계 시 자동으로 `pending`을 세팅하는 트리거(`mark_curriculum_handoff_pending_if_succession`)가 존재하지만, 실제 커리큘럼 템플릿(`teacher_curriculum_templates`)을 가리키는 컬럼은 없다. 최소 개발 범위 제안: `teacher_assignments`에 nullable `curriculum_template_id` 컬럼 additive로 추가하고, 배정 생성 시(신규 배정) 해당 과목의 선생님 커리큘럼 템플릿을 조회해 채우며, 체험→정규 승계 시(`change_teacher_assignment()` 계열) 이 값을 새 배정 행에도 복사하는 정도로 그친다(진도 상태 이관 로직은 범위 밖). 시간 배분상 이번 세션은 설계만 기록하고 구현은 다음 라운드로 미룸.
- [x] 검증: `supabase db reset --local` 성공(신규 마이그레이션 1건 포함) / `npx tsc --noEmit` 0 에러 / `npx vitest run` 187파일·1243건 전부 통과(신규 3건 포함: `app/student/teacher-data.test.ts`, `app/teacher/assignments-data.test.ts`, `TeacherLessonScheduleTab.test.tsx`의 다음 주 수업 노출 회귀 테스트) / `npx next build` 성공.
- [x] psql로 실제 로컬 DB에 "세온장/Teacher test1"과 동일한 구조(legacy `enrollments` 없이 `subject_enrollments`+`teacher_assignments`만 존재하는 체험 수업 배정)를 재현해 RLS 통과 여부를 실측 확인함(위 #2 항목 참고).
- [ ] 브라우저로 실제 non-prod Preview 환경에서 이 특정 학생(세온장)의 "선생님" 탭과 선생님(Teacher test1)의 "학생 없어진 자리(배정 탭)"을 직접 확인하는 것은 이번 세션 범위 밖 — non-prod DB에 마이그레이션 반영 후 Preview alias 갱신하여 직접 확인 권장.

### 2026-09-06 9차 세션 — "수업 종료" #441 마스킹 버그 수정 + "수업 시작" Meet 자동 입장 추가

제품 오너가 선생님 포털 "수업" 탭 카드를 클릭해보며 발견한 2건. `docs/CURRENT.md`의 "2026-09-06 선생님 포털 '수업' 탭 '수업 종료' #441 마스킹 버그 수정" 절에 상세 근거가 있다.

- [x] **#1 버그** — "수업 종료(완료)" 버튼을 누르면 "Minified React error #441"이 그대로 렌더링. 원인: `app/teacher/lesson-schedule-actions.ts`의 `startMyLessonSession`/`finalizeMyLessonSession`/`resolveMyLessonLateness`/`cancelMyLessonScheduleBooking`이 검증 실패·RPC 에러를 전부 throw했고, Next.js가 production에서 Server Action의 미처리 예외를 이 문구로 마스킹함(`app/admin/trial-onboarding-actions.ts`의 앞선 수정, `e1ea9f2`와 동일 패턴). 로컬 psql로 두 시나리오 모두 실제 재현: (a) `mark_lesson_session_started()` 없이 `scheduled` 상태에서 바로 `finalize_lesson_session(..., 'completed', ...)` 호출 → "수업이 아직 시작되지 않았습니다..." SQL 예외, (b) 시작 후 예약 종료 시각 전에 `completed` 호출 → "조기 종료 사유가 필요합니다..." SQL 예외. 특히 `TeacherLessonScheduleTab.tsx`는 (b) 메시지를 문자열로 매칭해 확인 다이얼로그를 띄우는 로직이 있었는데, production에서는 그 메시지 자체가 마스킹되어 이 분기가 전혀 동작할 수 없었다. 네 함수 모두 `ActionResult`(`{ ok: true } | { ok: false; error }`)를 반환하도록 변경(예외 전파 없음), 컴포넌트 핸들러를 result 체크 기반으로 재작성.
- [x] **#2 기능 누락** — "수업 시작"을 눌러도 Meet로 자동 입장하지 않음(옆의 "Meet 입장" 링크는 별도 존재). `handleStartSession`에서 클릭 즉시 동기적으로 빈 탭을 열어두고(팝업 차단 회피), `startMyLessonSession()` 성공 시 그 탭의 `location.href`를 `lesson.googleMeetLink`로 이동(실패 시 빈 탭은 닫음). 학생 포털(`app/student/LessonsTab.tsx`)의 "수업 입장"은 내부 `/session/[id]` 라우팅 방식이라 이 서버 액션+Meet 링크 조합 패턴과 구조가 달라 변경 대상에서 제외.
- [x] 검증: `supabase status`로 로컬 DB 포트(54422) 확인 후 `supabase db reset --local` 성공(신규 마이그레이션 없음) / psql로 두 실패 시나리오 실측 재현(수정 전) / `npx tsc --noEmit` 0 에러 / `npx vitest run app/teacher/TeacherLessonScheduleTab.test.tsx` 19건(신규 3건 포함) 통과 / `npx vitest run`(전체) 187파일·1246건 전부 통과 / `npx next build` 성공.
- [ ] 브라우저로 실제 Preview에서 "수업 시작" 클릭 시 새 탭이 실제로 Meet 화면으로 이동하는지(팝업 차단 설정에 따라 다를 수 있음), "수업 종료" 클릭 시 마스킹 없이 실제 한국어 에러 메시지가 보이는지 눈으로 확인하는 것은 이번 세션 범위 밖 — Preview alias 갱신 후 직접 확인 권장.

### 2026-09-06 10차 세션 — "A안" UI 정리(선생님 "수업"/"배정" 탭, 학생 "레슨"+"예약" 병합) — 스키마 변경 없음

제품 오너가 "A안"(UI 정리만, 스키마 변경·큰 기능 추가 없음)을 승인. **"B안"(학생 전용 프로필 페이지 신설, 세션뷰·커리큘럼 연동)은 R9 범위로 이번엔 명시적으로 보류됐고, 별도 R9 라운드 승인이 필요하다.** 상세 근거는 `docs/CURRENT.md`의 "2026-09-06(A안 UI 정리)" 절 참고.

- [x] **선생님 포털 "수업" 탭** — "예정/지난 수업"(v3)/"지난 수업 기록·신고"(레거시) 두 서브탭이 여전히 겹친다는 지적에 따라, `TeacherLessonScheduleTab.tsx`에 `mode`/`onReportSessionIssue` prop을 추가해 레거시 지각·노쇼 신고 기능을 v3 "지난 수업" 카드 안으로 흡수. `TeacherShell.tsx`는 이제 딱 "예정 수업"/"지난 수업" 두 서브탭만 렌더링.
- [x] **선생님 포털 "배정" 탭** — "배정 종료 요청" 버튼을 `AssignmentsTab.tsx` 카드 우측 하단의 작은 밑줄 텍스트로 이동(실수 클릭 방지).
- [x] **학생 포털 "레슨"+"예약" 병합** — `ClassesTab.tsx`(신규 래퍼)로 nav 항목을 "수업" 하나로 합침. v3(`LessonBookingTab.tsx`, `mode` prop 추가)가 주 콘텐츠, 레거시(`LessonsTab.tsx`, `forcedSubtab`/`hideHeader` prop 추가)는 접힌 "커리큘럼 진행·리뷰" 섹션으로 흡수 — 두 테이블(`legacy_sessions` vs `sessions`)이 달라 행 단위로는 합치지 않음(스키마 변경 없음).
- [x] **예정/지난 서브탭 버그 재현·수정** — `LessonsTab.tsx` 단독 테스트로는 재현 실패 안 났으나(자체 로직은 정상), 병합 후 outer subtab과 v3/레거시 두 섹션이 어긋날 위험을 `ClassesTab.test.tsx`에서 "지난 수업 클릭 시 두 섹션 모두 실제로 바뀌는지" 테스트로 고정.
- [x] **학생 포털 "예정 수업" 버튼 2개** — "수업 준비"(`/session/[id]`로 이동, 기존 라우트 재사용) / "수업 시작"(선생님 포털과 동일 패턴 — 클릭 시 동기적으로 빈 탭을 열고 Meet 링크로 이동).
- [x] **학생 포털 "지난 수업" 링크** — "수업 준비 내역"(`/session/[id]`)만 추가. "세션뷰 스냅샷"은 레거시 세션 기반이라 개념 자체가 없어(스키마 없음) 만들지 않고 항목을 뺐다. 리뷰는 레거시 섹션에서 그대로 열람 가능.
- [x] 검증: `supabase db reset --local` 성공(신규 마이그레이션 없음) / `npx tsc --noEmit` 0 에러 / `npx vitest run`(전체) 188파일·1253건 전부 통과 / `npx next build` 성공.
- [ ] 브라우저로 실제 Preview에서 학생 포털 "수업" 탭의 서브탭 전환·"수업 준비"/"수업 시작" 버튼·"지난 수업" 링크가 눈으로 정상 동작하는지 확인하는 것은 이번 세션 범위 밖 — Preview alias 갱신 후 직접 확인 권장.

### 2026-09-06 11차 세션 — "수업" 탭 실사용 지적 2건(레이아웃 버그, 학생/선생님 예정·지난 판정 불일치)

제품 오너가 10차(A안) "수업" 탭 병합을 실제로 써보고 발견한 2건. `docs/CURRENT.md`의 "2026-09-06(A안 UI 정리, 실사용 지적 2건 후속)" 절에 상세 근거가 있다.

- [x] **#1 레이아웃 버그** — "예정 수업" 서브탭에서 이미 체험 수업이 확정 예약돼 있는데도 위쪽에 "과목·선생님 선택" 드롭다운·"체험 수업은 1회만 예약할 수 있습니다" 안내·"예약 가능 시간을 불러오는 중…" 문구가 계속 남고 그 아래 큰 빈 여백 뒤에야 "예정된 수업" 목록이 나옴. `LessonBookingTab.tsx`에 `showBookingForm` 토글(예정 수업이 없으면 기본 펼침, 있으면 기본 접힘 — "+ 새 수업 예약하기"로 펼침)을 추가하고, 선택된 과목이 체험이고 이미 그 과목·선생님으로 예정 수업이 있으면(`hasExistingTrialBooking`) 폼 전체를 안내 문구로 대체·슬롯 재조회 자체를 생략(고착된 "불러오는 중…" 해소).
- [x] **#2 버그/정책** — 선생님이 "수업 종료"로 조기 완료 처리해도, 학생 포털은 순수 `startsAt > now`만 봐서 예약 시작 시각이 안 지났으면 계속 "예정 수업"에 남아있었다. `app/student/lesson-booking-data.ts`를 선생님 포털(`TeacherLessonScheduleTab.isPastLesson()`)과 동일한 규칙으로 통일 — (시작 시각이 지났거나 OR `final_status`가 최종판정됨)이면 "지난 수업", 단 체험 수업은 리뷰가 `final` 확정되기 전까지는 계속 "예정 수업"에 남김(선생님·학생 판정 불일치 제거). 취소된 예약 처리는 변경 없음.
- [x] 검증: `supabase db reset --local` 성공(신규 마이그레이션 없음) / `npx tsc --noEmit` 0 에러 / `LessonBookingTab.test.tsx` 레이아웃 회귀 2건, `lesson-booking-data.test.ts` 예정/지난 판정 4건 신규 추가 / `npx vitest run`(전체) 188파일·1259건 전부 통과 / `npx next build` 성공.
- [ ] 브라우저로 실제 Preview에서 체험 예약 완료 학생의 "수업" 탭 위쪽 여백이 실제로 사라졌는지, 선생님이 조기 종료한 세션이 학생 쪽 "지난 수업"으로 즉시 넘어가는지 눈으로 확인하는 것은 이번 세션 범위 밖 — Preview alias 갱신 후 직접 확인 권장.

### 2026-09-06 12차 세션 — 보호자 포털 "정규 진행 희망" 배너 통일 + 중도 종료 자녀 탭 숨김

제품 오너가 코드 조사로 확인한 2가지를 확정 지시. `docs/CURRENT.md`의 "2026-09-06(제품 오너 확정 지시 2건)" 절에 상세 근거가 있다.

- [x] **#1 홈 배너 조건 수정** — "정규 진행 희망 선택 필요" 배너가 체험 리뷰 확정(`lesson_reviews.status='final'`) 여부와 무관하게 떠야 한다는 지시. `app/parent/regular-intent-data.ts`에 공통 기준 함수 `getProgressedTrialEnrollmentIds()`(체험 세션이 `live`이거나 `scheduled`/`live`가 아닌 최종판정 — 즉 진행 중이거나 끝난 것)를 신설해 리뷰 확정 요건을 제거했다.
- [x] **#2 핵심 버그 — 홈 배너/수강 과목 탭 조건 불일치** — 수강 과목 탭(`TrialConversionPanel`)과 홈 배너(`regular-intent-data.ts`)가 서로 다른 조건을 써서 "탭엔 뜨는데 홈엔 안 뜨는" 불일치가 있었다. `app/parent/enrollment-data.ts`의 `loadProgressedTrialEnrollmentIds()`가 같은 기준 함수를 재사용하도록 하고, `page.tsx`→`ParentShell.tsx`→`EnrollmentTab.tsx`로 이 universe를 그대로 전달해 두 화면이 정확히 같은 subject_enrollment 집합을 대상으로 삼도록 통일.
- [x] **#3 중도 종료 자녀 탭 숨김** — `app/parent/children-data.ts`의 `loadChildren()`이 상담 상태와 무관하게 모든 자녀를 보여주던 문제. 자녀별로 active `subject_enrollments`가 없고 그 자녀에 연결된(`consultations.child_id`) 최신 상담의 `closure_type`이 `no_trial`/`trial_no_convert`면 탭 목록에서 제외. 이미 정규 전환된(active 수강 있는) 자녀는 상담 기록과 무관하게 절대 숨기지 않음. 자녀 1명뿐인 극단 케이스는 기존 `page.tsx`의 "연결된 자녀 계정이 없습니다" 빈 상태 처리가 그대로 커버.
- [x] 검증: `supabase db reset --local` 성공(신규 마이그레이션 없음) / `npx tsc --noEmit` 0 에러 / `app/parent/children-data.test.ts` 중도 종료 숨김 케이스 4건 추가 / `app/parent/TrialConversionPanel.test.tsx` 리뷰 미확정 케이스 갱신(행은 보이되 버튼 없음) / 신규 통합 테스트 `app/parent/parent-portal-trial-consultation-consistency.integration.test.ts`(로컬 Postgres, 실제 앱 함수 호출) 7건 전부 통과 / `npx vitest run`(전체) 189파일·1270건 전부 통과(`--no-file-parallelism`으로 재확인 — 병렬 실행 시 다른 통합 테스트의 선생님 예약가능시간 데이터 경합으로 flaky해지는 기존 이슈이며 이번 변경과 무관함을 확인) / `npx next build` 성공.
- [ ] 브라우저로 실제 Preview에서 체험만 하고 중도 종료된 자녀가 실제로 상단 탭에서 사라지는지, 정규 전환된 자녀는 그대로 보이는지, 리뷰 미확정 상태에서도 홈 배너가 뜨는지 눈으로 확인하는 것은 이번 세션 범위 밖 — Preview alias 갱신 후 직접 확인 권장.

### 2026-09-06 13차 세션 — 포털 홈 페이지 순차 로더 병렬화(성능 개선 1라운드) — 캐싱은 별도 라운드

배경: 학생/보호자/선생님 포털 홈 페이지(`app/*/page.tsx`)가 서로 의존관계 없는 데이터 로더 여러 개를 `Promise.all` 없이 순차 `await`하고, 자녀별/교사별/학생별 반복문 안에서도 순차 `await`(N+1)하는 성능 문제가 이전 조사에서 확인됐다. 관리자 포털은 이미 병렬화돼 있어 기준으로 삼았다. 상세 내용은 `docs/CURRENT.md`의 "2026-09-06(오픈 전 성능 개선 1라운드)" 절 참고.

- [x] `app/parent/page.tsx`, `app/student/page.tsx`, `app/teacher/page.tsx` — 서로 독립인 로더를 `Promise.all`로 병렬화(데이터 의존관계가 있는 부분만 순차 유지).
- [x] `app/student/dashboard-data.ts` — `profile`/`enrollments` 조회, 그 뒤 `teacherProfiles`/`legacy_sessions` 조회를 각각 `Promise.all`로 병렬화.
- [x] N+1 반복문 제거 — `app/parent/enrollment-data.ts`(자녀별 수강 과목), `app/parent/consent-data.ts`(자녀별 동의 상태 2곳), `app/parent/entitlements-data.ts`(상품별 가격 버전 + 계약/잔액/구매내역 3쿼리), `app/teacher/curriculum-data.ts`(학생별 커리큘럼) — 전부 `Promise.all(...map(...))`로 교체.
- [x] 로더 반환값/쿼리 조건은 전혀 변경하지 않음(순서만 변경하는 순수 성능 리팩터) — 캐싱(`revalidate`/`cache()`/`unstable_cache`)은 이번 라운드 범위 밖.
- [x] 검증: `supabase db reset --local` 성공(신규 마이그레이션 없음) / `npx tsc --noEmit` 0 에러 / `npx vitest run`(전체) 189파일·1270건 전부 통과 / `npx next build` 성공.
- [ ] **다음 오픈 전 별도 라운드 과제로 이관**: 캐싱 도입(`revalidate`/`cache()`/`unstable_cache` 등)으로 반복 조회 비용을 추가로 줄이는 작업 — 이번 라운드는 순차→병렬 전환만 다뤘고 캐싱은 별도 승인·설계가 필요해 범위에서 제외했다.
- [ ] 브라우저로 실제 Preview에서 각 포털 홈 페이지 첫 로딩 체감 속도가 개선됐는지 눈으로 확인하는 것은 이번 세션 범위 밖 — Preview alias 갱신 후 직접 확인 권장.

### 2026-09-06 14차 세션 — 병렬화 직후 제품 오너 즉시 보고 2건(수업 리스트 회귀 의심 / 정규 계약 재시도 무피드백)

13차 세션(병렬화) 배포 직후 제품 오너가 즉시 보고한 2가지. 상세 근거는 `docs/CURRENT.md`의 "2026-09-06(제품 오너 즉시 보고 2건 — 병렬화 직후)" 절 참고.

- [x] **#1 보호자 포털 수업 리스트 회귀 의심(조사 결과: 버그 아님)** — `git show ae95c39`로 관련 diff(`app/parent/page.tsx` 외 4개 파일)를 전부 정독해 의존관계 파괴가 없음을 확인. 실제 seed 데이터로 로컬 DB에 대고 `loadLessons`/`loadCurricula`/`loadDashboardData`를 service-role·실제 보호자 RLS 세션(JWT) 양쪽으로 병렬/순차 호출해 결과가 완전히 동일함을 실증. 병렬화 자체는 원인이 아니다.
- [x] **#2 관리자 칸반 "정규 계약" 재시도 무피드백(버그, 수정 완료)** — `sendRegularContractOneClickAction`이 DocuSign 발송 실패를 throw가 아니라 `{status:"failed", error}` 반환값으로 돌려주는데, `ContractSendForm.onClick`(`app/admin/ConsultationKanbanBoard.tsx`)이 이 반환값을 확인하지 않고 버려서 재시도해도 아무 피드백이 없었다. 반환값의 `status`를 확인해 실패 시 throw하도록 수정하고, Preview DocuSign 게이트(`DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS`)로 인한 실패는 "Preview 환경에서는 실제 DocuSign 발송이 비활성화되어 있습니다(정상 동작)"로 문구를 구분해 관리자가 실제 버그와 환경 제약을 헷갈리지 않게 함. 재시도 버튼 자체(빈 입력 시 비활성화, 입력 시 활성화)는 정상 동작임을 확인.
- [x] 검증: `supabase db reset --local` 성공(신규 마이그레이션 없음) / `npx tsc --noEmit` 0 에러 / 신규 통합 테스트 `app/parent/parent-home-lessons-parallel-regression.integration.test.ts`(로컬 Postgres, service-role + 실제 RLS 세션 양쪽) 2건, `app/admin/ConsultationKanbanBoard.test.tsx` 신규 3건 — 전부 통과 / `npx vitest run`(전체) 190파일·1275건 중 1건만 실패(`lib/timezone-persistence.integration.test.ts` — 단독 실행 시 통과하는 기존 병렬 실행 플레이크, 재확인 결과 이번 변경과 무관) / `npx next build` 성공.
- [ ] 브라우저로 실제 Preview에서 "세온장" 카드의 "정규 계약" 섹션에 회사 승인자 직함을 입력하고 재시도했을 때 새 Preview 게이트 안내 문구가 실제로 뜨는지 눈으로 확인하는 것은 이번 세션 범위 밖 — Preview alias 갱신 후 직접 확인 권장.

### 2026-09-06 15차 세션 — 가족 카드 온보딩 폼 중복 노출 방지 + 회사 승인자 직함 기본값 고정 + 계약 자동 발송 설계 확인(1~3번, 4·5번은 미착수)

제품 오너 지적 5건 중 1~3번(작은 것부터) 완료. 4·5번(체험 생략→정규 등록 플로우 완성, 지인/추천 상담 없이 바로 계정 생성)은 스키마 변경·신규 화면·통합 테스트까지 필요한 큰 규모라 이번 세션에서 착수하지 못했다. 상세 근거는 `docs/CURRENT.md`의 "2026-09-06(제품 오너 지적 3건)" 절 참고.

- [x] **#1 가족(부모) 카드에 자녀 카드가 이미 있으면 온보딩 발송 폼 숨김** — `app/admin/consultation-kanban-actions.ts`의 `ConsultationCardDetail`에 `childCards`(자녀 카드 목록) 추가, `ConsultationKanbanBoard.tsx`가 자녀 카드가 있으면 빈 폼 대신 안내+이동 링크를 보여준다. 발송 내역 조회는 그대로 유지.
- [x] **#2 회사 승인자 직함 기본값 고정** — `ConsultationKanbanBoard.tsx`/`TrialOnboardingPanel.tsx`의 `approverTitle` 초기값을 `"CEO, Do Kyung Kim"`으로 고정(수정 가능은 유지).
- [x] **#3 설계 확인(코드 변경 없음)** — "정규 진행 희망" 확인(`confirmRegularProgressIntent`)은 계약 자동 발송을 트리거하지 않는다. 계약 발송은 관리자가 회사 승인자 직함을 입력하고 수동으로 "회사 승인 및 계약 발송"을 눌러야만 실행되는 의도된 설계임을 코드로 확인.
- [x] 검증: `supabase db reset --local` 성공(스키마 변경 없음) / `npx tsc --noEmit` 0 에러 / `app/admin/ConsultationKanbanBoard.test.tsx` 신규 2건 + 기존 1건 갱신, 전부 통과 / `npx vitest run`(전체) 190파일·1277건 중 5건만 실패(`lib/booking/trial-entitlement-and-cancellation.integration.test.ts` — 변경 전 커밋에서도 동일 실패 확인, 무관) / `npx next build` 성공.
- [ ] **#4 체험 생략 → 바로 정규 등록 플로우 완성** — 미착수. `outcome='regular_recommended'`일 때 `TrialOnboardingStudentsForm` 렌더 조건 확장, 학생 계정 생성 완료 시 계약 draft 자동 생성, `sendRegularContractOneClickAction`의 `trial_regular_progress_selections` 체크를 이 경로에서 우회하는 작업이 남아있다. 설계 메모는 `docs/CURRENT.md` "다음 라운드 TODO" 참고.
- [ ] **#5 지인/추천 — 상담 없이 바로 계정 생성** — 미착수. 신규 관리자 화면(상담 칸반과 분리), `consultation_id` nullable 여부 스키마 확인부터 시작 필요.
- [ ] 브라우저로 실제 Preview에서 자녀 카드가 있는 가족 카드를 열어 폼이 실제로 숨겨지고 이동 링크가 동작하는지, 회사 승인자 직함이 기본값으로 채워져 있는지 눈으로 확인하는 것은 이번 세션 범위 밖 — Preview alias 갱신 후 직접 확인 권장.

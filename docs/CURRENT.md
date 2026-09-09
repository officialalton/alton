# ALTON — 현재 상태 (2026-09-09 기준)

> **2026-09-09 — 기반 안정화 계획 corrective: `session_incident_reports`
> 신고자 신원 위조 차단(제품 오너 최종 승인 전 지적 사항).** 5단계에서
> `reported_by` 미기록 버그를 고쳐 신고 기능이 다시 동작하게 됐는데,
> INSERT 정책이 `is_session_related_v3(session_id)`만 확인하고 `reported_by`가
> 실제 호출자(`auth.uid()`)와 같은지는 확인하지 않아 세션 관련자가 요청
> 바디에 다른 사용자의 id를 넣어 신고자를 위조할 수 있는 구조였음을
> 제품 오너가 지적 — 이를 닫는 corrective 라운드.
>
> **조사**: `session_incident_reports`에 대한 유일한 INSERT 경로는
> `lib/booking/incident-reports.ts::submitIncidentReport()`(학생/교사/보호자
> 3개 서버 액션에서 호출) 하나뿐이고, 셋 다 `requireUser()`로 얻은 세션
> 사용자의 id를 그대로 전달한다. `app/admin/booking-actions.ts`는 이
> 테이블을 SELECT만 한다 — 관리자가 대신 신고를 기록해야 하는 정당한 예외
> 경로가 실제로 존재하지 않으므로, 예외를 만들지 않고 `reported_by =
> auth.uid()`를 무조건 강제했다.
>
> **수정**:
> `supabase/migrations/20261264000000_r6_corrective_incident_report_reported_by_identity.sql`
> — INSERT 정책을 `reported_by = auth.uid() and (is_session_related_v3(...)
> or is_admin() or capability)`로 교체(기존 세션 관련성 요건은 관리자
> 분기에도 그대로 유지, "신원 위조 방지"는 독립된 AND 조건으로 추가).
> `session_content_use_events`의 `recorded_by = auth.uid()`와 동일한 기존
> 패턴을 그대로 재사용.
>
> **테스트(신규)**: `app/student/incident-report-reported-by-identity.integration.test.ts`
> — 실제 v3 세션(confirm_lesson_booking으로 생성)에 대해 (1) 학생/보호자/
> 교사 본인이 자기 id로 신고 성공, (2) 세션 관련자(학생/보호자)가 다른
> 사용자의 id를 `reported_by`에 넣으면 RLS가 거부, (3) 세션과 무관한
> 제3자는 본인 id로도 세션 관련성 요건에서 거부됨을 psql role-switch로
> 검증(총 6케이스). 기존 앱 레이어 단위테스트(3개 액션 파일)는 이미
> 호출자 자신의 id를 전달하고 있어 그대로 통과.
>
> **검증**: `db reset --local` → 신규 통합 테스트 6/6 통과, 기존 관련
> 단위테스트 15/15 통과, 전체 스위트 240/240 파일·1685/1685 테스트
> 통과, `tsc`/`next build` 클린.
>
> **범위 준수**: 이 corrective 외 7단계 범위 밖 기능·리팩터링·외부 변경은
> 하지 않았다. **Preview/non-prod/UAT 계정/배포/push/main 병합/실제 외부
> 호출 없음.**
>
> **성능 라운드 관련**: 제품 오너가 이번엔 "N+1 구조 제거"까지만 승인 —
> 응답시간 개선 수치는 로컬 측정치일 뿐 재현 가능한 HTTP/TTFB 기준이
> 아니므로, 다음 성능 라운드에서 포털별 실측 전후 수치로 별도 검증하기로
> 확인.

> **2026-09-09 — 기반 안정화 계획(제품 오너 야간 자율 승인) 진행 중 — 1~2단계
> 완료.** 계획 문서 7절 순서대로 진행. 각 단계 독립 커밋·로컬 검증(신규
> migration 시 `db reset --local`, 대상 테스트, `tsc --noEmit`, 전체 테스트,
> `next build`) 완료 후 다음 단계로 진행. **전부 local 전용 — Preview/
> non-prod/UAT 계정/배포/push/main 병합/실제 외부 호출(이메일·결제·정산·
> Google·Wise·Mercury·Stripe) 없음.**
>
> **1단계(정산 P0) 완료** — 커밋 `b855043`. `reverse_payout_item()`을 원본
> paid item 하나당 역분개 정확히 1회만 허용하도록 재작성:
> `payout_items.reversed_from_item_id` FK + 부분 유니크 제약(구조적 방어),
> 원본 행 `FOR UPDATE` 잠금 후 재검증, 기존 역분개가 있으면 신규 생성 없이
> 그 ID를 그대로 반환하는 멱등 동작, 동시 INSERT 경합은
> `unique_violation`을 잡아 재조회로 수렴. 필수 테스트 4종(순차 재시도/
> 동시 호출/중간 실패 롤백/비간섭) 추가 —
> `lib/booking/payout-batch-lifecycle.integration.test.ts` 15/15 통과,
> 전체 스위트 232/232 파일·1650/1650 테스트 통과, `tsc`/`next build` 클린.
>
> **2단계(성능 기준선·N+1 개선) 완료** — 커밋 이번 항목과 함께 기록.
> `app/student/curriculum-data.ts::loadCurricula()`를 로컬 개발 DB에
> 학생 1/10/30명 × enrollment 1/3/5개 조합을 실제로 시딩해 기준선을
> 측정한 뒤 배치 조회로 재작성, 동일 조건으로 재측정했다(측정 스크립트는
> 계획 문서 5절 절차대로 일회성으로 실행 후 삭제 — 커밋 대상 아님).
>
> | 조건 | 기준선(수정 전) 왕복 수 | 개선 후 왕복 수 |
> |---|---|---|
> | 학생 1명 × enrollment 1개 | 5회 | 5회 |
> | 학생 10명 × enrollment 3개 | 110회(교사대시보드 전체) | 50회 |
> | 학생 30명 × enrollment 5개 | 510회(교사대시보드 전체) | 150회 |
> | `loadCurricula()` 단일 호출(enrollment 5개 기준) | 17회 | 5회(enrollment 수와 무관하게 고정) |
>
> 왕복 수가 조합 규모에 선형 이상으로 증가함이 실측으로 확인되어(교사
> 대시보드가 학생 수 × (2+3×enrollment 수)로 증가) 계획 문서 6절 P0 확정
> 기준 (b)를 충족 — P0로 확정하고 수정했다. `enrollments`/
> `teacher_curriculum_templates`/`teacher_curriculum_template_units`/
> `legacy_sessions` 4개 쿼리로 고정(기존 3N+2 → 4, `.or()`/`.in()` 배치
> 조회), 응답 데이터 모양은 동일 — 회귀 테스트
> `app/student/curriculum-data.test.ts` 신규 추가(쿼리 수 고정 검증 +
> 매핑 결과 동일성). 추가로 `app/teacher/dashboard-data.ts`의 독립 쿼리
> 3개(profile/teacherRow/enrollments)를 `Promise.all`로 병렬화(P1, 순수
> 재정렬, 로직 변경 없음). 전체 스위트 233/233 파일·1652/1652 테스트
> 통과, `tsc`/`next build` 클린.
>
> **3단계(수업 상태변경 P0 테스트) 완료**. `app/teacher/lesson-schedule-actions.ts`의
> `startMyLessonSession`/`finalizeMyLessonSession`/`resolveMyLessonLateness`
> 세 액션에 정상/권한 거부/잘못된 상태 3케이스씩 총 10개 테스트 추가
> (`app/teacher/lesson-schedule-actions.test.ts`, `requireUser`/
> `createAdminClient`를 `app/student/booking-actions.test.ts`와 동일한
> 패턴으로 mock). 이 RPC들의 실제 상태머신(정상 전이·잘못된 상태 거부)
> 자체는 `lib/booking/session-final-judgment.integration.test.ts` 등에서
> 이미 DB 레벨로 검증돼 있었으므로, 이번 테스트는 그 위에 얹힌 액션
> 레이어(본인 세션 재확인 권한 게이트, RPC 에러의 `{ok:false}` 변환 계약)를
> 커버한다. 전체 스위트 234/234 파일·1662/1662 테스트 통과, `tsc`/
> `next build` 클린.
>
> **4단계(관리자 service-role 경로 감사) 완료 — 코드 누락 없음, 회귀 가드만
> 추가.** `app/admin/*.ts`(19개 파일) 전수 스캔 결과 `createAdminClient()`를
> 호출하는 exported 함수는 전부 이미 `requireAdmin()`/
> `requireAdminOrCapability()`를 함수 본문 안에서 호출하고 있었다. 예외
> 3건을 직접 검토해 안전함을 확인: (1) `getClosureDraftAction`은
> `requireAdminOrCapability`를 이미 호출하는
> `getConsultationCardDetailAction`에 위임 호출, (2) `users-data.ts`의
> `loadEmailById`(admin client로 `auth.admin.listUsers()` 호출)는
> `app/admin/page.tsx`에서만 쓰이는데, 이 page.tsx는 다른 모든 포털
> page.tsx(`app/student`/`app/teacher`/`app/parent`)와 **동일하게**
> `requireUser()` + 최상위 `middleware.ts`의 역할 기반 라우트 게이트(로그인
> 사용자의 `profiles.role`이 그 경로의 홈이 아니면 리다이렉트)에만 의존하는
> 일관된 아키텍처 패턴 — admin만의 예외적 누락이 아니라 앱 전체의 의도된
> 설계였다. 여기에 admin/page.tsx만 별도로 `requireAdmin()`을 추가하는
> 것은 페이지 레벨 보안 모델(미들웨어 단일 게이트) 자체를 바꾸는 아키텍처
> 판단이라 이번 라운드 범위를 벗어난다고 보고 **코드를 바꾸지 않았다**(결정
> 필요 항목으로 아래에 기록). (3) `payouts-cron.ts`는 이미
> `lib/legacy-teacher-payouts-write-guard.test.ts`가 완전 no-op임을
> 증명한 파일. 신규 회귀 가드
> `app/admin/admin-action-auth-guard.test.ts` 추가 — 앞으로 추가되는
> `createAdminClient()` 호출부가 `requireAdmin`류 없이 만들어지면 이
> 테스트가 실패한다(정적 함수 본문 추출 로직을 별도 스크립트로 직접 검증:
> 30개 함수 중 11개가 admin client를 쓰고 11개 전부 가드 있음을 확인).
> 전체 스위트 235/235 파일·1664/1664 테스트 통과, `tsc`/`next build` 클린.
>
> **결정 필요(제품 오너)**: `app/admin/page.tsx`(및 이 파일이 호출하는
> `users-data.ts`의 admin-client 우회 헬퍼)가 미들웨어 라우트 게이트에만
> 의존하는 것을 이대로 둘지, 아니면 모든 포털 page.tsx에 `requireUser()`
> 외 역할 재확인을 앱 코드 레벨에서도 추가할지 — 이번 라운드는 admin만
> 예외적으로 강화하는 비일관적 변경을 피하기 위해 현행 유지로 판단했다.
>
> **5단계(P1 테스트 보강) 완료 — 실제 버그 1건 발견·수정.** 사전 확인 중
> `lib/booking/incident-reports.ts::submitIncidentReport()`이
> `session_incident_reports.reported_by`(NOT NULL, 기본값·트리거 없음)를
> 전혀 채우지 않는 것을 발견 — **이 함수는 호출될 때마다 항상 NOT NULL
> 위반으로 실패했다(선생님 지각/노쇼 신고 기능이 사실상 한 번도 동작한
> 적이 없었던 것으로 보인다)**. 순수 버그 수정(CLAUDE.md 기준 자체 판단
> 범위)으로 인증된 호출자 id를 `reported_by`로 명시 전달하도록 수정 —
> 영향받는 3개 호출부(`app/student/incident-report-actions.ts`,
> `app/parent/booking-actions.ts::reportTeacherIssueForChild`,
> `app/teacher/incident-report-actions.ts`) 전부 수정.
>
> 그 외 대상 3건은 확인 결과 실제 소유자·권한 검증은 이미 RLS(homework_items:
> `is_session_participant`, session_incident_reports: `is_session_related_v3`)
> 또는 기존 `requireAdminOrCapability`(direct-account-actions.ts, 4단계에서
> 이미 가드 확인됨)가 담당하고 있어 앱 코드 추가 변경은 하지 않고, 정상/권한
> 거부(RLS 거부 전파)/잘못된 상태(DB CHECK·FK 위반) 테스트만 추가했다:
> `app/student/incident-report-actions.test.ts`(신규),
> `app/teacher/incident-report-actions.test.ts`(신규),
> `app/session/[id]/homework-actions.test.ts`(신규),
> `app/admin/direct-account-actions.test.ts`(신규, 정상/권한거부/중복이메일/
> 이메일형식오류/메일발송실패 5케이스), `app/parent/booking-actions.test.ts`
> 기존 테스트를 새 `submitIncidentReport` 시그니처(reported_by 인자 추가)에
> 맞춰 갱신. 전체 스위트 239/239 파일·1678/1678 테스트 통과, `tsc`/
> `next build` 클린. 제품 동작(UX)은 "신고가 실제로 저장됨"이라는 원래
> 의도대로 복구된 것 외에 새로 추가되지 않았다.
>
> **6단계(정산 batch 생성 동시성) 완료 — 실제로 재현됨, 잠금으로 수정.**
> `generate_payout_batches()`(미배치 pending 항목을 조회 후 새 batch로
> 묶는 함수)에 대해 두 트랜잭션이 같은 미배치 항목을 동시에 조회하는
> 경합을 실제로 재현했다(`payout_batches` INSERT 직후 0.4초 지연 트리거로
> 경합 창 확보 후 두 개의 psql 프로세스를 동시 실행): **두 호출 모두
> `item_count=1`을 반환**해 둘 다 자기가 그 항목을 배정했다고 믿었지만,
> 실제로는 나중에 커밋한 쪽만 그 항목을 진짜로 소유하고 먼저 커밋한 쪽은
> 반환값과 달리 실제로는 빈 고아 batch가 되는 것을 확인(같은 항목이 두
> batch에 동시에 연결되는 이중 지급까지는 아니었다 — `batch_id`가 단일
> 컬럼이라 구조적으로 불가능 — 하지만 반환값 신뢰 불가·고아 batch 생성은
> 실제 버그). 수정: `supabase/migrations/20261263000000_r10_corrective_generate_payout_batches_lock.sql`
> — 후보 항목을 GROUP BY 집계 전에 서브쿼리에서 `FOR UPDATE SKIP LOCKED`로
> 먼저 잠근다. 이러면 뒤에 실행되는 호출은 대기하지 않고(교착 위험 없음)
> 이미 잠긴 항목을 이번 그룹에서 제외해, 같은 항목이 두 번 배정되는 경로
> 자체가 사라진다. 회귀 테스트를 실제 재현 결과 확인 → 수정 → 동일 조건
> 재검증 순서로 갱신(수정 후에는 두 호출 중 정확히 하나만 item_count=1을
> 반환하고 다른 하나는 빈 결과, 반환된 batch_id와 실제 DB의 `payout_items.
> batch_id`가 정확히 일치함을 확인). 전체 스위트 239/239 파일·1679/1679
> 테스트 통과, `tsc`/`next build` 클린.
>
> **7단계(레거시/v3·migration ALTER 충돌 조사) 완료 — 조사·문서화만, 코드
> 변경 없음(지시대로).**
> - **migration ALTER 충돌**: 계획 문서 4절이 예산상 생략했던 고빈도 테이블
>   (`sessions`, `reservations`, `payout_items`, `payout_batches`,
>   `entitlement_grants`) 대상 `ALTER TABLE` 전수 스캔을 완료했다. 모든
>   ALTER문이 컬럼 추가(`add column`)/제약 추가(`add constraint`)/RLS
>   활성화이며 시간순으로 서로 겹치지 않는 컬럼·제약만 다뤄 **충돌 없음**을
>   확인. 유일하게 같은 제약을 drop 후 다시 add하는 경우(`sessions`의
>   `sessions_curriculum_doc_id_fkey`, `sessions_smart_notes_status_check`)도
>   전부 같은 마이그레이션 파일 안에서 drop-then-readd로 완결되는 패턴이라
>   순서 의존적 충돌 위험이 없다.
> - **레거시/v3 읽기 병합**: 2026-09-09 최초 탐색(위 계획 문서 3절)에서
>   확인한 내용 그대로 재확인 — `legacy_sessions ∪ sessions` 병합 읽기
>   로직이 `app/student/dashboard-data.ts` 등 8개 이상 파일에 독립
>   재구현돼 있으나, 쓰기 경로는 서로 배타적으로 게이트돼 있어 P0급 충돌은
>   없다. **공용 헬퍼 추출 리팩터링, 레거시 RPC·죽은 코드 삭제,
>   `trial_lesson_review` 변경은 지시대로 하지 않았다** — 이 항목들은 계획
>   문서 3절/4절에 이미 후속 작업으로 기록돼 있고 이번 라운드 범위 밖이다.
>
> **기반 안정화 계획(2026-09-09 확정) 전체 7단계 완료.** 코드 변경 요약:
> `reverse_payout_item()`(정산 P0), `loadCurricula()` N+1 제거 +
> 대시보드 병렬화(성능), `lesson-schedule-actions.ts` 테스트(수업
> 상태변경 P0), 관리자 service-role 회귀 가드(코드 변경 없음),
> `submitIncidentReport()` reported_by 버그 수정 + P1 테스트 3건,
> `generate_payout_batches()` 동시성 수정(정산). 총 7개 커밋, 전부 독립
> 커밋·로컬 검증(각 단계 `tsc`/전체 테스트/`next build`) 완료. **Preview,
> non-prod, UAT 계정, 배포, push, main 병합, 실제 외부 호출 전부 하지
> 않았다.** 예상 밖 정책 판단으로 코드를 바꾸지 않고 기록만 한 지점 1건
> (4단계, admin/page.tsx의 미들웨어 단일 게이트 유지 여부)과 미결 정책
> 1건(4절, 미사용 RPC 3종 삭제 여부)이 남아 있다 — 제품 오너 확인 필요.

> **2026-09-09 — 배치 2-4(`bypass_session_lock`, 배치 2 마지막 항목) corrective
> 완료.** 신규 마이그레이션
> `supabase/migrations/20261261000000_r8_corrective_session_invariant_tokens.sql`.
> `app.bypass_session_lock` GUC는 `sessions` 테이블의 서로 다른 두 불변식
> (`final_status`, `material_version_id`)을 동시에 보호하고 있었다 — 다른 3개
> 배치 2 항목과 달리 공유 `status_transition_tokens`를 재사용하지 않고, 전용
> 테이블 `session_invariant_unlock_tokens(session_id, invariant, xact_id,
> created_at)`을 새로 만들어 두 불변식을 완전히 분리했다(이유: 하나의 GUC가
> 두 불변식을 같이 풀어주던 구조적 결함 — `reopen_session()`이 `final_status`를
> 되돌리려고 GUC를 켜는 동안 같은 트랜잭션에서 `material_version_id`를 바꾸는
> UPDATE가 끼어들면 그것도 함께 통과해버리는 이론상 부작용 경로가 있었다).
>
> **수정 내용**: (1) 신규 테이블 + private 헬퍼
> `consume_session_invariant_unlock_token(session_id, invariant)`(status_transition_tokens와
> 동일한 잠금 패턴 — RLS 활성화 + 정책 0개, 모든 ordinary role에서 전 권한
> revoke, 트리거 함수 본문 안에서만 호출, 어떤 role에도 EXECUTE 없음). (2)
> `prevent_direct_final_status_update()` — GUC 분기 제거, `'final_status'` 토큰
> 확인/소비로 교체. (3) `prevent_material_version_reassignment()` — GUC 분기
> 제거, `'material_version_id'` 토큰 확인/소비로 교체(토큰 소비는 함수당 최대
> 1회만 일어나도록 상단에서 한 번만 확인 — 두 조건문이 각자 소비를 시도하면
> 이중 소비/오탐 거부가 날 수 있어서). (4) `reopen_session(uuid, text)` —
> `set_config()` 호출 제거, `final_status` UPDATE 직전 `'final_status'` 토큰만
> 인라인 INSERT(`'material_version_id'` 토큰은 절대 발급하지 않는다 — 이 함수가
> 그 컬럼을 전혀 건드리지 않기 때문이며, 바로 이 구분이 GUC 공유 시절의
> 교차오염 부작용을 구조적으로 없앤다). (5) `recomplete_session(...)`은 **수정하지
> 않았다** — 재조사 결과 이 함수는 이 GUC를 애초에 전혀 쓰지 않는다(다른
> corrective, `20261259000000`/`20261260000000`이 이미 별도 GUC를 대체했고,
> 이 함수의 `final_status` UPDATE는 `v_prev='live'`가 항상 보장되어 트리거를
> 자연스럽게 통과한다). (6)
> `app/session/[id]/r8-cutover.integration.test.ts`의 fixture 정리 코드 2곳(완료
> 상태 검증 후 `final_status`를 `live`로 되돌리는 곳, `material_version_id`를
> `null`로 되돌리는 곳)에서 `set_config('app.bypass_session_lock', ...)` 호출을
> 제거하고, 같은 psql 트랜잭션 안에서 해당 invariant 토큰을 인라인 INSERT한
> 뒤 바로 소비하는 방식으로 교체했다(reopen_session()이 하는 것과 동일한
> 정상 경로 패턴).
>
> **신규 회귀 테스트**:
> `app/session/[id]/session-invariant-unlock-token.integration.test.ts`(신규
> 파일, 10 테스트) — ① 토큰 없는 직접 UPDATE 차단(final_status/material_version_id
> 각각), ② 레거시 GUC 무효화(각각), ③ temp table 위조 토큰 차단(각각), ④
> `reopen_session()` 정상 경로(completed→live, 토큰 잔존 0), ⑤ **핵심 회귀**:
> 이미 `material_version_id`가 배정된 세션에서 `reopen_session()` 호출과 같은
> 트랜잭션 안에 재배정 UPDATE를 끼워 넣으면 거부되고 전체 롤백됨(공유 GUC
> 시절 실제로 존재했던 교차오염 부작용의 회귀 증명), ⑥ 같은 세션에 대한 두
> 동시 `reopen_session()` 호출 — 기존 `for update` 잠금 덕분에 정확히 하나만
> 성공, 토큰/이벤트 오염 없음, ⑦ `session_status_events` INSERT 강제 실패 시
> 토큰·상태·이벤트 전체 롤백(좀비 토큰 없음).
>
> **검증**: `supabase db reset --local` → 대상 파일 2개(신규 + r8-cutover) 실행
> 시 17/17 통과. `tsc --noEmit` 클린. `db reset` → 전체 스위트(`--no-file-parallelism`)
> 연속 2회 실행: 두 번 다 232 test files / 1646 tests 전부 통과, 실패 0(중간에
> `db reset --local` 직후 컨테이너가 완전히 준비되기 전에 곧바로 vitest를
> 띄워 `households` 관련 FK 오류로 전체 실패한 시도가 1회 있었으나, DB 준비
> 상태를 먼저 확인한 뒤 같은 조건으로 재실행하니 재현되지 않았다 — 코드
> 결함이 아니라 실행 타이밍 문제로 확인). `next build` 성공.
>
> **배치 2(bypass GUC 보안 정리) 4개 항목 전부 완료** — status_protect,
> invite_protect, reconciliation_task_lock(+ 잠금 순서 corrective),
> session_lock 순서로 모두 구현/검증 완료. 이 문서와 계획 문서
> (`docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md`)가 확정한
> 범위를 벗어나는 새 작업(배치 3 등)은 시작하지 않았다.

> **2026-09-09 — 제품 오너가 배치 2-4와 감사 대상 GUC 우회 7건 전체를 최종
> 승인.** 재개방 정상 경로, `final_status`/`material_version_id` 두 불변식
> 분리, 직접 변경·GUC·임시 테이블 위조 차단, 동시성·롤백까지 확인 완료 —
> **`docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md`가 감사한
> 7개 settable-GUC-bypass 취약점(배치 1 3건 + 배치 2 4건) 전체가 종결됐다.**
> 신규 기능 개발은 보류하고, 다음 라운드는 오픈 전 기반 코드 리뷰·성능 진단의
> **실행 계획 수립**으로 전환(코드 수정 없음, 계획 문서만).
>
> **실행 계획 문서 신설(2차 수정, 제품 오너 보완 지시 반영 후 확정)**:
> `docs/superpowers/plans/2026-09-09-codebase-review-and-performance-diagnosis.md`.
> Explore 서브에이전트 5개를 병렬 실행해 (1) 계정·권한·가족·RLS, (2) 상담·예약·
> 수업·정산 상태 전이와 DB 제약, (3) 레거시/v3 경로 중복, (4) 서버 액션·
> migration·테스트 정합성, (5) 페이지별 쿼리 성능을 1차 탐색(170개 migration/
> 62개 액션 파일 전수 정독은 예산상 생략, grep 기반 스캔 + 대표 파일 정독)했다.
> 1차 결과를 제품 오너가 검토한 뒤 4가지 보완 지시를 받아 계획을 2차로 확정했다.
> **코드/마이그레이션 변경 없음 — 이번 라운드도 계획 문서 작성 + 이 항목만
> 추가.**
>
> **보완 지시 반영 내용**:
> 1. **정산 P0 설계 확정** — `reverse_payout_item()`: 원본 paid item 1건당 역분개는
>    정확히 1회만 허용. `payout_items.reversed_from_item_id`(원본 참조 FK) 추가 +
>    `unique (reversed_from_item_id) where not null` 제약으로 중복 생성을 DB
>    레벨에서 차단. 함수는 원본 행 `for update` 잠금 후 기존 reversal이 있으면 그
>    ID를 그대로 반환하는 멱등 동작으로 확정(신규 음수 항목·감사 로그 생성 안 함).
>    필수 테스트 5종(정상/순차 재시도/동시 호출/중간 실패 롤백/서로 다른 원본 간
>    비간섭)을 계획에 명시.
> 2. **성능은 실측 선행** — `loadCurricula()`/교사 대시보드 N+1은 **P0 후보로만
>    유지**, P0 확정은 학생 수×enrollment 수 조건 매트릭스(1/10/30 × 1/3/5)로
>    개발 DB에서 서버 응답시간·PostgREST 왕복 수·순차 대기 구간·페이지 TTFB를
>    먼저 측정한 뒤 결정. 순서는 ① 기준선 측정 → ② 배치 조회로 변경 → ③ 동일
>    조건 재측정으로 계획에 고정.
> 3. **테스트 공백 4건 재산정** — 일괄 P0 확정을 철회. 실제 확인 결과
>    `app/teacher/lesson-schedule-actions.ts`(수업 시작/종료/지각 처리, 정산 직결)
>    만 P0로 유지. `app/admin/direct-account-actions.ts`(계정운영), `app/student/
>    incident-report-actions.ts`(안전, 순위는 이르게), `app/session/[id]/
>    homework-actions.ts`(채점 무결성, 소유자 체크 존재 여부 착수 시 확인 필요)는
>    실제 금전/권한 영향이 낮아 P1로 하향.
> 4. **`trial_lesson_review` RPC 계열(5개 함수) 현행 유지** — 삭제·이관 보류.
>    `20261016000000_m4_trial_review_and_regular_conversion.sql`→
>    `20261017000000_m4_admin_function_auth_fix.sql`→
>    `20261027000000_m4_unified_lesson_reviews.sql` 순으로 정의됐고 TypeScript
>    호출부는 재확인해도 0건 — 다만 실제 통합 여부·데이터 잔존·운영 UI 사용
>    여부를 별도 조사한 뒤에만 삭제/이관을 결정하기로 확정, 이번 계획에는
>    포함하지 않음.
>
> **확정 실행 순서**: 정산 P0(`reverse_payout_item` 설계+테스트 5종) →
> 성능 기준선 측정 및 N+1 개선(측정 후 확정) → 수업 상태변경 테스트
> (`lesson-schedule-actions.ts`) → 나머지 권한·레거시 정리(`createAdminClient()`
> 회귀 방지, legacy∪v3 union 헬퍼 추출, 나머지 P1 테스트 보강).
>
> **외부 변경**: 없음. Preview 배포, non-prod migration 반영, 외부 API 호출,
> main 병합 전부 하지 않았다. **다음 작업은 제품 오너가 확정한 위 실행 순서대로
> 시작한다 — 이번 라운드에서도 어떤 코드도 수정하지 않았다.**

> **2026-09-09 — 배치 2-3 corrective의 corrective: `resolve_session_reconciliation_task()`
> 잠금 순서 수정(실제 데드락 버그).** 신규 마이그레이션
> `supabase/migrations/20261260000000_r2_corrective_reconciliation_lock_order.sql`.
> 배치 2-3(`20261259000000`) 검토 중 확인된 실제 데드락 가능성 — `recomplete_session()`은
> `sessions` 행을 먼저 잠근 뒤 대사 작업 후보 행을 잠그는데(정책과 일치, 이번에
> 변경 없음 — 재확인만 함), `resolve_session_reconciliation_task()`는 반대로
> `session_judgment_reconciliation_tasks` 행을 먼저 잠근 뒤(`select ... for update`)
> 그 결과로 상태를 판정하고 나서야 `sessions` 행을 잠갔다. 두 함수가 같은
> 세션+대사 작업 쌍에 동시에 실행되면 순환 대기(데드락)가 만들어질 수 있었다.
> 수정: `resolve_session_reconciliation_task()`를 (a) 잠금 없이 task의
> `session_id`만 먼저 읽고(그 값 외에는 신뢰하지 않음) (b) `sessions` 행을
> 먼저 `select ... for update`로 잠근 뒤 (c) 그다음 대사 작업 행을 잠그고
> (d) 잠금 이후 재조회한 값으로만 검증/분기하도록 재구성했다 — "sessions
> 먼저, 그다음 task" 순서로 `recomplete_session()`과 통일. action 값·토큰
> 발급 지점·needs_review/resolved/superseded 검증 로직은 배치 2-3에서 확정된
> 것을 그대로 유지했고, 오직 `sessions`를 잠그는 시점만 앞당겼다.
> `recomplete_session()`은 이미 "sessions 먼저" 순서였음을 재확인해 변경하지
> 않았다. 신규 회귀 테스트(⑨ 잠금 순서 corrective)를
> `lib/booking/reconciliation-task-lock-token.integration.test.ts`에 추가 —
> `resolve_session_reconciliation_task()`가 대사 작업 행 갱신 직전(테스트
> 전용 delay 트리거로 pg_sleep 주입) 실제로 `sessions`와
> `session_judgment_reconciliation_tasks` 두 릴레이션 모두에 대한 행 잠금
> (`pg_locks`의 `RowShareLock`)을 이미 보유하고 있음을 직접 확인해 새 잠금
> 순서를 증명하고, 그 상태에서 `recomplete_session()`을 동시에 실행해도
> `deadlock detected` 없이 정책대로(결과 B) 직렬화되며 최종 상태(task
> resolved, 신규 pending 행 INSERT, entitlement_ledger 조정 정확히 1건,
> 잔여 토큰 0건)가 전부 일관됨을 검증했다. `supabase db reset --local` 후
> 해당 테스트 파일 13개(기존 12개 + 신규 1개) 전부 통과, `tsc --noEmit`
> 클린, 전체 스위트(`--no-file-parallelism`)를 fresh-reset 후 2회 연속
> 실행해 매번 231개 파일 / 1636개 테스트 전부 통과 확인, `next build` 성공.
> `bypass_status_protect`/`bypass_invite_protect`/`bypass_session_lock`과
> 이들의 이미 완료된 corrective, 배치 2-3에서 확정된 action 값/토큰 로직,
> `recomplete_session()`/`resolve_session_reconciliation_task()`의 잠금
> 순서와 무관한 그 외 로직은 전혀 건드리지 않았다.
>
> **2026-09-08 — 배치 2-3 `bypass_reconciliation_task_lock` GUC corrective
> 완료.** 신규 마이그레이션
> `supabase/migrations/20261259000000_r2_corrective_reconciliation_task_lock_token.sql`로
> `session_judgment_reconciliation_tasks` 보호에 쓰이던
> `app.bypass_reconciliation_task_lock` GUC를 제거하고 `status_transition_tokens`
> 공용 1회용 토큰 인프라로 교체했다. 대상은 실제 호출자 3개 —
> `resolve_session_reconciliation_task()`(최신 `20261124000000` 정의),
> `set_reconciliation_task_student_cancelled_disposition()`(최신
> `20261124000000` 정의), `recomplete_session()`(최신 `20261123000000` 정의 —
> 이전 pending 대사 작업을 superseded로 전환하는 부분만, 그 외 로직은
> 전혀 손대지 않음)뿐이다. action 값 4개를 완전히 분리했다(product-owner
> 5차 개정 반영) — `reconciliation_task_resolve`(pending→resolved),
> `reconciliation_task_needs_review`(pending→needs_review, 3가지 원인
> 공유), `reconciliation_task_supersede`(pending→superseded,
> `recomplete_session()` 전용), `reconciliation_task_set_disposition`(status가
> 아니라 disposition 3개 컬럼 UPDATE) — 어느 action 값도 자기 자신이 지정한
> 전이보다 더 많은 것을 열 수 없다(`needs_review` 토큰으로는 `superseded`
> 전이를 절대 열 수 없음을 별도 테스트로 확인). `resolve_session_reconciliation_task()`는
> 기존 `select ... for update`가 이미 잠금 획득과 동시에 최신 커밋 상태를
> 반환하는 구조라 별도 재조회 코드 없이도 "잠금 후 재검증" 정책을 만족했다.
> `recomplete_session()`은 `mark_expired_invites()`와 동일한
> candidates(id 오름차순 `for update` 잠금) → tokens(행별 개별
> `reconciliation_task_supersede` 토큰 INSERT) → 배치 UPDATE 3단 CTE
> 체인으로 재작성해 다건 pending 작업도 행당 정확히 1개 토큰만 소비하게
> 했다 — candidates의 `for update`가 EvalPlanQual로 WHERE절을 재평가하므로
> 잠금 대기 중 다른 트랜잭션이 해당 행을 이미 resolved/needs_review로
> 전환했다면 자동으로 후보에서 제외된다. product-owner 6차 개정이 확정한
> 경합 정책("행 잠금을 먼저 획득하고 정상 완료하는 쪽이 이긴다")의 두
> 결과를 각각 실제 동시 프로세스(pg_sleep을 주입하는 테스트 전용 임시
> 트리거로 잠금 보유 시간을 늘려 경합을 결정론적으로 재현)로 검증했다 —
> 결과 A(`recomplete_session()` 선승): 대상 행이 `superseded`로 전이되고,
> 뒤이어 잠금을 얻는 `resolve_session_reconciliation_task()`는 재조회한
> 행이 더 이상 `pending`이 아님을 확인해 명시적으로 반려(조용한 no-op
> 아님). 결과 B(`resolve_session_reconciliation_task()` 선승): 대상 행이
> `resolved`로 전이되고, 뒤이어 잠금을 얻는 `recomplete_session()`은 그
> 행을 전혀 mutate하지 않은 채(원본 로직에서 원래도 매 호출마다 무조건
> 실행되던) 새 대사 작업 행을 INSERT한다. 신규 회귀 테스트
> `lib/booking/reconciliation-task-lock-token.integration.test.ts`(12개
> 케이스)로 정상 경로 3개(resolved/needs_review/set_disposition), 직접
> UPDATE/DELETE 거부, 레거시 GUC 무효화, 세션 로컬 temp table 위조 차단,
> 다른 action 값 토큰으로 supersede를 열 수 없음, 다건 pending 작업
> supersede(행마다 개별 토큰 발급·소비, 좀비 토큰 0건), 정산 원장 반영
> 실패 시 토큰/status/entitlement_ledger 전체 롤백, 경합 결과 A/B 둘 다를
> 검증했다. `bypass_status_protect`/`bypass_invite_protect`/`bypass_session_lock`과
> 이들의 이미 완료된 corrective, `recomplete_session()`의 그 외 로직(sessions
> UPDATE, session_status_events/payout_items 처리, student_cancelled 24시간
> 자동 판정)은 전혀 건드리지 않았다. `supabase db reset --local` 후 해당
> 테스트 파일 12개 전부 통과, `tsc --noEmit` 클린, 전체 스위트
> (`--no-file-parallelism`)를 fresh-reset 후 2회 연속 실행해 매번 231개
> 파일 / 1635개 테스트 전부 통과 확인, `next build` 성공.
>
> **2026-09-08 — 배치 2-2 `bypass_invite_protect` GUC corrective 완료.**
> 신규 마이그레이션
> `supabase/migrations/20261258000000_r2_corrective_invite_protect_token.sql`로
> `account_invites.status` 보호에 쓰이던 `app.bypass_invite_protect` GUC를
> 제거하고 배치 1에서 구축한 `status_transition_tokens` 공용 1회용 토큰
> 인프라로 교체했다(`action = 'invite_status_transition'`). 대상은 실제
> 호출자 5개 — `resend_account_invite()`/`revoke_account_invite()`(둘 다
> `20260909000000` capability 게이트 최신 정의 기준)/`claim_account_invite()`(anon
> 포함, 유일 버전)/`resolve_manual_review_invite()`(`20260909000000` 최신
> 정의)/`mark_expired_invites()`(유일 버전) — 뿐이다. `create_account_invite()`(INSERT-only)와
> `finalize_account_invite()`(status를 건드리지 않음)는 이 GUC와 무관해
> 손대지 않았다. `protect_account_invite_status()` 트리거는 이번에 처음으로
> SECURITY DEFINER + `search_path = public, pg_temp`를 명시했다(원본은 둘 다
> 없었음). 4개 단일-행 호출자는 원본부터 이미 대상 행을 `select ... for
> update`로 잠근 뒤 상태를 읽으므로 별도 잠금 추가가 필요 없었다 —
> `mark_expired_invites()`만 여러 행을 한 UPDATE로 동시 전환하는 배치
> 함수라 별도 설계가 필요했고, `candidates(for update로 잠근 후보 id) →
> tokens(후보별 개별 토큰 INSERT) → expired(반드시 tokens의 출력에 의존하는
> UPDATE)` 3단 CTE 체인으로 "행당 1개 토큰"을 구현했다 — 최초 구현 시
> `expired`가 `candidates`에만 의존하도록 썼다가 PostgreSQL이 토큰 INSERT와
> UPDATE의 실행 순서를 보장하지 않아 트리거가 아직 없는 토큰을 찾아 거부하는
> 실패를 실제로 재현했고, `expired`의 WHERE 절을 `tokens`의 리턴값(`row_id`)에
> 의존하도록 고쳐 해결했다(이 경위를 마이그레이션 주석에도 남겼다).
> 신규 회귀 테스트
> `app/admin/account-invite-protect-token.integration.test.ts`(16개 케이스)로
> 5개 함수 각각의 정상 경로, 익명 사용자 초대 수락에서 토큰이 정확히 1회
> 발급/소비되고 기존 해시 비교/만료 검사가 불변임을, `mark_expired_invites()`가
> 3건 이상을 한 번에 처리할 때 각 행이 자기 몫의 토큰만 소비하고(교차 오염
> 없음) 좀비 토큰이 남지 않음을, 직접 UPDATE 차단, 레거시 GUC 무효화, 세션
> 로컬 temp table 위조 차단, `claim_account_invite()` 재시도(이미 accepted인
> 초대에 대한 멱등 재호출, 중복 이벤트 없음), 동시성(같은 초대에 대한 두
> `claim_account_invite()` 동시 호출은 `for update` 잠금으로 직렬화되어 둘 다
> 에러 없이 성공하되 accepted 이벤트는 정확히 1건만 남고, 서로 다른 두 초대에
> 대한 동시 `revoke_account_invite()`는 계속 독립적으로 성공), `resolve_manual_review_invite()`
> link 분기 중 `account_invite_events` INSERT 강제 실패 시 토큰·status
> UPDATE·`household_members` INSERT 전체 롤백을 각각 검증했다. `bypass_status_protect`(이미
> corrective 완료)/`bypass_reconciliation_task_lock`/`bypass_session_lock`/`recomplete_session()`은
> 건드리지 않았다. `supabase db reset --local` 후 해당 테스트 파일 16개 전부
> 통과, `tsc --noEmit` 클린, 전체 스위트(`--no-file-parallelism`)를
> fresh-reset 후 2회 연속 실행해 매번 230개 파일 / 1621개 테스트 전부 통과
> 확인, `next build` 성공.
>
> **2026-09-08 — `transition_account_status()` TOCTOU 행 잠금 corrective
> 후속 수정 완료.** 배치 2-1 corrective(`20261256000000`)로 GUC를
> `status_transition_tokens`로 교체한 뒤, `transition_account_status()`가
> 대상 역할 테이블(`students`/`teachers`/`parents`) 행을 잠그지 않은 채
> 현재 상태를 읽고 검증하던 TOCTOU 레이스가 남아 있었다 — 같은 행에 대해
> 동일한 전이(예: `pending → active`)를 요청하는 두 동시 호출이 둘 다
> `pending`을 읽고 검증을 통과해 `account_status_events`에 중복 이벤트가
> 쌓일 수 있었다. 신규 마이그레이션
> `supabase/migrations/20261257000000_r2_corrective_status_transition_row_lock.sql`
> (`create or replace function`, 기존 `20261256000000` 파일은 수정하지
> 않음)로 역할 확정 직후 `select ... for update`로 대상 행을 먼저 잠그고,
> 잠금 확보 후 `get_account_status()`로 상태를 재조회해 그 값으로 전이
> 유효성을 검증하도록 고쳤다 — 대기하던 호출이 잠금을 얻었을 때 이미 다른
> 트랜잭션이 전이를 커밋했다면 기존과 동일한 "허용되지 않는 상태
> 전이입니다" 오류로 자연스럽게 거부된다(새 오류 경로 없음). `merge_accounts()`는
> 조사 결과 이미 `profiles` 행을 `v_first`/`v_second` 정렬 순서로
> `for update` 잠근 뒤에야 상태를 읽으므로 같은 레이스가 없어 변경하지
> 않았다. `app/admin/account-status-protect-token.integration.test.ts`의
> 기존 동시성 테스트(⑤)를 이전 라운드의 느슨한 "하나 이상 성공 허용" 검증
> 대신 진짜 동시(별도 psql 프로세스 + `Promise.all`) 호출로 "정확히
> 하나만 성공, 이벤트 정확히 1건, 토큰 잔존 0건"을 단언하도록 교체했고,
> 서로 다른 행에 대한 동시 호출은 계속 독립적으로 성공함을 검증하는
> 테스트도 추가했다. 또한 이 함수의 10개 허용 전이 전부를
> `it.each`로 개별 검증하는 테스트, 미성년 동의 게이트(13세 미만 학생
> `active` 전환), 선생님 활성화 체크리스트(7개 조건) 게이트를 각각
> 미충족/충족 양쪽으로 검증하는 테스트를 신규 추가했다. `bypass_invite_protect`/
> `bypass_reconciliation_task_lock`/`bypass_session_lock`/`recomplete_session()`은
> 건드리지 않았다. `supabase db reset --local` 후 해당 테스트 파일 전체
> 통과, `tsc --noEmit` 클린, 전체 스위트(`--no-file-parallelism`)를
> fresh-reset 후 2회 연속 실행해 매번 229개 파일 / 1605개 테스트 전부
> 통과 확인, `next build` 성공.
>
> **2026-09-08 — bypass GUC 배치 2-3(`bypass_reconciliation_task_lock`) 동시
> 재판정/반영 경합 정책 확정(계획/문서 전용, 코드/마이그레이션 변경 없음).**
> `docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md`에 6차
> 개정을 추가해, `recomplete_session()`(재판정)과
> `resolve_session_reconciliation_task()`(반영)이 같은
> `session_judgment_reconciliation_tasks` 행을 두고 경합할 때 "결정 필요"로
> 남아 있던 항목을 product-owner가 확정한 정책으로 대체했다 — **행 잠금
> (`for update`)을 먼저 획득하고 정상 완료하는 쪽이 이긴다**: (A)
> `recomplete_session()`이 먼저 이기면 대상 행을 `superseded`로 전이시키고,
> 뒤이어 잠금을 얻는 `resolve_session_reconciliation_task()`는 재조회한
> 상태가 더 이상 `pending`이 아님을 확인해 명시적으로 반려한다. (B)
> `resolve_session_reconciliation_task()`가 먼저 이기면 대상 행이
> `resolved`/`needs_review`가 되고, 뒤이어 잠금을 얻는 `recomplete_session()`은
> 그 행을 전혀 mutate하지 않고 대신 새 대사 작업 행을 INSERT한다. 두
> 함수 모두 "잠그고, 잠근 뒤에 재검증"하는 동일 패턴을 따라야 하며, 이는
> 배치 2-1 corrective가 채택한 원칙을 문서 전체의 공유 원칙으로 재확인한
> 것이다. 필수 테스트 목록도 이 두 결정론적 결과(경합 결과 A/B)로
> 재구성했다. 이번 라운드는 계획 문서만 갱신했고, 동시 진행 중일 수 있는
> 배치 2-1 코드/마이그레이션 파일은 전혀 건드리지 않았다(작업 시작 전
> `git status`로 확인 — 관련 미커밋 변경 없음).
>
> **2026-09-08 — bypass GUC 배치 2-1(`bypass_status_protect`) corrective 구현 완료.**
> `docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md` "배치 2 상세
> 실행 계획 > 배치 2-1"에 따라 신규 마이그레이션
> `supabase/migrations/20261256000000_r2_corrective_status_protect_token.sql`을
> 추가해 `protect_account_status()`(트리거)/`transition_account_status()`/
> `merge_accounts()` 3개 함수를 `create or replace`했다. GUC(`app.bypass_status_protect`)
> 분기를 완전히 제거하고 배치 1이 구축한 공유 `status_transition_tokens` 테이블 +
> `consume_status_transition_token()` 헬퍼를 재사용 — action 값은 `'status_transition'`
> 단일 값(두 호출자 모두 전이 종류가 하나뿐이고 대상 테이블(`students`/`teachers`/
> `parents`)로 이미 구분되므로). `merge_accounts()`는 호출당 병합 대상 1개 행만
> 상태를 바꾸므로 "행당 1개 토큰"과 "호출당 1개 토큰"이 동일 — 별도 설계 결정
> 불필요. 배치 1 corrective(`20261255000000`)와 동일하게 두 함수 모두
> `public.status_transition_tokens`로 완전히 스키마 한정하고 `search_path = public,
> pg_temp`를 명시 고정했다. `recomplete_session()`(bypass_reconciliation_task_lock
> 대상, 별개 항목)과 다른 Batch 2 항목(`bypass_invite_protect`/
> `bypass_reconciliation_task_lock`/`bypass_session_lock`)은 전혀 건드리지 않았다.
>
> 신규 회귀 테스트: `app/admin/account-status-protect-token.integration.test.ts`
> (12개 케이스) — ① 정상 전이(transition_account_status 관리자 경로 학생/선생님,
> merge_accounts 관리자·capability 경로 각각) ② 직접 UPDATE 차단(students/teachers/
> parents) ③ 레거시 GUC 무효화 ④ 세션 로컬 temp table 위조 토큰 거부(스키마 한정
> 검증) ⑤ 동시성(서로 다른 행 순차 전이 무간섭, 같은 행 동시 호출 시 이중 적용/
> 오염 없음) ⑥ 실패 시 전체 롤백(transition_account_status/merge_accounts 각각
> account_status_events INSERT 강제 실패 → 토큰·상태 UPDATE·병합 기록 전부 롤백).
>
> 검증: `supabase db reset --local` 성공, `tsc --noEmit` clean, `next build` 성공,
> 전체 테스트 스위트(`vitest run --no-file-parallelism`, 이 저장소에 기존부터 있던
> curriculum-overlay 동시성 테스트의 파일-간 병렬 실행 시 DB 상태 경합 — 이 작업과
> 무관 — 을 피하기 위해 사용) 신선한 `db reset` 후 2회 연속 실행 모두 229/229
> 파일, 1591/1591 테스트 100% 통과.

> **2026-09-08 — bypass GUC 배치 2 계획 문서 내부 정합성 정정(계획/문서 전용,
> 코드 변경 없음).** 직전 라운드(바로 아래 항목)가 4차 개정에서 `recomplete_session()`
> 관련 사실관계 3건을 정정했지만, 그 정정을 "개정 이력"과 "배치 2 상세 실행 계획"
> 절에만 반영하고 문서 앞부분의 **원래 감사(audit) 표**(`### 1. bypass_session_lock`,
> `### 3. bypass_status_protect`, `### 4. bypass_invite_protect` — 이 라운드 이전
> 커밋에 이미 존재하던 절)는 갱신하지 않고 남겨둬서, 같은 문서 안에 서로 모순되는
> 서술이 공존했다(예: 앞쪽 표는 "recomplete_session()이 bypass_status_protect를
> 쓴다"고 하고, 뒤쪽 "주의" 문단은 "3번 절의 recomplete_session() 인용은 잘못됐다"고
> 지적만 하고 실제로 고치지는 않음). 이번 라운드는 **모든 마이그레이션 파일을
> 다시 전수 재확인**하여(각 함수가 여러 마이그레이션에서 `create or replace`로
> 재정의되므로 가장 최근 정의만이 유효하다는 점에 유의해 확인) 세 감사 표를 그
> 최신 사실에 맞춰 직접 고쳤다:
> - `bypass_session_lock`: 실제 호출자는 `reopen_session()` 1개뿐. `recomplete_session()`은
>   이 GUC를 전혀 쓰지 않는다 — 이유는 `prevent_direct_final_status_update()` 트리거가
>   `old.final_status not in ('scheduled','live')`일 때만 차단하는데, `recomplete_session()`은
>   항상 `reopen_session()`이 먼저 `final_status`를 `'live'`로 되돌린 뒤에만 호출되므로
>   (`v_prev is distinct from 'live'`면 예외) 트리거 조건이 애초에 성립하지 않아 GUC 없이도
>   통과한다.
> - `bypass_status_protect`: 실제 호출자는 `transition_account_status()`/`merge_accounts()`
>   2개뿐. `recomplete_session()`의 `20260928000000_r6_sessions_cutover.sql`판이
>   한때 이 GUC를 썼지만, 이후 `20261122000000_m5c_reconciliation_task_staleness.sql`/
>   `20261123000000_m5c_student_cancelled_reconciliation.sql`이 이 함수를 다시
>   `create or replace`하면서 그 SET 호출이 제거되고 `bypass_reconciliation_task_lock`
>   SET으로 대체됐다(최신 정의는 `20261123000000_m5c_student_cancelled_reconciliation.sql`).
> - `bypass_invite_protect`: 실제 호출자는 5개(`resend_account_invite`/
>   `revoke_account_invite`/`claim_account_invite`(2분기)/`resolve_manual_review_invite`
>   (2분기)/`mark_expired_invites`). `create_account_invite()`(INSERT-only)와
>   `finalize_account_invite()`(UPDATE가 `target_profile_id`/`auth_user_id`/`updated_at`만
>   건드림, `status` 아님)는 무관하다.
>
> 세 값 모두 이미 "개정 이력"/"배치 2 상세 실행 계획" 절이 서술하던 것과 정확히
> 일치한다 — 이번 라운드는 새 사실을 발견한 것이 아니라, 문서 앞부분에 남아 있던
> **미반영 잔재**(항목 수·함수 목록·테스트 시나리오·"수정 대상" 목록에 흩어진
> `recomplete_session`/`create_account_invite`/`finalize_account_invite` 오기재)를
> 문서 전체에 일관되게 반영한 것이다. 코드/마이그레이션은 전혀 건드리지 않았다.

> **2026-09-08 — bypass GUC 배치 2 상세 실행 계획 추가(계획/문서 전용, 코드
> 변경 없음).** `docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md`에
> 배치 2 4개 항목(`bypass_status_protect`/`bypass_invite_protect`/
> `bypass_reconciliation_task_lock`/`bypass_session_lock`) 각각의 상세 실행
> 계획(독립 마이그레이션 경계, 토큰 `action`/`invariant` 값, 정상 전이별
> 발급/소비 지점, 필수 테스트 목록, `search_path`/스키마 한정 의무 명문화,
> 수정 대상 전체 목록)을 새 절 "## 배치 2 상세 실행 계획"으로 추가했다.
> 작성 전 4건 전부의 실제 최신 함수 본문을 다시 읽어 기존 문서의 사실관계
> 오류 3건을 정정했다: (1) `bypass_status_protect`의 실제 호출자는
> `transition_account_status()`/`merge_accounts()` 2개뿐 — `recomplete_session()`은
> 이 GUC를 쓰지 않는다. (2) `bypass_reconciliation_task_lock`의 실제 호출자는
> 3개 — 기존 두 함수 외에 `recomplete_session()`도 재판정 시 이전 pending
> 대사 작업을 `superseded`로 전환하며 이 GUC를 쓴다(기존 문서 누락).
> (3) `bypass_invite_protect`의 실제 호출자는 5개 — `create_account_invite()`/
> `finalize_account_invite()`는 `status` 컬럼을 건드리지 않아 무관하고,
> 대신 `resolve_manual_review_invite()`(revoke/link 2개 분기)가 실제
> 호출자다(기존 문서 누락). 결론: 배치 2 4개 항목은 서로 진짜 순서
> 의존성이 없다 — 전부 독립적으로 승인·구현·배포 가능(제품 오너 지시
> 순서는 우선순위 편의). `bypass_session_lock`은 재조사 후에도 별도
> 테이블(`session_invariant_unlock_tokens`) 설계를 유지하는 것이 맞다고
> 재확인했다. 이 라운드는 계획/문서만 갱신 — 코드/마이그레이션은 전혀
> 건드리지 않았다.

> **2026-09-08 — bypass GUC 배치 1 corrective: status_transition_tokens temp table
> 가로채기 취약점 수정(`20261255000000`).** 제품 오너 리뷰에서, 배치 1이 방금 구축한
> `consume_status_transition_token()`/`revoke_guardian_consent()`/`set_teacher_rate()`
> 세 함수가 `status_transition_tokens`를 **스키마 한정 없이(unqualified)** 참조하고
> `search_path = public`만 설정했던 것이 실제 취약점으로 지적됐다: PostgreSQL은
> search_path 설정과 무관하게 세션의 `pg_temp` 스키마를 항상 먼저 검색하므로(스키마
> 한정 참조만 이 규칙에서 예외), 호출자가 자기 세션에
> `create temp table status_transition_tokens (...)`로 동명 테이블을 만들고 위조
> 토큰 행을 심으면 세 함수의 unqualified 참조가 그 temp table로 resolve되어 진짜
> `public.status_transition_tokens`에 걸린 GRANT/REVOKE 잠금(어떤 ordinary role에도
> INSERT/UPDATE/DELETE/SELECT 없음)을 완전히 무력화할 수 있었다 — 호출자는 자기
> temp table에 대해서는 항상 완전한 제어권을 가지기 때문이다.
>
> `20261255000000_r_corrective_status_transition_tokens_search_path.sql`이 세 함수
> 모두를 `create or replace function`으로 재작성해 (1) 모든 테이블 참조를
> `public.status_transition_tokens`로 완전히 스키마 한정하고(이것만으로 취약점이
> 닫힌다 — 스키마 한정 참조는 pg_temp 우선순위 규칙의 영향을 받지 않음), (2) 방어
> 심층화로 `search_path = public, pg_temp`를 명시적으로 고정했다(제품 오너 지시).
> `bypass_trial_session_auto_complete`는 애초에 이 토큰 테이블을 쓰지 않으므로
> 이번 수정 대상이 아니다 — 손대지 않았다.
>
> 회귀 테스트(`app/admin/consent-protect-token.integration.test.ts`,
> `lib/booking/teacher-rate-protect-token.integration.test.ts`)에 다음을 추가/확인:
> ① 권한 잠금 확인 — `authenticated`/`service_role` 모두 실제
> `public.status_transition_tokens`에 INSERT/UPDATE/DELETE/SELECT 그랜트가 없음을
> `has_table_privilege()`로 명시 단언. ② **공격 재현(신규, 핵심)** — 같은 세션 안에서
> `create temp table status_transition_tokens (...)`로 동명 temp table을 만들고
> 트리거가 찾을 `table_name`/`row_id`/`action`/`xact_id`와 일치하는 위조 토큰 행을
> 심은 뒤, 실제 함수를 거치지 않은 직접 UPDATE(철회 3필드 / `effective_until`)를
> 시도 — 수정 후에도 여전히 거부됨을 확인(수정 전이었다면 이 공격이 통과했을
> 것). ③ 기존 원자성 회귀(정상 철회/시급 변경, 실패 시 롤백)가 모두 그대로 통과함을
> 재확인 — 스키마 한정 수정이 정상 경로를 깨지 않았다.
>
> 검증: `supabase db reset --local` → 대상 테스트 12/12 통과(공격 재현 포함) →
> `tsc --noEmit` 클린 → 전체 테스트 스위트(228 파일/1579 테스트, `vitest run
> --no-file-parallelism` — 파일 간 병렬 실행 시 공유 로컬 DB에 대한 무관한
> 기존 flake(`student-curriculum-overlay.integration.test.ts` 체크섬 경쟁 등)가
> 있어 순차 실행으로 확인, 배치 1 base 커밋에서도 동일하게 재현되는 사전 존재
> 이슈로 이번 변경과 무관함을 확인함) 신선 리셋 후 두 차례 모두 100% 통과 →
> `next build` 성공. 배치 2(`bypass_status_protect`/`bypass_invite_protect`/
> `bypass_reconciliation_task_lock`) 문서에도 "공유 토큰 인프라 재사용 시 동일한
> 완전 스키마 한정 + search_path 고정 규칙을 처음부터 따를 것"이라는 주의사항을
> 추가했다(`docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md`) —
> 배치 2 자체는 이번 라운드에서 구현하지 않았다.

> **2026-09-08 — bypass GUC 보안 정리 배치 1 착수(코드/마이그레이션 변경 실제 반영).**
> `docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md`의 배치 1
> (`bypass_consent_protect` → `bypass_teacher_rate_protect` →
> `bypass_trial_session_auto_complete`)을 실제로 구현했다. 배치 2
> (`bypass_session_lock`/`bypass_status_protect`/`bypass_invite_protect`/
> `bypass_reconciliation_task_lock`)는 이번 라운드에서 건드리지 않았다 — 계획대로
> 별도 스코프.
>
> - `20261251000000_r_status_transition_tokens.sql`(신규) — 공유 1회용 토큰
>   테이블 `status_transition_tokens(table_name, row_id, action, xact_id,
>   created_at)`을 신설. `session_content_manifest`(20261233000000)와 동일한
>   잠금 패턴 — 어떤 ordinary role(public/anon/authenticated/service_role)에도
>   INSERT/UPDATE/DELETE/SELECT 그랜트 없음, RLS 활성 + 쓰기 정책 0개. private
>   헬퍼 `consume_status_transition_token()`(SECURITY DEFINER, 어떤 role에도
>   EXECUTE 없음 — 트리거 본문 안에서만 호출)이 "토큰 존재 확인 + 1회용 삭제"를
>   담당한다. 제품 오너 지시대로 범용 "토큰 발급" 함수는 만들지 않았다 — 발급은
>   각 SECURITY DEFINER 함수(`revoke_guardian_consent()`, `set_teacher_rate()`)
>   본문 안 인라인 INSERT로만 이루어진다.
> - `20261252000000_r2_corrective_consent_protect_token.sql` — `app.bypass_consent_protect`
>   GUC 분기를 완전히 제거. `protect_guardian_consent()`는 동의 당시 8개
>   필드는 그대로 무조건 불변 유지, 철회 3필드만 바뀌는 UPDATE는
>   `status_transition_tokens`에서 `action='revoke_consent'` 토큰을 확인·소비해야만
>   통과한다. `revoke_guardian_consent()`는 인가 검사 후 철회 UPDATE 직전에
>   토큰을 인라인 INSERT하고, 철회 UPDATE·`privacy_review_tasks` INSERT까지
>   전부 같은 트랜잭션 — 어느 단계든 실패하면 토큰도 함께 롤백된다(좀비 토큰
>   없음, 회귀 테스트로 확인).
> - `20261253000000_r1_corrective_teacher_rate_protect_token.sql` — `app.bypass_teacher_rate_protect`
>   GUC 분기를 완전히 제거. `protect_teacher_rate_history()`는 금액·통화·teacher_id·
>   effective_from은 그대로 무조건 불변, `effective_until`만 바뀌는 UPDATE는
>   `action='close_teacher_rate'` 토큰을 확인·소비해야만 통과한다.
>   `set_teacher_rate()`(R2 sync 포함 최신 버전)는 기존 이력 종료 UPDATE 직전에
>   토큰을 인라인 INSERT하고, 종료 UPDATE·새 이력 INSERT·`teachers.hourly_rate_krw`
>   동기화까지 전부 같은 트랜잭션.
> - `20261254000000_m5d_corrective_trial_auto_complete_condition.sql` — `app.bypass_trial_session_auto_complete`
>   GUC 참조를 완전히 제거(토큰 인프라도 쓰지 않음 — 유일 호출자·단일
>   캐스케이드라 과설계로 판단, 계획 그대로). `reject_direct_trial_session_completion()`을
>   결과 조건 재검증으로 재작성 — `trial_sessions.status`가 `completed`로
>   바뀌려면 (1) 연결된 `sessions.final_status`가 실제로 `completed`인가(직접
>   재조회, role/게이트 무관 — 관리자·service_role도 예외 없음), (2) 같은
>   UPDATE에서 `completed_at`도 non-null로 함께 채워지는가, 둘 다 참이어야
>   한다. `auto_complete_linked_trial_session()`은 GUC set/reset 호출만
>   제거(원래도 status/completed_at을 같은 UPDATE에서 함께 채우고 있었음 —
>   캐스케이드 정상 동작에는 영향 없음).
> - 신규 회귀 테스트(실제 로컬 Postgres 대상 psql 통합 테스트, 이 저장소의
>   기존 패턴 그대로): `app/admin/consent-protect-token.integration.test.ts`(5),
>   `lib/booking/teacher-rate-protect-token.integration.test.ts`(4),
>   `lib/booking/trial-session-completion-link.integration.test.ts`에 4개 케이스
>   추가(기존 파일 확장, 역할 무관성 + `completed_at` 동시성 케이스 포함).
>   GUC 이름을 fixture 정리에 쓰던 기존 테스트 파일은 없었음(grep 확인) —
>   fixture 마이그레이션 불필요.
> - 전체 스위트(1576 테스트) 두 차례 fresh `db reset --local` 후 실행 — 둘 다
>   신규/수정 테스트 전부 통과, 실패는 `app/teacher/student-curriculum-overlay.integration.test.ts`의
>   기존(이번 변경과 무관) checksum 병렬 실행 오염 플레이크 2건뿐이며, 이
>   플레이크는 이번 변경 전 baseline(`git stash` 후 재현)에서도 동일하게
>   재현됨을 확인했다(그 baseline 실행에서는 오히려 4건 실패 — 실행마다 순서가
>   달라 실패 개수가 변동하는 전형적 테스트 간 오염 패턴). `tsc --noEmit`,
>   `next build` 전부 통과.
>
> 상세: `docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md`.

> **2026-09-08 — bypass GUC 보안 정리 계획 2차 개정(코드 변경 없음, 계획/문서화만).**
> 제품 오너가 `bypass_consent_protect`/`bypass_teacher_rate_protect`에 대해
> 이전 개정에서 확정했던 "필드 조합 검사" 설계를 반려했다 — 필드 검사만으로는
> "직접 UPDATE가 허용 필드만 건드렸는가"만 증명할 뿐 "함수의 나머지 원자적
> 부수효과(`revoke_guardian_consent()`의 `privacy_review_tasks` 행 생성,
> `set_teacher_rate()`의 새 이력 INSERT + `teachers.hourly_rate_krw` 동기화)까지
> 건너뛰지 않았는가"는 증명하지 못한다는 것이 반려 사유이며, 실제 함수 본문
> 재확인으로 이 우려가 코드 사실과 일치함을 확인했다. 두 항목을 **1회용 DB
> 토큰 방식**(`status_transition_tokens` 공용 테이블을 `action` 컬럼으로
> 확장 — 대상 행 + 허용 작업(`revoke_consent`/`close_teacher_rate`) +
> `txid_current()`를 묶는 토큰, 배치 2의 다중 호출자 GUC 3건과 같은 인프라
> 공유·재사용)으로 재설계했다. 토큰 테이블 쓰기 권한은 GRANT/REVOKE로 구조적
> 잠금(`session_content_manifest` 잠금과 동일 패턴 — 일반 role 전원 REVOKE,
> RLS 활성 + 쓰기 정책 없음, SECURITY DEFINER 함수만 테이블 소유자 권한으로
> 기록). `bypass_trial_session_auto_complete`는 기존 "결과 조건 재검증" 방향은
> 그대로 유지한 채, `completed_at`이 `status`와 같은 UPDATE에서 항상 함께
> 채워지는지, 그리고 링크된 세션이 미완료 상태일 때 관리자·service_role의
> 직접 UPDATE 시도까지 역할 무관하게 거부되는지를 검증하는 테스트 시나리오를
> 추가했다. 배치 1/배치 2 실행 순서 자체는 유지하되, 공유 토큰 테이블 구축
> 시점이 배치 2-1(`bypass_status_protect`)에서 배치 1-1(`bypass_consent_protect`)로
> 앞당겨졌다. 상세: `docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md`.
> 이번 라운드도 마이그레이션·앱 코드는 전혀 건드리지 않았다.

> **2026-09-08 — bypass GUC 보안 정리 계획 1차 개정(코드 변경 없음, 계획/문서화만) [위 2차 개정으로 일부 대체됨].**
> 초안(`be18161`) 대비 `docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md`를
> 4가지 축으로 개정했다: (1) 7개 GUC 전부를 하드 블로커로 확정(잠정 분류
> 제거), (2) `bypass_reconciliation_task_lock`의 "R10 착수 여부 미확인" 서술이
> 사실과 달랐음을 정정 — R10 payout 파이프라인은 이미 구현돼 있음을 실제
> 커밋(`1072dda`/`a4f8d8d`/`6cb8ee6`/`ed72952`/`1519d26`/`55f9575`/`6871a3b` 등)과
> `session_judgment_reconciliation_tasks` → `entitlement_ledger`/`payout_items`
> 연결 코드를 직접 읽어 확인, (3) 초안에 남아 있던 "결정 필요" 3개 항목
> (`bypass_status_protect`의 8개 SET 호출부 게이트, `task8_capability_gates.sql`의
> 목적, `claim_account_invite`의 anon 토큰 인가 방식)을 실제 최신 함수 본문을
> 전수 읽어 확정 결론으로 전환, (4) 7개 GUC 각각에 대해 "여러 대안 나열" 대신
> 단일 확정 방향(필드 검사 재작성 / 공용 1회용 토큰 테이블 / 구조 재설계)과
> 구체적 테스트 시나리오로 재작성. 남은 "결정 필요"는 `bypass_session_lock`
> 구조 재설계의 착수 스케줄(리소스 배정) 1건뿐 — 순수 정책 판단만 남았다.
> 이번 라운드도 마이그레이션·앱 코드는 전혀 건드리지 않았다.

> **2026-09-08 — bypass GUC 보안 정리 계획 수립(코드 변경 없음, 계획 전용) [초안, 위 개정으로 대체됨].**
> `876b30a`(R8 annotation-lock corrective) 감사에서 남겨둔 나머지
> `app.bypass_*` GUC 7건(`bypass_session_lock`, `bypass_teacher_rate_protect`,
> `bypass_invite_protect`, `bypass_status_protect`, `bypass_consent_protect`,
> `bypass_reconciliation_task_lock`, `bypass_trial_session_auto_complete`)에
> 대해, 각각의 보호 불변식·실제 SET 호출 경로·role별 도달 가능성·정상 흐름
> 의존성·GUC 없는 대체 방식·수정 대상을 정리한 계획 문서를 작성했다 —
> `docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md`. 이번
> 라운드는 계획/문서화만 수행했고 마이그레이션·앱 코드는 전혀 건드리지
> 않았다. 제품 오너 지시("세션 불변식·동의·계정 상태·초대·정산 관련 항목은
> Preview/non-prod 반영 전 별도 보안 정리 라운드로 반드시 닫아야 한다")에
> 따라 5개 상위 우선순위 항목의 Preview 게이트 해당 여부를 정리했고,
> `bypass_reconciliation_task_lock`/`bypass_trial_session_auto_complete`는
> 별도로 위험도·선행조건을 분류했다. 몇 가지 항목(정확한 안전 대체 구조,
> R10 정산 파이프라인과의 의존관계 등)은 계획 문서의 "결정 필요" 섹션에
> 제품 오너 확인 대상으로 남겨뒀다.

> **2026-09-08 — Part D: R9 Gap 1/2 — v3 과제 format별 UI 렌더링 + 교사/관리자
> 읽기전용 제출 현황 뷰 (제품 오너 리뷰로 확인된 두 번째 공백).**
>
> **문제(Gap 1):** Part C corrective가 학생이 v3 과제를 읽고/저장하는 경로 자체는
> 열었지만, `StudentHomeworkTab.tsx`는 `problems.format`/`options`를 이미 불러오고도
> 실제로 쓰지 않고 모든 문제를 서술형 textarea 하나로만 보여줬다 — 객관식(mc)
> 문제인데도 보기(options)가 화면에 전혀 없었고, 응답은 그냥 raw 문자열로
> 저장됐다.
>
> **문제(Gap 2):** `session_homework_items`/`session_homework_attempts`에 대한
> 담당 선생님/관리자 SELECT 권한은 DB에 있었지만(20261235000000,
> 20261240000000), 그걸 실제로 보여주는 화면이 어디에도 없었다. 게다가 그
> 문제의 실제 지문(`problems`)을 읽으려면 별도의 `problems` SELECT 정책을
> 통과해야 하는데, 담당 선생님이 발급한 문제라도 published 교재 section에
> 속하지 않고 본인이 만든 것도 아니면(예: 다른 선생님이 만든 confirmed 문제를
> 키워드로 골라 발급한 경우) 그 정책을 통과하지 못하는 공백이 있었다 — 학생
> 쪽에서 이미 고친 것과 정확히 같은 종류의 문제.
>
> **고침:**
> 1. `app/student/StudentHomeworkTab.tsx` — `HomeworkV3AccordionItem`을
>    `problem.format`에 따라 분기: `format === 'mc'`면 `problem.options`(문자열
>    배열)를 실제 선택지 버튼으로 렌더링(단일 선택, `MaterialTab.tsx`의 기존 MC
>    렌더링 패턴을 그대로 재사용)하고, 그 외(essay/math/알려지지 않은 값 전부)는
>    서술형 textarea로 폴백한다(세 번째 format이 생겨도 크래시하거나 조용히
>    비지 않고 이 폴백으로 처리됨을 명시).
>    응답 JSON 모양을 이 라운드에서 확정: MC는 `{ type: "mc", selected: <0-based
>    index> }`, 서술형은 `{ type: "text", text: string }` — 파일 상단 주석에
>    문서화, `saveHomeworkV3Draft`/`submitHomeworkV3`(response: unknown, 그대로
>    upsert)는 수정 없음. 제출(submitted=true) 후에는 옵션 버튼/textarea 모두
>    `disabled`로 바뀌어 추가 입력이 불가능해진다(DB 잠금의 UI 반영일 뿐, 새
>    강제 메커니즘 아님). DB 거부(예: 재제출 시도)가 오면 화면에 에러 메시지로
>    보여주고 submitted 상태를 바꾸지 않는다(성공한 것처럼 보이지 않음).
> 2. `supabase/migrations/20261245000000_r9_teacher_homework_answer_view.sql` —
>    `problems`에 "담당 선생님/관리자는 배정한 과제 문제 조회" SELECT 정책 추가
>    (`exists(select 1 from session_homework_items shi where shi.problem_id =
>    problems.id and (is_session_teacher_v3(shi.session_id) or is_admin()))`).
>    학생 쪽 20261240000000 정책과 대칭. 쓰기 정책은 추가하지 않음.
> 3. `app/teacher/homework-composition-data.ts` — `loadSessionHomeworkStatus()`
>    추가: `session_homework_items` → `problems` → `session_homework_attempts`
>    3단계 조회로, 각 발급 항목의 상태(`not_started`/`draft`/`submitted`)와
>    format별 응답을 반환. 서비스롤 클라이언트를 새로 만들지 않고 호출자가 넘긴
>    (요청 사용자로 스코프된) `supabase` 클라이언트를 그대로 써서, 담당 아닌
>    선생님이 호출하면 RLS가 걸러 빈 배열이 돌아온다 — 데이터 유출 없음.
> 4. `app/session/[id]/HomeworkTab.tsx` — `canComposeFromSession`과 동일 조건(v3
>    세션 + 실제 역할 teacher/admin)에서 `HomeworkStatusList`(읽기전용) 렌더링.
>    MC는 선택한 보기 문자를 옵션 텍스트와 함께, 서술형은 작성 텍스트 그대로
>    보여준다. 이 뷰에는 어떤 입력/저장 컨트롤도 없다(제품 오너의 명시적 지시
>    — 교사/관리자 쓰기 경로는 이 라운드 전체에서 추가하지 않음).
>    `SessionShell.tsx`/`app/session/[id]/page.tsx`가 `loadSessionHomeworkStatus`
>    호출 결과를 v3 + teacher/admin 뷰어에만 내려준다.
>
> **검증:** `supabase db reset --local` → `tsc --noEmit`(클린) →
> `StudentHomeworkTab.test.tsx`(MC/서술형 렌더링+저장 모양+제출 후 읽기전용+DB
> 거부 노출, 5개 신규) + `HomeworkTab.test.tsx`(교사 읽기전용 뷰, 5개 신규) +
> `homework-composition-status.test.ts`(loadSessionHomeworkStatus 상태 파생,
> 5개 신규) + `homework-teacher-view.integration.test.ts`(psql 직접 RLS 검증 —
> 담당 선생님/관리자 조회 가능, 무관한 선생님은 세 테이블 모두 0행이라 "거부"와
> "제출 없음"을 구분, 다른 학생 회귀, 7개 신규) 전부 통과 →
> `vitest run --no-file-parallelism` 풀스위트를 fresh reset 후 **두 번 연속**
> 실행, 둘 다 **226 files / 1561 tests 100%** 통과 → `next build` 성공.
>
> **2026-09-08 — Part C: R9 corrective — Task 4(과제 구성)가 놓친 학생 read/write
> 경로 수정.**
>
> **문제:** Task 4(`20261235000000_r9_homework_composition.sql`)는
> `session_homework_items`의 RLS를 Task 3(`session_content_use_events`, 내부
> 교사 기록)과 똑같이 "담당 선생님/관리자만 읽기·쓰기"로 만들었다. Task 3에는
> 맞는 패턴이었지만(교사 내부 사용 기록), 과제는 정의상 학생이 읽고 답을
> 내야 하는 것이라 그대로 베끼면 안 됐다 — 제품 오너 리뷰가 지적한 진짜
> 공백. 결과적으로 (a) 학생이 본인에게 발급된 과제를 읽을 방법이 없었고,
> (b) v3 답안을 담을 테이블 자체가 없었고(기존 `session_problem_attempts`는
> `legacy_sessions`를 참조하는 별개 테이블이라 재사용 불가 — Task 4 헤더
> 주석에서 이미 확인된 사실과 동일한 이유), (c) 학생 포털에 "배정된 과제
> 목록 → 문제 내용 → 저장/제출"로 이어지는 실제 UI 경로가 없었다("발급
> 완료" 라벨만 있고 그 다음이 없었다).
>
> **고침(`20261240000000_r9_corrective_student_homework_access.sql` +
> 앱 레이어):**
> 1. `session_homework_items`에 "학생 본인 조회" SELECT 정책 추가
>    (`student_id = auth.uid()` — `students.id`가 `profiles.id = auth.uid()`를
>    그대로 참조하므로 이 직접 비교가 "본인 것만"을 정확히 포착, 별도로
>    `is_owning_student_for_enrollment()`를 경유할 필요 없음).
> 2. 새 v3 답안 테이블 `session_homework_attempts` 추가 — "학생당 과제 항목당
>    한 행, `submitted=false`인 동안 수정 가능, `submitted=true`가 되면
>    트리거로 무조건 잠김(GUC bypass 없음 — 이 세션에서 세 차례 확인된
>    안티패턴을 다시 만들지 않음)". append-only 이벤트 로그가 아니라 mutable
>    단일 행을 택한 이유: 답안 초안은 "일어난 사실의 불변 기록"이 아니라
>    "학생이 고쳐 쓰다가 최종 제출하는 진행 중인 입력"이라는 본질이 다르기
>    때문(마이그레이션 파일 §2 주석에 근거 기록).
> 3. 쓰기 인가: RLS `WITH CHECK` + 독립 SECURITY DEFINER 트리거
>    (`check_homework_attempt_assigned_to_student`) 이중 방어로 "본인에게
>    실제 배정된 항목에만" 답안을 쓸 수 있게 강제. 선생님/관리자에게는 쓰기
>    권한을 주지 않음(학생 답안 대필/위조 선례가 코드베이스 어디에도 없어
>    과잉 설계하지 않음) — 읽기만 `is_session_teacher_v3()`/`is_admin()`으로
>    허용.
> 4. 표시 시점 confirmed 재검증: `problems`에 "본인에게 과제로 배정된 문제는
>    학생도 조회" SELECT 정책을 추가하되 status 필터는 걸지 않고(행 자체는
>    항상 보임), `app/student/homework-v3-data.ts`가 Task 2 manifest 리더와
>    동일한 정신으로 `problems.status`를 다시 읽어 confirmed가 아니면 콘텐츠만
>    숨긴다(항목/배정 사실은 유지).
> 5. 실제 학생 포털 UI: `app/student/homework-v3-data.ts`(리더),
>    `app/student/homework-v3-actions.ts`(`saveHomeworkV3Draft`/
>    `submitHomeworkV3` 서버 액션, RLS에 인가 위임), `StudentHomeworkTab.tsx`에
>    "새로 배정된 과제" 섹션 추가(문제 내용 표시 → 임시 저장/제출 버튼).
>    기존 legacy `homework_items`/`session_problem_attempts` 경로
>    (`homework-data.ts`/`StudentHomeworkTab.tsx`의 기존 부분)는 전혀 건드리지
>    않고 별도 섹션으로 병존시킴(두 개념을 절대 합치지 않음).
>
> **검증:** `supabase db reset --local` → `tsc --noEmit`(클린) →
> `homework-v3.integration.test.ts`(11개, psql 직접 RLS/트리거 검증) +
> `homework-v3-data.test.ts`(4개) + `homework-v3-actions.test.ts`(4개) +
> `StudentHomeworkTab.test.tsx`/`StudentShell.test.tsx`(회귀) 전부 통과 →
> `vitest run --no-file-parallelism` 풀스위트를 fresh reset 후 **두 번
> 연속** 실행, 둘 다 224 files/1540 tests 100% 통과 → `next build` 성공.
>
> **2026-09-08 — Part A: `teacher_slot_not_open` 날짜 의존 실패 근본 수정 +
> Part B: R9 Task 4(과제 구성) 구현, 계획 완료.**
>
> **Part A 근본 원인:** `supabase/lesson-reviews.integration.test.ts`와
> `lib/booking/trial-entitlement-and-cancellation.integration.test.ts`가
> `confirm_lesson_booking()`에 넘기는 예약 시각을 "지금부터 N일 뒤, **현재
> 시각과 같은 시:분**"으로 계산했다. 두 파일 모두 `teacher_availability_rules`를
> 요일 상관없이 00:00~23:59로 시딩해두지만, `is_teacher_slot_open()`
> (`20260926000000_r6_availability_and_booking.sql`)은 자정을 넘기는 슬롯을
> "시작/종료가 같은 로컬 날짜(America/Los_Angeles)"일 때만 통과시킨다. 따라서
> 테스트를 실제로 실행한 시각이 LA 자정 부근이면, N일 뒤도 정확히 같은
> 시:분이라 똑같이 자정 부근이 되어 `teacher_slot_not_open`으로 실패했다 —
> "특정 요일에서만 실패"가 아니라 "실행한 실제 시각의 시:분"에 좌우되는
> 버그였다(그래서 실행할 때마다 재현 여부가 달랐다).
>
> **수정(테스트 파일만, 애플리케이션 로직/마이그레이션 변경 없음):** 두
> 파일 모두 `lib/booking/session-final-judgment.integration.test.ts`/
> `session-late-and-disruption.integration.test.ts` 등 이미 이 문제를 겪지
> 않던 다른 R6 통합 테스트가 쓰던 `FIXED_BOOKING_HOUR_UTC = 17`(America/
> Los_Angeles PDT 10:00 / PST 09:00, 항상 확실한 현지 낮) 패턴을 그대로
> 재사용해 예약 시:분을 고정했다 — 날짜(며칠 뒤)만 가변, 시각은 항상 안전한
> 낮 시간이므로 실제 "오늘"이 언제든 자정 경계에 걸릴 수 없다(구조적으로
> 안전 — 특정 날짜를 하드코딩해 문제를 다른 날로 옮긴 것이 아니다). db
> reset 없이 반복 실행할 때의 잔여 예약 충돌(같은 근본 원인 클래스,
> `payout-batch-lifecycle.integration.test.ts`의 `findFreeSlot()`가 이미
> 다룬 문제)까지 완전히 없애지는 않았으므로 분(分)만 0~49 사이 무작위로
> 흩뿌려 재발 확률을 낮췄다(선택 사항 보강, 이 fix의 핵심은 아님).
> **검증:** `supabase db reset --local` 후 두 파일을 단독/전체 스위트로
> 각각 실행해 통과 확인. 시:분이 항상 고정된 안전 구간이라는 것이 구조적
> 근거이며, 특정 날짜에 우연히 통과한 것이 아님을 코드로 보장한다.
>
> **Part B — R9 Task 4(과제 구성, 계획 마지막 태스크):**
> `supabase/migrations/20261235000000_r9_homework_composition.sql`이 새
> `session_homework_items` 테이블을 만든다 — 기존 `homework_items`는 사전
> 검토 결과 `session_id`가 R6 cutover(`20260928000000_r6_sessions_cutover.sql`)
> 이후 지금도 **legacy_sessions**를 참조한다는 것을 확인했다(테이블 rename은
> OID 기반이라 FK가 그대로 따라감) — 이번 라운드가 쓰는 `sessions`(구
> `sessions_v3`, Task 2/3이 참조하는 바로 그 테이블)와는 별개의 FK 타겟이라
> 재사용할 수 없었다(계획서 §4의 사전 검토 요구사항대로 실제로 확인 후 결정,
> 가정하지 않음). `check_homework_item_problem_confirmed()` 트리거(SECURITY
> DEFINER — problems RLS 가시성과 무관하게 항상 정확한 confirmed 상태를 봐야
> 하므로)가 confirmed가 아닌 문제의 INSERT를 DB 레벨에서 거부한다. RLS는
> `is_session_teacher_v3(session_id)`/`is_admin()`만 읽기·쓰기 가능(Task 3과
> 동일한 결정 5 — 학생 제외, 추후 확장). `app/teacher/homework-composition-actions.ts`의
> `composeHomeworkFromSession(sessionId, keywordIds, count, {includeUsedInLesson,
> includeAlreadyAttempted})`가 `problem_keywords_selectable`을 호출 시점에 다시
> 조회해(Task 2 pin-시점 재검증과는 별개의, 계획서가 요구한 두 번째 재검증
> 지점) 후보 풀을 만들고, `session_content_use_events`/`session_problem_attempts`
> 존재 여부로 두 토글을 독립적으로 적용한다. 인가는
> `student-curriculum-actions.ts`의 `requireAssignedTeacherOrAdmin`과 동일한
> predicate를 복제해 재사용(그 함수가 export되어 있지 않아 import는 못 함,
> 새 메커니즘은 발명하지 않음). `app/session/[id]/HomeworkTab.tsx`에 v3
> 세션·teacher/admin 실제 역할일 때만 보이는 "이 세션에서 과제 구성" UI를
> 추가했다(레거시 과제 쓰기는 여전히 v3 세션에서 비활성 — 별개 테이블이라
> 서로 간섭하지 않는다). 키워드 후보는
> `app/teacher/homework-composition-data.ts`의 `loadSessionKeywordOptions()`가
> 세션의 `session_content_manifest` 출처 오버레이 단원의 활성 키워드에서 가져온다.
> **테스트:** `app/teacher/homework-composition-actions.test.ts`(인가),
> `app/teacher/homework-composition-toggles.test.ts`(발급 시점 재검증 1건 +
> 토글 4조합 + count 제한, 가짜 supabase 클라이언트), `app/teacher/
> homework-composition.integration.test.ts`(confirmed 게이트 트리거를 DB에
> 직접 SQL로 우회 시도해도 거부됨 3건, RLS 담당/비담당/관리자 4건) — 전부
> `supabase db reset --local` 후 통과.
>
> **최종 검증:** `supabase db reset --local` → `tsc --noEmit`(에러 0) →
> `vitest run --no-file-parallelism`: **221 files / 1521 tests 전부 통과,
> 실패 0건** → `next build` 성공(정적 페이지 생성 32/32 포함). R8/R10/
> whiteboard 관련 파일은 건드리지 않았고, Task 1~3의 기존 마이그레이션도
> 수정하지 않았다(Task 4는 새 마이그레이션 파일 하나만 추가).

> **2026-09-07(R8 corrective — session_annotation_events append-only lock의
> settable GUC bypass 제거, 90d7012/6f292cc와 동일 취약점 클래스, Task 4는
> 여전히 착수하지 않음).** 발견된 문제: `b4fd788`(R8 Task D)가 도입한
> `session_annotation_events`의 append-only 트리거
> (`prevent_annotation_event_mutation()`)가 "앱 코드/RLS로는 절대 켤 수 없는
> GUC — 정리/마이그레이션 작업에서 superuser가 명시적으로 사용"이라는 가정
> 아래 `app.bypass_annotation_lock` 커스텀 GUC 분기를 남겨두고 있었다.
> 90d7012(`session_prepared_selections` pin-lock)/6f292cc
> (`session_content_use_events`)에서 이미 증명된 것과 동일한 잘못된 가정이다 —
> 플레인 SQL로 선언한 커스텀 GUC는 GRANT/REVOKE 대상이 아니라서 어떤
> 실행 경로든 `SET`으로 켤 수 있다.
>
> **정정된 위험 모델(제품 오너 확인):** ordinary `authenticated` 역할에게는
> `session_annotation_events`에 대한 UPDATE/DELETE RLS 정책도 GRANT도 아예
> 없으므로, 일반 인증 세션이 이 GUC만으로 직접 행을 변경/삭제할 수는 없었다
> (RLS가 먼저 0건으로 걸러낸다 — 90d7012/6f292cc의 사례와 달리 여기는 애초에
> ordinary role이 도달 불가능했다). 그러나 SECURITY DEFINER 함수·service_role
> 경유 코드·마이그레이션/운영 스크립트 등 RLS를 우회하는 모든 privileged 경로는
> 커스텀 GUC 자체에 접근 제어가 없으므로, 그런 경로가 의도적으로든 향후
> 버그로든 이 GUC를 설정하기만 하면 append-only 보장이 조용히 무력화될 수
> 있었다 — role 도달 가능성과 무관하게 설정 가능한 탈출구 자체가 문제다.
>
> **수정:**
> `supabase/migrations/20261239000000_r8_corrective_remove_annotation_lock_bypass.sql`
> (additive — 원본 `20261223000000_r8_session_annotation_events.sql`은 건드리지
> 않음)이 `prevent_annotation_event_mutation()`에서 bypass 분기를 완전히
> 제거했다. 이제 append-only에는 설정 가능한 어떤 탈출구도 없다(진짜
> superuser의 `ALTER TABLE ... DISABLE TRIGGER`만이 Postgres 자체 권한 모델에
> 근거한 별개 카테고리로 남는다 — GUC가 아니라서 앱 코드가 흉내낼 수 없다).
> `app/session/[id]/session-annotation-events.integration.test.ts`의 `afterAll`
> cleanup도 함께 고쳤다 — 이 파일은 여러 테스트가 하나의 공유 세션에 append-only
> 이벤트를 계속 쌓으므로(각 테스트가 독립 fixture를 쓰는 Task 1~3 계열 파일과는
> 구조가 다름), bypass 제거 이후에는 그 이벤트들을 지울 방법이 없고
> `session_annotation_events.session_id`가 `sessions(id)`를 FK(RESTRICT)로
> 참조하므로 sessions/reservations/subject_enrollments/contracts 삭제도 함께
> 불가능해진다. `afterAll`의 delete 시퀀스 자체를 제거하고 CLAUDE.md의 UAT 정리
> 관례(`supabase db reset --local`)에 맡긴다. 새 관리자 우회 메커니즘은
> 추가하지 않았다.
>
> **회귀 테스트 추가(두 각도):** (1) ordinary `authenticated` 역할 — 기존 stroke
> 행에 `SET app.bypass_annotation_lock = 'true'` 후 UPDATE/DELETE를 시도해도
> RLS가 먼저 막아 조용히 무변화임을 명시적으로 고정. (2) privileged/RLS-우회
> 경로 — 이 코드베이스에서 SECURITY DEFINER/service_role을 가장 가깝게
> 시뮬레이션하는 방법인 `postgres`(superuser, RLS 완전 우회) 세션으로
> `SET app.bypass_annotation_lock = 'true'` 후 UPDATE/DELETE를 시도 — corrective
> 이전에는 이 경로가 정확히 성공했었지만, 이제는 트리거 함수 자체에 분기가
> 없으므로 무조건 "append-only" 예외로 거부됨을 증명한다.
>
> **검증:** `supabase db reset --local`(클린 적용, corrective 마이그레이션
> 포함), `npx vitest run --no-file-parallelism`
> `app/session/[id]/session-annotation-events.integration.test.ts`(16개 전부
> 통과 — 신규 회귀 2건 포함), `npx tsc --noEmit`(클린), 전체
> `npx vitest run --no-file-parallelism`(218개 파일·1505개 테스트 중 5건만
> 실패 — 전부 `lib/booking/trial-entitlement-and-cancellation.integration.test.ts`
> /`supabase/lesson-reviews.integration.test.ts`의 날짜 의존
> `teacher_slot_not_open`, 신선한 `db reset --local` 후 두 파일만 단독 재실행해도
> 동일하게 실패함을 재확인 — 이번 변경과 무관한 기존 known flaky, docs/CURRENT.md
> 여러 라운드에서 이미 문서화됨), `npx next build`(클린).
>
> **감사(수정 없음, 보고만):** `app.bypass_*` 전수 grep 결과 —
> `bypass_prepared_selection_lock`(90d7012에서 이미 제거),
> `bypass_content_use_event_lock`(6f292cc에서 이미 제거),
> `bypass_annotation_lock`(이번 라운드에서 제거) 외에
> `bypass_session_lock`(`reopen_session()`/`recomplete_session()`,
> `20260830040000_r1_reservation_session.sql`/`20261219000000_r8_material_version_lock.sql`),
> `bypass_teacher_rate_protect`(`set_teacher_rate()`,
> `20260830110000_r1_teacher_rate_integrity_fix.sql`),
> `bypass_invite_protect`(`20260902000000_r2_account_invites.sql` 외),
> `bypass_status_protect`(`20260831011000_r2_account_status_apply.sql` 외),
> `bypass_consent_protect`(`20260904000000_r2_minor_consent.sql`),
> `bypass_reconciliation_task_lock`(`20261105000000_m5b_judgment_reconciliation_tasks.sql`
> 외), `bypass_trial_session_auto_complete`
> (`20261125000000_m5d_session_completion_integrity.sql`)가 여전히 라이브 상태다.
> 그 각 테이블에 대해 `authenticated`에 직접 UPDATE/DELETE GRANT가 없음을
> 확인했으므로(grep), ordinary `authenticated` 역할은 이들 GUC로도 직접 도달할
> 수 없다 — 전부 이번 annotation 사례와 같은 모양의 "privileged/RLS-우회 경로만
> 도달 가능"한 라이브 항목이다. 제품 오너 지시대로 이번 라운드에서는 고치지
> 않고 여기 보고만 한다 — 상세 재현 근거는 최종 보고 참고.
>
> **2026-09-07(R9 레슨 준비 Task 2만 — 불변 세션 콘텐츠 매니페스트 +
> pin_session_selection(), Task 3~4는 여전히 착수하지 않음).** 계획서
> (`docs/superpowers/plans/2026-09-08-lesson-prep-session-selection.md`, v4
> 승인) Task 2를 구현했다: `supabase/migrations/20261233000000_r9_session_content_manifest.sql`이
> 불변 `session_content_manifest(id, session_id, content_type, content_id,
> source_overlay_unit_id, display_position, published_doc_version_at_pin,
> created_at)`을 추가한다. curriculum_docs/problems에는 별도 버전 테이블/컬럼이
> 없음을 확인했으므로 `published_doc_version_at_pin`은 pin 시점 curriculum_docs.
> updated_at 스냅샷(감사/표시용, material_section만 값 있음)으로 채운다.
>
> **유일한 쓰기 경로:** `pin_session_selection(p_session_id uuid)`
> (`SECURITY DEFINER`, `search_path = public, pg_temp` 고정, `EXECUTE`는
> `authenticated`에게만·`PUBLIC`에서는 회수) 하나뿐이다. `session_content_manifest`에는
> ordinary role(teacher/authenticated) 대상 INSERT/UPDATE/DELETE 그랜트를
> 아예 만들지 않았다(이 프로젝트 기본 ACL이 새 테이블에 authenticated 앞
> ALL을 자동 부여하므로 `revoke insert, update, delete, truncate ... from
> public, anon, authenticated`로 명시적으로 되돌렸다) — RLS 정책조차 쓰기용은
> 두지 않아 "정책 없음=기본 거부"와 "그랜트 자체 없음"이 이중으로 막는다.
> `pin_session_selection()`은 SECURITY DEFINER라 RLS/앱 가드가 자동 적용되지
> 않으므로 함수 본문 맨 앞에서 스스로 (0a) `auth.uid()` null 거부 (0b) 담당
> 선생님(자신의 teacher_id + `is_active_teacher_for_enrollment()`) 또는
> `is_admin()` (0c) 넘어온 sessionId가 실제로 이 staged 선택에 attach돼있는지
> (session_id로 조회 자체가 이를 강제) (0d) 세션과 선택의
> subject_enrollment_id 일치를 검사한다. 통과하면 staged+included 콘텐츠
> 항목을 unit/keyword 범위+`curriculum_doc_section_keywords_selectable`/
> `problem_keywords_selectable`로 전부 재검증(하나라도 실패하면 실패 항목을
> 지목해 전체 중단, 매니페스트 0행)한 뒤에만 INSERT하고, 그 다음에만 `session_
> prepared_selections.status`를 `pinned`로 전이한다 — 한 트랜잭션.
>
> **제품 오너가 지목한 핵심 구멍(이번 Task 2가 닫음):** Task 1의
> `session_prepared_selections` "담당 선생님/관리자만 쓰기" 정책은 블랭킷 `for
> all` 정책이라 `status='pinned'`로의 직접 UPDATE까지 허용했다 — 즉 선생님이
> `pin_session_selection()`을 전혀 거치지 않고
> `update session_prepared_selections set status='pinned'`만 실행해도 막을
> 방법이 없었다(매니페스트 0행인 채로 "pinned" 세션이 만들어지는 결과). 고른
> 해법(옵션 b, 컬럼 값 기반 WITH CHECK 좁히기): 정책의 `with check`에 `and
> status <> 'pinned'`를 추가해 ordinary role의 UPDATE/INSERT 자체가 새 행의
> status를 `'pinned'`로 만드는 것을 RLS 레벨에서 통과시키지 않는다.
> `pin_session_selection()`은 SECURITY DEFINER(함수 소유자 권한, RLS 완전
> 우회)로 실행되므로 이 좁힌 정책의 영향을 받지 않는다. 지난 corrective가
> 증명했듯 세션/트랜잭션 로컬 GUC 마커 방식은 어떤 역할이든 스스로 SET할 수
> 있어 안전하지 않다고 판단해 채택하지 않았다.
>
> **`app/session/[id]/session-content-data.ts`(신규):** `loadSessionContentManifest()`가
> `session_content_manifest`만 읽고(키워드/단원 조인 없음, staged 콘텐츠
> 테이블도 읽지 않음), `curriculum_doc_section_keywords_selectable`/
> `problem_keywords_selectable`에 "이 content_id에 대한 행이 존재하는가"만
> 확인하는 표시 시점 가시성 게이트를 건다. 게이트 탈락 행은 반환에서만
> 제외되고 매니페스트 테이블 자체는 절대 변경하지 않는다(선생님/학생 세션-뷰가
> 이 리더 하나를 공유).
>
> **`app/teacher/session-prep-actions.ts`에 `pinSessionSelection` 추가:**
> 앱 레벨에서는 로그인 여부만 확인하고 `pin_session_selection` RPC 호출·에러
> 전달만 한다 — 의도적으로 중복 선인가를 두지 않는다(실제 인가는 전부 DB
> 함수 본문 안에서).
>
> **테스트:** `app/teacher/session-content-manifest.integration.test.ts`(신규,
> psql 직접 검증, 18개) — (a) staged+included 정확한 freeze (b) pin 후 새로
> 발행된 매칭 콘텐츠 미포함 (c) pin 후 정규 키워드 관계 변경 무영향 (d) pin
> 후 unpublish/unconfirm돼도 매니페스트 행 자체는 원본 유지(표시 게이트만
> 숨김) (e) staged 상태에서도 ordinary teacher-role 직접 INSERT/UPDATE/DELETE
> 전부 거부(permission denied) (f) pick 후 pin 전 unpublish된 항목이 있으면
> 전체 pin 실패+매니페스트 0행 (g) final_status가 scheduled 아니면 pin 거부
> (h) 키워드 범위 매칭되지만 pick 안 됐거나(또는 excluded) 후보는 매니페스트에
> 없음 (i) staged+included 밖 콘텐츠에 대한 매니페스트 행 없음 (j) 권한
> 매트릭스: 담당 선생님(성공)/관리자(별도 경로 성공)/무관한 선생님(실패,0행)/
> 과거 배정이었으나 현재 비활성인 선생님(실패,0행)/학생(실패,0행)/미부착
> sessionId(실패, 0c 증명)/세션-선택 subject_enrollment_id 불일치(실패, 0d
> 증명) (k) EXECUTE는 authenticated에게만·PUBLIC에는 없음, search_path 고정
> (information_schema/pg_proc 조회) (l, 이번 corrective의 핵심) ordinary
> teacher-role의 직접 `UPDATE ... SET status='pinned'`가 거부되고 매니페스트도
> 0행으로 남음. 또한 `app/teacher/session-prep-actions.test.ts`에 mocked
> `pinSessionSelection` 3개(미로그인 거부, RPC 위임, DB 에러 전달) +
> `app/session/[id]/session-content-data.test.ts`(신규, mocked, 표시 시점
> 가시성 게이트 필터링 2개) 추가. Task 1의
> `session-prepared-selection.integration.test.ts`의 두 "pin 이후 잠금" 테스트는
> 이제 status를 직접 UPDATE로 시뮬레이션하지 않고 실제
> `pin_session_selection()`을 통해 pin한다(Task 2가 직접 UPDATE 경로 자체를
> 막았으므로).
>
> **검증:** `supabase db reset --local`(클린, corrective 포함), `npx tsc
> --noEmit`(클린), `npx vitest run --no-file-parallelism`(전체 스위트, 회귀
> 없음), `npx next build`(클린). Task 3(사용 처리 이벤트)/Task 4(과제 구성)는
> 착수하지 않았다 — 각각 별도 제품 오너 승인 후 진행한다.
>
> **2026-09-07(R9 레슨 준비 Task 1 corrective — pin-lock bypass 보안 결함 수정,
> Task 2~4는 여전히 착수하지 않음).** 발견된 문제: 직전 라운드(Task 1)가 도입한
> `session_prepared_selections`/`session_prepared_selection_units`/
> `_unit_keywords`/`_content_items`의 pin-lock 트리거
> (`check_prepared_selection_not_pinned_self()`,
> `check_prepared_selection_not_pinned()`)가 테스트/운영 정리용으로 둔
> `app.bypass_prepared_selection_lock` 커스텀 GUC 분기를, "앱 코드 어떤
> 역할에도 이 GUC를 설정할 권한/그랜트를 주지 않는다(superuser psql로만 설정
> 가능)"는 잘못된 가정 아래 남겨두고 있었다 — 실제로는 플레인 SQL로 선언한
> 커스텀 GUC는 GRANT/REVOKE 대상이 아니며 `authenticated`를 포함한 어떤 롤이든
> 자기 세션에서 `SET app.bypass_prepared_selection_lock = 'true'` 한 줄로 pin된
> 행과 하위 3개 테이블 전체의 불변식을 완전히 무력화할 수 있었다. 즉 Task 1이
> 약속한 "pin 이후 불변" 보장이 실질적으로 존재하지 않았다.
>
> **수정:**
> `supabase/migrations/20261236000000_r9_corrective_remove_pin_lock_bypass.sql`
> (additive — 원본 `20261232000000_r9_session_prepared_selection.sql`은 건드리지
> 않음)이 두 트리거 함수에서 bypass 분기를 완전히 제거했다. 이제 pin-lock에는
> 설정 가능한 어떤 탈출구도 없다(오직 service_role만 Postgres 자체 권한 모델로
> 우회 가능 — 이는 GUC가 아니라서 앱 코드가 흉내낼 수 없다).
> `app/teacher/session-prepared-selection.integration.test.ts`의 cleanup도
> 함께 고쳤다 — bypass에 의존해 pinned 행을 지우는 대신, pinned 행을 만든
> 테스트의 contract id를 `excludeFromCleanup()`으로 `afterEach` 정리 대상에서
> 빼고 `supabase db reset --local`(CLAUDE.md UAT 정리 관례)에 맡긴다. 새 관리자
> 우회 메커니즘은 추가하지 않았다.
>
> **회귀 테스트 추가:** "app.bypass_prepared_selection_lock GUC를 설정해도
> pin-lock을 더 이상 우회할 수 없다(우회 경로 완전 제거 확인)" —
> pin된 selection에 대해 `SET app.bypass_prepared_selection_lock = 'true'`를
> 명시적으로 실행한 뒤 selection 자체(UPDATE/DELETE)와 자식 테이블
> (`session_prepared_selection_units`의 INSERT/DELETE,
> `session_prepared_selection_content_items`의 UPDATE/DELETE) 변경을 시도해도
> 전부 "핀 완료된…" 예외로 거부됨을 증명한다(이전 라운드의 "pin 이후 잠금"
> 테스트는 bypass를 쓰지 않은 정상 경로만 확인했었다 — bypass 자체가 무력화됐는지는
> 검증하지 않았었다).
>
> **검증:** `supabase db reset --local`(클린 적용, corrective 마이그레이션
> 포함), `npx tsc --noEmit`(클린), `npx vitest run --no-file-parallelism`
> (전체 214개 파일/1459개 테스트 통과 — 새 회귀 테스트 포함, 기존 pin-lock
> 테스트도 새 cleanup 방식으로 계속 통과), `npx next build`(클린).
>
> **2026-09-07(레슨 준비/세션 선택 계획 Task 1만 — Task 2~4는 착수하지 않음)
> 준비된 선택(prepared selection) 스테이징 스키마.** 배경:
> `docs/superpowers/plans/2026-09-08-lesson-prep-session-selection.md`(v4,
> 승인됨) Task 1만 구현 지시 — Task 2(불변 세션 콘텐츠 매니페스트 +
> `pinSessionSelection()`), Task 3(사용 처리 이벤트), Task 4(과제 구성)는 각각
> 별도 제품 오너 승인 후 착수 예정이며 이번 라운드에서 손대지 않았다.
>
> **추가:** `supabase/migrations/20261232000000_r9_session_prepared_selection.sql`
> — `session_prepared_selections`(staged/pinned/archived, `session_id` nullable
> = 임시보관함, 세션당 archived 아닌 선택 최대 1개를 유니크 부분 인덱스로 강제),
> `session_prepared_selection_units`(준비된 선택당 복수 `curriculum_overlay_units`,
> 순서 있음), `session_prepared_selection_unit_keywords`(단원별 활성 키워드
> 부분집합 — 그 단원의 `curriculum_overlay_unit_keywords`의 부분집합인지 INSERT
> 트리거가 검사), `session_prepared_selection_content_items`(실제 pin되는
> 페이로드 — 선생님이 명시적으로 pick/exclude(soft, `included=false`)/order한
> 교재 조각·문제 목록. INSERT 시점 트리거가 이 선택의 단원/키워드 범위 안에서
> `curriculum_doc_section_keywords_selectable`/`problem_keywords_selectable`를
> 통과하는지 검사 — 통과 못 하면 애초에 담기지 않는다). Pin-lock은
> `20261219000000_r8_material_version_lock.sql`과 동일한 predicate 형태
> (`OLD.status = 'pinned'`이면 이후 UPDATE/DELETE 전면 거부)를 4개 테이블 전부에
> 적용했고, attach 시 대상 세션이 같은 `subject_enrollment_id`인지·아직
> `scheduled`인지 별도 트리거로 검사한다. 재정렬은
> `reorder_curriculum_overlay_units`(Task 3)와 동일한 원자적 다중-행 position
> 재배정 RPC(`reorder_prepared_selection_content_items`) 하나로 묶었다. 테스트
> cleanup 전용 bypass GUC(`app.bypass_prepared_selection_lock`)를 R8 lock과
> 같은 관례로 추가했다(앱 코드 어떤 역할에도 grant하지 않음).
>
> **추가:** `app/teacher/session-prep-data.ts`(`loadHeldSelections`,
> `loadSessionSelection`, `loadEligibleContentForSelection` — 뷰만 읽고
> 관계 테이블을 직접 읽지 않음), `app/teacher/session-prep-actions.ts`
> (`createPreparedSelection`, `addUnitToSelection`, `removeUnitFromSelection`,
> `setSelectionActiveKeywords`, `pickContentItem`, `excludeContentItem`,
> `includeContentItem`(재포함 — Task 1 체크리스트의 "제외를 되돌릴 수 있다"
> 요구를 위해 자연스러운 반대짝으로 추가), `reorderContentItems`,
> `attachSelectionToSession`, `detachSelectionFromSession` — 인가는
> `student-curriculum-actions.ts`의 `requireAssignedTeacherOrAdmin` 패턴을
> 그대로 재사용, 새 메커니즘 없음).
>
> **검증 매핑:** `app/teacher/session-prepared-selection.integration.test.ts`
> (psql 직접 검증, 19개 테스트)가 Task 1 체크리스트의 각 항목을 증명한다 —
> 미부착/부착-미핀 상태에서 다중 단원+단원별 키워드 부분집합 생성·편집, 키워드
> 부분집합 위반 거부, 콘텐츠 pick→소프트 제외→재포함→원자적 재정렬, 선택
> 불가능(draft)/범위 밖 콘텐츠의 INSERT 시점 거부, attach로 `session_id` 설정,
> 다른 학생/과목 세션 attach 거부, detach 시 행·콘텐츠 유지하며 임시보관함
> 재등장, **동시 attach 2건 중 정확히 1건만 성공**(service-role
> `supabase-js` 클라이언트 `Promise.all` — 동기 psql로는 재현 불가하여 기존
> corrective 1 동시성 테스트와 동일한 패턴), pin 이후 단원/키워드/콘텐츠
> 추가·제거·재정렬·detach 전부 트리거 거부, 담당 아닌 제3자 선생님 RLS 거부,
> 학생 조회 자체 불가(빈 결과), `vocab_words` 무관 FK/트리거 0건.
> `app/teacher/session-prep-actions.test.ts`(mocked, 9개 테스트)는 인가 위임과
> RPC 단일 호출을 확인한다. 실행: `supabase db reset --local`(클린 적용),
> `npx tsc --noEmit`(클린), `npx vitest run --no-file-parallelism`(전체
> 214개 파일/1458개 테스트 통과 — 회귀 없음), `npx next build`(클린).
>
> **미완료(다음 단계, 별도 승인 대기):** Task 2(`session_content_manifest` +
> `SECURITY DEFINER pinSessionSelection()`), Task 3(사용 처리 이벤트), Task 4
> (과제 구성 두 토글). Task 1은 `pinSessionSelection()` 자체를 구현하지
> 않았다 — 스테이징이 `status='staged'`로 완전히 채워지고 세션에 attach된
> 상태까지만 만든다.

> **2026-09-07(R9 정정 라운드 — 제품 오너 지시 corrective 1/2) 오버레이
> 최초 베이스라인 시딩 + 키워드 태깅/공개 게이트 분리.** 배경: 제품 오너가
> Task 1(`44125f0`)/Task 3(`63f5f57`)를 리뷰하고 두 가지를 명시적으로
> 잘못됐다고 지적, 후속 계획(레슨 준비 등) 착수 전 이 두 건만 로컬에서
> 교정·검증하라고 지시(원격 Supabase push, Vercel Preview 배포, UAT 계정
> 생성, 실제 외부 API 호출은 이번 라운드에서 전부 금지 — 전부 로컬만).
>
> **Corrective 1 — 오버레이 최초 베이스라인.** 문제:
> `app/teacher/student-curriculum-actions.ts`의 `ensureActiveOverlay()`가
> 빈 오버레이 껍데기만 만들었다(스펙 §4 "추가·제외·재정렬·진도 레이어" 취지
> 위반 — 레이어를 얹을 기본 원본 자체가 없었다). 조치:
> `supabase/migrations/20261230000000_r9_corrective_overlay_baseline_seed.sql`에
> `ensure_active_curriculum_overlay(subject_enrollment_id)` 단일 plpgsql
> 함수를 추가 — 오버레이 생성과 "과목의 기본 `subject_template_units` 전체를
> `source_unit_id` 참조로 시딩 + 시딩 시점 `subject_template_unit_keywords`를
> `curriculum_overlay_unit_keywords`로 스냅샷 복사"를 하나의 트랜잭션으로
> 묶었다. 동시성/멱등성은 이 코드베이스의 기존 "ensure singleton row" 패턴
> (R5 `20260925010000_r5_subject_thread_auto_create.sql`의 unique index +
> `on conflict ... do nothing`)을 그대로 따르고, 여기에
> `subject_enrollment_id` 단위 advisory xact lock을 더해 동시/재시도 호출을
> 직렬화했다. `app/teacher/student-curriculum-actions.ts`의
> `ensureActiveOverlay`는 이제 이 RPC 호출 하나로 대체(직접 insert 제거).
> **검증 매핑:**
> `app/teacher/student-curriculum-overlay.integration.test.ts`의
> "ensure_active_curriculum_overlay — 최초 베이스라인 시딩" describe 블록 4개
> 테스트가 각각 (a) 첫 호출 시 과목 기본 단원 수만큼 정확히 시딩되고
> `source_unit_id`가 정본을 참조하며 정본 테이블 자체는 안 바뀜, (b) 시딩
> 시점의 단원 기본 키워드가 스냅샷 복사됨, (c) 이미 활성 오버레이가 있으면
> 재호출해도 재시딩 없이 같은 id 반환, (d) **실제 동시성**(service-role
> `supabase-js` 클라이언트로 8개 `Promise.all` 동시 호출 — 동기 psql
> 프로세스로는 재현 불가하여
> `parent-home-lessons-parallel-regression.integration.test.ts`와 동일하게
> 진짜 비동기 REST 호출 사용) 이후에도 활성 오버레이 정확히 1개 + 베이스라인
> 단원 정확히 N개(= N×8이 아님)만 존재함을 각각 증명한다.
> `app/teacher/student-curriculum-actions.test.ts`의 새 describe
> "ensureActiveOverlay — corrective 1"은 mocked 클라이언트로 이 함수가
> `ensure_active_curriculum_overlay` RPC를 정확히 1번만 호출하고 그 결과를
> 그대로 반환하며, 담당이 아닌 선생님이면 RPC 자체를 호출하지 않고 거부됨을
> 증명한다.
>
> **Corrective 2 — 키워드 태깅과 공개/확정 게이트 분리.** 문제: Task 1
> 트리거가 "관계가 존재한다"와 "지도용으로 선택 가능하다"를 혼동했다 —
> draft 섹션/미확정 문제는 애초에 태깅 자체가 막혀 있었고(저작 편의 기능이
> 공개 게이트가 돼버림), unpublish/unconfirm 시 관계 행 자체가 삭제됐다
> (관리자가 오탈자 수정 등으로 잠깐 draft로 되돌리면 태깅 결과가 통째로
> 사라짐). 조치:
> `supabase/migrations/20261230010000_r9_corrective_keyword_publish_gate.sql`에서
> (1) `cleanup_section_keywords_on_unpublish`/`cleanup_problem_keywords_on_unconfirm`
> 트리거·함수를 완전히 제거(관계 보존), (2)
> `check_section_keyword_published`/`check_problem_keyword_confirmed`를
> 존재·과목 일치 검사만 남기고 published/confirmed 게이트를 제거(태깅은
> draft/미확정 콘텐츠에도 허용), (3) 읽기 시점 선택 가능 게이트로
> `curriculum_doc_section_keywords_selectable`/`problem_keywords_selectable`
> 뷰(둘 다 `security_invoker=true`로 기저 테이블 RLS 상속)를 신설 — 향후
> "선생님이 실제로 고를 수 있는 콘텐츠" 쿼리는 관계 테이블이 아니라 이
> 뷰를 읽어야 한다. `curriculum_overlay_unit_materials`의 자체
> published-교재 게이트(Task 3, 별도 트리거)는 이미 올바른 쓰기측 게이트라
> 손대지 않았다. **검증 매핑:**
> `app/admin/curriculum-content-foundation.integration.test.ts`의 새 describe
> "선택 가능(teaching-selectable) 게이트는 쓰기가 아니라 읽기 시점(뷰)에
> 있다"에서 4개 테스트가 각각 (a) draft 섹션에 태깅이 **성공**하지만
> `curriculum_doc_section_keywords_selectable`에는 안 보임, (b) 미확정
> 문제에 태깅이 **성공**하지만 `problem_keywords_selectable`에는 안 보임을
> 증명하고, 제품 오너가 지정한 정확한 회귀 시나리오 2개("draft 태깅 →
> unpublish/unconfirm해도 관계가 DB에 그대로 남음 → 선택 가능 뷰에는
> 미노출 → publish/confirm하면 **재태깅 없이** 같은 관계가 뷰에 나타남")를
> 섹션·문제 양쪽에서 각각 증명한다.
>
> **검증:** 두 마이그레이션 적용 후 `supabase db reset --local` 성공(클린
> 적용), corrective별로 각각 `supabase db reset --local` + 해당 통합
> 테스트 통과를 먼저 확인한 뒤 커밋(로컬 커밋 2개, corrective 1개당 1개
> 커밋 — 번들 금지), 마지막에 신선한 `db reset --local` 직후 전체
> `tsc --noEmit`(clean) + 전체 `vitest run --no-file-parallelism`(212
> files / 1436 tests 전부 통과) + `npx next build`(clean) 각 1회 실행. 이
> 라운드는 로컬(`supabase db reset --local`, 로컬 Vitest, 로컬
> `next build`)만 사용 — 원격 Supabase migration push, Vercel Preview 배포,
> UAT 계정 생성, 실제 외부 API/이메일 호출 전부 없음(`git push` 없음, 별도
> merge 없음). R8/R10/화이트보드(session-view) 파일은 손대지 않음. 후속
> 계획(레슨 준비/세션 문제 선택/과제 구성) 착수는 이번 라운드 범위 밖 —
> 시작하지 않음.
>
> **2026-09-07(R9 corrective 1 추가분) 오버레이 베이스라인 시딩에 단원별
> 참고 교재 누락분 보강.** 배경: 바로 위 corrective 1
> (`ensure_active_curriculum_overlay`)이 단원·키워드는 시딩했지만 단원별
> 참고 교재(`subject_template_unit_materials`)는 빠뜨려, 방금 만들어진
> 오버레이를 선생님이 열어보면 단원마다 교재 구성이 비어 보이는 문제가
> 남아 있었다. 조치: 기존 마이그레이션 파일을 고치지 않고 새 additive
> 마이그레이션
> `supabase/migrations/20261231000000_r9_corrective_overlay_baseline_materials.sql`을
> 추가해 `ensure_active_curriculum_overlay()`를 `create or replace`로
> 확장 — 같은 트랜잭션 안에서 각 베이스라인 단원의 `source_unit_id`가
> `subject_template_unit_materials`로 연결한 교재 중 시딩 시점
> `curriculum_docs.status = 'published'`인 것만 `curriculum_overlay_unit_materials`로
> 복사한다(draft 교재는 SELECT 필터에서부터 제외되고, Task 3의
> `check_overlay_unit_material_published` 트리거가 이중으로 막는다 —
> corrective 2가 그대로 둔 그 쓰기측 게이트를 존중). 잠금/멱등성은 corrective
> 1의 advisory xact lock + 활성 오버레이 조기 반환 로직을 그대로 재사용(별도
> 동시성 방어를 새로 만들지 않음 — 같은 함수/트랜잭션 안이므로 이미 커버됨).
> **검증 매핑:**
> `app/teacher/student-curriculum-overlay.integration.test.ts`의
> "ensure_active_curriculum_overlay — 최초 베이스라인 시딩" describe에 추가된
> 4개 테스트가 각각 (1) 첫 호출 시 각 베이스라인 단원의 published 참고 교재가
> 정확한 개수로(단원별 정확히 매칭, 과목 전체 합계와도 일치) 시딩됨, (2)
> published/draft가 섞여 있으면 draft는 절대 시딩되지 않고 published만
> 남음, (3) 8-way 동시 호출(`Promise.all`, service-role `supabase-js`)해도
> 참고 교재 행이 N×8이 아니라 정확히 N(과목 전체 published
> `subject_template_unit_materials` 행 수)으로 수렴함, (4) 오버레이가 이미
> 만들어진 뒤 canonical `subject_template_unit_materials`에 새 교재를
> 추가해도 이미 시딩된 학생 오버레이의 `curriculum_overlay_unit_materials`
> 행 개수·내용이 전혀 바뀌지 않음(재호출은 활성 오버레이 조기 반환으로
> 재시딩하지 않음)을 각각 증명한다.
>
> **검증:** `supabase db reset --local`(클린 적용) 후 대상 통합 테스트 24/24
> 통과(신규/확장 4개 포함) 확인 → 신선한 `supabase db reset --local` 직후
> 전체 `npx vitest run --no-file-parallelism`(**212 files / 1439 tests 전부
> 통과**) → `npx tsc --noEmit`(clean) → `npx next build`(clean, 정적 페이지
> 생성 포함) 각 1회 재확인. 이번 라운드도 로컬만 사용 — 원격 Supabase
> migration push, Vercel Preview 배포, UAT 계정 생성, 실제 외부 API 호출,
> `git push`, 별도 merge 전부 없음. corrective 2(published/confirmed
> selectable 게이트) 로직은 읽기만 하고 손대지 않았고, 후속 계획(레슨
> 준비/세션 문제 선택/과제 구성) 착수도 시작하지 않았다.
>
> **2026-09-07(R9 Acceptance gate 검증) 커리큘럼 콘텐츠 기반 계획서의
> Acceptance gate 4개 항목을 실제 DB 통합 테스트로 증명.** 배경:
> `docs/superpowers/plans/2026-09-07-curriculum-content-foundation.md`의
> Task 1–4(`44125f0`/`505d05b`/`63f5f57`/`5bea813`/`b2bb6d7`)는 이미
> 구현·커밋됐지만, 후속 계획(레슨 준비/세션 문제 선택/과제 구성) 착수 전
> "Acceptance gate" 4개 주장을 실제 DB 통합 테스트로 증명하라는 요구가
> 남아 있었다. 이번 라운드는 검증 전용이며, 4개 주장 모두 기존 구현이 이미
> 충족하고 있음을 확인했다(스키마/트리거 교정 불필요, 테스트 커버리지만
> 보강). (1) 미공개 교재/미확정 문제가 지도용 관계에 못 들어가는 것 —
> `app/admin/curriculum-content-foundation.integration.test.ts`에 이미
> 정확히 커버돼 있어 그대로 재확인만 함. (2) 선생님의 오버레이 조작(공개
> 단원 추가·보강 단원 조립, 참고 교재·키워드 연결 포함)이 정본 테이블을
> 전혀 바꾸지 않는 것 — `app/teacher/student-curriculum-overlay.integration.test.ts`에
> `curriculum_docs`/`curriculum_doc_sections`/`problems`/
> `subject_template_units`/키워드 테이블 8개 전부의 (행수, md5 체크섬)을
> 조작 전후로 비교하는 새 테스트 2개를 추가해 0 diff를 증명. (3) 학생이
> 다른 학생의 오버레이/오버레이 단원을 조회할 수 없는 것 — 같은 파일에
> 무관한 제3자 학생(seed `cccccccc-...002`)으로 조회 시도 시 빈 결과가
> 나옴을 확인하는 새 테스트 추가(본인 오버레이는 읽기 전용으로 볼 수
> 있다는 기존 테스트와 대비). (4) 기존 개인 단어장(`vocab_words`)이 R9
> 키워드 작업에 전혀 영향받지 않는 것 — 같은 파일에 (a) R9가 추가한 8개
> 키워드/오버레이 테이블 중 어느 것도 `vocab_words`를 참조하는 FK/트리거가
> 없음을 확인하는 테스트, (b) 키워드 생성·오버레이 조작을 한 차례 수행해도
> `vocab_words` 행수/체크섬이 그대로임을 확인하는 테스트를 추가. 검증:
> `supabase db reset --local` 성공, 새 테스트 포함
> `student-curriculum-overlay.integration.test.ts`(17개 전부 통과) +
> `curriculum-content-foundation.integration.test.ts`/
> `student-curriculum-actions.test.ts`/`student-curriculum-data.test.ts`
> 재확인 통과, 전체 `tsc --noEmit` + 전체 `vitest run --no-file-parallelism`
> + `next build` 1회씩 통과(정확한 파일/테스트 수는 이 섹션 하단 실행
> 로그 참고). 후속 계획 착수 패키지는
> `docs/superpowers/specs/2026-09-08-lesson-prep-session-selection-kickoff.md`에
> 별도 문서로 작성(계획 전용, 코드/마이그레이션 없음). R8/R10/화이트보드
> 파일은 손대지 않음(참조용 조사만 수행).
>
> **2026-09-07(R9 Task 3 UI 배선) `StudentCurriculumPanel`을 선생님 포털
> 네비게이션에 실제로 연결.** 배경: R9 Task 3(`63f5f57`)가 학생 운영
> 커리큘럼 오버레이(스키마+데이터 로더+액션+패널 컴포넌트, 테스트 포함)를
> 완성했지만, 그 라운드의 최종 보고 자체가 "패널이 선생님 포털 네비게이션에
> 연결되지 않았다"고 지적했다. 이번 작업은 그 배선만 추가한다(스키마·RLS·
> 서버 액션 로직은 미변경). 새 진입점: "배정" 탭(`AssignmentsTab`)의 각
> 담당 학생·과목 카드에 기존 "커리큘럼 보기"와 나란히 "운영 커리큘럼 관리"
> 버튼을 추가했다 — `teacher_assignments`/`subject_enrollments` 기반이라
> Task 3 스키마의 `subject_enrollment_id`와 정확히 맞아떨어지는 유일한
> 기존 화면이라 여기를 선택했다(레거시 `enrollments` 기반 "커리큘럼" 탭의
> 학생별 상세와는 별개 ID 공간). 클릭하면 `TeacherShell`이 "커리큘럼" 탭으로
> 전환하며 `CurriculumTab`에 새 `operatingCurriculumJumpTo` 상태를 전달하고,
> `CurriculumTab`은 새 `StudentCurriculumOperatingView`(내부 컴포넌트)를
> 렌더링한다. 이 뷰는 새 서버 액션 `loadStudentCurriculumPanelData(subjectEnrollmentId,
> subjectId)`(`app/teacher/student-curriculum-actions.ts`)로만 데이터를
> 가져오는데, 이 함수는 기존 `requireAssignedTeacherOrAdmin`을 그대로
> 재사용할 뿐 새 인가 로직을 추가하지 않는다 — 담당 배정이 아니면 RLS와
> 앱 레벨 체크가 그대로 막고, 화면은 에러 메시지만 보여준다(원본 데이터
> 유출 없음). 테스트: `AssignmentsTab.test.tsx`(새 버튼→콜백), `CurriculumTab.test.tsx`
> (jump로 진입 시 로더 호출 및 패널 렌더, 담당 아닌 경우 에러 표시),
> `student-curriculum-actions.test.ts`(새 로더의 담당-아님 거부). 검증:
> `supabase db reset --local` + 전체 `tsc --noEmit` + 전체
> `vitest run --no-file-parallelism`(212 files / 1425 tests 통과) + `next build`
> 모두 통과. 세션/화이트보드, R10 정산 파일은 손대지 않음.
>
> **2026-09-07(테스트 위생) `lib/booking/payout-batch-lifecycle.integration.test.ts`
> 플레이키니스 수정 — 예약 시간대 충돌·잔여 데이터 정리.** 배경: 제품 오너가 R10
> payout 통합 테스트를 리뷰하면서 이 파일의 예약/세션 시각이 "40일 뒤 17:00"
> 같은 고정값이라 다른 로컬 예약이나 이전에 비정상 종료된 실행의 잔여 데이터와
> 충돌할 수 있다고 지적했다(실제 회귀는 아니고 테스트 위생 문제). 조사 결과
> `reservations_no_overlap`(GiST exclusion, teacher_id+시간범위) /
> `violates_teacher_buffer`(전후 15분) 두 DB 제약이 실제 충돌 지점이었고,
> `entitlement_ledger`가 INSERT-only(`reject_ledger_mutation` 트리거)라 그
> ledger가 참조하는 `reservations`(및 그 아래 `subject_enrollments`/
> `contracts`/`households`/`profiles`/`students`/`auth.users`)는 구조적으로
> 영구히 삭제할 수 없다는 것도 확인했다. 수정: (1) `bookAndCompleteSession()`이
> 이제 그날 이 파일 전용 TEACHER_ID에 실제로 잡혀 있는 예약을 DB에서 직접
> 조회해 버퍼까지 포함해 겹치지 않는 시각(`findFreeSlot()`, 150분 간격, 하루
> 최대 9슬롯)을 고른다 — 고정 시각 추측 대신 실제 DB 상태를 확인하므로 반복
> 실행해도 항상 안전하다(슬롯이 소진되면 조용히 깨지는 대신 명확한 예외를
> 던진다). (2) `afterAll()`이 실제로 삭제 가능한 데이터(payout_items/batches/
> audit_log, sessions+session_status_events, teacher_assignments+자동 생성되는
> subject_threads, teacher_availability_rules)를 FK 의존 역순으로 정리하도록
> 강화했다(이전에는 teacher_availability_rules만 지웠음). 검증:
> `supabase db reset --local` 후 이 파일을 reset 없이 9회 연속 실행해 전부
> 통과함을 확인(10회째부터는 해당 날짜의 슬롯이 소진돼 의도된 명시적 예외로
> 실패 — 무한 반복을 보장하진 않지만 실전에서 겪는 "reset 없이 몇 번 다시
> 돌리는" 시나리오는 확실히 해결됨). 애플리케이션 로직/마이그레이션/트리거는
> 손대지 않음(테스트 파일만 수정).
>
> **2026-09-07(R10 corrective) 제품 오너 리뷰 4건 수정 — paid 전이 가드,
> 역분개 재설계, 레거시 teacher_payouts 쓰기 완전 차단, 관리자 UI/DB 상태
> 불일치 정정.** 배경: R10 Task A/B/C(`1072dda`, `6cb8ee6`) 완료 후 제품
> 오너가 4가지 결함을 지적했고, 이번 라운드는 그 4건을 전부 고치는 순수
> 기술 corrective다(신규 기능 없음, DB additive migration만).
>
> **수정 1 — paid는 이제 provider_pending + provider_transaction_id +
> provider_confirmed_at(신규, 최종 성공 확인 시각) 세 조건이 모두 있어야만
> 성립한다.** 이전에는 `real_disbursement_enabled()`가 true이기만 하면
> `mark_payout_batch_paid()`가 approved/processing에서 곧바로 paid로 전이할
> 수 있었다(실제 Mercury/Wise 확인 없이 "지급 완료" 표시 가능). 신규 함수
> `mark_payout_batch_provider_confirmed()`가 provider_pending 상태 +
> provider_transaction_id 존재를 확인한 뒤에만 `provider_confirmed_at`을
> 채우고, `mark_payout_batch_paid()`는 이제 provider_pending 상태가 아니거나
> 두 확인 컬럼 중 하나라도 없으면 무조건 거부한다. **CHECK 제약
> `payout_batches_paid_requires_confirmation`/`payout_items_paid_requires_confirmation`**을
> 두 테이블에 추가해 이 불변을 함수 본문이 아니라 테이블 레벨에서도 강제한다
> — 다른 코드 경로(직접 UPDATE 등)로도 우회 불가함을 통합 테스트로 확인
> (마이그레이션 `20261224000000_r10_paid_transition_guard_and_reversal_fix.sql`).
>
> **수정 2 — `reverse_payout_item()`이 게이트 상태와 무관하게 항상
> approved에서 시작하도록 재설계.** 이전 버전은 게이트가 열려 있으면 "지금
> 열려있다"는 이유만으로 새 paid batch/item을 낙관적으로 만들었다(실제 송금
> 확인 없이). 이제는 항상 approved 상태로 새 batch/item을 만들고, paid까지
> 가려면 정규 payout과 동일한
> `dispatch_payout_batch → mark_payout_batch_provider_pending →
> mark_payout_batch_provider_confirmed → mark_payout_batch_paid` 파이프라인을
> 그대로 통과해야 한다.
>
> **수정 3 — `app/admin/payouts-cron.ts`가 이제 진짜 no-op이다.**
> `runGeneratePayouts()`는 `computePayoutAmounts()`로 금액만 계산해 반환하고
> `teacher_payouts`에 대한 select/insert/update/upsert/delete를 전혀 하지
> 않는다(파일에 "teacher_payouts" 문자열 자체가 없음). Route Handler
> (`app/api/cron/generate-payouts/route.ts`)는 이미 410 no-op이었고
> `vercel.json`의 cron 등록도 비어 있었지만(선행 라운드), 이 함수 자체에
> 쓰기 로직이 남아있다는 지적이 있어 완전히 제거했다. **회귀 가드**:
> `lib/legacy-teacher-payouts-write-guard.test.ts`가 `app/`·`lib/`·
> `supabase/migrations/` 전체를 정적으로 grep해 `teacher_payouts`에 대한
> INSERT/UPDATE/UPSERT/DELETE(Supabase 클라이언트 및 raw SQL 둘 다) 경로가
> 하나도 없음을 확인한다(허용목록은 비어 있음 — 새 write가 필요하면 이 테스트
> 부터 고쳐야 함이 강제됨). **DB 레벨 방어도 추가**: authenticated/anon
> 역할의 `teacher_payouts` insert/update/delete grant를 명시적으로 revoke
> (원래도 없었지만 회귀 방지 목적으로 재확인 REVOKE). service_role은
> Supabase 구조상 RLS/grant를 우회하므로 실제 차단선은 코드 레벨(no-op화)이고
> DB REVOKE는 심층 방어다.
>
> **수정 4 — `PayoutBatchesTab`의 "실패 처리" 버튼과
> `mark_payout_batch_failed()`의 허용 상태를 일치시켰다.** 기존 버튼은
> reviewing/reviewed 상태에서도 노출됐지만 DB 함수는 processing/approved만
> 허용해 에러가 났다. 검토 중 batch를 반려하는 것은 정상 업무 흐름이므로
> DB 함수의 허용 상태를 draft/calculated/reviewing/reviewed/approved(및 아직
> 이 화면에서 도달 불가한 processing/dispatch_requested/provider_pending)로
> 넓혔다 — paid는 여전히 절대 불가. 컴포넌트 전체를 감사해 다른 버튼
> (검토 제출/승인)은 이미 DB 허용 상태와 일치함을 확인했다.
>
> **통합 테스트**(`lib/booking/payout-batch-lifecycle.integration.test.ts`,
> 로컬 Postgres에 psql로 직접 검증, `supabase db reset --local` 후 전체
> 통과): (a) 게이트 닫힘 — processing/dispatch_requested/provider_pending/
> paid 전체 매트릭스 거부, (b) 게이트 열림 — provider_pending +
> transaction id + 최종 확인이 모두 있어야만 paid, 하나라도 없으면 거부(각
> 조합 개별 확인), (c) CHECK 제약이 함수 우회 직접 UPDATE도 구조적으로
> 거부, (d) 역분개가 게이트 열림/닫힘과 무관하게 항상 approved에서 시작하고
> 정규 파이프라인을 그대로 거쳐야만 paid가 됨, (e)
> `mark_payout_batch_failed`가 reviewing/reviewed에서도 실제로 동작.
> `lib/legacy-teacher-payouts-write-guard.test.ts`(레거시 쓰기 경로 0건 정적
> 확인) 및 `app/admin/PayoutBatchesTab.test.tsx`(상태별 실패 처리 버튼 노출
> 매트릭스, draft/calculated/reviewing/reviewed/approved=노출,
> paid/failed=비노출)도 추가.
>
> **범위 밖(의도적)**: 실제 Mercury/Wise API 클라이언트, webhook 핸들러는
> 여전히 레포에 없다(순수 상태머신·가드만). `mark_payout_batch_provider_confirmed()`를
> 실제로 호출하는 배선(webhook/재조회 대사 배치)도 다음 라운드(법인 설립
> 이후) 과제다.
>
> **2026-09-07(추가 8, R8 6/N) Shared Drive 폴더/권한 실패 재처리 큐(Gate C
> GW-12 인수 기준) 구현.** 배경: R8 체크리스트의 "폴더·권한·파일 이동 실패
> 재처리와 정기 대조" + Gate C GW-12("잘못된 fileId 등 Drive/Meet API 실패가
> 실제로 manual_review/reconciliation_needed 큐에 적재되고, 재처리 배치가
> 이를 정상 처리하는지")는 Gate C 자체 검증 범위 밖이라 이 R8 구현에서
> 다뤄야 했다. **구현**: 신규 테이블 `session_drive_tasks`(마이그레이션
> `20261220000000_r8_session_drive_provisioning_queue.sql`) — task_type
> `folder_provision`/`permission_grant`/`permission_revoke`, status
> `queued→processing→succeeded|retryable_failed|manual_review|reconciliation_needed`.
> `lib/drive-session-tasks.ts`가 `lib/drive-artifacts.ts`(R3, 계약서 Drive
> 업로드)와 동일한 조건부 UPDATE claim 패턴을 재사용 — 404/400(잘못된
> fileId 등 복구 불가능한 오류)은 `DriveReconciliationError`로 구분해 재시도
> 없이 즉시 `reconciliation_needed`로, 그 외 일시적 실패는 `retry_count`
> 누적 후 한도(5) 초과 시 `manual_review`로 전이한다. `queueSessionDriveTask`
> (큐 적재), `ensureSessionFolderPath`/`grantSessionFolderPermission`/
> `revokeSessionFolderPermission`(학생→과목→연도→세션 폴더 자동 생성 및
> 선생님 배정 권한 부여·회수 — 하드 세이프티 룰에 따라
> `DRIVE_ARTIFACTS_ALLOW_REAL_WRITES=true`가 아니면 항상 throw, 기존
> `lib/drive-artifacts.ts`가 이미 쓰던 플래그를 그대로 재사용하고 새 플래그를
> 만들지 않았다), `requeueSessionDriveTasks`(재처리 배치 — manual_review/
> reconciliation_needed 행을 관리자가 원인 해소 후 다시 queued로 되돌림)를
> 제공한다. **테스트**(`lib/drive-session-tasks.test.ts`, 7건, Drive
> fetch/Supabase admin 전부 모킹 — 실제 네트워크 호출 없음): (a) 404 응답 →
> 재시도 없이 즉시 reconciliation_needed 확인, (b) 일시적 실패 5회 초과 →
> manual_review 확인, (c) claim 경쟁 시 스킵, (d)
> `DRIVE_ARTIFACTS_ALLOW_REAL_WRITES` 꺼져 있으면 실제 fetch 호출 없이
> retryable_failed 처리, (e) **재처리 배치가 reconciliation_needed 항목을
> requeue한 뒤 재실행하면 실제로 succeeded로 전이함을 end-to-end로 확인**
> (Gate C GW-12 인수 기준 핵심). **아직 안 한 것**: 선생님 배정 이벤트
> (`teacher_assignments` insert/status 변경, `lib/enrollment/
> teacher-assignment-termination.ts`)에서 `queueSessionDriveTask`를 실제로
> 호출하는 배선은 아직 없다 — 큐/워커/재처리 자체는 완성·검증됐지만 "언제
> 큐에 넣는가"는 다음 라운드로 남긴다. Smart Notes 원본 이동, 실제 정기
> 대조(cron) 배선도 범위 밖.
>
> **동시 작업 확인(중요)**: 이 라운드 작업 중 같은 워킹트리에서 R8 사업
> 1(세션뷰↔v3 sessions/reservations 연결, `app/session/[id]/
> session-source-data.ts`, `page.tsx`, `SessionShell.tsx`, `material_version_id`
> 재배정 방지 트리거 `20261219000000_r8_material_version_lock.sql`,
> 문서 `docs/2026-09-07-r8-session-cutover-oneP-pager.md`)와 R10
> payout batch lifecycle(`20261218000000_r10_payout_batch_lifecycle.sql`,
> `lib/booking/payout-batch-lifecycle.integration.test.ts`)이 **다른 세션에
> 의해 이미 진행 중(미커밋)**이었다. 마이그레이션 타임스탬프가 두 번
> 충돌해(`20261218000000`, `20261219000000`) 새 타임스탬프로 옮겨 해소했고,
> 최초 작성했던 중복 함수(`pin_session_material_version` — 실제 배정
> 메커니즘을 이번 라운드에 구현하려던 것)는 그 세션이 이미 "실제 배정은
> R9 범위, 이번 라운드는 불변식 트리거만" 이라고 명시적으로 결정해 둔 것과
> 충돌해 **삭제**했다 — 이 문서의 R8 절과 별개로 그 세션이 자신의 변경을
> 직접 커밋할 것으로 보고 이 라운드에서는 건드리지 않았다(내 커밋
> `e9d357e`에는 `lib/drive-session-tasks.*`와 그 마이그레이션만 포함).
> `supabase db reset --local` + 전체 `vitest run`(1318건) + `tsc --noEmit`
> + `next build` 전부 통과 확인(그 세션의 미커밋 변경 포함한 상태 기준).
>
> **R8 체크리스트 잔여(다음 라운드)**: 필기 오버레이(좌표 정규화·실시간
> 전송·재접속 복구·동시편집 충돌·전체지우기 권한), Shared Drive 폴더
> 자동화의 실제 호출 배선(선생님 배정 이벤트 트리거), Smart Notes 폴더
> 이동, 서버 매개 파일 접근(학생/보호자 Drive ACL 없음) 강제, iPad 실기기
> QA·느린 네트워크/오프라인 시험(**이 환경에서는 애초에 수행 불가능** —
> 시뮬레이터가 아닌 실제 iPad/Apple Pencil 및 실제 네트워크 열화 조건을
> 이 세션의 도구로 재현할 방법이 없음. 명시적으로 스킵, 은폐 아님).

> **2026-09-07(추가 7) 지인/추천 발송 내역 목록 화면 신설 — 상담 카드가 없어서 발송 건을 다시 찾아볼 방법이 없던 설계 공백 해소.**
> 배경: "지인/추천 — 상담 없이 바로 계정 생성"(`DirectAccountCreationForm.tsx`/`direct-account-actions.ts`)과 그 링크의 재발송(`reissueDirectOnboardingLinkAction`)/학생 취소 기능은 이미 구현돼 있었지만, `DirectAccountCreationForm`은 발송 성공 시 토스트만 띄우고 폼을 닫아버리고 `TrialOnboardingLinkProgress.tsx`(발송 상태 조회, 이미 존재)는 상담 칸반 카드 상세에서만 마운트되는데 지인/추천 경로는 애초에 상담 카드가 없어 진입할 방법이 없었다 — 발송 건을 나중에 다시 찾아볼 목록 화면 자체가 없는 설계 공백.
> **구현**: `app/admin/direct-account-actions.ts`에 `listDirectOnboardingLinksAction()` 신설 — `trial_onboarding_links`에서 `consultation_id IS NULL`(지인/추천 경로)인 링크를 전부 조회하고, 딸린 `trial_onboarding_link_students`를 링크별로 집계(학생 수·계정생성/실패/취소 건수)해 함께 반환한다(기존 `TrialOnboardingLinkDetail`/`TrialOnboardingLinkStudent`는 링크 1건 상세용이라 재사용하지 않고, 목록+요약 전용 타입 `DirectOnboardingLinkSummary`를 새로 정의). 신규 컴포넌트 `app/admin/DirectAccountLinksList.tsx`(`UsersTab.tsx`의 "학부모" 서브탭, `DirectAccountCreationForm` 바로 아래)가 이 목록을 카드로 나열(보호자 이름·이메일, 발송 시각, 링크상태/발송상태 배지, 학생 수 및 상태 요약)하고, 각 카드 아래에 기존 `TrialOnboardingLinkProgress`를 그대로 마운트해(새로 안 만듦 — 그 컴포넌트 자체가 이미 "발송 내역 보기" 토글과 재발송/학생취소 버튼을 갖고 있음) 펼치면 상세를 볼 수 있게 했다. `DirectAccountCreationForm`은 발송 성공 시 새 `onSent` 콜백을 호출하고, `UsersTab.tsx`가 `DirectAccountLinksList`에 `ref`(`useImperativeHandle`로 노출한 `refresh()`)를 연결해 발송 직후 방금 만든 링크가 목록에 바로 나타나도록 refetch한다(실시간 구독 등 과한 로직은 넣지 않음).
> **검증**: `supabase db reset --local` 성공(스키마 변경 없음, additive migration 없음) / `npx tsc --noEmit` 0 에러 / 신규 통합 테스트 `app/admin/direct-account-links-list.integration.test.ts`(로컬 Postgres에 psql로 직접 지인/추천 링크 3건을 만들고 `listDirectOnboardingLinksAction()`이 읽는 쿼리 모양 그대로 재현 — `consultation_id IS NULL` 3건 전부 잡히고 학생 상태별 집계가 정확함을 확인; `requireAdminOrCapability()`가 admin 인증을 요구해 vitest에서 서버 액션을 직접 호출하기 어려워 다른 통합 테스트와 동일한 shell-out 패턴을 그대로 따름) / `npx vitest run`(전체) — DB를 새로 reset한 직후의 클린 실행 기준 199파일 중 198파일 통과·1306건 중 1305건 통과(실패 1건은 `lib/timezone-persistence.integration.test.ts`, 이번 변경과 무관한 기존 known flaky) — **주의**: 같은 세션에서 반복 실행하거나 이 브랜치를 동시 작업 중인 다른 세션이 DB를 재설정하는 시점과 겹치면 광범위한 무관 테스트가 한꺼번에 실패하는 것을 실측(예: `relation "lesson_types" does not exist`처럼 스키마 자체가 사라진 상태) — 코드 문제가 아니라 로컬 Postgres/시드 데이터 공유로 인한 환경 경합이므로, 신뢰 가능한 결과는 항상 `supabase db reset --local` 직후 1회 클린 실행 기준으로 판단해야 함. `npx next build` 성공.
> **금지 범위 준수**: 이 라운드는 다른 세션이 동시 작업 중이던 `app/admin/ConsultationKanbanBoard.tsx`/`app/admin/consultation-kanban-actions.ts`(동의 요청 메일)를 전혀 건드리지 않았다(커밋에도 미포함).

> **2026-09-07(추가 6) 관리자 "상담 운영" 탭 정리 — 레거시 UI 접기 + 공용 상담 가능시간 부분 시간 예외 지원(선생님 가능시간 패턴 이식).**
> 배경: 제품 오너가 관리자 "상담" 탭의 "상담 운영" 서브탭(`app/admin/ConsultationSchedulingPanel.tsx`)을 보고 2가지 지적. **다른 두 세션이 `ConsultationKanbanBoard.tsx`/`consultation-kanban-actions.ts`(동의요청 메일)와 `DirectAccountCreationForm.tsx`/`UsersTab.tsx`/`direct-account-actions.ts`/`DirectAccountLinksList.tsx`(발송내역)를 동시 작업 중이라 이 파일들은 전혀 건드리지 않았다.**
> **1) 레거시/디버그 UI 판단**: "Calendar 재처리 실행"/"Smart Notes 미매칭 재처리"와 "Workspace Events 구독 상태"(구독 상태 조회+"만료 임박 구독 갱신 실행"/"Smart Notes 사후 대조 실행"+정지·삭제)는 정상 운영 중에는 Calendar/Smart Notes 동기화·구독 갱신이 전부 자동으로 처리되고(위 M1/R6 Workspace Events 구독 수명주기 기록 참고, 만료 임박 자동 재시도 포함) 관리자가 평소에 볼 일이 거의 없는 실패 복구용 디버그/운영 도구라고 판단했다. 다만 **자동 재처리가 실패했을 때는 실제로 필요한 도구**이므로(과거 실패 사례가 실제로 기록돼 있음) 완전히 삭제하지 않고 각각 `<details>`(기본 접힘) "고급/운영 도구" 섹션으로만 이동했다 — 코드로 완전 죽은 것을 증명하지 못했으므로 안전한 쪽을 택함.
> **2) 공용 상담 가능시간 — 월캘린더 축소 + 부분 시간 예외**: `app/teacher/TeacherAvailabilityTab.tsx`/`lib/booking/slot-search.ts`의 `computeOpenWindowsForDate()`(순수 함수, 이미 이 브랜치에 구현돼 있었음) 패턴을 그대로 재사용했다. `consult_availability_exceptions.start_time`/`end_time` 컬럼은 원래(M1, `20261009000000_m1_consultation_unification.sql`)부터 있었고 `is_closed=true`여도 시간대 값을 저장할 수 있는 제약이었지만, **`list_open_consult_slots()`가 `is_closed` 예외 행이 있으면 start_time/end_time을 완전히 무시하고 그 날짜 전체를 닫아버리는 실제 버그**가 있었다(선생님 쪽 `is_teacher_slot_open()`은 이미 부분 시간 예외를 올바르게 지원 중이었음과 대조). `20261217000000_m4_consult_availability_partial_exceptions.sql`(additive, 컬럼 변경 없음, 함수 CREATE OR REPLACE만)로 정정 — 부분 휴무는 그 시간대만 제외, 부분 "임시 오픈" 예외는 실제로 후보 슬롯을 생성하도록 함께 고쳤다(기존엔 임시 오픈 값이 있어도 후보가 전혀 안 생겨 사실상 장식이었음). `app/admin/consultation-scheduling-actions.ts`의 `addConsultAvailabilityException()`도 `isClosed=true`일 때 start/end를 강제로 null 처리하던 로직을 제거해 부분 휴무 등록이 실제로 가능하게 했다. UI: `app/admin/ConsultAvailabilityMonthView.tsx`를 확장(월간 캘린더를 `max-w-[280px]`로 컴팩트화, 선생님 화면과 동일하게 날짜 클릭 → 그 날짜의 실제 오픈 시간대(`computeOpenWindowsForDate` 재사용) + 부분 시간대만 휴무/임시오픈 등록 폼 + 종일 휴무 버튼 추가), `app/admin/ConsultationSchedulingPanel.tsx`의 "예정 상담" 월간 캘린더도 동일 컴팩트 크기로 축소.
> **검증**: `supabase db reset --local` 성공(마이그레이션 63개 전부 정상 적용) / `npx tsc --noEmit` 0 에러 / **실제 DB 함수 호출 검증**: 신규 `lib/booking/consult-partial-time-exception.integration.test.ts` — 반복 규칙으로 매주 수요일 09~18시를 열어둔 뒤 예외 등록 전 09:00/12:00/17:00 슬롯 전부 열림 확인 → 12:00~13:00만 부분 휴무 등록 → `list_open_consult_slots()` 재호출로 12:00만 빠지고 09:00/11:00/13:00/17:00은 그대로 열려 있음을 실측 확인(2건 전부 통과). `npx vitest run`(전체) 199파일·1306건 중 4건만 실패(`lib/timezone-persistence.integration.test.ts` 1건 + `lib/booking/session-final-judgment.integration.test.ts` 3건 — 전부 이번 변경과 무관한 날짜 의존 기존 known flaky, consult 관련 파일 아님) / `npx next build` 성공. non-prod(`worpsqwqgnspddnrtnvq`)에 `20261217000000` 직접 push 예정(dry-run 후).
>

> **2026-09-07(추가 5) 관리자 칸반 "동의 요청 메일 발송" 버튼 추가 — Calendar 초대에만 있던 동의 확인 링크의 별도 채널.**
> 배경: 제품 오너가 실제 Preview 사용 중 발견 — 관리자가 "상담 결과 기록"을 하려면 보호자 동의(`consultations.consent_confirmed_at`)가 선행조건인데(`admin_record_consultation_outcome()`, `supabase/migrations/20261127000000_m4_consultation_outcome_smart_notes_config_gate_remove.sql` 31~33행), 이 동의 확인 링크는 지금까지 상담 확정 Calendar 초대(`lib/consultation/calendar-sync.ts`의 `issueConsentUrl()`) description에만 실려 있었다. 보호자가 초대를 놓치거나 삭제하면 관리자가 재확인을 요청할 방법이 없었다.
> **조사 결과**: 이 "동의"는 `guardian_consents`/`assert_guardian_consent_ok()`(R2/R3의 13세 미만 보호자 동의 게이트, 체험 세션 생성 시 별도로 체크됨)와는 **다른 동의**다 — `consult_consent_versions`/`consult_consent_tokens`/`consultations.consent_version_id`+`consent_confirmed_at`로 관리되는 "상담 진행(AI 회의록/Smart Notes 사용) 동의"이며, 만료형 토큰(`issue_consult_consent_token` RPC, service_role 전용)으로 상담 UUID를 노출하지 않고 `/consult/consent?token=...`(`app/consult/consent/page.tsx` + `app/consult-actions.ts`의 `getConsultConsentView`/`confirmConsultConsent`)에서 보호자가 1회 확인한다.
> **구현**: `app/admin/consultation-kanban-actions.ts`에 `sendConsentRequestEmailAction()` 신설 — Calendar 초대 경로와 동일한 토큰 발급(`issue_consult_consent_token`)과 동일한 확인 화면(`/consult/consent`)을 재사용해 별도 이메일로 링크만 다시 보낸다(Calendar 초대 안의 기존 링크는 건드리지 않음). 링크 URL은 `lib/request-origin.ts`의 `currentRequestOrigin()`으로 만든다(localhost 하드코딩 회귀 방지 — 19차 세션에서 반복 발견된 버그 클래스와 동일 원칙). 이미 `consent_confirmed_at`이 있으면 발송하지 않고 `already_confirmed` + 확인 시각을 반환한다. 실제 발송은 기존 SMTP 경로(`lib/email.ts`, `sendTrialOnboardingNoticeAction()`과 동일 패턴 — SMTP_HOST 미설정 환경에서는 실패로 처리됨)를 그대로 재사용하고, 새 발송 인프라는 만들지 않았다. 발송 이력은 새 테이블 없이 기존 INSERT-only 감사 로그(`consultation_status_events`, 상태 불변 이벤트)에 남긴다. `app/admin/ConsultationKanbanBoard.tsx`의 카드 상세에 `!consent_confirmed_at`일 때만 노출되는 "동의 요청 메일 발송" 버튼(`ConsentRequestButton`) 추가 — "상담 결과 기록" 섹션 바로 위.
> 검증: `supabase db reset --local` 성공(스키마 변경 없음, additive migration 없음) / `npx tsc --noEmit` 0 에러 / 신규 `app/admin/consultation-consent-request-email.test.ts` 4건(이미 동의 완료 시 발송 안 함, 미확인 시 토큰 발급+실제 요청 origin 반영 링크로 발송+감사 로그, sendEmail 실패 시 failed 반환, 상담 못 찾으면 failed) 전부 통과 / `npx vitest run`(전체) — 세부 결과는 아래 참고 / `npx next build` — 아래 참고. 스키마 변경이 없어 non-prod push는 불필요.

> **2026-09-07(추가 4) 관리자 칸반 "상담 결과 기록"(정규 진행 권장) — #441 마스킹 방지 방어 코드 추가(SQL 근본 원인은 재현 실패, 정직하게 기록).**
> 배경: 제품 오너가 관리자 상담 칸반 카드 상세에서 "상담 결과 기록" 드롭다운에 "정규 진행 권장"을 선택하고 리뷰 텍스트를 입력 후 "기록"을 누르면 "Minified React error #441"이 뜬다고 보고(체험 진행 권장은 정상). **로컬 psql로 `admin_record_consultation_outcome(p_outcome='regular_recommended', ...)`를 최소 조건(동의 확인 + 검토 요약만)/기존 연결된 학생(`child_id` 존재, 재상담 시나리오)/멱등 재호출 3가지 조건으로 각각 직접 호출해봤지만 전부 정상 성공했고(SQL 에러 재현 실패), 나아가 로컬 dev 서버(`localhost:3000`, 다른 세션이 띄워둔 프로세스)에 관리자로 실제 로그인해 칸반 카드에서 브라우저로 "정규 진행 권장" 선택 → 검토 요약 입력 → "기록" 클릭까지 실제로 재현했는데도 에러 없이 정상적으로 outcome이 기록되고 "계약" 칸으로 카드가 넘어갔다** — `trial_recommended` 경로(체험수업권 지급 실패는 함수 내부 `exception when others`로 흡수되어 함수 자체는 항상 성공 반환)와 비교해도 SQL 레벨에서 차이가 없었다. Next.js는 dev 모드에서 Server Action 예외를 마스킹하지 않으므로(production 빌드에서만 "Minified React error #441"로 치환) 이 로컬 재현으로는 프로덕션 마스킹 자체를 재관찰할 수 없다는 한계가 있다.
> **그럼에도 고친 것**: `app/admin/consultation-scheduling-actions.ts`의 `recordConsultationOutcome()`이 RPC 에러를 그대로 `throw`하고 있었다 — 이는 이 코드베이스에서 이미 여러 번(`workspace-actions.ts`/`trial-onboarding-actions.ts`/`lesson-schedule-actions.ts`) 확인된 "throw하면 production에서 #441로 마스킹된다"는 패턴과 동일한 리스크였다(outcome 값과 무관하게 어떤 이유로든 RPC가 실패하면 그대로 재발할 수 있는 잠재 위험). 이 프로젝트 표준 규칙에 맞춰 항상 `{ ok, error }`(예외 전파 없음)를 반환하도록 바꾸고, 호출부 2곳(`ConsultationKanbanBoard.tsx`의 `OutcomeForm`, `ConsultationSchedulingPanel.tsx`)도 결과를 체크해 에러 메시지를 화면에 그대로 보여주도록 맞췄다. 회귀 테스트 추가: `consultation-scheduling-actions.test.ts`(RPC 에러/성공/`requireAdmin()` 예외 3케이스가 전부 `{ ok, error }`로 정규화되는지), `ConsultationKanbanBoard.test.tsx`(OutcomeForm이 실패 시 예외 없이 에러 문구를 그대로 렌더링하는지, "Minified React error"가 나타나지 않는지).
> **미해결/추가 확인 필요**: SQL 근본 원인을 실측으로 특정하지 못했다 — 제품 오너가 실제로 겪은 케이스는 이번에 재현한 3가지 시나리오와 다른 데이터 상태였을 가능성이 있다(예: Preview/production 특유의 상태, 또는 dev 모드라 마스킹 자체가 재현되지 않는 환경 차이). Preview 배포(production 빌드)에서 동일 절차로 재현해보고, 여전히 발생하면 그때 실제 에러 메시지가 방어 코드 덕분에 화면에 그대로 노출될 것이므로 후속 조사가 훨씬 쉬워진다.

> **2026-09-07(추가 3) 관리자 "사용자" 탭 3건 — 레거시 학부모 초대 제거 / 지인·추천 링크 재발송·학생 취소 / 관리자 프로필 수기 수정.**
> 배경: 제품 오너가 "학부모 초대"를 눌렀다가 production에서 React #441(예외가 그대로 throw되어 Next.js가 원인을 마스킹 — `sendTrialOnboardingNoticeAction` 등에서 이미 고쳤던 것과 동일한 클래스)로 크래시 났고, "지인/추천"과 기능이 겹치니 예전 기능을 없애자고 지시. 추가로 지인/추천 폼에서 학생 이메일을 존재하지 않는 주소로 입력해도 "발송됨" 처리되는 문제와, "이메일 주소가 잘못됐을 때 수기로 수정할 수 있는 구조"의 필요성도 지적했다.
> **1. 레거시 "학부모 초대" 제거**: `UsersTab.tsx`의 학부모 초대 `InviteForm` UI와 `users-actions.ts`의 `inviteParent()`(account_invites 기반, 자녀 없이 보호자만 먼저 만드는 경로)를 완전히 삭제 — 다른 호출부가 없음을 grep으로 확인. `DirectAccountCreationForm`(지인/추천, 보호자+학생을 한 번에 만드는 `trial_onboarding_links` 기반 경로)이 완전한 상위 호환이라 UI는 그대로 두고, 관련 테스트(`UsersTab.test.tsx`/`users-actions.test.ts`)도 함께 정리.
> **2. 지인/추천 링크 재발송/학생 취소**: 이메일 형식 검증(`SIMPLE_EMAIL_RE`)은 이전 라운드에 이미 있었음(실제 이메일 존재 검증은 발송 없이 불가능해 범위 밖 유지). 기존 `reissueTrialOnboardingLinkAction()`(링크 폐기 후 재발급)이 `consultation_id`가 null인 지인/추천 링크에서는 상담 존재를 요구하는 RPC(`create_trial_onboarding_link_multi`)를 호출해 "상담을 찾을 수 없습니다: null"로 항상 실패하던 버그를 발견 — `direct-account-actions.ts`에 `create_direct_onboarding_link_multi` 기반 별도 구현(`reissueDirectOnboardingLinkAction`)을 추가하고 null 분기 시 위임하도록 수정. `trial_onboarding_link_students.status`에 `'cancelled'`를 추가(마이그레이션 `20261216000000`)하고 `cancel_trial_onboarding_link_student()` RPC + `cancelDirectOnboardingLinkStudentAction()`으로 학생 1명을 링크에서 취소할 수 있게 했다 — `finalize_trial_onboarding_students()`도 cancelled 학생을 건너뛰도록 재정의(계정/체험수업권 생성 대상에서 제외). `TrialOnboardingLinkProgress.tsx`에 "학생 취소" 버튼 추가, 재발급 폼도 취소된 학생을 제외하도록 수정.
> **3. 관리자의 사용자 정보 수기 수정**: `UsersTab.tsx` 보호자/학생 카드에 "수정" 버튼 + 인라인 편집 폼(이름/이메일, 학생은 학년도)을 추가. 새 서버 액션 `app/admin/user-edit-actions.ts`(`updateUserBasicInfo`)가 `admin.auth.admin.updateUserById()`로 `auth.users.email`을, `profiles.update`로 `name`을 함께 갱신 — 두 곳(profiles/auth.users) 모두 실제로 바뀌는지 mocked 유닛 테스트로 검증. 감사 로그는 `account_status_events` 같은 별도 테이블 대신 `profiles.admin_edited_by`/`admin_edited_at` 컬럼(같은 마이그레이션에서 추가)으로 최소화. 재확인 이메일 발송 등 Auth 표준 이메일 변경 정책은 범위 밖 — 관리자가 즉시 강제로 바꾸는 것까지만 다룸.
> **검증**: `supabase db reset --local` 성공(마이그레이션 `20261216000000_m4_admin_user_edit_and_link_student_cancel.sql`) / `npx tsc --noEmit` 0 에러 / `npx vitest run` 196개 파일 중 195개 통과·1294건 중 1292건 통과 — 실패 2건은 `lib/timezone-persistence.integration.test.ts`(내가 건드리지 않은 파일, 이번 변경과 무관)뿐. 신규 테스트: `app/admin/user-edit-actions.test.ts`(5건, mocked), `app/admin/trial-onboarding-link-student-cancel.integration.test.ts`(3건, 로컬 Postgres psql 직접 검증 — 취소→`finalize_trial_onboarding_students()` skip 흐름까지 확인). `npx next build`는 **이 세션이 작업하는 동안 다른 세션이 `app/admin/ConsultationSchedulingPanel.tsx`/`consultation-scheduling-actions.ts`를 동시에 수정 중이라 타입 에러(`RecordConsultationOutcomeResult`)로 실패** — 내가 만든 파일은 원인이 아님(그 두 파일은 커밋에 포함하지 않았고 손대지도 않음). 마이그레이션은 non-prod(`worpsqwqgnspddnrtnvq`)에 아직 반영 전(다음 단계).
> Preview 배포: 이 라운드 커밋(`72b69aa`, `ef68e66`, `7a10d28`)을 `preview/m4-integration-verification`에 push했다 — 동시 작업 중인 다른 세션의 미커밋 변경(`app/admin/ConsultationKanbanBoard.tsx`/`ConsultationSchedulingPanel.tsx`/`consultation-scheduling-actions.ts`, `app/parent/*`)은 전혀 건드리지 않았다.

> **2026-09-07(추가) 보호자 포털 "수업권" 탭이 실제 구매 후에도 "0장 보유"로 표시 — 버그 아님, UI 이름 충돌이 원인(수정 완료).**
> 배경: 제품 오너가 보호자 포털에서 학생 "세온장"에 대해 20개짜리 수업권 패키지를 Stripe(TEST)로 실제 구매했는데 "수업권" 탭에 "0장 보유"로 표시됐다.
> **원격 non-prod DB(`worpsqwqgnspddnrtnvq`) 실측 조사 결과 — Stripe 결제·서버 처리 자체는 전부 정상이었다**: `purchases` 테이블에 이 학생(`profiles.id=6fd6e34a-8485-437e-b7f8-ca5a8811b435`) 행이 `status='succeeded'`(quantity=20, `stripe_payment_intent_id=pi_3UCwnxICtA5Uy7fu1hySY5yX`)로 실제 존재, `entitlement_grants`에도 `original_quantity=20, is_paid=true, purchase_id_ref=<위 purchase.id>, expires_at=2027-09-07`로 정상 grant 생성, `entitlement_grant_details` 뷰 조회 결과도 `lesson_type_code='regular', remaining=20`으로 정확히 나옴 — **즉 R4 신규 결제 경로(`app/parent/EntitlementsTab.tsx`→`entitlements-data.ts`)는 데이터·쿼리 모두 정상**, 20장이 실제로 존재하고 있었다.
> **실제 원인**: 보호자 포털 nav에 이름이 똑같이 "수업권"인 탭이 **두 개** 있었다(`app/parent/ParentShell.tsx`의 `NAV_ITEMS`) — (a) `id:"credits"` 레거시 탭(`CreditsTab.tsx`/`credits-data.ts`, `students.credit_balance`/`credit_packages` 조회, R4 이전부터 있던 화면, `docs/CURRENT.md` 2026-09-01 항목에서 이미 신규 결제 세션 생성만 차단해뒀었음)과 (b) `id:"entitlements"` R4 신규 탭("수업권 구매", `EntitlementsTab.tsx`, 실제 구매가 기록된 곳). 제품 오너가 본 "수업권" 탭은 (a) 레거시 탭이었고, 이 탭이 조회하는 `students.credit_balance`는 R4 전환 이후 어떤 신규 구매로도 절대 갱신되지 않는 완전히 죽은 컬럼(실측: 이 학생도 `credit_balance=0`) — 두 탭이 이름이 겹쳐서 보호자가 "최신 잔여 수업권"을 확인하려고 옛날 탭을 눌렀고, 거기엔 원래부터 절대 반영될 수 없는 값이 떠 있었을 뿐이다. 데이터 유실도, 쿼리 버그도 아니었다.
> **수정(UI 이름 충돌 해소, 스키마 변경 없음)**: (1) 레거시 `CreditsTab.tsx`에서 "수업권 현황"(잔여 장수)/"충전하기"(구매) 블록을 완전히 제거하고 지인 추천 코드 카드만 남김(이 컴포넌트가 원래 갖고 있던, R4와 무관한 유일한 유효 기능) — nav 라벨도 `"수업권"→"지인 추천"`으로 변경해 더 이상 R4 탭과 이름이 겹치지 않게 했다. `credits-data.ts`의 `loadParentCreditsData()`도 이제 `parents.referral_code`만 조회(불필요해진 `students`/`credit_packages` 조회 제거). (2) R4 탭(`id:"entitlements"`)의 nav 라벨을 `"수업권 구매"→"수업권"`으로 변경 — 이제 "수업권"이라는 이름의 탭은 하나뿐이고, 그게 실제 최신 데이터를 보여준다. `EntitlementsTab.tsx`의 안내 문구 중 "기존 '수업권' 탭과 별개의 R4 신규 화면입니다" 문장도 더 이상 사실이 아니라 제거. 레거시 `credits-actions.ts`(신규 결제 세션 생성을 항상 거부하는 이미 죽은 코드)와 그 테스트는 범위 밖으로 남겨둠(추가 정리는 오픈 전 별도 라운드).
> **검증**: `supabase db reset --local` 성공(신규 마이그레이션 없음, 스키마 변경 없음) / `npx tsc --noEmit` 0 에러 / `app/parent/CreditsTab.test.tsx` 전면 재작성(추천 코드 카드만 렌더링 검증 4건, 기존 잔여 장수/충전 UI 관련 케이스 제거) + `app/parent/ParentShell.test.tsx` 갱신(지인 추천 탭 클릭 시 CreditsTab, 수업권 탭 클릭 시 EntitlementsTab 렌더링 각각 확인) / `npx vitest run`(전체) 194파일·1288건 중 29건만 실패 — 전부 `git stash`로 이번 변경 이전 커밋(`e1bee4a`)에서도 동일하게 실패함을 확인한 기존 known flaky(`lib/booking/session-final-judgment.integration.test.ts`/`trial-entitlement-and-cancellation.integration.test.ts`의 날짜 의존 `teacher_slot_not_open`/`teacher_buffer_violation`, `app/admin/consultation-outcome-smart-notes-gate.integration.test.ts`의 시드 데이터 unique 제약 충돌, `supabase/lesson-reviews.integration.test.ts`) — 오늘 날짜가 9/6→9/7로 넘어가며 기존에 알려진 날짜 의존 flaky 범위가 넓어진 것으로 보이며 이번 변경과 무관 / `npx next build` 성공. 원격 DB는 스키마 변경이 없어 push 불필요(`supabase migration list --linked`로 기존 65개 그대로 local=remote 확인만).

> **2026-09-07 Preview UAT 버그 2건 수정 — 초대 이메일 링크가 localhost를 가리키는 문제 + 지인/추천 계정 생성 안내 발송 실패.**
> 배경: 직전 라운드(5번)에서 완성한 "지인/추천 — 상담 없이 바로 계정 생성"을 제품 오너가 Preview에서 실제로 테스트하다가 2개를 발견했다.
> 1. **(버그, 심각) 학부모 초대 링크 이메일이 `localhost:3010`을 가리킴 — 근본 원인**: `lib/invite-email.ts`의 `sendInviteEmail()`/`sendWorkspaceProvisioningEmail()`이 실제 요청 origin을 반영하는 `lib/request-origin.ts`의 `currentRequestOrigin()`을 쓰지 않고 `process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010"`을 직접 읽고 있었다 — Preview 환경에는 이 env var가 설정돼 있지 않아 매번 로컬 개발 기본값으로 폴백했다. 관리자 Google 로그인/teacher-callback/direct-account-actions 등에서 이미 여러 번 고쳤던 것과 완전히 동일한 버그 클래스. **전수 확인**(`grep -rn "NEXT_PUBLIC_SITE_URL\|localhost:3000\|localhost:3010" app/ lib/`) 결과 같은 패턴이 2곳 더 있었다: `app/admin/users-actions.ts`의 `inviteAndCreateProfile()`(비밀번호 설정 링크 redirectTo) — 현재 호출부(`inviteTeacher`)가 항상 예외를 던져 죽은 코드지만 `legacyInviteTeacherByEmail()`이 여전히 참조해 나중에 되살아날 위험이 있어 같이 고침. `app/admin/google-link-actions.ts`가 `lib/request-origin.ts`와 100% 동일한 `currentOrigin()`을 자체 중복 정의하고 있던 것(버그는 아니었지만 헬퍼 통일 원칙 위반) — `currentRequestOrigin`을 그대로 import해 중복 제거. **수정**: 위 3개 파일 모두 `lib/request-origin.ts`의 `currentRequestOrigin()`을 쓰도록 통일. `direct-account-actions.ts`(직전 라운드)는 이미 올바르게 이 헬퍼를 쓰고 있어 변경 없음.
> 2. **(버그) "지인/추천" 폼에서 "계정 생성 안내 발송"이 "관리자만 온보딩 링크를 발급할 수 있습니다."로 실패 — 근본 원인**: `create_direct_onboarding_link_multi()`(마이그레이션 `20261214000000`)가 SQL 함수 본문에서 `is_admin()`(내부적으로 `auth.uid()` 참조)을 직접 재확인하고 있었다 — 이 함수는 `app/admin/direct-account-actions.ts`가 `requireAdminOrCapability()`로 이미 권한 검증을 마친 뒤 `createAdminClient()`(service_role)로만 호출하는데, service_role 세션에는 `auth.uid()`가 없어 `is_admin()`이 항상 false를 반환한다. `create_trial_onboarding_link_multi()`가 `20261208000000_m4_multi_onboarding_link_auth_fix.sql`에서 이미 겪고 고친 것과 완전히 동일한 버그 클래스 — `create_direct_onboarding_link_multi()`는 그 수정보다 나중(`20261214`)에 추가되면서 같은 패턴을 놓쳤다. **재현**: psql로 `set role service_role;`후 함수를 직접 호출해 수정 전 실제로 동일 예외가 발생함을 확인. **수정**: 신규 마이그레이션 `supabase/migrations/20261215000000_m4_direct_onboarding_link_auth_fix.sql`(additive, `create or replace` + 시그니처 변경이라 `drop function` 선행) — SQL 쪽 `is_admin()` 재확인 제거, `auth.uid()` 대신 호출부가 넘기는 `p_admin_id uuid` 파라미터를 `created_by`/`actor_id`로 사용, `grant execute`를 `service_role` 전용으로 축소(기존 `authenticated, service_role`에서 `authenticated` 제거 — 이 함수는 service_role 전용 내부 함수이므로 `create_trial_onboarding_link_multi`와 동일한 grant 정책으로 통일). `app/admin/direct-account-actions.ts`는 RPC 호출에 `p_admin_id: actorUserId`를 추가.
> **검증**: `supabase db reset --local` 성공(마이그레이션 65개 전부 정상 적용) / `npx tsc --noEmit` 0 에러 / 신규 회귀 테스트 `lib/invite-email.test.ts`(2건, `next/headers` mock으로 Preview 호스트를 시뮬레이션해 이메일 본문에 `localhost:3010`이 없고 실제 요청 origin이 들어감을 고정) / psql 직접 재현: 수정 전 `set role service_role; select create_direct_onboarding_link_multi(...)` → "관리자만 온보딩 링크를 발급할 수 있습니다." 예외 확인 → 수정(마이그레이션 적용) 후 동일 호출에 `p_admin_id`를 관리자 profile id로 전달 → 정상적으로 `link_id`/`raw_token` 반환 확인. `npx vitest run`(전체) 194파일·1288건 전부 통과. `npx next build` 성공. `supabase db push --dry-run`(non-prod `worpsqwqgnspddnrtnvq`)으로 신규 마이그레이션 1개만 대기 중임을 확인 후 실제 push, `supabase migration list --linked`로 local=remote 반영 확인.
> **범위 밖**: 자동화 테스트를 psql 재현으로만 고정했고(위 `lib/invite-email.test.ts` 제외) `create_direct_onboarding_link_multi` 자체의 자동화된 통합 테스트 파일은 이번에도 추가하지 않음(직전 라운드와 동일 범위 밖 판단 유지) — 다음 라운드에서 `app/consult/direct-account-creation.integration.test.ts` 보강 시 이 auth 수정도 같이 커버 권장.

> **2026-09-06(5번 완결) 지인/추천 — 상담 없이 바로 보호자+학생 계정 생성(M4 마지막 항목).**
> 배경: 관리자가 상담 칸반과 완전히 무관하게, 지인/추천 케이스에서 바로 보호자+학생 계정을 만들 수 있는 별도 화면이 필요했다(이전 라운드 TODO 5번).
> **조사 결과 — 기존 복수자녀 온보딩 플로우를 거의 그대로 재사용 가능함을 확인**: `create_trial_onboarding_link_multi()`/`finalize_trial_onboarding_students()`/`redeem_trial_onboarding_link()`/`lib/trial-onboarding-finalize.ts`(실제 Auth 계정 생성·household 연결·비밀번호 설정 메일 발송) 중 `consultation_id`를 실제로 참조하는 곳은 딱 세 곳뿐이었다: (a) `create_trial_onboarding_link_multi()`의 `trial_intent_confirmed_at` 검증, (b) `finalize_trial_onboarding_students()`의 `prospect_contacts` 갱신, (c) 같은 함수의 `_create_student_kanban_card()` 호출(학생별 칸반 카드+체험수업권 지급을 한 번에 처리). `redeem_trial_onboarding_link()`와 `createGuardianAndStudentThenRedirect()`(실제 Auth 계정 생성부)는 `consultation_id`를 전혀 참조하지 않아 코드 변경이 필요 없었다. `trial_onboarding_links.consultation_id`/`prospect_contact_id`는 원래 `not null`이었다(스키마 확인 완료, `20261015000000`).
> **구현(신규 마이그레이션 `supabase/migrations/20261214000000_m4_direct_account_creation.sql`, additive)**:
> 1. `trial_onboarding_links.consultation_id`/`prospect_contact_id`를 nullable로 전환(`trial_onboarding_links_pending_unique`는 `consultation_id` 위 partial unique index라 NULL 여러 개가 서로 충돌하지 않음 — postgres 표준 동작, 실 DB로 확인).
> 2. `create_direct_onboarding_link_multi(p_guardian_email, p_guardian_name, p_students jsonb)` 신설 — `create_trial_onboarding_link_multi()`와 거의 동일하지만 상담 조회·`trial_intent_confirmed_at` 검증이 없고, `consultation_id`/`prospect_contact_id`를 항상 null로 insert.
> 3. `finalize_trial_onboarding_students()`/`retry_trial_onboarding_student()` — `v_row.consultation_id is null`이면 `prospect_contacts` 갱신과 `_create_student_kanban_card()` 호출을 건너뛴다(= 상담 칸반에 카드가 절대 생기지 않음). 대신 신설한 `grant_trial_entitlement_for_student(p_child_id)`(= `grant_trial_entitlement_for_consultation()`과 동일한 게이트: 학생별 Smart Notes 동의 + 관리자 생년월일 확인 — consultation 없이 학생 id만으로 동작, `entitlement_grants.source_consultation_id`는 null)를 직접 호출해 체험수업권 지급을 시도하고 결과를 `trial_onboarding_link_students`에 새로 추가한 컬럼(`trial_entitlement_grant_status`/`_id`/`_error`, consultations와 동일한 상태 머신)에 pending→granted/failed로 기록한다.
> 4. `retry_direct_onboarding_student_entitlement(p_link_student_id)` 신설 — 게이트 미충족으로 실패한 학생을 게이트 충족 이후 관리자가 재처리할 수 있는 함수(기존 "재처리" 패턴과 동일 모양).
> 5. `app/admin/direct-account-actions.ts`(신규) — `sendDirectOnboardingNoticeAction()`. `sendTrialOnboardingNoticeInternal()`과 거의 동일하지만 `consultationId` 없이 `create_direct_onboarding_link_multi` RPC를 호출하고, 기존 링크 재사용/재발급(forceReissue) 분기는 넣지 않았다(직접생성은 매번 새 링크 — 스코프 최소화).
> 6. `app/admin/DirectAccountCreationForm.tsx`(신규) — `TrialOnboardingStudentsForm.tsx`와 동일한 UI 패턴(보호자 1명 + 학생 1~N행). 별도 최상위 탭을 만들지 않고 `app/admin/UsersTab.tsx`의 "학부모" 서브탭 안에 "+ 지인/추천 — 상담 없이 바로 계정 생성" 버튼으로 추가.
> 7. 생성된 계정 조회 — `app/admin/UsersTab.tsx`/`users-data.ts`는 `profiles`/`students`/`parents`/`household_members`를 role 기준으로 전부 조회하는 범용 쿼리라 이 경로로 만든 계정도 코드 변경 없이 그대로 "사용자" 탭에 나타남(확인만, 별도 구현 불필요).
> **검증**: `supabase db reset --local` 성공(기존 마이그레이션 62개 + 신규 1개 전부 정상 적용) / `npx tsc --noEmit` 0 에러 / **실제 DB 통합 검증(psql 직접 실행, service_role/authenticated 세션 모두)**: `create_direct_onboarding_link_multi`로 보호자 1명+자녀 3명 링크 발급 → `consultations` 0건 확인 → `redeem_trial_onboarding_link`(consultation_id가 null로 정상 반환) → `finalize_trial_onboarding_students`(3명 전부 `created`, `household_members`에 guardian 1+child 3 정상 연결, `consultations` 여전히 0건) → 체험수업권 지급은 게이트 미충족으로 3명 다 `failed`(정확한 사유 메시지 확인) → 그중 1명에 Smart Notes 동의+생년월일 확인을 채운 뒤 `retry_direct_onboarding_student_entitlement` 호출 → `granted`로 전이 + `entitlement_grants`에 `is_paid=false, source_consultation_id=null` 행 실제 생성 확인. 전부 기대대로 동작. / `npx vitest run`(전체) 193파일·1286건 중 6건만 실패(`lib/booking/trial-entitlement-and-cancellation.integration.test.ts` — 날짜 의존 `teacher_slot_not_open`, 기존 known flaky와 동일 파일·동일 원인, 이번 변경과 무관 파일이라 재확인 불필요) / `npx next build` 성공.
> **범위 밖(이번 라운드 미착수)**: 직접생성 경로 전용 신규 통합/단위 테스트 파일은 작성하지 않음(위 실 DB 검증으로 동작은 확인했으나 회귀 방지용 자동화 테스트는 없음) — 다음 라운드에서 `app/consult/direct-account-creation.integration.test.ts` 등으로 보강 필요. 실패한 링크의 "재발급"(forceReissue) UI는 만들지 않음(매번 새 링크 발급만 가능).

> **2026-09-06(4번 완결) "정규 진행 권장"(체험 생략) 경로 끝까지 완결 — 학생 계정 생성 후 막다른 상태였던 문제 해결.**
> 배경: 이전 라운드 TODO(4번)에서 관리자가 상담 결과로 `outcome='regular_recommended'`("정규 진행 권장", 체험 생략)를 선택해도 이후 (a) 학생 계정 생성 온보딩 폼이 `trial_recommended`일 때만 노출, (b) 자동 생성되는 학생별 자녀 카드가 `outcome`을 `trial_recommended`로 하드코딩, (c) `sendRegularContractOneClickAction`이 요구하는 `trial_regular_progress_selections`(체험 리뷰 후에만 생성됨) 존재 조건을 이 경로에서는 충족할 수 없어 막다른 상태가 되는 문제가 확인됐었다.
> **구현**:
> 1. `app/admin/ConsultationKanbanBoard.tsx` — `TrialOnboardingStudentsForm` 노출 조건을 `c.outcome === "trial_recommended" || c.outcome === "regular_recommended"`로 확장. `regular_recommended`는 체험이 없으므로 "체험 진행 확정(보호자 확인)" 버튼과 `trial_intent_confirmed_at` 요구 조건을 건너뛰고 바로 학생 계정 생성 폼을 보여준다. 헤더/버튼 라벨을 outcome에 따라 분기(체험 온보딩 vs 정규 등록 온보딩). 학생 계정 생성 자체(Auth 계정 생성, household 연결, 학생별 카드 생성)는 체험/정규 여부와 무관한 범용 절차라 기존 `TrialOnboardingStudentsForm`/`finalize_trial_onboarding_students()`를 이름 변경 없이 그대로 재사용.
> 2. `supabase/migrations/20261213000000_m4_regular_recommended_onboarding_path.sql`(신규, additive) — `_create_student_kanban_card()`가 새로 생성하는 학생별 카드의 `outcome`을 `'trial_recommended'`로 하드코딩하던 것을 원 카드(`v_root.outcome`, `consult_outcome` enum 캐스팅)를 그대로 물려받도록 수정. 체험수업권 자동 지급 시도(직전 마이그레이션 `20261211000000`이 추가한 로직)는 `outcome='trial_recommended'`인 카드에만 그대로 유지(`regular_recommended`는 체험이 없으므로 지급 대상 아님, `trial_entitlement_grant_status`는 기본값 `not_applicable` 유지가 정확한 표현).
> 3. **계약 draft 자동 생성 — 별도 로직 신설 불필요, 기존 흐름이 이미 커버**: 조사 결과 "과목·선생님 배정"(`SubjectTeacherAssignForm` → `planTrialSubjectAndAssignTeacherAction`)이 outcome과 무관하게 `child_id`만 있으면 항상 노출되고, 이 액션 자체가 이미 `get_or_create_draft_contract_for_child` RPC로 draft 계약을 만든다. 즉 학생 계정 생성 후 관리자가 과목·선생님을 배정하는 순간 `regular_recommended` 경로에서도 계약 draft가 자동으로 생기고, `getConsultationCardDetailAction`의 `contractId` 조회(child_id 기준)가 그대로 이를 찾아낸다 — 신규 트리거/함수 불필요.
> 4. `app/admin/trial-onboarding-actions.ts`의 `sendRegularContractOneClickAction()` — 발송 전 `params.childId`로 학생 카드의 `outcome`을 조회해 `regular_recommended`면 `trial_regular_progress_selections` 존재 체크를 건너뛰고 바로 발송(체험이 없으므로 그 행이 존재할 방법이 없음). `trial_recommended` 경로의 기존 체크는 완전히 그대로 유지(회귀 없음, 조건부 분기로만 처리) — 자동 발송(보호자 확인 시 트리거)은 이 경로에 배선하지 않음, 관리자가 과목·선생님 배정 확인 후 수동으로 "회사 승인 및 계약 발송"을 누르는 것이 정책.
> 5. `ConsultationKanbanBoard.tsx`의 계약 발송 UI 노출 조건(`outcome==='regular_recommended' && subjectEnrollmentId && contractId`)은 기존 코드 그대로 — 위 1~4번으로 세 조건이 실제로 채워지므로 코드 변경 없이 그대로 동작 확인.
> **검증**: `supabase db reset --local` 성공 / `npx tsc --noEmit` 0 에러 / 신규 통합 테스트 `app/consult/regular-recommended-onboarding-path.integration.test.ts`(로컬 Postgres 직접 psql, 상담 결과 기록→학생 계정 생성→학생 카드 outcome 전파→과목 배정→계약 draft 생성까지 실제 DB로 끝까지 검증 + `trial_recommended` 경로 회귀 방지 1건) 2건, `app/admin/trial-onboarding-actions.test.ts`에 `sendRegularContractOneClickAction` bypass 단위 테스트 2건(regular_recommended면 selection 조회 자체를 안 함/trial_recommended면 기존과 동일하게 거부) 신규 — 전부 통과. `npx vitest run`(전체) 193파일·1286건 중 5건만 실패(`lib/booking/trial-entitlement-and-cancellation.integration.test.ts` — 날짜 의존 `teacher_slot_not_open`, 기존 known flaky, 이번 변경과 무관 — `git stash`로 재확인 불필요할 만큼 파일 자체가 이번 변경과 완전 무관) / `npx next build` 성공.
> **범위 밖(변경 없음)**: 4번의 5번 항목(지인/추천 상담 없이 바로 계정 생성하는 완전 별도 관리자 화면)은 이번 라운드에서도 착수하지 않음 — 별도 라운드 필요.

> **2026-09-06(제품 오너 정책 변경) 정규 진행 희망 확인 시 자동 계약 발송으로 정책 변경(승인자 CEO, Do Kyung Kim 고정).**
> 직전 라운드(바로 아래 항목)에서 "보호자의 정규 진행 희망 확인은 자동 계약 발송을 트리거하지 않는다"를 의도된 설계로 확인했었다 — 그 결론을 이 라운드에서 뒤집는다. 승인자 직함이 "CEO, Do Kyung Kim" 하나로 고정된 뒤로는 관리자가 매번 수동으로 "회사 승인 및 계약 발송" 버튼을 누를 필요가 없어졌다는 제품 오너 판단에 따라, **보호자가 "정규 진행 희망"을 확인하는 순간 자동으로 계약이 발송**되도록 바꿨다.
> - **구현**: `app/admin/consultation-actions.ts`의 `companySignOffContractVersion()`/`sendContractForSignature()`는 원래 `requireAdmin()` 게이트 + DB/DocuSign 로직이 한 함수 안에 섞여 있었다 — DB/외부 API 로직만 `lib/contract-send-internal.ts`(`companySignOffContractVersionInternal`/`sendContractForSignatureInternal`, "use server"가 아닌 일반 서버 모듈이라 클라이언트에서 직접 호출 불가)로 뽑아내고, 기존 두 함수는 `requireAdmin()` 통과 후 그 내부 함수를 호출하도록 남겼다. `app/admin/trial-onboarding-actions.ts`의 `sendRegularContractOneClickAction()`(9번, 관리자 원클릭 발송) 핵심 로직도 `lib/regular-contract-send.ts`의 `sendRegularContractForSubjectEnrollment(admin, params)`로 옮겨, 관리자 경로(`requireAdminOrCapability` 통과 후 호출)와 보호자 자동 발송 경로 둘 다 이 함수를 공유한다 — 인가 판단은 항상 각 "use server" 액션(호출부)에서 먼저 끝내고, 공유 함수 자체는 이미 인가된 호출만 받는다는 전제로 서비스 role 클라이언트로 DB/DocuSign 로직만 수행한다. `app/parent/trial-conversion-actions.ts`의 `confirmRegularProgressIntent()`는 `confirm_regular_progress_intent` RPC로 `trial_regular_progress_selections`에 선택 레코드를 남긴 직후, 고정값(`approverName: "Do Kyung Kim"`, `approverTitle: "CEO, Do Kyung Kim"`)으로 `sendRegularContractForSubjectEnrollment`를 호출한다 — 보호자 쪽엔 승인자 직함 입력란 자체가 없다.
> - **best-effort(실패해도 보호자 액션은 성공)**: 자동 발송은 `tryAutoSendRegularContract()`로 감싸 계약 발송이 실패해도(Preview/로컬 DocuSign 게이트 등) 예외를 삼키고 로그만 남긴다 — 보호자의 "정규 진행 희망 확인" 자체는 RPC가 이미 성공했으므로 절대 실패하지 않는다.
> - **관리자 수동 버튼 유지**: `ConsultationKanbanBoard.tsx`의 "회사 승인 및 계약 발송"(`ContractSendForm`) 버튼은 제거하지 않았다 — 자동 발송 실패 시 재시도 용도로 그대로 남아있고, 같은 공유 함수의 멱등성(이미 `docusign_envelope_id`가 있으면 `already_sent` 반환) 덕분에 자동 발송 성공 후 수동 버튼을 눌러도 중복 발송되지 않는다. `latestContractVersionHasEnvelope`가 true면 폼 대신 "이미 발송된 계약입니다(자동 발송 포함)." 안내 + "재발송(새 버전)" 버튼을 보여준다.
> - **검증**: `supabase db reset --local` 성공(신규 마이그레이션 없음) / `npx tsc --noEmit` 0 에러 / 실제 로컬 DB(service_role 클라이언트 + 실제 보호자 로그인 세션)로 `confirm_regular_progress_intent` RPC → `sendRegularContractForSubjectEnrollment` 순서 호출을 직접 실행하는 통합 테스트 신규 2건(`app/parent/trial-conversion-auto-send.integration.test.ts`) 통과 — ① RPC 성공 직후 자동 발송이 로컬 DocuSign 게이트에서 `failed`로 돌아와도 `trial_regular_progress_selections` 행은 그대로 남고 계약은 회사 선서명까지만 진행된 draft 상태로 남는다, ② envelope가 이미 있는 계약 버전에 같은 함수를 다시 호출(관리자 수동 재클릭 시뮬레이션)해도 `already_sent`만 반환하고 새 버전을 만들지 않는다(멱등). 그 외 mock 기반 단위 테스트(`app/parent/trial-conversion-actions.test.ts` 신규 3건, `app/admin/trial-onboarding-actions.test.ts` 기존 2건을 새 공유 함수 구조에 맞게 갱신)도 통과 / `npx vitest run`(전체) 192파일·1282건 중 5건만 실패(`lib/booking/trial-entitlement-and-cancellation.integration.test.ts` — 이번 변경 이전부터 존재하던 기존 known flaky, `git stash`로 재확인) / `npx next build` 성공.

> **2026-09-06(제품 오너 지적 3건 — 1~3번 완료, 4·5번은 범위가 커서 이번 라운드 미착수) 가족 카드 온보딩 폼 중복 노출 방지 + 회사 승인자 직함 기본값 고정 + 계약 자동 발송 설계 확인.**
> 1. **가족(부모) 카드에 자녀 카드가 이미 있으면 온보딩 발송 폼 숨김(완료)**: `app/admin/consultation-kanban-actions.ts`의 `ConsultationCardDetail`에 `childCards: { consultationId, childName }[]`를 추가 — `consultations.family_root_consultation_id`가 이 카드를 가리키는 행(학생별 자녀 카드, `_create_student_kanban_card()`가 생성)을 조회해 채운다. `app/admin/ConsultationKanbanBoard.tsx`는 `detail.childCards.length > 0`이면 `TrialOnboardingStudentsForm`(빈 온보딩 발송 폼) 대신 "자녀 N명 온보딩 진행 중/완료됨" 안내 + 각 자녀 카드로 바로 이동하는 링크(`onNavigateToCard` 콜백으로 보드의 `openId`를 자녀 카드 id로 전환)를 보여준다. 이미 발급된 온보딩 링크의 "발송 내역 보기"(`TrialOnboardingLinkProgress`)는 이 분기와 무관하게 그대로 유지(조건 변경 없음).
> 2. **"회사 승인자 직함" 기본값 고정(완료)**: `app/admin/ConsultationKanbanBoard.tsx`(`ContractSendForm`)와 `app/admin/TrialOnboardingPanel.tsx`의 `approverTitle` 초기 state를 빈 문자열에서 `"CEO, Do Kyung Kim"`으로 변경. 관리자가 여전히 수정 가능(빈 값으로 지우면 발송 버튼 다시 비활성화됨 — 기존 필수값 검증 로직 변경 없음).
> 3. **설계 확인: "정규 진행 희망" 확인은 자동 계약 발송을 트리거하지 않는다(의도된 설계, 코드 변경 없음)**: `app/parent/trial-conversion-actions.ts`의 `confirmRegularProgressIntent()`는 `confirm_regular_progress_intent` RPC 호출로 `trial_regular_progress_selections`에 선택 레코드를 남길 뿐, `sendRegularContractOneClickAction`을 호출하는 지점이 아니다. `sendRegularContractOneClickAction`은 `app/admin/ConsultationKanbanBoard.tsx`(`ContractSendForm`)와 `app/admin/TrialOnboardingPanel.tsx`에서만 호출되며, 둘 다 관리자가 "회사 승인자 직함"을 입력하고 "회사 승인 및 계약 발송" 버튼을 눌러야만 실행된다. 즉 보호자의 정규 진행 희망 확인 → 관리자의 수동 승인·발송이 항상 필요한 구조이며, 계약 발송 자체가 "회사 승인자 직함"을 필수로 요구한다는 사실이 이 설계가 의도적임을 뒷받침한다. **결론: 버그 아님, 코드 변경 불필요.**
> **검증**: `supabase db reset --local` 성공(신규 마이그레이션 없음, 스키마 변경 없음) / `npx tsc --noEmit` 0 에러 / `app/admin/ConsultationKanbanBoard.test.tsx`에 신규 테스트 2건(자녀 카드 있으면 폼 숨김+이동 링크, 회사 승인자 직함 기본값) 추가 + 기존 재시도 버튼 활성화 테스트 1건을 새 기본값에 맞게 갱신 / `npx vitest run`(전체) 190파일·1277건 중 5건만 실패(`lib/booking/trial-entitlement-and-cancellation.integration.test.ts` — 이번 변경 적용 전 커밋 `43131ff`에서도 동일하게 실패함을 `git stash`로 확인, 오늘 날짜 기준 선생님 예약가능시간 시드 데이터가 테스트가 쓰는 미래 날짜(9/13~9/18)를 커버하지 못하는 기존 이슈로 추정, 이번 변경과 무관) / `npx next build` 성공.
> **4·5번(체험 생략→바로 정규 등록 플로우 완성, 지인/추천 상담 없이 바로 계정 생성)은 이번 라운드에서 착수하지 못했다** — 둘 다 DB 함수 변경(`admin_record_consultation_outcome()`, `sendRegularContractOneClickAction`의 `trial_regular_progress_selections` 체크 우회, 계약 draft 자동 생성 함수 신설/재사용)과 신규 관리자 화면, 통합 테스트까지 필요한 규모라 1~3번(제품 오너가 즉시 체감하는 UX 버그)을 먼저 완결하는 데 이번 라운드를 모두 사용했다. 다음 라운드에서 이어서 진행 필요 — 상세 설계 메모는 아래 "다음 라운드 TODO" 참고.
>
> **다음 라운드 TODO(4·5번 상세)**:
> - **4번**: (a) `admin_record_consultation_outcome()`이 `outcome='regular_recommended'`일 때도 `consultations.outcome`만 갱신하고 계약 레코드를 만들지 않는 현재 동작 확인됨 — 계약 draft 자동 생성 시점은 outcome 기록 시점이 아니라 "학생 계정 생성 완료(자녀 카드 생성) 시점"이 맞다(과목 배정이 그 전에 필요하므로). (b) `ConsultationKanbanBoard.tsx`의 `TrialOnboardingStudentsForm` 렌더 조건(`c.outcome === "trial_recommended"` 블록 안에 있음, 약 300줄 근처)에 `|| c.outcome === "regular_recommended"`를 추가하는 것만으로는 부족 — 현재 이 블록 전체가 `trial_recommended` 전용 헤더("다음 단계 — 체험 온보딩")로 감싸여 있어 조건문 구조 자체를 다시 짜야 한다. (c) 계약 발송 UI 조건(약 366~368줄)은 이미 `outcome==='regular_recommended'`를 포함하지만 `detail.contractId`가 필요 — 학생 계정 생성 완료 훅에서 `outcome==='regular_recommended'`인 자녀에 한해 `contracts` draft를 자동 생성하는 로직 추가 필요(기존 계약 생성 SQL 함수 재사용 우선 조사). (d) `sendRegularContractOneClickAction`의 `trial_regular_progress_selections` 존재 요구 체크를 `outcome==='regular_recommended'` 경로에서만 우회하도록 분기 추가(기존 `trial_recommended` 경로 회귀 없어야 함).
> - **5번**: `app/admin/` 아래 신규 화면(상담 칸반과 완전히 분리, 상담 레코드 미생성) 필요. `create_trial_onboarding_link_multi()`/`finalize_trial_onboarding_students()` 재사용 시 `consultation_id` nullable 여부 스키마 확인부터 시작(현재 미확인). 생성된 학생 계정은 `app/admin/UsersTab.tsx` 등 기존 사용자 목록에서 조회 가능하면 충분, 별도 칸반 카드 불필요.

> **2026-09-06(제품 오너 즉시 보고 2건 — 병렬화 직후) 보호자 포털 수업 리스트 회귀 의심 조사(버그 아님, 확인 완료) + 관리자 칸반 "정규 계약" 재시도 무피드백 버그 수정(완료).**
> 1. **보호자 포털 수업 리스트가 안 뜬다는 회귀 의심(`app/parent/page.tsx`, 직전 커밋 `ae95c39`)**: `git show ae95c39`로 `app/parent/page.tsx`/`app/parent/enrollment-data.ts`/`app/parent/consent-data.ts`/`app/parent/entitlements-data.ts`/`app/student/dashboard-data.ts` diff를 전부 정독 — 의존관계가 있는 호출(예: `enrollmentIds`가 필요한 `legacy_sessions` 조회, `childrenSubjectEnrollments`가 필요한 `progressedTrialEnrollmentIds`)은 전부 그 의존값이 이미 resolve된 이후 단계에서만 `Promise.all`로 묶여 있어 순서·구조분해 실수는 없었다. 실제 seed 데이터(부모 `bbbbbbbb-...0001` / 자녀 `cccccccc-...0001`, active enrollment 2건 + `legacy_sessions` 5건)로 로컬 DB에 대고 `loadLessons`/`loadCurricula`/`loadDashboardData`를 service-role 클라이언트와 실제 보호자 로그인 RLS 세션(JWT) 양쪽으로 병렬/순차 호출해 결과가 완전히 동일함(빈 배열이 아님)을 확인 — **결론: ae95c39는 원인이 아니다(버그 아님)**. `app/parent/parent-home-lessons-parallel-regression.integration.test.ts`(신규)로 회귀 방지 고정.
> 2. **관리자 칸반 "정규 계약" 발송 실패 후 재시도해도 무반응(버그, 수정 완료)**: `app/admin/trial-onboarding-actions.ts`의 `sendRegularContractOneClickAction`은 DocuSign 발송이 실패하면(Preview 환경은 `DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS=true`가 아니면 항상 실패하는 의도된 게이트 — `lib/docusign.ts`) throw가 아니라 `{ status: "failed", error }` 값을 반환해 계약을 draft로 유지한다(의도된 설계). 그런데 `app/admin/ConsultationKanbanBoard.tsx`의 `ContractSendForm.onClick` 핸들러가 이 반환값을 그냥 버리고 있었다 — 그래서 회사 승인자 직함을 입력하고 재시도해도 관리자에게 아무 피드백 없이 같은 "발송 실패" 배너만 반복돼 "재시도 버튼이 고장난 것"처럼 보였다(재시도 버튼 자체는 정상 — 빈 입력이면 비활성화, 값을 입력하면 정상 활성화됨을 확인). **수정**: 반환값의 `status`를 확인해 `"failed"`면 throw해 기존 에러 표시 배선(`run()`→`setError`)으로 노출하되, 원인이 Preview DocuSign 게이트(`DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS`)면 "Preview 환경에서는 실제 DocuSign 발송이 비활성화되어 있습니다(정상 동작)..."로 문구를 바꿔 관리자가 실제 버그와 환경 제약을 헷갈리지 않게 했다. `app/admin/ConsultationKanbanBoard.test.tsx`에 3건 신규 테스트로 고정(Preview 게이트 메시지 노출 / 다른 실제 오류 메시지 그대로 노출 / 직함 입력 시 버튼 활성화).
> **검증**: `supabase db reset --local` 성공 / `npx tsc --noEmit` 0 에러 / `npx vitest run`(전체) 190파일·1275건 중 1건만 실패(`lib/timezone-persistence.integration.test.ts` — 단독 실행하면 통과하는 기존 병렬 실행 환경 플레이크, 이번 변경과 무관) / `npx next build` 성공.
>
> **2026-09-06(오픈 전 성능 개선 1라운드) 포털 홈 페이지 순차 로더 병렬화 — 데이터/쿼리 로직 변경 없음(완료). 캐싱 도입은 이번 라운드 범위 밖, 오픈 전 별도 라운드에서 진행.**
> 배경: 직전 조사에서 학생/보호자/선생님 포털 홈 페이지(`app/*/page.tsx`)가 서로 의존관계 없는 여러 데이터 로더를 `Promise.all` 없이 순차 `await`하고, 자녀별/교사별 반복문 안에서도 순차 `await`(N+1)하는 패턴이 발견됐다. 관리자 포털(`app/admin/page.tsx`)은 이미 `Promise.all`로 병렬화돼 있어 참고 기준으로 삼았다.
> **구현(순서만 변경, 반환값·쿼리 조건 동일)**:
> - `app/parent/page.tsx` — `currentChildId` 확정 후 서로 독립인 11개 로더(`dashboard`/`upcoming,past`/`curricula`/`credits`/`entitlements`/`consentChildren`/`activeConsentPolicy`/`trialSmartNotesChildren`/`pendingRegularIntentChoices`/`childrenSubjectEnrollments`/`lessonBooking`)를 `Promise.all`로 묶음. 그 다음 단계에서 `curricula`/`past` 결과에 의존하는 `memosByEnrollment`(자녀 커리큘럼별 `loadMemos`, N+1 제거)·`reviews`·`myFeedback`·`progressedTrialEnrollmentIds`(이건 `childrenSubjectEnrollments`에 의존해 이 단계로 미룸)를 다시 `Promise.all`로 병렬화. `progressedTrialEnrollmentIds`→`childrenSubjectEnrollments` 의존관계는 순차 유지.
> - `app/student/page.tsx` — 서로 독립인 12개 로더(`dashboard`/`vocabWords`/`problemLog`/`upcoming,past`/`curricula`/`homework`/`materialsLibrary`/`credits`/`stats`/`subjectEnrollments`/`lessonBooking`/`teacherList`)를 `Promise.all`로 묶음. 이후 `curricula`/`past`/`teacherList`에 의존하는 `memosByEnrollment`(N+1 제거)·`reviews`·`myFeedback`·교사별 `teacherProfiles`/`teacherSessionHistory`/`chatThreads`(교사별로 다시 `Promise.all`, N+1 제거)를 병렬화.
> - `app/teacher/page.tsx` — `roster`에 의존하지 않는 7개(`dashboard`/`mySubjects`/`loadTeacherAssignments`/`availabilityRules`/`availabilityExceptions`/`lessonSchedule`/교사 프로필 timezone) + `roster` 자체를 `Promise.all`로 묶음. `curricula`는 `roster` 필요해 그 다음 순차. 이후 `curricula`에 의존하는 `memosByEnrollment`(N+1 제거)·`reviews`·학생별 `studentFeedback`(학생별 `Promise.all`, N+1 제거)·`reviewedSessionIds`(dashboard.past 의존, curricula와는 무관)를 병렬화.
> - `app/student/dashboard-data.ts` — `profiles` 조회와 `enrollments` 조회는 서로 무관(둘 다 `studentId`만 필요)해 `Promise.all`로 병렬화. `teacherProfiles`(enrollments의 teacherIds 필요)와 `legacy_sessions` 조회(enrollments의 enrollmentIds 필요)는 서로 독립이라 다시 `Promise.all`로 병렬화(단, 둘 다 `enrollments` 완료 후에만 실행 가능해 그 뒤 단계로 유지 — `profile`/`enrollments` 자체보다 늦게 실행됨은 기존과 동일).
> - N+1 반복문 제거: `app/parent/enrollment-data.ts`의 `loadChildrenSubjectEnrollments`(자녀별 `loadStudentSubjectEnrollments`), `app/parent/consent-data.ts`의 `loadChildrenConsentStatus`/`loadTrialSmartNotesConsentStatus`(자녀별 RPC/조회), `app/parent/entitlements-data.ts`의 상품별 가격 버전 조회(products 루프) + 계약/잔액/구매내역 3개 쿼리(서로 무관, `Promise.all`로 병렬화), `app/teacher/curriculum-data.ts`의 `loadAllStudentCurricula`(학생별 `loadCurricula`) — 전부 자녀/학생/상품별로 서로 완전히 독립인 읽기 전용 호출이라 `Promise.all(...map(...))`로 교체. 순서에 의존하는 부수효과(쓰기)는 발견되지 않았다(`ensureThreadAndLoadMessages`는 교사별로 서로 다른 스레드를 다루므로 병렬화해도 안전).
> - **범위 밖으로 명시 제외**: `revalidate`/`cache()`/`unstable_cache` 등 캐싱 도입은 이번 라운드에서 하지 않았다 — 오픈 전 별도 라운드 과제로 `docs/2026-09-06-uat-checklist-consult-multichild.md`에 기록.
> **검증**: `supabase db reset --local` 성공(신규 마이그레이션 없음, 스키마 변경 없음) / `npx tsc --noEmit` 0 에러 / `npx vitest run`(전체) 189파일·1270건 전부 통과(로그에 보이는 다수의 `ERROR:`/`Not implemented: Window's open()` 줄은 기존 negative-path 테스트가 의도적으로 유발하는 예상된 에러 출력) / `npx next build` 성공. 로더 반환값 자체(타입·데이터)는 건드리지 않았으므로 기존 단위/통합 테스트가 그대로 회귀 검증 역할을 한다.
>
> **2026-09-06(제품 오너 확정 지시 2건) 보호자 포털 "정규 진행 희망" 배너 조건 통일 + 중도 종료 자녀 탭 숨김 — 스키마 변경 없음(완료).**
> 1. **"정규 진행 희망 선택 필요" 배너가 리뷰 확정 여부와 무관하게 떠야 한다**: `app/parent/regular-intent-data.ts`의 `loadPendingRegularIntentChoices()`가 예전엔 `lesson_reviews.status='final'`(체험 리뷰 확정)을 요구해, 실사용에서 "수강 과목 탭에는 대상이 보이는데 홈 배너는 안 뜨는" 불일치가 났다. 원인은 두 화면이 서로 다른 조건을 썼기 때문 — 홈 배너는 `lesson_type='trial'` + 리뷰 `final`을 요구했고, 수강 과목 탭(`TrialConversionPanel`)은 리뷰 lesson_type 필터 없이 아무 최종 리뷰나 확인했다. 공통 기준 함수 `getProgressedTrialEnrollmentIds()`(신규, `regular-intent-data.ts`)를 만들어 "체험 세션이 진행 중이거나(`final_status='live'`) 끝난(`scheduled`/`live`가 아님) subject_enrollment" universe를 두 화면이 동일하게 재사용하도록 통일했다(리뷰 확정 요건 완전 제거 — 실제 "정규 진행 희망" 액션 자체는 여전히 `confirm_regular_progress_intent` RPC가 서버에서 확정 리뷰를 재검증). `app/parent/enrollment-data.ts`에 `loadProgressedTrialEnrollmentIds()` 추가, `app/parent/page.tsx`→`ParentShell.tsx`→`EnrollmentTab.tsx`(`ParentEnrollmentTab`)로 이 universe를 prop으로 흘려보내 `TrialConversionPanel`에 전달할 enrollments를 필터링한다. `TrialConversionPanel.tsx`(`TrialConversionRow`)는 이제 리뷰 미확정이어도 행 자체는 보여주되(버튼 대신 "리뷰가 준비되면…" 대기 안내), 리뷰가 final이어야 실제 버튼이 뜬다.
> 2. **상담이 "중도 종료"된 자녀는 보호자 포털 상단 탭에서 숨긴다**: `app/parent/children-data.ts`의 `loadChildren()`이 상담 상태와 무관하게 household의 모든 자녀를 보여주던 문제. 자녀별로 (a) `active` 상태 `subject_enrollments`가 하나도 없고 (b) 그 자녀에 연결된(`consultations.child_id`) 최신 상담의 `closure_type`이 `no_trial`(체험 없이 종료) 또는 `trial_no_convert`(체험 후 미전환)이면 탭 목록에서 제외한다. 이미 정규 전환돼 active 수강이 있는 자녀는 상담이 중도 종료로 기록돼 있어도 절대 숨기지 않는다(수강 여부가 우선). 자녀가 1명뿐이고 그 자녀가 숨김 대상인 극단 케이스는 기존 `app/parent/page.tsx`의 "연결된 자녀 계정이 없습니다" 빈 상태 처리가 그대로 커버한다(추가 변경 불필요 — `loadChildren()`이 빈 배열을 반환하면 그 분기를 탄다).
> **검증**: `supabase db reset --local` 성공(신규 마이그레이션 없음, 기존 컬럼만 조회) / `npx tsc --noEmit` 0 에러 / `app/parent/children-data.test.ts`에 중도 종료 숨김 케이스 4건 추가(no_trial 숨김, trial_no_convert 숨김, active 수강 있으면 안 숨김, contract_signed는 안 숨김) / `app/parent/TrialConversionPanel.test.tsx` 리뷰 미확정 케이스를 "행 자체는 보이되 버튼 없음"으로 갱신 / 신규 통합 테스트 `app/parent/parent-portal-trial-consultation-consistency.integration.test.ts`(로컬 Postgres 대상, `loadChildren`/`loadPendingRegularIntentChoices`/`getProgressedTrialEnrollmentIds`를 실제로 호출) 7건 — 리뷰 미확정이어도 홈 배너 대상 포함, 체험 세션이 `scheduled`뿐이면 제외, 선택 완료 후 홈 배너에서는 빠지지만 탭 universe에는 남음, 중도 종료(no_trial/trial_no_convert) 자녀 숨김, active 수강 있으면 숨김 안 함, contract_signed는 숨김 안 함, 자녀 1명뿐인 극단 케이스에서 `loadChildren`이 에러 없이 빈 배열 반환 / `npx vitest run` 전체 189파일·1270건 전부 통과(`--no-file-parallelism`으로 확인 — 병렬 실행 시 다른 통합 테스트의 선생님 예약가능시간 데이터 경합으로 flaky해지는 기존 이슈 확인, 이번 변경과 무관) / `npx next build` 성공.

> **2026-09-06(A안 UI 정리, 실사용 지적 2건 후속) "수업" 탭 레이아웃/예정·지난 판정 정리 — 스키마 변경 없음(완료).**
> 배경: 직전 "레슨"+"예약" 병합(A안) 라운드를 제품 오너가 실제로 써보고 2가지를 지적했다.
> 1. **레이아웃 버그** — "수업" 탭 "예정 수업" 서브탭에서, 이미 체험 수업이 확정 예약돼 있어도 위쪽에 "과목·선생님 선택" 드롭다운·"체험 수업은 1회만 예약할 수 있습니다" 안내·"예약 가능 시간을 불러오는 중…" 문구가 계속 표시되고 그 아래 빈 여백이 크게 남은 뒤에야 "예정된 수업" 목록이 나왔다. `app/student/LessonBookingTab.tsx`에 `showBookingForm` 토글 상태를 추가(예정 수업이 하나도 없는 신규 학생은 기본 펼침, 이미 예정 수업이 있으면 기본 접힘 — "+ 새 수업 예약하기" 버튼으로 펼침)했고, 선택된 과목이 체험이고 이미 그 과목·선생님으로 예정 수업이 있으면(`hasExistingTrialBooking`) 드롭다운/모드토글/슬롯 로딩 블록 전체를 안내 문구("이미 체험 수업을 예약하셨습니다…")로 대체하고 슬롯 재조회 자체를 생략한다(불필요한 "불러오는 중…" 고착도 함께 해소).
> 2. **버그/정책 — 선생님 조기 종료가 학생 쪽에 반영 안 됨**: `app/student/lesson-booking-data.ts`의 예정/지난 판정이 순수 `startsAt > now` 시간 비교만 쓰고 `sessions.final_status`(`finalize_lesson_session()` 결과)와 무관해, 선생님이 수업을 조기 종료(완료 처리)해도 예약 시작 시각이 안 지났으면 학생 쪽은 계속 "예정 수업"에 남아있었다. `loadLessonBookingData()`에 `sessions.final_status`/`lesson_type` 조회를 추가하고, 선생님 포털(`app/teacher/TeacherLessonScheduleTab.tsx`의 `isPastLesson()`)과 동일한 규칙으로 통일: **(시작 시각이 지났거나 OR final_status가 이미 최종판정(scheduled/live가 아님))이면 "지난 수업"으로 분류하되, 체험 수업은 `lesson_reviews` 리뷰가 확정(`final`)되기 전까지는 시간·판정과 무관하게 "예정 수업"에 남긴다** — 같은 수업이 선생님 쪽엔 "예정", 학생 쪽엔 "지난"으로 보이는 불일치를 없앴다. 취소된 예약(`reservations.status !== 'confirmed'`)은 기존과 동일하게 양쪽 모두 노출 안 함(변경 없음).
> **검증**: `supabase db reset --local` 성공(신규 마이그레이션 없음) / `npx tsc --noEmit` 0 에러 / `app/student/LessonBookingTab.test.tsx`에 레이아웃 회귀 테스트 2건(예정 수업 있으면 폼 기본 접힘, 체험 재예약 불가 시 안내로 대체·슬롯 재조회 안 함) 추가 / `app/student/lesson-booking-data.test.ts`에 예정/지난 판정 테스트 4건(미래+completed→지난, scheduled+미래→예정, 체험+completed+리뷰draft→예정, 체험+completed+리뷰final→지난) 추가 / `npx vitest run`(전체) 188파일·1259건 전부 통과 / `npx next build` 성공.

> **2026-09-06(A안 UI 정리) 선생님·학생 포털 "수업" 관련 탭 정리 — 스키마 변경 없음(완료).**
> 제품 오너 승인 범위는 "A안"(UI 정리만) — **B안(학생 전용 프로필 페이지 신설, 세션뷰·커리큘럼 연동)은 R9 범위로 이번엔 보류, 별도 라운드 승인 필요.**
> 1) 선생님 포털 "수업" 탭 — 이전 라운드에서 "예정/지난 수업"(v3)과 "지난 수업 기록·신고"(레거시) 두 서브탭으로 나눴던 것이 여전히 기능이 겹친다는 지적에 따라, `app/teacher/TeacherLessonScheduleTab.tsx`에 `mode?: "upcoming" | "past"` prop과 `onReportSessionIssue` prop을 추가해 레거시 `ScheduleTab`의 지각·노쇼 신고 기능을 v3 지난 수업 카드 안으로 완전히 흡수했다. `TeacherShell.tsx`는 이제 딱 두 개의 서브탭("예정 수업"/"지난 수업")만 렌더링하고 `ScheduleTab` import를 제거했다(컴포넌트 자체는 다른 곳에서 참조 없어 남겨둠, 필요시 후속 정리).
> 2) 선생님 포털 "배정" 탭 — `app/teacher/AssignmentsTab.tsx`의 "배정 종료 요청" 버튼을 카드 상단부에서 우측 하단의 작은 밑줄 텍스트 버튼으로 이동(실수 클릭 방지, 부차 액션임을 시각적으로 표현). 텍스트/동작은 그대로.
> 3~6) 학생 포털 "레슨"+"예약" 병합 — `app/student/lessons-data.ts`(레거시 `legacy_sessions` 기반, 커리큘럼·리뷰 연동)와 `app/student/lesson-booking-data.ts`(v3 `sessions`/`reservations`, Meet·Calendar 연동)는 서로 다른 테이블이라 행 단위로 합칠 수 없다(스키마 변경은 A안 범위 밖) — 선생님 쪽과 동일한 패턴으로, v3를 기본으로 하고 레거시 화면을 흡수하는 새 래퍼 `app/student/ClassesTab.tsx`를 만들었다. `StudentShell.tsx`의 "레슨"/"예약" 두 nav 항목을 "수업" 하나로 합치고, 내부는 딱 두 개의 서브탭("예정 수업"/"지난 수업")으로 구성 — `LessonBookingTab.tsx`(v3, `mode` prop 추가)가 주 콘텐츠, 그 아래 `<details>`로 접힌 "커리큘럼 진행·리뷰 (레거시 수업 기록)" 섹션에 `LessonsTab.tsx`(`forcedSubtab`/`hideHeader` prop 추가)를 그대로 재사용해 커리큘럼 진입·리뷰 열람 기능을 잃지 않게 했다. 예정 수업 v3 카드에 "수업 준비"(`/session/[id]`로 이동, 기존 공통 세션뷰 라우트 재사용)와 "수업 시작"(선생님 포털과 동일하게 팝업 차단을 피하려고 클릭 시 동기적으로 빈 탭을 먼저 열고 Meet 링크로 이동, 서버 액션 없이 단순 오픈) 버튼을 추가했다. 지난 수업 v3 카드에는 "수업 준비 내역"(`/session/[id]`) 링크를 추가했다 — "세션뷰 스냅샷" 개념은 레거시 세션 기반이라 존재하지 않아(스키마 없음, A안 범위 밖) 만들지 않고 아예 항목을 뺐다; 리뷰는 레거시 섹션에서 그대로 열람 가능.
> 예정/지난 서브탭 전환 버그: `app/student/LessonsTab.tsx`(구 "레슨" 탭)를 격리 테스트해본 결과 자체 로직은 정상 동작해 별도 재현 실패가 나오지 않았다(둘 다 채운 데이터로 전환 테스트 추가 — 통과). 다만 병합 과정에서 outer subtab과 내부 두 컴포넌트(레거시/v3)의 상태가 어긋날 위험이 있어, `ClassesTab.test.tsx`에 "지난 수업 클릭 시 v3·레거시 두 섹션 모두 실제로 내용이 바뀌는지" 재현·고정 테스트를 추가했다(수정 전 이 테스트가 실패하도록 구조를 검증한 뒤 `mode`/`forcedSubtab` prop으로 고정).
> **검증**: `supabase db reset --local` 성공(신규 마이그레이션 없음) / `npx tsc --noEmit` 0 에러 / `npx vitest run`(전체) 188파일·1253건 전부 통과(사전에 존재하던 `lib/booking/*.integration.test.ts`의 지갑시계 의존 flaky 실패는 이번 변경과 무관 — DB 재초기화로 해소 확인) / `npx next build` 성공.

> **2026-09-06 선생님 포털 "수업" 탭 "수업 종료" #441 마스킹 버그 수정 + "수업 시작" Meet 자동 입장 추가(이번 라운드, 완료).**
> 제품 오너가 선생님 포털 수업 카드에서 "수업 종료(완료)"를 눌렀을 때 "Minified React error #441"이 그대로 뜨는 것과, "수업 시작"을 눌러도 Meet로 자동 입장하지 않는 것을 실사용 중 발견. 근본 원인은 `app/admin/trial-onboarding-actions.ts`(2026-09-06 앞선 수정, `e1ea9f2`)와 동일한 패턴 — `app/teacher/lesson-schedule-actions.ts`의 `startMyLessonSession`/`finalizeMyLessonSession`/`resolveMyLessonLateness`/`cancelMyLessonScheduleBooking`이 검증 실패·RPC 에러를 전부 throw했고, Next.js가 production에서 Server Action의 미처리 예외를 이 일반화된 문구로 마스킹한다. 특히 `TeacherLessonScheduleTab.tsx`의 `handleFinalizeSession`은 "조기 종료 사유가 필요합니다" 문자열을 매칭해 확인 다이얼로그를 띄우는 로직이 있었는데, production에서는 그 메시지 자체가 마스킹되어 이 분기가 전혀 동작하지 않았다. 로컬 psql로 `finalize_lesson_session()`을 (a) `scheduled` 상태에서 바로 `completed` 호출, (b) `mark_lesson_session_started()` 이후 예약 종료 시각 전 `completed` 호출 두 시나리오 모두 실제로 재현해 각각 "수업이 아직 시작되지 않았습니다"/"조기 종료 사유가 필요합니다" SQL 예외가 던져짐을 실측 확인. 네 함수 모두 항상 `{ ok, error }`(`ActionResult`) 형태로 반환하도록 변경(예외 전파 없음, `trial-onboarding-actions.ts`와 동일 규칙), `TeacherLessonScheduleTab.tsx`의 핸들러를 result 체크 기반으로 재작성. 추가로 "수업 시작" 성공 시 `lesson.googleMeetLink`로 자동 입장하도록 구현 — 팝업 차단을 피하려면 클릭 핸들러 안에서 동기적으로 빈 탭을 먼저 열어두고(`window.open("", "_blank", ...)`), 서버 액션이 성공하면 그 탭의 `location.href`를 Meet 링크로 바꾸는 방식(실패 시 빈 탭은 닫음). 학생 포털(`app/student/LessonsTab.tsx`)의 "수업 입장"은 내부 `/session/[id]` 라우팅 방식이라 이 patttern과 구조가 달라(직접 서버 액션+Meet 링크 조합이 아님) 변경하지 않음.
> **검증**: `supabase status`로 로컬 DB 포트(54422) 확인 후 `supabase db reset --local` 성공(신규 마이그레이션 없음, additive 스키마 변경 없음) / psql로 두 실패 시나리오 실측 재현 / `npx tsc --noEmit` 0 에러 / `npx vitest run app/teacher/TeacherLessonScheduleTab.test.tsx` 19건(신규 3건 포함) 통과 / `npx vitest run`(전체) 187파일·1246건 전부 통과 / `npx next build` 성공.

> **2026-09-06(8차) 학생/선생님 포털 심층 UAT 8건 — #1~#7 완료, #8 설계만 기록(구현 보류).**
> 배경: 제품 오너가 학생 포털·선생님 포털을 더 깊이 써보며 발견한 신규 8건. 상세 체크리스트는 `docs/2026-09-06-uat-checklist-consult-multichild.md`의 "8차 세션" 절 참고.
> **근본 원인(핵심 발견)**: 이 프로젝트는 v1 스키마(`enrollments`/`teachers`, 정규 전환 후 생성)에서 v3 스키마(`subject_enrollments`+`teacher_assignments`, R1/R5, 체험 수업부터 즉시 생성)로 이행하는 중인데, `contracts`/`sessions` 등은 이미 "cutover" 마이그레이션으로 legacy 이름을 정리했지만 `enrollments`/`teachers`는 **아직 cutover되지 않았고, 학생 포털 "선생님" 탭(`app/student/teacher-data.ts`)과 선생님 포털 "학생" 탭(구 `app/teacher/roster-data.ts`)이 여전히 legacy 테이블만 조회**하고 있었다. 체험 수업만 진행한 사용자는 `enrollments` 행이 없으므로 두 탭 모두 "매칭/담당 없음"으로 잘못 표시됐다(#1/#2). 게다가 RLS 레이어에도 같은 갭이 있었다 — `teaches_student()` 함수와 `teachers` 테이블 SELECT 정책이 legacy `enrollments`만 확인했다(반면 `profiles`/`subject_enrollments`/`teacher_assignments` 정책은 R5에서 이미 v3 인지하도록 갱신돼 있었음). psql로 `set role authenticated`+`request.jwt.claims`를 이용해 실제 RLS 위반을 먼저 재현한 뒤 수정을 검증했다.
> **구현**: (1) `app/student/teacher-data.ts` — `subject_enrollments`+`teacher_assignments`+`sessions` 기준으로 재작성(#1). (2) `supabase/migrations/20261212000000_m4_teacher_student_v3_visibility_fix.sql` — `teaches_student()`와 `teachers` SELECT 정책에 v3 배정 경로 OR 조건 추가(additive, 기존 접근 축소 없음)(#2). (3) `app/teacher/TeacherLessonScheduleTab.tsx` — "금주 목록"을 "예정 수업 목록"으로 개명하고 이번 주 필터를 제거, 오늘 이후 전체 예정 수업을 표시(#3/#4). (4) `app/teacher/TeacherShell.tsx` — "수업"과 "수업 일정" 탭을 하나로 통합(v3 예약 UI 기본 + 레거시 기록/신고 서브탭), "학생" 탭 제거 후 "배정" 탭(`AssignmentsTab.tsx`/`assignments-data.ts`)에 학년·연락처·"학생 프로필 보기"·"커리큘럼 보기" 추가(#5/#6/#7). (5) #8(커리큘럼-배정 연동)은 `teacher_assignments.curriculum_handoff_status`(이미 존재, `not_applicable`/`pending`/`done`)는 있으나 실제 `teacher_curriculum_templates` 참조 컬럼은 없음을 확인 — 최소 개발 범위 설계(nullable `curriculum_template_id` 컬럼 additive 추가 + 배정/승계 시점에 값 채우기)만 기록하고 구현은 다음 라운드로 미룸.
> **검증**: `supabase db reset --local` 성공(신규 마이그레이션 1건) / `npx tsc --noEmit` 0 에러 / `npx vitest run` 187파일·1243건 전부 통과(신규 3건: `app/student/teacher-data.test.ts`, `app/teacher/assignments-data.test.ts`, `TeacherLessonScheduleTab.test.tsx` 회귀 테스트 1건 추가) / `npx next build` 성공. psql로 "세온장/Teacher test1"과 동일 구조(legacy `enrollments` 없이 v3 배정만 존재)를 로컬 DB에 재현해 RLS 통과를 실측 확인.

> **2026-09-06(6차) 선생님 가용시간 — 부분 시간대 개별 조정(골든패스 7건 중 마지막 #5, 완료).**
> 배경: `docs/2026-09-06-uat-checklist-consult-multichild.md`에 남아있던 골든패스 실사용 7건 중 마지막 미착수 항목. 제품 오너 요구사항: 반복 요일 규칙으로 열어둔 특정 요일이라도, 특정 날짜의 일부 시간대만 개별로 휴무 지정할 수 있어야 하고, 월간 캘린더에서 내가 오픈한 날짜가 보이고, 날짜를 클릭하면 그날 실제 오픈 시간이 일간 타임라인으로 보여야 한다.
> **조사 결과 핵심 발견**: DB 스키마(`teacher_availability_exceptions.start_time_local`/`end_time_local`, R6 `20260926000000_r6_availability_and_booking.sql`)와 두 계산 경로(관리자·본인 최종 판정용 `is_teacher_slot_open()` DB 함수, 학생/보호자 예약 슬롯 후보 계산용 `computeAvailableSlots()`/`lib/booking/slot-search.ts`)가 **이미 R6에서부터 부분 시간 예외를 완전히 지원**하고 있었다 — `addTeacherAvailabilityException()`(`app/teacher/availability-actions.ts`)도 이미 `startTimeLocal`/`endTimeLocal`을 받고 있었다. 즉 **마이그레이션이 전혀 필요 없었다** — 실제로 빠져 있던 건 순수하게 선생님 포털 UI뿐이었다.
> **실제 구현**: (1) `lib/booking/slot-search.ts`에 순수 함수 `computeOpenWindowsForDate(dateStr, dayOfWeek, rules, exceptionsForDate)` 추가 — 반복 규칙 구간을 모으고 부분 임시오픈 예외를 더한 뒤, 부분 휴무 예외 구간을 빼는(구간 쪼개짐 포함) 하루 단위 오픈 시간 계산(학생 예약용 `computeAvailableSlots`와 예외 처리 규칙을 그대로 공유하되 슬롯 후보가 아니라 시간 구간만 계산). (2) `lib/calendar-date-utils.ts`에 `dayOfWeekForDateKey()` 추가. (3) `app/teacher/availability-actions.ts`의 `AvailabilityExceptionRow`에 `startTimeLocal`/`endTimeLocal` 필드 추가, `listTeacherAvailabilityExceptions()`가 이 값을 조회하도록 수정. (4) `app/teacher/TeacherAvailabilityTab.tsx` — 기존 "날짜별 예외(월간 달력)" 섹션을 확장: 월간 캘린더 배지가 예외 없이 반복 규칙만으로 열린 날짜는 초록, 예외로 조정된 날짜는 회색/빨강으로 구분 표시(`app/components/MonthCalendar.tsx`의 `DayBadge.tone`에 `"green"` 추가), 날짜 선택 시 "이 날짜의 실제 오픈 시간(반복 규칙 + 예외 반영)" 타임라인을 보여주고, 그 아래 시작/종료 시간 입력으로 "이 시간대만 휴무로/임시 오픈으로" 등록하는 폼과 등록된 부분 예외 목록(개별 삭제 가능)을 추가. 기존 종일 휴무/임시오픈 CRUD, 기간 일괄 휴무, 지난달 복사 기능은 그대로 유지(회귀 없음, 종일 예외 등록 시 그 날짜의 종일 예외만 교체하고 부분 예외는 보존하도록 로직 분리).
> **검증**: `lib/booking/slot-search.test.ts`에 `computeOpenWindowsForDate` 단위 테스트 9건(반복 규칙만/다른 요일/종일 휴무/부분 휴무 앞·중간 걸침/부분 임시오픈/종일 임시오픈/여러 부분 휴무로 구간 쪼개짐/effective_from 밖) 추가. `lib/calendar-date-utils.test.ts`에 `dayOfWeekForDateKey` 테스트 추가. `app/teacher/TeacherAvailabilityTab.test.tsx`에 타임라인 렌더링·부분 휴무 등록·삭제 컴포넌트 테스트 3건 추가. 신규 통합 테스트 `lib/booking/teacher-partial-time-exception.integration.test.ts`(psql 직접 접속) — 부분 휴무 등록 전 반복 규칙 시간대 전체가 열려 있음을 확인 후, 특정 날짜에 부분 휴무(12:00~13:00)를 등록하면 그 시간대만 `is_teacher_slot_open()`이 false를 반환하고 전후 시간대·다른 날짜는 여전히 true임을 실제 DB 함수 호출로 확인(2건 통과).
> `supabase db reset --local` 성공(신규 마이그레이션 없음 — 기존 스키마 재사용) / `npx tsc --noEmit` 0 에러 / `npx vitest run` 186파일·1243건 전부 통과 / `npx next build` 성공. non-prod DB push 불필요(스키마 변경 없음). **골든패스 실사용 7건 전부 완료.**

> **2026-09-06(4차) 시간대 설정 UI 지적사항 처리 — 미국 전역 시간대 목록 확장**
> 배경: 제품 오너가 학생 포털에서 시간대 표시를 확인하다가 4가지를 지적했다: (1) "가정 기본 시간대"라는 라벨만 보이고 실제 선택된 IANA 값이 selected로 안 보인다, (2) 시간대 변경이 다음 로그인에도 유지돼야 한다(영구 저장), (3) 미국 전역 시간대(동부/중부/산악/알래스카/하와이 등)가 선택지에 있어야 한다, (4) 학생/학부모/관리자 포털 전부 동일 로직이어야 한다.
> 조사 결과 (1)(2)(4)는 이미 `8b3bf26 feat: timezone settings UI across all 4 portals`(R6)에서 구현·커밋돼 있었다: `app/components/TimezoneSettingsModal.tsx`가 학생/학부모/관리자/선생님 4개 포털 Shell(`StudentShell.tsx`/`ParentShell.tsx`/`AdminShell.tsx`/`TeacherShell.tsx`)에서 공용으로 쓰이고, 모달을 열 때 `getMyTimezoneSettings()`(`lib/timezone-actions.ts`)가 실제 `profiles.timezone`/`households.default_timezone` 값을 읽어와 `<select>`의 `value`로 그대로 선택된 상태를 만든다(라벨이 아니라 실제 IANA 값). 저장은 `updateMyTimezone()`이 `profiles.timezone`을 본인 RLS(`id=auth.uid()`)로 직접 update(개인 설정, 세션이 아니라 DB에 영구 저장 — 다음 로그인 시 그대로 재조회됨), `updateHouseholdDefaultTimezone()`이 security definer RPC `update_household_default_timezone()`(주 보호자만 허용, `20261029020000_r6_household_timezone_rpc.sql`)으로 `households.default_timezone`을 update한다. `lib/timezone.ts`의 `resolveUserTimezone()`이 개인설정→household 기본값→`America/Los_Angeles` 우선순위를 그대로 유지.
> 실제로 부족했던 건 (3)뿐 — 기존 `TIMEZONE_OPTIONS`가 서울+미국 4개 시간대(LA/덴버/시카고/뉴욕)만 있어 알래스카·하와이·애리조나(서머타임 없는 산악)가 빠져 있었다. `lib/timezone.ts`의 `TIMEZONE_OPTIONS`에 `America/Phoenix`(산악, DST 없음)·`America/Anchorage`(알래스카)·`Pacific/Honolulu`(하와이)를 추가해 미국 표준시 7개(동부/중부/산악/산악-DST없음/태평양/알래스카/하와이) + 서울을 모두 커버하도록 확장. `assertKnownTimezone()`(`lib/timezone-actions.ts`)이 이 배열을 그대로 검증에 쓰므로 서버 저장 검증도 자동으로 확장됨. `households.default_timezone`의 컬럼 기본값(`America/Los_Angeles`)은 그대로 유효(리스트 안에 있음) — 마이그레이션 불필요.
> 회귀 테스트: `lib/timezone.test.ts`에 `TIMEZONE_OPTIONS` 전체 미국 시간대 포함 여부 + `Intl.DateTimeFormat`으로 유효한 IANA 값인지 검증하는 케이스 추가. `lib/timezone-persistence.integration.test.ts`(신규) — 로컬 Postgres에 psql로 직접 접속해 (a) 학생이 개인 시간대를 저장하면 "다음 로그인"을 흉내 낸 별도 재조회에서도 그대로 유지됨, (b) 알래스카/하와이/피닉스 등 확장된 시간대도 저장·유지됨, (c) 본인이 아닌 프로필은 RLS로 바꿀 수 없음, (d) 주 보호자는 RPC로 가족 기본값을 영구 저장할 수 있고 주 보호자가 아니면 거부됨(fail-closed) — 5건 검증. `npx vitest run` 전체 185개 파일 1228건 통과, `npx tsc --noEmit` 0 errors, `npx next build` 성공.

> **2026-09-06(3차) 골든패스 실사용 발견 버그 7건 처리(이번 라운드) — 1/2/3/6/7 완료, 4 완료, 5 미완료(범위만 정리)**
> 배경: 제품 오너가 Preview에서 복수 자녀 온보딩→학생 계정 생성→체험 배정→학생 포털 확인까지 실제로 진행하며 7개 이슈를 발견했다. non-prod DB(`worpsqwqgnspddnrtnvq`)를 psql로 직접 조회해 실제 데이터(온세장/세온장/세장온 가족)로 원인을 특정했다.
> 1. **실제 버그 수정 — 학생별 체험수업권 미지급**: 다자녀 온보딩이 학생별 칸반 카드를 만드는 `_create_student_kanban_card()`(`20261206010000`)가 카드를 `outcome='trial_recommended'`로 insert만 하고, 기존 단일학생 경로(`record_consultation_outcome()`)가 하던 `grant_trial_entitlement_for_consultation()` 시도 자체를 호출하지 않았다 — `trial_entitlement_grant_status`가 기본값 `'not_applicable'`로 영원히 남아 관리자 화면의 "체험수업권 지급 재처리" 버튼(`status='failed'`일 때만 노출)도 뜨지 않았다. 실측: 논프로드에서 세온장/세장온 두 학생 모두 카드는 있지만 `trial_entitlement_grant_status='not_applicable'`, `entitlement_grants` 0건, `trial_smart_notes_consents`/`date_of_birth_verified_at` 모두 미완료 확인. 수정(`20261211000000_m4_multichild_trial_entitlement_grant_fix.sql`): `_create_student_kanban_card()`가 카드 생성 직후 `grant_trial_entitlement_for_consultation()`을 pending→granted/failed 패턴(기존 `record_consultation_outcome()`과 동일)으로 즉시 시도하도록 고쳤다 — 동의·생년월일 확인이 끝난 학생은 즉시 지급되고, 아직이면 `failed`로 정확히 기록되어 기존 재처리 버튼이 정상 노출된다. 같은 마이그레이션에 `not_applicable`로 방치된 기존 카드를 한 번 더 지급 시도하는 백필 포함. 회귀 테스트: `app/consult/multichild-trial-onboarding.integration.test.ts`에 "지급 성공"/"지급 실패→재처리로 지급 성공" 2건 추가.
> 2. **버그(1과 연결) — 배정 완료됐는데 예약 화면에 "선생님 배정 필요"**: `app/student/lesson-booking-data.ts`의 예약 후보 필터가 체험 학생(`subject_enrollments.status='planned'`)은 `entitlement_grants`에 `trial_lesson_grant`가 있어야만(`hasTrialGrant`) 예약 후보로 보여준다 — 즉 이 증상은 #1(수업권 미지급)의 직접 결과였다. 실측으로 확인(teacher_assignments는 이미 active, subject_enrollments.status='planned'인데 hasTrialGrant=false라 필터 탈락). 코드 수정은 필요 없음 — #1을 고치고 나서 실제로 두 학생 모두 `bookableEnrollments`에 포함되는 조건(`status='planned' && hasTrialGrant && trialType`)이 충족됨을 논프로드에서 직접 확인.
> 3. **UX 개선 — 원 상담(가족) 카드가 학생 카드와 구분 안 됨**: 정책(별도 보드 분리 금지, 이력 보존)은 유지하되, `listKanbanBoardAction()`(`app/admin/consultation-kanban-actions.ts`)에 `is_family_root_with_children` 플래그를 추가(다른 카드가 `family_root_consultation_id`로 자신을 참조하면 true)하고, `ConsultationKanbanBoard.tsx`가 이 카드를 흐리게(`opacity-55`) + "완료(이력)" 배지로 시각적으로만 구분한다. 카드 삭제·이동 없음.
> 4. **UX 개선 — 선생님 배정 실수 클릭 방지**: (검토 결과) `app/admin/subject-enrollment-actions.ts`의 `assignTeacherToSubjectEnrollment()`는 이미 클릭 즉시 `teacher_assignments`에 insert하는 단일 클릭 구조였다. `SubjectEnrollmentPanel.tsx`의 배정 버튼에 `window.confirm()` 확인 단계를 추가해 실수 클릭을 막았다(이미 배정된 경우의 "변경"은 기존 `changeTeacherAssignment()` 플로우가 별도 확인 다이얼로그를 이미 가지고 있어 그대로 둠).
> 5. **미완료 — 선생님 가용시간 날짜별 시간대 조정**: 시간 부족으로 이번 라운드에서 손대지 못했다. 필요한 작업: (a) `TeacherAvailabilityTab.tsx`에 `MonthCalendar` 기반 월간 뷰 추가(반복 규칙에서 파생된 슬롯 표시), (b) 날짜 클릭 시 일간 타임라인, (c) `teacher_availability_exceptions`에 `start_time`/`end_time` nullable 컬럼을 additive로 추가해 부분 시간대 휴무 지원, (d) 선생님 슬롯 계산 함수가 이 시간범위 예외를 반영하도록 수정. 다음 라운드로 이월.
> 6. **정책 확인 — 학생 비번 설정 후 승인 게이트**: 코드 확인 결과 이미 자동 진행 중이었다 — `assignTeacherToSubjectEnrollment()`가 배정 완료 시 `activateStudentIfPending()`으로 학생 상태를 pending→active로 자동 전환한다(관리자가 누르는 별도 "승인" 버튼 자체가 코드에 없음). 실측으로 세온장/세장온 모두 `students.status='active'` 확인. 다만 `app/account-pending/page.tsx`의 문구가 "관리자 승인을 기다리고 있습니다"라 실제로는 없는 수동 승인 절차가 있는 것처럼 오해를 줄 수 있어, "체험 배정 대기 중 — 별도 승인 절차 없음, 배정 완료 시 자동 진행"으로 문구만 수정했다.
> 7. **UX 개선 — 링크 재발급 시 이메일 수정 불가**: `reissueTrialOnboardingLinkAction()`에 선택적 `overrides`(보호자 이메일/이름, 학생별 이메일·이름) 인자를 추가(하위 호환 — 안 넘기면 기존 값 유지)하고, `TrialOnboardingLinkProgress.tsx`에 재발급 확정 전 이메일을 수정할 수 있는 폼을 추가했다.
>
> **검증**: `supabase db reset --local` 성공 / `npx tsc --noEmit` 0 에러 / `npx vitest run` 184 파일·1214건 전체 통과 / `npx next build` 성공. non-prod에 `20261211000000` 직접 push 후 `migration list --linked` local=remote 일치 확인. 실제 문제 학생(세온장 `6fd6e34a-8485-437e-b7f8-ca5a8811b435`, 세장온 `9c740401-2a36-4f5e-98e1-9df0ef1e4807`)은 논프로드에서 DOB 확인 + Smart Notes 동의(관리자/보호자 액션과 동등한 SQL로 재현) 후 `grant_trial_entitlement_for_consultation()`을 재처리 버튼과 동일하게 호출해 실제로 `entitlement_grants` 각 1건(60분 체험, `expires_at` 90일 뒤) 지급 완료·`trial_entitlement_grant_status='granted'` 확인, 예약 가능 조건도 충족됨을 직접 조회로 검증했다.
>
> **2026-09-06(2차) 온보딩 링크 redeem 실패 버그 수정 + 관리자 액션 토스트 + 온보딩 발송 상태 조회 화면(완료 — DB 스키마 변경 없음, 순수 앱 레이어)**
> 1. **실제 버그 수정** — 직전 라운드에서 관리자의 "체험 온보딩 안내 발송"(`create_trial_onboarding_link_multi()`)은 고쳤지만, 제품 오너가 Preview에서 그 다음 단계까지 실제로 밟아보니(보호자가 받은 링크를 클릭 → `/login`) "보호자 계정 생성에 실패했습니다. 관리자에게 문의해주세요."가 떴다. 근본 원인은 `create_trial_onboarding_link_multi()`가 아니라 `app/admin/trial-onboarding-actions.ts`의 `assertTrialOnboardingNoticeParamsValid()`가 `params.guardianEmail.trim()`으로 형식만 검증하고, 저장·RPC 전달·이메일 발송에는 **trim되지 않은 원본** `params.guardianEmail`을 그대로 써온 것이었다 — 관리자가 이메일을 복사·붙여넣기하며 앞뒤 공백이 섞이면 검증은 통과하지만, 보호자가 링크를 연 뒤 `lib/trial-onboarding-finalize.ts`가 그 공백 섞인 이메일 그대로 `admin.auth.admin.createUser()`를 호출해 GoTrue가 `Unable to validate email address: invalid format`(400)로 거부한다. node 스크립트로 로컬 GoTrue에 직접 `createUser({ email: " foo@example.com " })`를 호출해 이 400 응답을 실측 재현한 뒤 원인을 확정했다. 수정: `sendTrialOnboardingNoticeInternal()` 진입 직후 `params = { ...params, guardianEmail: params.guardianEmail.trim() }`로 정규화해 이후 모든 사용처(RPC 저장, 이메일 발송, 이벤트 로그)가 일관되게 trim된 값을 쓰게 했다. 곁들여 `lib/trial-onboarding-finalize.ts`의 `guardianCreateError`/`existingGuardianId.error`/`studentsError`/`finalizeError` 4곳이 원래 에러를 그대로 삼키고 서버 콘솔에도 안 남기던 것을 `console.error()`로 남기게 해, 같은 종류의 실패가 다시 생겨도 원인을 즉시 알 수 있게 했다(이 route.ts는 Server Action이 아니라 Next.js Route Handler라 기존 `#441` 마스킹 수정과는 무관한 별개 지점). 회귀 테스트: `app/admin/trial-onboarding-actions.test.ts`에 "보호자 이메일 앞뒤에 공백이 섞여도 trim된 값으로 RPC에 전달한다" 추가.
> 2. **관리자 액션 성공/실패 토스트** — "Calendar 재처리 실행"/"Smart Notes 미매칭 재처리"/"만료 임박 구독 갱신 실행"/"Smart Notes 사후 대조 실행"(`ConsultationSchedulingPanel.tsx`)과 그 밖의 `withBusy()` 기반 버튼(수락/거절/취소/재시도 등), "체험 온보딩 안내 발송"(`TrialOnboardingStudentsForm.tsx`)을 눌러도 성공/실패가 눈에 띄게 표시되지 않고 그 상태로 머물러 있는 것처럼 보인다는 지적을 고쳤다. 공용 토스트(`app/admin/Toast.tsx`, `useToasts()`/`<ToastStack>`)를 새로 만들어 우하단에 5초간(수동 닫기도 가능) 성공/실패 메시지를 보여준다 — 기존 상단 error 배너는 그대로 유지(토스트가 사라진 뒤에도 원인 확인 가능). `ConsultationSchedulingPanel.tsx`의 `withBusy()`에 선택적 `label` 인자를 추가해 각 버튼이 자기 행동 이름으로 성공/실패 토스트를 띄우게 했다(기존 호출부 대부분에 라벨만 추가, 로직 변경 없음).
> 3. **온보딩 발송 상태 조회 화면** — 제품 오너 지적: "메일을 보낸 상태에서 해당 상담건의 부모님/자녀 이메일 등에 대한 입력을 어떻게 했는지, 부모가 동의하고 계정 만들기 전 상태에 대해 확인하기 어렵다. 보낸 내역을 어디선가 볼 수 있어야 한다." 조회 함수(`listTrialOnboardingLinkStudentsAction()`)는 이미 있었으나 화면에 연결돼 있지 않았다 — 링크 레벨 조회 함수 `getTrialOnboardingLinkDetailAction()`(보호자 이름/이메일, 발송 시각, 링크 상태, 실패 사유)를 새로 추가하고, 신규 컴포넌트 `app/admin/TrialOnboardingLinkProgress.tsx`("발송 내역 보기" 토글)로 두 조회 함수를 묶어 상담 칸반 카드 상세(`ConsultationKanbanBoard.tsx`)와 파이프라인 패널(`TrialOnboardingPanel.tsx`) 양쪽에 연결했다. 표시: 링크 전체 상태(발송됨→보호자 확인 대기→완료/실패), 보호자 이름/이메일, 발송·만료·확인 시각, 학생별(이름/이메일/학년/과목/계정생성상태), 실패한 학생에는 기존 `retryFailedTrialOnboardingStudentAction()`으로 연결된 재시도 버튼. 신규 필드 `ConsultationCardDetail.latestOnboardingLinkId`(additive)로 카드 상세가 최신 링크 id를 넘긴다. 컴포넌트 테스트: `app/admin/TrialOnboardingLinkProgress.test.tsx`.
>
> **2026-09-06(1차) 실제 버그 수정 + 관리자 상담 월간 뷰 + R11(문의·면담) 실구현(완료 — non-prod DB push는 세션 자동 실행 정책에 따라 결과가 다를 수 있음, 아래 "non-prod/Preview" 절 참고)**
> 1. **실제 버그 수정** — 제품 오너가 Preview에서 재현: 관리자로 로그인한 상태에서 상담 칸반 카드의 "다음 단계 — 체험 온보딩" 폼에서 발송을 시도하면 매번 "발송 실패(관리자 조치 필요) — 관리자만 온보딩 링크를 발급할 수 있습니다."가 떴다. 근본 원인은 `create_trial_onboarding_link_multi()`(마이그레이션 `20261206000000`)가 SQL 안에서 `is_admin()`/`auth.uid()`를 다시 확인했는데, 이 RPC는 `app/admin/trial-onboarding-actions.ts`의 서버 액션이 `requireAdminOrCapability()`로 이미 권한을 검증한 뒤 `createAdminClient()`(service_role)로만 호출한다 — service_role 세션에는 `auth.uid()`가 없어 `is_admin()`이 **항상** false를 반환하고, 그 결과 정상적인 관리자 세션에서도 매번 실패했다. 이 함수는 2026-09-01에 같은 버그 클래스를 고친 `20261017000000_m4_admin_function_auth_fix.sql`(`confirm_trial_intent`/`create_trial_onboarding_link` 등)보다 나중(2026-09-06 복수 자녀 온보딩 라운드)에 추가되면서 그 수정 패턴을 놓쳤다. 수정: `20261208000000_m4_multi_onboarding_link_auth_fix.sql`이 같은 패턴으로 맞춘다 — SQL 쪽 `is_admin()` 재확인 제거, `auth.uid()` 대신 호출부가 넘기는 `p_admin_id`를 `created_by`/`actor_id`로 사용, `service_role` 전용으로 grant 축소. 회귀 테스트: `app/consult/multichild-trial-onboarding.integration.test.ts`에 실제 로컬 Postgres로 이 RPC를 직접 호출하는 신규 테스트 추가(정상 관리자 id를 `p_admin_id`로 넘기면 예외 없이 성공함을 고정).
> 2. **관리자 상담 가용시간 월간 뷰** — `app/admin/ConsultationSchedulingPanel.tsx`의 "공용 상담 가능시간" 섹션에 신규 컴포넌트 `app/admin/ConsultAvailabilityMonthView.tsx`를 추가했다. 기존 `MonthCalendar`를 재사용해 `list_open_consult_slots()`(반복 규칙+예외가 이미 계산된 결과, 기존 단일 원본 그대로) 결과를 월 단위로 조회해 날짜별 슬롯 개수 배지로 보여주고, 날짜 클릭 시 그날의 시간 목록을 보여준다. 기존 "반복 주간 가능시간"/"날짜별 예외" CRUD 섹션은 그대로 유지(위에 새 섹션만 추가). `MonthCalendar.tsx`에 옵션 prop `onMonthChange`를 추가(기존 사용처 무영향, additive).
> 3. **R11(문의·면담) 실구현** — 이전 라운드 "문서만 등록, 구현 금지" 결정을 제품 오너가 실구현으로 정정. 신규 마이그레이션 `20261209000000_r11_inquiry_and_meeting_requests.sql`(가산적, `consultations`와 FK 없음 — 완전 분리):
>    - `household_messages`(보호자<->관리자 household 메신저) — 보호자 포털 `문의` 탭(`app/parent/InquiryTab.tsx` + `app/parent/inquiry-actions.ts`)에서 작성/조회, 관리자 `문의·면담` 탭의 `문의함`(`app/admin/InquiryAndMeetingTab.tsx` + `app/admin/inquiry-and-meeting-actions.ts`)에서 답장·해결 처리.
>    - `meeting_requests`(면담 일정 요청, `consultations`와 완전 분리 — child_id nullable, subject nullable) + `meeting_availability_rules`/`meeting_availability_exceptions`(면담 전용 가용시간, `consult_availability_rules`/`exceptions`와 동일 패턴이지만 별도 테이블) + `list_open_meeting_slots()` RPC(`list_open_consult_slots()`와 동일 계산 로직, 완전히 분리된 데이터만 봄). 보호자는 랜딩/자녀상담과 동일한 `ConsultSlotPicker`/`MonthCalendar` 컴포넌트를 그대로 재사용(UI만 공유, 데이터는 분리). 관리자는 `면담 운영` 화면(목록 + 상태 변경 + 가용시간 CRUD, 최소 구현)에서 관리.
>    - 용어는 "면담"(상담 아님). 쓰기는 보호자/관리자 각자의 regular supabase 클라이언트(auth.uid()가 실제로 채워짐)로 RLS를 그대로 태우는 방식만 썼다 — 위 1번에서 발견한 "service_role 호출인데 SQL이 auth.uid()/is_admin()을 다시 확인해 항상 거부되는" 버그 클래스를 이 신규 기능에서는 애초에 만들지 않기 위함.
>    - 기존 자녀 면담은 별도 테이블(`meeting_requests`)이라 가입·체험·정규 전환 파이프라인 카드를 생성하지 않는다(자연히 그렇게 됨 — 통합 테스트로 확인).
>    - Smart Notes/동의는 이번 라운드에 적용하지 않음(범위 밖으로 명시).
> - **검증**: `supabase db reset --local` 성공. `npx tsc --noEmit` 클린. `npx vitest run` 182파일/1203건 중 178파일/1166건 통과 + 4개 파일(29건)은 전체 병렬 실행에서만 실패하고 개별 실행 시 전부 통과(기존에 문서화된 테스트 격리 이슈, 이번 변경과 무관 — 아래 검증 절 참고). `npx next build` 성공. RLS는 실제로 `set local role authenticated; set local request.jwt.claims`로 세션을 흉내내 psql로 직접 검증(`app/consult/r11-inquiry-and-meeting.integration.test.ts`).
> - **미완료**: e2e(Playwright) 미실행(로컬 포트 충돌, 기존 known limitation). non-prod(Preview) 원격 DB 반영 여부는 아래 "non-prod/Preview" 절 참고.

> **2026-09-06 보호자 포털 "새 자녀 상담 신청" 전용 화면(이번 라운드, 완료 — 원격 Preview DB 마이그레이션 반영은 미완료)** — 보호자 포털 `가족` 탭에 있던 "바로 학생 Auth 초대 발송" 폼을 상담 없이 쓸 수 없게 막고, 신규 `자녀상담` 탭(`app/parent/ConsultRequestTab.tsx`)에서 자녀 1~N명을 한 번에 입력해 상담을 신청하도록 바꿨다. 일정 선택은 랜딩과 동일한 공용 컴포넌트 `ConsultSlotPicker`/`MonthCalendar`를 그대로 재사용(단일 원본 `list_open_consult_slots()`), 보호자 이름/이메일/household는 세션에서 자동으로 채워 재입력받지 않는다. 신규 RPC `submit_guardian_portal_consult_request()`/`list_guardian_portal_consult_requests()`(마이그레이션 `20261207000000_m4_guardian_portal_consult_source_enum.sql` + `20261207010000_m4_guardian_portal_consult_request.sql`)가 기존 `consultations` 테이블에 그대로 insert하되 `source='guardian_portal'`(신규 enum 값, additive)로 구분하고 자녀별 정보는 신규 `requested_children` jsonb 컬럼에 담는다 — 별도 보드 없이 기존 단일 관리자 칸반(`ConsultationKanbanBoard.tsx`)에 그대로 노출되며 "보호자 포털" 배지로 랜딩 신청과 구분한다. 이 신청 단계에서는 자녀 Auth 계정/초대 이메일을 전혀 만들지 않는다(계정 생성은 여전히 관리자가 발송하는 기존 온보딩 흐름의 몫). 기존 자녀의 일반 고민상담·현황면담은 범위 밖(R11 예정 안내 문구만 표시). 상세는 아래 "2026-09-06 보호자 포털 자녀 추가 상담 신청" 절 참고. **미완료**: non-prod(Preview) 원격 DB(`worpsqwqgnspddnrtnvq`)에 `supabase db push`가 세션 자동 실행 정책(classifier)에 의해 차단되어 반영되지 않았다 — 사람이 직접 `npx supabase db push --linked`를 실행해야 한다(로컬 `supabase db reset --local`은 이미 성공 확인).

> **2026-09-06 관리자 온보딩 폼 "Minified React error #441" 버그 수정(이번 라운드, 완료)** — 제품 오너가 Preview에서 재현: 칸반 카드 상세의 "다음 단계 — 체험 온보딩" 섹션에서 `TrialOnboardingStudentsForm`으로 안내를 발송하면 화면에 "Minified React error #441"이 그대로 렌더링됐다(그 아래 입력 필드·버튼은 정상 표시). 폼-in-폼 중첩 가설(`grep -rn "<form" app/admin/`로 확인, 실제 중첩 없음)은 기각 — 진짜 원인은 `app/admin/trial-onboarding-actions.ts`의 `sendTrialOnboardingNoticeAction()`이 검증 실패(빈 값·이메일 형식·학생 간 이메일 중복)나 RPC 에러를 `sendEmail()` 실패 경로만 빼고 전부 **throw**했고, Server Action에서 던져진 예외는 Next.js가 production 빌드에서 실제 메시지를 감추고 "Minified React error #441"(React 저장소 codes.json 확인: "An error occurred in the Server Components render...")로 마스킹해 클라이언트로 보낸다는 점(`app/admin/workspace-actions.ts` 25번째 줄 주석에 2026-09-01 실측 확인 사례로 이미 기록돼 있던 동일 패턴)이었다. 해결: 함수 본체를 `sendTrialOnboardingNoticeInternal()`로 옮기고 `sendTrialOnboardingNoticeAction()`이 이를 try/catch로 감싸 항상 `{ status: "failed", linkId: "", error }` 형태로 반환(예외 전파 없음, workspace-actions.ts와 동일 규칙). 상세는 아래 절 참고.

> **2026-09-06 랜딩 상담 캘린더 UI 교체(이번 라운드, 완료)** — 제품 오너가 Preview UAT 중 지적한 "상담 희망 시간이 아직 드롭다운"을 고쳤다. 랜딩(`app/ConsultForm.tsx`)의 `<select>`를 신규 공용 컴포넌트 `app/components/ConsultSlotPicker.tsx`(월간 캘린더 → 날짜 클릭 → 60분 시간 버튼 목록 → 선택 확인)로 교체했다. 데이터 원본은 그대로 `list_open_consult_slots()`(관리자 화면과 동일 단일 원본, 수업예약/R11 면담과 절대 미혼용), 스키마 변경 없음. 상세는 아래 "2026-09-06 랜딩 상담 캘린더 UI 교체" 절 참고.

> **2026-09-06 복수 자녀 온보딩 라운드 전체 완료(관리자 온보딩 발송 폼 통합 포함) — 남은 것은 제품 오너 Preview UAT뿐.** 최종 확정 정책(**기존 단일 칸반 유지, 별도 보드 분리 폐기**)에 따라 관리자가 온보딩 안내를 발송하는 **두 진입점(`TrialOnboardingPanel.tsx`의 파이프라인 카드, `ConsultationKanbanBoard.tsx`의 칸반 카드 상세) 모두** 학생 1~N명 입력(기본 1행+`학생 추가`)을 지원하며, 실제로는 신규 공용 컴포넌트 `app/admin/TrialOnboardingStudentsForm.tsx` **하나만** 렌더링해 `sendTrialOnboardingNoticeAction()`을 호출한다(중복 폼 없음). 보호자 링크 확인 시 시스템이 학생별 Auth 계정을 생성해 같은 household에 연결하고, 계정 생성에 성공한 학생별로 단일 칸반에 카드를 만든다. 아래 "2026-09-06 관리자 온보딩 발송 폼 통합" 절 참고. **정정**: 직전 라운드(커밋 `d2a342b`)는 "학생별 칸반 카드 생성"과 "학생별 초대 상태 독립 저장"을 완료로 잘못 보고했다 — 실제로는 `consultations`에 학생별 카드를 insert하는 코드가 전혀 없었고(`family_root_consultation_id`/`is_child_onboarding_card`/`source_link_child_id` 컬럼 자체가 존재하지 않았음), 초대 상태도 `trial_onboarding_links`(가족/링크 단위) 컬럼 하나에 형제자매가 덮어쓰는 구조였다. 그 다음 라운드에서 두 가지를 실제로 구현했다 — 아래 "2026-09-06 검수 지적 정정" 절 참고. 이전 인수인계 문서 `docs/2026-09-06-session-handoff-consult-multichild.md`는 그 잘못된 완료 보고를 포함하므로 참고 시 이 정정 절을 우선한다.

## 2026-09-06 관리자 온보딩 폼 "Minified React error #441" 버그 수정(완료)

- **재현 경로**: 관리자 칸반(`app/admin/ConsultationKanbanBoard.tsx`) 카드 상세 → "다음 단계 — 체험 온보딩" 섹션 → `TrialOnboardingStudentsForm`에서 발송을 시도하면(예: 클라이언트가 걸러내지 못하는 서버 전용 검증 실패 — 학생 간 이메일 중복 등) 화면에 "Minified React error #441; visit https://react.dev/errors/441 for the full message"이 폼 필드 위에 그대로 렌더링됐다. 폼 자체(보호자 이름/이메일, 학생별 입력, 버튼)는 계속 정상 표시.
- **기각한 가설**: "form-in-form 중첩" — `grep -n "<form" app/admin/ConsultationKanbanBoard.tsx app/admin/TrialOnboardingStudentsForm.tsx` 결과 0건, `grep -rn "<form\b" app/admin/` 전수 확인 결과 실제 `<form>` 태그는 계정 메뉴 드롭다운(`AdminShell.tsx`의 `logout`/`linkAdminGoogleAccount`)뿐이고 칸반 모달 트리와는 무관 — 중첩 없음.
- **진짜 근본 원인**: React 공식 저장소(`facebook/react` v19.2 태그의 `scripts/error-codes/codes.json`)에서 확인한 441번 메시지는 "An error occurred in the Server Components render. The specific message is omitted in production builds..." — 이는 React의 코드 압축 사전을 Next.js가 Server Action의 미처리 예외를 마스킹하는 데도 재사용하기 때문에 나오는 문구다. `app/admin/trial-onboarding-actions.ts`의 `sendTrialOnboardingNoticeAction()`은 `assertTrialOnboardingNoticeParamsValid()`(빈 값·이메일 형식·학생 간 이메일 중복 검증)와 여러 `admin.rpc(...)` 에러를 **catch 없이 throw**하고 있었다(`sendEmail()` 실패 하나만 개별 try/catch로 잡아 `notice_send_error`에 기록). 이렇게 던져진 예외가 production Preview에서 일반화된 "Minified React error #441" 문구로 바뀌어 클라이언트에 도착하고, `TrialOnboardingStudentsForm.tsx`의 버튼 `onClick` 핸들러 `catch (e) { setError(e.message) }`가 이를 그대로 화면에 표시한 것 — 이 프로젝트에는 이미 동일 패턴이 `app/admin/workspace-actions.ts` 23~28번째 줄 주석("2026-09-01 실측 확인")에 기록돼 있었다.
- **수정**: `sendTrialOnboardingNoticeAction()`의 본체를 새 내부 함수 `sendTrialOnboardingNoticeInternal()`로 옮기고, 공개 함수는 이를 try/catch로 감싸 어떤 실패든 예외를 던지지 않고 `{ status: "failed", linkId: "", error: message }`를 반환하도록 변경(workspace-actions.ts와 동일 규칙 — "Next.js 공식 권장 패턴: 예상 가능한 실패는 throw 대신 반환값으로 모델링"). `confirmTrialIntentAction()`(같은 UI 블록의 "체험 진행 확정" 버튼)은 반환 타입이 `void`라 이번 라운드에서는 건드리지 않았다 — 동일 마스킹 위험이 있어 후속 과제로 남겨둠(아래 "미완료" 참고).
- **검증**:
  - `npx tsc --noEmit` 클린.
  - `npx vitest run app/admin/trial-onboarding-actions.test.ts app/admin/ConsultationKanbanBoard.test.tsx app/admin/TrialOnboardingPanel.test.tsx` — 34건 전부 통과. 기존 검증 실패 테스트 6건(`.rejects.toThrow()` 기대)은 이제 예외를 던지지 않는 새 계약에 맞춰 `result.status === "failed"` 확인으로 갱신(더 이상 예외가 아니라 반환값이 "실패"를 표현하는 것이 이번 수정의 요점이므로 회귀가 아니라 의도된 계약 변경).
  - `npx vitest run`(전체) — 173파일 중 169파일/1127건 통과, 8건 skip. 실패 4개 파일(`supabase/lesson-reviews.integration.test.ts`, `app/admin/consultation-outcome-smart-notes-gate.integration.test.ts`, `lib/booking/session-final-judgment.integration.test.ts`, `lib/booking/trial-entitlement-and-cancellation.integration.test.ts`)은 전부 로컬 DB에 남은 이전 테스트 잔여 데이터(`duplicate key value violates unique constraint`)로 인한 사전 존재 실패 — 이번 변경과 무관(해당 파일들은 이번 diff에 포함되지 않음).
  - `npx next build` 성공(프로덕션 빌드 자체는 이번 수정 전에도 통과했었다 — 버그는 빌드 실패가 아니라 런타임 마스킹이었음).
- **커밋**: (아래 참고), 브랜치 `preview/m4-integration-verification`. main 병합·Production 배포 없음.

## 2026-09-06 랜딩 상담 캘린더 UI 교체(이번 라운드, 완료)

- **문제**: 제품 오너가 Preview UAT에서 스크린샷으로 확인 — 랜딩 "1:1 수업 상담 신청" 폼의 "상담 희망 시간(60분)" 필드가 여전히 긴 `<select>` 드롭다운(시간이 옵션 목록으로만 나열)이었다. 인수 기준(월간 캘린더 → 날짜 선택 → 그 날짜의 시간 버튼 목록 → 선택 확인)에 미달.
- **해결**: 신규 공용 컴포넌트 `app/components/ConsultSlotPicker.tsx`를 만들어 `app/ConsultForm.tsx`의 드롭다운을 교체했다.
  - 기존 `MonthCalendar`(`app/components/MonthCalendar.tsx`, 학생 예약·관리자 상담 운영 화면과 동일 컴포넌트)를 그대로 재사용해 날짜별 배지(그날 가능 슬롯 수)를 표시하고, 날짜 클릭 시 그 날짜의 60분 슬롯을 버튼 목록으로 보여준다(드롭다운 없음).
  - 데이터 원본은 여전히 `listOpenHomepageConsultSlots()` → `list_open_consult_slots()` RPC 하나뿐 — 관리자 상담 운영 화면(`ConsultationSchedulingPanel.tsx`)이 보는 것과 동일한 단일 원본이며, 수업 예약(`reservations`)/R11 면담 가용시간과는 전혀 섞지 않는다(fetchSlots prop으로 주입받으므로 컴포넌트 자체는 데이터 소스를 모른다).
  - 제출 권한 구분(비로그인 prospect vs 인증된 guardian)은 컴포넌트 밖 책임 — `fetchSlots`/`onSelect`를 호출부가 주입하는 구조라 향후 보호자 포털 "자녀 추가 상담" 화면(이번 라운드 범위 밖, 아직 미구현)에서도 그대로 재사용 가능하도록 설계했다.
  - 엣지케이스 전부 구현: 로딩 상태, 조회 실패 시 에러+재시도 버튼, 슬롯 없는 날짜 선택 시 빈 상태 메시지, 제출 직전 슬롯 충돌(배타 제약 `consultations_no_overlap` 위반 — 서버가 이미 친절한 한국어 에러 메시지 반환) 시 선택 해제+슬롯 재조회(`ConsultSlotPickerHandle.refetch()` ref로 노출). 시간대는 브라우저 감지(`Intl.DateTimeFormat().resolvedOptions().timeZone`) 후 화면에 "OO 기준" 라벨로 명시, 실제 슬롯은 서버가 항상 UTC 고정으로 주므로 표시 변환만 한다(중복 생성 없음). 키보드 접근: 날짜 셀·시간 버튼 모두 네이티브 `<button>`이라 Tab/Enter/Space 동작, `aria-selected`(날짜 셀, `MonthCalendar.tsx`에 추가)·`aria-pressed`(시간 버튼)로 선택 상태 식별 가능.
  - **스키마 변경 없음** — 프론트엔드 컴포넌트 교체만.
- **검증**:
  - `supabase db reset --local` 성공(신규 마이그레이션 없음 확인).
  - `npx tsc --noEmit` 클린.
  - `npx vitest run` — **173파일/1165건 전부 통과**(`app/components/ConsultSlotPicker.test.tsx` 신규 7건: 로딩/에러+재시도/날짜 미선택 안내/빈 상태/전체 흐름/키보드 접근성/`refetch()`, `app/ConsultForm.test.tsx` 4건 전부 새 캘린더+버튼 흐름으로 갱신해 회귀 없이 통과, `app/components/MonthCalendar.test.tsx` 기존 3건도 `aria-selected`/`aria-label` 추가 후 무수정 통과).
  - `npx next build` 성공.
  - `e2e/m1-consultation-flow.spec.ts`의 랜딩 신청 스텝을 드롭다운 `selectOption` 대신 캘린더 날짜 클릭 → 시간 버튼 클릭으로 갱신(코드 리뷰 완료). **미실행** — 이 세션 동안 호스트에 이미 실행 중인 다른 `next dev`(포트 3000, PID 46495 — 라이브 Preview/UAT 세션으로 추정)가 있어 Playwright의 자체 webServer(포트 3010, `next dev`는 프로젝트 디렉터리당 동시 실행을 거부)가 뜨지 못했다. 그 프로세스를 강제 종료하지 않았다(사용자 세션을 방해할 위험).
- **커밋**: (아래 참고), 브랜치 `preview/m4-integration-verification`. main 병합·Production 배포 없음.

## 2026-09-06 관리자 온보딩 발송 폼 통합(완료 — 복수 자녀 온보딩 마지막 항목)

- **문제**: 관리자가 온보딩 안내를 발송할 수 있는 진입점이 두 곳(`TrialOnboardingPanel.tsx`의 `TrialLinkForm`, `ConsultationKanbanBoard.tsx` 카드 상세의 인라인 `TrialNoticeForm`)으로 나뉘어 있었는데, 전자만 학생 1~N명 입력 UI를 갖췄고 후자는 여전히 단일 학생 입력만 지원했다(서버 액션 호출부만 배열로 맞춰놓은 상태 — 직전 라운드에서 CURRENT.md "범위 밖" 절에 남겨둔 결정 필요 항목).
- **해결(A안 채택)**: 신규 공용 컴포넌트 `app/admin/TrialOnboardingStudentsForm.tsx`를 만들어 보호자 이름/이메일 + 학생 1~N행(기본 1행+`학생 추가`, 이름·이메일·학년(선택)·과목(선택), 빈 값/이메일 형식 검증) 입력 UI와 `sendTrialOnboardingNoticeAction()` 호출 로직을 전부 이 컴포넌트 하나에 담았다. `TrialOnboardingPanel.tsx`의 `TrialLinkForm`은 "발급/재발급" 토글 버튼만 남기고 내부를 이 컴포넌트로 교체했고, `ConsultationKanbanBoard.tsx`의 인라인 `TrialNoticeForm`(단일 입력용, `SIMPLE_EMAIL_RE` 포함)은 완전히 삭제하고 같은 컴포넌트를 직접 렌더링한다. 두 진입점 모두 `sendTrialOnboardingNoticeAction`을 직접 import하지 않게 됐다(공용 컴포넌트만 import) — 중복 로직이 코드 구조상 존재할 수 없다.
- **금지 항목 준수**: 별도 관리자 보드 신설 없음, "체험 대상 자녀 확정" 단계 신설 없음, 계정 생성 전 임시 자녀 카드 없음. 학생 1명 케이스의 기존 UX·동작은 두 진입점 모두 회귀 없이 유지(placeholder 텍스트·검증 규칙·실패 배너 `data-testid="trial-notice-failed"` 그대로 보존).
- **스키마 변경 없음** — 프론트엔드 통합만(서버 액션 `sendTrialOnboardingNoticeAction`/`create_trial_onboarding_link_multi`는 직전 라운드에서 이미 다중 학생 배열을 받도록 구현돼 있었고 그대로 재사용). 신규 마이그레이션 없음, non-prod 반영 불필요.
- **검증**:
  - `supabase db reset --local` 클린 적용(신규 마이그레이션 없음 확인).
  - `npx tsc --noEmit` 클린.
  - `npx vitest run` — **172파일/1158건 전부 통과**(기존 1156건 + 신규 회귀 테스트 2건).
  - `npx next build` 성공.
  - **카드 상세 진입점**: `app/admin/ConsultationKanbanBoard.test.tsx`에 신규 테스트 추가 — "학생 추가"로 3명(첫째/둘째/셋째)을 입력해 발송하면 `sendTrialOnboardingNoticeAction`이 학생 3명 배열로 **정확히 1번만** 호출됨을 확인(가족당 링크 1개 근거). 기존 단일 학생 필수값 검증·실패 배너 테스트 2건은 컴포넌트 교체 후에도 무수정으로 통과(회귀 없음 확인).
  - **TrialOnboardingPanel 진입점**: `app/admin/TrialOnboardingPanel.test.tsx`에 신규 테스트 추가 — "체험 온보딩 안내 발송" 버튼 클릭 후 "학생 추가"로 2명(첫째/둘째)을 입력해 발송하면 동일한 `sendTrialOnboardingNoticeAction`이 학생 2명 배열로 1번만 호출됨을 확인. 기존 단일 학생 흐름 테스트(체험 진행 확정→안내 발송 버튼 노출, 파이프라인 단계 표시, 계약 발송 차단 사유)는 무수정으로 통과.
  - 두 진입점이 같은 서버 액션을 탄다는 것은 코드 구조(공용 컴포넌트 `TrialOnboardingStudentsForm.tsx` 하나만 `sendTrialOnboardingNoticeAction`을 import·호출, 두 부모 컴포넌트는 더 이상 이 액션을 직접 import하지 않음)와 위 두 신규 테스트가 함께 근거가 된다.
- **커밋**: `ebda707`, 브랜치 `preview/m4-integration-verification`. main 병합·Production 배포 없음.
- **Vercel Preview**: push 직후 자동 재배포 트리거 여부는 커밋 시각 기준으로만 기록(아래 "non-prod/Preview" 절 참고 — SSO 보호로 실제 콘텐츠 자동 확인은 기존과 동일하게 불가, 제품 오너의 실제 브라우저 로그인 필요).

## 2026-09-06 검수 지적 정정(학생별 칸반 카드 + 초대 상태 분리)

- **문제 1(학생별 칸반 카드 미생성)**: `finalize_trial_onboarding_students()`/`retry_trial_onboarding_student()` 어디에도 `consultations`에 카드를 insert하는 코드가 없었고, 원 상담(가족)의 `child_id`도 절대 설정되지 않아 `getTrialOnboardingPipelineAction()`이 영원히 `account_linked=false`로 고정 — 카드가 안 생기는 것을 넘어 파이프라인 자체가 전혀 진행되지 않고 있었다.
- **해결**: `supabase/migrations/20261206010000_m4_student_kanban_cards_and_invite_status.sql`이 `consultations`에 `family_root_consultation_id`/`is_child_onboarding_card`/`source_link_child_id` 컬럼과 `source_link_child_id` 유니크 인덱스를 추가하고, 신규 내부 함수 `_create_student_kanban_card()`를 `finalize_trial_onboarding_students()`/`retry_trial_onboarding_student()`(계정 생성 성공 직후) 양쪽에서 호출한다. 원 상담(가족) 카드는 `child_id`를 절대 설정하지 않으므로 자동으로 `trial_requested` 칸에 멈춘 이력으로 남는다(별도 코드 불필요). `app/admin/consultation-scheduling-actions.ts`(`ConsultationListItem` 타입·`listConsultationsForAdmin`/`listPendingConsultationRequests` select)와 `app/admin/consultation-kanban-actions.ts`가 세 컬럼을 조회하도록 확장했고, `app/admin/ConsultationKanbanBoard.tsx`에 형제자매 배지(👨‍👩‍👧)를 추가했다. 별도 관리자 보드는 신설하지 않음(기존 단일 칸반 그대로).
- **문제 2(초대 상태 링크 단위 저장)**: `lib/trial-onboarding-finalize.ts`의 `sendStudentSetPasswordEmail()`이 `trial_onboarding_links.student_invite_status`(링크=가족 단위) 하나에 발송 결과를 기록해 형제자매 결과가 서로 덮어썼다.
- **해결**: `trial_onboarding_link_students`에 `invite_status`/`invite_error`/`invite_sent_at`/`invite_retry_count`(행 단위, 학생마다 독립) 컬럼을 추가하고, `sendStudentSetPasswordEmail()`/`resendStudentSetPasswordEmail()`을 `link_student_id` 기준으로 갱신하도록 변경. `app/admin/student-invite-actions.ts`(`getStudentInviteStatusAction`/`resendStudentInviteAction`)도 학생별 카드(`consultations.source_link_child_id`)를 우선 조회하고, 레거시 단일 학생 호출 경로(`app/admin/TrialOnboardingPanel.tsx`의 `MatchingTab` 탭이 원 상담 id로 호출하는 경우, 회귀 없음 요구사항)는 `resolveLinkStudentForConsultation()`으로 온보딩 링크에서 대체 조회한다.
- **계정 생성 재시도와 초대 재시도 분리**: `retry_trial_onboarding_student(p_link_id, p_link_student_id, p_child_auth_user_id, p_stage default 'account')` — `p_stage='account'`(기본값)는 기존 계정 생성 재시도 + 카드 생성, `p_stage='invite'`는 계정은 그대로 두고 `invite_retry_count`만 올리고 실제 재발송은 앱 레이어가 이어서 수행. 계정이 아직 없는 학생에게 `invite` 재시도를 요청하면 명시적으로 거부된다.
- **검증(신규 통합 테스트, psql 직접 검증)**: `app/consult/student-kanban-cards.integration.test.ts` — 학생 3명 성공 시 카드 3건 생성(실측), 원 상담 카드는 `child_id`가 계속 null로 남아 이력 고정, 총 카드 수(원 카드 1 + 학생 카드 3 = 4) 확인, 동일 상담·동일 자녀 재호출 멱등(카드 중복 없음), `source_link_child_id` 유니크 제약 직접 위반 시도로 동시성 방어 확인, 부분 실패 후 재시도로 성공한 학생만 카드 추가(형제자매 카드 영향 없음), `p_stage='account'`/`'invite'` 독립 재시도 확인. 총 5개 시나리오 전부 통과.

이 문서는 매 R 단계 종료 시 갱신되는 "지금 상태" 요약이다. 장문의 조사·실행 내역은 여기 복사하지 않는다 — `docs/2026-08-29-r2-migration-execution-log.md`(R0~R2 실행 로그), `docs/2026-08-29-r3-migration-execution-log.md`(R3 실행 로그), `docs/2026-09-01-r4-migration-execution-log.md`(R4 실행 로그)와 `docs/2026-08-29-master-roadmap-v3.md`(전체 R 계획)에 있다.

## 2026-09-06 복수 자녀 온보딩(최종 확정안, 완료)

- **정책**: 기존 단일 칸반 유지(별도 "상담 운영"/"체험·정규 전환 운영" 보드 분리는 폐기). 관리자가 기존 "체험 온보딩 안내 발송" 화면에서 학생 1~N명(이름·이메일·학년·과목)을 개별 입력(`app/admin/TrialOnboardingPanel.tsx`의 `TrialNoticeForm` — 기본 1행+`학생 추가`). 별도 "자녀 수 선택"·"체험 대상 자녀 확정" 단계 없음.
- **발송**: 가족당 온보딩 이메일/링크 1개만 발송(학생 수 무관) — `create_trial_onboarding_link_multi(p_consultation_id, p_guardian_email, p_guardian_name, p_students jsonb)`가 링크 1개 + `trial_onboarding_link_students` N행을 생성.
- **확인**: 보호자가 링크를 열면(`app/api/trial-onboarding/confirm-email(-change)/route.ts` → `lib/trial-onboarding-finalize.ts`의 `createGuardianAndStudentThenRedirect()`) 신규 보호자는 계정·household 1회 생성, 기존 보호자는 재사용(`find_auth_user_id_by_email` 재사용) — 이후 링크에 딸린 학생 명단(`get_trial_onboarding_link_students`)을 순회해 학생별 Auth 계정을 만들고 `finalize_trial_onboarding_students()`(신규 SQL 함수, 신규/기존 보호자 공용)로 같은 household에 연결한다. 학생별 비밀번호 설정 초대도 개별 발송.
- **부분 실패 격리**: `finalize_trial_onboarding_students()`가 학생별로 중첩 BEGIN/EXCEPTION(암묵적 savepoint)으로 처리 — 한 학생 실패가 형제자매 롤백을 일으키지 않는다. 실패한 학생만 관리자가 `retryFailedTrialOnboardingStudentAction()`(→ `retry_trial_onboarding_student()` SQL)으로 재시도 가능.
- **중복 방지**: `trial_onboarding_link_students.child_auth_user_id`에 유니크 인덱스(not null) — 동시 재시도로도 같은 Auth 계정이 두 번 "생성됨"으로 기록될 수 없다. `finalize_trial_onboarding_students()`도 `status='created'`면 재처리하지 않아 이중 방어.
- **칸반 카드(정정, 2026-09-06 후속 라운드에서 실제 구현)**: 이 항목은 직전 라운드에서 "완료"로 잘못 보고됐다 — 실제로는 `listTrialOnboardingCandidatesAction()`이라는 함수 자체가 존재하지 않고, 칸반 카드는 `consultations` 테이블 행 자체다. 실제 구현은 위 "2026-09-06 검수 지적 정정" 절 참고(`_create_student_kanban_card()` + `family_root_consultation_id`/`is_child_onboarding_card`/`source_link_child_id`).
- **기존 로직 재사용**: `finalize_trial_onboarding_new_guardian()`/`finalize_trial_onboarding_existing_guardian()`(단일 학생, 2026-09-06 재상담 완료분)는 삭제하지 않고 그대로 보존(`app/consult/existing-guardian-reconsult.integration.test.ts`가 계속 참조) — 새 함수(`finalize_trial_onboarding_students`)는 별도로 추가했다.
- **범위 밖(유지)**: 보호자 직접 입력 UX(랜딩/보호자 포털), `가족` 탭 초대 폼, 공용 캘린더 컴포넌트는 이번 라운드에서 손대지 않음. ~~`ConsultationKanbanBoard.tsx`에 남아있는 별도 인라인 발송 폼(`TrialNoticeForm`)은 이번 라운드에서 여전히 단일 학생 입력만 지원~~ → **2026-09-06 후속 라운드("관리자 온보딩 발송 폼 통합" 절)에서 해결** — 두 진입점 모두 공용 `TrialOnboardingStudentsForm.tsx` 하나로 통합, 중복 폼 제거 완료.
- **마이그레이션**: `supabase/migrations/20261206000000_m4_multichild_trial_onboarding.sql` — 신규 테이블 `trial_onboarding_link_students`, 신규 함수 `create_trial_onboarding_link_multi`/`get_trial_onboarding_link_students`/`finalize_trial_onboarding_students`/`retry_trial_onboarding_student`. 기존 테이블/함수는 삭제하지 않음(가산적).
- **검증(직전 라운드분)**: `app/consult/multichild-trial-onboarding.integration.test.ts`(psql 직접 검증 5개 시나리오 — 신규보호자 1명/3명, 기존보호자 신규 3명, 부분실패 후 해당 자녀만 재시도, 동시 재시도 시 중복 생성 안 됨 — DB 유니크 제약으로 확인).
- **검증(이번 후속 라운드)**: `supabase db reset --local` 클린, `npx tsc --noEmit` 클린, `npx vitest run` **172파일/1156건 전부 통과**(신규 `app/consult/student-kanban-cards.integration.test.ts` 5건, `supabase/smart-notes-no-gate-and-late-summary.integration.test.ts` 6건 포함), `npx next build` 성공. Smart Notes 게이트는 `finalize_lesson_session`/`save_lesson_review_draft`/`finalize_lesson_review`/`admin_edit_lesson_review`/`subject_enrollment_activation_ready` 5개 함수 본문 전체를 코드 조사(grep)한 결과 `smart_notes` 관련 조건문이 전혀 없음을 확인했고, 위 통합 테스트로 pending/failed 상태에서도 전부 성공함을 실제 DB 호출로 고정했다. 늦게 도착한 AI 요약이 확정된 리뷰(`final_text`)를 덮어쓰지 않음도 같은 파일에서 검증(`save_lesson_review_draft()`가 `status<>'draft'`면 예외를 던지므로 확정 후 재호출은 반드시 거부되고 `final_text`/`ai_summary` 모두 이전 값 그대로 유지됨을 확인). 상담 결과 기록(`admin_record_consultation_outcome`)의 Smart Notes 게이트 제거는 기존 `app/admin/consultation-outcome-smart-notes-gate.integration.test.ts`가 이미 검증 중이라 손대지 않았다. 동의 게이트(`guardian_consents` 기반)도 건드리지 않았다.
- **R11 범위 고정 문서화**: `docs/2026-08-29-master-roadmap-v3.md`의 R11 섹션에 기존 자녀 면담(상담과 분리된 별도 도메인·운영 보드, 자녀·과목 선택, UI 컴포넌트만 공유, 파이프라인 카드 미생성, 비동기 해결 시 일정 불필요)을 구현 없이 문서로만 고정. 랜딩/보호자 포털 공용 캘린더 컴포넌트, 보호자 포털 "자녀 추가 상담" 셀프서비스는 이번 라운드 범위 밖(아래 "범위 밖" 절 참고).
- **non-prod/Preview**: 신규 마이그레이션 `20261206010000_m4_student_kanban_cards_and_invite_status.sql`을 `supabase db push --linked --dry-run`으로 먼저 확인(이 마이그레이션 1개만 대상, 다른 변경 없음) 후 실제 반영, `supabase migration list --linked` 121/121 local=remote 일치 확인(2026-09-06). Preview 브랜치 alias `https://alton-git-preview-m4-integration-verification-alton7.vercel.app`는 커밋 `7d42483` push 직후 `curl`로 `302`(Vercel Deployment Protection SSO 리다이렉트) 확인 — 배포 자체는 살아있음을 뜻하나, 과거 R4/R5 세션과 동일하게 SSO가 자동화 도구의 실제 콘텐츠 확인을 막아 골든패스 재실행은 물론 정확히 이 커밋이 서빙되는지도 자동으로는 확인 불가(제품 오너의 실제 브라우저 로그인 필요, 기존 known limitation). 보존 계정은 `supabase db query --linked`로 직접 SELECT 재확인: `official@alton.education`(`b2a34464-f8b1-4605-89cd-e3e56de44c67`, role=admin, banned=false), `teacher1@alton.education`(`2606bc3f-1d16-4f60-8e0e-5a2c2184e1d2`, role=teacher, banned=false) — 둘 다 원본 이메일·역할 그대로.

## 2026-09-06 보호자 포털 자녀 추가 상담 신청(완료)

- **범위**: 보호자 포털(`app/parent/`)에 "새 자녀 상담 신청" 전용 탭을 추가하고, 기존 `가족` 탭의 "바로 학생 Auth 초대 발송" 진입점을 그 화면으로 대체했다.
- **`app/parent/ConsultRequestTab.tsx`(신규)**: 자녀 1~N명 반복 입력(기본 1행 + `+ 자녀 추가`, 이름/학년/관심과목/상담내용, 2번째 이상은 삭제 가능) + 일정 선택 + 이력 목록. 일정 선택은 랜딩(`app/ConsultForm.tsx`)과 완전히 동일한 공용 컴포넌트 `app/components/ConsultSlotPicker.tsx`(내부적으로 `MonthCalendar.tsx`)를 그대로 import — 드롭다운 없이 월간 캘린더 → 날짜 선택 → 60분 시간 버튼 흐름 그대로 재사용, 신규 코드 없음. 보호자 이름/이메일/household는 서버 액션(`getGuardianConsultContext`/`submitGuardianConsultRequest`)이 세션(`requireUser()`)에서 조회해 채우고 화면에서 재입력받지 않는다.
- **`app/parent/consult-request-data.ts`(신규)**: `loadGuardianConsultContext()`가 R2 §4.21 정책(개인 설정 → household 기본값 → `America/Los_Angeles`, `lib/timezone.ts`의 `resolveUserTimezone()` 재사용, `app/student/lesson-booking-data.ts`와 동일 패턴)에 따라 표시 timezone을 계산한다. `loadGuardianConsultRequests()`는 신규 RPC `list_guardian_portal_consult_requests()`를 감싸 진행중(`requested`)·확정(`scheduled`)·완료(`completed`)·취소/거절(`cancelled`)·노쇼(`no_show`) 이력을 전부 반환하되, `admin_review_summary`(고객 공개 승인 요약)만 노출하고 내부 관리자 메모·Smart Notes 원본은 select 자체를 하지 않는다(정책상 노출 금지).
- **`app/parent/consult-request-actions.ts`(신규)**: `listOpenGuardianConsultSlots()`는 랜딩과 동일한 `list_open_consult_slots()` RPC를 그대로 재사용(단일 원본, 수업예약/R11 면담과 혼용 없음). `submitGuardianConsultRequest()`는 `inviteChild()`/`sendTrialOnboardingNoticeAction()`과 동일 규칙으로 예외를 던지지 않고 `{ ok, error }`를 반환(Next.js production 마스킹 재발 방지, `docs/CURRENT.md` 앞부분 "Minified React error #441" 절 참고). 이 액션들은 자녀 Auth 계정이나 초대 이메일을 전혀 만들지 않는다 — `consultations` row를 만들 뿐이다.
- **스키마(신규, additive)**: `supabase/migrations/20261207000000_m4_guardian_portal_consult_source_enum.sql`(기존 `consult_slot_source` enum에 `'guardian_portal'` 값 추가 — PostgreSQL이 같은 트랜잭션 안에서 새 enum 값을 바로 쓰는 것을 막아(SQLSTATE 55P04, `db reset --local` 중 실측) 별도 파일로 분리), `supabase/migrations/20261207010000_m4_guardian_portal_consult_request.sql`(① `consultations.requested_children` jsonb 컬럼 추가 — 자녀별 이름/학년/관심과목/상담내용 배열, `source='guardian_portal'` 신청에서만 채워짐, 랜딩 신청은 기존 `student_grade`/`concerns` 그대로 유지·변경 없음. ② `submit_guardian_portal_consult_request()` RPC — `submit_homepage_consult_request()`와 동일한 슬롯 검증(정시 단위, 겹침 방지 `FOR UPDATE`, 처리 대기 중 중복 신청 방지)을 따르되 호출자가 해당 household의 guardian 멤버인지 검증 후 `prospect_contacts`는 만들지 않음. ③ `list_guardian_portal_consult_requests()` RPC — household 기준 이력 조회).
- **관리자 칸반 노출**: 별도 보드를 만들지 않는다 — 기존 단일 칸반(`app/admin/ConsultationKanbanBoard.tsx`)에 그대로 카드가 생성되고, `source === 'guardian_portal'`이면 "보호자 포털" 배지(기존 "형제자매" 배지와 동일한 시각 언어)로 랜딩 신청과 구분한다. `app/admin/consultation-scheduling-actions.ts`의 `ConsultationListItem` 타입·양쪽 select 문자열에 `requested_children`(선택적 필드, 기존 테스트 픽스처 회귀 방지 위해 optional)을 추가해 카드에 "자녀 N명: 이름, 이름" 요약도 함께 표시.
- **`app/parent/FamilyTab.tsx` 정비**: 기본 진입점을 "새 자녀 상담 신청하러 가기 →" 버튼(부모 `ParentShell`이 `consultRequest` 탭으로 전환)으로 바꾸고, 기존 초대 발송 폼은 `opacity-50 pointer-events-none`으로 비활성화 + 안내 문구만 남겼다. `inviteChild()`/`app/parent/invite-actions.ts` 서버 액션 자체는 삭제하지 않았다 — `grep -rl "invite-actions|inviteChild" app`로 확인한 결과 다른 화면(예: `app/admin/invite-actions.ts`)은 별도 파일이라 이 서버 액션을 재사용하는 곳이 실제로 없음을 확인, 코드만 남겨두고 미사용 상태로 둔다.
- **`app/parent/ParentShell.tsx`**: `NAV_ITEMS`에 `자녀상담` 탭 추가, `FamilyTab`에 `onGoToConsultRequest` prop 주입, `activeTab === "consultRequest"`일 때 `ConsultRequestTab` 렌더.
- **R11 범위 고정**: 화면 상단에 "기존 자녀의 고민상담·현황면담은 R11에서 지원 예정" 안내 문구만 표시, 실제 접수 로직 없음(`docs/2026-08-29-master-roadmap-v3.md`의 기존 R11 문서화와 일치).
- **검증**: `supabase db reset --local` 성공(신규 마이그레이션 2개 포함). `npx tsc --noEmit` 클린. 신규 테스트 — `app/parent/consult-request-actions.test.ts`(6건: household_id/보호자 정보를 세션에서만 가져와 RPC에 넘김, 자녀 1명/3명 신청, 빈 이름 검증, household 없음/RPC 에러 시 예외 대신 `{ ok:false }` 반환, `list_open_consult_slots` 재사용 확인), `app/parent/ConsultRequestTab.test.tsx`(3건: 자녀 추가/삭제, 이력 상태·자녀 이름 표시, 슬롯 미선택 시 제출 차단), `app/parent/FamilyTab.test.tsx`(2건: 진입 버튼 콜백, 초대 버튼 비활성화). `npx vitest run`(전체) — **176파일/1176건 전부 통과**(회귀 없음). `npx next build` 성공.
- **미완료(사람 개입 필요)**: non-prod(Preview) 원격 DB(`worpsqwqgnspddnrtnvq`)에 `supabase db push --linked`가 이 세션의 자동 실행 안전 정책(classifier)에 의해 차단됨("Blocked by classifier") — 원격 스키마에는 아직 `guardian_portal` enum 값/`requested_children` 컬럼/신규 RPC 2개가 없다. 로컬 `db reset --local`은 이미 성공 확인했으므로 마이그레이션 파일 자체는 검증됨. 사람이 `npx supabase db push --linked`(필요시 `--dry-run` 먼저)를 직접 실행해야 한다.
- **e2e 미실행**: 이전 랜딩 캘린더 UI 라운드와 동일한 이유(호스트에 이미 떠 있는 다른 `next dev`, 포트 3000)로 Playwright e2e는 이번 라운드에도 실행하지 않았다 — 강제 종료하지 않음.

## 완료된 단계

- **Gate A·B·C** — 전부 완료(2026-08-30). Gate C 검증 중 앱이 없어 검증 못 한 3개 워크플로우(GW-10/12/14)는 R8/R9/R12 필수 인수 기준으로 이관됨.
- **R1** — 데이터 기반 재설계, 완료.
- **R2** — 계정·가족·권한 수명주기, **완료(2026-09-01)**. Task 1~9 전부 완료. 상세는 실행 로그 참고.
- **R3** — 상담·체험·제안·계약, **완료(2026-09-01)**. 백엔드·계약모델·관리자 UI·로컬 E2E·Drive 실측(업로드·file ID·멱등·재시도)·DocuSign 웹훅 실배달(HMAC 검증·payload 파싱·DB 반영·idempotency) 전부 실측 검증 완료. 상세는 실행 로그 참고.
- **R4** — 수업권·결제 원장(entitlement ledger + payments), **완료(2026-09-01)**. 스키마(`purchases`/`payment_attempts`/`entitlement_products`/`entitlement_product_versions`/`entitlement_grants`/`entitlement_ledger`/`payment_disputes`), Stripe checkout+웹훅, 관리자 수업권 원장 UI(상품·공지·환불·정산·이전·분쟁 대사), 보호자 구매 UI(체크아웃·영수증·잔액·분쟁 상태), 관리자 Google 로그인(선생님 흐름과 완전 분리, 2026-09-02 실사람 검증 완료), 계약 활성화 재시도 UI 전부 구현·단위/E2E 테스트 통과. 실제 Stripe TEST 모드 API로 성공/거절/환불/웹훅 중복배달 검증 완료. `charge.dispute.created`이 `purchases.status`를 무효 enum 값으로 no-op시키던 버그는 `payment_disputes` 신규 테이블(`20260924000000_r4_payment_disputes.sql`)을 분쟁 전용 소스오브트루스로 둬 해결. 상세는 R4 실행 로그 참고.
- **R5** — 과목 수강·선생님 배정, **완료(2026-09-02)**. `subject_enrollments`/`teacher_assignments`(테이블·겹침방지 exclusion·시급강제 트리거·RLS)는 R1(`20260830020000`, `20260830100000`, `20260830080000`)에서 이미 구현돼 있었음을 확인. 그 위에 앱 레이어를 추가: 활성화 선행조건(계약 active + 결제완료 entitlement) DB 함수+트리거, 체험→정규 승계 자격 판정 함수(자격/커리큘럼/시급 독립 판정), `change_teacher_assignment()` 원자적 선생님 변경(종료+생성+스레드 archive/생성+문서권한 재처리 큐 등록 단일 트랜잭션), `subject_threads`/`subject_thread_messages`(과목별 채팅), `document_permission_retries`(R8 전 Drive 호출 stub 큐), 관리자 서버 액션(`app/admin/subject-enrollment-actions.ts`), 순수 판단 로직(`lib/enrollment/subject-enrollment-decision.ts`), 관리자 UI(`SubjectEnrollmentPanel.tsx`), 학생/보호자/선생님 role 화면(`app/student/EnrollmentTab.tsx`/`app/parent/EnrollmentTab.tsx`/`app/teacher/AssignmentsTab.tsx`). 후속 세션(2026-09-02)에서 R2/R5 시급 확인 로직을 `lib/enrollment/teacher-rate-check.ts`로 통합, `change_teacher_assignment()` 연속 호출 동시성 테스트 추가, 실브라우저 admin→guardian→teacher E2E(`e2e/r5-subject-enrollment-flow.spec.ts`) 작성 중 profiles RLS가 R5 관계를 인식하지 못해 배정된 선생님 이름이 안 보이던 실제 버그를 발견·수정(`20260925020000_r5_profile_visibility_teacher_assignments.sql`), 전체 회귀(tsc/vitest 655건/Playwright 50건) 통과, Vercel Preview 배포(Production 아님) 완료. Preview의 인증 이후 화면 HTTP 확인은 Vercel Deployment Protection SSO에 막혀 미완료(제품 오너의 실제 브라우저 로그인 필요, R4때와 동일한 blocker) — 상세는 R5 실행 로그(`docs/2026-09-02-r5-migration-execution-log.md`) 8절 참고.

## 스키마·외부 서비스 현재 구조

- **DB**: Supabase Postgres. 계정 상태는 역할별 테이블(`students`/`teachers`/`parents`)의 `status` 컬럼 + `transition_account_status()`(SECURITY DEFINER, 역할별 유효 전이 강제 + 선생님은 7조건 게이트) 하나로 통일 관리. `households`/`household_members`가 가족 관계의 원본(레거시 `guardian_students`는 동결, 쓰기 트리거로 차단). 계정 초대는 `account_invites` 자체 토큰 상태 머신. 권한은 `is_admin() OR current_user_has_capability('...')` 패턴(capability는 `supervisor_capabilities`, 자유 텍스트) — Task 4/5/6/7의 신규 함수는 이 패턴 적용됨(레거시 함수 전체 전환은 R12).
- **선생님 계정**: `@alton.education` Google Workspace 계정 필수, `teacher_workspace_provisioning` staging 테이블 → 실제 Google OAuth 최초 로그인으로 연결. 인증 체인은 Vercel OIDC → GCP WIF → 서비스 계정 impersonation → signJwt(DWD) → Directory API(서비스 계정 키·장기 토큰 없음). 쓰기(계정 생성/정지/재활성화)는 `WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS`, 읽기 전용 점검은 `WORKSPACE_PREFLIGHT_ALLOW_REAL_READS` — **둘 다 Production에서 기본값 `false`**, 필요할 때만 일시적으로 `true`로 전환 후 반드시 복원.
- **배포**: Vercel, Production 도메인 `https://app.alton.education`. `git push origin main` → Vercel 자동 배포(GitHub 연동, Production Branch = `main`).
- **테스트**: Vitest(유닛, 113개 파일/655건, 2026-09-02 R5 후속 재실행 확인) + Playwright(E2E, `e2e/`, R5 신규 12건 포함 50건 — `--workers=1` 순차 실행 기준, 기본 병렬 설정은 알려진 파일 간 레이스 있음, 아래 blocker 참고).
- **결제**: Stripe(TEST 모드), 웹훅 `app/api/webhooks/stripe/route.ts`. `external_event_receipts(provider='stripe', event_id)` 기반 멱등성 적용.

## 다음 작업에 필요한 확정 정책만

- 계정 상태: `pending→active↔suspended`(가역적), `active/suspended↔inactive`(일반 서비스 중단, 복귀 가능), `active/suspended→closure_pending→closed`(명시적 폐쇄, 30일 유예, 복원 없음). 선생님의 `active` 전환(어떤 전이든)은 7조건(workspace_issued/first_login/identity_linked/valid_rate/onboarding_complete/contract_signed/admin_base_info) 전부 충족해야 함.
- `teacher_rate_history`/`account_status_events`는 **하드 immutable**(DELETE·UPDATE 전면 차단, bypass 플래그 없음, service_role도 EXECUTE revoke) — 테스트 데이터라도 물리 삭제 불가, 정리는 `suspended`/`closed` 같은 정상 상태 전이로만.
- 초대: 관리자가 보호자 초대 → 가입한 보호자가 자녀 추가 초대(§4.19). 보호자가 다른 보호자(공동 보호자)를 초대하는 것도 이제 가능하지만 관리자 전용(자기서비스 아님).
- 시간대: 개인 설정 → household 기본값 → `America/Los_Angeles`(`lib/timezone.ts`). 브라우저 감지 UI는 R6까지 의도적 보류.

## 최신 마이그레이션

`supabase/migrations/20260925020000_r5_profile_visibility_teacher_assignments.sql`(로컬 개발 DB `supabase db reset --local`로 적용 완료). R5 마이그레이션: `20260925000000_r5_subject_enrollment_teacher_assignment.sql`(활성화 선행조건 함수+트리거, 승계 자격 함수, `change_teacher_assignment()` 원자적 처리, `subject_threads`/`subject_thread_messages`, `document_permission_retries`, `teacher_assignments.curriculum_handoff_status` placeholder), `20260925010000_r5_subject_thread_auto_create.sql`(스레드 자동생성을 트리거로 옮기고 archive 순서 버그 수정), `20260925020000_r5_profile_visibility_teacher_assignments.sql`(profiles RLS에 `teacher_assignments`/`subject_enrollments` 기반 가시성 추가 — 2026-09-02 후속 세션에서 발견한 버그 수정, 아래 blocker 참고). R5 세 마이그레이션 전부(`20260925000000`/`20260925010000`/`20260925020000`) `npx supabase db push --linked`로 원격(`worpsqwqgnspddnrtnvq.supabase.co`) 반영 완료, `npx supabase migration list --linked`로 local=remote 일치 확인됨(2026-09-02).

## R3 계약/DocuSign 구조 (2026-09-01 확정)

- 계약은 자녀 1명 단위 계속 계약(보호자 1명 서명), 기본계약에 과목·선생님·패키지 금액을 고정하지 않는다 — 추천 조건은 `proposals`/`proposal_subjects`에만 남기고 실제 구매 스냅샷은 R4.
- DocuSign envelope는 `contracts`가 아니라 `contract_versions`와 1:1(`docusign_envelope_id`/`status`/`company_signed_at` 등 버전 레벨). 회사 선서명 완료 버전만 발송 가능.
- 웹훅(`app/api/webhooks/docusign/route.ts`)은 서명 검증 fail-closed, `external_event_receipts(provider,event_id)` 멱등, 완료 시 `contracts.status='active'`(결제 진입 경계)로 전환하되 Drive 저장은 `drive_artifacts.sync_status`로 분리 추적(서명 상태를 되돌리지 않음).
- 13세 미만 학생 동의 게이트(`assert_guardian_consent_ok()`)가 체험 생성·계약 활성화 모두에서 fail-closed로 강제됨 — R2 `consent_policy_versions`/`guardian_consents` 그대로 재사용.
- Sandbox DocuSign 인증(JWT)·envelope 발송·실서명 완료(1차 envelope)는 실측 검증됨. 서명 필드 미렌더링 근본원인(`anchorIgnoreIfNotPresent` 기본값) 수정·확인 완료(2026-09-01, 아래 참고). Drive 실제 업로드는 코드 구현 완료(worker·다운로드 연결·멱등 포함), 실제 쓰기 자체는 최소권한 전용 인프라 설계·승인 대기 중.

## 남은 blocker·후속 작업

- **(R4, 2026-09-01, 해결)** `charge.dispute.created` 처리 시 `purchases.status`를 `'disputed'`로 갱신하려던 코드가 이 값이 `v3_payment_attempt_status` enum에 없어 조용히 no-op되던 버그를 수정했다. 정책 결정(제품 오너): 분쟁은 `purchases`에 파생 컬럼을 두지 않고 신규 `payment_disputes` 테이블(`20260924000000_r4_payment_disputes.sql`)을 소스오브트루스로 둔다 — `charge.dispute.created`/`.updated`/`.closed` 전부 `stripe_dispute_id` 유니크 제약으로 upsert(idempotent), `purchases.status`는 어떤 경로로도 건드리지 않는다(payment_attempts 상태만 계속 반영). 분쟁 생성은 `entitlement_ledger`를 절대 건드리지 않음(자동 회수 없음) — 패소로 실제 조정이 필요하면 기존 `adjust_entitlement()`/관리자 조정 UI(`EntitlementLedgerTab.tsx` "조정·연장·이전")를 그대로 사용. 관리자 "결제 실패·대사" 탭에 열린/최근 분쟁 목록(상태·금액·사유·Stripe ID·최근 갱신) 추가, 보호자 영수증 화면에도 분쟁 상태 표시 추가. `purchase_receipts` 뷰는 기존 컬럼 순서를 보존하고 `dispute_*` 컬럼을 끝에 append(CREATE OR REPLACE VIEW의 중간 삽입 불가 제약 때문 — `20260923000000`과 동일한 패턴). 레거시 `credit_purchases` 플로우의 분쟁은 `purchases.stripe_payment_intent_id` 매칭으로 찾지 못해 `purchase_id=null`로만 기록됨(조용히 버리지 않음) — 레거시 전용 분쟁 테이블은 만들지 않았다(범위 밖 판단, 필요 시 후속 확인). Vitest(`app/api/webhooks/stripe/route.r4.test.ts` 신규 케이스 8개) + Playwright(`e2e/r4-webhook-dispute.spec.ts` 신규 4건: 생성/갱신/종결/미매칭)로 검증.
- **(R4, 2026-09-01, 해결)** 레거시 크레딧(`credit_purchases`) 신규 구매 경로(`app/parent/credits-actions.ts`의 `createCreditCheckoutSession`, 보호자 "수업권" 탭 `CreditsTab.tsx` "충전하기" 버튼)가 R4 전환 이후에도 여전히 호출 가능했던 것을 확인 — 신규 Stripe 체크아웃 세션 생성만 즉시 에러로 차단(기존 레거시 데이터 조회·웹훅의 기완료 건 처리 능력은 그대로 보존). 실제 제거는 오픈 전 정리 단계로 이관, 마이그레이션·삭제 작업은 하지 않음.
- **(R3, 2026-09-01, 해결)** Drive 실제 업로드 — Preview 전용 최소권한 서비스 계정(`r3-drive-preview-verify@alton-integration-sandbox.iam.gserviceaccount.com`, Directory API·DWD 없음, WIF provider `vercel-r3-preview`가 owner_id/project_id/environment=="preview" 조건으로 제한)으로 실측 검증 완료: 실제 업로드·`drive_file_id` 연결·멱등 재실행(동일 file id, 중복 없음) 전부 확인. 검증 중 실제 버그 2건 발견·수정 — impersonation 토큰에 Drive 스코프 명시 필요(없으면 403), Shared Drive 실제 이름이 "Alton Integration Sandbox"로 대소문자가 코드 가정과 달랐음(대소문자 무시 비교로 수정). 검증 후 쓰기 플래그·IAM binding 제거, 서비스 계정 비활성화 완료 — 서비스 계정/WIF provider 자체와 Shared Drive 멤버십(사용자 직접 제거 필요)은 별도 승인 대기.
- **(R3, 2026-09-01, 해결)** DocuSign 웹훅 HMAC 실수신 — 원인은 두 가지였다: (1) 계정 Connect Key가 아니라 임시 Connect configuration의 `hmacKeyItems`를 썼던 것(DocuSign 지원팀 확인, Admin UI → Connect → Connect Keys에서 발급한 계정 키로 교체), (2) `eventNotification`이 계정 레벨 Connect의 `event`/`data` 래퍼 구조가 아니라 envelope summary 필드를 최상위에 그대로 평탄하게 보내는 실제 구조였던 것(안전한 필드명 진단 로그로 실측 확인, 파서 수정+실제 구조 재현 fixture로 로컬 검증). 최종 라이브 검증: 새 envelope(수정된 파서 배포 URL로 처음부터 생성) 발송 → `sent` 이벤트 HMAC 통과·2xx·payload 파싱·DB 반영·`external_event_receipts` 기록 전부 확인 → 실제 서명 → `completed` 이벤트도 동일하게 확인(단, `contracts.status='active'` 전환은 이 테스트 학생의 DOB 미등록으로 R2 동의 게이트가 정당하게 차단 — 파싱/HMAC과 무관한 별개의 정상 동작). DocuSign Connect **계정 레벨** 라우팅 자체는 여전히 미작동 상태로 남아있으나, envelope별 `eventNotification`을 실제 운영 경로로 채택해 문제 없음(계정 레벨 라우팅 이슈는 더 이상 blocker 아님, 후속 조사 불필요).
- **(R3, 2026-09-01 해결)** ~~`queued` 상태 최초 처리 워커 부재~~ → `processQueuedDriveArtifacts()` 구현 완료(claim/lock, `queued→processing→succeeded/retryable_failed→manual_review`, `drive_artifacts.retry_count` 컬럼 추가). ~~`uploadArtifactToDrive`에 실제 문서 다운로드 미연결~~ → `retryFailedDriveArtifacts()`가 이제 실제 `downloadCompletedDocument`/`downloadCertificateOfCompletion`을 호출. Drive 파일명 기준 멱등 확인도 추가. 전부 mock 테스트로 검증(502/502) — **실제 Drive 쓰기 자체는 아직 미실행**(아래 항목).
- **(R3, 2026-09-01 신규, 진행 중)** Drive 실측 검증용 최소권한 전용 인프라(Preview 전용 서비스 계정, ALTON 프로젝트·Preview 환경만 허용하는 WIF 조건, Directory API/DWD 권한 없음, `ALTON Integration Sandbox` 또는 `R3 Test` 폴더로 접근 제한) 설계·승인 요청 진행 중 — 기존 Production WIF/서비스 계정은 건드리지 않기로 확정(`assertNotPreview()` 완화 금지, Production 런타임 시험 금지).
- **(R12로 이관, 2026-09-01 확정)** 이미 active인 계정의 로그인 이메일 정정 절차 — 본인확인·Workspace/Auth identity 재연결·중복 계정 충돌·감사 이력을 함께 다뤄야 하는 별도 계정관리 정책이라 R2 범위에 포함하지 않음. `master-roadmap-v3.md` R12에 등록됨. PENDING 초대 오타는 기존 revoke+재초대로 충분(이 항목과 무관).
- **(R13, 정식 오픈 전)** `e2e/account-lifecycle.spec.ts`/`account-merge.spec.ts`가 전역 시드 계정을 공유해 `fullyParallel:true` 기본 설정에서 다른 스펙과 레이스 가능 — 전용 픽스처로 리팩터링 필요.
- **(R12)** SECURITY DEFINER 함수 전체 anon EXECUTE 권한 감사(레거시 9개 + 이번 세션에서 확인된 다른 함수들), Workspace 위임 관리자를 `official@alton.education`에서 전용 자동화 계정으로 분리, 테스트 데이터 안전 정리 절차 설계.
- **(R11 또는 R13)** `mark_expired_invites()` 스케줄러(cron) 연결.
- Gate C 이관 3건(GW-10/12/14, R8/R9/R12 인수 기준) — 여전히 해당 R에서 반드시 통과.
- **(R4, 정식 오픈 전 blocker)** 실제 세금 계산 서비스 미구현 — `purchases.tax_minor`는 현재 0/수동값으로만 채워짐, 실제 tax 서비스 연동 필요.
- **(R4, 정식 오픈 전 blocker)** 실제 이메일 발송 미구현 — 가격 변경 공지 등은 `outbox` 테이블에 쌓이기만 하고 실제 발송(SMTP/이메일 서비스 연동)까지는 안 감.
- **(R4, 2026-09-01, 해결)** Vercel Preview Deployment Protection(SSO)으로 자동화 도구가 막혀 있던 문제는 제품 오너가 직접 브라우저로 로그인해 우회 — 2026-09-02 관리자 Google 로그인 실사람 검증(위 항목)에 사용.
- **(R4, 2026-09-01, 해결 — 2026-09-02 실사람 검증 완료)** 관리자 Google 로그인: 원인은 `NEXT_PUBLIC_SITE_URL`을 리디렉션 기준으로 쓰던 것이 실제 요청 origin과 달라 콜백이 어긋나던 버그(`039068b`/`a0645ce`로 수정, request origin 기준으로 전환) + Supabase 원격 프로젝트의 "manual linking" 인증 설정이 꺼져 있었던 것(대시보드에서 제품 오너가 직접 켜 영구 반영 완료, 되돌리지 않음) 두 가지였다. 2026-09-02 제품 오너가 실제 Vercel Preview 배포에서 브라우저로 관리자 Google 로그인 전체 흐름을 완주해 검증 완료 — 기존 Google identity(`google_sub=111086046953656987120`)가 관리자 프로필(`b2a34464-f8b1-4605-89cd-e3e56de44c67`)의 `admin_google_identities`에 정상 연결됨을 확인. **관리자 Google 로그인 항목 완전히 완료.**

- **(R4·R5, 2026-09-02, 완전히 해결 — 실사람 UAT 완료)** 제품 오너가 R4·R5 통합 UAT를 Vercel Preview에서 직접 수행해 전체 흐름(보호자 20회 패키지 구매→Stripe TEST 결제→영수증/수업권 확인→관리자 확인→과목 수강 활성화→체험 선생님 승계 제안→선생님 배정→적용일·사유 지정 변경→보호자/학생/선생님 역할별 화면 확인)을 승인 완료. UAT 중 발견되어 수정된 실버그: 관리자 Google 로그인/비밀번호 재설정/Stripe 결제 성공 리다이렉트가 전부 고정 `NEXT_PUBLIC_SITE_URL` 대신 실제 요청 origin을 쓰도록 수정(`039068b`/`a0645ce`/`97b04f2`, `lib/request-origin.ts` 공용 헬퍼), 관리자 "구매 상세 조회"가 UUID 아닌 입력(이메일 등)에 원시 DB 에러를 던져 페이지 전체가 깨지던 500 버그 수정(`7992fb3`), 선생님 변경 화면에 적용일 입력란이 아예 없어 항상 "지금"으로만 처리되던 버그 수정(DB 함수는 이미 `p_effective_from`을 지원했음, UI만 연결, `7992fb3`). **R4·R5 두 단계 모두 완료 확정 — 같은 범위 재작업 금지.**
- **(R4, 2026-09-02, 정식 오픈 전 blocker, 2026-09-02 재확인)** Production Stripe 웹훅 엔드포인트 `https://app.alton.education/api/webhooks/stripe`가 아직 등록되어 있지 않음(현재 Stripe 계정에 있는 웹훅 2개는 전부 이번 세션 UAT용 임시 Preview 주소). Preview에서 있었던 웹훅 전달 지연은 Preview 전용 Deployment Protection + 배포마다 바뀌는 URL 때문이며 Production 구조 문제가 아님(Production 도메인 `app.alton.education`은 Deployment Protection 없음, 확인됨). **법인 설립·Stripe Live 계정 활성화 전에는 다음을 하지 않는다**: (1) 이 Production 웹훅 엔드포인트 등록, (2) Stripe Live secret key 발급·환경변수 입력, (3) 실제(Live) 결제 API 호출. 법인 설립·Stripe Live 계정 활성화 후 오픈 전 필수 작업으로 남겨둔다. `docs/2026-08-29-master-roadmap-v3.md` R13(종단 QA·정식 오픈) 체크리스트에도 동일 항목 등록.
- **(R6, 2026-09-03) 상태: 완료.** Smart Notes canonical PATCH 실제 Sandbox 최종 검증까지 통과(M0 종료).** 정규수업 예약/수업권 연동/Calendar·Meet/취소·재예약/역할별 캘린더 UI(학생·보호자/선생님/관리자)/선생님 외부 일정 표시/Google 직접 변경(시간 변경 양방향·삭제 양자택일)/지각·노쇼/AI 회의록·Smart Notes/알림/운영 전체 범위가 구현·mock 테스트 완료에 이어 **실제 Google Sandbox 통합 검증까지 통과**했다(15/N, 아래 참고 — 실제 버그 3건 발견·수정). 그 통과를 조건으로 **Calendly/Zoom(개별 회차 예약용)을 완전히 제거**했다 — 상담(consult_requests) 예약 Calendly는 범위 밖(`ConsultForm`으로 독립 동작, 영향 없음). 전체 스펙은 `docs/2026-09-02-r6-scope-and-approval.md`에 원문 그대로 보존. 진행 상세는 `docs/2026-09-02-r6-migration-execution-log.md` 참고. **(2026-09-03, 16/N)** 제품 오너 지시로 Smart Notes 동의 모델을 보호자 opt-out 선택 기능에서 가족 서비스 이용계약의 필수 조항으로 단순화(아래 참고) — 이때 재작성한 `enableMeetSpaceSmartNotes()`(canonical space name 기반 PATCH)를 **(2026-09-03, M0) 사용자 승인 후 실제 Google Sandbox로 재검증** — 임시 `environment:development` IAM binding 추가 → 실제 Calendar 이벤트+Meet space 생성 → canonical name으로 PATCH → 재확인 GET·독립 재조회 모두 `autoSmartNotesGeneration: "ON"` 확인 → 검증 직후 임시 Calendar 이벤트 삭제, IAM binding 제거(재조회로 Production만 남았음 확인), 임시 파일·자격 증명 삭제. **canonical name PATCH가 기존 403을 실제로 우회함을 확인 — 더 이상 외부 gap 아님.** 이로써 R6은 정식 종료됐다.
- **다음 실행 순서(2026-09-03 확정, 상세는 마스터 로드맵 "근접 실행계획" 절)**: `M0 R6 마감(완료) → M1 상담·체험 기반 재설계 → M2 R4 후속(체험/정규 수업권·환불) → M3 R5 후속(체험/정규 배정) → M4 상담→체험→정규 전환 통합 마감 → M5 기존 R7 착수`. **M1/R6 Workspace Events 공통 blocker는 2026-09-03 코드 정정 후 실제 Google Sandbox
v3 재검증까지 통과해 완전 마감됐다**(제품 오너가 직접 실행·보고, 상세는 위 "M1/R6 —
Workspace Events 구독 모델 정정 및 실제 Sandbox 재검증 통과" 절) — 사용자 단위 구독
모델이 실제로 성립함을 확인, 실측 중 발견된 UI 버그 2건은 이 세션에서 정식 수정·커밋
완료. **M2·M3는 아래 별도 절 기준으로 완료됐다(2026-09-03). M4는 2026-09-03 승인으로 착수해 로컬 구현·검증 완료 — 역할별 UI 폴리싱 및 외부 Sandbox/Preview 통합 검증 대기(아래 "M4 — 상담→체험→정규 전환 통합" 절 참고). M5-a(R7 판정 규칙 코어)는 2026-09-05 완료됐다** — `finalize_lesson_session()`(정상완료/학생·선생님 노쇼 최종판정 통합), `cancel_lesson_booking()` 확장(취소 시 연결 세션도 함께 최종판정), `mark_lesson_session_started()`(scheduled→live), `recomplete_session()` 확장(재판정 시 payable_minutes·정산 항목 재계산), `upsert_session_payout_item()`(세션 스냅샷 시급×payable_minutes로 payout_items 적재)를 신규 마이그레이션(`20261030000000_m5a_session_final_judgment.sql`)으로 추가 — 새 테이블·enum 없이 R1의 `v3_session_final_status`/`payable_minutes`/`session_access_events`, R6의 `session_incident_reports`를 그대로 재사용했다. 4대 규칙(24h+ 취소 release·미소진, 24h미만 학생취소 consume+예약시간지급, 15분노쇼확정 consume+지급, 학생지각후참석 completed와 동일 회계) 전부 구현·psql 직접 검증(`lib/booking/session-final-judgment.integration.test.ts` 9건). Meet 실접속시간(`session_access_events`)은 payable_minutes 계산에서 절대 참조하지 않음을 테스트로 고정. 선생님 UI(`TeacherLessonScheduleTab.tsx` "수업 시작"/"수업 종료(완료)"/"학생 노쇼 확정") + 관리자 UI(`BookingReconciliationPanel.tsx` "세션 최종판정"/"최근 확정된 세션 — 재검토")까지 연결. 완료 취소·재개방(요구사항 11)은 R1의 `reopen_session()`/`recomplete_session()`(append-only 이력)을 그대로 재사용 — `adminFinalizeLessonSession()`이 재개방 이력이 있는 세션은 자동으로 `recomplete_session()`으로 라우팅해 entitlement 중복 소진/해제를 막는다. **entitlement 원장 자체의 disposition(소진↔해제)이 재판정으로 바뀌어야 하는 경우는 예약당 1건 제약상 자동 역전이 불가능한데, 이 부분은 2026-09-05 검수 보완 라운드에서 `session_judgment_reconciliation_tasks`(재판정 전/후 차이 자동 계산·적재, 관리자 일괄 반영, 멱등)로 개선 완료됐다 — 더 이상 결정 필요 항목이 아니다. 상세는 아래 "M4·M5 검수 보완 라운드" 절 참고.** M5-b(선생님 지각 보충시간·90분 미만 자동 QC·회사/Meet 장애 시나리오)도 같은 날 이어서 완료됐다 — 상세는 아래 "M5-b(R7 장애·보충시간) completion" 절 참고. 전체 Vitest 1015건·tsc·`supabase db reset --local` 확인, Production/실제 외부 API 호출 0건. 커밋: `70d82b1`(DB 핵심)→`0001448`(서버 액션)→`6e4974d`(선생님 UI)→`0a5266b`(관리자 UI). 상세는 아래 "M1 — 상담 기반 재설계" 절, "M2 — R4 후속(체험수업권)" 절, "M3 — 선생님 배정 종료(termination) 플로우" 절, "M4 — 상담→체험→정규 전환 통합" 절과 `docs/2026-09-03-m1-migration-execution-log.md`/`docs/2026-09-03-m2-migration-execution-log.md`/`docs/2026-09-03-m3-migration-execution-log.md`/`docs/2026-09-03-m4-migration-execution-log.md`. R9(과목 마일스톤 보드)·R11(보호자–관리자 운영 메신저)은 이 실행 순서에 포함되지 않고 각자의 R 섹션에 별도 미착수 항목으로 남아있다.
  - **1/N 완료**: 선생님 반복가능시간·날짜별예외·15분버퍼·24h~8주 window, `confirm_lesson_booking()`(예약+세션+entitlement hold 단일 트랜잭션).
  - **2/N 완료**: Calendar/Meet 이벤트+Meet 생성·FreeBusy·취소, 실패해도 예약/hold는 건드리지 않는 재처리 워커(`reconciliation_needed` 포함).
  - **3/N 완료**: 구조적 cutover — `sessions`→`legacy_sessions`(레거시 세션뷰 8파일 14곳 계속 사용), `sessions_v3`→`sessions`(신규 예약이 쓰는 테이블). FK·RLS·인덱스는 rename에 자동 추종, 함수 본문 7개(텍스트 참조라 자동추종 안 됨)는 전부 CREATE OR REPLACE로 갱신 확인. `material_version_id`는 R9 선행조건(학생별 진도 스냅샷) 부재로 의도적으로 비워둠(인터페이스만 유지).
  - **4/N 완료**: 예약 멱등성(동일 idempotency_key 재요청 시 중복 생성 안 함 — `RETURN QUERY`가 함수를 종료시키지 않는 실제 PL/pgSQL 버그를 스모크 테스트로 발견·수정), 관리자 24시간 이내 예외, 주1회 최대8회 반복예약(수업권 부족 시 가능한 회차까지만 생성 후 명확한 사유로 중단).
  - **5/N 완료**: 취소(`cancel_lesson_booking()` — 학생 24h+ release/24h미만 consume, 선생님·회사 취소는 release+30일 미만 만료 시 30일로 연장), 취소 이력 테이블(예약 덮어쓰지 않음). 지각·노쇼는 사용자 최신 지시에 따라 **"신고"+"원본 접속기록 수집"까지만**(수업권 소진·출석확정·정산은 R7로 명시 이관) — `session_incident_reports`/`session_access_events`(Meet vs ALTON 접속을 source로 분리, 서로 보정하지 않음).
  - **6/N 완료**: 예약 서버 액션(`lib/booking/*`, `app/{parent,student,teacher,admin}/*booking*-actions.ts`) + 슬롯조회 알고리즘(순수함수, `AT TIME ZONE`과 동일한 DST 처리를 `Intl`로 구현) + UI 4종(보호자·학생 예약 탭, 선생님 가용시간 관리 탭 — 원래 빈 슬롯이었음, 관리자 예약 운영 화면). 리팩터링 중 **실제 권한 우회 취약점 발견·수정**(취소 액션이 reservationId가 실제로 그 childId 소유인지 검증하지 않던 문제 — `assertReservationBelongsToChild()` 추가). 실제 로컬 브라우저로 보호자 1회예약·주간반복8회·취소, 선생님 가용시간 등록, 관리자 재처리·회사취소까지 전부 클릭해서 검증(단순 tsc/vitest 아님) — 이 과정에서 "예정된 수업" 미갱신 버그와 `window.prompt()` 불안정성(인라인 폼으로 교체) 2건 추가 발견·수정.
  - 전 단계 로컬 dev DB 적용·전체 Vitest 704건·tsc 클린·전체 Playwright(--workers=1) 재확인(1건 실패는 R6 변경 제거한 베이스라인에서도 재현되는 기존 결함으로 실측 확인, 회귀 아님) 후 원격 dev DB 반영·커밋 완료.
  - **7/N(2026-09-02)**: AI 회의록(Smart Notes) 동의 게이트를 opt-out 모델(기본 ON, 보호자 토글, `ai_notes_consent_events`)로 처음 구현했으나, **16/N(2026-09-03)에서 전면 폐기**됐다 — 아래 16/N 항목 참고. 이 7/N 항목은 역사적 기록으로만 남긴다.
  - **16/N 완료(2026-09-03, 제품 오너 지시 — 정책 단순화)** Smart Notes를 보호자 opt-out 선택 기능에서 가족 서비스 이용계약의 필수 조항으로 전환. **계약 모델**: 가족계약은 기간제 의무 구매가 아니라 계속적 서비스 이용약정 — 계약 서명 한 번(별도 동의서·체크박스·AI 서명란 없음)이 정규수업 전체의 Smart Notes 사전 동의 근거다. 계약과 수업권은 독립적(수업권 소진이 계약을 종료시키지 않음, 최신 계약 버전이 유효하면 재구매 시 재서명 불필요 — 이 동작은 기존 `contracts.status`/`contract_versions.version_status` 설계가 이미 제공하고 있어 활성화 게이트(`subject_enrollment_activation_ready()`, R5) 자체는 변경하지 않았다. 이 게이트는 원래도 `contracts.status='active'`만 요구했고 별도 AI 동의 조건을 추가한 적이 없다). **제거한 것**: `ai_notes_consent_events` 테이블, `has_ai_notes_consent()`/`set_ai_notes_consent_as_guardian()` SQL 함수, `sessions.smart_notes_status`의 `disabled_by_guardian` 값(CHECK 제약에서 삭제), 보호자 자녀별 ON/OFF 토글 UI(`app/parent/ConsentTab.tsx`), 관리자 열람 화면(`app/admin/ConsultationTab.tsx`의 "AI 회의록 선택" 탭) — 전부 `20261008000000_r6_smart_notes_contract_clause_simplification.sql`. `confirm_lesson_booking()`은 이제 항상 `smart_notes_status='pending'`으로 스냅샷한다(회차별 재동의 없음). **Meet Space 설정 재구현**: 기존 `spaces.patch` 403(meeting code 별칭으로 PATCH)을 원인 확인해 `enableMeetSpaceSmartNotes()`로 재작성 — `spaces.get`(별칭)으로 canonical `space.name` 확인 → canonical name으로 `spaces.patch` → 재확인 `spaces.get`. 실패해도 예약·세션·수업권 hold는 자동 취소하지 않고 `sessions.smart_notes_config_status`(`pending`/`applied`/`failed`) + `smart_notes_config_error`로 관리자 재처리 대상 기록(신규 컬럼). 이 세션에서는 mock/로컬 검증까지만 하고 실제 Google API는 호출하지 않았다 — **실제 Sandbox 재검증은 M0(2026-09-03)에서 완료, 아래 15/N 항목 갱신 참고**: canonical name PATCH가 기존 403을 실제로 우회함을 확인. 회차별 재동의 화면(예약/Meet 입장 전)은 애초에 존재한 적이 없어 제거할 것도 없었다(확인 완료). 세션뷰(`app/session/[id]`)는 아직 R6 `sessions`/`reservations` 모델로 전환되지 않아(레거시 `enrollments`/`legacy_sessions` 기반, 별도 후속 R 작업) 정규수업 Smart Notes 안내 배너를 실제 화면에 연결할 지점이 없다 — 문구 자체는 정책에 확정했고(부모 포털 `ConsentTab.tsx`에 정적 안내로 반영), 세션뷰 전환 시 이식한다. 전체 Vitest/tsc/build 통과, Production/실제 DocuSign/실제 Google API/Stripe Production 접근 0건.
  - **17/N 문서정책 확정(2026-09-03, 구현 없음)**: 체험수업에서도 정규 리뷰 경험 제공을 위해 Smart Notes를 필수 사용한다. 가족 기본계약은 체험 완료 후 정규 전환 시에만 체결하며 과거 체험에 소급 적용하지 않는다. 체험 예약 최종 단계에서 보호자 계정으로 학생별 최초 1회 「체험수업 및 AI 수업리뷰 안내·동의」를 능동 확인하고, 보호자 계정·학생·문구/정책 버전·동의 시각·IP를 기록한다. 이는 별도 계약·DocuSign 문서가 아니며 체험마다 반복하지 않는다. 비동의 시 체험을 진행하지 않고, Smart Notes만 끄고 체험·정규수업을 계속하는 옵션은 없다. 체험·정규수업 모두 Google 원본을 고객에게 통상 직접 제공하지 않고 선생님이 검토·수정한 리뷰를 제공하되 법률상 열람·정정 권리는 제한하지 않는다. **현재는 문서와 화면 문구만 확정했으며 실제 체험 동의 화면·감사기록 게이트는 미구현**이다. 특히 만 13세 미만의 보호자 확인 방식은 변호사 승인 전 정식 출시 blocker다. 문서 기준: `docs/contracts/trial-class-ai-review-notice-consent-v0.1-draft.md`.
  - **8/N 완료**: 알림 outbox(그린필드 `booking_notification_outbox`) — 24h/2h 리마인드 + 예약확정/취소 즉시알림, 수신자는 자녀+household guardian 전원, 인앱 표시(R0 `notifications` 재사용)도 함께 삽입. 실제 발송 인프라 없음(status는 pending/cancelled까지만, 기존 R4 blocker와 일관). 관리자 화면에 유형×상태 요약 추가. 스모크 테스트 중 서브쿼리 컬럼명이 PL/pgSQL 변수와 겹쳐 나던 "ambiguous" 에러 발견·수정.
  - **9/N 완료**: 신규 예약 흐름 로컬 E2E(`e2e/r6-lesson-booking-flow.spec.ts`, 보호자 로그인→슬롯 클릭→예약 확정(원장 hold 확인)→outbox 확인→취소→원장 release 확인) 실브라우저 2회 연속 통과 + 전체 스위트 회귀 없음.
  - **10/N 완료(2026-09-02, 이번 세션)** — 제품 오너가 9/N "완료" 보고에서 누락으로 지적한 실제 내부 배선을 mock/fixture 검증까지만 채웠다(실제 Google API 호출은 여전히 전부 미실행, `CALENDAR_SYNC_ALLOW_REAL_CALLS` 미설정 유지):
    - FreeBusy 사전 확인(`lib/booking/freebusy-check.ts`)을 `confirmLessonBooking()` 안에서 DB 확정(RPC) *직전*에 실제로 호출하도록 배선 — 조회 실패/미설정 시 예약을 막지 않고(`{checked:false}`), 확정 이후의 겹침은 기존 DB 배타 제약(`reservations_no_overlap`)이 최종 방어선.
    - Calendar 이벤트+Meet 생성(`syncOneReservationCalendarEvent()`)을 배치 워커뿐 아니라 `confirmLessonBooking()`/`createWeeklyLessonSeries()`/`cancelLessonBooking()` 실제 서버 흐름에서 즉시 호출하도록 배선(awaited-then-swallowed — 실패해도 예약 확정 응답 자체는 절대 막지 않음). 실패 시 reservations.google_sync_status만 `failed`/`reconciliation_needed`로 남고 예약·hold는 전혀 건드리지 않음(기존 원칙 유지) — claim 방식 낙관적 잠금(조건부 UPDATE)이 즉시 호출 경로와 배치 워커 양쪽 동시 호출을 안전하게 처리(재시도가 중복 외부 객체를 만들지 않음).
    - 보호자 동의 스냅샷(`sessions.smart_notes_status`) → Meet Space Smart Notes ON/OFF(`setMeetSpaceSmartNotesConfig()`)를 Calendar 동기화 성공 직후 best-effort로 연결(`applySmartNotesConfigBestEffort()`) — 이 설정이 실패해도 Calendar 동기화 자체는 `synced`로 처리.
    - Workspace Events(Pub/Sub push) 수신 웹훅(`app/api/webhooks/workspace-events/route.ts`) 신규 추가 — OIDC bearer token 검증(fail-closed), Smart Notes 생성 이벤트를 `reservations.google_meeting_code`로 세션에 연결해 신규 테이블 `smart_notes_generation_events`에 적재 + `sessions.smart_notes_drive_file_id` 갱신. **Drive 파일 이동·ACL 작업은 R8, 리뷰 생성·게시는 R9로 스코프 밖 유지(구현 안 함)** — 이번엔 이벤트 수신·연결까지만.
    - Meet 참가 기록 수집 파이프라인(`lib/google-meet.ts`의 `listConferenceParticipantEvents()` + 웹훅의 참가자 이벤트 분기) — `session_access_events`에 `source:"google_meet_api"`로 삽입해 ALTON 자체 접속 기록(source 다름)과 명확히 분리, **출석 확정·수업권 소진·정산은 절대 자동으로 하지 않음**(R7 범위 그대로 유지).
    - 학생/보호자 지각·노쇼 "신고" 제출 UI(`app/student/LessonBookingTab.tsx`의 "지난 수업 지각·노쇼 신고" 섹션, 최근 14일 이내 확정 세션 목록) + 서버 액션(`app/student/incident-report-actions.ts`, `app/parent/booking-actions.ts`의 `reportTeacherIssueForChild`, 세션이 실제로 그 자녀 것인지 `assertSessionBelongsToChild()`로 검증), 선생님 신고 UI(`app/teacher/ScheduleTab.tsx` 지난 수업 목록), 관리자 열람 화면(`app/admin/BookingReconciliationPanel.tsx`의 "지각·노쇼 신고" 섹션, `listRecentIncidentReports()`) 신규 추가. **최종 판정·수업권 소진·정산은 여전히 R7 범위 — 이 UI는 신고 원문 제출·열람만 한다.**
    - 위 전부 mock/fixture 유닛 테스트로 커버(신규 테스트 파일: `lib/google-meet.test.ts`, `lib/google-workspace-events.test.ts`, `app/api/webhooks/workspace-events/route.test.ts`, `lib/booking/freebusy-check.test.ts`, `app/student/LessonBookingTab.test.tsx`, `app/teacher/ScheduleTab.test.tsx`의 추가 케이스, `app/parent/booking-actions.test.ts`의 추가 케이스, `app/admin/BookingReconciliationPanel.test.tsx`의 추가 케이스) — **실제 Google API 호출은 이번 세션에서 단 한 번도 발생하지 않았다.**
    - R5 기존 결함 근본 원인 특정(제품 오너가 "그냥 R6 아님으로 넘기지 말라"고 명시 요구): `e2e/r5-subject-enrollment-flow.spec.ts`의 관리자 선생님 변경(같은 날짜 적용) 테스트가 결정론적으로 실패하던 원인은 `app/admin/SubjectEnrollmentPanel.tsx`의 `TeacherChangeForm` — "적용일" `<input type="date">`가 오늘 날짜를 고르면 `new Date(effectiveFromDate).toISOString()`이 UTC 자정이 되어, 방금 만든 최초 배정의 정밀 시각(`new Date().toISOString()`)보다 항상 이전이 되면서 `change_teacher_assignment()`의 `p_effective_from > 기존 effective_from` 가드에 매번 걸리는 버그(레이스 아님, 매번 100% 재현). 오늘 날짜를 고른 경우에만 "지금"으로 취급하도록 수정 — 영향 범위: R5 관리자 선생님 변경(같은 날 적용) 한 곳뿐, 사용자 영향은 "관리자가 오늘 날짜로 선생님을 변경하면 항상 실패"(관리자 전용 운영 기능, 학생/보호자/선생님 화면에는 영향 없음). 담당 단계는 R5(버그 발생 코드가 R5 범위) — 이번 세션에서 R6 작업과 함께 수정·검증 완료.
    - `material_version_id` 정책을 명문화(구현은 하지 않음, R9 이관 유지) — 상세는 아래 별도 절 참고.
  - **11/N 완료(2026-09-02, 이번 세션)** — 제품 오너가 10/N 보고 이후 Calendar·Meet 소유 정책을 확정 지시했다(선생님 계정이 organizer, `official` 관리자는 통합 일정 화면에서 중앙 통제, Google 직접 변경 감지, FreeBusy scope 정정, Sandbox 객체 상한 재조정 등). 이번 세션에서 실제로 반영한 것:
    - **Calendar/Meet 소유 정책 확인·정정**: `createCalendarEventWithMeet()`가 이미 `teacherWorkspaceEmail`(담당 선생님)을 DWD subject로 써서 선생님 본인 캘린더에 생성하고, attendees를 추가하지 않으며 `sendUpdates=none`인 것을 재확인(코드 변경 불필요, R6 2/N부터 이미 이 정책과 일치). `docs/2026-08-29-product-architecture-v3.md`의 "성인 회사 관리 계정이 모든 Meet을 주최한다"는 옛 표현을 "담당 선생님의 회사 계정이 주최하고 ALTON 서버가 DWD로 중앙 통제한다"로 정정.
    - **DWD scope 불일치 발견·수정(코드 버그, 이번에 새로 발견)**: `lib/google-workspace-auth.ts`의 `CALENDAR_SCOPE`가 광범위한 `.../auth/calendar`를 요청하고 있었는데, Gate C가 실제로 DWD에 등록한 목록(`calendar.events`/`calendar.events.readonly`)에는 이 광범위한 scope가 없었다 — 지금까지 `CALENDAR_SYNC_ALLOW_REAL_CALLS`가 항상 false여서 발견되지 않았을 뿐, 실제 호출 시 전부 인가 실패였을 것이다. 이미 등록된 `calendar.events`로 좁혀 수정(외부 승인 불필요, 최소권한 원칙에도 부합). 같은 이유로 `lib/google-meet.ts`가 Calendar용 토큰을 재사용하던 것도 Meet 전용 scope(`meetings.space.settings`/`meetings.space.readonly`, Gate C에 이미 등록됨)로 분리하는 전용 토큰 함수(`getMeetSettingsApiAccessToken`/`getMeetReadonlyApiAccessToken`)를 추가해 수정.
    - **FreeBusy scope 정정**: `calendar.events.readonly` → `calendar.events.freebusy`로 변경, 이벤트 생성용 토큰과 완전히 분리된 전용 함수(`getFreeBusyApiAccessToken`)로 구현. 이 scope는 Gate C DWD 등록 목록에 없어 **실제 Admin Console 등록이 필요한 외부 설정 변경**으로 Sandbox 승인 요청서에 명시(아직 미등록, 미승인).
    - **Google 직접 변경 감지("외부 변경 감지")**: 신규 마이그레이션(`20261004000000_r6_external_change_detection.sql`)으로 `reservations.external_change_status`(`none`/`time_changed`/`deleted`/`meet_link_changed`) + `teacher_calendar_sync_state`(sync token 증분 동기화) 추가. `lib/google-calendar.ts`의 `listCalendarEventsIncremental()`(sync token 기반, 만료 시 전체 재동기화 폴백) + `lib/booking/external-change-detection.ts`의 `reconcileTeacherCalendarChanges()`(오케스트레이션, 8개 유닛 테스트)로 감지만 하고 예약·세션·수업권 hold는 절대 자동으로 바꾸지 않는다. `createCalendarEventWithMeet()`에 `extendedProperties.private.altonReservationId`를 추가해 ALTON이 만든 이벤트를 식별 가능하게 함. 관리자 확인 UI는 `app/admin/BookingReconciliationPanel.tsx`의 "Google 외부 변경 감지" 섹션으로 추가했으나 **"무시(오탐)" 처리만 실제로 연결**되고 "ALTON 시간 유지"/"Google 시간 반영"(재검증 후 확정)은 아직 미연결 — 명확히 표시해 UI가 하지 않는 일을 하는 것처럼 보이지 않게 함.
    - **관리자 통합 일정 화면(정책 #2)**: 데이터 계층(외부 변경 큐, 기존 `adminCreateLessonBooking()`/`adminCancelLessonBooking()`이 이미 전체 재검증 체인을 타는 것)은 준비됐지만, 정책이 요구하는 금주/주간/월간 캘린더 전환 UI는 이번 세션에서 만들지 않았다 — **명시적으로 UI 고도화 후속 작업으로 이관**(`docs/2026-08-29-master-roadmap-v3.md` R6 절 참고).
    - **학생/보호자 예약 UI 보완(정책 #3 일부)**: `LessonBookingTab.tsx`에 "빠른 추천 시간"(최근 3개 슬롯 강조)과 슬롯 선택 후 "예약 확인" 요약 카드(주간 반복이면 실제 생성 시도할 최대 8개 날짜를 미리 나열)를 추가해 "시간 선택 후 요약 확인을 거쳐 최종 확정" 요구를 충족. 월간 날짜 선택기(달력 그리드)는 만들지 않음 — 후속 작업으로 이관. 이 변경으로 `e2e/r6-lesson-booking-flow.spec.ts`가 슬롯 클릭 후 "최종 확정"을 한 번 더 눌러야 하도록 갱신됨(실제 브라우저로 재검증 완료).
    - 선생님 계정 정지 전 "미래 예약·미수집 Smart Notes 확인" 운영 게이트는 `docs/2026-08-29-master-roadmap-v3.md` R6 체크리스트에 필요 항목으로만 등록(미구현 — R6 마무리 또는 R8 착수 시).
    - Google Sandbox 외부 검증 승인 요청서(`docs/2026-09-02-r6-google-sandbox-verification-request.md`)를 정책 확정 내용(객체·시나리오 상한 재조정, Smart Notes 검증 참가자 확정, Workspace Events pull 전용 수신 방식, 외부 변경 승인 항목 분리 표시)에 맞춰 전면 개정(v2) — 아직 승인 전, 실제 호출 없음.
    - 검증: 신규/변경 테스트 전부 통과(`lib/google-calendar.test.ts`, `lib/google-meet.test.ts`, `lib/booking/external-change-detection.test.ts`[신규], `app/admin/BookingReconciliationPanel.test.tsx`), 전체 Vitest 771건 통과, `tsc --noEmit` 클린, 전체 Playwright(`--workers=1`) 재확인(결과는 이 세션의 최종 보고 참고). **실제 Google API 호출은 이번 11/N에서도 단 한 번도 발생하지 않았다** — 모든 플래그 미설정 유지.
  - **12/N 완료(2026-09-02, 이번 세션)** — 제품 오너가 11/N 반영 후에도 남은 확정 요구사항(학생·보호자/선생님/관리자 캘린더 UI, Google 외부 변경 양방향 처리 실연결, DWD scope 문서 확인, Sandbox 요청서 통합)을 하나의 R6 마감 작업으로 지시. 실제로 구현한 것:
    - **학생·보호자 예약 화면**: `LessonBookingTab.tsx`에 월간 캘린더 날짜 선택기 + 선택일 시간 패널(`app/components/MonthCalendar.tsx` 신규 공용 컴포넌트) 추가, 빠른 추천 시간 유지. 슬롯 클릭은 바로 예약하지 않고 요약 확인 카드(단건/반복 구분, 반복은 실제 생성 시도 날짜 최대 8개 표시)를 거쳐야 최종 확정. "예정된 수업"에 목록/월간 보기 전환 추가(월간에서 날짜 클릭 시 그 날짜만 필터링). 보호자는 같은 컴포넌트를 자녀별로 재사용(`ParentShell.tsx`)해 자녀별 월간/목록 일정을 본다 — 다른 학생·선생님의 다른 수업 정보는 RLS로 이미 차단됨.
    - **선생님 일정 및 가능시간**: 신규 데이터 계층(`app/teacher/lesson-schedule-data.ts`, `lesson-schedule-actions.ts`) — 기존 `app/teacher/dashboard-data.ts`(legacy_sessions 기반, 교재/과제 기능 전용)와는 완전히 별개로, R6 v3 `sessions`/`reservations`에서 선생님 본인 확정 예약만 조회하도록 새로 만들었다(레거시 데이터와 섞이지 않도록 분리 확인 완료). 신규 "정규수업" 탭(`TeacherLessonScheduleTab.tsx`)이 금주 목록/주간/월간 전환 + 확정 수업·날짜별 휴무/임시 오픈 배지를 함께 표시. 기존 "일정" 탭은 "가능시간"으로 개명하고 `TeacherAvailabilityTab.tsx`를 월간 캘린더 기본 화면으로 재작성(반복 가능 시간=템플릿, 날짜별 예외는 달력 클릭으로 추가/삭제, 기간 휴무 일괄 등록, 지난달 예외 복사 지원). Google 외부 개인 일정을 "외부 일정·예약 불가"로만 표시하는 UI는 준비했으나, 실제 Google 조회·렌더링 연결은 Sandbox 승인 이후로 명시적으로 미룸(UI에 그 사실을 문구로 표시).
    - **관리자 통합 일정**: 신규 `UnifiedScheduleTab.tsx`("통합 일정" 탭) — `official` 관리자 계정에 선생님 개인 Google Calendar를 공유하지 않고, 새 서버 액션 `listAllTeacherLessons()`가 ALTON DB(v3 sessions/reservations)에서 전체 선생님 확정 예약을 중앙 조회. 오늘/주간/월간 전환 + 선생님·과목·동기화 상태 필터. 일정 변경·취소는 이 화면에서 직접 하지 않고 기존 "예약 운영" 탭으로 안내(그 탭이 이미 전체 재검증 체인을 태움).
    - **Google 외부 변경 양방향 처리 실연결**: 신규 마이그레이션(`20261005000000_r6_external_change_resolution.sql`)이 `reservation_reschedules`(append-only 감사 이력 테이블) + `reschedule_reservation_to_google_time()`(가용성·버퍼·중복예약·수업권 재검증 후 DB를 Google 시간으로 갱신, exclusion 제약이 중복예약을 자동 차단) + `record_reservation_restored_to_alton_time()`(감사 이력만) SQL 함수를 추가. 앱 레이어(`lib/booking/external-change-resolution.ts`)가 "Google 시간 반영"(재검증 RPC 호출) / "ALTON 시간 유지"(`patchCalendarEventTime()`으로 Google 이벤트 복원 후 감사 기록)를 각각 실제로 수행하고, 관리자 UI(`BookingReconciliationPanel.tsx`)의 두 버튼이 이제 실제로 연결됨(이전엔 "아직 연결 안 됨" 안내만 있었음). `deleted` 상태에는 이 두 버튼을 노출하지 않음(이벤트 자체가 없어 시간 조정이 무의미 — 무시 또는 정식 취소만 가능).
    - **DWD scope 재확인(문서 기준, 실제 API 호출 없음)**: Gate C 인프라 로그에 기록된 등록 목록과 현재 코드가 요청하는 scope를 대조 — `calendar.events`/`meetings.space.settings`/`meetings.space.readonly`는 문서상 이미 등록됨(코드도 이미 그 scope로 좁혀져 있음), `calendar.events.freebusy`만 문서상 미등록으로 실제 Admin Console 등록이 필요함을 확인. 이 대조는 문서 열람만으로 수행했고 어떤 실제 Google API도 호출하지 않았다.
    - **Sandbox 요청서 통합(v3)**: `docs/2026-09-02-r6-google-sandbox-verification-request.md`를 위 전부를 반영해 한 번 더 개정 — 기존 Pub/Sub pull 구독과 신규 Workspace Events 구독을 별개 객체로 명시, Smart Notes 실회의 시간 상한 15분, Google 시간 변경/삭제 감지 후 "관리자 확인 필요" 상태와 양방향 처리 결과가 사이트·Google 양쪽에 반영되는 시나리오를 검증 절차에 포함, 외부 변경 승인 항목을 표로 분리. 아직 제출·승인 전, 실제 호출 없음.
    - 검증: 신규 컴포넌트(`MonthCalendar`, `TeacherLessonScheduleTab`, `TeacherAvailabilityTab`, `UnifiedScheduleTab`)와 신규 로직(`lib/booking/external-change-resolution.ts`, `lib/calendar-date-utils.ts`) 전부 mock 유닛 테스트로 커버, 기존 테스트(TeacherShell/AdminShell 사이드바 개수, r6-lesson-booking-flow E2E의 요약 확인 카드 클릭 단계) 갱신·재검증 완료. 전체 Vitest 801건 이상 통과(최종 수치는 이 세션 마지막 실행 기준), `tsc --noEmit` 클린. **실제 Google API 호출은 이번 12/N에서도 단 한 번도 발생하지 않았다** — 모든 플래그 미설정 유지.
  - **13/N 완료(2026-09-02, 이번 세션)** — 제품 오너가 12/N 이후에도 확정 정책과 Sandbox 요청서가 3가지 일치하지 않는다고 보정 지시(새 범위 아님, R6 마감 보정):
    - **선생님 Google 외부 일정 표시 실제 구현**: `lib/booking/external-busy.ts` + `TeacherLessonScheduleTab.tsx`/`TeacherAvailabilityTab.tsx`에 밑줄 표시+"외부 일정(예약 불가)" 칩으로 렌더링(FreeBusy는 구조적으로 제목·내용·참석자를 반환하지 않음). 본인만 조회 가능, 보호자·학생·다른 선생님에게는 노출 경로 없음. 실제 Google 호출은 여전히 Sandbox 승인 대기, mock 테스트만.
    - **Google 이벤트 삭제 시 "무시" 제거**: `20261006000000_r6_external_change_deletion_resolution.sql`(RPC가 `deleted` 상태의 `dismissed`를 명시적으로 거부) + `recreateCalendarEventAfterDeletion()`("ALTON 일정 유지" — 재생성)와 `resolveExternalChangeCancelDueToDeletion()`("예약 취소" — 정식 절차) 실연결, `reservation_reschedules`에 `google_event_deleted_recreated` 감사 이력 추가. 관리자 UI는 이 상태에서 두 버튼만 보여줌.
    - **Sandbox 요청서 v4**: "부분 실행 가능" 문구 전부 삭제, DWD scope를 "문서상 등록 예상/추가 필요/시작 전 실제 확인 필요(전 항목)" 3범주로 재구성하고 실제 확인이 다르면 API 호출 없이 문서만 갱신·재보고하도록 명시, 외부 일정 렌더링·삭제 양자택일을 통합 시나리오에 포함.
    - **선생님 계정 정지 게이트를 R6 blocker에서 완전히 제외**하고 R12+정식 오픈 전 체크리스트로 이관(R8 Smart Notes 이동과의 의존관계 명시).
    - 검증: 전체 Vitest 812건, `tsc --noEmit` 클린. **실제 Google API 호출 0건**, 모든 플래그 미설정 유지.
  - **14/N 완료(2026-09-02, 이번 세션, 문서만 정정 — 코드 변경 없음)** — 제품 오너가 승인 전 Sandbox 요청서 v4의 객체 범위·Smart Notes 정리 방식만 정정 지시. v5로 개정: (1) §3을 "동시 존재 최대 4개(E1~E4) / 누적 생성 최대 5개(재생성분 E3′ 포함) / Meet space 누적 최대 4개"로 정정하고, 어느 예약을 어떤 순서로 재사용해 시간 변경·삭제 후 재생성·삭제 후 정식 취소를 모두 검증할지 명시(추가 테스트 예약 없음). (2) Smart Notes 증적을 Shared Drive로 이동·보존하는 선택지 삭제(R8 범위) — 식별정보만 기록하고 합성 파일은 선생님 Sandbox Drive에서 정리(삭제)하는 것으로 고정, 외부 변경 목록에도 명시.
  - **15/N 완료(2026-09-03, 이번 세션) — 실제 Google Sandbox 통합 검증 및 Calendly/Zoom 제거 완료.** 제품 오너 승인(v5 범위 전체, DWD scope 실제 확인 후 일괄 실행)에 따라 `gate-c-automation@...`에 임시 `environment:development` WIF IAM binding을 좁게 추가(Production 바인딩 불변)하고, `teacher1@alton.education` 실제 계정으로 로컬 dev 환경에서 실제 Google API를 호출해 검증했다. **실제 결과**: Calendar/Meet 생성·수정·삭제(E1~E4), FreeBusy 충돌·외부 바쁨 블록, Google 시간 변경 양방향(반영/유지), Google 삭제 후 재생성/정식 취소, Smart Notes 실회의(약 19분) 생성·연결, Workspace Events 구독·Pub/Sub 실제 수신, Meet 참가자 기록 조회까지 전부 실측 통과. **실제 버그 3건 발견·수정**: (1) 멱등 재요청이 자기 자신이 만든 Calendar 이벤트와 FreeBusy 충돌 오탐(`lib/booking/create-booking.ts`), (2) `privateExtendedProperty` 와일드카드 미지원으로 외부 변경 감지가 항상 무동작(`lib/google-calendar.ts`, `lib/booking/external-change-detection.ts`), (3) Workspace Events 실제 페이로드는 이벤트 타입이 본문이 아니라 Pub/Sub 메시지의 `ce-type` 속성에 있고 Smart Notes 본문엔 `smartNote.name`만 있어 Drive 파일 ID·meetingCode를 추가 API 호출로 채워야 함(`lib/google-workspace-events.ts`, `app/api/webhooks/workspace-events/route.ts`, `lib/google-meet.ts`) — meetingCode/driveFileId 해석은 도메인 위임 관리자(official@alton.education) subject로 조직 내 임의 회의를 조회할 수 있음을 실측 확인해 해결. **미해결 외부 gap(코드로 해결 불가, 비차단)**: Meet Space `smartNotesConfig` PATCH가 `meetings.space.settings` scope로도 일관되게 403 — Google Admin Console DWD 등록 확인이 추가로 필요(보호자 Smart Notes 거부 옵트아웃이 API로는 실제로 적용되지 않음, 신고 대상). 검증 후 정해진 순서대로 정리 완료: 생성했던 Calendar 이벤트 전부 삭제, Workspace Events 구독 삭제, 합성 Smart Notes Google Doc 삭제, 테스트 fixture DB row 전부 삭제(`teachers.workspace_email` 원복 포함), `/tmp` 임시 스크립트·자격증명 삭제, 마지막으로 임시 IAM binding 제거 후 `get-iam-policy` 재조회로 Production 바인딩만 남았음을 확인. 이 통합 검증이 실제로 전부 통과해 **Calendly/Zoom 완전 제거**를 진행: `CalendlyWidget.tsx`/`app/api/webhooks/calendly/*`/`scripts/register-calendly-webhook.mjs`/`app/student/booking-data.ts` 삭제, `teachers.calendly_scheduling_url`/`legacy_sessions.calendly_event_uri` 컬럼 삭제(`20261007000000_r6_remove_calendly_zoom_lesson_booking.sql`), 관련 env var(`CALENDLY_*`) 제거, 세션뷰 "Zoom 연결됨" 배지를 "Google Meet 연결됨"으로 변경. **상담(consult_requests) 예약 Calendly는 이번 제거 범위가 아니다** — 애초에 R6 스펙 밖이고 `ConsultForm`/`submitConsultRequest`로 Calendly 없이 독립적으로 동작해왔으므로 랜딩페이지는 이제 항상 `ConsultForm`을 쓰고, `consult_requests.calendly_event_uri` 컬럼은 보존(이관하지 않음, 그냥 미사용 컬럼으로 남음). 전체 회귀(Vitest 809건, tsc, `npm run build`) 전부 통과. Production/원격 dev DB/Stripe Production 접근 없음, 모든 Google 관련 플래그 세션 종료 시 기본값(false/미설정) 유지.

### M1 — 상담 기반 재설계, 코드 구현 완료·**조건부 승인, push 대기**(2026-09-03)

**다음 실행 순서**가 `M0 R6 마감(완료) → M1 상담·체험 기반 재설계 → M2 → M3 → M4 → M5 기존 R7 착수`이던 것 중
**M1의 코드·DB·로컬 검증을 완료**했다 — 제품 오너가 **조건부 승인**했고(2026-09-03, 4개 항목
보완 지시 후 승인), 그 보완도 같은 세션에서 완료했다. **push는 여전히 하지 않았다**(로컬
커밋 5개: `6f978db`→`d8862bb`→`1feb800`→`ca7b187`→최신, 실제 커밋 해시는 `git log` 참고).
상세는 `docs/2026-09-03-m1-migration-execution-log.md`, 인수 기준 체크박스는
`master-roadmap-v3.md` "근접 실행계획" M1 절 참고.

- **DB**: `supabase/migrations/20261009000000_m1_consultation_unification.sql` — 신규
  `prospect_contacts`(비로그인 잠재고객, Auth 계정 미생성), `consult_consent_versions`(동의
  문구 버전형 인터페이스, placeholder 1건 삽입), `consult_availability_rules`/
  `consult_availability_exceptions`(공용 상담 가능시간, 특정 담당자 비귀속), `consult_consent_tokens`
  (동의 확인용 만료형 토큰 — 해시만 저장), 기존 `consultations`에 `prospect_contact_id`/`source`/
  `hold_expires_at`(더 이상 값이 채워지지 않음, 아래 참고)/`starts_at`/`ends_at`/`google_*`/
  `google_meeting_code`/`smart_notes_*`/`consent_*`/`outcome*`/`confirmation_email_*` 컬럼 추가,
  `consultation_status_events`(INSERT-only 감사 이력), `submit_homepage_consult_request()`/
  `admin_accept_consultation()`/`admin_reject_consultation()`/`admin_reschedule_consultation()`/
  `admin_cancel_consultation()`/`admin_record_consultation_outcome()`(readiness 게이트 포함, 아래
  참고)/`list_open_consult_slots()`/`issue_consult_consent_token()`/`resolve_consult_consent_token()`/
  `confirm_consult_consent_by_token()` SECURITY DEFINER 함수, `smart_notes_generation_events`에
  `consultation_id`/`pubsub_message_id` 컬럼 추가(R6 웹훅 재사용, 아래 참고). 레거시
  `consult_requests`는 동결 보존(rename/삭제 없음, R3와 동일 방침).
- **hold 정책(2026-09-03 정정)**: 최초 구현의 30분 자동 만료는 "고객에게 아무 알림 없이
  신청이 무효화되는" 별도 설계가 필요한 결정이라는 지적에 따라 **제거**했다 — `requested`
  상담은 관리자가 수락/거절하기 전까지 슬롯을 계속 점유한다. now() 의존 없는 IMMUTABLE
  조건만 허용되는 Postgres 배타 제약 제약 덕분에 오히려 더 단순해졌다: `consultations_no_overlap`
  배타 제약이 `requested`/`scheduled` 둘 다 직접 하드 차단(앱 레벨 `SELECT ... FOR UPDATE`는
  더 친절한 에러 메시지용 이중 방어일 뿐). 비로그인 신청 남용 방지는 "동일 이메일당 처리
  대기 중인 신청 1건 제한"으로 대체(UX 변경 없음).
- **Smart Notes readiness 게이트 — 진행/완료 2단계 분리(2026-09-03 추가, 조건부 승인
  보완으로 재정의)**: "상담 진행 가능"(동의 확인 + Smart Notes ON)과 "상담 완료 가능"(그
  위에 Smart Notes 원본 자동 연결 + 비어있지 않은 관리자 검토 요약)은 서로 다른 시점의
  서로 다른 기준이라 더 이상 하나로 묶지 않는다. `official@alton.education` 조직 차원 Smart
  Notes 정책이 이미 켜져 있으면 그것으로 충분(`ensureMeetSpaceSmartNotesOn()`이 GET으로 먼저
  확인, ON이 아닐 때만 기존 canonical PATCH로 보정) — 확인·보정 실패는 확정 이메일 발송을
  막지 않는다. `admin_record_consultation_outcome()`이 **서버에서 4개 조건 전부**(①
  `consent_confirmed_at` 존재, ② `smart_notes_config_status='applied'`, ③
  `smart_notes_drive_file_id` 존재, ④ `admin_review_summary`가 공백 아닌 값)를 강제하고
  하나라도 미충족이면 `completed` 전이·outcome 기록을 전부 거부한다(부분 허용 없음).
  관리자 화면(`ConsultationSchedulingPanel.tsx`)에 `consultReadiness`(진행 가능 여부)와
  `completionReadiness`(완료 가능 여부)를 별도로 표시하고, 완료 불가 사유별(동의/Smart
  Notes ON/원본 미연결/요약 누락) 안내와 수동 재처리 버튼을 제공.
- **Smart Notes 원본 자동 연결(2026-09-03 추가, 실제 구현)**: 새 웹훅을 만들지 않고 기존 R6
  Workspace Events 웹훅(`app/api/webhooks/workspace-events/route.ts`)의 매칭 대상만 넓혔다 —
  세션 매칭 실패 시 `consultations.google_meeting_code`로 상담도 시도, 매칭되면
  `consultations.smart_notes_drive_file_id` 갱신(잠재고객에게는 노출 경로 없음, 관리자 전용).
  Pub/Sub `messageId` 기반 멱등(재전송 시 중복 행 생성 안 함), 매칭 실패는 유실시키지 않고
  `linked=false`로 보존. **재처리 경로 신규 추가**: `reprocessUnlinkedSmartNotesEvents()`
  (`lib/consultation/calendar-sync.ts`)가 매칭 실패로 남은 이벤트를(대개 웹훅이 상담의
  `google_meeting_code` 저장 전에 먼저 도착하는 레이스) 다시 매칭 시도 — 관리자 화면 "Smart
  Notes 미매칭 재처리" 버튼으로 실행.
- **동의 확인 토큰화(2026-09-03 정정)**: 상담 UUID를 URL에 노출하지 않는다 — 확인 이메일마다
  새 만료형 토큰(SHA-256 해시만 DB 저장, 원문은 발송 시점에만 메모리에 존재)을 발급하고,
  `/consult/[id]/consent` → `/consult/consent?token=...`로 라우트 변경. 위조/재사용/다른 상담
  확인은 해시 불일치로 차단, 동일 토큰 재확인은 멱등(반복 체크 없음 요구사항과 일치).
- **이메일 신뢰성(2026-09-03 추가)**: 링크는 `currentRequestOrigin()`(R4 UAT에서 확립된 패턴)
  기반 절대 URL로 발송(기존 상대경로 버그 수정). `confirmation_email_content_hash`(시간+Meet
  링크 sha256)로 재처리 시 동일 내용 중복 발송을 막고, 시간 변경 등으로 내용이 실제로 바뀌면
  새로 발송.
- **앱 레이어**: `app/consult-actions.ts`(홈페이지 신청·슬롯 조회·토큰 기반 동의 확인),
  `app/admin/consultation-scheduling-actions.ts`(수락/거절/시간변경/취소/결과기록/readiness/
  가용성 관리), `lib/consultation/calendar-sync.ts`(R6 `lib/google-calendar.ts`/
  `lib/google-workspace-auth.ts`/`lib/google-meet.ts` 재사용, subject를 담당 선생님 대신
  `official@alton.education`으로 교체 — `CALENDAR_SYNC_ALLOW_REAL_CALLS` 기본 false 그대로
  재사용, 이번 세션에서 실제 Google API 호출 0건), `app/admin/ConsultationSchedulingPanel.tsx`
  (관리자 "상담 운영" 탭), `app/ConsultForm.tsx`(슬롯 선택), `/consult/consent`(동의 확인
  페이지, placeholder 문구 노출).
- **동의 placeholder**: `consult_consent_versions`에 `is_placeholder=true`인 1개 버전만 존재.
  최종 법률 문구는 별도 계약 문서 세션 확정 후 신규 버전을 삽입해야 한다 — 이 문구로 실제
  법적 동의를 받았다고 취급하지 않는다(문서 의존성으로 명시). **placeholder로 수집된 확인은
  법적 동의가 아니다 — 이 사실은 코드·이메일·확인 화면 어디에도 실제 법적 효력이 있는
  것처럼 표시하지 않는다.**
- **검증**: 로컬 `supabase db reset --local` 반영, 전체 Vitest 817건 통과, `tsc --noEmit`·
  `next build` 클린, 전체 Playwright 52건(`--workers=1`, M1 E2E 포함) 통과. **저장소 무결성**:
  `6f978db`가 당시 미커밋 R6 파일(`lib/google-meet.ts` 등)에 의존해 단독으로는 빌드되지 않던
  문제를 발견해 R6 잔여분을 `d8862bb`로 별도 커밋(M1과 R6 변경을 섞지 않음) — 이후 커밋된
  파일만 있는 별도 임시 `git worktree`에서 `next build`+전체 Vitest를 재실행해 실제로 통과함을
  확인. hold/readiness/토큰 발급·소비 멱등성은 로컬 psql 직접 호출로도 실측 확인.
  **검증 중 실제 버그 다수 발견·수정**: `list_open_consult_slots()`가 규칙의 `start_time` 슬롯
  하나만 만들던 버그(전체 시간창 60분 단위로 수정), 겹치는 규칙의 슬롯 중복 반환(`DISTINCT`
  추가, React key 중복 경고로 발견), 확인 이메일의 상대경로 URL, `admin_reject_consultation()`/
  `admin_cancel_consultation()`이 기존 R3 관례(`status='cancelled'`)와 다르게 `status='closed'`를
  쓰던 불일치(기존 관례로 통일).
- **미완료(스펙상 의도적으로 M2~M4로 이관, 이번 범위 아님)**: 기존 로그인 보호자·학생·선생님이
  보내는 상담 요청 유형 UI/구분 로직("신규 보호자 홈페이지 흐름 우선 완성" 원칙),
  `prospect_contacts.converted_guardian_id` 실제 연결 로직(M4).

### M1 — Google Sandbox 실측 결과 + 최종 통합 보완(2026-09-03, 같은 날 후속 세션)

**제품 오너가 이 세션 중 직접** M1 Sandbox 요청서(v1) 범위로 실제 Google Sandbox 통합 검증을
실행했다(Claude 세션은 실제 외부 호출을 하지 않음 — 원칙적으로 실제 외부 호출은 사용자가
채팅에서 직접 확인해야만 진행하는 정책, 아래 "안전 경계" 참고). **실측 결과**: `official@
alton.education` 소유 Calendar 이벤트+Meet 생성, 확인 이메일(`matchbox512@snu.ac.kr`로만
발송, 실제 2통), 동의 토큰 확인까지는 전부 실제로 확인됐으나, **Workspace Events 구독을
실제로 만드는 코드가 아예 없어서 Smart Notes 원본 자동 연결이 통과하지 못했다** — 이 공백을
이번 후속 세션에서 해결했다(아래 신규 항목). 이 실측에 쓰인 실제 Gmail SMTP 앱 비밀번호(
`official@alton.education` 계정, Vercel Production에 이미 등록된 것과 동일 값)는 검증 직후
`.env.local`에서 완전히 제거됐다고 보고됐다 — 이 세션에서 저장소 전체(추적 파일, 테스트
결과물, `scripts/m1-sandbox-verification.sh`)와 `.env.local` 현재 상태를 직접 점검해 평문
자격증명이 전혀 남아있지 않음을 확인했다(`SMTP_PASS` 현재 길이 0, `.env.local`은
`.gitignore`로 커밋 대상에서 제외됨 확인). 임의 회전은 하지 않았다 — 노출 범위가 로컬 개발
환경 한정으로 보이고 즉시 제거됐다는 보고가 있어 강제 회전이 필요하다고 판단하지 않았지만,
최종 판단은 제품 오너 몫으로 남긴다.

이번 후속 세션에서 실제로 구현·검증(전부 mock/로컬, 실제 Google API 호출 0건)한 것:

- **Workspace Events 구독 수명주기(M1/R6 공통 blocker, 신규 해결)**: `workspace_events_
  subscriptions` 테이블(`20261010000000_m1_workspace_events_subscriptions.sql`) +
  `lib/google-workspace-events-subscriptions.ts`(구독 생성·조회·갱신·삭제 API 클라이언트,
  `CALENDAR_SYNC_ALLOW_REAL_CALLS` 게이트 재사용) + `lib/workspace-events/subscription-
  lifecycle.ts`(`ensureSubscriptionForOrganizer()` — organizer당 최대 1개 유지, 만료 임박
  갱신, 만료/오류 시 재생성, `disabled`는 자동 재활성화 안 함; `reconcileMissedSmartNotes
  Events()` — 구독 장애·이벤트 유실 대비 Meet API 사후 대조, 실패해도 상담·수업을 자동
  완료 처리하지 않음). 상담 확정(`lib/consultation/calendar-sync.ts`)과 정규수업 확정
  (`lib/booking/calendar-sync.ts`) 양쪽에서 Calendar 동기화 성공 직후 best-effort로 호출.
  관리자 화면에 구독 상태·수동 갱신·수동 사후 대조 버튼 추가(`app/admin/workspace-events-
  actions.ts`, `ConsultationSchedulingPanel.tsx`).
- **Calendar 네이티브 초대로 정책 전환(제품 정책 확정)**: `lib/google-calendar.ts`의
  `createCalendarEventWithMeet`/`patchCalendarEventTime`/`deleteCalendarEvent`에
  `attendeeEmail`/`sendUpdates`/guest 제한 3종(`guestsCanInviteOthers`/`guestsCanModify`/
  `guestsCanSeeOtherGuests` 항상 false)을 추가 — 호출부가 `sendUpdates`를 명시하도록 강제.
  **상담**: `official@alton.education`이 organizer, 신청 이메일이 유일한 attendee,
  `sendUpdates="all"`(생성·시간변경·취소 전부), 이벤트 설명에 AI Smart Notes 안내+동의
  토큰 링크. **정규수업**: 담당 선생님 회사 계정이 organizer, 학생의 검증된(이메일 존재+
  `email_confirmed_at` not null) 계정 이메일이 attendee — 보호자는 attendee로 추가하지
  않음(R6의 "attendees 없음+sendUpdates=none" 정책 폐기). 학생 이메일 미검증은 조용히
  무시하지 않고 예외를 던져 기존 `failed`/`reconciliation_needed` 재처리 경로로 노출(관리자
  조치 필요 상태). Calendar 초대가 성공하면 기존 커스텀 SMTP 확인 메일은 중복 발송하지
  않고, 재시도 한도까지 반복 실패한 경우에만 fallback 이메일 1통을 보낸다(요구사항 6).
  거절 알림은 여전히 ALTON 커스텀 이메일 경로(`lib/consultation/notifications.ts`).
- **Smart Notes 외부 공개 통제(정책+기존 구조 재확인, 신규 API 강제 코드 없음)**: Google
  Meet API가 공유 대상(host/co-host 전용)을 직접 설정하는 기능을 제공하지 않아, 이 통제는
  Workspace 관리자 기본 설정 + 앱 레벨 접근 통제(원본 `smart_notes_drive_file_id`는 관리자
  전용 select 경로에서만 노출, 잠재고객에게 노출되는 화면 전무 — 기존 구조 그대로 유지)로만
  담당한다. 외부 attendee가 Google에서 원본 접근 이메일/Drive 권한을 실제로 받는지는
  다음 Sandbox 요청서(v2, `docs/2026-09-03-m1-google-sandbox-verification-request-v2.md`)의
  검증 항목으로만 추가했다 — 이번엔 실제 호출 없음. 만약 다음 검증에서 원본 접근이 실제로
  확인되면 공유 범위를 확대하지 않고 즉시 중단해 정책 blocker로 보고하기로 문서화해뒀다.
- **관리자 UX**: "시간 변경"/"상담 결과 기록"의 `window.prompt()`를 인라인 폼으로 교체
  (`ConsultationSchedulingPanel.tsx`). Calendar 동기화 상태 문구를 "Calendar 초대 발송
  대기/발송됨/실패(재시도 중)/실패 — 관리자 확인 필요(이메일로 대체 안내됨)"로 세분화해
  Workspace Events 구독 장애·Smart Notes 설정 실패·원본 미연결과 서로 다른 상태로 구분
  표시. 기존 4조건 완료 게이트는 그대로 유지.
- **검증**: 로컬 psql로 hold/readiness 게이트 재확인, 신규 유닛 테스트(`google-workspace-
  events-subscriptions` 오케스트레이션 9건, Calendar attendee/guest 제한 1건, 학생 이메일
  미검증 차단 1건 등) 포함 전체 Vitest 832건, `tsc --noEmit`·`next build` 클린, 전체
  Playwright 52건(`--workers=1`) 중 51건 통과(1건은 이 작업과 무관한 기존 R4 동시성
  테스트의 알려진 플레이키니스 — 단독 재실행 시 즉시 통과, 회귀 아님을 재확인).
### M1 — 역할별 Calendar 상태 표시 + 검증 스크립트/요청서 v2 정정(2026-09-03, 같은 날 세 번째 후속)

**이 절이 끝난 시점에만 M1 로컬 구현을 완료로 표시한다.** 위 두 절(코드 구현, Sandbox
실측 결과+구독 수명주기)에 이어 마지막 잔여 항목을 마감했다:

- **역할별 Calendar 상태 표시**: 학생·보호자(같은 `LessonBookingTab.tsx`를 자녀별로
  재사용)·선생님(`TeacherLessonScheduleTab.tsx`) 예약 화면은 이미 R6부터
  `google_sync_status` 기반 상태 배지를 갖고 있었다 — 이번엔 그 문구를 Calendar 네이티브
  초대 정책에 맞게 정정했다: 학생 화면은 "Calendar 초대 발송 준비 중/완료/재시도 중/실패
  — 관리자 조치 중", 선생님 화면은 "내 Calendar에 일정 생성 준비 중/생성됨(학생 초대
  발송)/재시도 중/실패 — 관리자 조치 중". 보호자는 학생과 동일 컴포넌트를 자녀별로 읽기
  전용에 가깝게 재사용하며 attendee라는 표현은 어디에도 쓰지 않는다(자녀 이름과 상태만
  표시). 내부 Google 오류 원문·개인정보는 이 세 화면 어디에도 노출하지 않는다(원문은
  관리자 전용 `google_sync_last_error`/`google_sync_error` 컬럼에만 남고, 학생/보호자/
  선생님 화면은 고정된 한국어 라벨만 매핑해서 보여준다 — 코드 리뷰로 확인).
- **Sandbox 검증 스크립트 v2 갱신**: `scripts/m1-sandbox-verification.sh`를 v2 절차로
  다시 썼다 — attendee(상담 신청자=정규수업 테스트 학생=`matchbox512@snu.ac.kr` 계정
  하나로 통일), `sendUpdates=all`, guest 제한 3종, Workspace Events 구독 생성·갱신·삭제,
  자동 연결, 외부 attendee의 Smart Notes 원본 접근 차단 확인을 전부 포함. v1 전용 절차
  (attendee 없는 이벤트 생성, fallback 이메일을 의도적으로 유도하는 절차)는 제거했다.
  파일에 비밀값은 여전히 없다(이전에도 없었음, 재확인) — 모든 자격증명은 실행자가 그때
  셸/`.env.local`에 직접 넣고 검증 종료 즉시 빼는 것을 전제로 한다.
- **Sandbox 요청서 v2 정정**: `docs/2026-09-03-m1-google-sandbox-verification-request-v2.md`
  §2·§3·§5를 수정 — attendee 테스트 계정을 2개에서 **`matchbox512@snu.ac.kr` 1개로
  통일**(역할 검증을 위해 계정을 늘리지 않음), 상담·수업 이벤트 각 최대 1개·구독
  organizer당 최대 1개 상한은 그대로 유지, 커스텀 SMTP fallback은 이 검증에서 의도적으로
  실패를 유도해 발송시키지 않는다고 명시. 외부 attendee의 Smart Notes 원본 접근 차단
  확인 절차는 그대로 유지. 실제 외부 호출은 여전히 이 문서만으로는 실행되지 않는다 —
  별도 승인 후에만.
- **SMTP 자격증명 회전 절차 문서화(실행 아님)**: 신규
  `docs/2026-09-03-smtp-credential-rotation-procedure.md` — 새 앱 비밀번호 생성 → Vercel
  Production 값 교체 → 통제된 테스트(팀 내부 주소로 기존 발송 경로 1건 실행) → 기존
  비밀번호 폐기 순서의 무중단 절차만 정의했다. 이번 세션은 앱 비밀번호를 새로 만들지도,
  Vercel Production 값을 바꾸지도, 기존 비밀번호를 폐기하지도 않았다 — 실제 회전은 제품
  오너의 별도 명시적 승인 후에만 실행한다.
- **검증**: 라벨 변경 3곳(`app/student/LessonBookingTab.tsx`, `app/teacher/
  TeacherLessonScheduleTab.tsx` — 보호자는 학생 컴포넌트 재사용이라 별도 변경 없음) 반영 후
  `tsc --noEmit` 클린 재확인, 관련 테스트에 하드코딩된 구 라벨 문자열 참조 없음을 grep으로
  확인(테스트 깨짐 없음).
- **미완료**: 실제 Google Sandbox 재검증(v2, 구독 생성 포함) — 요청서·스크립트 작성만
  완료, 승인·실행 대기. SMTP 자격증명 실제 회전 — 절차만 문서화, 실행 대기.
- **외부 변경(이번 세 번째 후속 세션 자체)**: Claude 세션이 실행한 실제 Google API 호출,
  실제 이메일 발송, Production/원격 DB 접근, IAM·Vercel 설정 변경 전부 0건.
  `CALENDAR_SYNC_ALLOW_REAL_CALLS` 등 모든 플래그 기본값(false/미설정) 유지. `git push`
  하지 않음 — 로컬 커밋만 존재.

### M1/R6 — Workspace Events 구독 모델 정정 및 실제 Sandbox 재검증 통과, **완전 마감**(2026-09-03, 같은 날 네·다섯 번째 후속)

앞선 구독 수명주기 구현(위 절)의 target resource·Pub/Sub 연결 구성이 **실제 Google API
요구사항과 맞지 않는 근본 오류**였음이 드러나 이번 세션에서 정정했다. R6가 과거(15/N)
실제 Sandbox로 검증했던 것은 **Calendar/Meet 이벤트 생성·FreeBusy·Smart Notes 자동
생성·Workspace Events "수신"**(웹훅이 실제로 도착하는지)이었고, 이번에 발견된 문제는
그것과 다른 대상 — **구독을 실제로 만드는 요청 자체**의 target resource·notification
endpoint 형식이다. 즉 R6 15/N의 "구독·Pub/Sub 실제 수신 성공" 기록과 이번 실패는 서로
다른 것을 가리킨다(과거: 기존에 이미 존재하던 pull 구독으로 메시지를 pull해서 확인 —
구독을 새로 만드는 API 호출 자체는 검증한 적이 없었다). 충돌이 아니라 서로 다른 범위의
기록이다.

- **정정 1 — target resource**: `//meet.googleapis.com/workspaces/{email}/spaces/-`
  (존재하지 않는 형식, organizer 이메일을 리소스 이름에 직접 사용)를 제거하고
  `//cloudidentity.googleapis.com/users/{USER}`로 교체 — `{USER}`는 Directory API
  (`lib/google-workspace-directory-readonly.ts`의 `getWorkspaceUserByEmail()`, 기존
  R2 Task 7 자산 재사용)가 반환하는 불변 사용자 ID. `workspace_events_subscriptions.
  organizer_workspace_user_id` 컬럼(`20261011000000_...sql`)에 최초 조회 시 캐시해
  재사용 — 매 구독 생성마다 Directory API를 다시 호출하지 않는다. organizer 전체
  회의를 구독하는 제품 구조 자체는 그대로 유지(사용자 단위 구독). **사용자 단위 구독이
  실제로 거부되는지는 mock으로 확정할 수 없다** — 거부되면 canonical Meet space 단위로
  전환해야 하는데, 그 최종 판단은 아래 실측 재검증에서만 가능하다(`decision_required`
  로 남김, 이번 세션에서 코드를 추측만으로 더 바꾸지 않았다).
- **정정 2 — Pub/Sub 연결**: `notificationEndpoint.pubsubTopic`에 웹훅 HTTP URL을
  그대로 넣던 임시 fallback(`WORKSPACE_EVENTS_PUBSUB_TOPIC` 미설정 시
  `NEXT_PUBLIC_SITE_URL` 기반 URL로 대체)을 완전히 제거했다. 이제
  `WORKSPACE_EVENTS_PUBSUB_TOPIC`이 `projects/{project}/topics/{topic}` 형식이
  아니면(없음 포함) 실제 API를 호출하기 전에 즉시 fail-closed로 실패한다
  (`lib/google-workspace-events-subscriptions.ts`의 `assertValidPubsubTopic()`).
  웹훅 URL(`app/api/webhooks/workspace-events`)은 이 토픽에 대한 별도 Pub/Sub push
  subscription의 endpoint로 GCP 콘솔에서 연결하는 것이지 이 코드가 만드는 값이 아니라는
  것을 코드 주석·문서 양쪽에서 개념적으로 분리했다.
- **정정 3 — 전달 경로 문서화**(실제 gcloud 설정은 실측 재검증에서 사람이 직접 실행):
  `scripts/m1-sandbox-verification.sh`에 STEP 0.5(Pub/Sub 토픽 생성 → Workspace Events
  발행 서비스 계정에 `roles/pubsub.publisher` 부여 → 그 토픽에 push subscription 생성,
  push endpoint=웹훅 URL) 신규 추가. 발행 서비스 계정의 정확한 이름은 GCP 콘솔에서
  실행 직전 확인하도록 명시(추정값을 코드/문서에 박아두지 않음).
- **수명주기·복구는 유지**: organizer별 중복 없는 생성·조회·만료 전 갱신·삭제/정지·
  재생성 경로, 구독/이벤트 전달 장애 시 Meet API 사후 대조(`reconcileMissedSmartNotesEvents`),
  상담 완료·수업 처리 자동 확정 금지 원칙 — 전부 이전 구현 그대로, target resource/topic
  파라미터만 교체됐다.
- **검증(mock/로컬만)**: 신규 회귀 차단 테스트 — 이메일을 사용자 ID로 쓰지 않는지,
  웹훅 URL을 pubsubTopic으로 쓰지 않는지, 필수 topic 누락/오형식 fail-closed, 캐시된
  사용자 ID 재사용(Directory API 재호출 안 함) 등(`lib/workspace-events/subscription-
  lifecycle.test.ts`, `lib/google-workspace-events-subscriptions.test.ts` 신규). 전체
  Vitest 841건, `tsc --noEmit`·`next build` 클린.
**추가 후속 — 제품 오너가 직접 실행한 실제 Google Sandbox v3 재검증(2026-09-03)**:
아래는 **Claude 세션이 직접 관측·검증한 것이 아니라, 제품 오너가 실제 Sandbox에서
직접 실행하고 이 세션에 보고한 결과**를 그대로 기록한다(Claude는 여전히 실제 Google
API를 한 번도 호출하지 않았다 — 이 절 전체가 "보고받은 결과의 기록"이라는 성격을
명확히 유지한다).

- **decision_required였던 사용자 단위 vs canonical space 판단이 실측으로 해소됨**:
  `official@alton.education`·`teacher1@alton.education` 둘 다 `//cloudidentity.
  googleapis.com/users/{Directory API 불변 ID}` + 기존 `gate-c-meet-events` Pub/Sub
  토픽(이미 `meet-api-event-push@system.gserviceaccount.com` Publisher 권한 보유,
  신규 토픽 생성 불필요했음)으로 구독 생성 **성공** — `status=active`, 실제
  `subscription_name`(`operations/...` 형식), 실제 만료 시각(7일 후) 저장 확인. **사용자
  단위 구독 모델이 그대로 맞았다** — canonical Meet space 단위로 전환할 필요 없음.
- 상담·정규수업 Calendar/Meet 생성(attendee `matchbox512@snu.ac.kr`), 상담 시간변경 →
  같은 `google_event_id` 유지 + Google 네이티브 변경 알림 실수신, 합성 회의 → 실제
  Pub/Sub `google.workspace.meet.smartNote.v2.fileGenerated` 이벤트 도착 → 로컬
  웹훅에 실제 OIDC 서명 토큰으로 replay → `smart_notes_generation_events` 실제 매칭·
  연결(`linked=true`, `drive_file_id` resolve) → `consultations.smart_notes_drive_file_id`
  반영 → 동일 메시지 재전송 시 `skipped:duplicate_message` 멱등 확인 — 전부 성공 보고.
  외부 attendee가 Smart Notes 원본 문서를 열려고 하면 "액세스 권한 필요" 화면만 뜨고
  실제 접근 불가 재확인. 관리자 검토 요약 입력 후 4조건 게이트 통과, `outcome=
  trial_recommended`로 상담 완료 처리 성공. M2 체험수업권 자동 지급도 함께 트리거돼
  정식 학생 계정 미연결로 인한 "지급 실패 — 재처리 필요" 상태가 의도대로 정확히
  표시됨(에러 처리 정상 동작 확인).
- 정리(제품 오너 보고): Calendar 이벤트 2개 삭제, Smart Notes 문서 삭제, Workspace
  Events 구독 2개 실제 삭제(`disableSubscriptionForOrganizer()`를 임시 debug 라우트로
  호출 — 그 라우트는 사용 직후 제거, 커밋되지 않음), IAM binding 원복(diff 확인),
  `.env.local` 원복(diff 확인).
- **검증 중 발견된 실제 버그 2건 — 이 세션에서 정식으로 수정·커밋**:
  1. `ConsultationSchedulingPanel.tsx`의 "상담 결과 기록" 버튼이
     `completionReadiness !== "ready"`일 때 비활성화였는데, `completionReadiness`가
     `"ready"`가 되려면 `admin_review_summary`가 이미 채워져 있어야 한다
     (`computeCompletionReadiness()` 참고) — 즉 요약을 입력할 폼을 여는 버튼 자체가
     "요약이 이미 있어야만" 열리는 순환 참조라 실제로는 영원히 열 수 없는 버그였다.
     `completionReadiness !== "ready" && completionReadiness !== "summary_missing"`
     조건으로 수정 — 요약이 아직 없는 상태(정상적인 최초 진입 상태)에서도 폼이 열리고,
     그 외 미충족 사유(동의 미확인, Smart Notes 미설정, 원본 미연결)에서는 여전히
     비활성화된다. 회귀 테스트 추가(`ConsultationSchedulingPanel.test.tsx` 신규).
  2. `disableSubscriptionForOrganizer()`(구독 실제 정지·삭제)는 서버 액션까지 있었지만
     관리자 화면에 연결된 버튼이 없어 실제로 쓸 방법이 없었다 — "Workspace Events 구독
     상태" 섹션에 구독별 "구독 정지·삭제" 버튼(사유 입력 인라인 폼)을 추가해 정식
     UI 동선을 만들었다. 회귀 테스트 추가.
- **검증(이 세션 자체)**: 전체 Vitest 852건(849 + 신규 3건), `tsc --noEmit`·`next build`
  클린.
- **외부 변경**: 이번 라운드도 Claude 세션이 실행한 실제 Google API 호출, IAM 변경,
  이메일 발송 전부 0건 — 위에 기록된 실제 Sandbox 실행은 전부 제품 오너가 직접
  수행했다고 보고받았고, Claude는 그 결과를 문서화·코드 정정만 했다. `git push` 없음.
- **M2/M3/M4 착수 여부**: 이 세션(Claude)은 M2/M3/M4 코드를 스스로 작성하지 않았다 —
  이번 라운드에서 문서에 반영된 M2(체험수업권+정규 환불) 구현은 같은 저장소를 공유하는
  별도 세션이 독립적으로 완료해 커밋한 것이며(`007e917`/`de9cd26`/`6624c06`, 위 M2
  절 참고), 이 세션은 그 커밋을 검토·수정하지 않고 그대로 존중했다. M3/M4는 어느
  세션에서도 착수되지 않았다.

push는 제품 오너가 최종 확인 후 별도로 지시할 때만 한다(이 세션은 지시받지 않아
push하지 않았다).

### M2 — R4 후속(체험수업권 + 정규상품 환불), 완료(2026-09-03)

커밋 `007e917`(1라운드: 지급) → `de9cd26`(문서) → `<잔여 마감 커밋, 아래 §2 참고>`
(2라운드: 90일 유효기간 만료 강제 확인 + 정규상품 환불 정책, 모두 main 브랜치,
`git push` 없음). 상세는 `docs/2026-09-03-m2-migration-execution-log.md`.
**환불 정책·90일 유효기간까지 통과해 M2를 완료로 표시한다.**

- **DB**(`supabase/migrations/20261012000000_m2_trial_entitlement.sql`): 구매·환불·
  양도 불가능한 60분 전용 체험수업권 — `entitlement_types.trial_lesson_use` +
  `entitlement_products.trial_lesson_grant`(신규 `system_only` 컬럼=true, 가격
  버전 없음 → 구매 체크아웃 자체 불가). `entitlement_grants.source_consultation_id`
  + 부분 unique index로 상담당 지급 1건만 허용(idempotent). **실제로 발견한 DB
  갭**: `hold_entitlement()`가 지금까지 수업 유형(정규 120분/체험 60분)을 전혀
  구분하지 않고 child의 아무 grant나 hold했다 — `p_lesson_type_id`(기본 null,
  하위호환) 파라미터를 추가하고 `confirm_lesson_booking()`이 항상 넘기도록 해
  정규/체험 오사용을 DB 레벨에서 막았다. `admin_record_consultation_outcome()`이
  outcome='trial_recommended' 기록 시점에 같은 트랜잭션에서 지급을 시도(실패해도
  outcome 기록 자체는 막지 않음, `consultations.trial_entitlement_grant_status/_error`로
  추적) — `admin_retry_trial_entitlement_grant()`로 관리자 수동 재처리 가능. 환불은
  `refund_entitlement()`가 `purchase_id_ref`(체험은 항상 null) 기준이라 애초에
  대상이 아니고, 양도는 `is_paid=false`(체험은 항상 false)를 기존 `transfer_entitlement()`
  가드가 이미 차단 — 새 환불/양도 로직을 만들지 않았다. 취소(회수)는 기존
  `expire_entitlement()` 재사용.
- **앱 레이어**: 관리자 `ConsultationSchedulingPanel.tsx`에 지급 상태+재처리 버튼,
  보호자 `EntitlementsTab.tsx`에 체험수업권 별도 카드(정규 수업권과 절대 합산하지
  않음 — `app/parent/entitlements-data.ts`를 `entitlement_grant_details`(신규 뷰,
  lesson_type_code로 정규/체험 구분) 조회로 교체해 실제로 합산될 뻔한 버그를 사전
  차단). `purchase-actions.ts`가 `system_only` 상품의 체크아웃을 명시적으로 차단.
- **1라운드 검증**: 로컬 `supabase db reset --local`, psql 직접 검증(멱등성/오사용
  방지/양도·환불 차단/회수 전부 실측 통과), `tsc --noEmit` 클린, 전체 Vitest 846건
  통과(기존 841건 + 신규 5건, 회귀 없음), `next build` 성공, 관련 Playwright 10건
  (`m1-consultation-flow`/`r4-*`/`r6-lesson-booking-flow`) 통과, 커밋만 있는 별도
  clean `git worktree`에서 build+전체 Vitest(846/846) 재현 확인.
- **2라운드(잔여 마감, 2026-09-03) — 정책 확정 반영**: 제품 오너가 체험수업권
  유효기간(지급일로부터 90일, 실제 체험 시작 시각이 만료 이하여야 함)과 정규상품
  환불 공식(7일 이내+미사용 전액환불, 그 외 실제 결제액−소진회차×구매당시
  할인전 단건 정상가, 체험 제외)을 확정 지시해 실제로 구현했다
  (`supabase/migrations/20261013000000_m2_refund_policy_and_trial_expiry.sql`).
  **90일 유효기간**: 지급 로직(1라운드 `now()+90 days`)은 이미 정책과 일치 —
  "체험 실제 시작 시각이 만료 이하"는 R1부터 있던 `hold_entitlement()`의
  `expires_at > p_lesson_start_at` 필터가 모든 lesson_type에 이미 공통 적용하고
  있었고, 시간 변경 재검증도 기존 `reschedule_reservation_to_google_time()`이
  동일 필터로 범용 처리해 별도 체험 전용 코드가 필요 없었다(psql로 만료된 grant의
  hold 거부까지 실측 확인). **환불**: 신규 `purchase_has_active_future_holds()`
  헬퍼로 "미래 예약 해제 우선순위"를 자동 취소가 아니라 명시적 차단+안내로
  구현(근거는 마이그레이션 §1 주석, 기술적 선택 — 자동 취소가 맞다고 판단되면 이
  헬퍼 하나만 교체하면 됨). `calculate_purchase_refund_minor()`가
  `within_full_refund_window`/`blocked_by_active_holds`를 추가로 반환, 전부
  `purchases` 스냅샷(package_price_minor/unit_price_minor/confirmed_at)과
  `entitlement_ledger` 이력만 사용(가격표 재조회 없음 — 상품 가격이 나중에
  바뀌어도 과거 구매 환불액 불변). `refund_requests.within_full_refund_window`
  컬럼으로 계산 근거를 감사 이력에 고정. 체험수업권은 `purchase_id_ref`가 항상
  null이라 이 전체 경로에서 자동 제외(신규 코드 불필요, psql로 no-op 확인).
  앱 레이어: `requestRefund()`가 차단 시 즉시 친절한 에러, `approveRefund()`는
  `refund_entitlement()`의 fail-closed 재확인에 그대로 의존(이중 방어).
  관리자 화면(`EntitlementLedgerTab.tsx`)에 "구매 후 7일 이내 미사용(전액 환불
  적용)" 표시, 관리자 상담 패널·보호자 화면에 체험수업권 정확한 만료일+사용 조건
  문구 추가.
  **검증**: psql 직접 검증 5개 시나리오(7일 이내 전액환불/7일 밖 소진 반영/
  미래 hold 차단→해제 후 환불→idempotent 재시도/체험 grant 환불 대상 자동 제외/
  만료된 체험 grant hold 거부) **전부 실제 로컬 DB로 통과**, `tsc --noEmit` 클린,
  전체 Vitest 849건 통과(2라운드 신규 3건 포함, 회귀 없음), `next build` 성공.
  세션 중 로컬 Supabase DB를 다른 세션(제품 오너의 Google Sandbox 재검증)과
  공유하는 충돌이 발견돼 잠시 DB 조작을 중단했다가, 충돌 정리 확인 후 재개해
  관련 Playwright 6개 스펙 10건(`--workers=1`) 전부 통과 + 커밋 `6624c06` 기준
  별도 clean `git worktree`에서 build+Vitest(849/849) 재현까지 완료했다.
  **미완료 없음.**
- **결정 필요**: 없음 — 90일 유효기간·환불 공식 모두 2026-09-03 확정.
- **범위 밖(당시 M3/M4, 착수 전)**: 잠재고객→정식 학생 계정 연결과 체험 예약은
  이 M2 라운드에는 없었다(M4 범위). 연결 지점만 남겨둠(`grant_trial_entitlement_
  for_consultation()`이 child_id 없으면 명확한 예외를 던지고, M4가 계정 연결 후
  `admin_retry_trial_entitlement_grant()`를 호출하면 자연스럽게 이어짐). **정정
  (2026-09-03)**: 이후 실제로 완료된 M3는 "체험 선생님 배정·예약"의 선행 단계가
  아니라 이미 배정된 선생님과의 관계를 정식으로 종료하는 흐름(termination)이었다
  — 선생님 배정 자체는 trial/regular 구분 없는 단일 관계이고 M3에서 새로 만든
  것이 아니다. 체험 예약·선생님 배정 흐름은 여전히 M4 범위.
- **기술적 선택(결정 필요 아님, 근거 문서화)**: "미래 예약 해제 우선순위"를 자동
  취소가 아니라 명시적 차단으로 구현 — 예약 취소는 이미 Calendar 동기화·통지까지
  포함한 별도 완결 흐름(`cancel_lesson_booking()`)이라 환불 승인이 그걸 몰래
  트리거하면 부작용이 크다고 판단. 자동 취소가 맞다고 판단되면
  `purchase_has_active_future_holds()`만 교체하면 됨.
- **외부 변경**: 0건(Stripe/Google/이메일/원격 DB 전부 미접근). `git push` 없음.

### M3 — 선생님 배정 종료(termination) 플로우, 완료(2026-09-03)

커밋 `3bf4cce`(서버 레이어) → `659bd0f`(UI·테스트·문서 마감) → `431246e`(E2E·enum
버그 수정)(전부 main 브랜치, `git push` 없음). **이전에 전달됐던 "별도 체험 배정
모델" M3 지시는 전량 폐기됐다** —
2026-09-03 확정 정책: trial/regular는 `teacher_assignments` 레벨에서 분리된 개념이
아니라 **단일 배정 관계**다(trial 60분/regular 120분 구분은 세션의 수업유형·수업권
레벨에서만 존재). 체험 때 배정된 선생님은 계약 이후에도 그대로 유지되고, 시스템은
절대 자동으로 다른 선생님을 선택하지 않는다. 실제 선생님 교체가 필요할 때만 기존
`change_teacher_assignment()`(R5)를 재사용하는 **정식 종료(termination) 플로우**만
이번에 구현했다. 기존 `decideTrialTeacherSuccessionProposal()`/`proposals` 관련
코드·UI는 삭제하지 않고 "현재 정상 흐름에서 미사용" 상태로 남겨뒀다(R5 회귀 위험
회피, M4가 연결할 때 안전하게 제거 검토).

- **DB**(`supabase/migrations/20261014000000_m3_teacher_assignment_termination.sql`):
  `teacher_assignment_termination_requests`(요청자 role guardian/teacher/admin,
  reason, status requested/processing/completed/failed/cancelled, resolution
  reassign/end_enrollment, RLS로 관리자·요청 당사자·해당 배정 선생님만 조회),
  `teacher_assignment_termination_reservation_actions`(예약별 처리 감사, INSERT-only),
  `preview_teacher_assignment_termination_impact()`(미래 확정 예약 + 보유분 여부),
  `assert_teacher_assignment_ready_for_closure()`(미해결 미래 예약 남아있으면 종료
  차단하는 최종 게이트), `list_subject_teaching_history_for_current_teacher()`(호출자가
  `is_admin()` 이거나 그 과목의 **현재 활성** 배정 보유자일 때만 통과 — SECURITY DEFINER
  함수 안에서 매번 다시 검증하므로 재배정 취소 시 접근이 자동으로 회수됨, DB 레벨
  smoke test로 비배정 호출자가 거부되는 것 확인함). 반환 컬럼은 `session_id/starts_at/
  ends_at/final_status/lesson_type_name`뿐 — 정산 단가(`hourly_rate_snapshot_*`),
  Smart Notes 원본, 내부 메모, 다른 과목 기록은 애초에 SELECT하지 않는다(테이블
  RLS가 아니라 컬럼 단위로 걸러내는 전용 함수 방식 채택 — Postgres RLS가 행 단위이기
  때문). `teacher_assignments.curriculum_handoff_status` 컬럼에는 "이 필드는 더 이상
  실제 업무 게이트가 아니며 이번 M3 종료 플로우가 대체한다"는 주석을 남기고 값은
  건드리지 않음(하위 호환 유지, 삭제하지 않음).
- **처리 로직**(`lib/enrollment/teacher-assignment-termination.ts`): 재배정 시
  `is_teacher_slot_open()`/`violates_teacher_buffer()`로 새 선생님 가능시간·버퍼·
  중복예약을 예약별로 재검증해 이관하거나, 이관 불가하면 기존 `cancelLessonBooking()`
  으로 정식 취소(Calendar 삭제+보유분 해제 동시 처리)로 폴백. `end_enrollment`는
  미래 예약 전체를 정식 취소 후 배정·수강을 함께 종료. 낙관적 락(claim) +
  예약별 처리 기록으로 멱등/재처리 가능 — 부분 실패 시 `status='failed'`+`error`로
  남고, 관리자가 같은 요청을 다시 처리하면 이미 처리된 예약은 건너뛰고 이어서
  처리한다(중복 처리 안 됨). 과거 수업/Smart Notes 리뷰/배정 이력/정산 기준은
  전혀 수정·삭제하지 않는다.
- **권한 경계**: 선생님은 본인 배정에 대해 종료를 "요청"만 할 수 있고(`app/teacher/
  teacher-assignment-termination-actions.ts`), 확정 처리 함수는 관리자 전용 파일
  (`app/admin/teacher-assignment-termination-actions.ts`)에만 존재해 구조적으로
  선생님이 직접 종료를 확정할 수 없다. 보호자 요청은 R11 메신저 없이 관리자가
  외부 연락을 받아 대신 접수.
- **UI**: 관리자 — `MatchingTab` 하단 `TeacherAssignmentTerminationPanel`(요청
  목록/요청자·사유/미래 예약 영향 미리보기/재배정·수강종료 선택/처리·재처리).
  선생님 — `AssignmentsTab`에 "배정 종료 요청" 인라인 폼(제출 후 상태만 조회 가능)
  + "과거 수업 이력 보기" 접이식 위젯(현재 활성 배정 건에 한해 날짜/수업유형/상태만).
  보호자·학생 — 기존 R5 `EnrollmentTab`이 이미 `currentTeacher`/`upcomingTeacherChange`
  를 실시간 DB 조회로 보여주고 있어(변경 없음) 확정된 현재 선생님과 예정된 변경
  결과가 그대로 반영됨.
- **"과거 조회" 기능의 정확한 범위(2026-09-03 명문화)**: 지금 제공하는 것은
  `수업 일시·수업유형·최종상태`만 보여주는 "과거 수업 이력"이지, 단원·교재·
  과제·검토 리뷰 같은 실제 교육 진행 내용이 아니다. 새 선생님은 안전한 읽기
  권한과 이 최소 이력만 받는다 — 단원·교재·마일스톤·과제·검토 완료 리뷰까지
  같은 학생·과목 범위로 확장하는 것은 R9. Smart Notes 원본·내부 메모·정산
  정보·과거 대화는 M3·R9 모두 계속 제외.
- **검증**: DB 레벨 smoke test(비배정 호출자 거부, 스키마·함수 존재 확인, psql
  직접 실행) + Vitest 신규 4개 파일(`lib/enrollment/teacher-assignment-termination.test.ts`
  5건, `app/admin/TeacherAssignmentTerminationPanel.test.tsx` 2건, `app/admin/
  teacher-assignment-termination-actions.test.ts` 1건 — 민감 컬럼 비노출 확인,
  `app/teacher/AssignmentsTab.test.tsx` 3건 — 선생님 본인 확정 불가/중복 요청 방지/
  이력 화면에 민감 정보 없음) 전부 통과. 전체 Vitest 143개 파일/863건, `tsc --noEmit`,
  `next build` 클린. 로컬 개발 DB에 마이그레이션 적용 확인(`npx supabase db reset
  --local`). **Playwright E2E**: `e2e/m3-teacher-assignment-termination-flow.spec.ts`
  신규 작성 — 관리자가 종료 요청을 접수·처리(수강 종료)하는 흐름을 실브라우저로
  검증, 기존 `e2e/r5-subject-enrollment-flow.spec.ts`와 함께 실행해도 데이터
  충돌 없이 병행 통과함을 확인(4 passed). 이 E2E를 처음 돌리며 실제 버그를
  발견·수정했다 — `end_enrollment` 처리 시 `subject_enrollments.status`를
  `teacher_assignments`와 같은 값(`"ended"`)으로 쓰려다 실제 enum
  (`v3_subject_enrollment_status`: planned/active/paused/completed/terminated)에
  없는 값이라 매번 실패하던 것을 `"terminated"`로 수정(`431246e`). **클린 `git
  worktree` 재현**: `659bd0f`(UI·테스트·문서 마감) 기준 별도 worktree에서
  `node_modules` 하드카피 후 `next build`+전체 Vitest(143/863) 재현 완료 —
  이후 `431246e`의 1줄 enum 값 수정은 같은 파일 기준 전체 Vitest/`tsc --noEmit`
  재실행으로 회귀 없음을 확인(별도 worktree 재실행은 생략, 변경 폭이 매우 작아
  동등하다고 판단).
- **범위 밖(명시적으로 만들지 않음)**: 별도 trial-teacher-assignment 테이블,
  candidate/pending/rejected/expired 상태 머신, trial→regular 승계 제안·전환
  로직, 보호자/학생용 선생님 선택 화면, 커리큘럼 핸드오프 요청/수락/완료 워크플로우,
  문서 복사·데이터 마이그레이션·Drive 소유권/ACL 변경, 별도 핸드오프 체크리스트.
  구조화된 과목 마일스톤 보드/진도 핸드오프 기능은 여전히 R9 범위.
- **결정 필요**: 없음.
- **외부 변경**: 0건(Google/Stripe/DocuSign 실호출, 실이메일, 원격 DB, `git push`
  전부 없음).

### M4 — 상담→체험→정규 전환 통합, **로컬 구현 완료 — 외부 통합(실제 Google/DocuSign/Stripe·Preview) 승인 대기**

M4는 2026-09-03 승인으로 착수해 3라운드(커밋 `343e1aa` → `eef362e` → `7ea992d`)
에 걸쳐 목표 흐름 14개 절 중 **1~11번과 13번(골든 패스 E2E)을 로컬에서 구현·
검증 완료**했다. 12번(명시적 비범위)은 실제로 손대지 않았음을 확인, 14번(문서
동기화)은 이 절 자체로 충족.

- **1/N(계정 연결 + 동의, 커밋 `343e1aa`)**: `trial_onboarding_links`(만료형
  72h·단일사용·해시), `confirm_trial_intent()`(관리자 추천과 보호자 확정 구분),
  신규 보호자 경로(`finalize_trial_onboarding_new_guardian()` + R2 `invite/accept`
  패턴 재사용 `/api/trial-onboarding/redeem`), 기존 보호자 경로(`link_existing_
  guardian_to_trial_onboarding()`, 로그인 자체가 본인확인, 자동 병합 없음),
  `trial_smart_notes_consents`(학생당 1건, 멱등), `grant_trial_entitlement_for_
  consultation()`(M2)에 동의 게이트+학생 기준 중복 지급 방어. `profiles.id`가
  `auth.users` FK라 학생도 실제 Auth 계정이 필요함을 DB smoke test로 실제
  재현해 발견·수정.
- **2/N(배정·리뷰·전환·계약 발송, 커밋 `eef362e`)**: 3번(과목 수강+선생님 배정,
  `get_or_create_draft_contract_for_child()` + 기존 R5 `planSubjectEnrollment`/
  `assignTeacherToSubjectEnrollment` 재사용), 7번(`trial_lesson_reviews` draft/
  final 2단계, 확정 전 고객 비공개, `get_trial_lesson_review_for_family()`는
  `final_text`만 반환), 8번(`trial_regular_progress_selections`, 확정 리뷰 없으면
  차단·멱등), 9번(`sendRegularContractOneClickAction` — proposals 불필요,
  대조→생성→선서명→발송을 한 액션으로, 중복 클릭 안전). **실제 안전 문제
  발견·수정**: `lib/docusign.ts`의 `createEnvelope()`에 지금까지 실제 호출을
  막는 게이트가 전혀 없었다(Calendar의 `CALENDAR_SYNC_ALLOW_REAL_CALLS`와 달리,
  `.env.local`에 실제 sandbox 자격증명이 있어 로컬/E2E 실행 중 실수로 진짜
  발송이 나갈 위험) — `DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS` 게이트 신설(기본
  false). 6번(체험 예약)과 10번(서명→구매→활성화, `teacher_assignment` 불변)은
  기존 R6/M2/R4/R5/R3 인프라가 이미 generic하게 지원함을 코드로 확인 — 새 코드
  불필요(`confirm_lesson_booking()`이 이미 `p_lesson_type_id`로 체험/정규 상호
  오사용을 막고, DocuSign 웹훅·R4 구매·R5 활성화 전부 계약 상태 기준으로 이미
  일반적으로 동작).
- **3/N(골든 패스 E2E, 커밋 `7ea992d`)**: `e2e/m4-trial-to-regular-golden-path.spec.ts`
  — 11단계 실브라우저 테스트(상담 seed → 체험 확정 → 온보딩 링크 → 신규 보호자
  계정 생성 → 과목·선생님 배정 → 동의+체험수업권 지급(+정규 예약 거부 부정
  테스트) → 체험 예약·완료 → 선생님 리뷰 확정 → 보호자 정규 진행 희망 → 관리자
  원클릭 계약 발송(mock 실패 경로) → DocuSign 웹훅 시뮬레이션으로 계약 active →
  정규 구매 시뮬레이션+과목 활성화 → `teacher_assignment` 불변 확인+같은
  배정으로 120분 정규 예약)까지 전부 통과. 이 E2E를 처음부터 통과시키는 과정에서
  실제 버그 여러 건 발견·수정: `confirm_trial_intent`/`create_trial_onboarding_
  link`/`get_or_create_draft_contract_for_child`/`admin_edit_trial_lesson_review`
  가 SQL 안에서 `is_admin()`을 다시 확인해, service_role(admin 서버 액션의
  정상 호출 경로) 세션에는 `auth.uid()`가 없어 항상 "관리자만..." 예외로
  실패하던 것(앱 레이어 requireAdminOrCapability와 중복 검사라 SQL 쪽을 제거,
  감사 컬럼도 실제 관리자 id를 파라미터로 받도록 수정), 선생님이 완료된 체험
  수업을 리뷰 대상으로 못 찾던 PostgREST 임베디드 조인 필터 오류(실제 테이블명
  대신 별칭으로 필터해야 했음).
- **4/N(잔여 부정/복구 테스트 명시화, 커밋 `0496985`)**: 요구사항 13번 목록 중
  이전 라운드까지 전용 테스트가 없었던 5개를 새 기능 없이 테스트만 추가해
  못박았다 — 90일 이후 체험 예약 차단·24시간 기준 취소(release vs 소진, 학생/
  선생님·회사 케이스 포함)는 `lib/booking/trial-entitlement-and-cancellation.
  integration.test.ts`(psql 직접 실행), 미배정·다른 선생님 예약 차단은
  `lib/booking/authorization.test.ts`(`assertActiveTeacherAssignment()`),
  계약 발송 실패 후 재처리→성공은 `app/admin/trial-onboarding-actions.test.ts`
  에 추가(1차 실패→같은 계약 버전 재사용·재선서명 없이 2차 성공, 이미 발송된
  버전 재클릭 시 중복 발송 안 함), 보호자 서명 전 구매 차단은
  `app/parent/purchase-actions.test.ts`에 M4 전용 케이스 추가(기존 R4
  active-계약 게이트와 동일 메커니즘임을 명시). 통합 테스트 작성 중 테스트
  자체의 시행착오(선생님 예약 버퍼 충돌, `starts_at`만 갱신하고 `ends_at`을
  안 바꿔 거대한 겹침 범위가 되던 것, 불변 `entitlement_ledger`를 `afterAll`
  에서 지우려던 시도)를 psql 실행 결과로 바로 확인하며 수정 — 프로덕션 코드
  변경은 없음.
- **검증**: 전체 Vitest 147개 파일/883건, `tsc --noEmit`, `next build` 클린.
  핵심 M1/M3/R3/R5/M4 Playwright 5스펙 17건(golden path 11건 포함) 전부 통과.
  통합 HEAD 기준 클린 `git worktree`에서 build+전체 Vitest 재현 완료. DB 레벨
  smoke test(신규 보호자 전체 경로, 동의 전 지급 거부, 타 가족 동의 차단,
  비배정 호출자 거부 등)도 별도로 psql 직접 실행 확인.
- **5/N(역할별 UI 폴리싱 + 외부 통합 검증 요청서, 문서만 실행 없음)**:
  관리자 화면을 상담별 14단계(체험 희망→…→과목 활성화) 파이프라인 시각화로
  재구성 — 완료/현재/다음 관리자 행동을 구분해서 보여주고, 아직 못 누르는
  단계는 비활성화 대신 "보호자/선생님 행동 대기 중" 같은 차단 사유를 보여준다.
  온보딩 링크는 미발급/대기/사용완료/만료(재발급 유도) 상태를 구분. 정규 계약
  발송은 인라인 확인 다이얼로그(회사 선서명+DocuSign 발송이 한 번에 처리된다는
  안내)를 거치게 하고, 실패 시 "관리자 조치 필요"로 표시하며 같은 계약 버전으로
  안전하게 재시도 가능. 보호자 이메일/이름 확인 불가 시 발송 버튼 자체를
  차단 사유와 함께 비활성화. 선생님 리뷰 화면은 초안 저장(비공개)/고객 화면
  미리보기/공개 확정(인라인 확인)을 명확히 분리. 보호자 화면은 "정규 진행
  희망"이 계약 체결이 아니라는 안내, 체험수업권 60분·90일·구매환불양도불가
  조건, 리뷰 확정 전에는 이 단계 자체가 안 보인다는 것을 명시. 학생/보호자
  공용 화면(EnrollmentTab)에 확정 리뷰만 노출하는 표시를 추가하되, 보호자
  전용 버튼(정규 진행 희망)은 별도 컴포넌트로 분리해 학생 화면에는 절대
  섞이지 않게 했다. 색상은 프로젝트 기존 디자인 토큰(`text-red`/`text-green`/
  `text-ink`)으로 통일 — 이전 라운드에서 실수로 쓴 Tailwind 기본 팔레트
  (`red-600`/`green-600`/`blue-600`)를 걷어냄. `window.prompt()`/브라우저
  기본 confirm은 애초에 쓰지 않았음(전부 인라인 폼/확인 UI). 외부 통합 검증
  요청서(`docs/2026-09-03-m4-external-integration-verification-request.md`)
  신규 작성 — 실행은 전혀 하지 않음(Preview 생성도 포함해 금지).
- **검증(5/N)**: UI 컴포넌트 테스트 4개 파일 신규(`TrialOnboardingPanel.test.tsx`
  4건, `TrialReviewPanel.test.tsx` 4건, `TrialConversionPanel.test.tsx` 3건,
  `EnrollmentTab.test.tsx` 2건). 골든 패스 E2E를 변경된 실제 문구·2단계 확인
  플로우로 재작성해 11단계 전부 재통과 확인. 전체 Vitest 151개 파일/896건,
  `tsc --noEmit`, `next build` 클린. 핵심 M1/M3/R3/R5/M4 Playwright 5스펙
  17건 동시 실행 재확인. 통합 HEAD 기준 클린 `git worktree` 재현 완료. 관리자
  화면은 실제 로컬 브라우저로 직접 확인(파이프라인 단계 표시가 실제 DB 상태와
  일치함을 확인) — 나머지 3개 역할 화면과 전체 상태·오류·빈 화면 매트릭스
  (요구사항 7의 12가지 케이스, 모바일 폭 포함)는 컴포넌트 테스트로만 확인했고
  실브라우저로 전부 순회하지는 못했다.
- **미완료**: 요구사항 7의 상태·오류·빈 화면 검수 매트릭스 중 실브라우저로
  직접 확인한 것은 관리자 화면 1건뿐 — 보호자·학생·선생님 화면과 모바일 폭,
  권한 없는 접근 등 나머지 케이스는 컴포넌트 테스트로만 검증했다. **코드·DB·
  로컬 E2E·UI 폴리싱·전용 테스트가 전부 완료됐어도 Preview·실제 Google/
  DocuSign/Stripe 검증 전에는 "로컬 구현 완료·외부 통합 승인 대기"로만
  표시한다** — 전 라운드 통틀어 실외부 호출·실제 이메일 발송·Preview 생성을
  전혀 하지 않았다. **M4 로컬 구현·검증 완료, 역할별 UI 폴리싱 및 외부
  Sandbox/Preview 통합 검증 대기.**
- **6/N(온보딩 이메일 실제 전달 경로 + 로그인 이메일 분리, 로컬 Mailpit
  검증만)**: 관리자의 "체험 온보딩 안내 발송"이 이제 기존 SMTP 경로
  (`lib/email.ts`)로 실제로 이메일을 보낸다(로컬은 Mailpit) — 절대 URL·발송
  시각·발송 상태(`notice_delivery_status`)·내용 지문(`notice_content_hash`)을
  `trial_onboarding_links`에 기록. 중복 클릭 방지: 이미 발송 완료된 링크는
  재요청해도 다시 보내지 않고(`already_sent`), 발송 전 실패한 링크만 안전하게
  폐기(revoked)하고 재발급해서 다시 보낸다 — 관리자 화면도 발송 즉시 버튼
  자체가 "보호자 행동 대기 중"으로 바뀌어 재클릭 경로가 없어진다. 발송 실패는
  계정 생성과 완전히 무관하게 실패 상태로만 남는다(계정 생성은 보호자가
  링크를 열어야만 시작되는 별개 흐름). 개발 환경에서만 관리자 화면에 확인용
  링크를 추가로 보여준다(운영에서는 노출 안 함, 전체 토큰 복사 전달 방식에
  의존하지 않음).
  prospect 이메일과 보호자 로그인 이메일도 분리했다 — `redeem` 라우트가 이제
  바로 계정을 만들지 않고 `/consult/trial-onboarding/confirm-email` 화면으로
  먼저 보낸다. 그 이메일을 그대로 쓰면(=온보딩 링크를 그 주소로 실제 수신·
  클릭한 사실 자체가 상담 연락처 접근 확인) 즉시 계정 생성, 다른 주소로
  바꾸면 새 테이블(`trial_login_email_change_requests`)로 별도 소유 확인
  메일을 보내고 그 확인이 끝나야만 계정을 만든다. 이미 다른 계정이 쓰는
  이메일이면 토큰을 주지 않고 `conflict_manual_review` 이벤트만 남긴다(자동
  병합 없음). 원래 prospect 이메일(`trial_onboarding_links.guardian_email`)은
  상담 당시 스냅샷으로 절대 덮어쓰지 않는다 — `converted_guardian_id`는
  실제 인증된 계정 id로만 연결(기존 설계 그대로, 이번에 변경 없음).
- **검증(6/N)**: 신규 DB 마이그레이션(`20261018000000`)의 이메일 변경 함수를
  DB 통합 테스트로 확인(`app/consult/trial-login-email-change.integration.test.ts`
  3건 — 정상/중복계정 차단/미검증 토큰 거부). 관리자 발송 액션 단위 테스트
  3건 추가(처음 발송/중복 클릭 시 재발송 안 함/실패 시 상태만 남음).
  `ConfirmEmailForm.test.tsx` 3건 추가. 골든 패스 E2E를 실제 Mailpit 발송·
  수신 경로로 재작성해 11단계 재통과(관리자 화면 노출 링크 대신 실제 수신
  메일에서 링크를 추출해 검증 — 더 엄격해짐). 전체 Vitest 157개 파일/909건,
  `tsc --noEmit`, `next build` 클린. 통합 HEAD 기준 클린 `git worktree` 재현
  완료. 실브라우저로 온보딩 확인 화면의 "유효하지 않은 링크" 오류 상태와
  모바일 폭(375px) 레이아웃을 추가로 직접 확인(잘림·가로스크롤 없음).
  외부 통합 검증 요청서를 Preview 브랜치 방식(`preview/m4-integration-
  verification`, main push 아님)·원격 비운영 Supabase 프로젝트 마이그레이션
  목록/백업/복구 절차·Google 검증 범위(Calendar 이벤트 최대 2개, Smart Notes
  1회·최대 20분)·이메일 상한 표(최대 11건)·23단계 UAT·확정 테스트 계정
  (`matchbox512@snu.ac.kr`, `teacher1@alton.education`)까지 반영해 갱신.
- **결정 필요**: 외부 통합 검증에 쓸 학생 테스트 이메일 주소 1개(보호자는
  `matchbox512@snu.ac.kr`로 확정,
  `docs/2026-09-03-m4-external-integration-verification-request.md` §3 참고)
  — 이 세션이 임의로 만들거나 실제로 메일을 보내지 않았다.
- **외부 변경**: 0건(Google/Stripe/DocuSign 실호출, 실이메일, Production·원격
  운영 DB, `git push`, Preview 생성 전부 없음).

### M4 계획 흐름 정정(문서, 앞선 라운드에서 반영, 2026-09-03)

이번 M4 착수 이전 라운드에서 계획된 흐름 서술을 아래로 정정해뒀다
(`docs/2026-08-29-master-roadmap-v3.md` M4 절도 동일하게 정정 반영됨):

`상담 → 체험 희망 확인 → 보호자·학생 ID 생성 및 검증 → 과목 수강 관계 생성 →
선생님 배정 → 학생별 최초 1회 체험 Smart Notes 안내·동의 → 60분 체험수업권 지급 →
배정된 선생님의 가능시간으로 체험 예약 → 체험수업·검토 리뷰 → 보호자의 정규 진행
희망 표시 → 관리자 조건 확인 → 관리자가 '정규 계약 발송' 버튼 1회 클릭 → 회사
선서명과 DocuSign 발송 즉시 실행 → 보호자 서명 완료 → 정규상품 구매 → 같은
선생님과 정규수업 계속 진행`

확정된 원칙: 잠재고객은 상담 동안 비로그인 상태 유지, 보호자·학생 ID는 체험
희망 확인 시점에 검증된 온보딩으로 생성(체험 이후가 아님), 이메일 문자열 자동
병합 없음, 과목+선생님 배정은 체험 전에 완료, 체험 예약은 이미 배정된 선생님의
가능시간만 제공, 계약 이후 새로운 배정을 만들지 않음(수업권/계약 상태만 변경),
계약·구매 완료 자체는 선생님 변경을 트리거하지 않음(M3 종료 플로우를 관리자가
명시적으로 실행해야만 변경됨), 별도의 고객 대면 제안/승인 단계 없음, 관리자
확인은 기존 R3 인프라로 회사 선서명+DocuSign 발송을 즉시·멱등하게 한 동작으로
트리거, 구매 단계는 보호자 서명 전에 열리지 않음, `proposals` 구조는 M4의 새
흐름에서 남아있더라도 미사용, 계약/법률 문서는 수정하지 않음.

## `material_version_id` 정책(R9 이관, 2026-09-02 명문화)

`sessions.material_version_id`(교재 버전 스냅샷 FK)는 R1부터 nullable 컬럼으로만 존재하고 실제로 채워진 적이 없다 — "이 subject_enrollment가 지금 어떤 교재 버전을 쓰는지"를 판정하는 개념 자체가 R9(과목 템플릿과 학생별 진도 스냅샷) 전에는 없기 때문이다. 이번 세션에서 제품 오너 요구에 따라 정책을 다음과 같이 명문화했다(구현은 R9에서):

- **예약(booking) 자체는 이 값이 null이어도 막지 않는다** — 지금처럼 예약 시점에는 채우지 않는다.
- **R9가 학생의 확정 커리큘럼 진도를 판정하는 즉시**, 아직 시작하지 않은(`actual_start_at is null`) 예정 세션들에 버전을 배정해야 하고, **세션이 시작되기 전에는 반드시 non-null이어야 한다** — "수업 시작 전 필수 선행 조건(blocker)"으로 취급한다. `docs/2026-08-29-master-roadmap-v3.md` R9 체크리스트에 동일 항목 등록 완료.
- **이미 시작했거나 완료된 세션의 `material_version_id`는 절대 재배정/덮어쓰지 않는다** — R1의 스냅샷 불변 원칙을 그대로 따른다.
- **기존 데이터 무결성 규칙과의 충돌 여부(조사 완료)**: 현재 `material_version_id`를 보호하는 트리거나 제약은 전혀 없다 — R1의 `sessions_prevent_direct_update` 트리거(`supabase/migrations/20260830040000_r1_reservation_session.sql`)는 `before update of final_status`로 **`final_status` 컬럼 UPDATE에만** 반응하고 `material_version_id`는 건드리지 않는다. 즉 이 정책은 기존 불변성 규칙과 **충돌하지 않는다** — R9 구현 시 지금은 없는 새로운 트리거/체크(시작 전 세션만 UPDATE 허용)를 추가해야 하는 것으로, 제품 정책 결정이 필요한 사항은 아니다(그대로 진행 가능).

## M4 UAT 종합 검증 라운드(2026-09-05 야간, 코드 점검·보완) — 완료, 상세는 별도 로그

제품 오너의 M4 실사람 UAT 도중 발견된 실버그 다수 수정 + 기획자가 사전에 요청한
10개 항목 코드 점검(전부 실제 문제로 확인)에 대한 보완 라운드. 완료 항목·보류
항목과 각 보류 사유는 `docs/2026-09-05-m4-uat-review-round-log.md`에 전부 정리돼
있다 — **다음 세션은 이 로그부터 읽을 것.** 요약:

- **완료·배포됨**: 레거시 계약 관리 화면 삭제, 4개 포털 라우트 에러 바운더리 추가
  (패널 렌더링 오류로 전체 포털이 새로고침 없이는 복구 불가능하던 문제), Meet
  참가자 join/leave 이벤트 403 버그, SMTP 미설정 시 가짜 성공 처리, 이메일 HTML
  미이스케이프, 선생님 배정 후 학생 활성화 실패 은폐, 온보딩 부분 실패 시 고아
  Auth 계정 정리, Smart Notes 원본 Drive 식별자가 학생·보호자에게 직접 노출되던
  문제(`session_smart_notes` 테이블로 분리), Workspace Events 웹훅이 DB 반영
  실패를 200으로 ack해 Pub/Sub 재시도를 스스로 막던 문제 + 미완료 재전송을 영원히
  건너뛰던 문제, 학생 이메일 조기 확인(email_confirm이 계정 생성 시 바로 true라
  실제 이메일 검증 게이트가 죽은 코드였음) 수정, 관리자 상담 탭 정리(제안서 관리
  제거, 상담 관리→상담 현황 개명, 보호자 동의 대기를 대기/완료로 분리).
- **완료(2026-09-05 후속 세션)**: #2 학생 프로필 필드 추가 — 비밀번호 설정 후
  별도 필수 "프로필 완성" 단계(`/complete-profile`, 건너뛰기 불가, 로그인마다
  재확인, `lib/auth.ts` `resolveAccountDestination()`에 게이트 추가)로 생년월일
  (최초 1회 자가입력만 예외 허용, 이후 변경은 여전히 보호자/관리자 전용)·학교명·
  학년(전부 필수)·SAT(기본 0)·GPA·목표 대학·관심 전공(선택) 수집, AP 이수 상황·
  비교과 활동은 `student_ap_courses`/`student_extracurricular_activities` 구조화
  리스트로 분리(본인 추가/삭제, 본인/담당 선생님/보호자/관리자 조회). 관리자
  `UsersTab`(`StudentDetailPanel`)에 읽기 전용 열람 카드 추가. 마이그레이션
  `20261026000000_m4_student_profile_completion.sql`. 상세·미확정 가정(목표
  대학/전공 개수 제한 없음, 완료 게이트는 "필수" 명시 3항목만)은
  `docs/2026-09-05-m4-uat-review-round-log.md` #2 절 참고 — 실제 확인 필요.
- **완료(2026-09-05, 같은 후속 세션 이어서)**: #4 체험 리뷰 정식화 — 조사 결과
  "정규수업 리뷰"(AI 요약+카테고리별 의견) 구조 자체가 R9 미착수로 존재하지
  않아, 체험/정규 공용 구조(`lesson_reviews`/`review_categories`/
  `lesson_review_category_notes`, 카테고리 5개: 학업 태도/이해도/참여도/과제
  이행/종합 의견, 관리자가 `review_categories` UPDATE만으로 조정 가능)를 조기
  설계해 체험에 먼저 적용, R9 착수 시 정규수업도 이 구조를 재사용하기로 확정.
  기존 `trial_lesson_reviews`는 데이터 백필 후 제거. `AI 미팅록 자동 요약`은
  텍스트 붙여넣기 전용 `ai_summary` 컬럼만 준비(실제 자동 생성 API 연동은 범위
  밖). 마이그레이션 `20261027000000_m4_unified_lesson_reviews.sql`. **레거시
  `session_reviews`(구 `legacy_sessions` 세션뷰 대상, 하드코딩 4카테고리)는
  이번에 건드리지 않음 — R9 착수 시 신규 구조로 교체할지 별도 결정 필요.**
- **완료(2026-09-05, 같은 후속 세션 이어서)**: #3.1(매칭 액션→상담 현황 통합) +
  #5("상담 종료" 버튼 + "지난 상담" 탭 + 5단계 보드뷰) + #6(상담 등록
  캘린더뷰) — 함께 리디자인. "상담 현황"을 5단계(상담 신청/상담 일정 확정/
  체험 신청/체험 일정 확정/계약서 전달) 칸반 보드로 교체(`ConsultationKanbanBoard.tsx`,
  상태는 기존 `consultations.status`/`outcome`/체험 파이프라인에서 파생만 함,
  신규 상태값 없음). 카드 상세 패널에서 선생님 배정만 제외한 전 액션(체험
  동의는 읽기전용 노출, 체험수업권 재처리, 체험 리뷰 확정 검수, 정규 계약
  발송·재발송 등) 통합 실행 가능. "상담 종료" 버튼 → 종료유형 추천+리뷰 초안
  팝업 → `admin_close_consultation()` → "지난 상담" 탭(4유형별 필터·통계).
  상담 등록 화면에 월간 캘린더뷰 추가(`MonthCalendar` 재사용). 마이그레이션
  `20261028000000_m4_consultation_closure_and_kanban.sql`(`closure_type`/
  `closed_at`/`closure_review_text` 컬럼, 기존 status/outcome 의미 불변).
  **미완료**: 통합 흐름 Playwright E2E 1건 시간 예산상 생략 — 다음 세션 권장.
- #9(체험 Smart Notes 동의 버전 서버 미검증)는 사용자가 "법률 검토 후 오픈 전
  정리, 이슈 아님"으로 확정 — 액션 없음, 그대로 둠.
- 활성화 게이트 단순화(계약 active 단일 조건, 결제 조건 제거), DocuSign 발송을
  전자서명이 아니라 "인증된 관리자의 전자승인 기록 삽입" 방식으로 확정한 것도
  같은 세션 앞부분에서 반영 완료(커밋 이력은 로그 파일 참고).

**2026-09-05 야간 M4 UAT 라운드는 이 시점에서 전부 완료됐다** — 로그의 완료·
보류 항목 5개(#2/#3.1/#4/#5/#6) + #9 전부 처리 확정. 남은 것은 위 두 절의
Playwright E2E 2건(신규 리뷰/상담 흐름) 추가와, 다음 세션에서 사용자가 확인해야
할 가정들(#2 완료 게이트 범위, #4 레거시 `session_reviews` 처리 방향)뿐이다.
전부 로컬 git commit까지만 진행됐고 `origin`/`main`에는 push하지 않았다 —
다음 세션에서 push·Preview 배포 여부를 확인할 것.

## 실측 UAT(2026-09-05, 로컬 dev 환경에서 처음부터 직접 클릭) — 버그 3건 발견·수정

상담 신청(홈페이지) → 관리자 수락 → 상담 결과 기록 → 체험 진행 확정 → 온보딩
이메일 발송 → 실제 메일함(Mailpit) 링크로 보호자 계정 생성까지 실제로 끝까지
눌러보며 검증(커밋 `eacaf2d`):

1. `consultation-kanban-actions.ts`가 `"use server"` 파일에서 상수 객체
   (`KANBAN_STAGE_LABEL` 등)를 export해 "상담 현황" 탭이 로드 즉시 500 에러로
   죽던 버그 — 상수를 `consultation-kanban-constants.ts`로 분리해 수정.
2. 관리자 홈 대시보드의 "상담 요청 대기"/"확정된 상담 일정" 위젯이 여전히 동결된
   레거시 `consult_requests`를 읽고 있어 실제 칸반 보드(신규 `consultations`)와
   숫자가 항상 어긋나던 버그 수정.
3. `getConsultationCardDetailAction()`이 `child_id`가 없는(막 들어온 잠재고객)
   상담은 파이프라인 조회 자체를 건너뛰어 "체험 온보딩 안내 발송" 폼이 절대
   뜨지 않던 버그 + `trial_intent_confirmed_at`이 모든 select와
   `getTrialOnboardingPipelineAction()` 호출에서 통째로 빠져 있어(항상 `null`
   전달) "체험 진행 확정" 버튼 자체가 카드에 없어 온보딩 전체가 막혀있던 버그.
   둘 다 수정 — 이제 실제로 상담 신청부터 보호자 계정 생성까지 로컬에서 전부
   통과함을 확인했다.

같은 라운드에서 정상 동작으로 확인된 것(버그 아님): Calendar 실제 API 미호출
시 결과 기록·Smart Notes 게이트가 올바르게 막는 것, 체험수업권 지급이 child_id
없을 때 올바르게 실패·재처리 대상으로 남는 것. **후속 확인 필요(이번엔 안
고침)**: `ConsultationSchedulingPanel.tsx`의 "반복 가능시간 추가"/"휴무일
추가" 버튼이 아직 `window.prompt()`를 쓴다 — 다른 패널은 이미 인라인 폼으로
교체했는데 이것만 남아 브라우저 자동화로 테스트 불가(사람이 쓰기엔 문제없음).
계속 진행하면 보호자가 자녀 프로필 완성(#2)·과목 배정·선생님 배정·체험 예약·
Smart Notes 동의(정책 버전 시드 0건이라 로컬에서 막힘)까지 이어지는데, 이번
세션은 온보딩 계정 생성 단계까지만 확인했다.

## 실측 UAT 2회차(같은 날 이어서) — 골든 패스 전체(상담→계약 발송→종료) 실제 완주

1회차 이후 이어서 상담 신청→수락→체험 진행 확정→온보딩→계정 생성(재현)→관리자
과목/선생님 배정(R5 패널)→보호자 Smart Notes 동의→체험 예약·완료(psql, R6가 이미
검증한 예약 UI 자체는 재검증 생략)→선생님 체험 리뷰 작성·공개 확정→보호자 확정
리뷰 열람→정규 진행 희망→관리자 계약 발송(mock 실패 경로)→상담 종료→지난 상담
탭까지 전부 실제로 클릭해 완주했다(로컬 개발 DB, 실제 외부 API 호출 없음).

- **확인**: #4(체험 리뷰) 구조가 선생님→공개 확정→보호자 열람까지 카테고리 5개
  그대로 정확히 흐른다. #5 칸반 카드가 상담 신청→...→계약서 전달까지 5단계로
  정확히 이동하고, "상담 종료"→"지난 상담" 탭(유형별 통계)도 정확히 동작한다.
- **버그 발견·수정(같은 라운드, 추가 커밋)**: 계약 발송이 (의도대로) mock
  DocuSign 비활성 상태로 실패해도 칸반 카드에 아무 실패 안내가 없어 관리자가
  재시도해야 하는지 알 수 없던 문제 — `ContractSendForm` 위에 "발송 실패 —
  관리자 조치 필요(계약은 draft 상태로 남아있습니다)" 안내를 추가(레거시
  `TrialOnboardingPanel`에는 있던 안내가 새 칸반 통합에서만 빠져 있었다).
- **환경 문제(코드 버그 아님, 해결됨)**: 테스트 중간에 모든 서버 액션이
  16~19초까지 느려진 원인은 `supabase_kong_ALTON` 도커 컨테이너가 CPU 100%로
  멈춰 있었기 때문 — `docker restart supabase_kong_ALTON`으로 즉시 해결. 다음
  세션에서 로컬 dev가 이유 없이 느리면 `docker stats`로 Kong 컨테이너부터 확인할 것.
- **전체 회귀**: Vitest 981/981(로컬 DB reset 후 클린 통과 확인 — 수동 테스트로
  오염된 seed 데이터 때문에 reset 전에는 무관한 테스트 5건이 일시적으로 실패했으나
  reset 후 재현 안 됨, 회귀 아님), `tsc --noEmit` 클린.
- 로컬 git commit까지만 진행, push 없음. **다음 세션 남은 것**: Playwright E2E
  갱신(신규 리뷰/칸반 흐름 반영), `window.prompt()` 잔재 정리(상담 가용시간
  등록 버튼), push·Preview 배포 여부 결정.

## 사용자 피드백 반영 라운드(2026-09-05, 같은 날 세 번째) — 상담 IA 재설계 완료

실사용 후 사용자가 4가지를 다시 지시해 반영(로컬 커밋 3개: `88a81ab`/`2ca99d9`/`7ea5fda`,
전부 실브라우저로 처음부터 끝까지 재검증 완료):

1. **"선생님 배정만 빼고" 예외 폐기** — 체험 파이프라인의 과목 수강+선생님 최초
   배정이 이제 상담 탭 칸반 카드 안에서 전부 이뤄진다(매칭 탭 `SubjectEnrollmentPanel`은
   기존 학생 배정 변경 등 일반 운영 기능으로 그대로 유지, 상담 파이프라인 전용
   최초 배정만 이동).
2. **클릭형 배정 UI** — 과목 ID/선생님 ID 텍스트 입력 폼 제거, 과목 클릭 →
   그 과목 담당 가능 선생님 목록 클릭 → 배정 확정(raw UUID 없음).
3. **칸반 5단계 재정의** — "계약서 전달"→**"계약"**으로 개명. 보호자가 정규
   진행 희망을 표시하는 순간(관리자 발송 전이라도) 카드가 "계약" 칸으로
   이동한다. **계약 서명(날인) 완료 시 자동으로 상담을 종료 처리**(`closure_type=
   'contract_signed'`, 확정 리뷰 텍스트 재사용)해 "지난 상담"으로 보낸다 —
   DocuSign 웹훅(`app/api/webhooks/docusign/route.ts`)의 계약 활성화 직후
   `lib/enrollment/auto-close-consultation.ts`(신규)가 처리, 관리자 수동 종료도
   그대로 유지. `admin_close_consultation()`을 service_role(웹훅)도 호출 가능하게
   완화(`20261029000000_m4_auto_close_consultation_on_contract_signed.sql`).
4. **"정규 진행 중 종료" = 미날인 케이스 확인** — `contractStatus !== 'active'`일 때
   이 유형을 추천(계약이 `active`=날인 완료여야만 "정규 계약 날인" 유형).
5. **체험 리뷰 작성 위치 이동** — 선생님 "배정" 탭에서 완전히 제거,
   **"정규수업" 탭**(실제 v3 세션이 보이는 화면, 사용자가 말한 "수업 탭")의
   완료된 체험 세션 카드에 "수업 리뷰 작성" 버튼 → 팝업(`LessonReviewForm` 재사용)
   → 공개 확정 시 그 세션이 "지난 수업"으로 아카이빙(체험만 이 기준 적용, 정규
   세션의 기존 날짜 기준 분리는 그대로).
6. **가용시간 UI 전면 개선**(관리자 상담 가용시간 + 선생님 개인 가용시간 양쪽) —
   `window.prompt()` 전부 인라인 폼으로 교체, 같은 요일 안에 겹치지 않는 여러
   시간대 등록 가능(예: 월 10-17시 + 월 19-23시), 겹치는 시간대는 DB
   exclusion constraint(상담)/서버 검증(선생님)으로 차단, Google Calendar
   스타일 주간 그리드 뷰 신규 추가(`app/components/WeeklyAvailabilityGrid.tsx`
   공용 컴포넌트).

**실브라우저 재검증(2026-09-05, 세 번째 라운드 마무리)**: 새 상담 신청 →
관리자 수락 → 결과 기록 → 체험 진행 확정 → 온보딩 이메일(Mailpit) → 계정
생성 → **관리자 카드 안에서 클릭형 과목·선생님 배정** → 보호자 Smart Notes
동의 → 체험 예약·완료(psql) → **선생님 "정규수업" 탭에서 리뷰 작성·팝업·공개
확정** → 보호자 확정 리뷰 열람 → 정규 진행 희망(카드가 즉시 "계약" 컬럼으로
이동 확인) → 계약 발송(mock 실패, 안내 문구 확인) → **실제 HMAC 서명 웹훅
POST로 DocuSign 서명 완료 시뮬레이션 → 계약 `active` 전환 + 상담 자동
`contract_signed` 종료 + "지난 상담" 탭 반영까지 전부 실측 확인**. 가용시간
인라인 폼·겹침 차단·주간 그리드도 관리자·선생님 화면 양쪈 실클릭 확인.
전체 Vitest 1001/1002(실패 1건은 기존부터 있던 무관 픽스처 공유 플레이키니스,
격리 실행 시 통과 재확인), `tsc --noEmit` 클린. **로컬 커밋까지만, push 없음.**

## 시간대(timezone) 설정 UI — 4개 포털 완료(2026-09-05, 같은 날 네 번째)

`profiles.timezone`/`households.default_timezone` 컬럼은 R2부터 있었으나 값을
실제로 설정할 UI가 없던 것을 이번에 채웠다(관리자·학부모·학생·선생님 4개 포털
전부, 계정 드롭다운 "시간대 설정" 메뉴 → `TimezoneSettingsModal` 공용 컴포넌트):

- `lib/timezone.ts`에 `TIMEZONE_OPTIONS`(Asia/Seoul, America/Los_Angeles·Denver·
  Chicago·New_York — 실제 서비스 대상 지역만, 전체 IANA 목록 아님) 추가. 전부
  **IANA 시간대 이름**만 쓰고 고정 UTC 오프셋 문자열은 쓰지 않으므로 서머타임은
  `Intl.DateTimeFormat`/`Date`의 timeZone 옵션이 자동 처리한다(별도 DST 로직 불필요,
  확인 완료).
- `lib/timezone-actions.ts`(신규) — `getMyTimezoneSettings()`(개인/가족 현재값+
  우선순위 적용된 최종값 조회), `updateMyTimezone()`(본인 `profiles.timezone`,
  기존 RLS로 이미 허용), `updateHouseholdDefaultTimezone()`(그 household 주
  보호자만, 신규 SECURITY DEFINER RPC `update_household_default_timezone`
  — `20261029020000_r6_household_timezone_rpc.sql`).
- 학부모 화면은 "가족 기본 시간대"(주 보호자만 변경)와 "내 개인 시간대(선택,
  가족 기본값보다 우선)"를 구분해서 보여준다. 학생·선생님·관리자는 개인
  시간대만.
- **확정 일정 표시 배선**: 학생 홈 대시보드(`HomeDashboard.tsx`, 기존 예약
  화면 경로로 이미 연결돼 있던 timezone을 재사용), 관리자 통합 일정
  (`UnifiedScheduleTab.tsx`, 기존 고정 `America/Los_Angeles` 상수 제거하고
  본인 시간대로 교체), 관리자 상담 운영 캘린더(`ConsultationSchedulingPanel.tsx`,
  기존 고정 `Asia/Seoul` 상수 제거) — 전부 `getMyTimezoneSettings()`로 실제
  값을 읽어와 표시만 바뀌게 배선(저장된 timestamptz 자체는 변경 없음). 선생님
  쪽(`TeacherLessonScheduleTab.tsx`/`TeacherAvailabilityTab.tsx`)과 학생 예약
  화면(`LessonBookingTab.tsx`)은 이미 이전 라운드부터 `resolveUserTimezone()`
  기반 prop을 받고 있어 추가 배선 불필요(확인만 함).
- 첫 구현 시도 2회가 세션 사용량 한도로 코드 절반만 쓰고 중단돼(핵심 상수
  `ADMIN_TIMEZONE` 삭제 후 참조 미치환 등으로 `tsc` 깨짐) 그 결과물을 이어받아
  직접 마무리 — `UnifiedScheduleTab.tsx`/`ConsultationSchedulingPanel.tsx`의
  남은 참조 치환, 두 컴포넌트의 테스트 파일에 `@/lib/timezone-actions` mock
  누락으로 나던 처리되지 않은 콘솔 에러 수정.
- **검증**: `supabase db reset --local` 클린, 전체 Vitest 1002/1002 통과(에러
  0건), `tsc --noEmit` 클린. 로컬 git commit까지만, push 없음.

**다음 세션 남은 것**: Playwright E2E 갱신(신규 리뷰/칸반/시간대 흐름 반영),
`window.prompt()` 완전 정리 재확인, push/배포 여부 결정.

## M5-b(R7 장애·보충시간) completion — 2026-09-05, M5-a 이어서

M5-a(판정 규칙 코어)에 이어 R7의 나머지(선생님 지각 당일 연장·보충시간, 90분 미만
자동 QC, 회사·Meet 장애 미시작/중단, 보충시간의 미래 예약 연결)를 완료했다.

- **재사용 발견**: R1이 이미 `makeup_obligations`/`makeup_events`/`apply_makeup_time()`/
  `makeup_balances`뷰(`v3_makeup_reason`: teacher_late/teacher_partial_interruption/
  company_meet_interruption 3종 포함, `20260830060000_r1_makeup_time.sql`)와
  `teacher_qc_warnings`(R0), R6가 `sessions.late_start_minutes`/`makeup_minutes_generated`
  컬럼을 미리 만들어뒀었다 — 전부 이번에 처음 실제로 채웠다. 신규 테이블은
  `session_late_extensions`(당일 연장 합의 append-only 감사 이력) 하나뿐.
- `resolve_teacher_lateness()`: 진행 중(live) 세션만 대상. 지각분을 당일 합의로
  가능한 만큼 연장(선생님 가능시간·기존 예약 충돌 검사 통과 시에만, `is_teacher_slot_open`/
  `violates_teacher_buffer` 재사용), 못 채운 나머지는 `makeup_obligations(reason=
  'teacher_late')`로 자동 이관.
- `finalize_session_as_infra_incident()`: 회사·Meet 장애는 자동 감지하지 않는다 —
  관리자가 이 함수를 수동 호출해야만 최종판정된다. `provided_minutes<=0`(미시작)이면
  `cancel_lesson_booking(..., 'company', ...)`을 그대로 재사용(수업권 hold 복원·0분
  정산·예약 취소로 재예약 가능), `>0`(중단)이면 실제 제공 분 기준 120분 상한 정산 +
  못 제공한 분을 `makeup_obligations(reason='company_meet_interruption')`으로 이관.
- `finalize_lesson_session()` 확장(하위호환 유지, 선택 인자
  `p_teacher_fault_provided_minutes`): 선생님 사유로 실제 제공 시간이 90분 미만이면
  `teacher_qc_warnings`에 경고 적재(지급액 자체는 변경 없음 — 학생 불이익 없음).
  **주의**: `CREATE OR REPLACE`로 인자를 늘리면 기존 4-인자 오버로드가 함께 남아
  `function ... is not unique` 에러가 난다 — 이번에 기존 시그니처를 `DROP FUNCTION`
  후 재정의했다(다음에 함수 시그니처를 늘릴 때도 같은 패턴 필요).
- `apply_makeup_time_to_booking()`: 보충시간을 새 예약으로 만들지 않고 기존 미래
  정규 예약 뒤에 이어붙인다(`reservations.ends_at`/`sessions.scheduled_duration_minutes`
  연장, 선생님 가능시간·충돌 검사 포함). `entitlement_ledger`에 신규 소진 이벤트를
  만들지 않는다(요구사항 8 — 이미 원래 세션에서 발생한 채무를 상환하는 것뿐).
  `apply_makeup_time()`(R1)의 이중적용 방지 유니크 인덱스를 그대로 재사용.
- 마이그레이션 `20261031000000_m5b_late_extension_and_infra_disruption.sql`.
  통합 테스트(psql 직접) `lib/booking/session-late-and-disruption.integration.test.ts`
  10건 — 전용 선생님/학생을 매번 새로 생성해 다른 통합 테스트와의
  `teacher_availability_rules` 레이스를 원천 차단(M5-a 테스트 파일이 남긴 주석의
  레이스 패턴 재발 방지).
- 선생님 UI(`TeacherLessonScheduleTab.tsx` "지각 당일 연장") + 관리자 UI
  (`BookingReconciliationPanel.tsx` "회사·Meet 장애로 확정" + 신규 "잔여 보충시간"
  섹션)까지 연결.
- **결정 완료(2026-09-05, 제품 오너 확정)**:
  1. `makeup_obligations` 만료 정책 — **생성 후 30일**로 확정. `expires_at`
     컬럼 추가(`20261101000000_m5b_makeup_time_expiration.sql`, 생성 시점 +30일
     기본값, `makeup_obligations_no_expiry_extension` 트리거로 UPDATE를 통한
     연장 자체를 차단 — 연장이 필요하면 관리자가 새 의무를 만들어야 함).
     `apply_makeup_time_to_booking()`이 만료된 의무의 적용을 거부(`makeup_obligation_expired`).
     관리자 화면(`BookingReconciliationPanel.tsx` "잔여 보충시간")에 사용 기한을
     표시하고 만료된 건은 빨간 글씨로 별도 안내. 통합 테스트 2건 추가
     (`lib/booking/session-late-and-disruption.integration.test.ts`).
  2. `apply_makeup_time_to_booking()`이 **같은 선생님**의 예약에만 적용 가능하도록
     강제하는 기존 동작 — **그대로 유지 확정**(다른 선생님 예약으로 이전 불가).
  3. 재판정 시 entitlement 원장 자동 역전 불가(위 M5-a 절 참고) — **관리자 수동
     조정 방식 그대로 유지 확정**.
- **미해결(그대로 이월)**: `account_merges`(계정 병합) 로직에 `session_late_extensions`
  테이블 마이그레이션이 아직 연결되지 않았다 — 오픈 전 데이터가 없는 현재는 위험 없음,
  계정 병합 기능을 실제로 쓰기 전에 반드시 보완할 것.
- 전체 Vitest 1025/1025(직렬 실행 확인 — 병렬 실행 시 기존부터 있던 무관 공유 픽스처
  플레이키니스가 재현되나 이번 변경과 무관, `supabase db reset --local` 후 재현 안 됨),
  `tsc --noEmit` 클린, `supabase db reset --local` 확인. 로컬 git commit까지만, push 없음.
  Production/실제 외부 API 호출 0건.
- 커밋: `a78a237`(DB 함수)→`bc8b150`(오버로드 수정+통합테스트)→`029ba6c`(서버 액션)→
  `d181bb3`(UI).

**R7(수업 상태·출석·정산 근거)이 이것으로 전부 완료됐다.**

## M4·M5 검수 보완 라운드 — 완료(2026-09-05, 제품 오너 코드 리뷰 후 지시)

제품 오너가 M4·M5 상태 문서와 실제 구현을 검수한 뒤 9개 항목을 하나의 라운드로
지시(R8/R10 착수 보류 조건부). 파일이 겹치지 않는 4개 그룹으로 병렬 진행, 전부
로컬에서 `git log`/`tsc`/전체 Vitest/`next build`로 독립 재검증 완료.

1. **정산 과지급 버그 — 실제로 재현되고 있었다, 수정 완료.** 선생님 지각·장애로
   `scheduled_duration_minutes`가 늘어난 뒤, 그 미이행분이 다른 세션에 보충으로
   이관되면 원 세션과 보충 세션 양쪽에서 전액이 각각 지급돼 이중 지급이 되고
   있었다. `payable_minutes = scheduled_duration_minutes - late_start_minutes`로
   수정(학생 귀책은 영향 없음, `late_start_minutes`가 애초에 null). 귀책별
   원수업+당일연장+향후보충 합산 테스트 5개 시나리오 추가 — 전부 확정 기준
   그대로 통과 확인(학생귀책 120분 고정, 선생님귀책 원110+보충10=120, 당일
   연장으로 120 다 채우면 보충 없이 120, 상한 초과 방지, 보충 연결만 하고
   완료판정 전이면 미반영). 부수 발견: 보충시간이 체험(trial) 예약에도 적용
   가능했던 정책 위반도 함께 수정(정규수업 전용으로 제한).
2. **보충시간 정책(30일 만료/발생 선생님 전용/승계 안 함) 재검증** — 위
   trial-제한 건 외에는 이미 정확히 일치 확인, 변경 없음.
3. **재판정 자동 대사(reconciliation) 작업** — `session_judgment_reconciliation_tasks`
   신규(재판정 전/후 entitlement 차이 자동 계산·적재), 관리자가
   `BookingReconciliationPanel.tsx`에서 확인 후 한 번에 반영(멱등, 중복 반영
   차단), 기지급 `payout_items`는 금액을 즉시 덮어쓰지 않고
   `superseded_by_reconciliation_task_id`로 R10 역분개 대상 표시만. 원래 판정·
   수정 판정·수정자·사유·시각 감사 이력 보존.
4. **학생 프로필 정책 확정 반영** — 생년월일 최초 1회 자가입력(기존 유지) +
   **관리자 "확인 완료" 버튼**(확인자·시각만 기록, 복잡한 신원확인 절차 없음) 신설,
   **체험수업권 자동 지급 시점에 관리자 확인 게이트 추가**(미확인 학생은 체험수업권
   자체가 지급 안 됨). SAT 미입력은 **null**로 저장(기존 0인 행은 실제 0점인지
   미입력인지 구분 불가하므로 오픈 전 상태를 전제로 임의 변환하지 않고 그대로
   보존, 앞으로의 입력만 null/0 구분). GPA는 척도(`gpa_scale`: 4.0/4.3/4.5/5.0)
   함께 저장.
5. **체험 리뷰 카테고리 5개 — 현행 유지 확정.** 변경 없음, 스냅샷·버전관리·
   데이터 이관 없음(운영 이력이 없어 불필요) — 더 이상 결정 필요 항목 아님.
6. **학생 이메일/초대 운영 누락 보완** — 기본 흐름(prospect 이메일=보호자 계정,
   학생 이메일 필수+비밀번호 설정 초대로 검증)은 재설계 없이 그대로, 운영
   누락만 보완: 상담 칸반 온보딩 폼에서 필수값 비었거나 이메일 형식 틀리면
   발송 버튼 비활성화 + 서버에서도 재검증, 발송 실패는 이미 `notice_delivery_status`
   로 기록되고 있었으나 관리자 화면에 노출이 안 돼 있던 것을 카드 상세에 실패
   배너로 노출, 재발송 멱등성(중복 계정 생성 안 함)은 이미 구현돼 있었음을
   확인만.
7. **계정 병합 — `session_late_extensions` 조사 결과: 이미 안전했다.** 이 테이블은
   `sessions`/`makeup_obligations`를 통한 간접 참조만 갖고 있고 그 상위 테이블의
   소유권 컬럼은 `merge_accounts()`가 이미 갱신한다 — psql 트랜잭션으로 실제
   병합 시나리오를 만들어 검증 완료(간접 참조라 자동 반영됨). `actor_profile_id`
   (그 연장을 실제로 합의한 사람)는 역사적 행위자 정보라 병합해도 원본 유지가
   맞다는 기존 원칙과 일치 — **코드 변경 없음, 조사만으로 결론.**
8. **문서 정합성** — 이 절과 마스터 로드맵 R7(체크박스 전체 [x] 전환)·R8(세션뷰
   cutover 포함 명시)·R10(선생님 지급뿐 아니라 구매·환불·차지백·대사·역분개
   전부 포함 명시) 섹션, `docs/2026-09-05-m4-m5-status-for-planner.md` 갱신
   완료 — M4는 로컬 외에 Vercel Preview·Google Sandbox·DocuSign Sandbox·Stripe
   TEST UAT까지 수행됐다는 사실과 M5(R7)는 로컬 DB·테스트로만 검증됐다는 사실을
   구분 표기, 결정 완료 항목은 결정 필요에서 제거.
   **Vercel `VERCEL_AUTOMATION_BYPASS_SECRET`/임시 Stripe Preview 웹훅 잔존 여부는
   이번 세션에서 확인 불가** — 이 로컬 세션에 Vercel/Stripe CLI나 대시보드
   접근 권한이 없다(둘 다 `command not found`). 2026-09-02 시점 기록(위 R4 절)
   상으로는 Stripe 계정에 UAT용 임시 Preview 웹훅 2개가 있었으나, 지금 시점
   실제 존재 여부는 대시보드 로그인이 가능한 사람이 직접 확인해야 한다.
- **검증**: `supabase db reset --local`(마이그레이션 11개 클린 적용), 전체
  Vitest 163개 파일·1052건 통과, `tsc --noEmit` 클린, `next build` 클린(exit 0),
  작업트리는 문서 파일 1개(`docs/2026-09-05-m4-m5-status-for-planner.md`) 외
  전부 커밋됨.
- **남은 blocker**: 없음(이번 라운드 범위 내). 기존 정식 오픈 전 blocker(환불
  산식 관할별 법률 검토, 회사 전자승인 법률 적합성, Production Stripe 웹훅
  미등록 등)는 그대로 유지.
- 로컬 git commit까지만, push 없음. 전체 커밋(순서대로): `9255b37`(보충시간
  정책 확정 이전 커밋, 참고)→`5beeebc`→`fe87008`→`8806815`→`52b998a`→`c861a48`→
  `e61f79b`→`c539400`.

## M4·M5 2차(최종) 검수 보완 라운드 — 완료(2026-09-06, 로컬 DB·테스트 기준)

기획자 "조건부 승인" 회신에 따른 7개 최종 blocker 보완. 아래는 실제 검증
완료 상태이며, 이전 라운드처럼 결정 완료 정책은 다시 질문하지 않았다(보충시간
30일·귀책 선생님 전용·승계 불가, 생년월일 학생 최초입력+관리자 확인, 리뷰
카테고리 5개 유지 — 전부 변경 없음).

1. **`teacher_partial_interruption` 정식 구현** — 선생님 귀책 부분중단은
   실제 제공 시간만큼만 지급(1장 소진), 부족분은 `reason='teacher_partial_interruption'`
   보충시간 의무로 생성. 90분 미만 제공 시 QC 경고 자동 발생. 지각 처리
   (`resolve_teacher_lateness`)와 상호 배타적(한쪽이 적용되면 다른 쪽은
   세션 상태 가드로 재적용 불가). 80/120→80분 지급+40분 보충, 110/120→110분
   지급+10분 보충 예시 그대로 통합테스트로 확인.
2. **지각분/`payable_minutes` 음수·오버플로우 차단** — DB
   `sessions_payable_minutes_non_negative` CHECK 제약 + 서버 액션에서
   지각분이 예정 시간을 초과하면 거부하는 이중 검증.
3. **재판정 대사 작업 이중/지연 반영 차단** — 같은 세션에 새 재판정이 생기면
   기존 pending 작업은 `superseded`로 전환(삭제 아님). 반영 시점에 세션의
   실제 `final_status`/`payable_minutes`가 작업 생성 시점 기록과 다르면
   반영을 거부하고 `needs_review`로 전환.
4. **`student_cancelled` 재판정 자동 판정** — 취소 기록이 있으면 24시간
   규칙으로 소진/해제 자동 계산(`expected_entitlement_disposition_for_student_cancelled`).
   취소 기록이 없으면 관리자가 `set_reconciliation_task_student_cancelled_disposition()`로
   소진/해제 + 사유를 직접 선택해야 하며, 선택 전에는 해당 작업을 반영할 수
   없다(DB 레벨 강제). 관리자 화면에 선택 폼 추가.
5. **학생 계정 비밀번호 설정 초대 실패 처리** — 초대 링크 생성/발송 성공·실패를
   `trial_onboarding_links`에 기록, 관리자 화면에 실패+오류 노출, 재발송은
   기존 Auth 계정을 그대로 쓰고 중복 계정을 만들지 않음(멱등), 학생이 이미
   비밀번호+이메일 확인을 마쳤으면 재발송 차단/완료 표시.
6. **프로필 정합성 최종화** — GPA 있으면 척도 필수, GPA는 척도를 초과할 수
   없음, GPA 없으면 척도도 null이어야 함, SAT 미입력 시 null·유효 범위(400~1600)
   강제 — UI+서버 액션+DB CHECK 3중 검증 전부 확인.
7. **검증**: `supabase db reset --local`(마이그레이션 전부 클린 적용, item 4의
   `20261123000000_m5c_student_cancelled_reconciliation.sql` 포함), 전체 Vitest
   166개 파일·1105건 통과, `tsc --noEmit` 클린, `next build` 클린, 작업트리
   클린(전부 커밋).
- **남은 blocker**: 이번 라운드 범위 내 없음. 기존 정식 오픈 전 법률 검토
  blocker(환불 산식 관할별 검토, 회사 전자승인 법률 적합성 등)는 그대로 유지.
  Vercel/Stripe 임시 Preview 리소스 잔존 여부는 이전 라운드와 동일하게
  대시보드 접근 권한자 확인 필요(이 세션에서 확인 불가, 변동 없음).
- 로컬 git commit까지만, push 없음. 이번 라운드 실제 커밋(순서대로):
  `02cdb24`(item 1)→`fe3e442`(item 2)→`da394e5`(item 3)→`b4c9d78`(item 5-a)→
  `35c916f`(item 5-b)→`ca4bc1c`(item 5-c)→`41ec2a2`(item 6)→`d1311b5`(item 4).

## M4·M5 최종 코드 대조 보완(2026-09-06) — 완료, 정식 종료

2차 라운드 이후 최종 코드 대조에서 발견된 정산·수업권 무결성 잔여 4건을 전부
반영했다(`65b3d3a`, additive migration `20261124000000_m5c_final_reconciliation_integrity_gaps.sql`).
기존 함수·마이그레이션 재작성 없음.

1. `resolve_session_reconciliation_task()` — 반영 직전 세션 상태(final_status/
   payable_minutes)뿐 아니라 해당 예약의 실제 현재 entitlement disposition,
   작업 생성 이후 같은 grant에 적용된 다른 adjust 존재 여부까지 재확인 —
   전제가 달라졌으면 needs_review로 전환하고 저장된 조정량을 적용하지 않는다.
2. `set_reconciliation_task_student_cancelled_disposition()` — hold 금액 조회를
   grant_id 전체가 아니라 이 작업이 속한 세션의 reservation_id로 한정(같은
   grant에 예약이 여러 건인 경우 다른 예약의 hold와 섞이는 문제 해소).
3. `resolve_teacher_lateness()` — 같은 세션에 이미 지각 처리가 적용됐으면
   재호출(중복 처리)을 차단(세션당 1회만 허용 — 누적 지각분이 원 수업시간을
   초과하는 상황 자체가 생기지 않음).
4. GPA 음수 차단 — 20261106 마이그레이션이 `students_gpa_range`를
   `students_gpa_requires_scale`/`students_gpa_within_scale`로 대체하며
   빠뜨린 `gpa>=0` 검증 회귀를 UI·서버 액션·DB 함수·DB CHECK
   (`students_gpa_non_negative`) 4곳 전부에 복구.
- **검증**: `supabase db reset --local`(전체 마이그레이션 클린 적용, 위 4건
  포함), 전체 Vitest 166개 파일·1112건 통과(재현 확인을 위해 2회 연속 클린
  전체 실행), `tsc --noEmit` 클린, `next build` 클린, 작업트리 클린(전부
  커밋). 전체 재실행 중 `trial-entitlement-and-cancellation.integration.test.ts`
  1건이 한 차례 `teacher_slot_not_open`으로 실패했으나 파일 자체 주석에
  기록된 기존 알려진 결함(공유 선생님 `dddddddd-...-001`을 다른 파일과 함께
  쓸 때 vitest 병렬 워커 간 가용시간 규칙 삭제 레이스)이며, 단독 재실행·
  재현 실행 둘 다 정상 통과해 이번 4건 수정과 무관함을 확인했다 — 별도 조치
  없음(기존에도 알려져 있던 파일 간 레이스, 회귀 아님).
- **남은 blocker**: 이번 최종 대조 범위 내 없음. M4·M5(R7) 전체가 이번
  라운드로 로컬 검증 기준 정식 종료된다. 기존 정식 오픈 전 법률 검토
  blocker(환불 산식 관할별 검토, 회사 전자승인 법률 적합성 등)는 그대로
  유지.
- 로컬 git commit까지만, push 없음. 이번 라운드 실제 커밋: `65b3d3a`.

## PR #1 최종 병합 전 정리(2026-09-06) — main 병합/Production 배포는 여전히 보류

`preview/m4-integration-verification` → `main` PR(officialalton/alton#1)이 병합
준비 완료 상태로 승인됐으나, **`main` 병합 시 Production 자동 배포가 발생하므로
(Production Branch = `main`) 이 세션에서는 병합하지 않고 브랜치·Preview를 그대로
보존한다.**

- 시각 의존 테스트 수정(`ce88bce`): `session-late-and-disruption.integration.test.ts`의
  예약 시각을 실행 시점 실제 시계 시각(저녁 늦게 테스트 시 자정을 넘겨
  `teacher_slot_not_open` 유발)에서 분리, 17:00 UTC 고정. 전체 Vitest
  1113/1113 연속 2회 통과 확인.
- 비운영 Supabase(`worpsqwqgnspddnrtnvq`)에 누락돼 있던 마이그레이션
  **총 19개**(1차 12개 반영 후 SAT 정합성 제약 위반으로 중단·보완, 이후 나머지
  7개 반영) 전부 적용 완료, `migration list --linked` 115/115 local=remote
  일치 확인.
- Preview(`alton-ojvuncpom-alton7.vercel.app`)에서 비운영 DB에만 이메일 발송
  없는 임시 UAT 계정 4개(관리자·보호자·학생·선생님)를 생성해 역할별 로그인 후
  첫 화면까지 크래시·데이터 조회 오류 없이 렌더됨을 확인(Google/DocuSign/Stripe
  실호출, 계약·결제·예약 생성 전혀 없음).
- **임시 계정 정리**: 관리자·보호자·학생 계정은 완전 삭제 확인(0건 잔존).
  선생님 계정(`id: a01292a2-75a8-43c9-b49f-1948e2d5222f`, 원래 이메일
  `uat-smoke-teacher@nonprod.invalid`, 처리 후 `uat-smoke-teacher-decommissioned-8673f5ef@nonprod.invalid`)은
  `teacher_rate_history`(정산 감사 이력, append-only) 참조 때문에 완전 삭제가
  불가능해 **Supabase 지원 방식으로 명시적 비활성화** 처리:
  `auth.users.banned_until = 'infinity'` 설정 + `auth.sessions`/`auth.refresh_tokens`
  삭제(기존 세션 1건 폐기 확인, 이후 0건)로 재로그인을 완전 차단했다.
  `teachers` 역할 테이블 행은 삭제했으나 `teacher_rate_history` 행 1건과
  `profiles` 행 1건은 감사 이력 보존을 위해 의도적으로 남겨뒀다(삭제·트리거
  우회 시도 없음, `teacher_rate_history`의 금액·통화·teacher_id는 그대로
  보존됨을 재확인). 실제 잘못된 비밀번호로 재로그인을 시도해 "이메일 또는
  비밀번호가 올바르지 않습니다"로 거부됨을 확인했다.
- 임시 비밀번호는 어떤 파일·커밋·PR·문서에도 남기지 않았다(생성·즉시 무효화만
  DB 내부에서 수행).

## 2026-09-06 추가 실측 수정 — matchbox512@snu.ac.kr 상담건(온보딩 재발급/재발송 실패)

- **(a) redeem 실패 근본 원인(psql 직접 확인, non-prod)**: `guardianEmail.trim()`
  누락 수정(`d811747`) 이후에도 저장된 `guardian_email`은 이미 깨끗했다(공백
  없음). 실제 원인은 별개 — 계정 병합(`app/admin/merge-actions.ts`
  `anonymizeMergedAccount()`)이 `admin.auth.admin.deleteUser()`로 원본 Auth
  계정을 지우면, `auth.users.email`은 GoTrue가 `deleted+<uuid>@removed.invalid`로
  스크럽하지만 **`auth.identities`는 정리되지 않고 예전 이메일(`matchbox512@snu.ac.kr`,
  `user_id=9d31a021-...`)이 좀비로 남는다**. `find_auth_user_id_by_email()`은
  `auth.users`만 봐서 "신규 보호자"로 오판하지만, 그 다음 `admin.auth.admin.
  createUser()`가 GoTrue의 (provider, email) 제약에 걸려 항상 실패 —
  "보호자 계정 생성에 실패했습니다"가 링크를 몇 번 재발급해도 재현됐다.
  학생 이메일(`matchbox512@gmail.com`, `user_id=aeeeb8fd-...`)도 동일하게
  좀비 identities로 남아있었다.
- **(a) 수정**: `supabase/migrations/20261210000000_m4_cleanup_orphaned_auth_identities.sql`
  — `cleanup_orphaned_auth_identities(p_email)` 함수 추가(`auth.users`와
  더 이상 이메일이 일치하지 않는 좀비 `auth.identities` 행만 삭제). 신규
  계정 생성 직전(`lib/trial-onboarding-finalize.ts`의 보호자·학생 각각,
  `app/admin/trial-onboarding-actions.ts`의 학생 재시도 경로)에 항상 먼저
  호출해 이 클래스의 실패를 원천 차단.
- **(b) "중복 발행" 원인**: 버그가 아니라 의도된 방어(이미 발송 완료된 링크는
  `already_sent`로 재발송 차단) — 하지만 (a) 때문에 계속 실패하는 경우
  관리자가 이를 우회할 방법이 없었다. `sendTrialOnboardingNoticeAction`에
  `forceReissue` 옵션 추가 + 신규 액션 `reissueTrialOnboardingLinkAction`
  (아직 redeem되지 않은 링크만 대상) + `app/admin/TrialOnboardingLinkProgress.tsx`에
  "링크 폐기하고 재발급" 버튼 연결.
- **실제 non-prod 데이터 복구**: `auth.identities`의 좀비 행 2건(guardian
  `matchbox512@snu.ac.kr`, student `matchbox512@gmail.com`)을
  `cleanup_orphaned_auth_identities()`로 실제 삭제 완료(삭제 전/후 SELECT로
  확인) — 이 상담건(`consultation_id=510a64a7-01ef-438c-a8fd-1fb4efcf8a29`,
  링크 `9a597dfd-cbbe-493a-a113-918af0147eb1`, 아직 미redeem 상태로 남아있던
  발송 완료 링크)은 이제 정상적으로 redeem 가능한 상태.
- 재현 테스트: `supabase/cleanup-orphaned-auth-identities.integration.test.ts`
  (좀비 identities 시뮬레이션 → 정리 전 확인 → `cleanup_orphaned_auth_identities()`
  후 같은 이메일로 재생성 가능 확인 → 정상 계정은 건드리지 않음 확인, 3건 통과).
- 마이그레이션 `20261210000000`을 non-prod(`worpsqwqgnspddnrtnvq`)에 반영,
  `migration list --linked`로 local=remote 확인.

## 2026-09-06 추가 실측 수정 — 시간대 설정 모달 드롭다운 초기 선택값 재수정

- 제품 오너가 Preview 스크린샷으로 재지적: `app/components/TimezoneSettingsModal.tsx`의
  "내 개인 시간대" 드롭다운이 개인 시간대 미설정 상태에서 여전히 추상적인
  "가족 기본값 사용" 옵션이 선택된 채로 보였다(직전 라운드에서 "이미 실제
  선택값을 보여주고 있다"고 보고했으나 실제로는 미수정 — `personal` state가
  `""`(sentinel)로 남아있어 `<option value="">가족 기본값 사용</option>`이
  그대로 selected 됐음을 코드로 재확인).
- **수정**: `personal` state를 항상 실제 IANA 시간대 값으로만 채우도록 변경
  (초기값 `s.profileTimezone ?? resolvedHousehold`). 드롭다운 옵션 목록에서
  "가족 기본값 사용" 항목 자체를 제거 — `TIMEZONE_OPTIONS`만 렌더링. 별도
  boolean state `hasOverride`(개인 시간대를 명시적으로 고정했는지)를 도입해
  저장 로직을 분리: `hasOverride`가 true면 `personal` 값을 저장, false면
  기존처럼 `null`을 저장해 가족 기본값 변경을 계속 따라가도록 유지. 드롭다운을
  직접 바꾸면 자동으로 `hasOverride=true`, 별도의 명시적 "개인 설정 해제
  (가족 기본값 따르기)" 버튼(hasOverride일 때만 노출)을 눌러야만 다시 가족
  기본값을 따르는 상태로 되돌아간다.
- 검증: `supabase db reset --local` 성공, `npx tsc --noEmit` 에러 0건,
  `npx next build` 성공. `npx vitest run` 185/186 파일·1242/1243건 통과 —
  유일한 실패(`lib/timezone-persistence.integration.test.ts`)는 전체 스위트
  병렬 실행 시의 로컬 DB 공유 상태 문제로, 해당 파일만 단독 실행하면 5/5
  통과함을 확인(이번 변경과 무관, 기존에도 존재하던 격리 이슈).

## 2026-09-07 — 상담/복수자녀 온보딩 라이브 UAT 라운드 완료

M4 완료 이후, 제품 오너가 Preview 배포본을 직접 사용하며 실측 UAT를 진행,
발견된 버그·UX 이슈를 즉시 재현·수정하는 라운드를 진행했다(복수 자녀
온보딩, 지인/추천 직접계정생성, 체험 생략→정규 등록 플로우, 상담 동의
확인 메일 자동발송, 온보딩 링크 전체취소/재발급, 상담·가용시간 캘린더 UI
정리, 선생님/학생 포털 탭 통합, 정규 계약 자동발송, 성능 병렬화 1라운드
등). 전체 상세는 `docs/2026-09-07-planner-status-summary.md` 참고(기획자
검수용, 이 라운드 마무리 시점 최신). 이 라운드로 R7 이후 잔여 UX 부채는
대부분 해소됐다고 판단 — 다음 착수는 아래 R8∥R10.

## 2026-09-07(라운드 3-0) UAT 기준선 고정 — 완료(신규 기능·정책·외부 호출 없음)

R8/R10 착수 전, 직전 UAT 라운드(위 절)에서 빠르게 확장된 9개 영역을 코드
기준으로 재검증하고 문서에 고정했다. 이 라운드는 신규 기능·정책·외부 호출을
추가하지 않았고, 실제로 발견된 것은 모두 이미 앞선 커밋에서 정리돼 있었다
(추가 코드 변경 없음 — 문서 고정 + 검증만 수행).

**중복 경로 점검 결과(전부 이미 처리됨, 재확인만)**
- 레거시 "학부모 초대"(`inviteParent`, `account_invites`): `app/admin/users-actions.ts`에서 이미 삭제 완료(주석에만 흔적 남음). 지인/추천 경로(`direct-account-actions.ts`)가 유일한 경로.
- 중복 "수업권" 탭 이름 충돌: 레거시 `students.credit_balance` 계열(`app/parent/CreditsTab.tsx`, `app/parent/credits-data.ts`, `app/student/credits-data.ts`)과 신규 entitlement 계열이 공존하나, 탭 이름 충돌은 커밋 `90c232b`로 해소됨. **단, `credit_balance` 컬럼/화면 자체는 아직 코드에 남아 있다** — Stripe 웹훅(`app/api/webhooks/stripe/route.ts`)과 관리자 사용자 화면(`app/admin/users-data.ts`/`users-actions.ts`)이 여전히 참조 중이라 지금 삭제하면 결제/관리자 조회가 깨진다. 안전하게 제거하려면 이 컬럼을 참조하는 4개 파일을 entitlement 기준으로 먼저 마이그레이션해야 하므로 **R9(3-2, 레거시 연결 정리) 항목으로 이관**한다 — 지금 삭제하지 않음.
- `legacy_sessions` 기반 화면(학생/선생님 포털 다수) vs 신규 예약 기반 `sessions`: 두 경로가 여전히 병존한다. 이는 계획서 3-2(R9 "레거시 연결 정리")에서 전수 대조 후 이관하도록 이미 명시돼 있어 **이번 라운드에서 손대지 않음**(범위 밖 — R9 선행 조건).
- 레거시 디버그 UI(`ConsultationSchedulingPanel.tsx`): 삭제 대신 `<details>`로 접어 숨김 처리 완료(커밋 `194ad81`), 실사용 경로가 아님을 확인.

**자동 계약 발송 / 상담 동의 메일 — 트리거·재시도·멱등성·차단 확인**
- 발송 트리거: 보호자가 "정규 진행 희망" 확인 시(`app/parent/trial-conversion-actions.ts`), 자동 계약 발송이 걸린다. 상담 동의 메일은 상담이 최초 확정될 때 무조건 발송(`app/admin/consultation-kanban-actions.ts`의 `sendConsentRequestEmailAction`/자동 트리거 경로), 관리자 수동 조작과 무관.
- 중복 클릭/재시도 방지(`lib/regular-contract-send.ts` 39~62행): 기존 활성 계약 버전에 `docusign_envelope_id`가 이미 있으면 `already_sent`를 반환하고 새 envelope를 만들지 않음 — 이것이 멱등성의 핵심 지점. 회사 전자승인(`company_signed_at`)도 이미 있으면 재승인하지 않음.
- 웹훅 멱등성: `app/api/webhooks/docusign/route.ts` — `external_event_receipts(provider, event_id)` unique 제약으로 동일 이벤트 재처리 차단, 이미 처리된 이벤트는 `{ok:true, skipped:"already processed"}` 반환.
- 실패 시 관리자 노출: `sendRegularContractForSignature()`가 `{status:"failed", error}`를 반환하고(커밋 `43131ff`), 관리자 화면에 실패 원인이 그대로 표시됨(이전엔 무피드백 버그였음, 이미 수정됨).
- 상담 동의 메일 회귀 테스트: `app/admin/consultation-consent-request-email.test.ts`(4건: 이미 동의 완료 시 미발송/미확인 시 발송+감사로그/발송 실패 시 failed/상담 미존재 시 failed).
- **실제 외부 발송 차단 플래그 확인(완료)**: DocuSign은 `lib/docusign.ts`의 `isDocusignRealCallsAllowed()`가 `DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS === "true"`가 아니면 무조건 throw하는 fail-closed 게이트(Calendar 동기화의 `CALENDAR_SYNC_ALLOW_REAL_CALLS`와 동일 패턴). 추가로 `assertDocusignSandboxBaseUri()`가 base URI가 sandbox(`demo.docusign.net`/`account-d`)가 아니면 즉시 차단. 이번 세션에서 로컬 `.env.local`/`.env.example`을 확인한 결과 `DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS`가 설정돼 있지 않음(unset → false 취급) — 안전한 기본 상태 확인. 이메일(SMTP)은 `lib/email.ts`가 `SMTP_HOST` 미설정 시 예외를 던져 실패 처리되는 구조이며, 로컬은 `SMTP_HOST=127.0.0.1`(로컬 mailhog류)로 외부로 나가지 않음. Preview/Production 환경변수 값 자체(Vercel 프로젝트 설정)는 이번 세션에서 CLI 접근 권한이 없어 **직접 조회하지 못함** — 코드상 게이트는 fail-closed임을 확인했으나 Vercel Preview/Production 프로젝트 환경변수에 실제로 `DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS=true`가 설정돼 있지 않은지는 다음 세션에서 `vercel env ls`로 재확인 필요(이 세션 환경에 `vercel` CLI 미설치).

**성능 개선 1라운드 — 측정 결과**
- 코드 변경 자체(`ae95c39` `perf(portal): 홈 페이지 순차 로더 병렬화(Promise.all) + N+1 반복문 제거`)는 쿼리 로직 불변, 실행 순서만 병렬화한 것으로 diff 확인됨(학생/보호자/선생님 포털 홈 dashboard-data 계열).
- **"before" 수치 자체는 이 세션에서 실측하지 못함** — 로컬에 실행 중인 dev 서버/Preview 배포가 없어 두 시점의 서버 응답시간을 같은 조건에서 재현측정할 수 없었고, 이전 라운드 보고에도 "전후 비교"의 실측 로그가 별도로 남아있지 않다. Git 이력상 병렬화 전 커밋(`ae95c39`의 부모 커밋)으로 되돌려 재현할 수는 있으나, 로컬 실행 인프라(Next dev 서버 기동)가 이번 세션 범위에서 시도되지 않았다. **후속 조치로 남긴다**: `git show ae95c39^:app/student/dashboard-data.ts` 등으로 병렬화 전 코드를 임시 체크아웃해 동일 시드 데이터에서 쿼리 수·응답시간을 재측정하는 스크립트를 R8/R10 착수 전에 한 번 더 돌릴 것을 권장.
- 상담 슬롯 화면(`consult` availability)의 전후 비교도 동일한 이유로 이번 세션에서는 수행하지 못함.

**전체 테스트/마이그레이션/배포 상태(이번 세션 실측)**
- `supabase db reset --local`: 성공(마이그레이션 전부 정상 적용, 최신 `20261217000000`까지).
- `npx tsc --noEmit`: 0 에러.
- `npx vitest run`(전체): **198개 파일 / 1302개 테스트 전부 통과**(이번 실행에서는 이전에 보고된 "공유 DB 상태 의존 간헐 실패"가 재현되지 않음 — `lib/booking/trial-entitlement-and-cancellation.integration.test.ts` 등 known flaky 파일도 이번엔 통과). 간헐 실패는 병렬 실행 시 공유 DB 상태 경합이 원인으로 추정되며, 재현 조건은 `npx vitest run`(전체 병렬)에서만 가끔 나타나고 단독 실행(`npx vitest run <파일>`) 또는 `db reset` 직후 재실행 시 항상 통과함이 과거 라운드부터 일관되게 확인됨(이번 라운드는 우연히 재현되지 않았을 뿐, 근본 원인 자체를 고치지는 않음 — 공유 DB 기반 통합 테스트 병렬 실행의 구조적 한계로 별도 정리 대상).
- `npx next build`: 성공.
- non-prod migration 상태: `supabase migration list` 결과 local=remote 완전 일치(최신 `20261217000000`까지 양쪽 동일).
- Vercel Preview alias 상태: 이번 세션 환경에 `vercel` CLI가 설치돼 있지 않아 **직접 재확인하지 못함**. 직전 라운드(`docs/2026-09-07-planner-status-summary.md` §6)에서 "매 라운드마다 alias가 새 배포로 안 넘어가는 구조적 이슈가 있어 수동 재연결 절차를 고정했다"고 보고된 상태이며, 이번 라운드는 코드 변경이 없어 재배포·재연결도 수행하지 않았다(외부 변경 없음).

**이번 라운드 코드/문서 변경**: `docs/CURRENT.md`(이 절 추가)만 변경. 코드·마이그레이션·환경설정 변경 없음(순수 조사·검증·문서화 라운드).

## 2026-09-07(라운드 3-0 마무리) 성능 개선 1라운드 실측 + Vercel 상태 확인 — 완료(읽기/측정만, 코드·배포 변경 없음)

위 절에서 "이번 세션에서 실측하지 못함"으로 남겼던 두 항목을 마무리했다. 코드
변경·마이그레이션·배포·외부 쓰기 전혀 없음(순수 로컬 측정 + Vercel 읽기 전용
조회).

### 성능 baseline 실측

**조건(재현 가능)**: `supabase db reset --local`로 초기화한 시드 그대로(추가
시드 없음), 로컬 `npm run dev`(Next.js 16.3.3, Turbopack, 이미 실행 중이던
dev 서버를 그대로 사용, PID는 이 세션이 새로 띄우지 않음), 로컬 Postgres에
`pg_stat_statements` 확장(이미 설치돼 있던 확장, 세션 종료 시 별도 원복 불요 —
DB 내부 상태일 뿐 코드/설정 파일 변경 아님)을 이용해 매 측정 전
`pg_stat_statements_reset()`으로 초기화 후 1회 요청 → 통계 조회. 응답시간은
`curl -w time_total`로 3회 반복(첫 요청은 컴파일 콜드스타트 포함, 2·3회차가
안정 상태). 계정: 학부모 `minji.kim@example.com`(자녀 지훈), 학생
`jihoon@example.com`, 선생님 `seoyeon@example.com`(전부 시드 고정 계정,
비밀번호 `alton-dev-1234`), 브라우저로 로그인해 세션 쿠키 획득 후 `curl -H
"Cookie: ..."`로 재현. 상담 슬롯 화면은 랜딩(`/`, 로그인 불필요)의
`ConsultSlotPicker`이며, 이 컴포넌트는 클라이언트 마운트 시 Next.js Server
Action으로 `listOpenHomepageConsultSlots`(`list_open_consult_slots()` RPC,
`service_role`)를 호출하므로 `curl`(JS 미실행)로는 잡히지 않아 별도로 브라우저
네트워크 로그 + 동시 `pg_stat_statements`로 확인.

**"개선 후" 기준선만 기록한다 — 전후 비교는 만들지 않았다.** 이유: 병렬화
커밋(`ae95c39`)의 부모 커밋으로 되돌려 재측정하려면 워킹트리를 그 시점으로
체크아웃해야 하는데, 현재 브랜치(`preview/m4-integration-verification`)에는
이 세션 시작 시점에 이미 사용자 소유의 미커밋 변경(`CLAUDE.md`,
`docs/CURRENT.md`)이 있었다 — `git checkout ae95c39^`류 이동은 그 미커밋 변경과
충돌하거나 stash가 필요해 "치우기 애매하고 위험 부담 대비 이득이 적다"는
지시 기준에 해당한다고 판단해 시도하지 않았다. 따라서 아래는 전부 **개선 후
(현재 코드) 기준선**이다.

| 화면 | 쿼리 수(서버→PostgREST 왕복 수 = 실질 쿼리 수, `service_role`/`authenticated`/`anon` 합산) | 서버 응답시간(콜드/웜, `curl total_time`) | 클라이언트 추가 요청 |
|---|---|---|---|
| 상담 슬롯 화면(랜딩 `/`) | 2 (컴포넌트 마운트 시 `list_open_consult_slots()` 1회 호출 × 서버 액션 라운드트립 2회 — StrictMode 개발모드 이중 호출 가능성 있음, prod에서는 1회로 줄 수 있음) | SSR 셸 자체는 22~205ms(DB 쿼리 없음, 정적) — 실제 슬롯 데이터는 이후 클라이언트 fetch로 도착, 그 응답시간은 이 세션 도구로 개별 계측 못함(네트워크 탭 타이밍 API 미제공, 요청 존재 여부만 확인) | Server Action POST 2건(랜딩 최초 로드 시) — 정적 자산(JS 청크·폰트) 제외 |
| 학부모 포털 홈(`/parent`, 지훈 가정) | 43 (PostgREST 왕복 43회 = 실행된 쿼리 43개, `set_config` 하우스키핑 제외) | 555 → 279 → 247ms(3회) | 0(전체 SSR, 클라이언트 재요청 없음 확인 — HTML에 데이터 인라인) |
| 학생 포털 홈(`/student`, 지훈) | 41 | 409 → 268 → 236ms | 0(SSR) |
| 선생님 포털 홈(`/teacher`, 박서연) | 36 | 313 → 221 → 217ms | 0(SSR) |

측정 방법 스크립트(`/tmp/measure2.sh`, 세션 종료 시 삭제 — 저장소 밖 임시
파일이라 커밋 대상 아님): 매 페이지마다 `pg_stat_statements_reset()` →
`curl` 1회 → `pg_stat_statements`에서 `userid::regrole::text in
('authenticated','anon','service_role')` 필터로 이번 요청분만 집계.

**해석**: `ae95c39` 커밋 diff 자체(이전 라운드에 이미 확인)는 쿼리 로직을
바꾸지 않고 실행 순서만 `Promise.all`로 병렬화했으므로, 병렬화 전 코드도
**쿼리 수(43/41/36)는 동일했을 것**이고 달라지는 것은 응답시간뿐이다 —
따라서 위 쿼리 수 자체는 사실상 "before=after" 상수로 봐도 무방하다(이 점은
diff로 확인 가능하지만 실행 재현은 아니므로 "실측"이 아니라 "정적 분석
기반 추정"임을 명시한다). 43/41회는 dev 모드치고 상당히 높은 왕복 수이며,
`Promise.all`로 클라이언트→서버 왕복이 줄어드는 것이 아니라 서버→
PostgREST 왕복이 순차 대기에서 동시 대기로 바뀌는 것뿐이므로, 왕복 횟수
자체(43/41/36)를 줄이려면 조인/배치 쿼리로의 재작성이 별도로 필요하다 —
이는 이번 측정의 범위 밖이며 R8/R10 착수 시 참고할 개선 후보로 남긴다.

**한계(정직하게 기록)**:
1. dev 서버(Turbopack, HMR) 응답시간은 production build/배포 환경과 다르다
   — 절대값이 아니라 상대적 참고치로만 쓸 것.
2. 상담 슬롯 화면의 실제 데이터 응답시간(서버 액션 자체의 ms)은 이 세션의
   도구로 개별 요청 타이밍을 추출하지 못해 기록하지 못했다(요청이 발생한다는
   사실과 횟수만 확인).
3. before/after 비교 실측은 수행하지 않았다(위 사유). 필요하면 다음 세션에서
   깨끗한 워킹트리 상태에서 `git worktree add`로 `ae95c39^`를 별도 디렉터리에
   체크아웃해 같은 스크립트로 재측정할 것을 권장(현재 워킹트리를 건드리지
   않는 방법이라 더 안전함).

### Vercel Preview/Production 읽기 전용 확인

CLI: `npx vercel`(v59.11.7, `officialalton` 계정으로 이미 인증됨, 이 세션은
설치·로그인 아무것도 하지 않음). 프로젝트 `alton7/alton`. **쓰기·재배포·
alias 변경·env 값 변경 전혀 수행하지 않음.**

**Preview alias 상태**: `vercel alias ls` 기준 `alton-git-preview-m4-
integration-verification-alton7.vercel.app`는 배포 `alton-7h1jsiid8-
alton7.vercel.app`(커밋 `f55a959`)를 가리키고 있다 — 이 alias 레코드 자체는
3일 전에 마지막으로 갱신됨(직전 라운드에 기록된 "라운드마다 alias가 최신
배포로 자동으로 안 넘어가는 구조적 이슈"가 이번에도 그대로 재현). 현재 로컬
`HEAD`는 `ec56393`으로 2커밋 앞서 있다(`f55a959`→`44b9106`→`ec56393`). **단,
`git diff --stat f55a959 ec56393` 확인 결과 그 2커밋은
`docs/2026-09-07-planner-status-summary.md`·`docs/CURRENT.md` 문서만 변경했고
앱 코드·마이그레이션 변경이 전혀 없다** — 따라서 alias는 메타데이터상
최신 커밋보다 뒤처져 있지만 실제 서빙 중인 애플리케이션 동작에는 차이가
없다(기능적 staleness 없음). 브랜치의 가장 최신 배포는 `alton-43fiapgob-
alton7.vercel.app`(커밋 `44b9106`, `next dev`/`next build` 정상)이며 이
역시 alias가 가리키는 배포는 아니다. Production(`app.alton.education`)은
`main` 브랜치 배포(`alton-6630dddew-...`)를 그대로 가리키고 있고 이번
세션에서 병합·재배포를 하지 않았으므로 변동 없음.

**외부 실호출 차단 플래그 상태(값 자체가 시크릿인 것은 상태만 표기, 원문
비출력)**:

| 플래그 | Preview | Production |
|---|---|---|
| `DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS` | 설정됨(Secret 타입 — `vercel env pull`로도 실제 값이 `[SENSITIVE]`로만 나와 이 세션에서 값 자체를 확인할 방법이 없음) | **미설정**(unset → 코드 기본값 false로 fail-closed) |
| `CALENDAR_SYNC_ALLOW_REAL_CALLS`(Google Calendar/Meet/Workspace Events 공용 게이트) | 설정됨(Secret 타입, 위와 동일한 사유로 값 확인 불가) | **미설정**(fail-closed) |
| `WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS` | 미설정(fail-closed) | 설정됨, 값 `false` 확인(Config 타입이라 `vercel env pull`로 실제 값 읽음) |
| `WORKSPACE_PREFLIGHT_ALLOW_REAL_READS` | 미설정 | 설정됨, 값 `false` 확인 |
| `DRIVE_ARTIFACTS_ALLOW_REAL_WRITES` | 미설정(fail-closed) | 미설정(fail-closed) |
| Stripe(전용 "실호출 허용" 플래그 없음 — test/live는 `STRIPE_SECRET_KEY` 자체의 `sk_test_`/`sk_live_` 접두어로만 결정, `app/parent/purchase-actions.ts` 주석 확인) | `STRIPE_SECRET_KEY` 설정됨(Secret, 값 확인 불가) | `STRIPE_SECRET_KEY` 설정됨(Secret, 값 확인 불가) |
| 이메일(SMTP) | `SMTP_HOST` 등 설정됨(Secret, 값 확인 불가) | `SMTP_HOST` 등 설정됨(Secret, 값 확인 불가) |

확인 방법: `vercel env ls preview`/`vercel env ls production`으로 변수
존재 여부만 먼저 확인, `Config` 타입(암호화되지 않은 일반 값)인
`WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS`/`WORKSPACE_PREFLIGHT_ALLOW_REAL_READS`
2건만 `vercel env pull`로 실제 값(`false`)을 확인했다. `Secret` 타입으로
등록된 변수는 Vercel이 CLI에도 실제 값을 절대 내려주지 않는다(`pull` 결과에
`[SENSITIVE]` placeholder만 기록됨) — 이는 이 세션의 권한 문제가 아니라
Vercel의 Secret 타입 자체의 설계이며, 대시보드에 직접 로그인해 "reveal"
하지 않는 한 어떤 방법으로도 원문을 읽을 수 없다. 값을 읽은 즉시
`.env.preview.tmp`/`.env.production.tmp`(스크래치 디렉터리, 저장소 밖)는
삭제했고, 이 문서·다른 어떤 파일에도 시크릿 원문을 기록하지 않았다.

**결론**: Production은 4개 게이트(DocuSign/Calendar·Meet·Workspace Events/
Workspace 프로비저닝/Workspace preflight/Drive) 전부 안전 확인(미설정 또는
명시적 `false`). **Preview는 `DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS`와
`CALENDAR_SYNC_ALLOW_REAL_CALLS` 2개가 Secret 타입으로 값이 설정돼 있고
이 세션에서 그 값이 `true`인지 `false`인지 어떤 방법으로도 확인하지
못했다** — 코드 게이트 자체는 fail-closed(정확히 문자열 `"true"`가 아니면
차단)이므로 "unset"이 아닌 값이 저장돼 있다는 사실 자체가 위험 신호는
아니지만(과거 라운드에 의도적으로 `"false"` 문자열로 등록했을 가능성이
높음 — DocuSign Sandbox UAT를 이 Preview에서 이미 수행한 이력이
`docs/CURRENT.md` M4 절에 있음), **"실제로 false인지"는 대시보드 접근 권한이
있는 사람이 직접 열어서 확인해야 한다.** 아래 결정 필요 항목 참고.

**이번 절 변경 파일**: `docs/CURRENT.md`(이 절 추가)만. 코드·환경변수·
Vercel 배포·alias·DB 마이그레이션 전혀 변경 없음.

## 2026-09-07 — 3-0 마지막 결정 필요 항목 해소, 라운드 종료

위 절에서 미확정으로 남긴 `DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS` /
`CALENDAR_SYNC_ALLOW_REAL_CALLS`(둘 다 Preview, Secret 타입) 값을
Vercel 대시보드에 직접 로그인해(`vercel.com/alton7/alton/settings/
environment-variables`) 재확인했다.

- **대시보드에서도 두 값은 열람 불가로 확인됨** — Vercel의 Secret(=Sensitive)
  타입은 프로젝트 소유자가 대시보드에 직접 로그인해도 원문을 다시 열람할
  방법을 제공하지 않는다(값 입력란 자체가 "reveal" 버튼이 없고 잠금 아이콘만
  표시). 이는 이 세션·이 사람의 권한 문제가 아니라 Vercel이 Secret 타입을
  "쓰기 전용(write-only)"으로 설계했기 때문이며, 재확인해도 원문은 나오지
  않는다.
- **코드 레벨 확인으로 대체**: `lib/docusign.ts:109`와 `lib/google-
  calendar.ts:32`를 직접 읽어 두 게이트가 각각
  `process.env.DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS === "true"`,
  `process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS !== "true"`(참이면 차단)
  형태의 **정확한 문자열 `"true"` 일치만 통과시키는 fail-closed 화이트리스트**임을
  확인했다. 즉 이 값이 `unset`이든 `"false"`든 `""`든 그 외 어떤 문자열이든
  실제 외부 호출은 전부 차단되며, 오직 정확히 `"true"`라는 문자열이 저장돼
  있을 때만 위험하다. 원문을 못 읽더라도 "값이 사고로 true가 아닌 이상
  안전"이라는 코드 보장이 이미 있다.
- **정황 증거**: 이 Preview 환경에서 과거 라운드(M4 절, `docs/CURRENT.md`
  Gate C/M4 부분 참고)에 DocuSign Sandbox·Google Calendar 연동을 검증한
  이력이 있고, 그 라운드들에서 실제 외부 호출은 없었다고 이미 보고됐다.
  두 플래그가 `"true"`로 설정된 채 방치됐다면 그 라운드들에서 이미 실제
  발송·실제 이벤트가 발생했어야 하는데 그런 보고가 없다 — 정황상 `"false"`
  문자열로 등록돼 있을 가능성이 높으나, 어차피 fail-closed 코드 구조상
  "true"가 아닌 한 결과는 동일(차단)하다.
- Stripe: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`(비밀 아님, 공개 키)를
  대시보드에서 직접 열람 — Preview `pk_test_51U9YvSICtA5Uy7f...`,
  Production도 동일 접두어 `pk_test_...`로 확인. `STRIPE_SECRET_KEY`는
  Secret 타입이라 원문 확인 불가하지만, 발행 가능(publishable) 키와
  비밀(secret) 키는 Stripe 대시보드에서 항상 같은 모드(test/live) 페어로
  발급되므로 `pk_test_` 확인만으로 두 환경 모두 테스트 모드임을 사실상
  확인.
- Preview alias: 위 절에서 이미 확인한 대로 `f55a959`(HEAD보다 2커밋
  뒤지지만 그 2커밋은 문서만 변경, 기능적 차이 없음)를 그대로 가리킴 —
  변동 없음, 재확인만.

**다섯 항목 최종 상태**:

| 항목 | 상태 |
|---|---|
| `DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS` | Production 미설정(안전). Preview는 원문 확인 불가하나 코드가 정확히 `"true"`가 아니면 항상 차단 — 구조적으로 안전 |
| `CALENDAR_SYNC_ALLOW_REAL_CALLS` | 위와 동일 |
| Workspace Events·Drive·SMTP 실호출 허용 플래그 | 전용 플래그 자체가 존재하지 않음(둘 다 환경에 없음=fail-closed 기본값). SMTP 자격증명은 존재하지만 이는 발신 채널 설정일 뿐 "허용" 스위치가 아님 |
| Stripe 키 접두어 | Preview·Production 모두 `pk_test_`(발행 키), test 모드 확인 |
| Preview alias | 의도한 최신 배포(`f55a959`, HEAD와 기능적으로 동일)를 가리킴, 정상 |

**정정(2026-09-07, 같은 날 후속)**: 위 "완전 종료" 판정은 과했다. fail-closed
코드는 값이 정확히 `"true"`가 아니면 안전하다는 것만 보장하며, Vercel의
Secret(write-only) 값이 실제로 `"true"`인지 아닌지는 이 세션·대시보드
어느 쪽으로도 확인하지 못했다 — "안전할 가능성이 높다"와 "확인했다"는
다르다. 마찬가지로 `pk_test_` 확인은 Stripe **공개** 발행 키일 뿐이며,
서버가 실제로 쓰는 `STRIPE_SECRET_KEY`가 test 키라는 증명은 되지 않는다.

**정정된 결론**: **코드 기준선과 Preview 배포 확인은 완료**됐다(중복 경로
정리, 발송/웹훅 idempotency 테스트·문서화, 성능 baseline 기록, Preview
alias가 의도한 배포를 가리킴을 확인). **Vercel write-only Secret
(`DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS`, `CALENDAR_SYNC_ALLOW_REAL_CALLS`,
`STRIPE_SECRET_KEY`)의 실제 값은 외부 통합을 실제로 실행하기 전에 별도
승인된 방법으로 재확인해야 한다** — 방법은 둘 중 하나: (1) Production에
안전 확인용 서버 측 진단(값을 출력하지 않고 "정확히 true인가/test 접두어인가"만
boolean으로 반환하는 승인된 엔드포인트)을 배포해 확인하거나, (2) 해당
플래그·Stripe Secret을 알려진 안전값으로 재설정한 뒤 확인한다. 이 재확인
전까지는:
- **가능**: R8∥R10의 코드·migration·로컬 테스트·non-prod DB 작업(로컬
  env는 해당 플래그 미설정 유지).
- **금지**: 실제 Google·Drive·DocuSign·Stripe 호출, Production 검증,
  외부 통합 UAT.
- **보류**: "Production이 외부 실제 쓰기에 안전하다"는 최종 선언.

코드·마이그레이션·env·Vercel 설정 변경 전혀 없음(전부 읽기 전용 확인).
이 코드 기준선 위에서 다음 라운드부터 R8∥R10 **로컬 구현**을 병렬 착수한다.

## 잔여 R 실행계획(2026-09-05 확정) — 다음은 R8∥R10부터

M4·R7(M5-a+M5-b) + 위 검수 보완 라운드 전부 완료. **다음 착수는 R8∥R10 병렬**
(핵심 수업 공간 신뢰성 / 해당 R10 대상) — 상세 순서·범위·병렬화 근거·개발
효율화 원칙은 `docs/2026-08-29-master-roadmap-v3.md`의 "근접 실행계획" 절
M5~M10에 확정돼 있다(이 문서에 중복 작성하지 않음). 요약: `M5 R7(완료) →
M6 R8∥R10(병렬) → M7 R9 → M8 R11 → M9 R12 → M10 R13(오픈)`.

## 다음 R 착수 시 읽을 문서

1. `CLAUDE.md`
2. `docs/CURRENT.md`(이 문서)
3. `docs/2026-08-29-master-roadmap-v3.md`의 해당 R 섹션
4. 그 작업에 직접 필요한 설계 문서만 선택적으로(예: `product-architecture-v3.md`의 관련 절, 해당 Gate 문서) — 전체 실행 로그·과거 계획·prompts는 문제 해결에 필요할 때만 검색.

## R10(결제·환불·선생님 정산) 1라운드 — payout batch 상태머신, 완료(2026-09-07)

R10은 로드맵(§`2026-08-29-master-roadmap-v3.md` 835-873행)에서 요구사항 20개로
명확히 스코프됐다. 이번 라운드 전에 R4/M2/R7(M5-a~d)가 이미 그중 상당수를
구현해뒀다는 것을 먼저 확인했다(**재조사 없이 재구현하지 않기 위해**):

- **이미 완료돼 있던 항목(이번 라운드 재확인만, 코드 변경 없음)**:
  - 요구사항 1(수업권 구매·환불·차지백 대사): `refund_entitlement()`/
    `calculate_purchase_refund_minor()`(M2, 20261013000000)와 Stripe
    `charge.dispute.*` 웹훅 → `payment_disputes` 테이블(R4 후속,
    20260924000000) + 관리자 `EntitlementLedgerTab.tsx`의
    `ReconciliationSection`이 이미 대사 화면까지 구현.
  - 요구사항 2·3·4·5(미사용·미보류만 환불, 중도해지 소진분 재정산, 단건/
    패키지가·환불공식 고지, 무료/프로모션 제외): M2 2라운드(2026-09-03)가
    `purchase_has_active_future_holds()`/환불 공식/체험수업권 자동 제외로
    전부 구현.
  - 요구사항 6·7(가족 기본 통화 USD+구매별 가격 스냅샷, 원결제 통화/수단
    환불): `purchases.currency`/`unit_price_minor`/`package_price_minor`가
    이미 구매 시점 스냅샷(R4, 20260922000000)이고, Stripe 환불은 같은
    `payment_intent`로만 나가므로 통화·수단이 원결제와 항상 동일 — 별도
    구현 불필요.
  - 요구사항 8(선생님 기본 통화 KRW + 시급/통화 적용일 이력):
    `teacher_rate_history`(R1, 20260830030000)가 이미 `amount_minor`/
    `currency`/`effective_from`/`effective_until`의 겹치지 않는 이력을
    `exclude using gist` 제약으로 관리.
  - 요구사항 11·12·13·14(세션별 payout item·정산 근거, 시급×인정분÷60,
    항목 단위 소수 보존, trial/regular/makeup/adjustment 구분):
    `finalize_lesson_session()`(M5-a, 20261030000000)가 세션 완료 트랜잭션
    안에서 `payout_items`에 `hourly_rate_snapshot_minor`/`payable_minutes`/
    `amount_minor = round(rate*minutes/60.0)`를 이미 스냅샷.
- **이번 라운드에 새로 구현한 것 — 요구사항 9·15(단일통화 batch, 생성→검토→
  승인→지급→역분개)**: 위 항목들이 만들어 둔 "미배치(batch_id null) pending
  payout_item 더미"를 실제 `payout_batches`로 묶어 지급까지 끝내는 절차
  자체가 R1 스캐폴드(20260830070000, 테이블+통화단일성/paid불변 트리거만
  존재) 이후 한 번도 구현되지 않았던 것을 확인 — 이번 라운드의 실제 작업
  범위.
  - 마이그레이션: `supabase/migrations/20261218000000_r10_payout_batch_lifecycle.sql`.
    - `generate_payout_batches(period_start, period_end, teacher_id?)`:
      기간 내 미배치 pending 항목을 `sessions`→`reservations.starts_at`
      기준으로 조회해 (선생님, 통화) 단위로 묶어 `draft` batch 생성 —
      같은 선생님이라도 기간 중 `teacher_rate_history` 통화가 바뀌면
      세션별 `hourly_rate_snapshot_currency`가 이미 달라 자동으로 다른
      batch로 분리된다(요구사항 9). `batch_id is null` 조건으로 재호출해도
      중복 batch가 생기지 않는 멱등 설계.
    - `submit_payout_batch_for_review` / `approve_payout_batch` /
      `mark_payout_batch_processing` / `mark_payout_batch_paid` /
      `mark_payout_batch_failed`: `draft→reviewing→approved→processing→paid`
      상태머신, 실패 시 항목을 다시 미배치로 되돌려 재시도 가능. 승인·지급·
      실패는 신규 `payout_batch_audit_log`에 행위자·시각 기록.
    - `reverse_payout_item(item_id, reason, actor_id)`: paid 항목은 기존
      트리거(`prevent_paid_item_mutation`, R1)가 수정 자체를 막으므로,
      같은 세션·금액의 음수 `item_type='reversal'` 항목을 새 paid batch에
      추가해 순액을 0으로 맞추는 방식으로만 역분개(요구사항 15) — 회계
      감사 이력 보존.
    - 전부 `revoke execute ... from public, anon, authenticated`(M2/R4의
      `refund_entitlement()`와 동일 패턴) — admin 서버 액션의
      `createAdminClient()`(service_role)를 통해서만 호출되고, 각 서버
      액션은 `requireAdmin()`으로 로그인 세션 기반 권한을 먼저 확인해야
      한다(**이번 라운드에는 서버 액션/관리자 UI를 아직 만들지 않음** — 아래
      미완료 참고, DB 함수 레이어까지만 완료).
  - **검증**: `lib/booking/payout-batch-lifecycle.integration.test.ts`(신규,
    UAT 실행 ID `r10-batch-uat-2026-09-07`) — `confirm_lesson_booking()`→
    `finalize_lesson_session()`로 실제 payout_item을 만든 뒤 (1) 배치 생성
    멱등성, (2) draft→approved→paid 전이와 audit_log 기록, (3) paid 항목
    직접 UPDATE 거부(트리거)와 `reverse_payout_item()`의 음수 역분개까지
    로컬 Postgres에 psql로 직접 검증, 2/2 통과. `tsc --noEmit` 클린,
    `supabase db reset --local` 확인(R8 병렬 라운드가 같은 세션에 추가한
    `20261219000000_r8_material_version_lock.sql`/
    `20261220000000_r8_session_drive_provisioning_queue.sql` 이후에도 정상
    적용). 전체 Vitest는 별도로 진행 중(회귀 없으면 이 절에 결과 추가 예정,
    없으면 다음 라운드 시작 전에 먼저 확인).
  - UAT 정리: 이 테스트가 만드는 profiles/auth.users/entitlement_ledger/
    payout_items/payout_batches는 전부 INSERT-only이거나 FK로 참조돼 개별
    삭제가 불가능하다(기존 통합 테스트 관례와 동일) — `teacher_availability_rules`만
    `afterAll`에서 정리, 나머지는 다음 `supabase db reset --local`로 정리됨을
    전제로 한다(운영 데이터 없는 현재 단계이므로 위험 없음).
- **미완료(다음 라운드로 이월, 우선순위 순)**:
  1. batch 생성/승인/지급을 실제로 누르는 관리자 서버 액션·UI(현재 R1
     시절의 완전히 별개인 legacy `teacher_payouts`/`PayoutsTab.tsx`
     흐름만 화면에 존재 — `legacy_sessions`/`hourly_rate_krw` 플랫 컬럼
     기반이라 이번에 만든 v3 `payout_items`/`payout_batches`와 무관하다.
     다음 라운드에서 이 legacy 화면을 v3 배치 흐름으로 교체하거나 병행
     여부를 먼저 정해야 함 — **결정 필요**).
  2. 선생님 정산 상세 조회 화면 + 이의제기(요구사항 17) — 미착수.
  3. 계좌 정보(요구사항 18: 변경 이력·민감정보 보호) — `bank_account`류
     테이블 자체가 아직 없음, 미착수.
  4. USD 보고 통화 + 리포트 전용 FX snapshot(요구사항 10), 매출/선생님
     비용/매출총이익 리포트(요구사항 19) — 미착수.
  5. 월말 마감 일정(3영업일 명세/5영업일 이의/10영업일 지급, 요구사항 16)
     — `generate_payout_batches()`는 언제든 수동 호출 가능한 함수일 뿐,
     이 마감 일정을 강제하는 스케줄/영업일 계산 로직은 미착수.
- **결정 필요**: 위 미완료 1번 — legacy `teacher_payouts` 플랫 정산 화면을
  이번에 만든 v3 `payout_items`/`payout_batches` 상태머신으로 교체할지,
  당분간 병행할지(과거 실제 지급 이력이 legacy 테이블에 있다면 마이그레이션
  범위가 커짐 — 확인 필요).
- **법률 검토 blocker(이번 라운드가 새로 발견한 것이 아니라 로드맵에 이미
  명시된 것을 재확인만 함, 미해결 그대로 이월)**: 로드맵 R10 섹션 마지막
  항목의 (a) 환불 산식(7일 이내 미사용 전액환불, 그 외
  `실제결제액 − 소진회차×구매당시 할인전 단건정상가`)에 대한 판매지역별
  (미국·캘리포니아, 한국 등) 소비자법 검토·법률 문구 확정, (b) "회사
  전자승인"(DocuSign 전자서명이 아닌 인증된 관리자의 승인 기록 삽입) 방식의
  계약 체결 수단으로서의 법률 적합성 검토 — **둘 다 정식 오픈 전 blocker로
  유지, 이번 라운드에서 해소하지 않았고 산식/데이터 모델 자체는 이미 구현돼
  있어 구현이 이 검토를 막지도 않는다**(로드맵 원문과 동일한 입장).
- **외부 변경**: 0건. Stripe/Google/이메일/원격 DB 전부 미접근, 로컬
  `.env`의 실호출 플래그도 건드리지 않음. `git push` 없음, main 병합 없음.

## 2026-09-07 — R8 병렬 착수 1/N: 세션뷰 cutover connection(v3 sessions 연결) + material_version_id 불변식

R8("핵심 수업 공간 신뢰성") 체크리스트 중 최우선 항목만 이번 라운드에서
완료했다. R10(정산)과 같은 세션에서 병렬로 진행 중이며, `supabase/migrations/`
에 R10 쪽 `20261218000000_r10_payout_batch_lifecycle.sql`과 R8 Drive 큐 쪽
`20261220000000_r8_session_drive_provisioning_queue.sql`(다른 병렬 작업,
이 절 작성자는 관여하지 않음)이 같은 배치에 섞여 있다 — 셋 다 각자 독립
additive migration이라 순서 무관하게 함께 적용 확인됨.

### 완료

1. **cutover connection**(로드맵 R8 (1)): `/session/[id]`(`app/session/[id]/page.tsx`)가
   기존에는 `legacy_sessions`만 조회했다 — 실제 v3 예약(`sessions`/
   `reservations`, R6~R7)으로 들어온 세션은 갈 곳이 없었다. 새 모듈
   `app/session/[id]/session-source-data.ts`(`loadNormalizedSession`)가
   legacy_sessions를 먼저 조회하고(기존 레거시 테스트 데이터·화면 100% 보존),
   없으면 v3 `sessions`(+`reservations`+`subject_enrollments`)로 폴백해 같은
   모양(`NormalizedSession`)으로 정규화한다. viewer role(student/teacher/
   parent/admin) 판정, 완료 세션 잠금(v3 `final_status`가 scheduled/live가
   아니면 `computeSessionViewState`가 "completed"로 취급)까지 두 원본 공통
   경로로 처리.
2. **완료 세션 읽기 전용 잠금**(로드맵 R8 (4) 일부): v3 세션은 `final_status`가
   scheduled/live를 벗어나면 기존 `SessionViewState "completed"` 처리 경로를
   그대로 타 자동으로 잠긴다(레거시와 동일 메커니즘 재사용, 신규 코드 없음).
3. **material_version_id 불변식 강제**(로드맵 R8 (1), `docs/CURRENT.md`
   "material_version_id 정책(R9 이관)" 문서화분의 코드화): 신규 migration
   `20261219000000_r8_material_version_lock.sql` — `sessions.material_version_id`가
   한 번 채워지면 재배정 불가, `final_status`가 scheduled/live를 벗어난
   뒤에는 아예 변경 불가(트리거 `sessions_prevent_material_version_reassignment`,
   R1의 `sessions_prevent_direct_update`와 동일 `app.bypass_session_lock`
   우회 관례를 재사용).
4. **v3 세션의 하위 테이블(필기/과제/단어장/AI문제생성) 쓰기 가드**: 조사 결과
   `canvas_annotations`/`homework_items`/`vocab_words`/`session_problem_attempts`
   등은 R6 cutover 당시 명시적으로 `legacy_sessions`만 참조하도록 남겨졌다
   (FK가 legacy_sessions를 가리킴, `20260928000000_r6_sessions_cutover.sql`
   주석 확인) — v3 세션 id로 그 테이블에 쓰면 FK 위반으로 서버 액션이 깨진다.
   이 하위 테이블을 v3로 확장하는 마이그레이션은 로드맵 R8 (3) "annotation
   event log"(별도 신규 이벤트 소싱 테이블)에서 다룰 몫이라 이번 라운드
   범위에 넣지 않고, 대신 `SessionShell`에 `writesEnabled` prop을 추가해
   v3 세션에서는 편집 컴포넌트에 읽기전용 뷰어(`"admin"`)를 넘겨 저장 UI
   자체를 숨기고 상단에 안내 배너("필기·과제·단어장 저장은 다음 라운드에서
   지원됩니다")를 노출한다 — **UI 레벨 가드이며 DB 레벨 강제는 아님**을
   명시(서버 액션을 직접 호출하면 여전히 FK 위반으로 실패할 뿐, 별도 방어
   로직은 추가하지 않음 — 다음 annotation event log 라운드에서 근본 해결).

### 검증

- `supabase db reset --local`: 통과(R10/타 R8 병렬 migration 포함 전체 적용
  확인).
- `npx tsc --noEmit`: 클린.
- `app/session/[id]/r8-cutover.integration.test.ts`(신규, UAT 실행 ID
  `r8cutover01` — household `aabbccdd-...0001`/학생 `cccccccc-...0002`/선생님
  `dddddddd-...0002`(전부 기존 고정 시드 계정 재사용, 신규 계정 생성 없음)
  위에 contract/subject_enrollment/reservation/session/curriculum_doc(+version)
  1건씩만 생성, `afterAll`에서 정확히 그 id들만 삭제 확인): 7/7 통과 —
  (1) v3 세션이 legacy_sessions에 없어도 정규화되어 학생 뷰어로 읽힘,
  (2) teacher_id 기준 teacher 뷰어 판정, (3) 무관한 사용자는 null(notFound),
  (4) 종료 상태(final_status=company_cancelled)면 completed로 잠김,
  (5)(6)(7) material_version_id 최초 배정 허용/재배정 차단/완료 후 변경
  차단 트리거 확인.
- 기존 `app/session/**` 컴포넌트 테스트(43개, mocked) 전부 통과 — SessionShell
  prop 추가(`writesEnabled`, 기본값 true)가 레거시 경로 회귀를 일으키지
  않음을 확인.
- 전체 Vitest 1회 시도했으나 R10 병렬 세션이 같은 로컬 DB에 동시에
  `supabase db reset --local`을 실행하며 레이스가 발생해(다른 라운드
  테스트가 원인 불명 buffer/slot 오류로 실패, 격리 재실행 시 100% 통과
  확인) 신뢰할 수 있는 전체 스위트 1회 결과를 이번 라운드에서 확보하지
  못했다 — **내 변경분과 무관함을 개별 파일 재실행으로 확인**했지만, 두
  병렬 라운드가 모두 끝난 뒤 한쪽이 마지막에 전체 스위트 1회를 다시 돌려
  확정할 것을 다음 작업으로 남긴다.
- `next build`는 이번 절에서 별도로 실행하지 않음(R10 병렬 세션과 동시에
  실행 시 `.next` 산출물 경합 위험 판단, tsc 클린 + 대상 vitest 통과로
  대체) — 다음 라운드(또는 R10과 조율 후) 1회 확인 필요.

### 미완료 / 다음 순서(로드맵 R8 우선순위 그대로)

로드맵 R8 체크리스트 중 이번 라운드가 다루지 못한 항목(우선순위 순, 이번에
손대지 않음):
2. 교재 버전 스냅샷의 실제 배정 메커니즘(R9 과목 템플릿 선행 필요 — 위
   "완료" 3번은 불변식만, 배정 로직 자체는 미착수 그대로 이월).
3. annotation overlay 실시간 전송·영구 저장·재접속 복구·동시 편집 충돌
   처리·전체 지우기 감사 이력 — 신규 이벤트 소싱 테이블 설계 필요, 착수
   안 함.
5~7. 회사 Shared Drive 폴더 자동 생성·권한 자동화, Smart Notes 이동,
   Drive/Supabase 역할 분리 — 이번 세션에서는 손대지 않음(단, 같은 세션의
   R8 병렬 작업이 8번 재처리 큐 쪽 일부를 별도로 진행한 것으로 보임 —
   `lib/drive-session-tasks.ts`/`20261220000000_r8_session_drive_provisioning_queue.sql`,
   이 절 작성자는 그 코드를 검토·수정하지 않았으니 그쪽 라운드 보고를
   참고할 것).
9. Drive ACL 없이 서버 경유 제공 — 미착수.
10. iPad/Apple Pencil/회전/확대/스크롤 실기기 QA — **명시적으로 스킵**:
    이 세션은 실기기(iPad/Pencil)에 접근할 수 없다. 기존
    `SessionShell`/`CanvasOverlay`/`MathCanvas` 등은 이미 Tailwind
    반응형 클래스와 pointer 이벤트(마우스/터치 겸용으로 보이는 핸들러)를
    쓰고 있으나 이번 라운드에서 별도 코드 리뷰·뷰포트 시뮬레이션은
    수행하지 않았다(레포에 Playwright가 있으나 이 화면 대상 e2e는 아직
    없음) — 다음 라운드에서 최소한 뷰포트 시뮬레이션이라도 추가할지 결정
    필요.
11. 느린 네트워크·오프라인·재접속 시험 — annotation 실시간 전송 자체가
    아직 없어(3번 미착수) 대상이 없다. 3번 구현 시 함께 다룰 것.

### 이번 라운드 변경 파일

- `app/session/[id]/page.tsx`(수정), `app/session/[id]/session-source-data.ts`(신규),
  `app/session/[id]/SessionShell.tsx`(수정, `writesEnabled` prop 추가),
  `app/session/[id]/r8-cutover.integration.test.ts`(신규),
  `supabase/migrations/20261219000000_r8_material_version_lock.sql`(신규),
  `docs/2026-09-07-r8-session-cutover-oneP-pager.md`(신규, 착수 전 1장 정리),
  `docs/CURRENT.md`(이 절).

## 2026-09-07 — R8∥R10 1라운드 종합 검증(병렬 라운드 종료 후 통합 확인)

R8·R10을 같은 워킹트리에서 병렬 진행하는 과정에서 서로 다른 하위 에이전트가
`app/session/[id]/` 파일을 동시에 건드릴 뻔한 충돌이 한 번 감지됐다 — 나중에
시작한 쪽을 즉시 중단시켜 실제 코드 손실·덮어쓰기 없이 정리했다(먼저 시작한
쪽의 작업만 유지). 이후 각자 자기 파일만 `git add`로 커밋해 최종적으로 커밋
3건이 남았다: `e9d357e`(R8, Drive 재처리 큐), `a4f8d8d`(R10, payout batch
lifecycle), `9d9cc5f`(R8, 세션뷰 v3 cutover + material_version_id 불변식).

병렬 진행 중 각 라운드가 공유 로컬 DB 경합으로 "종합 전체 검증(tsc/vitest/
next build 1회)"을 미뤘으므로, 두 라운드 종료 후 이 세션에서 직접 통합
재검증을 수행했다:

- `supabase db reset --local`: 성공. 3개 신규 마이그레이션
  (`20261218000000_r10_payout_batch_lifecycle.sql`,
  `20261219000000_r8_material_version_lock.sql`,
  `20261220000000_r8_session_drive_provisioning_queue.sql`)이 타임스탬프
  순서 충돌 없이 전부 적용됨.
- `npx tsc --noEmit`: 클린.
- `npx vitest run --no-file-parallelism`: **201개 파일 / 1318개 테스트 전부
  통과**(0 실패) — 병렬 실행 중 개별 라운드가 보고했던 일시적 실패(공유 DB
  경합 추정)는 이번 단독 순차 실행에서 재현되지 않음, 진짜 회귀 없음 확인.
- `npx next build`: 성공(전 라우트 정상 빌드, `/session/[id]` 포함).

**R8∥R10 1라운드 결론**: 코드 기준선 정상, 로컬 검증 전부 통과. 실제
Google/DocuSign/Stripe/이메일 호출 없음, Production/main 미변경. 각 R의
세부 미완료 항목(R8: annotation 실시간·Drive 자동화 실배선·iPad 실기기 QA
등, R10: 관리자 UI·정산 상세·리포트·법률 blocker 2건)은 위 각 절에 이미
기록된 그대로 다음 라운드로 이월.

## 2026-09-07(야간 자율 라운드) Task A/B — R10 법인 설립 전 지급 경계 corrective migration + 실제 정산 파이프라인 데이터 모델(완료)

제품 오너 지시(법인 설립 전 정책, 2026-09-07 야간)에 따라 `a4f8d8d`
(`20261218000000_r10_payout_batch_lifecycle.sql`)가 열어둔 approved→
processing/paid 경로를 DB 레벨에서 fail-closed로 막는 corrective additive
migration을 추가했다. 기존 마이그레이션 파일은 수정하지 않음.

- 신규 `supabase/migrations/20261221000000_r10_pre_incorporation_payout_gate.sql`:
  - `payout_disbursement_gate`(단일 행, `real_disbursement_enabled boolean default false`)
    + `real_disbursement_enabled()` 함수 — 앱 레이어의
    `DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS` 패턴과 동일한 취지의 DB 레벨 게이트.
    RLS로 authenticated에는 select만 허용, update 정책 자체를 부여하지 않아
    앱 코드가 실수로 켤 수 없음(운영자가 SQL로만 전환).
  - `mark_payout_batch_processing()`/`mark_payout_batch_paid()` 재정의 —
    게이트가 false(기본값)면 즉시 raise exception, approved 상태는 그대로
    유지된다(부분 실패 없음, 완전 거부).
  - `reverse_payout_item()` 재설계 — 기존 설계(역분개 시 새 "paid" batch
    생성)가 이 경계를 우회하는 모순이 있어, 게이트가 닫혀 있으면 역분개
    batch/item이 approved에서 멈추도록 바꿨다(게이트가 켜지면 기존 설계
    그대로 즉시 paid).
  - 실제 Mercury/Wise API 호출 코드는 레포 전체에 없음을 grep으로 재확인
    (`mercury`/`wise.com`/`api.mercury`/`api.wise` 전부 0건) — 이번 작업은
    순수 DB 가드이며 막을 실호출 자체가 아직 없다.
- 신규 `supabase/migrations/20261222000000_r10_settlement_pipeline_schema.sql`
  (Task B, 로드맵 R10 "지급 인프라와 승인 정책" 확정 상태머신을 구조만 반영,
  실제 연동 코드 없음):
  - `v3_payout_batch_status`에 `calculated`/`reviewed`/`dispatch_requested`/
    `provider_pending` 값 추가(기존 draft/reviewing/approved/processing/
    paid/failed는 삭제하지 않음 — enum 값 제거는 위험해 additive만).
  - `payout_batches`에 `dispatch_idempotency_key`(unique, batch당 1회 발급 —
    재시도 시 동일 key 반환해 이중 지급 요청 방지)/`provider_transaction_id`/
    `provider`/`dispatch_requested_at`/`provider_pending_at`/
    `last_reconciliation_at`/`failure_reason` 추가.
  - `payout_items`에 `provider_transaction_id`/`last_reconciliation_at`/
    `failure_reason`/`retry_count` 추가 — 강사별 부분 실패 재시도가 배치
    내 다른 강사 항목에 영향을 주지 않도록 항목 단위로 추적.
  - `generate_payout_batches()`를 `calculated`로 생성하도록 재정의,
    `submit_payout_batch_for_review()`/`approve_payout_batch()`는 draft/
    calculated, reviewing/reviewed 둘 다 받아들이도록 조건 확장(기존 데이터·
    테스트 호환, 새 어휘로 자연 전환).
  - `dispatch_payout_batch(batch_id, provider, actor)`: approved→
    dispatch_requested, idempotency key 발급. `mark_payout_batch_provider_pending()`:
    dispatch_requested→provider_pending. 둘 다 `real_disbursement_enabled()`
    게이트로 fail-closed — 값 자체는 enum에 존재하지만 게이트가 꺼진 동안
    함수 호출로는 절대 도달 불가(구조적으로는 "값 존재", 동작상으로는
    "도달 불가능"이라는 의미로 구현). 실제 Mercury/Wise API 클라이언트
    코드는 이번에도 추가하지 않음(설계·스키마만).
- 검증: `lib/booking/payout-batch-lifecycle.integration.test.ts` 갱신(1라운드
  테스트가 approved→paid 성공을 가정했던 부분을 게이트 도입에 맞게 재작성) —
  (1) approve_payout_batch는 여전히 approved까지 정상 도달, (2)
  mark_payout_batch_processing/mark_payout_batch_paid 호출은 둘 다
  "법인 설립 전 지급 경계" 메시지로 reject되고 상태가 approved에 그대로
  머무름을 확인, (3) reverse_payout_item은 게이트가 닫힌 채로는 새 항목이
  paid가 아니라 approved 상태로 생성됨을 확인(paid 시나리오 자체 검증을
  위해 테스트 내부에서만 일시적으로 게이트를 켰다 껐다 — 실제 앱 경로 아님).
  `npx vitest run lib/booking/payout-batch-lifecycle.integration.test.ts`
  2/2 통과. `supabase db reset --local` 성공(두 신규 마이그레이션 포함 전체
  적용). 전체 스위트 결과는 이 라운드 마지막 절에 통합 기록.
- 외부 변경: 0건.

## 2026-09-07 — R10 Task C: 관리자 정산 화면을 v3 payout_batches로 완전 대체

- `app/admin/PayoutBatchesTab.tsx` + `payout-batches-data.ts`/`payout-batches-actions.ts`를
  admin nav "정산 (v3)" 탭에 연결(`app/admin/page.tsx`/`AdminShell.tsx`).
  레거시 `PayoutsTab.tsx`(teacher_payouts 기반)는 삭제해 두 화면이 동시에
  노출되지 않게 함.
- 법인 설립 전 지급 경계 정책(2026-09-07)에 따라 이 화면에서 도달 가능한
  최대 상태는 **승인(approved)**이다. processing/paid로 보내는 서버 액션
  자체를 만들지 않았다 — DB `real_disbursement_enabled()` 게이트(R10 Task A)
  와 별개로 UI 레이어에서도 "거부될 액션을 아예 노출하지 않는다"는 요구를
  지킨다.
- 레거시 `teacher_payouts` 테이블은 R13 전까지 읽기 전용으로 보존하되, 더
  이상 어떤 코드 경로도 쓰지 않도록 막았다:
  - `app/api/cron/generate-payouts/route.ts`를 no-op(410 반환)으로 바꾸고
    `vercel.json`의 cron 등록을 제거(매달 1일 자동 생성 크론이 실제로
    비활성화됨).
  - `app/admin/payouts-actions.ts`(generatePayouts/markPayoutPaid/
    markPayoutsPaidBulk/revertPayoutToPending)는 UI에서 더 이상 호출되지
    않지만 "use server" export라 액션 ID로 직접 호출될 여지가 남아 있어,
    본문을 전부 `throw`로 막았다(관리자 권한 확인은 유지).
- 신규/갱신 테스트: `payout-batches-data.test.ts`, `payout-batches-actions.test.ts`,
  `PayoutBatchesTab.test.tsx`, `payouts-actions.test.ts`(비활성화 동작
  검증으로 재작성), `route.test.ts`(410 no-op 검증으로 재작성),
  `AdminShell.test.tsx`(탭 라벨/렌더 대상 갱신).
- 범위 밖으로 남긴 것(Task C 5단계, "next-priority"): 학생/보호자용 정산
  상세·이의제기(dispute/appeal) 화면. 관리자 화면 자체를 이번에 처음
  만들었고 학생/보호자 쪽 UX·권한 모델은 아직 설계되지 않아 지금 만들면
  재설계 위험이 크다고 판단 — R11 이후 별도 라운드에서 설계부터 시작할 것.
- 검증: `supabase db reset --local` 성공, `npx tsc --noEmit` 클린,
  스코프 vitest(위 신규/갱신 파일들) 전부 통과. 전체 스위트 결과는 이
  라운드 마지막 절에 통합 기록.
- 외부 변경: 0건 (Vercel cron 등록은 로컬 `vercel.json` 파일 변경일 뿐 —
  실제 배포/재배포는 하지 않음).

## 2026-09-07 — R8 follow-up Task D: 세션 주석(화이트보드) 이벤트 로그 도입

- 신규 `supabase/migrations/20261223000000_r8_session_annotation_events.sql`:
  v3 `sessions` 전용 append-only 이벤트 테이블 `session_annotation_events`.
  - `seq`(전역 bigserial)가 동시 편집 순서의 유일한 근거 — 세션별 카운터가
    아니라 전역 시퀀스를 쓰는 이유와 append-only 강제 방식(트리거로
    UPDATE/DELETE를 role과 무관하게 전면 차단, service_role도 예외 없음 —
    테스트/마이그레이션 정리용 `app.bypass_annotation_lock` GUC만 예외)을
    마이그레이션 주석에 명문화.
  - `event_type in ('stroke','clear_all')` — clear_all은 삭제가 아니라
    이벤트로 기록되어 이전 stroke가 영구 보존됨(감사 추적).
  - RLS: 조회는 세션 당사자/관리자, 기록(INSERT)은 `author_id = auth.uid()`
    본인 명의만, `clear_all`은 신규 헬퍼 `is_session_teacher_v3()`로
    선생님/관리자만 허용.
- 신규 `app/session/[id]/annotation-events-actions.ts`: append(stroke/
  clear_all)·replay 서버 액션 + 순수 함수 `reconstructVisibleStrokes()`
  (재접속 시 마지막 clear_all 이후 stroke만 재구성).
- **두 트랙 공존 상태(의도적, 이번 라운드 범위 밖)**: 기존
  `WhiteboardCanvas.tsx`는 여전히 Realtime broadcast + `legacy_sessions.
  whiteboard_strokes`(마지막 스냅샷 jsonb) 방식 그대로다. 새 이벤트 테이블은
  v3 세션에 대해서만 존재하고, 프론트엔드를 이 테이블·서버 액션에 연결하는
  리와이어링(그리기 UI가 `appendStrokeEvent`/`replayAnnotationEvents`를
  호출하도록 바꾸는 작업)과 레거시→신규 백필은 하지 않았다 — R9 세션뷰
  통합 라운드에서 WhiteboardCanvas를 다시 만질 때 함께 처리할 것을 권장.
  레거시 데이터는 읽기 호환만 유지되고 새 쓰기는 신규 테이블에만 쌓인다는
  원칙만 이번에 못박았다.
- 검증(로컬 Postgres 직접 psql, `app/session/[id]/session-annotation-events.
  integration.test.ts`): (1) append 후 seq 오름차순 재생이 실제 기록 순서와
  일치, (2) 여러 stroke를 한 트랜잭션으로 동시에 넣어도 seq가 유일한 전체
  순서를 보장(중복/역전 없음), (3) clear_all은 삭제가 아니라 이벤트로
  쌓이고 이전 stroke 개수가 줄지 않음, (4) 학생/보호자는 clear_all 기록이
  RLS로 차단됨, (5) 세션 무관 제3자·author_id 위조는 RLS로 차단됨,
  (6) UPDATE/DELETE는 authenticated 역할(RLS 필터로 0건 처리)과
  service_role(트리거로 명시적 에러) 양쪽 모두에서 실제로 막힘을 확인.
  순수 함수 `reconstructVisibleStrokes()`는 별도 단위 테스트로 clear_all
  이전/이후 분리, 빈 결과, 순서 보존을 검증.
- 검증: `supabase db reset --local` 성공(신규 마이그레이션 포함), 위 통합
  테스트 7개 + 액션 단위 테스트 8개 통과, `npx tsc --noEmit` 클린. 전체
  스위트 결과는 아래 절에 통합 기록.
- 외부 변경: 0건.

## 2026-09-07 — Task C/D 완료 후 전체 검증 (최종 1회)

- `supabase db reset --local`: 성공 (Task C/D의 신규 마이그레이션 포함 전체
  마이그레이션 적용 + seed 완료).
- `npx tsc --noEmit`: 에러 0건.
- `npx vitest run --no-file-parallelism`(DB reset 직후, 전체 스위트):
  **205 test files / 1340 tests 전부 통과**.
- `npx next build`: 성공 (Turbopack, 32개 페이지 생성 완료, TypeScript
  타입체크 포함 통과).
- Task C 5단계(학생/보호자 정산 상세·이의제기 화면)는 위에 문서화한 대로
  이번 라운드에서 의도적으로 보류.
- Task D의 WhiteboardCanvas 프론트엔드 리와이어링·레거시 백필도 위에
  문서화한 대로 이번 라운드 범위 밖으로 명시적으로 남김.

## 2026-09-07 — R10 corrective 2차: paid 전이 CHECK 제약의 구조적 허점을 트리거로 보강

`8dc77b5`(R10 corrective 1차, `20261224000000_r10_paid_transition_guard_and_reversal_fix.sql`)가
paid는 `provider_transaction_id`·`provider_confirmed_at`이 모두 있어야 한다는
CHECK 제약을 추가했지만, **CHECK 제약은 UPDATE 이전(OLD) 상태를 볼 수 없다는
구조적 한계**가 있었다 — 제품 오너 리뷰에서 지적된 대로, 특권 직접 UPDATE 한
문장으로 `status='approved' -> status='paid'`를 쓰면서 동시에 두 확인 컬럼까지
채우면 provider_pending 단계를 완전히 건너뛰고도 CHECK를 통과할 수 있었다.

- 신규 `supabase/migrations/20261225000000_r10_paid_transition_trigger_guard.sql`
  (additive, `20261224000000`은 그대로 유지 — CHECK와 트리거는 서로 다른 불변을
  지키는 상호 보완 관계):
  - `payout_batches`: `guard_payout_batch_paid_transition()` BEFORE INSERT OR
    UPDATE 트리거. INSERT로 곧바로 `status='paid'`인 행을 만들 수 없고, UPDATE로
    `paid`로 "새로" 전이하려면 `OLD.status = 'provider_pending'`이어야만 한다 —
    그 외 이전 상태(approved/processing/dispatch_requested 등)에서의 직접
    전이는 확인 컬럼이 채워져 있어도 트리거가 거부한다.
  - `payout_items`: `guard_payout_item_paid_transition()` BEFORE INSERT OR
    UPDATE 트리거. INSERT로 곧바로 paid 생성 불가. UPDATE로 paid 전이하려면
    "그 시점에 부모 `payout_batches`가 이미 `paid`"여야 한다. `mark_payout_batch_paid()`
    (20261224000000 정의)는 이미 같은 트랜잭션 안에서 (1) batch를 paid로 UPDATE
    → (2) 그 다음 statement로 items를 paid로 UPDATE 순서였으므로(재정렬 불필요 —
    원래부터 batch가 먼저였음), 트랜잭션 내 자신의 앞선 쓰기는 항상 보이는
    Postgres MVCC 규칙에 따라 (2) 시점에는 이미 batch가 paid로 보여 정상 경로는
    그대로 통과한다.
  - 두 트리거 함수 모두 `public/anon/authenticated/service_role`에서 실행 권한을
    명시적으로 revoke(트리거 전용, 직접 호출 불가).

- 필수 통합 테스트 5건, 모두 `lib/booking/payout-batch-lifecycle.integration.test.ts`에
  추가·재검증(총 11 tests, 전부 통과):
  1. **게이트 열림 + 확인 컬럼까지 한 문장에 채운 approved→paid 직접 UPDATE 거부**:
     "트리거가 direct UPDATE로 approved->paid를 확인 컬럼과 함께 한 문장에
     넣어도 거부한다" — `guard_payout_batch_paid_transition`이
     `/provider_pending 상태에서만 paid로 전이할 수 있습니다/`로 거부, 상태는
     approved에 그대로 남고 provider_transaction_id도 null 유지됨을 확인.
  2. **provider_pending이지만 확인 컬럼 누락 시 CHECK가 여전히 거부(트리거와
     나란히 있어도 회귀 없음)**: "트리거가 추가된 뒤에도 provider_pending +
     확인 컬럼 누락 조합은 CHECK가 그대로 거부한다" — 트리거의 OLD.status
     검사는 통과(provider_pending)하지만 CHECK
     (`payout_batches_paid_requires_confirmation`)가 여전히 거부, 함수 경로
     (`mark_payout_batch_paid`)도 동일하게 거부됨을 재확인. 기존
     "CHECK 제약이 ... 구조적으로 거부한다" 테스트도 이제 batch를 먼저
     provider_pending까지 올려 트리거를 통과시킨 뒤 CHECK 단독 동작을
     검증하도록 갱신.
  3. **정규 파이프라인 end-to-end 성공**: "정규 파이프라인(provider_pending ->
     provider_confirmed -> paid)은 트리거가 있어도 end-to-end로 성공한다" —
     `dispatch_payout_batch -> mark_payout_batch_provider_pending ->
     mark_payout_batch_provider_confirmed -> mark_payout_batch_paid`가 트리거
     추가 후에도 batch/item 모두 paid로 정상 도달함을 확인.
  4. **payout_items 단독 직접 paid 거부**: "payout_items를 batch와
     독립적으로(또는 batch가 paid이기 전에) 직접 paid로 만들면 거부된다" —
     부모 batch가 approved일 때, 그리고 provider_pending일 때(아직 paid
     아님) 각각 item을 직접 paid로 만드는 UPDATE가
     `guard_payout_item_paid_transition`에 의해 거부되고 item 상태가 바뀌지
     않음을 확인.
  5. **역분개(reversal) 항목도 동일 가드 적용, 지름길 없음 재확인**:
     "reverse_payout_item으로 만든 reversal item도 새 트리거 하에서 정규
     파이프라인 없이는 paid 지름길이 없다" — `reverse_payout_item()`이 만든
     새 batch/item을 직접 paid로 전이시키려는 시도(item 단독, batch 단독 모두)가
     트리거로 거부됨을 확인. 기존 "reverse_payout_item은 게이트가 열려
     있어도..." 테스트도 트리거 추가 후 그대로 통과함을 재검증.
- 부수 수정: `lib/booking/session-final-judgment.integration.test.ts`의
  "payout_items가 이미 paid였으면 금액은 바뀌지 않고
  superseded_by_reconciliation_task_id로만 표시된다" 테스트가 batch_id가 null인
  채로 item을 직접 paid로 만들던 기존 방식이 새 트리거에 걸려, 먼저 paid 상태의
  부모 batch를 정상적으로 만든 뒤(approved → provider_pending → paid, 트리거가
  요구하는 전이 경로 그대로) item을 그 batch에 연결하며 paid로 전이시키도록
  수정. 트리거가 실제로 무결성을 지키고 있음을 보여주는 부수 효과.
- 검증: `supabase db reset --local` 성공(신규 마이그레이션 포함),
  `npx vitest run --no-file-parallelism`(DB reset 직후, 전체 스위트) **206 test
  files / 1360 tests 전부 통과**(위 5건 포함), `npx tsc --noEmit` 에러 0건,
  `npx next build` 성공(Turbopack, 32개 페이지, 타입체크 포함).
- 외부 변경: 0건.

### 후속 항목(지금 구현하지 않음, 실제 지급 연동 활성화 전 반드시 처리) — `mark_payout_batch_processing()`

`mark_payout_batch_processing()`(구형/레거시 processing 상태 함수, `20261218000000`
정의)은 신규 파이프라인(`dispatch_payout_batch`/`mark_payout_batch_provider_pending`/
`mark_payout_batch_provider_confirmed`/`mark_payout_batch_paid`)과 병행 존재하며,
지금 당장은 이번 corrective의 blocker가 아니다(v3 admin UI인
`payout-batches-actions.ts`가 호출하지 않고, `mark_payout_batch_paid()`가
provider_pending만 허용하도록 재정의되어 있어 processing을 거쳐 paid로 갈 수
없다 — `20261224000000`의 함수 주석에 이미 명시). 그러나 **실제
Mercury/Wise 연동을 켜기 전에는 반드시 다음 중 하나를 결정하고 처리해야
한다**:
- (a) `mark_payout_batch_processing()`을 완전히 제거하거나,
- (b) approved 상태에서만 processing으로 갈 수 있게 유지하되 신규 파이프라인과
  상태 충돌이 없도록 명시적으로 제약(예: processing에서 dispatch_requested로
  갈 수 없다는 CHECK나 트리거)을 추가하거나,
- (c) 신규 파이프라인으로 완전히 흡수 통합.

두 상태 모델(구형 processing 경로 vs 신규 dispatch_requested/provider_pending
경로)이 병존하는 채로 실제 연동을 켜면, 두 경로 중 어느 쪽이 "진실"인지
운영자가 혼동할 여지가 있다 — 법인 설립 후 실제 지급 연동 착수 R 단계의
필수 선행 점검 항목으로 기록한다.

## 2026-09-07 — R9: WhiteboardCanvas ↔ session_annotation_events 연결

1장 정리: `docs/2026-09-07-r9-whiteboard-eventlog-oneP-pager.md`. R8 Task D
(`b4fd788`)가 만들어만 두고 프론트엔드 연결은 범위 밖으로 남겨뒀던
`session_annotation_events`를 `WhiteboardCanvas.tsx`에 실제로 연결했다.

- **v3 세션**: 화이트보드가 이제 `legacy_sessions.whiteboard_strokes`가 아니라
  `session_annotation_events`(append-only 이벤트 로그)를 source of truth로 쓴다.
  - 그리기: pointerUp 시 정규화 좌표(0~1, 캔버스 폭/`BOARD_HEIGHT` 기준)로 변환해
    `appendStrokeEvent()`로 append. 레거시처럼 600ms debounce 스냅샷 저장이 아니라
    stroke마다 즉시 영구 기록됨.
  - 로드/재접속: 마운트 시 및 Supabase Realtime 채널이 (재)`SUBSCRIBED` 상태가 될
    때마다 `replayAnnotationEvents()` + `reconstructVisibleStrokes()`로 캔버스를
    지우고 서버 로그 기준으로 다시 그린다(`replayAndRedraw()`) — 클라이언트 메모리
    상태를 신뢰하지 않고, 연결이 끊겼다 재접속해도 항상 서버가 단일 진실 소스.
  - 실시간: `session_annotation_events` INSERT를 postgres_changes로 구독
    (`app/student/ChatPanel.tsx`와 동일한 convention). 본인이 방금 append한 이벤트는
    `author_id`로 걸러 중복 드로잉을 막는다. 이 테이블을 supabase_realtime
    publication에 추가하는 마이그레이션
    (`supabase/migrations/20261226000000_r9_annotation_events_realtime.sql`)을
    새로 추가 — publication이 없는 환경에서도 안전하게 스킵되도록 존재 여부 체크.
  - clear-all 권한: DB(RLS `is_session_teacher_v3`)가 최종 강제하던 것을 UI에도
    반영 — `ScratchpadTab`이 `whiteboardViewerRole`(실제 뷰어 role, `writesEnabled`
    읽기전용 강제를 우회)로 `canClearAll`을 계산해 선생님/관리자가 아니면 버튼
    자체를 렌더링하지 않는다. 방어적으로 호출돼도 서버가 거부하면 에러 문구를
    표시하고 `replayAndRedraw()`로 낙관적 로컬 삭제를 되돌린다.
  - 타입/순수 함수(`StrokePayload`/`AnnotationEvent`/`reconstructVisibleStrokes`)는
    새 `annotation-events-types.ts`로 분리 — "use server" 파일
    (`annotation-events-actions.ts`)은 async 함수만 export할 수 있어(Next.js
    제약), 클라이언트 컴포넌트가 쓰는 타입/순수 함수를 거기 두면 `next build`가
    깨짐(처음 시도에서 실제로 발견·수정).
- **레거시 세션**: 기존 동작 그대로 — `legacy_sessions.whiteboard_strokes` 읽기/
  broadcast-only 실시간 협업/디바운스 저장. 새 이벤트 테이블에는 아무 것도 쓰지
  않는다(정책: 읽기 호환만 유지, 백필 없음).
- 배너 문구 수정(`SessionShell.tsx`): "필기·과제·단어장 저장은 다음 라운드"에서
  화이트보드를 빼고 "과제·단어장 저장은 다음 라운드, 화이트보드는 사용 가능"으로.
- 검증: `supabase db reset --local` 성공(신규 마이그레이션 2건 포함 — 이벤트
  테이블은 R8에서 이미 존재, 이번엔 realtime publication 추가만), 신규/갱신
  테스트(`WhiteboardCanvas.test.tsx` 8개, `ScratchpadTab.test.tsx` 갱신분,
  `annotation-events-actions.test.ts` 타입 임포트 경로만 갱신) 포함 전체
  vitest 207 files/1368 tests 통과(fresh reset 직후 1회 실행 기준 — reset 없이
  스위트를 연속 두 번 돌리면 기존에도 있던 무관한 통합 테스트 fixture 재사용
  이슈로 flaky해짐, 이번 변경과 무관), `npx tsc --noEmit` 클린, `next build`
  성공(처음엔 위 "use server" export 제약 위반으로 실패했다가 타입 분리 후 통과).
- 실시간 postgres_changes가 실제 두 브라우저 세션 간에 눈으로 보이는 형태로 동작하는지는
  Preview UAT로 확인하지 않았다(로컬 자동 테스트로 구독/재생 로직만 검증) —
  다음 라운드에서 Preview 두 세션(교사/학생) 열어 실제 확인 권장.
- UAT 실행 ID: 사용 안 함(신규 UAT 계정 생성 없이 기존 vitest 통합 테스트
  fixture만 재사용, 위 1장 정리 3번 항목 참고). 별도 정리 대상 없음.
- 외부 변경: 0건.

## 2026-09-07 — R9 corrective: 제품 오너 리뷰 2건(스트로크 유실, clear-all admin 누락)

바로 위 R9(`8a46e2b`) 완료 직후 제품 오너 리뷰에서 발견된 결함 2건을 수정했다.
범위는 `app/session/[id]/` 화이트보드/주석 관련 파일로 한정.

**Defect 1 — stroke 저장 단위가 세그먼트당이 아니라 스트로크당 마지막
세그먼트만이었음.** `WhiteboardCanvas.tsx`의 `currentSegRef`가 pointer-move마다
덮어써지는 단일 세그먼트만 들고 있어서, 여러 move tick으로 이뤄진 stroke는
화면엔 전체가 그려져도 서버엔 마지막 조각만 append됐다(새로고침/재접속/다른
클라이언트에서는 꼬리만 남음).
- 수정: `currentSegRef` → `currentStrokeSegsRef`(배열)로 바꿔 pointer-move마다
  세그먼트를 누적하고, pointerUp에서 누적된 세그먼트 전부를 순서대로
  `appendStrokeEvent()`로 append(기존 세그먼트당-1행 스키마/`reconstructVisibleStrokes`/
  다른 클라이언트의 postgres_changes 드로잉 로직은 전혀 바꾸지 않음 — 세그먼트
  개수만 1개에서 N개로 늘어남).
- 저장 실패 시 롤백: `handlePointerUp`과 (기존에도 동일한 버그가 있던)
  `handleClearAll`의 catch 블록 모두, 실패 메시지를 `setErrorMsg`로 먼저 설정한
  뒤 `replayAndRedraw()`를 호출하던 순서를 뒤집었다 — `replayAndRedraw()`가
  성공하면 내부에서 `setErrorMsg(null)`을 호출해 방금 설정한 실패 메시지를
  즉시 지워버리는 기존 버그(R9 원본 코드에 이미 있었음, 이번에 테스트 작성
  중 발견)가 있었다. 이제 항상 "replay로 서버 기준 재동기화 → 그 다음에
  실패 메시지 표시" 순서로 고쳐서, 고스트 스트로크도 사라지고 사용자에게
  실패 사실도 남는다.
- 테스트(`WhiteboardCanvas.test.tsx`): 3개 세그먼트로 이뤄진 스트로크가
  `appendStrokeEvent`를 3회, 세그먼트 연결 순서 그대로 호출하는지 검증(SSR/
  마운트 시 replay·재접속 시 재구독 replay·다른 클라이언트 Realtime 수신은
  기존 R9 테스트가 이미 동일한 `reconstructVisibleStrokes()`/`toPixel()` 경로를
  타므로 세그먼트 수가 늘어도 동일 로직으로 재구성됨을 확인), 저장 실패 시
  `replayAnnotationEvents()`로 재동기화되고 실패 메시지가 화면에 남는지 검증.

**Defect 2 — clear-all UI 조건이 teacher만 허용, admin 누락.** 정책은
"선생님 또는 관리자"인데 `ScratchpadTab.tsx`의 `canClearAll`이
`whiteboardViewerRole === "teacher"`만 체크해서 admin이 버튼 자체를 볼 수
없었다. DB(RLS, R8 Task D `b4fd788`)의
`session_annotation_events_insert` 정책은 처음부터
`(event_type <> 'clear_all' or is_session_teacher_v3(session_id) or is_admin())`로
admin을 이미 포함하고 있었음(마이그레이션 추가 불필요, 확인만).
- 수정: `canClearAll = teacher || admin`. 또한 clear-all 버튼은 필기 모드
  툴바(`canDraw`) 안에 중첩돼 있어, admin이 버튼을 보려면 `canDraw`도 admin을
  포함해야 해서 함께 수정(`student || teacher || admin`) — DB도 stroke insert
  자체를 `is_session_related_v3(session_id) or is_admin()`으로 admin에게 이미
  허용하므로 정책 모순 없음.
- 테스트: `ScratchpadTab.test.tsx`에 admin이면 전체 지우기 버튼이 보이는 케이스
  추가. `session-annotation-events.integration.test.ts`(실제 로컬 Postgres 대상)에
  {student, teacher, admin} × clear_all role matrix를 추가 — teacher/admin
  성공, student는 RLS로 차단됨을 확인해 UI 가시성과 DB 강제가 세 역할 모두
  일치함을 고정.
- 검증: `supabase db reset --local`(동시 진행 중이던 다른 라운드의 reset과
  일시 충돌 2회 후 3번째 재시도에서 성공 — 트랜지언트), 위 신규/갱신 테스트
  포함 `WhiteboardCanvas.test.tsx`/`ScratchpadTab.test.tsx`/
  `session-annotation-events.integration.test.ts` 개별 통과, `npx tsc --noEmit`
  클린, 전체 `vitest run --no-file-parallelism` + `next build` 최종 1회 확인.
- 외부 변경: 0건. Stripe/Mercury/Wise/Google/이메일 등 실제 외부 API 호출 없음,
  Vercel 배포/`git push`/main 병합 없음, 로컬 커밋만.

## 2026-09-07 — R9 corrective(최종 라운드): 스트로크 저장 원자성/성능 결함 수정

바로 위 R9 corrective(`7d6c262`)에서 "여러 세그먼트를 순서대로 전부 append"까지는
고쳤지만, 그 append가 여전히 `for (const seg of segs) { await appendStrokeEvent(...) }`
로 세그먼트마다 별도 DB 호출을 순차 실행하는 구조였다. 이 라운드는 그 호출 방식
자체를 고친다 — 개별 행 스키마나 replay/재구성 로직은 건드리지 않는다.

**결함**
1. 성능 — 세그먼트 수만큼 순차 왕복(round-trip)이 생겨 스트로크가 길어질수록
   저장이 느려진다.
2. 원자성 — 루프 중간 호출이 실패하면(네트워크 순단, 서버 거부) 그 앞의
   세그먼트는 이미 커밋되고 뒤는 커밋되지 않은 "반쪽 스트로크"가 영구
   남는다. `session_annotation_events`는 append-only(UPDATE/DELETE 트리거로
   전면 차단)라 되돌릴 수도 없다. 실패 시 `replayAndRedraw()`는 서버에 이미
   남은 앞쪽 세그먼트를 다시 그릴 뿐 지우지 못해, "전부 성공 또는 전부 실패"가
   보장되지 않았다.

**수정**
- DB: `supabase/migrations/20261227000000_r9_atomic_append_stroke_events.sql`에
  `append_stroke_events(p_session_id uuid, p_segments jsonb) returns setof
  session_annotation_events` 함수를 추가했다. 스트로크 세그먼트 배열 전체를
  jsonb 배열로 받아, 함수 호출 하나(=하나의 트랜잭션) 안에서 `with ordinality`로
  입력 순서를 보존하며 한 행씩 INSERT한다. 도중에 필수 필드(x0,y0,x1,y1,color,tool)
  가 빠진 세그먼트를 만나면 exception을 raise하는데, plpgsql 함수 호출 전체가
  하나의 문장이라 예외를 잡지 않으면 그 호출에서 이미 INSERT한 행까지 전부
  자동 롤백된다(all-or-nothing). `SECURITY INVOKER`(기본값, 명시 안 함)라
  호출자 권한 그대로 실행되어 기존 RLS INSERT 정책("세션 당사자 기록, clear_all은
  선생님만")이 매 행 INSERT마다 그대로 적용된다 — 이 함수로 RLS를 우회할 방법은
  없다. seq(bigserial)는 함수 내부 루프가 입력 순서대로 한 행씩 순차 INSERT하므로
  세그먼트 순서와 동일한 순서로 단조 증가 배정된다.
- 서버 액션(`annotation-events-actions.ts`): 세그먼트 하나를 append하던
  `appendStrokeEvent(sessionId, stroke)`를 세그먼트 배열 전체를 위 RPC 한 번으로
  보내는 `appendStrokeEvents(sessionId, segments)`로 교체. author_id는 여전히
  클라이언트가 넘기지 않고 DB 함수 내부에서 `auth.uid()`로 고정(belt-and-suspenders
  유지).
- 클라이언트(`WhiteboardCanvas.tsx`): `handlePointerUp`의
  `for (const seg of segs) { await appendStrokeEvent(...) }` 루프를
  `await appendStrokeEvents(sessionId, segs.map(toNormalized))` 단일 호출로 교체.
  실패 시 `replayAndRedraw()` → 실패 메시지 표시 순서(R9 corrective 1차에서 고친
  순서)는 그대로 유지 — 이제 이 호출 자체가 원자적이므로 실패하면 서버에는
  이 스트로크의 세그먼트가 정말 0개 저장되고, replay가 그 사실을 정확히
  반영한다(부분 저장된 유령 세그먼트가 있을 수 없음).
- `currentStrokeSegsRef`(세그먼트 누적 배열), `reconstructVisibleStrokes()`,
  개별 `stroke` 이벤트 행의 payload 모양(x0,y0,x1,y1,color,tool)은 전혀
  바꾸지 않았다 — 바뀐 것은 "N번의 개별 호출"을 "1번의 원자적 호출"로 보내는
  경로뿐이다.

**테스트**
- `annotation-events-actions.test.ts`: `appendStrokeEvents`가 세그먼트 배열
  전체를 `supabase.rpc("append_stroke_events", ...)` 한 번으로 호출하는지,
  빈 배열이면 호출 자체를 생략하는지, RPC 에러를 그대로 throw하는지 검증.
- `WhiteboardCanvas.test.tsx`: 3개 세그먼트 스트로크가 `appendStrokeEvents`를
  정확히 1회(세그먼트별 N회가 아님) 호출하고 배열 순서가 그대로 유지되는지,
  그 1회 호출이 실패하면(다중 세그먼트 포함) `replayAndRedraw()`로 재동기화되고
  실패 메시지가 뜨는지 검증.
- `session-annotation-events.integration.test.ts`(실제 로컬 Postgres, 신규
  `describe("append_stroke_events RPC — ...")` 블록):
  - 순서 보존: 3개 세그먼트를 한 번에 보내면 반환된 행과, 이어서 다시 읽은
    replay 조회(seq 오름차순) 양쪽 모두 입력 순서 그대로(`seg-a, seg-b, seg-c`)
    나오는지 확인 — SSR/mount replay와 두 번째 클라이언트의 Realtime 재구성이
    같은 `select ... order by seq` 경로를 타므로 이 조회 하나로 두 경로를
    대표해서 검증했다.
  - 부분 실패 원자성: 5개 세그먼트 중 3번째에 `tool` 필드를 빠뜨려 함수 내부
    검증에서 실패하도록 만들고, 호출 전체가 exception을 던지며 세션의
    이벤트 개수가 호출 전후로 변하지 않음(0건 잔존, `atomic-a`/`atomic-b`
    포함해 전부 사라짐)을 확인.
  - 세션과 무관한 제3자 선생님이 호출하면 RLS로 전체가 거부되고 0건 저장.
  - 빈 배열/비배열 jsonb를 보내면 즉시 거부되고 0건 저장.
- {student, teacher, admin} × clear_all 권한 매트릭스(R9 corrective 1차에서
  추가한 기존 테스트, `describe("clear_all 권한 role matrix ...")`, `ScratchpadTab.test.tsx`
  admin 버튼 노출 케이스 포함)는 이번 라운드가 clear-all 로직을 전혀 건드리지
  않았음을 그대로 재실행해 확인 — 전체 스위트 1회 실행에 포함되어 회귀 없이
  통과.
- 검증: `supabase db reset --local` 성공(마이그레이션 순서 문제 없음,
  `20261227000000_r9_atomic_append_stroke_events.sql`까지 정상 적용), 영향받은
  4개 파일(`session-annotation-events.integration.test.ts`,
  `WhiteboardCanvas.test.tsx`, `annotation-events-actions.test.ts`,
  `ScratchpadTab.test.tsx`) 개별 실행 39/39 통과, `npx tsc --noEmit` 클린,
  전체 `vitest run --no-file-parallelism` 207 files / 1379 tests 전부 통과,
  `next build` 성공(정적 페이지 생성까지 완료, 에러 없음).
- 외부 변경: 0건. Stripe/Mercury/Wise/Google/이메일 등 실제 외부 API 호출 없음,
  Vercel 배포/`git push`/main 병합 없음, 로컬 커밋만. `R10/payout` 관련 파일은
  건드리지 않았다.

## 2026-09-07 — R9: 커리큘럼 콘텐츠 기반(docs/superpowers/plans/2026-09-07-curriculum-content-foundation.md) Task 1~4 완료

`docs/superpowers/specs/2026-09-07-curriculum-content-session-design.md`(제품
오너 승인)과 그 실행 계획의 Task 1~4를 순서대로 구현·검증·개별 커밋했다.
각 커밋: `44125f0`(Task 1), `505d05b`(Task 2), `63f5f57`(Task 3), 그리고 이
섹션과 함께 커밋되는 Task 4.

### Task 1 — 과목별 공용 키워드 사전 + 콘텐츠 검수 관계(`44125f0`)

`supabase/migrations/20261228000000_r9_curriculum_content_foundation.sql`:
- `subject_keywords(subject_id, label, normalized_label, status, created_by)`
  — `unique(subject_id, normalized_label)`로 "같은 라벨, 같은 과목 안에서만
  중복 금지"를 강제. 라벨 정규화(trim+lower)와 `created_by`는 트리거가
  채운다(클라이언트가 다른 사람 id를 넣을 수 없다).
- 단원↔키워드(`subject_template_unit_keywords`), 섹션↔키워드
  (`curriculum_doc_section_keywords`), 문제↔키워드(`problem_keywords`) 관계
  테이블. 트리거로 "공개(published)된 교재의 섹션만", "확정(confirmed)된
  문제만" 관계에 들어갈 수 있게 DB 레벨에서 강제(R8 material_version_id/R10
  paid 전이 트리거와 같은 패턴) — 교재/문제가 나중에 draft로 되돌아가면
  관련 관계 행을 자동으로 정리한다.
- RLS: 인증된 사용자 전체 조회, 관리자만 쓰기(선생님/학생 쓰기는 명시적 거부).

### Task 2 — 관리자 콘텐츠 에디터 키워드 태깅(`505d05b`)

`app/admin/subject-data.ts`/`subject-actions.ts`, `curriculum-doc-data.ts`/
`curriculum-doc-actions.ts`, `CurriculumDocEditor.tsx`를 확장해 단원/섹션/
문제에 Task 1 카탈로그의 키워드를 태그할 수 있게 했다. 새 조회는 전부
배치 처리(과목/섹션/문제 수가 늘어도 키워드·관계 조회는 각 테이블당 정확히
한 번) — N+1 회귀 테스트로 확인. AI 생성 문제는 기존과 동일하게
`confirmSectionProblems()`를 거쳐야만 `problems` 테이블에 `status:
"confirmed"`로 들어가므로(그 전까지는 React state의 초안일 뿐 DB에 아무
행도 없음) "관리자 확정 전까지 초안" 규칙은 그대로 유지된다.

### Task 3 — 학생별 운영 커리큘럼 오버레이(`63f5f57`)

`supabase/migrations/20261229000000_r9_student_curriculum_overlay.sql`:
`student_curriculum_overlays`(subject_enrollment당 active 1개, 부분 unique
인덱스) + `curriculum_overlay_units`(순서 있는 단원 인스턴스, `source_unit_id`
nullable=보강 단원) + `curriculum_overlay_unit_keywords`/
`curriculum_overlay_unit_materials`(Task 1과 같은 패턴으로 "공개된 교재만"
강제). 권한은 기존 `teacher_assignments` 패턴을 재사용
(`is_active_teacher_for_enrollment()`) — 새 인가 메커니즘을 만들지 않았다.
재정렬은 `reorder_curriculum_overlay_units(overlay_id, ordered_unit_ids)`
RPC 한 번으로 원자 처리(개수 불일치 시 전체 롤백, 통합 테스트로 확인).
완료 상태는 트리거가 `status_changed_by/at`을 `auth.uid()`로 기록할 뿐,
`session_problem_attempts`를 읽어 자동 전이시키는 코드는 전혀 없음을 통합
테스트로 명시적으로 확인(그런 트리거가 실수로 추가되면 실패하도록).
`app/teacher/student-curriculum-data.ts`(배치 로더)/`student-curriculum-actions.ts`
(add/exclude/reorder/setStatus/setActiveKeywords, 담당 학생 여부를
앱 레벨에서도 먼저 확인)/`StudentCurriculumPanel.tsx`(원본 문제 생성 UI 없음).

### Task 4 — 세션 중 AI 문제 생성 제거(이 섹션과 함께 커밋)

`app/session/[id]/AigenTab.tsx`, `AigenTab.test.tsx`, `aigen-actions.ts`,
`aigen-data.ts`를 삭제하고 `SessionShell.tsx`의 `문제 생성` 탭·렌더 분기,
`page.tsx`의 `subjectId`/`unitOptions` 전달을 함께 제거했다. 저장소 전체
검색으로 `AigenTab`/`aigen-actions`/`aigen-data`/`generateProblems`/
`finalizeProblemsToHomework`를 참조하는 다른 경로가 없음을 확인 — 남은
백도어 없음. 관리자 콘텐츠 에디터(`app/admin/curriculum-doc-actions.ts`의
`generateSectionProblems`/`regenerateProblem`/`confirmSectionProblems`)는
전혀 건드리지 않아 admin AI 초안 작성 흐름은 그대로 유지된다. 학생 개인
단어장(`vocab_words`, `VocabTab.tsx`, `vocab-actions.ts`/`vocab-data.ts`)과
과제/문제기록/연습장(화이트보드) 탭의 기존 동작·권한은 전혀 손대지 않았다.
`SessionShell.test.tsx`에 회귀 테스트 추가: "문제 생성" 탭은 학생/선생님
어느 역할로도 더 이상 보이지 않는다는 것과, 교재/과제/단어장/연습장 탭
노출은 그대로 유지된다는 것을 각각 확인.

### 검증(Task 1~4 공통, 각 Task 커밋 전 개별 실행 + 이 섹션에서 최종 1회 재확인)

- Task별: 해당 마이그레이션/파일 범위 테스트 개별 실행 통과(Task1 12/12,
  Task2 admin 스위트 67 files/448 tests, Task3 teacher 스위트 15 files/97
  tests including 통합 테스트 12/12, Task4 session 스위트 13 files/82
  tests) — 매 Task 커밋 전 `supabase db reset --local` + `tsc --noEmit` 클린
  확인.
- 최종 1회: `supabase db reset --local`(전체 마이그레이션 순서 문제 없음,
  `20261229000000_r9_student_curriculum_overlay.sql`까지 정상 적용) →
  `npx vitest run --no-file-parallelism` **212 files / 1420 tests 전부
  통과** → `npx tsc --noEmit` 클린 → `npx next build` 성공(정적 페이지
  생성 포함, 에러 없음).
- UAT 실행 ID: 사용하지 않음 — 이번 라운드는 스키마/서버 액션/화면 골격
  구축이며, 사용자 흐름 관점의 Preview UAT는 계획서 자체가 명시한 대로
  "다음 라운드(수업 준비·세션 문제 선택·과제 조립)"에서 실제 세션 흐름과
  함께 검증하도록 남겨뒀다(아래 미완료 항목 참고).

### 미완료 / 다음 순서

- 계획서의 "Separate follow-on plan"(수업 준비 활성 키워드 선택, 세션
  시작 시 콘텐츠 고정, 키워드 필터링된 교재/문제 탭, "수업 사용" 이벤트를
  단순 열람과 분리해 기록, 확정 문제로 과제 조립)은 이번 라운드에 포함하지
  않았다 — 계획서가 "Task 1~4가 수용된 뒤에만 시작"하도록 명시했다.
- Task 3의 `StudentCurriculumPanel.tsx`는 아직 어느 화면에서도 실제로
  마운트되지 않는다(교사 포털에 진입 경로 연결 안 됨) — 컴포넌트/서버
  액션/DB는 완성·테스트됐지만, 다음 라운드에서 교사 포털 내비게이션에
  연결하는 작업이 남아 있다.
- Preview UAT(실제 로그인 흐름으로 화면 확인)는 아직 수행하지 않았다 —
  다음 라운드에서 세션 흐름과 함께 한 번에 확인하는 편이 계획서 의도에
  맞다고 판단해 이번 라운드는 자동 테스트(vitest, DB 통합 테스트)로만
  검증했다.

## 2026-09-07 — 콘텐츠·커리큘럼 파운데이션 1차, corrective 3건 + 제품 오너 승인

Task 1~4(위 절) 이후 제품 오너 리뷰에서 발견된 gap을 corrective 3건으로
닫고, **콘텐츠·커리큘럼 파운데이션 1차 전체가 최종 승인됐다**(2026-09-07).

**Corrective 1 — 학생 운영 커리큘럼 최초 베이스라인**(`75c4dae` + 교재
보완 `e41edee`): `ensure_active_curriculum_overlay()`가 빈 오버레이
껍데기만 만들던 것을, 같은 트랜잭션 안에서 과목 기본 단원 + 단원별
키워드 + **공개(`published`) 상태인 참고 교재만** `source_unit_id` 기준
정확히 매핑해 시딩하도록 확장(draft 교재는 시딩 대상에서 절대 제외).
`subject_enrollment_id` 단위 advisory xact lock + unique 활성 오버레이
제약으로 동시 호출에도 오버레이 1개·베이스라인 1회만 생성됨을 8-way
동시성 통합 테스트로 증명. 시딩 이후 원본(canonical) 단원·교재·키워드
관계가 바뀌어도 이미 만든 학생 베이스라인은 불변임을 별도 테스트로 증명.
**이 스냅샷은 콘텐츠 복제가 아니라 참조(`source_unit_id`)다.**

**Corrective 2 — 키워드 태깅과 공개/확정 상태 분리**(`c70e9ed`,
**승인됨**): 관리자는 draft 교재 섹션·미확정 문제에도 키워드를 태깅할 수
있다(저작 편의 기능, 공개 게이트 아님). unpublish/unconfirm 시 키워드
관계를 삭제하지 않고 보존한다. "선생님이 선택 가능한 콘텐츠인가"는 관계
테이블의 존재 여부가 아니라 **읽기 시점**에 `curriculum_doc_section_
keywords_selectable`/`problem_keywords_selectable` 뷰(security_invoker,
published/confirmed만 통과)로 강제한다.

**경계 확정(제품 오너 승인 기준, 이후 라운드도 이 기준을 따른다)**:
- **관리자 콘텐츠 원본**(`curriculum_docs`/`curriculum_doc_sections`/
  `problems`/`subject_keywords`): 관리자만 생성·수정·공개·확정. draft
  상태에서도 키워드 태깅 가능(저작 편의), 공개/확정 여부와 키워드 관계
  존재 여부는 서로 무관.
- **기본 커리큘럼**(`subject_template_units`/`subject_template_unit_
  materials`/`subject_template_unit_keywords`): 과목의 정본 커리큘럼
  템플릿, 관리자만 관리. 학생 오버레이 생성 시 **참조**되지만 복제되지
  않는다.
- **학생별 운영 커리큘럼**(`student_curriculum_overlays`/`curriculum_
  overlay_units`/`curriculum_overlay_unit_keywords`/`curriculum_overlay_
  unit_materials`): `ensure_active_curriculum_overlay()`가 생성 시점에
  기본 커리큘럼의 공개 콘텐츠만 스냅샷 시딩, 이후에는 담당 선생님의
  추가·제외·재정렬·진도 상태 변경만으로 진화한다. 기본 커리큘럼이나
  콘텐츠 원본이 나중에 바뀌어도 이미 생성된 스냅샷은 소급 변경되지 않는다.
- **선택 가능성(selectability)은 항상 읽기 시점에 published/confirmed
  뷰로 재검증한다** — 관계 테이블의 존재나 오버레이에 이미 들어있다는
  사실 자체를 "지금도 선택 가능하다"의 증거로 쓰지 않는다.

**후속 계획(수업 준비·세션 문제 선택·과제 조립)에 대한 제약(제품 오너
지시, 이번 라운드에 반영해 다음 라운드 착수 기준으로 고정)**:
- 아직 구현 착수하지 않는다 — `docs/superpowers/specs/2026-09-08-
  lesson-prep-session-selection-kickoff.md`에 열어둔 정책 질문 6건은
  기획 확정 대상으로 계속 유지한다(문서를 임의로 확정 짓지 않음).
- 실제 구현 시에는 선택 가능 콘텐츠를 위 selectable view 기준으로만
  불러와야 하고, **세션 콘텐츠 고정(pin) 시점과 과제 출제 시점 각각에서
  다시 한번 공개·확정 상태를 재검증**해야 한다(선택 시점과 고정/출제
  시점 사이에 상태가 바뀔 수 있으므로 단일 검사로 끝내지 않는다).

**미완료로 유지되는 별도 항목**: WhiteboardCanvas Preview UAT(교사·학생
두 브라우저 실측 확인)는 이번 라운드와 무관하게 여전히 미완료 — 진행
가능한 v3 세션·테스트 학생 계정 구성은 제품 오너의 별도 승인 후에만
진행한다(임의로 UAT 계정을 만들지 않는다).

**외부 변경 원칙 복원**: 이 라운드 이후로 non-prod Supabase migration
반영, Vercel Preview 배포, UAT 테스트 계정 생성, 실제 이메일·외부 API
호출은 **제품 오너의 사전 승인 없이는 하지 않는다**(9/7 오후 세션에서
이미 발생한 non-prod push·Preview 배포는 되돌리지 않되, 그 이후로는 이
원칙을 적용한다).

관련 커밋: `44125f0`(Task1) `505d05b`(Task2) `63f5f57`(Task3)
`5bea813`(Task4) `b2bb6d7`(교사 포털 연결) `a0e0f81`(acceptance gate
증명) `75c4dae`(corrective1) `c70e9ed`(corrective2) `56780b2`(docs)
`e41edee`(corrective1 교재 보완). **콘텐츠·커리큘럼 파운데이션 1차 —
제품 오너 최종 승인 완료.**

## 2026-09-08 — 수업 준비·세션 문제 선택·과제 조립 정책 질문 6건 기획 검토용 정리

코드·마이그레이션·외부 변경 없이, 킥오프 문서(`2026-09-08-lesson-prep-
session-selection-kickoff.md` §6)의 정책 질문 6건을 `docs/superpowers/
specs/2026-09-08-lesson-prep-policy-review.md`로 확장 정리했다(각 질문의
발생 시점·선택지별 교사/학생 경험·데이터 무결성·운영 부담·권장안·구현
범위 분기점·기존 정책 충돌 여부). **아직 기획 확정 전 — 이 문서는 답을
확정하지 않고 권장안만 제시한다.** 이 문서의 권장안이 확정되거나 다른
선택으로 정정된 뒤에만 follow-on plan(수업 준비·세션 문제 선택·과제
조립) 구현에 착수한다. 이번 라운드는 non-prod 반영·Preview 배포·UAT
계정 생성·외부 호출 전혀 없음.

## 2026-09-08 — 정책 질문 6건 확정 + follow-on plan 상세 구현 계획 제출(승인 대기)

제품 오너가 위 정책 검토 6건을 아래와 같이 확정(문서만 반영, 코드/마이그레이션 없음):

1. "레슨에서 사용함"은 단일 순간 명시적 기록, 교재 섹션·문제 둘 다 대상, 단순 열람은 미기록.
2. 과제 토글은 "수업 사용 문제 포함"/"학생이 이미 푼 문제 포함" 2개, 각각 독립 설정.
3. 세션 준비는 처음부터 여러 단원·키워드 조합 허용(복습+새 진도 기본 사례). 단원 진도 상태는
   세션 완료로 자동 전이하지 않고 교사 명시적 확정만.
4. 취소·재예약 시 자동 이월 없음 — 대신 **준비 구성을 임시보관함에 보존**하고 교사가 새
   세션에 수동으로 재부착. 세션별 콘텐츠 스냅샷(고정 후) 불변성은 유지.
5. "레슨에서 사용함" 기록은 교사·관리자 전용으로 시작, 학생 노출·복습 화면은 후속 범위.
6. 성능/인덱스는 정책 결정 대상 아님 — 구현 시 실측 근거로 판단.

확정 내용은 `docs/superpowers/specs/2026-09-08-lesson-prep-session-selection-kickoff.md`
§6~7에 반영. 이 결정을 바탕으로 상세 구현 계획
`docs/superpowers/plans/2026-09-08-lesson-prep-session-selection.md`(Task 1~4: 준비
임시보관함/다단원 선택 스키마, pin 시점 selectable view 재검증, "레슨 사용" append-only
이벤트, 과제 조립 write 경로의 issue 시점 재검증 + 두 토글)를 작성해 **승인 대기 상태로
제출**했다. **코드 작업은 이 계획이 승인된 뒤에만 시작한다.** 이번 라운드도 non-prod
반영·Preview 배포·UAT 계정 생성·외부 호출 전혀 없음(문서만).

## 2026-09-08 — 구현 계획 v2: 세션별 immutable 콘텐츠 manifest 보완(승인 대기 유지)

제품 오너 리뷰에서 v1 계획의 Task 1~2가 pin 시점의 콘텐츠 목록을 고정하는 구조 없이
"단원·키워드 선택만 저장 → 세션 화면에서 키워드로 동적 재조회"하는 설계였음을 지적함 —
이 경우 pin 이후 새로 공개된 콘텐츠가 이미 진행된 세션에 섞여 콘텐츠 스냅샷 불변식을
위반할 수 있음. `docs/superpowers/plans/2026-09-08-lesson-prep-session-selection.md`를
v2로 보완(코드 작업은 아직 시작 안 함, 문서만):

- Task 2를 "Pin-time selectable-view re-verification"에서 **"Immutable session content
  manifest"**로 재설계: `pinSessionSelection()`이 selectable view로 재검증 → 통과한 정확한
  목록(콘텐츠 유형·원본 ID·표시 순서·필요시 공개 당시 버전)을 `session_content_manifest`에
  한 트랜잭션으로 동결(freeze) → 그 다음에만 선택을 `pinned`로 표시.
- manifest는 세션이 pinned가 된 뒤로는 INSERT/UPDATE/DELETE/재정렬을 트리거로 전부 차단
  (직접 DB 우회도 차단 대상 — 테스트로 증명 요구).
- 세션 화면은 동적 키워드 조회가 아니라 이 manifest를 읽되, 읽을 때마다 selectable view와
  다시 조인해 이후 공개 취소·미확정된 항목은 교사·학생 모두에게 숨긴다(manifest 자체는
  변경하지 않고 현재 접근 가능 여부만 게이트).
- 필수 테스트 6종 명시: pin 후 신규 공개 콘텐츠 미포함, pin 후 키워드 관계 변경에도 불변,
  pin 후 공개 취소 항목은 숨김(행 자체는 보존), 직접 DB 우회 차단, pin 전 공개취소/미확정
  시 pin 자체 거부(부분 동결 없음), 세션 상태가 scheduled를 벗어나면 pin 차단.

Task 3(레슨 사용 이벤트)·Task 4(과제 조립) 방향은 v1과 동일하게 유지, 다만 Task 3의 사용
이벤트는 이제 "manifest에 존재하는 항목만" 사용 처리 가능하도록 제약이 추가됨. **여전히
코드 작업 시작 전, 계획 승인 대기 상태.** 이번 라운드도 문서만, 외부 변경 전혀 없음.

## 2026-09-08 — 구현 계획 v3: 준비 콘텐츠 명시적 스테이징 + manifest 직접 쓰기 전면 차단(승인 대기 유지)

제품 오너 리뷰에서 v2 계획의 두 가지 gap을 지적함 — (1) 준비 선택에 단원·키워드만 있고
교사가 실제로 고른 교재 섹션·문제 목록 자체가 staged 상태에 명시적으로 저장되지 않음(키워드는
후보를 좁히는 필터일 뿐, pin 대상은 교사가 고른 정확한 콘텐츠여야 함), (2)
`session_content_manifest`가 staged 상태에서도 일반 교사 권한으로 직접 INSERT 가능한 설계였음
(v2는 "pinned되면 차단"이라는 상태 기반 트리거였을 뿐, "애초에 권한 자체가 없음"이 아니었음).
`docs/superpowers/plans/2026-09-08-lesson-prep-session-selection.md`를 v3로 보완(코드 작업은
여전히 시작 안 함):

- Task 1에 `session_prepared_selection_content_items` 신규 — 교사가 키워드로 후보를 좁힌 뒤
  실제로 고른 교재 섹션·문제를 명시적으로 선택·제외(soft, `included=false`)·정렬. 이 목록이
  실제 pin 대상이고, 단원·키워드는 후보를 좁히는 필터·구성 맥락일 뿐 pin 페이로드가 아님.
  콘텐츠를 이 목록에 담을 때 selectable 여부·단원/키워드 스코프 내인지를 INSERT 시점에
  트리거로 검사(선택 불가능하거나 범위 밖 콘텐츠는 애초에 담을 수 없음).
- Task 2의 `pinSessionSelection()`을 `SECURITY DEFINER` 단일 원자 함수로 재정의 — staged +
  included 콘텐츠 목록을 다시 한번 selectable/스코프 검증한 뒤 그 정확한 목록만 manifest로
  복사. **`session_content_manifest`에 대한 일반 역할(교사)의 INSERT/UPDATE/DELETE 권한 자체를
  아예 부여하지 않음**(staged 상태냐 pinned 상태냐와 무관하게 원천 차단 — v2의 "pinned되면
  트리거가 막는다"보다 강한 보장). manifest 쓰기는 오직 이 함수 내부에서만 발생.
- 신규 테스트 4종 추가: 키워드에 맞지만 교사가 고르지 않은(또는 제외한) 항목은 pin 뒤 manifest
  미포함 / staged 콘텐츠가 pin 전 공개취소·미확정되면 pin 전체 거부 + manifest 0건(다른
  유효 항목도 함께 0건, 부분 동결 없음) / staged 상태에서도 일반 교사 권한의 manifest 직접
  INSERT 차단(pinned 이후뿐 아니라 staged 상태에서도 검증) / pin 함수가 선택 목록 밖 항목을
  manifest에 넣지 못함(스코프 내 다른 후보가 있어도).

**여전히 코드 작업 시작 전, 계획 승인 대기 상태.** 이번 라운드도 문서만, 외부 변경 전혀 없음.

## 2026-09-08 — 구현 계획 v4: SECURITY DEFINER 함수 보안 조건 명시(마지막 보완, 승인 임박)

`pinSessionSelection()`이 `SECURITY DEFINER`로 정의되므로(일반 역할에 manifest INSERT 권한
자체가 없어 이 함수만이 유일한 쓰기 경로) 호출자 권한과 무관하게 함수 소유자 권한으로
실행된다는 점을 제품 오너가 지적 — RLS·앱 레이어 가드는 함수 내부에 자동 적용되지 않으므로
함수 본문이 직접 인가를 검증해야 함. `docs/superpowers/plans/2026-09-08-lesson-prep-session-
selection.md`를 v4로 보완(코드 작업은 여전히 시작 안 함):

- 함수 첫 단계(0a~0d)로 명시: `auth.uid()` 확인 → 호출자가 selection의 `teacher_id` 본인이면서
  해당 `subject_enrollment_id`의 활성 담당 교사인지(`is_active_teacher_for_enrollment()` 명시적
  재호출) 검증, 관리자는 `is_admin()`으로 별도 허용 경로 → 전달된 `sessionId`가 그 staged
  selection에 실제 attach된 세션인지 확인 → 세션의 `subject_enrollment_id`와 selection의
  `subject_enrollment_id` 일치 확인. 하나라도 실패하면 manifest 쓰기·상태 변경 전혀 없이 중단.
- 함수는 고정 `search_path`(`public, pg_temp`)로 선언, `EXECUTE` 권한은 `authenticated`에만
  부여하고 `PUBLIC`에서는 명시적으로 회수(Postgres 기본 동작인 `PUBLIC` EXECUTE 부여를 마이그
  레이션에서 되돌림).
- 신규 테스트: 담당 교사(성공)/관리자(성공)/같은 학생이지만 다른 시점 담당이었던 교사(실패,
  manifest 0건)/무관한 교사(실패)/학생(실패)/담당 교사이지만 attach 안 된 세션 전달(실패,
  0c 검증)/세션-selection subject_enrollment_id 불일치 시나리오(실패, 0d 검증)까지 포함한
  전체 권한 매트릭스. `EXECUTE` 권한이 `authenticated`에만 있고 `PUBLIC`엔 없음, `search_path`
  고정 여부도 `information_schema`/`pg_proc` 조회로 확인.

이 보완이 반영되면 제품 오너가 Task 1 착수를 승인하기로 확인함. 이번 라운드도 문서만,
외부 변경 전혀 없음.

## 2026-09-07 — R9 corrective: session_prepared_selection_content_items 단원 출처(provenance) 명시화 + 빈 pin 방지

제품 오너 리뷰가 Task 1/2(`20261232000000_r9_session_prepared_selection.sql`,
`20261233000000_r9_session_content_manifest.sql`) 구현 이후 실제 구멍 하나를 지목: 콘텐츠
pick 당시 "선생님이 어느 단원을 편성하고 있었는지"를 아무 컬럼도 저장하지 않았고, 대신
`check_prepared_content_item_selectable()`와 `pin_session_selection()`의 `source_overlay_unit_id`
도출 둘 다 "이 선택의 아무 단원이나" 키워드 범위가 매칭되면 통과시키고, 매칭되는 여러 단원
중에서는 `order by u.position asc limit 1`로 임의로 하나를 골랐다. 한 선택에 단원이 여러 개이고
같은 콘텐츠가 두 단원의 활성 키워드 범위에 동시에 들어가면(복습 단원 + 새 진도 단원이 키워드를
공유하는 경우), 선생님이 실제로 단원 B를 편성하며 그 콘텐츠를 골랐어도 매니페스트에는 항상
position이 앞선 단원이 출처로 잘못 기록됐다.

추가 마이그레이션(기존 20261232000000/20261233000000은 편집하지 않음):
`supabase/migrations/20261237000000_r9_corrective_content_item_unit_provenance.sql`.

- `session_prepared_selection_content_items`에 필수 FK `prepared_selection_unit_id`
  (→ `session_prepared_selection_units`) 추가. 기존 행은 종전 휴리스틱(order by position limit 1,
  실패 시 첫 단원 폴백)으로 1회성 백필한 뒤 NOT NULL로 잠금(로컬 개발 DB 전용 — 운영 데이터 없음).
- `check_prepared_content_item_selectable()` INSERT 트리거를 확장: (a) `prepared_selection_unit_id`가
  실제로 존재하고 이 콘텐츠 항목과 같은 `prepared_selection_id`에 속하는지, (b) 콘텐츠가 '그 단원만의'
  활성 키워드 범위(다른 단원의 키워드는 보지 않음) 안에서 selectable한지 검사하도록 좁힘. 기존
  거부 동작(selectable하지 않거나 범위 밖이면 거부)은 그대로 유지.
- `pin_session_selection()`의 `source_overlay_unit_id` 도출을 각 스테이징 항목의
  `prepared_selection_unit_id` → 그 단원 행의 `overlay_unit_id`로 가는 직접 조인으로 재작성
  ("order by position limit 1" 완전 제거). 재검증 루프도 각 항목이 지목한 그 단원의 키워드 범위
  안에서만 selectable한지 확인하도록 변경.
- **빈 pin 방지**: `pin_session_selection()` 맨 앞(재검증 루프 이전)에 staged+included 콘텐츠
  항목이 0개면 즉시 실패하는 가드를 추가 — 매니페스트 행 0개, `status` 전이 없음을 보장.
- 앱 코드: `app/teacher/session-prep-actions.ts`의 `pickContentItem()`이 이제
  `preparedSelectionUnitId`를 필수 인자로 받아 INSERT에 넘김(호출자가 "지금 편성 중인 단원"을
  명시). `app/teacher/session-prep-data.ts`의 `PreparedContentItem`에 `preparedSelectionUnitId`
  필드 추가, `attachChildren()` select에 컬럼 반영. `app/teacher/session-prep-actions.test.ts`
  (mocked)의 `pickContentItem` 호출부를 새 시그니처로 갱신.
- 기존 두 통합 테스트 파일(`session-content-manifest.integration.test.ts`,
  `session-prepared-selection.integration.test.ts`)의 모든 `session_prepared_selection_content_items`
  INSERT에 `prepared_selection_unit_id` 컬럼/값을 추가(새 NOT NULL 제약 충족) — 기존 assertion은
  그대로 유지, 값만 보강.

신규 테스트(`app/teacher/session-content-manifest.integration.test.ts`), 4개 요구사항과의 대응:

1. **다중 단원 범위 겹침 명시적 disambiguation** — "두 단원의 활성 키워드 범위가 겹치는 콘텐츠를
   단원2를 편성하며 pick하면, 매니페스트의 source_overlay_unit_id는 정확히 단원2의
   overlay_unit_id다(단원1이 아니다)": 실제로 `sourceOverlayUnitId === secondOverlayUnitId`이고
   `!== firstOverlayUnitId`임을 직접 단언(문자열 정확 일치 비교, 사전 조건으로 두 단원 다 그
   키워드를 갖는지도 별도 확인).
2. **재정렬이 provenance를 소급 변경하지 않음** — pin 전에 두 단원의 `position`을 맞바꾼(단원2를
   1번으로) 뒤 pin해도 `source_overlay_unit_id`는 여전히 `secondOverlayUnitId`(단원의 정체성을
   따름, position 무관)임을 확인. 예전 휴리스틱이었다면 이 재정렬만으로 결과가 바뀌었을 것이라는
   점을 주석으로 명시.
3. **빈 pin 거부** — 콘텐츠 항목 0개인 채로 `pin_session_selection()` 호출 시 에러(`/포함된\(included\)
   콘텐츠가 하나도 없는/`), `status`는 `staged` 유지, `session_content_manifest` 0행을 확인하는
   테스트 2개(항목 자체가 0개인 경우 / 유일한 항목이 `excluded`인 경우).
4. **기존 Task 2 테스트가 새 필수 컬럼과 함께 계속 통과** — 픽스처(`createAttachedStagedSelection`,
   `createStagedSelectionWithUnit`)가 `unitRowId`를 반환하도록 보강하고 모든 콘텐츠 INSERT에
   전달, 기존 22개(+corrective 신규 4개) 및 14개 테스트 전부 통과.

검증: `supabase db reset --local`(클린) → `tsc --noEmit`(클린) → 영향받은 두 파일 단독 실행(fresh
reset 직후, 22/22 + 14/14 통과, 신규 시나리오 4개 개별 확인) → 전체 `vitest run
--no-file-parallelism`을 fresh reset 직후로 2회 반복: 1회차 216 files/1486 tests 전부 통과, 2회차는
기존(이 corrective 이전부터 존재)의 R9 두 통합 테스트 파일에서 `reservations_no_overlap` 배타
제약 충돌로 3개 산발적 실패(테스트 실행 환경의 시각 기반 예약 오프셋 충돌 — 이 corrective가
건드린 어떤 로직과도 무관) — 같은 두 파일을 fresh reset 직후 단독 재실행하면 100% 통과(22/22,
14/14)함을 재확인해 회귀가 아님을 검증. `next build`(클린).

R9 Task 3(사용 처리 이벤트)/Task 4(과제 구성)는 이번에도 착수하지 않음 — 이 라운드는 Task 1/2
corrective 범위로 한정.

## 2026-09-07 — R9 corrective(2차): prepared_selection_content_items의 단원 출처를 UPDATE로도 다른 선택에 못 붙이게 구조적으로 잠금

제품 오너 리뷰에서 위 corrective(`20261237000000`) 자체에 남아있던 실제 구멍을 발견: 새로 추가된
`prepared_selection_unit_id` 컬럼과 `check_prepared_content_item_selectable()` 트리거가
`BEFORE INSERT`에만 걸려 있었다(20261232000000의 트리거 정의를 그대로 재사용 — 함수 본문만
`CREATE OR REPLACE`했을 뿐 트리거 자체는 다시 만들지 않음). `session_prepared_selection_content_items_lock()`
(`BEFORE UPDATE OR DELETE`)은 "부모 선택이 pinned가 아닌가"만 검사할 뿐 어느 컬럼이 바뀌는지는
보지 않는다. 결과적으로 담당 선생님이 자신의 staged 콘텐츠 항목의 `prepared_selection_unit_id`를
완전히 다른 `session_prepared_selections`(다른 선생님/다른 학생/다른 subject_enrollment)의 단원
id로 UPDATE해도 어떤 트리거도 막지 않았고, `pin_session_selection()`은 그 값을 그대로 믿고
`overlay_unit_id`를 매니페스트의 `source_overlay_unit_id`로 복사한다 — 크로스 테넌트/크로스 학생
데이터 유출 가능 지점.

신규 additive 마이그레이션 `supabase/migrations/20261238000000_r9_corrective_content_item_unit_update_guard.sql`
(기존 `20261232000000`/`20261233000000`/`20261237000000`는 직접 편집하지 않음):

1. **복합 유니크 제약**: `session_prepared_selection_units (id, prepared_selection_id)` 추가(`id`가
   이미 PK로 유니크이므로 순수 additive, 기존 동작에 영향 없음) — 복합 FK의 참조 대상이 되기 위한
   전제.
2. **복합 FK**: `session_prepared_selection_content_items (prepared_selection_unit_id,
   prepared_selection_id)` → `session_prepared_selection_units (id, prepared_selection_id)`. 이제
   이 두 컬럼이 서로 다른 선택을 가리키는 조합은 INSERT든 UPDATE든 Postgres 자체가 제약
   위반으로 거부한다(트리거가 아니라 constraint). 기존 단독 FK(`ON DELETE CASCADE` 담당)는
   그대로 유지, 대체하지 않음.
3. **트리거 확장**: `check_prepared_content_item_selectable()` 트리거를
   `BEFORE INSERT OR UPDATE OF prepared_selection_id, prepared_selection_unit_id, content_type,
   content_id`로 재생성(함수 본문은 이미 `new.*` 기준이라 무변경). 이 네 컬럼 중 하나라도 바뀌는
   UPDATE는 INSERT와 동일한 전체 재검증(단원 소속 + 그 단원만의 키워드 범위 내 selectable)을
   다시 받는다.
4. **`pin_session_selection()` 방어적 이중 확인(defense-in-depth)**: 복합 FK가 구조적으로
   막아주더라도, pin 시점에 각 스테이징 항목의 `prepared_selection_unit_id`가 실제로
   `v_selection.id`에 속하는지 함수 자신이 다시 명시적으로 확인한다((0f), FK 하나만 맹신하지
   않음). 불일치 시 매니페스트 0행/status 전이 없이 즉시 실패.

`app/teacher/session-content-manifest.integration.test.ts`에 신규 `describe`
(`corrective(2차) — prepared_selection_unit_id는 UPDATE로도 다른 선택의 단원을 가리킬 수 없다`) 3건 추가:

1. 담당 선생님이 자신의 staged 항목의 `prepared_selection_unit_id`를 완전히 무관한(다른 학생)
   선택의 단원 id로 UPDATE 시도 — `BEFORE` 트리거가 복합 FK 검사보다 먼저 실행되므로 트리거의
   명시적 한국어 에러(`/이 단원은 다른 준비된 선택에 속해 있어 출처로 지목할 수 없습니다/`)가
   먼저 표면화됨을 확인, 값이 실제로 바뀌지 않았음도 재확인.
2. 그 selectable 트리거를 superuser 권한으로 일시 `disable`한 뒤(정상 앱 코드 경로 밖의 하위
   레벨 접근을 흉내내 트리거를 우회) 같은 UPDATE를 시도 — 이번에는 복합 FK 자체가 독립적인
   방어선으로 거부함을 `violates foreign key constraint ...
   session_prepared_selection_content_items_unit_selection_fk` 메시지로 직접 확인(요구된 "SQL
   레벨에서 제약 위반으로 실패시킨다"의 직접 증거 — 이 상태를 만드는 것 자체가 트리거+FK 이중
   방어로 도달 불가능함을 보임). 트리거를 되살린 뒤 정상 pin이 여전히 성공함(매니페스트 1행,
   status='pinned')도 재확인.
3. 단원은 그대로 두고 `content_id`만 그 단원 키워드 범위 밖의 콘텐츠로 바꾸는 UPDATE — 확장된
   트리거가 재검증을 다시 받아 거부됨(`/선택 가능\(published\/confirmed\)하지 않거나 이 단원의
   키워드 범위 밖인 콘텐츠는 담을 수 없습니다/`) 확인 — 요구사항 2(트리거의 UPDATE 확장)가
   실제로 동작함의 증거.

기존 corrective(1차) 테스트(다중 단원 겹침 시 provenance 정확성 2건, 빈 pin 방지 2건 포함
`session-content-manifest.integration.test.ts` 25건 전체) 및 `session-prepared-selection.integration.test.ts`
14건, `session-prep-actions.test.ts` 9건 전부 새 제약/트리거 아래에서도 계속 통과.

검증: `supabase db reset --local`(신규 마이그레이션 1개 포함 전부 정상 적용) → `tsc --noEmit`(클린)
→ 영향받은 세 파일 fresh reset 직후 단독/조합 실행으로 전부 통과(25/25, 14/14, 9/9 — 신규 3건 포함)
확인. **주의**: 이 세 파일을 fresh reset 없이 연달아 재실행하거나 여러 파일을 한 vitest 프로세스에
같이 넣어 실행하면 각 파일의 `reservationOffsetDays` 카운터가 파일별로 독립적으로 2000부터
시작해 서로 다른 파일의 예약 시간대와 겹치거나, 실패한 이전 실행이 정리(`afterEach`)를 못 마친
채 남긴 행과 겹쳐 `reservations_no_overlap` 배타 제약 위반이 산발적으로 발생함을 실측(이번 세
파일 자체의 로직 문제가 아니라 이 저장소에 이미 기록된 기존 known flaky 패턴과 동일 원인) —
fresh reset 직후 1회 실행 기준으로만 판단. 전체 `vitest run --no-file-parallelism`을 fresh
`supabase db reset --local` 직후 1회 실행: **216 files / 1489 tests 전부 통과**(stderr에 보이는
다수의 `ERROR:`/`RAISE` 줄은 여러 다른 스위트의 "이 경우엔 거부돼야 한다" 테스트들이 기대한
psql 에러 출력이며 실패가 아님 — 최종 리포트가 216/216·1489/1489 통과로 확정). `next build` 성공.

R9 Task 3(사용 처리 이벤트)/Task 4(과제 구성)는 이번에도 착수하지 않음 — 이 라운드는 Task 1/2
corrective(2차, UPDATE 시점 단원 출처 잠금) 범위로 한정.

## 2026-09-07 — R9 레슨 준비 Task 3: "사용 처리" 이벤트(교사/관리자 전용, append-only)

계획서(`docs/superpowers/plans/2026-09-08-lesson-prep-session-selection.md`, v4 승인) Task 3만
구현. Task 4(과제 구성)는 이번에도 별도 제품 오너 승인 후 착수한다.

`supabase/migrations/20261234000000_r9_session_content_use_events.sql`:
`session_content_use_events(id, session_id, content_type, content_id, recorded_by, recorded_at)` —
`content_type`은 Task 1이 이미 정의한 `session_prepared_selection_content_type` enum을 그대로
재사용(새 enum 안 만듦). 핵심 제약(이번 라운드 제품 오너가 지목한 구멍) — 대상
`(session_id, content_type, content_id)`가 그 세션의 `session_content_manifest`에 실제로
존재해야만 한다: 앱 레벨 체크가 아니라, `session_content_manifest`가 Task 2부터 이미 갖고 있던
`unique(session_id, content_type, content_id)`를 그대로 겨냥하는 복합 외래키 하나로 DB 레벨에서
강제한다(별도 트리거 불필요 — 자연스러운 FK 재사용). append-only는
`session_annotation_events`(R8)와 동일한 이중 방어 패턴: RLS에 UPDATE/DELETE 정책을 두지 않음
(기본 거부) + role 무관 원천 차단 BEFORE UPDATE/DELETE 트리거. 트리거 bypass GUC
(`app.bypass_content_use_event_lock`)는 annotation_events와 동일한 관례로 테스트/정리 전용 —
앱 코드/RLS 경로로는 어떤 role도 켤 수 없다. RLS: 조회/기록 모두
`is_session_teacher_v3(session_id) or is_admin()`만 허용(기존 R8이 도입한 세션 담당 선생님 판정
헬퍼를 그대로 재사용, 새 인가 메커니즘 없음) — **학생 정책은 아예 두지 않아** 조회/기록 양쪽
모두 RLS 기본 거부로 전혀 접근 불가(annotation_events보다 좁은 경계, 계획서 decision 5).
INSERT 정책은 `recorded_by = auth.uid()`도 강제해 타인 명의 위조 기록을 막는다.

`app/session/[id]/session-content-use-actions.ts`(신규): `markMaterialUsedInLesson(sessionId,
sectionId)`/`markProblemUsedInLesson(sessionId, problemId)` — 이 테이블의 유일한 쓰기 경로.
`annotation-events-actions.ts`의 `appendClearAllEvent`와 동일한 패턴으로 앱 레벨 재인가를 하지
않는다(실제 방어선은 RLS+복합 FK). `requireUser()`로 로그인만 확인.

`app/session/[id]/MaterialTab.tsx`: 이 저장소에 별도 "문제" 탭은 없고(세션 뷰 탭은
material/vocab/homework/docs/log뿐), 문제는 항상 `MaterialTab`의 교재 섹션 안에 임베드되어
표시된다(`material.sections[].problems`) — 계획서의 "material/problem tab 컴포넌트"는 실제로는
이 파일 하나다. 선생님에게만(`viewerRole === "teacher"`) 섹션 제목 옆 + 각 문제 카드 태그 줄
옆에 명시적 "사용 처리" 버튼(`MarkUsedButton`)을 추가 — 클릭 시에만
markMaterialUsedInLesson/markProblemUsedInLesson을 호출한다. 탭을 열거나 스크롤하는 것만으로는
(IntersectionObserver 등 기존 로직 전부 그대로) 절대 호출되지 않는다.

Tests: `session-content-use-events.integration.test.ts`(신규, psql 직접 검증, 8건) —
(1) 교사가 섹션/문제를 사용 처리하면 정확히 1행씩 올바른 content_type/content_id/recorded_by로
기록, (2) 기존 행 UPDATE/DELETE 모두 append-only 트리거가 거부(role 무관, 여전히 1행 잔존),
(3) 학생은 쓰기(RLS 거부)도 읽기(SELECT 정책 없어 0행)도 불가 양방향 모두 확인, (4) 매니페스트를
읽기만 하는 것(탭 열기 시뮬레이션)으로는 이벤트가 0행("봤다 ≠ 사용했다" 회귀 증명), (5) 이
세션의 매니페스트에 없는(다른 키워드로 만든 무관한) 실재 문제를 대상으로 하면 복합 FK 위반으로
거부되고 0행, (6) 매니페스트에 있는 콘텐츠는 관리자도(교사뿐 아니라) 기록 가능 — 그 외 무관한
제3자 선생님 거부/recorded_by 위조 거부 2건 추가. `session-content-use-actions.test.ts`(신규,
mocked, 3건) — content_type 고정 전달, recorded_by를 클라이언트가 아니라 `requireUser()`의
user.id로 고정, DB 에러(예: FK 위반) 그대로 throw. `MaterialTab.test.tsx`에 3건 추가 — 선생님에게
섹션/문제 버튼이 보이고 렌더링만으로는 액션이 호출되지 않음, 클릭해야만 호출됨, 학생에게는
버튼이 아예 안 보임.

검증: `supabase db reset --local`(신규 마이그레이션 1개 포함 전부 정상 적용) → `tsc --noEmit`
클린 → 신규/영향 테스트 fresh reset 직후 개별 실행 전부 통과(8/8, 3/3, MaterialTab 13/13 포함) →
전체 `vitest run --no-file-parallelism`을 fresh `supabase db reset --local` 직후 1회 실행:
**216 files 중 214 passed / 1503 tests 중 1490 passed(8 skipped)** — 실패 5건은 전부
`lib/booking/trial-entitlement-and-cancellation.integration.test.ts`의 `teacher_slot_not_open`
(이 저장소에 이미 반복적으로 기록된 날짜 의존 known flaky, 이번 변경과 무관한 별도 파일 —
docs/CURRENT.md 위 라운드들에서 동일 파일·동일 원인으로 여러 차례 재확인됨). `next build` 성공.

R9 Task 4(과제 구성, 두 개의 독립 포함 토글 + 발급 시점 재검증)는 이번에도 착수하지 않음 — 별도
제품 오너 승인 후.

## 2026-09-08 — 남은 7개 app.bypass_* 처리 방침 확정 + Task 4 착수 승인

R8 annotation bypass corrective(`876b30a`)와 전수 감사 결과를 제품 오너가 승인. 감사에서 발견된
나머지 7개 live bypass(`bypass_session_lock`/`bypass_teacher_rate_protect`/`bypass_invite_protect`/
`bypass_status_protect`/`bypass_consent_protect`/`bypass_reconciliation_task_lock`/
`bypass_trial_session_auto_complete`)는 **한꺼번에 제거하지 않는다** — 다음 기준으로 먼저 분류가
필요하다: (1) 내부 정상 상태 전이(합법적 시스템 함수 자신의 재진입 등)에 실제로 필요한지, (2)
일반 역할이 실제로 도달 가능한지(이번 감사에서는 전부 "불가능"으로 확인됐으나 재검증 필요), (3)
제거 시 어떤 운영 흐름이 깨지는지. **세션 불변식·동의·계정 상태·초대·정산 관련 항목
(session_lock/consent_protect/status_protect/invite_protect/teacher_rate_protect)은 Preview나
non-prod 반영 전에 별도 보안 정리 라운드로 반드시 닫아야 한다** — 이번 라운드에서 조치하지
않았고, 다음 보안 정리 라운드의 범위로 명시적으로 이월한다.

R9 Task 4는 착수 승인됨. 단, **`teacher_slot_not_open` 날짜 의존 테스트 실패는 Task 4 최종
검수 전까지 근본 원인을 고쳐 전체 테스트가 실제로 녹색인 상태를 만들어야 한다** — 단독 실행
실패를 "flaky"로 보고 끝내는 것은 허용되지 않는다(제품 오너 명시).

## 2026-09-08 — R9 corrective: composeHomeworkFromSession() Gap 1/2 (v3 제출 제외 + 재구성 원자성)

`b38fbab`(Gap 1/2 v3 과제 UI + 읽기전용 제출 현황) 이후 제품 오너 재검토로 확인된, Task 4의
`composeHomeworkFromSession()` 자체(`d7f29fa`)에 남아있던 두 가지 진짜 공백을 고쳤다.

**Gap 1 — `includeAlreadyAttempted` 토글이 legacy만 보고 v3 제출을 못 봄.** 종전 구현은
`session_problem_attempts`(legacy)만 조회했다 — `session_homework_attempts`(v3, `2482908`)에
`submitted=true`로 제출된 문제는 여전히 후보 풀에 남아 재출제될 수 있었다. 반면 draft
(`submitted=false`)는 "이미 풀어봄"이 아니므로 계속 후보에 남아야 한다.

제약(제품 오너 지시): 과제를 구성하는 선생님/관리자가 "이 학생이 어떤 problem_id를 제출했는가"만
판별해야지, 다른 세션(다른 담당 선생님)의 실제 답안 원문(`response`)까지 열람 가능해져서는 안
된다. `session_homework_attempts`의 기존 RLS(`2482908`)는 "그 항목이 속한 세션의 담당
선생님"만 조회를 허용하므로, 그대로는 다른 세션에서 제출된 v3 attempt를 지금 이 세션 담당
선생님이 볼 수 없다 — 이 교차-세션 판별 자체가 기존 RLS 밖의 새로운 필요다.

**Gap 2 — 같은 세션 재구성 시 중복/부분실패/동시성.** 재구성이 이미 발급된 problem_id를 후보에서
빼지 않아 `(session_id, problem_id)` 유니크 제약을 건드리면 요청 전체가 실패했다. 게다가
"후보 조회 → 삽입"이 앱 레이어의 여러 왕복 요청(`.from()` 호출 여러 번)으로 나뉘어 있어 동시
호출(더블클릭, 두 관리자 탭) 사이에 원자성이 없었다 — SELECT와 INSERT 사이 gap에 다른 요청이
끼어들어 중복/position 충돌/부분 기록이 가능했다.

**해결(마이그레이션 `20261250000000_r9_corrective_atomic_compose_homework.sql`):**
후보 조회부터 삽입까지 전부를 단일 SECURITY DEFINER 함수 `compose_homework_from_session(
p_session_id, p_keyword_ids, p_count, p_include_used_in_lesson, p_include_already_attempted)`
하나로 묶었다 — Task 4 자체 설계(이미 SECURITY DEFINER 트리거로 confirmed 게이트를 두는 등
DB 레벨 방어를 쓰는 아키텍처)에 가장 잘 맞는 확장이라 판단해, 앱 레이어에 새 왕복 요청을 추가하는
대신 이 함수 내부에서 직접 `session_homework_attempts`를 join했다(프롬프트가 제시한 두 대안 중
(b)). 함수 하나의 호출은 하나의 트랜잭션이라 그 자체로 원자적이고(전부 성공 또는 전부 롤백),
`pg_advisory_xact_lock(hashtext(session_id))`로 같은 세션에 대한 동시 호출만 직렬화한다(다른
세션의 동시 구성은 서로 막지 않음) — SELECT 이후 INSERT 사이의 gap에 다른 트랜잭션이 끼어들 수
없다. 인가는 새 프리미티브를 만들지 않고 기존 `is_active_teacher_for_enrollment()`/`is_admin()`
(`20261229000000`, student-curriculum-actions.ts의 `requireAssignedTeacherOrAdmin`과 동일한
판정)을 그대로 재사용한다 — 이 함수가 SECURITY DEFINER라서 이 검사가 유일한 실제 방어선이다.

Gap 1의 최소 노출은 이 함수 안에서 `session_homework_items` ⋈ `session_homework_attempts`를
`problem_id`만 select하는 CTE로 구현했다 — `response` 컬럼은 이 함수 어디에서도 select하지
않는다. Gap 2의 재구성 제외는 "이 세션에 이미 발급된 problem_id" CTE로 후보에서 뺀다(누가
언제 구성했든). position은 세션 내 기존 최댓값(`v_start_position`, 락 획득 이후 조회라
동시성 안전) 다음부터 이어서 매긴다. 요청한 `count`보다 후보가 적으면 `issued_count <
requested_count`를 정직하게 반환한다 — 조용히 성공한 척하지 않는다.

앱 레이어(`app/teacher/homework-composition-actions.ts`)는 이 RPC를 부르는 얇은 래퍼로
바뀌었다: 반환 타입이 `string[]`에서 `{ issuedProblemIds, requestedCount, issuedCount }`로
바뀌었고(하위 호환 깨는 의도적 변경 — 정직한 개수 신호를 UI까지 전달하기 위함),
`HomeworkTab.tsx`의 "이 세션에서 과제 구성" UI가 `issuedCount < requestedCount`일 때
"요청 N개 중 M개만 발급되었습니다(후보 부족)"를 명시적으로 보여준다.

Tests: `app/teacher/homework-composition.integration.test.ts`에 4개 시나리오 추가(psql 직접
DB 검증, `d7f29fa`/`2482908`이 이미 쓰던 패턴 재사용) —
(1) 세션 A에서 제출 완료(submitted=true)된 문제는 새 세션 B 재구성 시 기본값(둘 다 끔)에서
`issuedProblemIds`에 없고 `issuedCount=0`, `includeAlreadyAttempted=true`로 켜면
`issuedProblemIds`에 포함되고 `issuedCount=1`로 재등장 확인 + legacy
`session_problem_attempts` 경로 회귀 확인 1건 추가,
(2) 초안(submitted=false)만 있는 문제는 기본값(끔)에서도 `issuedProblemIds`에 포함, `issuedCount=1`,
(3) 후보 2개짜리 세션에 count=1로 먼저 구성(`issuedCount=1`, position=1) 후 같은 세션에
count=5로 재구성하면 첫 번째로 뽑힌 problem_id는 다시 뽑히지 않고 나머지 하나만
`issuedCount=1`·position=2로 발급, 총 행 수 2/distinct problem_id 2 확인, 후보 소진 후
세 번째 호출은 `issuedCount=0`을 정직하게 반환(요청한 개수인 척하지 않음) 확인,
(4) 후보 3개짜리 세션에 대해 `Promise.all`로 실제 두 개의 별도 psql 프로세스를 동시 실행,
합쳐서 정확히 3개만 발급되고(`resultA.issuedCount + resultB.issuedCount === 3`) 중복
problem_id 0건(`new Set(allIssuedIds).size === 3`), DB의 최종 행 수 3/distinct problem_id
3/distinct position 3, position이 정확히 "1,2,3"으로 충돌 없이 이어짐을 확인.
`homework-composition-toggles.test.ts`는 로직이 SQL로 이동함에 따라 "RPC를 올바른 인자로
호출하고 응답을 정직하게 매핑하는가"만 가짜 클라이언트로 검증하도록 재작성(4건).
`homework-composition-actions.test.ts`의 빈 결과 케이스도 새 반환 타입에 맞춰 갱신.

검증: `supabase db reset --local`(신규 마이그레이션 정상 적용) → 영향 테스트 3개 파일 개별 실행
19/19 통과(위 4개 시나리오 포함) → `tsc --noEmit` 클린 → 전체 `vitest run --no-file-parallelism`을
fresh `supabase db reset --local` 직후 연속 2회 실행: **1회차 226 files/1564 tests 전부 통과,
2회차도 226 files/1564 tests 전부 통과** — `teacher_slot_not_open` 등 이전에 기록됐던 날짜
의존 flaky는 이번 두 번 모두 재현되지 않았다(0 실패). `next build` 성공.

이것으로 R9 레슨 준비 계획(Task 1-4) 전체가 제품 오너 최종 승인 대기 상태다.

## 2026-09-08 — 콘텐츠·커리큘럼 파운데이션 + 레슨 준비 계획(v4) 전체 최종 승인, 범위 마감

**최종 승인 완료.** 콘텐츠·커리큘럼 파운데이션 1차(2026-09-07)에 이어, 수업 준비·세션 문제
선택·과제 조립 계획(`docs/superpowers/plans/2026-09-08-lesson-prep-session-selection.md`, v4)의
Task 1~4와 그 사이 발견된 모든 corrective가 제품 오너 최종 승인을 받았다.

**완료 범위 요약**(관련 커밋 `44125f0`~`72a7a18`, 총 30여 개):
- **콘텐츠 파운데이션**: 과목별 키워드 사전 + 단원/섹션/문제 관계, 공개·확정 콘텐츠만 선택
  가능(읽기 시점 selectable view로 강제, 관리자 태깅은 draft에도 허용), 학생별 운영 커리큘럼
  오버레이(복제 아닌 참조, 생성 시 공개 교재까지 원자적 베이스라인 시딩), 세션 내 AI 문제 생성
  완전 제거.
- **세션 준비(Task 1)**: 준비 임시보관함(취소 시 삭제 대신 detach), 다단원·단원별 키워드 범위
  선택, 교사가 명시적으로 pick/exclude/order한 실제 콘텐츠 목록(키워드는 필터일 뿐 pin
  페이로드 아님), composite FK로 콘텐츠-단원-selection 삼자 정합성 구조적 강제.
- **세션 콘텐츠 manifest(Task 2)**: `pinSessionSelection()`(SECURITY DEFINER, 자체 인가 0a~0e
  전수 검사) 단일 원자 함수만 manifest를 쓸 수 있음(일반 role은 INSERT/UPDATE/DELETE 권한
  자체가 없음). pin은 그 시점 selectable 재검증 후 스냅샷 동결, 이후 신규 공개·키워드 변경에도
  불변. 표시 시점엔 별도로 공개·확정 상태를 다시 게이트(행 자체는 안 바뀜).
- **레슨 사용 이벤트(Task 3)**: manifest에 실제 존재하는 항목만(복합 FK) 교사 명시적 조작
  1회당 1행, append-only, 교사·관리자 전용(학생 접근 불가).
- **과제 조립(Task 4)**: 발급 시점 재검증(태깅 후 unconfirm된 문제 자동 제외), "수업 사용"/
  "이미 풀어봄"(legacy+v3 제출 모두, 답안 원문 미노출) 두 토글 독립 제어, 같은 세션 재구성 시
  기존 발급 문제 제외, advisory lock으로 동시 구성 안전, 후보 부족 시 발급 수 정직하게 반환.
  학생 포털에 실제 응답 UI(객관식 선택지/서술형 입력, 제출 후 읽기전용) 및 교사·관리자용
  읽기전용 제출 현황 화면까지 연결.
- **보안 corrective**: 이번 계획 진행 중 동일 계열의 "설정 가능한 GUC bypass가 append-only/
  불변 트리거를 무력화하는" 취약점을 4곳(`session_prepared_selections`, `session_content_use_events`,
  `session_annotation_events`(R8, 기존 승인분), 그리고 감사로 발견한 7곳 추가)에서 발견,
  그중 3곳은 이번에 완전 제거, 나머지 7곳(`bypass_session_lock`/`bypass_teacher_rate_protect`/
  `bypass_invite_protect`/`bypass_status_protect`/`bypass_consent_protect`/
  `bypass_reconciliation_task_lock`/`bypass_trial_session_auto_complete`)은 분류 후 별도
  보안 정리 라운드로 명시적으로 이월(위 2026-09-08 절 "남은 7개 app.bypass_* 처리 방침" 참고).

**후속 항목(다음 라운드로 이월, 이번 범위 아님)**:
1. **보안 정리 라운드**: 위 7개 live `app.bypass_*` GUC — 특히 세션 불변식·동의·계정 상태·
   초대·정산 관련(`session_lock`/`consent_protect`/`status_protect`/`invite_protect`/
   `teacher_rate_protect`)은 Preview/non-prod 반영 전 반드시 닫아야 함(제품 오너 명시).
2. **WhiteboardCanvas Preview UAT**: R9 화이트보드 연결(교사·학생 두 브라우저 실시간 반영,
   재접속 replay, clear-all 권한) 실측 확인 여전히 미완료 — 진행 가능한 v3 세션·UAT 계정
   구성은 제품 오너 별도 승인 후에만.
3. **학생 노출 확장**: "레슨 사용" 기록의 학생 노출·복습 화면(현재 교사·관리자 전용으로 확정,
   확장은 후속 범위).
4. **레거시 화이트보드 백필**: 읽기 호환만 유지 중, 백필 계획 없음(의도적).
5. R9 kickoff 문서(`docs/superpowers/specs/2026-09-08-lesson-prep-session-selection-kickoff.md`)
   §6 확정 이후 새로 열린 세부 판단(예: v3 답안 JSON 모양 `{type,...}`)은 이미 확정 반영됨,
   추가 정책 질문 없음.

**외부 변경 원칙**: 계속 유지 — non-prod migration 반영, Vercel Preview 배포, UAT 테스트
계정 생성, 실제 외부 API/이메일 호출은 제품 오너 사전 승인 없이 진행하지 않는다.

## 2026-09-08 — `bypass_reconciliation_task_lock` 계획 5차 개정: supersede 전이 action 값 분리 (계획/문서 전용)

제품 오너 리뷰에서 배치 2-3(`bypass_reconciliation_task_lock`) 상세 계획이
`resolve_session_reconciliation_task()`의 `needs_review` 전이와
`recomplete_session()`의 `superseded` 전이(재판정 시 이전 pending 대사 작업 무효화)를
같은 토큰 action 값(`'reconciliation_task_needs_review'`)으로 공유하도록 설계했던
점을 지적 — 값 레벨에서 두 전이를 구분하지 못하면 트리거 구현 실수로 한 전이의
토큰이 다른 전이까지 열어줄 위험이 있다는 지적을 반영해, `docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md`를
5차 개정: `superseded` 전용 action 값 `'reconciliation_task_supersede'`를 신설하고
(총 4개 action 값으로 확정: `resolve`/`needs_review`/`supersede`/`set_disposition`),
`recomplete_session()`의 다건 UPDATE 특성(대상 pending 행 각각에 토큰 1건씩 필요)과
동시성 테스트를 위한 `for update` 추가 필요성을 명시. 필수 테스트 목록에
"직접 supersede 위조 차단(다른 action 토큰으로는 열리지 않음 포함)"과 "동시
재판정/반영 경합" 시나리오를 구체화해 추가.

**코드/마이그레이션 변경 없음 — 계획 문서만 개정.** 동시에 진행 중이던 배치 2-1
(`bypass_status_protect`, `supabase/migrations/20261256000000_r2_corrective_status_protect_token.sql`
작업 중)과는 무관한 별도 절이며 그쪽 파일은 손대지 않았다.

**결정 필요(제품 오너 확인 대기)**: 배치 2-3의 "동시 재판정/반영 경합" 테스트에서
`recomplete_session()`(supersede 시도)과 `resolve_session_reconciliation_task()`
(resolve 시도)가 같은 대사 작업 행을 두고 경합할 때 어느 쪽이 이겨야 하는지(우선순위)는
이 문서가 아직 확정하지 않았다 — `for update` 잠금으로 "둘 다 성공"이나 "애매한 상태"는
막히지만, 어느 쪽을 우선할지는 제품 정책 판단이 필요.

## 2026-09-08 — `claim_account_invite()` 기존 Auth 계정 분기 회귀 테스트 추가 (테스트 전용)

`app/admin/account-invite-protect-token.integration.test.ts`에 제품 오너가 지정한
정확한 시나리오 2건을 추가: ⑩ 초대 이메일과 같은 기존 `auth.users` 행이 있을 때
익명 `claim_account_invite()` 호출 → `account_invites.status`가 `manual_review`로
정확히 전이, `account_invite_events`에 `event_type = 'manual_review'` 이벤트가
정확히 1건, 해당 초대의 `status_transition_tokens` 잔존 0건을 확인. ⑪ 같은
토큰으로 재시도 → 코드를 직접 읽어 확인한 실제 동작(비-`pending`·비-`accepted`
상태는 `raise exception '%', v_row.status` 분기를 타 상태 문자열을 담은 명시적
예외를 던짐, corrective가 손대지 않은 기존 로직)을 그대로 검증 — 새 토큰/이벤트
없음, 상태는 `manual_review`로 그대로 유지.

테스트 전용 변경만 있었다: 기존 `claim_account_invite()` 함수의 기존 Auth 계정
분기(`20261258000000_r2_corrective_invite_protect_token.sql`)는 코드를 읽어
확인한 결과 이미 요구된 대로 동작하고 있었다 — 코드/마이그레이션 변경 없음.
`app/admin/account-invite-protect-token.integration.test.ts`의 `insertInvite()`에
선택적 `email` 오버라이드 파라미터를, 그리고 기존 `createParent()`와 동일한
`auth.users` INSERT 패턴을 재사용하는 `createAuthUserWithEmail()` 헬퍼를 추가한
것 외에는 프로덕션 코드에 손대지 않았다.

검증: `supabase db reset --local` → 대상 파일만 실행 시 18/18 통과(기존 16 +
신규 2). `tsc --noEmit` 클린. `db reset` → 전체 스위트(`--no-file-parallelism`)
2회 연속 실행: 두 번 다 230 test files / 1623 tests 전부 통과, 실패 0.
`next build` 성공.

**결정 필요**: 없음 — 재시도 시나리오의 실제 동작이 명시적 예외(모호하지 않음)로
확인되어, 이전에 우려했던 "침묵/모호한 결과"는 실제로 발생하지 않는다.

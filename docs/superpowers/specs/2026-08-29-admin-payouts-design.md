# 086-admin-payouts-tab: 관리자 정산 탭 — 설계

> **문서 상태: 과거 설계 이력.** 신규 정산은 v3의 시급·통화·분 단위 payout item 및 batch 정책이 우선한다.

## 배경

관리자 포털 "정산" 탭은 아직 "준비 중" 상태다. `teacher_payouts` 테이블(`teacher_id`, `amount_krw`, `period_start`, `period_end`, `status`(pending/approved/paid), `wise_transfer_id`, `approved_by`, `paid_at`)은 이미 스키마에 있지만 아무 코드도 이걸 쓰지 않는다.

이번 스코프는 **Wise 자동 송금 API 연동을 제외**한다. 관리자가 은행/Wise로 직접 수기 송금하고, 우리 시스템은 "얼마를 줘야 하는지 계산해서 보여주고, 언제 지급됐는지 기록하는" 역할만 한다.

## 정산 금액 계산

- **시급 × 완료된 수업 시간(분/60)**. 선생님마다 시급이 다를 수 있어 `teachers.hourly_rate_krw`(신설 컬럼, 원 단위 정수)를 기준으로 계산한다.
- "완료된 수업 시간"은 `sessions.status = 'completed'`인 세션들의 `duration_minutes` 합계다. 이 값은 Calendly 예약 웹훅(`app/api/webhooks/calendly/route.ts`)이 **예약 당시** 시작/종료 시각으로 딱 한 번 계산해 저장하고 이후 절대 갱신되지 않는 값이라, "실제로 몇 분 늦게 끝났는지"와 무관하게 항상 처음 합의된 시간이 유지된다 — 별도 로직 없이 이 필드를 그대로 합산하면 요구사항(합의된 시간 기준 지급, 실제 진행 시간과 무관)이 자동으로 충족된다.
- 계산식: `amount_krw = round(hourly_rate_krw * (해당 기간 완료 세션 duration_minutes 합계) / 60)`

## 시급 — 필수값, 선생님 초대 시점에 입력

- `teachers.hourly_rate_krw int` 컬럼 신설(마이그레이션 — 기존 선생님들은 NULL로 남음, DB 레벨 NOT NULL 제약은 걸지 않는다).
- 선생님 초대 폼(`UsersTab.tsx`의 `+ 초대`, 선생님 서브탭)에 "시급(원)" 입력 필드 추가 — 필수, 1 이상의 정수만 허용. `inviteTeacher` 서버 액션이 이 값을 받아 `teachers.hourly_rate_krw`에 함께 저장한다. 이제부터 새로 초대되는 선생님은 예외 없이 시급이 채워진다.
- 기존에 이미 초대된 선생님(시급 NULL)은 `TeacherDetailPanel`에 새 "시급" 입력 필드를 추가해 관리자가 나중에 채워 넣을 수 있게 한다(기존 Calendly URL 설정과 같은 패턴 — `setTeacherHourlyRate` 서버 액션).
- 정산 자동/수동 생성 시 시급이 NULL인 선생님은 계산에서 제외하고, 관리자에게 "N명 시급 미설정으로 건너뜀(이름 목록)" 안내를 보여준다.

## 생성 흐름

1. **매월 1일 0시(KST) 자동 생성**: 전월 1일~말일 동안 완료된 세션을 선생님별로 집계해 시급이 설정된 모든 선생님에 대해 `teacher_payouts` 행을 생성한다(상태: `pending`). Vercel Cron(`vercel.json`)으로 매달 1일 실행되는 API 라우트(`/api/cron/generate-payouts`)에서 처리.
2. **수동 생성(보조 경로)**: 관리자가 정산 탭에서 날짜 범위(기본값: 전월)를 지정해 "정산 생성" 버튼을 누르면 같은 계산을 즉시 실행한다. 이미 그 선생님·기간 조합으로 생성된 `teacher_payouts` 행이 있으면 건너뛴다(중복 방지 — `teacher_id` + `period_start` + `period_end` 조합으로 존재 여부 확인).
3. **관리자가 정산 탭에서 목록 확인**: 선생님별로 대기 중(`pending`)인 정산 금액·기간이 표에 뜬다. 관리자가 그 정보를 보고 은행/Wise로 **직접 수기 송금**한다.
4. **완료 처리**: 개별 "승인" 버튼 또는 "전체 승인" 일괄 버튼을 누르면 그 정산 행이 즉시 `status='paid'`, `paid_at=now()`, `approved_by=관리자 id`로 바뀌고, 해당 선생님에게 "정산이 완료됐습니다" 이메일이 발송된다(기존 073의 `lib/email.ts` 재사용). 스키마의 `approved` 상태값은 이번 스코프에서 쓰지 않는다(수기 송금은 승인 누르는 시점엔 이미 끝나 있으므로 대기→완료 2단계로 충분).
5. **완료 취소**: 실수로 승인을 눌렀을 때 `pending`으로 되돌리는 버튼. `paid_at`/`approved_by`를 지운다. 되돌릴 때는 알림을 다시 보내지 않는다.

## 권한

관리자 전용. `teacher_payouts` RLS는 이미 `is_admin()` 전체 권한이 최초 스키마부터 열려 있어 새 정책 불필요(선생님 자신의 정산 열람 권한도 이미 있으나, 선생님 포털에 정산 내역을 보여주는 화면은 이번 스코프 밖 — 필요해지면 별도 확인).

## 컴포넌트

| 파일 | 역할 |
|---|---|
| `supabase/migrations/xxx_teachers_hourly_rate.sql` | `teachers.hourly_rate_krw` 컬럼 추가 |
| `app/admin/payouts-data.ts` (신규) | 정산 목록 조회, 정산 계산 함수(`computePayoutAmounts(supabase, periodStart, periodEnd)`) |
| `app/admin/payouts-actions.ts` (신규) | `generatePayouts(periodStart, periodEnd)`, `markPayoutPaid(id)`, `markPayoutsPaidBulk(ids)`, `revertPayoutToPending(id)`, `setTeacherHourlyRate(teacherId, rate)` |
| `app/admin/PayoutsTab.tsx` (신규) | 정산 탭 UI |
| `app/admin/UsersTab.tsx` | 선생님 초대 폼에 시급 필드 추가, `inviteTeacher` 호출부 수정 |
| `app/admin/users-actions.ts` | `inviteTeacher`가 `hourlyRateKrw` 파라미터를 받아 저장 |
| `app/admin/TeacherDetailPanel.tsx` | 시급 수정 필드 추가(기존 선생님 백필용) |
| `app/api/cron/generate-payouts/route.ts` (신규) | Vercel Cron이 매달 1일 호출하는 엔드포인트 — `generatePayouts`를 전월 범위로 실행 |
| `vercel.json` (신규 또는 수정) | cron 스케줄 등록 (`0 0 1 * *`) |

## 에러 처리

- `generatePayouts`가 특정 선생님 처리 중 실패해도 나머지 선생님 처리는 계속 진행하고, 실패한 선생님 목록을 결과에 담아 반환한다(하나 실패했다고 전체가 안 만들어지면 안 됨).
- cron 라우트는 관리자 세션이 없는 상태로 호출되므로 service_role 클라이언트(`lib/supabase-admin.ts`)를 쓴다. Vercel Cron 요청 검증은 `CRON_SECRET` 환경변수로 확인(Vercel이 자동으로 `Authorization: Bearer $CRON_SECRET` 헤더를 붙여줌).

## 테스트

- `payouts-data.ts`의 계산 함수: 시급 있는/없는 선생님 섞인 경우, completed 세션만 집계하는지, 소수점 반올림.
- `payouts-actions.ts`: 생성 시 중복 스킵, `markPayoutPaid`/`revertPayoutToPending` 상태 전환 + 알림 이메일 호출 여부(승인만 보내고 취소는 안 보내는지).
- `PayoutsTab.tsx`: 목록 렌더링, 개별/전체 승인, 완료 취소 버튼.
- cron 라우트: `CRON_SECRET` 불일치 시 401.

## 스코프 밖

- Wise API 자동 송금 — 후속 티켓.
- 선생님 포털에서 본인 정산 내역 열람 화면.
- 정산 명세서(PDF 등) 다운로드.

-- R3 (Step 2 후속, 신규 additive 마이그레이션) — 상담 취소/노쇼를 완료(closed)와
-- 구분해 기록한다.
--
-- 배경: v3_consultation_status(20260912000000)는 requested→scheduled→completed→
-- trial_planned→trial_completed→proposed→contracted→converted, 조기 종료 시
-- closed만 있다. trial_sessions.v3_trial_status는 student_cancelled/
-- student_no_show/teacher_cancelled/teacher_no_show를 이미 구분하는데, 상담
-- 쪽은 취소와 노쇼를 구분할 상태값도, 사유/시각을 남길 컬럼도 없다. 로드맵이
-- 명시적으로 "예약·취소·재예약·노쇼"를 상담 단계의 별도 동작으로 요구하므로
-- (트라이얼 세션과 동일한 패턴), 이 구분이 없으면 관리자가 취소/노쇼 이력을
-- 구별해 조회할 수 없다 — 이는 "있으면 좋은" 것이 아니라 요구된 기능이 막히는
-- 진짜 blocker로 판단해 최소 additive 컬럼/enum 값만 추가한다.
--
-- 순수 additive: 기존 컬럼/enum 값은 건드리지 않는다.

alter type v3_consultation_status add value if not exists 'cancelled';
alter type v3_consultation_status add value if not exists 'no_show';

alter table consultations add column if not exists cancelled_at timestamptz;
alter table consultations add column if not exists cancellation_reason text;
alter table consultations add column if not exists no_show_at timestamptz;

comment on column consultations.cancelled_at is 'R3 추가(20260914): 상담 취소 처리 시각. cancelConsultation 서버 액션이 채운다.';
comment on column consultations.cancellation_reason is 'R3 추가(20260914): 상담 취소/노쇼 사유(자유 텍스트).';
comment on column consultations.no_show_at is 'R3 추가(20260914): 상담 노쇼 처리 시각. markConsultationNoShow 서버 액션이 채운다.';

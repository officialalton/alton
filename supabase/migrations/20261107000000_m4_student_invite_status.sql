-- M4 후속 — 학생 본인 비밀번호 설정 초대(보호자 대상 "체험 온보딩 안내"와는
-- 다른, 학생 계정 생성 직후 lib/trial-onboarding-finalize.ts가 보내는 이메일)의
-- 발송 성공/실패 상태를 저장한다. 지금까지는 실패해도 console.error만 남기고
-- 계정 레코드에는 아무 흔적이 없어 관리자가 실패를 알 방법이 전혀 없었다.
-- notice_delivery_status(20261018000000, 보호자 안내 이메일)와 같은 패턴을
-- 학생 초대 이메일에도 그대로 적용한다.
alter table trial_onboarding_links add column student_invite_status text not null default 'pending'
  check (student_invite_status in ('pending', 'sent', 'failed'));
alter table trial_onboarding_links add column student_invite_sent_at timestamptz;
alter table trial_onboarding_links add column student_invite_error text;

comment on column trial_onboarding_links.student_invite_status is
  'M4 후속: 학생 본인에게 가는 비밀번호 설정 초대 이메일(lib/trial-onboarding-finalize.ts)의 발송 상태. pending=아직 시도 전(계정 생성 자체가 아직 안 됨), sent=발송 성공, failed=발송 실패(관리자가 같은 계정으로 재발송 가능, 신규 계정 생성 아님).';
comment on column trial_onboarding_links.student_invite_error is
  'M4 후속: student_invite_status=failed일 때의 오류 메시지(관리자 화면 노출용).';

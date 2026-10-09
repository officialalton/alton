-- 2026-09-24(Section 2 — SECURITY DEFINER 3차 감사, 위험도 3순위: 결제·정산·
-- 상태 변경 그룹) — 상담/체험/과제/모의고사/예약 재조정/과목 삭제 등 상태
-- 변경 함수 25개를 실측 재현·호출부 대조로 개별 검증.
--
-- 23개는 전부 제대로 인가돼 있었다(is_admin()/is_master_admin(), 본인
-- auth.uid() 소유 확인, teaches_student()/is_guardian_of() 등 관계 확인 —
-- 각각 "무엇을 바꾸는가"와 "누가 바꿀 수 있어야 하는가"가 실제로 일치하는지
-- 확인함).
--
-- **실제 결함 2건 확인**:
-- (1) finalize_trial_onboarding_students(link_id, new_guardian, guardian_auth_
--     user_id, name, students jsonb, claim_id) — auth.uid() 검사가 전혀 없고
--     호출자가 household를 만들 guardian_auth_user_id를 직접 지정한다.
--     link_id+claim_id 검증이 유일한 보호막인데, 유일한 실제 호출부
--     (lib/trial-onboarding-finalize.ts)는 admin(service_role) 클라이언트로만
--     부르고 guardian_auth_user_id도 그 파일 자신이 만든 값만 쓴다 —
--     anon/authenticated 권한은 순수 과잉.
-- (2) schedule_reservation_notifications(reservation_id) — 내부 인가 검사가
--     없고, 앱 코드( app/**, lib/**) 어디서도 직접 호출하지 않는다 — 전부
--     다른 SECURITY DEFINER 함수 안에서 PERFORM으로만 쓰인다(그 호출은 함수
--     소유자 권한으로 실행되므로 anon/authenticated 권한이 원래 필요 없다).
--     anon이 임의 reservation_id로 직접 호출하면 그 예약의 학생·보호자에게
--     "정규수업이 예약되었습니다" 알림을 반복 주입할 수 있었다(스팸/사회공학
--     벡터, 실제 예약 상태 변경은 없음).
--
-- 둘 다 실제 호출 경로가 없거나 admin 클라이언트뿐이라 정상 흐름 영향 없이
-- anon/authenticated 회수, service_role만 남긴다.
revoke execute on function public.finalize_trial_onboarding_students(uuid, boolean, uuid, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.finalize_trial_onboarding_students(uuid, boolean, uuid, text, jsonb, uuid) to service_role;
revoke execute on function public.schedule_reservation_notifications(uuid) from public, anon, authenticated;
grant execute on function public.schedule_reservation_notifications(uuid) to service_role;

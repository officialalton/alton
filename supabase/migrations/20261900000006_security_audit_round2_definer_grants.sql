-- 2026-09-24(보안·데이터 수명 2차 감사, Section 2) — 1차 감사(20261900000001~3)에서
-- "PUBLIC(=X) 권한 보유, 실측 재현은 이번 범위 밖"으로 남겨둔 85개 후보를 이어서
-- 점검했다. 방법은 1차와 동일: pg_proc에서 SECURITY DEFINER + anon 실행권한 전수
-- 조회(139개) → 함수 본문에 auth.uid()/is_admin()/raise exception 등 내부 인가
-- 패턴이 없는 21개 추출 → app/**·lib/** 실제 호출부 대조.
--
-- **실제 결함 1건 확인(exploit 성립)**: issue_consult_consent_token(p_consultation_id,
-- p_token_plain, p_ttl_hours) — 내부 인가 검사가 전혀 없고, 호출자가 consultation_id와
-- p_token_plain(평문 토큰)을 **둘 다 직접 지정**한다. anon이 임의 consultation_id로
-- 이 함수를 직접 호출하면 자기가 고른 평문 토큰으로 그 상담의 동의 확인 토큰을 새로
-- 발급할 수 있고, 그 토큰으로 resolve_consult_consent_token/confirm_consult_consent_by_token
-- 을 호출해 남의 상담 동의를 대신 확인 처리할 수 있었다(consult_consent_tokens에
-- INSERT만 하고 UNIQUE 제약이 없어 기존 토큰을 무효화하지도 않음 — 원 토큰도
-- 계속 유효한 채로 공격자 토큰이 추가됨). 유일한 실제 호출부(lib/consultation/
-- calendar-sync.ts)는 admin(service_role) 클라이언트만 쓴다.
--
-- 나머지 20개는 실제 앱 호출부가 전부 session 클라이언트(authenticated 역할) 또는
-- admin 클라이언트(service_role)를 통해서만 부르고, 브라우저가 anon 키로 이 RPC를
-- 직접 호출하는 경로는 없었다 — anon 실행권한은 순수 과잉이었다(1차의
-- find_possible_duplicate_consultations/hold_entitlement와 같은 패턴). 정상 흐름에
-- 영향 없이 anon/PUBLIC만 회수한다(authenticated로 호출되는 것들은 authenticated
-- 유지, admin 클라이언트로만 호출되는 것들은 authenticated도 회수).

-- 1) 심각 — 자기 지정 토큰으로 남의 상담 동의를 발급받을 수 있던 결함. 유일한
--    호출부가 service_role뿐이라 service_role만 남긴다.
revoke execute on function public.issue_consult_consent_token(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.issue_consult_consent_token(uuid, text, integer) to service_role;

-- 2) admin 클라이언트(service_role)로만 호출되는 것들 — authenticated도 회수.
revoke execute on function public.find_consultant_provisioning_for_identity(text) from public, anon;
revoke execute on function public.find_teacher_provisioning_for_identity(text, text) from public, anon;
revoke execute on function public.log_workspace_link_rejected(text) from public, anon;
revoke execute on function public.get_teacher_activation_checklist(uuid) from public, anon;
revoke execute on function public.cancel_reservation_notifications(uuid) from public, anon, authenticated;
revoke execute on function public.refresh_teacher_onboarding_completed_at(uuid) from public, anon, authenticated;
revoke execute on function public.list_open_consult_slots(timestamptz, timestamptz) from public, anon;
-- claim_id로 이미 보호되지만(추측 불가능한 uuid 소지가 곧 권한) 앱도 admin
-- 클라이언트로만 부르므로 anon/authenticated 둘 다 과잉 — 방어 심층화 차원에서 회수.
revoke execute on function public.record_pending_guardian_account(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.release_trial_onboarding_link_finalize_claim(uuid, uuid) from public, anon, authenticated;

-- 3) session 클라이언트(authenticated)로 호출되는 것들 — anon/PUBLIC만 회수,
--    authenticated는 실제 사용 중이라 유지.
revoke execute on function public.has_valid_guardian_consent(uuid) from public, anon;
revoke execute on function public.is_under_13(uuid) from public, anon;
revoke execute on function public.student_date_of_birth_known(uuid) from public, anon;
revoke execute on function public.list_open_consultant_meeting_slots(uuid, timestamptz, timestamptz) from public, anon;
revoke execute on function public.list_open_meeting_slots(timestamptz, timestamptz) from public, anon;

-- 4) 앱 코드(app/**, lib/**)에서 직접 호출부를 찾지 못한 것들 — RLS 정책·다른
--    SECURITY DEFINER 함수 본문 안에서만 쓰이는 내부 헬퍼로 보인다(session_student_id/
--    session_teacher_id/current_account_active/current_curriculum_doc_version_id는
--    RLS USING절에 직접 인라인되는 패턴이 이 프로젝트에 실제로 있어 authenticated
--    회수는 보류 — 잘못 회수하면 정상 사용자의 정상 조회가 RLS 평가 단계에서
--    permission denied로 깨질 수 있다). anon/PUBLIC만 회수한다. 순수 boolean/uuid
--    반환이라 anon 직접 호출 시 정보 노출 폭도 좁다(엔티티 존재 여부·상태 정도).
revoke execute on function public.student_already_has_homework_problem(uuid, uuid) from public, anon;
revoke execute on function public.current_curriculum_doc_version_id(uuid) from public, anon;
revoke execute on function public.session_student_id(uuid) from public, anon;
revoke execute on function public.session_teacher_id(uuid) from public, anon;
revoke execute on function public.current_account_active() from public, anon;

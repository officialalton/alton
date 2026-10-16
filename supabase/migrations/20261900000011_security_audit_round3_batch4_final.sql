-- 2026-09-24(Section 2 — SECURITY DEFINER 3차 감사, 마지막 배치) — 나머지
-- 23개(문의 종료/모의고사 진행/단어장 폴더/과제 저장 표시/문의 스레드 접근/
-- 트리거 헬퍼)와 32개 순수 조회 헬퍼(is_*/check_*/_*)까지 118개 전수 완료.
--
-- 55개는 전부 auth.uid()를 자기 자신 또는 정확한 대상 관계로 대조하는 pure
-- boolean/트리거 헬퍼였다(예: is_guardian_of, teaches_student, _mock_exam_can_view
-- 등 — 다른 함수·RLS 정책이 내부적으로 재사용하는 것들이라 authenticated
-- 실행권한이 실제로 필요하다). 문제 없음.
--
-- 남은 2개(submit_homepage_consult_request, list_consultant_open_slots)는
-- anon용 공개 폼/예약 페이지처럼 보이지만, 실제로는 둘 다 admin(service_role)
-- 클라이언트로만 호출된다(app/consult-actions.ts, app/schedule-actions.ts —
-- 브라우저가 anon 키로 이 RPC를 직접 부르지 않고 항상 Next.js 서버 액션을
-- 거친다). 익명 방문자를 위한 함수라는 설계 의도 자체는 안전하지만(각각
-- idempotency_key 중복 방지, 만료·소진 토큰 검사가 있음), 앱이 실제로는 이
-- 경로를 안 쓰므로 anon/authenticated 직접 RPC 권한은 불필요한 잉여다.
-- service_role만 남긴다(취약점은 아니었음 — 방어 심층화).
revoke execute on function public.submit_homepage_consult_request(text, text, text, timestamptz, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_homepage_consult_request(text, text, text, timestamptz, text, text, text) to service_role;
revoke execute on function public.list_consultant_open_slots(text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.list_consultant_open_slots(text, timestamptz, timestamptz) to service_role;

-- 118개 전수 검증 완료 요약 (docs/CURRENT.md에도 기록):
--   round-3 batch1(토큰/초대 14개): 1건 실제 결함(finalize_account_invite)
--   round-3 batch2(개인정보 22개): 1건 실제 결함(assert_guardian_consent_ok 원복)
--   round-3 batch3(결제·상태변경 25개): 2건 실제 결함(finalize_trial_onboarding_students,
--     schedule_reservation_notifications)
--   round-3 batch4(문의/모의고사/헬퍼 57개): 2건 잉여 권한 정리(공개폼류),
--     그 외 55개 문제 없음

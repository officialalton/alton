-- P2 6차 — 버전 캡처 함수의 실행 권한을 명시한다.
--
-- capture_curriculum_doc_version 은 SECURITY DEFINER 가 아니라 RLS 가 실제 방어선이고
-- (curriculum_doc_versions "관리자만 쓰기"), 그래서 비관리자가 불러도 삽입에서 막힌다.
-- 다만 기본값이 PUBLIC EXECUTE 라 "누구나 부를 수는 있다"가 되어 의도가 흐리다.
-- 부를 수 있는 대상을 좁혀 둔다.
revoke execute on function public.capture_curriculum_doc_version(uuid, text, text)
  from public, anon;
grant execute on function public.capture_curriculum_doc_version(uuid, text, text)
  to authenticated, service_role;

-- 조회용 헬퍼도 같게 둔다. 읽기만 하므로 authenticated 면 충분하다.
revoke execute on function public.curriculum_doc_snapshot(uuid) from public, anon;
grant execute on function public.curriculum_doc_snapshot(uuid) to authenticated, service_role;
revoke execute on function public.next_curriculum_doc_version_number(uuid) from public, anon;
grant execute on function public.next_curriculum_doc_version_number(uuid) to authenticated, service_role;

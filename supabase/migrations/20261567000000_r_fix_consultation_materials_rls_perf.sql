-- 실사용 UAT 발견(2026-09-23) — 컨설턴트가 상담 세션에서 "상담 자료"를
-- 열면 서버 액션이 "canceling statement due to statement timeout"로 계속
-- 실패했다. 원인: consultation_materials의 "컨설턴트 공개 자료 조회"
-- 정책이 `exists (select 1 from profiles ...)`를 일반 서브쿼리로 썼다 —
-- is_admin()과 달리 SECURITY DEFINER가 아니라서 profiles 테이블 자체의
-- (여러 테이블을 조인하는 무거운) RLS 정책이 그 서브쿼리 안에서도 다시
-- 평가된다. is_admin()과 같은 패턴으로 SECURITY DEFINER 헬퍼를 만들어
-- profiles RLS를 우회하고 곧장 role만 확인한다.

create or replace function public.is_consultant()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'consultant');
$$;

drop policy "컨설턴트 공개 자료 조회" on consultation_materials;
create policy "컨설턴트 공개 자료 조회" on consultation_materials for select
  using (archived_at is null and is_consultant());

comment on function public.is_consultant() is
  '2026-09-23 — is_admin()과 같은 패턴(SECURITY DEFINER로 profiles RLS 우회).
  일반 서브쿼리로 쓰면 profiles의 무거운 RLS가 재귀적으로 평가돼 타임아웃이
  났다(consultation_materials 정책에서 실제로 발생·재현·수정).';

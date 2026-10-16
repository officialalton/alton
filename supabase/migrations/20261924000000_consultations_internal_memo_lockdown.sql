-- 2026-09-29 온보딩 정책 라운드 F1 — 보호자·학생이 REST 로 consultations 내부 메모를 읽을 수 있던 구멍 차단.
--
-- 원인: consultations SELECT 정책이 "child_id 가 본인이거나 본인이 그 자녀의 보호자인 행 전체"를 허용했다.
--   카드·구 단일 경로 루트는 child_id 를 가지므로 admin_review_summary·outcome_notes·closure_review_text·
--   google_sync_last_error 등 내부 메모가 가족에게 그대로 노출됐다. 컬럼 REVOKE 는 스태프도 같은 authenticated
--   롤이라 쓸 수 없고, 가족 조회 정책(proposals·proposal_subjects·consultation_classification_tags)이
--   consultations 를 서브쿼리로 읽어 이 정책에 의존하므로 정책만 지우면 그쪽이 조용히 빈 결과가 된다.
--
-- 해법: 가족 여부 판정을 SECURITY DEFINER 헬퍼(is_family_consultation)로 옮겨 의존 정책 3개를 먼저 그쪽으로
--   바꾼 뒤, consultations 의 가족 조회 절을 제거한다. 가족 화면이 실제로 필요로 하던 유일한 값(자녀의 최근
--   상담 종료 유형)은 별도 함수(family_child_latest_closure_type)로 그 값만 노출한다.
--   (감사 결과 의존 정책은 이 3개뿐이다: trial_sessions·contract_versions·drive_artifacts 는 consultations 를
--   읽지 않는다. SECURITY INVOKER 함수·뷰 중 consultations 를 읽는 것도 없다.)
--
-- 롤백: consultations 정책을 20261-era 정의(가족 절 포함)로 되돌리고 3개 정책을 EXISTS 서브쿼리로 복원,
--   두 함수 drop.

create or replace function public.is_family_consultation(p_consultation_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from consultations c
    where c.id = p_consultation_id
      and c.child_id is not null
      and (c.child_id = auth.uid() or is_household_guardian_of(c.child_id))
  );
$$;
revoke all on function public.is_family_consultation(uuid) from public, anon;
grant execute on function public.is_family_consultation(uuid) to authenticated, service_role;

create or replace function public.family_child_latest_closure_type(p_child_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.closure_type::text
  from consultations c
  where c.child_id = p_child_id
    and (p_child_id = auth.uid() or is_household_guardian_of(p_child_id) or coalesce(auth.role(), '') = 'service_role')
  order by c.closed_at desc nulls last, c.created_at desc
  limit 1;
$$;
revoke all on function public.family_child_latest_closure_type(uuid) from public, anon;
grant execute on function public.family_child_latest_closure_type(uuid) to authenticated, service_role;

-- 의존 정책 3개 — 가족 절만 헬퍼로 교체(스태프 절은 그대로).
alter policy "관리자/운영자/본인가족 조회" on public.consultation_classification_tags
  using (is_admin() or current_user_has_capability('manage_consultations') or is_family_consultation(consultation_id));

alter policy "관리자/운영자/본인가족 조회" on public.proposals
  using (is_admin() or current_user_has_capability('manage_consultations') or is_family_consultation(consultation_id));

alter policy "관리자/운영자/본인가족 조회" on public.proposal_subjects
  using (
    is_admin() or current_user_has_capability('manage_consultations')
    or exists (select 1 from proposals p where p.id = proposal_subjects.proposal_id and is_family_consultation(p.consultation_id))
  );

-- consultations 본체 — 가족 절 제거(스태프·인테이크 담당·배정 컨설턴트만).
drop policy if exists "관리자/운영자/본인가족/배정컨설턴트 조회" on public.consultations;
drop policy if exists "관리자/운영자/배정컨설턴트 조회" on public.consultations;
create policy "관리자/운영자/배정컨설턴트 조회" on public.consultations
  for select using (
    is_admin()
    or current_user_has_capability('manage_consultations')
    or intake_owner_id = auth.uid()
    or admissions_consultant_id = auth.uid()
    or current_user_has_capability('manage_consultation_intake')
    or current_user_has_capability('manage_admissions_students')
  );

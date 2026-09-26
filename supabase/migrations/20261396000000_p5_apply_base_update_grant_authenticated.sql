-- 2026-09-17(실제 브라우저 UAT 중 발견) — apply_base_update_to_overlay_unit()이
-- service_role에게만 실행 권한이 있어, 담당 교사 화면(app/teacher/
-- student-curriculum-actions.ts의 applyBaseCurriculumUpdate)이 일반 사용자
-- 세션 클라이언트로 이 RPC를 호출하면 "permission denied"로 실패했다.
--
-- authenticated에 실행 권한을 여는 김에, 이 함수가 security definer(RLS 우회)인데도
-- 호출자가 담당 교사·관리자인지 확인하는 절차가 없던 것도 함께 막는다
-- (reorder_curriculum_overlay_units가 이미 쓰는 is_admin()/
-- is_active_teacher_for_enrollment() 패턴과 동일하게 맞춘다) — 서버 액션의
-- requireAssignedTeacherOrAdmin 선인가에만 의존하지 않고, DB 레벨에서도
-- 독립적으로 막는다.
set row_security = off;

create or replace function public.apply_base_update_to_overlay_unit(
  p_overlay_unit_id uuid,
  p_actor_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_enrollment_id uuid;
  v_source_unit_id uuid;
  v_new_updated_at timestamptz;
  v_kw int := 0;
  v_mat int := 0;
  v_prob int := 0;
  v_removed_kw int := 0;
  v_removed_mat int := 0;
begin
  select o.subject_enrollment_id into v_enrollment_id
  from curriculum_overlay_units u
  join student_curriculum_overlays o on o.id = u.overlay_id
  where u.id = p_overlay_unit_id;

  if v_enrollment_id is null then
    raise exception '회차를 찾을 수 없습니다.';
  end if;
  if not (is_admin() or is_active_teacher_for_enrollment(v_enrollment_id)) then
    raise exception '이 학생의 커리큘럼을 조정할 권한이 없습니다.';
  end if;

  if exists (
    select 1 from session_curriculum_units scu
    join sessions s on s.id = scu.session_id
    where scu.overlay_unit_id = p_overlay_unit_id
      and s.final_status not in ('student_cancelled', 'teacher_cancelled', 'company_cancelled')
  ) then
    raise exception '이미 수업에 쓰인 회차는 기준본 업데이트를 적용할 수 없습니다.';
  end if;

  select source_unit_id into v_source_unit_id from curriculum_overlay_units where id = p_overlay_unit_id;
  if v_source_unit_id is null then
    raise exception '기준본과 연결되지 않은 회차입니다.';
  end if;
  select updated_at into v_new_updated_at from subject_template_units where id = v_source_unit_id;

  with removed as (
    delete from curriculum_overlay_unit_keywords e
    where e.overlay_unit_id = p_overlay_unit_id and e.inherited = true
      and not exists (
        select 1 from subject_template_unit_keywords s
        where s.unit_id = v_source_unit_id and s.keyword_id = e.keyword_id
      )
    returning 1
  )
  select count(*) into v_removed_kw from removed;

  with removed as (
    delete from curriculum_overlay_unit_materials e
    where e.overlay_unit_id = p_overlay_unit_id and e.inherited = true
      and not exists (
        select 1 from subject_template_unit_materials s
        where s.unit_id = v_source_unit_id and s.curriculum_doc_id = e.curriculum_doc_id
      )
    returning 1
  )
  select count(*) into v_removed_mat from removed;

  select * into v_kw, v_mat, v_prob from public.inherit_unit_defaults_from_template(p_overlay_unit_id);

  update curriculum_overlay_units set base_unit_updated_at = v_new_updated_at where id = p_overlay_unit_id;

  return jsonb_build_object(
    'keywordsAdded', v_kw, 'materialsAdded', v_mat, 'problemsAdded', v_prob,
    'keywordsRemoved', v_removed_kw, 'materialsRemoved', v_removed_mat
  );
end;
$$;
revoke execute on function public.apply_base_update_to_overlay_unit(uuid, uuid) from public, anon;
grant execute on function public.apply_base_update_to_overlay_unit(uuid, uuid) to authenticated, service_role;

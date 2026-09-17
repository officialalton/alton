-- 2026-09-17(전환 UAT 중 발견) — apply_base_update_to_overlay_unit()의 "이미
-- 수업에 쓰인 회차는 거부" 가드가 취소된 예약까지 막고 있었다. 취소된 예약은
-- 실제로 아무 수업도 일어나지 않았으므로(구성 사본이 실사용되지 않음) 기준본
-- 업데이트를 막을 이유가 없다 — 지금 scheduled/live/completed인 세션이 이
-- 회차를 실제로 쓰고 있을 때만 막도록 좁힌다.
set row_security = off;

create or replace function public.apply_base_update_to_overlay_unit(
  p_overlay_unit_id uuid,
  p_actor_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_source_unit_id uuid;
  v_new_updated_at timestamptz;
  v_kw int := 0;
  v_mat int := 0;
  v_prob int := 0;
  v_removed_kw int := 0;
  v_removed_mat int := 0;
begin
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
revoke execute on function public.apply_base_update_to_overlay_unit(uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_base_update_to_overlay_unit(uuid, uuid) to service_role;

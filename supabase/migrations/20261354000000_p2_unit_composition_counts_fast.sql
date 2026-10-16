-- P2 13차 성능 — 수업 준비 화면의 '업데이트 있음' 계산을 회차 하나짜리 함수로.
--
-- 2026-09-14 Preview 실측(composition_timing): unit_composition_drift 12.8~16.9초,
-- unit_parent_pending_updates 8.5~10.7초. 두 뷰는 security_invoker 라 원격에서는 여러 UNION 가지
-- 각각에 RLS 정책(is_active_teacher_for_enrollment 등)이 행마다 붙어, 회차 하나만 세는 데도
-- 전체를 훑었다. 로컬(superuser)에서는 RLS 가 없어 드러나지 않았다.
--
-- 접근을 **먼저 한 번** 확인하고, 통과하면 정의자 권한으로 두 뷰를 회차 하나에 대해 센다.
-- 남의 회차는 0/0 — 있는지 없는지를 흘리지 않는다(다른 함수들과 같은 관례).

create or replace function public.unit_composition_counts(p_layer text, p_unit_id uuid)
returns table (drift_count int, parent_pending_count int)
language plpgsql
stable
security definer set search_path = public as $$
declare
  v_allowed boolean := false;
  v_enrollment uuid;
begin
  if auth.uid() is null then
    return query select 0, 0;
    return;
  end if;

  if is_admin() then
    v_allowed := true;
  elsif p_layer = 'catalog' then
    -- 기준본은 배포된 정보와 같은 범위 — 선생님이 읽는다.
    v_allowed := exists (select 1 from teachers t where t.id = auth.uid())
              and exists (select 1 from subject_template_units u where u.id = p_unit_id);
  elsif p_layer = 'teacher' then
    v_allowed := exists (
      select 1 from teacher_curriculum_template_units tu
      join teacher_curriculum_templates t on t.id = tu.template_id
      where tu.id = p_unit_id and t.teacher_id = auth.uid()
    );
  elsif p_layer = 'student' then
    select o.subject_enrollment_id into v_enrollment
    from curriculum_overlay_units u
    join student_curriculum_overlays o on o.id = u.overlay_id
    where u.id = p_unit_id;
    v_allowed := v_enrollment is not null
             and (public.is_active_teacher_for_enrollment(v_enrollment)
                  or public.is_enrollment_child_or_guardian(v_enrollment));
  end if;

  if not v_allowed then
    return query select 0, 0;
    return;
  end if;

  return query
    select
      (select count(*)::int from unit_composition_drift d
        where d.layer = p_layer and d.unit_id = p_unit_id),
      (select count(*)::int from unit_parent_pending_updates p
        where p.layer = p_layer and p.unit_id = p_unit_id);
end;
$$;

comment on function public.unit_composition_counts(text, uuid) is
  'P2 13차: 회차 하나의 "버전이 낡은 항목 수"와 "상위와 어긋난 항목 수". 접근을 먼저 확인한 뒤
  정의자 권한으로 세어, 행마다 RLS 를 평가하던 뷰 조회(원격에서 10~17초)를 대신한다. 남의 회차는 0/0.';

revoke execute on function public.unit_composition_counts(text, uuid) from public, anon;
grant execute on function public.unit_composition_counts(text, uuid) to authenticated, service_role;

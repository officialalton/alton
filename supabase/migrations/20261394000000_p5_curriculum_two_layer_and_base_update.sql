-- 2026-09-17(제품 오너 지시 — 커리큘럼 구조 단순화) — 관리자 기준본 → 교사 레이어 →
-- 학생 회차의 3단 상속을 관리자 공용 커리큘럼 → 학생별 사본의 2단으로 줄인다.
-- 교사 상시 커리큘럼 레이어(teacher_curriculum_templates/_units)는 더 이상 새로
-- 만들지 않는다 — 매칭 확정 시 그 레이어를 강제하던 게이트(C-1, 20261274000000)를
-- 제거하고, 항상 관리자 기준본에서 학생별 사본을 직접 만든다
-- (ensure_active_curriculum_overlay — 이미 "교사 템플릿 없음" 폴백으로 존재하던
-- 함수를 유일한 경로로 승격한다. 새 로직을 만들지 않는다).
--
-- 교사 레이어 테이블 자체는 삭제하지 않는다(과거 배정 이력 조회용으로 archived_at만
-- 붙인다) — 이후 세션·정산 기록이 그 이력을 참조하지 않으므로 안전하지만, 혹시
-- 모를 조회 코드를 위해 테이블은 남긴다.
set row_security = off;

-- =========================================================================
-- 1. 기준본 버전 추적 — subject_template_units가 바뀔 때마다 updated_at을 갱신하고,
--    학생별 사본은 만들어질 때의 updated_at을 base_unit_updated_at으로 기록한다.
--    "기준본 업데이트 있음" = base_unit_updated_at이 지금 부모 updated_at보다 과거.
-- =========================================================================
alter table subject_template_units add column if not exists updated_at timestamptz not null default now();
alter table subject_template_units add column if not exists archived_at timestamptz;
alter table teacher_curriculum_templates add column if not exists archived_at timestamptz;
alter table teacher_curriculum_template_units add column if not exists archived_at timestamptz;
alter table curriculum_overlay_units add column if not exists base_unit_updated_at timestamptz;

-- 상위 회차가 실제로 삭제되면(보관 처리가 아니라 하드 삭제) ON DELETE SET NULL로
-- source_unit_id가 null이 된다 — 이건 "학생이 직접 만든 회차"(student_added)가
-- 아니라 "한때 기준본에서 왔는데 그 기준본이 사라진" 상태다. 기존 제약은
-- source_kind='subject_template'이면 source_unit_id가 항상 NOT NULL이길
-- 요구해 이 전이를 막고 있었다 — teacher_template 가지처럼 null을 허용하도록 넓힌다.
alter table curriculum_overlay_units drop constraint if exists curriculum_overlay_units_source_consistency;
alter table curriculum_overlay_units add constraint curriculum_overlay_units_source_consistency check (
  (source_kind = 'subject_template' and source_teacher_template_unit_id is null)
  or (source_kind = 'teacher_template' and source_unit_id is null)
  or (source_kind = 'student_added' and source_unit_id is null and source_teacher_template_unit_id is null)
);

create or replace function public.touch_subject_template_unit(p_unit_id uuid)
returns void language sql as $$
  update subject_template_units set updated_at = now() where id = p_unit_id;
$$;

create or replace function public._touch_subject_template_unit_self()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists subject_template_units_touch on subject_template_units;
create trigger subject_template_units_touch
  before update on subject_template_units
  for each row execute function public._touch_subject_template_unit_self();

create or replace function public._touch_subject_template_unit_from_child()
returns trigger language plpgsql as $$
begin
  perform public.touch_subject_template_unit(coalesce(new.unit_id, old.unit_id));
  return null;
end;
$$;
drop trigger if exists subject_template_unit_materials_touch on subject_template_unit_materials;
create trigger subject_template_unit_materials_touch
  after insert or update or delete on subject_template_unit_materials
  for each row execute function public._touch_subject_template_unit_from_child();

drop trigger if exists subject_template_unit_problems_touch on subject_template_unit_problems;
create trigger subject_template_unit_problems_touch
  after insert or update or delete on subject_template_unit_problems
  for each row execute function public._touch_subject_template_unit_from_child();

drop trigger if exists subject_template_unit_keywords_touch on subject_template_unit_keywords;
create trigger subject_template_unit_keywords_touch
  after insert or update or delete on subject_template_unit_keywords
  for each row execute function public._touch_subject_template_unit_from_child();

-- =========================================================================
-- 2. 매칭 확정 — 교사 운영 커리큘럼 요구(C-1) 제거, 학생별 사본은 항상 기준본에서.
-- =========================================================================
create or replace function public.confirm_student_teacher_subject_match(
  p_child_id uuid,
  p_teacher_id uuid,
  p_subject_id uuid
)
returns table (
  out_subject_enrollment_id uuid,
  out_teacher_assignment_id uuid,
  out_overlay_id uuid,
  out_activation_warning text,
  out_curriculum_warning text
)
language plpgsql security definer set search_path = public as $$
declare
  v_contract_id uuid;
  v_enrollment_id uuid;
  v_assignment_id uuid;
  v_overlay_id uuid;
  v_child_status text;
  v_activation_warning text := null;
  v_curriculum_warning text := null;
begin
  if not (is_admin() or current_user_has_capability('매칭권한')) then
    raise exception '이 작업을 수행할 권한이 없습니다.';
  end if;

  -- 2026-09-17: 교사 상시 커리큘럼 레이어를 없앴으므로, 이제는 과목 자체에
  -- 관리자 공용 커리큘럼(회차 1개 이상)이 있어야만 배정을 허용한다 —
  -- 교사가 아니라 과목 기준으로 게이트를 옮겼을 뿐, "빈 커리큘럼으로
  -- 배정하지 않는다"는 원칙은 그대로 유지한다.
  if not exists (
    select 1 from subject_template_units u where u.subject_id = p_subject_id
  ) then
    raise exception '이 과목은 아직 공용 커리큘럼(회차)이 없어 배정할 수 없습니다.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_child_id::text || ':' || p_subject_id::text, 43));

  select id into v_enrollment_id
  from subject_enrollments
  where child_id = p_child_id and subject_id = p_subject_id
    and status in ('planned', 'active', 'paused')
  limit 1;

  if v_enrollment_id is null then
    select get_or_create_draft_contract_for_child(p_child_id) into v_contract_id;
    insert into subject_enrollments (child_id, subject_id, contract_id, status)
    values (p_child_id, p_subject_id, v_contract_id, 'planned')
    returning id into v_enrollment_id;
  end if;

  select id into v_assignment_id
  from teacher_assignments
  where subject_enrollment_id = v_enrollment_id and teacher_id = p_teacher_id and status = 'active';

  if v_assignment_id is null then
    insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, changed_by, source)
    values (v_enrollment_id, p_teacher_id, 'active', now(), auth.uid(), 'app')
    returning id into v_assignment_id;
  end if;

  select status into v_child_status from students where id = p_child_id;
  if v_child_status = 'pending' then
    begin
      perform transition_account_status(p_child_id, 'active', '과목·선생님 배정 완료(자동 전환)');
    exception when others then
      v_activation_warning := '선생님 배정은 완료됐지만, 학생 계정을 활성 상태로 전환하지 못했습니다(' || sqlerrm || '). 관리자가 직접 확인·재처리해야 합니다.';
    end;
  end if;

  begin
    perform activate_subject_enrollment_if_ready(v_enrollment_id);
  exception when others then
    null;
  end;

  -- 2026-09-17: 학생별 사본은 항상 관리자 공용 커리큘럼에서 직접 만든다
  -- (ensure_active_curriculum_overlay — 교사 템플릿 폴백 경로였던 것을 유일한
  -- 경로로 승격, seed_curriculum_overlay_for_match의 교사 템플릿 분기는 더
  -- 이상 호출하지 않는다).
  begin
    v_overlay_id := public.ensure_active_curriculum_overlay(v_enrollment_id);
  exception when others then
    v_curriculum_warning := '선생님 배정은 완료됐지만, 학생별 커리큘럼을 만들지 못했습니다(' || sqlerrm || '). 관리자가 직접 확인·재처리해야 합니다.';
  end;

  return query select v_enrollment_id, v_assignment_id, v_overlay_id, v_activation_warning, v_curriculum_warning;
end;
$$;
revoke execute on function public.confirm_student_teacher_subject_match(uuid, uuid, uuid) from public, anon;
grant execute on function public.confirm_student_teacher_subject_match(uuid, uuid, uuid) to authenticated, service_role;
comment on function public.confirm_student_teacher_subject_match(uuid, uuid, uuid) is
  '2026-09-17: 교사 상시 커리큘럼 레이어 요구를 제거했다 — 이제 과목에 관리자 공용
  커리큘럼(회차 1개 이상)만 있으면 배정할 수 있다. 학생별 사본은 항상
  ensure_active_curriculum_overlay()로 공용 커리큘럼에서 직접 만든다.';

-- ensure_active_curriculum_overlay — 사본 생성 시점의 기준본 버전(updated_at)을
-- base_unit_updated_at에 기록한다(그 외 로직 동일 — 이미 있던 폴백 경로 그대로).
create or replace function public.ensure_active_curriculum_overlay(p_subject_enrollment_id uuid)
returns uuid
language plpgsql as $$
declare
  v_overlay_id uuid;
  v_subject_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_subject_enrollment_id::text, 42));

  select id into v_overlay_id
  from student_curriculum_overlays
  where subject_enrollment_id = p_subject_enrollment_id and status = 'active';

  if v_overlay_id is not null then
    return v_overlay_id;
  end if;

  insert into student_curriculum_overlays (subject_enrollment_id, created_by)
  values (p_subject_enrollment_id, auth.uid())
  on conflict (subject_enrollment_id) where (status = 'active') do nothing
  returning id into v_overlay_id;

  if v_overlay_id is null then
    select id into v_overlay_id
    from student_curriculum_overlays
    where subject_enrollment_id = p_subject_enrollment_id and status = 'active';
    return v_overlay_id;
  end if;

  select subject_id into v_subject_id
  from subject_enrollments
  where id = p_subject_enrollment_id;

  if v_subject_id is null then
    raise exception '존재하지 않는 subject_enrollment 입니다.';
  end if;

  insert into curriculum_overlay_units
    (overlay_id, source_unit_id, position, unit_title, note, created_by, base_unit_updated_at)
  select v_overlay_id, u.id, u.position, u.unit_title, u.note, auth.uid(), u.updated_at
  from subject_template_units u
  where u.subject_id = v_subject_id and u.archived_at is null
  order by u.position;

  return v_overlay_id;
end;
$$;

-- =========================================================================
-- 3. 기준본 업데이트 안내·선택 적용
-- =========================================================================
create or replace function public.overlay_unit_needs_base_update(p_overlay_unit_id uuid)
returns boolean
language sql stable as $$
  select coalesce(u.base_unit_updated_at is distinct from t.updated_at, false)
  from curriculum_overlay_units u
  join subject_template_units t on t.id = u.source_unit_id
  where u.id = p_overlay_unit_id and t.archived_at is null;
$$;
revoke execute on function public.overlay_unit_needs_base_update(uuid) from public, anon;
grant execute on function public.overlay_unit_needs_base_update(uuid) to authenticated, service_role;

-- 이미 예약·시작·완료된 수업에 연결된 회차는 업데이트 적용 대상에서 뺀다 —
-- session_curriculum_units에 이미 걸려 있으면(수업이 이미 이 회차를 참조 중)
-- 그 수업의 구성 사본은 절대 안 바뀌므로 회차 자체를 바꿔도 무방하지만, 안전하게
-- "이미 세션에 쓰인 회차"는 적용을 막아 혼동을 없앤다(회차 재사용이 필요하면
-- 관리자가 새 회차를 만든다).
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
  if exists (select 1 from session_curriculum_units where overlay_unit_id = p_overlay_unit_id) then
    raise exception '이미 수업에 쓰인 회차는 기준본 업데이트를 적용할 수 없습니다.';
  end if;

  select source_unit_id into v_source_unit_id from curriculum_overlay_units where id = p_overlay_unit_id;
  if v_source_unit_id is null then
    raise exception '기준본과 연결되지 않은 회차입니다.';
  end if;
  select updated_at into v_new_updated_at from subject_template_units where id = v_source_unit_id;

  -- 상위에서 빠진 것을 아래에서도 뺀다 — inherited=true인 행만(사람이 직접
  -- 담은 것은 상위와 무관하게 남는다, 기존 원칙 그대로).
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

  -- 상위에 새로 추가된 것을 받는다(이미 있는 건 건드리지 않음 — inherit_unit_defaults_from_template
  -- 과 동일한 NOT EXISTS/ON CONFLICT 가드).
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

comment on function public.apply_base_update_to_overlay_unit(uuid, uuid) is
  '2026-09-17: 기준본 업데이트를 학생별 회차에 선택 적용한다. 학생이 직접 조정한
  값(inherited=false)은 절대 건드리지 않는다 — 상위에서 빠진 inherited=true 행만
  제거하고, 새로 추가된 상위 항목만 받는다. 이미 수업에 쓰인 회차는 거부.';

-- 2026-09-17(제품 오너 지시 — 예약·수업 준비·진도 단일 흐름 재정렬)
--
-- 조사 결과: "예약이 잡히면 다음 회차를 자동으로 연결한다"는 이미 P2에서 구현돼
-- 있었다(20261316000000_p2_auto_link_next_unit.sql, sessions_auto_link_unit_after_insert
-- 트리거). 그런데 그 자동 연결은 session_curriculum_units에 **연결 기록만** 남기고
-- 실제 교재·문제 구성은 전혀 복사하지 않았다 — 그래서 "연동됐다고는 나오는데(연결
-- 기록은 있음) 수업 준비에 들어가면 아무것도 없다(교재·문제 사본은 없음)"는 오늘
-- 하루 종일 나온 버그들의 정확한 원인이었다. 게다가 다음 회차 후보를 "아직 어떤
-- 세션에도 쓰인 적 없는 회차"로 판정해, 취소된 세션이 차지했던 회차는 영원히 다시
-- 배정되지 않는 문제도 있었다.
--
-- 이 마이그레이션은 새 파이프라인을 만드는 대신 그 기존 자동 연결 함수
-- (auto_link_next_unit_to_session, 트리거는 그대로 유지)를 고친다.
--   1. 후보 판정을 "아무 세션도 안 쓴 회차"에서 curriculum_overlay_units.status(이미
--      존재하는 진도 컬럼, not_started/in_progress/completed/reinforcement_needed/
--      skipped) 기준으로 바꾼다 — completed/skipped가 아닌, 그리고 지금 scheduled/live
--      상태인 다른 세션이 이미 차지하지 않은 회차 중 position이 가장 앞선 것.
--      취소·노쇼로 끝난 세션은 더 이상 회차를 붙잡지 않으므로 재예약 시 같은 회차를
--      다시 받는다.
--   2. 연결만 하지 않고 그 시점 구성(교재·문제·키워드)을 세션 전용 사본으로 즉시
--      복사한다(_stage_unit_for_session — link_unit_prep_to_session이 쓰던 것과 동일한
--      헬퍼로 통합해 로직이 두 벌로 갈라지지 않게 한다). 회차 자체에 아직 구성이
--      없으면(한 번도 상속받은 적 없음) inherit_unit_defaults_from_template()을 먼저
--      호출한다(20261391000000과 동일 정책).
--   3. 세션이 정상 완료(completed)되면 연결된 회차를 진도상 completed로 넘긴다
--      (finalize_lesson_session 확장) — 그래야 다음 예약이 다음 회차를 자동으로 받는다.
--      학생/선생님 노쇼·취소는 이 분기를 타지 않는다.
-- 체험/정규를 구분하지 않는다 — 두 경로 모두 confirm_lesson_booking()→sessions insert→
-- 이 트리거를 그대로 거친다(finalize_lesson_session이 이미 "체험/정규 모두 동일한
-- 함수를 거친다"고 명시한 것과 같은 원칙).
set row_security = off;

-- =========================================================================
-- 1. 공통 헬퍼 — 회차 하나를 세션에 연결하고 그 시점 구성을 세션 전용 사본으로 복사한다.
--    link_unit_prep_to_session()(교사가 수동으로 누르는 경로)과 자동 연결 트리거가
--    똑같은 복사 로직을 쓴다.
-- =========================================================================
create or replace function public._stage_unit_for_session(
  p_overlay_unit_id uuid,
  p_session_id uuid,
  p_actor_id uuid,
  p_enrollment uuid
) returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_prep curriculum_unit_preps%rowtype;
  v_selection_id uuid;
  v_unit_row_id uuid;
  v_pos int := 0;
  v_item record;
begin
  select p.* into v_prep from curriculum_unit_preps p where p.overlay_unit_id = p_overlay_unit_id;
  if not found or not exists (
    select 1 from curriculum_unit_prep_items where prep_id = v_prep.id
  ) then
    perform public.inherit_unit_defaults_from_template(p_overlay_unit_id);
    select p.* into v_prep from curriculum_unit_preps p where p.overlay_unit_id = p_overlay_unit_id;
  end if;

  insert into session_prepared_selections (subject_enrollment_id, teacher_id, session_id, status)
  values (p_enrollment, p_actor_id, p_session_id, 'staged')
  returning id into v_selection_id;

  insert into session_prepared_selection_units (prepared_selection_id, overlay_unit_id, position)
  values (v_selection_id, p_overlay_unit_id, 1)
  returning id into v_unit_row_id;

  insert into session_prepared_selection_unit_keywords (prepared_selection_unit_id, keyword_id)
  select v_unit_row_id, k.keyword_id
  from curriculum_overlay_unit_keywords k
  where k.overlay_unit_id = p_overlay_unit_id;

  if v_prep.id is not null then
    for v_item in
      select content_type, content_id, problem_version_id
      from curriculum_unit_prep_items
      where prep_id = v_prep.id order by position asc
    loop
      v_pos := v_pos + 1;
      insert into session_prepared_selection_content_items
        (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position,
         problem_version_id)
      values (v_selection_id, v_unit_row_id, v_item.content_type, v_item.content_id, v_pos,
              v_item.problem_version_id);
    end loop;
  end if;

  insert into session_curriculum_units (session_id, overlay_unit_id, role)
  values (p_session_id, p_overlay_unit_id, 'primary')
  on conflict (session_id, overlay_unit_id) do nothing;

  return v_selection_id;
end;
$$;
revoke execute on function public._stage_unit_for_session(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public._stage_unit_for_session(uuid, uuid, uuid, uuid) to service_role;

-- link_unit_prep_to_session()은 그대로 두되(교사 수동 경로, 권한·상태 검사 동일),
-- 복사 본체만 공통 헬퍼로 위임한다.
create or replace function public.link_unit_prep_to_session(
  p_overlay_unit_id uuid,
  p_session_id uuid,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_enrollment uuid;
  v_session_enrollment uuid;
  v_final_status v3_session_final_status;
  v_selection_id uuid;
  v_existing_status text;
begin
  select o.subject_enrollment_id into v_enrollment
  from curriculum_overlay_units u
  join student_curriculum_overlays o on o.id = u.overlay_id
  where u.id = p_overlay_unit_id;

  select s.subject_enrollment_id, s.final_status into v_session_enrollment, v_final_status
  from sessions s where s.id = p_session_id;
  if v_session_enrollment is null then
    raise exception '수업을 찾을 수 없습니다.';
  end if;
  if v_session_enrollment is distinct from v_enrollment then
    raise exception '다른 학생·과목의 회차는 이 수업에 연결할 수 없습니다.';
  end if;
  if v_final_status <> 'scheduled' then
    raise exception '이미 시작했거나 종료한 수업의 준비는 바꿀 수 없습니다.';
  end if;
  if not (
    exists (select 1 from profiles pr where pr.id = p_actor_id and pr.role = 'admin')
    or exists (select 1 from sessions s where s.id = p_session_id and s.teacher_id = p_actor_id)
  ) then
    raise exception '담당 수업에만 회차 준비를 연결할 수 있습니다.';
  end if;

  select s.id, s.status into v_selection_id, v_existing_status
  from session_prepared_selections s
  where s.session_id = p_session_id and s.status <> 'archived';
  if v_selection_id is not null then
    if v_existing_status = 'pinned' then
      raise exception '이미 고정된 수업입니다.';
    end if;
    return v_selection_id;
  end if;

  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);
  return public._stage_unit_for_session(p_overlay_unit_id, p_session_id, p_actor_id, v_enrollment);
end;
$$;
revoke execute on function public.link_unit_prep_to_session(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_unit_prep_to_session(uuid, uuid, uuid) to service_role;

-- =========================================================================
-- 2. 기존 자동 연결 트리거 함수를 고친다 — 트리거 자체(sessions_auto_link_unit_after_insert)
--    는 그대로 둔다(20261316000000). 진도 기준 후보 판정 + 구성 즉시 복사만 추가한다.
-- =========================================================================
create or replace function public.auto_link_next_unit_to_session(p_session_id uuid)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_enrollment_id uuid;
  v_teacher_id uuid;
  v_overlay_id uuid;
  v_unit_id uuid;
begin
  if exists (select 1 from session_curriculum_units where session_id = p_session_id) then
    return null;
  end if;

  select subject_enrollment_id, teacher_id into v_enrollment_id, v_teacher_id
  from sessions where id = p_session_id;
  if v_enrollment_id is null then
    return null;
  end if;

  select id into v_overlay_id
  from student_curriculum_overlays
  where subject_enrollment_id = v_enrollment_id and status = 'active';
  if v_overlay_id is null then
    return null;
  end if;

  -- 다음 미완료 회차 = completed/skipped가 아니고, 지금 scheduled/live인 다른
  -- 세션이 이미 차지하지 않은 회차 중 position이 가장 앞선 것. 취소·노쇼로 끝난
  -- 세션은 final_status가 scheduled/live가 아니게 되므로 그 회차는 곧바로 다시
  -- 후보가 된다(완료로 넘어가지 않았기 때문에 status도 여전히 미완료).
  select u.id into v_unit_id
  from curriculum_overlay_units u
  where u.overlay_id = v_overlay_id
    and u.status not in ('completed', 'skipped')
    and not exists (
      select 1 from session_curriculum_units scu
      join sessions s on s.id = scu.session_id
      where scu.overlay_unit_id = u.id
        and s.id <> p_session_id
        and s.final_status in ('scheduled', 'live')
    )
  order by u.position asc
  limit 1;

  if v_unit_id is null then
    return null;
  end if;

  if (select status from curriculum_overlay_units where id = v_unit_id) = 'not_started' then
    update curriculum_overlay_units set status = 'in_progress' where id = v_unit_id;
  end if;

  perform set_config('request.jwt.claim.sub', v_teacher_id::text, true);
  perform public._stage_unit_for_session(v_unit_id, p_session_id, v_teacher_id, v_enrollment_id);

  return v_unit_id;
end;
$$;
revoke execute on function public.auto_link_next_unit_to_session(uuid) from public, anon, authenticated;
grant execute on function public.auto_link_next_unit_to_session(uuid) to service_role;

comment on function public.auto_link_next_unit_to_session(uuid) is
  '2026-09-17: 다음 미완료 회차(status 기준)를 세션에 연결하고 그 시점 구성(교재·문제·
  키워드)을 세션 전용 사본으로 즉시 복사한다(_stage_unit_for_session). 이전에는 연결
  기록만 남기고 구성을 복사하지 않아 "연동됐지만 내용은 비어 있음" 결함이 있었다.';

-- =========================================================================
-- 3. 정상 완료 시 회차 진도 전진 — 다음 예약이 자동으로 다음 회차를 가져가게 한다.
--    취소·노쇼는 이 분기를 타지 않으므로(finalize_lesson_session의 completed
--    분기에만 추가) 회차가 완료로 넘어가지 않는다 — 재예약 시 같은 회차를 다시 쓴다.
-- =========================================================================
create or replace function public.finalize_lesson_session(
  p_session_id uuid,
  p_outcome v3_session_final_status,
  p_actor_id uuid,
  p_reason text,
  p_teacher_fault_provided_minutes int default null,
  p_early_end_reason text default null
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_session sessions%rowtype;
  v_reservation reservations%rowtype;
  v_grant_id uuid;
  v_current_expires_at timestamptz;
  v_min_expires_at timestamptz;
  v_child_id uuid;
  v_payable int;
  v_effective_reason text;
begin
  if p_outcome not in ('completed', 'student_no_show', 'teacher_no_show') then
    raise exception '이 함수는 completed/student_no_show/teacher_no_show만 처리합니다(중단·장애 판정은 finalize_session_as_infra_incident() 사용).' using errcode = 'P0001';
  end if;

  select * into v_session from sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception '세션을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if v_session.final_status not in ('scheduled', 'live') then
    raise exception '이미 확정된 세션입니다(현재 상태: %). 재판정은 reopen_session()/recomplete_session()을 사용하세요.', v_session.final_status
      using errcode = 'P0001';
  end if;

  select * into v_reservation from reservations where id = v_session.reservation_id;

  if p_outcome in ('completed', 'student_no_show') and v_session.final_status <> 'live' then
    raise exception '수업이 아직 시작되지 않았습니다(현재 상태: %). mark_lesson_session_started()로 먼저 시작한 뒤에만 정상 완료·학생 노쇼를 확정할 수 있습니다.', v_session.final_status
      using errcode = 'P0001';
  end if;

  if p_outcome = 'teacher_no_show' and v_session.final_status <> 'scheduled' then
    raise exception '선생님 노쇼는 수업이 시작되지 않은 경우에만 확정할 수 있습니다(현재 상태: %). 이미 시작된 세션은 resolve_teacher_partial_interruption()이나 finalize_session_as_infra_incident()를 사용하세요.', v_session.final_status
      using errcode = 'P0001';
  end if;

  if p_outcome = 'student_no_show' then
    if now() < v_reservation.starts_at + interval '15 minutes' then
      raise exception '수업 시작 후 15분이 지나야 학생 노쇼를 확정할 수 있습니다(예약 시작: %).', v_reservation.starts_at
        using errcode = 'P0001';
    end if;

    select child_id into v_child_id from subject_enrollments where id = v_session.subject_enrollment_id;
    if exists (
      select 1 from session_access_events
      where session_id = p_session_id
        and actor_id = v_child_id
        and event_type in ('meet_join', 'alton_page_open')
    ) then
      raise exception '학생의 접속 기록이 있어 선생님이 직접 노쇼를 확정할 수 없습니다 — 관리자 검토가 필요합니다.'
        using errcode = 'P0001';
    end if;
  end if;

  v_effective_reason := p_reason;

  if p_outcome = 'completed' and now() < v_reservation.ends_at then
    if p_early_end_reason is distinct from 'student_reason' then
      raise exception '예약 종료 시각 전에 정상 완료를 확정하려면 조기 종료 사유가 필요합니다 — 선생님 귀책이면 resolve_teacher_partial_interruption(), 회사·Meet 장애면 finalize_session_as_infra_incident()를 사용하고, 학생 사유라면 p_early_end_reason=''student_reason''과 함께 호출하세요.'
        using errcode = 'P0001';
    end if;
    v_effective_reason := '[학생 사유 조기종료] ' || coalesce(p_reason, '');
  end if;

  if p_outcome in ('completed', 'student_no_show') then
    perform consume_entitlement(v_session.reservation_id);
    v_payable := v_session.scheduled_duration_minutes - coalesce(v_session.late_start_minutes, 0);
    update sessions
      set final_status = p_outcome,
          actual_end_at = coalesce(actual_end_at, now()),
          payable_minutes = v_payable,
          final_reason = v_effective_reason,
          final_actor_id = p_actor_id,
          finalized_at = now()
      where id = p_session_id;

    -- 2026-09-17 추가 — 정상 완료(student_no_show는 학생 귀책 소진일 뿐 "배웠다"는
    -- 뜻이 아니므로 completed만) 시 이 세션에 연결된 회차를 진도상 completed로 넘긴다.
    if p_outcome = 'completed' then
      update curriculum_overlay_units u
      set status = 'completed'
      from session_curriculum_units scu
      where scu.session_id = p_session_id
        and scu.role = 'primary'
        and u.id = scu.overlay_unit_id
        and u.status not in ('completed', 'skipped');
    end if;

  elsif p_outcome = 'teacher_no_show' then
    perform release_entitlement(v_session.reservation_id);
    update sessions
      set final_status = p_outcome,
          actual_end_at = coalesce(actual_end_at, now()),
          payable_minutes = 0,
          final_reason = v_effective_reason,
          final_actor_id = p_actor_id,
          finalized_at = now()
      where id = p_session_id;

    select grant_id into v_grant_id from entitlement_ledger
      where reservation_id = v_session.reservation_id and event_type = 'release';
    if v_grant_id is not null then
      select expires_at into v_current_expires_at from entitlement_grants where id = v_grant_id;
      v_min_expires_at := now() + interval '30 days';
      if v_current_expires_at < v_min_expires_at then
        perform extend_entitlement(v_grant_id, v_min_expires_at, 'm5a_teacher_no_show:' || v_session.reservation_id);
      end if;
    end if;
  end if;

  insert into session_status_events (session_id, event_type, previous_final_status, new_final_status, actor_profile_id, reason)
  values (p_session_id, p_outcome::text::v3_session_status_event_type, v_session.final_status, p_outcome, p_actor_id, v_effective_reason);

  perform public.upsert_session_payout_item(p_session_id);

  if p_outcome = 'completed' and p_teacher_fault_provided_minutes is not null and p_teacher_fault_provided_minutes < 90 then
    select child_id into v_child_id from subject_enrollments where id = v_session.subject_enrollment_id;
    insert into teacher_qc_warnings (teacher_id, student_id, type, detail)
    values (
      v_session.teacher_id, v_child_id, 'short_session_teacher_fault',
      format('선생님 사유로 최종 제공 %s분(예약 %s분) — 세션 %s', p_teacher_fault_provided_minutes, v_session.scheduled_duration_minutes, p_session_id)
    );
  end if;
end;
$$;
revoke execute on function public.finalize_lesson_session(uuid, v3_session_final_status, uuid, text, int, text) from public, anon, authenticated;
grant execute on function public.finalize_lesson_session(uuid, v3_session_final_status, uuid, text, int, text) to service_role;

comment on function public.finalize_lesson_session(uuid, v3_session_final_status, uuid, text, int, text) is
  '2026-09-17: completed 확정 시 이 세션에 연결된 커리큘럼 회차(session_curriculum_units
  role=primary)를 진도상 completed로 넘긴다 — 다음 예약(auto_link_next_unit_to_session)이
  자동으로 다음 회차를 가져가게 하기 위함. student_no_show/teacher_no_show는 진도를
  넘기지 않는다(재예약 시 같은 회차 재사용). 그 외 종료 판정 규칙은 2026-09-06 정의 그대로.';

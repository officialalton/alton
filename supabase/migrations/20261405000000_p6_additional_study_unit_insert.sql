-- P6 1차 — "추가 학습 회차" 삽입 (2026-09-17, 제품 오너 지시)
--
-- 배경: 예약→회차 자동 연결은 이미 P2/P4에서 구현돼 있다
-- (auto_link_next_unit_to_session, 20261392000000). 이 마이그레이션은 그 구조를
-- 그대로 두고, "지금 회차 바로 다음에 같은 구성의 회차를 하나 끼워 넣고, 아직
-- 시작하지 않은 미래 예약들만 한 칸씩 밀어서 다시 잇는다"는 새 동작 하나만
-- 추가한다. 이름은 기존 makeup_obligations(분 단위 보강 시간 원장, 20260830060000)
-- 과 개념이 겹치므로 "보강"이 아니라 "추가 학습 회차"(additional_study_unit)로 부른다.
--
-- 설계:
--   1. curriculum_overlay_units에 소스 회차 바로 다음 position으로 새 회차를 만든다
--      (제목 "추가 학습 · <원 회차명>"), 뒤 회차들은 position을 하나씩 민다.
--   2. 키워드(curriculum_overlay_unit_keywords)·교재(curriculum_overlay_unit_materials)·
--      준비 항목(curriculum_unit_prep_items, 문제 포함)을 소스 회차에서 그대로 복사한다.
--      진도 상태(status)·학생 답안·수업 기록·필기·피드백은 복사하지 않는다(새 회차는
--      항상 not_started로 시작하고, 이 테이블들에는 애초에 그런 데이터가 없다 — 학생
--      답안·필기 등은 session_* 테이블에 세션 단위로 붙지 회차에는 붙지 않는다).
--   3. final_status='scheduled'(아직 시작 안 함)인 세션 중, 이 오버레이에서 소스 회차
--      **다음**(position 기준, 삽입 전 기준) 회차들에 연결된 것들을 예약 시작 시각
--      순으로 하나씩 "연결 해제 → 재연결"한다. 재연결은 기존
--      auto_link_next_unit_to_session()을 그대로 재호출해서 하므로(연결 대상 판정
--      로직을 새로 만들지 않는다), 처리 순서대로 자연스럽게 한 칸씩 밀린 회차를
--      받는다 — 새로 낀 회차가 맨 앞이므로 첫 번째로 처리되는 세션이 그것을 받는다.
--   4. live/completed/취소/노쇼 세션은 건드리지 않는다(final_status<>'scheduled'인
--      세션은 애초에 재연결 대상 조회에 잡히지 않는다).
--   5. 예약이 부족해 뒤쪽 회차가 어떤 세션에도 연결되지 못하면(재연결 루프가 세션보다
--      먼저 바닥남) 그 회차는 그냥 미배정 상태로 남는다 — auto_link_next_unit_to_session
--      이 이미 "미배정 회차는 다음 예약이 언젠가 알아서 받아간다"는 방식이라 별도 처리가
--      필요 없다.
--
-- preview_additional_study_unit_insert()는 확인 패널용 읽기 전용 미리보기(부수효과
-- 없음). insert_additional_study_unit()이 실제 원자적 실행이다(단일 함수 호출 = 단일
-- 트랜잭션 — 브라우저에서 세션마다 순차 호출하지 않는다).

set row_security = off;

-- =========================================================================
-- 1. 실행 — 원자적 삽입 + 재배치
-- =========================================================================
create or replace function public.insert_additional_study_unit(
  p_source_overlay_unit_id uuid,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer set search_path = public as $$
declare
  v_source curriculum_overlay_units%rowtype;
  v_enrollment_id uuid;
  v_new_unit_id uuid;
  v_new_prep_id uuid;
  v_source_prep_id uuid;
  v_source_goal text;
  v_reassigned jsonb := '[]'::jsonb;
  v_left_pending jsonb := '[]'::jsonb;
  v_session record;
  v_relinked_unit_id uuid;
begin
  select * into v_source from curriculum_overlay_units where id = p_source_overlay_unit_id for update;
  if v_source.id is null then
    raise exception '회차를 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if v_source.status not in ('in_progress', 'completed') then
    raise exception '진행 중이거나 완료된 회차에서만 추가 학습 회차를 넣을 수 있습니다(현재 상태: %).', v_source.status
      using errcode = 'P0001';
  end if;

  select o.subject_enrollment_id into v_enrollment_id
  from student_curriculum_overlays o where o.id = v_source.overlay_id;

  -- is_active_teacher_for_enrollment()는 auth.uid()(RLS 세션 신원) 기준이라,
  -- service_role + 명시적 p_actor_id로 호출되는 이 함수에서는 auth.uid()가 항상
  -- null이라 절대 참이 되지 않는다(그 헬퍼는 여기 쓰지 않는다 — link_unit_prep_to_session
  -- 이 이미 같은 이유로 teacher_assignments를 직접 조회하는 이유와 같다). p_actor_id
  -- 기준으로 직접 확인한다.
  if not (
    exists (select 1 from profiles pr where pr.id = p_actor_id and pr.role = 'admin')
    or exists (
      select 1 from teacher_assignments ta
      where ta.subject_enrollment_id = v_enrollment_id
        and ta.teacher_id = p_actor_id
        and ta.status in ('planned', 'active')
    )
  ) then
    raise exception '담당 학생·과목의 회차에만 추가 학습 회차를 넣을 수 있습니다.' using errcode = 'P0001';
  end if;

  -- 뒤 회차들 position을 한 칸씩 민다. 단일 UPDATE로 -1씩 옮기면 (overlay_id, position)
  -- 유니크 인덱스가 문장 안에서 즉시(행 단위) 검사돼 충돌하므로, 큰 오프셋을 거쳐
  -- 2단계로 옮긴다.
  update curriculum_overlay_units
    set position = position + 1000000
    where overlay_id = v_source.overlay_id and position > v_source.position;
  update curriculum_overlay_units
    set position = position - 1000000 + 1
    where overlay_id = v_source.overlay_id and position > v_source.position + 1000000 - 1;

  insert into curriculum_overlay_units (overlay_id, position, unit_title, status, created_by)
  values (v_source.overlay_id, v_source.position + 1, '추가 학습 · ' || v_source.unit_title, 'not_started', p_actor_id)
  returning id into v_new_unit_id;

  -- 키워드 복사
  insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id, created_by)
  select v_new_unit_id, k.keyword_id, p_actor_id
  from curriculum_overlay_unit_keywords k
  where k.overlay_unit_id = p_source_overlay_unit_id;

  -- 교재 복사(순서 그대로)
  insert into curriculum_overlay_unit_materials (overlay_unit_id, curriculum_doc_id, position, created_by)
  select v_new_unit_id, m.curriculum_doc_id, m.position, p_actor_id
  from curriculum_overlay_unit_materials m
  where m.overlay_unit_id = p_source_overlay_unit_id;

  -- 준비 항목(문제 포함) 복사 — 소스 회차의 "현재" 준비안을 그대로 복사한다.
  select id, goal into v_source_prep_id, v_source_goal
  from curriculum_unit_preps where overlay_unit_id = p_source_overlay_unit_id;

  insert into curriculum_unit_preps (overlay_unit_id, goal, created_by)
  values (v_new_unit_id, v_source_goal, p_actor_id)
  returning id into v_new_prep_id;

  if v_source_prep_id is not null then
    insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position, problem_version_id)
    select v_new_prep_id, i.content_type, i.content_id, i.position, i.problem_version_id
    from curriculum_unit_prep_items i
    where i.prep_id = v_source_prep_id
    order by i.position;
  end if;

  -- 아직 시작하지 않은(final_status='scheduled') 세션 중, 삽입 전 기준으로 소스
  -- 회차보다 뒤에 있던 회차에 연결된 것들을 예약 시작 시각 순으로 하나씩 밀어 낸다.
  -- (지금은 position이 이미 +1 밀린 뒤이므로 "> v_source.position + 1"로 비교한다.)
  for v_session in
    select s.id as session_id, r.starts_at
    from session_curriculum_units scu
    join sessions s on s.id = scu.session_id
    join reservations r on r.id = s.reservation_id
    join curriculum_overlay_units u on u.id = scu.overlay_unit_id
    where scu.role = 'primary'
      and s.final_status = 'scheduled'
      and u.overlay_id = v_source.overlay_id
      and u.position > v_source.position + 1
      and u.id <> v_new_unit_id
    order by r.starts_at asc
  loop
    delete from session_prepared_selections where session_id = v_session.session_id and status = 'staged';
    delete from session_curriculum_units where session_id = v_session.session_id and role = 'primary';

    v_relinked_unit_id := public.auto_link_next_unit_to_session(v_session.session_id);
    if v_relinked_unit_id is not null then
      v_reassigned := v_reassigned || jsonb_build_object(
        'sessionId', v_session.session_id,
        'startsAt', v_session.starts_at,
        'overlayUnitId', v_relinked_unit_id
      );
    else
      v_left_pending := v_left_pending || jsonb_build_object('sessionId', v_session.session_id, 'startsAt', v_session.starts_at);
    end if;
  end loop;

  return jsonb_build_object(
    'newUnitId', v_new_unit_id,
    'newUnitTitle', '추가 학습 · ' || v_source.unit_title,
    'reassigned', v_reassigned,
    'leftPending', v_left_pending
  );
end;
$$;
revoke execute on function public.insert_additional_study_unit(uuid, uuid) from public, anon, authenticated;
grant execute on function public.insert_additional_study_unit(uuid, uuid) to service_role;

comment on function public.insert_additional_study_unit(uuid, uuid) is
  '2026-09-17: 진행 중/완료 회차 바로 다음에 같은 구성(키워드·교재·준비 항목)의 "추가
  학습" 회차를 끼워 넣고, 아직 시작하지 않은(scheduled) 미래 세션들만 예약 시각 순으로
  재연결한다(기존 auto_link_next_unit_to_session 재사용, 새 연결 판정 로직 없음). live·
  completed·취소·노쇼 세션은 조회 대상에서 아예 빠지므로 건드리지 않는다. 단일 함수
  호출로 회차 생성·순서 변경·미래 예약 재연결까지 원자적으로 끝난다.';

-- =========================================================================
-- 2. 미리보기 — 확인 패널용 읽기 전용(부수효과 없음). 실제 실행과 같은 판정
--    범위(scheduled + position > source)를 그대로 세어 보여준다.
-- =========================================================================
create or replace function public.preview_additional_study_unit_insert(
  p_source_overlay_unit_id uuid,
  p_actor_id uuid
) returns jsonb
language plpgsql
stable
security definer set search_path = public as $$
declare
  v_source curriculum_overlay_units%rowtype;
  v_enrollment_id uuid;
  v_affected jsonb;
  v_unaffected_count int;
begin
  select * into v_source from curriculum_overlay_units where id = p_source_overlay_unit_id;
  if v_source.id is null then
    raise exception '회차를 찾을 수 없습니다.' using errcode = 'P0001';
  end if;

  -- 이 함수는 security definer(row_security 우회)로 실행되므로, 클라이언트가
  -- 넘긴 p_actor_id를 곧이곧대로 믿지 않고 insert_additional_study_unit()과
  -- 똑같은 인가 규칙(관리자 또는 이 학생·과목의 담당 교사)을 여기서도 다시
  -- 확인한다 -- 그러지 않으면 아무 로그인 사용자나 회차 id만 알면 다른 학생의
  -- 예약 일정을 미리보기로 읽을 수 있었다.
  select o.subject_enrollment_id into v_enrollment_id
  from student_curriculum_overlays o where o.id = v_source.overlay_id;

  -- 위 insert_additional_study_unit()과 같은 이유로 is_active_teacher_for_enrollment()
  -- (auth.uid() 기준)를 쓰지 않고 p_actor_id를 직접 확인한다.
  if not (
    exists (select 1 from profiles pr where pr.id = p_actor_id and pr.role = 'admin')
    or exists (
      select 1 from teacher_assignments ta
      where ta.subject_enrollment_id = v_enrollment_id
        and ta.teacher_id = p_actor_id
        and ta.status in ('planned', 'active')
    )
  ) then
    raise exception '담당 학생·과목의 회차만 미리볼 수 있습니다.' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'sessionId', s.id, 'startsAt', r.starts_at, 'currentUnitTitle', u.unit_title
    ) order by r.starts_at asc), '[]'::jsonb)
  into v_affected
  from session_curriculum_units scu
  join sessions s on s.id = scu.session_id
  join reservations r on r.id = s.reservation_id
  join curriculum_overlay_units u on u.id = scu.overlay_unit_id
  where scu.role = 'primary'
    and s.final_status = 'scheduled'
    and u.overlay_id = v_source.overlay_id
    and u.position > v_source.position;

  select count(*) into v_unaffected_count
  from session_curriculum_units scu
  join sessions s on s.id = scu.session_id
  join curriculum_overlay_units u on u.id = scu.overlay_unit_id
  where scu.role = 'primary'
    and s.final_status in ('live', 'completed')
    and u.overlay_id = v_source.overlay_id;

  return jsonb_build_object(
    'newUnitTitle', '추가 학습 · ' || v_source.unit_title,
    'affectedFutureSessions', v_affected,
    'unaffectedStartedOrCompletedCount', v_unaffected_count
  );
end;
$$;
revoke execute on function public.preview_additional_study_unit_insert(uuid, uuid) from public, anon;
grant execute on function public.preview_additional_study_unit_insert(uuid, uuid) to authenticated, service_role;

comment on function public.preview_additional_study_unit_insert(uuid, uuid) is
  '2026-09-17: "다음 수업을 추가 학습 회차로 변경" 확인 패널이 쓰는 읽기 전용 미리보기.
  insert_additional_study_unit()과 같은 판정 범위(scheduled + position > source)를
  그대로 보여준다 — 부수효과 없음.';

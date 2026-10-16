-- R6 4/N — 예약 확정 함수 보강: 멱등성(동일 슬롯 동시 예약/재요청 중복 방지),
-- 관리자 24시간 이내 예외, 주 1회 최대 8회 반복예약(수업권 부족 시 가능한 회차까지만).
--
-- material_version_id는 이번 단계에서 채우지 않는다 — "이 subject_enrollment가 지금
-- 몇 단원/어떤 교재 버전을 쓰고 있는지"를 가리키는 개념 자체가 아직 없다(과목 템플릿
-- 단원↔교재 연결은 있지만, 학생별 "현재 진도" 스냅샷은 R9 "과목 템플릿과 학생별 진도
-- 스냅샷"에서 만들어진다 — master-roadmap-v3.md R9). R1이 만들어둔 nullable FK
-- 컬럼(인터페이스)만 유지하고, 실제 채우기는 R9 완료 후 여기 confirm_lesson_booking()을
-- 다시 CREATE OR REPLACE하는 것으로 배선한다(R6 스펙 "R9의 커리큘럼 인수인계는 이번에
-- 구현하지 말고 필요한 인터페이스만 유지" 원칙과 일치 — teacher_id/hourly_rate/
-- lesson_type_id는 이미 세션 생성 시점에 스냅샷됨, 위 R6 1/N·R1 트리거 참고).

-- 1) 24시간~8주 예약범위 + 관리자 24시간 이내 예외(상한 8주는 관리자도 동일 적용).
create or replace function public.is_within_booking_window(p_starts_at timestamptz, p_admin_override boolean default false) returns boolean
  language sql stable as $$
  select (p_admin_override or p_starts_at >= now() + interval '24 hours')
     and p_starts_at <= now() + interval '8 weeks';
$$;

-- 2) confirm_lesson_booking(): 멱등성(같은 idempotency_key로 재요청 시 새로 만들지 않고
--    기존 reservation/session을 그대로 반환) + p_admin_override 관통. 새 파라미터
--    (p_admin_override)가 추가돼 시그니처가 바뀌므로 CREATE OR REPLACE는 옛 9-인자
--    버전을 대체하지 못하고 오버로드를 만든다 — 명시적으로 옛 시그니처를 먼저 drop한다.
drop function if exists public.confirm_lesson_booking(
  uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, uuid, smallint
);
create or replace function public.confirm_lesson_booking(
  p_child_id uuid,
  p_subject_enrollment_id uuid,
  p_teacher_id uuid,
  p_lesson_type_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_idempotency_key text,
  p_booking_series_id uuid default null,
  p_series_occurrence_index smallint default null,
  p_admin_override boolean default false
) returns table (reservation_id uuid, session_id uuid)
  language plpgsql security definer set search_path = public as $$
declare
  v_reservation_id uuid;
  v_session_id uuid;
  v_grant_id uuid;
  v_existing record;
begin
  -- 이 함수는 hold_entitlement()/consume_entitlement()와 동일하게 service_role
  -- 전용이다(아래 revoke/grant) — 클라이언트가 auth.uid() 컨텍스트로 직접 호출할 수
  -- 없고 Next.js 서버 액션만 호출한다. 관리자 권한 확인(p_admin_override을 실제로 쓸
  -- 수 있는 사람인지)은 reopen_session()/recomplete_session()처럼 auth.uid() 기반
  -- is_admin()을 이 함수 내부에서 다시 검사하지 않는다 — service_role 호출에는
  -- 클라이언트의 auth.uid()가 실려오지 않으므로(서버 액션이 이미 세션에서 관리자
  -- 여부를 확인한 뒤 호출) 여기서 검사하면 항상 실패한다. 다른 service_role 전용
  -- 함수(hold_entitlement 등)와 동일한 신뢰 경계 — 서버 액션이 호출 전 권한을 보증한다.

  -- 멱등성: 같은 idempotency_key로 이미 확정된 예약이 있으면 그대로 반환하고 새로
  -- 만들지 않는다(동일 슬롯 동시 예약·재요청이 중복 세션·hold·Calendar 이벤트를
  -- 만들지 않아야 한다는 요구사항). idempotency_key는 reservations에 unique 제약이
  -- 이미 있으므로(R1), 여기서 먼저 조회해 경쟁 상태에서도 유니크 위반 대신 기존 값을
  -- 반환한다 — 유니크 위반이 실제로 발생하는 극히 짧은 경쟁 구간은 아래 예외 처리로
  -- 한 번 더 방어한다.
  select r.id as rid, s.id as sid into v_existing
  from reservations r join sessions s on s.reservation_id = r.id
  where r.idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.rid, v_existing.sid;
    return;
  end if;

  if not is_within_booking_window(p_starts_at, p_admin_override) then
    raise exception 'booking_window_violation' using errcode = 'P0001';
  end if;
  if not is_teacher_slot_open(p_teacher_id, p_starts_at, p_ends_at) then
    raise exception 'teacher_slot_not_open' using errcode = 'P0001';
  end if;
  if violates_teacher_buffer(p_teacher_id, p_starts_at, p_ends_at) then
    raise exception 'teacher_buffer_violation' using errcode = 'P0001';
  end if;

  begin
    insert into reservations (
      kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status,
      idempotency_key, booking_series_id, series_occurrence_index
    ) values (
      'lesson', p_subject_enrollment_id, p_teacher_id, p_starts_at, p_ends_at, 'confirmed',
      p_idempotency_key, p_booking_series_id, p_series_occurrence_index
    )
    returning id into v_reservation_id;
  exception when unique_violation then
    -- 동시 요청이 사이 좁은 경쟁 구간에서 같은 idempotency_key로 동시에 insert를
    -- 시도한 경우 — 먼저 커밋된 쪽의 결과를 그대로 반환한다(재조회).
    select r.id as rid, s.id as sid into v_existing
    from reservations r join sessions s on s.reservation_id = r.id
    where r.idempotency_key = p_idempotency_key;
    if found then
      return query select v_existing.rid, v_existing.sid;
    end if;
    raise;
  end;

  insert into sessions (
    reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes
  ) values (
    v_reservation_id, p_subject_enrollment_id, p_teacher_id, p_lesson_type_id,
    extract(epoch from (p_ends_at - p_starts_at))::int / 60
  )
  returning id into v_session_id;

  v_grant_id := hold_entitlement(p_child_id, v_reservation_id, p_starts_at, 1);

  return query select v_reservation_id, v_session_id;
end;
$$;

revoke execute on function public.confirm_lesson_booking(
  uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, uuid, smallint, boolean
) from public, anon, authenticated;
grant execute on function public.confirm_lesson_booking(
  uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, uuid, smallint, boolean
) to service_role;

-- 3) 주 1회 최대 8회 반복예약. 각 회차는 독립 confirm_lesson_booking() 호출(= 독립
--    reservation/session/entitlement hold) — 수업권이 부족해지는 순간 그 회차부터는
--    만들지 않고 멈춘다(스펙: "가능한 회차까지만 생성하고 결과를 명확히 안내"). 회차별
--    idempotency_key는 (series 멱등키, occurrence index)로 파생시켜 시리즈 자체의
--    재요청도 멱등이 되게 한다.
create or replace function public.create_weekly_lesson_series(
  p_child_id uuid,
  p_subject_enrollment_id uuid,
  p_teacher_id uuid,
  p_lesson_type_id uuid,
  p_first_starts_at timestamptz,
  p_duration_minutes int,
  p_occurrences smallint,
  p_series_timezone text,
  p_idempotency_key_prefix text,
  p_created_by uuid,
  p_admin_override boolean default false
) returns table (
  occurrence_index smallint,
  reservation_id uuid,
  session_id uuid,
  starts_at timestamptz,
  failure_reason text
)
  language plpgsql security definer set search_path = public as $$
declare
  v_series_id uuid;
  v_day_of_week smallint;
  v_i smallint;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_result record;
begin
  if p_occurrences < 1 or p_occurrences > 8 then
    raise exception '주 1회 반복예약은 1~8회만 가능합니다(받은 값: %).', p_occurrences using errcode = 'P0001';
  end if;

  v_day_of_week := extract(dow from (p_first_starts_at at time zone p_series_timezone));

  insert into booking_series (
    subject_enrollment_id, teacher_id, lesson_type_id, day_of_week, start_time_local, timezone,
    occurrences_planned, created_by
  ) values (
    p_subject_enrollment_id, p_teacher_id, p_lesson_type_id, v_day_of_week,
    (p_first_starts_at at time zone p_series_timezone)::time, p_series_timezone,
    p_occurrences, p_created_by
  )
  returning id into v_series_id;

  for v_i in 0..(p_occurrences - 1) loop
    v_starts_at := p_first_starts_at + (v_i || ' weeks')::interval;
    v_ends_at := v_starts_at + (p_duration_minutes || ' minutes')::interval;

    begin
      select * into v_result from confirm_lesson_booking(
        p_child_id, p_subject_enrollment_id, p_teacher_id, p_lesson_type_id,
        v_starts_at, v_ends_at,
        p_idempotency_key_prefix || ':' || v_i,
        v_series_id, v_i::smallint, p_admin_override
      );
      occurrence_index := v_i;
      reservation_id := v_result.reservation_id;
      session_id := v_result.session_id;
      starts_at := v_starts_at;
      failure_reason := null;
      return next;
    exception when others then
      -- 수업권 부족(hold_entitlement의 '사용 가능한 수업권이 없습니다.')이든 다른
      -- 실패(버퍼/가용성/window)든, 이 회차에서 멈추고 이후 회차는 시도하지 않는다
      -- ("가능한 회차까지만 생성" — 실패 지점 이후를 건너뛰고 계속하면 어느 회차가
      -- 왜 비었는지 안내가 모호해진다). 이미 만든 앞선 회차는 롤백하지 않는다(각
      -- 회차가 독립 예약이라는 스펙 요구사항).
      occurrence_index := v_i;
      reservation_id := null;
      session_id := null;
      starts_at := v_starts_at;
      failure_reason := sqlerrm;
      return next;
      exit;
    end;
  end loop;
end;
$$;

revoke execute on function public.create_weekly_lesson_series(
  uuid, uuid, uuid, uuid, timestamptz, int, smallint, text, text, uuid, boolean
) from public, anon, authenticated;
grant execute on function public.create_weekly_lesson_series(
  uuid, uuid, uuid, uuid, timestamptz, int, smallint, text, text, uuid, boolean
) to service_role;

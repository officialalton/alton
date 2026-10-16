-- 2026-09-29 제품 오너 결정 2건.
-- (1) 선생님 15분 버퍼 제거 — 같은 선생님의 수업이 끝나는 시각 = 다음 수업 시작 시각(연속 수업)을
--     예약할 수 있어야 한다. 겹침(overlap)은 계속 금지(reservations_no_overlap 유지).
--     booking_buffer_minutes()/violates_teacher_buffer()와 모든 호출부는 그대로 두고 값만 0으로 바꾼다
--     (다시 필요해지면 이 상수 하나만 바꾸면 된다). tstzrange는 [시작, 끝) 반열림이라
--     버퍼 0이면 끝==시작 인접은 겹치지 않는다. 겹침은 같은 검사(teacher_buffer_violation)가 보고한다.
-- (2) 같은 학생(자녀)은 같은 시간에 수업이 둘일 수 없다 — reservations 트리거로 DB에서 강제.
--     대상: 새 INSERT, 그리고 시간·상태·수강과목이 실제로 바뀌는 UPDATE(예약, 반복예약, 재예약,
--     관리자 override, 선생님 변경 요청, 체험 예약 등 reservations를 쓰는 모든 경로).
--     기존 겹침 행은 건드리지 않는다(시간 등을 바꾸지 않는 UPDATE는 검사하지 않음).

create or replace function public.booking_buffer_minutes() returns int
  language sql immutable as $$ select 0 $$;

comment on function public.booking_buffer_minutes() is
  '선생님 수업 사이 버퍼(분). 2026-09-29 오너 결정으로 0(연속 수업 허용). 겹침은 계속 금지.';

-- 학생(자녀)이 [start,end)와 겹치는 holding/confirmed 수업 예약을 이미 갖고 있는지.
create or replace function public.violates_student_overlap(
  p_child_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_exclude_reservation_id uuid default null
) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from reservations r
    join subject_enrollments e on e.id = r.subject_enrollment_id
    where e.child_id = p_child_id
      and r.kind = 'lesson'
      and r.status in ('holding', 'confirmed')
      and (p_exclude_reservation_id is null or r.id <> p_exclude_reservation_id)
      and tstzrange(r.starts_at, r.ends_at) && tstzrange(p_starts_at, p_ends_at)
  );
$$;

revoke execute on function public.violates_student_overlap(uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.violates_student_overlap(uuid, timestamptz, timestamptz, uuid) to service_role;

create or replace function public.reservations_student_overlap_guard() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_child uuid;
begin
  if new.kind <> 'lesson' or new.subject_enrollment_id is null
     or new.status not in ('holding', 'confirmed') then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.starts_at = old.starts_at and new.ends_at = old.ends_at
     and new.status = old.status and new.kind = old.kind
     and new.subject_enrollment_id is not distinct from old.subject_enrollment_id then
    return new; -- 시간·상태가 그대로인 갱신(구글 동기화 등)은 검사하지 않는다(기존 데이터 보존)
  end if;

  select child_id into v_child from subject_enrollments where id = new.subject_enrollment_id;
  if v_child is null then
    return new;
  end if;

  -- 같은 학생의 동시 예약 경합 직렬화
  perform pg_advisory_xact_lock(hashtextextended('student_overlap:' || v_child::text, 0));

  if violates_student_overlap(v_child, new.starts_at, new.ends_at, new.id) then
    raise exception 'student_time_overlap: 이미 같은 시간에 다른 수업이 있습니다.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_student_overlap_guard on public.reservations;
create trigger reservations_student_overlap_guard
  before insert or update on public.reservations
  for each row execute function public.reservations_student_overlap_guard();

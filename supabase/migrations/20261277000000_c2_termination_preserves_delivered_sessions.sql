-- C-2(2026-09-11, Preview UAT 결함 수정) — 매칭 종료가 "이미 consume된
-- 예약은 release할 수 없습니다"로 실패하는 문제.
--
-- 원인: preview_teacher_assignment_termination_impact()/
-- assert_teacher_assignment_ready_for_closure()가 "이 선생님 명의의
-- status='confirmed' && starts_at>now() 예약"만으로 "아직 정리 안 된 미래
-- 예약"을 판정했다. 하지만 reservations.status는 finalize_lesson_session()
-- (세션을 미리 시작→종료 판정)이 실행돼도 바뀌지 않는다(그 함수는 sessions.
-- final_status만 바꾼다) — 그래서 실제로는 이미 수업이 진행돼 수업권이
-- consume된 세션의 예약도 "아직 안 정리된 미래 예약"으로 잘못 잡혔고,
-- 종료 처리가 그 예약에 release_entitlement()를 시도해 예외로 실패했다.
--
-- 정책(제품 오너 지시): 완료된 수업과 이미 쓴 수업권은 그대로 보존한다 —
-- 취소·release로 되돌리지 않는다. 진행 중(live)인 수업이 있으면 종료 자체를
-- 보류하고 안내한다. 실제로 처리해야 할 대상은 sessions.final_status가
-- 'scheduled'(아직 시작 안 함)이거나 'live'(진행 중)인 예약뿐이다 — 그 외
-- (completed/student_cancelled/teacher_cancelled/student_no_show/
-- teacher_no_show/company_cancelled/interrupted)는 이미 최종 판정이 끝난
-- 이력이므로 종료 처리 대상에서 제외한다.
-- 반환 컬럼(OUT 파라미터) 구성 자체가 바뀌므로 create or replace로는 안 되고
-- drop 후 재생성해야 한다(Postgres 제약 — 반환 타입 자체를 바꾸는 교체는 거부됨).
drop function if exists public.preview_teacher_assignment_termination_impact(uuid);

create function public.preview_teacher_assignment_termination_impact(p_teacher_assignment_id uuid)
returns table (
  reservation_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  has_active_hold boolean,
  session_final_status text
)
language sql stable security definer set search_path = public as $$
  select
    r.id,
    r.starts_at,
    r.ends_at,
    r.status,
    exists (
      select 1 from entitlement_ledger el
      where el.reservation_id = r.id and el.event_type = 'hold'
        and not exists (
          select 1 from entitlement_ledger el2
          where el2.reservation_id = r.id and el2.event_type in ('release', 'consume')
        )
    ) as has_active_hold,
    sv.final_status::text as session_final_status
  from teacher_assignments ta
  join reservations r on r.owner_profile_id = ta.teacher_id
  join sessions sv on sv.reservation_id = r.id and sv.subject_enrollment_id = ta.subject_enrollment_id
  where ta.id = p_teacher_assignment_id
    and r.status = 'confirmed'
    and r.starts_at > now()
  order by r.starts_at;
$$;
revoke execute on function public.preview_teacher_assignment_termination_impact(uuid) from public, anon;
grant execute on function public.preview_teacher_assignment_termination_impact(uuid) to authenticated, service_role;
comment on function public.preview_teacher_assignment_termination_impact(uuid) is
  'M3/C-2: 관리자가 종료 실행 전 확인하는 영향 범위 — 이 배정의 선생님이 owner인 미래(starts_at>now())'
  ' confirmed 예약과 활성 수업권 hold 여부, 연결 세션의 최종 판정 상태(session_final_status). 상태가'
  ' scheduled/live가 아니면(이미 최종 판정 끝난 완료/취소/노쇼 등) 실제 종료 처리 대상이 아니다 — 해당'
  ' 예약·수업권은 그대로 보존되고 앱 레이어가 취소를 시도하지 않는다.';

-- 종료 처리 감사 이력에 "이미 완료돼 손대지 않고 건너뜀"도 남길 수 있게 허용값 추가.
alter table teacher_assignment_termination_reservation_actions
  drop constraint teacher_assignment_termination_reservation_actions_action_check;
alter table teacher_assignment_termination_reservation_actions
  add constraint teacher_assignment_termination_reservation_actions_action_check
  check (action in ('reassigned', 'cancelled', 'skipped_already_delivered'));

-- 마지막 방어선도 같은 기준으로 좁힌다 — 이미 완료·취소·노쇼로 최종 판정된
-- 세션의 예약은 reservations.status가 영원히 'confirmed'로 남아있어도(위
-- 설명대로 finalize_lesson_session()이 그 컬럼을 바꾸지 않음) 정리 대상이
-- 아니므로, 이 게이트가 종료 완료 자체를 영구히 막아서는 안 된다.
create or replace function public.assert_teacher_assignment_ready_for_closure(p_teacher_assignment_id uuid)
returns void
language plpgsql stable security definer set search_path = public as $$
declare
  v_remaining int;
begin
  select count(*) into v_remaining
  from reservations r
  join sessions sv on sv.reservation_id = r.id
  join teacher_assignments ta on ta.subject_enrollment_id = sv.subject_enrollment_id
  where ta.id = p_teacher_assignment_id
    and r.owner_profile_id = ta.teacher_id
    and r.status = 'confirmed'
    and r.starts_at > now()
    and sv.final_status in ('scheduled', 'live');

  if v_remaining > 0 then
    raise exception '아직 정리되지 않은 미래 예약이 %건 있어 배정 종료를 완료할 수 없습니다.', v_remaining;
  end if;
end;
$$;
revoke execute on function public.assert_teacher_assignment_ready_for_closure(uuid) from public, anon;
grant execute on function public.assert_teacher_assignment_ready_for_closure(uuid) to service_role, authenticated;
comment on function public.assert_teacher_assignment_ready_for_closure(uuid) is
  'M3/C-2: 종료 처리 마지막 방어선 — 이 배정 명의의 미래 확정 예약 중 연결 세션이 아직 scheduled/live인'
  ' 것(재배정도 취소도 안 된 상태)이 하나라도 남아있으면 종료 완료 자체를 거부한다. 이미 최종 판정이'
  ' 끝난(완료/취소/노쇼 등) 세션의 예약은 제외 — 그런 예약은 영원히 손대지 않고 보존되므로 이 게이트'
  ' 대상이 아니다.';

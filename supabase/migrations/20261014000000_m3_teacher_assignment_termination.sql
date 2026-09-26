-- M3 — 정식 선생님 배정 종료 흐름(R5 미완료 항목, 2026-09-03).
--
-- 정책 확정(제품 오너 지시, 코드에 반영): 체험 선생님과 정규 선생님을 별도 개념으로
-- 만들지 않는다 — `teacher_assignments`는 자녀의 과목에 배정된 선생님을 나타내는 단일
-- 관계이고, 체험/정규 구분은 세션의 수업 유형(lesson_types)과 사용 수업권으로만 한다.
-- 따라서 이 마이그레이션은 별도 "체험 선생님 배정" 테이블이나 후보·수락대기·거절·만료
-- 상태 머신을 만들지 않는다 — 기존 `teacher_assignments`/`change_teacher_assignment()`를
-- 그대로 재사용해 "배정 종료" 흐름만 추가한다.
--
-- 커리큘럼·진도 인계 정책(제품 오너 지시로 단순화, R9 구조화 마일스톤 보드와는 별개):
-- 별도 인계 요청·수락·완료 워크플로, 문서 복사, Drive 소유권/ACL 변경, 인계 완료 게이트를
-- 만들지 않는다 — 새 선생님이 현재 배정되어 있으면(teacher_assignments.status='active')
-- 그 시점부터 해당 과목의 과거 수업 이력을 즉시 읽기 전용으로 볼 수 있고, 배정이
-- 끝나거나 무효화되면 그 접근도 즉시 사라진다(라이브 상태 기반 — 별도 회수 로직 불필요).
-- 기존 `curriculum_handoff_status` placeholder는 이번에 새 게이트로 쓰지 않는다(주석
-- 갱신, 값 자체는 R9까지 그대로 둔다).

comment on column teacher_assignments.curriculum_handoff_status is
  'R5 placeholder — 실제 인계 워크플로는 만들어진 적 없음. M3(2026-09-03) 정책 확정: '
  '이 컬럼을 커리큘럼 인계 완료의 운영 게이트로 쓰지 않는다(구조화된 진도 인계는 R9 범위,'
  ' 이번에 손대지 않음). M3는 과거 수업 이력 읽기 전용 접근을 teacher_assignments.status='
  '''active'' 라이브 상태로만 판정하고 이 컬럼을 참조하지 않는다 — 회귀 방지를 위해 컬럼'
  '자체는 삭제하지 않고 호환 필드로만 유지한다.';

-- =========================================================================
-- 1. 선생님 배정 종료 요청
-- =========================================================================

create table teacher_assignment_termination_requests (
  id uuid primary key default gen_random_uuid(),
  subject_enrollment_id uuid not null references subject_enrollments (id),
  teacher_assignment_id uuid not null references teacher_assignments (id),
  requested_by_role text not null check (requested_by_role in ('guardian', 'teacher', 'admin')),
  requested_by uuid references profiles (id), -- 보호자 요청은 관리자가 외부 접수 내용을 대신 기록(R11 메신저 없음) — 이 경우 실제 보호자 profile id를 넣는다.
  reason text not null,
  status text not null default 'requested' check (status in ('requested', 'processing', 'completed', 'failed', 'cancelled')),
  resolution text check (resolution in ('reassign', 'end_enrollment')),
  new_teacher_id uuid references teachers (id),
  effective_from timestamptz,
  processed_by uuid references profiles (id),
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on teacher_assignment_termination_requests (subject_enrollment_id);
create index on teacher_assignment_termination_requests (teacher_assignment_id);
create index on teacher_assignment_termination_requests (status);

comment on table teacher_assignment_termination_requests is
  'M3: 선생님 배정 종료 요청. 실제 종료 처리(새 선생님 재배정 또는 과목 수강 함께 종료)는 '
  'app 레이어(lib/enrollment/teacher-assignment-termination.ts)가 기존 change_teacher_assignment()/ '
  'cancel_lesson_booking()을 재사용해 수행하고, 이 테이블은 요청·처리 상태·결과만 기록한다.';

-- INSERT-only 이력 성격이지만 진행 상태(status/processed_*)는 갱신돼야 하므로 하드
-- immutable로 두지 않는다(account_status_events류와 다른 성격 — 처리 중 상태 갱신이
-- 이 테이블의 정상 동작). 감사 목적은 별도 액션 로그 테이블(아래)이 담당한다.
alter table teacher_assignment_termination_requests enable row level security;
create policy "관리자·요청 대상 선생님 조회" on teacher_assignment_termination_requests for select
  using (
    is_admin()
    or current_user_has_capability('예약관리권한')
    or exists (select 1 from teacher_assignments ta where ta.id = teacher_assignment_id and ta.teacher_id = auth.uid())
    or requested_by = auth.uid()
  );
-- 쓰기는 client에서 하지 않는다 — 서버 액션이 service_role로 처리(관리자 권한은 그
-- 서버 액션 진입점(requireAdmin/requireAdminOrCapability)에서 확인).

-- =========================================================================
-- 2. 예약별 처리 결과 감사 이력(INSERT-only)
-- =========================================================================

create table teacher_assignment_termination_reservation_actions (
  id uuid primary key default gen_random_uuid(),
  termination_request_id uuid not null references teacher_assignment_termination_requests (id),
  reservation_id uuid not null references reservations (id),
  action text not null check (action in ('reassigned', 'cancelled')),
  detail text,
  created_at timestamptz not null default now()
);
create index on teacher_assignment_termination_reservation_actions (termination_request_id);

create or replace function public.reject_termination_reservation_action_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'teacher_assignment_termination_reservation_actions는 INSERT-only입니다.';
end;
$$;
create trigger termination_reservation_actions_no_update
  before update or delete on teacher_assignment_termination_reservation_actions
  for each row execute function public.reject_termination_reservation_action_mutation();
revoke execute on function public.reject_termination_reservation_action_mutation() from public, anon, authenticated, service_role;

alter table teacher_assignment_termination_reservation_actions enable row level security;
create policy "관리자 조회" on teacher_assignment_termination_reservation_actions for select using (is_admin() or current_user_has_capability('예약관리권한'));

-- =========================================================================
-- 3. 종료 영향 미리보기(관리자 화면용) — 미래 예약·hold 조회
-- =========================================================================

create or replace function public.preview_teacher_assignment_termination_impact(p_teacher_assignment_id uuid)
returns table (
  reservation_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  has_active_hold boolean
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
    ) as has_active_hold
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
  'M3: 관리자가 종료 실행 전 확인하는 영향 범위 — 이 배정(teacher_assignment_id)의 선생님이 '
  'owner인 미래(starts_at>now()) confirmed 예약과 활성 수업권 hold 여부.';

-- =========================================================================
-- 4. 새 선생님의 과거 수업 이력 읽기 전용 조회(즉시, 인계 게이트 없음)
-- =========================================================================
--
-- 정책(제품 오너 지시): 새 배정이 확정되면 그 즉시 과거 수업 이력을 읽기 전용으로
-- 제공한다 — 별도 인계 완료 승인 없음. 제공 정보: 수업 일시·진행 상태·과목/수업유형.
-- 제공하지 않는 정보: Smart Notes 원본, 시급·정산(hourly_rate_snapshot_*), 내부 메모,
-- 다른 과목 기록. RLS로 테이블 전체를 열지 않고 이 SECURITY DEFINER 함수가 안전한
-- 컬럼만 골라 반환한다(컬럼 단위 노출 통제) — 호출 자격은 함수 내부에서 "현재 이
-- 과목 수강에 active로 배정된 선생님인지"로 라이브 검사한다(배정이 끝나거나 다른
-- 선생님으로 바뀌면 이 함수 자체가 그 시점부터 빈 결과/거부를 반환 — 별도 회수 로직 불필요).
create or replace function public.list_subject_teaching_history_for_current_teacher(p_subject_enrollment_id uuid)
returns table (
  session_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  final_status text,
  lesson_type_name text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (
    is_admin()
    or exists (
      select 1 from teacher_assignments ta
      where ta.subject_enrollment_id = p_subject_enrollment_id
        and ta.teacher_id = auth.uid()
        and ta.status = 'active'
    )
  ) then
    raise exception '이 과목 수강에 현재 배정된 선생님만 지난 수업 이력을 볼 수 있습니다.';
  end if;

  return query
    select sv.id, r.starts_at, r.ends_at, sv.final_status::text, lt.name
    from sessions sv
    join reservations r on r.id = sv.reservation_id
    join lesson_types lt on lt.id = sv.lesson_type_id
    where sv.subject_enrollment_id = p_subject_enrollment_id
      and r.starts_at <= now()
    order by r.starts_at desc;
end;
$$;
revoke execute on function public.list_subject_teaching_history_for_current_teacher(uuid) from public, anon;
grant execute on function public.list_subject_teaching_history_for_current_teacher(uuid) to authenticated, service_role;
comment on function public.list_subject_teaching_history_for_current_teacher(uuid) is
  'M3: 현재 이 과목 수강에 active로 배정된 선생님(또는 관리자)에게만 과거 수업 일시·상태·수업유형을 '
  '반환한다 — hourly_rate_snapshot/smart_notes_drive_file_id 등 민감 컬럼은 애초에 select 목록에 없어 '
  '노출되지 않는다. R7(수업 리뷰/과제 콘텐츠)·R9(구조화 마일스톤)가 아직 없어 지금은 일정·상태까지만 '
  '제공 — 그 R들이 완료되면 이 함수에 안전한 컬럼만 추가하면 된다(게이트 자체는 바뀌지 않음).';

-- =========================================================================
-- 5. 안전한 종료 확정(마지막 방어선) — 미정리 미래 예약/hold가 있으면 거부
-- =========================================================================

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
    and r.starts_at > now();

  if v_remaining > 0 then
    raise exception '아직 정리되지 않은 미래 예약이 %건 있어 배정 종료를 완료할 수 없습니다.', v_remaining;
  end if;
end;
$$;
revoke execute on function public.assert_teacher_assignment_ready_for_closure(uuid) from public, anon;
grant execute on function public.assert_teacher_assignment_ready_for_closure(uuid) to service_role, authenticated;
comment on function public.assert_teacher_assignment_ready_for_closure(uuid) is
  'M3: 종료 처리 마지막 방어선 — 이 배정 명의의 미래 확정 예약이 하나라도 남아있으면 '
  '(재배정도 취소도 안 된 상태) 종료 완료 자체를 거부한다. app 레이어가 각 예약을 '
  '재배정/취소한 뒤 이 함수를 호출해 실제로 다 정리됐는지 최종 확인한다.';

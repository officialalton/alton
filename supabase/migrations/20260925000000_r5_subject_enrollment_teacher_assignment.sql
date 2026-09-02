-- R5 — 과목 수강·선생님 배정: 앱 레이어에 필요한 신규 DB 지원.
--
-- `subject_enrollments`/`teacher_assignments` 테이블과 겹침 방지 exclusion
-- constraint, 시급 강제 트리거는 R1(20260830020000, 20260830100000)에서 이미
-- 구현되어 있다 — 이 마이그레이션은 그 위에 다음만 추가한다:
--  1. 활성화 선행조건(계약 active + 결제완료 entitlement grant) 판정 함수
--  2. 체험→정규 선생님 승계 자격 판정 함수(active 상태+과목 자격+유효 시급)
--  3. 선생님 변경 원자적 처리 함수(기존 배정 종료 + 신규 배정 생성, 단일 트랜잭션)
--  4. 과목별 채팅 스레드(subject_threads) — 배정 변경 시 자동 생성/과거 접근 보존
--  5. 커리큘럼 인계 자리(향후 R9) — placeholder 컬럼 + FK만
--  6. 문서 권한 부여/회수 큐(document_permission_retries) — R8 실제 Drive 호출 전
--     재처리 가능한 work-item 패턴(contract_activation_retries와 동일한 모양)

-- ---------------------------------------------------------------------------
-- 1. 활성화 선행조건 판정
-- ---------------------------------------------------------------------------
create or replace function public.subject_enrollment_activation_ready(p_subject_enrollment_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    exists (
      select 1 from subject_enrollments se
      join contracts c on c.id = se.contract_id
      where se.id = p_subject_enrollment_id and c.status = 'active'
    )
    and exists (
      select 1 from subject_enrollments se
      join entitlement_grants eg on eg.child_id = se.child_id
      join purchases p on p.id = eg.purchase_id_ref
      where se.id = p_subject_enrollment_id and p.status = 'succeeded'
    );
$$;
revoke execute on function public.subject_enrollment_activation_ready(uuid) from public, anon;
grant execute on function public.subject_enrollment_activation_ready(uuid) to authenticated, service_role;
comment on function public.subject_enrollment_activation_ready(uuid) is
  'R5: 정규 수강 활성화(planned→active)의 두 선행조건 — (1) 이 아이의 contracts_v3가 active,
   (2) 이 아이 앞으로 결제완료(purchases.status=succeeded)와 연결된 entitlement_grants가 최소 1건.
   둘 다 실측 조회 — fail closed(둘 중 하나라도 없으면 false).';

-- planned/paused → active 전이는 이 함수를 트리거로도 강제한다(서버 액션 우회 방지).
create or replace function public.enforce_subject_enrollment_activation_preconditions()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and (old.status is null or old.status is distinct from 'active') then
    if not subject_enrollment_activation_ready(new.id) then
      raise exception '과목 수강(%)을 active로 전환하려면 기본계약 active + 결제완료 수업권 부여가 먼저 필요합니다.', new.id;
    end if;
  end if;
  return new;
end;
$$;
create trigger subject_enrollments_enforce_activation
  before update of status on subject_enrollments
  for each row execute function public.enforce_subject_enrollment_activation_preconditions();
-- insert 시 default status는 'planned'라 트리거가 적용되지 않는다(활성화는 항상 UPDATE 경로).

-- ---------------------------------------------------------------------------
-- 2. 체험→정규 선생님 승계 자격
-- ---------------------------------------------------------------------------
create or replace function public.trial_teacher_succession_eligibility(
  p_teacher_id uuid,
  p_subject_id uuid
)
returns table (
  eligible boolean,
  is_active boolean,
  has_subject_qualification boolean,
  has_curriculum boolean,
  has_valid_rate boolean
)
language sql stable security definer set search_path = public as $$
  select
    (t.status = 'active' and tq.qualified and public.has_valid_current_teacher_rate(p_teacher_id)) as eligible,
    (t.status = 'active') as is_active,
    tq.qualified as has_subject_qualification,
    tq.has_curriculum as has_curriculum,
    public.has_valid_current_teacher_rate(p_teacher_id) as has_valid_rate
  from teachers t
  left join lateral (
    select
      exists (
        select 1 from teacher_curriculum_templates tct
        where tct.teacher_id = p_teacher_id and tct.subject_id = p_subject_id
      ) as qualified,
      exists (
        select 1 from teacher_curriculum_templates tct
        join teacher_curriculum_template_units u on u.template_id = tct.id
        where tct.teacher_id = p_teacher_id and tct.subject_id = p_subject_id
      ) as has_curriculum
  ) tq on true
  where t.id = p_teacher_id;
$$;
revoke execute on function public.trial_teacher_succession_eligibility(uuid, uuid) from public, anon;
grant execute on function public.trial_teacher_succession_eligibility(uuid, uuid) to authenticated, service_role;
comment on function public.trial_teacher_succession_eligibility(uuid, uuid) is
  'R5: 체험 선생님이 정규 선생님으로 기본 제안될 자격이 있는지. 과목 자격(teacher_curriculum_templates
   행 존재)과 커리큘럼 보유(그 템플릿에 unit이 1개 이상)는 독립적으로 반환 — 커리큘럼 미보유가
   자격 자체를 막지 않는다(spec). eligible은 active + 과목자격 + 유효 시급 3개 전부 필요.';

-- ---------------------------------------------------------------------------
-- 3. 선생님 변경 원자적 처리
-- ---------------------------------------------------------------------------
create or replace function public.change_teacher_assignment(
  p_subject_enrollment_id uuid,
  p_new_teacher_id uuid,
  p_effective_from timestamptz,
  p_reason text,
  p_changed_by uuid
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_current record;
  v_new_id uuid;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'p_reason은 비어 있을 수 없습니다.';
  end if;
  if not has_valid_current_teacher_rate(p_new_teacher_id) then
    raise exception '선생님(%)에게 유효한 현재 시급 이력이 없어 배정할 수 없습니다.', p_new_teacher_id;
  end if;

  -- 같은 수강의 기존 활성 배정을 잠가 동시 변경을 직렬화한다(시급 변경과 동일 패턴).
  perform 1 from teacher_assignments
    where subject_enrollment_id = p_subject_enrollment_id and status in ('planned', 'active')
    for update;

  select * into v_current from teacher_assignments
    where subject_enrollment_id = p_subject_enrollment_id and status = 'active'
    order by effective_from desc limit 1;

  if v_current.id is not null then
    if p_effective_from <= v_current.effective_from then
      raise exception '새 effective_from(%)은 기존 활성 배정의 effective_from(%)보다 이후여야 합니다.', p_effective_from, v_current.effective_from;
    end if;
    update teacher_assignments
      set status = 'ended', effective_until = p_effective_from
      where id = v_current.id;
  end if;

  insert into teacher_assignments (
    subject_enrollment_id, teacher_id, status, effective_from, reason, changed_by, source
  ) values (
    p_subject_enrollment_id, p_new_teacher_id, 'active', p_effective_from, p_reason, p_changed_by, 'app'
  )
  returning id into v_new_id;

  -- 채팅 스레드: 새 배정에 스레드 생성(없으면), 이전 배정 스레드는 과거 메시지 보존한 채 archived.
  update subject_threads
    set status = 'archived', archived_at = now()
    where subject_enrollment_id = p_subject_enrollment_id and status = 'active';

  insert into subject_threads (subject_enrollment_id, teacher_assignment_id, teacher_id, status)
  values (p_subject_enrollment_id, v_new_id, p_new_teacher_id, 'active')
  on conflict (teacher_assignment_id) do nothing;

  -- 문서 권한 재처리 큐: 이전 선생님 회수 + 새 선생님 부여, 둘 다 재시도 가능한 work-item.
  if v_current.id is not null then
    insert into document_permission_retries (subject_enrollment_id, teacher_id, action, reason)
    values (p_subject_enrollment_id, v_current.teacher_id, 'revoke', 'teacher_change:' || p_reason);
  end if;
  insert into document_permission_retries (subject_enrollment_id, teacher_id, action, reason)
  values (p_subject_enrollment_id, p_new_teacher_id, 'grant', 'teacher_change:' || p_reason);

  return v_new_id;
end;
$$;
revoke execute on function public.change_teacher_assignment(uuid, uuid, timestamptz, text, uuid) from public, anon, authenticated;
grant execute on function public.change_teacher_assignment(uuid, uuid, timestamptz, text, uuid) to service_role;
comment on function public.change_teacher_assignment(uuid, uuid, timestamptz, text, uuid) is
  'R5: 선생님 변경의 유일한 정상 경로. 기존 활성 배정 종료 + 신규 배정 생성 + 채팅 스레드
   archive/신규 생성 + 문서 권한 재처리 큐 등록을 하나의 트랜잭션으로 수행. 서버 액션(service_role)
   전용 — 관리자 화면에서만 호출. 확정된 미래 예약 처리는 이 함수의 책임이 아니다(R6, 호출부가
   change 실행 전 별도 조회로 안내만 한다).';

-- ---------------------------------------------------------------------------
-- 4. 과목별 채팅 스레드
-- ---------------------------------------------------------------------------
create table subject_threads (
  id uuid primary key default gen_random_uuid(),
  subject_enrollment_id uuid not null references subject_enrollments (id),
  teacher_assignment_id uuid not null references teacher_assignments (id),
  teacher_id uuid not null references profiles (id),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index subject_threads_one_per_assignment on subject_threads (teacher_assignment_id);
create index on subject_threads (subject_enrollment_id);
comment on table subject_threads is
  'R5: teacher_assignments 1건당 스레드 1개. 배정이 종료(archived)돼도 행은 남아 과거
   메시지 조회는 계속 가능 — 새 메시지 작성 권한만 화면단에서 status로 막는다(이전
   선생님이 새 메시지를 작성할 길은 애초에 활성 스레드가 아니므로 앱 레이어에서 차단).';

create table subject_thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references subject_threads (id) on delete cascade,
  sender_id uuid not null references profiles (id),
  text text not null,
  created_at timestamptz not null default now()
);
create index on subject_thread_messages (thread_id, created_at);

alter table subject_threads enable row level security;
alter table subject_thread_messages enable row level security;

create policy "subject_threads 조회" on subject_threads for select
  using (
    is_enrollment_child_or_guardian(subject_enrollment_id)
    or teacher_id = auth.uid()
    or is_admin() or current_user_has_capability('매칭권한')
  );
create policy "subject_threads 쓰기" on subject_threads for all
  using (is_admin() or current_user_has_capability('매칭권한'))
  with check (is_admin() or current_user_has_capability('매칭권한'));

create or replace function public.can_access_subject_thread(p_thread_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from subject_threads st
    where st.id = p_thread_id
      and (is_enrollment_child_or_guardian(st.subject_enrollment_id) or st.teacher_id = auth.uid())
  ) or is_admin();
$$;
revoke execute on function public.can_access_subject_thread(uuid) from public;
grant execute on function public.can_access_subject_thread(uuid) to anon, authenticated;

create policy "subject_thread_messages 조회" on subject_thread_messages for select
  using (can_access_subject_thread(thread_id) or is_admin());
-- 쓰기: 활성 스레드의 배정 교사 본인, 또는 아이/보호자만 — archived 스레드는 새 메시지 금지.
create policy "subject_thread_messages 작성" on subject_thread_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from subject_threads st
      where st.id = thread_id and st.status = 'active'
        and (st.teacher_id = auth.uid() or is_enrollment_child_or_guardian(st.subject_enrollment_id))
    )
  );

-- ---------------------------------------------------------------------------
-- 5. 커리큘럼 인계 자리(완성은 R9) — 배정 변경 시점 스냅샷용 관계만.
-- ---------------------------------------------------------------------------
alter table teacher_assignments add column curriculum_handoff_status text
  not null default 'not_applicable' check (curriculum_handoff_status in ('not_applicable', 'pending', 'done'));
comment on column teacher_assignments.curriculum_handoff_status is
  'R5: 선생님 변경 시 커리큘럼 인계가 필요한지 자리만 마련(placeholder) — 실제 인계 절차/화면은 R9.
   R5에서는 change_teacher_assignment()가 이전 배정이 있던 경우 신규 배정을 pending으로,
   최초 배정은 not_applicable로 남긴다. done 전이는 R9 구현 시 추가.';

-- ---------------------------------------------------------------------------
-- 6. 문서 권한 부여/회수 재처리 큐 (contract_activation_retries와 동일한 모양)
-- ---------------------------------------------------------------------------
create table document_permission_retries (
  id uuid primary key default gen_random_uuid(),
  subject_enrollment_id uuid not null references subject_enrollments (id),
  teacher_id uuid not null references profiles (id),
  action text not null check (action in ('grant', 'revoke')),
  reason text not null,
  status text not null default 'queued' check (status in ('queued', 'succeeded', 'failed', 'manual_review')),
  attempt_count int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles (id)
);
create index on document_permission_retries (status) where (status in ('queued', 'failed'));

comment on table document_permission_retries is
  'R5: 선생님 변경으로 발생하는 Drive 문서 권한 부여/회수를 재처리 가능한 work-item으로 큐잉.
   실제 Drive ACL 호출은 R8 범위 — 이 R5에서는 stub(lib/documents/permission-retry-worker.ts)가
   status를 큐 밖에서 처리하는 형태만 구현하고 실제 Drive API는 호출하지 않는다.
   contract_activation_retries(R3, 20260919000000)와 동일한 재시도 패턴.';

alter table document_permission_retries enable row level security;
create policy "document_permission_retries 관리자만 조회" on document_permission_retries for select
  using (is_admin() or current_user_has_capability('매칭권한'));
create policy "document_permission_retries 관리자만 갱신" on document_permission_retries for update
  using (is_admin() or current_user_has_capability('매칭권한'));
create policy "document_permission_retries service_role만 생성" on document_permission_retries for insert
  with check (false);
-- insert는 change_teacher_assignment()(SECURITY DEFINER)만 수행 — 일반 role은 직접 insert 불가.

-- change_teacher_assignment 최초 배정(v_current 없음)인 경우 curriculum_handoff_status는
-- 컬럼 기본값 'not_applicable' 그대로 두고, 승계/변경(v_current 존재)인 경우만 pending으로
-- 명시 갱신한다.
create or replace function public.mark_curriculum_handoff_pending_if_succession()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from teacher_assignments prior
    where prior.subject_enrollment_id = new.subject_enrollment_id
      and prior.id <> new.id
      and prior.status = 'ended'
  ) then
    new.curriculum_handoff_status := 'pending';
  end if;
  return new;
end;
$$;
create trigger teacher_assignments_curriculum_handoff
  before insert on teacher_assignments
  for each row execute function public.mark_curriculum_handoff_pending_if_succession();

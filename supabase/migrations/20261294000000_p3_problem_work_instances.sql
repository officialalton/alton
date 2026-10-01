-- P3 — 문제 풀이 인스턴스(풀이판) (2026-09-12)
--
-- 제품 오너 지적: `scope = problem_student|problem_teacher_feedback`만으로는
-- **여러 문제와 재풀이를 구분할 수 없다.** 각 필기 이벤트가 "어느 수업의 어느
-- 문제를 몇 번째로 푼 것"인지 가리켜야 한다.
--
-- 기존 `session_problem_attempts`를 쓰지 않은 이유: 그 테이블의 session_id는
-- **legacy_sessions**를 참조한다(v3 sessions가 아니다). v3 세션뷰의 풀이판을 거기에
-- 매달면 FK가 맞지 않는다. 그래서 v3 전용 풀이 인스턴스를 만들고, 레거시 테이블은
-- 건드리지 않는다.

-- =========================================================================
-- 1. 풀이 인스턴스
-- =========================================================================
create table session_problem_work (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  problem_id uuid not null references problems (id) on delete cascade,
  -- 수업 시작 시 고정된 버전. 이후 문제가 새 버전으로 공개돼도 이 풀이판은
  -- 당시 문제를 그대로 재현한다.
  problem_version_id uuid references problem_versions (id),
  -- 같은 문제를 다시 풀면 새 인스턴스(2회차, 3회차...)가 생긴다.
  attempt_no int not null default 1,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (session_id, student_id, problem_id, attempt_no)
);
create index on session_problem_work (session_id, student_id);
create index on session_problem_work (problem_id);

comment on table session_problem_work is
  'P3: 문제 풀이판 한 장. (수업, 학생, 문제, 회차) 단위이며 필기 이벤트가 이것을 참조한다 — '
  '같은 수업의 문제 1과 문제 2가 섞이지 않고, 같은 문제를 다시 풀어도 이전 풀이와 구분된다. '
  'problem_version_id로 수업 시작 시 고정된 문제 버전과 연결한다.';

alter table session_problem_work enable row level security;
-- 학생 본인과 담당 교사만. **보호자·다른 학생·다른 교사는 제외**한다.
create policy "풀이판 조회" on session_problem_work for select
  using (student_id = auth.uid() or public.is_session_teacher_v3(session_id) or is_admin());
-- 쓰기는 서버 액션(service_role)만 — 풀이판 생성은 세션 흐름이 만든다.

-- =========================================================================
-- 2. 필기 이벤트가 풀이판을 가리킨다
-- =========================================================================
alter table session_annotation_events
  add column if not exists problem_work_id uuid references session_problem_work (id) on delete cascade;

create index if not exists session_annotation_events_problem_work_idx
  on session_annotation_events (problem_work_id, seq);

-- 문제 범위는 **풀이판 참조가 필수**다(문제 id만으로는 재풀이를 구분할 수 없다).
alter table session_annotation_events
  drop constraint if exists session_annotation_events_scope_shape_check;
alter table session_annotation_events
  add constraint session_annotation_events_scope_shape_check
  check (
    (scope = 'teacher_shared' and owner_student_id is null and problem_id is null and problem_work_id is null)
    or (scope = 'student_private' and owner_student_id is not null and problem_id is null and problem_work_id is null)
    or (scope in ('problem_student', 'problem_teacher_feedback')
        and owner_student_id is not null and problem_id is not null and problem_work_id is not null)
  );

comment on column session_annotation_events.problem_work_id is
  'P3: 이 필기가 속한 풀이판. 문제 범위에서는 필수다 — 여러 문제와 재풀이를 구분하는 유일한 키다.';

-- 풀이판과 이벤트의 세션·학생·문제가 어긋나지 않게 막는다(앱 실수로 다른 학생의
-- 풀이판에 쓰는 것을 데이터 레벨에서 차단).
create or replace function public.check_annotation_problem_work_consistency()
returns trigger
language plpgsql as $$
declare
  v_work session_problem_work%rowtype;
begin
  if new.problem_work_id is null then
    return new;
  end if;
  select * into v_work from session_problem_work where id = new.problem_work_id;
  if not found then
    raise exception '존재하지 않는 풀이판입니다.';
  end if;
  if v_work.session_id <> new.session_id then
    raise exception '풀이판의 수업(%)과 필기의 수업(%)이 다릅니다.', v_work.session_id, new.session_id;
  end if;
  if v_work.student_id <> new.owner_student_id then
    raise exception '풀이판의 학생과 필기의 소유 학생이 다릅니다.';
  end if;
  if v_work.problem_id <> new.problem_id then
    raise exception '풀이판의 문제와 필기의 문제가 다릅니다.';
  end if;
  return new;
end;
$$;

create trigger session_annotation_events_problem_work_consistency
  before insert on session_annotation_events
  for each row execute function public.check_annotation_problem_work_consistency();
revoke execute on function public.check_annotation_problem_work_consistency() from public, anon, authenticated, service_role;

-- =========================================================================
-- 3. 필기 이벤트의 append-only는 **이미 보장돼 있다**
-- =========================================================================
-- `20261223000000_r8_session_annotation_events.sql`이 session_annotation_events_no_update
-- 트리거로 UPDATE·DELETE를 이미 막고 있다. 여기서 다시 만들지 않는다.
-- "담당 교사는 학생 원본 풀이를 읽기만 하고 수정·삭제할 수 없다"는 요구는 그 트리거 +
-- 범위별 INSERT 정책(교사는 problem_student에 쓸 수 없음)으로 충족되며,
-- 회귀를 막기 위해 통합 테스트가 두 가지를 모두 확인한다.

-- =========================================================================
-- 4. 풀이판 생성(재풀이 포함)
-- =========================================================================
-- 같은 문제를 다시 풀면 attempt_no를 올린 새 인스턴스를 만든다.
create or replace function public.start_problem_work(
  p_session_id uuid,
  p_student_id uuid,
  p_problem_id uuid,
  p_new_attempt boolean default false
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_existing session_problem_work%rowtype;
  v_next int;
  v_version_id uuid;
  v_id uuid;
begin
  if not exists (select 1 from sessions where id = p_session_id) then
    raise exception '존재하지 않는 수업입니다.';
  end if;

  select * into v_existing from session_problem_work
    where session_id = p_session_id and student_id = p_student_id and problem_id = p_problem_id
    order by attempt_no desc limit 1;

  -- 진행 중인 풀이판이 있고 재풀이가 아니면 그대로 쓴다(중복 생성 방지).
  if found and not p_new_attempt then
    return v_existing.id;
  end if;

  v_next := coalesce(v_existing.attempt_no, 0) + 1;

  -- 수업 시작 시 고정된 버전을 우선 쓰고, 없으면 현재 공개 버전을 쓴다.
  select coalesce(
    (select m.problem_version_id from session_content_manifest m
      where m.session_id = p_session_id and m.content_id = p_problem_id and m.problem_version_id is not null
      limit 1),
    (select p.published_version_id from problems p where p.id = p_problem_id)
  ) into v_version_id;

  insert into session_problem_work (session_id, student_id, problem_id, problem_version_id, attempt_no)
  values (p_session_id, p_student_id, p_problem_id, v_version_id, v_next)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.start_problem_work(uuid, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.start_problem_work(uuid, uuid, uuid, boolean) to service_role;

comment on function public.start_problem_work is
  'P3: 풀이판을 연다. 진행 중인 판이 있으면 재사용하고, p_new_attempt면 회차를 올려 새 판을 만든다 — '
  '이전 풀이는 그대로 남는다. 문제 버전은 수업 스냅샷에 고정된 것을 우선 쓴다.';

-- =========================================================================
-- 5. 공용 필기 쓰기 권한을 기존 동작으로 되돌린다 (정정)
-- =========================================================================
-- 20261292000000이 teacher_shared 쓰기를 교사로만 좁히면서 기존 동작 두 가지를
-- 없앴다(회귀 테스트가 잡았다):
--   ① 학생도 공용 캔버스에 그릴 수 있었다(R8 이후 실제 동작)
--   ② 관리자는 clear_all을 기록할 수 있었다(R9 corrective로 명시 추가된 것)
-- 확정 정책의 "교사 공용 필기: 교사와 학생이 함께 보는 설명용 필기"는 **가시성**을
-- 정의한 것이지 작성자를 교사로 제한한 문장이 아니다. 새로 못박힌 제한은
-- ② 학생 개인 필기는 교사가 못 본다 ③ 교사는 학생 원본 풀이를 못 쓴다 두 가지이며,
-- 그 둘은 아래에서 그대로 유지한다.
drop policy if exists "필기 범위별 기록" on session_annotation_events;
create policy "필기 범위별 기록" on session_annotation_events for insert
  with check (
    author_id = auth.uid()
    and public.current_account_access_allowed()
    and case scope
      -- 공용 필기: 세션 당사자면 쓸 수 있다(기존 동작). clear_all만 교사·관리자.
      when 'teacher_shared' then
        (public.is_session_related_v3(session_id) or is_admin())
        and (event_type <> 'clear_all' or public.is_session_teacher_v3(session_id) or is_admin())
      -- 개인 교재 필기는 본인만
      when 'student_private' then owner_student_id = auth.uid() and event_type <> 'clear_all'
      -- 학생 풀이는 학생 본인만 — 교사는 이 범위에 쓸 수 없다
      when 'problem_student' then owner_student_id = auth.uid() and event_type <> 'clear_all'
      -- 피드백 레이어는 담당 교사만
      when 'problem_teacher_feedback' then public.is_session_teacher_v3(session_id)
      else false
    end
  );

-- P3 — 필기 범위 4분할 + 회차↔실제 수업 연결 (2026-09-12)
--
-- 착수 문서: docs/2026-09-12-p2-p3-session-view-and-content-kickoff.md
-- 확정 정책(2026-09-12 제품 오너):
--   ① 교사 공용 필기      — 교사·학생이 함께 보는 설명용
--   ② 학생 개인 교재 필기 — 학생만 본다. **교사는 열람하지 않는다.**
--   ③ 문제 풀이 화이트보드 — 학생 풀이 + 교사 피드백을 **별도 레이어**로 보존.
--      교사는 학생 원본 풀이를 덮어쓰지 않는다.
--   ④ 교사 준비 초안      — 교사 전용. 수업 시작 시 자동 공개하지 않고,
--      교사가 명시적으로 공개한 것만 공용 필기가 된다.
--   그리고 같은 회차가 여러 실제 수업에 연결될 수 있다.
--
-- **기존 구현을 다시 만들지 않는다**: 필기 입력·실시간 동기화·이벤트 재생은
-- CanvasOverlay + session_annotation_events가 이미 한다. 여기서는 그 이벤트에
-- **범위(scope)** 를 붙여 누가 무엇을 보는지만 가른다.
--
-- 왜 canvas_annotations를 확장하지 않았나: 그 테이블의 session_id는
-- **legacy_sessions**를 참조하고 `unique(session_id, curriculum_doc_id)`라
-- "세션+교재당 한 장"을 전제한다. v3 4범위를 얹으면 레거시 경로가 깨진다.
-- v3 경로인 session_annotation_events(= sessions FK)를 확장한다.

-- =========================================================================
-- 1. 필기 이벤트에 범위를 붙인다
-- =========================================================================
alter table session_annotation_events
  add column if not exists scope text not null default 'teacher_shared',
  add column if not exists curriculum_doc_id uuid references curriculum_docs (id) on delete cascade,
  add column if not exists problem_id uuid references problems (id) on delete cascade,
  -- 개인 범위(학생 개인 필기·문제 풀이)의 주인. 공용 범위에서는 null.
  add column if not exists owner_student_id uuid references profiles (id) on delete cascade;

alter table session_annotation_events
  drop constraint if exists session_annotation_events_scope_check;
alter table session_annotation_events
  add constraint session_annotation_events_scope_check
  check (scope in ('teacher_shared', 'student_private', 'problem_student', 'problem_teacher_feedback'));

-- 범위별로 반드시 채워져야 하는 값이 다르다.
alter table session_annotation_events
  drop constraint if exists session_annotation_events_scope_shape_check;
alter table session_annotation_events
  add constraint session_annotation_events_scope_shape_check
  check (
    (scope = 'teacher_shared' and owner_student_id is null and problem_id is null)
    or (scope = 'student_private' and owner_student_id is not null and problem_id is null)
    or (scope in ('problem_student', 'problem_teacher_feedback')
        and owner_student_id is not null and problem_id is not null)
  );

create index if not exists session_annotation_events_scope_idx
  on session_annotation_events (session_id, scope, curriculum_doc_id, problem_id, owner_student_id, seq);

comment on column session_annotation_events.scope is
  'P3: 필기 범위. teacher_shared(교사 공용) / student_private(학생 개인 교재 필기 — 교사 열람 불가) / '
  'problem_student(학생 풀이) / problem_teacher_feedback(교사 피드백 레이어 — 학생 풀이를 덮어쓰지 않는다). '
  '교사 준비 초안은 회차에 귀속되므로 세션 테이블이 아니라 curriculum_unit_annotation_drafts에 있다.';

-- 읽기 권한: 범위마다 다르다. **student_private는 교사도 못 본다.**
drop policy if exists "세션 당사자/관리자 조회" on session_annotation_events;
create policy "필기 범위별 조회" on session_annotation_events for select
  using (
    case scope
      -- 공용 필기: 세션 당사자(교사·학생·보호자)와 관리자
      when 'teacher_shared' then
        public.is_session_related_v3(session_id) or is_admin() or current_user_has_capability('예약관리권한')
      -- 학생 개인 교재 필기: **본인만.** 교사·보호자·관리자 모두 제외한다.
      when 'student_private' then owner_student_id = auth.uid()
      -- 문제 풀이: 학생 본인과 담당 교사(수업 중·후 오답 원인 확인). 보호자는 제외.
      when 'problem_student' then
        owner_student_id = auth.uid() or public.is_session_teacher_v3(session_id) or is_admin()
      -- 교사 피드백 레이어: 학생 본인과 담당 교사
      when 'problem_teacher_feedback' then
        owner_student_id = auth.uid() or public.is_session_teacher_v3(session_id) or is_admin()
      else false
    end
  );

-- 쓰기 권한: 범위별 작성 주체를 DB가 강제한다.
-- (앱이 실수로 다른 범위에 써도 막힌다 — "교사가 학생 원본 풀이를 덮어쓰지 않는다"는
--  화면 규칙이 아니라 데이터 규칙이어야 한다.)
drop policy if exists "세션 당사자 기록, clear_all은 선생님만" on session_annotation_events;
create policy "필기 범위별 기록" on session_annotation_events for insert
  with check (
    author_id = auth.uid()
    and public.current_account_access_allowed()
    and case scope
      -- 공용 필기와 clear_all은 교사만
      when 'teacher_shared' then public.is_session_teacher_v3(session_id)
      -- 개인 교재 필기는 본인만
      when 'student_private' then owner_student_id = auth.uid() and event_type <> 'clear_all'
      -- 학생 풀이는 학생 본인만 — 교사는 이 범위에 쓸 수 없다
      when 'problem_student' then owner_student_id = auth.uid() and event_type <> 'clear_all'
      -- 피드백 레이어는 담당 교사만
      when 'problem_teacher_feedback' then public.is_session_teacher_v3(session_id)
      else false
    end
  );

-- =========================================================================
-- 2. 교사 준비 초안 — 회차에 귀속(세션이 없어도 존재한다)
-- =========================================================================
create table curriculum_unit_annotation_drafts (
  id uuid primary key default gen_random_uuid(),
  overlay_unit_id uuid not null references curriculum_overlay_units (id) on delete cascade,
  curriculum_doc_id uuid not null references curriculum_docs (id) on delete cascade,
  author_id uuid not null references profiles (id) on delete cascade,
  strokes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (overlay_unit_id, curriculum_doc_id, author_id)
);
create index on curriculum_unit_annotation_drafts (overlay_unit_id);

comment on table curriculum_unit_annotation_drafts is
  'P3: 교사 준비 초안 필기. **회차**에 귀속되므로 예약·세션이 없어도 존재한다. 교사 전용이며 '
  '수업 시작으로 자동 공개되지 않는다 — publish_teacher_draft_to_session()으로 교사가 명시적으로 '
  '공개한 것만 공용 필기가 된다.';

alter table curriculum_unit_annotation_drafts enable row level security;
create policy "작성 교사 본인·관리자 조회" on curriculum_unit_annotation_drafts for select
  using (author_id = auth.uid() or is_admin());
create policy "작성 교사 본인 쓰기" on curriculum_unit_annotation_drafts for all
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- 명시적 공개: 초안을 그 세션의 공용 필기 이벤트로 복사한다.
-- 초안 자체는 남는다(다음 수업에서 다시 쓸 수 있어야 한다).
create or replace function public.publish_teacher_draft_to_session(
  p_draft_id uuid,
  p_session_id uuid,
  p_actor_id uuid
)
returns int
language plpgsql
security definer set search_path = public as $$
declare
  v_draft curriculum_unit_annotation_drafts%rowtype;
  v_stroke jsonb;
  v_count int := 0;
begin
  select * into v_draft from curriculum_unit_annotation_drafts where id = p_draft_id;
  if not found then
    raise exception '존재하지 않는 준비 초안입니다.';
  end if;
  if v_draft.author_id <> p_actor_id then
    raise exception '본인이 만든 준비 초안만 공개할 수 있습니다.';
  end if;
  if not exists (select 1 from sessions s where s.id = p_session_id and s.teacher_id = p_actor_id) then
    raise exception '담당 수업에만 준비 초안을 공개할 수 있습니다.';
  end if;

  for v_stroke in select * from jsonb_array_elements(v_draft.strokes)
  loop
    insert into session_annotation_events (session_id, author_id, event_type, payload, scope, curriculum_doc_id)
    values (p_session_id, p_actor_id, 'stroke', v_stroke, 'teacher_shared', v_draft.curriculum_doc_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.publish_teacher_draft_to_session(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.publish_teacher_draft_to_session(uuid, uuid, uuid) to service_role;

-- =========================================================================
-- 3. 회차 ↔ 실제 수업 연결 (같은 회차가 여러 수업에 붙을 수 있다)
-- =========================================================================
create table session_curriculum_units (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  overlay_unit_id uuid not null references curriculum_overlay_units (id) on delete cascade,
  role text not null default 'primary' check (role in ('primary', 'supplement')),
  created_at timestamptz not null default now(),
  unique (session_id, overlay_unit_id)
);
create index on session_curriculum_units (overlay_unit_id);
-- 한 수업의 기본 회차는 하나뿐이다(보강 회차는 여러 개 가능).
create unique index session_curriculum_units_one_primary
  on session_curriculum_units (session_id) where role = 'primary';

comment on table session_curriculum_units is
  'P3: 실제 수업이 어떤 회차를 다뤘는지. 같은 회차가 여러 수업에 연결될 수 있고(재수업·보강), '
  '한 수업은 기본 회차 1개 + 보강 회차 N개를 가진다. 준비 구성은 회차에서 공통으로 관리하고 '
  '수업별 필기·풀이·진행 기록은 세션에 붙는다.';

alter table session_curriculum_units enable row level security;
create policy "세션 당사자·관리자 조회" on session_curriculum_units for select
  using (public.is_session_related_v3(session_id) or is_admin() or current_user_has_capability('예약관리권한'));
-- 쓰기는 서버 액션(service_role)만.

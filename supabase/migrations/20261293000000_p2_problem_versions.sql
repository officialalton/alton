-- P2 — 문제 버전 관리 (2026-09-12)
--
-- 착수 문서: docs/2026-09-12-p2-p3-session-view-and-content-kickoff.md
-- 확정 정책(2026-09-12 제품 오너): **문제 수정은 즉시 반영하지 않는다.**
-- 수정하면 새 **버전 초안**이 생기고, **검수·공개**를 거친 뒤에야 이후 수업에서
-- 쓸 최신 버전이 된다. 이미 시작했거나 종료된 수업은 **당시 스냅샷을 유지**한다.
--
-- 구조 원칙(정책 §3): 여러 학생이 같은 문제를 풀어도 본문을 복제하지 않는다.
-- 본문은 버전 행 하나에만 있고, 수업·과제·답안은 그 버전을 **참조**한다.
--
-- 기존 problems 테이블은 문제의 **정체성**(어떤 과목·단원의 몇 번 문제인가)으로
-- 남기고, 바뀌는 내용(본문·보기·정답·해설·난이도)을 버전으로 뺀다. 기존 컬럼은
-- 지우지 않는다 — 이미 쓰는 화면이 있고, 1번 버전으로 이관해 둘을 일치시킨다.

-- =========================================================================
-- 1. 버전 테이블
-- =========================================================================
create table problem_versions (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references problems (id) on delete cascade,
  version_no int not null,
  -- 내용(문제은행이 관리하는 실제 본문)
  passage text,
  options jsonb,
  correct_index int,
  explanation text,
  difficulty text,
  -- 검수 흐름: draft → in_review → published. 되돌리기는 archived.
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'archived')),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  published_at timestamptz,
  published_by uuid references profiles (id),
  unique (problem_id, version_no)
);
create index on problem_versions (problem_id, status);

-- 공개된 버전은 문제당 **하나**뿐이다(= "이후 수업에서 쓸 최신 버전").
create unique index problem_versions_one_published
  on problem_versions (problem_id) where status = 'published';

comment on table problem_versions is
  'P2: 문제 내용의 버전. 수정은 새 초안을 만들고 검수·공개를 거쳐야 최신이 된다. 과거 수업이 참조한 '
  '버전은 보존되며, 수정이 과거 문제·정답·기존 채점 결과를 바꾸지 않는다.';

alter table problem_versions enable row level security;
-- 조회: 관리자·작성자는 모든 버전, 그 외에는 problems 조회 권한이 있는 사람이 공개 버전만.
create policy "문제 버전 조회" on problem_versions for select
  using (
    is_admin()
    or created_by = auth.uid()
    or (status = 'published' and exists (select 1 from problems p where p.id = problem_id))
  );
-- 쓰기는 서버 액션(service_role)만 — 검수 흐름을 앱이 건너뛰지 못하게 한다.

-- =========================================================================
-- 2. 문제 본체는 "현재 공개 버전"을 가리킨다
-- =========================================================================
alter table problems
  add column if not exists published_version_id uuid references problem_versions (id);

comment on column problems.published_version_id is
  'P2: 지금 사용할 공개 버전. 새 수업·과제는 이 버전을 참조하고, 이미 시작·종료된 수업은 '
  '스냅샷에 박힌 버전을 그대로 쓴다.';

-- 기존 문제를 1번 버전으로 이관한다(내용 손실 없이 버전 체계로 들어오게 한다).
do $$
declare
  v_row record;
  v_version_id uuid;
begin
  for v_row in select * from problems loop
    insert into problem_versions (
      problem_id, version_no, passage, options, correct_index, explanation, difficulty,
      status, created_by, published_at, published_by
    ) values (
      v_row.id, 1, v_row.passage, v_row.options, v_row.correct_index, v_row.explanation,
      v_row.difficulty::text,
      -- 이미 확정된 문제만 공개 버전으로 본다. 그 외는 초안으로 둔다.
      case when v_row.status::text = 'confirmed' then 'published' else 'draft' end,
      v_row.created_by,
      case when v_row.status::text = 'confirmed' then v_row.created_at else null end,
      case when v_row.status::text = 'confirmed' then v_row.created_by else null end
    )
    returning id into v_version_id;

    if v_row.status::text = 'confirmed' then
      update problems set published_version_id = v_version_id where id = v_row.id;
    end if;
  end loop;
end;
$$;

-- =========================================================================
-- 3. 수정 → 검수 → 공개
-- =========================================================================
-- 수정은 언제나 **새 초안**을 만든다. 기존 공개 버전은 그대로 둔다.
create or replace function public.create_problem_draft_version(
  p_problem_id uuid,
  p_passage text,
  p_options jsonb,
  p_correct_index int,
  p_explanation text,
  p_difficulty text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_next int;
  v_id uuid;
begin
  if not exists (select 1 from problems where id = p_problem_id) then
    raise exception '존재하지 않는 문제입니다.';
  end if;
  -- 검수 대기 중인 초안이 이미 있으면 새로 만들지 않는다(초안이 쌓여 어느 것이
  -- 검수 대상인지 모호해지는 것을 막는다).
  if exists (select 1 from problem_versions where problem_id = p_problem_id and status in ('draft', 'in_review')) then
    raise exception '이미 작업 중인 버전이 있습니다. 그 버전을 수정하거나 공개·보류한 뒤에 새로 만드세요.';
  end if;

  select coalesce(max(version_no), 0) + 1 into v_next from problem_versions where problem_id = p_problem_id;

  insert into problem_versions (
    problem_id, version_no, passage, options, correct_index, explanation, difficulty, status, created_by
  ) values (
    p_problem_id, v_next, p_passage, p_options, p_correct_index, p_explanation, p_difficulty, 'draft', p_actor_id
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.submit_problem_version_for_review(p_version_id uuid, p_actor_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update problem_versions
    set status = 'in_review', submitted_at = now()
    where id = p_version_id and status = 'draft';
  if not found then
    raise exception '초안 상태의 버전만 검수 요청할 수 있습니다.';
  end if;
  perform p_actor_id;
end;
$$;

-- 공개: 이 시점부터 **이후 수업**이 이 버전을 쓴다. 과거 수업은 영향받지 않는다.
create or replace function public.publish_problem_version(p_version_id uuid, p_actor_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_version problem_versions%rowtype;
begin
  select * into v_version from problem_versions where id = p_version_id for update;
  if not found then
    raise exception '존재하지 않는 문제 버전입니다.';
  end if;
  if v_version.status <> 'in_review' then
    raise exception '검수 중인 버전만 공개할 수 있습니다(현재: %). 먼저 검수 요청하세요.', v_version.status;
  end if;

  -- 이전 공개 버전은 보관 처리한다(삭제하지 않는다 — 과거 수업이 참조한다).
  update problem_versions
    set status = 'archived'
    where problem_id = v_version.problem_id and status = 'published';

  update problem_versions
    set status = 'published', published_at = now(), published_by = p_actor_id
    where id = p_version_id;

  update problems set published_version_id = p_version_id where id = v_version.problem_id;
end;
$$;

revoke execute on function public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid) to service_role;
revoke execute on function public.submit_problem_version_for_review(uuid, uuid) from public, anon, authenticated;
grant execute on function public.submit_problem_version_for_review(uuid, uuid) to service_role;
revoke execute on function public.publish_problem_version(uuid, uuid) from public, anon, authenticated;
grant execute on function public.publish_problem_version(uuid, uuid) to service_role;

-- =========================================================================
-- 4. 스냅샷이 버전을 가리키게 한다
-- =========================================================================
-- 수업 시작 시 고정하는 목록(session_content_manifest)에 문제 버전을 함께 박는다.
-- 교재는 이미 published_doc_version_at_pin으로 같은 일을 하고 있다.
alter table session_content_manifest
  add column if not exists problem_version_id uuid references problem_versions (id);

comment on column session_content_manifest.problem_version_id is
  'P2: 수업 시작 시점에 고정한 문제 버전. 이후 문제가 새 버전으로 공개돼도 이미 시작·종료된 수업은 '
  '이 버전을 그대로 재현한다.';

-- =========================================================================
-- 5. 새 문제도 반드시 1번 버전을 갖는다
-- =========================================================================
-- 이관(§2)은 기존 문제만 처리한다. 앞으로 만들어지는 문제가 버전 없이 생기면
-- "모든 문제는 버전을 가진다"는 전제가 깨지고, 스냅샷이 가리킬 대상도 없어진다.
create or replace function public.create_initial_problem_version()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_version_id uuid;
begin
  insert into problem_versions (
    problem_id, version_no, passage, options, correct_index, explanation, difficulty,
    status, created_by, published_at, published_by
  ) values (
    new.id, 1, new.passage, new.options, new.correct_index, new.explanation, new.difficulty::text,
    case when new.status::text = 'confirmed' then 'published' else 'draft' end,
    new.created_by,
    case when new.status::text = 'confirmed' then now() else null end,
    case when new.status::text = 'confirmed' then new.created_by else null end
  ) returning id into v_version_id;

  if new.status::text = 'confirmed' then
    update problems set published_version_id = v_version_id where id = new.id;
  end if;

  return new;
end;
$$;

create trigger problems_create_initial_version
  after insert on problems
  for each row execute function public.create_initial_problem_version();
revoke execute on function public.create_initial_problem_version() from public, anon, authenticated, service_role;

-- 초안으로 만들어진 문제가 나중에 확정되면 그 1번 버전을 공개로 올린다.
create or replace function public.publish_initial_problem_version_on_confirm()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_version_id uuid;
begin
  if new.status::text = 'confirmed' and old.status::text <> 'confirmed' and new.published_version_id is null then
    select id into v_version_id from problem_versions
      where problem_id = new.id and status = 'draft'
      order by version_no asc limit 1;
    if v_version_id is not null then
      update problem_versions
        set status = 'published', published_at = now(), published_by = new.created_by
        where id = v_version_id;
      new.published_version_id := v_version_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger problems_publish_initial_version_on_confirm
  before update on problems
  for each row execute function public.publish_initial_problem_version_on_confirm();
revoke execute on function public.publish_initial_problem_version_on_confirm() from public, anon, authenticated, service_role;

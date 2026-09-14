-- R9 — 커리큘럼 콘텐츠 기반 1/N: 과목별 공용 키워드 사전 + 콘텐츠 관계 테이블
--
-- 배경(docs/superpowers/specs/2026-09-07-curriculum-content-session-design.md §2,
-- docs/superpowers/plans/2026-09-07-curriculum-content-foundation.md Task 1):
-- 키워드는 과목별 공용 사전으로 관리하고(자유 태그 아님), 단원/교재 조각/문제는
-- 공용 키워드에 연결된다. "선생님이 실제로 고를 수 있는" 관계는 공개된
-- 교재(curriculum_docs.status = 'published')와 확정된 문제(problems.status =
-- 'confirmed')만 들어갈 수 있다 — 이 불변식은 트리거로 DB 레벨에서 강제한다
-- (R8 material_version_id 불변식·R10 paid 전이 트리거와 동일한 패턴).
--
-- 콘텐츠 원본 생성·검수·공개는 관리자만 한다(스펙 §7) — 이 테이블들의 쓰기는
-- 전부 is_admin()만 허용하고 선생님/학생 쓰기는 명시적으로 거부한다.

create type keyword_status as enum ('active', 'archived');

-- =========================================================================
-- 1. 과목별 공용 키워드 사전
-- =========================================================================

create table subject_keywords (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects (id) on delete cascade,
  label text not null,
  normalized_label text not null,
  status keyword_status not null default 'active',
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (subject_id, normalized_label)
);
create index on subject_keywords (subject_id);

comment on table subject_keywords is
  'R9: 과목별 공용 키워드 사전(스펙 §2). 같은 라벨이라도 과목이 다르면 별개 키워드 — unique는 (subject_id, normalized_label)에만 건다.';
comment on column subject_keywords.normalized_label is
  '중복 검사용 정규화 라벨(trim + lower). 트리거로만 채우고 앱에서 직접 넣지 않는다.';

create or replace function public.subject_keywords_normalize()
returns trigger
language plpgsql as $$
begin
  new.normalized_label := lower(trim(new.label));
  if new.normalized_label = '' then
    raise exception '키워드 라벨은 비워둘 수 없습니다.';
  end if;
  -- 관리자 화면에서 만든 서버 액션이 인증된 관리자 신원으로만 created_by를
  -- 채우도록, 클라이언트가 보낸 값 대신 항상 auth.uid()로 덮어쓴다.
  new.created_by := auth.uid();
  return new;
end;
$$;

create trigger subject_keywords_normalize_before_write
  before insert or update on subject_keywords
  for each row execute function public.subject_keywords_normalize();

alter table subject_keywords enable row level security;

create policy "인증된 사용자 전체 조회" on subject_keywords for select
  using (auth.uid() is not null);
create policy "관리자만 쓰기" on subject_keywords for all
  using (is_admin()) with check (is_admin());

-- =========================================================================
-- 2. 단원 ↔ 키워드
-- =========================================================================

create table subject_template_unit_keywords (
  unit_id uuid not null references subject_template_units (id) on delete cascade,
  keyword_id uuid not null references subject_keywords (id) on delete cascade,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  primary key (unit_id, keyword_id)
);
create index on subject_template_unit_keywords (keyword_id);

comment on table subject_template_unit_keywords is
  'R9: 과목 템플릿 단원 ↔ 공용 키워드 관계(스펙 §2). 단원의 subject_id와 키워드의 subject_id가 일치해야 한다(트리거로 강제).';

create or replace function public.check_unit_keyword_same_subject()
returns trigger
language plpgsql as $$
declare
  v_unit_subject uuid;
  v_keyword_subject uuid;
begin
  select subject_id into v_unit_subject from subject_template_units where id = new.unit_id;
  select subject_id into v_keyword_subject from subject_keywords where id = new.keyword_id;
  if v_unit_subject is null or v_keyword_subject is null then
    raise exception '존재하지 않는 단원 또는 키워드입니다.';
  end if;
  if v_unit_subject <> v_keyword_subject then
    raise exception '단원과 키워드는 같은 과목이어야 합니다.';
  end if;
  new.created_by := auth.uid();
  return new;
end;
$$;

create trigger subject_template_unit_keywords_check_subject
  before insert or update on subject_template_unit_keywords
  for each row execute function public.check_unit_keyword_same_subject();

alter table subject_template_unit_keywords enable row level security;
create policy "인증된 사용자 전체 조회" on subject_template_unit_keywords for select
  using (auth.uid() is not null);
create policy "관리자만 쓰기" on subject_template_unit_keywords for all
  using (is_admin()) with check (is_admin());

-- =========================================================================
-- 3. 교재 조각(section) ↔ 키워드 — 공개된 문서의 섹션만 "지도용 선택 가능" 관계에 들어간다
-- =========================================================================

create table curriculum_doc_section_keywords (
  section_id uuid not null references curriculum_doc_sections (id) on delete cascade,
  keyword_id uuid not null references subject_keywords (id) on delete cascade,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  primary key (section_id, keyword_id)
);
create index on curriculum_doc_section_keywords (keyword_id);

comment on table curriculum_doc_section_keywords is
  'R9: 교재 조각(curriculum_doc_sections) ↔ 공용 키워드. 이 관계에 들어가려면 상위 curriculum_docs.status = ''published''이어야 한다(트리거 강제, 스펙 §1/§8 "검수·공개 상태만 지도용 선택 가능").';

create or replace function public.check_section_keyword_published()
returns trigger
language plpgsql as $$
declare
  v_doc_status doc_status;
  v_doc_subject uuid;
  v_keyword_subject uuid;
begin
  select d.status, d.subject_id into v_doc_status, v_doc_subject
  from curriculum_doc_sections s
  join curriculum_docs d on d.id = s.curriculum_doc_id
  where s.id = new.section_id;

  if v_doc_status is null then
    raise exception '존재하지 않는 교재 조각입니다.';
  end if;
  if v_doc_status <> 'published' then
    raise exception '공개(published)되지 않은 교재는 지도용 키워드 관계에 연결할 수 없습니다.';
  end if;

  select subject_id into v_keyword_subject from subject_keywords where id = new.keyword_id;
  if v_keyword_subject is null then
    raise exception '존재하지 않는 키워드입니다.';
  end if;
  if v_doc_subject <> v_keyword_subject then
    raise exception '교재와 키워드는 같은 과목이어야 합니다.';
  end if;

  new.created_by := auth.uid();
  return new;
end;
$$;

create trigger curriculum_doc_section_keywords_check_published
  before insert or update on curriculum_doc_section_keywords
  for each row execute function public.check_section_keyword_published();

alter table curriculum_doc_section_keywords enable row level security;
create policy "인증된 사용자 전체 조회" on curriculum_doc_section_keywords for select
  using (auth.uid() is not null);
create policy "관리자만 쓰기" on curriculum_doc_section_keywords for all
  using (is_admin()) with check (is_admin());

-- 상위 교재가 나중에 draft/rejected로 되돌아가도 기존 관계 행이 남아 "선택
-- 가능"한 상태로 오해되지 않도록, curriculum_docs.status가 published에서
-- 벗어나면 관련 관계를 함께 정리한다(하드 삭제 대신 published로만 재검수 후
-- 다시 태그하는 것을 기본 흐름으로 둔다 — 이력 보존보다 "미공개 콘텐츠 노출
-- 금지"가 우선이므로 삭제를 택한다).
create or replace function public.cleanup_section_keywords_on_unpublish()
returns trigger
language plpgsql as $$
begin
  if old.status = 'published' and new.status <> 'published' then
    delete from curriculum_doc_section_keywords
    where section_id in (select id from curriculum_doc_sections where curriculum_doc_id = new.id);
  end if;
  return new;
end;
$$;

create trigger curriculum_docs_cleanup_section_keywords
  after update of status on curriculum_docs
  for each row execute function public.cleanup_section_keywords_on_unpublish();

-- =========================================================================
-- 4. 문제 ↔ 키워드 — 확정(confirmed) 문제만 "지도용 선택 가능" 관계에 들어간다
-- =========================================================================

create table problem_keywords (
  problem_id uuid not null references problems (id) on delete cascade,
  keyword_id uuid not null references subject_keywords (id) on delete cascade,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  primary key (problem_id, keyword_id)
);
create index on problem_keywords (keyword_id);

comment on table problem_keywords is
  'R9: 문제(problems) ↔ 공용 키워드. status = ''confirmed''인 문제만 이 관계에 들어갈 수 있다(트리거 강제) — draft(AI 초안 포함)는 관리자 확정 전까지 지도용으로 선택되지 않는다.';

create or replace function public.check_problem_keyword_confirmed()
returns trigger
language plpgsql as $$
declare
  v_problem_status problem_status;
  v_problem_subject uuid;
  v_keyword_subject uuid;
begin
  select status, subject_id into v_problem_status, v_problem_subject
  from problems where id = new.problem_id;

  if v_problem_status is null then
    raise exception '존재하지 않는 문제입니다.';
  end if;
  if v_problem_status <> 'confirmed' then
    raise exception '확정(confirmed)되지 않은 문제는 지도용 키워드 관계에 연결할 수 없습니다.';
  end if;

  select subject_id into v_keyword_subject from subject_keywords where id = new.keyword_id;
  if v_keyword_subject is null then
    raise exception '존재하지 않는 키워드입니다.';
  end if;
  if v_problem_subject is not null and v_problem_subject <> v_keyword_subject then
    raise exception '문제와 키워드는 같은 과목이어야 합니다.';
  end if;

  new.created_by := auth.uid();
  return new;
end;
$$;

create trigger problem_keywords_check_confirmed
  before insert or update on problem_keywords
  for each row execute function public.check_problem_keyword_confirmed();

alter table problem_keywords enable row level security;
create policy "인증된 사용자 전체 조회" on problem_keywords for select
  using (auth.uid() is not null);
create policy "관리자만 쓰기" on problem_keywords for all
  using (is_admin()) with check (is_admin());

-- 문제가 나중에 draft로 되돌아가면(예: 오류 발견 후 재검수) 관계도 함께 정리한다.
create or replace function public.cleanup_problem_keywords_on_unconfirm()
returns trigger
language plpgsql as $$
begin
  if old.status = 'confirmed' and new.status <> 'confirmed' then
    delete from problem_keywords where problem_id = new.id;
  end if;
  return new;
end;
$$;

create trigger problems_cleanup_problem_keywords
  after update of status on problems
  for each row execute function public.cleanup_problem_keywords_on_unconfirm();

revoke execute on function public.subject_keywords_normalize() from public, anon, authenticated, service_role;
revoke execute on function public.check_unit_keyword_same_subject() from public, anon, authenticated, service_role;
revoke execute on function public.check_section_keyword_published() from public, anon, authenticated, service_role;
revoke execute on function public.cleanup_section_keywords_on_unpublish() from public, anon, authenticated, service_role;
revoke execute on function public.check_problem_keyword_confirmed() from public, anon, authenticated, service_role;
revoke execute on function public.cleanup_problem_keywords_on_unconfirm() from public, anon, authenticated, service_role;

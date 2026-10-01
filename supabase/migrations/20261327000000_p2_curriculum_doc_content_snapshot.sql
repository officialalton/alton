-- P2 6차 — 교재 내용을 버전 행에 실제로 보존한다.
--
-- 2026-09-13 확인된 기존 결함: 교재의 '버전'이 시각(updated_at)일 뿐이고 본문은
-- curriculum_doc_sections 에 한 벌만 있었다. 고정된 교재를 읽는 경로도 그 표를 id 로
-- 읽으므로, 교재를 고치면 **과거 수업 화면의 내용까지 함께 바뀌었다.**
-- curriculum_doc_versions(snapshot jsonb)는 초기 스키마에 있었지만 아무도 채우지
-- 않았다. 이제 채운다.
--
-- 보존 범위(2026-09-13 지시 4번): 섹션 본문뿐 아니라 **순서·제목·teaching_tip·섹션
-- 식별자**까지 담는다. 섹션 id 를 담는 이유는 필기·주석이 섹션을 id 로 가리키기
-- 때문이다 — id 가 빠지면 과거 필기를 어디에 붙여야 할지 알 수 없다.
--
-- **한계를 분명히 한다**: 본문 안에서 참조하는 외부 파일(Drive 등)은 참조만 보존된다.
-- 그 파일이 교체·삭제되면 과거 내용도 달라진다. 파일 자체의 사본을 뜨는 것은 이
-- 마이그레이션의 범위가 아니다.

-- =========================================================================
-- 1. 버전 행에 출처와 공개 시각을 남긴다
-- =========================================================================
alter table curriculum_doc_versions
  add column origin text not null default 'publish'
    check (origin in ('publish', 'current_content_baseline')),
  add column published_at timestamptz,
  add column note text;

comment on column curriculum_doc_versions.origin is
  'P2 6차: publish = 공개할 때 뜬 스냅샷. current_content_baseline = 스냅샷 제도가 '
  '생기기 전부터 공개돼 있던 교재의 **현재 내용 기준 생성본**. 과거 공개 시점의 '
  '내용을 복원한 것이 아니다 — 그때 무엇이었는지는 어디에도 남아 있지 않다.';
comment on column curriculum_doc_versions.note is
  'P2 6차: 이 버전이 왜 만들어졌는지. current_content_baseline 이면 생성 사유를 적는다.';

-- =========================================================================
-- 2. 지금 내용으로 스냅샷을 뜬다
-- =========================================================================
create or replace function public.curriculum_doc_snapshot(p_doc_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'docId', d.id,
    'title', d.title,
    'subjectId', d.subject_id,
    'unitId', d.unit_id,
    'capturedAt', now(),
    'sections', coalesce(
      (select jsonb_agg(
         jsonb_build_object(
           -- 섹션 id 를 보존한다. 필기·주석이 섹션을 id 로 가리키므로 이게 빠지면
           -- 과거 필기를 어디에 붙여야 할지 알 수 없다.
           'id', s.id,
           'position', s.position,
           'title', s.title,
           'body', s.body,
           'teachingTip', s.teaching_tip
         ) order by s.position
       )
       from curriculum_doc_sections s where s.curriculum_doc_id = d.id),
      '[]'::jsonb
    )
  )
  from curriculum_docs d where d.id = p_doc_id;
$$;

comment on function public.curriculum_doc_snapshot(uuid) is
  'P2 6차: 교재의 지금 내용을 그대로 담은 jsonb. 섹션 id·순서·제목·본문·teaching_tip 을 '
  '보존한다. 본문이 참조하는 외부 파일은 참조만 담긴다.';

-- 다음 버전 번호. **1이라고 가정하지 않는다** — 이미 버전 행이 있는 교재가 있다.
create or replace function public.next_curriculum_doc_version_number(p_doc_id uuid)
returns int
language sql
stable
as $$
  select coalesce(max(version_number), 0) + 1
  from curriculum_doc_versions where curriculum_doc_id = p_doc_id;
$$;

-- =========================================================================
-- 3. 공개할 때 스냅샷을 남긴다
-- =========================================================================
-- 공개된 버전은 고치지 않는다. 이후 수정·재공개는 새 버전으로 만든다.
create or replace function public.capture_curriculum_doc_version(
  p_doc_id uuid,
  p_origin text default 'publish',
  p_note text default null
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into curriculum_doc_versions
    (curriculum_doc_id, version_number, snapshot, origin, published_at, note, created_by)
  values (
    p_doc_id,
    public.next_curriculum_doc_version_number(p_doc_id),
    public.curriculum_doc_snapshot(p_doc_id),
    p_origin,
    case when p_origin = 'publish' then now() else null end,
    p_note,
    auth.uid()
  )
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.capture_curriculum_doc_version(uuid, text, text) is
  'P2 6차: 교재의 지금 내용으로 새 버전 행을 만든다. 기존 버전은 건드리지 않는다.';

-- 교재가 공개 상태가 되면 그 시점 내용을 남긴다. 이미 공개였다가 내용만 바뀐 것은
-- 여기서 잡지 않는다 — 재공개는 앱이 capture_curriculum_doc_version 을 명시적으로
-- 부른다("공개한 버전은 수정하지 않고, 이후 수정·재공개는 새 버전으로").
create or replace function public.curriculum_docs_capture_on_publish()
returns trigger
language plpgsql as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform public.capture_curriculum_doc_version(new.id, 'publish', null);
  end if;
  return null;
end;
$$;

create trigger curriculum_docs_capture_version
  after insert or update of status on curriculum_docs
  for each row execute function public.curriculum_docs_capture_on_publish();

-- =========================================================================
-- 4. 구성이 가리키는 버전
-- =========================================================================
alter table subject_template_unit_materials
  add column curriculum_doc_version_id uuid references curriculum_doc_versions (id);
alter table teacher_curriculum_template_unit_materials
  add column curriculum_doc_version_id uuid references curriculum_doc_versions (id);
alter table curriculum_overlay_unit_materials
  add column curriculum_doc_version_id uuid references curriculum_doc_versions (id);

comment on column subject_template_unit_materials.curriculum_doc_version_id is
  'P2 6차: 담던 시점의 교재 버전 행. 내용이 그 행에 보존돼 있으므로, 이후 교재를 고쳐도 '
  '이 구성이 가리키는 내용은 바뀌지 않는다. null 은 스냅샷 제도 이전에 담긴 것이다.';

create or replace function public.current_curriculum_doc_version_id(p_doc_id uuid)
returns uuid
language sql
stable
as $$
  select id from curriculum_doc_versions
  where curriculum_doc_id = p_doc_id
  order by version_number desc
  limit 1;
$$;

-- 어느 경로로 들어와도 채워지도록 테이블에 건다. 값이 주어지면 존중한다 —
-- 상속이 상위가 쓰던 버전을 그대로 물려줄 때 덮어쓰면 안 된다.
create or replace function public.fill_unit_material_version()
returns trigger
language plpgsql as $$
begin
  if new.doc_version_at_pick is null then
    select d.updated_at into new.doc_version_at_pick
    from curriculum_docs d where d.id = new.curriculum_doc_id;
  end if;
  if new.curriculum_doc_version_id is null then
    new.curriculum_doc_version_id := public.current_curriculum_doc_version_id(new.curriculum_doc_id);
  end if;
  return new;
end;
$$;

-- =========================================================================
-- 5. 전달된 버전이 그 교재의 것인지 확인한다
-- =========================================================================
-- "버전 값이 주어지면 존중"하되 아무 버전이나 받지 않는다(2026-09-13 지시 4번).
create or replace function public.check_unit_material_version_belongs()
returns trigger
language plpgsql as $$
declare
  v_doc uuid;
begin
  if new.curriculum_doc_version_id is null then
    return new;
  end if;
  select curriculum_doc_id into v_doc
  from curriculum_doc_versions where id = new.curriculum_doc_version_id;
  if v_doc is null or v_doc <> new.curriculum_doc_id then
    raise exception '이 교재의 버전이 아닙니다.';
  end if;
  return new;
end;
$$;

create trigger subject_template_unit_materials_check_version
  before insert or update on subject_template_unit_materials
  for each row execute function public.check_unit_material_version_belongs();

create trigger teacher_curriculum_template_unit_materials_check_version
  before insert or update on teacher_curriculum_template_unit_materials
  for each row execute function public.check_unit_material_version_belongs();

create trigger curriculum_overlay_unit_materials_check_version
  before insert or update on curriculum_overlay_unit_materials
  for each row execute function public.check_unit_material_version_belongs();

-- 문제도 같게 확인한다 — 전달된 버전이 그 문제의 것인지.
create or replace function public.check_unit_problem_version_belongs()
returns trigger
language plpgsql as $$
declare
  v_problem uuid;
begin
  if new.problem_version_id is null then
    return new;
  end if;
  select problem_id into v_problem
  from problem_versions where id = new.problem_version_id;
  if v_problem is null or v_problem <> new.problem_id then
    raise exception '이 문제의 버전이 아닙니다.';
  end if;
  return new;
end;
$$;

create trigger subject_template_unit_problems_check_version
  before insert or update on subject_template_unit_problems
  for each row execute function public.check_unit_problem_version_belongs();

create trigger teacher_curriculum_template_unit_problems_check_version
  before insert or update on teacher_curriculum_template_unit_problems
  for each row execute function public.check_unit_problem_version_belongs();

-- =========================================================================
-- 6. 기존 공개 교재의 현재 내용 기준 생성본
-- =========================================================================
-- 확정된 기준(2026-09-13): 기존 공개 교재의 **현재 본문**으로 앞으로 쓸 기준 버전을
-- 만든다. 이것은 과거 공개 시점의 내용을 복원한 것이 **아니다** — 그때 무엇이었는지는
-- 어디에도 남아 있지 않고, 복원 근거가 없는 것을 복원했다고 기록하지 않는다.
--
-- 만든 버전을 기존 준비안이나 과거 매니페스트에 **연결하지 않는다.** 당시 그것을
-- 골랐다는 근거가 없기 때문이다. 버전이 없는 준비안은 사람이 보고 고르게 한다.
do $$
declare
  v_doc record;
begin
  for v_doc in
    select d.id
    from curriculum_docs d
    where d.status = 'published'
      and d.archived_at is null
      and not exists (
        select 1 from curriculum_doc_versions v where v.curriculum_doc_id = d.id
      )
  loop
    perform public.capture_curriculum_doc_version(
      v_doc.id,
      'current_content_baseline',
      '스냅샷 제도 도입(20261327000000) 시점의 현재 내용으로 만든 기준 버전. '
      '과거 공개 시점의 내용을 복원한 것이 아니다.'
    );
  end loop;
end;
$$;

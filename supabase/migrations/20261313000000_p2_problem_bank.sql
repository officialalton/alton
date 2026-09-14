-- P2 3차 — 관리자 문제은행.
--
-- 지금 문제는 교재 섹션 편집기 안에서만 만들어진다(section_id에 매달림). 그래서
-- "이 과목의 문제를 모아 보고, 검색하고, 검수하고, 공개한다"를 할 자리가 없다.
-- 문제은행은 교재와 독립된 진입점이어야 한다.
--
-- 버전 흐름(draft → in_review → published, 이전 공개본은 archived)은
-- 20261293000000에 이미 있다. 여기서 더하는 것은 은행으로서 필요한 두 가지다:
-- 문제 자체의 보관, 그리고 섹션 없이 문제를 만드는 경로.

-- =========================================================================
-- 1. 문제 보관
-- =========================================================================
-- 교재(20261311000000)와 같은 모양. status(draft/confirmed)와 직교하는 축이다.
-- **보관은 숨김이지 삭제가 아니다.** 과거 수업에 고정된 문제와 학생의 풀이·
-- 답안 기록은 그대로 남고, 그 조회는 id로 하므로 영향받지 않는다.
alter table problems add column archived_at timestamptz;
alter table problems add column archived_reason text;
create index on problems (archived_at);

comment on column problems.archived_at is
  'P2 3차: 문제 보관 시각. 보관된 문제는 신규 선택·자동 구성 후보에서 빠지지만 '
  '기존 연결과 과거 풀이 기록은 그대로 조회된다(삭제가 아니다).';

-- 자동 구성 후보에서 보관 문제를 뺀다. 이 뷰는 "선생님이 고를 수 있는 문제"의
-- 원본이므로(R9 corrective 2) 여기서 한 번만 막으면 모든 선택 경로가 따른다.
create or replace view public.problem_keywords_selectable
with (security_invoker = true) as
select k.problem_id, k.keyword_id, k.created_by, k.created_at
from problem_keywords k
join problems p on p.id = k.problem_id
where p.status = 'confirmed' and p.archived_at is null;

comment on view public.problem_keywords_selectable is
  'R9 corrective 2 + P2 3차: 확정됐고 보관되지 않은 문제의 키워드만. 선택 가능 '
  '여부를 관계 존재만으로 판단하지 않는다.';

-- =========================================================================
-- 2. 섹션 없이 문제를 만든다
-- =========================================================================
-- 문제은행에서 새로 쓰는 문제는 교재 섹션에 매달리지 않는다. 나중에 교재에
-- 붙일 수는 있지만, 붙이지 않아도 존재할 수 있어야 한다.
--
-- **초안으로만 만든다.** 만들자마자 공개되는 경로를 두지 않는다 — 공개는
-- publish_problem_version()을 거쳐야 하고, 그 함수는 검수를 통과한 버전만 받는다.
create or replace function public.create_bank_problem(
  p_subject_id uuid,
  p_format text,
  p_skill_type text,
  p_difficulty text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from subjects where id = p_subject_id and archived_at is null) then
    raise exception '보관되지 않은 과목을 골라야 합니다.';
  end if;

  insert into problems (format, subject_id, status, created_by, skill_type, difficulty)
  values (
    p_format::problem_format,
    p_subject_id,
    'draft',
    p_actor_id,
    nullif(p_skill_type, ''),
    nullif(p_difficulty, '')::problem_difficulty
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function create_bank_problem(uuid, text, text, text, uuid) is
  'P2 3차: 문제은행에서 교재 섹션 없이 문제를 만든다. 항상 draft로 시작하며 '
  '공개는 별도 검수 경로(publish_problem_version)를 거친다.';

revoke execute on function public.create_bank_problem(uuid, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_bank_problem(uuid, text, text, text, uuid) to service_role;

-- =========================================================================
-- 3. 공개된 버전이 문제 본문에 반영되도록
-- =========================================================================
-- problems.published_version_id는 있는데 공개 시 채워주는 곳이 없었다. 세션뷰는
-- 문제 본문을 problems에서 읽으므로, 공개해도 화면이 그대로인 구멍이 생긴다.
create or replace function public.publish_problem_version(p_version_id uuid, p_actor_id uuid)
returns void
language plpgsql
security definer set search_path = public as $$
declare
  v_version problem_versions;
begin
  select * into v_version from problem_versions where id = p_version_id;
  if v_version is null then
    raise exception '존재하지 않는 버전입니다.';
  end if;
  if v_version.status <> 'in_review' then
    raise exception '검수 중인 버전만 공개할 수 있습니다(현재: %). 먼저 검수 요청하세요.', v_version.status;
  end if;

  update problem_versions
    set status = 'archived'
    where problem_id = v_version.problem_id and status = 'published';

  update problem_versions
    set status = 'published', published_at = now(), published_by = p_actor_id
    where id = p_version_id;

  -- 공개된 내용이 문제 본문이 된다. 이게 없으면 검수를 통과해도 학생 화면은
  -- 옛 내용을 계속 보여준다.
  update problems
    set passage = v_version.passage,
        options = v_version.options,
        correct_index = v_version.correct_index,
        explanation = v_version.explanation,
        difficulty = coalesce(nullif(v_version.difficulty, '')::problem_difficulty, difficulty),
        status = 'confirmed',
        published_version_id = p_version_id
    where id = v_version.problem_id;
end;
$$;

-- =========================================================================
-- 4. 작업 중인 초안은 새로 만드는 게 아니라 고친다
-- =========================================================================
-- problems에 행이 생기면 트리거가 대응하는 버전을 만든다(20261293000000). 그래서
-- 문제은행에서 "초안 쓰기"를 누르면 create_problem_draft_version()이 "이미 작업
-- 중인 버전이 있습니다"로 막힌다 — 방금 만든 빈 문제인데도.
--
-- 그 제약 자체는 옳다(초안이 쌓여 어느 것이 검수 대상인지 모호해지는 것을 막는다).
-- 필요한 건 "있으면 고치고 없으면 만든다"는 저장 경로다.
--
-- 검수 중(in_review)인 버전은 고치지 않는다. 검수자가 보고 있는 내용이 발밑에서
-- 바뀌면 무엇을 승인한 것인지 알 수 없다.
create or replace function public.save_problem_draft_version(
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
  v_existing problem_versions;
begin
  if not exists (select 1 from problems where id = p_problem_id) then
    raise exception '존재하지 않는 문제입니다.';
  end if;

  select * into v_existing
  from problem_versions
  where problem_id = p_problem_id and status in ('draft', 'in_review')
  order by version_no desc
  limit 1;

  if v_existing.id is not null and v_existing.status = 'in_review' then
    raise exception '검수 중인 버전은 고칠 수 없습니다. 공개하거나 새 초안을 만드세요.';
  end if;

  if v_existing.id is not null then
    update problem_versions
      set passage = p_passage,
          options = p_options,
          correct_index = p_correct_index,
          explanation = p_explanation,
          difficulty = p_difficulty,
          created_by = p_actor_id
      where id = v_existing.id;
    return v_existing.id;
  end if;

  return create_problem_draft_version(
    p_problem_id, p_passage, p_options, p_correct_index, p_explanation, p_difficulty, p_actor_id
  );
end;
$$;

comment on function save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid) is
  'P2 3차: 작업 중인 초안이 있으면 고치고 없으면 만든다. 검수 중인 버전은 건드리지 '
  '않는다 — 검수자가 본 내용이 바뀌면 무엇을 승인한 것인지 알 수 없다.';

revoke execute on function public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid)
  to service_role;

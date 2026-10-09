-- P2 8차 — 문제 공개를 한 번에, 그리고 기록을 사실대로.
--
-- 2026-09-13 제품 오너 지시:
--   "'검수 요청' 클릭은 없애되 공개 전 지문·선택지·정답·해설을 미리보고 확인하는
--    흐름은 유지합니다."
--   "내부의 초안 → 검수 중 → 공개 처리는 중간 실패로 상태가 어긋나지 않도록
--    합니다. 실제 별도 검수자가 승인한 것처럼 기록하지 않습니다."
--
-- 앱이 submit → publish 를 두 번 왕복으로 부르고 있었다. 앞이 성공하고 뒤가
-- 실패하면 버전은 'in_review' 에 갇힌다 — 화면에는 공개 버튼만 남고, 누가
-- 검수 중인지도 알 수 없는 상태다. 한 트랜잭션으로 묶는다.
--
-- 기록도 손본다. 지금은 submitted_at 만 남아 "누군가 검수를 요청했다"처럼
-- 보이지만, 실제로는 관리자 본인이 확인하고 바로 공개한 것이다. 그 사실을
-- 그대로 적는다.

alter table problem_versions add column if not exists submitted_by uuid references profiles (id);
alter table problem_versions add column if not exists review_kind text
  check (review_kind in ('self_confirmed', 'separate_reviewer'));

comment on column problem_versions.submitted_by is
  'P2 8차: 이 버전을 공개 대상으로 올린 사람. published_by 와 같으면 작성자 본인이 '
  '확인하고 공개한 것이다.';

comment on column problem_versions.review_kind is
  'P2 8차: 어떤 확인을 거쳤는가. self_confirmed = 관리자 본인이 내용을 확인하고 공개. '
  'separate_reviewer = 작성자와 다른 사람이 승인. **별도 검수자가 없었는데 있었던 것처럼 '
  '기록하지 않기 위한 칸이다.** 검수자 역할 분리는 아직 없으므로 지금은 전부 '
  'self_confirmed 로 남는다.';

-- =========================================================================
-- 확인하고 공개한다 — 한 트랜잭션
-- =========================================================================
-- draft → in_review → published 순서 자체는 그대로 둔다(20261293000000 이 그
-- 전이를 강제하고, 나중에 검수자 역할이 생기면 중간 단계가 다시 쓰인다). 다만
-- 사용자에게 한 동작인 것을 DB 에서도 한 동작으로 처리한다.
create or replace function public.confirm_and_publish_problem_version(
  p_version_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer set search_path = public as $$
declare
  v_problem_id uuid;
  v_status text;
begin
  select problem_id, status into v_problem_id, v_status
  from problem_versions where id = p_version_id;

  if v_problem_id is null then
    raise exception '존재하지 않는 문제 버전입니다.';
  end if;

  -- 같은 문제에 대한 동시 공개를 직렬화한다. problem_versions_one_published 는
  -- 문제당 공개본을 하나로 묶는 unique index 라, 두 요청이 겹치면 하나가 깨진다.
  perform pg_advisory_xact_lock(hashtextextended(v_problem_id::text, 91));

  select status into v_status from problem_versions where id = p_version_id for update;

  if v_status = 'published' then
    -- 중복 클릭이다. 이미 이 버전이 공개돼 있으므로 아무것도 하지 않는다.
    return;
  end if;

  if v_status = 'archived' then
    raise exception '지난 공개본은 다시 공개할 수 없습니다. 수정 초안을 만들어 공개하세요.';
  end if;

  if v_status = 'draft' then
    update problem_versions
      set status = 'in_review',
          submitted_at = now(),
          submitted_by = p_actor_id
      where id = p_version_id;
  end if;

  perform public.publish_problem_version(p_version_id, p_actor_id);

  update problem_versions
    set review_kind = case
          when submitted_by is null or submitted_by = p_actor_id then 'self_confirmed'
          else 'separate_reviewer'
        end
    where id = p_version_id;
end;
$$;

comment on function public.confirm_and_publish_problem_version(uuid, uuid) is
  'P2 8차: 관리자가 내용을 확인하고 공개한다. draft → in_review → published 를 한 '
  '트랜잭션에서 처리해 중간 실패로 상태가 갇히지 않게 한다. 이미 공개된 버전이면 '
  '아무것도 하지 않는다(중복 클릭). 별도 검수자가 승인한 것처럼 기록하지 않는다 — '
  'review_kind 에 self_confirmed 로 남는다.';

revoke execute on function public.confirm_and_publish_problem_version(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.confirm_and_publish_problem_version(uuid, uuid) to service_role;

-- =========================================================================
-- 문제를 만들 때 주제도 함께
-- =========================================================================
-- 20261333000000 이 topic 칸을 더했지만 생성 경로가 받지 않아 만든 뒤에 따로
-- 채워야 했다. 유형과 주제는 둘 다 선택 항목이라 비어도 된다.
create or replace function public.create_bank_problem(
  p_subject_id uuid,
  p_format text,
  p_skill_type text,
  p_topic text,
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

  insert into problems (format, subject_id, status, created_by, skill_type, topic, difficulty)
  values (
    p_format::problem_format,
    p_subject_id,
    'draft',
    p_actor_id,
    nullif(p_skill_type, ''),
    nullif(p_topic, ''),
    nullif(p_difficulty, '')::problem_difficulty
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.create_bank_problem(uuid, text, text, text, text, uuid) is
  'P2 8차: 문제은행에서 교재 섹션 없이 문제를 만든다. 유형(skill_type)과 주제(topic)는 '
  '둘 다 선택 항목이다. 항상 draft 로 시작하며 공개는 확인 절차를 거친다.';

revoke execute on function public.create_bank_problem(uuid, text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_bank_problem(uuid, text, text, text, text, uuid) to service_role;

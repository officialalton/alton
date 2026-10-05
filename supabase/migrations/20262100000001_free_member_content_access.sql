-- =========================================================================
-- 2026-10-05 무료 학습 회원 S2 — 모의고사 공개 티어·일일 상한·누적 약점 요약
-- docs/briefs/2026-10-05-free-member-tutoring-design.md §2.1(mock_exam 행)·§5.1(…0001)·결정 7-1·7-10
--
-- 추가만 한다(과외 회원의 동작 변화 0):
--   1) mock_exam_sets.access_tier='free' 규칙을 DB가 강제(트리거): 공개(published)·보관 아님·
--      (MST면 readiness_status='ready')인 세트만 무료 지정 가능. 무료였던 세트가 조건을 잃으면
--      (보관/비공개/문항 부족) 자동으로 'tutoring'으로 내린다 — 조건을 잃는 UPDATE 자체를 막으면
--      기존 "공개 시 이전 버전 자동 보관"(publishMockExamSet) 흐름이 깨지기 때문.
--   2) mock_exam_open_catalog / mock_exam_open_start: 무료 회원(is_free_member)은 access_tier='free'
--      세트만 보고 시작할 수 있다. 과외 회원은 종전처럼 전부. 기존 응시(멱등 반환)는 티어와 무관.
--   3) 무료 회원 일일 응시 시작 상한 2회(UTC 날짜 기준, mock_exam_attempts.created_at). 결정 7-10.
--   4) mock_exam_weakness_summary(student): 채점 확정(graded) 응시 전체의 영역/세부기술 누적 정답률.
--      열람 권한은 기존 _mock_exam_can_view(본인·보호자·담당 교사·컨설턴트·관리자) 그대로.
--      집계는 SQL(답안×세트 문항, 문항 오류 판정 조정 반영), 표시 이름·약점 순위는 TS(lib/mock-exam/report.ts
--      weakSkills·taxonomy 표시명)에서 — 응시 1회 리포트와 같은 규칙을 쓴다.
-- 아래 두 open RPC 본문은 2026-10-05 로컬·원격 적용본(20261995000000)을 그대로 복사한 뒤 티어·상한만 더했다.
-- =========================================================================

-- 1) access_tier 규칙 ----------------------------------------------------------
create or replace function public.mock_exam_sets_guard_access_tier()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_eligible boolean;
begin
  if new.access_tier = 'free' then
    v_eligible := new.status = 'published' and new.archived_at is null
                  and (new.format <> 'mst' or new.readiness_status = 'ready');
    if not v_eligible then
      if tg_op = 'INSERT' or old.access_tier is distinct from 'free' then
        raise exception '무료 공개는 공개(published)·보관 아님·문항 구성 완료(MST는 ready) 세트만 지정할 수 있습니다.';
      end if;
      -- 무료였던 세트가 조건을 잃음(보관/비공개/문항 부족) → 자동으로 과외 전용으로.
      new.access_tier := 'tutoring';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists mock_exam_sets_guard_access_tier on mock_exam_sets;
create trigger mock_exam_sets_guard_access_tier
  before insert or update of access_tier, status, archived_at, readiness_status, format on mock_exam_sets
  for each row execute function public.mock_exam_sets_guard_access_tier();

-- 2)+3) 카탈로그·시작 RPC ------------------------------------------------------
create or replace function public.mock_exam_open_start(p_exam_set_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_s mock_exam_sets%rowtype;
  v_id uuid;
  v_free boolean;
  v_today_count integer;
begin
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists (select 1 from students where id = v_uid and status = 'active') then
    raise exception '활성 학생만 모의고사를 시작할 수 있습니다.';
  end if;
  select * into v_s from mock_exam_sets where id = p_exam_set_id;
  if v_s.id is null then raise exception '존재하지 않는 시험입니다.'; end if;

  -- 멱등: 이 시험(세트 계열)의 응시가 이미 있으면(기존 배정분 포함) 그대로 돌려준다.
  select id into v_id from mock_exam_attempts where student_id = v_uid and exam_set_group_id = v_s.set_group_id;
  if v_id is not null then return v_id; end if;

  if v_s.status <> 'published' or v_s.archived_at is not null then
    raise exception '공개된 시험만 시작할 수 있습니다.';
  end if;
  if v_s.format = 'mst' and v_s.readiness_status <> 'ready' then
    raise exception '이 시험의 문항 구성이 완료되지 않아 시작할 수 없습니다. 관리자에게 문의해 주세요.';
  end if;

  -- 2026-10-05 무료 회원: 무료 공개 세트만, 하루(UTC) 2회까지 시작.
  v_free := is_free_member(v_uid);
  if v_free then
    if v_s.access_tier <> 'free' then
      raise exception '이 시험은 과외 회원에게만 공개됩니다.';
    end if;
    select count(*) into v_today_count from mock_exam_attempts
      where student_id = v_uid
        and created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');
    if v_today_count >= 2 then
      raise exception '무료 회원은 하루에 모의고사 2회까지 시작할 수 있습니다. 내일 다시 시도해 주세요.';
    end if;
  end if;

  insert into mock_exam_attempts (student_id, exam_set_id, exam_set_group_id)
  values (v_uid, v_s.id, v_s.set_group_id)
  on conflict (student_id, exam_set_group_id) do nothing
  returning id into v_id;
  if v_id is null then
    -- 동시 시작 경쟁에서 진 쪽: 먼저 들어간 응시를 돌려준다.
    select id into v_id from mock_exam_attempts where student_id = v_uid and exam_set_group_id = v_s.set_group_id;
  end if;
  return v_id;
end $$;
revoke execute on function public.mock_exam_open_start(uuid) from public, anon;
grant execute on function public.mock_exam_open_start(uuid) to authenticated, service_role;

create or replace function public.mock_exam_open_catalog(p_student_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_free boolean;
begin
  if not _mock_exam_can_view(p_student_id) then
    raise exception '이 학생의 모의고사 정보를 볼 권한이 없습니다.';
  end if;
  v_free := is_free_member(p_student_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'examSetId', s.id, 'setGroupId', s.set_group_id, 'name', s.name, 'description', s.description,
      'difficultyTier', s.difficulty_tier, 'format', s.format, 'publishedAt', s.published_at,
      'accessTier', s.access_tier,
      'attemptId', a.id, 'attemptStatus', a.status
    ) order by s.published_at desc nulls last, s.name)
    from mock_exam_sets s
    left join mock_exam_attempts a on a.exam_set_group_id = s.set_group_id and a.student_id = p_student_id
    where s.status = 'published' and s.archived_at is null
      and (s.format <> 'mst' or s.readiness_status = 'ready')
      -- 2026-10-05 무료 회원은 무료 공개 세트만(이미 응시한 세트는 티어와 무관하게 계속 보인다).
      and (not v_free or s.access_tier = 'free' or a.id is not null)
  ), '[]'::jsonb);
end $$;
revoke execute on function public.mock_exam_open_catalog(uuid) from public, anon;
grant execute on function public.mock_exam_open_catalog(uuid) to authenticated, service_role;

-- 4) 누적 약점 요약 ----------------------------------------------------------------
-- 반환: { attemptCount, gradedAttemptCount, byDomain: [{key, section, total, correct}], bySkill: [...] }
-- graded 응시의 답안(mock_exam_answers.correct가 null이 아닌 것)만 집계. 문항 오류 판정 조정
-- (mock_exam_answer_adjustments, superseded_at is null)은 조정 후 정오로 대체 — 응시 1회 리포트
-- (_mock_exam_attempt_detail_v4)와 같은 기준이다.
create or replace function public.mock_exam_weakness_summary(p_student_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_attempts integer;
  v_graded integer;
  v_domain jsonb;
  v_skill jsonb;
begin
  if not _mock_exam_can_view(p_student_id) then
    raise exception '이 학생의 모의고사 기록을 볼 권한이 없습니다.';
  end if;
  select count(*), count(*) filter (where status = 'graded') into v_attempts, v_graded
    from mock_exam_attempts where student_id = p_student_id;

  with graded as (
    select ans.set_item_id, i.section, i.sat_domain, i.skill_code,
           coalesce(adj.adjusted_correct, ans.correct) as correct
    from mock_exam_attempts a
    join mock_exam_answers ans on ans.attempt_id = a.id
    join mock_exam_set_items i on i.id = ans.set_item_id
    left join mock_exam_answer_adjustments adj
      on adj.attempt_id = a.id and adj.set_item_id = ans.set_item_id and adj.superseded_at is null
    where a.student_id = p_student_id and a.status = 'graded' and ans.correct is not null
  ),
  dom as (
    select sat_domain as key, min(section) as section, count(*) as total, count(*) filter (where correct) as correct
    from graded where sat_domain is not null group by sat_domain
  ),
  skl as (
    select skill_code as key, min(section) as section, count(*) as total, count(*) filter (where correct) as correct
    from graded where skill_code is not null group by skill_code
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object('key', key, 'section', section, 'total', total, 'correct', correct) order by key) from dom), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('key', key, 'section', section, 'total', total, 'correct', correct) order by key) from skl), '[]'::jsonb)
    into v_domain, v_skill;

  return jsonb_build_object(
    'attemptCount', v_attempts,
    'gradedAttemptCount', v_graded,
    'byDomain', v_domain,
    'bySkill', v_skill
  );
end $$;
revoke execute on function public.mock_exam_weakness_summary(uuid) from public, anon;
grant execute on function public.mock_exam_weakness_summary(uuid) to authenticated, service_role;
comment on function public.mock_exam_weakness_summary(uuid) is
  '2026-10-05 무료 회원 S2 — 채점 확정 응시 전체의 영역/세부기술 누적 정답률(조정 채점 반영). 열람은 _mock_exam_can_view.';

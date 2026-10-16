-- 정답·해설은 교사 채점 뒤에만 학생·학부모에게 (2026-09-29 포털 점검 #9)
--
-- 문제: `문제 버전 조회` 정책이 status='published' 인 버전을 모든 인증 사용자에게 열어
-- 학생·학부모가 REST 로 correct_index / explanation / answers / answer_rationale 등을
-- 직접 읽을 수 있었다. 앱 payload 에서만 지키던 규칙이라 우회가 가능했다.
--
-- 수정: (1) 테이블 직접 조회는 관리자·작성자·담당 과목 교사·그 버전을 고정한 수업의 교사에게만.
-- (2) 학생·학부모(수업 관계자)는 새 definer 함수 session_problem_versions 로만 읽는다 —
--     정답·해설·answers 는 관리자·수업 교사, 또는 **가장 최근 풀이가 채점된 문제**에만 채워 준다.
-- (3) 그림 서명 URL 확인용 problem_figure_visible 도 함수로 옮긴다(학생이 그림을 볼 수 있어야 한다).
-- additive: 데이터 변경 없음. 되돌리기는 이 정책을 20261339000000 의 정의로 다시 만들면 된다.

drop policy if exists "문제 버전 조회" on problem_versions;
create policy "문제 버전 조회" on problem_versions for select
  using (
    is_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from problems p
      where p.id = problem_id and public.is_teacher_of_subject(p.subject_id)
    )
    -- 그 버전을 고정한 수업의 담당 교사(과목 담당이 아니어도 자기 수업 문제는 읽는다).
    or exists (
      select 1 from session_content_manifest m
      where m.problem_version_id = problem_versions.id and public.is_session_teacher_v3(m.session_id)
    )
    or exists (
      select 1 from session_homework_items h
      where h.problem_version_id = problem_versions.id and public.is_session_teacher_v3(h.session_id)
    )
  );

comment on policy "문제 버전 조회" on problem_versions is
  '2026-09-29: 관리자·작성자·담당 과목 교사·고정 수업의 교사만. 학생·학부모는 정답·해설이 들어 있어 '
  '직접 조회 불가 — session_problem_versions() 로만 읽는다.';

-- 수업·과제 문제 버전 — 학생·학부모·교사·관리자용. 정답 계열 컬럼은 공개 조건을 만족할 때만 채운다.
create or replace function public.session_problem_versions(
  p_session_id uuid,
  p_version_ids uuid[],
  p_source text default 'lesson'
)
returns table (
  id uuid,
  problem_id uuid,
  passage text,
  question text,
  options jsonb,
  difficulty text,
  figure jsonb,
  statements jsonb,
  correct_index int,
  explanation text,
  answers jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with caller as (
    select
      (public.is_session_related_v3(p_session_id) or public.is_admin()) as allowed,
      (public.is_admin() or public.is_session_teacher_v3(p_session_id)) as staff,
      (select se.child_id from sessions s join subject_enrollments se on se.id = s.subject_enrollment_id
        where s.id = p_session_id) as student_id
  ),
  in_session as (
    select cm.content_id as problem_id, cm.problem_version_id as version_id
      from session_content_manifest cm
      where cm.session_id = p_session_id and cm.content_type = 'problem'
    union all
    select h.problem_id, h.problem_version_id
      from session_homework_items h
      where h.session_id = p_session_id
  ),
  latest_graded as (
    select distinct on (w.problem_id) w.problem_id, (w.graded_at is not null) as graded
      from session_problem_work w, caller c
      where w.session_id = p_session_id and w.student_id = c.student_id and w.source = p_source
      order by w.problem_id, w.attempt_no desc
  )
  select
    v.id, v.problem_id, v.passage, v.question, v.options, v.difficulty, v.figure, v.statements,
    case when c.staff or coalesce(g.graded, false) then v.correct_index end,
    case when c.staff or coalesce(g.graded, false) then v.explanation end,
    case when c.staff or coalesce(g.graded, false) then v.answers end
  from caller c
  join problem_versions v on c.allowed and v.id = any (p_version_ids)
  left join latest_graded g on g.problem_id = v.problem_id
  where exists (
    select 1 from in_session s
    where s.version_id = v.id
       or (s.version_id is null and v.status = 'published' and v.problem_id = s.problem_id)
  );
$$;

revoke all on function public.session_problem_versions(uuid, uuid[], text) from public, anon;
grant execute on function public.session_problem_versions(uuid, uuid[], text) to authenticated;

comment on function public.session_problem_versions(uuid, uuid[], text) is
  '2026-09-29: 수업 관계자가 그 수업에 고정된 문제 버전을 읽는다. correct_index/explanation/answers 는 '
  '관리자·수업 교사 또는 가장 최근 풀이가 채점된 문제에만. 호출자 권한(auth.uid) 기준.';

-- 문제 그림 열람 가능 여부 — 서명 URL 을 만들기 전 확인. 그림은 정답이 아니므로 공개 버전은 모두에게,
-- 그 외(비공개·보관)는 예전 정책과 같은 사람에게.
create or replace function public.problem_figure_visible(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from problem_versions v
    where v.figure->>'path' = p_path
      and (
        v.status = 'published'
        or public.is_admin()
        or v.created_by = auth.uid()
        or exists (select 1 from problems p where p.id = v.problem_id and public.is_teacher_of_subject(p.subject_id))
        or exists (
          select 1 from session_content_manifest m
          where m.problem_version_id = v.id and (public.is_session_related_v3(m.session_id) or public.is_admin())
        )
        or exists (
          select 1 from session_homework_items h
          where h.problem_version_id = v.id and (public.is_session_related_v3(h.session_id) or public.is_admin())
        )
      )
  );
$$;

revoke all on function public.problem_figure_visible(text) from public, anon;
grant execute on function public.problem_figure_visible(text) to authenticated;

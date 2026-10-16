-- P2 10차 — 문제은행 조회를 **담당 과목**으로 좁힌다.
--
-- 2026-09-13 제품 오너: "공개·미보관 문제를 모든 교사에게 연 것인지, 담당 과목으로
-- 제한한 것인지 명시해주세요. 기존 담당 과목 기준을 유지하고 문제 버전 조회에도
-- 같은 접근 범위를 적용합니다."
--
-- 20261338000000 은 role in ('teacher','admin') 이기만 하면 열었다. 과목 경계를
-- 넘는다. 담당 과목 기준(teacher_curriculum_templates — '내 과목')으로 좁힌다.
--
-- 버전도 같은 범위로 연다. 지금 정책은 비관리자에게 **공개 상태 버전만** 보여주는데,
-- 준비안이 v1 을 고정한 뒤 v2 가 공개되면 v1 은 archived 가 된다 — 즉 선생님이
-- 자기가 준비한 바로 그 버전을 못 읽는다. 담당 과목 문제의 버전은 상태와 무관하게
-- 읽을 수 있어야 "당시 버전을 그대로 본다"가 성립한다.

create or replace function public.is_teacher_of_subject(p_subject_id uuid)
returns boolean
language sql stable
security definer set search_path = public as $$
  select p_subject_id is not null and exists (
    select 1 from teacher_curriculum_templates t
    where t.teacher_id = auth.uid() and t.subject_id = p_subject_id
  );
$$;

comment on function public.is_teacher_of_subject(uuid) is
  'P2 10차: 이 사람이 그 과목의 담당 선생님인가 — 담당 과목(teacher_curriculum_templates, '
  '"내 과목")이 기준이다. 수강 배정(teacher_assignments)과는 다른 축이다: 학생이 아직 '
  '없어도 과목을 맡고 있으면 그 과목의 기준본·문제은행을 본다.';

revoke execute on function public.is_teacher_of_subject(uuid) from public, anon;
grant execute on function public.is_teacher_of_subject(uuid) to authenticated, service_role;

drop policy if exists "선생님·관리자는 공개된 문제은행 문제 조회" on problems;
create policy "담당 과목 선생님·관리자는 문제은행 문제 조회" on problems for select
  using (
    status = 'confirmed'
    and archived_at is null
    and origin_session_id is null
    and (is_admin() or public.is_teacher_of_subject(subject_id))
  );

-- is_teaching_staff() 는 더 이상 쓰지 않는다. 남겨 두면 다음 사람이 "역할만 보면
-- 된다"는 뜻으로 읽는다.
drop function if exists public.is_teaching_staff();

-- 버전 — 담당 과목 문제면 상태와 무관하게 읽는다. 준비안이 고정한 지난 버전을
-- 읽어야 하기 때문이다.
drop policy if exists "문제 버전 조회" on problem_versions;
create policy "문제 버전 조회" on problem_versions for select
  using (
    is_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from problems p
      where p.id = problem_id and public.is_teacher_of_subject(p.subject_id)
    )
    or (status = 'published' and exists (select 1 from problems p where p.id = problem_id))
    -- 20261297000000 의 조항을 그대로 유지한다: 보관된 과거 버전은 **그 버전을
    -- 고정한 수업의 스냅샷을 볼 수 있는 사람**에게 열린다. 이것이 없으면 문제를
    -- 한 번 수정하는 순간 그 문제를 쓴 과거 수업이 통째로 비어 버린다.
    or exists (
      select 1 from session_content_manifest m
      where m.problem_version_id = problem_versions.id
    )
  );

comment on policy "문제 버전 조회" on problem_versions is
  'P2 10차: 관리자·작성자, **담당 과목 선생님**(상태 무관 — 준비안이 고정한 지난 버전을 '
  '읽어야 한다), 공개 버전, 그리고 그 버전을 고정한 수업의 스냅샷을 볼 수 있는 사람.';

comment on function public.current_curriculum_doc_version_id(uuid) is
  'P2 9차: 그 교재의 가장 최근 버전 행. 조회 정책이 선생님에게 버전 행을 감추므로 '
  'security definer 다 — id 하나만 돌려주고 내용은 돌려주지 않는다.';

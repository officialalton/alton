-- =========================================================================
-- 2026-10-05 무료 학습 회원 S4 — 컨설턴트 학습 요약(§3.5)
-- learning_summary_grants 테이블은 …0004(accept RPC가 사용). 여기서는:
--   1) learning_summary_access_audit — 열람 감사(document-access-audit 패턴)
--   2) free_member_learning_summary(student_id) — 집계만. 조건: (a) 활성 grant, (b) 호출자가 그 학생 상담의
--      admissions_consultant_id, (c) 상담 상태 requested/scheduled 또는 completed 30일 이내. 관리자도 허용.
--      제외: 문항별 답안·필기·메모·하이라이트·오답노트 본문·단어 목록.
--   3) revoke_learning_summary_grant — 보호자(household guardian)/관리자 철회
-- consultant_assignments는 만들지 않는다 — _mock_exam_can_view 등 기존 정책은 건드리지 않는다.
-- =========================================================================

create table if not exists learning_summary_access_audit (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  viewer_id uuid not null,
  grant_id uuid references learning_summary_grants (id),
  consultation_id uuid references consultations (id),
  scope text not null default 'summary_v1',
  accessed_at timestamptz not null default now()
);
create index if not exists learning_summary_access_audit_student_idx on learning_summary_access_audit (student_id, accessed_at desc);
alter table learning_summary_access_audit enable row level security;
drop policy if exists "학습 요약 감사는 관리자/학생/보호자 조회" on learning_summary_access_audit;
create policy "학습 요약 감사는 관리자/학생/보호자 조회" on learning_summary_access_audit for select
  using (is_admin() or student_id = auth.uid() or is_guardian_of(student_id));

create or replace function public.free_member_learning_summary(p_student_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_grant learning_summary_grants;
  v_consultation_id uuid;
  v_attempts int;
  v_graded int;
  v_last_activity timestamptz;
  v_vocab int;
  v_recent jsonb;
  v_domain jsonb;
  v_skill jsonb;
begin
  if v_uid is null then
    raise exception 'login_required';
  end if;
  select * into v_grant from learning_summary_grants where student_id = p_student_id and revoked_at is null;
  if not found then
    raise exception 'no_active_grant';
  end if;
  if not is_admin() then
    select c.id into v_consultation_id from consultations c
    where c.child_id = p_student_id and c.admissions_consultant_id = v_uid
      and (c.status in ('requested', 'scheduled') or (c.status = 'completed' and c.completed_at > now() - interval '30 days'))
    order by c.created_at desc limit 1;
    if v_consultation_id is null then
      raise exception 'not_assigned_consultant';
    end if;
  end if;

  insert into learning_summary_access_audit (student_id, viewer_id, grant_id, consultation_id, scope)
  values (p_student_id, v_uid, v_grant.id, v_consultation_id, v_grant.scope);

  select count(*), count(*) filter (where status = 'graded') into v_attempts, v_graded
  from mock_exam_attempts where student_id = p_student_id;
  select greatest(
    (select max(coalesce(submitted_at, started_at, created_at)) from mock_exam_attempts where student_id = p_student_id),
    (select max(created_at) from vocab_words where student_id = p_student_id)
  ) into v_last_activity;
  select count(*) into v_vocab from vocab_words where student_id = p_student_id;

  with graded as (
    select a.id as attempt_id, a.submitted_at, s.name as exam_set_name, i.section, i.sat_domain, i.skill_code,
           coalesce(adj.adjusted_correct, ans.correct) as correct
    from mock_exam_attempts a
    join mock_exam_sets s on s.id = a.exam_set_id
    join mock_exam_answers ans on ans.attempt_id = a.id
    join mock_exam_set_items i on i.id = ans.set_item_id
    left join mock_exam_answer_adjustments adj
      on adj.attempt_id = a.id and adj.set_item_id = ans.set_item_id and adj.superseded_at is null
    where a.student_id = p_student_id and a.status = 'graded' and ans.correct is not null
  ),
  per_attempt as (
    select attempt_id, max(submitted_at) as submitted_at, max(exam_set_name) as exam_set_name,
           count(*) filter (where section = 'rw') as rw_total, count(*) filter (where section = 'rw' and correct) as rw_correct,
           count(*) filter (where section = 'math') as math_total, count(*) filter (where section = 'math' and correct) as math_correct
    from graded group by attempt_id order by max(submitted_at) desc nulls last limit 5
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
    coalesce((select jsonb_agg(jsonb_build_object('examSetName', exam_set_name, 'submittedAt', submitted_at,
      'rw', jsonb_build_object('correct', rw_correct, 'total', rw_total), 'math', jsonb_build_object('correct', math_correct, 'total', math_total))
      order by submitted_at desc nulls last) from per_attempt), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('key', key, 'section', section, 'total', total, 'correct', correct) order by (correct::numeric / nullif(total, 0)) asc, total desc)
      from (select * from dom where total >= 3 order by (correct::numeric / nullif(total, 0)) asc, total desc limit 5) d), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('key', key, 'section', section, 'total', total, 'correct', correct) order by (correct::numeric / nullif(total, 0)) asc, total desc)
      from (select * from skl where total >= 3 order by (correct::numeric / nullif(total, 0)) asc, total desc limit 5) k), '[]'::jsonb)
    into v_recent, v_domain, v_skill;

  return jsonb_build_object(
    'scope', v_grant.scope,
    'attemptCount', v_attempts,
    'gradedAttemptCount', v_graded,
    'lastActivityAt', v_last_activity,
    'vocabWordCount', v_vocab,
    'recentAttempts', v_recent,
    'weakestDomains', v_domain,
    'weakestSkills', v_skill
  );
end;
$$;
revoke execute on function public.free_member_learning_summary(uuid) from public, anon;
grant execute on function public.free_member_learning_summary(uuid) to authenticated;
comment on function public.free_member_learning_summary(uuid) is
  '2026-10-05 §3.5 summary_v1 — 집계만(답안·필기·메모·단어 목록 제외). 활성 grant + 담당 상담 컨설턴트(또는 관리자)만. 호출마다 감사 기록.';

create or replace function public.revoke_learning_summary_grant(p_student_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'login_required';
  end if;
  if not (is_admin() or is_guardian_of(p_student_id)) then
    raise exception 'not_allowed';
  end if;
  update learning_summary_grants set revoked_at = now(), revoked_by = auth.uid()
  where student_id = p_student_id and revoked_at is null;
end;
$$;
revoke execute on function public.revoke_learning_summary_grant(uuid) from public, anon;
grant execute on function public.revoke_learning_summary_grant(uuid) to authenticated;

-- 2026-09-17(제품 오너 지시) — 문제은행 검수 화면에서 과목을 즉시 재배정할 수 있게
-- 한다. 과목 변경은 "문제은행 분류 정리"이지 교육적 참값(시험 체계·영역·세부
-- 기술·주제·난이도·답안 형식·문제·정답·해설)을 고치는 기능이 아니다 — 이 함수는
-- subject_id와, 옛 과목에 묶여 있던 키워드 연결만 건드린다.
create table if not exists public.problem_subject_reassignments (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  old_subject_id uuid references public.subjects(id),
  new_subject_id uuid not null references public.subjects(id),
  changed_by uuid not null references public.profiles(id),
  changed_at timestamptz not null default now()
);
create index if not exists problem_subject_reassignments_problem_id_idx
  on public.problem_subject_reassignments (problem_id);

comment on table public.problem_subject_reassignments is
  '문제은행 검수 화면에서의 과목 재배정 이력 — 이전 과목·새 과목·변경자·시각.';

alter table public.problem_subject_reassignments enable row level security;
-- 이력은 관리자만 본다(작성은 서버 함수가 service_role로 한다).
create policy problem_subject_reassignments_admin_select
  on public.problem_subject_reassignments for select
  using (is_admin());

set row_security = off;

create or replace function public.reassign_problem_subject(
  p_problem_id uuid,
  p_new_subject_id uuid,
  p_actor_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_old_subject_id uuid;
begin
  select subject_id into v_old_subject_id from problems where id = p_problem_id;
  if v_old_subject_id is null and not exists (select 1 from problems where id = p_problem_id) then
    raise exception '존재하지 않는 문제입니다.';
  end if;

  if not exists (select 1 from subjects where id = p_new_subject_id and archived_at is null) then
    raise exception '보관되었거나 존재하지 않는 과목입니다. 활성 과목만 고를 수 있습니다.';
  end if;

  if v_old_subject_id is distinct from p_new_subject_id then
    update problems set subject_id = p_new_subject_id where id = p_problem_id;
    -- 옛 과목의 키워드 연결은 새 과목에서 의미가 없다(키워드는 과목별 사전이다) —
    -- 조용히 잘못 분류된 채로 남기지 않고 지운다. 관리자가 새 과목의 키워드를 다시 붙인다.
    delete from problem_keywords where problem_id = p_problem_id;
    insert into problem_subject_reassignments (problem_id, old_subject_id, new_subject_id, changed_by)
    values (p_problem_id, v_old_subject_id, p_new_subject_id, p_actor_id);
  end if;

  return jsonb_build_object('ok', true, 'oldSubjectId', v_old_subject_id, 'newSubjectId', p_new_subject_id);
end;
$$;
revoke execute on function public.reassign_problem_subject(uuid, uuid, uuid) from public, anon;
grant execute on function public.reassign_problem_subject(uuid, uuid, uuid) to authenticated, service_role;

-- 2026-10-12 모의고사 새 버전 적용 1/4 — 문항 노출 기록(최초 노출 vs 재노출)과 '새 버전 재응시' 표식. 전부 additive.
-- 설계: docs/ap/set-new-version-design.md. 같은 set_group_id 의 새 버전을 이미 응시한 학생이 다시 풀면 독립된 새 시험이 아니라 재응시 회차로 취급한다.
--  1) mock_exam_attempts.is_updated_version_retake — 같은 학생·시험 계열에 '다른 버전(exam_set_id)'으로 응시한 이전 기록이 있을 때 시작 시점에 true 로 고정.
--     (같은 버전을 다시 푸는 일반 재응시는 false — 기존 동작 불변.) 분석의 '시험 시작/완료' 집계에서 제외하는 데 쓴다.
--  2) mock_exam_item_exposures — 학생×문항(problem_id) 최초 노출 기록. 응시 시작 시(고정형·AP 고정형만; 4모듈 MST 는 경로별 노출이라 제외) 그 응시의
--     모든 문항을 upsert 한다. 문항별 최초/재노출은 first_attempt_id = 그 응시 인가로 판별(mock_exam_attempt_item_exposure_kinds).
-- 마이그레이션은 한 번 적용되면 파일을 고쳐도 반영되지 않으므로 전부 if (not) exists / create or replace.

alter table public.mock_exam_attempts add column if not exists is_updated_version_retake boolean not null default false;
comment on column public.mock_exam_attempts.is_updated_version_retake is
  '시작 시점에 같은 학생·시험 계열(exam_set_group_id)의 다른 버전 응시가 이미 있었는가. true 면 독립된 새 모의고사로 세지 않는다(재응시 취급).';

create table if not exists public.mock_exam_item_exposures (
  student_id uuid not null references public.students (id) on delete cascade,
  problem_id uuid not null references public.problems (id),
  first_attempt_id uuid references public.mock_exam_attempts (id) on delete set null,
  first_set_item_id uuid references public.mock_exam_set_items (id) on delete set null,
  first_exposed_at timestamptz not null default now(),
  exposure_count int not null default 1 check (exposure_count > 0),
  last_attempt_id uuid references public.mock_exam_attempts (id) on delete set null,
  last_exposed_at timestamptz not null default now(),
  primary key (student_id, problem_id)
);
create index if not exists mock_exam_item_exposures_first_attempt_idx on public.mock_exam_item_exposures (first_attempt_id);
comment on table public.mock_exam_item_exposures is '학생×문항 최초 노출 기록(응시 시작 시 적재). 최초 노출만 약점·난이도의 새 근거로 센다(docs/ap/publication-flow.md 겹침 정책).';
alter table public.mock_exam_item_exposures enable row level security;
drop policy if exists "문항 노출 관리자 조회" on public.mock_exam_item_exposures;
create policy "문항 노출 관리자 조회" on public.mock_exam_item_exposures for select to authenticated using (is_admin());
revoke all on public.mock_exam_item_exposures from anon, authenticated;
grant select on public.mock_exam_item_exposures to authenticated, service_role;

-- 시작 시점 표식(BEFORE INSERT). 트리거 이름 알파벳순으로 fill_set_group(exam_set_group_id)·zassign_no 뒤에 실행된다.
create or replace function public.mock_exam_attempts_flag_updated_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.is_updated_version_retake := exists (
    select 1 from mock_exam_attempts a
     where a.student_id = new.student_id and a.exam_set_group_id = new.exam_set_group_id and a.exam_set_id <> new.exam_set_id);
  return new;
end $$;
drop trigger if exists mock_exam_attempts_zzflag_updated_version on public.mock_exam_attempts;
create trigger mock_exam_attempts_zzflag_updated_version before insert on public.mock_exam_attempts
  for each row execute function public.mock_exam_attempts_flag_updated_version();

-- 노출 기록(AFTER INSERT) — 고정형·AP 고정형만.
create or replace function public.mock_exam_attempts_record_exposure() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from mock_exam_sets s where s.id = new.exam_set_id and s.format in ('fixed', 'ap_fixed')) then
    insert into mock_exam_item_exposures (student_id, problem_id, first_attempt_id, first_set_item_id, last_attempt_id)
    select new.student_id, i.problem_id, new.id, i.id, new.id from mock_exam_set_items i where i.exam_set_id = new.exam_set_id
    on conflict (student_id, problem_id) do update
      set exposure_count = mock_exam_item_exposures.exposure_count + 1, last_attempt_id = excluded.last_attempt_id, last_exposed_at = now();
  end if;
  return new;
end $$;
drop trigger if exists mock_exam_attempts_record_exposure on public.mock_exam_attempts;
create trigger mock_exam_attempts_record_exposure after insert on public.mock_exam_attempts
  for each row execute function public.mock_exam_attempts_record_exposure();

-- 백필(1회·멱등): 기존 응시 표식과 노출 기록.
update public.mock_exam_attempts a set is_updated_version_retake = true
 where not a.is_updated_version_retake and exists (
   select 1 from mock_exam_attempts b where b.student_id = a.student_id and b.exam_set_group_id = a.exam_set_group_id
      and b.exam_set_id <> a.exam_set_id and (b.created_at, b.id) < (a.created_at, a.id));
insert into public.mock_exam_item_exposures (student_id, problem_id, first_attempt_id, first_set_item_id, first_exposed_at, exposure_count, last_attempt_id, last_exposed_at)
select x.student_id, x.problem_id, (array_agg(x.attempt_id order by x.at, x.attempt_id))[1], (array_agg(x.item_id order by x.at, x.attempt_id))[1],
       min(x.at), count(*)::int, (array_agg(x.attempt_id order by x.at desc, x.attempt_id desc))[1], max(x.at)
  from (select a.student_id, i.problem_id, a.id attempt_id, i.id item_id, a.created_at at
          from mock_exam_attempts a join mock_exam_sets s on s.id = a.exam_set_id and s.format in ('fixed', 'ap_fixed')
          join mock_exam_set_items i on i.exam_set_id = a.exam_set_id) x
 group by x.student_id, x.problem_id
on conflict (student_id, problem_id) do nothing;

-- 한 응시의 문항별 노출 종류(first | re_exposure). 접근은 _mock_exam_can_view(응시 소유 학생) 기준.
create or replace function public.mock_exam_attempt_item_exposure_kinds(p_attempt_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_student uuid;
begin
  select student_id into v_student from mock_exam_attempts where id = p_attempt_id;
  if v_student is null or not _mock_exam_can_view(v_student) then
    raise exception 'You do not have permission to view this attempt.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('setItemId', i.id, 'problemId', i.problem_id,
             'kind', case when e.first_attempt_id = p_attempt_id then 'first' else 're_exposure' end) order by i.section, i.position)
      from mock_exam_attempts a join mock_exam_set_items i on i.exam_set_id = a.exam_set_id
      left join mock_exam_item_exposures e on e.student_id = a.student_id and e.problem_id = i.problem_id
     where a.id = p_attempt_id), '[]'::jsonb);
end $$;
revoke execute on function public.mock_exam_attempt_item_exposure_kinds(uuid) from public, anon;
grant execute on function public.mock_exam_attempt_item_exposure_kinds(uuid) to authenticated, service_role;

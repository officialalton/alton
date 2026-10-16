-- 2026-10-06 Free Accounts 1/7 — 테스트 계정 표식 · 마지막 활동 · 전환 시각 컬럼 · 직원 권한 헬퍼 · 활동 일 테이블.
-- additive/idempotent. 설계: docs/briefs/2026-10-06-admin-free-accounts-design.md §3·§4·§6·§11.

alter table students add column if not exists is_test_account boolean not null default false;
alter table students add column if not exists test_account_source text check (test_account_source in ('pattern', 'manual'));
alter table students add column if not exists last_active_at timestamptz;
alter table students add column if not exists converted_at timestamptz;
comment on column students.is_test_account is 'Free Accounts 분석·목록에서 기본 제외하는 테스트 계정 표식(이메일 패턴 자동 + 관리자 수동).';
comment on column students.last_active_at is '학생 포털 화면 진입 기준 마지막 활동(touch_student_activity 하트비트, 10분 쓰로틀).';
comment on column students.converted_at is '무료->수강 전환 시각(convert_free_member_to_tutoring가 최초 1회 기록). 이전 전환 건은 null 허용.';

-- 테스트 이메일 패턴(예시 도메인·.test 등·uat/it/e2e/qa/test- 로컬파트).
create or replace function public._email_is_test(p_email text) returns boolean
language sql immutable as $$
  select p_email is not null and (
       lower(split_part(p_email, '@', 2)) in ('example.com', 'example.org', 'example.net', 'example.test', 'test.local')
    or lower(split_part(p_email, '@', 2)) ~ '\.(test|invalid|localhost|example)$'
    or lower(split_part(p_email, '@', 1)) ~ '^(uat|it|e2e|qa|test)[-_.]'
  );
$$;

-- 신규 학생 자동 표식(auth.users 이메일 기준). 이미 표식이 지정된 insert 는 존중한다.
create or replace function public._students_mark_test_account() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.is_test_account and exists (select 1 from auth.users u where u.id = new.id and _email_is_test(u.email)) then
    new.is_test_account := true;
    new.test_account_source := 'pattern';
  end if;
  return new;
end $$;
drop trigger if exists students_mark_test_account on students;
create trigger students_mark_test_account before insert on students
  for each row execute function _students_mark_test_account();

-- 기존 행 백필(표식이 없는 행만; 수동 지정은 건드리지 않는다).
update students s set is_test_account = true, test_account_source = 'pattern'
from auth.users u
where u.id = s.id and not s.is_test_account and _email_is_test(u.email);

-- 직원 권한 헬퍼: 관리자(supervisor 는 학생관리 capability 보유 시)만. 컨설턴트·교사·학부모·학생은 거절.
create or replace function public._free_accounts_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'admin'
      and (p.admin_tier is distinct from 'supervisor' or coalesce(current_user_has_capability('학생관리'), false))
  );
$$;
revoke execute on function public._free_accounts_staff() from public, anon;
grant execute on function public._free_accounts_staff() to authenticated;

-- 일 단위 활동(Asia/Seoul 일 경계). 쓰기는 RPC만.
create table if not exists student_activity_days (
  student_id uuid not null references students (id) on delete cascade,
  day date not null,
  primary key (student_id, day)
);
alter table student_activity_days enable row level security;
comment on table student_activity_days is '학생 포털 활동 일 기록(학생당 하루 1행). 정책 없음 — RPC/서비스 롤만 접근.';

create or replace function public.touch_student_activity() returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  update students set last_active_at = now()
   where id = v_uid and (last_active_at is null or last_active_at < now() - interval '10 minutes');
  if found then
    insert into student_activity_days (student_id, day)
    values (v_uid, (now() at time zone 'Asia/Seoul')::date) on conflict do nothing;
  end if;
end $$;
revoke execute on function public.touch_student_activity() from public, anon;
grant execute on function public.touch_student_activity() to authenticated;

-- 1회 백필: 활동 일 + last_active_at 파생(로그인·응시·단어·퀴즈·자료).
insert into student_activity_days (student_id, day)
select distinct x.sid, x.d from (
  select student_id sid, (started_at at time zone 'Asia/Seoul')::date d from mock_exam_attempts where started_at is not null
  union select student_id, (created_at at time zone 'Asia/Seoul')::date from vocab_words
  union select owner_id, (submitted_at at time zone 'Asia/Seoul')::date from vocab_quizzes where submitted_at is not null
  union select user_id, (updated_at at time zone 'Asia/Seoul')::date from material_reading_positions
) x join students s on s.id = x.sid
on conflict do nothing;

update students s set last_active_at = d.ts from (
  select s2.id, greatest(
    (select last_sign_in_at from auth.users u where u.id = s2.id),
    (select max(coalesce(submitted_at, started_at)) from mock_exam_attempts a where a.student_id = s2.id),
    (select max(created_at) from vocab_words w where w.student_id = s2.id),
    (select max(submitted_at) from vocab_quizzes q where q.owner_id = s2.id),
    (select max(updated_at) from material_reading_positions m where m.user_id = s2.id)
  ) ts from students s2
) d where d.id = s.id and s.last_active_at is null and d.ts is not null;

create index if not exists students_free_list_idx on students (joined_at desc) where member_type = 'free';
create index if not exists students_converted_idx on students (converted_at desc) where converted_at is not null;
create index if not exists students_last_active_idx on students (last_active_at desc nulls last) where member_type = 'free';
create index if not exists students_test_account_idx on students (id) where is_test_account;
create index if not exists mock_exam_attempts_student_status_idx on mock_exam_attempts (student_id, status);
create index if not exists mock_exam_attempts_started_idx on mock_exam_attempts (started_at) where started_at is not null;
create index if not exists mock_exam_attempts_graded_idx on mock_exam_attempts (graded_at) where graded_at is not null;
create index if not exists student_activity_days_day_idx on student_activity_days (day);
create index if not exists consultations_free_member_child_idx on consultations (child_id, created_at desc) where source = 'free_member';

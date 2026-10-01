-- 컨설턴트 포지션(2026-09-22 사용자 지시) — 관리자 포털에 얹지 않고 완전히
-- 별도 role로 둔다(학생/학부모/교사/관리자와 같은 급). 담당 학생을 배정받아
-- 그 학생의 로드맵(상담·에세이 진행 상황 포함)을 직접 작업한다.
--
-- 가볍게: 로드맵은 이미 학생 본인/보호자/관리자가 쓰는 테이블·서버 액션을
-- 그대로 쓴다(lib/roadmap/actions.ts는 role을 검사하지 않고 RLS에 맡긴다) —
-- 여기서는 RLS 헬퍼 두 개에 컨설턴트 조건만 추가하면 된다. 상담·에세이
-- 전용 화면은 이번 라운드에 없다(자리만 잡아 둔다, 다음 라운드).

alter type profile_role add value if not exists 'consultant';

-- 담당 배정 — 관리자가 배정/해제한다(마스터 전용까지는 아니다, 운영 업무).
create table consultant_assignments (
  consultant_id uuid not null references profiles (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  assigned_by uuid references profiles (id),
  assigned_at timestamptz not null default now(),
  primary key (consultant_id, student_id)
);
create index on consultant_assignments (student_id);

alter table consultant_assignments enable row level security;

create or replace function public.is_assigned_consultant_of(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from consultant_assignments
    where student_id = p_student_id and consultant_id = auth.uid()
  );
$$;

comment on function public.is_assigned_consultant_of(uuid) is
  '2026-09-22 — 이 컨설턴트가 이 학생을 담당하는지. 로드맵 RLS(_roadmap_can_read/_roadmap_can_write)에서 재사용.';

create policy "본인 컨설턴트/관리자 조회" on consultant_assignments for select
  using (consultant_id = auth.uid() or is_admin());
create policy "관리자만 배정·해제" on consultant_assignments for all
  using (is_admin()) with check (is_admin());

-- 로드맵: 컨설턴트는 담당 학생에 한해 교사보다 넓게(쓰기까지) 접근한다 —
-- "로드맵 작업"이 컨설턴트 업무의 핵심이라는 요구사항 그대로.
create or replace function public._roadmap_can_read(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_student_id = auth.uid()
    or teaches_student(p_student_id)
    or is_guardian_of(p_student_id)
    or is_assigned_consultant_of(p_student_id)
    or is_admin();
$$;

create or replace function public._roadmap_can_write(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_student_id = auth.uid()
    or is_guardian_of(p_student_id)
    or is_assigned_consultant_of(p_student_id)
    or is_admin();
$$;

-- 관리자가 이메일로 기존 계정을 컨설턴트로 지정할 때 쓴다(신규 auth 계정
-- 발급 자체는 이번 범위 밖 — Supabase에서 만든 뒤 이 RPC로 역할만 바꾼다).
create or replace function public.set_profile_role_to_consultant(p_profile_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception '관리자만 역할을 바꿀 수 있습니다.';
  end if;
  update profiles set role = 'consultant' where id = p_profile_id;
  if not found then raise exception '존재하지 않는 계정입니다.'; end if;
end $$;

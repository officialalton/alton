-- 2026-10-08 My Notebook — 학생 개인 노트 폴더와 문제 배정. 설계: docs/2026-10-08-my-notebook-design.md
-- 문제 원본(수업·과제·모의고사 저장 상태)은 그대로 두고, 폴더·배정만 additive 로 추가한다.

create table if not exists student_notebook_folders (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  is_default boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists student_notebook_folders_name_key on student_notebook_folders (student_id, lower(btrim(name)));
create unique index if not exists student_notebook_folders_one_default on student_notebook_folders (student_id) where is_default;
create index if not exists student_notebook_folders_student_idx on student_notebook_folders (student_id, position);

create table if not exists student_notebook_assignments (
  student_id uuid not null references profiles (id) on delete cascade,
  problem_key text not null check (char_length(problem_key) between 1 and 200),
  folder_id uuid not null references student_notebook_folders (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, problem_key)
);
create index if not exists student_notebook_assignments_folder_idx on student_notebook_assignments (folder_id);

alter table student_notebook_folders enable row level security;
alter table student_notebook_assignments enable row level security;

drop policy if exists "notebook_folders_select_own" on student_notebook_folders;
create policy "notebook_folders_select_own" on student_notebook_folders for select
  using (student_id = auth.uid() or is_admin());
-- 기본 폴더는 직접 만들 수 없다(ensure_default_notebook_folder 만). 이름 변경·삭제도 불가.
drop policy if exists "notebook_folders_insert_own" on student_notebook_folders;
create policy "notebook_folders_insert_own" on student_notebook_folders for insert
  with check ((student_id = auth.uid() and not is_default) or is_admin());
drop policy if exists "notebook_folders_update_own" on student_notebook_folders;
create policy "notebook_folders_update_own" on student_notebook_folders for update
  using ((student_id = auth.uid() and not is_default) or is_admin())
  with check ((student_id = auth.uid() and not is_default) or is_admin());
drop policy if exists "notebook_folders_delete_own" on student_notebook_folders;
create policy "notebook_folders_delete_own" on student_notebook_folders for delete
  using ((student_id = auth.uid() and not is_default) or is_admin());

drop policy if exists "notebook_assignments_select_own" on student_notebook_assignments;
create policy "notebook_assignments_select_own" on student_notebook_assignments for select
  using (student_id = auth.uid() or is_admin());
drop policy if exists "notebook_assignments_write_own" on student_notebook_assignments;
create policy "notebook_assignments_write_own" on student_notebook_assignments for all
  using (student_id = auth.uid() or is_admin())
  with check (
    (student_id = auth.uid() or is_admin())
    and exists (select 1 from student_notebook_folders f where f.id = folder_id and f.student_id = student_notebook_assignments.student_id)
  );

-- 학생당 폴더 30개 상한(기본 폴더 포함).
create or replace function public.limit_notebook_folders()
returns trigger language plpgsql as $$
begin
  if (select count(*) from student_notebook_folders where student_id = new.student_id) >= 30 then
    raise exception 'You can have up to 30 folders.';
  end if;
  return new;
end;
$$;
drop trigger if exists limit_notebook_folders_trg on student_notebook_folders;
create trigger limit_notebook_folders_trg before insert on student_notebook_folders
  for each row execute function public.limit_notebook_folders();

-- 기본 폴더("Review later")가 없으면 만들고 id 를 돌려준다(멱등). 본인 또는 관리자만.
create or replace function public.ensure_default_notebook_folder(p_student_id uuid)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare v_id uuid;
begin
  if not (p_student_id = auth.uid() or is_admin()) then
    raise exception 'Only the student can create their notebook folders.';
  end if;
  select id into v_id from student_notebook_folders where student_id = p_student_id and is_default limit 1;
  if v_id is not null then return v_id; end if;
  insert into student_notebook_folders (student_id, name, is_default, position)
  values (p_student_id, 'Review later', true, -1)
  on conflict (student_id, lower(btrim(name))) do update set is_default = true
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.ensure_default_notebook_folder(uuid) from public, anon;
grant execute on function public.ensure_default_notebook_folder(uuid) to authenticated;

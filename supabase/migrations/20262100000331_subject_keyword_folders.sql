-- 2026-10-08 — 과목 키워드 폴더(관리자 관리). 설계: docs/2026-10-08-keyword-folders-design.md
-- additive: 기존 키워드·회차 연결은 건드리지 않는다. 폴더 삭제 시 키워드는 folder_id=null("기타").

create table if not exists subject_keyword_folders (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists subject_keyword_folders_subject_name_key
  on subject_keyword_folders (subject_id, lower(btrim(name)));
create index if not exists subject_keyword_folders_subject_idx on subject_keyword_folders (subject_id, position);

alter table subject_keywords add column if not exists folder_id uuid references subject_keyword_folders(id) on delete set null;
alter table subject_keywords add column if not exists sort_order int not null default 0;
create index if not exists subject_keywords_folder_idx on subject_keywords (folder_id);

alter table subject_keyword_folders enable row level security;
drop policy if exists "인증된 사용자 전체 조회" on subject_keyword_folders;
create policy "인증된 사용자 전체 조회" on subject_keyword_folders for select using (auth.uid() is not null);
drop policy if exists "관리자만 쓰기" on subject_keyword_folders;
create policy "관리자만 쓰기" on subject_keyword_folders for all using (is_admin()) with check (is_admin());

-- 기본 도메인 폴더 이름/순서(lib/problem-taxonomy.ts SAT_DOMAINS와 동일).
create or replace function keyword_domain_folder_name(p_domain text) returns text
language sql immutable as $$
  select case p_domain
    when 'algebra' then 'Algebra'
    when 'advanced_math' then 'Advanced Math'
    when 'problem_solving_data' then 'Problem-Solving and Data Analysis'
    when 'geometry_trig' then 'Geometry and Trigonometry'
    when 'rw_information_ideas' then 'Information and Ideas'
    when 'rw_craft_structure' then 'Craft and Structure'
    when 'rw_expression_ideas' then 'Expression of Ideas'
    when 'rw_standard_english' then 'Standard English Conventions'
  end
$$;
create or replace function keyword_domain_folder_position(p_domain text) returns int
language sql immutable as $$
  select case p_domain
    when 'algebra' then 0 when 'advanced_math' then 1 when 'problem_solving_data' then 2 when 'geometry_trig' then 3
    when 'rw_information_ideas' then 4 when 'rw_craft_structure' then 5 when 'rw_expression_ideas' then 6 when 'rw_standard_english' then 7
  end
$$;

-- 도메인 폴더를 (과목, 도메인)별로 찾거나 만든다.
create or replace function ensure_domain_keyword_folder(p_subject_id uuid, p_domain text) returns uuid
language plpgsql as $$
declare
  v_name text := keyword_domain_folder_name(p_domain);
  v_id uuid;
begin
  if v_name is null then return null; end if;
  select id into v_id from subject_keyword_folders
   where subject_id = p_subject_id and lower(btrim(name)) = lower(v_name);
  if v_id is null then
    insert into subject_keyword_folders (subject_id, name, position)
    values (p_subject_id, v_name, keyword_domain_folder_position(p_domain))
    on conflict do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from subject_keyword_folders
       where subject_id = p_subject_id and lower(btrim(name)) = lower(v_name);
    end if;
  end if;
  return v_id;
end;
$$;

-- 키워드의 폴더는 같은 과목이어야 하고, 도메인 키워드가 폴더 없이 들어오면 기본 도메인 폴더에 자동 배정한다.
create or replace function subject_keywords_folder_guard() returns trigger
language plpgsql as $$
begin
  if new.folder_id is not null then
    if not exists (select 1 from subject_keyword_folders f where f.id = new.folder_id and f.subject_id = new.subject_id) then
      raise exception 'keyword_folder_subject_mismatch';
    end if;
  elsif tg_op = 'INSERT' and new.domain_code is not null then
    new.folder_id := ensure_domain_keyword_folder(new.subject_id, new.domain_code);
  end if;
  return new;
end;
$$;
drop trigger if exists subject_keywords_folder_guard on subject_keywords;
create trigger subject_keywords_folder_guard
  before insert or update of folder_id, subject_id on subject_keywords
  for each row execute function subject_keywords_folder_guard();

-- 시드: 기존 도메인 키워드를 기본 폴더에 배정(이미 폴더가 있으면 건너뜀).
update subject_keywords k
   set folder_id = ensure_domain_keyword_folder(k.subject_id, k.domain_code)
 where k.folder_id is null and k.domain_code is not null;

-- 2026-10-08 — AP 커리큘럼 키워드 체계(공식 CED 단원 > 공식 토픽 코드 > 세부 키워드). 설계: docs/ap/curriculum-keyword-design.md
-- additive·재실행 안전. 기존 SAT 키워드·폴더·회차 연결은 건드리지 않는다.
-- 키워드는 "내용 축"만이다. 스킬·문항 구조는 별도 축이며 문제 유형이 아니다.
-- 롤백(적용 금지, 참고): 시드 행은 source='ced' 로 식별 — `delete from subject_keywords where source='ced'`(세부→토픽 순),
--   폴더/단원 `official_code is not null`, 그다음 아래 신규 테이블·컬럼 drop. 문제 연결(problem_keywords)은 cascade 로 정리된다.

-- 1) 관리자 과목 ↔ AP 과목 코드(앱 상수 AP_SUBJECTS 와 같은 코드). 하드코딩 목록 대신 DB가 기준.
alter table subjects add column if not exists ap_subject_code text;
create unique index if not exists subjects_ap_subject_code_key on subjects (ap_subject_code) where ap_subject_code is not null;
comment on column subjects.ap_subject_code is 'AP 과목 코드(예: ap_calculus_ab). null = AP 아님. problems.ap_subject 와 같은 값 체계.';

-- 2) 단원(= 템플릿 단원 + 키워드 폴더) — 공식 단원 번호는 이름이 바뀌어도 유지되는 안정 코드.
alter table subject_template_units add column if not exists official_code text;
alter table subject_template_units add column if not exists source text not null default 'admin';
alter table subject_template_units add column if not exists suggested_lessons numeric(5,1);
alter table subject_template_units add column if not exists official_class_periods text;
create unique index if not exists subject_template_units_official_code_key on subject_template_units (subject_id, official_code) where official_code is not null;

alter table subject_keyword_folders add column if not exists official_code text;
alter table subject_keyword_folders add column if not exists source text not null default 'admin';
create unique index if not exists subject_keyword_folders_official_code_key on subject_keyword_folders (subject_id, official_code) where official_code is not null;

-- 3) 키워드 — 토픽(level 1, 공식 코드) / 세부 키워드(level 2, ALTON 소유). level 0 = 기존(SAT 등).
alter table subject_keywords add column if not exists content_code text;        -- 안정 코드: 토픽 "5.3", 세부 "5.3#2"
alter table subject_keywords add column if not exists content_key text;         -- 과목 군 공유 키(예: calculus:5.3)
alter table subject_keywords add column if not exists level smallint not null default 0;
alter table subject_keywords add column if not exists parent_keyword_id uuid references subject_keywords(id) on delete restrict;
alter table subject_keywords add column if not exists source text not null default 'admin';
alter table subject_keywords add column if not exists edition text;
alter table subject_keywords add column if not exists kind text;
alter table subject_keywords add column if not exists skill_codes text[] not null default '{}';
alter table subject_keywords add column if not exists requires_codes text[] not null default '{}';
alter table subject_keywords add column if not exists est_lessons numeric(4,2);
alter table subject_keywords add column if not exists scope text;               -- both | bc_only | ab_only (AP Calculus)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'subject_keywords_level_check') then
    alter table subject_keywords add constraint subject_keywords_level_check check (level between 0 and 2);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'subject_keywords_source_check') then
    alter table subject_keywords add constraint subject_keywords_source_check check (source in ('admin', 'ced', 'alton'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'subject_keywords_kind_check') then
    alter table subject_keywords add constraint subject_keywords_kind_check check (kind is null or kind in ('concept', 'skill', 'misconception', 'representation'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'subject_keywords_level_parent_check') then
    alter table subject_keywords add constraint subject_keywords_level_parent_check
      check ((level = 2) = (parent_keyword_id is not null));
  end if;
end $$;
create unique index if not exists subject_keywords_content_code_key on subject_keywords (subject_id, content_code) where content_code is not null;
create index if not exists subject_keywords_parent_idx on subject_keywords (parent_keyword_id) where parent_keyword_id is not null;
create index if not exists subject_keywords_content_key_idx on subject_keywords (content_key) where content_key is not null;
comment on column subject_keywords.content_code is '안정 코드. 공식 토픽 = CED 코드(5.3), 세부 = <토픽>#<번호>. 이름(label)을 바꿔도 불변. ced 행은 변경 불가(트리거).';
comment on column subject_keywords.skill_codes is '공식 스킬 코드(ap_skills.code). 스킬은 별도 축 — 키워드는 문제 유형이 아니다.';

-- 공식(ced) 행 보호: 코드·출처·레벨·부모는 바뀌지 않고, 삭제하지 않는다(보관은 status=archived). 세부 키워드의 부모는 같은 과목 토픽이어야 한다.
create or replace function subject_keywords_ap_guard() returns trigger
language plpgsql as $$
declare v_parent subject_keywords%rowtype;
begin
  if tg_op = 'DELETE' then
    if old.source = 'ced' and exists (select 1 from subjects s where s.id = old.subject_id) then
      raise exception 'ap_official_keyword_protected: official keyword % cannot be deleted; archive it instead', old.content_code;
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.source = 'ced' then
    if new.content_code is distinct from old.content_code or new.source is distinct from old.source
       or new.level is distinct from old.level or new.parent_keyword_id is distinct from old.parent_keyword_id
       or new.subject_id is distinct from old.subject_id then
      raise exception 'ap_official_keyword_immutable: % code/source/level/parent cannot change', old.content_code;
    end if;
  end if;
  if new.level = 2 then
    select * into v_parent from subject_keywords where id = new.parent_keyword_id;
    if v_parent.id is null or v_parent.subject_id <> new.subject_id or v_parent.level <> 1 then
      raise exception 'ap_sub_keyword_parent_invalid';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists subject_keywords_ap_guard on subject_keywords;
create trigger subject_keywords_ap_guard before insert or update or delete on subject_keywords
  for each row execute function subject_keywords_ap_guard();

-- 4) 판(edition)·스킬·공식 비중 — 출처 URL과 CED 버전을 함께 저장(수정 시 새 edition 행).
create table if not exists ap_curriculum_editions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  edition text not null,
  ced_version text not null,
  source_url text not null,
  exam_year int not null,
  family text not null,
  official_topic_codes boolean not null default true,
  design_notes text,
  is_current boolean not null default true,
  imported_at timestamptz not null default now(),
  unique (subject_id, edition)
);
create table if not exists ap_skills (
  subject_id uuid not null references subjects(id) on delete cascade,
  edition text not null,
  code text not null,
  category text not null,
  label text not null,
  sort_order int not null default 0,
  primary key (subject_id, edition, code)
);
create table if not exists ap_exam_weights (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  edition text not null,
  axis text not null check (axis in ('unit', 'skill')),
  code text not null,
  section text not null check (section in ('mc', 'frq')),
  min_pct numeric(5,1),
  max_pct numeric(5,1),
  source text not null,
  unique (subject_id, edition, axis, code, section),
  check (min_pct is null or max_pct is null or min_pct <= max_pct)
);
do $$ declare t text; begin
  foreach t in array array['ap_curriculum_editions', 'ap_skills', 'ap_exam_weights'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "인증된 사용자 전체 조회" on %I', t);
    execute format('create policy "인증된 사용자 전체 조회" on %I for select using (auth.uid() is not null)', t);
    execute format('drop policy if exists "관리자만 쓰기" on %I', t);
    execute format('create policy "관리자만 쓰기" on %I for all using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

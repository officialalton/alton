-- AP 모의고사 세트(exam_program='ap', format='ap_fixed') — 기존 모의고사 엔진 재사용 (2026-10-09)
--
-- SAT 적응형(mst)·고정형 동작은 건드리지 않는다. 추가만:
--   · mock_exam_sets: exam_program('sat'|'ap', 기본 sat) / ap_subject / ap_label(full_practice|mc_practice|frq_practice) / section_layout(공식 섹션·시간·계산기 복사본) / format 에 'ap_fixed'
--   · mock_exam_set_items.section: 'rw'|'math' 에 더해 'ap_*' 섹션 키 허용(sat_domain 은 NOT NULL 유지 — AP 는 'ap:<토픽코드>' 를 쓴다)
--   · 세트 항목 가드: AP 세트에는 같은 과목·모의고사 용도(usage_scope=mock_exam)·검수 환경 이상(review_env|launch)으로 변환된 AP 문제만.
--     SAT 세트에는 AP 문제 불가. 수업 용도(lesson) 문항은 어떤 모의 세트에도 들어갈 수 없다(기존 mock_exam_set_items_usage_scope 와 합쳐서 이중 방어).
--   · 공개 게이트: 섹션 키·라벨(full/mc/frq) 정합성(라벨은 공식 구조를 다 채울 때만 Full Practice Exam)
--   · 래퍼(rename → 얇은 래퍼): mock_exam_open_catalog / mock_exam_attempt_summaries / mock_exam_attempt_detail 에 AP 필드를 덧붙인다
--   · mock_exam_save_section_time: ap_* 섹션 허용
-- 되돌리기: 래퍼 3개를 _v1/_v5 원본으로 되돌리고(이름 교체) 트리거·컬럼 삭제.

-- ── 1. 세트·항목 컬럼/제약 ─────────────────────────────────────────────
alter table public.mock_exam_sets add column if not exists exam_program text not null default 'sat';
alter table public.mock_exam_sets add column if not exists ap_subject text;
alter table public.mock_exam_sets add column if not exists ap_label text;
alter table public.mock_exam_sets add column if not exists section_layout jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'mock_exam_sets_exam_program_check') then
    alter table public.mock_exam_sets add constraint mock_exam_sets_exam_program_check check (exam_program in ('sat', 'ap'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mock_exam_sets_ap_shape_check') then
    alter table public.mock_exam_sets add constraint mock_exam_sets_ap_shape_check check (
      (exam_program = 'sat' and ap_subject is null and ap_label is null and section_layout is null)
      or (exam_program = 'ap' and format = 'ap_fixed' and ap_subject is not null and ap_label in ('full_practice', 'mc_practice', 'frq_practice') and section_layout is not null));
  end if;
  alter table public.mock_exam_sets drop constraint if exists mock_exam_sets_format_check;
  alter table public.mock_exam_sets add constraint mock_exam_sets_format_check check (format in ('fixed', 'mst', 'ap_fixed'));
  alter table public.mock_exam_set_items drop constraint if exists mock_exam_set_items_section_check;
  alter table public.mock_exam_set_items add constraint mock_exam_set_items_section_check check (section in ('rw', 'math') or section ~ '^ap_[a-z0-9_]{1,30}$');
end $$;
comment on column public.mock_exam_sets.section_layout is 'AP: {"sections":[{"key","kind":"mc|frq","label","minutes","count","calculator":"allowed|not_allowed|required|na","options":4|5}]} — 공식 구조 복사본(lib/ap-exam/layouts.ts).';

-- ── 2. 세트 항목 가드 ──────────────────────────────────────────────────
create or replace function public._mock_exam_ap_set_item_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare s mock_exam_sets%rowtype; p problems%rowtype; c ap_candidate_items%rowtype; ok boolean;
begin
  select * into s from mock_exam_sets where id = new.exam_set_id;
  select * into p from problems where id = new.problem_id;
  if p.id is null then return new; end if;
  if s.exam_program = 'sat' then
    if p.exam_system = 'ap' then raise exception 'AP problems cannot be added to an SAT exam set.'; end if;
    return new;
  end if;
  -- AP 세트
  if p.exam_system is distinct from 'ap' or p.ap_subject is distinct from s.ap_subject then
    raise exception 'Only % AP problems can be added to this exam set.', s.ap_subject;
  end if;
  if p.usage_scope is distinct from 'mock_exam' then
    raise exception 'Lesson-purpose AP items cannot be used in a mock exam set.';
  end if;
  select * into c from ap_candidate_items where candidate_key = p.ap_candidate_key;
  if c.id is null or c.release_tier not in ('review_env', 'launch') or c.purpose is distinct from 'mock_exam' then
    raise exception 'Only AP items converted to the review environment for the mock-exam purpose can be assembled into a set.';
  end if;
  select exists (select 1 from jsonb_array_elements(coalesce(s.section_layout->'sections', '[]'::jsonb)) x where x->>'key' = new.section) into ok;
  if not ok then raise exception 'Section % is not part of this exam layout.', new.section; end if;
  return new;
end $$;
drop trigger if exists mock_exam_set_items_ap_guard on public.mock_exam_set_items;
create trigger mock_exam_set_items_ap_guard before insert or update of problem_id, exam_set_id, section on public.mock_exam_set_items
  for each row execute function public._mock_exam_ap_set_item_guard();

-- ── 3. 공개 게이트: 라벨 정합성 ─────────────────────────────────────────
-- full_practice = 모든 섹션이 공식 문항 수를 채움 / mc_practice = MC 섹션만, 전부 채움 / frq_practice = FRQ 섹션만, 전부 채움.
create or replace function public._mock_exam_ap_publish_gate() returns trigger
language plpgsql security definer set search_path = public as $$
declare sec jsonb; n int; bad text;
begin
  if new.exam_program <> 'ap' then return new; end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    for sec in select * from jsonb_array_elements(new.section_layout->'sections') loop
      select count(*) into n from mock_exam_set_items where exam_set_id = new.id and section = sec->>'key';
      if new.ap_label = 'full_practice' or (new.ap_label = 'mc_practice' and sec->>'kind' = 'mc') or (new.ap_label = 'frq_practice' and sec->>'kind' = 'frq') then
        if n <> (sec->>'count')::int then bad := coalesce(bad || ', ', '') || (sec->>'key') || ' ' || n || '/' || (sec->>'count'); end if;
      elsif n > 0 then
        bad := coalesce(bad || ', ', '') || (sec->>'key') || ' has items but is outside the ' || new.ap_label || ' label';
      end if;
    end loop;
    if bad is not null then raise exception 'The set does not match its AP label (%): %', new.ap_label, bad; end if;
    if new.access_tier is null then raise exception 'access_tier is required.'; end if;
  end if;
  return new;
end $$;
drop trigger if exists mock_exam_sets_ap_publish_gate on public.mock_exam_sets;
create trigger mock_exam_sets_ap_publish_gate before insert or update of status on public.mock_exam_sets
  for each row execute function public._mock_exam_ap_publish_gate();

-- ── 4. 섹션 시간 저장: ap_* 허용 ───────────────────────────────────────
create or replace function public.mock_exam_save_section_time(p_attempt_id uuid, p_section text, p_remaining_seconds int)
returns void language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype;
begin
  if p_section not in ('rw', 'math') and p_section !~ '^ap_[a-z0-9_]{1,30}$' then raise exception 'Invalid section.'; end if;
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception 'You can only take your own exam.'; end if;
  if v_a.status in ('submitted', 'graded') then return; end if;
  update mock_exam_attempts
    set time_remaining_seconds = coalesce(time_remaining_seconds, '{}'::jsonb) || jsonb_build_object(p_section, greatest(0, p_remaining_seconds))
    where id = p_attempt_id;
end $$;

-- ── 5. 래퍼: 카탈로그·요약·상세에 AP 필드 덧붙이기 ─────────────────────
do $$ begin
  if not exists (select 1 from pg_proc where proname = '_mock_exam_open_catalog_v1') then
    alter function public.mock_exam_open_catalog(uuid) rename to _mock_exam_open_catalog_v1;
    revoke execute on function public._mock_exam_open_catalog_v1(uuid) from public, anon, authenticated;
  end if;
  if not exists (select 1 from pg_proc where proname = '_mock_exam_attempt_summaries_v1') then
    alter function public.mock_exam_attempt_summaries(uuid) rename to _mock_exam_attempt_summaries_v1;
    revoke execute on function public._mock_exam_attempt_summaries_v1(uuid) from public, anon, authenticated;
  end if;
  if not exists (select 1 from pg_proc where proname = '_mock_exam_attempt_detail_v5') then
    alter function public.mock_exam_attempt_detail(uuid) rename to _mock_exam_attempt_detail_v5;
    revoke execute on function public._mock_exam_attempt_detail_v5(uuid) from public, anon, authenticated;
  end if;
end $$;

create or replace function public.mock_exam_open_catalog(p_student_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  v := _mock_exam_open_catalog_v1(p_student_id);
  return coalesce((
    select jsonb_agg(t.row || jsonb_build_object(
        'examProgram', s.exam_program, 'apSubject', s.ap_subject, 'apLabel', s.ap_label,
        'accessTier', s.access_tier,
        'apSections', case when s.exam_program = 'ap' then s.section_layout->'sections' else null end)
      order by t.ord)
    from jsonb_array_elements(coalesce(v, '[]'::jsonb)) with ordinality as t(row, ord)
    left join mock_exam_sets s on s.id = (t.row->>'examSetId')::uuid
  ), '[]'::jsonb);
end $$;
revoke execute on function public.mock_exam_open_catalog(uuid) from public, anon;
grant execute on function public.mock_exam_open_catalog(uuid) to authenticated, service_role;

create or replace function public.mock_exam_attempt_summaries(p_student_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  v := _mock_exam_attempt_summaries_v1(p_student_id);
  return coalesce((
    select jsonb_agg(t.row || jsonb_build_object('examProgram', coalesce(s.exam_program, 'sat'), 'apSubject', s.ap_subject, 'apLabel', s.ap_label) order by t.ord)
    from jsonb_array_elements(coalesce(v, '[]'::jsonb)) with ordinality as t(row, ord)
    left join mock_exam_sets s on s.id = (t.row->>'examSetId')::uuid
  ), '[]'::jsonb);
end $$;
revoke execute on function public.mock_exam_attempt_summaries(uuid) from public, anon;
grant execute on function public.mock_exam_attempt_summaries(uuid) to authenticated, service_role;

-- 상세: 세트 수준 AP 필드 + 문항별 선택지 수·FRQ 파트(statements). 정답·해설 마스킹은 원본(v5)이 이미 한다 — 여기서 더 열지 않는다.
create or replace function public.mock_exam_attempt_detail(p_attempt_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d jsonb; s mock_exam_sets%rowtype; v_items jsonb;
begin
  d := _mock_exam_attempt_detail_v5(p_attempt_id);
  if d is null then return null; end if;
  select * into s from mock_exam_sets where id = (d->>'examSetId')::uuid;
  if s.id is null or s.exam_program <> 'ap' then return d || jsonb_build_object('examProgram', 'sat'); end if;
  select coalesce(jsonb_agg(t.it || jsonb_build_object(
           'optionCount', case when jsonb_typeof(v.options) = 'array' then jsonb_array_length(v.options) else null end,
           'parts', v.statements,
           'apItemIndex', p.ap_item_index) order by t.ord), '[]'::jsonb)
    into v_items
  from jsonb_array_elements(coalesce(d->'items', '[]'::jsonb)) with ordinality as t(it, ord)
  left join mock_exam_set_items i on i.id = (t.it->>'setItemId')::uuid
  left join problem_versions v on v.id = i.problem_version_id
  left join problems p on p.id = i.problem_id;
  return d || jsonb_build_object('items', v_items, 'examProgram', 'ap', 'apSubject', s.ap_subject, 'apLabel', s.ap_label, 'sectionLayout', s.section_layout->'sections');
end $$;
revoke execute on function public.mock_exam_attempt_detail(uuid) from public, anon;
grant execute on function public.mock_exam_attempt_detail(uuid) to authenticated, service_role;

-- M4 (조기 R9 설계 반영, 2026-09-05 사용자 결정): 체험 리뷰를 "AI 미팅록 기반 자동
-- 요약 + 카테고리별 선생님 의견" 구조로 정식화하되, R9(정규수업 마일스톤/진도)를
-- 기다리지 않고 지금 체험/정규 공용 구조로 설계해 체험에 먼저 적용한다. R9 착수
-- 시 정규수업은 이 구조(`lesson_reviews`/`lesson_review_category_notes`)를 그대로
-- 재사용한다 — 카테고리 하드코딩 대신 `review_categories` 참조 테이블로 관리자가
-- 나중에 조정 가능하게 한다.
--
-- 주의: `app/student/review-data.ts`/`ReviewPanel`/`app/teacher/review/[sessionId]`가
-- 참조하는 `session_reviews`/`session_review_categories`는 R6 cutover 이전
-- `legacy_sessions`(v1 목업 세션)를 대상으로 하는 완전히 별개의 레거시 코드다 —
-- 이번 통합 대상이 아니다(실사용 중인 v3 `sessions`/`subject_enrollments`와 무관).
--
-- 기존 `trial_lesson_reviews`(20261016000000)에 로컬 개발 DB에 쌓인 draft/final
-- 데이터가 있다면 손실 없이 새 테이블로 백필한 뒤, 이 서비스는 아직 오픈 전이라
-- 운영 고객 데이터가 없으므로(CLAUDE.md) 완전히 대체된 구 테이블·함수는 제거한다.

-- =========================================================================
-- 1. review_categories — 카테고리별 선생님 의견 항목. 하드코딩 금지, 관리자가
--    나중에 라벨/순서/활성 여부를 조정할 수 있게 참조 테이블로 둔다.
-- =========================================================================
create table review_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  display_order int not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into review_categories (key, label, display_order) values
  ('attitude', '학업 태도', 1),
  ('comprehension', '이해도', 2),
  ('participation', '참여도', 3),
  ('homework', '과제 이행', 4),
  ('overall', '종합 의견', 5);

alter table review_categories enable row level security;
-- 활성 카테고리 목록은 로그인한 누구나(선생님 작성 폼, 학생/보호자 표시 라벨) 조회 가능.
create policy "review_categories 조회(로그인 사용자)" on review_categories for select
  using (auth.uid() is not null);

create or replace function public.admin_upsert_review_category(
  p_key text,
  p_label text,
  p_display_order int,
  p_active boolean default true
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not is_admin() then
    raise exception '관리자만 리뷰 카테고리를 관리할 수 있습니다.';
  end if;
  insert into review_categories (key, label, display_order, active)
  values (p_key, p_label, p_display_order, p_active)
  on conflict (key) do update
    set label = excluded.label, display_order = excluded.display_order,
        active = excluded.active, updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;
-- is_admin()는 auth.uid() 기준으로 판정하므로(서비스 롤 키에는 auth.uid()가
-- 없어 항상 false) 반드시 관리자 본인 세션(authenticated)으로 호출해야 한다.
revoke execute on function public.admin_upsert_review_category(text, text, int, boolean) from public, anon;
grant execute on function public.admin_upsert_review_category(text, text, int, boolean) to authenticated, service_role;

-- =========================================================================
-- 2. lesson_reviews — 체험/정규 공용 리뷰 헤더. draft/final 2단계는 기존
--    trial_lesson_reviews 정책을 그대로 유지한다. 대상 세션은 lesson_type에 따라
--    trial_session_id/regular_session_id 중 정확히 하나만 채운다(둘 다 현재
--    `sessions` 테이블을 가리키지만, 트리거로 lesson_types.code와 lesson_type이
--    항상 일치하도록 강제해 나중에 두 흐름이 분리되어도 견고하게 유지된다).
-- =========================================================================
create table lesson_reviews (
  id uuid primary key default gen_random_uuid(),
  lesson_type text not null check (lesson_type in ('trial', 'regular')),
  trial_session_id uuid references sessions (id),
  regular_session_id uuid references sessions (id),
  subject_enrollment_id uuid not null references subject_enrollments (id),
  teacher_id uuid not null references profiles (id),
  status text not null default 'draft' check (status in ('draft', 'final')),
  -- AI 미팅록(Smart Notes) 기반 자동 요약 자리. 이번 범위에서는 실제 AI 호출을
  -- 배선하지 않는다 — 관리자/선생님이 검토 후 붙여넣거나, 이후 자동화가 이
  -- 컬럼을 채우는 것만 준비해 둔다.
  ai_summary text,
  final_text text,
  draft_text text,
  finalized_at timestamptz,
  admin_edited_by uuid references profiles (id),
  admin_edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_reviews_session_target_check check (
    (lesson_type = 'trial' and trial_session_id is not null and regular_session_id is null)
    or (lesson_type = 'regular' and regular_session_id is not null and trial_session_id is null)
  ),
  constraint lesson_reviews_trial_session_unique unique (trial_session_id),
  constraint lesson_reviews_regular_session_unique unique (regular_session_id)
);
create index on lesson_reviews (subject_enrollment_id);
create index on lesson_reviews (teacher_id);

alter table lesson_reviews enable row level security;
create policy "관리자·담당 선생님 조회" on lesson_reviews for select
  using (is_admin() or teacher_id = auth.uid());
-- 쓰기는 전부 아래 함수로만(trial_lesson_reviews와 동일 패턴).

-- =========================================================================
-- 3. lesson_review_category_notes — 카테고리별 선생님 의견. review_id + category_id
--    unique로 카테고리당 1건.
-- =========================================================================
create table lesson_review_category_notes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references lesson_reviews (id) on delete cascade,
  category_id uuid not null references review_categories (id),
  note text,
  updated_at timestamptz not null default now(),
  unique (review_id, category_id)
);
create index on lesson_review_category_notes (review_id);

alter table lesson_review_category_notes enable row level security;
create policy "관리자·담당 선생님 조회" on lesson_review_category_notes for select
  using (
    exists (
      select 1 from lesson_reviews r
      where r.id = review_id and (is_admin() or r.teacher_id = auth.uid())
    )
  );

-- =========================================================================
-- 4. 쓰기 함수 — session_id로 lesson_type/subject_enrollment_id/teacher_id를
--    자동 판별한다(sessions.lesson_type_id -> lesson_types.code). 카테고리별
--    의견은 jsonb 배열(category_key, note)로 한 번에 upsert한다.
-- =========================================================================
create or replace function public.save_lesson_review_draft(
  p_session_id uuid,
  p_ai_summary text,
  p_draft_text text,
  p_category_notes jsonb -- [{category_key, note}]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_teacher_id uuid;
  v_subject_enrollment_id uuid;
  v_lesson_type text;
  v_review_id uuid;
  v_existing_status text;
  v_note jsonb;
begin
  select s.teacher_id, s.subject_enrollment_id, lt.code
    into v_teacher_id, v_subject_enrollment_id, v_lesson_type
  from sessions s
  join lesson_types lt on lt.id = s.lesson_type_id
  where s.id = p_session_id;
  if not found then
    raise exception '수업을 찾을 수 없습니다: %', p_session_id;
  end if;
  if v_lesson_type not in ('trial', 'regular') then
    raise exception '체험/정규 수업만 리뷰를 작성할 수 있습니다: %', v_lesson_type;
  end if;
  if v_teacher_id is distinct from auth.uid() and not is_admin() then
    raise exception '담당 선생님만 리뷰 초안을 작성할 수 있습니다.';
  end if;

  select id, status into v_review_id, v_existing_status
  from lesson_reviews
  where (lesson_type = 'trial' and trial_session_id = p_session_id)
     or (lesson_type = 'regular' and regular_session_id = p_session_id)
  for update;

  if v_review_id is not null then
    if v_existing_status <> 'draft' then
      raise exception '이미 확정된 리뷰는 초안으로 되돌릴 수 없습니다(관리자 정정은 admin_edit_lesson_review 사용).';
    end if;
    update lesson_reviews
    set ai_summary = p_ai_summary, draft_text = p_draft_text, updated_at = now()
    where id = v_review_id;
  else
    insert into lesson_reviews (
      lesson_type, trial_session_id, regular_session_id,
      subject_enrollment_id, teacher_id, status, ai_summary, draft_text
    )
    values (
      v_lesson_type,
      case when v_lesson_type = 'trial' then p_session_id else null end,
      case when v_lesson_type = 'regular' then p_session_id else null end,
      v_subject_enrollment_id, v_teacher_id, 'draft', p_ai_summary, p_draft_text
    )
    returning id into v_review_id;
  end if;

  for v_note in select * from jsonb_array_elements(coalesce(p_category_notes, '[]'::jsonb))
  loop
    insert into lesson_review_category_notes (review_id, category_id, note, updated_at)
    select v_review_id, rc.id, v_note->>'note', now()
    from review_categories rc where rc.key = v_note->>'category_key'
    on conflict (review_id, category_id) do update
      set note = excluded.note, updated_at = now();
  end loop;

  return v_review_id;
end;
$$;
revoke execute on function public.save_lesson_review_draft(uuid, text, text, jsonb) from public, anon;
grant execute on function public.save_lesson_review_draft(uuid, text, text, jsonb) to authenticated, service_role;

create or replace function public.finalize_lesson_review(
  p_session_id uuid,
  p_final_text text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_row lesson_reviews%rowtype;
begin
  if coalesce(trim(p_final_text), '') = '' then
    raise exception '빈 리뷰는 확정할 수 없습니다.';
  end if;
  select * into v_row from lesson_reviews
  where trial_session_id = p_session_id or regular_session_id = p_session_id
  for update;
  if not found then
    raise exception '먼저 초안을 저장해야 합니다.';
  end if;
  if v_row.teacher_id is distinct from auth.uid() and not is_admin() then
    raise exception '담당 선생님만 리뷰를 확정할 수 있습니다.';
  end if;

  update lesson_reviews
  set status = 'final', final_text = p_final_text, finalized_at = coalesce(finalized_at, now()), updated_at = now()
  where id = v_row.id;

  return v_row.id;
end;
$$;
revoke execute on function public.finalize_lesson_review(uuid, text) from public, anon;
grant execute on function public.finalize_lesson_review(uuid, text) to authenticated, service_role;

-- 관리자 운영상 정정 — 확정된 리뷰만 대상, finalized_at은 보존.
create or replace function public.admin_edit_lesson_review(
  p_session_id uuid,
  p_final_text text,
  p_category_notes jsonb default null -- [{category_key, note}], null이면 카테고리 미변경
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_review_id uuid;
  v_note jsonb;
begin
  if not is_admin() then
    raise exception '관리자만 리뷰를 정정할 수 있습니다.';
  end if;
  if coalesce(trim(p_final_text), '') = '' then
    raise exception '빈 리뷰로 정정할 수 없습니다.';
  end if;

  update lesson_reviews
  set final_text = p_final_text, admin_edited_by = auth.uid(), admin_edited_at = now(), updated_at = now()
  where (trial_session_id = p_session_id or regular_session_id = p_session_id) and status = 'final'
  returning id into v_review_id;
  if v_review_id is null then
    raise exception '확정된 리뷰만 정정할 수 있습니다.';
  end if;

  if p_category_notes is not null then
    for v_note in select * from jsonb_array_elements(p_category_notes)
    loop
      insert into lesson_review_category_notes (review_id, category_id, note, updated_at)
      select v_review_id, rc.id, v_note->>'note', now()
      from review_categories rc where rc.key = v_note->>'category_key'
      on conflict (review_id, category_id) do update
        set note = excluded.note, updated_at = now();
    end loop;
  end if;
end;
$$;
revoke execute on function public.admin_edit_lesson_review(uuid, text, jsonb) from public, anon;
grant execute on function public.admin_edit_lesson_review(uuid, text, jsonb) to authenticated, service_role;

-- 보호자·학생 전용 조회 — 확정된 리뷰만(초안·Smart Notes 원본은 노출하지 않음).
-- 과목 수강당 최신 확정 리뷰 1건(체험/정규 통틀어) + 카테고리별 의견을 함께 반환.
create or replace function public.get_lesson_reviews_for_family(p_subject_enrollment_id uuid)
returns table (
  review_id uuid,
  lesson_type text,
  final_text text,
  ai_summary text,
  finalized_at timestamptz,
  category_key text,
  category_label text,
  category_note text
)
language plpgsql security definer set search_path = public as $$
begin
  if not (
    is_admin()
    or exists (
      select 1 from subject_enrollments se
      join household_members hc on hc.household_id = (
        select hm.household_id from household_members hm
        where hm.profile_id = se.child_id and hm.role = 'child' limit 1
      )
      where se.id = p_subject_enrollment_id
        and ((hc.profile_id = auth.uid() and hc.role = 'guardian') or se.child_id = auth.uid())
    )
  ) then
    return;
  end if;

  return query
    select r.id, r.lesson_type, r.final_text, r.ai_summary, r.finalized_at,
           rc.key, rc.label, cn.note
    from lesson_reviews r
    left join lesson_review_category_notes cn on cn.review_id = r.id
    left join review_categories rc on rc.id = cn.category_id
    where r.subject_enrollment_id = p_subject_enrollment_id and r.status = 'final'
    order by r.finalized_at asc, rc.display_order asc;
end;
$$;
revoke execute on function public.get_lesson_reviews_for_family(uuid) from public, anon;
grant execute on function public.get_lesson_reviews_for_family(uuid) to authenticated, service_role;

-- =========================================================================
-- 5. 기존 trial_lesson_reviews 데이터 백필 후 구 테이블/함수 제거. 개발 DB에만
--    존재하는 draft/final 리뷰를 손실 없이 lesson_reviews로 옮긴다(종합 의견
--    카테고리 note로도 복제해 카테고리별 화면에서 바로 보이게 한다).
-- =========================================================================
insert into lesson_reviews (
  id, lesson_type, trial_session_id, regular_session_id, subject_enrollment_id,
  teacher_id, status, final_text, draft_text, finalized_at,
  admin_edited_by, admin_edited_at, created_at, updated_at
)
select
  t.id, 'trial', t.session_id, null, t.subject_enrollment_id,
  t.teacher_id, t.status, t.final_text, t.draft_text, t.finalized_at,
  t.admin_edited_by, t.admin_edited_at, t.created_at, t.updated_at
from trial_lesson_reviews t;

insert into lesson_review_category_notes (review_id, category_id, note)
select t.id, rc.id, coalesce(t.final_text, t.draft_text)
from trial_lesson_reviews t
join review_categories rc on rc.key = 'overall'
where coalesce(t.final_text, t.draft_text) is not null;

-- confirm_regular_progress_intent()/trial_regular_progress_selections는 리뷰
-- 확정 여부만 참조하므로(테이블 직접 FK 없음) lesson_reviews로 갈아끼운다.
create or replace function public.confirm_regular_progress_intent(p_subject_enrollment_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_guardian_id uuid := auth.uid();
  v_existing_id uuid;
  v_new_id uuid;
begin
  if v_guardian_id is null or not exists (select 1 from parents where id = v_guardian_id) then
    raise exception '로그인한 보호자만 정규 진행을 희망할 수 있습니다.';
  end if;
  if not exists (
    select 1 from subject_enrollments se
    join household_members hc on hc.household_id = (
      select hm.household_id from household_members hm
      where hm.profile_id = se.child_id and hm.role = 'child' limit 1
    )
    where se.id = p_subject_enrollment_id and hc.profile_id = v_guardian_id and hc.role = 'guardian'
  ) then
    raise exception '본인 가족의 과목 수강에 대해서만 정규 진행을 희망할 수 있습니다.';
  end if;
  if not exists (
    select 1 from lesson_reviews
    where subject_enrollment_id = p_subject_enrollment_id and lesson_type = 'trial' and status = 'final'
  ) then
    raise exception '확정된 체험 리뷰가 있어야 정규 진행을 희망할 수 있습니다.';
  end if;

  select id into v_existing_id from trial_regular_progress_selections where subject_enrollment_id = p_subject_enrollment_id;
  if v_existing_id is not null then
    return v_existing_id;
  end if;

  insert into trial_regular_progress_selections (subject_enrollment_id, guardian_id)
  values (p_subject_enrollment_id, v_guardian_id)
  returning id into v_new_id;
  return v_new_id;
end;
$$;
revoke execute on function public.confirm_regular_progress_intent(uuid) from public, anon;
grant execute on function public.confirm_regular_progress_intent(uuid) to authenticated, service_role;

drop function if exists public.get_trial_lesson_review_for_family(uuid);
drop function if exists public.admin_edit_trial_lesson_review(uuid, text);
drop function if exists public.finalize_trial_lesson_review(uuid, text);
drop function if exists public.save_trial_lesson_review_draft(uuid, text);
drop table if exists trial_lesson_reviews;

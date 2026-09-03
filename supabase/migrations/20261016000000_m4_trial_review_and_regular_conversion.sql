-- M4 (2/N) — 체험 리뷰(Smart Notes 원본은 비공개, 확정된 리뷰만 고객 공개) +
-- 보호자의 정규 진행 희망 + 관리자 원클릭 계약 발송(proposals 불필요) + 진행에
-- 필요한 최소 draft 계약 헬퍼. 서명→구매→활성화는 기존 DocuSign 웹훅/R4/R5
-- 인프라를 그대로 재사용하므로 이 마이그레이션에서는 새로 만들지 않는다.

-- =========================================================================
-- 1. trial_lesson_reviews — 선생님이 Smart Notes 원본을 검토해 작성하는 고객용
--    체험 리뷰. draft/final 2단계, 확정 전에는 고객에게 절대 노출하지 않는다.
--    관리자는 확정 후에도 운영상 정정 가능(finalized_at은 최초 확정 시각으로
--    보존, 수정 시각은 admin_edited_at으로 별도 기록).
-- =========================================================================
create table trial_lesson_reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references sessions (id),
  subject_enrollment_id uuid not null references subject_enrollments (id),
  teacher_id uuid not null references profiles (id),
  status text not null default 'draft' check (status in ('draft', 'final')),
  draft_text text,
  final_text text,
  finalized_at timestamptz,
  admin_edited_by uuid references profiles (id),
  admin_edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on trial_lesson_reviews (subject_enrollment_id);
create index on trial_lesson_reviews (teacher_id);

alter table trial_lesson_reviews enable row level security;
-- SELECT: 관리자·담당 선생님 전체(초안 포함) 조회 가능. 보호자/학생은 이 테이블을
-- 직접 SELECT하지 않는다 — 아래 get_trial_lesson_review_for_family() 함수로만
-- (status='final'일 때 final_text만) 노출한다.
create policy "관리자·담당 선생님 조회" on trial_lesson_reviews for select
  using (is_admin() or teacher_id = auth.uid());
-- 쓰기는 전부 아래 함수로만.

create or replace function public.save_trial_lesson_review_draft(
  p_session_id uuid,
  p_draft_text text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_teacher_id uuid;
  v_subject_enrollment_id uuid;
  v_id uuid;
begin
  select teacher_id, subject_enrollment_id into v_teacher_id, v_subject_enrollment_id
  from sessions where id = p_session_id;
  if not found then
    raise exception '수업을 찾을 수 없습니다: %', p_session_id;
  end if;
  if v_teacher_id is distinct from auth.uid() and not is_admin() then
    raise exception '담당 선생님만 리뷰 초안을 작성할 수 있습니다.';
  end if;

  insert into trial_lesson_reviews (session_id, subject_enrollment_id, teacher_id, status, draft_text)
  values (p_session_id, v_subject_enrollment_id, v_teacher_id, 'draft', p_draft_text)
  on conflict (session_id) do update
    set draft_text = excluded.draft_text, updated_at = now()
    where trial_lesson_reviews.status = 'draft'
  returning id into v_id;

  if v_id is null then
    raise exception '이미 확정된 리뷰는 초안으로 되돌릴 수 없습니다(관리자 정정은 admin_edit_trial_lesson_review 사용).';
  end if;
  return v_id;
end;
$$;
revoke execute on function public.save_trial_lesson_review_draft(uuid, text) from public, anon;
grant execute on function public.save_trial_lesson_review_draft(uuid, text) to authenticated, service_role;

create or replace function public.finalize_trial_lesson_review(
  p_session_id uuid,
  p_final_text text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_row trial_lesson_reviews%rowtype;
begin
  if coalesce(trim(p_final_text), '') = '' then
    raise exception '빈 리뷰는 확정할 수 없습니다.';
  end if;
  select * into v_row from trial_lesson_reviews where session_id = p_session_id for update;
  if not found then
    raise exception '먼저 초안을 저장해야 합니다.';
  end if;
  if v_row.teacher_id is distinct from auth.uid() and not is_admin() then
    raise exception '담당 선생님만 리뷰를 확정할 수 있습니다.';
  end if;

  update trial_lesson_reviews
  set status = 'final', final_text = p_final_text, finalized_at = coalesce(finalized_at, now()), updated_at = now()
  where id = v_row.id;

  return v_row.id;
end;
$$;
revoke execute on function public.finalize_trial_lesson_review(uuid, text) from public, anon;
grant execute on function public.finalize_trial_lesson_review(uuid, text) to authenticated, service_role;

-- 관리자 운영상 정정 — 확정된 리뷰만 대상, finalized_at은 보존하고 편집자·시각만 기록.
create or replace function public.admin_edit_trial_lesson_review(
  p_session_id uuid,
  p_final_text text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception '관리자만 리뷰를 정정할 수 있습니다.';
  end if;
  if coalesce(trim(p_final_text), '') = '' then
    raise exception '빈 리뷰로 정정할 수 없습니다.';
  end if;
  update trial_lesson_reviews
  set final_text = p_final_text, admin_edited_by = auth.uid(), admin_edited_at = now(), updated_at = now()
  where session_id = p_session_id and status = 'final';
  if not found then
    raise exception '확정된 리뷰만 정정할 수 있습니다.';
  end if;
end;
$$;
revoke execute on function public.admin_edit_trial_lesson_review(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_edit_trial_lesson_review(uuid, text) to service_role;

-- 보호자·학생 전용 조회 — 확정된 리뷰의 final_text만 반환(초안·내부메모·Smart
-- Notes 원본·Drive 링크는 이 함수가 애초에 SELECT하지 않는다). 본인 가족의
-- subject_enrollment가 아니면 아무것도 반환하지 않는다(예외가 아니라 빈 결과 —
-- "아직 리뷰 없음"과 "권한 없음"을 구분해서 노출하지 않기 위함).
create or replace function public.get_trial_lesson_review_for_family(p_subject_enrollment_id uuid)
returns table (review_id uuid, final_text text, finalized_at timestamptz)
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
    select r.id, r.final_text, r.finalized_at
    from trial_lesson_reviews r
    where r.subject_enrollment_id = p_subject_enrollment_id and r.status = 'final';
end;
$$;
revoke execute on function public.get_trial_lesson_review_for_family(uuid) from public, anon;
grant execute on function public.get_trial_lesson_review_for_family(uuid) to authenticated, service_role;

-- =========================================================================
-- 2. trial_regular_progress_selections — 보호자의 "정규 진행 희망" 표시.
--    확정된 체험 리뷰가 없으면 표시 자체를 막는다(요구사항: 리뷰 미확정 시
--    정규 진행 선택 단계로 못 넘어감). 계약 체결/구매 확정이 아니다 — 그냥
--    관리자에게 "계약 발송 준비됨"으로 보이게 하는 신호일 뿐. 중복 선택으로
--    계약이 여러 개 생기지 않도록 subject_enrollment당 1건만(멱등 반환).
-- =========================================================================
create table trial_regular_progress_selections (
  id uuid primary key default gen_random_uuid(),
  subject_enrollment_id uuid not null unique references subject_enrollments (id),
  guardian_id uuid not null references parents (id),
  confirmed_at timestamptz not null default now()
);
alter table trial_regular_progress_selections enable row level security;
create policy "관리자·본인 보호자 조회" on trial_regular_progress_selections for select
  using (is_admin() or guardian_id = auth.uid());

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
    select 1 from trial_lesson_reviews where subject_enrollment_id = p_subject_enrollment_id and status = 'final'
  ) then
    raise exception '확정된 체험 리뷰가 있어야 정규 진행을 희망할 수 있습니다.';
  end if;

  select id into v_existing_id from trial_regular_progress_selections where subject_enrollment_id = p_subject_enrollment_id;
  if v_existing_id is not null then
    return v_existing_id; -- 멱등: 중복 선택으로 계약이 여러 개 생기지 않는다.
  end if;

  insert into trial_regular_progress_selections (subject_enrollment_id, guardian_id)
  values (p_subject_enrollment_id, v_guardian_id)
  returning id into v_new_id;
  return v_new_id;
end;
$$;
revoke execute on function public.confirm_regular_progress_intent(uuid) from public, anon;
grant execute on function public.confirm_regular_progress_intent(uuid) to authenticated, service_role;

-- =========================================================================
-- 3. get_or_create_draft_contract_for_child — 관리자 원클릭 계약 발송(9번)의
--    "①기존 계약/진행중 envelope 대조" 단계에서 쓰는 헬퍼. 이미 draft가 아닌
--    (sent 이상 진행됐거나 active인) 계약이 있으면 그 계약을 그대로 반환한다
--    — proposals를 요구하지 않고, 새 계약을 중복 생성하지 않는다.
-- =========================================================================
create or replace function public.get_or_create_draft_contract_for_child(p_child_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_household_id uuid;
  v_existing_id uuid;
  v_new_id uuid;
begin
  if not is_admin() then
    raise exception '관리자만 계약을 준비할 수 있습니다.';
  end if;

  select id into v_existing_id from contracts
  where child_id = p_child_id and status not in ('void', 'superseded', 'terminated', 'expired')
  order by created_at desc limit 1;
  if v_existing_id is not null then
    return v_existing_id;
  end if;

  select hm.household_id into v_household_id
  from household_members hm where hm.profile_id = p_child_id and hm.role = 'child' limit 1;
  if v_household_id is null then
    raise exception '이 학생의 가족(household)을 찾을 수 없습니다.';
  end if;

  insert into contracts (household_id, child_id, status) values (v_household_id, p_child_id, 'draft')
  returning id into v_new_id;
  return v_new_id;
end;
$$;
revoke execute on function public.get_or_create_draft_contract_for_child(uuid) from public, anon, authenticated;
grant execute on function public.get_or_create_draft_contract_for_child(uuid) to service_role;

-- M4 후속 — 확정된 lesson_reviews를 담당 선생님이 직접 정정할 수 있게 하되(운영
-- 요구: "확정 후에도 선생님 수정 가능, 단 수정 이력이 남아야 함"), 수정할 때마다
-- 이전 확정 버전을 append-only 이력 테이블에 남긴다. admin_edit_lesson_review도
-- 같은 이력을 남기도록 통합한다(기존 admin_edited_by/at 단일 컬럼은 "마지막
-- 정정자"만 남고 그 이전 버전은 사라졌었다).
--
-- 이미 수업이 시작된 뒤의 교재·문제·학생 답안·필기 사본(session_files 등)은 이
-- 함수가 손대는 테이블이 아니므로(오직 lesson_reviews/lesson_review_category_notes)
-- 리뷰 수정으로 절대 변경되지 않는다.

create table lesson_review_edit_history (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references lesson_reviews (id) on delete cascade,
  edited_by uuid not null references profiles (id),
  edited_by_role text not null check (edited_by_role in ('teacher', 'admin')),
  edited_at timestamptz not null default now(),
  -- 정정 직전 값의 스냅샷(정정 후 값이 아니라 "무엇을 덮어썼는지"를 남긴다).
  previous_final_text text not null,
  previous_category_notes jsonb not null default '[]'::jsonb
);
create index on lesson_review_edit_history (review_id, edited_at desc);

alter table lesson_review_edit_history enable row level security;
create policy "관리자·담당 선생님 조회" on lesson_review_edit_history for select
  using (
    exists (
      select 1 from lesson_reviews r
      where r.id = review_id and (is_admin() or r.teacher_id = auth.uid())
    )
  );
-- 쓰기는 아래 함수 내부(security definer)에서만.

-- 담당 선생님 본인이 확정된 리뷰를 정정. finalized_at은 보존(최초 확정 시각),
-- 정정 전 값은 lesson_review_edit_history에 남긴다.
create or replace function public.teacher_edit_finalized_lesson_review(
  p_session_id uuid,
  p_final_text text,
  p_category_notes jsonb default null -- [{category_key, note}], null이면 카테고리 미변경
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_review lesson_reviews%rowtype;
  v_prev_notes jsonb;
  v_note jsonb;
begin
  if coalesce(trim(p_final_text), '') = '' then
    raise exception '빈 리뷰로 정정할 수 없습니다.';
  end if;

  select * into v_review from lesson_reviews
  where (trial_session_id = p_session_id or regular_session_id = p_session_id) and status = 'final'
  for update;
  if not found then
    raise exception '확정된 리뷰만 정정할 수 있습니다.';
  end if;
  if v_review.teacher_id is distinct from auth.uid() then
    raise exception '담당 선생님만 리뷰를 정정할 수 있습니다(관리자는 admin_edit_lesson_review 사용).';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('category_key', rc.key, 'note', n.note)), '[]'::jsonb)
    into v_prev_notes
  from lesson_review_category_notes n
  join review_categories rc on rc.id = n.category_id
  where n.review_id = v_review.id;

  insert into lesson_review_edit_history (review_id, edited_by, edited_by_role, previous_final_text, previous_category_notes)
  values (v_review.id, auth.uid(), 'teacher', v_review.final_text, v_prev_notes);

  update lesson_reviews
  set final_text = p_final_text, updated_at = now()
  where id = v_review.id;

  if p_category_notes is not null then
    for v_note in select * from jsonb_array_elements(p_category_notes)
    loop
      insert into lesson_review_category_notes (review_id, category_id, note, updated_at)
      select v_review.id, rc.id, v_note->>'note', now()
      from review_categories rc where rc.key = v_note->>'category_key'
      on conflict (review_id, category_id) do update
        set note = excluded.note, updated_at = now();
    end loop;
  end if;
end;
$$;
revoke execute on function public.teacher_edit_finalized_lesson_review(uuid, text, jsonb) from public, anon;
grant execute on function public.teacher_edit_finalized_lesson_review(uuid, text, jsonb) to authenticated, service_role;

-- admin_edit_lesson_review도 같은 이력 테이블에 남기도록 교체(관리자 정정 이력이
-- admin_edited_by/at 최신값만 남고 그 이전 정정 내용이 사라지던 결함 수정).
create or replace function public.admin_edit_lesson_review(
  p_session_id uuid,
  p_final_text text,
  p_category_notes jsonb default null -- [{category_key, note}], null이면 카테고리 미변경
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_review lesson_reviews%rowtype;
  v_prev_notes jsonb;
  v_note jsonb;
begin
  if not is_admin() then
    raise exception '관리자만 리뷰를 정정할 수 있습니다.';
  end if;
  if coalesce(trim(p_final_text), '') = '' then
    raise exception '빈 리뷰로 정정할 수 없습니다.';
  end if;

  select * into v_review from lesson_reviews
  where (trial_session_id = p_session_id or regular_session_id = p_session_id) and status = 'final'
  for update;
  if not found then
    raise exception '확정된 리뷰만 정정할 수 있습니다.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('category_key', rc.key, 'note', n.note)), '[]'::jsonb)
    into v_prev_notes
  from lesson_review_category_notes n
  join review_categories rc on rc.id = n.category_id
  where n.review_id = v_review.id;

  insert into lesson_review_edit_history (review_id, edited_by, edited_by_role, previous_final_text, previous_category_notes)
  values (v_review.id, auth.uid(), 'admin', v_review.final_text, v_prev_notes);

  update lesson_reviews
  set final_text = p_final_text, admin_edited_by = auth.uid(), admin_edited_at = now(), updated_at = now()
  where id = v_review.id;

  if p_category_notes is not null then
    for v_note in select * from jsonb_array_elements(p_category_notes)
    loop
      insert into lesson_review_category_notes (review_id, category_id, note, updated_at)
      select v_review.id, rc.id, v_note->>'note', now()
      from review_categories rc where rc.key = v_note->>'category_key'
      on conflict (review_id, category_id) do update
        set note = excluded.note, updated_at = now();
    end loop;
  end if;
end;
$$;

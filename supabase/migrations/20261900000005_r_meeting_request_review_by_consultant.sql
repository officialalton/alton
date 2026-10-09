-- 2026-09-24(사용자 지시) — "상담 리뷰는 담당 컨설턴트가 작성해야지, 상담을
-- 담당 컨설턴트가 하는데" — 20261409000000에서 관리자 전용으로 만든 상담
-- 리뷰 draft/finalize/edit를, 그 meeting_request의 담당 컨설턴트
-- (meeting_requests.consultant_id, 20261470000000/20261563000000부터
-- 보호자·학생 상담 신청 시 이미 채워지고 있다)도 쓸 수 있게 바꾼다. 관리자는
-- 오탈자·긴급 정정 등 예외 대응을 위해 계속 쓸 수 있게 남겨둔다(권한 축소가
-- 아니라 확장).

create or replace function public.is_admin_or_meeting_request_consultant(p_meeting_request_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from meeting_requests mr
    where mr.id = p_meeting_request_id and mr.consultant_id = auth.uid()
  );
$$;
revoke execute on function public.is_admin_or_meeting_request_consultant(uuid) from public, anon;
grant execute on function public.is_admin_or_meeting_request_consultant(uuid) to authenticated, service_role;

create or replace function public.save_meeting_request_review_draft(
  p_meeting_request_id uuid,
  p_draft_text text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_status text;
begin
  if not is_admin_or_meeting_request_consultant(p_meeting_request_id) then
    raise exception '관리자 또는 담당 컨설턴트만 상담 리뷰를 작성할 수 있습니다.';
  end if;
  select id, status into v_id, v_status from meeting_request_reviews where meeting_request_id = p_meeting_request_id;
  if v_id is null then
    insert into meeting_request_reviews (meeting_request_id, draft_text, created_by)
    values (p_meeting_request_id, p_draft_text, auth.uid())
    returning id into v_id;
  else
    if v_status = 'final' then
      raise exception '이미 확정된 리뷰는 초안으로 되돌릴 수 없습니다. 수정은 admin_edit_meeting_request_review를 사용하세요.';
    end if;
    update meeting_request_reviews set draft_text = p_draft_text, updated_at = now() where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.finalize_meeting_request_review(
  p_meeting_request_id uuid,
  p_final_text text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not is_admin_or_meeting_request_consultant(p_meeting_request_id) then
    raise exception '관리자 또는 담당 컨설턴트만 상담 리뷰를 확정할 수 있습니다.';
  end if;
  select id into v_id from meeting_request_reviews where meeting_request_id = p_meeting_request_id;
  if v_id is null then
    insert into meeting_request_reviews (meeting_request_id, final_text, status, finalized_at, created_by)
    values (p_meeting_request_id, p_final_text, 'final', now(), auth.uid())
    returning id into v_id;
  else
    update meeting_request_reviews
      set final_text = p_final_text, status = 'final', finalized_at = coalesce(finalized_at, now()), updated_at = now()
      where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.admin_edit_meeting_request_review(
  p_meeting_request_id uuid,
  p_final_text text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_previous text;
begin
  if not is_admin_or_meeting_request_consultant(p_meeting_request_id) then
    raise exception '관리자 또는 담당 컨설턴트만 확정된 리뷰를 수정할 수 있습니다.';
  end if;
  select id, final_text into v_id, v_previous from meeting_request_reviews
    where meeting_request_id = p_meeting_request_id and status = 'final';
  if v_id is null then
    raise exception '확정된 리뷰가 없어 수정할 수 없습니다.';
  end if;
  insert into meeting_request_review_edits (meeting_request_review_id, previous_final_text, edited_by)
    values (v_id, v_previous, auth.uid());
  update meeting_request_reviews
    set final_text = p_final_text, admin_edited_by = auth.uid(), admin_edited_at = now(), updated_at = now()
    where id = v_id;
  return v_id;
end;
$$;

-- 담당 컨설턴트가 자기 상담의 draft/final 리뷰·수정 이력을 조회할 수 있어야
-- 위 함수들을 실제로 쓸 수 있다(RLS는 함수 실행 권한과 별개).
create policy "담당 컨설턴트 조회" on meeting_request_reviews for select using (
  exists (
    select 1 from meeting_requests mr
    where mr.id = meeting_request_reviews.meeting_request_id and mr.consultant_id = auth.uid()
  )
);
create policy "담당 컨설턴트 조회" on meeting_request_review_edits for select using (
  exists (
    select 1 from meeting_request_reviews rev
    join meeting_requests mr on mr.id = rev.meeting_request_id
    where rev.id = meeting_request_review_edits.meeting_request_review_id
      and mr.consultant_id = auth.uid()
  )
);

-- R12.1(상담 신청 마무리 — 2026-09-17 2차 지시) — R12 V1(신청·메신저) 위에
-- 세 가지를 추가한다:
--  1. meeting_requests에 lib/consultation/calendar-sync.ts와 동일한
--     idempotent Google Calendar/Meet 동기화 컬럼(consultations 패턴 그대로
--     복사). google_meet_link는 R11에 이미 있으므로 나머지만 추가.
--  2. meeting_request_reviews — lesson_reviews와 동일한 draft/final 쓰기
--     함수 패턴(직접 insert/update RLS 정책 없음, SECURITY DEFINER 함수로만
--     쓰기). 이번에는 "수정 이력"이 요구사항이라 매 admin_edit마다 이전
--     final_text를 meeting_request_review_edits에 남긴다.
--  3. meeting_request_review_drive_access — 미팅록(Drive) 링크를 보호자에게
--     보여주기 전에 "실제 권한 부여가 성공했는지"를 앱이 확인할 수 있는
--     상태 컬럼(session_drive_tasks와 동일한 상태값 어휘, 별도 큐 테이블은
--     아님 — meeting_requests는 세션이 아니라 session_drive_tasks의
--     session_id not null FK를 재사용할 수 없어 전용 테이블을 둔다).

-- =========================================================================
-- 1. meeting_requests — Calendar/Meet 동기화 컬럼
-- =========================================================================
alter table meeting_requests
  add column if not exists google_event_id text,
  add column if not exists google_meeting_code text,
  add column if not exists google_sync_status text check (
    google_sync_status in ('pending', 'succeeded', 'failed', 'reconciliation_needed')
  ),
  add column if not exists google_sync_retry_count int not null default 0;

comment on column meeting_requests.google_event_id is
  'R12.1: lib/consultation/calendar-sync.ts와 동일 패턴. null이면 아직 캘린더 이벤트 생성 전(멱등 생성 게이트).';
comment on column meeting_requests.google_sync_status is
  'R12.1: pending(생성/갱신 대기)·succeeded·failed·reconciliation_needed(재시도 상한 초과). starts_at/ends_at이 둘 다 유효할 때만 pending으로 만든다.';

-- =========================================================================
-- 2. meeting_request_reviews — 완료된 상담 리뷰(초안/확정), 수정 이력 포함
-- =========================================================================
create table meeting_request_reviews (
  id uuid primary key default gen_random_uuid(),
  meeting_request_id uuid not null unique references meeting_requests (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'final')),
  draft_text text,
  final_text text,
  finalized_at timestamptz,
  admin_edited_by uuid references profiles (id),
  admin_edited_at timestamptz,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table meeting_request_reviews is
  'R12.1: 완료된 상담(meeting_requests.status=completed)의 관리자 리뷰. lesson_reviews와 동일하게 직접 RLS insert/update 정책 없음 — 아래 함수로만 쓴다.';

alter table meeting_request_reviews enable row level security;
create policy "관리자 전체 조회" on meeting_request_reviews for select using (is_admin());
create policy "보호자 확정본만 조회" on meeting_request_reviews for select using (
  status = 'final' and exists (
    select 1 from meeting_requests mr
    join household_members hm on hm.household_id = mr.household_id
    where mr.id = meeting_request_reviews.meeting_request_id
      and hm.profile_id = auth.uid()
      and hm.role = 'guardian'
  )
);

create table meeting_request_review_edits (
  id uuid primary key default gen_random_uuid(),
  meeting_request_review_id uuid not null references meeting_request_reviews (id) on delete cascade,
  previous_final_text text,
  edited_by uuid not null references profiles (id),
  edited_at timestamptz not null default now()
);
create index on meeting_request_review_edits (meeting_request_review_id, edited_at);

comment on table meeting_request_review_edits is
  'R12.1: 확정 후 관리자 수정 이력. admin_edit_meeting_request_review()가 덮어쓰기 전 final_text를 여기 남긴다. lesson_reviews에는 없던 요구사항(수정 이력)이라 새로 추가.';

alter table meeting_request_review_edits enable row level security;
create policy "관리자 전체 조회" on meeting_request_review_edits for select using (is_admin());
-- 보호자는 이력을 보지 않는다(확정본만 열람 — 스펙 "학부모는... 확정 리뷰"만).

create or replace function public.save_meeting_request_review_draft(
  p_meeting_request_id uuid,
  p_draft_text text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_status text;
begin
  if not is_admin() then
    raise exception '관리자만 상담 리뷰를 작성할 수 있습니다.';
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
revoke execute on function public.save_meeting_request_review_draft(uuid, text) from public, anon;
grant execute on function public.save_meeting_request_review_draft(uuid, text) to authenticated, service_role;

create or replace function public.finalize_meeting_request_review(
  p_meeting_request_id uuid,
  p_final_text text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not is_admin() then
    raise exception '관리자만 상담 리뷰를 확정할 수 있습니다.';
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
revoke execute on function public.finalize_meeting_request_review(uuid, text) from public, anon;
grant execute on function public.finalize_meeting_request_review(uuid, text) to authenticated, service_role;

create or replace function public.admin_edit_meeting_request_review(
  p_meeting_request_id uuid,
  p_final_text text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_previous text;
begin
  if not is_admin() then
    raise exception '관리자만 확정된 리뷰를 수정할 수 있습니다.';
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
revoke execute on function public.admin_edit_meeting_request_review(uuid, text) from public, anon;
grant execute on function public.admin_edit_meeting_request_review(uuid, text) to authenticated, service_role;

-- =========================================================================
-- 3. meeting_request_review_drive_access — 미팅록 링크 노출 전 권한 검증 상태
-- =========================================================================
create table meeting_request_review_drive_access (
  meeting_request_review_id uuid primary key references meeting_request_reviews (id) on delete cascade,
  drive_file_id text not null,
  status text not null default 'pending' check (status in ('pending', 'granted', 'failed')),
  retry_count int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table meeting_request_review_drive_access is
  'R12.1: 미팅록(Drive 문서) 보호자 열람 권한 부여 상태. status=granted일 때만 앱이 링크를 노출한다(스펙: "미팅록이 없거나 권한을 줄 수 없으면 링크를 표시하지 않음"). session_drive_tasks(session_id not null)는 재사용 불가해 전용 테이블을 둔다 — 실제 Drive 권한 부여 API 호출은 DRIVE_ARTIFACTS_ALLOW_REAL_WRITES 게이트를 그대로 재사용.';

alter table meeting_request_review_drive_access enable row level security;
create policy "관리자 전체 조회" on meeting_request_review_drive_access for select using (is_admin());
create policy "보호자 본인 확정 리뷰 조회" on meeting_request_review_drive_access for select using (
  exists (
    select 1 from meeting_request_reviews rev
    join meeting_requests mr on mr.id = rev.meeting_request_id
    join household_members hm on hm.household_id = mr.household_id
    where rev.id = meeting_request_review_drive_access.meeting_request_review_id
      and rev.status = 'final'
      and hm.profile_id = auth.uid()
      and hm.role = 'guardian'
  )
);
-- 쓰기는 서비스 롤(권한 부여 워커)만 — session_drive_tasks와 동일하게 authenticated 쓰기 정책 없음.

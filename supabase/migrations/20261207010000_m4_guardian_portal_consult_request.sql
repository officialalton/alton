-- M4 후속(2026-09-06) — 보호자 포털 "새 자녀 상담 신청" 전용 화면. 랜딩(홈페이지)
-- 상담 신청과 동일한 단일 원본(consultations 테이블, list_open_consult_slots() RPC)을
-- 그대로 쓰되, (a) 신청 출처를 구분해 관리자 칸반에서 배지로 보여주고, (b) 한 번의
-- 신청에 여러 자녀 정보를 담을 수 있게 한다(자녀별 Auth 계정/초대는 이 단계에서 만들지
-- 않는다 — 여전히 관리자가 발송하는 온보딩 흐름의 몫).

-- =========================================================================
-- 1) 신청 출처 구분 — 'guardian_portal' enum 값은 이전 마이그레이션
--    (20261207000000_m4_guardian_portal_consult_source_enum.sql)에서 이미 추가했다.
--    'admin'은 관리자가 직접 등록한 상담, 'homepage'는 랜딩 신청, 'guardian_portal'은
--    로그인한 보호자가 포털에서 신청한 건이다.
-- =========================================================================

-- =========================================================================
-- 2) 자녀별 신청 정보 — 한 번의 신청(=한 슬롯 예약)에 자녀 1~N명 정보를 담는다.
--    각 자녀는 아직 Auth 계정이 없으므로 child_id로 연결할 수 없다 — 이름/학년/
--    관심과목/상담내용을 jsonb 배열로 그대로 보존한다. 관리자가 이후 온보딩 발송
--    시 이 배열을 참고해 학생별 카드를 만든다(기존 TrialOnboardingStudentsForm 흐름,
--    이번 마이그레이션은 스키마만 추가 — 그 폼과의 연결은 범위 밖).
-- =========================================================================
alter table consultations add column if not exists requested_children jsonb;

comment on column consultations.requested_children is
  '2026-09-06: 보호자 포털 "새 자녀 상담 신청"에서 입력한 자녀별 정보 배열
  ([{"name":"...","grade":"...","subjectInterest":"...","concerns":"..."}]).
  source=guardian_portal 신청에서만 채워진다. 랜딩(homepage) 신청은 단일 학생
  정보를 기존 student_grade/concerns 컬럼에 그대로 쓴다(변경 없음).';

-- =========================================================================
-- 3) 보호자 포털 전용 상담 신청 RPC — submit_homepage_consult_request()와 겹치는
--    검증(슬롯 정시 단위, 겹침 방지, 중복 처리 대기 방지)을 그대로 따르되,
--    보호자 정보는 인자로 받지 않고 세션에서 이미 확인된 household_id/guardian_id/
--    이름/이메일만 받는다(재입력 없음 — 화면에서 세션값을 그대로 넘긴다).
--    prospect_contacts는 만들지 않는다(이미 가입한 보호자라 잠재고객이 아님).
-- =========================================================================
create or replace function public.submit_guardian_portal_consult_request(
  p_household_id uuid,
  p_guardian_id uuid,
  p_guardian_name text,
  p_guardian_email text,
  p_starts_at timestamptz,
  p_children jsonb,
  p_idempotency_key text
)
returns consultations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ends_at timestamptz := p_starts_at + interval '60 minutes';
  v_consultation consultations;
  v_existing consultations;
  v_child_count int;
begin
  if not exists (
    select 1 from household_members
    where household_id = p_household_id and profile_id = p_guardian_id and role = 'guardian'
  ) then
    raise exception '본인 household에 대해서만 상담을 신청할 수 있습니다.' using errcode = 'P0001';
  end if;

  if p_children is null or jsonb_typeof(p_children) <> 'array' then
    raise exception '자녀 정보가 올바르지 않습니다.' using errcode = 'P0001';
  end if;
  select count(*) into v_child_count from jsonb_array_elements(p_children);
  if v_child_count < 1 then
    raise exception '자녀를 1명 이상 입력해주세요.' using errcode = 'P0001';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from consultations where idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  if p_starts_at <= now() then
    raise exception '지난 시간은 상담을 신청할 수 없습니다.' using errcode = 'P0001';
  end if;

  if extract(minute from p_starts_at) not in (0) or extract(second from p_starts_at) <> 0 then
    raise exception '상담 슬롯은 정시 단위로만 신청할 수 있습니다.' using errcode = 'P0001';
  end if;

  perform 1 from consultations c
  where c.starts_at is not null
    and c.status in ('requested', 'scheduled')
    and tstzrange(c.starts_at, c.ends_at) && tstzrange(p_starts_at, v_ends_at)
  for update;
  if found then
    raise exception '이미 다른 상담이 신청되었거나 확정된 시간입니다. 다른 시간을 선택해 주세요.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from consultations c
    where c.status = 'requested'
      and c.household_id = p_household_id
      and c.source = 'guardian_portal'
  ) then
    raise exception '이미 처리 대기 중인 자녀 추가 상담 신청이 있습니다. 관리자가 확인할 때까지 기다려 주세요.' using errcode = 'P0001';
  end if;

  insert into consultations (
    household_id, source, contact_name, contact_email,
    student_grade, category, concerns, status, requested_at,
    starts_at, ends_at, idempotency_key, requested_children, created_by
  ) values (
    p_household_id, 'guardian_portal', p_guardian_name, p_guardian_email,
    null, 'family', null, 'requested', now(),
    p_starts_at, v_ends_at, p_idempotency_key, p_children, p_guardian_id
  )
  returning * into v_consultation;

  return v_consultation;
end;
$$;

revoke execute on function public.submit_guardian_portal_consult_request(uuid, uuid, text, text, timestamptz, jsonb, text) from public, anon;
grant execute on function public.submit_guardian_portal_consult_request(uuid, uuid, text, text, timestamptz, jsonb, text) to authenticated, service_role;

comment on function public.submit_guardian_portal_consult_request is
  '2026-09-06: 보호자 포털 "새 자녀 상담 신청" 전용 — submit_homepage_consult_request()와
  동일한 슬롯 검증을 따르되 이미 로그인한 household/guardian 기준으로 신청한다.
  자녀 Auth 계정/초대는 만들지 않는다(관리자 온보딩 발송 흐름의 몫).';

-- =========================================================================
-- 4) 보호자 본인 household의 신청 이력 조회 — 진행중/완료/취소 전부 포함,
--    admin_review_summary(고객 공개 승인 요약)만 노출하고 내부 메모/Smart Notes
--    원본은 아예 select하지 않는다(정책상 노출 금지).
-- =========================================================================
create or replace function public.list_guardian_portal_consult_requests(p_household_id uuid)
returns table (
  id uuid,
  status v3_consultation_status,
  source consult_slot_source,
  requested_children jsonb,
  starts_at timestamptz,
  scheduled_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  google_meet_link text,
  admin_review_summary text,
  requested_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.status, c.source, c.requested_children, c.starts_at, c.scheduled_at,
    c.completed_at, c.cancelled_at, c.cancellation_reason, c.google_meet_link,
    c.admin_review_summary, c.requested_at
  from consultations c
  where c.household_id = p_household_id
    and c.source = 'guardian_portal'
  order by c.requested_at desc;
$$;

revoke execute on function public.list_guardian_portal_consult_requests(uuid) from public, anon;
grant execute on function public.list_guardian_portal_consult_requests(uuid) to authenticated, service_role;

comment on function public.list_guardian_portal_consult_requests is
  '2026-09-06: 보호자 포털 "새 자녀 상담 신청" 이력 조회 — 호출자가 실제로 이
  household의 guardian인지는 서버 액션(app/parent/consult-request-actions.ts)이
  requireUser()+household_members 조회로 이미 검증한 household_id만 넘겨준다는
  전제. RPC 자체는 SECURITY DEFINER라 별도 RLS를 타지 않으므로 이 전제가 유일한
  방어선 — service_role/authenticated 전용으로 제한한다.';

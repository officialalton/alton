-- 2026-09-22(사용자 지시 — "학생이 컨설턴트랑 일정 잡는 것도 UI 필요하겠다,
-- 수업 예약하는거랑 똑같이" + "신청만 하고 컨설턴트/관리자가 최종 확인 후
-- 확정") — meeting_requests(기존 "면담" 신청 테이블)에 담당 컨설턴트 개념을
-- 추가한다. 학생 개인 단위로 신청할 수 있어야 한다(household 전체 참여 불필요) —
-- requested_by/child_id가 이미 있으므로 RLS만 "본인" 기준으로 넓힌다.

alter table meeting_requests add column if not exists consultant_id uuid references profiles (id);
create index if not exists meeting_requests_consultant_id_idx on meeting_requests (consultant_id);
comment on column meeting_requests.consultant_id is
  '2026-09-22: 담당 컨설턴트와의 개인 일정 요청일 때만 채워진다. 기존 학부모 상담 신청(관리자 풀)은 null로 유지.';

-- 학생 본인(household 소속과 무관하게 requested_by/child_id = 자신)도 조회·신청.
create policy "학생 본인 조회" on meeting_requests for select using (
  requested_by = auth.uid() or child_id = auth.uid()
);
create policy "학생 본인 신청" on meeting_requests for insert with check (
  requested_by = auth.uid() and child_id = auth.uid()
  and (
    consultant_id is null
    or exists (
      select 1 from consultant_assignments ca
      where ca.student_id = auth.uid() and ca.consultant_id = meeting_requests.consultant_id
    )
  )
);

-- 담당 컨설턴트도 자기 앞으로 온 요청을 조회·확정/거절할 수 있다(스펙 —
-- "Only the assigned admissions consultant... may create or modify the first
-- meeting after assignment"). 상태·일정 변경은 기존 관리자 전용 정책과
-- 별도로 추가한다(REPLACE가 아니라 추가 정책 — 여러 정책은 OR로 합쳐진다).
create policy "담당 컨설턴트 조회" on meeting_requests for select using (
  consultant_id = auth.uid()
);
create policy "담당 컨설턴트 상태·일정 변경" on meeting_requests for update using (
  consultant_id = auth.uid()
) with check (
  consultant_id = auth.uid()
);

-- 학생 본인도 완료된 면담의 확정 리뷰·미팅록을 볼 수 있다(보호자 정책과 동일 조건,
-- household 대신 본인 신청/자녀 기준).
create policy "학생 본인 확정본만 조회" on meeting_request_reviews for select using (
  status = 'final' and exists (
    select 1 from meeting_requests mr
    where mr.id = meeting_request_reviews.meeting_request_id
      and (mr.requested_by = auth.uid() or mr.child_id = auth.uid())
  )
);
create policy "학생 본인 확정 리뷰 조회" on meeting_request_review_drive_access for select using (
  exists (
    select 1 from meeting_request_reviews rev
    join meeting_requests mr on mr.id = rev.meeting_request_id
    where rev.id = meeting_request_review_drive_access.meeting_request_review_id
      and rev.status = 'final'
      and (mr.requested_by = auth.uid() or mr.child_id = auth.uid())
  )
);

-- 담당 컨설턴트 전용 슬롯 조회 — list_open_consult_slots()와 동일 계산이지만
-- consult_availability_rules를 특정 컨설턴트로 좁히고, 그 컨설턴트의 기존
-- 상담(consultations)·면담(meeting_requests) 점유를 함께 뺀다.
create or replace function public.list_open_consultant_meeting_slots(
  p_consultant_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (slot_starts_at timestamptz)
language sql stable
security definer
set search_path = public
as $$
  with weekday_rules as (
    select r.weekday, r.start_time, r.end_time
    from consult_availability_rules r
    where r.active and r.consultant_id = p_consultant_id
  ),
  days as (
    select generate_series(date_trunc('day', p_from), date_trunc('day', p_to), interval '1 day')::date as d
  ),
  candidate_slots as (
    select
      ((d.d + wr.start_time)::timestamp at time zone 'America/Los_Angeles' + (n * interval '60 minutes')) as slot_start,
      ((d.d + wr.start_time)::timestamp at time zone 'America/Los_Angeles' + ((n + 1) * interval '60 minutes')) as slot_end
    from days d
    join weekday_rules wr on wr.weekday = extract(dow from d.d)::smallint
    cross join lateral generate_series(0, (extract(epoch from (wr.end_time - wr.start_time)) / 3600)::int - 1) as n
  )
  select distinct cs.slot_start
  from candidate_slots cs
  where cs.slot_start >= p_from
    and cs.slot_start < p_to
    and cs.slot_start > now()
    and not exists (
      select 1 from consultations c
      where c.admissions_consultant_id = p_consultant_id
        and c.starts_at is not null
        and c.status in ('requested', 'scheduled')
        and tstzrange(c.starts_at, c.ends_at) && tstzrange(cs.slot_start, cs.slot_end)
    )
    and not exists (
      select 1 from meeting_requests mr
      where mr.consultant_id = p_consultant_id
        and mr.starts_at is not null
        and mr.status in ('requested', 'confirming', 'scheduling', 'scheduled')
        and tstzrange(mr.starts_at, mr.ends_at) && tstzrange(cs.slot_start, cs.slot_end)
    )
  order by cs.slot_start;
$$;

grant execute on function public.list_open_consultant_meeting_slots(uuid, timestamptz, timestamptz) to authenticated;

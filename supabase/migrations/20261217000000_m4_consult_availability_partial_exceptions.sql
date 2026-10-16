-- 2026-09-07 — 제품 오너 지적: 공용 상담 가능시간 관리 화면에서 "하루 단위로 통 휴무일
-- 지정하는 기능만 있어서" 특정 날짜의 일부 시간대만 휴무/임시오픈으로 등록할 수 없다.
--
-- 실측: `consult_availability_exceptions.start_time`/`end_time` 컬럼은 이미
-- 20261009000000_m1_consultation_unification.sql에서 만들어져 있었고, check 제약도
-- `is_closed=true`일 때 start_time/end_time을 이미 자유롭게 허용한다(값이 있어도
-- 제약 위반이 아님) — 즉 스키마는 부분 휴무를 이미 지원할 수 있는 형태였다. 문제는
-- `list_open_consult_slots()`가 `is_closed`인 예외 행이 하나라도 있으면 start_time/
-- end_time 값을 완전히 무시하고 그 날짜 전체를 닫아버리던 버그였다(원래 주석: "관리자
-- UI는 항상 종일 휴무만 등록했으므로 발견되지 않았음"). 선생님 쪽 `is_teacher_slot_open()`
-- (teacher_availability_exceptions, 20260926000000_r6_availability_and_booking.sql)은
-- 이미 부분 시간 예외를 올바르게 지원하고 있었다 — 그 패턴을 그대로 이식한다.
--
-- 추가로 `is_closed=false`(임시 오픈) 예외가 반복 규칙 밖의 시간대를 실제로 열도록
-- 후보 슬롯 생성에도 반영한다(기존에는 이 테이블에 값이 있어도 후보 슬롯이 전혀
-- 생성되지 않아 관리자 화면의 "임시 오픈" 표시가 사실상 장식이었다).
--
-- 컬럼/테이블 변경 없음 — 함수 로직만 정정(additive, CREATE OR REPLACE).

create or replace function public.list_open_consult_slots(
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
    where r.active
  ),
  days as (
    select generate_series(date_trunc('day', p_from), date_trunc('day', p_to), interval '1 day')::date as d
  ),
  -- 반복 가능시간 규칙에서 나오는 60분 슬롯 후보.
  rule_candidate_slots as (
    select
      ((d.d + wr.start_time)::timestamp at time zone 'America/Los_Angeles' + (n * interval '60 minutes')) as slot_start,
      ((d.d + wr.start_time)::timestamp at time zone 'America/Los_Angeles' + ((n + 1) * interval '60 minutes')) as slot_end
    from days d
    join weekday_rules wr on wr.weekday = extract(dow from d.d)::smallint
    cross join lateral generate_series(0, (extract(epoch from (wr.end_time - wr.start_time)) / 3600)::int - 1) as n
  ),
  -- 2026-09-07 신규: 부분 시간 "임시 오픈" 예외(is_closed=false + start_time/end_time)에서
  -- 나오는 60분 슬롯 후보. 반복 규칙 밖의 날짜/시간대도 이 예외만으로 열 수 있다.
  exception_open_candidate_slots as (
    select
      ((e.exception_date + e.start_time)::timestamp at time zone 'America/Los_Angeles' + (n * interval '60 minutes')) as slot_start,
      ((e.exception_date + e.start_time)::timestamp at time zone 'America/Los_Angeles' + ((n + 1) * interval '60 minutes')) as slot_end
    from consult_availability_exceptions e
    cross join lateral generate_series(0, (extract(epoch from (e.end_time - e.start_time)) / 3600)::int - 1) as n
    where not e.is_closed and e.start_time is not null and e.end_time is not null
  ),
  candidate_slots as (
    select * from rule_candidate_slots
    union all
    select * from exception_open_candidate_slots
  )
  select distinct cs.slot_start
  from candidate_slots cs
  where cs.slot_start >= p_from
    and cs.slot_start < p_to
    and cs.slot_start > now()
    -- 2026-09-07 정정: is_closed 예외는 start_time이 null이면 종일 차단, 아니면 그
    -- 시간대와 겹치는 슬롯만 차단한다(기존 버그: start_time/end_time 값과 무관하게
    -- 항상 종일 차단 — teacher_availability_exceptions/is_teacher_slot_open()과
    -- 동일한 부분 시간 예외 패턴으로 정정).
    and not exists (
      select 1 from consult_availability_exceptions e
      where e.exception_date = (cs.slot_start at time zone 'America/Los_Angeles')::date
        and e.is_closed
        and (
          e.start_time is null
          or (
            (cs.slot_start at time zone 'America/Los_Angeles')::time < e.end_time
            and (cs.slot_end at time zone 'America/Los_Angeles')::time > e.start_time
          )
        )
    )
    and not exists (
      select 1 from consultations c
      where c.starts_at is not null
        and c.status in ('requested', 'scheduled')
        and tstzrange(c.starts_at, c.ends_at) && tstzrange(cs.slot_start, cs.slot_end)
    )
  order by cs.slot_start;
$$;

comment on function public.list_open_consult_slots(timestamptz, timestamptz) is
  'M1 요구사항 1·2: 반복 가능시간 + 임시 오픈 예외에서 휴무 예외(종일/부분 시간)를 제거하고, 이미 점유된(requested 또는 scheduled) 슬롯을 '
  '뺀 열린 60분 슬롯 후보를 반환. 최종 중복 방지 방어선은 consultations_no_overlap 배타 제약. '
  '(2026-09-07 정정) 부분 시간 휴무/임시오픈 예외를 실제로 반영(teacher_availability_exceptions와 동일 패턴). '
  '(2026-09-03 정정) hold 자동 만료를 제거해 requested도 scheduled와 동일하게 항상 점유로 취급한다.';

grant execute on function public.list_open_consult_slots(timestamptz, timestamptz) to anon, authenticated;

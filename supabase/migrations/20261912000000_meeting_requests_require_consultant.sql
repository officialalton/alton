-- 2026-09-29 오너 규칙: 상담과 미팅(meeting_requests)은 고객과 "배정된 컨설턴트" 사이에만 존재한다
-- (관리자가 잡는 일정 포함). 추가 전용 — 기존 행·이력은 삭제·수정하지 않는다.
--
--   1) 컨설턴트 없는 행은 활성 상태(requested/confirming/scheduling/scheduled)에서 starts_at/ends_at 을
--      가질 수 없고 status='scheduled' 가 될 수 없다(신규 기록에만 적용).
--   2) 같은 컨설턴트는 겹치는 두 미팅, 또는 본인 상담(consultations, requested/scheduled)과 겹치는
--      미팅을 가질 수 없다. 컨설턴트가 다르면 겹쳐도 된다. 컨설턴트별 advisory lock 으로 동시 쓰기 직렬화.
--
-- 트리거는 UPDATE OF starts_at, ends_at, status, consultant_id 일 때만 발동해, 옛 행의 메모·동기화
-- 컬럼 수정 등 무관한 UPDATE 는 막지 않는다. 옛 위반 행은 원격·로컬 실측 0건(시간 보유 미배정 행 없음).
-- 롤백: drop trigger meeting_requests_enforce_consultant on meeting_requests;
--       drop function public.meeting_requests_enforce_consultant();  (데이터 변경 없음)

create or replace function public.meeting_requests_enforce_consultant()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_active boolean := new.status in ('requested', 'confirming', 'scheduling', 'scheduled');
begin
  if new.consultant_id is null then
    if new.status = 'scheduled' or (v_active and (new.starts_at is not null or new.ends_at is not null)) then
      raise exception '먼저 담당 컨설턴트를 배정해 주세요. 담당 컨설턴트가 없는 미팅에는 일정을 잡을 수 없습니다.' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if v_active and new.starts_at is not null and new.ends_at is not null then
    perform pg_advisory_xact_lock(hashtextextended('meeting-consultant-' || new.consultant_id::text, 0));
    if exists (
      select 1 from meeting_requests m
      where m.consultant_id = new.consultant_id and m.id <> new.id
        and m.status in ('requested', 'confirming', 'scheduling', 'scheduled')
        and m.starts_at is not null and m.ends_at is not null
        and tstzrange(m.starts_at, m.ends_at) && tstzrange(new.starts_at, new.ends_at)
    ) then
      raise exception '같은 컨설턴트의 다른 미팅과 시간이 겹칩니다. 다른 시간을 선택해 주세요.' using errcode = '23P01';
    end if;
    if exists (
      select 1 from consultations c
      where c.admissions_consultant_id = new.consultant_id
        and c.status in ('requested', 'scheduled')
        and c.starts_at is not null and c.ends_at is not null
        and tstzrange(c.starts_at, c.ends_at) && tstzrange(new.starts_at, new.ends_at)
    ) then
      raise exception '같은 컨설턴트의 상담 일정과 시간이 겹칩니다. 다른 시간을 선택해 주세요.' using errcode = '23P01';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists meeting_requests_enforce_consultant on meeting_requests;
create trigger meeting_requests_enforce_consultant
  before insert or update of starts_at, ends_at, status, consultant_id on meeting_requests
  for each row execute function public.meeting_requests_enforce_consultant();

comment on function public.meeting_requests_enforce_consultant() is
  '2026-09-29: 미팅은 배정된 컨설턴트와만(컨설턴트 없는 시간·scheduled 금지) + 컨설턴트별 미팅·상담 겹침 금지.';

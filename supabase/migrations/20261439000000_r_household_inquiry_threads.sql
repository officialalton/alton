-- 2026-09-22(사용자 지시) — 학부모<->관리자 메신저를 household 전체가 공유하는 하나의
-- 끝없는 대화 대신 "문의" 단위 스레드로 바꾼다. 관리자가 문의를 닫으면 그 스레드는
-- 닫힌 채 내역에 남고, 재문의는 새 문의를 새로 연다. 기존 household_messages는 그대로
-- 두고 문의 테이블 + inquiry_id만 가산한다(비프로덕션, 실사용자 데이터 없음 — 기존
-- 메시지는 household당 문의 하나로 묶어 백필한다).

create table household_inquiries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id),
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_by uuid not null references profiles (id),
  opened_by_role text not null check (opened_by_role in ('guardian', 'admin')),
  closed_by uuid references profiles (id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index on household_inquiries (household_id, status, last_message_at desc);
create index on household_inquiries (status, last_message_at desc);

comment on table household_inquiries is
  '문의 단위 스레드(2026-09-22). 관리자가 닫으면 status=closed로 내역에 남고, 재문의는 새 행을 만든다.';

alter table household_inquiries enable row level security;
create policy "관리자 전체 조회" on household_inquiries for select using (is_admin());
create policy "보호자 본인 household 조회" on household_inquiries for select using (
  exists (
    select 1 from household_members hm
    where hm.household_id = household_inquiries.household_id
      and hm.profile_id = auth.uid()
      and hm.role = 'guardian'
  )
);
create policy "관리자 작성" on household_inquiries for insert with check (
  is_admin() and opened_by_role = 'admin' and opened_by = auth.uid()
);
create policy "보호자 본인 household 작성" on household_inquiries for insert with check (
  opened_by_role = 'guardian' and opened_by = auth.uid() and exists (
    select 1 from household_members hm
    where hm.household_id = household_inquiries.household_id
      and hm.profile_id = auth.uid()
      and hm.role = 'guardian'
  )
);
-- 문의 닫기(+ last_message_at 갱신)는 관리자만.
create policy "관리자만 상태 변경" on household_inquiries for update using (is_admin()) with check (is_admin());

-- household_messages를 문의에 귀속시킨다. status(open/resolved)는 이제 문의 단위로만
-- 관리하므로 메시지 개별 상태 컬럼은 걷어낸다.
alter table household_messages add column inquiry_id uuid references household_inquiries (id);

insert into household_inquiries (household_id, status, opened_by, opened_by_role, created_at, last_message_at)
select
  hm.household_id,
  case when bool_or(hm.status = 'open') then 'open' else 'closed' end,
  (select sender_id from household_messages hm2 where hm2.household_id = hm.household_id order by created_at asc limit 1),
  (select sender_role from household_messages hm2 where hm2.household_id = hm.household_id order by created_at asc limit 1),
  min(hm.created_at),
  max(hm.created_at)
from household_messages hm
group by hm.household_id;

update household_messages hm
set inquiry_id = hi.id
from household_inquiries hi
where hi.household_id = hm.household_id and hm.inquiry_id is null;

alter table household_messages alter column inquiry_id set not null;
create index on household_messages (inquiry_id, created_at);
alter table household_messages drop column status;

-- 메시지는 열린 문의에만 남길 수 있다(닫힌 문의는 읽기 전용 — 재문의는 새 문의로).
drop policy if exists "관리자 작성" on household_messages;
create policy "관리자 작성" on household_messages for insert with check (
  is_admin() and sender_role = 'admin' and sender_id = auth.uid()
  and exists (select 1 from household_inquiries hi where hi.id = household_messages.inquiry_id and hi.status = 'open')
);
drop policy if exists "보호자 본인 household 작성" on household_messages;
create policy "보호자 본인 household 작성" on household_messages for insert with check (
  sender_role = 'guardian' and sender_id = auth.uid()
  and exists (
    select 1 from household_members hm
    where hm.household_id = household_messages.household_id
      and hm.profile_id = auth.uid()
      and hm.role = 'guardian'
  )
  and exists (select 1 from household_inquiries hi where hi.id = household_messages.inquiry_id and hi.status = 'open')
);
drop policy if exists "관리자만 상태 변경" on household_messages;

-- 문의 종료: 상태를 닫고 last_message_at은 그대로 둔다(정렬 기준 유지).
create or replace function public.close_household_inquiry(p_inquiry_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '관리자만 문의를 종료할 수 있습니다.'; end if;
  update household_inquiries set status = 'closed', closed_by = auth.uid(), closed_at = now()
  where id = p_inquiry_id and status = 'open';
end $$;

-- 메시지 저장 시 문의의 last_message_at을 같이 갱신(목록 정렬용) — 트리거로 자동화해
-- 클라이언트마다 따로 업데이트를 잊는 실수를 막는다.
create or replace function public._touch_household_inquiry_last_message()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update household_inquiries set last_message_at = new.created_at where id = new.inquiry_id;
  return new;
end $$;
drop trigger if exists trg_touch_household_inquiry on household_messages;
create trigger trg_touch_household_inquiry
  after insert on household_messages
  for each row execute function public._touch_household_inquiry_last_message();

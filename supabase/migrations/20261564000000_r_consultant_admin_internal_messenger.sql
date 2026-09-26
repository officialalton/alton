-- Phase A 마무리(2026-09-23, 사용자 지시) — "관리자와 컨설턴트의 이슈
-- 보고·업무 지침 대화가 가능한지 확인합니다." 지금까지 컨설턴트는
-- household_inquiries(가족용)에서만 메시지를 주고받았다 — 관리자와
-- 컨설턴트끼리만의 내부 채널은 없었다(감사 결과 확인됨). household_inquiries
-- 패턴을 그대로 본떠 별도 테이블로 만든다 — 고객(학생·보호자)에게는 이
-- 두 테이블에 대한 SELECT 정책 자체를 아예 두지 않는다(기본 거부 —
-- teacher_assignment_requests와 같은 원칙).

create table consultant_admin_inquiries (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references profiles (id),
  subject text,
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_by uuid not null references profiles (id),
  opened_by_role text not null check (opened_by_role in ('consultant', 'admin')),
  closed_by uuid references profiles (id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index on consultant_admin_inquiries (consultant_id, status, last_message_at desc);
create index on consultant_admin_inquiries (status, last_message_at desc);

comment on table consultant_admin_inquiries is
  '2026-09-23(Phase A 마무리) — 관리자<->컨설턴트 내부 문의 스레드(이슈 보고·
  업무 지침). household_inquiries와 같은 패턴이지만 완전히 별도 테이블이다 —
  학생·보호자는 이 테이블에 대한 SELECT 정책이 아예 없어 볼 수 없다.';

alter table consultant_admin_inquiries enable row level security;
create policy "관리자 전체 조회" on consultant_admin_inquiries for select using (is_admin());
create policy "본인 컨설턴트 조회" on consultant_admin_inquiries for select using (consultant_id = auth.uid());
create policy "관리자 생성" on consultant_admin_inquiries for insert with check (is_admin() and opened_by_role = 'admin');
create policy "본인 컨설턴트 생성" on consultant_admin_inquiries for insert
  with check (consultant_id = auth.uid() and opened_by_role = 'consultant' and opened_by = auth.uid());
create policy "관리자 종료" on consultant_admin_inquiries for update using (is_admin());

create table consultant_admin_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references consultant_admin_inquiries (id) on delete cascade,
  sender_id uuid not null references profiles (id),
  sender_role text not null check (sender_role in ('consultant', 'admin')),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index on consultant_admin_messages (inquiry_id, created_at);

comment on table consultant_admin_messages is
  '2026-09-23(Phase A 마무리) — consultant_admin_inquiries 스레드의 메시지.';

alter table consultant_admin_messages enable row level security;
create policy "관리자 전체 조회" on consultant_admin_messages for select using (is_admin());
create policy "본인 컨설턴트 조회" on consultant_admin_messages for select using (
  exists (select 1 from consultant_admin_inquiries i where i.id = inquiry_id and i.consultant_id = auth.uid())
);
create policy "관리자 작성" on consultant_admin_messages for insert
  with check (is_admin() and sender_role = 'admin' and sender_id = auth.uid());
create policy "본인 컨설턴트 작성" on consultant_admin_messages for insert
  with check (
    sender_role = 'consultant' and sender_id = auth.uid()
    and exists (select 1 from consultant_admin_inquiries i where i.id = inquiry_id and i.consultant_id = auth.uid() and i.status = 'open')
  );

create or replace function public.close_consultant_admin_inquiry(p_inquiry_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '관리자만 문의를 종료할 수 있습니다.'; end if;
  update consultant_admin_inquiries set status = 'closed', closed_by = auth.uid(), closed_at = now()
  where id = p_inquiry_id and status = 'open';
end $$;

create or replace function public._touch_consultant_admin_inquiry_last_message()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update consultant_admin_inquiries set last_message_at = new.created_at where id = new.inquiry_id;
  return new;
end $$;
create trigger trg_touch_consultant_admin_inquiry
  after insert on consultant_admin_messages
  for each row execute function public._touch_consultant_admin_inquiry_last_message();

-- household_message_reads(20261209000000 계열)와 같은 패턴 — 컨설턴트별로
-- 본인/관리자 각자의 마지막 열람 시각만 기록한다(1:1 채널이라 household_id
-- 대신 consultant_id로 키를 잡는다).
create table consultant_admin_message_reads (
  consultant_id uuid not null references profiles (id),
  viewer_role text not null check (viewer_role in ('consultant', 'admin')),
  last_read_at timestamptz not null default now(),
  primary key (consultant_id, viewer_role)
);

alter table consultant_admin_message_reads enable row level security;
create policy "관리자 전체 조회·기록" on consultant_admin_message_reads for all using (is_admin()) with check (is_admin());
create policy "본인 컨설턴트 조회·기록" on consultant_admin_message_reads for all
  using (consultant_id = auth.uid()) with check (consultant_id = auth.uid());

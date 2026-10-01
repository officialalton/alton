-- 관리자 포털 정리 항목 2(2026-09-23) — "관리자 Messenger는 먼저
-- Teachers / Consultants로 구분하고..." 컨설턴트는 20261564000000에서
-- consultant_admin_inquiries/messages를 만들었지만, 선생님<->관리자 내부
-- 채널은 아직 없다(감사 결과: 선생님은 QC 경고·배정 요청 알림만 받고
-- 관리자에게 먼저 말을 걸 방법이 없었음). 완전히 같은 패턴으로 별도
-- 테이블을 만든다 — 학생·보호자는 이 테이블에 대한 SELECT 정책이 없다.

create table teacher_admin_inquiries (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles (id),
  subject text,
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_by uuid not null references profiles (id),
  opened_by_role text not null check (opened_by_role in ('teacher', 'admin')),
  closed_by uuid references profiles (id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index on teacher_admin_inquiries (teacher_id, status, last_message_at desc);
create index on teacher_admin_inquiries (status, last_message_at desc);

comment on table teacher_admin_inquiries is
  '2026-09-23(관리자 포털 정리 항목 2) — 관리자<->선생님 내부 문의 스레드.
  consultant_admin_inquiries(20261564000000)와 완전히 같은 패턴. 학생·보호자는
  이 테이블에 대한 SELECT 정책이 아예 없어 볼 수 없다.';

alter table teacher_admin_inquiries enable row level security;
create policy "관리자 전체 조회" on teacher_admin_inquiries for select using (is_admin());
create policy "본인 선생님 조회" on teacher_admin_inquiries for select using (teacher_id = auth.uid());
create policy "관리자 생성" on teacher_admin_inquiries for insert with check (is_admin() and opened_by_role = 'admin');
create policy "본인 선생님 생성" on teacher_admin_inquiries for insert
  with check (teacher_id = auth.uid() and opened_by_role = 'teacher' and opened_by = auth.uid());
create policy "관리자 종료" on teacher_admin_inquiries for update using (is_admin());

create table teacher_admin_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references teacher_admin_inquiries (id) on delete cascade,
  sender_id uuid not null references profiles (id),
  sender_role text not null check (sender_role in ('teacher', 'admin')),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index on teacher_admin_messages (inquiry_id, created_at);

alter table teacher_admin_messages enable row level security;
create policy "관리자 전체 조회" on teacher_admin_messages for select using (is_admin());
create policy "본인 선생님 조회" on teacher_admin_messages for select using (
  exists (select 1 from teacher_admin_inquiries i where i.id = inquiry_id and i.teacher_id = auth.uid())
);
create policy "관리자 작성" on teacher_admin_messages for insert
  with check (is_admin() and sender_role = 'admin' and sender_id = auth.uid());
create policy "본인 선생님 작성" on teacher_admin_messages for insert
  with check (
    sender_role = 'teacher' and sender_id = auth.uid()
    and exists (select 1 from teacher_admin_inquiries i where i.id = inquiry_id and i.teacher_id = auth.uid() and i.status = 'open')
  );

create or replace function public.close_teacher_admin_inquiry(p_inquiry_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '관리자만 문의를 종료할 수 있습니다.'; end if;
  update teacher_admin_inquiries set status = 'closed', closed_by = auth.uid(), closed_at = now()
  where id = p_inquiry_id and status = 'open';
end $$;

create or replace function public._touch_teacher_admin_inquiry_last_message()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update teacher_admin_inquiries set last_message_at = new.created_at where id = new.inquiry_id;
  return new;
end $$;
create trigger trg_touch_teacher_admin_inquiry
  after insert on teacher_admin_messages
  for each row execute function public._touch_teacher_admin_inquiry_last_message();

create table teacher_admin_message_reads (
  teacher_id uuid not null references profiles (id),
  viewer_role text not null check (viewer_role in ('teacher', 'admin')),
  last_read_at timestamptz not null default now(),
  primary key (teacher_id, viewer_role)
);

alter table teacher_admin_message_reads enable row level security;
create policy "관리자 전체 조회·기록" on teacher_admin_message_reads for all using (is_admin()) with check (is_admin());
create policy "본인 선생님 조회·기록" on teacher_admin_message_reads for all
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

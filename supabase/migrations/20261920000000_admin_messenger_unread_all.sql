-- 2026-09-29 — 관리자 사이드바 Messenger 배지를 세 채널(선생님·컨설턴트·가족) 합계로.
-- 지금까지 선생님/컨설턴트 채널은 관리자 쪽 읽음 추적이 없어 배지가 가족 채널만
-- 셌다. 스레드(문의) 단위 관리자 읽음 표시를 새로 만든다(additive).
-- 기존 teacher_/consultant_admin_message_reads(스태프별, viewer_role='teacher'/
-- 'consultant')는 각 포털의 자기 안읽음 표시용이라 건드리지 않는다 — 관리자 읽음과
-- 완전히 독립이다.
-- 롤백: drop function admin_messenger_unread_counts(), admin_unread_staff_inquiry_ids(text);
--       drop table consultant_admin_inquiry_admin_reads, teacher_admin_inquiry_admin_reads;

create table if not exists consultant_admin_inquiry_admin_reads (
  inquiry_id uuid primary key references consultant_admin_inquiries (id) on delete cascade,
  last_read_at timestamptz not null default now()
);
create table if not exists teacher_admin_inquiry_admin_reads (
  inquiry_id uuid primary key references teacher_admin_inquiries (id) on delete cascade,
  last_read_at timestamptz not null default now()
);
alter table consultant_admin_inquiry_admin_reads enable row level security;
alter table teacher_admin_inquiry_admin_reads enable row level security;
drop policy if exists "관리자 전체 조회·기록" on consultant_admin_inquiry_admin_reads;
create policy "관리자 전체 조회·기록" on consultant_admin_inquiry_admin_reads for all using (is_admin()) with check (is_admin());
drop policy if exists "관리자 전체 조회·기록" on teacher_admin_inquiry_admin_reads;
create policy "관리자 전체 조회·기록" on teacher_admin_inquiry_admin_reads for all using (is_admin()) with check (is_admin());

-- 최초 배포 시 기존 열린 스레드가 한꺼번에 '안읽음'으로 뜨지 않도록, 지금 열려 있는
-- 스레드는 현재 시각으로 읽음 처리한다(이후 도착하는 스태프 메시지부터 안읽음).
insert into consultant_admin_inquiry_admin_reads (inquiry_id, last_read_at)
  select id, now() from consultant_admin_inquiries where status = 'open'
  on conflict do nothing;
insert into teacher_admin_inquiry_admin_reads (inquiry_id, last_read_at)
  select id, now() from teacher_admin_inquiries where status = 'open'
  on conflict do nothing;

-- 안읽음 정의: 열린 문의 중 스태프(선생님/컨설턴트) 메시지가 관리자 last_read_at보다 새롭거나
-- 읽음 행이 없는 스레드.
create or replace function public.admin_unread_staff_inquiry_ids(p_kind text)
returns setof uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if p_kind = 'teachers' then
    return query
      select i.id from teacher_admin_inquiries i
      left join teacher_admin_inquiry_admin_reads r on r.inquiry_id = i.id
      where i.status = 'open'
        and exists (select 1 from teacher_admin_messages m
                    where m.inquiry_id = i.id and m.sender_role = 'teacher'
                      and (r.last_read_at is null or m.created_at > r.last_read_at));
  elsif p_kind = 'consultants' then
    return query
      select i.id from consultant_admin_inquiries i
      left join consultant_admin_inquiry_admin_reads r on r.inquiry_id = i.id
      where i.status = 'open'
        and exists (select 1 from consultant_admin_messages m
                    where m.inquiry_id = i.id and m.sender_role = 'consultant'
                      and (r.last_read_at is null or m.created_at > r.last_read_at));
  else
    raise exception 'unknown kind %', p_kind;
  end if;
end $$;

-- 세 채널 안읽음 문의 수를 한 번에. 가족은 기존 정의(보호자 메시지, household 단위 관리자 읽음).
create or replace function public.admin_messenger_unread_counts()
returns table (teachers integer, consultants integer, family integer)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from admin_unread_staff_inquiry_ids('teachers')),
    (select count(*)::int from admin_unread_staff_inquiry_ids('consultants')),
    (select count(*)::int from household_inquiries hi
      left join household_message_reads r on r.household_id = hi.household_id and r.viewer_role = 'admin'
      where hi.status = 'open'
        and exists (select 1 from household_messages m
                    where m.inquiry_id = hi.id and m.sender_role = 'guardian'
                      and (r.last_read_at is null or m.created_at > r.last_read_at)));
$$;

revoke all on function public.admin_unread_staff_inquiry_ids(text) from public, anon, authenticated;
revoke all on function public.admin_messenger_unread_counts() from public, anon, authenticated;
grant execute on function public.admin_unread_staff_inquiry_ids(text) to service_role;
grant execute on function public.admin_messenger_unread_counts() to service_role;

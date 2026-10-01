-- R9 — WhiteboardCanvas가 session_annotation_events INSERT를 Supabase Realtime
-- postgres_changes로 구독하려면(SessionShell/WhiteboardCanvas.tsx) 해당 테이블이
-- supabase_realtime publication에 포함되어 있어야 한다. 이 프로젝트의 다른 실시간
-- 기능(app/student/ChatPanel.tsx의 chat_messages)도 같은 publication을 전제로
-- 하므로, 로컬/스테이징 어디서든 publication이 이미 존재한다는 가정이 안전하다.
-- 혹시 없는 환경에서도 마이그레이션이 깨지지 않도록 존재 여부를 확인하고 이미
-- 추가돼 있으면 건너뛴다(재실행 안전).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'session_annotation_events'
    ) then
      alter publication supabase_realtime add table public.session_annotation_events;
    end if;
  end if;
end;
$$;

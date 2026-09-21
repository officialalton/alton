-- 2026-09-21(UAT 지적 "수업 시작 후 문제·교재 추가가 한참 뒤에야 반영된다")
--
-- 세션뷰(app/session/[id])는 답안/채점 변화만 Realtime broadcast 로 서로 알렸고, 교사가 수업 중 문제·교재를
-- 추가해 session_content_manifest 가 바뀌는 것은 아무 알림도 없었다(학생은 새로고침해야 보였다).
-- session_content_manifest 를 Realtime publication 에 넣어 클라이언트가 postgres_changes 로 이 세션의
-- 구성 변화를 즉시 받고(router.refresh) 화면을 다시 그리게 한다. RLS 는 그대로다 — Realtime 은 구독자가
-- SELECT 할 수 있는 행의 변화만 전달한다(세션 당사자만 manifest 를 읽을 수 있다).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'session_content_manifest'
  ) then
    alter publication supabase_realtime add table public.session_content_manifest;
  end if;
end $$;

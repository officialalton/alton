-- 2026-09-29 — 원격에만 있던 RLS 자동 활성화 이벤트 트리거를 마이그레이션으로 기록 + 권한 축소.
--
-- `db diff --linked`에서 발견. public.rls_auto_enable() + event trigger ensure_rls는
-- Supabase 프로젝트 옵션("새 테이블에 RLS 자동 활성화")이 만든 객체라 어떤 마이그레이션에도
-- 없었다 → 로컬·CI DB에는 없고 원격에만 있는 드리프트. 원격 동작(새 public 테이블에
-- RLS 자동 on)을 로컬에서도 똑같이 재현하도록 정의를 그대로 옮긴다(이미 있으면 트리거는
-- 건너뛴다). 함수는 SECURITY DEFINER인데 기본 PUBLIC EXECUTE로 anon/authenticated까지
-- 실행 권한이 열려 있어(Supabase 보안 점검 경고 대상) 회수한다 — 이벤트 트리거 실행에는
-- EXECUTE 권한이 필요 없다.

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls
      on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable();
  end if;
end;
$$;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

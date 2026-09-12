-- R9 corrective — session_prepared_selection pin-lock bypass 제거
--
-- 배경: 20261232000000_r9_session_prepared_selection.sql의
-- check_prepared_selection_not_pinned_self()/check_prepared_selection_not_pinned()가
-- "app.bypass_prepared_selection_lock" 커스텀 GUC로 pin-lock을 우회하는 분기를
-- 두고 있었다. 그 마이그레이션의 주석은 "앱 코드 어떤 역할에도 이 GUC를 설정할
-- 권한/그랜트를 주지 않는다(superuser psql로만 설정 가능)"고 가정했지만, 이는
-- 잘못된 가정이다 — PostgreSQL의 커스텀 GUC(플레인 SQL 마이그레이션으로 선언된,
-- C 확장의 GUC_SUPERUSER_ONLY가 아닌 GUC)는 GRANT/REVOKE 대상이 아니며, 어떤
-- 롤이든(authenticated 포함) 자신의 세션에서 `SET app.bypass_prepared_selection_lock
-- = 'true'`를 실행할 수 있다. 즉 인증된 어떤 클라이언트든 이 한 줄만으로 pin된
-- session_prepared_selections 행과 그 하위 3개 테이블(units, unit_keywords,
-- content_items)의 불변식을 완전히 무력화할 수 있었다 — Task 1이 의존하는
-- "pin 이후 불변" 보장이 실질적으로 존재하지 않았다는 뜻이다.
--
-- 수정: 두 트리거 함수에서 bypass 분기를 통째로 제거한다. 이제 pin-lock에는
-- 어떤 설정 가능한 탈출구도 없다 — 오직 service_role(RLS/트리거를 우회하는
-- Supabase 관리 롤)만이 필요 시 우회할 수 있고, 이는 GUC가 아니라 Postgres
-- 자체의 롤 권한 모델이므로 애플리케이션 코드가 흉내낼 수 없다.
--
-- 테스트 영향: app/teacher/session-prepared-selection.integration.test.ts가
-- 정리(cleanup)를 위해 이 GUC에 의존하던 것을 이 커밋에서 함께 고쳤다(pinned된
-- 테스트 행은 더 이상 afterEach에서 지우지 않고, CLAUDE.md의 UAT 정리 관례대로
-- `supabase db reset --local`에 맡긴다). 새 회귀 테스트가 "GUC를 설정해도
-- 더 이상 아무 효과가 없다"는 것 자체를 직접 검증한다.

create or replace function public.check_prepared_selection_not_pinned_self()
returns trigger
language plpgsql as $$
begin
  if old.status = 'pinned' then
    raise exception '핀 완료된 준비된 선택은 더 이상 수정할 수 없습니다.';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.check_prepared_selection_not_pinned(p_prepared_selection_id uuid)
returns void
language plpgsql as $$
declare
  v_status session_prepared_selection_status;
begin
  select status into v_status from session_prepared_selections where id = p_prepared_selection_id;
  -- v_status가 null(부모 행이 이미 사라짐)인 경우는 두 가지뿐이다: (a) 애초에
  -- 잘못된 id가 들어왔거나(FK가 이미 막으므로 정상 경로에서는 불가능), (b)
  -- ON DELETE CASCADE로 부모(session_prepared_selections)가 먼저 지워지는 도중
  -- RI 트리거가 이 자식 행을 지우려는 것 — 이 경우는 막을 이유가 없다(부모가
  -- 이미 삭제 처리됐다는 것 자체가 그 삭제가 self-lock 트리거를 통과했다는
  -- 뜻이므로). 따라서 null이면 조용히 통과시킨다(raise하지 않음).
  if v_status = 'pinned' then
    raise exception '핀 완료된 준비된 선택은 더 이상 수정할 수 없습니다.';
  end if;
end;
$$;

comment on function public.check_prepared_selection_not_pinned_self() is
  'R9 corrective: pin-lock에는 설정 가능한 bypass가 없다(app.bypass_prepared_selection_lock GUC 분기 완전 제거 — 어떤 역할이든 SET으로 설정 가능했던 취약점).';
comment on function public.check_prepared_selection_not_pinned(uuid) is
  'R9 corrective: pin-lock에는 설정 가능한 bypass가 없다(app.bypass_prepared_selection_lock GUC 분기 완전 제거 — 어떤 역할이든 SET으로 설정 가능했던 취약점).';

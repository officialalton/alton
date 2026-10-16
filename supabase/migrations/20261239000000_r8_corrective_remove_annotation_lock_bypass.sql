-- R8 corrective — session_annotation_events append-only lock bypass 제거
--
-- 배경: 20261223000000_r8_session_annotation_events.sql의
-- prevent_annotation_event_mutation()이 "app.bypass_annotation_lock" 커스텀 GUC로
-- append-only 불변식을 우회하는 분기를 두고 있었다. 그 마이그레이션의 주석은
-- "앱 코드/RLS로는 절대 켤 수 없는 GUC — 정리/마이그레이션 작업에서 superuser가
-- 명시적으로 사용"이라고 가정했지만, 이는 90d7012(session_prepared_selections
-- pin-lock)와 6f292cc(session_content_use_events)에서 이미 증명된 것과 동일한
-- 잘못된 가정이다 — PostgreSQL의 커스텀 GUC(GUC_SUPERUSER_ONLY로 등록되지 않은,
-- 플레인 SQL로 선언된 GUC)는 GRANT/REVOKE 대상이 아니며, 어떤 롤이든 자신의
-- 세션에서 `SET app.bypass_annotation_lock = 'true'`를 실행할 수 있다.
--
-- 정정된 위험 모델(제품 오너 확인): 현재 authenticated 역할에게는
-- session_annotation_events에 대한 UPDATE/DELETE RLS 정책도 GRANT도 없으므로,
-- 일반 authenticated 세션이 이 GUC만으로 직접 행을 변경/삭제할 수는 없다(RLS가
-- 먼저 0건으로 걸러낸다). 그러나 SECURITY DEFINER 함수, service_role로 실행되는
-- 코드, 마이그레이션/운영 스크립트 등 RLS를 우회하는 모든 "privileged" 실행
-- 경로에서는 커스텀 GUC 자체가 아무 접근 제어도 없으므로, 그런 경로가(의도적으로든
-- 향후 버그로든) 이 GUC를 설정하기만 하면 append-only 보장이 조용히 무력화된다.
-- 즉 "어떤 코드도 이 GUC를 켤 권한이 없다"는 원래 가정 자체가 커스텀 GUC의 특성과
-- 맞지 않으므로, role 도달 가능성과 무관하게 설정 가능한 탈출구 자체를 없앤다.
--
-- 수정: 트리거 함수에서 bypass 분기를 통째로 제거한다. 이제 append-only에는 어떤
-- 설정 가능한 탈출구도 없다 — 진짜 superuser가 `ALTER TABLE ... DISABLE TRIGGER`로
-- 트리거 자체를 끄는 것은 Postgres 권한 모델 고유의(따라서 애플리케이션 코드가
-- 흉내낼 수 없는) 별개 카테고리이며 이번 수정의 범위 밖이다(90d7012의 테스트
-- 스위트가 FK 기반 가드를 증명할 때 다룬 것과 동일한 구분).
--
-- 테스트 영향: app/session/[id]/session-annotation-events.integration.test.ts의
-- afterAll이 이 GUC로 session_annotation_events 행을 지우던 것을 더 이상 할 수
-- 없다(그리고 그 행이 sessions(id)를 FK로 참조하므로, sessions/reservations/
-- contracts 삭제도 함께 불가능해진다) — 이 커밋에서 그 정리 자체를 제거하고
-- CLAUDE.md의 UAT 정리 관례대로 `supabase db reset --local`에 맡긴다. 새 회귀
-- 테스트가 두 각도(ordinary authenticated 역할, privileged/superuser 역할) 모두에서
-- "GUC를 설정해도 더 이상 아무 효과가 없다"는 것 자체를 직접 검증한다.

create or replace function public.prevent_annotation_event_mutation()
returns trigger
language plpgsql as $$
begin
  raise exception 'session_annotation_events는 append-only입니다 — 수정/삭제할 수 없습니다.';
end;
$$;

comment on function public.prevent_annotation_event_mutation() is
  'R8 corrective: append-only 잠금에는 설정 가능한 bypass가 없다(app.bypass_annotation_lock
  GUC 분기 완전 제거 — 커스텀 GUC는 어떤 역할/실행 경로든 SET으로 켤 수 있어
  SECURITY DEFINER/service_role 등 RLS를 우회하는 privileged 경로에서 append-only
  보장을 무력화할 수 있었던 취약점).';

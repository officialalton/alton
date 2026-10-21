-- AI 에세이 비용 원장 명시적 접근 권한 (2026-10-21, 추가형·재실행 안전 — 적용안, 승인 전 미적용)
--  · 2026-10-30 이후 public 새 테이블/뷰는 Supabase 가 anon/authenticated/service_role 권한을 자동 부여하지 않는다.
--    20262100000650 은 RLS·함수 EXECUTE 만 명시하므로, 자동 부여가 꺼진 환경(db reset·신규 프로젝트·프리뷰 브랜치)에서는
--    service_role 이 원장 테이블을 읽고 쓰지 못해 예약·정산이 모두 실패한다. 여기서 필요한 권한만 명시한다.
--  · 방침: anon 은 아무 권한 없음. authenticated 는 원장 테이블 읽기만(RLS 로 관리자만 행 접근), 뷰는 없음. 쓰기는 service_role 만.
--  · 이미 자동 부여가 있는 환경에서는 새 객체(원장·집계 뷰)의 불필요한 권한(anon 전부, authenticated 쓰기)을 회수한다. 기존 테이블 mock_exam_essay_scores 의 기존 권한은 줄이지 않는다(grant 만 추가).
-- 되돌리기: 이 파일이 만든 grant 는 revoke 로 되돌린다(객체는 건드리지 않음).

-- 원장 테이블: 쓰기 정책이 없으므로 authenticated 의 INSERT/UPDATE/DELETE 는 RLS 로도 막히지만 권한 자체도 주지 않는다.
-- service_role 의 자동 부여(delete·truncate 포함)도 회수한 뒤 필요한 것만 다시 준다(원장은 추가·정산만, 삭제 없음).
revoke all on table public.essay_ai_cost_events from anon, authenticated, service_role;
grant select on table public.essay_ai_cost_events to authenticated;                       -- RLS essay_ai_cost_events_admin_read(is_admin)
grant select, insert, update on table public.essay_ai_cost_events to service_role;         -- 예약(insert)·정산(update)·legacy 고정(insert). delete 없음(원장은 추가만)

-- 집계 뷰(security_invoker): 앱 코드는 뷰를 직접 읽지 않는다(월 지출은 서버 RPC, 일별 집계는 관리자 SQL). 호출자 RLS 로 본인 행 비용이 학생에게 보이지 않도록 service_role 에게만 SELECT 를 준다.
-- (essay_ai_cost_daily 는 600 에서 자동 부여로 authenticated 읽기가 있었으나 이 뷰를 읽는 앱·구형 Production 코드는 없다 — 회수해도 영향 없음.)
revoke all on table public.essay_ai_cost_effective from anon, authenticated, service_role;
revoke all on table public.essay_ai_cost_daily from anon, authenticated, service_role;
grant select on table public.essay_ai_cost_effective to service_role;
grant select on table public.essay_ai_cost_daily to service_role;

-- 관리자 확인용 unsettled 뷰: 원장 이벤트만 읽으므로 호출자 RLS(관리자만 행 접근)가 그대로 적용된다 — 학생·익명은 0행/거부.
revoke all on table public.essay_ai_unsettled from anon, authenticated, service_role;
grant select on table public.essay_ai_unsettled to authenticated, service_role;

-- 응답 행 테이블(마이그레이션 600)은 자동 부여가 꺼진 환경에서 재생성될 때 권한이 없다 → 서버 쓰기·본인/보호자/관리자 읽기에 필요한 최소를 보장(추가 grant 만).
grant select on table public.mock_exam_essay_scores to authenticated;                      -- RLS essay_scores_read
grant select, insert, update on table public.mock_exam_essay_scores to service_role;

-- 함수: 650 에서 이미 revoke(public/anon/authenticated) + grant(service_role). 자동 부여 환경에서 anon/authenticated 가 직접 부여돼 있어도 회수(멱등).
revoke all on function public.essay_ai_month_spend(timestamptz) from public, anon, authenticated;
revoke all on function public.reserve_essay_ai_budget(uuid, uuid, numeric, numeric, timestamptz) from public, anon, authenticated;
grant execute on function public.essay_ai_month_spend(timestamptz) to service_role;
grant execute on function public.reserve_essay_ai_budget(uuid, uuid, numeric, numeric, timestamptz) to service_role;
revoke all on function public.start_essay_ai_call(uuid) from public, anon, authenticated;
revoke all on function public.essay_ai_ledger_status(timestamptz) from public, anon, authenticated;
grant execute on function public.start_essay_ai_call(uuid) to service_role;
grant execute on function public.essay_ai_ledger_status(timestamptz) to service_role;

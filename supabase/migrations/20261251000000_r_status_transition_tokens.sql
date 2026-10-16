-- 배치 1 — 공유 1회용 상태 전이 토큰 테이블
--
-- 배경(docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md, 2차/3차
-- 개정): 이 저장소에는 "append-only/immutability 트리거를 SECURITY DEFINER
-- 내부 함수가 자기 자신만 통과시키기 위해 트랜잭션 로컬 커스텀 GUC(app.bypass_*)를
-- 켜고 끈다"는 반복 패턴이 있었다. 커스텀 GUC는 GRANT/REVOKE 대상이 아니므로
-- "앱 코드 중 어떤 role도 이 이름을 SET할 권한을 받은 적이 없다"는 것이 "아무도
-- SET할 수 없다"를 의미하지 않는다 — SECURITY DEFINER 함수, service_role 직접
-- 연결, 운영 스크립트 등 RLS를 우회하는 모든 경로가 장벽 없이 SET할 수 있다.
--
-- 이 마이그레이션은 그 대체재로 "권한으로 보호되는 1회용 DB 토큰"을 도입한다
-- (제품 오너 지시: 토큰에는 최소한 대상 행, 허용 작업, 트랜잭션 식별자를 묶을 것).
-- 배치 1의 bypass_consent_protect(20261252000000)/bypass_teacher_rate_protect
-- (20261253000000)가 최초로 사용하며, 배치 2(status/invite/reconciliation)가
-- 그대로 재사용할 예정인 공유 인프라다.
--
-- 잠금 방식은 session_content_manifest(20261233000000_r9_session_content_manifest.sql)와
-- 동일한 패턴을 그대로 따른다: 테이블 자체의 쓰기 권한을 어떤 ordinary role에도
-- GRANT하지 않고(RLS 활성화 + 쓰기 정책 0개), SECURITY DEFINER 함수만 테이블
-- 소유자 권한으로 함수 본문 안에서 INSERT/DELETE할 수 있게 한다 — 그 권한은
-- 함수 밖으로 새어나가지 않는다.
--
-- 제품 오너의 명시적 지시(2차 개정 문서): 토큰 발급/소비는 오직 각 SECURITY
-- DEFINER 함수 본문 안에서 인라인으로만 일어나야 하며, authenticated 등 어떤
-- ordinary role에도 grantable한 범용 "토큰 발급" 함수를 만들지 않는다. 아래
-- consume_status_transition_token()은 "토큰 존재 확인 + 삭제" 로직의 중복만
-- 줄이기 위한 private 헬퍼일 뿐 — 트리거 함수 본문 안에서만 호출되고, 어떤
-- role에도 EXECUTE가 부여되지 않는다.

create table status_transition_tokens (
  table_name text not null,
  row_id uuid not null,
  action text not null,
  xact_id bigint not null default txid_current(),
  created_at timestamptz not null default now()
);
create index on status_transition_tokens (table_name, row_id, action, xact_id);

comment on table status_transition_tokens is
  '배치 1/2 bypass GUC corrective 공유 인프라: 1회용 상태 전이 토큰. 어떤
  ordinary role에게도 INSERT/UPDATE/DELETE 그랜트가 없다 — 유일한 쓰기 경로는
  이 토큰을 발급/소비하는 각 SECURITY DEFINER 함수(revoke_guardian_consent(),
  set_teacher_rate() 등)의 함수 본문 안뿐이다. session_content_manifest
  (20261233000000)와 동일한 잠금 패턴.';

alter table status_transition_tokens enable row level security;
-- 조회/쓰기 정책을 의도적으로 하나도 두지 않는다 — RLS 기본 거부 + 아래 REVOKE로
-- 이중 방어. SECURITY DEFINER 함수는 테이블 소유자 권한으로 RLS 자체를 우회하므로
-- 이 정책 부재의 영향을 받지 않는다.

revoke insert, update, delete, truncate, select on status_transition_tokens
  from public, anon, authenticated, service_role;
-- select도 회수한다 — 이 테이블은 감사 로그가 아니라 순수 내부 상태이고,
-- ordinary role이 남아 있는 토큰의 존재 여부를 조회할 필요가 없다.

-- ---------------------------------------------------------------------------
-- private 헬퍼: "이 테이블명+행 id+action에 대해 현재 트랜잭션(xact_id)이 심은
-- 토큰이 있는가"를 확인하고, 있으면 그 자리에서 delete(1회용 소비)한 뒤 true를
-- 반환한다. 없으면 false. 어떤 role에도 EXECUTE를 부여하지 않는다 — 각 트리거
-- 함수(protect_guardian_consent(), protect_teacher_rate_history() 등, 전부
-- SECURITY DEFINER 소유자 권한으로 실행됨) 본문 안에서만 호출된다.
-- ---------------------------------------------------------------------------
create or replace function public.consume_status_transition_token(
  p_table_name text,
  p_row_id uuid,
  p_action text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_found boolean := false;
begin
  delete from status_transition_tokens
  where table_name = p_table_name
    and row_id = p_row_id
    and action = p_action
    and xact_id = txid_current()
  returning true into v_found;

  return coalesce(v_found, false);
end;
$$;
revoke execute on function public.consume_status_transition_token(text, uuid, text)
  from public, anon, authenticated, service_role;
-- 트리거/함수 내부 전용 — 어떤 role에도 EXECUTE 없음. 발급(INSERT)은 각 정상
-- 경로 함수(revoke_guardian_consent(), set_teacher_rate() 등)가 직접
-- `insert into status_transition_tokens (...)`로 인라인 수행한다(공용 발급
-- 함수를 별도로 만들지 않는다 — 제품 오너 지시).

comment on function public.consume_status_transition_token(text, uuid, text) is
  '토큰 확인+1회용 소비 private 헬퍼. 트리거 함수 본문 안에서만 호출된다 —
  어떤 client role에도 EXECUTE가 없다. 토큰 발급은 이 함수가 아니라 각
  SECURITY DEFINER 함수(revoke_guardian_consent(), set_teacher_rate() 등)의
  본문 안 인라인 INSERT로만 이루어진다.';

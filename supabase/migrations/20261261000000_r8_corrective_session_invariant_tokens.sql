-- 배치 2-4 corrective (마지막 항목) — bypass_session_lock GUC를 전용 1회용
-- 토큰 테이블로 교체 (docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md
-- "배치 2 상세 실행 계획 > 배치 2-4" 참고).
--
-- 이 항목은 status_transition_tokens 공유 인프라를 쓰지 않는다 — 하나의 GUC
-- (app.bypass_session_lock)가 sessions 테이블의 서로 다른 두 불변식(final_status,
-- material_version_id)을 동시에 보호하고 있어서, 한 불변식을 풀기 위해 GUC를
-- 켜면 같은 트랜잭션 안에서 다른 불변식도 의도치 않게 함께 풀리는 구조적
-- 결함이 있었다(예: reopen_session()이 final_status를 되돌리려고 GUC를 켜는
-- 동안, 같은 트랜잭션에서 material_version_id를 바꾸는 UPDATE가 끼어들면
-- 그것도 통과해버림 — 실제 코드에는 그런 UPDATE가 없어 피해 사례는 없었지만
-- GUC 재사용 자체가 잠재적 결함이었다). 전용 테이블에 invariant 컬럼을 두어
-- "이 토큰은 정확히 이 불변식 하나만 푼다"를 못박는다.
--
-- 실제 정상 호출자 재확인 결과(계획 문서 "배치 2-4, 3번" 절): 이 GUC의 유일한
-- 정상 호출자는 reopen_session() 하나뿐이다. recomplete_session()은 이 GUC를
-- 전혀 쓰지 않으므로(별도 corrective인 20261259000000/20261260000000이 이미
-- 다른 GUC(bypass_reconciliation_task_lock)를 대체했고, final_status UPDATE는
-- v_prev='live'가 항상 보장되어 트리거를 자연스럽게 통과한다) 이 마이그레이션의
-- 대상이 아니며 손대지 않는다. 또한 reopen_session()은 final_status만 되돌리고
-- material_version_id는 전혀 건드리지 않으므로 'final_status' 토큰만 발급하고
-- 'material_version_id' 토큰은 절대 발급하지 않는다 — 바로 이 구분이 위에서
-- 설명한 GUC 공유 결함을 구조적으로 없앤다.
--
-- 배치 1/2 corrective와 동일한 두 규칙을 처음부터 적용한다: (a) 신규 테이블
-- 참조는 반드시 public.session_invariant_unlock_tokens로 완전히 스키마
-- 한정한다(unqualified 참조는 세션 로컬 temp table로 가로채기 당할 수 있다).
-- (b) 토큰을 다루는 함수 전부 search_path를 'public, pg_temp'로 명시 고정한다.

-- ---------------------------------------------------------------------------
-- 신규 테이블: status_transition_tokens(20261251000000)와 동일한 잠금 패턴
-- (RLS 활성화 + 정책 0개, 모든 ordinary role에서 전 권한 revoke).
-- ---------------------------------------------------------------------------
create table session_invariant_unlock_tokens (
  session_id uuid not null,
  invariant text not null check (invariant in ('final_status', 'material_version_id')),
  xact_id bigint not null default txid_current(),
  created_at timestamptz not null default now()
);
create index on session_invariant_unlock_tokens (session_id, invariant, xact_id);

comment on table session_invariant_unlock_tokens is
  'bypass_session_lock GUC corrective 전용 1회용 토큰. sessions 테이블의
  final_status/material_version_id 두 불변식을 분리해서 보호한다 — 공유 GUC가
  가졌던 "한쪽을 풀면 다른쪽도 같이 풀리는" 구조적 결함을 없애기 위해
  status_transition_tokens와 별도 테이블로 둔다. 어떤 ordinary role에게도
  INSERT/UPDATE/DELETE/SELECT 그랜트가 없다 — 유일한 쓰기 경로는
  reopen_session()의 함수 본문 안 인라인 INSERT뿐이다.';

alter table session_invariant_unlock_tokens enable row level security;
-- 조회/쓰기 정책을 의도적으로 하나도 두지 않는다 — RLS 기본 거부 + 아래
-- REVOKE로 이중 방어. SECURITY DEFINER 함수는 테이블 소유자 권한으로 RLS 자체를
-- 우회하므로 이 정책 부재의 영향을 받지 않는다.

revoke insert, update, delete, truncate, select on session_invariant_unlock_tokens
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- private 헬퍼: "이 session_id+invariant에 대해 현재 트랜잭션(xact_id)이 심은
-- 토큰이 있는가"를 확인하고, 있으면 그 자리에서 delete(1회용 소비)한 뒤 true를
-- 반환한다. 없으면 false. 어떤 role에도 EXECUTE를 부여하지 않는다 — 트리거
-- 함수(prevent_direct_final_status_update(), prevent_material_version_reassignment(),
-- 둘 다 SECURITY DEFINER 소유자 권한으로 실행) 본문 안에서만 호출된다.
-- ---------------------------------------------------------------------------
create or replace function public.consume_session_invariant_unlock_token(
  p_session_id uuid,
  p_invariant text
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_found boolean := false;
begin
  delete from public.session_invariant_unlock_tokens
  where session_id = p_session_id
    and invariant = p_invariant
    and xact_id = txid_current()
  returning true into v_found;

  return coalesce(v_found, false);
end;
$$;
revoke execute on function public.consume_session_invariant_unlock_token(uuid, text)
  from public, anon, authenticated, service_role;

comment on function public.consume_session_invariant_unlock_token(uuid, text) is
  '토큰 확인+1회용 소비 private 헬퍼. 트리거 함수 본문 안에서만 호출된다 —
  어떤 client role에도 EXECUTE가 없다. 토큰 발급은 이 함수가 아니라
  reopen_session()의 본문 안 인라인 INSERT로만 이루어진다(현재 이 GUC의
  정상 호출자는 reopen_session() 하나뿐).';

-- ---------------------------------------------------------------------------
-- prevent_direct_final_status_update(): GUC 분기를 완전히 제거하고,
-- 'final_status' 불변식용 미소비 토큰이 있는지만 확인한다.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_direct_final_status_update()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.final_status not in ('scheduled', 'live')
     and new.final_status is distinct from old.final_status
     and not public.consume_session_invariant_unlock_token(old.id, 'final_status') then
    raise exception 'completed 세션은 reopen_session()/recomplete_session()로만 상태를 바꿀 수 있습니다.';
  end if;
  return new;
end;
$$;
revoke execute on function public.prevent_direct_final_status_update() from public, anon, authenticated, service_role;

comment on function public.prevent_direct_final_status_update() is
  '완료 후 직접 UPDATE 차단(Gate B §3.5). (corrective) GUC(app.bypass_session_lock)
  분기를 제거하고 session_invariant_unlock_tokens 1회용 토큰(invariant=
  ''final_status'') 확인/소비로 대체했다 — consume_session_invariant_unlock_token()이
  public.session_invariant_unlock_tokens로 완전히 스키마 한정되어 있고
  search_path가 public, pg_temp로 고정되어 있으므로 temp table 가로채기가
  통하지 않는다.';

-- ---------------------------------------------------------------------------
-- prevent_material_version_reassignment(): GUC 분기를 완전히 제거하고,
-- 'material_version_id' 불변식용 미소비 토큰이 있는지만 확인한다. 현재 이
-- 토큰을 정상 발급하는 호출자는 없다(R9 범위 배정 메커니즘 미구현) — 이
-- 트리거는 사실상 항상 거부로 귀결되지만, R9가 정상 재배정 함수를 추가할 때
-- 트리거를 다시 건드리지 않고 그 함수 본문에서 토큰만 발급하면 되도록 분기
-- 구조를 미리 갖춰 둔다. 토큰 확인은 함수 상단에서 최대 1회만 수행한다 —
-- 두 if 조건이 각자 consume을 호출하면 첫 if가 토큰을 먼저 소비해버려 두
-- 번째 if가 오탐 거부되는 이중 소비 위험이 있기 때문이다.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_material_version_reassignment()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_changing boolean;
  v_unlocked boolean := false;
begin
  v_changing := new.material_version_id is distinct from old.material_version_id;

  if not v_changing then
    return new;
  end if;

  if (old.material_version_id is not null or old.final_status not in ('scheduled', 'live')) then
    v_unlocked := public.consume_session_invariant_unlock_token(old.id, 'material_version_id');
  end if;

  if old.material_version_id is not null and not v_unlocked then
    raise exception 'material_version_id는 세션 시작/완료 후 재배정할 수 없습니다.';
  end if;

  if old.final_status not in ('scheduled', 'live') and not v_unlocked then
    raise exception 'completed 세션의 material_version_id는 변경할 수 없습니다.';
  end if;

  return new;
end;
$$;
revoke execute on function public.prevent_material_version_reassignment() from public, anon, authenticated, service_role;

comment on function public.prevent_material_version_reassignment() is
  'material_version_id 재배정 차단. (corrective) GUC(app.bypass_session_lock)
  분기를 제거하고 session_invariant_unlock_tokens 1회용 토큰(invariant=
  ''material_version_id'') 확인/소비로 대체했다 — 토큰 소비는 함수당 최대 1회만
  일어나도록 상단에서 한 번만 확인한다(두 조건문이 각자 소비를 시도해 이중
  소비/오탐 거부가 나는 것을 방지). 현재 이 토큰을 발급하는 정상 호출자는
  없다(R9 배정 메커니즘 미구현) — 순수 방어용으로 항상 거부로 귀결되지만, R9
  대비 토큰 확인 분기를 미리 갖춰 둔다.';

-- ---------------------------------------------------------------------------
-- reopen_session(): GUC set_config() 호출을 제거하고, final_status UPDATE
-- 직전에 'final_status' 토큰만 인라인 INSERT한다. 그 외 로직(관리자 게이트,
-- 대상 세션 상태 확인, session_status_events 기록)은 최신
-- 20260928000000_r6_sessions_cutover.sql:97-119와 완전히 동일하다.
-- material_version_id 토큰은 절대 발급하지 않는다 — 이 함수가
-- material_version_id를 전혀 건드리지 않기 때문이며, 바로 이 구분이 GUC 공유
-- 시절의 부작용(final_status를 풀려고 켠 GUC가 material_version_id도 같이
-- 풀어버리는 것)을 구조적으로 막는다.
-- ---------------------------------------------------------------------------
create or replace function public.reopen_session(p_session_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_prev v3_session_final_status;
begin
  if not public.is_admin() then
    raise exception '관리자만 세션을 재개방할 수 있습니다.';
  end if;

  select final_status into v_prev from sessions where id = p_session_id for update;
  if v_prev is null then
    raise exception '세션을 찾을 수 없습니다.';
  end if;
  if v_prev in ('scheduled', 'live') then
    raise exception '아직 확정되지 않은 세션은 재개방할 필요가 없습니다.';
  end if;

  insert into session_status_events (session_id, event_type, previous_final_status, new_final_status, actor_profile_id, reason)
  values (p_session_id, 'reopened', v_prev, 'live', auth.uid(), p_reason);

  insert into public.session_invariant_unlock_tokens (session_id, invariant) values (p_session_id, 'final_status');
  update sessions set final_status = 'live' where id = p_session_id;
end;
$$;

comment on function public.reopen_session(uuid, text) is
  '완료된 세션을 관리자가 재개방(completed → live)하는 유일한 정상 경로.
  (corrective) final_status UPDATE 직전 session_invariant_unlock_tokens에
  1회용 토큰을 인라인 INSERT한다(invariant = ''final_status'') —
  GUC(app.bypass_session_lock) set_config() 호출 제거. 이 함수는
  material_version_id를 전혀 건드리지 않으므로 ''material_version_id'' 토큰은
  절대 발급하지 않는다 — 공유 GUC가 두 불변식을 동시에 풀어버리던 구조적
  결함의 회귀를 막는 핵심 지점. session_invariant_unlock_tokens 참조를
  public.session_invariant_unlock_tokens로 완전히 스키마 한정하고 search_path를
  public, pg_temp로 고정했다 — temp table 가로채기 방지.
  recomplete_session()은 이 GUC를 전혀 쓰지 않으므로(별도 corrective가 이미
  다른 GUC를 대체) 이 마이그레이션의 대상이 아니며 수정하지 않는다.';

-- 배치 1 corrective — status_transition_tokens 참조 스키마 한정 + search_path 고정
--
-- 배경(product owner 리뷰, 2026-09-08): consume_status_transition_token(),
-- revoke_guardian_consent(), set_teacher_rate() 세 함수 모두 status_transition_tokens을
-- 스키마 한정 없이(unqualified) 참조하고, search_path도 'public'만 설정하고 있었다.
-- PostgreSQL은 identifier resolution 시 search_path에 무엇이 설정되어 있든 세션의
-- pg_temp 스키마를 항상 먼저 검색한다 — 단, 참조가 스키마 한정(public.xxx)되어
-- 있으면 이 규칙이 적용되지 않고 곧바로 해당 스키마로 간다.
--
-- 즉 이전 상태에서는, 호출자가 자기 세션에서
--   create temp table status_transition_tokens (...);
-- 을 만들고 위조 토큰 행을 심은 뒤 직접 UPDATE(예: guardian_consents 철회
-- 3필드, teacher_rate_history.effective_until)를 시도하면, SECURITY DEFINER
-- 함수 본문의 unqualified 참조가 세션 로컬 temp 테이블로 resolve되어 실제
-- public.status_transition_tokens에 걸린 GRANT/REVOKE 잠금을 완전히 무력화할
-- 수 있었다 — 호출자는 자신의 temp 테이블에 대해서는 언제나 완전한 제어권을
-- 가지기 때문이다.
--
-- 수정: (1) 세 함수 모두에서 테이블 참조를 public.status_transition_tokens로
-- 완전히 스키마 한정한다 — 스키마 한정된 참조는 search_path/pg_temp 우선순위
-- 규칙의 영향을 받지 않으므로 이것만으로 취약점이 닫힌다. (2) 방어 심층화로
-- 세 함수의 search_path를 'public, pg_temp'로 명시적으로 고정한다(제품 오너
-- 지시) — pg_temp를 명시적으로 나열해도 스키마 한정 참조에는 영향이 없다.
--
-- 배치 2(bypass_status_protect/bypass_invite_protect/bypass_reconciliation_task_lock,
-- docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md)가 이
-- 공유 토큰 인프라를 재사용할 때도 동일한 규칙(모든 참조 완전 스키마 한정 +
-- search_path 고정)을 처음부터 따라야 한다 — 해당 문서에 별도로 명시해 둔다.

create or replace function public.consume_status_transition_token(
  p_table_name text,
  p_row_id uuid,
  p_action text
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_found boolean := false;
begin
  delete from public.status_transition_tokens
  where table_name = p_table_name
    and row_id = p_row_id
    and action = p_action
    and xact_id = txid_current()
  returning true into v_found;

  return coalesce(v_found, false);
end;
$$;

comment on function public.consume_status_transition_token(text, uuid, text) is
  '토큰 확인+1회용 소비 private 헬퍼. 트리거 함수 본문 안에서만 호출된다 —
  어떤 client role에도 EXECUTE가 없다. 토큰 발급은 이 함수가 아니라 각
  SECURITY DEFINER 함수(revoke_guardian_consent(), set_teacher_rate() 등)의
  본문 안 인라인 INSERT로만 이루어진다.
  (corrective) status_transition_tokens 참조를 public.status_transition_tokens로
  완전히 스키마 한정하고 search_path를 public, pg_temp로 고정했다 — 호출자가
  자기 세션에 동명의 temp table을 만들어 이 함수의 참조를 가로채는 것을 막는다.';

create or replace function public.revoke_guardian_consent(p_consent_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_consent guardian_consents%rowtype;
  v_is_active_guardian boolean;
begin
  select * into v_consent from guardian_consents where id = p_consent_id;
  if not found then
    raise exception '존재하지 않는 동의 기록입니다.';
  end if;
  if v_consent.revoked_at is not null then
    return; -- 이미 철회됨 — 멱등
  end if;

  v_is_active_guardian := exists (
    select 1 from household_members hm
    join household_members child
      on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = v_consent.student_id
    where hm.role = 'guardian' and hm.profile_id = auth.uid()
  );
  if not (is_admin() or (auth.uid() = v_consent.consented_by and v_is_active_guardian)) then
    raise exception '본인(동의를 기록한 보호자) 또는 관리자만 철회할 수 있습니다.';
  end if;

  insert into public.status_transition_tokens (table_name, row_id, action)
  values ('guardian_consents', p_consent_id, 'revoke_consent');

  update guardian_consents
  set revoked_at = now(), revoked_by = auth.uid(), revocation_reason = p_reason
  where id = p_consent_id;

  insert into privacy_review_tasks (student_id, reason, created_by)
  values (
    v_consent.student_id,
    coalesce('guardian consent revoked: ' || p_reason, 'guardian consent revoked'),
    auth.uid()
  );
end;
$$;
revoke execute on function public.revoke_guardian_consent(uuid, text) from public;
grant execute on function public.revoke_guardian_consent(uuid, text) to authenticated;

comment on function public.revoke_guardian_consent(uuid, text) is
  '철회 UPDATE 직전 status_transition_tokens에 1회용 토큰을 인라인
  INSERT한다(공용 발급 함수 없음) — GUC set_config() 호출 제거.
  (corrective) status_transition_tokens 참조를 public.status_transition_tokens로
  완전히 스키마 한정하고 search_path를 public, pg_temp로 고정했다 — temp table
  가로채기 방지.';

create or replace function public.set_teacher_rate(
  p_teacher_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_effective_from timestamptz default clock_timestamp()
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_current record;
  v_new_id uuid;
begin
  if p_amount_minor <= 0 then
    raise exception 'p_amount_minor는 0보다 커야 합니다(받은 값: %).', p_amount_minor;
  end if;
  if p_currency is null or length(trim(p_currency)) = 0 then
    raise exception 'p_currency는 비어 있을 수 없습니다.';
  end if;

  perform 1 from teacher_rate_history where teacher_id = p_teacher_id for update;

  select * into v_current from teacher_rate_history
    where teacher_id = p_teacher_id and effective_until is null;

  if v_current.id is not null then
    if p_effective_from <= v_current.effective_from then
      raise exception '새 effective_from(%)은 기존 현재 이력의 effective_from(%)보다 이후여야 합니다.', p_effective_from, v_current.effective_from;
    end if;

    insert into public.status_transition_tokens (table_name, row_id, action)
    values ('teacher_rate_history', v_current.id, 'close_teacher_rate');

    update teacher_rate_history
      set effective_until = p_effective_from
      where id = v_current.id;
  end if;

  insert into teacher_rate_history (teacher_id, amount_minor, currency, effective_from)
  values (p_teacher_id, p_amount_minor, p_currency, p_effective_from)
  returning id into v_new_id;

  update teachers set hourly_rate_krw = p_amount_minor where id = p_teacher_id;

  return v_new_id;
end;
$$;
revoke execute on function public.set_teacher_rate(uuid, bigint, text, timestamptz) from public, anon, authenticated;
grant execute on function public.set_teacher_rate(uuid, bigint, text, timestamptz) to service_role;

comment on function public.set_teacher_rate(uuid, bigint, text, timestamptz) is
  '선생님 시급 변경의 유일한 정상 경로. 기존 현재 이력을 잠그고 종료한 뒤 새
  이력을 원자적으로 생성하고 teachers.hourly_rate_krw도 함께 동기화한다.
  (corrective) status_transition_tokens 참조를 public.status_transition_tokens로
  완전히 스키마 한정하고 search_path를 public, pg_temp로 고정했다 — temp table
  가로채기 방지. GUC set_config() 호출 제거.';

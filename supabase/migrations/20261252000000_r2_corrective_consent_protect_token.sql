-- 배치 1-1 — bypass_consent_protect GUC 제거, 1회용 DB 토큰으로 교체
--
-- 배경(docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md §2,
-- 2차 개정): guardian_consents의 진짜 불변식은 "철회 3필드 UPDATE"가 아니라
-- "철회 3필드 UPDATE + privacy_review_tasks 행 생성이 항상 같이, 오직
-- revoke_guardian_consent()를 통해서만 일어난다"이다. 예전 GUC
-- (app.bypass_consent_protect)는 철회 UPDATE 한 문장만 감쌌을 뿐 "이 UPDATE가
-- 실제로 함수를 통해 왔는가"를 증명하지 못했고, 1차 개정에서 검토했던 필드
-- 조합 검사(방식 a) 역시 철회 3필드만 노린 직접 UPDATE를 걸러내지 못해
-- privacy_review_tasks 생성을 건너뛸 수 있었다(제품 오너가 방식 a를 반려한
-- 근거) — 이 마이그레이션은 20261251000000이 구축한 status_transition_tokens
-- 공유 테이블을 이용한 1회용 토큰으로 교체한다.

-- ---------------------------------------------------------------------------
-- protect_guardian_consent(): 동의 당시 8개 필드는 토큰 유무와 무관하게 항상
-- 불변(그대로 유지). 철회 3필드만 바뀌는 경우에만 토큰을 확인 — 없으면 거부,
-- 있으면 그 자리에서 소비(delete)하고 통과.
-- ---------------------------------------------------------------------------
create or replace function public.protect_guardian_consent()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'guardian_consents 행은 삭제할 수 없습니다.';
  end if;

  if new.id is distinct from old.id
     or new.student_id is distinct from old.student_id
     or new.policy_version_id is distinct from old.policy_version_id
     or new.consented_by is distinct from old.consented_by
     or new.consented_at is distinct from old.consented_at
     or new.verification_method is distinct from old.verification_method
     or new.verification_reference is distinct from old.verification_reference
     or new.notice_delivered_at is distinct from old.notice_delivered_at then
    raise exception 'guardian_consents의 동의 당시 기록(정책 버전·검증 방법·시각)은 수정할 수 없습니다.';
  end if;

  -- 철회 3필드(revoked_at/revoked_by/revocation_reason)만 바뀌는 UPDATE.
  -- revoke_guardian_consent()가 심어 둔 1회용 토큰이 없으면 거부한다 — 이
  -- 함수를 거치지 않은 직접 UPDATE는 필드 집합이 우연히 일치하더라도 더 이상
  -- 통과할 수 없다(privacy_review_tasks 생성을 건너뛸 수 없게 됨).
  if not public.consume_status_transition_token('guardian_consents', old.id, 'revoke_consent') then
    raise exception 'guardian_consents는 revoke_guardian_consent()를 통해서만 수정할 수 있습니다.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- revoke_guardian_consent(): 인가 검사 통과 후, 철회 UPDATE 직전에 토큰을 심는다.
-- 토큰 INSERT와 철회 UPDATE와 privacy_review_tasks INSERT가 모두 같은
-- 트랜잭션 안에 있으므로, 중간에 실패하면 토큰도 함께 롤백된다(좀비 토큰 없음).
-- ---------------------------------------------------------------------------
create or replace function public.revoke_guardian_consent(p_consent_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
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

  insert into status_transition_tokens (table_name, row_id, action)
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

comment on function public.protect_guardian_consent() is
  '(corrective) app.bypass_consent_protect GUC 분기를 제거하고
  status_transition_tokens 1회용 토큰으로 교체 — 철회 3필드만 바뀌는 UPDATE도
  revoke_guardian_consent()가 심은 토큰 없이는 통과할 수 없다.';
comment on function public.revoke_guardian_consent(uuid, text) is
  '(corrective) 철회 UPDATE 직전 status_transition_tokens에 1회용 토큰을
  인라인 INSERT한다(공용 발급 함수 없음) — GUC set_config() 호출 제거.';

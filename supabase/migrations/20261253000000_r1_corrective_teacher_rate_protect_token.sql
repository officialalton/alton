-- 배치 1-2 — bypass_teacher_rate_protect GUC 제거, 1회용 DB 토큰으로 교체
--
-- 배경(docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md §5,
-- 2차 개정): teacher_rate_history의 진짜 불변식은 "effective_until UPDATE
-- 단독 허용"이 아니라 "기존 이력 종료 + 새 이력 INSERT + teachers.hourly_rate_krw
-- 동기화, 이 3단계가 항상 한 트랜잭션에서 함께 일어난다"이다. 필드 조합 검사
-- (방식 a)는 effective_until만 노린 직접 UPDATE를 걸러내지 못해 "현재 유효한
-- 시급이 없는 이력 공백"을 만들 수 있었다(제품 오너가 방식 a를 반려한 근거) —
-- 이 마이그레이션은 20261251000000이 구축한 status_transition_tokens
-- 공유 테이블을 배치 1-1과 동일하게 재사용한다.

-- ---------------------------------------------------------------------------
-- protect_teacher_rate_history(): effective_until 외 필드는 토큰 유무와
-- 무관하게 항상 불변(그대로 유지). effective_until만 바뀌는 경우에만 토큰을
-- 확인 — 없으면 거부, 있으면 소비하고 통과.
-- ---------------------------------------------------------------------------
create or replace function public.protect_teacher_rate_history()
returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'teacher_rate_history 행은 삭제할 수 없습니다.';
  end if;

  if new.id is distinct from old.id
     or new.teacher_id is distinct from old.teacher_id
     or new.amount_minor is distinct from old.amount_minor
     or new.currency is distinct from old.currency
     or new.effective_from is distinct from old.effective_from then
    raise exception 'teacher_rate_history 기존 행의 금액·통화·teacher_id·effective_from은 수정할 수 없습니다. 시급 변경은 set_teacher_rate()로 새 이력을 생성하세요(effective_until 종료 처리만 허용됩니다).';
  end if;

  -- effective_until만 바뀌는 UPDATE. set_teacher_rate()가 심어 둔 1회용
  -- 토큰이 없으면 거부한다 — 함수를 거치지 않은 직접 UPDATE는 "기존 이력만
  -- 종료되고 새 이력·동기화는 없는" 공백 상태를 더 이상 만들 수 없다.
  if not public.consume_status_transition_token('teacher_rate_history', old.id, 'close_teacher_rate') then
    raise exception 'teacher_rate_history는 직접 UPDATE할 수 없습니다(effective_until 포함). 시급 변경은 set_teacher_rate()를 사용하세요 — 기존 이력 종료와 새 이력 생성이 같은 트랜잭션에서 원자적으로 함께 일어납니다.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_teacher_rate(): 잠금·유효성 검사 통과 후, 기존 이력 종료 UPDATE 직전에
-- 토큰을 심는다. 종료 UPDATE·새 이력 INSERT·teachers.hourly_rate_krw 동기화
-- 전부 같은 트랜잭션 — 어느 단계든 실패하면 토큰도 함께 롤백된다.
-- ---------------------------------------------------------------------------
create or replace function public.set_teacher_rate(
  p_teacher_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_effective_from timestamptz default clock_timestamp()
)
returns uuid
language plpgsql security definer set search_path = public as $$
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

    insert into status_transition_tokens (table_name, row_id, action)
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

comment on function public.protect_teacher_rate_history() is
  '(corrective) app.bypass_teacher_rate_protect GUC 분기를 제거하고
  status_transition_tokens 1회용 토큰으로 교체 — effective_until만 바뀌는
  UPDATE도 set_teacher_rate()가 심은 토큰 없이는 통과할 수 없다.';
comment on function public.set_teacher_rate(uuid, bigint, text, timestamptz) is
  '선생님 시급 변경의 유일한 정상 경로. 기존 현재 이력을 잠그고 종료한 뒤 새
  이력을 원자적으로 생성하고 teachers.hourly_rate_krw도 함께 동기화한다.
  (corrective) 종료 UPDATE 직전 status_transition_tokens에 1회용 토큰을
  인라인 INSERT한다 — GUC set_config() 호출 제거.';

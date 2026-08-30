-- R1 — v3 스키마 12/12(보정): 선생님 시급 무결성의 우회 가능 지점 2건 수정
-- (사용자 요청, 2026-08-30: 20260830100000 적용 후 검토에서 발견한 우회 지점)
--
-- 1. enforce_and_snapshot_teacher_rate()가 NULL일 때만 스냅샷을 채워서, 호출자가
--    임의 금액·통화를 미리 채워 INSERT하면 그대로 저장될 수 있었다.
-- 2. protect_teacher_rate_history()가 effective_until만 바뀌는 UPDATE는 호출 주체와
--    무관하게 전부 허용해서, set_teacher_rate()를 거치지 않고 관리자가 직접
--    "현재 이력만 종료하고 새 이력은 만들지 않는" 공백을 만들 수 있었다.

-- ---------------------------------------------------------------------------
-- 1번 수정: 호출자가 무엇을 넣었든 항상 현재 유효 시급으로 덮어쓴다.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_and_snapshot_teacher_rate()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rate record;
begin
  select amount_minor, currency into v_rate
    from teacher_rate_history
    where teacher_id = new.teacher_id and effective_until is null;

  if v_rate.amount_minor is null then
    raise exception '선생님(%)의 유효한 현재 시급 이력이 없어 세션을 생성할 수 없습니다.', new.teacher_id;
  end if;

  -- (2026-08-30 정정) NULL일 때만 채우던 것을 항상 덮어쓰도록 변경 — 호출자가
  -- 1원이나 다른 통화를 미리 채워 넣어도 실제 현재 시급으로 강제 교체된다.
  new.hourly_rate_snapshot_minor := v_rate.amount_minor;
  new.hourly_rate_snapshot_currency := v_rate.currency;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2번 수정: effective_until 종료도 기본적으로 차단하고, set_teacher_rate() 내부에서만
-- 트랜잭션 로컬 플래그로 허용한다(reopen_session()의 app.bypass_session_lock과 동일 패턴).
-- ---------------------------------------------------------------------------
create or replace function public.protect_teacher_rate_history()
returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'teacher_rate_history 행은 삭제할 수 없습니다.';
  end if;

  if coalesce(current_setting('app.bypass_teacher_rate_protect', true), 'false') = 'true' then
    -- set_teacher_rate() 내부의 종료 UPDATE만 여기로 들어온다. 이 경로에서도
    -- effective_until 외의 컬럼 변경은 여전히 차단한다(방어 유지).
    if new.id is distinct from old.id
       or new.teacher_id is distinct from old.teacher_id
       or new.amount_minor is distinct from old.amount_minor
       or new.currency is distinct from old.currency
       or new.effective_from is distinct from old.effective_from then
      raise exception 'teacher_rate_history 기존 행의 금액·통화·teacher_id·effective_from은 수정할 수 없습니다.';
    end if;
    return new;
  end if;

  -- (2026-08-30 정정) effective_until만 바뀌는 UPDATE도 예외 없이 차단한다.
  -- set_teacher_rate()를 거치지 않고 "현재 이력만 종료"하면 그 선생님은 새 이력
  -- 없이 이력 공백 상태가 되고, 그 상태에서 세션/배정을 시도하면 차단되긴 하지만
  -- 이미 active인 선생님이 이력 없는 상태로 방치되는 것 자체가 §1 규칙 위반이다.
  raise exception 'teacher_rate_history는 직접 UPDATE할 수 없습니다(effective_until 포함). 시급 변경은 set_teacher_rate()를 사용하세요 — 기존 이력 종료와 새 이력 생성이 같은 트랜잭션에서 원자적으로 함께 일어납니다.';
end;
$$;

-- ---------------------------------------------------------------------------
-- set_teacher_rate(): 내부 종료 UPDATE 직전에만 우회 플래그를 켜고, 그 UPDATE
-- 직후 바로 끈다 — 우회 구간을 그 한 문장으로만 최소화한다.
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

  -- 이 선생님의 기존 이력 전체를 잠가 동시 변경 요청을 직렬화한다.
  perform 1 from teacher_rate_history where teacher_id = p_teacher_id for update;

  select * into v_current from teacher_rate_history
    where teacher_id = p_teacher_id and effective_until is null;

  if v_current.id is not null then
    if p_effective_from <= v_current.effective_from then
      raise exception '새 effective_from(%)은 기존 현재 이력의 effective_from(%)보다 이후여야 합니다.', p_effective_from, v_current.effective_from;
    end if;

    perform set_config('app.bypass_teacher_rate_protect', 'true', true);
    update teacher_rate_history
      set effective_until = p_effective_from
      where id = v_current.id;
    perform set_config('app.bypass_teacher_rate_protect', 'false', true);
  end if;

  insert into teacher_rate_history (teacher_id, amount_minor, currency, effective_from)
  values (p_teacher_id, p_amount_minor, p_currency, p_effective_from)
  returning id into v_new_id;

  return v_new_id;
end;
$$;
revoke execute on function public.set_teacher_rate(uuid, bigint, text, timestamptz) from public, anon, authenticated;
grant execute on function public.set_teacher_rate(uuid, bigint, text, timestamptz) to service_role;
-- CREATE OR REPLACE는 기존 revoke/grant 상태를 바꾸지 않지만, 명시적으로 다시
-- 선언해 이 파일만 봐도 최종 권한 상태를 알 수 있게 한다.

comment on function public.enforce_and_snapshot_teacher_rate() is
  '(2026-08-30 정정) 호출자가 넣은 값과 무관하게 항상 현재 유효 시급으로 덮어쓴다 — NULL 체크로는 임의 값 주입을 막지 못했다.';
comment on function public.protect_teacher_rate_history() is
  '(2026-08-30 정정) effective_until 단독 변경도 기본적으로 차단한다 — set_teacher_rate() 내부에서만 app.bypass_teacher_rate_protect 트랜잭션 로컬 플래그로 예외적으로 허용된다.';

-- R2 — Task 1: set_teacher_rate()가 teachers.hourly_rate_krw도 함께 동기화
--
-- 배경: app/admin/payouts-data.ts(실제 정산 금액 계산)와 app/admin/users-data.ts가
-- 둘 다 teachers.hourly_rate_krw를 직접 읽는다. R1 이후 시급 변경의 정상 경로는
-- set_teacher_rate()(teacher_rate_history에 새 이력 생성)뿐인데, 이 함수가
-- teachers.hourly_rate_krw를 갱신하지 않으면 정산 계산이 실제 현재 시급과
-- 어긋난 stale 값을 계속 쓰게 된다. teacher_rate_history를 유일한 진실
-- 소스로 만들고 저 두 읽기 경로를 다시 쓰는 것은 R4/R10(정산 원장) 범위의
-- 더 큰 변경이라, 이번에는 set_teacher_rate()가 teacher_rate_history insert와
-- 같은 트랜잭션에서 teachers.hourly_rate_krw도 같이 갱신하는 쪽을 택한다.
--
-- 한계(기존에도 있던 한계, 이번에 새로 만들지 않음): teachers.hourly_rate_krw는
-- 컬럼명 그대로 KRW 전용이다. 통화가 KRW가 아닌 시급으로 설정되면 이 컬럼에는
-- 그 통화의 금액이 그대로 들어간다 — payouts-data.ts 자체가 애초에 다중 통화를
-- 지원하지 않으므로(product-architecture-v3.md §4.16 "선생님별 시급 이력에서
-- 다른 통화를 설정할 수 있다"는 이미 정책으로 있지만 정산 계산 코드는 아직
-- KRW 단일 통화만 가정) 이 한계는 R4/R10에서 정산 로직을 다중 통화로 확장할 때
-- 함께 다룬다.
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

    perform set_config('app.bypass_teacher_rate_protect', 'true', true);
    update teacher_rate_history
      set effective_until = p_effective_from
      where id = v_current.id;
    perform set_config('app.bypass_teacher_rate_protect', 'false', true);
  end if;

  insert into teacher_rate_history (teacher_id, amount_minor, currency, effective_from)
  values (p_teacher_id, p_amount_minor, p_currency, p_effective_from)
  returning id into v_new_id;

  -- (2026-08-30 R2 추가) 레거시 읽기 경로(payouts-data.ts, users-data.ts) 호환용
  -- 동기화. teacher_rate_history가 진실 소스이고 이 컬럼은 캐시일 뿐이다.
  update teachers set hourly_rate_krw = p_amount_minor where id = p_teacher_id;

  return v_new_id;
end;
$$;

comment on function public.set_teacher_rate(uuid, bigint, text, timestamptz) is
  '선생님 시급 변경의 유일한 정상 경로. 기존 현재 이력을 잠그고 종료한 뒤 새 이력을 원자적으로 생성하고, 레거시 읽기 경로 호환을 위해 teachers.hourly_rate_krw도 함께 동기화한다(진실 소스는 여전히 teacher_rate_history) — 직접 UPDATE로 금액을 덮어쓰는 것은 teacher_rate_history_protect 트리거가 차단한다.';

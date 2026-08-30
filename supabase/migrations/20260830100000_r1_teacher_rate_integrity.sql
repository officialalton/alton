-- R1 — v3 스키마 11/12(추가): 선생님 시급 이력 무결성 강제
-- (사용자 요청, 2026-08-30: 김도경 선생님 시급 미설정이 그대로 active 전환·배정·세션
-- 생성까지 진행될 수 있었던 누락을 계기로, 관리자 화면 입력 검증에만 의존하지 않고
-- DB 함수/트리거로 우회 불가능하게 강제한다.)
--
-- 규칙(요청 원문 그대로):
--   1. 선생님을 active로 변경하려면 금액 > 0인 유효한 현재 시급 이력이 반드시 존재해야 함
--   2. 체험·정규수업의 선생님 배정(teacher_assignments)과 세션 생성(sessions_v3) 시에도
--      유효한 현재 시급 이력이 없으면 차단
--   3. 통화도 반드시 설정되어 있어야 함
--   4. 시급 변경 시 기존 이력을 덮어쓰지 않고 effective_until을 종료한 뒤 새 이력 생성
--   5. 세션 생성 시 해당 시점의 시급 금액·통화를 세션 스냅샷으로 저장
--   6. 체험 수업 지급 단가는 해당 선생님의 당시 시급과 동일
--   7. 시급 미설정 상태는 pending에서만 허용 — teacher_status enum이 {pending, active}
--      두 값뿐이므로("active가 아니면 pending"), 이는 곧 "active 전환 시점에 유효한
--      현재 이력이 있어야 한다"는 1번 규칙과 동일하다. 별도 규칙 추가가 필요 없다.

-- ---------------------------------------------------------------------------
-- 유효성 판정 헬퍼: 현재(effective_until IS NULL) 이력이 존재하면 유효하다.
-- teacher_rate_history.amount_minor는 CHECK(> 0), currency는 NOT NULL이므로
-- 행이 존재한다는 것 자체가 이미 "금액 > 0, 통화 설정됨"을 보장한다(3번 규칙은
-- 테이블 제약으로 이미 강제되어 있어 별도 재검사가 불필요).
-- ---------------------------------------------------------------------------
create or replace function public.has_valid_current_teacher_rate(p_teacher_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teacher_rate_history
    where teacher_id = p_teacher_id and effective_until is null
  );
$$;
revoke execute on function public.has_valid_current_teacher_rate(uuid) from public, anon, authenticated;
grant execute on function public.has_valid_current_teacher_rate(uuid) to service_role;
-- 트리거들과 관리자 서버 액션(사전 확인용)에서만 쓴다 — 일반 authenticated에는 열지 않음.

-- ---------------------------------------------------------------------------
-- teacher_rate_history 보호: 기존 행의 금액·통화·teacher_id·effective_from은
-- 절대 수정할 수 없다(4번 규칙). effective_until을 채우는 "종료" 처리만 허용한다.
-- DELETE도 금지(이력 손실 방지).
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
  return new;
end;
$$;
create trigger teacher_rate_history_protect
  before update or delete on teacher_rate_history
  for each row execute function public.protect_teacher_rate_history();
revoke execute on function public.protect_teacher_rate_history() from public, anon, authenticated, service_role;
-- 트리거 전용(직접 호출 불가) — Gate B §7 점검 원칙에 따라 명시적으로 revoke.

-- ---------------------------------------------------------------------------
-- 시급 변경의 유일한 정상 경로: 기존 현재 이력을 락 → 종료 → 새 이력 생성을
-- 하나의 트랜잭션으로 원자적으로 수행한다. 동시에 같은 선생님의 시급을 두 번
-- 바꾸려는 요청은 이 함수 안의 행 잠금으로 직렬화된다(entitlement 동시성 수정과
-- 동일한 패턴 — 잠금 후 재검사).
--
-- (2026-08-30, 동시성 테스트에서 발견) 기본값을 now()가 아니라 clock_timestamp()로
-- 둔다. now()는 "트랜잭션 시작 시각"에 고정되므로, 이 함수를 호출하기 전에 같은
-- 트랜잭션 안에서 오래 대기하는 코드가 있으면 effective_from이 실제 호출 시점보다
-- 훨씬 과거로 기록될 수 있다(실측: pg_sleep(3)으로 감싼 테스트에서 재현). 이 함수는
-- 보통 단일 RPC 호출(사실상 autocommit)로 쓰이므로 실무에는 영향이 적지만,
-- clock_timestamp()를 쓰면 호출을 감싸는 트랜잭션 길이와 무관하게 항상 실제
-- 호출 시각을 기록해 더 안전하다.
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
    update teacher_rate_history
      set effective_until = p_effective_from
      where id = v_current.id;
  end if;

  insert into teacher_rate_history (teacher_id, amount_minor, currency, effective_from)
  values (p_teacher_id, p_amount_minor, p_currency, p_effective_from)
  returning id into v_new_id;

  return v_new_id;
end;
$$;
revoke execute on function public.set_teacher_rate(uuid, bigint, text, timestamptz) from public, anon, authenticated;
grant execute on function public.set_teacher_rate(uuid, bigint, text, timestamptz) to service_role;
-- 서버 액션(service_role)에서만 호출 — Gate B "서버 액션(서비스 role)에서만 호출" 패턴.
-- 최초 1행 생성(v3 전환일 시드, 20260830090000)은 종료할 기존 행이 없는 최초
-- 사례라 이 함수를 거치지 않고 직접 INSERT했다 — 재실행 시 그대로 두는 것이
-- 목적(멱등)이라 "종료 후 새로 생성"을 강제하는 이 함수의 의미와 다르다.

-- ---------------------------------------------------------------------------
-- teachers: active 전환 시 유효한 현재 시급 이력 필수(1번 규칙).
-- teacher_status enum은 {pending, active} 두 값뿐이라 "active가 아니면 pending"이
-- 자동 성립 — pending에는 이 검사가 적용되지 않는다(7번 규칙과 동일 의미).
-- ---------------------------------------------------------------------------
create or replace function public.enforce_teacher_active_requires_rate()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and not has_valid_current_teacher_rate(new.id) then
    raise exception '선생님(%)을 active로 전환하려면 유효한 현재 시급 이력(teacher_rate_history)이 먼저 필요합니다. set_teacher_rate()로 먼저 생성하세요.', new.id;
  end if;
  return new;
end;
$$;
create trigger teachers_enforce_active_requires_rate
  before insert or update of status on teachers
  for each row execute function public.enforce_teacher_active_requires_rate();
revoke execute on function public.enforce_teacher_active_requires_rate() from public, anon, authenticated, service_role;
-- 트리거 전용 — teachers 테이블은 본인/관리자 모두 UPDATE 가능한 RLS 정책이라
-- (본인이 자기 status를 직접 바꿀 길이 있어도) 이 트리거는 호출 주체와 무관하게
-- 항상 적용된다 — "관리자 화면 입력 검증에만 의존하지 않는다"는 요청 그대로.

-- ---------------------------------------------------------------------------
-- teacher_assignments: planned/active로 배정할 때 유효한 현재 시급 이력 필수(2번 규칙).
-- 체험/정규 구분 없이 동일하게 적용(6번 규칙 — 배정 단계에는 수업 유형이 없다).
-- ---------------------------------------------------------------------------
create or replace function public.enforce_teacher_assignment_requires_rate()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('planned', 'active') and not has_valid_current_teacher_rate(new.teacher_id) then
    raise exception '선생님(%)에게 유효한 현재 시급 이력이 없어 배정할 수 없습니다.', new.teacher_id;
  end if;
  return new;
end;
$$;
create trigger teacher_assignments_enforce_rate
  before insert or update of status, teacher_id on teacher_assignments
  for each row execute function public.enforce_teacher_assignment_requires_rate();
revoke execute on function public.enforce_teacher_assignment_requires_rate() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- sessions_v3: 생성 시 유효한 현재 시급 이력 필수(2번 규칙) + 그 시점 금액·통화를
-- 세션 스냅샷 컬럼(hourly_rate_snapshot_minor/currency)에 자동 기록(5번 규칙).
-- lesson_type_id로 분기하지 않으므로 체험 수업도 정규 수업과 동일한 현재 시급을
-- 그대로 스냅샷한다(6번 규칙 — 별도 체험 단가 테이블이 없다).
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

  if new.hourly_rate_snapshot_minor is null then
    new.hourly_rate_snapshot_minor := v_rate.amount_minor;
  end if;
  if new.hourly_rate_snapshot_currency is null then
    new.hourly_rate_snapshot_currency := v_rate.currency;
  end if;

  return new;
end;
$$;
create trigger sessions_v3_enforce_and_snapshot_teacher_rate
  before insert on sessions_v3
  for each row execute function public.enforce_and_snapshot_teacher_rate();
revoke execute on function public.enforce_and_snapshot_teacher_rate() from public, anon, authenticated, service_role;
-- INSERT 시점 스냅샷만 강제한다 — 세션 생성 후 teacher_id를 바꾸는 것은 "세션은
-- 생성 시점 스냅샷"이라는 설계 원칙과 맞지 않으므로(Gate B §3.2), 애초에 세션
-- 재배정이 아니라 새 예약·새 세션을 만드는 흐름과 일치한다(§Gate A "재예약은
-- 상태가 아니다"와 동일선상). UPDATE에는 이 트리거를 걸지 않는다.

comment on function public.set_teacher_rate(uuid, bigint, text, timestamptz) is
  '선생님 시급 변경의 유일한 정상 경로. 기존 현재 이력을 잠그고 종료한 뒤 새 이력을 원자적으로 생성한다 — 직접 UPDATE로 금액을 덮어쓰는 것은 teacher_rate_history_protect 트리거가 차단한다.';
comment on function public.has_valid_current_teacher_rate(uuid) is
  '선생님 active 전환·배정·세션 생성 시 공통으로 쓰는 유효성 판정. effective_until이 NULL인 현재 이력 존재 여부만 확인 — 존재 자체가 금액>0·통화 설정을 이미 보장한다.';

-- Mock Exam MST Phase 3 (1/3) — 라우팅 정책 테이블 · 경로 기록 컬럼 · 변조 방지 트리거.
-- 계획: docs/2026-09-28-sat-adaptive-mock-exam-redesign-plan.md §3·§6 Phase 3. 전부 additive.
--
-- 정책 값은 제품 결정이라 코드가 아니라 데이터다: 섹션별 활성 정책 1개(부분 unique). 값을 바꾸려면 새 version 행을
-- 넣고(mock_exam_set_routing_policy) 이전 행은 비활성화한다. 응시 시작 시 그 시점의 활성 version을 응시에 고정(pin)해
-- 이미 시작한 응시는 정책이 바뀌어도 시작 때 정책으로 경로가 정해지고, 경로는 한 번 정해지면 불변이다.
-- 정책 테이블은 학생·보호자·교사 어느 JWT로도 직접 읽을 수 없다(권한 회수) — definer 함수와 service_role(관리자 화면)만.
-- 되돌리기: drop trigger/function/table 및 attempts 컬럼 2개 drop(경로 컬럼 자체는 Phase 1 소유).

create table mock_exam_routing_policies (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('rw', 'math')),
  -- correct_ratio: (M1 정답 수 / M1 문항 수) >= threshold_value -> higher. correct_count: M1 정답 수 >= threshold_value -> higher.
  threshold_type text not null check (threshold_type in ('correct_ratio', 'correct_count')),
  threshold_value numeric not null check (threshold_value >= 0),
  version int not null check (version >= 1),
  active boolean not null default true,
  note text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (section, version),
  check (threshold_type <> 'correct_ratio' or threshold_value <= 1)
);
create unique index mock_exam_routing_policies_one_active on mock_exam_routing_policies (section) where active;

alter table mock_exam_routing_policies enable row level security;  -- 정책 없음 + 권한 회수: service_role/definer 전용
revoke all on mock_exam_routing_policies from anon, authenticated;
grant all on mock_exam_routing_policies to service_role;

-- 정책 행은 값이 바뀌면 안 된다(적용 이력 보존). active/note만 갱신 가능.
create or replace function public._mock_exam_routing_policy_immutable() returns trigger
language plpgsql as $$
begin
  if new.section is distinct from old.section or new.threshold_type is distinct from old.threshold_type
     or new.threshold_value is distinct from old.threshold_value or new.version is distinct from old.version then
    raise exception '라우팅 정책 값은 수정할 수 없습니다. 새 버전을 만드세요.';
  end if;
  return new;
end $$;
create trigger mock_exam_routing_policy_immutable before update on mock_exam_routing_policies
  for each row execute function _mock_exam_routing_policy_immutable();

-- 새 버전 발행: 이전 활성 정책을 내리고 version+1을 활성으로 넣는다(한 트랜잭션). execute 는 service_role 전용(아래 grant).
create or replace function public.mock_exam_set_routing_policy(
  p_section text, p_threshold_type text, p_threshold_value numeric, p_note text default null, p_created_by uuid default null
) returns int
language plpgsql security definer set search_path = public as $$
declare v_version int;
begin
  select coalesce(max(version), 0) + 1 into v_version from mock_exam_routing_policies where section = p_section;
  update mock_exam_routing_policies set active = false where section = p_section and active;
  insert into mock_exam_routing_policies (section, threshold_type, threshold_value, version, active, note, created_by)
  values (p_section, p_threshold_type, p_threshold_value, v_version, true, p_note, p_created_by);
  return v_version;
end $$;
revoke execute on function public.mock_exam_set_routing_policy(text, text, numeric, text, uuid) from public, anon, authenticated;
grant execute on function public.mock_exam_set_routing_policy(text, text, numeric, text, uuid) to service_role;

-- 기본 정책(제품 오너가 조정 가능): 두 섹션 모두 Module 1 정답률 65% 이상이면 higher, 미만이면 lower.
--  - 보수적 근거: Digital SAT은 실제 라우팅 임계값을 공개하지 않는다. 일반 추정(대략 60~70% 안팎에서 상위 모듈)의 중간값에서
--    약간 높은 쪽을 택해 "확실히 잘한 학생만 higher"로 보낸다 — higher는 어려운 문항(medium·hard)이라 잘못 올리면 점수가
--    눌리고 좌절 위험이 크다. R&W 27문항 -> 18개 이상, Math 22문항 -> 15개 이상 정답이면 higher.
--  - 캘리브레이션 데이터가 쌓이면(Phase 5) 새 version으로 조정한다.
insert into mock_exam_routing_policies (section, threshold_type, threshold_value, version, active, note)
values
  ('rw', 'correct_ratio', 0.65, 1, true, '초기 기본값(2026-09-29): M1 정답률 65% 이상 -> higher. 제품 오너 조정 대상.'),
  ('math', 'correct_ratio', 0.65, 1, true, '초기 기본값(2026-09-29): M1 정답률 65% 이상 -> higher. 제품 오너 조정 대상.')
on conflict (section, version) do nothing;

-- 응시에 경로 결정에 쓴 정책 버전 기록(응시 시작 때 고정 -> 결정 때 그 버전으로 판정).
alter table mock_exam_attempts
  add column rw_m2_route_policy_version int,
  add column math_m2_route_policy_version int;

-- 경로·정책 버전 변조 방지: (1) 학생·교사 등 API 역할(anon/authenticated)은 이 컬럼을 쓸 수 없다(insert 포함 —
-- 교사 배정 RLS가 insert/update를 열어 두므로). (2) 경로가 정해진 뒤에는 누구도(service_role 포함) 경로·버전을 바꿀 수 없다.
-- 트리거 함수는 invoker라 definer RPC 안에서는 current_user 가 함수 소유자(postgres)로 보인다.
create or replace function public._mock_exam_attempts_route_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if (new.rw_m2_route is not null or new.math_m2_route is not null
        or new.rw_m2_route_policy_version is not null or new.math_m2_route_policy_version is not null)
       and current_user in ('anon', 'authenticated') then
      raise exception '경로 정보는 직접 지정할 수 없습니다.';
    end if;
    return new;
  end if;
  if (new.rw_m2_route is distinct from old.rw_m2_route or new.math_m2_route is distinct from old.math_m2_route
      or new.rw_m2_route_policy_version is distinct from old.rw_m2_route_policy_version
      or new.math_m2_route_policy_version is distinct from old.math_m2_route_policy_version) then
    if current_user in ('anon', 'authenticated') then
      raise exception '경로 정보는 직접 수정할 수 없습니다.';
    end if;
    if (old.rw_m2_route is not null and (new.rw_m2_route is distinct from old.rw_m2_route
          or new.rw_m2_route_policy_version is distinct from old.rw_m2_route_policy_version))
       or (old.math_m2_route is not null and (new.math_m2_route is distinct from old.math_m2_route
          or new.math_m2_route_policy_version is distinct from old.math_m2_route_policy_version)) then
      raise exception '이미 정해진 Module 2 경로는 바꿀 수 없습니다.';
    end if;
  end if;
  return new;
end $$;
create trigger mock_exam_attempts_route_guard before insert or update on mock_exam_attempts
  for each row execute function _mock_exam_attempts_route_guard();

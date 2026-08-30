-- R1 — v3 스키마 2/12: households / household_members / contracts_v3 / contract_versions
--
-- child_id/guardian_id는 별도 신규 identity 테이블을 만들지 않고 기존 profiles(id)를
-- 그대로 참조한다(= 기존 students.id/parents.id와 동일한 값). Gate B §5.3 예시의
-- "se.child_id = auth.uid()" 패턴과 기존 is_guardian_of()/is_admin() 헬퍼가 그대로
-- 재사용 가능하도록 하기 위함.

create table households (
  id uuid primary key default gen_random_uuid(),
  primary_guardian_id uuid references profiles (id),
  billing_currency text not null default 'USD',
  created_at timestamptz not null default now()
);

create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  role v3_household_member_role not null,
  relation guardian_relation, -- role='guardian'일 때만 사용(기존 enum 재사용)
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (household_id, profile_id)
);
create index on household_members (profile_id);
create index on household_members (household_id, role);

-- 자녀 1명은 정확히 1개 household에만 소속(가족 분리 지원 안 함, v1 범위)
create unique index household_members_one_household_per_child
  on household_members (profile_id) where (role = 'child');

-- (2026-08-30 추가) 기존 `is_guardian_of()`는 구 guardian_students 테이블만 확인한다.
-- household_members로 새로 맺어진 보호자 관계는 그 함수가 인식하지 못하므로, R1
-- RLS 정책에서는 이 함수와 is_guardian_of()를 OR로 함께 검사한다(§RLS 정책 파일 참고).
create or replace function public.is_household_guardian_of(p_child_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_members child_row
    join household_members guardian_row
      on guardian_row.household_id = child_row.household_id
      and guardian_row.role = 'guardian'
    where child_row.profile_id = p_child_id
      and child_row.role = 'child'
      and guardian_row.profile_id = auth.uid()
  );
$$;
revoke execute on function public.is_household_guardian_of(uuid) from public;
grant execute on function public.is_household_guardian_of(uuid) to anon, authenticated;
-- (2026-08-30 정정) anon도 포함해서 grant한다 — 이 함수는 항상 auth.uid()로만
-- 필터링되므로(인자로 받은 p_child_id와 무관하게 anon은 auth.uid()가 null이라
-- 항상 false), 직접 호출해도 정보 유출이 없다. 기존 is_guardian_of()와 동일한
-- 안전 패턴. anon을 제외하면 이 함수를 참조하는 테이블에서 anon 조회가 빈 결과
-- 대신 "permission denied for function" 오류로 실패한다 — 실제 anon 역할
-- 테스트에서 재현됨(§실행 로그 참고). has_capability(p_profile_id, ...)처럼
-- 인자로 받은 임의의 profile_id를 그대로 조회하는 함수는 이 패턴에 해당하지
-- 않으므로 anon에 열어주지 않는다(별도 판단 유지).

comment on table households is 'R1: 구 parents+guardian_students+students 관계를 대체하는 가족 단위. Gate B §2 매핑표 참고.';
comment on table household_members is '구 guardian_students를 대체. 학생(child)과 보호자(guardian) 모두 이 테이블로 household에 연결.';

-- 계약(재정의). 기존 앱·서버 액션·Calendly/DocuSign 웹훅이 현재 `contracts` 테이블
-- 구조에 그대로 의존하므로(2026-08-30 기획자 확인), 이번 R1에서는 기존 `contracts`를
-- 건드리지 않고 shadow 이름 `contracts_v3`로만 새 스키마를 만든다. 실제 앱 전환은
-- 앱 코드·웹훅이 신규 스키마로 함께 바뀌는 별도 cutover 마이그레이션에서 진행하며,
-- 그때 기존 `contracts`→`legacy_contracts` rename과 `contracts_v3`→`contracts` rename을
-- 같은 배포에서 원자적으로 수행한다(§실행 로그의 "cutover 전략" 참고).
create table contracts_v3 (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id),
  child_id uuid not null references profiles (id),
  status v3_contract_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on contracts_v3 (household_id);
create index on contracts_v3 (child_id);

-- 불변: 한 child에 동시에 active 계약은 1개(Gate B §3.1)
create unique index contracts_one_active_per_child
  on contracts_v3 (child_id) where (status = 'active');

create table contract_versions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts_v3 (id) on delete cascade,
  version_number int not null,
  price_policy_snapshot jsonb not null,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (contract_id, version_number)
);

comment on table contracts_v3 is 'R1: v3 계약 shadow 테이블(Gate B §3.1). 기존 contracts는 그대로 유지되며, cutover 마이그레이션에서 최종 이름(contracts)으로 rename된다.';
comment on table contract_versions is 'Gate B §3.1: 가격·정책 스냅샷은 버전 테이블에 보존, contracts_v3 자체는 현재 상태만 가진다.';

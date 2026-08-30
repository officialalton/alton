-- R2 Task 3 — households/household_members 백필 + guardian_students 동결
--
-- 원본 구분(2026-08-30 확정):
--   * 가족 구성·보호자-자녀 관계 원본: households/household_members (이 마이그레이션으로 cutover)
--   * 보호자 역할별 계정 정보·계정 상태 원본: 당분간 parents 그대로 (R2 Task 2의
--     transition_account_status() 대상 — 이 마이그레이션은 parents를 건드리지 않는다)
--   * 레거시 관계 테이블: guardian_students — 앱 읽기/쓰기 모두 제거 후 이 마이그레이션에서
--     DB 트리거로 쓰기 자체를 차단(관리자 포함 예외 없음, 우회 플래그 없음 — 이 테이블에는
--     앞으로 정상적으로 써야 할 경로가 전혀 없기 때문에 protect_account_status()류 우회
--     패턴이 필요 없다).
--
-- 재실행 안전성: 아래 백필은 이미 반영된 관계를 건드리지 않고 새로 생기는 관계만
-- 추가하도록 작성했다 — 같은 마이그레이션을 두 번 적용해도 household/household_members
-- 행 수가 변하지 않는다.

-- =========================================================================
-- 1) is_guardian_of() fan-out 수정
--
-- is_guardian_of()는 R1 이전부터 있던 함수이고 is_session_related()/
-- is_enrollment_related()를 포함해 다수의 레거시 RLS 정책(teachers, chat,
-- curriculum_docs, curriculum_templates, session_memos, vocab_words 등)이 이
-- 함수를 경유한다. R1은 신규 테이블(contracts_v3, entitlement_* 등)에서만
-- is_guardian_of() OR is_household_guardian_of()로 수동 OR를 걸었을 뿐, 그
-- 이전부터 있던 레거시 정책들은 여전히 guardian_students만 본다. guardian_students를
-- 동결하면 이후 새로 만들어지는 가족 관계(household_members에만 존재)를 이 레거시
-- 정책들이 영원히 인식하지 못하는 회귀가 생긴다 — 개별 정책 수십 개를 일일이 고치는
-- 대신 공유 함수 자체를 고쳐 모든 호출부에 한 번에 전파한다.
create or replace function public.is_guardian_of(p_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.guardian_students gs
    where gs.student_id = p_student_id and gs.parent_id = auth.uid()
  ) or public.is_household_guardian_of(p_student_id);
$$;

-- profiles 테이블의 SELECT 정책("본인/관계자/관리자 조회")은 is_guardian_of()를
-- 거치지 않고 guardian_students를 직접 인라인으로 조회하며, 학생->보호자 역방향까지
-- 함께 처리한다(선생님이 자기 학생을, 학부모가 자녀를, 그 반대도 서로 이름을 볼 수
-- 있어야 세션뷰 상단바 등에 이름이 뜬다) — 이 정책도 is_guardian_of()와 같은
-- guardian_students 전용 사각지대가 있다. 양방향을 한 번에 처리하는 헬퍼를 새로
-- 만들어 이 정책에 추가한다.
create or replace function public.shares_household_as_guardian_or_child(p_other_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_members me
    join household_members other on other.household_id = me.household_id
    where me.profile_id = auth.uid() and other.profile_id = p_other_id
      and me.role <> other.role
  );
$$;
revoke execute on function public.shares_household_as_guardian_or_child(uuid) from public;
grant execute on function public.shares_household_as_guardian_or_child(uuid) to anon, authenticated;

drop policy if exists "본인/관계자/관리자 조회" on profiles;
create policy "본인/관계자/관리자 조회" on profiles for select
  using (
    id = auth.uid()
    or is_admin()
    or exists (
      select 1 from enrollments e
      where (e.student_id = profiles.id and e.teacher_id = auth.uid())
         or (e.teacher_id = profiles.id and e.student_id = auth.uid())
    )
    or exists (
      select 1 from guardian_students gs
      where (gs.student_id = profiles.id and gs.parent_id = auth.uid())
         or (gs.parent_id = profiles.id and gs.student_id = auth.uid())
    )
    or shares_household_as_guardian_or_child(profiles.id)
  );

-- =========================================================================
-- 2) 백필: guardian_students -> households/household_members
--
-- guardian_students는 parent_id-student_id 다대다 관계라 한 자녀가 여러 보호자를,
-- 한 보호자가 여러 자녀를 가질 수 있다. 서로 연결된 보호자·자녀는 같은 household로
-- 묶어야 하므로(child는 정확히 1개 household에만 소속 가능, R1 unique index)
-- connected-components를 계산한다. 데이터 규모가 작은 일회성 백필이라 레이블 전파를
-- 반복 실행하는 PL/pgSQL로 처리한다.
do $$
declare
  changed boolean;
  comp_id uuid;
  v_household_id uuid;
  v_primary_parent uuid;
  edge record;
  comp_p uuid;
  comp_s uuid;
  min_comp uuid;
begin
  if not exists (select 1 from guardian_students) then
    return;
  end if;

  create temporary table cc_nodes (
    node uuid primary key,
    comp uuid not null
  ) on commit drop;

  insert into cc_nodes (node, comp)
  select distinct n, n from (
    select parent_id as n from guardian_students
    union
    select student_id as n from guardian_students
  ) all_nodes;

  -- 레이블 전파: 간선(parent_id, student_id) 양 끝의 comp를 더 작은 값으로 맞추는
  -- 것을 더 이상 바뀌는 게 없을 때까지 반복 — 작은 그래프에서 항상 수렴한다.
  loop
    changed := false;
    for edge in select parent_id, student_id from guardian_students loop
      select comp into comp_p from cc_nodes where node = edge.parent_id;
      select comp into comp_s from cc_nodes where node = edge.student_id;
      if comp_p <> comp_s then
        min_comp := least(comp_p, comp_s);
        update cc_nodes set comp = min_comp where comp in (comp_p, comp_s);
        changed := true;
      end if;
    end loop;
    exit when not changed;
  end loop;

  -- 컴포넌트(가족 그룹)마다 household를 하나씩 배정.
  for comp_id in select distinct comp from cc_nodes loop
    -- 재실행 멱등성: 이 컴포넌트 구성원 중 이미 household_members에 있는 사람이
    -- 있으면 그 household를 재사용하고, 없을 때만 새로 만든다.
    select hm.household_id into v_household_id
    from household_members hm
    join cc_nodes c on c.node = hm.profile_id
    where c.comp = comp_id
    limit 1;

    if v_household_id is null then
      -- 주 보호자 선정: 이 컴포넌트에서 guardian_students.is_primary=true로 지정된
      -- 횟수가 가장 많은 보호자, 동률이면 가장 먼저 가입한 보호자. 아무도
      -- is_primary가 없으면 가장 먼저 가입한 보호자를 대신 지정한다(household는
      -- 항상 주 보호자가 정확히 1명이어야 하므로 — 완료 기준 4).
      select gs.parent_id into v_primary_parent
      from guardian_students gs
      join cc_nodes c on c.node = gs.parent_id
      where c.comp = comp_id and gs.is_primary
      group by gs.parent_id
      order by count(*) desc,
        (select p.joined_at from parents p where p.id = gs.parent_id) asc
      limit 1;

      if v_primary_parent is null then
        select gs.parent_id into v_primary_parent
        from (select distinct parent_id from guardian_students) gs
        join cc_nodes c on c.node = gs.parent_id
        where c.comp = comp_id
        order by (select p.joined_at from parents p where p.id = gs.parent_id) asc
        limit 1;
      end if;

      insert into households (primary_guardian_id, billing_currency)
      values (v_primary_parent, 'USD')
      returning id into v_household_id;
    end if;

    -- 자녀 연결(이미 어딘가의 child로 배정된 학생은 건드리지 않는다 — 수동으로
    -- 이미 옮겨졌을 수 있는 데이터를 덮어쓰지 않기 위함).
    insert into household_members (household_id, profile_id, role)
    select v_household_id, c.node, 'child'
    from cc_nodes c
    where c.comp = comp_id
      and c.node in (select student_id from guardian_students)
      and not exists (
        select 1 from household_members hm2
        where hm2.profile_id = c.node and hm2.role = 'child'
      )
    on conflict (household_id, profile_id) do nothing;

    -- 보호자 연결. is_primary는 위에서 정한 주 보호자 한 명에게만 true.
    insert into household_members (household_id, profile_id, role, relation, is_primary)
    select
      v_household_id,
      c.node,
      'guardian',
      coalesce(
        (select gs.relation_type from guardian_students gs where gs.parent_id = c.node limit 1),
        '기타'
      ),
      (c.node = v_primary_parent)
    from cc_nodes c
    where c.comp = comp_id
      and c.node in (select parent_id from guardian_students)
      and not exists (
        select 1 from household_members hm3
        where hm3.household_id = v_household_id and hm3.profile_id = c.node
      )
    on conflict (household_id, profile_id) do nothing;
  end loop;
end $$;

-- household당 주 보호자는 최대 1명만 존재할 수 있게 DB에서 강제(백필과 향후
-- 앱 코드 둘 다 "정확히 1명"을 보장해야 하며, 이 인덱스는 그중 "1명 초과 금지"를
-- 담당한다).
create unique index if not exists household_members_one_primary_guardian
  on household_members (household_id) where (role = 'guardian' and is_primary);

-- =========================================================================
-- 3) guardian_students 쓰기 차단
--
-- 기존 "관리자만 생성/삭제" RLS 정책은 service_role이 우회할 수 있어 실질적
-- 차단이 아니다. 이 테이블에는 앞으로 정상적으로 써야 할 경로가 전혀 없으므로
-- (protect_account_status()류와 달리) 우회 플래그 없이 무조건 차단한다.
drop policy if exists "관리자만 생성/삭제" on guardian_students;

create or replace function public.reject_guardian_students_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'guardian_students는 동결됐습니다. 가족 관계는 households/household_members를 사용하세요.';
end;
$$;

drop trigger if exists guardian_students_freeze on guardian_students;
create trigger guardian_students_freeze
  before insert or update or delete on guardian_students
  for each row execute function public.reject_guardian_students_mutation();

comment on table guardian_students is 'R2 Task 3(2026-08-30)부터 동결. 가족 관계 원본은 households/household_members. 이 테이블은 읽기 전용 이력으로만 보존하며 트리거가 모든 쓰기를 차단한다.';

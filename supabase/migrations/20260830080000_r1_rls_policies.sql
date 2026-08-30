-- R1 — v3 스키마 9/12: 신규 테이블 RLS 활성화 + 정책
-- 원칙(Gate B §5.1): RLS는 방어선, 서버 액션 진입부의 requireX() 가드가 1차 관문.
-- 아래 정책은 그 방어선 역할만 하며, 앱 서버 가드는 R2 이후 구현 시 별도로 추가한다.

alter table households enable row level security;
alter table household_members enable row level security;
alter table contracts_v3 enable row level security;
alter table contract_versions enable row level security;
alter table subject_enrollments enable row level security;
alter table teacher_assignments enable row level security;
alter table reservations enable row level security;
alter table sessions_v3 enable row level security;
alter table session_status_events enable row level security;
alter table lesson_types enable row level security;
alter table entitlement_types enable row level security;
alter table entitlement_products enable row level security;
alter table teacher_rate_history enable row level security;
alter table entitlement_grants enable row level security;
alter table entitlement_ledger enable row level security;
alter table makeup_obligations enable row level security;
alter table makeup_events enable row level security;
alter table payout_batches enable row level security;
alter table payout_items enable row level security;
alter table supervisor_capabilities enable row level security;

-- households / household_members
--
-- (2026-08-30 정정) household_members의 SELECT 정책이 같은 테이블(household_members)을
-- 다시 조회하면 RLS가 그 서브쿼리에도 동일 정책을 재적용하려 시도해 무한 재귀
-- ("infinite recursion detected in policy for relation") 오류가 날 수 있다. 안전한
-- 패턴은 SECURITY DEFINER 헬퍼 함수로 멤버십을 조회하는 것 — 이 함수는 테이블
-- owner(postgres) 권한으로 실행되고 이 테이블에 FORCE ROW LEVEL SECURITY를 걸지
-- 않았으므로 owner 조회는 RLS 재귀 없이 바로 끝난다.
create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_members
    where household_id = p_household_id and profile_id = auth.uid()
  );
$$;
revoke execute on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to anon, authenticated;
-- (2026-08-30 정정) 처음에는 authenticated에만 grant했으나, 그러면 anon 역할이
-- households/household_members를 조회할 때 정책 평가 과정에서 이 함수 호출이
-- 필요해 "permission denied for function"으로 하드 에러가 나고 빈 결과를
-- 돌려주지 못한다(실제 anon 역할 테스트에서 재현). 이 함수는 auth.uid()로만
-- 필터링돼(인자와 무관하게 anon은 항상 false) 직접 호출해도 정보 유출이 없으므로
-- 기존 is_admin()/is_guardian_of()와 같은 패턴으로 anon에도 연다.

create policy "households 조회" on households for select
  using (
    is_household_member(id)
    or is_admin()
  );
create policy "households 쓰기" on households for all
  using (is_admin() or current_user_has_capability('학생관리'))
  with check (is_admin() or current_user_has_capability('학생관리'));

create policy "household_members 조회" on household_members for select
  using (
    profile_id = auth.uid()
    or is_household_member(household_id)
    or is_admin()
  );
create policy "household_members 쓰기" on household_members for all
  using (is_admin() or current_user_has_capability('학생관리'))
  with check (is_admin() or current_user_has_capability('학생관리'));

-- contracts_v3 / contract_versions
--
-- (2026-08-30 정정) 아래 EXISTS 서브쿼리에서 household_id를 테이블명으로 한정하지
-- 않으면 Postgres가 그 안의 별칭 hm의 동명 컬럼(hm.household_id)으로 먼저 해석해
-- "hm.household_id = hm.household_id"(항상 참)가 되어 버린다 — 실제로 이 상태로
-- 로컬 테스트에서 재현됨(다른 household의 계약도 조회되는 심각한 보안 버그).
-- 반드시 outer 테이블명으로 명시 한정(contracts_v3.household_id)해야 한다.
create policy "contracts_v3 조회" on contracts_v3 for select
  using (
    child_id = auth.uid()
    or exists (select 1 from household_members hm where hm.household_id = contracts_v3.household_id and hm.profile_id = auth.uid())
    or is_admin()
  );
create policy "contracts_v3 쓰기" on contracts_v3 for all
  using (is_admin() or current_user_has_capability('계약권한'))
  with check (is_admin() or current_user_has_capability('계약권한'));

create policy "contract_versions 조회" on contract_versions for select
  using (
    exists (select 1 from contracts_v3 c where c.id = contract_id and (
      c.child_id = auth.uid()
      or exists (select 1 from household_members hm where hm.household_id = c.household_id and hm.profile_id = auth.uid())
    ))
    or is_admin()
  );
create policy "contract_versions 쓰기" on contract_versions for all
  using (is_admin() or current_user_has_capability('계약권한'))
  with check (is_admin() or current_user_has_capability('계약권한'));

-- subject_enrollments / teacher_assignments
--
-- (2026-08-30 정정) subject_enrollments 조회 정책이 teacher_assignments를 직접
-- EXISTS 서브쿼리로 참조하고, teacher_assignments 조회 정책도 거꾸로
-- subject_enrollments를 직접 참조하면 두 정책이 서로를 호출하는 순환 참조가
-- 생긴다. 실제 authenticated 역할로 조회를 실행하면
-- ("infinite recursion detected in policy for relation ...")로 즉시 재현되며,
-- 이 순환은 postgres superuser로 조회하면 RLS 자체가 적용되지 않아 절대
-- 드러나지 않는다 — 반드시 실제 JWT 기반 역할 테스트가 필요한 이유.
-- household_members와 동일한 해법: 다른 테이블을 직접 참조하지 않고 그
-- 테이블의 owner 권한으로 실행되는 SECURITY DEFINER 헬퍼를 통해서만 조회한다.
-- owner 조회는 (FORCE ROW LEVEL SECURITY를 걸지 않았으므로) RLS를 재적용하지
-- 않아 순환이 끊긴다.
create or replace function public.is_assigned_teacher_of_enrollment(p_subject_enrollment_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teacher_assignments ta
    where ta.subject_enrollment_id = p_subject_enrollment_id and ta.teacher_id = auth.uid()
  );
$$;
revoke execute on function public.is_assigned_teacher_of_enrollment(uuid) from public;
grant execute on function public.is_assigned_teacher_of_enrollment(uuid) to anon, authenticated;
-- anon 포함(위 is_household_member 정정 사유와 동일) — auth.uid() 필터링만으로
-- 안전하며, 제외 시 anon의 subject_enrollments 조회가 하드 에러가 된다.

create or replace function public.is_enrollment_child_or_guardian(p_subject_enrollment_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from subject_enrollments se
    where se.id = p_subject_enrollment_id
      and (se.child_id = auth.uid() or is_guardian_of(se.child_id) or is_household_guardian_of(se.child_id))
  );
$$;
revoke execute on function public.is_enrollment_child_or_guardian(uuid) from public;
grant execute on function public.is_enrollment_child_or_guardian(uuid) to anon, authenticated;
-- anon 포함(위 is_household_member 정정 사유와 동일) — auth.uid() 필터링만으로
-- 안전하며, 제외 시 anon의 teacher_assignments 조회가 하드 에러가 된다.

create policy "subject_enrollments 조회" on subject_enrollments for select
  using (
    child_id = auth.uid()
    or (is_guardian_of(child_id) or is_household_guardian_of(child_id))
    or is_assigned_teacher_of_enrollment(id)
    or is_admin() or current_user_has_capability('매칭권한')
  );
create policy "subject_enrollments 쓰기" on subject_enrollments for all
  using (is_admin() or current_user_has_capability('매칭권한'))
  with check (is_admin() or current_user_has_capability('매칭권한'));

-- teacher_assignments
create policy "teacher_assignments 조회" on teacher_assignments for select
  using (
    is_enrollment_child_or_guardian(subject_enrollment_id)
    or teacher_id = auth.uid()
    or is_admin() or current_user_has_capability('매칭권한')
  );
create policy "teacher_assignments 쓰기" on teacher_assignments for all
  using (is_admin() or current_user_has_capability('매칭권한'))
  with check (is_admin() or current_user_has_capability('매칭권한'));

-- reservations
create policy "reservations 조회" on reservations for select
  using (
    owner_profile_id = auth.uid()
    or exists (select 1 from subject_enrollments se where se.id = subject_enrollment_id
      and (se.child_id = auth.uid() or (is_guardian_of(se.child_id) or is_household_guardian_of(se.child_id))))
    or is_admin() or current_user_has_capability('예약관리권한')
  );
create policy "reservations 쓰기" on reservations for all
  using (is_admin() or current_user_has_capability('예약관리권한'))
  with check (is_admin() or current_user_has_capability('예약관리권한'));
-- 학생 본인 예약 생성 흐름은 R6 구현 시 서버 액션 전용 함수로 추가(현재는 관리자/capability만 직접 허용).

-- sessions_v3 / session_status_events
create policy "sessions_v3 조회" on sessions_v3 for select
  using (
    teacher_id = auth.uid()
    or exists (select 1 from subject_enrollments se where se.id = subject_enrollment_id
      and (se.child_id = auth.uid() or (is_guardian_of(se.child_id) or is_household_guardian_of(se.child_id))))
    or is_admin() or current_user_has_capability('QC권한')
  );
create policy "sessions_v3 쓰기" on sessions_v3 for all
  using (is_admin() or current_user_has_capability('교육관리권한'))
  with check (is_admin() or current_user_has_capability('교육관리권한'));

create policy "session_status_events 조회" on session_status_events for select
  using (
    exists (select 1 from sessions_v3 s where s.id = session_id and (
      s.teacher_id = auth.uid()
      or exists (select 1 from subject_enrollments se where se.id = s.subject_enrollment_id
        and (se.child_id = auth.uid() or (is_guardian_of(se.child_id) or is_household_guardian_of(se.child_id))))
    ))
    or is_admin()
  );
-- insert 정책 없음(기본 거부) — reopen_session()/recomplete_session() SECURITY DEFINER만 기록 가능.

-- 상품 마스터 데이터: 로그인 사용자 전체 읽기, 쓰기는 관리자만
create policy "lesson_types 조회" on lesson_types for select using (auth.uid() is not null);
create policy "lesson_types 쓰기" on lesson_types for all using (is_admin()) with check (is_admin());
create policy "entitlement_types 조회" on entitlement_types for select using (auth.uid() is not null);
create policy "entitlement_types 쓰기" on entitlement_types for all using (is_admin()) with check (is_admin());
create policy "entitlement_products 조회" on entitlement_products for select using (auth.uid() is not null);
create policy "entitlement_products 쓰기" on entitlement_products for all using (is_admin()) with check (is_admin());

-- teacher_rate_history
create policy "teacher_rate_history 조회" on teacher_rate_history for select
  using (teacher_id = auth.uid() or is_admin() or current_user_has_capability('정산권한'));
create policy "teacher_rate_history 쓰기" on teacher_rate_history for all
  using (is_admin() or current_user_has_capability('선생님관리권한'))
  with check (is_admin() or current_user_has_capability('선생님관리권한'));

-- entitlement_grants / entitlement_ledger
create policy "entitlement_grants 조회" on entitlement_grants for select
  using (child_id = auth.uid() or (is_guardian_of(child_id) or is_household_guardian_of(child_id)) or is_admin() or current_user_has_capability('결제권한'));
create policy "entitlement_grants 쓰기" on entitlement_grants for all
  using (is_admin() or current_user_has_capability('수업권조정권한'))
  with check (is_admin() or current_user_has_capability('수업권조정권한'));

create policy "entitlement_ledger 조회" on entitlement_ledger for select
  using (
    exists (select 1 from entitlement_grants g where g.id = grant_id and (
      g.child_id = auth.uid() or (is_guardian_of(g.child_id) or is_household_guardian_of(g.child_id))
    ))
    or is_admin() or current_user_has_capability('결제권한')
  );
-- insert 정책 없음(기본 거부) — hold_entitlement()/consume_entitlement()/release_entitlement() SECURITY DEFINER만 기록 가능.

-- makeup_obligations / makeup_events
create policy "makeup_obligations 조회" on makeup_obligations for select
  using (child_id = auth.uid() or (is_guardian_of(child_id) or is_household_guardian_of(child_id)) or teacher_id = auth.uid() or is_admin());
create policy "makeup_obligations 쓰기" on makeup_obligations for all
  using (is_admin() or current_user_has_capability('교육관리권한'))
  with check (is_admin() or current_user_has_capability('교육관리권한'));

create policy "makeup_events 조회" on makeup_events for select
  using (
    exists (select 1 from makeup_obligations o where o.id = obligation_id and (
      o.child_id = auth.uid() or (is_guardian_of(o.child_id) or is_household_guardian_of(o.child_id)) or o.teacher_id = auth.uid()
    ))
    or is_admin()
  );
-- insert 정책 없음(기본 거부) — apply_makeup_time() SECURITY DEFINER만 기록 가능.

-- payout_batches / payout_items
create policy "payout_batches 조회" on payout_batches for select
  using (teacher_id = auth.uid() or is_admin() or current_user_has_capability('정산권한'));
create policy "payout_batches 쓰기" on payout_batches for all
  using (is_admin() or current_user_has_capability('정산권한'))
  with check (is_admin() or current_user_has_capability('정산권한'));

create policy "payout_items 조회" on payout_items for select
  using (teacher_id = auth.uid() or is_admin() or current_user_has_capability('정산권한'));
create policy "payout_items 쓰기" on payout_items for all
  using (is_admin() or current_user_has_capability('정산권한'))
  with check (is_admin() or current_user_has_capability('정산권한'));

-- supervisor_capabilities: 관리자만 조회·부여
create policy "supervisor_capabilities 조회" on supervisor_capabilities for select using (is_admin());
create policy "supervisor_capabilities 쓰기" on supervisor_capabilities for all using (is_admin()) with check (is_admin());

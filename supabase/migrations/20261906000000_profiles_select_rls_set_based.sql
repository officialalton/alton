-- profiles SELECT RLS 성능(#11): 행마다 상관 EXISTS + 함수 호출(shares_household_as_guardian_or_child,
-- is_guardian_of, is_admin)을 평가해 학생 JWT 의 count(*) 가 ~40초였다.
-- 보이는 행 집합은 그대로 두고, "내가 볼 수 있는 profile id 집합"을 함수 한 번(SubPlan hash)으로 계산한다.
-- 롤백: 20260828050039 / 20261466000000 의 정책 정의로 되돌리고 두 함수를 drop 한다(데이터 변경 없음).

create or replace function public.visible_profile_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as uid),
  my_children as (
    select gs.student_id as child_id from guardian_students gs, me where gs.parent_id = me.uid
    union
    select c.profile_id from household_members c
      join household_members g on g.household_id = c.household_id and g.role = 'guardian'
      cross join me
     where c.role = 'child' and g.profile_id = me.uid
  )
  select me.uid from me
  union select e.student_id from enrollments e, me where e.teacher_id = me.uid
  union select e.teacher_id from enrollments e, me where e.student_id = me.uid
  union select gs.student_id from guardian_students gs, me where gs.parent_id = me.uid
  union select gs.parent_id from guardian_students gs, me where gs.student_id = me.uid
  union select o.profile_id from household_members m
          join household_members o on o.household_id = m.household_id and o.role <> m.role
          cross join me where m.profile_id = me.uid
  union select ta.teacher_id from teacher_assignments ta
          join subject_enrollments se on se.id = ta.subject_enrollment_id, me where se.child_id = me.uid
  union select se.child_id from teacher_assignments ta
          join subject_enrollments se on se.id = ta.subject_enrollment_id, me where ta.teacher_id = me.uid
  union select ta.teacher_id from teacher_assignments ta
          join subject_enrollments se on se.id = ta.subject_enrollment_id
         where se.child_id in (select child_id from my_children)
  union select ca.student_id from consultant_assignments ca, me where ca.consultant_id = me.uid
  union select ca.consultant_id from consultant_assignments ca, me where ca.student_id = me.uid
$$;

create or replace function public.guardian_children_consultant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select ca.consultant_id
    from consultant_assignments ca
    join household_members child_hm on child_hm.profile_id = ca.student_id and child_hm.role = 'child'
    join household_members guardian_hm on guardian_hm.household_id = child_hm.household_id and guardian_hm.role = 'guardian'
   where guardian_hm.profile_id = auth.uid()
$$;

revoke all on function public.visible_profile_ids() from public, anon;
revoke all on function public.guardian_children_consultant_ids() from public, anon;
grant execute on function public.visible_profile_ids() to authenticated, service_role;
grant execute on function public.guardian_children_consultant_ids() to authenticated, service_role;

drop policy if exists "본인/관계자/관리자 조회" on public.profiles;
create policy "본인/관계자/관리자 조회" on public.profiles for select
  using (
    id = (select auth.uid())
    or (select public.is_admin())
    or id in (select public.visible_profile_ids())
  );

drop policy if exists "보호자 자녀의 담당 컨설턴트 프로필 조회" on public.profiles;
create policy "보호자 자녀의 담당 컨설턴트 프로필 조회" on public.profiles for select
  using (id in (select public.guardian_children_consultant_ids()));

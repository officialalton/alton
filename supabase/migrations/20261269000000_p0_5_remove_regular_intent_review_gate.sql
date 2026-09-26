-- P0-5(2026-09-10, 제품 오너 지시) — "정규 진행 희망" 선택에 체험 수업 리뷰
-- 확정(final)을 선행 조건으로 거는 것은 정책상 잘못됐다. 리뷰 상태와 무관하게
-- 정규 전환 대상 보호자는 언제든 정규 진행 의사를 표시할 수 있어야 한다.
--
-- confirm_regular_progress_intent()(원래 20261016000000, lesson_reviews로
-- 갈아끼운 최신 버전은 20261027000000)에서 "확정된 체험 리뷰가 있어야
-- 정규 진행을 희망할 수 있습니다" 예외를 던지는 블록만 제거한다. 아래는
-- 그대로 유지한다(계약·권한·중복 제출 방지는 이 게이트와 별개 조건):
--   - 로그인 보호자 확인
--   - 그 가족(household) 소유 subject_enrollment인지 확인
--   - trial_regular_progress_selections.subject_enrollment_id unique 제약 +
--     기존 행이 있으면 그 id를 그대로 반환하는 멱등 처리(중복 제출 방지)
--
-- 기존 migration 파일(20261016000000/20261027000000)은 수정하지 않고 함수
-- 본문만 이 새 migration으로 교체한다(additive, 컬럼/테이블 변경 없음).

create or replace function public.confirm_regular_progress_intent(p_subject_enrollment_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_guardian_id uuid := auth.uid();
  v_existing_id uuid;
  v_new_id uuid;
begin
  if v_guardian_id is null or not exists (select 1 from parents where id = v_guardian_id) then
    raise exception '로그인한 보호자만 정규 진행을 희망할 수 있습니다.';
  end if;
  if not exists (
    select 1 from subject_enrollments se
    join household_members hc on hc.household_id = (
      select hm.household_id from household_members hm
      where hm.profile_id = se.child_id and hm.role = 'child' limit 1
    )
    where se.id = p_subject_enrollment_id and hc.profile_id = v_guardian_id and hc.role = 'guardian'
  ) then
    raise exception '본인 가족의 과목 수강에 대해서만 정규 진행을 희망할 수 있습니다.';
  end if;

  select id into v_existing_id from trial_regular_progress_selections where subject_enrollment_id = p_subject_enrollment_id;
  if v_existing_id is not null then
    return v_existing_id;
  end if;

  insert into trial_regular_progress_selections (subject_enrollment_id, guardian_id)
  values (p_subject_enrollment_id, v_guardian_id)
  returning id into v_new_id;
  return v_new_id;
end;
$$;

revoke execute on function public.confirm_regular_progress_intent(uuid) from public, anon;
grant execute on function public.confirm_regular_progress_intent(uuid) to authenticated, service_role;

-- 2026-09-17(제품 오너 피드백) — 학생·보호자 화면이 과목당 "가장 최근 확정
-- 리뷰 1건만" 보여주던 제약(체험은 세션이 1개뿐이라 문제없었지만, 정규 수업까지
-- 확장하면 완료된 수업마다 각각 리뷰가 필요하다)을 풀기 위해, 화면 쪽에서 세션별로
-- 구분할 수 있게 session_id를 반환값에 추가한다(리뷰 내용 자체의 접근 범위는
-- 그대로 — 확정된 것만, household 소속 검증 로직도 그대로).
drop function if exists public.get_lesson_reviews_for_family(uuid);

create function public.get_lesson_reviews_for_family(p_subject_enrollment_id uuid)
returns table (
  review_id uuid,
  lesson_type text,
  session_id uuid,
  final_text text,
  ai_summary text,
  finalized_at timestamptz,
  category_key text,
  category_label text,
  category_note text
)
language plpgsql security definer set search_path = public as $$
begin
  if not (
    is_admin()
    or exists (
      select 1 from subject_enrollments se
      join household_members hc on hc.household_id = (
        select hm.household_id from household_members hm
        where hm.profile_id = se.child_id and hm.role = 'child' limit 1
      )
      where se.id = p_subject_enrollment_id
        and ((hc.profile_id = auth.uid() and hc.role = 'guardian') or se.child_id = auth.uid())
    )
  ) then
    return;
  end if;

  return query
    select r.id, r.lesson_type, coalesce(r.trial_session_id, r.regular_session_id), r.final_text, r.ai_summary, r.finalized_at,
           rc.key, rc.label, cn.note
    from lesson_reviews r
    left join lesson_review_category_notes cn on cn.review_id = r.id
    left join review_categories rc on rc.id = cn.category_id
    where r.subject_enrollment_id = p_subject_enrollment_id and r.status = 'final'
    order by r.finalized_at asc, rc.display_order asc;
end;
$$;
revoke execute on function public.get_lesson_reviews_for_family(uuid) from public, anon;
grant execute on function public.get_lesson_reviews_for_family(uuid) to authenticated, service_role;

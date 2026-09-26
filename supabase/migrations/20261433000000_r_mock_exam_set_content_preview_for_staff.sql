-- 고정형 SAT 모의고사 V1 — 관리자·교사가 세트의 실제 문항 내용(지문·질문·선택지·정답·해설·그림)을
-- 볼 수 있는 미리보기 RPC (2026-09-21 UAT 지적: 기존 관리자 "검토" 화면은 영역·난이도·세부기술
-- 메타데이터만 보여줄 뿐 실제 문제 내용을 볼 방법이 없었다).
--
-- mock_exam_set_items는 관리자 전용 정책만 있고(교사는 아예 못 읽음), problem_versions의
-- "문제 버전 조회" 정책은 교사가 자기 담당 과목으로만 좁혀져 있어(20261339000000) 모의고사
-- 세트가 담당 밖 과목 문제를 포함하면 교사가 못 본다. 이건 학생 응시 데이터가 아니라 "이미
-- 공개(published)된 문제은행 콘텐츠를 스태프가 미리보기"하는 것뿐이라 학생별 소유권 검사가
-- 필요 없다 — 관리자 또는 교사(role='teacher')이면 누구나 볼 수 있게 SECURITY DEFINER로 우회한다.
create or replace function public.mock_exam_set_content_for_staff(p_exam_set_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_is_staff boolean;
begin
  select is_admin() or exists(select 1 from profiles where id = auth.uid() and role = 'teacher') into v_is_staff;
  if not v_is_staff then
    raise exception '관리자·교사만 모의고사 문항 내용을 볼 수 있습니다.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'setItemId', i.id, 'section', i.section, 'position', i.position, 'problemId', i.problem_id,
      'satDomain', i.sat_domain, 'skillCode', i.skill_code, 'difficulty', i.difficulty,
      'format', coalesce(p.format::text, 'mc'),
      'passage', v.passage, 'question', v.question, 'options', v.options, 'figure', v.figure,
      'correctIndex', v.correct_index, 'answers', v.answers, 'explanation', v.explanation
    ) order by i.section, i.position)
    from mock_exam_set_items i
    join problem_versions v on v.id = i.problem_version_id
    left join problems p on p.id = i.problem_id
    where i.exam_set_id = p_exam_set_id
  ), '[]'::jsonb);
end $$;

revoke execute on function public.mock_exam_set_content_for_staff(uuid) from public, anon;
grant execute on function public.mock_exam_set_content_for_staff(uuid) to authenticated;

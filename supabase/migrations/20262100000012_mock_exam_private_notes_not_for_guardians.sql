-- 2026-10-06 오너 정책(무료 회원 보호자 연결): 보호자는 학생의 개별 답안·해설은 볼 수 있지만, 학생의 개인 필기
-- (모의고사 하이라이트·메모·소거 표시·풀이용 화이트보드)는 볼 수 없다. 기존 RPC 는 is_guardian_of 로 읽기를 허용했다.
-- 보호자가 호출하면 오류가 아니라 '빈 값'을 돌려 보호자 결과 화면이 깨지지 않게 한다. 다른 컨텍스트(수업·과제)의
-- 필기 열람 규칙은 그대로다.
create or replace function public.load_mock_exam_annotations(p_attempt_id uuid, p_set_item_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_student uuid;
begin
  select student_id into v_student from mock_exam_attempts where id = p_attempt_id;
  if v_student is null then raise exception '응시를 찾을 수 없습니다.'; end if;
  if v_student <> auth.uid() then
    if is_admin() or teaches_student(v_student) then
      null;
    elsif is_guardian_of(v_student) then
      return '{"highlights":[],"eliminated":[]}'::jsonb;
    else
      raise exception '이 표시를 볼 권한이 없습니다.';
    end if;
  end if;
  return coalesce(
    (select jsonb_build_object('highlights', highlights, 'eliminated', eliminated)
       from mock_exam_annotations where attempt_id = p_attempt_id and set_item_id = p_set_item_id),
    '{"highlights":[],"eliminated":[]}'::jsonb);
end $$;
revoke execute on function public.load_mock_exam_annotations(uuid, uuid) from public, anon;
grant execute on function public.load_mock_exam_annotations(uuid, uuid) to authenticated, service_role;

create or replace function public.load_problem_note_strokes(
  p_context text, p_target_id uuid, p_item_id uuid, p_author_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_student uuid; v_author uuid := coalesce(p_author_id, auth.uid());
begin
  if v_author <> auth.uid() then
    v_student := _problem_note_target_student(p_context, p_target_id);
    if v_student is null then
      raise exception '이 필기를 볼 권한이 없습니다.';
    end if;
    if not (is_admin() or teaches_student(v_student)) then
      if is_guardian_of(v_student) and p_context = 'mock_exam' then
        return '[]'::jsonb;
      elsif not is_guardian_of(v_student) then
        raise exception '이 필기를 볼 권한이 없습니다.';
      end if;
    end if;
  end if;
  return coalesce(
    (select strokes from problem_note_strokes
      where context = p_context and target_id = p_target_id and item_id = p_item_id and author_id = v_author),
    '[]'::jsonb
  );
end $$;
revoke execute on function public.load_problem_note_strokes(text, uuid, uuid, uuid) from public, anon;
grant execute on function public.load_problem_note_strokes(text, uuid, uuid, uuid) to authenticated;

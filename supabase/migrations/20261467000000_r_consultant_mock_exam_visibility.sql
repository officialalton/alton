-- 2026-09-22(실사용자 UAT — jiman@alton.education로 로그인해 확인) — 컨설턴트
-- 학생 패널 Overview/Board가 "불러오는 중..."에서 멈춤(500). 원인:
-- loadStudentBoardCardsAction이 mock_exam_attempt_summaries()를 호출하는데,
-- 그 안의 _mock_exam_can_view()가 담당 컨설턴트를 몰라 항상 예외를 던졌다
-- (20261429000000 — 학생 본인/보호자/교사/관리자만 허용). 20261461000000에서
-- mock_exam_attempts 테이블 RLS는 컨설턴트에게 열어줬지만, 이 RPC의 권한
-- 검사는 별도 함수라 그때 놓쳤다.
create or replace function public._mock_exam_can_view(p_student_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select _is_service_role() or p_student_id = auth.uid() or is_admin() or teaches_student(p_student_id)
    or is_guardian_of(p_student_id) or is_assigned_consultant_of(p_student_id);
$$;

-- 같은 이유로 loadVocabQuizzes()가 부르는 ensure_default_vocab_folder()도
-- 담당 컨설턴트를 몰라 예외를 던진다(20261380000000 — 학생 본인/교사/관리자만).
create or replace function public.ensure_default_vocab_folder(p_student_id uuid)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare v_id uuid;
begin
  if not (p_student_id = auth.uid() or teaches_student(p_student_id) or is_admin() or is_assigned_consultant_of(p_student_id)) then
    raise exception '본인 또는 담당 학생만 폴더를 만들 수 있습니다.';
  end if;
  select id into v_id from vocab_word_folders where student_id = p_student_id and is_default limit 1;
  if v_id is not null then
    return v_id;
  end if;
  insert into vocab_word_folders (student_id, name, is_default, position)
  values (p_student_id, '오답 노트', true, -1)
  on conflict (student_id, name) do update set is_default = true
  returning id into v_id;
  return v_id;
end $$;

-- 컨설턴트 Round A(2026-09-22 사용자 지시) — "학생별로 오버뷰/보드뷰/로드맵
-- 들어갈 수 있게, 컨설턴트도 학생 보드뷰 쪽 수정 권한". 로드맵은 이미
-- is_assigned_consultant_of()가 _roadmap_can_read/_roadmap_can_write에 반영돼
-- 있다(20261447000000) — 여기서는 보드(수동 할 일 + 과제·모의고사·단어시험
-- 읽기 전용 자동 카드) 접근을 컨설턴트에게 넓힌다.

-- 1) board_manual_tasks — 담당 컨설턴트도 조회·생성·수정·삭제할 수 있게.
alter table board_manual_tasks drop constraint if exists board_manual_tasks_created_by_role_check;
alter table board_manual_tasks add constraint board_manual_tasks_created_by_role_check
  check (created_by_role in ('student', 'teacher', 'admin', 'consultant'));

drop policy if exists "본인 학생/담당 선생님/보호자/관리자 조회" on board_manual_tasks;
create policy "본인 학생/담당 선생님/보호자/컨설턴트/관리자 조회" on board_manual_tasks for select
  using (
    student_id = auth.uid()
    or teaches_student(student_id)
    or is_guardian_of(student_id)
    or is_assigned_consultant_of(student_id)
    or is_admin()
  );

drop policy if exists "본인 학생/담당 선생님/관리자 생성" on board_manual_tasks;
create policy "본인 학생/담당 선생님/컨설턴트/관리자 생성" on board_manual_tasks for insert
  with check (
    (student_id = auth.uid() and created_by = auth.uid())
    or teaches_student(student_id)
    or is_assigned_consultant_of(student_id)
    or is_admin()
  );

drop policy if exists "본인 학생/담당 선생님/관리자 수정" on board_manual_tasks;
create policy "본인 학생/담당 선생님/컨설턴트/관리자 수정" on board_manual_tasks for update
  using (student_id = auth.uid() or teaches_student(student_id) or is_assigned_consultant_of(student_id) or is_admin())
  with check (student_id = auth.uid() or teaches_student(student_id) or is_assigned_consultant_of(student_id) or is_admin());

drop policy if exists "본인 학생/담당 선생님/관리자 삭제" on board_manual_tasks;
create policy "본인 학생/담당 선생님/컨설턴트/관리자 삭제" on board_manual_tasks for delete
  using (student_id = auth.uid() or teaches_student(student_id) or is_assigned_consultant_of(student_id) or is_admin());

-- 2) homework_batches_for_viewer() — 컨설턴트도 담당 학생의 과제(읽기 전용
-- 카드로만 쓰인다)를 볼 수 있게.
create or replace function public.homework_batches_for_viewer(p_student_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_self boolean; v_guardian boolean; v_admin boolean; v_teacher boolean; v_consultant boolean;
begin
  v_self := p_student_id = auth.uid();
  v_admin := is_admin() or _is_service_role();
  v_teacher := teaches_student(p_student_id);
  v_guardian := is_guardian_of(p_student_id);
  v_consultant := is_assigned_consultant_of(p_student_id);
  if not (v_self or v_admin or v_teacher or v_guardian or v_consultant) then
    raise exception '이 학생의 과제를 볼 권한이 없습니다.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', b.id, 'teacherId', b.teacher_id, 'teacherName', tp.name,
      'studentId', b.student_id, 'label', b.label, 'subjectId', b.subject_id, 'subjectName', sj.name,
      'createdAt', b.created_at, 'dueAt', b.due_at,
      'items', coalesce((
        select jsonb_agg(_homework_item_for_viewer(it, not (v_admin or b.teacher_id = auth.uid())) order by (it->>'position')::int)
        from jsonb_array_elements(b.items) it
      ), '[]'::jsonb)
    ) order by b.created_at desc)
    from (
      select * from homework_batches hb
      where hb.student_id = p_student_id
        and (v_self or v_admin or v_guardian or v_consultant or hb.teacher_id = auth.uid())
      order by hb.created_at desc limit 50
    ) b
    left join profiles tp on tp.id = b.teacher_id
    left join subjects sj on sj.id = b.subject_id
  ), '[]'::jsonb);
end;
$$;

-- 3) mock_exam_attempts — 담당 컨설턴트 읽기 전용.
create policy "응시 기록 담당 컨설턴트 읽기 전용" on mock_exam_attempts for select to authenticated
  using (public.is_assigned_consultant_of(mock_exam_attempts.student_id));

-- 4) vocab_quizzes — 담당 컨설턴트 읽기 전용.
create policy "담당 컨설턴트 조회" on vocab_quizzes for select
  using (is_assigned_consultant_of(owner_id));

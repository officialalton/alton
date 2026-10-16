-- homework_batches.due_at를 학생/학부모 조회 RPC에 노출하고, 발급 교사가
-- 배정 후에도 마감일을 바꿀 수 있는 RPC를 추가한다(2026-09-21 확정 — Board의
-- "기한 경과" 판정에 필요). create or replace로 새 버전을 올린다 — 이미 적용된
-- 마이그레이션 파일을 고쳐서는 반영되지 않기 때문(CLAUDE.md 참고).
create or replace function public.homework_batches_for_viewer(p_student_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_self boolean; v_guardian boolean; v_admin boolean; v_teacher boolean;
begin
  v_self := p_student_id = auth.uid();
  v_admin := is_admin() or _is_service_role();
  v_teacher := teaches_student(p_student_id);
  v_guardian := is_guardian_of(p_student_id);
  if not (v_self or v_admin or v_teacher or v_guardian) then
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
        and (v_self or v_admin or v_guardian or hb.teacher_id = auth.uid())
      order by hb.created_at desc limit 50
    ) b
    left join profiles tp on tp.id = b.teacher_id
    left join subjects sj on sj.id = b.subject_id
  ), '[]'::jsonb);
end $$;

-- 발급 교사(또는 관리자)만 배정 후 마감일을 바꿀 수 있다.
create or replace function public.update_homework_batch_due_at(p_batch_id uuid, p_due_at timestamptz)
returns void
language plpgsql security definer set search_path = public as $$
declare v_teacher_id uuid;
begin
  select teacher_id into v_teacher_id from homework_batches where id = p_batch_id;
  if v_teacher_id is null then raise exception '존재하지 않는 과제입니다.'; end if;
  if v_teacher_id <> auth.uid() and not is_admin() then
    raise exception '발급한 선생님만 마감일을 바꿀 수 있습니다.';
  end if;
  update homework_batches set due_at = p_due_at where id = p_batch_id;
end $$;

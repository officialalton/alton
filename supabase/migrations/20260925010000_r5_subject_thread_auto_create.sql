-- R5 후속 — subject_threads 자동 생성을 change_teacher_assignment() 안에만 두면
-- "최초" 배정(관리자가 change_teacher_assignment를 거치지 않고 teacher_assignments에
-- 직접 INSERT하는 경우, app/admin/subject-enrollment-actions.ts의
-- assignTeacherToSubjectEnrollment가 그 경로)에는 스레드가 생기지 않는다.
-- 트리거로 옮겨 "planned/active teacher_assignments 행이 생기면 항상 스레드가
-- 있다"를 보장한다 — change_teacher_assignment()의 명시적 insert는 그대로 두되
-- (unique index로 충돌 없이 no-op), 이 트리거가 실제 생성 경로가 된다.

create or replace function public.ensure_subject_thread_for_assignment()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('planned', 'active') then
    insert into subject_threads (subject_enrollment_id, teacher_assignment_id, teacher_id, status)
    values (new.subject_enrollment_id, new.id, new.teacher_id, 'active')
    on conflict (teacher_assignment_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger teacher_assignments_ensure_subject_thread
  after insert on teacher_assignments
  for each row execute function public.ensure_subject_thread_for_assignment();

comment on function public.ensure_subject_thread_for_assignment() is
  'R5 후속: teacher_assignments에 planned/active 행이 생성될 때마다(직접 INSERT든
   change_teacher_assignment() 경유든) 스레드를 보장한다. change_teacher_assignment()가
   먼저 이전 스레드를 archived로 바꾸고 이 트리거가 새 스레드를 만드는 순서로 동작 —
   같은 트랜잭션 안에서 순서가 보장된다(먼저 UPDATE, 그다음 INSERT).';

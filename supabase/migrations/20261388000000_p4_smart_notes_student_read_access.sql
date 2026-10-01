-- 2026-09-16(제품 오너 정정) — Smart Notes 회의록 원본을 학생·보호자에게 완전히 숨기던
-- 정책(20261025000000, "고객에게 원본을 직접 보여주지 않는다")을 뒤집는다: 정규 수업
-- (sessions, 계정 생성 이후)에 한해 학생·보호자가 열람만(view-only) 가능하게 한다.
-- 첫 상담(consultations.smart_notes_drive_file_id)은 이 범위에서 제외 — 계속 관리자 전용.
set row_security = off;

create policy "session_smart_notes 조회(학생·보호자, 열람만)" on session_smart_notes for select
  using (
    exists (
      select 1 from sessions s
      join subject_enrollments se on se.id = s.subject_enrollment_id
      where s.id = session_smart_notes.session_id
        and (se.child_id = auth.uid() or is_guardian_of(se.child_id) or is_household_guardian_of(se.child_id))
    )
  );

-- 실제 Google Drive 문서 권한(view-only) 부여는 기존 session_drive_tasks 큐/워커
-- (lib/drive-session-tasks.ts, DRIVE_ARTIFACTS_ALLOW_REAL_WRITES 게이트 재사용)로 처리한다.
alter table session_drive_tasks drop constraint session_drive_tasks_task_type_check;
alter table session_drive_tasks add constraint session_drive_tasks_task_type_check
  check (task_type = any (array['folder_provision', 'permission_grant', 'permission_revoke', 'smart_notes_reader_grant']));

-- 2026-09-17(제품 오너 피드백) — 학생/보호자 포털에 "미팅록 보기" 링크 UI가
-- 없었다(docs/CURRENT.md "미완료" 항목). 링크 자체는 session_smart_notes.drive_file_id
-- 로 이미 열람 가능(20261388000000)하지만, 실제 Drive reader 권한 부여는
-- session_drive_tasks 큐가 비동기로 처리하므로 그 부여가 실제로 성공(succeeded)
-- 하기 전에 링크를 보여주면 클릭 시 "권한 없음"으로 열린다. 그래서 학생·보호자가
-- 본인 세션의 smart_notes_reader_grant 작업 상태만(다른 컬럼은 노출하지 않도록
-- 별도 뷰로) 조회할 수 있게 하고, succeeded일 때만 링크를 보여준다.

create view session_smart_notes_reader_grant_status as
select session_id, status
from session_drive_tasks
where task_type = 'smart_notes_reader_grant';

alter view session_smart_notes_reader_grant_status set (security_invoker = true);

grant select on session_smart_notes_reader_grant_status to authenticated;

-- session_drive_tasks 자체에는 여전히 학생/보호자용 select 정책이 없으므로(payload에
-- 다른 정보가 섞여 있음), 뷰가 정상 작동하려면 뷰 정의 안에서만 쓰이는 최소 정책을
-- 하나 추가한다 — status만 노출하고 payload/last_error 등은 이 정책으로도 뷰가
-- select하지 않는 컬럼이라 노출되지 않는다(security_invoker라 호출자 권한으로 평가).
create policy "session_smart_notes_reader_grant 상태 조회(학생·보호자)" on session_drive_tasks for select
  using (
    task_type = 'smart_notes_reader_grant'
    and exists (
      select 1 from sessions s
      join subject_enrollments se on se.id = s.subject_enrollment_id
      where s.id = session_drive_tasks.session_id
        and (se.child_id = auth.uid() or is_guardian_of(se.child_id) or is_household_guardian_of(se.child_id))
    )
  );

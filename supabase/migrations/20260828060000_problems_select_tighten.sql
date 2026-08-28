-- 011-session-material-tab 작업 중 발견: problems의 select 정책이
-- "status='confirmed' and (origin_session_id is null or 세션 관련자)"였는데,
-- origin_session_id가 null인 문제(교재 section에 속한 문제)는 세션 관련자 체크를
-- 아예 건너뛰어서, 누구든 로그인만 했으면 draft 상태인 교재 안의 확정된 문제를
-- section_id를 알면 직접 조회할 수 있었다. section_id가 있는 경우 부모 교재가
-- published거나 본인 소유일 때만 보이도록 조인해서 확인한다.

drop policy if exists "확정된 문제는 관련 세션 참여자, 초안은 작성자/관리자" on problems;

create policy "문제 조회" on problems for select
  using (
    is_admin()
    or created_by = auth.uid()
    or (
      status = 'confirmed'
      and origin_session_id is not null
      and is_session_related(origin_session_id)
    )
    or (
      status = 'confirmed'
      and section_id is not null
      and exists (
        select 1 from curriculum_doc_sections cs
        join curriculum_docs d on d.id = cs.curriculum_doc_id
        where cs.id = problems.section_id
          and (d.status = 'published' or d.owner_teacher_id = auth.uid())
      )
    )
  );

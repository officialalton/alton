-- Phase A 마무리(2026-09-23, 사용자 지시) — "보호자는 자녀별 담당 컨설턴트를
-- 확인하고 그 사람에게 상담 신청과 새 메시지 문의를 할 수 있어야 합니다."
-- 메시지 문의는 이미 됨(MessengerTab). 상담 신청은 지금까지 항상
-- meeting_requests.consultant_id를 null로 남겨 관리자 큐로만 갔다 —
-- 담당 컨설턴트가 이미 있는 가족은 그 컨설턴트에게 바로 연결한다.
--
-- 20261470000000의 "학생 본인 신청" INSERT 정책은 consultant_id가 null이거나
-- 본인 담당 컨설턴트와 일치해야 한다고 이미 검증한다. "보호자 본인 household
-- 신청" 정책은 그 검사가 없어서 여기서 같은 검증을 추가한다(같은 이름으로
-- 재정의 — permissive 정책은 OR로 합쳐지므로 새로 추가만 하면 기존 느슨한
-- 정책이 여전히 통과시켜 의미가 없다. drop 후 재생성한다).
drop policy "보호자 본인 household 신청" on meeting_requests;
create policy "보호자 본인 household 신청" on meeting_requests for insert
  with check (
    requested_by = auth.uid()
    and exists (
      select 1 from household_members hm
      where hm.household_id = meeting_requests.household_id
        and hm.profile_id = auth.uid()
        and hm.role = 'guardian'
    )
    and (
      consultant_id is null
      or exists (
        select 1 from consultant_assignments ca
        join household_members child on child.profile_id = ca.student_id and child.role = 'child'
        where child.household_id = meeting_requests.household_id
          and ca.consultant_id = meeting_requests.consultant_id
      )
    )
  );

comment on policy "보호자 본인 household 신청" on meeting_requests is
  '2026-09-23 — consultant_id를 지정할 때는 그 household 자녀 중 하나의 실제
  담당 컨설턴트여야 한다(학생 본인 신청 정책과 같은 검증). 서버 액션
  (submitMeetingRequest)이 이 값을 스스로 정하므로 정상 경로에서는 항상
  통과하지만, 클라이언트가 직접 REST로 호출해 다른 컨설턴트를 지정하는
  경로를 막는다.';

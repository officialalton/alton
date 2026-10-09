-- R6 corrective(2026-09-09, 기반 안정화 계획 7절 5단계 후속 — 제품 오너 지적) —
-- session_incident_reports INSERT 정책은 is_session_related_v3(session_id)만
-- 확인하고 reported_by가 실제 호출자(auth.uid())와 같은지는 확인하지 않았다.
-- 세션 관련자(학생/보호자/선생님)가 요청 바디에 다른 profile id를 reported_by로
-- 넣으면 신고자를 위조할 수 있는 구조였다 — 5단계에서 reported_by 미기록
-- 버그를 고쳐 이 기능이 다시 실제로 동작하게 됐으므로, 신고자 신원도 DB
-- 레벨에서 함께 고정해야 한다.
--
-- 조사 결과: session_incident_reports에 대한 INSERT 경로는
-- lib/booking/incident-reports.ts::submitIncidentReport() 하나뿐이고, 이
-- 함수를 호출하는 3개 서버 액션(app/student/incident-report-actions.ts,
-- app/teacher/incident-report-actions.ts, app/parent/booking-actions.ts::
-- reportTeacherIssueForChild)은 전부 requireUser()로 얻은 세션 사용자의 id를
-- 그대로 reported_by로 전달한다(admin 클라이언트로 이 테이블에 INSERT하는
-- 경로는 없음 — app/admin/booking-actions.ts는 이 테이블을 SELECT만 한다).
-- 즉 "관리자가 대신 신고를 기록해야 하는" 정당한 예외 경로가 실제로 존재하지
-- 않으므로, 예외를 만들지 않고 reported_by = auth.uid()를 무조건 강제한다.
--
-- is_admin()/capability 분기도 함께 유지하는 이유: 그 분기는 "이 세션과
-- 무관한 관리자/예약관리권한 보유자가 신고를 기록할 수 있는가"(세션 관련성
-- 요건 완화)에 대한 것이고, "누구 명의로 기록되는가"(reported_by 위조 방지)와는
-- 독립된 질문이다 — 관리자가 신고를 남기더라도 그 관리자 본인 명의로만
-- 남겨야 하므로 reported_by = auth.uid() 조건은 관리자 분기에도 그대로 AND로
-- 적용한다.

drop policy "세션 당사자/관리자 신고" on session_incident_reports;
create policy "세션 당사자/관리자 신고" on session_incident_reports for insert
  with check (
    reported_by = auth.uid()
    and (is_session_related_v3(session_id) or is_admin() or current_user_has_capability('예약관리권한'))
  );

comment on table session_incident_reports is
  'R6: 선생님 지각/학생·선생님 노쇼 "신고"만 기록하는 append-only 로그. 이 신고 자체는 '
  '출석 확정이나 수업권 소진을 일으키지 않는다 — 확정·정산 판정은 R7(수업 상태·출석·정산 근거)에서 '
  '이 로그를 입력으로 사용해 처리한다. R6 corrective(2026-09-09): INSERT 시 reported_by는 '
  '반드시 auth.uid()와 같아야 한다(구조적 강제) — 세션 관련자/관리자라도 다른 사용자 명의로 '
  '신고를 위조할 수 없다.';

-- R15-A(Messenger 1/N, 2026-09-23) — 가족 메신저 개선분(전체 Messenger 재구조의
-- 첫 조각): (a) 문의에 주제 제목을 붙일 수 있게 하고, (b) 담당 컨설턴트도
-- 보호자·학생에게 먼저 새 문의를 열 수 있게 한다("Read and reply"였던 걸
-- "Read, reply, and start" 로 확장). 나머지(선생님 대화, 관리자-컨설턴트
-- 내부 스레드, 학생 개인 대화와 가족 대화의 참여자 범위 분리, 독립 Messenger
-- 메인 탭 IA 이동)는 다음 슬라이스.

alter table household_inquiries add column subject text;
comment on column household_inquiries.subject is
  '2026-09-23 — 문의 스레드 제목. 기존 문의는 null(목록에서 첫 메시지 미리보기로 대체 표시).';

alter table household_inquiries drop constraint if exists household_inquiries_opened_by_role_check;
alter table household_inquiries add constraint household_inquiries_opened_by_role_check
  check (opened_by_role in ('guardian', 'admin', 'student', 'consultant'));

-- 담당 컨설턴트가 담당 household에 새 문의를 연다(기존엔 보호자/관리자만 가능했다).
-- 첫 메시지 삽입은 20261464000000의 기존 "담당 컨설턴트 작성" 정책이 이미
-- 커버한다(그 정책은 "열린 문의 + 담당 household"만 확인하고 누가 열었는지는
-- 안 보므로 추가 변경이 필요 없다).
create policy "담당 컨설턴트 작성" on household_inquiries for insert with check (
  opened_by_role = 'consultant' and opened_by = auth.uid() and is_assigned_consultant_of_household(household_id)
);

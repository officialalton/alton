-- Student Success Planner — Board(할 일 관리) MVP.
--
-- 2026-09-21 승인된 계획 중 이번 라운드 범위: 수동 할 일(board_manual_tasks)
-- 테이블 + 과제(homework_batches) 마감일 컬럼. 자동 카드(과제·모의고사·단어시험)는
-- 이미 있는 homework_batches/mock_exam_attempts/vocab_quizzes 데이터를 애플리케이션
-- 레이어에서 그대로 읽어 보드 카드 모양으로 합친다(집계 트리거·별도 통합 테이블 없음
-- — mock_exam_attempts·vocab_quizzes는 이미 status/due_at이 있고, homework_batches는
-- items[] 채점 상태로 status를 그 자리에서 계산할 수 있어, 트리거로 복제해 어긋날
-- 여지를 만들지 않는다). Schedule·Overview 탭, 학부모 홈 연동은 다음 라운드.

-- 1) 과제 마감일 — 배정 후에도 바꿀 수 있어야 한다(2026-09-21 확정).
alter table homework_batches add column if not exists due_at timestamptz;

-- mock_exam_attempts·vocab_quizzes는 이미 due_at 컬럼이 있다(각각
-- 20260827120000_initial_schema.sql류에서 이미 추가됨) — 여기선 손대지 않는다.

-- 2) 수동 할 일 — 학생 본인 또는 담당 교사/관리자가 만들 수 있다(2026-09-21
-- 확정: "학생도 생성할 수 있게 하는 건 괜찮을 것 같아").
create table board_manual_tasks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  status text not null default 'backlog' check (status in ('backlog', 'in_progress', 'done')),
  due_at timestamptz,
  created_by uuid not null references profiles (id),
  created_by_role text not null check (created_by_role in ('student', 'teacher', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on board_manual_tasks (student_id, status);

alter table board_manual_tasks enable row level security;

create trigger board_manual_tasks_set_updated_at
  before update on board_manual_tasks
  for each row execute function public.set_updated_at();

-- 조회: 학생 본인·담당 교사·보호자·관리자 — 학부모 홈 연동은 다음 라운드지만
-- 정책은 미리 넓게 열어 둔다(과제·모의고사 등 다른 학생 데이터와 동일 패턴).
create policy "본인 학생/담당 선생님/보호자/관리자 조회" on board_manual_tasks for select
  using (student_id = auth.uid() or teaches_student(student_id) or is_guardian_of(student_id) or is_admin());

-- 생성: 학생 본인, 또는 담당 교사/관리자(학생 대신 만들어 줄 수 있음).
create policy "본인 학생/담당 선생님/관리자 생성" on board_manual_tasks for insert
  with check (
    (student_id = auth.uid() and created_by = auth.uid())
    or teaches_student(student_id)
    or is_admin()
  );

-- 수정·삭제: 학생 본인(자기 보드니까 교사가 만든 항목도 완료 처리·삭제 가능),
-- 담당 교사, 관리자.
create policy "본인 학생/담당 선생님/관리자 수정" on board_manual_tasks for update
  using (student_id = auth.uid() or teaches_student(student_id) or is_admin())
  with check (student_id = auth.uid() or teaches_student(student_id) or is_admin());
create policy "본인 학생/담당 선생님/관리자 삭제" on board_manual_tasks for delete
  using (student_id = auth.uid() or teaches_student(student_id) or is_admin());

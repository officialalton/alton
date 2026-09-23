-- 로드맵 프로필 확장(2026-09-22 사용자 지시) —
-- 1) "수강 과목"을 개수 입력이 아니라 과목별 목록(추가/수정/삭제)으로.
-- 2) "목표 설정"(목표 GPA/SAT/AP 과목수/Extracurricular) — 목표 학교는 기존
--    student_college_interests.target_colleges를 그대로 재사용한다(중복 저장 안 함).

create table student_courses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  course_name text not null,
  status text not null check (status in ('taking', 'completed')),
  score text,
  academic_year integer,
  grade_level text,
  created_at timestamptz not null default now()
);
create index on student_courses (student_id);

comment on table student_courses is
  '2026-09-22 — "1B. 교육과정·수강과목" 개수 입력을 대체하는 과목별 목록(추가/수정/삭제). score는 자유 텍스트(학점제·백분위 등 학교마다 다른 채점 방식을 그대로 담기 위함).';

alter table student_courses enable row level security;
create policy "학생/교사/보호자/컨설턴트/관리자 조회" on student_courses for select using (_roadmap_can_read(student_id));
create policy "학생/보호자/컨설턴트/관리자 추가" on student_courses for insert with check (_roadmap_can_write(student_id));
create policy "학생/보호자/컨설턴트/관리자 수정" on student_courses for update using (_roadmap_can_write(student_id));
create policy "학생/보호자/컨설턴트/관리자 삭제" on student_courses for delete using (_roadmap_can_write(student_id));

alter table student_academic_profile add column if not exists target_gpa numeric;
alter table student_academic_profile add column if not exists target_sat integer;
alter table student_academic_profile add column if not exists target_ap_count integer;
alter table student_academic_profile add column if not exists target_extracurricular text;

comment on column student_academic_profile.target_gpa is '2026-09-22 — "목표 설정" 서브탭. 목표 학교는 student_college_interests.target_colleges 재사용, 목표 SAT는 student_test_records(kind=target)로도 낼 수 있으나 이 컬럼은 "목표 설정" 화면 전용 요약 입력.';

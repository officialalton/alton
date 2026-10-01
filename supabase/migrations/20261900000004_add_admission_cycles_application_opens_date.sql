-- university_admission_cycles.application_opens_date는 local dev DB에만 raw SQL로
-- 추가돼 있었고 migration 파일이 없었다(2026-09-24 발견) — non-prod에 반영하기 위해
-- 정식 additive migration으로 등록.
alter table university_admission_cycles
  add column if not exists application_opens_date date;

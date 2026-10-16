-- Student Success Planner Board 개선(2026-09-22 사용자 지시) — 수동 할 일에
-- 기간(시작~마감) 입력을 추가한다(시간 입력 없이 날짜만). 기존 due_at은
-- "마감일(끝)" 의미를 그대로 유지하고, due_start_at은 nullable로 추가해
-- 있으면 기간으로, 없으면 단일 마감일로 보여준다(타임라인뷰 대비 데이터
-- 선반영 — 뷰 자체는 다음 라운드).
alter table board_manual_tasks add column if not exists due_start_at timestamptz;

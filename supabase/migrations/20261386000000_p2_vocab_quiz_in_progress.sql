-- 2026-09-16 — 단어 시험 "계속 풀기/다시 풀기" 지원. 지금까지는 다 풀어야만(제출) 오답이 오답
-- 노트에 반영됐다 — 도중에 나가면 아무 것도 저장되지 않았다. status에 'in_progress'를 추가해
-- 진행 중 저장(부분 답안 + 그 시점까지의 오답 노트 반영)을 표현한다.
set row_security = off;

alter table vocab_quizzes drop constraint vocab_quizzes_status_check;
alter table vocab_quizzes add constraint vocab_quizzes_status_check check (status = any (array['pending', 'in_progress', 'completed']));

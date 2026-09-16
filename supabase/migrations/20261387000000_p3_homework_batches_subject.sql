-- 2026-09-16 — 과제 배치 이름 정책 변경: "9월 16일 과제" 대신 "9월 16일 {과목} {선생님명}"으로
-- 표시한다. 배치가 어느 과목에 속하는지 알아야 하므로 subject_id를 저장한다(발급에 쓴 키워드들이
-- 속한 과목 — 기존 배치는 NULL로 남고 화면에서 과목 없이 표시된다).
set row_security = off;

alter table homework_batches add column subject_id uuid references subjects (id);
create index on homework_batches (subject_id);

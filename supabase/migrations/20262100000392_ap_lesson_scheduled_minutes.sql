-- 2026-10-08 — 표준 수업권 = 120분 예약(수업 110 + 휴식 10). est_minutes = 수업 분(부하 계산), scheduled_minutes = 예약 길이.
-- additive·재실행 안전. 380/390/391 파일은 수정하지 않는다. 롤백(참고, 적용 금지): 컬럼 drop.
alter table subject_template_units add column if not exists scheduled_minutes int;
comment on column subject_template_units.scheduled_minutes is '예약 길이(분). compact 표준 수업권 120 = 수업 est_minutes 110 + 휴식 10. null = est_minutes 와 같음.';

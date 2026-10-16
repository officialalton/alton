-- 2026-10-08 — AP 회차 컴팩트 과정. 390 위에 additive(390 파일은 수정하지 않는다). 설계: docs/ap/curriculum-keyword-design.md 15절.
-- track_set: 회차가 속한 과정(compact=기본 / full=전체 50분 과정). depth: 키워드를 충분히(core) 가르치는지, 개요·예제 수준(light)인지.
-- 롤백(참고, 적용 금지): 아래 컬럼·제약 drop.
alter table subject_template_units add column if not exists track_set text;
alter table subject_template_unit_keywords add column if not exists depth text not null default 'core';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'subject_template_units_track_set_check') then
    alter table subject_template_units add constraint subject_template_units_track_set_check check (track_set is null or track_set in ('compact', 'full'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'subject_template_unit_keywords_depth_check') then
    alter table subject_template_unit_keywords add constraint subject_template_unit_keywords_depth_check check (depth in ('core', 'light'));
  end if;
end $$;
-- 390 시드(81회 전체 과정)는 모두 full 과정이다.
update subject_template_units set track_set = 'full' where lesson_kind is not null and track_set is null;
comment on column subject_template_units.track_set is 'AP 회차 과정: compact(기본, 긴 회차·light 압축) | full(50분 전체 과정).';

-- 2026-10-08 — AP 회차(lesson-level) 템플릿. 설계: docs/ap/curriculum-keyword-design.md 14절.
-- 원인: 380 시드가 CED 단원(8개)을 subject_template_units(=회차)로 넣고 토픽만 연결했다. 회차 = 템플릿 행이므로 8회차만 보였다.
-- 수정: 템플릿 행 = 50분 수업 회차. CED 단원은 키워드 폴더(+ ced_unit_code)로만 남는다.
-- additive·재실행 안전. 기존 SAT 회차·연결은 불변(새 컬럼은 null / 기본 'primary').
-- 롤백(적용 금지, 참고): delete from subject_template_units where lesson_kind is not null; 그다음 아래 컬럼·인덱스 drop.
alter table subject_template_units add column if not exists lesson_kind text;      -- content | unit_review | exam_prep (null = 일반 회차)
alter table subject_template_units add column if not exists ced_unit_code text;    -- 소속 CED 단원 번호(키워드 폴더 official_code 와 같은 값)
alter table subject_template_units add column if not exists est_minutes int;
alter table subject_template_units add column if not exists track text;            -- core(빠른 과정 포함) | full(전체 과정만)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'subject_template_units_lesson_kind_check') then
    alter table subject_template_units add constraint subject_template_units_lesson_kind_check
      check (lesson_kind is null or lesson_kind in ('content', 'unit_review', 'exam_prep'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'subject_template_units_track_check') then
    alter table subject_template_units add constraint subject_template_units_track_check
      check (track is null or track in ('core', 'full'));
  end if;
end $$;
comment on column subject_template_units.lesson_kind is 'AP 회차 종류. content=새 내용, unit_review=단원 복습·혼합 연습, exam_prep=시험 직전 누적 단계.';

-- 회차-키워드 연결의 역할: 키워드는 정확히 한 회차에서만 primary(처음 가르치는 곳), 이어서 다루면 continued, 복습이면 review.
alter table subject_template_unit_keywords add column if not exists role text not null default 'primary';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'subject_template_unit_keywords_role_check') then
    alter table subject_template_unit_keywords add constraint subject_template_unit_keywords_role_check
      check (role in ('primary', 'continued', 'review'));
  end if;
end $$;
-- 같은 키워드가 두 회차에서 primary 가 되는 것을 DB가 막는다. 기존(SAT 등) 행은 기본 role='primary' 라서 이미 중복이 있을 수 있으므로
-- AP 시드 행만(회차가 lesson_kind 를 가진 것) 대상으로 하는 트리거로 건다(부분 인덱스는 조인을 못 쓴다).
create or replace function subject_unit_keywords_single_primary() returns trigger
language plpgsql as $$
begin
  if new.role = 'primary'
     and exists (select 1 from subject_template_units u where u.id = new.unit_id and u.lesson_kind is not null)
     and exists (
       select 1 from subject_template_unit_keywords k
       join subject_template_units u2 on u2.id = k.unit_id and u2.lesson_kind is not null
       where k.keyword_id = new.keyword_id and k.role = 'primary' and k.unit_id <> new.unit_id) then
    raise exception 'ap_keyword_single_primary: keyword % already has a primary lesson', new.keyword_id;
  end if;
  return new;
end $$;
drop trigger if exists subject_unit_keywords_single_primary on subject_template_unit_keywords;
create trigger subject_unit_keywords_single_primary before insert or update on subject_template_unit_keywords
  for each row execute function subject_unit_keywords_single_primary();

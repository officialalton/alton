-- P2 13차 정정 — Drive 교재 구조는 **과목 → 키워드 → 파일**이다.
--
-- 2026-09-14 제품 오너: "앞서 전달한 '과목 → 단원 → 키워드' 폴더 구조와 키워드의 단일 단원
-- 소속 지시는 대체합니다." 키워드는 과목 안에서 관리하고, 같은 과목의 여러 단원·회차·보강에
-- 연결된다(기존 N:M subject_template_unit_keywords 그대로). 단원·회차를 만들 때 Drive 폴더를
-- 만들지 않는다. 다른 단원에서 쓴다고 키워드나 원본을 복제하지 않는다.
--
-- 20261348000000 이 만든 것 중 바꾸는 것:
--   subject_keywords.unit_id            더 이상 쓰지 않는다. 컬럼은 남긴다(데이터 보존) — 값은 무시.
--   subject_keywords_needing_unit        전환 대상 뷰 — 삭제(단일 소속이 요구가 아니다).
--   단원 폴더 큐 트리거                   삭제. 이미 큐에 든 unit 행은 'retired' 로 표시하고
--                                        drive_folder_id 는 보존한다(Drive 폴더는 지우지 않는다).
--   키워드 폴더의 상위                    단원 폴더 → 과목 폴더(앱의 계획기가 바뀐다).

-- 1. 단일 단원 소속 제약 해제
drop trigger if exists subject_keywords_check_unit_subject on subject_keywords;
drop function if exists public.subject_keywords_check_unit_subject();
drop view if exists public.subject_keywords_needing_unit;

comment on column subject_keywords.unit_id is
  '2026-09-14 정정으로 **사용하지 않는다.** 키워드는 과목 안에서 여러 단원·회차에 연결된다'
  '(subject_template_unit_keywords). 값이 있어도 무시하며, 새로 채우지 않는다.';

-- 2. 단원 폴더는 만들지 않는다
drop trigger if exists subject_template_units_enqueue_drive_folder on subject_template_units;
drop function if exists public.units_enqueue_drive_folder();

-- 키워드 큐는 이름이 바뀔 때만(unit_id 변경은 더 이상 의미가 없다).
drop trigger if exists subject_keywords_enqueue_drive_folder on subject_keywords;
create trigger subject_keywords_enqueue_drive_folder
  after insert or update of label on subject_keywords
  for each row execute function public.keywords_enqueue_drive_folder();

-- 3. 이미 큐에 든 단원 폴더 행 — 지우지 않고 물러나게 한다
alter table curriculum_drive_folders drop constraint if exists curriculum_drive_folders_sync_status_check;
alter table curriculum_drive_folders
  add constraint curriculum_drive_folders_sync_status_check
  check (sync_status in ('pending', 'created', 'rename_pending', 'failed', 'retired'));

update curriculum_drive_folders
set sync_status = 'retired', updated_at = now()
where scope = 'unit';

comment on table curriculum_drive_folders is
  'P2 13차(정정): ALTON 분류 ↔ Drive 폴더(id). 구조는 **과목 → 키워드**. ALTON 이 기준이고 '
  '단방향(ALTON → Drive). retired = 예전 구조(단원 폴더)로 만들어졌거나 계획됐던 행 — Drive 폴더는 '
  '지우지 않고 참조만 남긴다. 전환은 사람이 확인한 뒤 한다.';

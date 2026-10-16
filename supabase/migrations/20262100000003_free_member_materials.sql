-- =========================================================================
-- 2026-10-05 무료 학습 회원 S3 — 자료(교재) 무료 공개
--   docs/briefs/2026-10-05-free-member-tutoring-design.md §1.4·§2.1(materials_free)·§4.4
--
-- 추가만 한다(기존 행은 전부 tutoring + needs_review, 기존 열람 권한 변화 0):
--   1) curriculum_docs.access_tier('tutoring'|'free') / rights_status('confirmed'|'needs_review'|'restricted')
--      / rights_note / rights_confirmed_by / rights_confirmed_at
--      CHECK: access_tier='free' ⇒ rights_status='confirmed' (권리 미확인 자료의 무료 지정을 DB가 거절)
--   2) 보호 트리거: access_tier·rights_* 변경은 관리자만(교사 소유자의 UPDATE 정책 우회 차단).
--      rights_status가 'confirmed'로 바뀌면 확인자·시각을 DB가 기록, 아니게 되면 비운다.
--   3) 감사 테이블 curriculum_doc_access_changes — access_tier/rights_status 변경을 AFTER 트리거가 기록
--      (INSERT-only, 관리자 조회). 기존 교재 감사 테이블이 없어 새로 만든다(document_access_events 패턴).
--   4) RLS: curriculum_docs SELECT 정책에 "published ∧ free ∧ 활성 학생" 절 추가.
--      curriculum_doc_sections 정책은 지금까지 문서 조건을 **복사**해 두고 있어 자동 상속이 아니었다 —
--      curriculum_doc_versions("교재를 볼 수 있으면 그 버전도")와 같은 방식으로 상위 문서 RLS를
--      그대로 따르게 바꾼다(조건 복사본과 의미 동일, 앞으로의 문서 정책 변경도 자동 반영).
--   5) curriculum-assets 버킷은 비공개 유지(storage.objects 정책 변경 없음) — 파일은 여전히
--      getAssetVersionUrlAction(버전 행 RLS 통과 후 서명 URL)로만 열린다.
-- =========================================================================

-- 1) 컬럼·제약 ---------------------------------------------------------------
alter table curriculum_docs
  add column if not exists access_tier text not null default 'tutoring',
  add column if not exists rights_status text not null default 'needs_review',
  add column if not exists rights_note text,
  add column if not exists rights_confirmed_by uuid references profiles (id) on delete set null,
  add column if not exists rights_confirmed_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'curriculum_docs_access_tier_check') then
    alter table curriculum_docs add constraint curriculum_docs_access_tier_check
      check (access_tier in ('tutoring', 'free'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'curriculum_docs_rights_status_check') then
    alter table curriculum_docs add constraint curriculum_docs_rights_status_check
      check (rights_status in ('confirmed', 'needs_review', 'restricted'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'curriculum_docs_free_requires_confirmed_rights') then
    alter table curriculum_docs add constraint curriculum_docs_free_requires_confirmed_rights
      check (access_tier <> 'free' or rights_status = 'confirmed');
  end if;
end $$;

create index if not exists curriculum_docs_free_published_idx
  on curriculum_docs (subject_id) where access_tier = 'free' and status = 'published';

comment on column curriculum_docs.access_tier is
  '2026-10-05 무료 회원 공개 여부. free=활성 학생 누구나(무료 회원 포함) 열람, tutoring=수강 관계자만. free는 rights_status=confirmed일 때만 가능(CHECK).';
comment on column curriculum_docs.rights_status is
  '저작권·사용권 확인 상태. confirmed=자체 제작/권리 확인됨, needs_review=미확인(기본), restricted=외부 자료 등 공개 불가.';
comment on column curriculum_docs.rights_confirmed_by is 'rights_status를 confirmed로 바꾼 관리자(트리거가 기록).';

-- 2) 보호 트리거(관리자만, 확인자·시각 기록) ---------------------------------------
create or replace function public.curriculum_docs_guard_access_tier()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  -- INSERT는 기본값(tutoring/needs_review/note 없음)이 아닐 때만 관리자 검사(교사 생성 정책 유지).
  v_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_changed := new.access_tier <> 'tutoring' or new.rights_status <> 'needs_review' or new.rights_note is not null;
  else
    v_changed := new.access_tier is distinct from old.access_tier
      or new.rights_status is distinct from old.rights_status
      or new.rights_note is distinct from old.rights_note;
  end if;
  if not v_changed then
    return new;
  end if;
  -- auth.uid() null = service_role/마이그레이션/시드. 사용자 세션이면 관리자만.
  if auth.uid() is not null and not is_admin() then
    raise exception '무료 공개·권리 상태는 관리자만 바꿀 수 있습니다.';
  end if;
  if new.rights_status = 'confirmed' then
    if tg_op = 'INSERT' or old.rights_status is distinct from 'confirmed' then
      new.rights_confirmed_by := coalesce(auth.uid(), new.rights_confirmed_by);
      new.rights_confirmed_at := now();
    end if;
  else
    new.rights_confirmed_by := null;
    new.rights_confirmed_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists curriculum_docs_guard_access_tier on curriculum_docs;
create trigger curriculum_docs_guard_access_tier
  before insert or update of access_tier, rights_status, rights_note on curriculum_docs
  for each row execute function public.curriculum_docs_guard_access_tier();

-- 3) 감사(INSERT-only) ------------------------------------------------------------
create table if not exists curriculum_doc_access_changes (
  id uuid primary key default gen_random_uuid(),
  -- 문서가 지워져도 "누가 공개했다"는 사실은 남아야 하므로 FK를 걸지 않는다.
  curriculum_doc_id uuid not null,
  actor_id uuid,
  old_access_tier text,
  new_access_tier text not null,
  old_rights_status text,
  new_rights_status text not null,
  rights_note text,
  created_at timestamptz not null default now()
);
create index if not exists curriculum_doc_access_changes_doc_idx
  on curriculum_doc_access_changes (curriculum_doc_id, created_at desc);
alter table curriculum_doc_access_changes enable row level security;
drop policy if exists "관리자만 조회" on curriculum_doc_access_changes;
create policy "관리자만 조회" on curriculum_doc_access_changes for select using (is_admin());
-- insert/update/delete 정책 없음 = 트리거(security definer)만 기록.
comment on table curriculum_doc_access_changes is
  '2026-10-05 교재 무료 공개(access_tier)·권리 상태(rights_status) 변경 감사. INSERT-only, 트리거가 기록, actor_id=auth.uid()(null=서비스 롤).';

create or replace function public.curriculum_docs_audit_access_change()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and new.access_tier is not distinct from old.access_tier
     and new.rights_status is not distinct from old.rights_status then
    return null;
  end if;
  if tg_op = 'INSERT' and new.access_tier = 'tutoring' and new.rights_status = 'needs_review' then
    return null; -- 기본값 그대로의 신규 행은 기록하지 않는다(소음 방지).
  end if;
  insert into curriculum_doc_access_changes
    (curriculum_doc_id, actor_id, old_access_tier, new_access_tier, old_rights_status, new_rights_status, rights_note)
  values
    (new.id, auth.uid(),
     case when tg_op = 'UPDATE' then old.access_tier end, new.access_tier,
     case when tg_op = 'UPDATE' then old.rights_status end, new.rights_status,
     new.rights_note);
  return null;
end;
$$;
drop trigger if exists curriculum_docs_audit_access_change on curriculum_docs;
create trigger curriculum_docs_audit_access_change
  after insert or update of access_tier, rights_status on curriculum_docs
  for each row execute function public.curriculum_docs_audit_access_change();

-- 4) RLS ----------------------------------------------------------------------
-- 기존 20261267000000 정책 + 무료 공개 절. 학생 본인 행이 active일 때만(정지·대기 계정 제외).
drop policy if exists "배포된 문서는 관련자, 초안은 작성자/관리자만" on curriculum_docs;
create policy "배포된 문서는 관련자, 초안은 작성자/관리자만" on curriculum_docs for select
  using (
    is_admin()
    or owner_teacher_id = auth.uid()
    or (
      status = 'published'
      and (
        exists (
          select 1 from enrollments e
          where e.subject_id = curriculum_docs.subject_id
            and (
              e.student_id = auth.uid()
              or e.teacher_id = auth.uid()
              or is_guardian_of(e.student_id)
            )
        )
        or exists (
          select 1 from subject_enrollments se
          where se.subject_id = curriculum_docs.subject_id
            and (
              se.child_id = auth.uid()
              or is_guardian_of(se.child_id)
              or exists (
                select 1 from teacher_assignments ta
                where ta.subject_enrollment_id = se.id and ta.teacher_id = auth.uid()
              )
            )
        )
        -- 2026-10-05 S3: 무료 공개 자료는 활성 학생 누구나(무료 회원 포함).
        or (
          access_tier = 'free'
          and exists (select 1 from students s where s.id = auth.uid() and s.status = 'active')
        )
      )
    )
  );

-- 섹션은 상위 문서 RLS를 그대로 따른다(조건 복사본 제거 — versions 정책과 같은 방식).
drop policy if exists "상위 문서 규칙 상속" on curriculum_doc_sections;
create policy "상위 문서 규칙 상속" on curriculum_doc_sections for select
  using (exists (select 1 from curriculum_docs d where d.id = curriculum_doc_sections.curriculum_doc_id));

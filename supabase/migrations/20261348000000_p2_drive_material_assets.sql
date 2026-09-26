-- P2 13차 — Drive 기반 PDF·영상 교재의 최소 구조.
--
-- 2026-09-14 제품 오너: 자체 HTML 편집기의 추가 개발을 줄이고, 외부에서 만든
-- PDF·영상을 Google Drive에 올려 ALTON이 가져와 분류·순서·공개 버전을 관리한다.
-- 구조는 과목 → 단원 → 키워드 → 자료(파일 하나 = 자료 한 건 = 대표 키워드 하나).
--
-- 기존 것을 부수지 않는다. HTML 교재와 그 필기·과거 수업은 그대로다. 파일 자료는
-- **curriculum_docs 의 한 종류(kind)**로 둔다 — 그래야 회차 구성·상속·수업 시작
-- 고정(session_content_manifest + curriculum_doc_version_id)·미리보기가 전부 그대로
-- 통한다. 다른 것은 "내용이 어디에 있나"뿐이다: HTML 은 섹션 표에, 파일은 공개 시점에
-- 확보한 **고정 사본**(Storage)에 있고 그 참조가 버전 스냅샷에 담긴다.

-- =========================================================================
-- 1. 교재의 종류와 Drive 출처
-- =========================================================================
alter table curriculum_docs
  add column kind text not null default 'html'
    check (kind in ('html', 'pdf', 'video')),
  add column source_drive_file_id text,
  add column source_drive_name text,
  add column source_mime_type text,
  add column source_drive_modified_time timestamptz;

-- 같은 Drive 파일을 두 번 등록하지 않는다.
create unique index curriculum_docs_source_drive_file_id_key
  on curriculum_docs (source_drive_file_id) where source_drive_file_id is not null;

comment on column curriculum_docs.kind is
  'P2 13차: html = 섹션 표에 본문이 있는 기존 교재. pdf/video = Drive 에서 가져온 파일 '
  '자료 — 본문은 없고, 공개 시점의 고정 사본 참조가 버전 스냅샷(asset)에 담긴다.';
comment on column curriculum_docs.source_drive_file_id is
  'P2 13차: 원본 Drive 파일 id(이름이 아니라 id). 원본은 수정될 수 있는 보관 장소일 뿐이고 '
  '학생에게 가는 내용은 공개 버전의 고정 사본이다. 파일 하나 = 자료 한 건(unique).';

-- =========================================================================
-- 2. 키워드는 단원 하나에 속한다
-- =========================================================================
-- 지금 키워드는 과목에만 속하고 단원과는 N:M(subject_template_unit_keywords)이다.
-- 새 정책: 키워드 → 단원 하나. 다른 단원에서 같은 뜻이 필요하면 별도 키워드다.
-- 기존 키워드의 단원 소속은 **임의로 정하지 않는다** — null 로 두고 전환 대상으로
-- 기록한다(아래 뷰). 새 키워드는 앱이 단원을 요구한다.
alter table subject_keywords
  add column unit_id uuid references subject_template_units (id) on delete set null;
create index on subject_keywords (unit_id);

create or replace function public.subject_keywords_check_unit_subject()
returns trigger language plpgsql as $$
declare
  v_unit_subject uuid;
begin
  if new.unit_id is null then
    return new;
  end if;
  select subject_id into v_unit_subject from subject_template_units where id = new.unit_id;
  if v_unit_subject is null then
    raise exception '존재하지 않는 단원입니다.';
  end if;
  if v_unit_subject <> new.subject_id then
    raise exception '키워드와 단원은 같은 과목이어야 합니다.';
  end if;
  return new;
end;
$$;
drop trigger if exists subject_keywords_check_unit_subject on subject_keywords;
create trigger subject_keywords_check_unit_subject
  before insert or update of unit_id, subject_id on subject_keywords
  for each row execute function public.subject_keywords_check_unit_subject();

comment on column subject_keywords.unit_id is
  'P2 13차: 이 키워드가 속한 단원(하나). null 은 아직 소속을 정하지 않은 기존 키워드 — '
  '전환 대상이다(subject_keywords_needing_unit). 자동으로 채우지 않는다.';

create or replace view public.subject_keywords_needing_unit
with (security_invoker = true) as
select k.id as keyword_id, k.subject_id, k.label,
       -- 지금 N:M 연결로 붙어 있는 단원 수. 1이면 그 단원으로 옮기면 될 가능성이
       -- 높고, 2 이상이면 사람이 갈라야 한다. 0이면 아무 단원에도 없다.
       (select count(*) from subject_template_unit_keywords l where l.keyword_id = k.id) as linked_unit_count,
       (select l.unit_id from subject_template_unit_keywords l where l.keyword_id = k.id
        order by l.unit_id limit 1) as candidate_unit_id
from subject_keywords k
where k.unit_id is null and k.status = 'active';

comment on view public.subject_keywords_needing_unit is
  'P2 13차: 단원 소속이 정해지지 않은 키워드(전환 대상). 자동으로 옮기지 않는다 — 사람이 '
  '확인해 정한다. linked_unit_count 가 1이면 후보가 분명하고, 2 이상이면 별도 키워드로 갈라야 한다.';

-- =========================================================================
-- 3. Drive 폴더 대응표 — ALTON 분류가 기준, 폴더는 id로 연결
-- =========================================================================
-- 과목·단원·키워드 하나에 폴더 하나. 실제 Drive 쓰기는 앱의 처리기가 플래그
-- (CURRICULUM_DRIVE_ALLOW_REAL_WRITES)가 켜졌을 때만 한다. 여기서는 "만들어야 할
-- 것 / 이름을 바꿔야 할 것"을 **큐로만** 남긴다. 보관은 삭제로 이어지지 않는다.
create table curriculum_drive_folders (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('subject', 'unit', 'keyword')),
  ref_id uuid not null,
  -- 마지막으로 Drive 에 반영했거나 반영해야 할 이름.
  desired_name text not null,
  applied_name text,
  drive_folder_id text unique,
  sync_status text not null default 'pending'
    check (sync_status in ('pending', 'created', 'rename_pending', 'failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, ref_id)
);

comment on table curriculum_drive_folders is
  'P2 13차: ALTON 분류(과목·단원·키워드) ↔ Drive 폴더(id). ALTON 이 기준이고 첫 버전은 '
  '단방향(ALTON → Drive)이다. pending/rename_pending 은 아직 Drive 에 반영되지 않은 것, '
  'failed 는 사유와 함께 재시도 대상. 폴더는 이름이 아니라 id 로 연결한다.';

alter table curriculum_drive_folders enable row level security;
create policy "관리자만 Drive 폴더 대응표" on curriculum_drive_folders for all
  using (is_admin()) with check (is_admin());

-- 분류가 생기거나 이름이 바뀌면 큐에 넣는다. Drive 는 건드리지 않는다.
create or replace function public.enqueue_curriculum_drive_folder(
  p_scope text, p_ref_id uuid, p_name text
)
returns void language plpgsql as $$
begin
  insert into curriculum_drive_folders (scope, ref_id, desired_name)
  values (p_scope, p_ref_id, p_name)
  on conflict (scope, ref_id) do update
    set desired_name = excluded.desired_name,
        -- 이미 만들어진 폴더의 이름이 달라졌으면 이름 변경 대기. 아직 안 만든 것은
        -- 그대로 pending 으로 두면 만들 때 새 이름을 쓴다.
        sync_status = case
          when curriculum_drive_folders.drive_folder_id is not null
               and curriculum_drive_folders.applied_name is distinct from excluded.desired_name
            then 'rename_pending'
          when curriculum_drive_folders.drive_folder_id is null then 'pending'
          else curriculum_drive_folders.sync_status
        end,
        updated_at = now();
end;
$$;

create or replace function public.subjects_enqueue_drive_folder()
returns trigger language plpgsql as $$
begin
  perform public.enqueue_curriculum_drive_folder('subject', new.id, new.name);
  return null;
end;
$$;
drop trigger if exists subjects_enqueue_drive_folder on subjects;
create trigger subjects_enqueue_drive_folder
  after insert or update of name on subjects
  for each row execute function public.subjects_enqueue_drive_folder();

create or replace function public.units_enqueue_drive_folder()
returns trigger language plpgsql as $$
begin
  perform public.enqueue_curriculum_drive_folder('unit', new.id, new.unit_title);
  return null;
end;
$$;
drop trigger if exists subject_template_units_enqueue_drive_folder on subject_template_units;
create trigger subject_template_units_enqueue_drive_folder
  after insert or update of unit_title on subject_template_units
  for each row execute function public.units_enqueue_drive_folder();

create or replace function public.keywords_enqueue_drive_folder()
returns trigger language plpgsql as $$
begin
  perform public.enqueue_curriculum_drive_folder('keyword', new.id, new.label);
  return null;
end;
$$;
drop trigger if exists subject_keywords_enqueue_drive_folder on subject_keywords;
create trigger subject_keywords_enqueue_drive_folder
  after insert or update of label, unit_id on subject_keywords
  for each row execute function public.keywords_enqueue_drive_folder();

-- 트리거는 호출자 권한으로 돈다. 선생님·학생이 과목 이름을 바꾸는 일은 없지만, 큐
-- 삽입이 RLS 에 걸려 본래 작업까지 실패하면 안 되므로 함수만 definer 로 둔다.
alter function public.enqueue_curriculum_drive_folder(text, uuid, text)
  security definer set search_path = public;
revoke execute on function public.enqueue_curriculum_drive_folder(text, uuid, text) from public, anon;

-- 이미 있는 분류도 큐에 넣는다(Drive 는 건드리지 않는다).
insert into curriculum_drive_folders (scope, ref_id, desired_name)
select 'subject', id, name from subjects
on conflict do nothing;
insert into curriculum_drive_folders (scope, ref_id, desired_name)
select 'unit', id, unit_title from subject_template_units
on conflict do nothing;
insert into curriculum_drive_folders (scope, ref_id, desired_name)
select 'keyword', id, label from subject_keywords where status = 'active'
on conflict do nothing;

-- =========================================================================
-- 4. 고정 사본 저장소 — 비공개 버킷
-- =========================================================================
-- 회사 문서·계약·교사 제출 서류 저장소(teacher-documents 등)와 합치지 않는다.
-- 경로 규칙: <curriculum_doc_id>/<version_id>.<ext>. 클라이언트가 직접 읽지 않는다 —
-- 서버가 교재 열람 권한(curriculum_docs RLS)을 확인한 뒤 짧은 서명 URL 을 준다.
insert into storage.buckets (id, name, public)
values ('curriculum-assets', 'curriculum-assets', false)
on conflict (id) do nothing;

create policy "관리자만 교재 고정 사본 직접 조회" on storage.objects for select
  using (bucket_id = 'curriculum-assets' and is_admin());
-- 업로드·삭제는 service_role(서버 액션)만 — 공개 성공과 사본 확보가 짝이어야 한다.

-- =========================================================================
-- 5. 파일 자료의 공개 — 고정 사본이 있어야만 공개다
-- =========================================================================
-- 서버 액션이 (1) Drive 에서 내려받아 (2) Storage 에 올린 뒤 (3) 이 함수를 부른다.
-- (2) 가 실패하면 (3) 은 불리지 않는다. 이 함수는 사본 참조가 온전한지 확인하고
-- 버전 행과 공개 상태를 한 트랜잭션으로 바꾼다. 같은 내용(sha256)이면 새 버전을
-- 만들지 않는다 — HTML 의 publish_curriculum_doc 과 같은 규칙.
create or replace function public.publish_curriculum_asset_doc(p_doc_id uuid, p_asset jsonb)
returns uuid
language plpgsql
as $$
declare
  v_kind text;
  v_title text;
  v_subject uuid;
  v_unit uuid;
  v_latest_id uuid;
  v_latest_sha text;
  v_version_id uuid;
  v_page_count int;
begin
  if not is_admin() then
    raise exception '관리자만 교재를 공개할 수 있습니다.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_doc_id::text, 77));

  select kind, title, subject_id, unit_id
    into v_kind, v_title, v_subject, v_unit
  from curriculum_docs where id = p_doc_id;
  if v_kind is null then
    raise exception '존재하지 않는 교재입니다.';
  end if;
  if v_kind = 'html' then
    raise exception 'HTML 교재는 publish_curriculum_doc 으로 공개합니다.';
  end if;

  if jsonb_typeof(p_asset) is distinct from 'object'
     or coalesce(p_asset->>'bucket', '') = ''
     or coalesce(p_asset->>'path', '') = ''
     or coalesce(p_asset->>'sha256', '') = ''
     or coalesce(p_asset->>'mimeType', '') = ''
     or (p_asset->>'bytes') is null then
    raise exception '고정 사본 참조(bucket, path, bytes, sha256, mimeType)가 온전하지 않습니다.';
  end if;
  if v_kind = 'pdf' then
    v_page_count := (p_asset->>'pageCount')::int;
    if v_page_count is null or v_page_count < 1 then
      raise exception 'PDF 는 페이지 수(pageCount ≥ 1)가 있어야 합니다.';
    end if;
  end if;

  select id, snapshot->'asset'->>'sha256' into v_latest_id, v_latest_sha
  from curriculum_doc_versions
  where curriculum_doc_id = p_doc_id
  order by version_number desc
  limit 1;

  if v_latest_sha is not null and v_latest_sha = (p_asset->>'sha256') then
    v_version_id := v_latest_id;
  else
    insert into curriculum_doc_versions (curriculum_doc_id, version_number, snapshot, created_by)
    values (
      p_doc_id,
      public.next_curriculum_doc_version_number(p_doc_id),
      jsonb_build_object(
        'docId', p_doc_id,
        'title', v_title,
        'subjectId', v_subject,
        'unitId', v_unit,
        'capturedAt', now(),
        'kind', v_kind,
        'sections', '[]'::jsonb,
        'asset', p_asset
      ),
      auth.uid()
    )
    returning id into v_version_id;
  end if;

  update curriculum_docs set status = 'published' where id = p_doc_id;
  return v_version_id;
end;
$$;

comment on function public.publish_curriculum_asset_doc(uuid, jsonb) is
  'P2 13차: PDF·영상 자료를 공개한다. 고정 사본 참조가 온전해야 하고(서버가 Storage 에 올린 뒤 '
  '부른다), 그 참조를 담은 버전 행과 공개 상태를 한 트랜잭션으로 만든다. 내용(sha256)이 직전 '
  '버전과 같으면 새 버전을 만들지 않는다. 원본 Drive 파일이 바뀌거나 지워져도 이 버전과 과거 '
  '수업은 그대로다.';

revoke execute on function public.publish_curriculum_asset_doc(uuid, jsonb) from public, anon;
grant execute on function public.publish_curriculum_asset_doc(uuid, jsonb) to authenticated, service_role;

-- 상태 변경 트리거는 HTML 스냅샷을 뜬다. 파일 자료에는 그 스냅샷(빈 섹션)이 붙으면
-- 그것이 "최신 버전"이 되어 고정 사본 참조를 가린다. 파일 자료는 위 함수만 버전을 만든다.
create or replace function public.curriculum_docs_capture_on_publish()
returns trigger
language plpgsql as $$
begin
  if new.kind <> 'html' then
    return null;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform public.capture_curriculum_doc_version(new.id, 'publish', null);
  end if;
  return null;
end;
$$;

-- 공개 버전의 내용은 그 교재를 볼 수 있는 사람이 읽는다.
--
-- 지금까지 curriculum_doc_versions 는 작성자·관리자만 읽을 수 있었다. 그런데 수업 화면은
-- 고정된 버전의 스냅샷을 **학생·보호자 권한으로** 읽는다(loadPinnedMaterialData) — 그 조회가
-- 비어 "보존된 내용이 없다"로 보였다. 교재 자체를 볼 수 있으면(curriculum_docs RLS:
-- 배포된 문서는 관련자 전체) 그 버전도 읽는다. 초안 교재의 버전은 여전히 작성자·관리자만.
create policy "교재를 볼 수 있으면 그 버전도 조회" on curriculum_doc_versions for select
  using (exists (select 1 from curriculum_docs d where d.id = curriculum_doc_versions.curriculum_doc_id));

-- HTML 공개 경로는 파일 자료를 받지 않는다 — 스냅샷에 본문이 없어 빈 교재가 공개된다.
create or replace function public.publish_curriculum_doc(
  p_doc_id uuid,
  p_published boolean
)
returns uuid
language plpgsql
as $$
declare
  v_was_published boolean;
  v_kind text;
  v_version_id uuid;
  v_latest_id uuid;
  v_latest_snapshot jsonb;
  v_current_snapshot jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_doc_id::text, 77));

  select status = 'published', kind into v_was_published, v_kind
  from curriculum_docs where id = p_doc_id;

  if v_was_published is null then
    raise exception '존재하지 않는 교재입니다.';
  end if;

  if p_published and v_kind <> 'html' then
    raise exception '파일 자료(PDF·영상)는 고정 사본을 확보하는 공개 경로로만 공개할 수 있습니다.';
  end if;

  update curriculum_docs
  set status = (case when p_published then 'published' else 'draft' end)::doc_status
  where id = p_doc_id;

  if not p_published then
    return null;
  end if;

  select id, snapshot into v_latest_id, v_latest_snapshot
  from curriculum_doc_versions
  where curriculum_doc_id = p_doc_id
  order by version_number desc
  limit 1;

  if v_was_published then
    v_current_snapshot := public.curriculum_doc_snapshot(p_doc_id);
    if v_latest_snapshot is not null
       and (v_latest_snapshot - 'capturedAt') = (v_current_snapshot - 'capturedAt') then
      return v_latest_id;
    end if;
    v_version_id := public.capture_curriculum_doc_version(p_doc_id, 'publish', '재공개');
  else
    v_version_id := v_latest_id;
  end if;

  if v_version_id is null then
    raise exception '공개 시점 내용을 저장하지 못했습니다.';
  end if;

  return v_version_id;
end;
$$;

-- =========================================================================
-- 6. 페이지 단위 필기 — 수업 + 공개 버전 + 자료 + 페이지 + 범위
-- =========================================================================
alter table session_annotation_events
  add column if not exists curriculum_doc_version_id uuid references curriculum_doc_versions (id),
  add column if not exists page_number int,
  -- 재시도·재접속 때 같은 획이 두 번 저장되지 않게 하는 클라이언트 id.
  add column if not exists client_event_id uuid;

create unique index if not exists session_annotation_events_client_event_key
  on session_annotation_events (session_id, client_event_id) where client_event_id is not null;
create index if not exists session_annotation_events_page_idx
  on session_annotation_events (session_id, curriculum_doc_version_id, page_number, scope, seq)
  where page_number is not null;

comment on column session_annotation_events.page_number is
  'P2 13차: PDF 자료의 페이지(1부터). 같은 수업·같은 공개 버전·같은 페이지·같은 범위의 '
  '이벤트만 그 페이지에 다시 그린다. HTML 필기(과거 Native)는 null 로 그대로 둔다.';

create or replace function public.append_page_stroke_events(
  p_session_id uuid,
  p_segments jsonb,
  p_scope text,
  p_curriculum_doc_id uuid,
  p_curriculum_doc_version_id uuid,
  p_page_number int
)
returns setof session_annotation_events
language plpgsql
as $$
declare
  v_author uuid := auth.uid();
  v_owner uuid;
  v_seg jsonb;
  v_row session_annotation_events;
  v_snapshot jsonb;
  v_version_doc uuid;
  v_page_count int;
  v_client_id uuid;
begin
  if v_author is null then
    raise exception '인증되지 않은 사용자입니다.';
  end if;
  if p_scope not in ('teacher_shared', 'student_shared') then
    raise exception '페이지 필기는 교사 공유·학생 공유 범위만 있습니다: %', p_scope;
  end if;
  if jsonb_typeof(p_segments) is distinct from 'array' or jsonb_array_length(p_segments) = 0 then
    raise exception 'p_segments는 비어있지 않은 jsonb 배열이어야 합니다.';
  end if;

  -- 버전이 그 자료의 것이고, PDF 이며, 페이지가 범위 안인지 — 서버가 확인한다.
  select v.curriculum_doc_id, v.snapshot into v_version_doc, v_snapshot
  from curriculum_doc_versions v where v.id = p_curriculum_doc_version_id;
  if v_version_doc is null or v_version_doc <> p_curriculum_doc_id then
    raise exception '이 자료의 공개 버전이 아닙니다.';
  end if;
  if coalesce(v_snapshot->>'kind', 'html') <> 'pdf' then
    raise exception 'PDF 자료에만 페이지 필기를 남길 수 있습니다.';
  end if;
  v_page_count := (v_snapshot->'asset'->>'pageCount')::int;
  if p_page_number is null or p_page_number < 1 or p_page_number > coalesce(v_page_count, 0) then
    raise exception '페이지 %는 이 자료(%쪽)에 없습니다.', p_page_number, coalesce(v_page_count, 0);
  end if;

  -- 이 수업의 자료여야 한다: 시작 뒤에는 고정 매니페스트에, 시작 전에는 연결된 회차의
  -- 예정 구성에 있어야 한다.
  if not exists (
    select 1 from session_content_manifest cm
    where cm.session_id = p_session_id and cm.content_type = 'material_doc'
      and cm.content_id = p_curriculum_doc_id
  ) and not exists (
    select 1 from session_curriculum_units scu
    join curriculum_overlay_unit_materials m on m.overlay_unit_id = scu.overlay_unit_id
    where scu.session_id = p_session_id and m.curriculum_doc_id = p_curriculum_doc_id
  ) then
    raise exception '이 수업의 자료가 아닙니다.';
  end if;

  v_owner := case when p_scope = 'student_shared' then v_author else null end;

  for v_seg in
    select value from jsonb_array_elements(p_segments) with ordinality as t(value, ord) order by ord
  loop
    if not (v_seg ? 'x0' and v_seg ? 'y0' and v_seg ? 'x1' and v_seg ? 'y1'
            and v_seg ? 'color' and v_seg ? 'tool') then
      raise exception 'stroke 세그먼트 payload에 필수 필드(x0,y0,x1,y1,color,tool)가 없습니다: %', v_seg;
    end if;
    v_client_id := null;
    begin
      v_client_id := (v_seg->>'eventId')::uuid;
    exception when others then
      v_client_id := null;
    end;

    insert into session_annotation_events
      (session_id, author_id, event_type, payload, scope, curriculum_doc_id,
       owner_student_id, curriculum_doc_version_id, page_number, client_event_id)
    values
      (p_session_id, v_author, 'stroke', v_seg - 'eventId', p_scope, p_curriculum_doc_id,
       v_owner, p_curriculum_doc_version_id, p_page_number, v_client_id)
    on conflict (session_id, client_event_id) where client_event_id is not null do nothing
    returning * into v_row;

    -- 같은 eventId 가 이미 있으면(재시도) 조용히 넘어간다 — 두 번 그려지지 않는다.
    if v_row.seq is not null then
      return next v_row;
    end if;
    v_row := null;
  end loop;
  return;
end;
$$;

comment on function public.append_page_stroke_events(uuid, jsonb, text, uuid, uuid, int) is
  'P2 13차: PDF 페이지 필기 저장. 수업·공개 버전·자료·페이지·범위를 서버가 검증하고, '
  '세그먼트의 eventId 로 재시도 중복을 막는다. 소유자(학생 필기)는 서버가 정한다. '
  'RLS 의 범위별 기록 정책이 그대로 적용된다.';

revoke all on function public.append_page_stroke_events(uuid, jsonb, text, uuid, uuid, int) from public, anon;
grant execute on function public.append_page_stroke_events(uuid, jsonb, text, uuid, uuid, int) to authenticated;

-- =========================================================================
-- 7. 미리보기·구성 화면이 파일 자료를 구분해 안다
-- =========================================================================
create or replace function public.unit_preview_for_viewer(p_overlay_unit_id uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public as $$
declare
  v_enrollment uuid;
  v_unit_title text;
  v_goal text;
  v_prep_id uuid;
  v_session_id uuid;
  v_frozen boolean := false;
  v_materials jsonb;
  v_problems jsonb;
begin
  select o.subject_enrollment_id, u.unit_title
    into v_enrollment, v_unit_title
  from curriculum_overlay_units u
  join student_curriculum_overlays o on o.id = u.overlay_id
  where u.id = p_overlay_unit_id;

  if v_enrollment is null then
    return null;
  end if;

  if not (
    public.is_enrollment_child_or_guardian(v_enrollment)
    or is_admin()
    or public.is_active_teacher_for_enrollment(v_enrollment)
  ) then
    return null;
  end if;

  select goal, id into v_goal, v_prep_id
  from curriculum_unit_preps where overlay_unit_id = p_overlay_unit_id;

  select s.id into v_session_id
  from session_curriculum_units scu
  join sessions s on s.id = scu.session_id
  where scu.overlay_unit_id = p_overlay_unit_id
    and s.final_status <> 'scheduled'
  order by s.actual_start_at desc nulls last
  limit 1;

  v_frozen := v_session_id is not null;

  if v_frozen then
    select coalesce(jsonb_agg(m order by m.ord), '[]'::jsonb) into v_materials
    from (
      select cm.display_position as ord,
             jsonb_build_object(
               'curriculumDocId', coalesce(v.curriculum_doc_id, cm.content_id),
               'title', coalesce(v.snapshot->>'title', d.title),
               'versionId', cm.curriculum_doc_version_id,
               'kind', coalesce(v.snapshot->>'kind', d.kind, 'html'),
               'pageCount', (v.snapshot->'asset'->>'pageCount')::int,
               'mimeType', v.snapshot->'asset'->>'mimeType',
               'sections', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', s->>'id',
                          'title', s->>'title',
                          'body', s->>'body'))
                 from jsonb_array_elements(v.snapshot->'sections') s
               ), '[]'::jsonb)
             ) as m
      from session_content_manifest cm
      left join curriculum_doc_versions v on v.id = cm.curriculum_doc_version_id
      left join curriculum_docs d on d.id = cm.content_id
      where cm.session_id = v_session_id and cm.content_type = 'material_doc'
    ) m;

    select coalesce(jsonb_agg(p order by p.ord), '[]'::jsonb) into v_problems
    from (
      select cm.display_position as ord,
             jsonb_build_object(
               'problemId', cm.content_id,
               'versionId', cm.problem_version_id,
               'format', pr.format,
               'passage', pv.passage,
               'options', pv.options
             ) as p
      from session_content_manifest cm
      join problems pr on pr.id = cm.content_id
      left join problem_versions pv on pv.id = cm.problem_version_id
      where cm.session_id = v_session_id and cm.content_type = 'problem'
    ) p;
  else
    select coalesce(jsonb_agg(m order by m.ord), '[]'::jsonb) into v_materials
    from (
      select om.position as ord,
             jsonb_build_object(
               'curriculumDocId', om.curriculum_doc_id,
               'title', coalesce(v.snapshot->>'title', d.title),
               'versionId', om.curriculum_doc_version_id,
               'kind', coalesce(v.snapshot->>'kind', d.kind, 'html'),
               'pageCount', (v.snapshot->'asset'->>'pageCount')::int,
               'mimeType', v.snapshot->'asset'->>'mimeType',
               'sections', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', s->>'id',
                          'title', s->>'title',
                          'body', s->>'body'))
                 from jsonb_array_elements(v.snapshot->'sections') s
               ), '[]'::jsonb)
             ) as m
      from curriculum_overlay_unit_materials om
      join curriculum_docs d on d.id = om.curriculum_doc_id
      left join curriculum_doc_versions v on v.id = om.curriculum_doc_version_id
      where om.overlay_unit_id = p_overlay_unit_id
        and d.status = 'published' and d.archived_at is null
    ) m;

    select coalesce(jsonb_agg(p order by p.ord), '[]'::jsonb) into v_problems
    from (
      select i.position as ord,
             jsonb_build_object(
               'problemId', i.content_id,
               'versionId', i.problem_version_id,
               'format', pr.format,
               'passage', pv.passage,
               'options', pv.options
             ) as p
      from curriculum_unit_prep_items i
      join problems pr on pr.id = i.content_id
      left join problem_versions pv on pv.id = i.problem_version_id
      where i.prep_id = v_prep_id and i.content_type = 'problem'
        and pr.status = 'confirmed' and pr.archived_at is null
    ) p;
  end if;

  return jsonb_build_object(
    'unitId', p_overlay_unit_id,
    'unitTitle', v_unit_title,
    'goal', v_goal,
    'frozen', v_frozen,
    'sessionId', v_session_id,
    'materials', coalesce(v_materials, '[]'::jsonb),
    'problems', coalesce(v_problems, '[]'::jsonb)
  );
end;
$$;

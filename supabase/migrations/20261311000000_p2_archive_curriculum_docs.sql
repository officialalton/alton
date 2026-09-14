-- 교재 보관.
--
-- 지금 교재에는 보관 개념이 없다(doc_status = draft/pending_approval/published/
-- rejected). 그래서 "이제 안 쓰는 교재"를 목록에서 치우려면 배포를 내리는 수밖에
-- 없는데, 그건 뜻이 다르다 — 초안은 "아직", 보관은 "이제 그만"이다.
--
-- status 대신 subjects와 같은 모양의 archived_at을 쓴다. status를 건드리면 과거
-- 기록이 읽던 값이 바뀌고, enum에 값을 더하면 status를 검사하는 모든 경로가
-- 조용히 달라진다. 보관은 status와 직교하는 축이다.
--
-- **보관은 숨김이지 삭제가 아니다.** 기존 수업·커리큘럼 연결과 과거 콘텐츠·
-- 필기·풀이 기록은 그대로다. 과거 수업이 읽는 것은 시작 시점의
-- session_content_manifest 스냅샷이고, 그 조회는 id로 하므로 보관에 영향받지
-- 않는다. 보관 때문에 과거 수업을 열 수 없게 되면 안 된다.
alter table curriculum_docs add column archived_at timestamptz;
alter table curriculum_docs add column archived_reason text;

create index on curriculum_docs (archived_at);

comment on column curriculum_docs.archived_at is
  '교재 보관 시각. null이면 현재 교재. 보관된 교재는 신규 선택·자동 구성 후보에서 '
  '빠지지만 기존 연결과 과거 기록은 그대로 조회된다(삭제가 아니다).';

-- 자동 구성 후보에서 보관 교재를 뺀다. 배포됐더라도 보관됐으면 새로 들어가지
-- 않는다 — 이미 들어가 있는 것은 아래 트리거가 정리한다.
create or replace view public.keyword_default_materials
with (security_invoker = true) as
select d.primary_keyword_id as keyword_id,
       d.id as curriculum_doc_id,
       d.title,
       d.subject_id,
       coalesce(d.primary_keyword_position, 1000000) as position
from curriculum_docs d
where d.primary_keyword_id is not null
  and d.status = 'published'
  and d.archived_at is null;

comment on view public.keyword_default_materials is
  '키워드별 기본 교재. 배포됐고 보관되지 않은 교재만. 회차에 키워드가 붙으면 '
  '여기 있는 교재가 자동으로 구성에 들어간다.';

-- 보관하면 자동 구성에서도 빠져야 한다. 배포 상태가 바뀔 때와 같은 처리다.
drop trigger if exists curriculum_docs_resync on curriculum_docs;
create trigger curriculum_docs_resync
  after update of status, primary_keyword_id, primary_keyword_position, archived_at
  on curriculum_docs
  for each row
  when (
    old.status is distinct from new.status
    or old.primary_keyword_id is distinct from new.primary_keyword_id
    or old.primary_keyword_position is distinct from new.primary_keyword_position
    or old.archived_at is distinct from new.archived_at
  )
  execute function curriculum_docs_resync_unit_materials();

-- 보관된 채로 만들어지는 경우는 없지만, insert 경로도 같은 조건을 따르게 한다.
create or replace function curriculum_docs_resync_on_insert()
returns trigger language plpgsql as $$
declare
  v_unit_id uuid;
begin
  if new.primary_keyword_id is null or new.status <> 'published' or new.archived_at is not null then
    return null;
  end if;
  for v_unit_id in
    select distinct uk.overlay_unit_id
    from curriculum_overlay_unit_keywords uk
    where uk.keyword_id = new.primary_keyword_id
  loop
    perform sync_unit_auto_materials(v_unit_id);
  end loop;
  return null;
end;
$$;

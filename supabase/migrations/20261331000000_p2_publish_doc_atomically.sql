-- P2 6차 — 공개와 버전 생성을 한 트랜잭션으로 묶는다.
--
-- 2026-09-13 지시: "재공개 시 스냅샷 생성이 실패하면 공개 성공으로 응답하지 않아야
-- 합니다. 공개 처리와 버전 생성의 일관성, 중복 클릭·동시 요청 시 버전 번호 충돌도
-- 확인해주세요."
--
-- 앱이 하던 방식(상태 UPDATE → 별도 RPC 캡처)은 두 번의 왕복이라, 캡처가 실패해도
-- 상태 변경은 이미 커밋돼 있었다. "공개됐는데 그 시점 내용은 남지 않은" 상태가
-- 남는다.
--
-- 동시 요청도 문제다. curriculum_doc_versions 에 unique(curriculum_doc_id,
-- version_number) 가 있어서, 두 요청이 같은 다음 번호를 계산하면 하나가 깨진다.
-- 교재 단위 advisory lock 으로 직렬화한다(커밋·롤백 시 자동 해제).

create or replace function public.publish_curriculum_doc(
  p_doc_id uuid,
  p_published boolean
)
returns uuid
language plpgsql
as $$
declare
  v_was_published boolean;
  v_version_id uuid;
begin
  -- 같은 교재에 대한 동시 호출을 직렬화한다. 버전 번호를 읽고 쓰는 구간 전체를
  -- 덮어야 하므로 상태 조회 전에 잡는다.
  perform pg_advisory_xact_lock(hashtextextended(p_doc_id::text, 77));

  select status = 'published' into v_was_published
  from curriculum_docs where id = p_doc_id;

  if v_was_published is null then
    raise exception '존재하지 않는 교재입니다.';
  end if;

  update curriculum_docs
  set status = (case when p_published then 'published' else 'draft' end)::doc_status
  where id = p_doc_id;

  if not p_published then
    return null;
  end if;

  -- 초안 → 공개는 status 변경 트리거가 이미 한 벌 떴다. 재공개일 때만 여기서
  -- 새로 뜬다. 같은 트랜잭션이라 캡처가 실패하면 상태 변경도 함께 되돌아간다.
  if v_was_published then
    v_version_id := public.capture_curriculum_doc_version(p_doc_id, 'publish', '재공개');
  else
    select id into v_version_id
    from curriculum_doc_versions
    where curriculum_doc_id = p_doc_id
    order by version_number desc
    limit 1;
  end if;

  -- 공개인데 버전이 없다면 그 자체가 실패다. "공개됐는데 그 시점 내용은 남지 않은"
  -- 상태로 성공을 돌려주지 않는다.
  if v_version_id is null then
    raise exception '공개 시점 내용을 저장하지 못했습니다.';
  end if;

  return v_version_id;
end;
$$;

comment on function public.publish_curriculum_doc(uuid, boolean) is
  'P2 6차: 교재 공개·비공개를 한 트랜잭션으로 처리한다. 공개면 그 시점 내용을 버전 '
  '행으로 남기고, 남기지 못하면 상태 변경도 함께 되돌린다. 교재 단위 advisory lock 으로 '
  '동시 요청의 버전 번호 충돌을 막는다. **기존 공개 버전은 고치지 않고 새 버전을 만든다.**';

revoke execute on function public.publish_curriculum_doc(uuid, boolean) from public, anon;
grant execute on function public.publish_curriculum_doc(uuid, boolean) to authenticated, service_role;

-- =========================================================================
-- 집계 대조를 ID 단위로 — 누락과 중복이 상쇄되지 않게
-- =========================================================================
-- 2026-09-13 지시: "누락과 중복이 서로 상쇄될 수 있으므로, 누락·중복이 없다고
-- 판단하려면 원본 구성 행 ID별 대조까지 확인해주세요."
--
-- 건수만 맞춰 보면 한 행이 빠지고 다른 행이 두 번 세어져도 합이 같아 통과한다.
-- 대상 키를 그대로 늘어놓고 **서로 없는 것**을 찾는다.
create or replace view public.prep_version_coverage_keys
with (security_invoker = true) as
select 'catalog'::text as layer, 'material'::text as kind,
       m.unit_id::text || ':' || m.curriculum_doc_id::text as row_key
from subject_template_unit_materials m
union all
select 'teacher', 'material', m.unit_id::text || ':' || m.curriculum_doc_id::text
from teacher_curriculum_template_unit_materials m
union all
select 'student', 'material', m.overlay_unit_id::text || ':' || m.curriculum_doc_id::text
from curriculum_overlay_unit_materials m
union all
select 'session', 'material', m.id::text
from session_content_manifest m
where m.content_type in ('material_doc', 'material_section')
union all
select 'catalog', 'problem', p.unit_id::text || ':' || p.problem_id::text
from subject_template_unit_problems p
union all
select 'teacher', 'problem', p.unit_id::text || ':' || p.problem_id::text
from teacher_curriculum_template_unit_problems p
union all
select 'student', 'problem', i.id::text
from curriculum_unit_prep_items i where i.content_type = 'problem'
union all
select 'session', 'problem', m.id::text
from session_content_manifest m where m.content_type = 'problem';

comment on view public.prep_version_coverage_keys is
  'P2 6차: 집계 대상의 키를 그대로 늘어놓는다. prep_version_coverage 의 건수 합과 '
  '이 키 수를 대조하면 누락·중복이 상쇄되는 것을 잡을 수 있다. 키가 중복되면 그것도 '
  '여기서 드러난다.';

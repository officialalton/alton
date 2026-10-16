-- P2 11차 — '기본 구성 업데이트' 하나로 모은다.
--
-- 2026-09-13 제품 오너 확정 4번: "'물려받기 / 기본 구성 보충 / 다시 구성'이
-- 사용자에게 서로 다른 필수 단계처럼 보이지 않도록 정리해주세요. 사용자는 '기본
-- 구성 업데이트' 진입점 하나에서 상위 변경과 현재 조건에 따른 구성 변경을
-- 확인·적용할 수 있으면 됩니다."
--
-- 지금은 두 가지가 따로 있다:
--   물려받기   상위 계층에서 없는 것을 가져온다
--   다시 구성  키워드·조건으로 자동분을 맞추고 버전을 올린다
--
-- 사용자에게는 한 가지 일이다 — "위에서 바뀐 것과 조건에 맞는 것을 지금 구성에
-- 반영한다". 둘을 한 함수로 묶는다. 순서가 중요하다: 상위에서 먼저 받아야 그
-- 항목들이 자동 구성·버전 갱신의 대상이 된다.

create or replace function public.update_unit_composition(p_layer text, p_unit_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_inherit record;
  v_recompose jsonb;
begin
  -- 1) 상위 계층에서 보충한다. 기준본 층은 위가 없으므로 건너뛴다.
  if p_layer = 'teacher' then
    select * into v_inherit from public.inherit_teacher_unit_defaults_from_template(p_unit_id);
  elsif p_layer = 'student' then
    select * into v_inherit from public.inherit_unit_defaults_from_template(p_unit_id);
  end if;

  -- 2) 그 위에서 키워드·조건에 맞춰 자동분을 맞추고, 담긴 것의 버전을 올린다.
  v_recompose := public.recompose_unit(p_layer, p_unit_id);

  return v_recompose || jsonb_build_object(
    'inheritedKeywords', coalesce(v_inherit.keywords_added, 0),
    'inheritedMaterials', coalesce(v_inherit.materials_added, 0),
    'inheritedProblems', coalesce(v_inherit.problems_added, 0)
  );
end;
$$;

comment on function public.update_unit_composition(text, uuid) is
  'P2 11차: 수업 준비 화면의 **유일한** 구성 업데이트 경로. 상위 계층에서 보충한 뒤 '
  '키워드·조건으로 자동분을 맞추고 담긴 것의 버전을 올린다. 사람이 눌렀을 때만 돈다. '
  '교사가 직접 담은 것·뺀 것·맞춰 둔 순서는 그대로 남는다.';

-- 미리보기 — 같은 일을 실제로 해 보고 되돌린다. 규칙이 두 벌로 갈라지지 않는다.
create or replace function public.preview_unit_composition_update(p_layer text, p_unit_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb;
  v_fingerprint text;
begin
  v_fingerprint := public.unit_composition_fingerprint(p_layer, p_unit_id);

  begin
    v_result := public.update_unit_composition(p_layer, p_unit_id);
    raise exception 'PREVIEW_ROLLBACK' using errcode = 'ALT01';
  exception
    when sqlstate 'ALT01' then
      null;
  end;

  return coalesce(v_result, '{}'::jsonb)
         || jsonb_build_object('preview', true, 'fingerprint', v_fingerprint);
end;
$$;

comment on function public.preview_unit_composition_update(text, uuid) is
  'P2 11차: 업데이트하면 무엇이 달라지는지. 실제로 적용해 본 뒤 되돌리므로 미리 본 것과 '
  '적용 결과가 어긋나지 않는다. 아무것도 바꾸지 않는다 — 취소하면 기존 구성이 그대로다.';

-- 적용 — 미리 본 시점의 지문을 들고 온다. 그 사이에 바뀌었으면 거절한다.
create or replace function public.apply_unit_composition_update(
  p_layer text,
  p_unit_id uuid,
  p_expected_fingerprint text
)
returns jsonb
language plpgsql
as $$
declare
  v_now text;
begin
  if p_expected_fingerprint is not null then
    v_now := public.unit_composition_fingerprint(p_layer, p_unit_id);
    if v_now is distinct from p_expected_fingerprint then
      raise exception '미리 본 뒤에 구성이나 교재·문제가 바뀌었습니다. 변경분을 다시 확인해주세요.'
        using errcode = 'ALT02';
    end if;
  end if;

  return public.update_unit_composition(p_layer, p_unit_id);
end;
$$;

grant execute on function public.update_unit_composition(text, uuid) to authenticated, service_role;
grant execute on function public.preview_unit_composition_update(text, uuid) to authenticated, service_role;
grant execute on function public.apply_unit_composition_update(text, uuid, text) to authenticated, service_role;

-- =========================================================================
-- 상위에 변경이 남아 있는지도 '업데이트 있음'에 넣는다
-- =========================================================================
-- 지금 composition_dirty 는 키워드·조건·교재 공개가 바뀔 때만 켜진다. 관리자가
-- 기준본에 교재·문제를 더해도 아래 계층은 조용하다 — 교사가 알 길이 없다.
-- 읽을 때 대조한다(공개 트리거를 더 늘리지 않는다).
create or replace view public.unit_parent_pending_updates
with (security_invoker = true) as
-- 교사 기본 구성이 관리자 기준본에서 아직 받지 않은 것
select 'teacher'::text as layer, tu.id as unit_id, 'keyword'::text as kind, k.keyword_id as content_id
from teacher_curriculum_template_units tu
join subject_template_unit_keywords k on k.unit_id = tu.source_unit_id
where tu.source_unit_id is not null
  and not exists (
    select 1 from teacher_curriculum_template_unit_keywords e
    where e.unit_id = tu.id and e.keyword_id = k.keyword_id
  )
union all
select 'teacher', tu.id, 'material', m.curriculum_doc_id
from teacher_curriculum_template_units tu
join subject_template_unit_materials m on m.unit_id = tu.source_unit_id
join curriculum_docs d on d.id = m.curriculum_doc_id
where tu.source_unit_id is not null
  and d.status = 'published' and d.archived_at is null
  and not exists (
    select 1 from teacher_curriculum_template_unit_materials e
    where e.unit_id = tu.id and e.curriculum_doc_id = m.curriculum_doc_id
  )
  and not exists (
    select 1 from teacher_curriculum_template_unit_material_exclusions x
    where x.unit_id = tu.id and x.curriculum_doc_id = m.curriculum_doc_id
  )
union all
select 'teacher', tu.id, 'problem', p.problem_id
from teacher_curriculum_template_units tu
join subject_template_unit_problems p on p.unit_id = tu.source_unit_id
where tu.source_unit_id is not null
  and not exists (
    select 1 from teacher_curriculum_template_unit_problems e
    where e.unit_id = tu.id and e.problem_id = p.problem_id
  )
  and not exists (
    select 1 from teacher_curriculum_template_unit_problem_exclusions x
    where x.unit_id = tu.id and x.problem_id = p.problem_id
  );

comment on view public.unit_parent_pending_updates is
  'P2 11차: 상위 계층에 있는데 이 회차에는 아직 없는 것. 교사가 뺀 것(제외 기록)은 빼고 '
  '센다 — 뺀 것을 계속 "업데이트 있음"으로 알리면 알림이 영원히 꺼지지 않는다.';

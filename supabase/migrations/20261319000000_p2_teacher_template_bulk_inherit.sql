-- P2 3차 보완 — 선생님 기본 템플릿 전체를 한 번에 보정한다.
--
-- 2026-09-13(제품 오너 확인): 마이그레이션 이전에 만들어진 템플릿은 연결
-- (source_unit_id)만 복원되고 키워드는 비어 있다. 초기 상속 트리거는 회차가
-- 만들어질 때만 돌기 때문이다 — "초기 상속은 자동, 보정은 수동"이라는 확정
-- 정책 그대로다.
--
-- 그런데 회차마다 "기준본에서 가져오기"를 하나씩 누르게 하면, 이번 지시가 없애라고
-- 한 "선생님이 같은 키워드를 다시 지정하는 흐름"과 사실상 같아진다. 템플릿 단위로
-- 한 번에 부를 수 있게 한다.
--
-- 여전히 **수동**이다. 자동으로 돌지 않는다:
--   - 상속 누락(연결은 있는데 비어 있음)과 선생님이 일부러 뺀 것을 코드가 구분할 수
--     없다. 그래서 사람이 누를 때만 움직인다.
--   - 없는 것만 넣고 아무것도 지우지 않는다(inherit_teacher_unit_defaults_from_template
--     의 성질을 그대로 물려받는다).
--   - 기준본과 이어지지 않은 보충 회차는 건너뛴다 — 물려받을 것이 없다.
create or replace function inherit_teacher_template_defaults(p_template_id uuid)
returns table (unit_id uuid, keywords_added int, materials_added int)
language plpgsql
as $$
begin
  return query
  select u.id, r.keywords_added, r.materials_added
  from teacher_curriculum_template_units u
  cross join lateral inherit_teacher_unit_defaults_from_template(u.id) r
  where u.template_id = p_template_id
    and u.source_unit_id is not null
  order by u.position;
end;
$$;

comment on function inherit_teacher_template_defaults(uuid) is
  'P2 3차: 템플릿의 모든 회차에 관리자 기준본의 기본 키워드·교재를 물려받는다. '
  '기준본과 이어진 회차만 대상이고, 없는 것만 넣으며 아무것도 지우지 않는다. '
  '자동 실행되지 않는다 — 선생님이 화면에서 명시적으로 부른다.';

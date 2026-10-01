-- P2 7차 — 문제의 '유형'과 '주제'를 가르고, 구성 후보가 못 되는 이유를 드러낸다.
--
-- 2026-09-13 제품 오너 지적:
--   "Words in Context 같은 거를 문제 유형(필수 아님, 선택)이라고 봐야 될 것 같아,
--    주제(필수 아님 선택)는 별도로 넣어야 하고"
--   "공개했는데 키워드가 없어 구성 후보에 나오지 않는 상황을 설명 없이 남기지 마세요"
--
-- 지금은 skill_type 하나가 유형과 주제를 겸하고 있다. 둘은 다른 축이라 같은 칸에
-- 넣으면 어느 쪽으로도 걸러 낼 수 없다.

alter table problems add column topic text;

comment on column problems.topic is
  'P2 7차: 이 문제가 다루는 주제. 선택 항목이다. 유형(skill_type)과 다른 축이다 — '
  '유형은 "무엇을 묻는가"(예: Words in Context), 주제는 "무엇에 대한 글인가"다.';

comment on column problems.skill_type is
  'P2 7차: 문제 유형 — 무엇을 묻는가(예: Words in Context). 선택 항목이다. '
  '주제(topic)와 다른 축이다.';

-- =========================================================================
-- 구성 후보가 되지 못하는 이유
-- =========================================================================
-- "공개했는데 왜 회차 구성에 안 나오지?"를 화면이 설명할 수 있어야 한다. 조건이
-- 여럿이라 어느 것이 걸렸는지 말해 주지 않으면 관리자가 알 길이 없다.
--
--   not_confirmed        확정되지 않음
--   archived             보관됨
--   no_published_version 공개된 버전이 없음
--   no_keyword           키워드가 없음 — 키워드로 후보를 찾으므로 걸리지 않는다
--   ok                   후보가 된다
create or replace view public.problem_composition_readiness
with (security_invoker = true) as
select
  p.id as problem_id,
  case
    when p.status <> 'confirmed' then 'not_confirmed'
    when p.archived_at is not null then 'archived'
    when not exists (
      select 1 from problem_versions v
      where v.problem_id = p.id and v.status = 'published'
    ) then 'no_published_version'
    when not exists (
      select 1 from problem_keywords k where k.problem_id = p.id
    ) then 'no_keyword'
    else 'ok'
  end as readiness
from problems p;

comment on view public.problem_composition_readiness is
  'P2 7차: 이 문제가 회차 자동 구성 후보가 되는지, 안 된다면 어느 조건에 걸렸는지. '
  '"공개했는데 안 나온다"를 설명 없이 남기지 않기 위한 것이다.';

-- =========================================================================
-- 선택지 개수가 4개가 아닌 문제
-- =========================================================================
-- 화면이 4지선다 고정으로 바뀐다. 기존 문제 중 4개가 아닌 것을 **잘라내거나 변환하지
-- 않는다**(2026-09-13 지시) — 있는 그대로 두고 화면이 따로 표시하도록, 세어 볼 수
-- 있게만 해 둔다.
create or replace view public.problem_option_count_anomalies
with (security_invoker = true) as
select
  v.id as version_id,
  v.problem_id,
  v.version_no,
  v.status,
  coalesce(jsonb_array_length(v.options), 0) as option_count
from problem_versions v
where v.options is not null
  and coalesce(jsonb_array_length(v.options), 0) <> 4;

comment on view public.problem_option_count_anomalies is
  'P2 7차: 선택지가 4개가 아닌 문제 버전. 화면이 4지선다 고정으로 바뀌어도 기존 것을 '
  '잘라내거나 변환하지 않는다 — 여기서 드러내고 사람이 판단한다.';

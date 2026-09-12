-- R3 후속 보완 (product owner 피드백 2건, additive only — 기존 마이그레이션 미수정):
--
-- 1. trial_sessions.goal: "목표는 사전 계획이고 result_notes/recommendation은 사후
--    평가이므로 대체할 수 없다"는 지적에 따라, 체험 생성 시점에 입력하는 별도
--    "이 체험으로 무엇을 확인/달성할 것인가" 필드를 추가한다. result_notes/
--    recommendation(완료 시점, 사후 평가)과는 명확히 다른 시점/성격의 필드.
--
-- 2. 학생 분류(classification)는 legacy consult_requests.intake_type 같은 고정
--    DB enum('A'..'E')으로 이식하지 않는다(명시적으로 반려됨). 대신 관리자가
--    스키마 마이그레이션 없이 태그를 추가/은퇴시킬 수 있는 확장형 태깅 구조
--    (classification_tags + consultation_classification_tags)로 대체한다.

-- =========================================================================
-- 1. trial_sessions.goal (사전 계획, nullable — 소급 데이터 없음)
-- =========================================================================

alter table trial_sessions add column goal text;

comment on column trial_sessions.goal is
  'R3 보완: 체험 생성 시점에 입력하는 사전 계획(이 체험으로 무엇을 확인/달성할 것인가). '
  'result_notes/recommendation은 완료 시점의 사후 평가로 서로 대체할 수 없다(product owner 확정).';

-- =========================================================================
-- 2. classification_tags / consultation_classification_tags
--    (고정 enum 대신 관리자 관리형 확장 태그 vocabulary)
-- =========================================================================

create table classification_tags (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  description text,
  active boolean not null default true,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create unique index classification_tags_label_unique on classification_tags (label);

comment on table classification_tags is
  'R3 보완: 학생 분류(legacy consult_requests.intake_type A~E 고정 enum 대체안). '
  '관리자가 스키마 변경 없이 태그를 추가/은퇴(active=false)시킬 수 있는 확장형 vocabulary.';

create table consultation_classification_tags (
  consultation_id uuid not null references consultations (id),
  tag_id uuid not null references classification_tags (id),
  tagged_by uuid references profiles (id),
  tagged_at timestamptz not null default now(),
  primary key (consultation_id, tag_id)
);
create index on consultation_classification_tags (tag_id);

comment on table consultation_classification_tags is
  'R3 보완: 상담(consultation) ↔ classification_tags 다대다 조인. 상담 하나에 여러 분류 태그 부여 가능.';

alter table classification_tags enable row level security;
alter table consultation_classification_tags enable row level security;

-- 쓰기(생성/은퇴)는 관리자/운영자(manage_consultations capability)만. 조회는
-- 로그인한 스태프 전반에 열어둔다(분류 vocabulary 자체는 민감 정보가 아니며,
-- 상담 화면 곳곳에서 참조되므로 좁게 잠그면 오히려 UI가 깨진다) — is_admin()
-- 이거나 manage_consultations capability가 있으면 조회/쓰기 모두 허용,
-- 그 외 인증된 사용자는 조회만.
create policy "관리자/운영자 쓰기" on classification_tags for all
  using (is_admin() or current_user_has_capability('manage_consultations'))
  with check (is_admin() or current_user_has_capability('manage_consultations'));
create policy "인증된 사용자 조회" on classification_tags for select
  using (auth.uid() is not null);

create policy "관리자/운영자 쓰기" on consultation_classification_tags for all
  using (is_admin() or current_user_has_capability('manage_consultations'))
  with check (is_admin() or current_user_has_capability('manage_consultations'));
create policy "관리자/운영자/본인가족 조회" on consultation_classification_tags for select
  using (
    is_admin()
    or current_user_has_capability('manage_consultations')
    or exists (
      select 1 from consultations c
      where c.id = consultation_classification_tags.consultation_id
        and c.child_id is not null
        and (c.child_id = auth.uid() or is_household_guardian_of(c.child_id))
    )
  );

-- R3 correction — 가족 기본계약/계약 버전 모델 재정렬(2026-09-13, product owner 확정 정책).
--
-- 배경: 20260911000000(contracts_v3→contracts cutover)와 20260912000000(상담→체험→
-- 제안서→계약→결제 핸드오프 스키마)이 이미 로컬 dev DB에 적용된 뒤, 계약 데이터
-- 모델에 대한 새 정책이 확정됐다. 이 마이그레이션은 그 두 마이그레이션을 수정하지
-- 않고(이미 적용됨) 그 위에 순수 additive/교정 방식으로 얹는다.
--
-- 정책 핵심: 가족 기본계약(contracts)은 자녀 1명 단위의 "계속 계약"이며 특정 과목/
-- 선생님/일정/수업권 수량/가격을 고정하지 않는다. 그런 상품 성격 정보는 (a) 추천
-- 단계에서는 proposals/proposal_subjects, (b) 실제 결제·주문 단계에서는 R4의 결제
-- 영수증/주문 스냅샷이 담당한다. DocuSign envelope은 계약이 아니라 "계약 버전"
-- 단위로 발송·추적한다(같은 기본계약이 재서명될 때마다 새 버전, envelope도 버전별).

-- =========================================================================
-- 1. contract_version_subjects 제거
-- =========================================================================
--
-- 이 테이블(20260912000000 §5)은 "계약 버전에 과목별 라인 아이템을 정규화해
-- 고정"하는 구조였다. 새 정책은 "기본계약에 특정 과목·선생님·수업권 수량·가격을
-- 고정하지 않는다"를 명시하므로 이 테이블 자체가 정책과 직접 충돌한다 — 추천
-- 단계의 과목/수량/가격은 이미 proposals.recommended_subjects(jsonb) +
-- proposal_subjects 개념으로 남길 수 있고, 실제 확정 상품/수량/가격/할인/세금은
-- R4 결제 영수증/주문 스냅샷이 담당해야 한다(R3에서 만들지 않음). 계약 버전에
-- "법적으로 확정된 과목 라인 아이템"을 두는 것은 정책상 있어서는 안 되는 구조이므로
-- 데이터가 없는 이 시점에 DROP하는 것이 정책과 가장 일치한다(수정/이름변경으로
-- "참고용"이라 우회하지 않고 아예 제거 — 존재 자체가 오해를 유발하기 때문).
drop table if exists contract_version_subjects;

-- =========================================================================
-- 2. proposal_subjects — 제안서의 과목별 추천 라인 아이템(정규화)
-- =========================================================================
--
-- 20260912000000 설계 판단 2는 "제안서는 아직 확정 전 초안이라 jsonb로 충분하다"
-- 였으나, 정책이 명확히 "추천 과목·선생님·횟수·예상 가격은 제안서에 남긴다"고 못
-- 박았고 향후(R4+) 제안서 과목을 subject_id 기준으로 조회/집계할 필요가 실제로
-- 있다(예: 과목별 제안 이력, 인기 과목 통계). contract_version_subjects를 제거하는
-- 대신 정규화된 버전을 제안서 쪽에 신설해, "확정 계약에는 과목을 고정하지 않되
-- 추천안은 정규화해서 조회 가능하게 남긴다"는 정책 의도를 정확히 반영한다.
-- proposals.recommended_subjects(jsonb)는 그대로 유지 — 이 테이블은 그 jsonb의
-- 정규화된 보강 뷰이지 대체가 아니다(기존 앱 코드가 이미 jsonb를 쓰고 있어 이번
-- 마이그레이션에서 앱 코드의 jsonb 경로를 걷어내지 않는다. 정규화 테이블 활용은
-- 이후 태스크에서 점진적으로 전환 가능).
create table proposal_subjects (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals (id) on delete cascade,
  subject_id uuid not null references subjects (id),
  recommended_session_count int,
  price_minor bigint,
  currency text not null default 'KRW',
  created_at timestamptz not null default now(),
  unique (proposal_id, subject_id)
);
create index on proposal_subjects (subject_id);

comment on table proposal_subjects is
  'R3 교정(2026-09-13): 제안서(추천 단계)의 과목별 라인 아이템, 정규화. '
  '계약(contracts/contract_versions)에는 과목·수량·가격을 고정하지 않는다는 정책에 따라 '
  'contract_version_subjects(20260912000000)를 삭제하고 이 테이블로 대체했다 — '
  '이 테이블의 값은 어디까지나 "추천"이며 계약의 법적 확정 대상이 아니다. '
  '실제 확정 상품·수량·가격·할인·세금·유효기간은 R4 결제 영수증/주문 스냅샷이 source of truth다.';

alter table proposal_subjects enable row level security;

create policy "관리자/운영자/본인가족 조회" on proposal_subjects for select
  using (
    is_admin()
    or current_user_has_capability('manage_consultations')
    or exists (
      select 1 from proposals p
      join consultations c on c.id = p.consultation_id
      where p.id = proposal_subjects.proposal_id
        and c.child_id is not null
        and (c.child_id = auth.uid() or is_household_guardian_of(c.child_id))
    )
  );
create policy "관리자/운영자 쓰기" on proposal_subjects for all
  using (is_admin() or current_user_has_capability('manage_consultations'))
  with check (is_admin() or current_user_has_capability('manage_consultations'));

-- =========================================================================
-- 3. contract_versions — DocuSign envelope 연동을 contracts에서 이관 +
--    계약 버전 스냅샷 컬럼 추가 + 회사 선서명 상태
-- =========================================================================
--
-- 정책: "DocuSign envelope는 contracts가 아니라 contract_versions와 1:1로
-- 연결해야 한다" — 재서명(새 버전) 시마다 새 envelope이 발송되므로 버전 단위가
-- 맞다. contracts.docusign_envelope_id/status/status_updated_at(20260912000000 §4)을
-- 여기로 옮기고 원본 컬럼은 제거한다(데이터 없는 시점의 additive correction —
-- 20260911000000의 merge_accounts() 선례와 같은 패턴: 이름을 남겨 deprecated로
-- 두지 않고 깨끗이 제거 + 코멘트로 이유를 남긴다).
alter table contract_versions add column docusign_envelope_id text;
alter table contract_versions add column docusign_envelope_status v3_docusign_envelope_status;
alter table contract_versions add column docusign_status_updated_at timestamptz;
create index on contract_versions (docusign_envelope_id) where (docusign_envelope_id is not null);

comment on column contract_versions.docusign_envelope_id is
  'R3 교정(2026-09-13): DocuSign 봉투 id. 계약(contract) 레벨이 아니라 버전 레벨 — 재서명마다 새 버전, 새 envelope.';
comment on column contract_versions.docusign_envelope_status is
  'R3 교정: 이 버전에 연결된 DocuSign 봉투 상태 스냅샷(sent/delivered/completed/declined/voided). '
  '보호자 서명 거부는 여기 declined로 기록하고, 계약/버전의 ALTON 상태는 새 상태를 추가하지 않고 기존 v3_contract_status의 void로 종료한다.';

-- 계약 템플릿 버전, 당사자 모드, 보호자·학생 서명 시점 스냅샷, 정책 버전들,
-- 원본 제안서 연결. proposal_id는 contracts에서 옮긴다 — 버전마다 다른 제안서에서
-- 파생될 수 있으므로(정책 명시) contract 레벨이 아니라 version 레벨이 맞다.
alter table contract_versions add column template_version text;
alter table contract_versions add column company_signing_entity text
  check (company_signing_entity in ('do_kyung_kim_individual', 'registered_llc'));
alter table contract_versions add column guardian_snapshot jsonb;
alter table contract_versions add column student_snapshot jsonb;
alter table contract_versions add column privacy_policy_version text;
alter table contract_versions add column refund_policy_version text;
alter table contract_versions add column consent_policy_version_id uuid references consent_policy_versions (id);
alter table contract_versions add column proposal_id uuid references proposals (id);
create index on contract_versions (proposal_id);

comment on column contract_versions.template_version is 'R3 교정: 서명 시점의 계약 템플릿(문안) 버전 식별자 스냅샷.';
comment on column contract_versions.company_signing_entity is 'R3 교정: 회사 서명 주체 스냅샷 — 법인 설립 전(do_kyung_kim_individual)/후(registered_llc) 구분. 서명 시점 값 고정, 나중에 법인이 생겨도 과거 버전은 바뀌지 않는다.';
comment on column contract_versions.guardian_snapshot is 'R3 교정: 서명 시점 보호자 이름/이메일 등 스냅샷(jsonb) — 이후 프로필이 바뀌어도 계약 당시 값 보존.';
comment on column contract_versions.student_snapshot is 'R3 교정: 서명 시점 학생 이름 등 스냅샷(jsonb), 위와 동일 취지.';
comment on column contract_versions.privacy_policy_version is 'R3 교정: 서명 시점 개인정보처리방침 버전 스냅샷.';
comment on column contract_versions.refund_policy_version is 'R3 교정: 서명 시점 환불정책 버전 스냅샷.';
comment on column contract_versions.consent_policy_version_id is 'R3 교정: R2 consent_policy_versions 참조 — 이 계약 버전 서명 시점에 유효했던 동의 정책 버전(참고용 연결, 13세 미만 판정 자체는 R2 is_under_13()/guardian_consents가 여전히 담당).';
comment on column contract_versions.proposal_id is 'R3 교정: contracts.proposal_id(20260912000000)에서 이관 — 버전마다 다른 제안서에서 파생될 수 있어(재제안→재계약) contract 레벨이 아니라 version 레벨이 정책과 맞다.';

-- 회사 선서명 상태 — "회사 서명이 완료된 버전만 보호자에게 발송 가능"을 표현할
-- 최소한의 컬럼. 발송을 실제로 막는 로직(서버 액션 훅)은 애플리케이션 레벨에서
-- 구현하되, 최소한 상태를 저장할 컬럼은 스키마에 있어야 한다는 정책 요구를 충족.
alter table contract_versions add column company_signed_at timestamptz;
alter table contract_versions add column company_signed_by uuid references profiles (id);

comment on column contract_versions.company_signed_at is 'R3 교정: 회사(ALTON) 측 선서명 완료 시각. null이면 아직 회사 승인 전 — 보호자에게 발송 금지(앱 서버 액션에서 강제, sendContractForSignature 참고).';
comment on column contract_versions.company_signed_by is 'R3 교정: 회사 측 선서명을 승인 처리한 관리자.';

-- 새 버전 생성 시 이전 버전을 superseded로 표시하기 위한 상태 컬럼. contracts
-- 자체의 상태 기계(v3_contract_status)는 그대로 유지하되(새 상태 추가 금지),
-- "이 버전이 최신인가"는 버전 레벨에서 별도로 표현해야 한다 — contracts.status에는
-- superseded가 없고 넣지도 않는다(정책: 기존 enum만 사용). 버전 레벨 상태는 새로
-- 만드는 것이 정책 위반이 아니다(v3_contract_status를 건드리지 않았음).
create type v3_contract_version_status as enum ('active', 'superseded');
alter table contract_versions add column version_status v3_contract_version_status not null default 'active';

comment on column contract_versions.version_status is
  'R3 교정: 새 버전 서명 완료 시 이전 버전을 superseded로 표시하기 위한 버전 레벨 상태. '
  'contracts.status(v3_contract_status)와는 별개 — 계약 자체의 상태 기계에는 새 상태를 추가하지 않는다는 정책을 지키기 위해 이 상태는 계약이 아니라 버전에 둔다.';

-- =========================================================================
-- 4. contracts — DocuSign 컬럼 제거(contract_versions로 이관 완료)
-- =========================================================================
drop index if exists contracts_docusign_envelope_id_idx;
alter table contracts drop column if exists docusign_envelope_id;
alter table contracts drop column if exists docusign_envelope_status;
alter table contracts drop column if exists docusign_status_updated_at;

comment on table contracts is
  'R3 cutover(2026-09-11)로 확정된 v3 계약 테이블. DocuSign envelope 연동은 2026-09-13 교정으로 '
  '계약(contract) 레벨에서 계약 버전(contract_versions) 레벨로 이관됐다 — 서명은 버전 단위로 발송·추적한다. '
  '레거시 계약 테이블은 legacy_contracts를 참고.';

-- proposal_id도 계약 버전 레벨로 옮긴다(위 §3) — 계약 레벨 컬럼은 제거.
alter table contracts drop column if exists proposal_id;

-- =========================================================================
-- 5. contract_versions RLS
-- =========================================================================
--
-- contract_versions는 20260911000000/20260912000000 어디에서도 RLS를 켜지 않았다
-- (grep 결과 contract_versions에 대한 RLS 정책 없음 — R1에서 테이블만 만들고 누락된
-- 것으로 보인다). 이제 DocuSign envelope·서명 시점 개인정보 스냅샷(guardian_snapshot/
-- student_snapshot)까지 이 테이블에 얹히므로, 이번 교정에서 함께 RLS를 켠다.
alter table contract_versions enable row level security;

create policy "관리자/운영자/본인가족 조회" on contract_versions for select
  using (
    is_admin()
    or current_user_has_capability('manage_consultations')
    or exists (
      select 1 from contracts ct
      where ct.id = contract_versions.contract_id
        and (ct.child_id = auth.uid() or is_household_guardian_of(ct.child_id))
    )
  );
create policy "관리자/운영자 쓰기" on contract_versions for all
  using (is_admin() or current_user_has_capability('manage_consultations'))
  with check (is_admin() or current_user_has_capability('manage_consultations'));

-- =========================================================================
-- 6. drive_artifacts.sync_status enum 확인
-- =========================================================================
--
-- 정책: "drive_artifacts.sync_status는 이미 v3_drive_job_status enum을 재사용
-- 중이었다(queued/processing/succeeded/retryable_failed/manual_review) — 이름
-- 맞으면 추가 작업 불필요, 확인만 하라." 20260912000000 §6에서
-- `sync_status v3_drive_job_status not null default 'queued'`로 이미 정확히
-- 재사용하고 있음을 확인했다 — 스키마 변경 불필요.

-- =========================================================================
-- 7. 보호자 동의 통합 — R2 구조 재사용 확인(신규 동의 테이블 없음)
-- =========================================================================
--
-- 정책: "만 13세 미만 판단·필수 보호자 동의는 R2의 기존 consent_policy_versions/
-- guardian_consents 구조를 그대로 재사용 — 새 동의 테이블을 만들지 마라."
--
-- 확인 결과(20260904000000_r2_minor_consent.sql grep): guardian_consents는
-- student_id(profiles.id)에만 연결되고 계약/체험 등 어떤 R3 테이블도 참조하지
-- 않는 완전히 독립적인 구조다. is_under_13(p_student_id)/has_valid_guardian_consent
-- (p_student_id)/current_account_access_allowed()도 전부 student_id 또는
-- auth.uid() 기준으로만 동작하며 계약 존재 여부와 무관하게 평가 가능하다.
-- 따라서 "기본계약보다 체험이 먼저인 경우, 동의 문서만 먼저 서명받아 이후
-- 가족계약 버전에 연결"하는 흐름에 추가 스키마가 필요 없다는 정책 판단이
-- 확인된다 — consent_as_guardian()으로 미리 동의를 기록해두면(student_id만
-- 있으면 되고 household_members에 자녀로 등록만 돼 있으면 충분, 계약 자체가
-- 아직 없어도 무방) 이후 계약 버전 생성 시점에 has_valid_guardian_consent()로
-- 조회하는 것으로 충분하다. 결론: 신규 스키마 불필요(확인만, 변경 없음).
--
-- 다만 R3 흐름(체험 참여 허용, 계약 활성화)에서 이 R2 함수를 실제로 호출하는
-- 훅이 아직 앱 코드에 없다(consultation-actions.ts/contracts-actions.ts에
-- is_under_13/current_account_access_allowed 참조 없음 — grep 결과 없음).
-- 스키마 레벨에서 최소한의 방어선으로 트리거를 추가한다: 체험 생성 시 및 계약
-- 활성화(activate) 시 학생이 13세 미만이면서 유효한 동의가 없으면 차단한다.
-- fail-closed 원칙(R2 is_under_13: date_of_birth null이면 13세 미만 취급)을
-- 그대로 물려받는다.

create or replace function public.assert_guardian_consent_ok(p_student_id uuid, p_context text)
returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if is_under_13(p_student_id) and not has_valid_guardian_consent(p_student_id) then
    raise exception '% : 만 13세 미만 학생은 유효한 보호자 동의가 있어야 진행할 수 있습니다(학생 id: %).', p_context, p_student_id;
  end if;
end;
$$;
comment on function public.assert_guardian_consent_ok(uuid, text) is
  'R3 교정(2026-09-13): R2 is_under_13()/has_valid_guardian_consent() 재사용 훅. '
  '생년월일 없으면 is_under_13()이 fail-closed(true)로 판정하므로 이 함수도 자동으로 fail-closed. '
  '체험 생성(trial_sessions insert)과 계약 활성화(contracts.status→active 전이) 두 지점에서 트리거로 호출한다.';
revoke execute on function public.assert_guardian_consent_ok(uuid, text) from public;
grant execute on function public.assert_guardian_consent_ok(uuid, text) to authenticated;

create or replace function public.trial_sessions_check_guardian_consent()
returns trigger language plpgsql as $$
begin
  perform assert_guardian_consent_ok(new.child_id, '체험 세션 생성');
  return new;
end;
$$;
create trigger trial_sessions_guardian_consent_check
  before insert on trial_sessions
  for each row execute function public.trial_sessions_check_guardian_consent();

create or replace function public.contracts_check_guardian_consent()
returns trigger language plpgsql as $$
begin
  if new.status = 'active' and (old is null or old.status is distinct from 'active') then
    perform assert_guardian_consent_ok(new.child_id, '계약 활성화');
  end if;
  return new;
end;
$$;
create trigger contracts_guardian_consent_check
  before insert or update on contracts
  for each row execute function public.contracts_check_guardian_consent();

-- =========================================================================
-- 8. AI 회의록(Smart Notes) 사용 여부 선택 — 별도 동의와 명시적으로 분리
-- =========================================================================
--
-- 정책: "필수 개인정보 동의"와 "선택적 AI 사용"은 명시적으로 분리돼야 한다.
-- guardian_consents(R2, 필수)와 완전히 별개의 작은 이력 테이블을 둔다 — 선택값·
-- 정책버전·선택자·시각·적용일·철회 이력을 기록한다. 실제 Smart Notes on/off 로직·
-- 수동 리뷰 task는 이번 범위 밖(R6/R9) — 여기서는 선택 기록 스키마만 만든다.
create table ai_notes_consent_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id),
  opted_in boolean not null,
  policy_version text not null,
  actor_id uuid not null references profiles (id),
  effective_at timestamptz not null default now(),
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now()
);
create index on ai_notes_consent_events (student_id, effective_at desc);

comment on table ai_notes_consent_events is
  'R3 교정(2026-09-13): AI/Smart Notes 사용 여부 선택 이력. guardian_consents(R2, 필수 개인정보 동의)와 '
  '정책상 명시적으로 분리된 별도 "선택적" 동의 트랙 — 같은 테이블에 합치지 않는다. '
  '실제 Smart Notes on/off 적용 로직과 수동 리뷰 task는 R6/R9 범위이며 이 마이그레이션에서 만들지 않는다.';

alter table ai_notes_consent_events enable row level security;
create policy "관리자/본인학생/보호자 조회" on ai_notes_consent_events for select
  using (
    is_admin()
    or student_id = auth.uid()
    or is_household_guardian_of(student_id)
  );
create policy "관리자/운영자 쓰기" on ai_notes_consent_events for all
  using (is_admin() or current_user_has_capability('manage_consultations'))
  with check (is_admin() or current_user_has_capability('manage_consultations'));

-- =========================================================================
-- 9. 결정 필요 항목(코드에는 반영하지 않음, 마이그레이션 코멘트로만 남김)
-- =========================================================================
--
-- 이 마이그레이션이 스스로 판단해 처리하지 않은 진짜 정책 충돌은 없었다 — 발견된
-- 유일한 실질 gap(contract_versions에 RLS가 아예 없었던 것, §5)은 정책 위반이
-- 아니라 이전 마이그레이션의 누락으로 판단해 이번에 채웠다. product-architecture-v3
-- §5.5/master-roadmap R3 문서 자체가 "계약에 과목/가격 고정" 구조를 전제로
-- 서술돼 있다면 이는 새 정책보다 오래된 문서 기술이므로, 이번 스키마 변경 이후
-- 해당 문서 절을 갱신하는 후속 작업이 필요하다(문서 갱신은 이 마이그레이션의
-- 범위 밖).

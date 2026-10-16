// R3 후속(2026-09-01) — 복귀 회원 계약 처리를 위한 최소 판단 구조.
//
// 목적은 재가입 기능 자체를 만드는 게 아니라, 나중에 기능을 붙일 때 기존 계약
// 구조를 다시 뜯지 않도록 "판단 기준"만 미리 준비하는 것이다. 이 함수는 부작용이
// 전혀 없다 — DB를 읽지도 쓰지도 않고, DocuSign이나 다른 외부 서비스도 호출하지
// 않는다. 호출부(관리자 UI/서버 액션)가 계약·계약버전 상태를 조회해 이 함수의
// 입력으로 넘기고, 반환된 판단에 따라 실제 처리(재처리/유지/새 버전 생성/수동
// 검토)를 별도로 수행한다.
//
// 학생별 contracts 레코드는 계속 1개를 유지한다(§4.12) — 이 함수는 새 계약을
// 만들지 여부를 판단하지 않고, 기존 계약 아래에서 어떤 종류의 처리가 필요한지만
// 판단한다.

export type ContractLifecycleStatus =
  | "draft"
  | "ready"
  | "sent"
  | "awaiting_signature"
  | "signed"
  | "active"
  | "termination_pending"
  | "terminated"
  | "void"
  | "superseded"
  | "expired";

export type ReturningMemberDecision =
  | "retry_activation"
  | "resume_existing"
  | "create_new_version"
  | "manual_review";

/**
 * create_new_version을 반환할 때, 호출부가 새 계약 버전의 version_reason을
 * 무엇으로 남겨야 하는지 판단할 수 있도록 사유를 함께 넘긴다. 이 함수 자체는
 * version_reason 문자열(예: 're_enrollment')을 모른다 — 그건 호출부가 결정할
 * 개념이지만, "왜 create_new_version인지"를 잃어버리면 호출부가 party_change와
 * re_enrollment를 구분할 수 없으므로 그 구분만 여기서 명시적으로 남긴다.
 */
export type CreateNewVersionReason =
  | "terminated_or_expired"
  | "party_or_material_change"
  | "returning_from_inactive";

export type ReturningMemberDecisionResult =
  | { decision: "create_new_version"; reason: CreateNewVersionReason }
  | { decision: Exclude<ReturningMemberDecision, "create_new_version"> };

export interface ReturningMemberDecisionInput {
  /** contracts.status의 현재 값. */
  contractStatus: ContractLifecycleStatus;
  /**
   * 서명(contractStatus === "signed")은 끝났으나 생년월일·보호자 동의 등
   * 활성화 선행조건이 실제로 누락돼 있는지. contractStatus가 "signed"가
   * 아니면 이 값은 무시된다.
   */
  missingActivationPrerequisites: boolean;
  /**
   * 계약 당사자(회사 법적 주체 — 법인 설립 전/후 등)가 바뀌었는지.
   * true면 party_change 사유로 새 버전이 필요하다.
   */
  companyPartyChanged: boolean;
  /**
   * 개인정보처리방침·환불정책 등 계약 버전에 스냅샷되는 "중요 약관" 자체가
   * 바뀌었는지. 과목·선생님·일정·수업권·가격 변경은 여기 포함하지 않는다 —
   * 그런 변경은 기본계약 재서명 사유가 아니다(정책 원칙).
   */
  materialTermsChanged: boolean;
  /**
   * 이 판단에 필요한 정보(계약 상태, 활성화 선행조건 충족 여부 등)가 충분한지.
   * false면 다른 필드와 무관하게 manual_review — "몇 개월 경과 시 재서명"처럼
   * 아직 확정되지 않은 기준에 기대어 자동 판단하지 않는다.
   */
  hasSufficientPolicyInfo: boolean;
  /**
   * 학생 계정이 inactive 상태였다가 "장기 복귀"하는 경우인지(단순히 계약이
   * 일시중단됐지만 여전히 유효한 경우와는 다르다 — 그건 contractStatus로
   * 판단한다). true면 기존 계약이 아무리 유효해(resume 가능해) 보여도 과거
   * 계약을 그대로 재활성화하지 않고 항상 새 버전을 만든다
   * (version_reason='re_enrollment', 다만 그 문자열 자체는 호출부가 붙인다).
   * hasSufficientPolicyInfo가 false면 이 필드와 무관하게 여전히 manual_review다
   * — "몇 개월 경과 시 자동 재서명" 같은 기간 기준은 이 함수가 판단하지 않는다.
   */
  accountReturningFromInactive: boolean;
}

const TERMINATED_OR_EXPIRED_STATUSES = new Set<ContractLifecycleStatus>(["void", "terminated", "expired"]);

// 이 함수가 "복귀 회원" 판단 대상으로 다루는 상태만 명시적으로 화이트리스트한다.
// draft/ready/sent/awaiting_signature/termination_pending/superseded는 각각
// 다른 진행 중 흐름(계약 준비/발송/해지 진행 등)에 속하며, 이 함수의 판단
// 범위 밖이다 — 임의로 resume/new_version으로 추측하지 않고 manual_review로
// 보낸다.
const RESUMABLE_STATUSES = new Set<ContractLifecycleStatus>(["active", "signed"]);

/**
 * 복귀(재가입) 시나리오에서 기존 계약을 어떻게 처리할지 판단한다. 순수 함수 —
 * 동일 입력에는 항상 동일 결과를 반환하고, DB·외부 API를 전혀 호출하지 않는다.
 */
export function decideReturningMemberContractAction(
  input: ReturningMemberDecisionInput
): ReturningMemberDecisionResult {
  if (!input.hasSufficientPolicyInfo) {
    return { decision: "manual_review" };
  }

  // 서명 후 정보 누락 → 같은 버전 재처리(새 envelope 없음). 계정 장기 복귀
  // 여부와 무관하게, 서명 자체는 이미 끝났으므로 그대로 재처리한다.
  if (input.contractStatus === "signed" && input.missingActivationPrerequisites) {
    return { decision: "retry_activation" };
  }

  const materialChange = input.companyPartyChanged || input.materialTermsChanged;

  // 해지·무효·만료 → 새 계약 버전(사유: terminated_or_expired).
  if (TERMINATED_OR_EXPIRED_STATUSES.has(input.contractStatus)) {
    return { decision: "create_new_version", reason: "terminated_or_expired" };
  }

  // 계약 당사자·중요 약관 변경 → 새 계약 버전(사유: party_or_material_change).
  if (materialChange) {
    return { decision: "create_new_version", reason: "party_or_material_change" };
  }

  // 계정이 inactive에서 장기 복귀하는 경우 → 기존 계약이 겉보기엔 resume
  // 가능해도(예: active/signed) 과거 계약을 재활성화하지 않고 새 버전을
  // 만든다. 호출부는 이 사유(returning_from_inactive)를 보고
  // version_reason='re_enrollment'를 적용한다 — party_change/
  // material_terms_change와 구분된다.
  if (input.accountReturningFromInactive) {
    return { decision: "create_new_version", reason: "returning_from_inactive" };
  }

  // 단순 휴면 후 복귀, 기존 계약이 유효하고 중요 변경 없음 → 기존 계약 유지.
  if (RESUMABLE_STATUSES.has(input.contractStatus)) {
    return { decision: "resume_existing" };
  }

  return { decision: "manual_review" };
}

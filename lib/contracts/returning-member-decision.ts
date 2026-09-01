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
): ReturningMemberDecision {
  if (!input.hasSufficientPolicyInfo) {
    return "manual_review";
  }

  // 서명 후 정보 누락 → 같은 버전 재처리(새 envelope 없음).
  if (input.contractStatus === "signed" && input.missingActivationPrerequisites) {
    return "retry_activation";
  }

  const materialChange = input.companyPartyChanged || input.materialTermsChanged;

  // 해지·무효·만료 또는 계약 당사자·중요 약관 변경 → 새 계약 버전.
  if (TERMINATED_OR_EXPIRED_STATUSES.has(input.contractStatus) || materialChange) {
    return "create_new_version";
  }

  // 단순 휴면 후 복귀, 기존 계약이 유효하고 중요 변경 없음 → 기존 계약 유지.
  if (RESUMABLE_STATUSES.has(input.contractStatus)) {
    return "resume_existing";
  }

  return "manual_review";
}

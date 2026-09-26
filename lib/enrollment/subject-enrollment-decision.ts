// R5 — 과목 수강/선생님 배정 순수 판단 로직.
//
// returning-member-decision.ts와 동일한 목적: DB를 읽지도 쓰지도 않는 순수
// 함수로 판단 기준만 분리해 서버 액션·테스트가 재사용한다. 실제 조회는
// app/admin/subject-enrollment-actions.ts가 담당한다.

export type SubjectEnrollmentActivationInput = {
  /** 이 아이의 기본계약(contracts, v3) 현재 status. */
  contractStatus: string;
  /** subject_enrollment_activation_ready() RPC 결과 그대로. */
  activationReady: boolean;
};

export type SubjectEnrollmentActivationResult =
  | { canActivate: true }
  | { canActivate: false; blockedBy: "contract_not_active" | "no_paid_entitlement" | "both" };

/**
 * planned/paused → active 전환 가능 여부. DB 트리거
 * (subject_enrollments_enforce_activation)가 최종 방어선이지만, 관리자 화면은
 * 원시 DB 에러 대신 이 함수로 미리 판단해 구체적인 안내를 보여준다.
 */
export function decideSubjectEnrollmentActivation(
  input: SubjectEnrollmentActivationInput
): SubjectEnrollmentActivationResult {
  const contractOk = input.contractStatus === "active";
  if (contractOk && input.activationReady) return { canActivate: true };
  if (!contractOk && !input.activationReady) return { canActivate: false, blockedBy: "both" };
  if (!contractOk) return { canActivate: false, blockedBy: "contract_not_active" };
  return { canActivate: false, blockedBy: "no_paid_entitlement" };
}

/**
 * 오래 쉬었다 돌아온 회원의 과목 수강 처리 — 기존 종료된 subject_enrollments
 * 행을 절대 되살리지 않고 항상 새 행을 만든다는 정책을 담은 판단.
 * returning-member-decision.ts의 create_new_version/returning_from_inactive와
 * 동일한 정신을 subject_enrollments 테이블에 적용한 것.
 */
export type ReturningEnrollmentDecisionInput = {
  /** 같은 child_id/subject_id로 과거에 completed/terminated된 행이 있는지. */
  hasEndedEnrollmentForSubject: boolean;
  /** 지금 같은 child_id/subject_id로 live(planned/active/paused) 행이 있는지. */
  hasLiveEnrollmentForSubject: boolean;
};

export type ReturningEnrollmentDecision =
  | { decision: "reuse_live_enrollment" }
  | { decision: "create_new_enrollment" };

export function decideReturningSubjectEnrollment(
  input: ReturningEnrollmentDecisionInput
): ReturningEnrollmentDecision {
  // 살아있는 수강이 이미 있으면 그걸 쓴다(중복 방지 — DB unique index와 일치).
  if (input.hasLiveEnrollmentForSubject) return { decision: "reuse_live_enrollment" };
  // 과거 종료된 행이 있어도, 없어도 결론은 같다 — 항상 새 행. ended 행은 다시
  // 쓰지 않는다(진행/리뷰/자료 이력을 과거 배정에 그대로 귀속시키기 위함).
  return { decision: "create_new_enrollment" };
}

// ---------------------------------------------------------------------------
// 선생님 배정
// ---------------------------------------------------------------------------

export type TrialSuccessionEligibility = {
  isActive: boolean;
  hasSubjectQualification: boolean;
  hasCurriculum: boolean;
  hasValidRate: boolean;
};

export type TrialSuccessionProposal =
  | { canPropose: true }
  | {
      canPropose: false;
      blockedBy: Array<"not_active" | "no_subject_qualification" | "no_valid_rate">;
    };

/**
 * 체험 선생님이 정규 선생님으로 기본 제안될 수 있는지. 커리큘럼 미보유는
 * 여기 blockedBy에 포함하지 않는다 — spec: "missing curriculum ≠ unqualified".
 * 화면에는 hasCurriculum을 별도 정보로만 보여준다.
 */
export function decideTrialTeacherSuccessionProposal(
  e: TrialSuccessionEligibility
): TrialSuccessionProposal {
  const blockedBy: Array<"not_active" | "no_subject_qualification" | "no_valid_rate"> = [];
  if (!e.isActive) blockedBy.push("not_active");
  if (!e.hasSubjectQualification) blockedBy.push("no_subject_qualification");
  if (!e.hasValidRate) blockedBy.push("no_valid_rate");
  if (blockedBy.length === 0) return { canPropose: true };
  return { canPropose: false, blockedBy };
}

export const TRIAL_SUCCESSION_BLOCK_MESSAGES: Record<string, string> = {
  not_active: "이 선생님은 현재 active 상태가 아닙니다.",
  no_subject_qualification: "이 선생님은 아직 이 과목 자격이 등록되지 않았습니다.",
  no_valid_rate: "이 선생님은 아직 시급이 설정되지 않아 배정할 수 없습니다. 시급을 먼저 설정하세요.",
};

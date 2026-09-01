import { describe, expect, it } from "vitest";
import {
  decideReturningMemberContractAction,
  type ReturningMemberDecisionInput,
} from "./returning-member-decision";

function baseInput(overrides: Partial<ReturningMemberDecisionInput> = {}): ReturningMemberDecisionInput {
  return {
    contractStatus: "active",
    missingActivationPrerequisites: false,
    companyPartyChanged: false,
    materialTermsChanged: false,
    hasSufficientPolicyInfo: true,
    ...overrides,
  };
}

describe("decideReturningMemberContractAction", () => {
  it("completed(signed) + 활성화 선행조건 누락 → retry_activation", () => {
    const result = decideReturningMemberContractAction(
      baseInput({ contractStatus: "signed", missingActivationPrerequisites: true })
    );
    expect(result).toBe("retry_activation");
  });

  it("유효한 계약(active) + 중요 변경 없음 → resume_existing", () => {
    const result = decideReturningMemberContractAction(
      baseInput({ contractStatus: "active", missingActivationPrerequisites: false })
    );
    expect(result).toBe("resume_existing");
  });

  it("서명 완료(signed)이고 선행조건도 충족됐으면 → resume_existing (retry_activation 아님)", () => {
    const result = decideReturningMemberContractAction(
      baseInput({ contractStatus: "signed", missingActivationPrerequisites: false })
    );
    expect(result).toBe("resume_existing");
  });

  it.each(["void", "terminated", "expired"] as const)(
    "계약이 %s 상태면 → create_new_version",
    (status) => {
      const result = decideReturningMemberContractAction(baseInput({ contractStatus: status }));
      expect(result).toBe("create_new_version");
    }
  );

  it("계약은 active지만 회사 법적 주체가 변경됐으면 → create_new_version", () => {
    const result = decideReturningMemberContractAction(
      baseInput({ contractStatus: "active", companyPartyChanged: true })
    );
    expect(result).toBe("create_new_version");
  });

  it("계약은 active지만 중요 약관이 변경됐으면 → create_new_version", () => {
    const result = decideReturningMemberContractAction(
      baseInput({ contractStatus: "active", materialTermsChanged: true })
    );
    expect(result).toBe("create_new_version");
  });

  it("정책 판단에 필요한 정보가 부족하면 다른 조건과 무관하게 → manual_review", () => {
    const result = decideReturningMemberContractAction(
      baseInput({ contractStatus: "active", hasSufficientPolicyInfo: false })
    );
    expect(result).toBe("manual_review");
  });

  it.each(["draft", "ready", "sent", "awaiting_signature", "termination_pending", "superseded"] as const)(
    "이 함수의 판단 범위 밖인 상태(%s)는 추측하지 않고 → manual_review",
    (status) => {
      const result = decideReturningMemberContractAction(baseInput({ contractStatus: status }));
      expect(result).toBe("manual_review");
    }
  );

  it("과목·선생님·일정·수업권·가격 변경은 기본계약 재서명 사유가 아니므로 입력에 반영되지 않고 resume_existing을 유지한다", () => {
    // 이 함수의 입력에는애초에 과목/선생님/일정/수업권/가격 필드가 없다 —
    // 호출부가 그런 변경을 companyPartyChanged/materialTermsChanged로 잘못
    // 매핑하지만 않으면 자동으로 배제된다는 걸 명시적으로 남겨둔다.
    const result = decideReturningMemberContractAction(
      baseInput({ contractStatus: "active", companyPartyChanged: false, materialTermsChanged: false })
    );
    expect(result).toBe("resume_existing");
  });

  it("동일 입력은 항상 동일 결과를 반환한다(결정적)", () => {
    const input = baseInput({ contractStatus: "signed", missingActivationPrerequisites: true });
    const results = Array.from({ length: 20 }, () => decideReturningMemberContractAction(input));
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe("retry_activation");
  });

  it("manual_review 판단은 입력을 변경하지 않는다(부작용 없음)", () => {
    const input = baseInput({ hasSufficientPolicyInfo: false });
    const frozen = Object.freeze({ ...input });
    expect(() => decideReturningMemberContractAction(frozen)).not.toThrow();
  });
});

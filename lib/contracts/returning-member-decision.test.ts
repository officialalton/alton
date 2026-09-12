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
    accountReturningFromInactive: false,
    ...overrides,
  };
}

describe("decideReturningMemberContractAction", () => {
  it("completed(signed) + 활성화 선행조건 누락 → retry_activation", () => {
    const result = decideReturningMemberContractAction(
      baseInput({ contractStatus: "signed", missingActivationPrerequisites: true })
    );
    expect(result).toEqual({ decision: "retry_activation" });
  });

  it("유효한 계약(active) + 중요 변경 없음 → resume_existing", () => {
    const result = decideReturningMemberContractAction(
      baseInput({ contractStatus: "active", missingActivationPrerequisites: false })
    );
    expect(result).toEqual({ decision: "resume_existing" });
  });

  it("서명 완료(signed)이고 선행조건도 충족됐으면 → resume_existing (retry_activation 아님)", () => {
    const result = decideReturningMemberContractAction(
      baseInput({ contractStatus: "signed", missingActivationPrerequisites: false })
    );
    expect(result).toEqual({ decision: "resume_existing" });
  });

  it.each(["void", "terminated", "expired"] as const)(
    "계약이 %s 상태면 → create_new_version(사유: terminated_or_expired)",
    (status) => {
      const result = decideReturningMemberContractAction(baseInput({ contractStatus: status }));
      expect(result).toEqual({ decision: "create_new_version", reason: "terminated_or_expired" });
    }
  );

  it("계약은 active지만 회사 법적 주체가 변경됐으면 → create_new_version(사유: party_or_material_change)", () => {
    const result = decideReturningMemberContractAction(
      baseInput({ contractStatus: "active", companyPartyChanged: true })
    );
    expect(result).toEqual({ decision: "create_new_version", reason: "party_or_material_change" });
  });

  it("계약은 active지만 중요 약관이 변경됐으면 → create_new_version(사유: party_or_material_change)", () => {
    const result = decideReturningMemberContractAction(
      baseInput({ contractStatus: "active", materialTermsChanged: true })
    );
    expect(result).toEqual({ decision: "create_new_version", reason: "party_or_material_change" });
  });

  it("정책 판단에 필요한 정보가 부족하면 다른 조건과 무관하게 → manual_review", () => {
    const result = decideReturningMemberContractAction(
      baseInput({ contractStatus: "active", hasSufficientPolicyInfo: false })
    );
    expect(result).toEqual({ decision: "manual_review" });
  });

  it.each(["draft", "ready", "sent", "awaiting_signature", "termination_pending", "superseded"] as const)(
    "이 함수의 판단 범위 밖인 상태(%s)는 추측하지 않고 → manual_review",
    (status) => {
      const result = decideReturningMemberContractAction(baseInput({ contractStatus: status }));
      expect(result).toEqual({ decision: "manual_review" });
    }
  );

  it("과목·선생님·일정·수업권·가격 변경은 기본계약 재서명 사유가 아니므로 입력에 반영되지 않고 resume_existing을 유지한다", () => {
    // 이 함수의 입력에는애초에 과목/선생님/일정/수업권/가격 필드가 없다 —
    // 호출부가 그런 변경을 companyPartyChanged/materialTermsChanged로 잘못
    // 매핑하지만 않으면 자동으로 배제된다는 걸 명시적으로 남겨둔다.
    const result = decideReturningMemberContractAction(
      baseInput({ contractStatus: "active", companyPartyChanged: false, materialTermsChanged: false })
    );
    expect(result).toEqual({ decision: "resume_existing" });
  });

  it("동일 입력은 항상 동일 결과를 반환한다(결정적)", () => {
    const input = baseInput({ contractStatus: "signed", missingActivationPrerequisites: true });
    const results = Array.from({ length: 20 }, () => decideReturningMemberContractAction(input));
    const decisions = new Set(results.map((r) => r.decision));
    expect(decisions.size).toBe(1);
    expect(results[0]).toEqual({ decision: "retry_activation" });
  });

  it("manual_review 판단은 입력을 변경하지 않는다(부작용 없음)", () => {
    const input = baseInput({ hasSufficientPolicyInfo: false });
    const frozen = Object.freeze({ ...input });
    expect(() => decideReturningMemberContractAction(frozen)).not.toThrow();
  });

  describe("accountReturningFromInactive — 신규 정책(2026-09-01 이어서)", () => {
    it("계정이 inactive에서 장기 복귀하면, 기존 계약이 resume 가능해(active) 보여도 → create_new_version(사유: returning_from_inactive)", () => {
      const result = decideReturningMemberContractAction(
        baseInput({
          contractStatus: "active",
          missingActivationPrerequisites: false,
          companyPartyChanged: false,
          materialTermsChanged: false,
          accountReturningFromInactive: true,
        })
      );
      expect(result).toEqual({ decision: "create_new_version", reason: "returning_from_inactive" });
    });

    it("계정이 inactive에서 장기 복귀하면, 계약 상태가 signed(resume 가능)여도 → create_new_version(사유: returning_from_inactive)", () => {
      const result = decideReturningMemberContractAction(
        baseInput({
          contractStatus: "signed",
          missingActivationPrerequisites: false,
          accountReturningFromInactive: true,
        })
      );
      expect(result).toEqual({ decision: "create_new_version", reason: "returning_from_inactive" });
    });

    it("호출부는 반환값의 reason으로 re_enrollment를 party_change/material_terms_change/terminated_or_expired와 구분할 수 있다", () => {
      const reEnrollment = decideReturningMemberContractAction(
        baseInput({ contractStatus: "active", accountReturningFromInactive: true })
      );
      const partyChange = decideReturningMemberContractAction(
        baseInput({ contractStatus: "active", companyPartyChanged: true })
      );
      const terminated = decideReturningMemberContractAction(baseInput({ contractStatus: "terminated" }));

      expect(reEnrollment).toEqual({ decision: "create_new_version", reason: "returning_from_inactive" });
      expect(partyChange).toEqual({ decision: "create_new_version", reason: "party_or_material_change" });
      expect(terminated).toEqual({ decision: "create_new_version", reason: "terminated_or_expired" });

      // 셋 다 create_new_version이지만 reason은 서로 다르다 — 호출부가 이 reason을
      // 보고서만 version_reason='re_enrollment' vs 'party_change' vs
      // 'material_terms_change'(호출부 개념)를 정확히 고를 수 있다.
      if (reEnrollment.decision === "create_new_version" && partyChange.decision === "create_new_version") {
        expect(reEnrollment.reason).not.toBe(partyChange.reason);
      }
    });

    it("accountReturningFromInactive가 true여도 hasSufficientPolicyInfo가 false면 여전히 manual_review", () => {
      const result = decideReturningMemberContractAction(
        baseInput({
          contractStatus: "active",
          accountReturningFromInactive: true,
          hasSufficientPolicyInfo: false,
        })
      );
      expect(result).toEqual({ decision: "manual_review" });
    });

    it("서명 후 활성화 선행조건만 누락된 경우엔 accountReturningFromInactive가 true여도 retry_activation을 유지한다(서명 자체는 끝났으므로)", () => {
      const result = decideReturningMemberContractAction(
        baseInput({
          contractStatus: "signed",
          missingActivationPrerequisites: true,
          accountReturningFromInactive: true,
        })
      );
      expect(result).toEqual({ decision: "retry_activation" });
    });

    it("동일 입력(accountReturningFromInactive: true)은 항상 동일 결과를 반환한다(결정적)", () => {
      const input = baseInput({ contractStatus: "active", accountReturningFromInactive: true });
      const results = Array.from({ length: 20 }, () => decideReturningMemberContractAction(input));
      expect(results.every((r) => r.decision === "create_new_version")).toBe(true);
      expect(
        results.every((r) => r.decision === "create_new_version" && r.reason === "returning_from_inactive")
      ).toBe(true);
    });
  });
});

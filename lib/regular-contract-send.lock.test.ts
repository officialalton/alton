import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/contract-send-internal", () => ({
  companySignOffContractVersionInternal: vi.fn(),
  sendContractForSignatureInternal: vi.fn(),
}));
vi.mock("@/lib/contract-company-approval", () => ({ recordOrGetCompanyApproval: vi.fn() }));
vi.mock("@/lib/request-origin", () => ({ currentRequestOrigin: vi.fn().mockResolvedValue("http://localhost") }));
vi.mock("@/lib/vercel-protection-bypass", () => ({ appendVercelProtectionBypass: (u: string) => u }));

import { CONTRACT_SEND_IN_PROGRESS_ERROR, sendRegularContractForSubjectEnrollment } from "./regular-contract-send";

const params = {
  childId: "child-1",
  subjectEnrollmentId: "se-1",
  guardianEmail: "g@example.com",
  guardianName: "보호자",
  childName: "학생",
  approverName: "a",
  approverTitle: "t",
  triggeredByUserId: "u",
};

// 2026-09-29(D3b) — 자녀 단위 임대를 못 잡으면 계약 생성·발송 RPC 를 아예 호출하지 않는다.
describe("sendRegularContractForSubjectEnrollment — 자녀 단위 발송 잠금", () => {
  it("잠금을 못 잡으면 아무 것도 보내지 않고 '진행 중' 실패를 돌려준다", async () => {
    const rpc = vi.fn(async (name: string) => (name === "try_acquire_child_contract_send_lock" ? { data: null, error: null } : { data: null, error: null }));
    const result = await sendRegularContractForSubjectEnrollment({ rpc, from: vi.fn() } as never, params);
    expect(result).toEqual({ status: "failed", contractVersionId: "", error: CONTRACT_SEND_IN_PROGRESS_ERROR });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("잠금을 잡았으면 끝난 뒤(오류가 나도) 반드시 해제한다", async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === "try_acquire_child_contract_send_lock") return { data: "tok-1", error: null };
      if (name === "get_or_create_draft_contract_for_child") return { data: null, error: { message: "boom" } };
      return { data: null, error: null };
    });
    await expect(sendRegularContractForSubjectEnrollment({ rpc, from: vi.fn() } as never, params)).rejects.toThrow("boom");
    expect(rpc).toHaveBeenLastCalledWith("release_child_contract_send_lock", { p_child_id: "child-1", p_token: "tok-1" });
  });
});

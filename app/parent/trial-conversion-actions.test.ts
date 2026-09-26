import { beforeEach, describe, expect, it, vi } from "vitest";

// 2026-09-06(제품 오너 정책 변경) — 보호자가 "정규 진행 희망"을 확인하면
// 자동으로 계약이 발송돼야 한다(승인자 "CEO, Do Kyung Kim" 고정). 이 테스트는
// 1) RPC 성공 직후 sendRegularContractForSubjectEnrollment가 고정 승인자
// 값으로 호출되는지, 2) 자동 발송이 던지는 에러가 confirmRegularProgressIntent
// 자체를 실패시키지 않는지(best-effort) 두 가지를 고정한다.

const rpcMock = vi.fn();
const supabaseMock = { rpc: rpcMock };

const adminFromMock = vi.fn();
const sendRegularContractForSubjectEnrollmentMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({
    user: { id: "guardian1", email: "guardian@example.com" },
    profile: { role: "parent", name: "김민지" },
    supabase: supabaseMock,
  }),
}));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}));
vi.mock("@/lib/regular-contract-send", () => ({
  sendRegularContractForSubjectEnrollment: sendRegularContractForSubjectEnrollmentMock,
}));

function mockEnrollmentAndChild() {
  adminFromMock.mockImplementation((table: string) => {
    if (table === "subject_enrollments") {
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: "se1", child_id: "child1" }, error: null }) }) }) };
    }
    if (table === "profiles") {
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { name: "학생1" }, error: null }) }) }) };
    }
    throw new Error(`unexpected table ${table}`);
  });
}

describe("confirmRegularProgressIntent — 정규 진행 희망 확인 시 자동 계약 발송", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({ data: "selection1", error: null });
    mockEnrollmentAndChild();
  });

  it("RPC 성공 직후 승인자 'CEO, Do Kyung Kim' 고정값으로 자동 발송을 트리거한다", async () => {
    sendRegularContractForSubjectEnrollmentMock.mockResolvedValue({
      status: "sent",
      contractVersionId: "version1",
      envelopeId: "env1",
    });
    const { confirmRegularProgressIntent } = await import("./trial-conversion-actions");

    const result = await confirmRegularProgressIntent("se1");

    expect(result).toEqual({ selectionId: "selection1" });
    expect(sendRegularContractForSubjectEnrollmentMock).toHaveBeenCalledTimes(1);
    expect(sendRegularContractForSubjectEnrollmentMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        childId: "child1",
        subjectEnrollmentId: "se1",
        guardianEmail: "guardian@example.com",
        guardianName: "김민지",
        childName: "학생1",
        approverName: "Do Kyung Kim",
        approverTitle: "CEO, Do Kyung Kim",
        triggeredByUserId: "guardian1",
      })
    );
  });

  it("계약 자동 발송이 실패해도(Preview DocuSign 게이트 등) 보호자의 확인 자체는 성공한다", async () => {
    sendRegularContractForSubjectEnrollmentMock.mockRejectedValue(new Error("DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS=true가 아니면 실제 DocuSign API를 호출하지 않습니다."));
    const { confirmRegularProgressIntent } = await import("./trial-conversion-actions");

    await expect(confirmRegularProgressIntent("se1")).resolves.toEqual({ selectionId: "selection1" });
  });

  it("정규 진행 희망 확인 RPC 자체가 실패하면 자동 발송을 시도하지 않고 에러를 던진다", async () => {
    rpcMock.mockResolvedValue({ error: { message: "확정된 체험 리뷰가 있어야 정규 진행을 희망할 수 있습니다." } });
    const { confirmRegularProgressIntent } = await import("./trial-conversion-actions");

    await expect(confirmRegularProgressIntent("se1")).rejects.toThrow("확정된 체험 리뷰");
    expect(sendRegularContractForSubjectEnrollmentMock).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./users-actions", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ supabase: {}, adminUserId: "admin1" }),
  inviteParent: vi.fn().mockResolvedValue("parent1"),
  inviteStudent: vi.fn().mockResolvedValue("student1"),
}));

const createEnvelopeMock = vi.fn().mockResolvedValue({ envelopeId: "env-1" });
vi.mock("@/lib/docusign", () => ({
  createEnvelope: createEnvelopeMock,
}));

const consultSingleMock = vi.fn();
const contractsInsertMock = vi.fn().mockResolvedValue({ error: null });
const consultUpdateEqMock = vi.fn().mockResolvedValue({ error: null });

const fromMock = vi.fn((table: string) => {
  if (table === "consult_requests") {
    return {
      select: () => ({ eq: () => ({ single: consultSingleMock }) }),
      update: () => ({ eq: consultUpdateEqMock }),
    };
  }
  if (table === "contracts") {
    return { insert: contractsInsertMock };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

describe("sendFamilyContract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consultSingleMock.mockResolvedValue({
      data: { person_name: "김민지", email: "minji@example.com", student_grade: "10학년" },
      error: null,
    });
    contractsInsertMock.mockResolvedValue({ error: null });
    consultUpdateEqMock.mockResolvedValue({ error: null });
    createEnvelopeMock.mockResolvedValue({ envelopeId: "env-1" });
  });

  it("부모/학생 계정을 만들고 봉투를 발송한 뒤 contracts 행을 생성한다", async () => {
    const { sendFamilyContract } = await import("./contracts-actions");
    const { inviteParent, inviteStudent } = await import("./users-actions");

    await sendFamilyContract({
      consultRequestId: "c1",
      studentName: "지훈",
      studentEmail: "jihoon@example.com",
    });

    expect(inviteParent).toHaveBeenCalledWith({ name: "김민지", email: "minji@example.com" });
    expect(inviteStudent).toHaveBeenCalledWith({
      name: "지훈",
      email: "jihoon@example.com",
      parentId: "parent1",
      grade: "10학년",
    });
    expect(createEnvelopeMock).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: "minji@example.com", recipientName: "김민지" })
    );
    expect(contractsInsertMock).toHaveBeenCalledWith({
      parent_id: "parent1",
      student_id: "student1",
      docusign_envelope_id: "env-1",
      status: "sent",
    });
    expect(consultUpdateEqMock).toHaveBeenCalledWith("id", "c1");
  });

  it("존재하지 않는 상담 신청이면 에러를 던진다", async () => {
    consultSingleMock.mockResolvedValue({ data: null, error: null });
    const { sendFamilyContract } = await import("./contracts-actions");

    await expect(
      sendFamilyContract({ consultRequestId: "bad", studentName: "지훈", studentEmail: "x@example.com" })
    ).rejects.toThrow("존재하지 않는 상담 신청입니다.");
    expect(contractsInsertMock).not.toHaveBeenCalled();
  });

  it("DocuSign 발송이 실패하면 contracts 행을 만들지 않는다", async () => {
    createEnvelopeMock.mockRejectedValue(new Error("DocuSign 봉투 생성 실패: 500"));
    const { sendFamilyContract } = await import("./contracts-actions");

    await expect(
      sendFamilyContract({ consultRequestId: "c1", studentName: "지훈", studentEmail: "jihoon@example.com" })
    ).rejects.toThrow("DocuSign 봉투 생성 실패");
    expect(contractsInsertMock).not.toHaveBeenCalled();
  });
});

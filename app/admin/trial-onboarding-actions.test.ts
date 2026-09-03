import { describe, expect, it, vi, beforeEach } from "vitest";

const { adminRpcMock, adminFromMock, companySignOffMock, sendContractMock } = vi.hoisted(() => ({
  adminRpcMock: vi.fn(),
  adminFromMock: vi.fn(),
  companySignOffMock: vi.fn(),
  sendContractMock: vi.fn(),
}));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: adminRpcMock, from: adminFromMock }),
}));
vi.mock("@/lib/admin-auth", () => ({
  requireAdminOrCapability: vi.fn().mockResolvedValue({ actorUserId: "admin1" }),
}));
vi.mock("./subject-enrollment-actions", () => ({
  planSubjectEnrollment: vi.fn(),
  assignTeacherToSubjectEnrollment: vi.fn(),
}));
vi.mock("./consultation-actions", () => ({
  companySignOffContractVersion: companySignOffMock,
  sendContractForSignature: sendContractMock,
}));

import {
  confirmTrialIntentAction,
  createTrialOnboardingLinkAction,
  sendRegularContractOneClickAction,
} from "./trial-onboarding-actions";

describe("confirmTrialIntentAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("confirm_trial_intent RPC를 호출한다", async () => {
    adminRpcMock.mockResolvedValue({ error: null });
    await confirmTrialIntentAction("c1");
    expect(adminRpcMock).toHaveBeenCalledWith("confirm_trial_intent", {
      p_consultation_id: "c1",
      p_admin_id: "admin1",
    });
  });

  it("RPC 에러를 그대로 던진다(예: 관리자 추천 없이 확정 시도)", async () => {
    adminRpcMock.mockResolvedValue({ error: { message: "관리자 추천(trial_recommended) 결과가 기록된 상담만 체험 진행을 확정할 수 있습니다." } });
    await expect(confirmTrialIntentAction("c1")).rejects.toThrow("관리자 추천");
  });
});

describe("createTrialOnboardingLinkAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("student_email 등 전체 파라미터를 RPC에 그대로 전달한다", async () => {
    adminRpcMock.mockResolvedValue({ data: [{ link_id: "l1", raw_token: "tok" }], error: null });
    const result = await createTrialOnboardingLinkAction({
      consultationId: "c1",
      guardianEmail: "g@example.com",
      guardianName: "학부모",
      studentName: "학생",
      studentEmail: "s@example.com",
      studentGrade: "9학년",
    });
    expect(result).toEqual({ linkId: "l1", rawToken: "tok" });
    expect(adminRpcMock).toHaveBeenCalledWith("create_trial_onboarding_link", {
      p_consultation_id: "c1",
      p_guardian_email: "g@example.com",
      p_guardian_name: "학부모",
      p_student_name: "학생",
      p_student_email: "s@example.com",
      p_admin_id: "admin1",
      p_student_grade: "9학년",
    });
  });
});

// M4 인수 기준 13번 — "계약 발송 실패 후 재처리→성공"을 명시적으로 못박는다.
// 새 기능이 아니라 sendRegularContractOneClickAction()의 기존 재처리 설계
// (실패해도 draft 상태로 남아 같은 계약 버전으로 재시도 가능, 새 버전/새
// 선서명을 중복 생성하지 않음)를 테스트로 고정한다.
describe("sendRegularContractOneClickAction — 실패 후 재처리→성공", () => {
  beforeEach(() => vi.clearAllMocks());

  function mockSelectionExists() {
    return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "selection1" }, error: null }) }) }) };
  }

  it("1차 발송 실패는 draft 상태로 남고, 2차 재처리는 같은 계약 버전을 재사용해 회사 재선서명·새 버전 생성 없이 성공한다", async () => {
    let versionQueryCallCount = 0;
    adminFromMock.mockImplementation((table: string) => {
      if (table === "trial_regular_progress_selections") return mockSelectionExists();
      if (table === "contract_versions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => {
                    versionQueryCallCount += 1;
                    if (versionQueryCallCount === 1) {
                      // 1차 호출: 아직 계약 버전이 없음 — 새로 만든다.
                      return Promise.resolve({ data: [], error: null });
                    }
                    // 2차 호출(재처리): 1차에서 만든 버전이 이미 있고 회사
                    // 선서명도 이미 완료된 상태(company_signed_at 있음),
                    // docusign_envelope_id는 여전히 null(1차 발송 실패).
                    return Promise.resolve({
                      data: [{ id: "version1", docusign_envelope_id: null, docusign_envelope_status: null, company_signed_at: "2026-09-03T00:00:00Z" }],
                      error: null,
                    });
                  },
                }),
              }),
            }),
          }),
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: "version1" }, error: null }) }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    adminRpcMock.mockResolvedValue({ data: "contract1", error: null });
    companySignOffMock.mockResolvedValue(undefined);

    // 1차: DocuSign 발송 실패(예: DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS 비활성).
    sendContractMock.mockRejectedValueOnce(new Error("DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS=true가 아니면 실제 DocuSign API를 호출하지 않습니다."));
    const firstResult = await sendRegularContractOneClickAction({
      childId: "child1",
      subjectEnrollmentId: "se1",
      guardianEmail: "g@example.com",
      guardianName: "학부모",
      childName: "학생",
    });
    expect(firstResult).toEqual({
      status: "failed",
      contractVersionId: "version1",
      error: "DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS=true가 아니면 실제 DocuSign API를 호출하지 않습니다.",
    });
    expect(companySignOffMock).toHaveBeenCalledTimes(1); // 1차에서 딱 1번만 선서명.

    // 2차(재처리): 이번엔 발송 성공.
    sendContractMock.mockResolvedValueOnce({ envelopeId: "env-retry-1" });
    const secondResult = await sendRegularContractOneClickAction({
      childId: "child1",
      subjectEnrollmentId: "se1",
      guardianEmail: "g@example.com",
      guardianName: "학부모",
      childName: "학생",
    });
    expect(secondResult).toEqual({ status: "sent", contractVersionId: "version1", envelopeId: "env-retry-1" });

    // 재처리 때도 같은 계약 버전(version1)을 재사용했고, 회사 선서명은 여전히
    // 1번만 호출됐다(재서명 없음) — 중복 생성/중복 선서명이 없음을 확인.
    expect(companySignOffMock).toHaveBeenCalledTimes(1);
    expect(sendContractMock).toHaveBeenCalledTimes(2);
    expect(sendContractMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ contractVersionId: "version1" }));
  });

  it("이미 발송 완료(envelope 있음)된 계약 버전에 재클릭하면 중복 발송하지 않고 그대로 반환한다", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "trial_regular_progress_selections") return mockSelectionExists();
      if (table === "contract_versions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () =>
                    Promise.resolve({
                      data: [{ id: "version1", docusign_envelope_id: "env-already-sent", docusign_envelope_status: "sent", company_signed_at: "2026-09-03T00:00:00Z" }],
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    adminRpcMock.mockResolvedValue({ data: "contract1", error: null });

    const result = await sendRegularContractOneClickAction({
      childId: "child1",
      subjectEnrollmentId: "se1",
      guardianEmail: "g@example.com",
      guardianName: "학부모",
      childName: "학생",
    });
    expect(result).toEqual({ status: "already_sent", contractVersionId: "version1", envelopeId: "env-already-sent" });
    expect(sendContractMock).not.toHaveBeenCalled();
    expect(companySignOffMock).not.toHaveBeenCalled();
  });
});

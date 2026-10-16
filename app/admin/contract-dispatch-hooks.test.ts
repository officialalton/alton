import { beforeEach, describe, expect, it, vi } from "vitest";

// 즉시 발송 훅 — booking-actions(관리자 종료/재확정)와 retryFailedTrialOnboardingStudentAction.
const scheduleDispatchMock = vi.fn();
vi.mock("@/lib/contract-dispatch/immediate", () => ({
  scheduleContractDispatch: (...a: unknown[]) => scheduleDispatchMock(...a),
}));

const adminRpcMock = vi.fn();
const userRpcMock = vi.fn();
const adminFromMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: adminRpcMock, from: adminFromMock }),
}));
vi.mock("@/lib/admin-auth", () => ({
  requireAdminOrCapability: vi.fn().mockResolvedValue({ supabase: { rpc: userRpcMock }, actorUserId: "admin1" }),
}));
vi.mock("./subject-enrollment-actions", () => ({ planSubjectEnrollment: vi.fn(), assignTeacherToSubjectEnrollment: vi.fn() }));
vi.mock("@/lib/contract-send-internal", () => ({
  companySignOffContractVersionInternal: vi.fn(),
  sendContractForSignatureInternal: vi.fn(),
}));
vi.mock("@/lib/contract-company-approval", () => ({ recordOrGetCompanyApproval: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(), escapeHtml: (v: string) => v }));
vi.mock("@/lib/request-origin", () => ({ currentRequestOrigin: () => Promise.resolve("http://localhost") }));

function reopenedRows(rows: unknown[]) {
  adminFromMock.mockImplementation(() => ({
    select: () => ({ eq: () => ({ eq: () => ({ limit: async () => ({ data: rows }) }) }) }),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  adminRpcMock.mockResolvedValue({ error: null });
  userRpcMock.mockResolvedValue({ error: null });
});

describe("adminFinalizeLessonSession 훅", () => {
  it("completed 첫 판정 성공 후 세션 기준으로 예약한다", async () => {
    reopenedRows([]);
    const { adminFinalizeLessonSession } = await import("./booking-actions");
    await adminFinalizeLessonSession({ sessionId: "s1", outcome: "completed", reason: "r" });
    expect(scheduleDispatchMock).toHaveBeenCalledWith({ sessionId: "s1" });
  });
  it("reopen 뒤 재확정(recomplete) completed도 예약한다", async () => {
    reopenedRows([{ id: "e" }]);
    const { adminFinalizeLessonSession } = await import("./booking-actions");
    await adminFinalizeLessonSession({ sessionId: "s1", outcome: "completed", reason: "r" });
    expect(userRpcMock).toHaveBeenCalledWith("recomplete_session", expect.anything());
    expect(scheduleDispatchMock).toHaveBeenCalledWith({ sessionId: "s1" });
  });
  it("노쇼거나 RPC 오류면 예약하지 않는다", async () => {
    reopenedRows([]);
    const { adminFinalizeLessonSession } = await import("./booking-actions");
    await adminFinalizeLessonSession({ sessionId: "s1", outcome: "student_no_show", reason: "r" });
    adminRpcMock.mockResolvedValueOnce({ error: { message: "boom" } });
    await expect(adminFinalizeLessonSession({ sessionId: "s1", outcome: "completed", reason: "r" })).rejects.toThrow("boom");
    expect(scheduleDispatchMock).not.toHaveBeenCalled();
  });
});

describe("adminRecompleteSession 훅", () => {
  it("completed로 재판정될 때만 예약한다", async () => {
    const { adminRecompleteSession } = await import("./booking-actions");
    await adminRecompleteSession({ sessionId: "s2", newFinalStatus: "student_cancelled", reason: "r" });
    expect(scheduleDispatchMock).not.toHaveBeenCalled();
    await adminRecompleteSession({ sessionId: "s2", newFinalStatus: "completed", reason: "r" });
    expect(scheduleDispatchMock).toHaveBeenCalledWith({ sessionId: "s2" });
  });
});

describe("retryFailedTrialOnboardingStudentAction 훅", () => {
  function studentRow(row: unknown) {
    adminFromMock.mockImplementation(() => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
    }));
  }
  it("재시도로 계정이 만들어지면 그 자녀로 예약한다", async () => {
    studentRow({ student_name: "n", student_email: "e@x.com", student_grade: null, status: "failed", child_auth_user_id: "kid-1" });
    const { retryFailedTrialOnboardingStudentAction } = await import("./trial-onboarding-actions");
    const r = await retryFailedTrialOnboardingStudentAction("l1", "ls1");
    expect(r).toEqual({ status: "created", childId: "kid-1" });
    expect(scheduleDispatchMock).toHaveBeenCalledWith({ childIds: ["kid-1"] });
  });
  it("RPC 실패면 예약하지 않는다", async () => {
    studentRow({ student_name: "n", student_email: "e@x.com", student_grade: null, status: "failed", child_auth_user_id: "kid-1" });
    adminRpcMock.mockResolvedValueOnce({ error: { message: "boom" } });
    const { retryFailedTrialOnboardingStudentAction } = await import("./trial-onboarding-actions");
    const r = await retryFailedTrialOnboardingStudentAction("l1", "ls1");
    expect(r.status).toBe("failed");
    expect(scheduleDispatchMock).not.toHaveBeenCalled();
  });
});

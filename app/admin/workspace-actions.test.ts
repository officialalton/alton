import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
const teachersSingleMock = vi.fn();
const supabaseMock = {
  rpc: rpcMock,
  from: (table: string) => {
    if (table === "teachers") {
      return { select: () => ({ eq: () => ({ single: teachersSingleMock }) }) };
    }
    throw new Error(`unexpected table ${table}`);
  },
};

vi.mock("@/lib/admin-auth", () => ({
  requireAdminOrCapability: vi.fn().mockResolvedValue({ supabase: supabaseMock, actorUserId: "admin1" }),
}));

const adminRpcMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: adminRpcMock }),
}));

const createWorkspaceUserMock = vi.fn();
const suspendWorkspaceUserMock = vi.fn();
const reactivateWorkspaceUserMock = vi.fn();
vi.mock("@/lib/google-workspace", () => ({
  createWorkspaceUser: (...args: unknown[]) => createWorkspaceUserMock(...args),
  suspendWorkspaceUser: (...args: unknown[]) => suspendWorkspaceUserMock(...args),
  reactivateWorkspaceUser: (...args: unknown[]) => reactivateWorkspaceUserMock(...args),
}));

const sendWorkspaceProvisioningEmailMock = vi.fn();
vi.mock("@/lib/invite-email", () => ({
  sendWorkspaceProvisioningEmail: (...args: unknown[]) => sendWorkspaceProvisioningEmailMock(...args),
}));

const baseParams = {
  workspaceEmail: "newteacher@alton.education",
  personalContactEmail: "newteacher@personal.example",
  workspaceRecoveryEmail: "newteacher@personal.example",
  personalPhone: null,
  givenName: "새로운",
  familyName: "김",
};

describe("startTeacherWorkspaceProvisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendWorkspaceProvisioningEmailMock.mockResolvedValue(undefined);
  });

  it("성공 시: 생성 -> 이벤트 기록 -> 메일 발송 -> invite_sent 전이", async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "begin_teacher_workspace_provisioning") {
        return Promise.resolve({
          data: { id: "prov1", status: "creating", workspace_email: baseParams.workspaceEmail, workspace_google_user_id: null },
          error: null,
        });
      }
      if (fn === "record_workspace_created") return Promise.resolve({ error: null });
      if (fn === "mark_workspace_invite_sent") return Promise.resolve({ error: null });
      throw new Error(`unexpected rpc ${fn}`);
    });
    createWorkspaceUserMock.mockResolvedValue({ conflict: false, googleUserId: "google-uid-1" });

    const { startTeacherWorkspaceProvisioning } = await import("./workspace-actions");
    const result = await startTeacherWorkspaceProvisioning(baseParams);

    expect(result).toEqual({ ok: true });
    expect(createWorkspaceUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceEmail: baseParams.workspaceEmail })
    );
    expect(rpcMock).toHaveBeenCalledWith("record_workspace_created", {
      p_provisioning_id: "prov1",
      p_google_user_id: "google-uid-1",
    });
    expect(sendWorkspaceProvisioningEmailMock).toHaveBeenCalledWith({
      to: baseParams.personalContactEmail,
      workspaceEmail: baseParams.workspaceEmail,
    });
    expect(rpcMock).toHaveBeenCalledWith("mark_workspace_invite_sent", { p_provisioning_id: "prov1" });
  });

  it("Directory API 409 충돌: 재시도 불가로 분류(manual_review)하고 메일은 보내지 않으며, 관리자에게 실패를 알린다", async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "begin_teacher_workspace_provisioning") {
        return Promise.resolve({
          data: { id: "prov1", status: "creating", workspace_email: baseParams.workspaceEmail, workspace_google_user_id: null },
          error: null,
        });
      }
      if (fn === "record_workspace_creation_failed") return Promise.resolve({ error: null });
      throw new Error(`unexpected rpc ${fn}`);
    });
    createWorkspaceUserMock.mockResolvedValue({ conflict: true });

    const { startTeacherWorkspaceProvisioning } = await import("./workspace-actions");
    const result = await startTeacherWorkspaceProvisioning(baseParams);

    // 이전에는 이 경로가 { ok: true }처럼 조용히 성공 취급됐다(2026-09-01
    // 실측으로 발견) — 이제는 반드시 실패로 보고해야 한다.
    expect(result.ok).toBe(false);
    expect(rpcMock).toHaveBeenCalledWith(
      "record_workspace_creation_failed",
      expect.objectContaining({ p_provisioning_id: "prov1", p_retryable: false })
    );
    expect(sendWorkspaceProvisioningEmailMock).not.toHaveBeenCalled();
  });

  it("Directory API 호출 자체가 실패(전파 지연 등): 재시도 가능으로 분류하고 실패를 반환한다(던지지 않음)", async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "begin_teacher_workspace_provisioning") {
        return Promise.resolve({
          data: { id: "prov1", status: "creating", workspace_email: baseParams.workspaceEmail, workspace_google_user_id: null },
          error: null,
        });
      }
      if (fn === "record_workspace_creation_failed") return Promise.resolve({ error: null });
      throw new Error(`unexpected rpc ${fn}`);
    });
    createWorkspaceUserMock.mockRejectedValue(new Error("network timeout"));

    const { startTeacherWorkspaceProvisioning } = await import("./workspace-actions");
    const result = await startTeacherWorkspaceProvisioning(baseParams);

    // Next.js는 production에서 Server Action이 던진 에러를 마스킹해
    // 관리자에게 실제 메시지를 보여줄 수 없다(2026-09-01 실측) — 던지지
    // 않고 { ok: false, error } 반환값으로 모델링해야 한다.
    expect(result).toEqual({ ok: false, error: "network timeout" });
    expect(rpcMock).toHaveBeenCalledWith(
      "record_workspace_creation_failed",
      expect.objectContaining({ p_provisioning_id: "prov1", p_retryable: true })
    );
  });

  it("재시도: 이전 시도에서 이미 google_user_id가 기록돼 있으면 Directory API를 다시 호출하지 않고 이어서 진행한다(멱등)", async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "begin_teacher_workspace_provisioning") {
        return Promise.resolve({
          data: {
            id: "prov1",
            status: "creating",
            workspace_email: baseParams.workspaceEmail,
            personal_contact_email: baseParams.personalContactEmail,
            workspace_google_user_id: "google-uid-already-created",
          },
          error: null,
        });
      }
      if (fn === "record_workspace_created") return Promise.resolve({ error: null });
      if (fn === "mark_workspace_invite_sent") return Promise.resolve({ error: null });
      throw new Error(`unexpected rpc ${fn}`);
    });

    const { startTeacherWorkspaceProvisioning } = await import("./workspace-actions");
    const result = await startTeacherWorkspaceProvisioning(baseParams);

    expect(result).toEqual({ ok: true });
    expect(createWorkspaceUserMock).not.toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledWith("record_workspace_created", {
      p_provisioning_id: "prov1",
      p_google_user_id: "google-uid-already-created",
    });
  });

  it("이미 진행 중이거나 완료된 프로비저닝을 같은 이메일로 재시작하면 던지지 않고 실패를 반환한다(중복 생성 방지)", async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "begin_teacher_workspace_provisioning") {
        return Promise.resolve({
          data: null,
          error: { message: "이미 진행 중이거나 완료된 프로비저닝입니다(상태: first_login_pending)." },
        });
      }
      throw new Error(`unexpected rpc ${fn}`);
    });

    const { startTeacherWorkspaceProvisioning } = await import("./workspace-actions");
    const result = await startTeacherWorkspaceProvisioning(baseParams);

    expect(result).toEqual({
      ok: false,
      error: "이미 진행 중이거나 완료된 프로비저닝입니다(상태: first_login_pending).",
    });
    expect(createWorkspaceUserMock).not.toHaveBeenCalled();
  });
});

describe("suspendTeacher / reactivateTeacher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("suspendTeacher: Workspace suspend -> DB 기록 -> inactive 전이 순서로 호출한다", async () => {
    teachersSingleMock.mockResolvedValue({ data: { workspace_google_user_id: "google-uid-1" }, error: null });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "suspend_teacher_workspace") return Promise.resolve({ error: null });
      if (fn === "transition_account_status") return Promise.resolve({ error: null });
      throw new Error(`unexpected rpc ${fn}`);
    });

    const { suspendTeacher } = await import("./workspace-actions");
    const result = await suspendTeacher("teacher1", "테스트 중단");

    expect(result).toEqual({ ok: true });
    expect(suspendWorkspaceUserMock).toHaveBeenCalledWith("google-uid-1");
    expect(rpcMock).toHaveBeenCalledWith("suspend_teacher_workspace", {
      p_teacher_id: "teacher1",
      p_reason: "테스트 중단",
    });
    expect(rpcMock).toHaveBeenCalledWith("transition_account_status", {
      p_profile_id: "teacher1",
      p_new_status: "inactive",
      p_reason: "테스트 중단",
    });
  });

  it("suspendTeacher: 사유가 비어있으면 거부한다", async () => {
    const { suspendTeacher } = await import("./workspace-actions");
    const result = await suspendTeacher("teacher1", "  ");
    expect(result).toEqual({ ok: false, error: "중단 사유를 입력해주세요." });
    expect(suspendWorkspaceUserMock).not.toHaveBeenCalled();
  });

  it("reactivateTeacher: Workspace 재활성화 -> DB 기록 -> 새 시급(admin client) -> active 전이", async () => {
    teachersSingleMock.mockResolvedValue({ data: { workspace_google_user_id: "google-uid-1" }, error: null });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "reactivate_teacher_workspace") return Promise.resolve({ error: null });
      if (fn === "transition_account_status") return Promise.resolve({ error: null });
      throw new Error(`unexpected rpc ${fn}`);
    });
    adminRpcMock.mockResolvedValue({ error: null });

    const { reactivateTeacher } = await import("./workspace-actions");
    const result = await reactivateTeacher({
      teacherId: "teacher1",
      reason: "복귀 승인",
      newRateAmountMinor: 50000,
      newRateCurrency: "KRW",
    });

    expect(result).toEqual({ ok: true });
    expect(reactivateWorkspaceUserMock).toHaveBeenCalledWith("google-uid-1");
    expect(adminRpcMock).toHaveBeenCalledWith("set_teacher_rate", {
      p_teacher_id: "teacher1",
      p_amount_minor: 50000,
      p_currency: "KRW",
    });
    expect(rpcMock).toHaveBeenCalledWith("transition_account_status", {
      p_profile_id: "teacher1",
      p_new_status: "active",
      p_reason: "복귀 승인",
    });
  });
});

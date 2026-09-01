import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn().mockResolvedValue({ supabase: {}, adminUserId: "admin1" });
vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: () => requireAdminMock(),
}));

const getImpersonatedAccessTokenMock = vi.fn();
const getDirectoryApiAccessTokenMock = vi.fn();
vi.mock("@/lib/google-workspace-auth", () => ({
  getImpersonatedAccessToken: () => getImpersonatedAccessTokenMock(),
  getDirectoryApiAccessToken: () => getDirectoryApiAccessTokenMock(),
}));

const getWorkspaceUserByEmailMock = vi.fn();
const listWorkspaceUsersInOrgUnitMock = vi.fn();
vi.mock("@/lib/google-workspace-directory-readonly", () => ({
  getWorkspaceUserByEmail: (email: string) => getWorkspaceUserByEmailMock(email),
  listWorkspaceUsersInOrgUnit: (ou: string) => listWorkspaceUsersInOrgUnitMock(ou),
}));

describe("POST /api/admin/workspace-preflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ supabase: {}, adminUserId: "admin1" });
  });

  it("관리자가 아니면 403을 반환하고 어떤 Workspace 호출도 하지 않는다", async () => {
    requireAdminMock.mockRejectedValue(new Error("관리자만 사용할 수 있습니다."));
    const { POST } = await import("./route");
    const res = await POST();
    expect(res.status).toBe(403);
    expect(getImpersonatedAccessTokenMock).not.toHaveBeenCalled();
  });

  it("전체 체인 성공 시 각 단계를 ok:true로 보고하고 OU baseline/타겟 이메일 존재 여부를 담는다 — 토큰 값은 어디에도 없다", async () => {
    getImpersonatedAccessTokenMock.mockResolvedValue(undefined);
    getDirectoryApiAccessTokenMock.mockResolvedValue(undefined);
    listWorkspaceUsersInOrgUnitMock.mockResolvedValue([
      { googleUserId: "g1", primaryEmail: "teacher-provisioning-test@alton.education", suspended: false, orgUnitPath: "/Alton Integration Sandbox/Teachers" },
    ]);
    getWorkspaceUserByEmailMock.mockImplementation((email: string) =>
      Promise.resolve(email === "teacher1@alton.education" ? { googleUserId: "g2" } : null)
    );

    const { POST } = await import("./route");
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: "preview_check", ok: true }),
        expect.objectContaining({ stage: "impersonation", ok: true }),
        expect.objectContaining({ stage: "signjwt_and_dwd_exchange", ok: true }),
        expect.objectContaining({ stage: "list_test_ou_users", ok: true }),
      ])
    );
    expect(body.testOuBaseline).toEqual([
      { primaryEmail: "teacher-provisioning-test@alton.education", googleUserId: "g1", suspended: false },
    ]);
    expect(body.targetEmailBaseline).toEqual({
      "teacher1@alton.education": true,
      "teacher2@alton.education": false,
      "teacher-provisioning-test@alton.education": false,
    });
    expect(JSON.stringify(body)).not.toMatch(/token/i);
  });

  it("impersonation 단계가 실패하면 이후 단계(signJwt/DWD/조회)를 시도하지 않고 실패만 보고한다", async () => {
    getImpersonatedAccessTokenMock.mockRejectedValue(new Error("GOOGLE_WORKLOAD_IDENTITY_AUDIENCE 환경변수가 설정되지 않았습니다."));

    const { POST } = await import("./route");
    const res = await POST();
    const body = await res.json();

    expect(body.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "impersonation",
          ok: false,
          error: "GOOGLE_WORKLOAD_IDENTITY_AUDIENCE 환경변수가 설정되지 않았습니다.",
        }),
      ])
    );
    expect(getDirectoryApiAccessTokenMock).not.toHaveBeenCalled();
    expect(listWorkspaceUsersInOrgUnitMock).not.toHaveBeenCalled();
  });

  it("응답에는 환경 식별자만 담고 비밀값은 없다", async () => {
    process.env.GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL = "gate-c-automation@alton-integration-sandbox.iam.gserviceaccount.com";
    process.env.GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL = "official@alton.education";
    getImpersonatedAccessTokenMock.mockResolvedValue(undefined);
    getDirectoryApiAccessTokenMock.mockResolvedValue(undefined);
    listWorkspaceUsersInOrgUnitMock.mockResolvedValue([]);
    getWorkspaceUserByEmailMock.mockResolvedValue(null);

    const { POST } = await import("./route");
    const res = await POST();
    const body = await res.json();

    expect(body.serviceAccountEmail).toBe("gate-c-automation@alton-integration-sandbox.iam.gserviceaccount.com");
    expect(body.delegatedAdminEmail).toBe("official@alton.education");
  });
});

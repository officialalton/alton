import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

const getDirectoryApiAccessTokenMock = vi.fn().mockResolvedValue("directory-token");
vi.mock("./google-workspace-auth", () => ({
  getDirectoryApiAccessToken: () => getDirectoryApiAccessTokenMock(),
}));

const isM4PreviewVerificationFlagEnabledMock = vi.fn().mockReturnValue(false);
const getM4PreviewDirectoryReadonlyAccessTokenMock = vi.fn().mockResolvedValue("m4-preview-token");
vi.mock("./google-workspace-preview-verify-auth", () => ({
  isM4PreviewVerificationFlagEnabled: () => isM4PreviewVerificationFlagEnabledMock(),
  getM4PreviewDirectoryReadonlyAccessToken: (subject: string) => getM4PreviewDirectoryReadonlyAccessTokenMock(subject),
}));

describe("google-workspace-directory-readonly 실제 호출 환경 가드", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    isM4PreviewVerificationFlagEnabledMock.mockReturnValue(false);
    getM4PreviewDirectoryReadonlyAccessTokenMock.mockResolvedValue("m4-preview-token");
    process.env = { ...ORIGINAL_ENV };
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("Preview 환경에서는 절대 호출하지 않는다(WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS가 켜져 있어도)", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS = "true";
    const { getWorkspaceUserByEmail } = await import("./google-workspace-directory-readonly");
    await expect(getWorkspaceUserByEmail("teacher1@alton.education")).rejects.toThrow(
      "Preview 환경에서는 실제 Workspace 조회를 호출할 수 없습니다."
    );
  });

  it("두 플래그 모두 꺼져 있으면 조회를 차단한다", async () => {
    delete process.env.VERCEL_ENV;
    delete process.env.WORKSPACE_PREFLIGHT_ALLOW_REAL_READS;
    delete process.env.WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS;
    const { listWorkspaceUsersInOrgUnit } = await import("./google-workspace-directory-readonly");
    await expect(listWorkspaceUsersInOrgUnit("/Alton Integration Sandbox/Teachers")).rejects.toThrow(
      "실제 Workspace 조회가 비활성화되어 있습니다"
    );
  });

  it("WORKSPACE_PREFLIGHT_ALLOW_REAL_READS만으로도(쓰기 플래그 없이) 조회는 허용된다 — read/write 독립", async () => {
    delete process.env.VERCEL_ENV;
    process.env.WORKSPACE_PREFLIGHT_ALLOW_REAL_READS = "true";
    delete process.env.WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "g1", primaryEmail: "teacher1@alton.education", suspended: false, orgUnitPath: "/Teachers" }),
      })
    );
    const { getWorkspaceUserByEmail } = await import("./google-workspace-directory-readonly");
    const result = await getWorkspaceUserByEmail("teacher1@alton.education");
    expect(result).toEqual({
      googleUserId: "g1",
      primaryEmail: "teacher1@alton.education",
      suspended: false,
      orgUnitPath: "/Teachers",
    });
  });

  it("404는 null을 반환한다(에러 아님)", async () => {
    delete process.env.VERCEL_ENV;
    process.env.WORKSPACE_PREFLIGHT_ALLOW_REAL_READS = "true";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const { getWorkspaceUserByGoogleId } = await import("./google-workspace-directory-readonly");
    expect(await getWorkspaceUserByGoogleId("nonexistent")).toBeNull();
  });

  it("M4 Preview 검증 경로에서는 조회 대상이 아니라 항상 도메인 관리자를 위임 subject로 쓴다(실사용 403 버그 수정)", async () => {
    isM4PreviewVerificationFlagEnabledMock.mockReturnValue(true);
    process.env.GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL = "official@alton.education";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "g2", primaryEmail: "teacher1@alton.education", suspended: false, orgUnitPath: "/Teachers" }),
      })
    );
    const { getWorkspaceUserByEmail } = await import("./google-workspace-directory-readonly");
    const result = await getWorkspaceUserByEmail("teacher1@alton.education");

    expect(getM4PreviewDirectoryReadonlyAccessTokenMock).toHaveBeenCalledWith("official@alton.education");
    expect(result?.googleUserId).toBe("g2");
  });

  it("M4 Preview 검증 경로인데 도메인 관리자 이메일이 없으면 실제 호출 전에 막는다", async () => {
    isM4PreviewVerificationFlagEnabledMock.mockReturnValue(true);
    delete process.env.GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL;
    const { getWorkspaceUserByEmail } = await import("./google-workspace-directory-readonly");
    await expect(getWorkspaceUserByEmail("teacher1@alton.education")).rejects.toThrow(
      "GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL이 설정되지 않았습니다."
    );
    expect(getM4PreviewDirectoryReadonlyAccessTokenMock).not.toHaveBeenCalled();
  });

  it("이 모듈은 쓰기 함수(createWorkspaceUser 등)를 export하지 않는다 — 구조적 read/write 분리", async () => {
    const mod = await import("./google-workspace-directory-readonly");
    expect((mod as Record<string, unknown>).createWorkspaceUser).toBeUndefined();
    expect((mod as Record<string, unknown>).suspendWorkspaceUser).toBeUndefined();
    expect((mod as Record<string, unknown>).reactivateWorkspaceUser).toBeUndefined();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

const getDirectoryApiAccessTokenMock = vi.fn().mockResolvedValue("directory-token");
vi.mock("./google-workspace-auth", () => ({
  getDirectoryApiAccessToken: () => getDirectoryApiAccessTokenMock(),
}));

describe("google-workspace (쓰기 전용) 실제 호출 환경 가드", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("Preview 환경에서는 실제 계정 생성을 절대 시도하지 않는다", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS = "true";
    const { createWorkspaceUser } = await import("./google-workspace");

    await expect(
      createWorkspaceUser({
        workspaceEmail: "x@alton.education",
        givenName: "x",
        familyName: "y",
        orgUnitPath: "/Teachers",
      })
    ).rejects.toThrow("Preview 환경에서는 실제 Workspace 계정 작업을 호출할 수 없습니다.");
  });

  it("WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS가 꺼져 있으면 기본적으로 차단된다(읽기 전용 플래그만으로는 쓰기가 열리지 않는다)", async () => {
    delete process.env.VERCEL_ENV;
    delete process.env.WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS;
    process.env.WORKSPACE_PREFLIGHT_ALLOW_REAL_READS = "true";
    const { suspendWorkspaceUser } = await import("./google-workspace");

    await expect(suspendWorkspaceUser("google-uid-1")).rejects.toThrow(
      "실제 Workspace API 쓰기 호출이 비활성화되어 있습니다"
    );
  });

  it("Production이고 명시적으로 허용되면 signJwt/DWD 인증 체인(auth 모듈)을 통해 실제 Directory API 호출을 시도한다", async () => {
    delete process.env.VERCEL_ENV;
    process.env.WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS = "true";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ suspended: false }) })
    );
    const { reactivateWorkspaceUser } = await import("./google-workspace");
    await reactivateWorkspaceUser("google-uid-1");

    expect(getDirectoryApiAccessTokenMock).toHaveBeenCalled();
  });

  it("이 모듈은 읽기 전용 조회 함수(getWorkspaceUserByEmail 등)를 export하지 않는다 — 구조적 read/write 분리", async () => {
    const mod = await import("./google-workspace");
    expect((mod as Record<string, unknown>).getWorkspaceUserByEmail).toBeUndefined();
    expect((mod as Record<string, unknown>).getWorkspaceUserByGoogleId).toBeUndefined();
    expect((mod as Record<string, unknown>).listWorkspaceUsersInOrgUnit).toBeUndefined();
  });

  it("생성 성공 시 임시 비밀번호가 반환값 어디에도 포함되지 않는다", async () => {
    delete process.env.VERCEL_ENV;
    process.env.WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS = "true";
    let capturedBody: string | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: { body?: string }) => {
        capturedBody = init?.body;
        return Promise.resolve({ ok: true, json: async () => ({ id: "google-uid-new" }) });
      })
    );
    const { createWorkspaceUser } = await import("./google-workspace");
    const result = await createWorkspaceUser({
      workspaceEmail: "new@alton.education",
      givenName: "새",
      familyName: "김",
      orgUnitPath: "/Alton Integration Sandbox/Teachers",
    });

    expect(result).toEqual({ conflict: false, googleUserId: "google-uid-new" });
    expect(JSON.stringify(result)).not.toContain("password");
    // 요청 본문에는 비밀번호가 들어가야 하지만(Directory API 스펙상 필수),
    // 반환값·에러·로그로는 절대 새어나가지 않아야 한다는 점만 확인한다.
    expect(capturedBody).toContain("changePasswordAtNextLogin");
  });

  it("409 충돌은 예외가 아니라 conflict:true로 반환된다", async () => {
    delete process.env.VERCEL_ENV;
    process.env.WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS = "true";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409 }));
    const { createWorkspaceUser } = await import("./google-workspace");
    const result = await createWorkspaceUser({
      workspaceEmail: "dup@alton.education",
      givenName: "중복",
      familyName: "김",
      orgUnitPath: "/Alton Integration Sandbox/Teachers",
    });
    expect(result).toEqual({ conflict: true });
  });
});

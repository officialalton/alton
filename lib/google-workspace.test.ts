import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("google-workspace 실제 호출 환경 가드", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
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

  it("WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS가 꺼져 있으면 기본적으로 차단된다", async () => {
    delete process.env.VERCEL_ENV;
    delete process.env.WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS;
    const { suspendWorkspaceUser } = await import("./google-workspace");

    await expect(suspendWorkspaceUser("google-uid-1")).rejects.toThrow(
      "실제 Workspace API 호출이 비활성화되어 있습니다"
    );
  });

  it("Production이고 명시적으로 허용됐어도 WIF 환경변수가 없으면 명확한 에러를 던진다(호출 자체는 시도한다)", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS = "true";
    delete process.env.VERCEL_OIDC_TOKEN;
    const { reactivateWorkspaceUser } = await import("./google-workspace");

    await expect(reactivateWorkspaceUser("google-uid-1")).rejects.toThrow(
      "VERCEL_OIDC_TOKEN이 없습니다"
    );
  });
});

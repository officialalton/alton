import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ALLOW_ENV_VAR = "GOOGLE_WORKSPACE_M4_PREVIEW_VERIFY_ALLOW";
const EXPECTED_ORG_ID_ENV_VAR = "GOOGLE_WORKSPACE_M4_PREVIEW_EXPECTED_VERCEL_ORG_ID";
const EXPECTED_PROJECT_ID_ENV_VAR = "GOOGLE_WORKSPACE_M4_PREVIEW_EXPECTED_VERCEL_PROJECT_ID";
const EXPECTED_BRANCH_ENV_VAR = "GOOGLE_WORKSPACE_M4_PREVIEW_EXPECTED_BRANCH";

const MATCHING_ENV = {
  [ALLOW_ENV_VAR]: "true",
  VERCEL_ENV: "preview",
  [EXPECTED_ORG_ID_ENV_VAR]: "officialalton",
  VERCEL_GIT_REPO_OWNER: "officialalton",
  [EXPECTED_PROJECT_ID_ENV_VAR]: "prj_expected",
  VERCEL_PROJECT_ID: "prj_expected",
  [EXPECTED_BRANCH_ENV_VAR]: "preview/m4-integration-verification",
  VERCEL_GIT_COMMIT_REF: "preview/m4-integration-verification",
};

const ENV_KEYS = [
  ALLOW_ENV_VAR,
  EXPECTED_ORG_ID_ENV_VAR,
  EXPECTED_PROJECT_ID_ENV_VAR,
  EXPECTED_BRANCH_ENV_VAR,
  "VERCEL_ENV",
  "VERCEL_GIT_REPO_OWNER",
  "VERCEL_PROJECT_ID",
  "VERCEL_GIT_COMMIT_REF",
];

let getAccessTokenMock: ReturnType<typeof vi.fn>;
let fromJSONMock: ReturnType<typeof vi.fn>;

vi.mock("@vercel/oidc", () => ({
  getVercelOidcToken: vi.fn().mockResolvedValue("fake-oidc-token"),
}));

vi.mock("google-auth-library", () => {
  return {
    ExternalAccountClient: {
      fromJSON: (...args: unknown[]) => (fromJSONMock as (...a: unknown[]) => unknown)(...args),
    },
  };
});

function clearRelevantEnv(): void {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe("google-workspace-preview-verify-auth", () => {
  beforeEach(() => {
    vi.resetModules();
    clearRelevantEnv();
    getAccessTokenMock = vi.fn().mockResolvedValue({ token: "fake-impersonated-token" });
    fromJSONMock = vi.fn().mockReturnValue({ getAccessToken: getAccessTokenMock });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ signedJwt: "fake-signed-jwt", access_token: "fake-final-token" }),
      }),
    );
  });

  afterEach(() => {
    clearRelevantEnv();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("기본값(플래그 없음)에서는 항상 차단된다", async () => {
    const mod = await import("./google-workspace-preview-verify-auth");
    expect(mod.isM4PreviewVerificationFlagEnabled()).toBe(false);
    await expect(mod.getM4PreviewCalendarAccessToken("teacher1@alton.education")).rejects.toThrow(
      /비활성화되어 있습니다/,
    );
    expect(fromJSONMock).not.toHaveBeenCalled();
  });

  it("플래그가 true여도 VERCEL_ENV가 preview가 아니면 차단된다", async () => {
    Object.assign(process.env, MATCHING_ENV, { VERCEL_ENV: "production" });
    const mod = await import("./google-workspace-preview-verify-auth");
    await expect(mod.getM4PreviewCalendarAccessToken("teacher1@alton.education")).rejects.toThrow(
      /VERCEL_ENV=preview에서만 허용/,
    );
    expect(fromJSONMock).not.toHaveBeenCalled();
  });

  it("기대 org/project/branch 값이 설정돼 있지 않으면 차단된다", async () => {
    process.env[ALLOW_ENV_VAR] = "true";
    process.env.VERCEL_ENV = "preview";
    // EXPECTED_* 값들을 일부러 설정하지 않음
    const mod = await import("./google-workspace-preview-verify-auth");
    await expect(mod.getM4PreviewMeetSettingsAccessToken("teacher1@alton.education")).rejects.toThrow(
      /기대값.*설정되지 않았습니다/,
    );
    expect(fromJSONMock).not.toHaveBeenCalled();
  });

  it("Vercel org(team) id가 기대값과 다르면 차단된다", async () => {
    Object.assign(process.env, MATCHING_ENV, { VERCEL_GIT_REPO_OWNER: "someone_else" });
    const mod = await import("./google-workspace-preview-verify-auth");
    await expect(mod.getM4PreviewMeetReadonlyAccessToken("teacher1@alton.education")).rejects.toThrow(
      /Git repo owner가 기대값과 일치하지 않습니다/,
    );
    expect(fromJSONMock).not.toHaveBeenCalled();
  });

  it("Vercel project id가 기대값과 다르면 차단된다", async () => {
    Object.assign(process.env, MATCHING_ENV, { VERCEL_PROJECT_ID: "prj_other" });
    const mod = await import("./google-workspace-preview-verify-auth");
    await expect(mod.getM4PreviewCalendarAccessToken("teacher1@alton.education")).rejects.toThrow(
      /project id가 기대값과 일치하지 않습니다/,
    );
    expect(fromJSONMock).not.toHaveBeenCalled();
  });

  it("검증 브랜치와 다른 브랜치면 차단된다", async () => {
    Object.assign(process.env, MATCHING_ENV, { VERCEL_GIT_COMMIT_REF: "preview/some-other-branch" });
    const mod = await import("./google-workspace-preview-verify-auth");
    await expect(mod.getM4PreviewDirectoryReadonlyAccessToken("teacher1@alton.education")).rejects.toThrow(
      /브랜치가 검증 브랜치와 일치하지 않습니다/,
    );
    expect(fromJSONMock).not.toHaveBeenCalled();
  });

  it("모든 조건이 일치하면 Preview 전용 ExternalAccountClient로 토큰을 발급한다(Production 서비스 계정 미사용)", async () => {
    Object.assign(process.env, MATCHING_ENV);
    const mod = await import("./google-workspace-preview-verify-auth");
    const token = await mod.getM4PreviewCalendarAccessToken("teacher1@alton.education");
    expect(token).toBe("fake-final-token");
    expect(fromJSONMock).toHaveBeenCalledTimes(1);
    const config = fromJSONMock.mock.calls[0][0];
    expect(config.audience).toContain("vercel-m4-calendar-preview");
    expect(config.service_account_impersonation_url).toContain(
      "m4-calendar-preview-verify@alton-integration-sandbox.iam.gserviceaccount.com",
    );
    // Production 서비스 계정(gate-c-automation 등)은 이 경로 어디에도 등장하지 않는다.
    expect(config.service_account_impersonation_url).not.toContain("gate-c-automation");
    expect(config.audience).not.toContain("vercel-r3-preview");
    expect(config.scopes).toEqual(
      expect.arrayContaining([
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/meetings.space.settings",
        "https://www.googleapis.com/auth/meetings.space.readonly",
        "https://www.googleapis.com/auth/admin.directory.user.readonly",
      ]),
    );
    // 프로비저닝 가능한 전체 Directory scope는 요구하지 않는다(최소 권한).
    expect(config.scopes).not.toContain("https://www.googleapis.com/auth/admin.directory.user");
    expect(config.scopes).not.toContain("https://www.googleapis.com/auth/drive");
  });

  it("signJwt/토큰 교환 실패 시 응답 본문을 에러 메시지에 포함하지 않는다", async () => {
    Object.assign(process.env, MATCHING_ENV);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: "민감할 수 있는 원문" } }),
        text: async () => "민감할 수 있는 원문",
      }),
    );
    const mod = await import("./google-workspace-preview-verify-auth");
    await expect(mod.getM4PreviewCalendarAccessToken("teacher1@alton.education")).rejects.toThrow(
      /signJwt 호출이 실패했습니다\(status=403\)/,
    );
    try {
      await mod.getM4PreviewCalendarAccessToken("teacher1@alton.education");
    } catch (e) {
      expect(String(e)).not.toContain("민감할 수 있는 원문");
    }
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

type FromJsonConfig = { subject_token_supplier: { getSubjectToken: () => Promise<string> } };

const getVercelOidcTokenMock = vi.fn((_opts?: unknown) => Promise.resolve("fake-oidc-token"));
vi.mock("@vercel/oidc", () => ({
  getVercelOidcToken: (opts: unknown) => getVercelOidcTokenMock(opts),
}));

const getAccessTokenMock = vi.fn().mockResolvedValue({ token: "impersonated-access-token" });
const fromJSONMock = vi.fn((_opts: FromJsonConfig) => ({ getAccessToken: getAccessTokenMock }));
vi.mock("google-auth-library", () => ({
  ExternalAccountClient: { fromJSON: (opts: FromJsonConfig) => fromJSONMock(opts) },
}));

function setValidEnv() {
  process.env.GOOGLE_WORKLOAD_IDENTITY_AUDIENCE =
    "//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/vercel/providers/vercel";
  process.env.GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL =
    "gate-c-automation@alton-integration-sandbox.iam.gserviceaccount.com";
  process.env.GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL = "official@alton.education";
  delete process.env.VERCEL_ENV;
}

describe("google-workspace-auth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    getAccessTokenMock.mockResolvedValue({ token: "impersonated-access-token" });
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  describe("getImpersonatedAccessToken", () => {
    it("Preview 환경에서는 호출하지 않는다", async () => {
      setValidEnv();
      process.env.VERCEL_ENV = "preview";
      const { getImpersonatedAccessToken } = await import("./google-workspace-auth");
      await expect(getImpersonatedAccessToken()).rejects.toThrow(
        "Preview 환경에서는 실제 Google Workspace 인증 체인을 호출할 수 없습니다."
      );
      expect(fromJSONMock).not.toHaveBeenCalled();
    });

    it("필수 환경변수가 없으면 명확한 에러를 던진다", async () => {
      delete process.env.VERCEL_ENV;
      delete process.env.GOOGLE_WORKLOAD_IDENTITY_AUDIENCE;
      const { getImpersonatedAccessToken } = await import("./google-workspace-auth");
      await expect(getImpersonatedAccessToken()).rejects.toThrow(
        "GOOGLE_WORKLOAD_IDENTITY_AUDIENCE 환경변수가 설정되지 않았습니다."
      );
    });

    it("ExternalAccountClient.fromJSON을 service_account_impersonation_url과 subject_token_supplier로 구성하고, getVercelOidcToken을 구독으로 넘긴다", async () => {
      setValidEnv();
      const { getImpersonatedAccessToken } = await import("./google-workspace-auth");
      const token = await getImpersonatedAccessToken();

      expect(token).toBe("impersonated-access-token");
      expect(fromJSONMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "external_account",
          audience: process.env.GOOGLE_WORKLOAD_IDENTITY_AUDIENCE,
          service_account_impersonation_url: expect.stringContaining(
            "gate-c-automation@alton-integration-sandbox.iam.gserviceaccount.com:generateAccessToken"
          ),
          subject_token_supplier: expect.objectContaining({
            getSubjectToken: expect.any(Function),
          }),
        })
      );

      // subject_token_supplier가 실제로 getVercelOidcToken을 호출하는지 확인
      const config = fromJSONMock.mock.calls[0][0];
      await config.subject_token_supplier.getSubjectToken();
      expect(getVercelOidcTokenMock).toHaveBeenCalled();
    });

    it("직접 구현했던 STS 교환 코드(fetch 기반)는 더 이상 존재하지 않는다 — fetch를 전혀 호출하지 않는다", async () => {
      setValidEnv();
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const { getImpersonatedAccessToken } = await import("./google-workspace-auth");
      await getImpersonatedAccessToken();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("getDirectoryApiAccessToken", () => {
    function mockFetchForSignJwtAndExchange() {
      const fetchMock = vi.fn((url: string) => {
        if (url.includes(":signJwt")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ signedJwt: "fake-signed-jwt" }),
          });
        }
        if (url.includes("oauth2.googleapis.com/token")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ access_token: "directory-access-token", expires_in: 3600 }),
          });
        }
        throw new Error(`unexpected fetch url ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    }

    it("Preview 환경에서는 호출하지 않는다", async () => {
      setValidEnv();
      process.env.VERCEL_ENV = "preview";
      const { getDirectoryApiAccessToken } = await import("./google-workspace-auth");
      await expect(getDirectoryApiAccessToken()).rejects.toThrow(
        "Preview 환경에서는 실제 Google Workspace 인증 체인을 호출할 수 없습니다."
      );
    });

    it("delegated admin 이메일이 없으면 명확한 에러를 던진다", async () => {
      setValidEnv();
      delete process.env.GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL;
      mockFetchForSignJwtAndExchange();
      const { getDirectoryApiAccessToken } = await import("./google-workspace-auth");
      await expect(getDirectoryApiAccessToken()).rejects.toThrow(
        "GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL 환경변수가 설정되지 않았습니다."
      );
    });

    it("impersonation -> signJwt -> DWD 토큰 교환 전체 체인을 순서대로 호출하고, 응답 본문을 에러 메시지에 포함하지 않는다", async () => {
      setValidEnv();
      const fetchMock = mockFetchForSignJwtAndExchange();
      const { getDirectoryApiAccessToken } = await import("./google-workspace-auth");
      const token = await getDirectoryApiAccessToken();

      expect(token).toBe("directory-access-token");
      expect(getAccessTokenMock).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(":signJwt"),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer impersonated-access-token" }) })
      );
    });

    it("만료 전 재호출 시 캐시된 토큰을 반환하고 체인을 다시 호출하지 않는다(같은 실행 환경 내 단기 캐싱)", async () => {
      setValidEnv();
      const fetchMock = mockFetchForSignJwtAndExchange();
      const { getDirectoryApiAccessToken } = await import("./google-workspace-auth");

      await getDirectoryApiAccessToken();
      const callCountAfterFirst = fetchMock.mock.calls.length;
      await getDirectoryApiAccessToken();

      expect(fetchMock.mock.calls.length).toBe(callCountAfterFirst);
      expect(getAccessTokenMock).toHaveBeenCalledTimes(1);
    });

    it("signJwt 실패 시 응답 본문을 노출하지 않고 status만 포함한 에러를 던진다", async () => {
      setValidEnv();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => "SECRET_TOKEN_LEAK" })
      );
      const { getDirectoryApiAccessToken } = await import("./google-workspace-auth");
      await expect(getDirectoryApiAccessToken()).rejects.toThrow("signJwt 실패 (status 403)");
      try {
        await getDirectoryApiAccessToken();
      } catch (e) {
        expect(String(e)).not.toContain("SECRET_TOKEN_LEAK");
      }
    });
  });
});

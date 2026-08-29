import { generateKeyPairSync } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const testPrivateKeyPem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();

describe("getAccessToken", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.DOCUSIGN_INTEGRATION_KEY = "int-key";
    process.env.DOCUSIGN_USER_ID = "user-id";
    process.env.DOCUSIGN_AUTH_SERVER = "account-d.docusign.com";
    process.env.DOCUSIGN_PRIVATE_KEY = testPrivateKeyPem;
  });

  it("JWT assertion을 만들어 토큰 엔드포인트에 요청하고 access_token을 반환한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "tok123", expires_in: 3600 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getAccessToken } = await import("./docusign");
    const token = await getAccessToken();

    expect(token).toBe("tok123");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://account-d.docusign.com/oauth/token",
      expect.objectContaining({ method: "POST" })
    );
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    const assertion = body.get("assertion")!;
    const [, payloadB64] = assertion.split(".");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    expect(payload.iss).toBe("int-key");
    expect(payload.sub).toBe("user-id");
    expect(payload.aud).toBe("account-d.docusign.com");
    expect(payload.scope).toBe("signature impersonation");
  });

  it("만료 전 두 번째 호출은 캐시된 토큰을 재사용한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "tok123", expires_in: 3600 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getAccessToken } = await import("./docusign");
    await getAccessToken();
    await getAccessToken();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("토큰 요청이 실패하면 에러를 던진다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => "invalid_grant",
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getAccessToken } = await import("./docusign");
    await expect(getAccessToken()).rejects.toThrow("DocuSign 토큰 발급 실패");
  });
});

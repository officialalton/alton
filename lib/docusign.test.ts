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

describe("createEnvelope", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.DOCUSIGN_INTEGRATION_KEY = "int-key";
    process.env.DOCUSIGN_USER_ID = "user-id";
    process.env.DOCUSIGN_AUTH_SERVER = "account-d.docusign.com";
    process.env.DOCUSIGN_PRIVATE_KEY = testPrivateKeyPem;
    process.env.DOCUSIGN_BASE_URI = "https://na4.docusign.net";
    process.env.DOCUSIGN_ACCOUNT_ID = "acct-1";
  });

  it("문서와 서명자 정보로 봉투를 생성하고 envelopeId를 반환한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "tok123", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ envelopeId: "env-1" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { createEnvelope } = await import("./docusign");
    const result = await createEnvelope({
      recipientEmail: "parent@example.com",
      recipientName: "김민지",
      documentHtml: "<p>계약서 /sig1/</p>",
      emailSubject: "Alton Education 서비스 이용 계약서",
      webhookUrl: "https://alton-ecru.vercel.app/api/webhooks/docusign?token=secret",
    });

    expect(result.envelopeId).toBe("env-1");
    const envelopeCall = fetchMock.mock.calls[1];
    expect(envelopeCall[0]).toBe(
      "https://na4.docusign.net/restapi/v2.1/accounts/acct-1/envelopes"
    );
    const body = JSON.parse(envelopeCall[1].body as string);
    expect(body.recipients.signers[0].email).toBe("parent@example.com");
    expect(body.recipients.signers[0].tabs.signHereTabs[0].anchorString).toBe("/sig1/");
    expect(body.documents[0].fileExtension).toBe("html");
    expect(body.status).toBe("sent");
    expect(body.eventNotification.url).toBe(
      "https://alton-ecru.vercel.app/api/webhooks/docusign?token=secret"
    );
  });

  it("봉투 생성이 실패하면 에러를 던진다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "tok123", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({ ok: false, text: async () => "bad request" });
    vi.stubGlobal("fetch", fetchMock);

    const { createEnvelope } = await import("./docusign");
    await expect(
      createEnvelope({
        recipientEmail: "parent@example.com",
        recipientName: "김민지",
        documentHtml: "<p>/sig1/</p>",
        emailSubject: "제목",
        webhookUrl: "https://example.com/webhook",
      })
    ).rejects.toThrow("DocuSign 봉투 생성 실패");
  });
});

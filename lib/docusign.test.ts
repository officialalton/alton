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
    // M4: createEnvelope()은 이제 이 플래그가 정확히 "true"가 아니면 항상 즉시
    // 실패하는 fail-closed 게이트를 통과해야 실제 fetch까지 간다(다른 외부
    // 연동의 *_ALLOW_REAL_CALLS 관례와 동일) — 이 describe 블록은 fetch 호출
    // 자체를 검증하는 목적이라 명시적으로 켠다. 게이트 자체의 기본값(false)
    // 동작은 별도 테스트에서 검증한다.
    process.env.DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS = "true";
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
      documentHtml: "<p>계약서 /sig1/ /date1/</p>",
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
    // R4: DocuSign은 anchorIgnoreIfNotPresent 기본값이 true라서, 앵커가 PDF 변환
    // 후 매칭되지 않으면 signHereTabs를 조용히 생략해 서명 불가능한 봉투를
    // 만든다 — 실 sandbox 테스트에서 관측된 실패 모드로 추정되는 지점. 명시적으로
    // "false"를 보내 실패 시 에러로 드러나게 한다.
    expect(body.recipients.signers[0].tabs.signHereTabs[0].anchorIgnoreIfNotPresent).toBe("false");
    expect(body.documents[0].fileExtension).toBe("html");
    expect(body.status).toBe("sent");
    expect(body.eventNotification.url).toBe(
      "https://alton-ecru.vercel.app/api/webhooks/docusign?token=secret"
    );
    // 2026-09-01 실측 근본원인: eventNotification에 includeHMAC이 없으면 계정에
    // HMAC 키가 등록돼 있어도 X-DocuSign-Signature-1 헤더 없이 발송된다(우리 웹훅이
    // 정당하게 401로 거부). envelope 레벨에서 명시적으로 요청해야 한다.
    expect(body.eventNotification.includeHMAC).toBe("true");
    // integratorManaged는 이 통합키로 다른 계정을 대신 관리하는 시나리오 전용
    // 필드이며 우리는 자체 계정만 쓰므로 명시적으로 설정하지 않는다.
    expect(body.eventNotification.integratorManaged).toBeUndefined();
  });

  it("발송 전 문서 HTML에 앵커 문자열이 없으면 DocuSign을 호출하지 않고 명확한 에러를 던진다(pre-send validation)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { createEnvelope } = await import("./docusign");
    await expect(
      createEnvelope({
        recipientEmail: "parent@example.com",
        recipientName: "김민지",
        documentHtml: "<p>앵커가 없는 계약서</p>",
        emailSubject: "제목",
        webhookUrl: "https://example.com/webhook",
      })
    ).rejects.toThrow(/서명 앵커/);
    expect(fetchMock).not.toHaveBeenCalled();
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
        documentHtml: "<p>/sig1/ /date1/</p>",
        emailSubject: "제목",
        webhookUrl: "https://example.com/webhook",
      })
    ).rejects.toThrow("DocuSign 봉투 생성 실패");
  });

  it("M4: DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS가 true가 아니면 fetch를 전혀 호출하지 않고 즉시 실패한다", async () => {
    delete process.env.DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { createEnvelope } = await import("./docusign");
    await expect(
      createEnvelope({
        recipientEmail: "parent@example.com",
        recipientName: "김민지",
        documentHtml: "<p>/sig1/ /date1/</p>",
        emailSubject: "제목",
        webhookUrl: "https://example.com/webhook",
      })
    ).rejects.toThrow("DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS=true가 아니면");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("assertDocusignSandboxBaseUri", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DOCUSIGN_BASE_URI;
    delete process.env.DOCUSIGN_AUTH_SERVER;
  });

  it("demo.docusign.net이면 통과한다", async () => {
    process.env.DOCUSIGN_BASE_URI = "https://demo.docusign.net";
    process.env.DOCUSIGN_AUTH_SERVER = "account-d.docusign.com";
    const { assertDocusignSandboxBaseUri } = await import("./docusign");
    expect(() => assertDocusignSandboxBaseUri()).not.toThrow();
  });

  it("production으로 보이는 base URI면 throw한다", async () => {
    process.env.DOCUSIGN_BASE_URI = "https://na4.docusign.net";
    process.env.DOCUSIGN_AUTH_SERVER = "account.docusign.com";
    const { assertDocusignSandboxBaseUri } = await import("./docusign");
    expect(() => assertDocusignSandboxBaseUri()).toThrow(/sandbox/);
  });

  it("환경변수가 비어있으면 throw한다", async () => {
    const { assertDocusignSandboxBaseUri } = await import("./docusign");
    expect(() => assertDocusignSandboxBaseUri()).toThrow(/sandbox/);
  });
});

describe("verifyDocusignWebhookSignature", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DOCUSIGN_WEBHOOK_TOKEN;
  });

  it("올바른 HMAC-SHA256(secret, body) 서명이면 true를 반환한다", async () => {
    const { createHmac } = await import("crypto");
    process.env.DOCUSIGN_WEBHOOK_TOKEN = "secret123";
    const body = JSON.stringify({ event: "envelope-completed" });
    const signature = createHmac("sha256", "secret123").update(body, "utf8").digest("base64");

    const { verifyDocusignWebhookSignature } = await import("./docusign");
    expect(verifyDocusignWebhookSignature(body, signature)).toBe(true);
  });

  it("서명이 틀리면 false를 반환한다", async () => {
    process.env.DOCUSIGN_WEBHOOK_TOKEN = "secret123";
    const { verifyDocusignWebhookSignature } = await import("./docusign");
    expect(verifyDocusignWebhookSignature("{}", "wrong-signature")).toBe(false);
  });

  it("헤더가 없으면 false를 반환한다", async () => {
    process.env.DOCUSIGN_WEBHOOK_TOKEN = "secret123";
    const { verifyDocusignWebhookSignature } = await import("./docusign");
    expect(verifyDocusignWebhookSignature("{}", null)).toBe(false);
  });

  it("DOCUSIGN_WEBHOOK_TOKEN이 설정되지 않았으면 어떤 서명값이 와도 fail-closed로 false다", async () => {
    delete process.env.DOCUSIGN_WEBHOOK_TOKEN;
    const { createHmac } = await import("crypto");
    const body = "{}";
    // 공격자가 임의의 secret으로 만든 서명을 보내도 통과해서는 안 된다.
    const forgedSignature = createHmac("sha256", "").update(body, "utf8").digest("base64");

    const { verifyDocusignWebhookSignature } = await import("./docusign");
    expect(verifyDocusignWebhookSignature(body, forgedSignature)).toBe(false);
  });
});

describe("getEnvelopeStatus / downloadCompletedDocument / downloadCertificateOfCompletion", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.DOCUSIGN_INTEGRATION_KEY = "int-key";
    process.env.DOCUSIGN_USER_ID = "user-id";
    process.env.DOCUSIGN_AUTH_SERVER = "account-d.docusign.com";
    process.env.DOCUSIGN_PRIVATE_KEY = testPrivateKeyPem;
    process.env.DOCUSIGN_BASE_URI = "https://demo.docusign.net";
    process.env.DOCUSIGN_ACCOUNT_ID = "acct-1";
  });

  it("getEnvelopeStatus는 봉투 상태를 조회한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "tok", expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "completed" }) });
    vi.stubGlobal("fetch", fetchMock);

    const { getEnvelopeStatus } = await import("./docusign");
    const result = await getEnvelopeStatus("env-1");

    expect(result.status).toBe("completed");
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://demo.docusign.net/restapi/v2.1/accounts/acct-1/envelopes/env-1"
    );
  });

  it("downloadCompletedDocument는 combined 문서 바이트를 반환한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "tok", expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new TextEncoder().encode("pdf-bytes").buffer });
    vi.stubGlobal("fetch", fetchMock);

    const { downloadCompletedDocument } = await import("./docusign");
    const buffer = await downloadCompletedDocument("env-1");

    expect(buffer.toString()).toBe("pdf-bytes");
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://demo.docusign.net/restapi/v2.1/accounts/acct-1/envelopes/env-1/documents/combined"
    );
  });

  it("downloadCertificateOfCompletion은 certificate 문서 바이트를 반환한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "tok", expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new TextEncoder().encode("cert-bytes").buffer });
    vi.stubGlobal("fetch", fetchMock);

    const { downloadCertificateOfCompletion } = await import("./docusign");
    const buffer = await downloadCertificateOfCompletion("env-1");

    expect(buffer.toString()).toBe("cert-bytes");
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://demo.docusign.net/restapi/v2.1/accounts/acct-1/envelopes/env-1/documents/certificate"
    );
  });

  it("문서 다운로드 실패 시 에러를 던진다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "tok", expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: false, text: async () => "not found" });
    vi.stubGlobal("fetch", fetchMock);

    const { downloadCompletedDocument } = await import("./docusign");
    await expect(downloadCompletedDocument("env-1")).rejects.toThrow("DocuSign 문서 다운로드 실패");
  });
});

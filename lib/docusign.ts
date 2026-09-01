import { createHmac, createSign, timingSafeEqual } from "crypto";
import { SIGNATURE_ANCHOR } from "@/lib/contracts/family-contract-template";

// R3: DocuSign 연동을 레거시 "family 단위 1회성 계약" 흐름에서 자녀별
// contract_version 기반 흐름으로 일반화한다. JWT 인증(getAccessToken)
// 메커니즘 자체는 이전 감사에서 이미 검증된 부분이라 그대로 유지한다.

const JWT_LIFETIME_SECONDS = 3600;
const JWT_SCOPE = "signature impersonation";

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

function buildJwtAssertion(): string {
  const header = { alg: "RS256", typ: "JWT" };
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    iss: process.env.DOCUSIGN_INTEGRATION_KEY,
    sub: process.env.DOCUSIGN_USER_ID,
    aud: process.env.DOCUSIGN_AUTH_SERVER,
    scope: JWT_SCOPE,
    iat: nowSeconds,
    exp: nowSeconds + JWT_LIFETIME_SECONDS,
  };
  const signingInput =
    base64url(Buffer.from(JSON.stringify(header))) +
    "." +
    base64url(Buffer.from(JSON.stringify(payload)));

  const privateKey = process.env.DOCUSIGN_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const signature = createSign("RSA-SHA256").update(signingInput).sign(privateKey);

  return signingInput + "." + base64url(signature);
}

export async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.accessToken;
  }

  const assertion = buildJwtAssertion();
  const res = await fetch(`https://${process.env.DOCUSIGN_AUTH_SERVER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`DocuSign 토큰 발급 실패: ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { accessToken: data.access_token, expiresAt: now + data.expires_in };
  return data.access_token;
}

function envelopesBaseUrl(): string {
  return `${process.env.DOCUSIGN_BASE_URI}/restapi/v2.1/accounts/${process.env.DOCUSIGN_ACCOUNT_ID}/envelopes`;
}

/**
 * DocuSign REST v2.1 base URI가 진짜 sandbox(demo.docusign.net /
 * account-d.docusign.com)를 가리키는지 확인한다. 이 가드는 개발 중인 코드가
 * 실수로 production DocuSign 계정을 때리는 사고를 막기 위한 최후 방어선이다
 * — R3 태스크 지시: production으로 보이는 base URI면 무조건 throw.
 */
export function assertDocusignSandboxBaseUri(): void {
  const baseUri = process.env.DOCUSIGN_BASE_URI ?? "";
  const authServer = process.env.DOCUSIGN_AUTH_SERVER ?? "";
  const looksSandbox = baseUri.includes("demo.docusign.net") || authServer.includes("account-d");
  if (!looksSandbox) {
    throw new Error(
      "DOCUSIGN_BASE_URI/DOCUSIGN_AUTH_SERVER가 sandbox(demo.docusign.net / account-d.docusign.com)로 보이지 않습니다 — " +
        "production DocuSign으로 오발송하는 사고를 막기 위해 전송을 중단합니다."
    );
  }
}

/**
 * 발송 전 앵커 문자열 존재 검증. DocuSign은 anchorIgnoreIfNotPresent가 기본값
 * "true"라서, 문서(HTML→PDF 변환 후)에 앵커 문자열이 없으면 signHereTabs를
 * "조용히" 생략한다 — 에러 없이 서명 불가능한 봉투가 그대로 발송된다. 실 sandbox
 * 테스트에서 관측된 "앵커가 평문으로 보이고 서명 필드가 안 뜨는" 증상이 바로 이
 * 실패 모드로 추정된다(HTML→PDF 변환 과정에서 앵커 텍스트가 예상과 다르게
 * 렌더링됐을 가능성). 재발을 막기 위해 (a) 발송 전 이 함수로 최소한 원본 HTML에
 * 앵커 문자열이 실제로 있는지 미리 확인하고, (b) createEnvelope에서
 * anchorIgnoreIfNotPresent를 명시적으로 "false"로 설정해 앵커가 PDF 변환 후에도
 * 매칭되지 않으면 DocuSign이 에러로 실패시키게 한다(침묵 실패 대신 즉시 실패).
 */
export function assertAnchorPresentInDocumentHtml(documentHtml: string, anchorString: string): void {
  if (!documentHtml.includes(anchorString)) {
    throw new Error(
      `계약서 HTML에 서명 앵커 문자열("${anchorString}")이 없습니다 — 이 상태로 발송하면 서명 필드 없는 봉투가 생성됩니다. 문서 템플릿을 확인하세요.`
    );
  }
}

export async function createEnvelope(params: {
  recipientEmail: string;
  recipientName: string;
  documentHtml: string;
  emailSubject: string;
  webhookUrl: string;
}): Promise<{ envelopeId: string }> {
  assertAnchorPresentInDocumentHtml(params.documentHtml, SIGNATURE_ANCHOR);
  const accessToken = await getAccessToken();
  const res = await fetch(envelopesBaseUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      emailSubject: params.emailSubject,
      documents: [
        {
          documentBase64: Buffer.from(params.documentHtml).toString("base64"),
          name: "Alton Education 계약서",
          fileExtension: "html",
          documentId: "1",
        },
      ],
      recipients: {
        signers: [
          {
            email: params.recipientEmail,
            name: params.recipientName,
            recipientId: "1",
            routingOrder: "1",
            tabs: {
              signHereTabs: [
                {
                  anchorString: SIGNATURE_ANCHOR,
                  anchorUnits: "pixels",
                  anchorXOffset: "0",
                  anchorYOffset: "-10",
                  // 기본값(true)이면 앵커 매칭 실패 시 signHereTabs를 조용히
                  // 생략한다 — 서명 불가능한 봉투가 에러 없이 발송되는 실패 모드를
                  // 막기 위해 명시적으로 false로 설정해 실패 시 DocuSign이 에러를
                  // 던지게 한다.
                  anchorIgnoreIfNotPresent: "false",
                },
              ],
            },
          },
        ],
      },
      status: "sent",
      eventNotification: {
        url: params.webhookUrl,
        loggingEnabled: "true",
        requireAcknowledgment: "true",
        envelopeEvents: [
          { envelopeEventStatusCode: "sent" },
          { envelopeEventStatusCode: "delivered" },
          { envelopeEventStatusCode: "completed" },
          { envelopeEventStatusCode: "declined" },
          { envelopeEventStatusCode: "voided" },
        ],
        eventData: { version: "restv2.1", format: "json" },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`DocuSign 봉투 생성 실패: ${await res.text()}`);
  }
  const data = (await res.json()) as { envelopeId: string };
  return { envelopeId: data.envelopeId };
}

export async function getEnvelopeStatus(
  envelopeId: string
): Promise<{ status: string; completedDateTime?: string }> {
  const accessToken = await getAccessToken();
  const res = await fetch(`${envelopesBaseUrl()}/${envelopeId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`DocuSign 봉투 상태 조회 실패: ${await res.text()}`);
  }
  const data = (await res.json()) as { status: string; completedDateTime?: string };
  return data;
}

async function downloadEnvelopeDocument(envelopeId: string, documentId: string): Promise<Buffer> {
  const accessToken = await getAccessToken();
  const res = await fetch(`${envelopesBaseUrl()}/${envelopeId}/documents/${documentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`DocuSign 문서 다운로드 실패 (documentId=${documentId}): ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** 서명 완료된 결합 문서(combined document, documentId="combined"). */
export async function downloadCompletedDocument(envelopeId: string): Promise<Buffer> {
  return downloadEnvelopeDocument(envelopeId, "combined");
}

/** DocuSign Certificate of Completion (documentId="certificate"). */
export async function downloadCertificateOfCompletion(envelopeId: string): Promise<Buffer> {
  return downloadEnvelopeDocument(envelopeId, "certificate");
}

// =========================================================================
// 웹훅 서명 검증
// =========================================================================
//
// DocuSign Connect의 실제 서명 메커니즘은 HMAC-SHA256(payload, connect secret)을
// base64로 인코딩해 X-DocuSign-Signature-1 헤더(다중 커넥트 키 구성 시 -2, -3...도
// 함께 올 수 있음)로 보내는 방식이다. 이 저장소는 커넥트 설정을 다중 키로 구성하지
// 않으므로 -1 헤더 하나만 검사한다. DOCUSIGN_WEBHOOK_TOKEN을 그 HMAC secret으로
// 재사용한다(레거시 스텁이 같은 env var를 쿼리스트링 토큰으로 썼던 것과 동일한
// "하나의 공유 비밀"이라는 의도를 유지하되, 검증 방식만 DocuSign 실제 프로토콜에
// 맞춘다). 정책(§5.5): secret이 설정되지 않았으면 어떤 환경에서도 무조건 거부한다
// (fail closed, 우회 없음).
export function verifyDocusignWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.DOCUSIGN_WEBHOOK_TOKEN;
  if (!secret) return false;
  if (!signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signatureHeader, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  try {
    return timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

import { createSign } from "crypto";
import { SIGNATURE_ANCHOR } from "@/lib/contracts/family-contract-template";

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

export async function createEnvelope(params: {
  recipientEmail: string;
  recipientName: string;
  documentHtml: string;
  emailSubject: string;
  webhookUrl: string;
}): Promise<{ envelopeId: string }> {
  const accessToken = await getAccessToken();
  const res = await fetch(
    `${process.env.DOCUSIGN_BASE_URI}/restapi/v2.1/accounts/${process.env.DOCUSIGN_ACCOUNT_ID}/envelopes`,
    {
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
          envelopeEvents: [{ envelopeEventStatusCode: "completed" }],
          eventData: { version: "restv2.1", format: "json" },
        },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`DocuSign 봉투 생성 실패: ${await res.text()}`);
  }
  const data = (await res.json()) as { envelopeId: string };
  return { envelopeId: data.envelopeId };
}

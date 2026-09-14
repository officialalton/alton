#!/usr/bin/env node
// DocuSign sandbox 실제 연동 smoke test. .env.local의 DOCUSIGN_* 값을 사용해
// (1) JWT 인증이 성공하는지, (2) 테스트 envelope 1건을 지정된 수신자에게
// 실제로 발송할 수 있는지 확인한다. 토큰/키 내용은 절대 출력하지 않는다.
//
// 사용법: node scripts/docusign-sandbox-smoketest.mjs [--send-envelope]
// --send-envelope 플래그 없이 실행하면 인증만 테스트하고 종료한다(안전 기본값).

import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

const TEST_RECIPIENT_EMAIL = "matchbox512@gmail.com";
const shouldSend = process.argv.includes("--send-envelope");

function loadEnvLocal() {
  const content = readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let val = m[2];
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[m[1]] = val;
  }
  return env;
}

const env = loadEnvLocal();
const required = [
  "DOCUSIGN_INTEGRATION_KEY",
  "DOCUSIGN_USER_ID",
  "DOCUSIGN_ACCOUNT_ID",
  "DOCUSIGN_BASE_URI",
  "DOCUSIGN_AUTH_SERVER",
  "DOCUSIGN_PRIVATE_KEY",
];
for (const key of required) {
  if (!env[key]) {
    console.error(`FAIL: ${key}가 .env.local에 없습니다.`);
    process.exit(1);
  }
}

// 안전 가드: sandbox가 아니면 절대 진행하지 않음
if (!env.DOCUSIGN_BASE_URI.includes("demo.docusign.net") || !env.DOCUSIGN_AUTH_SERVER.includes("account-d")) {
  console.error("FAIL: DOCUSIGN_BASE_URI/AUTH_SERVER가 sandbox로 보이지 않습니다 — 중단합니다.");
  process.exit(1);
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function buildJwtAssertion() {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: env.DOCUSIGN_INTEGRATION_KEY,
    sub: env.DOCUSIGN_USER_ID,
    aud: env.DOCUSIGN_AUTH_SERVER,
    scope: "signature impersonation",
    iat: now,
    exp: now + 3600,
  };
  const signingInput =
    base64url(JSON.stringify(header)) + "." + base64url(JSON.stringify(payload));
  const privateKey = env.DOCUSIGN_PRIVATE_KEY.replace(/\\n/g, "\n");
  const signature = createSign("RSA-SHA256").update(signingInput).sign(privateKey);
  return signingInput + "." + base64url(signature);
}

async function getAccessToken() {
  const assertion = buildJwtAssertion();
  const res = await fetch(`https://${env.DOCUSIGN_AUTH_SERVER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`토큰 발급 실패 (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  const data = JSON.parse(text);
  return data.access_token;
}

console.log("1) JWT 인증 시도 중...");
let accessToken;
try {
  accessToken = await getAccessToken();
  console.log("   ✅ 인증 성공 (access token 발급됨, 내용은 출력하지 않음)");
} catch (e) {
  console.error("   ❌ 인증 실패:", e.message);
  console.error("   → 1회 동의(consent) URL을 아직 승인하지 않았거나, Private Key가 alton-r3-dev 앱 것과 짝이 안 맞을 수 있습니다.");
  process.exit(1);
}

if (!shouldSend) {
  console.log("");
  console.log("인증 테스트만 수행했습니다. 실제 envelope 발송은 --send-envelope 플래그로 별도 실행하세요.");
  process.exit(0);
}

console.log("");
console.log(`2) 테스트 envelope을 ${TEST_RECIPIENT_EMAIL}로 발송 중...`);
try {
  const documentHtml = `<html><body><h3>Alton Education R3 Sandbox 테스트</h3><p>이 문서는 DocuSign sandbox 연동 검증용 테스트 envelope입니다.</p><p style="margin-top:60px">서명: /sig1/</p></body></html>`;
  const res = await fetch(
    `${env.DOCUSIGN_BASE_URI}/restapi/v2.1/accounts/${env.DOCUSIGN_ACCOUNT_ID}/envelopes`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        emailSubject: "[Sandbox 테스트] Alton Education R3 연동 검증",
        documents: [
          {
            documentBase64: Buffer.from(documentHtml).toString("base64"),
            name: "R3 Sandbox Test",
            fileExtension: "html",
            documentId: "1",
          },
        ],
        recipients: {
          signers: [
            {
              email: TEST_RECIPIENT_EMAIL,
              name: "R3 Sandbox Tester",
              recipientId: "1",
              routingOrder: "1",
              tabs: {
                signHereTabs: [
                  { anchorString: "/sig1/", anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "-10" },
                ],
              },
            },
          ],
        },
        status: "sent",
      }),
    }
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`envelope 생성 실패 (HTTP ${res.status}): ${text.slice(0, 500)}`);
  }
  const data = JSON.parse(text);
  console.log(`   ✅ envelope 발송 성공. envelopeId: ${data.envelopeId}`);
  console.log(`   → ${TEST_RECIPIENT_EMAIL} 수신함을 확인하세요.`);
} catch (e) {
  console.error("   ❌ envelope 발송 실패:", e.message);
  process.exit(1);
}

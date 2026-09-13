import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAccessToken, isDocusignRealCallsAllowed } from "@/lib/docusign";

// 계약 발송이 막히는 지점을 단계로 가른다. **아무것도 발송하지 않는다** —
// 봉투를 만들지 않고, 토큰 획득과 계정 조회까지만 한다.
//
// Drive preflight와 같은 방식이다. "안 된다"를 원인 없이 보고하지 않기 위해,
// 설정 누락 / 게이트 차단 / 인증 실패 / 계정 접근 실패를 구분한다.
//
// 비밀값은 절대 돌려주지 않는다. 있는지 없는지와 sandbox 여부만 본다.
export const dynamic = "force-dynamic";

type Step = { step: string; ok: boolean; detail?: string };

function short(e: unknown): string {
  const message = e instanceof Error ? e.message : "알 수 없는 오류";
  const status = message.match(/status (\d{3})/);
  if (status) return `status ${status[1]}`;
  // DocuSign 오류 본문에는 계정 식별자가 섞여 나올 수 있다 — 앞부분만 남긴다.
  return message.slice(0, 120);
}

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "관리자만 확인할 수 있습니다." }, { status: 403 });
  }

  const baseUri = process.env.DOCUSIGN_BASE_URI ?? "";
  const authServer = process.env.DOCUSIGN_AUTH_SERVER ?? "";

  const env = {
    realCallsAllowed: isDocusignRealCallsAllowed(),
    hasIntegrationKey: Boolean(process.env.DOCUSIGN_INTEGRATION_KEY),
    hasUserId: Boolean(process.env.DOCUSIGN_USER_ID),
    hasAccountId: Boolean(process.env.DOCUSIGN_ACCOUNT_ID),
    hasPrivateKey: Boolean(process.env.DOCUSIGN_PRIVATE_KEY),
    hasWebhookToken: Boolean(process.env.DOCUSIGN_WEBHOOK_TOKEN),
    // 값 자체는 돌려주지 않고 sandbox를 가리키는지만 본다.
    baseUriIsSandbox: baseUri.includes("demo.docusign.net"),
    authServerIsSandbox: authServer.includes("account-d.docusign.com"),
  };

  const steps: Step[] = [];

  const missing = Object.entries({
    DOCUSIGN_INTEGRATION_KEY: env.hasIntegrationKey,
    DOCUSIGN_USER_ID: env.hasUserId,
    DOCUSIGN_ACCOUNT_ID: env.hasAccountId,
    DOCUSIGN_PRIVATE_KEY: env.hasPrivateKey,
  })
    .filter(([, present]) => !present)
    .map(([name]) => name);

  steps.push({
    step: "env",
    ok: missing.length === 0,
    detail: missing.length ? `누락: ${missing.join(", ")}` : undefined,
  });
  if (missing.length) return NextResponse.json({ env, steps });

  // 게이트가 닫혀 있어도 인증까지는 확인한다 — 게이트를 여는 것이 유일한 남은
  // 문제인지, 인증도 따로 고쳐야 하는지를 구분해야 한다.
  steps.push({
    step: "real_calls_gate",
    ok: env.realCallsAllowed,
    detail: env.realCallsAllowed
      ? undefined
      : "DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS가 true가 아니라 실제 발송이 차단됩니다.",
  });

  let token: string;
  try {
    token = await getAccessToken();
    steps.push({ step: "jwt_token", ok: true });
  } catch (e) {
    steps.push({ step: "jwt_token", ok: false, detail: short(e) });
    return NextResponse.json({ env, steps });
  }

  // 계정 조회 — 읽기 전용. 봉투를 만들지 않는다.
  try {
    const res = await fetch(
      `${baseUri}/restapi/v2.1/accounts/${process.env.DOCUSIGN_ACCOUNT_ID}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      steps.push({ step: "account_read", ok: false, detail: `status ${res.status}` });
      return NextResponse.json({ env, steps });
    }
    steps.push({ step: "account_read", ok: true });
  } catch (e) {
    steps.push({ step: "account_read", ok: false, detail: short(e) });
    return NextResponse.json({ env, steps });
  }

  return NextResponse.json({
    env,
    steps,
    note: env.realCallsAllowed
      ? "설정·인증·계정 접근 모두 정상입니다. 발송이 실패하면 발송 경로에서 원인을 찾아야 합니다."
      : "설정·인증은 정상이고 발송 게이트만 닫혀 있습니다.",
  });
}

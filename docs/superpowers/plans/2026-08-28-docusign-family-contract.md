# 072-docusign (학부모/학생 계약서 서명) Implementation Plan

> **문서 상태: 과거 구현 이력·이 계획 그대로 실행 금지.** **(2026-08-30 정정)** DocuSign 서비스 자체는 제거 대상이 아니다 — R3에서 계약 전자서명 서비스로 계속 사용한다(`product-architecture-v3.md` §5.5, `master-roadmap-v3.md` R3 참고). 다만 이 문서의 구체적 구현(레거시 `contracts` 테이블, 템플릿 없이 anchor 태그로 직접 문서 전송, 자녀별 계약 버전·Drive 장기보관·`drive_artifacts`·`external_event_receipts` 멱등 처리 없음)은 v3 확정 구조 이전 설계라 그대로 재사용하지 않는다. R3 착수 시 이 문서의 DocuSign JWT 인증/envelope 생성 기법(Task 1~4)은 참고하되, 스키마·흐름은 `master-roadmap-v3.md` R3를 기준으로 새 task 단위 계획을 작성한다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 상담 완료 건에서 "계약서 발송"을 누르면 학부모/학생 계정이 생성되고 DocuSign으로 표준 계약서가 발송되며, 서명 완료 시 웹훅으로 계약 상태와 학생 상태가 자동 갱신된다.

**Architecture:** DocuSign JWT Grant(RSA 키 기반 서버 인증) + 문서 직접 전송(템플릿 미사용, anchor 태그로 서명란 지정) 방식. 관리자 서버 액션이 기존 초대 로직(`inviteParent`/`inviteStudent`)을 재사용해 계정을 만들고, `contracts` 행을 생성한 뒤 DocuSign 봉투를 발송한다. 완료 웹훅은 서비스 role 클라이언트로 상태를 갱신한다.

**Tech Stack:** Next.js Server Actions, Supabase(Postgres/Auth), DocuSign eSignature REST API v2.1(SDK 없이 `fetch` + Node `crypto`로 JWT 서명), Vitest.

## Global Constraints

- 계약서 문구는 표준 약관만 포함(가격/패키지 제외) — `docs/superpowers/specs/2026-08-28-docusign-family-contract-design.md` 참고.
- 계약서 문구는 `lib/contracts/family-contract-template.ts` 한 파일에서만 관리 — 나중에 문구 수정이 이 파일 편집만으로 끝나야 한다.
- 이번 스코프는 학부모/학생 계약(`contracts`)만. 선생님 계약(`teacher_contracts`)은 다루지 않는다.
- DocuSign 발송 실패 시 이미 생성된 초대 계정은 롤백하지 않는다. `contracts` 행은 발송 성공 후에만 생성한다.
- 웹훅은 모르는 `envelope_id`를 받으면 200 + 무시(재시도 폭주 방지), 우리가 만든 비밀 토큰이 쿼리스트링과 일치하지 않으면 401.
- 새 의존성 추가 금지 — JWT 서명은 Node 내장 `crypto`로 직접 구현(이미 `stripe`/`nodemailer`만 있는 의존성 목록에 라이브러리를 더 얹지 않는다).
- 완료 후: 관련 테스트 전체 통과 + `npx tsc --noEmit` 클린 확인 → `docs/tickets.md`의 072 체크 → git commit.

---

## Task 1: DocuSign RSA 키페어 생성 + 환경변수 등록 (수동 작업, 코드 없음)

이 태스크는 코드가 아니라 사용자와 함께 진행하는 1회성 인프라 설정이다. Task 2부터는 이 태스크의 결과(개인키/공개키/동의)가 없어도 유닛 테스트는 통과하지만, 실제 이메일 발송까지 확인하려면 이 태스크가 끝나 있어야 한다.

- [ ] **Step 1: RSA 키페어 생성**

```bash
openssl genrsa -out /tmp/docusign_private.pem 2048
openssl rsa -in /tmp/docusign_private.pem -pubout -out /tmp/docusign_public.pem
cat /tmp/docusign_public.pem
```

- [ ] **Step 2: 공개키를 DocuSign 앱 설정에 등록**

사용자에게 안내: DocuSign 관리 콘솔(`https://apps.docusign.com` → 설정 → Apps and Keys)에서 Integration Key(`0389c0a9-f46a-4c03-bff2-2cc705f39678`)를 열고, "RSA 키페어 추가"에 Step 1에서 출력된 공개키 전체를 붙여넣는다.

- [ ] **Step 3: 최초 1회 사용자 동의(consent) URL 생성 및 승인**

인증 서버는 프로덕션 계정이면 `account.docusign.com`, 데모/개발자 계정이면 `account-d.docusign.com`이다(사용자에게 어느 쪽인지 확인 — Base URI가 `na4.docusign.net`이므로 프로덕션 계정일 가능성이 높다). 아래 URL의 `{authServer}`와 `{redirectUri}`(DocuSign 앱에 등록된 리다이렉트 URI 아무거나, 예: `https://alton-ecru.vercel.app/login`)를 채워 사용자에게 브라우저로 열고 로그인/승인하게 한다:

```
https://{authServer}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=0389c0a9-f46a-4c03-bff2-2cc705f39678&redirect_uri={redirectUri}
```

- [ ] **Step 4: 환경변수 등록 (로컬 `.env.local` + Vercel production)**

`.env.local`에 추가(줄바꿈은 `\n`으로 이스케이프):

```
DOCUSIGN_INTEGRATION_KEY=0389c0a9-f46a-4c03-bff2-2cc705f39678
DOCUSIGN_USER_ID=87b8e4d9-7992-44b9-a90b-13dab686b3f6
DOCUSIGN_ACCOUNT_ID=74f2ac04-13cd-4495-ba70-d092a648b79f
DOCUSIGN_BASE_URI=https://na4.docusign.net
DOCUSIGN_AUTH_SERVER=account.docusign.com
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
DOCUSIGN_WEBHOOK_TOKEN=<openssl rand -hex 32 로 생성한 임의 문자열>
```

같은 값을 Vercel에도 등록:

```bash
cat /tmp/docusign_private.pem | npx vercel env add DOCUSIGN_PRIVATE_KEY production
echo "0389c0a9-f46a-4c03-bff2-2cc705f39678" | npx vercel env add DOCUSIGN_INTEGRATION_KEY production
echo "87b8e4d9-7992-44b9-a90b-13dab686b3f6" | npx vercel env add DOCUSIGN_USER_ID production
echo "74f2ac04-13cd-4495-ba70-d092a648b79f" | npx vercel env add DOCUSIGN_ACCOUNT_ID production
echo "https://na4.docusign.net" | npx vercel env add DOCUSIGN_BASE_URI production
echo "account.docusign.com" | npx vercel env add DOCUSIGN_AUTH_SERVER production
```

`DOCUSIGN_WEBHOOK_TOKEN`도 같은 방식으로 Vercel에 등록.

- [ ] **Step 5: 임시 키 파일 삭제**

```bash
rm /tmp/docusign_private.pem /tmp/docusign_public.pem
```

---

## Task 2: DocuSign JWT 인증 (`lib/docusign.ts` — `getAccessToken`)

**Files:**
- Create: `lib/docusign.ts`
- Test: `lib/docusign.test.ts`

**Interfaces:**
- Produces: `getAccessToken(): Promise<string>` — 이후 Task 3의 `createEnvelope`가 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/docusign.test.ts`:

```ts
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run lib/docusign.test.ts`
Expected: FAIL — `Cannot find module './docusign'`

- [ ] **Step 3: 구현**

`lib/docusign.ts`:

```ts
import { createSign } from "crypto";

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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/docusign.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/docusign.ts lib/docusign.test.ts
git commit -m "feat(docusign): JWT Grant 액세스 토큰 발급/캐싱 구현"
```

---

## Task 3: 계약서 템플릿 (`lib/contracts/family-contract-template.ts`)

**Files:**
- Create: `lib/contracts/family-contract-template.ts`
- Test: `lib/contracts/family-contract-template.test.ts`

**Interfaces:**
- Produces: `renderFamilyContractHtml(params: { parentName: string; studentName: string }): string` — Task 5의 `sendFamilyContract`가 사용. 반환 HTML에는 서명 anchor 문자열 `/sig1/`이 반드시 포함된다(Task 4의 `createEnvelope`가 이 문자열로 서명란을 찾는다).

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/contracts/family-contract-template.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderFamilyContractHtml } from "./family-contract-template";

describe("renderFamilyContractHtml", () => {
  it("학부모/학생 이름을 본문에 채우고 서명 anchor를 포함한다", () => {
    const html = renderFamilyContractHtml({ parentName: "김민지", studentName: "지훈" });

    expect(html).toContain("김민지");
    expect(html).toContain("지훈");
    expect(html).toContain("/sig1/");
    expect(html).toContain("제1조");
    expect(html).toContain("제2조");
    expect(html).toContain("제3조");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run lib/contracts/family-contract-template.test.ts`
Expected: FAIL — `Cannot find module './family-contract-template'`

- [ ] **Step 3: 구현**

`lib/contracts/family-contract-template.ts`:

```ts
// 072(DocuSign): 학부모/학생 표준 계약서 문구. 나중에 문구를 고치고 싶으면
// 이 파일만 수정하면 된다(DocuSign 콘솔에는 템플릿을 따로 만들지 않았음).
// 이 초안은 법적 검토를 거치지 않은 플레이스홀더 문구다 — 실제 고객 발송 전
// 반드시 변호사 검토가 필요하다.
export function renderFamilyContractHtml(params: {
  parentName: string;
  studentName: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: sans-serif; line-height: 1.6; color: #111;">
  <h2>서비스 이용 계약서</h2>
  <p>계약 당사자: Alton Education Inc. (이하 "회사")와 ${params.parentName} (이하 "학부모")</p>
  <p>학생: ${params.studentName}</p>

  <h3>제1조 (목적)</h3>
  <p>본 계약은 회사가 제공하는 온라인 SAT/AP 개인 교습 서비스의 이용 조건을 정함을 목적으로 한다.</p>

  <h3>제2조 (수업권)</h3>
  <p>학부모는 수업권을 구매하여 자녀의 수업에 사용하며, 수업권은 구매일로부터 12개월간 유효하다.</p>

  <h3>제3조 (취소 정책)</h3>
  <p>수업 24시간 전 취소 시 수업권이 전액 보존되며, 그 외 취소는 회사 정책에 따른다.</p>

  <p style="margin-top: 48px;">학부모 서명: /sig1/</p>
</body>
</html>`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/contracts/family-contract-template.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add lib/contracts/family-contract-template.ts lib/contracts/family-contract-template.test.ts
git commit -m "feat(docusign): 학부모 계약서 표준 약관 템플릿 추가"
```

---

## Task 4: DocuSign 봉투 생성 (`lib/docusign.ts` — `createEnvelope`)

**Files:**
- Modify: `lib/docusign.ts`
- Test: `lib/docusign.test.ts`

**Interfaces:**
- Consumes: `getAccessToken(): Promise<string>` (Task 2)
- Produces: `createEnvelope(params: { recipientEmail: string; recipientName: string; documentHtml: string; emailSubject: string; webhookUrl: string }): Promise<{ envelopeId: string }>` — Task 5의 `sendFamilyContract`가 사용.

- [ ] **Step 1: 실패하는 테스트 추가**

`lib/docusign.test.ts`에 추가(기존 `describe("getAccessToken", ...)` 블록 아래):

```ts
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run lib/docusign.test.ts`
Expected: FAIL — `createEnvelope is not a function`

- [ ] **Step 3: 구현 추가**

`lib/docusign.ts` 끝에 추가:

```ts
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
                    anchorString: "/sig1/",
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/docusign.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/docusign.ts lib/docusign.test.ts
git commit -m "feat(docusign): 봉투(envelope) 생성 API 연동"
```

---

## Task 5: `inviteParent`/`inviteStudent`가 생성된 id를 반환하도록 수정

**Files:**
- Modify: `app/admin/users-actions.ts:39-70`
- Test: 기존 `app/admin/UsersTab.test.tsx`는 수정 불필요(반환값을 쓰지 않음) — 새 테스트 파일 `app/admin/users-actions.test.ts` 추가

**Interfaces:**
- Produces: `inviteParent(params: { name: string; email: string }): Promise<string>`(parentId), `inviteStudent(params: { name: string; email: string; parentId: string; grade: string }): Promise<string>`(studentId), `requireAdmin(): Promise<{ supabase, adminUserId }>` — Task 6의 `contracts-actions.ts`가 셋 다 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`app/admin/users-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn().mockResolvedValue({ data: { user: { id: "admin1" } } });
const profileSingleMock = vi.fn().mockResolvedValue({ data: { role: "admin" } });
const inviteUserByEmailMock = vi.fn();
const parentsInsertMock = vi.fn().mockResolvedValue({ error: null });
const profilesInsertMock = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ single: profileSingleMock }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { inviteUserByEmail: inviteUserByEmailMock } },
    from: (table: string) => {
      if (table === "profiles") return { insert: profilesInsertMock };
      if (table === "parents") return { insert: parentsInsertMock };
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

describe("inviteParent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
    inviteUserByEmailMock.mockResolvedValue({ data: { user: { id: "parent1" } }, error: null });
    parentsInsertMock.mockResolvedValue({ error: null });
    profilesInsertMock.mockResolvedValue({ error: null });
  });

  it("생성된 parentId를 반환한다", async () => {
    const { inviteParent } = await import("./users-actions");
    const parentId = await inviteParent({ name: "김민지", email: "minji@example.com" });
    expect(parentId).toBe("parent1");
    expect(parentsInsertMock).toHaveBeenCalledWith({ id: "parent1" });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run app/admin/users-actions.test.ts`
Expected: FAIL — `expect(parentId).toBe("parent1")` fails because `inviteParent` returns `undefined`

- [ ] **Step 3: 구현 수정**

`app/admin/users-actions.ts`에서 `requireAdmin`을 export하고, `inviteParent`/`inviteStudent`가 id를 반환하도록 수정:

```ts
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("관리자만 사용할 수 있습니다.");
  return { supabase, adminUserId: user.id };
}
```

(`async function requireAdmin()`을 `export async function requireAdmin()`으로 변경.)

```ts
export async function inviteParent(params: { name: string; email: string }): Promise<string> {
  await requireAdmin();
  const admin = createAdminClient();
  const userId = await inviteAndCreateProfile({ ...params, role: "parent" });
  const { error } = await admin.from("parents").insert({ id: userId });
  if (error) throw new Error(error.message);
  return userId;
}
```

(`Promise<void>`를 `Promise<string>`으로 바꾸고 `return userId;` 추가.)

```ts
export async function inviteStudent(params: {
  name: string;
  email: string;
  parentId: string;
  grade: string;
}): Promise<string> {
  await requireAdmin();
  const admin = createAdminClient();
  const userId = await inviteAndCreateProfile({
    name: params.name,
    email: params.email,
    role: "student",
  });
  const { error } = await admin
    .from("students")
    .insert({ id: userId, grade: params.grade, status: "pending" });
  if (error) throw new Error(error.message);

  const { error: linkError } = await admin
    .from("guardian_students")
    .insert({ parent_id: params.parentId, student_id: userId, relation_type: "보호자", is_primary: true });
  if (linkError) throw new Error(linkError.message);

  return userId;
}
```

(`Promise<void>`를 `Promise<string>`으로 바꾸고 `return userId;` 추가.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run app/admin/users-actions.test.ts app/admin/UsersTab.test.tsx`
Expected: PASS 전체 (기존 `UsersTab.test.tsx`는 반환값을 쓰지 않으므로 그대로 통과)

- [ ] **Step 5: 커밋**

```bash
git add app/admin/users-actions.ts app/admin/users-actions.test.ts
git commit -m "refactor(admin): inviteParent/inviteStudent가 생성된 id를 반환하도록 변경"
```

---

## Task 6: 발송/조회 데이터 함수 (`app/admin/contracts-data.ts`)

**Files:**
- Create: `app/admin/contracts-data.ts`
- Test: `app/admin/contracts-data.test.ts`

**Interfaces:**
- Produces: `PendingConsult`, `FamilyContract` 타입과 `loadPendingConsults(supabase): Promise<PendingConsult[]>`, `loadFamilyContracts(supabase): Promise<FamilyContract[]>` — Task 8의 `app/admin/page.tsx`와 `ContractsTab.tsx`가 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`app/admin/contracts-data.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { loadFamilyContracts, loadPendingConsults } from "./contracts-data";

describe("loadPendingConsults", () => {
  it("아직 계약으로 전환되지 않은 상담 신청만 반환한다", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          is: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  {
                    id: "c1",
                    person_name: "김민지",
                    email: "minji@example.com",
                    student_grade: "10학년",
                    submitted_at: "2026-08-01T00:00:00Z",
                  },
                ],
              }),
          }),
        }),
      })),
    };

    const result = await loadPendingConsults(supabase as never);
    expect(result).toEqual([
      {
        id: "c1",
        personName: "김민지",
        email: "minji@example.com",
        studentGrade: "10학년",
        submittedAt: "2026-08-01T00:00:00Z",
      },
    ]);
  });
});

describe("loadFamilyContracts", () => {
  it("contracts를 profiles 이름과 조인해 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "contracts") {
          return {
            select: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "ct1",
                      parent_id: "p1",
                      student_id: "s1",
                      status: "signed",
                      signed_at: "2026-08-02T00:00:00Z",
                    },
                  ],
                }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            select: () => ({
              in: () =>
                Promise.resolve({
                  data: [
                    { id: "p1", name: "김민지" },
                    { id: "s1", name: "지훈" },
                  ],
                }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const result = await loadFamilyContracts(supabase as never);
    expect(result).toEqual([
      {
        id: "ct1",
        parentName: "김민지",
        studentName: "지훈",
        status: "signed",
        signedAt: "2026-08-02T00:00:00Z",
      },
    ]);
  });

  it("계약이 없으면 빈 배열을 반환하고 profiles를 조회하지 않는다", async () => {
    const fromMock = vi.fn(() => ({
      select: () => ({ order: () => Promise.resolve({ data: [] }) }),
    }));
    const supabase = { from: fromMock };

    const result = await loadFamilyContracts(supabase as never);
    expect(result).toEqual([]);
    expect(fromMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run app/admin/contracts-data.test.ts`
Expected: FAIL — `Cannot find module './contracts-data'`

- [ ] **Step 3: 구현**

`app/admin/contracts-data.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type PendingConsult = {
  id: string;
  personName: string;
  email: string;
  studentGrade: string | null;
  submittedAt: string;
};

export type FamilyContract = {
  id: string;
  parentName: string;
  studentName: string;
  status: "sent" | "signed";
  signedAt: string | null;
};

export async function loadPendingConsults(supabase: SupabaseClient): Promise<PendingConsult[]> {
  const { data } = await supabase
    .from("consult_requests")
    .select("id, person_name, email, student_grade, submitted_at")
    .is("converted_student_id", null)
    .order("submitted_at", { ascending: true });

  return (data ?? []).map((c) => ({
    id: c.id,
    personName: c.person_name,
    email: c.email,
    studentGrade: c.student_grade,
    submittedAt: c.submitted_at,
  }));
}

export async function loadFamilyContracts(supabase: SupabaseClient): Promise<FamilyContract[]> {
  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, parent_id, student_id, status, signed_at")
    .order("id", { ascending: false });
  if (!contracts || contracts.length === 0) return [];

  const ids = Array.from(new Set(contracts.flatMap((c) => [c.parent_id, c.student_id])));
  const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", ids);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

  return contracts.map((c) => ({
    id: c.id,
    parentName: nameById.get(c.parent_id) ?? "알 수 없음",
    studentName: nameById.get(c.student_id) ?? "알 수 없음",
    status: c.status,
    signedAt: c.signed_at,
  }));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run app/admin/contracts-data.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add app/admin/contracts-data.ts app/admin/contracts-data.test.ts
git commit -m "feat(admin): 계약 발송 대기/발송된 계약 목록 조회 함수 추가"
```

---

## Task 7: 계약서 발송 서버 액션 (`app/admin/contracts-actions.ts`)

**Files:**
- Create: `app/admin/contracts-actions.ts`
- Test: `app/admin/contracts-actions.test.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `inviteParent`, `inviteStudent`(Task 5) / `createEnvelope`(Task 4) / `renderFamilyContractHtml`(Task 3)
- Produces: `sendFamilyContract(params: { consultRequestId: string; studentName: string; studentEmail: string }): Promise<void>` — Task 9의 `ContractsTab.tsx`가 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`app/admin/contracts-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./users-actions", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ supabase: {}, adminUserId: "admin1" }),
  inviteParent: vi.fn().mockResolvedValue("parent1"),
  inviteStudent: vi.fn().mockResolvedValue("student1"),
}));

const createEnvelopeMock = vi.fn().mockResolvedValue({ envelopeId: "env-1" });
vi.mock("@/lib/docusign", () => ({
  createEnvelope: createEnvelopeMock,
}));

const consultSingleMock = vi.fn();
const contractsInsertMock = vi.fn().mockResolvedValue({ error: null });
const consultUpdateEqMock = vi.fn().mockResolvedValue({ error: null });

const fromMock = vi.fn((table: string) => {
  if (table === "consult_requests") {
    return {
      select: () => ({ eq: () => ({ single: consultSingleMock }) }),
      update: () => ({ eq: consultUpdateEqMock }),
    };
  }
  if (table === "contracts") {
    return { insert: contractsInsertMock };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

describe("sendFamilyContract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consultSingleMock.mockResolvedValue({
      data: { person_name: "김민지", email: "minji@example.com", student_grade: "10학년" },
      error: null,
    });
    contractsInsertMock.mockResolvedValue({ error: null });
    consultUpdateEqMock.mockResolvedValue({ error: null });
    createEnvelopeMock.mockResolvedValue({ envelopeId: "env-1" });
  });

  it("부모/학생 계정을 만들고 봉투를 발송한 뒤 contracts 행을 생성한다", async () => {
    const { sendFamilyContract } = await import("./contracts-actions");
    const { inviteParent, inviteStudent } = await import("./users-actions");

    await sendFamilyContract({
      consultRequestId: "c1",
      studentName: "지훈",
      studentEmail: "jihoon@example.com",
    });

    expect(inviteParent).toHaveBeenCalledWith({ name: "김민지", email: "minji@example.com" });
    expect(inviteStudent).toHaveBeenCalledWith({
      name: "지훈",
      email: "jihoon@example.com",
      parentId: "parent1",
      grade: "10학년",
    });
    expect(createEnvelopeMock).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: "minji@example.com", recipientName: "김민지" })
    );
    expect(contractsInsertMock).toHaveBeenCalledWith({
      parent_id: "parent1",
      student_id: "student1",
      docusign_envelope_id: "env-1",
      status: "sent",
    });
    expect(consultUpdateEqMock).toHaveBeenCalledWith("id", "c1");
  });

  it("존재하지 않는 상담 신청이면 에러를 던진다", async () => {
    consultSingleMock.mockResolvedValue({ data: null, error: null });
    const { sendFamilyContract } = await import("./contracts-actions");

    await expect(
      sendFamilyContract({ consultRequestId: "bad", studentName: "지훈", studentEmail: "x@example.com" })
    ).rejects.toThrow("존재하지 않는 상담 신청입니다.");
    expect(contractsInsertMock).not.toHaveBeenCalled();
  });

  it("DocuSign 발송이 실패하면 contracts 행을 만들지 않는다", async () => {
    createEnvelopeMock.mockRejectedValue(new Error("DocuSign 봉투 생성 실패: 500"));
    const { sendFamilyContract } = await import("./contracts-actions");

    await expect(
      sendFamilyContract({ consultRequestId: "c1", studentName: "지훈", studentEmail: "jihoon@example.com" })
    ).rejects.toThrow("DocuSign 봉투 생성 실패");
    expect(contractsInsertMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run app/admin/contracts-actions.test.ts`
Expected: FAIL — `Cannot find module './contracts-actions'`

- [ ] **Step 3: 구현**

`app/admin/contracts-actions.ts`:

```ts
"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin, inviteParent, inviteStudent } from "./users-actions";
import { createEnvelope } from "@/lib/docusign";
import { renderFamilyContractHtml } from "@/lib/contracts/family-contract-template";

export async function sendFamilyContract(params: {
  consultRequestId: string;
  studentName: string;
  studentEmail: string;
}): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: consult, error: consultError } = await admin
    .from("consult_requests")
    .select("person_name, email, student_grade")
    .eq("id", params.consultRequestId)
    .single();
  if (consultError) throw new Error(consultError.message);
  if (!consult) throw new Error("존재하지 않는 상담 신청입니다.");

  const parentId = await inviteParent({ name: consult.person_name, email: consult.email });
  const studentId = await inviteStudent({
    name: params.studentName,
    email: params.studentEmail,
    parentId,
    grade: consult.student_grade ?? "",
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010";
  const webhookToken = process.env.DOCUSIGN_WEBHOOK_TOKEN ?? "";
  const { envelopeId } = await createEnvelope({
    recipientEmail: consult.email,
    recipientName: consult.person_name,
    documentHtml: renderFamilyContractHtml({
      parentName: consult.person_name,
      studentName: params.studentName,
    }),
    emailSubject: "Alton Education 서비스 이용 계약서",
    webhookUrl: `${siteUrl}/api/webhooks/docusign?token=${webhookToken}`,
  });

  const { error: contractError } = await admin.from("contracts").insert({
    parent_id: parentId,
    student_id: studentId,
    docusign_envelope_id: envelopeId,
    status: "sent",
  });
  if (contractError) throw new Error(contractError.message);

  await admin
    .from("consult_requests")
    .update({
      converted_student_id: studentId,
      converted_parent_id: parentId,
      status: "completed",
    })
    .eq("id", params.consultRequestId);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run app/admin/contracts-actions.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add app/admin/contracts-actions.ts app/admin/contracts-actions.test.ts
git commit -m "feat(admin): 계약서 발송 서버 액션 구현"
```

---

## Task 8: DocuSign 웹훅 (`app/api/webhooks/docusign/route.ts`)

**Files:**
- Create: `app/api/webhooks/docusign/route.ts`
- Test: `app/api/webhooks/docusign/route.test.ts`

**Interfaces:**
- 없음(HTTP 엔드포인트). `contracts.docusign_envelope_id`로 조회해 `contracts.status`/`students.status`를 갱신한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`app/api/webhooks/docusign/route.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const contractMaybeSingleMock = vi.fn();
const contractUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const studentUpdateEqMock = vi.fn().mockResolvedValue({ error: null });

const fromMock = vi.fn((table: string) => {
  if (table === "contracts") {
    return {
      select: () => ({ eq: () => ({ maybeSingle: contractMaybeSingleMock }) }),
      update: () => ({ eq: contractUpdateEqMock }),
    };
  }
  if (table === "students") {
    return { update: () => ({ eq: studentUpdateEqMock }) };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

describe("POST /api/webhooks/docusign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contractMaybeSingleMock.mockResolvedValue({ data: { id: "ct1", student_id: "s1" } });
    contractUpdateEqMock.mockResolvedValue({ error: null });
    studentUpdateEqMock.mockResolvedValue({ error: null });
    delete process.env.DOCUSIGN_WEBHOOK_TOKEN;
  });

  afterEach(() => {
    delete process.env.DOCUSIGN_WEBHOOK_TOKEN;
  });

  it("envelope-completed 이벤트를 받으면 계약과 학생 상태를 갱신한다", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/webhooks/docusign", {
      method: "POST",
      body: JSON.stringify({
        event: "envelope-completed",
        data: { envelopeId: "env-1" },
      }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(contractUpdateEqMock).toHaveBeenCalledWith("id", "ct1");
    expect(studentUpdateEqMock).toHaveBeenCalledWith("id", "s1");
  });

  it("envelope-completed가 아닌 이벤트는 무시한다", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/webhooks/docusign", {
      method: "POST",
      body: JSON.stringify({ event: "envelope-sent", data: {} }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(contractUpdateEqMock).not.toHaveBeenCalled();
  });

  it("모르는 envelopeId면 무시하고 200을 반환한다", async () => {
    contractMaybeSingleMock.mockResolvedValue({ data: null });
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/webhooks/docusign", {
      method: "POST",
      body: JSON.stringify({ event: "envelope-completed", data: { envelopeId: "unknown" } }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(contractUpdateEqMock).not.toHaveBeenCalled();
  });

  it("토큰이 설정돼 있는데 쿼리스트링 토큰이 틀리면 401을 반환한다", async () => {
    process.env.DOCUSIGN_WEBHOOK_TOKEN = "secret123";
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/webhooks/docusign?token=wrong", {
      method: "POST",
      body: JSON.stringify({ event: "envelope-completed", data: { envelopeId: "env-1" } }),
    });

    const res = await POST(request);
    expect(res.status).toBe(401);
    expect(contractUpdateEqMock).not.toHaveBeenCalled();
  });

  it("토큰이 설정돼 있고 쿼리스트링 토큰이 맞으면 통과한다", async () => {
    process.env.DOCUSIGN_WEBHOOK_TOKEN = "secret123";
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/webhooks/docusign?token=secret123", {
      method: "POST",
      body: JSON.stringify({ event: "envelope-completed", data: { envelopeId: "env-1" } }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(contractUpdateEqMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run app/api/webhooks/docusign/route.test.ts`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: 구현**

`app/api/webhooks/docusign/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const expectedToken = process.env.DOCUSIGN_WEBHOOK_TOKEN;
  if (expectedToken && url.searchParams.get("token") !== expectedToken) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  const body = (await request.json()) as {
    event?: string;
    data?: { envelopeId?: string };
  };

  if (body.event !== "envelope-completed") {
    return NextResponse.json({ ok: true, skipped: body.event });
  }

  const envelopeId = body.data?.envelopeId;
  if (!envelopeId) {
    return NextResponse.json({ error: "missing envelopeId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: contract } = await admin
    .from("contracts")
    .select("id, student_id")
    .eq("docusign_envelope_id", envelopeId)
    .maybeSingle();
  if (!contract) {
    return NextResponse.json({ ok: true, skipped: "unknown envelope" });
  }

  const { error: contractError } = await admin
    .from("contracts")
    .update({ status: "signed", signed_at: new Date().toISOString() })
    .eq("id", contract.id);
  if (contractError) {
    return NextResponse.json({ error: contractError.message }, { status: 500 });
  }

  const { error: studentError } = await admin
    .from("students")
    .update({ status: "active" })
    .eq("id", contract.student_id);
  if (studentError) {
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run app/api/webhooks/docusign/route.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add app/api/webhooks/docusign/route.ts app/api/webhooks/docusign/route.test.ts
git commit -m "feat(docusign): 서명 완료 웹훅 처리"
```

---

## Task 9: 관리자 UI (`app/admin/ContractsTab.tsx`) + 배선

**Files:**
- Create: `app/admin/ContractsTab.tsx`
- Test: `app/admin/ContractsTab.test.tsx`
- Modify: `app/admin/AdminShell.tsx`
- Modify: `app/admin/AdminShell.test.tsx`
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: `PendingConsult`, `FamilyContract`(Task 6), `sendFamilyContract`(Task 7)

- [ ] **Step 1: 실패하는 테스트 작성**

`app/admin/ContractsTab.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ContractsTab from "./ContractsTab";
import { sendFamilyContract } from "./contracts-actions";

vi.mock("./contracts-actions", () => ({
  sendFamilyContract: vi.fn(),
}));

describe("ContractsTab", () => {
  it("발송 대기 상담과 발송된 계약을 보여준다", () => {
    render(
      <ContractsTab
        pendingConsults={[
          { id: "c1", personName: "김민지", email: "minji@example.com", studentGrade: "10학년", submittedAt: "2026-08-01" },
        ]}
        contracts={[
          { id: "ct1", parentName: "최유진", studentName: "최하은", status: "signed", signedAt: "2026-08-02" },
        ]}
      />
    );

    expect(screen.getByText("김민지")).toBeInTheDocument();
    expect(screen.getByText("최유진")).toBeInTheDocument();
    expect(screen.getByText("서명완료")).toBeInTheDocument();
  });

  it("계약서 발송을 누르고 학생 정보를 입력한 뒤 발송 확정을 누르면 sendFamilyContract가 호출된다", async () => {
    vi.mocked(sendFamilyContract).mockResolvedValue(undefined);
    render(
      <ContractsTab
        pendingConsults={[
          { id: "c1", personName: "김민지", email: "minji@example.com", studentGrade: "10학년", submittedAt: "2026-08-01" },
        ]}
        contracts={[]}
      />
    );

    fireEvent.click(screen.getByText("계약서 발송"));
    fireEvent.change(screen.getByLabelText("학생 이름"), { target: { value: "지훈" } });
    fireEvent.change(screen.getByLabelText("학생 이메일"), { target: { value: "jihoon@example.com" } });
    fireEvent.click(screen.getByText("발송 확정"));

    await waitFor(() => {
      expect(sendFamilyContract).toHaveBeenCalledWith({
        consultRequestId: "c1",
        studentName: "지훈",
        studentEmail: "jihoon@example.com",
      });
    });
  });

  it("발송 대기 상담이 없으면 안내 문구를 보여준다", () => {
    render(<ContractsTab pendingConsults={[]} contracts={[]} />);
    expect(screen.getByText("발송 대기 중인 상담 신청이 없습니다.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run app/admin/ContractsTab.test.tsx`
Expected: FAIL — `Cannot find module './ContractsTab'`

- [ ] **Step 3: 구현**

`app/admin/ContractsTab.tsx`:

```tsx
"use client";

import { useState } from "react";
import { sendFamilyContract } from "./contracts-actions";
import type { FamilyContract, PendingConsult } from "./contracts-data";

export default function ContractsTab({
  pendingConsults,
  contracts,
}: {
  pendingConsults: PendingConsult[];
  contracts: FamilyContract[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visiblePending = pendingConsults.filter((c) => !sentIds.includes(c.id));

  async function handleSend(consultRequestId: string) {
    setError(null);
    setLoadingId(consultRequestId);
    try {
      await sendFamilyContract({ consultRequestId, studentName, studentEmail });
      setSentIds((prev) => [...prev, consultRequestId]);
      setOpenId(null);
      setStudentName("");
      setStudentEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "계약서 발송에 실패했습니다.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1">계약</h1>
      <p className="text-[13px] text-grey-500 mb-5">DocuSign 서명 상태를 총괄합니다.</p>

      <h2 className="text-[14px] font-bold text-ink mb-3">발송 대기</h2>
      <div className="mb-8">
        {visiblePending.length === 0 && (
          <p className="text-[13px] text-grey-500">발송 대기 중인 상담 신청이 없습니다.</p>
        )}
        {visiblePending.map((c) => (
          <div key={c.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold text-ink">{c.personName}</div>
                <div className="text-[12px] text-grey-500">{c.email}</div>
              </div>
              {openId !== c.id && (
                <button
                  onClick={() => setOpenId(c.id)}
                  className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5"
                >
                  계약서 발송
                </button>
              )}
            </div>
            {openId === c.id && (
              <div className="mt-3 pt-3 border-t border-grey-200">
                <label htmlFor={`student-name-${c.id}`} className="block text-[12px] font-semibold text-grey-500 mb-1">
                  학생 이름
                </label>
                <input
                  id={`student-name-${c.id}`}
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-2"
                />
                <label htmlFor={`student-email-${c.id}`} className="block text-[12px] font-semibold text-grey-500 mb-1">
                  학생 이메일
                </label>
                <input
                  id={`student-email-${c.id}`}
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-3"
                />
                {error && <p className="text-[12px] text-red mb-2">{error}</p>}
                <button
                  onClick={() => handleSend(c.id)}
                  disabled={loadingId === c.id}
                  className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  {loadingId === c.id ? "발송 중…" : "발송 확정"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <h2 className="text-[14px] font-bold text-ink mb-3">발송된 계약</h2>
      {contracts.length === 0 ? (
        <p className="text-[13px] text-grey-500">발송된 계약이 없습니다.</p>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-grey-500 border-b border-grey-200">
              <th className="py-2">학부모</th>
              <th className="py-2">학생</th>
              <th className="py-2">상태</th>
              <th className="py-2">서명일</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.id} className="border-b border-grey-100">
                <td className="py-2">{c.parentName}</td>
                <td className="py-2">{c.studentName}</td>
                <td className="py-2">{c.status === "signed" ? "서명완료" : "발송됨"}</td>
                <td className="py-2">{c.signedAt ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run app/admin/ContractsTab.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: `AdminShell.tsx`에 배선**

`app/admin/AdminShell.tsx` 상단 import에 추가:

```ts
import ContractsTab from "./ContractsTab";
import type { FamilyContract, PendingConsult } from "./contracts-data";
```

컴포넌트 props에 추가(다른 props들 옆에):

```ts
  pendingConsults,
  familyContracts,
```

및 타입 선언에도 추가:

```ts
  pendingConsults: PendingConsult[];
  familyContracts: FamilyContract[];
```

탭 렌더링 분기(`) : activeTab === "billing" ? (` 다음)에 추가:

```tsx
          ) : activeTab === "contracts" ? (
            <ContractsTab pendingConsults={pendingConsults} contracts={familyContracts} />
          ) : (
```

(기존 `) : ( <div className="p-8 text-[14px] text-grey-500"> ... </div> )` 바로 앞에 삽입.)

- [ ] **Step 6: `AdminShell.test.tsx` 수정**

`baseProps`에 추가:

```ts
  pendingConsults: [],
  familyContracts: [],
```

새 테스트 추가(기존 `describe("AdminShell", ...)` 블록 안, "수업권 탭을 누르면..." 테스트 다음):

```tsx
  it("계약 탭을 누르면 ContractsTab이 렌더링된다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("계약"));
    expect(screen.getByText("발송 대기")).toBeInTheDocument();
  });
```

- [ ] **Step 7: `page.tsx`에 데이터 로딩 배선**

`app/admin/page.tsx` import에 추가:

```ts
import { loadPendingConsults, loadFamilyContracts } from "./contracts-data";
```

`teachers` 로딩 다음 줄에 추가:

```ts
  const pendingConsults = await loadPendingConsults(supabase);
  const familyContracts = await loadFamilyContracts(supabase);
```

`<AdminShell ... />`에 props 추가:

```tsx
      pendingConsults={pendingConsults}
      familyContracts={familyContracts}
```

- [ ] **Step 8: 전체 테스트 + 타입체크 확인**

Run: `npx vitest run app/admin/ContractsTab.test.tsx app/admin/AdminShell.test.tsx`
Expected: PASS 전체

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 9: 커밋**

```bash
git add app/admin/ContractsTab.tsx app/admin/ContractsTab.test.tsx app/admin/AdminShell.tsx app/admin/AdminShell.test.tsx app/admin/page.tsx
git commit -m "feat(admin): 계약 탭 UI 및 배선 완료"
```

---

## Task 10: 전체 검증 + 티켓 체크 + 최종 커밋

**Files:**
- Modify: `docs/tickets.md`

- [ ] **Step 1: 전체 테스트 실행**

Run: `npx vitest run`
Expected: 기존 테스트 전부 + 이번에 추가한 테스트 전부 PASS

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: `docs/tickets.md`의 072 항목 체크**

`- [ ] **072-docusign**: 계약서 서명`을
`- [x] **072-docusign**: 계약서 서명 (2026-08-28: 학부모/학생 계약만 구현, 선생님 계약은 후속 티켓. DocuSign JWT Grant + 문서 직접 전송(anchor 태그, 템플릿 미사용) 방식. `lib/contracts/family-contract-template.ts`에 표준 약관 전문을 관리해 문구 수정이 그 파일 편집만으로 끝나도록 함. 관리자가 상담 신청 건에 학생 이름/이메일을 입력해 "계약서 발송"을 누르면 `inviteParent`/`inviteStudent`(기존 로직 재사용)로 계정 생성 → `contracts` 행 생성(status='sent') → DocuSign 봉투 발송. 서명 완료 웹훅(`/api/webhooks/docusign`)이 `contracts.status='signed'` + `students.status='active'`로 갱신. 웹훅은 쿼리스트링 토큰(`DOCUSIGN_WEBHOOK_TOKEN`)으로 검증. 실제 이메일 발송/서명까지의 종단 검증은 Task 1의 RSA 키 등록·동의 절차가 끝난 뒤 사람이 브라우저로 확인 필요.)`로 교체.

- [ ] **Step 4: 커밋**

```bash
git add docs/tickets.md
git commit -m "docs: 072(DocuSign 학부모 계약) 완료 체크"
git push origin main
```

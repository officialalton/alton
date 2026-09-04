import { getVercelOidcToken } from "@vercel/oidc";
import { ExternalAccountClient, type BaseExternalAccountClient } from "google-auth-library";

/**
 * M4 외부 검증 전용 — Preview에서만 쓰는 별도 최소권한 인증 경로.
 *
 * 절대 지켜야 할 것:
 * - 이 파일은 `lib/google-workspace-auth.ts`의 Production 체인(assertNotPreview() 포함)을
 *   전혀 건드리지 않는다. Production/local은 항상 기존 경로만 탄다.
 * - 이 경로는 아래 4개 조건(플래그 + VERCEL_ENV + org/team id + project id + git branch)이
 *   전부 일치할 때만 동작한다. 하나라도 없거나 다르면 즉시 throw하고, Production
 *   서비스 계정/체인으로 절대 넘어가지 않는다(fail-closed).
 * - 실제 GCP WIF provider/서비스 계정은 이 라운드에서 생성하지 않았다. 아래 상수는
 *   "설계된 이름"일 뿐이며, 실제 생성 전까지는 이 경로를 호출해도 항상
 *   ExternalAccountClient 생성 단계 이후 실제 GCP 쪽에서 인증이 실패한다(정상 동작).
 * - 응답 본문이나 토큰 원문은 어떤 에러 메시지에도 포함하지 않는다.
 */

// --- 설계된 GCP 리소스 이름 (실제 생성 안 됨) ---------------------------------
// R3의 Drive 전용 provider/서비스계정(vercel-r3-preview /
// r3-drive-preview-verify@alton-integration-sandbox.iam.gserviceaccount.com)과는
// 완전히 분리된, Calendar/Meet/Workspace Events/Smart Notes 검증 전용 리소스.
const M4_PREVIEW_WIF_PROVIDER_AUDIENCE =
  "//iam.googleapis.com/projects/590621873979/locations/global/workloadIdentityPools/vercel/providers/vercel-m4-calendar-preview-verify";
const M4_PREVIEW_SERVICE_ACCOUNT_EMAIL =
  "m4-calendar-preview-verify@alton-integration-sandbox.iam.gserviceaccount.com";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const MEET_SETTINGS_SCOPE = "https://www.googleapis.com/auth/meetings.space.settings";
const MEET_READONLY_SCOPE = "https://www.googleapis.com/auth/meetings.space.readonly";
// Workspace Events 구독 생성 시 대상 리소스(사용자 immutable id)를 조회하기 위한 최소
// 권한만 부여한다. 프로비저닝(생성/정지 등)이 가능한 admin.directory.user는 절대 쓰지 않는다.
const DIRECTORY_READONLY_SCOPE = "https://www.googleapis.com/auth/admin.directory.user.readonly";

const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SIGN_JWT_URL = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${M4_PREVIEW_SERVICE_ACCOUNT_EMAIL}:signJwt`;

// --- 서버 전용 명시 플래그 (기본 false) ----------------------------------------
const ALLOW_ENV_VAR = "GOOGLE_WORKSPACE_M4_PREVIEW_VERIFY_ALLOW";
const EXPECTED_ORG_ID_ENV_VAR = "GOOGLE_WORKSPACE_M4_PREVIEW_EXPECTED_VERCEL_ORG_ID";
const EXPECTED_PROJECT_ID_ENV_VAR = "GOOGLE_WORKSPACE_M4_PREVIEW_EXPECTED_VERCEL_PROJECT_ID";
const EXPECTED_BRANCH_ENV_VAR = "GOOGLE_WORKSPACE_M4_PREVIEW_EXPECTED_BRANCH";

/**
 * 이 경로를 호출하는 쪽(예: lib/google-calendar.ts)이 "분기 선택"에만 쓰는 가벼운
 * 체크. 실제 fail-closed 검증은 각 토큰 함수 내부의 assertAllowed()가 전부 다시 한다 —
 * 이 함수가 true를 반환했다고 해서 토큰 함수가 반드시 성공하는 것은 아니다.
 */
export function isM4PreviewVerificationFlagEnabled(): boolean {
  return process.env[ALLOW_ENV_VAR] === "true";
}

function assertAllowed(): void {
  if (process.env[ALLOW_ENV_VAR] !== "true") {
    throw new Error(
      `M4 Preview 검증 경로가 비활성화되어 있습니다(${ALLOW_ENV_VAR}=true 아님). Production 체인으로 넘어가지 않습니다.`,
    );
  }

  if (process.env.VERCEL_ENV !== "preview") {
    throw new Error(
      `M4 Preview 검증 경로는 VERCEL_ENV=preview에서만 허용됩니다(현재: ${process.env.VERCEL_ENV ?? "unset"}).`,
    );
  }

  const expectedOrgId = process.env[EXPECTED_ORG_ID_ENV_VAR];
  const expectedProjectId = process.env[EXPECTED_PROJECT_ID_ENV_VAR];
  const expectedBranch = process.env[EXPECTED_BRANCH_ENV_VAR];

  if (!expectedOrgId || !expectedProjectId || !expectedBranch) {
    throw new Error(
      `M4 Preview 검증 경로에 필요한 기대값(${EXPECTED_ORG_ID_ENV_VAR}/${EXPECTED_PROJECT_ID_ENV_VAR}/${EXPECTED_BRANCH_ENV_VAR})이 설정되지 않았습니다.`,
    );
  }

  const actualOrgId = process.env.VERCEL_ORG_ID;
  const actualProjectId = process.env.VERCEL_PROJECT_ID;
  const actualBranch = process.env.VERCEL_GIT_COMMIT_REF;

  if (actualOrgId !== expectedOrgId) {
    throw new Error("M4 Preview 검증 경로: Vercel team(org) id가 기대값과 일치하지 않습니다.");
  }
  if (actualProjectId !== expectedProjectId) {
    throw new Error("M4 Preview 검증 경로: Vercel project id가 기대값과 일치하지 않습니다.");
  }
  if (actualBranch !== expectedBranch) {
    throw new Error("M4 Preview 검증 경로: 현재 브랜치가 검증 브랜치와 일치하지 않습니다.");
  }
}

let cachedClient: BaseExternalAccountClient | null = null;

function getClient(): BaseExternalAccountClient {
  if (cachedClient) return cachedClient;
  const client = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience: M4_PREVIEW_WIF_PROVIDER_AUDIENCE,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${M4_PREVIEW_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
    scopes: [CALENDAR_SCOPE, MEET_SETTINGS_SCOPE, MEET_READONLY_SCOPE, DIRECTORY_READONLY_SCOPE],
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken(),
    },
  });
  if (!client) {
    throw new Error("M4 Preview 검증용 ExternalAccountClient 생성에 실패했습니다.");
  }
  cachedClient = client;
  return client;
}

async function getImpersonatedAccessToken(): Promise<string> {
  const client = getClient();
  const { token } = await client.getAccessToken();
  if (!token) {
    throw new Error("M4 Preview 검증 impersonation 토큰을 받지 못했습니다.");
  }
  return token;
}

/**
 * DWD가 필요한 스코프(Calendar/Meet)는 특정 teacher 메일함으로 sub를 위임해야 한다.
 * 실제 DWD client-id 승인은 이번 라운드에서 하지 않으므로, 이 함수는 실제 GCP 환경에
 * 연결되기 전까지는 signJwt 호출 단계에서 실패하는 것이 정상이다.
 */
async function signDelegatedSubjectJwt(
  impersonatedAccessToken: string,
  scope: string,
  subjectEmail: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: M4_PREVIEW_SERVICE_ACCOUNT_EMAIL,
    sub: subjectEmail,
    scope,
    aud: OAUTH_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const response = await fetch(SIGN_JWT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${impersonatedAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload: JSON.stringify(payload) }),
  });

  if (!response.ok) {
    // 응답 본문은 로그/에러 메시지에 포함하지 않는다 — 토큰 원문이 섞여 나올 가능성을 원천 차단.
    throw new Error(`M4 Preview 검증 signJwt 호출이 실패했습니다(status=${response.status}).`);
  }

  const body = (await response.json()) as { signedJwt?: string };
  if (!body.signedJwt) {
    throw new Error("M4 Preview 검증 signJwt 응답에 signedJwt가 없습니다.");
  }
  return body.signedJwt;
}

async function exchangeSignedJwtForAccessToken(signedJwt: string): Promise<string> {
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`M4 Preview 검증 토큰 교환이 실패했습니다(status=${response.status}).`);
  }

  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error("M4 Preview 검증 토큰 교환 응답에 access_token이 없습니다.");
  }
  return body.access_token;
}

async function getDelegatedAccessToken(scope: string, subjectEmail: string): Promise<string> {
  assertAllowed();
  const impersonatedAccessToken = await getImpersonatedAccessToken();
  const signedJwt = await signDelegatedSubjectJwt(impersonatedAccessToken, scope, subjectEmail);
  return exchangeSignedJwtForAccessToken(signedJwt);
}

export async function getM4PreviewCalendarAccessToken(subjectEmail: string): Promise<string> {
  return getDelegatedAccessToken(CALENDAR_SCOPE, subjectEmail);
}

export async function getM4PreviewMeetSettingsAccessToken(subjectEmail: string): Promise<string> {
  return getDelegatedAccessToken(MEET_SETTINGS_SCOPE, subjectEmail);
}

export async function getM4PreviewMeetReadonlyAccessToken(subjectEmail: string): Promise<string> {
  return getDelegatedAccessToken(MEET_READONLY_SCOPE, subjectEmail);
}

export async function getM4PreviewDirectoryReadonlyAccessToken(subjectEmail: string): Promise<string> {
  return getDelegatedAccessToken(DIRECTORY_READONLY_SCOPE, subjectEmail);
}

// 테스트 전용: 모듈 캐시(cachedClient)를 초기화한다.
export function __resetM4PreviewVerifyAuthCacheForTests(): void {
  cachedClient = null;
}

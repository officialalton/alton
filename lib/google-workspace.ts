import { randomBytes } from "crypto";

// R2 Task 7 — Google Workspace Directory API 클라이언트.
//
// 인증 체인(2026-08-31 확정, 서비스 계정 키·장기 refresh token 금지):
//   Vercel OIDC 토큰 → GCP Workload Identity Federation → 서비스 계정
//   impersonation(IAM Credentials generateAccessToken) → signJwt(Domain-wide
//   Delegation sub claim) → OAuth 토큰 교환 → Directory API.
//
// 이 체인은 Gate C(`docs/2026-08-29-gate-c-sandbox-infra-log.md`)가 로컬
// gcloud 세션으로 수기 검증한 signJwt+DWD 메커니즘과 동일하되, Vercel에는
// gcloud 세션이 없으므로 앞단에 OIDC→WIF→impersonation 홉을 추가해 "이
// 서비스 계정의 signJwt를 호출할 권한"을 얻는다. 실제 WIF 인프라가 아직
// 준비되지 않아 이 체인 자체는 로컬/CI에서 검증할 수 없다 — 로컬 테스트는
// 전부 이 모듈을 vi.mock()으로 대체해 수행한다(app/admin/workspace-actions.ts
// 참고). 실제 연결 검증은 인프라 준비 후 별도로 1회 수행한다.

const DIRECTORY_API_BASE = "https://admin.googleapis.com/admin/directory/v1";
const DIRECTORY_SCOPE = "https://www.googleapis.com/auth/admin.directory.user";
const STS_TOKEN_URL = "https://sts.googleapis.com/v1/token";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Preview 환경에서는 실제 Workspace 계정 생성을 절대 호출하지 않는다.
 * Production/승인된 테스트 환경에서만 WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS를
 * 명시적으로 켠다 — 기본값은 비활성화.
 */
function assertRealCallsAllowed(): void {
  if (process.env.VERCEL_ENV === "preview") {
    throw new Error("Preview 환경에서는 실제 Workspace 계정 작업을 호출할 수 없습니다.");
  }
  if (process.env.WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS !== "true") {
    throw new Error(
      "실제 Workspace API 호출이 비활성화되어 있습니다(WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS=true 필요)."
    );
  }
}

async function exchangeVercelOidcForFederatedToken(): Promise<string> {
  const oidcToken = process.env.VERCEL_OIDC_TOKEN;
  const audience = process.env.GOOGLE_WORKLOAD_IDENTITY_AUDIENCE; // //iam.googleapis.com/projects/.../workloadIdentityPools/.../providers/...
  if (!oidcToken) throw new Error("VERCEL_OIDC_TOKEN이 없습니다 — Vercel OIDC federation이 활성화되어 있는지 확인하세요.");
  if (!audience) throw new Error("GOOGLE_WORKLOAD_IDENTITY_AUDIENCE 환경변수가 설정되지 않았습니다.");

  const res = await fetch(STS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audience,
      grantType: "urn:ietf:params:oauth:grant-type:token-exchange",
      requestedTokenType: "urn:ietf:params:oauth:token-type:access_token",
      scope: "https://www.googleapis.com/auth/cloud-platform",
      subjectTokenType: "urn:ietf:params:oauth:token-type:jwt",
      subjectToken: oidcToken,
    }),
  });
  if (!res.ok) throw new Error(`GCP WIF 토큰 교환 실패: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function impersonateServiceAccount(federatedToken: string): Promise<string> {
  const serviceAccountEmail = process.env.GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL;
  if (!serviceAccountEmail) throw new Error("GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL 환경변수가 설정되지 않았습니다.");

  const res = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${federatedToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ scope: ["https://www.googleapis.com/auth/cloud-platform"] }),
    }
  );
  if (!res.ok) throw new Error(`서비스 계정 impersonation 실패: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { accessToken: string };
  return data.accessToken;
}

async function signDelegatedAdminJwt(impersonatedToken: string): Promise<string> {
  const serviceAccountEmail = process.env.GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL!;
  const delegatedAdminEmail = process.env.GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL;
  if (!delegatedAdminEmail) throw new Error("GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL 환경변수가 설정되지 않았습니다.");

  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccountEmail,
    sub: delegatedAdminEmail,
    scope: DIRECTORY_SCOPE,
    aud: OAUTH_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };

  const res = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:signJwt`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${impersonatedToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ payload: JSON.stringify(payload) }),
    }
  );
  if (!res.ok) throw new Error(`Domain-wide delegation signJwt 실패: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { signedJwt: string };
  return data.signedJwt;
}

async function exchangeSignedJwtForDirectoryToken(signedJwt: string): Promise<string> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });
  if (!res.ok) throw new Error(`Directory API 토큰 교환 실패: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function getImpersonatedAccessToken(): Promise<string> {
  const federatedToken = await exchangeVercelOidcForFederatedToken();
  const impersonatedToken = await impersonateServiceAccount(federatedToken);
  const signedJwt = await signDelegatedAdminJwt(impersonatedToken);
  return exchangeSignedJwtForDirectoryToken(signedJwt);
}

/**
 * 암호학적으로 안전한 무작위 초기 비밀번호. 호출자에게 반환하지 않고
 * createWorkspaceUser() 내부에서만 사용한 뒤 즉시 버려진다 — 어디에도
 * 저장·로그·반환되지 않는다.
 */
function generateSecureTempPassword(): string {
  return randomBytes(24).toString("base64url");
}

export type WorkspaceUserConflict = { conflict: true };
export type WorkspaceUserCreated = { conflict: false; googleUserId: string };

export async function createWorkspaceUser(params: {
  workspaceEmail: string;
  givenName: string;
  familyName: string;
  orgUnitPath: string;
}): Promise<WorkspaceUserCreated | WorkspaceUserConflict> {
  assertRealCallsAllowed();
  const accessToken = await getImpersonatedAccessToken();
  const tempPassword = generateSecureTempPassword();

  const res = await fetch(`${DIRECTORY_API_BASE}/users`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      primaryEmail: params.workspaceEmail,
      name: { givenName: params.givenName, familyName: params.familyName },
      password: tempPassword,
      changePasswordAtNextLogin: true,
      orgUnitPath: params.orgUnitPath,
    }),
  });

  if (res.status === 409) {
    return { conflict: true };
  }
  if (!res.ok) {
    throw new Error(`Directory API 사용자 생성 실패: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id: string };
  return { conflict: false, googleUserId: data.id };
}

export async function getWorkspaceUserByGoogleId(
  googleUserId: string
): Promise<{ primaryEmail: string; suspended: boolean } | null> {
  assertRealCallsAllowed();
  const accessToken = await getImpersonatedAccessToken();
  const res = await fetch(`${DIRECTORY_API_BASE}/users/${googleUserId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Directory API 사용자 조회 실패: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { primaryEmail: string; suspended: boolean };
  return { primaryEmail: data.primaryEmail, suspended: data.suspended };
}

export async function suspendWorkspaceUser(googleUserId: string): Promise<void> {
  assertRealCallsAllowed();
  const accessToken = await getImpersonatedAccessToken();
  const res = await fetch(`${DIRECTORY_API_BASE}/users/${googleUserId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ suspended: true }),
  });
  if (!res.ok) throw new Error(`Directory API 정지 실패: ${res.status} ${await res.text()}`);
}

export async function reactivateWorkspaceUser(googleUserId: string): Promise<void> {
  assertRealCallsAllowed();
  const accessToken = await getImpersonatedAccessToken();
  const res = await fetch(`${DIRECTORY_API_BASE}/users/${googleUserId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ suspended: false }),
  });
  if (!res.ok) throw new Error(`Directory API 재활성화 실패: ${res.status} ${await res.text()}`);
}

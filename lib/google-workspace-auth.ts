import { getVercelOidcToken } from "@vercel/oidc";
import { ExternalAccountClient, type BaseExternalAccountClient } from "google-auth-library";

// R2 Task 7 — Google Workspace 인증 체인, 공식 라이브러리 기반.
//
// Vercel OIDC → GCP Workload Identity Federation → 서비스 계정
// (gate-c-automation@...) impersonation 구간은 Vercel 공식 문서
// (https://vercel.com/docs/oidc/gcp)가 그대로 권장하는 `@vercel/oidc`의
// `getVercelOidcToken()` + `google-auth-library`의 `ExternalAccountClient`
// 조합을 그대로 쓴다 — 이전에 raw fetch로 손수 구현했던 STS 토큰 교환 코드는
// 완전히 제거했다(같은 보안 경로가 두 개 존재하면 검증·유지보수가 어려워
// 진다는 판단). 서비스 계정 키 파일이나 장기 refresh token은 어디에도
// 쓰지 않는다 — ExternalAccountClient는 매 호출마다 Vercel의 단기 OIDC
// 토큰을 구독(subject_token_supplier)해 그때그때 새로 교환한다.
//
// signJwt(Domain-wide Delegation) 이후 구간은 Vercel 문서가 다루지 않는
// Workspace Admin SDK 전용 로직이라 이전과 동일하게 직접 구현한다 — 이
// 서비스 계정은 impersonation된 자기 자신을 대상으로 signJwt를 호출한다
// (self-referential, IAM 설정 시 gate-c-automation@...에게 자기 자신
// 기준 iam.serviceAccounts.signJwt 권한이 필요한 이유).
//
// 토큰은 전부 프로세스 메모리에서만 존재한다 — 디스크·DB·외부 캐시에 쓰지
// 않고, 에러 메시지에도 원문을 절대 포함하지 않는다. 캐싱은
// google-auth-library(impersonation 토큰)와 이 파일의 모듈 스코프 변수
// (DWD 토큰, lib/docusign.ts와 동일한 만료 임박 재발급 패턴)가 각각
// 같은 실행 환경 안에서만 담당한다 — 인스턴스가 재시작되면 사라진다.
//
// GCP Workload Identity Pool Provider의 audience 설정은 "Allowed
// audiences = https://vercel.com/[team-slug]"(Vercel이 발급하는 OIDC
// 토큰의 기본 aud, 실측 확인됨)로 구성했다 — "Default audience"(리소스
// 이름 자체를 aud로 강제하는 모드)가 아니다. 그래서 getVercelOidcToken()은
// 커스텀 audience 없이 그대로 호출한다(Vercel 공식 예제의 기본 경로와
// 동일) — GOOGLE_WORKLOAD_IDENTITY_AUDIENCE는 ExternalAccountClient
// 자신의 audience 필드(STS 교환에서 "어느 WIF provider로 검증할지"
// 식별자, GCP 리소스 이름 형식)에만 쓰이고 Vercel 토큰의 aud 클레임과는
// 무관하다 — 이 둘을 같은 값으로 착각해 커스텀 audience를 다시 넘기면
// GCP Provider의 Allowed audiences 설정과 불일치해 인증이 실패한다.

const DIRECTORY_SCOPE = "https://www.googleapis.com/auth/admin.directory.user";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

function assertNotPreview(): void {
  if (process.env.VERCEL_ENV === "preview") {
    throw new Error("Preview 환경에서는 실제 Google Workspace 인증 체인을 호출할 수 없습니다.");
  }
}

let cachedExternalAccountClient: BaseExternalAccountClient | null = null;

function getExternalAccountClient(): BaseExternalAccountClient {
  if (cachedExternalAccountClient) return cachedExternalAccountClient;

  const audience = process.env.GOOGLE_WORKLOAD_IDENTITY_AUDIENCE;
  const serviceAccountEmail = process.env.GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL;
  if (!audience) {
    throw new Error("GOOGLE_WORKLOAD_IDENTITY_AUDIENCE 환경변수가 설정되지 않았습니다.");
  }
  if (!serviceAccountEmail) {
    throw new Error("GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL 환경변수가 설정되지 않았습니다.");
  }

  const client = ExternalAccountClient.fromJSON({
    type: "external_account",
    // 이 audience는 GCP WIF Provider의 리소스 이름(STS 교환에서 "어느
    // provider로 검증할지" 식별자)이다 — Vercel OIDC 토큰 자체의 aud
    // 클레임과는 다른 값이다. 우리는 GCP Provider를 "Allowed audiences =
    // https://vercel.com/[team]"(Vercel 기본값) 모드로 설정했으므로,
    // 아래 subject_token_supplier는 getVercelOidcToken()을 인자 없이
    // 그대로 호출해 Vercel의 기본 aud를 그대로 쓴다(Default audience
    // 모드였다면 여기도 이 audience를 넘겨 aud를 강제해야 했겠지만,
    // Allowed audiences 모드는 "추가 코드 설정 없이" 동작하도록 설계된
    // 경로다 — Vercel 공식 문서 예제와 동일).
    audience,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    subject_token_supplier: {
      getSubjectToken: getVercelOidcToken,
    },
  });
  if (!client) {
    throw new Error("ExternalAccountClient 생성에 실패했습니다 — 인증 설정을 확인하세요.");
  }
  cachedExternalAccountClient = client;
  return client;
}

/**
 * Vercel OIDC → GCP WIF → 서비스 계정(gate-c-automation@...) impersonation을
 * 거친 cloud-platform 범위 단기 액세스 토큰. google-auth-library가 만료
 * 임박 시 내부적으로 자동 갱신한다 — 이 함수 밖으로 원문을 로그하지 않는다.
 */
export async function getImpersonatedAccessToken(): Promise<string> {
  assertNotPreview();
  const client = getExternalAccountClient();
  const { token } = await client.getAccessToken();
  if (!token) {
    throw new Error("서비스 계정 impersonation 토큰을 받지 못했습니다.");
  }
  return token;
}

async function signDelegatedAdminJwt(impersonatedAccessToken: string): Promise<string> {
  const serviceAccountEmail = process.env.GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL!;
  const delegatedAdminEmail = process.env.GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL;
  if (!delegatedAdminEmail) {
    throw new Error("GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL 환경변수가 설정되지 않았습니다.");
  }

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
      headers: { Authorization: `Bearer ${impersonatedAccessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ payload: JSON.stringify(payload) }),
    }
  );
  if (!res.ok) {
    // 응답 본문은 로그/에러 메시지에 포함하지 않는다 — 토큰 원문이 섞여
    // 나올 가능성을 원천 차단한다.
    throw new Error(`Domain-wide delegation signJwt 실패 (status ${res.status})`);
  }
  const data = (await res.json()) as { signedJwt: string };
  return data.signedJwt;
}

let cachedDirectoryToken: { accessToken: string; expiresAt: number } | null = null;

/**
 * Directory API(admin.directory.user) 범위로 최종 사용 가능한 액세스
 * 토큰 — signJwt(DWD) + OAuth 토큰 교환까지 끝난 결과. lib/docusign.ts와
 * 동일한 만료 임박 재발급 캐싱 패턴(같은 실행 환경 안에서만 유효, 외부
 * 저장소에 쓰지 않음).
 */
export async function getDirectoryApiAccessToken(): Promise<string> {
  assertNotPreview();
  const now = Math.floor(Date.now() / 1000);
  if (cachedDirectoryToken && cachedDirectoryToken.expiresAt > now + 60) {
    return cachedDirectoryToken.accessToken;
  }

  const impersonatedToken = await getImpersonatedAccessToken();
  const signedJwt = await signDelegatedAdminJwt(impersonatedToken);

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Directory API 토큰 교환 실패 (status ${res.status})`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedDirectoryToken = { accessToken: data.access_token, expiresAt: now + data.expires_in };
  return cachedDirectoryToken.accessToken;
}

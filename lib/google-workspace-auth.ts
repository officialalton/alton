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
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
// R6: Calendar/Meet 이벤트 생성·수정·삭제용. Directory/Drive와 달리 고정된
// GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL이 아니라 "그 수업을 맡은 선생님 본인"의
// Workspace 계정(@alton.education, R2/R5에서 이미 발급)을 DWD subject로 삼는다 —
// 이벤트가 실제로 그 선생님의 캘린더에 생겨야 하기 때문이다. signDelegatedAdminJwt에
// subjectEmail을 넘겨 오버라이드한다.
//
// (2026-09-02 정정, R6 11/N) 이전에는 여기서 광범위한 `.../auth/calendar` 스코프를
// 요청했다 — 그런데 Gate C가 실제로 DWD에 등록한 목록(`docs/2026-08-29-gate-c-sandbox-infra-log.md`
// §"등록할 scope")에는 `calendar.events`/`calendar.events.readonly`만 있고 광범위한
// `calendar` 스코프는 없다. Google의 도메인 전체 위임은 요청 스코프가 등록 목록에
// 정확히 포함돼 있어야 통과하므로, 이 불일치 상태로는 실제 호출 시 전부 인가
// 실패였을 것이다(지금까지 CALENDAR_SYNC_ALLOW_REAL_CALLS가 항상 false여서 발견되지
// 않았을 뿐). 이미 등록된 `calendar.events`로 좁혀 이 불일치를 제거한다 — 이벤트
// 생성·수정·삭제는 전부 이 스코프로 충분하고(광범위한 scope보다 최소권한 원칙에도
// 더 맞음), 새로운 외부 승인이 필요하지 않다.
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

// R6 11/N: FreeBusy 조회 전용 최소권한 스코프(제품 오너 정정 지시) — 이벤트 생성용
// CALENDAR_SCOPE와 분리한다. **이 스코프는 Gate C가 등록한 DWD 목록에 없다** — 실제
// Sandbox 호출 전에 Admin Console에서 이 스코프를 서비스 계정의 DWD 클라이언트 ID에
// 추가 등록해야 한다(아직 미승인 — Google Sandbox 승인 요청서 참고, 이 세션에서
// 임의로 등록하지 않음).
const FREEBUSY_SCOPE = "https://www.googleapis.com/auth/calendar.events.freebusy";

// R6 11/N: Meet API v2(lib/google-meet.ts)는 이전까지 Calendar용 토큰을 그대로
// 재사용했다 — Meet API는 Calendar API와 별개 표면이라 `calendar.events` scope로는
// 인가되지 않을 가능성이 높다(Gate C §1.3이 별도로 등록한 `meetings.space.settings`/
// `meetings.space.readonly`가 바로 이 용도). 전용 토큰 함수로 분리한다.
const MEET_SETTINGS_SCOPE = "https://www.googleapis.com/auth/meetings.space.settings";
const MEET_READONLY_SCOPE = "https://www.googleapis.com/auth/meetings.space.readonly";
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
    // google-auth-library는 getSubjectToken(context)를 context 인자와 함께
    // 호출한다 — 이 context.audience는 GCP WIF provider 리소스명(위 audience
    // 필드와 같은 값)으로, getVercelOidcToken()의 자체 옵션(options.audience,
    // 커스텀 Vercel 토큰 aud 재발급용)과 이름만 같은 별개 개념이다.
    // getVercelOidcToken을 그대로 넘기면 이 context가 그대로 전달돼
    // options.audience로 오인되어 Vercel 토큰의 aud가 GCP 리소스명으로
    // 재발급되고, Allowed audiences 모드의 GCP Provider가 이를 거부한다
    // (실측: "The audience in ID Token [...] does not match the expected
    // audience"). 반드시 인자 없이 호출해 Vercel 기본 aud를 그대로 쓴다.
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken(),
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

async function signDelegatedAdminJwt(
  impersonatedAccessToken: string,
  scope: string,
  subjectEmailOverride?: string
): Promise<string> {
  const serviceAccountEmail = process.env.GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL!;
  const delegatedAdminEmail = subjectEmailOverride ?? process.env.GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL;
  if (!delegatedAdminEmail) {
    throw new Error("GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL 환경변수가 설정되지 않았습니다.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccountEmail,
    sub: delegatedAdminEmail,
    scope,
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
  const signedJwt = await signDelegatedAdminJwt(impersonatedToken, DIRECTORY_SCOPE);

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

let cachedDriveToken: { accessToken: string; expiresAt: number } | null = null;

/**
 * Drive API(v3) 범위 액세스 토큰. R3: 완료된 계약서·감사증명서를 회사 Shared
 * Drive에 올리기 위해 getDirectoryApiAccessToken()과 동일한 DWD 패턴을
 * Drive 스코프로 재사용한다. 새 서비스 계정·WIF 설정을 만들지 않고 기존
 * R2 체인을 그대로 재사용한다 — Google Cloud Console에서 이 서비스 계정에
 * Drive API 스코프가 이미 허용돼 있어야 한다(도메인 전체 위임 설정의
 * OAuth 범위 목록에 포함 필요).
 */
export async function getDriveApiAccessToken(): Promise<string> {
  assertNotPreview();
  const now = Math.floor(Date.now() / 1000);
  if (cachedDriveToken && cachedDriveToken.expiresAt > now + 60) {
    return cachedDriveToken.accessToken;
  }

  const impersonatedToken = await getImpersonatedAccessToken();
  const signedJwt = await signDelegatedAdminJwt(impersonatedToken, DRIVE_SCOPE);

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Drive API 토큰 교환 실패 (status ${res.status})`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedDriveToken = { accessToken: data.access_token, expiresAt: now + data.expires_in };
  return cachedDriveToken.accessToken;
}

const cachedCalendarTokensBySubject = new Map<string, { accessToken: string; expiresAt: number }>();

/**
 * Calendar API 범위 액세스 토큰 — subjectEmail(선생님 본인의 @alton.education 계정)로
 * DWD subject를 오버라이드한다(위 CALENDAR_SCOPE 주석 참고). Directory/Drive와 달리
 * 여러 선생님을 대상으로 하므로 subject별로 별도 캐시한다.
 */
export async function getCalendarApiAccessToken(subjectEmail: string): Promise<string> {
  assertNotPreview();
  const now = Math.floor(Date.now() / 1000);
  const cached = cachedCalendarTokensBySubject.get(subjectEmail);
  if (cached && cached.expiresAt > now + 60) {
    return cached.accessToken;
  }

  const impersonatedToken = await getImpersonatedAccessToken();
  const signedJwt = await signDelegatedAdminJwt(impersonatedToken, CALENDAR_SCOPE, subjectEmail);

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Calendar API 토큰 교환 실패 (status ${res.status})`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedCalendarTokensBySubject.set(subjectEmail, { accessToken: data.access_token, expiresAt: now + data.expires_in });
  return data.access_token;
}

const cachedFreeBusyTokensBySubject = new Map<string, { accessToken: string; expiresAt: number }>();

/**
 * FreeBusy 조회 전용 액세스 토큰(FREEBUSY_SCOPE, CALENDAR_SCOPE와 별개 — 위 주석 참고).
 * 이 스코프가 아직 DWD에 등록되지 않았으므로, 실제로 호출하면(CALENDAR_SYNC_ALLOW_REAL_CALLS=true
 * 상태에서) Google이 인가 실패(invalid_grant 등)를 반환할 것이 예상된다 — 이는 버그가
 * 아니라 아직 승인되지 않은 외부 설정 변경이 남아있다는 신호다.
 */
export async function getFreeBusyApiAccessToken(subjectEmail: string): Promise<string> {
  assertNotPreview();
  const now = Math.floor(Date.now() / 1000);
  const cached = cachedFreeBusyTokensBySubject.get(subjectEmail);
  if (cached && cached.expiresAt > now + 60) {
    return cached.accessToken;
  }

  const impersonatedToken = await getImpersonatedAccessToken();
  const signedJwt = await signDelegatedAdminJwt(impersonatedToken, FREEBUSY_SCOPE, subjectEmail);

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`FreeBusy API 토큰 교환 실패 (status ${res.status})`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedFreeBusyTokensBySubject.set(subjectEmail, { accessToken: data.access_token, expiresAt: now + data.expires_in });
  return data.access_token;
}

async function exchangeDelegatedToken(scope: string, subjectEmail: string): Promise<{ accessToken: string; expiresIn: number }> {
  const impersonatedToken = await getImpersonatedAccessToken();
  const signedJwt = await signDelegatedAdminJwt(impersonatedToken, scope, subjectEmail);
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: signedJwt }),
  });
  if (!res.ok) {
    throw new Error(`Meet API 토큰 교환 실패 (status ${res.status})`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

const cachedMeetSettingsTokensBySubject = new Map<string, { accessToken: string; expiresAt: number }>();

/** Meet Space 설정 변경(Smart Notes ON/OFF)용 전용 토큰. */
export async function getMeetSettingsApiAccessToken(subjectEmail: string): Promise<string> {
  assertNotPreview();
  const now = Math.floor(Date.now() / 1000);
  const cached = cachedMeetSettingsTokensBySubject.get(subjectEmail);
  if (cached && cached.expiresAt > now + 60) return cached.accessToken;
  const { accessToken, expiresIn } = await exchangeDelegatedToken(MEET_SETTINGS_SCOPE, subjectEmail);
  cachedMeetSettingsTokensBySubject.set(subjectEmail, { accessToken, expiresAt: now + expiresIn });
  return accessToken;
}

const cachedMeetReadonlyTokensBySubject = new Map<string, { accessToken: string; expiresAt: number }>();

/** Meet 참가 기록 조회용 전용 토큰. */
export async function getMeetReadonlyApiAccessToken(subjectEmail: string): Promise<string> {
  assertNotPreview();
  const now = Math.floor(Date.now() / 1000);
  const cached = cachedMeetReadonlyTokensBySubject.get(subjectEmail);
  if (cached && cached.expiresAt > now + 60) return cached.accessToken;
  const { accessToken, expiresIn } = await exchangeDelegatedToken(MEET_READONLY_SCOPE, subjectEmail);
  cachedMeetReadonlyTokensBySubject.set(subjectEmail, { accessToken, expiresAt: now + expiresIn });
  return accessToken;
}

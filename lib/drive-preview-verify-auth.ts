import { getVercelOidcToken } from "@vercel/oidc";
import { ExternalAccountClient, type BaseExternalAccountClient } from "google-auth-library";

// R3 Drive Preview 검증 전용, 임시 인증 경로 (2026-09-01).
//
// 목적: `lib/google-workspace-auth.ts`의 Production WIF 체인(assertNotPreview()로
// Preview 차단, Directory API DWD 포함)을 절대 건드리지 않고, Drive 실측 검증만
// Preview 환경에서 가능하게 하는 완전히 별도의 최소권한 경로.
//
// - 별도 서비스 계정: r3-drive-preview-verify@alton-integration-sandbox.iam.gserviceaccount.com
//   (Directory API 권한 없음, Domain-Wide Delegation 없음 — ALTON Integration Sandbox
//   Shared Drive에 Content Manager로 직접 초대된 것만으로 접근)
// - 별도 WIF provider: vercel/providers/vercel-r3-preview
//   (attribute-condition으로 owner_id/project_id/environment=="preview" 전부 제한 —
//   이 ALTON Vercel 프로젝트의 Preview 환경 토큰만 이 서비스 계정을 impersonate 가능)
// - 서비스 계정 키 파일 없음 — WIF 단기 토큰만 사용, Cloud Audit Logs에 impersonation
//   주체가 그대로 남는다.
// - 검증 완료 후 회수 대상(별도 승인으로 삭제): 이 서비스 계정, 이 provider, Shared
//   Drive 멤버십, 아래 두 환경변수, DRIVE_ARTIFACTS_ALLOW_REAL_WRITES.

const R3_PREVIEW_AUDIENCE =
  "//iam.googleapis.com/projects/590621873979/locations/global/workloadIdentityPools/vercel/providers/vercel-r3-preview";
const R3_PREVIEW_SERVICE_ACCOUNT_EMAIL =
  "r3-drive-preview-verify@alton-integration-sandbox.iam.gserviceaccount.com";

let cachedClient: BaseExternalAccountClient | null = null;

function getClient(): BaseExternalAccountClient {
  if (cachedClient) return cachedClient;
  const client = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience: R3_PREVIEW_AUDIENCE,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${R3_PREVIEW_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
    // Directory API 권한이 아예 없는 서비스 계정이라 impersonation 토큰의 스코프를
    // Drive 하나로 명시해야 한다 — 없으면 IAM이 기본 cloud-platform 스코프만
    // 발급해 실제 Drive API 호출에서 403(insufficient scopes)이 난다(실측 확인).
    scopes: ["https://www.googleapis.com/auth/drive"],
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken(),
    },
  });
  if (!client) {
    throw new Error("R3 Preview Drive 검증용 ExternalAccountClient 생성에 실패했습니다.");
  }
  cachedClient = client;
  return client;
}

/**
 * Drive API(v3, drive scope) 액세스 토큰. Production 인증 체인과 완전히 분리된
 * 임시 경로 — 이 서비스 계정은 Directory API 권한이 없어 Drive 외 다른 Google
 * Workspace API는 호출할 수 없다(호출해도 권한 거부됨).
 */
export async function getR3PreviewDriveAccessToken(): Promise<string> {
  const client = getClient();
  const { token } = await client.getAccessToken();
  if (!token) {
    throw new Error("R3 Preview Drive 검증 impersonation 토큰을 받지 못했습니다.");
  }
  return token;
}

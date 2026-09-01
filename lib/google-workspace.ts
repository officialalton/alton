import { randomBytes } from "crypto";
import { getDirectoryApiAccessToken } from "./google-workspace-auth";

// R2 Task 7 — Google Workspace Directory API 쓰기 전용 클라이언트(계정
// 생성·정지·재활성화). 읽기 전용 조회는 의도적으로 이 파일에 두지 않고
// lib/google-workspace-directory-readonly.ts로 분리했다 — preflight
// 경로가 이 파일을 아예 import하지 않으므로 구조적으로 쓰기 호출이
// 불가능하다(같은 함수에서 boolean 하나로 read/write를 가르지 않는다).
//
// 인증 체인(Vercel OIDC → GCP WIF → 서비스 계정 impersonation → signJwt →
// DWD)은 lib/google-workspace-auth.ts에 있다 — 이 파일은 그 결과 토큰만
// 받아서 쓴다.

const DIRECTORY_API_BASE = "https://admin.googleapis.com/admin/directory/v1";

/**
 * Preview 환경에서는 실제 Workspace 계정 생성을 절대 호출하지 않는다.
 * Production/승인된 테스트 환경에서만 WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS를
 * 명시적으로 켠다 — 기본값은 비활성화. (읽기 전용 preflight는 별도
 * WORKSPACE_PREFLIGHT_ALLOW_REAL_READS로 이 플래그와 무관하게 독립
 * 동작한다 — lib/google-workspace-directory-readonly.ts 참고.)
 */
function assertRealWritesAllowed(): void {
  if (process.env.VERCEL_ENV === "preview") {
    throw new Error("Preview 환경에서는 실제 Workspace 계정 작업을 호출할 수 없습니다.");
  }
  if (process.env.WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS !== "true") {
    throw new Error(
      "실제 Workspace API 쓰기 호출이 비활성화되어 있습니다(WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS=true 필요)."
    );
  }
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
  assertRealWritesAllowed();
  const accessToken = await getDirectoryApiAccessToken();
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
    throw new Error(`Directory API 사용자 생성 실패 (status ${res.status})`);
  }
  const data = (await res.json()) as { id: string };
  return { conflict: false, googleUserId: data.id };
}

export async function suspendWorkspaceUser(googleUserId: string): Promise<void> {
  assertRealWritesAllowed();
  const accessToken = await getDirectoryApiAccessToken();
  const res = await fetch(`${DIRECTORY_API_BASE}/users/${googleUserId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ suspended: true }),
  });
  if (!res.ok) throw new Error(`Directory API 정지 실패 (status ${res.status})`);
}

export async function reactivateWorkspaceUser(googleUserId: string): Promise<void> {
  assertRealWritesAllowed();
  const accessToken = await getDirectoryApiAccessToken();
  const res = await fetch(`${DIRECTORY_API_BASE}/users/${googleUserId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ suspended: false }),
  });
  if (!res.ok) throw new Error(`Directory API 재활성화 실패 (status ${res.status})`);
}

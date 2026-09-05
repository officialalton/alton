import { getDirectoryApiAccessToken } from "./google-workspace-auth";
import {
  isM4PreviewVerificationFlagEnabled,
  getM4PreviewDirectoryReadonlyAccessToken,
} from "./google-workspace-preview-verify-auth";

// R2 Task 7 — Directory API 읽기 전용 조회. 이 파일에는 GET 요청만
// 존재한다 — 사용자 생성·수정·정지·비밀번호 변경 같은 쓰기 작업은
// lib/google-workspace.ts에만 있고 이 파일에서는 import조차 하지 않는다
// (preflight 경로가 구조적으로 쓰기를 호출할 수 없게 하기 위한 분리 —
// 같은 함수에서 boolean 하나로 read/write를 가르지 않는다).

const DIRECTORY_API_BASE = "https://admin.googleapis.com/admin/directory/v1";

// M4 외부 검증 임시 조치 — 이 파일의 Preview 전면 차단(아래 assertRealReadsAllowed())은
// 그대로 둔다. 플래그가 켜져 있을 때만 이 함수를 우회해 최소권한 Preview 검증 경로로
// 보낸다.
//
// **버그 수정(2026-09-05 실사용 발견)**: 원래는 조회 대상 이메일(organizerEmail,
// 즉 일반 선생님 계정)을 그대로 위임 subject로 써서 signJwt를 시도했는데, 실제로
// admin이 아닌 일반 계정을 subject로 Directory API를 부르면 403이 난다(실측 확인).
// Production 경로(getDirectoryApiAccessToken(), 아래 else 분기)는 subject 없이
// 항상 고정 도메인 관리자로만 서명한다 — Preview 경로도 동일하게 항상 도메인
// 관리자(GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL)를 subject로 쓰고, 실제 조회
// 대상(email)은 REST 경로(/users/{email})에서만 쓴다. 이 불일치 때문에 선생님별
// Workspace Events 구독 생성이 항상 조용히 실패해(workspace_events_subscriptions.
// status='error') 실제 수업의 Smart Notes 자동 연결 웹훅이 한 번도 오지 않았다.
function resolveDirectoryAccessToken(): Promise<string> {
  if (isM4PreviewVerificationFlagEnabled()) {
    const adminSubject = process.env.GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL;
    if (!adminSubject) {
      throw new Error("GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL이 설정되지 않았습니다.");
    }
    return getM4PreviewDirectoryReadonlyAccessToken(adminSubject);
  }
  assertRealReadsAllowed();
  return getDirectoryApiAccessToken();
}

function assertRealReadsAllowed(): void {
  if (process.env.VERCEL_ENV === "preview") {
    throw new Error("Preview 환경에서는 실제 Workspace 조회를 호출할 수 없습니다.");
  }
  const readsAllowed = process.env.WORKSPACE_PREFLIGHT_ALLOW_REAL_READS === "true";
  const writesAllowed = process.env.WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS === "true";
  if (!readsAllowed && !writesAllowed) {
    throw new Error(
      "실제 Workspace 조회가 비활성화되어 있습니다(WORKSPACE_PREFLIGHT_ALLOW_REAL_READS=true 필요)."
    );
  }
}

export type WorkspaceUserSummary = {
  googleUserId: string;
  primaryEmail: string;
  suspended: boolean;
  orgUnitPath: string;
};

function parseUserSummary(data: {
  id: string;
  primaryEmail: string;
  suspended: boolean;
  orgUnitPath: string;
}): WorkspaceUserSummary {
  return {
    googleUserId: data.id,
    primaryEmail: data.primaryEmail,
    suspended: data.suspended,
    orgUnitPath: data.orgUnitPath,
  };
}

export async function getWorkspaceUserByEmail(email: string): Promise<WorkspaceUserSummary | null> {
  const accessToken = await resolveDirectoryAccessToken();
  const res = await fetch(`${DIRECTORY_API_BASE}/users/${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Directory API 사용자 조회 실패 (status ${res.status})`);
  return parseUserSummary(await res.json());
}

export async function getWorkspaceUserByGoogleId(googleUserId: string): Promise<WorkspaceUserSummary | null> {
  assertRealReadsAllowed();
  const accessToken = await getDirectoryApiAccessToken();
  const res = await fetch(`${DIRECTORY_API_BASE}/users/${googleUserId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Directory API 사용자 조회 실패 (status ${res.status})`);
  return parseUserSummary(await res.json());
}

export async function listWorkspaceUsersInOrgUnit(orgUnitPath: string): Promise<WorkspaceUserSummary[]> {
  assertRealReadsAllowed();
  const accessToken = await getDirectoryApiAccessToken();
  const params = new URLSearchParams({
    customer: "my_customer",
    query: `orgUnitPath='${orgUnitPath}'`,
  });
  const res = await fetch(`${DIRECTORY_API_BASE}/users?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Directory API 사용자 목록 조회 실패 (status ${res.status})`);
  const data = (await res.json()) as {
    users?: { id: string; primaryEmail: string; suspended: boolean; orgUnitPath: string }[];
  };
  return (data.users ?? []).map(parseUserSummary);
}

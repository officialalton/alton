import { getDirectoryApiAccessToken } from "./google-workspace-auth";

// R2 Task 7 — Directory API 읽기 전용 조회. 이 파일에는 GET 요청만
// 존재한다 — 사용자 생성·수정·정지·비밀번호 변경 같은 쓰기 작업은
// lib/google-workspace.ts에만 있고 이 파일에서는 import조차 하지 않는다
// (preflight 경로가 구조적으로 쓰기를 호출할 수 없게 하기 위한 분리 —
// 같은 함수에서 boolean 하나로 read/write를 가르지 않는다).

const DIRECTORY_API_BASE = "https://admin.googleapis.com/admin/directory/v1";

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
  assertRealReadsAllowed();
  const accessToken = await getDirectoryApiAccessToken();
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

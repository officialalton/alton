import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getImpersonatedAccessToken, getDirectoryApiAccessToken } from "@/lib/google-workspace-auth";
import {
  getWorkspaceUserByEmail,
  listWorkspaceUsersInOrgUnit,
} from "@/lib/google-workspace-directory-readonly";

// R2 Task 7 — 인증 체인·Directory API 읽기 전용 preflight. 이 라우트는
// 관리자 UI 어디에서도 버튼으로 노출하지 않고, 배포 시 자동 실행되지도
// 않는다 — 관리자 세션 쿠키로 직접 curl 등을 통해 명시적으로 호출하는
// 운영 점검 전용 경로다. 오직 lib/google-workspace-directory-readonly.ts
// (GET만 존재)만 import한다 — 이 라우트에서는 쓰기 함수(lib/google-
// workspace.ts)를 import할 방법 자체가 없다(구조적 분리).
//
// 응답에는 토큰 원문을 절대 포함하지 않는다 — 단계별 성공/실패, 사용한
// Vercel 환경, 대상 GCP 프로젝트/서비스 계정, delegated admin 이메일,
// Directory 읽기 성공 여부, 테스트 OU의 현재 계정 목록(baseline 스냅샷,
// 실제 쓰기 테스트 전후 비교용), 실행 시각, 오류 메시지(응답 본문 제외,
// status만)만 기록한다.

const TEST_OU_PATH = "/Alton Integration Sandbox/Teachers";
const KNOWN_TEST_EMAILS = [
  "teacher1@alton.education",
  "teacher2@alton.education",
  "teacher-provisioning-test@alton.education",
];

type StageResult = { stage: string; ok: boolean; error?: string };

export async function POST() {
  try {
    await requireAdmin();
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 403 });
  }

  const startedAt = new Date().toISOString();
  const stages: StageResult[] = [];

  stages.push({
    stage: "preview_check",
    ok: process.env.VERCEL_ENV !== "preview",
    error: process.env.VERCEL_ENV === "preview" ? "VERCEL_ENV=preview" : undefined,
  });

  let impersonationOk = false;
  try {
    await getImpersonatedAccessToken();
    impersonationOk = true;
    stages.push({ stage: "impersonation", ok: true });
  } catch (e) {
    stages.push({ stage: "impersonation", ok: false, error: errorMessage(e) });
  }

  let directoryTokenOk = false;
  if (impersonationOk) {
    try {
      await getDirectoryApiAccessToken();
      directoryTokenOk = true;
      stages.push({ stage: "signjwt_and_dwd_exchange", ok: true });
    } catch (e) {
      stages.push({ stage: "signjwt_and_dwd_exchange", ok: false, error: errorMessage(e) });
    }
  }

  let testOuBaseline: { primaryEmail: string; googleUserId: string; suspended: boolean }[] | null = null;
  const targetEmailBaseline: Record<string, boolean> = {};

  if (directoryTokenOk) {
    try {
      const users = await listWorkspaceUsersInOrgUnit(TEST_OU_PATH);
      testOuBaseline = users.map((u) => ({
        primaryEmail: u.primaryEmail,
        googleUserId: u.googleUserId,
        suspended: u.suspended,
      }));
      stages.push({ stage: "list_test_ou_users", ok: true });
    } catch (e) {
      stages.push({ stage: "list_test_ou_users", ok: false, error: errorMessage(e) });
    }

    for (const email of KNOWN_TEST_EMAILS) {
      try {
        const user = await getWorkspaceUserByEmail(email);
        targetEmailBaseline[email] = user !== null;
      } catch (e) {
        stages.push({ stage: `lookup_${email}`, ok: false, error: errorMessage(e) });
      }
    }
  }

  return NextResponse.json({
    startedAt,
    finishedAt: new Date().toISOString(),
    vercelEnvironment: process.env.VERCEL_ENV ?? "unknown",
    gcpWorkloadIdentityAudience: process.env.GOOGLE_WORKLOAD_IDENTITY_AUDIENCE ?? null,
    serviceAccountEmail: process.env.GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL ?? null,
    delegatedAdminEmail: process.env.GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL ?? null,
    stages,
    testOuPath: TEST_OU_PATH,
    testOuBaseline,
    targetEmailBaseline,
  });
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "알 수 없는 오류";
}

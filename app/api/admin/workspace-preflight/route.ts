import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getImpersonatedAccessToken, getDirectoryApiAccessToken } from "@/lib/google-workspace-auth";
import {
  getWorkspaceUserByEmail,
  listWorkspaceUsersInOrgUnit,
} from "@/lib/google-workspace-directory-readonly";

// R2 Task 7 — 인증 체인·Directory API 읽기 전용 preflight. 관리자 UI
// 어디에서도 버튼으로 노출하지 않고, 배포 시 자동 실행되지도 않는다 —
// 관리자 세션 쿠키로 직접 curl 등을 통해 명시적으로 호출하는 운영 점검
// 전용 경로다. lib/google-workspace-directory-readonly.ts(GET만)만
// import한다 — 쓰기 함수(lib/google-workspace.ts)는 import할 방법 자체가
// 없다(구조적 분리).
//
// 응답·감사 기록 모두 최소한으로만 남긴다:
//   허용 — 단계별 성공/실패, 오류 코드(status만, 응답 본문 아님), OU
//          존재 여부, 타겟 테스트 이메일 존재 여부(boolean), OU 사용자
//          수, Google user ID의 비가역 SHA-256 해시(내부 비교용),
//          실행자·실행 시각·환경.
//   금지 — OIDC/WIF/access token/JWT 원문, 임시 비밀번호, OU 전체
//          사용자의 이름·개인 이메일·전화번호, 필요 이상의 전체
//          Directory 응답, Google API 오류 응답 본문 그대로 기록.
//
// Production 환경 확인 + 명시적 read flag + 관리자 권한을 전부 만족해야
// 시작되고, begin_workspace_preflight_run()이 실제 Google 호출 전에
// 반복 호출(쿨다운)을 DB 레벨에서 차단한다 — 쿨다운 위반은 어떤 실제
// API 호출도 일어나기 전에 걸린다.

const TEST_OU_PATH = "/Alton Integration Sandbox/Teachers";
const KNOWN_TEST_EMAILS = [
  "teacher1@alton.education",
  "teacher2@alton.education",
  "teacher-provisioning-test@alton.education",
];

type StageResult = { stage: string; ok: boolean; error?: string };

function hashGoogleUserId(googleUserId: string): string {
  return createHash("sha256").update(googleUserId).digest("hex");
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "알 수 없는 오류";
}

export async function POST() {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 403 });
  }
  const { supabase } = admin;

  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.json(
      { error: "이 preflight는 Production 환경에서만 실행할 수 있습니다." },
      { status: 403 }
    );
  }
  if (process.env.WORKSPACE_PREFLIGHT_ALLOW_REAL_READS !== "true") {
    return NextResponse.json(
      { error: "WORKSPACE_PREFLIGHT_ALLOW_REAL_READS=true가 명시적으로 설정되어야 합니다." },
      { status: 403 }
    );
  }

  // begin_workspace_preflight_run()의 쿨다운 위반은 전용 SQLSTATE(ALT01,
  // supabase/migrations/20260907000000_r2_workspace_preflight_permissions_fix.sql)로
  // 표시된다 — 이 코드일 때만 429(반복 호출)로 응답하고, RPC 자체가
  // 없거나(스키마 캐시 문제) DB 오류인 경우는 인프라 오류이므로 500으로
  // 구분한다. 두 경우 모두 이 시점까지는 실제 Google API를 전혀 호출하지
  // 않았다. 원문 오류 메시지(Postgres 오류 텍스트)는 토큰·PII를 담지
  // 않지만 내부 스키마 정보를 노출할 수 있으므로 서버 로그에만 남기고
  // 관리자 응답에는 안전한 고정 문구와 단계 이름만 내려준다.
  let runId: string;
  try {
    const { data, error } = await supabase.rpc("begin_workspace_preflight_run");
    if (error) {
      if (error.code === "ALT01") {
        return NextResponse.json(
          { error: "preflight는 300초에 한 번만 실행할 수 있습니다.", stage: "begin_cooldown" },
          { status: 429 }
        );
      }
      console.error("[workspace-preflight] begin_workspace_preflight_run failed", error.code, error.message);
      return NextResponse.json(
        { error: "preflight 시작에 실패했습니다.", stage: "begin" },
        { status: 500 }
      );
    }
    runId = data as string;
  } catch (e) {
    console.error("[workspace-preflight] begin_workspace_preflight_run threw", e);
    return NextResponse.json(
      { error: "preflight 시작에 실패했습니다.", stage: "begin" },
      { status: 500 }
    );
  }

  const startedAt = new Date().toISOString();
  const stages: StageResult[] = [];

  stages.push({ stage: "preview_check", ok: true });

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

  let ouUserCount: number | null = null;
  let ouUserIdHashes: string[] | null = null;
  const targetEmailBaseline: Record<string, boolean> = {};

  if (directoryTokenOk) {
    try {
      const users = await listWorkspaceUsersInOrgUnit(TEST_OU_PATH);
      ouUserCount = users.length;
      ouUserIdHashes = users.map((u) => hashGoogleUserId(u.googleUserId));
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

  const environment = process.env.VERCEL_ENV ?? "unknown";
  await supabase.rpc("finish_workspace_preflight_run", {
    p_run_id: runId,
    p_environment: environment,
    p_stages: stages,
    p_ou_user_count: ouUserCount,
    p_ou_user_id_hashes: ouUserIdHashes,
    p_target_email_baseline: targetEmailBaseline,
  });

  return NextResponse.json({
    runId,
    runBy: admin.adminUserId,
    startedAt,
    finishedAt: new Date().toISOString(),
    environment,
    stages,
    testOuPath: TEST_OU_PATH,
    ouUserCount,
    ouUserIdHashes,
    targetEmailBaseline,
  });
}

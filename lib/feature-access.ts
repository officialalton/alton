import { redirect } from "next/navigation";
import { requireUser } from "./auth";

/**
 * 2026-10-05 학생 기능 권한(S1) — docs/briefs/2026-10-05-free-member-tutoring-design.md §2.1·§3.1.
 * DB 함수 student_feature_access(uuid)(20262100000000)가 단일 근거이고, 이 파일의 키 목록은 그 함수가
 * 돌려줄 수 있는 키 전체와 1:1이어야 한다(feature-access.test.ts·통합 테스트가 고정). 메뉴 숨김
 * (StudentShell)과 서버 가드(requireStudentFeature)가 같은 결과를 쓴다.
 *
 * S1에서는 헬퍼와 테스트만 만들고 신규 가입/프로비저닝 액션에만 적용한다. 기존 학생 서버 액션 전면 적용은 S2.
 */
export { FEATURE_KEYS, COMMON_FEATURE_KEYS, FREE_FEATURE_KEYS, TUTORING_FEATURE_KEYS, isFeatureKey, normalizeFeatureAccess, hasFeature } from "./feature-access-keys";
export type { FeatureKey } from "./feature-access-keys";
import { normalizeFeatureAccess, hasFeature, type FeatureKey } from "./feature-access-keys";

type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

/** 학생 한 명의 기능 키를 조회한다(self-only; 관리자·컨설턴트는 타인 조회 가능 — DB 함수 규칙). */
export async function loadStudentFeatureAccess(supabase: RpcClient, studentId: string): Promise<FeatureKey[]> {
  const { data, error } = await supabase.rpc("student_feature_access", { p_student_id: studentId });
  if (error) throw new Error(`student_feature_access 조회 실패: ${error.message}`);
  return normalizeFeatureAccess(data);
}

export class FeatureAccessDeniedError extends Error {
  readonly featureKey: FeatureKey;
  constructor(featureKey: FeatureKey) {
    super(`이 기능(${featureKey})은 현재 회원 유형에서 이용할 수 없습니다.`);
    this.name = "FeatureAccessDeniedError";
    this.featureKey = featureKey;
  }
}

/**
 * requireUser() 위에 기능 키 검사를 얹는다. 학생이 아니면(예: 관리자가 같은 액션을 호출) 기존처럼
 * requireUser() 결과만 돌려준다 — 역할별 권한은 각 액션/RLS가 이미 따로 본다. 학생인데 키가 없으면
 * FeatureAccessDeniedError. 페이지에서는 `redirectTo`를 주면 던지는 대신 리다이렉트한다.
 */
export async function requireStudentFeature(key: FeatureKey, opts?: { redirectTo?: string }) {
  const ctx = await requireUser();
  if (ctx.profile?.role !== "student") {
    return { ...ctx, featureAccess: [] as FeatureKey[] };
  }
  const featureAccess = await loadStudentFeatureAccess(ctx.supabase, ctx.user.id);
  if (!hasFeature(featureAccess, key)) {
    if (opts?.redirectTo) redirect(opts.redirectTo);
    throw new FeatureAccessDeniedError(key);
  }
  return { ...ctx, featureAccess };
}

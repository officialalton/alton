// 문제 용도(2026-09-29) — 스크립트·서버가 공유하는 검사. 새 문제는 general | mock_exam 만 가능하고 both 는 기존 문제 전용이다.
export type SelectableUsageScope = "general" | "mock_exam";

export function isSelectableUsageScope(v: unknown): v is SelectableUsageScope {
  return v === "general" || v === "mock_exam";
}

/** 시드·검증 스크립트용: 환경변수 PROBLEM_USAGE_SCOPE 를 반드시 general|mock_exam 으로 지정해야 한다(기본값 없음). */
export function requireScriptUsageScope(env: NodeJS.ProcessEnv = process.env): SelectableUsageScope {
  const v = env.PROBLEM_USAGE_SCOPE;
  if (!isSelectableUsageScope(v)) {
    throw new Error("PROBLEM_USAGE_SCOPE=general|mock_exam 을 지정하세요. 새 문제는 용도를 정해야 합니다.");
  }
  return v;
}

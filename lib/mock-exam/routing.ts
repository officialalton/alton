// Digital SAT 스타일 2단계 적응(Module 1 성과 -> Module 2 higher/lower) — 순수 함수.
// 정책 값(임계값)은 코드가 아니라 DB(mock_exam_routing_policies)에 있다. 이 파일은 DB 함수
// _mock_exam_route_m2 와 같은 판정을 표시·테스트용으로 옮긴 것이며 임계값을 하드코딩하지 않는다.
// 경로(higher/lower)는 학생·보호자에게 절대 노출하지 않는다(직원 화면 전용).

export type RoutingSection = "rw" | "math";
export type RoutingThresholdType = "correct_ratio" | "correct_count";
export type MockExamRoute = "higher" | "lower";

export type RoutingPolicy = {
  section: RoutingSection;
  thresholdType: RoutingThresholdType;
  thresholdValue: number;
  version: number;
  active: boolean;
  note?: string | null;
};

const SCALE = 1_000_000; // numeric 정확 비교를 흉내 내기 위한 정수 스케일(소수 6자리까지)

/** M1 정답 수로 경로를 정한다. 임계값과 같으면 higher(이상). 문항이 0개면 lower. */
export function decideRoute(policy: Pick<RoutingPolicy, "thresholdType" | "thresholdValue">, correct: number, itemCount: number): MockExamRoute {
  if (itemCount <= 0) return "lower";
  const thr = Math.round(policy.thresholdValue * SCALE);
  const higher =
    policy.thresholdType === "correct_ratio" ? correct * SCALE >= thr * itemCount : correct * SCALE >= thr;
  return higher ? "higher" : "lower";
}

/** 응시에 고정된(pinned) 버전이 있으면 그 정책, 없으면 현재 활성 정책. 정책이 없으면 null(호출자가 lower 로 처리). */
export function selectPolicyForAttempt(
  policies: RoutingPolicy[],
  section: RoutingSection,
  pinnedVersion: number | null,
): RoutingPolicy | null {
  const ofSection = policies.filter((p) => p.section === section);
  if (pinnedVersion != null) {
    const pinned = ofSection.find((p) => p.version === pinnedVersion);
    if (pinned) return pinned;
  }
  return ofSection.find((p) => p.active) ?? null;
}

/** 관리자 화면 표시용 한 줄 설명. */
export function describePolicy(policy: RoutingPolicy): string {
  const value =
    policy.thresholdType === "correct_ratio" ? `정답률 ${Math.round(policy.thresholdValue * 1000) / 10}% 이상` : `정답 ${policy.thresholdValue}개 이상`;
  return `Module 1 ${value} → higher, 미만 → lower`;
}

/**
 * 2026-10-05 학생 기능 권한 키(클라이언트 안전 부분) — lib/feature-access.ts 에서 분리.
 * StudentShell 같은 클라이언트 컴포넌트가 next/headers 에 의존하는 서버 모듈(requireUser)을 끌어오지 않게
 * 순수 상수·헬퍼만 여기 둔다(Vercel Turbopack 빌드 실패 2026-10-05). 서버 전용 함수는 feature-access.ts.
 */
export const FEATURE_KEYS = [
  // 공통(C)
  "account",
  "problem_report",
  // 무료(F)
  "home",
  "mock_exam",
  "problem_log",
  "vocab",
  "materials_free",
  "tutoring_info",
  // 과외(T)
  "roadmap",
  "course",
  "class",
  "teacher",
  "homework",
  "lesson_booking",
  "teacher_chat",
  "consultant_portal",
  "credits",
  "college",
  "session",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const COMMON_FEATURE_KEYS: readonly FeatureKey[] = ["account", "problem_report"];
export const FREE_FEATURE_KEYS: readonly FeatureKey[] = ["home", "mock_exam", "problem_log", "vocab", "materials_free", "tutoring_info"];
export const TUTORING_FEATURE_KEYS: readonly FeatureKey[] = [
  "roadmap",
  "course",
  "class",
  "teacher",
  "homework",
  "lesson_booking",
  "teacher_chat",
  "consultant_portal",
  "credits",
  "college",
  "session",
];

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === "string" && (FEATURE_KEYS as readonly string[]).includes(value);
}

/** RPC 결과(text[])를 알려진 키 집합으로 정규화한다. 모르는 키는 버린다(fail-closed). */
export function normalizeFeatureAccess(raw: unknown): FeatureKey[] {
  if (!Array.isArray(raw)) return [];
  const out: FeatureKey[] = [];
  for (const v of raw) {
    if (isFeatureKey(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

export function hasFeature(access: readonly FeatureKey[], key: FeatureKey): boolean {
  return access.includes(key);
}

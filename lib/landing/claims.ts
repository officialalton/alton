// 2026-10-05 랜딩 v2 — 공개 카피 상수(오너 확정 문구). 근거 메모는 docs/briefs/landing-claims.md.
// 2026-10-09 — 헤드라인은 고정 문구(숫자 없음). 숫자는 가용성 비주얼(AvailabilityCard)이 실제 데이터로 보여준다.
export const HERO_HEADLINE = { line1: "Free SAT & AP Practice Tests.", line2: "Turn Every Mistake Into Progress." } as const;

/** 로드맵 문장(계획 진술). 오너 승인 2026-10-09. 가용 수치가 아니므로 과목별 숫자를 붙이지 않는다. */
export const AVAILABILITY_COPY = {
  title: "What's available now",
  satLabel: "SAT",
  satUnit: "free full-length practice tests",
  apLabel: "AP",
  comingSoon: "Coming soon",
  roadmap: "We're building toward 10+ full practice exams per AP subject.",
  regularly: "New tests are added regularly.",
  updated: "Updated automatically",
} as const;

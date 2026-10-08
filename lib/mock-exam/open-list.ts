import type { MockExamAttemptSummary, MockExamCatalogRow } from "./attempt-data";

// 모의고사 '배정' 폐지(2026-10-01) — 공개 세트 목록(카탈로그)과 학생의 응시를 한 줄 목록으로 합친다.
// 카탈로그(RPC 1회) + 응시 요약(RPC 1회)만으로 만들며 세트별 추가 조회는 없다.

export type MockExamListState = "not_started" | "in_progress" | "submitted" | "graded";

export type MockExamListRow = {
  key: string;
  examSetId: string;
  name: string;
  difficultyTier: string;
  description: string | null;
  state: MockExamListState;
  attempt: MockExamAttemptSummary | null;
  /** 세트가 지금은 공개 목록에 없고 응시 기록만 남은 경우(보관된 세트의 지난 응시). */
  archived: boolean;
};

export function listStateOf(status: MockExamAttemptSummary["status"] | null): MockExamListState {
  if (status === "in_progress") return "in_progress";
  if (status === "submitted") return "submitted";
  if (status === "graded") return "graded";
  return "not_started"; // 응시 없음 또는 시작 화면만 연 'assigned'
}

const NAME_COLLATOR = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** 세트 이름의 자연 정렬 — "SAT Practice Test 2" 가 "… 10" 보다 앞. 숫자 구간은 숫자로 비교한다. */
export function compareExamNames(a: string, b: string): number {
  return NAME_COLLATOR.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
}

/** To do(미응시·진행 중) / Completed(제출·채점 완료) 서브탭 분류. */
export type PracticeTestTab = "todo" | "completed";
export const practiceTestTabOf = (state: MockExamListState): PracticeTestTab => (state === "not_started" || state === "in_progress" ? "todo" : "completed");

/** 홈 'Next Practice Test' — 아직 끝내지 않은(미응시·진행 중) 공개 세트 중 번호가 가장 낮은 것. 최신순이 아니다. */
export function pickNextPracticeTest(rows: MockExamListRow[]): MockExamListRow | null {
  return rows.find((r) => !r.archived && practiceTestTabOf(r.state) === "todo") ?? null;
}

export function buildMockExamListRows(catalog: MockExamCatalogRow[], attempts: MockExamAttemptSummary[]): MockExamListRow[] {
  const byId = new Map(attempts.map((a) => [a.id, a]));
  const used = new Set<string>();
  const rows: MockExamListRow[] = catalog.map((c) => {
    const attempt = c.attemptId ? (byId.get(c.attemptId) ?? null) : null;
    if (attempt) used.add(attempt.id);
    return {
      key: c.examSetId,
      examSetId: c.examSetId,
      name: c.name,
      difficultyTier: c.difficultyTier,
      description: c.description,
      state: listStateOf(attempt?.status ?? null),
      attempt,
      archived: false,
    };
  });
  for (const a of attempts) {
    if (used.has(a.id) || a.status === "assigned") continue;
    rows.push({
      key: a.id,
      examSetId: a.examSetId,
      name: a.examSetName,
      difficultyTier: a.difficultyTier,
      description: null,
      state: listStateOf(a.status),
      attempt: a,
      archived: true,
    });
  }
  // 2026-10-08 — 번호순(오름차순) 자연 정렬. 공개 세트가 먼저, 지난(보관) 시험은 뒤에.
  const live = rows.filter((r) => !r.archived).sort((a, b) => compareExamNames(a.name, b.name));
  const archived = rows.filter((r) => r.archived).sort((a, b) => compareExamNames(a.name, b.name));
  return [...live, ...archived];
}

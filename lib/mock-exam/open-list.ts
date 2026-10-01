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
  return rows;
}

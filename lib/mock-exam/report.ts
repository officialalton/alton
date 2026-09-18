import type { MockExamAttemptItem } from "./attempt-data";

// 고정형 SAT 모의고사 V1 — 결과 리포트 집계(순수 함수, DB 접근 없음).
// 사양 7절: "전체 정답률, 섹션별 결과, 세부기술·난이도별 결과, 소요 시간"을 학생·교사·학부모가
// 권한에 맞는 동일 결과로 본다. 여기서는 그 집계만 계산하고, 정답·해설 노출 여부(채점 확정 전
// 숨김)는 이미 lib/mock-exam/attempt-data.ts 의 loadMockExamAttemptDetail 이 처리해 둔다 —
// 이 함수는 넘어온 items 를 그대로 집계할 뿐이다(채점 미확정 상태로 넘기면 correct 가 전부 null이라
// 정답률도 계산되지 않는다 — 호출부가 graded 상태에서만 의미 있게 쓴다).

export type BreakdownRow = { key: string; label: string; total: number; correct: number };

export type MockExamReport = {
  totalCount: number;
  answeredCount: number;
  correctCount: number | null;
  totalTimeSpentSeconds: number;
  bySection: { section: "rw" | "math"; total: number; correct: number | null; timeSpentSeconds: number }[];
  byDomain: BreakdownRow[];
  bySkill: BreakdownRow[];
  missedItems: { setItemId: string; section: "rw" | "math"; position: number; satDomain: string; skillCode: string | null }[];
};

function bump(map: Map<string, BreakdownRow>, key: string, label: string, correct: boolean | null) {
  const row = map.get(key) ?? { key, label, total: 0, correct: 0 };
  row.total += 1;
  if (correct) row.correct += 1;
  map.set(key, row);
}

/** 채점 확정된(items[].correct 가 값을 가진) 응시만 의미 있는 정답률을 낸다 — 확정 전에는
 * correctCount 가 null 로 남는다(호출부는 status==='graded' 일 때만 화면에 정답률을 보인다). */
export function computeMockExamReport(items: MockExamAttemptItem[]): MockExamReport {
  const domainMap = new Map<string, BreakdownRow>();
  const skillMap = new Map<string, BreakdownRow>();
  const sectionAgg: Record<"rw" | "math", { total: number; correct: number; hasGrading: boolean; timeSpentSeconds: number }> = {
    rw: { total: 0, correct: 0, hasGrading: false, timeSpentSeconds: 0 },
    math: { total: 0, correct: 0, hasGrading: false, timeSpentSeconds: 0 },
  };
  let answeredCount = 0;
  let totalTimeSpentSeconds = 0;
  let hasAnyGrading = false;
  let correctCount = 0;
  const missedItems: MockExamReport["missedItems"] = [];

  for (const item of items) {
    if (item.response) answeredCount += 1;
    if (item.timeSpentSeconds) {
      totalTimeSpentSeconds += item.timeSpentSeconds;
      sectionAgg[item.section].timeSpentSeconds += item.timeSpentSeconds;
    }
    sectionAgg[item.section].total += 1;
    if (item.correct !== null) {
      hasAnyGrading = true;
      sectionAgg[item.section].hasGrading = true;
      if (item.correct) {
        correctCount += 1;
        sectionAgg[item.section].correct += 1;
      } else {
        missedItems.push({ setItemId: item.setItemId, section: item.section, position: item.position, satDomain: item.satDomain, skillCode: item.skillCode });
      }
      bump(domainMap, item.satDomain, item.satDomain, item.correct);
      if (item.skillCode) bump(skillMap, item.skillCode, item.skillCode, item.correct);
    }
  }

  return {
    totalCount: items.length,
    answeredCount,
    correctCount: hasAnyGrading ? correctCount : null,
    totalTimeSpentSeconds,
    bySection: (["rw", "math"] as const).map((section) => ({
      section,
      total: sectionAgg[section].total,
      correct: sectionAgg[section].hasGrading ? sectionAgg[section].correct : null,
      timeSpentSeconds: sectionAgg[section].timeSpentSeconds,
    })),
    byDomain: [...domainMap.values()].sort((a, b) => a.key.localeCompare(b.key)),
    bySkill: [...skillMap.values()].sort((a, b) => a.key.localeCompare(b.key)),
    missedItems,
  };
}

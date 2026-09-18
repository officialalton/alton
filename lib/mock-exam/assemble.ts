// 고정형 SAT 모의고사 V1 — 조립 로직 (docs/2026-09-17-fixed-mock-exam-v1-spec.md 5절)
//
// 이 모듈은 순수 함수만 담는다(DB 접근 없음) — 목표 문항 수 계산과 후보 문항 선택은
// 유닛 테스트로 직접 검증한다. DB 조회·삽입은 app/admin/mock-exam-actions.ts 가 담당한다.
//
// V1은 적응형이 아니다: 시험 시작 뒤 난이도를 바꾸지 않고, 조립 시점에 영역·난이도
// 비중에 맞춰 고정된 문항 목록을 만든다(제품 오너 확정 지시, 사양 1절).

export type ExamSection = "rw" | "math";
export type ProblemDifficulty = "easy" | "medium" | "hard";
export type DifficultyTier = "foundation" | "standard" | "advanced";

export type DomainWeight = { satDomain: string; weightPct: number };
export type DifficultyWeight = { difficulty: ProblemDifficulty; weightPct: number };

export type EligibleProblem = {
  problemId: string;
  problemVersionId: string;
  satDomain: string;
  skillCode: string | null;
  difficulty: ProblemDifficulty;
};

export type AssembledItem = EligibleProblem & { section: ExamSection; position: number };

export class AssemblyError extends Error {}

/**
 * 영역별 비중(%) 을 총 문항 수에 맞춰 정수 목표치로 배분한다(최대 나머지법 —
 * 반올림 합이 총 문항 수와 어긋나지 않게 보정).
 */
export function allocateCounts(weights: { key: string; weightPct: number }[], totalCount: int): Record<string, number> {
  if (totalCount < 0) throw new AssemblyError("총 문항 수는 0 이상이어야 합니다.");
  const totalWeight = weights.reduce((sum, w) => sum + w.weightPct, 0);
  if (totalWeight <= 0) throw new AssemblyError("비중 합이 0보다 커야 합니다.");

  const raw = weights.map((w) => ({ key: w.key, exact: (w.weightPct / totalWeight) * totalCount }));
  const floors = raw.map((r) => ({ key: r.key, floor: Math.floor(r.exact), remainder: r.exact - Math.floor(r.exact) }));
  let allocated = floors.reduce((sum, f) => sum + f.floor, 0);
  let remaining = totalCount - allocated;

  // 나머지가 큰 순서로 1개씩 더 배분한다.
  const byRemainder = [...floors].sort((a, b) => b.remainder - a.remainder);
  const result: Record<string, number> = {};
  for (const f of floors) result[f.key] = f.floor;
  for (let i = 0; i < byRemainder.length && remaining > 0; i++, remaining--) {
    result[byRemainder[i].key] += 1;
  }
  return result;
}

type int = number;

/**
 * 영역 비중 x 난이도 비중을 곱해 (영역, 난이도) 셀별 목표 문항 수를 계산한다.
 * 두 비중은 독립이라고 가정한다(영역별로 난이도 분포를 따로 정하지 않음 — V1 범위).
 */
export function buildTargetCells(
  domainWeights: DomainWeight[],
  difficultyWeights: DifficultyWeight[],
  totalCount: int,
): { satDomain: string; difficulty: ProblemDifficulty; targetCount: number }[] {
  const domainCounts = allocateCounts(
    domainWeights.map((d) => ({ key: d.satDomain, weightPct: d.weightPct })),
    totalCount,
  );
  const cells: { satDomain: string; difficulty: ProblemDifficulty; targetCount: number }[] = [];
  for (const domain of domainWeights) {
    const domainTotal = domainCounts[domain.satDomain] ?? 0;
    const diffCounts = allocateCounts(
      difficultyWeights.map((d) => ({ key: d.difficulty, weightPct: d.weightPct })),
      domainTotal,
    );
    for (const diff of difficultyWeights) {
      cells.push({ satDomain: domain.satDomain, difficulty: diff.difficulty, targetCount: diffCounts[diff.difficulty] ?? 0 });
    }
  }
  return cells;
}

export type SelectionResult = {
  items: EligibleProblem[];
  /** 셀별로 목표에 못 미친 부족분(가능한 후보가 없어 못 채운 경우) — 비어 있으면 완전 충족. */
  shortfalls: { satDomain: string; difficulty: ProblemDifficulty; needed: number; found: number }[];
};

/**
 * 후보 문항 풀에서 (영역, 난이도) 목표 수만큼 고른다.
 * - 세트 안 중복 금지(같은 problemId 두 번 선택 안 함).
 * - `excludeProblemIds` 로 다른 세트에서 이미 쓴 문항을 우선 피한다(가능하면 — 부족하면 재사용 허용).
 * - 결정적 결과를 위해 후보는 problemId 로 정렬한 뒤 앞에서부터 뽑는다(무작위 배정 아님 — 재현 가능한 조립).
 */
export function selectForCells(
  candidates: EligibleProblem[],
  targetCells: { satDomain: string; difficulty: ProblemDifficulty; targetCount: number }[],
  excludeProblemIds: Set<string> = new Set(),
): SelectionResult {
  const used = new Set<string>();
  const items: EligibleProblem[] = [];
  const shortfalls: SelectionResult["shortfalls"] = [];

  for (const cell of targetCells) {
    if (cell.targetCount <= 0) continue;
    const pool = candidates
      .filter((c) => c.satDomain === cell.satDomain && c.difficulty === cell.difficulty && !used.has(c.problemId))
      .sort((a, b) => a.problemId.localeCompare(b.problemId));

    // 1순위: 다른 세트에서 안 쓴 문항. 2순위(부족 시): 이미 쓴 문항도 허용.
    const fresh = pool.filter((c) => !excludeProblemIds.has(c.problemId));
    const reused = pool.filter((c) => excludeProblemIds.has(c.problemId));
    const chosen = [...fresh, ...reused].slice(0, cell.targetCount);

    for (const c of chosen) {
      used.add(c.problemId);
      items.push(c);
    }
    if (chosen.length < cell.targetCount) {
      shortfalls.push({ satDomain: cell.satDomain, difficulty: cell.difficulty, needed: cell.targetCount, found: chosen.length });
    }
  }
  return { items, shortfalls };
}

/**
 * 섹션(RW/Math) 안에서 문항 순서를 정한다 — 영역별로 묶지 않고 난이도 오름차순으로만
 * 정렬한다(실전 SAT처럼 쉬운 문항부터). 동일 난이도 안에서는 problemId 순(결정적).
 */
export function orderSectionItems(items: EligibleProblem[], section: ExamSection): AssembledItem[] {
  const difficultyRank: Record<ProblemDifficulty, number> = { easy: 0, medium: 1, hard: 2 };
  const sorted = [...items].sort((a, b) => {
    const rankDiff = difficultyRank[a.difficulty] - difficultyRank[b.difficulty];
    if (rankDiff !== 0) return rankDiff;
    return a.problemId.localeCompare(b.problemId);
  });
  return sorted.map((item, index) => ({ ...item, section, position: index + 1 }));
}

export type AssembleSectionInput = {
  section: ExamSection;
  totalCount: int;
  domainWeights: DomainWeight[];
  difficultyWeights: DifficultyWeight[];
  candidates: EligibleProblem[];
  excludeProblemIds?: Set<string>;
};

export type AssembleSectionResult = {
  items: AssembledItem[];
  shortfalls: SelectionResult["shortfalls"];
};

/** 한 섹션(RW 또는 Math)을 통째로 조립한다 — 목표 셀 계산 → 후보 선택 → 순서 부여. */
export function assembleSection(input: AssembleSectionInput): AssembleSectionResult {
  const cells = buildTargetCells(input.domainWeights, input.difficultyWeights, input.totalCount);
  const { items, shortfalls } = selectForCells(input.candidates, cells, input.excludeProblemIds);
  return { items: orderSectionItems(items, input.section), shortfalls };
}

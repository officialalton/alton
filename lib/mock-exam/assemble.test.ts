import { describe, it, expect } from "vitest";
import {
  allocateCounts,
  buildTargetCells,
  selectForCells,
  orderSectionItems,
  assembleSection,
  AssemblyError,
  type EligibleProblem,
} from "./assemble";

describe("allocateCounts", () => {
  it("배분 합은 항상 총 문항 수와 같다(반올림 오차 보정)", () => {
    const weights = [
      { key: "a", weightPct: 26 },
      { key: "b", weightPct: 28 },
      { key: "c", weightPct: 20 },
      { key: "d", weightPct: 26 },
    ];
    const result = allocateCounts(weights, 27);
    const sum = Object.values(result).reduce((s, n) => s + n, 0);
    expect(sum).toBe(27);
  });

  it("비중이 큰 항목이 더 많이(또는 같게) 배분된다", () => {
    const result = allocateCounts(
      [
        { key: "big", weightPct: 70 },
        { key: "small", weightPct: 30 },
      ],
      10,
    );
    expect(result.big).toBeGreaterThan(result.small);
    expect(result.big + result.small).toBe(10);
  });

  it("총 문항 수 0이면 전부 0", () => {
    const result = allocateCounts([{ key: "a", weightPct: 100 }], 0);
    expect(result.a).toBe(0);
  });

  it("비중 합이 0이면 에러", () => {
    expect(() => allocateCounts([{ key: "a", weightPct: 0 }], 10)).toThrow(AssemblyError);
  });
});

describe("buildTargetCells", () => {
  it("영역x난이도 셀 목표 합이 총 문항 수와 같다", () => {
    const domainWeights = [
      { satDomain: "algebra", weightPct: 35 },
      { satDomain: "advanced_math", weightPct: 35 },
      { satDomain: "problem_solving_data", weightPct: 15 },
      { satDomain: "geometry_trig", weightPct: 15 },
    ];
    const difficultyWeights: { difficulty: "easy" | "medium" | "hard"; weightPct: number }[] = [
      { difficulty: "easy", weightPct: 25 },
      { difficulty: "medium", weightPct: 50 },
      { difficulty: "hard", weightPct: 25 },
    ];
    const cells = buildTargetCells(domainWeights, difficultyWeights, 44);
    const total = cells.reduce((s, c) => s + c.targetCount, 0);
    expect(total).toBe(44);
    expect(cells.length).toBe(domainWeights.length * difficultyWeights.length);
  });
});

function problem(id: string, satDomain: string, difficulty: "easy" | "medium" | "hard"): EligibleProblem {
  return { problemId: id, problemVersionId: `${id}-v1`, satDomain, skillCode: null, difficulty };
}

describe("selectForCells", () => {
  it("목표 수만큼 정확히 뽑고 세트 안 중복이 없다", () => {
    const candidates = [
      problem("p1", "algebra", "easy"),
      problem("p2", "algebra", "easy"),
      problem("p3", "algebra", "easy"),
      problem("p4", "algebra", "medium"),
    ];
    const cells = [
      { satDomain: "algebra", difficulty: "easy" as const, targetCount: 2 },
      { satDomain: "algebra", difficulty: "medium" as const, targetCount: 1 },
    ];
    const { items, shortfalls } = selectForCells(candidates, cells);
    expect(items).toHaveLength(3);
    expect(new Set(items.map((i) => i.problemId)).size).toBe(3);
    expect(shortfalls).toHaveLength(0);
  });

  it("후보가 부족하면 shortfall을 보고한다", () => {
    const candidates = [problem("p1", "algebra", "easy")];
    const cells = [{ satDomain: "algebra", difficulty: "easy" as const, targetCount: 3 }];
    const { items, shortfalls } = selectForCells(candidates, cells);
    expect(items).toHaveLength(1);
    expect(shortfalls).toEqual([{ satDomain: "algebra", difficulty: "easy", needed: 3, found: 1 }]);
  });

  it("excludeProblemIds에 있는 문항은 대체 후보가 있으면 피한다", () => {
    const candidates = [problem("p1", "algebra", "easy"), problem("p2", "algebra", "easy")];
    const cells = [{ satDomain: "algebra", difficulty: "easy" as const, targetCount: 1 }];
    const { items } = selectForCells(candidates, cells, new Set(["p1"]));
    expect(items[0].problemId).toBe("p2");
  });

  it("대체 후보가 없으면 excludeProblemIds에 있어도 재사용한다(부족보다 재사용 우선)", () => {
    const candidates = [problem("p1", "algebra", "easy")];
    const cells = [{ satDomain: "algebra", difficulty: "easy" as const, targetCount: 1 }];
    const { items, shortfalls } = selectForCells(candidates, cells, new Set(["p1"]));
    expect(items[0].problemId).toBe("p1");
    expect(shortfalls).toHaveLength(0);
  });

  it("같은 입력이면 항상 같은 결과(결정적 조립)", () => {
    const candidates = [problem("p3", "algebra", "easy"), problem("p1", "algebra", "easy"), problem("p2", "algebra", "easy")];
    const cells = [{ satDomain: "algebra", difficulty: "easy" as const, targetCount: 2 }];
    const run1 = selectForCells(candidates, cells).items.map((i) => i.problemId);
    const run2 = selectForCells(candidates, cells).items.map((i) => i.problemId);
    expect(run1).toEqual(run2);
    expect(run1).toEqual(["p1", "p2"]);
  });
});

describe("orderSectionItems", () => {
  it("난이도 오름차순(easy→medium→hard)으로 정렬하고 position을 1부터 매긴다", () => {
    const items = [problem("p3", "algebra", "hard"), problem("p1", "algebra", "easy"), problem("p2", "algebra", "medium")];
    const ordered = orderSectionItems(items, "math");
    expect(ordered.map((i) => i.difficulty)).toEqual(["easy", "medium", "hard"]);
    expect(ordered.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(ordered.every((i) => i.section === "math")).toBe(true);
  });
});

describe("assembleSection (통합 — 셀 계산+선택+정렬)", () => {
  it("Math 섹션을 영역·난이도 비중대로 조립한다", () => {
    const domainWeights = [
      { satDomain: "algebra", weightPct: 50 },
      { satDomain: "geometry_trig", weightPct: 50 },
    ];
    const difficultyWeights: { difficulty: "easy" | "medium" | "hard"; weightPct: number }[] = [
      { difficulty: "easy", weightPct: 50 },
      { difficulty: "hard", weightPct: 50 },
    ];
    const candidates = [
      problem("m1", "algebra", "easy"),
      problem("m2", "algebra", "hard"),
      problem("m3", "geometry_trig", "easy"),
      problem("m4", "geometry_trig", "hard"),
      problem("m5", "algebra", "easy"), // 여분
    ];
    const result = assembleSection({ section: "math", totalCount: 4, domainWeights, difficultyWeights, candidates });
    expect(result.items).toHaveLength(4);
    expect(result.shortfalls).toHaveLength(0);
    expect(new Set(result.items.map((i) => i.problemId)).size).toBe(4);
    // 난이도 오름차순 확인
    expect(result.items.map((i) => i.difficulty)).toEqual(["easy", "easy", "hard", "hard"]);
  });

  it("문항 수가 0이면 빈 결과", () => {
    const result = assembleSection({
      section: "rw",
      totalCount: 0,
      domainWeights: [{ satDomain: "rw_information_ideas", weightPct: 100 }],
      difficultyWeights: [{ difficulty: "medium", weightPct: 100 }],
      candidates: [],
    });
    expect(result.items).toEqual([]);
    expect(result.shortfalls).toEqual([]);
  });
});

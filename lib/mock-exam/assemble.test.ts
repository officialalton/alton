import { describe, it, expect } from "vitest";
import {
  allocateCounts,
  buildTargetCells,
  selectForCells,
  orderSectionItems,
  assembleSection,
  moduleEligibility,
  mstModulePlans,
  difficultyAllowedForModule,
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

describe("Phase 2 조립 강화", () => {
  const mk = (id: string, skill: string, extra: Partial<EligibleProblem> = {}): EligibleProblem => ({
    problemId: id,
    problemVersionId: `v-${id}`,
    satDomain: "algebra",
    skillCode: skill,
    difficulty: "medium",
    ...extra,
  });
  const cell = [{ satDomain: "algebra", difficulty: "medium" as const, targetCount: 4 }];

  it("skill 균형: 한 skill이 많아도 skill별로 고르게 뽑는다(2+2)", () => {
    const pool = [mk("a1", "S1"), mk("a2", "S1"), mk("a3", "S1"), mk("a4", "S1"), mk("b1", "S2"), mk("b2", "S2")];
    const { items } = selectForCells(pool, cell);
    expect(items.filter((i) => i.skillCode === "S1")).toHaveLength(2);
    expect(items.filter((i) => i.skillCode === "S2")).toHaveLength(2);
  });

  it("skill 균형은 셀·호출을 넘어 컨텍스트(모듈)에서 누적된다", () => {
    const ctx = { skillUse: new Map<string, number>() };
    selectForCells([mk("a1", "S1"), mk("b1", "S2")], [{ ...cell[0], targetCount: 1 }], new Set(), ctx);
    const second = selectForCells([mk("a2", "S1"), mk("b2", "S2")], [{ ...cell[0], targetCount: 1 }], new Set(), ctx);
    expect(second.items[0].skillCode).toBe("S2");
  });

  it("유사문항 그룹은 세트(컨텍스트)에서 한 번만, 대체 후보가 없으면 부족분으로 보고", () => {
    const usedGroups = new Set<string>();
    const pool = [mk("a1", "S1", { similarityGroup: "G" }), mk("a2", "S2", { similarityGroup: "G" }), mk("a3", "S3")];
    const { items, shortfalls } = selectForCells(pool, cell, new Set(), { usedGroups });
    expect(items.map((i) => i.problemId).sort()).toEqual(["a1", "a3"]);
    expect(shortfalls).toEqual([{ satDomain: "algebra", difficulty: "medium", needed: 4, found: 2 }]);
  });

  it("노출 이력이 적은 문항을 우선하되 다른 세트 사용 문항은 마지막", () => {
    const pool = [mk("a1", "S1", { exposureCount: 5 }), mk("a2", "S1", { exposureCount: 0 }), mk("a3", "S1", { exposureCount: 1 })];
    const two = [{ ...cell[0], targetCount: 2 }];
    expect(selectForCells(pool, two).items.map((i) => i.problemId)).toEqual(["a2", "a3"]);
    expect(selectForCells(pool, two, new Set(["a2"])).items.map((i) => i.problemId)).toEqual(["a3", "a1"]);
  });

  it("배정 가능 플래그 규칙: easy·medium→M1/lower, medium·hard→higher", () => {
    expect(moduleEligibility("easy")).toEqual({ m1: true, m2Lower: true, m2Higher: false });
    expect(moduleEligibility("medium")).toEqual({ m1: true, m2Lower: true, m2Higher: true });
    expect(moduleEligibility("hard")).toEqual({ m1: false, m2Lower: false, m2Higher: true });
  });
});

describe("MST 모듈 계획(Phase 3 라우팅)", () => {
  it("라우팅이면 M2가 lower·higher 두 변형(같은 정원)으로 나뉘고 M1은 route 없음", () => {
    const plans = mstModulePlans(true);
    expect(plans.map((p) => `${p.key}:${p.route}`)).toEqual([
      "rw_m1:null",
      "rw_m2:lower",
      "rw_m2:higher",
      "math_m1:null",
      "math_m2:lower",
      "math_m2:higher",
    ]);
    expect(plans.filter((p) => p.key === "rw_m2").map((p) => p.count)).toEqual([27, 27]);
    expect(plans.filter((p) => p.key === "math_m2").map((p) => p.count)).toEqual([22, 22]);
  });
  it("라우팅이 아니면 Phase 1/2와 같은 4모듈(route 전부 null)", () => {
    const plans = mstModulePlans(false);
    expect(plans.map((p) => p.key)).toEqual(["rw_m1", "rw_m2", "math_m1", "math_m2"]);
    expect(plans.every((p) => p.route === null)).toBe(true);
  });
  it("난이도 허용 범위: M1·lower = easy·medium, higher = medium·hard, 레거시 M2 = 제한 없음", () => {
    const plans = mstModulePlans(true);
    const m1 = plans[0];
    const lower = plans[1];
    const higher = plans[2];
    expect((["easy", "medium", "hard"] as const).map((d) => difficultyAllowedForModule(m1, d))).toEqual([true, true, false]);
    expect((["easy", "medium", "hard"] as const).map((d) => difficultyAllowedForModule(lower, d))).toEqual([true, true, false]);
    expect((["easy", "medium", "hard"] as const).map((d) => difficultyAllowedForModule(higher, d))).toEqual([false, true, true]);
    const legacyM2 = mstModulePlans(false)[1];
    expect((["easy", "medium", "hard"] as const).map((d) => difficultyAllowedForModule(legacyM2, d))).toEqual([true, true, true]);
  });
  it("두 변형을 순서대로 조립하면 문항이 겹치지 않는다(앞 모듈이 뽑은 문항은 뒤 후보에서 제외)", () => {
    const candidates: EligibleProblem[] = [];
    for (const d of ["easy", "medium", "hard"] as const) {
      for (let i = 0; i < 12; i++) candidates.push({ problemId: `${d}-${i}`, problemVersionId: `v-${d}-${i}`, satDomain: "rw_craft_structure", skillCode: null, difficulty: d });
    }
    const used = new Set<string>();
    const byModule: Record<string, string[]> = {};
    for (const plan of mstModulePlans(true).filter((p) => p.section === "rw")) {
      const weights = [
        { difficulty: "easy" as const, weightPct: 25 },
        { difficulty: "medium" as const, weightPct: 50 },
        { difficulty: "hard" as const, weightPct: 25 },
      ].filter((w) => difficultyAllowedForModule(plan, w.difficulty));
      const r = assembleSection({
        section: "rw",
        totalCount: 8,
        domainWeights: [{ satDomain: "rw_craft_structure", weightPct: 100 }],
        difficultyWeights: weights,
        candidates: candidates.filter((c) => !used.has(c.problemId) && difficultyAllowedForModule(plan, c.difficulty)),
      });
      r.items.forEach((i) => used.add(i.problemId));
      byModule[`${plan.key}:${plan.route}`] = r.items.map((i) => i.problemId);
    }
    const all = Object.values(byModule).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(byModule["rw_m2:lower"].every((id) => !id.startsWith("hard"))).toBe(true);
    expect(byModule["rw_m2:higher"].every((id) => !id.startsWith("easy"))).toBe(true);
    expect(byModule["rw_m1:null"].every((id) => !id.startsWith("hard"))).toBe(true);
  });
});

describe("2026-10-01 사전 수정: hard 세트 간 하드 제외·hard 형식 분할 해제", () => {
  const mk = (id: string, difficulty: "easy" | "medium" | "hard", extra: Partial<EligibleProblem> = {}): EligibleProblem => ({
    problemId: id, problemVersionId: `v-${id}`, satDomain: "algebra", skillCode: "S1", difficulty, ...extra,
  });
  const hardCell = [{ satDomain: "algebra", difficulty: "hard" as const, targetCount: 2 }];

  it("다른 세트에서 쓴 hard 문항은 대체 후보가 있으면 쓰지 않는다(2세트 연속 조립 시 hard 교집합 0)", () => {
    const pool = ["h1", "h2", "h3", "h4"].map((id) => mk(id, "hard"));
    const used = new Set<string>();
    const first = selectForCells(pool, hardCell, new Set(), { hardExcludeIds: used }).items.map((i) => i.problemId);
    first.forEach((id) => used.add(id));
    const second = selectForCells(pool, hardCell, new Set(), { hardExcludeIds: used }).items.map((i) => i.problemId);
    expect(first.filter((id) => second.includes(id))).toEqual([]);
  });
  it("hard 후보가 모자랄 때만 재사용을 허용하고 hardReused 에 기록한다", () => {
    const pool = ["h1", "h2", "h3"].map((id) => mk(id, "hard"));
    const hardReused = new Set<string>();
    const r = selectForCells(pool, hardCell, new Set(), { hardExcludeIds: new Set(["h1", "h2"]), hardReused });
    expect(r.items).toHaveLength(2);
    expect(r.shortfalls).toEqual([]);
    expect(r.items.map((i) => i.problemId)).toContain("h3");
    expect(hardReused.size).toBe(1);
  });
  it("hardExcludeIds 는 hard 에만 적용 — medium 은 기존 규칙(재사용 회피는 소프트)", () => {
    const pool = ["m1", "m2"].map((id) => mk(id, "medium"));
    const r = selectForCells(pool, [{ satDomain: "algebra", difficulty: "medium", targetCount: 2 }], new Set(), { hardExcludeIds: new Set(["m1", "m2"]) });
    expect(r.items).toHaveLength(2);
  });
  it("hardIgnoreFormat: hard 셀은 mc/spr 로 나누지 않아 hard SPR 공급이 없어도 칸이 채워진다", () => {
    const dw = [{ satDomain: "algebra", weightPct: 100 }];
    const diffw = [{ difficulty: "medium" as const, weightPct: 50 }, { difficulty: "hard" as const, weightPct: 50 }];
    const fw = [{ format: "mc" as const, weightPct: 75 }, { format: "spr" as const, weightPct: 25 }];
    const split = buildTargetCells(dw, diffw, 8, fw);
    expect(split.filter((c) => c.difficulty === "hard").every((c) => c.format)).toBe(true);
    const free = buildTargetCells(dw, diffw, 8, fw, true);
    expect(free.filter((c) => c.difficulty === "hard")).toEqual([{ satDomain: "algebra", difficulty: "hard", targetCount: 4 }]);
    expect(free.filter((c) => c.difficulty === "medium").every((c) => c.format)).toBe(true);
    // hard 는 MC 만 있는 풀에서도 조립 가능
    const pool: EligibleProblem[] = [
      ...["h1", "h2", "h3", "h4"].map((id) => mk(id, "hard", { format: "mc" })),
      ...["m1", "m2", "m3"].map((id) => mk(id, "medium", { format: "mc" })),
      mk("m4", "medium", { format: "spr" }),
    ];
    const withSplit = assembleSection({ section: "math", totalCount: 8, domainWeights: dw, difficultyWeights: diffw, candidates: pool, formatWeights: fw });
    const without = assembleSection({ section: "math", totalCount: 8, domainWeights: dw, difficultyWeights: diffw, candidates: pool, formatWeights: fw, hardIgnoreFormat: true });
    expect(withSplit.shortfalls.some((s) => s.difficulty === "hard")).toBe(true);
    expect(without.shortfalls).toEqual([]);
    expect(without.items.filter((i) => i.difficulty === "hard")).toHaveLength(4);
  });
});

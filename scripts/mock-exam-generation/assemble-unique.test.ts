import { describe, expect, it } from "vitest";
import { assertUnique, demandVsSupply, buildSlots, planUnique, type Weights } from "./assemble-unique";
import type { EligibleProblem } from "../../lib/mock-exam/assemble";

describe("assertUnique", () => {
  const it1 = (id: string) => ({ problemId: id });
  it("통과: 세트 간·세트 내 중복 없음", () => { expect(() => assertUnique([[it1("a"), it1("b")], [it1("c")]], new Set(["k"]))).not.toThrow(); });
  it("세트 간 중복이면 throw", () => { expect(() => assertUnique([[it1("a")], [it1("a")]], new Set())).toThrow(/appears in new sets 1 and 2/); });
  it("세트 내 반복이면 throw", () => { expect(() => assertUnique([[it1("a"), it1("a")]], new Set())).toThrow(/repeated within/); });
  it("유지 세트 문항을 쓰면 throw", () => { expect(() => assertUnique([[it1("k")]], new Set(["k"]))).toThrow(/kept set/); });
});

// 작은 풀: 1개 영역·세 난이도, 모듈당 문항을 1~2개로 만드는 가중치는 쓸 수 없으니(모듈 정원 고정) 정원을 충족하는 큰 풀 대신 부족 보고만 검증한다.
describe("demandVsSupply / planUnique", () => {
  const W: Weights = { dom: [{ section: "rw", sat_domain: "d1", weight_pct: 100 }, { section: "math", sat_domain: "m1", weight_pct: 100 }],
    diff: ["easy", "medium", "hard"].flatMap((d, i) => ["rw", "math"].map((s) => ({ section: s, problem_difficulty: d, weight_pct: [25, 50, 25][i] }))) };
  const mk = (n: number, domain: string, difficulty: string, format = "mc", skills = 3): EligibleProblem[] =>
    Array.from({ length: n }, (_, i) => ({ problemId: `${domain}-${difficulty}-${format}-${i}`, problemVersionId: `v-${domain}-${difficulty}-${format}-${i}`, satDomain: domain, skillCode: `${domain}_s${i % skills}`, difficulty: difficulty as never, format: format as never, similarityGroup: null, exposureCount: 0 }));
  it("재고 부족이면 셀별 부족분을 정확히 보고한다", () => {
    const pool = [...mk(10, "d1", "easy"), ...mk(10, "d1", "medium"), ...mk(10, "d1", "hard")];
    const sh = demandVsSupply(pool, buildSlots(W, 1, true)).find((x) => x.domain === "d1" && x.difficulty === "medium")!;
    expect(sh.extraNeeded).toBe(sh.demand - 10);
  });
  it("재고가 충분하면 N개 세트를 만들고 중복이 0이다", () => {
    const pool = [...mk(200, "d1", "easy"), ...mk(200, "d1", "medium"), ...mk(200, "d1", "hard"), ...mk(200, "m1", "easy"), ...mk(200, "m1", "medium"), ...mk(200, "m1", "hard")];
    expect(demandVsSupply(pool, buildSlots(W, 2, true))).toEqual([]);
    const r = planUnique(pool, W, 2, new Map(), true);
    expect(r.sets.map((s) => s.length)).toEqual([147, 147]);
    expect(() => assertUnique(r.sets, new Set())).not.toThrow();
    expect(new Set(r.sets.flat().map((i) => i.problemId)).size).toBe(294);
  });
});

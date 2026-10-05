// 담당 A(nonlinear_equations_systems·nonlinear_functions·equivalent_expressions easy/medium) 원형 검증.
import { describe, expect, it } from "vitest";
import { ARCHETYPES, ARCHETYPES_EM } from "./registry";
import { generateOne, sweepArchetype } from "./sweep";
import { verifyInstance } from "./verify";
import { checkSemantics } from "./skills/a-kit";
import { produceFromArchetypes } from "./bulk";

const MY = ["nonlinear_equations_systems", "nonlinear_functions", "equivalent_expressions"];
// 자료(표·그림) 원형(figureItem)은 조합 게이트(figure-coverage.test.ts)가 개수·연산자를 검사한다 — 옛 원형 개수(60)·매트릭스 일치 검사에서는 뺀다. 의미(명사-식) 검사는 자료 원형에도 그대로 적용한다.
const allA = ARCHETYPES.filter((a) => MY.slice(0, 2).includes(a.skill));
const hardA = allA.filter((a) => !a.figureItem);
const figA = allA.filter((a) => a.figureItem);
const emA = ARCHETYPES_EM.filter((a) => MY.includes(a.skill));
// docs/qa/2026-09-30-math-hard-archetypes.md 5절 적용 매트릭스(세부 패턴 → 연산자 4개)
const MATRIX: Record<string, string[]> = {
  "nonlinear_equations_systems.root": ["param_condition", "constraint_select", "chain2", "inverse"],
  "nonlinear_equations_systems.sum_of_roots": ["inverse", "param_condition", "compose_kind", "chain2"],
  "nonlinear_equations_systems.product_of_roots": ["inverse", "param_condition", "compose_kind", "chain2"],
  "nonlinear_equations_systems.num_real_solutions": ["param_condition", "constraint_select", "compose_kind", "compare_scenarios"],
  "nonlinear_equations_systems.irrational_sum_of_roots": ["inverse", "compose_kind", "chain2", "repr_shift"],
  "nonlinear_equations_systems.irrational_product_of_roots": ["inverse", "compose_kind", "chain2", "repr_shift"],
  "nonlinear_equations_systems.irrational_root_radical_form": ["inverse", "chain2", "constraint_select", "compose_kind"],
  "nonlinear_equations_systems.linear_quadratic_intersection": ["param_condition", "compose_kind", "repr_shift", "constraint_select"],
  "nonlinear_equations_systems.parameter_discriminant": ["param_condition", "inverse", "constraint_select", "chain2"],
  "nonlinear_functions.evaluate": ["chain2", "compose_kind", "repr_shift", "compare_scenarios"],
  "nonlinear_functions.vertex_x": ["inverse", "compose_kind", "repr_shift", "chain2"],
  "nonlinear_functions.vertex_y": ["inverse", "compose_kind", "repr_shift", "compare_scenarios"],
  "nonlinear_functions.find_x_for_value": ["inverse", "constraint_select", "chain2", "compose_kind"],
  "nonlinear_functions.interpret_a": ["unit_ratio", "repr_shift", "compare_scenarios", "chain2"],
  "nonlinear_functions.interpret_b": ["unit_ratio", "repr_shift", "compare_scenarios", "inverse"],
};

describe("담당 A hard 원형 — 세부 패턴마다 4개, 연산자 매트릭스 일치", () => {
  it("세부 패턴 15개 × 4 = 60개이고 매트릭스의 연산자와 정확히 일치한다", () => {
    expect(hardA).toHaveLength(60);
    const by = new Map<string, string[]>();
    for (const a of hardA) by.set(`${a.skill}.${a.kind}`, [...(by.get(`${a.skill}.${a.kind}`) ?? []), a.operator]);
    expect([...by.keys()].sort()).toEqual(Object.keys(MATRIX).sort());
    for (const [k, ops] of by) expect(new Set(ops), k).toEqual(new Set(MATRIX[k]));
  });
  it("hard 원형은 풀이 단계 5 이상 trace 를 낸다(길이·숫자만 키운 hard 금지는 verify 가 강제)", () => {
    for (const a of hardA) { for (let s = 0; s < 30; s++) { const g = generateOne(a, s); if (g.ok) { expect(g.inst.trace.length, a.id).toBeGreaterThanOrEqual(5); break; } } }
  });
});

describe("담당 A easy/medium 원형 — 그룹(문장 틀) 수와 난이도", () => {
  it("모든 원형은 easy|medium 이고 operator=frame, id 중복이 없다", () => {
    const ids = new Set<string>();
    for (const a of emA) { expect(["easy", "medium"]).toContain(a.difficulty); expect(a.operator).toBe("frame"); expect(ids.has(a.id), a.id).toBe(false); ids.add(a.id); expect(a.structure.length).toBeGreaterThan(10); }
  });
  it("skill 마다 그룹 12개 이상(easy 4 이상·medium 8 이상): 세트당 같은 그룹 1문항 규칙에서 세트당 필요 문항(≈7)을 채울 수 있다", () => {
    for (const skill of MY) {
      const mine = emA.filter((a) => a.skill === skill);
      expect(mine.filter((a) => a.difficulty === "easy").length, `${skill} easy`).toBeGreaterThanOrEqual(4);
      expect(mine.filter((a) => a.difficulty === "medium").length, `${skill} medium`).toBeGreaterThanOrEqual(8);
      expect(mine.length, skill).toBeGreaterThanOrEqual(12);
    }
  });
  it("원형마다 variant 이름이 일정하다(원형 = 유사문항 그룹)", () => {
    for (const a of emA) { const names = new Set<string>(); for (let s = 0; s < 60; s++) { const g = generateOne(a, s); if (g.ok) names.add(g.inst.variant); } expect(names.size, a.id).toBeLessThanOrEqual(2); }
  });
});

describe("담당 A easy/medium 원형 시드 스윕", () => {
  for (const a of emA) {
    it(`${a.id}: 400 시드에서 검증 실패 0·예외 0·독립 변형 30개 이상·명사-수식 위반 0`, () => {
      const st = sweepArchetype(a, 400);
      expect(st.thrown, st.thrownSamples.join("|")).toBe(0);
      expect(st.verifyFail, JSON.stringify(st.failSeeds[0])).toBe(0);
      expect(st.produced).toBeGreaterThan(300);
      expect(st.independent, "본문 유사도 0.6 미만 독립 변형 수").toBeGreaterThanOrEqual(30);
      for (let s = 0; s < 100; s++) { const g = generateOne(a, s); if (g.ok) expect(checkSemantics(g.inst), `${a.id} seed ${s}`).toEqual([]); }
    }, 60_000);
    it(`${a.id}: 같은 시드는 같은 문항을 낸다(재현성)`, () => {
      let n = 0; for (let s = 0; s < 40 && n < 3; s++) { const x = generateOne(a, s), y = generateOne(a, s); expect(JSON.stringify(x)).toBe(JSON.stringify(y)); if (x.ok) n++; }
      expect(n).toBeGreaterThan(0);
    });
  }
});

describe("담당 A hard 원형 — 명사-수식 매핑 기계 검사(둘레/넓이 혼동 방지)", () => {
  it("넓이·둘레·매출 말이 있는 원형은 대응 식이 선언돼 있고 값 규칙과 맞다", () => {
    for (const a of [...hardA, ...figA, ...emA]) for (let s = 0; s < 80; s++) { const g = generateOne(a, s); if (g.ok) expect(checkSemantics(g.inst), `${a.id} seed ${s}`).toEqual([]); }
  });
  it("문장에 '넓이/둘레/매출'이 있는 원형이 실제로 존재한다(검사가 공전하지 않음)", () => {
    const ids = new Set<string>();
    for (const a of [...hardA, ...emA]) for (let s = 0; s < 40; s++) { const g = generateOne(a, s); if (g.ok && g.inst.semantics?.length) ids.add(a.id); }
    expect(ids.size).toBeGreaterThanOrEqual(7);
  });
  const rect = hardA.find((a) => a.id === "nes.linear_quadratic_intersection.repr_shift")!;
  const good = (() => { for (let s = 0; s < 50; s++) { const g = generateOne(rect, s); if (g.ok) return g.inst; } throw new Error("no"); })();
  it("돌연변이: 둘레 식을 넓이로 선언하면 잡는다", () => {
    const bad = { ...good, semantics: good.semantics!.map((d) => (d.noun === "perimeter" ? { ...d, noun: "area" } : d)) };
    expect(checkSemantics(bad).length).toBeGreaterThan(0);
  });
  it("돌연변이: 식이 규칙 값과 다르면 잡는다", () => {
    const bad = { ...good, semantics: good.semantics!.map((d) => (d.noun === "area" ? { ...d, expr: `2((${d.parts[0]}) + (${d.parts[1]}))` } : d)) };
    expect(checkSemantics(bad).length).toBeGreaterThan(0);
  });
  it("돌연변이: 문장에 '넓이'가 있는데 선언이 없으면 잡는다", () => {
    expect(checkSemantics({ ...good, semantics: [] }).length).toBeGreaterThan(0);
  });
  it("돌연변이: 문장에 없는 명사(매출)를 선언하면 잡는다", () => {
    expect(checkSemantics({ ...good, semantics: [...good.semantics!, { noun: "revenue", expr: "p(3 - p)", parts: ["p", "3 - p"], vars: { p: 2 } }] }).length).toBeGreaterThan(0);
  });
});

describe("담당 A 돌연변이 — verify 가 틀린 문항을 잡는다", () => {
  const a = hardA.find((x) => x.id === "nes.sum_of_roots.compose_kind")!;
  const good = (() => { for (let s = 0; s < 50; s++) { const g = generateOne(a, s); if (g.ok) return g.inst; } throw new Error("no"); })();
  it("원본은 통과", () => expect(verifyInstance(a, good).ok).toBe(true));
  it("정답 키를 바꾸면 실패", () => expect(verifyInstance(a, { ...good, correctIndex: (good.correctIndex + 1) % 4 }).ok).toBe(false));
  it("선지가 겹치면 실패", () => { const o = [...good.options]; o[(good.correctIndex + 1) % 4] = o[good.correctIndex]; expect(verifyInstance(a, { ...good, options: o }).ok).toBe(false); });
  it("verification_js 의 상수를 바꾸면 재계산이 어긋나 실패", () => expect(verifyInstance(a, { ...good, verificationJs: good.verificationJs.replace(/"b":(-?\d+)/, (_m, n) => `"b":${Number(n) + 7}`) }).ok).toBe(false));
  it("easy/medium 원형은 hard 주장 검사(풀이 단계)를 면제받되 정답 재계산은 그대로 받는다", () => {
    const em = emA.find((x) => x.id === "nes.root.e_factored_form")!; const g = (() => { for (let s = 0; s < 50; s++) { const r = generateOne(em, s); if (r.ok) return r.inst; } throw new Error("no"); })();
    expect(g.trace.length).toBeLessThan(5); expect(verifyInstance(em, g).ok).toBe(true);
    expect(verifyInstance(em, { ...g, correctIndex: (g.correctIndex + 1) % 4 }).ok).toBe(false);
  });
});

describe("담당 A 대량 산출기 — easy/medium 레코드", () => {
  it("easy/medium 원형은 난이도·confirmed 상태로 레코드가 만들어진다", () => {
    const pool = emA.filter((a) => a.skill === "nonlinear_functions");
    const { records } = produceFromArchetypes(pool, { runId: "t-a", count: 24, seedStart: 5 });
    expect(records).toHaveLength(24);
    for (const r of records) {
      expect(["easy", "medium"]).toContain(r.difficulty); expect(r.problem.difficulty).toBe(r.difficulty);
      expect((r.quality as { mockExamGeneration: { difficultyStatus: string } }).mockExamGeneration.difficultyStatus).toBe("confirmed");
      expect(r.subpattern.startsWith(`${r.recipeId}/`)).toBe(true);
    }
    expect(new Set(records.map((r) => r.subpattern)).size).toBeGreaterThanOrEqual(8);
  });
});

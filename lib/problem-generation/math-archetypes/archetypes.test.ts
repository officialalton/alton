import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ARCHETYPES } from "./registry";
import { generateOne, sweepArchetype } from "./sweep";
import { checkNotation, evalMath, runVerification, verifyInstance, checkParamsPrinted } from "./verify";
import { frac, sentenceCase, spin } from "./text";
import { makeRng } from "./rng";
import type { OperatorId } from "./types";

const OPS: OperatorId[] = ["param_condition", "inverse", "compose_kind", "chain2", "unit_ratio", "repr_shift", "constraint_select", "compare_scenarios"];

describe("원형 메타데이터(hard 주장의 기계 검사 기준)", () => {
  it("id 규칙·연산자·개념 2개 이상·추가 사고 서술·풀이 구조가 있고 중복 id 가 없다", () => {
    const ids = new Set<string>();
    for (const a of ARCHETYPES) {
      expect(a.id.endsWith(`.${a.operator}`), a.id).toBe(true);
      expect(OPS).toContain(a.operator);
      expect(a.concepts.length, a.id).toBeGreaterThanOrEqual(2);
      expect(a.extraThinking.length, a.id).toBeGreaterThan(20);
      expect(a.structure.length, a.id).toBeGreaterThan(20);
      expect(ids.has(a.id), `중복 ${a.id}`).toBe(false); ids.add(a.id);
    }
  });
  it("같은 세부 패턴의 원형 4개는 서로 다른 연산자를 쓴다(숫자만 바꾼 중복이 아님)", () => {
    const byKind = new Map<string, string[]>();
    for (const a of ARCHETYPES) byKind.set(`${a.skill}.${a.kind}`, [...(byKind.get(`${a.skill}.${a.kind}`) ?? []), a.operator]);
    for (const [k, ops] of byKind) { expect(ops.length, k).toBe(4); expect(new Set(ops).size, k).toBe(4); }
  });
  it("mediumSteps 는 기존 medium 컴파일러 해설의 실측 단계 수(math-medium-baseline.json) 이상이다", () => {
    const base = JSON.parse(readFileSync("data/mock-exam-generation/math-medium-baseline.json", "utf-8")) as Record<string, { medium: number }>;
    for (const a of ARCHETYPES) { const m = base[`${a.skill}.${a.kind}`]; if (m && m.medium > 0) expect(a.mediumSteps, a.id).toBeGreaterThanOrEqual(Math.ceil(m.medium)); }
  });
});

describe("원형 시드 스윕 — 정답 재계산·선지 겹침·표기·hard 주장", () => {
  for (const a of ARCHETYPES) {
    it(`${a.id}: 400 시드에서 검증 실패 0, 예외 0, 독립 변형 30개 이상`, () => {
      const st = sweepArchetype(a, 400);
      expect(st.thrown, st.thrownSamples.join("|")).toBe(0);
      expect(st.verifyFail, JSON.stringify(st.failSeeds[0])).toBe(0);
      expect(st.produced).toBeGreaterThan(20);
      expect(st.independent, "본문 유사도 0.6 미만 독립 변형 수").toBeGreaterThanOrEqual(30);
    }, 60_000);
    it(`${a.id}: 같은 시드는 같은 문항을 낸다(재현성)`, () => {
      let checked = 0;
      for (let s = 0; s < 60 && checked < 3; s++) { const x = generateOne(a, s), y = generateOne(a, s); expect(JSON.stringify(x)).toBe(JSON.stringify(y)); if (x.ok) checked++; }
      expect(checked).toBeGreaterThan(0);
    });
  }
});

describe("검증기 자체 — 일부러 틀린 문항을 잡아내는가(돌연변이)", () => {
  const a = ARCHETYPES.find((x) => x.id === "le.solve.compose_kind")!;
  const good = (() => { for (let s = 0; s < 50; s++) { const g = generateOne(a, s); if (g.ok) return g.inst; } throw new Error("no"); })();
  it("원본은 통과", () => expect(verifyInstance(a, good).ok).toBe(true));
  it("정답 키를 다른 선지로 바꾸면 실패", () => expect(verifyInstance(a, { ...good, correctIndex: (good.correctIndex + 1) % 4 }).ok).toBe(false));
  it("verification_js 상수를 바꾸면 재계산이 어긋나 실패", () => expect(verifyInstance(a, { ...good, verificationJs: good.verificationJs.replace(/"P":\s*(\d+)/, '"P":999') .replace(/(\{"a":)(-?\d+)/, (_m, p, n) => `${p}${Number(n) + 1}`) }).ok).toBe(false));
  it("선지가 겹치면 실패", () => { const o = [...good.options]; o[(good.correctIndex + 1) % 4] = o[good.correctIndex]; expect(verifyInstance(a, { ...good, options: o }).ok).toBe(false); });
  it("수식 안에 한글이 있으면 표기 검사가 잡는다", () => expect(checkNotation({ explanation: "정답은 $x = 3 입니다$ 이다." }).length).toBeGreaterThan(0));
  it("$ 짝이 안 맞으면 표기 검사가 잡는다", () => expect(checkNotation({ stimulus: "Solve $x + 1 = 2." }).length).toBeGreaterThan(0));
  it("지문에 한글이 있으면 잡는다", () => expect(checkNotation({ stimulus: "다음 식을 풀어라.", question: "What is x?" }).length).toBeGreaterThan(0));
  it("검증 상수가 지문에 인쇄되지 않으면 잡는다", () => expect(checkParamsPrinted({ ...good, stimulus: "A rectangle.", question: "Area?", options: ["1", "2", "3", "4"] }).length).toBeGreaterThan(0));
  it("hard 주장: 풀이 단계가 모자라면 실패", () => expect(verifyInstance(a, { ...good, trace: good.trace.slice(0, 2) }).ok).toBe(false));
  it("hard 주장: 지문에 4자리 숫자가 있으면 실패(복잡한 숫자로 hard 를 만들지 않음)", () => expect(verifyInstance(a, { ...good, stimulus: `${good.stimulus} The budget is 4820 dollars.` }).ok).toBe(false));
});

describe("수식 평가기·텍스트 도구", () => {
  it("evalMath: 분수·암묵 곱셈·제곱근·지수·π 계수", () => {
    expect(evalMath("3/10")).toBeCloseTo(0.3);
    expect(evalMath("$\\frac{x(x + 2)}{2x + 2}$", { x: 3 })).toBeCloseTo(15 / 8);
    expect(evalMath("$5x^2 - 2x - 7$", { x: 3 })).toBe(32);
    expect(evalMath("-3x + 4", { x: 2 })).toBe(-2);
    expect(evalMath("$36\\pi$")).toBe(36);
    expect(evalMath("$\\sqrt{16} + 2(x + 1)$", { x: 1 })).toBe(8);
    expect(() => evalMath("$q + 1$", { x: 1 })).toThrow();
  });
  it("runVerification: 유한한 숫자만 허용·무한 루프는 시간 제한", () => {
    expect(runVerification("return 3+4;")).toBe(7);
    expect(() => runVerification("return 'a';")).toThrow();
    expect(() => runVerification("while(true){}")).toThrow();
  });
  it("frac·sentenceCase·spin", () => {
    expect(frac(6, 24)).toBe("1/4"); expect(frac(8, 4)).toBe("2"); expect(frac(-2, -6)).toBe("1/3");
    expect(sentenceCase("a bag has 3 red . two are drawn.")).toBe("A bag has 3 red. Two are drawn.");
    expect(sentenceCase("the value of $x$ is 3. the end")).toBe("The value of $x$ is 3. The end");
    const r = makeRng(1); const out = spin(r, "[[a|b]] and [[c|d]]"); expect(out).toMatch(/^[ab] and [cd]$/);
  });
});

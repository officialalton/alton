import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { D_ARCHETYPES } from "./registry-d";
import { ARCHETYPES } from "./registry";
import { checkBindings, levelRecord, sweepLevel, verifyLevel, withBind, type BInstance, type LArch } from "./levels-d";
import { generateOne } from "./sweep";

const hard = D_ARCHETYPES.filter((a) => a.level === "hard");
const lev = D_ARCHETYPES.filter((a) => a.level !== "hard");

describe("담당 D 원형 메타데이터", () => {
  it("id 규칙·개념·추가 사고 서술·중복 없음", () => {
    const ids = new Set<string>();
    for (const a of D_ARCHETYPES) {
      if (a.level === "hard") expect(a.id.endsWith(`.${a.operator}`), a.id).toBe(true);
      expect(a.concepts.length, a.id).toBeGreaterThanOrEqual(2);
      expect(a.extraThinking.length, a.id).toBeGreaterThan(a.level === "hard" ? 12 : 6);
      expect(a.structure.length, a.id).toBeGreaterThan(a.level === "hard" ? 12 : 6);
      expect(ids.has(a.id), `중복 ${a.id}`).toBe(false); ids.add(a.id);
    }
  });
  it("같은 세부 패턴의 hard 원형 4개는 서로 다른 연산자를 쓴다", () => {
    const byKind = new Map<string, string[]>();
    for (const a of hard) byKind.set(`${a.skill}.${a.kind}`, [...(byKind.get(`${a.skill}.${a.kind}`) ?? []), a.operator]);
    for (const [k, ops] of byKind) { expect(ops.length, k).toBe(4); expect(new Set(ops).size, k).toBe(4); }
  });
  it("hard 의 mediumSteps 는 medium 컴파일러 실측 단계 이상이다", () => {
    const base = JSON.parse(readFileSync("data/mock-exam-generation/math-medium-baseline.json", "utf-8")) as Record<string, { medium: number }>;
    for (const a of hard) { const m = base[`${a.skill}.${a.kind}`]; if (m && m.medium > 0) expect(a.mediumSteps, a.id).toBeGreaterThanOrEqual(Math.ceil(m.medium)); }
  });
  it("수치형 hard 원형은 registry.ts 에도 등록돼 공용 검증 대상이다", () => {
    const reg = new Set(ARCHETYPES.map((a) => a.id));
    for (const a of hard.filter((x) => !x.qualitative)) expect(reg.has(a.id), a.id).toBe(true);
  });
});

describe("담당 D 원형 시드 스윕 — 정답 재계산·선지 겹침·표기·의미 일치", () => {
  for (const a of D_ARCHETYPES) {
    it(`${a.id}(${a.level}): 400 시드 검증 실패 0·예외 0·독립 변형 30 이상`, () => {
      const st = sweepLevel(a, 400);
      expect(st.thrown, st.thrownSamples.join("|")).toBe(0);
      expect(st.verifyFail, JSON.stringify(st.failSeeds[0])).toBe(0);
      expect(st.produced).toBeGreaterThan(20);
      if (a.level === "hard") expect(st.independent, "독립 변형").toBeGreaterThanOrEqual(30);
      else for (const [v, n] of Object.entries(st.independentByVariant)) expect(n, `그룹 ${v}`).toBeGreaterThanOrEqual(30);
    }, 120_000);
    it(`${a.id}: 같은 시드는 같은 문항(재현성)`, () => {
      let c = 0;
      for (let s = 0; s < 60 && c < 3; s++) { const x = generateOne(a, s), y = generateOne(a, s); expect(JSON.stringify(x)).toBe(JSON.stringify(y)); if (x.ok) c++; }
      expect(c).toBeGreaterThan(0);
    });
  }
});

describe("검증기 돌연변이(담당 D)", () => {
  const a = lev.find((x) => x.id === "lat.triangle_angle_sum.med_expressions") as LArch;
  const good = (() => { for (let s = 0; s < 50; s++) { const g = generateOne(a, s); if (g.ok) return g.inst as BInstance; } throw new Error("no"); })();
  it("원본 통과", () => expect(verifyLevel(a, good).ok).toBe(true));
  it("정답 키 변경 시 실패", () => expect(verifyLevel(a, { ...good, correctIndex: (good.correctIndex + 1) % 4 }).ok).toBe(false));
  it("의미 일치: 명사와 값이 다른 문장·먼 거리로 떨어지면 실패", () => {
    expect(checkBindings(withBind(good, [{ noun: "angle", value: 99999 }])).length).toBeGreaterThan(0);
    expect(checkBindings(withBind({ ...good, stimulus: "Angle A is big. " + "x ".repeat(60) + "It is 55.", question: "q" }, [{ noun: "angle a", value: 55 }])).length).toBeGreaterThan(0);
    expect(checkBindings(withBind({ ...good, stimulus: "Angle A measures 55 degrees.", question: "q" }, [{ noun: "angle a", value: 55 }])).length).toBe(0);
    expect(checkBindings(withBind({ ...good, stimulus: "The angle is half of the other.", question: "q" }, [{ noun: "angle", value: 2 }])).length).toBe(0);
  });
  it("easy/medium 은 풀이 단계가 너무 적으면 실패", () => expect(verifyLevel(a, { ...good, trace: good.trace.slice(0, 1) }).ok).toBe(false));
  it("레코드 형태: confirmed·그룹 키", () => {
    const r = levelRecord(a, good, 1, "run", 3);
    expect(r.difficulty).toBe("medium"); expect(r.subpattern.startsWith(`${a.id}/`)).toBe(true);
    expect((r.quality.mockExamGeneration as { difficultyStatus: string }).difficultyStatus).toBe("confirmed");
  });
});

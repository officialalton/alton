// B 담당(일차 계열 5 skill) 원형 추가 검증 — easy/medium 틀(그룹) 공급·의미 일치 대응표·세부 패턴 커버리지.
// hard 원형 자체의 스윕·재현성·메타데이터는 archetypes.test.ts 가 전체 ARCHETYPES 로 이미 돌린다.
import { describe, expect, it } from "vitest";
import { ARCHETYPES, EM_ARCHETYPES } from "./registry";
import { generateOne, sweepArchetype } from "./sweep";
import { checkBindings, verifyInstance } from "./verify";
import { getMathSkillKinds } from "../math-compilers/kind-catalog";
import { produceFromArchetypes } from "./bulk";

const B_SKILLS = ["linear_equations_one_var", "linear_functions", "linear_equations_two_var", "systems_linear", "linear_inequalities"] as const;
/** 카탈로그 밖 systems_linear 세부 패턴(문서 3절 제안). 컴파일러 구현 시 kind-catalog.ts 에 함께 추가한다. */
const SYSTEMS_KINDS = ["substitution_solve", "elimination_value", "param_no_solution", "word_system"];
const requiredKinds = (skill: string) => (skill === "systems_linear" ? SYSTEMS_KINDS : getMathSkillKinds(skill).map((k) => k.value));
const hardB = ARCHETYPES.filter((a) => (B_SKILLS as readonly string[]).includes(a.skill));
const emB = EM_ARCHETYPES.filter((a) => (B_SKILLS as readonly string[]).includes(a.skill));

describe("B hard 원형 커버리지 — 세부 패턴마다 서로 다른 연산자 4개", () => {
  for (const skill of B_SKILLS) {
    it(`${skill}: 모든 세부 패턴(${requiredKinds(skill).length}개)에 원형 4개`, () => {
      const mine = hardB.filter((a) => a.skill === skill);
      if (mine.length === 0) return; // 아직 구현 전인 skill 은 진행표에서 추적
      for (const k of requiredKinds(skill)) {
        const ops = mine.filter((a) => a.kind === k).map((a) => a.operator);
        expect(ops.length, `${skill}.${k}`).toBe(4); expect(new Set(ops).size, `${skill}.${k}`).toBe(4);
      }
    });
  }
});

describe("B easy/medium 원형(문장 틀 = 유사문항 그룹)", () => {
  it("id 고유·난이도·연산자 frame·메타데이터", () => {
    const ids = new Set<string>();
    for (const a of emB) {
      expect(["easy", "medium"]).toContain(a.difficulty); expect(a.operator).toBe("frame"); expect(ids.has(a.id), a.id).toBe(false); ids.add(a.id);
      expect(a.id.startsWith(`${a.skill === "linear_equations_one_var" ? "le" : a.skill === "linear_functions" ? "lf" : a.skill === "linear_equations_two_var" ? "l2" : a.skill === "systems_linear" ? "sl" : "li"}.${a.kind}.`), a.id).toBe(true);
    }
  });
  for (const skill of B_SKILLS) {
    it(`${skill}: easy 3틀 이상·medium 5틀 이상(세트당 easy 1 + medium 3 그룹 확보)`, () => {
      const mine = emB.filter((a) => a.skill === skill); if (mine.length === 0) return;
      expect(mine.filter((a) => a.difficulty === "easy").length).toBeGreaterThanOrEqual(3);
      expect(mine.filter((a) => a.difficulty === "medium").length).toBeGreaterThanOrEqual(5);
    });
  }
  for (const a of emB) {
    it(`${a.id}: 1,500 시드 정답 재계산 불일치·예외 0, 그룹당 독립 변형 30개 이상`, () => {
      const st = sweepArchetype(a, 1500);
      expect(st.thrown, st.thrownSamples.join("|")).toBe(0);
      expect(st.verifyFail, JSON.stringify(st.failSeeds[0])).toBe(0);
      expect(st.independent, "그룹당 독립 변형").toBeGreaterThanOrEqual(30);
      for (const [variant, n] of Object.entries(st.variants)) expect(n, variant).toBeGreaterThan(100);
    }, 120_000);
    it(`${a.id}: 같은 시드는 같은 문항`, () => {
      let checked = 0;
      for (let s = 0; s < 40 && checked < 3; s++) { const x = generateOne(a, s), y = generateOne(a, s); expect(JSON.stringify(x)).toBe(JSON.stringify(y)); if (x.ok) checked++; }
      expect(checked).toBeGreaterThan(0);
    });
  }
});

describe("B 원형 전체 돌연변이 — 검증기가 일부러 망가뜨린 문항을 모두 잡는다", () => {
  const all = [...hardB, ...emB];
  it("정답 키 변경·선지 중복·풀이 단계 삭제(hard)는 어느 원형에서도 통과하지 않는다", () => {
    for (const a of all) {
      let inst = null as ReturnType<typeof generateOne> | null; for (let s = 0; s < 40 && !(inst && inst.ok); s++) inst = generateOne(a, s);
      if (!inst || !inst.ok) throw new Error(`생성 실패 ${a.id}`);
      const g = inst.inst;
      expect(verifyInstance(a, g).ok, `${a.id} 원본`).toBe(true);
      expect(verifyInstance(a, { ...g, correctIndex: (g.correctIndex + 1) % 4 }).ok, `${a.id} 정답 키 변경`).toBe(false);
      const dup = [...g.options]; dup[(g.correctIndex + 1) % 4] = dup[g.correctIndex]; expect(verifyInstance(a, { ...g, options: dup }).ok, `${a.id} 선지 중복`).toBe(false);
      if ((a.difficulty ?? "hard") === "hard") expect(verifyInstance(a, { ...g, trace: g.trace.slice(0, 2) }).ok, `${a.id} 단계 부족`).toBe(false);
      expect(verifyInstance(a, { ...g, stimulus: `${g.stimulus} 한글이 섞인 지문` }).ok, `${a.id} 한글 지문`).toBe(false);
    }
  });
  it("hard 원형 메타데이터: 추가 요구 사고가 길이·숫자·계산량만을 말하지 않는다", () => {
    for (const a of hardB) { expect(a.extraThinking, a.id).toMatch(/medium/); expect(a.extraThinking, a.id).not.toMatch(/긴 지문|복잡한 숫자|계산량/); }
  });
});

describe("문장과 변수의 의미 일치(명사-수식 대응표 기반 기계 검사)", () => {
  const withBindings = [...hardB, ...emB].filter((a) => { for (let s = 0; s < 20; s++) { const g = generateOne(a, s); if (g.ok && g.inst.phraseBindings?.length) return true; } return false; });
  it("대응표를 가진 원형이 있고 모두 통과한다", () => {
    expect(withBindings.length).toBeGreaterThan(0);
    for (const a of withBindings) for (let s = 0; s < 60; s++) { const g = generateOne(a, s); if (g.ok) expect(checkBindings(g.inst), `${a.id}#${s}`).toEqual([]); }
  });
  it("돌연변이: 명사에 붙은 수를 서로 바꾸면 검사가 잡는다", () => {
    const a = withBindings[0]; const g = [...Array(40).keys()].map((s) => generateOne(a, s)).find((x) => x.ok && (x.inst.phraseBindings?.length ?? 0) >= 2);
    if (!g || !g.ok) return;
    const [b1, b2] = g.inst.phraseBindings!; const t = g.inst.stimulus;
    const swapped = t.replace(new RegExp(`\\b${b1.value}\\b`, "g"), "@@").replace(new RegExp(`\\b${b2.value}\\b`, "g"), String(b1.value)).replace(/@@/g, String(b2.value));
    if (b1.value !== b2.value) expect(checkBindings({ ...g.inst, stimulus: swapped }).length).toBeGreaterThan(0);
  });
  it("돌연변이: 명사구가 본문에 없으면 잡는다", () => {
    const a = withBindings[0]; const g = generateOne(a, 1); if (!g.ok) return;
    expect(checkBindings({ ...g.inst, phraseBindings: [{ phrase: "zebra crossing", value: 3 }] }).length).toBeGreaterThan(0);
  });
  it("돌연변이: 대응표가 있는 문항의 정답 키를 바꾸면 검증이 실패한다", () => {
    const a = withBindings[0]; const g = generateOne(a, 2); if (!g.ok) return;
    expect(verifyInstance(a, { ...g.inst, correctIndex: (g.inst.correctIndex + 1) % 4 }).ok).toBe(false);
  });
});

describe("easy/medium 원형 대량 산출 — import.ts 호환 레코드·난이도·그룹 상한", () => {
  for (const diff of ["easy", "medium"] as const) {
    it(`linear_functions ${diff}: 레코드 난이도·confirmed 표식·그룹당 상한`, () => {
      const pool = emB.filter((a) => a.skill === "linear_functions" && a.difficulty === diff);
      const want = pool.length * 4; const { records, stats } = produceFromArchetypes(pool, { runId: "t", count: want, seedStart: 0, maxPerGroup: 4 });
      expect(records).toHaveLength(want);
      for (const r of records) {
        expect(r.difficulty).toBe(diff); expect((r.problem as { difficulty: string }).difficulty).toBe(diff);
        expect((r.quality as { mockExamGeneration: { difficultyStatus: string } }).mockExamGeneration.difficultyStatus).toBe("confirmed");
        expect(r.subpattern.startsWith(`${r.recipeId}/`)).toBe(true);
      }
      expect(Math.max(...Object.values(stats.byGroup))).toBeLessThanOrEqual(4);
    });
  }
});

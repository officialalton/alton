import { describe, expect, it } from "vitest";
import { isMathOfficialOrdered, isRwBlockOrdered, reorderSetModulesOfficial, MATH_OFFICIAL_MEAN_POSITION, MATH_SKILL_TO_OFFICIAL, RW_SKILL_ORDER, sortModuleOfficial } from "./official-order";

const mk = (skill: string, difficulty = "medium") => ({ skill, difficulty });

describe("official order", () => {
  it("R&W: 영역 블록 순서 CS -> II -> SEC -> EOI", () => {
    const shuffled = [mk("rhetorical_synthesis"), mk("boundaries"), mk("inferences"), mk("words_in_context"), mk("transitions"), mk("central_ideas_details"), mk("text_structure_purpose"), mk("form_structure_sense")];
    const out = sortModuleOfficial("rw", shuffled).map((x) => x.skill);
    expect(out).toEqual(["words_in_context", "text_structure_purpose", "central_ideas_details", "inferences", "boundaries", "form_structure_sense", "transitions", "rhetorical_synthesis"]);
    expect(isRwBlockOrdered(shuffled)).toBe(false);
    expect(isRwBlockOrdered(sortModuleOfficial("rw", shuffled))).toBe(true);
  });
  it("R&W: 같은 skill 안은 난이도 오름차순, 동률은 입력 순서 유지", () => {
    const out = sortModuleOfficial("rw", [mk("words_in_context", "hard"), mk("words_in_context", "easy"), mk("words_in_context", "easy"), mk("boundaries", "easy"), mk("form_structure_sense", "easy")]);
    expect(out.map((x) => x.difficulty)).toEqual(["easy", "easy", "hard", "easy", "easy"]);
    expect(out.slice(3).map((x) => x.skill)).toEqual(["boundaries", "form_structure_sense"]);
  });
  it("Math: skill 공식 평균 위치 1차, 난이도 2차", () => {
    const out = sortModuleOfficial("math", [mk("circles"), mk("linear_functions", "hard"), mk("probability"), mk("linear_functions", "easy"), mk("systems_linear"), mk("nonlinear_functions")]).map((x) => `${x.skill}:${x.difficulty}`);
    expect(out).toEqual(["probability:medium", "linear_functions:easy", "linear_functions:hard", "systems_linear:medium", "nonlinear_functions:medium", "circles:medium"]);
    expect(isMathOfficialOrdered(out.map((s) => mk(s.split(":")[0], s.split(":")[1])))).toBe(true);
  });
  it("reorderSetModulesOfficial: 모듈별 position 값 집합 유지", () => {
    const mkI = (position: number, skill: string, moduleKey: string, route: string | null, section = "rw") => ({ position, skill, difficulty: "easy", moduleKey, route, section });
    const out = reorderSetModulesOfficial([mkI(1, "transitions", "rw_m1", null), mkI(2, "words_in_context", "rw_m1", null), mkI(28, "boundaries", "rw_m2", "lower"), mkI(29, "words_in_context", "rw_m2", "lower")]);
    expect(out.map((x) => [x.position, x.skill])).toEqual([[1, "words_in_context"], [2, "transitions"], [28, "words_in_context"], [29, "boundaries"]]);
  });
  it("매핑 표 완전성: 모든 Math skill 이 공식 위치를 갖고, 알 수 없는 skill 은 맨 뒤", () => {
    for (const off of Object.values(MATH_SKILL_TO_OFFICIAL)) expect(MATH_OFFICIAL_MEAN_POSITION[off]).toBeTypeOf("number");
    expect(Object.keys(RW_SKILL_ORDER)).toHaveLength(11);
    expect(sortModuleOfficial("math", [mk("zzz"), mk("circles")]).map((x) => x.skill)).toEqual(["circles", "zzz"]);
  });
});

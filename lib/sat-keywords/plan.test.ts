import { describe, expect, it } from "vitest";
import { planKeywords, planProblemLinks, planLegacy, nearestSkill, chunk, type KeywordRow } from "./plan";

const subjects = { sat_math: "M", sat_rw: "R" };
const kw = (id: string, subject_id: string, label: string, skill_code: string | null = null, status = "active"): KeywordRow => ({ id, subject_id, label, status, skill_code, domain_code: skill_code ? "x" : null });

describe("planKeywords", () => {
  it("빈 DB 면 30개 생성", () => {
    const p = planKeywords([], subjects);
    expect(p.create).toHaveLength(30);
    expect(p.create.filter((c) => c.subject_id === "R")).toHaveLength(11);
  });
  it("같은 라벨 구 키워드는 재사용, skill_code 있는 건 건너뜀(재실행 안전)", () => {
    const p = planKeywords([kw("a", "R", " words in context "), kw("b", "M", "Circles", "circles"), kw("c", "M", "Words in Context")], subjects);
    expect(p.reuse).toEqual([{ id: "a", label: "Words in Context", skill_code: "words_in_context", domain_code: "rw_craft_structure" }]);
    expect(p.alreadySet).toEqual([{ id: "b", skill_code: "circles" }]);
    expect(p.create).toHaveLength(28);
    const again = planKeywords([...p.create.map((c, i) => kw(`n${i}`, c.subject_id, c.label, c.skill_code)), kw("a", "R", "Words in Context", "words_in_context"), kw("b", "M", "Circles", "circles")], subjects);
    expect(again.create).toHaveLength(0);
    expect(again.reuse).toHaveLength(0);
  });
});

describe("planProblemLinks", () => {
  const id = (s: string, k: string) => `${s}/${k}`;
  it("과목·스킬로 연결하고 null·타 과목·기존 연결을 분리", () => {
    const p = planProblemLinks([
      { id: "p1", subject_id: "R", exam_system: "sat_rw", skill_code: "inferences" },
      { id: "p2", subject_id: "R", exam_system: "sat_rw", skill_code: null },
      { id: "p3", subject_id: "X", exam_system: "sat_math", skill_code: "circles" },
      { id: "p4", subject_id: "M", exam_system: "sat_math", skill_code: "circles" },
      { id: "p5", subject_id: "M", exam_system: "sat_rw", skill_code: "circles" },
    ], subjects, id, new Set(["p4:M/circles"]));
    expect(p.inserts).toEqual([{ problem_id: "p1", keyword_id: "R/inferences" }]);
    expect(p.nullSkill).toEqual(["p2"]);
    expect(p.otherSubject).toEqual(["p3"]);
    expect(p.alreadyLinked).toBe(1);
    expect(p.unknownSkill.map((u) => u.id)).toEqual(["p5"]);
    expect(p.countBySkill).toEqual({ inferences: 1, circles: 1 });
  });
});

describe("planLegacy", () => {
  it("연결은 삭제 대상, 사용처 있으면 active 유지, 없으면 archive", () => {
    const legacy = [kw("k1", "M", "이차방정식"), kw("k2", "R", "Voca"), kw("k3", "R", "UAT", null, "archived")];
    const usage = new Map([["k1", { docs: 2, subjectUnits: 1, teacherUnits: 0, sections: 0 }]]);
    const p = planLegacy(legacy, [{ problem_id: "p", keyword_id: "k2" }, { problem_id: "p", keyword_id: "new" }], usage, subjects);
    expect(p.linksToDelete).toEqual([{ problem_id: "p", keyword_id: "k2" }]);
    expect(p.keepActive).toEqual([expect.objectContaining({ id: "k1", total: 3, candidate: "nonlinear_equations_systems" })]);
    expect(p.archive).toEqual([{ id: "k2", label: "Voca" }]);
  });
  it("후보는 과목에 맞는 스킬만", () => {
    expect(nearestSkill("Grammer", "sat_rw")).toBe("boundaries");
    expect(nearestSkill("Grammer", "sat_math")).toBeNull();
    expect(nearestSkill("Speaking")).toBeNull();
  });
  it("chunk", () => expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]));
});

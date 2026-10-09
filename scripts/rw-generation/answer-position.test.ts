import { describe, expect, it } from "vitest";
import { planAnswerPositions, positionSpread, enforceAnswerPosition, positionDirective, type PositionKey } from "./answer-position";

const items = (n: number, skill = "inferences", difficulty = "hard") => Array.from({ length: n }, () => ({ skill, difficulty }));

describe("목표 정답 위치 배정", () => {
  it("결정론: 같은 입력이면 같은 배정", () => {
    expect(planAnswerPositions(items(37)).letters).toEqual(planAnswerPositions(items(37)).letters);
  });
  it("소량 배치(1~9건)에서도 그룹 안 최대-최소 차이가 1 이하", () => {
    for (let n = 1; n <= 9; n++) expect(Math.max(...Object.values(positionSpread(planAnswerPositions(items(n)).counts)))).toBeLessThanOrEqual(1);
  });
  it("(skill x 난이도) 그룹마다 독립적으로 균등하다(섞여 들어와도)", () => {
    const mixed = Array.from({ length: 120 }, (_, i) => ({ skill: i % 2 ? "inferences" : "words_in_context", difficulty: i % 3 === 0 ? "hard" : "medium" }));
    const { counts } = planAnswerPositions(mixed);
    for (const s of Object.values(positionSpread(counts))) expect(s).toBeLessThanOrEqual(1);
  });
  it("배치를 나눠도 누적 균등: prior 를 이어 쓰면 3배치 합산이 한 번에 한 것과 같은 편차", () => {
    let prior: Record<PositionKey, [number, number, number, number]> = {};
    for (const n of [7, 11, 5]) prior = planAnswerPositions(items(n), prior).counts;
    expect(Math.max(...Object.values(positionSpread(prior)))).toBeLessThanOrEqual(1);
  });
  it("전체 풀(여러 그룹)에서 A~D 비율이 25% 근처(±2%p)", () => {
    const all: { skill: string; difficulty: string }[] = [];
    for (const s of ["a", "b", "c", "d", "e", "f", "g"]) for (const d of ["easy", "medium", "hard"]) all.push(...items(53, s, d));
    const { letters } = planAnswerPositions(all);
    for (const L of "ABCD") expect(Math.abs(letters.filter((x) => x === L).length / letters.length - 0.25)).toBeLessThan(0.02);
  });
  it("그룹 시작 글자는 해시로 어긋나 첫 문항들이 전부 A 로 쏠리지 않는다", () => {
    const firsts = ["a", "b", "c", "d", "e", "f", "g", "h"].map((s) => planAnswerPositions(items(1, s, "hard")).letters[0]);
    expect(new Set(firsts).size).toBeGreaterThan(1);
  });
  it("프롬프트 지시에 목표 글자가 들어간다", () => expect(positionDirective("C")).toContain("C"));
});

describe("정답 위치 강제(후처리)", () => {
  const g = { options: ["The tide rose slowly.", "She kept the key hidden.", "He never answered.", "They sold the house."], correct_letter: "A", explanation: "정답은 A 이다. B 는 틀리다." };
  it("목표와 같으면 그대로", () => expect(enforceAnswerPosition(g, "A").status).toBe("as_is"));
  it("어긋나면 선택지를 재배치하고 해설의 글자를 치환", () => {
    const r = enforceAnswerPosition(g, "C");
    expect(r.status).toBe("permuted");
    if (r.status === "permuted") {
      expect(r.g.correct_letter).toBe("C");
      expect(r.g.options[2]).toBe("The tide rose slowly.");
      expect(new Set(r.g.options)).toEqual(new Set(g.options));
      expect(r.g.explanation).toContain("정답은 C");
    }
  });
  it("보정 불가(숫자 선택지)는 탈락시킨다", () => {
    const r = enforceAnswerPosition({ options: ["12", "14", "16", "18"], correct_letter: "A", explanation: "A" }, "D");
    expect(r.status).toBe("rejected");
  });
  it("선택지 개수·정답 글자 오류는 탈락", () => {
    expect(enforceAnswerPosition({ ...g, options: ["a", "b"] }, "A").status).toBe("rejected");
    expect(enforceAnswerPosition({ ...g, correct_letter: "E" }, "A").status).toBe("rejected");
  });
});

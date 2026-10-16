import { describe, expect, it } from "vitest";
import { buildLevelCands, explanationEnIssues, levelVerdict, MAX_EASILY_ELIMINATED, type LevelVerdictInput } from "./rw-level";

const ok: LevelVerdictInput = { answerCorrect: true, explanationConsistent: true, formatOk: true, factualError: false, copyrightSuspect: false, explanationEnOk: true, levelVerdict: "fits", blindPicked: "B", blindOtherDefensible: false, eliminated: 1 };

describe("buildLevelCands", () => {
  const c = buildLevelCands("medium", { boundaries: 4, transitions: 4 }, ["a", "b", "c"]);
  it("skill:n 만큼 만들고 cid 가 유일하다", () => {
    expect(c).toHaveLength(8);
    expect(new Set(c.map((x) => x.cid)).size).toBe(8);
    expect(c.every((x) => x.difficulty === "medium" && x.recipeId === null)).toBe(true);
  });
  it("정답 목표 위치가 A~D 에 고르게 순환한다", () => {
    const n = [0, 0, 0, 0];
    for (const x of c) n[x.targetLetter.charCodeAt(0) - 65]++;
    expect(n).toEqual([2, 2, 2, 2]);
  });
});

describe("explanationEnIssues", () => {
  it("없으면 missing", () => expect(explanationEnIssues("")).toEqual(["explanation_en_missing"]));
  it("한글 혼입을 잡는다", () => expect(explanationEnIssues("A is right. B is wrong. 정답은 A.")).toContain("explanation_en_hangul"));
  it("너무 짧은 해설을 잡는다", () => expect(explanationEnIssues("A is right.")).toContain("explanation_en_too_short"));
  it("정상 3문장은 통과", () => expect(explanationEnIssues("Choice B is correct. It joins two clauses. The others fail.")).toEqual([]));
});

describe("levelVerdict", () => {
  it("모두 통과하면 correct+fit", () => expect(levelVerdict("medium", "B", ok)).toEqual({ correct: true, fit: true }));
  it("블라인드 불일치는 correct 실패", () => expect(levelVerdict("medium", "C", ok).correct).toBe(false));
  it("영어 해설 결함은 correct 실패", () => expect(levelVerdict("easy", "B", { ...ok, explanationEnOk: false }).correct).toBe(false));
  it("너무 쉬움/어려움은 fit 실패", () => { expect(levelVerdict("medium", "B", { ...ok, levelVerdict: "too_easy" }).fit).toBe(false); expect(levelVerdict("easy", "B", { ...ok, levelVerdict: "too_hard" }).fit).toBe(false); });
  it("medium 은 오답 3개 모두 쉽게 배제되면 fit 실패", () => expect(levelVerdict("medium", "B", { ...ok, eliminated: 3 }).fit).toBe(false));
  it("easy 는 배제 제한이 없다", () => expect(levelVerdict("easy", "B", { ...ok, eliminated: MAX_EASILY_ELIMINATED.easy }).fit).toBe(true));
});

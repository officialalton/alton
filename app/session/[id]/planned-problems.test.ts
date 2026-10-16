import { describe, expect, it } from "vitest";
import { toPlannedSessionProblems } from "./session-problem-data";

// 2026-09-14 — 수업 시작 전 '수업 준비'에도 배정된 문제가 보인다.
describe("예정 문제 미리보기", () => {
  it("정답·해설·풀이 상태 없이, 읽기용 표식(planned)만 붙여 옮긴다", () => {
    const out = toPlannedSessionProblems([
      { problemId: "p1", passage: "지문", options: ["가", "나"] },
      { problemId: "p2", passage: null, options: null },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      number: 1,
      problemId: "p1",
      passage: "지문",
      options: ["가", "나"],
      correctIndex: null,
      explanation: null,
      attempts: 0,
      solved: false,
      planned: true,
    });
    expect(out[1].options).toEqual([]);
    expect(out[1].number).toBe(2);
  });

  it("비어 있으면 빈 목록이다", () => {
    expect(toPlannedSessionProblems(null)).toEqual([]);
    expect(toPlannedSessionProblems(undefined)).toEqual([]);
  });
});

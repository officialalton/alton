// DB 스캔 순수 함수 테스트: 빈칸 뒤 중복 자동 패치, 질문 문장 중복 제거, 교점 창 밖.
import { describe, expect, it } from "vitest";
import { intersectionOffAxes, scanRows, stripQuestionFromPassage, trimDuplicateContinuation } from "./scan";
import { blankJunctionIssues } from "./plan";

describe("trimDuplicateContinuation", () => {
  it("모든 선택지가 같은 끝 단어(구)로 끝나고 빈칸 뒤가 그 단어로 시작하면 그 단어를 지운다", () => {
    const opts = [", the floodwaters", "and the floodwaters", "; the floodwaters", "the floodwaters"];
    const r = trimDuplicateContinuation("summer______ the floodwaters must travel.", opts);
    expect(r).toEqual({ passage: "summer______ must travel.", removed: "the floodwaters" });
    expect(blankJunctionIssues((r as { passage: string }).passage, opts)).toEqual([]);
  });
  it("빈칸 뒤 리터럴 쉼표는 모든 선택지가 쉼표로 끝날 때만 지운다", () => {
    expect(trimDuplicateContinuation("x. ______ , they maintain", ["Even so,", "For example,"])).toMatchObject({ passage: "x. ______ they maintain" });
    expect(trimDuplicateContinuation("x. ______ , they maintain", ["Even so,", "For example"])).toHaveProperty("review");
  });
  it("일부 선택지만 겹치면 사람이 본다(review)", () => {
    const r = trimDuplicateContinuation("a ______ she frequently dropped", ["; she", ", she", "and then", "so"]);
    expect(r).toHaveProperty("review");
  });
  it("겹침이 없으면 null", () => { expect(trimDuplicateContinuation("a ______ b c", ["x", "y"])).toBeNull(); });
});

describe("stripQuestionFromPassage / intersectionOffAxes", () => {
  it("지문에 질문 문장이 있으면 지우고, 없으면 null", () => {
    const q = "Which choice best states the main idea of the text?";
    expect(stripQuestionFromPassage(`The author discusses roots.\n\n${q}`, q)).toBe("The author discusses roots.");
    expect(stripQuestionFromPassage("The author discusses roots.", q)).toBeNull();
    expect(stripQuestionFromPassage("short", "short")).toBeNull();
  });
  const fig = (x: number[], y: number[], l1: [number, number], l2: [number, number]) => ({ type: "plane", axes: { x: { min: x[0], max: x[1] }, y: { min: y[0], max: y[1] } }, objects: [{ kind: "line", slope: l1[0], intercept: l1[1] }, { kind: "line", slope: l2[0], intercept: l2[1] }] });
  it("전체 평면 연립 그림에서 교점이 창 밖이면 좌표를 돌려주고, 1사분면 창은 건드리지 않는다", () => {
    expect(intersectionOffAxes(fig([-10, 10], [-10, 10], [-3, 30], [-1.5, 15.5]))).toBeNull(); // 교점 (10, 0)... 창 안
    expect(intersectionOffAxes(fig([-10, 10], [-10, 10], [-2, 5], [-5, 38]))).toEqual({ x: 11, y: -17 });
    expect(intersectionOffAxes(fig([0, 10], [0, 100], [5, 0], [-5, 120]))).toBeNull();
    expect(intersectionOffAxes({ type: "plane", axes: { x: { min: -5, max: 5 }, y: { min: -5, max: 5 } }, objects: [{ kind: "line", slope: 1, intercept: 0 }] })).toBeNull();
  });
});

describe("scanRows", () => {
  it("이미 패치 목록에 있는 문제는 새 패치를 만들지 않는다", () => {
    const row = { problem_id: "p1", version_id: "v1", gid: "g", passage: "summer______ the floodwaters must travel.", question: null, options: [", the floodwaters", "the floodwaters"], correct_index: 0, figure: null, sets: ["SAT Practice Test 1"] };
    const fresh = scanRows([row], new Set());
    expect(fresh[0].patch?.changes[0].new).toBe("summer______ must travel.");
    expect(scanRows([row], new Set(["p1"]))[0].patch).toBeNull();
  });
});

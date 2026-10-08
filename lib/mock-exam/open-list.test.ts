import { describe, expect, it } from "vitest";
import { buildMockExamListRows, compareExamNames, listStateOf, pickNextPracticeTest, practiceTestTabOf } from "./open-list";
import type { MockExamAttemptSummary, MockExamCatalogRow } from "./attempt-data";

const cat = (o: Partial<MockExamCatalogRow>): MockExamCatalogRow => ({
  examSetId: "s1", setGroupId: "g1", name: "모의고사 1", description: null, difficultyTier: "standard", format: "mst",
  publishedAt: null, attemptId: null, attemptStatus: null, ...o,
});
const att = (o: Partial<MockExamAttemptSummary>): MockExamAttemptSummary => ({
  id: "a1", examSetId: "s1", examSetName: "모의고사 1", difficultyTier: "standard", studentId: "u", studentName: null, status: "in_progress",
  assignedByName: null, dueAt: null, startBy: null, startedAt: null, submittedAt: null, gradedAt: null, totalCount: 98, correctCount: null, entryCount: 0, ...o,
});

describe("buildMockExamListRows", () => {
  it("공개 세트는 응시가 없어도 미응시로 보이고, 응시 상태를 합쳐 보여준다", () => {
    const rows = buildMockExamListRows(
      [cat({}), cat({ examSetId: "s2", name: "모의고사 2", attemptId: "a1", attemptStatus: "in_progress" }), cat({ examSetId: "s3", name: "모의고사 3", attemptId: "a2", attemptStatus: "graded" })],
      [att({ id: "a1", examSetId: "s2" }), att({ id: "a2", examSetId: "s3", status: "graded", correctCount: 80 })],
    );
    expect(rows.map((r) => r.state)).toEqual(["not_started", "in_progress", "graded"]);
    expect(rows[2].attempt?.correctCount).toBe(80);
  });

  it("시작 화면만 연 assigned 응시는 미응시로 취급한다", () => {
    expect(listStateOf("assigned")).toBe("not_started");
    expect(buildMockExamListRows([cat({ attemptId: "a1", attemptStatus: "assigned" })], [att({ status: "assigned" })])[0].state).toBe("not_started");
  });

  it("공개 목록에서 빠진(보관된) 세트의 응시 기록은 지난 시험으로 덧붙이되 시작 전 응시는 숨긴다", () => {
    const rows = buildMockExamListRows([], [att({ id: "old", status: "graded" }), att({ id: "pending", status: "assigned" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ archived: true, state: "graded" });
  });
});

describe("번호순 정렬·다음 모의고사(2026-10-08)", () => {
  it("이름의 숫자를 숫자로 비교한다(Test 2 < Test 10)", () => {
    expect(["SAT Practice Test 10", "SAT Practice Test 9", "SAT Practice Test 1", "SAT Practice Test 2"].sort(compareExamNames)).toEqual([
      "SAT Practice Test 1", "SAT Practice Test 2", "SAT Practice Test 9", "SAT Practice Test 10",
    ]);
  });

  it("목록은 번호 오름차순이고 보관된 지난 시험은 맨 뒤", () => {
    const rows = buildMockExamListRows(
      [cat({ examSetId: "s9", name: "SAT Practice Test 9" }), cat({ examSetId: "s1", name: "SAT Practice Test 1" }), cat({ examSetId: "s10", name: "SAT Practice Test 10" })],
      [att({ id: "old", examSetId: "x", examSetName: "SAT Practice Test 0", status: "graded" })],
    );
    expect(rows.map((r) => r.name)).toEqual(["SAT Practice Test 1", "SAT Practice Test 9", "SAT Practice Test 10", "SAT Practice Test 0"]);
  });

  it("다음 모의고사는 끝내지 않은 가장 낮은 번호(신규 학생은 1번), 최신 세트가 아니다", () => {
    const sets = [9, 3, 1, 2].map((k) => cat({ examSetId: `s${k}`, name: `SAT Practice Test ${k}` }));
    expect(pickNextPracticeTest(buildMockExamListRows(sets, []))?.name).toBe("SAT Practice Test 1");
    const done = [9, 3, 1, 2].map((k) => cat({ examSetId: `s${k}`, name: `SAT Practice Test ${k}`, attemptId: k <= 2 ? `a${k}` : null, attemptStatus: k <= 2 ? "graded" : null }));
    const attempts = [1, 2].map((k) => att({ id: `a${k}`, examSetId: `s${k}`, examSetName: `SAT Practice Test ${k}`, status: "graded" }));
    expect(pickNextPracticeTest(buildMockExamListRows(done, attempts))?.name).toBe("SAT Practice Test 3");
  });

  it("진행 중인 세트도 번호순으로 '끝내지 않은' 쪽이다. 전부 끝내면 null", () => {
    const rows = buildMockExamListRows(
      [cat({ examSetId: "s1", name: "SAT Practice Test 1", attemptId: "a1", attemptStatus: "in_progress" }), cat({ examSetId: "s2", name: "SAT Practice Test 2" })],
      [att({ id: "a1", examSetId: "s1", status: "in_progress" })],
    );
    expect(pickNextPracticeTest(rows)?.state).toBe("in_progress");
    expect(pickNextPracticeTest(buildMockExamListRows([cat({ attemptId: "a1", attemptStatus: "graded" })], [att({ status: "graded" })]))).toBeNull();
  });

  it("서브탭 분류: 제출·채점 완료는 Completed", () => {
    expect(["not_started", "in_progress", "submitted", "graded"].map((s) => practiceTestTabOf(s as never))).toEqual(["todo", "todo", "completed", "completed"]);
  });
});

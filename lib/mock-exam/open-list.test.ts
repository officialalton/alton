import { describe, expect, it } from "vitest";
import { buildMockExamListRows, listStateOf } from "./open-list";
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

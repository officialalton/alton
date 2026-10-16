import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MockExamOpenList from "@/app/components/MockExamOpenList";
import UpdatedVersionNote from "@/app/components/UpdatedVersionNote";
import { buildMockExamListRows, pickNextPracticeTest, practiceTestTabOf } from "./open-list";
import type { MockExamAttemptSummary, MockExamCatalogRow } from "./attempt-data";

vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

// 새 버전(Updated version, 2026-10-12) — 목록 카드·결과 안내·집계 취급(재응시로 세고 새 시험이 아니다).
const cat = (o: Partial<MockExamCatalogRow>): MockExamCatalogRow => ({
  examSetId: "s2", setGroupId: "g1", name: "AP Calculus AB — Practice Exam", description: null, difficultyTier: "standard", format: "fixed",
  publishedAt: null, attemptId: "a1", attemptStatus: "graded", attemptNo: 1, attemptTotal: 1,
  updatedVersion: { versionNo: 2, itemTotal: 10, sharedAnswered: 6, priorVersionNo: 1 }, ...o,
});
const att = (o: Partial<MockExamAttemptSummary>): MockExamAttemptSummary => ({
  id: "a1", examSetId: "s1", examSetName: "AP Calculus AB — Practice Exam", difficultyTier: "standard", studentId: "u", studentName: null, status: "graded",
  assignedByName: null, dueAt: null, startBy: null, startedAt: null, submittedAt: null, gradedAt: null, totalCount: 10, correctCount: 7, entryCount: 0, setGroupId: "g1", attemptNo: 1, ...o,
});

describe("새 버전 — 목록 행 구성(집계·다음 시험)", () => {
  it("옛 버전 응시와 새 버전 세트가 한 줄로 묶이고(보관 행 중복 없음) updatedVersion 이 실린다", () => {
    const rows = buildMockExamListRows([cat({})], [att({})]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ archived: false, examSetId: "s2", updatedVersion: { versionNo: 2, itemTotal: 10, sharedAnswered: 6 } });
    expect(rows[0].attempts.map((a) => a.id)).toEqual(["a1"]);
  });
  it("이미 끝낸 시험의 새 버전은 Completed 에 남고 홈 'Next Practice Test' 가 되지 않는다", () => {
    const rows = buildMockExamListRows([cat({})], [att({})]);
    expect(practiceTestTabOf(rows[0].state)).toBe("completed");
    expect(pickNextPracticeTest(rows)).toBeNull();
  });
  it("진행 중이던 옛 버전 응시는 새 버전 공개 뒤에도 In progress 로 이어진다(응시는 옛 exam_set_id 유지)", () => {
    const rows = buildMockExamListRows([cat({ attemptStatus: "in_progress" })], [att({ status: "in_progress", correctCount: null })]);
    expect(rows[0].state).toBe("in_progress");
    expect(rows[0].attempt).toMatchObject({ id: "a1", examSetId: "s1" });
  });
  it("응시 이력이 없는 학생의 카드에는 updatedVersion 이 없고 다음 시험이 될 수 있다", () => {
    const rows = buildMockExamListRows([cat({ attemptId: null, attemptStatus: null, updatedVersion: undefined })], []);
    expect(rows[0].updatedVersion ?? null).toBeNull();
    expect(pickNextPracticeTest(rows)?.examSetId).toBe("s2");
  });
});

describe("새 버전 — 카드·결과 문구(영어 UI)", () => {
  afterEach(cleanup);
  it("카드에 'Updated version' 배지와 'You already answered N of these questions.', 재응시 안내가 보인다", () => {
    render(<MockExamOpenList rows={buildMockExamListRows([cat({})], [att({})])} readOnly={false} onStart={() => {}} onOpenResult={() => {}} />);
    expect(screen.getByTestId("updated-version-badge")).toHaveTextContent("Updated version");
    expect(screen.getByTestId("updated-version-answered")).toHaveTextContent("You already answered 6 of these questions.");
    expect(screen.getByText(/counts as a retake, not a new practice test/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retake" })).toBeInTheDocument();
  });
  it("학부모(읽기 전용)에게도 배지가 보이고 시작 버튼은 없다", () => {
    render(<MockExamOpenList rows={buildMockExamListRows([cat({})], [att({})])} readOnly resultHrefBase="/parent/mock-exam/u/" />);
    expect(screen.getByTestId("updated-version-badge")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retake" })).toBeNull();
  });
  it("겹치는 문항이 없으면 N 문구는 숨기고 재응시 안내만 보인다. 이력 없는 카드에는 배지가 없다", () => {
    const { unmount } = render(<UpdatedVersionNote info={{ itemTotal: 10, sharedAnswered: 0 }} />);
    expect(screen.queryByTestId("updated-version-answered")).toBeNull();
    expect(screen.getByTestId("updated-version-note")).toBeInTheDocument();
    unmount();
    render(<MockExamOpenList rows={buildMockExamListRows([cat({ attemptId: null, attemptStatus: null, updatedVersion: undefined })], [])} readOnly={false} onStart={() => {}} />);
    expect(screen.queryByTestId("updated-version-badge")).toBeNull();
  });
});

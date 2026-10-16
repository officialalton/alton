import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const startAction = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/mock-exam/attempt-actions", () => ({ startMockExamAction: (...a: unknown[]) => startAction(...a) }));
vi.mock("./mock-exam-tab-actions", () => ({
  loadMyMockExamOverviewAction: vi.fn(async () => ({ catalog: [], attempts: [] })),
  loadMockExamAttemptDetailAction: vi.fn(async () => null),
}));
vi.mock("./mock-exam/[attemptId]/MockExamResultView", () => ({ default: () => <div>결과 화면</div> }));

import StudentMockExamTab from "./StudentMockExamTab";
import ParentMockExamTab from "@/app/parent/ParentMockExamTab";
import type { MockExamOverview } from "@/lib/mock-exam/attempt-data";

const overview: MockExamOverview = {
  catalog: [
    { examSetId: "s1", setGroupId: "g1", name: "미응시 시험", description: null, difficultyTier: "standard", format: "mst", publishedAt: null, attemptId: null, attemptStatus: null },
    { examSetId: "s2", setGroupId: "g2", name: "진행 시험", description: null, difficultyTier: "advanced", format: "mst", publishedAt: null, attemptId: "a2", attemptStatus: "in_progress" },
    { examSetId: "s3", setGroupId: "g3", name: "완료 시험", description: null, difficultyTier: "foundation", format: "fixed", publishedAt: null, attemptId: "a3", attemptStatus: "graded" },
  ],
  attempts: [
    { id: "a2", examSetId: "s2", examSetName: "진행 시험", difficultyTier: "advanced", studentId: "u", studentName: null, status: "in_progress", assignedByName: null, dueAt: null, startBy: null, startedAt: null, submittedAt: null, gradedAt: null, totalCount: 98, correctCount: null, entryCount: 0 },
    { id: "a3", examSetId: "s3", examSetName: "완료 시험", difficultyTier: "foundation", studentId: "u", studentName: null, status: "graded", assignedByName: null, dueAt: null, startBy: null, startedAt: null, submittedAt: null, gradedAt: null, totalCount: 98, correctCount: 70, entryCount: 0 },
  ],
};

describe("StudentMockExamTab (공개 세트 목록)", () => {
  beforeEach(() => {
    push.mockClear();
    startAction.mockReset();
  });
  afterEach(cleanup);

  it("미응시·진행 중·완료 상태와 시작·이어서·결과 보기 행동을 보여준다", () => {
    render(<StudentMockExamTab initialOverview={overview} />);
    // 기본은 To do: 미응시 + 진행 중(상태 라벨 유지). 완료는 Completed 서브탭.
    expect(screen.getByText("Not started")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.queryByText(/Completed · 70\/98 correct/)).toBeNull();
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue" }).getAttribute("href")).toBe("/student/mock-exam/a2");
    fireEvent.click(screen.getByRole("button", { name: "Completed" }));
    expect(screen.getByText(/Completed · 70\/98 correct/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View results" })).toBeInTheDocument();
  });

  it("시작을 누르면 서버 시작 액션을 부르고 응시 화면으로 이동한다", async () => {
    startAction.mockResolvedValue({ ok: true, value: { attemptId: "new-attempt" } });
    render(<StudentMockExamTab initialOverview={overview} />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/student/mock-exam/new-attempt"));
    expect(startAction).toHaveBeenCalledWith("s1");
  });

  it("시작 실패는 오류로 보이고 이동하지 않는다", async () => {
    startAction.mockResolvedValue({ ok: false, error: "공개된 시험만 시작할 수 있습니다." });
    render(<StudentMockExamTab initialOverview={overview} />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("공개된 시험만 시작할 수 있습니다.");
    expect(push).not.toHaveBeenCalled();
  });

  it("공개 세트가 없으면 빈 상태", () => {
    render(<StudentMockExamTab initialOverview={{ catalog: [], attempts: [] }} />);
    expect(screen.getByText("No practice tests are available yet.")).toBeInTheDocument();
  });
});

describe("ParentMockExamTab (읽기 전용)", () => {
  it("시작·이어서 버튼 없이 상태만 보이고 완료만 상세 링크가 있다", async () => {
    vi.doMock("@/app/parent/mock-exam-tab-actions", () => ({ loadChildMockExamOverviewAction: async () => overview }));
    vi.resetModules();
    const { default: Parent } = await import("@/app/parent/ParentMockExamTab");
    render(<Parent studentId="u" />);
    expect(await screen.findByText("미응시 시험")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Continue" })).toBeNull();
    expect(screen.getByRole("link", { name: "View detailed results" }).getAttribute("href")).toBe("/parent/mock-exam/u/a3");
    void ParentMockExamTab;
  });
});

describe("StudentMockExamTab — 번호순·5개씩·To do/Completed(2026-10-08)", () => {
  afterEach(cleanup);
  const many = (n: number, doneUpTo = 0): MockExamOverview => ({
    // 일부러 최신(큰 번호)부터 내려준다 — 화면이 번호 오름차순으로 다시 세워야 한다.
    catalog: Array.from({ length: n }, (_, i) => n - i).map((k) => ({
      examSetId: `s${k}`, setGroupId: `g${k}`, name: `SAT Practice Test ${k}`, description: null, difficultyTier: "standard", format: "mst" as const, publishedAt: null,
      attemptId: k <= doneUpTo ? `a${k}` : null, attemptStatus: k <= doneUpTo ? ("graded" as const) : null,
    })),
    attempts: Array.from({ length: doneUpTo }, (_, i) => i + 1).map((k) => ({
      id: `a${k}`, examSetId: `s${k}`, examSetName: `SAT Practice Test ${k}`, difficultyTier: "standard", studentId: "u", studentName: null, status: "graded" as const,
      assignedByName: null, dueAt: null, startBy: null, startedAt: null, submittedAt: null, gradedAt: null, totalCount: 98, correctCount: 70, entryCount: 0,
    })),
  });
  const names = () => screen.getAllByText(/^SAT Practice Test \d+$/).map((n) => n.textContent);

  it("Test 1부터 번호 오름차순(9가 맨 앞이 아니다), 5개씩 페이지로 나눈다", () => {
    render(<StudentMockExamTab initialOverview={many(12)} />);
    expect(names()).toEqual(["SAT Practice Test 1", "SAT Practice Test 2", "SAT Practice Test 3", "SAT Practice Test 4", "SAT Practice Test 5"]);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    // 10 이 2 다음이 아니라 9 다음(자연 정렬).
    expect(names()).toEqual(["SAT Practice Test 6", "SAT Practice Test 7", "SAT Practice Test 8", "SAT Practice Test 9", "SAT Practice Test 10"]);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(names()).toEqual(["SAT Practice Test 11", "SAT Practice Test 12"]);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("완료한 세트는 To do 에서 빠지고 Completed 로 가며, 탭을 바꾸면 1페이지로 돌아간다", () => {
    render(<StudentMockExamTab initialOverview={many(8, 3)} />);
    expect(names()).toEqual(["SAT Practice Test 4", "SAT Practice Test 5", "SAT Practice Test 6", "SAT Practice Test 7", "SAT Practice Test 8"]);
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Completed" }));
    expect(names()).toEqual(["SAT Practice Test 1", "SAT Practice Test 2", "SAT Practice Test 3"]);
    fireEvent.click(screen.getByRole("button", { name: "To do" }));
    expect(names()[0]).toBe("SAT Practice Test 4");
  });

  it("To do 가 비면 안내 문구를 보인다", () => {
    render(<StudentMockExamTab initialOverview={many(2, 2)} />);
    expect(screen.getByText(/all caught up/)).toBeInTheDocument();
  });
});

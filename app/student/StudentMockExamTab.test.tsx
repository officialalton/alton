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
    expect(screen.getByText("미응시")).toBeInTheDocument();
    expect(screen.getByText("진행 중")).toBeInTheDocument();
    expect(screen.getByText(/완료 · 70\/98 정답/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "시작" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "이어서 하기" }).getAttribute("href")).toBe("/student/mock-exam/a2");
    expect(screen.getByRole("button", { name: "결과 보기" })).toBeInTheDocument();
  });

  it("시작을 누르면 서버 시작 액션을 부르고 응시 화면으로 이동한다", async () => {
    startAction.mockResolvedValue({ ok: true, value: { attemptId: "new-attempt" } });
    render(<StudentMockExamTab initialOverview={overview} />);
    fireEvent.click(screen.getByRole("button", { name: "시작" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/student/mock-exam/new-attempt"));
    expect(startAction).toHaveBeenCalledWith("s1");
  });

  it("시작 실패는 오류로 보이고 이동하지 않는다", async () => {
    startAction.mockResolvedValue({ ok: false, error: "공개된 시험만 시작할 수 있습니다." });
    render(<StudentMockExamTab initialOverview={overview} />);
    fireEvent.click(screen.getByRole("button", { name: "시작" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("공개된 시험만 시작할 수 있습니다.");
    expect(push).not.toHaveBeenCalled();
  });

  it("공개 세트가 없으면 빈 상태", () => {
    render(<StudentMockExamTab initialOverview={{ catalog: [], attempts: [] }} />);
    expect(screen.getByText("공개된 모의고사가 없습니다.")).toBeInTheDocument();
  });
});

describe("ParentMockExamTab (읽기 전용)", () => {
  it("시작·이어서 버튼 없이 상태만 보이고 완료만 상세 링크가 있다", async () => {
    vi.doMock("@/app/parent/mock-exam-tab-actions", () => ({ loadChildMockExamOverviewAction: async () => overview }));
    vi.resetModules();
    const { default: Parent } = await import("@/app/parent/ParentMockExamTab");
    render(<Parent studentId="u" />);
    expect(await screen.findByText("미응시 시험")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "시작" })).toBeNull();
    expect(screen.queryByRole("link", { name: "이어서 하기" })).toBeNull();
    expect(screen.getByRole("link", { name: "상세 결과 보기" }).getAttribute("href")).toBe("/parent/mock-exam/u/a3");
    void ParentMockExamTab;
  });
});

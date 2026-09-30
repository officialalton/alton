import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReportedProblemsPanel from "./ReportedProblemsPanel";

const list = vi.fn();
const detail = vi.fn();
const apply = vi.fn();
vi.mock("./problem-error-report-actions", () => ({
  listReportedProblemsAction: (...a: unknown[]) => list(...a),
  getReportedProblemDetailAction: (...a: unknown[]) => detail(...a),
  applyProblemErrorVerdictAction: (...a: unknown[]) => apply(...a),
}));

const group = {
  problemId: "p1", versionId: "v1", format: "mc", satDomain: "algebra", skillCode: "linear_functions", difficulty: "medium",
  snippet: "다음 일차함수의 기울기는?", reportCount: 3, openCount: 3,
  typeCounts: { wrong_key: 2, flawed_problem: 1, bad_explanation: 0, other: 0 }, sourceCounts: { session_assignment: 1, mock_exam: 2 },
  firstAt: "2026-09-29T01:00:00Z", lastAt: "2026-09-29T02:00:00Z", archived: false, latestDecision: null,
};
const det = {
  problem: { id: "p1", format: "mc", satDomain: "algebra", skillCode: "linear_functions", usageScope: "both", archived: false, archivedReason: null, reviewNeeded: true },
  version: { id: "v1", versionNo: 1, status: "published", passage: null, question: "기울기는?", options: ["1", "2"], correctIndex: 0, answers: null, explanation: "해설", difficulty: "medium" },
  reports: [{ id: "r1", source: "mock_exam", sessionSource: null, reporterRole: "student", reporterName: "학생A", reportType: "wrong_key", memo: "정답이 이상해요", createdAt: "2026-09-29T02:00:00Z", resolved: false }],
  reportTotal: 1,
  affected: { mockAttemptsGraded: 4, mockAttemptsOpen: 1, sessionWorks: 2, mockAdjusted: 0, sessionAdjusted: 0, sessionPending: 0 },
  verdicts: [], replacementNeeds: [], replacements: [],
};

beforeEach(() => {
  list.mockReset();
  detail.mockReset();
  apply.mockReset();
});

describe("ReportedProblemsPanel", () => {
  it("빈 상태·오류 상태를 보여준다", async () => {
    list.mockResolvedValueOnce({ total: 0, rows: [] });
    const a = render(<ReportedProblemsPanel />);
    await waitFor(() => expect(screen.getByText("검토할 신고가 없습니다.")).toBeInTheDocument());
    a.unmount();
    list.mockRejectedValueOnce(new Error("권한 없음"));
    render(<ReportedProblemsPanel />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("권한 없음"));
  });

  it("목록은 유형·출처 집계를 보이고 상세에서 영향 범위와 신고 내용을 본다", async () => {
    list.mockResolvedValue({ total: 1, rows: [group] });
    detail.mockResolvedValue(det);
    render(<ReportedProblemsPanel />);
    await waitFor(() => expect(screen.getByTestId("reported-problem-row")).toHaveTextContent("신고 3건"));
    expect(screen.getByTestId("reported-problem-row")).toHaveTextContent("정답 오류 2");
    expect(screen.getByTestId("reported-problem-row")).toHaveTextContent("모의고사 2");
    fireEvent.click(screen.getByTestId("reported-problem-row"));
    await waitFor(() => expect(screen.getByTestId("reported-problem-detail")).toBeInTheDocument());
    expect(screen.getByTestId("reported-affected")).toHaveTextContent("4");
    expect(screen.getByText("정답이 이상해요")).toBeInTheDocument();
    expect(detail).toHaveBeenCalledWith("p1", "v1");
  });

  it("오류 확정 판정은 한 번 더 확인한 뒤 적용하고 결과를 요약한다, 오류 아님은 바로 적용", async () => {
    list.mockResolvedValue({ total: 1, rows: [group] });
    detail.mockResolvedValue(det);
    apply.mockResolvedValue({ ok: true, value: { alreadyApplied: false, verdictId: "x", decision: "flawed_confirmed", resolvedReports: 3, archived: true, mockAdjustedAnswers: 4, sessionWorksAdjusted: 2, autoReplaced: 1, replacementNeedsOpen: 0 } });
    render(<ReportedProblemsPanel />);
    await waitFor(() => screen.getByTestId("reported-problem-row"));
    fireEvent.click(screen.getByTestId("reported-problem-row"));
    await waitFor(() => screen.getByTestId("reported-problem-detail"));
    const go = screen.getByRole("button", { name: "판정 적용" });
    expect(go).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/문제 자체 오류 확정/));
    fireEvent.click(go);
    expect(apply).not.toHaveBeenCalled(); // 확인 단계
    expect(screen.getByText(/되돌리기 어려운 처리/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    await waitFor(() => expect(screen.getByTestId("verdict-result")).toHaveTextContent("문항 보관 · 모의고사 4문항 조정 채점 · 과제 2건 조정 · 여분 문항으로 1칸 자동 교체"));
    expect(apply).toHaveBeenCalledWith({ problemId: "p1", versionId: "v1", decision: "flawed_confirmed", note: null });

    apply.mockClear();
    apply.mockResolvedValue({ ok: true, value: { alreadyApplied: false, verdictId: "y", decision: "not_error", resolvedReports: 3 } });
    fireEvent.click(screen.getByLabelText(/오류 아님/));
    fireEvent.click(screen.getByRole("button", { name: "판정 적용" }));
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
  });

  it("서버가 판정을 거절하면 사유를 보여준다", async () => {
    list.mockResolvedValue({ total: 1, rows: [group] });
    detail.mockResolvedValue(det);
    apply.mockResolvedValue({ ok: false, error: "관리자만 판정할 수 있습니다." });
    render(<ReportedProblemsPanel />);
    await waitFor(() => screen.getByTestId("reported-problem-row"));
    fireEvent.click(screen.getByTestId("reported-problem-row"));
    await waitFor(() => screen.getByTestId("reported-problem-detail"));
    fireEvent.click(screen.getByLabelText(/오류 아님/));
    fireEvent.click(screen.getByRole("button", { name: "판정 적용" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("관리자만 판정할 수 있습니다."));
  });
});

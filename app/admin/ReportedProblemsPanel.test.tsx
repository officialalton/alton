import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReportedProblemsPanel from "./ReportedProblemsPanel";

const list = vi.fn();
const detail = vi.fn();
const apply = vi.fn();
const confirm = vi.fn();
const unconfirm = vi.fn();
vi.mock("./problem-error-report-actions", () => ({
  listReportedProblemsAction: (...a: unknown[]) => list(...a),
  getReportedProblemDetailAction: (...a: unknown[]) => detail(...a),
  applyProblemErrorVerdictAction: (...a: unknown[]) => apply(...a),
  confirmReportedProblemAction: (...a: unknown[]) => confirm(...a),
  unconfirmReportedProblemAction: (...a: unknown[]) => unconfirm(...a),
  getConfirmedReportExportAction: vi.fn(),
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
  confirm.mockReset();
  unconfirm.mockReset();
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
    expect(screen.queryByTestId("verdict-step2")).toBeNull();
    fireEvent.click(screen.getByLabelText(/오류 → 보관/));
    expect(go).toBeDisabled(); // 유형 선택 전
    fireEvent.click(screen.getByLabelText(/문제 자체 오류 확정/));
    fireEvent.click(go);
    expect(apply).not.toHaveBeenCalled(); // 확인 단계
    expect(screen.getByText(/되돌리기 어려운 처리/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    await waitFor(() => expect(screen.getByTestId("verdict-result")).toHaveTextContent("문항 보관 · 모의고사 4문항 조정 채점 · 과제 2건 조정 · 여분 문항으로 1칸 자동 교체"));
    expect(apply).toHaveBeenCalledWith({ problemId: "p1", versionId: "v1", decision: "flawed_confirmed", note: null });

    apply.mockClear();
    apply.mockResolvedValue({ ok: true, value: { alreadyApplied: false, verdictId: "y", decision: "not_error", resolvedReports: 3 } });
    fireEvent.click(screen.getByLabelText(/정상 → 복귀/));
    fireEvent.click(screen.getByRole("button", { name: "판정 적용" }));
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
  });

  it("필터가 있으면 칩을 보이고 조건을 목록 조회에 넘긴다", async () => {
    list.mockResolvedValue({ total: 0, rows: [] });
    const clear = vi.fn();
    render(<ReportedProblemsPanel filter={{ skill: "linear_functions", difficulty: "hard", days: 7 }} onClearFilter={clear} />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(list.mock.calls[0][0]).toMatchObject({ skill: "linear_functions", difficulty: "hard", days: 7 });
    expect(screen.getByTestId("report-filter-chip")).toHaveTextContent("최근 7일");
    fireEvent.click(screen.getByRole("button", { name: "해제" }));
    expect(clear).toHaveBeenCalled();
  });

  it("서버가 판정을 거절하면 사유를 보여준다", async () => {
    list.mockResolvedValue({ total: 1, rows: [group] });
    detail.mockResolvedValue(det);
    apply.mockResolvedValue({ ok: false, error: "관리자만 판정할 수 있습니다." });
    render(<ReportedProblemsPanel />);
    await waitFor(() => screen.getByTestId("reported-problem-row"));
    fireEvent.click(screen.getByTestId("reported-problem-row"));
    await waitFor(() => screen.getByTestId("reported-problem-detail"));
    fireEvent.click(screen.getByLabelText(/정상 → 복귀/));
    fireEvent.click(screen.getByRole("button", { name: "판정 적용" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("관리자만 판정할 수 있습니다."));
  });

  it("확인 버튼은 상세 우측 상단에서 확인됨 칩·확인 취소로 바뀌고 목록으로 이동하지 않는다, 다음 신고로 이동 가능", async () => {
    const g2 = { ...group, problemId: "p2", versionId: "v2" };
    list.mockResolvedValue({ total: 2, counts: { review: 2, confirmed: 0, fixed: 0, all: 2 }, rows: [group, g2] });
    detail.mockResolvedValueOnce(det).mockResolvedValue({ ...det, confirmation: { confirmedAt: "2026-10-08T00:00:00Z", confirmedByName: "관리자", note: null } });
    confirm.mockResolvedValue({ ok: true });
    render(<ReportedProblemsPanel />);
    await waitFor(() => expect(screen.getByRole("tab", { name: "검토 필요 2" })).toBeInTheDocument());
    fireEvent.click(screen.getAllByTestId("reported-problem-row")[0]);
    await waitFor(() => expect(screen.getByTestId("confirm-toggle")).toHaveTextContent("확인"));
    fireEvent.click(screen.getByTestId("confirm-toggle"));
    await waitFor(() => expect(screen.getByTestId("confirmed-chip")).toBeInTheDocument());
    expect(confirm).toHaveBeenCalledWith("p1", "v1");
    expect(screen.getByTestId("confirm-toggle")).toHaveTextContent("확인 취소");
    expect(screen.getByTestId("confirm-toast")).toBeInTheDocument();
    fireEvent.click(screen.getByText("다음 신고 →"));
    await waitFor(() => expect(detail).toHaveBeenCalledWith("p2", "v2"));
  });

  it("신고된 버전보다 새 버전이 있으면 v1 → v2 표시, 판정 전 확인 대화상자, 영어·한글 해설 표시", async () => {
    list.mockResolvedValue({ total: 1, counts: { review: 0, confirmed: 0, fixed: 1, all: 1 }, rows: [{ ...group, state: "fixed", currentVersionNo: 2, versionNo: 1 }] });
    detail.mockResolvedValue({ ...det, currentVersionNo: 2, version: { ...det.version, explanationEn: "English explanation" } });
    apply.mockResolvedValue({ ok: true, value: { alreadyApplied: false, verdictId: "x", decision: "not_error", resolvedReports: 1 } });
    render(<ReportedProblemsPanel />);
    await waitFor(() => expect(screen.getByTestId("reported-problem-row")).toHaveTextContent("수정됨(v2)"));
    fireEvent.click(screen.getByTestId("reported-problem-row"));
    await waitFor(() => expect(screen.getByTestId("superseded-note")).toHaveTextContent("v1 → 현재 v2"));
    expect(screen.getByTestId("explanation-en")).toHaveTextContent("English explanation");
    expect(screen.getByText("한글 해설")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/정상/));
    fireEvent.click(screen.getByText("판정 적용"));
    expect(screen.getByTestId("stale-verdict-dialog")).toHaveTextContent("이미 v2로 수정됨");
    expect(apply).not.toHaveBeenCalled();
  });
});

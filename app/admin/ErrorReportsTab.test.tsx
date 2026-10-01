import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorReportsTab from "./ErrorReportsTab";

const list = vi.fn().mockResolvedValue({ total: 0, rows: [] });
const getStats = vi.fn().mockResolvedValue({
  days: null,
  totals: { reports: 1, reportedProblems: 1, openReports: 1, activeProblems: 10, confirmed: 0, notError: 0 },
  axes: {},
  topCells: [{ skill: "s1", difficulty: "easy", reports: 1, reportedProblems: 1, active: 2, rate: 0.5 }],
  weekly: Array.from({ length: 12 }, (_, i) => ({ weekStart: `2026-07-${String(i + 1).padStart(2, "0")}`, reports: 0 })),
});
vi.mock("./problem-error-report-actions", () => ({
  listReportedProblemsAction: (...a: unknown[]) => list(...a),
  getReportedProblemDetailAction: vi.fn(),
  applyProblemErrorVerdictAction: vi.fn(),
  getReportStatsAction: (...a: unknown[]) => getStats(...a),
}));

describe("ErrorReportsTab", () => {
  it("서브탭 '신고 내역'이 기본이고, 통계의 상위 칸 행을 누르면 필터된 신고 내역으로 이동한다", async () => {
    render(<ErrorReportsTab />);
    await waitFor(() => expect(screen.getByTestId("reported-problems-panel")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "통계" }));
    await waitFor(() => screen.getByTestId("stat-cell-row"));
    fireEvent.click(screen.getByTestId("stat-cell-row"));
    await waitFor(() => expect(screen.getByTestId("report-filter-chip")).toHaveTextContent("s1"));
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ skill: "s1", difficulty: "easy" }));
  });
});

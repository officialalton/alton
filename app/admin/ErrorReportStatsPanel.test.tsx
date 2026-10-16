import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ErrorReportStatsPanel from "./ErrorReportStatsPanel";

const getStats = vi.fn();
vi.mock("./problem-error-report-actions", () => ({ getReportStatsAction: (...a: unknown[]) => getStats(...a) }));

const item = (key: string, reports: number, np: number, active: number | null) => ({ key, reports, reportedProblems: np, active, rate: active ? np / active : null });
const stats = {
  days: null,
  totals: { reports: 10, reportedProblems: 6, openReports: 4, activeProblems: 120, confirmed: 4, notError: 2 },
  axes: {
    reportType: [item("wrong_key", 6, 4, null), item("other", 4, 3, null)],
    difficulty: [item("hard", 7, 4, 40)],
    batch: [item("ai_generated|2026-09", 5, 3, 30)],
  },
  topCells: [{ skill: "linear_functions", difficulty: "hard", reports: 5, reportedProblems: 2, active: 8, rate: 0.25 }],
  weekly: Array.from({ length: 12 }, (_, i) => ({ weekStart: `2026-07-${String(i + 1).padStart(2, "0")}`, reports: i === 11 ? 3 : 0 })),
};

beforeEach(() => getStats.mockReset());

describe("ErrorReportStatsPanel", () => {
  it("로딩 스켈레톤 뒤 카드·막대·표를 보이고 신고율을 계산해 표시한다", async () => {
    getStats.mockResolvedValue(stats);
    render(<ErrorReportStatsPanel onOpenCell={() => {}} />);
    expect(screen.getByTestId("stats-skeleton")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("stats-cards")).toBeInTheDocument());
    expect(screen.getByTestId("stats-cards")).toHaveTextContent("5.0%"); // 6/120
    expect(screen.getByTestId("stats-cards")).toHaveTextContent("66.7%"); // 4/6
    expect(screen.getByTestId("stat-type")).toHaveTextContent("정답 오류");
    expect(screen.getByTestId("stat-difficulty")).toHaveTextContent("신고율 10.0%");
    expect(screen.getByTestId("stat-batch")).toHaveTextContent("AI 생성 · 2026-09");
    expect(screen.getByTestId("stat-batch")).toHaveTextContent("생성 배치 ID가 저장되지 않아");
    expect(screen.getByTestId("stat-top-cells")).toHaveTextContent("25.0%");
  });

  it("기간 필터는 days 를 바꿔 다시 조회한다", async () => {
    getStats.mockResolvedValue(stats);
    render(<ErrorReportStatsPanel onOpenCell={() => {}} />);
    await waitFor(() => screen.getByTestId("stats-cards"));
    expect(getStats).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole("tab", { name: "최근 7일" }));
    await waitFor(() => expect(getStats).toHaveBeenLastCalledWith(7));
    fireEvent.click(screen.getByRole("tab", { name: "최근 30일" }));
    await waitFor(() => expect(getStats).toHaveBeenLastCalledWith(30));
  });

  it("상위 칸 행을 누르면 해당 조건(+기간)으로 신고 내역을 연다", async () => {
    getStats.mockResolvedValue(stats);
    const open = vi.fn();
    render(<ErrorReportStatsPanel onOpenCell={open} />);
    await waitFor(() => screen.getByTestId("stat-cell-row"));
    fireEvent.click(screen.getByTestId("stat-cell-row"));
    expect(open).toHaveBeenCalledWith({ skill: "linear_functions", difficulty: "hard", days: null });
  });

  it("빈 상태와 오류+다시 시도", async () => {
    getStats.mockResolvedValueOnce({ ...stats, totals: { ...stats.totals, reports: 0 } });
    const a = render(<ErrorReportStatsPanel onOpenCell={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("stats-empty")).toHaveTextContent("아직 접수된 신고가 없습니다."));
    a.unmount();
    getStats.mockRejectedValueOnce(new Error("관리자만 볼 수 있습니다.")).mockResolvedValueOnce(stats);
    render(<ErrorReportStatsPanel onOpenCell={() => {}} />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("관리자만"));
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => screen.getByTestId("stats-cards"));
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReplacementBadge, ReplacementNeedsBlock } from "./ReplacementNeeds";

const summary = vi.fn();
const retry = vi.fn();
vi.mock("../problem-error-report-actions", () => ({
  getReplacementNeedSummaryAction: () => summary(),
  retryReplacementAction: () => retry(),
}));

const data = {
  openTotal: 3, openInMockSet: 2, autoReplacedTotal: 5,
  cells: [{ satDomain: "rw_craft_structure", skillCode: "words_in_context", difficulty: "medium", moduleKey: "rw_m2", usageScope: "both", inMockSet: true, openCount: 2 }],
  sets: [{ examSetId: "s1", name: "모의 A", openCount: 2, startedCount: 1, noSpareCount: 1 }],
  items: [],
  replacements: [{ id: "r1", examSetId: "s1", examSetName: "모의 A", oldProblemId: "aaaaaaaa-1", newProblemId: "bbbbbbbb-2", moduleKey: "rw_m2", route: "higher", difficulty: "medium", satDomain: "rw_craft_structure", skillCode: "words_in_context", createdAt: "2026-09-29T00:00:00Z" }],
};

beforeEach(() => {
  summary.mockReset();
  retry.mockReset();
});

describe("ReplacementNeedsBlock", () => {
  it("대체 필요 건수·부족한 칸·세트별 표시·최근 자동 교체를 보여준다(차단 없음)", async () => {
    summary.mockResolvedValue(data);
    render(<ReplacementNeedsBlock poolRest={{ "rw_craft_structure|words_in_context": 0 }} />);
    await waitFor(() => expect(screen.getByTestId("replacement-needs-header")).toHaveTextContent("대체 문항 필요 3건 (세트 칸 2) · 자동 교체 누적 5건"));
    expect(screen.getByTestId("replacement-sets")).toHaveTextContent("모의 A — 문항 교체 필요 2칸");
    expect(screen.getByTestId("replacement-sets")).toHaveTextContent("여분 없음 1");
    expect(screen.getAllByText(/R&W M2/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText(/최근 자동 교체 1건/));
    expect(screen.getByTestId("replacement-log")).toHaveTextContent("문항 aaaaaaaa → bbbbbbbb 교체됨");
  });

  it("다시 시도 결과를 알려주고 요약을 새로 읽는다", async () => {
    summary.mockResolvedValue(data);
    retry.mockResolvedValue({ replaced: 1, noSpare: 1, setStarted: 0 });
    render(<ReplacementNeedsBlock poolRest={{}} />);
    await waitFor(() => screen.getByTestId("replacement-needs"));
    fireEvent.click(screen.getByRole("button", { name: "자동 교체 다시 시도" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("자동 교체 1칸 · 여분 없음 1칸"));
  });

  it("필요한 칸이 없으면 경고 없이 0건으로 보이고 재시도는 잠긴다", async () => {
    summary.mockResolvedValue({ ...data, openTotal: 0, openInMockSet: 0, cells: [], sets: [], replacements: [] });
    render(<ReplacementNeedsBlock poolRest={{}} />);
    await waitFor(() => expect(screen.getByTestId("replacement-needs-header")).toHaveTextContent("대체 문항 필요 0건"));
    expect(screen.getByRole("button", { name: "자동 교체 다시 시도" })).toBeDisabled();
  });

  it("불러오기 실패를 표시한다", async () => {
    summary.mockRejectedValue(new Error("x"));
    render(<ReplacementNeedsBlock poolRest={{}} />);
    await waitFor(() => expect(screen.getByText("대체 문항 현황을 불러오지 못했습니다.")).toBeInTheDocument());
  });
});

describe("ReplacementBadge", () => {
  it("열린 대체 필요가 있는 세트에만 '문항 교체 필요' 표시", async () => {
    summary.mockResolvedValue(data);
    const a = render(<ReplacementBadge examSetId="s1" />);
    await waitFor(() => expect(screen.getByTestId("set-replacement-badge")).toHaveTextContent("문항 교체 필요 2"));
    a.unmount();
    render(<ReplacementBadge examSetId="other" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId("set-replacement-badge")).toBeNull();
  });
});

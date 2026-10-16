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

  it("남은 칸마다 세트·버전·막힌 이유를 보여준다", async () => {
    summary.mockResolvedValue({
      ...data,
      sets: [{ examSetId: "s1", name: "모의 A", versionNo: 2, status: "published", openCount: 2, startedCount: 1, noSpareCount: 1 }],
      items: [
        { id: "n1", problemId: "aaaaaaaa-1", moduleKey: "rw_m2", route: "higher", difficulty: "medium", satDomain: "rw_craft_structure", skillCode: "words_in_context", usageScope: "both", inMockSet: true, openReason: "set_started", createdAt: "2026-10-01T00:00:00Z", examSetId: "s1", setName: "모의 A", setVersionNo: 2, setStatus: "published" },
        { id: "n2", problemId: "cccccccc-3", moduleKey: "rw_m1", route: null, difficulty: "easy", satDomain: "rw_craft_structure", skillCode: "words_in_context", usageScope: "both", inMockSet: true, openReason: "no_spare", createdAt: "2026-10-01T00:00:00Z", examSetId: "s1", setName: "모의 A", setVersionNo: 2, setStatus: "published" },
      ],
    });
    render(<ReplacementNeedsBlock poolRest={{}} />);
    await waitFor(() => screen.getByTestId("replacement-items"));
    expect(screen.getByTestId("replacement-sets")).toHaveTextContent("모의 A v2 (공개) — 문항 교체 필요 2칸");
    const items = screen.getAllByTestId("replacement-item");
    expect(items[0]).toHaveTextContent("모의 A v2 (공개)");
    expect(items[0]).toHaveTextContent("응시가 시작된 세트라 문항을 바꿀 수 없습니다");
    expect(items[1]).toHaveTextContent("미배정 공개 문항이 풀에 없어");
  });

  it("세트에 없는 일반 문항 필요는 경보(건수·붉은 카드)에서 빠지고 별도 접이식으로만 보인다", async () => {
    summary.mockResolvedValue({
      ...data, openTotal: 0, openInMockSet: 0, openBankLevel: 1, cells: [], sets: [], items: [], replacements: [],
      bankCells: [{ satDomain: "geometry_trig", skillCode: "lines_angles_triangles", difficulty: "medium", usageScope: "mock_exam", openCount: 1, stock: 113 }],
    });
    render(<ReplacementNeedsBlock poolRest={{}} />);
    await waitFor(() => expect(screen.getByTestId("replacement-needs-header")).toHaveTextContent("대체 문항 필요 0건"));
    expect(screen.getByTestId("replacement-needs").className).not.toContain("border-red");
    expect(screen.getByTestId("replacement-bank")).toHaveTextContent("일반 문항 대체 필요 1건 (세트에 없음 — 경보 아님)");
    expect(screen.getByTestId("replacement-bank")).toHaveTextContent("보통 · 모의고사용 · 1건 · 같은 조건 미배정 공개 문항 113개");
    expect(screen.getByRole("button", { name: "자동 교체 다시 시도" })).toBeDisabled();
  });

  it("보관·교체된 세트의 오래된 항목이 남아 있으면 안내하고 다시 시도로 정리한다", async () => {
    summary.mockResolvedValueOnce({ ...data, openTotal: 0, openInMockSet: 0, staleOpen: 2, cells: [], sets: [], items: [], replacements: [] });
    summary.mockResolvedValue({ ...data, openTotal: 0, openInMockSet: 0, staleOpen: 0, cells: [], sets: [], items: [], replacements: [] });
    retry.mockResolvedValue({ replaced: 0, noSpare: 0, setStarted: 0, closedStale: 2 });
    render(<ReplacementNeedsBlock poolRest={{}} />);
    await waitFor(() => expect(screen.getByTestId("replacement-stale")).toHaveTextContent("오래된 항목 2건은 경보에서 제외"));
    const btn = screen.getByRole("button", { name: "자동 교체 다시 시도" });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("오래된 항목 2건 정리"));
    await waitFor(() => expect(screen.queryByTestId("replacement-stale")).toBeNull());
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

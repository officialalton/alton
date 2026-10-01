import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pool = vi.fn();
vi.mock("../mock-exam-actions", () => ({
  getMockExamPoolSummaryAction: () => pool(),
  assembleMockExamSet: vi.fn(), archiveMockExamSetAction: vi.fn(), getMockExamSetContentAction: vi.fn(),
  getMockExamSetItems: vi.fn(), listMockExamSets: vi.fn(async () => []), publishMockExamSet: vi.fn(),
  listAllMockExamAttemptsAction: vi.fn(async () => []),
}));

import MockExamSetsPanel from "./MockExamSetsPanel";

const row = (o: object) => ({ satDomain: "algebra", skillCode: null, mockExam: 0, both: 0, general: 0, assignedPublished: 0, assignedDraft: 0, ...o });

describe("MockExamSetsPanel 문항 풀 탭", () => {
  beforeEach(() => pool.mockReset());
  afterEach(cleanup);

  it("생성 탭에는 풀 블록이 없고, 문항 풀 서브탭이 생성 다음에 있다", () => {
    render(<MockExamSetsPanel initialSets={[]} />);
    const tabs = screen.getAllByRole("button").map((b) => b.textContent);
    expect(tabs.slice(0, 2)).toEqual(["생성", "문항 풀"]);
    expect(screen.queryByTestId("mock-pool-summary")).toBeNull();
    expect(pool).not.toHaveBeenCalled();
  });

  it("배정·남음 열과 합계 행을 보여준다", async () => {
    pool.mockResolvedValue([
      row({ skillCode: "linear_equations_one_var", mockExam: 10, both: 2, assignedPublished: 5, assignedDraft: 3, general: 4 }),
      row({ satDomain: "geometry_trig", skillCode: "circles", mockExam: 6, assignedPublished: 6 }),
    ]);
    render(<MockExamSetsPanel initialSets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "문항 풀" }));
    await waitFor(() => expect(screen.getByTestId("mock-pool-header")).toBeTruthy());
    expect(screen.getByTestId("mock-pool-header").textContent).toBe("풀 18 · 배정 14 · 남음 4 · 일반용(제외) 4");
    const total = within(screen.getByTestId("mock-pool-total")).getAllByRole("cell").map((c) => c.textContent);
    expect(total).toEqual(["합계", "18", "11", "3", "4", "4"]);
    expect(screen.getByText("(기존 2)")).toBeTruthy();
  });

  it("빈 상태", async () => {
    pool.mockResolvedValue([]);
    render(<MockExamSetsPanel initialSets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "문항 풀" }));
    await waitFor(() => expect(screen.getByText("공개된 문항이 없습니다.")).toBeTruthy());
  });
});

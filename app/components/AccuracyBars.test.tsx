import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccuracyBarList, accuracyTone } from "./AccuracyBars";

afterEach(cleanup);
describe("accuracyTone 색 눈금", () => {
  it("<40 빨강, 40~70 노랑, >70 초록, 0문항 회색", () => {
    expect(accuracyTone(1, 5)).toBe("red"); expect(accuracyTone(2, 5)).toBe("amber"); expect(accuracyTone(7, 10)).toBe("amber"); expect(accuracyTone(8, 10)).toBe("green"); expect(accuracyTone(0, 0)).toBe("none");
    expect(accuracyTone(0, 4)).toBe("red"); expect(accuracyTone(4, 4)).toBe("green");
  });
});
describe("AccuracyBarList", () => {
  const rows = [{ key: "a", label: "Algebra", correct: 3, total: 10 }, { key: "b", label: "Geometry", correct: 9, total: 10 }, { key: "c", label: "Stats", correct: 1, total: 2 }, { key: "d", label: "None", correct: 0, total: 0 }];
  it("n/m (p%) 글자·상태 글자·meter 를 같이 보이고(색만 쓰지 않음), 표본이 적으면 흐리게 'few questions'", () => {
    render(<AccuracyBarList rows={rows} />);
    expect(screen.getByText("3/10 (30%)")).toBeInTheDocument(); expect(screen.getByText("9/10 (90%)")).toBeInTheDocument();
    expect(screen.getByText("Needs work")).toBeInTheDocument(); expect(screen.getByText("Strong")).toBeInTheDocument(); expect(screen.getByText("No data")).toBeInTheDocument();
    expect(screen.getAllByRole("meter")[0]).toHaveAttribute("aria-valuenow", "30");
    expect(screen.getAllByTestId("few-questions")).toHaveLength(1); // total 2 만(0문항은 데이터 없음)
    expect(screen.getByText("few questions (n=2)")).toBeInTheDocument();
    const li = screen.getByText("Stats").closest("li")!; expect(li).toHaveAttribute("data-low-sample", "true");
  });
  it("설명 팝오버 버튼(onInfo)과 첫 행 강조", () => {
    const onInfo = vi.fn(); render(<AccuracyBarList rows={rows} onInfo={onInfo} highlightFirst />);
    screen.getByRole("button", { name: "Algebra" }).click(); expect(onInfo).toHaveBeenCalledWith(rows[0]);
    expect(screen.getByText("Algebra").closest("li")!.className).toMatch(/border-red/);
  });
});

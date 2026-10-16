import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FrqHandwritingPad from "./FrqHandwritingPad";

const ctx = { clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as never;
});

describe("FRQ 패드 배경", () => {
  it("선택기는 6개 프리셋을 보여주고 변경을 알린다", () => {
    const onBg = vi.fn();
    render(<FrqHandwritingPad label="a" strokes={[]} height={500} background="blank" onChange={() => {}} onHeightChange={() => {}} onBackgroundChange={onBg} />);
    const sel = screen.getByTestId("frq-bg-a") as HTMLSelectElement;
    expect(Array.from(sel.options).map((o) => o.text)).toEqual(["Blank", "Grid", "Axes", "Axes + grid", "Two-panel axes", "Number line"]);
    fireEvent.change(sel, { target: { value: "axes" } });
    expect(onBg).toHaveBeenCalledWith("axes");
  });
  it("Blank 는 선을 그리지 않고, Axes 는 획이 없어도 배경 선을 그린다", () => {
    const { rerender } = render(<FrqHandwritingPad label="a" strokes={[]} height={500} background="blank" onChange={() => {}} onHeightChange={() => {}} />);
    expect(ctx.stroke).not.toHaveBeenCalled();
    rerender(<FrqHandwritingPad label="a" strokes={[]} height={500} background="axes" onChange={() => {}} onHeightChange={() => {}} />);
    expect(ctx.stroke.mock.calls.length).toBeGreaterThan(5);
  });
  it("전체 지우기는 획만 지우고 배경은 유지(다시 그릴 때 배경 선 포함)", () => {
    const onChange = vi.fn();
    render(<FrqHandwritingPad label="a" strokes={[{ c: 0, p: [10, 10, 40, 40] }]} height={500} background="grid" onChange={onChange} onHeightChange={() => {}} onBackgroundChange={() => {}} />);
    ctx.stroke.mockClear();
    fireEvent.click(screen.getByTestId("frq-clear-a"));
    expect(onChange).toHaveBeenCalledWith([]);
    expect(ctx.stroke.mock.calls.length).toBeGreaterThan(10);
  });
});

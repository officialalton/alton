import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FrqHandwritingPad from "./FrqHandwritingPad";
import { boardTouchClass, touchDrawBlocked } from "./BoardSizeControls";

afterEach(cleanup);

describe("Draw/Scroll 터치 모드", () => {
  it("순수 규칙: scroll 이면 pan-y 이고 손가락만 막는다(펜·마우스는 그대로)", () => {
    expect(boardTouchClass("draw")).toBe("touch-none");
    expect(boardTouchClass("scroll")).toBe("touch-pan-y");
    expect(touchDrawBlocked("scroll", "touch")).toBe(true);
    expect(touchDrawBlocked("scroll", "pen")).toBe(false);
    expect(touchDrawBlocked("scroll", "mouse")).toBe(false);
    expect(touchDrawBlocked("draw", "touch")).toBe(false);
  });
  it("FRQ 패드: Scroll page 를 누르면 캔버스가 pan-y 가 되고 손가락 획이 생기지 않으며, Draw 로 되돌리면 다시 그려진다", () => {
    const onChange = vi.fn();
    render(<FrqHandwritingPad label="a" strokes={[]} height={500} onChange={onChange} onHeightChange={() => {}} />);
    const canvas = screen.getByTestId("frq-canvas-a");
    const group = screen.getByTestId("frq-touch-mode-a");
    expect(group.className).toContain("md:hidden");
    expect(screen.getByRole("button", { name: "Draw" })).toHaveAttribute("aria-pressed", "true");
    expect(canvas.className).toContain("touch-none");
    fireEvent.click(screen.getByRole("button", { name: "Scroll page" }));
    expect(canvas.className).toContain("touch-pan-y");
    expect(screen.getByRole("button", { name: "Scroll page" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1, pointerType: "touch" });
    fireEvent.pointerMove(canvas, { clientX: 80, clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Draw" }));
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1, pointerType: "touch" });
    fireEvent.pointerMove(canvas, { clientX: 80, clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

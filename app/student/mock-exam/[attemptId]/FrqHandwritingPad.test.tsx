import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import FrqHandwritingPad from "./FrqHandwritingPad";
import type { InkStroke } from "@/lib/ap-exam/frq-ink";

afterEach(cleanup);

const S: InkStroke[] = [{ c: 0, p: [10, 10, 100, 200] }];

function Harness({ initialH = 500, onStrokes = vi.fn(), onHeight = vi.fn() }: { initialH?: number; onStrokes?: (s: InkStroke[]) => void; onHeight?: (h: number) => void }) {
  const [strokes, setStrokes] = useState<InkStroke[]>(S);
  const [h, setH] = useState(initialH);
  return <FrqHandwritingPad label="a" strokes={strokes} height={h} onChange={(n) => { setStrokes(n); onStrokes(n); }} onHeightChange={(x) => { setH(x); onHeight(x); }} />;
}
const canvas = () => screen.getByTestId("frq-canvas-a") as HTMLCanvasElement;

describe("FrqHandwritingPad", () => {
  it("펜·지우개·색·되돌리기·지우기 컨트롤과 모바일 터치 처리(캔버스 touch-none, 스크롤 띠 pan-y)", () => {
    render(<Harness />);
    for (const n of ["Pen", "Eraser", "Black pen", "Red pen", "Blue pen"]) expect(screen.getByRole("button", { name: n })).toBeInTheDocument();
    expect(screen.getByTestId("frq-undo-a")).toBeInTheDocument();
    expect(screen.getByTestId("frq-clear-a")).toBeInTheDocument();
    expect(canvas().className).toContain("touch-none");
    expect(screen.getByTestId("frq-scroll-gutter-a").className).toContain("touch-pan-y");
  });
  it("포인터로 그리면 단순화된 정수 획 하나가 추가되고 되돌리기로 사라진다", () => {
    const onStrokes = vi.fn();
    render(<Harness onStrokes={onStrokes} />);
    fireEvent.pointerDown(canvas(), { clientX: 20, clientY: 30, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerMove(canvas(), { clientX: 60, clientY: 70, pointerId: 1 });
    fireEvent.pointerMove(canvas(), { clientX: 120, clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    const last = onStrokes.mock.calls.at(-1)?.[0] as InkStroke[];
    expect(last).toHaveLength(2);
    expect(last[0]).toEqual(S[0]);
    expect(last[1].c).toBe(0);
    expect(last[1].p.every(Number.isInteger)).toBe(true);
    fireEvent.click(screen.getByTestId("frq-undo-a"));
    expect((onStrokes.mock.calls.at(-1)?.[0] as InkStroke[])).toEqual(S);
  });
  it("터치 중 스타일러스를 쓰면 이후 손바닥(touch) 접촉은 무시", () => {
    const onStrokes = vi.fn();
    render(<Harness onStrokes={onStrokes} />);
    fireEvent.pointerDown(canvas(), { clientX: 5, clientY: 5, pointerId: 1, pointerType: "pen" });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    onStrokes.mockClear();
    fireEvent.pointerDown(canvas(), { clientX: 50, clientY: 50, pointerId: 2, pointerType: "touch" });
    fireEvent.pointerMove(canvas(), { clientX: 90, clientY: 90, pointerId: 2 });
    fireEvent.pointerUp(canvas(), { pointerId: 2 });
    expect(onStrokes).not.toHaveBeenCalled();
  });
  it("크기 프리셋·+/− 버튼으로 높이를 바꾸고, 획은 그대로(onChange 없음)", () => {
    const onHeight = vi.fn(); const onStrokes = vi.fn();
    render(<Harness onHeight={onHeight} onStrokes={onStrokes} />);
    fireEvent.click(screen.getByTestId("frq-size-a-1200"));
    expect(onHeight).toHaveBeenLastCalledWith(1200);
    expect(canvas().height).toBe(1200);
    expect(canvas().style.aspectRatio).toBe("800 / 1200");
    fireEvent.click(screen.getByRole("button", { name: "Larger board" }));
    expect(onHeight).toHaveBeenLastCalledWith(1300);
    fireEvent.click(screen.getByRole("button", { name: "Smaller board" }));
    expect(onHeight).toHaveBeenLastCalledWith(1200);
    expect(onStrokes).not.toHaveBeenCalled(); // 크기 변경은 획을 건드리지 않는다
  });
  it("키보드: 슬라이더 화살표/PageUp·Down 으로 조절, 상한·획 아래 하한 고정", () => {
    const onHeight = vi.fn();
    render(<Harness onHeight={onHeight} initialH={1580} />);
    const h = screen.getByRole("slider");
    h.focus();
    expect(h).toHaveAttribute("aria-valuenow", "1580");
    fireEvent.keyDown(h, { key: "ArrowDown" });
    expect(onHeight).toHaveBeenLastCalledWith(1600); // 상한
    fireEvent.keyDown(h, { key: "PageUp" });
    expect(onHeight).toHaveBeenLastCalledWith(1400);
    for (let i = 0; i < 40; i++) fireEvent.keyDown(h, { key: "ArrowUp" });
    expect(h.getAttribute("aria-valuenow")).toBe("300"); // 획(y=200) 아래 하한 = 300
  });
  it("드래그 핸들로 연속 조절(화면 픽셀 → 논리 좌표)", () => {
    const onHeight = vi.fn();
    render(<Harness onHeight={onHeight} />);
    const h = screen.getByRole("slider");
    fireEvent.pointerDown(h, { clientY: 100, pointerId: 3 });
    fireEvent.pointerMove(h, { clientY: 250, pointerId: 3 });
    fireEvent.pointerUp(h, { pointerId: 3 });
    expect(onHeight).toHaveBeenLastCalledWith(650); // jsdom 폭 0 → 800 기준 1:1, 500+150
  });
  it("잠금(disabled)이면 그려지지 않고 크기 버튼도 비활성", () => {
    const onStrokes = vi.fn();
    render(<FrqHandwritingPad label="a" strokes={[]} height={500} disabled onChange={onStrokes} onHeightChange={vi.fn()} />);
    fireEvent.pointerDown(canvas(), { clientX: 1, clientY: 1, pointerId: 1 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    expect(onStrokes).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Larger board" })).toBeDisabled();
  });
});

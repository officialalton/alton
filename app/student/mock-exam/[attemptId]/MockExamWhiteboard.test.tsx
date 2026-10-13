import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StrokeSegment } from "@/lib/problem-notes-actions";

const loadMock = vi.fn();
const saveMock = vi.fn();
vi.mock("@/lib/problem-notes-actions", () => ({
  loadProblemNoteBoardAction: (...a: unknown[]) => loadMock(...a),
  saveProblemNoteBoardAction: (...a: unknown[]) => saveMock(...a),
}));

import MockExamWhiteboard, { eraseNear } from "./MockExamWhiteboard";

const seg = (x0: number, y0: number, x1: number, y1: number): StrokeSegment => ({ x0, y0, x1, y1, color: "#111111", w: 640 });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  loadMock.mockResolvedValue({ strokes: [], boardHeight: 480 });
  saveMock.mockResolvedValue({ ok: true });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
    canvas: { width: 640, height: 480 },
  })) as never;
});

describe("eraseNear", () => {
  it("반경 안을 지나는 선분만 지운다", () => {
    const list = [seg(0, 0, 10, 0), seg(100, 100, 120, 100)];
    expect(eraseNear(list, 5, 3)).toEqual([list[1]]);
    expect(eraseNear(list, 300, 300)).toEqual(list);
  });
});

describe("MockExamWhiteboard", () => {
  it("그린 뒤 디바운스로 저장하고, 지우기는 빈 배열을 저장한다", async () => {
    vi.useFakeTimers();
    render(<MockExamWhiteboard attemptId="a1" itemId="i1" onClose={() => {}} />);
    await act(async () => {
      await Promise.resolve();
    });
    const canvas = screen.getByLabelText("Scratch canvas");
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 480, right: 640, bottom: 480, x: 0, y: 0, toJSON() {} }) as DOMRect;
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20 });
    fireEvent.pointerUp(canvas);
    // 획을 마치면 디바운스를 기다리지 않고 바로 저장한다(직후 모듈 제출로 마지막 획이 사라지지 않게).
    await act(async () => {});
    expect(saveMock).toHaveBeenCalledTimes(1);
    const [ctx, target, item, strokes, h] = saveMock.mock.calls[0];
    expect(h).toBe(480);
    expect([ctx, target, item]).toEqual(["mock_exam", "a1", "i1"]);
    expect(strokes).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(saveMock).toHaveBeenLastCalledWith("mock_exam", "a1", "i1", [], 480);
  });

  it("잠금이면 도구가 없고 그려도 저장하지 않는다", async () => {
    render(<MockExamWhiteboard attemptId="a1" itemId="i1" locked onClose={() => {}} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole("button", { name: "Pen" })).toBeNull();
    const canvas = screen.getByLabelText("Scratch canvas");
    fireEvent.pointerDown(canvas, { clientX: 1, clientY: 1 });
    fireEvent.pointerMove(canvas, { clientX: 9, clientY: 9 });
    expect(saveMock).not.toHaveBeenCalled();
  });

  async function mount(board: { strokes: StrokeSegment[]; boardHeight: number }, locked = false) {
    loadMock.mockResolvedValue(board);
    render(<MockExamWhiteboard attemptId="a1" itemId="i1" locked={locked} onClose={() => {}} />);
    await act(async () => { await Promise.resolve(); });
    return screen.getByTestId("wb-canvas") as HTMLCanvasElement;
  }

  it("저장된 보드 높이를 복원하고 논리 폭 640 은 유지한다", async () => {
    const c = await mount({ strokes: [], boardHeight: 1000 });
    expect(c.width).toBe(640);
    expect(c.height).toBe(1000);
    expect(c.style.aspectRatio).toBe("640 / 1000");
    expect(screen.getByTestId("wb-size-1000")).toHaveAttribute("aria-pressed", "true");
  });

  it("크기 변경은 선분 좌표를 바꾸지 않고 높이와 함께 저장한다(프리셋·+/−·키보드·드래그)", async () => {
    vi.useFakeTimers();
    const kept = [seg(10, 10, 50, 400)];
    const c = await mount({ strokes: kept, boardHeight: 480 });
    fireEvent.click(screen.getByTestId("wb-size-1400"));
    expect(c.height).toBe(1400);
    fireEvent.click(screen.getByRole("button", { name: "Smaller board" }));
    expect(c.height).toBe(1300);
    const slider = screen.getByRole("slider", { name: "Whiteboard height" });
    fireEvent.keyDown(slider, { key: "PageUp" });
    expect(c.height).toBe(1100);
    fireEvent.keyDown(slider, { key: "ArrowDown" });
    expect(c.height).toBe(1150);
    fireEvent.pointerDown(slider, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(slider, { clientY: 160, pointerId: 1 }); // jsdom 폭 0 → 논리 1:1
    fireEvent.pointerUp(slider, { pointerId: 1 });
    expect(c.height).toBe(1210);
    await act(async () => { vi.advanceTimersByTime(900); });
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenLastCalledWith("mock_exam", "a1", "i1", kept, 1210);
  });

  it("상한 1600·하한 480, 그린 곳(maxY+10) 아래로는 줄지 않는다", async () => {
    const c = await mount({ strokes: [seg(0, 0, 10, 700)], boardHeight: 1500 });
    const slider = screen.getByRole("slider", { name: "Whiteboard height" });
    for (let i = 0; i < 5; i++) fireEvent.keyDown(slider, { key: "ArrowDown" });
    expect(c.height).toBe(1600);
    for (let i = 0; i < 60; i++) fireEvent.keyDown(slider, { key: "ArrowUp" });
    expect(c.height).toBe(710);
  });

  it("큰 보드에서도 그린 점은 논리 좌표(640×높이)로 환산된다", async () => {
    const c = await mount({ strokes: [], boardHeight: 1000 });
    c.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 500, right: 320, bottom: 500, x: 0, y: 0, toJSON() {} }) as DOMRect;
    fireEvent.pointerDown(c, { clientX: 10, clientY: 100, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerMove(c, { clientX: 20, clientY: 250, pointerId: 1 });
    fireEvent.pointerUp(c, { pointerId: 1 });
    await act(async () => {});
    const strokes = saveMock.mock.calls[0][3] as StrokeSegment[];
    expect(strokes[0]).toMatchObject({ x0: 20, y0: 200, x1: 40, y1: 500, w: 640 });
    expect(saveMock.mock.calls[0][4]).toBe(1000);
  });

  it("모바일: 캔버스는 touch-none, 오른쪽 띠는 touch-pan-y", async () => {
    const c = await mount({ strokes: [], boardHeight: 480 });
    expect(c.className).toContain("touch-none");
    expect(screen.getByTestId("wb-scroll-gutter").className).toContain("touch-pan-y");
  });

  it("잠금이면 크기 컨트롤도 없고 저장된 높이로 읽기만 한다", async () => {
    const c = await mount({ strokes: [], boardHeight: 800 }, true);
    expect(c.height).toBe(800);
    expect(screen.queryByTestId("wb-size")).toBeNull();
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("스타일러스 사용 중 손바닥 touch 는 무시", async () => {
    const c = await mount({ strokes: [], boardHeight: 480 });
    fireEvent.pointerDown(c, { clientX: 5, clientY: 5, pointerId: 1, pointerType: "pen" });
    fireEvent.pointerUp(c, { pointerId: 1 });
    saveMock.mockClear();
    fireEvent.pointerDown(c, { clientX: 50, clientY: 50, pointerId: 2, pointerType: "touch" });
    fireEvent.pointerMove(c, { clientX: 90, clientY: 90, pointerId: 2 });
    fireEvent.pointerUp(c, { pointerId: 2 });
    await act(async () => {});
    expect(saveMock).not.toHaveBeenCalled();
  });
  it("Scroll page 모드: 캔버스 pan-y, 손가락 획 무시, Draw 로 복귀", async () => {
    const c = await mount({ strokes: [], boardHeight: 480 });
    expect(screen.getByTestId("wb-touch-mode").className).toContain("md:hidden");
    fireEvent.click(screen.getByRole("button", { name: "Scroll page" }));
    expect(c.className).toContain("touch-pan-y");
    fireEvent.pointerDown(c, { clientX: 50, clientY: 50, pointerId: 3, pointerType: "touch" });
    fireEvent.pointerMove(c, { clientX: 90, clientY: 90, pointerId: 3 });
    fireEvent.pointerUp(c, { pointerId: 3 });
    await act(async () => {});
    expect(saveMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Draw" }));
    expect(c.className).toContain("touch-none");
  });
});

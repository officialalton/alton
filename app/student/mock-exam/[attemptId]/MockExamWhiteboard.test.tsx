import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StrokeSegment } from "@/lib/problem-notes-actions";

const loadMock = vi.fn();
const saveMock = vi.fn();
vi.mock("@/lib/problem-notes-actions", () => ({
  loadProblemNoteStrokesAction: (...a: unknown[]) => loadMock(...a),
  saveProblemNoteStrokesAction: (...a: unknown[]) => saveMock(...a),
}));

import MockExamWhiteboard, { eraseNear } from "./MockExamWhiteboard";

const seg = (x0: number, y0: number, x1: number, y1: number): StrokeSegment => ({ x0, y0, x1, y1, color: "#111111", w: 640 });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  loadMock.mockResolvedValue([]);
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
    const [ctx, target, item, strokes] = saveMock.mock.calls[0];
    expect([ctx, target, item]).toEqual(["mock_exam", "a1", "i1"]);
    expect(strokes).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(saveMock).toHaveBeenLastCalledWith("mock_exam", "a1", "i1", []);
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
});

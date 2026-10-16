import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadMock = vi.fn();
const saveMock = vi.fn();
vi.mock("@/lib/problem-notes-actions", () => ({
  loadProblemNoteBoardAction: (...a: unknown[]) => loadMock(...a),
  saveProblemNoteBoardAction: (...a: unknown[]) => saveMock(...a),
}));

import ProblemNoteCanvas from "./ProblemNoteCanvas";

// 레거시 640×220 캔버스가 저장한 실제 형식(w=640 기준 선분) 고정 fixture.
const LEGACY = [
  { x0: 12.5, y0: 30, x1: 40.25, y1: 52, color: "#e11d48", w: 640 },
  { x0: 40.25, y0: 52, x1: 100, y1: 200, color: "#e11d48", w: 640 },
];
const ctx = { clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), canvas: { width: 640, height: 480 }, strokeStyle: "", lineWidth: 0, lineCap: "" };
const rect = { left: 0, top: 0, width: 640, height: 480, right: 640, bottom: 480, x: 0, y: 0, toJSON() {} } as DOMRect;

async function open(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  vi.clearAllMocks();
  loadMock.mockResolvedValue({ strokes: LEGACY, boardHeight: 480 });
  saveMock.mockResolvedValue({ ok: true });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as never;
});

describe("ProblemNoteCanvas → 공유 보드 어댑터", () => {
  it("교사·보호자 읽기: authorId 로 불러오고, 저장된 w=640 선분을 같은 좌표(축척 1)로 그리며, 쓰기 UI·저장은 없다", async () => {
    const { unmount } = render(<ProblemNoteCanvas context="homework" targetId="batch1" itemId="p1" authorId="stu1" readOnly />);
    await open("View whiteboard");
    expect(loadMock).toHaveBeenCalledWith("homework", "batch1", "p1", "stu1");
    expect(ctx.moveTo).toHaveBeenCalledWith(12.5, 30);
    expect(ctx.lineTo).toHaveBeenCalledWith(40.25, 52);
    expect(ctx.moveTo).toHaveBeenCalledWith(40.25, 52);
    expect(ctx.lineTo).toHaveBeenCalledWith(100, 200);
    expect(screen.queryByRole("button", { name: "Pen" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Eraser" })).toBeNull();
    const canvas = screen.getByTestId("wb-canvas");
    canvas.getBoundingClientRect = () => rect;
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 50 });
    fireEvent.pointerUp(canvas);
    unmount();
    expect(saveMock).not.toHaveBeenCalled();
  });
  it("학생 쓰기: 기존 필기를 보존한 채 새 선분을 w=640 으로 이어 저장한다(문맥 유지)", async () => {
    render(<ProblemNoteCanvas context="problem" targetId="sess1" itemId="p9" />);
    await open("📝 Whiteboard");
    expect(loadMock).toHaveBeenCalledWith("problem", "sess1", "p9", undefined);
    const canvas = screen.getByTestId("wb-canvas");
    canvas.getBoundingClientRect = () => rect;
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20 });
    fireEvent.pointerUp(canvas);
    await act(async () => { await Promise.resolve(); });
    expect(saveMock).toHaveBeenCalledTimes(1);
    const [context, target, item, strokes, height] = saveMock.mock.calls[0];
    expect([context, target, item, height]).toEqual(["problem", "sess1", "p9", 480]);
    expect(strokes.slice(0, 2)).toEqual(LEGACY);
    expect(strokes[2]).toMatchObject({ x0: 10, y0: 10, x1: 20, y1: 20, w: 640 });
  });
});

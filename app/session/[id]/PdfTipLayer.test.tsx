import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import PdfTipLayer, { type PdfTipLayerHandle } from "./PdfTipLayer";
import * as tipActions from "./pdf-tip-actions";

vi.mock("./pdf-tip-actions", () => ({
  loadPdfTipStrokes: vi.fn(async () => []),
  appendPdfTipEvents: vi.fn(async ({ segments }: { segments: { eventId?: string }[] }) => ({
    savedEventIds: segments.map((s) => s.eventId as string),
  })),
}));

const memory = new Map<string, string>();
beforeEach(() => {
  vi.clearAllMocks();
  memory.clear();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
      removeItem: (k: string) => void memory.delete(k),
    },
  });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    lineCap: "", lineWidth: 0, strokeStyle: "", globalCompositeOperation: "",
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), clearRect: vi.fn(), fillText: vi.fn(),
    fillStyle: "", font: "", textBaseline: "",
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 600, height: 800, right: 600, bottom: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
});

async function drawOne() {
  const input = screen.getByTestId("pdf-tip-input-layer");
  fireEvent.pointerDown(input, { clientX: 10, clientY: 10 });
  fireEvent.pointerMove(input, { clientX: 15, clientY: 15 });
  fireEvent.pointerUp(input);
}

describe("교사용 팁 레이어", () => {
  it("읽기 전용은 쪽당 한 번만 조회하고 입력 캔버스·도구 막대가 없으며 클릭을 통과시킨다", async () => {
    render(<PdfTipLayer versionId="v1" page={2} mode="view" width={600} height={800} />);
    await waitFor(() => expect(tipActions.loadPdfTipStrokes).toHaveBeenCalledTimes(1));
    expect(tipActions.loadPdfTipStrokes).toHaveBeenCalledWith("v1", 2);
    expect(screen.queryByTestId("pdf-tip-input-layer")).toBeNull();
    expect(screen.queryByTestId("pdf-tip-toolbar")).toBeNull();
    expect(screen.getByTestId("pdf-tip-layer-root").className).toContain("pointer-events-none");
    expect(screen.getByTestId("pdf-tip-layer").className).toContain("pointer-events-none");
    expect(tipActions.appendPdfTipEvents).not.toHaveBeenCalled();
  });

  it("편집: 로딩 → 빈 안내, 쓰기 시작 후 획이 eventId 와 함께 저장된다", async () => {
    render(<PdfTipLayer versionId="v1" page={1} mode="edit" viewerUserId="admin1" width={600} height={800} />);
    expect(screen.getByRole("button", { name: "Loading tips…" })).toBeDisabled();
    expect(await screen.findByTestId("pdf-tip-empty")).toHaveTextContent("No tips on this page.");
    fireEvent.click(await screen.findByRole("button", { name: "✏️ Start writing tips" }));
    await drawOne();
    await waitFor(() => expect(tipActions.appendPdfTipEvents).toHaveBeenCalledTimes(1), { timeout: 2000 });
    const call = vi.mocked(tipActions.appendPdfTipEvents).mock.calls[0][0];
    expect(call.versionId).toBe("v1");
    expect(call.pageNumber).toBe(1);
    expect(call.segments[0].eventId).toMatch(/[0-9a-f-]{36}/);
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("저장이 실패하면 '저장 안 됨'과 다시 시도가 보이고, 재시도는 같은 eventId 로 다시 보낸다(중복 방지)", async () => {
    vi.mocked(tipActions.appendPdfTipEvents).mockRejectedValueOnce(new Error("network"));
    const ref = createRef<PdfTipLayerHandle>();
    render(<PdfTipLayer ref={ref} versionId="v1" page={1} mode="edit" viewerUserId="admin1" width={600} height={800} />);
    fireEvent.click(await screen.findByRole("button", { name: "✏️ Start writing tips" }));
    await drawOne();
    await waitFor(() => expect(screen.getByText("Not saved")).toBeInTheDocument(), { timeout: 2000 });
    expect(ref.current?.hasUnsaved()).toBe(true);
    const firstId = vi.mocked(tipActions.appendPdfTipEvents).mock.calls[0][0].segments[0].eventId;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(tipActions.appendPdfTipEvents).toHaveBeenCalledTimes(2));
    expect(vi.mocked(tipActions.appendPdfTipEvents).mock.calls[1][0].segments[0].eventId).toBe(firstId);
    await waitFor(() => expect(ref.current?.hasUnsaved()).toBe(false));
  });

  it("조회 실패면 오류 안내를 보이되 쓰기는 가능하다", async () => {
    vi.mocked(tipActions.loadPdfTipStrokes).mockRejectedValueOnce(new Error("x"));
    render(<PdfTipLayer versionId="v1" page={1} mode="edit" viewerUserId="admin1" width={600} height={800} />);
    expect(await screen.findByTestId("pdf-tip-load-error")).toHaveTextContent("Couldn't load tips.");
    expect(screen.getByRole("button", { name: "✏️ Start writing tips" })).toBeEnabled();
  });
});

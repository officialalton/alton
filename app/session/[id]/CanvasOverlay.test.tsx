import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CanvasOverlay from "./CanvasOverlay";

vi.mock("./canvas-actions", () => ({
  saveCanvasStrokes: vi.fn(),
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: function on() {
        return this;
      },
      subscribe: function subscribe() {
        return this;
      },
      send: vi.fn(),
    }),
    removeChannel: vi.fn(),
  }),
}));

describe("CanvasOverlay", () => {
  it("canDraw이면 필기 툴바가 보이고, 아니면 숨겨진다(읽기전용 뷰어)", () => {
    const { rerender } = render(
      <CanvasOverlay
        sessionId="s1"
        curriculumDocId="doc-1"
        initialStrokes={[]}
        canDraw={false}
      >
        <p>본문 내용</p>
      </CanvasOverlay>
    );
    expect(screen.getByText("본문 내용")).toBeInTheDocument();
    expect(screen.queryByText("✏️ 필기 모드")).not.toBeInTheDocument();

    rerender(
      <CanvasOverlay
        sessionId="s1"
        curriculumDocId="doc-1"
        initialStrokes={[]}
        canDraw={true}
      >
        <p>본문 내용</p>
      </CanvasOverlay>
    );
    expect(screen.getByText("✏️ 필기 모드")).toBeInTheDocument();
  });

  it("필기 모드를 켜면 색상/펜·지우개/전체 지우기 컨트롤이 나타난다", () => {
    render(
      <CanvasOverlay
        sessionId="s1"
        curriculumDocId="doc-1"
        initialStrokes={[]}
        canDraw={true}
      >
        <p>본문</p>
      </CanvasOverlay>
    );
    expect(screen.queryByText("전체 지우기")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("✏️ 필기 모드"));
    expect(screen.getByText("전체 지우기")).toBeInTheDocument();
    expect(screen.getByText("펜")).toBeInTheDocument();
    expect(screen.getByText("지우개")).toBeInTheDocument();
  });
});

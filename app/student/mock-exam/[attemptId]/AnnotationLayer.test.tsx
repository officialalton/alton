import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AnnotationLayer from "./AnnotationLayer";
import type { TextHighlight } from "@/lib/mock-exam/annotation-anchor";

function selectText(node: Node, start: number, end: number) {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

afterEach(() => window.getSelection()?.removeAllRanges());

describe("AnnotationLayer", () => {
  it("하이라이트 모드에서 드래그하면 즉시 칠하고(onChange), 모드가 꺼져 있으면 아무 일도 없다", () => {
    const onChange = vi.fn();
    const { rerender } = render(<AnnotationLayer highlights={[]} onChange={onChange} highlightMode><p>Hello brave world</p></AnnotationLayer>);
    selectText(screen.getByText("Hello brave world").firstChild!, 6, 11);
    fireEvent.mouseUp(screen.getByTestId("annotation-root"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0]).toMatchObject({ start: 6, end: 11, text: "brave" });

    onChange.mockClear();
    rerender(<AnnotationLayer highlights={[]} onChange={onChange}><p>Hello brave world</p></AnnotationLayer>);
    selectText(screen.getByText("Hello brave world").firstChild!, 6, 11);
    fireEvent.mouseUp(screen.getByTestId("annotation-root"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("터치: mouseup 없이 selectionchange 만 와도(선택 핸들 조작) 잠잠해진 뒤 한 번 칠한다", () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      render(<AnnotationLayer highlights={[]} onChange={onChange} highlightMode><p>Hello brave world</p></AnnotationLayer>);
      selectText(screen.getByText("Hello brave world").firstChild!, 6, 11);
      document.dispatchEvent(new Event("selectionchange"));
      selectText(screen.getByText("Hello brave world").firstChild!, 6, 11);
      document.dispatchEvent(new Event("selectionchange"));
      expect(onChange).not.toHaveBeenCalled();
      vi.advanceTimersByTime(600);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0][0]).toMatchObject({ start: 6, end: 11, text: "brave" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("기존 하이라이트를 클릭하면 메모 팝업이 열리고 메모 추가·삭제·하이라이트 제거를 할 수 있다", () => {
    const h: TextHighlight = { id: "h1", start: 6, end: 11, text: "brave" };
    const onChange = vi.fn();
    render(<AnnotationLayer highlights={[h]} onChange={onChange}><p>Hello brave world</p></AnnotationLayer>);
    selectText(screen.getByText("Hello brave world").firstChild!, 8, 8);
    fireEvent.mouseUp(screen.getByTestId("annotation-root"));
    const input = screen.getByLabelText("Note");
    fireEvent.change(input, { target: { value: "key word" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    expect(onChange).toHaveBeenLastCalledWith([{ ...h, note: "key word" }]);

    selectText(screen.getByText("Hello brave world").firstChild!, 8, 8);
    fireEvent.mouseUp(screen.getByTestId("annotation-root"));
    fireEvent.click(screen.getByRole("button", { name: "Remove highlight" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("메모는 120자까지만 입력된다", () => {
    const h: TextHighlight = { id: "h1", start: 0, end: 5, text: "Hello" };
    render(<AnnotationLayer highlights={[h]} onChange={vi.fn()}><p>Hello world</p></AnnotationLayer>);
    selectText(screen.getByText("Hello world").firstChild!, 2, 2);
    fireEvent.mouseUp(screen.getByTestId("annotation-root"));
    expect(screen.getByLabelText("Note")).toHaveAttribute("maxlength", "120");
  });

  it("읽기 전용: 편집 UI 없이 메모 목록과 메모 보기만 된다", () => {
    const h: TextHighlight = { id: "h1", start: 6, end: 11, text: "brave", note: "remember" };
    const onChange = vi.fn();
    render(<AnnotationLayer highlights={[h]} onChange={onChange} readOnly highlightMode><p>Hello brave world</p></AnnotationLayer>);
    expect(screen.getByTestId("annotation-notes")).toHaveTextContent("remember");
    selectText(screen.getByText("Hello brave world").firstChild!, 0, 5);
    fireEvent.mouseUp(screen.getByTestId("annotation-root"));
    expect(onChange).not.toHaveBeenCalled();
    selectText(screen.getByText("Hello brave world").firstChild!, 8, 8);
    fireEvent.mouseUp(screen.getByTestId("annotation-root"));
    expect(screen.getByTestId("annotation-readonly-note")).toHaveTextContent("remember");
    expect(screen.queryByLabelText("Note")).toBeNull();
  });
});

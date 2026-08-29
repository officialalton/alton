import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RichTextEditable from "./RichTextEditable";

describe("RichTextEditable", () => {
  it("초기 HTML을 렌더링한다", () => {
    const { container } = render(
      <RichTextEditable initialHtml="<p>안녕하세요</p>" onChange={vi.fn()} />
    );
    expect(container.querySelector(".rte-editable")?.innerHTML).toBe("<p>안녕하세요</p>");
  });

  it("서식 툴바 버튼들을 보여준다", () => {
    render(<RichTextEditable initialHtml="" onChange={vi.fn()} />);
    ["B", "I", "H2", "H3", "본문", "•목록", "1.목록"].forEach((label) =>
      expect(screen.getByText(label)).toBeInTheDocument()
    );
  });

  it("포커스를 잃으면 현재 내용으로 onChange가 호출된다", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RichTextEditable initialHtml="<p>원본</p>" onChange={onChange} />
    );
    const editable = container.querySelector(".rte-editable") as HTMLDivElement;
    editable.innerHTML = "<p>수정됨</p>";
    fireEvent.blur(editable);
    expect(onChange).toHaveBeenCalledWith("<p>수정됨</p>");
  });

  it("표 삽입 버튼을 누르면 execCommand로 표 HTML을 삽입한다", () => {
    const execCommandSpy = vi.fn();
    document.execCommand = execCommandSpy;
    render(<RichTextEditable initialHtml="" onChange={vi.fn()} />);
    fireEvent.mouseDown(screen.getByText("표"));
    expect(execCommandSpy).toHaveBeenCalledWith(
      "insertHTML",
      false,
      expect.stringContaining("<table")
    );
  });
});

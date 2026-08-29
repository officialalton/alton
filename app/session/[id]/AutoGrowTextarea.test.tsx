import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AutoGrowTextarea from "./AutoGrowTextarea";

describe("AutoGrowTextarea", () => {
  it("입력값을 표시하고 변경 시 onChange를 호출한다", () => {
    const onChange = vi.fn();
    render(<AutoGrowTextarea value="초기값" onChange={onChange} placeholder="입력하세요" />);
    const textarea = screen.getByPlaceholderText("입력하세요") as HTMLTextAreaElement;
    expect(textarea.value).toBe("초기값");
    fireEvent.change(textarea, { target: { value: "새 값" } });
    expect(onChange).toHaveBeenCalledWith("새 값");
  });

  it("내용이 늘어나면 높이를 scrollHeight에 맞춰 늘린다", () => {
    render(<AutoGrowTextarea value="" onChange={vi.fn()} placeholder="입력하세요" />);
    const textarea = screen.getByPlaceholderText("입력하세요") as HTMLTextAreaElement;
    Object.defineProperty(textarea, "scrollHeight", { value: 240, configurable: true });
    fireEvent.change(textarea, { target: { value: "여러 줄\n텍스트\n입니다" } });
    expect(textarea.style.height).toBe("240px");
  });
});

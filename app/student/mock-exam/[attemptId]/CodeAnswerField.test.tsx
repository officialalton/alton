// @vitest-environment jsdom
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CodeAnswerField from "./CodeAnswerField";
import LearningText from "@/app/session/[id]/LearningText";

function Harness({ onBlur = () => {}, initial = "" }: { onBlur?: () => void; initial?: string }) {
  const [v, setV] = useState(initial);
  return <CodeAnswerField id="f" testId="code-field" value={v} onChange={setV} onBlur={onBlur} label="Code for part (a)" />;
}
const field = () => screen.getByTestId("code-field") as HTMLTextAreaElement;

describe("CodeAnswerField — 코드 답안 칸", () => {
  it("맞춤법·자동 고침·자동 대문자 끔, 줄 바꿈 없음, 고정폭, 힌트 연결", () => {
    render(<Harness />);
    expect(field().getAttribute("spellcheck")).toBe("false");
    expect(field().getAttribute("autocapitalize")).toBe("off");
    expect(field().getAttribute("autocorrect")).toBe("off");
    expect(field().getAttribute("wrap")).toBe("off");
    expect(field().className).toContain("font-mono");
    expect(field().className).toContain("whitespace-pre");
    expect(field().getAttribute("aria-describedby")).toBe("f-hint");
    expect(screen.getByTestId("code-field-hint").textContent).toMatch(/Tab indents/);
  });
  it("Tab 은 공백 4칸을 넣고 기본 동작(포커스 이동)을 막는다", () => {
    render(<Harness initial="ab" />);
    field().setSelectionRange(1, 1);
    const notPrevented = fireEvent.keyDown(field(), { key: "Tab" });
    expect(notPrevented).toBe(false);
    expect(field().value).toBe("a    b");
  });
  it("Escape 다음 Tab 은 포커스를 옮기도록 막지 않는다", () => {
    render(<Harness initial="ab" />);
    field().setSelectionRange(1, 1);
    fireEvent.keyDown(field(), { key: "Escape" });
    const notPrevented = fireEvent.keyDown(field(), { key: "Tab" });
    expect(notPrevented).toBe(true);
    expect(field().value).toBe("ab");
    // 한 번 쓴 뒤에는 다시 들여쓰기
    fireEvent.keyDown(field(), { key: "Tab" });
    expect(field().value).toBe("a    b");
  });
  it("Enter 는 들여쓰기를 이어 간다", () => {
    render(<Harness initial={"if (x) {"} />);
    field().setSelectionRange(8, 8);
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(field().value).toBe("if (x) {\n    ");
  });
  it("일반 타이핑과 blur 저장 호출", () => {
    const onBlur = vi.fn();
    render(<Harness onBlur={onBlur} />);
    fireEvent.change(field(), { target: { value: "int x = 1;" } });
    expect(field().value).toBe("int x = 1;");
    fireEvent.blur(field());
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

describe("LearningText — 코드 블록·한 줄 코드 렌더", () => {
  it("줄 번호와 원문 그대로(달러·밑줄·꺾쇠·& 포함), 수식으로 해석하지 않는다", () => {
    const code = ["int a = 1; // $5 and my__var", "if (a < 2 && a > 0) {", "    a ^= 3;", "}"];
    const { container } = render(<LearningText text={"Consider the code.\n```java\n" + code.join("\n") + "\n```\nWhat is a?"} />);
    const block = screen.getByTestId("code-block");
    expect(block.getAttribute("data-language")).toBe("java");
    const lines = screen.getAllByTestId("code-line");
    expect(lines).toHaveLength(4);
    expect(lines.map((l) => l.textContent)).toEqual(code.map((c, i) => `${i + 1}${c}`));
    expect(container.querySelector(".katex")).toBeNull();
    expect(block.querySelector('[aria-hidden="true"]')?.className).toContain("select-none");
    expect(block.className).toContain("overflow-x-auto");
    expect(block.querySelector("code")?.className).toContain("font-mono");
    expect(container.innerHTML).toContain("&lt; 2 &amp;&amp; a &gt; 0");
  });
  it("들여쓰기(앞 공백)를 보존한다", () => {
    render(<LearningText text={"```java\n    a();\n```"} />);
    expect(screen.getByTestId("code-line").textContent).toBe("1    a();");
    expect(screen.getByTestId("code-line").className).toContain("whitespace-pre");
  });
  it("한 줄 코드는 code 요소, 같은 줄의 $수식$ 은 그대로 수식", () => {
    const { container } = render(<LearningText text={"Replace `i <= n` with `i < n` when $x^2$ holds."} />);
    expect(screen.getAllByTestId("code-inline").map((c) => c.textContent)).toEqual(["i <= n", "i < n"]);
    expect(container.querySelector(".katex")).not.toBeNull();
  });
});

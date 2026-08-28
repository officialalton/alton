import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomeworkTab from "./HomeworkTab";
import * as homeworkActions from "./homework-actions";

vi.mock("./homework-actions", () => ({
  saveHomeworkAnswer: vi.fn().mockResolvedValue(undefined),
  addHomeworkItem: vi.fn(),
}));

const items = [
  {
    id: "hw1",
    title: "이차방정식 응용 문제 10선",
    description: "다음 문제를 풀어보세요.",
    studentAnswer: "",
  },
];

describe("HomeworkTab", () => {
  it("배정된 과제가 없으면 안내 문구를 보여준다", () => {
    render(
      <HomeworkTab sessionId="s1" initialItems={[]} viewerRole="student" />
    );
    expect(screen.getByText("배정된 과제가 없습니다.")).toBeInTheDocument();
  });

  it("학생은 답안을 입력하고 포커스를 벗어나면 저장된다", async () => {
    render(
      <HomeworkTab sessionId="s1" initialItems={items} viewerRole="student" />
    );
    const textarea = screen.getByPlaceholderText("답안을 작성하세요");
    fireEvent.change(textarea, { target: { value: "2번, 5번이 헷갈렸어요" } });
    fireEvent.blur(textarea);
    await waitFor(() =>
      expect(homeworkActions.saveHomeworkAnswer).toHaveBeenCalledWith(
        "hw1",
        "2번, 5번이 헷갈렸어요"
      )
    );
  });

  it("선생님은 학생 제출 답안을 읽기전용으로 보고, 미제출이면 안내문구를 본다", () => {
    render(
      <HomeworkTab sessionId="s1" initialItems={items} viewerRole="teacher" />
    );
    expect(screen.getByText("아직 제출하지 않았습니다.")).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("답안을 작성하세요")
    ).not.toBeInTheDocument();
  });

  it("선생님은 '+ 과제 추가'로 새 과제를 만들 수 있고, 학생에게는 그 버튼이 없다", async () => {
    vi.mocked(homeworkActions.addHomeworkItem).mockResolvedValue({
      id: "hw2",
      title: "새 과제",
      description: null,
      studentAnswer: null,
    });

    render(
      <HomeworkTab sessionId="s1" initialItems={[]} viewerRole="teacher" />
    );
    expect(screen.queryByText("이 세션에는")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("+ 과제 추가"));
    fireEvent.change(screen.getByPlaceholderText("과제 제목"), {
      target: { value: "새 과제" },
    });
    fireEvent.click(screen.getByText("추가하기"));

    await waitFor(() =>
      expect(homeworkActions.addHomeworkItem).toHaveBeenCalledWith(
        "s1",
        "새 과제",
        ""
      )
    );
    await waitFor(() =>
      expect(screen.getByText("새 과제")).toBeInTheDocument()
    );
  });

  it("학생 화면에는 과제 추가 버튼이 없다", () => {
    render(
      <HomeworkTab sessionId="s1" initialItems={items} viewerRole="student" />
    );
    expect(screen.queryByText("+ 과제 추가")).not.toBeInTheDocument();
  });
});

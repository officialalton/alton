import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LibraryDocView from "./LibraryDocView";
import type { LibraryDocDetail } from "@/app/student/materials-data";

const doc: LibraryDocDetail = {
  id: "doc1",
  title: "이차방정식 개념 정리",
  sections: [
    {
      id: "sec1",
      title: "Lesson Overview",
      body: "<p>판별식을 이용하면 실근의 개수를 알 수 있습니다.</p>",
      problems: [
        {
          id: "p1",
          format: "mc",
          passage: "판별식이 0이면?",
          options: ["서로 다른 두 실근", "중근"],
          correctIndex: 1,
          explanation: "D=0이면 중근을 가집니다.",
          difficulty: "easy",
          skillType: "개념 문제",
        },
      ],
    },
  ],
};

describe("LibraryDocView", () => {
  it("제목, 목차, 본문을 보여준다", () => {
    render(<LibraryDocView doc={doc} />);
    expect(screen.getByText("이차방정식 개념 정리")).toBeInTheDocument();
    expect(screen.getByText("목차")).toBeInTheDocument();
    expect(
      screen.getByText(/판별식을 이용하면 실근의 개수를 알 수 있습니다/)
    ).toBeInTheDocument();
  });

  it("문제는 정답이 바로 보이는 읽기 전용으로 렌더링된다(제출 버튼 없음)", () => {
    render(<LibraryDocView doc={doc} />);
    expect(screen.getByText("판별식이 0이면?")).toBeInTheDocument();
    expect(screen.getByText("D=0이면 중근을 가집니다.")).toBeInTheDocument();
    expect(screen.queryByText("채점하기")).not.toBeInTheDocument();
    expect(screen.queryByText("제출하기")).not.toBeInTheDocument();
  });
});

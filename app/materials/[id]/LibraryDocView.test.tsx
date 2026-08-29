import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LibraryDocView from "./LibraryDocView";
import * as problemlogActions from "@/app/session/[id]/problemlog-actions";
import type { LibraryDocDetail } from "@/app/student/materials-data";

vi.mock("@/app/session/[id]/problemlog-actions", () => ({
  retryMcAttempt: vi.fn(),
  retryEssayAttempt: vi.fn(),
  retryMathAttempt: vi.fn(),
}));

const doc: LibraryDocDetail = {
  id: "doc1",
  title: "이차방정식 개념 정리",
  sections: [
    {
      id: "sec1",
      title: "Lesson Overview",
      body: "<p>판별식을 이용하면 실근의 개수를 알 수 있습니다.</p>",
      teachingTip: null,
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
          priorWrongCount: 0,
          correct: null,
          done: false,
          submittedResponse: null,
        },
      ],
    },
  ],
};

describe("LibraryDocView", () => {
  it("제목, 목차, 본문을 보여준다", () => {
    render(<LibraryDocView doc={doc} viewerRole="student" />);
    expect(screen.getByText("이차방정식 개념 정리")).toBeInTheDocument();
    expect(screen.getByText("목차")).toBeInTheDocument();
    expect(
      screen.getByText(/판별식을 이용하면 실근의 개수를 알 수 있습니다/)
    ).toBeInTheDocument();
  });

  it("학생에게는 정답과 해설이 풀기 전까지 보이지 않는다", () => {
    render(<LibraryDocView doc={doc} viewerRole="student" />);
    expect(screen.getByText("판별식이 0이면?")).toBeInTheDocument();
    expect(screen.queryByText("D=0이면 중근을 가집니다.")).not.toBeInTheDocument();
    expect(
      screen.getByText("중근").closest("button")?.className ?? ""
    ).not.toMatch(/bg-green-bg|border-green/);
  });

  it("학생이 객관식을 클릭하고 채점하면 정답을 맞혔을 때만 해설이 보인다", async () => {
    vi.mocked(problemlogActions.retryMcAttempt).mockResolvedValue({
      correct: true,
      attemptNumber: 1,
      done: true,
      correctIndex: 1,
      explanation: "D=0이면 중근을 가집니다.",
    });
    render(<LibraryDocView doc={doc} viewerRole="student" />);
    fireEvent.click(screen.getByText("중근"));
    fireEvent.click(screen.getByText("채점하기"));
    await waitFor(() =>
      expect(problemlogActions.retryMcAttempt).toHaveBeenCalledWith("p1", 1)
    );
    await waitFor(() =>
      expect(screen.getByText("D=0이면 중근을 가집니다.")).toBeInTheDocument()
    );
  });

  it("회귀: 로드 시 redact된(correctIndex/explanation 비어있는) 문제도 채점 응답에서 실제 정답/해설을 반영한다", async () => {
    const redactedDoc: LibraryDocDetail = {
      ...doc,
      sections: [
        {
          ...doc.sections[0],
          problems: [
            {
              ...doc.sections[0].problems[0],
              correctIndex: null,
              explanation: "",
            },
          ],
        },
      ],
    };
    vi.mocked(problemlogActions.retryMcAttempt).mockResolvedValue({
      correct: true,
      attemptNumber: 1,
      done: true,
      correctIndex: 1,
      explanation: "실제 해설",
    });
    render(<LibraryDocView doc={redactedDoc} viewerRole="student" />);
    fireEvent.click(screen.getByText("중근"));
    fireEvent.click(screen.getByText("채점하기"));
    await waitFor(() =>
      expect(problemlogActions.retryMcAttempt).toHaveBeenCalledWith("p1", 1)
    );
    await waitFor(() =>
      expect(screen.getByText("실제 해설")).toBeInTheDocument()
    );
    expect(
      screen.getByText("중근").closest("button")?.className ?? ""
    ).toMatch(/bg-green-bg|border-green/);
  });

  it("선생님/관리자에게는 정답과 해설이 항상 보이고 입력은 불가능하다", () => {
    render(<LibraryDocView doc={doc} viewerRole="teacher" />);
    expect(screen.getByText("D=0이면 중근을 가집니다.")).toBeInTheDocument();
    expect(screen.queryByText("채점하기")).not.toBeInTheDocument();
  });

  it("학부모에게는 정답/해설/선택지가 전부 숨겨지고 안내 문구만 보인다", () => {
    render(<LibraryDocView doc={doc} viewerRole="parent" />);
    expect(screen.getByText("판별식이 0이면?")).toBeInTheDocument();
    expect(screen.queryByText("중근")).not.toBeInTheDocument();
    expect(screen.queryByText("D=0이면 중근을 가집니다.")).not.toBeInTheDocument();
    expect(
      screen.getByText("이 문제는 학생 계정으로 로그인해야 풀 수 있습니다.")
    ).toBeInTheDocument();
  });
});

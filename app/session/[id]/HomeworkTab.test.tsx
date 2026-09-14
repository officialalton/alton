import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomeworkTab from "./HomeworkTab";
import * as homeworkActions from "./homework-actions";

vi.mock("./homework-actions", () => ({
  saveHomeworkAnswer: vi.fn().mockResolvedValue(undefined),
  addHomeworkItem: vi.fn(),
}));

vi.mock("@/app/teacher/homework-composition-actions", () => ({
  composeHomeworkFromSession: vi.fn().mockResolvedValue([]),
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

// Gap 2 (2026-09-08, 제품 오너 리뷰) — 담당 선생님/관리자의 읽기전용 제출 현황 뷰.
describe("HomeworkTab — v3 과제 제출 현황(Gap 2, 읽기전용)", () => {
  const statusItems = [
    {
      id: "shi1",
      problemId: "p1",
      position: 1,
      format: "mc",
      passage: "다음 중 소수는?",
      options: ["4", "7", "9"],
      status: "submitted" as const,
      response: { type: "mc", selected: 1 },
    },
    {
      id: "shi2",
      problemId: "p2",
      position: 2,
      format: "essay",
      passage: "요약하시오.",
      options: null,
      status: "draft" as const,
      response: { type: "text", text: "쓰다 만 답" },
    },
    {
      id: "shi3",
      problemId: "p3",
      position: 3,
      format: "essay",
      passage: "다음을 논하시오.",
      options: null,
      status: "not_started" as const,
      response: null,
    },
  ];

  it("MC 제출 답안은 선택한 보기 텍스트와 함께 보여준다", () => {
    render(
      <HomeworkTab
        sessionId="s1"
        initialItems={[]}
        viewerRole="teacher"
        sessionSource="v3"
        realViewerRole="teacher"
        homeworkStatusItems={statusItems}
      />
    );
    expect(screen.getByText(/선택한 답: B — 7/)).toBeInTheDocument();
    expect(screen.getByText("제출완료")).toBeInTheDocument();
  });

  it("서술형 임시저장 답안도 텍스트 그대로 보여준다(제출 전이라도)", () => {
    render(
      <HomeworkTab
        sessionId="s1"
        initialItems={[]}
        viewerRole="teacher"
        sessionSource="v3"
        realViewerRole="teacher"
        homeworkStatusItems={statusItems}
      />
    );
    expect(screen.getByText("쓰다 만 답")).toBeInTheDocument();
    expect(screen.getByText("임시 저장됨")).toBeInTheDocument();
  });

  it("작성 전 항목은 안내 문구만 보여준다", () => {
    render(
      <HomeworkTab
        sessionId="s1"
        initialItems={[]}
        viewerRole="teacher"
        sessionSource="v3"
        realViewerRole="teacher"
        homeworkStatusItems={statusItems}
      />
    );
    expect(screen.getByText("아직 답안이 없습니다.")).toBeInTheDocument();
  });

  it("이 뷰에는 어떤 입력/저장 컨트롤도 없다(읽기전용 강제)", () => {
    render(
      <HomeworkTab
        sessionId="s1"
        initialItems={[]}
        viewerRole="teacher"
        sessionSource="v3"
        realViewerRole="teacher"
        homeworkStatusItems={statusItems}
      />
    );
    // 상태 목록 섹션 안에는 textarea/input이 없어야 한다(과제 구성 폼 자체는
    // 별개 섹션이라 여기선 문항 수 입력 등이 존재할 수 있으므로, 상태 카드
    // 텍스트 근처에 편집 가능한 컨트롤이 없음을 값으로 확인한다).
    expect(screen.queryByDisplayValue("쓰다 만 답")).not.toBeInTheDocument();
  });

  it("학생 뷰어에는 제출 현황 섹션 자체가 없다", () => {
    render(
      <HomeworkTab
        sessionId="s1"
        initialItems={[]}
        viewerRole="student"
        sessionSource="v3"
        realViewerRole="student"
        homeworkStatusItems={statusItems}
      />
    );
    expect(
      screen.queryByText("이 세션에서 발급한 과제 — 제출 현황")
    ).not.toBeInTheDocument();
  });
});

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MaterialTab from "./MaterialTab";
import type { MaterialData } from "./material-data";
import * as actions from "./actions";
import * as useActions from "./session-content-use-actions";

vi.mock("./actions", () => ({
  submitMcAttempt: vi.fn(),
  submitEssayAttempt: vi.fn(),
  submitMathAttempt: vi.fn(),
}));

vi.mock("./session-content-use-actions", () => ({
  markMaterialUsedInLesson: vi.fn().mockResolvedValue(undefined),
  markProblemUsedInLesson: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./canvas-actions", () => ({
  saveCanvasStrokes: vi.fn(),
}));

vi.mock("./vocab-actions", () => ({
  addVocabWord: vi.fn(),
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

const material: MaterialData = {
  docId: "doc-1",
  title: "이차방정식 개념 정리",
  canvasStrokes: [],
  sections: [
    {
      id: "sec-1",
      title: "Lesson Overview",
      body: "<p>판별식을 배웁니다.</p>",
      teachingTip: "학생이 헷갈려하면 그래프로 설명",
      problems: [
        {
          id: "prob-1",
          format: "mc",
          passage: "D의 값은?",
          options: ["0", "1", "16", "-16"],
          correctIndex: 0,
          explanation: "D = 0 입니다.",
          difficulty: "easy",
          skillType: null,
          priorWrongCount: 0,
          correct: null,
          done: false,
          submittedResponse: null,
        },
      ],
    },
  ],
};

describe("MaterialTab", () => {
  it("TOC에 섹션 제목과 문제 포함 표시가 보인다", () => {
    render(
      <MaterialTab
        sessionId="s1"
        studentId="student-1"
        material={material}
        viewerRole="student"
        tipsVisible={true}
      />
    );
    expect(screen.getAllByText("Lesson Overview").length).toBeGreaterThan(0);
    expect(screen.getByTitle("확인 문제 포함")).toBeInTheDocument();
  });

  it("학생이 오답을 고르면 재도전 메시지가 뜨고, 정답을 고르면 정답 처리된다", async () => {
    vi.mocked(actions.submitMcAttempt)
      .mockResolvedValueOnce({
        correct: false,
        attemptNumber: 1,
        done: false,
        correctIndex: null,
      })
      .mockResolvedValueOnce({
        correct: true,
        attemptNumber: 2,
        done: true,
        correctIndex: 0,
      });

    render(
      <MaterialTab
        sessionId="s1"
        studentId="student-1"
        material={material}
        viewerRole="student"
        tipsVisible={true}
      />
    );

    fireEvent.click(screen.getByText("1"));
    fireEvent.click(screen.getByText("채점하기"));
    await waitFor(() =>
      expect(screen.getByText(/오답입니다/)).toBeInTheDocument()
    );

    await waitFor(() => expect(screen.getByText("0")).toBeInTheDocument());
    fireEvent.click(screen.getByText("0"));
    fireEvent.click(screen.getByText("채점하기"));
    await waitFor(() =>
      expect(screen.getByText(/정답입니다/)).toBeInTheDocument()
    );
  });

  it("선생님에게는 정답 배지와 티칭 팁이 보인다", () => {
    render(
      <MaterialTab
        sessionId="s1"
        studentId="student-1"
        material={material}
        viewerRole="teacher"
        tipsVisible={true}
      />
    );
    expect(screen.getByText("정답: A")).toBeInTheDocument();
    expect(screen.getByText(/학생이 헷갈려하면/)).toBeInTheDocument();
  });

  it("R9 Task 3: 선생님에게는 섹션/문제마다 '사용 처리' 버튼이 보이고, 탭을 여는 것만으로는 호출되지 않는다", () => {
    render(
      <MaterialTab
        sessionId="s1"
        studentId="student-1"
        material={material}
        viewerRole="teacher"
        tipsVisible={true}
      />
    );
    const buttons = screen.getAllByText("사용 처리");
    // 섹션 1개 + 문제 1개 = 최소 2개의 명시적 버튼.
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    // 렌더링(탭 열기) 자체는 어떤 mark-used 액션도 호출하지 않는다.
    expect(useActions.markMaterialUsedInLesson).not.toHaveBeenCalled();
    expect(useActions.markProblemUsedInLesson).not.toHaveBeenCalled();
  });

  it("R9 Task 3: '사용 처리' 버튼을 명시적으로 클릭해야만 markMaterialUsedInLesson이 호출된다", async () => {
    render(
      <MaterialTab
        sessionId="s1"
        studentId="student-1"
        material={material}
        viewerRole="teacher"
        tipsVisible={true}
      />
    );
    const [sectionButton] = screen.getAllByText("사용 처리");
    fireEvent.click(sectionButton);
    await waitFor(() =>
      expect(useActions.markMaterialUsedInLesson).toHaveBeenCalledWith("s1", "sec-1")
    );
    await waitFor(() => expect(screen.getAllByText("사용 처리됨").length).toBeGreaterThan(0));
  });

  it("R9 Task 3: 학생에게는 '사용 처리' 버튼이 보이지 않는다", () => {
    render(
      <MaterialTab
        sessionId="s1"
        studentId="student-1"
        material={material}
        viewerRole="student"
        tipsVisible={true}
      />
    );
    expect(screen.queryByText("사용 처리")).not.toBeInTheDocument();
  });

  it("교재가 배정되지 않은 세션에서는 안내 문구를 보여준다", () => {
    render(
      <MaterialTab
        sessionId="s1"
        studentId="student-1"
        material={null}
        viewerRole="student"
        tipsVisible={true}
      />
    );
    expect(
      screen.getByText("이 세션에는 아직 배정된 교재가 없습니다.")
    ).toBeInTheDocument();
  });

  it("서술형 입력창은 내용이 늘어나면 높이가 자동으로 커진다", () => {
    const essayMaterial: MaterialData = {
      ...material,
      sections: [
        {
          ...material!.sections[0],
          problems: [
            {
              id: "prob-essay",
              format: "essay",
              passage: "이 문장을 서술하세요.",
              options: null,
              correctIndex: null,
              explanation: "모범답안",
              difficulty: "medium",
              skillType: null,
              priorWrongCount: 0,
              correct: null,
              done: false,
              submittedResponse: null,
            },
          ],
        },
      ],
    };
    render(
      <MaterialTab
        sessionId="session-1"
        studentId="student-1"
        material={essayMaterial}
        viewerRole="student"
        tipsVisible={false}
      />
    );
    const textarea = screen.getByPlaceholderText("답안을 입력하세요") as HTMLTextAreaElement;
    Object.defineProperty(textarea, "scrollHeight", { value: 200, configurable: true });
    fireEvent.change(textarea, { target: { value: "긴 답안입니다" } });
    expect(textarea.style.height).toBe("200px");
  });
});

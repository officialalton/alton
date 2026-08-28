import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StudentShell from "./StudentShell";
import type { DashboardData } from "./dashboard-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/app/login/actions", () => ({
  logout: vi.fn(),
}));

vi.mock("@/app/session/[id]/vocab-actions", () => ({
  removeVocabWord: vi.fn(),
}));

vi.mock("@/app/session/[id]/problemlog-actions", () => ({
  toggleSaveAttempt: vi.fn(),
  retryMcAttempt: vi.fn(),
  retryEssayAttempt: vi.fn(),
  retryMathAttempt: vi.fn(),
  saveTeacherPick: vi.fn(),
  removeTeacherPick: vi.fn(),
}));

vi.mock("./memo-actions", () => ({
  addMemo: vi.fn(),
}));

vi.mock("./review-actions", () => ({
  submitStudentFeedback: vi.fn(),
}));

vi.mock("@/app/session/[id]/homework-actions", () => ({
  saveHomeworkAnswer: vi.fn(),
}));

vi.mock("./credits-actions", () => ({
  requestParentPayment: vi.fn(),
}));

vi.mock("./chat-actions", () => ({
  sendChatMessage: vi.fn(),
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
    }),
    removeChannel: vi.fn(),
  }),
}));

const dashboard: DashboardData = {
  studentName: "지훈",
  upcoming: [],
  calendarByDay: {},
  calendarYear: 2026,
  calendarMonth: 7,
  attendanceRate: null,
};

const lessonsProps = {
  upcoming: [],
  past: [],
  curricula: [],
  memosByEnrollment: {},
  reviews: {},
  myFeedback: {},
  homeworkTodo: [],
  homeworkDone: [],
  materialsLibrary: [],
  credits: { balance: 0, guardianName: null },
  stats: { attendanceRate: null, satisfactionAvg: null, bySubject: [] },
  teacherList: [],
  teacherProfiles: {},
  teacherSessionHistory: {},
  chatThreads: {},
};

describe("StudentShell", () => {
  it("사이드바 9개 항목을 보여주고, 기본 탭은 홈이다", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        vocabWords={[]}
        problemLog={[]}
        {...lessonsProps}
      />
    );
    ["홈", "레슨", "선생님", "과제", "문제", "단어장", "교재", "수업권", "통계"].forEach(
      (label) => expect(screen.getByText(label)).toBeInTheDocument()
    );
    expect(screen.getByText(/지훈의 학습 현황/)).toBeInTheDocument();
  });

  it("선생님 탭을 누르면 TeacherTab이 렌더링된다", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        vocabWords={[]}
        problemLog={[]}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("선생님"));
    expect(screen.getByText("매칭된 선생님이 없습니다.")).toBeInTheDocument();
  });

  it("수업권 탭을 누르면 CreditsTab이 렌더링된다", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        vocabWords={[]}
        problemLog={[]}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("수업권"));
    expect(screen.getByText("장 보유")).toBeInTheDocument();
  });

  it("단어장 탭을 누르면 VocabTab이 렌더링된다", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        vocabWords={[]}
        problemLog={[]}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("단어장"));
    expect(
      screen.getByText("아직 저장한 단어가 없습니다. 교재에서 모르는 단어를 클릭해보세요.")
    ).toBeInTheDocument();
  });

  it("문제 탭을 누르면 ProblemLogTab이 렌더링된다", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        vocabWords={[]}
        problemLog={[]}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("문제"));
    expect(screen.getByText("조건에 맞는 문제 기록이 없습니다.")).toBeInTheDocument();
  });

  it("레슨 탭을 누르면 LessonsTab이 렌더링된다", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        vocabWords={[]}
        problemLog={[]}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("레슨"));
    expect(screen.getByText("예정된 수업이 없습니다.")).toBeInTheDocument();
  });

  it("과제 탭을 누르면 StudentHomeworkTab이 렌더링된다", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        vocabWords={[]}
        problemLog={[]}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("과제"));
    expect(screen.getByText("작성이 필요한 과제가 없습니다.")).toBeInTheDocument();
  });

  it("교재 탭을 누르면 MaterialsLibraryTab이 렌더링된다", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        vocabWords={[]}
        problemLog={[]}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("교재"));
    expect(screen.getByText("열람할 수 있는 교재가 없습니다.")).toBeInTheDocument();
  });

  it("통계 탭을 누르면 StatsTab이 렌더링된다", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        vocabWords={[]}
        problemLog={[]}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("통계"));
    expect(screen.getByText("과목별 참여율")).toBeInTheDocument();
  });

  it("계정 메뉴를 열면 로그아웃 버튼이 보인다", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        vocabWords={[]}
        problemLog={[]}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("지훈 학생님 ▾"));
    expect(screen.getByText("로그아웃")).toBeInTheDocument();
  });
});

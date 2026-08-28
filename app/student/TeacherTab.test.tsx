import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TeacherTab from "./TeacherTab";
import type { TeacherListItem, TeacherProfileData, TeacherSessionHistoryItem } from "./teacher-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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

const teachers: TeacherListItem[] = [
  {
    teacherId: "t1",
    name: "박서연 선생님",
    school: "서울대학교 수리과학부 재학 · SAT Math 전담",
    subjects: [{ subjectName: "SAT Math", currentSession: 8, totalSessions: 12 }],
  },
];

const profiles: Record<string, TeacherProfileData | null> = {
  t1: {
    teacherId: "t1",
    name: "박서연 선생님",
    school: "서울대학교 수리과학부 재학 · SAT Math 전담",
    bio: "SAT Math 800점 만점 지도 경험 다수.",
    subjects: ["SAT Math"],
  },
};

const history: Record<string, TeacherSessionHistoryItem[]> = {
  t1: [
    { sessionId: "s1", subjectName: "SAT Math", sessionNumber: 7, scheduledAt: "2026-08-01T05:00:00.000Z" },
  ],
};

const chatThreads = {
  t1: { threadId: "th1", messages: [] },
};

describe("TeacherTab", () => {
  it("선생님 카드에 이름/학교/과목·회차를 보여준다", () => {
    render(
      <TeacherTab
        teachers={teachers}
        profiles={profiles}
        sessionHistory={history}
        chatThreads={chatThreads}
      />
    );
    expect(screen.getByText("박서연 선생님")).toBeInTheDocument();
    expect(screen.getByText(/SAT Math · 8\/12회차/)).toBeInTheDocument();
  });

  it("프로필 보기를 누르면 학교/자기소개를 보여준다", () => {
    render(
      <TeacherTab
        teachers={teachers}
        profiles={profiles}
        sessionHistory={history}
        chatThreads={chatThreads}
      />
    );
    fireEvent.click(screen.getByText("프로필 보기"));
    expect(screen.getByText("SAT Math 800점 만점 지도 경험 다수.")).toBeInTheDocument();
  });

  it("수업 내역 보기를 누르면 지난 수업 목록이 보인다", () => {
    render(
      <TeacherTab
        teachers={teachers}
        profiles={profiles}
        sessionHistory={history}
        chatThreads={chatThreads}
      />
    );
    fireEvent.click(screen.getByText("프로필 보기"));
    fireEvent.click(screen.getByText("이 선생님과 진행한 수업 내역 보기"));
    expect(screen.getByText(/SAT Math · 7회차/)).toBeInTheDocument();
  });

  it("메시지 버튼을 누르면 ChatPanel이 뜬다", () => {
    render(
      <TeacherTab
        teachers={teachers}
        profiles={profiles}
        sessionHistory={history}
        chatThreads={chatThreads}
      />
    );
    fireEvent.click(screen.getByText("💬 메시지"));
    expect(screen.getByText("박서연 선생님과의 메시지")).toBeInTheDocument();
    expect(
      screen.getByText("이 대화는 학부모님과 관리자가 항상 열람할 수 있습니다.")
    ).toBeInTheDocument();
  });
});

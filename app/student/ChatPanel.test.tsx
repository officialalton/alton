import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ChatPanel from "./ChatPanel";
import * as chatActions from "./chat-actions";
import type { ChatMessage } from "./chat-data";

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

const messages: ChatMessage[] = [
  {
    id: "m1",
    senderRole: "teacher",
    text: "이번 주 과제 확인 부탁해요",
    createdAt: "2026-08-28T00:00:00.000Z",
  },
];

describe("ChatPanel", () => {
  it("기존 메시지를 보낸 사람 라벨과 함께 보여준다", () => {
    render(
      <ChatPanel
        threadId="th1"
        teacherName="박서연 선생님"
        initialMessages={messages}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText("이번 주 과제 확인 부탁해요")).toBeInTheDocument();
    expect(screen.getByText("선생님")).toBeInTheDocument();
  });

  it("메시지를 보내면 실제 액션을 호출하고 목록에 추가한다", async () => {
    vi.mocked(chatActions.sendChatMessage).mockResolvedValue({
      id: "m2",
      senderRole: "student",
      text: "네 확인했습니다",
      createdAt: "2026-08-28T00:05:00.000Z",
    });
    render(
      <ChatPanel
        threadId="th1"
        teacherName="박서연 선생님"
        initialMessages={[]}
        onBack={vi.fn()}
      />
    );
    fireEvent.change(screen.getByPlaceholderText("메시지를 입력하세요"), {
      target: { value: "네 확인했습니다" },
    });
    fireEvent.click(screen.getByText("전송"));
    await waitFor(() =>
      expect(chatActions.sendChatMessage).toHaveBeenCalledWith("th1", "네 확인했습니다")
    );
    await waitFor(() =>
      expect(screen.getByText("네 확인했습니다")).toBeInTheDocument()
    );
  });

  it("빈 메시지는 전송 버튼이 비활성화된다", () => {
    render(
      <ChatPanel
        threadId="th1"
        teacherName="박서연 선생님"
        initialMessages={[]}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText("전송")).toBeDisabled();
  });
});

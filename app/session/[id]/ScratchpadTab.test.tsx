import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ScratchpadTab from "./ScratchpadTab";
import * as scratchpadActions from "./scratchpad-actions";

vi.mock("./scratchpad-actions", () => ({
  addDocLink: vi.fn(),
  removeDocLink: vi.fn().mockResolvedValue(undefined),
  saveWhiteboardStrokes: vi.fn(),
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

const links = [{ id: "d1", title: "8회차 수업 기록", externalUrl: "https://docs.google.com/x" }];

describe("ScratchpadTab", () => {
  it("기본 서브탭은 Docs이고, 등록된 문서가 없으면 안내 문구를 보여준다", () => {
    render(
      <ScratchpadTab
        sessionId="s1"
        viewerRole="student"
        initialDocLinks={[]}
        initialWhiteboardStrokes={[]}
      />
    );
    expect(screen.getByText("등록된 문서가 없습니다.")).toBeInTheDocument();
  });

  it("학생에게는 문서 삭제/추가 버튼이 안 보인다", () => {
    render(
      <ScratchpadTab
        sessionId="s1"
        viewerRole="student"
        initialDocLinks={links}
        initialWhiteboardStrokes={[]}
      />
    );
    expect(screen.getByText("8회차 수업 기록")).toBeInTheDocument();
    expect(screen.getByText("열기 →")).toBeInTheDocument();
    expect(screen.queryByText("삭제")).not.toBeInTheDocument();
    expect(screen.queryByText("+ 문서 추가")).not.toBeInTheDocument();
  });

  it("선생님은 문서를 추가할 수 있다", async () => {
    vi.mocked(scratchpadActions.addDocLink).mockResolvedValue({
      id: "d2",
      title: "새 문서",
      externalUrl: "https://docs.google.com/y",
    });

    render(
      <ScratchpadTab
        sessionId="s1"
        viewerRole="teacher"
        initialDocLinks={[]}
        initialWhiteboardStrokes={[]}
      />
    );

    fireEvent.click(screen.getByText("+ 문서 추가"));
    fireEvent.change(screen.getByPlaceholderText("예: 8회차 수업 기록"), {
      target: { value: "새 문서" },
    });
    fireEvent.change(screen.getByPlaceholderText("https://docs.google.com/..."), {
      target: { value: "https://docs.google.com/y" },
    });
    fireEvent.click(screen.getByText("추가하기"));

    await waitFor(() =>
      expect(scratchpadActions.addDocLink).toHaveBeenCalledWith(
        "s1",
        "새 문서",
        "https://docs.google.com/y"
      )
    );
    await waitFor(() => expect(screen.getByText("새 문서")).toBeInTheDocument());
  });

  it("선생님은 문서를 삭제할 수 있다", async () => {
    render(
      <ScratchpadTab
        sessionId="s1"
        viewerRole="teacher"
        initialDocLinks={links}
        initialWhiteboardStrokes={[]}
      />
    );

    fireEvent.click(screen.getByText("삭제"));
    await waitFor(() =>
      expect(scratchpadActions.removeDocLink).toHaveBeenCalledWith("d1")
    );
    await waitFor(() =>
      expect(screen.queryByText("8회차 수업 기록")).not.toBeInTheDocument()
    );
  });

  it("화이트보드 서브탭으로 전환하면 스크롤 안내 문구가 보인다", () => {
    render(
      <ScratchpadTab
        sessionId="s1"
        viewerRole="teacher"
        initialDocLinks={[]}
        initialWhiteboardStrokes={[]}
      />
    );
    fireEvent.click(screen.getByText("화이트보드"));
    expect(
      screen.getByText("아래로 계속 스크롤하며 필기할 수 있습니다.")
    ).toBeInTheDocument();
  });
});

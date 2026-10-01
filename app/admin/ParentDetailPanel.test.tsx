import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ParentDetailPanel from "./ParentDetailPanel";
import * as parentActions from "./parent-detail-actions";
import * as usersActions from "./users-actions";
import type { ParentDetail } from "./parent-detail-actions";

vi.mock("./parent-detail-actions", () => ({
  getParentDetailAction: vi.fn(),
  setChildConsultantFromParentPanelAction: vi.fn(),
}));
vi.mock("./users-actions", () => ({
  setParentStatus: vi.fn(),
}));

const baseDetail: ParentDetail = {
  id: "p1",
  name: "김민지",
  status: "active",
  joinedAt: "2026-01-01T00:00:00.000Z",
  location: "서울",
  referralCode: "REF123",
  householdId: "h1",
  children: [
    { id: "s1", name: "지훈", status: "active", consultantId: "c1", consultantName: "박컨설턴트" },
  ],
  contracts: [
    { id: "ct1", childName: "지훈", status: "signed", createdAt: "2026-02-01T00:00:00.000Z", voidedAt: null, voidReason: null },
  ],
  messages: [
    { id: "m1", senderRole: "guardian", senderName: "김민지", body: "안녕하세요", createdAt: "2026-03-01T00:00:00.000Z" },
  ],
};

describe("ParentDetailPanel", () => {
  it("학부모 정보·자녀·계약·연락 이력을 보여준다", async () => {
    vi.mocked(parentActions.getParentDetailAction).mockResolvedValue(baseDetail);
    render(<ParentDetailPanel parentId="p1" parentName="김민지" parentEmail="minji@example.com" onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByText("지훈")[0]).toBeInTheDocument());
    expect(screen.getByText("박컨설턴트", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("안녕하세요")).toBeInTheDocument();
    expect(screen.getByText(/서울/)).toBeInTheDocument();
  });

  it("상태를 변경하면 setParentStatus가 호출된다", async () => {
    vi.mocked(parentActions.getParentDetailAction).mockResolvedValue(baseDetail);
    vi.mocked(usersActions.setParentStatus).mockResolvedValue(undefined);
    render(<ParentDetailPanel parentId="p1" parentName="김민지" parentEmail="minji@example.com" onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByText("지훈")[0]).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue("활성"), { target: { value: "suspended" } });
    await waitFor(() => expect(usersActions.setParentStatus).toHaveBeenCalledWith("p1", "suspended"));
  });

  it("상태 전환이 실패하면 되돌리고 오류를 보여준다", async () => {
    vi.mocked(parentActions.getParentDetailAction).mockResolvedValue(baseDetail);
    vi.mocked(usersActions.setParentStatus).mockRejectedValue(new Error("허용되지 않는 상태 전이입니다"));
    render(<ParentDetailPanel parentId="p1" parentName="김민지" parentEmail="minji@example.com" onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByText("지훈")[0]).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue("활성"), { target: { value: "suspended" } });
    await waitFor(() => expect(screen.getByText("허용되지 않는 상태 전이입니다")).toBeInTheDocument());
    expect(screen.getByDisplayValue("활성")).toBeInTheDocument();
  });

  it("자녀의 컨설턴트 배정을 바꿀 수 있다", async () => {
    vi.mocked(parentActions.getParentDetailAction).mockResolvedValue(baseDetail);
    vi.mocked(parentActions.setChildConsultantFromParentPanelAction).mockResolvedValue(undefined);
    render(<ParentDetailPanel parentId="p1" parentName="김민지" parentEmail="minji@example.com" onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByText("지훈")[0]).toBeInTheDocument());
    fireEvent.click(screen.getByText("배정 변경"));
    fireEvent.change(screen.getByPlaceholderText(/컨설턴트 계정 이메일/), {
      target: { value: "new-consultant@example.com" },
    });
    fireEvent.click(screen.getByText("저장"));

    await waitFor(() =>
      expect(parentActions.setChildConsultantFromParentPanelAction).toHaveBeenCalledWith("s1", "new-consultant@example.com")
    );
  });

  it("연결된 자녀가 없으면 안내 문구를 보여준다", async () => {
    vi.mocked(parentActions.getParentDetailAction).mockResolvedValue({ ...baseDetail, children: [] });
    render(<ParentDetailPanel parentId="p1" parentName="김민지" parentEmail="minji@example.com" onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("연결된 자녀가 없습니다.")).toBeInTheDocument());
  });
});

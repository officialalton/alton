import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import PendingAccountLinkCards, { elapsedDays } from "./PendingAccountLinkCards";
import type { KanbanCard } from "./consultation-kanban-data";

const reissueMock = vi.fn();
vi.mock("./direct-account-actions", () => ({
  reissueDirectOnboardingLinkAction: (id: string) => reissueMock(id),
}));

function card(linkId: string, sentAt: string, status: "sent" | "failed" = "sent"): KanbanCard {
  return {
    id: `pending-link:${linkId}`,
    contact_name: "박보호자",
    contact_email: "parent@example.com",
    requested_children: [{ name: "자녀A" }],
    pendingAccountLink: { linkId, createdAt: sentAt, noticeSentAt: sentAt, noticeDeliveryStatus: status, studentCount: 1 },
  } as unknown as KanbanCard;
}

describe("PendingAccountLinkCards", () => {
  beforeEach(() => {
    reissueMock.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());

  it("대기 카드가 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<PendingAccountLinkCards cards={[]} onChanged={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("보호자·경과일·발송 상태를 보여주고 쿨다운이 지나면 재발송하고 목록을 갱신한다", async () => {
    reissueMock.mockResolvedValue({ status: "sent", linkId: "n", sentAt: "x", localRedeemUrl: null });
    const onChanged = vi.fn();
    const old = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    render(<PendingAccountLinkCards cards={[card("l1", old)]} onChanged={onChanged} />);
    expect(screen.getByText("박보호자")).toBeInTheDocument();
    expect(screen.getByText(/3일 경과/)).toBeInTheDocument();
    expect(screen.getByText("발송됨 — 보호자 확인 대기")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("pending-account-link-resend-l1"));
    await waitFor(() => expect(reissueMock).toHaveBeenCalledWith("l1"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("방금 발송한 링크는 재발송 버튼이 쿨다운으로 비활성화된다", () => {
    render(<PendingAccountLinkCards cards={[card("l2", new Date().toISOString())]} onChanged={() => {}} />);
    expect(screen.getByTestId("pending-account-link-resend-l2")).toBeDisabled();
  });

  it("발송 실패 상태와 발송 내역 이동 버튼을 보여준다", () => {
    const go = vi.fn();
    const old = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    render(<PendingAccountLinkCards cards={[card("l3", old, "failed")]} onChanged={() => {}} onOpenAccountCreation={go} />);
    expect(screen.getByText("발송 실패")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("pending-account-link-detail-l3"));
    expect(go).toHaveBeenCalled();
  });

  it("재발송 실패는 오류 토스트로 알린다", async () => {
    reissueMock.mockResolvedValue({ status: "failed", linkId: "l4", error: "boom" });
    const old = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    render(<PendingAccountLinkCards cards={[card("l4", old)]} onChanged={() => {}} />);
    fireEvent.click(screen.getByTestId("pending-account-link-resend-l4"));
    expect(await screen.findByText(/재발송 실패 — boom/)).toBeInTheDocument();
  });

  it("elapsedDays는 음수를 0으로 막는다", () => {
    expect(elapsedDays(new Date(Date.now() + 1e9).toISOString())).toBe(0);
  });
});

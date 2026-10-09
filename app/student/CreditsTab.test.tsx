import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CreditsTab from "./CreditsTab";
import * as creditsActions from "./credits-actions";

vi.mock("./credits-actions", () => ({
  requestParentPayment: vi.fn(),
}));

describe("CreditsTab", () => {
  it("보유 수업권 수를 보여준다", () => {
    render(<CreditsTab data={{ balance: 14, guardianName: "김민지", regularRemaining: 0, regularNearestExpiry: null, trialEntitlement: null }} />);
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("credits")).toBeInTheDocument();
  });

  it("연결된 학부모가 없으면 요청 버튼 대신 안내문구를 보여준다", () => {
    render(<CreditsTab data={{ balance: 0, guardianName: null, regularRemaining: 0, regularNearestExpiry: null, trialEntitlement: null }} />);
    expect(screen.queryByText("Ask parent to purchase")).not.toBeInTheDocument();
    expect(
      screen.getByText("No linked parent account, so a purchase request cannot be sent.")
    ).toBeInTheDocument();
  });

  it("결제 요청 버튼을 누르면 실제 액션을 호출하고 확인 메시지를 보여준다", async () => {
    vi.mocked(creditsActions.requestParentPayment).mockResolvedValue({
      guardianName: "김민지",
    });
    render(<CreditsTab data={{ balance: 14, guardianName: "김민지", regularRemaining: 0, regularNearestExpiry: null, trialEntitlement: null }} />);
    fireEvent.click(screen.getByText("Ask parent to purchase"));
    await waitFor(() =>
      expect(creditsActions.requestParentPayment).toHaveBeenCalled()
    );
    await waitFor(() =>
      expect(
        screen.getByText("A credit purchase request was sent to 김민지.")
      ).toBeInTheDocument()
    );
  });
});

describe("CreditsTab — 실제 수업권(entitlement_grants) 보유 현황", () => {
  it("체험수업권을 보유 중이면 카드로 보여준다", () => {
    render(
      <CreditsTab
        data={{
          balance: 0,
          guardianName: "김민지",
          regularRemaining: 0,
          regularNearestExpiry: null,
          trialEntitlement: { remaining: 1, expiresAt: "2026-12-01T00:00:00Z" },
        }}
      />
    );
    expect(screen.getByText("1 trial lesson credit (60 min) available")).toBeInTheDocument();
  });

  it("정규수업권 잔여가 있으면 잔여 회차와 만료일을 보여준다", () => {
    render(
      <CreditsTab
        data={{
          balance: 0,
          guardianName: "김민지",
          regularRemaining: 5,
          regularNearestExpiry: "2026-12-01T00:00:00Z",
          trialEntitlement: null,
        }}
      />
    );
    expect(screen.getByText("5 regular lessons remaining")).toBeInTheDocument();
  });

  it("보유한 수업권이 없으면 '보유 수업권' 섹션 자체를 보여주지 않는다", () => {
    render(
      <CreditsTab
        data={{ balance: 0, guardianName: null, regularRemaining: 0, regularNearestExpiry: null, trialEntitlement: null }}
      />
    );
    expect(screen.queryByText("Your Lesson Credits")).not.toBeInTheDocument();
  });

  it("체험수업권이 소진되면(잔여 0) 보유 수업권 섹션에서 사라진다", () => {
    render(
      <CreditsTab
        data={{ balance: 0, guardianName: "김민지", regularRemaining: 0, regularNearestExpiry: null, trialEntitlement: null }}
      />
    );
    expect(screen.queryByText(/trial lesson credit/)).not.toBeInTheDocument();
  });
});

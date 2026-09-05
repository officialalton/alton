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
    expect(screen.getByText("장 보유")).toBeInTheDocument();
  });

  it("연결된 학부모가 없으면 요청 버튼 대신 안내문구를 보여준다", () => {
    render(<CreditsTab data={{ balance: 0, guardianName: null, regularRemaining: 0, regularNearestExpiry: null, trialEntitlement: null }} />);
    expect(screen.queryByText("부모님께 결제 요청")).not.toBeInTheDocument();
    expect(
      screen.getByText("연결된 학부모 계정이 없어 결제 요청을 보낼 수 없습니다.")
    ).toBeInTheDocument();
  });

  it("결제 요청 버튼을 누르면 실제 액션을 호출하고 확인 메시지를 보여준다", async () => {
    vi.mocked(creditsActions.requestParentPayment).mockResolvedValue({
      guardianName: "김민지",
    });
    render(<CreditsTab data={{ balance: 14, guardianName: "김민지", regularRemaining: 0, regularNearestExpiry: null, trialEntitlement: null }} />);
    fireEvent.click(screen.getByText("부모님께 결제 요청"));
    await waitFor(() =>
      expect(creditsActions.requestParentPayment).toHaveBeenCalled()
    );
    await waitFor(() =>
      expect(
        screen.getByText("김민지 학부모님께 수업권 충전 요청 알림을 보냈습니다.")
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
          trialEntitlement: { remaining: 1, expiresAt: "2026-12-01T00:00:00Z", consumed: false },
        }}
      />
    );
    expect(screen.getByText("체험수업권(60분) 1회 보유 중")).toBeInTheDocument();
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
    expect(screen.getByText("정규수업권 잔여 5회")).toBeInTheDocument();
  });

  it("보유한 수업권이 없으면 '보유 수업권' 섹션 자체를 보여주지 않는다", () => {
    render(
      <CreditsTab
        data={{ balance: 0, guardianName: null, regularRemaining: 0, regularNearestExpiry: null, trialEntitlement: null }}
      />
    );
    expect(screen.queryByText("보유 수업권")).not.toBeInTheDocument();
  });

  it("체험수업권이 이미 소진됐어도(예약에 사용됨) 사라지지 않고 '사용 완료'로 보여준다", () => {
    render(
      <CreditsTab
        data={{
          balance: 0,
          guardianName: "김민지",
          regularRemaining: 0,
          regularNearestExpiry: null,
          trialEntitlement: { remaining: 0, expiresAt: "2026-12-01T00:00:00Z", consumed: true },
        }}
      />
    );
    expect(screen.getByText(/체험수업권\(60분\)\s*사용 완료/)).toBeInTheDocument();
    expect(screen.getByText(/이미 체험 수업 예약에 사용됐습니다\./)).toBeInTheDocument();
  });
});

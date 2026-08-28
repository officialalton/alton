import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CreditsTab from "./CreditsTab";
import type { ParentCreditsData } from "./credits-data";
import { createCreditCheckoutSession } from "./credits-actions";

vi.mock("./credits-actions", () => ({
  createCreditCheckoutSession: vi.fn(),
}));

describe("CreditsTab (parent)", () => {
  it("보유 수업권과 패키지 목록을 보여준다", () => {
    const data: ParentCreditsData = {
      balance: 14,
      referralCode: "ALTON-MINJI82",
      packages: [
        { id: "p1", name: "10장", creditCount: 10, priceUsd: 1200 },
        { id: "p2", name: "20장", creditCount: 20, priceUsd: 2400 },
      ],
    };
    render(<CreditsTab data={data} studentId="s1" />);
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("10장")).toBeInTheDocument();
    expect(screen.getByText("$1,200")).toBeInTheDocument();
    expect(screen.getByText("ALTON-MINJI82")).toBeInTheDocument();
  });

  it("카드번호 입력 폼(결제수단)은 렌더링하지 않는다", () => {
    const data: ParentCreditsData = { balance: 0, referralCode: null, packages: [] };
    render(<CreditsTab data={data} studentId="s1" />);
    expect(screen.queryByText("결제 수단")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("0000 0000 0000 0000")).not.toBeInTheDocument();
  });

  it("추천 코드가 없으면 추천 카드를 숨긴다", () => {
    const data: ParentCreditsData = { balance: 0, referralCode: null, packages: [] };
    render(<CreditsTab data={data} studentId="s1" />);
    expect(screen.queryByText("지인 추천하고 수업권 받기")).not.toBeInTheDocument();
  });

  it("충전하기를 누르면 체크아웃 세션을 만들고 이동한다", async () => {
    vi.mocked(createCreditCheckoutSession).mockResolvedValue("https://checkout.stripe.com/session123");
    const originalLocation = window.location;
    // @ts-expect-error - jsdom 환경에서 location.href 대입을 검증하기 위해 교체
    delete window.location;
    // @ts-expect-error - 위와 동일한 이유로 부분 객체를 location에 대입
    window.location = { ...originalLocation, href: "" };

    const data: ParentCreditsData = {
      balance: 0,
      referralCode: null,
      packages: [{ id: "p1", name: "10장", creditCount: 10, priceUsd: 1200 }],
    };
    render(<CreditsTab data={data} studentId="s1" />);
    fireEvent.click(screen.getByText("충전하기"));

    await waitFor(() => {
      expect(createCreditCheckoutSession).toHaveBeenCalledWith("p1", "s1");
    });
    expect(window.location.href).toBe("https://checkout.stripe.com/session123");

    // @ts-expect-error - 테스트용으로 교체했던 location 원복
    window.location = originalLocation;
  });

  it("purchaseStatus가 success면 완료 안내를 보여준다", () => {
    const data: ParentCreditsData = { balance: 10, referralCode: null, packages: [] };
    render(<CreditsTab data={data} studentId="s1" purchaseStatus="success" />);
    expect(screen.getByText(/결제가 완료되었습니다/)).toBeInTheDocument();
  });
});

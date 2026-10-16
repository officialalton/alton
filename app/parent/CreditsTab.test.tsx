import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CreditsTab from "./CreditsTab";
import type { ParentCreditsData } from "./credits-data";

describe("CreditsTab (parent) — 지인 추천 전용(2026-09-07, 수업권 잔여/충전 UI 제거)", () => {
  it("추천 코드가 있으면 추천 카드를 보여준다", () => {
    const data: ParentCreditsData = { referralCode: "ALTON-MINJI82" };
    render(<CreditsTab data={data} />);
    expect(screen.getByText("ALTON-MINJI82")).toBeInTheDocument();
    expect(screen.getByText("Refer a friend and earn lesson credits")).toBeInTheDocument();
  });

  it("추천 코드가 없으면 추천 카드를 숨기고 안내 문구를 보여준다", () => {
    const data: ParentCreditsData = { referralCode: null };
    render(<CreditsTab data={data} />);
    expect(screen.queryByText("Refer a friend and earn lesson credits")).not.toBeInTheDocument();
    expect(screen.getByText("No referral code yet.")).toBeInTheDocument();
  });

  it("잔여 수업권 장수나 충전 버튼은 더 이상 렌더링하지 않는다(EntitlementsTab이 대체)", () => {
    const data: ParentCreditsData = { referralCode: "ALTON-MINJI82" };
    render(<CreditsTab data={data} />);
    expect(screen.queryByText("credits available")).not.toBeInTheDocument();
    expect(screen.queryByText("Top up")).not.toBeInTheDocument();
    expect(screen.queryByText("Lesson credit balance")).not.toBeInTheDocument();
  });

  it("복사 버튼을 누르면 클립보드에 코드를 복사한다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const data: ParentCreditsData = { referralCode: "ALTON-MINJI82" };
    render(<CreditsTab data={data} />);
    fireEvent.click(screen.getByText("Copy"));
    expect(writeText).toHaveBeenCalledWith("ALTON-MINJI82");
  });
});

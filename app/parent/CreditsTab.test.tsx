import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CreditsTab from "./CreditsTab";
import type { ParentCreditsData } from "./credits-data";

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
    render(<CreditsTab data={data} />);
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("10장")).toBeInTheDocument();
    expect(screen.getByText("$1,200")).toBeInTheDocument();
    expect(screen.getByText("ALTON-MINJI82")).toBeInTheDocument();
  });

  it("카드번호 입력 폼(결제수단)은 렌더링하지 않는다", () => {
    const data: ParentCreditsData = { balance: 0, referralCode: null, packages: [] };
    render(<CreditsTab data={data} />);
    expect(screen.queryByText("결제 수단")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("0000 0000 0000 0000")).not.toBeInTheDocument();
  });

  it("추천 코드가 없으면 추천 카드를 숨긴다", () => {
    const data: ParentCreditsData = { balance: 0, referralCode: null, packages: [] };
    render(<CreditsTab data={data} />);
    expect(screen.queryByText("지인 추천하고 수업권 받기")).not.toBeInTheDocument();
  });
});

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MobileDrawerNav from "./MobileDrawerNav";

const groups = [
  { label: "운영", items: [{ id: "home", label: "홈", icon: "🏠" }] },
  { label: "정산", items: [{ id: "payouts", label: "정산 관리", icon: "💸" }] },
];

describe("MobileDrawerNav", () => {
  it("햄버거 버튼을 누르기 전에는 그룹 항목이 보이지 않는다", () => {
    render(<MobileDrawerNav groups={groups} activeId="home" onSelect={vi.fn()} />);
    expect(screen.queryByText("정산 관리")).not.toBeInTheDocument();
  });

  it("햄버거 버튼을 누르면 그룹 헤더와 항목이 보이고, 항목을 누르면 onSelect가 호출되며 드로어가 닫힌다", () => {
    const onSelect = vi.fn();
    render(<MobileDrawerNav groups={groups} activeId="home" onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText("메뉴 열기"));
    expect(screen.getByText("운영")).toBeInTheDocument();
    expect(screen.getByText("정산 관리")).toBeInTheDocument();

    fireEvent.click(screen.getByText("정산 관리"));
    expect(onSelect).toHaveBeenCalledWith("payouts");
    expect(screen.queryByText("운영")).not.toBeInTheDocument();
  });
});

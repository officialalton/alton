import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MobileBottomNav, { type MobileNavItem } from "./MobileBottomNav";

const primary: MobileNavItem[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "classes", label: "Classes", icon: "classes" },
];
const more: MobileNavItem[] = [
  { id: "vocab", label: "Vocabulary", icon: "vocabulary" },
  { id: "stats", label: "Stats", icon: "performance" },
];

describe("MobileBottomNav", () => {
  it("기본 탭 버튼을 누르면 onSelect가 호출된다", () => {
    const onSelect = vi.fn();
    render(<MobileBottomNav primary={primary} more={more} activeId="home" onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Classes"));
    expect(onSelect).toHaveBeenCalledWith("classes");
  });

  it("'더보기'를 누르면 나머지 항목이 담긴 시트가 열리고, 항목을 누르면 onSelect가 호출되며 시트가 닫힌다", () => {
    const onSelect = vi.fn();
    render(<MobileBottomNav primary={primary} more={more} activeId="home" onSelect={onSelect} />);
    expect(screen.queryByText("Vocabulary")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("More"));
    expect(screen.getByText("Vocabulary")).toBeInTheDocument();
    expect(screen.getByText("Stats")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Vocabulary"));
    expect(onSelect).toHaveBeenCalledWith("vocab");
    expect(screen.queryByText("Stats")).not.toBeInTheDocument();
  });

  it("more가 비어있으면 '더보기' 버튼을 보여주지 않는다", () => {
    render(<MobileBottomNav primary={primary} more={[]} activeId="home" onSelect={vi.fn()} />);
    expect(screen.queryByText("More")).not.toBeInTheDocument();
  });
});

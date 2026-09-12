import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MobileBottomNav from "./MobileBottomNav";

const primary = [
  { id: "home", label: "홈", icon: "🏠" },
  { id: "classes", label: "수업", icon: "📅" },
];
const more = [
  { id: "vocab", label: "단어장", icon: "📖" },
  { id: "stats", label: "통계", icon: "📊" },
];

describe("MobileBottomNav", () => {
  it("기본 탭 버튼을 누르면 onSelect가 호출된다", () => {
    const onSelect = vi.fn();
    render(<MobileBottomNav primary={primary} more={more} activeId="home" onSelect={onSelect} />);
    fireEvent.click(screen.getByText("수업"));
    expect(onSelect).toHaveBeenCalledWith("classes");
  });

  it("'더보기'를 누르면 나머지 항목이 담긴 시트가 열리고, 항목을 누르면 onSelect가 호출되며 시트가 닫힌다", () => {
    const onSelect = vi.fn();
    render(<MobileBottomNav primary={primary} more={more} activeId="home" onSelect={onSelect} />);
    expect(screen.queryByText("단어장")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("더보기"));
    expect(screen.getByText("단어장")).toBeInTheDocument();
    expect(screen.getByText("통계")).toBeInTheDocument();

    fireEvent.click(screen.getByText("단어장"));
    expect(onSelect).toHaveBeenCalledWith("vocab");
    expect(screen.queryByText("통계")).not.toBeInTheDocument();
  });

  it("more가 비어있으면 '더보기' 버튼을 보여주지 않는다", () => {
    render(<MobileBottomNav primary={primary} more={[]} activeId="home" onSelect={vi.fn()} />);
    expect(screen.queryByText("더보기")).not.toBeInTheDocument();
  });
});

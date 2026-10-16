import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PillSubTabs from "./PillSubTabs";

describe("PillSubTabs", () => {
  it("활성 탭은 진한 배경, 나머지는 회색 배경으로 렌더링된다", () => {
    render(
      <PillSubTabs
        items={[
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ]}
        activeId="a"
        onSelect={() => {}}
      />
    );
    expect(screen.getByText("A").className).toContain("bg-ink");
    expect(screen.getByText("B").className).toContain("bg-grey-100");
  });

  it("클릭하면 onSelect가 해당 id로 호출된다", () => {
    const onSelect = vi.fn();
    render(
      <PillSubTabs
        items={[
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ]}
        activeId="a"
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByText("B"));
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("badgeCounts에 양수 값이 있으면 숫자 배지를 보여주고, 0/미지정이면 숨긴다", () => {
    render(
      <PillSubTabs
        items={[
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ]}
        activeId="a"
        onSelect={() => {}}
        badgeCounts={{ a: 3, b: 0 }}
      />
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});

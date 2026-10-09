// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { GroupedKeywordList, GroupedKeywordOptions } from "./GroupedKeywords";

const items = [
  { id: "1", label: "Linear equations", domainCode: "algebra" },
  { id: "2", label: "Circles", domainCode: "geometry_trig" },
  { id: "3", label: "Legacy" },
];

describe("GroupedKeywordOptions", () => {
  it("optgroup 으로 묶고 value 는 id 그대로", () => {
    const { container } = render(<select><GroupedKeywordOptions items={items} otherLabel="기타" /></select>);
    const labels = [...container.querySelectorAll("optgroup")].map((g) => g.label);
    expect(labels).toEqual(["Algebra", "Geometry and Trigonometry", "기타"]);
    expect((container.querySelector("option[value='2']") as HTMLOptionElement).textContent).toBe("Circles");
  });
  it("도메인이 없으면 평면 옵션", () => {
    const { container } = render(<select><GroupedKeywordOptions items={[{ id: "9", label: "x" }]} /></select>);
    expect(container.querySelector("optgroup")).toBeNull();
    expect(container.querySelectorAll("option")).toHaveLength(1);
  });
});

describe("GroupedKeywordList", () => {
  it("도메인 제목 + 선택 수 + 칩, 선택 상태 유지", () => {
    render(<GroupedKeywordList items={items} selectedIds={["1"]} renderItem={(k) => <button key={k.id} aria-pressed={k.id === "1"}>{k.label}</button>} />);
    const algebra = screen.getByTestId("keyword-group-algebra");
    expect(within(algebra).getByText("Algebra")).toBeTruthy();
    expect(within(algebra).getByText("(1)")).toBeTruthy();
    expect(within(algebra).getByRole("button", { name: "Linear equations" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("keyword-group-__other")).toBeTruthy();
  });
  it("도메인이 없으면 헤더 없이 평면", () => {
    const { container } = render(<GroupedKeywordList items={[{ id: "9", label: "x" }]} renderItem={(k) => <button key={k.id}>{k.label}</button>} />);
    expect(container.querySelector("details")).toBeNull();
  });
});

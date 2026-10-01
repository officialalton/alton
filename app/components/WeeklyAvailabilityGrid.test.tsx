import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WeeklyAvailabilityGrid from "./WeeklyAvailabilityGrid";

describe("WeeklyAvailabilityGrid", () => {
  it("요일 7개 헤더와 각 규칙에 대한 블록을 렌더링한다", () => {
    render(
      <WeeklyAvailabilityGrid
        rules={[
          { id: "r1", weekday: 1, startTime: "10:00", endTime: "17:00" },
          { id: "r2", weekday: 1, startTime: "19:00", endTime: "23:00" },
        ]}
      />
    );
    expect(screen.getByTestId("weekly-availability-grid")).toBeInTheDocument();
    expect(screen.getByTestId("availability-block-r1")).toHaveTextContent("10:00~17:00");
    expect(screen.getByTestId("availability-block-r2")).toHaveTextContent("19:00~23:00");
  });

  it("블록을 클릭하면 onDeleteRule이 해당 규칙 id로 호출된다", () => {
    const onDeleteRule = vi.fn();
    render(<WeeklyAvailabilityGrid rules={[{ id: "r1", weekday: 3, startTime: "09:00", endTime: "12:00" }]} onDeleteRule={onDeleteRule} />);
    fireEvent.click(screen.getByTestId("availability-block-r1"));
    expect(onDeleteRule).toHaveBeenCalledWith("r1");
  });

  it("규칙이 없으면 헤더만 렌더링되고 블록은 없다", () => {
    render(<WeeklyAvailabilityGrid rules={[]} />);
    expect(screen.getByTestId("weekly-availability-grid")).toBeInTheDocument();
    expect(screen.queryByTestId(/availability-block-/)).not.toBeInTheDocument();
  });
});

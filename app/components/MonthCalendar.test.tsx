import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MonthCalendar from "./MonthCalendar";

describe("MonthCalendar", () => {
  it("초기 연/월을 표시하고 날짜 클릭 시 onSelectDate를 호출한다", () => {
    const onSelectDate = vi.fn();
    render(
      <MonthCalendar
        timezone="America/Los_Angeles"
        selectedDateKey={null}
        onSelectDate={onSelectDate}
        initialYearMonth="2026-10"
      />
    );
    expect(screen.getByText("October 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByText("15"));
    expect(onSelectDate).toHaveBeenCalledWith("2026-10-15");
  });

  it("배지가 있는 날짜에는 표시 점이 보인다", () => {
    render(
      <MonthCalendar
        timezone="America/Los_Angeles"
        selectedDateKey={null}
        onSelectDate={() => {}}
        initialYearMonth="2026-10"
        badgesByDate={{ "2026-10-15": { count: 2 } }}
      />
    );
    const button = screen.getByText("15").closest("button");
    expect(button?.querySelector("span.rounded-full")).toBeTruthy();
  });

  it("외부 바쁨 날짜에는 밑줄 표시가 붙는다(제목·내용 없이)", () => {
    render(
      <MonthCalendar
        timezone="America/Los_Angeles"
        selectedDateKey={null}
        onSelectDate={() => {}}
        initialYearMonth="2026-10"
        externalBusyDates={new Set(["2026-10-15"])}
      />
    );
    const button = screen.getByText("15").closest("button");
    expect(button?.className).toContain("underline");
    expect(button?.getAttribute("title")).toBe("External event (unavailable for booking)");
  });

  it("이전/다음 달 버튼으로 표시 월이 바뀐다", () => {
    render(
      <MonthCalendar
        timezone="America/Los_Angeles"
        selectedDateKey={null}
        onSelectDate={() => {}}
        initialYearMonth="2026-10"
      />
    );
    fireEvent.click(screen.getByLabelText("Next month"));
    expect(screen.getByText("November 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Previous month"));
    fireEvent.click(screen.getByLabelText("Previous month"));
    expect(screen.getByText("September 2026")).toBeInTheDocument();
  });
});
